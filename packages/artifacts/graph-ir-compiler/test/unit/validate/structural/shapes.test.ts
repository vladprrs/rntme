import { describe, it, expect } from 'bun:test';
import { checkShapes } from '../../../../src/validate/structural/shapes.js';
import type { AuthoringSpecOutput } from '../../../../src/parse/schema.js';
import { commercePdm as P, commerceQsm as Q } from '../../../fixtures/validated-commerce.js';

function spec(shapes: AuthoringSpecOutput['shapes'], from = 'paged'): AuthoringSpecOutput {
  return {
    version: '1.0-rc7',
    pdmRef: 'x',
    qsmRef: 'y',
    shapes,
    graphs: {
      g: {
        id: 'g',
        signature: { inputs: {}, output: { type: 'rowset<OrderItem>', from } },
        nodes: [
          { id: 'paged', type: 'map', config: { input: 'items', into: 'MissingShape', fields: {} } },
          { id: 'items', type: 'findMany', config: { source: { entity: 'OrderItem' } } },
        ],
      },
    },
  };
}

describe('checkShapes', () => {
  it('accepts PDM entity as shape', () => {
    const s: AuthoringSpecOutput = {
      ...spec({}),
      graphs: {
        g: {
          id: 'g',
          signature: { inputs: {}, output: { type: 'rowset<OrderItem>', from: 'items' } },
          nodes: [{ id: 'items', type: 'findMany', config: { source: { entity: 'OrderItem' } } }],
        },
      },
    };
    expect(checkShapes(s, P, Q)).toEqual([]);
  });

  it('rejects unknown map.into shape', () => {
    const errs = checkShapes(spec({}), P, Q);
    expect(errs.some((e) => e.code === 'STRUCT_UNKNOWN_SHAPE')).toBe(true);
  });

  it('accepts authoring-defined shape', () => {
    const errs = checkShapes(spec({ MissingShape: { fields: {} } }), P, Q);
    expect(errs).toEqual([]);
  });
});
