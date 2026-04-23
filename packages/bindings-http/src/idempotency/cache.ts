import type BetterSqlite3 from 'better-sqlite3';

const TTL_MS = 24 * 3600 * 1000;

const DDL = `
CREATE TABLE IF NOT EXISTS idempotency_cache (
  command_name TEXT NOT NULL,
  key TEXT NOT NULL,
  status INTEGER NOT NULL,
  body TEXT NOT NULL,
  headers_json TEXT,
  stored_at INTEGER NOT NULL,
  PRIMARY KEY (command_name, key)
);
`;

const MIGRATE_ADD_HEADERS = `ALTER TABLE idempotency_cache ADD COLUMN headers_json TEXT`;

export type CachedResponse = {
  status: number;
  body: string;
  headers?: Record<string, string>;
};

export class IdempotencyCache {
  constructor(private readonly db: BetterSqlite3.Database) {
    db.exec(DDL);
    try {
      db.exec(MIGRATE_ADD_HEADERS);
    } catch {
      // Existing databases already have the column.
    }
  }

  set(commandName: string, key: string, response: CachedResponse, now: number): void {
    this.db.prepare(
      `INSERT OR REPLACE INTO idempotency_cache (command_name, key, status, body, headers_json, stored_at) VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      commandName,
      key,
      response.status,
      response.body,
      response.headers !== undefined ? JSON.stringify(response.headers) : null,
      now,
    );
  }

  get(commandName: string, key: string, now: number): CachedResponse | null {
    const row = this.db.prepare(
      `SELECT status, body, headers_json, stored_at FROM idempotency_cache WHERE command_name = ? AND key = ?`,
    ).get(commandName, key) as
      | { status: number; body: string; headers_json: string | null; stored_at: number }
      | undefined;
    if (row === undefined) return null;
    if (now - row.stored_at > TTL_MS) return null;
    const out: CachedResponse = { status: row.status, body: row.body };
    if (row.headers_json !== null) {
      out.headers = JSON.parse(row.headers_json) as Record<string, string>;
    }
    return out;
  }

  pruneExpired(now: number): number {
    const result = this.db.prepare(
      `DELETE FROM idempotency_cache WHERE stored_at < ?`,
    ).run(now - TTL_MS);
    return result.changes;
  }
}
