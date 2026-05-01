import { describe, it, expect } from 'vitest';
import { resolveField } from '../../../../src/validate/semantic/fields.js';
import type { Scope } from '../../../../src/validate/semantic/scope.js';
import { commercePdm as P } from '../../../fixtures/validated-commerce.js';

describe('resolveField (single-level)', () => {
  const scope: Scope = {
    aliases: new Map([['orderItem', { kind: 'entity', entity: 'OrderItem' }]]),
  };

  it('resolves alias.field to entity field type', () => {
    const r = resolveField('orderItem.unitPrice', scope, P);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toMatchObject({
        type: 'decimal',
        nullable: false,
        column: 'unit_price',
        table: 'orderItem',
        path: ['orderItem'],
      });
    }
  });

  it('returns err for unknown field', () => {
    const r = resolveField('orderItem.ghost', scope, P);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.code).toBe('SEM_FIELD_NOT_FOUND');
  });

  it('returns err for unknown alias', () => {
    const r = resolveField('category.name', scope, P);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.code).toBe('SEM_FIELD_NOT_FOUND');
  });
});
