import { describe, it, expect } from 'bun:test';
import { deepMerge } from '../../../src/openapi/passthrough.js';

describe('deepMerge', () => {
  it('merges plain objects recursively', () => {
    const result = deepMerge(
      { a: 1, b: { c: 2, d: 3 } },
      { b: { d: 30, e: 40 }, f: 5 },
    );
    expect(result).toEqual({ a: 1, b: { c: 2, d: 30, e: 40 }, f: 5 });
  });

  it('replaces arrays entirely', () => {
    const result = deepMerge({ tags: ['a', 'b'] }, { tags: ['c'] });
    expect(result).toEqual({ tags: ['c'] });
  });

  it('overwrites scalars', () => {
    const result = deepMerge({ x: 1, y: 'old' }, { y: 'new', z: true });
    expect(result).toEqual({ x: 1, y: 'new', z: true });
  });

  it('null in override unsets / replaces value', () => {
    expect(deepMerge({ x: { a: 1 } }, { x: null })).toEqual({ x: null });
  });

  it('does not mutate inputs', () => {
    const left = { a: { b: 1 } };
    const right = { a: { c: 2 } };
    const out = deepMerge(left, right);
    expect(left).toEqual({ a: { b: 1 } });
    expect(right).toEqual({ a: { c: 2 } });
    expect(out).toEqual({ a: { b: 1, c: 2 } });
  });
});
