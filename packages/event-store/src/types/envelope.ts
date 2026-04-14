import type { ActorRef } from './actor.js';

/**
 * Event envelope (spec §3.2). Payload is generic so downstream packages can
 * use a discriminated union keyed by `eventType`.
 */
export type EventEnvelope<TPayload = unknown> = Readonly<{
  eventId: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  stream: string;
  version: number;
  occurredAt: string;
  actor: ActorRef | null;
  payload: TPayload;
  schemaVersion: number;
}>;
