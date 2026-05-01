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
    Line: {
      fields: {
        id: { type: 'integer', nullable: false },
        total: { type: 'decimal', nullable: false },
      },
    },
  },
  graphs: {
    lineTotals: {
      id: 'lineTotals',
      signature: { inputs: {}, output: { type: 'rowset<Line>', from: 'm' } },
      nodes: [
        { id: 'items', type: 'findMany' as const, config: { source: { entity: 'OrderItem' } } },
        {
          id: 'm',
          type: 'map' as const,
          config: {
            input: 'items',
            into: 'Line',
            fields: {
              id: 'orderItem.id',
              total: { mul: ['orderItem.unitPrice', 'orderItem.quantity'] },
            },
          },
        },
      ],
    },
  },
};

describe('E2E: map', () => {
  it('projects id and computed total', () => {
    const db = makeDb();
    try {
      const r = compile(spec, pdm, qsm);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      const rows = execute(r.value, {}, db) as Array<{ id: number; total: number }>;
      expect(rows).toHaveLength(6);
      const byId = new Map(rows.map((row) => [row.id, row]));
      expect(byId.get(1)).toEqual({ id: 1, total: 500 });
      expect(byId.get(2)).toEqual({ id: 2, total: 40 });
    } finally {
      db.close();
    }
  });
});
