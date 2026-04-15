# @rntme/bindings-http

Hono sub-router that turns a `ValidatedBindings` artifact plus a compiled graph spec into a ready-to-mount HTTP surface. Queries delegate to [`@rntme/graph-ir-compiler`](../graph-ir-compiler) compiled SQL; commands delegate to the same compiler's command runtime, appending via [`@rntme/event-store`](../event-store).

## Role in the system

- Depends on [`@rntme/bindings`](../bindings) (input artifact), [`@rntme/graph-ir-compiler`](../graph-ir-compiler) (query + command compilation), and [`@rntme/event-store`](../event-store) (command appends).
- Produces a `Hono` instance; `app.route('/', router)` in any Hono host composes it with the rest of your app.

## Install

```bash
pnpm add @rntme/bindings-http @rntme/bindings @rntme/graph-ir-compiler @rntme/event-store hono better-sqlite3
```

## Quick start

```ts
import { Hono } from 'hono';
import type { Context } from 'hono';
import Database from 'better-sqlite3';
import { parseBindingArtifact, validateBindings, generateOpenApi } from '@rntme/bindings';
import { createBindingsRouter } from '@rntme/bindings-http';
import { SqliteEventStore, type ActorRef } from '@rntme/event-store';

const parsed    = parseBindingArtifact(bindingsArtifact);
const validated = validateBindings(parsed.value!, resolvers);
const openApi   = generateOpenApi(validated.value!, resolvers);

const router = createBindingsRouter({
  validated: validated.value!,
  graphSpec,             // raw Graph IR JSON — compiled per-binding at startup
  pdm,                   // raw PDM JSON
  qsm,                   // raw QSM JSON
  db: readSideDb,        // better-sqlite3 Database for query execution
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

## API

| Export | Signature | Purpose |
| ------ | --------- | ------- |
| `createBindingsRouter(opts)` | `(BindingsRouterOptions) => Hono` | Factory — compiles per-binding plans, registers routes, serves `GET /openapi.json` if `openApiDoc` is provided. |
| `commandErrorStatus(err)` | `(CommandExecutionError) => 409 \| 422` | Maps concurrency conflicts to `409`, guard rejections (illegal transition / rejected guard) to `422`. |
| `commandErrorBody(err)` | `(CommandExecutionError) => ErrorResponseBody` | Builds the `{ code, message, details? }` body from a command error. |
| `BindingsRuntimeError` | `class extends Error` | Thrown by `createBindingsRouter` if one or more bindings fail startup compilation; carries `errors: RuntimeErrorEntry[]`. |

### `BindingsRouterOptions`

```ts
type BindingsRouterOptions = {
  validated: ValidatedBindings;
  graphSpec: unknown;                        // raw; compiled internally per binding
  pdm: unknown;
  qsm: unknown;
  db: BetterSqlite3.Database;                // QSM / read-side DB
  openApiDoc?: OpenApiDoc;                   // served at GET /openapi.json when provided
  onError?: (err: unknown, ctx: Context) => void;
  eventStore?: EventStore;                   // required when any binding.kind === 'command'
  actorFromRequest?: (c: Context) => ActorRef | null;  // default () => null
  now?: () => string;                        // default () => new Date().toISOString()
  nextId?: () => string;                     // default crypto.randomUUID
};
```

`createBindingsRouter` throws synchronously if `eventStore` is missing while any binding is a command.

## Exported types

```ts
import type {
  BindingsRouterOptions,
  RuntimeErrorEntry,    // { bindingId?: string; graphId: string; cause: unknown }
  ErrorResponseBody,    // { code: string; message: string; details?: unknown }
  ValidationDetail,     // { path: string; message: string; code: string }
  CommandErrorStatus,   // 409 | 422
} from '@rntme/bindings-http';
```

## Request pipeline

**Startup.** `createBindingsRouter` iterates every binding in `validated.bindings`:

1. Picks `query` vs. `command` from `ResolvedBinding.kind`.
2. For queries: `compile(graphSpec, pdm, qsm)` — produces `CompileResult` with `sql`, `paramOrder`, `optionalParams`, `paramDefaults`.
3. For commands: `compileCommand(graphSpec, pdm, qsm)` — produces `CompiledCommand` with emit plans + an optional read-prelude for capacity-guard-style graphs.
4. Builds a per-binding Zod schema from its parameters; registers a Hono handler on the converted path (`{:placeholder}` → `:placeholder`).

Any compile failure collects into `BindingsRuntimeError.errors` and is thrown at the end of startup.

**Per request.**

1. Extract parameters from query string / path / body into a flat record, using `bindTo` to map HTTP names to graph input names.
2. Zod-coerce + validate. Failure → `400 VALIDATION_ERROR` with `details: ValidationDetail[]`.
3. For queries: `execute(compiled, params, db)` and return the rows as JSON.
4. For commands: `executeCommand(compiled, params, ctx)` with `ctx = { eventStore, qsmDb: db, now, nextId, actor: actorFromRequest(c) }`. Success → `200 { version }` (envelope shape `COMMAND_RESULT_SHAPE_NAME`).
5. On unexpected error: `onError(err, c)` if provided, otherwise `500 INTERNAL_ERROR`.

## Error model

All responses use `{ code, message, details? }`.

| Status | Code | Cause |
| ------ | ---- | ----- |
| `400` | `VALIDATION_ERROR` | Zod validation; `details` = `ValidationDetail[]`. |
| `400` | `INVALID_BODY` | Body could not be JSON-parsed. |
| `409` | `COMMAND_CONCURRENCY_CONFLICT` | `CommandExecutionError` from a stream-version mismatch. |
| `422` | `COMMAND_ILLEGAL_TRANSITION` / `COMMAND_GUARD_REJECTED` | State-machine rejected the mutation. |
| `500` | `INTERNAL_ERROR` | Fallback envelope. |

Query failures from the compiler (semantic, runtime) surface as 500s unless an `onError` hook maps them.

## Scope

- No auth, no pagination envelope, no streaming, no multi-tenant routing.
- No non-SQLite executor — queries go through `@rntme/graph-ir-compiler`'s SQLite execute.
- No ETag / conditional requests.

## Spec

See [`docs/superpowers/specs/2026-04-14-bindings-http-design.md`](../../docs/superpowers/specs/2026-04-14-bindings-http-design.md) for the authoritative spec.
