# @rntme/ui

UI artifact v2 compiler: reads a multi-file JSON authoring tree (manifest + screens + layouts + fragments), resolves references, expands `$param`/`$ref`, validates, and emits a compiled artifact consumed by `@rntme/ui-runtime`.

The package does not assume a same-service binding namespace; Track B project composition injects a routed binding map from `@rntme/blueprint`.

## Role in the system

- Depends on: `zod` for parse-layer source schemas; no `@rntme/*` package dependencies.
- Consumed by: `@rntme/ui-runtime` (imports the compiled `CompiledArtifact` shape to render screens at runtime).
- Position in pipeline: JSON authoring (`manifest.json` + `*.spec.json` + `*.screen.json` + fragments) → `resolve` (read and assemble) → `expand` (inline `$ref`, substitute `$param`) → `validate` (structural → references/consistency) → `emit` (resolve bindings to HTTP endpoints) → `CompiledArtifact`.

## File map

```
src/
  index.ts                    (entry) Public barrel — re-exports compile, resolve, expand, validate, emit, Result, types.
  compile.ts                  (entry) compile() orchestrator — runs resolve → expand → validate → emit fail-fast.
  resolve/
    resolve.ts                (entry) resolve() — reads manifest.json, layouts, screens, and transitively-referenced fragments from disk; detects $ref cycles.
  parse/
    schema.ts                 Zod schemas for manifest/spec/screen JSON. Normalizes omitted element props to `{}` and rejects malformed authoring shapes before expand/validate.
  expand/
    expand.ts                 (entry) expand() — inlines every $ref fragment (ID prefixing + nested recursion), deep-walks props/visible/on/watch to substitute { $param: "name" } from the ref's bind map.
  validate/
    index.ts                  (entry) validate() — runs structural on all layouts+screens, then references/consistency; merges manifest route patterns into the route resolver.
    structural.ts             validateStructural — root exists, no orphan elements, child references resolve, Slot elements rejected outside layouts.
    references.ts             validateReferences — data/action bindings resolve with optional logical kind checks, navigation targets match routes, $state paths and command/data inputs are covered, component props match catalog schemas.
  emit/
    emit.ts                   (entry) emit() — maps manifest routes to { layout, screen }; projects each layout+screen through resolveScreenHttp into CompiledScreen form.
    http-map.ts               resolveScreenHttp + HttpEntry — translates DataBinding and CommandAction binding IDs into { method, path } via the caller-supplied httpMap; passes navigation/refetch actions through.
  types/
    source.ts                 Authoring shapes — SourceManifest, RouteEntry, ScreenDescriptor, DataBinding, ActionDef (navigation|command|refetch), ParamValue, StateRef, SpecJson, ElementJson, RefElement, ResolvedSource; isRefElement guard.
    compiled.ts               Output shapes — CompiledManifest, CompiledRouteEntry, CompiledScreen, CompiledSpec, CompiledElement, CompiledDataEndpoint, CompiledAction, CompiledArtifact.
    result.ts                 Result<T>, ok, err, isOk, isErr, UiError, UiErrorCode (frozen code union across all phases).
```

## Quick start

End-to-end compile of an authoring directory. Resolvers are caller-provided — the UI compiler does not know about `@rntme/bindings` or graph spec internals.

Pipeline shape:

```
   sourceDir (filesystem)
        |
        | manifest.json, layouts/*.{spec,screen}.json,
        | screens/*.{spec,screen}.json, fragments/*.spec.json
        v
   resolve()  --> ResolvedSource  (raw SpecJson with $ref + $param)
        |
        v
   expand()   --> ExpandedSource  (CompiledElement tree; $ref inlined, $param substituted)
        |
        v
   validate() --> Result<void>    (structural errors short-circuit reference errors)
        |
        v
   emit()     --> CompiledArtifact { manifest, layouts, screens }
```

Each phase is a pure function returning `Result<T>`. `compile` chains them with fail-fast semantics; no exceptions cross an API boundary.

```ts
import {
  compile,
  type CompileOptions,
  type ValidateResolvers,
} from '@rntme/ui';
import type { HttpEntry } from '@rntme/ui';

const httpMap: Record<string, HttpEntry> = {
  listIssues: { method: 'GET', path: '/api/issues' },
  createIssue: { method: 'POST', path: '/api/issues' },
};

const resolvers: ValidateResolvers = {
  resolveBinding: (id) => (id in httpMap ? { id } : undefined),
  resolveComponent: (type) => ({ childrenModel: type === 'Text' ? 'none' : 'list' }),
  resolveRoute: () => false, // manifest routes are merged automatically
};

const result = compile({
  sourceDir: '/abs/path/to/app',
  httpMap,
  resolvers,
} satisfies CompileOptions);

if (!result.ok) {
  for (const e of result.errors) console.error(e.code, e.message, e.path);
  process.exit(1);
}

const artifact = result.value; // CompiledArtifact { manifest, layouts, screens }
```

The individual phases (`resolve`, `expand`, `validate`, `emit`) are exported as well and may be invoked directly for tooling that needs intermediate state.

## API

| Export | Signature | Purpose |
|---|---|---|
| `compile` | `(opts: CompileOptions) => Result<CompiledArtifact>` | Full pipeline: resolve → expand → validate → emit. |
| `resolve` | `(baseDir: string) => Result<ResolvedSource>` | Read manifest, layouts, screens, and transitively-referenced fragments from disk. |
| `expand` | `(resolved: ResolvedSource) => Result<ExpandedSource>` | Inline `$ref` fragments, substitute `$param` bindings. |
| `validate` | `(expanded: ExpandedSource, r: ValidateResolvers) => Result<void>` | Structural → reference validation. |
| `emit` | `(expanded: ExpandedSource, httpMap) => Result<CompiledArtifact>` | Resolve binding IDs to HTTP entries, assemble final artifact. |
| `ok`, `err`, `isOk`, `isErr` | Result combinators | See `types/result.ts`. |
| `isRefElement` | `(el: ElementJson \| RefElement) => el is RefElement` | Discriminant guard. |

### Types

| Type | File | Role |
|---|---|---|
| `Result<T>` | `types/result.ts` | `{ ok: true; value } \| { ok: false; errors: UiError[] }`. |
| `UiError`, `UiErrorCode` | `types/result.ts` | Frozen code union + `{ code, message, path? }`. |
| `SourceManifest`, `SpecJson`, `ScreenDescriptor`, `RefElement` | `types/source.ts` | Authoring shapes (input). |
| `ResolvedSource` | `types/source.ts` | Output of `resolve`. |
| `ExpandedSource` | `expand/expand.ts` | Output of `expand` (specs are already `CompiledSpec` shape; no `$ref`/`$param`). |
| `CompiledArtifact`, `CompiledManifest`, `CompiledScreen`, `CompiledSpec`, `CompiledElement`, `CompiledDataEndpoint`, `CompiledAction` | `types/compiled.ts` | Output shapes consumed by `@rntme/ui-runtime`. |
| `CompileOptions` | `compile.ts` | `{ sourceDir, httpMap, resolvers }`. |
| `ValidateResolvers` | `validate/index.ts` | `{ resolveBinding, resolveComponent, resolveRoute, resolveOperation, resolveCategoryToModule }`. `resolveBinding` may return optional `{ kind }` or `{ entry: { kind } }` metadata. |
| `HttpEntry` | `emit/http-map.ts` | `{ method: 'GET' \| 'POST'; path: string }`. |

### Error codes (`UiErrorCode`)

Frozen union in `types/result.ts`. Grouped by phase.

| Phase | Codes |
|---|---|
| Resolve | `MANIFEST_INVALID`, `FILE_NOT_FOUND`, `CIRCULAR_REF`, `DUPLICATE_SCREEN_KEY` |
| Expand | `UNBOUND_PARAM`, `UNKNOWN_PARAM` |
| Validate (parse) | `SPEC_INVALID`, `SCREEN_SCHEMA_INVALID` |
| Validate (structural) | `MISSING_ROOT`, `ORPHAN_ELEMENT`, `BAD_CHILD_REF`, `SLOT_NOT_IN_LAYOUT` |
| Validate (references) | `UNRESOLVED_BINDING`, `BINDING_KIND_MISMATCH`, `UNCOVERED_STATE_PATH`, `UNKNOWN_ROUTE` |
| Validate (consistency) | `TYPE_MISMATCH`, `UNCOVERED_INPUT` |
| Emit | `EMIT_FAILED` |
| Generic | `INTERNAL` |

Codes are stable. Append new codes; do not reorder, rename, or delete.

### Authoring file layout

Expected on-disk shape under `sourceDir`:

```
<sourceDir>/
  manifest.json                      SourceManifest — version, refs, metadata, layouts map, routes map.
  layouts/
    <name>.spec.json                 SpecJson — visual tree; Slot elements permitted.
    <name>.screen.json               ScreenDescriptor — layout-level data/actions/metadata.
  screens/
    <name>.spec.json                 SpecJson — visual tree; no Slot.
    <name>.screen.json               ScreenDescriptor.
  fragments/
    <name>.spec.json                 SpecJson — parameterized; may contain $param markers and nested $ref.
```

Every route entry (`manifest.routes[pattern].screen`) and every layout entry (`manifest.layouts[name]`) is a base path; `resolve.readPair` appends `.spec.json` and `.screen.json`. Fragments are referenced by base path via `{ "$ref": "fragments/<name>" }`.

See `packages/artifacts/ui/test/fixtures/fragment-app/` for a full minimal example exercising one layout, one screen, and one fragment.

### Action kinds

`ActionDef` is a discriminated union on `kind`. Compilation behavior per kind:

| `kind` | Input shape (`ActionDef`) | Validated by | Compiled shape (`CompiledAction`) | `emit` behavior |
|---|---|---|---|---|
| `navigation` | `{ kind, navigateTo, paramsFromState? }` | `resolveRoute(navigateTo)` in references layer (`UNKNOWN_ROUTE`). | Same shape, `kind: 'navigation'`. | Passed through verbatim. |
| `command` | `{ kind, binding, paramsFromState, onSuccess?, onError? }` | `resolveBinding(binding)` (`UNRESOLVED_BINDING`), optional logical binding kind (`BINDING_KIND_MISMATCH`), and covered `paramsFromState` paths (`UNCOVERED_INPUT`). | `{ kind: 'command', method: 'POST', path, paramsFromState, onSuccess?, onError? }`. | `binding` replaced with `{ method, path }` from `httpMap`. |
| `refetch` | `{ kind, targets }` | No reference check. | Same shape, `kind: 'refetch'`. | Passed through verbatim. |

### Data bindings

`ScreenDescriptor.data[statePath] = { binding, params?, refetchOn? }`. For each entry:

- `binding` is resolved via `resolvers.resolveBinding` (validate) and mapped to `{ method, path }` via `httpMap` (emit). If the resolver exposes logical kind metadata, data bindings require `query`. Project composition derives that logical kind from binding `exposure` (`read` -> `query`, `action` -> `command`).
- `params` values may be literals (string / number / boolean) or `{ $state: "<path>" }` references; `$state` input paths must be covered, and all params pass through `emit` untouched.
- `refetchOn` is `Array<'mount' | 'params'>`; it passes through `emit` untouched.
- `statePath` becomes a covered `$state` prefix automatically (see reference-validation rules).

## Invariants & gotchas

- **Manifest version literal is `"2.0"`.** Both `SourceManifest.version` and `CompiledManifest.version` are the string literal `"2.0"`. Anything else must be rejected at parse time.
- **File pair convention: `<base>.spec.json` + `<base>.screen.json`.** `resolve.readPair` joins `baseDir` with these suffixes. Screens and layouts each require both files; fragments require only `.spec.json`.
- **Screen key is the last path segment of `route.screen`.** `resolve` and `emit` derive the compiled screen key via `route.screen.split('/').pop()!`. Two different screen base paths with the same trailing segment fail with `DUPLICATE_SCREEN_KEY`.
- **Fragments are collected transitively with cycle detection.** `resolve.collectFragments` recurses through nested `$ref` elements and records `CIRCULAR_REF` if a path re-enters the `visiting` set. See `test/fixtures/cycle-app` (`fragments/a` ↔ `fragments/b`).
- **`$ref` elements are erased at compile time.** After `expand`, the compiled spec contains no `$ref` and no `$param` markers. `test/integration/compile.test.ts` asserts this by `JSON.stringify(spec)` not containing either token.
- **Inlined fragment element IDs are prefixed `<refKey>__<elKey>`.** Nested `$ref` inside a fragment yields `<outerRefKey>__<innerRefKey>__<fragmentRoot>`. Parent `children` arrays are rewired to point at the inlined root. See `fragment-app` test producing key `greeting__wrap`.
- **`$param` substitution is deep.** `expand.substituteParams` walks props, `visible`, `on`, and `watch`. A `{ $param: "name" }` object with no matching `bind` entry is left untouched; validation surfaces it later.
- **Slots are layout-only.** `validateStructural` rejects `type === 'Slot'` outside layouts with `SLOT_NOT_IN_LAYOUT`.
- **Structural errors short-circuit reference validation.** `validate` returns after the structural pass if any errors accumulated; reference rules do not run against a broken tree.
- **Route resolution merges manifest routes with caller-supplied `resolveRoute`.** Manifest patterns support `:param` segments (colon-prefixed part matches any value at the same index). The merged resolver `OR`s caller and manifest resolution.
- **Binding IDs are opaque to `@rntme/ui`, except optional logical kind metadata.** Reference validation requires `resolveBinding(id)` to succeed and, when the resolver returns `{ kind }` or `{ entry: { kind } }`, checks data bindings are `query` and command actions are `command`. `@rntme/bindings` now stores `exposure`; blueprint composition maps `read`/`action` exposure into UI's logical `query`/`command` kind. Emit then uses `httpMap[id]` to attach HTTP details. Project-aware callers may therefore use qualified refs like `pricing.listPrices`, while bare ids such as `listIssues` remain valid as caller-defined local shorthands.
- **`$state` path coverage rules.** `validateReferences` accepts a state path as covered if it exactly matches a key in `screen.data`, or if it is prefixed by `/form/`, `/route/params/`, `/actions/`, `/data/__status/`, `/data/__error/`, `/auth/`, or equals `/currentUser`. Visual/runtime state references outside those rules yield `UNCOVERED_STATE_PATH`; data params and command/navigation `paramsFromState` outside those rules yield `UNCOVERED_INPUT`.
- **`emit` requires `httpMap` coverage.** Data bindings and command actions whose `binding` ID is absent from `httpMap` fail with `EMIT_FAILED`; callers must keep `resolvers.resolveBinding` and `httpMap` aligned.
- **`refetch` and `navigation` actions pass through `emit` verbatim.** Only `command` actions are rewritten to include `{ method, path }` (and have `binding` dropped). See `test/fixtures/refetch-app` for the `refetch` action shape.
- **`Result<T>` everywhere; no exceptions across API boundaries.** Every exported pipeline function returns a `Result`. JSON-parse failures become `MANIFEST_INVALID`; missing files become `FILE_NOT_FOUND`.
- **Layouts and screens share the `CompiledScreen` shape in output.** In `CompiledArtifact`, both `manifest.layouts` and `manifest.screens` are `Record<string, CompiledScreen>`. The difference is purely positional (a layout wraps a screen at runtime).
- **`data` and `actions` on a `CompiledScreen` are omitted when empty.** `emit` spreads them only when `Object.keys(...).length > 0`; consumers must tolerate `undefined`.
- **`resolve` stops at the first layout/screen read failure.** `FILE_NOT_FOUND` or `MANIFEST_INVALID` while reading a layout pair or screen pair short-circuits; fragment collection is not attempted.
- **`CompiledRouteEntry.screen` is the screen's short key, not its source base path.** `emit` converts `"screens/issues-home"` to `"issues-home"` for the compiled manifest, so runtime lookups use short keys only.
- **Fragment element IDs are globally unique after expansion.** Because every inlined element key is prefixed by its ref site (recursively), two sites referencing the same fragment produce disjoint IDs — element-ID collisions between fragment instances are structurally impossible.
- **`expand` preserves element `repeat` metadata verbatim.** `repeat: { statePath, key? }` is copied through without `$param` substitution on `statePath` (by design: statePath is a target, not a value).
- **Circular-ref detection tracks paths, not file handles.** `collectFragments.visiting` is a `Set<string>` of base paths; two different files normalized to the same base path are treated as the same node.
- **`resolveComponent` is load-bearing.** The references layer validates element component types, required props, and literal prop types through `ValidateResolvers.resolveComponent`; project composition supplies core runtime components plus module catalog components.
- **`resolveBinding` return values may be opaque.** Missing values still emit `UNRESOLVED_BINDING`. If the returned value has no logical `kind` metadata, binding-kind validation is skipped for compatibility; if it has metadata, mismatches emit `BINDING_KIND_MISMATCH`.
- **Validation is pure on `ExpandedSource`.** Post-expand, specs are free of `$ref`/`$param`; structural and reference validators operate on `CompiledSpec` directly, which is why they can also be reused for runtime-side sanity checks.

## Out of scope / known limits

- **No rendering.** This package produces a `CompiledArtifact`. `@rntme/ui-runtime` renders it.
- **No HTTP.** `emit` requires a caller-supplied `httpMap: Record<string, HttpEntry>`. The UI compiler does not import `@rntme/bindings`, does not parse an OpenAPI document, and does not know which engine serves a given path.
- **No binding input-shape validation.** The validator checks binding presence, optional logical binding kind, and input state coverage, but it does not validate command/data params against a binding-specific parameter schema.
- **No watch-mode or incremental build.** `compile` re-reads the whole tree each call.
- **No artifact serialization.** The compiled output is an in-memory object. Splitting into `_manifest.json`, `_layouts/*.json`, `_screens/*.json` (as described in the spec) is not implemented by this package.
- **No caller-facing Zod surface.** Zod schemas are internal parse-layer implementation details; public callers still use `resolve` / `compile` and receive `Result<T>`.
- **No multi-artifact reference resolution.** `SourceManifest.pdmRef`, `qsmRef`, `graphSpecRef`, `bindingsRef` are carried as opaque strings through the pipeline. Cross-artifact validation (e.g., `binding` IDs against a `@rntme/bindings` artifact) is delegated to `resolvers.resolveBinding`.
- **No partial-compile API.** The only entry that yields a `CompiledArtifact` is `compile`. Individual phases expose intermediate `ResolvedSource` and `ExpandedSource` types but do not produce a serializable artifact.
- **No diagnostics beyond `UiError[]`.** Errors do not include source line/column locations; `path` is a logical path (e.g., `screen:home/actions/submit`), not a file/offset pair.

## Where to look first

- Add a new element-tree structural rule → `src/validate/structural.ts`; follow the pattern of `SLOT_NOT_IN_LAYOUT`. Register the code in `UiErrorCode` (`src/types/result.ts`) and document it above.
- Add a new `$state` coverage prefix → `src/validate/references.ts`, `collectStatePaths` + the `isCovered` check.
- Add a new action kind → extend `ActionDef` in `src/types/source.ts` and `CompiledAction` in `src/types/compiled.ts`; branch in `src/emit/http-map.ts` (`resolveScreenHttp`) and in `src/validate/references.ts` (reference checks for the new kind).
- Change fragment inlining semantics → `src/expand/expand.ts`, functions `inlineFragment` and `expandSpec`.
- Add a fragment cycle reproduction → `test/fixtures/cycle-app` (`fragments/a` ↔ `fragments/b`) triggers `CIRCULAR_REF`.
- Add a `$ref`/`$param` golden test → mirror `test/fixtures/fragment-app` (exercises inlining with bind value).
- Add a refetch/command-action test → mirror `test/fixtures/refetch-app` (refetch action + `$state` params).
- Wire new HTTP entries → pass through `compile({ httpMap })`; no source change needed inside this package.
- Debug a failing compile → start at `test/integration/compile.test.ts`, then per-phase unit tests under `test/unit/`: `resolve.test.ts`, `expand.test.ts`, `validate.test.ts`, `emit.test.ts`, `types.test.ts`. Parse-schema failures are covered by `resolve.test.ts`.
- Reference the authoring-format shape for a new feature → `test/fixtures/minimal-app` (smallest valid app) and `test/fixtures/fragment-app` (one layout + one screen + one fragment).
- Run tests → `pnpm -F @rntme/ui test` (vitest).
- Inspect a compiled artifact → `compile({...})`; `result.value` is a plain JSON-serializable `CompiledArtifact` (see `src/types/compiled.ts` for keys).
- Add a new `UiErrorCode` → append to the union in `src/types/result.ts`, then update the error-code table in this README under **API → Error codes**.
- Change the `$ref` prefix separator (`__`) → `src/expand/expand.ts`, constants in `inlineFragment`; note that `@rntme/ui-runtime` may depend on the separator — verify before changing.

## Specs

- [`../../docs/history/specs/historical/2026-04-23-project-first-blueprint-design.md`](/docs/history/specs/historical/2026-04-23-project-first-blueprint-design.md) — historical umbrella design rationale for the project-first pivot: keeps UI service-level, routes project-wide UI through a normal domain service selected by `project.json`, and requires UI binding resolution against project-routed HTTP surfaces.
- [`../../docs/history/specs/historical/2026-04-16-ui-artifact-v2-design.md`](/docs/history/specs/historical/2026-04-16-ui-artifact-v2-design.md) — historical design rationale for source format (§1), compiler phases (§2), fragment/parameter rules, and the compiled-artifact shape consumed by the runtime.

## Glossary

- **Layout** — outer shell spec (e.g., `layouts/main`) rendered around every route that references it. The only place where `Slot` elements are allowed.
- **Screen** — route-specific spec (e.g., `screens/issues-home`) plus its sidecar `ScreenDescriptor` (data bindings, actions, metadata).
- **Fragment** — parameterized reusable spec referenced via `{ "$ref": "fragments/foo", "bind": { ... } }`. Compiled away by `expand`.
- **Spec** (`SpecJson` / `CompiledSpec`) — element tree: `{ root: string; elements: Record<string, ...> }`.
- **Screen descriptor** (`ScreenDescriptor`) — the `.screen.json` sidecar: `data`, `actions`, `metadata`. Separate from the visual spec.
- **Binding** — string ID referencing an HTTP endpoint in a caller-supplied `httpMap`; also validated against `resolvers.resolveBinding`.
- **State path** — slash-prefixed dotless path (e.g., `/data/results`, `/form/q`, `/route/params/id`). Covered by data bindings or recognized prefixes.
- **Binding ID** — string key into `httpMap` (`emit`) and into `resolvers.resolveBinding` (`validate`). Not a URL.
- **Resolved / Expanded / Compiled source** — three intermediate shapes: `ResolvedSource` (raw, post-filesystem), `ExpandedSource` (post-`$ref`/`$param`), `CompiledArtifact` (post-`httpMap`). Each has its own type file.
