import { describe, expect, it, vi } from 'vitest';
import { createStateStore } from '../../src/client/state-store.js';

describe('createStateStore', () => {
  it('reads and writes by path', () => {
    const s = createStateStore();
    s.set('/a/b', 42);
    expect(s.get('/a/b')).toBe(42);
    expect(s.get('/a')).toEqual({ b: 42 });
  });

  it('notifies subscribers on matching write', () => {
    const s = createStateStore();
    const cb = vi.fn();
    s.subscribe('/a/b', cb);
    s.set('/a/b', 1);
    s.set('/a/b', 2);
    expect(cb).toHaveBeenCalledTimes(2);
  });

  it('notifies prefix subscribers too', () => {
    const s = createStateStore();
    const cb = vi.fn();
    s.subscribe('/form', cb);
    s.set('/form/title', 'hi');
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('reset clears a prefix', () => {
    const s = createStateStore();
    s.set('/form/a', 1);
    s.set('/form/b', 2);
    s.set('/keep/x', 99);
    s.reset('/form');
    expect(s.get('/form')).toBeUndefined();
    expect(s.get('/keep/x')).toBe(99);
  });
});
