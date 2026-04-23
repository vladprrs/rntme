# @rntme/module-skeleton

Starter template for **rntme platform modules** (spec: `docs/superpowers/specs/2026-04-19-platform-modules-integration-design.md`).

A *platform module* is a service that uses `@rntme/runtime` infrastructure (event-store, projections, relay) but replaces graph-IR execution with hand-written TypeScript handlers via `CodeCommandExecutor`. This is the right shape for integration services that wrap a vendor SDK (Stripe, Resend, Algolia, OpenAI, etc.) — the SDK's semantics are too complex to express in Graph IR, and nothing is lost by writing code.

## What's inside

- `src/handlers.ts` — example `CodeCommandHandlerMap` with a single `echo` command. This is what you replace with your own handlers.
- `src/index.ts` — barrel re-exporting the handler map.
- `test/unit/*.test.ts` — example unit tests for a handler + a wiring smoke test using `CodeCommandExecutor`.

## Copy to bootstrap your module

1. `cp -r packages/module-skeleton packages/<your-module-name>`.
2. Rename the package in `package.json`.
3. Replace the contents of `src/handlers.ts` with your vendor's operations.
4. Add your vendor SDK to `dependencies` (e.g. `"stripe": "^14.0.0"`).
5. Run `pnpm install` at the repo root.
6. (After plan 2 lands — gRPC surface) register your handlers with the gRPC surface in your module's `start-module.ts` entry.

## What is not here (yet)

- **gRPC surface** — comes in plan 2 (`packages/bindings-grpc`). Until then, modules do not have their own exposed public API; this package only demonstrates the handler shape.
- **Webhook receiver** — modules own their webhook endpoint. After plan 2 lands, use `@rntme/bindings-http` inside the module to mount `/webhooks/<vendor>` and do signature verification + dedupe + emit.
- **Pre-fetch / `pre[]` support** — domain services call modules via the seam described in plan 3. Modules themselves don't use `pre[]`.

## Health-check convention

Every platform module **must** expose a liveness endpoint. When running on `HttpSurface` (the default), the runtime mounts `/health` automatically from `manifest.observability.health.path`. The body shape is `{ "ok": boolean, "reason"?: string }`. Modules that run on the gRPC surface (plan 2) will additionally implement the standard `grpc.health.v1.Health/Check` RPC — schema documented when that plan lands.

## Testing your module

Handlers are pure async functions. Test them in isolation with any `CommandExecutionContext` stub:

```ts
const out = await myHandlers.createCheckoutSession(mkCtx(), { priceId: 'price_123' });
expect(out.ok).toBe(true);
```

Integration tests should use an in-memory event-store (`new SqliteEventStore({ filename: ':memory:' })`) and assert on emitted events rather than vendor SDK calls (mock the SDK).

## References

- Spec: `docs/superpowers/specs/2026-04-19-platform-modules-integration-design.md` §5, §12.
- Default executors: `packages/runtime/src/plugins/executors/`.
- Contract tests: `runCommandExecutorContract` in `packages/runtime/src/plugins/contract-tests.ts`.
