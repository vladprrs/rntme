import { describe, it, expect } from 'bun:test';
import { checkTier1Expr } from '../../../../src/validate/structural/tier1-expr.js';
import type { AuthoringSpecOutput } from '../../../../src/parse/schema.js';

function filterSpec(expr: unknown): AuthoringSpecOutput {
  return {
    version: '1.0-rc7',
    pdmRef: 'x',
    qsmRef: 'y',
    shapes: {},
    graphs: {
      g: {
        id: 'g',
        signature: { inputs: {}, output: { type: 'rowset<X>', from: 'f' } },
        nodes: [
          { id: 'items', type: 'findMany', config: { source: { entity: 'X' } } },
          { id: 'f', type: 'filter', config: { input: 'items', expr: expr as never } },
        ],
      },
    },
  };
}

describe('checkTier1Expr', () => {
  it('rejects exists', () => {
    const errs = checkTier1Expr(filterSpec({ exists: { relation: 'x' } }));
    expect(errs[0]?.code).toBe('TIER1_UNSUPPORTED_EXPR');
  });

  it('rejects in', () => {
    const errs = checkTier1Expr(filterSpec({ in: ['x', { $list: [1, 2] }] }));
    expect(errs[0]?.code).toBe('TIER1_UNSUPPORTED_EXPR');
  });

  it('rejects $list', () => {
    const errs = checkTier1Expr(filterSpec({ $list: [1, 2] }));
    expect(errs[0]?.code).toBe('TIER1_UNSUPPORTED_EXPR');
  });

  it('rejects lookup inside map.fields', () => {
    const s: AuthoringSpecOutput = {
      version: '1.0-rc7',
      pdmRef: 'x',
      qsmRef: 'y',
      shapes: { S: { fields: { a: { type: 'string', nullable: true } } } },
      graphs: {
        g: {
          id: 'g',
          signature: { inputs: {}, output: { type: 'rowset<S>', from: 'm' } },
          nodes: [
            { id: 'items', type: 'findMany', config: { source: { entity: 'OrderItem' } } },
            {
              id: 'm',
              type: 'map',
              config: {
                input: 'items',
                into: 'S',
                fields: {
                  a: { lookup: { entity: 'Category', match: { id: 'items.id' }, field: 'name' } },
                },
              },
            },
          ],
        },
      },
    };
    const errs = checkTier1Expr(s);
    expect(errs[0]?.code).toBe('TIER1_UNSUPPORTED_EXPR');
  });

  it('accepts a plain comparison expr', () => {
    const errs = checkTier1Expr(filterSpec({ gte: ['x', 10] }));
    expect(errs).toEqual([]);
  });
});
