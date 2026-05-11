# Delete `apps/platform-http` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Delete `apps/platform-http/` and every external reference (CI, ESLint, AGENTS.md, Dockerfile.test, owner docs, decision system) so the rntme platform is served exclusively by `@rntme/runtime` reading `apps/platform/blueprint`. The only platform-http-only logic that does not yet have a home — `runProjectDeleteOperation` — moves into `@rntme/deploy-runner` as a sibling `runProjectDelete` export with the same shape as `runDeployment`.

**Architecture:** Two phases. Phase 1 (Task 1) ports `runProjectDeleteOperation` and its unit test from `apps/platform-http/src/deploy/project-delete-executor.ts` into `packages/deploy/deploy-runner/src/project-delete.ts`. `@rntme/deploy-runner` already depends on `@rntme/platform-core` and `@rntme/platform-storage`, so the move is a straight copy with renamed export and updated imports — no signature refactor. Phase 2 (Tasks 2–13) deletes `apps/platform-http/`, scrubs every reference, and promotes the "No `apps/platform-http`" bet in `docs/decision-system.md` to `current-default`. The deploy-dokploy renderer already targets the `rntme-runtime` image (plans 1–3), so no production code change is needed on that path; only the live `platform.rntme.com` Dokploy app must be repointed to the runtime image as a post-merge runbook step (Task 14).

**Tech Stack:** Bun 1.1+, TypeScript, `@rntme/deploy-runner`, `@rntme/platform-core`, `@rntme/platform-storage`, `@rntme/deploy-dokploy`, Bun test runner, dependency-cruiser, ESLint, GitHub Actions.

---

## Scope and Dependencies

This plan is plan 6 of 6 in `docs/superpowers/specs/2026-05-10-cli-universal-deploy-and-platform-http-removal-design.md`.

**Requires:** plans 1–5 landed on `main`. As of `2026-05-11`, all five are landed:
- Plan 1 — `@rntme/deploy-runner` extraction (commits `c57fb86a`, `52398da5`, etc.)
- Plan 2 — CLI direct-mode (`ed79f40c` merge of `feat/cli-direct-mode`)
- Plan 3 — BPMN-orchestrated deploy in `services/deployments` (`b8a94c4f`, plus existing `apps/platform/blueprint/services/deployments/workflows/run-deployment.bpmn` + `workflows.json` nativeTasks)
- Plan 4 — HTTP middleware lift to `@rntme/bindings-http` (`1af91e47` merge of `feat/lift-http-middleware-to-runtime`)
- Plan 5 — Bearer-token validation into `services/tokens` (`81fc6cbf`)

**Decides the spec open question — "project-delete operation."** Move into `@rntme/deploy-runner` as a sibling library function (`runProjectDelete`). BPMN wiring inside `services/deployments` is deferred to a follow-up plan; preserving the function as a callable export satisfies the spec's "must keep project-delete behavior somewhere reachable" requirement and matches the `runDeployment` precedent.

**Out of scope:**
- Wiring `runProjectDelete` to a BPMN process or new graphs in `services/deployments`. (Future plan.)
- Switching the live `platform.rntme.com` Dokploy app from `apps/platform-http/Dockerfile` to the runtime image — that is a post-merge operational step documented in Task 14, not a code change in this plan.
- Any change to the deploy-dokploy renderer; it already emits `rntme-runtime` images for runtime services.

## File Structure

### Created

- `packages/deploy/deploy-runner/src/project-delete.ts` — `runProjectDelete(operationId, orgId, deps)` ported from `apps/platform-http/src/deploy/project-delete-executor.ts`.
- `packages/deploy/deploy-runner/test/project-delete.test.ts` — ported from `apps/platform-http/test/unit/deploy/project-delete-executor.test.ts`, retargeted at the new import.

### Modified

- `packages/deploy/deploy-runner/src/index.ts` — re-export `runProjectDelete` and `ProjectDeleteExecutorDeps`.
- `packages/deploy/deploy-runner/src/run-deployment.ts` — comment sweep removes "platform-http executor" mention.
- `packages/deploy/deploy-runner/src/types.ts` — comment sweep.
- `packages/deploy/deploy-runner/src/handlers/platform-context.ts` — comment sweep.
- `packages/runtime/bindings-http/src/middleware/index.ts` — drop the "apps/platform-http" sentence in the file header comment.
- `.github/workflows/ci.yml` — drop the `platform-http` matrix entry and the `SKIP_TESTCONTAINERS` env-var comment that named it.
- `Dockerfile.test` — drop the "platform-http, platform-storage" sentence from the build-order comment.
- `apps/cli/eslint.config.mjs` — remove the two `@rntme/platform-http` no-restricted-imports guards.
- `apps/cli/README.md` — phrasing review; references to the bundled "rntme-platform blueprint" remain valid.
- `AGENTS.md` — remove `apps/platform-http/README.md` from the apps row (line 46) and rewrite line 122 to drop the "platform-http and the planned" parenthetical.
- `docs/current/owners/apps/platform.md` — remove the cutover wording (lines 11, 91, 122, 134), update the runtime section to describe the runtime-image-only deploy, drop the invariant about platform-http remaining active.
- `docs/current/owners/apps/cli.md` — strip the "Intentionally duplicated from `apps/platform-http`; plan 6 will centralize this logic" sentence from the `to-deploy-core-input.ts` bullet.
- `docs/current/owners/packages/deploy/deploy-runner.md` — document the new `runProjectDelete` export.
- `docs/current/owners/packages/deploy/deploy-dokploy.md` — drop the stale "@rntme/platform-http's Dokploy client factory" sentence.
- `docs/decision-system.md` — add the **No `apps/platform-http`** bet at `current-default`, with goals/filters from the spec.

### Deleted

- `apps/platform-http/` (entire directory, including `src/`, `test/`, `Dockerfile`, `package.json`, `README.md`, `eslint.config.mjs`, `tsconfig*.json`, `node_modules/`, `dist/`). The `bin: rntme-platform` declaration disappears with the package.
- `docs/current/owners/apps/platform-http.md`

### Not modified (verify, do not touch)

- `apps/platform/blueprint/` — already the source of truth; no change.
- `packages/runtime/runtime/` — already exports `rntme-runtime` bin and Dockerfile.template; no change.
- `packages/deploy/deploy-dokploy/` — renderer already emits the runtime image; no change.
- `apps/cli/` (beyond `eslint.config.mjs`) — already implements direct-mode and platform bootstrap; no change.

---

## Task 1: Port `runProjectDelete` into `@rntme/deploy-runner`

**Files:**
- Create: `packages/deploy/deploy-runner/src/project-delete.ts`
- Create: `packages/deploy/deploy-runner/test/project-delete.test.ts`
- Modify: `packages/deploy/deploy-runner/src/index.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/deploy/deploy-runner/test/project-delete.test.ts`:

```ts
import { Buffer } from 'node:buffer';
import { describe, expect, it, mock } from 'bun:test';
import {
  ok,
  type DeployTargetWithSecret,
  type ProjectOperationRepo,
  type DeploymentRepo,
  type ProjectRepo,
  type ProjectVersionRepo,
} from '@rntme/platform-core';
import { runProjectDelete, type ProjectDeleteExecutorDeps } from '../src/project-delete.js';

describe('runProjectDelete', () => {
  it('deletes applied resources grouped by target and decommissions the project', async () => {
    const operations = operationRepo();
    const projects = projectRepo();
    const deployments = deploymentRepo();
    const deployTargets = {
      getWithSecretById: mock(async () => ok(target('target-1'))),
    };
    const projectVersions = projectVersionRepo();
    const client = {
      deleteApplication: mock(async () => undefined),
      deleteCompose: mock(async () => undefined),
    };
    const withOrgTx = async (
      _orgId: string,
      fn: (repos: {
        projectOperations: typeof operations;
        projects: typeof projects;
        deployments: typeof deployments;
        deployTargets: typeof deployTargets;
        projectVersions: typeof projectVersions;
      }) => Promise<unknown>,
    ) => fn({ projectOperations: operations, projects, deployments, deployTargets, projectVersions });

    await runProjectDelete('operation-1', 'org-1', {
      withOrgTx: withOrgTx as unknown as ProjectDeleteExecutorDeps['withOrgTx'],
      dokployClientFactory: () => client as never,
      logger: { warn: mock(), error: mock(), info: mock() },
      heartbeatMs: 1_000,
      blob: {
        getRaw: mock(async () => ok(Buffer.alloc(0))),
        putIfAbsent: mock(async () => ok(undefined as never)),
        presignedGet: mock(async () => ok('')),
        getJson: mock(async () => ok({})),
      } as unknown as ProjectDeleteExecutorDeps['blob'],
      secretCipher: {
        encrypt: mock(() => ({ ciphertext: Buffer.alloc(0), nonce: Buffer.alloc(0), keyVersion: 1 })),
        decrypt: mock(() => '{"modules":{}}'),
      } as ProjectDeleteExecutorDeps['secretCipher'],
      resolveProvisioner: mock(async () => ({
        provision: mock(),
        tearDown: mock(),
      })) as unknown as ProjectDeleteExecutorDeps['resolveProvisioner'],
    });

    expect(client.deleteApplication).toHaveBeenCalledWith('app_1');
    expect(client.deleteCompose).toHaveBeenCalledWith('compose_1');
    expect(projects.setStatus).toHaveBeenCalledWith('org-1', 'project-1', 'decommissioned');
    expect(operations.finalize).toHaveBeenCalledWith(
      'operation-1',
      expect.objectContaining({ status: 'succeeded' }),
    );
  });
});

function operationRepo(): ProjectOperationRepo {
  return {
    create: mock(),
    attachDeployment: mock(),
    getById: mock(async () => ok({
      id: 'operation-1',
      orgId: 'org-1',
      projectId: 'project-1',
      kind: 'delete',
      status: 'queued',
      requestedByAccountId: 'account-1',
      requestedByTokenId: null,
      targetId: null,
      projectVersionId: null,
      deploymentId: null,
      input: {},
      result: null,
      errorCode: null,
      errorMessage: null,
      queuedAt: new Date(),
      startedAt: null,
      finishedAt: null,
      lastHeartbeatAt: null,
    })),
    getByDeploymentId: mock(),
    listByProject: mock(),
    transition: mock(async () => ok(undefined)),
    finalize: mock(async () => ok(undefined)),
    touchHeartbeat: mock(async () => ok(undefined)),
    appendLog: mock(async () => ok(undefined)),
    listLogs: mock(),
    findStaleRunning: mock(),
  } as unknown as ProjectOperationRepo;
}

function projectRepo(): ProjectRepo {
  return {
    create: mock(),
    listForOrg: mock(),
    findBySlug: mock(),
    findById: mock(),
    setStatus: mock(async () => ok(undefined)),
  } as unknown as ProjectRepo;
}

function deploymentRepo(): DeploymentRepo {
  return {
    listAppliedResourcesByProject: mock(async () => ok([
      { targetId: 'target-1', resources: [
        { kind: 'application', id: 'app_1', name: 'a' },
        { kind: 'compose', id: 'compose_1', name: 'c' },
      ] },
    ])),
    findLastSuccessfulForProjectTarget: mock(async () => ok(null)),
    findStaleRunning: mock(),
  } as unknown as DeploymentRepo;
}

function projectVersionRepo(): ProjectVersionRepo {
  return {
    getById: mock(),
  } as unknown as ProjectVersionRepo;
}

function target(id: string): DeployTargetWithSecret {
  return {
    id,
    orgId: 'org-1',
    slug: 'preview',
    displayName: 'Preview',
    kind: 'dokploy',
    config: { dokployUrl: 'https://dokploy.test', dokployProjectId: 'proj-1' },
    encryptedSecret: { ciphertext: Buffer.alloc(0), nonce: Buffer.alloc(0), keyVersion: 1 },
    createdAt: new Date(),
    updatedAt: new Date(),
  } as DeployTargetWithSecret;
}
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `bun --filter @rntme/deploy-runner test test/project-delete.test.ts`

Expected: FAIL with "Cannot find module '../src/project-delete.js'".

- [ ] **Step 3: Create the source file by copying from platform-http**

Create `packages/deploy/deploy-runner/src/project-delete.ts` by copying the contents of `apps/platform-http/src/deploy/project-delete-executor.ts` and making these edits:

1. Rename the exported function `runProjectDeleteOperation` → `runProjectDelete`.
2. Change the relative imports:
   - `import { runTearDownsForDeployment } from './run-teardowns.js';` → import from the deploy-runner's local re-export. The original platform-http wrapper file simply forwarded `runTearDownsForDeployment` from `@rntme/deploy-runner`. Use the in-package import:
     ```ts
     import { runTearDownsForDeployment } from './run-teardowns.js';
     ```
   - `@rntme/deploy-runner` already exposes `runTearDownsForDeployment`; the in-package path is `./run-teardowns.js` (existing file).
3. Keep every other import as-is — `@rntme/deploy-dokploy`, `@rntme/platform-core`, `@rntme/deploy-core`, `pino`. All are existing deps of `deploy-runner`.
4. Preserve the type alias name `ProjectDeleteExecutorDeps` (re-exported as-is — callers don't need a rename).

The full ported file is the same shape as the original; only the export name and the `runTearDownsForDeployment` import path differ.

- [ ] **Step 4: Add re-exports to the package barrel**

Edit `packages/deploy/deploy-runner/src/index.ts`. Add at the bottom (or alongside existing exports):

```ts
export { runProjectDelete } from './project-delete.js';
export type { ProjectDeleteExecutorDeps } from './project-delete.js';
```

- [ ] **Step 5: Run the test and confirm it passes**

Run: `bun --filter @rntme/deploy-runner test test/project-delete.test.ts`

Expected: PASS.

- [ ] **Step 6: Run the full deploy-runner test suite to confirm no regressions**

Run: `bun --filter @rntme/deploy-runner test`

Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add packages/deploy/deploy-runner/src/project-delete.ts \
        packages/deploy/deploy-runner/src/index.ts \
        packages/deploy/deploy-runner/test/project-delete.test.ts
git commit -m "feat(deploy-runner): port runProjectDelete from platform-http"
```

---

## Task 2: Delete the `apps/platform-http/` directory

**Files:**
- Delete: `apps/platform-http/` (entire directory)

- [ ] **Step 1: Verify no internal source file imports `@rntme/platform-http`**

Run:

```bash
grep -rln "@rntme/platform-http" packages/ apps/ modules/ demo/ \
  --include="*.ts" --include="*.tsx" --include="*.json" \
  | grep -v node_modules | grep -v "/dist/" || echo "no source imports"
```

Expected: `no source imports`, OR matches only inside `apps/platform-http/**` itself (about to be deleted) or `apps/cli/eslint.config.mjs` (handled in Task 4).

If any other internal file imports `@rntme/platform-http`, STOP and surface to the operator — the deletion is unsafe and an upstream extraction is missing.

- [ ] **Step 2: Delete the directory**

Run:

```bash
git rm -r apps/platform-http
```

- [ ] **Step 3: Refresh the workspace and rebuild**

Run:

```bash
bun install --frozen-lockfile=false
bun run --filter "@rntme/*" build
```

Expected: install removes the `@rntme/platform-http` workspace entry; build succeeds for all remaining packages.

If `--frozen-lockfile=false` updates the lockfile, stage it with the same commit.

- [ ] **Step 4: Run full validation**

Run in parallel via separate commands (each must pass):

```bash
bun run typecheck
bun run test
bun run lint
bun run depcruise
```

Expected: All four pass. Any failures here block the commit and surface a missing reference cleanup (handled in Tasks 3–11).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: delete apps/platform-http"
```

---

## Task 3: Remove `platform-http` from the CI matrix

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Read the current matrix block**

Open `.github/workflows/ci.yml`. The relevant lines (per current `main`):

- Lines 15–19: `SKIP_TESTCONTAINERS: '1'` env var with a comment that mentions `apps/platform-http/test/e2e/docker-available.ts`.
- Lines 42–44: matrix entry `name: platform-http`, `file: apps/platform-http/Dockerfile`, `tag: rntme-platform-http:ci`.

- [ ] **Step 2: Delete the matrix entry**

Edit `.github/workflows/ci.yml` to remove only the platform-http matrix block. The block to delete is exactly:

```yaml
          - name: platform-http
            file: apps/platform-http/Dockerfile
            tag: rntme-platform-http:ci
```

Leave the surrounding `test`, `landing`, `runtime`, `bpmn-worker`, `identity-auth0`, `storage-s3`, `marketing-site-static`, `ai-llm-openrouter` entries untouched.

- [ ] **Step 3: Update the `SKIP_TESTCONTAINERS` comment**

Replace the comment block at lines 15–18 with a generic note. Find:

```yaml
      # Skip platform-http e2e suites that boot Postgres via testcontainers.
      # Docker is available on the runner, but pulling the postgres image plus
      # ryuk warmup blows the 5-min testcontainers timeout. The suites already
      # honour this flag via apps/platform-http/test/e2e/docker-available.ts.
      SKIP_TESTCONTAINERS: '1'
```

Replace with:

```yaml
      # Skip e2e suites that boot containers via testcontainers. Docker is
      # available on the runner, but the warmup blows the 5-min timeout.
      # Suites honour this flag via their local docker-available helpers.
      SKIP_TESTCONTAINERS: '1'
```

- [ ] **Step 4: Validate workflow YAML parses**

Run:

```bash
python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/ci.yml')); print('ok')"
```

Expected: `ok`.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: drop platform-http docker-build matrix entry"
```

---

## Task 4: Remove the `@rntme/platform-http` ESLint guard in the CLI

**Files:**
- Modify: `apps/cli/eslint.config.mjs`

The CLI's flat ESLint config has two `no-restricted-imports` blocks (one for `src/`, one for `test/`) that each declare a guard against importing `@rntme/platform-http`. After deletion, the package no longer exists, and the guard becomes a dead rule that points at a phantom module.

- [ ] **Step 1: Read the two guard groups**

In `apps/cli/eslint.config.mjs`, lines 47 and 64 each contain:

```js
          { group: ['@rntme/platform-http', '@rntme/platform-http/*'], message: 'CLI must not import platform-http (Hono).' },
```

- [ ] **Step 2: Delete both lines**

Remove each entire object literal (line + trailing comma cleanup). After the edit, the surrounding `patterns: [ ... ]` arrays should still validate; double-check there are no dangling commas.

- [ ] **Step 3: Run lint to confirm the config still loads**

Run:

```bash
bun --filter @rntme/cli lint
```

Expected: lint passes.

- [ ] **Step 4: Commit**

```bash
git add apps/cli/eslint.config.mjs
git commit -m "chore(cli): drop dead platform-http import guard"
```

---

## Task 5: Sweep stale `platform-http` comments in source files

**Files:**
- Modify: `packages/runtime/bindings-http/src/middleware/index.ts`
- Modify: `packages/deploy/deploy-runner/src/run-deployment.ts`
- Modify: `packages/deploy/deploy-runner/src/types.ts`
- Modify: `packages/deploy/deploy-runner/src/handlers/platform-context.ts`

These four files carry comments referring to `apps/platform-http` that are now factually wrong.

- [ ] **Step 1: `packages/runtime/bindings-http/src/middleware/index.ts`**

The file header mentions middleware "lifted from apps/platform-http". Open the file, locate line 2 (the comment that says `// apps/platform-http. Each module is added in its own task; this barrel`), and replace the phrase so the comment reads as the canonical home statement. Use this replacement:

```ts
// Generic HTTP middleware exported as the canonical home for rntme runtime
// services. Each module lives in its own file; this barrel exports them all.
```

- [ ] **Step 2: `packages/deploy/deploy-runner/src/run-deployment.ts`**

Find the two existing comment fragments referencing "platform-http executor" (around lines 35, 59, 74). Replace `platform-http executor, CLI direct-mode` with `CLI direct-mode and BPMN compose-handler`. Replace `bus-mode log that platform-http surfaces in deployment timelines.` with `bus-mode log surfaced in deployment timelines by the caller.`

- [ ] **Step 3: `packages/deploy/deploy-runner/src/types.ts`**

Find the comment near line 116 (`Existing callers (platform-http executor, CLI direct-mode) ...`). Replace with `Existing callers (CLI direct-mode, BPMN compose-handler) materialise bundles to bundleDir; future callers may pass a pre-loaded ComposedBlueprint.`

- [ ] **Step 4: `packages/deploy/deploy-runner/src/handlers/platform-context.ts`**

Find the two comments referencing platform-http around lines 73 and 79. Rewrite as factual statements about deploy-runner's own resolver (drop "Identical to platform-http's resolver" and "platform-http uses on its request path."). Replacement for the first:

```ts
   * Used on the runtime request path by the BPMN compose-handler.
```

Replacement for the second:

```ts
   * Provisioner module packages are loaded from the materialized bundle's
   * `assets/provisioners/<safe>.entry.js` path rather than node_modules.
```

- [ ] **Step 5: Validate builds**

Run:

```bash
bun --filter @rntme/deploy-runner build
bun --filter @rntme/bindings-http build
```

Expected: both succeed (these are comment-only edits).

- [ ] **Step 6: Commit**

```bash
git add packages/runtime/bindings-http/src/middleware/index.ts \
        packages/deploy/deploy-runner/src/run-deployment.ts \
        packages/deploy/deploy-runner/src/types.ts \
        packages/deploy/deploy-runner/src/handlers/platform-context.ts
git commit -m "chore: drop stale platform-http references in source comments"
```

---

## Task 6: Scrub platform-http from AGENTS.md and Dockerfile.test

**Files:**
- Modify: `AGENTS.md`
- Modify: `Dockerfile.test`

- [ ] **Step 1: AGENTS.md, line 46**

Find the apps row:

```
| Apps | `apps/cli/README.md`, `apps/platform-http/README.md`, `apps/platform/README.md`, `apps/landing/README.md` |
```

Replace with:

```
| Apps | `apps/cli/README.md`, `apps/platform/README.md`, `apps/landing/README.md` |
```

- [ ] **Step 2: AGENTS.md, lines 122–123**

Find the two-line bullet:

```
- Deploy orchestrator (pure, used by both platform-http and the planned
  CLI direct-mode): `packages/deploy/deploy-runner/README.md`.
```

Replace with (preserving the README link and indentation style of the surrounding bullets):

```
- Deploy orchestrator (pure, single home for deploy stage logic; consumed
  by CLI direct-mode and the platform's BPMN process):
  `packages/deploy/deploy-runner/README.md`.
```

- [ ] **Step 3: `Dockerfile.test`**

Find the comment block referencing `platform-http, platform-storage`. The current text is:

```
# Build all workspace packages in topological order so leaf builds (platform-http,
# platform-storage) can resolve workspace deps' emitted .d.ts files.
```

Replace with:

```
# Build all workspace packages in topological order so leaf builds
# (platform-storage, deploy-runner) can resolve workspace deps' emitted .d.ts files.
```

- [ ] **Step 4: Verify Dockerfile.test still builds (smoke only — no `docker build` required if Docker is unavailable)**

Run a quick lint of the file:

```bash
grep -n "platform-http" Dockerfile.test || echo "clean"
```

Expected: `clean`.

- [ ] **Step 5: Commit**

```bash
git add AGENTS.md Dockerfile.test
git commit -m "docs(agents): drop platform-http references from navigation"
```

---

## Task 7: Delete the platform-http owner doc

**Files:**
- Delete: `docs/current/owners/apps/platform-http.md`

- [ ] **Step 1: Delete the file**

Run:

```bash
git rm docs/current/owners/apps/platform-http.md
```

- [ ] **Step 2: Confirm no other doc links to it**

Run:

```bash
grep -rln "owners/apps/platform-http" docs/ --include="*.md" \
  | grep -v node_modules | grep -v worktree || echo "no links"
```

Expected: `no links`. If a link remains, fix the linking file before committing.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "docs(owners): drop platform-http owner doc"
```

---

## Task 8: Update `docs/current/owners/apps/platform.md`

**Files:**
- Modify: `docs/current/owners/apps/platform.md`

The current doc carries four cutover-era statements that are now stale:
1. Line 11: "Does not replace `apps/platform-http` until the cutover plan lands."
2. Line 91: "The active platform runtime is hosted through `apps/platform-http` blueprint mode."
3. Line 122: "`apps/platform-http/src/ui/**` remains legacy reference code until ..."
4. Line 134: "`apps/platform-http` remains the active hosted platform until cutover."

- [ ] **Step 1: Replace line 11**

The "Does not replace `apps/platform-http`..." bullet should be removed entirely (the bullet that contains it). The replacement bullet, capturing the post-deletion truth, is:

```
- The platform is exclusively served by `@rntme/runtime` reading
  `apps/platform/blueprint`. There is no separate launcher app.
```

- [ ] **Step 2: Replace the "Runtime cutover" section**

Find the section that begins with "The active platform runtime is hosted through `apps/platform-http` blueprint mode." Rewrite the entire `## Runtime cutover` section as:

```markdown
## Runtime

The platform runtime is `@rntme/runtime` reading `apps/platform/blueprint`.
The blueprint declares HTTP routes, UI mounts, BPMN workflows, and the
identity-auth0 module configuration. There is no separate launcher app —
production deploys ship the runtime image with the blueprint artifacts
copied into `/srv/artifacts` via the `Dockerfile.template` in
`packages/runtime/runtime/`.
```

- [ ] **Step 3: Update the UI section (around line 122)**

Find the sentence:

```
`apps/platform-http/src/ui/**` remains legacy reference code until
runtime cutover.
```

Delete it. The platform UI now lives only in `apps/platform/blueprint/services/app/ui`.

- [ ] **Step 4: Update the Invariants section**

Find the invariant `- apps/platform-http remains the active hosted platform until cutover.` Delete it. Add (or merge into the existing invariant list):

```
- The platform is the live runtime; `apps/platform-http` no longer exists.
```

- [ ] **Step 5: Verify no remaining `platform-http` mentions**

Run:

```bash
grep -n "platform-http" docs/current/owners/apps/platform.md || echo "clean"
```

Expected: `clean`.

- [ ] **Step 6: Commit**

```bash
git add docs/current/owners/apps/platform.md
git commit -m "docs(platform): drop platform-http cutover wording"
```

---

## Task 9: Update `docs/current/owners/apps/cli.md`

**Files:**
- Modify: `docs/current/owners/apps/cli.md`

- [ ] **Step 1: Find and update the `to-deploy-core-input.ts` bullet**

Line 272 currently reads:

```
- **`to-deploy-core-input.ts`** — Converts `ComposedBlueprint` to `ComposedProjectInput` for the deployment engine. Intentionally duplicated from `apps/platform-http`; plan 6 will centralize this logic.
```

Replace with:

```
- **`to-deploy-core-input.ts`** — Converts `ComposedBlueprint` to `ComposedProjectInput` for the deployment engine.
```

The duplication is gone because `apps/platform-http` is gone; the CLI is now the sole home for this conversion. If centralization into `@rntme/deploy-runner` is desired later, that is a separate plan.

- [ ] **Step 2: Verify no remaining `platform-http` mentions**

Run:

```bash
grep -n "platform-http" docs/current/owners/apps/cli.md || echo "clean"
```

Expected: `clean`.

- [ ] **Step 3: Commit**

```bash
git add docs/current/owners/apps/cli.md
git commit -m "docs(cli): drop platform-http duplication note"
```

---

## Task 10: Document `runProjectDelete` in the deploy-runner owner doc

**Files:**
- Modify: `docs/current/owners/packages/deploy/deploy-runner.md`

- [ ] **Step 1: Read the current public-API section**

The owner doc has a section listing exports. Locate the block that documents `runDeployment` + `stages.*` (the `Public API` or `Exports` section).

- [ ] **Step 2: Append a `runProjectDelete` paragraph**

Add the following paragraph immediately after the `runDeployment` description:

```markdown
### `runProjectDelete`

Sibling orchestrator for project-delete operations. Same DB-bound dependency
shape as the historical platform-http executor: a `withOrgTx` callback that
gives the function transactional access to `ProjectOperationRepo`,
`ProjectRepo`, `DeploymentRepo`, `DeployTargetRepo`, and `ProjectVersionRepo`,
plus a `DokployClientFactory`, a `BlobStore`, a `SecretCipher`, and a
provisioner resolver. The function:

1. Transitions the project-operation to `running` and starts a heartbeat.
2. Reads applied resources grouped by deploy target.
3. For each target, runs provisioner tearDown for the last successful
   deployment, then deletes the Dokploy resources.
4. Finalizes the operation as `succeeded` and sets the project status to
   `decommissioned`, or `failed` with an aggregated error message.

Used by future callers in `services/deployments` (BPMN handler) and in any
direct-mode tooling that needs to dismantle a project's deployed resources.
Wiring to a BPMN process is a follow-up plan.
```

- [ ] **Step 3: Verify the doc still parses (no broken markdown)**

Run:

```bash
grep -c "^#" docs/current/owners/packages/deploy/deploy-runner.md
```

Expected: non-zero count; visually scan for missing headings.

- [ ] **Step 4: Commit**

```bash
git add docs/current/owners/packages/deploy/deploy-runner.md
git commit -m "docs(deploy-runner): document runProjectDelete export"
```

---

## Task 11: Scrub `deploy-dokploy` owner doc and add the decision bet

**Files:**
- Modify: `docs/current/owners/packages/deploy/deploy-dokploy.md`
- Modify: `docs/decision-system.md`

- [ ] **Step 1: `deploy-dokploy.md`**

Line 12 currently reads:

```
`@rntme/platform-http`'s Dokploy client factory. This package receives only
```

Open the surrounding paragraph. Rewrite the sentence to drop the platform-http reference; the canonical phrasing is:

```
The Dokploy client factory now lives in `@rntme/deploy-runner`. This package
receives only normalized, deploy-target-shaped inputs.
```

- [ ] **Step 2: `docs/decision-system.md` — add the bet**

Find the `current-default` block (the section after the existing CLI universal deploy / Deploy orchestrator library / BPMN-orchestrated deploy bets at lines 68–70). Append a fourth bullet:

```markdown
- **No `apps/platform-http`** - The rntme platform is served exclusively by `@rntme/runtime` reading `apps/platform/blueprint`. There is no per-app launcher or hand-written HTTP server in the platform path. Project-delete orchestration is preserved as `runProjectDelete` in `@rntme/deploy-runner`; BPMN wiring for it is a follow-up. · G1, G2, G5, F1, F2, F6 · `current-default` · spec `docs/superpowers/specs/2026-05-10-cli-universal-deploy-and-platform-http-removal-design.md`, plan `docs/superpowers/plans/2026-05-10-platform-http-deletion.md`
```

- [ ] **Step 3: Verify formatting matches the surrounding bets**

Run:

```bash
grep -n "No \`apps/platform-http\`" docs/decision-system.md
```

Expected: one match.

- [ ] **Step 4: Commit**

```bash
git add docs/current/owners/packages/deploy/deploy-dokploy.md docs/decision-system.md
git commit -m "docs: promote No apps/platform-http bet to current-default"
```

---

## Task 12: Run full validation across the workspace

**Files:** none (verification only)

- [ ] **Step 1: Build**

Run:

```bash
bun run build
```

Expected: every package builds. No `@rntme/platform-http` errors.

- [ ] **Step 2: Typecheck**

Run:

```bash
bun run typecheck
```

Expected: pass.

- [ ] **Step 3: Test**

Run:

```bash
bun run test
```

Expected: every package's tests pass. The deploy-runner suite now includes `project-delete.test.ts`.

- [ ] **Step 4: Lint**

Run:

```bash
bun run lint
```

Expected: pass. (CLI's eslint config no longer references the deleted `@rntme/platform-http`.)

- [ ] **Step 5: Dependency-cruiser**

Run:

```bash
bun run depcruise
```

Expected: pass.

- [ ] **Step 6: Final grep for residual references**

Run:

```bash
grep -rln "platform-http\|@rntme/platform-http" \
  packages/ apps/ modules/ demo/ docs/current/ .github/ \
  AGENTS.md Dockerfile.test \
  --include="*.ts" --include="*.tsx" --include="*.json" \
  --include="*.md" --include="*.yaml" --include="*.yml" \
  --include="Dockerfile*" \
  | grep -v node_modules | grep -v "/dist/" | grep -v worktree \
  || echo "no residual refs"
```

Expected: `no residual refs`. Any output here means a reference was missed; fix and re-run.

- [ ] **Step 7: No commit needed** — this is a verification gate only.

---

## Task 13: Smoke deploy via CLI `platform up`

**Files:** none (integration test)

Smoke-validates that the post-deletion world boots end-to-end: `rntme platform up` against a Dokploy testcontainer should bring up a working platform stack using the `rntme-runtime` image and `apps/platform/blueprint` artifacts.

The integration test for this path already exists at `apps/cli/test/integration/platform-up.test.ts` (added by plan 2). It is gated on Docker availability via the local `docker-available` helper.

- [ ] **Step 1: Check Docker availability**

Run:

```bash
docker info >/dev/null 2>&1 && echo "docker available" || echo "docker unavailable"
```

If `docker unavailable`, skip this task with a note in the execution log. The post-merge runbook (Task 14) still applies.

- [ ] **Step 2: Run the integration test (Docker available branch)**

Run:

```bash
bun --filter @rntme/cli test test/integration/platform-up.test.ts
```

Expected: PASS. The test brings up Dokploy in a container, runs `rntme platform up --target <fixture>`, and asserts the platform stack reaches a healthy state (with Operaton + the deploy-worker container alongside the runtime).

- [ ] **Step 3: If the test fails**

Diagnose. The most likely failure is that the bundled `apps/platform/blueprint/` artifacts (copied by `apps/cli/scripts/copy-platform-blueprint.cjs`) are stale. Run:

```bash
bun --filter @rntme/cli build
```

then re-run Step 2.

- [ ] **Step 4: Document the run in the commit/PR**

Note in the PR description that the integration test was exercised (or that Docker was unavailable and the smoke was deferred to a CI run).

- [ ] **Step 5: No commit needed** — this is a verification gate.

---

## Task 14: Post-merge runbook — switch `platform.rntme.com` to the runtime image

**Not a code task. Reference for the operator who lands this plan.**

The live `platform.rntme.com` Dokploy app currently builds and runs `apps/platform-http/Dockerfile`. After this plan merges, the Dockerfile no longer exists. Production must be switched to the runtime image + bundled platform blueprint artifacts.

- [ ] **Step 1: Confirm the runtime image is published**

Confirm the latest `rntme-runtime` image tag is available on `ghcr.io/vladprrs/rntme-runtime`. Default tag per `packages/runtime/runtime/Dockerfile.template`: `1.0`. Per `packages/deploy/deploy-core/src/plan.ts:346`, the runtime image is `ghcr.io/vladprrs/rntme-runtime:latest` unless overridden by `runtimeImage` in the deploy config.

- [ ] **Step 2: Render the platform compose locally via `rntme platform up --dry-run`**

Generate the compose file the runtime path would produce:

```bash
DOKPLOY_API_TOKEN=$PROD_TOKEN \
  bun --filter @rntme/cli exec rntme platform up \
  --target ./targets/platform-rntme-com.json \
  --dry-run --json
```

Capture the rendered stack (services, env, ports, volumes).

- [ ] **Step 3: In Dokploy MCP, update the `platform.rntme.com` app**

For the existing Dokploy application:
- Change build pack from "Dockerfile" to "Compose" if needed.
- Replace the build file/context to reflect the rendered compose from Step 2.
- The runtime container's `image:` field should be `ghcr.io/vladprrs/rntme-runtime:latest` (or whichever tag matches Step 1).
- Mount `apps/platform/blueprint/` artifacts via the Dockerfile.template's `/srv/artifacts` copy step; the runtime CLI invocation is `rntme-runtime start /srv/artifacts`.

This step is performed via the Dokploy MCP tools (or the Dokploy UI). Per the memory note `dokploy_mcp_url_gotcha.md`, `DOKPLOY_URL` is the host without `/api`.

- [ ] **Step 4: Trigger a redeploy and verify**

Trigger the Dokploy redeploy. Watch the deploy log. Once the platform reports healthy:

```bash
curl -fsS https://platform.rntme.com/health || curl -fsS https://platform.rntme.com/
```

Expected: 200 OK or a UI login page. Login via `rntme login` from a CLI to confirm round-trip.

- [ ] **Step 5: Decommission the old Dockerfile-based Dokploy app**

Once the new compose-based app is healthy and traffic has cut over, delete the old `platform-http`-Dockerfile Dokploy application.

- [ ] **Step 6: No commit needed** — this is an operational step performed after the plan's code changes merge.

---

## Self-Review

Spec coverage check (re-read `docs/superpowers/specs/2026-05-10-cli-universal-deploy-and-platform-http-removal-design.md` §Migration Plan step 6 and §Open Questions):

| Spec requirement | Task |
| --- | --- |
| Switch deploy renderer to use runtime image + blueprint artifacts | Already in place (no code change needed); Task 14 covers the production app config |
| Remove the `apps/platform-http/` directory | Task 2 |
| Delete `bin: rntme-platform` | Implicit via Task 2 (the bin entry lives in `apps/platform-http/package.json`) |
| Update Dockerfiles | Task 6 (Dockerfile.test) and Task 14 (production Dokploy app) |
| Remove workspace references | Task 2 verifies; root `package.json` `workspaces` uses globs (`apps/*`), so the entry disappears on directory removal |
| Final smoke deploy via CLI | Task 13 |
| Update owner docs | Tasks 7–11 |
| Project-delete operation decision | Phase 1 of plan: `runProjectDelete` ported to `@rntme/deploy-runner` (Task 1). BPMN wiring deferred to follow-up |
| Decision-system update | Task 11 |

Placeholder scan: no `TBD`, `TODO`, or hand-wavy "Add appropriate ..." steps. Every code-touching step shows the exact replacement or grep/build command.

Type consistency: `ProjectDeleteExecutorDeps` keeps its name across the port (so callers don't break); the exported function renames from `runProjectDeleteOperation` → `runProjectDelete` only.

---

**Plan complete and saved to `docs/superpowers/plans/2026-05-10-platform-http-deletion.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
