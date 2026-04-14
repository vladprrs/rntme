import type { Database } from 'better-sqlite3';
import type { ProjectionDdlSpec } from '@rntme/qsm';

/** `CREATE TABLE …` → `CREATE TABLE IF NOT EXISTS …` */
export function toIfNotExistsCreateTable(sql: string): string {
  return sql.replace(/^\s*CREATE\s+TABLE\s+/i, 'CREATE TABLE IF NOT EXISTS ');
}

/** `CREATE INDEX …` → `CREATE INDEX IF NOT EXISTS …` */
export function toIfNotExistsCreateIndex(sql: string): string {
  return sql.replace(/^\s*CREATE\s+INDEX\s+/i, 'CREATE INDEX IF NOT EXISTS ');
}

export function bootstrapProjections(db: Database, ddls: readonly ProjectionDdlSpec[]): void {
  for (const ddl of ddls) {
    db.exec(toIfNotExistsCreateTable(ddl.createTableSql));
    for (const indexSql of ddl.createIndexSql) {
      db.exec(toIfNotExistsCreateIndex(indexSql));
    }
  }
}
