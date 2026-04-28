# @rntme/module-skeleton

Starter template for **rntme platform modules** (spec: `docs/superpowers/specs/done/2026-04-19-platform-modules-integration-design.md`).

A *platform module* is a service that uses `@rntme/runtime` infrastructure (event-store, projections, relay) but replaces graph-IR execution with hand-written TypeScript handlers via `CodeCommandExecutor`. This is the right shape for integration services that wrap a vendor SDK (Stripe, Resend, Algolia, OpenAI, etc.) — the SDK's semantics are too complex to express in Graph IR, and nothing is lost by writing code.

## What's inside

- `src/handlers.ts` — example `CodeCommandHandlerMap` with a single `echo` command. This is what you replace with your own handlers.
- `src/manifest-shape.ts` — Zod-backed `ModuleManifestSchema` and
  `parseModuleManifest(raw)` for the platform module contract.
- `src/index.ts` — barrel re-exporting the handler map and manifest validator.
- `test/unit/*.test.ts` — example unit tests for a handler + a wiring smoke test using `CodeCommandExecutor`.

## Copy to bootstrap your module

1. `cp -r packages/module-skeleton packages/<your-module-name>`.
2. Rename the package in `package.json`.
3. Replace the contents of `src/handlers.ts` with your vendor's operations.
4. Add your vendor SDK to `dependencies` (e.g. `"stripe": "^14.0.0"`).
5. Fill `module.json` using the contract below and validate it with
   `parseModuleManifest`.
6. Run `pnpm install` at the repo root.
7. Register your handlers with the gRPC surface in your module's
   `start-module.ts` entry.

## Module manifest contract

Platform modules publish a strict `module.json`. The canonical fields match
the checked-in vendor modules (`modules/identity/{auth0,clerk,workos}`) and
can also carry the optional runtime-adjacent fields from spec §12:

```json
{
  "name": "@rntme/identity-clerk",
  "version": "0.0.0",
  "category": "identity",
  "vendor": "clerk",
  "contract": "identity/v1",
  "contact": "identity-team@example.com",
  "grpcServiceName": "rntme.identity.v1.IdentityModule",
  "webhookPath": "/webhooks/clerk",
  "secrets": [{ "name": "CLERK_SECRET_KEY", "scope": "tenant" }],
  "capabilities": {
    "rpcs": ["GetUser", "CreateUser"],
    "events": ["rntme.identity.v1.UserCreated"]
  }
}
```

`category`, `vendor`, `contract`, and `capabilities.rpcs/events` are required.
`contact`, `grpcServiceName`, `webhookPath`, `secrets`, `description`, and
`limitations` are optional because current vendor packages publish capability
metadata before all runtime surface fields are wired. `secrets[].scope` is one
of `tenant`, `project`, or `service`. Unknown keys are rejected so module boot
fails fast when the contract drifts.

## What is not here (yet)

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

- Spec: `docs/superpowers/specs/done/2026-04-19-platform-modules-integration-design.md` §5, §12.
- Default executors: `packages/runtime/src/plugins/executors/`.
- Contract tests: `runCommandExecutorContract` in `packages/runtime/src/plugins/contract-tests.ts`.
