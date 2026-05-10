import { describe, it, expect } from 'bun:test';
import { inferExprType } from '../../../../src/validate/semantic/types.js';
import type { Scope } from '../../../../src/validate/semantic/scope.js';
import { commercePdm as P } from '../../../fixtures/validated-commerce.js';
const scope: Scope = { aliases: new Map([['orderItem', { kind: 'entity', entity: 'OrderItem' }]]) };
const params = new Map<string, { type: string; nullable: boolean }>([
  ['minPrice', { type: 'decimal', nullable: false }],
]);

describe('inferExprType', () => {
  it('types a literal number as integer-compatible', () => {
    const r = inferExprType(10, scope, P, params);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.type).toBe('integer');
  });

  it('types a field reference', () => {
    const r = inferExprType('orderItem.unitPrice', scope, P, params);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.type).toBe('decimal');
  });

  it('accepts integer vs decimal via widening', () => {
    const r = inferExprType({ gte: ['orderItem.unitPrice', 10] }, scope, P, params);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.type).toBe('boolean');
  });

  it('rejects string vs integer comparison', () => {
    const r = inferExprType({ gt: ['orderItem.unitPrice', { $literal: 'abc' }] }, scope, P, params);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.code).toBe('SEM_TYPE_MISMATCH');
  });

  it('resolves $param against signature inputs', () => {
    const r = inferExprType({ gte: ['orderItem.unitPrice', { $param: 'minPrice' }] }, scope, P, params);
    expect(r.ok).toBe(true);
  });

  it('rejects unknown $param', () => {
    const r = inferExprType({ gt: ['orderItem.unitPrice', { $param: 'ghost' }] }, scope, P, params);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.code).toBe('SEM_PARAM_UNKNOWN');
  });
});
