import type { Database } from 'better-sqlite3';
import type { ProjectionDdlSpec } from '@rntme/qsm';

function toIfNotExists(sql: string): string {
  return sql
    .replace(/^CREATE TABLE(?!\s+IF NOT EXISTS)/i, 'CREATE TABLE IF NOT EXISTS')
    .replace(/^CREATE INDEX(?!\s+IF NOT EXISTS)/i, 'CREATE INDEX IF NOT EXISTS');
}

export function bootstrapProjections(db: Database, ddls: readonly ProjectionDdlSpec[]): void {
  for (const spec of ddls) {
    db.exec(toIfNotExists(spec.createTableSql));
    for (const indexSql of spec.createIndexSql) {
      db.exec(toIfNotExists(indexSql));
    }
  }
}
