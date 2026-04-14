import type { ActorRef } from './actor.js';

/**
 * One event the caller wants appended. Caller is responsible for generating
 * `eventId` (UUIDv7 recommended) and `occurredAt` — the store does not mint
 * these to keep the contract deterministic for testing / replay.
 */
export type AppendEventInput = Readonly<{
  eventId: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  occurredAt: string;
  actor: ActorRef | null;
  payload: unknown;
  schemaVersion: number;
}>;

/**
 * One stream's worth of events to append atomically. `expectedVersion` is the
 * caller-observed MAX(version) before this append (0 for a brand new stream).
 * Omitted ⇒ skip the pre-check and rely on UNIQUE(stream,version) alone.
 */
export type AppendRequest = Readonly<{
  stream: string;
  expectedVersion?: number;
  events: readonly AppendEventInput[];
}>;

export type AppendedEvent = Readonly<{
  eventId: string;
  version: number;
  id: number;
}>;

export type AppendResult = Readonly<{
  stream: string;
  lastVersion: number;
  appendedEvents: readonly AppendedEvent[];
}>;
