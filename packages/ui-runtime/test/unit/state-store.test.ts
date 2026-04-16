import { describe, expect, it, vi } from 'vitest';
import { createStateStore } from '../../src/client/state-store.js';

describe('createStateStore', () => {
  it('gets and sets values by path', () => {
    const store = createStateStore();
    store.set('/data/items', [1, 2, 3]);
    expect(store.get('/data/items')).toEqual([1, 2, 3]);
  });

  it('returns snapshot as a plain object', () => {
    const store = createStateStore();
    store.set('/a', 1);
    store.set('/b', 2);
    const snap = store.getSnapshot();
    expect(snap).toEqual({ '/a': 1, '/b': 2 });
  });

  it('notifies subscribers on set', () => {
    const store = createStateStore();
    const listener = vi.fn();
    store.subscribe(listener);
    store.set('/x', 'hello');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('unsubscribes correctly', () => {
    const store = createStateStore();
    const listener = vi.fn();
    const unsub = store.subscribe(listener);
    unsub();
    store.set('/x', 'hello');
    expect(listener).not.toHaveBeenCalled();
  });

  it('batch updates via update()', () => {
    const store = createStateStore();
    const listener = vi.fn();
    store.subscribe(listener);
    store.update({ '/a': 1, '/b': 2 });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.get('/a')).toBe(1);
    expect(store.get('/b')).toBe(2);
  });

  it('returns stable snapshot reference between sets', () => {
    const store = createStateStore();
    const snap1 = store.getSnapshot();
    const snap2 = store.getSnapshot();
    expect(snap1).toBe(snap2);

    store.set('/x', 1);
    const snap3 = store.getSnapshot();
    expect(snap3).not.toBe(snap1);
  });
});
