import { describe, it, expect } from 'vitest';
import { SqliteEventStore } from '../src/store/sqlite.js';
import type { EventEnvelope } from '../src/types/envelope.js';

const SERVICE = 'test-service';

function env(subject: string, version: number, id?: string): EventEnvelope {
  const eventId = id ?? `e:${subject}:v${version}`;
  const aggregateType = 'Thing';
  const aggregateId = subject.split('-')[1] ?? '0';
  const eventType = 'ThingCreated';
  const schemaVersion = 1;
  return {
    id: eventId,
    source: `rntme://${SERVICE}/${aggregateType}`,
    eventType,
    type: `${SERVICE}.${aggregateType}.${eventType}`,
    time: '2026-01-01T00:00:00.000Z',
    subject,
    dataContentType: 'application/json',
    dataSchema: `rntme://schemas/${SERVICE}/${eventType}.v${schemaVersion}.json`,
    data: { name: 'x' },
    correlationId: 'corr-test',
    causationId: null,
    commandId: null,
    rntAggregateType: aggregateType,
    rntAggregateId: aggregateId,
    rntVersion: version,
    rntSchemaVersion: schemaVersion,
    rntActorKind: 'system',
    rntActorId: 'seed',
    traceparent: null,
  };
}

function newStore(): SqliteEventStore {
  return new SqliteEventStore({ filename: ':memory:', serviceName: SERVICE });
}

describe('EventStore.appendRaw', () => {
  it('appends without optimistic concurrency', () => {
    const store = newStore();
    store.appendRaw([env('Thing-1', 1), env('Thing-1', 2)]);
    const events = store.readStream('Thing-1');
    expect(events.map((e) => e.rntVersion)).toEqual([1, 2]);
  });

  it('supports non-contiguous versions as given (trusts caller)', () => {
    const store = newStore();
    store.appendRaw([env('Thing-1', 5), env('Thing-1', 7)]);
    const events = store.readStream('Thing-1');
    expect(events.map((e) => e.rntVersion)).toEqual([5, 7]);
  });

  it('raises on duplicate (subject, version) with different id when ignoreDuplicates: false', () => {
    const store = newStore();
    store.appendRaw([env('Thing-1', 1, 'a')]);
    expect(() => store.appendRaw([env('Thing-1', 1, 'b')])).toThrow();
  });

  it('raises on duplicate id when ignoreDuplicates: false', () => {
    const store = newStore();
    store.appendRaw([env('Thing-1', 1, 'same')]);
    expect(() => store.appendRaw([env('Thing-2', 1, 'same')])).toThrow();
  });

  it('ignoreDuplicates: true skips events with duplicate id silently', () => {
    const store = newStore();
    store.appendRaw([env('Thing-1', 1, 'same')]);
    store.appendRaw([env('Thing-2', 1, 'same'), env('Thing-3', 1, 'new')], { ignoreDuplicates: true });
    expect(store.readStream('Thing-2')).toHaveLength(0);
    expect(store.readStream('Thing-3')).toHaveLength(1);
  });

  it('ignoreDuplicates: true still raises on (subject, version) conflict at different id', () => {
    const store = newStore();
    store.appendRaw([env('Thing-1', 1, 'a')]);
    expect(() =>
      store.appendRaw([env('Thing-1', 1, 'b')], { ignoreDuplicates: true }),
    ).toThrow();
  });

  it('atomic: a conflict mid-batch rolls back prior events in the batch', () => {
    const store = newStore();
    store.appendRaw([env('Thing-1', 1, 'a')]);
    expect(() =>
      store.appendRaw([
        env('Thing-2', 1, 'b'),
        env('Thing-1', 1, 'c'),
      ]),
    ).toThrow();
    expect(store.readStream('Thing-2')).toHaveLength(0);
  });
});
