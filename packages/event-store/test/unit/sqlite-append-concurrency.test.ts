import { describe, it, expect, afterEach } from 'vitest';
import { SqliteEventStore, mapSqliteError } from '../../src/store/sqlite.js';
import { ConcurrencyConflict, DuplicateEventId } from '../../src/types/errors.js';
import { makeEvent, makeRequest } from '../fixtures/sample-events.js';

let store: SqliteEventStore | null = null;
afterEach(() => {
  store?.close();
  store = null;
});

describe('mapSqliteError', () => {
  it('maps UNIQUE on event_id to DuplicateEventId', () => {
    const err = Object.assign(
      new Error('UNIQUE constraint failed: event_log.event_id'),
      { code: 'SQLITE_CONSTRAINT_UNIQUE' as const },
    );
    const mapped = mapSqliteError(err, 'Issue-1', 1, 2, 'e1');
    expect(mapped).toBeInstanceOf(DuplicateEventId);
    expect((mapped as DuplicateEventId).eventId).toBe('e1');
  });

  it('maps UNIQUE on (stream, version) to ConcurrencyConflict', () => {
    const err = Object.assign(
      new Error('UNIQUE constraint failed: event_log.stream, event_log.version'),
      { code: 'SQLITE_CONSTRAINT_UNIQUE' as const },
    );
    const mapped = mapSqliteError(err, 'Issue-1', 2, 2);
    expect(mapped).toBeInstanceOf(ConcurrencyConflict);
    expect((mapped as ConcurrencyConflict).stream).toBe('Issue-1');
    expect((mapped as ConcurrencyConflict).expectedVersion).toBe(2);
    expect((mapped as ConcurrencyConflict).actualVersion).toBe(2);
  });

  it('passes through unrelated errors', () => {
    const err = new Error('boom');
    expect(mapSqliteError(err, 's', 1, 1)).toBe(err);
  });
});

describe('SqliteEventStore.appendEvents — optimistic concurrency', () => {
  it('throws ConcurrencyConflict when expectedVersion does not match current', () => {
    const st = new SqliteEventStore({ filename: ':memory:' });
    store = st;
    st.appendEvents([makeRequest('Issue-1', [makeEvent({ eventId: 'e1' })])]);
    expect(() =>
      st.appendEvents([makeRequest('Issue-1', [makeEvent({ eventId: 'e2' })], 0)]),
    ).toThrow(ConcurrencyConflict);
    try {
      st.appendEvents([makeRequest('Issue-1', [makeEvent({ eventId: 'e3' })], 0)]);
      expect.fail('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(ConcurrencyConflict);
      expect((e as ConcurrencyConflict).actualVersion).toBe(1);
    }
  });

  it('maps duplicate eventId on append to DuplicateEventId', () => {
    const st = new SqliteEventStore({ filename: ':memory:' });
    store = st;
    st.appendEvents([makeRequest('Issue-1', [makeEvent({ eventId: 'same' })])]);
    expect(() =>
      st.appendEvents([makeRequest('Issue-1', [makeEvent({ eventId: 'same' })])]),
    ).toThrow(DuplicateEventId);
  });
});
