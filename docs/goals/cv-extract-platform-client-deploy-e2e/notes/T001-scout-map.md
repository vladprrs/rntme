# T001 Scout — Repo + Plan State Map

Scout assignee: Scout. Read-only. Produced for PM to validate against plan
`docs/superpowers/plans/2026-05-13-cv-extract-platform-client-deploy-e2e.md`.

## Headline

Plan vs code shows significant drift centered on:

- `demo/cv-extract-blueprint` still declares `services: ["app","marketing"]` with
  S3-sourced marketing; plan needs `["app","openrouter","storage-s3"]` and
  `project-folder` marketing source.
- Task 1 schema work is partially landed: blueprint already accepts
  `kind: "integration-module"` and exposes `moduleKey`, but downstream
  `to-deploy-core-input.ts` does not yet preserve `moduleKey`, and
  `platform-core` deploy-target schema has not been broadened.
- Task 6 platform-native publish API is missing. Current `publishProjectVersion`
  is a Graph IR binding that requires the client to pre-compute `bundleDigest`
  + `bundleObjectKey`; there is no `bodyBytes`/`NativeOperationExecutor`
  plumbing.
- Task 7 CLI target endpoints still hit legacy `/v1/orgs/:org/deploy-targets`.
- Env has `OPENROUTER` (single key). Plan + Task 8 live smoke reference
  `OPENROUTER_API_KEY`. The OpenRouter module server reads
  `process.env.OPENROUTER_API_KEY`.
- All 18 plan-referenced packages exist with valid `@rntme/<pkg>` filter names.
- GoalBuddy agents are installed at `~/.claude/agents/`. `state.yaml`'s
  `bundled_not_installed` claim is wrong; correct to `installed`.

## Plan-task drift classification

| # | Task | Status | Evidence |
|---|------|--------|----------|
| 1 | Integration aliases + target module config semantics | partial | `packages/artifacts/blueprint/src/parse/schema.ts` accepts `kind: 'integration-module'` and `types/artifact.ts` exposes `moduleKey`; `packages/platform/deploy-bundle-input/src/to-deploy-core-input.ts` does NOT propagate `moduleKey`; `platform-core` deploy-target schema has no catchall; `deploy-core` `buildWorkloads`/`DEPLOY_PLAN_MISSING_MODULE_IMAGE` not present. |
| 2 | `demo/cv-extract-blueprint` valid + deployable | missing/drift | `project.json` services=`['app','marketing']`, marketing `source.kind='s3'` (not `project-folder`), no `services/openrouter` or `services/storage-s3` dirs, no `services/app/storage.json`, `Resume.json` lacks `fileId/objectKey/downloadUrl`, `bindings.json` only `extractResume(fileBase64)` + `getResume`, `extractResume` graph passes base64 to openrouter (not download URL via `storage.GetDownloadUrl`). |
| 3 | Runtime manifests for Graph IR module calls | missing | `packages/platform/deploy-bundle-input/src/` has only `index.ts` + `to-deploy-core-input.ts`; no `runtime-module-wiring.ts` or `contract-protos.ts`. `to-deploy-core-input.ts` inlines a hand-written `IDENTITY_INTROSPECTION_PROTO` instead of reading from `packages/contracts/*/v1/proto/`. |
| 4 | Marketing project-folder bundles | missing | `packages/contracts/marketing-site/v1/src/schema.ts` `BundleSourceSchema` is discriminated union of only `S3SourceSchema` + `LocalPathSourceSchema`; no `ProjectFolderSourceSchema`. `apps/cli/src/bundle/` has only `build.ts` + `collect-assets.ts`; no `project-folder-assets.ts`. |
| 5 | Move static hosting to target adapter | missing | `modules/marketing-site/static-html/src/` still has `build-image.ts`, `dokploy-upsert.ts`, `s3-fetch.ts` (target-coupled provisioner); no `materialized-project-asset` or `static-site-v1` output kind. `deploy-runner` `project-assets.ts` not present. |
| 6 | Platform-native publish/deploy APIs | missing/drift | `apps/platform/blueprint/services/projects/bindings/bindings.json` `publishProjectVersion` is a Graph binding requiring client-supplied `bundleDigest+bundleObjectKey` (NOT raw bytes). No `operations.json`/`handlers/` in projects or deployments services; only `tokens/operations.json` exists with `kind: 'native'` pattern. No `NativeOperationExecutor` in `packages/runtime/runtime/src/plugins/executors/`. No `inputFrom.bodyBytes` in bindings. |
| 7 | CLI platform-client flow + fake e2e | partial/drift | `apps/cli/src/api/client.ts` already uses `deployments: '/api/deployments'` and `deployTargets: '/api/deployments/targets'` constants; `publish.ts` sends raw bytes via `application/rntme-project-bundle+json`. BUT `apps/cli/src/api/target-endpoints.ts` still hits legacy `/v1/orgs/<org>/deploy-targets` for list/show/create/update/delete. No `platform-client-cv-extract.test.ts` under `apps/cli/test/integration/`. |
| 8 | Gated live CV extract deploy smoke | missing | `demo/cv-extract-blueprint/test/` has only `landing-deploy.test.ts` + `integration/extract.test.ts`; no `test/live/platform-client-deploy.test.ts`; no `scripts/smoke-cv-extract.ts`; `package.json` scripts only define `test` (no `test:live` or `smoke`). |
| 9 | Owner docs + decision canon | partial | Owner docs exist for most targeted surfaces (`docs/current/owners/demo/cv-extract-blueprint.md`, `apps/cli.md`, `apps/platform.md`, `packages/artifacts/bindings.md`, `blueprint.md`, `deploy-core.md`, `deploy-runner.md`, `deploy-dokploy.md`, `runtime/runtime.md`, `modules/marketing-site.md`, `packages/contracts/marketing-site.md`, `modules/storage.md`). Content updates not yet applied. `packages/platform/deploy-bundle-input.md` not verified present. |
| 10 | Full verification + deployment handoff | blocked-by-others | Root `package.json` defines `build`, `test`, `typecheck`, `lint`, `depcruise`, `vendor:check`. |

## Env keys present (names only)

`AUTH0_DOMAIN`, `AUTH0_MANAGEMENT_AUDIENCE`, `AUTH0_MANAGEMENT_CLIENT_ID`,
`AUTH0_MANAGEMENT_CLIENT_SECRET`, `DOKPLOY_API_KEY`, `DOKPLOY_URL`, `OPENROUTER`,
`RNTME_TOKEN`.

### Env concerns

- **OPENROUTER vs OPENROUTER_API_KEY**: `.env` has `OPENROUTER`;
  `modules/ai-llm/openrouter/src/bin/server.ts:13` reads
  `process.env.OPENROUTER_API_KEY`; Task 8 live test requires
  `OPENROUTER_API_KEY`. Resolution: alias `OPENROUTER→OPENROUTER_API_KEY` at
  deploy-target secret-ref level, or rename the local `.env` key. **Judge to
  decide.**
- No S3/rustfs access keys in `.env` (Task 8 expects `rustfs-access-key` +
  `rustfs-secret-key` as secret refs); these must come from Dokploy/platform
  secret store, not local `.env`.
- No platform admin/runtime token besides `RNTME_TOKEN`; live smoke needs
  `RNTME_PLATFORM_TOKEN` — likely same value.

## Dirty worktree

### Unrelated — preserve

- `platform.target.json` (`runtimeImage` bump
  `runtime-e2e-8707e652-052054` → `runtime-e2e-45ae3358-055759`)
- `.rntme-platform-redeploy-2026-05-12-auth-callback-v2.jsonl`
- `.rntme-platform-redeploy-2026-05-12-auth-callback.jsonl`
- `.rntme-platform-redeploy-2026-05-12.jsonl`
- `.rntme-platform-redeploy-2026-05-13-styles.jsonl`
- `.rntme-platform-redeploy-2026-05-13.jsonl`
- `apps/platform/blueprint/.rntme-ui-build/`
- `.clone/` (worktrees)

### This-goal-only

- `docs/goals/cv-extract-platform-client-deploy-e2e/` (state + charter)
- `docs/superpowers/plans/2026-05-13-cv-extract-platform-client-deploy-e2e.md`

## Platform / Dokploy access paths

- **Platform URL**: `https://platform.rntme.com`
  (`platform.target.json publicBaseUrl`)
- **Platform API**: HTTP via `apps/cli` using `RNTME_TOKEN`; deploy at
  `/api/deployments`, target at `/v1/orgs/:org/deploy-targets` (legacy) or
  `/api/deployments/targets` (new).
- **Target file**: `platform.target.json`.
- **Auth0**: domain `demo-rntme.us.auth0.com`, audience
  `https://platform.rntme.com/api`, redirect `https://platform.rntme.com/auth/callback`.
- **Dokploy URL**: `https://dokploy.vladpr.com` (`platform.target.json
  config.dokployUrl`).
- **Dokploy MCP**: available at `~/.local/dokploy-mcp-patched/`; remember
  `DOKPLOY_URL` must be host WITHOUT `/api` (MCP appends).
- **Dokploy project id**: `wmiyt_0T7SKvS3sr6rzGK`.
- **Latest applied environmentId**: `Ac5KIPWva9jzm7t-h4Af7`.
- **Platform Auth0 SPA client id**: `AjOMyNUPyuJpkCf4RR8izh9z84wGHqXE`.
- **Platform Auth0 resource server id**: `6a016f0e49ae70022e03ce99`.

## Auth0 / dashboard access path

- `apps/platform/blueprint/services/organizations/graphs/listOrganizations.json`
  + `createOrganization.json` call `identity-auth0.IntrospectSession` /
  module.
- `apps/platform/blueprint/pdm/entities/Membership.json` maps
  `organizationId ↔ accountId ↔ role`.
- Dashboard access is gated by Auth0 org membership intersected with platform
  `Membership` rows.
- `apps/platform/ui-module/src` (post #209 design system, post #208 Auth0 SPA
  flow) does NOT yet contain a project-listing or deployment-detail React
  surface bound to `/api/projects` or `/api/deployments`. **Dashboard
  visibility for "projects in org X" likely needs a UI Worker task even
  after Task 6 lands the data.**

## Existing demo state

Present: `project.json` (services=[app,marketing]),
`services/app/{graphs,bindings,pdm,qsm,seed,service.json}`,
`landing/{index.html,styles.css}`, `test/landing-deploy.test.ts`,
`test/integration/extract.test.ts`.

Missing: `services/openrouter/service.json`, `services/storage-s3/service.json`,
`services/app/storage.json`, `graphs/prepareResumeFileUpload.json`,
`graphs/commitResumeFileUpload.json`, `test/live/platform-client-deploy.test.ts`,
`scripts/smoke-cv-extract.ts`, `test:live` + `smoke` npm scripts.

## Agent availability

- `goal-scout`: **installed** (`~/.claude/agents/goal-scout.md`)
- `goal-judge`: **installed** (`~/.claude/agents/goal-judge.md`)
- `goal-worker`: **installed** (`~/.claude/agents/goal-worker.md`)
- `state.yaml agents.*` block currently claims `bundled_not_installed`;
  correct to `installed`.

## Recommended first Worker

T003 (integration aliases + module config semantics). It is the schema seam
all later tasks depend on.

## Suggested parallelization waves

1. `[T003]` — blueprint/deploy-bundle-input/deploy-core/platform-core schema
   seam (sequential — everything depends on it).
2. `[T004, T006]` — demo cv-extract (`demo/cv-extract-blueprint/**`) AND
   platform native publish API (`apps/platform/blueprint/**`,
   `packages/runtime/runtime/**`, `packages/artifacts/bindings/**`) have
   disjoint allowed_files.
3. `[T005]` — runtime module wiring; depends on T003 `moduleKey` propagation.
4. `[T007, T008]` — CLI flow (`apps/cli/**`) and gated live smoke
   (`demo/cv-extract-blueprint/**` + `.github/workflows/ci.yml`) disjoint.
5. `[T009]` — docs.
6. `[T010, T011]` — full local verification, sequential.
7. `[T012]` — live deploy.

## Anticipated blockers / risks

- `OPENROUTER` env name mismatch: needs rename or secret-ref remap.
- Task 6 requires both new `operations.json`/`handlers/` AND a
  `NativeOperationExecutor` plus `inputFrom.bodyBytes` runtime change — wider
  than `platform-blueprint` scope; risks two-package coordination Worker.
- Task 7 must DELETE legacy `/v1/orgs/:org/deploy-targets` from
  `target-endpoints.ts`; fake e2e test should enforce.
- Dashboard access for `vladprsib`/`org_uZUWhpWgK54VWC2X` may need an Auth0
  Management API org-membership ensure step OR a platform `Membership` row
  insert; T012 should include this as a tiny seed step.
- `platform.target.json` is dirty with unrelated `runtimeImage` bump;
  preserve through all commits.
- `state.yaml agents.*` claims `bundled_not_installed`; PM must correct to
  `installed` or board-status auditor will mis-route.

## Evidence

`AGENTS.md`, `CLAUDE.md`,
`docs/superpowers/plans/2026-05-13-cv-extract-platform-client-deploy-e2e.md`,
`docs/goals/cv-extract-platform-client-deploy-e2e/{goal.md,state.yaml}`,
`packages/artifacts/blueprint/src/parse/schema.ts`,
`packages/artifacts/blueprint/src/types/artifact.ts`,
`packages/artifacts/blueprint/src/validate/{structural.ts,composition.ts}`,
`packages/artifacts/blueprint/src/load/load-blueprint.ts`,
`packages/artifacts/blueprint/src/compose/load-composed-blueprint.ts`,
`packages/platform/deploy-bundle-input/src/to-deploy-core-input.ts`,
`packages/platform/platform-core/src/schemas/deploy-target.ts`,
`packages/contracts/marketing-site/v1/src/schema.ts`,
`modules/marketing-site/static-html/src/`,
`modules/ai-llm/openrouter/src/bin/server.ts`,
`demo/cv-extract-blueprint/project.json`,
`demo/cv-extract-blueprint/services/app/graphs/extractResume.json`,
`demo/cv-extract-blueprint/services/app/bindings/bindings.json`,
`demo/cv-extract-blueprint/package.json`,
`demo/cv-extract-blueprint/test/landing-deploy.test.ts`,
`demo/cv-extract-blueprint/test/integration/extract.test.ts`,
`apps/cli/src/api/{client.ts,endpoints.ts,target-endpoints.ts}`,
`apps/cli/src/commands/project/publish.ts`,
`apps/cli/src/bundle/`,
`apps/platform/blueprint/services/projects/bindings/bindings.json`,
`apps/platform/blueprint/services/projects/graphs/publishProjectVersion.json`,
`apps/platform/blueprint/services/deployments/bindings/bindings.json`,
`apps/platform/blueprint/services/tokens/operations.json`,
`apps/platform/blueprint/services/organizations/graphs/listOrganizations.json`,
`apps/platform/blueprint/pdm/entities/Membership.json`,
`apps/platform/ui-module/src/components.tsx`,
`packages/runtime/runtime/src/plugins/executors/`,
`packages/contracts/{ai-llm,storage,_common}/v1/proto/*.proto`,
`platform.target.json`,
`.rntme-platform-redeploy-2026-05-13.jsonl`,
`.env`,
`~/.claude/agents/{goal-scout.md,goal-judge.md,goal-worker.md}`,
`package.json`.
