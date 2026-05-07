> Status: historical.
> Date: 2026-05-04.
> Current source: docs/current/**, docs/decision-system.md, and current code/tests.
> Why retained: Historical rationale and execution context retained for review; it is not current-state truth by itself.

# Runtime Derived Projection Validation Boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close U-293 by removing raw PDM/QSM artifacts from runtime derived-projection cross-validation.

**Architecture:** Add a graph-ir compiler entry point that accepts an already parsed authoring spec plus `ValidatedPdm` and `ValidatedQsm`. Runtime `crossValidateDerivedProjections` will depend only on those branded artifacts, so stale or invalid raw JSON cannot be passed to compiler-facing validation after `loadService` has already validated the artifacts.

**Tech Stack:** TypeScript strict ESM, Vitest, `@rntme/graph-ir-compiler`, `@rntme/runtime`.

---

## File Map

- Modify `packages/artifacts/graph-ir-compiler/src/projection-compile.ts` to add the validated compile entry point and share the existing projection pipeline.
- Modify `packages/artifacts/graph-ir-compiler/src/index.ts` to export the new entry point.
- Modify `packages/artifacts/graph-ir-compiler/test/integration/projection-compile.test.ts` to cover the validated API.
- Modify `packages/runtime/runtime/src/projections/cross-validate.ts` to require `AuthoringSpecOutput`, `ValidatedPdm`, and `ValidatedQsm` only.
- Modify `packages/runtime/runtime/src/load/load-service.ts` to stop passing raw PDM/QSM into derived-projection validation.
- Modify `packages/runtime/runtime/test/unit/projections/cross-validate.test.ts` to parse authoring specs before cross-validation and add a type fixture that rejects raw artifact inputs.
- Modify `packages/artifacts/graph-ir-compiler/README.md`, `packages/runtime/runtime/README.md`, `docs/audit/00-waves.md`, and `docs/audit/01-current-priority-tasks.md` for documentation-touch.

### Task 1: Failing Boundary Tests

- [x] **Step 1: Add graph-ir validated projection compile test**

In `packages/artifacts/graph-ir-compiler/test/integration/projection-compile.test.ts`, import `compileProjectionGraphFromValidated`, parse the existing `happyPathSpec`, validate the fixture PDM/QSM, and assert the derived result matches the raw API result.

- [x] **Step 2: Add runtime raw-input rejection fixture**

In `packages/runtime/runtime/test/unit/projections/cross-validate.test.ts`, import `CrossValidateInput` and add a `// @ts-expect-error` fixture proving `rawPdm` / `rawQsm` are not valid cross-validation inputs.

- [x] **Step 3: Confirm RED**

Run:

```bash
pnpm -F @rntme/graph-ir-compiler test -- test/integration/projection-compile.test.ts
pnpm -F @rntme/runtime typecheck
```

Expected before implementation: graph-ir test fails because `compileProjectionGraphFromValidated` is not exported; runtime typecheck fails because raw artifact inputs are still accepted.

### Task 2: Compiler Validated API

- [x] **Step 1: Extract validated projection compiler path**

In `packages/artifacts/graph-ir-compiler/src/projection-compile.ts`, add:

```ts
export function compileProjectionGraphFromValidated(
  spec: AuthoringSpecOutput,
  pdm: ValidatedPdm,
  qsm: ValidatedQsm,
  opts: CompileProjectionOpts,
): Result<DerivedCompileResult>
```

Have the existing `compileProjectionGraph(rawSpec, rawPdm, rawQsm, opts)` parse raw inputs, then delegate to this validated entry point.

- [x] **Step 2: Export the validated entry point**

Update `packages/artifacts/graph-ir-compiler/src/index.ts` so runtime can import `compileProjectionGraphFromValidated`.

- [x] **Step 3: Confirm graph-ir GREEN**

Run:

```bash
pnpm -F @rntme/graph-ir-compiler test -- test/integration/projection-compile.test.ts
```

Expected: PASS.

### Task 3: Runtime Boundary Cleanup

- [x] **Step 1: Tighten `CrossValidateInput`**

Change `packages/runtime/runtime/src/projections/cross-validate.ts` so `authoringSpec` is `AuthoringSpecOutput` and remove `rawPdm` / `rawQsm`. Call `compileProjectionGraphFromValidated(input.authoringSpec, input.pdm, input.qsm, ...)`.

- [x] **Step 2: Stop passing raw artifacts from `loadService`**

Update `packages/runtime/runtime/src/load/load-service.ts` to call `crossValidateDerivedProjections({ qsm: validatedQsm, authoringSpec: graphSpec, pdm: validatedPdm })`.

- [x] **Step 3: Update runtime tests**

Parse authoring specs in `cross-validate.test.ts` before calling runtime cross-validation, remove raw arguments from existing calls, and keep the raw-input `@ts-expect-error` fixture.

- [x] **Step 4: Confirm runtime GREEN**

Run:

```bash
pnpm -F @rntme/runtime typecheck
pnpm -F @rntme/runtime test -- test/unit/projections/cross-validate.test.ts
```

Expected: PASS.

### Task 4: Documentation And Audit Ledger

- [x] **Step 1: Update READMEs**

Document `compileProjectionGraphFromValidated` in the graph-ir compiler README and document that runtime derived-projection validation uses parsed/branded artifacts only.

- [x] **Step 2: Close U-293 in audit docs**

Mark U-293 `✅ closed | A10` in `docs/audit/00-waves.md`, remove it from the active priority list, and update Package D evidence.

- [x] **Step 3: Full verification**

Run:

```bash
pnpm -F @rntme/graph-ir-compiler typecheck
pnpm -F @rntme/graph-ir-compiler test
pnpm -F @rntme/graph-ir-compiler lint
pnpm -F @rntme/graph-ir-compiler build
pnpm -F @rntme/runtime typecheck
pnpm -F @rntme/runtime test
pnpm -F @rntme/runtime lint
pnpm -F @rntme/runtime build
```

Expected: all PASS.

---

## Self-Review

- Spec coverage: U-293 asks for validated/branded PDM/QSM at the compiler-facing runtime boundary; this plan removes raw artifact fields and adds a compiler API for that exact path.
- Placeholder scan: no placeholders remain.
- Type consistency: `compileProjectionGraphFromValidated`, `AuthoringSpecOutput`, `ValidatedPdm`, and `ValidatedQsm` are named consistently across compiler, runtime, tests, and docs.
