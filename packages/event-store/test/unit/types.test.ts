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

  it('EventEnvelope is generic over payload', () => {
    const env: EventEnvelope<{ before: null; after: { status: 'draft' } }> = {
      eventId: '018e9d2a-0000-7000-8000-000000000001',
      eventType: 'IssueReport',
      aggregateType: 'Issue',
      aggregateId: '1',
      stream: 'Issue-1',
      version: 1,
      occurredAt: '2026-04-14T10:00:00.000Z',
      actor: { kind: 'user', id: 'alice' },
      payload: { before: null, after: { status: 'draft' } },
      schemaVersion: 1,
    };
    expect(env.version).toBe(1);
  });

  it('AppendRequest carries events + optional expectedVersion', () => {
    const req: AppendRequest = {
      stream: 'Issue-1',
      expectedVersion: 0,
      events: [{
        eventId: 'e1',
        eventType: 'IssueReport',
        aggregateType: 'Issue',
        aggregateId: '1',
        occurredAt: '2026-04-14T10:00:00.000Z',
        actor: null,
        payload: { before: null, after: { status: 'draft' } },
        schemaVersion: 1,
      }] satisfies readonly AppendEventInput[],
    };
    expect(req.events[0]!.eventId).toBe('e1');
  });

  it('AppendResult and AppendedEvent expose stream, lastVersion, appendedEvents', () => {
    const r: AppendResult = {
      stream: 'Issue-1',
      lastVersion: 1,
      appendedEvents: [{ eventId: 'e1', version: 1, id: 1 }] satisfies readonly AppendedEvent[],
    };
    expect(r.lastVersion).toBe(1);
  });

  it('ConcurrencyConflict is an Error subclass with stream/expected/actual', () => {
    const e = new ConcurrencyConflict('Issue-1', 0, 1);
    expect(e).toBeInstanceOf(Error);
    expect(e).toBeInstanceOf(EventStoreError);
    expect(e.stream).toBe('Issue-1');
    expect(e.expectedVersion).toBe(0);
    expect(e.actualVersion).toBe(1);
    expect(e.code).toBe('CONCURRENCY_CONFLICT');
  });
});
