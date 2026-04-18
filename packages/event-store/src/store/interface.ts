import type BetterSqlite3 from 'better-sqlite3';
import type { EventEnvelope } from '../types/envelope.js';
import type { AppendRequest, AppendResult } from '../types/append.js';

export type ReadFromOptions = Readonly<{
  afterId: number;
  limit: number;
}>;

export type EventRecord = Readonly<{
  id: number;
  envelope: EventEnvelope;
}>;

export type AppendRawOptions = Readonly<{
  ignoreDuplicates?: boolean;
}>;

export type DeliveryAttemptRow = Readonly<{
  eventId: string;
  firstAttemptAt: string;
  lastAttemptAt: string;
  attemptCount: number;
  lastError: string | null;
  deliveredAt: string | null;
  dlqAt: string | null;
}>;

export interface EventStore {
  appendEvents(requests: readonly AppendRequest[]): AppendResult[];
  readStream(subject: string): EventEnvelope[];
  readFrom(opts: ReadFromOptions): EventEnvelope[];
  readRecordsFrom(opts: ReadFromOptions): EventRecord[];
  readCursor(relayId: string): number;
  writeCursor(relayId: string, lastEventId: number): void;
  /** Returns null when no attempt has been recorded for this event yet. */
  readDeliveryAttempt(eventId: string): DeliveryAttemptRow | null;

  /**
   * UPSERT the tracking row. On first call for `eventId`, inserts with
   * `attempt_count=1`, `first_attempt_at=nowIso`, `last_attempt_at=nowIso`.
   * On subsequent calls, increments `attempt_count` and updates `last_attempt_at`.
   */
  recordDeliveryAttempt(eventId: string, nowIso: string): void;

  /** Null clears the column; non-null string sets it (caller truncates). */
  updateLastError(eventId: string, message: string | null): void;

  /** Sets `delivered_at = nowIso`. Row must already exist (caller has recorded at least one attempt). */
  markDelivered(eventId: string, nowIso: string): void;

  /** Sets `dlq_at = nowIso`. Row must already exist. */
  markDlq(eventId: string, nowIso: string): void;
  appendRaw(envelopes: readonly EventEnvelope[], opts?: AppendRawOptions): void;

  /**
   * Return the underlying SQLite `Database` handle.
   *
   * Exposed for db-studio mount only. Consumers MUST NOT issue writes through
   * this handle — doing so bypasses append semantics, monotonic cursor, and
   * relay invariants.
   */
  getDbHandle(): BetterSqlite3.Database;
}
