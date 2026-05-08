# RNT-492 QSM Directory Error Taxonomy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split QSM directory-load failures into specific, pathful, structured errors while preserving the existing `loadQsmDir(dir): Promise<Result<QsmArtifact>>` contract.

**Architecture:** Extend the shared `loadArtifactDir` helper to report a stable failure kind, relative path, and optional cause, then let QSM map those shared failure kinds to package-specific error codes. Keep PDM source-compatible by widening the existing `buildIoError` callback instead of adding a second traversal path. Keep `parseFn` outside generic failure conversion so structured parser `Err` values pass through unchanged.

**Tech Stack:** TypeScript, Node `fs/promises`, Zod, Vitest, pnpm workspace filters.

---

## Context

Approved SPEC: `docs/history/specs/autonomous/2026-05-08-rnt-492-qsm-directory-error-taxonomy-design.md`.

Current implementation:
- `packages/artifacts/qsm/src/load/load-dir.ts` maps every shared loader failure to `QSM_PARSE_DIR_INVALID`.
- `packages/artifacts/_shared/src/load.ts` catches JSON, schema, leaf read, and parser failures in one broad `catch`.
- `packages/artifacts/qsm/src/types/result.ts` has no `cause?: unknown` on `QsmError`.
- `packages/artifacts/blueprint/src/load/load-blueprint.ts` already wraps QSM load failures as `BLUEPRINT_IO_ERROR` with `cause: loadedQsm.errors`.

Decision constraints:
- Preserve `Result<T>` across package boundaries.
- Append error codes only; do not delete, reorder, or repurpose existing codes.
- QSM remains JSON-only and `loadQsmDir` remains parse-only, not validate-with-PDM.
- `QSM_PARSE_DIR_INVALID` stays registered as legacy/deprecated.

## File Structure

- Modify `packages/artifacts/_shared/src/load.ts`: add shared failure-kind types, report precise failure metadata, and avoid wrapping `parseFn` errors.
- Modify `packages/artifacts/_shared/src/index.ts`: export the new shared loader types.
- Modify `packages/artifacts/_shared/test/load.test.ts`: regression tests for shared failure kinds, paths, causes, and parser error pass-through.
- Modify `packages/artifacts/qsm/src/types/result.ts`: add `cause?: unknown` and append new QSM directory codes.
- Modify `packages/artifacts/qsm/src/load/load-dir.ts`: map shared failure kinds to QSM-specific error codes/messages.
- Modify `packages/artifacts/qsm/test/unit/load-dir.test.ts`: QSM regression coverage for every accepted failure class.
- Modify `packages/artifacts/blueprint/test/unit/load-blueprint.test.ts`: assert nested QSM errors survive inside `BLUEPRINT_IO_ERROR.cause`.
- Modify `docs/current/owners/packages/artifacts/qsm.md`: document the directory-load error contract.
- `packages/artifacts/qsm/README.md`: no change expected unless DEV changes local command hints or the current-doc target.

## Implementation Tasks

### Task 1: Shared Loader Failure Contract

**Files:**
- Modify: `packages/artifacts/_shared/src/load.ts`
- Modify: `packages/artifacts/_shared/src/index.ts`
- Test: `packages/artifacts/_shared/test/load.test.ts`

- [ ] **Step 1: Add failing shared-loader tests for failure kinds and paths**

Update `DemoError` and `buildIoError` in `packages/artifacts/_shared/test/load.test.ts` so tests can inspect `kind` and `cause`:

```ts
import type { LoadArtifactDirFailure } from '../src/index.js';

type DemoError = {
  code: string;
  kind: LoadArtifactDirFailure['kind'];
  message: string;
  path: string;
  cause?: unknown;
};

const buildIoError = ({ kind, message, path, cause }: LoadArtifactDirFailure): DemoError => ({
  code: 'IO',
  kind,
  message,
  path,
  cause,
});
```

Change the existing failure assertions:

```ts
expect(r.errors[0]).toMatchObject({
  kind: 'index-missing',
  path: 'index.json',
});
```

```ts
expect(r.errors[0]).toMatchObject({
  kind: 'leaf-dir-missing',
  path: 'leaves',
});
```

```ts
expect(r.errors[0]).toMatchObject({
  kind: 'index-json-invalid',
  path: 'index.json',
});
expect(r.errors[0]?.cause).toEqual(expect.any(SyntaxError));
```

```ts
expect(r.errors[0]).toMatchObject({
  kind: 'index-schema-invalid',
  path: 'index.json',
});
expect(r.errors[0]?.cause).toEqual(expect.any(Array));
```

```ts
expect(r.errors[0]).toMatchObject({
  kind: 'leaf-json-invalid',
  path: 'leaves/bad.json',
});
expect(r.errors[0]?.cause).toEqual(expect.any(SyntaxError));
```

- [ ] **Step 2: Add failing shared-loader tests for non-absence filesystem failures**

Append tests that ensure `ENOTDIR` during `stat` is still treated as expected absence, while readable-but-wrong-type failures are `read-failed`:

```ts
it('treats ENOTDIR on the index route as index-missing', async () => {
  writeFileSync(join(dir, 'index-parent'), 'not a directory');
  const r = await loadArtifactDir<z.output<typeof IndexSchema>, null, DemoError>({
    dir: join(dir, 'index-parent'),
    indexFile: 'index.json',
    leafDir: 'leaves',
    indexSchema: IndexSchema,
    parseFn: () => ok(null),
    buildIoError,
  });

  expect(isErr(r)).toBe(true);
  if (isErr(r)) {
    expect(r.errors[0]).toMatchObject({
      kind: 'index-missing',
      path: 'index.json',
    });
  }
});

it('reports a directory at index path as read-failed', async () => {
  mkdirSync(join(dir, 'index.json'));
  mkdirSync(join(dir, 'leaves'));

  const r = await loadArtifactDir<z.output<typeof IndexSchema>, null, DemoError>({
    dir,
    indexFile: 'index.json',
    leafDir: 'leaves',
    indexSchema: IndexSchema,
    parseFn: () => ok(null),
    buildIoError,
  });

  expect(isErr(r)).toBe(true);
  if (isErr(r)) {
    expect(r.errors[0]).toMatchObject({
      kind: 'read-failed',
      path: 'index.json',
    });
  }
});

it('reports a file at leaf directory path as read-failed', async () => {
  writeFileSync(join(dir, 'index.json'), JSON.stringify({}));
  writeFileSync(join(dir, 'leaves'), 'not a directory');

  const r = await loadArtifactDir<z.output<typeof IndexSchema>, null, DemoError>({
    dir,
    indexFile: 'index.json',
    leafDir: 'leaves',
    indexSchema: IndexSchema,
    parseFn: () => ok(null),
    buildIoError,
  });

  expect(isErr(r)).toBe(true);
  if (isErr(r)) {
    expect(r.errors[0]).toMatchObject({
      kind: 'read-failed',
      path: 'leaves',
    });
  }
});
```

Add one parser pass-through test:

```ts
it('returns parseFn errors without wrapping them as IO failures', async () => {
  writeFileSync(join(dir, 'index.json'), JSON.stringify({}));
  mkdirSync(join(dir, 'leaves'));

  const parseError: DemoError = {
    code: 'PARSE',
    kind: 'read-failed',
    message: 'parser-owned error',
    path: 'leaves.Example.keys',
  };

  const r = await loadArtifactDir<z.output<typeof IndexSchema>, null, DemoError>({
    dir,
    indexFile: 'index.json',
    leafDir: 'leaves',
    indexSchema: IndexSchema,
    parseFn: () => ({ ok: false, errors: [parseError] }),
    buildIoError,
  });

  expect(isErr(r)).toBe(true);
  if (isErr(r)) {
    expect(r.errors).toEqual([parseError]);
  }
});
```

- [ ] **Step 3: Run shared tests and confirm they fail for the expected reason**

Run:

```bash
pnpm -F @rntme/artifact-shared test -- test/load.test.ts
```

Expected before implementation: TypeScript or assertion failures because `LoadArtifactDirFailure` and failure `kind` do not exist and broad catch still emits `path: dir`.

- [ ] **Step 4: Implement shared failure metadata**

In `packages/artifacts/_shared/src/load.ts`, replace the old `IoErrorBuilder` type with:

```ts
export type LoadArtifactDirFailureKind =
  | 'index-missing'
  | 'leaf-dir-missing'
  | 'index-json-invalid'
  | 'index-schema-invalid'
  | 'leaf-json-invalid'
  | 'read-failed';

export type LoadArtifactDirFailure = {
  kind: LoadArtifactDirFailureKind;
  message: string;
  path: string;
  cause?: unknown;
};

export type IoErrorBuilder<E> = (info: LoadArtifactDirFailure) => E;
```

Add local helpers near the top of the file:

```ts
function isMissingPathError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error.code === 'ENOENT' || error.code === 'ENOTDIR')
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function zodIssues(error: unknown): unknown {
  if (
    typeof error === 'object' &&
    error !== null &&
    'issues' in error &&
    Array.isArray(error.issues)
  ) {
    return error.issues;
  }
  return error;
}
```

Then rewrite `loadArtifactDir` so each operation has the smallest useful `try` block:

```ts
try {
  await stat(indexPath);
} catch (error) {
  if (isMissingPathError(error)) {
    return err([
      buildIoError({
        kind: 'index-missing',
        message: `missing required file: ${indexFile}`,
        path: indexFile,
        cause: error,
      }),
    ]);
  }
  return err([
    buildIoError({
      kind: 'read-failed',
      message: errorMessage(error),
      path: indexFile,
      cause: error,
    }),
  ]);
}

try {
  await stat(leafDirPath);
} catch (error) {
  if (isMissingPathError(error)) {
    return err([
      buildIoError({
        kind: 'leaf-dir-missing',
        message: `missing required directory: ${leafDir}`,
        path: leafDir,
        cause: error,
      }),
    ]);
  }
  return err([
    buildIoError({
      kind: 'read-failed',
      message: errorMessage(error),
      path: leafDir,
      cause: error,
    }),
  ]);
}
```

Read and decode each surface separately:

```ts
let indexText: string;
try {
  indexText = await readFile(indexPath, 'utf8');
} catch (error) {
  return err([
    buildIoError({
      kind: 'read-failed',
      message: errorMessage(error),
      path: indexFile,
      cause: error,
    }),
  ]);
}

let indexJson: unknown;
try {
  indexJson = JSON.parse(indexText);
} catch (error) {
  return err([
    buildIoError({
      kind: 'index-json-invalid',
      message: `invalid JSON in ${indexFile}: ${errorMessage(error)}`,
      path: indexFile,
      cause: error,
    }),
  ]);
}

let index: I;
try {
  index = indexSchema.parse(indexJson);
} catch (error) {
  return err([
    buildIoError({
      kind: 'index-schema-invalid',
      message: `${indexFile} failed validation`,
      path: indexFile,
      cause: zodIssues(error),
    }),
  ]);
}

let leafFileNames: string[];
try {
  leafFileNames = await readdir(leafDirPath);
} catch (error) {
  return err([
    buildIoError({
      kind: 'read-failed',
      message: errorMessage(error),
      path: leafDir,
      cause: error,
    }),
  ]);
}

const leafEntries: Record<string, unknown> = {};
for (const fname of leafFileNames.filter((name) => name.endsWith('.json'))) {
  const leafPath = join(leafDirPath, fname);
  const relativePath = `${leafDir}/${fname}`;
  let text: string;
  try {
    text = await readFile(leafPath, 'utf8');
  } catch (error) {
    return err([
      buildIoError({
        kind: 'read-failed',
        message: errorMessage(error),
        path: relativePath,
        cause: error,
      }),
    ]);
  }
  try {
    leafEntries[basename(fname, '.json')] = JSON.parse(text);
  } catch (error) {
    return err([
      buildIoError({
        kind: 'leaf-json-invalid',
        message: `invalid JSON in ${relativePath}: ${errorMessage(error)}`,
        path: relativePath,
        cause: error,
      }),
    ]);
  }
}

return parseFn({ index, leafEntries });
```

This intentionally removes the broad catch around `parseFn`.

- [ ] **Step 5: Export new shared types**

In `packages/artifacts/_shared/src/index.ts`, update the type export:

```ts
export type {
  IoErrorBuilder,
  LoadArtifactDirFailure,
  LoadArtifactDirFailureKind,
  LoadArtifactDirOptions,
} from './load.js';
```

- [ ] **Step 6: Verify shared and PDM compatibility**

Run:

```bash
pnpm -F @rntme/artifact-shared test -- test/load.test.ts
pnpm -F @rntme/artifact-shared build
pnpm -F @rntme/pdm test -- test/unit/load-dir.test.ts
pnpm -F @rntme/pdm build
```

Expected: all pass. If PDM fails to compile due to callback variance, keep the new `LoadArtifactDirFailure` type but make `buildIoError` accept an overload-compatible type by changing the PDM callback parameter to import/use `LoadArtifactDirFailure`; do not fork the loader.

### Task 2: QSM Error Codes and Mapping

**Files:**
- Modify: `packages/artifacts/qsm/src/types/result.ts`
- Modify: `packages/artifacts/qsm/src/load/load-dir.ts`
- Test: `packages/artifacts/qsm/test/unit/load-dir.test.ts`

- [ ] **Step 1: Add failing QSM directory-loader tests**

Replace the old missing-file test in `packages/artifacts/qsm/test/unit/load-dir.test.ts` with temporary-directory tests. Use Node sync helpers so each case is self-contained:

```ts
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadQsmDir } from '../../src/load/load-dir.js';
import { ERROR_CODES } from '../../src/types/result.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(here, '..', 'fixtures', 'multi-file-qsm');

describe('loadQsmDir', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'qsm-load-dir-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function writeMinimalQsm(root: string): void {
    writeFileSync(join(root, 'qsm.json'), JSON.stringify({ version: '1' }, null, 2));
    mkdirSync(join(root, 'projections'));
    writeFileSync(
      join(root, 'projections', 'ProductCard.json'),
      JSON.stringify(
        {
          backing: 'entity-mirror',
          source: { entity: 'Product' },
          keys: ['id'],
          grain: ['id'],
          exposed: ['id', 'name'],
        },
        null,
        2,
      ),
    );
  }
```

Keep the happy path:

```ts
it('assembles projection-per-file qsm directory into one artifact', async () => {
  const r = await loadQsmDir(fixtureDir);
  expect(r.ok).toBe(true);
  if (r.ok) {
    expect(Object.keys(r.value.projections)).toEqual(['ProductCard']);
  }
});
```

Add failure cases:

```ts
it('reports missing qsm.json with a specific code and path', async () => {
  mkdirSync(join(dir, 'projections'));
  const r = await loadQsmDir(dir);
  expect(r.ok).toBe(false);
  if (!r.ok) {
    expect(r.errors[0]).toMatchObject({
      layer: 'parse',
      code: ERROR_CODES.QSM_PARSE_DIR_INDEX_MISSING,
      path: 'qsm.json',
      message: 'missing required file: qsm.json',
    });
  }
});

it('reports missing projections directory with a specific code and path', async () => {
  writeFileSync(join(dir, 'qsm.json'), JSON.stringify({ version: '1' }));
  const r = await loadQsmDir(dir);
  expect(r.ok).toBe(false);
  if (!r.ok) {
    expect(r.errors[0]).toMatchObject({
      layer: 'parse',
      code: ERROR_CODES.QSM_PARSE_DIR_PROJECTIONS_MISSING,
      path: 'projections',
      message: 'missing required directory: projections',
    });
  }
});

it('reports malformed qsm.json separately from schema violations', async () => {
  writeFileSync(join(dir, 'qsm.json'), '{not-json');
  mkdirSync(join(dir, 'projections'));
  const r = await loadQsmDir(dir);
  expect(r.ok).toBe(false);
  if (!r.ok) {
    expect(r.errors[0]).toMatchObject({
      code: ERROR_CODES.QSM_PARSE_DIR_INDEX_JSON_INVALID,
      path: 'qsm.json',
    });
    expect(r.errors[0]?.message).toContain('invalid JSON in qsm.json');
    expect(r.errors[0]?.cause).toEqual(expect.any(SyntaxError));
  }
});

it('reports invalid qsm.json schema with Zod issues in cause', async () => {
  writeFileSync(join(dir, 'qsm.json'), JSON.stringify({ version: 1 }));
  mkdirSync(join(dir, 'projections'));
  const r = await loadQsmDir(dir);
  expect(r.ok).toBe(false);
  if (!r.ok) {
    expect(r.errors[0]).toMatchObject({
      code: ERROR_CODES.QSM_PARSE_DIR_INDEX_SCHEMA_VIOLATION,
      path: 'qsm.json',
      message: 'qsm.json failed validation',
    });
    expect(r.errors[0]?.cause).toEqual(expect.any(Array));
  }
});

it('reports malformed projection JSON with the leaf file path', async () => {
  writeFileSync(join(dir, 'qsm.json'), JSON.stringify({ version: '1' }));
  mkdirSync(join(dir, 'projections'));
  writeFileSync(join(dir, 'projections', 'ProductCard.json'), '{not-json');
  const r = await loadQsmDir(dir);
  expect(r.ok).toBe(false);
  if (!r.ok) {
    expect(r.errors[0]).toMatchObject({
      code: ERROR_CODES.QSM_PARSE_DIR_PROJECTION_JSON_INVALID,
      path: 'projections/ProductCard.json',
    });
    expect(r.errors[0]?.message).toContain('invalid JSON in projections/ProductCard.json');
  }
});

it('reports non-directory projections path as a read failure, not missing', async () => {
  writeFileSync(join(dir, 'qsm.json'), JSON.stringify({ version: '1' }));
  writeFileSync(join(dir, 'projections'), 'not a directory');
  const r = await loadQsmDir(dir);
  expect(r.ok).toBe(false);
  if (!r.ok) {
    expect(r.errors[0]).toMatchObject({
      code: ERROR_CODES.QSM_PARSE_DIR_READ_FAILED,
      path: 'projections',
    });
  }
});

it('preserves parseQsm schema errors from composed projections', async () => {
  writeFileSync(join(dir, 'qsm.json'), JSON.stringify({ version: '1' }));
  mkdirSync(join(dir, 'projections'));
  writeFileSync(
    join(dir, 'projections', 'ProductCard.json'),
    JSON.stringify({ source: { entity: 'Product' }, keys: 'not-array', grain: ['id'], exposed: ['id'] }),
  );

  const r = await loadQsmDir(dir);
  expect(r.ok).toBe(false);
  if (!r.ok) {
    expect(r.errors[0]?.code).toBe(ERROR_CODES.QSM_PARSE_SCHEMA_VIOLATION);
    expect(r.errors[0]?.path).toContain('projections.ProductCard.keys');
  }
});
```

- [ ] **Step 2: Run QSM loader tests and confirm they fail**

Run:

```bash
pnpm -F @rntme/qsm test -- test/unit/load-dir.test.ts
```

Expected before implementation: missing new `ERROR_CODES` members and old generic `QSM_PARSE_DIR_INVALID` behavior.

- [ ] **Step 3: Add QSM `cause` and append error codes**

In `packages/artifacts/qsm/src/types/result.ts`, add `cause?: unknown`:

```ts
export type QsmError = {
  layer: Layer;
  code: QsmErrorCode;
  message: string;
  path?: string;
  hint?: string;
  cause?: unknown;
};
```

Append new codes immediately after `QSM_PARSE_DIR_INVALID`:

```ts
  QSM_PARSE_DIR_INVALID: 'QSM_PARSE_DIR_INVALID',
  QSM_PARSE_DIR_INDEX_MISSING: 'QSM_PARSE_DIR_INDEX_MISSING',
  QSM_PARSE_DIR_PROJECTIONS_MISSING: 'QSM_PARSE_DIR_PROJECTIONS_MISSING',
  QSM_PARSE_DIR_INDEX_JSON_INVALID: 'QSM_PARSE_DIR_INDEX_JSON_INVALID',
  QSM_PARSE_DIR_INDEX_SCHEMA_VIOLATION: 'QSM_PARSE_DIR_INDEX_SCHEMA_VIOLATION',
  QSM_PARSE_DIR_PROJECTION_JSON_INVALID: 'QSM_PARSE_DIR_PROJECTION_JSON_INVALID',
  QSM_PARSE_DIR_READ_FAILED: 'QSM_PARSE_DIR_READ_FAILED',
```

- [ ] **Step 4: Map shared failure kinds to QSM codes**

In `packages/artifacts/qsm/src/load/load-dir.ts`, import the shared failure type:

```ts
import { loadArtifactDir, type LoadArtifactDirFailure } from '@rntme/artifact-shared';
```

Add a mapper above `loadQsmDir`:

```ts
function qsmDirectoryError(info: LoadArtifactDirFailure): QsmError {
  const base = {
    layer: 'parse' as const,
    message: info.message,
    path: info.path,
    ...(info.cause === undefined ? {} : { cause: info.cause }),
  };

  switch (info.kind) {
    case 'index-missing':
      return {
        ...base,
        code: ERROR_CODES.QSM_PARSE_DIR_INDEX_MISSING,
        message: 'missing required file: qsm.json',
        path: 'qsm.json',
      };
    case 'leaf-dir-missing':
      return {
        ...base,
        code: ERROR_CODES.QSM_PARSE_DIR_PROJECTIONS_MISSING,
        message: 'missing required directory: projections',
        path: 'projections',
      };
    case 'index-json-invalid':
      return {
        ...base,
        code: ERROR_CODES.QSM_PARSE_DIR_INDEX_JSON_INVALID,
      };
    case 'index-schema-invalid':
      return {
        ...base,
        code: ERROR_CODES.QSM_PARSE_DIR_INDEX_SCHEMA_VIOLATION,
        message: 'qsm.json failed validation',
        path: 'qsm.json',
      };
    case 'leaf-json-invalid':
      return {
        ...base,
        code: ERROR_CODES.QSM_PARSE_DIR_PROJECTION_JSON_INVALID,
      };
    case 'read-failed':
      return {
        ...base,
        code: ERROR_CODES.QSM_PARSE_DIR_READ_FAILED,
        message: `failed to read ${info.path}: ${info.message}`,
      };
  }
}
```

Then replace the inline `buildIoError` callback with:

```ts
    buildIoError: qsmDirectoryError,
```

- [ ] **Step 5: Verify QSM focused tests**

Run:

```bash
pnpm -F @rntme/qsm test -- test/unit/load-dir.test.ts
```

Expected: pass.

### Task 3: Blueprint Nested-Cause Regression

**Files:**
- Modify: `packages/artifacts/blueprint/test/unit/load-blueprint.test.ts`

- [ ] **Step 1: Add a failing blueprint wrapper test**

Append this test to `packages/artifacts/blueprint/test/unit/load-blueprint.test.ts`:

```ts
it('preserves structured qsm load errors inside blueprint IO cause', async () => {
  const temp = mkdtempSync(join(tmpdir(), 'rntme-blueprint-'));
  const copied = join(temp, 'product-catalog-project');
  cpSync(fixtureDir, copied, { recursive: true });
  writeFileSync(join(copied, 'services', 'catalog', 'qsm', 'qsm.json'), '{not-json');

  const r = await loadBlueprint(copied);
  expect(r.ok).toBe(false);
  if (r.ok) return;

  expect(r.errors[0]).toMatchObject({
    layer: 'load',
    code: ERROR_CODES.BLUEPRINT_IO_ERROR,
    path: 'services/catalog/qsm',
  });
  expect(r.errors[0]!.cause).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        code: 'QSM_PARSE_DIR_INDEX_JSON_INVALID',
        path: 'qsm.json',
      }),
    ]),
  );
});
```

This test should pass once Task 2 is implemented; no blueprint production-code change is expected.

- [ ] **Step 2: Run the focused blueprint test**

Run:

```bash
pnpm -F @rntme/blueprint test -- test/unit/load-blueprint.test.ts
```

Expected: pass.

### Task 4: QSM Owner Documentation

**Files:**
- Modify: `docs/current/owners/packages/artifacts/qsm.md`

- [ ] **Step 1: Document the directory-load error contract**

In the API table, add `loadQsmDir` if it is not already listed after implementation exports are verified:

```md
| `loadQsmDir` | `(dir: string) => Promise<Result<QsmArtifact>>` | Loads a multi-file QSM directory (`qsm.json` + `projections/*.json`) and returns parse-layer errors for directory IO, JSON syntax, index schema, and composed QSM schema issues. |
```

In the Error codes subsection, keep the existing parse line but expand it to include directory errors:

```md
Parse: `QSM_PARSE_SCHEMA_VIOLATION`.

Directory parse/load: `QSM_PARSE_DIR_INDEX_MISSING`, `QSM_PARSE_DIR_PROJECTIONS_MISSING`, `QSM_PARSE_DIR_INDEX_JSON_INVALID`, `QSM_PARSE_DIR_INDEX_SCHEMA_VIOLATION`, `QSM_PARSE_DIR_PROJECTION_JSON_INVALID`, `QSM_PARSE_DIR_READ_FAILED`. `QSM_PARSE_DIR_INVALID` is legacy/deprecated and remains registered for append-only error-code stability; known directory failures should use the specific codes above.
```

Add an invariant/gotcha near the existing `parseQsm` gotcha:

```md
- `loadQsmDir(dir)` loads `qsm.json` plus every `projections/*.json` file and returns parse-layer `Result` errors. Expected absence uses `QSM_PARSE_DIR_INDEX_MISSING` (`path: "qsm.json"`) or `QSM_PARSE_DIR_PROJECTIONS_MISSING` (`path: "projections"`). Malformed JSON points to the exact file. Invalid composed projection shape is preserved as `QSM_PARSE_SCHEMA_VIOLATION` from `parseQsm`, with paths such as `projections.ProductCard.keys`; it is not wrapped as a directory-load error. Other filesystem failures use `QSM_PARSE_DIR_READ_FAILED` and should not include file contents or secrets in `cause`.
```

- [ ] **Step 2: Confirm the README stub does not need changes**

Inspect `packages/artifacts/qsm/README.md`. If it still points to the same owner doc and the local commands are unchanged, leave it untouched and record that in the stage comment.

### Task 5: Full Verification and Handoff

**Files:**
- No new files expected beyond the code, tests, and owner doc above.

- [ ] **Step 1: Run package gates**

Run:

```bash
pnpm -F @rntme/artifact-shared test
pnpm -F @rntme/artifact-shared build
pnpm -F @rntme/pdm test
pnpm -F @rntme/pdm build
pnpm -F @rntme/qsm test
pnpm -F @rntme/qsm build
pnpm -F @rntme/blueprint test -- test/unit/load-blueprint.test.ts
git diff --check
```

Expected: all pass.

- [ ] **Step 2: Run broader affected blueprint evidence if time allows**

Run:

```bash
pnpm -F @rntme/blueprint test
```

Expected: pass. If this is too slow or fails outside this change, record the exact failing test and still include the focused `load-blueprint` result.

- [ ] **Step 3: Inspect final diff for scope**

Run:

```bash
git status --short
git diff -- packages/artifacts/_shared/src/load.ts packages/artifacts/qsm/src/load/load-dir.ts packages/artifacts/qsm/src/types/result.ts docs/current/owners/packages/artifacts/qsm.md
```

Expected:
- No product behavior outside shared loader, QSM mapping, and blueprint test coverage.
- `QSM_PARSE_DIR_INVALID` still exists.
- New QSM codes are appended after the legacy code.
- No file contents are stored in `cause`.

- [ ] **Step 4: Commit and push on the canonical branch**

Run:

```bash
git add packages/artifacts/_shared/src/load.ts packages/artifacts/_shared/src/index.ts packages/artifacts/_shared/test/load.test.ts packages/artifacts/qsm/src/types/result.ts packages/artifacts/qsm/src/load/load-dir.ts packages/artifacts/qsm/test/unit/load-dir.test.ts packages/artifacts/blueprint/test/unit/load-blueprint.test.ts docs/current/owners/packages/artifacts/qsm.md
git commit -m "fix(qsm): split directory loader errors"
git fetch --prune origin
git rebase origin/main
pnpm -F @rntme/qsm test
pnpm -F @rntme/qsm build
git diff --check
git push origin auto/RNT-492-qsm-directory-error-taxonomy
```

If the branch already has the SPEC/PLAN commits, keep them and add the DEV commit on top. Do not create another branch, worktree, PR, or child issue.

## Acceptance Criteria Mapping

- Missing files/dirs distinguishable: Task 2 tests `QSM_PARSE_DIR_INDEX_MISSING` and `QSM_PARSE_DIR_PROJECTIONS_MISSING`.
- Malformed JSON distinguishable: Task 2 tests `QSM_PARSE_DIR_INDEX_JSON_INVALID` and `QSM_PARSE_DIR_PROJECTION_JSON_INVALID`.
- Invalid `qsm.json` schema distinguishable: Task 2 tests `QSM_PARSE_DIR_INDEX_SCHEMA_VIOLATION`.
- Parse/semantic parser errors preserved: Task 1 parser pass-through and Task 2 composed schema test.
- Filesystem failures separate from absence: Task 1 shared tests and Task 2 non-directory `projections` test.
- Blueprint nested evidence: Task 3.
- Docs updated: Task 4.

## Collision Points and Risks

- `loadArtifactDir` is shared by PDM and QSM. DEV must run shared and PDM gates, not only QSM.
- TypeScript callback variance should allow existing PDM `buildIoError` destructuring to continue, but if it does not, update PDM's callback annotation to the widened shared type.
- Permission-mode tests can be flaky under root-like CI. Prefer type/read route failures that are stable (`qsm.json` as directory, `projections` as file) over `chmod` assertions.
- `cause?: unknown` must not carry raw file contents. Use SyntaxError objects, Zod `issues`, or original filesystem error metadata.
- Blueprint may still show only the outer `BLUEPRINT_IO_ERROR.message`; this issue only requires nested QSM structure to be preserved.
