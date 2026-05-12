# @rntme/ui-runtime

Serves a compiled `@rntme/ui` artifact as a Hono sub-router plus a Bun-bundled React SPA that fetches screens lazily and renders them through `@json-render/react`.

## Role in the system

- Depends on:
  - `@rntme/ui` — input type `CompiledArtifact` (manifest + layouts + screens).
  - `@rntme/contracts-client-runtime-v1` — browser contract for module boot
    contexts, hooks/providers, operation registry, transport chain, visibility
    evaluation, and route helpers.
  - `hono` — HTTP sub-router mounted under the consumer's app.
  - `react`, `react-dom` — SPA rendering.
  - `@json-render/core`, `@json-render/react`, `@json-render/shadcn` — canonical Spec rendering, state store, shadcn component catalog (60+ components).
  - `zod` — action parameter schemas registered on the json-render catalog.
  - `bun build`, `@tailwindcss/cli` — build-time SPA bundling and Tailwind v4 CSS generation.
- Consumed by:
  - `@rntme/runtime` or an embedding Hono app that mounts the returned router and pairs it with HTTP bindings.
  - generated service runtimes that mount `createApp({ artifact })` at `/` and
    HTTP bindings at `/api`.
- Position in pipeline:
  `@rntme/ui` compiled artifact
    -> `server/index.ts` (Hono sub-router: HTML shell, manifest/layouts/screens JSON, static assets)
    | `client/no-auth-entry.ts` -> bundled by `build.ts` -> `build/main.js` (SPA).

## File map

```
packages/runtime/ui-runtime/src/
  index.ts                   (entry `.`)            Re-exports `createApp` and `CreateAppOptions` from server.
  build.ts                   (CLI)                  Bun bundles `build/main.js`; Tailwind v4 CLI emits `build/main.css`.
  server/
    index.ts                 (entry `./server`)     `createApp({ artifact, assetsDir? })` -> Hono app.
    static-shell.ts          (internal)             `buildHtmlShell()` emits the SPA bootstrap HTML (`#root`, `/assets/main.{js,css}`).
  client/
    index.ts                 (entry `./client`)     SPA bundle entry — re-exports host bootstrap (`hydrateApp`, `mountUiRuntime`, `AppShell`, driver, registry, screen loader, state store) for browser bundlers; module-facing APIs live in `@rntme/contracts-client-runtime-v1`.
    entry.tsx                (runtime bootstrap)    `mountUiRuntime({ manifestUrl, target, transport?, initialState? })`; `hydrateApp({ rootSelector })` is the no-auth convenience wrapper.
    no-auth-entry.ts         (bundle entry)         Calls `hydrateApp({ rootSelector: '#root' })` for the standard shell bundle.
    driver.ts                (internal)             `createDriver({ fetchFn, onStateChange, onNavigate, defaultHeaders? })` — screen data fetching (sets `/data/__status*`, `/data/__error*`) and action dispatch (navigation and command).
    layout-manager.tsx       (internal)             `<AppShell>` composes json-render `StateProvider`/`ActionProvider`/`VisibilityProvider`/`ValidationProvider` and renders layout + screen `<Renderer>` trees.
    registry.ts              (internal)             `createRegistry(bridge)` — binds the shadcn catalog plus `navigate` and `dispatch` actions (zod-validated) to the `RuntimeBridge`.
    screen-loader.ts         (internal)             `createScreenLoader(fetchFn?)` — in-memory cache for `/_screens/:name.json` and `/_layouts/:name.json`.
    styles.css               (bundled asset)        Tailwind v4 entry (`@import "tailwindcss"`, `@source "../../build/main.js"`) with shadcn theme tokens in `@theme inline`.
```

No `.json` fixtures ship with the package; all input comes from the `CompiledArtifact` passed to `createApp`.

## Quick start

### Server — mount the sub-router

```ts
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { createApp } from '@rntme/ui-runtime/server';
import type { CompiledArtifact } from '@rntme/ui';

// artifact comes from `@rntme/ui` compiler output
declare const artifact: CompiledArtifact;

const root = new Hono();
root.route('/', createApp({ artifact }));          // HTML shell + /_manifest.json + /_layouts/:name + /_screens/:name + /assets/*
// root.route('/api', httpBindingsRouter);         // consumer wires HTTP bindings here

serve({ fetch: root.fetch, port: 3000 });
```

`createApp` returns a Hono instance. Any request not matched by `/_manifest.json`, `/_layouts/:name`, `/_screens/:name`, or `/assets/:file` is answered with the HTML shell — the SPA resolves deep links client-side.
Shell responses include a restrictive CSP that allows only same-origin script/style/assets needed by the static shell, plus `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, and `Permissions-Policy` hardening headers.

### Client — build the SPA bundle

```bash
bun run build                          # runs `tsc -p tsconfig.json` then `bun src/build.ts`
# Output:
#   dist/              TypeScript declarations + server JS
#   build/main.js      Bun bundle of client/entry.tsx (ESM, browser)
#   build/main.css     Tailwind v4 output scanning build/main.js for class names
```

The default shell emitted by `buildHtmlShell()` loads `/assets/main.js` and `/assets/main.css`.
Module boot code in `main.js` reads public runtime config when needed. `createApp` serves assets
from `opts.assetsDir` (default: `<package>/build`). Override when bundling elsewhere:

```ts
createApp({ artifact, assetsDir: '/abs/path/to/build' });
```

### Client — compose pieces manually

Use the root package export for host bootstrap and
`@rntme/contracts-client-runtime-v1` for contract-level module APIs. The
`./client` subpath remains as the SPA bundle entry point (it re-exports only
host bootstrap symbols — driver, registry, screen loader, layout manager,
state store, and `hydrateApp`/`mountUiRuntime`) so browser bundlers can pick
a Node-free entry; browser module code must import the contract package,
not the runtime internals.

```ts
import {
  mountUiRuntime,
} from '@rntme/ui-runtime';

void mountUiRuntime({
  manifestUrl: '/_manifest.json',
  target: document.getElementById('root')!,
  initialState: {},
});
```

`entry.tsx` is the reference composition; read it first when wiring a custom bootstrap.

## API

### Server (`@rntme/ui-runtime/server`, also re-exported from the root `.` entry)

| Export | Signature | Purpose |
|---|---|---|
| `createApp` | `(opts: CreateAppOptions) => Hono` | Builds the sub-router: HTML shell, JSON endpoints for manifest/layouts/screens, static asset server, SPA fallback. |
| `CreateAppOptions` | `{ artifact: CompiledArtifact; assetsDir?: string }` | `artifact`: `@rntme/ui` compiler output. `assetsDir`: directory for `/assets/:file` (default `<package>/build`). |

Routes mounted by `createApp`:

| Method | Path | Body |
|---|---|---|
| GET | `/` | HTML shell from `buildHtmlShell()`. |
| GET | `/_manifest.json` | `artifact.manifest`. |
| GET | `/_layouts/:name` | `artifact.layouts[name]` (strips trailing `.json`). 404 on miss. |
| GET | `/_screens/:name` | `artifact.screens[name]` (strips trailing `.json`). 404 on miss. |
| GET | `/assets/:file` | Reads `resolve(assetsDir, file)`; rejects paths escaping `assetsDir`. Sets `content-type` by extension (`.js`, `.css`, otherwise `application/octet-stream`). |
| GET | `/*` | Falls back to the HTML shell. |

### Client host bootstrap (`@rntme/ui-runtime`)

| Export | Signature | Purpose |
|---|---|---|
| `mountUiRuntime` | `({ manifestUrl, target, transport?, initialState? }) => Promise<{ unmount }>` | Browser bootstrap used by the standard SPA bundle and generated module entries. All manifest/screen/data/action fetches use `transport ?? fetch`; module boot hooks load public runtime config from `/config.json`. |
| `hydrateApp` | `({ rootSelector, ... }) => Promise<{ unmount }>` | Convenience wrapper used by the static shell and blueprint-generated virtual entry. |
| `ModuleSpec`, `MountUiRuntimeOptions`, `MountUiRuntimeResult` | types | Host bootstrap types used by generated entries and tests. |

Contract-level module APIs (`ModuleBootContext`, hooks/providers, operation
registry, transport chain, visibility, router helpers) are exported by
`@rntme/contracts-client-runtime-v1`.

### CLI

| Binary | Invocation | Effect |
|---|---|---|
| `build.ts` | `bun src/build.ts` (run via `bun run build:client`) | Bun browser bundle of `client/entry.tsx` -> `build/main.js` (ESM, minified, linked source map), followed by `bunx --no-install tailwindcss -i client/styles.css -o build/main.css --minify`. On Tailwind failure, writes a stub `main.css` and continues. |

### Package scripts (`package.json`)

| Script | Command | Effect |
|---|---|---|
| `build` | `tsc -p tsconfig.json && bun run build:client` | Emits server/client TypeScript to `dist/`, then bundles the SPA. |
| `build:client` | `bun src/build.ts` | Runs the Bun bundler + Tailwind pipeline described above. |
| `test` | `bun test` | Runs `test/unit/*.test.ts`. |

## Boot lifecycle and resilience

`mountUiRuntime` runs each module's `boot()` in sequence. **A boot failure does not abort the runtime** — the error is recorded and rendering proceeds.

### State slots

- `/runtime/bootErrors`: `Array<{ moduleName: string; cause: unknown }>`. Empty if every boot succeeded.
- `/auth/status`: `'anon' | 'authed' | undefined`. See identity contract below.
- `/runtime/renderErrors/layout` and `/runtime/renderErrors/screen`:
  optional sanitized renderer-failure records shaped as
  `{ scope, identity, message: 'Renderer failed', errorName, componentStack? }`.
  These are inspectability/debug slots, not user notification APIs. The runtime
  replaces the prior record for the same scope instead of keeping a growing log.

### Identity contract

A module may declare `module.json#client.contract: "identity"`. The blueprint surfaces this as `bootContract: 'identity'` on the runtime `ModuleSpec`. The contract is:

- The module **must** set `/auth/status` itself on success or failure.
- If the module crashed before setting `/auth/status`, the runtime sets `/auth/status = 'anon'` and `/auth/user = null` on its behalf so the layout renders the anon state instead of staying empty.
- The runtime **never** overwrites an already-set `/auth/status`. A module that authed successfully and then crashed in `registerOperation` keeps `'authed'` — no surprise logout.

### Failure semantics for non-identity modules

A non-identity module's failure is recorded in `/runtime/bootErrors` and logged via `console.error`. The runtime takes no automatic compensating action.

### Renderer failure semantics

Generated layout and screen specs are rendered behind separate React Error
Boundaries in `layout-manager.tsx`. A screen render crash replaces only the
screen region with `#rntme-screen-error`; the layout remains mounted. A layout
render crash replaces only the layout region with `#rntme-layout-error`; the
screen still renders when it can.

`@json-render/react` also wraps each element in its own error boundary; throws
inside a module component are typically caught there (rendering `null` for that
element) before they reach the runtime `RendererErrorBoundary`. The runtime
boundary covers failures outside that path (e.g. renderer composition) and
keeps a consistent sanitized record under `/runtime/renderErrors/<scope>`.

Fallback UI is plain React DOM with `role="alert"` and
`data-rntme-error-scope`. It intentionally does not show raw exception
messages, JavaScript stacks, props, state snapshots, request data, or compiled
artifact JSON. Sanitized records are written to `/runtime/renderErrors/<scope>`
and logged once with `[rntme] UI renderer failed`.

Screen boundaries reset when navigation changes the route-derived screen
identity (`screen:<route-pattern>:<screen-name>`). Layout boundaries reset when
the layout identity changes (`layout:<layout-name>`) or the page reloads. A
scope's prior `/runtime/renderErrors/<scope>` record is cleared when the failed
boundary is replaced by a different identity.

### Boot timeout

Default 10s; override per module via `module.json#client.bootTimeoutMs`. A timeout is treated identically to a thrown error.

### Subscriber note

`/runtime/bootErrors` is written once after the boot loop completes. Subscribers attached via `store.subscribe` after `mountUiRuntime` resolves will see the final array on first read; do not assume the slot exists during boot itself.

## Invariants & gotchas

- **Screen and layout JSON are consumed verbatim** (spec §4, Rendering). The client passes `currentScreen.spec` and `currentLayout.spec` straight into json-render `<Renderer>`; this package does not re-validate or rewrite them.
- **Routing is history-based, not hash-based** (`client/entry.tsx`). `hydrateApp` calls `window.history.pushState`/`replaceState` and listens to `popstate`. For this to function, the server must serve the HTML shell on every unknown path — the SPA fallback route in `createApp` does.
- **HTML shell responses carry security headers** (`server/index.ts`). `/` and SPA fallback responses send a restrictive `Content-Security-Policy` with no inline script/style, same-origin `script-src`/`style-src`, and HTTPS `connect-src`/`frame-src`/`img-src` allowances for browser auth SDKs, plus `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`, and `Permissions-Policy: camera=(), microphone=(), geolocation=()`.
- **Path-param precedence is exact-first** (`@rntme/contracts-client-runtime-v1`
  `router.ts` and its unit test). `/issues/browse` matches the literal pattern
  before `/issues/:id`. Do not rely on insertion order.
- **`/assets/:file` is sandboxed** (`server/index.ts`). Resolved paths outside `resolve(assetsDir)` return 404; this prevents path traversal via `../`.
- **`:name.json` suffix is optional on layouts and screens** (`server/index.ts`). The handler strips a trailing `.json` before lookup, so both `/_screens/home` and `/_screens/home.json` work. The client always requests the `.json` form (`screen-loader.ts`).
- **The screen loader caches per loader instance** (`screen-loader.ts`, `test/unit/screen-loader.test.ts`). A second `loadScreen(name)` reuses the first response; to force a refetch, construct a new loader.
- **`driver.ts` writes two sibling status paths per data endpoint**: `/data/__status<statePath>` (`pending`/`ok`/`error`) and `/data/__error<statePath>` (HTTP or exception message). Screens surface loading/error UI by binding to these paths (`test/unit/driver.test.ts`).
- **`paramsFromState` uses path-template substitution for navigation, JSON body params for commands** (`driver.ts`, `registry.ts`). Navigation actions replace `:name` in `navigateTo`; command actions inject remaining params into the JSON body after substituting `{name}` occurrences in the URL.
- **Unknown browser paths render a client not-found state** (`entry.tsx`). The server still returns the HTML shell for unknown paths so deep links can hydrate, but after the manifest loads the client preserves `window.location.pathname`, renders a runtime-generated not-found screen without an app layout, and writes `/route/status = 'not_found'`, `/route/path`, and `/route/params = {}`. Matched routes write `/route/status = 'ok'`, `/route/path`, and `/route/params`.
- **`registry.ts` pulls the shadcn catalog from `@json-render/shadcn`** and binds `navigate` and `dispatch` actions validated by zod (`z.object({ to: z.string() }).passthrough()` and `z.object({ name: z.string() })`). Additional custom actions belong in a fork of `createRegistry`.
- **Runtime and module React components are authored as normal React
  components** (`registry.ts`). `createRegistry` adapts them to
  json-render's `{ props, children }` component-function contract before
  passing them to `defineRegistry`; otherwise props and rendered children are
  lost at runtime.
- **`Slot` is patched into the flat registry returned by
  `defineRegistry`** (`layout-manager.tsx`). Layout rendering depends on this
  patch so the active screen is inserted at the compiled `Slot` element.
- **Tailwind v4 scans `build/main.js`** (`client/styles.css` `@source` directive, `build.ts` ordering). CSS must be built after JS or shadcn class names will be pruned — `build.ts` enforces this order.
- **`AppShell` returns a loading div until `screenSpec` is non-null** (`layout-manager.tsx`). No layout mounts before a screen is resolved, so layout-persistent state begins only after the first successful `enterRoute`.
- **Renderer crashes fail locally** (`layout-manager.tsx`). Layout and screen
  `<Renderer>` calls have separate boundaries; fallback copy is sanitized and
  diagnostics live under `/runtime/renderErrors/<scope>`. If the same broken
  route is revisited, the boundary will throw and show the fallback again until
  the compiled artifact or module component is fixed.
- **Module-facing APIs live in the client-runtime contract.** Browser modules
  import from `@rntme/contracts-client-runtime-v1`. `@rntme/ui-runtime` owns the
  host bootstrap (`hydrateApp` / `mountUiRuntime`), server routes, SPA bundle,
  driver, registry, screen loader, and layout manager.

## Out of scope / known limits

- **No authoring.** Authoring lives in `packages/artifacts/ui` (manifest + `.spec.json` + `.screen.json` + fragments + compiler). This package only consumes `CompiledArtifact`.
- **No HTTP API bindings behind screens.** `createDriver` fetches `/api/*` URLs baked into the compiled screens; the `/api/*` server lives in `@rntme/bindings-http` and is mounted by the host app alongside `createApp`.
- **No SSR or streaming render** (spec §6). The shell is a static HTML stub; the SPA hydrates client-side only.
- **No auth, RBAC, or role-based visibility** (spec §6). Visibility logic terminates at json-render's `VisibilityProvider`.
- **No custom shadcn components beyond the `@json-render/shadcn` catalog** (spec §6). Extending the catalog requires a fork of `registry.ts`.
- **No dev server.** `build.ts` is a one-shot bundler; HMR and watch mode are not wired.
- **No Spec re-validation at runtime.** The compiler owns parse/structural/reference/consistency validation (spec §2.3); mutating compiled screens between compile and serve produces undefined behavior.
- **Client runtime seams have focused unit coverage.** Tests cover server routes, router matching, screen loading, driver fetch/action behavior, registry dispatch, layout-manager module bridges, entry boot resilience, transport middleware, and the production bundle check.
- **No persistent client-side storage.** State lives in the json-render `StateStore` for the lifetime of the page; nothing is written to `localStorage` or `sessionStorage`.
- **No web worker offloading.** All fetch, routing, and render work runs on the main thread.

## Where to look first

- "Add a new server route (e.g., health check)" -> `src/server/index.ts` alongside `/_manifest.json`; add a test in `test/unit/server.test.ts`.
- "Change the HTML shell (title, meta tags, script path)" -> `src/server/static-shell.ts`.
- "Add a new custom action (beyond `navigate`/`dispatch`)" -> `src/client/registry.ts` `defineCatalog` and `defineRegistry` blocks; register its zod schema and a handler closure over `RuntimeBridge`.
- "Change data fetching semantics (headers, retries, status keys)" -> `src/client/driver.ts` `fetchEndpoint`; mirror the keys in a `driver.test.ts` case.
- "Add layout-level data fetching" -> `src/client/entry.tsx` `enterRoute` (only screen `data` is fetched today); extend with layout data matching spec §4.
- "Change route-matching precedence or add wildcard support" ->
  `packages/contracts/client-runtime/v1/src/router.ts` `matchRoute`; extend
  the contract package's `test/unit/router.test.ts`.
- "Tune the Bun or Tailwind build" -> `src/build.ts`; preserve the JS-before-CSS order.
- "Debug a failing SPA deep link" -> confirm the server falls through to the shell (`app.get('/*', ...)`), then inspect `/route/status`, `/route/path`, and `/route/params` from `entry.tsx`; unmatched manifest paths render the runtime not-found screen without changing the URL.
- "Debug a blank screen after navigation" -> first check for `#rntme-screen-error`,
  `#rntme-layout-error`, and `/runtime/renderErrors/<scope>`; then check that
  `_screens/:name.json` loaded and that the store subscribe callback in
  `entry.tsx` rerendered `AppShell`.
- "Write a new server test" -> `test/unit/server.test.ts` and `test/fixtures/compiled-manifest.ts` / `compiled-screen.ts` show how to hand-build a minimal `CompiledArtifact` and invoke `app.request(path)` without a live network.
- "Add action status reflection in the UI" -> bind a shadcn component's prop to `/data/__status<statePath>` or `/data/__error<statePath>`; `driver.ts` already writes these keys on every fetch.
- "Replace the shadcn theme tokens" -> edit the `@theme inline` block in `client/styles.css`; the tokens feed Tailwind v4 utilities used by `@json-render/shadcn` components.

## Specs

- [`../../docs/history/specs/historical/2026-04-16-ui-artifact-v2-design.md`](/docs/history/specs/historical/2026-04-16-ui-artifact-v2-design.md) — historical design rationale: §1 source format, §2 compiler pipeline, §3 compiled output format, §4 runtime architecture (server and client modules map 1:1 to files in this package), §6 scope.
