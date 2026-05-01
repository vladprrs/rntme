import type { EventEnvelope } from '../types/envelope.js';

export type DlqPayload = Readonly<{
  failedEvent: EventEnvelope;
  reason: 'max-attempts-exceeded';
  attempts: number;
  firstAttemptAt: string;
  lastError: string;
}>;

export function buildDlqEnvelope(opts: {
  serviceName: string;
  original: EventEnvelope;
  attempts: number;
  firstAttemptAt: string;
  lastError: string;
  now: () => string;
  nextId: () => string;
}): EventEnvelope<DlqPayload> {
  const { serviceName, original } = opts;
  return {
    id: opts.nextId(),
    source: `rntme://${serviceName}/Relay`,
    eventType: 'EventDeliveryFailed',
    type: `${serviceName}.Relay.EventDeliveryFailed`,
    time: opts.now(),
    subject: original.subject,
    dataContentType: 'application/json',
    dataSchema: `rntme://schemas/${serviceName}/EventDeliveryFailed.v1.json`,
    data: {
      failedEvent: original,
      reason: 'max-attempts-exceeded',
      attempts: opts.attempts,
      firstAttemptAt: opts.firstAttemptAt,
      lastError: opts.lastError,
    },
    correlationId: original.correlationId,
    causationId: original.id,
    commandId: null,
    rntAggregateType: 'Relay',
    rntAggregateId: serviceName,
    rntVersion: 0,
    rntSchemaVersion: 1,
    rntActorKind: 'system',
    rntActorId: 'relay',
    traceparent: original.traceparent,
  };
}
