# T001 — Scout receipt: API Explorer plan + platform map

## .tmp Input Path

`/home/coder/project/.tmp/rntme platform/api-explorer/` — confirmed exists.
Files: `README.md`, `index.html`, `app.js`, `mock-data.js`, `styles.css`.

## Plan Facts (from prototype)

### UX surfaces

- **API Overview** — 7-cell metric strip (endpoints, services, HTTP methods, warnings/errors) + base-URL copy banner.
- **Endpoint Catalogue** — search (path/summary/service/method) + four filter groups (service / method / status / auth); grouped by service, inline error/warning counts; collapsible groups.
- **Endpoint Detail** with five sub-tabs:
  - **Overview** — method, path, service, auth, source artifact, handler, QSM schema, PDM entities; copyable code example (curl / fetch / openapi).
  - **Request** — path params, query params, request body; clickable parameter rows open side-sheet.
  - **Response** — success code chip, QSM schema, field rows (path / type / required / description / source); JSON example block; error responses (2xx/4xx/5xx chips).
  - **Dependencies** — 4-step horizontal chain (Endpoint → Binding → Graph → QSM); related QSM/PDM/UI chips; broken steps render dashed+red.
  - **Raw artifact** — collapsed JSON preview of binding artifact.
- **Parameter Side-sheet** — description, type, allowed values, default, required, JSON path; actions: Copy path, Copy JSON, Show related schema.
- **Findings Panel** — top-of-page list of errors/warnings with "Open endpoint" jump action.
- **Status states** — Normal, Warning (missing example), Error (missing graph), Loading (skeleton), Empty (no bindings).

### Mock data shape

```
{
  project: { name, slug, environment, apiBaseUrl },
  services: [{ id, name }],
  summary: { endpoints, services, get, post, patch, del, warnings, errors },
  endpoints: [{
    id, method, path, service, status (Valid|Warning|Error), auth (Required|Public),
    summary, artifact, lastChanged,
    handler: { type, graphId, artifact },
    request: { pathParams, queryParams, body: { schemaName, fields } },
    response: { statusCode, qsmSchema, fields, example, errors },
    dependencies: { binding, graph, qsmSchemas[], pdmEntities[], uiComponents[] },
    warning?: { jsonPath, message, suggestedAction },
    error?: { jsonPath, message, suggestedAction }
  }],
  findings: [{ kind, endpointId, endpoint, service, artifact, jsonPath, message, suggestedAction }]
}
```

### Design-system reuse vs new patterns

- **Reuses**: tokens, type, shell, page chrome, status badges, metric strip, buttons, findings/alerts, empty/skeleton/toast, split pane, tree (search/filters/group/item), tab bar/subtabs, detail panel, JSON preview, side-sheet, usage chips, required pill, icons.
- **New pattern candidates** (~13): HTTP method badge, endpoint catalogue row, auth chip + auth dot, params/schema tables, response code chip, errors list, dependency chain card, code example tabs, overview grid, allowed-values list, base URL strip, environment pill.

## Current Platform Map

### Data-model precedent

- Screen: `apps/platform/blueprint/services/app/ui/screens/data-model.screen.json` (12-line shape: metadata + `/data/model` binding to `projects.listProjectDataModel`, params `{ projectId: { $state: '/route/params/projectId' } }`, refetchOn `[mount, params]`).
- Spec: `apps/platform/blueprint/services/app/ui/screens/data-model.spec.json` (root: `page`; elements: `PlatformPage` → `PlatformPageHeader` + `PlatformDataModelExplorer { statePath: '/data/model' }`).
- React component: `apps/platform/ui-module/src/components.tsx` exports `PlatformDataModelExplorer({ statePath })` — renders PDM tree, entity detail, fields, relationships, used-by tabs.
- Tests: `apps/platform/blueprint/test/platform-ui.test.ts`, `apps/platform/ui-module/test/components.test.tsx`.

### Projects service surface

- `apps/platform/blueprint/services/projects/operations.json` declares (native): `publishProjectBundle` (write); `listProjects`, `listProjectServices`, `getProjectArtifactSummary`, `getProjectArtifact`, `listProjectEndpoints`, `listProjectDataModel`, `listProjectUiComponents`, `listProjectGraphs` (reads).
- **`listProjectEndpoints` already exists**: `handlers/list-project-endpoints.ts` reads latest published bundle, parses, flattens per-service `bindings.json` into `{ service, operation, method, path }` rows. Returns empty list when no published version yet. Bound at `GET /api/projects/{projectId}/endpoints`.
- `apps/platform/blueprint/services/projects/handlers/types.ts` defines `ListProjectEndpointsHandlerInput/Output` and `ProjectEndpointRow`.
- Tests: `apps/platform/blueprint/test/platform-projects-handler.test.ts`.

### What's exposed today vs prototype's ask

| Prototype field | Source today |
|---|---|
| service / operation / method / path | ✓ `listProjectEndpoints` |
| project metadata (name, baseURL) | ✓ via `getProjectArtifactSummary` / project list |
| summary (endpoints, services, http counts) | derivable in UI from `listProjectEndpoints` rows |
| endpoint summary / auth / status | ✗ not surfaced |
| request/response schemas, examples, error responses | ✗ not surfaced (raw artifact via `getProjectArtifact` only) |
| dependencies (binding → graph → QSM, related PDM/UI) | ✗ not surfaced as structured data |
| validation findings (warnings/errors) | ✗ no source — owner doc explicitly says "until a real validation-report source exists" |

### UI module

- `apps/platform/ui-module/module.json` registers ~22 components; **no `PlatformAPIExplorer` yet**.
- `apps/platform/ui-module/src/components.tsx` (~2000 lines): functional components consuming `statePath` via `useStateStore`; helper `rowsFromState(value)` unwraps envelope shapes (`{ endpoints: [...] }` → `[...]`).
- `apps/platform/ui-module/src/client.ts`, `src/index.ts` re-export the registry.
- `apps/platform/ui-module/assets/platform-ui.css` is the CSS source for shipped components.

### Project dashboard (entry point)

- Screen + spec at `apps/platform/blueprint/services/app/ui/screens/project.screen.json` / `.spec.json`.
- Header action **already wired** to `/{orgId}/projects/{projectId}/api` alongside `data-model`, `ui`, `graph`.
- An `api` screen needs to exist as a named blueprint screen — Scout did not confirm whether `api.screen.json` already exists; T002/T003 must check before creating.

## Verification commands (don't run yet)

From repo root:

- `bun run typecheck`
- `bun run --filter @rntme/platform test` (blueprint: route compilation + handler tests)
- `bun test --cwd apps/platform/ui-module` (component rendering)
- `bun run lint`
- `bun run --cwd apps/platform/ui-module build` (dist sanity)

Confirm exact package names against the workspace `package.json`s before invoking.

## Production redeploy scope

**Default OUT-of-scope.** MVP consumes existing `/api/projects/{projectId}/endpoints` and renders against published bundle data already in production. No CLI/deployer/env-var changes. Operator approval required before any `platform up` task. Slice A and most of Slice B can ship purely as blueprint + UI changes (no new backend surface).

## Docs touch candidates

- `docs/current/owners/apps/platform.md` — add API Explorer screen to the platform UI inventory; if a new operation is added, add to native operations table.
- `apps/platform/ui-module/README.md` (and any owner doc it links to) — register `PlatformAPIExplorer` component.
- `apps/platform/README.md` — only if new local commands.
- `docs/decision-system.md` — only if Slice C surfaces a new bet about validation-findings ownership; defer.

## Candidate slices for Judge

### Slice A — Endpoints catalogue + navigation (smallest useful vertical)

- Scope: render endpoint list from `listProjectEndpoints`, grouped by service, with HTTP method badge + path; populate / verify the `api` screen + spec; ensure dashboard "API" header link lands on it.
- allowed_files:
  - `apps/platform/blueprint/services/app/ui/screens/api.screen.json` (create or populate)
  - `apps/platform/blueprint/services/app/ui/screens/api.spec.json` (create or populate)
  - `apps/platform/ui-module/src/components.tsx` (new `PlatformAPIExplorer`)
  - `apps/platform/ui-module/module.json` (register component)
  - `apps/platform/ui-module/src/client.ts`, `src/index.ts` (export)
  - `apps/platform/ui-module/assets/platform-ui.css` (method badge + endpoint row styles)
  - `apps/platform/blueprint/test/platform-ui.test.ts` (assert api screen route + explorer element)
  - `apps/platform/ui-module/test/components.test.tsx` (render test)
  - `docs/current/owners/apps/platform.md` (docs touch)
- verify: `bun run typecheck`; `bun run --filter @rntme/platform test`; `bun test --cwd apps/platform/ui-module`.
- stop_if: blueprint route registration fails; binding mismatch; component not picked up by registry.
- Why largest safe useful: ships an end-to-end vertical (binding → handler → screen → spec → component → dashboard link → tests → docs); no backend changes; reuses existing handler.

### Slice B — Endpoint detail panel: Overview + Request + Response (medium vertical)

- Scope: detail pane with sub-tabs (Overview / Request / Response); render parameter tables and response schema rows from parsed request/response metadata; parameter side-sheet.
- allowed_files: A's files plus
  - `apps/platform/blueprint/services/projects/handlers/types.ts` (add `EndpointDetail`, `EndpointRequest`, `EndpointResponse`)
  - `apps/platform/blueprint/services/projects/operations.json` (add `getProjectEndpointDetail` if needed)
  - `apps/platform/blueprint/services/projects/handlers/get-project-endpoint-detail.ts` (NEW; or omit and parse client-side via `getProjectArtifact`)
  - `apps/platform/blueprint/services/projects/bindings/bindings.json` (`GET /api/projects/{projectId}/endpoints/{endpointId}`)
  - `apps/platform/blueprint/test/platform-projects-handler.test.ts`
- verify: same as A.
- stop_if: handler shape mismatch; side-sheet render fails; request/response data not derivable from current bundle artifacts.
- Why: delivers full endpoint inspection; depends on Slice A's component scaffold; medium-effort, high-value.

### Slice C — Dependency chain + validation findings (largest vertical)

- Scope: Dependencies tab with 4-step chain (Endpoint → Binding → Graph → QSM) + related chips (QSM/PDM/UI); top-of-page findings panel.
- allowed_files: B's files plus
  - `apps/platform/blueprint/services/projects/handlers/types.ts` (add `EndpointDependencies`, `ValidationFinding`)
  - `apps/platform/blueprint/services/projects/operations.json` (add `listProjectFindings`)
  - `apps/platform/blueprint/services/projects/handlers/list-project-findings.ts` (NEW; placeholder until real source exists per owner doc)
- stop_if: validation findings require a source not yet in the platform (decision-system bet about validation report ownership).
- Why: visualizes full lineage; surfaces issues at point of use. Largest safe useful slice but blocked on findings source.

## Recommendation to Judge

**Slice A is the largest safe vertical for the first Worker package.** It:

- ships an observable user feature (project dashboard "API" → endpoint catalogue),
- requires zero new backend handlers,
- exercises the full screen+spec+component pattern modelled on data-model, validating the pipeline before adding richer detail,
- avoids the validation-findings ambiguity entirely,
- leaves Slice B and Slice C as natural follow-up Worker packages with clear scope boundaries.

T002 should confirm the `api.screen.json` baseline state (Scout did not confirm whether the file already exists as a stub) and decide whether docs touch lives inside the same Worker package or as a tiny PM/docs follow-up.
