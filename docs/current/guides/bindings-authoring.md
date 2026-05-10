# LLM Authoring Guide - Artifact Format for `@rntme/bindings`

This document is a reference for an LLM that will **generate** HTTP bindings for
Graph IR: `parseBindingArtifact -> validateBindings -> generateOpenApi`
from `@rntme/bindings`.

Goal: describe the format **only as much as needed** for an LLM to write valid
artifacts on the first attempt without guessing. Every rule below is normative and
backed by code (file references are listed inline).

## 0. Input Contract

```text
parseBindingArtifact(input)             -> Result<BindingArtifact>
validateBindings(artifact, resolvers)   -> Result<ValidatedBindings>
generateOpenApi(validated, options?)    -> Result<OpenApiDoc>
```

Exactly one artifact, one validation resolver object, and one optional OpenAPI options object.

| Artifact | Author | Describes |
| --- | --- | --- |
| **binding artifact** | **LLM** | HTTP routes and mappings to graph inputs |
| `BindingResolvers` | host environment (code) | returns `GraphSignature` and `ResolvedShape` by name during validation |
| `OpenApiGenOptions` | host environment (optional) | `decimalEncoding`, `info/servers`, `standardErrors` |

**Important**: the LLM generates **only the binding artifact**. Resolvers are runtime responsibility.
The LLM *reads* the graph signature (to know input names/modes and output-shape name), but does not invent it.

## 1. Primitive Types (Shared With Graph IR)

The same enum is used everywhere:

```ts
type ScalarPrimitive = 'integer' | 'decimal' | 'string' | 'boolean' | 'date' | 'datetime'
```

OpenAPI mapping (`src/openapi/shapes.ts:8`):

| primitive | JSON Schema (default) | with `decimalEncoding:'number'` |
| --- | --- | --- |
| `integer` | `{type:'integer'}` | - |
| `decimal` | `{type:'string', format:'decimal'}` | `{type:'number'}` |
| `string` | `{type:'string'}` | - |
| `boolean` | `{type:'boolean'}` | - |
| `date` | `{type:'string', format:'date'}` | - |
| `datetime` | `{type:'string', format:'date-time'}` | - |

A nullable shape field becomes `{type: [T, 'null']}` (OpenAPI 3.1 union, `src/openapi/shapes.ts:30`).

## 2. Graph Signature - What the LLM May See

The resolver returns this object (definition: `src/types/resolvers.ts:36`):

```ts
type GraphSignature = {
  id: string
  inputs: Record<string, GraphInput>
  output: { type: OutputType, from: string }
}

type GraphInput = {
  type: InputType
  mode: 'required' | 'nullable' | 'defaulted' | 'predicate_optional' | 'root'
  default?: unknown
}

type InputType =
  | { kind: 'scalar',  primitive: ScalarPrimitive }
  | { kind: 'list',    element:   ScalarPrimitive }
  | { kind: 'row',     shape: string }   // Tier 2
  | { kind: 'rowset',  shape: string }   // Tier 2

type OutputType =
  | { kind: 'rowset',  shape: string }   // ONLY rowset can be bound
  | { kind: 'row',     shape: string }   // rejected by consistency layer
  | { kind: 'scalar',  primitive: ScalarPrimitive }  // rejected
```

The LLM **reads** `signature.inputs` to learn names, `mode`, and `type`. This determines the valid
set of `parameter.bindTo`, `parameter.required`, and `parameter.in` values.

## 3. Binding Artifact - What the LLM Generates

```jsonc
{
  "version": "1.0",                           // REQUIRED, exactly this string
  "graphSpecRef": "<any string ref>",         // GraphSpec identifier
  "pdmRef":       "<any string ref>",         // PDM identifier
  "qsmRef":       "<any string ref>",         // QSM identifier
  "openapi": {                                // optional generator defaults
    "info":    { "title": "...", "version": "1.0.0", "description": "..." },
    "servers": [{ "url": "https://api.example.com", "description": "..." }]
  },
  "bindings": {                               // >= 1 key (empty Record is valid but useless)
    "<bindingId>": {
      "graph":  "<graphId>",                  // must resolve to GraphSignature
      "target": { "engine": "sqlite", "dialect": "sqlite" },   // opaque engine label
      "http":   <HttpBinding>
    }
  }
}
```

The Zod schema (`src/parse/schema.ts:71`) uses `.strict()` everywhere: **extra fields
at any level are parse errors**.

### 3.1. `version`

Exactly literal `"1.0"`. No `"1"`, `"1.0.0"`, or `"v1.0"`.

### 3.2. `graphSpecRef` / `pdmRef` / `qsmRef`

Non-empty strings. The compiler only stores them; it does not parse or resolve them.
They are identifiers for upstream tracking logic.

### 3.3. `openapi` (Top-Level)

All fields are optional:

```jsonc
"openapi": {
  "info":    { "title"?: string, "version"?: string, "description"?: string },
  "servers": [ { "url": "<non-empty>", "description"?: string }, ... ]
}
```

**Priority**: `artifact.openapi.info` > `options.info` > emitter defaults
(`{title:'API', version:'0.0.0'}`), by `??` rule (`src/openapi/emit.ts:34`).
Same for `servers`: any *defined* array in the artifact, even empty,
fully overrides `options.servers` (`src/openapi/emit.ts:49`).

### 3.4. `bindings`

Object (Record). Key is the binding ID and is used as the default `operationId`.
Duplicate IDs are impossible because this is a JSON object.

## 4. `HttpBinding` - HTTP Route

```jsonc
{
  "method":      "GET" | "POST",                   // OTHER METHODS ARE NOT SUPPORTED
  "path":        "/v1/...",                        // must start with "/", no "?" or "#"
  "parameters":  [ <HttpParameter>, ... ],         // array, may be empty
  "summary"?:    string,
  "description"?: string,
  "tags"?:       string[] (each non-empty),
  "operationId"?: string (non-empty),              // default: binding key
  "openapi"?:    Record<string, unknown>           // passthrough, see section 6
}
```

Rules:

- `method` is **only** `GET` or `POST`. `PUT`/`PATCH`/`DELETE` are rejected by
  the Zod schema (`src/parse/schema.ts:24`).
- `path` matches `/^\/[^?#]*$/`: starts with `/`, contains no `?` or `#`.
  Query string belongs in `parameters[].in:"query"`, never in the path.
- Path placeholders use `{name}` (curly braces), with no types. Every `{name}`
  **must** have a matching `in:"path"` parameter, and vice versa; extra path parameters
  are forbidden too (`BINDINGS_PATH_PLACEHOLDER_MISMATCH`,
  `src/validate/structural.ts:72`).
- `method + path` is unique within the artifact
  (`BINDINGS_DUPLICATE_METHOD_PATH`, `src/validate/structural.ts:95`).
  Different methods on one path are allowed (`GET /x` and `POST /x` are OK).

## 5. `HttpParameter` - One Parameter

```jsonc
{
  "name":        "<external-name>",                // non-empty external HTTP name
  "in":          "query" | "path" | "body",        // location
  "bindTo":      "<inputName>",                    // input name in signature
  "required":    true | false,                     // required flag
  "description"?: string,
  "openapi"?:    Record<string, unknown>           // passthrough for ParameterObject
}
```

### 5.1. `mode x required` Matrix (Consistency Layer)

Table `REQUIRED_BY_MODE` (`src/validate/consistency.ts:10`) is normative:

| `GraphInput.mode` | allowed `parameter.required` | note |
| --- | --- | --- |
| `required` | **only** `true` | required |
| `defaulted` | **only** `false` | graph default enters JSON Schema as `default` |
| `predicate_optional` | **only** `false` | optional-field filter |
| `nullable` | `true` **or** `false` | LLM chooses based on endpoint meaning |
| `root` | - (graph cannot be bound) | `BINDINGS_GRAPH_HAS_ROOT_INPUT` |

Mismatch gives `BINDINGS_REQUIRED_MISMATCH` (`src/validate/consistency.ts:79`).

### 5.2. `type.kind x in` Matrix (Consistency Layer)

Table `checkTypeLocation` (`src/validate/consistency.ts:51`):

| `input.type.kind` | `query` | `path` | `body` | note |
| --- | :---: | :---: | :---: | --- |
| `scalar` | yes | yes | yes | valid everywhere |
| `list` | yes | no | yes | in query -> `style:'form', explode:true` (`src/openapi/parameters.ts:40`) |
| `row` / `rowset` | no | no | no | unavailable in Tier 1 (`BINDINGS_GRAPH_HAS_ROOT_INPUT` fires first) |

Violation gives `BINDINGS_TYPE_LOCATION_INVALID`.

### 5.3. Hard Structural Constraints

- `in:"path"` always implies `required: true` (`BINDINGS_PATH_NOT_REQUIRED`,
  `src/validate/structural.ts:51`).
- `method:"GET"` plus any `in:"body"` gives `BINDINGS_BODY_ON_GET`
  (`src/validate/structural.ts:60`). Use `POST` for body.
- `(in, name)` must be unique inside one binding -> `BINDINGS_DUPLICATE_PARAM_NAME`.
  Same `name` in different `in` locations is allowed (`?id=...` and `body.id` can coexist;
  `{id}` in path is `in:"path"`).
- `bindTo` must be unique inside one binding -> `BINDINGS_DUPLICATE_BIND_TO`.
  The same graph input cannot be taken from two HTTP request locations.

### 5.4. Unbound Inputs (Consistency Layer)

Every input with `mode: 'required'` or `mode: 'nullable'` **must** have
a binding parameter (`BINDINGS_UNBOUND_INPUT`, `src/validate/consistency.ts:113`).
Inputs with `defaulted` / `predicate_optional` **may be omitted** because they have
a value to substitute.

### 5.5. Nullable Subtlety

`mode: 'nullable'` **does NOT** turn a parameter/body-field schema into
`type: [T, 'null']`. Only the output shape schema does that
(`src/openapi/shapes.ts:30`). For clients this means: to leave a nullable parameter unset,
omit the field entirely (especially for `in:"body"` inside an object), rather than writing `null`.

## 6. Passthrough (`http.openapi` and `parameter.openapi`)

Both fields are free maps (Zod type `record(unknown)`) and merge into the final
OpenAPI document through deep merge (`src/openapi/passthrough.ts:5`):

- objects merge recursively;
- arrays and scalars replace completely;
- values from `openapi` win over generated ones (passthrough is applied **after** build).

Typical uses:

```jsonc
"http": {
  ...
  "openapi": {
    "x-rate-limit": 100,
    "deprecated": true,
    "externalDocs": { "url": "https://docs/..." }
  },
  "parameters": [
    { "name": "q", "in": "query", "bindTo": "q", "required": false,
      "openapi": { "example": "laptop", "x-internal-id": "q1" } }
  ]
}
```

Do **not** override compiler-derived fields through passthrough
(`operationId`, `responses`, `schema`). Deep merge technically permits it, but
it desynchronizes the document from the real contract.

## 7. Output Shape - What Emits in Response

The emitter does not offer a choice: response is always

```jsonc
"200": { "description": "OK",
  "content": { "application/json": {
    "schema": { "type": "array",
                "items": { "$ref": "#/components/schemas/<ShapeName>" } } } } }
```

where `<ShapeName>` = `signature.output.type.shape` for `rowset` (`rowset` is the
only supported output kind; see section 2).

`components.schemas.<ShapeName>` contains **all** shape fields, and **all** are
listed in `required`; a nullable field is still required, but its type is a union
with `null` (`src/openapi/shapes.ts:58`).

The emitter also always adds `ErrorResponse` and references it from
`400` / `422` / `500` responses (`src/openapi/errors.ts`). Disable through
`options.standardErrors = false` (`src/openapi/emit.ts:112`).

## 8. Structural and Semantic Rules (Summary)

Validator order:
`parse -> structural -> references -> consistency -> emit`

Layers are fail-fast (`src/validate/index.ts:8`). Within a layer, errors are
collected and returned together.

### 8.1. `parse`
- Zod + `.strict()`: extra/missing fields are immediate errors.
- Single code: `BINDINGS_PARSE_SCHEMA_VIOLATION`.

### 8.2. `structural` (No Resolvers Required)
- `DUPLICATE_METHOD_PATH` (global).
- `DUPLICATE_PARAM_NAME` (local, by `(in,name)`).
- `DUPLICATE_BIND_TO` (local).
- `PATH_PLACEHOLDER_MISMATCH` (symmetry between `{name}` and `in:"path"`).
- `BODY_ON_GET`.
- `PATH_NOT_REQUIRED`.

### 8.3. `references` (Resolvers Required)
- `UNRESOLVED_GRAPH` - `resolveGraphSignature` returned `null`.
- `UNKNOWN_BIND_TO` - `bindTo` is not in `signature.inputs`.
- `UNRESOLVED_OUTPUT_SHAPE` - `resolveShape` returned `null` for `rowset`/`row`.

### 8.4. `consistency`
- `GRAPH_HAS_ROOT_INPUT` - any `mode:'root'` makes the graph unbindable.
- `UNSUPPORTED_OUTPUT_TYPE` - output is not `rowset`.
- `REQUIRED_MISMATCH` - see section 5.1.
- `TYPE_LOCATION_INVALID` - see section 5.2.
- `UNBOUND_INPUT` - see section 5.4.

## 9. Minimal Working Skeleton

One GET endpoint, no parameters, graph returns `rowset<OrderItem>`:

```json
{
  "version": "1.0",
  "graphSpecRef": "commerce.graphs.v1",
  "pdmRef": "commerce.domain.v1",
  "qsmRef": "commerce.read.v1",
  "bindings": {
    "listItems": {
      "graph": "listAllItems",
      "target": { "engine": "sqlite", "dialect": "sqlite" },
      "http": { "method": "GET", "path": "/v1/items", "parameters": [] }
    }
  }
}
```

## 10. Error Codes (For Debugging LLM Generation)

| Layer | Code | What to fix |
| --- | --- | --- |
| `parse` | `BINDINGS_PARSE_SCHEMA_VIOLATION` | JSON does not match the Zod schema: extra fields (`.strict()`), wrong type, empty string where non-empty string is required |
| `structural` | `BINDINGS_DUPLICATE_METHOD_PATH` | Two bindings share the same `method + path`; keep one |
| `structural` | `BINDINGS_DUPLICATE_PARAM_NAME` | One binding contains two entries with the same `(in, name)` |
| `structural` | `BINDINGS_DUPLICATE_BIND_TO` | Two parameters take the same input; choose one HTTP location |
| `structural` | `BINDINGS_PATH_PLACEHOLDER_MISMATCH` | `{name}` path placeholders and `in:"path"` parameters do not match; add/remove one side |
| `structural` | `BINDINGS_BODY_ON_GET` | `in:"body"` in `GET`; switch method to `POST` or move to `query` |
| `structural` | `BINDINGS_PATH_NOT_REQUIRED` | `in:"path"` plus `required:false`; path parameters are **always** `required:true` |
| `references` | `BINDINGS_UNRESOLVED_GRAPH` | `graph` not found by resolver; check graph name |
| `references` | `BINDINGS_UNKNOWN_BIND_TO` | `bindTo` does not exist in `signature.inputs`; typo in input name |
| `references` | `BINDINGS_UNRESOLVED_OUTPUT_SHAPE` | Graph output shape not found; resolver does not know the name |
| `consistency` | `BINDINGS_GRAPH_HAS_ROOT_INPUT` | Graph has a `mode:'root'` input; it cannot be bound by an HTTP endpoint (Tier 2) |
| `consistency` | `BINDINGS_UNSUPPORTED_OUTPUT_TYPE` | Graph returns `row` / `scalar`; only `rowset` is supported |
| `consistency` | `BINDINGS_REQUIRED_MISMATCH` | Incompatible `mode <-> required`; see section 5.1 |
| `consistency` | `BINDINGS_TYPE_LOCATION_INVALID` | For example, `list` in `path`; see section 5.2 |
| `consistency` | `BINDINGS_UNBOUND_INPUT` | `required`/`nullable` input has no parameter; add a binding |

## 11. Checklist Before Emitting an Artifact

1. `version` is exactly `"1.0"` (not `"1.0.0"`, not `"v1.0"`).
2. All refs (`graphSpecRef`, `pdmRef`, `qsmRef`) are non-empty strings.
3. No extra fields at any level; Zod `.strict()` rejects them.
4. `method` is one of `{GET, POST}`. Need `PUT/PATCH/DELETE` -> **not supported**.
5. `path` starts with `/` and contains no `?` / `#`. Query string goes into parameters.
6. For each `{placeholder}` in path, exactly one `in:"path"` parameter has the same `name` and `required:true`; and vice versa.
7. `method + path` is unique across the whole artifact.
8. Within one binding: unique `(in, name)` and unique `bindTo`.
9. No `in:"body"` parameters on `GET`.
10. `parameter.required` matches input `mode` by section 5.1:
    - `required` -> `true`; `defaulted`/`predicate_optional` -> `false`; `nullable` -> either.
11. `parameter.in` matches `type.kind` by section 5.2:
    - `scalar` everywhere; `list` only in `query`/`body`; `row`/`rowset` forbidden.
12. Every input with `mode:'required'` or `mode:'nullable'` has a parameter that binds it.
13. Graph has no `mode:'root'` inputs. Output is `rowset<Shape>`. Usually the LLM receives this constraint already; if given an unbindable graph, refuse it and ask for a different graph.
14. `parameter.name` is the **external** HTTP name; `bindTo` is the internal graph input name. They **may** match but do not have to.
15. String literals are ordinary strings here (no `{$literal}` convention; that rule belongs to Graph IR, not bindings).
16. Custom `info`/`servers` go into `artifact.openapi.*`. `x-*` or `example` fields go into `http.openapi` / `parameter.openapi` (passthrough).
17. Do NOT add `responses`, `operationId` (if the binding ID is already good), `schema`, or `requestBody` through passthrough; the compiler generates them.
18. `parameter.description` and `http.summary`/`http.description`/`http.tags` are documentation-only and should be filled when endpoint meaning is clear.

## 12. Live Examples

Runnable examples plus final OpenAPI are in [`examples.md`](./examples.md).
Executable script: [`../demo-openapi.mjs`](/packages/artifacts/bindings/demo-openapi.mjs)
(`bun run build && bun demo-openapi.mjs`).
Canonical golden fixture: `test/golden/category-sales/artifact.json`
(input) and `test/golden/category-sales/expected.openapi.json` (expected output).
Full test suite: `test/unit/**/*.test.ts`.
