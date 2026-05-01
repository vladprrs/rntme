import type { EventEnvelope } from '../types/envelope.js';
import type { ActorRef } from '../types/actor.js';
import { isActorRefKind } from '../types/actor.js';

export type EventLogRow = Readonly<{
  id: number;
  subject: string;
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
  correlation_id: string;
  causation_id: string | null;
  command_id: string | null;
  traceparent: string | null;
}>;

export function rowToEnvelope(row: EventLogRow, serviceName: string): EventEnvelope {
  const source = `rntme://${serviceName}/${row.aggregate_type}`;
  const type = `${serviceName}.${row.aggregate_type}.${row.event_type}`;
  const dataSchema = `rntme://schemas/${serviceName}/${row.event_type}.v${row.schema_version}.json`;
  const actorKind = toActorKind(row.actor_kind, row.event_id);
  return {
    id: row.event_id,
    source,
    eventType: row.event_type,
    type,
    time: row.occurred_at,
    subject: row.subject,
    dataContentType: 'application/json',
    dataSchema,
    data: JSON.parse(row.payload_json) as unknown,
    correlationId: row.correlation_id,
    causationId: row.causation_id,
    commandId: row.command_id,
    rntAggregateType: row.aggregate_type,
    rntAggregateId: row.aggregate_id,
    rntVersion: row.version,
    rntSchemaVersion: row.schema_version,
    rntActorKind: actorKind,
    rntActorId: actorKind === null ? null : row.actor_id,
    traceparent: row.traceparent,
  };
}

function toActorKind(kind: string | null, eventId: string): ActorRef['kind'] | null {
  if (kind === null) return null;
  if (isActorRefKind(kind)) return kind;
  // Write-time validation forbids any other value. Seeing one here means row
  // corruption — surface loudly so the actor_id is not silently dropped.
  throw new Error(
    `EVENT_STORE_ROW_INVALID_ACTORKIND: event_log row ${eventId} has actor_kind="${kind}" (must be user|system|service or null)`,
  );
}
