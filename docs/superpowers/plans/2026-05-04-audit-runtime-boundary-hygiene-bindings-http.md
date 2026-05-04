# Bindings HTTP Runtime Boundary Hygiene Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close U-031 and U-355 by making `@rntme/bindings-http` accept typed graph runtime inputs and emit structured startup errors for missing runtime dependencies.

**Architecture:** `@rntme/graph-ir-compiler` owns the parsed Graph IR authoring type, while `@rntme/pdm` and `@rntme/qsm` own their branded validated artifacts. `@rntme/bindings-http` will import those public owner types into a small runtime-input type and use `BindingsRuntimeError` for startup dependency failures instead of raw `Error`.

**Tech Stack:** TypeScript strict ESM, Vitest, Hono, `@rntme/graph-ir-compiler`, `@rntme/pdm`, `@rntme/qsm`.

---

## File Map

- Modify `packages/artifacts/graph-ir-compiler/src/index.ts` to export `AuthoringSpecInput` and `AuthoringSpecOutput`.
- Modify `packages/artifacts/graph-ir-compiler/README.md` to document the new public authoring-spec types.
- Create `packages/runtime/bindings-http/src/startup/runtime-inputs.ts` for `RuntimeGraphSpec` and `BindingsGraphRuntimeInputs`.
- Modify `packages/runtime/bindings-http/src/startup/compile-plan.ts` to use typed graph runtime inputs.
- Modify `packages/runtime/bindings-http/src/router.ts` to use `BindingsGraphRuntimeInputs` and typed startup dependency errors.
- Modify `packages/runtime/bindings-http/src/errors.ts` to add structured startup dependency causes.
- Modify `packages/runtime/bindings-http/src/index.ts` to export the new runtime-input and startup-error types.
- Modify `packages/runtime/bindings-http/test/unit/public-api.test.ts`, `test/unit/errors.test.ts`, `test/integration/command-routing.test.ts`, and compile-plan/router tests to cover the new behavior and typed boundaries.
- Modify `packages/runtime/bindings-http/README.md`, `docs/audit/00-waves.md`, and `docs/audit/01-current-priority-tasks.md` for the documentation-touch task.

### Task 1: Export Owner Graph Types

**Files:**
- Modify: `packages/artifacts/graph-ir-compiler/src/index.ts`
- Modify: `packages/artifacts/graph-ir-compiler/README.md`

- [x] **Step 1: Add the failing type import at the consumer boundary**

Add `AuthoringSpecOutput` as a type import in `packages/runtime/bindings-http/src/startup/compile-plan.ts`. Before the graph compiler exports the type, `pnpm -F @rntme/bindings-http typecheck` must fail with a missing export.

- [x] **Step 2: Export the graph owner type**

In `packages/artifacts/graph-ir-compiler/src/index.ts`, add:

```ts
export type { AuthoringSpecInput, AuthoringSpecOutput } from './parse/schema.js';
```

- [x] **Step 3: Document the owner type**

In `packages/artifacts/graph-ir-compiler/README.md`, add `AuthoringSpecInput` / `AuthoringSpecOutput` to the exported type list as the parsed Graph IR authoring schema input/output types.

- [x] **Step 4: Verify the graph compiler still builds**

Run: `pnpm -F @rntme/graph-ir-compiler build`

Expected: PASS.

### Task 2: Type The Bindings Runtime Graph Inputs

**Files:**
- Create: `packages/runtime/bindings-http/src/startup/runtime-inputs.ts`
- Modify: `packages/runtime/bindings-http/src/startup/compile-plan.ts`
- Modify: `packages/runtime/bindings-http/src/router.ts`
- Modify: `packages/runtime/bindings-http/src/index.ts`
- Test: `packages/runtime/bindings-http/test/unit/public-api.test.ts`

- [x] **Step 1: Write the boundary type test**

Add compile-time assertions in `public-api.test.ts` using Vitest `expectTypeOf`:

```ts
expectTypeOf<api.BindingsRouterOptions['graphSpec']>().toEqualTypeOf<api.RuntimeGraphSpec>();
expectTypeOf<api.BindingsRouterOptions['pdm']>().toEqualTypeOf<api.ValidatedPdm>();
expectTypeOf<api.BindingsRouterOptions['qsm']>().toEqualTypeOf<api.ValidatedQsm>();
```

Run: `pnpm -F @rntme/bindings-http typecheck`

Expected before implementation: FAIL because these exported types do not exist and `BindingsRouterOptions` still uses `unknown`.

- [x] **Step 2: Add typed runtime inputs**

Create `runtime-inputs.ts`:

```ts
import type {
  AuthoringSpecOutput,
  ValidatedPdm,
  ValidatedQsm,
} from '@rntme/graph-ir-compiler';

export type RuntimeGraphSpec = AuthoringSpecOutput;

export type BindingsGraphRuntimeInputs = Readonly<{
  graphSpec: RuntimeGraphSpec;
  pdm: ValidatedPdm;
  qsm: ValidatedQsm;
}>;

export type { ValidatedPdm, ValidatedQsm };
```

- [x] **Step 3: Replace `unknown` in compile-plan**

Use `RuntimeGraphSpec`, `ValidatedPdm`, and `ValidatedQsm` in `compileForGraph`, `compileCommandForGraph`, `buildDefaultGraphIrCommandMap`, `buildDefaultGraphIrQueryMap`, and `buildPlan`.

- [x] **Step 4: Replace `unknown` in router options**

Make `BindingsRouterOptions` extend `BindingsGraphRuntimeInputs` instead of declaring `graphSpec`, `pdm`, and `qsm` as `unknown`.

- [x] **Step 5: Export public types**

From `src/index.ts`, export `RuntimeGraphSpec`, `BindingsGraphRuntimeInputs`, `ValidatedPdm`, and `ValidatedQsm`.

- [x] **Step 6: Verify the type test is green**

Run: `pnpm -F @rntme/bindings-http typecheck`

Expected: PASS or only test fixture call-site failures that need typed fixture normalization in Task 4.

### Task 3: Replace Raw Startup Dependency Errors

**Files:**
- Modify: `packages/runtime/bindings-http/src/errors.ts`
- Modify: `packages/runtime/bindings-http/src/router.ts`
- Test: `packages/runtime/bindings-http/test/unit/errors.test.ts`
- Test: `packages/runtime/bindings-http/test/integration/command-routing.test.ts`

- [x] **Step 1: Write failing structured-error tests**

Update command-routing startup tests to expect `BindingsRuntimeError` and inspect:

```ts
expect(error.errors[0]?.cause).toMatchObject({
  code: 'BINDINGS_HTTP_STARTUP_MISSING_RUNTIME_DEPENDENCY',
  dependency: 'eventStore',
});
```

Add the equivalent assertion for `commandExecutor`.

- [x] **Step 2: Add startup dependency cause types**

In `errors.ts`, add:

```ts
export const BINDINGS_HTTP_STARTUP_ERROR_CODES = {
  MISSING_RUNTIME_DEPENDENCY: 'BINDINGS_HTTP_STARTUP_MISSING_RUNTIME_DEPENDENCY',
} as const;

export type StartupDependencyName =
  | 'eventStore'
  | 'commandExecutor'
  | 'externalAdapterClient';

export type MissingRuntimeDependencyCause = Readonly<{
  code: typeof BINDINGS_HTTP_STARTUP_ERROR_CODES.MISSING_RUNTIME_DEPENDENCY;
  dependency: StartupDependencyName;
  message: string;
}>;
```

Add `missingRuntimeDependencyError(entry, dependency)` that returns a `BindingsRuntimeError` with one `RuntimeErrorEntry`.

- [x] **Step 3: Throw structured startup errors in router**

Replace the three `throw new Error(...)` branches in `router.ts` with `throw missingRuntimeDependencyError(...)`. Use the first command binding for `eventStore`/`commandExecutor`, and the first binding with `pre[]` for `externalAdapterClient`.

- [x] **Step 4: Run startup-error tests**

Run: `pnpm -F @rntme/bindings-http test -- test/integration/command-routing.test.ts test/unit/errors.test.ts`

Expected: PASS.

### Task 4: Normalize Test Fixtures Through Owner Validators

**Files:**
- Modify: `packages/runtime/bindings-http/test/unit/compile-plan.test.ts`
- Modify: `packages/runtime/bindings-http/test/unit/build-plan.test.ts`
- Modify: `packages/runtime/bindings-http/test/unit/handler.test.ts`
- Modify: `packages/runtime/bindings-http/test/unit/command-handler.test.ts`
- Modify: `packages/runtime/bindings-http/test/integration/router.test.ts`
- Modify: `packages/runtime/bindings-http/test/integration/command-routing.test.ts`
- Modify: `packages/runtime/bindings-http/test/integration/idempotency.test.ts`
- Modify: `packages/runtime/bindings-http/test/integration/callback-binding.test.ts`

- [x] **Step 1: Replace untyped fixture constants**

For every call to `buildPlan`, `compileForGraph`, and `createBindingsRouter`, make the graph spec come from `parseAuthoringSpec(raw).value`, and PDM/QSM from `parsePdm → validatePdm` and `parseQsm → validateQsm`.

- [x] **Step 2: Avoid local casts**

Do not use `as ValidatedPdm`, `as ValidatedQsm`, or `as RuntimeGraphSpec` at call sites. If a test needs an intentionally broken graph spec, parse a schema-valid spec that fails semantic/canonical compilation.

- [x] **Step 3: Run package typecheck**

Run: `pnpm -F @rntme/bindings-http typecheck`

Expected: PASS.

### Task 5: Documentation And Audit Ledger

**Files:**
- Modify: `packages/runtime/bindings-http/README.md`
- Modify: `docs/audit/00-waves.md`
- Modify: `docs/audit/01-current-priority-tasks.md`

- [x] **Step 1: Update bindings-http README**

Document that `createBindingsRouter` and compile-plan helpers consume `RuntimeGraphSpec`, `ValidatedPdm`, and `ValidatedQsm`, and that missing runtime dependencies throw `BindingsRuntimeError` with code `BINDINGS_HTTP_STARTUP_MISSING_RUNTIME_DEPENDENCY`.

- [x] **Step 2: Close U-031 and U-355 in audit docs**

Mark U-031 and U-355 `✅ closed | A3`, remove them from the active priority table, and add evidence in Package D.

- [x] **Step 3: Full verification**

Run:

```bash
pnpm -F @rntme/graph-ir-compiler build
pnpm -F @rntme/bindings-http typecheck
pnpm -F @rntme/bindings-http test
pnpm -F @rntme/bindings-http build
```

Expected: all PASS.

---

## Self-Review

- Spec coverage: U-031 is covered by exported owner graph types plus branded PDM/QSM router and compile-plan signatures. U-355 is covered by structured `BindingsRuntimeError` startup dependency causes.
- Placeholder scan: no TBD or deferred code steps remain.
- Type consistency: `RuntimeGraphSpec`, `BindingsGraphRuntimeInputs`, `ValidatedPdm`, and `ValidatedQsm` are used consistently across router, compile-plan, tests, and README.
