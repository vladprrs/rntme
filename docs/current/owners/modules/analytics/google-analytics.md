# @rntme/analytics-google-analytics

Google Analytics 4 UI module for the analytics category. It contributes a
browser `boot(ctx)` hook, not backend RPC handlers.

## File map

- `module.json` — module manifest: category `analytics`, vendor
  `google-analytics`, contract `analytics/v1`, required public config, and
  client operations.
- `src/client.ts` — SPA boot hook that loads `gtag.js`, registers operations,
  and listens to runtime navigation/user state.
- `src/index.ts` — package version export.
- `test/unit/boot.test.ts` — boot behavior and operation registration tests.

## Quick start

```bash
pnpm -F @rntme/analytics-google-analytics run build
pnpm -F @rntme/analytics-google-analytics run test
pnpm -F @rntme/analytics-google-analytics run typecheck
```

`pnpm run build:deps` builds `@rntme/contracts-analytics-v1` and
`@rntme/contracts-client-runtime-v1` before this package compiles.

## Browser client

The module imports `ModuleBootContext` from
`@rntme/contracts-client-runtime-v1`. `module.json#client.config.schema`
requires:

| Key | Type | Purpose |
| --- | --- | --- |
| `measurementId` | string | GA4 measurement id passed to `gtag('config', ...)` and used for the script URL. |

`boot(ctx)` exits without side effects when `measurementId` is missing or not a
string. With valid config it:

- creates `globalThis.dataLayer` / `globalThis.gtag` if they do not exist;
- appends the async `https://www.googletagmanager.com/gtag/js?id=...` script
  when `document` is available;
- registers `track({ event, props? })`;
- registers `identify({ userId, traits? })`;
- subscribes to `/currentUser` and forwards `sub` as GA `user_id`;
- listens for the runtime `navigate` lifecycle event and sends `page_view`.

## Invariants & gotchas

- This is client-only. It exports `./client` and `./module.json`; no server
  handlers or provisioner are present.
- GA calls are best-effort. If `gtag` is unavailable, operations no-op.
- The script is appended during boot; the local shim queues calls in
  `dataLayer` before the network script finishes loading.
- `send_page_view` is disabled on initial config; route changes are reported
  through the runtime lifecycle bus.

## Where to look first

- "Change GA boot behavior" -> `src/client.ts` `boot`.
- "Add a client operation" -> `module.json#client.operations` and
  `src/client.ts` `ctx.registerOperation`.
- "Change config validation" -> `module.json#client.config.schema`.

## Specs

- [`../../contracts/analytics/v1/README.md`](/docs/current/owners/packages/contracts/analytics/v1.md) — analytics canonical contract package.
- [`../../../packages/contracts/client-runtime/v1/README.md`](/docs/current/owners/packages/contracts/client-runtime/v1.md) — module browser contract used by `boot(ctx)`.
