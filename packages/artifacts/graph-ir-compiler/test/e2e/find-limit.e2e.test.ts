import { describe, it, expect } from 'vitest';
import { compile, execute } from '../../src/index.js';
import { makeDb, loadJson } from './helpers.js';

const pdm = loadJson('commerce.pdm.json');
const qsm = loadJson('commerce.qsm.json');

const spec = {
  version: '1.0-rc7' as const,
  pdmRef: 'commerce.domain.v1',
  qsmRef: 'commerce.read.v1',
  shapes: {},
  graphs: {
    listOrderItems: {
      id: 'listOrderItems',
      signature: { inputs: {}, output: { type: 'rowset<OrderItem>', from: 'paged' } },
      nodes: [
        { id: 'items', type: 'findMany' as const, config: { source: { entity: 'OrderItem' } } },
        { id: 'paged', type: 'limit' as const, config: { input: 'items', count: 3 } },
      ],
    },
  },
};

describe('E2E: findMany + literal limit', () => {
  it('returns the first 3 order items', () => {
    const db = makeDb();
    try {
      const r = compile(spec, pdm, qsm);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      const rows = execute(r.value, {}, db);
      expect(rows).toHaveLength(3);
      expect(rows[0]).toMatchObject({ id: 1, orderId: 100, productId: 10 });
    } finally {
      db.close();
    }
  });
});
