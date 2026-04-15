# @rntme/bindings

HTTP **bindings artifact** parser, four-layer validator, and OpenAPI 3.1 emitter for rntme graphs. Declaratively maps a set of query / command graphs to HTTP operations (method, path, parameters, responses).

## Role in the system

- Zero internal dependencies (pure data transformation on top of Zod).
- Input to [`@rntme/bindings-http`](../bindings-http): the Hono runtime consumes a `ValidatedBindings` together with the compiled graph spec.
- Drives the OpenAPI document that `bindings-http` optionally serves at `/openapi.json`.

## Install

```bash
pnpm add @rntme/bindings zod
```

## Quick start

```ts
import {
  parseBindingArtifact,
  validateBindings,
  generateOpenApi,
} from '@rntme/bindings';

const raw = {
  version: '1.0-rc7',
  graphSpecRef: 'issue.graphs.v1',
  pdmRef: 'issue.domain.v1',
  qsmRef: 'issue.read.v1',
  openapi: { info: { title: 'Issue Tracker', version: '1.0.0' } },
  bindings: {
    listIssues: {
      kind: 'query',
      graph: 'listIssues',
      http: {
        method: 'GET',
        path: '/v1/issues',
        parameters: [
          { name: 'status', in: 'query', bindTo: 'status', required: false },
          { name: 'limit',  in: 'query', bindTo: 'limit',  required: false },
        ],
      },
    },
    reportIssue: {
      kind: 'command',
      graph: 'reportIssue',
      http: {
        method: 'POST',
        path: '/v1/issues',
        parameters: [
          { name: 'issueId',  in: 'body', bindTo: 'issueId',  required: true },
          { name: 'title',    in: 'body', bindTo: 'title',    required: true },
          { name: 'priority', in: 'body', bindTo: 'priority', required: true },
        ],
      },
    },
  },
};

const parsed = parseBindingArtifact(raw);
if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));

const validated = validateBindings(parsed.value, resolvers); // see "Resolvers" below
if (!validated.ok) throw new Error(JSON.stringify(validated.errors));

const openapi = generateOpenApi(validated.value, resolvers);
if (!openapi.ok) throw new Error(JSON.stringify(openapi.errors));
// openapi.value is a ready-to-serve OpenApiDoc
```

## API

| Export | Signature | Purpose |
| ------ | --------- | ------- |
| `parseBindingArtifact` | `(raw: unknown) => Result<BindingArtifactParsed>` | Zod-driven structural parsing. |
| `BindingArtifactSchema` | `z.ZodSchema` | Raw schema for embedding / inspection. |
| `validateStructural` | `(parsed) => Result<StructurallyValid>` | Uniqueness, placeholder matching, method/body rules. |
| `validateReferences` | `(structural, resolvers) => Result<ResolvedBindings>` | Graph and shape lookups via the resolvers. |
| `validateConsistency` | `(resolved, resolvers) => Result<ValidatedBindings>` | Input/parameter consistency, output-shape typing, query/command method constraints. |
| `validateBindings` | `(parsed, resolvers) => Result<ValidatedBindings>` | Convenience wrapper for all three layers. |
| `generateOpenApi` | `(validated, resolvers, opts?) => Result<OpenApiDoc>` | Emits OpenAPI 3.1 using the command-result shape + per-graph input/output schemas. |
| `commandResultShape` / `commandResultJsonSchema` / `COMMAND_RESULT_SHAPE_NAME` | | Canonical `{ version }` response shape used by all command bindings. |
| `ok`, `err`, `isOk`, `isErr`, `ERROR_CODES` | | `Result<T>` helpers and error-code registry. |

## Exported types

```ts
import type {
  // artifact
  BindingArtifact,
  BindingEntry,
  BindingKind,              // 'query' | 'command'
  HttpBinding,
  HttpMethod,               // 'GET' | 'POST'
  HttpParameter,
  HttpParameterLocation,    // 'query' | 'path' | 'body'
  OpenApiDefaults,
  StructurallyValid,
  ResolvedBinding,
  ResolvedBindings,
  ValidatedBindings,        // branded
  OperationPassthrough,
  ParameterPassthrough,
  // resolvers
  BindingResolvers,
  GraphSignature,
  GraphRole,                // 'query' | 'command' | 'predicate' | 'mapper' | 'reducer'
  GraphInput,
  InputMode,                // 'root' | 'required' | 'nullable' | 'defaulted' | 'predicate_optional'
  InputType,
  OutputType,
  ResolvedShape,
  ShapeField,
  FieldType,
  ScalarPrimitive,
  ShapeOrigin,
  // OpenAPI
  OpenApiDoc,
  InfoObject,
  ServerObject,
  PathItem,
  OperationObject,
  ParameterObject,
  RequestBodyObject,
  ResponseObject,
  MediaType,
  JsonSchema,
  // result monad
  Result, BindingsError, BindingsErrorCode, Layer,
} from '@rntme/bindings';
```

### Resolvers

`validateBindings` and `generateOpenApi` take a `BindingResolvers` with two methods:

```ts
interface BindingResolvers {
  resolveGraphSignature(graphId: string): GraphSignature | undefined;
  resolveShape(shapeId: string): ResolvedShape | undefined;
}
```

In the demo, `src/artifacts.ts` builds the resolvers by pulling signatures from the compiled graph spec and shapes from the shared `shapes.json`.

## Four-layer validation

`validateBindings` runs three Zod + TS layers and carries structural passthrough through the stack; all layers aggregate independent errors before returning.

| Layer | What it checks |
| ----- | -------------- |
| `parse` | Zod shape; enums; required fields. |
| `structural` | Duplicate binding id / `(method, path)` / parameter name / `bindTo`; `{placeholder}`-to-path-param coverage; `GET` cannot carry `in: 'body'`; path parameters must be `required: true`. |
| `references` | `graph` resolves via `resolveGraphSignature`; output shape resolves via `resolveShape`; every `bindTo` matches an input on that graph's signature. |
| `consistency` | Parameter `required` matches graph-input mode; parameter `type` (when specified) matches input type and is legal for its location; root inputs forbidden on public bindings; output shape must be a supported response type; queries use `GET`, commands use `POST`; commands cannot declare query-string inputs; no unbound inputs when the graph expects them. |

### Error codes

`BINDINGS_PARSE_SCHEMA_VIOLATION`, `BINDINGS_DUPLICATE_BINDING_ID`, `BINDINGS_DUPLICATE_METHOD_PATH`, `BINDINGS_DUPLICATE_PARAM_NAME`, `BINDINGS_DUPLICATE_BIND_TO`, `BINDINGS_PATH_PLACEHOLDER_MISMATCH`, `BINDINGS_BODY_ON_GET`, `BINDINGS_PATH_NOT_REQUIRED`, `BINDINGS_UNRESOLVED_GRAPH`, `BINDINGS_UNKNOWN_BIND_TO`, `BINDINGS_UNRESOLVED_OUTPUT_SHAPE`, `BINDINGS_GRAPH_HAS_ROOT_INPUT`, `BINDINGS_UNSUPPORTED_OUTPUT_TYPE`, `BINDINGS_REQUIRED_MISMATCH`, `BINDINGS_TYPE_LOCATION_INVALID`, `BINDINGS_UNBOUND_INPUT`, `BINDINGS_COMMAND_ON_NON_COMMAND_GRAPH`, `BINDINGS_QUERY_ON_COMMAND_GRAPH`, `BINDINGS_COMMAND_METHOD_NOT_POST`, `BINDINGS_COMMAND_QUERY_PARAM_FORBIDDEN`, `BINDINGS_INTERNAL`.

Every `BindingsError` carries `layer`, `code`, `message`, optional `path`, optional `hint`.

## Scope

- No runtime HTTP adapter — see [`@rntme/bindings-http`](../bindings-http).
- No auth / pagination envelope / streaming / multi-tenant routing.
- OpenAPI emission covers JSON only; no file uploads, no form-encoded parameters.

## Spec

See [`docs/superpowers/specs/2026-04-14-bindings-design.md`](../../docs/superpowers/specs/2026-04-14-bindings-design.md) for the authoritative spec.
