# T001 — Scout receipt

Author: Scout / pm-loop iteration 1
Date: 2026-05-11
Mode: read-only; no source or env files modified.

## Inputs consulted

- `docs/goals/dokploy-platform-e2e-deploy/{goal.md,state.yaml}`
- `.env` (key names only — values never displayed)
- `AGENTS.md`, `docs/current/owners/apps/platform.md`, `docs/current/owners/apps/cli.md`,
  `apps/platform/README.md`, `apps/cli/README.md`
- `apps/platform/blueprint/project.json`
- `apps/cli/src/deploy-engine/{target-schema.ts,load-target.ts,load-secrets.ts,locate-platform-blueprint.ts}`
- `apps/cli/src/commands/{deploy.ts,platform/up.ts,target/create.ts}`
- `apps/cli/test/fixtures/target-dokploy.json`
- `packages/deploy/deploy-core/src/{vars.ts,workflows.ts}`
- `packages/runtime/runtime/{Dockerfile,Dockerfile.template,src/bin/runtime.ts}`
- `modules/identity/auth0/src/{provisioner.ts,adapter.ts,mgmt-client.ts}`
- E2E directories: `apps/cli/test/e2e`, `modules/identity/auth0/test/e2e`,
  `packages/runtime/runtime/test/e2e`
- Recent git log (PR #200..#205) and Dokploy REST endpoints
  (`/api/settings.health`, `/api/project.all`, `/api/project.one`,
  `/api/environment.one`, `/api/application.one`).

## 1 — Environment variables actually present

`/home/coder/project/.env` declares (values intentionally NOT logged):

- `AUTH0_DOMAIN`
- `AUTH0_MANAGEMENT_AUDIENCE`
- `AUTH0_MANAGEMENT_CLIENT_ID`
- `AUTH0_MANAGEMENT_CLIENT_SECRET`
- `DOKPLOY_URL` (host `dokploy.vladpr.com`, no `/api` suffix — correct
  shape per the known dokploy-mcp gotcha; trailing slash is present and is
  tolerated by the API)
- `DOKPLOY_API_KEY`
- `RNTME_TOKEN`
- `OPENROUTER`

All four Auth0 names match what the modules under
`modules/identity/auth0/src/adapter.ts` and the Auth0 provisioner contract
(`targetSecrets.auth0Mgmt.{tenantDomain, mgmtClientId, mgmtClientSecret}`)
need. The goal charter's existence claim is **confirmed**.

> Prior version of this receipt incorrectly reported the Auth0 keys as
> missing. That was a Scout false negative caused by a too-narrow
> `grep '^[A-Z_]+='` (excludes digits, so `AUTH0_*` names slipped through);
> the corrected check `awk -F= '/^[A-Z_]+=/ {print $1}'` plus a direct
> `Read` of `.env` show all eight keys.

There is no `.env.local`, `.env.production`, or `.env.development.local`.

## 2 — Dokploy API reachability

```
GET https://dokploy.vladpr.com/api/settings.health
  → HTTP 200 {"status":"ok"}
GET https://dokploy.vladpr.com/api/project.all
  → HTTP 200 (5 projects listed)
```

Projects in tenancy (id | name):

- `A_FqV_wcGzoh4K-Nq5xVB | rntme-demos`
- `nmE3DEZtkJrVc1YxTYWpM | multica`
- `wmiyt_0T7SKvS3sr6rzGK | rntme-platform`
- `RK4scgw5bryx2qolyzkSc | runtime`
- `kJtlVIXnFJMCJHBW_N2-D | cv-cms.ru`

## 3 — Current deployment of the platform

The platform is deployed inside project **`runtime`**, environment
`production` (`2HJhor6CZm0SX4vLDLI4q`). Project `rntme-platform` exists but
its `production` env is empty (apps=[], compose=[], postgres=[]).

Apps in `runtime`/`production`:

| applicationId | appName | name | status | dockerfile | branch | domain |
| --- | --- | --- | --- | --- | --- | --- |
| `Z7cvz89fO4ty8tkZYVMXs` | platform-http-wfbviw | platform-http | **error** | `apps/platform-http/Dockerfile` | main | `platform.rntme.com:3000` |
| `SmDbaW5aLXpGComEj-O_j` | rustfs-jyqt9f | rustfs | done | `Dockerfile` | — | — |
| `M5WfXaxcgKVHppiTldEbD` | app-calculate-open-source-monitor-64rl9o | rntme-landing | done | `apps/landing/Dockerfile` | main | `rntme.com:80` |

Postgres: `xK9g1NniBWBjr67ciIDxB` (`platform-pg-gzfrsm`) — done.

No `compose` services. Therefore the runtime/production env has **no
Operaton (BPMN) stack and no Redpanda Kafka stack**.

Configured env-var keys on the broken platform-http app (values redacted):

- `DATABASE_URL`
- `RUSTFS_ENDPOINT`, `RUSTFS_ACCESS_KEY_ID`, `RUSTFS_SECRET_ACCESS_KEY`, `RUSTFS_BUCKET`
- `WORKOS_API_KEY`, `WORKOS_CLIENT_ID`, `WORKOS_WEBHOOK_SECRET`, `WORKOS_REDIRECT_URI`
- `PLATFORM_BASE_URL`, `PLATFORM_SESSION_COOKIE_DOMAIN`, `PLATFORM_CORS_ORIGINS`,
  `PLATFORM_COOKIE_PASSWORD`, `PLATFORM_SECRET_ENCRYPTION_KEY`
- `PORT`, `LOG_LEVEL`

No `AUTH0_*` env vars are set on the deployed app. The configuration still
matches the legacy WorkOS hosted-platform pre-cutover.

Deployment history shows 11 deploys; the latest successful build is PR #204
(2026-05-11T01:47Z). Build column reports "done" but the **applicationStatus
is "error"** — the runtime container is failing post-cutover.

## 4 — Repo vs. Dokploy drift

- Commit `2e001d60` (PR #205, on `main`) **deleted `apps/platform-http/`**.
- The Dokploy app still references `dockerfile: 'apps/platform-http/Dockerfile'`
  with `autoDeploy: true`. The next push to `main` triggers an auto-deploy that
  will fail at `COPY` / `docker build` — the path does not exist.
- Per `docs/current/owners/apps/platform.md`, production deploys are now
  expected to use `packages/runtime/runtime/Dockerfile` (image
  `ghcr.io/vladprrs/rntme-runtime`) with blueprint artifacts copied into
  `/srv/artifacts`. The Dokploy app config has **not** been migrated.

## 5 — CLI direct-mode gaps (`rntme platform up`)

`apps/cli/src/deploy-engine/target-schema.ts` (Zod) only accepts:

```jsonc
{
  "kind": "dokploy",
  "displayName": "...",
  "config": { "dokployUrl", "dokployProjectId?", "dokployProjectName?", "allowCreateProject?" },
  "secrets": { "apiToken": { "source": "env", "name": "..." } },
  "eventBus?": { "kind: 'kafka'", "mode: 'provisioned'|'external'", "provider?", "brokers?" },
  "publicBaseUrl?"
}
```

`apps/cli/src/deploy-engine/load-target.ts` hardcodes:

```ts
workflows: null,
auth: {},
modules: {},
storage: { mode: 'external' },
```

`apps/cli/src/deploy-engine/load-secrets.ts` reads only `apiToken`; the
`extras` map is always `{}`.

The platform blueprint declares:

- `vars.AUTH0_SPA_CLIENT_ID  ← provision.identity.spaClient.id`
- `vars.AUTH0_DOMAIN         ← target.auth.auth0.domain`
- `vars.AUTH0_AUDIENCE       ← target.auth.auth0.audience`
- `vars.AUTH0_REDIRECT_URI   ← target.auth.auth0.redirectUri`
- `workflows.manifest        ← services/deployments/workflows/workflows.json`
- `modules.identity          ← rntme_identity_auth0` (provisioner needs
  `targetSecrets.auth0Mgmt.{tenantDomain, mgmtClientId, mgmtClientSecret}`)

`packages/deploy/deploy-core/src/workflows.ts` raises
`DEPLOY_PLAN_WORKFLOWS_REQUIRE_EVENT_BUS` /
`DEPLOY_PLAN_WORKFLOWS_REQUIRE_OPERATON` unless the target declares
`eventBus.mode = 'provisioned'` and
`workflows.engine.{kind: 'operaton', mode: 'provisioned'}`.

**Conclusion:** `rntme platform up --target <file>` cannot, today, plan a
deploy of the current platform blueprint. The target schema/loader/secrets
layer must first be extended.

## 6 — E2E baseline

| Path | Kind | Notes |
| --- | --- | --- |
| `apps/cli/test/e2e/skills-smoke.test.ts` | local CLI smoke | no network, no platform. |
| `modules/identity/auth0/test/e2e/provisioner.test.ts` | live-Auth0 e2e | gated by `AUTH0_E2E=1` + tenant credentials; covers provisioner only, not platform. |
| `packages/runtime/runtime/test/e2e/{issue-tracker,validate-cli}.test.ts` | local runtime smoke | spins runtime in-process against demo blueprints. |

No test in `main` boots the deployed platform and asserts an Auth0-backed
HTTP flow end to end. The intended BPMN-orchestrated e2e
(`apps/platform-http/test/e2e/bpmn-deploy-flow.test.ts`) was an `it.skip(…)`
placeholder and was deleted along with `apps/platform-http/` in PR #205.

## 7 — Required pre-deploy steps

Auth0 credentials already in `.env` (see §1). Remaining steps:

1. Decide cutover path:
   - **A. Extend CLI direct-mode** (canonical): add `workflows`, `auth`,
     and Auth0 `extras` fields to
     `apps/cli/src/deploy-engine/{target-schema,load-target,load-secrets}.ts`;
     rebuild CLI bundle; author a `platform.target.json`; run
     `rntme platform up --target ...` against the existing Dokploy project.
     The deploy-runner will then provision Operaton + Redpanda compose stacks
     itself (because `eventBus.mode='provisioned'` and `workflows.engine.
     mode='provisioned'` flow through planning).
   - **B. Direct Dokploy API/MCP reconfig**: update the existing
     `platform-http-wfbviw` app to point at
     `packages/runtime/runtime/Dockerfile` + copy `apps/platform/blueprint`
     into `/srv/artifacts`; add Auth0 env vars; provision Operaton + Kafka
     compose stacks manually. Skips CLI work but bypasses the canonical
     deploy flow the goal is meant to certify.
2. Confirm where the platform should land: re-use `runtime/production`
   (current home of `platform-http-wfbviw`, postgres, rustfs and DNS
   `platform.rntme.com`) or move to the empty `rntme-platform/production`.
3. Decide what to do with the broken `platform-http-wfbviw` app — its
   dockerfile path `apps/platform-http/Dockerfile` was deleted by PR #205,
   so the next auto-deploy will fail. Either retire the app or
   reconfigure it (Option B).
4. Author a deploy-time e2e suite (or unskip a removed placeholder
   equivalent) that hits the deployed platform with an Auth0 token.

## 8 — Recommended first Worker slice (for Judge T002)

Two viable Worker shapes; Judge picks one.

### Option A — extend CLI direct-mode target/secret schema (canonical path)

- Objective: make `rntme platform up --target <file>` accept a target that
  declares workflows + Auth0 + Auth0 management secret extras, so the
  blueprint's `vars`/`modules` resolve at plan time.
- `allowed_files`:
  - `apps/cli/src/deploy-engine/target-schema.ts`
  - `apps/cli/src/deploy-engine/load-target.ts`
  - `apps/cli/src/deploy-engine/load-secrets.ts`
  - `apps/cli/test/unit/deploy-engine/**`
  - `apps/cli/test/fixtures/target-dokploy.json`
- `verify`:
  - `bun run --filter @rntme/cli test`
  - `bun run typecheck` (or scoped to `@rntme/cli`)
  - Add a unit test that loads a fixture with `workflows.engine`,
    `auth.auth0.*`, and `auth0Mgmt` secrets and asserts the loader emits a
    NormalizedDeployTarget with those fields populated.
- `stop_if`:
  - Schema invariants in `@rntme/deploy-runner` or `@rntme/deploy-core`
    require changes (extends scope).
  - Lint/depcruise rejects an import boundary.
  - Required behavior of `extras.auth0Mgmt` not yet known to the Worker.

### Option B — Dokploy reconciliation baseline (operations-only path)

- Objective: bring the broken `platform-http-wfbviw` app in line with the
  current code without local edits: rewrite dockerfile + dockerContextPath,
  add Operaton + Redpanda compose stacks, set Auth0 env vars on the app.
- `allowed_files`: `docs/goals/dokploy-platform-e2e-deploy/notes/**` only
  (no repo source touched; everything is over the Dokploy API/MCP).
- `verify`:
  - `application.one` reports new dockerfile path
    `packages/runtime/runtime/Dockerfile` and dockerContextPath `/`.
  - `environment.one` lists Operaton and Redpanda compose entries.
  - `application.deploy` produces a build that reaches `applicationStatus:
    'done'`.
  - No secret values appear in any log or note.
- `stop_if`:
  - Operator cannot supply `AUTH0_*` secrets.
  - The runtime image is not yet pushed to a registry the Dokploy host can
    pull (required if not building from repo).
  - Build still fails after two retries.

### Preferred slice for first iteration

**Option A** is the safer, more canonical first slice: it unblocks
`rntme platform up`, leaves the deployed app untouched, and produces a
verifiable receipt (passing unit tests) without spending operator-supplied
credentials. Option B should come second, as the actual deploy slice, once
the CLI can describe a viable target.

## 9 — Asks for the operator

- Confirm: is the intended Dokploy target the existing `runtime` project
  (where `platform-http-wfbviw` already lives) or the empty `rntme-platform`
  project? Re-using `runtime/production` keeps `platform.rntme.com:3000`,
  the Postgres, and Rustfs intact.
- Confirm: which Auth0 tenant should `provision.identity.spaClient` write to?
  `.env` points at `demo-rntme.us.auth0.com`; the SPA client is a *new*
  resource provisioned in that tenant — ok to create it there?
- Confirm: ok to push a runtime container image to a public registry (e.g.
  `ghcr.io/vladprrs/rntme-runtime`) before deploy, or should the Dokploy
  host build from repo via the existing GitHub source?
- Rotation hygiene: `AUTH0_MANAGEMENT_CLIENT_SECRET` and `DOKPLOY_API_KEY`
  were posted in plain text in the goal-thread message stream while
  correcting the §1 error. Both should be rotated when convenient — the
  Auth0 mgmt secret gives full tenant control, and the Dokploy API key
  gives full deploy control.
