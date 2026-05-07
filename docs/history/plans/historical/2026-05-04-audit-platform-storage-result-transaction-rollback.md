> Status: historical.
> Date: 2026-05-04.
> Current source: docs/current/**, docs/decision-system.md, and current code/tests.
> Why retained: Historical rationale and execution context retained for review; it is not current-state truth by itself.

# Platform Storage Result Transaction Rollback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close U-132 by making `withTransaction` roll back when the callback returns `Result.err`, not only when it throws.

**Architecture:** The shared `packages/platform/platform-storage/src/pg/tx.ts` helper is the strategic boundary because HTTP routes and integration tests already use it to create RLS-scoped repository transactions. The helper will keep supporting non-`Result` callbacks, but when the callback result has the repo-wide `Result` error shape (`{ ok: false, errors: [...] }`) it will issue `ROLLBACK` and return that error result unchanged. Repository-local `withOptionalTransaction` helpers remain compatible because they already avoid opening nested transactions for clients.

**Tech Stack:** TypeScript strict ESM, `pg`, Vitest integration tests with the existing Postgres harness.

---

## File Map

- Modify `packages/platform/platform-storage/test/integration/pg-deploy-target-repo.test.ts` to add a regression that creates a deploy target inside `withTransaction`, returns `Result.err`, and asserts both the target row and audit row were rolled back.
- Modify `packages/platform/platform-storage/src/pg/tx.ts` to detect returned `Result.err` and roll back before returning it.
- Modify `packages/platform/platform-storage/README.md`, `docs/audit/00-waves.md`, and `docs/audit/01-current-priority-tasks.md` for documentation-touch.

### Task 1: Regression Test

- [x] **Step 1: Write the failing integration test**

Add this test to `packages/platform/platform-storage/test/integration/pg-deploy-target-repo.test.ts` near the existing deploy-target transaction tests:

```ts
  it('rolls back repo writes when the outer transaction returns Result.err', async () => {
    const targetId = randomUUID();

    const result = await withTransaction(h.appPool, orgId, async (client): Promise<Result<void, PlatformError>> => {
      const repo = new PgDeployTargetRepo(client);
      const created = await repo.create({
        row: targetRow({ id: targetId, slug: 'prod' }),
        auditActorAccountId: accountId,
        auditActorTokenId: null,
      });
      if (!isOk(created)) return created;
      return err([{ code: 'DEPLOY_TARGET_IN_USE', message: 'synthetic failure' }]);
    });

    expect(result.ok).toBe(false);
    expect(result.ok ? undefined : result.errors[0]?.code).toBe('DEPLOY_TARGET_IN_USE');

    const targetRows = await h.pool.query(`SELECT id FROM deploy_target WHERE id=$1`, [targetId]);
    expect(targetRows.rows).toHaveLength(0);
    await expectAuditActions([]);
  });
```

Also update the import from `@rntme/platform-core` to include `err`, `Result`, and `PlatformError`.

- [x] **Step 2: Confirm RED**

Run:

```bash
pnpm -F @rntme/platform-storage test -- test/integration/pg-deploy-target-repo.test.ts
```

Expected before implementation: FAIL because `withTransaction` commits after the callback returns `Result.err`, so `targetRows.rows` has length `1` and the audit log contains `deploy_target.created`.

In this workspace the container-backed integration suite skipped, so RED was
confirmed with `packages/platform/platform-storage/test/unit/pg/tx.test.ts`:
the helper emitted `COMMIT` instead of `ROLLBACK`.

### Task 2: Transaction Helper Fix

- [x] **Step 1: Implement Result.err rollback**

Change `packages/platform/platform-storage/src/pg/tx.ts` so the callback result is checked before commit:

```ts
type ResultErrLike = {
  readonly ok: false;
  readonly errors: readonly unknown[];
};

function isResultErrLike(value: unknown): value is ResultErrLike {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { readonly ok?: unknown }).ok === false &&
    Array.isArray((value as { readonly errors?: unknown }).errors)
  );
}
```

Then in `withTransaction`, after `const out = await fn(client as TxClient);`, run:

```ts
    if (isResultErrLike(out)) {
      await client.query('ROLLBACK');
      return out;
    }
```

before `COMMIT`.

- [x] **Step 2: Confirm GREEN**

Run:

```bash
pnpm -F @rntme/platform-storage test -- test/integration/pg-deploy-target-repo.test.ts
```

Expected: PASS for the deploy-target integration suite.

### Task 3: Documentation And Audit Ledger

- [x] **Step 1: Update platform-storage README**

Add a short transaction helper section documenting that `withTransaction` commits non-`Result` and `Result.ok` values, rolls back returned `Result.err`, and still rolls back on thrown exceptions.

- [x] **Step 2: Close U-132 in audit docs**

Mark U-132 `✅ closed | A6` in `docs/audit/00-waves.md`, remove it from `docs/audit/01-current-priority-tasks.md`, and add the plan/evidence to the suggested work-package summary.

- [x] **Step 3: Full verification**

Run:

```bash
pnpm -F @rntme/platform-storage typecheck
pnpm -F @rntme/platform-storage test
pnpm -F @rntme/platform-storage lint
pnpm -F @rntme/platform-storage build
```

Expected: all PASS. Integration tests may skip automatically when Docker/Testcontainers are unavailable; if they skip, record that explicitly and keep the focused test result from Step 2 as the behavioral evidence.

---

## Self-Review

- Spec coverage: U-132 asks for `Result.err` rollback or a caller-proof contract; this plan changes the shared transaction helper and proves repo side effects roll back.
- Placeholder scan: no placeholders remain.
- Type consistency: the test imports `Result` and `PlatformError` from `@rntme/platform-core`; the implementation uses a structural guard so non-`Result` callbacks remain supported.
