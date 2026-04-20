# QSM relations migration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Переместить структурную relation-метаданную для read-side из PDM в QSM с B2 cross-validation; демонстрационно обогатить `listIssues`/`listIssuesUi`/`searchIssues` через новый путь.

**Architecture:** Top-level `relations` в QSM (flat map `"Projection.relation" → {to, localKey, foreignKey, cardinality, role?}`). Compiler walks QSM.relations для dot-nav; PDM касается только для field→column резолва и cross-ref валидации. Single PR с двумя коммитами: Phase 1 (migration, invariant byte-identical SQL); Phase 2 (demo enrichment).

**Tech Stack:** TypeScript, Zod, Vitest, pnpm workspaces, SQLite (better-sqlite3).

**Spec:** `docs/superpowers/specs/done/2026-04-16-qsm-relations-migration-design.md`

---

## File Structure Overview

| Area | File | Role |
|---|---|---|
| QSM types | `packages/qsm/src/types/artifact.ts` | `QsmRelation` type, `QsmArtifact` with `relations` field |
| QSM types | `packages/qsm/src/types/resolvers.ts` | Resolver interface методы для relations |
| QSM types | `packages/qsm/src/types/result.ts` | Новые error codes |
| QSM parse | `packages/qsm/src/parse/schema.ts` | Zod schema для `relations` (replaces `relationRoles`) |
| QSM validate | `packages/qsm/src/validate/structural.ts` | Structural checks для `relations` keys |
| QSM validate | `packages/qsm/src/validate/cross-ref.ts` | B2 enforcement против PDM |
| QSM resolver | `packages/qsm/src/resolvers/qsm-resolver.ts` | `resolveRelation`, `listRelations` |
| Compiler types | `packages/graph-ir-compiler/src/types/result.ts` | `NAV_NOT_ALLOWED`, `NAV_FAN_OUT_NOT_ALLOWED`, `NAV_PROJECTION_REQUIRED` |
| Compiler joins | `packages/graph-ir-compiler/src/lower/sqlite/joins.ts` | QSM-based `expandChain` + `chainToSqlJoins` |
| Compiler lower | `packages/graph-ir-compiler/src/lower/sqlite/lower.ts` | `LowerContext.qsm`, leaf field resolution via QSM |
| Compiler semantic | `packages/graph-ir-compiler/src/validate/semantic/sources.ts` | `NAV_PROJECTION_REQUIRED` gate |
| Fixtures | multiple `*.ts`, `*.json` | Migrate `relationRoles` to `relations` |
| Demo | `demo/issue-tracker-api/artifacts/qsm.json` | Phase 1: 3 relations; Phase 2: +sprint |
| Demo | `demo/issue-tracker-api/artifacts/graphs/{listIssues,listIssuesUi,searchIssues}.json` | Add `enriched` map node (Phase 2) |
| Demo | `demo/issue-tracker-api/artifacts/shapes.json` | Add `IssueListItem` shape (Phase 2) |
| Demo tests | `demo/issue-tracker-api/test/list-enrichment-e2e.test.ts` | New e2e (Phase 2) |
| Spec | `graph_ir_rc_7.md` | Section 2.2 text edit + QSM.relations подсекция |

---

# Phase 1 — Migration (invariant: byte-identical SQL snapshot)

## Task 1: Capture baseline SQL for invariant check

Before any code change: snapshot current compiler output for all existing test graphs. Diff against this at end of Phase 1 must be empty.

**Files:**
- Run: baseline capture via existing golden tests + demo smoke

- [ ] **Step 1: Capture golden SQL baseline**

Run: `pnpm -w test --filter @rntme/graph-ir-compiler`
Expected: All tests PASS. Observe that `test/golden/category-sales` tests pass with existing SQL. No file modification — this run confirms baseline.

- [ ] **Step 2: Run demo smoke test**

Run: `pnpm -w test --filter demo-issue-tracker-api`
Expected: All tests PASS. `smoke.test.ts` hits `/v1/issues/:id` and validates `projectKey`/`reporterUsername`/`assigneeUsername` in the response.

- [ ] **Step 3: Commit baseline note**

```bash
git checkout -b qsm-relations-migration
```

No commit yet — this is just branch setup. Phase 1 work will form Commit 1.

---

## Task 2: QSM error codes

**Files:**
- Modify: `packages/qsm/src/types/result.ts`

- [ ] **Step 1: Add new error codes and remove deprecated ones**

Replace the `ERROR_CODES` block (`packages/qsm/src/types/result.ts:20-52`):

```ts
export const ERROR_CODES = {
  // Parse
  QSM_PARSE_SCHEMA_VIOLATION: 'QSM_PARSE_SCHEMA_VIOLATION',

  // Structural
  QSM_STRUCT_PROJECTION_KEYS_EMPTY: 'QSM_STRUCT_PROJECTION_KEYS_EMPTY',
  QSM_STRUCT_PROJECTION_GRAIN_EMPTY: 'QSM_STRUCT_PROJECTION_GRAIN_EMPTY',
  QSM_STRUCT_PROJECTION_EXPOSED_EMPTY: 'QSM_STRUCT_PROJECTION_EXPOSED_EMPTY',
  QSM_STRUCT_PROJECTION_DUPLICATE_KEY: 'QSM_STRUCT_PROJECTION_DUPLICATE_KEY',
  QSM_STRUCT_PROJECTION_DUPLICATE_GRAIN: 'QSM_STRUCT_PROJECTION_DUPLICATE_GRAIN',
  QSM_STRUCT_PROJECTION_DUPLICATE_EXPOSED: 'QSM_STRUCT_PROJECTION_DUPLICATE_EXPOSED',
  QSM_STRUCT_DUPLICATE_TABLE: 'QSM_STRUCT_DUPLICATE_TABLE',
  QSM_RELATION_KEY_MALFORMED: 'QSM_RELATION_KEY_MALFORMED',
  QSM_RELATION_TO_MISSING: 'QSM_RELATION_TO_MISSING',
  QSM_RELATION_KEY_MISSING: 'QSM_RELATION_KEY_MISSING',

  // Cross-ref (requires PDM)
  QSM_XREF_SOURCE_UNKNOWN_ENTITY: 'QSM_XREF_SOURCE_UNKNOWN_ENTITY',
  QSM_XREF_KEY_UNKNOWN_FIELD: 'QSM_XREF_KEY_UNKNOWN_FIELD',
  QSM_XREF_GRAIN_UNKNOWN_FIELD: 'QSM_XREF_GRAIN_UNKNOWN_FIELD',
  QSM_XREF_EXPOSED_UNKNOWN_FIELD: 'QSM_XREF_EXPOSED_UNKNOWN_FIELD',
  QSM_XREF_EXPOSED_INCLUDES_GENERATED: 'QSM_XREF_EXPOSED_INCLUDES_GENERATED',
  QSM_XREF_ENTITY_MIRROR_REQUIRES_STATE_MACHINE: 'QSM_XREF_ENTITY_MIRROR_REQUIRES_STATE_MACHINE',
  QSM_XREF_ENTITY_MIRROR_KEYS_MISMATCH: 'QSM_XREF_ENTITY_MIRROR_KEYS_MISMATCH',
  QSM_XREF_ENTITY_MIRROR_GRAIN_MISMATCH: 'QSM_XREF_ENTITY_MIRROR_GRAIN_MISMATCH',
  QSM_XREF_ENTITY_MIRROR_DUPLICATE: 'QSM_XREF_ENTITY_MIRROR_DUPLICATE',
  QSM_XREF_RELATION_UNKNOWN_SOURCE_PROJECTION: 'QSM_XREF_RELATION_UNKNOWN_SOURCE_PROJECTION',
  QSM_XREF_RELATION_UNKNOWN_TARGET_PROJECTION: 'QSM_XREF_RELATION_UNKNOWN_TARGET_PROJECTION',
  QSM_XREF_RELATION_NOT_IN_PDM: 'QSM_XREF_RELATION_NOT_IN_PDM',
  QSM_XREF_RELATION_TO_MISMATCH: 'QSM_XREF_RELATION_TO_MISMATCH',
  QSM_XREF_RELATION_LOCAL_KEY_MISMATCH: 'QSM_XREF_RELATION_LOCAL_KEY_MISMATCH',
  QSM_XREF_RELATION_FOREIGN_KEY_MISMATCH: 'QSM_XREF_RELATION_FOREIGN_KEY_MISMATCH',
  QSM_XREF_RELATION_CARDINALITY_MISMATCH: 'QSM_XREF_RELATION_CARDINALITY_MISMATCH',
  QSM_XREF_RELATION_LOCAL_KEY_UNKNOWN_FIELD: 'QSM_XREF_RELATION_LOCAL_KEY_UNKNOWN_FIELD',
  QSM_XREF_RELATION_FOREIGN_KEY_NOT_A_KEY: 'QSM_XREF_RELATION_FOREIGN_KEY_NOT_A_KEY',

  // Backing feature gating
  QSM_BACKING_DERIVED_NOT_SUPPORTED: 'QSM_BACKING_DERIVED_NOT_SUPPORTED',

  // Internal
  QSM_INTERNAL: 'QSM_INTERNAL',
} as const;
```

Removed: `QSM_STRUCT_RELATION_ROLE_KEY_FORMAT`, `QSM_XREF_RELATION_ROLE_UNKNOWN_ENTITY`, `QSM_XREF_RELATION_ROLE_UNKNOWN_RELATION`.

- [ ] **Step 2: Run qsm type-check**

Run: `pnpm -w --filter @rntme/qsm typecheck`
Expected: Errors in `structural.ts`, `cross-ref.ts`, `qsm-resolver.ts`, and their tests — references to removed codes. These will be fixed by later tasks.

---

## Task 3: QSM types (artifact.ts)

**Files:**
- Modify: `packages/qsm/src/types/artifact.ts`

- [ ] **Step 1: Replace artifact types**

Replace entire content of `packages/qsm/src/types/artifact.ts`:

```ts
/**
 * Backing strategies for a projection (spec §6.1).
 *  - `entity-mirror`: 1:1 current-state mirror of a PDM entity, auto-derived
 *    from PDM + stateMachine. Consumer applies envelope-events to maintain it.
 *    The only backing supported in MVP.
 *  - `derived`: aggregate/join projection with explicit materializer rules.
 *    Parser accepts the value; validator rejects it until tier 2.
 */
export type ProjectionBacking = 'entity-mirror' | 'derived';

/**
 * Source of a projection.
 * - For `entity-mirror`, only `entity` matters; `pathPrefix` is ignored.
 * - For `derived` (tier 2), `pathPrefix` narrows a relation chain.
 */
export type ProjectionSource = {
  entity: string;
  pathPrefix?: string;
};

export type Projection = {
  backing?: ProjectionBacking;
  source: ProjectionSource;
  keys: readonly string[];
  grain: readonly string[];
  exposed: readonly string[];
  table?: string;
};

/**
 * Read-side relation roles (spec §6 / rc7 §8).
 * `fact` / `dimension` are annotations only — they do NOT drive compiler behavior.
 */
export const RELATION_ROLE_VALUES = ['fact', 'dimension'] as const;
export type RelationRole = (typeof RELATION_ROLE_VALUES)[number];

export const CARDINALITY_VALUES = ['one', 'many'] as const;
export type Cardinality = (typeof CARDINALITY_VALUES)[number];

/**
 * Structural relation metadata for read-side compilation.
 * Key format in `QsmArtifact.relations`: `"<ProjectionName>.<relationName>"`.
 * - `to` is a projection name in this same QSM.
 * - `localKey`/`foreignKey` are FIELD names (not columns). Column resolution
 *   happens at compile time via PDM.
 * - `cardinality` must match the corresponding PDM relation (B2).
 * - `role` is optional annotation; compiler does not consult it.
 */
export type QsmRelation = {
  to: string;
  localKey: string;
  foreignKey: string;
  cardinality: Cardinality;
  role?: RelationRole;
};

export type QsmArtifact = {
  projections: Readonly<Record<string, Projection>>;
  relations: Readonly<Record<string, QsmRelation>>;
};

declare const StructurallyValidBrand: unique symbol;
declare const ValidatedBrand: unique symbol;

export type StructurallyValidQsm = QsmArtifact & {
  readonly [StructurallyValidBrand]: true;
};

export type ValidatedQsm = StructurallyValidQsm & {
  readonly [ValidatedBrand]: true;
};
```

- [ ] **Step 2: Run typecheck**

Run: `pnpm -w --filter @rntme/qsm typecheck`
Expected: Errors will shift — `schema.ts`, `cross-ref.ts`, `resolvers/qsm-resolver.ts`, `types/resolvers.ts` reference old `relationRoles`. Fix in next tasks.

---

## Task 4: QSM parse schema (Zod)

**Files:**
- Modify: `packages/qsm/src/parse/schema.ts`

- [ ] **Step 1: Rewrite schema**

Replace entire content of `packages/qsm/src/parse/schema.ts`:

```ts
import { z } from 'zod';
import { CARDINALITY_VALUES, RELATION_ROLE_VALUES } from '../types/artifact.js';

const nonEmptyString = z.string().min(1);

const backingSchema = z.enum(['entity-mirror', 'derived']);

const sourceSchema = z
  .object({
    entity: nonEmptyString,
    pathPrefix: nonEmptyString.optional(),
  })
  .strict();

const projectionSchema = z
  .object({
    backing: backingSchema.optional(),
    source: sourceSchema,
    keys: z.array(nonEmptyString),
    grain: z.array(nonEmptyString),
    exposed: z.array(nonEmptyString),
    table: nonEmptyString.optional(),
  })
  .strict();

const cardinalitySchema = z.enum(CARDINALITY_VALUES);
const roleSchema = z.enum(RELATION_ROLE_VALUES);

const relationSchema = z
  .object({
    to: nonEmptyString,
    localKey: nonEmptyString,
    foreignKey: nonEmptyString,
    cardinality: cardinalitySchema,
    role: roleSchema.optional(),
  })
  .strict();

export const QsmArtifactSchema = z
  .object({
    projections: z.record(nonEmptyString, projectionSchema).default({}),
    relations: z.record(nonEmptyString, relationSchema).default({}),
  })
  .strict();

export type QsmArtifactParsed = z.output<typeof QsmArtifactSchema>;
```

- [ ] **Step 2: Run qsm parse tests**

Run: `pnpm -w --filter @rntme/qsm test -- parse`
Expected: Existing parse tests that mention `relationRoles` will FAIL — they'll be fixed when fixtures migrate (later tasks). Tests on `projections` continue to pass.

---

## Task 5: QSM structural validation

**Files:**
- Modify: `packages/qsm/src/validate/structural.ts`

- [ ] **Step 1: Rewrite structural validation to check `relations` keys and fields**

Replace the relationRoles block (lines 89-98 of current file) and update related logic. Full new file content:

```ts
import type { QsmArtifact, StructurallyValidQsm } from '../types/artifact.js';
import {
  err,
  ok,
  ERROR_CODES,
  type Result,
  type QsmError,
} from '../types/result.js';

const RELATION_KEY_RE = /^[A-Z][A-Za-z0-9]*\.[a-zA-Z][a-zA-Z0-9]*$/;

export function validateStructural(
  artifact: QsmArtifact,
): Result<StructurallyValidQsm> {
  const errors: QsmError[] = [];
  const seenTables = new Map<string, string>();

  for (const [projName, proj] of Object.entries(artifact.projections)) {
    const pPath = `projections.${projName}`;

    if (proj.keys.length === 0) {
      errors.push({
        layer: 'structural',
        code: ERROR_CODES.QSM_STRUCT_PROJECTION_KEYS_EMPTY,
        message: `projection "${projName}" must declare at least one key`,
        path: `${pPath}.keys`,
      });
    }
    if (proj.grain.length === 0) {
      errors.push({
        layer: 'structural',
        code: ERROR_CODES.QSM_STRUCT_PROJECTION_GRAIN_EMPTY,
        message: `projection "${projName}" must declare at least one grain column`,
        path: `${pPath}.grain`,
      });
    }
    if (proj.exposed.length === 0) {
      errors.push({
        layer: 'structural',
        code: ERROR_CODES.QSM_STRUCT_PROJECTION_EXPOSED_EMPTY,
        message: `projection "${projName}" must declare at least one exposed column`,
        path: `${pPath}.exposed`,
      });
    }

    const kDup = findDuplicates(proj.keys);
    if (kDup.length > 0) {
      errors.push({
        layer: 'structural',
        code: ERROR_CODES.QSM_STRUCT_PROJECTION_DUPLICATE_KEY,
        message: `duplicate keys in "${projName}": ${kDup.join(', ')}`,
        path: `${pPath}.keys`,
      });
    }
    const gDup = findDuplicates(proj.grain);
    if (gDup.length > 0) {
      errors.push({
        layer: 'structural',
        code: ERROR_CODES.QSM_STRUCT_PROJECTION_DUPLICATE_GRAIN,
        message: `duplicate grain in "${projName}": ${gDup.join(', ')}`,
        path: `${pPath}.grain`,
      });
    }
    const eDup = findDuplicates(proj.exposed);
    if (eDup.length > 0) {
      errors.push({
        layer: 'structural',
        code: ERROR_CODES.QSM_STRUCT_PROJECTION_DUPLICATE_EXPOSED,
        message: `duplicate exposed in "${projName}": ${eDup.join(', ')}`,
        path: `${pPath}.exposed`,
      });
    }

    const table = proj.table ?? defaultTableName(projName);
    const existing = seenTables.get(table);
    if (existing !== undefined) {
      errors.push({
        layer: 'structural',
        code: ERROR_CODES.QSM_STRUCT_DUPLICATE_TABLE,
        message: `projections "${existing}" and "${projName}" both resolve to table "${table}"`,
        path: `${pPath}.table`,
      });
    } else {
      seenTables.set(table, projName);
    }
  }

  for (const [key, rel] of Object.entries(artifact.relations)) {
    const rPath = `relations["${key}"]`;
    if (!RELATION_KEY_RE.test(key)) {
      errors.push({
        layer: 'structural',
        code: ERROR_CODES.QSM_RELATION_KEY_MALFORMED,
        message: `relation key "${key}" must match "<ProjectionName>.<relationName>"`,
        path: rPath,
      });
      continue; // further checks are meaningless if key malformed
    }
    if (!rel.to || rel.to.length === 0) {
      errors.push({
        layer: 'structural',
        code: ERROR_CODES.QSM_RELATION_TO_MISSING,
        message: `relation "${key}" missing "to"`,
        path: `${rPath}.to`,
      });
    }
    if (!rel.localKey || rel.localKey.length === 0) {
      errors.push({
        layer: 'structural',
        code: ERROR_CODES.QSM_RELATION_KEY_MISSING,
        message: `relation "${key}" missing "localKey"`,
        path: `${rPath}.localKey`,
      });
    }
    if (!rel.foreignKey || rel.foreignKey.length === 0) {
      errors.push({
        layer: 'structural',
        code: ERROR_CODES.QSM_RELATION_KEY_MISSING,
        message: `relation "${key}" missing "foreignKey"`,
        path: `${rPath}.foreignKey`,
      });
    }
  }

  if (errors.length > 0) return err(errors);
  return ok(artifact as StructurallyValidQsm);
}

export function defaultTableName(projectionName: string): string {
  return `projection_${projectionName.toLowerCase()}`;
}

function findDuplicates(xs: readonly string[]): string[] {
  const seen = new Set<string>();
  const dup: string[] = [];
  for (const x of xs) {
    if (seen.has(x)) dup.push(x);
    seen.add(x);
  }
  return dup;
}
```

- [ ] **Step 2: Run typecheck**

Run: `pnpm -w --filter @rntme/qsm typecheck`
Expected: `structural.ts` compiles. Remaining errors in `cross-ref.ts`, `qsm-resolver.ts`, `types/resolvers.ts`, tests — covered by next tasks.

---

## Task 6: QSM cross-ref validation (B2 enforcement)

**Files:**
- Modify: `packages/qsm/src/validate/cross-ref.ts`

- [ ] **Step 1: Replace relationRoles block with relations B2 block**

In `packages/qsm/src/validate/cross-ref.ts`, remove the current relationRoles loop (lines 106-128) and append new relations B2 loop. After the projections loop, add:

```ts
  for (const [key, rel] of Object.entries(artifact.relations)) {
    const rPath = `relations["${key}"]`;
    const [sourceProjName, relName] = key.split('.');
    if (!sourceProjName || !relName) continue; // structural layer already flagged

    const sourceProj = artifact.projections[sourceProjName];
    if (!sourceProj) {
      errors.push({
        layer: 'cross-ref',
        code: ERROR_CODES.QSM_XREF_RELATION_UNKNOWN_SOURCE_PROJECTION,
        message: `relation "${key}": source projection "${sourceProjName}" not found in QSM`,
        path: rPath,
      });
      continue;
    }
    const sourceEntity = pdm.resolveEntity(sourceProj.source.entity);
    if (!sourceEntity) continue; // flagged earlier as projection source unknown

    const targetProj = artifact.projections[rel.to];
    if (!targetProj) {
      errors.push({
        layer: 'cross-ref',
        code: ERROR_CODES.QSM_XREF_RELATION_UNKNOWN_TARGET_PROJECTION,
        message: `relation "${key}": target projection "${rel.to}" not found in QSM`,
        path: `${rPath}.to`,
      });
      continue;
    }
    const targetEntity = pdm.resolveEntity(targetProj.source.entity);
    if (!targetEntity) continue;

    const pdmRel = sourceEntity.relations.find((r) => r.name === relName);
    if (!pdmRel) {
      errors.push({
        layer: 'cross-ref',
        code: ERROR_CODES.QSM_XREF_RELATION_NOT_IN_PDM,
        message: `relation "${key}" requires PDM relation "${sourceEntity.name}.${relName}"; add it to PDM or check the name`,
        path: rPath,
      });
      continue;
    }

    // B2 — strict cross-validation against PDM (PDM is the source of truth)
    if (pdmRel.to !== targetEntity.name) {
      errors.push({
        layer: 'cross-ref',
        code: ERROR_CODES.QSM_XREF_RELATION_TO_MISMATCH,
        message: `relation "${key}": "to" projects to entity "${targetEntity.name}" but PDM says "${pdmRel.to}"`,
        path: `${rPath}.to`,
      });
    }
    if (rel.localKey !== pdmRel.localKey) {
      errors.push({
        layer: 'cross-ref',
        code: ERROR_CODES.QSM_XREF_RELATION_LOCAL_KEY_MISMATCH,
        message: `relation "${key}": localKey "${rel.localKey}" does not match PDM "${pdmRel.localKey}"`,
        path: `${rPath}.localKey`,
      });
    }
    if (rel.foreignKey !== pdmRel.foreignKey) {
      errors.push({
        layer: 'cross-ref',
        code: ERROR_CODES.QSM_XREF_RELATION_FOREIGN_KEY_MISMATCH,
        message: `relation "${key}": foreignKey "${rel.foreignKey}" does not match PDM "${pdmRel.foreignKey}"`,
        path: `${rPath}.foreignKey`,
      });
    }
    if (rel.cardinality !== pdmRel.cardinality) {
      errors.push({
        layer: 'cross-ref',
        code: ERROR_CODES.QSM_XREF_RELATION_CARDINALITY_MISMATCH,
        message: `relation "${key}": cardinality "${rel.cardinality}" does not match PDM "${pdmRel.cardinality}"`,
        path: `${rPath}.cardinality`,
      });
    }

    // Sanity checks
    if (!sourceEntity.fields.find((f) => f.name === rel.localKey)) {
      errors.push({
        layer: 'cross-ref',
        code: ERROR_CODES.QSM_XREF_RELATION_LOCAL_KEY_UNKNOWN_FIELD,
        message: `relation "${key}": localKey "${rel.localKey}" not a field on "${sourceEntity.name}"`,
        path: `${rPath}.localKey`,
      });
    }
    const foreignField = targetEntity.fields.find((f) => f.name === rel.foreignKey);
    if (!foreignField) {
      errors.push({
        layer: 'cross-ref',
        code: ERROR_CODES.QSM_XREF_RELATION_LOCAL_KEY_UNKNOWN_FIELD,
        message: `relation "${key}": foreignKey "${rel.foreignKey}" not a field on "${targetEntity.name}"`,
        path: `${rPath}.foreignKey`,
      });
    } else if (!targetEntity.keys.includes(rel.foreignKey)) {
      errors.push({
        layer: 'cross-ref',
        code: ERROR_CODES.QSM_XREF_RELATION_FOREIGN_KEY_NOT_A_KEY,
        message: `relation "${key}": foreignKey "${rel.foreignKey}" is not a key of "${targetEntity.name}" (keys: [${targetEntity.keys.join(', ')}])`,
        path: `${rPath}.foreignKey`,
      });
    }
  }
```

- [ ] **Step 2: Run typecheck**

Run: `pnpm -w --filter @rntme/qsm typecheck`
Expected: `cross-ref.ts` compiles. Errors remaining in `qsm-resolver.ts`, `types/resolvers.ts` — covered next.

---

## Task 7: QSM resolver types

**Files:**
- Modify: `packages/qsm/src/types/resolvers.ts`

- [ ] **Step 1: Read current resolver types**

Run: `cat packages/qsm/src/types/resolvers.ts`
Expected: See current `QsmResolver`, `ResolvedProjection`, `ResolvedRelationRole` types.

- [ ] **Step 2: Replace with new resolver types**

Replace the file. Remove `ResolvedRelationRole`, `listRelationRoles`, `resolveRelationRole`. Add `ResolvedRelation`, `listRelations`, `resolveRelation`. Full content:

```ts
import type { ProjectionBacking, ProjectionSource, RelationRole, Cardinality } from './artifact.js';

export type ResolvedProjection = {
  name: string;
  backing: ProjectionBacking;
  table: string;
  source: ProjectionSource;
  keys: readonly string[];
  grain: readonly string[];
  exposed: readonly string[];
};

export type ResolvedRelation = {
  sourceProjection: string;
  relationName: string;
  to: string;
  localKey: string;
  foreignKey: string;
  cardinality: Cardinality;
  role?: RelationRole;
};

export type QsmResolver = {
  listProjections(): readonly string[];
  resolveProjection(name: string): ResolvedProjection | null;
  findEntityMirror(entityName: string): ResolvedProjection | null;
  listRelations(): readonly ResolvedRelation[];
  resolveRelation(sourceProjection: string, relationName: string): ResolvedRelation | null;
};
```

- [ ] **Step 3: Typecheck**

Run: `pnpm -w --filter @rntme/qsm typecheck`
Expected: Errors remaining in `qsm-resolver.ts` — fix next.

---

## Task 8: QSM resolver implementation

**Files:**
- Modify: `packages/qsm/src/resolvers/qsm-resolver.ts`

- [ ] **Step 1: Rewrite resolver**

Replace entire content of `packages/qsm/src/resolvers/qsm-resolver.ts`:

```ts
import type {
  Projection,
  ValidatedQsm,
} from '../types/artifact.js';
import type {
  QsmResolver,
  ResolvedProjection,
  ResolvedRelation,
} from '../types/resolvers.js';
import { defaultTableName } from '../validate/structural.js';
import { invariantViolated } from '../common/invariant.js';

export function createQsmResolver(artifact: ValidatedQsm): QsmResolver {
  const projectionNames = Object.keys(artifact.projections);
  const resolvedByName = new Map<string, ResolvedProjection>();
  for (const name of projectionNames) {
    resolvedByName.set(name, toResolvedProjection(name, artifact.projections[name]!));
  }

  const mirrorByEntity = new Map<string, ResolvedProjection>();
  for (const rp of resolvedByName.values()) {
    if (rp.backing !== 'entity-mirror') continue;
    if (mirrorByEntity.has(rp.source.entity)) {
      throw invariantViolated(
        `multiple entity-mirror projections on "${rp.source.entity}" — cross-ref validator should have rejected this`,
      );
    }
    mirrorByEntity.set(rp.source.entity, rp);
  }

  const relations: ResolvedRelation[] = Object.entries(artifact.relations).flatMap(
    ([key, rel]) => {
      const [sourceProjection, relationName] = key.split('.');
      if (!sourceProjection || !relationName) return [];
      return [{
        sourceProjection,
        relationName,
        to: rel.to,
        localKey: rel.localKey,
        foreignKey: rel.foreignKey,
        cardinality: rel.cardinality,
        ...(rel.role !== undefined ? { role: rel.role } : {}),
      }];
    },
  );
  const relationsByKey = new Map(
    relations.map((r) => [`${r.sourceProjection}.${r.relationName}`, r]),
  );

  return {
    listProjections: () => projectionNames,
    resolveProjection: (name) => resolvedByName.get(name) ?? null,
    findEntityMirror: (entityName) => mirrorByEntity.get(entityName) ?? null,
    listRelations: () => relations,
    resolveRelation: (sourceProjection, relationName) =>
      relationsByKey.get(`${sourceProjection}.${relationName}`) ?? null,
  };
}

function toResolvedProjection(name: string, p: Projection): ResolvedProjection {
  return {
    name,
    backing: p.backing ?? 'entity-mirror',
    table: p.table ?? defaultTableName(name),
    source:
      p.source.pathPrefix !== undefined
        ? { entity: p.source.entity, pathPrefix: p.source.pathPrefix }
        : { entity: p.source.entity },
    keys: p.keys,
    grain: p.grain,
    exposed: p.exposed,
  };
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm -w --filter @rntme/qsm typecheck`
Expected: Package-level typecheck passes. Only test file errors remaining.

---

## Task 9: QSM tests — migrate existing, add new

**Files:**
- Modify: all qsm test files referring to `relationRoles`
- Modify: `packages/qsm/src/index.ts` — ensure exports match new types

- [ ] **Step 1: Find all test files referencing removed symbols**

Run: `grep -rn --include='*.ts' 'relationRoles\|QSM_STRUCT_RELATION_ROLE\|QSM_XREF_RELATION_ROLE\|listRelationRoles\|resolveRelationRole' packages/qsm/`
Expected: List of test files + any source still referencing. For each test:
  - Remove `relationRoles: {}` from fixtures (Zod default handles it).
  - If fixture had non-empty `relationRoles` — decide whether the test is about relations (rewrite to new shape) or about something else (just delete the field).
  - Replace references to `listRelationRoles/resolveRelationRole` in tests with `listRelations/resolveRelation`; adjust assertions to ResolvedRelation fields.
  - Update error-code assertions to new names.

- [ ] **Step 2: Add new validation tests**

Create `packages/qsm/test/unit/validate/relations-structural.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { validateStructural } from '../../../src/validate/structural.js';

describe('validateStructural — relations', () => {
  it('accepts well-formed relations', () => {
    const r = validateStructural({
      projections: {
        IssueView: { source: { entity: 'Issue' }, keys: ['id'], grain: ['id'], exposed: ['id'] },
        ProjMirror: { source: { entity: 'Project' }, keys: ['id'], grain: ['id'], exposed: ['id'] },
      },
      relations: {
        'IssueView.project': { to: 'ProjMirror', localKey: 'projectId', foreignKey: 'id', cardinality: 'one' },
      },
    });
    expect(r.ok).toBe(true);
  });

  it('flags malformed key', () => {
    const r = validateStructural({
      projections: {
        IssueView: { source: { entity: 'Issue' }, keys: ['id'], grain: ['id'], exposed: ['id'] },
      },
      relations: {
        'BadKey': { to: 'X', localKey: 'a', foreignKey: 'b', cardinality: 'one' },
      },
    });
    expect(r.ok).toBe(false);
    expect(r.ok || r.errors.some((e) => e.code === 'QSM_RELATION_KEY_MALFORMED')).toBe(true);
  });
});
```

Create `packages/qsm/test/unit/validate/relations-crossref.test.ts` with cases for each new error code (`UNKNOWN_SOURCE_PROJECTION`, `UNKNOWN_TARGET_PROJECTION`, `NOT_IN_PDM`, `TO_MISMATCH`, `LOCAL_KEY_MISMATCH`, `FOREIGN_KEY_MISMATCH`, `CARDINALITY_MISMATCH`, `FOREIGN_KEY_NOT_A_KEY`). Use a minimal PDM fixture with `Issue` and `Project` entities.

**Template for each negative test:**

```ts
it('flags localKey mismatch', () => {
  const pdm = createPdmResolver(miniPdm());
  const s = validateStructural({
    projections: {
      IssueView: { source: { entity: 'Issue' }, keys: ['id'], grain: ['id'], exposed: ['id'] },
      ProjMirror: { source: { entity: 'Project' }, keys: ['id'], grain: ['id'], exposed: ['id'] },
    },
    relations: {
      'IssueView.project': { to: 'ProjMirror', localKey: 'WRONG', foreignKey: 'id', cardinality: 'one' },
    },
  });
  expect(s.ok).toBe(true);
  const r = validateCrossRef(s.value, pdm);
  expect(r.ok).toBe(false);
  expect(r.errors.map(e => e.code)).toContain('QSM_XREF_RELATION_LOCAL_KEY_MISMATCH');
});
```

- [ ] **Step 3: Run qsm tests**

Run: `pnpm -w --filter @rntme/qsm test`
Expected: New tests PASS; migrated fixtures behave correctly.

- [ ] **Step 4: Commit QSM package changes**

```bash
git add packages/qsm
git commit -m "refactor(qsm): replace relationRoles with structural relations (B2 cross-ref)"
```

---

## Task 10: Compiler error codes

**Files:**
- Modify: `packages/graph-ir-compiler/src/types/result.ts`

- [ ] **Step 1: Add nav error codes**

In `packages/graph-ir-compiler/src/types/result.ts`, append to `ERROR_CODES` (before the closing `} as const;`):

```ts
  NAV_NOT_ALLOWED: 'NAV_NOT_ALLOWED',
  NAV_FAN_OUT_NOT_ALLOWED: 'NAV_FAN_OUT_NOT_ALLOWED',
  NAV_PROJECTION_REQUIRED: 'NAV_PROJECTION_REQUIRED',
```

- [ ] **Step 2: Typecheck**

Run: `pnpm -w --filter @rntme/graph-ir-compiler typecheck`
Expected: Passes. No callers yet.

---

## Task 11: Compiler joins.ts — QSM-based walk

**Files:**
- Modify: `packages/graph-ir-compiler/src/lower/sqlite/joins.ts`

- [ ] **Step 1: Rewrite joins.ts**

Replace entire content:

```ts
import type { ValidatedPdm } from '@rntme/pdm';
import type { ValidatedQsm, QsmRelation } from '@rntme/qsm';
import type { SqlExpr, SqlJoin } from './ast.js';

export type JoinChain = {
  from: string;
  fromProjection: string;
  steps: Array<{
    relation: string;
    fromProjection: string;
    toProjection: string;
    toAlias: string;
    localKey: string;    // column name
    foreignKey: string;  // column name
    cardinality: 'one' | 'many';
  }>;
};

/**
 * Walk QSM.relations starting from `startProjection`, stepping through `path[1..]`.
 * Resolves field→column via PDM for each hop.
 */
export function expandChain(
  startAlias: string,
  startProjection: string,
  path: string[],
  qsm: ValidatedQsm,
  pdm: ValidatedPdm,
): JoinChain {
  let curProjName = startProjection;
  const steps: JoinChain['steps'] = [];

  for (let i = 1; i < path.length; i++) {
    const relName = path[i]!;
    const key = `${curProjName}.${relName}`;
    const rel: QsmRelation | undefined = qsm.relations[key];
    if (!rel) {
      throw new Error(`NAV_NOT_ALLOWED: relation "${key}" not declared in QSM.relations`);
    }
    if (rel.cardinality === 'many') {
      throw new Error(`NAV_FAN_OUT_NOT_ALLOWED: relation "${key}" has cardinality "many"`);
    }

    const curProj = qsm.projections[curProjName];
    if (!curProj) throw new Error(`expandChain: unknown source projection "${curProjName}"`);
    const curEntity = pdm.entities[curProj.source.entity];
    if (!curEntity) throw new Error(`expandChain: unknown PDM entity "${curProj.source.entity}"`);

    const toProj = qsm.projections[rel.to];
    if (!toProj) throw new Error(`expandChain: unknown target projection "${rel.to}"`);
    const toEntity = pdm.entities[toProj.source.entity];
    if (!toEntity) throw new Error(`expandChain: unknown PDM entity "${toProj.source.entity}"`);

    const localField = curEntity.fields[rel.localKey];
    const foreignField = toEntity.fields[rel.foreignKey];
    if (!localField) throw new Error(`expandChain: field "${rel.localKey}" missing on ${curEntity.table}`);
    if (!foreignField) throw new Error(`expandChain: field "${rel.foreignKey}" missing on ${toEntity.table}`);

    steps.push({
      relation: relName,
      fromProjection: curProjName,
      toProjection: rel.to,
      toAlias: relName,
      localKey: localField.column,
      foreignKey: foreignField.column,
      cardinality: rel.cardinality,
    });

    curProjName = rel.to;
  }

  return { from: startAlias, fromProjection: startProjection, steps };
}

export function chainToSqlJoins(
  chain: JoinChain,
  qsm: ValidatedQsm,
  pdm: ValidatedPdm,
): SqlJoin[] {
  const joins: SqlJoin[] = [];
  let fromAlias = chain.from;
  for (const step of chain.steps) {
    const toProj = qsm.projections[step.toProjection];
    if (!toProj) throw new Error(`chainToSqlJoins: unknown projection ${step.toProjection}`);
    const toTable = toProj.table ?? defaultTableName(step.toProjection);

    const on: SqlExpr = {
      kind: 'op',
      op: 'eq',
      args: [
        { kind: 'col', table: fromAlias, column: step.localKey },
        { kind: 'col', table: step.toAlias, column: step.foreignKey },
      ],
    };
    joins.push({ kind: 'left', table: toTable, alias: step.toAlias, on });
    fromAlias = step.toAlias;
  }
  return joins;
}

function defaultTableName(projectionName: string): string {
  return `projection_${projectionName.toLowerCase()}`;
}

// `pdm` parameter is accepted for future field->column resolution in chainToSqlJoins,
// currently expandChain already pre-resolves all columns. Keeping pdm in signature to
// avoid breaking callers if more PDM-dependent logic lands later.
void pdm;
```

Note on the `void pdm;` at the bottom: if linter flags it, remove the pdm parameter from `chainToSqlJoins` signature (it's unused). Same change to `lower.ts` call site in next task.

- [ ] **Step 2: Typecheck**

Run: `pnpm -w --filter @rntme/graph-ir-compiler typecheck`
Expected: Errors in `lower.ts` — signature mismatches. Fix next.

---

## Task 12: Compiler lower.ts — integrate QSM

**Files:**
- Modify: `packages/graph-ir-compiler/src/lower/sqlite/lower.ts`

- [ ] **Step 1: Update `LowerContext` to include QSM**

In `packages/graph-ir-compiler/src/lower/sqlite/lower.ts:10-13`:

```ts
import type { ValidatedPdm } from '@rntme/pdm';
import type { ValidatedQsm } from '@rntme/qsm';
import type { RelOp, RelScan } from '../../types/relational.js';
// ... existing imports ...

export type LowerContext = {
  predicateOptionalParams: Set<string>;
  pdm?: ValidatedPdm;
  qsm?: ValidatedQsm;
};
```

- [ ] **Step 2: Rewrite multi-hop path resolution in `makeColumnOf`**

Replace lines 256-287 (the `if (parts.length > 2 && context.pdm && scan.entity)` block) with:

```ts
    if (parts.length > 2 && context.pdm && context.qsm && scan.entity) {
      if (parts[0] !== scan.alias) {
        throw new Error(`lower: path "${path}" root alias does not match scan`);
      }
      // Resolve scan.entity → entity-mirror projection name
      let startProjName: string | undefined;
      for (const [projName, proj] of Object.entries(context.qsm.projections)) {
        if ((proj.backing ?? 'entity-mirror') === 'entity-mirror' && proj.source.entity === scan.entity) {
          startProjName = projName;
          break;
        }
      }
      if (!startProjName) {
        throw new Error(
          `NAV_PROJECTION_REQUIRED: scan on entity "${scan.entity}" has no entity-mirror projection; cannot resolve dot-nav "${path}"`,
        );
      }

      const prefix = parts.slice(0, -1);
      const joinChain = expandChain(scan.alias, startProjName, prefix, context.qsm, context.pdm);
      const joins = chainToSqlJoins(joinChain, context.qsm, context.pdm);
      for (const j of joins) {
        if (!addedAliases.has(j.alias)) {
          child.joins.push(j);
          addedAliases.add(j.alias);
        }
      }

      const leafAlias = parts[parts.length - 2]!;
      const leafField = parts[parts.length - 1]!;

      // Target projection for leaf = last step's toProjection
      const leafProjName = joinChain.steps.length > 0
        ? joinChain.steps[joinChain.steps.length - 1]!.toProjection
        : startProjName;
      const leafProj = context.qsm.projections[leafProjName];
      if (!leafProj) throw new Error(`lower: unknown projection ${leafProjName}`);
      const leafEntity = context.pdm.entities[leafProj.source.entity];
      if (!leafEntity) throw new Error(`lower: unknown entity ${leafProj.source.entity}`);
      const col = leafEntity.fields[leafField]?.column;
      if (!col) throw new Error(`lower: missing field ${leafField} on ${leafEntity.table}`);
      return { table: leafAlias, column: col };
    }
    throw new Error(`lower: cannot resolve field path "${path}"`);
```

(Remove the `Entity`/`Relation` imports at line 1 if only they were referenced by the deleted PDM-walk block. Run typecheck to confirm.)

- [ ] **Step 3: Typecheck**

Run: `pnpm -w --filter @rntme/graph-ir-compiler typecheck`
Expected: Errors in callers — `lowerToSqlite` call sites need `qsm` in context. Fix next.

---

## Task 13: Pass QSM via LowerContext from all callers

**Files:**
- Modify: every caller of `lowerToSqlite` / `lowerFilterWithLifting`

- [ ] **Step 1: Find callers**

Run: `grep -rn --include='*.ts' 'lowerToSqlite\|lowerFilterWithLifting' packages/graph-ir-compiler/src packages/projection-consumer/src packages/runtime/src`
Expected: List of entry points that build LowerContext (`emit/plan.ts`, `execute/execute.ts`, etc.).

- [ ] **Step 2: Update each caller to include qsm in context**

For each caller, trace where `ValidatedQsm` is available (usually alongside `ValidatedPdm`) and add it to the context object. Example pattern:

```ts
const result = lowerToSqlite(rel, {
  predicateOptionalParams: new Set(...),
  pdm,
  qsm,  // NEW
});
```

If qsm isn't available at a call site, it probably shouldn't be lowering a graph with dot-nav — investigate before making qsm optional.

- [ ] **Step 3: Typecheck**

Run: `pnpm -w typecheck`
Expected: Passes in all packages.

---

## Task 14: Semantic validate — NAV_PROJECTION_REQUIRED gate

**Files:**
- Modify: `packages/graph-ir-compiler/src/validate/semantic/sources.ts` (or wherever dot-nav paths are first observed)

- [ ] **Step 1: Read current sources.ts and map/filter paths logic**

Run: `cat packages/graph-ir-compiler/src/validate/semantic/sources.ts`
Expected: `resolveSources` returns source bindings; understand where it falls back to PDM-only entity (not a projection).

- [ ] **Step 2: Write synthetic failing test first**

Create `packages/graph-ir-compiler/test/unit/validate/semantic/nav-projection-required.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { validateStructural as validateQsmStructural } from '@rntme/qsm/validate/structural';
import { validateCrossRef as validateQsmCrossRef } from '@rntme/qsm/validate/cross-ref';
import { createPdmResolver, validatePdm, parsePdm } from '@rntme/pdm';
import { validateSemantic } from '../../../../src/validate/semantic/index.js';
import { normalize } from '../../../../src/canonical/normalize.js';

const rawPdm = {
  entities: {
    Foo: {
      table: 'foos',
      fields: {
        id: { type: 'integer', nullable: false, column: 'id' },
        barId: { type: 'integer', nullable: false, column: 'bar_id' },
        status: { type: 'string', nullable: false, column: 'status' },
      },
      relations: {
        bar: { to: 'Bar', cardinality: 'one', localKey: 'barId', foreignKey: 'id' },
      },
      keys: ['id'],
      stateMachine: {
        stateField: 'status',
        initial: null,
        states: ['active'],
        transitions: { create: { from: null, to: 'active', affects: ['barId'] } },
      },
    },
    Bar: {
      table: 'bars',
      fields: {
        id: { type: 'integer', nullable: false, column: 'id' },
        name: { type: 'string', nullable: false, column: 'name' },
      },
      relations: {},
      keys: ['id'],
    },
  },
};

// QSM has NO projection for Foo — so scan on "Foo" can't resolve to a projection.
const rawQsm = { projections: {}, relations: {} };

const graphWithDotNav = {
  id: 'g',
  signature: { inputs: {}, output: { type: 'rowset<FooView>', from: 'proj' } },
  nodes: [
    { id: 'items', type: 'findMany', config: { source: { entity: 'Foo' } } },
    { id: 'proj', type: 'map', config: {
        input: 'items', into: 'FooView',
        fields: { name: 'foo.bar.name' },
    }},
  ],
};

describe('semantic validate — NAV_PROJECTION_REQUIRED', () => {
  it('flags dot-nav from scan that has no entity-mirror projection', () => {
    const pdm = validatePdm(parsePdm(rawPdm).value);
    const pdmR = createPdmResolver(pdm.value);
    const s = validateQsmStructural(rawQsm);
    const qsm = validateQsmCrossRef(s.value, pdmR).value;

    const { graphs } = normalize({
      shapes: { FooView: { fields: { name: { type: 'string', nullable: true } } } },
      graphs: { g: graphWithDotNav },
    });
    const res = validateSemantic(graphs.g, pdm.value, qsm);
    expect(res.ok).toBe(false);
    expect(res.errors.map((e) => e.code)).toContain('NAV_PROJECTION_REQUIRED');
  });
});
```

(Exact imports may need adjusting based on package exports; implementer verifies.)

- [ ] **Step 3: Run test — confirm it fails**

Run: `pnpm -w --filter @rntme/graph-ir-compiler test -- nav-projection-required`
Expected: FAIL — `NAV_PROJECTION_REQUIRED` not in errors (gate not implemented yet).

- [ ] **Step 4: Implement the gate in sources.ts (or the semantic-validate orchestrator)**

Implementation strategy:
1. After `resolveSources` builds the scan → entity map, look up entity-mirror for each scan via `qsmResolver.findEntityMirror(entity)`.
2. If `findEntityMirror(entity)` returns `null`, record that scan as "projection-less".
3. Walk all graph nodes; for `map.fields`, `filter.expr`, `sort.by`, `project.cols` — collect all dot-path references.
4. For each dot-path with `parts.length >= 3` (scan.alias + one relation + one field = 3 parts minimum for dot-nav), check if the scan for that alias is projection-less. If yes, emit `NAV_PROJECTION_REQUIRED`.

The error goes into the semantic validation `Result<>` errors array with layer `'semantic'`.

- [ ] **Step 5: Re-run test — expect PASS**

Run: `pnpm -w --filter @rntme/graph-ir-compiler test -- nav-projection-required`
Expected: PASS.

- [ ] **Step 6: Typecheck + all compiler tests**

Run: `pnpm -w --filter @rntme/graph-ir-compiler typecheck && pnpm -w --filter @rntme/graph-ir-compiler test`
Expected: typecheck PASS; most tests still FAIL (fixtures missing relations — next tasks).

---

## Task 15: Compiler unit tests for joins.ts (QSM-based)

**Files:**
- Modify: `packages/graph-ir-compiler/test/unit/lower/sqlite/` — update existing tests that use `expandChain`/`chainToSqlJoins`
- Create: `packages/graph-ir-compiler/test/unit/lower/sqlite/joins-qsm.test.ts`

- [ ] **Step 1: Write test — single-hop dot-nav**

Create `joins-qsm.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { expandChain, chainToSqlJoins } from '../../../../src/lower/sqlite/joins.js';
// Use miniPdm + miniQsm fixtures inline

describe('expandChain — QSM-based', () => {
  it('builds single-hop chain from IssueView to ProjMirror', () => {
    const chain = expandChain('issue', 'IssueView', ['issue', 'project'], miniQsm, miniPdm);
    expect(chain.steps).toHaveLength(1);
    expect(chain.steps[0]).toMatchObject({
      relation: 'project',
      fromProjection: 'IssueView',
      toProjection: 'ProjMirror',
      localKey: 'project_id',
      foreignKey: 'id',
      cardinality: 'one',
    });
  });

  it('throws NAV_NOT_ALLOWED for undeclared relation', () => {
    expect(() => expandChain('issue', 'IssueView', ['issue', 'unknown'], miniQsm, miniPdm))
      .toThrow(/NAV_NOT_ALLOWED/);
  });

  it('throws NAV_FAN_OUT_NOT_ALLOWED for many-cardinality', () => {
    const qsmWithMany = {
      ...miniQsm,
      relations: {
        ...miniQsm.relations,
        'IssueView.comments': { to: 'CommentMirror', localKey: 'issueId', foreignKey: 'id', cardinality: 'many' },
      },
    };
    expect(() => expandChain('issue', 'IssueView', ['issue', 'comments'], qsmWithMany, miniPdm))
      .toThrow(/NAV_FAN_OUT_NOT_ALLOWED/);
  });
});
```

Full fixture content: the implementer fills `miniPdm`/`miniQsm` with minimal Issue + Project entities and one cross-ref relation.

- [ ] **Step 2: Run — expect PASS (logic already implemented)**

Run: `pnpm -w --filter @rntme/graph-ir-compiler test -- joins-qsm`
Expected: PASS.

- [ ] **Step 3: Find and migrate existing joins tests**

Run: `grep -rn --include='*.ts' 'expandChain\|chainToSqlJoins' packages/graph-ir-compiler/test/`
Expected: List files. Migrate each: the existing tests called these with `pdm` only — now need `(startAlias, startProjection, path, qsm, pdm)` and `(chain, qsm, pdm)`.

---

## Task 16: Migrate fixture `issue-pdm.ts`

**Files:**
- Modify: `packages/graph-ir-compiler/test/unit/fixtures/issue-pdm.ts:49`

- [ ] **Step 1: Read current fixture**

Run: `cat packages/graph-ir-compiler/test/unit/fixtures/issue-pdm.ts`
Expected: See `RAW_ISSUE_QSM_EMPTY` with `relationRoles: {}`.

- [ ] **Step 2: Update**

Change `RAW_ISSUE_QSM_EMPTY` to:

```ts
export const RAW_ISSUE_QSM_EMPTY = { projections: {}, relations: {} } as const;
```

- [ ] **Step 3: Typecheck**

Run: `pnpm -w --filter @rntme/graph-ir-compiler typecheck`
Expected: Passes.

---

## Task 17: Migrate fixture `execute-read-prelude.test.ts`

**Files:**
- Modify: `packages/graph-ir-compiler/test/unit/command-runtime/execute-read-prelude.test.ts:29`

- [ ] **Step 1: Change `relationRoles: {}` to `relations: {}`**

In-place edit — replace the single line.

- [ ] **Step 2: Run test**

Run: `pnpm -w --filter @rntme/graph-ir-compiler test -- execute-read-prelude`
Expected: PASS.

---

## Task 18: Migrate fixture `sources.test.ts`

**Files:**
- Modify: `packages/graph-ir-compiler/test/unit/validate/semantic/sources.test.ts:78`

- [ ] **Step 1: Change `relationRoles: {}` to `relations: {}`**

- [ ] **Step 2: Run test**

Run: `pnpm -w --filter @rntme/graph-ir-compiler test -- sources`
Expected: PASS.

---

## Task 19: Migrate fixture `compile-composite-key.test.ts`

**Files:**
- Modify: `packages/projection-consumer/test/unit/compile-composite-key.test.ts:43`

- [ ] **Step 1: Change `relationRoles: {}` to `relations: {}`**

- [ ] **Step 2: Run test**

Run: `pnpm -w --filter @rntme/projection-consumer test -- compile-composite-key`
Expected: PASS.

---

## Task 20: Migrate `projection-consumer/test/fixtures/issue-tracker.qsm.json`

**Files:**
- Modify: `packages/projection-consumer/test/fixtures/issue-tracker.qsm.json:22-27`

- [ ] **Step 1: Replace relationRoles with relations**

Replace lines 22-27 (`"relationRoles": { ... }`) with:

```json
"relations": {
  "IssueView.project":  { "to": "project_mirror", "localKey": "projectId",  "foreignKey": "id", "cardinality": "one", "role": "dimension" },
  "IssueView.reporter": { "to": "user_mirror",    "localKey": "reporterId", "foreignKey": "id", "cardinality": "one", "role": "dimension" },
  "IssueView.assignee": { "to": "user_mirror",    "localKey": "assigneeId", "foreignKey": "id", "cardinality": "one", "role": "dimension" },
  "IssueView.sprint":   { "to": "sprint_mirror",  "localKey": "sprintId",   "foreignKey": "id", "cardinality": "one", "role": "dimension" }
}
```

Wait — this fixture has only `IssueView` projection. `project_mirror`, `user_mirror`, `sprint_mirror` don't exist here. **Investigate first:**

Run: `cat packages/projection-consumer/test/fixtures/issue-tracker.qsm.json`
Expected: Verify projections list.

If only `IssueView` exists in this fixture, the old `relationRoles` entries were annotation-only on PDM relations with no corresponding QSM projection — they were effectively unused. Choices:
- (a) Add stub projections for Project/User/Sprint (breaks minimalism).
- (b) Drop the relations entries from this fixture (they don't declare structural joins, just unused annotations).

**Choose (b): just write `"relations": {}`** — nothing in this fixture test consumes the old annotations meaningfully.

- [ ] **Step 2: Replace with empty relations**

Replace relationRoles block with:

```json
"relations": {}
```

- [ ] **Step 3: Run projection-consumer tests**

Run: `pnpm -w --filter @rntme/projection-consumer test`
Expected: PASS.

---

## Task 21: Migrate golden `category-sales/qsm.json`

**Files:**
- Modify: `packages/graph-ir-compiler/test/golden/category-sales/qsm.json`

- [ ] **Step 1: Read golden graphs to determine which relations are actually walked**

Run: `grep -rn 'orderItem\.\|order\.\|product\.\|category\.' packages/graph-ir-compiler/test/golden/category-sales/`
Expected: Discover what dot-nav paths are used. Pivot — category-sales likely uses `orderItem.order.*`, `orderItem.product.category.name`, etc.

- [ ] **Step 2: Extend qsm.json with needed projections and relations**

The golden QSM currently only has `CategorySalesMirror` (on OrderItem, table `order_items`). For dot-nav to work via QSM, every intermediate projection must exist. Options:
- (a) Add stub entity-mirror projections `Order`, `Product`, `Category` (their default table names would be `projection_order`, etc., which won't match PDM tables `orders`, `products`, `categories`).
- (b) Add explicit `table` overrides.

**Choose (b).** Update the golden QSM to:

```json
{
  "projections": {
    "CategorySalesMirror": {
      "backing": "entity-mirror",
      "source": { "entity": "OrderItem" },
      "keys": ["id"],
      "grain": ["id"],
      "exposed": ["id", "orderId", "productId", "quantity", "unitPrice"],
      "table": "order_items"
    },
    "OrderMirror": {
      "backing": "entity-mirror",
      "source": { "entity": "Order" },
      "keys": ["id"],
      "grain": ["id"],
      "exposed": ["id", "createdAt"],
      "table": "orders"
    },
    "ProductMirror": {
      "backing": "entity-mirror",
      "source": { "entity": "Product" },
      "keys": ["id"],
      "grain": ["id"],
      "exposed": ["id", "categoryId", "name"],
      "table": "products"
    },
    "CategoryMirror": {
      "backing": "entity-mirror",
      "source": { "entity": "Category" },
      "keys": ["id"],
      "grain": ["id"],
      "exposed": ["id", "name"],
      "table": "categories"
    }
  },
  "relations": {
    "CategorySalesMirror.order":   { "to": "OrderMirror",    "localKey": "orderId",    "foreignKey": "id", "cardinality": "one", "role": "fact" },
    "CategorySalesMirror.product": { "to": "ProductMirror",  "localKey": "productId",  "foreignKey": "id", "cardinality": "one", "role": "dimension" },
    "ProductMirror.category":      { "to": "CategoryMirror", "localKey": "categoryId", "foreignKey": "id", "cardinality": "one", "role": "dimension" }
  }
}
```

- [ ] **Step 3: Ensure PDM has stateMachine for Order/Product/Category (required for entity-mirror)**

Run: `cat packages/graph-ir-compiler/test/golden/category-sales/pdm.json | grep -A3 stateMachine`
Expected: Check if stateMachines exist on Order/Product/Category. If not, cross-ref will fail with `QSM_XREF_ENTITY_MIRROR_REQUIRES_STATE_MACHINE`. Two options:

- (a) Add minimal stateMachines to PDM (one transition each — but PDM is authoritative, modifying shouldn't be casual).
- (b) Keep these projections but mark them as some backing that doesn't require stateMachine.

**Actually — this is a deep problem.** The golden fixture wasn't designed to support multi-projection QSM. Reconsider:

Alternative approach: the golden graph `category-sales` goes through dot-nav like `orderItem.product.category.name`. If we don't have projections for product/category, NAV_NOT_ALLOWED fires. Three ways forward:

1. Extend PDM with stateMachines (intrusive, not ideal — golden is a test fixture).
2. Mark golden projections with a test-only backing that skips stateMachine check. Not available in MVP.
3. Introduce a new projection backing `"read-only-mirror"` (entity-mirror without stateMachine requirement) — spec change, out of scope.
4. **Accept that golden SQL will change** for category-sales, because QSM is now the source of truth and we must explicitly declare the projections used. Add PDM stateMachines as part of this migration (scoped fix).

**Decision:** Go with (4). Add minimal stateMachines to Order/Product/Category in `category-sales/pdm.json`. This is acceptable because:
- PDM stateMachines are required for entity-mirrors (the only backing supported);
- The golden test's purpose is to exercise the compiler, not model a real domain;
- The SQL snapshot invariant applies to **all read-side graph SQL output** — the projection table names stay (`orders`, `products`, `categories`), so the emitted SQL remains byte-identical.

- [ ] **Step 4: Add stateMachines to Order/Product/Category in golden PDM**

Edit `packages/graph-ir-compiler/test/golden/category-sales/pdm.json`, add a single-transition stateMachine to each of Order, Product, Category:

```json
"Order": {
  "table": "orders",
  "fields": {
    "id": { "type": "integer", "nullable": false, "column": "id" },
    "createdAt": { "type": "datetime", "nullable": false, "column": "created_at" },
    "status": { "type": "string", "nullable": false, "column": "status" }
  },
  "relations": {},
  "keys": ["id"],
  "stateMachine": {
    "stateField": "status",
    "initial": null,
    "states": ["active"],
    "transitions": {
      "create": { "from": null, "to": "active", "affects": ["createdAt"] }
    }
  }
},
```

Same pattern for Product (add `status` field + stateMachine) and Category (same). The column `status` is new — stateMachines require it.

- [ ] **Step 5: Run golden tests**

Run: `pnpm -w --filter @rntme/graph-ir-compiler test -- golden`
Expected: Expect SQL snapshot diff for category-sales (because PDM was extended with `status` columns). Adjust expected SQL to include the new exposed status column if the mirror DDL emits it, or update the `exposed` list to NOT include status. **Preserve the invariant by NOT exposing status** — just add it as internal field required for stateMachine.

If golden snapshots have hard-coded SQL that no longer matches, carefully review each diff and confirm it reflects only the fixture extension (adding `status` column handling in DDL), not the compiler path itself.

---

## Task 22: Migrate demo `qsm.json` (Phase 1 minimum)

**Files:**
- Modify: `demo/issue-tracker-api/artifacts/qsm.json`

- [ ] **Step 1: Replace relationRoles with minimal relations**

Replace `"relationRoles": {}` (line 69) with:

```json
"relations": {
  "IssueView.project":  { "to": "project_mirror", "localKey": "projectId",  "foreignKey": "id", "cardinality": "one", "role": "dimension" },
  "IssueView.reporter": { "to": "user_mirror",    "localKey": "reporterId", "foreignKey": "id", "cardinality": "one", "role": "dimension" },
  "IssueView.assignee": { "to": "user_mirror",    "localKey": "assigneeId", "foreignKey": "id", "cardinality": "one", "role": "dimension" }
}
```

These 3 cover `issueDetail` + `issuesByProject` (which uses `issue.project.key`).

- [ ] **Step 2: Run demo tests**

Run: `pnpm -w --filter demo-issue-tracker-api test`
Expected: PASS. All existing behavior preserved.

---

## Task 23: Phase 1 invariant check — all tests + typecheck

- [ ] **Step 1: Run full workspace tests**

Run: `pnpm -w test`
Expected: All PASS. If any fail, fix fixture or code.

- [ ] **Step 2: Run full typecheck**

Run: `pnpm -w typecheck`
Expected: All PASS.

- [ ] **Step 3: Run demo smoke specifically and inspect response**

Run: `pnpm -w --filter demo-issue-tracker-api test -- smoke`
Expected: PASS. Especially confirm `issueDetail` response has `projectKey`/`projectName`/`reporterUsername`/`assigneeUsername` — proves new compiler path produces correct SQL for single-hop dot-nav.

---

## Task 24: Update `graph_ir_rc_7.md`

**Files:**
- Modify: `graph_ir_rc_7.md:60`

- [ ] **Step 1: Edit Section 2.2**

Line 60:
- Before: `- semantic relation roles;`
- After: `- read-side relation graph (structural + role annotation);`

- [ ] **Step 2: Add QSM.relations subsection**

Find the QSM schema description (search `"projections"` or `QSM` section that describes JSON shape). Below the projections description, add:

```markdown
### relations (top-level QSM field)

`relations` — top-level flat map с ключами формы `"<ProjectionName>.<relationName>"`.

Каждая запись:

```json
{
  "to": "<TargetProjectionName>",
  "localKey": "<fieldNameOnSourceEntity>",
  "foreignKey": "<fieldNameOnTargetEntity>",
  "cardinality": "one" | "many",
  "role": "fact" | "dimension"  // optional
}
```

**Правила:**
- `<relationName>` обязан совпадать с именем relation на source entity PDM (цепь валидируется cross-ref'ом).
- `to` указывает на projection (не на entity). Таблица резолвится как `qsm.projections[to].table`.
- `localKey`/`foreignKey` — field names (не column names). Column resolution — через PDM.
- Single-hop only. Multi-hop dot-nav (`a.b.c.field`) требует объявления каждого hop как отдельной записи.
- `cardinality: "many"` компилятор отклоняет на lowering (`NAV_FAN_OUT_NOT_ALLOWED`) — зарезервировано под будущий `expandMany` node.
- `role` — аннотация, compiler не консультирует.

**Cross-validation (B2):** значения `to` (через projection → source entity), `localKey`, `foreignKey`, `cardinality` обязаны соответствовать одноимённой PDM relation. PDM — источник истины.

Поле `relationRoles` (было в rc6) удалено. Аннотационный `role` переехал внутрь записи `relations[...]`.
```

(Точное место подсекции — определяется при написании.)

- [ ] **Step 3: Verify**

No tests on rc7.md — it's documentation. Review diff manually.

---

## Task 25: Phase 1 commit

- [ ] **Step 1: Stage and commit**

```bash
git add -A
git diff --cached --stat  # review scope
git commit -m "refactor(qsm,compiler): move read-side relation metadata from PDM to QSM

- QSM: replace \`relationRoles\` with structural \`relations\` (to, localKey, foreignKey, cardinality, role?)
- Compiler: joins.ts and lower.ts read QSM.relations for dot-nav; PDM used only for field→column
- Validate: B2 cross-ref enforces QSM.relations consistency with PDM
- New error codes: NAV_NOT_ALLOWED, NAV_FAN_OUT_NOT_ALLOWED, NAV_PROJECTION_REQUIRED
- Fixtures migrated; invariant byte-identical SQL preserved for existing graphs
- Demo qsm.json gets 3 relations under issueDetail + issuesByProject

Ref: docs/superpowers/specs/done/2026-04-16-qsm-relations-migration-design.md"
```

- [ ] **Step 2: Confirm clean tree**

Run: `git status`
Expected: `nothing to commit, working tree clean`.

---

# Phase 2 — Demo enrichment via new path

## Task 26: Add `IssueListItem` shape

**Files:**
- Modify: `demo/issue-tracker-api/artifacts/shapes.json`

- [ ] **Step 1: Add IssueListItem shape**

Edit `shapes.json`, add alongside existing shapes (before `"ProjectStats"` or wherever fits alphabetically):

```json
"IssueListItem": {
  "fields": {
    "id":               { "type": "integer",  "nullable": false },
    "title":            { "type": "string",   "nullable": false },
    "status":           { "type": "string",   "nullable": false },
    "priority":         { "type": "string",   "nullable": false },
    "storyPoints":      { "type": "integer",  "nullable": false },
    "createdAt":        { "type": "datetime", "nullable": false },
    "resolvedAt":       { "type": "datetime", "nullable": true  },
    "projectKey":       { "type": "string",   "nullable": true  },
    "projectName":      { "type": "string",   "nullable": true  },
    "reporterUsername": { "type": "string",   "nullable": true  },
    "assigneeUsername": { "type": "string",   "nullable": true  },
    "sprintName":       { "type": "string",   "nullable": true  }
  }
},
```

- [ ] **Step 2: Typecheck/validate demo artifact**

Run: `pnpm -w --filter demo-issue-tracker-api test -- validate`
Expected: PASS (or if no validate test exists, skip).

---

## Task 27: Extend demo `qsm.json` with `IssueView.sprint`

**Files:**
- Modify: `demo/issue-tracker-api/artifacts/qsm.json`

- [ ] **Step 1: Add sprint relation**

Append inside the `relations` block:

```json
"IssueView.sprint": { "to": "sprint_mirror", "localKey": "sprintId", "foreignKey": "id", "cardinality": "one", "role": "dimension" }
```

(Remember trailing comma handling.)

Full `relations` block after this:

```json
"relations": {
  "IssueView.project":  { "to": "project_mirror", "localKey": "projectId",  "foreignKey": "id", "cardinality": "one", "role": "dimension" },
  "IssueView.reporter": { "to": "user_mirror",    "localKey": "reporterId", "foreignKey": "id", "cardinality": "one", "role": "dimension" },
  "IssueView.assignee": { "to": "user_mirror",    "localKey": "assigneeId", "foreignKey": "id", "cardinality": "one", "role": "dimension" },
  "IssueView.sprint":   { "to": "sprint_mirror",  "localKey": "sprintId",   "foreignKey": "id", "cardinality": "one", "role": "dimension" }
}
```

- [ ] **Step 2: Run demo tests**

Run: `pnpm -w --filter demo-issue-tracker-api test`
Expected: PASS (sprint relation is declared but not yet used by any graph).

---

## Task 28: Write e2e test for list enrichment (expect to fail)

**Files:**
- Create: `demo/issue-tracker-api/test/list-enrichment-e2e.test.ts`

- [ ] **Step 1: Read smoke.test.ts for server boot pattern**

Run: `cat demo/issue-tracker-api/test/smoke.test.ts | head -60`
Expected: Understand how the test spawns `tsx src/server.ts`, waits for readiness, and makes HTTP calls.

- [ ] **Step 2: Write the failing e2e test**

Create `demo/issue-tracker-api/test/list-enrichment-e2e.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';

const PORT = 3013;
const BASE = `http://127.0.0.1:${PORT}`;

let server: ChildProcess;

async function waitForReady(url: string, timeoutMs = 15000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {
      // keep trying
    }
    await new Promise((res) => setTimeout(res, 200));
  }
  throw new Error(`Server did not become ready at ${url}`);
}

beforeAll(async () => {
  server = spawn('pnpm', ['tsx', 'src/server.ts'], {
    env: { ...process.env, PORT: String(PORT) },
    stdio: 'pipe',
  });
  await waitForReady(`${BASE}/health`);
});

afterAll(() => {
  server.kill();
});

describe('list/search enrichment', () => {
  it('listIssues returns enriched fields', async () => {
    const r = await fetch(`${BASE}/v1/issues?limit=5`);
    expect(r.status).toBe(200);
    const body = (await r.json()) as unknown[];
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
    for (const it of body as Record<string, unknown>[]) {
      expect(it).toHaveProperty('id');
      expect(it).toHaveProperty('title');
      expect(it).toHaveProperty('projectKey');
      expect(it).toHaveProperty('projectName');
      expect(it).toHaveProperty('reporterUsername');
      expect(it).toHaveProperty('assigneeUsername');
      expect(it).toHaveProperty('sprintName');
      // Spot-check types when present
      if (it.projectKey !== null) expect(typeof it.projectKey).toBe('string');
    }
  });

  it('searchIssues returns enriched fields with predicate_optional priority missing', async () => {
    const r = await fetch(`${BASE}/v1/issues/search?q=a&limit=5`);
    expect(r.status).toBe(200);
    const body = (await r.json()) as Record<string, unknown>[];
    for (const it of body) {
      expect(it).toHaveProperty('projectKey');
      expect(it).toHaveProperty('reporterUsername');
    }
  });

  it('searchIssues returns enriched fields with priority provided', async () => {
    const r = await fetch(`${BASE}/v1/issues/search?q=a&priority=high&limit=5`);
    expect(r.status).toBe(200);
    const body = (await r.json()) as Record<string, unknown>[];
    for (const it of body) {
      expect(it).toHaveProperty('projectKey');
    }
  });
});
```

- [ ] **Step 3: Run test — confirm it fails**

Run: `pnpm -w --filter demo-issue-tracker-api test -- list-enrichment-e2e`
Expected: FAIL. Output should show missing `projectKey` (or similar) in response — graphs haven't been updated yet.

---

## Task 29: Add enriched map to `listIssues.json`

**Files:**
- Modify: `demo/issue-tracker-api/artifacts/graphs/listIssues.json`

- [ ] **Step 1: Add enriched node and change output**

Current output: `{ "type": "rowset<Issue>", "from": "paged" }`. Full file after edit:

```json
{
  "id": "listIssues",
  "signature": {
    "inputs": {
      "status": { "type": "string", "mode": "predicate_optional" },
      "limit": { "type": "integer", "mode": "defaulted", "default": 20 }
    },
    "output": { "type": "rowset<IssueListItem>", "from": "enriched" }
  },
  "nodes": [
    { "id": "items", "type": "findMany", "config": { "source": { "entity": "Issue" } } },
    {
      "id": "filtered",
      "type": "filter",
      "config": {
        "input": "items",
        "expr": { "eq": ["issue.status", { "$param": "status" }] }
      }
    },
    {
      "id": "sorted",
      "type": "sort",
      "config": {
        "input": "filtered",
        "by": [{ "field": "issue.createdAt", "dir": "desc", "nulls": "last" }]
      }
    },
    {
      "id": "paged",
      "type": "limit",
      "config": { "input": "sorted", "count": { "$param": "limit" } }
    },
    {
      "id": "enriched",
      "type": "map",
      "config": {
        "input": "paged",
        "into": "IssueListItem",
        "fields": {
          "id": "issue.id",
          "title": "issue.title",
          "status": "issue.status",
          "priority": "issue.priority",
          "storyPoints": "issue.storyPoints",
          "createdAt": "issue.createdAt",
          "resolvedAt": "issue.resolvedAt",
          "projectKey": "issue.project.key",
          "projectName": "issue.project.name",
          "reporterUsername": "issue.reporter.username",
          "assigneeUsername": "issue.assignee.username",
          "sprintName": "issue.sprint.name"
        }
      }
    }
  ]
}
```

- [ ] **Step 2: Run e2e test for listIssues only**

Run: `pnpm -w --filter demo-issue-tracker-api test -- 'listIssues returns enriched'`
Expected:
- If compiler handles `filter → sort → limit → map(dot-nav)` correctly: PASS.
- If compiler emits JOIN before LIMIT: rows are limited incorrectly (enrichment loses rows or duplicates). Test may pass structural shape but fail on row count or specific field values.

**Manual inspection:** capture the emitted SQL by inserting a `console.log` in `lowerToSqlite` temporarily, or run `pnpm explain listIssues` if such CLI exists. Verify SQL shape.

- [ ] **Step 3: Decide — compiler fix needed?**

If generated SQL is `SELECT ... FROM projection_issue LEFT JOIN ... WHERE ... ORDER BY ... LIMIT ?` (JOIN before LIMIT) and results are functionally incorrect — proceed to Task 30.

If SQL is already `SELECT ... FROM (SELECT ... FROM projection_issue WHERE ... ORDER BY ... LIMIT ?) AS limited LEFT JOIN ...` — skip Task 30.

---

## Task 30: Fix compiler `map-after-limit` (if needed)

**Files:**
- Modify: `packages/graph-ir-compiler/src/lower/sqlite/lower.ts`

- [ ] **Step 1: Write compiler unit test first**

Create/append to `packages/graph-ir-compiler/test/unit/lower/sqlite/map-after-limit.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { lowerToSqlite } from '../../../../src/lower/sqlite/lower.js';
// Build a minimal RelOp: Scan → Filter → Sort → Limit → Project(dot-nav)
// Assert AST shape: outer SELECT with subquery in FROM

describe('lower: map-with-dot-nav after limit', () => {
  it('wraps Scan→Filter→Sort→Limit in subquery when Project adds JOIN via dot-nav', () => {
    // Full code: build RelOp, lower, assert ast.from.kind === 'subquery' or similar
  });
});
```

- [ ] **Step 2: Run test — expect fail**

Run: `pnpm -w --filter @rntme/graph-ir-compiler test -- map-after-limit`
Expected: FAIL.

- [ ] **Step 3: Implement fix**

In `lower.ts`, locate the `Project` case (around line 97-115). When the child is a `Limit` (or a subtree containing Limit) AND the project introduces joins via dot-nav — emit the child as a subquery and add JOINs at outer level.

Current `toSelect` builds the child first; `makeColumnOf` mutates `child.joins` when it encounters dot-nav. If the child already has LIMIT set, we need to wrap.

Sketch:

```ts
case 'Project': {
  const child = toSelect(rel.child, paramOrder, context);
  const scanMeta = findScanMeta(rel);
  // Detect if child has a LIMIT (means we're Project-after-Limit)
  const childHasLimit = child.limit !== undefined;

  const outerAlias = 'outer_source';
  const projected: SqlSelect = childHasLimit
    ? {
        kind: 'select',
        from: { subquery: child, alias: outerAlias },
        joins: [],
        columns: [],
      }
    : child;

  const columnOf = makeColumnOf(
    childHasLimit
      ? { ...scanMeta, alias: outerAlias }  // joins attach to outer select
      : scanMeta,
    projected,
    context,
    relOutputColumns(rel.child),
  );

  // For each Project column, lower expression using columnOf
  projected.columns = Object.entries(rel.cols).map(([alias, expr]) => ({
    expr: lowerExpr(expr as Expr, { alias: childHasLimit ? outerAlias : scanMeta.alias, columnOf, paramOrder }),
    alias,
  }));
  return projected;
}
```

**Important:** `SqlSelect.from` must support `{ subquery: SqlSelect; alias: string }` in addition to `{ table: string; alias: string }`. Inspect `ast.ts` and extend if needed:

```ts
export type SqlFrom =
  | { table: string; alias: string }
  | { subquery: SqlSelect; alias: string };

export type SqlSelect = {
  kind: 'select';
  from: SqlFrom;
  joins: SqlJoin[];
  columns: Array<{ expr: SqlExpr; alias: string }>;
  where?: SqlExpr;
  having?: SqlExpr;
  groupBy?: SqlExpr[];
  orderBy?: Array<{ expr: SqlExpr; dir: 'asc' | 'desc'; nulls?: 'first' | 'last' }>;
  limit?: SqlExpr;
};
```

The SQL emitter (`emit.ts`) must render subquery form: `FROM (SELECT ...) AS alias`.

- [ ] **Step 4: Run unit test — expect pass**

Run: `pnpm -w --filter @rntme/graph-ir-compiler test -- map-after-limit`
Expected: PASS.

- [ ] **Step 5: Run e2e test — expect pass**

Run: `pnpm -w --filter demo-issue-tracker-api test -- 'listIssues returns enriched'`
Expected: PASS.

- [ ] **Step 6: Run golden tests — confirm no regression**

Run: `pnpm -w --filter @rntme/graph-ir-compiler test -- golden`
Expected: PASS. No existing graph uses Project-after-Limit, so wrapping is only triggered when `childHasLimit`.

---

## Task 31: Add enriched map to `searchIssues.json`

**Files:**
- Modify: `demo/issue-tracker-api/artifacts/graphs/searchIssues.json`

- [ ] **Step 1: Add enriched node and update output**

Full file:

```json
{
  "id": "searchIssues",
  "signature": {
    "inputs": {
      "q": { "type": "string", "mode": "required" },
      "from": { "type": "datetime", "mode": "defaulted", "default": "1970-01-01T00:00:00.000Z" },
      "to": { "type": "datetime", "mode": "defaulted", "default": "9999-12-31T23:59:59.999Z" },
      "priority": { "type": "string", "mode": "predicate_optional" },
      "limit": { "type": "integer", "mode": "defaulted", "default": 20 }
    },
    "output": { "type": "rowset<IssueListItem>", "from": "enriched" }
  },
  "nodes": [
    { "id": "items", "type": "findMany", "config": { "source": { "entity": "Issue" } } },
    {
      "id": "baseFiltered",
      "type": "filter",
      "config": {
        "input": "items",
        "expr": {
          "and": [
            { "like": ["issue.title", { "$param": "q" }] },
            { "between": ["issue.createdAt", { "$param": "from" }, { "$param": "to" }] }
          ]
        }
      }
    },
    {
      "id": "priorityFiltered",
      "type": "filter",
      "config": {
        "input": "baseFiltered",
        "expr": { "eq": ["issue.priority", { "$param": "priority" }] }
      }
    },
    {
      "id": "sorted",
      "type": "sort",
      "config": {
        "input": "priorityFiltered",
        "by": [{ "field": "issue.createdAt", "dir": "desc", "nulls": "last" }]
      }
    },
    {
      "id": "paged",
      "type": "limit",
      "config": { "input": "sorted", "count": { "$param": "limit" } }
    },
    {
      "id": "enriched",
      "type": "map",
      "config": {
        "input": "paged",
        "into": "IssueListItem",
        "fields": {
          "id": "issue.id",
          "title": "issue.title",
          "status": "issue.status",
          "priority": "issue.priority",
          "storyPoints": "issue.storyPoints",
          "createdAt": "issue.createdAt",
          "resolvedAt": "issue.resolvedAt",
          "projectKey": "issue.project.key",
          "projectName": "issue.project.name",
          "reporterUsername": "issue.reporter.username",
          "assigneeUsername": "issue.assignee.username",
          "sprintName": "issue.sprint.name"
        }
      }
    }
  ]
}
```

- [ ] **Step 2: Run e2e tests for search**

Run: `pnpm -w --filter demo-issue-tracker-api test -- 'searchIssues returns enriched'`
Expected: Both variants (priority missing, priority provided) PASS.

---

## Task 32: Add enriched map to `listIssuesUi.json`

**Files:**
- Modify: `demo/issue-tracker-api/artifacts/graphs/listIssuesUi.json`

- [ ] **Step 1: Update file**

Full file:

```json
{
  "id": "listIssuesUi",
  "signature": {
    "inputs": {
      "limit": { "type": "integer", "mode": "defaulted", "default": 50 }
    },
    "output": { "type": "rowset<IssueListItem>", "from": "enriched" }
  },
  "nodes": [
    { "id": "items", "type": "findMany", "config": { "source": { "entity": "Issue" } } },
    {
      "id": "sorted",
      "type": "sort",
      "config": {
        "input": "items",
        "by": [{ "field": "issue.createdAt", "dir": "desc", "nulls": "last" }]
      }
    },
    {
      "id": "paged",
      "type": "limit",
      "config": { "input": "sorted", "count": { "$param": "limit" } }
    },
    {
      "id": "enriched",
      "type": "map",
      "config": {
        "input": "paged",
        "into": "IssueListItem",
        "fields": {
          "id": "issue.id",
          "title": "issue.title",
          "status": "issue.status",
          "priority": "issue.priority",
          "storyPoints": "issue.storyPoints",
          "createdAt": "issue.createdAt",
          "resolvedAt": "issue.resolvedAt",
          "projectKey": "issue.project.key",
          "projectName": "issue.project.name",
          "reporterUsername": "issue.reporter.username",
          "assigneeUsername": "issue.assignee.username",
          "sprintName": "issue.sprint.name"
        }
      }
    }
  ]
}
```

- [ ] **Step 2: Run demo tests**

Run: `pnpm -w --filter demo-issue-tracker-api test`
Expected: PASS including any UI-related tests.

---

## Task 33: Update `smoke.test.ts` assertions

**Files:**
- Modify: `demo/issue-tracker-api/test/smoke.test.ts`

- [ ] **Step 1: Inspect current smoke assertions on list endpoints**

Run: `grep -n 'listIssues\|/v1/issues' demo/issue-tracker-api/test/smoke.test.ts`
Expected: Identify asserts that check `rowset<Issue>` fields (raw `projectId`, `reporterId`, etc.). These need to expect `IssueListItem` fields now (`projectKey`, `reporterUsername`).

- [ ] **Step 2: Update assertions**

For each `GET /v1/issues` or `GET /v1/issues/search` assertion, replace expectations of raw FK IDs with enriched field names. Keep any assertions that are about non-FK fields (title, status, id) unchanged.

- [ ] **Step 3: Run smoke**

Run: `pnpm -w --filter demo-issue-tracker-api test -- smoke`
Expected: PASS.

---

## Task 34: Full workspace check and Phase 2 commit

- [ ] **Step 1: Full tests**

Run: `pnpm -w test`
Expected: All PASS.

- [ ] **Step 2: Full typecheck**

Run: `pnpm -w typecheck`
Expected: All PASS.

- [ ] **Step 3: Full lint**

Run: `pnpm -w lint`
Expected: PASS. Fix any lint issues inline.

- [ ] **Step 4: Commit Phase 2**

```bash
git add -A
git diff --cached --stat  # review scope
git commit -m "feat(demo): enrich listIssues/listIssuesUi/searchIssues via QSM.relations

- Add IssueListItem shape with nullable enriched fields (projectKey/projectName/reporterUsername/assigneeUsername/sprintName)
- Add enriched map node (dot-nav issue.project.key etc.) to three list/search graphs
- Extend demo qsm.json with IssueView.sprint relation
- New e2e list-enrichment-e2e.test.ts covers predicate_optional variants
- Compiler: wrap subtree in subquery when Project-after-Limit introduces JOINs (if needed)

Ref: docs/superpowers/specs/done/2026-04-16-qsm-relations-migration-design.md"
```

- [ ] **Step 5: Verify**

Run: `git log --oneline -5`
Expected: See both commits (Phase 1 refactor + Phase 2 feat).

---

## Final sanity: PR

- [ ] **Step 1: Push branch**

```bash
git push -u origin qsm-relations-migration
```

- [ ] **Step 2: Create PR (if requested)**

Only if user explicitly asks — don't push automatically. Use `gh pr create` with summary from the spec's Decision section.

---

# Self-Review Checklist (completed during plan writing)

- [x] Every spec section has at least one task covering it.
- [x] No "TBD"/"TODO"/"add error handling" placeholders.
- [x] Type names consistent: `QsmRelation`, `ResolvedRelation`, `LowerContext.qsm`, error codes match everywhere.
- [x] Every TDD cycle: failing test → impl → passing test → commit.
- [x] Phase boundary honored — Phase 1 tasks do not alter demo graph semantics; Phase 2 tasks do not touch compiler relation infrastructure (except potentially Task 30 subquery wrap, which is scoped to one conditional case).
- [x] Spec coverage: schema (Task 3,4), validate (5,6), resolver (7,8), error codes (2,10), compiler (11,12,13,14,30), fixture migration (15-21), demo (22,27,29,31,32), rc7 spec (24), testing (15,28,29,33), rollout (25,34).
