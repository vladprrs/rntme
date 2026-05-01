> **Path note:** paths in this document reflect the pre-merge layout (`rntme-cli/packages/...`, `@rntme-cli/*`). After the merge-back PR lands they move per `2026-04-30-merge-rntme-cli-back-design.md` (e.g. `apps/platform-http`, `packages/deploy/deploy-core`, `@rntme/platform-core`).

# Project Deploy Flow — design

**Status:** brainstorming approved, awaiting user review of this spec
**Author:** brainstorm 2026-04-26
**Related:**
- `docs/superpowers/specs/done/2026-04-23-project-first-blueprint-design.md` — project-first blueprint model (Track A + B foundation).
- `docs/superpowers/specs/done/2026-04-24-project-deployment-pipeline-design.md` — `deploy-core` / `deploy-dokploy` library design. This spec is the platform/CLI orchestration around it.
- `docs/superpowers/specs/done/2026-04-19-platform-api-design.md` — current platform domain (orgs, projects, services, service-versions, tags). This spec replaces the service-version model.
- `docs/superpowers/specs/done/2026-04-21-platform-http-ui-design.md` — platform UI shell. New pages extend the same shell.

## 1. Problem

After PR 13–16, the building blocks are in place:

- `@rntme/blueprint` loads and validates a **project-first blueprint folder** (`project.json`, `pdm/`, `services/<slug>/{bindings,graphs,qsm,seed,ui}/`) and produces a composed model (PR 13–15).
- `@rntme-cli/deploy-core` produces a target-neutral `ProjectDeploymentPlan` from a composed project (PR 16).
- `@rntme-cli/deploy-dokploy` renders that plan to redacted Dokploy resources and applies them through an injected HTTP client (PR 16).

What is missing is the orchestration that connects them end-to-end:

- the platform has no concept of a project blueprint or project-version artifact — it still stores per-service bundles inherited from the pre project-first model;
- the platform has no concept of a deploy target — there is nowhere to store Dokploy URL + API token;
- the platform has no concept of a deployment — there is no record, no executor, no status, no logs;
- the CLI still publishes a single service via `rntme.json` and has no `project publish` command.

The user-visible target outcome is a single end-to-end flow: upload a project blueprint via the CLI, see it in the platform UI, click Deploy, and the project is deployed to Dokploy.

## 2. Goal

Define a **Project Deploy Flow** that connects:

- CLI `project publish` — packs a project blueprint folder into a canonical JSON bundle, validates locally, uploads to the platform.
- Platform — stores project versions, validates on upload (`loadComposedBlueprint` server-side), persists deploy targets per org with encrypted credentials, accepts deploy requests, runs the deploy pipeline as an in-process async job, persists redacted artifacts and logs, performs smoke verification.
- Platform UI — surfaces project versions, deploy targets, deployments, and a Deploy button.

The deploy pipeline itself (`deploy-core` planning, `deploy-dokploy` rendering and apply) is reused unchanged. This spec is the orchestration layer above it.

The legacy single-service publish model is **fully removed** in this spec — the platform is pre-stable, has no users, and the project-first blueprint composition validates services together, so per-service publishing no longer makes sense.

## 3. Decisions

| # | Question | Decision |
|---|---|---|
| D1 | Replace single-service model? | **Full replacement.** Drop `service_versions`, `services`, `tags` and all related use-cases / routes / UI / CLI commands. Project-version is the only authoring/publish unit. |
| D2 | Bundle format | **Canonical JSON bundle.** Flat dict of `relpath → parsed JSON`, canonical key order, deterministic SHA-256. Future binary assets — separate spec. |
| D3 | CLI manifest | **No `rntme.json`.** Project slug = `project.json.name`; org slug from auth-context (`~/.rntme/credentials.json`) with `--org` override. `--folder` flag for non-root layout. |
| D4 | Deploy target scope | **Per-org, multi-target, default flag.** Targets shared across projects in the org. UI dropdown to override default at deploy time. |
| D5 | Deploy execution model | **In-process async job in `platform-http`.** Heartbeat every 5s, orphan-detect at startup + every 60s. No separate worker process in MVP. |
| D6 | Verification depth | **Backend smoke only.** HEAD edge health + GET UI URL (when present). No `agent-browser` UI smoke. No per-API-route checks. |
| D7 | Cancellation | **No cancellation in MVP.** Idempotent apply via deterministic names → retry by clicking Deploy again is the recovery path. |
| D8 | Authorization | **Reuse `version:publish` and `project:read`; add `deploy:target:manage` (admin only) and `deploy:execute` (admin + member).** |
| D9 | Validation timing | **Validate at upload (CLI local + server re-validate); re-validate at deploy (defense in depth).** Idempotent upload (digest match) skips row creation but never skips validation. |
| D10 | Project auto-create on first publish | **Opt-in via `--create-project` flag.** Default fails clearly. |
| D11 | Bundle size cap | **10 MB raw JSON** pre-compression. |
| D12 | Bundle storage | **gzip-compressed JSON bytes in rustfs**, key `projects/<projId>/versions/<digest>.json.gz`. |
| D13 | Secret encryption | **AES-256-GCM**, key from `PLATFORM_SECRET_ENCRYPTION_KEY` env (32 bytes hex). Per-target nonce + `key_version` for future rotation. |
| D14 | Deploy target — event bus + policy values placement | **Stored on `deploy_targets`** (static infra). Per-deploy `configOverrides` (e.g. integration module images) stored on `deployments`. |
| D15 | Logs storage | **Separate table `deployment_log_lines`** (BIGSERIAL id, FK cascade) — avoids hot-row JSON updates. |
| D16 | UI logs delivery | **htmx polling `/logs?sinceLineId=` every 2s** while non-terminal. SSE/WebSockets — not in MVP. |
| D17 | API token redaction | **Token never returned by GET endpoints.** Rotation is a dedicated `PUT /api-token` endpoint with its own audit row. |
| D18 | Migration | **Single migration**, drop legacy tables before creating new ones. Pre-stable, no data preservation. |

## 4. Scope

### 4.1 In scope

- Project-version as the unit of publication, with idempotent content-addressable upload.
- Server-side blueprint validation (`@rntme/blueprint.loadComposedBlueprint`) on upload and on deploy.
- Per-org `deploy_targets` with encrypted Dokploy API token, event bus config, and policy values.
- `deployments` lifecycle (`queued → running → succeeded | succeeded_with_warnings | failed | failed_orphaned`) with heartbeat + orphan detection.
- In-process executor in `platform-http` that wires `deploy-core.plan → deploy-dokploy.render → deploy-dokploy.apply → SmokeVerifier`.
- Backend smoke verification — edge health + UI URL.
- Redacted apply artifacts (rendered plan digest, apply result, verification report) persisted on the deployment row.
- Append-only deployment logs.
- Platform UI pages: Project detail (versions + recent deployments), Project Version detail (with Deploy form), Deployments list/detail, Deploy Targets list/detail.
- CLI commands: `project publish` (replacing `validate` + `publish`), `project version list`, `project version show`. `init` rewritten for project-first blueprint.
- Removal of `services`, `service_versions`, `tags` tables; corresponding use-cases, repos, routes, UI pages, and CLI commands.

### 4.2 Out of scope

- Binary assets in blueprint (images, fonts, non-JSON files) — separate spec, side-channel `assets` blobs keyed from the bundle.
- Cancellation of in-flight deployments.
- `agent-browser` UI smoke verification — manual workflow until a separate spec.
- Per-API-route smoke checks — natural follow-up.
- Worker-process for deploy execution (single-instance `platform-http` is the MVP target).
- Drift detection / reconciler / status loop / automatic rollback.
- Diff between project-versions in UI.
- Tags (project-level or service-level) — separate spec if needed.
- Deploy via CLI (`rntme deploy`) — user requirement is UI-only deploy.
- Production mode deploys — `deploy-core` already rejects until prerequisites land (Kafka bus runtime plugin, persistent storage, auth middleware, etc.).
- Multi-environment naming — `environment` exists in plan but MVP accepts only `default`.
- Tag/version pinning across deploys — plan/render/apply is per-version-id.
- Orphan blob GC for deleted project-versions — opt-in cleanup script, not blocking.

## 5. Approach

**Approach A — extend `platform-*`, executor in `platform-http`** (chosen).

- `platform-core` gains repos, schemas, and use-cases.
- `platform-storage` gains pg-repos, migration, and a `SecretCipher` that closes over the env-provided key.
- `platform-http` gains routes, UI pages, the executor, the smoke verifier, and the orphan-detection background loop.
- `deploy-core` and `deploy-dokploy` are imported unchanged.
- `cli` is rewritten — drop legacy commands, add `project publish`, rewrite `init`.

The alternative (separate `@rntme-cli/deploy-runtime` package for the executor) is recorded as a follow-up if the executor outgrows in-process hosting (~250 lines today). Approach A matches the existing `core / storage / http` layering and keeps deploy execution close to its only consumer.

## 6. Data Model

### 6.1 New tables

#### `project_versions`

```sql
id UUID PK
project_id UUID FK → projects (CASCADE)
org_id UUID                                  -- denormalized for RLS
seq BIGINT                                   -- monotonic per project
bundle_digest TEXT                           -- "sha256:<hex>"
bundle_blob_key TEXT                         -- rustfs key
bundle_size_bytes BIGINT
summary JSONB                                -- { projectName, services[], routes, middleware, mounts }
uploaded_by_account_id UUID FK → accounts
created_at TIMESTAMPTZ NOT NULL DEFAULT now()

UNIQUE (project_id, seq)
UNIQUE (project_id, bundle_digest)           -- idempotent upload
INDEX (project_id, seq DESC)
```

`summary` is denormalized from `project.json` plus the composed result, so the UI can render the project version detail without re-fetching the bundle.

#### `deploy_targets`

```sql
id UUID PK
org_id UUID FK → orgs (CASCADE)
slug TEXT                                    -- "dokploy-staging"
display_name TEXT
kind TEXT CHECK (kind = 'dokploy')
dokploy_url TEXT
dokploy_project_id TEXT NULL                 -- preferred (deploy-pipeline spec D29)
dokploy_project_name TEXT NULL
allow_create_project BOOLEAN NOT NULL DEFAULT false
api_token_ciphertext BYTEA                   -- AES-256-GCM
api_token_nonce BYTEA
api_token_key_version SMALLINT NOT NULL
event_bus_config JSONB                       -- { kind: 'kafka', brokers, topicPrefix, security }
policy_values JSONB                          -- { rateLimit: {...}, bodyLimit: {...}, timeout: {...} }
is_default BOOLEAN NOT NULL DEFAULT false
created_at TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at TIMESTAMPTZ NOT NULL DEFAULT now()

UNIQUE (org_id, slug)
UNIQUE INDEX one_default_per_org ON deploy_targets (org_id) WHERE is_default
```

#### `deployments`

```sql
id UUID PK
project_id UUID FK
org_id UUID                                  -- denormalized for RLS
project_version_id UUID FK → project_versions (RESTRICT)
target_id UUID FK → deploy_targets (RESTRICT)
status deployment_status NOT NULL DEFAULT 'queued'
config_overrides JSONB NOT NULL DEFAULT '{}'
rendered_plan_digest TEXT NULL
apply_result JSONB NULL                      -- DeploymentApplyResult (redacted)
verification_report JSONB NULL
warnings JSONB NOT NULL DEFAULT '[]'
error_code TEXT NULL
error_message TEXT NULL
started_by_account_id UUID FK → accounts
queued_at TIMESTAMPTZ NOT NULL DEFAULT now()
started_at TIMESTAMPTZ NULL
finished_at TIMESTAMPTZ NULL
last_heartbeat_at TIMESTAMPTZ NULL

CONSTRAINT terminal_means_finished CHECK (
  (status IN ('queued', 'running') AND finished_at IS NULL)
  OR
  (status NOT IN ('queued', 'running') AND finished_at IS NOT NULL)
)
INDEX (project_id, queued_at DESC)
INDEX (target_id)
INDEX live_idx (status, last_heartbeat_at) WHERE status IN ('queued', 'running')
```

Postgres enum:

```sql
CREATE TYPE deployment_status AS ENUM (
  'queued', 'running', 'succeeded', 'succeeded_with_warnings', 'failed', 'failed_orphaned'
);
```

`project_version_id` and `target_id` use `RESTRICT` — the platform never silently drops historical deployment provenance by deleting their version or target.

#### `deployment_log_lines`

```sql
id BIGSERIAL PK
deployment_id UUID FK (CASCADE)
ts TIMESTAMPTZ NOT NULL DEFAULT now()
level TEXT NOT NULL                          -- 'info' | 'warn' | 'error'
step TEXT NOT NULL                           -- 'init' | 'plan' | 'render' | 'apply' | 'verify' | 'orphan_detected'
message TEXT NOT NULL                        -- redacted only
INDEX (deployment_id, id)
```

A separate table avoids hot-row updates during streaming.

### 6.2 Dropped tables

- `artifact_tag` (drop first — FK to `artifact_version`)
- `artifact_version` (FK to `service`)
- `service` (FK to `project`)

`project` and the identity tables (`organization`, `account`, `membership_*`) are kept. The `tag` and `service-version` concepts disappear with their tables. Rustfs blobs for legacy artifact bundles remain — best-effort cleanup is opt-in and out of scope for this migration.

### 6.3 RLS

Each new table carries a denormalized `org_id` and gets the existing tenant-isolation policy (`policies.sql` pattern):

```sql
ALTER TABLE <t> ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON <t>
  USING (org_id = current_setting('rntme.org_id')::uuid);
```

`deployment_log_lines` denormalizes `org_id` as well to keep the policy uniform; the FK to `deployments` is a structural integrity guarantee, not a tenancy guarantee.

### 6.4 Repo interfaces (`platform-core`)

- `ProjectVersionRepo`: `create`, `getBySeq`, `getByDigest`, `getById`, `listByProject`.
- `DeployTargetRepo`: `create`, `update` (without `apiToken`), `rotateApiToken`, `delete`, `list`, `getById`, `getBySlug`, `getDefault`, `setDefault` (atomic swap).
- `DeploymentRepo`: `create`, `getById`, `listByProject`, `transition` (status + side-effects), `setRenderedDigest`, `setApplyResult`, `finalize`, `appendLog`, `readLogs`, `touchHeartbeat`, `findStaleRunning`.
- `SecretCipher`: `encrypt(plaintext) → { ciphertext, nonce, keyVersion }`, `decrypt({ ciphertext, nonce, keyVersion }) → plaintext`. Implementation in `platform-storage` closes over `PLATFORM_SECRET_ENCRYPTION_KEY`.

## 7. Canonical Bundle Format

```json
{
  "version": 1,
  "files": {
    "project.json":                              { "name": "product-catalog", "services": [...], "routes": {...} },
    "pdm/entities/Product.json":                 { ... },
    "services/app/qsm/qsm.json":                 { ... },
    "services/catalog/bindings/bindings.json":   { ... },
    "services/catalog/graphs/listProducts.json": { ... }
  }
}
```

- `version: 1` — bundle format version.
- `files`: flat dict from POSIX-relative path (against blueprint root) to parsed JSON value. Lex-sorted keys.
- Each value is recursively canonicalized (sorted keys, no whitespace, UTF-8, LF).
- The bundle JSON itself is canonicalized.
- Only `.json` files are accepted; any non-JSON file in the blueprint folder fails CLI bundle build with `CLI_BUNDLE_NON_JSON_FILE`.

`bundle_digest = "sha256:" + hex(SHA-256(canonical_json_bytes(bundle)))`. The CLI and the server compute it identically; mismatch is a `PROJECT_VERSION_DIGEST_MISMATCH` error.

Bundle size cap: **10 MB raw JSON** pre-compression. Over → `PROJECT_VERSION_BUNDLE_TOO_LARGE`. On rustfs the bundle is gzip-compressed.

## 8. Upload Flow

### 8.1 CLI: `rntme project publish`

```
rntme project publish [--folder <path>] [--org <slug>] [--create-project] [--dry-run]
```

1. Resolve `org` from `--org` flag or default in `~/.rntme/credentials.json`. No default → error.
2. Read `<folder>/project.json`. `project_slug = project.json.name`.
3. Local validate: import `@rntme/blueprint.loadComposedBlueprint(folder)`; on `Result.ok=false` print structured errors and exit 1.
4. Walk folder, build canonical bundle dict (`.json` files only).
5. Compute `bundle_digest`.
6. If `--dry-run`: print summary + digest, exit 0.
7. `POST /v1/projects/<project_slug>/versions`, `Content-Type: application/rntme-project-bundle+json`, body = bundle JSON, bearer auth.
8. On `404 PROJECT_NOT_FOUND`:
   - `--create-project` → `POST /v1/orgs/<org>/projects { slug }`, retry publish.
   - else → exit 1 with hint.
9. On `200 OK` (idempotent match) → print `Already published as version #<seq>`.
10. On `201 Created` → print `Published as version #<seq>, digest <short>`.

`rntme validate` is removed — `--dry-run` covers it.

### 8.2 Server: `POST /v1/projects/:slug/versions`

Auth: bearer or session, scope `version:publish`.

```
1. Resolve project by (org_id from auth, slug from URL). 404 PROJECT_NOT_FOUND.
2. Read body bytes (cap 10 MB). > cap → 413 PROJECT_VERSION_BUNDLE_TOO_LARGE.
3. Compute SHA-256 of body bytes → bundle_digest.
4. SELECT FROM project_versions WHERE project_id=$1 AND bundle_digest=$2.
   If exists → 200 OK with existing version metadata.
5. Parse body as canonical bundle JSON.
   - Bad JSON → 400 PROJECT_VERSION_BUNDLE_PARSE_ERROR.
   - Missing files / wrong shape → 400 PROJECT_VERSION_BUNDLE_INVALID_SHAPE.
6. Materialize files into a uuid-named tmpdir under /tmp.
7. loadComposedBlueprint(tmpDir).
   On Result.ok=false → 422 PROJECT_VERSION_BLUEPRINT_INVALID with errors[] (passed through as-is).
8. Compute summary from project.json + composed result.
9. Upload gzipped bundle bytes to rustfs key 'projects/<projId>/versions/<digest>.json.gz'.
10. Begin transaction:
    - SELECT FROM projects WHERE id=$1 FOR UPDATE.
    - SELECT MAX(seq) FROM project_versions WHERE project_id=$1.
    - INSERT project_versions (...).
    Commit.
11. cleanup tmpdir.
12. Return 201 with { id, seq, digest, size, summary, createdAt }.
```

Failure after blob upload leaves an orphan blob — accepted in MVP, GC is a follow-up.

### 8.3 Read endpoints

- `GET /v1/projects/:slug/versions?cursor=&limit=` — list latest first.
- `GET /v1/projects/:slug/versions/:seq` — metadata + summary.
- `GET /v1/projects/:slug/versions/:seq/bundle` — `302` to a presigned rustfs URL (or streaming).

## 9. Deploy Targets

### 9.1 Endpoints (per-org)

| Method | Path | Scope | Notes |
|---|---|---|---|
| `GET` | `/v1/orgs/:slug/deploy-targets` | `project:read` | List, `apiToken: "***"` redacted |
| `POST` | `/v1/orgs/:slug/deploy-targets` | `deploy:target:manage` | Create |
| `GET` | `/v1/orgs/:slug/deploy-targets/:tslug` | `project:read` | Detail, redacted |
| `PATCH` | `/v1/orgs/:slug/deploy-targets/:tslug` | `deploy:target:manage` | Update (no `apiToken` field) |
| `PUT` | `/v1/orgs/:slug/deploy-targets/:tslug/api-token` | `deploy:target:manage` | Rotate token |
| `POST` | `/v1/orgs/:slug/deploy-targets/:tslug/default` | `deploy:target:manage` | Atomic default swap |
| `DELETE` | `/v1/orgs/:slug/deploy-targets/:tslug` | `deploy:target:manage` | 409 `DEPLOY_TARGET_IN_USE` if there are live deployments |

Create body:

```json
{
  "slug": "dokploy-staging",
  "displayName": "Staging Dokploy",
  "kind": "dokploy",
  "dokployUrl": "https://dokploy.acme.dev",
  "dokployProjectId": "abc-123",
  "allowCreateProject": false,
  "apiToken": "dkp_...",
  "eventBus": { "kind": "kafka", "brokers": ["redpanda:9092"], "topicPrefix": "rntme" },
  "policyValues": {
    "rateLimit": { "default": { "requestsPerMinute": 60, "burst": 20 } },
    "bodyLimit": { "default": { "maxBodySize": "2m" } },
    "timeout": { "default": { "upstreamTimeoutMs": 30000 } }
  },
  "isDefault": false
}
```

Each create / update / rotate / delete writes an audit row through the existing audit-repo. The plaintext `apiToken` never leaves request memory — it is encrypted before write and decrypted only inside the executor's `dokployClientFactory`.

### 9.2 Encryption

- Master key: `PLATFORM_SECRET_ENCRYPTION_KEY` env (hex-encoded 32 bytes). Required at startup; missing → fast-fail.
- Algorithm: AES-256-GCM via Node `crypto.createCipheriv('aes-256-gcm', ...)`.
- Per-row: random 96-bit nonce, ciphertext + auth tag concatenated, `key_version` column (current = 1).
- Future rotation: introduce key_version=2, dual-read until migrated, separate spec.

## 10. Deployment Execution

### 10.1 Start a deployment

`POST /v1/projects/:slug/deployments` — scope `deploy:execute`.

```json
{
  "projectVersionSeq": 7,
  "targetSlug": "dokploy-staging",
  "configOverrides": {
    "integrationModuleImages": { "mod-workos": "registry.acme.com/mod-workos:v3.2.1" }
  }
}
```

- `targetSlug` optional — falls back to org `is_default` target. No default + missing slug → `400 DEPLOY_REQUEST_TARGET_NOT_SPECIFIED`.
- Server validates project / version / target existence and integrity (e.g. version belongs to project), inserts `deployments` (`status='queued'`), schedules `setImmediate(() => runDeployment(id, deps))`, returns `202` with `{ id, status, detailUrl }`.

### 10.2 Executor

Lives in `platform-http/src/deploy/executor.ts`. Imports `@rntme/blueprint`, `@rntme-cli/deploy-core`, `@rntme-cli/deploy-dokploy`, plus repo + cipher seams. Pseudocode:

```ts
async function runDeployment(id: DeploymentId, deps: ExecutorDeps): Promise<void> {
  await deps.repo.transition(id, 'running', { startedAt: now() });
  const hb = setInterval(() => deps.repo.touchHeartbeat(id), 5_000);
  let tmpDir: string | null = null;

  try {
    const dep = await deps.repo.getById(id);
    const version = await deps.versions.getById(dep.projectVersionId);
    const target = await deps.targets.getById(dep.targetId);

    const bundleBytes = await deps.blob.fetch(version.bundleBlobKey);
    tmpDir = await materializeBundle(bundleBytes);
    const composed = await loadComposedBlueprint(tmpDir);
    if (!composed.ok) return await deps.repo.finalize(id, 'failed', {
      errorCode: 'DEPLOY_EXECUTOR_BLUEPRINT_REVALIDATION_FAILED',
      warnings: composed.errors,
    });

    const cfg = buildDeployConfig(target, dep.configOverrides);
    const plan = buildProjectDeploymentPlan(composed.value, cfg);
    if (!plan.ok) return await deps.repo.finalize(id, 'failed', { errors: plan.errors });

    const rendered = renderDokployPlan(plan.value, target.dokployConfig);
    if (!rendered.ok) return await deps.repo.finalize(id, 'failed', { errors: rendered.errors });
    await deps.repo.setRenderedDigest(id, rendered.value.digest);

    const client = deps.dokployClientFactory(target);    // decrypts apiToken, closes over it
    const result = await applyDokployPlan(rendered.value, client);
    if (!result.ok) return await deps.repo.finalize(id, 'failed', { errors: result.errors });
    await deps.repo.setApplyResult(id, result.value);

    const verification = await deps.smoker.verify(result.value);
    const status = verification.ok ? 'succeeded'
                 : verification.partialOk ? 'succeeded_with_warnings'
                 : 'failed';
    await deps.repo.finalize(id, status, { verification });
  } catch (e) {
    await deps.repo.finalize(id, 'failed', {
      errorCode: 'DEPLOY_EXECUTOR_UNCAUGHT',
      errorMessage: redact(String(e)),
    });
  } finally {
    clearInterval(hb);
    if (tmpDir) await rmRecursive(tmpDir);
  }
}
```

Each step also calls `deps.repo.appendLog(id, level, step, message)` with redacted messages.

The executor is the single writer of decrypted Dokploy tokens. The plaintext token is materialized only inside `dokployClientFactory(target)` and closes over the resulting client per `deploy-dokploy` spec.

### 10.3 Lifecycle

```
queued ──► running ──┬──► succeeded
                     ├──► succeeded_with_warnings
                     ├──► failed
                     └──► failed_orphaned          (only via orphan-detect)
```

Terminal states are immutable. The CHECK constraint on `deployments` enforces `terminal ⇔ finished_at IS NOT NULL`.

### 10.4 Heartbeat + orphan detection

- Executor `touchHeartbeat(id)` every 5 s.
- On `platform-http` startup: scan once for `status IN ('queued','running') AND (last_heartbeat_at IS NULL OR last_heartbeat_at < now() - interval '60 seconds')` → finalize `failed_orphaned`, `error_code = DEPLOY_EXECUTOR_ORPHANED`.
- Background interval every 60 s repeats the scan to catch executor crashes during normal operation.

### 10.5 Smoke verification

`SmokeVerifier.verify(applyResult)` reads from `applyResult.verificationHints` (already emitted by `deploy-dokploy.applyDokployPlan` — `healthUrl`, `uiUrl?`, `publicRouteUrls[]`):

1. **Edge health** — HEAD on `verificationHints.healthUrl`. Timeout 5 s. Non-2xx → check fails.
2. **UI smoke** — when `verificationHints.uiUrl` exists: GET, expect 2xx + non-empty body. Timeout 10 s.
3. `verificationHints.publicRouteUrls` is recorded on the report for human inspection but not auto-checked in MVP.

Result:

```ts
type VerificationReport = {
  checks: Array<{ name: string; url: string; status: number | 'timeout' | 'error'; latencyMs: number; ok: boolean; note?: string }>;
  ok: boolean;       // all checks ok
  partialOk: boolean;// edge ok, ui (or other non-critical) failed
};
```

- `ok && partialOk=false` → status `succeeded`.
- `!ok && partialOk` → status `succeeded_with_warnings`.
- Edge health failed → status `failed`.

### 10.6 Read endpoints

- `GET /v1/projects/:slug/deployments?status=&limit=&cursor=` — list.
- `GET /v1/projects/:slug/deployments/:id` — full record.
- `GET /v1/projects/:slug/deployments/:id/logs?sinceLineId=` — `{ lines, lastLineId, isTerminal }`.

UI polls `/logs` every 2 s while `isTerminal=false`. SSE/WebSockets are not in MVP.

## 11. UI Surfaces

The platform UI is Hono JSX + htmx + Tailwind CDN (existing shell from `2026-04-21-platform-http-ui-design.md`).

### 11.1 Removed pages

- `/{org}/projects/{proj}/services/{svc}` — service detail.
- Service-list section on `/{org}/projects/{proj}` (replaced).

### 11.2 Updated page

`GET /{org}/projects/{proj}` — Project detail:

- Header: project name, slug, created/updated.
- Section **Versions** (latest first, page size 20):

  | Seq | Digest (short) | Services | Uploaded by | Uploaded |
- Section **Recent deployments** (latest 10): id (short), version seq, target, status badge, started, duration, started by.

### 11.3 New pages

- `GET /{org}/projects/{proj}/versions/{seq}` — Project Version detail.
  - Header: `#<seq>`, full digest, size, uploaded by/at.
  - Tabs: **Services** (from `summary.services`), **Routes** (from `summary.routes`), **Middleware** (from `summary.middleware` + `summary.mounts`).
  - Action: `[Download bundle]` → `/v1/projects/<slug>/versions/<seq>/bundle`.
  - Action: `[Deploy]` (when scope `deploy:execute`) → form modal:
    - `target` dropdown (default preselected).
    - `configOverrides` JSON textarea with structural validation.
    - `[Deploy]` → htmx POST → `303 → /deployments/<id>`.

- `GET /{org}/projects/{proj}/deployments` — Deployments list.
  - Filters: status (multi-select), target.
  - Table: id (short), version seq, target slug, status badge, started, duration, started by.

- `GET /{org}/projects/{proj}/deployments/{id}` — Deployment detail.
  - Header: animated status badge while running, version seq, target.
  - Section **Timeline**: queued / started / finished timestamps.
  - Section **Logs**: monospaced block, scroll-pinned, htmx polling `/logs?sinceLineId=` every 2 s. Stops polling on `isTerminal`.
  - Section **Configuration**: collapsed `configOverrides` JSON.
  - Section **Render plan digest** (after render).
  - Section **Apply result** (succeeded): `urls.publicRoutes` table with copy buttons; `urls.internalServices` list.
  - Section **Verification report**: checks table (name, url, status, latency, ok).
  - Section **Warnings** (if non-empty).
  - Section **Errors**: `error_code`, `error_message`, structured `errors[]`.
  - Action `[Redeploy this version]` — opens Deploy form pre-filled from this deployment's overrides.

- `GET /{org}/deploy-targets` — Deploy Targets list.
  - Table: slug, display name, kind, dokploy URL, default badge, created.
  - Action `[+ New target]` (when `deploy:target:manage`) → create form.
  - Per-row actions (when `deploy:target:manage`): edit, set default, rotate token, delete.

- `GET /{org}/deploy-targets/{tslug}` — Target detail/edit form.
  - Read-only redacted token, `[Rotate]` modal taking new `apiToken`.
  - Editable: display_name, dokploy URL, project_id/name + `allow_create_project`, event_bus, policy_values.
  - `[Set as default]` action.

### 11.4 Nav

Sidebar gains **Deploy Targets** alongside existing **Projects / Tokens / Audit**.

## 12. CLI Changes

### 12.1 Removed

- `rntme validate`
- `rntme publish`
- `rntme service create | list | show`
- `rntme version list | show`
- `rntme tag list | set | delete`

### 12.2 Kept

- `login`, `logout`, `whoami`, `init`
- `project create`, `project list`, `project show`
- `token create`, `token list`, `token revoke`
- `skills install`

### 12.3 New / rewritten

```
rntme project publish [--folder <path>] [--org <slug>] [--create-project] [--dry-run]
rntme project version list [--project <slug>]
rntme project version show <seq> [--project <slug>]
```

`rntme.json` is no longer a concept. `rntme init` is rewritten to scaffold a project blueprint folder (`project.json` + `services/app/...` skeleton). The skill source `composing-manifest.md` is replaced by `composing-blueprint.md`. The skill source `publishing-via-rntme-cli.md` is rewritten for `project publish`.

## 13. Authorization

| Operation | Scope | Roles |
|---|---|---|
| Upload project version (CLI / future UI form) | `version:publish` | admin, member |
| List / read project versions, targets, deployments | `project:read` | admin, member |
| Create / update / delete deploy target; rotate token; set default | `deploy:target:manage` (new) | admin |
| Trigger deployment | `deploy:execute` (new) | admin, member |

Machine tokens default to `version:publish` (CI publish flow). Add `deploy:execute` explicitly when CI also triggers deploys. Admin-only `deploy:target:manage` reflects credential-management sensitivity.

Existing `member:read` and `token:manage` are unchanged.

## 14. Validation Timing and Error Codes

### 14.1 Timing

| Step | Where | What |
|---|---|---|
| CLI publish | local | `loadComposedBlueprint(folder)` — fail-fast |
| Server upload | platform-http | Re-validate on materialized tmpdir (server is source of truth) |
| Idempotent digest match | platform-http | Returns existing row; bundle is not re-validated (already validated when first stored) |
| Deploy execute | executor | Re-validate composition + run `deploy-core` validation (production mode reject, missing event bus, missing policy values, etc.) |

### 14.2 New error code prefixes

| Prefix | Where | Examples |
|---|---|---|
| `CLI_BUNDLE_*` | CLI bundle build | `NON_JSON_FILE`, `MISSING_PROJECT_JSON`, `INVALID_JSON` |
| `PROJECT_VERSION_*` | platform upload route | `BUNDLE_TOO_LARGE`, `BUNDLE_PARSE_ERROR`, `BUNDLE_INVALID_SHAPE`, `BLUEPRINT_INVALID`, `DIGEST_MISMATCH` |
| `DEPLOY_TARGET_*` | platform target CRUD | `SLUG_TAKEN`, `INVALID_DOKPLOY_URL`, `TOKEN_REQUIRED`, `IN_USE` |
| `DEPLOY_REQUEST_*` | deploy POST | `TARGET_NOT_SPECIFIED`, `VERSION_NOT_FOUND`, `TARGET_NOT_FOUND`, `INVALID_OVERRIDES` |
| `DEPLOY_EXECUTOR_*` | runtime executor | `BLUEPRINT_REVALIDATION_FAILED`, `ORPHANED`, `UNCAUGHT`, `BLOB_FETCH_FAILED` |

Existing `DEPLOY_PLAN_*`, `DEPLOY_RENDER_DOKPLOY_*`, `DEPLOY_APPLY_DOKPLOY_*` from the `deploy-core` / `deploy-dokploy` spec are passed through unchanged.

## 15. Migration Plan

Single Drizzle migration. Pre-stable, no data preservation.

```sql
-- drop legacy (FK order)
DROP TABLE IF EXISTS artifact_tag CASCADE;
DROP TABLE IF EXISTS artifact_version CASCADE;
DROP TABLE IF EXISTS service CASCADE;

-- create new
CREATE TYPE deployment_status AS ENUM (
  'queued', 'running', 'succeeded', 'succeeded_with_warnings', 'failed', 'failed_orphaned'
);
CREATE TABLE project_version (...);
CREATE TABLE deploy_target (...);
CREATE TABLE deployment (...);
CREATE TABLE deployment_log_line (...);

-- RLS policies (per policies.sql pattern)
ALTER TABLE project_version ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON project_version USING (org_id = current_setting('rntme.org_id')::uuid);
-- ... same for deploy_target, deployment, deployment_log_line
```

(Drizzle table names are singular elsewhere in the schema — `project`, `service`, `artifact_version`. New tables follow the same convention: `project_version`, `deploy_target`, `deployment`, `deployment_log_line`. Repo / use-case names elsewhere in this spec use the plural for readability.)

Rustfs blobs of legacy service-version artifacts are not deleted by the migration. An optional cleanup script can be run separately and is out of scope.

### 15.1 Code drops

- `platform-core`: `repos/service-repo.ts`, `use-cases/services.ts`, `use-cases/publish-version.ts`, `use-cases/versions.ts`, `use-cases/tags.ts`, `validation/bundle.ts`, schema entities for service / version / tag, related tests.
- `platform-storage`: `pg-service-repo.ts`, `pg-tag-repo.ts`, `schema/projects.ts` (drop service / service_version / tag tables and FK columns), related tests.
- `platform-http`: `routes/services.ts`, `routes/versions.ts`, `ui/pages/service.tsx`, service-list section in `ui/pages/project.tsx`, tag rendering.
- `cli`: `commands/service/`, `commands/version/`, `commands/tag/`, `commands/validate.ts`, `commands/publish.ts` (legacy form).
- `cli/src/skills/sources/composing-manifest.md` → `composing-blueprint.md` (content rewrite).
- `cli/src/skills/sources/publishing-via-rntme-cli.md` rewrite for `project publish`.

## 16. Testing

### 16.1 Unit

- `cli/src/commands/project/publish.ts` — bundle build correctness; canonical hash determinism across runs and OSes.
- `platform-core/use-cases/publish-project-version.ts` — happy path; duplicate-digest idempotency; blueprint validation rejection.
- `platform-core/use-cases/manage-deploy-target.ts` — CRUD; atomic default swap; in-use rejection on delete; api-token rotation.
- `platform-core/use-cases/start-deployment.ts` — happy path; missing default target; version not found; target not found; project mismatch.
- `platform-storage/repos/pg-deployment-repo.ts` (testcontainers PG) — lifecycle transitions; heartbeat update; find-stale-running.
- `platform-storage/secret-cipher.ts` — AES-GCM round-trip; tampered ciphertext rejection; unknown key version rejection.
- `platform-http/deploy/executor.ts` — full executor with fake `DokployClient`, fake `BlobStore`, fake `Smoker`. Scenarios: happy, blueprint revalidation fail, plan fail, render fail, apply partial-failure, smoke edge fail (failed), smoke ui-only fail (succeeded_with_warnings).
- `platform-http/deploy/smoke-verifier.ts` — edge ok + ui ok = ok; edge ok + ui fail = partialOk; edge fail = not ok.
- `platform-http/routes/projects.ts` (POST versions) — testcontainers; idempotent upload; scope enforcement; bundle parse / shape / blueprint errors.
- `platform-http/routes/deployments.ts` — POST 202; GET list / detail; GET logs incremental polling.

### 16.2 E2E

`platform-http/test/e2e/deploy.e2e.test.ts`:

1. Sign in as admin.
2. Create project.
3. Upload bundle (fixture: `packages/blueprint/test/fixtures/product-catalog-project`).
4. Create deploy target pointed at a mocked Dokploy server (Hono fixture in `test/fixtures/mock-dokploy.ts`).
5. POST `/deployments`.
6. Poll `/logs` until terminal.
7. Assert status `succeeded`, applied resources match expectations, smoke verification ok.
8. Re-deploy → idempotent (status `succeeded` again, no Dokploy `create` ops, only `unchanged` actions).

### 16.3 Manual smoke (PR validation)

Against the real Dokploy on `platform.rntme.com`:

1. `rntme login` (WorkOS).
2. `rntme project create demo`.
3. `cd demo-blueprint && rntme project publish`.
4. UI: Deploy Targets → create target with real Dokploy creds.
5. UI: Project → Versions → Deploy.
6. Wait for `succeeded`. Verify nginx edge URL returns 200; UI URL returns SPA HTML.

## 17. Documentation Touches

The CLAUDE.md mandate is that every plan must include a documentation-touch task. This spec drives the following:

- `AGENTS.md` — update package index for new repo / use-case / route additions; update §3 layering; update §6 how-tos with `project publish` and Deploy flow recipes; update glossary with project-version / deploy-target / deployment / canonical bundle.
- `README.md` — packages table changes (CLI commands shift; legacy commands removed).
- Per-package README updates: `platform-core`, `platform-storage`, `platform-http`, `cli`. New repo / use-case / route summaries; security notes for encryption.
- `CLAUDE.md` — Architecture in one paragraph: replace mention of service-version model with project-version + deploy.
- `docs/architecture.md` — architecture overview text and diagrams that referenced service-version.
- `vision.md` — only if buyer-facing wording changes; otherwise none.

Plan 1 lands the upload-track documentation; Plan 2 lands the deploy-track documentation. Each plan must record the documentation touches as explicit tasks.

## 18. Plan Split

Two implementation plans. Plan 2 depends on Plan 1.

### Plan 1 — Project Blueprint Upload Track

- Migration drop legacy + create `project_versions`.
- `platform-core`: `ProjectVersionRepo`, `publish-project-version` use-case, schemas.
- `platform-storage`: `pg-project-version-repo`, blob-store integration.
- `platform-http`: `POST /v1/projects/:slug/versions`, GET endpoints, UI Project detail update (versions + recent deployments stub), Project Version detail page (without Deploy form).
- `cli`: `project publish`, `project version list`, `project version show`, removal of legacy commands, `init` rewrite, skills sources rewrite.
- Documentation updates for upload track.

### Plan 2 — Deploy Targets + Deployment Execution Track

- Migration: create `deploy_targets`, `deployments`, `deployment_log_lines`, `deployment_status` enum.
- `platform-core`: `DeployTargetRepo`, `DeploymentRepo`, `SecretCipher`, `manage-deploy-target` + `start-deployment` use-cases.
- `platform-storage`: pg-repos, secret cipher with env key.
- `platform-http`: target CRUD routes; deployment POST / GET / logs; deploy executor; smoke verifier; orphan-detect background; UI Deploy Targets list/detail, Deployments list/detail with polling, Deploy form on Project Version detail page.
- E2E with mocked Dokploy fixture.
- Documentation updates for deploy track.

## 19. Why This Shape

Three responsibilities stay separate:

- `@rntme/blueprint` knows what a valid composed project is.
- `@rntme-cli/deploy-core` and `@rntme-cli/deploy-dokploy` know how to plan and apply a deploy.
- This spec adds the persistence + orchestration that connects user intent (CLI upload, UI button) to those libraries, and makes the result observable.

The spec deliberately keeps the executor in `platform-http` and the bundle as a single canonical-JSON blob. Both are reversible decisions: if the executor outgrows in-process hosting, extract to `@rntme-cli/deploy-runtime`; if blueprints gain binary assets, add a side-channel `assets` blob set keyed from the bundle. Neither change is needed for the user flow this spec describes.

The migration is a clean break — pre-stable, no users — to avoid carrying a per-service publish model that is incompatible with project-first composition validation. Future tags / diffs / multi-environment / production mode are recorded as follow-ups, not as half-implemented compatibility shims.
