# @rntme/ui-runtime

Serves a compiled `@rntme/ui` artifact as a Hono sub-router plus an esbuild-bundled React SPA that fetches screens lazily and renders them through `@json-render/react`.

## Role in the system

- Depends on:
  - `@rntme/ui` — input type `CompiledArtifact` (manifest + layouts + screens).
  - `hono` — HTTP sub-router mounted under the consumer's app.
  - `react`, `react-dom` — SPA rendering.
  - `@json-render/core`, `@json-render/react`, `@json-render/shadcn` — canonical Spec rendering, state store, shadcn component catalog (60+ components).
  - `zod` — action parameter schemas registered on the json-render catalog.
  - `esbuild`, `@tailwindcss/cli` — build-time SPA bundling and Tailwind v4 CSS generation (dev-dependencies).
- Consumed by:
  - `@rntme/runtime` or an embedding Hono app that mounts the returned router and pairs it with HTTP bindings.
  - `demo/issue-tracker-api` mounts `createApp({ artifact })` at `/` and `@rntme/bindings-http` at `/api`.
- Position in pipeline:
  `@rntme/ui` compiled artifact
    -> `server/index.ts` (Hono sub-router: HTML shell, manifest/layouts/screens JSON, static assets)
    | `client/no-auth-entry.ts` -> bundled by `build.ts` -> `build/main.js` (SPA).

## File map

```
packages/runtime/ui-runtime/src/
  index.ts                   (entry `.`)            Re-exports `createApp` and `CreateAppOptions` from server.
  build.ts                   (CLI)                  esbuild bundles `build/main.js`; Tailwind v4 CLI emits `build/main.css`.
  server/
    index.ts                 (entry `./server`)     `createApp({ artifact, assetsDir? })` -> Hono app.
    static-shell.ts          (internal)             `buildHtmlShell()` emits the SPA bootstrap HTML (`#root`, `/assets/main.{js,css}`).
  client/
    index.ts                 (entry `./client`)     Re-exports `matchRoute`, `expandTemplate`, `createScreenLoader`, `createRegistry`, `createDriver`, `AppShell` plus their types.
    entry.tsx                (runtime bootstrap)    `mountUiRuntime({ manifestUrl, target, transport?, initialState? })`; `hydrateApp({ rootSelector })` is the no-auth convenience wrapper.
    no-auth-entry.ts         (bundle entry)         Calls `hydrateApp({ rootSelector: '#root' })` for the standard shell bundle.
    driver.ts                (internal)             `createDriver({ fetchFn, onStateChange, onNavigate, defaultHeaders? })` — screen data fetching (sets `/data/__status*`, `/data/__error*`) and action dispatch (navigation and command).
    layout-manager.tsx       (internal)             `<AppShell>` composes json-render `StateProvider`/`ActionProvider`/`VisibilityProvider`/`ValidationProvider` and renders layout + screen `<Renderer>` trees.
    registry.ts              (internal)             `createRegistry(bridge)` — binds the shadcn catalog plus `navigate` and `dispatch` actions (zod-validated) to the `RuntimeBridge`.
    router.ts                (internal)             `matchRoute(patterns, path)` exact-then-`:param`; `expandTemplate(template, params)`.
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
pnpm -F @rntme/ui-runtime build        # runs `tsc -p tsconfig.json` then `tsx src/build.ts`
# Output:
#   dist/              TypeScript declarations + server JS
#   build/main.js      esbuild bundle of client/entry.tsx (ESM, browser, es2022)
#   build/main.css     Tailwind v4 output scanning build/main.js for class names
```

The default shell emitted by `buildHtmlShell()` loads `/assets/main.js` and `/assets/main.css`.
Module boot code in `main.js` reads public runtime config when needed. `createApp` serves assets
from `opts.assetsDir` (default: `<package>/build`). Override when bundling elsewhere:

```ts
createApp({ artifact, assetsDir: '/abs/path/to/build' });
```

### Client — compose pieces manually

Use `./client` exports to embed the pieces without the default `hydrateApp` entrypoint:

```ts
import { createRoot } from 'react-dom/client';
import { createStateStore } from '@json-render/core';
import {
  AppShell,
  createDriver,
  createRegistry,
  createScreenLoader,
  matchRoute,
} from '@rntme/ui-runtime/client';

const store = createStateStore();
const loader = createScreenLoader();
const { registry, handlers } = createRegistry({
  onNavigate: (path) => history.pushState({}, '', path),
  getScreen: () => currentScreen,
  store,
  fetchEndpoint: async (statePath, endpoint) => { /* ... */ },
});
const driver = createDriver({
  fetchFn: fetch,
  onStateChange: (path, value) => store.set(path, value),
  onNavigate: (path) => history.pushState({}, '', path),
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

### Client (`@rntme/ui-runtime/client`)

| Export | Signature | Purpose |
|---|---|---|
| `matchRoute` | `(patterns: string[], path: string) => RouteMatch \| null` | Exact match first; otherwise parameterized match where each `:name` segment becomes `params[name]`. |
| `expandTemplate` | `(template: string, params: Record<string,string>) => string` | Substitutes `:name` tokens; missing keys remain as `:name`. |
| `createScreenLoader` | `(fetchFn?: typeof fetch) => ScreenLoader` | `.loadScreen(name)` hits `/_screens/:name.json`, `.loadLayout(name)` hits `/_layouts/:name.json`, both cached per-instance. |
| `createRegistry` | `(bridge: RuntimeBridge) => { catalog, registry, handlers }` | Wires the `@json-render/shadcn` catalog plus `navigate` and `dispatch` actions; `dispatch` routes compiled screen actions (`navigation`/`command`/`refetch`) through the bridge. |
| `createDriver` | `(opts: DriverOptions) => Driver` | `enterScreen(screen)` fetches every `data` endpoint in parallel and writes status/error into `/data/__status*` and `/data/__error*`; `dispatchAction(action, stateGetter?)` resolves `paramsFromState`, issues the HTTP call, and forwards `onSuccess.navigateTo` / `onError.showAlert`. |
| `mountUiRuntime` | `({ manifestUrl, target, transport?, initialState? }) => Promise<{ unmount }>` | Browser bootstrap used by the standard SPA bundle and generated module entries. All manifest/screen/data/action fetches use `transport ?? fetch`; module boot hooks load public runtime config from `/config.json`. |
| `AppShell` | `(props: AppShellProps) => ReactElement` | Renders optional layout spec, then screen spec, wrapped in json-render `StateProvider`/`ActionProvider`/`VisibilityProvider`/`ValidationProvider`. |
| `RouteMatch`, `ScreenLoader`, `RuntimeBridge`, `Driver`, `DriverOptions`, `AppShellProps` | types | Public shapes used by consumers. |

### CLI

| Binary | Invocation | Effect |
|---|---|---|
| `build.ts` | `tsx src/build.ts` (run via `pnpm build:client`) | esbuild bundle of `client/entry.tsx` -> `build/main.js` (ESM, `target: es2022`, `.css` files loaded as `empty`), followed by `npx @tailwindcss/cli -i client/styles.css -o build/main.css --minify`. On Tailwind failure, writes a stub `main.css` and continues. |

### Package scripts (`package.json`)

| Script | Command | Effect |
|---|---|---|
| `build` | `tsc -p tsconfig.json && pnpm run build:client` | Emits server/client TypeScript to `dist/`, then bundles the SPA. |
| `build:client` | `tsx src/build.ts` | Runs the esbuild + Tailwind pipeline described above. |
| `test` | `vitest run` | Runs `test/unit/*.test.ts`. |
| `test:watch` | `vitest` | Watch mode. |

## Invariants & gotchas

- **Screen and layout JSON are consumed verbatim** (spec §4, Rendering). The client passes `currentScreen.spec` and `currentLayout.spec` straight into json-render `<Renderer>`; this package does not re-validate or rewrite them.
- **Routing is history-based, not hash-based** (`client/entry.tsx`). `hydrateApp` calls `window.history.pushState`/`replaceState` and listens to `popstate`. For this to function, the server must serve the HTML shell on every unknown path — the SPA fallback route in `createApp` does.
- **HTML shell responses carry security headers** (`server/index.ts`). `/` and SPA fallback responses send a restrictive `Content-Security-Policy` with no inline script/style, same-origin `script-src`/`style-src`, and HTTPS `connect-src`/`frame-src`/`img-src` allowances for browser auth SDKs, plus `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`, and `Permissions-Policy: camera=(), microphone=(), geolocation=()`.
- **Path-param precedence is exact-first** (`router.ts` and `test/unit/router.test.ts`). `/issues/browse` matches the literal pattern before `/issues/:id`. Do not rely on insertion order.
- **`/assets/:file` is sandboxed** (`server/index.ts`). Resolved paths outside `resolve(assetsDir)` return 404; this prevents path traversal via `../`.
- **`:name.json` suffix is optional on layouts and screens** (`server/index.ts`). The handler strips a trailing `.json` before lookup, so both `/_screens/home` and `/_screens/home.json` work. The client always requests the `.json` form (`screen-loader.ts`).
- **The screen loader caches per loader instance** (`screen-loader.ts`, `test/unit/screen-loader.test.ts`). A second `loadScreen(name)` reuses the first response; to force a refetch, construct a new loader.
- **`driver.ts` writes two sibling status paths per data endpoint**: `/data/__status<statePath>` (`pending`/`ok`/`error`) and `/data/__error<statePath>` (HTTP or exception message). Screens surface loading/error UI by binding to these paths (`test/unit/driver.test.ts`).
- **`paramsFromState` uses path-template substitution for navigation, JSON body params for commands** (`driver.ts`, `registry.ts`). Navigation actions replace `:name` in `navigateTo`; command actions inject remaining params into the JSON body after substituting `{name}` occurrences in the URL.
- **The SPA initial route falls back to the first manifest pattern** (`entry.tsx`). If `window.location.pathname` matches no pattern, the client `history.replaceState`s to `patterns[0] ?? '/'`. Put a root route in the manifest to avoid surprise redirects.
- **`registry.ts` pulls the shadcn catalog from `@json-render/shadcn`** and binds `navigate` and `dispatch` actions validated by zod (`z.object({ to: z.string() }).passthrough()` and `z.object({ name: z.string() })`). Additional custom actions belong in a fork of `createRegistry`.
- **Tailwind v4 scans `build/main.js`** (`client/styles.css` `@source` directive, `build.ts` ordering). CSS must be built after JS or shadcn class names will be pruned — `build.ts` enforces this order.
- **`AppShell` returns a loading div until `screenSpec` is non-null** (`layout-manager.tsx`). No layout mounts before a screen is resolved, so layout-persistent state begins only after the first successful `enterRoute`.
- **The root `.` export only exposes the server** (`package.json` `exports`, `src/index.ts`). Browser consumers must import from `@rntme/ui-runtime/client`; mixing client imports into the server module would break Node bundling.

## Out of scope / known limits

- **No authoring.** Authoring lives in `packages/artifacts/ui` (manifest + `.spec.json` + `.screen.json` + fragments + compiler). This package only consumes `CompiledArtifact`.
- **No HTTP API bindings behind screens.** `createDriver` fetches `/api/*` URLs baked into the compiled screens; the `/api/*` server lives in `@rntme/bindings-http` and is mounted by the host app alongside `createApp`.
- **No SSR or streaming render** (spec §6). The shell is a static HTML stub; the SPA hydrates client-side only.
- **No auth, RBAC, or role-based visibility** (spec §6). Visibility logic terminates at json-render's `VisibilityProvider`.
- **No custom shadcn components beyond the `@json-render/shadcn` catalog** (spec §6). Extending the catalog requires a fork of `registry.ts`.
- **No dev server.** `build.ts` is a one-shot bundler; HMR and watch mode are not wired.
- **No Spec re-validation at runtime.** The compiler owns parse/structural/reference/consistency validation (spec §2.3); mutating compiled screens between compile and serve produces undefined behavior.
- **Tests only cover server, router, screen loader, and driver.** `registry.ts`, `layout-manager.tsx`, `entry.tsx`, and `build.ts` have no direct unit coverage; the demo exercises them end-to-end.
- **No persistent client-side storage.** State lives in the json-render `StateStore` for the lifetime of the page; nothing is written to `localStorage` or `sessionStorage`.
- **No web worker offloading.** All fetch, routing, and render work runs on the main thread.

## Where to look first

- "Add a new server route (e.g., health check)" -> `src/server/index.ts` alongside `/_manifest.json`; add a test in `test/unit/server.test.ts`.
- "Change the HTML shell (title, meta tags, script path)" -> `src/server/static-shell.ts`.
- "Add a new custom action (beyond `navigate`/`dispatch`)" -> `src/client/registry.ts` `defineCatalog` and `defineRegistry` blocks; register its zod schema and a handler closure over `RuntimeBridge`.
- "Change data fetching semantics (headers, retries, status keys)" -> `src/client/driver.ts` `fetchEndpoint`; mirror the keys in a `driver.test.ts` case.
- "Add layout-level data fetching" -> `src/client/entry.tsx` `enterRoute` (only screen `data` is fetched today); extend with layout data matching spec §4.
- "Change route-matching precedence or add wildcard support" -> `src/client/router.ts` `matchRoute`; extend `test/unit/router.test.ts`.
- "Tune the esbuild or Tailwind build" -> `src/build.ts`; preserve the JS-before-CSS order.
- "Debug a failing SPA deep link" -> confirm the server falls through to the shell (`app.get('/*', ...)`), then verify the path matches a pattern in the manifest.
- "Debug a blank screen after navigation" -> `layout-manager.tsx` renders `Loading...` until `screenSpec` is non-null; check the `_screens/:name.json` response and the store subscribe callback in `entry.tsx`.
- "Write a new server test" -> `test/unit/server.test.ts` and `test/fixtures/compiled-manifest.ts` / `compiled-screen.ts` show how to hand-build a minimal `CompiledArtifact` and invoke `app.request(path)` without a live network.
- "Add action status reflection in the UI" -> bind a shadcn component's prop to `/data/__status<statePath>` or `/data/__error<statePath>`; `driver.ts` already writes these keys on every fetch.
- "Replace the shadcn theme tokens" -> edit the `@theme inline` block in `client/styles.css`; the tokens feed Tailwind v4 utilities used by `@json-render/shadcn` components.

## Specs

- [`../../docs/superpowers/specs/done/2026-04-16-ui-artifact-v2-design.md`](../../docs/superpowers/specs/done/2026-04-16-ui-artifact-v2-design.md) — authoritative design: §1 source format, §2 compiler pipeline, §3 compiled output format, §4 runtime architecture (server and client modules map 1:1 to files in this package), §6 scope.
