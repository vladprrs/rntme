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

Backend modules: `category`, `vendor`, `contract`, and non-empty
`capabilities.rpcs` / `capabilities.events` are typical. UI-only modules may
omit `category`/`vendor`/`contract` and declare only `client`. At least one of
non-empty `capabilities` or non-empty `client` is required
(`MODULE_MANIFEST_EMPTY` otherwise). `contact`, `grpcServiceName`, `webhookPath`,
`secrets`, `description`, `client`, and `limitations` are optional. Canonical
modules that set `category` must also set `contract` and `vendor`.
`secrets[].scope` is one of `tenant`, `project`, or `service`. Unknown keys are
rejected so module boot fails fast when the contract drifts.

## Client (UI) contributions

A module may contribute UI in three orthogonal ways. All three are declared inside an optional `client` block in `module.json`. Backend-only modules omit the block entirely; UI-only modules omit `capabilities`. At least one of `capabilities` or `client` must be non-empty (`MODULE_MANIFEST_EMPTY` otherwise).

```jsonc
{
  "name": "@rntme/presentation-md-mermaid",
  "version": "0.0.0",
  "client": {
    "entry": "./client/index.ts",
    "boot": false,
    "bootTimeoutMs": 10000,
    "config": {
      "schema": { "key": { "type": "string", "required": true } }
    },
    "components": [
      { "type": "Markdown", "props": { "source": { "type": "string", "required": true } } }
    ],
    "operations": [
      { "name": "track", "params": { "event": { "type": "string", "required": true } } },
      { "name": "toggleBold", "appliesTo": ["RichTextEditor"], "params": {} }
    ]
  }
}
```

- `client.components[]` — element types the module registers in the json-render catalog. Each `type` is the named export from `client.entry`.
- `client.operations[]` — named operations addressable from screen actions via `kind: "module-action"`. With `appliesTo` they are component-bound (registered by the component on mount via `useOperationRegistry`); without it they are module-level (registered in `boot(ctx)` via `ctx.registerOperation`).
- `client.boot` — when `true`, `client.entry` exports `boot(ctx: ModuleBootContext)`. Runs once at SPA start before mount.
- `client.config.schema` — public config the module needs (served via `/config.json`). Public means the value lands in the SPA bundle's runtime fetch; never put secrets here.
- `client.bootTimeoutMs` — per-boot timeout (default 10000). Boot rejection or timeout fails SPA bootstrap.

See `docs/superpowers/specs/2026-04-29-ui-module-contributions-design.md` for the full model and `modules/presentation/md-mermaid/`, `modules/presentation/tiptap/`, `modules/analytics/google-analytics/` for reference implementations.

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

## Provisioner block

Modules can declare a `provisioner` block in their manifest to participate in
the deploy-time `provision` phase:

```jsonc
{
  "provisioner": {
    "entry": "./dist/provisioner.js",
    "produces": [
      { "name": "spaClient",  "kind": "single", "secret": false },
      { "name": "m2mClients", "kind": "many",   "secret": true  }
    ],
    "requires": [
      { "name": "auth0Mgmt", "schema": "auth0-mgmt-api-v1" }
    ],
    "timeoutMs": 60000
  }
}
```

- `entry` — relative path to the compiled provisioner module from the package
  root. Absolute paths and parent-traversal are rejected at discovery time
  (`BLUEPRINT_MODULE_PROVISIONER_BAD_ENTRY`).
- `produces[]` — declares the outputs the provisioner will return. `kind: 'single'`
  expects a single object value, `kind: 'many'` expects an array. `secret: true`
  routes the value into the encrypted output bucket; `secret: false` routes it
  into the plain-JSONB bucket. Mixed-secret-within-output is rejected.
- `requires[]` — declares the named credential blobs the provisioner needs. Each
  name maps 1:1 to a `targetSecrets[name]` entry on the deploy target; the
  `schema` is a registered identifier validated by the platform when secrets are
  written.
- `timeoutMs` — optional, default 60 000.

The runtime contract for the provisioner module itself is in
`@rntme/deploy-core` (`ProvisionerContract`).

## References

- Spec: `docs/superpowers/specs/done/2026-04-19-platform-modules-integration-design.md` §5, §12.
- Default executors: `packages/runtime/runtime/src/plugins/executors/`.
- Contract tests: `runCommandExecutorContract` in `packages/runtime/runtime/src/plugins/contract-tests.ts`.
