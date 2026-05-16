# T002 — Judge Decision: Slice A + B (Route-Aware Nav Shell + Cross-Link Fill-Ins)

## Decision

**Approved.** Slice A + Slice B as one Worker package (T003). Slice C (`ui-runtime` SPA click delegation) deferred to a separate gated task. Slice D (per-row dispatch, polish) queued as followup.

## Rationale

Scout's Slice A+B is the largest safe useful local slice and directly addresses the charter's likely misfire (UX flow model, not just broken hrefs).

- `PlatformSidebar` component reads only literal `item.href` with no template/active resolution — spec rewrite alone is insufficient; component must change too.
- `PlatformTopbar` accepts only literal crumbs — same constraint.
- Both `/route/path` and `/route/params` are already in the state store (`packages/runtime/ui-runtime/src/client/entry.tsx:240-248`), so no runtime change is needed for active-state.
- Catalog prop schemas (`apps/platform/ui-module/module.json`) declare `items`/`crumbs`/`actions` as loose arrays — no schema change.
- Slice C requires its own Judge gate (shared runtime; touches notes/cv-extract/order-fulfillment).

## Worker T003 Specification

### Objective

Make the platform nav shell route-aware and fill the dead cross-links: rewrite the sidebar with templated hrefs and active-by-route, derive topbar breadcrumbs from `/route/path`, add back-to-project header actions on `data-model`/`api`/`ui`/`graph`, add row `hrefTemplate` links on `deployments`/`audit`/`deploy-targets` and the `no-org` docs link, and assert all of it in tests.

### Per-File Change Spec

#### `apps/platform/blueprint/services/app/ui/layouts/main.spec.json`

- Rewrite `sidebar.items`:
  - Dashboard `hrefTemplate: "/{orgId}"`
  - Projects `hrefTemplate: "/{orgId}"` (org screen lists projects)
  - Deployments `hrefTemplate: "/{orgId}/projects/{projectId}/deployments"` with sensible fallback to `/{orgId}` when no `projectId`. Implementation note: the resolver may emit a deactivated link if `projectId` is unavailable; or simpler — show the item but resolve to `/{orgId}` when `projectId` is missing.
  - Deploy targets `hrefTemplate: "/{orgId}/deploy-targets"`
  - API tokens `hrefTemplate: "/{orgId}/tokens"`
  - Audit log `hrefTemplate: "/{orgId}/audit"`
- Remove hard-coded `active: true` on Dashboard. Component computes active by matching `/route/path` against an optional `item.matchPattern` (else fall back to `startsWith(item.resolvedHref)`).
- Add optional `matchPattern` per item for correct active-state under nested paths.
- Replace static `topbar.crumbs` with `crumbsFromRoute: true` (component derives crumbs from `/route/path` + manifest mapping).
- Topbar Docs action `href: "#"` — leave as `"#"` with a TODO marker; do NOT invent a URL. Record the gap in the receipt for follow-up with the operator.

#### `apps/platform/ui-module/src/components.tsx` — `PlatformSidebar`

- Extend `NavItem` to accept `hrefTemplate?: string` and `matchPattern?: string`.
- Resolve `item.href` via `resolveTemplate(hrefTemplate, { routeParams })` when present; fall back to literal `item.href`.
- Read `/route/path` from store; compute `item.active` by:
  1. `matchPattern` startsWith match if provided
  2. else resolved href === current path
  3. else explicit `item.active`
- Must not regress existing tests that pass literal `items[]`.

#### `apps/platform/ui-module/src/components.tsx` — `PlatformTopbar`

- Add `crumbsFromRoute?: boolean` prop.
- When `true`: read `/route/path` from the store and derive crumbs from path segments using an in-file label mapping table:
  - `data-model` → "Data model", `api` → "API", `ui` → "UI", `graph` → "Graph", `deployments` → "Deployments", `deploy-targets` → "Deploy targets", `tokens` → "API tokens", `audit` → "Audit log", `projects` → "Projects", `versions` → "Version", `no-org` → "No organization", `auth` → skip, `callback` → skip.
  - Lead with literal "platform".
  - Last segment crumb gets `current: true`.
- When `false`/absent: keep current literal crumbs behavior.
- Replace static `actions` `href: "#"` resolution with the `PlatformPageHeader` pattern (`actionHref` + `/route/params`) so future templated actions resolve.

#### `apps/platform/blueprint/services/app/ui/screens/{data-model,api,ui,graph}.spec.json`

- Add to each `header.props.actions` a back-to-project action: `{ label: "Back to project", variant: "ghost", hrefTemplate: "/{orgId}/projects/{projectId}" }`.
- Plus lateral siblings (Data model / API / UI / Graph, **excluding self**), mirroring `project.spec.json:19-40`.
- Keep eyebrow/title/meta untouched.

#### `apps/platform/blueprint/services/app/ui/screens/deployments.spec.json`

- Add `hrefTemplate: "/{orgId}/deployments/{id}"` to the row id column. Rename column key/label as needed so the rendered cell becomes a link.

#### `apps/platform/blueprint/services/app/ui/screens/deployment.spec.json`

- Add a Back action on the header: `hrefTemplate: "/{orgId}/projects/{projectId}/deployments"` when `projectId` available, else `/{orgId}`.
- Remove the duplicate Refresh button only if it is clearly duplicated; otherwise leave (lower risk).

#### `apps/platform/blueprint/services/app/ui/screens/audit.spec.json`

- Add a single `targetId` column with `hrefTemplate: "/{orgId}/deployments/{targetId}"` — accept that non-deployment rows produce a non-resolving link. Document per-row dispatch as Slice D follow-up.

#### `apps/platform/blueprint/services/app/ui/screens/deploy-targets.spec.json`

- **First check `manifest.json` for `/:orgId/deploy-targets/:slug` route.**
- If present: add Open column with `hrefTemplate: "/{orgId}/deploy-targets/{slug}"`.
- If absent: skip the link column and document as Slice D follow-up. Do not add a link to a non-existent route.

#### `apps/platform/blueprint/services/app/ui/screens/no-org.spec.json`

- Replace `docsHref: "#"` with the same placeholder convention as the topbar Docs action. Leave as `"#"` with a TODO if no real URL is available.

#### Out of scope (Slice D)

- `screens/project.spec.json` (already works).
- `screens/version.spec.json` (project version back-link).
- `PlatformAPIExplorer` endpoint→graph→PDM cross-links.
- Per-row dispatch in audit.
- Document URL substitution.

### `allowed_files` (14)

- `apps/platform/blueprint/services/app/ui/layouts/main.spec.json`
- `apps/platform/blueprint/services/app/ui/screens/data-model.spec.json`
- `apps/platform/blueprint/services/app/ui/screens/api.spec.json`
- `apps/platform/blueprint/services/app/ui/screens/ui.spec.json`
- `apps/platform/blueprint/services/app/ui/screens/graph.spec.json`
- `apps/platform/blueprint/services/app/ui/screens/deployments.spec.json`
- `apps/platform/blueprint/services/app/ui/screens/deployment.spec.json`
- `apps/platform/blueprint/services/app/ui/screens/audit.spec.json`
- `apps/platform/blueprint/services/app/ui/screens/deploy-targets.spec.json`
- `apps/platform/blueprint/services/app/ui/screens/no-org.spec.json`
- `apps/platform/ui-module/src/components.tsx`
- `apps/platform/ui-module/test/components.test.tsx`
- `apps/platform/blueprint/test/platform-ui.test.ts`
- `docs/current/owners/apps/platform.md`

### `verify` (6)

```bash
bun run -F @rntme/blueprint test -- /home/coder/project/apps/platform/blueprint/test
bun test --cwd /home/coder/project/apps/platform/ui-module
bun run --cwd /home/coder/project/apps/platform/ui-module build
bun run typecheck
bun run lint
bun run depcruise
```

### `stop_if` (7)

- Need to edit files outside `allowed_files` (escalate to Judge).
- `PlatformSidebar`/`Topbar` change requires a catalog prop schema change in `apps/platform/ui-module/module.json` beyond array/string permissive types — stop and escalate.
- Any change requires editing `packages/runtime/ui-runtime/**` — Slice C is gated; stop and escalate.
- Adding a deploy-targets row link requires a route absent from `manifest.json` — drop that single sub-change and leave a Slice D note, continue with the rest.
- Audit row `hrefTemplate` cannot be made meaningful for non-deployment rows without per-row dispatch — ship the single dispatched column as documented and queue per-row dispatch as Slice D.
- A real docs URL is unknown — leave `href: "#"` with `/* TODO Slice D */` and document the gap; do not invent a URL.
- Verification fails twice for the same cause.

### Docs Touch

- **Update** `docs/current/owners/apps/platform.md`: add section documenting route-aware sidebar/topbar invariants (items support `hrefTemplate` + `matchPattern`; topbar `crumbsFromRoute` derives crumbs from `/route/path` + manifest mapping; cross-link templates live in screen specs, not in components).
- Rationale: charter requires docs-touch evaluation; recording these as platform UI conventions prevents re-introducing the literal-href regression.

## Followups to Queue After T003 Verifies

- **T006 (Judge+Worker)**: Slice C — ui-runtime SPA link click delegation. Separate gated decision because it touches all rntme UIs.
- **T007 (Worker)**: Slice D polish — per-row dispatch for audit, deploy-target detail link if a route is added, project-version back-link, `PlatformAPIExplorer` endpoint→graph→PDM cross-links.
- **T008 (Worker, optional)**: Playwright/Puppeteer browser smoke harness for `/login → /:orgId → /:orgId/projects/:projectId → data-model/api/ui/graph` navigation (Scout flagged no such harness exists).
- **T009 (PM)**: confirm real docs URL with operator and replace topbar/no-org placeholder `href`.

## SPA Link Interception Decision

Defer to a separate gated task (Slice C). After Slice A+B, links still trigger full-page reloads but every page renders correctly under the right route — UX is functional. SPA polish touches `packages/runtime/ui-runtime` which is shared with notes/cv-extract/order-fulfillment; it requires its own Judge gate, dedicated tests, and depcruise sign-off.

## Parallel Safety

Not applicable — single Worker package; `allowed_files` includes shared `apps/platform/ui-module/src/components.tsx` so this slice must run as one Worker.
