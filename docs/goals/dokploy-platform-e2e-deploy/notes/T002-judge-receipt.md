# T002 — Judge receipt

Author: Judge / pm-loop iteration 1
Date: 2026-05-11
Mode: read-only decision; reasoning_hint: high.

## Inputs consulted

- `T001` scout receipt (`notes/T001-scout-receipt.md`).
- `docs/superpowers/specs/2026-05-10-cli-universal-deploy-and-platform-http-removal-design.md`
  (operator-supplied context).
- Operator answers via `AskUserQuestion`:
  - Path: Option A (extend CLI direct-mode; use `rntme platform up`).
  - Cleanup scope: delete only the platform-related artefacts in
    `runtime/production` (platform-http-wfbviw, rustfs-jyqt9f,
    postgres platform-pg-gzfrsm). Keep `rntme-landing`
    (`app-calculate-open-source-monitor-64rl9o`) untouched.
  - Target environment for new platform: `rntme-platform/production`
    (project id `wmiyt_0T7SKvS3sr6rzGK`, environment id
    `rvVDXwBImLyL739o1ZdPQ`).

## Decision

**Path A — extend CLI direct-mode + use `rntme platform up`.** Operations-only
reconfiguration is rejected (bypasses the canonical deploy front the goal is
meant to certify).

Worker sequence revised:

1. **T003 — Cleanup** (operations-only, no source edits). Delete the three
   platform artefacts from `runtime/production` via Dokploy MCP/API.
2. **T004 — Extend CLI direct-mode** (code change). Make
   `apps/cli/src/deploy-engine/` accept the fields the platform blueprint
   needs: `workflows.engine`, `target.auth.auth0.*`, `auth0Mgmt` secret
   extras. Author `platform.target.json` for `rntme-platform/production`.
3. **T005 — Bundle + deploy** (one-shot operation). Build CLI, run
   `rntme platform up --target platform.target.json --log-file …`. Verify
   resources reach healthy via Dokploy MCP. Document deployment id, host,
   and applied env vars (names only).
4. **T006 — e2e** (verification). Auth0-token roundtrip against the
   deployed platform (one read endpoint via `Authorization: Bearer <Auth0
   access_token>`); confirm `IntrospectSession` succeeds and logs via MCP
   show the request. Define this as the minimum e2e that proves the proof
   chain.
5. **T999 — final audit**.

## First Worker activated: T003

Objective: delete the three platform artefacts from Dokploy
`runtime/production` (project `RK4scgw5bryx2qolyzkSc`, environment
`2HJhor6CZm0SX4vLDLI4q`):

- application `platform-http-wfbviw` (id `Z7cvz89fO4ty8tkZYVMXs`)
- application `rustfs-jyqt9f` (id `SmDbaW5aLXpGComEj-O_j`)
- postgres `platform-pg-gzfrsm` (id `xK9g1NniBWBjr67ciIDxB`)

Must-leave-alone: application `app-calculate-open-source-monitor-64rl9o`
(`M5WfXaxcgKVHppiTldEbD`, the `rntme-landing` site on `rntme.com`).

`allowed_files`:

- `docs/goals/dokploy-platform-e2e-deploy/state.yaml`
- `docs/goals/dokploy-platform-e2e-deploy/notes/T003-cleanup-receipt.md`

(No source edits. All actions go through the Dokploy REST API or MCP tools.)

`verify`:

- `GET /api/application.one?applicationId=Z7cvz89fO4ty8tkZYVMXs` → 404 or
  application-not-found.
- `GET /api/application.one?applicationId=SmDbaW5aLXpGComEj-O_j` → 404 or
  application-not-found.
- `GET /api/postgres.one?postgresId=xK9g1NniBWBjr67ciIDxB` → 404 or
  postgres-not-found.
- `GET /api/application.one?applicationId=M5WfXaxcgKVHppiTldEbD` → still
  200 with `applicationStatus: 'done'` (landing untouched).
- `GET /api/project.one?projectId=RK4scgw5bryx2qolyzkSc` returns the
  `runtime` project with `environments[0].applications.length === 1`
  (only the landing) and `environments[0].postgres.length === 0`.

`stop_if`:

- Any of the three deletes returns an unexpected error code (not 200 + ack
  and not the resource-already-deleted shape).
- The landing app's status changes from `done` to anything else during the
  operation.
- DNS `platform.rntme.com` resolution fails the host check before deletes
  (would mean Traefik routing might also depend on a wildcard that we
  cannot recover without reconfiguring before re-deploy).
- Operator credentials in `.env` stop working (401 from Dokploy) — at that
  point cleanup is incomplete; record state and pause.

## Risks captured

- DNS for `platform.rntme.com` currently points at the host that serves the
  `runtime` Dokploy project. Single-server Dokploy + Traefik routes by
  host, so the same DNS can resolve to the new app in `rntme-platform`
  after T005 without DNS changes. That's confirmed only if the Dokploy
  swarm is single-host. If multi-host, T005 must explicitly bind the new
  app to the same server.
- The rustfs S3 instance is likely the bucket backing platform attachments.
  Deleting it loses any data inside it. Operator scope answer accepted
  loss of this data given the platform is being re-bootstrapped from
  empty.
- The platform-pg-gzfrsm postgres also holds platform state (org/project/
  token rows). Deleting it loses that data. Same operator-accepted loss.
- After T003 lands, no platform is reachable on `platform.rntme.com` until
  T005 completes. Acceptable per the goal's scope (pre-stable; no users).
