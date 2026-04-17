# @rntme/bindings

HTTP bindings artifact: parser, four-layer validator, and OpenAPI 3.1 emitter for rntme query and command graphs.

## Role in the system

- Depends on: `zod` (Zod schema for the artifact); no `@rntme/*` package.
- Consumed by: `@rntme/bindings-http` (Hono runtime serves the artifact + compiled graph spec); `demo/issue-tracker-api` (wires artifacts in `src/server.ts`).
- Position in pipeline: artifact authoring → parse → structural → references → consistency → `ValidatedBindings` → `generateOpenApi`.

## File map

```
src/
  index.ts                    (entry) Public barrel — exports parse, validate, generate, types, Result, CommandResult built-ins.
  parse/
    parse.ts                  (entry) parseBindingArtifact: accepts unknown or JSON string, runs Zod, lifts issues into Result errors.
    schema.ts                 BindingArtifactSchema (Zod) — strict, version literal "1.0", method/in enums, path regex.
  validate/
    index.ts                  (entry) validateBindings orchestrator — fail-fast across the three post-parse layers.
    structural.ts             validateStructural — uniqueness, path-placeholder symmetry, GET/body, command method/query rules.
    references.ts             validateReferences — resolveGraphSignature + resolveShape; CommandResult shape short-circuit.
    consistency.ts            validateConsistency — kind × role, root-input ban, output-shape contract, mode↔required, type↔location, unbound inputs.
  openapi/
    emit.ts                   (entry) generateOpenApi — composes paths, components, info, servers; applies passthrough.
    shapes.ts                 primitiveToJsonSchema, fieldToJsonSchema, shapeToJsonSchema; nullability via 3.1 union types.
    parameters.ts             inputToParameter, collectRequestBody; list<T> → style=form, explode=true.
    responses.ts              successResponse — row → ref, rowset → array of ref.
    errors.ts                 ErrorResponse schema, 400/422/500, 409 Conflict for commands.
    command-result.ts         COMMAND_RESULT_SHAPE_NAME, commandResultShape, commandResultJsonSchema (built-in row shape).
    passthrough.ts            deepMerge — objects merged, arrays/scalars replaced.
  types/
    index.ts                  Re-exports of every type module below.
    artifact.ts               BindingArtifact, HttpBinding, HttpParameter, BindingKind; branded StructurallyValid / ResolvedBindings / ValidatedBindings.
    resolvers.ts              BindingResolvers, GraphSignature, GraphRole, GraphInput, InputMode, InputType, OutputType, ResolvedShape, ShapeField, FieldType.
    openapi.ts                Structural OpenAPI 3.1 types — OpenApiDoc, PathItem, OperationObject, ParameterObject, RequestBodyObject, ResponseObject, JsonSchema, MediaType.
    result.ts                 Result<T>, ok/err/isOk/isErr, BindingsError, Layer, ERROR_CODES (frozen registry).
```

## Quick start

```ts
import {
  parseBindingArtifact,
  validateBindings,
  generateOpenApi,
  type BindingResolvers,
} from '@rntme/bindings';

const raw = {
  version: '1.0',
  graphSpecRef: 'issues.graphs.v1',
  pdmRef: 'issues.domain.v1',
  qsmRef: 'issues.read.v1',
  openapi: { info: { title: 'Issues API', version: '1.0.0' } },
  bindings: {
    listIssues: {
      kind: 'query',
      graph: 'listIssues',
      target: { engine: 'sqlite', dialect: 'sqlite' },
      http: {
        method: 'GET',
        path: '/v1/issues',
        parameters: [
          { name: 'status', in: 'query', bindTo: 'status', required: false },
          { name: 'limit',  in: 'query', bindTo: 'limit',  required: false },
        ],
      },
    },
  },
};

const resolvers: BindingResolvers = {
  resolveGraphSignature: (id) => (id === 'listIssues'
    ? {
        id,
        role: 'query',
        inputs: {
          status: { type: { kind: 'scalar', primitive: 'string'  }, mode: 'predicate_optional' },
          limit:  { type: { kind: 'scalar', primitive: 'integer' }, mode: 'defaulted', default: 50 },
        },
        output: { type: { kind: 'rowset', shape: 'IssueRow' }, from: 'project' },
      }
    : null),
  resolveShape: (name) => (name === 'IssueRow'
    ? {
        name,
        origin: 'qsm',
        fields: {
          issueId: { type: { kind: 'scalar', primitive: 'integer' }, nullable: false },
          title:   { type: { kind: 'scalar', primitive: 'string'  }, nullable: false },
          status:  { type: { kind: 'scalar', primitive: 'string'  }, nullable: false },
        },
      }
    : null),
};

const parsed = parseBindingArtifact(raw);
if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));

const validated = validateBindings(parsed.value, resolvers);
if (!validated.ok) throw new Error(JSON.stringify(validated.errors));

const openapi = generateOpenApi(validated.value, resolvers);
if (!openapi.ok) throw new Error(JSON.stringify(openapi.errors));
// openapi.value satisfies OpenApiDoc (3.1.0)
```

## API

| Export | Signature | Purpose |
| ------ | --------- | ------- |
| `parseBindingArtifact` | `(input: unknown) => Result<BindingArtifact>` | Accepts a JSON string or a parsed value; runs `BindingArtifactSchema`. |
| `BindingArtifactSchema` | `z.ZodObject<...>` | Raw Zod schema for embedding in larger pipelines. |
| `validateStructural` | `(artifact) => Result<StructurallyValid>` | Uniqueness, placeholder symmetry, method/body, command structural rules. |
| `validateReferences` | `(structural, resolvers) => Result<ResolvedBindings>` | Resolves graph signature and output shape; checks every `bindTo`. |
| `validateConsistency` | `(resolved) => Result<ValidatedBindings>` | kind × role, root-input ban, output contract, mode/required, type/location, unbound inputs. |
| `validateBindings` | `(artifact, resolvers) => Result<ValidatedBindings>` | Fail-fast wrapper for the three post-parse layers. |
| `generateOpenApi` | `(validated, resolvers, options?) => Result<OpenApiDoc>` | Emits OpenAPI 3.1 from a `ValidatedBindings`. |
| `commandResultShape` / `commandResultJsonSchema` / `COMMAND_RESULT_SHAPE_NAME` | `() => ResolvedShape` / `() => JsonSchema` / `'CommandResult'` | Built-in row shape every command graph must output. |
| `ok`, `err`, `isOk`, `isErr` | Result helpers | `{ ok: true; value } \| { ok: false; errors }`. |
| `ERROR_CODES` | `Record<BindingsErrorCode, BindingsErrorCode>` | Frozen code registry (string ↦ string). |

### Resolvers

```ts
interface BindingResolvers {
  resolveGraphSignature(graphId: string): GraphSignature | null;
  resolveShape(shapeName: string): ResolvedShape | null;
}
```

Both methods return `null` on miss (never throw, never `undefined`). `GraphSignature.role` is optional — absence means `'query'`. Type expressions are pre-normalised by the resolver: this package does not parse `"list<integer>"` strings.

### Error codes

`BINDINGS_PARSE_SCHEMA_VIOLATION`, `BINDINGS_DUPLICATE_BINDING_ID`, `BINDINGS_DUPLICATE_METHOD_PATH`, `BINDINGS_DUPLICATE_PARAM_NAME`, `BINDINGS_DUPLICATE_BIND_TO`, `BINDINGS_PATH_PLACEHOLDER_MISMATCH`, `BINDINGS_BODY_ON_GET`, `BINDINGS_PATH_NOT_REQUIRED`, `BINDINGS_COMMAND_METHOD_NOT_POST`, `BINDINGS_COMMAND_QUERY_PARAM_FORBIDDEN`, `BINDINGS_UNRESOLVED_GRAPH`, `BINDINGS_UNKNOWN_BIND_TO`, `BINDINGS_UNRESOLVED_OUTPUT_SHAPE`, `BINDINGS_GRAPH_HAS_ROOT_INPUT`, `BINDINGS_UNSUPPORTED_OUTPUT_TYPE`, `BINDINGS_REQUIRED_MISMATCH`, `BINDINGS_TYPE_LOCATION_INVALID`, `BINDINGS_UNBOUND_INPUT`, `BINDINGS_COMMAND_ON_NON_COMMAND_GRAPH`, `BINDINGS_QUERY_ON_COMMAND_GRAPH`, `BINDINGS_INTERNAL`.

Every `BindingsError` carries `layer`, `code`, `message`, optional `path` (JSON path into the artifact), optional `hint`. Code strings are part of the public API — append, never reorder, never delete.

## Invariants & gotchas

- Layers are fail-fast across the boundary, aggregating inside. `validateBindings` returns the first failing layer's `errors[]`; the next layer does not run. Within one layer, every detected error is collected before returning. See `src/validate/index.ts` and the aggregation test in `test/unit/validate/structural.test.ts` ("aggregates multiple errors in one err()").
- `requestBody.required = true` whenever any `in: 'body'` parameter exists, irrespective of per-field `required`. The wrapper-required flag and field-required flag are independent in OpenAPI 3.1; mirroring `bodyParams.some(p => p.required)` is the bug fixed in commit `98ffbdb` (spec §7.8). See `collectRequestBody` in `src/openapi/parameters.ts`.
- Command graphs must output `row<CommandResult>`. `CommandResult` is a built-in shape with fields `aggregateId: string`, `version: integer`, `eventIds: array<string>`. The reference layer short-circuits its lookup (no resolver call); the consistency layer rejects any other output kind/shape with `BINDINGS_UNSUPPORTED_OUTPUT_TYPE`. See `src/openapi/command-result.ts` and `checkGraphShape` in `src/validate/consistency.ts`.
- Command bindings are POST-only and forbid `in: 'query'` parameters. Both rules live in the structural layer, codes `BINDINGS_COMMAND_METHOD_NOT_POST` and `BINDINGS_COMMAND_QUERY_PARAM_FORBIDDEN`. Path + body are the only legal locations for a command.
- `kind × role` must agree. `kind: 'command'` requires `role: 'command'`; `kind: 'query'` (the default) requires `role !== 'command'`. The defaults align so that a graph with no declared role is treated as a query. Codes: `BINDINGS_COMMAND_ON_NON_COMMAND_GRAPH`, `BINDINGS_QUERY_ON_COMMAND_GRAPH`.
- `in: 'path'` parameters are always `required: true` (structural layer). The placeholder set in `path` and the set of `in: 'path'` parameter names must match exactly — extra placeholders or extra path params both produce `BINDINGS_PATH_PLACEHOLDER_MISMATCH`.
- Root inputs cannot be bound. Any graph with a `mode: 'root'` input fails with `BINDINGS_GRAPH_HAS_ROOT_INPUT` and skips parameter checks. Predicate / mapper / reducer graphs (which carry root inputs) are not bindable.
- `mode → required` allowed values: `required → [true]`, `defaulted → [false]`, `predicate_optional → [false]`, `nullable → [true, false]`, `root → []`. Mismatch is `BINDINGS_REQUIRED_MISMATCH` (`REQUIRED_BY_MODE` table in `src/validate/consistency.ts`).
- Type/location matrix: `scalar` is legal in `query`, `path`, `body`; `list<T>` is legal in `query` and `body`, forbidden in `path`; `row` and `rowset` are forbidden in every location (root would have already been caught). See `checkTypeLocation` in `src/validate/consistency.ts`.
- Unbound inputs of mode `required` or `nullable` are errors (`BINDINGS_UNBOUND_INPUT`). `defaulted` and `predicate_optional` may be left unbound — the runtime supplies the default or skips the predicate.
- Branded stages enforce ordering at the type level. `StructurallyValid`, `ResolvedBindings`, `ValidatedBindings` are constructed only by the matching validators. `generateOpenApi` accepts `ValidatedBindings` only — casting around the brand bypasses all consistency checks.
- Passthrough deep-merge replaces arrays in full. `binding.http.openapi` and `parameter.openapi` are merged into the emitted operation/parameter objects; nested objects merge key-wise but `tags`, `parameters`, `required`, etc. are overwritten as a whole. See `deepMerge` and `test/unit/openapi/passthrough.test.ts`.
- The Zod schema is `.strict()` end-to-end. Unknown keys at any level (artifact, binding entry, http, parameter, openapi defaults) fail with `BINDINGS_PARSE_SCHEMA_VIOLATION`; there is no `additionalProperties: true` escape hatch in the artifact format.
- `kind` defaults to `'query'` at the parse layer (Zod `.default('query')`). A binding entry with no `kind` field is treated as a query throughout.
- Decimal encoding defaults to `string` with `format: 'decimal'`. Pass `generateOpenApi(..., { decimalEncoding: 'number' })` to switch to `{ type: 'number' }` in both shape and parameter schemas. Precision-sensitive consumers should keep the default.

## Out of scope / known limits

- No HTTP runtime. Routing, request decoding, response serialisation belong to `@rntme/bindings-http`.
- No graph compilation or SQL emission. The package treats `target` as opaque; `engine`/`dialect` are stored but never inspected.
- No type-expression parsing. Resolvers must hand back already-normalised `InputType` / `OutputType` / `FieldType`. `"list<integer>"` strings are out of contract.
- No `from-graph-spec` adapter. Building a `BindingResolvers` from a parsed graph spec + PDM + QSM lives elsewhere (see `demo/issue-tracker-api/src/server.ts` for a worked wiring).
- HTTP method set is `GET` and `POST` only. `PUT` / `PATCH` / `DELETE` follow rc7 §24 and are not in the artifact schema.
- Single content-type: `application/json`. No multipart, no form-encoded, no file uploads.
- No headers, cookies, security schemes, pagination envelope, or auth metadata. Add via `binding.http.openapi` passthrough if needed at the OpenAPI layer; runtime implementation is `bindings-http`'s concern.
- No serialisation. `generateOpenApi` returns an in-memory `OpenApiDoc`; the caller stringifies to JSON or YAML.
- No client SDK generation. Standard OpenAPI codegen tooling consumes the emitted document.

## Where to look first

- "Add a new error code" → append a key to `ERROR_CODES` in `src/types/result.ts`, then emit it from the relevant layer (`structural.ts`, `references.ts`, or `consistency.ts`). Codes are stable; never reorder existing entries. Add the code to the README error-code list and a unit test under `test/unit/validate/`.
- "Add a new structural rule" → extend `checkBinding` in `src/validate/structural.ts` (per-binding checks) or `validateStructural` (cross-binding checks); copy the pattern of `BINDINGS_PATH_PLACEHOLDER_MISMATCH`. Add a positive + negative test in `test/unit/validate/structural.test.ts`.
- "Add a new consistency rule" → extend `checkGraphShape`, `checkParameters`, or `checkUnbound` in `src/validate/consistency.ts`. Update `REQUIRED_BY_MODE` if the mode/required matrix changes. Add a test in `test/unit/validate/consistency.test.ts`.
- "Change OpenAPI emission" → JSON Schema mapping is in `src/openapi/shapes.ts`; parameter / requestBody assembly in `parameters.ts`; success responses in `responses.ts`; standard error responses (incl. 409 for commands) in `errors.ts`; `x-` passthrough merge in `passthrough.ts`. The orchestrator is `generateOpenApi` in `emit.ts`.
- "Add a new HTTP binding kind" → extend `BindingKind` in `src/types/artifact.ts`, the `kind` enum in `src/parse/schema.ts`, the role-crossover checks in `checkGraphShape` (`src/validate/consistency.ts`), and the response set in `buildOperation` (`src/openapi/emit.ts`). Mirror the `'command'` precedent.
- "Debug a failing test" → unit tests live under `test/unit/{parse,validate,openapi,types}/`; end-to-end goldens under `test/golden/{assign-issue,category-sales}/` (artifact + fixtures + `expected.openapi.json` snapshot updated by `vitest -u`).
- "Add a new built-in shape (analogous to CommandResult)" → mirror `src/openapi/command-result.ts`: define a constant name, a `ResolvedShape` factory, a `JsonSchema` factory; short-circuit it in `validateReferences`; emit it from `generateOpenApi` instead of calling `shapeToJsonSchema`.
- "Trace a request through validation" → start at `validateBindings` in `src/validate/index.ts`, then follow the three callees in order: `structural.ts` → `references.ts` → `consistency.ts`. Each layer's helper functions read top-to-bottom in execution order.

## Specs

- [`../../docs/superpowers/specs/done/2026-04-14-bindings-design.md`](../../docs/superpowers/specs/done/2026-04-14-bindings-design.md) — authoritative spec (artifact format §4, validation layers §6, OpenAPI mapping §7, package layout §8).
- [`../../graph_ir_rc_7.md`](../../graph_ir_rc_7.md) — Graph IR rc7: §6.3 root inputs, §6.5 graph roles, §21 binding artifact concept.
