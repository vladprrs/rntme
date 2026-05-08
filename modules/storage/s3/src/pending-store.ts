type DbRunResult = { changes: number; lastInsertRowid: number | bigint };

type Stmt<P extends unknown[] = unknown[], R = unknown> = {
  run(...args: P): DbRunResult;
  get(...args: P): R | undefined;
  all(...args: P): R[];
};

export interface DatabaseLike {
  prepare<P extends unknown[] = unknown[], R = unknown>(sql: string): Stmt<P, R>;
  exec(sql: string): void;
  pragma?(s: string): void;
}

export type FileState = 'pending' | 'committed' | 'aborted' | 'deleted';

export interface FileRow {
  fileId: string;
  routeId: string;
  entityId: string;
  ownerPrincipal: string;
  state: FileState;
  contentType: string;
  declaredSize: number | null;
  actualSize: number | null;
  sha256: string | null;
  objectKey: string;
  initiatedAt: number;
  expiresAt: number;
  committedAt: number | null;
  deletedAt: number | null;
  idempotencyKey: string | null;
}

export interface InsertPendingArgs {
  fileId: string;
  routeId: string;
  entityId: string;
  ownerPrincipal: string;
  contentType: string;
  declaredSize: number;
  objectKey: string;
  ttlMs: number;
  idempotencyKey?: string;
}

export interface InsertResult {
  fileId: string;
  deduped: boolean;
  expiresAt: number;
  objectKey: string;
}

export interface PendingStore {
  insertPending(args: InsertPendingArgs): InsertResult;
  findById(fileId: string): FileRow | null;
  markCommitted(fileId: string, info: { actualSize: number; sha256: string }): void;
  markAborted(fileId: string, reason?: string): void;
  markDeleted(fileId: string): void;
  listCommitted(routeId: string, entityId: string, limit: number): FileRow[];
  countCommitted(routeId: string, entityId: string): number;
  findStalePending(now: number): FileRow[];
  close(): void;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS files (
  file_id          TEXT PRIMARY KEY,
  route_id         TEXT NOT NULL,
  entity_id        TEXT NOT NULL,
  owner_principal  TEXT NOT NULL,
  state            TEXT NOT NULL,
  content_type     TEXT NOT NULL,
  declared_size    INTEGER,
  actual_size      INTEGER,
  sha256           TEXT,
  object_key       TEXT NOT NULL,
  initiated_at     INTEGER NOT NULL,
  expires_at       INTEGER NOT NULL,
  committed_at     INTEGER,
  deleted_at       INTEGER,
  idempotency_key  TEXT
);
CREATE INDEX IF NOT EXISTS idx_files_route_entity ON files (route_id, entity_id, state, committed_at DESC);
CREATE INDEX IF NOT EXISTS idx_files_pending_expiry ON files (state, expires_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_files_idem ON files (route_id, entity_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
`;

function rowToFile(r: Record<string, unknown>): FileRow {
  return {
    fileId: r.file_id as string,
    routeId: r.route_id as string,
    entityId: r.entity_id as string,
    ownerPrincipal: r.owner_principal as string,
    state: r.state as FileState,
    contentType: r.content_type as string,
    declaredSize: (r.declared_size as number | null) ?? null,
    actualSize: (r.actual_size as number | null) ?? null,
    sha256: (r.sha256 as string | null) ?? null,
    objectKey: r.object_key as string,
    initiatedAt: r.initiated_at as number,
    expiresAt: r.expires_at as number,
    committedAt: (r.committed_at as number | null) ?? null,
    deletedAt: (r.deleted_at as number | null) ?? null,
    idempotencyKey: (r.idempotency_key as string | null) ?? null,
  };
}

export function createPendingStore(opts: { db: DatabaseLike; now?: () => number }): PendingStore {
  const now = opts.now ?? (() => Date.now());
  const db = opts.db;
  db.pragma?.('journal_mode = WAL');
  db.exec(SCHEMA);

  const sFindById = db.prepare<[string], Record<string, unknown>>(
    'SELECT * FROM files WHERE file_id = ?',
  );
  const sFindByIdem = db.prepare<[string, string, string], Record<string, unknown>>(
    'SELECT * FROM files WHERE route_id = ? AND entity_id = ? AND idempotency_key = ?',
  );
  const sInsert = db.prepare<
    [string, string, string, string, string, number, string, number, number, string | null]
  >(`
    INSERT INTO files (file_id, route_id, entity_id, owner_principal, state, content_type, declared_size, object_key, initiated_at, expires_at, idempotency_key)
    VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?)
  `);
  const sCommit = db.prepare<[number, string, number, string]>(
    "UPDATE files SET state='committed', actual_size=?, sha256=?, committed_at=? WHERE file_id=? AND state='pending'",
  );
  const sAbort = db.prepare<[string]>(
    "UPDATE files SET state='aborted' WHERE file_id=? AND state='pending'",
  );
  const sDelete = db.prepare<[number, string]>(
    "UPDATE files SET state='deleted', deleted_at=? WHERE file_id=? AND state='committed'",
  );
  const sListCommitted = db.prepare<[string, string, number], Record<string, unknown>>(
    "SELECT * FROM files WHERE route_id=? AND entity_id=? AND state='committed' ORDER BY committed_at DESC LIMIT ?",
  );
  const sCountCommitted = db.prepare<[string, string], { c: number }>(
    "SELECT COUNT(*) AS c FROM files WHERE route_id=? AND entity_id=? AND state='committed'",
  );
  const sStale = db.prepare<[number], Record<string, unknown>>(
    "SELECT * FROM files WHERE state='pending' AND expires_at < ?",
  );

  return {
    insertPending(a) {
      if (a.idempotencyKey !== undefined) {
        const existing = sFindByIdem.get(a.routeId, a.entityId, a.idempotencyKey);
        if (existing !== undefined) {
          const f = rowToFile(existing);
          return { fileId: f.fileId, deduped: true, expiresAt: f.expiresAt, objectKey: f.objectKey };
        }
      }
      const initiatedAt = now();
      const expiresAt = initiatedAt + a.ttlMs;
      sInsert.run(
        a.fileId,
        a.routeId,
        a.entityId,
        a.ownerPrincipal,
        a.contentType,
        a.declaredSize,
        a.objectKey,
        initiatedAt,
        expiresAt,
        a.idempotencyKey ?? null,
      );
      return { fileId: a.fileId, deduped: false, expiresAt, objectKey: a.objectKey };
    },
    findById(fileId) {
      const r = sFindById.get(fileId);
      return r === undefined ? null : rowToFile(r);
    },
    markCommitted(fileId, info) {
      sCommit.run(info.actualSize, info.sha256, now(), fileId);
    },
    markAborted(fileId) {
      sAbort.run(fileId);
    },
    markDeleted(fileId) {
      sDelete.run(now(), fileId);
    },
    listCommitted(routeId, entityId, limit) {
      return sListCommitted.all(routeId, entityId, limit).map(rowToFile);
    },
    countCommitted(routeId, entityId) {
      return sCountCommitted.get(routeId, entityId)?.c ?? 0;
    },
    findStalePending(t) {
      return sStale.all(t).map(rowToFile);
    },
    close() {
      (db as unknown as { close?(): void }).close?.();
    },
  };
}
