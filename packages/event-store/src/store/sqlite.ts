import Database from 'better-sqlite3';
import type { Database as BetterSqliteDatabase } from 'better-sqlite3';
import type { EventEnvelope } from '../types/envelope.js';
import type { AppendRequest, AppendResult } from '../types/append.js';
import { ConcurrencyConflict, DuplicateEventId } from '../types/errors.js';
import type { EventRecord, EventStore, ReadFromOptions } from './interface.js';
import { applyEventStoreSchema } from './schema.js';
import { rowToEnvelope, type EventLogRow } from './row-mapper.js';

export type SqliteEventStoreOptions = Readonly<{
  filename: string;
  applySchema?: boolean;
  busyTimeoutMs?: number;
}>;

export class SqliteEventStore implements EventStore {
  private readonly db: BetterSqliteDatabase;

  constructor(options: SqliteEventStoreOptions) {
    this.db = new Database(options.filename);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma(`busy_timeout = ${options.busyTimeoutMs ?? 5000}`);
    this.db.pragma('foreign_keys = ON');
    if (options.applySchema !== false) {
      applyEventStoreSchema(this.db);
    }
  }

  close(): void {
    this.db.close();
  }

  /** Test / advanced use only: direct handle for fixtures or custom queries. */
  rawDb(): BetterSqliteDatabase {
    return this.db;
  }

  appendEvents(requests: readonly AppendRequest[]): AppendResult[] {
    const selectMax = this.db.prepare(
      'SELECT COALESCE(MAX(version), 0) AS v FROM event_log WHERE stream = ?',
    );
    const insert = this.db.prepare(`
      INSERT INTO event_log
        (stream, aggregate_type, aggregate_id, version, event_type, event_id,
         actor_kind, actor_id, occurred_at, payload_json, schema_version)
      VALUES
        (@stream, @aggregate_type, @aggregate_id, @version, @event_type, @event_id,
         @actor_kind, @actor_id, @occurred_at, @payload_json, @schema_version)
    `);

    const run = this.db.transaction((reqs: readonly AppendRequest[]): AppendResult[] => {
      const out: AppendResult[] = [];
      for (const req of reqs) {
        const { v: current } = selectMax.get(req.stream) as { v: number };
        if (req.expectedVersion !== undefined && req.expectedVersion !== current) {
          throw new ConcurrencyConflict(req.stream, req.expectedVersion, current);
        }
        const appended: { eventId: string; version: number; id: number }[] = [];
        for (let i = 0; i < req.events.length; i++) {
          const e = req.events[i]!;
          const version = current + i + 1;
          let info: Database.RunResult;
          try {
            info = insert.run({
              stream: req.stream,
              aggregate_type: e.aggregateType,
              aggregate_id: e.aggregateId,
              version,
              event_type: e.eventType,
              event_id: e.eventId,
              actor_kind: e.actor?.kind ?? null,
              actor_id: e.actor?.id ?? null,
              occurred_at: e.occurredAt,
              payload_json: JSON.stringify(e.payload),
              schema_version: e.schemaVersion,
            });
          } catch (err) {
            throw mapSqliteError(err, req.stream, req.expectedVersion, version, e.eventId);
          }
          appended.push({
            eventId: e.eventId,
            version,
            id: Number(info.lastInsertRowid),
          });
        }
        out.push({
          stream: req.stream,
          lastVersion: current + req.events.length,
          appendedEvents: appended,
        });
      }
      return out;
    });

    return run.immediate(requests);
  }
  readStream(stream: string): EventEnvelope[] {
    const rows = this.db
      .prepare('SELECT * FROM event_log WHERE stream = ? ORDER BY version ASC')
      .all(stream) as EventLogRow[];
    return rows.map(rowToEnvelope);
  }
  readFrom(opts: ReadFromOptions): EventEnvelope[] {
    const rows = this.db
      .prepare('SELECT * FROM event_log WHERE id > ? ORDER BY id ASC LIMIT ?')
      .all(opts.afterId, opts.limit) as EventLogRow[];
    return rows.map(rowToEnvelope);
  }
  readRecordsFrom(opts: ReadFromOptions): EventRecord[] {
    const rows = this.db
      .prepare('SELECT * FROM event_log WHERE id > ? ORDER BY id ASC LIMIT ?')
      .all(opts.afterId, opts.limit) as EventLogRow[];
    return rows.map((row) => ({ id: row.id, envelope: rowToEnvelope(row) }));
  }
  readCursor(relayId: string): number {
    const row = this.db
      .prepare('SELECT last_event_id AS v FROM publish_cursor WHERE relay_id = ?')
      .get(relayId) as { v: number } | undefined;
    return row?.v ?? 0;
  }

  writeCursor(relayId: string, lastEventId: number): void {
    const existing = this.readCursor(relayId);
    if (lastEventId < existing) {
      throw new Error(
        `publish_cursor[${relayId}] must be monotonic: tried ${lastEventId} < existing ${existing}`,
      );
    }
    this.db.prepare(`
      INSERT INTO publish_cursor (relay_id, last_event_id, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(relay_id) DO UPDATE SET
        last_event_id = excluded.last_event_id,
        updated_at = excluded.updated_at
    `).run(relayId, lastEventId, new Date().toISOString());
  }
}

export function mapSqliteError(
  err: unknown,
  stream: string,
  expectedVersion: number | undefined,
  attemptedVersion: number,
  eventId?: string,
): Error {
  if (!(err instanceof Error)) return new Error(String(err));
  const code = (err as Error & { code?: string }).code ?? '';
  const msg = err.message;
  if (code === 'SQLITE_CONSTRAINT_UNIQUE' || code === 'SQLITE_CONSTRAINT') {
    if (/event_id/.test(msg)) {
      return new DuplicateEventId(eventId ?? '<unknown>');
    }
    if (/stream.*version|version.*stream/.test(msg)) {
      return new ConcurrencyConflict(stream, expectedVersion, attemptedVersion);
    }
  }
  return err;
}
