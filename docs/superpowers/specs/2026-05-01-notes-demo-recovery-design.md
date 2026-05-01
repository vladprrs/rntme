# Notes-demo recovery — design

**Status:** brainstorming approved, awaiting user review of this spec
**Author:** brainstorm 2026-05-01
**Related:**
- `docs/superpowers/specs/done/2026-04-23-project-first-blueprint-design.md` — blueprint composition (Track A).
- `docs/superpowers/specs/done/2026-04-24-project-deployment-pipeline-design.md` — `deploy-core` / `deploy-dokploy`.
- `docs/superpowers/specs/done/2026-04-26-project-deploy-flow-design.md` — platform / CLI orchestration (Track C — implemented; *not* missing as the user's stale grep suggested).
- `docs/superpowers/specs/done/2026-04-30-merge-rntme-cli-back-design.md` — relocation that produced the regressions noted below.
- `demo/notes-blueprint/README.md` — Auth0 / Redpanda inputs the deploy target must satisfy.

## 1. Problem

The `notes-demo` blueprint is the production-shape walkthrough that proves the platform can publish + deploy + serve a real user-facing app. After the merge-back PR (#106) and the Dokploy purge on 2026-04-30, the demo is **not running**:

- DNS for `notes-demo.rntme.com` and `rnt-364-notes-demo.rntme.com` resolves to the Dokploy host (`195.140.147.206`), but Traefik returns `404 page not found` with a self-signed cert — there is no router for either hostname today.
- The Dokploy `rntme-demos` project exists but is **empty** (no application, no compose).
- The platform recorded 20 attempts on 2026-04-30. Last 8 ended `succeeded_with_warnings` with the same shape: `apply` succeeded, `edge-health 200`, **`/` UI route returned HTTP 502** (nginx upstream `app:3000` unreachable). All those resources were wiped during the cleanup.
- The two deploy targets that exist on the platform are both broken in different ways (see §3).
- Several files in `apps/platform-http/src/deploy/executor.ts` and `apps/cli` still reference pre-relocation paths.

The user-visible target outcome is: `https://notes-demo.rntme.com/` returns the SPA, login through Auth0 works end-to-end, the notes list renders, create/delete works, deployment status is `succeeded` (not `_with_warnings`).

## 2. Goal

Restore the notes-demo end-to-end flow on top of the existing platform/CLI/deploy code without inventing new components. Specifically:

1. Bring deploy-target configuration to a state where the platform executor produces a successful deploy of `notes-demo` to Dokploy at `https://notes-demo.rntme.com/`.
2. Identify and fix the **502-on-`/`** root cause by rebuilding from current `main` and watching boot logs of the freshly-deployed `app` container.
3. Patch the post-relocation regressions in `executor.ts` that surfaced during the rendering walk.
4. Leave a documented, repeatable path for re-publishing notes-demo that does not require any per-attempt manual intervention beyond setting `configOverrides.runtimeImage` (and even that we eliminate via target-default below).

The goal is not to introduce new features in `deploy-core`, `deploy-dokploy`, or `platform-http`. Where current behavior forces avoidable manual intervention, we record that as a follow-up but do not block recovery on it.

## 3. Decisions

| # | Question | Decision (user, 2026-05-01) |
|---|---|---|
| D1 | Public hostname for notes-demo | **`notes-demo.rntme.com`** — matches blueprint hardcoded `audience` / `redirectUri`. Deploy target's `publicBaseUrl` is changed to this URL; blueprint is *not* touched. |
| D2 | Source of runtime / identity-auth0 images | **Fresh build from `main` after merge-back.** New tags `runtime-main-<sha>` and `identity-auth0-main-<sha>`. The existing `runtime-rnt-364-*` / `identity-auth0-rnt-364-*` tags are not used — they are pre-merge-back and may be stale. |
| D3 | Default deploy-target `dokploy-demos` | **Delete it.** Was provisioned for a simpler demo (no Auth0, no integration modules, internal Redpanda). It can never serve notes-demo. After removal, the rnt-364 target becomes the basis for the new `notes-demo` target. |
| D4 | Naming of the surviving target | Rename `dokploy-rnt-364` → **`notes-demo`** (org-scoped), set `isDefault=true`, set `publicBaseUrl=https://notes-demo.rntme.com`. The slug "rnt-364" was tied to a one-off ticket and is no longer meaningful. |
| D5 | Should we re-publish the bundle? | **No** — `seq=2` (`sha256:0ae3ad…f0a`) for `notes-demo` is fine; blueprint did not change. Idempotent re-publish would no-op anyway. |
| D6 | Audience source of truth | **Blueprint stays canonical.** Auth0 SPA app + API identifier must match `https://notes-demo.rntme.com/api` and `https://notes-demo.rntme.com/`. If Auth0 is misconfigured, fix Auth0, not the blueprint. |
| D7 | `secretRefs` literal-vs-ref | **Out of scope for recovery.** Today they are literals stored encrypted in `deploy_targets.event_bus` JSONB; render emits them as `secret: true` env. Acceptable for MVP; document as follow-up to wire actual Dokploy secret references. |
| D8 | Doc-touch scope | This recovery is operational, not architectural. Touch only `apps/platform-http/README.md` (note the executor path fix). `demo/notes-blueprint/README.md` is unchanged — it never named the legacy target slug. No `AGENTS.md` / `CLAUDE.md` / `vision.md` change. |

## 4. Scope

### 4.1 In scope

- Delete the unused `dokploy-demos` deploy target via the platform API.
- Mutate `dokploy-rnt-364` deploy target: rename to `notes-demo`, set `publicBaseUrl=https://notes-demo.rntme.com`, set `isDefault=true`.
- Trigger the GitHub Actions workflow on `main` that builds and publishes `runtime-main-<sha>` and `identity-auth0-main-<sha>` to GHCR. Wait for the new tags. Update the deploy target's `modules.identity-auth0.image` to the new identity-auth0 tag.
- Verify Auth0 SPA app `imxBZKGfAPj61xOdf13xLB6DVQyQDNTT` has callback URL `https://notes-demo.rntme.com/`, allowed web origin `https://notes-demo.rntme.com`, allowed logout URL `https://notes-demo.rntme.com/`. Verify Auth0 API resource server has identifier `https://notes-demo.rntme.com/api`.
- Fix `apps/platform-http/src/deploy/executor.ts:575` (`readUiRuntimeCss`) to read from `packages/runtime/ui-runtime/build/main.css`. Fall back to the legacy `packages/ui-runtime/build/main.css` only if the new path is absent (defensive, removable later).
- Walk the live publish + deploy path with the configured target and `configOverrides.runtimeImage=<new main tag>`.
- If `/` still returns 502: open Dokploy `application-readLogs` for the `app` container at boot time, identify root cause, fix, redeploy.
- After the deploy reaches plain `succeeded`, manual smoke check in the browser per `demo/notes-blueprint/README.md` §"User test after deploy" steps 1–5.

### 4.2 Out of scope

- Any new code in `deploy-core`, `deploy-dokploy`, `platform-core` beyond the single executor path-fix.
- Wiring Dokploy secret references (encrypted env in Dokploy) instead of literal `secretRefs`. Tracked as follow-up.
- Multi-environment deploys; `environment=default` only.
- `.env` cleanup (the duplicate `RNTME_EVENT_BUS_USERNAME` line) — local-only; tracked as a one-line follow-up.
- Adding orphan-blob cleanup, deployment cancellation, or any feature explicitly out of scope per `2026-04-26-project-deploy-flow-design.md`.
- Refactoring branded-image tagging in CI to a canonical `:main`/`:latest` pattern. The plan upgrades by SHA only.

## 5. What we already verified (raw evidence)

The following came from this brainstorm session and is the basis for §6:

- **CLI/auth:** `~/.rntme/credentials.json` is absent locally. PAT `rntme_pat_uSTV5v81aJpo1x30OuI15u` is valid against `https://platform.rntme.com/v1/auth/me`; org `test-organization` (id `acbad7d1-2a45-48cf-9381-ac144fdb3e25`); scopes include all needed (`project:read`, `project:write`, `version:publish`, `deploy:target:manage`, `deploy:execute`).
- **Project on platform:** `notes-demo` exists (id `bb207638-71da-49b0-b93b-eb02e14ec4c3`).
- **Versions:** `seq=1` (`sha256:6def81…`) without `auth` middleware, `seq=2` (`sha256:0ae3ad…`) with `auth` — matches current `demo/notes-blueprint/project.json`. Latest is `seq=2`.
- **Deploy targets:** two — `dokploy-demos` (default, broken for notes-demo: empty `auth`/`modules`, internal Redpanda); `dokploy-rnt-364` (correct Auth0 + identity-auth0 + Redpanda Cloud, but `publicBaseUrl=rnt-364-notes-demo.rntme.com`).
- **Deployment trace, 2026-04-30:** 20 records. Final 8 `succeeded_with_warnings` shape:

  ```
  apply.urls.uiUrl              = https://rnt-364-notes-demo.rntme.com/
  apply.resources               = [app, identity-auth0, edge]   (all "updated")
  verificationReport.checks     = [
    edge-health  /health  200  4032ms   ← OK
    ui            /       502  7113ms   ← upstream app:3000 unreachable
  ]
  ```

- **Pre-relocation paths in code:** `apps/platform-http/src/deploy/executor.ts:575` (`readUiRuntimeCss`) reads `packages/ui-runtime/build/main.css` — that path no longer exists; actual is `packages/runtime/ui-runtime/build/main.css`. Function silently returns a placeholder comment string. Not a 502 cause but a real UX regression.
- **`findWorkspaceRoot` and `discoverWorkspacePackageDirs`** in the same file are *already adapted* to the new layout (they recurse into `packages/<role>/` subtrees and accept `packages/runtime/ui-runtime/package.json`).
- **Dokploy state:** project `rntme-demos` (id `A_FqV_wcGzoh4K-Nq5xVB`, env `C2epQ14S_Go4VN6eP8wxv`) is empty. Other apps on the host (`rntme-landing`, `platform-http`, `rustfs`, third-party `cv-cms-ru-app`, third-party `multica`) are live and untouched.

## 6. Approach

A single linear sequence in seven steps. Each step has an automated verification.

### Step 1 — Configure CLI credentials

```bash
mkdir -p ~/.rntme
cat > ~/.rntme/credentials.json <<EOF
{
  "version": 1,
  "defaultProfile": "default",
  "profiles": {
    "default": {
      "baseUrl": "https://platform.rntme.com",
      "token": "rntme_pat_uSTV5v81aJpo1x30OuI15u",
      "addedAt": "2026-05-01T00:00:00.000Z"
    }
  }
}
EOF
chmod 600 ~/.rntme/credentials.json
```

Verify: `node apps/cli/dist/bin/cli.js whoami` returns the same subject as `GET /v1/auth/me`.

### Step 2 — Delete `dokploy-demos`

```bash
RNTME_TOKEN="..."  # from .env
curl -X DELETE -H "Authorization: Bearer $RNTME_TOKEN" \
  https://platform.rntme.com/v1/orgs/test-organization/deploy-targets/dokploy-demos
```

Verify: `GET /v1/orgs/test-organization/deploy-targets` returns only `dokploy-rnt-364`.

### Step 3 — Reshape `dokploy-rnt-364` into `notes-demo`

The platform `PATCH /v1/orgs/:org/deploy-targets/:slug` route accepts updates to `displayName`, `dokployUrl`, `dokployProjectId`/`Name`, `allowCreateProject`, `eventBus`, `policyValues`, `modules`, `auth`, `publicBaseUrl`, `isDefault`. Slug change is *not* in the standard PATCH (per `UpdateDeployTargetRequestSchema`) — verify before assuming. If slug rename is unsupported, accept the legacy slug and set a clear `displayName`.

Required mutations:

```jsonc
{
  "displayName": "Notes demo (Dokploy)",
  "publicBaseUrl": "https://notes-demo.rntme.com",
  "isDefault": true
  // modules.identity-auth0.image will be set in Step 4 once we know the tag
}
```

Verify: `GET …/deploy-targets/notes-demo` (or `/dokploy-rnt-364`) returns `publicBaseUrl=https://notes-demo.rntme.com` and `isDefault=true`.

### Step 4 — Build new images from `main`

Trigger the GitHub Actions workflow that publishes runtime + identity-auth0 images. Wait for new tags.

Verify (with a GHCR PAT that has `read:packages`):

```bash
GHCR_TOKEN=...
curl -sI -H "Authorization: Bearer $GHCR_TOKEN" \
  https://ghcr.io/v2/vladprrs/rntme-runtime/manifests/runtime-main-<sha>
curl -sI -H "Authorization: Bearer $GHCR_TOKEN" \
  https://ghcr.io/v2/vladprrs/rntme-identity-auth0/manifests/identity-auth0-main-<sha>
```

Both should return HTTP 200.

Update target's `modules.identity-auth0.image` via PATCH to the new identity-auth0 tag. The runtime image is supplied per-deployment via `configOverrides.runtimeImage`; we will use the new runtime tag in Step 6.

### Step 5 — Code regression fix in same PR

`apps/platform-http/src/deploy/executor.ts:574-578`:

```ts
function readUiRuntimeCss(workspaceRoot: string): string {
  for (const cssPath of [
    join(workspaceRoot, 'packages', 'runtime', 'ui-runtime', 'build', 'main.css'),
    join(workspaceRoot, 'packages', 'ui-runtime', 'build', 'main.css'),
  ]) {
    if (existsSync(cssPath)) return readFileSync(cssPath, 'utf8');
  }
  return '/* rntme ui runtime styles unavailable at deploy bundle time */\n';
}
```

The legacy fallback can be deleted in a follow-up after we are sure no historical workspace layout is in use.

Verify: `pnpm -r build` is green; `vitest run apps/platform-http/test/unit/deploy/executor.test.ts` (existing tests) is green; manually grep `apps/platform-http/src/deploy/executor.ts` for any other `'packages', 'ui-runtime'` literals — none should remain.

### Step 6 — Walk the live deploy

Once Steps 1–5 are landed:

```bash
RNTME_TOKEN="..."
RUNTIME_IMG="ghcr.io/vladprrs/rntme-runtime:runtime-main-<sha>"

curl -X POST -H "Authorization: Bearer $RNTME_TOKEN" -H "Content-Type: application/json" \
  https://platform.rntme.com/v1/orgs/test-organization/projects/notes-demo/deployments \
  -d "$(jq -nc --arg img "$RUNTIME_IMG" '{
    projectVersionSeq: 2,
    targetSlug: "notes-demo",
    configOverrides: { runtimeImage: $img }
  }')"
```

Poll `GET …/deployments/<id>` and `GET …/deployments/<id>/logs?sinceLineId=…` every 2s until terminal.

### Step 7 — If `/` still returns 502, diagnose `app` boot

The expected next investigation step (we cannot pre-empt this without container logs):

1. `mcp__dokploy__application-readLogs` for the rendered `app` resource (target name `rntme-test-organization-notes-demo-app`). Look at the first ~200 boot lines.
2. Likely failure modes (in priority order based on what we know):
   - **Cannot connect to Redpanda Cloud** — wrong username (the `.env` sets `RNTME_EVENT_BUS_USERNAME` twice; second value `notes-demo` wins) or `topicPrefix` not provisioned. Verify in Redpanda Cloud which user / prefix is real.
   - **Cannot reach identity-auth0 gRPC** — runtime expects `rntme-test-organization-notes-demo-identity-auth0:50051`; check that the `integration-module` resource name matches and bound `:50051`.
   - **Wrong port** — runtime image binds something other than `3000` (nginx upstream is hardcoded `:3000` in `render.ts:105`).
   - **Missing artifact** — `RNTME_ARTIFACTS_DIR=/srv/artifacts` should contain `manifest.json`, `pdm.json`, `qsm.json`, `bindings.json`, `shapes.json`, `graphs/*.json`, `ui/*.json`, `seed.json`, `<module>.proto`. Cross-check render output vs Dokploy "files" mounts.
   - **Boot-time crash** — runtime image entrypoint changed across `main` merge.

Pick the topmost match from logs, fix at source, retrigger Step 6.

### Step 8 — Acceptance

A deploy with `status='succeeded'` (no `_with_warnings`) and:

- `curl -sI https://notes-demo.rntme.com/health` → `HTTP/2 200` (edge nginx static return).
- `curl -sI https://notes-demo.rntme.com/` → `HTTP/2 200`, `content-type: text/html`.
- `curl -sI https://notes-demo.rntme.com/api` (or any binding-bound HTTP route from `services/app/bindings/bindings.json`) → either `200` for an idempotent GET or `401` if the route requires auth — both prove the upstream is up. Important: the runtime does not expose `/api/health`; only the edge nginx exposes `/health`.
- Browser flow per `demo/notes-blueprint/README.md` §"User test after deploy" 1–5 (login → list notes → create note with `ownerSub` from Auth0 sub → 401 / logout → back to LoginScreen).

## 7. Failure-mode tree (what makes Step 7 specific instead of vague)

```
GET /  →  502  (apply ok, edge-health 200)
└── nginx upstream "rntme-test-organization-notes-demo-app:3000" unreachable
    ├── A) container not running           → application-one  status, deploymentLogs
    │   ├── A1) image pull failure          → fix tag in Step 4
    │   ├── A2) entrypoint exit immediately → readLogs first 50 lines
    │   └── A3) OOM                         → memoryLimit / docker-getContainers stats
    ├── B) container running but :3000 not bound
    │   ├── B1) wrong port in image          → confirm runtime binds 3000
    │   └── B2) bound on 0.0.0.0 vs 127.0.0.1 → readLogs for "listening on"
    └── C) container running, port bound, but health-fails
        ├── C1) Redpanda connect failure     → readLogs grep "kafka|broker|sasl|redpanda"
        ├── C2) identity-auth0 gRPC failure  → readLogs grep "identity-auth0|grpc|50051"
        ├── C3) Postgres absent (if persistence-mode requires it) → check workload.persistence
        └── C4) Artifact dir missing files   → compare render output (RenderedDokployResource.files) against
                                               actual mounts visible in mcp__dokploy__application-one
```

For each branch, the diagnostic command is one Dokploy MCP call. Plan execution does the right one based on what `application-one` returns first.

## 8. Plan split

Two PRs.

### PR 1 — Code fix + this spec

- `apps/platform-http/src/deploy/executor.ts:574-578` path fix.
- This spec file.
- `apps/platform-http/README.md` adds a one-line note that `readUiRuntimeCss` checks both old and new ui-runtime locations.
- One unit test in `apps/platform-http/test/unit/deploy/executor.test.ts` that injects a workspace dir with the new path layout and asserts CSS is loaded.

### PR 2 — Operational recovery (no merged code, just operations)

A short Markdown report under `docs/superpowers/plans/notes-demo-recovery-<date>.md` that records:

- Steps 1–4 outputs (deleted target id, patched target shape, new image SHAs).
- Step 6 deployment id, log excerpts.
- Step 7 root cause for the 502 (whichever branch from §7 was hit).
- Step 8 acceptance evidence (curl outputs, browser flow notes).

This doubles as the "deployment runbook" entry; future demos start from it.

## 9. Risks and reversibility

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Auth0 SPA app misconfig (callback / web origin) | medium | login breaks at Step 8 | manual check before Step 6; instructions in Auth0 console are 5-click |
| Redpanda Cloud user / topic prefix wrong | medium | runtime fails Step 7 C1 | resolve duplicate `RNTME_EVENT_BUS_USERNAME` in `.env` and verify in Redpanda console first |
| GHA build of `main` images takes long / fails | medium | blocks Step 4 | local Docker build + push as fallback (recorded in PR2 if used) |
| 502 root cause is in `deploy-dokploy.applyDokployPlan` (e.g. wrong nginx upstream wiring) | low | Step 7 needs render-side patch, not a config fix | inspect `applyResult.resources` env on next attempt; compare to `render.ts` expectations |
| Slug rename via PATCH is not supported by `UpdateDeployTargetRequestSchema` | low | keep legacy slug `dokploy-rnt-364`, just change `displayName` | accept and document; not blocking |
| Dokploy account hits create-project limit | very low | Step 6 fails on apply | target reuses existing project id `A_FqV_wcGzoh4K-Nq5xVB`, no create needed |

Everything in §6 except Step 4 (image build) and Step 7 (whatever the fix turns out to be) is reversible by `DELETE /deploy-targets/<slug>` + `POST` of the previous shape. The platform records each mutation in the audit table.

## 10. Documentation touches

Per `CLAUDE.md` mandate, every plan must include doc-touch tasks:

- `apps/platform-http/README.md` — one paragraph in the "deploy executor" section noting `readUiRuntimeCss` accepts new + legacy ui-runtime locations (PR 1).
- `demo/notes-blueprint/README.md` — no change. The README does not name target slugs; "Required deploy inputs" is already correct (audience must equal `https://notes-demo.rntme.com/api`).
- No `AGENTS.md`, `CLAUDE.md` (Architecture in one paragraph), `vision.md`, `docs/architecture.md` change — the recovery does not move package boundaries, layering, or product positioning.
- `docs/superpowers/plans/notes-demo-recovery-<date>.md` — operational record (PR 2).

## 11. Why this shape

Three principles drive the decisions:

- **Recovery is operational, not architectural.** The Track-A/B/C primitives (blueprint, deploy-core/dokploy, platform orchestration) are fine. What broke is configuration drift after a branch was merged and a Dokploy purge. We treat it as a config + image refresh, with one path-fix in `executor.ts` because the merge-back left a residue.
- **Hostname is canonicalized to the blueprint, not the target.** The blueprint hardcodes `notes-demo.rntme.com` in three places (`audience`, `redirectUri`, mount comments). That is the audience contract Auth0 enforces. Letting the deploy target's `publicBaseUrl` win would force us to rewrite the blueprint and reissue Auth0 — the wrong direction.
- **Same-PR doc touches.** `2026-04-26-docs-refresh-after-project-first-pivot-design.md` quantified the cost of letting docs drift between PR 12 and PR 16 in the project-first window. Recovery is small enough that PR 1 carries its own doc updates rather than a follow-up.
