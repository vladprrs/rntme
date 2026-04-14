import type { AppendEventInput, AppendRequest } from '../../src/types/index.js';

export function makeEvent(
  overrides: Partial<AppendEventInput> = {},
): AppendEventInput {
  return {
    eventId: overrides.eventId ?? 'ev-' + Math.random().toString(36).slice(2, 10),
    eventType: overrides.eventType ?? 'IssueReport',
    aggregateType: overrides.aggregateType ?? 'Issue',
    aggregateId: overrides.aggregateId ?? '1',
    occurredAt: overrides.occurredAt ?? '2026-04-14T10:00:00.000Z',
    actor: 'actor' in overrides ? overrides.actor : { kind: 'user', id: 'alice' },
    payload: overrides.payload ?? { before: null, after: { status: 'draft' } },
    schemaVersion: overrides.schemaVersion ?? 1,
  };
}

export function makeRequest(
  stream: string,
  events: AppendEventInput[],
  expectedVersion?: number,
): AppendRequest {
  return expectedVersion === undefined
    ? { stream, events }
    : { stream, expectedVersion, events };
}
