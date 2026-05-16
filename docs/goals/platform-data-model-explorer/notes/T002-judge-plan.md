# T002 Judge Plan: First Data Model Explorer Slice

## Decision

Approved first Worker slice: implement a real end-to-end data-model explorer vertical slice backed by a new typed platform native operation over the latest published bundle, then render it through a new platform UI module component.

This is the largest safe useful slice because the current screen is UI-only over a generic artifact listing. A smaller UI polish task would preserve the misfire identified in the charter.

## Ordered Implementation Slices

1. **Slice 1: typed data-model endpoint + explorer baseline**
   - Add `projects.listProjectDataModel` as a native read operation and route at `GET /api/projects/{projectId}/data-model`.
   - Parse the latest `project_version_bundles.bundle_bytes` with `parseCanonicalBundle`, matching existing projects handlers.
   - Return a data-model object with summary, PDM entities, QSM projections, relations, endpoint usages, and empty findings from real bundle artifacts.
   - Add `PlatformDataModelExplorer` and wire the screen to the new endpoint.
   - Verify with platform handler/blueprint/UI-module tests and update the platform owner doc.

2. **Slice 2: interaction polish**
   - Add richer client interactions if the first slice leaves any UX gaps: search/filter controls, side-sheet field details, copy actions/toasts, keyboard focus refinements, and responsive layout refinements.

3. **Slice 3: persisted validation findings**
   - Only pursue when there is a real validation-report source. Do not fake broken relationships or missing descriptions from current PDM/QSM data.

## First Worker Objective

Implement the first real-data platform data-model explorer slice: expose a new `projects.listProjectDataModel` native API over latest published bundle PDM/QSM artifacts, wire the platform UI screen to it, render a `PlatformDataModelExplorer` with PDM and QSM tabs/detail views using existing platform UI/CSS patterns, add focused tests, and update the platform owner doc.

## Allowed Files

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

## Required Data Contract

The handler should return:

```ts
type ListProjectDataModelResult =
  | { status: 'ok'; dataModel: ProjectDataModel }
  | { status: 'error'; errors: readonly PlatformError[] };

type ProjectDataModel = {
  summary: {
    entities: number;
    fields: number;
    relationships: number;
    qsmProjections: number;
    warnings: number;
    errors: number;
  };
  entities: readonly ProjectDataModelEntity[];
  qsmProjections: readonly ProjectDataModelProjection[];
  relationships: readonly ProjectDataModelRelationship[];
  findings: readonly ProjectDataModelFinding[];
};
```

Minimum row shapes:

- Entity: `name`, `ownerService`, `kind`, `table`, `path`, `keys`, `fields`, `relations`, `stateMachine`, `qsmProjections`, `endpoints`, `raw`.
- Field: `name`, `type`, `nullable`, `column`, optional `generated`, plus `primaryKey`, `stateField`, and `qsmProjections`.
- Relationship: `source`, `name`, `target`, `cardinality`, `localKey`, `foreignKey`, `path`.
- QSM projection: `name`, `service`, `path`, `backing`, `sourceEntity`, `keys`, `grain`, `exposed`, optional `table`, `fields`, `endpoints`, `raw`.
- Endpoint: `service`, `operation`, `method`, `path`, `graph`.
- Finding: keep present but return `[]` until a real validation-report source exists.

Use only facts present in the bundle. Do not invent field descriptions, defaults, validation rules, UI usages, broken relationships, or warning/error counts.

## Implementation Notes

- Follow the existing native handler pattern in `get-project-artifact-summary.ts`, `get-project-artifact.ts`, and `list-project-endpoints.ts`.
- Keep the new handler self-contained for this slice. Do not refactor existing handlers unless a compile/test failure forces it.
- Resolve latest bundle by project id or slug through `qsmDb`, require `sessionStatus === 'ACTIVE'` and string `sessionSubject`, and return existing typed errors for auth, storage, project-not-found, no bundle, and invalid bundle parse.
- QSM projection discovery should walk all `services/<svc>/qsm/projections/*.json` files.
- Endpoint usage should be inferred by:
  - projection name -> graph files containing `findMany.config.source.projection === projectionName`;
  - graph id/file name -> binding entries where `binding.graph === graphName`;
  - expose those matching HTTP bindings as endpoint usages.
- Entity usages should include QSM projections where `source.entity === entityName`; endpoint usages can be unioned from those projections.
- Relationship diagram data can be derived from PDM `relations` records. Missing targets can be marked as missing if the target is absent, but do not count it as a validation error until there is a validation result source.
- UI should be definition-inspection and use existing CSS/React only. No React Flow, graph canvas dependency, or new visualization package.

## Verification

Run after implementation:

```bash
bun run -F @rntme/platform-blueprint test
bun run -F @rntme/platform-blueprint typecheck
bun test --cwd apps/platform/ui-module
bun run --cwd apps/platform/ui-module typecheck
bun run --cwd apps/platform/ui-module lint
bun run --cwd apps/platform/ui-module build
node /home/coder/.shared-config/codex/plugins/cache/goalbuddy/goalbuddy/0.3.6/skills/goalbuddy/scripts/check-goal-state.mjs docs/goals/platform-data-model-explorer/state.yaml
```

## Stop If

- A required edit falls outside `allowed_files`.
- The handler would need a new dependency on `@rntme/pdm`, `@rntme/qsm`, runtime packages, or a new visualization library.
- A reliable source for validation findings is required to proceed; record the gap instead of faking findings.
- Existing owner docs contradict the endpoint shape or UI component approach.
- Verification fails twice without a clear local fix.

## Docs Touch Decision

Update `docs/current/owners/apps/platform.md` because this slice adds a public platform native operation/route and changes the data-model explorer behavior. No `docs/decision-system.md` update is needed if no new visualization dependency or architectural convention is introduced. README stubs do not need changes unless commands or current-doc links change.

## Risks Deferred

- Persisted validation finding reports are a future platform capability.
- UI component usage tracing from PDM/QSM to UI specs is not stable today.
- Rich prototype interactions can be iterated after the endpoint and baseline component are verified.

