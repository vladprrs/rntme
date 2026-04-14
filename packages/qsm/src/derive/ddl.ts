import type { PdmResolver, ResolvedEntity, ScalarPrimitive } from '@rntme/pdm';
import type { ValidatedQsm, Projection } from '../types/artifact.js';
import { defaultTableName } from '../validate/structural.js';

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

export function generateProjectionDdl(
  artifact: ValidatedQsm,
  pdm: PdmResolver,
): ProjectionDdlSpec[] {
  const specs: ProjectionDdlSpec[] = [];

  for (const [projName, proj] of Object.entries(artifact.projections)) {
    const entity = pdm.resolveEntity(proj.source.entity);
    if (!entity) continue; // impossible after validation, defensive
    specs.push(buildSpec(projName, proj, entity));
  }

  return specs;
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

  const createTableSql = renderCreateTable(tableName, columns, IDEMPOTENCY_COLUMNS);
  const createIndexSql = indexes.map((i) =>
    `CREATE INDEX ${i.name} ON ${tableName}(${i.columns.join(', ')});`,
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
): string {
  const all = [...columns, ...idempotency];
  const lines = all.map(renderColumn);
  return `CREATE TABLE ${tableName} (\n  ${lines.join(',\n  ')}\n);`;
}

function renderColumn(c: ColumnSpec): string {
  const parts = [c.name, c.sqlType];
  if (!c.nullable) parts.push('NOT NULL');
  if (c.primaryKey) parts.push('PRIMARY KEY');
  return parts.join(' ');
}
