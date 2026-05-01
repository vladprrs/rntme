import type { ActorRef } from './actor.js';

/**
 * CloudEvents 1.0 envelope (spec 2026-04-17-cloudevents-envelope-design §3.1).
 * In-memory shape is camelCase; wire form (Kafka binary content mode) is
 * lowercase `ce_*`; conversion is via `toCloudEventWire` / `fromCloudEventWire`.
 */
export type EventEnvelope<TPayload = unknown> = Readonly<{
  // Standard CloudEvents attributes
  id: string;
  source: string;                          // `rntme://${serviceName}/${rntAggregateType}`
  eventType: string;                       // short local name (e.g. "IssueCreated")
  type: string;                            // `${serviceName}.${rntAggregateType}.${eventType}`
  time: string;                            // RFC3339
  subject: string;                         // `${rntAggregateType}-${rntAggregateId}` (== stream)
  dataContentType: 'application/json';
  dataSchema: string;                      // `rntme://schemas/${serviceName}/${eventType}.v${rntSchemaVersion}.json`
  data: TPayload;

  // rntme extensions
  correlationId: string;
  causationId: string | null;
  commandId: string | null;
  rntAggregateType: string;
  rntAggregateId: string;
  rntVersion: number;
  rntSchemaVersion: number;
  rntActorKind: ActorRef['kind'] | null;
  rntActorId: string | null;
  traceparent: string | null;
}>;
