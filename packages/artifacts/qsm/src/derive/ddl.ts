import type { PdmResolver, ResolvedEntity, ScalarPrimitive } from '@rntme/pdm';
import type { ValidatedQsm, Projection } from '../types/artifact.js';
import { isDerivedSource, isEntityMirrorSource } from '../types/artifact.js';
import { defaultTableName } from '../validate/structural.js';
import { invariantViolated } from '../common/invariant.js';

/**
 * Structural shape of `DerivedTableSchema` from `@rntme/graph-ir-compiler`,
 * re-declared locally to avoid a package-level dependency cycle
 * (graph-ir-compiler already depends on qsm). The types must stay
 * structurally compatible; changes in either package should be mirrored
 * in the other.
 */
export type DerivedSqlTypeLocal = 'INTEGER' | 'TEXT' | 'REAL';

export type DerivedTableSchemaLike = Readonly<{
  tableName: string;
  groupColumns: readonly Readonly<{
    name: string;
    sqlType: DerivedSqlTypeLocal;
    nullable: boolean;
    // graph-ir-compiler's DerivedGroupColumn also carries `binding`; we only
    // read name/sqlType/nullable here, so keep binding unconstrained.
    binding?: unknown;
  }>[];
  measureColumns: readonly Readonly<{
    name: string;
    sqlType: DerivedSqlTypeLocal;
    fn?: 'count' | 'sum';
    initialSql?: string;
    deltaSql?: string;
    bindings?: unknown;
  }>[];
}>;

export type SqlType = 'INTEGER' | 'TEXT' | 'REAL';

export type ColumnSpec = Readonly<{
  name: string;
  sqlType: SqlType;
  nullable: boolean;
  primaryKey: boolean;
}>;

export type IndexSpec = Readonly<{
  name: string;
  columns: readonly string[];
}>;

export type ProjectionDdlSpec = Readonly<{
  projectionName: string;
  tableName: string;
  columns: readonly ColumnSpec[];
  idempotencyColumns: readonly ColumnSpec[];
  indexes: readonly IndexSpec[];
  createTableSql: string;
  createIndexSql: readonly string[];
}>;

const IDEMPOTENCY_COLUMNS: readonly ColumnSpec[] = [
  { name: 'last_event_id', sqlType: 'TEXT', nullable: false, primaryKey: false },
  { name: 'last_event_version', sqlType: 'INTEGER', nullable: false, primaryKey: false },
  { name: 'applied_at', sqlType: 'TEXT', nullable: false, primaryKey: false },
];

/**
 * Idempotency columns for derived projections (D5). Derived projections use
 * the separate `seen_events` table for per-event dedup; the per-row columns
 * are informational (`last_event_id`) and `applied_at` for ops inspection.
 * No `last_event_version` — derived projections are not mirrors of a single
 * aggregate lifecycle.
 */
const DERIVED_IDEMPOTENCY_COLUMNS: readonly ColumnSpec[] = [
  { name: 'last_event_id', sqlType: 'TEXT', nullable: false, primaryKey: false },
  { name: 'applied_at', sqlType: 'TEXT', nullable: false, primaryKey: false },
];

export type GenerateProjectionDdlOpts = Readonly<{
  /**
   * Map of projection-name → compiled graph schema. Required for every
   * projection with `backing: 'derived'` in `artifact.projections`. The
   * runtime populates this map after invoking
   * `compileProjectionGraph(graphSpec, pdm, qsm)` per derived projection.
   *
   * Accepts any object structurally compatible with graph-ir-compiler's
   * `DerivedTableSchema` (see `DerivedTableSchemaLike`).
   */
  derivedSchemas?: Readonly<Record<string, DerivedTableSchemaLike>>;
}>;

export function generateProjectionDdl(
  artifact: ValidatedQsm,
  pdm: PdmResolver,
  opts?: GenerateProjectionDdlOpts,
): ProjectionDdlSpec[] {
  const specs: ProjectionDdlSpec[] = [];

  for (const [projName, proj] of Object.entries(artifact.projections)) {
    const backing = proj.backing ?? 'entity-mirror';

    if (backing === 'derived') {
      if (!isDerivedSource(proj.source)) {
        throw invariantViolated(
          `projection "${projName}" backing="derived" but source is not { graph } (validator bug)`,
        );
      }
      const schema = opts?.derivedSchemas?.[projName];
      if (!schema) {
        throw invariantViolated(
          `derivedSchemas[${projName}] required for derived projection ${projName}`,
        );
      }
      specs.push(buildDerivedSpec(projName, proj, schema));
      continue;
    }

    // backing === 'entity-mirror'
    if (!isEntityMirrorSource(proj.source)) {
      throw invariantViolated(
        `projection "${projName}" backing="entity-mirror" but source is not { entity } (validator bug)`,
      );
    }
    const entity = pdm.resolveEntity(proj.source.entity);
    if (!entity) {
      throw invariantViolated(`entity "${proj.source.entity}" not in PDM for projection "${projName}"`);
    }
    specs.push(buildSpec(projName, proj, entity));
  }

  return specs;
}

function buildDerivedSpec(
  projName: string,
  proj: Projection,
  schema: DerivedTableSchemaLike,
): ProjectionDdlSpec {
  // Structural layer enforces that derived projections carry an explicit
  // `table`, but guard here for invariant safety.
  const tableName = proj.table;
  if (tableName === undefined) {
    throw invariantViolated(`derived projection "${projName}" missing required "table" (validator bug)`);
  }

  const groupColumns: ColumnSpec[] = schema.groupColumns.map((g) => ({
    name: g.name,
    sqlType: g.sqlType,
    nullable: g.nullable,
    primaryKey: false, // PK is rendered compositely below; per-column flag unused
  }));
  const measureColumns: ColumnSpec[] = schema.measureColumns.map((m) => ({
    name: m.name,
    sqlType: m.sqlType,
    nullable: false,
    primaryKey: false,
  }));

  const keyColumnNames = schema.groupColumns.map((g) => g.name);
  const createTableSql = renderCreateTableDerived(
    tableName,
    groupColumns,
    measureColumns,
    DERIVED_IDEMPOTENCY_COLUMNS,
    keyColumnNames,
  );

  return {
    projectionName: projName,
    tableName,
    columns: [...groupColumns, ...measureColumns],
    idempotencyColumns: DERIVED_IDEMPOTENCY_COLUMNS,
    indexes: [],
    createTableSql,
    createIndexSql: [],
  };
}

function renderCreateTableDerived(
  tableName: string,
  groupColumns: readonly ColumnSpec[],
  measureColumns: readonly ColumnSpec[],
  idempotency: readonly ColumnSpec[],
  keyColumnNames: readonly string[],
): string {
  const lines: string[] = [];
  for (const g of groupColumns) {
    const parts = [q(g.name), g.sqlType];
    parts.push(g.nullable ? 'NULL' : 'NOT NULL');
    lines.push(parts.join(' '));
  }
  for (const m of measureColumns) {
    lines.push(`${q(m.name)} ${m.sqlType} NOT NULL DEFAULT 0`);
  }
  for (const c of idempotency) {
    const parts = [q(c.name), c.sqlType];
    if (!c.nullable) parts.push('NOT NULL');
    lines.push(parts.join(' '));
  }
  if (keyColumnNames.length > 0) {
    lines.push(`PRIMARY KEY (${keyColumnNames.map(q).join(', ')})`);
  }
  return `CREATE TABLE ${q(tableName)} (\n  ${lines.join(',\n  ')}\n);`;
}

function buildSpec(
  projName: string,
  proj: Projection,
  entity: ResolvedEntity,
): ProjectionDdlSpec {
  const tableName = proj.table ?? defaultTableName(projName);
  const keySet = new Set(proj.keys);
  const columns: ColumnSpec[] = entity.fields.map((f) => ({
    name: f.column,
    sqlType: mapSqlType(f.type),
    nullable: f.nullable,
    primaryKey: keySet.has(f.name),
  }));

  const indexes: IndexSpec[] = [];
  if (entity.stateMachine) {
    const stateColumn = entity.fields.find((f) => f.name === entity.stateMachine!.stateField)?.column;
    if (stateColumn) {
      indexes.push({
        name: `idx_${tableName}_${stateColumn}`,
        columns: [stateColumn],
      });
    }
  }

  const keyColumnNames = proj.keys.map((k) => {
    const col = entity.fields.find((f) => f.name === k)?.column;
    if (!col) {
      throw invariantViolated(`key "${k}" missing column mapping on entity "${entity.name}"`);
    }
    return col;
  });
  const createTableSql = renderCreateTable(tableName, columns, IDEMPOTENCY_COLUMNS, keyColumnNames);
  const createIndexSql = indexes.map((i) =>
    `CREATE INDEX ${q(i.name)} ON ${q(tableName)} (${i.columns.map(q).join(', ')});`,
  );

  return {
    projectionName: projName,
    tableName,
    columns,
    idempotencyColumns: IDEMPOTENCY_COLUMNS,
    indexes,
    createTableSql,
    createIndexSql,
  };
}

function mapSqlType(t: ScalarPrimitive): SqlType {
  switch (t) {
    case 'integer':
      return 'INTEGER';
    case 'decimal':
      return 'REAL';
    case 'boolean':
      return 'INTEGER';
    case 'string':
    case 'date':
    case 'datetime':
      return 'TEXT';
  }
}

function renderCreateTable(
  tableName: string,
  columns: readonly ColumnSpec[],
  idempotency: readonly ColumnSpec[],
  keyColumnNames: readonly string[],
): string {
  const composite = keyColumnNames.length > 1;
  const all = [...columns, ...idempotency];
  const lines = all.map((c) => renderColumn(c, composite));
  if (composite) {
    lines.push(`PRIMARY KEY (${keyColumnNames.map(q).join(', ')})`);
  }
  return `CREATE TABLE ${q(tableName)} (\n  ${lines.join(',\n  ')}\n);`;
}

function renderColumn(c: ColumnSpec, compositeKey: boolean): string {
  const parts = [q(c.name), c.sqlType];
  if (!c.nullable) parts.push('NOT NULL');
  if (c.primaryKey && !compositeKey) parts.push('PRIMARY KEY');
  return parts.join(' ');
}

function q(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}
