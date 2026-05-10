import type { SqliteDatabase } from '@rntme/sqlite';
import type { ProjectionDdlSpec } from '@rntme/qsm';

function toIfNotExists(sql: string): string {
  return sql
    .replace(/^CREATE TABLE(?!\s+IF NOT EXISTS)/i, 'CREATE TABLE IF NOT EXISTS')
    .replace(/^CREATE INDEX(?!\s+IF NOT EXISTS)/i, 'CREATE INDEX IF NOT EXISTS');
}

/**
 * DDL for the shared idempotency side-table used by derived projections
 * (D5 §6.5 / Task 18). Composite key (event_id, projection_id) guarantees that
 * each (eventId, projectionName) pair is applied at most once; `applied_at`
 * drives retention sweeps.
 */
const SEEN_EVENTS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS seen_events (
  event_id       TEXT NOT NULL,
  projection_id  TEXT NOT NULL,
  applied_at     TEXT NOT NULL,
  PRIMARY KEY (event_id, projection_id)
)
`.trim();

const SEEN_EVENTS_INDEX_SQL =
  'CREATE INDEX IF NOT EXISTS idx_seen_events_applied ON seen_events(applied_at)';

export function bootstrapProjections(db: SqliteDatabase, ddls: readonly ProjectionDdlSpec[]): void {
  for (const spec of ddls) {
    db.exec(toIfNotExists(spec.createTableSql));
    for (const indexSql of spec.createIndexSql) {
      db.exec(toIfNotExists(indexSql));
    }
  }
  // Always-present idempotency side-table for derived projections (runs
  // regardless of whether any projection DDLs were supplied).
  db.exec(SEEN_EVENTS_TABLE_SQL);
  db.exec(SEEN_EVENTS_INDEX_SQL);
}
