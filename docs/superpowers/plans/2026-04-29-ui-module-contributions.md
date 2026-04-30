# UI Module Contributions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. For RNT-388, the executable task list is **only** `Task R1` through `Task R8` in the "RNT-388 DEV Scope" section. The historical original plan appendix is retained for reference and must not be executed as checklist work.

**Goal:** Make a module the unit of UI extension. Adding a new auth provider, payment provider, analytics vendor, rich-text editor, markdown renderer, AI-LLM vendor, or any future client-side capability is **only** a new module under `modules/<category>/<vendor>/` plus per-project wiring in `project.json` — no edits to core packages.

**Architecture:** Three orthogonal manifest slots — `client.components[]` (catalog entries), `client.operations[]` (named handlers, optionally bound to a component type), `client.boot: true` (one-shot startup hook). State-gated rendering replaces a wrapper-component primitive: identity-style modules write `/auth/status` to the state store and the project's root layout uses existing json-render `visible` to gate the app body. New action kind `module-action` in `@rntme/ui` dispatches to either component-bound (by `target` element ID) or module-level (by `module`/`category`) handlers. Per-project SPA bundling: `@rntme/blueprint` compose generates a virtual TypeScript entry that imports each module's `client/` named exports; existing `pnpm build` step in the domain-service Dockerfile runs `esbuild` on it.

**Tech Stack:** TypeScript, pnpm 9 workspace, Vitest, Zod (manifest schema), repo-pinned React (`@rntme/ui-runtime/package.json` currently uses `react`/`react-dom` `^19.2.5`; do not introduce a second React major), json-render (`@json-render/core`/`react`/`shadcn`), esbuild, Tailwind v4. New module deps: `react-markdown` + `remark-gfm` + `mermaid` (MD/Mermaid module), `@tiptap/react` + `@tiptap/pm` + `@tiptap/starter-kit` + `@tiptap/extension-image` (tiptap module).

**Spec:** `docs/superpowers/specs/2026-04-29-ui-module-contributions-design.md`. Read §1–§15 before starting.

**Phase plan:** PR #89 (`853a62d2b11b60a9199f98d29fbe0182437eb251`) already merged the foundation slice from the original nine-phase plan: module manifest schema, `@rntme/ui` `module-action` validation/emit, and `@rntme/ui-runtime` registry/hooks/visibility/transport/lifecycle scaffolding. RNT-388 is the follow-up slice only: `@rntme/blueprint` module parsing/discovery/catalog/virtual-entry integration, first UI module packages, analytics contract, docs, and blueprint integration smoke. Historical task bodies below are retained for traceability but are **not** part of the RNT-388 DEV scope.

```
DONE: Phase 1 (manifest schema, PR #89)
     │
     ├── DONE: Phase 2 (UI compiler, PR #89)
     ├── DONE: Phase 3 (UI runtime foundation, PR #89)
     └── RNT-388: Phase 4 (blueprint compose)
              │
              ├── RNT-388: Phase 5 (MD/Mermaid module)
              ├── RNT-388: Phase 6 (tiptap module)
              └── RNT-388: Phase 7 (GA + analytics/v1)
                        │
                        ▼
                   RNT-388: Phase 8 (docs touch — interleaves throughout)
                        │
                        ▼
                   RNT-388: Phase 9 (integration smoke)
```

---

## RNT-388 PLAN challenge result (2026-04-30)

**Verdict:** the old plan is not directly implementation-ready because it still presents PR #89 foundation work as open work. DEV must implement the RNT-388 follow-up below and skip historical Phase 1-3 task bodies unless a regression is discovered. This is a plan correction, not a product-code implementation.

**Current baseline on `main`:**

| Area | Status on `853a62d` | RNT-388 action |
|---|---|---|
| `packages/module-skeleton/src/manifest-shape.ts` | `client` schema, optional capabilities, UI-only/mixed/backend-only tests already merged | Do not rewrite; add tests only if module package manifests expose a bug |
| `packages/ui/src/*` | `module-action`, visible operators, binding-array preservation, operation/category resolvers already merged | Use catalog-backed resolvers from blueprint; do not change `on` shape |
| `packages/ui-runtime/src/client/*` | operation registry, hooks, lifecycle bus, transport chain, visibility, element-id injection already merged | Reuse; only touch if module packages reveal missing exports or boot wiring |
| `packages/blueprint/src/parse/schema.ts` | no `project.json#modules` field | Implement |
| `packages/blueprint/src/compose/compile-service-ui.ts` | placeholder component/operation/category resolvers | Replace with catalog-backed resolvers |
| `packages/blueprint/src/compose/*` | no module discovery, catalog, public config, or virtual entry emission | Implement |
| `modules/presentation/*`, `modules/analytics/google-analytics`, `packages/contracts/analytics/v1` | not present | Create |

**External API verification:** Context7 was attempted first as required, but the workspace quota returned "Monthly quota exceeded." Fallbacks used official/project docs:

- Tiptap React install docs (`https://tiptap.dev/docs/editor/getting-started/install/react`) require `@tiptap/react`, `@tiptap/pm`, and `@tiptap/starter-kit`; Image extension docs (`https://tiptap.dev/docs/editor/extensions/nodes/image`) require `@tiptap/extension-image` and use `editor.commands.setImage(...)`.
- Mermaid usage/API docs (`https://mermaid.js.org/config/usage`) require `mermaid.initialize({ startOnLoad: false })` before programmatic render/run and mark `mermaid.init` deprecated.
- React Markdown project docs/npm README (`https://www.npmjs.com/package/react-markdown`) describe the safe React rendering path without `dangerouslySetInnerHTML`.
- Google GA4 pageview docs (`https://developers.google.com/analytics/devguides/collection/ga4/views`) require disabling automatic page views with `send_page_view: false` before manual SPA `page_view` events; User-ID docs (`https://developers.google.com/analytics/devguides/collection/ga4/user-id`) require non-PII app IDs with `null` on sign-out.

### RNT-388 DEV Scope

Implement these tasks in order. Each task must commit after passing its listed gate. Keep PR #89 behavior intact: json-render binding objects/arrays remain unchanged, `props.__rntmeElementId` is the component-bound operation bridge, and duplicate operation names are invalid only within one module manifest.

### Task R1: Add `project.json#modules` parse/types/error surface

**Files:**
- Modify: `packages/blueprint/src/parse/schema.ts`
- Modify: `packages/blueprint/src/types/artifact.ts`
- Modify: `packages/blueprint/src/types/result.ts`
- Modify: `packages/blueprint/test/unit/parse.test.ts`

Add a `modules` object to `ProjectBlueprintSchema`:

```ts
modules: z
  .record(
    nonEmptyString,
    z
      .object({
        package: nonEmptyString,
        publicConfig: z.record(z.unknown()).optional(),
      })
      .strict(),
  )
  .optional(),
```

Add types:

```ts
export type ProjectModuleDecl = {
  package: string;
  publicConfig?: Readonly<Record<string, unknown>>;
};

export type ProjectModuleMap = Readonly<Record<string, ProjectModuleDecl>>;
```

Extend `ProjectBlueprint` with `modules?: ProjectModuleMap`. Add blueprint error codes:

```ts
BLUEPRINT_MODULE_RESOLVE_FAILED
BLUEPRINT_MODULE_MANIFEST_INVALID
BLUEPRINT_CATEGORY_NOT_DECLARED
BLUEPRINT_CATEGORY_MISMATCH
BLUEPRINT_DUPLICATE_COMPONENT
BLUEPRINT_MODULE_PUBLIC_CONFIG_INVALID
BLUEPRINT_MODULE_ENTRY_EXPORT_MISSING
```

Test accepts:

```json
"modules": {
  "presentation-md": { "package": "@rntme/presentation-md-mermaid" },
  "analytics": {
    "package": "@rntme/analytics-google-analytics",
    "publicConfig": { "measurementId": "G-XXXXXXX" }
  }
}
```

Gate:

```bash
pnpm -F @rntme/blueprint test --run unit/parse.test.ts
pnpm -F @rntme/blueprint typecheck
```

### Task R2: Discover module packages and parse manifests

**Files:**
- Create: `packages/blueprint/src/compose/modules.ts`
- Create: `packages/blueprint/test/unit/compose-modules.test.ts`
- Create fixtures under `packages/blueprint/test/fixtures/project-with-modules/`

`discoverModules({ rootDir, project })` returns `Result<DiscoveredModule[]>`. Each item carries `projectKey`, `packageName`, `moduleDir`, parsed `manifest`, and `publicConfig`.

Resolution order:

1. Use `createRequire(join(rootDir, 'project.json')).resolve(`${packageName}/package.json`)`, then read sibling `module.json`.
2. If package exports block package.json, fall back to `rootDir/node_modules/<scope>/<name>/module.json` for scoped packages and `rootDir/node_modules/<name>/module.json` for unscoped packages.
3. Test resolver may be injectable so unit fixtures do not require a real install.

Validation:

- Missing package/module manifest: `BLUEPRINT_MODULE_RESOLVE_FAILED` at `project.modules.<key>.package`.
- `parseModuleManifest` failure: `BLUEPRINT_MODULE_MANIFEST_INVALID` with cause.
- If manifest declares `category`, `projectKey` must equal `manifest.category`; otherwise `BLUEPRINT_CATEGORY_MISMATCH`.
- If a screen later uses `category: "analytics"`, only manifests with `category: "analytics"` are eligible. Local alias keys for category-less modules are not category-addressable.

Gate:

```bash
pnpm -F @rntme/blueprint test --run unit/compose-modules.test.ts
pnpm -F @rntme/blueprint typecheck
```

### Task R3: Build catalog and validate public config/conflicts

**Files:**
- Create: `packages/blueprint/src/compose/catalog.ts`
- Create: `packages/blueprint/src/compose/validate-modules.ts`
- Create: `packages/blueprint/test/unit/compose-catalog.test.ts`
- Create: `packages/blueprint/test/unit/validate-modules.test.ts`

Catalog shape:

```ts
export type CatalogManifest = {
  components: Array<{ type: string; module: string; props: Record<string, PropSchema> }>;
  operations: Array<{
    name: string;
    module: string;
    appliesTo: string[] | null;
    params: Record<string, PropSchema>;
    category: string | null;
  }>;
  modulesWithBoot: string[];
  categoryToModule: Record<string, string>;
  publicConfig: Record<string, Record<string, unknown>>;
};
```

Conflict rules:

- Duplicate component `type` across modules is `BLUEPRINT_DUPLICATE_COMPONENT`.
- Duplicate operation names across different modules are allowed. The UI action must address a module/category/target; only duplicate names inside one manifest stay invalid in `@rntme/module-skeleton`.
- `categoryToModule` is one-to-one because `project.json#modules` key equals category for canonical modules.
- `publicConfig` is validated against `client.config.schema`: required fields and literal type checks only (`string`, `number`, `boolean`, `object`, `array`). Do not read secrets or deploy env in this task.

Gate:

```bash
pnpm -F @rntme/blueprint test --run unit/compose-catalog.test.ts unit/validate-modules.test.ts
pnpm -F @rntme/blueprint typecheck
```

### Task R4: Feed the catalog into UI compilation

**Files:**
- Modify: `packages/blueprint/src/compose/compile-service-ui.ts`
- Modify: `packages/blueprint/src/compose/load-composed-blueprint.ts`
- Modify: `packages/blueprint/src/types/artifact.ts`
- Modify: `packages/blueprint/test/unit/load-composed-blueprint.test.ts`

Extend `ComposedBlueprint` with `catalogManifest: CatalogManifest | null` or `catalogManifest?: CatalogManifest`; prefer a single project-level catalog because `project.json#modules` is project-level and multiple UI services should validate against the same module catalog.

Change `compileServiceUi` to accept optional `catalogManifest` and pass these resolvers into `@rntme/ui.compile`:

- `resolveComponent(type)` finds `catalogManifest.components[type]`, returns declared props plus `childrenModel: 'list'` for module components unless a future manifest field says otherwise.
- `resolveOperation(name, opts)`:
  - with `opts.module`: match same module and operation name.
  - with `opts.category`: map category to module, then match.
  - with `opts.targetElementType`: match operation name where `appliesTo` contains the target type.
  - without an address: return `undefined`; do not globally resolve duplicate names.
- `resolveCategoryToModule(category)` reads `catalogManifest.categoryToModule`.

Gate:

```bash
pnpm -F @rntme/blueprint test --run unit/load-composed-blueprint.test.ts
pnpm -F @rntme/blueprint typecheck
```

### Task R5: Emit virtual UI entry and public config sidecars

**Files:**
- Create: `packages/blueprint/src/compose/virtual-entry.ts`
- Create: `packages/blueprint/test/unit/virtual-entry.test.ts`
- Modify: `packages/blueprint/src/index.ts`
- Modify: `packages/blueprint/src/types/artifact.ts`

`renderVirtualEntry(catalogManifest)` emits deterministic ESM source that:

- imports each unique module package's client entry once;
- builds `components` from named exports declared in `client.components[]`;
- builds `modules` from packages with `client.boot: true`;
- calls `hydrateApp({ rootSelector: '#root', components, modules })`.

Add `renderPublicConfig(catalogManifest)` or equivalent helper returning only `catalogManifest.publicConfig`. Keep this local to compose output; do not assume a merged `rntme-cli` deploy change.

Gate:

```bash
pnpm -F @rntme/blueprint test --run unit/virtual-entry.test.ts
pnpm -F @rntme/blueprint typecheck
```

### Task R6: Add first module packages and analytics contract

**Files:**
- Create `modules/presentation/md-mermaid/`
- Create `modules/presentation/tiptap/`
- Create `modules/analytics/google-analytics/`
- Create `packages/contracts/analytics/v1/`
- Modify `pnpm-lock.yaml` via `pnpm install --lockfile-only` if dependencies change

Module package requirements:

- Follow existing module package shape (`package.json`, `tsconfig.json`, `tsconfig.check.json`, `eslint.config.mjs`, `vitest.config.ts`, `module.json`, `src/`, `test/unit/`, `README.md`).
- `md-mermaid`: package deps `react-markdown`, `remark-gfm`, `mermaid`; components `Markdown` and `Mermaid`; Mermaid must call `mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' })` and render asynchronously.
- `tiptap`: deps `@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit`, `@tiptap/extension-image`; component `RichTextEditor`; operations `toggleBold`, `toggleItalic`, `insertImage` registered under `props.__rntmeElementId`.
- `google-analytics`: `category: "analytics"`, `vendor: "google-analytics"`, `contract: "analytics/v1"`, `client.boot: true`, operations `track` and `identify`; initialize GA4 with `send_page_view: false`, send navigation page views explicitly, never send PII as `user_id`, and send `null` on sign-out.
- Analytics contract package exports canonical operation names and param shapes only. Do not add runtime GA code to contracts.

Gates:

```bash
pnpm install --lockfile-only
pnpm -F @rntme/presentation-md-mermaid test
pnpm -F @rntme/presentation-tiptap test
pnpm -F @rntme/analytics-google-analytics test
pnpm -F @rntme/contracts-analytics-v1 build
```

### Task R7: Documentation

**Files:**
- Modify: `CLAUDE.md`
- Modify: `AGENTS.md`
- Modify: `README.md`
- Modify: `packages/blueprint/README.md`
- Modify: `packages/ui/README.md`
- Modify: `packages/ui-runtime/README.md`
- Modify: `packages/module-skeleton/README.md`
- Module READMEs from Task R6

Docs must state that adding a new UI capability after RNT-388 means adding a module package plus a `project.json#modules` entry, not editing core packages. Include collision rules, `publicConfig` boundaries, `module-action` addressing, and the json-render binding-array shape.

Gate:

```bash
pnpm -F @rntme/blueprint test
pnpm -F @rntme/ui test
pnpm -F @rntme/ui-runtime test
pnpm -F @rntme/module-skeleton test
```

### Task R8: Integration smoke fixture

**Files:**
- Create: `packages/blueprint/test/fixtures/integration-smoke/`
- Create: `packages/blueprint/test/integration/end-to-end.test.ts`

Fixture must include `project.json#modules` consuming:

```json
{
  "presentation-md": { "package": "@rntme/presentation-md-mermaid" },
  "presentation-rte": { "package": "@rntme/presentation-tiptap" },
  "analytics": {
    "package": "@rntme/analytics-google-analytics",
    "publicConfig": { "measurementId": "G-XXXXXXX" }
  }
}
```

Assertions:

- compose succeeds;
- catalog contains `Markdown`, `Mermaid`, `RichTextEditor`;
- catalog maps `analytics` to `@rntme/analytics-google-analytics`;
- duplicate component fixture fails with `BLUEPRINT_DUPLICATE_COMPONENT`;
- missing GA `measurementId` fails with `BLUEPRINT_MODULE_PUBLIC_CONFIG_INVALID`;
- compiled UI accepts `kind: "module-action"` for `target: "editor"` and `category: "analytics"`;
- virtual entry imports all three module packages and exports or invokes the expected runtime bootstrap;
- public config sidecar contains only `publicConfig`, no secrets.

Final gate:

```bash
pnpm -F @rntme/blueprint test
pnpm -F @rntme/ui test
pnpm -F @rntme/ui-runtime test
pnpm -F @rntme/module-skeleton test
pnpm -r --filter './modules/**' test
pnpm -r --filter './packages/contracts/analytics/v1' build
```

### RNT-388 Open Product/Architecture Decisions

- **Artifact write location:** `loadComposedBlueprint(dir)` is currently an in-memory composer. RNT-388 should expose virtual entry/public config/catalog on the composed result and test them there. A later deploy/CLI plan should decide where generated files are written into deploy artifacts.
- **Per-service vs project-level catalog:** use project-level catalog for this slice. If later product work needs service-specific catalogs, add a separate spec.
- **Live Dokploy evidence:** not required for this plan. The integration smoke is local compose/validate/catalog/virtual-entry evidence.

## PLAN challenge amendments (2026-04-30)

These amendments are mandatory and supersede any lower task snippet that still shows the old shape.

### A. Preserve json-render event bindings; do not switch `on` to action-id strings

Current runtime specs use json-render action binding objects:

```jsonc
{
  "on": {
    "press": { "action": "dispatch", "params": { "name": "save" } }
  }
}
```

`@json-render/react` already supports arrays of these binding objects and executes them sequentially. Therefore:

- Do **not** change `ElementJson.on` or `CompiledElement.on` to `string | string[]`.
- Do **not** require screen authors to write `"on": { "click": "save" }`.
- For composed UI actions, use the existing binding-array shape:

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

Phase 2 should validate this existing shape when it needs validation, but no runtime action-dispatch rewrite is required just for arrays.

### B. Component-bound operations require an element-id bridge

`@json-render/react` passes `ComponentRenderProps.element` to component renderers, but the element object does not currently include the map key (`editor`, `saveBtn`, etc.). A component cannot register handlers under `target: "editor"` unless rntme injects the element ID.

Phase 3 must include an explicit wrapper/transform before rendering:

- Add the element map key to each rendered element as a reserved runtime prop, e.g. `props.__rntmeElementId`.
- Document that module components receive it through their renderer props and pass it to `useOperationRegistry().register(elementId, handlers)`.
- Add a unit test proving `RichTextEditor` registers under the authored element key and unregisters on unmount.

### C. Exact `project.json#modules` authoring shape

Use an object form rather than package-string shorthand so config and future metadata have a stable home:

```jsonc
{
  "modules": {
    "presentation-md": { "package": "@rntme/presentation-md-mermaid" },
    "presentation-rte": { "package": "@rntme/presentation-tiptap" },
    "analytics": {
      "package": "@rntme/analytics-google-analytics",
      "publicConfig": { "measurementId": "G-XXXXXXX" }
    }
  }
}
```

Key semantics:

- If `module.json` declares `category`, the `project.json#modules` key MUST equal that category. Otherwise compose raises `BLUEPRINT_CATEGORY_NOT_DECLARED` or `BLUEPRINT_CATEGORY_MISMATCH`.
- If a module has no canonical category, the key is a local alias and is not available for `category:` action addressing.
- `publicConfig` is the only config used in this plan. It is validated during compose against `client.config.schema` and emitted into the local compose output used by the SPA. Deploy-adapter integration can consume the same shape later, but this plan must not assume an already-merged `rntme-cli` deployment change.

### D. Manifest schema corrections

- `capabilities.rpcs` and `capabilities.events` must become optional with defaults to `[]`; backend-only manifests remain valid when either list is omitted.
- `vendor` is required whenever `category` and `contract` are present. UI-only singleton modules may omit all three.
- The empty-manifest check is: non-empty `capabilities` (`rpcs.length + events.length > 0`) OR non-empty `client` (`boot` or at least one component/operation).
- Keep package-local error codes in TypeScript unions (`UNKNOWN_OPERATION`, etc.). Spec prose may prefix them with package names for readability, but `UiErrorCode` currently uses unprefixed codes.

### E. Scoped operation names

Do not reject duplicate module-level operation names across modules. Operations are addressed by `target` or by `module`/`category`, so `track` can exist in analytics and another future category without ambiguity. Only reject duplicate operation names within the same module manifest.

### F. Third-party API decisions verified during PLAN review

Context7 was unavailable because the workspace quota was exceeded, so this review fell back to official/project docs:

- Tiptap React docs require `@tiptap/react`, `@tiptap/pm`, and `@tiptap/starter-kit`. `insertImage` requires adding an image extension; do not rely on StarterKit for it.
- Mermaid docs recommend `mermaid.initialize({ startOnLoad: false })` before `render()`/`run()`; do not use deprecated `mermaid.init`.
- `react-markdown` is the markdown renderer for v1 because its README documents safe rendering without `dangerouslySetInnerHTML`. Do not use `marked` unless the implementation also adds sanitization.
- Google Analytics config must set `send_page_view: false` during script initialization and send SPA navigations explicitly. `user_id` must not be PII; send `null` on sign-out.

## Non-executable Original File Structure Reference

This section mirrors the original nine-phase plan for traceability. It is superseded by the RNT-388 tasks above; do not use it as the DEV checklist.

### Phase 1 — `@rntme/module-skeleton`

- Modify: `packages/module-skeleton/src/manifest-shape.ts` — relax top-level fields; add `client` block schema; add validation rule "one of `client` or `capabilities` non-empty".
- Modify: `packages/module-skeleton/test/unit/manifest-shape.test.ts` — UI-only, mixed, empty cases.
- Modify: `packages/module-skeleton/README.md` — document the new client block.

### Phase 2 — `@rntme/ui`

- Modify: `packages/ui/src/types/source.ts` — add `ModuleAction` to `ActionDef`; preserve existing json-render `ElementJson.on` binding object / binding-array shape.
- Modify: `packages/ui/src/types/compiled.ts` — add `CompiledModuleAction` to `CompiledAction`; preserve existing json-render `CompiledElement.on` binding object / binding-array shape.
- Modify: `packages/ui/src/types/result.ts` — add new error codes per spec §4.3, §7.2, §11.
- Modify: `packages/ui/src/validate/structural.ts` — accept `module-action`; validate json-render binding arrays when present; accept new `visible` operator shapes.
- Modify: `packages/ui/src/validate/references.ts` — module-action target/operation/category resolution.
- Modify: `packages/ui/src/validate/index.ts` — extend `ValidateResolvers` with `resolveOperation`, `resolveCategoryToModule`.
- Modify: `packages/ui/src/emit/emit.ts` — canonicalize `category` → `module` in compiled actions.
- Modify: `packages/ui/src/emit/http-map.ts` — pass `module-action` through `resolveScreenHttp`.
- Create: `packages/ui/test/fixtures/module-action-app/` — a fixture used by validate + emit tests.
- Modify: `packages/ui/test/unit/validate.test.ts` and `emit.test.ts` and `types.test.ts`.

### Phase 3 — `@rntme/ui-runtime`

- Create: `packages/ui-runtime/src/client/operation-registry.ts` — scoped registry for component-bound and module-level operations.
- Create: `packages/ui-runtime/src/client/lifecycle-bus.ts` — `navigate` / `action:dispatched` / `action:succeeded` / `action:failed` event bus.
- Create: `packages/ui-runtime/src/client/transport-chain.ts` — `useChain` middleware composition over `baseFetch`.
- Create: `packages/ui-runtime/src/client/module-context.ts` — `ModuleBootContext` type + factory.
- Create: `packages/ui-runtime/src/client/hooks.ts` — `useTransport`, `useStateStore`, `useOperationRegistry`.
- Create: `packages/ui-runtime/src/client/visibility.ts` — evaluator for `{ $state, eq?, contains?, not? }` shapes.
- Modify: `packages/ui-runtime/src/client/driver.ts` / `registry.ts` — `module-action` dispatch from the existing `dispatch` action handler; data-fetch gating rule when layout `visible:false`. Do not duplicate json-render's existing event-binding array dispatcher.
- Modify: `packages/ui-runtime/src/client/registry.ts` — accept dynamic per-project component catalog; preserve shadcn defaults; module-action handler registration.
- Modify: `packages/ui-runtime/src/client/layout-manager.tsx` — provide `OperationRegistryProvider`; inject reserved element IDs before rendering; pre-evaluate visibility via `visibility.ts`.
- Modify: `packages/ui-runtime/src/client/entry.tsx` — boot orchestrator (load `/config.json` → run boots in order → mount); accept `components` and `modules` on `hydrateApp`.
- Modify: `packages/ui-runtime/src/client/index.ts` — export new hooks and types.
- Tests: `packages/ui-runtime/test/unit/operation-registry.test.ts`, `lifecycle-bus.test.ts`, `transport-chain.test.ts`, `visibility.test.ts`, `driver.test.ts` (extend), `entry.test.ts` (new).

### Phase 4 — `@rntme/blueprint`

- Create: `packages/blueprint/src/compose/modules.ts` — read `project.json#modules`, resolve packages, parse each `module.json`.
- Create: `packages/blueprint/src/compose/catalog.ts` — build `catalogManifest` from collected modules.
- Create: `packages/blueprint/src/compose/validate-modules.ts` — duplicate detection, category mapping, public config validation.
- Create: `packages/blueprint/src/compose/virtual-entry.ts` — emit `__rntme_ui_entry.ts` from `catalogManifest`.
- Modify: `packages/blueprint/src/compose/index.ts` (or wherever the compose entry lives) — wire new steps in; emit `catalogManifest.json` next to the existing UI artifact.
- Modify: `packages/blueprint/src/types/composition.ts` (or equivalent) — extend `ComposedProjectInput` with `modules` map and per-module public config.
- Modify: `packages/blueprint/src/parse/schema.ts` — recognise `project.json#modules` map.
- Tests: `packages/blueprint/test/unit/compose-modules.test.ts`, `compose-catalog.test.ts`, `validate-modules.test.ts`, `virtual-entry.test.ts`.
- Test fixtures: `packages/blueprint/test/fixtures/project-with-modules/` covering UI-only, mixed, and conflicting-module cases.

### Phase 5 — `modules/presentation/md-mermaid/` (new package)

- Create: `modules/presentation/md-mermaid/package.json`.
- Create: `modules/presentation/md-mermaid/tsconfig.json`.
- Create: `modules/presentation/md-mermaid/tsconfig.check.json`.
- Create: `modules/presentation/md-mermaid/eslint.config.mjs`.
- Create: `modules/presentation/md-mermaid/vitest.config.ts`.
- Create: `modules/presentation/md-mermaid/module.json`.
- Create: `modules/presentation/md-mermaid/src/index.ts`.
- Create: `modules/presentation/md-mermaid/src/components/Markdown.tsx`.
- Create: `modules/presentation/md-mermaid/src/components/Mermaid.tsx`.
- Create: `modules/presentation/md-mermaid/test/unit/Markdown.test.tsx`.
- Create: `modules/presentation/md-mermaid/test/unit/Mermaid.test.tsx`.
- Create: `modules/presentation/md-mermaid/test/unit/manifest.test.ts`.
- Create: `modules/presentation/md-mermaid/README.md`.

### Phase 6 — `modules/presentation/tiptap/` (new package)

Mirror Phase 5 layout. Components: `RichTextEditor.tsx`. Operations: `toggleBold`, `toggleItalic`, `insertImage` registered via `useOperationRegistry`. Include `@tiptap/pm` and `@tiptap/extension-image`; add an implementation note that StarterKit does not supply image insertion.

### Phase 7 — `modules/analytics/google-analytics/` + `packages/contracts/analytics/v1/` (new packages)

- Create: `packages/contracts/analytics/v1/package.json`.
- Create: `packages/contracts/analytics/v1/src/operations.ts` — canonical operation definitions.
- Create: `packages/contracts/analytics/v1/src/index.ts`.
- Create: `packages/contracts/analytics/v1/README.md`.
- Create: GA module package mirroring Phase 5/6 layout.
- GA's `client/index.ts` exports `boot(ctx)`. Operations `track`, `identify` registered via `ctx.registerOperation`.

### Phase 8 — Documentation

- Modify: `CLAUDE.md` — "Architecture in one paragraph".
- Modify: `AGENTS.md` — §3 (layering), §6 (how-tos), §10 (glossary).
- Modify: `README.md` — packages table + dep graph.
- Modify: `packages/ui/README.md`, `packages/ui-runtime/README.md`, `packages/blueprint/README.md`, `packages/module-skeleton/README.md`.
- Per-module READMEs included in Phases 5–7 above.

### Phase 9 — Integration smoke

- Create: `packages/blueprint/test/fixtures/integration-smoke/` — minimal project consuming all three modules.
- Create: `packages/blueprint/test/integration/end-to-end.test.ts` — drives compose → validate → catalog manifest + virtual entry + generated public config assertions. This is not a live Dokploy gate.

---

## Archived Original Detailed Plan (Non-Executable)

The remaining detailed task bodies are preserved only to help DEV understand the old design intent. They predate PR #89 and can conflict with the current baseline; for RNT-388, follow `Task R1` through `Task R8` above instead.

## Phase 1 — Module manifest schema extension

### Task 1.1: Extend `ModuleManifestSchema` with relaxed top-level + `client` block

**Files:**
- Modify: `packages/module-skeleton/src/manifest-shape.ts`

- [archived] **Step 1: Update the schema**

Replace the contents of `packages/module-skeleton/src/manifest-shape.ts` with:

```ts
import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────
// Existing backend-side blocks (relaxed: capabilities is now optional)
// ─────────────────────────────────────────────────────────────────────────

export const ModuleSecretSchema = z
  .object({
    name: z.string().min(1),
    scope: z.enum(['tenant', 'project', 'service']),
  })
  .strict();

export const ModuleCapabilitiesSchema = z
  .object({
    vendors: z.array(z.string().min(1)).optional(),
    entities: z.array(z.string().min(1)).optional(),
    rpcs: z.array(z.string().min(1)).default([]),
    events: z.array(z.string().min(1)).default([]),
    search_tiers: z.array(z.string().min(1)).optional(),
    labeled_associations: z.boolean().optional(),
    bulk_operations: z.record(z.unknown()).optional(),
    async_job_types: z.array(z.string().min(1)).optional(),
    webhook_format: z.string().min(1).optional(),
    webhook_retry_policy: z.string().min(1).optional(),
  })
  .strict();

// ─────────────────────────────────────────────────────────────────────────
// New: client (UI-contribution) block
// ─────────────────────────────────────────────────────────────────────────

export const PropSchemaSchema: z.ZodType<{
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required?: boolean;
  array?: boolean;
}> = z
  .object({
    type: z.enum(['string', 'number', 'boolean', 'object', 'array']),
    required: z.boolean().optional(),
    array: z.boolean().optional(),
  })
  .strict();

export const ComponentDeclarationSchema = z
  .object({
    type: z.string().min(1),
    props: z.record(PropSchemaSchema),
  })
  .strict();

export const OperationDeclarationSchema = z
  .object({
    name: z.string().min(1),
    appliesTo: z.array(z.string().min(1)).optional(),
    params: z.record(PropSchemaSchema).optional(),
  })
  .strict();

export const ClientConfigSchema = z
  .object({
    schema: z.record(PropSchemaSchema),
  })
  .strict();

export const ClientBlockSchema = z
  .object({
    entry: z.string().min(1),
    boot: z.boolean().optional(),
    bootTimeoutMs: z.number().int().positive().optional(),
    config: ClientConfigSchema.optional(),
    components: z.array(ComponentDeclarationSchema).optional(),
    operations: z.array(OperationDeclarationSchema).optional(),
  })
  .strict();

// ─────────────────────────────────────────────────────────────────────────
// Top-level manifest (category/vendor/contract/capabilities now optional)
// ─────────────────────────────────────────────────────────────────────────

export const ModuleManifestSchema = z
  .object({
    name: z.string().min(1),
    version: z.string().min(1),
    category: z.string().min(1).optional(),
    vendor: z.string().min(1).optional(),
    contract: z.string().min(1).optional(),
    description: z.string().min(1).optional(),
    contact: z.string().min(1).optional(),
    grpcServiceName: z.string().min(1).optional(),
    webhookPath: z.string().startsWith('/').optional(),
    secrets: z.array(ModuleSecretSchema).optional(),
    capabilities: ModuleCapabilitiesSchema.optional(),
    client: ClientBlockSchema.optional(),
    limitations: z.array(z.string().min(1)).optional(),
  })
  .strict()
  // ── post-parse cross-field rules (run as a refinement; produce ModuleManifestError shape).
  .superRefine((value, ctx) => {
    // Rule 1: at least one of capabilities or client must be present and non-empty.
    const hasCapabilities = !!value.capabilities && (
      value.capabilities.rpcs.length > 0 || value.capabilities.events.length > 0
    );
    const hasClient = !!value.client && (
      !!value.client.boot ||
      (value.client.components?.length ?? 0) > 0 ||
      (value.client.operations?.length ?? 0) > 0
    );
    if (!hasCapabilities && !hasClient) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['<root>'],
        message: 'MODULE_MANIFEST_EMPTY: manifest must declare a non-empty `capabilities` or `client` surface',
      });
    }
    // Rule 2: category set ↔ contract set; vendor required for canonical membership.
    if ((value.category && !value.contract) || (!value.category && value.contract)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: value.category ? ['contract'] : ['category'],
        message: 'MODULE_MANIFEST_CATEGORY_REQUIRES_CONTRACT: `category` and `contract` must both be set or both omitted',
      });
    }
    if (value.category && value.contract && !value.vendor) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['vendor'],
        message: 'MODULE_MANIFEST_VENDOR_REQUIRED: canonical modules must declare `vendor`',
      });
    }
    // Rule 3: client.components[].type is unique within the module.
    const types = (value.client?.components ?? []).map((c) => c.type);
    const dupTypes = types.filter((t, i) => types.indexOf(t) !== i);
    if (dupTypes.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['client', 'components'],
        message: `MODULE_MANIFEST_DUPLICATE_COMPONENT: component types must be unique (duplicates: ${[...new Set(dupTypes)].join(', ')})`,
      });
    }
    // Rule 4: client.operations[].name is unique within the module.
    const opNames = (value.client?.operations ?? []).map((o) => o.name);
    const dupOps = opNames.filter((n, i) => opNames.indexOf(n) !== i);
    if (dupOps.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['client', 'operations'],
        message: `MODULE_MANIFEST_DUPLICATE_OPERATION: operation names must be unique (duplicates: ${[...new Set(dupOps)].join(', ')})`,
      });
    }
    // Rule 5: every operation.appliesTo[] entry must be a known component type in this module.
    const declaredTypes = new Set(types);
    for (const op of value.client?.operations ?? []) {
      for (const t of op.appliesTo ?? []) {
        if (!declaredTypes.has(t)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['client', 'operations', op.name, 'appliesTo'],
            message: `MODULE_MANIFEST_OPERATION_BAD_APPLIES_TO: operation "${op.name}" appliesTo "${t}" but no such component is declared in this module`,
          });
        }
      }
    }
  });

export type ModuleSecret = z.infer<typeof ModuleSecretSchema>;
export type ModuleCapabilities = z.infer<typeof ModuleCapabilitiesSchema>;
export type PropSchema = z.infer<typeof PropSchemaSchema>;
export type ComponentDeclaration = z.infer<typeof ComponentDeclarationSchema>;
export type OperationDeclaration = z.infer<typeof OperationDeclarationSchema>;
export type ClientBlock = z.infer<typeof ClientBlockSchema>;
export type ModuleManifest = z.infer<typeof ModuleManifestSchema>;

export type ModuleManifestError = {
  path: string;
  message: string;
};

export type ModuleManifestResult =
  | { ok: true; value: ModuleManifest }
  | { ok: false; errors: ModuleManifestError[] };

export function parseModuleManifest(raw: unknown): ModuleManifestResult {
  const result = ModuleManifestSchema.safeParse(raw);
  if (result.success) return { ok: true, value: result.data };
  return {
    ok: false,
    errors: result.error.issues.map((issue) => ({
      path: issue.path.length === 0 ? '<root>' : issue.path.join('.'),
      message: issue.message,
    })),
  };
}
```

- [archived] **Step 2: Verify it builds**

Run: `pnpm -F @rntme/module-skeleton typecheck`
Expected: PASS (no type errors).

- [archived] **Step 3: Commit**

```bash
git add packages/module-skeleton/src/manifest-shape.ts
git commit -m "feat(module-skeleton): relax top-level fields; add client block schema"
```

### Task 1.2: Tests for new manifest shapes

**Files:**
- Modify: `packages/module-skeleton/test/unit/manifest-shape.test.ts` (or create if missing)

- [archived] **Step 1: Write failing tests**

Append to (or create) `packages/module-skeleton/test/unit/manifest-shape.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseModuleManifest } from '../../src/manifest-shape.js';

describe('parseModuleManifest — relaxed top-level + client block', () => {
  it('accepts UI-only manifest (no category, no capabilities, only client.components)', () => {
    const raw = {
      name: '@rntme/presentation-md-mermaid',
      version: '0.0.0',
      client: {
        entry: './client/index.ts',
        components: [
          { type: 'Markdown', props: { source: { type: 'string', required: true } } },
          { type: 'Mermaid',  props: { source: { type: 'string', required: true } } },
        ],
      },
    };
    const r = parseModuleManifest(raw);
    expect(r.ok).toBe(true);
  });

  it('accepts mixed manifest (category + capabilities + client.boot + operations)', () => {
    const raw = {
      name: '@rntme/analytics-google-analytics',
      version: '0.0.0',
      category: 'analytics',
      vendor: 'google-analytics',
      contract: 'analytics/v1',
      capabilities: { rpcs: [], events: [] },
      client: {
        entry: './client/index.ts',
        boot: true,
        config: { schema: { measurementId: { type: 'string', required: true } } },
        operations: [
          { name: 'track',    params: { event: { type: 'string', required: true } } },
          { name: 'identify', params: { userId: { type: 'string', required: true } } },
        ],
      },
    };
    const r = parseModuleManifest(raw);
    expect(r.ok).toBe(true);
  });

  it('rejects manifest with no capabilities and no client (MODULE_MANIFEST_EMPTY)', () => {
    const raw = { name: '@rntme/empty', version: '0.0.0' };
    const r = parseModuleManifest(raw);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.message.includes('MODULE_MANIFEST_EMPTY'))).toBe(true);
  });

  it('rejects category without contract (MODULE_MANIFEST_CATEGORY_REQUIRES_CONTRACT)', () => {
    const raw = {
      name: '@rntme/x',
      version: '0.0.0',
      category: 'analytics',
      capabilities: { rpcs: ['Foo'], events: [] },
    };
    const r = parseModuleManifest(raw);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.message.includes('MODULE_MANIFEST_CATEGORY_REQUIRES_CONTRACT'))).toBe(true);
  });

  it('rejects duplicate component types (MODULE_MANIFEST_DUPLICATE_COMPONENT)', () => {
    const raw = {
      name: '@rntme/x',
      version: '0.0.0',
      client: {
        entry: './client/index.ts',
        components: [
          { type: 'Markdown', props: {} },
          { type: 'Markdown', props: {} },
        ],
      },
    };
    const r = parseModuleManifest(raw);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.message.includes('MODULE_MANIFEST_DUPLICATE_COMPONENT'))).toBe(true);
  });

  it('rejects duplicate operation names (MODULE_MANIFEST_DUPLICATE_OPERATION)', () => {
    const raw = {
      name: '@rntme/x',
      version: '0.0.0',
      client: {
        entry: './client/index.ts',
        boot: true,
        operations: [
          { name: 'track', params: {} },
          { name: 'track', params: {} },
        ],
      },
    };
    const r = parseModuleManifest(raw);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.message.includes('MODULE_MANIFEST_DUPLICATE_OPERATION'))).toBe(true);
  });

  it('rejects appliesTo referencing unknown component (MODULE_MANIFEST_OPERATION_BAD_APPLIES_TO)', () => {
    const raw = {
      name: '@rntme/x',
      version: '0.0.0',
      client: {
        entry: './client/index.ts',
        components: [{ type: 'A', props: {} }],
        operations: [{ name: 'op', appliesTo: ['Z'], params: {} }],
      },
    };
    const r = parseModuleManifest(raw);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.message.includes('MODULE_MANIFEST_OPERATION_BAD_APPLIES_TO'))).toBe(true);
  });

  it('still accepts the original backend-only manifest shape', () => {
    const raw = {
      name: '@rntme/identity-clerk',
      version: '0.0.0',
      category: 'identity',
      vendor: 'clerk',
      contract: 'identity/v1',
      capabilities: { rpcs: ['GetUser'], events: ['rntme.identity.v1.UserCreated'] },
    };
    const r = parseModuleManifest(raw);
    expect(r.ok).toBe(true);
  });
});
```

- [archived] **Step 2: Run tests, expect them to pass with the schema from Task 1.1**

Run: `pnpm -F @rntme/module-skeleton test --run unit/manifest-shape.test.ts`
Expected: all 8 tests pass.

- [archived] **Step 3: Commit**

```bash
git add packages/module-skeleton/test/unit/manifest-shape.test.ts
git commit -m "test(module-skeleton): cover relaxed manifest + client block"
```

### Task 1.3: Update `module-skeleton` README

**Files:**
- Modify: `packages/module-skeleton/README.md`

- [archived] **Step 1: Add a "Client (UI) contributions" section**

Add the following block immediately after the existing "Module manifest contract" section in `packages/module-skeleton/README.md`:

```markdown
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
```

- [archived] **Step 2: Commit**

```bash
git add packages/module-skeleton/README.md
git commit -m "docs(module-skeleton): document client block (UI module contributions)"
```

---

## Phase 2 — `@rntme/ui` compiler

### Task 2.1: Extend `ActionDef` and preserve existing element `on` shape in `types/source.ts`

**Files:**
- Modify: `packages/ui/src/types/source.ts`

- [archived] **Step 1: Add `ModuleActionDef` to the `ActionDef` union**

Append to `packages/ui/src/types/source.ts` (and update the `ActionDef` union):

```ts
export type ModuleActionDef = {
  kind: 'module-action';
  // Addressing — exactly one of `target` (component-bound) or
  // (`module` xor `category`) (module-level).
  target?: string;
  module?: string;
  category?: string;
  name: string;
  params?: Record<string, ParamValue>;
  onSuccess?: { showAlert?: string; navigateTo?: string };
  onError?: { showAlert?: string };
};

// Replace the existing ActionDef line with:
export type ActionDef = NavigationAction | CommandAction | RefetchAction | ModuleActionDef;
```

Do not change `ElementJson.on` to action-id strings. Keep the existing json-render binding-object shape loose:

```ts
// inside ElementJson:
on?: Record<string, unknown>;
```

- [archived] **Step 2: Typecheck**

Run: `pnpm -F @rntme/ui typecheck`
Expected: PASS.

- [archived] **Step 3: Commit**

```bash
git add packages/ui/src/types/source.ts
git commit -m "feat(ui): add ModuleActionDef to ActionDef"
```

### Task 2.2: Extend `CompiledAction` in `types/compiled.ts`

**Files:**
- Modify: `packages/ui/src/types/compiled.ts`

- [archived] **Step 1: Add `CompiledModuleAction`**

Append to the `CompiledAction` union in `packages/ui/src/types/compiled.ts`:

```ts
export type CompiledModuleAction = {
  kind: 'module-action';
  target?: string;            // for component-bound dispatch
  module?: string;            // for module-level dispatch (category resolved at compile)
  name: string;
  params?: Record<string, ParamValue>;
  onSuccess?: { showAlert?: string; navigateTo?: string };
  onError?: { showAlert?: string };
};

// Update the union (replace whichever is the existing CompiledAction declaration):
export type CompiledAction =
  | { kind: 'navigation'; navigateTo: string; paramsFromState?: Record<string, string> }
  | { kind: 'command';    method: 'POST'; path: string; paramsFromState: Record<string, string>; onSuccess?: ...; onError?: ... }
  | { kind: 'refetch';    targets: string[] }
  | CompiledModuleAction;
```

(Keep the existing pre-existing fields verbatim — only the addition of `CompiledModuleAction` is new.)

Do not change `CompiledElement.on` to `string | string[]`; preserve the existing json-render action binding object / binding-array shape:

```ts
// inside CompiledElement:
on?: Record<string, unknown>;
```

- [archived] **Step 2: Typecheck**

Run: `pnpm -F @rntme/ui typecheck`
Expected: PASS.

- [archived] **Step 3: Commit**

```bash
git add packages/ui/src/types/compiled.ts
git commit -m "feat(ui): add CompiledModuleAction"
```

### Task 2.3: Extend `UiErrorCode` with new codes

**Files:**
- Modify: `packages/ui/src/types/result.ts`

- [archived] **Step 1: Append codes to the frozen union**

Inside `packages/ui/src/types/result.ts`, append the following codes to the `UiErrorCode` union (preserving existing codes — append, do not reorder or rename):

```
'UNKNOWN_OPERATION'
'UNKNOWN_COMPONENT_TYPE'
'PROP_REQUIRED_MISSING'
'MODULE_ACTION_NEEDS_TARGET_OR_MODULE'
'MODULE_ACTION_AMBIGUOUS_ADDRESSING'
'MODULE_ACTION_TARGET_MISSING'
'MODULE_ACTION_TARGET_TYPE_MISMATCH'
'MODULE_ACTION_NEEDS_TARGET'
'MODULE_ACTION_NEEDS_MODULE'
'MODULE_ACTION_PARAM_REQUIRED'
'MODULE_ACTION_PARAM_TYPE_MISMATCH'
'CATEGORY_NOT_MAPPED'
'VISIBLE_OPERATOR_UNKNOWN'
'ON_HANDLER_ARRAY_INVALID'
```

`ON_HANDLER_ARRAY_INVALID` applies only to invalid json-render binding arrays, not to action-id string arrays.

- [archived] **Step 2: Typecheck**

Run: `pnpm -F @rntme/ui typecheck`
Expected: PASS.

- [archived] **Step 3: Commit**

```bash
git add packages/ui/src/types/result.ts
git commit -m "feat(ui): add error codes for module-action, prop validation, visible operators"
```

### Task 2.4: Structural validation — `module-action` shape, array `on`, `visible` operators

**Files:**
- Modify: `packages/ui/src/validate/structural.ts`

- [archived] **Step 1: Failing tests first**

Add to `packages/ui/test/unit/validate.test.ts` (append to existing file):

```ts
describe('structural — module-action + json-render binding arrays + visible operators', () => {
  it('rejects module-action with both target and module', () => {
    const action = { kind: 'module-action', target: 'a', module: '@rntme/x', name: 'op' };
    // wrap in a minimal screen and validate; expect MODULE_ACTION_AMBIGUOUS_ADDRESSING
  });

  it('rejects module-action with neither target nor module nor category', () => {
    const action = { kind: 'module-action', name: 'op' };
    // expect MODULE_ACTION_NEEDS_TARGET_OR_MODULE
  });

  it('accepts module-action with target only', () => {
    const action = { kind: 'module-action', target: 'editor', name: 'toggleBold' };
    // expect ok at structural layer (reference layer will do the per-target lookup)
  });

  it('accepts module-action with category only', () => {
    const action = { kind: 'module-action', category: 'analytics', name: 'track' };
    // expect ok
  });

  it('rejects on.press array containing non-binding objects (ON_HANDLER_ARRAY_INVALID)', () => {
    // element.on = { press: [1, { action: 'dispatch', params: { name: 'save' } }] } → ON_HANDLER_ARRAY_INVALID
  });

  it('accepts on.press as a single json-render binding object', () => {
    // element.on = { press: { action: 'dispatch', params: { name: 'save' } } } → ok
  });

  it('accepts on.press as a json-render binding object array', () => {
    // element.on = { press: [{ action: 'dispatch', params: { name: 'trackSave' } }, { action: 'dispatch', params: { name: 'save' } }] } → ok
  });

  it('accepts visible: { $state: "/x" } (truthy)', () => {});
  it('accepts visible: { $state: "/x", eq: "anon" }', () => {});
  it('accepts visible: { $state: "/x", contains: "admin" }', () => {});
  it('accepts visible: { $state: "/x", not: true }', () => {});
  it('rejects visible with unknown operator (VISIBLE_OPERATOR_UNKNOWN)', () => {});
});
```

Flesh each test out by constructing a minimal `ExpandedSource` with one screen + one element + one action, then call `validate(expanded, mockResolvers)` and assert on `result.errors`. Reuse the test helpers in the existing `validate.test.ts`.

Run: `pnpm -F @rntme/ui test --run unit/validate.test.ts`
Expected: new tests fail with the specified codes (validator does not emit them yet).

- [archived] **Step 2: Implement structural rules**

Edit `packages/ui/src/validate/structural.ts`. Locate the action-validation pass (it currently iterates over each screen's actions and validates per-kind for `command`, `navigation`, `refetch`). Add a `module-action` arm:

```ts
function validateModuleAction(
  action: ModuleActionDef,
  pathPrefix: string,
  errors: UiError[]
): void {
  const hasTarget = !!action.target;
  const hasModule = !!action.module;
  const hasCategory = !!action.category;
  const addressingCount = Number(hasTarget) + Number(hasModule) + Number(hasCategory);

  if (addressingCount === 0) {
    errors.push({
      code: 'MODULE_ACTION_NEEDS_TARGET_OR_MODULE',
      message: 'module-action requires one of `target`, `module`, or `category`',
      path: pathPrefix,
    });
    return;
  }
  if (addressingCount > 1) {
    errors.push({
      code: 'MODULE_ACTION_AMBIGUOUS_ADDRESSING',
      message: 'module-action must set exactly one of `target`, `module`, or `category`',
      path: pathPrefix,
    });
    return;
  }
  if (!action.name || typeof action.name !== 'string') {
    errors.push({
      code: 'MODULE_ACTION_NEEDS_MODULE',  // reused code: addressing present but name missing
      message: 'module-action requires `name`',
      path: pathPrefix,
    });
  }
}
```

Wire `validateModuleAction` into the existing per-action dispatcher.

For the array `on` form, locate the part of structural validation that walks elements (the visit pass). Validate the existing json-render binding object shape:

```ts
function isJsonRenderBinding(value: unknown): value is { action: string; params?: Record<string, unknown> } {
  return !!value &&
    typeof value === 'object' &&
    typeof (value as { action?: unknown }).action === 'string';
}

function validateElementOn(el: CompiledElement, pathPrefix: string, errors: UiError[]): void {
  if (!el.on) return;
  for (const [evt, handler] of Object.entries(el.on)) {
    if (isJsonRenderBinding(handler)) continue;
    if (Array.isArray(handler)) {
      for (let i = 0; i < handler.length; i++) {
        if (!isJsonRenderBinding(handler[i])) {
          errors.push({
            code: 'ON_HANDLER_ARRAY_INVALID',
            message: `on.${evt}[${i}] must be a json-render action binding object`,
            path: `${pathPrefix}/on/${evt}/${i}`,
          });
        }
      }
      continue;
    }
    errors.push({
      code: 'ON_HANDLER_ARRAY_INVALID',
      message: `on.${evt} must be a json-render action binding object or an array of binding objects`,
      path: `${pathPrefix}/on/${evt}`,
    });
  }
}
```

Add `visible` shape recognition next to the existing per-element walk:

```ts
type VisibleClause =
  | { $state: string }
  | { $state: string; eq: unknown }
  | { $state: string; contains: unknown }
  | { $state: string; not: true };

function validateVisible(visible: unknown, pathPrefix: string, errors: UiError[]): void {
  if (visible === undefined) return;
  if (typeof visible !== 'object' || visible === null) {
    errors.push({ code: 'VISIBLE_OPERATOR_UNKNOWN', message: 'visible must be an object', path: pathPrefix });
    return;
  }
  const v = visible as Record<string, unknown>;
  if (typeof v.$state !== 'string') {
    errors.push({ code: 'VISIBLE_OPERATOR_UNKNOWN', message: 'visible.$state must be a string path', path: pathPrefix });
    return;
  }
  // Recognised operators: none (truthy), eq, contains, not.
  const known = ['$state', 'eq', 'contains', 'not'];
  for (const k of Object.keys(v)) {
    if (!known.includes(k)) {
      errors.push({
        code: 'VISIBLE_OPERATOR_UNKNOWN',
        message: `unknown visible operator "${k}"; expected one of: eq, contains, not`,
        path: pathPrefix,
      });
    }
  }
  if ('not' in v && v.not !== true) {
    errors.push({ code: 'VISIBLE_OPERATOR_UNKNOWN', message: 'visible.not must equal true', path: pathPrefix });
  }
}
```

Call `validateVisible(el.visible, ...)` and `validateElementOn(el, ...)` from the existing element walk.

- [archived] **Step 3: Run tests**

Run: `pnpm -F @rntme/ui test --run unit/validate.test.ts`
Expected: all tests pass (including the newly added structural-layer cases).

- [archived] **Step 4: Commit**

```bash
git add packages/ui/src/validate/structural.ts packages/ui/test/unit/validate.test.ts
git commit -m "feat(ui): structural validation for module-action, array on, visible operators"
```

### Task 2.5: Reference validation — module-action target/operation/category lookup

**Files:**
- Modify: `packages/ui/src/validate/index.ts`
- Modify: `packages/ui/src/validate/references.ts`

- [archived] **Step 1: Extend `ValidateResolvers`**

In `packages/ui/src/validate/index.ts`, extend `ValidateResolvers`:

```ts
export type OperationDescriptor = {
  module: string;             // module package name owning the operation
  appliesTo: string[] | null; // null = module-level; non-empty = component-bound
  params: Record<string, PropSchema>;
  category: string | null;
};

export type ValidateResolvers = {
  resolveBinding: (id: string) => unknown | undefined;
  resolveComponent: (type: string) => { childrenModel: 'list' | 'none' } | undefined;
  resolveRoute: (pattern: string) => boolean;
  // New:
  resolveOperation: (name: string, opts: { module?: string; category?: string }) => OperationDescriptor | undefined;
  resolveCategoryToModule: (category: string) => string | undefined;
};
```

Re-export `PropSchema` from `@rntme/module-skeleton`'s exports OR locally re-declare (must be structurally compatible). Either way, document the source.

- [archived] **Step 2: Failing tests in `validate.test.ts`**

Append:

```ts
describe('references — module-action lookups', () => {
  it('UNKNOWN_OPERATION when operation not registered', () => { /* ... */ });
  it('MODULE_ACTION_TARGET_MISSING when target element does not exist', () => { /* ... */ });
  it('MODULE_ACTION_TARGET_TYPE_MISMATCH when target element type not in appliesTo', () => { /* ... */ });
  it('MODULE_ACTION_NEEDS_TARGET when operation has appliesTo but action has no target', () => { /* ... */ });
  it('MODULE_ACTION_NEEDS_MODULE when operation is module-level but action has no module/category', () => { /* ... */ });
  it('MODULE_ACTION_PARAM_REQUIRED when required param missing', () => { /* ... */ });
  it('MODULE_ACTION_PARAM_TYPE_MISMATCH when literal value type mismatches schema', () => { /* ... */ });
  it('CATEGORY_NOT_MAPPED when category lookup returns undefined', () => { /* ... */ });
  it('UNKNOWN_COMPONENT_TYPE when element references a type not in any module', () => { /* ... */ });
  it('PROP_REQUIRED_MISSING when a required prop on a component is unbound', () => { /* ... */ });
});
```

Each test constructs a minimal `ExpandedSource` and calls `validate` with stub resolvers that return controlled values.

Run: `pnpm -F @rntme/ui test --run unit/validate.test.ts`
Expected: new tests fail with the named codes.

- [archived] **Step 3: Implement reference rules**

In `packages/ui/src/validate/references.ts`, add a new pass after the existing binding-resolution pass:

```ts
export function validateModuleActions(
  expanded: ExpandedSource,
  resolvers: ValidateResolvers,
  errors: UiError[]
): void {
  for (const [screenKey, screenWithDescriptor] of Object.entries({ ...expanded.layouts, ...expanded.screens })) {
    const { spec, screen } = screenWithDescriptor;
    if (!screen.actions) continue;
    for (const [actionId, action] of Object.entries(screen.actions)) {
      if (action.kind !== 'module-action') continue;
      validateOneModuleAction(action, actionId, screenKey, spec, resolvers, errors);
    }
  }
}

function validateOneModuleAction(
  action: ModuleActionDef,
  actionId: string,
  screenKey: string,
  spec: CompiledSpec,
  resolvers: ValidateResolvers,
  errors: UiError[]
): void {
  const path = `screen:${screenKey}/actions/${actionId}`;

  // 1. Resolve module from category if needed (without erroring yet).
  let module = action.module;
  if (!module && action.category) {
    module = resolvers.resolveCategoryToModule(action.category);
    if (!module && !action.target) {
      errors.push({
        code: 'CATEGORY_NOT_MAPPED',
        message: `category "${action.category}" is not mapped to any module in project.json#modules`,
        path,
      });
      return;
    }
  }

  // 2. Look up the operation.
  const op = resolvers.resolveOperation(action.name, { module, category: action.category });
  if (!op) {
    errors.push({
      code: 'UNKNOWN_OPERATION',
      message: `operation "${action.name}" not registered by any module`,
      path,
    });
    return;
  }

  // 3. Component-bound vs module-level cross-checks.
  if (op.appliesTo !== null) {
    if (!action.target) {
      errors.push({
        code: 'MODULE_ACTION_NEEDS_TARGET',
        message: `operation "${action.name}" is component-bound (appliesTo: ${op.appliesTo.join(',')}); action requires "target"`,
        path,
      });
      return;
    }
    const targetEl = spec.elements[action.target];
    if (!targetEl) {
      errors.push({
        code: 'MODULE_ACTION_TARGET_MISSING',
        message: `target element "${action.target}" not found in screen ${screenKey}`,
        path,
      });
      return;
    }
    if (!op.appliesTo.includes(targetEl.type)) {
      errors.push({
        code: 'MODULE_ACTION_TARGET_TYPE_MISMATCH',
        message: `target "${action.target}" has type "${targetEl.type}" but operation "${action.name}" only applies to: ${op.appliesTo.join(',')}`,
        path,
      });
      return;
    }
  } else {
    if (action.target) {
      errors.push({
        code: 'MODULE_ACTION_AMBIGUOUS_ADDRESSING',
        message: `operation "${action.name}" is module-level but action has "target"`,
        path,
      });
      return;
    }
    if (!action.module && !action.category) {
      errors.push({
        code: 'MODULE_ACTION_NEEDS_MODULE',
        message: `module-level operation "${action.name}" requires "module" or "category"`,
        path,
      });
      return;
    }
  }

  // 4. Parameter schema check.
  for (const [paramName, schema] of Object.entries(op.params)) {
    const value = action.params?.[paramName];
    if (schema.required && value === undefined) {
      errors.push({
        code: 'MODULE_ACTION_PARAM_REQUIRED',
        message: `required parameter "${paramName}" missing for operation "${action.name}"`,
        path,
      });
      continue;
    }
    if (value !== undefined && !isStateRef(value)) {
      // Literal — type-check.
      if (!literalMatchesSchema(value, schema)) {
        errors.push({
          code: 'MODULE_ACTION_PARAM_TYPE_MISMATCH',
          message: `parameter "${paramName}" expected ${schema.type}; got ${typeof value}`,
          path,
        });
      }
    }
  }
}

function isStateRef(v: unknown): v is { $state: string } {
  return !!v && typeof v === 'object' && '$state' in (v as object);
}

function literalMatchesSchema(value: unknown, schema: PropSchema): boolean {
  if (schema.array) return Array.isArray(value);
  switch (schema.type) {
    case 'string':  return typeof value === 'string';
    case 'number':  return typeof value === 'number';
    case 'boolean': return typeof value === 'boolean';
    case 'object':  return typeof value === 'object' && value !== null && !Array.isArray(value);
    case 'array':   return Array.isArray(value);
    default:        return false;
  }
}
```

Add a sibling pass that walks every element and (a) checks its `type` resolves via `resolvers.resolveComponent` and (b) checks every required prop in its schema is bound:

```ts
export function validateComponentTypesAndProps(
  expanded: ExpandedSource,
  resolvers: ValidateResolvers,
  errors: UiError[]
): void {
  for (const [screenKey, { spec }] of Object.entries({ ...expanded.layouts, ...expanded.screens })) {
    for (const [elKey, el] of Object.entries(spec.elements)) {
      const componentInfo = resolvers.resolveComponent(el.type);
      if (!componentInfo) {
        errors.push({
          code: 'UNKNOWN_COMPONENT_TYPE',
          message: `unknown component type "${el.type}"`,
          path: `screen:${screenKey}/elements/${elKey}`,
        });
      }
      // Prop schema is supplied by the resolver indirectly — extend the resolver shape
      // (next sub-step) to return prop schema and check required.
    }
  }
}
```

Extend `resolveComponent`'s return shape:

```ts
export type ComponentInfo = {
  childrenModel: 'list' | 'none';
  props: Record<string, PropSchema>;
};
```

Then in `validateComponentTypesAndProps`, for each known component, iterate `componentInfo.props` and ensure every `required: true` prop has a value in `el.props` (literal or `$state`). Push `PROP_REQUIRED_MISSING` per missing prop.

Wire both passes into `validate/index.ts`:

```ts
// after structural pass and after existing reference passes:
validateModuleActions(expanded, resolvers, errors);
validateComponentTypesAndProps(expanded, resolvers, errors);
```

- [archived] **Step 4: Run tests**

Run: `pnpm -F @rntme/ui test --run unit/validate.test.ts`
Expected: all tests pass.

- [archived] **Step 5: Commit**

```bash
git add packages/ui/src/validate/index.ts packages/ui/src/validate/references.ts packages/ui/test/unit/validate.test.ts
git commit -m "feat(ui): reference validation for module-action and component prop schemas"
```

### Task 2.6: Emit — canonicalize `category` → `module` in compiled output

**Files:**
- Modify: `packages/ui/src/emit/http-map.ts`
- Modify: `packages/ui/src/emit/emit.ts`

- [archived] **Step 1: Failing test**

Append to `packages/ui/test/unit/emit.test.ts`:

```ts
describe('emit — module-action canonicalization', () => {
  it('replaces category with concrete module via resolveCategoryToModule', () => {
    const expanded = mkExpandedWithAction({
      kind: 'module-action',
      category: 'analytics',
      name: 'track',
      params: { event: 'x' },
    });
    const result = emit(expanded, /* httpMap */ {}, {
      resolveCategoryToModule: (cat) => cat === 'analytics' ? '@rntme/analytics-google-analytics' : undefined,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const compiledAction = result.value.screens.<screenKey>.actions!.<actionId>;
      expect(compiledAction).toMatchObject({
        kind: 'module-action',
        module: '@rntme/analytics-google-analytics',
        name: 'track',
      });
      expect((compiledAction as any).category).toBeUndefined();
    }
  });

  it('passes through component-bound module-action verbatim (target preserved, no module)', () => {
    const expanded = mkExpandedWithAction({
      kind: 'module-action',
      target: 'editor',
      name: 'toggleBold',
    });
    const result = emit(expanded, {}, { resolveCategoryToModule: () => undefined });
    expect(result.ok).toBe(true);
  });
});
```

(Implement `mkExpandedWithAction` as a small builder in the test file or in a fixture under `test/fixtures/`.)

Run: `pnpm -F @rntme/ui test --run unit/emit.test.ts`
Expected: tests fail (emit doesn't know about `module-action` yet).

- [archived] **Step 2: Implement in emit**

In `packages/ui/src/emit/http-map.ts`, locate `resolveScreenHttp`. Add a branch in the action-walking switch:

```ts
case 'module-action': {
  const compiled: CompiledModuleAction = {
    kind: 'module-action',
    name: action.name,
    params: action.params,
    onSuccess: action.onSuccess,
    onError: action.onError,
  };
  if (action.target) {
    compiled.target = action.target;
  } else if (action.module) {
    compiled.module = action.module;
  } else if (action.category) {
    const resolved = ctx.resolveCategoryToModule(action.category);
    if (!resolved) {
      // Unreachable if validate ran; defensive only.
      throw new Error(`emit: category "${action.category}" not mapped`);
    }
    compiled.module = resolved;
  }
  out.actions[actionId] = compiled;
  break;
}
```

Pass a new `ctx: { resolveCategoryToModule }` from `emit.emit()` down into `resolveScreenHttp`. Update the function signature:

```ts
export function resolveScreenHttp(
  spec: CompiledSpec,
  screen: ScreenDescriptor,
  httpMap: Record<string, HttpEntry>,
  ctx: { resolveCategoryToModule: (cat: string) => string | undefined },
): EmittedScreen { /* ... */ }
```

In `emit/emit.ts`, accept the new ctx param and thread it through. The public `emit()` signature becomes:

```ts
export function emit(
  expanded: ExpandedSource,
  httpMap: Record<string, HttpEntry>,
  ctx: { resolveCategoryToModule: (cat: string) => string | undefined } = { resolveCategoryToModule: () => undefined },
): Result<CompiledArtifact> { /* ... */ }
```

Existing callers (`compile()`) pass through ctx; default no-op preserves behaviour for callers without modules.

- [archived] **Step 3: Run tests**

Run: `pnpm -F @rntme/ui test`
Expected: all tests pass.

- [archived] **Step 4: Commit**

```bash
git add packages/ui/src/emit/http-map.ts packages/ui/src/emit/emit.ts packages/ui/test/unit/emit.test.ts
git commit -m "feat(ui): emit canonicalizes category to concrete module in compiled actions"
```

### Task 2.7: Wire ctx through `compile()`

**Files:**
- Modify: `packages/ui/src/compile.ts`

- [archived] **Step 1: Extend `CompileOptions`**

```ts
export type CompileOptions = {
  sourceDir: string;
  httpMap: Record<string, HttpEntry>;
  resolvers: ValidateResolvers;
  // existing optional fields preserved
};
```

`resolvers.resolveCategoryToModule` is already part of the resolver shape (Task 2.5). In `compile()`, pass `{ resolveCategoryToModule: opts.resolvers.resolveCategoryToModule }` into `emit()`.

- [archived] **Step 2: Run all UI tests**

Run: `pnpm -F @rntme/ui test`
Expected: PASS.

- [archived] **Step 3: Commit**

```bash
git add packages/ui/src/compile.ts
git commit -m "feat(ui): thread resolveCategoryToModule from compile to emit"
```

---

## Phase 3 — `@rntme/ui-runtime`

### Task 3.1: Create `operation-registry.ts`

**Files:**
- Create: `packages/ui-runtime/src/client/operation-registry.ts`
- Create: `packages/ui-runtime/test/unit/operation-registry.test.ts`

- [archived] **Step 1: Write failing test**

Create `packages/ui-runtime/test/unit/operation-registry.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { createOperationRegistry } from '../../src/client/operation-registry.js';

describe('OperationRegistry', () => {
  it('registers and looks up component-bound operations by elementId', () => {
    const reg = createOperationRegistry();
    const handler = vi.fn();
    const unregister = reg.registerComponent('editor', { toggleBold: handler });
    expect(reg.lookupComponent('editor', 'toggleBold')).toBe(handler);
    unregister();
    expect(reg.lookupComponent('editor', 'toggleBold')).toBeUndefined();
  });

  it('registers and looks up module-level operations', () => {
    const reg = createOperationRegistry();
    const handler = vi.fn();
    reg.registerModule('@rntme/analytics-google-analytics', 'track', handler);
    expect(reg.lookupModule('@rntme/analytics-google-analytics', 'track')).toBe(handler);
  });

  it('component registrations on the same elementId merge handlers', () => {
    const reg = createOperationRegistry();
    const a = vi.fn(); const b = vi.fn();
    reg.registerComponent('editor', { toggleBold: a });
    reg.registerComponent('editor', { toggleItalic: b });
    expect(reg.lookupComponent('editor', 'toggleBold')).toBe(a);
    expect(reg.lookupComponent('editor', 'toggleItalic')).toBe(b);
  });

  it('returns undefined for unknown lookups', () => {
    const reg = createOperationRegistry();
    expect(reg.lookupComponent('x', 'y')).toBeUndefined();
    expect(reg.lookupModule('x', 'y')).toBeUndefined();
  });
});
```

Run: `pnpm -F @rntme/ui-runtime test --run unit/operation-registry.test.ts`
Expected: import error (file doesn't exist).

- [archived] **Step 2: Implement**

Create `packages/ui-runtime/src/client/operation-registry.ts`:

```ts
export type OperationHandler = (params: Record<string, unknown>) => void | Promise<void>;
export type Unregister = () => void;

export type OperationRegistry = {
  registerComponent(elementId: string, handlers: Record<string, OperationHandler>): Unregister;
  registerModule(moduleName: string, name: string, handler: OperationHandler): void;
  lookupComponent(elementId: string, name: string): OperationHandler | undefined;
  lookupModule(moduleName: string, name: string): OperationHandler | undefined;
};

export function createOperationRegistry(): OperationRegistry {
  const componentHandlers = new Map<string, Map<string, OperationHandler>>();
  const moduleHandlers = new Map<string, Map<string, OperationHandler>>();

  return {
    registerComponent(elementId, handlers) {
      let bucket = componentHandlers.get(elementId);
      if (!bucket) { bucket = new Map(); componentHandlers.set(elementId, bucket); }
      const added: string[] = [];
      for (const [name, h] of Object.entries(handlers)) {
        bucket.set(name, h);
        added.push(name);
      }
      return () => {
        const b = componentHandlers.get(elementId);
        if (!b) return;
        for (const n of added) b.delete(n);
        if (b.size === 0) componentHandlers.delete(elementId);
      };
    },
    registerModule(moduleName, name, handler) {
      let bucket = moduleHandlers.get(moduleName);
      if (!bucket) { bucket = new Map(); moduleHandlers.set(moduleName, bucket); }
      bucket.set(name, handler);
    },
    lookupComponent(elementId, name) { return componentHandlers.get(elementId)?.get(name); },
    lookupModule(moduleName, name) { return moduleHandlers.get(moduleName)?.get(name); },
  };
}
```

- [archived] **Step 3: Run test**

Run: `pnpm -F @rntme/ui-runtime test --run unit/operation-registry.test.ts`
Expected: PASS.

- [archived] **Step 4: Commit**

```bash
git add packages/ui-runtime/src/client/operation-registry.ts packages/ui-runtime/test/unit/operation-registry.test.ts
git commit -m "feat(ui-runtime): scoped operation registry (component + module)"
```

### Task 3.2: Create `lifecycle-bus.ts`

**Files:**
- Create: `packages/ui-runtime/src/client/lifecycle-bus.ts`
- Create: `packages/ui-runtime/test/unit/lifecycle-bus.test.ts`

- [archived] **Step 1: Write failing test**

```ts
import { describe, expect, it, vi } from 'vitest';
import { createLifecycleBus } from '../../src/client/lifecycle-bus.js';

describe('LifecycleBus', () => {
  it('emits navigate to subscribers', () => {
    const bus = createLifecycleBus();
    const handler = vi.fn();
    bus.on('navigate', handler);
    bus.emit('navigate', { path: '/x', params: { y: '1' } });
    expect(handler).toHaveBeenCalledWith({ path: '/x', params: { y: '1' } });
  });

  it('unsubscribes', () => {
    const bus = createLifecycleBus();
    const handler = vi.fn();
    const off = bus.on('action:dispatched', handler);
    off();
    bus.emit('action:dispatched', { actionId: 'save', kind: 'command', params: {} });
    expect(handler).not.toHaveBeenCalled();
  });

  it('does not throw when no subscribers', () => {
    const bus = createLifecycleBus();
    expect(() => bus.emit('navigate', { path: '/', params: {} })).not.toThrow();
  });
});
```

Run: import error expected.

- [archived] **Step 2: Implement**

```ts
// packages/ui-runtime/src/client/lifecycle-bus.ts
export type LifecycleEvents = {
  'navigate':           { path: string; params: Record<string, string> };
  'action:dispatched':  { actionId: string; kind: string; params: Record<string, unknown> };
  'action:succeeded':   { actionId: string; kind: string; result: unknown };
  'action:failed':      { actionId: string; kind: string; status?: number; error: unknown };
};

export type LifecycleBus = {
  on<K extends keyof LifecycleEvents>(event: K, handler: (e: LifecycleEvents[K]) => void): () => void;
  emit<K extends keyof LifecycleEvents>(event: K, payload: LifecycleEvents[K]): void;
};

export function createLifecycleBus(): LifecycleBus {
  const handlers = new Map<keyof LifecycleEvents, Set<(e: any) => void>>();
  return {
    on(event, handler) {
      let set = handlers.get(event);
      if (!set) { set = new Set(); handlers.set(event, set); }
      set.add(handler as (e: any) => void);
      return () => { set?.delete(handler as (e: any) => void); };
    },
    emit(event, payload) {
      handlers.get(event)?.forEach((h) => h(payload));
    },
  };
}
```

- [archived] **Step 3: Run test**

Run: `pnpm -F @rntme/ui-runtime test --run unit/lifecycle-bus.test.ts`
Expected: PASS.

- [archived] **Step 4: Commit**

```bash
git add packages/ui-runtime/src/client/lifecycle-bus.ts packages/ui-runtime/test/unit/lifecycle-bus.test.ts
git commit -m "feat(ui-runtime): lifecycle event bus"
```

### Task 3.3: Create `transport-chain.ts`

**Files:**
- Create: `packages/ui-runtime/src/client/transport-chain.ts`
- Create: `packages/ui-runtime/test/unit/transport-chain.test.ts`

- [archived] **Step 1: Failing test**

```ts
import { describe, expect, it, vi } from 'vitest';
import { createTransportChain } from '../../src/client/transport-chain.js';

describe('TransportChain', () => {
  it('returns base fetch when no middleware registered', async () => {
    const baseFetch = vi.fn(async () => new Response('ok'));
    const chain = createTransportChain(baseFetch);
    const r = await chain.fetch(new Request('https://x/y'));
    expect(await r.text()).toBe('ok');
    expect(baseFetch).toHaveBeenCalled();
  });

  it('runs registered middleware around base fetch (single mw)', async () => {
    const baseFetch = vi.fn(async (req: Request) => {
      expect(req.headers.get('authorization')).toBe('Bearer t');
      return new Response('ok');
    });
    const chain = createTransportChain(baseFetch);
    chain.use(async (req, next) => {
      const newReq = new Request(req, { headers: { ...Object.fromEntries(req.headers), authorization: 'Bearer t' } });
      return next(newReq);
    });
    await chain.fetch(new Request('https://x/y'));
    expect(baseFetch).toHaveBeenCalled();
  });

  it('composes multiple middleware in registration order (later wraps earlier)', async () => {
    const trace: string[] = [];
    const baseFetch = vi.fn(async () => { trace.push('base'); return new Response('ok'); });
    const chain = createTransportChain(baseFetch);
    chain.use(async (req, next) => { trace.push('mw1-pre'); const r = await next(req); trace.push('mw1-post'); return r; });
    chain.use(async (req, next) => { trace.push('mw2-pre'); const r = await next(req); trace.push('mw2-post'); return r; });
    await chain.fetch(new Request('https://x/y'));
    expect(trace).toEqual(['mw2-pre', 'mw1-pre', 'base', 'mw1-post', 'mw2-post']);
  });
});
```

- [archived] **Step 2: Implement**

```ts
// packages/ui-runtime/src/client/transport-chain.ts
export type TransportMiddleware = (
  req: Request,
  next: (req: Request) => Promise<Response>,
) => Promise<Response>;

export type TransportChain = {
  use(mw: TransportMiddleware): void;
  fetch(req: Request): Promise<Response>;
};

export function createTransportChain(baseFetch: (req: Request) => Promise<Response>): TransportChain {
  const middlewares: TransportMiddleware[] = [];
  return {
    use(mw) { middlewares.push(mw); },
    fetch(req) {
      const composed = middlewares.reduceRight<(req: Request) => Promise<Response>>(
        (next, mw) => (r) => mw(r, next),
        baseFetch,
      );
      return composed(req);
    },
  };
}
```

- [archived] **Step 3: Run test, then commit**

Run: `pnpm -F @rntme/ui-runtime test --run unit/transport-chain.test.ts`
Expected: PASS.

```bash
git add packages/ui-runtime/src/client/transport-chain.ts packages/ui-runtime/test/unit/transport-chain.test.ts
git commit -m "feat(ui-runtime): transport-chain composable fetch middleware"
```

### Task 3.4: Create `module-context.ts`

**Files:**
- Create: `packages/ui-runtime/src/client/module-context.ts`

- [archived] **Step 1: Implement**

```ts
// packages/ui-runtime/src/client/module-context.ts
import type { OperationRegistry } from './operation-registry.js';
import type { LifecycleBus } from './lifecycle-bus.js';
import type { TransportChain, TransportMiddleware } from './transport-chain.js';
import type { StateStore } from '@json-render/core';

export type ModuleBootContext = {
  config: Record<string, unknown>;
  state: {
    get(path: string): unknown;
    set(path: string, value: unknown): void;
    subscribe(path: string, handler: (value: unknown) => void): () => void;
  };
  transport: { use(mw: TransportMiddleware): void };
  on: LifecycleBus['on'];
  registerOperation(name: string, handler: (params: Record<string, unknown>) => void | Promise<void>): void;
};

export function createModuleBootContext(opts: {
  moduleName: string;
  config: Record<string, unknown>;
  store: StateStore;
  bus: LifecycleBus;
  chain: TransportChain;
  registry: OperationRegistry;
}): ModuleBootContext {
  return {
    config: opts.config,
    state: {
      get: (p) => opts.store.get(p),
      set: (p, v) => opts.store.set(p, v),
      subscribe: (p, h) => opts.store.subscribe(p, h),
    },
    transport: { use: (mw) => opts.chain.use(mw) },
    on: opts.bus.on,
    registerOperation: (name, h) => opts.registry.registerModule(opts.moduleName, name, h),
  };
}
```

- [archived] **Step 2: Typecheck and commit**

Run: `pnpm -F @rntme/ui-runtime typecheck`
Expected: PASS.

```bash
git add packages/ui-runtime/src/client/module-context.ts
git commit -m "feat(ui-runtime): ModuleBootContext factory"
```

### Task 3.5: Create `hooks.ts` (`useTransport`, `useStateStore`, `useOperationRegistry`)

**Files:**
- Create: `packages/ui-runtime/src/client/hooks.ts`

- [archived] **Step 1: Implement**

```ts
// packages/ui-runtime/src/client/hooks.ts
import { createContext, useContext } from 'react';
import type { OperationRegistry } from './operation-registry.js';
import type { TransportChain } from './transport-chain.js';
import type { StateStore } from '@json-render/core';

const TransportContext = createContext<TransportChain | null>(null);
const StoreContext     = createContext<StateStore | null>(null);
const RegistryContext  = createContext<OperationRegistry | null>(null);

export const TransportProvider = TransportContext.Provider;
export const StoreProvider     = StoreContext.Provider;
export const RegistryProvider  = RegistryContext.Provider;

export function useTransport(): (req: Request) => Promise<Response> {
  const c = useContext(TransportContext);
  if (!c) throw new Error('useTransport requires <TransportProvider>');
  return c.fetch.bind(c);
}

export function useStateStore(): StateStore {
  const c = useContext(StoreContext);
  if (!c) throw new Error('useStateStore requires <StoreProvider>');
  return c;
}

export function useOperationRegistry(): {
  register(elementId: string, handlers: Record<string, (params: Record<string, unknown>) => void | Promise<void>>): () => void;
} {
  const c = useContext(RegistryContext);
  if (!c) throw new Error('useOperationRegistry requires <RegistryProvider>');
  return { register: (eid, hs) => c.registerComponent(eid, hs) };
}
```

- [archived] **Step 2: Typecheck and commit**

```bash
pnpm -F @rntme/ui-runtime typecheck
git add packages/ui-runtime/src/client/hooks.ts
git commit -m "feat(ui-runtime): React context hooks (useTransport/useStateStore/useOperationRegistry)"
```

### Task 3.6: Create `visibility.ts` evaluator

**Files:**
- Create: `packages/ui-runtime/src/client/visibility.ts`
- Create: `packages/ui-runtime/test/unit/visibility.test.ts`

- [archived] **Step 1: Failing test**

```ts
import { describe, expect, it } from 'vitest';
import { evaluateVisible } from '../../src/client/visibility.js';

const stateGet = (state: Record<string, unknown>) => (p: string) => state[p];

describe('evaluateVisible', () => {
  it('truthy form', () => {
    expect(evaluateVisible(undefined, stateGet({}))).toBe(true);                    // no clause = visible
    expect(evaluateVisible({ $state: '/x' }, stateGet({ '/x': 'a' }))).toBe(true);
    expect(evaluateVisible({ $state: '/x' }, stateGet({ '/x': null }))).toBe(false);
    expect(evaluateVisible({ $state: '/x' }, stateGet({ '/x': '' }))).toBe(false);
  });

  it('eq operator', () => {
    expect(evaluateVisible({ $state: '/auth/status', eq: 'authed' }, stateGet({ '/auth/status': 'authed' }))).toBe(true);
    expect(evaluateVisible({ $state: '/auth/status', eq: 'authed' }, stateGet({ '/auth/status': 'anon' }))).toBe(false);
  });

  it('contains operator on arrays', () => {
    expect(evaluateVisible({ $state: '/u/roles', contains: 'admin' }, stateGet({ '/u/roles': ['admin', 'user'] }))).toBe(true);
    expect(evaluateVisible({ $state: '/u/roles', contains: 'admin' }, stateGet({ '/u/roles': ['user'] }))).toBe(false);
  });

  it('contains operator on strings', () => {
    expect(evaluateVisible({ $state: '/q', contains: 'foo' }, stateGet({ '/q': 'food' }))).toBe(true);
    expect(evaluateVisible({ $state: '/q', contains: 'foo' }, stateGet({ '/q': 'bar' }))).toBe(false);
  });

  it('not operator', () => {
    expect(evaluateVisible({ $state: '/x', not: true }, stateGet({ '/x': null }))).toBe(true);
    expect(evaluateVisible({ $state: '/x', not: true }, stateGet({ '/x': 'a' }))).toBe(false);
  });
});
```

- [archived] **Step 2: Implement**

```ts
// packages/ui-runtime/src/client/visibility.ts
export type Visible =
  | undefined
  | { $state: string }
  | { $state: string; eq: unknown }
  | { $state: string; contains: unknown }
  | { $state: string; not: true };

export function evaluateVisible(clause: Visible, get: (path: string) => unknown): boolean {
  if (clause === undefined) return true;
  const value = get(clause.$state);
  if ('eq' in clause)       return deepEq(value, clause.eq);
  if ('contains' in clause) return contains(value, clause.contains);
  if ('not' in clause)      return !truthy(value);
  return truthy(value);
}

function truthy(v: unknown): boolean {
  if (v === undefined || v === null) return false;
  if (v === '') return false;
  if (v === 0) return false;
  if (v === false) return false;
  if (Array.isArray(v) && v.length === 0) return false;
  return true;
}

function contains(v: unknown, needle: unknown): boolean {
  if (Array.isArray(v))    return v.some((x) => deepEq(x, needle));
  if (typeof v === 'string' && typeof needle === 'string') return v.includes(needle);
  return false;
}

function deepEq(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a && b && typeof a === 'object') return JSON.stringify(a) === JSON.stringify(b);
  return false;
}
```

- [archived] **Step 3: Run test, commit**

```bash
pnpm -F @rntme/ui-runtime test --run unit/visibility.test.ts
git add packages/ui-runtime/src/client/visibility.ts packages/ui-runtime/test/unit/visibility.test.ts
git commit -m "feat(ui-runtime): visible evaluator (truthy + eq + contains + not)"
```

### Task 3.7: Runtime dispatch — `module-action` through existing json-render `dispatch`

**Files:**
- Modify: `packages/ui-runtime/src/client/driver.ts`

- [archived] **Step 1: Failing test in `driver.test.ts`**

Append:

```ts
describe('driver — module-action dispatch', () => {
  it('dispatches component-bound op via target', async () => {
    const reg = createOperationRegistry();
    const handler = vi.fn();
    reg.registerComponent('editor', { toggleBold: handler });
    const driver = createDriver({ /* existing fixtures */, registry: reg });
    await driver.dispatchAction({ kind: 'module-action', target: 'editor', name: 'toggleBold' }, () => ({}));
    expect(handler).toHaveBeenCalledWith({});
  });

  it('dispatches module-level op via module', async () => {
    const reg = createOperationRegistry();
    const handler = vi.fn();
    reg.registerModule('@rntme/x', 'track', handler);
    const driver = createDriver({ /* ... */, registry: reg });
    await driver.dispatchAction({ kind: 'module-action', module: '@rntme/x', name: 'track', params: { event: 'a' } }, () => ({ event: 'a' }));
    expect(handler).toHaveBeenCalledWith({ event: 'a' });
  });

  // Do not add driver-level action-id array dispatch. json-render already runs
  // arrays of binding objects sequentially before they reach this handler.
});
```

- [archived] **Step 2: Implement in `driver.ts`**

Add to `DriverOptions`:

```ts
export type DriverOptions = {
  fetchFn: (req: Request) => Promise<Response>;
  onStateChange: (path: string, value: unknown) => void;
  onNavigate: (path: string) => void;
  defaultHeaders?: Record<string, string>;
  registry: OperationRegistry;
  bus: LifecycleBus;
};
```

Extend `dispatchAction` switch:

```ts
case 'module-action': {
  bus.emit('action:dispatched', { actionId, kind: 'module-action', params: action.params ?? {} });
  try {
    let handler: OperationHandler | undefined;
    if (action.target) handler = registry.lookupComponent(action.target, action.name);
    else if (action.module) handler = registry.lookupModule(action.module, action.name);
    if (!handler) {
      bus.emit('action:failed', { actionId, kind: 'module-action', error: 'handler not registered' });
      throw new Error(`module-action ${action.name} has no registered handler`);
    }
    const resolvedParams = resolveParams(action.params ?? {}, stateGetter);
    const result = await handler(resolvedParams);
    bus.emit('action:succeeded', { actionId, kind: 'module-action', result });
    if (action.onSuccess?.navigateTo) onNavigate(action.onSuccess.navigateTo);
    return result;
  } catch (e) {
    bus.emit('action:failed', { actionId, kind: 'module-action', error: e });
    throw e;
  }
}
```

Wire `module-action` into the existing `createRegistry(...).actions.dispatch` path in `packages/ui-runtime/src/client/registry.ts`; json-render continues to resolve `on.press`/`on.click` binding objects and arrays before calling `dispatch`.

- [archived] **Step 3: Tests pass, commit**

```bash
pnpm -F @rntme/ui-runtime test --run unit/driver.test.ts
git add packages/ui-runtime/src/client/driver.ts packages/ui-runtime/test/unit/driver.test.ts
git commit -m "feat(ui-runtime): dispatch module-action through runtime registry"
```

### Task 3.8: Driver gating rule — skip data fetches under hidden layouts

**Files:**
- Modify: `packages/ui-runtime/src/client/driver.ts`
- Modify: `packages/ui-runtime/src/client/entry.tsx`

- [archived] **Step 1: Failing test**

Append to `driver.test.ts`:

```ts
describe('driver — visibility gating', () => {
  it('skips data fetches when layout visible evaluates false', async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({})));
    const stateValues: Record<string, unknown> = { '/auth/status': 'anon' };
    const driver = createDriver({ /* ... */, fetchFn });
    await driver.enterScreen({
      layout: { /* visible: { $state: '/auth/status', eq: 'authed' } */ },
      screen: { data: { '/data/notes': { binding: 'listNotes' } } },
    }, (p) => stateValues[p]);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('runs data fetches when layout visible evaluates true', async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ ok: true })));
    const stateValues: Record<string, unknown> = { '/auth/status': 'authed' };
    const driver = createDriver({ /* ... */, fetchFn });
    await driver.enterScreen({ /* ... */ }, (p) => stateValues[p]);
    expect(fetchFn).toHaveBeenCalled();
  });
});
```

- [archived] **Step 2: Implement**

Inside `driver.enterScreen`, after resolving the layout:

```ts
import { evaluateVisible } from './visibility.js';

async enterScreen(args: { layout?: CompiledScreen; screen: CompiledScreen }, stateGetter: (p: string) => unknown) {
  if (args.layout?.spec.elements[args.layout.spec.root]?.visible) {
    const visible = evaluateVisible(
      args.layout.spec.elements[args.layout.spec.root].visible as Visible,
      stateGetter,
    );
    if (!visible) return; // skip both layout and screen fetches
  }
  // existing fetch loop:
  if (args.layout?.data) await fetchAll(args.layout.data);
  if (args.screen?.data) await fetchAll(args.screen.data);
}
```

In `entry.tsx`'s `enterRoute`, subscribe to `/auth/status` (or any state-path referenced in root layout's `visible`) and re-call `enterScreen` when it flips.

Identify the relevant state paths by walking the compiled layout's root `visible` for `$state`. Store the path on a small reactive subscription. When the path's value changes, re-evaluate.

- [archived] **Step 3: Tests pass, commit**

```bash
pnpm -F @rntme/ui-runtime test --run unit/driver.test.ts
git add packages/ui-runtime/src/client/driver.ts packages/ui-runtime/src/client/entry.tsx packages/ui-runtime/test/unit/driver.test.ts
git commit -m "feat(ui-runtime): driver skips data-fetch when layout root is visible:false"
```

### Task 3.9: Update `entry.tsx` — boot orchestrator and dynamic component catalog

**Files:**
- Modify: `packages/ui-runtime/src/client/entry.tsx`

- [archived] **Step 1: Define new public types and bootstrap loop**

Replace the existing `hydrateApp` and supporting setup. Pseudocode:

```tsx
import { createTransportChain }      from './transport-chain.js';
import { createOperationRegistry }   from './operation-registry.js';
import { createLifecycleBus }        from './lifecycle-bus.js';
import { createModuleBootContext }   from './module-context.js';
import { TransportProvider, StoreProvider, RegistryProvider } from './hooks.js';
import { evaluateVisible }           from './visibility.js';
import { createStateStore }          from '@json-render/core';

export type ModuleSpec = {
  name: string;
  boot?: (ctx: ModuleBootContext) => void | Promise<void>;
  bootTimeoutMs?: number;
};

export type HydrateAppOptions = {
  rootSelector: string;
  components: Record<string, React.FC<any>>;     // module-contributed catalog
  modules: ModuleSpec[];                          // boot list (module-skeleton order)
};

export async function hydrateApp(opts: HydrateAppOptions): Promise<void> {
  // 1. Public config.
  const configResp = await fetch('/config.json');
  const config: Record<string, Record<string, unknown>> = configResp.ok ? await configResp.json() : {};

  // 2. Core registries.
  const store    = createStateStore();
  const bus      = createLifecycleBus();
  const chain    = createTransportChain((req) => fetch(req));
  const registry = createOperationRegistry();

  // 3. Run boots in order.
  for (const m of opts.modules) {
    if (!m.boot) continue;
    const ctx = createModuleBootContext({
      moduleName: m.name,
      config: config[m.name] ?? {},
      store, bus, chain, registry,
    });
    const timeoutMs = m.bootTimeoutMs ?? 10000;
    await runWithTimeout(() => Promise.resolve(m.boot!(ctx)), timeoutMs, m.name);
  }

  // 4. Mount AppShell.
  const root = document.querySelector(opts.rootSelector);
  if (!root) throw new Error(`root not found: ${opts.rootSelector}`);
  ReactDOM.createRoot(root).render(
    <TransportProvider value={chain}>
      <StoreProvider value={store}>
        <RegistryProvider value={registry}>
          <AppShell components={opts.components} bus={bus} chain={chain} registry={registry} />
        </RegistryProvider>
      </StoreProvider>
    </TransportProvider>
  );
}

async function runWithTimeout<T>(fn: () => Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label} boot timeout after ${ms}ms`)), ms)),
  ]);
}
```

`AppShell`'s existing implementation reads layout/screen JSON and wires `<Renderer>` from `@json-render/react`. Pass `components` down so the renderer's catalog merges shadcn defaults with module contributions:

```tsx
function AppShell({ components, bus, chain, registry }: { components: Record<string, FC<any>>; bus: LifecycleBus; chain: TransportChain; registry: OperationRegistry }) {
  const driver = useMemo(() => createDriver({ fetchFn: chain.fetch.bind(chain), bus, registry, /* ... */ }), [chain, bus, registry]);
  // existing route + screen/layout loading; pass `components` into the json-render registry.
}
```

- [archived] **Step 2: Update `index.ts` exports**

In `packages/ui-runtime/src/client/index.ts`:

```ts
export { hydrateApp, type ModuleSpec, type HydrateAppOptions } from './entry.js';
export { useTransport, useStateStore, useOperationRegistry, TransportProvider, StoreProvider, RegistryProvider } from './hooks.js';
export type { ModuleBootContext } from './module-context.js';
export type { TransportMiddleware } from './transport-chain.js';
export type { LifecycleEvents } from './lifecycle-bus.js';
export { evaluateVisible } from './visibility.js';
export type { Visible } from './visibility.js';
```

- [archived] **Step 3: Smoke build**

Run: `pnpm -F @rntme/ui-runtime build`
Expected: PASS.

- [archived] **Step 4: Commit**

```bash
git add packages/ui-runtime/src/client/entry.tsx packages/ui-runtime/src/client/index.ts
git commit -m "feat(ui-runtime): boot orchestrator + dynamic component catalog + new public exports"
```

---

## Phase 4 — `@rntme/blueprint` compose

### Task 4.1: Module discovery — `compose/modules.ts`

**Files:**
- Create: `packages/blueprint/src/compose/modules.ts`
- Create: `packages/blueprint/test/unit/compose-modules.test.ts`
- Create: `packages/blueprint/test/fixtures/project-with-modules/` (project.json + 2 fake module dirs)

- [archived] **Step 1: Failing test**

```ts
import { describe, expect, it } from 'vitest';
import { discoverModules } from '../../src/compose/modules.js';

describe('discoverModules', () => {
  it('reads project.json#modules and resolves each manifest', async () => {
    const result = await discoverModules({
      projectDir: 'packages/blueprint/test/fixtures/project-with-modules',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Object.keys(result.value)).toContain('@rntme/presentation-md-mermaid');
      expect(result.value['@rntme/presentation-md-mermaid'].manifest.client?.components).toHaveLength(2);
    }
  });

  it('returns BLUEPRINT_MODULE_NOT_FOUND when package does not resolve', async () => {
    const result = await discoverModules({
      projectDir: 'packages/blueprint/test/fixtures/project-with-modules',
      // overrides forcing one module name to be missing
    });
    // expect at least one error with code BLUEPRINT_MODULE_NOT_FOUND
  });
});
```

Create the fixture: `packages/blueprint/test/fixtures/project-with-modules/project.json`:

```jsonc
{
  "name": "fixture-app",
  "services": ["app"],
  "modules": {
    "presentation-md": { "package": "@rntme/presentation-md-mermaid" }
  }
}
```

Plus a fake `node_modules/@rntme/presentation-md-mermaid/module.json` (or use a workspace-symlinked package once Phase 5 is built; for v1 of this test, mock the resolver).

- [archived] **Step 2: Implement**

```ts
// packages/blueprint/src/compose/modules.ts
import { readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createRequire } from 'node:module';
import { parseModuleManifest, type ModuleManifest } from '@rntme/module-skeleton';

const require = createRequire(import.meta.url);

export type DiscoveredModule = {
  manifest: ModuleManifest;
  packageDir: string;          // absolute path to the module's directory
  projectKey: string;           // key from project.json#modules (e.g. "presentation-md", "analytics")
  publicConfig: Record<string, unknown>;
};

export type DiscoverError = { code: string; message: string; path: string };
export type DiscoverResult =
  | { ok: true; value: Record<string, DiscoveredModule> }   // keyed by manifest.name
  | { ok: false; errors: DiscoverError[] };

export async function discoverModules(opts: {
  projectDir: string;
  resolvePackage?: (name: string, base: string) => string;  // override for testing
}): Promise<DiscoverResult> {
  const errors: DiscoverError[] = [];
  const out: Record<string, DiscoveredModule> = {};
  const projectJson = JSON.parse(await readFile(join(opts.projectDir, 'project.json'), 'utf-8'));
  const modules: Record<string, { package: string; publicConfig?: Record<string, unknown> }> = projectJson.modules ?? {};
  for (const [projectKey, moduleRef] of Object.entries(modules)) {
    const packageName = moduleRef.package;
    let packageDir: string;
    try {
      packageDir = (opts.resolvePackage ?? defaultResolvePackage)(packageName, opts.projectDir);
    } catch {
      errors.push({
        code: 'BLUEPRINT_MODULE_NOT_FOUND',
        message: `module package "${packageName}" not found in workspace`,
        path: `project.json#modules.${projectKey}`,
      });
      continue;
    }
    let manifestRaw: unknown;
    try {
      manifestRaw = JSON.parse(await readFile(join(packageDir, 'module.json'), 'utf-8'));
    } catch (e) {
      errors.push({
        code: 'BLUEPRINT_MODULE_MANIFEST_UNREADABLE',
        message: `cannot read ${packageName}/module.json: ${(e as Error).message}`,
        path: packageDir,
      });
      continue;
    }
    const parsed = parseModuleManifest(manifestRaw);
    if (!parsed.ok) {
      for (const e of parsed.errors) errors.push({ code: 'BLUEPRINT_MODULE_MANIFEST_INVALID', message: e.message, path: `${packageName}/module.json:${e.path}` });
      continue;
    }
    if (parsed.value.category && parsed.value.category !== projectKey) {
      errors.push({
        code: 'BLUEPRINT_CATEGORY_MISMATCH',
        message: `module "${packageName}" declares category "${parsed.value.category}" but is wired under key "${projectKey}"`,
        path: `project.json#modules.${projectKey}`,
      });
      continue;
    }
    out[parsed.value.name] = { manifest: parsed.value, packageDir, projectKey, publicConfig: moduleRef.publicConfig ?? {} };
  }
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: out };
}

function defaultResolvePackage(name: string, base: string): string {
  // Use Node resolve from project dir.
  const req = require.resolve(`${name}/module.json`, { paths: [base, process.cwd()] });
  return resolve(req, '..');
}
```

(Adjust import style / module resolution to whatever the existing blueprint package uses; the project may be ESM-only.)

- [archived] **Step 3: Run test, commit**

```bash
pnpm -F @rntme/blueprint test --run unit/compose-modules.test.ts
git add packages/blueprint/src/compose/modules.ts packages/blueprint/test packages/blueprint/test/fixtures/project-with-modules
git commit -m "feat(blueprint): discoverModules — read project.json#modules and parse manifests"
```

### Task 4.2: Build catalog — `compose/catalog.ts`

**Files:**
- Create: `packages/blueprint/src/compose/catalog.ts`
- Create: `packages/blueprint/test/unit/compose-catalog.test.ts`

- [archived] **Step 1: Failing test**

```ts
import { describe, expect, it } from 'vitest';
import { buildCatalog } from '../../src/compose/catalog.js';

describe('buildCatalog', () => {
  it('merges component declarations from all modules', () => {
    const discovered = {
      '@rntme/a': { manifest: { name: '@rntme/a', version: '0', client: { entry: './c/i.ts', components: [{ type: 'X', props: {} }] } } as any, packageDir: '/a', projectKey: 'a' },
      '@rntme/b': { manifest: { name: '@rntme/b', version: '0', client: { entry: './c/i.ts', components: [{ type: 'Y', props: {} }] } } as any, packageDir: '/b', projectKey: 'b' },
    };
    const r = buildCatalog(discovered);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.components.map((c) => c.type).sort()).toEqual(['X', 'Y']);
    }
  });

  it('flags BLUEPRINT_DUPLICATE_COMPONENT when two modules declare same type', () => {
    const discovered = {
      '@rntme/a': { manifest: { client: { components: [{ type: 'Markdown', props: {} }] } } as any, packageDir: '/a', projectKey: 'a' },
      '@rntme/b': { manifest: { client: { components: [{ type: 'Markdown', props: {} }] } } as any, packageDir: '/b', projectKey: 'b' },
    };
    const r = buildCatalog(discovered);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0].code).toBe('BLUEPRINT_DUPLICATE_COMPONENT');
  });

  it('builds categoryToModule map from manifests', () => {
    const discovered = {
      '@rntme/analytics-google-analytics': { manifest: { category: 'analytics', client: {} } as any, packageDir: '/g', projectKey: 'analytics' },
    };
    const r = buildCatalog(discovered);
    if (r.ok) expect(r.value.categoryToModule['analytics']).toBe('@rntme/analytics-google-analytics');
  });
});
```

- [archived] **Step 2: Implement**

```ts
// packages/blueprint/src/compose/catalog.ts
import type { DiscoveredModule } from './modules.js';
import type { PropSchema } from '@rntme/module-skeleton';

export type CatalogManifest = {
  components: Array<{ type: string; module: string; props: Record<string, PropSchema> }>;
  operations: Array<{ name: string; module: string; appliesTo: string[] | null; params: Record<string, PropSchema>; category: string | null }>;
  modulesWithBoot: string[];
  categoryToModule: Record<string, string>;
};

export type CatalogError = { code: string; message: string; path: string };
export type CatalogResult =
  | { ok: true; value: CatalogManifest }
  | { ok: false; errors: CatalogError[] };

export function buildCatalog(discovered: Record<string, DiscoveredModule>): CatalogResult {
  const errors: CatalogError[] = [];
  const components: CatalogManifest['components'] = [];
  const operations: CatalogManifest['operations'] = [];
  const modulesWithBoot: string[] = [];
  const categoryToModule: Record<string, string> = {};
  const seenComponentTypes = new Map<string, string>();

  for (const [moduleName, mod] of Object.entries(discovered)) {
    const m = mod.manifest;
    if (m.category) {
      if (categoryToModule[m.category] && categoryToModule[m.category] !== moduleName) {
        errors.push({ code: 'BLUEPRINT_CATEGORY_AMBIGUOUS', message: `category "${m.category}" mapped to both "${categoryToModule[m.category]}" and "${moduleName}"`, path: `project.json#modules` });
      } else {
        categoryToModule[m.category] = moduleName;
      }
    }
    if (m.client?.boot) modulesWithBoot.push(moduleName);
    for (const c of m.client?.components ?? []) {
      const prev = seenComponentTypes.get(c.type);
      if (prev) {
        errors.push({ code: 'BLUEPRINT_DUPLICATE_COMPONENT', message: `component type "${c.type}" declared by both "${prev}" and "${moduleName}"`, path: `${moduleName}/module.json` });
      } else {
        seenComponentTypes.set(c.type, moduleName);
        components.push({ type: c.type, module: moduleName, props: c.props });
      }
    }
    for (const op of m.client?.operations ?? []) {
      operations.push({
        name: op.name,
        module: moduleName,
        appliesTo: op.appliesTo ?? null,
        params: op.params ?? {},
        category: m.category ?? null,
      });
    }
  }
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: { components, operations, modulesWithBoot, categoryToModule } };
}
```

- [archived] **Step 3: Test, commit**

```bash
pnpm -F @rntme/blueprint test --run unit/compose-catalog.test.ts
git add packages/blueprint/src/compose/catalog.ts packages/blueprint/test/unit/compose-catalog.test.ts
git commit -m "feat(blueprint): buildCatalog merges module component/operation declarations"
```

### Task 4.3: Public-config validation — `compose/validate-modules.ts`

**Files:**
- Create: `packages/blueprint/src/compose/validate-modules.ts`
- Create: `packages/blueprint/test/unit/validate-modules.test.ts`

- [archived] **Step 1: Failing test**

```ts
import { describe, expect, it } from 'vitest';
import { validatePublicConfig } from '../../src/compose/validate-modules.js';

describe('validatePublicConfig', () => {
  it('passes when all required keys present and types match', () => {
    const r = validatePublicConfig({
      '@rntme/analytics-google-analytics': { measurementId: { type: 'string', required: true } },
    }, {
      '@rntme/analytics-google-analytics': { measurementId: 'G-XYZ' },
    });
    expect(r).toEqual([]);
  });

  it('flags BLUEPRINT_CONFIG_REQUIRED_MISSING', () => {
    const r = validatePublicConfig({
      '@rntme/x': { token: { type: 'string', required: true } },
    }, { '@rntme/x': {} });
    expect(r[0].code).toBe('BLUEPRINT_CONFIG_REQUIRED_MISSING');
  });

  it('flags BLUEPRINT_CONFIG_TYPE_MISMATCH', () => {
    const r = validatePublicConfig({
      '@rntme/x': { count: { type: 'number', required: true } },
    }, { '@rntme/x': { count: 'not-a-number' } });
    expect(r[0].code).toBe('BLUEPRINT_CONFIG_TYPE_MISMATCH');
  });
});
```

- [archived] **Step 2: Implement**

```ts
// packages/blueprint/src/compose/validate-modules.ts
import type { PropSchema } from '@rntme/module-skeleton';

export type ValidateError = { code: string; message: string; path: string };

export function validatePublicConfig(
  schemas: Record<string, Record<string, PropSchema>>,
  configs: Record<string, Record<string, unknown>>,
): ValidateError[] {
  const errors: ValidateError[] = [];
  for (const [moduleName, schema] of Object.entries(schemas)) {
    const cfg = configs[moduleName] ?? {};
    for (const [key, propSchema] of Object.entries(schema)) {
      if (propSchema.required && !(key in cfg)) {
        errors.push({ code: 'BLUEPRINT_CONFIG_REQUIRED_MISSING', message: `${moduleName}: required public-config key "${key}" missing`, path: `${moduleName}.${key}` });
        continue;
      }
      if (key in cfg && !literalMatchesSchema(cfg[key], propSchema)) {
        errors.push({ code: 'BLUEPRINT_CONFIG_TYPE_MISMATCH', message: `${moduleName}.${key}: expected ${propSchema.type} got ${typeof cfg[key]}`, path: `${moduleName}.${key}` });
      }
    }
  }
  return errors;
}

function literalMatchesSchema(v: unknown, s: PropSchema): boolean {
  if (s.array) return Array.isArray(v);
  switch (s.type) {
    case 'string':  return typeof v === 'string';
    case 'number':  return typeof v === 'number';
    case 'boolean': return typeof v === 'boolean';
    case 'object':  return typeof v === 'object' && v !== null && !Array.isArray(v);
    case 'array':   return Array.isArray(v);
  }
  return false;
}
```

- [archived] **Step 3: Test, commit**

```bash
pnpm -F @rntme/blueprint test --run unit/validate-modules.test.ts
git add packages/blueprint/src/compose/validate-modules.ts packages/blueprint/test/unit/validate-modules.test.ts
git commit -m "feat(blueprint): validatePublicConfig — required + type checks"
```

### Task 4.4: Virtual entry generator — `compose/virtual-entry.ts`

**Files:**
- Create: `packages/blueprint/src/compose/virtual-entry.ts`
- Create: `packages/blueprint/test/unit/virtual-entry.test.ts`

- [archived] **Step 1: Failing test**

```ts
import { describe, expect, it } from 'vitest';
import { renderVirtualEntry } from '../../src/compose/virtual-entry.js';

describe('renderVirtualEntry', () => {
  it('emits importable virtual entry from catalog', () => {
    const catalog = {
      components: [
        { type: 'Markdown', module: '@rntme/presentation-md-mermaid', props: {} },
        { type: 'Mermaid',  module: '@rntme/presentation-md-mermaid', props: {} },
      ],
      operations: [],
      modulesWithBoot: ['@rntme/analytics-google-analytics'],
      categoryToModule: {},
    } as any;
    const result = renderVirtualEntry(catalog);
    expect(result).toContain("import * as mod_0 from '@rntme/presentation-md-mermaid/client'");
    expect(result).toContain("import * as mod_1 from '@rntme/analytics-google-analytics/client'");
    expect(result).toContain('Markdown: mod_0.Markdown');
    expect(result).toContain('Mermaid: mod_0.Mermaid');
    expect(result).toContain("name: '@rntme/analytics-google-analytics'");
  });
});
```

- [archived] **Step 2: Implement**

```ts
// packages/blueprint/src/compose/virtual-entry.ts
import type { CatalogManifest } from './catalog.js';

export function renderVirtualEntry(catalog: CatalogManifest): string {
  // Collect every module that contributes either components or boot.
  const moduleSet = new Set<string>();
  for (const c of catalog.components) moduleSet.add(c.module);
  for (const m of catalog.modulesWithBoot) moduleSet.add(m);
  const modules = [...moduleSet];
  const moduleAlias = new Map<string, string>();
  modules.forEach((m, i) => moduleAlias.set(m, `mod_${i}`));

  const importLines = modules.map((m) => `import * as ${moduleAlias.get(m)} from '${m}/client';`).join('\n');

  const componentEntries = catalog.components
    .map((c) => `  ${JSON.stringify(c.type)}: ${moduleAlias.get(c.module)}.${c.type}`)
    .join(',\n');

  const moduleSpecs = catalog.modulesWithBoot
    .map((m) => `  { name: ${JSON.stringify(m)}, boot: ${moduleAlias.get(m)}.boot }`)
    .join(',\n');

  return `// AUTO-GENERATED — do not edit
import { hydrateApp } from '@rntme/ui-runtime/client';
${importLines}

const components = {
${componentEntries}
};

const modules = [
${moduleSpecs}
];

hydrateApp({ rootSelector: '#root', components, modules });
`;
}
```

- [archived] **Step 3: Test, commit**

```bash
pnpm -F @rntme/blueprint test --run unit/virtual-entry.test.ts
git add packages/blueprint/src/compose/virtual-entry.ts packages/blueprint/test/unit/virtual-entry.test.ts
git commit -m "feat(blueprint): renderVirtualEntry emits ESM SPA bootstrap from catalog"
```

### Task 4.5: Wire compose flow

**Files:**
- Modify: `packages/blueprint/src/compose/index.ts` (or wherever the existing compose entry lives)

- [archived] **Step 1: Identify the existing compose entry function and add module-discovery**

Pseudocode for the integration point:

```ts
import { discoverModules }       from './modules.js';
import { buildCatalog }          from './catalog.js';
import { validatePublicConfig }  from './validate-modules.js';
import { renderVirtualEntry }    from './virtual-entry.js';
import { writeFile }             from 'node:fs/promises';
import { join }                  from 'node:path';

export async function composeProject(opts: ComposeOptions): Promise<Result<ComposeOutput>> {
  // ... existing project-level resolution

  const discovered = await discoverModules({ projectDir: opts.projectDir });
  if (!discovered.ok) return { ok: false, errors: discovered.errors };

  const catalog = buildCatalog(discovered.value);
  if (!catalog.ok) return { ok: false, errors: catalog.errors };

  const configErrors = validatePublicConfig(
    Object.fromEntries(Object.entries(discovered.value).map(([n, m]) => [n, m.manifest.client?.config?.schema ?? {}])),
    opts.deploymentConfig?.modules ?? {},
  );
  if (configErrors.length > 0) return { ok: false, errors: configErrors };

  // Pass catalog into the UI compiler's resolvers
  const uiResolvers: ValidateResolvers = {
    resolveBinding:    (id) => /* existing */,
    resolveRoute:      (p) => /* existing */,
    resolveComponent:  (type) => {
      const c = catalog.value.components.find((x) => x.type === type);
      return c ? { childrenModel: 'list', props: c.props as any } : undefined;
    },
    resolveOperation:  (name, opts) => {
      const owners = catalog.value.operations.filter((o) => o.name === name);
      if (opts.module) return owners.find((o) => o.module === opts.module);
      if (opts.category) {
        const target = catalog.value.categoryToModule[opts.category];
        return owners.find((o) => o.module === target);
      }
      // any (target-based addressing): pick by appliesTo containing target type — done inside @rntme/ui validate
      return owners[0];
    },
    resolveCategoryToModule: (cat) => catalog.value.categoryToModule[cat],
  };

  // ... existing compile step

  // Emit per-service virtual entry to disk
  for (const service of opts.services) {
    const entryPath = join(opts.projectDir, 'services', service, 'srv', '__rntme_ui_entry.ts');
    await writeFile(entryPath, renderVirtualEntry(catalog.value));
  }

  // Emit catalogManifest.json next to existing UI artifact
  await writeFile(join(opts.outDir, 'catalogManifest.json'), JSON.stringify(catalog.value, null, 2));

  return { ok: true, value: { /* existing fields */ } };
}
```

Adapt to whatever the actual signature in the current blueprint `composeProject` is. The pattern is: read modules early, build catalog, feed catalog into UI validator and emit, write virtual entry + catalog manifest.

- [archived] **Step 2: Smoke test compose against fixture**

Add `packages/blueprint/test/integration/compose-with-modules.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { composeProject } from '../../src/compose/index.js';

describe('compose with modules', () => {
  it('emits catalogManifest and virtual-entry without error for fixture', async () => {
    const r = await composeProject({
      projectDir: 'packages/blueprint/test/fixtures/project-with-modules',
      outDir: '/tmp/rntme-fixture-out',
      // ... whatever else current signature requires
    });
    expect(r.ok).toBe(true);
  });
});
```

- [archived] **Step 3: Run, commit**

```bash
pnpm -F @rntme/blueprint test
git add packages/blueprint/src/compose packages/blueprint/test
git commit -m "feat(blueprint): wire module discovery + catalog + virtual entry into composeProject"
```

---

## Phase 5 — `modules/presentation/md-mermaid/`

### Task 5.1: Scaffold workspace package

**Files:**
- Create: `modules/presentation/md-mermaid/package.json`, `tsconfig.json`, `tsconfig.check.json`, `eslint.config.mjs`, `vitest.config.ts`, `module.json`

- [archived] **Step 1: Author boilerplate**

`package.json`:

```json
{
  "name": "@rntme/presentation-md-mermaid",
  "version": "0.0.0",
  "type": "module",
  "private": true,
  "description": "Markdown and Mermaid renderers as a UI module.",
  "exports": {
    "./client": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "files": ["dist", "module.json", "README.md"],
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc -p tsconfig.check.json",
    "lint": "eslint \"src/**/*.{ts,tsx}\" \"test/**/*.{ts,tsx}\""
  },
  "dependencies": {
    "react-markdown": "^10.0.0",
    "remark-gfm": "^4.0.0",
    "mermaid": "^11.0.0"
  },
  "peerDependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.0.0",
    "typescript": "^5.4.0",
    "vitest": "^1.0.0",
    "@vitejs/plugin-react": "^4.0.0",
    "jsdom": "^24.0.0",
    "@testing-library/react": "^14.0.0"
  }
}
```

`module.json`:

```json
{
  "name": "@rntme/presentation-md-mermaid",
  "version": "0.0.0",
  "client": {
    "entry": "./dist/index.js",
    "components": [
      { "type": "Markdown", "props": { "source": { "type": "string", "required": true } } },
      { "type": "Mermaid",  "props": { "source": { "type": "string", "required": true } } }
    ]
  }
}
```

`tsconfig.json`:

```json
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM"]
  },
  "include": ["src/**/*"]
}
```

(Copy `tsconfig.check.json`, `eslint.config.mjs`, `vitest.config.ts` from `packages/ui-runtime/` as templates and adjust paths.)

- [archived] **Step 2: Install deps and commit**

Run: `pnpm install`
Expected: workspace package linked, deps installed.

```bash
git add modules/presentation/md-mermaid
git commit -m "scaffold: @rntme/presentation-md-mermaid workspace package"
```

### Task 5.2: Implement `<Markdown>` component

**Files:**
- Create: `modules/presentation/md-mermaid/src/components/Markdown.tsx`
- Create: `modules/presentation/md-mermaid/test/unit/Markdown.test.tsx`

- [archived] **Step 1: Failing test**

```tsx
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { Markdown } from '../../src/components/Markdown.js';

describe('<Markdown>', () => {
  it('renders headings, bold, code', () => {
    const { container } = render(<Markdown source={'# Title\n\n**bold** `code`'} />);
    expect(container.querySelector('h1')?.textContent).toBe('Title');
    expect(container.querySelector('strong')?.textContent).toBe('bold');
    expect(container.querySelector('code')?.textContent).toBe('code');
  });
});
```

- [archived] **Step 2: Implement**

```tsx
// modules/presentation/md-mermaid/src/components/Markdown.tsx
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export type MarkdownProps = { source: string };

export function Markdown({ source }: MarkdownProps): JSX.Element {
  return (
    <div className="rntme-markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{source ?? ''}</ReactMarkdown>
    </div>
  );
}
```

- [archived] **Step 3: Test, commit**

```bash
pnpm -F @rntme/presentation-md-mermaid test --run unit/Markdown.test.tsx
git add modules/presentation/md-mermaid/src/components/Markdown.tsx modules/presentation/md-mermaid/test/unit/Markdown.test.tsx
git commit -m "feat(presentation-md-mermaid): Markdown renderer"
```

### Task 5.3: Implement `<Mermaid>` component

**Files:**
- Create: `modules/presentation/md-mermaid/src/components/Mermaid.tsx`
- Create: `modules/presentation/md-mermaid/test/unit/Mermaid.test.tsx`

- [archived] **Step 1: Failing test**

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { Mermaid } from '../../src/components/Mermaid.js';

describe('<Mermaid>', () => {
  it('renders an svg for a simple flowchart', async () => {
    const { container } = render(<Mermaid source={'graph TD; A-->B'} />);
    await waitFor(() => expect(container.querySelector('svg')).not.toBeNull());
  });
});
```

- [archived] **Step 2: Implement**

```tsx
// modules/presentation/md-mermaid/src/components/Mermaid.tsx
import { useEffect, useRef } from 'react';
import mermaid from 'mermaid';

mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' });

export type MermaidProps = { source: string };

export function Mermaid({ source }: MermaidProps): JSX.Element {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    const id = `mermaid-${Math.random().toString(36).slice(2)}`;
    mermaid
      .render(id, source ?? '')
      .then(({ svg }) => { if (ref.current) ref.current.innerHTML = svg; })
      .catch(() => { if (ref.current) ref.current.textContent = 'Invalid mermaid source'; });
  }, [source]);
  return <div ref={ref} className="rntme-mermaid" />;
}
```

- [archived] **Step 3: Test, commit**

```bash
pnpm -F @rntme/presentation-md-mermaid test
git add modules/presentation/md-mermaid/src/components/Mermaid.tsx modules/presentation/md-mermaid/test/unit/Mermaid.test.tsx
git commit -m "feat(presentation-md-mermaid): Mermaid renderer"
```

### Task 5.4: Module entry + manifest sanity test

**Files:**
- Create: `modules/presentation/md-mermaid/src/index.ts`
- Create: `modules/presentation/md-mermaid/test/unit/manifest.test.ts`

- [archived] **Step 1: Implement entry**

```ts
// modules/presentation/md-mermaid/src/index.ts
export { Markdown }  from './components/Markdown.js';
export { Mermaid }   from './components/Mermaid.js';
```

- [archived] **Step 2: Manifest sanity test**

```ts
import { describe, expect, it } from 'vitest';
import { parseModuleManifest } from '@rntme/module-skeleton';
import manifest from '../../module.json' with { type: 'json' };

describe('module.json', () => {
  it('parses through @rntme/module-skeleton without error', () => {
    const r = parseModuleManifest(manifest);
    expect(r.ok).toBe(true);
  });
  it('declares only the components the entry exports', async () => {
    const exports = await import('../../src/index.js');
    for (const c of (manifest as any).client.components) {
      expect(exports[c.type]).toBeDefined();
    }
  });
});
```

- [archived] **Step 3: Test, commit**

```bash
pnpm -F @rntme/presentation-md-mermaid test
git add modules/presentation/md-mermaid/src/index.ts modules/presentation/md-mermaid/test/unit/manifest.test.ts
git commit -m "feat(presentation-md-mermaid): module entry + manifest sanity"
```

### Task 5.5: README

**Files:**
- Create: `modules/presentation/md-mermaid/README.md`

- [archived] **Step 1: Author**

```markdown
# @rntme/presentation-md-mermaid

UI-only module that contributes two json-render component types: `<Markdown>` (renders GFM via `react-markdown` + `remark-gfm`) and `<Mermaid>` (renders flowcharts/diagrams via `mermaid`).

## File map

```
modules/presentation/md-mermaid/
├── module.json                  Manifest declaring `client.components: [Markdown, Mermaid]`.
├── package.json
└── src/
    ├── index.ts                 Named exports: { Markdown, Mermaid }.
    └── components/
        ├── Markdown.tsx
        └── Mermaid.tsx
```

No backend (`capabilities` block omitted). No `boot`. No operations.

## Quick start (consumer side)

In a project that uses this module:

```jsonc
// project.json
{ "modules": { "presentation-md": "@rntme/presentation-md-mermaid" } }
```

```jsonc
// services/<svc>/ui/screens/x.spec.json
{
  "elements": {
    "doc": { "type": "Markdown", "props": { "source": { "$state": "/data/article/body" } } }
  }
}
```

## API

| Component | Props | Notes |
|---|---|---|
| `<Markdown>` | `source: string` (required) | GFM via `react-markdown` + `remark-gfm`. Renders React elements and does not use `dangerouslySetInnerHTML`. |
| `<Mermaid>`  | `source: string` (required) | Mermaid v11 with `securityLevel: 'strict'`. Renders SVG asynchronously into a `div.rntme-mermaid`; on parse failure, shows "Invalid mermaid source". |

## Invariants & gotchas

- Markdown rendering uses `react-markdown`'s safe-by-default React rendering path; do not replace it with raw HTML without a sanitizer.
- Mermaid renders are async — the SVG element appears one tick after mount. Tests use `waitFor`.
- Both components are pure rendering: no state writes, no operations, no lifecycle subscription.
- Bundling: each project paying Mermaid/markdown cost should actually use the module; track the exact gzip budget in the integration smoke once bundle output exists.

## Where to look first

- "I want a different markdown engine" → fork to `@rntme/presentation-md-markdown-it` (or whatever); declare same `Markdown` type so screens are interchangeable.
- "I want syntax highlighting in code blocks" → add a rehype/remark plugin; modify `Markdown.tsx`.
- "Mermaid renders are too small/big" → component does no styling beyond wrapper; consumer styles `div.rntme-mermaid svg` via Tailwind/global CSS.

## Specs

- `docs/superpowers/specs/2026-04-29-ui-module-contributions-design.md` §3.4 (canonical "MD/Mermaid" example) and §10 (bundle pipeline).
```

- [archived] **Step 2: Commit**

```bash
git add modules/presentation/md-mermaid/README.md
git commit -m "docs(presentation-md-mermaid): README"
```

---

## Phase 6 — `modules/presentation/tiptap/`

### Task 6.1: Scaffold

**Files:**
- Create: `modules/presentation/tiptap/{package.json, tsconfig*, eslint.config.mjs, vitest.config.ts, module.json}`

- [archived] **Step 1: Author**

`package.json` (key parts):

```json
{
  "name": "@rntme/presentation-tiptap",
  "dependencies": {
    "@tiptap/react": "^3.0.0",
    "@tiptap/pm": "^3.0.0",
    "@tiptap/starter-kit": "^3.0.0",
    "@tiptap/extension-image": "^3.0.0"
  },
  "peerDependencies": {
    "react": "^19.0.0", "react-dom": "^19.0.0",
    "@rntme/ui-runtime": "workspace:*"
  }
}
```

`module.json`:

```json
{
  "name": "@rntme/presentation-tiptap",
  "version": "0.0.0",
  "client": {
    "entry": "./dist/index.js",
    "components": [
      { "type": "RichTextEditor",
        "props": {
          "value":      { "type": "object", "required": true },
          "placeholder":{ "type": "string", "required": false }
        } }
    ],
    "operations": [
      { "name": "toggleBold",   "appliesTo": ["RichTextEditor"], "params": {} },
      { "name": "toggleItalic", "appliesTo": ["RichTextEditor"], "params": {} },
      { "name": "insertImage",  "appliesTo": ["RichTextEditor"],
        "params": { "url": { "type": "string", "required": true },
                    "alt": { "type": "string", "required": false } } }
    ]
  }
}
```

- [archived] **Step 2: Install + commit**

```bash
pnpm install
git add modules/presentation/tiptap
git commit -m "scaffold: @rntme/presentation-tiptap workspace package"
```

### Task 6.2: Implement `<RichTextEditor>` with operation registration

**Files:**
- Create: `modules/presentation/tiptap/src/components/RichTextEditor.tsx`
- Create: `modules/presentation/tiptap/test/unit/RichTextEditor.test.tsx`

- [archived] **Step 1: Failing test**

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { RichTextEditor } from '../../src/components/RichTextEditor.js';
import { RegistryProvider } from '@rntme/ui-runtime/client';
import { createOperationRegistry } from '@rntme/ui-runtime/client/operation-registry'; // adjust if not exported

describe('<RichTextEditor>', () => {
  it('registers toggleBold/toggleItalic/insertImage on mount and unregisters on unmount', () => {
    const reg = createOperationRegistry();
    const { unmount } = render(
      <RegistryProvider value={reg}>
        <RichTextEditor __rntmeElementId="ed1" value={{ type: 'doc', content: [] }} />
      </RegistryProvider>
    );
    expect(reg.lookupComponent('ed1', 'toggleBold')).toBeDefined();
    expect(reg.lookupComponent('ed1', 'toggleItalic')).toBeDefined();
    expect(reg.lookupComponent('ed1', 'insertImage')).toBeDefined();
    unmount();
    expect(reg.lookupComponent('ed1', 'toggleBold')).toBeUndefined();
  });
});
```

- [archived] **Step 2: Implement**

```tsx
// modules/presentation/tiptap/src/components/RichTextEditor.tsx
import { useEffect } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { useOperationRegistry } from '@rntme/ui-runtime/client';

export type RichTextEditorProps = {
  value: object;                    // tiptap document JSON
  placeholder?: string;
  __rntmeElementId: string;         // injected by rntme before json-render renders the element
};

export function RichTextEditor({ value, __rntmeElementId }: RichTextEditorProps): JSX.Element {
  const editor = useEditor({ extensions: [StarterKit, Image], content: value });
  const reg = useOperationRegistry();
  useEffect(() => {
    if (!editor) return;
    return reg.register(__rntmeElementId, {
      toggleBold:   () => editor.chain().focus().toggleBold().run(),
      toggleItalic: () => editor.chain().focus().toggleItalic().run(),
      insertImage:  ({ url, alt }) => editor.chain().focus().setImage({ src: String(url), alt: alt as string | undefined }).run(),
    });
  }, [editor, __rntmeElementId, reg]);
  return <EditorContent editor={editor} />;
}
```

- [archived] **Step 3: Test, commit**

```bash
pnpm -F @rntme/presentation-tiptap test
git add modules/presentation/tiptap
git commit -m "feat(presentation-tiptap): RichTextEditor with operation self-registration"
```

### Task 6.3: Module entry + manifest sanity

**Files:**
- Create: `modules/presentation/tiptap/src/index.ts`
- Create: `modules/presentation/tiptap/test/unit/manifest.test.ts`

- [archived] **Step 1: Author and test**

```ts
// src/index.ts
export { RichTextEditor } from './components/RichTextEditor.js';
```

```ts
// test/unit/manifest.test.ts
import { describe, expect, it } from 'vitest';
import { parseModuleManifest } from '@rntme/module-skeleton';
import manifest from '../../module.json' with { type: 'json' };
describe('module.json', () => {
  it('parses without error', () => {
    expect(parseModuleManifest(manifest).ok).toBe(true);
  });
});
```

- [archived] **Step 2: Test, commit**

```bash
pnpm -F @rntme/presentation-tiptap test
git add modules/presentation/tiptap/src/index.ts modules/presentation/tiptap/test/unit/manifest.test.ts
git commit -m "feat(presentation-tiptap): module entry + manifest sanity"
```

### Task 6.4: README

**Files:**
- Create: `modules/presentation/tiptap/README.md`

Mirror Phase 5 README format. Document:
- Component: `<RichTextEditor>` with props `value` (tiptap doc JSON) + `placeholder`.
- Operations: `toggleBold`, `toggleItalic`, `insertImage`.
- Usage from screen: spec example with toolbar buttons calling `kind: "module-action"` with `target: "<editorElementId>"`.
- Bundle size note: ~150 kB gzip.

```bash
git add modules/presentation/tiptap/README.md
git commit -m "docs(presentation-tiptap): README"
```

---

## Phase 7 — Analytics canonical contract + Google Analytics module

### Task 7.1: Scaffold `packages/contracts/analytics/v1/`

**Files:**
- Create: `packages/contracts/analytics/v1/{package.json, tsconfig.json, src/operations.ts, src/index.ts, README.md}`

- [archived] **Step 1: Author files**

`package.json`:

```json
{
  "name": "@rntme/contracts-analytics-v1",
  "version": "0.0.0",
  "type": "module",
  "private": true,
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" }
  },
  "files": ["dist", "README.md"],
  "scripts": { "build": "tsc -p tsconfig.json", "test": "vitest run", "typecheck": "tsc -p tsconfig.check.json" },
  "devDependencies": { "typescript": "^5.4.0", "vitest": "^1.0.0" }
}
```

`src/operations.ts`:

```ts
import type { PropSchema } from '@rntme/module-skeleton';

export const ANALYTICS_V1_OPERATIONS: Array<{ name: string; params: Record<string, PropSchema> }> = [
  { name: 'track',
    params: { event: { type: 'string', required: true },
              props: { type: 'object', required: false } } },
  { name: 'identify',
    params: { userId: { type: 'string', required: true },
              traits: { type: 'object', required: false } } },
];

export const ANALYTICS_V1_LIFECYCLE_AUTO_EMIT: string[] = ['navigate'];
```

`src/index.ts`:

```ts
export * from './operations.js';
```

`README.md`:

```markdown
# @rntme/contracts-analytics-v1

Canonical UI contract for the `analytics` category. Vendor modules implementing this contract MUST register both operations (`track`, `identify`) and SHOULD auto-emit at least the `navigate` lifecycle event.

## Operations

| Name | Params | Notes |
|---|---|---|
| `track`    | `event: string` (required), `props: object` (optional) | Discrete user-instrumented event |
| `identify` | `userId: string` (required), `traits: object` (optional) | Associate user with subsequent events |

## Lifecycle auto-emit (best-effort)

| Event | When | What |
|---|---|---|
| `navigate` | route change | Emit `page_view` to vendor |

## Implementations

- `@rntme/analytics-google-analytics`
- (Future: `@rntme/analytics-amplitude`, `@rntme/analytics-segment`, …)

## Out of scope

- `track` parameter PII masking — implementation responsibility.
- Server-side event ingestion — separate spec.
```

- [archived] **Step 2: Build, commit**

```bash
pnpm install
pnpm -F @rntme/contracts-analytics-v1 build
git add packages/contracts/analytics/v1
git commit -m "feat(contracts-analytics-v1): canonical UI contract for analytics category"
```

### Task 7.2: Scaffold `modules/analytics/google-analytics/`

**Files:**
- Create: `modules/analytics/google-analytics/{package.json, tsconfig.json, module.json, src/index.ts, test/...}`

- [archived] **Step 1: Author manifest**

`module.json`:

```json
{
  "name": "@rntme/analytics-google-analytics",
  "version": "0.0.0",
  "category": "analytics",
  "vendor": "google-analytics",
  "contract": "analytics/v1",
  "client": {
    "entry": "./dist/index.js",
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
    ]
  }
}
```

`package.json` deps include `@rntme/contracts-analytics-v1`, `@rntme/ui-runtime` as peer.

- [archived] **Step 2: Commit scaffold**

```bash
pnpm install
git add modules/analytics/google-analytics
git commit -m "scaffold: @rntme/analytics-google-analytics workspace package"
```

### Task 7.3: Implement `boot(ctx)`

**Files:**
- Create: `modules/analytics/google-analytics/src/index.ts`
- Create: `modules/analytics/google-analytics/test/unit/boot.test.ts`

- [archived] **Step 1: Failing test**

```ts
import { describe, expect, it, vi } from 'vitest';
import { boot } from '../../src/index.js';

function mockCtx(config: Record<string, unknown>) {
  const subs: Record<string, ((v: unknown) => void)[]> = {};
  const ops: Record<string, (p: any) => void> = {};
  const lifecycleHandlers: Record<string, (e: any) => void[]> = {};
  return {
    config,
    state: {
      get: (p: string) => undefined,
      set: vi.fn(),
      subscribe: (p: string, h: (v: unknown) => void) => { (subs[p] ??= []).push(h); return () => {}; },
    },
    transport: { use: vi.fn() },
    on: ((evt: string, h: any) => { (lifecycleHandlers[evt] ??= []).push(h); return () => {}; }) as any,
    registerOperation: (name: string, h: any) => { ops[name] = h; },
    __subs: subs, __ops: ops, __lifecycle: lifecycleHandlers,
  };
}

describe('boot()', () => {
  it('registers track and identify operations', () => {
    const ctx = mockCtx({ measurementId: 'G-X' });
    boot(ctx as any);
    expect(typeof (ctx as any).__ops.track).toBe('function');
    expect(typeof (ctx as any).__ops.identify).toBe('function');
  });

  it('subscribes to /currentUser to call gtag config when set', () => {
    const ctx = mockCtx({ measurementId: 'G-X' });
    (window as any).gtag = vi.fn();
    boot(ctx as any);
    (ctx as any).__subs['/currentUser'][0]({ sub: 'auth0|abc' });
    expect((window as any).gtag).toHaveBeenCalledWith('config', 'G-X', expect.objectContaining({ user_id: 'auth0|abc' }));
  });

  it('subscribes to navigate and emits page_view', () => {
    const ctx = mockCtx({ measurementId: 'G-X' });
    (window as any).gtag = vi.fn();
    boot(ctx as any);
    (ctx as any).__lifecycle['navigate'][0]({ path: '/x', params: {} });
    expect((window as any).gtag).toHaveBeenCalledWith('event', 'page_view', expect.objectContaining({ page_location: 'http://localhost/x' }));
  });
});
```

- [archived] **Step 2: Implement**

```ts
// modules/analytics/google-analytics/src/index.ts
import type { ModuleBootContext } from '@rntme/ui-runtime/client';

declare global {
  interface Window { gtag: (...args: unknown[]) => void; dataLayer: unknown[] }
}

function loadGAScript(measurementId: string): void {
  if (typeof window === 'undefined') return;
  if (window.gtag) return;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag(...args: unknown[]) { window.dataLayer.push(args); };
  window.gtag('js', new Date());
  window.gtag('config', measurementId, { send_page_view: false });
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  document.head.appendChild(s);
}

export function boot(ctx: ModuleBootContext): void {
  const measurementId = ctx.config.measurementId as string;
  loadGAScript(measurementId);

  ctx.on('navigate', ({ path }) => {
    const pageLocation = new URL(path, window.location.origin).toString();
    window.gtag?.('event', 'page_view', { page_location: pageLocation, page_path: path });
  });

  ctx.state.subscribe('/currentUser', (u) => {
    const user = u as { sub?: string } | null;
    if (user?.sub) window.gtag?.('config', measurementId, { user_id: user.sub });
    else window.gtag?.('config', measurementId, { user_id: null });
  });

  ctx.registerOperation('track', (params) => {
    const { event, props } = params as { event: string; props?: Record<string, unknown> };
    window.gtag?.('event', event, props ?? {});
  });

  ctx.registerOperation('identify', (params) => {
    const { userId, traits } = params as { userId: string; traits?: Record<string, unknown> };
    window.gtag?.('config', measurementId, { user_id: userId, ...(traits ?? {}) });
  });
}
```

- [archived] **Step 3: Test, commit**

```bash
pnpm -F @rntme/analytics-google-analytics test
git add modules/analytics/google-analytics/src modules/analytics/google-analytics/test
git commit -m "feat(analytics-google-analytics): boot() + track/identify operations"
```

### Task 7.4: README

**Files:**
- Create: `modules/analytics/google-analytics/README.md`

Mirror prior READMEs. Document:
- `boot(ctx)` lifecycle: SDK loaded, navigate→page_view, /currentUser→config, operations registered.
- `track(event, props)` and `identify(userId, traits)` semantics.
- Required public config: `measurementId`.
- Bundle: ~3 kB gzip (the SDK loads from Google's CDN at runtime).
- Vendor swap: implements `analytics/v1`, so any project pointing `modules.analytics` at `@rntme/analytics-amplitude` (when published) is interchangeable provided the operation set matches.

```bash
git add modules/analytics/google-analytics/README.md
git commit -m "docs(analytics-google-analytics): README"
```

---

## Phase 8 — Documentation touch

### Task 8.1: `CLAUDE.md` "Architecture in one paragraph"

**Files:**
- Modify: `CLAUDE.md`

- [archived] **Step 1: Update the paragraph**

Locate the "Architecture in one paragraph" section and append a sentence after the existing executor-seam mention:

> Modules can additionally contribute UI through a `client` block in `module.json` — components, named operations (component-bound or module-level), and a `boot(ctx)` startup hook with access to a state store, transport-middleware chain, lifecycle bus, and operation registry. Project compose collects every module's contributions, generates a per-project SPA virtual entry, and feeds the union into the UI compiler.

```bash
git add CLAUDE.md
git commit -m "docs(CLAUDE.md): mention module UI contribution surface"
```

### Task 8.2: `AGENTS.md` updates

**Files:**
- Modify: `AGENTS.md`

- [archived] **Step 1: §3 (package layering)**

Add a row near the existing UI-related entries describing `modules/<cat>/<vendor>/client/` flow → `@rntme/blueprint` compose → `@rntme/ui` validate → SPA bundle.

- [archived] **Step 2: §6 (how-tos)** — three new entries:

```markdown
**Add a UI-only module (renderer/widget).**

1. `cp -r modules/presentation/md-mermaid modules/<cat>/<my-mod>` and rename `package.json#name` and `module.json#name`.
2. List your component types in `module.json#client.components[]` with `props` schemas.
3. Export each type by name from `client.entry`.
4. `pnpm install`. Done — projects that add your module to `project.json#modules` will see your components in their UI catalog.

**Add a stateful module component with operations.**

1. Declare each imperative operation in `module.json#client.operations[]` with `appliesTo: ["<your component>"]` and a `params` schema.
2. Inside the component, call `useOperationRegistry().register(elementId, handlers)` from a `useEffect`. Return the unregister callback so cleanup runs on unmount.
3. Screens reference your operations via `kind: "module-action", target: "<elementId>", name: "<op>"`.

**Add a module with `boot(ctx)`.**

1. Set `client.boot: true` in `module.json` and (if applicable) declare `client.config.schema` for public config keys.
2. Export a `boot(ctx: ModuleBootContext)` function from `client.entry`. Use `ctx.transport.use(...)` for fetch middleware, `ctx.state.subscribe(...)` for state reactions, `ctx.registerOperation(...)` for module-level operations, and `ctx.on(...)` for lifecycle subscriptions.
3. Add a `category` + `contract` if a canonical UI contract exists for your module class.
```

- [archived] **Step 3: §10 (glossary)** — new entries:

```markdown
- **module-action** — UI action kind dispatched to either a component-bound handler (by `target` element ID) or a module-level handler (by `module` package name or canonical `category`).
- **operation registry** — runtime map of `(elementId|moduleName, opName) → handler` populated either by `useOperationRegistry().register(...)` from a component or by `ctx.registerOperation(...)` from a module's `boot()`.
- **state-gated rendering** — pattern where module logic writes to a state path (e.g. `/auth/status`) and the project's root layout uses `visible` clauses to gate sub-trees, instead of using a wrapping React component.
- **canonical UI contract** — `packages/contracts/<category>/v<n>/` directory whose operation/event names are the swap surface across vendor modules in the same category.
```

```bash
git add AGENTS.md
git commit -m "docs(AGENTS.md): UI module contribution layering, how-tos, glossary"
```

### Task 8.3: `README.md` packages table + dep graph

**Files:**
- Modify: `README.md`

- [archived] **Step 1: Add module rows**

Add the three new modules to the packages table; mention `@rntme/contracts-analytics-v1`. Update the dep graph paragraph to note `@rntme/ui-runtime/client` exports module-facing hooks.

```bash
git add README.md
git commit -m "docs(README): packages table — md-mermaid, tiptap, GA, analytics/v1"
```

### Task 8.4: Per-package READMEs

**Files:**
- Modify: `packages/ui/README.md`, `packages/ui-runtime/README.md`, `packages/blueprint/README.md`

- [archived] **Step 1: `packages/ui/README.md`**

Add `module-action` to the action-kinds table; add new error codes; mention the new `resolveOperation`/`resolveCategoryToModule` resolvers.

- [archived] **Step 2: `packages/ui-runtime/README.md`**

Document `useTransport`, `useStateStore`, `useOperationRegistry`, `ModuleBootContext`, the boot lifecycle, the visibility-driven driver gating rule, and json-render event binding arrays.

- [archived] **Step 3: `packages/blueprint/README.md`**

Document the new compose steps: `discoverModules`, `buildCatalog`, `validatePublicConfig`, `renderVirtualEntry`. Document the `catalogManifest.json` artifact.

```bash
git add packages/ui/README.md packages/ui-runtime/README.md packages/blueprint/README.md
git commit -m "docs(READMEs): UI/ui-runtime/blueprint module-contribution surface"
```

---

## Phase 9 — Integration smoke

### Task 9.1: Build a fixture project consuming all three modules

**Files:**
- Create: `packages/blueprint/test/fixtures/integration-smoke/project.json`
- Create: `packages/blueprint/test/fixtures/integration-smoke/services/app/ui/{manifest.json, layouts/main.{spec,screen}.json, screens/home.{spec,screen}.json}`

- [archived] **Step 1: Author fixture**

`project.json`:

```json
{
  "name": "smoke",
  "services": ["app"],
  "modules": {
    "presentation-md":  "@rntme/presentation-md-mermaid",
    "presentation-rte": "@rntme/presentation-tiptap",
    "analytics":        "@rntme/analytics-google-analytics"
  },
  "deploymentConfig": {
    "modules": {
      "@rntme/analytics-google-analytics": { "publicConfig": { "measurementId": "G-TEST" } }
    }
  }
}
```

`services/app/ui/manifest.json` — minimal one-route manifest pointing `/` at `screens/home`.

`services/app/ui/screens/home.spec.json`:

```jsonc
{
  "root": "page",
  "elements": {
    "page":   { "type": "Stack", "children": ["doc", "editor", "track"] },
    "doc":    { "type": "Markdown", "props": { "source": "# Smoke" } },
    "editor": { "type": "RichTextEditor", "props": { "value": { "type": "doc", "content": [] } } },
    "track":  { "type": "Button", "props": { "label": "Track" }, "on": { "click": "trackClick" } }
  }
}
```

`services/app/ui/screens/home.screen.json`:

```jsonc
{
  "actions": {
    "trackClick": {
      "kind": "module-action",
      "category": "analytics",
      "name": "track",
      "params": { "event": "smoke_click" }
    }
  }
}
```

- [archived] **Step 2: Commit fixture**

```bash
git add packages/blueprint/test/fixtures/integration-smoke
git commit -m "test(blueprint): integration-smoke fixture"
```

### Task 9.2: End-to-end compose test

**Files:**
- Create: `packages/blueprint/test/integration/end-to-end.test.ts`

- [archived] **Step 1: Failing test**

```ts
import { describe, expect, it } from 'vitest';
import { composeProject } from '../../src/compose/index.js';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('end-to-end compose with three modules', () => {
  const dir = 'packages/blueprint/test/fixtures/integration-smoke';
  const out = '/tmp/rntme-smoke-out';

  it('compose succeeds, emits catalog and virtual entry', async () => {
    const r = await composeProject({ projectDir: dir, outDir: out });
    expect(r.ok).toBe(true);
    expect(existsSync(join(out, 'catalogManifest.json'))).toBe(true);
    expect(existsSync(join(dir, 'services/app/srv/__rntme_ui_entry.ts'))).toBe(true);

    const cat = JSON.parse(readFileSync(join(out, 'catalogManifest.json'), 'utf-8'));
    expect(cat.components.map((c: any) => c.type).sort()).toEqual(['Markdown', 'Mermaid', 'RichTextEditor']);
    expect(cat.modulesWithBoot).toEqual(['@rntme/analytics-google-analytics']);
    expect(cat.categoryToModule).toEqual({ analytics: '@rntme/analytics-google-analytics' });
  });

  it('compiled action canonicalizes category to module', async () => {
    const r = await composeProject({ projectDir: dir, outDir: out });
    if (!r.ok) throw new Error('compose failed');
    const screen = JSON.parse(readFileSync(join(out, 'services/app/ui-build/screens/home.json'), 'utf-8'));
    expect(screen.actions.trackClick).toMatchObject({
      kind: 'module-action',
      module: '@rntme/analytics-google-analytics',
      name: 'track',
    });
    expect(screen.actions.trackClick.category).toBeUndefined();
  });
});
```

(Adjust `screens/home.json` output path based on actual emit shape from `@rntme/ui`.)

- [archived] **Step 2: Run, commit**

```bash
pnpm -F @rntme/blueprint test
git add packages/blueprint/test/integration/end-to-end.test.ts
git commit -m "test(blueprint): end-to-end compose with three modules"
```

### Task 9.3: Run the entire workspace test pass

- [archived] **Step 1: Full repo test**

Run from repo root:

```bash
pnpm -r run typecheck
pnpm -r run test
pnpm -r run lint
```

Expected: PASS across all packages.

- [archived] **Step 2: Final commit (if any drift cleanup needed)**

```bash
git status
# resolve any drift
git commit -m "chore: post-integration cleanup"
```

---

## Self-review (run before declaring done)

- [archived] **Spec coverage:** every numbered "in scope" item from spec §1 is implemented by a Task above. Every error code from spec §4.3 / §7.2 / §11 appears in code (`module-skeleton`, `@rntme/ui`, `@rntme/blueprint`).
- [archived] **`module.json` schema parses every shape from spec §3.1 fixture.**
- [archived] **`module-action` dispatches both component-bound and module-level paths in tests.**
- [archived] **State-gated rendering exercise:** Phase 9 fixture does not exercise the auth/login state-gate (no identity module included). That is correct — auth migration is out-of-scope per spec §15. The `evaluateVisible` unit tests cover the operator surface independently.
- [archived] **Documentation-touch checklist (spec §14) matches Phase 8 task list.**

If any spec requirement is not covered by a Task, add the Task before handing off.

---

Plan complete and saved to `docs/superpowers/plans/2026-04-29-ui-module-contributions.md`.

Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per Task, review between Tasks, fast iteration.
2. **Inline Execution** — Execute Tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
