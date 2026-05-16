# T001 Scout Map: Platform Data Model Explorer

## Inputs Read

- `docs/decision-system.md`
- `apps/platform/README.md` -> `docs/current/owners/apps/platform.md`
- `apps/platform/ui-module/README.md` -> `docs/current/owners/apps/platform.md`
- `packages/artifacts/pdm/README.md` -> `docs/current/owners/packages/artifacts/pdm.md`
- `packages/artifacts/qsm/README.md` -> `docs/current/owners/packages/artifacts/qsm.md`
- `packages/artifacts/blueprint/README.md` -> `docs/current/owners/packages/artifacts/blueprint.md`
- `packages/platform/platform-core/README.md` -> `docs/current/owners/packages/platform/platform-core.md`
- `.tmp/rntme-ux-design.agent.final.md`
- `.tmp/rntme platform/data-model-explorer/{README.md,index.html,app.js,mock-data.js}`
- Current implementation under `apps/platform/blueprint`, `apps/platform/ui-module`, and focused tests.

## Decision And Owner Constraints

- `docs/decision-system.md` G3 says the platform must provide inspectability surfaces rather than forcing humans to read JSON.
- `docs/decision-system.md` section 3.6 is directly binding here: platform artifact explorers must render with existing `Platform*` components, inspect published-bundle artifacts, use `statePath` bindings over native blob-parsing handlers, and avoid a new visualization dependency.
- `docs/current/owners/apps/platform.md` says project detail and artifact explorer screens already read live published-bundle data through native operations, but the current data-model explorer is only a definition-inspection list.
- PDM is project-level. `docs/current/owners/apps/platform.md` explicitly says per-service entity counts are not derivable from the service file tree and are intentionally not invented. PDM entities do still carry `ownerService` and `kind` in the artifact shape (`packages/artifacts/pdm/src/types/artifact.ts`).
- QSM is service-owned and consumes the shared project PDM. QSM projections live under `services/<svc>/qsm/projections/*.json` and expose source entity/field metadata (`docs/current/owners/packages/artifacts/qsm.md` and `packages/artifacts/qsm/src/types/artifact.ts`).

## UX Requirement Inventory From `.tmp`

The prototype describes the data-model explorer as a real PDM/QSM inspection surface, not a table of artifact filenames:

- Overview metrics: entities, fields, relationships, QSM schemas, warnings, errors.
- PDM tab: searchable entity tree, grouped by service, filterable by service/status, status pip per entity, selected/related highlights.
- Entity detail: status, artifact path, version, JSON path, finding banner, fields, relationships, used-by, raw artifact subtabs.
- Fields table: name, type, required/optional, default, description; row opens a field side sheet with validation, QSM usages, copy actions.
- Relationships: cardinality, required marker, target navigation, broken-target display.
- Used by: QSM schemas, API endpoints, UI components.
- Raw artifact preview with copy/open affordances.
- Relationship diagram: simple entity nodes and relation edges, selected and related states, missing target treatment.
- QSM tab: searchable schema/projection tree grouped by service, detail panel with source entities, fields, computed/source expression, API endpoints, raw artifact.
- States: loading skeleton and empty state. Prototype also has warning/error state switcher; production should derive status from real data.

Important current-data constraint: PDM fields do not have authoring fields for descriptions/defaults/validation rules beyond type/nullability/column/generated/key/state-machine metadata. Prototype examples such as `uuid`, `money`, `email`, descriptions, and default strings are mock-only and must not be fabricated from current PDM.

## Current Platform Gap Map

Current data-model screen:

- `apps/platform/blueprint/services/app/ui/screens/data-model.screen.json` fetches:
  - `/data/summary` from `projects.getProjectArtifactSummary`
  - `/data/entities` from `projects.getProjectArtifact` with `artifactPath: "pdm/entities"`
- `apps/platform/blueprint/services/app/ui/screens/data-model.spec.json` renders only:
  - `PlatformPageHeader`
  - `PlatformSummaryGrid`
  - one `PlatformDataTable` over `/data/entities` with `name` and `path`.

Existing native operations:

- `apps/platform/blueprint/services/projects/handlers/get-project-artifact-summary.ts`
  counts services, PDM entity files, `shapes.json` schemas, graph files, endpoint bindings, and UI specs from the latest canonical bundle.
- `apps/platform/blueprint/services/projects/handlers/get-project-artifact.ts`
  returns either one parsed artifact body or a flat `items` prefix listing.
- `apps/platform/blueprint/services/projects/handlers/list-project-endpoints.ts`
  flattens `services/*/bindings/bindings.json` to `{ service, operation, method, path }`.
- `apps/platform/blueprint/services/projects/handlers/list-project-ui-components.ts`
  flattens `*.spec.json` UI files.
- `apps/platform/blueprint/services/projects/handlers/list-project-graphs.ts`
  flattens graph files.
- `apps/platform/blueprint/services/projects/bindings/bindings.json` and `operations.json` register those operations.

Major gaps against the prototype:

- No typed data-model endpoint that returns joined PDM entities, QSM projections, relationships, graph/binding endpoint usages, and summary metrics in one state shape.
- Current `schemas` summary count means `graphs/shapes.json`, not QSM projections/read models. Prototype's "QSM schemas" map to `services/*/qsm/projections/*.json`.
- Current data-model UI has no PDM/QSM tabs, entity tree, field/relationship details, usage groups, raw JSON preview, relationship diagram, loading/empty-specific explorer states, or copy/selection behavior.
- Current `PlatformDataTable` can render rows, but there is no platform component that can render the prototype's stateful explorer interactions.
- Current artifact listing cannot serve exact QSM projection inventory across all service directories with source-entity and endpoint-usage enrichment.
- Current validation findings for warnings/errors are not persisted as a platform data source. Structural publish validation blocks invalid bundles before storage, so "broken relationship" error rows likely cannot exist for a published bundle unless represented as a separate validation-report artifact in future work.

## PDM/QSM Data Source Map

Useful real inputs in a canonical bundle:

- `pdm/entities/*.json`: entity name from file, `ownerService`, `kind`, `table`, `fields`, `keys`, optional `relations`, optional `stateMachine`.
- `services/<svc>/qsm/projections/*.json`: projection name from file, owning service from path, `backing`, `source.entity`, `keys`, `grain`, `exposed`, optional `table`.
- `services/<svc>/qsm/qsm.json`: relations object, currently often `{}`.
- `services/<svc>/graphs/*.json`: graph nodes can include `findMany.config.source.projection`, which can be used to infer projection usage by graph.
- `services/<svc>/bindings/bindings.json`: binding rows name `graph` plus `http.method` and `http.path`, which can be joined to graph projection usage for "used by endpoints".
- `services/**/ui/**/*.spec.json`: could be scanned for future UI usage, but current specs do not provide a stable, typed PDM/QSM usage link.

Recommended endpoint shape should be derived from the stored latest `project_version_bundles.bundle_bytes`, like the existing projects native handlers, and should return only facts that exist in bundle artifacts. Do not import `@rntme/pdm` or `@rntme/qsm` into `apps/platform`; the platform app currently depends on `@rntme/blueprint`, `@rntme/deploy-runner`, and `@rntme/platform-core`, and existing handlers parse the canonical bundle directly through `@rntme/platform-core`.

## Architecture Risks / Judge Questions

- Endpoint shape: one aggregate `GET /api/projects/{projectId}/data-model` is safer than many artifact listing calls because the UI needs cross-artifact joins and summary metrics.
- QSM naming: use "QSM projections" or "Read models" rather than overloading existing "schemas", because `artifact-summary.schemas` currently counts `shapes.json`.
- Validation findings: there is no durable validation-report source today. First slice should expose `warnings: []` and `errors: []` unless a real source is found; do not fake missing descriptions or broken relationships.
- Service grouping: group PDM entities by `ownerService` from the entity artifact when present, with a project/unknown fallback. Do not use per-service file path attribution.
- Field metadata: show `nullable`, `column`, `generated`, key/state-field flags. Prototype-only fields like descriptions/defaults should be omitted or represented as absent.
- Relationship diagram: implement a simple SVG/CSS diagram inside the platform UI module without adding React Flow or another dependency, matching the decision-system ruling.
- Usage joins: QSM usages are reliable via projection `source.entity` and `exposed`; endpoint usages are inferable by projection -> graph `findMany` -> binding `graph`; UI usage is unknown and should be empty until a stable convention exists.

## Candidate Worker Slices

1. **First vertical slice: typed data-model API plus explorer shell**
   - Add `projects.listProjectDataModel` native operation and binding.
   - Handler reads latest bundle and returns a typed explorer model:
     summary counts, entities with fields/relations/state metadata, QSM projections with source/exposed fields, relationship edges, endpoint usages, empty findings.
   - Add tests for handler extraction and route/operation registration.
   - Add a first `PlatformDataModelExplorer` component rendering overview tabs, entity/projection lists, selected detail, relationships/usages/raw JSON, and empty state from `statePath`.
   - Wire `data-model.screen/spec.json` to the new endpoint/component.

2. **Second slice: richer interaction polish**
   - Search/filter controls, side-sheet, copy buttons/toasts, selected diagram state, and stronger responsive CSS/tests.

3. **Future slice: durable validation report**
   - Only if publish/runtime persists validation findings. Not required for the first real-data explorer because invalid PDM/QSM should not be published.

## Suggested First Worker Scope

Allowed files:

- `apps/platform/blueprint/services/projects/handlers/types.ts`
- `apps/platform/blueprint/services/projects/handlers/list-project-data-model.ts` (new)
- `apps/platform/blueprint/services/projects/operations.json`
- `apps/platform/blueprint/services/projects/bindings/bindings.json`
- `apps/platform/blueprint/services/app/ui/screens/data-model.screen.json`
- `apps/platform/blueprint/services/app/ui/screens/data-model.spec.json`
- `apps/platform/blueprint/test/platform-blueprint.test.ts`
- `apps/platform/blueprint/test/platform-projects-handler.test.ts`
- `apps/platform/blueprint/test/platform-ui.test.ts`
- `apps/platform/ui-module/src/components.tsx`
- `apps/platform/ui-module/src/index.ts`
- `apps/platform/ui-module/src/client.ts`
- `apps/platform/ui-module/module.json`
- `apps/platform/ui-module/assets/platform-ui.css`
- `apps/platform/ui-module/test/components.test.tsx`
- `docs/current/owners/apps/platform.md`

Verification commands:

- `bun run -F @rntme/platform-blueprint test`
- `bun run -F @rntme/platform-blueprint typecheck`
- `bun test --cwd apps/platform/ui-module`
- `bun run --cwd apps/platform/ui-module typecheck`
- `bun run --cwd apps/platform/ui-module lint`
- `bun run --cwd apps/platform/ui-module build`

Docs touch:

- Update `docs/current/owners/apps/platform.md` because the public platform route/native operation list, UI behavior, and data-model explorer invariants change.
- No `docs/decision-system.md` update required if the implementation uses existing platform UI components and no new visualization dependency.
- No README stub update expected unless local commands or current-doc links change.

