# T015 Scout — why `/org_uZUWhpWgK54VWC2X` renders no cv-extract project

Read-only evidence map. No repo edits, no redeploys. Two platform PATs were
minted via the approved persistent Auth0 grant `cgr_uuhxW4oqkGToedGH` for live
read probes (kept in process memory only, never written to disk; token ids
`a8390590-5ae1-4df8-a571-348c34813cb6` and one earlier rejected attempt — both
are test-tenant PAT rows, safe to revoke at goal cleanup).

## Verdict

The org→project data path is **intact at every server layer**. The broken link
is a **single client-side rendering stub**: `PlatformDataTable` (and
`PlatformServicesPanel`) in `apps/platform/ui-module/src/components.tsx` accept a
`statePath` prop but never read the runtime store — they render an empty `<div>`
/ an empty card list. Every screen whose content is a `statePath`-driven table
or services panel shows nothing, regardless of the API returning correct data.

## Evidence

### (a)+(b) Live API lists cv-extract for `org_uZUWhpWgK54VWC2X` — both edge auth paths

Probed `https://platform.rntme.com` live:

- **PAT path (`platform-tokens` edge provider):** `GET /api/projects?organizationId=org_uZUWhpWgK54VWC2X&limit=100` → **200**, returns
  project `cv-extract` (`id d5f9a57d-2acd-40a9-adc5-af899141638d`, `orgId
  org_uZUWhpWgK54VWC2X`, `status active`, created 2026-05-14T07:05:26Z).
- **Auth0 JWT path (`auth0` edge provider):** sent a real Auth0-issued JWT
  (M2M client-credentials token, `aud https://platform.rntme.com/api`, `iss
  https://demo-rntme.us.auth0.com/`, **no `org_id` claim**) straight to the
  edge → `platform-tokens` 401 → `auth0` introspect 200 → `GET /api/projects` →
  **200, cv-extract present**. `GET /api/deployments` → **200, 4 rows**.
- Baseline: no Authorization → 401 `RUNTIME_AUTH_TOKEN_INVALID`; bogus bearer →
  401. Canonical edge behaviour is correct.

So: the project row **is** keyed to the Auth0 org id `org_uZUWhpWgK54VWC2X` in
the live QSM (not a decoupled UUID), and the `auth0` edge introspection sidecar
+ `listOrgProjectsRuntimeNative` handler **work** even for a token with no
`org_id` claim — the handler only needs `X-Rntme-Session-Status: ACTIVE` +
`X-Rntme-User-Sub` (both edge providers set them) and uses the **query-param**
`organizationId`, not a session org. The browser session path is functionally
equivalent to the M2M-JWT path that was just proven green.

### (c) cv-extract WAS actually deployed — `last_verification` is stale, not the receipts

`GET /api/deployments?organizationId=org_uZUWhpWgK54VWC2X&projectId=d5f9a57d…`
returns **4 deployment rows**:

| id | status | finished | note |
|---|---|---|---|
| `1519f885-9513-4424-9436-7ace2826fb24` | failed | 07:09:49Z | `DEPLOY_PROVISION_ENTRY_LOAD_FAILED` |
| `8f469949-2660-44be-a9d2-e7baa0b40f0d` | failed | 07:18:03Z | `DEPLOY_EXECUTOR_UNCAUGHT` |
| `534e5a3f-9b43-421a-bfdb-00fae7e784a1` | **succeeded** | 07:20:58Z | action `created` |
| `5a70c306-30e5-4eb4-948a-a3615dbdf960` | **succeeded** | 07:39:25Z | action `updated` |

`GET /api/deployments/5a70c306-…` → 200, `status succeeded`, `projectVersionSeq
1`, `targetSlug prod`, `verificationReport.ok true` (edge-health / ui /
config-json / public-route all 200). `GET /api/deployments/targets` → 200,
target `prod` (`b5381896-1e32-4565-ab4e-4155fc777c89`, publicBaseUrl
`https://cv-extract.rntme.com`). `GET /api/projects/d5f9a57d…/versions` → 200,
seq 1 `published`.

**Resolution:** The T003 receipt and T004/T005 `done` are **correct** — cv-extract
reached a real terminal-succeeded platform-client deployment with a recorded id.
`checks.last_verification` (`result: t003_publish_fixed_deploy_blocked`, listing
`PLATFORM_DEPLOY_RUNNER_UNAVAILABLE` / `PLATFORM_TARGET_SECRET_STORAGE_UNAVAILABLE`)
is a **stale interim snapshot** captured mid-T003 before the deploy-runner fixes
landed; it was never overwritten. The board inconsistency is a stale
`last_verification`, not a false `done`. (Also: T005's residual risk that the
versions-list endpoint returned empty is no longer reproducible — it now returns
seq 1.)

### (d) The break: `PlatformDataTable` / `PlatformServicesPanel` are render stubs

Traced the SPA org-page data path end to end:

1. Route `/:orgId` → `screens/org` is registered in the live `/_manifest.json`. ✔
2. Live `/_screens/org.json` data block is correct: `/data/projects` →
   `GET /api/projects`, params `{organizationId: {$state:/route/params/orgId}, limit:100}`,
   `refetchOn:[mount,params]`. ✔
3. `enterRoute` sets `/route/params = {orgId:"org_uZUWhpWgK54VWC2X"}`;
   `@json-render/core` `getByPath` resolves nested `/route/params/orgId`
   correctly; `buildUrl` → `/api/projects?organizationId=org_uZUWhpWgK54VWC2X&limit=100`. ✔
4. identity-auth0 client `boot()` registers a transport interceptor that adds
   `Authorization: Bearer <getTokenSilently()>`. ✔
5. `fetchEndpoint` stores the whole response body at `/data/projects`. ✔
6. **The `org` screen renders `PlatformDataTable` with `statePath:"/data/projects"`.**
   Live bundle `client-2m2znx6q.js`:
   `function x(P){return f.createElement("div",{"data-rntme-component":"DataTable","data-state-path":P.statePath??""})}`
   — i.e. `apps/platform/ui-module/src/components.tsx:115-117`. It renders an
   **empty div**. It never calls `useStateStore()`, never reads `statePath`,
   never renders `columns` or rows. ✘

`PlatformServicesPanel` (`components.tsx:356-380`) has the same defect: it takes
a `statePath` prop but only ever renders `props.services ?? []` (a literal prop
that is never populated from state) → empty card list.

In the same file, `PlatformTokenIssuer` *does* correctly use `useStateStore()` /
`useTransport()`, so the runtime hooks are available — `PlatformDataTable` /
`PlatformServicesPanel` were simply left as unimplemented placeholders.

## Blast radius

Screens whose primary content is a `statePath`-bound `PlatformDataTable` /
`PlatformServicesPanel` and therefore render empty against live data:
`org`, `project`, `deployments`, `deploy-targets`, `tokens`, `audit`,
`deployment` (`*.spec.json` all reference one of the two stubs).

## Response-envelope inconsistency the fix must handle

`fetchEndpoint` stores the **raw response body** at `statePath`. Live shapes are
inconsistent:

- `GET /api/projects` → `{ "status": "ok", "projects": [...] }`
- `GET /api/deployments` → `{ "status": "ok", "deployments": [...] }`
- `GET /api/deployments/targets` → `{ "status": "ok", "targets"/"deployTargets": [...] }`
- `GET /api/projects/{id}/versions` → **bare array** `[...]`
- `GET /api/tokens` → object with a tokens array

So a fixed `PlatformDataTable` must either normalise common envelopes
(`Array.isArray(v) ? v : v.projects ?? v.deployments ?? v.items ?? v.tokens ?? []`)
or the API responses must be standardised. That tradeoff is a Judge call (T016).

## Candidate fix surfaces (for T016 Judge)

- **Primary:** `apps/platform/ui-module/src/components.tsx` — implement
  `PlatformDataTable` and `PlatformServicesPanel` to read `statePath` from the
  runtime store (`useStateStore()`), normalise the envelope, and render
  rows/cards. Mirrors the existing `PlatformTokenIssuer` pattern. TDD-able via
  `apps/platform/ui-module/test/components.test.tsx`.
- **Optional/adjacent:** standardise list-endpoint response envelopes
  (`apps/platform/blueprint/services/*/handlers/*.ts`) so the client unwrap is
  trivial — but that is a larger, riskier change than the component fix.
- **Redeploy:** the fix is in the identity/ui module dist bundled by
  `platform up` (T013 proved the no-image-rebuild path re-bundles platform UI
  from local module dist). T018 should try `platform up` first.
- Not on the critical path (recorded, not blocking): the `organizations`
  service `listOrganizations`/`createOrganization` UUID-vs-Auth0-org-id gap
  (T008 residual) — `/api/organizations` is unused by the route-driven UI.

## Recommended next tasks

- **T016 Judge:** choose component-only fix vs component + envelope
  standardisation; sequence T017 (component impl, TDD) and confirm T018
  (`platform up` redeploy) is required and what it must prove (operator loads
  `/org_uZUWhpWgK54VWC2X` and sees cv-extract + its services/deployments).
- PM: overwrite the stale `checks.last_verification` so the board reflects the
  confirmed-deployed truth.
