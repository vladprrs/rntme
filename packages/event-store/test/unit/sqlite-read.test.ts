import { describe, it, expect, afterEach } from 'vitest';
import { SqliteEventStore } from '../../src/store/sqlite.js';
import { makeEvent, makeRequest } from '../fixtures/sample-events.js';

let store: SqliteEventStore | null = null;
afterEach(() => { store?.close(); store = null; });

describe('SqliteEventStore.readStream', () => {
  it('returns empty array for unknown stream', () => {
    store = new SqliteEventStore({ filename: ':memory:' });
    expect(store.readStream('Issue-999')).toEqual([]);
  });

  it('returns only the requested stream, in version order', () => {
    store = new SqliteEventStore({ filename: ':memory:' });
    store.appendEvents([
      makeRequest('Issue-1', [
        makeEvent({ eventId: 'a', aggregateId: '1' }),
        makeEvent({ eventId: 'b', aggregateId: '1' }),
      ]),
      makeRequest('Issue-2', [
        makeEvent({ eventId: 'c', aggregateId: '2' }),
      ]),
    ]);

    const s1 = store.readStream('Issue-1');
    expect(s1.map((e) => e.eventId)).toEqual(['a', 'b']);
    expect(s1.map((e) => e.version)).toEqual([1, 2]);
    expect(s1[0]!.aggregateType).toBe('Issue');
    expect(s1[0]!.stream).toBe('Issue-1');

    const s2 = store.readStream('Issue-2');
    expect(s2.map((e) => e.eventId)).toEqual(['c']);
  });

  it('deserializes payload_json and reconstructs actor', () => {
    store = new SqliteEventStore({ filename: ':memory:' });
    store.appendEvents([
      makeRequest('Issue-1', [
        makeEvent({
          eventId: 'a',
          actor: { kind: 'service', id: 'migrator' },
          payload: { before: null, after: { status: 'draft', title: 'hello' } },
        }),
      ]),
    ]);
    const [env] = store.readStream('Issue-1');
    expect(env!.actor).toEqual({ kind: 'service', id: 'migrator' });
    expect(env!.payload).toEqual({ before: null, after: { status: 'draft', title: 'hello' } });
    expect(env!.schemaVersion).toBe(1);
  });

  it('returns actor=null when actor_kind/actor_id are NULL', () => {
    store = new SqliteEventStore({ filename: ':memory:' });
    store.appendEvents([
      makeRequest('Issue-1', [makeEvent({ eventId: 'a', actor: null })]),
    ]);
    const [env] = store.readStream('Issue-1');
    expect(env!.actor).toBeNull();
  });
});

describe('SqliteEventStore.readFrom', () => {
  it('returns events with id > afterId in id order, capped by limit', () => {
    store = new SqliteEventStore({ filename: ':memory:' });
    store.appendEvents([
      makeRequest('Issue-1', [makeEvent({ eventId: 'a', aggregateId: '1' })]),
      makeRequest('Issue-2', [makeEvent({ eventId: 'b', aggregateId: '2' })]),
      makeRequest('Issue-1', [makeEvent({ eventId: 'c', aggregateId: '1' })]),
    ]);

    const all = store.readFrom({ afterId: 0, limit: 10 });
    expect(all.map((e) => e.eventId)).toEqual(['a', 'b', 'c']);

    const capped = store.readFrom({ afterId: 0, limit: 2 });
    expect(capped.map((e) => e.eventId)).toEqual(['a', 'b']);

    // get the last stored id via raw and continue
    const lastId = (store.rawDb().prepare('SELECT MAX(id) AS m FROM event_log').get() as { m: number }).m;
    const after = store.readFrom({ afterId: lastId - 1, limit: 10 });
    expect(after.map((e) => e.eventId)).toEqual(['c']);
  });

  it('returns empty array when no events beyond cursor', () => {
    store = new SqliteEventStore({ filename: ':memory:' });
    expect(store.readFrom({ afterId: 0, limit: 100 })).toEqual([]);
  });
});
