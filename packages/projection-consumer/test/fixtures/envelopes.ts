import type { EventEnvelope } from '@rntme/event-store';

export function makeEnvelope(overrides: Partial<EventEnvelope> = {}): EventEnvelope {
  return {
    eventId: overrides.eventId ?? 'ev-' + Math.random().toString(36).slice(2, 10),
    eventType: overrides.eventType ?? 'IssueReport',
    aggregateType: overrides.aggregateType ?? 'Issue',
    aggregateId: overrides.aggregateId ?? '1',
    stream: overrides.stream ?? `${overrides.aggregateType ?? 'Issue'}-${overrides.aggregateId ?? '1'}`,
    version: overrides.version ?? 1,
    occurredAt: overrides.occurredAt ?? '2026-04-14T10:00:00.000Z',
    actor: 'actor' in overrides ? overrides.actor! : { kind: 'user', id: 'alice' },
    payload: overrides.payload ?? {
      before: null,
      after: {
        status: 'draft',
        title: 'Hello',
        projectId: 7,
        reporterId: 42,
        priority: 'high',
        storyPoints: 5,
      },
    },
    schemaVersion: overrides.schemaVersion ?? 1,
  };
}

/**
 * Canonical lifecycle per spec §7.5 E2E: report → submit → assign → reassign → resolve → close.
 * aggregateId=1, per-stream monotonic version.
 */
export function issueLifecycle(aggregateId = '1'): EventEnvelope[] {
  const stream = `Issue-${aggregateId}`;
  return [
    makeEnvelope({
      eventId: 'e1', eventType: 'IssueReport', aggregateId, stream, version: 1,
      occurredAt: '2026-04-14T10:00:00.000Z',
      payload: { before: null, after: { status: 'draft', title: 'Hello', projectId: 7, reporterId: 42, priority: 'high', storyPoints: 5 } },
    }),
    makeEnvelope({
      eventId: 'e2', eventType: 'IssueSubmit', aggregateId, stream, version: 2,
      occurredAt: '2026-04-14T10:01:00.000Z',
      payload: { before: { status: 'draft' }, after: { status: 'open' } },
    }),
    makeEnvelope({
      eventId: 'e3', eventType: 'IssueAssign', aggregateId, stream, version: 3,
      occurredAt: '2026-04-14T10:02:00.000Z',
      payload: { before: { status: 'open', assigneeId: null }, after: { status: 'in_progress', assigneeId: 99 } },
    }),
    makeEnvelope({
      eventId: 'e4', eventType: 'IssueReassign', aggregateId, stream, version: 4,
      occurredAt: '2026-04-14T10:03:00.000Z',
      payload: { before: { status: 'in_progress', assigneeId: 99 }, after: { status: 'in_progress', assigneeId: 100 } },
    }),
    makeEnvelope({
      eventId: 'e5', eventType: 'IssueResolve', aggregateId, stream, version: 5,
      occurredAt: '2026-04-14T10:04:00.000Z',
      payload: { before: { status: 'in_progress', resolvedAt: null }, after: { status: 'resolved', resolvedAt: '2026-04-14T10:04:00.000Z' } },
    }),
    makeEnvelope({
      eventId: 'e6', eventType: 'IssueClose', aggregateId, stream, version: 6,
      occurredAt: '2026-04-14T10:05:00.000Z',
      payload: { before: { status: 'resolved' }, after: { status: 'closed' } },
    }),
  ];
}
