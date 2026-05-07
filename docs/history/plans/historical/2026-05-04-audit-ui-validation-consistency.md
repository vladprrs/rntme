> Status: historical.
> Date: 2026-05-04.
> Current source: docs/current/**, docs/decision-system.md, and current code/tests.
> Why retained: Historical rationale and execution context retained for review; it is not current-state truth by itself.

# UI Validation Consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close U-323, U-324, and U-326 by making the reserved UI consistency error codes real and covered by tests.

**Architecture:** Extend the existing reference/consistency validator without adding package dependencies. `resolveBinding` keeps accepting opaque resolver objects, but the UI validator reads optional `kind` metadata from either `{ kind }` or `{ entry: { kind } }`; component prop schemas are already available through `resolveComponent`, so literal prop type mismatches can emit `TYPE_MISMATCH`; command/data input state paths can emit `UNCOVERED_INPUT` when they reference uncovered state.

**Tech Stack:** TypeScript strict ESM, Vitest, `@rntme/ui` validators.

---

## File Map

- Modify `packages/artifacts/ui/src/validate/resolvers-type.ts` to document optional binding metadata returned by `resolveBinding`.
- Modify `packages/artifacts/ui/src/validate/references.ts` to emit `BINDING_KIND_MISMATCH`, `TYPE_MISMATCH`, and `UNCOVERED_INPUT`.
- Modify `packages/artifacts/ui/test/unit/validate.test.ts` to add failing coverage for the three codes.
- Modify `packages/artifacts/ui/README.md`, `docs/audit/00-waves.md`, and `docs/audit/01-current-priority-tasks.md` for documentation-touch.

### Task 1: Failing Consistency Tests

- [x] **Step 1: Add binding-kind mismatch tests**

In `validate.test.ts`, add one data-binding test where `resolveBinding` returns `{ kind: 'command' }` and one command-action test where it returns `{ kind: 'query' }`. Both should expect `BINDING_KIND_MISMATCH`.

- [x] **Step 2: Add component prop type mismatch test**

Add a test where `resolveComponent` declares a required `number` prop and a screen element supplies a string literal. Expect `TYPE_MISMATCH`.

- [x] **Step 3: Add uncovered input test**

Add a test where a command action maps `paramsFromState: { title: '/missing/title' }` without a covering data binding or allowed prefix. Expect `UNCOVERED_INPUT`.

- [x] **Step 4: Confirm RED**

Run:

```bash
pnpm -F @rntme/ui test -- test/unit/validate.test.ts
```

Expected before implementation: the new tests fail because those codes are not emitted.

### Task 2: Emit Reserved Codes

- [x] **Step 1: Add optional binding descriptor type**

Change `ValidateResolvers.resolveBinding` to return a `BindingDescriptor | undefined`, where `BindingDescriptor` allows arbitrary properties plus optional `kind?: 'query' | 'command'` and optional `entry?: { kind?: 'query' | 'command' }`.

- [x] **Step 2: Validate binding kind metadata**

In `validateReferences`, inspect resolved binding metadata. Data bindings expect `query`; command actions expect `command`. Unknown/missing kind stays accepted for compatibility.

- [x] **Step 3: Validate input state coverage**

In `validateReferences`, check `screen.data[*].params` `$state` values and command/navigation `paramsFromState` values against the same covered-state rules. Emit `UNCOVERED_INPUT` instead of overloading `UNCOVERED_STATE_PATH`.

- [x] **Step 4: Validate literal component prop types**

In `validateComponentTypesAndProps`, for each declared component prop with a present literal value, emit `TYPE_MISMATCH` when the value does not match the prop schema. Keep `$state` values accepted because their runtime value is dynamic.

- [x] **Step 5: Confirm GREEN**

Run:

```bash
pnpm -F @rntme/ui test -- test/unit/validate.test.ts
```

Expected: PASS.

### Task 3: Documentation And Audit Ledger

- [x] **Step 1: Update UI README**

Document that binding-kind metadata is optional but consumed when present, and remove the stale "No binding-kind checking" / "No consistency phase" out-of-scope statements.

- [x] **Step 2: Close U-323/U-324/U-326 in audit docs**

Mark U-323, U-324, and U-326 `✅ closed | A12`, remove the grouped row from the active priority list, and add package evidence.

- [x] **Step 3: Full verification**

Run:

```bash
pnpm -F @rntme/ui typecheck
pnpm -F @rntme/ui test
pnpm -F @rntme/ui lint
pnpm -F @rntme/ui build
```

Expected: all PASS.

Observed: `test` and `build` passed; this package has no `typecheck` or `lint`
script, so pnpm reported no selected package scripts for those commands.

---

## Self-Review

- Spec coverage: the plan implements the exact reserved codes named by U-324 and U-326, and adds tests that close U-323's coverage gap for those codes.
- Placeholder scan: no placeholders remain.
- Type consistency: `BindingDescriptor`, `BINDING_KIND_MISMATCH`, `TYPE_MISMATCH`, and `UNCOVERED_INPUT` are used consistently across validator, tests, and docs.
