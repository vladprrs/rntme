> Status: historical.
> Date: 2026-04-23.
> Current source: docs/current/**, docs/decision-system.md, and current code/tests.
> Why retained: Historical rationale and execution context retained for review; it is not current-state truth by itself.

# Track A — Project-First Blueprint Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the Track A blueprint model foundation: a project-level blueprint directory parser/validator, project-level multi-file `PDM`, multi-file service-level `QSM`, service kinds, and the `mod-*` integration naming rule.

**Architecture:** Introduce a new package `@rntme/blueprint` as the project-assembly parser/validator. Extend `@rntme/pdm` and `@rntme/qsm` with directory-backed loaders while keeping their existing in-memory artifact shapes and `Result<T>` pipelines. Track A stops before runtime boot and before cross-service `QSM` semantic validation; it only establishes the artifact model and filesystem loading contract.

**Tech Stack:** TypeScript 5, Node 20 filesystem APIs, Zod 4, Vitest 2, existing `Result<T>` / branded `Validated*` patterns across `@rntme/*`.

---

## Scope guard

- **In scope:** `project.json`, project/service directory discovery, service kinds, `mod-*` naming rule, project-level `PDM` (`entity-per-file`), multi-file `QSM` loader, new `@rntme/blueprint` package, docs/package map updates.
- **Out of scope in this plan:** project runtime boot, middleware execution, route-to-service semantic checks beyond parse/structural shape, service bindings/graphs/UI compilation, `QSM` validation against foreign-service event sources. Those belong to Track B / Track C.
- **Do not modify `packages/runtime/src/*` in Track A.** Runtime integration is deferred.

## File map

```
packages/blueprint/
  package.json
  tsconfig.json
  tsconfig.check.json
  README.md
  src/
    index.ts
    load/
      read-dir.ts
      load-blueprint.ts
    parse/
      parse.ts
      schema.ts
    validate/
      index.ts
      structural.ts
    types/
      artifact.ts
      result.ts
  test/
    fixtures/
      product-catalog-project/
        project.json
        pdm/
          pdm.json
          entities/
            Product.json
            Publication.json
            PriceEntry.json
            InventoryPosition.json
        services/
          catalog/service.json
          catalog/qsm/qsm.json
          catalog/qsm/projections/ProductCard.json
          pricing/service.json
          inventory/service.json
          app/service.json
          mod-workos/service.json
    smoke.test.ts
    unit/
      parse.test.ts
      validate-structural.test.ts
      load-blueprint.test.ts

packages/pdm/
  src/
    index.ts
    load/
      load-dir.ts
    parse/
      schema.ts
    types/
      artifact.ts
      result.ts
    validate/
      state-machine.ts
  test/
    fixtures/
      project-pdm/
        pdm.json
        entities/
          Product.json
          Publication.json
    unit/
      project-entity.test.ts
      load-dir.test.ts

packages/qsm/
  src/
    index.ts
    load/
      load-dir.ts
    types/
      result.ts
  test/
    fixtures/
      multi-file-qsm/
        qsm.json
        projections/
          ProductCard.json
    unit/
      load-dir.test.ts

README.md
AGENTS.md
packages/blueprint/README.md
```

`@rntme/blueprint` is the only new package in this track. It depends on `@rntme/pdm`, `@rntme/qsm`, and `zod`. `@rntme/runtime` is untouched.

---

### Task 1: Scaffold the `@rntme/blueprint` package

**Files:**
- Create: `packages/blueprint/package.json`
- Create: `packages/blueprint/tsconfig.json`
- Create: `packages/blueprint/tsconfig.check.json`
- Create: `packages/blueprint/README.md`
- Create: `packages/blueprint/src/index.ts`
- Create: `packages/blueprint/src/types/result.ts`
- Create: `packages/blueprint/src/load/load-blueprint.ts`
- Test: `packages/blueprint/test/smoke.test.ts`

- [ ] **Step 1: Write the failing smoke test**

  Create `packages/blueprint/test/smoke.test.ts`:

  ```ts
  import { describe, expect, it } from 'vitest';
  import { mkdtempSync } from 'node:fs';
  import { tmpdir } from 'node:os';
  import { join } from 'node:path';
  import { loadBlueprint } from '../src/load/load-blueprint.js';

  describe('loadBlueprint (scaffold)', () => {
    it('returns BLUEPRINT_IO_ERROR when project.json is missing', () => {
      const dir = mkdtempSync(join(tmpdir(), 'rntme-blueprint-'));
      const r = loadBlueprint(dir);

      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.errors[0]?.code).toBe('BLUEPRINT_IO_ERROR');
      }
    });
  });
  ```

- [ ] **Step 2: Run test to verify it fails**

  Run:

  ```bash
  pnpm -F @rntme/blueprint test -- test/smoke.test.ts
  ```

  Expected: FAIL because `@rntme/blueprint` does not exist yet.

- [ ] **Step 3: Write the minimal package scaffold**

  Create `packages/blueprint/package.json`:

  ```json
  {
    "name": "@rntme/blueprint",
    "version": "0.0.0",
    "type": "module",
    "private": true,
    "description": "Project-first blueprint folder parser/validator for rntme.",
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
      "@rntme/pdm": "workspace:*",
      "@rntme/qsm": "workspace:*",
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

  Create `packages/blueprint/tsconfig.json`:

  ```json
  {
    "extends": "../../tsconfig.base.json",
    "compilerOptions": {
      "rootDir": "src",
      "outDir": "dist",
      "composite": false
    },
    "include": ["src/**/*.ts"],
    "exclude": ["dist", "node_modules", "test"]
  }
  ```

  Create `packages/blueprint/tsconfig.check.json`:

  ```json
  {
    "extends": "./tsconfig.json",
    "compilerOptions": {
      "rootDir": ".",
      "noEmit": true,
      "composite": false,
      "module": "ESNext",
      "moduleResolution": "Bundler"
    },
    "include": ["src/**/*.ts", "test/**/*.ts"],
    "exclude": ["dist", "node_modules"]
  }
  ```

  Create `packages/blueprint/src/types/result.ts`:

  ```ts
  export type BlueprintErrorCode = 'BLUEPRINT_IO_ERROR';

  export type BlueprintError = Readonly<{
    layer: 'load';
    code: BlueprintErrorCode;
    message: string;
    path?: string;
  }>;

  export type Result<T> =
    | { ok: true; value: T }
    | { ok: false; errors: BlueprintError[] };

  export function ok<T>(value: T): Result<T> {
    return { ok: true, value };
  }

  export function err<T = never>(errors: BlueprintError[]): Result<T> {
    return { ok: false, errors };
  }
  ```

  Create `packages/blueprint/src/load/load-blueprint.ts`:

  ```ts
  import { existsSync } from 'node:fs';
  import { join } from 'node:path';
  import { err, type Result } from '../types/result.js';

  export function loadBlueprint(dir: string): Result<{ dir: string }> {
    const projectPath = join(dir, 'project.json');
    if (!existsSync(projectPath)) {
      return err([
        {
          layer: 'load',
          code: 'BLUEPRINT_IO_ERROR',
          message: 'missing required file: project.json',
          path: 'project.json',
        },
      ]);
    }
    return { ok: true, value: { dir } };
  }
  ```

  Create `packages/blueprint/src/index.ts`:

  ```ts
  export { loadBlueprint } from './load/load-blueprint.js';
  export type { BlueprintError, BlueprintErrorCode, Result } from './types/result.js';
  export { ok, err } from './types/result.js';
  ```

  Create `packages/blueprint/README.md`:

  ```md
  # @rntme/blueprint

  Project-first blueprint parser/validator. Track A owns directory layout, `project.json`, service registry metadata, and loading of project `PDM` plus raw service `QSM` directories.
  ```

- [ ] **Step 4: Run test to verify it passes**

  Run:

  ```bash
  pnpm -F @rntme/blueprint test -- test/smoke.test.ts
  pnpm -F @rntme/blueprint typecheck
  ```

  Expected: PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add packages/blueprint
  git commit -m "feat(blueprint): scaffold project blueprint package"
  ```

---

### Task 2: Extend `@rntme/pdm` for project-level entity ownership

**Files:**
- Modify: `packages/pdm/src/types/artifact.ts`
- Modify: `packages/pdm/src/parse/schema.ts`
- Modify: `packages/pdm/src/types/result.ts`
- Modify: `packages/pdm/src/validate/state-machine.ts`
- Test: `packages/pdm/test/unit/project-entity.test.ts`

- [ ] **Step 1: Write the failing tests**

  Create `packages/pdm/test/unit/project-entity.test.ts`:

  ```ts
  import { describe, expect, it } from 'vitest';
  import { parsePdm } from '../../src/parse/parse.js';
  import { validatePdm } from '../../src/validate/index.js';

  const VALID_ROOT = {
    entities: {
      Product: {
        ownerService: 'catalog',
        kind: 'root',
        table: 'products',
        fields: {
          productId: { type: 'integer', nullable: false, column: 'product_id' },
        },
        keys: ['productId'],
      },
    },
  };

  describe('project-level entity metadata', () => {
    it('parses ownerService and kind', () => {
      const r = parsePdm(VALID_ROOT);
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.value.entities.Product?.ownerService).toBe('catalog');
        expect(r.value.entities.Product?.kind).toBe('root');
      }
    });

    it('rejects root entity with stateMachine', () => {
      const parsed = parsePdm({
        entities: {
          Product: {
            ownerService: 'catalog',
            kind: 'root',
            table: 'products',
            fields: {
              productId: { type: 'integer', nullable: false, column: 'product_id' },
              status: { type: 'string', nullable: false, column: 'status' },
            },
            keys: ['productId'],
            stateMachine: {
              stateField: 'status',
              initial: null,
              states: ['draft'],
              transitions: {
                create: { from: null, to: 'draft', affects: [] },
              },
            },
          },
        },
      });
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) return;

      const validated = validatePdm(parsed.value);
      expect(validated.ok).toBe(false);
      if (!validated.ok) {
        expect(validated.errors.some((e) => e.code === 'PDM_SM_ROOT_STATE_MACHINE_FORBIDDEN')).toBe(true);
      }
    });
  });
  ```

- [ ] **Step 2: Run test to verify it fails**

  Run:

  ```bash
  pnpm -F @rntme/pdm test -- test/unit/project-entity.test.ts
  ```

  Expected: FAIL because `ownerService` / `kind` are not part of the schema yet and the new error code does not exist.

- [ ] **Step 3: Write the minimal implementation**

  In `packages/pdm/src/types/artifact.ts`, update the entity types:

  ```ts
  export type EntityKind = 'root' | 'owned';

  export type Entity = {
    ownerService: string;
    kind: EntityKind;
    table: string;
    fields: Readonly<Record<string, Field>>;
    relations?: Readonly<Record<string, Relation>>;
    keys: readonly string[];
    stateMachine?: StateMachine;
  };
  ```

  In `packages/pdm/src/parse/schema.ts`, add the new required fields:

  ```ts
  const entitySchema = z
    .object({
      ownerService: nonEmptyString,
      kind: z.enum(['root', 'owned']),
      table: nonEmptyString,
      fields: z.record(nonEmptyString, fieldSchema),
      relations: z.record(nonEmptyString, relationSchema).optional(),
      keys: z.array(nonEmptyString).min(1),
      stateMachine: stateMachineSchema.optional(),
    })
    .strict();
  ```

  In `packages/pdm/src/types/result.ts`, append the new code:

  ```ts
  export const ERROR_CODES = {
    // existing codes...
    PDM_SM_ROOT_STATE_MACHINE_FORBIDDEN: 'PDM_SM_ROOT_STATE_MACHINE_FORBIDDEN',
  } as const;
  ```

  In `packages/pdm/src/validate/state-machine.ts`, reject `root` entities with lifecycle:

  ```ts
  for (const [entityName, entity] of Object.entries(artifact.entities)) {
    if (entity.kind === 'root' && entity.stateMachine) {
      errors.push({
        layer: 'state-machine',
        code: ERROR_CODES.PDM_SM_ROOT_STATE_MACHINE_FORBIDDEN,
        message: `root entity "${entityName}" cannot declare stateMachine`,
        path: `entities.${entityName}.stateMachine`,
      });
      continue;
    }
    if (!entity.stateMachine) continue;
    // existing validation continues here
  }
  ```

- [ ] **Step 4: Run tests to verify they pass**

  Run:

  ```bash
  pnpm -F @rntme/pdm test -- test/unit/project-entity.test.ts
  pnpm -F @rntme/pdm test -- test/unit/parse.test.ts test/unit/validate-state-machine.test.ts
  ```

  Expected: PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add packages/pdm/src packages/pdm/test/unit/project-entity.test.ts
  git commit -m "feat(pdm): add project entity ownership metadata"
  ```

---

### Task 3: Add directory-backed loading for project-level `PDM`

**Files:**
- Create: `packages/pdm/src/load/load-dir.ts`
- Modify: `packages/pdm/src/index.ts`
- Modify: `packages/pdm/src/types/result.ts`
- Create: `packages/pdm/test/fixtures/project-pdm/pdm.json`
- Create: `packages/pdm/test/fixtures/project-pdm/entities/Product.json`
- Create: `packages/pdm/test/fixtures/project-pdm/entities/Publication.json`
- Test: `packages/pdm/test/unit/load-dir.test.ts`

- [ ] **Step 1: Write the failing tests**

  Create `packages/pdm/test/unit/load-dir.test.ts`:

  ```ts
  import { describe, expect, it } from 'vitest';
  import { dirname, join } from 'node:path';
  import { fileURLToPath } from 'node:url';
  import { loadPdmDir } from '../../src/load/load-dir.js';

  const here = dirname(fileURLToPath(import.meta.url));
  const fixtureDir = join(here, '..', 'fixtures', 'project-pdm');

  describe('loadPdmDir', () => {
    it('assembles entity-per-file PDM directory into one artifact', () => {
      const r = loadPdmDir(fixtureDir);
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(Object.keys(r.value.entities)).toEqual(['Product', 'Publication']);
      }
    });

    it('returns parse-dir error when pdm.json is missing', () => {
      const r = loadPdmDir(join(fixtureDir, 'entities'));
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.errors[0]?.code).toBe('PDM_PARSE_DIR_INVALID');
      }
    });
  });
  ```

- [ ] **Step 2: Run test to verify it fails**

  Run:

  ```bash
  pnpm -F @rntme/pdm test -- test/unit/load-dir.test.ts
  ```

  Expected: FAIL because `loadPdmDir` and `PDM_PARSE_DIR_INVALID` do not exist.

- [ ] **Step 3: Write the minimal implementation**

  Create `packages/pdm/src/load/load-dir.ts`:

  ```ts
  import { existsSync, readdirSync, readFileSync } from 'node:fs';
  import { join, basename } from 'node:path';
  import { z } from 'zod';
  import { parsePdm } from '../parse/parse.js';
  import { err, type Result } from '../types/result.js';
  import type { PdmArtifact } from '../types/artifact.js';

  const PdmDirectoryIndexSchema = z
    .object({
      version: z.string().optional(),
    })
    .strict();

  export function loadPdmDir(dir: string): Result<PdmArtifact> {
    try {
      const indexPath = join(dir, 'pdm.json');
      const entitiesDir = join(dir, 'entities');

      if (!existsSync(indexPath)) {
        return err([
          {
            layer: 'parse',
            code: 'PDM_PARSE_DIR_INVALID',
            message: 'missing required file: pdm.json',
            path: 'pdm.json',
          },
        ]);
      }

      if (!existsSync(entitiesDir)) {
        return err([
          {
            layer: 'parse',
            code: 'PDM_PARSE_DIR_INVALID',
            message: 'missing required directory: entities',
            path: 'entities',
          },
        ]);
      }

      PdmDirectoryIndexSchema.parse(JSON.parse(readFileSync(indexPath, 'utf8')));

      const entities: Record<string, unknown> = {};
      for (const fname of readdirSync(entitiesDir)) {
        if (!fname.endsWith('.json')) continue;
        const entityName = basename(fname, '.json');
        entities[entityName] = JSON.parse(readFileSync(join(entitiesDir, fname), 'utf8'));
      }

      return parsePdm({ entities });
    } catch (error) {
      return err([
        {
          layer: 'parse',
          code: 'PDM_PARSE_DIR_INVALID',
          message: error instanceof Error ? error.message : String(error),
          path: dir,
        },
      ]);
    }
  }
  ```

  In `packages/pdm/src/types/result.ts`, append:

  ```ts
  export const ERROR_CODES = {
    // existing codes...
    PDM_PARSE_DIR_INVALID: 'PDM_PARSE_DIR_INVALID',
  } as const;
  ```

  In `packages/pdm/src/index.ts`, export the loader:

  ```ts
  export { loadPdmDir } from './load/load-dir.js';
  ```

  Create fixture files:

  `packages/pdm/test/fixtures/project-pdm/pdm.json`

  ```json
  {
    "version": "1"
  }
  ```

  `packages/pdm/test/fixtures/project-pdm/entities/Product.json`

  ```json
  {
    "ownerService": "catalog",
    "kind": "root",
    "table": "products",
    "fields": {
      "productId": { "type": "integer", "nullable": false, "column": "product_id" }
    },
    "keys": ["productId"]
  }
  ```

  `packages/pdm/test/fixtures/project-pdm/entities/Publication.json`

  ```json
  {
    "ownerService": "catalog",
    "kind": "owned",
    "table": "publications",
    "fields": {
      "id": { "type": "integer", "nullable": false, "column": "id" },
      "productId": { "type": "integer", "nullable": false, "column": "product_id" },
      "status": { "type": "string", "nullable": false, "column": "status" }
    },
    "keys": ["id"]
  }
  ```

- [ ] **Step 4: Run tests to verify they pass**

  Run:

  ```bash
  pnpm -F @rntme/pdm test -- test/unit/load-dir.test.ts
  pnpm -F @rntme/pdm typecheck
  ```

  Expected: PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add packages/pdm/src packages/pdm/test/fixtures/project-pdm packages/pdm/test/unit/load-dir.test.ts
  git commit -m "feat(pdm): add entity-per-file directory loader"
  ```

---

### Task 4: Add directory-backed loading for multi-file `QSM`

**Files:**
- Create: `packages/qsm/src/load/load-dir.ts`
- Modify: `packages/qsm/src/index.ts`
- Modify: `packages/qsm/src/types/result.ts`
- Create: `packages/qsm/test/fixtures/multi-file-qsm/qsm.json`
- Create: `packages/qsm/test/fixtures/multi-file-qsm/projections/ProductCard.json`
- Test: `packages/qsm/test/unit/load-dir.test.ts`

- [ ] **Step 1: Write the failing tests**

  Create `packages/qsm/test/unit/load-dir.test.ts`:

  ```ts
  import { describe, expect, it } from 'vitest';
  import { dirname, join } from 'node:path';
  import { fileURLToPath } from 'node:url';
  import { loadQsmDir } from '../../src/load/load-dir.js';

  const here = dirname(fileURLToPath(import.meta.url));
  const fixtureDir = join(here, '..', 'fixtures', 'multi-file-qsm');

  describe('loadQsmDir', () => {
    it('assembles projection-per-file qsm directory into one artifact', () => {
      const r = loadQsmDir(fixtureDir);
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(Object.keys(r.value.projections)).toEqual(['ProductCard']);
      }
    });

    it('returns parse-dir error when qsm.json is missing', () => {
      const r = loadQsmDir(join(fixtureDir, 'projections'));
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.errors[0]?.code).toBe('QSM_PARSE_DIR_INVALID');
      }
    });
  });
  ```

- [ ] **Step 2: Run test to verify it fails**

  Run:

  ```bash
  pnpm -F @rntme/qsm test -- test/unit/load-dir.test.ts
  ```

  Expected: FAIL because `loadQsmDir` and `QSM_PARSE_DIR_INVALID` do not exist.

- [ ] **Step 3: Write the minimal implementation**

  Create `packages/qsm/src/load/load-dir.ts`:

  ```ts
  import { existsSync, readdirSync, readFileSync } from 'node:fs';
  import { join, basename } from 'node:path';
  import { z } from 'zod';
  import { parseQsm } from '../parse/parse.js';
  import { err, type Result } from '../types/result.js';
  import type { QsmArtifact } from '../types/artifact.js';

  const QsmDirectoryIndexSchema = z
    .object({
      version: z.string().optional(),
      relations: z.record(z.string(), z.unknown()).default({}),
    })
    .strict();

  export function loadQsmDir(dir: string): Result<QsmArtifact> {
    try {
      const indexPath = join(dir, 'qsm.json');
      const projectionsDir = join(dir, 'projections');

      if (!existsSync(indexPath)) {
        return err([
          {
            layer: 'parse',
            code: 'QSM_PARSE_DIR_INVALID',
            message: 'missing required file: qsm.json',
            path: 'qsm.json',
          },
        ]);
      }

      if (!existsSync(projectionsDir)) {
        return err([
          {
            layer: 'parse',
            code: 'QSM_PARSE_DIR_INVALID',
            message: 'missing required directory: projections',
            path: 'projections',
          },
        ]);
      }

      const index = QsmDirectoryIndexSchema.parse(JSON.parse(readFileSync(indexPath, 'utf8')));
      const projections: Record<string, unknown> = {};

      for (const fname of readdirSync(projectionsDir)) {
        if (!fname.endsWith('.json')) continue;
        const projectionName = basename(fname, '.json');
        projections[projectionName] = JSON.parse(readFileSync(join(projectionsDir, fname), 'utf8'));
      }

      return parseQsm({
        projections,
        relations: index.relations,
      });
    } catch (error) {
      return err([
        {
          layer: 'parse',
          code: 'QSM_PARSE_DIR_INVALID',
          message: error instanceof Error ? error.message : String(error),
          path: dir,
        },
      ]);
    }
  }
  ```

  In `packages/qsm/src/types/result.ts`, append:

  ```ts
  export const ERROR_CODES = {
    // existing codes...
    QSM_PARSE_DIR_INVALID: 'QSM_PARSE_DIR_INVALID',
  } as const;
  ```

  In `packages/qsm/src/index.ts`, export the loader:

  ```ts
  export { loadQsmDir } from './load/load-dir.js';
  ```

  Create fixture files:

  `packages/qsm/test/fixtures/multi-file-qsm/qsm.json`

  ```json
  {
    "version": "1",
    "relations": {}
  }
  ```

  `packages/qsm/test/fixtures/multi-file-qsm/projections/ProductCard.json`

  ```json
  {
    "backing": "entity-mirror",
    "source": { "entity": "Product" },
    "keys": ["productId"],
    "grain": ["productId"],
    "exposed": ["productId"],
    "table": "projection_product_card"
  }
  ```

- [ ] **Step 4: Run tests to verify they pass**

  Run:

  ```bash
  pnpm -F @rntme/qsm test -- test/unit/load-dir.test.ts
  pnpm -F @rntme/qsm typecheck
  ```

  Expected: PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add packages/qsm/src packages/qsm/test/fixtures/multi-file-qsm packages/qsm/test/unit/load-dir.test.ts
  git commit -m "feat(qsm): add projection-per-file directory loader"
  ```

---

### Task 5: Implement `@rntme/blueprint` parse, structural validation, and directory loading

**Files:**
- Create: `packages/blueprint/src/types/artifact.ts`
- Modify: `packages/blueprint/src/types/result.ts`
- Create: `packages/blueprint/src/parse/schema.ts`
- Create: `packages/blueprint/src/parse/parse.ts`
- Create: `packages/blueprint/src/validate/structural.ts`
- Create: `packages/blueprint/src/validate/index.ts`
- Create: `packages/blueprint/src/load/read-dir.ts`
- Modify: `packages/blueprint/src/load/load-blueprint.ts`
- Modify: `packages/blueprint/src/index.ts`
- Test: `packages/blueprint/test/unit/parse.test.ts`
- Test: `packages/blueprint/test/unit/validate-structural.test.ts`
- Test: `packages/blueprint/test/unit/load-blueprint.test.ts`

- [ ] **Step 1: Write the failing tests**

  Create `packages/blueprint/test/unit/parse.test.ts`:

  ```ts
  import { describe, expect, it } from 'vitest';
  import { parseProjectBlueprint } from '../../src/parse/parse.js';

  describe('parseProjectBlueprint', () => {
    it('parses minimal project.json shape', () => {
      const r = parseProjectBlueprint({
        name: 'commerce-catalog',
        services: ['catalog', 'app', 'mod-workos'],
      });
      expect(r.ok).toBe(true);
    });
  });
  ```

  Create `packages/blueprint/test/unit/validate-structural.test.ts`:

  ```ts
  import { describe, expect, it } from 'vitest';
  import { validateBlueprintStructural } from '../../src/validate/structural.js';

  describe('validateBlueprintStructural', () => {
    it('rejects mod-* slug with domain kind', () => {
      const r = validateBlueprintStructural({
        project: { name: 'commerce', services: ['mod-workos'] },
        serviceDirs: ['mod-workos'],
        services: {
          'mod-workos': { slug: 'mod-workos', kind: 'domain' },
        },
      });

      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.errors.some((e) => e.code === 'BLUEPRINT_STRUCT_MOD_KIND_MISMATCH')).toBe(true);
      }
    });
  });
  ```

  Create `packages/blueprint/test/unit/load-blueprint.test.ts`:

  ```ts
  import { describe, expect, it } from 'vitest';
  import { dirname, join } from 'node:path';
  import { fileURLToPath } from 'node:url';
  import { loadBlueprint } from '../../src/load/load-blueprint.js';

  const here = dirname(fileURLToPath(import.meta.url));
  const fixtureDir = join(here, '..', 'fixtures', 'product-catalog-project');

  describe('loadBlueprint', () => {
    it('loads project.json + project pdm + service descriptors', () => {
      const r = loadBlueprint(fixtureDir);
      expect(r.ok).toBe(true);
      if (!r.ok) return;

      expect(r.value.project.name).toBe('product-catalog');
      expect(r.value.pdm.entities.Product?.kind).toBe('root');
      expect(r.value.services['mod-workos']?.kind).toBe('integration');
      expect(r.value.services.catalog?.qsm).not.toBeNull();
    });
  });
  ```

- [ ] **Step 2: Run tests to verify they fail**

  Run:

  ```bash
  pnpm -F @rntme/blueprint test -- test/unit/parse.test.ts test/unit/validate-structural.test.ts test/unit/load-blueprint.test.ts
  ```

  Expected: FAIL because the parser, validator, error codes, and full loader do not exist yet.

- [ ] **Step 3: Write the minimal implementation**

  Create `packages/blueprint/src/types/artifact.ts`:

  ```ts
  import type { ValidatedPdm } from '@rntme/pdm';
  import type { QsmArtifact } from '@rntme/qsm';

  export type ServiceKind = 'domain' | 'integration';

  export type ProjectRouteMap = {
    ui?: Readonly<Record<string, string>>;
    http?: Readonly<Record<string, string>>;
  };

  export type MiddlewareDecl = {
    kind: string;
    provider?: string;
    policy?: string;
  };

  export type MountDecl = {
    target: string;
    use: readonly string[];
  };

  export type ProjectBlueprint = {
    name: string;
    services: readonly string[];
    routes?: ProjectRouteMap;
    middleware?: Readonly<Record<string, MiddlewareDecl>>;
    mounts?: readonly MountDecl[];
  };

  export type ServiceDescriptor = {
    slug: string;
    kind: ServiceKind;
  };

  export type LoadedBlueprint = {
    project: ProjectBlueprint;
    pdm: ValidatedPdm;
    services: Record<string, ServiceDescriptor & { qsm: QsmArtifact | null }>;
  };

  declare const BlueprintValidatedBrand: unique symbol;
  export type ValidatedBlueprint = LoadedBlueprint & {
    readonly [BlueprintValidatedBrand]: true;
  };
  ```

  Replace `packages/blueprint/src/types/result.ts` with:

  ```ts
  export const ERROR_CODES = {
    BLUEPRINT_IO_ERROR: 'BLUEPRINT_IO_ERROR',
    BLUEPRINT_PARSE_SCHEMA_VIOLATION: 'BLUEPRINT_PARSE_SCHEMA_VIOLATION',
    BLUEPRINT_STRUCT_DECLARED_SERVICE_DIR_MISSING: 'BLUEPRINT_STRUCT_DECLARED_SERVICE_DIR_MISSING',
    BLUEPRINT_STRUCT_UNDECLARED_SERVICE_DIR: 'BLUEPRINT_STRUCT_UNDECLARED_SERVICE_DIR',
    BLUEPRINT_STRUCT_SERVICE_JSON_MISSING: 'BLUEPRINT_STRUCT_SERVICE_JSON_MISSING',
    BLUEPRINT_STRUCT_MOD_KIND_MISMATCH: 'BLUEPRINT_STRUCT_MOD_KIND_MISMATCH',
  } as const;

  export type BlueprintErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

  export type BlueprintError = Readonly<{
    layer: 'load' | 'parse' | 'structural';
    code: BlueprintErrorCode;
    message: string;
    path?: string;
    cause?: unknown[];
  }>;

  export type Result<T> =
    | { ok: true; value: T }
    | { ok: false; errors: BlueprintError[] };

  export function ok<T>(value: T): Result<T> {
    return { ok: true, value };
  }

  export function err<T = never>(errors: BlueprintError[]): Result<T> {
    return { ok: false, errors };
  }
  ```

  Create `packages/blueprint/src/parse/schema.ts`:

  ```ts
  import { z } from 'zod';

  const nonEmptyString = z.string().min(1);
  const pathKey = z.string().startsWith('/');

  export const ServiceDescriptorSchema = z
    .object({
      kind: z.enum(['domain', 'integration']),
    })
    .strict();

  export const ProjectBlueprintSchema = z
    .object({
      name: nonEmptyString,
      services: z.array(nonEmptyString).min(1),
      routes: z
        .object({
          ui: z.record(pathKey, nonEmptyString).optional(),
          http: z.record(pathKey, nonEmptyString).optional(),
        })
        .strict()
        .optional(),
      middleware: z
        .record(
          nonEmptyString,
          z
            .object({
              kind: nonEmptyString,
              provider: nonEmptyString.optional(),
              policy: nonEmptyString.optional(),
            })
            .strict(),
        )
        .optional(),
      mounts: z
        .array(
          z
            .object({
              target: nonEmptyString,
              use: z.array(nonEmptyString),
            })
            .strict(),
        )
        .optional(),
    })
    .strict();
  ```

  Create `packages/blueprint/src/parse/parse.ts`:

  ```ts
  import { ProjectBlueprintSchema } from './schema.js';
  import { err, ok, ERROR_CODES, type Result } from '../types/result.js';
  import type { ProjectBlueprint } from '../types/artifact.js';

  export function parseProjectBlueprint(raw: unknown): Result<ProjectBlueprint> {
    const parsed = ProjectBlueprintSchema.safeParse(raw);
    if (!parsed.success) {
      return err(
        parsed.error.issues.map((issue) => ({
          layer: 'parse' as const,
          code: ERROR_CODES.BLUEPRINT_PARSE_SCHEMA_VIOLATION,
          message: issue.message,
          path: issue.path.join('.'),
        })),
      );
    }
    return ok(parsed.data);
  }
  ```

  Create `packages/blueprint/src/validate/structural.ts`:

  ```ts
  import { err, ok, ERROR_CODES, type Result } from '../types/result.js';
  import type { ProjectBlueprint, ServiceDescriptor } from '../types/artifact.js';

  export function validateBlueprintStructural(input: {
    project: ProjectBlueprint;
    serviceDirs: readonly string[];
    services: Record<string, ServiceDescriptor>;
  }): Result<void> {
    const errors = [];

    for (const slug of input.project.services) {
      if (!input.serviceDirs.includes(slug)) {
        errors.push({
          layer: 'structural' as const,
          code: ERROR_CODES.BLUEPRINT_STRUCT_DECLARED_SERVICE_DIR_MISSING,
          message: `declared service "${slug}" has no matching directory`,
          path: `project.services.${slug}`,
        });
      }
    }

    for (const slug of input.serviceDirs) {
      if (!input.project.services.includes(slug)) {
        errors.push({
          layer: 'structural' as const,
          code: ERROR_CODES.BLUEPRINT_STRUCT_UNDECLARED_SERVICE_DIR,
          message: `service directory "${slug}" is not declared in project.json`,
          path: `services/${slug}`,
        });
      }

      const service = input.services[slug];
      if (service === undefined) {
        errors.push({
          layer: 'structural' as const,
          code: ERROR_CODES.BLUEPRINT_STRUCT_SERVICE_JSON_MISSING,
          message: `service "${slug}" is missing service.json`,
          path: `services/${slug}/service.json`,
        });
        continue;
      }

      const isMod = slug.startsWith('mod-');
      if (isMod && service.kind !== 'integration') {
        errors.push({
          layer: 'structural' as const,
          code: ERROR_CODES.BLUEPRINT_STRUCT_MOD_KIND_MISMATCH,
          message: `service "${slug}" must use kind "integration"`,
          path: `services/${slug}/service.json.kind`,
        });
      }
      if (!isMod && service.kind === 'integration') {
        errors.push({
          layer: 'structural' as const,
          code: ERROR_CODES.BLUEPRINT_STRUCT_MOD_KIND_MISMATCH,
          message: `integration service "${slug}" must use slug prefix "mod-"`,
          path: `services/${slug}`,
        });
      }
    }

    if (errors.length > 0) return err(errors);
    return ok(undefined);
  }
  ```

  Create `packages/blueprint/src/validate/index.ts`:

  ```ts
  export { validateBlueprintStructural } from './structural.js';
  ```

  Create `packages/blueprint/src/load/read-dir.ts`:

  ```ts
  import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
  import { join } from 'node:path';

  export function readJsonFile<T = unknown>(dir: string, name: string): T {
    return JSON.parse(readFileSync(join(dir, name), 'utf8')) as T;
  }

  export function listServiceDirs(dir: string): string[] {
    const servicesDir = join(dir, 'services');
    if (!existsSync(servicesDir)) return [];
    return readdirSync(servicesDir).filter((name) => statSync(join(servicesDir, name)).isDirectory());
  }

  export function serviceDirPath(rootDir: string, slug: string): string {
    return join(rootDir, 'services', slug);
  }
  ```

  Replace `packages/blueprint/src/load/load-blueprint.ts` with:

  ```ts
  import { existsSync, readFileSync } from 'node:fs';
  import { join } from 'node:path';
  import { loadPdmDir, validatePdm } from '@rntme/pdm';
  import { loadQsmDir, type QsmArtifact } from '@rntme/qsm';
  import { parseProjectBlueprint } from '../parse/parse.js';
  import { validateBlueprintStructural } from '../validate/structural.js';
  import { err, ok, ERROR_CODES, type Result } from '../types/result.js';
  import type { LoadedBlueprint, ServiceDescriptor } from '../types/artifact.js';
  import { listServiceDirs, readJsonFile, serviceDirPath } from './read-dir.js';
  import { ServiceDescriptorSchema } from '../parse/schema.js';

  export function loadBlueprint(dir: string): Result<LoadedBlueprint> {
    try {
      const projectPath = join(dir, 'project.json');
      const pdmDir = join(dir, 'pdm');

      if (!existsSync(projectPath)) {
        return err([{ layer: 'load', code: ERROR_CODES.BLUEPRINT_IO_ERROR, message: 'missing required file: project.json', path: 'project.json' }]);
      }
      if (!existsSync(pdmDir)) {
        return err([{ layer: 'load', code: ERROR_CODES.BLUEPRINT_IO_ERROR, message: 'missing required directory: pdm', path: 'pdm' }]);
      }

      const parsedProject = parseProjectBlueprint(JSON.parse(readFileSync(projectPath, 'utf8')));
      if (!parsedProject.ok) return parsedProject;

      const rawPdm = loadPdmDir(pdmDir);
      if (!rawPdm.ok) {
        return err([{ layer: 'load', code: ERROR_CODES.BLUEPRINT_IO_ERROR, message: 'project pdm directory failed to load', path: 'pdm', cause: rawPdm.errors }]);
      }
      const validatedPdm = validatePdm(rawPdm.value);
      if (!validatedPdm.ok) {
        return err([{ layer: 'load', code: ERROR_CODES.BLUEPRINT_IO_ERROR, message: 'project pdm failed validation', path: 'pdm', cause: validatedPdm.errors }]);
      }

      const serviceDirs = listServiceDirs(dir);
      const services: Record<string, ServiceDescriptor & { qsm: QsmArtifact | null }> = {};

      for (const slug of serviceDirs) {
        const servicePath = serviceDirPath(dir, slug);
        if (!existsSync(join(servicePath, 'service.json'))) continue;

        const parsedDescriptor = ServiceDescriptorSchema.safeParse(readJsonFile(servicePath, 'service.json'));
        if (parsedDescriptor.success) {
          const qsmDir = join(servicePath, 'qsm');
          let qsm: QsmArtifact | null = null;
          if (existsSync(qsmDir)) {
            const loadedQsm = loadQsmDir(qsmDir);
            if (!loadedQsm.ok) {
              return err([{ layer: 'load', code: ERROR_CODES.BLUEPRINT_IO_ERROR, message: `service "${slug}" qsm directory failed to load`, path: `services/${slug}/qsm`, cause: loadedQsm.errors }]);
            }
            qsm = loadedQsm.value;
          }

          services[slug] = {
            slug,
            kind: parsedDescriptor.data.kind,
            qsm,
          };
        }
      }

      const structural = validateBlueprintStructural({
        project: parsedProject.value,
        serviceDirs,
        services,
      });
      if (!structural.ok) {
        return err(structural.errors);
      }

      return ok({
        project: parsedProject.value,
        pdm: validatedPdm.value,
        services,
      });
    } catch (error) {
      return err([
        {
          layer: 'load',
          code: ERROR_CODES.BLUEPRINT_IO_ERROR,
          message: error instanceof Error ? error.message : String(error),
          path: dir,
        },
      ]);
    }
  }
  ```

  Update `packages/blueprint/src/index.ts`:

  ```ts
  export { loadBlueprint } from './load/load-blueprint.js';
  export { parseProjectBlueprint } from './parse/parse.js';
  export { validateBlueprintStructural } from './validate/structural.js';
  export { ok, err, ERROR_CODES } from './types/result.js';
  export type {
    BlueprintError,
    BlueprintErrorCode,
    Result,
  } from './types/result.js';
  export type {
    LoadedBlueprint,
    ProjectBlueprint,
    ServiceDescriptor,
    ServiceKind,
    ValidatedBlueprint,
  } from './types/artifact.js';
  ```

- [ ] **Step 4: Run tests to verify they pass**

  Run:

  ```bash
  pnpm -F @rntme/blueprint test -- test/unit/parse.test.ts test/unit/validate-structural.test.ts test/unit/load-blueprint.test.ts
  pnpm -F @rntme/blueprint typecheck
  ```

  Expected: PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add packages/blueprint/src packages/blueprint/test/unit
  git commit -m "feat(blueprint): parse and validate project blueprint directories"
  ```

---

### Task 6: Add the canonical fixture, package README, and repo maps

**Files:**
- Create: `packages/blueprint/test/fixtures/product-catalog-project/project.json`
- Create: `packages/blueprint/test/fixtures/product-catalog-project/pdm/pdm.json`
- Create: `packages/blueprint/test/fixtures/product-catalog-project/pdm/entities/Product.json`
- Create: `packages/blueprint/test/fixtures/product-catalog-project/pdm/entities/Publication.json`
- Create: `packages/blueprint/test/fixtures/product-catalog-project/pdm/entities/PriceEntry.json`
- Create: `packages/blueprint/test/fixtures/product-catalog-project/pdm/entities/InventoryPosition.json`
- Create: `packages/blueprint/test/fixtures/product-catalog-project/services/catalog/service.json`
- Create: `packages/blueprint/test/fixtures/product-catalog-project/services/catalog/qsm/qsm.json`
- Create: `packages/blueprint/test/fixtures/product-catalog-project/services/catalog/qsm/projections/ProductCard.json`
- Create: `packages/blueprint/test/fixtures/product-catalog-project/services/pricing/service.json`
- Create: `packages/blueprint/test/fixtures/product-catalog-project/services/inventory/service.json`
- Create: `packages/blueprint/test/fixtures/product-catalog-project/services/app/service.json`
- Create: `packages/blueprint/test/fixtures/product-catalog-project/services/mod-workos/service.json`
- Modify: `packages/blueprint/README.md`
- Modify: `README.md`
- Modify: `AGENTS.md`
- Test: `packages/blueprint/test/smoke.test.ts`

- [ ] **Step 1: Write the failing smoke test**

  Replace `packages/blueprint/test/smoke.test.ts` with:

  ```ts
  import { describe, expect, it } from 'vitest';
  import { dirname, join } from 'node:path';
  import { fileURLToPath } from 'node:url';
  import { loadBlueprint } from '../src/load/load-blueprint.js';

  const here = dirname(fileURLToPath(import.meta.url));
  const fixtureDir = join(here, 'fixtures', 'product-catalog-project');

  describe('loadBlueprint (smoke)', () => {
    it('loads the canonical product-catalog project fixture', () => {
      const r = loadBlueprint(fixtureDir);
      expect(r.ok).toBe(true);
      if (!r.ok) return;

      expect(r.value.project.services).toEqual(['catalog', 'pricing', 'inventory', 'app', 'mod-workos']);
      expect(r.value.pdm.entities.Product?.kind).toBe('root');
      expect(r.value.services.catalog?.qsm).not.toBeNull();
      expect(r.value.services['mod-workos']?.kind).toBe('integration');
    });
  });
  ```

- [ ] **Step 2: Run test to verify it fails**

  Run:

  ```bash
  pnpm -F @rntme/blueprint test -- test/smoke.test.ts
  ```

  Expected: FAIL because the canonical fixture does not exist yet.

- [ ] **Step 3: Add the fixture and update docs**

  Create `packages/blueprint/test/fixtures/product-catalog-project/project.json`:

  ```json
  {
    "name": "product-catalog",
    "services": ["catalog", "pricing", "inventory", "app", "mod-workos"],
    "routes": {
      "ui": {
        "/": "app"
      },
      "http": {
        "/api/catalog": "catalog",
        "/api/pricing": "pricing",
        "/api/inventory": "inventory"
      }
    },
    "middleware": {
      "requestContext": { "kind": "request-context" },
      "auth": { "kind": "auth", "provider": "mod-workos" }
    },
    "mounts": [
      { "target": "ui:/", "use": ["requestContext", "auth"] }
    ]
  }
  ```

  Create the PDM fixture files:

  `packages/blueprint/test/fixtures/product-catalog-project/pdm/pdm.json`

  ```json
  {
    "version": "1"
  }
  ```

  `.../pdm/entities/Product.json`

  ```json
  {
    "ownerService": "catalog",
    "kind": "root",
    "table": "products",
    "fields": {
      "productId": { "type": "integer", "nullable": false, "column": "product_id" }
    },
    "keys": ["productId"]
  }
  ```

  `.../pdm/entities/Publication.json`

  ```json
  {
    "ownerService": "catalog",
    "kind": "owned",
    "table": "publications",
    "fields": {
      "id": { "type": "integer", "nullable": false, "column": "id" },
      "productId": { "type": "integer", "nullable": false, "column": "product_id" },
      "status": { "type": "string", "nullable": false, "column": "status" }
    },
    "keys": ["id"]
  }
  ```

  `.../pdm/entities/PriceEntry.json`

  ```json
  {
    "ownerService": "pricing",
    "kind": "owned",
    "table": "price_entries",
    "fields": {
      "id": { "type": "integer", "nullable": false, "column": "id" },
      "productId": { "type": "integer", "nullable": false, "column": "product_id" },
      "amount": { "type": "decimal", "nullable": false, "column": "amount" }
    },
    "keys": ["id"]
  }
  ```

  `.../pdm/entities/InventoryPosition.json`

  ```json
  {
    "ownerService": "inventory",
    "kind": "owned",
    "table": "inventory_positions",
    "fields": {
      "id": { "type": "integer", "nullable": false, "column": "id" },
      "productId": { "type": "integer", "nullable": false, "column": "product_id" },
      "quantity": { "type": "integer", "nullable": false, "column": "quantity" }
    },
    "keys": ["id"]
  }
  ```

  Create service descriptors:

  `.../services/catalog/service.json`

  ```json
  { "kind": "domain" }
  ```

  `.../services/catalog/qsm/qsm.json`

  ```json
  {
    "version": "1",
    "relations": {}
  }
  ```

  `.../services/catalog/qsm/projections/ProductCard.json`

  ```json
  {
    "backing": "entity-mirror",
    "source": { "entity": "Product" },
    "keys": ["productId"],
    "grain": ["productId"],
    "exposed": ["productId"]
  }
  ```

  `.../services/pricing/service.json`

  ```json
  { "kind": "domain" }
  ```

  `.../services/inventory/service.json`

  ```json
  { "kind": "domain" }
  ```

  `.../services/app/service.json`

  ```json
  { "kind": "domain" }
  ```

  `.../services/mod-workos/service.json`

  ```json
  { "kind": "integration" }
  ```

  Expand `packages/blueprint/README.md` to a real package README:

  ```md
  # @rntme/blueprint

  Project-first blueprint parser/validator for rntme.

  ## Role in the system

  - Depends on: `@rntme/pdm`, `@rntme/qsm`, `zod`
  - Consumed by: future runtime/tooling tracks
  - Position in pipeline: project directory → `loadBlueprint` → validated project metadata + validated project `PDM` + parsed per-service `QSM`

  ## Where to look first

  - `src/load/load-blueprint.ts`
  - `src/parse/schema.ts`
  - `src/validate/structural.ts`
  - `test/fixtures/product-catalog-project/`
  ```

  In `README.md`, add a package row in the Packages table:

  ```md
  | [`@rntme/blueprint`](packages/blueprint) | Project-first blueprint folder parser/validator: loads `project.json`, project `PDM`, service registry metadata, and raw per-service `QSM` directories. |
  ```

  In `AGENTS.md`, update §3 package layering and the one-line package list with a new entry:

  ```md
  # ASCII dependency diagram: add `@rntme/blueprint` above `@rntme/pdm` and `@rntme/qsm`
  # one-line package list:
  - **`@rntme/blueprint`** — Project-first blueprint folder parser/validator. Owns `project.json`, project-level PDM assembly, service registry metadata, and loading of raw service-level multi-file QSM artifacts. → `packages/blueprint/README.md`.
  ```

  In the root `README.md` dependency graph, add `@rntme/blueprint` as a package depending on `@rntme/pdm` and `@rntme/qsm`.

- [ ] **Step 4: Run verification**

  Run:

  ```bash
  pnpm -F @rntme/blueprint test
  pnpm -F @rntme/blueprint build
  pnpm -F @rntme/blueprint typecheck
  pnpm -F @rntme/pdm test -- test/unit/project-entity.test.ts test/unit/load-dir.test.ts
  pnpm -F @rntme/qsm test -- test/unit/load-dir.test.ts
  ```

  Expected: PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add packages/blueprint README.md AGENTS.md
  git commit -m "docs: document blueprint package and canonical track-a fixture"
  ```

---

## Self-check matrix

Use this before marking the plan executed:

| Spec requirement | Covered by |
|---|---|
| Blueprint is a project folder | Tasks 5-6 |
| `project.json` exists and parses | Task 5 |
| Project-level `PDM` | Tasks 2-3 |
| `entity-per-file` | Task 3 |
| Field-level ownership removed | Task 2 |
| Root entities have no `stateMachine` | Task 2 |
| Multi-file service-level `QSM` | Task 4 |
| `QSM` remains service-level | Tasks 4-6 |
| Service kinds `domain` / `integration` | Task 5 |
| `mod-*` naming rule | Task 5 |
| Canonical product-catalog fixture | Task 6 |
| Runtime deferred | explicit scope guard; no runtime files touched |

## Final verification command set

Run this exact bundle before closing Track A:

```bash
pnpm -F @rntme/blueprint build
pnpm -F @rntme/blueprint typecheck
pnpm -F @rntme/blueprint test
pnpm -F @rntme/pdm typecheck
pnpm -F @rntme/pdm test -- test/unit/project-entity.test.ts test/unit/load-dir.test.ts
pnpm -F @rntme/qsm typecheck
pnpm -F @rntme/qsm test -- test/unit/load-dir.test.ts
```
