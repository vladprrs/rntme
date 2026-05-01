import { describe, it, expect } from 'vitest';
import { compile, execute } from '../../src/index.js';
import { makeDb, loadJson } from './helpers.js';

const pdm = loadJson('commerce.pdm.json');
const qsm = loadJson('commerce.qsm.json');

const spec = {
  version: '1.0-rc7' as const,
  pdmRef: 'x',
  qsmRef: 'y',
  shapes: {
    Agg: {
      fields: {
        productId: { type: 'integer', nullable: false },
        revenue: { type: 'decimal', nullable: false },
        lineCount: { type: 'integer', nullable: false },
        distinctOrders: { type: 'integer', nullable: false },
        avgItemPrice: { type: 'decimal', nullable: false },
      },
    },
  },
  graphs: {
    agg: {
      id: 'agg',
      signature: { inputs: {}, output: { type: 'rowset<Agg>', from: 'r' } },
      nodes: [
        { id: 'items', type: 'findMany', config: { source: { entity: 'OrderItem' } } },
        {
          id: 'r',
          type: 'reduce',
          config: {
            input: 'items',
            into: 'Agg',
            group: { productId: 'orderItem.productId' },
            measures: {
              revenue: { fn: 'sum', expr: { mul: ['orderItem.unitPrice', 'orderItem.quantity'] } },
              lineCount: { fn: 'count' },
              distinctOrders: { fn: 'count_distinct', expr: 'orderItem.orderId' },
              avgItemPrice: { fn: 'avg', expr: 'orderItem.unitPrice' },
            },
          },
        },
      ],
    },
  },
};

describe('E2E: reduce', () => {
  it('aggregates by product', () => {
    const db = makeDb();
    try {
      const r = compile(spec, pdm, qsm);
      if (!r.ok) throw new Error('compile failed');
      const rows = execute(r.value, {}, db) as Array<{
        productId: number;
        revenue: number;
        lineCount: number;
        distinctOrders: number;
      }>;
      const byId = Object.fromEntries(rows.map((row) => [row.productId, row]));
      expect(byId[11]).toMatchObject({ revenue: 2900, lineCount: 2, distinctOrders: 2 });
      expect(byId[30]).toMatchObject({ revenue: 20, lineCount: 1, distinctOrders: 1 });
    } finally {
      db.close();
    }
  });
});
