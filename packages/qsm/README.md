# @rntme/qsm

Parser, validator, DDL generator, and handler-spec deriver for the **Query-Side Materialized** projections that form rntme's read-side. A QSM artifact declares a set of materialised tables (currently `backing: "entity-mirror"`), their keys/grain, and which fields are exposed to readers. Companion artifact to [`@rntme/pdm`](../pdm).

## Role in the system

- Depends on [`@rntme/pdm`](../pdm) for cross-reference validation (every projection source must be a PDM entity; every key / grain / exposed field must exist on that entity).
- Feeds [`@rntme/projection-consumer`](../projection-consumer): `generateProjectionDdl` produces the bootstrap DDL, `deriveProjectionHandler` produces per-event-type handler specs.
- Feeds [`@rntme/graph-ir-compiler`](../graph-ir-compiler) via `QsmResolver`: the semantic layer uses projections to pick source tables.

## Install

```bash
pnpm add @rntme/qsm @rntme/pdm zod
```

## Quick start

```ts
import { parsePdm, validatePdm, createPdmResolver } from '@rntme/pdm';
import {
  parseQsm,
  validateQsm,
  generateProjectionDdl,
  deriveProjectionHandler,
  createQsmResolver,
} from '@rntme/qsm';

const pdm = /* see @rntme/pdm readme */;
const validatedPdm = validatePdm(parsePdm(pdm).value!).value!;
const pdmResolver = createPdmResolver(validatedPdm);

const raw = {
  projections: {
    issues_projection: {
      backing: 'entity-mirror',
      source: { entity: 'Issue' },
      keys: ['id'],
      grain: ['id'],
      exposed: ['title', 'status', 'priority'],
      table: 'issues_projection',
    },
  },
  relationRoles: {
    // optional: map PDM relations to 'fact' | 'dimension' for query semantics
  },
};

const parsed = parseQsm(raw);
if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));

const validated = validateQsm(parsed.value, pdmResolver);
if (!validated.ok) throw new Error(JSON.stringify(validated.errors));

const ddl = generateProjectionDdl(validated.value, pdmResolver);
// ddl.tables[0].sql → CREATE TABLE issues_projection (…, last_event_version INTEGER NOT NULL, last_event_id TEXT)

const handler = deriveProjectionHandler(validated.value, pdmResolver);
// handler.byProjection.issues_projection.byEventType.IssueReport.op === 'insert'

const qsmResolver = createQsmResolver(validated.value);
```

## API

| Export | Signature | Purpose |
| ------ | --------- | ------- |
| `parseQsm` | `(raw: unknown) => Result<QsmArtifactParsed>` | Zod-driven structural parsing. |
| `QsmArtifactSchema` | `z.ZodSchema` | Raw Zod schema. |
| `validateStructural` | `(parsed) => Result<StructurallyValidQsm>` | Structural QSM-only rules (empty keys/grain/exposed, duplicate tables, relation-role key format). |
| `validateCrossRef` | `(structural, pdmResolver) => Result<ValidatedQsm>` | Cross-ref against PDM (entities/fields exist, entity-mirror constraints, duplicate mirrors, generated fields excluded from `exposed`). |
| `validateQsm` | `(parsed, pdmResolver) => Result<ValidatedQsm>` | Convenience: both validation layers with aggregated errors. |
| `generateProjectionDdl` | `(validated, pdmResolver) => ProjectionDdlSpec` | One DDL spec (CREATE TABLE + indexes) per projection, including `last_event_version` / `last_event_id` idempotency columns. |
| `deriveProjectionHandler` | `(validated, pdmResolver) => ProjectionHandlerSpec` | One handler spec per projection keyed by event type (insert/update/noop op, column bindings). |
| `createQsmResolver` | `(validated) => QsmResolver` | Pure-lookup resolver. |
| `defaultTableName` | `(projectionName: string) => string` | Default table-name algorithm (used when `table` is omitted). |
| `RELATION_ROLE_VALUES` | `readonly ['fact', 'dimension']` | Runtime-accessible role enum. |
| `ok`, `err`, `isOk`, `isErr`, `ERROR_CODES` | | `Result<T>` helpers and error-code registry. |

## Exported types

```ts
import type {
  // artifact
  QsmArtifact,
  StructurallyValidQsm,
  ValidatedQsm,
  Projection,
  ProjectionBacking,   // 'entity-mirror' | 'derived' — derived is parser-accepted, validator-rejected
  ProjectionSource,
  RelationRole,        // 'fact' | 'dimension'
  // DDL
  ProjectionDdlSpec,
  ColumnSpec,
  IndexSpec,
  SqlType,
  // handler
  ProjectionHandlerSpec,
  EventHandler,
  HandlerOp,           // 'insert' | 'update' | 'noop'
  IdempotencyGuard,
  // resolver
  QsmResolver,
  ResolvedProjection,
  ResolvedRelationRole,
  // result monad
  Result, QsmError, QsmErrorCode, Layer,
} from '@rntme/qsm';
```

`ValidatedQsm` is a branded type constructible only by the validators.

## Validation layers

`validateQsm` aggregates independent errors within each layer.

| Layer | Examples |
| ----- | -------- |
| `parse` | Zod shape errors. |
| `structural` | Empty/duplicate keys / grain / exposed; duplicate `table`; malformed `relationRoles` keys (must be `EntityName.relationName`). |
| `cross-ref` | `source.entity` exists in PDM; keys/grain/exposed fields exist on that entity; `exposed` excludes generated fields; entity-mirror projections require the entity to have a stateMachine and mirror `keys`/`grain` to match the entity's primary key; duplicate entity-mirror for same source is forbidden. |
| Feature-gate | `QSM_BACKING_DERIVED_NOT_SUPPORTED` — parser accepts `backing: "derived"`, validator rejects it. |

### Error codes (stable)

Parse: `QSM_PARSE_SCHEMA_VIOLATION`.

Structural: `QSM_STRUCT_PROJECTION_KEYS_EMPTY`, `QSM_STRUCT_PROJECTION_GRAIN_EMPTY`, `QSM_STRUCT_PROJECTION_EXPOSED_EMPTY`, `QSM_STRUCT_PROJECTION_DUPLICATE_KEY`, `QSM_STRUCT_PROJECTION_DUPLICATE_GRAIN`, `QSM_STRUCT_PROJECTION_DUPLICATE_EXPOSED`, `QSM_STRUCT_RELATION_ROLE_KEY_FORMAT`, `QSM_STRUCT_DUPLICATE_TABLE`.

Cross-ref: `QSM_XREF_SOURCE_UNKNOWN_ENTITY`, `QSM_XREF_KEY_UNKNOWN_FIELD`, `QSM_XREF_GRAIN_UNKNOWN_FIELD`, `QSM_XREF_EXPOSED_UNKNOWN_FIELD`, `QSM_XREF_EXPOSED_INCLUDES_GENERATED`, `QSM_XREF_ENTITY_MIRROR_REQUIRES_STATE_MACHINE`, `QSM_XREF_ENTITY_MIRROR_KEYS_MISMATCH`, `QSM_XREF_ENTITY_MIRROR_GRAIN_MISMATCH`, `QSM_XREF_RELATION_ROLE_UNKNOWN_ENTITY`, `QSM_XREF_RELATION_ROLE_UNKNOWN_RELATION`, `QSM_XREF_ENTITY_MIRROR_DUPLICATE`.

Feature gate: `QSM_BACKING_DERIVED_NOT_SUPPORTED`. Internal: `QSM_INTERNAL`.

## MVP scope

- Only `backing: "entity-mirror"` is valid. The projection mirrors an entity's exposed fields plus generated columns (`createdAt`, `updatedAt`, `actor`) and idempotency columns (`last_event_version INTEGER NOT NULL`, `last_event_id TEXT`).
- One projection per source entity (duplicate entity-mirror projections are rejected).
- `derived` projections are scaffolded for Tier 2 but not yet runnable.

## Spec

See [`docs/superpowers/specs/2026-04-14-mutations-design.md`](../../docs/superpowers/specs/2026-04-14-mutations-design.md) §6 for the authoritative spec.
