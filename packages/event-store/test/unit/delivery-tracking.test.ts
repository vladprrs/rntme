import { describe, it, expect, afterEach } from 'vitest';
import { SqliteEventStore } from '../../src/store/sqlite.js';

let store: SqliteEventStore | null = null;
afterEach(() => { store?.close(); store = null; });

describe('SqliteEventStore — delivery tracking', () => {
  describe('readDeliveryAttempt', () => {
    it('returns null when no row exists for eventId', () => {
      store = new SqliteEventStore({ filename: ':memory:' });
      expect(store.readDeliveryAttempt('nope')).toBeNull();
    });
  });

  describe('recordDeliveryAttempt', () => {
    it('creates a new row with attempt_count=1 and both timestamps set to nowIso', () => {
      store = new SqliteEventStore({ filename: ':memory:' });
      store.recordDeliveryAttempt('ev-1', '2026-04-17T10:00:00.000Z');

      const row = store.readDeliveryAttempt('ev-1');
      expect(row).toEqual({
        eventId: 'ev-1',
        firstAttemptAt: '2026-04-17T10:00:00.000Z',
        lastAttemptAt: '2026-04-17T10:00:00.000Z',
        attemptCount: 1,
        lastError: null,
        deliveredAt: null,
        dlqAt: null,
      });
    });

    it('increments attempt_count and updates last_attempt_at on subsequent calls; first_attempt_at is preserved', () => {
      store = new SqliteEventStore({ filename: ':memory:' });
      store.recordDeliveryAttempt('ev-1', '2026-04-17T10:00:00.000Z');
      store.recordDeliveryAttempt('ev-1', '2026-04-17T10:00:05.000Z');
      store.recordDeliveryAttempt('ev-1', '2026-04-17T10:00:10.000Z');

      const row = store.readDeliveryAttempt('ev-1');
      expect(row?.attemptCount).toBe(3);
      expect(row?.firstAttemptAt).toBe('2026-04-17T10:00:00.000Z');
      expect(row?.lastAttemptAt).toBe('2026-04-17T10:00:10.000Z');
    });
  });
});
