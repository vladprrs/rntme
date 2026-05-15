# T005 — Judge decision: B1 Worker contract locked

## Decision

approved

## Pre-decision verifications

- **Handler precedent**: matches Scout's sketch. `list-project-endpoints.ts` uses discriminated `{ status: 'ok'; endpoints } | { status: 'error'; errors: readonly PlatformError[] }`; `RuntimeCtx = { qsmDb }`; auth gate `sessionStatus === 'ACTIVE' && typeof sessionSubject === 'string'`; bundle path `qsmDb → project_versions → project_version_bundles → parseCanonicalBundle`.
- **operations.json field names**: confirmed `effect` and `idempotency` are the actual keys (verified vs `listProjectEndpoints`/`listProjectDataModel`/`getProjectArtifact`).
- **Pseudo-graph file required**: NO. `apps/platform/blueprint/services/projects/graphs/` only contains files for non-native operations (createProject, listProjects, etc.) plus shapes.json. None of the existing native handlers have a graph file. The `graph` field in bindings.json is a pure identifier for native targets.
- **Test fixture**: `platform-projects-handler.test.ts` does NOT load demo/notes-blueprint. It builds synthetic inline bundle bytes via helpers like `makeEndpointsBundleBytes` (lines 1200–1227) and publishes via `publishProjectBundleHandler`. T006 must follow the same pattern with bundle files including per-service `bindings/bindings.json`, `graphs/shapes.json`, and `graphs/<op>.json`.
- **bindings.json sample**: confirmed Scout's classifications. `parameters[]`, `inputFrom`, `target`, `graph`, `exposure` all present in `demo/notes-blueprint/services/app/bindings/bindings.json`. `shapes.json` carries `{ type, nullable }` per field. Graphs carry `signature.inputs[*].{type, mode}` and `signature.output.type` like `row<NoteActionResult>`.

## Corrections to Scout's proposed shape

1. **Auth derivation**: `inputFrom.authorization.required === true` → `'required'`; otherwise `'public'`.
2. **B1 emits constants for unexposed fields**: `response.example: null`, `response.errors: []`, `response.successStatus: null`, `summary: null`. These are pinned constants in B1 — the Worker must NOT invent values.

## T006 Worker contract (locked)

```yaml
objective: >-
  Slice B1: After this slice, opening any endpoint in the API Explorer for any
  published bundle shows REAL Auth, Source artifact, Handler reference, Request
  schema name, and Response schema name in the Overview pane (replacing the
  current "Not yet exposed by handler" placeholders for those five rows), plus
  a new "Raw" tab that displays the JSON of that endpoint's bindings entry.
  Implementation: add the getProjectEndpointDetail native handler + types +
  bindings.json entry + operations.json registration in apps/platform; extend
  PlatformAPIExplorer to fetch detail via useTransport on selection (no
  per-endpoint screen.json data binding — see UI binding pattern decision);
  add a third optional endpointDetailPathTemplate prop to PlatformAPIExplorer
  in module.json defaulting to /api/projects/{projectId}/endpoints/{service}/{operation};
  populate the five real Overview rows + Raw tab from the fetched detail; keep
  Summary, Examples, Dependencies, response status code, response example,
  error responses, per-field descriptions as explicit "Not yet exposed by
  handler" placeholders. Wire blueprint UI test + components test + projects
  handler test + blueprint sanity test + owner doc.

allowed_files:
  - apps/platform/blueprint/services/projects/handlers/get-project-endpoint-detail.ts
  - apps/platform/blueprint/services/projects/handlers/types.ts
  - apps/platform/blueprint/services/projects/bindings/bindings.json
  - apps/platform/blueprint/services/projects/operations.json
  - apps/platform/blueprint/test/platform-projects-handler.test.ts
  - apps/platform/blueprint/test/platform-blueprint.test.ts
  - apps/platform/blueprint/test/platform-ui.test.ts
  - apps/platform/blueprint/services/app/ui/screens/api.spec.json
  - apps/platform/ui-module/src/components.tsx
  - apps/platform/ui-module/assets/platform-ui.css
  - apps/platform/ui-module/module.json
  - apps/platform/ui-module/test/components.test.tsx
  - docs/current/owners/apps/platform.md

verify:
  - "bun run --cwd apps/platform typecheck"
  - "bun test --cwd apps/platform blueprint/test/platform-projects-handler.test.ts"
  - "bun test --cwd apps/platform blueprint/test/platform-blueprint.test.ts"
  - "bun test --cwd apps/platform blueprint/test/platform-ui.test.ts"
  - "bun run --cwd apps/platform/ui-module typecheck"
  - "bun run --cwd apps/platform/ui-module lint"
  - "bun run --cwd apps/platform/ui-module build"
  - "bun test --cwd apps/platform/ui-module"

stop_if:
  - "Need to write any file outside allowed_files (especially: any new screen.json, api.screen.json edit, src/client.ts/src/index.ts edit — PlatformAPIExplorer is already exported there; any change to packages/contracts-client-runtime-v1; any new graph file under apps/platform/blueprint/services/projects/graphs/)."
  - "Detail field requires a data source not in (a) bindings.json, (b) shapes.json, or (c) graphs/<op>.json — record as not-yet-exposed and stop instead of inventing (must match Scout's enumeration: summary, response status code, response example, error responses, per-field descriptions, example bodies)."
  - "Verification fails twice for the same reason — escalate with command output instead of looping fixes."
  - "Production redeploy is required (it is NOT — the handler change is local; whether to ship it via `platform up` is a separate operator decision and stays out-of-scope per goal charter)."
  - "The fetch-on-selection pattern via useTransport breaks the existing PlatformAPIExplorer test snapshot in a way that cannot be fixed without changing the public component prop schema beyond the single new optional `endpointDetailPathTemplate` prop — escalate the architectural ambiguity rather than guess."
  - "Walking shapes.json for the response type name (e.g. `row<NoteActionResult>` → look up `NoteActionResult.fields`) requires regex/parsing that goes beyond stripping a single `row<...>` wrapper and direct shapes lookup — record as not-yet-exposed and ship `schemaName: null` rather than inventing a generic-type parser."

docs_touch_required: true
production_redeploy: out_of_scope
```

## UI binding pattern decision

**Use `useTransport` on selection — NOT a screen.json data binding.**

Evidence: every existing screen.json data entry in `apps/platform/blueprint/services/app/ui/screens/*.screen.json` parameterizes only off `/route/params/...`, never off arbitrary in-page state (selection). Adding selection-as-binding-param would require a screen.json convention change beyond the locked allowed_files for B1.

`useTransport()` from `@rntme/contracts-client-runtime-v1` returns `(req: Request) => Promise<Response>` and is the established pattern for in-component fetches (see `PlatformTokenIssuer` at `components.tsx:268-329`). PlatformAPIExplorer will:

1. Accept a new optional prop `endpointDetailPathTemplate` (default `'/api/projects/{projectId}/endpoints/{service}/{operation}'`) — registered in `module.json`.
2. Read `projectId` from `useStateStore().get('/route/params/projectId')`.
3. On `setSelectedKey`, kick off a `React.useEffect` that calls `transport(new Request(template-substituted))`, parses JSON, stores detail in component-local state keyed by `${service}:${operation}` (in-memory cache for instant re-select).
4. The five real Overview rows + Raw tab consume the cached detail; the four still-unexposed rows continue rendering "Not yet exposed by handler".

Pattern is local to the component, requires zero screen.json convention change, matches `PlatformTokenIssuer`'s precedent. The new path is a real route through the existing edge-auth chain because `bindings.json` registers `getProjectEndpointDetail` under `/{projectId}/endpoints/{service}/{operation}` (mounted at `/api/projects` via the existing project-binding-registry pattern, which `platform-blueprint.test.ts` will assert).

## Slice C status

blocked — Validation findings still depend on the validation-report artifact decision in `docs/current/owners/apps/platform.md`; T006 must not touch findings or dependencies-tab work.

## Slice B2 (T008) preview

After T007 spot-checks T006: T008 adds the Request tab (path/query/body parameter table, parameter-row click → side-sheet), Response tab (response.fields rows + status-code chip + example block placeholders), Code-example tabs (curl/fetch/openapi skeletons derived from method + path + parameters), and the parameter side-sheet component. All UI-only; no new handlers; consumes the same `getProjectEndpointDetail` output already locked in B1. CSS additions for tables/chips/side-sheet. Extended `components.test.tsx` only — no new blueprint tests required since the binding/operation/screen wiring already lands in B1.
