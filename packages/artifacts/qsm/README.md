# @rntme/qsm

Parser, validator, DDL generator, handler-spec deriver, and resolver for QSM (Query-Side Materialized) projection artifacts that define rntme's read-side mirrors.

In the project-first model, service-level QSM remains service-owned but may consume events derived from foreign owned entities via the shared project PDM.

## Role in the system

- Depends on: [`@rntme/pdm`](../pdm) for cross-ref validation (entity / field / state-machine / PDM-relation lookups via `PdmResolver`); [`zod`](https://zod.dev) for structural parsing; [`@rntme/pdm`](../pdm) `EventTypeSpec[]` for handler derivation.
- Consumed by: [`@rntme/projection-consumer`](../projection-consumer) (reads `generateProjectionDdl` for table bootstrap and `deriveProjectionHandler` for per-event handlers); [`@rntme/graph-ir-compiler`](../graph-ir-compiler) (resolves projection table names and read-side relation graph via `QsmResolver`); [`@rntme/runtime`](../runtime) (orchestrates parse / validate / DDL apply at boot).
- Position in pipeline: PDM (validated) + raw QSM JSON → `parseQsm` → `validateStructural` → `validateCrossRef` (against PDM) → `ValidatedQsm` → { DDL specs, handler specs, `QsmResolver` } consumed by projection-consumer and the SQL compiler.

## File map

```
src/
  index.ts                      (entry) Public re-export surface — only symbols listed here are part of the API.
  parse/
    parse.ts                    (entry) Accepts raw object or JSON string; returns Result<QsmArtifact> via Zod.
    schema.ts                   (entry) Zod schema for projections + relations + cardinality + role enums.
  validate/
    structural.ts               (entry) Layer-2 PDM-free rules: empty/duplicate keys/grain/exposed, table collisions, relation key shape; also exports defaultTableName.
    cross-ref.ts                (entry) Layer-3 rules requiring PDM: entity/field existence, entity-mirror constraints, B2 QSM↔PDM relation parity.
    index.ts                    (entry) Re-exports both layers and the convenience aggregator validateQsm.
  derive/
    ddl.ts                      (entry) Builds ProjectionDdlSpec per projection: columns, idempotency triple, indexes, CREATE TABLE / CREATE INDEX SQL.
    handler.ts                  (entry) Builds ProjectionHandlerSpec per projection from PDM EventTypeSpec[]; one EventHandler per event with insert | update op.
  resolvers/
    qsm-resolver.ts             (entry) Pure-lookup QsmResolver over a ValidatedQsm: projections, entity-mirror lookup, relations.
  common/
    invariant.ts                (internal) invariantViolated() — post-validation guard helper used by derive/* and the resolver.
  types/
    artifact.ts                 (entry) QsmArtifact, Projection, ProjectionBacking, ProjectionSource, QsmRelation, Cardinality, RelationRole, branded StructurallyValidQsm / ValidatedQsm; runtime arrays RELATION_ROLE_VALUES, CARDINALITY_VALUES.
    resolvers.ts                (entry) ResolvedProjection, ResolvedRelation, QsmResolver type.
    result.ts                   (entry) Result<T>, Ok, Err, Layer, QsmError, QsmErrorCode; ERROR_CODES registry; ok/err/isOk/isErr helpers.
    index.ts                    (internal) Aggregates type re-exports for in-package consumers; the package entry points export from individual files.
```

## Quick start

```ts
import {
  parsePdm,
  validatePdm,
  createPdmResolver,
  type EventTypeSpec,
} from '@rntme/pdm';
import {
  parseQsm,
  validateQsm,
  generateProjectionDdl,
  deriveProjectionHandler,
  createQsmResolver,
} from '@rntme/qsm';

const pdmRaw = parsePdm(/* PDM JSON */ '{}');
if (!pdmRaw.ok) throw new Error(JSON.stringify(pdmRaw.errors));
const pdm = validatePdm(pdmRaw.value);
if (!pdm.ok) throw new Error(JSON.stringify(pdm.errors));
const pdmResolver = createPdmResolver(pdm.value);

const raw = {
  projections: {
    IssueView: {
      backing: 'entity-mirror',
      source: { entity: 'Issue' },
      keys: ['id'],
      grain: ['id'],
      exposed: ['title', 'status', 'priority'],
      table: 'projection_issue',
    },
  },
  relations: {
    'IssueView.project': {
      to: 'ProjectView',
      localKey: 'projectId',
      foreignKey: 'id',
      cardinality: 'one',
      role: 'dimension',
    },
  },
};

const parsed = parseQsm(raw);
if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));

const validated = validateQsm(parsed.value, pdmResolver);
if (!validated.ok) throw new Error(JSON.stringify(validated.errors));

const ddls = generateProjectionDdl(validated.value, pdmResolver);
// ddls[0].createTableSql      → CREATE TABLE "projection_issue" (...)
// ddls[0].idempotencyColumns  → last_event_id / last_event_version / applied_at

const eventTypes: readonly EventTypeSpec[] = []; // from pdm.eventTypes
const handlers = deriveProjectionHandler(validated.value, pdmResolver, eventTypes);

const qsmResolver = createQsmResolver(validated.value);
qsmResolver.findEntityMirror('Issue');           // → ResolvedProjection | null
qsmResolver.resolveRelation('IssueView', 'project');
```

## API

| Export | Signature | Purpose |
| --- | --- | --- |
| `parseQsm` | `(raw: unknown) => Result<QsmArtifact>` | Accepts a raw object or a JSON string; runs `QsmArtifactSchema.safeParse`; returns aggregated Zod issues with `layer: 'parse'`. |
| `QsmArtifactSchema` | `z.ZodSchema` | Strict Zod schema for `{ projections, relations }`; both default to `{}`. |
| `validateStructural` | `(QsmArtifact) => Result<StructurallyValidQsm>` | PDM-free rules; brands the artifact on success. |
| `validateCrossRef` | `(StructurallyValidQsm, PdmResolver) => Result<ValidatedQsm>` | PDM-aware rules; brands the artifact on success. |
| `validateQsm` | `(QsmArtifact, PdmResolver) => Result<ValidatedQsm>` | Convenience: runs structural then cross-ref; short-circuits on the first failing layer. |
| `defaultTableName` | `(projectionName: string) => string` | Returns ``projection_${name.toLowerCase()}``. Used when `projection.table` is omitted. |
| `generateProjectionDdl` | `(ValidatedQsm, PdmResolver) => ProjectionDdlSpec[]` | One spec per projection; columns are mirrored from PDM entity fields, plus three idempotency columns; SQL identifiers are double-quoted; composite keys emit a trailing `PRIMARY KEY (...)` clause. |
| `deriveProjectionHandler` | `(ValidatedQsm, PdmResolver, readonly EventTypeSpec[]) => ProjectionHandlerSpec[]` | One spec per `entity-mirror` projection; one `EventHandler` per matching `EventTypeSpec` (insert for `isCreation`, update over `affects` otherwise). |
| `createQsmResolver` | `(ValidatedQsm) => QsmResolver` | Pure in-memory lookup over projections (`listProjections`, `resolveProjection`, `findEntityMirror`) and relations (`listRelations`, `resolveRelation`). |
| `RELATION_ROLE_VALUES` | `readonly ['fact', 'dimension']` | Runtime tuple for the `RelationRole` type. |
| `CARDINALITY_VALUES` | `readonly ['one', 'many']` | Runtime tuple for the `Cardinality` type. |
| `ok`, `err`, `isOk`, `isErr` | Result helpers | Construct/inspect the `Result<T>` discriminated union. |
| `ERROR_CODES` | `Record<QsmErrorCode, QsmErrorCode>` | Stable string-literal registry of every code emitted by the package. |
| Types | `QsmArtifact`, `QsmArtifactParsed`, `Projection`, `ProjectionBacking`, `ProjectionSource`, `QsmRelation`, `Cardinality`, `RelationRole`, `StructurallyValidQsm`, `ValidatedQsm`, `ProjectionDdlSpec`, `ColumnSpec`, `IndexSpec`, `SqlType`, `ProjectionHandlerSpec`, `EventHandler`, `HandlerOp`, `IdempotencyGuard`, `QsmResolver`, `ResolvedProjection`, `ResolvedRelation`, `Result`, `Ok`, `Err`, `Layer`, `QsmError`, `QsmErrorCode` | Re-exported from `src/types/*`. |

### Validation layers (subsection of API)

`validateQsm` runs the layers in order and stops at the first failing layer. Within a layer all errors are aggregated.

| Layer | Inputs | Sample concerns |
| --- | --- | --- |
| `parse` | `unknown` | Schema shape, enum membership, JSON syntax. Single code: `QSM_PARSE_SCHEMA_VIOLATION`. |
| `structural` | `QsmArtifact` | Empty/duplicate `keys` / `grain` / `exposed`; duplicate resolved `table`; relation key shape `"<Projection>.<relation>"`; presence of `to` / `localKey` / `foreignKey`. |
| `cross-ref` | `StructurallyValidQsm` + `PdmResolver` | `source.entity` exists in PDM; every `keys` / `grain` / `exposed` field exists on that entity; `exposed` excludes generated fields; entity-mirror requires `stateMachine` and `keys === entity.keys` and `grain === keys` (set equality); duplicate entity-mirror per source forbidden; QSM relations cross-validated against PDM (B2 parity). |
| `cross-ref` (feature gate) | as above | `backing: 'derived'` is parser-accepted, validator-rejected with `QSM_BACKING_DERIVED_NOT_SUPPORTED`. |

### Output shapes (subsection of API)

`ProjectionDdlSpec` (per projection):

```ts
{
  projectionName: 'IssueView',
  tableName: 'projection_issue',
  columns: [
    { name: 'id',    sqlType: 'INTEGER', nullable: false, primaryKey: true  },
    { name: 'title', sqlType: 'TEXT',    nullable: false, primaryKey: false },
    // ... one entry per entity field
  ],
  idempotencyColumns: [
    { name: 'last_event_id',      sqlType: 'TEXT',    nullable: false, primaryKey: false },
    { name: 'last_event_version', sqlType: 'INTEGER', nullable: false, primaryKey: false },
    { name: 'applied_at',         sqlType: 'TEXT',    nullable: false, primaryKey: false },
  ],
  indexes: [{ name: 'idx_projection_issue_status', columns: ['status'] }],
  createTableSql: 'CREATE TABLE "projection_issue" (\n  "id" INTEGER NOT NULL PRIMARY KEY,\n  ...\n);',
  createIndexSql: ['CREATE INDEX "idx_projection_issue_status" ON "projection_issue" ("status");'],
}
```

`ProjectionHandlerSpec` (per `entity-mirror` projection):

```ts
{
  projectionName: 'IssueView',
  tableName: 'projection_issue',
  aggregateType: 'Issue',
  idempotencyGuard: {
    versionColumn: 'last_event_version',
    eventIdColumn: 'last_event_id',
    appliedAtColumn: 'applied_at',
  },
  keyColumns: ['id'],
  eventHandlers: [
    {
      eventType: 'IssueReported',
      transition: 'report',
      op: { kind: 'insert', columns: [/* every entity column */], payloadFields: ['title', 'projectId', /* ... */] },
    },
    {
      eventType: 'IssueResolved',
      transition: 'resolve',
      op: { kind: 'update', setColumns: ['status', 'resolved_at'], setFields: ['status', 'resolvedAt'] },
    },
  ],
}
```

### Error codes (subsection of API; stable, append-only)

Parse: `QSM_PARSE_SCHEMA_VIOLATION`.

Structural: `QSM_STRUCT_PROJECTION_KEYS_EMPTY`, `QSM_STRUCT_PROJECTION_GRAIN_EMPTY`, `QSM_STRUCT_PROJECTION_EXPOSED_EMPTY`, `QSM_STRUCT_PROJECTION_DUPLICATE_KEY`, `QSM_STRUCT_PROJECTION_DUPLICATE_GRAIN`, `QSM_STRUCT_PROJECTION_DUPLICATE_EXPOSED`, `QSM_STRUCT_DUPLICATE_TABLE`, `QSM_RELATION_KEY_MALFORMED`, `QSM_RELATION_TO_MISSING`, `QSM_RELATION_KEY_MISSING`.

Cross-ref (entity / projection): `QSM_XREF_SOURCE_UNKNOWN_ENTITY`, `QSM_XREF_KEY_UNKNOWN_FIELD`, `QSM_XREF_GRAIN_UNKNOWN_FIELD`, `QSM_XREF_EXPOSED_UNKNOWN_FIELD`, `QSM_XREF_EXPOSED_INCLUDES_GENERATED`, `QSM_XREF_ENTITY_MIRROR_REQUIRES_STATE_MACHINE`, `QSM_XREF_ENTITY_MIRROR_KEYS_MISMATCH`, `QSM_XREF_ENTITY_MIRROR_GRAIN_MISMATCH`, `QSM_XREF_ENTITY_MIRROR_DUPLICATE`.

Cross-ref (relations, B2): `QSM_XREF_RELATION_UNKNOWN_SOURCE_PROJECTION`, `QSM_XREF_RELATION_UNKNOWN_TARGET_PROJECTION`, `QSM_XREF_RELATION_NOT_IN_PDM`, `QSM_XREF_RELATION_TO_MISMATCH`, `QSM_XREF_RELATION_LOCAL_KEY_MISMATCH`, `QSM_XREF_RELATION_FOREIGN_KEY_MISMATCH`, `QSM_XREF_RELATION_CARDINALITY_MISMATCH`, `QSM_XREF_RELATION_LOCAL_KEY_UNKNOWN_FIELD`, `QSM_XREF_RELATION_FOREIGN_KEY_UNKNOWN_FIELD`, `QSM_XREF_RELATION_FOREIGN_KEY_NOT_A_KEY`.

Feature gate: `QSM_BACKING_DERIVED_NOT_SUPPORTED`. Internal: `QSM_INTERNAL`.

## Invariants & gotchas

- `ValidatedQsm` is a branded type; the only way to construct one is through `validateStructural` then `validateCrossRef` (or `validateQsm`). Do not cast to bypass — `derive/*` and `createQsmResolver` rely on the brand to skip re-checking PDM consistency. Source: `src/types/artifact.ts` (`ValidatedBrand`).
- **Service ownership is external to `@rntme/qsm`.** When `@rntme/qsm` is used through `@rntme/blueprint`, a service may own a projection over a foreign service's owned entity as long as the shared project PDM exposes that entity and it has a state machine. `@rntme/qsm` still treats the supplied `PdmResolver` as canon and does not encode service boundaries itself.
- Entity-mirror projections must have `keys` set-equal to the source entity's `keys`, and `grain` set-equal to those `keys`. Mirrors are per-key by construction; aggregation is not a backing concern. Source: spec [`docs/superpowers/specs/done/2026-04-14-mutations-design.md`](../../docs/superpowers/specs/done/2026-04-14-mutations-design.md) §6; enforced in `validate/cross-ref.ts` (`QSM_XREF_ENTITY_MIRROR_KEYS_MISMATCH`, `QSM_XREF_ENTITY_MIRROR_GRAIN_MISMATCH`); fix commit `6734e10` ("enforce grain==keys").
- An entity may have at most one `entity-mirror` projection. Two mirrors over the same source entity collide on event apply and is forbidden at cross-ref (`QSM_XREF_ENTITY_MIRROR_DUPLICATE`); the resolver re-asserts via `invariantViolated` to surface validator regressions loudly.
- `backing: 'derived'` parses but does not validate. The Zod enum admits it for forward-compat with tier 2; cross-ref rejects with `QSM_BACKING_DERIVED_NOT_SUPPORTED`. Do not add a "derived" code path inside `derive/*` — they short-circuit on `backing !== 'entity-mirror'`.
- Relation key format is `"<ProjectionName>.<relationName>"`, where each segment matches `[A-Za-z_][A-Za-z0-9_]*`. snake_case projection names (e.g. `project_mirror.dimension`) are accepted; digit-leading segments are rejected. Source: `RELATION_KEY_RE` in `validate/structural.ts`; fix commits `e30135c` and `8c4d66a`.
- QSM relations are B2 cross-validated against PDM: `to`, `localKey`, `foreignKey`, `cardinality` must exactly equal the corresponding `PDM.entity.relations[name]`. PDM is canon; if QSM disagrees, the cross-ref layer fails. Source: spec [`docs/superpowers/specs/done/2026-04-16-qsm-relations-migration-design.md`](../../docs/superpowers/specs/done/2026-04-16-qsm-relations-migration-design.md) §2.
- `relationName` in the key must equal the PDM relation name on the source entity — there is no rename. Re-aliasing happens (if at all) at the consumer (graph-ir-compiler), not in QSM.
- `cardinality: 'many'` parses and validates, but the SQL compiler refuses to lower it (`NAV_FAN_OUT_NOT_ALLOWED`). Reserve it for forward-compat; do not declare it expecting a JOIN. Source: spec §1 (Non-goals) and §3 (`expandChain`).
- `localKey` and `foreignKey` are field names, not column names. The DDL generator and handler deriver call `entity.fields[name].column` to get the SQL identifier; mixing the two breaks DDL silently in tests that happen to use identical names.
- `exposed` rejects fields with a `generated` clause — they are mirrored implicitly as part of the entity column projection. Source: `validate/cross-ref.ts` (`QSM_XREF_EXPOSED_INCLUDES_GENERATED`).
- Generated DDL quotes every identifier with SQLite double quotes (`"name"`), so reserved words (`order`, `group`) survive. Composite keys use a trailing `PRIMARY KEY (col1, col2)` clause; single keys use inline `PRIMARY KEY`. Source: `derive/ddl.ts` (`renderCreateTable`); fix commit `6734e10`.
- Every projection (regardless of backing) gets the same three idempotency columns appended to the table: `last_event_id TEXT NOT NULL`, `last_event_version INTEGER NOT NULL`, `applied_at TEXT NOT NULL`. The handler spec exposes them via `idempotencyGuard`. Names are stable; do not rename.
- `deriveProjectionHandler` requires the caller to pass `EventTypeSpec[]`. Filtering by `aggregateType === entity.name` happens inside; passing an empty array yields a spec with `eventHandlers: []` (a no-op consumer). Source: `derive/handler.ts`.
- For non-creation events, `EventHandler.op.kind === 'update'` and `setColumns` is derived from `EventTypeSpec.affects`. An `affects` field with no column mapping triggers `invariantViolated` — that means PDM resolution diverged from validation; the validator should have rejected it.
- For creation events (`EventTypeSpec.isCreation === true`), `op.kind === 'insert'` and `op.columns` includes every entity column (including generated ones like `created_at` / `updated_at`). The handler executor is responsible for sourcing values; `payloadFields` lists the keys present in the event payload. Source: `derive/handler.ts` `buildEventHandler`; test in `test/unit/derive-handler.test.ts`.
- `defaultTableName` lowercases the projection name and prefixes `projection_`. Two projections with names that collide after lowercasing (e.g. `IssueView` and `issueview`) both resolve to `projection_issueview` and trigger `QSM_STRUCT_DUPLICATE_TABLE`. Use an explicit `table` to disambiguate. Source: `validate/structural.ts`.
- `parseQsm` accepts both `unknown` (already-parsed JSON) and a JSON string — the string path runs `JSON.parse` first and surfaces SyntaxError as a parse-layer error. Source: `parse/parse.ts`.
- Both `projections` and `relations` default to `{}` at the schema level, so a QSM artifact with no relations is valid. The compiler will emit `NAV_NOT_ALLOWED` only when a graph attempts dot-nav through an undeclared relation. Source: `parse/schema.ts` `.default({})`; relations spec §3.
- Column types are mapped from PDM `ScalarPrimitive`: `integer` → `INTEGER`, `decimal` → `REAL`, `boolean` → `INTEGER`, `string` / `date` / `datetime` → `TEXT`. Source: `derive/ddl.ts` `mapSqlType`. SQLite has no native boolean; do not introduce one.
- A state-field index (`idx_<table>_<state_column>`) is emitted automatically when the source entity has a `stateMachine`. The index is added to `ProjectionDdlSpec.indexes` and rendered as a separate `CREATE INDEX` statement. Source: `derive/ddl.ts` `buildSpec`.
- `validateQsm` is a strict pipeline: structural failure prevents cross-ref from running. The two sub-validators are also exported individually for callers that want to surface partial diagnostics; consumers in this codebase use the aggregate. Source: `validate/index.ts`.
- `Layer` includes `'derive' | 'internal'` in addition to the parse/structural/cross-ref triad; `derive` is reserved for future post-validate emitters that produce errors instead of throwing. Today the deriver throws via `invariantViolated` because validation guarantees consistency. Source: `types/result.ts`.
- The resolver's `findEntityMirror` is the single supported lookup from "PDM entity name" → projection. Walking `listProjections` and filtering by `source.entity` works but skips the duplicate-mirror invariant guard; prefer `findEntityMirror`. Source: `resolvers/qsm-resolver.ts`.
- `ResolvedRelation` carries `role` only when set by the author; the resolver omits the field for relations without a role rather than emitting `role: undefined`. Downstream `in` checks are valid; `=== undefined` checks against an absent property still hold. Source: `resolvers/qsm-resolver.ts`.
- `QsmRelation.to` is a projection name within the same QSM, never an entity name. Aliasing happens here: two projections over the same entity (forbidden in MVP via duplicate-mirror) would mean two distinct `to` values. Source: relations spec §1 (Design rules).
- Removed error codes from earlier drafts — `QSM_STRUCT_DUPLICATE_PROJECTION`, `QSM_STRUCT_RELATION_ROLE_UNKNOWN_VALUE`, `QSM_XREF_RELATION_ROLE_UNKNOWN_ENTITY`, `QSM_XREF_RELATION_ROLE_UNKNOWN_RELATION`. Zod and the new B2 codes cover their cases. Do not re-introduce. Source: fix commit `6734e10`, refactor commit `379e7de`.

## Out of scope / known limits

- No DDL execution — `generateProjectionDdl` returns SQL strings; applying them is `@rntme/projection-consumer`'s job.
- No migration / drop / alter generation — only `CREATE TABLE` / `CREATE INDEX`. Schema evolution is out of MVP scope per the mutations spec §1.
- No `derived` backing — the enum is reserved; the validator rejects it.
- No multi-hop relations — every QSM relation is single-hop. Multi-hop dot-nav is built at compile time by walking single-hop steps; declaring `through`, `via`, or path expressions in QSM is unsupported by design (relations spec §1 Non-goals).
- No relation rename — `<relationName>` in the key must match the PDM relation name verbatim.
- No `cardinality: 'many'` lowering — declared but not consumable by the SQL compiler. Reserved.
- No projection-name aliasing or scoping — projection names live in a single global namespace per artifact; collisions on resolved `table` are rejected (`QSM_STRUCT_DUPLICATE_TABLE`).
- No `role` semantics — `'fact'` / `'dimension'` are annotations consumed by visualization tooling; the compiler does not consult them. Source: `src/types/artifact.ts` doc comment on `RELATION_ROLE_VALUES`.
- No Postgres-specific SQL — output is SQLite-dialect (double-quoted identifiers, no schema qualifier). Future scale-out is via Turso (SQLite-compatible). Do not introduce Postgres syntax.
- No `relationRoles` field — removed in favour of `relations` during the qsm-relations-migration refactor (commit `379e7de`). Old fixtures must be migrated.

## Where to look first

- "Add a new structural rule" → add to `validate/structural.ts` following `QSM_STRUCT_DUPLICATE_TABLE`; register the code in `types/result.ts` (`ERROR_CODES`); add positive + negative tests in `test/unit/validate-structural.test.ts`.
- "Add a new cross-ref rule" → add to `validate/cross-ref.ts` (entity-mirror block or relation block); register in `types/result.ts`; add tests in `test/unit/validate-cross-ref.test.ts` or `test/unit/validate/relations-crossref.test.ts`.
- "Add a new error code" → append to `ERROR_CODES` in `src/types/result.ts`; never reorder, never delete (codes are part of the API). Document the trigger in this README's error-codes subsection.
- "Change the SQL emitted for a projection" → `derive/ddl.ts` (`buildSpec`, `renderCreateTable`, `renderColumn`, `q`); update `test/unit/derive-ddl.test.ts`.
- "Change handler op shape (insert/update/payload)" → `derive/handler.ts` (`buildEventHandler`); types live alongside (`HandlerOp`, `EventHandler`, `IdempotencyGuard`); update `test/unit/derive-handler.test.ts`.
- "Add a resolver method (e.g. group relations by source projection)" → `src/resolvers/qsm-resolver.ts`; extend `QsmResolver` in `src/types/resolvers.ts`; tests in `test/unit/resolvers.test.ts`.
- "Update a Zod-level schema rule" → `src/parse/schema.ts`; failing shape produces a `QSM_PARSE_SCHEMA_VIOLATION`; tests in `test/unit/parse.test.ts`.
- "Investigate an entity-mirror duplicate or missing-state-machine error" → `validate/cross-ref.ts` (`mirrorsByEntity`, `entity-mirror` block); fixtures in `test/fixtures/issue-tracker.{pdm,qsm}.json`.
- "Trace how a relation flows through compilation" → start at `createQsmResolver` (`src/resolvers/qsm-resolver.ts`), then read consumer code in `packages/artifacts/graph-ir-compiler/src/lower/sqlite/joins.ts` (relations spec §3).
- "End-to-end smoke" → `test/smoke.test.ts` parses → validates → derives DDL + handlers against the issue-tracker fixtures.
- "Reproduce a relation B2 mismatch" → `test/unit/validate/relations-crossref.test.ts` covers each `QSM_XREF_RELATION_*` code (TO / LOCAL_KEY / FOREIGN_KEY / CARDINALITY mismatch, foreign-key-not-a-key, unknown source/target projection).
- "Reproduce a relation key-shape rejection" → `test/unit/validate/relations-structural.test.ts` covers `QSM_RELATION_KEY_MALFORMED`, `QSM_RELATION_TO_MISSING`, `QSM_RELATION_KEY_MISSING`.
- "Inspect realistic fixtures" → `test/fixtures/issue-tracker.pdm.json` and `test/fixtures/issue-tracker.qsm.json` are the canonical small artifacts shared across unit tests.
- "Audit which exports are public" → `src/index.ts` is the single source of truth; anything not re-exported from there is `(internal)` regardless of how it appears in `src/types/index.ts`.
- "Add a new resolver invariant" → put it in `common/invariant.ts` `invariantViolated`; throw at the use site (`derive/*`, `resolvers/qsm-resolver.ts`). Validator gaps that the throw exposes go in `validate/cross-ref.ts` first; the throw is the safety net.
- "Trace projection table from raw QSM to SQL" → `parse/parse.ts` → `validate/cross-ref.ts` (`mirrorsByEntity` map) → `resolvers/qsm-resolver.ts` (`toResolvedProjection`) → `derive/ddl.ts` (`buildSpec` + `defaultTableName`).
- "Hand a `ResolvedRelation` to the SQL compiler" → `qsmResolver.resolveRelation('IssueView', 'project')` returns the same shape the compiler's `expandChain` consumes (relations spec §3, `JoinChain.steps`).

## Specs

- [`../../docs/superpowers/specs/done/2026-04-23-project-first-blueprint-design.md`](../../docs/superpowers/specs/done/2026-04-23-project-first-blueprint-design.md) — active umbrella spec for the project-first pivot: keeps `QSM` service-level, splits it into multiple files, and expands its allowed input scope to foreign-service events inside one project blueprint.
- [`../../docs/superpowers/specs/done/2026-04-14-mutations-design.md`](../../docs/superpowers/specs/done/2026-04-14-mutations-design.md) — §6 entity-mirror projection contract: backing semantics, key/grain rules, generated columns, idempotency triple.
- [`../../docs/superpowers/specs/done/2026-04-16-qsm-relations-migration-design.md`](../../docs/superpowers/specs/done/2026-04-16-qsm-relations-migration-design.md) — read-side relation graph migration from PDM to QSM: schema, B2 cross-validation rules, single-hop / fan-out gates, error codes.

## Glossary

- **Projection** — a row in `QsmArtifact.projections`; declares a materialized table backed by a PDM entity.
- **Backing** — the maintenance strategy. `entity-mirror` is 1:1 with one PDM entity and is auto-applied from envelope events. `derived` is reserved.
- **Grain** — the per-row identity of the projection. For entity-mirror it equals `keys` by construction.
- **Exposed** — the user-visible read surface. The DDL still mirrors *all* entity columns; `exposed` constrains what consumers may read.
- **B2 cross-validation** — relations spec §1: QSM relation metadata must match PDM verbatim; PDM is canon.
- **Idempotency triple** — `last_event_id`, `last_event_version`, `applied_at`. Always present. The projection consumer compares incoming events against these to skip duplicates.
