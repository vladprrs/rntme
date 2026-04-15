import { describe, it, expect, afterEach } from 'vitest';
import { SqliteEventStore } from '../src/store/sqlite.js';
import type { EventEnvelope } from '../src/types/envelope.js';
import { ConcurrencyConflict, DuplicateEventId } from '../src/types/errors.js';

let store: SqliteEventStore | null = null;
afterEach(() => {
  store?.close();
  store = null;
});

function env(overrides: Partial<EventEnvelope> = {}): EventEnvelope {
  return {
    eventId: 'ev-' + Math.random().toString(36).slice(2, 10),
    eventType: 'IssueReport',
    aggregateType: 'Issue',
    aggregateId: '1',
    stream: 'Issue-1',
    version: 1,
    occurredAt: '2026-04-14T10:00:00.000Z',
    actor: { kind: 'user', id: 'alice' },
    payload: { n: 1 },
    schemaVersion: 1,
    ...overrides,
  };
}

describe('SqliteEventStore.appendRaw', () => {
  it('writes envelopes with caller-assigned stream and version', () => {
    const st = new SqliteEventStore({ filename: ':memory:' });
    store = st;
    st.appendRaw([
      env({ eventId: 'a', version: 1 }),
      env({ eventId: 'b', version: 2 }),
    ]);
    const rows = st.readStream('Issue-1');
    expect(rows.map((r) => r.eventId)).toEqual(['a', 'b']);
    expect(rows.map((r) => r.version)).toEqual([1, 2]);
  });

  it('throws DuplicateEventId when the same eventId is appended again', () => {
    const st = new SqliteEventStore({ filename: ':memory:' });
    store = st;
    st.appendRaw([env({ eventId: 'dup', version: 1 })]);
    expect(() =>
      st.appendRaw([env({ eventId: 'dup', version: 2 })]),
    ).toThrow(DuplicateEventId);
  });

  it('ignoreDuplicates: true skips duplicate eventId', () => {
    const st = new SqliteEventStore({ filename: ':memory:' });
    store = st;
    st.appendRaw([env({ eventId: 'x', version: 1 })]);
    st.appendRaw(
      [env({ eventId: 'x', version: 2 }), env({ eventId: 'y', version: 2 })],
      { ignoreDuplicates: true },
    );
    const rows = st.readStream('Issue-1');
    expect(rows.map((r) => r.eventId)).toEqual(['x', 'y']);
    expect(rows.map((r) => r.version)).toEqual([1, 2]);
  });

  it('ignoreDuplicates: true still raises on (stream, version) conflict at different eventId', () => {
    const st = new SqliteEventStore({ filename: ':memory:' });
    store = st;
    st.appendRaw([env({ eventId: 'first', version: 1 })]);
    expect(() =>
      st.appendRaw([env({ eventId: 'other', version: 1 })], {
        ignoreDuplicates: true,
      }),
    ).toThrow(ConcurrencyConflict);
  });
});
