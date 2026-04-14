import { describe, it, expect } from 'vitest';
import { compile, execute } from '../../src/index.js';
import { makeDb, loadJson } from './helpers.js';

const pdm = loadJson('commerce.pdm.json');
const qsm = loadJson('commerce.qsm.json');

const spec = {
  version: '1.0-rc7',
  pdmRef: 'commerce.domain.v1',
  qsmRef: 'commerce.read.v1',
  shapes: {},
  graphs: {
    expensiveItems: {
      id: 'expensiveItems',
      signature: {
        inputs: { minPrice: { type: 'decimal', mode: 'required' } },
        output: { type: 'rowset<OrderItem>', from: 'paged' },
      },
      nodes: [
        { id: 'items', type: 'findMany', config: { source: { entity: 'OrderItem' } } },
        {
          id: 'filtered',
          type: 'filter',
          config: {
            input: 'items',
            expr: { gte: ['orderItem.unitPrice', { $param: 'minPrice' }] },
          },
        },
        { id: 'paged', type: 'limit', config: { input: 'filtered', count: 100 } },
      ],
    },
  },
};

describe('E2E: filter with required param', () => {
  it('returns only expensive items', () => {
    const db = makeDb();
    try {
      const r = compile(spec, pdm, qsm);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.value.paramOrder).toEqual(['minPrice']);
      const rows = execute(r.value, { minPrice: 1000 }, db) as Array<{ unitPrice: number }>;
      expect(rows.length).toBe(2);
      for (const row of rows) expect(row.unitPrice).toBeGreaterThanOrEqual(1000);
    } finally {
      db.close();
    }
  });

  it('throws on missing required param', () => {
    const db = makeDb();
    try {
      const r = compile(spec, pdm, qsm);
      if (!r.ok) throw new Error('compile failed');
      try {
        execute(r.value, {}, db);
        throw new Error('expected throw');
      } catch (e) {
        expect((e as { code?: string }).code).toBe('RUNTIME_MISSING_REQUIRED_PARAM');
        expect((e as Error).message).toMatch(/minPrice/);
      }
    } finally {
      db.close();
    }
  });
});
