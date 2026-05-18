> Status: historical.
> Date: 2026-05-08.
> Current source: docs/current/**, docs/decision-system.md, and current code/tests.
> Why retained: Completed RNT-499 execution plan retained as historical rationale and handoff context; it is not current-state truth by itself.

# Blueprint Binding Scalars Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `@rntme/blueprint` validate binding scalar primitives through the public runtime scalar source owned by `@rntme/bindings`.

**Architecture:** Promote the existing bindings scalar union into a value-backed contract in `@rntme/bindings`: one exported tuple plus one exported type guard, with `ScalarPrimitive` derived from the tuple. Then remove blueprint's local `SCALARS` set and call the bindings guard from `createServiceBindingResolvers(...)`. Tests pin the bindings contract and prove blueprint accepts every scalar exported by bindings while rejecting unsupported scalar names.

**Tech Stack:** TypeScript strict ESM, Vitest, workspace packages `@rntme/bindings`, `@rntme/blueprint`, `@rntme/pdm`, dependency-cruiser.

---

## File Map

- Modify `packages/artifacts/bindings/src/types/resolvers.ts`: add `SCALAR_PRIMITIVES`, derive `ScalarPrimitive` from it, and add `isScalarPrimitive(value)`.
- Modify `packages/artifacts/bindings/src/index.ts`: re-export `SCALAR_PRIMITIVES` and `isScalarPrimitive` as public runtime exports while keeping resolver types type-only.
- Modify `packages/artifacts/bindings/test/unit/types/resolvers.test.ts`: test the public scalar tuple, guard acceptance, guard rejection, and type compatibility.
- Create `packages/artifacts/blueprint/test/unit/binding-resolvers.test.ts`: focused unit tests for scalar acceptance and rejection through `createServiceBindingResolvers(...)`.
- Modify `packages/artifacts/blueprint/src/compose/binding-resolvers.ts`: import `isScalarPrimitive` from `@rntme/bindings`, remove local `SCALARS`, and rewrite `parseScalar`.
- Modify `docs/current/owners/packages/artifacts/bindings.md`: document the public scalar primitive source/helper.
- Modify `docs/current/owners/packages/artifacts/blueprint.md`: document that blueprint consumes bindings' scalar helper and must not maintain a separate scalar list.
- Do not modify `packages/artifacts/bindings/README.md` or `packages/artifacts/blueprint/README.md`: current-doc links and local command hints stay correct.
- Do not modify `docs/decision-system.md`: this follows G4/F3 canonical contracts and G5/F2 one canonical way without changing strategy, architecture, or conventions.

## Current Truth

- `packages/artifacts/bindings/src/types/resolvers.ts` currently defines `ScalarPrimitive` as a type-only union of `integer`, `decimal`, `string`, `boolean`, `date`, and `datetime`.
- `packages/artifacts/bindings/src/index.ts` currently re-exports `ScalarPrimitive` only as a type and has no scalar runtime export.
- `packages/artifacts/blueprint/src/compose/binding-resolvers.ts` imports the bindings `ScalarPrimitive` type, but lines 20-27 define a local `SCALARS` set with the same six literals.
- `parseScalar` currently checks the local set with casts, so blueprint can drift from bindings when bindings changes.
- `@rntme/blueprint` already depends on `@rntme/bindings`; this issue must preserve that direction and must not add a dependency from bindings to blueprint, PDM, or runtime packages.
- `packages/artifacts/bindings/test/unit/types/resolvers.test.ts` already has a resolver-type smoke test and a local scalar array; replace that local scalar proof with assertions against the public export.
- There is no focused blueprint unit test for `createServiceBindingResolvers(...)`; add one instead of broadening smoke fixture tests.

### Task 1: Bindings Scalar Runtime Contract

**Files:**
- Modify `packages/artifacts/bindings/test/unit/types/resolvers.test.ts`
- Modify `packages/artifacts/bindings/src/types/resolvers.ts`
- Modify `packages/artifacts/bindings/src/index.ts`

- [ ] **Step 1: Write failing bindings scalar tests**

Update imports in `packages/artifacts/bindings/test/unit/types/resolvers.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  SCALAR_PRIMITIVES,
  isScalarPrimitive,
  type BindingResolvers,
  type GraphSignature,
  type ResolvedShape,
  type ScalarPrimitive,
} from '../../../src/types/resolvers.js';
```

Replace the local `const primitives: ScalarPrimitive[] = [...]` assertion inside the existing `compiles a minimal valid resolver` test with:

```ts
const primitives: ScalarPrimitive[] = [...SCALAR_PRIMITIVES];
expect(primitives).toEqual([
  'integer',
  'decimal',
  'string',
  'boolean',
  'date',
  'datetime',
]);
```

Add two tests below the existing resolver smoke test:

```ts
it('exports scalar primitives in canonical order', () => {
  expect(SCALAR_PRIMITIVES).toEqual([
    'integer',
    'decimal',
    'string',
    'boolean',
    'date',
    'datetime',
  ]);
});

it('guards scalar primitive strings at runtime', () => {
  for (const primitive of SCALAR_PRIMITIVES) {
    expect(isScalarPrimitive(primitive)).toBe(true);
  }

  expect(isScalarPrimitive('uuid')).toBe(false);
  expect(isScalarPrimitive('json')).toBe(false);
  expect(isScalarPrimitive('')).toBe(false);
});
```

- [ ] **Step 2: Run focused bindings tests and confirm RED**

Run:

```bash
pnpm -F @rntme/bindings test -- test/unit/types/resolvers.test.ts
```

Expected before implementation: FAIL with missing exports `SCALAR_PRIMITIVES` and `isScalarPrimitive`.

- [ ] **Step 3: Implement the bindings runtime scalar source**

In `packages/artifacts/bindings/src/types/resolvers.ts`, replace the current type-only `ScalarPrimitive` union with a value-backed type and guard:

```ts
export const SCALAR_PRIMITIVES = [
  'integer',
  'decimal',
  'string',
  'boolean',
  'date',
  'datetime',
] as const;

export type ScalarPrimitive = (typeof SCALAR_PRIMITIVES)[number];

const scalarPrimitiveSet: ReadonlySet<string> = new Set(SCALAR_PRIMITIVES);

export function isScalarPrimitive(value: string): value is ScalarPrimitive {
  return scalarPrimitiveSet.has(value);
}
```

Keep the rest of the resolver types using `ScalarPrimitive` unchanged.

- [ ] **Step 4: Re-export bindings scalar helpers from the public barrel**

In `packages/artifacts/bindings/src/index.ts`, add a value export before the resolver type export block:

```ts
export {
  SCALAR_PRIMITIVES,
  isScalarPrimitive,
} from './types/resolvers.js';
```

Keep `ScalarPrimitive` in the existing `export type { ... } from './types/resolvers.js';` block. Do not export the private `scalarPrimitiveSet`.

- [ ] **Step 5: Run bindings scalar tests and build**

Run:

```bash
pnpm -F @rntme/bindings test -- test/unit/types/resolvers.test.ts
pnpm -F @rntme/bindings build
```

Expected: PASS.

- [ ] **Step 6: Commit the bindings scalar contract**

Run:

```bash
git add packages/artifacts/bindings/src/types/resolvers.ts packages/artifacts/bindings/src/index.ts packages/artifacts/bindings/test/unit/types/resolvers.test.ts
git commit -m "fix(bindings): export scalar primitive runtime helpers"
```

Expected: commit succeeds with only bindings source/test changes staged.

### Task 2: Blueprint Uses Bindings Scalar Contract

**Files:**
- Create `packages/artifacts/blueprint/test/unit/binding-resolvers.test.ts`
- Modify `packages/artifacts/blueprint/src/compose/binding-resolvers.ts`

- [ ] **Step 1: Write focused failing blueprint tests**

Create `packages/artifacts/blueprint/test/unit/binding-resolvers.test.ts`:

```ts
import { SCALAR_PRIMITIVES } from '@rntme/bindings';
import type { PdmResolver } from '@rntme/pdm';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createServiceBindingResolvers } from '../../src/compose/binding-resolvers.js';
import type { ServiceGraphSpec } from '../../src/types/artifact.js';
import { ERROR_CODES } from '../../src/types/result.js';

const emptyPdmResolver: PdmResolver = {
  listEntities: () => [],
  resolveEntity: () => null,
  resolveField: () => null,
  resolveStateMachine: () => null,
  resolveTransition: () => null,
};

function graphSpecWithScalar(primitive: string): ServiceGraphSpec {
  return {
    version: '1.0-rc7',
    shapes: {
      ScalarRow: {
        fields: {
          value: { type: primitive, nullable: false },
          values: { type: `array<${primitive}>`, nullable: true },
        },
      },
    },
    graphs: {
      readScalar: {
        id: 'readScalar',
        signature: {
          inputs: {
            value: { type: primitive, mode: 'required' },
          },
          output: { type: 'rowset<ScalarRow>', from: 'rows' },
        },
        nodes: [],
      },
    },
  };
}

describe('createServiceBindingResolvers scalar primitives', () => {
  it('delegates scalar validation to bindings without a local scalar set', () => {
    const source = readFileSync(
      fileURLToPath(new URL('../../src/compose/binding-resolvers.ts', import.meta.url)),
      'utf8',
    );

    expect(source).toContain('isScalarPrimitive');
    expect(source).not.toContain('const SCALARS');
    expect(source).not.toContain('new Set([');
  });

  it.each([...SCALAR_PRIMITIVES])(
    'accepts bindings scalar primitive %s in shapes and graph inputs',
    (primitive) => {
      const result = createServiceBindingResolvers({
        serviceSlug: 'catalog',
        graphSpec: graphSpecWithScalar(primitive),
        pdmResolver: emptyPdmResolver,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const shape = result.value.resolveShape('ScalarRow');
      expect(shape?.fields.value).toEqual({
        type: { kind: 'scalar', primitive },
        nullable: false,
      });
      expect(shape?.fields.values).toEqual({
        type: { kind: 'array', element: primitive },
        nullable: true,
      });

      const signature = result.value.resolveGraphSignature('readScalar');
      expect(signature?.inputs.value?.type).toEqual({
        kind: 'scalar',
        primitive,
      });
    },
  );

  it('rejects unsupported scalar primitives with a service graph error', () => {
    const result = createServiceBindingResolvers({
      serviceSlug: 'catalog',
      graphSpec: graphSpecWithScalar('uuid'),
      pdmResolver: emptyPdmResolver,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toMatchObject({
      layer: 'service',
      code: ERROR_CODES.BLUEPRINT_SERVICE_GRAPHS_INVALID,
      path: 'services/catalog/graphs',
    });
    expect(result.errors[0]?.message).toContain('uuid');
  });
});
```

- [ ] **Step 2: Run focused blueprint tests and confirm RED**

Run:

```bash
pnpm -F @rntme/blueprint test -- test/unit/binding-resolvers.test.ts
```

Expected before blueprint implementation: FAIL because `binding-resolvers.ts` still declares `const SCALARS` and does not import `isScalarPrimitive`. The scalar behavior assertions may already pass because the current duplicate sets match; the source-level regression assertion makes the drift-prone implementation fail until removed.

- [ ] **Step 3: Import the bindings guard in blueprint**

In `packages/artifacts/blueprint/src/compose/binding-resolvers.ts`, change the top import from `@rntme/bindings` to include the runtime guard:

```ts
import {
  isScalarPrimitive,
  type BindingResolvers,
  type FieldType,
  type GraphSignature,
  type InputType,
  type OutputType,
  type ResolvedShape,
  type ScalarPrimitive,
} from '@rntme/bindings';
```

Delete the local `SCALARS` constant entirely.

- [ ] **Step 4: Replace blueprint scalar parsing**

Rewrite `parseScalar` in `packages/artifacts/blueprint/src/compose/binding-resolvers.ts`:

```ts
function parseScalar(raw: string): ScalarPrimitive | null {
  return isScalarPrimitive(raw) ? raw : null;
}
```

Keep `parseInputType`, `parseFieldType`, and `parseOutputType` behavior unchanged. Do not introduce a blueprint-local set or cast.

- [ ] **Step 5: Run focused blueprint tests and build**

Run:

```bash
pnpm -F @rntme/blueprint test -- test/unit/binding-resolvers.test.ts
pnpm -F @rntme/blueprint build
```

Expected: PASS.

- [ ] **Step 6: Commit blueprint scalar delegation**

Run:

```bash
git add packages/artifacts/blueprint/src/compose/binding-resolvers.ts packages/artifacts/blueprint/test/unit/binding-resolvers.test.ts
git commit -m "fix(blueprint): delegate binding scalar checks to bindings"
```

Expected: commit succeeds with only blueprint source/test changes staged.

### Task 3: Public Contract Docs

**Files:**
- Modify `docs/current/owners/packages/artifacts/bindings.md`
- Modify `docs/current/owners/packages/artifacts/blueprint.md`

- [ ] **Step 1: Document the bindings scalar contract**

In `docs/current/owners/packages/artifacts/bindings.md`, add this bullet under `## Validation Invariants` after the fail-fast validation bullet:

```md
- `SCALAR_PRIMITIVES` and `isScalarPrimitive(value)` are the public runtime source for scalar primitives accepted by `BindingResolvers`, resolver field/input/output types, and OpenAPI scalar encoding. Add or remove binding scalars there first, then update OpenAPI scalar emission and tests in the same change.
```

- [ ] **Step 2: Document blueprint's dependency on bindings scalar validation**

In `docs/current/owners/packages/artifacts/blueprint.md`, update the `createServiceBindingResolvers(...)` public API bullet to:

```md
- `createServiceBindingResolvers(...)` — build bindings validators that resolve service-local graphs against project service context. Scalar primitive validation delegates to `@rntme/bindings` (`SCALAR_PRIMITIVES` / `isScalarPrimitive`); do not add a separate blueprint scalar list.
```

- [ ] **Step 3: Run docs diff check**

Run:

```bash
git diff --check
```

Expected: no output and exit 0.

- [ ] **Step 4: Commit docs**

Run:

```bash
git add docs/current/owners/packages/artifacts/bindings.md docs/current/owners/packages/artifacts/blueprint.md
git commit -m "docs: document binding scalar primitive source"
```

Expected: commit succeeds with only current owner doc changes staged.

### Task 4: Full Verification and Handoff

**Files:**
- No new files. This task verifies the branch and updates the existing PR/comment handoff.

- [ ] **Step 1: Run required package tests**

Run:

```bash
pnpm -F @rntme/bindings test
pnpm -F @rntme/blueprint test
```

Expected: both commands pass.

- [ ] **Step 2: Run required package builds**

Run:

```bash
pnpm -F @rntme/bindings build
pnpm -F @rntme/blueprint build
```

Expected: both commands pass.

- [ ] **Step 3: Run dependency and diff gates**

Run:

```bash
pnpm depcruise
git diff --check origin/main...HEAD
git status --short
```

Expected:
- `pnpm depcruise` passes with no circular dependency or layering violation.
- `git diff --check origin/main...HEAD` exits 0.
- `git status --short` is empty.

- [ ] **Step 4: Inspect final dependency direction**

Run:

```bash
grep -RIn "@rntme/blueprint\\|@rntme/pdm\\|@rntme/runtime" packages/artifacts/bindings/src packages/artifacts/bindings/package.json
grep -RIn "const SCALARS\\|new Set(\\[.*integer\\|isScalarPrimitive" packages/artifacts/blueprint/src packages/artifacts/bindings/src
```

Expected:
- First command finds no imports/dependencies from `@rntme/bindings` to blueprint, PDM, or runtime packages.
- Second command finds `isScalarPrimitive` in bindings and blueprint, but no blueprint-local `const SCALARS` definition.

- [ ] **Step 5: Update the existing draft PR**

Run:

```bash
git push origin auto/rnt-499-blueprint-binding-scalars
```

Expected: the existing PR `https://github.com/vladprrs/rntme/pull/185` updates. Do not open a new PR.

- [ ] **Step 6: Post DEV handoff comment**

Post a `[STAGE:DEV]` Multica comment on RNT-499 in Russian with:
- verdict;
- files changed;
- branch/worktree/PR;
- commits;
- gate results with exact commands;
- blocker status;
- remaining risks, especially future scalar additions needing OpenAPI scalar emission updates.

## Acceptance Checklist

- [ ] `@rntme/bindings` exports `SCALAR_PRIMITIVES` and `isScalarPrimitive` as public runtime helpers.
- [ ] `ScalarPrimitive` is derived from `SCALAR_PRIMITIVES`, not maintained as a separate union.
- [ ] `@rntme/blueprint` imports and uses `isScalarPrimitive` for scalar parsing.
- [ ] `packages/artifacts/blueprint/src/compose/binding-resolvers.ts` has no local scalar literal set.
- [ ] Bindings tests cover helper order, acceptance, rejection, and type compatibility.
- [ ] Blueprint tests iterate over `SCALAR_PRIMITIVES` and reject `uuid` with `BLUEPRINT_SERVICE_GRAPHS_INVALID`.
- [ ] Current owner docs identify bindings as the scalar primitive contract location.
- [ ] No dependency from bindings to blueprint, PDM, or runtime packages is introduced.
- [ ] Required gates pass: bindings test/build, blueprint test/build, `pnpm depcruise`, and `git diff --check`.

## Risks and Collision Points

- The blueprint drift test naturally becomes most valuable when bindings changes its scalar tuple. DEV should still replace the local blueprint set in the same change so future scalar additions fail in the right place.
- `primitiveToJsonSchema` remains a switch over scalar primitives. If a future task adds a new scalar to `SCALAR_PRIMITIVES`, that task must update OpenAPI scalar emission and tests in the same commit.
- The public barrel gains value exports. Keep names narrow and documented so consumers import the canonical helper instead of rebuilding scalar sets.
- Work only in `branch=auto/rnt-499-blueprint-binding-scalars`, `worktree=/home/coder/work/rntme/.worktrees/rnt-499-blueprint-binding-scalars`, `pr=https://github.com/vladprrs/rntme/pull/185`.
