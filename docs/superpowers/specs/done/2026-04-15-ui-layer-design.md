# UI layer for rntme — design (`2026-04-15`)

Status: draft, for brainstorming → writing-plans handoff.

## 1. Summary

Introduce a **fifth per-service artifact** to the rntme stack: `ui.json`, a
declarative description of the end-user UI of one rntme service. The artifact
is authored by LLM agents on the design phase (alongside PDM, QSM, Graph IR,
Bindings), validated through a 4-layer validator symmetric to
`@rntme/bindings`, and executed at runtime by a Hono sub-router that serves a
static SPA. The SPA renders via `@json-render/react` using the
`@json-render/shadcn` component catalog as-is; the only rntme-specific
extension is how the artifact declares `data` (query-binding datasets) and
`actions` (command-binding / navigation) per route, and how the runtime
bridges those to HTTP calls against the co-mounted
`@rntme/bindings-http`. There are no runtime LLM calls.

Two new packages:

- **`@rntme/ui`** — pure artifact + validator, zero runtime dependencies
  (only `zod`). Symmetric to `@rntme/bindings`.
- **`@rntme/ui-runtime`** — Hono sub-router, prebuilt SPA bundle, and the
  client-side driver that connects `json-render` to HTTP bindings. Symmetric
  to `@rntme/bindings-http`.

## 2. Goals

- Add UI as a first-class **per-service** artifact authored by LLM agents and
  validated against the service's own bindings/PDM/QSM/Graph IR.
- Keep the authoring format **directly executable by `json-render`**: the
  artifact is a superset of `json-render`'s spec format plus `data`/`actions`
  conventions; no separate compilation to some other UI DSL.
- Reuse `@json-render/shadcn` catalog as the fixed component vocabulary.
- Bridge UI to the backend **only through HTTP** (to
  `@rntme/bindings-http`), preserving the existing CQRS/ES surface.
- Apply rntme's signature 4-layer validation (parse / structural / references
  / consistency) with a resolver-based reference layer pulling types from
  `@rntme/bindings` and `@json-render/shadcn`.
- Provide a multi-screen UI (routes + a shared layout) out of the gate.
- Design the artifact format as a **superset-compatible with `NextAppSpec`**
  so a future migration to `@json-render/next` (for SSR / SEO) is a transform,
  not a rewrite.

## 3. Non-goals (MVP)

- Runtime LLM calls or generative UI at request time. The artifact is a frozen
  JSON committed to the service repo.
- SSR / SEO (deferred; handled by future `@json-render/next` migration).
- Cross-service composition. A UI artifact sees only its own service's HTTP
  bindings. A cross-service composition layer lives above rntme (out of
  scope).
- Auth / RBAC / multi-tenancy (same stance as `@rntme/bindings-http` today).
- Optimistic updates, toasts / push-notifications, i18n, custom themes.
- Pagination beyond a flat `limit` parameter.
- File uploads, WebSockets, streaming / live subscriptions.
- App-level (global) shared `data` / `actions`. MVP is route-local only.
- Escape-hatch to raw `json-render` dictionaries outside the fixed shadcn
  catalog. (Shadcn is the only catalog; extensions come later.)
- Own form-validation DSL. Form-level checks are delegated to the
  binding-derived zod schemas surfaced through `ResolvedBinding.inputs`.

## 4. Context and architecture

### 4.1 Stack placement

```
         Authoring artifacts (JSON, per-service)
  ┌──────┐  ┌──────┐  ┌──────────┐  ┌───────────┐  ┌────────┐
  │ PDM  │  │ QSM  │  │ Graph IR │  │ Bindings  │  │   UI   │ ◀── new
  └──┬───┘  └──┬───┘  └─────┬────┘  └─────┬─────┘  └───┬────┘
     ▼         ▼            ▼             ▼            ▼
  ┌─────────────────────────────────────────────────────────┐
  │ Validators: @rntme/pdm · qsm · graph-ir-compiler ·       │
  │             bindings · ui  ◀── new                       │
  └──────────────────────────┬──────────────────────────────┘
                             │
                 Runtime (per-service Hono app)
        ┌────────────────────┴─────────────────────┐
        ▼                                          ▼
  ┌──────────────────┐                    ┌──────────────────┐
  │ @rntme/bindings- │                    │ @rntme/ui-       │ ◀── new
  │  http (API)      │◀───HTTP calls──────│  runtime         │
  │ /v1/…            │                    │ /ui, /ui/*       │
  └──────────────────┘                    │ (SPA + driver)   │
                                          └──────────────────┘
```

### 4.2 Dependency graph

```
pdm ◀──────────┐
 ▲             │
qsm ◀──────┐   │
           │   │
event-store◀┼─◀│──── projection-consumer
 ▲         │   │
 │         │   │
 └──── graph-ir-compiler ◀──── bindings-http ──▶ bindings ◀─── ui
                                      ▲                          ▲
                                      │                          │
                                    ui-runtime ──────────────────┘
                                      ▲
                                      └─── demo
```

- `@rntme/ui` has no internal runtime dependencies (types only: depends on
  `zod`; pulls `ResolvedBinding` / `ResolvedComponent` shapes through
  resolver interfaces, not imports).
- `@rntme/ui-runtime` depends on `@rntme/ui` (for validated artifact types)
  and on `@rntme/bindings` (for resolver construction over
  `ValidatedBindings`). It **does not** depend on `@rntme/bindings-http`: it
  talks to it over HTTP on the same origin.

## 5. Artifact shape

The artifact is a single JSON file per service named `ui.json` (convention
only — the package accepts any raw object).

### 5.1 Top-level

```jsonc
{
  "version": "1.0-rc1",
  "pdmRef": "issue.domain.v1",
  "qsmRef": "issue.read.v1",
  "graphSpecRef": "issue.graphs.v1",
  "bindingsRef": "issue.bindings.v1",

  "metadata": {
    "title":       { "default": "Issue Tracker", "template": "%s | Issues" },
    "description": "(optional)"
  },

  "layouts": {
    "main": { "spec": { "root": "...", "elements": { ... } } }
  },

  "routes": {
    "/issues":      { "layout": "main", "metadata": {...}, "data": {...}, "actions": {...}, "page": {...} },
    "/issues/new":  { "layout": "main", "metadata": {...},                 "actions": {...}, "page": {...} },
    "/issues/:id":  { "layout": "main", "metadata": {...}, "data": {...}, "actions": {...}, "page": {...} }
  }
}
```

### 5.2 Route

```ts
type RouteSpec = {
  layout?: string;                             // ref to layouts.<id>; omitted ⇒ render page directly
  metadata?: { title?: string };
  page: JsonRenderSpec;                        // { root: string; elements: Record<string, Element> }
  data?: Record<string, DatasetDef>;           // query-binding datasets
  actions?: Record<string, ActionDef>;         // command-binding or navigation
};

type DatasetDef = {
  binding: string;                             // query-binding id from bindings artifact
  params?: Record<string, Literal | StateRef>; // StateRef = { "$state": "/..." }
  refetchOn?: Array<"mount" | "params">;       // default ["mount", "params"]
};

type ActionDef =
  | {
      kind: "command";
      binding: string;                         // command-binding id
      paramsFromState: Record<string, string>; // binding-input name → state path (flat paths only)
      onSuccess?: {
        navigateTo?: string;                   // supports ":name" placeholders
        clearFormState?: string[];             // state-path prefixes to reset
        refetchData?: string[];                // dataset ids in this route
      };
      onError?: { showAlert?: boolean };       // default true (rendered via $cond in the page)
    }
  | {
      kind: "navigation";
      navigateTo: string;
      paramsFromState?: Record<string, string>; // to resolve ":name" placeholders
    };
```

### 5.3 Layout

```ts
type LayoutSpec = { spec: JsonRenderSpec };    // spec.elements MUST contain exactly one Slot
```

A route with `layout: "main"` renders its `page.root` tree into the layout's
`Slot` element. A layout without a `Slot` is an error; more than one `Slot` is
an error. Pages without a `layout` render directly.

### 5.4 Elements

`page.elements` / `layout.spec.elements` follow the `json-render` flat map
shape: each element has `type` (shadcn catalog identifier), `props` (object,
Zod-checked at reference layer), `children` (array of element ids in the same
spec), optional `visible` (array of `$cond` expressions), optional `watch`
(state-path → action invocation).

### 5.5 State namespaces (fixed conventions)

| Path prefix                      | Meaning                                            | Writable by        |
| -------------------------------- | -------------------------------------------------- | ------------------ |
| `/data/<id>`                     | Current value of dataset `<id>` in the route       | Driver only        |
| `/data/__status/<id>`            | `"idle" \| "pending" \| "success" \| "error"`     | Driver only        |
| `/data/__error/<id>`             | Error object `{ code, message, httpStatus }`      | Driver only        |
| `/actions/__status/<id>`         | Same enum, for command actions                    | Driver only        |
| `/actions/__error/<id>`          | Error object                                       | Driver only        |
| `/route/params/<name>`           | Current route's path parameters (read-only)        | Router only        |
| `/form/*`, `/filters/*`, ...     | Free user zone, written by `$bindState` / actions | User components    |

Write attempts from user elements to driver-managed namespaces are rejected
(dev-mode assert; no-op in production).

### 5.6 Scope decisions inside the schema

- `params.*` values are **literal** or a flat `$state` reference. No `$cond`,
  `$template`, `$computed` inside dataset params in MVP (YAGNI). (Component
  props retain full `json-render` expression set.)
- `paramsFromState` values are **flat state paths only** (strings starting
  with `/`), not expressions. This is what makes the consistency layer able
  to type-check them.
- `refetchOn` is a set-literal of `"mount"` / `"params"`. Debounce is
  runtime-level, not per-dataset (deferred).
- A command action's `paramsFromState` must cover every non-optional input
  of its binding; optional inputs may be omitted.
- `navigateTo` placeholders (`:name`) must be covered by `paramsFromState`.

## 6. Data flow

### 6.1 Query flow

1. Route enter: router parses path parameters, seeds `/route/params/*`.
2. For each `route.data[id]`:
   - Read current state for any `$state`-referenced paths in `params`.
   - Set `/data/__status/<id> = "pending"`.
   - Issue `GET <binding.http.path>?<qs>` (same origin, to
     `@rntme/bindings-http`).
   - On success: write result to `/data/<id>`, status to `"success"`.
   - On error: write error to `/data/__error/<id>`, status to `"error"`.
3. If `refetchOn` contains `"params"`: subscribe to the state paths referenced
   in `params`; refetch (with a runtime-level ~150 ms debounce) on change.

### 6.2 Command flow

1. User triggers an element with `action: "<id>"`.
2. Router dispatches to the driver's handler for that action.
3. For `kind: "navigation"`: resolve `navigateTo` placeholders from
   `paramsFromState`, call `router.navigate`.
4. For `kind: "command"`:
   - Read `paramsFromState` values from the state store.
   - Set `/actions/__status/<id> = "pending"`.
   - Issue `POST <binding.http.path>` with JSON body (already matching
     the binding's input shape).
   - On success: status `"success"`; apply `onSuccess`:
     - `clearFormState[*]`: prefix-reset each path in the state store.
     - `refetchData[*]`: re-run the query flow for each referenced dataset.
     - `navigateTo`: resolve + navigate.
   - On error: status `"error"`, error object to `/actions/__error/<id>`
     (the 409/422 mapping from `bindings-http` passes through unchanged).

### 6.3 Navigation flow

Reuses the command flow's navigation sub-case. Router is purely client-side
(history API), no SSR.

### 6.4 Driver

```ts
createUiDriver({
  artifact: ValidatedUiArtifact,
  bindingsHttpBaseUrl: string,          // origin; "" = same origin
  fetch?: typeof globalThis.fetch,       // injectable for tests
  stateStore?: StateStoreAdapter,        // default: built-in
}): {
  Renderer: React.ComponentType;         // wraps json-render <Renderer/>
  router: ClientRouter;
  getHandlers(): ActionHandlers;         // includes built-in setState
  getRegistry(): ComponentRegistry;      // shadcn registry (inlined)
};
```

Key invariant: the driver talks to the backend only via HTTP against the
resolved `binding.http.path`; it never imports `@rntme/bindings-http`. Tests
run both sub-routers in one Hono app and reach the UI through `happy-dom`
JSDOM.

## 7. 4-layer validation

Symmetric to `@rntme/bindings`. All layers aggregate independent errors and
return a single `Result<T, UiError[]>`.

### 7.1 parse

Zod schema for the full artifact: required fields, enum literals
(`version`, action `kind`, `refetchOn`), element shape (`type`/`props`/
`children`), state-path string format.

### 7.2 structural

Internal integrity, no resolvers required:

- Unique route paths; valid path format (starts with `/`, valid `:name`
  placeholders).
- Each spec (layout or page) has a root id that exists in `elements`; no
  orphan elements; all `children` resolve within the same spec.
- If any route references a layout, that layout's spec contains exactly one
  `Slot` element.
- Unique `data[id]` and `actions[id]` within a route.
- Every `action: "X"` referenced inside a route's tree is declared in
  `route.actions` (or is a built-in: `setState`).
- Every `$state: "/data/<id>"` (or `/data/__status/<id>`,
  `/data/__error/<id>`) in the route's tree refers to an `id` present in
  `route.data`; same for `/actions/...`.
- `paramsFromState` values are flat state paths (start with `/`, no
  expressions).
- Navigation actions: placeholders in `navigateTo` covered by keys in
  `paramsFromState`.

### 7.3 references (via resolvers)

Needs `UiResolvers`:

```ts
interface UiResolvers {
  resolveBinding(bindingId: string): ResolvedBinding | undefined;
  resolveComponent(type: string): ResolvedComponent | undefined;
  resolveRoute(path: string): boolean;             // wired against the artifact itself
}

type ResolvedBinding = {
  kind: "query" | "command";
  inputs: Array<{ name: string; type: InputType; mode: InputMode }>;
  outputShape: ResolvedShape;
  http: { method: "GET" | "POST"; path: string };
};

type ResolvedComponent = {
  propsSchema: z.ZodSchema;
  childrenModel: "none" | "list";
};
```

Checks:

- Every `data[id].binding` resolves and has `kind === "query"`.
- Every command action's `binding` resolves and has `kind === "command"`.
- Every element's `type` resolves in the shadcn component resolver.
- Every `layout: "X"` is present in `layouts`.
- Every `navigateTo` (with placeholders expanded as the literal path
  template) is a known route path.

### 7.4 consistency

- For each dataset:
  - Required inputs of the binding are all covered by
    `params` (literal or `$state`).
  - Literal `params.<x>` types match the binding input type.
  - For `$state: "/data/<ds>/<field>"` (json-render slash path syntax):
    look up the dataset's output shape field type and compare with the
    binding input type.
  - For `/form/*` paths: best-effort (warning, not error); fully dynamic.
- For each command action:
  - Required inputs of the binding are covered by `paramsFromState`.
  - Typed state paths (e.g., referencing a dataset field) are type-checked.
- Query bindings with `mode: "root"` or `"predicate_optional"` are rejected
  on UI: UI cannot author predicate sub-graphs.
- Component props referencing `$state: /data/<ds>` are checked for
  shape compatibility (e.g., `Table.rows` expects an array output shape).

### 7.5 Error codes (initial set)

`UI_PARSE_SCHEMA_VIOLATION`, `UI_DUPLICATE_ROUTE_PATH`,
`UI_BAD_PATH_FORMAT`, `UI_MISSING_ROOT`, `UI_ORPHAN_ELEMENT`,
`UI_BAD_CHILD_REF`, `UI_LAYOUT_SLOT_MISSING`, `UI_LAYOUT_SLOT_DUPLICATE`,
`UI_UNKNOWN_ACTION`, `UI_UNKNOWN_DATASET`, `UI_UNKNOWN_LAYOUT`,
`UI_STATE_PATH_UNKNOWN_DATASET`, `UI_STATE_PATH_UNKNOWN_ACTION`,
`UI_UNRESOLVED_BINDING`, `UI_BINDING_KIND_MISMATCH`,
`UI_UNKNOWN_COMPONENT_TYPE`, `UI_UNCOVERED_QUERY_INPUT`,
`UI_UNCOVERED_COMMAND_INPUT`, `UI_TYPE_MISMATCH`,
`UI_UNSUPPORTED_INPUT_MODE`, `UI_NAVIGATION_UNKNOWN_ROUTE`,
`UI_NAVIGATION_PLACEHOLDER_UNBOUND`, `UI_INTERNAL`.

Each error carries `layer`, `code`, `message`, optional `path` (a
dot/jsonpath within the artifact) and optional `hint`.

## 8. Packaging

### 8.1 `packages/ui/` (pure artifact + validator)

```
packages/ui/
├─ package.json              // name: @rntme/ui ; deps: zod
├─ tsconfig.json
├─ src/
│  ├─ index.ts
│  ├─ types/{artifact,resolvers,errors}.ts
│  ├─ parse/{schema,parse}.ts
│  └─ validate/{structural,references,consistency,index}.ts
└─ test/
   ├─ parse.test.ts
   ├─ structural.test.ts
   ├─ references.test.ts
   └─ consistency.test.ts
```

Public exports (symmetric to `@rntme/bindings`):

- `parseUiArtifact`, `UiArtifactSchema`
- `validateStructural`, `validateReferences`, `validateConsistency`,
  `validateUi`
- Types: `UiArtifact`, `UiResolvers`, `ResolvedBinding`,
  `ResolvedComponent`, `ValidatedUiArtifact` (branded), `UiError`,
  `UiErrorCode`, `Layer`
- Helpers: `ok`, `err`, `isOk`, `isErr`, `UI_ERROR_CODES`

### 8.2 `packages/ui-runtime/` (server + client)

```
packages/ui-runtime/
├─ package.json
│     deps: hono, @json-render/core, @json-render/react, @json-render/shadcn,
│           react, react-dom   (+ zustand if we decide to adopt it)
│     peerDeps: @rntme/ui, @rntme/bindings
├─ tsconfig.json
├─ src/
│  ├─ index.ts                 // re-exports server + client
│  ├─ server/
│  │  ├─ index.ts              // createUiApp
│  │  ├─ static-shell.ts
│  │  └─ artifact-route.ts
│  ├─ client/
│  │  ├─ index.ts              // hydrateApp, createUiDriver
│  │  ├─ driver.ts
│  │  ├─ state-store.ts
│  │  ├─ router.ts
│  │  ├─ handlers.ts
│  │  ├─ registry.ts           // inlines @json-render/shadcn catalog
│  │  └─ entry.tsx             // SPA bundle entry
│  └─ resolvers/
│     ├─ from-bindings.ts      // builds UiResolvers.resolveBinding from ValidatedBindings
│     └─ from-shadcn.ts        // builds UiResolvers.resolveComponent from shadcn catalog
├─ build/                       // built by pnpm -F @rntme/ui-runtime build:client (esbuild)
│                                // main.js, main.css are published as package files
└─ test/
   ├─ server.test.ts
   ├─ driver.test.ts
   ├─ router.test.ts
   ├─ state-store.test.ts
   └─ e2e.test.ts
```

Public exports:

- Server: `createUiApp(opts: { artifact: ValidatedUiArtifact; mountPath?: string; bindingsHttpOrigin?: string }): Hono`
- Client: `hydrateApp(opts: { rootSelector: string }): void`, `createUiDriver(opts): UiDriver`
- Resolvers: `buildBindingResolver(validated: ValidatedBindings)`,
  `buildComponentResolver()`

### 8.3 Demo wiring (`demo/issue-tracker-api/`)

- Add `src/ui.ts` exporting `ui: UiArtifact` with at least two routes
  (`/issues`, `/issues/new`). A third route (`/issues/:id`) is a stretch for
  MVP; the spec is compatible with adding it later.
- Add `createUiApp` next to `createApiApp` in `src/server.ts`.
- Add `@rntme/ui`, `@rntme/ui-runtime` to `package.json` dependencies.
- Add `test/e2e.ui.test.ts` covering the UI lifecycle end-to-end (see §9).

## 9. Testing strategy

- `@rntme/ui` (validator): per-layer unit tests with positive and negative
  cases for every structural invariant and every error code. Resolver-based
  tests use fakes.
- `@rntme/ui-runtime` client: isolated driver tests with `fetch` mocks and
  fake timers, router tests, state-store tests. JSDOM via `happy-dom`.
- `@rntme/ui-runtime` server: Hono tests for `GET /ui`, `GET /ui/__artifact.json`,
  `GET /ui/assets/main.js`, SPA fallback for unknown sub-paths.
- End-to-end (both in `@rntme/ui-runtime/test/e2e.test.ts` and a parallel
  `demo/issue-tracker-api/test/e2e.ui.test.ts`): mount `bindings-http` and
  `ui-runtime` on one Hono app, drive the SPA in JSDOM, and walk the
  full cycle — list → navigate to form → fill state → submit → assert
  `clearFormState`, `refetchData`, `navigateTo`, and updated list.
  Error path covers 4xx response and `$cond`-rendered error Alert.
- A golden validation test in `demo/issue-tracker-api`:
  `validateUi(ui, resolvers)` must return `ok: true` in CI (regression gate).

Out of MVP test scope: screenshot/visual regression, real-browser Playwright,
bundle-size budgets.

## 10. MVP scope (summary)

**In:** query flow via route-local `data`, command + navigation actions via
route-local `actions`, one shared layout with a `Slot`, history router with
path params, 4-layer validator, shadcn catalog as-is, `NextAppSpec`-compatible
superset format, loading/error status via reserved state namespaces.

**Out:** auth, optimistic updates, pagination envelope, file upload, toasts,
i18n, SSR, app-level shared data/actions, custom themes, cross-service
composition, WebSockets / streaming, escape-hatch to arbitrary
`json-render` components, custom form-validation DSL.

## 11. Open items and future work

- **Shadcn catalog pinning:** `@rntme/ui-runtime` pins an exact
  `@json-render/shadcn` version. Catalog upgrades land as a separate PR with
  a regression run of golden validations.
- **State store adoption:** start with a minimal in-house reactive store;
  if reactivity / prefix-reset logic grows past ~200 lines, swap to
  `zustand` (or `@json-render/zustand`).
- **Form-field typing from bindings:** the `/form/*` zone is validated
  best-effort today. Future iteration may introduce an explicit
  `forms: { <formId>: { fields: {...} } }` block with binding-derived
  zod schemas. YAGNI for MVP.
- **Per-dataset debounce:** debounce is runtime-level now. If a dataset
  needs a different debounce, the schema can later grow
  `refetchOn: { on: [...], debounceMs }` without breaking existing artifacts.
- **Schema evolution:** `version: "1.0-rc1"` is initial. Break → major;
  additive → optional fields. Codemods live outside the artifact package.
- **Router ambiguity:** the structural layer may later warn when two routes
  overlap (`/issues/:id` vs. `/issues/new`). Today routing resolves by
  specificity order (literal before template); a regression test locks this
  in.
- **`@json-render/next` migration:** the artifact is intentionally shaped as
  a superset of `NextAppSpec` (compatible `metadata` / `layouts` /
  `routes`); a future transformer adapts it to
  `@json-render/next` when SSR becomes a product requirement.
- **LLM authoring prompt:** out of scope for this design. Inputs the prompt
  will rely on (schema text, shadcn catalog, the service's bindings
  artifact) are all emitted by existing packages.
