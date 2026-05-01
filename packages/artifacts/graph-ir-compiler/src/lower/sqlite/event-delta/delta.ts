import type { DerivedColumnBinding, DerivedTableSchema } from '../../../types/projection.js';

/**
 * Produce the deltaSql (UPSERT) and its `?`-ordered binding list from a
 * `DerivedTableSchema`. The statement is executed once per accepted envelope
 * by the projection-consumer.
 *
 * Bindings order:
 *   1. group columns (declaration order)
 *   2. measure `initialSql` bindings (empty for `count` which has `initialSql = '1'`)
 *   3. `eventId` placeholder (for "last_event_id")
 *   4. `appliedAt` placeholder (for "applied_at")
 */
export function buildDeltaArtifact(schema: DerivedTableSchema): {
  deltaSql: string;
  deltaBindings: readonly DerivedColumnBinding[];
} {
  const groupColsSql = schema.groupColumns.map((c) => q(c.name)).join(', ');
  const measureColsSql = schema.measureColumns.map((c) => q(c.name)).join(', ');
  const groupPlaceholders = schema.groupColumns.map(() => '?').join(', ');
  const measureInitials = schema.measureColumns.map((c) => c.initialSql).join(', ');

  const setList = [
    ...schema.measureColumns.map((c) => `${q(c.name)} = ${c.deltaSql}`),
    `${q('last_event_id')} = excluded.${q('last_event_id')}`,
    `${q('applied_at')} = excluded.${q('applied_at')}`,
  ].join(', ');

  const sql =
    `INSERT INTO ${q(schema.tableName)}(${groupColsSql}, ${measureColsSql}, ${q('last_event_id')}, ${q('applied_at')})\n` +
    `VALUES (${groupPlaceholders}, ${measureInitials}, ?, ?)\n` +
    `ON CONFLICT(${groupColsSql}) DO UPDATE SET ${setList}`;

  const deltaBindings: DerivedColumnBinding[] = [
    ...schema.groupColumns.map((c) => c.binding),
    ...schema.measureColumns.flatMap((c) => c.bindings ?? []),
    { kind: 'eventId' },
    { kind: 'appliedAt' },
  ];

  return { deltaSql: sql, deltaBindings };
}

function q(id: string): string {
  return `"${id.replace(/"/g, '""')}"`;
}
