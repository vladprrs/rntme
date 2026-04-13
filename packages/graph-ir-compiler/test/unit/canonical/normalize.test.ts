import { describe, it, expect } from 'vitest';
import { normalize } from '../../../src/canonical/normalize.js';
import type { AuthoringSpecOutput } from '../../../src/parse/schema.js';

const spec: AuthoringSpecOutput = {
  version: '1.0-rc7',
  pdmRef: 'x',
  qsmRef: 'y',
  shapes: {},
  graphs: {
    g: {
      id: 'g',
      signature: { inputs: {}, output: { type: 'rowset<OrderItem>', from: 'paged' } },
      nodes: [
        { id: 'items', type: 'findMany', config: { source: { entity: 'OrderItem' } } },
        { id: 'paged', type: 'limit', config: { input: 'items', count: 10 } },
      ],
    },
  },
};

describe('normalize', () => {
  it('camelCases findMany alias', () => {
    const g = normalize(spec).graphs.g!;
    const fm = g.nodes[0]!;
    if (fm.kind !== 'findMany') throw new Error('wrong');
    expect(fm.alias).toBe('orderItem');
  });

  it('attaches a unique scope id to each node', () => {
    const g = normalize(spec).graphs.g!;
    const scopes = g.nodes.map((n) => n.scope);
    expect(new Set(scopes).size).toBe(scopes.length);
  });

  it('copies outputFrom from signature', () => {
    const g = normalize(spec).graphs.g!;
    expect(g.outputFrom).toBe('paged');
  });

  it('fills default dir/nulls on sort keys', () => {
    const s: AuthoringSpecOutput = {
      ...spec,
      graphs: {
        g: {
          id: 'g',
          signature: { inputs: {}, output: { type: 'rowset<OrderItem>', from: 'sorted' } },
          nodes: [
            { id: 'items', type: 'findMany', config: { source: { entity: 'OrderItem' } } },
            { id: 'sorted', type: 'sort', config: { input: 'items', by: [{ field: 'a' }] } },
          ],
        },
      },
    };
    const g = normalize(s).graphs.g!;
    const sort = g.nodes[1]!;
    if (sort.kind !== 'sort') throw new Error('wrong');
    expect(sort.by[0]).toEqual({ field: 'a', dir: 'asc', nulls: 'last' });
  });
});
