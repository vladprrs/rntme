# T003 — Worker receipt: runtime/production cleanup

Author: Worker / pm-loop iteration 1
Date: 2026-05-11
Allowed-files scope: `state.yaml`, `notes/T003-cleanup-receipt.md`. No source
files modified.

## Pre-conditions confirmed

- `getent hosts platform.rntme.com` → `195.140.147.206`.
- `getent hosts rntme.com` → `195.140.147.206`. Same host → single Dokploy
  swarm, Traefik routes by domain → reusing the host for the new platform
  in `rntme-platform/production` requires no DNS change.
- `application.one(M5WfXaxcgKVHppiTldEbD)` → `applicationStatus: "done"`,
  last deploy `2026-05-11T03:33:01Z` (commit `2e001d60`, PR #205) — landing
  is healthy.
- PR #205 already auto-deployed to platform-http-wfbviw at
  `2026-05-11T03:32:51Z` with `status: "error"` (dockerfile
  `apps/platform-http/Dockerfile` deleted by that very PR), confirming the
  earlier Scout prediction.

## Actions taken (Dokploy MCP)

| Call | Target | Result |
| --- | --- | --- |
| `application-delete` | `Z7cvz89fO4ty8tkZYVMXs` (platform-http-wfbviw) | `success: true` |
| `application-delete` | `SmDbaW5aLXpGComEj-O_j` (rustfs-jyqt9f) | `success: true` |
| `postgres-remove` | `xK9g1NniBWBjr67ciIDxB` (platform-pg-gzfrsm) | `success: true` |

## Post-conditions verified

- `application-one(Z7cvz89fO4ty8tkZYVMXs)` → `Resource not found`. ✅
- `application-one(SmDbaW5aLXpGComEj-O_j)` → `Resource not found`. ✅
- `postgres-one(xK9g1NniBWBjr67ciIDxB)` → `Resource not found`. ✅
- `project-one(RK4scgw5bryx2qolyzkSc)` → `environments[0].applications.length
  === 1` (only landing), `…postgres.length === 0`,
  `…compose/libsql/mariadb/mongo/mysql/redis` all empty. ✅
- `application-one(M5WfXaxcgKVHppiTldEbD)` (re-checked indirectly via
  project listing) → still `applicationStatus: "done"`. ✅

## Notable observations

- `mcp__dokploy__application-delete` and `mcp__dokploy__postgres-remove`
  both echo the full resource record on success — including env-block
  plaintext for the deleted platform-http app
  (`DATABASE_URL` with password, `RUSTFS_*` keys, `WORKOS_*` keys,
  `PLATFORM_COOKIE_PASSWORD`, `PLATFORM_SECRET_ENCRYPTION_KEY`) and the
  Postgres `databasePassword`. Add to `dokploy_mcp_leaks_secrets`
  evidence: delete-path also leaks. Values not transcribed into this
  receipt or any commit.
- The leaked credentials belong to resources that no longer exist, so the
  damage is bounded to "they were posted in the Dokploy MCP response
  stream". Worth noting that `dokploy_docker_build_context` and the
  same-secret-leak memory should be revised to cover delete responses.

## Stop conditions not triggered

- No 401 from Dokploy API throughout the operation.
- Landing's `applicationStatus` did not change.
- DNS resolution succeeded for both hosts before any delete.

## Side effects / open follow-ups

- `platform.rntme.com` Lets-Encrypt cert was attached to the deleted
  `platform-http` app's domain. Once T005 stands up the new platform with
  a domain bound to `platform.rntme.com:3000`, Traefik will request a new
  cert. Should succeed on a single-host Dokploy without manual steps.
- Postgres named-volume `platform-pg-gzfrsm-data` and the rustfs named
  volume `rustfs-data` were attached to the deleted resources. Dokploy
  may have left the underlying docker volumes on disk; T005 plan should
  not depend on them.
- No platform is reachable at `platform.rntme.com` until T005 completes.
  Acceptable per the goal's pre-stable scope.

## Next active task

Hand-off to **T004** (Worker): extend CLI direct-mode `target-schema /
load-target / load-secrets` to accept `workflows.engine`,
`target.auth.auth0.*`, and `auth0Mgmt` extras; author the
`platform.target.json` pointing at
`rntme-platform/production` (project `wmiyt_0T7SKvS3sr6rzGK`, env
`rvVDXwBImLyL739o1ZdPQ`).
