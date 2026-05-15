# T003 — Worker receipt: PlatformAPIExplorer slice

## Result

done

## Summary

Replaced the placeholder `PlatformDataTable` on the project API screen with a new `PlatformAPIExplorer` component: searchable, service-grouped HTTP endpoint catalogue with HTTP method filter chips, method badges (reusing existing `--status-*-wash/edge/ink` tokens), and a side detail Overview pane. Overview populates `Service / Operation / Method / Path` from `ProjectEndpointRow` and renders explicit "Not yet exposed by handler" placeholders for the eight handler-only fields the prototype expects (Summary, Auth, Source artifact, Handler, Request schema, Response schema, Examples, Dependencies). Component binds to existing `/data/endpoints` and `/data/summary` state paths; no new bindings, handlers, or operations.

## Changed files (all inside allowed_files)

- `apps/platform/blueprint/services/app/ui/screens/api.spec.json` — replaced `endpointsPanel` + `endpointsTable` (PlatformDataTable) with single `endpointsExplorer: PlatformAPIExplorer { endpointsStatePath, summaryStatePath }`; kept sibling `summary` (PlatformSummaryGrid) and `header`.
- `apps/platform/ui-module/src/components.tsx` — added `PlatformAPIExplorer` component (~1379 lines incl. existing dirty work), `renderAPIDetail` helper, `APIEndpointRow` type, `API_METHODS`, `API_DETAIL_PLACEHOLDERS`, `methodBadgeClass`, `endpointKey`, `toAPIEndpointRow`; added `'endpoints'` to `rowsFromState` envelope keys so the handler's `{ status, endpoints }` envelope unwraps cleanly.
- `apps/platform/ui-module/src/client.ts` + `src/index.ts` — exported `PlatformAPIExplorer`.
- `apps/platform/ui-module/module.json` — registered `PlatformAPIExplorer` with `endpointsStatePath` / `summaryStatePath` string props.
- `apps/platform/ui-module/assets/platform-ui.css` — added `rntme-pae-*` namespace block (split-pane grid, search input, method filter chips, grouped catalogue rows, method badges per HTTP verb, detail card, Overview row grid, placeholder muted styling). No new design tokens.
- `apps/platform/ui-module/test/components.test.tsx` — added 3 PlatformAPIExplorer tests (catalogue grouping + method badges + Overview placeholders; empty-state copy; selection-and-method-filter interaction) plus module.json prop-schema assertion.
- `apps/platform/blueprint/test/platform-ui.test.ts` — replaced `endpointsTable: PlatformDataTable` assertion with `endpointsExplorer: PlatformAPIExplorer` assertion that pins both prop paths.
- `docs/current/owners/apps/platform.md` — added paragraph in UI section describing the API explorer screen, bindings, populated/placeholder Overview fields, and explicit deferral of richer detail tabs to a follow-up slice.

## Verification

| Command | Result |
| --- | --- |
| `bun run --cwd apps/platform/ui-module typecheck` | pass |
| `bun run --cwd apps/platform/ui-module lint` | pass |
| `bun run --cwd apps/platform/ui-module build` | pass |
| `bun test --cwd apps/platform/ui-module` | pass (34 tests / 136 expects) |
| `bun run --cwd apps/platform typecheck` | pass |
| `bun test --cwd apps/platform blueprint/test/platform-ui.test.ts` | pass (1 test / 44 expects) |

PM trust-but-verify re-ran the two contract-pinning suites: both pass identically.

## Deferred

**Slice B**: `getProjectEndpointDetail` native handler + types + `GET /api/projects/{projectId}/endpoints/{endpointId}` binding to populate the eight Overview placeholder rows; Request / Response / Code-example / Raw-artifact tabs; parameter side-sheet.

**Slice C**: Dependencies tab (Endpoint → Binding → Graph → QSM chain + related chips); top-of-page findings panel; per-endpoint Status (Valid / Warning / Error) treatment. Still BLOCKED on the validation-findings source decision per owner doc.

## Notes for Judge audit

- Eight placeholder Overview rows use exact copy "Not yet exposed by handler" with `is-placeholder` modifier; `data-pae-placeholder="true"` attribute makes them machine-distinguishable in tests.
- Spec keeps the sibling `PlatformSummaryGrid` rather than absorbing summary into the explorer; explorer subscribes to `summaryStatePath` (so future per-method counts can be sourced from the handler) but only renders per-method counts derived client-side from `endpoints` today, avoiding duplicated metric strip.
- HTTP method badge classes (`rntme-pae-method-GET/POST/PUT/PATCH/DELETE`) reuse existing `--status-*-wash/edge/ink` tokens exactly as `.tmp` prototype documents (GET=ready, POST=building, PATCH/PUT=warn, DELETE=error). No new design tokens.
- Added `'endpoints'` to central `rowsFromState` envelope-key list. Same pattern other state-driven components rely on (`projects`, `deployments`, `tokens`); no behavior change for existing consumers.
- `endpointsRaw === undefined` branch renders "Loading endpoints…"; once runtime resolves the fetch (even to empty list), empty-state path renders "No endpoints found".
- Catalogue groups derived dynamically from `uniqueSorted` over filtered rows, mirroring `PlatformDataModelExplorer`'s service-grouping pattern.
