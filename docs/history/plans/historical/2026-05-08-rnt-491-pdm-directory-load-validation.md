> Status: historical.
> Date: 2026-05-08.
> Current source: docs/current/**, docs/decision-system.md, and current code/tests.
> Why retained: Completed RNT-491 execution plan retained as historical rationale and handoff context; it is not current-state truth by itself.

# PDM Directory Load Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `loadPdmDir` a package-owned validated boundary that returns only `ValidatedPdm` or structured PDM errors with clear layer/path/cause information.

**Architecture:** Keep the existing `loadArtifactDir` directory assembly helper, but make its I/O/JSON errors path-aware. Then change `@rntme/pdm` to run `parsePdm -> validatePdm` inside `loadPdmDir`, and update `@rntme/blueprint` to consume the already validated result without a second validation branch.

**Tech Stack:** TypeScript strict ESM, Node `fs/promises`, Zod, Vitest, workspace packages `@rntme/artifact-shared`, `@rntme/pdm`, `@rntme/blueprint`.

---

## File Map

- Modify `packages/artifacts/_shared/src/load.ts`: widen `IoErrorBuilder` info with optional `cause`, parse index and leaf JSON in path-specific blocks, and leave `parseFn` results unwrapped.
- Modify `packages/artifacts/_shared/test/load.test.ts`: assert precise paths for malformed `index.json` and `leaves/bad.json`, including a machine-readable `cause`.
- Modify `packages/artifacts/pdm/src/types/result.ts`: add optional `cause?: unknown` to `PdmError`.
- Modify `packages/artifacts/pdm/src/load/load-dir.ts`: return `Promise<Result<ValidatedPdm>>`, call `parsePdm`, then `validatePdm`, and pass `cause` through for directory parse failures.
- Modify `packages/artifacts/pdm/test/unit/load-dir.test.ts`: add regression coverage for valid validated output, invalid entity schema, malformed JSON, missing required pieces, and validation failures.
- Modify `packages/artifacts/blueprint/src/load/load-blueprint.ts`: remove the `validatePdm` import and redundant `project pdm failed validation` branch.
- Modify `packages/artifacts/blueprint/test/unit/load-blueprint.test.ts`: assert invalid project PDM now fails through the directory-load wrapper with PDM validation errors as the cause.
- Modify `docs/current/owners/packages/artifacts/pdm.md`: document `loadPdmDir`, `PDM_PARSE_DIR_INVALID`, `PdmError.cause`, and the validated loader invariant.
- Do not modify `packages/artifacts/pdm/README.md`: its current-doc link and local command hint remain correct.
- Do not modify `docs/decision-system.md`: the change follows existing locked bets for `Result<T>`, branded `Validated*`, JSON-only authoring, and 4-layer validation.

## Current Truth

- `packages/artifacts/pdm/src/load/load-dir.ts` currently returns `Promise<Result<PdmArtifact>>` and only calls `parsePdm({ entities: leafEntries })`.
- `packages/artifacts/pdm/src/validate/index.ts` already returns `Result<ValidatedPdm>` and short-circuits state-machine validation when structural validation fails.
- `packages/artifacts/_shared/src/load.ts` currently catches index JSON parse, index schema parse, leaf JSON parse, and unexpected reads in one block and reports `path: dir`.
- `packages/artifacts/blueprint/src/load/load-blueprint.ts` is the only source caller of `loadPdmDir`; it calls `validatePdm(rawPdm.value)` after directory load.
- `docs/current/owners/packages/artifacts/pdm.md` documents the direct object pipeline but does not list `loadPdmDir`.

### Task 1: Shared Loader Path/Cause Precision

**Files:**
- Modify `packages/artifacts/_shared/src/load.ts`
- Modify `packages/artifacts/_shared/test/load.test.ts`

- [ ] **Step 1: Tighten failing shared-loader tests**

Update the local `DemoError` type and builder in `packages/artifacts/_shared/test/load.test.ts` so the tests can observe optional `cause`:

```ts
type DemoError = { code: string; message: string; path: string; cause?: unknown };

const buildIoError = ({
  message,
  path,
  cause,
}: {
  message: string;
  path: string;
  cause?: unknown;
}): DemoError => ({
  code: 'IO',
  message,
  path,
  ...(cause === undefined ? {} : { cause }),
});
```

Replace the malformed-index assertion with:

```ts
expect(isErr(r)).toBe(true);
if (isErr(r)) {
  expect(r.errors[0]?.path).toBe('index.json');
  expect(r.errors[0]?.message).toContain('JSON');
  expect(r.errors[0]?.cause).toBeInstanceOf(SyntaxError);
}
```

Replace the malformed-leaf assertion with:

```ts
expect(isErr(r)).toBe(true);
if (isErr(r)) {
  expect(r.errors[0]?.path).toBe('leaves/bad.json');
  expect(r.errors[0]?.message).toContain('JSON');
  expect(r.errors[0]?.cause).toBeInstanceOf(SyntaxError);
}
```

For the index schema failure test, assert the index file path and Zod issue cause:

```ts
expect(isErr(r)).toBe(true);
if (isErr(r)) {
  expect(r.errors[0]?.path).toBe('index.json');
  expect(r.errors[0]?.cause).toEqual(expect.any(Array));
}
```

- [ ] **Step 2: Run the focused shared-loader tests and confirm RED**

Run:

```bash
pnpm -F @rntme/artifact-shared test -- test/load.test.ts
```

Expected before implementation: FAIL because malformed JSON and index schema errors still report `path: dir`, and no `cause` is passed into `buildIoError`.

- [ ] **Step 3: Implement path-aware shared-loader errors**

In `packages/artifacts/_shared/src/load.ts`, widen `IoErrorBuilder` and keep `parseFn` out of the catch that builds directory I/O errors:

```ts
export type IoErrorBuilder<E> = (info: {
  message: string;
  path: string;
  cause?: unknown;
}) => E;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
```

Replace the broad final `try/catch` body with this shape:

```ts
let indexText: string;
let leafFileNames: string[];
try {
  [indexText, leafFileNames] = await Promise.all([
    readFile(indexPath, 'utf8'),
    readdir(leafDirPath),
  ]);
} catch (error) {
  return err([
    buildIoError({
      message: errorMessage(error),
      path: dir,
      cause: error,
    }),
  ]);
}

let indexRaw: unknown;
try {
  indexRaw = JSON.parse(indexText);
} catch (error) {
  return err([
    buildIoError({
      message: errorMessage(error),
      path: indexFile,
      cause: error,
    }),
  ]);
}

const parsedIndex = indexSchema.safeParse(indexRaw);
if (!parsedIndex.success) {
  return err([
    buildIoError({
      message: `${indexFile} failed validation`,
      path: indexFile,
      cause: parsedIndex.error.issues,
    }),
  ]);
}

const jsonFileNames = leafFileNames.filter((fname) => fname.endsWith('.json'));
const leafEntries: Record<string, unknown> = {};
for (const fname of jsonFileNames) {
  const leafPath = `${leafDir}/${fname}`;
  let text: string;
  try {
    text = await readFile(join(leafDirPath, fname), 'utf8');
  } catch (error) {
    return err([
      buildIoError({
        message: errorMessage(error),
        path: leafPath,
        cause: error,
      }),
    ]);
  }

  try {
    leafEntries[basename(fname, '.json')] = JSON.parse(text);
  } catch (error) {
    return err([
      buildIoError({
        message: errorMessage(error),
        path: leafPath,
        cause: error,
      }),
    ]);
  }
}

return parseFn({ index: parsedIndex.data, leafEntries });
```

This deliberately returns `parseFn(...)` directly. Do not catch that result and do not convert parser or validator errors into the directory error code.

- [ ] **Step 4: Run shared-loader tests and build**

Run:

```bash
pnpm -F @rntme/artifact-shared test -- test/load.test.ts
pnpm -F @rntme/artifact-shared build
```

Expected: PASS. The build updates `packages/artifacts/_shared/dist/*`; commit generated `dist` changes if this repository tracks package build output on the branch.

- [ ] **Step 5: Commit shared-loader precision**

Run:

```bash
git add packages/artifacts/_shared/src/load.ts packages/artifacts/_shared/test/load.test.ts packages/artifacts/_shared/dist
git commit -m "fix(artifact-shared): preserve directory parse error paths"
```

Expected: commit succeeds with only shared-loader source/test/build-output changes staged.

### Task 2: PDM Loader Returns ValidatedPdm

**Files:**
- Modify `packages/artifacts/pdm/src/types/result.ts`
- Modify `packages/artifacts/pdm/src/load/load-dir.ts`
- Modify `packages/artifacts/pdm/test/unit/load-dir.test.ts`

- [ ] **Step 1: Write failing PDM loader tests**

Update `packages/artifacts/pdm/test/unit/load-dir.test.ts` imports:

```ts
import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPdmDir } from '../../src/load/load-dir.js';
```

Add a temp-copy helper inside the `describe` block:

```ts
function copyFixture(): string {
  const temp = mkdtempSync(join(tmpdir(), 'rntme-pdm-load-'));
  const copied = join(temp, 'project-pdm');
  cpSync(fixtureDir, copied, { recursive: true });
  return copied;
}
```

After the existing happy-path assertions, add validation proof:

```ts
expect(r.value.entities.Product?.kind).toBe('root');
```

Add these new tests:

```ts
it('returns parse schema errors for invalid entity shape without rewrapping', async () => {
  const copied = copyFixture();
  try {
    writeFileSync(
      join(copied, 'entities', 'Product.json'),
      JSON.stringify(
        {
          ownerService: 'catalog',
          kind: 'root',
          table: 'products',
          fields: {
            productId: { type: 'integer', nullable: false },
          },
          keys: ['productId'],
        },
        null,
        2,
      ),
    );

    const r = await loadPdmDir(copied);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors[0]).toMatchObject({
        layer: 'parse',
        code: 'PDM_PARSE_SCHEMA_VIOLATION',
        path: 'entities.Product.fields.productId.column',
      });
    }
  } finally {
    rmSync(copied, { recursive: true, force: true });
  }
});

it('returns precise parse-dir error for malformed entity JSON', async () => {
  const copied = copyFixture();
  try {
    writeFileSync(join(copied, 'entities', 'Product.json'), '{not json');

    const r = await loadPdmDir(copied);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors[0]).toMatchObject({
        layer: 'parse',
        code: 'PDM_PARSE_DIR_INVALID',
        path: 'entities/Product.json',
      });
      expect(r.errors[0]?.cause).toBeInstanceOf(SyntaxError);
    }
  } finally {
    rmSync(copied, { recursive: true, force: true });
  }
});

it('returns structural validation errors from directory load', async () => {
  const copied = copyFixture();
  try {
    writeFileSync(
      join(copied, 'entities', 'Publication.json'),
      JSON.stringify(
        {
          ownerService: 'catalog',
          kind: 'owned',
          table: 'publications',
          fields: {
            id: { type: 'integer', nullable: false, column: 'id' },
          },
          keys: ['missingId'],
        },
        null,
        2,
      ),
    );

    const r = await loadPdmDir(copied);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors[0]).toMatchObject({
        layer: 'structural',
        code: 'PDM_STRUCT_KEY_UNKNOWN_FIELD',
      });
    }
  } finally {
    rmSync(copied, { recursive: true, force: true });
  }
});

it('returns state-machine validation errors from directory load', async () => {
  const copied = copyFixture();
  try {
    writeFileSync(
      join(copied, 'entities', 'Publication.json'),
      JSON.stringify(
        {
          ownerService: 'catalog',
          kind: 'owned',
          table: 'publications',
          fields: {
            id: { type: 'integer', nullable: false, column: 'id' },
            status: { type: 'string', nullable: true, column: 'status' },
          },
          keys: ['id'],
          stateMachine: {
            stateField: 'status',
            initial: null,
            states: ['draft'],
            transitions: {
              create: { from: null, to: 'draft', affects: [] },
            },
          },
        },
        null,
        2,
      ),
    );

    const r = await loadPdmDir(copied);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors[0]).toMatchObject({
        layer: 'state-machine',
        code: 'PDM_SM_STATE_FIELD_TYPE_INVALID',
      });
    }
  } finally {
    rmSync(copied, { recursive: true, force: true });
  }
});
```

Keep the missing `pdm.json` test and extend it to assert `path: 'pdm.json'`.

- [ ] **Step 2: Run the focused PDM loader tests and confirm RED**

Run:

```bash
pnpm -F @rntme/pdm test -- test/unit/load-dir.test.ts
```

Expected before implementation: FAIL because `PdmError` has no `cause`, malformed leaf JSON reports the directory path, and validation errors are not produced by `loadPdmDir`.

- [ ] **Step 3: Add `cause` to PDM errors**

In `packages/artifacts/pdm/src/types/result.ts`, change `PdmError` to:

```ts
export type PdmError = {
  layer: Layer;
  code: PdmErrorCode;
  message: string;
  path?: string;
  hint?: string;
  cause?: unknown;
};
```

- [ ] **Step 4: Validate inside `loadPdmDir`**

In `packages/artifacts/pdm/src/load/load-dir.ts`, replace the type imports and implementation with:

```ts
import type { ValidatedPdm } from '../types/artifact.js';
import { ERROR_CODES, isErr, type PdmError, type Result } from '../types/result.js';
import { validatePdm } from '../validate/index.js';

export function loadPdmDir(dir: string): Promise<Result<ValidatedPdm>> {
  return loadArtifactDir<z.output<typeof PdmDirectoryIndexSchema>, ValidatedPdm, PdmError>({
    dir,
    indexFile: 'pdm.json',
    leafDir: 'entities',
    indexSchema: PdmDirectoryIndexSchema,
    parseFn: ({ leafEntries }) => {
      const parsed = parsePdm({ entities: leafEntries });
      if (isErr(parsed)) return parsed;
      return validatePdm(parsed.value);
    },
    buildIoError: ({ message, path, cause }) => ({
      layer: 'parse',
      code: ERROR_CODES.PDM_PARSE_DIR_INVALID,
      message,
      path,
      ...(cause === undefined ? {} : { cause }),
    }),
  });
}
```

Do not cast to `ValidatedPdm`; the brand must come only from `validatePdm`.

- [ ] **Step 5: Run PDM tests and build**

Run:

```bash
pnpm -F @rntme/pdm test -- test/unit/load-dir.test.ts
pnpm -F @rntme/pdm test
pnpm -F @rntme/pdm build
```

Expected: PASS.

- [ ] **Step 6: Commit PDM loader validation**

Run:

```bash
git add packages/artifacts/pdm/src/types/result.ts packages/artifacts/pdm/src/load/load-dir.ts packages/artifacts/pdm/test/unit/load-dir.test.ts packages/artifacts/pdm/dist
git commit -m "fix(pdm): validate directory-loaded artifacts"
```

Expected: commit succeeds with only PDM source/test/build-output changes staged.

### Task 3: Blueprint Consumes Validated PDM

**Files:**
- Modify `packages/artifacts/blueprint/src/load/load-blueprint.ts`
- Modify `packages/artifacts/blueprint/test/unit/load-blueprint.test.ts`

- [ ] **Step 1: Add a blueprint regression test for invalid project PDM**

In `packages/artifacts/blueprint/test/unit/load-blueprint.test.ts`, add `rmSync` to the `node:fs` import:

```ts
import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
```

Add this test:

```ts
it('wraps PDM directory validation errors as blueprint load errors', async () => {
  const temp = mkdtempSync(join(tmpdir(), 'rntme-blueprint-'));
  const copied = join(temp, 'product-catalog-project');
  cpSync(fixtureDir, copied, { recursive: true });
  try {
    writeFileSync(
      join(copied, 'pdm', 'entities', 'Product.json'),
      JSON.stringify(
        {
          ownerService: 'catalog',
          kind: 'root',
          table: 'products',
          fields: {
            productId: { type: 'integer', nullable: false, column: 'product_id' },
          },
          keys: ['missingProductId'],
        },
        null,
        2,
      ),
    );

    const r = await loadBlueprint(copied);
    expect(r.ok).toBe(false);
    if (r.ok) return;

    expect(r.errors[0]).toMatchObject({
      layer: 'load',
      code: ERROR_CODES.BLUEPRINT_IO_ERROR,
      message: 'project pdm directory failed to load',
      path: 'pdm',
    });
    expect(r.errors[0]?.cause).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          layer: 'structural',
          code: 'PDM_STRUCT_KEY_UNKNOWN_FIELD',
        }),
      ]),
    );
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run the focused blueprint loader test and confirm current behavior**

Run:

```bash
pnpm -F @rntme/blueprint test -- test/unit/load-blueprint.test.ts
```

Expected after Task 2 but before blueprint implementation: the new test may still PASS at runtime because the redundant validation branch wraps errors, but `pnpm -F @rntme/blueprint build` should FAIL because `validatePdm(rawPdm.value)` receives a `ValidatedPdm` where the branch is obsolete. If both pass, still perform Step 3 to remove the duplicate branch and enforce the intended contract.

- [ ] **Step 3: Remove redundant blueprint validation branch**

In `packages/artifacts/blueprint/src/load/load-blueprint.ts`, replace the import:

```ts
import { loadPdmDir } from '@rntme/pdm';
```

Rename the Promise result local from `rawPdm` to `loadedPdm`:

```ts
const [projectRaw, loadedPdm, serviceDirs] = await Promise.all([
  readJsonFile(dir, 'project.json'),
  loadPdmDir(pdmDir),
  listServiceDirs(dir),
]);
```

Keep the existing wrapper for loader errors:

```ts
if (!loadedPdm.ok) {
  return err([
    {
      layer: 'load',
      code: ERROR_CODES.BLUEPRINT_IO_ERROR,
      message: 'project pdm directory failed to load',
      path: 'pdm',
      cause: loadedPdm.errors,
    },
  ]);
}
```

Delete the `const validatedPdm = validatePdm(rawPdm.value)` block and return the loaded value:

```ts
return ok({
  project: parsedProject.value,
  pdm: loadedPdm.value,
  services,
});
```

- [ ] **Step 4: Run blueprint tests and build**

Run:

```bash
pnpm -F @rntme/blueprint test -- test/unit/load-blueprint.test.ts
pnpm -F @rntme/blueprint test
pnpm -F @rntme/blueprint build
```

Expected: PASS.

- [ ] **Step 5: Commit blueprint caller update**

Run:

```bash
git add packages/artifacts/blueprint/src/load/load-blueprint.ts packages/artifacts/blueprint/test/unit/load-blueprint.test.ts packages/artifacts/blueprint/dist
git commit -m "fix(blueprint): consume validated PDM directory load"
```

Expected: commit succeeds with only blueprint source/test/build-output changes staged.

### Task 4: PDM Owner Documentation

**Files:**
- Modify `docs/current/owners/packages/artifacts/pdm.md`

- [ ] **Step 1: Update the file map**

In the PDM owner doc file map, add this entry under `src/`:

```text
  load/
    load-dir.ts                   (entry) loadPdmDir() - loads pdm/entities directory format and returns ValidatedPdm.
```

- [ ] **Step 2: Update quick-start imports and API table**

Add `loadPdmDir` to the quick-start import list:

```ts
  loadPdmDir,
```

Add this API table row:

```md
| `loadPdmDir` | `(dir: string) => Promise<Result<ValidatedPdm>>` | Loads `pdm.json` + `entities/*.json`, runs `parsePdm -> validatePdm`, and returns only validated PDM or PDM errors. |
```

- [ ] **Step 3: Update error documentation**

Change the error sentence to:

```md
Every `PdmError` carries `{ layer, code, message, path?, hint?, cause? }`. `cause` is reserved for machine-readable underlying details such as JSON parse failures, Zod issues from directory index validation, or other directory load failures.
```

Change the parse code bullet to:

```md
- Parse: `PDM_PARSE_SCHEMA_VIOLATION`, `PDM_PARSE_DIR_INVALID`.
```

Add this invariant bullet:

```md
- `loadPdmDir` is the safe directory authoring boundary. It returns `ValidatedPdm`, not raw `PdmArtifact`; callers should not run `validatePdm` again or catch and rewrap validation errors as `PDM_PARSE_DIR_INVALID`.
```

Add this lookup bullet:

```md
- "How is entity-per-file PDM loaded?" -> `src/load/load-dir.ts`; directory I/O and malformed JSON errors use `PDM_PARSE_DIR_INVALID`, while assembled schema and validation failures keep their normal PDM parse/structural/state-machine codes.
```

- [ ] **Step 4: Run docs diff check**

Run:

```bash
git diff --check
```

Expected: PASS.

- [ ] **Step 5: Commit docs**

Run:

```bash
git add docs/current/owners/packages/artifacts/pdm.md
git commit -m "docs(pdm): document validated directory loader"
```

Expected: commit succeeds with only the owner doc staged.

### Task 5: Final Verification And PR Update

**Files:**
- Verify all changed files from Tasks 1-4.

- [ ] **Step 1: Update branch against latest main inside the canonical worktree**

Run:

```bash
git fetch --prune origin
git rebase origin/main
```

Expected: clean rebase. If conflicts occur, resolve only files touched by RNT-491 and rerun all gates below.

- [ ] **Step 2: Run required gates**

Run:

```bash
pnpm -F @rntme/artifact-shared test
pnpm -F @rntme/artifact-shared build
pnpm -F @rntme/pdm test
pnpm -F @rntme/pdm build
pnpm -F @rntme/blueprint test
pnpm -F @rntme/blueprint build
git diff --check origin/main...HEAD
```

Expected: all PASS.

- [ ] **Step 3: Inspect final diff for scope**

Run:

```bash
git diff --stat origin/main...HEAD
git diff --name-only origin/main...HEAD
```

Expected changed areas:

```text
docs/history/specs/autonomous/2026-05-08-rnt-491-pdm-directory-load-validation-design.md
docs/history/plans/historical/2026-05-08-rnt-491-pdm-directory-load-validation.md
docs/current/owners/packages/artifacts/pdm.md
packages/artifacts/_shared/src/load.ts
packages/artifacts/_shared/test/load.test.ts
packages/artifacts/pdm/src/load/load-dir.ts
packages/artifacts/pdm/src/types/result.ts
packages/artifacts/pdm/test/unit/load-dir.test.ts
packages/artifacts/blueprint/src/load/load-blueprint.ts
packages/artifacts/blueprint/test/unit/load-blueprint.test.ts
```

If tracked `dist` output changes appear for built packages, include them only if the repo already tracks those generated outputs for the same packages.

- [ ] **Step 4: Push the canonical branch**

Run:

```bash
git push origin auto/RNT-491-pdm-directory-load-validation
```

Expected: PR #182 updates with the implementation commits.

- [ ] **Step 5: Post DEV handoff evidence**

Post a Multica issue comment that starts with `[STAGE:DEV]` and includes:

```md
[STAGE:DEV]

Verdict: implementation complete; ready for FINISH review.

Files changed:
- ...

Branch/worktree/PR:
- branch: `auto/RNT-491-pdm-directory-load-validation`
- worktree: `/home/coder/work/rntme/.worktrees/RNT-491-pdm-directory-load-validation`
- PR: https://github.com/vladprrs/rntme/pull/182

Gates/evidence:
- `pnpm -F @rntme/artifact-shared test` passed
- `pnpm -F @rntme/artifact-shared build` passed
- `pnpm -F @rntme/pdm test` passed
- `pnpm -F @rntme/pdm build` passed
- `pnpm -F @rntme/blueprint test` passed
- `pnpm -F @rntme/blueprint build` passed
- `git diff --check origin/main...HEAD` passed

Risks:
- ...

Next stage recommendation: FINISH should review PR #182, merge, and verify main.
```

## Collision Points And Guardrails

- Another agent may already be operating on the same canonical issue/worktree. If `git status --short` shows uncommitted changes that are not yours, stop and leave a Multica comment instead of racing the worktree.
- Keep `loadQsmDir` parse-only. The shared loader can pass `cause`, but QSM does not need to document or validate directory load semantics in this issue.
- Do not add `loadValidatedPdmDir`; the accepted design rejects a second directory API under F2.
- Do not rewrap `parsePdm` or `validatePdm` failures as `PDM_PARSE_DIR_INVALID`; only directory I/O, malformed JSON, and directory index validation use that code.
- Do not bypass the `ValidatedPdm` brand with casts.
- Do not add backwards-compatibility shims for callers expecting `Result<PdmArtifact>`; pre-stable policy allows the breaking type change.

## Self-Review

- Spec coverage: The plan covers validated `loadPdmDir`, separated parse-dir/schema/structural/state-machine errors, exact malformed JSON paths with cause, blueprint caller update, owner-doc update, and required gates.
- Placeholder scan: No deferred decisions or generic "add validation" steps remain. Each implementation step names exact files, commands, expected outcomes, and representative code.
- Type consistency: `loadArtifactDir` returns `Result<T, E>`, PDM specializes `T` to `ValidatedPdm`, `PdmError.cause` is additive, and blueprint continues to expose `LoadedBlueprint.pdm` as `ValidatedPdm`.
