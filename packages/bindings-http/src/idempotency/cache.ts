import type BetterSqlite3 from 'better-sqlite3';

const TTL_MS = 24 * 3600 * 1000;

const DDL = `
CREATE TABLE IF NOT EXISTS idempotency_cache (
  command_name TEXT NOT NULL,
  key TEXT NOT NULL,
  status INTEGER NOT NULL,
  body TEXT NOT NULL,
  stored_at INTEGER NOT NULL,
  PRIMARY KEY (command_name, key)
);
`;

export type CachedResponse = { status: number; body: string };

export class IdempotencyCache {
  constructor(private readonly db: BetterSqlite3.Database) {
    db.exec(DDL);
  }

  set(commandName: string, key: string, response: CachedResponse, now: number): void {
    this.db.prepare(
      `INSERT OR REPLACE INTO idempotency_cache (command_name, key, status, body, stored_at) VALUES (?, ?, ?, ?, ?)`,
    ).run(commandName, key, response.status, response.body, now);
  }

  get(commandName: string, key: string, now: number): CachedResponse | null {
    const row = this.db.prepare(
      `SELECT status, body, stored_at FROM idempotency_cache WHERE command_name = ? AND key = ?`,
    ).get(commandName, key) as { status: number; body: string; stored_at: number } | undefined;
    if (row === undefined) return null;
    if (now - row.stored_at > TTL_MS) return null;
    return { status: row.status, body: row.body };
  }

  pruneExpired(now: number): number {
    const result = this.db.prepare(
      `DELETE FROM idempotency_cache WHERE stored_at < ?`,
    ).run(now - TTL_MS);
    return result.changes;
  }
}
