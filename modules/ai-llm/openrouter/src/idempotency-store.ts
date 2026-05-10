import { Database } from 'bun:sqlite';

export interface IdempotencyStore {
  get(key: string): Promise<Buffer | null>;
  put(key: string, payload: Buffer): Promise<void>;
  evictExpired(): Promise<number>;
  close(): Promise<void>;
}

export type IdempotencyStoreOptions =
  | { mode: 'sqlite'; path: string; ttlMs: number; now?: () => number }
  | { mode: 'memory'; ttlMs: number; now?: () => number };

const DEFAULT_NOW = (): number => Date.now();

export function createIdempotencyStore(opts: IdempotencyStoreOptions): IdempotencyStore {
  const now = opts.now ?? DEFAULT_NOW;
  if (opts.mode === 'memory') return createMemoryStore(opts.ttlMs, now);
  return createSqliteStore(opts.path, opts.ttlMs, now);
}

function createMemoryStore(ttlMs: number, now: () => number): IdempotencyStore {
  const map = new Map<string, { bytes: Buffer; createdAt: number }>();
  return {
    async get(key) {
      const row = map.get(key);
      if (!row) return null;
      if (now() - row.createdAt > ttlMs) {
        map.delete(key);
        return null;
      }
      return row.bytes;
    },
    async put(key, payload) {
      map.set(key, { bytes: payload, createdAt: now() });
    },
    async evictExpired() {
      let removed = 0;
      const cutoff = now() - ttlMs;
      for (const [k, v] of map.entries()) {
        if (v.createdAt < cutoff) {
          map.delete(k);
          removed++;
        }
      }
      return removed;
    },
    async close() {
      map.clear();
    },
  };
}

function createSqliteStore(path: string, ttlMs: number, now: () => number): IdempotencyStore {
  const db = new Database(path, { create: true });
  db.exec('PRAGMA journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS idempotency_records (
      idempotency_key TEXT PRIMARY KEY,
      completion_proto BLOB NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_created_at ON idempotency_records(created_at);
  `);

  const stmtGet = db.query<{ completion_proto: Uint8Array }, [string, number]>(
    `SELECT completion_proto FROM idempotency_records WHERE idempotency_key = ? AND created_at >= ?`,
  );
  const stmtPut = db.query<unknown, [string, Buffer, number]>(
    `INSERT OR REPLACE INTO idempotency_records (idempotency_key, completion_proto, created_at) VALUES (?, ?, ?)`,
  );
  const stmtEvict = db.query<unknown, [number]>(
    `DELETE FROM idempotency_records WHERE created_at < ?`,
  );

  return {
    async get(key) {
      const row = stmtGet.get(key, now() - ttlMs);
      return row ? Buffer.from(row.completion_proto) : null;
    },
    async put(key, payload) {
      stmtPut.run(key, payload, now());
    },
    async evictExpired() {
      const info = stmtEvict.run(now() - ttlMs);
      return info.changes;
    },
    async close() {
      db.close();
    },
  };
}
