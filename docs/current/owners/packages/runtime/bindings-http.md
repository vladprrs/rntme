# @rntme/bindings-http

Hono sub-router that serves `ValidatedBindings` over HTTP. It compiles each bound Graph IR graph as a unified operation and routes every request through one `OperationExecutor`.

## Role In The System

- Depends on: `@rntme/bindings`, `@rntme/graph-ir-compiler`, `@rntme/event-store`, `@rntme/sqlite`, `hono`, `zod`.
- Consumed by: `@rntme/runtime` through `HttpSurface`; embedders can mount `createBindingsRouter(...)` directly.
- Pipeline: `ValidatedBindings` + graph/PDM/QSM runtime inputs -> `buildPlan` -> route handlers -> `OperationExecutor.execute(...)` -> JSON/redirect response.

## File Map

```
src/
  router.ts                    createBindingsRouter
  operation-contract.ts        OperationExecutor and OperationExecutionContext-facing types
  startup/
    compile-plan.ts            builds BindingPlan and default compiled operation map
    zod-schema.ts              parameter schemas from GraphSignature
    primitive-schema.ts        scalar/list coercion
    hono-path.ts               OpenAPI path -> Hono path
  runtime/
    operation-handler.ts       extract -> validate -> execute operation -> render response
    extract.ts                 query/path extraction
    extract-inputs.ts          inputFrom extraction
    remap.ts                   HTTP parameter name -> graph input name
    render-response.ts         callback/custom response rendering
  idempotency/                 persistent action response cache
```

## Quick Start

```ts
import { Hono } from 'hono';
import { openSqliteDatabase } from '@rntme/sqlite';
import { createBindingsRouter } from '@rntme/bindings-http';
import { SqliteEventStore } from '@rntme/event-store';

const app = new Hono();
app.route('/api', createBindingsRouter({
  validated,
  graphSpec,
  pdm,
  qsm,
  db: openSqliteDatabase({ filename: ':memory:' }),
  eventStore: new SqliteEventStore({ filename: ':memory:' }),
  operationExecutor,
  openApiDoc,
  actorFromRequest: (c) => {
    const id = c.req.header('x-actor-id');
    return id ? { kind: 'user', id } : null;
  },
}));
```

`createBindingsRouter` throws `BindingsRuntimeError` synchronously when graph compilation fails or a required runtime dependency is absent.

## Request Lifecycle

For every binding, the handler:

1. Extracts path and query parameters declared in `http.parameters[]`.
2. Parses JSON body when body parameters exist.
3. Extracts `inputFrom` values from headers/query/body/form and merges them with the normal parameter-derived graph inputs.
4. Executes `{ operationName, inputs, ctx }` through `OperationExecutor`.
5. Renders `response` when present, otherwise returns the operation result as JSON.

Default action JSON responses include the graph result object plus `eventIds`, `commandId`, and `correlationId`. Read responses return the graph result directly, usually a row or rowset.

## Runtime Dependencies

- `operationExecutor` is required whenever there is at least one binding.
- `eventStore` is required when any action operation can emit local events.
- `db` is the QSM/read-side `SqliteDatabase` handle from `@rntme/sqlite` and backs the idempotency cache.
- `actorFromRequest`, `now`, and `nextId` have safe defaults and are injectable for tests.

The default operation map produced by `buildDefaultGraphIrOperationMap` compiles operation graphs once at startup. Runtime hosts normally wrap it in `GraphOperationExecutor` from `@rntme/runtime`.

## Generic HTTP middleware

The following middleware are the canonical home for HTTP request handling; they are consumed by `@rntme/runtime`'s `HttpSurface` and may be imported directly by any runtime service that needs them.

| Export | Signature | Purpose |
|---|---|---|
| `requestId` | `() => MiddlewareHandler` | Echo or mint `X-Request-ID`; sets `c.var.requestId`. |
| `requestLogger` | `(opts: { logger: pino.Logger }) => MiddlewareHandler` | Pino-logged request access log. |
| `errorHandler` | `(opts?: ErrorHandlerOptions) => Hono ErrorHandler` | Generic 500 envelope; configurable `code` and `message`. |
| `cors` | `(opts: CorsOptions) => MiddlewareHandler` | Wildcard-aware CORS using `isAllowedOrigin`. |
| `bodyLimit` | `(maxBytes: number, opts?) => MiddlewareHandler` | 413 with configurable `code`. |
| `rateLimit` / `InMemoryRateLimiter` / `RateLimitDecision` | function + class + type | Generic Hono adapter, per-process bucket limiter, and rich decision shape that drives `X-RateLimit-*` and `Retry-After` headers when emitted. |
| `securityHeaders` | `(opts?: SecurityHeadersOptions) => MiddlewareHandler` | CSP / nosniff / referrer-policy with opt-outs via `null`. |
| `sameOriginOnly` | `(baseUrl: string, opts?) => MiddlewareHandler` | Same-origin-or-allowed-Referer guard for non-GET methods. |

## Error Mapping

| Status | Code | Cause |
| --- | --- | --- |
| `400` | `VALIDATION_ERROR` | Zod parse failure on path/query/body. |
| `400` | `INVALID_BODY` | JSON body missing, invalid, or not an object. |
| `400` | `INPUT_FROM_MISSING` | Required `inputFrom` value is absent. |
| `404`/`409`/`422`/`500` | operation error code | Mapped by `error-to-http.ts` from `OperationExecutor` errors. |
| `500` | `INTERNAL_ERROR` | Unexpected throw from handler/executor glue. |

`GET /openapi.json` is mounted only when `openApiDoc` is supplied.

## Invariants And Gotchas

- `BindingPlan` is unified around `exposure: "read" | "action"`; there are no split query/command handlers.
- `inputFrom` is additive. It must not duplicate `http.parameters[].bindTo`, and the handler merges both sources before execution.
- Body parameters require a JSON object. Form bodies are only read through `inputFrom`.
- Query/path/body Zod schemas are strict, so undeclared inputs fail before execution.
- Idempotency cache is action-scoped and stores the rendered default/custom response for a client `Idempotency-Key`.
- Correlation middleware can set `c.var.correlation`; when present, the operation handler uses that exact `commandId`/`correlationId` for events and default action response metadata.
- Callback responses can redirect. Absolute redirect targets must match `allowedRedirectHosts`.
- Module/service calls are Graph IR `call` nodes executed by the operation executor's call client.

## Where To Look First

- Route wiring: `src/router.ts`.
- Operation startup compilation: `src/startup/compile-plan.ts`.
- Request execution: `src/runtime/operation-handler.ts`.
- Header/query/body/form `inputFrom`: `src/runtime/extract-inputs.ts`.
- Idempotency behavior: `src/idempotency/`.
- Public API drift: `test/unit/public-api.test.ts` and `test/smoke.test.ts`.

## Specs

- [`../../../docs/history/specs/historical/2026-05-06-graph-ir-effect-operations-design.md`](/docs/history/specs/historical/2026-05-06-graph-ir-effect-operations-design.md) — unified operation runtime.
- [`../../../docs/history/specs/historical/2026-04-14-bindings-http-design.md`](/docs/history/specs/historical/2026-04-14-bindings-http-design.md) — original HTTP runtime design background.
