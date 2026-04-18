import { describe, it, expect, afterEach } from 'vitest';
import { SqliteEventStore } from '../../src/store/sqlite.js';
import { DuplicateEventId } from '../../src/types/errors.js';
import { makeEvent, makeRequest } from '../fixtures/sample-events.js';

let store: SqliteEventStore | null = null;
afterEach(() => { store?.close(); store = null; });

function newStore(): SqliteEventStore {
  return new SqliteEventStore({ filename: ':memory:', serviceName: 'test-service' });
}

describe('SqliteEventStore.appendEvents — multi subject', () => {
  it('appends to two subjects in one transaction, each with its own version sequence', () => {
    store = newStore();
    const results = store.appendEvents([
      makeRequest('Issue-1', [
        makeEvent({ id: 'a', rntAggregateId: '1' }),
        makeEvent({ id: 'b', rntAggregateId: '1' }),
      ]),
      makeRequest('Issue-2', [
        makeEvent({ id: 'c', rntAggregateId: '2' }),
      ]),
    ]);
    expect(results).toHaveLength(2);
    expect(results[0]!.subject).toBe('Issue-1');
    expect(results[0]!.lastVersion).toBe(2);
    expect(results[1]!.subject).toBe('Issue-2');
    expect(results[1]!.lastVersion).toBe(1);
  });

  it('rolls back both subjects when the second subject violates UNIQUE(event_id)', () => {
    const st = newStore();
    store = st;
    st.appendEvents([
      makeRequest('Issue-2', [makeEvent({ id: 'dup', rntAggregateId: '2' })]),
    ]);

    expect(() =>
      st.appendEvents([
        makeRequest('Issue-1', [makeEvent({ id: 'ok', rntAggregateId: '1' })]),
        makeRequest('Issue-2', [makeEvent({ id: 'dup', rntAggregateId: '2' })]),
      ]),
    ).toThrow(DuplicateEventId);

    // 'ok' must NOT have been persisted — txn rolled back
    const row = st.rawDb()
      .prepare('SELECT 1 FROM event_log WHERE event_id = ?')
      .get('ok');
    expect(row).toBeUndefined();
  });
});
