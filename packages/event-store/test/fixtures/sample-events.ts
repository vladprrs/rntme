import type { AppendEventInput, AppendRequest } from '../../src/types/index.js';

export function makeEvent(
  overrides: Partial<AppendEventInput> = {},
): AppendEventInput {
  return {
    id: overrides.id ?? 'ev-' + Math.random().toString(36).slice(2, 10),
    eventType: overrides.eventType ?? 'IssueReport',
    rntAggregateType: overrides.rntAggregateType ?? 'Issue',
    rntAggregateId: overrides.rntAggregateId ?? '1',
    time: overrides.time ?? '2026-04-14T10:00:00.000Z',
    actor: 'actor' in overrides ? overrides.actor! : { kind: 'user', id: 'alice' },
    data: overrides.data ?? { before: null, after: { status: 'draft' } },
    rntSchemaVersion: overrides.rntSchemaVersion ?? 1,
    correlationId: overrides.correlationId ?? 'corr-test',
    causationId: 'causationId' in overrides ? overrides.causationId! : null,
    commandId: 'commandId' in overrides ? overrides.commandId! : null,
    traceparent: 'traceparent' in overrides ? overrides.traceparent! : null,
  };
}

export function makeRequest(
  subject: string,
  events: AppendEventInput[],
  expectedVersion?: number,
): AppendRequest {
  return expectedVersion === undefined
    ? { subject, events }
    : { subject, expectedVersion, events };
}
