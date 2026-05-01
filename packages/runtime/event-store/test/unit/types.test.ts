import { describe, it, expect } from 'vitest';
import type {
  ActorRef,
  EventEnvelope,
  AppendRequest,
  AppendEventInput,
  AppendResult,
  AppendedEvent,
} from '../../src/types/index.js';
import { ConcurrencyConflict, EventStoreError } from '../../src/types/index.js';

describe('types — smoke', () => {
  it('ActorRef union covers user/system/service + null carried in envelope', () => {
    const actors: (ActorRef | null)[] = [
      { kind: 'user', id: 'alice' },
      { kind: 'system', id: 'migrator' },
      { kind: 'service', id: 'billing' },
      null,
    ];
    expect(actors).toHaveLength(4);
  });

  it('EventEnvelope is generic over data and carries CE + rnt* fields', () => {
    const env: EventEnvelope<{ before: null; after: { status: 'draft' } }> = {
      id: '018e9d2a-0000-7000-8000-000000000001',
      source: 'rntme://svc/Issue',
      eventType: 'IssueReport',
      type: 'svc.Issue.IssueReport',
      time: '2026-04-14T10:00:00.000Z',
      subject: 'Issue-1',
      dataContentType: 'application/json',
      dataSchema: 'rntme://schemas/svc/IssueReport.v1.json',
      data: { before: null, after: { status: 'draft' } },
      correlationId: 'corr-1',
      causationId: null,
      commandId: null,
      rntAggregateType: 'Issue',
      rntAggregateId: '1',
      rntVersion: 1,
      rntSchemaVersion: 1,
      rntActorKind: 'user',
      rntActorId: 'alice',
      traceparent: null,
    };
    expect(env.rntVersion).toBe(1);
    expect(env.subject).toBe('Issue-1');
  });

  it('AppendRequest carries events + optional expectedVersion', () => {
    const req: AppendRequest = {
      subject: 'Issue-1',
      expectedVersion: 0,
      events: [{
        id: 'e1',
        eventType: 'IssueReport',
        rntAggregateType: 'Issue',
        rntAggregateId: '1',
        time: '2026-04-14T10:00:00.000Z',
        actor: null,
        data: { before: null, after: { status: 'draft' } },
        rntSchemaVersion: 1,
        correlationId: 'corr-1',
        causationId: null,
        commandId: null,
        traceparent: null,
      }] satisfies readonly AppendEventInput[],
    };
    expect(req.events[0]!.id).toBe('e1');
  });

  it('AppendResult and AppendedEvent expose subject, lastVersion, appendedEvents', () => {
    const r: AppendResult = {
      subject: 'Issue-1',
      lastVersion: 1,
      appendedEvents: [{ id: 'e1', version: 1, rowId: 1 }] satisfies readonly AppendedEvent[],
    };
    expect(r.lastVersion).toBe(1);
    expect(r.subject).toBe('Issue-1');
  });

  it('ConcurrencyConflict is an Error subclass with subject/expected/actual', () => {
    const e = new ConcurrencyConflict('Issue-1', 0, 1);
    expect(e).toBeInstanceOf(Error);
    expect(e).toBeInstanceOf(EventStoreError);
    expect(e.subject).toBe('Issue-1');
    expect(e.expectedVersion).toBe(0);
    expect(e.actualVersion).toBe(1);
    expect(e.code).toBe('CONCURRENCY_CONFLICT');
  });
});
