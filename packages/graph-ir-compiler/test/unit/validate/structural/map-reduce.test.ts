import { describe, it, expect } from 'vitest';
import { checkMapReduceCoverage } from '../../../../src/validate/structural/map-reduce.js';
import type { AuthoringSpecOutput } from '../../../../src/parse/schema.js';
import { commercePdm as P, commerceQsm as Q } from '../../../fixtures/validated-commerce.js';

function spec(
  shape: Record<string, { type: string; nullable: boolean }>,
  mapFields: Record<string, string>,
): AuthoringSpecOutput {
  return {
    version: '1.0-rc7',
    pdmRef: 'x',
    qsmRef: 'y',
    shapes: { S: { fields: shape as AuthoringSpecOutput['shapes'][string]['fields'] } },
    graphs: {
      g: {
        id: 'g',
        signature: { inputs: {}, output: { type: 'rowset<S>', from: 'm' } },
        nodes: [
          { id: 'items', type: 'findMany', config: { source: { entity: 'OrderItem' } } },
          { id: 'm', type: 'map', config: { input: 'items', into: 'S', fields: mapFields } },
        ],
      },
    },
  };
}

describe('checkMapReduceCoverage', () => {
  it('accepts exact key match', () => {
    const s = spec({ a: { type: 'integer', nullable: false } }, { a: 'items.id' });
    expect(checkMapReduceCoverage(s, P, Q)).toEqual([]);
  });

  it('rejects missing key in map.fields', () => {
    const s = spec(
      { a: { type: 'integer', nullable: false }, b: { type: 'integer', nullable: false } },
      { a: 'items.id' },
    );
    const errs = checkMapReduceCoverage(s, P, Q);
    expect(errs[0]?.code).toBe('STRUCT_MAP_SHAPE_COVERAGE');
  });

  it('rejects extra key in map.fields', () => {
    const s = spec({ a: { type: 'integer', nullable: false } }, { a: 'items.id', z: 'items.id' });
    expect(checkMapReduceCoverage(s, P, Q)[0]?.code).toBe('STRUCT_MAP_SHAPE_COVERAGE');
  });

  it("rejects reduce group+measures keys that don't match into shape", () => {
    const s: AuthoringSpecOutput = {
      version: '1.0-rc7',
      pdmRef: 'x',
      qsmRef: 'y',
      shapes: { R: { fields: { total: { type: 'decimal', nullable: false }, cnt: { type: 'integer', nullable: false } } } },
      graphs: {
        g: {
          id: 'g',
          signature: { inputs: {}, output: { type: 'rowset<R>', from: 'r' } },
          nodes: [
            { id: 'items', type: 'findMany', config: { source: { entity: 'OrderItem' } } },
            {
              id: 'r',
              type: 'reduce',
              config: {
                input: 'items',
                into: 'R',
                group: { total: 'orderItem.unitPrice' },
                measures: { extraKey: { fn: 'count' } },
              },
            },
          ],
        },
      },
    };
    const errs = checkMapReduceCoverage(s, P, Q);
    expect(errs[0]?.code).toBe('STRUCT_REDUCE_SHAPE_COVERAGE');
  });
});
