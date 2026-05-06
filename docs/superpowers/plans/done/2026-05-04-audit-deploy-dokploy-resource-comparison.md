# Dokploy Resource Comparison Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close U-078 by replacing `JSON.stringify`-based resource comparison with typed, resource-kind-aware comparison rules.

**Architecture:** Keep comparison local to `apply.ts`, because it is part of idempotent apply behavior and depends on both rendered resources and Dokploy current-state DTOs. Compare common fields explicitly (`image`, env, labels), then branch by compose/application. Treat env, labels, files, ports, and ingress routes as semantically unordered where ordering is not meaningful. Continue requiring exact strings for images and compose files.

**Tech Stack:** TypeScript strict ESM, Vitest unit tests, existing injected `DokployClient` fake.

---

## File Map

- Modify `packages/deploy/deploy-dokploy/src/apply.ts` to replace `jsonEqual` / generic optional comparison with typed comparators.
- Modify `packages/deploy/deploy-dokploy/test/unit/apply.test.ts` to cover unordered env/port/route matching and real drift detection.
- Modify `packages/deploy/deploy-dokploy/README.md`, `docs/audit/00-waves.md`, and `docs/audit/01-current-priority-tasks.md` for documentation-touch.

### Task 1: Failing Comparison Tests

- [x] **Step 1: Add unordered env test**

Add application and compose tests where existing env entries are the same as rendered entries but in a different order. Expect `action: "unchanged"` and no update call.

- [x] **Step 2: Add unordered application metadata test**

Add a test where rendered ports or ingress routes match existing state in a different order. Expect `unchanged`.

- [x] **Step 3: Add drift detection test**

Add a test proving a real env value/secret mismatch still updates.

- [x] **Step 4: Confirm RED**

Run:

```bash
pnpm -F @rntme/deploy-dokploy test -- test/unit/apply.test.ts
```

Expected before implementation: unordered env/metadata tests fail because `JSON.stringify` is order-sensitive.

### Task 2: Typed Resource Comparators

- [x] **Step 1: Replace generic JSON equality**

Remove `jsonEqual` and compare labels/files/env/ports/ingress/build via typed helpers.

- [x] **Step 2: Branch by resource kind**

Keep compose comparison to `image`, env, labels, and exact `composeFile`; keep application comparison to `image`, env, labels, optional build, ports, ingress, and files.

- [x] **Step 3: Confirm GREEN**

Run the focused apply test again.

### Task 3: Documentation, Audit, Full Verification

- [x] **Step 1: Update README**

Document resource comparison semantics and the fields intentionally ignored.

- [x] **Step 2: Close U-078 in audit docs**

Mark U-078 `✅ closed | A14`, remove it from the active priority list, and update package evidence.

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

- Spec coverage: U-078 names `jsonEqual` / `resourceMatches` and brittle `JSON.stringify`; this plan removes that comparison path.
- Behavior safety: matching ignores only ordering and undeclared API fields; real field value drift still updates.
- Documentation-touch: package README and audit docs land with the code.
