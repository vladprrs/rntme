# Module Client UI Design System

Date: 2026-05-12

## Status

Approved design from brainstorming. Written spec is pending user review.
Implementation plans have not been written yet.

## Context

The platform UI has been moved into `apps/platform/blueprint` and is served by
`@rntme/runtime`. The recent platform dashboard work exposed a boundary problem:
product-specific dashboard components and CSS were added to
`packages/runtime/ui-runtime`. That made the runtime carry platform product
style and component ownership.

Current code already has the right general mechanism for executable browser
extensions:

- `module.json#client.entry` points to browser module code.
- `module.json#client.components` declares React component types.
- `module.json#client.boot` declares module boot code.
- `module.json#client.operations` declares module actions.
- `@rntme/blueprint` builds `catalogManifest` and `virtualEntrySource`.
- `@rntme/ui-runtime` merges shadcn/base components with module components.

The missing surfaces are static browser assets and reusable JSON authoring
patterns. Without those surfaces, every product design system is tempted to add
CSS and components to `ui-runtime`.

The prepared `.tmp/rntme Design System` folder provides brand foundations:
light-only OKLCH tokens, typography, spacing, radius, motion, logos, icons, and
anti-patterns. It is a seed/source for platform UI styling, not a runtime
contract and not a package boundary by itself.

## Goals

- Keep one module model. A module package may expose server, provisioner, and
  browser/client surfaces, but "UI module" is not a separate module type.
- Add a canonical module surface for non-executable browser assets.
- Add a canonical module surface for reusable UI authoring fragments.
- Move platform-specific components, tokens, and dashboard CSS out of
  `@rntme/ui-runtime`.
- Let platform UI consume its design system through `project.json#modules`.
- Preserve `@rntme/ui` as a JSON UI compiler, not a module asset manager.
- Preserve `@rntme/ui-runtime` as a generic host, not a product design system.
- Keep compiled UI artifacts free of `$ref` and `$param`, as they are today.

## Non-Goals

- A separate "UI module" kind. This spec extends the existing module manifest.
- Runtime package discovery. `ui-runtime` receives a composed asset manifest;
  it does not inspect `node_modules` or blueprint modules.
- JavaScript files in `client.assets`. Executable browser code continues to go
  through `client.entry` and the generated virtual entry.
- Copying or materializing presets into blueprint source as a normal workflow.
  Reusable patterns are referenced and resolved at compile time.
- Full screen/layout recipes in v1. Platform screens own service bindings,
  route params, and actions; those remain in the blueprint.
- A reusable global dashboard kit. `apps/platform/ui-module` is
  platform-specific.
- Moving `.tmp/rntme Design System` into the contract surface. It is seed
  material only.

## Decision-System Impact

No goal or filter changes are required.

This design follows existing filters:

- F1 Lean-core check: product design systems are not needed by every service,
  so they must not live in runtime core.
- F2 Canonical-way check: executable browser code continues through
  `client.entry`; assets and authoring references do not introduce a second
  script path.
- F5 LLM-authorability check: module assets and presets are declared in
  `module.json` and validated fail-fast.
- F6 Repeatability check: blueprint composition records the module asset and
  preset inputs that are used to produce the deployed UI.
- F8 Existing standards/libraries: rendering stays on the existing
  json-render/shadcn/module-catalog path.

The implementation should add a locked-pending bet to `docs/decision-system.md`
for the module client surface:

> Module client surface owns product UI extension - Product UI components,
> static browser assets, and reusable authoring fragments are contributed by
> module packages through `module.json#client.*`. `@rntme/ui-runtime` remains a
> generic host plus base catalog, and must not accumulate product-specific
> design systems. - G4, G5, F1, F2, F5, F6 - locked-pending - this spec.

## Target Architecture

```text
project.json#modules
  platformUi: { package: "@rntme/platform-ui" }
      |
      v
@rntme/blueprint
  discover module package
  parse module.json
  validate client.components / client.assets / client.presets
  build catalogManifest
  build virtualEntrySource
  build uiAssetManifest
  provide module-ref resolver to @rntme/ui compile
      |
      v
@rntme/ui
  resolve local refs and module-qualified refs
  expand fragments
  validate components/actions/bindings
  emit CompiledArtifact with no refs
      |
      v
deploy/CLI bundle path
  materialize virtual entry
  bundle project SPA JS/CSS
  copy module static assets
      |
      v
@rntme/ui-runtime
  createApp({ artifact, assetsDir, assetManifest })
  serve HTML shell, UI JSON, SPA assets, module static assets
  expose /_ui-assets.json for inspection
```

## Module Manifest Surface

The existing `client` block remains the single browser integration surface. It
gains two optional fields: `assets` and `presets`.

Sketch:

```jsonc
{
  "name": "@rntme/platform-ui",
  "version": "0.0.0",
  "client": {
    "entry": "./dist/client.js",
    "components": [
      {
        "type": "PlatformPageHeader",
        "props": {
          "eyebrow": { "type": "string" },
          "title": { "type": "string", "required": true }
        }
      }
    ],
    "assets": {
      "stylesheets": [
        {
          "id": "platform-ui",
          "path": "assets/platform-ui.css",
          "order": 100,
          "media": "all",
          "scope": "document"
        }
      ],
      "fonts": [
        {
          "id": "switzer-400",
          "path": "assets/fonts/switzer-400.woff2",
          "family": "Switzer",
          "weight": "400",
          "preload": true
        }
      ],
      "icons": [
        { "id": "logo-monogram", "path": "assets/logo-monogram.svg" }
      ],
      "images": [],
      "preloads": [
        { "path": "assets/platform-ui.css", "as": "style" }
      ]
    },
    "presets": [
      {
        "name": "service-card",
        "kind": "fragment",
        "path": "fragments/service-card",
        "description": "Platform service summary card.",
        "inputs": {
          "name": { "type": "string", "required": true },
          "status": { "type": "string" }
        }
      }
    ]
  }
}
```

Rules:

- `client.assets` is non-executable. It may contain stylesheets, fonts,
  images, icons, static files, and preload metadata. It must not contain
  script assets.
- `client.presets` is a strict public export list. Files that are not listed
  are private package implementation details.
- In v1, `client.presets[].kind` supports `fragment`. Screen and layout
  presets are deferred.
- Paths are relative to the module package root and must stay inside the
  package.
- Asset and preset ids/names must be deterministic and unique within the
  module.

## Authoring References

Blueprint UI specs use the current `$ref` mechanism with module-qualified
paths:

```json
{
  "$ref": "module:platformUi/fragments/service-card",
  "bind": {
    "name": "deployments",
    "status": "Ready"
  }
}
```

`platformUi` is the `project.json#modules` key, not the package name. This keeps
the UI source tied to the project module wiring and allows future package swaps
without rewriting every UI spec.

Resolution rules:

- Local refs keep their existing form, for example `"fragments/greeting"`.
- Module refs use `module:<projectModuleKey>/<presetPath>`.
- `<projectModuleKey>` must exist in `project.json#modules`.
- `<presetPath>` must match an exported `client.presets[].path`.
- The exported preset must have `kind: "fragment"` when used in a `$ref`.
- Module fragments may reference other exported fragments from the same module.
  Project specs and project-local fragments may reference module fragments.
  Module fragments must not reference project-local fragments.
- After expansion, compiled specs contain no `$ref` or `$param`, as today.

No copy step is part of the normal authoring model. The blueprint is the source
of truth for how a module fragment is used, including bind values and placement.
The module package is the source of truth for the reusable fragment definition.

## Assets And Runtime

`@rntme/blueprint` collects module asset declarations into a composed
`uiAssetManifest`. `@rntme/ui` does not know about assets.

The deploy/CLI bundle path copies the declared files into the project UI asset
directory and keeps deterministic public hrefs. `@rntme/ui-runtime` receives
the manifest explicitly:

```ts
createApp({
  artifact,
  assetsDir,
  assetManifest,
});
```

Runtime behavior:

- The HTML shell emits deterministic preload and stylesheet tags from
  `assetManifest`.
- `/assets/*` remains sandboxed under `assetsDir`.
- `GET /_ui-assets.json` returns the asset manifest for inspection.
- The runtime does not discover modules or read `module.json`.
- CSP stays restrictive and is extended only for same-origin static assets
  required by the manifest.

Executable browser code stays on the existing virtual entry path:

- React components are named exports from `client.entry`.
- `boot` and operations are exports from `client.entry`.
- Module code is bundled into project SPA JS through `virtualEntrySource`.

## Platform Migration

Create `apps/platform/ui-module` as a product-local workspace package with the
package name `@rntme/platform-ui`. It is referenced from
`apps/platform/blueprint/project.json#modules.platformUi`.

The package exports platform-specific React components through `client.entry`
and declares them in `module.json#client.components`. Component type names get
a `Platform*` prefix:

- `PlatformPage`
- `PlatformPageHeader`
- `PlatformPanel`
- `PlatformSidebar`
- `PlatformTopbar`
- `PlatformSummaryGrid`
- `PlatformServicesPanel`
- `PlatformTimeline`
- `PlatformAlertList`
- `PlatformBanner`
- `PlatformEmptyState`
- `PlatformDataTable`
- `PlatformBox`

`DataTable` is split:

- The base catalog keeps or adds a low-level `Table` primitive with no
  platform product styling.
- Product behavior and styling move to `PlatformDataTable`.

Move the current platform dashboard CSS and the relevant tokens/assets from
`.tmp/rntme Design System` into `apps/platform/ui-module/assets`. The `.tmp`
folder remains seed material only.

Update platform UI specs to use `Platform*` component types. Route manifests,
screen descriptors, data bindings, and actions remain in
`apps/platform/blueprint/services/app/ui`.

The current platform dashboard should not be exported as whole screens. Its
service-specific parts depend on bindings such as `tokens.createToken`,
`deployments.listDeployments`, and route params. Those belong in the blueprint.
The module should export reusable fragments/patterns where repetition exists.

## Validation

Add fail-fast validation for:

- `module.json#client.assets`
  - relative paths only;
  - no parent traversal or absolute paths;
  - files exist;
  - scripts rejected;
  - duplicate ids rejected;
  - deterministic ordering.
- `module.json#client.presets`
  - kind is `fragment` in v1;
  - path exists as a `.spec.json` fragment source;
  - path stays inside the package;
  - duplicate names and paths rejected;
  - declared inputs use the existing `PropSchema` shape.
- Module-qualified `$ref`
  - module key exists;
  - preset path is exported by that module;
  - kind is compatible with `$ref`;
  - local and module fragment cycles are detected.
- Component catalog
  - duplicate component type collisions still fail;
  - platform component names use `Platform*` to avoid accidental generic
    collisions.
- Runtime assets
  - shell tag output is deterministic;
  - path traversal is blocked;
  - `/_ui-assets.json` matches the manifest passed to `createApp`.

Error codes must be appended, not renamed or repurposed.

## Testing

Required tests:

- `@rntme/contracts-module-v1`: parser tests for `client.assets` and
  `client.presets`, including invalid scripts and bad paths.
- `@rntme/blueprint`: compose fixture with module assets and module preset
  refs; validation errors for missing module keys, unexported refs, and cycles.
- `@rntme/ui`: resolver/expand tests proving module-qualified refs inline and
  compiled output contains no `$ref` or `$param`.
- `@rntme/ui-runtime`: server tests for shell links/preloads,
  `/_ui-assets.json`, and sandboxed asset serving.
- `apps/platform/blueprint`: compose tests after moving to
  `@rntme/platform-ui` and `Platform*` component names.
- Repo gates: build, typecheck, test, lint, depcruise, vendor check.

## Docs Touch

Implementation must update:

- `packages/contracts/module/v1/README.md` and owner doc for `client.assets`
  and `client.presets`.
- `packages/artifacts/blueprint/README.md` and owner doc for module asset
  composition and module-qualified UI refs.
- `packages/artifacts/ui/README.md` and owner doc for module ref resolver
  behavior while keeping `@rntme/ui` module-agnostic.
- `packages/runtime/ui-runtime/README.md` and owner doc for `assetManifest` and
  `/_ui-assets.json`.
- `apps/platform/README.md` and owner doc for `apps/platform/ui-module`.
- `AGENTS.md` if the repo map or package lookup table gains
  `apps/platform/ui-module`.
- `docs/decision-system.md` for the locked-pending module client surface bet.

No update is needed to root `README.md` unless the public project positioning or
quick start changes.

## Implementation Slices

The implementation plan should split work into small slices:

1. Extend the module manifest contract and tests.
2. Add blueprint composition for `client.assets` and `client.presets`.
3. Add module-qualified `$ref` resolution through blueprint-driven UI compile.
4. Add `ui-runtime` `assetManifest` support and inspection endpoint.
5. Add project bundle/deploy materialization for module static assets.
6. Create `apps/platform/ui-module` and migrate platform components/assets.
7. Rename platform UI specs to `Platform*` component types and remove platform
   components/CSS from `ui-runtime`.
8. Update docs and decision-system.

## Future Decisions

- Revisit a host-only `ui-runtime` where even the base visual catalog is a
  module. V1 keeps `ui-runtime` as host plus shadcn/base catalog.
- Add `client.presets` kinds for `layout` and `screen` if a real use case needs
  full route-level templates.
- Consider a reusable rntme brand module if multiple products need the same
  non-platform design system.
- Add richer asset optimization, integrity generation, and font self-hosting
  automation after the static asset contract lands.
