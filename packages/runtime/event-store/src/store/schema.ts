import type { SqliteDatabase } from '@rntme/sqlite';

const EVENT_LOG_COLUMNS = [
  'id',
  'subject',
  'aggregate_type',
  'aggregate_id',
  'version',
  'event_type',
  'event_id',
  'actor_kind',
  'actor_id',
  'occurred_at',
  'payload_json',
  'schema_version',
  'correlation_id',
  'causation_id',
  'command_id',
  'traceparent',
] as const;

const EVENT_LOG_INDEX_DDL = `
CREATE INDEX IF NOT EXISTS idx_event_log_subject      ON event_log(subject, version);
CREATE INDEX IF NOT EXISTS idx_event_log_undelivered  ON event_log(id);
CREATE INDEX IF NOT EXISTS idx_event_log_correlation  ON event_log(correlation_id);
CREATE INDEX IF NOT EXISTS idx_event_log_causation    ON event_log(causation_id);
CREATE INDEX IF NOT EXISTS idx_event_log_command      ON event_log(command_id);
`;

const OTHER_DDL = `
CREATE TABLE IF NOT EXISTS publish_cursor (
  relay_id        TEXT PRIMARY KEY,
  last_event_id   INTEGER NOT NULL,
  updated_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS delivery_tracking (
  event_id          TEXT PRIMARY KEY,
  first_attempt_at  TEXT NOT NULL,
  last_attempt_at   TEXT NOT NULL,
  attempt_count     INTEGER NOT NULL,
  last_error        TEXT,
  delivered_at      TEXT,
  dlq_at            TEXT
);

CREATE TABLE IF NOT EXISTS event_store_metadata (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
`;

function eventLogTableDdl(tableName: string, ifNotExists: boolean): string {
  return `
CREATE TABLE ${ifNotExists ? 'IF NOT EXISTS ' : ''}${tableName} (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  subject         TEXT    NOT NULL,
  aggregate_type  TEXT    NOT NULL,
  aggregate_id    TEXT    NOT NULL,
  version         INTEGER NOT NULL,
  event_type      TEXT    NOT NULL,
  event_id        TEXT    NOT NULL UNIQUE,
  actor_kind      TEXT CHECK (actor_kind IS NULL OR actor_kind IN ('user','system','service')),
  actor_id        TEXT,
  occurred_at     TEXT    NOT NULL,
  payload_json    TEXT    NOT NULL,
  schema_version  INTEGER NOT NULL DEFAULT 1,
  correlation_id  TEXT    NOT NULL,
  causation_id    TEXT,
  command_id      TEXT,
  traceparent     TEXT,
  UNIQUE (subject, version)
);
`;
}

export function applyEventStoreSchema(db: SqliteDatabase): void {
  db.exec(`${eventLogTableDdl('event_log', true)}\n${OTHER_DDL}`);
  ensureEventLogActorKindCheck(db);
  db.exec(EVENT_LOG_INDEX_DDL);
}

/**
 * Guards against running a post-D9 build against a pre-D9 event_log schema.
 * Per spec §8 / §10, the D9 sentinel column is `correlation_id`. If the table
 * exists but lacks it, throws with error message starting
 * `EVENT_STORE_SCHEMA_INCOMPATIBLE`. If the table does not exist yet, this is
 * a no-op (applyEventStoreSchema will create it).
 */
export function assertSchemaD9Compatible(db: SqliteDatabase): void {
  const cols = db.prepare('PRAGMA table_info(event_log)').all() as {
    name: string;
  }[];
  if (cols.length === 0) return;
  const names = new Set(cols.map((c) => c.name));
  if (!names.has('correlation_id')) {
    throw new Error(
      `EVENT_STORE_SCHEMA_INCOMPATIBLE: event_log missing column 'correlation_id'. ` +
        `This build is post-D9; drop the sqlite file and re-run with a fresh database.`,
    );
  }
  const table = db
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='event_log'")
    .get() as { sql: string | null } | undefined;
  if (table?.sql !== null && table?.sql !== undefined && !hasActorKindCheck(table.sql)) {
    throw new Error(
      `EVENT_STORE_SCHEMA_INCOMPATIBLE: event_log missing actor_kind CHECK constraint. ` +
        `Run applyEventStoreSchema before opening with applySchema=false.`,
    );
  }
}

function ensureEventLogActorKindCheck(db: SqliteDatabase): void {
  const table = db
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='event_log'")
    .get() as { sql: string | null } | undefined;
  if (table?.sql === null || table?.sql === undefined || hasActorKindCheck(table.sql)) return;
  assertNoInvalidActorKinds(db);
  rebuildEventLogWithActorKindCheck(db);
}

function hasActorKindCheck(sql: string): boolean {
  return /actor_kind\s+IN\s*\(\s*'user'\s*,\s*'system'\s*,\s*'service'\s*\)/i.test(sql);
}

function assertNoInvalidActorKinds(db: SqliteDatabase): void {
  const invalid = db
    .prepare(
      `SELECT event_id, actor_kind
       FROM event_log
       WHERE actor_kind IS NOT NULL
         AND actor_kind NOT IN ('user','system','service')
       LIMIT 1`,
    )
    .get() as { event_id: string; actor_kind: string } | undefined;
  if (invalid === undefined) return;
  throw new Error(
    `EVENT_STORE_SCHEMA_INCOMPATIBLE: event_log row ${invalid.event_id} has actor_kind="${invalid.actor_kind}" ` +
      `(must be user|system|service or null)`,
  );
}

function rebuildEventLogWithActorKindCheck(db: SqliteDatabase): void {
  const columns = EVENT_LOG_COLUMNS.join(', ');
  const rebuild = db.transaction(() => {
    db.exec('DROP TABLE IF EXISTS event_log_checked;');
    db.exec(eventLogTableDdl('event_log_checked', false));
    db.prepare(`INSERT INTO event_log_checked (${columns}) SELECT ${columns} FROM event_log`).run();
    db.exec(`
      DROP TABLE event_log;
      ALTER TABLE event_log_checked RENAME TO event_log;
    `);
  });
  rebuild();
}
