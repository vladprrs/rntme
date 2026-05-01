import { describe, it, expect } from 'vitest';
import BetterSqlite3 from 'better-sqlite3';
import { IdempotencyCache } from '../../src/idempotency/cache.js';

describe('IdempotencyCache', () => {
  it('preserves headers across set/get', () => {
    const db = new BetterSqlite3(':memory:');
    const cache = new IdempotencyCache(db);
    cache.set(
      'cmd.x',
      'key-1',
      { status: 302, body: '', headers: { Location: '/next', 'X-Thing': 'v' } },
      1000,
    );
    const hit = cache.get('cmd.x', 'key-1', 1500);
    expect(hit).not.toBeNull();
    expect(hit?.status).toBe(302);
    expect(hit?.body).toBe('');
    expect(hit?.headers).toEqual({ Location: '/next', 'X-Thing': 'v' });
  });

  it('returns undefined headers when none were stored', () => {
    const db = new BetterSqlite3(':memory:');
    const cache = new IdempotencyCache(db);
    cache.set('cmd.y', 'key-2', { status: 200, body: '{"ok":true}' }, 1000);
    const hit = cache.get('cmd.y', 'key-2', 1500);
    expect(hit?.headers).toBeUndefined();
  });

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

  it('removes expired entries during normal reads', () => {
    const db = new BetterSqlite3(':memory:');
    const cache = new IdempotencyCache(db);
    const now = Date.now();
    cache.set('createOrder', 'abc', { status: 200, body: '{}' }, now - 25 * 3600 * 1000);

    expect(cache.get('createOrder', 'abc', now)).toBeNull();

    const row = db.prepare(
      `SELECT COUNT(*) AS count FROM idempotency_cache WHERE command_name = ? AND key = ?`,
    ).get('createOrder', 'abc') as { count: number };
    expect(row.count).toBe(0);
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
