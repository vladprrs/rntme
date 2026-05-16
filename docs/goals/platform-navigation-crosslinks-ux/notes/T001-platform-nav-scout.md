# T001 — Platform Navigation Scout Receipt

## Headline

UX manifest/screens are wired, but the global `PlatformSidebar` in `apps/platform/blueprint/services/app/ui/layouts/main.spec.json` hard-codes every item to `href: "/"` (login). Breadcrumbs are static. From any authenticated screen the primary nav is dead. Project → data-model/api/ui/graph header actions are the only fully working cross-link set. Deploy path: `rntme platform up --target platform.target.json` (needs `PLATFORM_SECRET_ENCRYPTION_KEY` from running Dokploy compose env). Production URL: `https://platform.rntme.com`.

## UX Model (from `.tmp/rntme-ux-design.agent.final.md`)

- Stages: Upload (CLI) → Discover (dashboard/topology) → Monitor (deploy timeline) → Explore (UI / API / Graph / PDM) → Iterate (diff + revise).
- Nav shell:
  - Sidebar: persistent left rail with **Project** section (Dashboard, Projects, Deployments, Deploy targets) and **Account** section (API tokens, Audit log). Active item reflects current route. Hrefs are org-scoped.
  - Topbar: breadcrumbs reflect current route (`platform / <org> / <project> / <view>`). Docs link real. User/org switcher implied.
- Cross-links (UX §3.5): bidirectional — project dashboard ↔ data-model/api/ui/graph; binding row → graph node → PDM entity; audit row → target object; deployment row → deployment detail; tokens & audit scoped to org; back-to-project from every artifact explorer.

## Current Route Inventory (`apps/platform/blueprint/services/app/ui/manifest.json`)

15 routes: `/`, `/login`, `/auth/callback`, `/no-org`, `/:orgId`, `/:orgId/projects/:projectId`, `/:orgId/projects/:projectId/data-model`, `/api`, `/ui`, `/graph`, `/:orgId/deploy-targets`, `/:orgId/projects/:projectId/deployments`, `/:orgId/deployments/:deploymentId`, `/:orgId/tokens`, `/:orgId/audit`, `/:orgId/projects/:projectId/versions/:versionId`.

### Working

- Login → `/:orgId` via auth0 `orgRedirectPath` (`modules/identity/auth0/client/index.ts`).
- `/:orgId` org screen → `/:orgId/projects/:projectId` via projects table hrefTemplate (`screens/org.spec.json:32`).
- `/:orgId/projects/:projectId` → `/data-model | /api | /ui | /graph` via `PlatformPageHeader` actions (`screens/project.spec.json:19-40`) — the only fully working cross-link set.

### Broken or Missing

- **Global sidebar** (`layouts/main.spec.json:18-26`): every item has `href: "/"` (resolves to login). No `hrefTemplate`, no `active` per current route, no `orgId` injection. Only "Dashboard" is hard-coded `active: true`.
- **Topbar breadcrumbs** (`layouts/main.spec.json:36-43`): static `["platform","dashboard"]` for every screen. Docs action `href: "#"`.
- `/data-model`, `/api`, `/ui`, `/graph` screens have **no back-to-project link or in-page sidebar** — user is stuck without editing the URL.
- `/no-org` (`screens/no-org.spec.json:11-17`): `docsHref="#"` dead; no path to retry or switch org.
- `/:orgId/deployments/:deploymentId`: header "Refresh" action `variant=secondary` lacks click action; Refresh Button duplicated.
- `/:orgId/projects/:projectId/deployments` and `/:orgId/deployments/:deploymentId` rows: no `hrefTemplate` to drill into deployment detail.
- `/:orgId/audit` rows: no `hrefTemplate` to target object (deployment id, target id, etc.); ID columns are raw FK strings.
- `/:orgId/deploy-targets`: no edit/delete/view detail link; columns are slug/provider/environment only.
- `/:orgId/projects/:projectId/versions/:versionId`: Queue-deployment form has no back-link; submission redirect not wired.
- Cross-explorer links (UX §3.5): binding→graph, binding→PDM entity NOT implemented in any screen or `PlatformAPIExplorer`.

## Shared UI/Runtime Scope Evidence

### Required

- `apps/platform/ui-module/src/components.tsx`
  - `PlatformSidebar` (lines 1986-2074) accepts only literal `href`; no template/active resolution → **root cause** of dead sidebar.
  - `PlatformPageHeader` (lines 424-490) already resolves `hrefTemplate` against `/route/params` store (route-aware) — pattern to mirror.

### Optional (gated decision, NOT first slice)

- `packages/runtime/ui-runtime/src/client/entry.tsx` (lines 209-321): `<a href>` is NOT intercepted; SPA navigation requires the `navigate` action through registry. Every nav click triggers a full page reload. Adding click delegation would improve UX but touches all rntme UIs (platform, notes, cv-extract, order-fulfillment).
- `packages/runtime/ui-runtime/src/client/registry.ts` (lines 178-264): `navigate` action is the only SPA mover; no link-click delegation.

### Not required

- `@rntme/ui` artifact compiler — current `hrefTemplate` flow already resolves against `/route/params`; no compiler change needed.

## Test Coverage Gaps

- `apps/platform/blueprint/test/platform-ui.test.ts:17-146` asserts the route table + project-header hrefTemplate links; nothing asserts sidebar items or topbar crumbs are route-aware.
- `apps/platform/ui-module/test/components.test.tsx:243-283` covers header-action route-aware links (`/org_…/projects/p1/data-model`); `PlatformSidebar` test only checks brand markup.

## Local Verification Commands

```bash
bun run -F @rntme/blueprint test -- ../../../apps/platform/blueprint/test
bun test --cwd apps/platform/ui-module
bun run --cwd apps/platform/ui-module build
bun run typecheck
bun run lint
bun run depcruise
bun run build   # required before `rntme platform up` per memory rntme_cli_dist_silent_stale
```

## Production Deploy / Smoke

- **Redeploy command** (found): `rntme platform up --target /home/coder/project/platform.target.json` (`apps/cli/README.md`). Memory `rntme_platform_redeploy_secret`: export `PLATFORM_SECRET_ENCRYPTION_KEY` from running Dokploy compose env first; run `bun run build` first.
- **Production URL** (found): `https://platform.rntme.com` (`platform.target.json#publicBaseUrl`; verified in `.rntme-platform-redeploy-2026-05-14-T003-bundled-provisioner-assets.jsonl#urls`).
- **Smoke targets**:
  - `GET https://platform.rntme.com/health` → 200 (edge-health)
  - `GET https://platform.rntme.com/` → 200, sidebar HTML present
  - `GET https://platform.rntme.com/config.json` → JSON with `identity-auth0`
  - `GET https://platform.rntme.com/login` → 200
  - Browser smoke (manual, requires Auth0 session): login → land on `/:orgId` → click "Projects" sidebar (should navigate to `/:orgId`, not `/`) → open a project → click each header action → confirm `/data-model`, `/api`, `/ui`, `/graph` render → confirm a back/up path → sidebar item highlights current route.
- **Missing**:
  - No Playwright/Puppeteer harness in repo for platform browser smoke (manual only).
  - `PLATFORM_SECRET_ENCRYPTION_KEY` value (sourced from Dokploy compose at deploy time, not committed).
  - `DOKPLOY_API_KEY`, `AUTH0_MANAGEMENT_CLIENT_ID/SECRET` in current shell (per `platform.target.json#secrets` refs).

## Ranked Repair Candidates

### Slice A — Route-aware sidebar + topbar (largest safe useful)

- Scope:
  - `apps/platform/blueprint/services/app/ui/layouts/main.spec.json` — rewrite sidebar items to `hrefTemplate`, add Projects/Deployments/Deploy targets/Tokens/Audit/no-org entries under `/:orgId`; mark `active` via routePattern (new schema if needed) or leave to component.
  - `apps/platform/ui-module/src/components.tsx` (`PlatformSidebar`) — accept `items[].hrefTemplate`, resolve against `/route/params`, compute `active` by matching current `location.pathname` prefix.
  - `apps/platform/ui-module/src/components.tsx` (`PlatformTopbar`) — accept `crumbsTemplate` or derive crumbs from `/route/path` + manifest mapping.
  - `apps/platform/ui-module/test/components.test.tsx` — add tests asserting templated hrefs and active state.
  - `apps/platform/blueprint/test/platform-ui.test.ts` — assert sidebar items render with orgId-scoped hrefs from compiled UI.
- Risk: medium · Reversibility: high (spec-driven; revert is a JSON edit).
- Suggested `allowed_files`:
  - `apps/platform/blueprint/services/app/ui/layouts/main.spec.json`
  - `apps/platform/ui-module/src/components.tsx`
  - `apps/platform/ui-module/test/components.test.tsx`
  - `apps/platform/blueprint/test/platform-ui.test.ts`
  - `docs/current/owners/apps/platform.md` (doc-touch: nav/sidebar invariants)
- Suggested `verify`:
  - `bun test --cwd apps/platform/ui-module`
  - `bun run -F @rntme/blueprint test -- ../../../apps/platform/blueprint/test`
  - `bun run --cwd apps/platform/ui-module build`
  - `bun run typecheck`
- Blast radius: apps/platform UI only; no runtime/contract change.

### Slice B — Cross-link fill-ins on artifact explorers + deployments/audit

- Scope:
  - `apps/platform/blueprint/services/app/ui/screens/{data-model,api,ui,graph}.spec.json` — add header `actions` row with back-to-project `hrefTemplate /{orgId}/projects/{projectId}` and lateral links between explorers.
  - `apps/platform/blueprint/services/app/ui/screens/deployments.spec.json` — add row `hrefTemplate /{orgId}/deployments/{id}`.
  - `apps/platform/blueprint/services/app/ui/screens/audit.spec.json` — add target row link.
  - `apps/platform/blueprint/services/app/ui/screens/deploy-targets.spec.json` — add detail/edit link column.
  - `apps/platform/blueprint/test/platform-ui.test.ts` — assertions.
- Risk: low · Reversibility: high.
- Suggested `allowed_files`:
  - `apps/platform/blueprint/services/app/ui/screens/*.spec.json`
  - `apps/platform/blueprint/test/platform-ui.test.ts`
- Suggested `verify`:
  - `bun run -F @rntme/blueprint test -- ../../../apps/platform/blueprint/test`
  - `bun run typecheck`
- Blast radius: blueprint JSON only.

### Slice C — SPA link interception (optional UX polish)

- Scope:
  - `packages/runtime/ui-runtime/src/client/entry.tsx` — add document-level click handler that calls `onNavigate` for same-origin `<a href>`; cancel default; skip on modifier keys / `target=_blank` / `data-no-spa`.
  - `packages/runtime/ui-runtime/src/client/registry.ts` — surface API (no change likely).
  - `packages/runtime/ui-runtime/test` — new test for click delegation.
- Risk: medium-high (shared runtime used by all rntme UIs) · Reversibility: medium.
- Suggested `allowed_files`:
  - `packages/runtime/ui-runtime/src/client/entry.tsx`
  - `packages/runtime/ui-runtime/test/**`
- Suggested `verify`:
  - `bun run -F @rntme/ui-runtime test`
  - `bun run typecheck`
  - `bun run depcruise`
- Blast radius: all rntme UIs (platform, notes, cv-extract, order-fulfillment).

### Slice D — PlatformAPIExplorer endpoint→graph→PDM links (UX §3.5)

- Scope:
  - `apps/platform/ui-module/src/components.tsx` (`PlatformAPIExplorer` overview pane) — render Source artifact/Handler/Schema names as links to graph/data-model screens.
  - `apps/platform/blueprint/services/app/ui/screens/api.spec.json` — pass route templates as props.
  - `apps/platform/ui-module/test/components.test.tsx`.
- Risk: low · Reversibility: high.
- Suggested `allowed_files`:
  - `apps/platform/ui-module/src/components.tsx`
  - `apps/platform/blueprint/services/app/ui/screens/api.spec.json`
  - `apps/platform/ui-module/test/components.test.tsx`
- Suggested `verify`:
  - `bun test --cwd apps/platform/ui-module`
- Blast radius: platform UI module only.

### Recommended Largest Safe Slice for Judge

**Slice A + Slice B as a single Worker package** — both are JSON + platform-ui-module-scoped, share the same verify set, and together they restore the global nav model AND fix every dead cross-link the UX doc requires. Slice C is shared-runtime and should be a separate, gated decision. Slice D is a polish add-on after A+B verify.

## Docs-Touch Surface

- `docs/current/owners/apps/platform.md` — update UI section to document sidebar/topbar route-awareness invariants and the new cross-link templates.
- `apps/platform/README.md` and `apps/platform/ui-module/README.md` — no change unless new local commands appear.
- `docs/decision-system.md` — likely no touch; this is convention-tightening within an existing locked-pending bet (Platform as blueprint, F4 inspectability).
- `AGENTS.md` — no touch (no new repo navigation or command).

## Evidence Index

- `/home/coder/project/.tmp/rntme-ux-design.agent.final.md` — UX authority.
- `apps/platform/blueprint/services/app/ui/manifest.json` — route list.
- `apps/platform/blueprint/services/app/ui/layouts/main.spec.json:18-26,36-43` — dead sidebar & static topbar.
- `apps/platform/blueprint/services/app/ui/screens/project.spec.json:19-40` — working cross-link set.
- `apps/platform/blueprint/services/app/ui/screens/org.spec.json:32` — working projects table link.
- `apps/platform/blueprint/services/app/ui/screens/no-org.spec.json:11-17` — dead docsHref.
- `apps/platform/blueprint/services/app/ui/screens/{data-model,api,ui,graph}.spec.json` — missing back-links/cross-links.
- `apps/platform/blueprint/services/app/ui/screens/{deployment,deployments,tokens,audit,deploy-targets}.spec.json` — missing row links / scoped context.
- `apps/platform/ui-module/src/components.tsx:1986-2074` (`PlatformSidebar`), `:424-490` (`PlatformPageHeader`) — root cause and pattern to mirror.
- `packages/runtime/ui-runtime/src/client/entry.tsx:209-321`, `registry.ts:178-264` — no link click delegation.
- `apps/platform/blueprint/test/platform-ui.test.ts:17-146` — coverage gap.
- `apps/platform/ui-module/test/components.test.tsx:243-283` — coverage gap for sidebar.
- `platform.target.json:1-64` — deploy target.
- `.rntme-platform-redeploy-2026-05-14-T003-bundled-provisioner-assets.jsonl` — prior verified smoke baseline.
- `apps/cli/README.md` — redeploy entry.
- `modules/identity/auth0/client/index.ts` — post-login redirect to `/:orgId`.
