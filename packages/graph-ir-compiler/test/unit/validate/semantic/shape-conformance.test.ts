import { describe, it, expect } from 'vitest';
import { validateSemantic } from '../../../../src/validate/semantic/index.js';
import { normalize } from '../../../../src/canonical/normalize.js';
import type { AuthoringSpecOutput } from '../../../../src/parse/schema.js';
import { commercePdm as P, commerceQsm as Q } from '../../../fixtures/validated-commerce.js';

function spec(field: unknown): AuthoringSpecOutput {
  return {
    version: '1.0-rc7',
    pdmRef: 'x',
    qsmRef: 'y',
    shapes: { S: { fields: { total: { type: 'decimal', nullable: false } } } },
    graphs: {
      g: {
        id: 'g',
        signature: { inputs: {}, output: { type: 'rowset<S>', from: 'm' } },
        nodes: [
          { id: 'items', type: 'findMany', config: { source: { entity: 'OrderItem' } } },
          { id: 'm', type: 'map', config: { input: 'items', into: 'S', fields: { total: field } } },
        ],
      },
    },
  };
}

describe('map shape conformance', () => {
  it('accepts compatible numeric expr', () => {
    const s = spec({ mul: ['orderItem.unitPrice', 'orderItem.quantity'] });
    const { graphs } = normalize(s);
    expect(validateSemantic(graphs.g!, P, Q, s.shapes).ok).toBe(true);
  });

  it('rejects string expr for decimal field', () => {
    const s = spec({ $literal: 'nope' });
    const { graphs } = normalize(s);
    const r = validateSemantic(graphs.g!, P, Q, s.shapes);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.code).toBe('SEM_SHAPE_MISMATCH');
  });

  it('rejects nullable source field mapped to non-nullable target', () => {
    // orderItem.product.id traverses a relation, making the result nullable
    // even though Product.id itself is not nullable (navigatedNullable in fields.ts)
    const s: AuthoringSpecOutput = {
      version: '1.0-rc7',
      pdmRef: 'x',
      qsmRef: 'y',
      shapes: { S: { fields: { pid: { type: 'integer', nullable: false } } } },
      graphs: {
        g: {
          id: 'g',
          signature: { inputs: {}, output: { type: 'rowset<S>', from: 'm' } },
          nodes: [
            { id: 'items', type: 'findMany', config: { source: { entity: 'OrderItem' } } },
            { id: 'm', type: 'map', config: { input: 'items', into: 'S', fields: { pid: 'orderItem.product.id' } } },
          ],
        },
      },
    };
    const { graphs } = normalize(s);
    const r = validateSemantic(graphs.g!, P, Q, s.shapes);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const codes = r.errors.map((e) => e.code);
      expect(codes).toContain('SEM_NULLABILITY_VIOLATION');
    }
  });
});
