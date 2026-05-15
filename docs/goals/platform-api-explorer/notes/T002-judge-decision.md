# T002 — Judge decision: first API Explorer Worker slice

## Decision

approved

## Slice picked

Replace the placeholder `PlatformDataTable` on the `api` screen with a new `PlatformAPIExplorer` component delivering search + service grouping + HTTP method badges + an inline endpoint detail panel (Overview shell with method/path/service/operation always populated and clearly labelled "Not yet exposed by handler" placeholders for auth/summary/schemas/examples), bound to the existing `/data/endpoints` and `/data/summary` state paths.

## Rationale

- `api.screen.json`, `api.spec.json`, the dashboard route header link, and the `platform-ui.test.ts:98-104` route assertion all already exist with a placeholder table — Scout's "Slice A" as a green-field catalogue is no longer the right framing.
- A pure single-component swap would be too small and would violate the charter rule against tiny scaffold-only Workers.
- Existing `listProjectEndpoints` rows (`{ service, operation, method, path }`) are sufficient to render catalogue UX (search/filter/group/method badges) AND a meaningful Overview pane in the detail panel — without any new backend handler, which keeps the slice fully local, reversible, and free of new operator approvals.
- Shipping the detail-panel SHELL now (with explicit "Not yet exposed by handler" placeholders for handler-only fields) gives Slice B a stable component skeleton to fill with `getProjectEndpointDetail` + parameter side-sheet, instead of forcing Slice B to also re-architect the layout.
- Findings panel (Slice C) remains correctly deferred — owner doc still says the validation-findings source is unsettled.

## T003 Worker contract (locked)

```yaml
objective: "Replace the placeholder PlatformDataTable on the project API screen with a new PlatformAPIExplorer component that renders a searchable, service-grouped endpoint catalogue with HTTP method badges and a side detail pane (Overview shell populated from listProjectEndpoints fields with explicit placeholders for handler-only fields), bound to the existing /data/endpoints and /data/summary state paths."

allowed_files:
  - apps/platform/blueprint/services/app/ui/screens/api.spec.json
  - apps/platform/ui-module/src/components.tsx
  - apps/platform/ui-module/src/client.ts
  - apps/platform/ui-module/src/index.ts
  - apps/platform/ui-module/module.json
  - apps/platform/ui-module/assets/platform-ui.css
  - apps/platform/ui-module/test/components.test.tsx
  - apps/platform/blueprint/test/platform-ui.test.ts
  - docs/current/owners/apps/platform.md

verify:
  - "bun run --cwd apps/platform/ui-module typecheck"
  - "bun run --cwd apps/platform/ui-module lint"
  - "bun run --cwd apps/platform/ui-module build"
  - "bun test --cwd apps/platform/ui-module"
  - "bun run --cwd apps/platform typecheck"
  - "bun test --cwd apps/platform blueprint/test/platform-ui.test.ts"

stop_if:
  - "Need to write any file outside allowed_files (especially: any new handler under apps/platform/blueprint/services/projects/handlers/, any change to operations.json, bindings.json, api.screen.json, or any package.json/tsconfig change)."
  - "PlatformAPIExplorer rendering needs data fields not present in the current ProjectEndpointRow shape ({service, operation, method, path}) AND not derivable client-side — record the missing field as deferred to Slice B and stop instead of inventing data."
  - "platform-ui.test.ts cannot be updated to assert PlatformAPIExplorer because the existing spec.elements.endpointsTable shape is constrained by an upstream contract not in allowed_files."
  - "Verification fails twice for the same reason — escalate with the failing command and output instead of looping."
  - "Production redeploy is required to demonstrate the change (it is not — the published bundle already feeds /api/projects/{projectId}/endpoints in production; this is UI-only)."
  - "The catalogue/detail UX is genuinely ambiguous after re-reading .tmp/rntme platform/api-explorer/* — escalate with the ambiguity rather than guessing."

docs_touch_required: true   # update docs/current/owners/apps/platform.md UI section to register PlatformAPIExplorer alongside PlatformDataModelExplorer
production_redeploy: out_of_scope
```

## Deferred to Slice B

- New `getProjectEndpointDetail` native handler + types + binding `GET /api/projects/{projectId}/endpoints/{endpointId}`.
- Populate Overview placeholders (auth, summary, source artifact, handler reference, QSM schema, PDM entity links).
- Request tab (path/query/body parameter tables) + parameter side-sheet (description, type, allowed values, default, required, JSON path; copy actions).
- Response tab (status code chip, schema rows, JSON example, error responses).
- Code-example tabs (curl / fetch / openapi).
- Raw artifact preview tab via existing `getProjectArtifact`.

## Deferred to Slice C

- Dependencies tab (4-step Endpoint → Binding → Graph → QSM chain + related QSM/PDM/UI chips).
- Findings panel (top-of-page warnings/errors with jump actions, per-row finding badges).
- Per-endpoint Status (Valid / Warning / Error) treatment.
- BLOCKED on a decision about the validation-findings source — owner doc explicitly defers this until a real validation-report source exists.

## Operator decisions needed

None block T003. Findings-source decision only blocks Slice C; per goal charter, missing input does not stop the goal — it stops a slice. T003 proceeds immediately on local files only.

## Package-name correction (vs Scout)

- Scout suggested `bun run --filter @rntme/platform test`; the actual blueprint package is **`@rntme/platform-blueprint`** at `apps/platform/` and exposes `test = "bun test blueprint/test"`, `typecheck = "tsc -p tsconfig.check.json"` (no `lint`/`build` script at this layer).
- The UI module is **`@rntme/platform-ui`** at `apps/platform/ui-module/` and exposes `typecheck`, `lint`, `build`, and `test` (test runs build first).
