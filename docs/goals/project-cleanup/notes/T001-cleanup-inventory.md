# T001 Cleanup Inventory

Status: Scout inventory, read-only.

## Commands Run

- `node /home/coder/.shared-config/codex/plugins/cache/goalbuddy/goalbuddy/0.3.6/skills/goalbuddy/scripts/check-update.mjs --json`
- `node /home/coder/.shared-config/codex/plugins/cache/goalbuddy/goalbuddy/0.3.6/skills/goalbuddy/scripts/check-goal-state.mjs docs/goals/project-cleanup/state.yaml`
- `git status --short`
- `git status --ignored --short`
- `git ls-files --others --exclude-standard`
- `git ls-files 'docs/superpowers/**' 'docs/history/plans/**' 'docs/history/specs/**'`
- `find docs -path '*superpowers*' -type f`
- `find docs -type f \( -path '*/plans/*' -o -path '*/plan/*' -o -name '*plan*' \)`
- `rg -n "docs/superpowers/plans/" --glob '!docs/superpowers/plans/**' --glob '!docs/goals/project-cleanup/**'`
- `rg -n "docs/superpowers/specs/" --glob '!docs/superpowers/specs/**' --glob '!docs/superpowers/plans/**' --glob '!docs/goals/project-cleanup/**'`
- `rg -n "\.rntme-ui-build|rntme-ui-build|goalbuddy-board|\.rntme-platform|\.rntme-cv-extract|\.clone/|\.clone" . --glob '!docs/goals/project-cleanup/**' --glob '!node_modules/**' --glob '!**/dist/**' --glob '!**/build/**' --glob '!**/.goalbuddy-board/**' --glob '!demo/cv-extract-blueprint/.rntme-ui-build/**'`

GoalBuddy update check returned current version `0.3.6`, latest `0.3.6`, no update available.
GoalBuddy state checker passed with warnings only for bundled-but-not-installed Scout/Worker/Judge agents.

## Dirty Worktree Safety

Pre-existing modified tracked files outside this goal:

- `apps/platform/blueprint/services/app/ui/layouts/main.spec.json`
- `apps/platform/blueprint/services/app/ui/screens/api.spec.json`
- `apps/platform/blueprint/services/app/ui/screens/audit.spec.json`
- `apps/platform/blueprint/services/app/ui/screens/data-model.spec.json`
- `apps/platform/blueprint/services/app/ui/screens/deployment.spec.json`
- `apps/platform/blueprint/services/app/ui/screens/deployments.spec.json`
- `apps/platform/blueprint/services/app/ui/screens/graph.spec.json`
- `apps/platform/blueprint/services/app/ui/screens/project-version.spec.json`
- `apps/platform/blueprint/services/app/ui/screens/ui.spec.json`
- `apps/platform/blueprint/test/platform-ui.test.ts`
- `apps/platform/ui-module/src/components.tsx`
- `apps/platform/ui-module/test/components.test.tsx`
- `demo/notes-blueprint/node_modules/rntme_identity_auth0/module.json`
- `docs/current/owners/apps/platform.md`
- `docs/goals/platform-full-ux-scenarios/state.yaml`

These are protected as unrelated user/in-flight work unless a later Judge task explicitly includes them.

## Delete Candidates

### Superpowers plan files

These 19 tracked files are exact matches for the user's "delete Superpowers plans" requirement. They are implementation plans under `docs/superpowers/plans/**`, not specs:

- `docs/superpowers/plans/2026-05-08-project-lifecycle-init-foundation.md`
- `docs/superpowers/plans/2026-05-08-provisioned-rustfs-storage.md`
- `docs/superpowers/plans/2026-05-09-bun-first-toolchain-migration.md`
- `docs/superpowers/plans/2026-05-09-dokploy-single-compose-deploy.md`
- `docs/superpowers/plans/2026-05-09-platform-blueprint-foundation.md`
- `docs/superpowers/plans/2026-05-09-platform-deployments-service.md`
- `docs/superpowers/plans/2026-05-09-platform-identity-auth0.md`
- `docs/superpowers/plans/2026-05-09-platform-runtime-cutover.md`
- `docs/superpowers/plans/2026-05-09-platform-ui-artifact.md`
- `docs/superpowers/plans/2026-05-10-bearer-token-validation-to-services-tokens.md`
- `docs/superpowers/plans/2026-05-10-bpmn-orchestrated-deploy-services-deployments.md`
- `docs/superpowers/plans/2026-05-10-cli-direct-mode.md`
- `docs/superpowers/plans/2026-05-10-deploy-runner-extraction.md`
- `docs/superpowers/plans/2026-05-10-lift-http-middleware-to-runtime.md`
- `docs/superpowers/plans/2026-05-10-platform-http-deletion.md`
- `docs/superpowers/plans/2026-05-11-sustained-cutover-thin-platform.md`
- `docs/superpowers/plans/2026-05-12-module-client-ui-design-system.md`
- `docs/superpowers/plans/2026-05-13-cv-extract-platform-client-deploy-e2e.md`
- `docs/superpowers/plans/2026-05-13-platform-multi-provider-edge-auth.md`

Required reference cleanup if deleted:

- Current docs with live plan references: `docs/decision-system.md`, `docs/current/owners/packages/deploy/deploy-runner.md`.
- Goal/history references with point-in-time provenance: `docs/goals/bun-first-toolchain-migration/**`, `docs/goals/cv-extract-platform-client-deploy-e2e/**`, `docs/goals/cv-extract-platform-client-auth0-bootstrap-e2e/**`, `docs/goals/platform-cli-dokploy-e2e/state.yaml`.
- Recommendation: update current docs in the same Worker batch; treat old GoalBuddy receipts as historical/defer unless the Judge requires all historical references to be scrubbed.

### Untracked runtime/deploy JSONL logs

There are 73 untracked root-level `.rntme*.jsonl` files totaling about 339 KiB. They are deployment/direct-run logs referenced by old GoalBuddy receipts, not tracked source:

- `.rntme-cv-extract-direct-T040-retry1.jsonl`
- `.rntme-cv-extract-direct-T040-retry2.jsonl`
- `.rntme-cv-extract-direct-T040-retry3.jsonl`
- `.rntme-cv-extract-direct-T040-retry4.jsonl`
- `.rntme-cv-extract-direct-T040-retry5.jsonl`
- `.rntme-cv-extract-direct-T040-retry6.jsonl`
- `.rntme-cv-extract-direct-T040-retry7.jsonl`
- `.rntme-cv-extract-direct-T040-retry8.jsonl`
- `.rntme-cv-extract-direct-T040-retry9.jsonl`
- `.rntme-cv-extract-direct-T040-retry10.jsonl`
- `.rntme-cv-extract-direct-T040-retry11.jsonl`
- `.rntme-cv-extract-direct-T040-retry12.jsonl`
- `.rntme-cv-extract-direct-T040-retry13.jsonl`
- `.rntme-cv-extract-direct-T040-retry14.jsonl`
- `.rntme-cv-extract-direct-T040-retry15.jsonl`
- `.rntme-cv-extract-direct-T040-retry16.jsonl`
- `.rntme-cv-extract-direct-T040-retry17.jsonl`
- `.rntme-cv-extract-direct-T040-retry19.jsonl`
- `.rntme-cv-extract-direct-T040-retry20.jsonl`
- `.rntme-platform-redeploy-2026-05-12.jsonl`
- `.rntme-platform-redeploy-2026-05-12-auth-callback.jsonl`
- `.rntme-platform-redeploy-2026-05-12-auth-callback-v2.jsonl`
- `.rntme-platform-redeploy-2026-05-13.jsonl`
- `.rntme-platform-redeploy-2026-05-13-styles.jsonl`
- `.rntme-platform-redeploy-2026-05-13-T012.jsonl`
- `.rntme-platform-redeploy-2026-05-13-T033.jsonl`
- `.rntme-platform-redeploy-2026-05-13-T033-retry1.jsonl`
- `.rntme-platform-redeploy-2026-05-13-T036.jsonl`
- `.rntme-platform-redeploy-2026-05-13-T038.jsonl`
- `.rntme-platform-redeploy-2026-05-13-T038-retry1.jsonl`
- `.rntme-platform-redeploy-2026-05-13-T038-retry2.jsonl`
- `.rntme-platform-redeploy-2026-05-14-dashboard-overview.jsonl`
- `.rntme-platform-redeploy-2026-05-14-platform-ux.jsonl`
- `.rntme-platform-redeploy-2026-05-14-platform-ux-v2.jsonl`
- `.rntme-platform-redeploy-2026-05-14-T003-auth-subrequest-bodylimit.jsonl`
- `.rntme-platform-redeploy-2026-05-14-T003-bodylimit.jsonl`
- `.rntme-platform-redeploy-2026-05-14-T003-bpmn-worker-deployrunner-image.jsonl`
- `.rntme-platform-redeploy-2026-05-14-T003-bpmn-worker-poll-image.jsonl`
- `.rntme-platform-redeploy-2026-05-14-T003-bundled-provisioner-assets.jsonl`
- `.rntme-platform-redeploy-2026-05-14-T003-edge-bodylimit.jsonl`
- `.rntme-platform-redeploy-2026-05-14-T003-project-operations-qsm.jsonl`
- `.rntme-platform-redeploy-2026-05-14-T003-publish-runtime.jsonl`
- `.rntme-platform-redeploy-2026-05-14-T003-redpanda-worker-command.jsonl`
- `.rntme-platform-redeploy-2026-05-14-T003-redpanda-worker-command-v2.jsonl`
- `.rntme-platform-redeploy-2026-05-14-T003-runtime-deployments.jsonl`
- `.rntme-platform-redeploy-2026-05-14-T003-runtime-deployments-key-rotate.jsonl`
- `.rntme-platform-redeploy-2026-05-14-T003-runtime-log-ids.jsonl`
- `.rntme-platform-redeploy-2026-05-14-T003-rustfs-env-runtime-image.jsonl`
- `.rntme-platform-redeploy-2026-05-14-T003-session-target-list.jsonl`
- `.rntme-platform-redeploy-2026-05-14-T003-shared-control-data.jsonl`
- `.rntme-platform-redeploy-2026-05-14-T003-shared-qsm-separate-events.jsonl`
- `.rntme-platform-redeploy-2026-05-14-T003-shared-qsm-separate-events-v2.jsonl`
- `.rntme-platform-redeploy-2026-05-14-T003-target-body-inputfrom.jsonl`
- `.rntme-platform-redeploy-2026-05-14-T003-target-list-v2.jsonl`
- `.rntme-platform-redeploy-2026-05-14-T003-workflow-infra.jsonl`
- `.rntme-platform-redeploy-2026-05-14-T009-org-auth.jsonl`
- `.rntme-platform-redeploy-2026-05-14-T013-org-selfheal.jsonl`
- `.rntme-platform-redeploy-2026-05-14-T018-datatable-fix.jsonl`
- `.rntme-platform-redeploy-2026-05-14-T025-navigation.jsonl`
- `.rntme-platform-redeploy-2026-05-14-T027.jsonl`
- `.rntme-platform-redeploy-2026-05-14-T027-v2.jsonl`
- `.rntme-platform-redeploy-2026-05-14-T027-v3.jsonl`
- `.rntme-platform-redeploy-2026-05-14-T027-v4.jsonl`
- `.rntme-platform-redeploy-2026-05-14-T027-v5.jsonl`
- `.rntme-platform-redeploy-2026-05-14-T027-v6.jsonl`
- `.rntme-platform-redeploy-2026-05-14-T029.jsonl`
- `.rntme-platform-redeploy-2026-05-15-dashboard-overview.jsonl`
- `.rntme-platform-redeploy-2026-05-15-dashboard-overview-v2.jsonl`
- `.rntme-platform-redeploy-2026-05-15-data-model-explorer.jsonl`
- `.rntme-platform-up-2026-05-15-api-explorer.jsonl`
- `.rntme-platform-up-2026-05-15-platform-nav-crosslinks.jsonl`
- `.rntme-platform-up-2026-05-15-platform-nav-crosslinks-v2.jsonl`
- `.rntme-platform-up-2026-05-15-platform-nav-crosslinks-v3.jsonl`

Recommendation: delete these in a generated-artifact cleanup batch after preserving any evidence already summarized in GoalBuddy receipts. Add `.rntme*.jsonl` to `.gitignore` to prevent recurrence.

### Generated UI build output

Untracked generated files under `demo/cv-extract-blueprint/.rntme-ui-build/`:

- `demo/cv-extract-blueprint/.rntme-ui-build/__rntme_ui_entry.tsx`
- `demo/cv-extract-blueprint/.rntme-ui-build/main.js`
- `demo/cv-extract-blueprint/.rntme-ui-build/chunks/__rntme_ui_entry-3rmf78yz.js`
- `demo/cv-extract-blueprint/.rntme-ui-build/chunks/__rntme_ui_entry-chw4azqw.js`
- `demo/cv-extract-blueprint/.rntme-ui-build/chunks/__rntme_ui_entry-kqsbwtnf.js`
- `demo/cv-extract-blueprint/.rntme-ui-build/chunks/index-heh1vp2j.js`
- `demo/cv-extract-blueprint/.rntme-ui-build/chunks/index-jqwsswp0.js`
- `demo/cv-extract-blueprint/.rntme-ui-build/chunks/operations-rtxqfnmx.js`

Evidence: `packages/platform/deploy-bundle-input/src/to-deploy-core-input.ts` writes `.rntme-ui-build`, and `apps/cli/src/deploy-engine/load-blueprint.ts` excludes `.rntme-ui-build` from blueprint loading. Recommendation: delete the untracked directory and add `.rntme-ui-build/` to `.gitignore`.

### Generated GoalBuddy board output

Untracked generated files under a prior goal's `.goalbuddy-board/`:

- `docs/goals/cv-extract-platform-client-deploy-e2e/.goalbuddy-board/app.js`
- `docs/goals/cv-extract-platform-client-deploy-e2e/.goalbuddy-board/goalbuddy-mark.png`
- `docs/goals/cv-extract-platform-client-deploy-e2e/.goalbuddy-board/index.html`
- `docs/goals/cv-extract-platform-client-deploy-e2e/.goalbuddy-board/styles.css`

Recommendation: delete the generated board directory and add `.goalbuddy-board/` to `.gitignore`.

### Duplicate `.clone` worktree artifact

Untracked duplicate file:

- `.clone/worktrees/platform-deployments-service/apps/platform/blueprint/pdm/entities/DeploymentLogLine.json`

Evidence: it is byte-identical to tracked `apps/platform/blueprint/pdm/entities/DeploymentLogLine.json` (`cmp` exit `0`) and earlier GoalBuddy receipts already treated `.clone/**` as unrelated staging noise. Recommendation: delete `.clone/` and add `.clone/` to `.gitignore`.

## Move Candidates

### Preserve Superpowers specs by moving them into history

These 10 tracked files are specs and must not be deleted:

- `docs/superpowers/specs/2026-05-08-project-lifecycle-init-design.md`
- `docs/superpowers/specs/2026-05-08-provisioned-rustfs-storage-design.md`
- `docs/superpowers/specs/2026-05-09-bun-first-toolchain-migration-design.md`
- `docs/superpowers/specs/2026-05-09-dokploy-single-compose-deploy-design.md`
- `docs/superpowers/specs/2026-05-09-platform-as-blueprint-design.md`
- `docs/superpowers/specs/2026-05-10-cli-universal-deploy-and-platform-http-removal-design.md`
- `docs/superpowers/specs/2026-05-11-sustained-cutover-thin-platform-design.md`
- `docs/superpowers/specs/2026-05-12-module-client-ui-design-system-design.md`
- `docs/superpowers/specs/2026-05-13-cv-extract-platform-client-deploy-e2e-design.md`
- `docs/superpowers/specs/2026-05-13-platform-multi-provider-edge-auth-design.md`

No filename conflicts were found under `docs/history/specs/active-rationale/`, `docs/history/specs/historical/`, `docs/history/specs/autonomous/`, or `docs/history/specs/retired/`.

Rationale for move: `docs/README.md` and `AGENTS.md` define specs/plans lifecycle under `docs/history/**`; neither mentions `docs/superpowers/**`. These recent design specs still explain current decisions, so `docs/history/specs/active-rationale/` is the likely destination. A move batch must add the required history banner to any moved spec that lacks one and update references.

Current docs that must be updated if specs move:

- `docs/decision-system.md`
- `docs/current/owners/apps/platform.md`
- `docs/current/owners/packages/artifacts/init.md`
- `docs/current/owners/packages/deploy/deploy-runner.md`

Goal/history references also exist in:

- `docs/goals/cv-extract-platform-client-deploy-e2e/state.yaml`
- `docs/goals/dokploy-platform-e2e-deploy/state.yaml`
- `docs/goals/dokploy-platform-e2e-deploy/notes/T002-judge-receipt.md`
- `docs/goals/platform-cli-dokploy-e2e/goal.md`
- `docs/goals/platform-cli-dokploy-e2e/state.yaml`

Recommendation: perform the spec move as a second docs batch unless the Judge decides to combine it with plan deletion.

## Keep / Protected

- `docs/history/specs/**`: explicit goal constraint says specs are preserved.
- `docs/history/plans/**`: historical plans are protected by `AGENTS.md` and `docs/README.md`; a 2026-05-07 retirement audit explicitly retained historical plans as execution context with banners.
- `docs/adr/**`, `docs/audit/**`, `docs/gaps/**`, `docs/research/**`: protected historical/rationale surfaces by the goal.
- Lockfiles, package configs, snapshots/fixtures, generated-but-committed artifacts, and vendor metadata: protected by goal constraints.
- Tracked vendored demo metadata under `apps/platform/blueprint/node_modules/rntme_identity_auth0/*` and `demo/notes-blueprint/node_modules/rntme_identity_auth0/*`: intentionally tracked vendor metadata; do not delete as ordinary `node_modules` noise.
- `docs/goals/project-cleanup/**`: current GoalBuddy control files.

## Defer

- Untracked done GoalBuddy goals:
  - `docs/goals/cv-extract-platform-client-auth0-bootstrap-e2e/`
  - `docs/goals/platform-data-model-explorer/`
  - `docs/goals/platform-navigation-crosslinks-ux/`
  - `docs/goals/platform-project-dashboard-overview/`

  These all have `status: done` and `active_task: null`, but they may be useful handoff/receipt artifacts. Defer deletion or tracking decisions to a Judge/PM task.

- Existing modified tracked files listed in "Dirty Worktree Safety". Defer; do not touch without explicit allowed files.

## Recommended First Cleanup Batch

Recommended first Worker package: a docs cleanup batch centered on the explicit user requirement.

Scope:

1. Delete the 19 tracked files under `docs/superpowers/plans/**`.
2. Update current docs that point to those plan files: at minimum `docs/decision-system.md` and `docs/current/owners/packages/deploy/deploy-runner.md`.
3. Leave `docs/superpowers/specs/**` untouched in this first package unless the Judge deliberately chooses the larger combined docs reorganization.
4. Verify with `rg -n "docs/superpowers/plans/" docs/decision-system.md docs/current docs/README.md AGENTS.md README.md CLAUDE.md` and `git diff --check`.

Risk notes:

- Historical GoalBuddy receipts reference some deleted plans. Updating every old receipt would touch large historical state files and may not improve current navigation. Judge should decide whether current-doc cleanup is enough or whether all references to deleted plan paths must be scrubbed.
- Moving specs is valuable but larger because it requires reference updates plus history banners. It is safer as a separate Worker package after plan deletion.
- Generated/log cleanup is low risk but does not satisfy the explicit Superpowers plan deletion requirement as directly as the docs cleanup batch.
