import { describe, it, expect } from 'bun:test';
import { checkIds } from '../../../../src/validate/structural/ids.js';
import type { AuthoringSpecOutput } from '../../../../src/parse/schema.js';

const baseSig = { inputs: {}, output: { type: 'rowset<OrderItem>', from: 'items' } };

function spec(graphs: AuthoringSpecOutput['graphs']): AuthoringSpecOutput {
  return { version: '1.0-rc7', pdmRef: 'x', qsmRef: 'y', shapes: {}, graphs };
}

describe('checkIds', () => {
  it('returns no errors for unique ids', () => {
    const s = spec({
      g: {
        id: 'g',
        signature: baseSig,
        nodes: [{ id: 'items', type: 'findMany', config: { source: { entity: 'OrderItem' } } }],
      },
    });
    expect(checkIds(s)).toEqual([]);
  });

  it('reports duplicate node ids within one graph', () => {
    const s = spec({
      g: {
        id: 'g',
        signature: baseSig,
        nodes: [
          { id: 'a', type: 'findMany', config: { source: { entity: 'OrderItem' } } },
          { id: 'a', type: 'limit', config: { input: 'a', count: 10 } },
        ],
      },
    });
    const errs = checkIds(s);
    expect(errs).toHaveLength(1);
    expect(errs[0]?.code).toBe('STRUCT_DUPLICATE_NODE_ID');
    expect(errs[0]?.location?.graphId).toBe('g');
  });

  it('reports mismatch between graph key and graph.id', () => {
    const s = spec({
      g: {
        id: 'h',
        signature: baseSig,
        nodes: [{ id: 'items', type: 'findMany', config: { source: { entity: 'OrderItem' } } }],
      },
    });
    const errs = checkIds(s);
    expect(errs.some((e) => e.code === 'STRUCT_DUPLICATE_GRAPH_ID')).toBe(true);
  });
});
