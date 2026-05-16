# T001 Scout — Dashboard map & verification method

## Summary

The platform dashboard is already substantially built and live (prior goal
`platform-full-ux-scenarios` shipped it and redeployed to `platform.rntme.com`
on 2026-05-14). The current worktree diff is an **in-progress slice adding
`hrefTemplate` navigation links** (specs, `components.tsx`, tests, owner doc) —
not yet committed/verified. The main gaps vs. the `.tmp` UX mock are the
**deployment-status timeline panel**, the **real alerts data flow**, and
**thin per-service rows**.

## Design target

- `.tmp/rntme-ux-design.agent.final.md` — dashboard reqs: §2.2 (job stories),
  §4.1 D-01..D-04 (P0: service list card/table + status badges,
  deploy-status panel with 5-state timeline, data viewer, layout/sidebar/search).
- `.tmp/rntme platform/project-dashboard-overview/` — static HTML mock
  (`index.html`, `app.js`, `mock-data.js`, `styles.css`): sidebar, project
  header, summary metrics, **deployment status timeline
  (Queued→Validating→Building→Deploying→Ready)**, service list (cards↔table
  toggle), errors/warnings panel. Six states: Ready/Building/Warning/Error/
  Loading/Empty.

## Current implementation map

- `apps/platform/blueprint/services/app/ui/screens/project.spec.json` (MODIFIED)
  — dashboard screen: header, summary grid, services panel, deploy table,
  alerts panel, versions table. Worktree change swapped header actions to 4
  `hrefTemplate` explorer links.
- `apps/platform/blueprint/services/app/ui/screens/project.screen.json` — data
  bindings: `/data/versions`, `/data/services`, `/data/summary`, `/data/deployments`.
- `apps/platform/blueprint/services/app/ui/screens/org.spec.json` (MODIFIED) —
  added `Open` column with `hrefTemplate` to project.
- `apps/platform/ui-module/src/components.tsx` (MODIFIED) — added
  `resolveTemplate`/`actionHref` helpers; `PlatformDataTable`/`PlatformPageHeader`
  render `<a hrefTemplate>` links. Components: `PlatformSummaryGrid`,
  `PlatformServicesPanel`, `PlatformTimeline` (L622, **unused by dashboard**),
  `PlatformAlertList` (L529-661).
- `apps/platform/ui-module/test/components.test.tsx` (MODIFIED),
  `apps/platform/blueprint/test/platform-ui.test.ts` (MODIFIED) — link templating tests.
- `apps/platform/blueprint/services/app/ui/manifest.json` — routes:
  `/:orgId/projects/:projectId` + four explorer routes registered.

### API handlers ("ручки") — already exist

- `apps/platform/blueprint/services/projects/handlers/` —
  `list-project-services.ts`, `get-project-artifact-summary.ts`,
  `get-project-artifact.ts`, `list-project-endpoints.ts`,
  `list-project-ui-components.ts`, `list-project-graphs.ts`,
  `list-org-projects.ts`, `publish-project-bundle.ts`.
- `apps/platform/blueprint/services/projects/bindings/bindings.json` — GET
  `/{projectId}/services|artifact-summary|artifacts|endpoints|ui-components|graphs`.
- `apps/platform/blueprint/services/deployments/` — `listDeployments`,
  `getDeployment`, `readDeploymentLogs`, deploy-stage graphs,
  `run-deployment.bpmn`, `DeploymentView`/`LogLineView`/`ProjectOperationView` QSM.

### PDM/QSM

- `apps/platform/blueprint/pdm/entities/` — `Project`, `ProjectVersion`,
  `Deployment`, `DeployStageState`, `DeploymentLogLine`, etc.
- `apps/platform/blueprint/services/projects/qsm/projections/` — `ProjectView`,
  `ProjectVersionView`. Artifact counts derived live by parsing the stored
  canonical bundle blob (`project_version_bundles`), not a projection.

## Gaps for a real end-to-end dashboard

1. **Deployment status timeline** — mock's central panel (D-02). `PlatformTimeline`
   component exists but unused; `project.spec.json` only has a flat
   `PlatformDataTable` of deployments. `DeployStageState` PDM entity exists; no
   projection/handler surfaces per-stage progress to the dashboard.
2. **Alerts panel is static** — `alertsPanel` hardcodes "No active warnings". Mock
   drives it from real binding/validation warnings + errors (`code`, `jsonPath`,
   `artifact`, `suggestedAction`, "copy details"). No handler emits dashboard
   alerts from published-bundle validation.
3. **Service rows lack per-service detail** — `list-project-services.ts` returns
   only `{name, status:"Ready"}` (docstring: per-service counts/descriptions
   "belong to a later slice"). Mock wants per-service entities/schemas/graphs/
   endpoints/uiComponents counts + description + lastDeployedAt + real status.
4. **No real-time updates (CC-02)** — mock notes state is "driven by deployment
   events from the runtime"; current dashboard is mount/params refetch only.
   (Mock calls the state-switcher prototype-only — may be deferrable.)
5. **Worktree slice incomplete** — `hrefTemplate` link work mid-flight, not
   committed/verified.

## Recovered release verification method (`platform-full-ux-scenarios`)

From `state.yaml` T023 and `.rntme-platform-redeploy-2026-05-14-platform-ux-v2.jsonl`:

- **Redeploy:** `set -a; source .env; set +a` (plus `PLATFORM_SECRET_ENCRYPTION_KEY`),
  then `bun apps/cli/dist/bin/cli.js platform up --target platform.target.json
  --log-file .rntme-platform-redeploy-<date>-<tag>.jsonl`. Always `bun run build`
  first (stale CLI dist ships incomplete bundles).
- **`PLATFORM_SECRET_ENCRYPTION_KEY`** not in `.env`; retrieved from running
  Dokploy compose env, used, never persisted. → credential blocker for redeploy.
- **Verify stages:** redeploy log `terminal:ok` + `verify-result` smoke checks
  (`/health`, `/`, `/config.json` all 200). Then live probe
  `https://platform.rntme.com/service.json` must say `{"name":"app"}` (nginx not
  stale); new routes/handlers respond 401 not 404.
- **Final acceptance** is operator-driven: authenticated Auth0 browser sign-in to
  `platform.rntme.com`, view org→projects→artifacts. Not fully automatable.
- Deploy target: Dokploy, composeId `2mG1RpL80Q7MTmYf67Ky4`, env `Ac5KIPWva9jzm7t-h4Af7`.

## Verification commands / prerequisites

- Local: `bun run build`, `bun run -F @rntme/blueprint test -- ../../../apps/platform/blueprint/test`,
  `bun test --cwd apps/platform/ui-module`, `bun run --cwd apps/platform/ui-module build`,
  `bun run typecheck`, `bun run lint`, `bun run depcruise`.
- Known pre-existing typecheck failure: `platform-deployments-handler.test.ts:1206`
  — verify it's still the only one.
- Release: redeploy command above; requires `PLATFORM_SECRET_ENCRYPTION_KEY`
  (operator/Dokploy-sourced) — credential blocker for the redeploy task.

## Docs-touch candidates

- `docs/current/owners/apps/platform.md` (already MODIFIED) — further updates for
  any new deployment-timeline/alerts handler, projection, or component.
- `apps/platform/README.md` / `apps/platform/ui-module/README.md` — only if local
  commands change.
- `docs/decision-system.md` §3.6 (no graph-canvas dependency) — touch only if that
  bet changes.

## Candidate Worker slices (by leverage)

1. **Finish + verify the in-flight navigation slice** (small, unblocks): the
   worktree `hrefTemplate` changes across `project.spec.json`, `org.spec.json`,
   `components.tsx`, both test files, owner doc — run blueprint+ui tests,
   typecheck, lint, commit. Lowest risk, mostly done.
2. **Deployment status timeline panel (largest, P0/D-02)**: add a handler/QSM read
   surfacing `DeployStageState` per-stage progress for the latest deployment; wire
   `PlatformTimeline` into `project.spec.json` + a `/data/deploy-status` binding;
   tests.
3. **Real alerts + per-service detail (D-01/monitoring)**: extend
   `list-project-services.ts` to return per-service counts/description/status, and
   add a handler emitting dashboard alerts (warnings/errors with `code`/`jsonPath`/
   `artifact`) from the published bundle; wire `PlatformAlertList` and services
   panel to live data.

Then PM/T006: `bun run build` + Dokploy redeploy + live probe + operator browser check.

## Ambiguity requiring Judge

- Whether the in-flight `hrefTemplate` slice should be finished/committed first or
  folded into a larger slice.
- Scope of "deployment status timeline" — whether `DeployStageState` already
  carries per-stage data or a new projection/handler is required.
- Whether real-time updates (CC-02) are in scope or deferred (mock calls the
  state-switcher prototype-only).
