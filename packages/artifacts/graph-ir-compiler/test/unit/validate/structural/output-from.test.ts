import { describe, it, expect } from 'bun:test';
import { checkOutputFrom } from '../../../../src/validate/structural/output-from.js';
import type { AuthoringSpecOutput } from '../../../../src/parse/schema.js';

function spec(from: string): AuthoringSpecOutput {
  return {
    version: '1.0-rc7',
    pdmRef: 'x',
    qsmRef: 'y',
    shapes: {},
    graphs: {
      g: {
        id: 'g',
        signature: { inputs: {}, output: { type: 'rowset<X>', from } },
        nodes: [
          { id: 'items', type: 'findMany', config: { source: { entity: 'X' } } },
          { id: 'paged', type: 'limit', config: { input: 'items', count: 10 } },
        ],
      },
    },
  };
}

describe('checkOutputFrom', () => {
  it('accepts a from that matches a terminal node id', () => {
    expect(checkOutputFrom(spec('paged'))).toEqual([]);
  });

  it('rejects unknown from', () => {
    const errs = checkOutputFrom(spec('ghost'));
    expect(errs[0]?.code).toBe('STRUCT_INVALID_OUTPUT_FROM');
  });

  it('rejects non-terminal from (node that feeds another)', () => {
    const errs = checkOutputFrom(spec('items'));
    expect(errs[0]?.code).toBe('STRUCT_INVALID_OUTPUT_FROM');
  });
});
