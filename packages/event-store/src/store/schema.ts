import type { Database as BetterSqliteDatabase } from 'better-sqlite3';

const DDL = `
CREATE TABLE IF NOT EXISTS event_log (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  subject         TEXT    NOT NULL,
  aggregate_type  TEXT    NOT NULL,
  aggregate_id    TEXT    NOT NULL,
  version         INTEGER NOT NULL,
  event_type      TEXT    NOT NULL,
  event_id        TEXT    NOT NULL UNIQUE,
  actor_kind      TEXT,
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

CREATE INDEX IF NOT EXISTS idx_event_log_subject      ON event_log(subject, version);
CREATE INDEX IF NOT EXISTS idx_event_log_undelivered  ON event_log(id);
CREATE INDEX IF NOT EXISTS idx_event_log_correlation  ON event_log(correlation_id);
CREATE INDEX IF NOT EXISTS idx_event_log_causation    ON event_log(causation_id);
CREATE INDEX IF NOT EXISTS idx_event_log_command      ON event_log(command_id);

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
`;

export function applyEventStoreSchema(db: BetterSqliteDatabase): void {
  db.exec(DDL);
}

/**
 * Guards against running a post-D9 build against a pre-D9 event_log schema.
 * Per spec §8 / §10, the D9 sentinel column is `correlation_id`. If the table
 * exists but lacks it, throws with error message starting
 * `EVENT_STORE_SCHEMA_INCOMPATIBLE`. If the table does not exist yet, this is
 * a no-op (applyEventStoreSchema will create it).
 */
export function assertSchemaD9Compatible(db: BetterSqliteDatabase): void {
  const cols = db.prepare("PRAGMA table_info(event_log)").all() as { name: string }[];
  if (cols.length === 0) return;
  const names = new Set(cols.map((c) => c.name));
  if (!names.has('correlation_id')) {
    throw new Error(
      `EVENT_STORE_SCHEMA_INCOMPATIBLE: event_log missing column 'correlation_id'. ` +
      `This build is post-D9; drop the sqlite file and re-run with a fresh database.`,
    );
  }
}
