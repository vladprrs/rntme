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
});
