# Project Lifecycle Init Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the project-level `init/init.json` authoring and validation foundation, and record the project-log/DWH replay decision, without implementing deploy/runtime lifecycle execution yet.

**Architecture:** This first slice creates a new `@rntme/init` artifact package that validates project lifecycle init metadata and `seed-events` inputs against project PDM/service ownership. `@rntme/blueprint` loads the validated init artifact during project composition and exposes it on `ComposedBlueprint`. Runtime/deploy execution of lifecycle init is intentionally deferred to later plans.

**Tech Stack:** TypeScript, zod v4, vitest, pnpm workspaces, `@rntme/pdm`, `@rntme/seed`, `@rntme/blueprint`, dependency-cruiser.

---

## Scope Boundary

This plan implements only the first independently testable slice from the approved spec:

- Update `docs/decision-system.md`.
- Add `packages/artifacts/init` as a project-level artifact validator.
- Integrate validated init into `@rntme/blueprint` composition.
- Add tests and owner docs for the new authoring surface.

This plan does **not**:

- Change deploy phase ordering.
- Start Operaton lifecycle processes.
- Publish init events to Redpanda.
- Add projection checkpoint/status acknowledgement.
- Remove runtime boot seed support.
- Migrate demos away from `services/<service>/seed/seed.json`.

Those are separate plans because they touch independent runtime/deploy subsystems.

## File Structure

- Create `packages/artifacts/init/`:
  - `package.json`, `README.md`, `tsconfig.json`, `tsconfig.check.json`, `eslint.config.mjs`, `vitest.config.ts`.
  - `src/types/artifact.ts`: public artifact and branded validated types.
  - `src/types/context.ts`: cross-reference context supplied by blueprint.
  - `src/types/result.ts`: `Result`, `InitError`, and stable `INIT_*` error codes.
  - `src/parse/schema.ts`: strict zod schemas for `init/init.json`.
  - `src/parse/parse.ts`: parse helper using `parseWithSchema`.
  - `src/validate/structural.ts`: safe path, duplicate id, dependency, and supported provider/mode checks.
  - `src/validate/cross-ref.ts`: service ownership, file existence, and `seed-events` validation.
  - `src/validate/index.ts`: validation barrel.
  - `src/index.ts`: public exports.
  - `test/unit/*.test.ts`: parse, structural, cross-ref, result tests.
- Modify `packages/artifacts/blueprint/`:
  - `package.json`: add `@rntme/init`.
  - `src/types/artifact.ts`: add `ValidatedInitArtifact | null` to `ComposedBlueprint`.
  - `src/types/result.ts`: add `BLUEPRINT_INIT_INVALID`.
  - `src/compose/project-init.ts`: load and validate `init/init.json`.
  - `src/compose/load-composed-blueprint.ts`: call `loadProjectInit`.
  - `src/index.ts`: export init loader if following workflows pattern.
  - `test/unit/project-init.test.ts`: blueprint integration coverage.
  - `test/unit/load-composed-blueprint.test.ts`: assert composed result carries init when present.
- Modify docs:
  - `docs/decision-system.md`.
  - `packages/artifacts/init/README.md`.
  - `docs/current/owners/packages/artifacts/init.md`.
  - `docs/current/owners/packages/artifacts/blueprint.md`.
  - `AGENTS.md` only if this slice decides to add `packages/artifacts/init/README.md` to the package lookup table.

---

### Task 1: Record Project Event Log Decision

**Files:**
- Modify: `docs/decision-system.md`

- [ ] **Step 1: Edit the event-store bets**

In `docs/decision-system.md`, in section `3.2 Storage / Persistence`, supersede the two existing locked lines:

```md
- ~~**Single-writer event log** - `event_store` is the only write path; load-bearing for optimistic concurrency and the monotonic publish cursor · G1 · `superseded` · superseded by `Project event log + DWH own replay truth` in spec `docs/superpowers/specs/2026-05-08-project-lifecycle-init-design.md`~~
- ~~**No outbox table; event log IS the outbox** - plus delivery tracking for metrics · F2 · `superseded` · superseded by `Project event log + DWH own replay truth` in spec `docs/superpowers/specs/2026-05-08-project-lifecycle-init-design.md`~~
```

Then append the new bet immediately after them:

```md
- **Project event log + DWH own replay truth** - Kafka-compatible project topics are the operational event log; DWH is the long-retention replay/audit source. Service-local event stores are allowed as transactional outbox/write buffers, not as the durable replay boundary. QSM is serving state and must not be treated as replay truth. Events must carry the domain facts needed to rebuild owned projections; projection logic must not depend on unrecorded point-in-time external state. · G1, G3, F4, F6, F8 · `locked-pending` · spec `docs/superpowers/specs/2026-05-08-project-lifecycle-init-design.md`
```

- [ ] **Step 2: Verify the exact decision text is present**

Run:

```bash
rg -n "Project event log \\+ DWH own replay truth|superseded by `Project event log" docs/decision-system.md
```

Expected: one active bet line and two superseded lines.

- [ ] **Step 3: Commit**

```bash
git add docs/decision-system.md
git commit -m "docs: record project event log decision"
```

---

### Task 2: Scaffold `@rntme/init`

**Files:**
- Create: `packages/artifacts/init/package.json`
- Create: `packages/artifacts/init/README.md`
- Create: `packages/artifacts/init/tsconfig.json`
- Create: `packages/artifacts/init/tsconfig.check.json`
- Create: `packages/artifacts/init/eslint.config.mjs`
- Create: `packages/artifacts/init/vitest.config.ts`
- Create: `packages/artifacts/init/src/index.ts`
- Create: `packages/artifacts/init/src/types/result.ts`
- Create: `packages/artifacts/init/test/unit/result.test.ts`
- Modify: `AGENTS.md`

- [ ] **Step 1: Create package metadata**

Create `packages/artifacts/init/package.json`:

```json
{
  "name": "@rntme/init",
  "version": "0.0.0",
  "type": "module",
  "private": true,
  "description": "Project-level lifecycle init artifact parser and validator.",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": ["dist", "README.md"],
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc -p tsconfig.check.json",
    "lint": "eslint \"src/**/*.ts\" \"test/**/*.ts\"",
    "format": "prettier --write ."
  },
  "dependencies": {
    "@rntme/artifact-shared": "workspace:*",
    "@rntme/pdm": "workspace:*",
    "@rntme/seed": "workspace:*",
    "zod": "^4.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.14.0",
    "@typescript-eslint/eslint-plugin": "^8.6.0",
    "@typescript-eslint/parser": "^8.6.0",
    "eslint": "^9.10.0",
    "prettier": "^3.3.3",
    "typescript": "^5.5.4",
    "vitest": "^2.1.1"
  }
}
```

- [ ] **Step 2: Create package docs stub**

Create `packages/artifacts/init/README.md`:

```md
# @rntme/init

Project-level lifecycle init artifact package documentation.

Current documentation: [docs/current/owners/packages/artifacts/init.md](../../../docs/current/owners/packages/artifacts/init.md)

Local commands:
- `pnpm -F @rntme/init test`
- `pnpm -F @rntme/init typecheck`

Notes:
- Keep this file short. Update the current doc when public API, invariants, gotchas, local commands, or package navigation changes.
```

- [ ] **Step 3: Create TypeScript configs**

Create `packages/artifacts/init/tsconfig.json`:

```json
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*.ts"]
}
```

Create `packages/artifacts/init/tsconfig.check.json`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noEmit": true
  },
  "include": ["src/**/*.ts", "test/**/*.ts"]
}
```

- [ ] **Step 4: Create lint/test configs**

Create `packages/artifacts/init/eslint.config.mjs`:

```js
import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

export default [
  { ignores: ['dist/**', 'node_modules/**'] },
  js.configs.recommended,
  {
    files: ['src/**/*.ts', 'test/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        sourceType: 'module',
        ecmaVersion: 2022,
      },
      globals: {
        console: 'readonly',
        process: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-console': 'warn',
    },
  },
];
```

Create `packages/artifacts/init/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
  },
});
```

- [ ] **Step 5: Create result types**

Create `packages/artifacts/init/src/types/result.ts`:

```ts
import type { Result as SharedResult } from '@rntme/artifact-shared';

export { ok, err, isOk, isErr } from '@rntme/artifact-shared';
export type { Ok, Err } from '@rntme/artifact-shared';

export type Layer = 'parse' | 'structural' | 'cross-ref' | 'internal';

export type InitError = {
  readonly layer: Layer;
  readonly code: InitErrorCode;
  readonly message: string;
  readonly path?: string;
  readonly cause?: readonly unknown[];
};

export type Result<T> = SharedResult<T, InitError>;

export const ERROR_CODES = {
  INIT_PARSE_SCHEMA_VIOLATION: 'INIT_PARSE_SCHEMA_VIOLATION',
  INIT_STRUCT_PROCESS_DEFINITION_PATH_INVALID: 'INIT_STRUCT_PROCESS_DEFINITION_PATH_INVALID',
  INIT_STRUCT_STEP_ID_DUPLICATE: 'INIT_STRUCT_STEP_ID_DUPLICATE',
  INIT_STRUCT_STEP_PROVIDER_UNSUPPORTED: 'INIT_STRUCT_STEP_PROVIDER_UNSUPPORTED',
  INIT_STRUCT_STEP_MODE_UNSUPPORTED: 'INIT_STRUCT_STEP_MODE_UNSUPPORTED',
  INIT_STRUCT_STEP_INPUT_PATH_INVALID: 'INIT_STRUCT_STEP_INPUT_PATH_INVALID',
  INIT_STRUCT_STEP_DEPENDS_ON_UNKNOWN: 'INIT_STRUCT_STEP_DEPENDS_ON_UNKNOWN',
  INIT_STRUCT_STEP_DEPENDS_ON_SELF: 'INIT_STRUCT_STEP_DEPENDS_ON_SELF',
  INIT_XREF_PROCESS_DEFINITION_MISSING: 'INIT_XREF_PROCESS_DEFINITION_MISSING',
  INIT_XREF_STEP_INPUT_MISSING: 'INIT_XREF_STEP_INPUT_MISSING',
  INIT_XREF_TARGET_SERVICE_UNKNOWN: 'INIT_XREF_TARGET_SERVICE_UNKNOWN',
  INIT_XREF_SEED_INVALID: 'INIT_XREF_SEED_INVALID',
} as const;

export type InitErrorCode = keyof typeof ERROR_CODES;
```

- [ ] **Step 6: Create public index**

Create `packages/artifacts/init/src/index.ts`:

```ts
export {
  ERROR_CODES,
  err,
  isErr,
  isOk,
  ok,
  type InitError,
  type InitErrorCode,
  type Result,
} from './types/result.js';
```

- [ ] **Step 7: Write result smoke test**

Create `packages/artifacts/init/test/unit/result.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { ERROR_CODES, err, isErr, isOk, ok } from '../../src/index.js';

describe('@rntme/init result helpers', () => {
  it('exports shared result helpers and stable error codes', () => {
    const success = ok({ value: 1 });
    const failure = err([
      {
        layer: 'parse',
        code: ERROR_CODES.INIT_PARSE_SCHEMA_VIOLATION,
        message: 'bad init artifact',
      },
    ]);

    expect(isOk(success)).toBe(true);
    expect(isErr(failure)).toBe(true);
    expect(ERROR_CODES.INIT_XREF_SEED_INVALID).toBe('INIT_XREF_SEED_INVALID');
  });
});
```

- [ ] **Step 8: Add AGENTS package lookup entry**

In `AGENTS.md`, add `packages/artifacts/init/README.md` to the Artifacts row in the Package Lookup table.

- [ ] **Step 9: Run package test**

Run:

```bash
pnpm -F @rntme/init test
```

Expected: PASS, one test file.

- [ ] **Step 10: Commit**

```bash
git add AGENTS.md packages/artifacts/init
git commit -m "feat(init): scaffold project init artifact package"
```

---

### Task 3: Add Init Artifact Parse And Structural Validation

**Files:**
- Create: `packages/artifacts/init/src/types/artifact.ts`
- Create: `packages/artifacts/init/src/parse/schema.ts`
- Create: `packages/artifacts/init/src/parse/parse.ts`
- Create: `packages/artifacts/init/src/validate/structural.ts`
- Create: `packages/artifacts/init/src/validate/index.ts`
- Modify: `packages/artifacts/init/src/index.ts`
- Test: `packages/artifacts/init/test/unit/parse.test.ts`
- Test: `packages/artifacts/init/test/unit/validate-structural.test.ts`

- [ ] **Step 1: Write parse tests**

Create `packages/artifacts/init/test/unit/parse.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseInitArtifact } from '../../src/index.js';

const valid = {
  initVersion: 1,
  process: {
    kind: 'bpmn',
    definition: 'project-initialized.bpmn',
    processId: 'ProjectInitialized',
  },
  steps: [
    {
      id: 'notes.welcome',
      type: 'init',
      provider: 'seed-events',
      targetService: 'app',
      mode: 'lifecycle',
      input: { path: 'files/notes.seed.json' },
      dependsOn: [],
    },
  ],
};

describe('parseInitArtifact', () => {
  it('parses a valid object', () => {
    const result = parseInitArtifact(valid);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.steps[0]?.id).toBe('notes.welcome');
  });

  it('parses a JSON string', () => {
    const result = parseInitArtifact(JSON.stringify(valid));
    expect(result.ok).toBe(true);
  });

  it('rejects unknown fields', () => {
    const result = parseInitArtifact({ ...valid, extra: true });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]?.code).toBe('INIT_PARSE_SCHEMA_VIOLATION');
      expect(result.errors[0]?.path).toBeDefined();
    }
  });

  it('rejects unsupported initVersion', () => {
    const result = parseInitArtifact({ ...valid, initVersion: 2 });
    expect(result.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Write structural tests**

Create `packages/artifacts/init/test/unit/validate-structural.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseInitArtifact, validateInitStructural } from '../../src/index.js';

function parsed(raw: unknown) {
  const result = parseInitArtifact(raw);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.value;
}

const base = {
  initVersion: 1,
  process: {
    kind: 'bpmn',
    definition: 'project-initialized.bpmn',
    processId: 'ProjectInitialized',
  },
  steps: [
    {
      id: 'notes.welcome',
      type: 'init',
      provider: 'seed-events',
      targetService: 'app',
      mode: 'lifecycle',
      input: { path: 'files/notes.seed.json' },
      dependsOn: [],
    },
  ],
};

describe('validateInitStructural', () => {
  it('accepts a valid artifact', () => {
    expect(validateInitStructural(parsed(base)).ok).toBe(true);
  });

  it('rejects unsafe process definition paths', () => {
    const result = validateInitStructural(parsed({
      ...base,
      process: { ...base.process, definition: '../workflow.bpmn' },
    }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]?.code).toBe('INIT_STRUCT_PROCESS_DEFINITION_PATH_INVALID');
  });

  it('rejects duplicate step ids', () => {
    const result = validateInitStructural(parsed({
      ...base,
      steps: [base.steps[0], base.steps[0]],
    }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]?.code).toBe('INIT_STRUCT_STEP_ID_DUPLICATE');
  });

  it('rejects unsupported providers and modes', () => {
    const result = validateInitStructural(parsed({
      ...base,
      steps: [{ ...base.steps[0], provider: 'raw-sql', mode: 'boot' }],
    }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.map((e) => e.code)).toEqual(expect.arrayContaining([
        'INIT_STRUCT_STEP_PROVIDER_UNSUPPORTED',
        'INIT_STRUCT_STEP_MODE_UNSUPPORTED',
      ]));
    }
  });

  it('rejects unsafe seed input paths', () => {
    const result = validateInitStructural(parsed({
      ...base,
      steps: [{ ...base.steps[0], input: { path: 'https://example.test/seed.json' } }],
    }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]?.code).toBe('INIT_STRUCT_STEP_INPUT_PATH_INVALID');
  });

  it('rejects missing and self dependencies', () => {
    const result = validateInitStructural(parsed({
      ...base,
      steps: [{ ...base.steps[0], dependsOn: ['notes.welcome', 'missing.step'] }],
    }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.map((e) => e.code)).toEqual(expect.arrayContaining([
        'INIT_STRUCT_STEP_DEPENDS_ON_SELF',
        'INIT_STRUCT_STEP_DEPENDS_ON_UNKNOWN',
      ]));
    }
  });
});
```

- [ ] **Step 3: Run tests and verify they fail**

Run:

```bash
pnpm -F @rntme/init test
```

Expected: FAIL because `parseInitArtifact` and `validateInitStructural` are not implemented.

- [ ] **Step 4: Add artifact types**

Create `packages/artifacts/init/src/types/artifact.ts`:

```ts
export type InitVersion = 1;
export type InitProcessKind = 'bpmn';
export type InitStepType = 'init';
export type InitProvider = 'seed-events';
export type InitMode = 'lifecycle';

export type InitProcess = {
  readonly kind: InitProcessKind;
  readonly definition: string;
  readonly processId: string;
};

export type InitStepInput = {
  readonly path: string;
};

export type InitStep = {
  readonly id: string;
  readonly type: InitStepType;
  readonly provider: InitProvider;
  readonly targetService: string;
  readonly mode: InitMode;
  readonly input: InitStepInput;
  readonly dependsOn?: readonly string[];
};

export type InitArtifact = {
  readonly initVersion: InitVersion;
  readonly process: InitProcess;
  readonly steps: readonly InitStep[];
};

declare const StructurallyValidBrand: unique symbol;
declare const ValidatedBrand: unique symbol;

export type StructurallyValidInitArtifact = InitArtifact & {
  readonly [StructurallyValidBrand]: true;
};

export type ValidatedInitArtifact = StructurallyValidInitArtifact & {
  readonly [ValidatedBrand]: true;
};
```

- [ ] **Step 5: Add zod schema and parser**

Create `packages/artifacts/init/src/parse/schema.ts`:

```ts
import { z } from 'zod';

const nonEmptyString = z.string().min(1);

const processSchema = z
  .object({
    kind: z.literal('bpmn'),
    definition: nonEmptyString,
    processId: nonEmptyString,
  })
  .strict();

const stepSchema = z
  .object({
    id: nonEmptyString,
    type: z.literal('init'),
    provider: nonEmptyString,
    targetService: nonEmptyString,
    mode: nonEmptyString,
    input: z.object({ path: nonEmptyString }).strict(),
    dependsOn: z.array(nonEmptyString).default([]),
  })
  .strict();

export const InitArtifactSchema = z
  .object({
    initVersion: z.literal(1),
    process: processSchema,
    steps: z.array(stepSchema).default([]),
  })
  .strict();
```

Create `packages/artifacts/init/src/parse/parse.ts`:

```ts
import { parseWithSchema } from '@rntme/artifact-shared';
import type { ZodType } from 'zod';
import { InitArtifactSchema } from './schema.js';
import type { InitArtifact } from '../types/artifact.js';
import { ERROR_CODES, type InitError, type Result } from '../types/result.js';

export function parseInitArtifact(input: unknown): Result<InitArtifact> {
  return parseWithSchema<InitArtifact, InitError>(
    input,
    InitArtifactSchema as ZodType<InitArtifact>,
    {
      fromJson: (message) => ({
        layer: 'parse',
        code: ERROR_CODES.INIT_PARSE_SCHEMA_VIOLATION,
        message,
      }),
      fromIssue: (issue, path) => {
        const base: InitError = {
          layer: 'parse',
          code: ERROR_CODES.INIT_PARSE_SCHEMA_VIOLATION,
          message: issue.message,
        };
        return path === undefined ? base : { ...base, path };
      },
    },
  );
}
```

- [ ] **Step 6: Add structural validator**

Create `packages/artifacts/init/src/validate/structural.ts`:

```ts
import type { InitArtifact, StructurallyValidInitArtifact } from '../types/artifact.js';
import { ERROR_CODES, err, ok, type InitError, type Result } from '../types/result.js';

const URL_SCHEME_RE = /^[A-Za-z][A-Za-z0-9+.-]*:/;
const SUPPORTED_PROVIDERS = new Set(['seed-events']);
const SUPPORTED_MODES = new Set(['lifecycle']);

export function validateInitStructural(
  artifact: InitArtifact,
): Result<StructurallyValidInitArtifact> {
  const errors: InitError[] = [];

  if (!isSafeRelativePath(artifact.process.definition) || !artifact.process.definition.endsWith('.bpmn')) {
    errors.push({
      layer: 'structural',
      code: ERROR_CODES.INIT_STRUCT_PROCESS_DEFINITION_PATH_INVALID,
      message: 'process.definition must be a relative .bpmn path inside init/',
      path: 'process.definition',
    });
  }

  const stepIds = new Set<string>();
  for (const [idx, step] of artifact.steps.entries()) {
    if (stepIds.has(step.id)) {
      errors.push({
        layer: 'structural',
        code: ERROR_CODES.INIT_STRUCT_STEP_ID_DUPLICATE,
        message: `duplicate init step id "${step.id}"`,
        path: `steps.${idx}.id`,
      });
    }
    stepIds.add(step.id);

    if (!SUPPORTED_PROVIDERS.has(step.provider)) {
      errors.push({
        layer: 'structural',
        code: ERROR_CODES.INIT_STRUCT_STEP_PROVIDER_UNSUPPORTED,
        message: `init step "${step.id}" uses unsupported provider "${step.provider}"`,
        path: `steps.${idx}.provider`,
      });
    }

    if (!SUPPORTED_MODES.has(step.mode)) {
      errors.push({
        layer: 'structural',
        code: ERROR_CODES.INIT_STRUCT_STEP_MODE_UNSUPPORTED,
        message: `init step "${step.id}" uses unsupported mode "${step.mode}"`,
        path: `steps.${idx}.mode`,
      });
    }

    if (!isSafeRelativePath(step.input.path)) {
      errors.push({
        layer: 'structural',
        code: ERROR_CODES.INIT_STRUCT_STEP_INPUT_PATH_INVALID,
        message: `init step "${step.id}" input.path must be relative inside init/`,
        path: `steps.${idx}.input.path`,
      });
    }
  }

  for (const [idx, step] of artifact.steps.entries()) {
    for (const dependency of step.dependsOn ?? []) {
      if (dependency === step.id) {
        errors.push({
          layer: 'structural',
          code: ERROR_CODES.INIT_STRUCT_STEP_DEPENDS_ON_SELF,
          message: `init step "${step.id}" cannot depend on itself`,
          path: `steps.${idx}.dependsOn`,
        });
      } else if (!stepIds.has(dependency)) {
        errors.push({
          layer: 'structural',
          code: ERROR_CODES.INIT_STRUCT_STEP_DEPENDS_ON_UNKNOWN,
          message: `init step "${step.id}" depends on unknown step "${dependency}"`,
          path: `steps.${idx}.dependsOn`,
        });
      }
    }
  }

  if (errors.length > 0) return err(errors);
  return ok(artifact as StructurallyValidInitArtifact);
}

function isSafeRelativePath(path: string): boolean {
  if (path === '') return false;
  if (path.startsWith('/')) return false;
  if (path.includes('\\')) return false;
  if (URL_SCHEME_RE.test(path)) return false;
  return path.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..');
}
```

- [ ] **Step 7: Add validation barrel and exports**

Create `packages/artifacts/init/src/validate/index.ts`:

```ts
export { validateInitStructural } from './structural.js';
```

Replace `packages/artifacts/init/src/index.ts` with:

```ts
export { parseInitArtifact } from './parse/parse.js';
export { validateInitStructural } from './validate/index.js';
export type {
  InitArtifact,
  InitMode,
  InitProcess,
  InitProvider,
  InitStep,
  InitStepInput,
  InitStepType,
  InitVersion,
  StructurallyValidInitArtifact,
  ValidatedInitArtifact,
} from './types/artifact.js';
export {
  ERROR_CODES,
  err,
  isErr,
  isOk,
  ok,
  type InitError,
  type InitErrorCode,
  type Result,
} from './types/result.js';
```

- [ ] **Step 8: Run tests**

Run:

```bash
pnpm -F @rntme/init test
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add packages/artifacts/init
git commit -m "feat(init): parse lifecycle init artifact"
```

---

### Task 4: Validate `seed-events` Init Steps

**Files:**
- Create: `packages/artifacts/init/src/types/context.ts`
- Create: `packages/artifacts/init/src/validate/cross-ref.ts`
- Modify: `packages/artifacts/init/src/validate/index.ts`
- Modify: `packages/artifacts/init/src/index.ts`
- Test: `packages/artifacts/init/test/unit/validate-cross-ref.test.ts`

- [ ] **Step 1: Write cross-reference tests**

Create `packages/artifacts/init/test/unit/validate-cross-ref.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createPdmResolver, deriveEventTypes, validatePdm } from '@rntme/pdm';
import {
  parseInitArtifact,
  validateInitCrossRef,
  validateInitStructural,
  type InitCrossRefContext,
} from '../../src/index.js';

function projectPdm() {
  const result = validatePdm({
    entities: {
      Note: {
        ownerService: 'app',
        kind: 'root',
        table: 'notes',
        fields: {
          id: { type: 'string', nullable: false, column: 'id' },
          status: { type: 'string', nullable: false, column: 'status' },
          body: { type: 'string', nullable: false, column: 'body' },
        },
        keys: ['id'],
        stateMachine: {
          stateField: 'status',
          initial: null,
          states: ['active'],
          transitions: {
            create: { from: null, to: 'active', affects: ['body'] },
          },
        },
      },
      Invoice: {
        ownerService: 'billing',
        kind: 'root',
        table: 'invoices',
        fields: {
          id: { type: 'string', nullable: false, column: 'id' },
          status: { type: 'string', nullable: false, column: 'status' },
        },
        keys: ['id'],
        stateMachine: {
          stateField: 'status',
          initial: null,
          states: ['issued'],
          transitions: {
            issue: { from: null, to: 'issued' },
          },
        },
      },
    },
  });
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.value;
}

function artifact(stepOverrides: Record<string, unknown> = {}) {
  const parsed = parseInitArtifact({
    initVersion: 1,
    process: { kind: 'bpmn', definition: 'project-initialized.bpmn', processId: 'ProjectInitialized' },
    steps: [
      {
        id: 'notes.welcome',
        type: 'init',
        provider: 'seed-events',
        targetService: 'app',
        mode: 'lifecycle',
        input: { path: 'files/notes.seed.json' },
        dependsOn: [],
        ...stepOverrides,
      },
    ],
  });
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
  const structural = validateInitStructural(parsed.value);
  if (!structural.ok) throw new Error(JSON.stringify(structural.errors));
  return structural.value;
}

function ctx(seed: unknown, overrides: Partial<InitCrossRefContext> = {}): InitCrossRefContext {
  const pdm = projectPdm();
  return {
    services: ['app', 'billing'],
    pdm: createPdmResolver(pdm),
    eventsByService: {
      app: deriveEventTypes(pdm).filter((e) => e.aggregateType === 'Note'),
      billing: deriveEventTypes(pdm).filter((e) => e.aggregateType === 'Invoice'),
    },
    fileExists: (path) => path === 'project-initialized.bpmn' || path === 'files/notes.seed.json',
    readJson: (path) => path === 'files/notes.seed.json' ? seed : null,
    ...overrides,
  };
}

const validSeed = {
  seedVersion: 1,
  events: [
    {
      id: 'seed:Note:welcome:v1',
      subject: 'Note-welcome',
      rntAggregateType: 'Note',
      rntAggregateId: 'welcome',
      rntVersion: 1,
      eventType: 'NoteCreate',
      data: { body: 'Welcome' },
      time: '2026-05-08T00:00:00.000Z',
    },
  ],
};

describe('validateInitCrossRef', () => {
  it('accepts a valid seed-events step', () => {
    const result = validateInitCrossRef(artifact(), ctx(validSeed));
    expect(result.ok).toBe(true);
  });

  it('rejects missing process definitions', () => {
    const result = validateInitCrossRef(artifact(), ctx(validSeed, { fileExists: (path) => path !== 'project-initialized.bpmn' }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]?.code).toBe('INIT_XREF_PROCESS_DEFINITION_MISSING');
  });

  it('rejects unknown target services', () => {
    const result = validateInitCrossRef(artifact({ targetService: 'missing' }), ctx(validSeed));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]?.code).toBe('INIT_XREF_TARGET_SERVICE_UNKNOWN');
  });

  it('rejects missing seed input files', () => {
    const result = validateInitCrossRef(artifact(), ctx(validSeed, { fileExists: (path) => path === 'project-initialized.bpmn' }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]?.code).toBe('INIT_XREF_STEP_INPUT_MISSING');
  });

  it('rejects seed events outside the target service owner scope', () => {
    const badSeed = {
      seedVersion: 1,
      events: [
        {
          id: 'seed:Invoice:1:v1',
          subject: 'Invoice-1',
          rntAggregateType: 'Invoice',
          rntAggregateId: '1',
          rntVersion: 1,
          eventType: 'InvoiceIssue',
          data: {},
          time: '2026-05-08T00:00:00.000Z',
        },
      ],
    };
    const result = validateInitCrossRef(artifact(), ctx(badSeed));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]?.code).toBe('INIT_XREF_SEED_INVALID');
  });
});
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
pnpm -F @rntme/init test -- test/unit/validate-cross-ref.test.ts
```

Expected: FAIL because `validateInitCrossRef` and `InitCrossRefContext` are missing.

- [ ] **Step 3: Add cross-ref context type**

Create `packages/artifacts/init/src/types/context.ts`:

```ts
import type { EventTypeSpec, PdmResolver } from '@rntme/pdm';

export type InitCrossRefContext = {
  readonly services: readonly string[];
  readonly pdm: PdmResolver;
  readonly eventsByService: Readonly<Record<string, readonly EventTypeSpec[]>>;
  readonly fileExists: (relativePath: string) => boolean;
  readonly readJson: (relativePath: string) => unknown | null;
};
```

- [ ] **Step 4: Add cross-reference validator**

Create `packages/artifacts/init/src/validate/cross-ref.ts`:

```ts
import { parseSeed, validateSeed } from '@rntme/seed';
import type { StructurallyValidInitArtifact, ValidatedInitArtifact } from '../types/artifact.js';
import type { InitCrossRefContext } from '../types/context.js';
import { ERROR_CODES, err, ok, type InitError, type Result } from '../types/result.js';

export function validateInitCrossRef(
  artifact: StructurallyValidInitArtifact,
  ctx: InitCrossRefContext,
): Result<ValidatedInitArtifact> {
  const errors: InitError[] = [];
  const services = new Set(ctx.services);

  if (!ctx.fileExists(artifact.process.definition)) {
    errors.push({
      layer: 'cross-ref',
      code: ERROR_CODES.INIT_XREF_PROCESS_DEFINITION_MISSING,
      message: `init process definition "${artifact.process.definition}" does not exist under init/`,
      path: 'process.definition',
    });
  }

  for (const [idx, step] of artifact.steps.entries()) {
    if (!services.has(step.targetService)) {
      errors.push({
        layer: 'cross-ref',
        code: ERROR_CODES.INIT_XREF_TARGET_SERVICE_UNKNOWN,
        message: `init step "${step.id}" references unknown service "${step.targetService}"`,
        path: `steps.${idx}.targetService`,
      });
      continue;
    }

    if (!ctx.fileExists(step.input.path)) {
      errors.push({
        layer: 'cross-ref',
        code: ERROR_CODES.INIT_XREF_STEP_INPUT_MISSING,
        message: `init step "${step.id}" input "${step.input.path}" does not exist under init/`,
        path: `steps.${idx}.input.path`,
      });
      continue;
    }

    if (step.provider === 'seed-events') {
      const rawSeed = ctx.readJson(step.input.path);
      const parsedSeed = parseSeed(rawSeed);
      if (!parsedSeed.ok) {
        errors.push({
          layer: 'cross-ref',
          code: ERROR_CODES.INIT_XREF_SEED_INVALID,
          message: `init step "${step.id}" seed input failed to parse`,
          path: `steps.${idx}.input.path`,
          cause: parsedSeed.errors,
        });
        continue;
      }

      const serviceEvents = ctx.eventsByService[step.targetService] ?? [];
      const validatedSeed = validateSeed(parsedSeed.value, {
        pdm: ctx.pdm,
        events: serviceEvents,
        serviceName: step.targetService,
      });
      if (!validatedSeed.ok) {
        errors.push({
          layer: 'cross-ref',
          code: ERROR_CODES.INIT_XREF_SEED_INVALID,
          message: `init step "${step.id}" seed input failed validation`,
          path: `steps.${idx}.input.path`,
          cause: validatedSeed.errors,
        });
      }
    }
  }

  if (errors.length > 0) return err(errors);
  return ok(artifact as ValidatedInitArtifact);
}
```

- [ ] **Step 5: Update exports**

Replace `packages/artifacts/init/src/validate/index.ts` with:

```ts
export { validateInitCrossRef } from './cross-ref.js';
export { validateInitStructural } from './structural.js';
```

Add these exports to `packages/artifacts/init/src/index.ts`:

```ts
export { validateInitCrossRef } from './validate/index.js';
export type { InitCrossRefContext } from './types/context.js';
```

- [ ] **Step 6: Run package checks**

Run:

```bash
pnpm -F @rntme/init test
pnpm -F @rntme/init typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/artifacts/init
git commit -m "feat(init): validate seed event init steps"
```

---

### Task 5: Integrate Init Into Blueprint Composition

**Files:**
- Modify: `packages/artifacts/blueprint/package.json`
- Modify: `packages/artifacts/blueprint/src/types/result.ts`
- Modify: `packages/artifacts/blueprint/src/types/artifact.ts`
- Create: `packages/artifacts/blueprint/src/compose/project-init.ts`
- Modify: `packages/artifacts/blueprint/src/compose/load-composed-blueprint.ts`
- Modify: `packages/artifacts/blueprint/src/index.ts`
- Test: `packages/artifacts/blueprint/test/unit/project-init.test.ts`
- Test: `packages/artifacts/blueprint/test/unit/load-composed-blueprint.test.ts`

- [ ] **Step 1: Write blueprint init loader tests**

Create `packages/artifacts/blueprint/test/unit/project-init.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { createPdmResolver, deriveEventTypes, validatePdm } from '@rntme/pdm';
import { loadProjectInit } from '../../src/compose/project-init.js';

function writeJson(root: string, rel: string, value: unknown): void {
  const path = join(root, rel);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2));
}

function writeText(root: string, rel: string, value: string): void {
  const path = join(root, rel);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, value);
}

function pdm() {
  const result = validatePdm({
    entities: {
      Note: {
        ownerService: 'app',
        kind: 'root',
        table: 'notes',
        fields: {
          id: { type: 'string', nullable: false, column: 'id' },
          status: { type: 'string', nullable: false, column: 'status' },
          body: { type: 'string', nullable: false, column: 'body' },
        },
        keys: ['id'],
        stateMachine: {
          stateField: 'status',
          initial: null,
          states: ['active'],
          transitions: {
            create: { from: null, to: 'active', affects: ['body'] },
          },
        },
      },
    },
  });
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.value;
}

function writeValidInit(root: string): void {
  writeText(root, 'init/project-initialized.bpmn', '<definitions />');
  writeJson(root, 'init/files/notes.seed.json', {
    seedVersion: 1,
    events: [
      {
        id: 'seed:Note:welcome:v1',
        subject: 'Note-welcome',
        rntAggregateType: 'Note',
        rntAggregateId: 'welcome',
        rntVersion: 1,
        eventType: 'NoteCreate',
        data: { body: 'Welcome' },
        time: '2026-05-08T00:00:00.000Z',
      },
    ],
  });
  writeJson(root, 'init/init.json', {
    initVersion: 1,
    process: { kind: 'bpmn', definition: 'project-initialized.bpmn', processId: 'ProjectInitialized' },
    steps: [
      {
        id: 'notes.welcome',
        type: 'init',
        provider: 'seed-events',
        targetService: 'app',
        mode: 'lifecycle',
        input: { path: 'files/notes.seed.json' },
        dependsOn: [],
      },
    ],
  });
}

describe('loadProjectInit', () => {
  it('returns null when init/init.json is absent', () => {
    const root = mkdtempSync(join(tmpdir(), 'rntme-blueprint-'));
    const model = pdm();
    const result = loadProjectInit({
      rootDir: root,
      services: ['app'],
      pdm: createPdmResolver(model),
      eventsByService: { app: deriveEventTypes(model) },
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBeNull();
  });

  it('loads a valid project init artifact', () => {
    const root = mkdtempSync(join(tmpdir(), 'rntme-blueprint-'));
    writeValidInit(root);
    const model = pdm();
    const result = loadProjectInit({
      rootDir: root,
      services: ['app'],
      pdm: createPdmResolver(model),
      eventsByService: { app: deriveEventTypes(model) },
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value?.steps[0]?.id).toBe('notes.welcome');
  });

  it('wraps init validation failures as BLUEPRINT_INIT_INVALID', () => {
    const root = mkdtempSync(join(tmpdir(), 'rntme-blueprint-'));
    writeValidInit(root);
    writeJson(root, 'init/init.json', {
      initVersion: 1,
      process: { kind: 'bpmn', definition: '../bad.bpmn', processId: 'ProjectInitialized' },
      steps: [],
    });
    const model = pdm();
    const result = loadProjectInit({
      rootDir: root,
      services: ['app'],
      pdm: createPdmResolver(model),
      eventsByService: { app: deriveEventTypes(model) },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]?.code).toBe('BLUEPRINT_INIT_INVALID');
  });
});
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
pnpm -F @rntme/blueprint test -- test/unit/project-init.test.ts
```

Expected: FAIL because `project-init.ts` and `BLUEPRINT_INIT_INVALID` do not exist.

- [ ] **Step 3: Add blueprint dependency and types**

In `packages/artifacts/blueprint/package.json`, add:

```json
"@rntme/init": "workspace:*"
```

to `dependencies`.

In `packages/artifacts/blueprint/src/types/result.ts`, add:

```ts
BLUEPRINT_INIT_INVALID: 'BLUEPRINT_INIT_INVALID',
```

near `BLUEPRINT_WORKFLOWS_INVALID`.

In `packages/artifacts/blueprint/src/types/artifact.ts`, import:

```ts
import type { ValidatedInitArtifact } from '@rntme/init';
```

and add to `ComposedBlueprint`:

```ts
init?: ValidatedInitArtifact | null;
```

- [ ] **Step 4: Implement project init loader**

Create `packages/artifacts/blueprint/src/compose/project-init.ts`:

```ts
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { EventTypeSpec, PdmResolver } from '@rntme/pdm';
import {
  parseInitArtifact,
  validateInitCrossRef,
  validateInitStructural,
  type ValidatedInitArtifact,
} from '@rntme/init';
import { ERROR_CODES, err, ok, type Result } from '../types/result.js';

export function loadProjectInit(input: {
  readonly rootDir: string;
  readonly services: readonly string[];
  readonly pdm: PdmResolver;
  readonly eventsByService: Readonly<Record<string, readonly EventTypeSpec[]>>;
}): Result<ValidatedInitArtifact | null> {
  const relPath = 'init/init.json';
  const absPath = join(input.rootDir, relPath);
  if (!existsSync(absPath)) return ok(null);

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(absPath, 'utf8'));
  } catch (cause) {
    return initErr(relPath, [cause instanceof Error ? cause.message : String(cause)]);
  }

  const parsed = parseInitArtifact(raw);
  if (!parsed.ok) return initErr(relPath, parsed.errors);

  const structural = validateInitStructural(parsed.value);
  if (!structural.ok) return initErr(relPath, structural.errors);

  const validated = validateInitCrossRef(structural.value, {
    services: input.services,
    pdm: input.pdm,
    eventsByService: input.eventsByService,
    fileExists: (relativePath) => isRegularInitFile(input.rootDir, relativePath),
    readJson: (relativePath) => readInitJson(input.rootDir, relativePath),
  });
  if (!validated.ok) return initErr(relPath, validated.errors);

  return ok(validated.value);
}

function isRegularInitFile(rootDir: string, relativePath: string): boolean {
  try {
    return statSync(join(rootDir, 'init', relativePath)).isFile();
  } catch {
    return false;
  }
}

function readInitJson(rootDir: string, relativePath: string): unknown | null {
  try {
    return JSON.parse(readFileSync(join(rootDir, 'init', relativePath), 'utf8'));
  } catch {
    return null;
  }
}

function initErr<T>(path: string, cause: readonly unknown[]): Result<T> {
  return err([
    {
      layer: 'composition',
      code: ERROR_CODES.BLUEPRINT_INIT_INVALID,
      message: 'init artifact failed validation',
      path,
      cause: [...cause],
    },
  ]);
}
```

- [ ] **Step 5: Wire init into composed blueprint**

In `packages/artifacts/blueprint/src/compose/load-composed-blueprint.ts`, import:

```ts
import { loadProjectInit } from './project-init.js';
```

After `workflows` are loaded, build `eventsByService` and load init:

```ts
  const eventsByService = Object.fromEntries(
    Object.entries(validatedServices).map(([slug, service]) => [slug, service.eventTypes]),
  );
  const init = loadProjectInit({
    rootDir: dir,
    services: Object.keys(validatedServices),
    pdm: pdmResolver,
    eventsByService,
  });
  if (!init.ok) return init;
```

Then include in the returned object:

```ts
    init: init.value,
```

- [ ] **Step 6: Export the loader**

In `packages/artifacts/blueprint/src/index.ts`, add:

```ts
export { loadProjectInit } from './compose/project-init.js';
```

- [ ] **Step 7: Add composed blueprint test**

In `packages/artifacts/blueprint/test/unit/load-composed-blueprint.test.ts`,
add `mkdirSync` to the existing `node:fs` import:

```ts
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
```

Then add this test inside the existing `describe('loadComposedBlueprint', ...)` block:

```ts
  it('loads project-level init artifact during composition', async () => {
    const copied = copyFixture();
    mkdirSync(join(copied, 'init', 'files'), { recursive: true });
    writeFileSync(join(copied, 'init', 'project-initialized.bpmn'), '<definitions />');
    const seedText = readFileSync(
      join(copied, 'services', 'pricing', 'seed', 'seed.json'),
      'utf8',
    );
    writeFileSync(join(copied, 'init', 'files', 'pricing.seed.json'), seedText);
    writeFileSync(
      join(copied, 'init', 'init.json'),
      JSON.stringify(
        {
          initVersion: 1,
          process: {
            kind: 'bpmn',
            definition: 'project-initialized.bpmn',
            processId: 'ProjectInitialized',
          },
          steps: [
            {
              id: 'pricing.initial',
              type: 'init',
              provider: 'seed-events',
              targetService: 'pricing',
              mode: 'lifecycle',
              input: { path: 'files/pricing.seed.json' },
              dependsOn: [],
            },
          ],
        },
        null,
        2,
      ),
    );

    const r = await loadComposedBlueprint(copied);
    expect(r.ok, r.ok ? '' : JSON.stringify(r.errors)).toBe(true);
    if (!r.ok) return;
    expect(r.value.init?.steps[0]?.id).toBe('pricing.initial');
  });
```

- [ ] **Step 8: Run blueprint package tests**

Run:

```bash
pnpm -F @rntme/blueprint test -- test/unit/project-init.test.ts test/unit/load-composed-blueprint.test.ts
pnpm -F @rntme/blueprint typecheck
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add packages/artifacts/blueprint
git commit -m "feat(blueprint): load project init artifact"
```

---

### Task 6: Document Init Artifact Ownership

**Files:**
- Create: `docs/current/owners/packages/artifacts/init.md`
- Modify: `docs/current/owners/packages/artifacts/blueprint.md`
- Modify: `docs/superpowers/specs/2026-05-08-project-lifecycle-init-design.md` only if implementation decisions in this slice refined the spec.

- [ ] **Step 1: Create owner doc**

Create `docs/current/owners/packages/artifacts/init.md`:

````md
# @rntme/init

Project-level lifecycle init artifact parser and validator.

## Role in the system

- Depends on:
  - `@rntme/artifact-shared` for Result helpers and zod parse mapping.
  - `@rntme/pdm` for PDM resolver and derived event types supplied by blueprint.
  - `@rntme/seed` for `seed-events` validation in the first slice.
  - `zod` for structural parsing.
- Consumed by:
  - `@rntme/blueprint` during project composition.
- Position in pipeline:
  `init/init.json` + `init/files/**` -> parse -> structural validation -> cross-reference validation -> `ValidatedInitArtifact`.

## Artifact shape

`init/init.json` is project-level. It declares a project lifecycle BPMN process
and lifecycle init steps. The first supported provider is `seed-events`.

Example:

```json
{
  "initVersion": 1,
  "process": {
    "kind": "bpmn",
    "definition": "project-initialized.bpmn",
    "processId": "ProjectInitialized"
  },
  "steps": [
    {
      "id": "notes.welcome",
      "type": "init",
      "provider": "seed-events",
      "targetService": "app",
      "mode": "lifecycle",
      "input": { "path": "files/notes.seed.json" },
      "dependsOn": []
    }
  ]
}
```

## Public API

- `parseInitArtifact(raw)`
- `validateInitStructural(artifact)`
- `validateInitCrossRef(artifact, ctx)`
- `ERROR_CODES`, `ok`, `err`, `isOk`, `isErr`

## Invariants

- Paths are relative to `init/`.
- Absolute paths, parent traversal, backslashes, URI-scheme paths, and empty path segments are invalid.
- v1 supports only `provider: "seed-events"` and `mode: "lifecycle"`.
- `seed-events` validates against service-owned event types supplied by blueprint.
- This package validates authoring artifacts only. It does not publish events, run BPMN, or apply QSM.

## Where to look first

- `src/parse/schema.ts`
- `src/validate/structural.ts`
- `src/validate/cross-ref.ts`
- `test/unit/`

## Specs

- [`../../../superpowers/specs/2026-05-08-project-lifecycle-init-design.md`](/docs/superpowers/specs/2026-05-08-project-lifecycle-init-design.md)
````

- [ ] **Step 2: Update blueprint owner doc**

In `docs/current/owners/packages/artifacts/blueprint.md`:

- Add `@rntme/init` to the Depends on list.
- Add `init/init.json` + `init/files/**` to Directory conventions.
- Add a Public API bullet for `loadProjectInit(...)`.
- Update the `loadComposedBlueprint` bullet to mention project init validation.
- Add `src/compose/project-init.ts` to Where to look first.

- [ ] **Step 3: Run docs grep sanity**

Run:

```bash
rg -n "init/init\\.json|@rntme/init|project-init" docs/current/owners/packages/artifacts packages/artifacts/init/README.md AGENTS.md
```

Expected: matches in the new owner doc, blueprint owner doc, README, and AGENTS package lookup.

- [ ] **Step 4: Commit**

```bash
git add docs/current/owners/packages/artifacts/init.md docs/current/owners/packages/artifacts/blueprint.md packages/artifacts/init/README.md AGENTS.md
git commit -m "docs(init): document lifecycle init artifact"
```

---

### Task 7: Final Verification

**Files:**
- Verify only.

- [ ] **Step 1: Run focused package checks**

Run:

```bash
pnpm -F @rntme/init test
pnpm -F @rntme/init typecheck
pnpm -F @rntme/blueprint test -- test/unit/project-init.test.ts test/unit/load-composed-blueprint.test.ts
pnpm -F @rntme/blueprint typecheck
```

Expected: all commands pass.

- [ ] **Step 2: Run architecture check**

Run:

```bash
pnpm depcruise
```

Expected: PASS. If it fails because `@rntme/init` imports runtime packages, remove that import; `@rntme/init` must not import from `packages/runtime/**`.

- [ ] **Step 3: Run git status**

Run:

```bash
git status --short
```

Expected: only pre-existing unrelated user changes may remain. The known unrelated change before this plan was `docs/audit/README.md`.

- [ ] **Step 4: Stop if verification found failures**

If Step 1 or Step 2 failed, do not make a vague final commit. Return to the
task that introduced the failing package or architecture dependency, add the
missing focused test if needed, fix that task, and rerun Task 7 from Step 1.
