import { describe, it, expect } from 'vitest';
import { SqliteEventStore } from '../src/store/sqlite.js';
import type { EventEnvelope } from '../src/types/envelope.js';

function env(stream: string, version: number, eventId?: string): EventEnvelope {
  return {
    eventId: eventId ?? `e:${stream}:v${version}`,
    eventType: 'ThingCreated',
    aggregateType: 'Thing',
    aggregateId: stream.split('-')[1] ?? '0',
    stream,
    version,
    occurredAt: '2026-01-01T00:00:00.000Z',
    actor: { kind: 'system', id: 'seed' },
    payload: { name: 'x' },
    schemaVersion: 1,
  };
}

describe('EventStore.appendRaw', () => {
  it('appends without optimistic concurrency', () => {
    const store = new SqliteEventStore({ filename: ':memory:' });
    store.appendRaw([env('Thing-1', 1), env('Thing-1', 2)]);
    const events = store.readStream('Thing-1');
    expect(events.map((e) => e.version)).toEqual([1, 2]);
  });

  it('supports non-contiguous versions as given (trusts caller)', () => {
    const store = new SqliteEventStore({ filename: ':memory:' });
    store.appendRaw([env('Thing-1', 5), env('Thing-1', 7)]);
    const events = store.readStream('Thing-1');
    expect(events.map((e) => e.version)).toEqual([5, 7]);
  });

  it('raises on duplicate (stream, version) with different eventId when ignoreDuplicates: false', () => {
    const store = new SqliteEventStore({ filename: ':memory:' });
    store.appendRaw([env('Thing-1', 1, 'a')]);
    expect(() => store.appendRaw([env('Thing-1', 1, 'b')])).toThrow();
  });

  it('raises on duplicate eventId when ignoreDuplicates: false', () => {
    const store = new SqliteEventStore({ filename: ':memory:' });
    store.appendRaw([env('Thing-1', 1, 'same')]);
    expect(() => store.appendRaw([env('Thing-2', 1, 'same')])).toThrow();
  });

  it('ignoreDuplicates: true skips events with duplicate eventId silently', () => {
    const store = new SqliteEventStore({ filename: ':memory:' });
    store.appendRaw([env('Thing-1', 1, 'same')]);
    store.appendRaw([env('Thing-2', 1, 'same'), env('Thing-3', 1, 'new')], { ignoreDuplicates: true });
    expect(store.readStream('Thing-2')).toHaveLength(0);
    expect(store.readStream('Thing-3')).toHaveLength(1);
  });

  it('ignoreDuplicates: true still raises on (stream, version) conflict at different eventId', () => {
    const store = new SqliteEventStore({ filename: ':memory:' });
    store.appendRaw([env('Thing-1', 1, 'a')]);
    expect(() =>
      store.appendRaw([env('Thing-1', 1, 'b')], { ignoreDuplicates: true }),
    ).toThrow();
  });

  it('atomic: a conflict mid-batch rolls back prior events in the batch', () => {
    const store = new SqliteEventStore({ filename: ':memory:' });
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
