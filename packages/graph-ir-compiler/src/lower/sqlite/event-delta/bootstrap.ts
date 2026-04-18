import type { DerivedTableSchema } from '../../../types/projection.js';

/**
 * Emit the bootstrap SQL that rebuilds a derived projection from the full
 * event_log history for a single `eventType`. Literal event-type predicate +
 * optional filter body are composed; payload-field references are inlined
 * with `json_extract(payload_json, '$.<name>')`.
 *
 * `groupKeySql` and `measureSql` are dictionaries keyed by the DerivedTableSchema
 * column name and containing the SQL expression fragment that computes that
 * column in terms of event_log columns (the caller — typically `lower.ts` —
 * builds these from the event-source column mapping).
 */
export function buildBootstrapSql(
  schema: DerivedTableSchema,
  eventType: string,
  filterSql: string | null,
  groupKeySql: Record<string, string>,
  measureSql: Record<string, string>,
): string {
  const insertCols = [
    ...schema.groupColumns.map((c) => q(c.name)),
    ...schema.measureColumns.map((c) => q(c.name)),
    q('last_event_id'),
    q('applied_at'),
  ].join(', ');

  const selectGroup = schema.groupColumns
    .map((c) => {
      const s = groupKeySql[c.name];
      if (s === undefined) {
        throw new Error(`buildBootstrapSql: missing groupKeySql entry for group column "${c.name}"`);
      }
      return `${s} AS ${q(c.name)}`;
    })
    .join(',\n       ');

  const selectMeasure = schema.measureColumns
    .map((c) => {
      const s = measureSql[c.name];
      if (s === undefined) {
        throw new Error(`buildBootstrapSql: missing measureSql entry for measure column "${c.name}"`);
      }
      return `${s} AS ${q(c.name)}`;
    })
    .join(',\n       ');

  const groupByCols = schema.groupColumns.map((c) => q(c.name)).join(', ');

  const whereClause = filterSql
    ? `WHERE "event_type" = '${escapeSqlLiteral(eventType)}'\n  AND ${filterSql}`
    : `WHERE "event_type" = '${escapeSqlLiteral(eventType)}'`;

  const sql =
    `INSERT INTO ${q(schema.tableName)}(${insertCols})\n` +
    `SELECT ${selectGroup},\n` +
    `       ${selectMeasure},\n` +
    `       '' AS ${q('last_event_id')},\n` +
    `       strftime('%Y-%m-%dT%H:%M:%fZ','now') AS ${q('applied_at')}\n` +
    `FROM event_log\n` +
    `${whereClause}\n` +
    `GROUP BY ${groupByCols}`;

  return sql;
}

function q(id: string): string {
  return `"${id.replace(/"/g, '""')}"`;
}

function escapeSqlLiteral(s: string): string {
  return s.replace(/'/g, "''");
}
