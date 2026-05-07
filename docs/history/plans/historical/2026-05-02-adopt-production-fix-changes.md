> Status: historical.
> Date: 2026-05-02.
> Current source: docs/current/**, docs/decision-system.md, and current code/tests.
> Why retained: Historical rationale and execution context retained for review; it is not current-state truth by itself.

# Adopt Production Fix Changes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Review, verify, and commit the existing notes-demo production-fix changes as the first implementation slice of CLI remote deploy hardening.

**Architecture:** This slice adopts already-authored changes that keep `platform-http` from losing Auth0 `edgeAuth` metadata when a blueprint uses a local module package alias. It also preserves the notes-demo vendored Auth0 `edgeAuth` descriptor and regression smoke coverage. No new deploy CLI commands are implemented in this slice.

**Tech Stack:** TypeScript, Vitest, `@rntme/blueprint`, `@rntme/platform-http`, `@rntme/deploy-core`.

---

### Task 1: Review Existing Dirty Changes

**Files:**
- Review: `apps/platform-http/src/deploy/executor.ts`
- Review: `apps/platform-http/test/unit/deploy/executor.test.ts`
- Review: `demo/notes-blueprint/node_modules/rntme_identity_auth0/module.json`
- Review: `demo/notes-blueprint/README.md`
- Review: `packages/artifacts/blueprint/test/smoke-notes-demo.test.ts`

- [x] **Step 1: Inspect the current dirty diff**

Run:

```bash
git diff -- apps/platform-http/src/deploy/executor.ts apps/platform-http/test/unit/deploy/executor.test.ts demo/notes-blueprint/README.md demo/notes-blueprint/node_modules/rntme_identity_auth0/module.json
git diff -- packages/artifacts/blueprint/test/smoke-notes-demo.test.ts
```

Expected: the diff contains only alias-to-canonical edgeAuth mapping, tests, notes-demo Auth0 `edgeAuth`, smoke test, and README updates.

- [x] **Step 2: Decide commit scope**

Commit only files that directly support this adoption slice:

```text
apps/platform-http/src/deploy/executor.ts
apps/platform-http/test/unit/deploy/executor.test.ts
demo/notes-blueprint/node_modules/rntme_identity_auth0/module.json
packages/artifacts/blueprint/test/smoke-notes-demo.test.ts
demo/notes-blueprint/README.md
```

If `demo/notes-blueprint/README.md` contains unrelated changes, exclude it and leave it dirty.

### Task 2: Verify Production-Fix Behavior

**Files:**
- Test: `apps/platform-http/test/unit/deploy/executor.test.ts`
- Test: `packages/artifacts/blueprint/test/smoke-notes-demo.test.ts`

- [x] **Step 1: Run platform executor focused tests**

Run:

```bash
pnpm -F @rntme/platform-http exec vitest run test/unit/deploy/executor.test.ts
```

Expected: all tests in `executor.test.ts` pass, including the alias edgeAuth mapping regression.

- [x] **Step 2: Run notes-demo blueprint smoke test**

Run:

```bash
pnpm -F @rntme/blueprint exec vitest run test/smoke-notes-demo.test.ts
```

Expected: the notes-demo composed blueprint exposes Auth0 module `edgeAuth` with port `50052`.

- [x] **Step 3: Run local composed blueprint check**

Run:

```bash
pnpm --filter @rntme/blueprint exec node --input-type=module -e "import { loadComposedBlueprint } from '@rntme/blueprint'; const r = loadComposedBlueprint('../../../demo/notes-blueprint'); if (!r.ok) { console.error(r.errors); process.exit(1); } const edge = r.value.catalogManifest?.moduleEdgeAuth?.['@rntme/identity-auth0']; console.log('OK', edge?.port); if (edge?.port !== 50052) process.exit(1);"
```

Expected:

```text
OK 50052
```

### Task 3: Commit Adopted Changes

**Files:**
- Commit: files selected in Task 1.

- [x] **Step 1: Stage only selected files**

Run:

```bash
git add apps/platform-http/src/deploy/executor.ts \
  apps/platform-http/test/unit/deploy/executor.test.ts \
  demo/notes-blueprint/node_modules/rntme_identity_auth0/module.json \
  packages/artifacts/blueprint/test/smoke-notes-demo.test.ts
```

If `demo/notes-blueprint/README.md` is related to the production fix, include it:

```bash
git add demo/notes-blueprint/README.md
```

- [x] **Step 2: Commit**

Run:

```bash
git commit -m "fix(platform): preserve auth module edge metadata"
```

Expected: a commit containing only the adopted production-fix files.

- [x] **Step 3: Report remaining worktree state**

Run:

```bash
git status --short --branch
```

Expected: branch is ahead by the spec commit plus this implementation commit. Any remaining dirty files are unrelated or intentionally left for later implementation slices.
