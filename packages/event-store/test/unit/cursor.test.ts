import { describe, it, expect, afterEach } from 'vitest';
import { SqliteEventStore } from '../../src/store/sqlite.js';

let store: SqliteEventStore | null = null;
afterEach(() => { store?.close(); store = null; });

describe('publish_cursor', () => {
  it('readCursor returns 0 when no row exists for this relayId', () => {
    store = new SqliteEventStore({ filename: ':memory:' });
    expect(store.readCursor('kafka-main')).toBe(0);
  });

  it('writeCursor inserts then updates; readCursor sees the latest value', () => {
    store = new SqliteEventStore({ filename: ':memory:' });
    store.writeCursor('kafka-main', 42);
    expect(store.readCursor('kafka-main')).toBe(42);
    store.writeCursor('kafka-main', 100);
    expect(store.readCursor('kafka-main')).toBe(100);
  });

  it('cursors are isolated by relayId', () => {
    store = new SqliteEventStore({ filename: ':memory:' });
    store.writeCursor('kafka-main', 10);
    store.writeCursor('replica-eu', 20);
    expect(store.readCursor('kafka-main')).toBe(10);
    expect(store.readCursor('replica-eu')).toBe(20);
  });

  it('writeCursor rejects non-monotonic values', () => {
    store = new SqliteEventStore({ filename: ':memory:' });
    store.writeCursor('kafka-main', 50);
    expect(() => store.writeCursor('kafka-main', 10)).toThrow(/monotonic/i);
    expect(store.readCursor('kafka-main')).toBe(50);
  });
});
