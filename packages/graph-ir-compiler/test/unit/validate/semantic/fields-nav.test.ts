import { describe, it, expect } from 'vitest';
import { resolveField } from '../../../../src/validate/semantic/fields.js';
import { loadValidatedPdm } from '../../../load-validated.js';
import pdm from '../../../e2e/fixtures/commerce.pdm.json' with { type: 'json' };
import type { Scope } from '../../../../src/validate/semantic/scope.js';

const P = loadValidatedPdm(pdm);
const scope: Scope = { aliases: new Map([['orderItem', { entity: 'OrderItem' }]]) };

describe('dot-navigation resolveField', () => {
  it('resolves orderItem.order.createdAt', () => {
    const r = resolveField('orderItem.order.createdAt', scope, P);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.type).toBe('datetime');
      expect(r.value.path).toEqual(['orderItem', 'order']);
      expect(r.value.column).toBe('created_at');
    }
  });

  it('resolves orderItem.product.category.name', () => {
    const r = resolveField('orderItem.product.category.name', scope, P);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.type).toBe('string');
      expect(r.value.nullable).toBe(true);
      expect(r.value.path).toEqual(['orderItem', 'product', 'category']);
    }
  });

  it('rejects unknown relation step', () => {
    const r = resolveField('orderItem.ghost.field', scope, P);
    expect(r.ok).toBe(false);
  });
});
