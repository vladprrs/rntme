import Database from 'better-sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  createPendingStore,
  type DatabaseLike,
  type PendingStore,
} from '../../src/pending-store.js';

let store: PendingStore;

beforeEach(() => {
  const db = new Database(':memory:');
  store = createPendingStore({ db: db as unknown as DatabaseLike, now: () => 1_000_000 });
});

describe('PendingStore', () => {
  it('inserts a pending row and reads it back', () => {
    store.insertPending({
      fileId: 'f1',
      routeId: 'r',
      entityId: 'e',
      ownerPrincipal: 'u',
      contentType: 'image/png',
      declaredSize: 100,
      objectKey: 'r/e/f1',
      ttlMs: 60_000,
      idempotencyKey: 'k1',
    });
    const r = store.findById('f1');
    expect(r?.state).toBe('pending');
    expect(r?.objectKey).toBe('r/e/f1');
  });

  it('idempotency: second insertPending with same key returns existing', () => {
    store.insertPending({
      fileId: 'a',
      routeId: 'r',
      entityId: 'e',
      ownerPrincipal: 'u',
      contentType: 'png',
      declaredSize: 1,
      objectKey: 'k',
      ttlMs: 60_000,
      idempotencyKey: 'idem',
    });
    const out = store.insertPending({
      fileId: 'b',
      routeId: 'r',
      entityId: 'e',
      ownerPrincipal: 'u',
      contentType: 'png',
      declaredSize: 1,
      objectKey: 'k',
      ttlMs: 60_000,
      idempotencyKey: 'idem',
    });
    expect(out.fileId).toBe('a');
    expect(out.deduped).toBe(true);
  });

  it('markCommitted advances state and stores actualSize/sha256', () => {
    store.insertPending({
      fileId: 'f',
      routeId: 'r',
      entityId: 'e',
      ownerPrincipal: 'u',
      contentType: 'png',
      declaredSize: 1,
      objectKey: 'k',
      ttlMs: 60_000,
    });
    store.markCommitted('f', { actualSize: 42, sha256: 'abc' });
    expect(store.findById('f')?.state).toBe('committed');
    expect(store.findById('f')?.actualSize).toBe(42);
  });

  it('listCommitted returns committed rows for (route, entity), newest first', () => {
    store.insertPending({
      fileId: 'a',
      routeId: 'r',
      entityId: 'e',
      ownerPrincipal: 'u',
      contentType: 'png',
      declaredSize: 1,
      objectKey: 'k1',
      ttlMs: 60_000,
    });
    store.markCommitted('a', { actualSize: 1, sha256: 'x' });
    expect(store.listCommitted('r', 'e', 100).map((f) => f.fileId)).toEqual(['a']);
  });

  it('countCommitted respects the (route, entity) filter', () => {
    store.insertPending({
      fileId: 'a',
      routeId: 'r',
      entityId: 'e',
      ownerPrincipal: 'u',
      contentType: 'png',
      declaredSize: 1,
      objectKey: 'k',
      ttlMs: 60_000,
    });
    store.markCommitted('a', { actualSize: 1, sha256: 'x' });
    expect(store.countCommitted('r', 'e')).toBe(1);
    expect(store.countCommitted('r', 'other')).toBe(0);
  });

  it('findStalePending returns rows past expiresAt', () => {
    store.insertPending({
      fileId: 'a',
      routeId: 'r',
      entityId: 'e',
      ownerPrincipal: 'u',
      contentType: 'png',
      declaredSize: 1,
      objectKey: 'k',
      ttlMs: 1_000,
    });
    const stale = store.findStalePending(1_005_000);
    expect(stale.map((s) => s.fileId)).toEqual(['a']);
  });
});
