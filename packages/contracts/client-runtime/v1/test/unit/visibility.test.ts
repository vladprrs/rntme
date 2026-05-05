import { describe, expect, it } from 'vitest';
import { evaluateVisible } from '../../src/visibility.js';

const stateGet = (state: Record<string, unknown>) => (p: string) => state[p];

describe('evaluateVisible', () => {
  it('truthy form', () => {
    expect(evaluateVisible(undefined, stateGet({}))).toBe(true);
    expect(evaluateVisible({ $state: '/x' }, stateGet({ '/x': 'a' }))).toBe(true);
    expect(evaluateVisible({ $state: '/x' }, stateGet({ '/x': null }))).toBe(false);
    expect(evaluateVisible({ $state: '/x' }, stateGet({ '/x': '' }))).toBe(false);
  });

  it('eq operator', () => {
    expect(
      evaluateVisible({ $state: '/auth/status', eq: 'authed' }, stateGet({ '/auth/status': 'authed' })),
    ).toBe(true);
    expect(
      evaluateVisible({ $state: '/auth/status', eq: 'authed' }, stateGet({ '/auth/status': 'anon' })),
    ).toBe(false);
  });

  it('contains operator on arrays', () => {
    expect(
      evaluateVisible({ $state: '/u/roles', contains: 'admin' }, stateGet({ '/u/roles': ['admin', 'user'] })),
    ).toBe(true);
    expect(
      evaluateVisible({ $state: '/u/roles', contains: 'admin' }, stateGet({ '/u/roles': ['user'] })),
    ).toBe(false);
  });

  it('contains operator on strings', () => {
    expect(evaluateVisible({ $state: '/q', contains: 'foo' }, stateGet({ '/q': 'food' }))).toBe(true);
    expect(evaluateVisible({ $state: '/q', contains: 'foo' }, stateGet({ '/q': 'bar' }))).toBe(false);
  });

  it('not operator', () => {
    expect(evaluateVisible({ $state: '/x', not: true }, stateGet({ '/x': null }))).toBe(true);
    expect(evaluateVisible({ $state: '/x', not: true }, stateGet({ '/x': 'a' }))).toBe(false);
  });
});
