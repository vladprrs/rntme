import type { PdmResolver, ResolvedEntity, ScalarPrimitive } from '@rntme/pdm';
import type { ValidatedQsm, Projection } from '../types/artifact.js';
import { defaultTableName } from '../validate/structural.js';
import { invariantViolated } from '../common/invariant.js';

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
    if (!entity) {
      throw invariantViolated(`entity "${proj.source.entity}" not in PDM for projection "${projName}"`);
    }
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
