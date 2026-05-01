import { describe, it, expect, afterEach } from 'vitest';
import { SqliteEventStore } from '../../src/store/sqlite.js';
import { makeEvent, makeRequest } from '../fixtures/sample-events.js';

let store: SqliteEventStore | null = null;
afterEach(() => { store?.close(); store = null; });

function newStore(): SqliteEventStore {
  return new SqliteEventStore({ filename: ':memory:', serviceName: 'test-service' });
}

describe('SqliteEventStore.readStream', () => {
  it('returns empty array for unknown subject', () => {
    store = newStore();
    expect(store.readStream('Issue-999')).toEqual([]);
  });

  it('returns only the requested subject, in version order', () => {
    store = newStore();
    store.appendEvents([
      makeRequest('Issue-1', [
        makeEvent({ id: 'a', rntAggregateId: '1' }),
        makeEvent({ id: 'b', rntAggregateId: '1' }),
      ]),
      makeRequest('Issue-2', [
        makeEvent({ id: 'c', rntAggregateId: '2' }),
      ]),
    ]);

    const s1 = store.readStream('Issue-1');
    expect(s1.map((e) => e.id)).toEqual(['a', 'b']);
    expect(s1.map((e) => e.rntVersion)).toEqual([1, 2]);
    expect(s1[0]!.rntAggregateType).toBe('Issue');
    expect(s1[0]!.subject).toBe('Issue-1');

    const s2 = store.readStream('Issue-2');
    expect(s2.map((e) => e.id)).toEqual(['c']);
  });

  it('deserializes payload_json and reconstructs actor', () => {
    store = newStore();
    store.appendEvents([
      makeRequest('Issue-1', [
        makeEvent({
          id: 'a',
          actor: { kind: 'service', id: 'migrator' },
          data: { before: null, after: { status: 'draft', title: 'hello' } },
        }),
      ]),
    ]);
    const [env] = store.readStream('Issue-1');
    expect(env!.rntActorKind).toBe('service');
    expect(env!.rntActorId).toBe('migrator');
    expect(env!.data).toEqual({ before: null, after: { status: 'draft', title: 'hello' } });
    expect(env!.rntSchemaVersion).toBe(1);
  });

  it('returns rntActorKind=null when actor_kind/actor_id are NULL', () => {
    store = newStore();
    store.appendEvents([
      makeRequest('Issue-1', [makeEvent({ id: 'a', actor: null })]),
    ]);
    const [env] = store.readStream('Issue-1');
    expect(env!.rntActorKind).toBeNull();
    expect(env!.rntActorId).toBeNull();
  });
});

describe('SqliteEventStore.readFrom', () => {
  it('returns events with id > afterId in id order, capped by limit', () => {
    store = newStore();
    store.appendEvents([
      makeRequest('Issue-1', [makeEvent({ id: 'a', rntAggregateId: '1' })]),
      makeRequest('Issue-2', [makeEvent({ id: 'b', rntAggregateId: '2' })]),
      makeRequest('Issue-1', [makeEvent({ id: 'c', rntAggregateId: '1' })]),
    ]);

    const all = store.readFrom({ afterId: 0, limit: 10 });
    expect(all.map((e) => e.id)).toEqual(['a', 'b', 'c']);

    const capped = store.readFrom({ afterId: 0, limit: 2 });
    expect(capped.map((e) => e.id)).toEqual(['a', 'b']);

    // get the last stored id via raw and continue
    const lastId = (store.rawDb().prepare('SELECT MAX(id) AS m FROM event_log').get() as { m: number }).m;
    const after = store.readFrom({ afterId: lastId - 1, limit: 10 });
    expect(after.map((e) => e.id)).toEqual(['c']);
  });

  it('returns empty array when no events beyond cursor', () => {
    store = newStore();
    expect(store.readFrom({ afterId: 0, limit: 100 })).toEqual([]);
  });
});
