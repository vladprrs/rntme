import { describe, it, expect } from 'vitest';
import type { EventEnvelope } from '@rntme/event-store';
import { replayAggregateState } from '../../../src/command-runtime/replay.js';

function ev(
  version: number,
  data: { before: Record<string, unknown> | null; after: Record<string, unknown> },
): EventEnvelope {
  return {
    id: `id-${version}`,
    source: 'rntme://test-service/Issue',
    eventType: 't',
    type: 'test-service.Issue.t',
    time: '2026-04-14T10:00:00Z',
    subject: 'Issue-1',
    dataContentType: 'application/json',
    dataSchema: 'rntme://schemas/test-service/t.v1.json',
    data,
    correlationId: 'corr-test',
    causationId: null,
    commandId: null,
    rntAggregateType: 'Issue',
    rntAggregateId: '1',
    rntVersion: version,
    rntSchemaVersion: 1,
    rntActorKind: null,
    rntActorId: null,
    traceparent: null,
  };
}

describe('replayAggregateState', () => {
  it('returns null + version 0 for empty stream', () => {
    const s = replayAggregateState([]);
    expect(s.state).toBeNull();
    expect(s.version).toBe(0);
  });

  it('applies creation then subsequent transitions in order', () => {
    const events = [
      ev(1, { before: null, after: { status: 'draft', title: 'hi' } }),
      ev(2, { before: { status: 'draft' }, after: { status: 'open' } }),
      ev(3, { before: { status: 'open', assigneeId: null }, after: { status: 'in_progress', assigneeId: 42 } }),
    ];
    const s = replayAggregateState(events);
    expect(s.version).toBe(3);
    expect(s.state).toEqual({ status: 'in_progress', title: 'hi', assigneeId: 42 });
  });
});
