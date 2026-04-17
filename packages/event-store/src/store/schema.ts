import type { Database as BetterSqliteDatabase } from 'better-sqlite3';

const DDL = `
CREATE TABLE IF NOT EXISTS event_log (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  stream          TEXT    NOT NULL,
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
  UNIQUE (stream, version)
);

CREATE INDEX IF NOT EXISTS idx_event_log_stream       ON event_log(stream, version);
CREATE INDEX IF NOT EXISTS idx_event_log_undelivered  ON event_log(id);

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
