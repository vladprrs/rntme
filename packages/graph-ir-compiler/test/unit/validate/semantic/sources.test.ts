import { describe, it, expect } from 'vitest';
import { resolveSources } from '../../../../src/validate/semantic/sources.js';
import { normalize } from '../../../../src/canonical/normalize.js';
import type { AuthoringSpecOutput } from '../../../../src/parse/schema.js';
import { commercePdm as P, commerceQsm as Q } from '../../../fixtures/validated-commerce.js';

const good: AuthoringSpecOutput = {
  version: '1.0-rc7',
  pdmRef: 'x',
  qsmRef: 'y',
  shapes: {},
  graphs: {
    g: {
      id: 'g',
      signature: { inputs: {}, output: { type: 'rowset<OrderItem>', from: 'items' } },
      nodes: [{ id: 'items', type: 'findMany', config: { source: { entity: 'OrderItem' } } }],
    },
  },
};

describe('resolveSources', () => {
  it('returns a map of node id → resolution for known entity', () => {
    const { graphs } = normalize(good);
    const r = resolveSources(graphs.g!, P, Q);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.get('items')).toMatchObject({ kind: 'entity', table: 'order_items' });
  });

  it('returns SEM_SOURCE_NOT_FOUND for unknown entity', () => {
    const bad: AuthoringSpecOutput = {
      ...good,
      graphs: {
        g: {
          id: 'g',
          signature: good.graphs.g!.signature,
          nodes: [{ id: 'items', type: 'findMany', config: { source: { entity: 'Ghost' } } }],
        },
      },
    };
    const { graphs } = normalize(bad);
    const r = resolveSources(graphs.g!, P, Q);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.code).toBe('SEM_SOURCE_NOT_FOUND');
  });

  it('resolves projection source to underlying entity table', () => {
    const spec: AuthoringSpecOutput = {
      ...good,
      graphs: {
        g: {
          id: 'g',
          signature: good.graphs.g!.signature,
          nodes: [
            {
              id: 'rows',
              type: 'findMany',
              config: { source: { projection: 'CategorySalesMirror' } },
            },
          ],
        },
      },
    };
    const { graphs } = normalize(spec);
    const r = resolveSources(graphs.g!, P, Q);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.get('rows')).toMatchObject({
        kind: 'projection',
        projection: 'CategorySalesMirror',
        entity: 'OrderItem',
        table: 'order_items',
        alias: 'categorySalesMirror',
      });
    }
  });
});
