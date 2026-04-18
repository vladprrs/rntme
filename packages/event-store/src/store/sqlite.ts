import Database from 'better-sqlite3';
import type { Database as BetterSqliteDatabase } from 'better-sqlite3';
import type { EventEnvelope } from '../types/envelope.js';
import type { AppendRequest, AppendResult } from '../types/append.js';
import { ConcurrencyConflict, DuplicateEventId } from '../types/errors.js';
import type {
  AppendRawOptions,
  DeliveryAttemptRow,
  EventRecord,
  EventStore,
  ReadFromOptions,
} from './interface.js';
import { applyEventStoreSchema, assertSchemaD9Compatible } from './schema.js';
import { rowToEnvelope, type EventLogRow } from './row-mapper.js';

export type SqliteEventStoreOptions = Readonly<{
  filename: string;
  serviceName: string;
  applySchema?: boolean;
  busyTimeoutMs?: number;
}>;

export class SqliteEventStore implements EventStore {
  private readonly db: BetterSqliteDatabase;
  private readonly serviceName: string;

  constructor(options: SqliteEventStoreOptions) {
    if (!options.serviceName || options.serviceName.length === 0) {
      throw new Error('SqliteEventStore: serviceName is required');
    }
    this.serviceName = options.serviceName;
    this.db = new Database(options.filename);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma(`busy_timeout = ${options.busyTimeoutMs ?? 5000}`);
    this.db.pragma('foreign_keys = ON');
    if (options.applySchema !== false) {
      applyEventStoreSchema(this.db);
    }
    assertSchemaD9Compatible(this.db);
  }

  close(): void {
    this.db.close();
  }

  /** Test / advanced use only: direct handle for fixtures or custom queries. */
  rawDb(): BetterSqliteDatabase {
    return this.db;
  }

  /**
   * Return the underlying SQLite `Database` handle.
   *
   * Exposed for db-studio mount. Consumers MUST NOT issue writes through this
   * handle outside event-store APIs — doing so bypasses append semantics,
   * monotonic cursor, and relay invariants.
   */
  getDbHandle(): BetterSqliteDatabase {
    return this.rawDb();
  }

  appendEvents(requests: readonly AppendRequest[]): AppendResult[] {
    const selectMax = this.db.prepare(
      'SELECT COALESCE(MAX(version), 0) AS v FROM event_log WHERE subject = ?',
    );
    const insert = this.db.prepare(`
      INSERT INTO event_log
        (subject, aggregate_type, aggregate_id, version, event_type, event_id,
         actor_kind, actor_id, occurred_at, payload_json, schema_version,
         correlation_id, causation_id, command_id, traceparent)
      VALUES
        (@subject, @aggregate_type, @aggregate_id, @version, @event_type, @event_id,
         @actor_kind, @actor_id, @occurred_at, @payload_json, @schema_version,
         @correlation_id, @causation_id, @command_id, @traceparent)
    `);

    const run = this.db.transaction((reqs: readonly AppendRequest[]): AppendResult[] => {
      const out: AppendResult[] = [];
      for (const req of reqs) {
        const { v: current } = selectMax.get(req.subject) as { v: number };
        if (req.expectedVersion !== undefined && req.expectedVersion !== current) {
          throw new ConcurrencyConflict(req.subject, req.expectedVersion, current);
        }
        const appended: { id: string; version: number; rowId: number }[] = [];
        for (let i = 0; i < req.events.length; i++) {
          const e = req.events[i]!;
          const version = current + i + 1;
          let info: Database.RunResult;
          try {
            info = insert.run({
              subject: req.subject,
              aggregate_type: e.rntAggregateType,
              aggregate_id: e.rntAggregateId,
              version,
              event_type: e.eventType,
              event_id: e.id,
              actor_kind: e.actor?.kind ?? null,
              actor_id: e.actor?.id ?? null,
              occurred_at: e.time,
              payload_json: JSON.stringify(e.data),
              schema_version: e.rntSchemaVersion,
              correlation_id: e.correlationId,
              causation_id: e.causationId,
              command_id: e.commandId,
              traceparent: e.traceparent,
            });
          } catch (err) {
            throw mapSqliteError(err, req.subject, req.expectedVersion, version, e.id);
          }
          appended.push({
            id: e.id,
            version,
            rowId: Number(info.lastInsertRowid),
          });
        }
        out.push({
          subject: req.subject,
          lastVersion: current + req.events.length,
          appendedEvents: appended,
        });
      }
      return out;
    });

    return run.immediate(requests);
  }

  appendRaw(envelopes: readonly EventEnvelope[], opts?: AppendRawOptions): void {
    const insert = this.db.prepare(`
      INSERT INTO event_log
        (subject, aggregate_type, aggregate_id, version, event_type, event_id,
         actor_kind, actor_id, occurred_at, payload_json, schema_version,
         correlation_id, causation_id, command_id, traceparent)
      VALUES
        (@subject, @aggregate_type, @aggregate_id, @version, @event_type, @event_id,
         @actor_kind, @actor_id, @occurred_at, @payload_json, @schema_version,
         @correlation_id, @causation_id, @command_id, @traceparent)
    `);

    const run = this.db.transaction((items: readonly EventEnvelope[]): void => {
      for (const e of items) {
        try {
          insert.run({
            subject: e.subject,
            aggregate_type: e.rntAggregateType,
            aggregate_id: e.rntAggregateId,
            version: e.rntVersion,
            event_type: e.eventType,
            event_id: e.id,
            actor_kind: e.rntActorKind,
            actor_id: e.rntActorId,
            occurred_at: e.time,
            payload_json: JSON.stringify(e.data),
            schema_version: e.rntSchemaVersion,
            correlation_id: e.correlationId,
            causation_id: e.causationId,
            command_id: e.commandId,
            traceparent: e.traceparent,
          });
        } catch (err) {
          const code = (err as Error & { code?: string }).code ?? '';
          const msg = err instanceof Error ? err.message : String(err);
          if (
            opts?.ignoreDuplicates &&
            (code === 'SQLITE_CONSTRAINT_UNIQUE' || code === 'SQLITE_CONSTRAINT') &&
            /event_id/.test(msg)
          ) {
            continue;
          }
          throw mapSqliteError(err, e.subject, undefined, e.rntVersion, e.id);
        }
      }
    });

    run.immediate(envelopes);
  }

  readStream(subject: string): EventEnvelope[] {
    const rows = this.db
      .prepare('SELECT * FROM event_log WHERE subject = ? ORDER BY version ASC')
      .all(subject) as EventLogRow[];
    return rows.map((r) => rowToEnvelope(r, this.serviceName));
  }
  readFrom(opts: ReadFromOptions): EventEnvelope[] {
    const rows = this.db
      .prepare('SELECT * FROM event_log WHERE id > ? ORDER BY id ASC LIMIT ?')
      .all(opts.afterId, opts.limit) as EventLogRow[];
    return rows.map((r) => rowToEnvelope(r, this.serviceName));
  }
  readRecordsFrom(opts: ReadFromOptions): EventRecord[] {
    const rows = this.db
      .prepare('SELECT * FROM event_log WHERE id > ? ORDER BY id ASC LIMIT ?')
      .all(opts.afterId, opts.limit) as EventLogRow[];
    return rows.map((row) => ({ id: row.id, envelope: rowToEnvelope(row, this.serviceName) }));
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

  readDeliveryAttempt(eventId: string): DeliveryAttemptRow | null {
    const row = this.db
      .prepare(
        `SELECT event_id, first_attempt_at, last_attempt_at, attempt_count,
                last_error, delivered_at, dlq_at
         FROM delivery_tracking WHERE event_id = ?`,
      )
      .get(eventId) as
      | {
          event_id: string;
          first_attempt_at: string;
          last_attempt_at: string;
          attempt_count: number;
          last_error: string | null;
          delivered_at: string | null;
          dlq_at: string | null;
        }
      | undefined;
    if (!row) return null;
    return {
      eventId: row.event_id,
      firstAttemptAt: row.first_attempt_at,
      lastAttemptAt: row.last_attempt_at,
      attemptCount: row.attempt_count,
      lastError: row.last_error,
      deliveredAt: row.delivered_at,
      dlqAt: row.dlq_at,
    };
  }

  recordDeliveryAttempt(eventId: string, nowIso: string): void {
    this.db.prepare(`
      INSERT INTO delivery_tracking
        (event_id, first_attempt_at, last_attempt_at, attempt_count,
         last_error, delivered_at, dlq_at)
      VALUES (?, ?, ?, 1, NULL, NULL, NULL)
      ON CONFLICT(event_id) DO UPDATE SET
        attempt_count   = attempt_count + 1,
        last_attempt_at = excluded.last_attempt_at
    `).run(eventId, nowIso, nowIso);
  }

  updateLastError(eventId: string, message: string | null): void {
    this.db
      .prepare('UPDATE delivery_tracking SET last_error = ? WHERE event_id = ?')
      .run(message, eventId);
  }

  markDelivered(eventId: string, nowIso: string): void {
    const result = this.db
      .prepare('UPDATE delivery_tracking SET delivered_at = ? WHERE event_id = ?')
      .run(nowIso, eventId);
    if (result.changes === 0) {
      throw new Error(
        `markDelivered failed: no delivery_tracking row exists for eventId="${eventId}"`,
      );
    }
  }

  markDlq(eventId: string, nowIso: string): void {
    const result = this.db
      .prepare('UPDATE delivery_tracking SET dlq_at = ? WHERE event_id = ?')
      .run(nowIso, eventId);
    if (result.changes === 0) {
      throw new Error(
        `markDlq failed: no delivery_tracking row exists for eventId="${eventId}"`,
      );
    }
  }
}

export function mapSqliteError(
  err: unknown,
  subject: string,
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
    if (/subject.*version|version.*subject/.test(msg)) {
      return new ConcurrencyConflict(subject, expectedVersion, attemptedVersion);
    }
  }
  return err;
}
