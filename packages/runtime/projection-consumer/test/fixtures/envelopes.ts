import type { EventEnvelope } from '@rntme/event-store';

/**
 * CloudEvents-shaped envelope factory for projection-consumer tests.
 * All CE-required attributes are filled with deterministic defaults; individual
 * tests override via `overrides` (including the rnt* extensions).
 */
export function makeEnvelope(overrides: Partial<EventEnvelope> = {}): EventEnvelope {
  const rntAggregateType = overrides.rntAggregateType ?? 'Issue';
  const rntAggregateId = overrides.rntAggregateId ?? '1';
  const eventType = overrides.eventType ?? 'IssueReport';
  const rntSchemaVersion = overrides.rntSchemaVersion ?? 1;
  return {
    id: overrides.id ?? 'ev-' + Math.random().toString(36).slice(2, 10),
    source: overrides.source ?? `rntme://test/${rntAggregateType}`,
    eventType,
    type: overrides.type ?? `test.${rntAggregateType}.${eventType}`,
    time: overrides.time ?? '2026-04-14T10:00:00.000Z',
    subject: overrides.subject ?? `${rntAggregateType}-${rntAggregateId}`,
    dataContentType: 'application/json',
    dataSchema:
      overrides.dataSchema ??
      `rntme://schemas/test/${eventType}.v${rntSchemaVersion}.json`,
    data: overrides.data ?? {
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
    correlationId: overrides.correlationId ?? 'corr-1',
    causationId: overrides.causationId ?? null,
    commandId: overrides.commandId ?? null,
    rntAggregateType,
    rntAggregateId,
    rntVersion: overrides.rntVersion ?? 1,
    rntSchemaVersion,
    rntActorKind: 'rntActorKind' in overrides ? overrides.rntActorKind! : 'user',
    rntActorId: 'rntActorId' in overrides ? overrides.rntActorId! : 'alice',
    traceparent: overrides.traceparent ?? null,
  };
}

/**
 * Canonical lifecycle per spec §7.5 E2E: report → submit → assign → reassign → resolve → close.
 * aggregateId=1, per-stream monotonic version.
 */
export function issueLifecycle(aggregateId = '1'): EventEnvelope[] {
  return [
    makeEnvelope({
      id: 'e1', eventType: 'IssueReport', rntAggregateId: aggregateId, rntVersion: 1,
      time: '2026-04-14T10:00:00.000Z',
      data: { before: null, after: { status: 'draft', title: 'Hello', projectId: 7, reporterId: 42, priority: 'high', storyPoints: 5 } },
    }),
    makeEnvelope({
      id: 'e2', eventType: 'IssueSubmit', rntAggregateId: aggregateId, rntVersion: 2,
      time: '2026-04-14T10:01:00.000Z',
      data: { before: { status: 'draft' }, after: { status: 'open' } },
    }),
    makeEnvelope({
      id: 'e3', eventType: 'IssueAssign', rntAggregateId: aggregateId, rntVersion: 3,
      time: '2026-04-14T10:02:00.000Z',
      data: { before: { status: 'open', assigneeId: null }, after: { status: 'in_progress', assigneeId: 99 } },
    }),
    makeEnvelope({
      id: 'e4', eventType: 'IssueReassign', rntAggregateId: aggregateId, rntVersion: 4,
      time: '2026-04-14T10:03:00.000Z',
      data: { before: { status: 'in_progress', assigneeId: 99 }, after: { status: 'in_progress', assigneeId: 100 } },
    }),
    makeEnvelope({
      id: 'e5', eventType: 'IssueResolve', rntAggregateId: aggregateId, rntVersion: 5,
      time: '2026-04-14T10:04:00.000Z',
      data: { before: { status: 'in_progress', resolvedAt: null }, after: { status: 'resolved', resolvedAt: '2026-04-14T10:04:00.000Z' } },
    }),
    makeEnvelope({
      id: 'e6', eventType: 'IssueClose', rntAggregateId: aggregateId, rntVersion: 6,
      time: '2026-04-14T10:05:00.000Z',
      data: { before: { status: 'resolved' }, after: { status: 'closed' } },
    }),
  ];
}
