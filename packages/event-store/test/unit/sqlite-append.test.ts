import { describe, it, expect, afterEach } from 'vitest';
import { SqliteEventStore } from '../../src/store/sqlite.js';
import { makeEvent, makeRequest } from '../fixtures/sample-events.js';

let store: SqliteEventStore | null = null;
afterEach(() => { store?.close(); store = null; });

function newStore(): SqliteEventStore {
  return new SqliteEventStore({ filename: ':memory:' });
}

describe('SqliteEventStore.appendEvents — single stream', () => {
  it('appends a single event to a new stream as version 1', () => {
    store = newStore();
    const [result] = store.appendEvents([
      makeRequest('Issue-1', [makeEvent({ eventId: 'e1' })]),
    ]);
    expect(result).toBeDefined();
    expect(result!.stream).toBe('Issue-1');
    expect(result!.lastVersion).toBe(1);
    expect(result!.appendedEvents).toHaveLength(1);
    expect(result!.appendedEvents[0]!.eventId).toBe('e1');
    expect(result!.appendedEvents[0]!.version).toBe(1);
    expect(result!.appendedEvents[0]!.id).toBeGreaterThan(0);
  });

  it('assigns version = previous max + 1 across append calls', () => {
    store = newStore();
    const [r1] = store.appendEvents([makeRequest('Issue-1', [makeEvent({ eventId: 'e1' })])]);
    const [r2] = store.appendEvents([makeRequest('Issue-1', [makeEvent({ eventId: 'e2' })])]);
    expect(r1!.lastVersion).toBe(1);
    expect(r2!.lastVersion).toBe(2);
    expect(r2!.appendedEvents[0]!.version).toBe(2);
  });

  it('assigns monotonically increasing versions within one request', () => {
    store = newStore();
    const [r] = store.appendEvents([
      makeRequest('Issue-1', [
        makeEvent({ eventId: 'e1' }),
        makeEvent({ eventId: 'e2' }),
        makeEvent({ eventId: 'e3' }),
      ]),
    ]);
    expect(r!.lastVersion).toBe(3);
    expect(r!.appendedEvents.map((a) => a.version)).toEqual([1, 2, 3]);
    const ids = r!.appendedEvents.map((a) => a.id);
    expect(ids[0]! < ids[1]! && ids[1]! < ids[2]!).toBe(true);
  });

  it('persists all envelope fields (raw readback)', () => {
    store = newStore();
    store.appendEvents([
      makeRequest('Issue-1', [
        makeEvent({
          eventId: 'e1',
          eventType: 'IssueReport',
          actor: { kind: 'user', id: 'alice' },
          payload: { before: null, after: { status: 'draft', title: 't' } },
          schemaVersion: 1,
        }),
      ]),
    ]);
    const row = store.rawDb()
      .prepare('SELECT * FROM event_log WHERE event_id = ?')
      .get('e1') as {
        stream: string;
        aggregate_type: string;
        aggregate_id: string;
        version: number;
        event_type: string;
        actor_kind: string | null;
        actor_id: string | null;
        occurred_at: string;
        payload_json: string;
        schema_version: number;
      };
    expect(row.stream).toBe('Issue-1');
    expect(row.aggregate_type).toBe('Issue');
    expect(row.aggregate_id).toBe('1');
    expect(row.version).toBe(1);
    expect(row.event_type).toBe('IssueReport');
    expect(row.actor_kind).toBe('user');
    expect(row.actor_id).toBe('alice');
    expect(JSON.parse(row.payload_json)).toEqual({ before: null, after: { status: 'draft', title: 't' } });
    expect(row.schema_version).toBe(1);
  });
});
