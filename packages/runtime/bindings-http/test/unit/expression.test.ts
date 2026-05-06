import { describe, it, expect } from 'vitest';
import { evaluateExpression } from '../../src/runtime/expression.js';

const scope = {
  body: { amount: 42, note: 'hi' },
  query: { limit: 10 },
  auth: { userId: 'u-1' },
  config: { selfUrl: 'https://app.test' },
  system: { randomBytes: 'abc123' },
  result: { customer: { id: 'cust-1' }, nonce: 'zzz' },
};

describe('evaluateExpression', () => {
  it('resolves a top-level $body reference to a primitive', () => {
    expect(evaluateExpression('$body.amount', scope)).toBe(42);
  });
  it('resolves nested $result fields', () => {
    expect(evaluateExpression('$result.customer.id', scope)).toBe('cust-1');
  });
  it('returns non-string literals unchanged', () => {
    expect(evaluateExpression(100, scope)).toBe(100);
    expect(evaluateExpression(true, scope)).toBe(true);
    expect(evaluateExpression(null, scope)).toBe(null);
  });
  it('walks objects, resolving each $-prefixed leaf', () => {
    const out = evaluateExpression(
      { customerId: '$result.customer.id', amount: '$body.amount', note: '$body.note' },
      scope,
    );
    expect(out).toEqual({ customerId: 'cust-1', amount: 42, note: 'hi' });
  });
  it('walks arrays', () => {
    const out = evaluateExpression(['$auth.userId', '$body.note'], scope);
    expect(out).toEqual(['u-1', 'hi']);
  });
  it('leaves plain strings without $ prefix unchanged', () => {
    expect(evaluateExpression('hello', scope)).toBe('hello');
  });
  it('throws on a reference to an undefined path', () => {
    expect(() => evaluateExpression('$body.nope', scope)).toThrow(/unknown/i);
  });
  it('throws on unknown scope key', () => {
    expect(() => evaluateExpression('$foo.bar', scope)).toThrow(/unknown/i);
  });
});
