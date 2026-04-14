import type { EventEnvelope } from '../types/envelope.js';
import type { ActorRef } from '../types/actor.js';

export type EventLogRow = Readonly<{
  id: number;
  stream: string;
  aggregate_type: string;
  aggregate_id: string;
  version: number;
  event_type: string;
  event_id: string;
  actor_kind: string | null;
  actor_id: string | null;
  occurred_at: string;
  payload_json: string;
  schema_version: number;
}>;

export function rowToEnvelope(row: EventLogRow): EventEnvelope {
  return {
    eventId: row.event_id,
    eventType: row.event_type,
    aggregateType: row.aggregate_type,
    aggregateId: row.aggregate_id,
    stream: row.stream,
    version: row.version,
    occurredAt: row.occurred_at,
    actor: toActor(row.actor_kind, row.actor_id),
    payload: JSON.parse(row.payload_json) as unknown,
    schemaVersion: row.schema_version,
  };
}

function toActor(kind: string | null, id: string | null): ActorRef | null {
  if (kind === null || id === null) return null;
  if (kind === 'user' || kind === 'system' || kind === 'service') {
    return { kind, id };
  }
  return null;
}
