# RNT-277 Graph IR Error Boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close audit unit U-215 by removing direct generic `throw new Error` usage from `@rntme/graph-ir-compiler/src` and keeping public package boundaries on typed errors/results.

**Architecture:** Keep the narrow behavioral contract: compile-like public APIs return `Result<T>`, runtime execution APIs may still throw typed package errors (`CommandExecutionError` or a new runtime error class) because current callers/tests expect throwing execution. Introduce package-owned error helpers/classes in `src/types/errors.ts`; use them for internal invariant panics and wrap `GraphIrInternalError` in Result-returning APIs (`compile`, `compileCommand`, `compileProjectionGraph`, `explain`). Do not refactor the full duplicated pipeline in this task.

**Tech Stack:** TypeScript ESM, Vitest, pnpm workspace package `@rntme/graph-ir-compiler`.

---

### Task 1: Tests For Boundary Convention

**Files:**
- Modify: `packages/graph-ir-compiler/test/unit/types/error-coverage.test.ts`
- Modify: `packages/graph-ir-compiler/test/unit/api.test.ts`

- [ ] **Step 1: Add a failing source-convention test**

In `packages/graph-ir-compiler/test/unit/types/error-coverage.test.ts`, add this test inside the existing `describe('error code coverage', ...)` block after the `allText` declaration:

```ts
  it('does not throw generic Error directly from src', () => {
    expect(allText).not.toContain('throw new Error');
    expect(allText).not.toContain('Object.assign(new Error');
  });
```

- [ ] **Step 2: Add failing public-boundary wrapping tests**

In `packages/graph-ir-compiler/test/unit/api.test.ts`, extend imports and add these cases:

```ts
import { compile, explain, run } from '../../src/index.js';

it('returns a lowering error instead of throwing when compile hits an internal lowering invariant', () => {
  const bad = {
    ...spec,
    graphs: {
      g: {
        ...spec.graphs.g,
        nodes: [],
      },
    },
  };

  const r = compile(bad, P, Q);

  expect(r.ok).toBe(false);
  if (!r.ok) {
    expect(r.errors[0]).toMatchObject({
      layer: 'lowering',
      code: 'LOWERING_INTERNAL_ERROR',
    });
  }
});

it('explain returns a lowering error instead of throwing when lowering fails', () => {
  const bad = {
    ...spec,
    graphs: {
      g: {
        ...spec.graphs.g,
        nodes: [],
      },
    },
  };

  const r = explain(bad, P, Q);

  expect(r.ok).toBe(false);
  if (!r.ok) {
    expect(r.errors[0]).toMatchObject({
      layer: 'lowering',
      code: 'LOWERING_INTERNAL_ERROR',
    });
  }
});

it('run throws a package compile error with structured errors on compile failure', () => {
  const bad = {
    ...spec,
    graphs: {
      ...spec.graphs,
      g: {
        ...spec.graphs.g,
        signature: { inputs: {}, output: { type: 'rowset<OrderItem>', from: 'ghost' } },
      },
    },
  };

  expect(() => run(bad, P, Q, {}, { prepare: () => ({ all: () => [] }) } as never)).toThrow('compile failed');
});
```

Expected RED command:

```bash
pnpm -F @rntme/graph-ir-compiler vitest run test/unit/types/error-coverage.test.ts test/unit/api.test.ts
```

Expected result: source-convention test fails because `src/` still contains `throw new Error`, and boundary tests fail because `LOWERING_INTERNAL_ERROR` is not registered/wrapped.

### Task 2: Package Error Helpers

**Files:**
- Create: `packages/graph-ir-compiler/src/types/errors.ts`
- Modify: `packages/graph-ir-compiler/src/types/result.ts`

- [ ] **Step 1: Add error codes**

Add these codes to `ERROR_CODES` in `src/types/result.ts`:

```ts
  LOWERING_INTERNAL_ERROR: 'LOWERING_INTERNAL_ERROR',
  RUNTIME_INTERNAL_ERROR: 'RUNTIME_INTERNAL_ERROR',
```

- [ ] **Step 2: Add typed package errors**

Create `packages/graph-ir-compiler/src/types/errors.ts`:

```ts
import type { GraphIrError, Layer } from './result.js';
import { ERROR_CODES } from './result.js';

export class GraphIrInternalError extends Error {
  readonly graphIrError: GraphIrError;

  constructor(error: GraphIrError) {
    super(error.message);
    this.name = 'GraphIrInternalError';
    this.graphIrError = error;
  }
}

export class GraphIrRuntimeError extends Error {
  readonly code: 'RUNTIME_MISSING_REQUIRED_PARAM' | 'RUNTIME_SQLITE_ERROR' | 'RUNTIME_INTERNAL_ERROR';

  constructor(code: GraphIrRuntimeError['code'], message: string) {
    super(message);
    this.name = 'GraphIrRuntimeError';
    this.code = code;
  }
}

export function internalError(layer: Layer, message: string, cause?: unknown): GraphIrInternalError {
  const code = layer === 'runtime' ? ERROR_CODES.RUNTIME_INTERNAL_ERROR : ERROR_CODES.LOWERING_INTERNAL_ERROR;
  return new GraphIrInternalError({
    layer,
    code,
    message,
    hint: cause instanceof Error ? cause.message : cause === undefined ? undefined : String(cause),
  });
}

export function runtimeError(
  code: GraphIrRuntimeError['code'],
  message: string,
): GraphIrRuntimeError {
  return new GraphIrRuntimeError(code, message);
}

export function toGraphIrError(error: unknown, layer: Layer): GraphIrError {
  if (error instanceof GraphIrInternalError) return error.graphIrError;
  return internalError(layer, error instanceof Error ? error.message : String(error)).graphIrError;
}
```

### Task 3: Replace Generic Throws

**Files:**
- Modify every `packages/graph-ir-compiler/src/**/*.ts` file currently matched by `grep -R "throw new Error\\|Object.assign(new Error" packages/graph-ir-compiler/src`

- [ ] **Step 1: Replace internal invariant throws**

In lowering/canonical/relational/emit helper files, import `internalError` and replace generic throws with:

```ts
throw internalError('lowering', `existing message`);
```

Use `layer: 'canonical'` in `src/canonical/normalize.ts`, `layer: 'relational'` in `src/relational/build.ts`, and `layer: 'runtime'` for command-runtime invariant throws that are not already `CommandExecutionError`.

- [ ] **Step 2: Replace runtime execution generic throws**

In `src/execute/execute.ts`, replace `Object.assign(new Error(...), { code })` with `throw runtimeError(code, message)`.

- [ ] **Step 3: Replace run/runCommand compile failure throws**

In `src/index.ts`, use a package-owned helper or local class so direct `Object.assign(new Error(...))` no longer appears in `src/`. Preserve the observable behavior that thrown compile failures have message `compile failed` and an `errors` property.

### Task 4: Wrap Result-Returning Public APIs

**Files:**
- Modify: `packages/graph-ir-compiler/src/index.ts`
- Modify: `packages/graph-ir-compiler/src/command-runtime/compile.ts`
- Modify: `packages/graph-ir-compiler/src/projection-compile.ts`

- [ ] **Step 1: Wrap `compile` and `explain`**

Catch internal errors only around stages that can still panic (`normalize`, `buildRelational`, `lowerToSqlite`, `emitSql`) and return:

```ts
return err([toGraphIrError(e, 'lowering')]);
```

Use the exact layer where practical (`canonical`, `relational`, `lowering`).

- [ ] **Step 2: Wrap `compileCommand`**

Wrap command compile internals, especially read-prelude lowering, so compile-time internal failures return `Result.err`.

- [ ] **Step 3: Wrap `compileProjectionGraph`**

Replace the existing catch body so `lowerToEventDelta` failures use `toGraphIrError(e, 'lowering')` and retain `location: { graphId: graph.id }` when the internal error lacks location.

### Task 5: Verification And Docs Decision

**Files:**
- Modify: `packages/graph-ir-compiler/README.md` only if public behavior changes.

- [ ] **Step 1: Run focused RED/GREEN command**

```bash
pnpm -F @rntme/graph-ir-compiler vitest run test/unit/types/error-coverage.test.ts test/unit/api.test.ts
```

Expected GREEN: both files pass.

- [ ] **Step 2: Run package gates**

```bash
pnpm -F @rntme/graph-ir-compiler typecheck
pnpm -F @rntme/graph-ir-compiler test
```

Expected GREEN: typecheck and all package tests pass.

- [ ] **Step 3: Confirm U-215 closure evidence**

```bash
find packages/graph-ir-compiler/src -type f -name '*.ts' -print0 | xargs -0 grep -n "throw new Error" || true
```

Expected: no output.

- [ ] **Step 4: Documentation decision**

If runtime APIs still throw typed errors and public compile APIs still return `Result<T>`, record "No README update needed; API behavior remains compatible except generic internal errors are now package-coded" in the final review. Update README only if signatures or documented behavior changed.
