> Status: historical.
> Date: 2026-05-04.
> Current source: docs/current/**, docs/decision-system.md, and current code/tests.
> Why retained: Historical rationale and execution context retained for review; it is not current-state truth by itself.

# Deploy Dokploy Partial Apply Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close U-079 by cleaning up resources created during a failed Dokploy apply and recording deterministic cleanup metadata for retries.

**Architecture:** `applyDokployPlan` already tracks applied resources and has an idempotent `deleteDokployResources` helper. On partial failure, the adapter will delete resources whose action was `created`, leave pre-existing updated resources in place, and include a `cleanup` report in `partialFailure`; `retrySafe` remains true only when cleanup has no errors.

**Tech Stack:** TypeScript strict ESM, Vitest, Dokploy client seam.

---

## File Map

- Modify `packages/deploy/deploy-dokploy/src/errors.ts` to add cleanup metadata to `DokployPartialFailure` and make `retrySafe` boolean.
- Modify `packages/deploy/deploy-dokploy/src/apply.ts` to call `deleteDokployResources` for created resources on partial failure and include cleanup metadata.
- Modify `packages/deploy/deploy-dokploy/test/unit/apply.test.ts` to prove cleanup happens and cleanup failures are represented.
- Modify `packages/deploy/deploy-dokploy/README.md`, `docs/audit/00-waves.md`, and `docs/audit/01-current-priority-tasks.md` for documentation-touch.

### Task 1: Cleanup Regression Tests

- [x] **Step 1: Write failing cleanup success test**

Add a test where resource A is created, resource B fails during create, and assert:

```ts
expect(client.deletedApplications).toEqual(['app_1']);
expect(error.partialFailure.cleanup).toMatchObject({
  attempted: true,
  deletedResources: [expect.objectContaining({ targetResourceId: 'app_1' })],
  errors: [],
});
expect(error.partialFailure.retrySafe).toBe(true);
```

- [x] **Step 2: Write failing cleanup failure test**

Add a test where resource A is created, resource B fails, and deleting A fails. Assert cleanup errors are recorded and `retrySafe` is `false`.

- [x] **Step 3: Confirm RED**

Run: `pnpm -F @rntme/deploy-dokploy test -- test/unit/apply.test.ts`

Expected before implementation: FAIL because cleanup is not attempted and no cleanup metadata exists.

### Task 2: Apply Cleanup Implementation

- [x] **Step 1: Extend error types**

Add:

```ts
export type DokployPartialFailureCleanup = {
  readonly attempted: true;
  readonly deletedResources: readonly DokployPartialFailureResource[];
  readonly warnings: readonly string[];
  readonly errors: readonly {
    readonly code: DokployDeploymentErrorCode;
    readonly message: string;
    readonly resource?: string;
    readonly cause?: unknown;
  }[];
};
```

Then add `cleanup: DokployPartialFailureCleanup` to `DokployPartialFailure` and change `retrySafe` to `boolean`.

- [x] **Step 2: Make partialFailure async and client-aware**

Import `deleteDokployResources` into `apply.ts`. Change `partialFailure(...)` to accept `client`, compute `createdResources`, call delete for those resources, and pass cleanup metadata into `buildPartialFailure(...)`.

- [x] **Step 3: Preserve updated resource metadata**

Do not attempt to rollback resources whose action is `updated`; leave them in `updatedResources` so the platform failed-state log can show that external state may have changed.

- [x] **Step 4: Run apply tests**

Run: `pnpm -F @rntme/deploy-dokploy test -- test/unit/apply.test.ts`

Expected: PASS.

### Task 3: Documentation And Audit Ledger

- [x] **Step 1: Update README**

Document partial apply cleanup: newly created resources are deleted on failure; updated resources are recorded, not rolled back; cleanup errors make `retrySafe: false`.

- [x] **Step 2: Close U-079 in audit docs**

Mark U-079 `✅ closed | A5`, remove it from the active priority table, and update Package C evidence.

- [x] **Step 3: Full verification**

Run:

```bash
pnpm -F @rntme/deploy-dokploy typecheck
pnpm -F @rntme/deploy-dokploy test
pnpm -F @rntme/deploy-dokploy lint
pnpm -F @rntme/deploy-dokploy build
```

Expected: all PASS.

---

## Self-Review

- Spec coverage: U-079 asks for rollback/cleanup or deterministic failed-state recording; this plan does both for created resources and records updated resources as non-rollback state.
- Placeholder scan: no placeholders remain.
- Type consistency: cleanup metadata uses existing apply-resource shapes and sanitized delete errors.
