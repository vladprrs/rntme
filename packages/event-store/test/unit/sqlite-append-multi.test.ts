import { describe, it, expect, afterEach } from 'vitest';
import { SqliteEventStore } from '../../src/store/sqlite.js';
import { DuplicateEventId } from '../../src/types/errors.js';
import { makeEvent, makeRequest } from '../fixtures/sample-events.js';

let store: SqliteEventStore | null = null;
afterEach(() => { store?.close(); store = null; });

describe('SqliteEventStore.appendEvents — multi stream', () => {
  it('appends to two streams in one transaction, each with its own version sequence', () => {
    store = new SqliteEventStore({ filename: ':memory:' });
    const results = store.appendEvents([
      makeRequest('Issue-1', [
        makeEvent({ eventId: 'a', aggregateId: '1' }),
        makeEvent({ eventId: 'b', aggregateId: '1' }),
      ]),
      makeRequest('Issue-2', [
        makeEvent({ eventId: 'c', aggregateId: '2' }),
      ]),
    ]);
    expect(results).toHaveLength(2);
    expect(results[0]!.stream).toBe('Issue-1');
    expect(results[0]!.lastVersion).toBe(2);
    expect(results[1]!.stream).toBe('Issue-2');
    expect(results[1]!.lastVersion).toBe(1);
  });

  it('rolls back both streams when the second stream violates UNIQUE(event_id)', () => {
    const st = new SqliteEventStore({ filename: ':memory:' });
    store = st;
    st.appendEvents([
      makeRequest('Issue-2', [makeEvent({ eventId: 'dup', aggregateId: '2' })]),
    ]);

    expect(() =>
      st.appendEvents([
        makeRequest('Issue-1', [makeEvent({ eventId: 'ok', aggregateId: '1' })]),
        makeRequest('Issue-2', [makeEvent({ eventId: 'dup', aggregateId: '2' })]),
      ]),
    ).toThrow(DuplicateEventId);

    // 'ok' must NOT have been persisted — txn rolled back
    const row = st.rawDb()
      .prepare('SELECT 1 FROM event_log WHERE event_id = ?')
      .get('ok');
    expect(row).toBeUndefined();
  });
});
