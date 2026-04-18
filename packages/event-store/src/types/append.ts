import type { ActorRef } from './actor.js';

/**
 * One event the caller wants appended. Caller is responsible for generating
 * `id` (UUIDv7 recommended) and `time` — the store does not mint these to
 * keep the contract deterministic for testing / replay.
 */
export type AppendEventInput = Readonly<{
  id: string;
  eventType: string;
  rntAggregateType: string;
  rntAggregateId: string;
  time: string;
  actor: ActorRef | null;
  data: unknown;
  rntSchemaVersion: number;
  correlationId: string;
  causationId: string | null;
  commandId: string | null;
  traceparent: string | null;
}>;

/**
 * One subject's worth of events to append atomically. `expectedVersion` is the
 * caller-observed MAX(version) before this append (0 for a brand new subject).
 * Omitted ⇒ skip the pre-check and rely on UNIQUE(subject,version) alone.
 */
export type AppendRequest = Readonly<{
  subject: string;
  expectedVersion?: number;
  events: readonly AppendEventInput[];
}>;

export type AppendedEvent = Readonly<{
  id: string;
  version: number;
  rowId: number;
}>;

export type AppendResult = Readonly<{
  subject: string;
  lastVersion: number;
  appendedEvents: readonly AppendedEvent[];
}>;
