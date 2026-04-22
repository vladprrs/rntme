import { describe, it, expect } from 'vitest';
import BetterSqlite3 from 'better-sqlite3';
import { IdempotencyCache } from '../../src/idempotency/cache.js';

describe('IdempotencyCache', () => {
  it('stores and retrieves a response by (commandName, key)', () => {
    const db = new BetterSqlite3(':memory:');
    const cache = new IdempotencyCache(db);
    cache.set('createOrder', 'abc', { status: 200, body: '{"ok":true}' }, Date.now());
    const hit = cache.get('createOrder', 'abc', Date.now());
    expect(hit?.body).toBe('{"ok":true}');
  });

  it('returns null for expired entries', () => {
    const db = new BetterSqlite3(':memory:');
    const cache = new IdempotencyCache(db);
    cache.set('createOrder', 'abc', { status: 200, body: '{}' }, Date.now() - 25 * 3600 * 1000);
    const hit = cache.get('createOrder', 'abc', Date.now()); // TTL is 24h
    expect(hit).toBeNull();
  });

  it('returns null for unknown key', () => {
    const db = new BetterSqlite3(':memory:');
    const cache = new IdempotencyCache(db);
    expect(cache.get('createOrder', 'none', Date.now())).toBeNull();
  });

  it('overwrites on second set (same key)', () => {
    const db = new BetterSqlite3(':memory:');
    const cache = new IdempotencyCache(db);
    cache.set('createOrder', 'abc', { status: 200, body: 'v1' }, Date.now());
    cache.set('createOrder', 'abc', { status: 200, body: 'v2' }, Date.now());
    expect(cache.get('createOrder', 'abc', Date.now())?.body).toBe('v2');
  });
});
