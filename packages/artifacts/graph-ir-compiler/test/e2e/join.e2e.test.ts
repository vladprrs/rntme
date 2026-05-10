import { describe, it, expect } from 'bun:test';
import { compile, execute } from '../../src/index.js';
import { makeDb, loadJson } from './helpers.js';

const pdm = loadJson('commerce.pdm.json');
const qsm = loadJson('commerce.qsm.json');

const spec = {
  version: '1.0-rc7',
  pdmRef: 'x',
  qsmRef: 'y',
  shapes: {},
  graphs: {
    febItems: {
      id: 'febItems',
      signature: {
        inputs: {
          dateFrom: { type: 'datetime', mode: 'required' },
          dateTo: { type: 'datetime', mode: 'required' },
        },
        output: { type: 'rowset<OrderItem>', from: 'f' },
      },
      nodes: [
        { id: 'items', type: 'findMany', config: { source: { entity: 'OrderItem' } } },
        {
          id: 'f',
          type: 'filter',
          config: {
            input: 'items',
            expr: {
              between: [
                'orderItem.order.createdAt',
                { $param: 'dateFrom' },
                { $param: 'dateTo' },
              ],
            },
          },
        },
      ],
    },
  },
};

describe('E2E: dot-navigation + JOIN', () => {
  it('filters by order.createdAt', () => {
    const db = makeDb();
    try {
      const r = compile(spec, pdm, qsm);
      if (!r.ok) throw new Error('compile failed');
      const rows = execute(
        r.value,
        {
          dateFrom: '2026-02-01T00:00:00Z',
          dateTo: '2026-02-28T23:59:59Z',
        },
        db,
      );
      expect(rows).toHaveLength(2);
    } finally {
      db.close();
    }
  });
});
