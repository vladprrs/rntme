# @rntme/bindings-http

Hono sub-router that turns a `ValidatedBindings` artifact plus a Graph IR spec into a mountable HTTP surface for queries and commands.

## Role in the system

- Depends on: `@rntme/bindings` (input artifact, OpenAPI doc, `pre[]`, callback response shapes), `@rntme/graph-ir-compiler` (per-binding `compile` / `compileCommand` and `CommandExecutor` / `QueryExecutor` backing), `@rntme/event-store` (command appends and actor type), gRPC module clients, `hono` (routing), `zod` (per-binding schemas), `better-sqlite3` (read-side execution and idempotency cache).
- Consumed by: `demo/issue-tracker-api` and any host that mounts the returned `Hono` instance via `app.route('/', router)`.
- Position in pipeline: `validateBindings` (in `@rntme/bindings`) → `createBindingsRouter` (this package) → request handler → `execute` / `executeCommand` (in `@rntme/graph-ir-compiler`) → JSON response. Startup compiles every bound graph once and throws `BindingsRuntimeError` on the first failure aggregate; per-request work is parameter extraction, Zod parsing, name remapping, and execution.

## File map

```
src/
  index.ts                         (entry) Public barrel — re-exports createBindingsRouter, BindingsRuntimeError, command error helpers, and public types.
  router.ts                        (entry) createBindingsRouter — orchestrator that calls buildPlan, mounts handlers, and serves /openapi.json.
  errors.ts                        (entry) BindingsRuntimeError + body builders (validationErrorBody, invalidBodyErrorBody, internalErrorBody, commandErrorBody) and commandErrorStatus mapper.
  startup/
    compile-plan.ts                (internal) buildPlan — collects unique graph ids per kind, calls compile / compileCommand once each, builds BindingPlan = QueryBindingPlan | CommandBindingPlan.
    hono-path.ts                   (internal) honoPath — rewrites OpenAPI {name} placeholders to Hono :name placeholders.
    zod-schema.ts                  (internal) buildSchemas — composes one strict Zod object per location (query, path, body) from HttpParameter[] + GraphSignature.
    primitive-schema.ts            (internal) primitiveSchema — maps PDM scalar primitives and list<T> to Zod schemas with coercion / preprocessing.
  runtime/
    handler.ts                     (internal) makeHandler — query handler closure: extract → parse → remap → execute → respond.
    command-handler.ts             (internal) makeCommandHandler — command handler closure: extract → parse → remap → executeCommand → 200 / 409 / 422.
    extract.ts                     (internal) extractQuery (list vs last-wins for declared keys, pass-through for undeclared) + extractPath.
    remap.ts                       (internal) buildBindToMap + remapToGraphInputs — translate HTTP parameter names to graph input names.
```

## Quick start

```ts
import { Hono } from 'hono';
import type { Context } from 'hono';
import Database from 'better-sqlite3';
import { parseBindingArtifact, validateBindings, generateOpenApi } from '@rntme/bindings';
import { createBindingsRouter, BindingsRuntimeError } from '@rntme/bindings-http';
import { SqliteEventStore, type ActorRef } from '@rntme/event-store';

const parsed = parseBindingArtifact(bindingsArtifact);
const validated = validateBindings(parsed.value!, resolvers);
const openApi = generateOpenApi(validated.value!, resolvers);

const router = createBindingsRouter({
  validated: validated.value!,
  graphSpec,                       // raw Graph IR JSON; one compile per unique graph id
  pdm,                             // raw PDM JSON
  qsm,                             // raw QSM JSON
  db: new Database('./read.db'),   // better-sqlite3 — query side
  eventStore: new SqliteEventStore({ filename: './events.db' }),
  openApiDoc: openApi.value,
  actorFromRequest: (c: Context): ActorRef | null => {
    const id = c.req.header('x-actor-id');
    return id ? { kind: 'user', id } : null;
  },
});

const app = new Hono();
app.route('/', router);
export default app;
```

`createBindingsRouter` throws `BindingsRuntimeError` synchronously when one or more bindings fail to compile; `errors` carries one `RuntimeErrorEntry` per cause.

## API

| Export | Signature | Purpose |
| ------ | --------- | ------- |
| `createBindingsRouter` | `(opts: BindingsRouterOptions) => Hono` | Compile every bound graph, register one route per binding, optionally mount `GET /openapi.json`. |
| `BindingsRuntimeError` | `class extends Error { errors: readonly RuntimeErrorEntry[] }` | Aggregate startup failure thrown by `createBindingsRouter`. |
| `commandErrorStatus` | `(err: CommandExecutionError) => 409 \| 422` | `COMMAND_CONCURRENCY_CONFLICT → 409`; everything else → 422. |
| `commandErrorBody` | `(err: CommandExecutionError) => ErrorResponseBody` | `{ code, message, details? }`; `details` set only when `err.detail` is defined. |
| `BindingsRouterOptions` | type | `validated`, `graphSpec`, `pdm`, `qsm`, `db`, optional `openApiDoc`, `onError`, `eventStore`, `actorFromRequest`, `now`, `nextId`. |
| `RuntimeErrorEntry` | type | `{ bindingId?: string; graphId: string; cause: unknown }`. |
| `ErrorResponseBody` | type | `{ code: string; message: string; details?: unknown }`. |
| `ValidationDetail` | type | `{ path: string; message: string; code: string }`. |
| `CommandErrorStatus` | type | `409 \| 422`. |

### Query routing

For every binding with `kind: 'query'` (or absent — defaults to query), `buildPlan` calls `compile(slicedSpec, pdm, qsm)` and stores the `CompileResult`. The handler runs `extractPath` → `pathSchema.safeParse` → `extractQuery` → `querySchema.safeParse` → optional body parse → `remapToGraphInputs` → `execute(compiled, graphInputs, db)` → `c.json(rows, 200)`. Method is `GET` or `POST` per `entry.http.method`.

### Command routing

For every binding with `kind: 'command'`, `buildPlan` calls `compileCommand(slicedSpec, pdm, qsm)` and stores the `CompiledCommand`. The handler always uses `POST`, runs the same extract/parse/remap pipeline, then `executeCommand(compiled, graphInputs, { eventStore, qsmDb, now, nextId, actor })` and returns `c.json(result, 200)`. `actor` is computed per request from `actorFromRequest(c)`.

### Error mapping

| Status | Code | Cause |
| ------ | ---- | ----- |
| `400` | `VALIDATION_ERROR` | Zod `safeParse` failure on path / query / body. `details: ValidationDetail[]`. |
| `400` | `INVALID_BODY` | Body is not valid JSON, or is `null`, an array, or non-object. |
| `409` | `COMMAND_CONCURRENCY_CONFLICT` | `CommandExecutionError` from a stream-version conflict. |
| `422` | `COMMAND_ILLEGAL_TRANSITION` / `COMMAND_GUARD_REJECTED` | `CommandExecutionError` from a guard or transition rule. |
| `500` | `INTERNAL_ERROR` | Anything thrown by `execute` / `executeCommand` that is not a `CommandExecutionError`. `onError(err, c)` is invoked first when supplied; the response body never carries internals. |

`GET /openapi.json` is mounted only when `openApiDoc` is provided. There is no fallback document.

## Invariants & gotchas

- **`BindingPlan` is a discriminated union of `query | command`.** `compile-plan.ts` keeps two compile caches and produces `QueryBindingPlan` (`compiled: CompileResult`) or `CommandBindingPlan` (`compiled: CompiledCommand`). `kind` is read in `router.ts` to pick `makeHandler` vs `makeCommandHandler`. Source: commit `e55b25e refactor(bindings-http): BindingPlan becomes query|command discriminated union`.
- **Command error → HTTP status mapping is fixed: 409 only for `COMMAND_CONCURRENCY_CONFLICT`, 422 for everything else** (`COMMAND_ILLEGAL_TRANSITION`, `COMMAND_GUARD_REJECTED`). Source: commit `b43409c feat(bindings-http): map CommandExecutionError codes to 409/422 + ErrorResponseBody`; `test/unit/command-errors.test.ts`.
- **`eventStore` is required when any binding has `kind: 'command'`.** `createBindingsRouter` throws synchronously with the message `createBindingsRouter: eventStore is required when any binding has kind "command"` before any route is mounted. Source: `router.ts`; `test/unit/public-api.test.ts`.
- **Compile errors aggregate, then throw.** `buildPlan` runs every graph compile and collects every `cause` from `Result.errors` into one `BindingsRuntimeError`. Partial routers are never returned. Source: `startup/compile-plan.ts`; `test/unit/build-plan.test.ts`.
- **Single-graph compile workaround.** `compile` and `compileCommand` accept a spec containing exactly one graph; `sliceSpec(rawSpec, graphId)` shallow-clones the spec and keeps only the target graph. PDM and QSM are re-parsed per graph. Source: spec §6.1; `startup/compile-plan.ts`.
- **`bindToMap` is the only HTTP→graph name translator.** `remapToGraphInputs` only forwards keys that exist in the bag (`Object.prototype.hasOwnProperty.call`); missing keys stay missing so `paramDefaults` in the compiler can apply. Mutating the bag keys directly bypasses the map and breaks predicate-optional semantics. Source: `runtime/remap.ts`; spec §5.3.
- **List vs single query parameter shape comes from `signature.inputs[bindTo].type.kind === 'list'`.** `collectListParams` builds the set; `extractQuery` returns `[]` for an absent declared list and `vals[vals.length - 1]` (last-wins) for an absent-or-present single. Undeclared query keys are forwarded as last-wins single strings so `.strict()` rejects them with a Zod `unrecognized_keys` issue. Source: `startup/compile-plan.ts`, `runtime/extract.ts`; spec §5.5.
- **Query and path schemas are always built; body schema is omitted when no parameter has `in: 'body'`.** `bodySchema` is read with `!` in handlers, so the `bodyParamNames.length > 0` check is the only thing keeping that safe. Adding body parsing for a binding without body parameters means changing both `buildSchemas` and the handler guard. Source: `startup/zod-schema.ts`, `runtime/handler.ts`, `runtime/command-handler.ts`.
- **`nullable` only affects body schemas.** `isNullable` returns `true` only when `mode === 'nullable'` and `location === 'body'`. JSON `null` is unrepresentable in query / path strings, so the schema rejects it there. Source: `startup/zod-schema.ts`; spec §5.3.
- **Decimals stay strings end to end.** `primitiveSchema` validates `decimal` with the regex `^-?\d+(\.\d+)?$` and never calls `Number()`. PDM stores decimals as TEXT; converting to number loses precision. Source: `startup/primitive-schema.ts`; spec §5.3.
- **Booleans accept `true|false|1|0|boolean`.** Anything else falls through to `z.boolean()` and fails parsing. Source: `startup/primitive-schema.ts`.
- **Body must be a JSON object.** `null`, arrays, primitives, and JSON parse failures all return `400 INVALID_BODY`; only object bodies reach the body schema. Source: `runtime/handler.ts`, `runtime/command-handler.ts`.
- **OpenAPI path syntax `{id}` is rewritten to Hono `:id` by `honoPath`.** Mount paths read from `entry.http.path` must use the OpenAPI form. Source: `startup/hono-path.ts`; `test/unit/hono-path.test.ts`.
- **`onError` is observability only.** It runs before the `500 INTERNAL_ERROR` envelope is sent and never changes the response body or status. Throwing inside `onError` propagates out of the handler. Source: `runtime/handler.ts`, `runtime/command-handler.ts`; spec §3.
- **Defaults for `now`, `nextId`, `actorFromRequest`.** `now = () => new Date().toISOString()`, `nextId = () => randomUUID()` from `node:crypto`, `actorFromRequest = () => null`. Override `nextId` in tests for deterministic event ids. Source: `router.ts`; commit `54328af chore(bindings-http): use node:crypto for default nextId`.
- **Pre-fetch runs before command execution.** `runPreSteps` resolves `system` idempotency keys and `module-rpc` calls, then exposes results under `$pre.<bindAs>` for the command graph.
- **Idempotency cache is command-run scoped.** Persistent mode stores `(idempotency-key, command-run-id) → response` with a 24h TTL so HTTP retries can replay the same response without appending duplicate events.
- **Callback bindings return redirects.** GET command bindings with `response.onOk` / `response.onErr` redirect through `renderResponse`; vendor callbacks live on the domain service, not on the module.

## Out of scope / known limits

- No auth, CORS, rate-limiting, or tracing — those go in caller-side Hono middleware.
- No multi-tenant routing — `db` and `eventStore` are single instances per router.
- No pagination envelope, no `totalCount`, no `nextCursor`. Response is a raw JSON array for queries and a raw `executeCommand` result for commands.
- No streaming responses — `c.json` buffers the full rowset.
- No shape-aware response post-processing — rows are emitted as `execute` returns them.
- No non-SQLite executor — `db` is typed `BetterSqlite3.Database`.
- No hot reload — bindings are compiled once at startup.
- No client SDK generation — caller uses `@rntme/bindings`'s `generateOpenApi` and an external generator.
- No arbitrary pre-step plugins. The shipped pre-step kinds are `system` and `module-rpc`; adding another kind starts in `@rntme/bindings`.
- 422 is produced only by `CommandExecutionError`; query graphs never return 422.
- 404 and 405 are emitted by Hono for unmatched routes / methods; this package does not override them.

## Where to look first

- "Wire a new HTTP host" → start at `src/router.ts`, copy the Quick start block above; ensure `eventStore` is supplied if any binding has `kind: 'command'`.
- "Add a new HTTP error code or change a status" → edit `src/errors.ts` (body builder + status mapper if command-flavoured), then update the Error mapping table here. Tests live in `test/unit/errors.test.ts` and `test/unit/command-errors.test.ts`.
- "Change query / body / path parsing" → `src/runtime/extract.ts` for raw extraction policy, `src/startup/zod-schema.ts` + `src/startup/primitive-schema.ts` for schema construction. Tests: `test/unit/extract.test.ts`, `test/unit/zod-schema.test.ts`, `test/unit/primitive-schema.test.ts`.
- "Add a new primitive scalar" → `src/startup/primitive-schema.ts`; cross-check the `ScalarPrimitive` union owner in `@rntme/bindings`.
- "Change query vs command routing" → `src/router.ts` (the `bp.kind === 'command'` branch) and `src/startup/compile-plan.ts` (the `BindingPlan` union). End-to-end tests: `test/integration/router.test.ts` for queries, `test/integration/command-routing.test.ts` for commands.
- "Debug a startup failure" → reproduce by inspecting `BindingsRuntimeError.errors`; each entry pins `graphId` and the original `cause` from the compiler. Test: `test/unit/build-plan.test.ts`.
- "Customize per-request actor extraction" → pass `actorFromRequest` to `createBindingsRouter`; the default is `() => null`. Source: `src/router.ts`.
- "Verify the public API surface did not change" → `test/unit/public-api.test.ts` and `test/smoke.test.ts`.

## Specs

- [`../../docs/superpowers/specs/done/2026-04-14-bindings-http-design.md`](../../docs/superpowers/specs/done/2026-04-14-bindings-http-design.md) — authoritative design: §3 public API, §4 request lifecycle, §5 Zod rules, §6 startup pipeline, §7 error model, §11 explicit non-goals.
- [`../../docs/superpowers/specs/done/2026-04-14-bindings-design.md`](../../docs/superpowers/specs/done/2026-04-14-bindings-design.md) — `ValidatedBindings`, `HttpParameter`, `GraphSignature`, `OpenApiDoc` shapes consumed here.
- [`../../docs/superpowers/specs/2026-04-19-platform-modules-integration-design.md`](../../docs/superpowers/specs/2026-04-19-platform-modules-integration-design.md) — pre-fetch orchestration, callback bindings, idempotency cache, and executor seams.
