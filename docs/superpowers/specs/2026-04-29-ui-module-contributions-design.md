# UI Module Contributions — design

**Status:** brainstorming approved, awaiting user review of this spec
**Author:** brainstorm 2026-04-29
**Related:**
- `docs/superpowers/specs/done/2026-04-19-platform-modules-integration-design.md` — backend module pattern (gRPC RPCs, `ExternalAdapterClient`, `pre[]`). This spec adds a parallel UI-contribution surface to the same module unit, without changing backend semantics.
- `docs/superpowers/specs/2026-04-26-modules-monorepo-structure-design.md` — module repo layout, canonical contracts, conformance. UI contributions inherit the same `category`/`vendor`/`contract` pattern; canonical contracts get UI-side fields (component types, operation names) in addition to RPCs and events.
- `docs/superpowers/specs/2026-04-29-notes-demo-auth0-design.md` — Auth0 demo plan with separate `packages/ui-auth-shell/`. **Not modified by this spec.** Auth0 plan executes as written; v2 migration of `ui-auth-shell` into `modules/identity/auth0/client/` under this model is a separate later spec.
- `docs/superpowers/specs/done/2026-04-16-ui-artifact-v2-design.md` — UI artifact v2 (compiled artifact shape, validator phases). Extended here with module-driven component types and a new action kind `module-action`.
- Memories: `rntme_vision_framing`, `project_pre_stable_stage`.

**Implementation locations:**
- Module manifest extension — `packages/module-skeleton/src/manifest-shape.ts` (relax existing schema; add `client` block)
- UI compiler validator — `packages/ui/src/validate/`
- UI runtime registries + hooks + boot orchestrator — `packages/ui-runtime/src/client/`
- Project composition (module discovery, virtual entry generation) — `packages/blueprint/`
- Bundle pipeline — domain-service Dockerfile build step (existing `pnpm build`)
- First UI-only modules — `modules/presentation/md-mermaid/` (new), `modules/presentation/tiptap/` (new)
- First mixed module — `modules/analytics/google-analytics/` (new) demonstrates `boot` + module-level operations
- Implementation plan — `docs/superpowers/plans/2026-04-29-ui-module-contributions.md` (writing-plans next)

## 1. Goal, scope, non-goals

**Goal.** Make a module the unit of UI extension. Adding a new auth provider, payment provider, analytics vendor, rich-text editor, markdown renderer, AI-LLM vendor, or any future client-side capability must be **only** a new module under `modules/<category>/<vendor>/` plus per-project wiring in `project.json`. **No edits to core packages** (`@rntme/ui`, `@rntme/ui-runtime`, `@rntme/blueprint`, `@rntme/contracts-*`) for any new module.

The model is anchored on three concrete first-shot use cases:

1. **MD/Mermaid module** — purely client-side, no backend, no canonical contract. Registers two component types (`<Markdown>`, `<Mermaid>`). The simplest possible UI module.
2. **Tiptap module** — stateful component (`<RichTextEditor>`) with imperative toolbar operations (`toggleBold`, `toggleItalic`, `insertImage`). Demonstrates component-bound operations.
3. **Analytics module (Google Analytics)** — `boot(ctx)` for SDK init + lifecycle subscriptions; module-level operations (`track`, `identify`); canonical contract `analytics/v1` (so `@rntme/analytics-amplitude` is one-line swap in `project.json`). Demonstrates non-component module logic.

A fourth illustrative case (auth0, AI streaming) is described to verify the model handles them — auth0 via state-gated rendering with `<SignIn />` as a regular component; AI streaming via stateful component with operations (same shape as tiptap). Neither requires a new core primitive.

**In scope:**

1. Module manifest extension: `client.components[]`, `client.operations[]`, `client.boot`, `client.config.schema`. Relax `category`/`contract`/`capabilities.rpcs` to optional so UI-only modules are valid.
2. `ModuleBootContext` interface: `config`, `state` (read/write/subscribe), `transport.use(mw)`, `on(event, h)` for app lifecycle, `registerOperation(name, h)` for module-level ops.
3. New action kind `module-action` in `@rntme/ui` (compile + validate) and `@rntme/ui-runtime` (driver dispatch). Supports component-bound (`target: "<elementId>"`) and module-level (`module: "..."` or `category: "..."`) addressing.
4. `useTransport()`, `useStateStore()`, `useOperationRegistry()` hooks exported from `@rntme/ui-runtime/client`.
5. Per-component-instance operation registry (component self-registers its operations on mount).
6. Project compose step in `@rntme/blueprint`: read `project.json#modules`, fetch each `module.json`, build a union of component types + operation names + boot-modules; pass to UI validator and to the virtual-entry generator.
7. Auto-generated virtual entry file for SPA bundling; bundling runs in domain-service Dockerfile (existing `pnpm build` is extended).
8. State-gated auth: identity modules write `/auth/status` and `/currentUser`; project's root layout uses existing `visible` to gate `<Slot />` between login chrome and app body.
9. UI driver gating rule: data-bindings whose root layout/screen element is `visible:false` do not fetch.
10. Minor `visible` evaluator extension in `@rntme/ui`: support `eq` and `contains` operators in addition to truthiness check (needed for role-based RBAC and for `/auth/status` matching).
11. Canonical UI contracts: extend the canonical-contract directory shape to carry `client.componentTypes[]` and `client.operations[]` alongside `rpcs[]`/`events[]` for canonical UI categories (analytics, identity-ui, ai-llm, rich-text). MD/Mermaid stays uncanonicalized for now (only one impl).
12. First UI-only modules implemented: `modules/presentation/md-mermaid/` and `modules/presentation/tiptap/`.
13. First mixed module implemented: `modules/analytics/google-analytics/`.
14. Documentation touch: `AGENTS.md` §3/§6/§10 updates; `README.md` packages-table update; per-package READMEs for `@rntme/ui`, `@rntme/ui-runtime`, `@rntme/blueprint`, `@rntme/module-skeleton`.

**Out of scope (separate specs):**

- Server-side streaming bindings (`kind: "stream"` in `bindings.json`, SSE/fetch-stream surface in `bindings-http`, gRPC streaming proxy). Required for the AI-LLM end-to-end use case but is server-side machinery, parallel to this UI work. Will be its own spec when AI demo is planned.
- Migration of existing `packages/ui-auth-shell/` into `modules/identity/auth0/client/`. The Auth0 demo plan continues to use the separate-package shape; v2 migration is a follow-up spec.
- Module-owned routes / full screens (axis A2 from the brainstorm taxonomy). No current use case demands it.
- Module-owned PDM/QSM (sub-blueprint shape). Not required by any v1 use case; would conflict with single-event-store invariants.
- Dynamic runtime module loading (module federation / dynamic-import bundles). v1 uses static esbuild bundling; modules ship TS via workspace symlinks. Dynamic loading is heavy infra and unjustified at pre-revenue scale.
- Conditional rendering DSL beyond `eq`/`contains` operators. Expression-level `visible` (e.g., `$expr` evaluator that consumes role lists, dates, etc.) is a future improvement; out of scope here.
- Live-conformance suite for UI modules. Mock-conformance only in v1 (component renders with given props; operations dispatch correctly).

**Non-goals.** This spec does not invent any new way to author screens, fragments, layouts, or bindings. The compiled-artifact shape from `2026-04-16-ui-artifact-v2-design.md` is unchanged. JSON-render's component contract is unchanged (modules ship React components; json-render renders them). What changes is *what is in the catalog*, *what action kinds the driver knows*, and *what runs at boot*.

## 2. Decisions matrix

| # | Question | Decision |
|---|---|---|
| Q1 | Auth0 plan rebalance vs new mechanism in parallel? | **B — parallel.** Auth0 plan executes as written. New module-contribution mechanism is for AI/MD/etc.; Auth0 migrates to it later. |
| Q2 | Manifest props validation: declarative (compile-time) or runtime-only? | **Declarative (1a).** `client.components[].props` carries types and required flags so UI validator catches mistakes before bundle build. Aligns with project's "validators layered, fail fast" principle. |
| Q3 | Module package shape | **Workspace package (2a).** Each module is a `pnpm` workspace package with `package.json`. Imports work as `@rntme/<name>/client`. Same convention as backend modules. |
| Q4 | Bundle build location | **Domain-service Dockerfile (a).** Existing `pnpm build` step in the service's image extends to: generate virtual entry from `project.json` → run esbuild → emit per-project `build/main.js`. Platform unchanged. |
| Q5 | Module client → runtime contract | **Convention (a).** Each component declared in `module.json` is a named export from `client.entry`. Host's auto-generated virtual entry imports them by name and merges into the catalog. Single source of truth = manifest. |
| Q6 | How module operations connect to component instances | **α — component self-registration.** Component on mount registers its operations under its `elementId` via `useOperationRegistry().register(elementId, handlers)`. Because `@json-render/react` does not expose the element map key to components today, rntme injects a reserved prop such as `__rntmeElementId` before render. Manifest stays declarative (for validate); registration logic lives next to the editor instance (closure over imperative API). No `module.exports.operations`, no command-bus. |
| Q7 | App lifecycle hooks (init SDK, page-view tracking, identify on login) | **`boot(ctx)` per module.** Module declares `client.boot: true`, exports `boot(ctx)`. Host runs all boots before mount. `ctx` exposes config, state, transport.use, on(event), registerOperation. |
| Q8 | Module-level operations vs component-bound | **Both, unified.** `client.operations[]` carries optional `appliesTo: [componentType, ...]`. If present → component-bound (dispatch requires `target`). If absent → module-level (registered in boot via `ctx.registerOperation`). Single `kind: "module-action"` covers both. |
| Q9 | Action composition (track + save on one click) | **Existing json-render binding arrays.** Current specs use `on: { press: { "action": "dispatch", "params": { "name": "save" } } }`; json-render already supports arrays of those binding objects and runs them sequentially. Do not introduce `"on": { "click": ["trackSave", "save"] }` action-id strings. |
| Q10 | Vendor swap (GA → Amplitude, Auth0 → Clerk) | **Canonical-contract pattern, extended to UI.** `module.json` declares `category` + `contract`. `project.json#modules` maps category keys to `{ "package": "...", "publicConfig": {...} }`. Blueprint `module-action` actions reference `category: "..."` (canonical) when there's a contract; `module: "..."` when not (singleton vendors like tiptap). Swap = one package line in `project.json`. |
| Q11 | Auth gating: wrapper component or state-gated? | **State-gated.** Identity module writes `/auth/status: 'booting' \| 'anon' \| 'authed'` via `boot(ctx)`. Identity module also registers `<SignIn />` (or vendor-specific equivalent) as a regular `client.components[]` element. Project's root layout uses existing json-render `visible` to gate the app body slot vs login chrome. **No `wrapper` slot in manifest.** |
| Q12 | What prevents data-bindings from firing during anon phase | **Driver gating rule.** `@rntme/ui-runtime` driver does not run `enterScreen` data-fetches for screens whose root layout has `visible:false` (because it's gated by `/auth/status`). Same rule covers any future case where layout is hidden. |
| Q13 | RBAC for UI controls (hide Edit / Delete / Admin) | **No new module primitive.** Use existing `visible` field reading from state. `/currentUser` (set by identity module) covers "anon vs authed". Per-row `canX` flags returned by server queries cover ownership/role-based hiding. Add `eq` and `contains` operators to `visible` evaluator (one-line cases need it). |
| Q14 | How analytics/auth/identity dispatch their operations from screens | **Same `kind: "module-action"`.** No special-casing per category. Module-level ops require `module:` or `category:` field; component-bound ops require `target:` element ID. Validator branches on which is present. |
| Q15 | Multiple modules with `boot` — ordering | **Manifest list order in `project.json#modules`.** Topological sort by `dependsOn` is reserved as a future addition; for v1 the order is the explicit ordering in `project.json` (an object, but consumed deterministically). Two-boot conflicts (e.g., two modules both calling `transport.use`) compose left-to-right. |
| Q16 | Multiple modules registering same component name | **`BLUEPRINT_DUPLICATE_COMPONENT` error at compose.** Compose step union-merges component declarations from all modules; collisions on `type` are rejected. |
| Q17 | Module manifest minimum requirements | **One of `client` or `capabilities` must be non-empty.** UI-only modules (MD/Mermaid) have only `client`; backend-only modules (today's auth0 server-side) have only `capabilities`; mixed modules (analytics + GA) have both. `category`/`contract`/`vendor` optional for UI-only without canonical contract; required when `category` is one with a canonical contract. |
| Q18 | AI streaming: `kind: "stream"` action vs `kind: "stream"` data-binding (R4 vs R6 from brainstorm taxonomy) | **Neither — implementation detail of stateful component.** AI module ships `<ChatInterface>` and `<TokenStream>` components; streaming logic + AbortController live inside the component; component exposes `send`/`stop`/`regenerate` as component-bound operations. Same model as tiptap. No new action kind. **Server-side streaming binding is its own out-of-scope concern.** |

## 3. End-to-end flows

### 3.1 Project compose with modules

```
project.json#modules = {
  "presentation-md":  { "package": "@rntme/presentation-md-mermaid" },
  "presentation-rte": { "package": "@rntme/presentation-tiptap" },
  "analytics":        { "package": "@rntme/analytics-google-analytics",
                        "publicConfig": { "measurementId": "G-XXXXXXX" } }
}
        |
        v
@rntme/blueprint compose:
  for each module package:
    read module.json
    collect:
      client.components[]      → componentRegistry: { Markdown, Mermaid, RichTextEditor, T, ChatInterface, ... }
      client.operations[]      → operationRegistry: { name → { appliesTo?, params, source: { module, category } } }
      client.boot              → bootList:          [ "@rntme/analytics-google-analytics", ... ]
      client.config.schema     → publicConfigSchema: { "@rntme/analytics-google-analytics": { measurementId: { string, required } } }
  reject if duplicate component types or conflicting category mappings
        |
        v
@rntme/ui validate:
  every screen.spec uses only registered component types  → otherwise UI_UNKNOWN_COMPONENT
  every component instance has all required props bound   → otherwise UI_PROP_REQUIRED_MISSING
  every action with kind=module-action resolves to a known operation → otherwise UI_MODULE_ACTION_NOT_FOUND
    if target: exists, type matches operation.appliesTo  → otherwise UI_MODULE_ACTION_TARGET_TYPE_MISMATCH
    if module/category: operation is module-level (no appliesTo) → otherwise UI_MODULE_ACTION_NEEDS_TARGET
  every action.params satisfies operation.params schema   → otherwise UI_MODULE_ACTION_PARAM_INVALID
        |
        v
@rntme/ui emit:
  produces CompiledArtifact (unchanged shape) + sidecar
    catalogManifest = { components: [...], operations: [...], modulesWithBoot: [...] }
        |
        v
domain-service Dockerfile build step:
  generate srv/__rntme_ui_entry.ts   from catalogManifest + project.json#modules
  esbuild srv/__rntme_ui_entry.ts → build/main.js
  emit /srv/config.json             from project.json#modules[*].publicConfig
```

### 3.2 SPA boot at runtime

```
SPA loads → main.js executes
        |
        v
hydrateApp({ rootSelector, components, modules }):
  1. fetch /config.json                           → publicConfig per module
  2. fetch /_manifest.json                        → routing manifest (unchanged)
  3. construct runtime registries:
       componentCatalog = { ...shadcn, ...modules.components }
       operationRegistry: ScopedRegistry<elementId|moduleId, OpHandlers>
       transportChain    = [ baseFetch ]
       lifecycleBus      = EventBus()
  4. for each module with boot in declared order (project.json#modules order):
       call module.boot({
         config: publicConfig[moduleName],
         state: storeApi,
         transport: { use(mw) { transportChain.unshift(mw); } },
         on: lifecycleBus.on,
         registerOperation: (name, h) => operationRegistry.registerModule(moduleName, name, h)
       })
       boots are awaited in sequence; one rejected boot fails the app start
  5. wire driver to use composed transport (transportChain reduced fn) and lifecycleBus
  6. mount AppShell with currentRoute from history
  7. AppShell composes catalog + operationRegistry into json-render providers
```

### 3.3 State-gated login (Auth0 example, v2 migration target — illustrative only here)

Layout:

```jsonc
// services/app/ui/layouts/main.spec.json
{
  "root": "shell",
  "elements": {
    "shell":      { "type": "Stack", "children": ["loginCard", "appBody"] },
    "loginCard":  { "type": "Card", "children": ["title", "signin"],
                    "visible": { "$state": "/auth/status", "eq": "anon" } },
    "title":      { "type": "Heading", "props": { "text": "Welcome" } },
    "signin":     { "type": "SignIn" },
    "appBody":    { "type": "Slot",
                    "visible": { "$state": "/auth/status", "eq": "authed" } }
  }
}
```

Identity module's boot:

```ts
export function boot(ctx) {
  const { config, transport, state, registerOperation, on } = ctx;
  const client = await createAuth0Client({ ...config });

  state.set('/auth/status', 'booting');

  if (location.search.includes('code=')) {
    await client.handleRedirectCallback();
    history.replaceState({}, '', '/');
  }
  if (await client.isAuthenticated()) {
    const c = await client.getIdTokenClaims();
    state.set('/currentUser', { sub: c.sub, email: c.email, name: c.name });
    state.set('/auth/status', 'authed');
  } else {
    state.set('/auth/status', 'anon');
  }

  transport.use(async (req, next) => {
    const tok = await client.getTokenSilently().catch(() => null);
    if (tok) req.headers.set('authorization', `Bearer ${tok}`);
    return next(req);
  });

  on('action:failed', ({ status }) => {
    if (status === 401) { state.set('/auth/status', 'anon'); state.set('/currentUser', null); }
  });

  registerOperation('login',  () => client.loginWithRedirect());
  registerOperation('logout', () => client.logout({ logoutParams: { returnTo: config.redirectUri } }));
}
```

Driver gating: while `/auth/status === 'anon'`, the `appBody` slot is hidden. The driver does not call `enterScreen` data fetches for screens routed under that slot; it does fetch for screens routed under the visible `loginCard` (which is the `<SignIn />` component — has its own internal logic, no data binding).

### 3.4 Tiptap edit-and-save (component-bound operations)

Layout (the screen author writes this, not the module):

```jsonc
// services/app/ui/screens/edit-note.spec.json
{
  "root": "form",
  "elements": {
    "form":    { "type": "Stack", "children": ["toolbar", "editor", "saveBtn"] },
    "toolbar": { "type": "Toolbar", "children": ["bBtn", "iBtn", "imgBtn"] },
    "bBtn":    { "type": "Button", "props": { "label": "B" },
                 "on": { "press": { "action": "dispatch", "params": { "name": "bold" } } } },
    "iBtn":    { "type": "Button", "props": { "label": "I" },
                 "on": { "press": { "action": "dispatch", "params": { "name": "italic" } } } },
    "imgBtn":  { "type": "Button", "props": { "label": "Image" },
                 "on": { "press": { "action": "dispatch", "params": { "name": "image" } } } },
    "editor":  { "type": "RichTextEditor", "props": { "value": { "$state": "/form/body" } } },
    "saveBtn": { "type": "Button", "props": { "label": "Save" },
                 "on": { "press": [
                   { "action": "dispatch", "params": { "name": "trackSave" } },
                   { "action": "dispatch", "params": { "name": "save" } }
                 ] } }
  }
}
```

```jsonc
// edit-note.screen.json
{
  "data":   { "/form/body": { "binding": "getNote", "params": { "id": { "$state": "/route/params/id" } } } },
  "actions": {
    "bold":      { "kind": "module-action", "target": "editor", "name": "toggleBold" },
    "italic":    { "kind": "module-action", "target": "editor", "name": "toggleItalic" },
    "image":     { "kind": "module-action", "target": "editor", "name": "insertImage",
                   "params": { "url": { "$state": "/form/imageUrl" } } },
    "trackSave": { "kind": "module-action", "category": "analytics", "name": "track",
                   "params": { "event": "note_saved", "props": { "noteId": { "$state": "/route/params/id" } } } },
    "save":      { "kind": "command", "binding": "updateNote",
                   "paramsFromState": { "id": "/route/params/id", "body": "/form/body" } }
  }
}
```

Driver dispatch on `bold` click:

```
driver.dispatch("bold")
  → action = { kind: "module-action", target: "editor", name: "toggleBold" }
  → operationRegistry.lookup("editor", "toggleBold")
  → handler = (registered by RichTextEditor's useEffect on mount) closure over editor instance
  → handler({}) → editor.chain().focus().toggleBold().run()
```

Driver dispatch on `saveBtn` press (json-render binding-array form):

```
json-render executes the two `dispatch` bindings sequentially
  → trackSave: module-action category=analytics name=track → operationRegistry.lookup("@rntme/analytics-google-analytics", "track") → window.gtag(...)
  → save: command → bindings-http POST /api/notes/<id> with body
```

### 3.5 Analytics module-level boot + operation

`module.json`:

```jsonc
{
  "name": "@rntme/analytics-google-analytics",
  "version": "0.0.0",
  "category": "analytics",
  "vendor": "google-analytics",
  "contract": "analytics/v1",
  "client": {
    "entry": "./client/index.ts",
    "boot": true,
    "config": {
      "schema": { "measurementId": { "type": "string", "required": true } }
    },
    "operations": [
      { "name": "track",
        "params": { "event": { "type": "string", "required": true },
                    "props": { "type": "object", "required": false } } },
      { "name": "identify",
        "params": { "userId": { "type": "string", "required": true },
                    "traits": { "type": "object", "required": false } } }
    ],
    "components": []
  }
}
```

`client/index.ts`:

```ts
import type { ModuleBootContext } from '@rntme/ui-runtime/client';

export function boot(ctx: ModuleBootContext) {
  const { config, state, on, registerOperation } = ctx;
  loadGAScript(config.measurementId);
  on('navigate', ({ path }) => window.gtag('event', 'page_view', {
    page_location: new URL(path, window.location.origin).toString(),
    page_path: path
  }));
  state.subscribe('/currentUser', (u) => {
    if (u?.sub) window.gtag('config', config.measurementId, { user_id: u.sub });
    else window.gtag('config', config.measurementId, { user_id: null });
  });
  registerOperation('track',    ({ event, props }) => window.gtag('event', event, props ?? {}));
  registerOperation('identify', ({ userId, traits }) => window.gtag('config', config.measurementId, { user_id: userId, ...(traits ?? {}) }));
}
```

Implementation note: the GA module must initialize the tag with `send_page_view: false`, then emit SPA navigations explicitly from the `navigate` lifecycle event. `user_id` must be a non-PII application identifier; send `null` on sign-out.

## 4. Module manifest extension

### 4.1 Schema diff

Existing `ModuleManifestSchema` (in `packages/module-skeleton/src/manifest-shape.ts`) requires `category`, `vendor`, `contract`, `capabilities.rpcs[]`, `capabilities.events[]`. Diff:

- **Optional now:** `category`, `vendor`, `contract`. Required only when the module declares a server-side gRPC surface OR claims canonical-contract membership. UI-only singletons (MD/Mermaid, tiptap initially) omit them.
- **Optional now:** `capabilities.rpcs[]`, `capabilities.events[]`, `grpcServiceName`, `webhookPath`, `secrets[]`. Whole `capabilities` block is optional for UI-only modules.
- **New top-level field `client`** — UI contribution surface. Optional; omit for backend-only modules.
- **Validation rule:** at least one of `client` or `capabilities` is required and non-empty. A manifest with neither is `MODULE_MANIFEST_EMPTY`.

### 4.2 `client` block

```ts
type ClientBlock = {
  entry: string;                             // path relative to module root, e.g. "./client/index.ts"
  boot?: boolean;                            // default false; when true, entry exports `boot(ctx)`
  bootTimeoutMs?: number;                    // default 10000; per-module timeout for boot()
  config?: {                                 // public config required by this module
    schema: Record<string, PropSchema>;      // values flow into /config.json under module's name
  };
  components?: ComponentDeclaration[];       // default []
  operations?: OperationDeclaration[];       // default []
};

type ComponentDeclaration = {
  type: string;                              // unique within the project, e.g. "Markdown"
  props: Record<string, PropSchema>;         // declarative; used for compile-time validate
};

type OperationDeclaration = {
  name: string;                              // unique within the module
  appliesTo?: string[];                      // component types; absent → module-level
  params?: Record<string, PropSchema>;       // schema for action params
};

type PropSchema = {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required?: boolean;                        // default false
  array?: boolean;                           // default false; element type from `type`
};
```

### 4.3 Validation

`parseModuleManifest(raw)` validations:

| Code | Condition |
|---|---|
| `MODULE_MANIFEST_INVALID` | JSON parse failure or root shape wrong |
| `MODULE_MANIFEST_EMPTY` | Both `capabilities` and `client` absent or both empty |
| `MODULE_MANIFEST_CLIENT_ENTRY_MISSING` | `client` present but `client.entry` missing |
| `MODULE_MANIFEST_DUPLICATE_COMPONENT` | Two entries in `client.components[]` with same `type` |
| `MODULE_MANIFEST_DUPLICATE_OPERATION` | Two entries in `client.operations[]` with same `name` |
| `MODULE_MANIFEST_OPERATION_BAD_APPLIES_TO` | `appliesTo[]` contains a `type` not in this module's `client.components[]` |
| `MODULE_MANIFEST_CATEGORY_REQUIRES_CONTRACT` | `category` set without `contract` (or vice versa) |
| `MODULE_MANIFEST_VENDOR_REQUIRED` | `category` + `contract` set without `vendor` |

Cross-module validation (in `@rntme/blueprint` compose) below.

## 5. ModuleBootContext

Exported from `@rntme/ui-runtime/client`.

```ts
export type ModuleBootContext = {
  /** Public config slice for this module from /config.json. Validated against client.config.schema before boot runs. */
  config: Record<string, unknown>;

  /** State-store accessor. */
  state: {
    get(path: string): unknown;
    set(path: string, value: unknown): void;
    subscribe(path: string, handler: (value: unknown) => void): Unsubscribe;
  };

  /** fetch transport composition. Middleware runs in registration order; later middleware wraps earlier. */
  transport: {
    use(middleware: TransportMiddleware): void;
  };

  /** Lifecycle event subscription. */
  on: {
    (event: 'navigate',          h: (e: { path: string; params: Record<string, string> }) => void): Unsubscribe;
    (event: 'action:dispatched', h: (e: { actionId: string; kind: string; params: Record<string, unknown> }) => void): Unsubscribe;
    (event: 'action:succeeded',  h: (e: { actionId: string; kind: string; result: unknown }) => void): Unsubscribe;
    (event: 'action:failed',     h: (e: { actionId: string; kind: string; status?: number; error: unknown }) => void): Unsubscribe;
  };

  /** Register a module-level operation (no component target). */
  registerOperation(name: string, handler: (params: Record<string, unknown>) => void | Promise<void>): void;
};

export type TransportMiddleware = (
  req: Request,
  next: (req: Request) => Promise<Response>
) => Promise<Response>;

export type Unsubscribe = () => void;
```

Boot lifecycle:

1. Host loads `/config.json`, validates each module's slice against `client.config.schema`.
2. Host calls `module.boot(ctx)` for each module with `client.boot: true` in `project.json#modules` order. Boots are awaited in sequence (not parallel) — earlier modules' transport middleware and state writes are observable to later boots.
3. Any boot that throws or returns a rejected promise fails the SPA bootstrap; the host renders a generic error page.
4. After all boots complete, the host mounts `AppShell`.

## 6. Operation registry

Two layers:

- **Module-level handlers**: registered in `boot(ctx)` via `ctx.registerOperation(name, h)`. Keyed by `(moduleName, name)`.
- **Component-bound handlers**: registered in component `useEffect` via `useOperationRegistry().register(elementId, handlers)`. Keyed by `(elementId, name)`. Returns an unregister function called on unmount. rntme injects the authored element key as a reserved prop such as `__rntmeElementId` before passing specs to json-render.

Hook:

```ts
export function useOperationRegistry(): {
  register(elementId: string, handlers: Record<string, (params: Record<string, unknown>) => void | Promise<void>>): Unregister;
};
```

Dispatch (in driver):

```ts
function dispatchModuleAction(action: CompiledModuleAction, params: Record<string, unknown>) {
  if (action.target) {
    const handlers = registry.lookupComponent(action.target);
    if (!handlers || !handlers[action.name]) throw new RuntimeError('UI_MODULE_ACTION_TARGET_NOT_REGISTERED', { ... });
    return handlers[action.name](params);
  }
  // module-level — `module` is always present at this point because compile time
  // already resolved any `category` reference into a concrete module package name.
  const handler = registry.lookupModule(action.module!, action.name);
  if (!handler) throw new RuntimeError('UI_MODULE_ACTION_MODULE_NOT_REGISTERED', { ... });
  return handler(params);
}
```

The runtime never sees `category` directly: `@rntme/ui`'s emit phase resolves every action's `category` to the concrete module package name from `project.json#modules` and stores `module` in the compiled artifact. If the category has no mapping, validate raises `UI_CATEGORY_NOT_MAPPED` and emit never happens.

## 7. Action kind `module-action`

### 7.1 Source format

Extend `ActionDef` in `packages/ui/src/types/source.ts`:

```ts
type ActionDef =
  | { kind: 'navigation';  navigateTo: string; paramsFromState?: Record<string, string> }
  | { kind: 'command';     binding: string; paramsFromState?: Record<string, string>; onSuccess?: ...; onError?: ... }
  | { kind: 'refetch';     targets: string[] }
  | { kind: 'module-action';
      target?: string;                                  // element ID for component-bound
      module?: string;                                  // module name for module-level (mutually exclusive with category)
      category?: string;                                // canonical category for module-level
      name: string;                                     // operation name
      params?: Record<string, string | number | boolean | { $state: string }>;
      onSuccess?: { showAlert?: string; navigateTo?: string };
      onError?:   { showAlert?: string };
    };
```

### 7.2 Validate (references layer)

| Code | Condition |
|---|---|
| `UI_MODULE_ACTION_NEEDS_TARGET_OR_MODULE` | Neither `target` nor `module`/`category` set |
| `UI_MODULE_ACTION_AMBIGUOUS_ADDRESSING` | More than one of `target`/`module`/`category` set |
| `UI_MODULE_ACTION_TARGET_MISSING` | `target` references an `elementId` not in the spec |
| `UI_MODULE_ACTION_TARGET_TYPE_MISMATCH` | Target element's `type` is not in operation's `appliesTo[]` |
| `UI_UNKNOWN_OPERATION` | Operation `name` not registered by any module in the project (or by addressed module/category) |
| `UI_MODULE_ACTION_NEEDS_TARGET` | Operation has `appliesTo` but action lacks `target` |
| `UI_MODULE_ACTION_NEEDS_MODULE` | Operation has no `appliesTo` (module-level) but action lacks `module`/`category` |
| `UI_MODULE_ACTION_PARAM_REQUIRED` | A required param from operation schema is missing |
| `UI_MODULE_ACTION_PARAM_TYPE_MISMATCH` | A param value doesn't match its declared type (literal-side check; `$state` references pass through) |
| `UI_CATEGORY_NOT_MAPPED` | Action references `category: "X"` but `project.json#modules` has no entry for `X` |

### 7.3 Compiled shape

```ts
type CompiledAction =
  | { kind: 'navigation'; ... }
  | { kind: 'command';    method: 'POST'; path: string; ... }
  | { kind: 'refetch';    targets: string[] }
  | { kind: 'module-action';
      target?: string;
      module?: string;                                  // canonicalized: category resolved to module name at compile
      name: string;
      params?: ParamMap;
      onSuccess?: ...;
      onError?:   ...;
    };
```

Note: at compile time, `category` is resolved to the concrete module name from `project.json#modules`. The compiled artifact carries `module` only (no `category`), so the driver doesn't need the project-modules map at runtime for resolution.

### 7.4 Spec format for `on`

Current rntme UI specs use json-render action binding objects:

```jsonc
{
  "on": {
    "press": { "action": "dispatch", "params": { "name": "save" } }
  }
}
```

Composition uses json-render's existing array form, not action-id strings:

```jsonc
{
  "on": {
    "press": [
      { "action": "dispatch", "params": { "name": "trackSave" } },
      { "action": "dispatch", "params": { "name": "save" } }
    ]
  }
}
```

`expand` and `validate` preserve this shape; runtime driver dispatches sequentially through json-render's existing binding-array execution. Failures in array dispatch follow first-fails-aborts-remaining unless an explicit catch is wired (out of scope).

## 8. `visible` evaluator extension

Current `visible` field on elements (per json-render) accepts `{ $state: "<path>" }` and treats the value as a JS truthy/falsy. Extension to support `eq` and `contains`:

```ts
type Visible =
  | { $state: string }                             // existing — truthy check
  | { $state: string; eq:       unknown }
  | { $state: string; contains: unknown }
  | { $state: string; not: true };                 // negation of truthy — useful and cheap
```

`$state` evaluates to value at path; `eq` compares deep-equal; `contains` is membership for arrays/strings. Anything else → `UI_VISIBLE_OPERATOR_UNKNOWN`. The validator's reference layer covers `$state` path coverage as before; the new operators are documented in the structural layer.

## 9. Driver gating rule (data-bindings respect `visible`)

In `packages/ui-runtime/src/client/driver.ts`'s `enterScreen`:

```
For each screen entered:
  resolve current root layout
  evaluate root layout's visible (if present) against current state
  if false:
    skip data fetches for both layout and screen
    leave /data/__status* and /data/__error* clean
  if true:
    proceed with current behavior
```

The gating is reactive: when `/auth/status` flips from `anon` → `authed`, the layout visibility re-evaluates, and a state-subscriber in `entry.tsx` re-runs `enterScreen` for the current route. The `loginCard` (visible during anon) is its own layout/screen entry and fetches independently.

## 10. Bundle pipeline

### 10.1 Project compose output

`@rntme/blueprint`'s compose step emits, alongside the existing artifacts, a `catalogManifest.json`:

```jsonc
{
  "components": [
    { "type": "Markdown",        "module": "@rntme/presentation-md-mermaid",   "props": { ... } },
    { "type": "Mermaid",         "module": "@rntme/presentation-md-mermaid",   "props": { ... } },
    { "type": "RichTextEditor",  "module": "@rntme/presentation-tiptap",       "props": { ... } }
  ],
  "operations": [
    { "name": "track",       "module": "@rntme/analytics-google-analytics",       "appliesTo": null,                    "category": "analytics" },
    { "name": "toggleBold",  "module": "@rntme/presentation-tiptap",              "appliesTo": ["RichTextEditor"],      "category": null }
  ],
  "modulesWithBoot": [
    "@rntme/analytics-google-analytics"
  ],
  "categoryToModule": {
    "analytics": "@rntme/analytics-google-analytics"
  }
}
```

This file feeds:
- The UI compiler validator (passes union as `resolveComponent` and operation lookup table).
- The Dockerfile build step (drives virtual entry generation).

### 10.2 Virtual entry generation

In the domain-service Dockerfile, **before** `pnpm build`, a small node script (lives in `@rntme/blueprint` or a sibling tool) reads `catalogManifest.json` and writes `srv/__rntme_ui_entry.ts`:

```ts
// auto-generated; do not edit
import { hydrateApp, type ModuleSpec } from '@rntme/ui-runtime/client';

import * as mod_md from '@rntme/presentation-md-mermaid/client';
import * as mod_tiptap from '@rntme/presentation-tiptap/client';
import * as mod_ga from '@rntme/analytics-google-analytics/client';

const components = {
  Markdown:        mod_md.Markdown,
  Mermaid:         mod_md.Mermaid,
  RichTextEditor:  mod_tiptap.RichTextEditor
};

const modules: ModuleSpec[] = [
  { name: '@rntme/analytics-google-analytics', boot: mod_ga.boot }
];

hydrateApp({ rootSelector: '#root', components, modules });
```

### 10.3 Bundling

`pnpm build` in the domain service runs:

1. `@rntme/ui` compile → `CompiledArtifact` + `catalogManifest.json` in `srv/ui-build/`.
2. Virtual entry generator → `srv/__rntme_ui_entry.ts`.
3. `esbuild srv/__rntme_ui_entry.ts → srv/ui-build/main.js` (existing options preserved: ESM, browser, es2022, CSS as `empty`).
4. Tailwind CLI scans `srv/ui-build/main.js` → `srv/ui-build/main.css` (existing).

`@rntme/ui-runtime`'s `createApp({ artifact, assetsDir })` is called with `assetsDir = 'srv/ui-build'`. The HTTP server serves `main.js` and `main.css` from there.

### 10.4 `/config.json`

For this v1 plan, `@rntme/blueprint` compose reads `project.json#modules[<key>].publicConfig`, validates it against each module's `client.config.schema`, and emits the public config next to the UI build artifacts. A deploy adapter may later project the same data into `/srv/config.json`, but this spec must not depend on unmerged `rntme-cli` deployment changes. The runtime serves the generated config as a non-bindings, non-auth route.

Shape:

```jsonc
{
  "@rntme/analytics-google-analytics": { "measurementId": "G-XXXXXX" },
  "@rntme/identity-auth0":             { "domain": "...", "clientId": "...", "audience": "...", "redirectUri": "..." }
}
```

The shell loads `/config.json` once at boot and validates each slice against the corresponding `client.config.schema` before passing to `boot(ctx)`.

## 11. Compose-level validation

In `@rntme/blueprint` after collecting modules:

| Code | Condition |
|---|---|
| `BLUEPRINT_MODULE_NOT_FOUND` | `project.json#modules` references a package that doesn't resolve in the workspace |
| `BLUEPRINT_DUPLICATE_COMPONENT` | Two modules declare same component `type` |
| `BLUEPRINT_CATEGORY_AMBIGUOUS` | A `category` resolves to two different modules in `project.json#modules` |
| `BLUEPRINT_CATEGORY_NOT_DECLARED` / `BLUEPRINT_CATEGORY_MISMATCH` | Module declares `category` but is mapped to a different category key in `project.json#modules` |
| `BLUEPRINT_CONFIG_REQUIRED_MISSING` | A module's `client.config.schema` requires a key not present in `project.json#modules[<key>].publicConfig` |
| `BLUEPRINT_CONFIG_TYPE_MISMATCH` | A config value doesn't match its declared type |

## 12. Component changes summary

| # | Package | Δ | Change |
|---|---|---|---|
| 1 | `@rntme/module-skeleton` | S | Relax `ModuleManifestSchema`: `category`/`vendor`/`contract`/`capabilities.*` optional. Add `client` block schema. New error codes per §4.3. New tests for UI-only manifest, mixed manifest, empty manifest. |
| 2 | `@rntme/ui` | M | Extend `ActionDef` with `module-action`. Extend `validate/structural.ts` for the new kind. Extend `validate/references.ts` for component target/operation/category lookups. Extend `validate/structural.ts` for `eq`/`contains` operators in `visible`. Extend `emit/http-map.ts` to canonicalize `category` → `module` and pass through `module-action` shape. New error codes per §7.2. New `ValidateResolvers` field `resolveOperation`. `resolveComponent` (currently unused) becomes load-bearing. |
| 3 | `@rntme/ui-runtime` | L | Export `useTransport`, `useStateStore`, `useOperationRegistry` hooks from `client/`. New `boot` orchestrator in `entry.tsx`. New `ModuleBootContext` type. Driver dispatcher for `kind: "module-action"` through the existing json-render `dispatch` action. Driver gating rule for hidden layouts (data-fetch skip). State subscription mechanism wired to layout-visibility recompute. `hydrateApp` accepts `components: Record<string, React.FC>` and `modules: ModuleSpec[]`. Component catalog merges shadcn + project components. |
| 4 | `@rntme/blueprint` | L | Project compose reads `project.json#modules`, fetches each `module.json`, builds `catalogManifest.json`. Cross-module validation per §11. Virtual-entry generator script (or a sibling `@rntme/ui-bundler` if size warrants). Pass union to `@rntme/ui` validator. |
| 5 | `modules/presentation/md-mermaid/` (new) | M | New workspace package. `module.json` with `client.components: [Markdown, Mermaid]`. `client/index.ts` exporting React components for markdown using `react-markdown` + `remark-gfm` (safe React rendering, no raw HTML) and mermaid using `mermaid.initialize({ startOnLoad: false })` + `render()`. No `boot`, no `operations`, no `category`. Unit tests for component render. |
| 6 | `modules/presentation/tiptap/` (new) | M | New workspace package. `module.json` with `client.components: [RichTextEditor]` and `client.operations: [toggleBold, toggleItalic, insertImage]`. `client/components/RichTextEditor.tsx` uses `@tiptap/react` + `@tiptap/pm` + `@tiptap/starter-kit` + `@tiptap/extension-image`, registers operations via `useOperationRegistry`. Unit tests for component render and operation dispatch (with mocked registry). |
| 7 | `modules/analytics/google-analytics/` (new) | M | New workspace package. `module.json` with `category: "analytics"`, `contract: "analytics/v1"`, `client.boot: true`, `client.operations: [track, identify]`, `client.config.schema: { measurementId }`. `client/index.ts` exporting `boot(ctx)`. Unit tests for boot wiring (mock `ctx`), operation dispatch, lifecycle subscription. |
| 8 | `packages/contracts/analytics/v1/` (new) | XS | Canonical contract directory. `client.componentTypes: []` (analytics has no canonical components in v1). `client.operations: [track, identify]` with shared params schema. README. |
| 9 | `AGENTS.md` | XS | §3 (package layering) lists module client surface; §6 (how-tos) adds "Add a UI module" recipe; §10 (glossary) defines `ModuleBootContext`, `module-action`, "state-gated rendering". |
| 10 | `README.md` | XS | Packages table updated with new modules; dep graph notes UI-runtime's new exports; MVP scope mentions module-driven UI extension. |
| 11 | Per-package READMEs | XS | `@rntme/ui`, `@rntme/ui-runtime`, `@rntme/blueprint`, `@rntme/module-skeleton`, plus new modules' READMEs. |
| 12 | `demo/notes-blueprint/` | none | Notes demo continues with the existing auth0 plan and `packages/ui-auth-shell/`. v2 migration of the auth0 path into this model is a separate spec. |

## 13. Risk register

| # | Risk | Surface | Mitigation |
|---|---|---|---|
| R1 | Bundle size grows unbounded as modules accumulate (tiptap ~200kB, AI client ~50kB, etc.) | Per-project SPA bundle | Per-project bundling already isolates: only modules used by *this* project ship in *its* SPA. Document budget per category in `AGENTS.md`. Track gzip size in CI for the demo project; flag when over a soft budget. |
| R2 | Two modules contribute components with same `type` name (e.g., two markdown libs both register `<Markdown>`) | Compose | `BLUEPRINT_DUPLICATE_COMPONENT` error at compose. Project owner picks one; or modules namespace components by category prefix in canonical contracts. |
| R3 | `boot()` race conditions: module B's transport middleware needed before module A's data fetch | Runtime | All `boot`s run sequentially before any mount in `project.json#modules` order. Document explicitly. If a module has a hard ordering need, declare via convention in the project (no `dependsOn` field in v1). |
| R4 | A module's `boot()` throws or hangs and blocks SPA boot indefinitely | Runtime | Per-boot timeout (10s default, configurable per-module via `client.bootTimeoutMs`). On timeout or rejection, host shows error page with module name and the underlying error. |
| R5 | Module ships components that don't render correctly in Tailwind v4 / shadcn theme | Component compatibility | Document the shadcn-theme convention (read CSS variables from `:root`) in module-skeleton README. Component test fixtures include a smoke render under the runtime's CSS. |
| R6 | A module's TS source uses runtime APIs not exported from `@rntme/ui-runtime/client` | Build | Stable export surface in `@rntme/ui-runtime/client/index.ts`. Module's TS imports get caught by `tsc` during the service build. |
| R7 | `/auth/status` not set yet when the SPA tries to render a `visible: { $state: "/auth/status", eq: ... }` element (race between hydration and identity boot) | Runtime | Identity module's `boot` MUST set `/auth/status: "booting"` synchronously at start. Visibility evaluator treats `undefined` state path as falsy → element hidden until the boot writes a real status. |
| R8 | Driver gating rule (skip fetch when layout hidden) breaks the existing notes demo's mount-time data fetches | Existing behaviour | Default-on rule, but demo without `visible` on root layout is unaffected (root visibility evaluates true). New rule activates only when project explicitly gates. Migration is opt-in. |
| R9 | Module category mapping in `project.json` references a category that no module declares | Compose | `BLUEPRINT_MODULE_NOT_FOUND` if package doesn't resolve. `BLUEPRINT_CATEGORY_NOT_DECLARED` if package resolves but doesn't declare that category. |
| R10 | Components that need to read from outside their tree (e.g., a "remote" toolbar button outside the editor's parent) can't access component-bound operations the obvious way | Authoring | The operation registry is keyed by `elementId`, not by tree position; any element in the spec can target any other by ID. Documented invariant; no actual limitation. |
| R11 | Public config in `/config.json` accidentally leaks a secret value (e.g., a developer puts an API secret under `client.config.schema` without realising it's served unauthenticated) | Security | `module.json#client.config.schema` keys are documented as **public**. Validator warns if a key name matches secret-like patterns (`*_SECRET`, `*_KEY` other than `clientId`/`measurementId`/etc.). Final defense: deploy-dokploy's `secretRefs` are kept disjoint from `publicConfig`. |
| R12 | Conflicting transport middleware order across modules (e.g., auth wants Bearer added; analytics wants requests measured) | Runtime | Middleware composes left-to-right around `baseFetch`. Analytics measurements naturally wrap auth (outer middleware sees the request post-auth-injection). Document the wrapping order. |
| R13 | A module's component imports a peer dep (e.g., `react`) at a different version from the host | Build | Pnpm workspace already deduplicates `react`/`react-dom` to the workspace's pinned version via peer-dep declaration. Modules declare React as `peerDependencies`, not `dependencies`. |
| R14 | The `eq`/`contains` operators in `visible` get abused to pack arbitrary expression logic into specs | Authoring discipline | Operators are intentionally minimal. A future `$expr` evaluator (separate spec) is the answer for richer needs. Document the reduced surface; refuse PRs adding more operators ad hoc. |
| R15 | Modules contribute heavy UI work in `boot()` that blocks first paint | Performance | Document boot-as-fast-as-possible convention; offload heavy work to lazy idle callbacks. Performance budget in CI for the demo project. |

## 14. Documentation touch checklist

Per `CLAUDE.md` "Every plan must include a documentation-touch task":

| File | Edit | What |
|---|---|---|
| `CLAUDE.md` "Architecture in one paragraph" | edit | Mention that modules contribute UI via `client.components`/`operations`/`boot` and not just gRPC RPCs. |
| `AGENTS.md` §3 (package layering) | edit | Add a "Module client contributions" row noting flow from `module.json#client` → `@rntme/blueprint` compose → `@rntme/ui` validate → SPA bundle. |
| `AGENTS.md` §6 (how-to recipes) | edit | "Add a UI-only module" recipe; "Add a stateful module component with operations" recipe; "Add an analytics-style module with `boot`" recipe. |
| `AGENTS.md` §10 (glossary) | edit | `ModuleBootContext`, `module-action`, "state-gated rendering", "component-bound operation", "module-level operation", "canonical UI contract". |
| `README.md` packages-table | edit | Add `modules/presentation/md-mermaid/`, `modules/presentation/tiptap/`, `modules/analytics/google-analytics/`. Update dep graph for `@rntme/ui-runtime`'s new public hooks. |
| `packages/ui/README.md` | edit | "Add an action kind" (now four kinds); "Operate-on-component validation" subsection; new error codes table; updated authoring file layout shows `module-action`. |
| `packages/ui-runtime/README.md` | edit | New `useTransport`/`useStateStore`/`useOperationRegistry` hook docs; `ModuleBootContext` reference; boot lifecycle ordering; driver gating rule. |
| `packages/blueprint/README.md` | edit | Project compose flow updated; module-discovery + cross-module validation; `catalogManifest.json` output. |
| `packages/module-skeleton/README.md` | edit | Add UI-only and mixed manifest examples; document `client.components`/`operations`/`boot`. |
| `modules/presentation/md-mermaid/README.md` (new) | create | File map / Quick start / API / Invariants / Where to look first / Specs. |
| `modules/presentation/tiptap/README.md` (new) | create | Same template. |
| `modules/analytics/google-analytics/README.md` (new) | create | Same template. |
| `packages/contracts/analytics/v1/README.md` (new) | create | Canonical contract definition. |

## 15. Out of scope (re-statement and future hooks)

- **Server-side streaming bindings.** `kind: "stream"` in `bindings.json`; SSE/fetch-stream proxying in `bindings-http`; gRPC streaming proxy. Required for AI demo end-to-end; separate spec.
- **`packages/ui-auth-shell/` migration into `modules/identity/auth0/client/`.** Mechanical move once this spec is implemented; auth0 demo stays on the separate-package shape until then.
- **A2 — module-owned routes/screens.** No use case; would require fragment merging at compile + route-conflict policy.
- **Sub-blueprint shape (module-as-mini-service).** Conflicts with single-event-store; no use case yet.
- **Dynamic runtime module loading.** Static esbuild bundling is the v1 answer.
- **`$expr` evaluator in `visible` (and elsewhere).** `eq`/`contains` cover v1 needs; richer expressions are a future spec.
- **`dependsOn` between modules.** Manifest-list ordering covers v1; topological sort comes when there's a real conflict.
- **Live-conformance for UI modules.** Mock-conformance only in v1.
- **PII masking convention for analytics events.** A future cross-cutting concern; for v1 the analytics module's authors are responsible.
- **A config-schema typed evaluator** that catches at validate-time when a `$state` reference's path does not exist in any data binding or initial-state seed. Existing reference layer handles partial coverage; richer cross-checks are a future improvement.
