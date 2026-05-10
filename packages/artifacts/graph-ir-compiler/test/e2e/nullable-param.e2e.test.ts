import { describe, it, expect } from 'bun:test';
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
    byProductId: {
      id: 'byProductId',
      signature: {
        inputs: { productId: { type: 'integer', mode: 'nullable' } },
        output: { type: 'rowset<OrderItem>', from: 'f' },
      },
      nodes: [
        { id: 'items', type: 'findMany' as const, config: { source: { entity: 'OrderItem' } } },
        {
          id: 'f',
          type: 'filter' as const,
          config: {
            input: 'items',
            expr: { eq: ['orderItem.productId', { $param: 'productId' }] },
          },
        },
      ],
    },
  },
};

describe('E2E: nullable', () => {
  it('returns empty set when param is null', () => {
    const db = makeDb();
    try {
      const r = compile(spec, pdm, qsm);
      if (!r.ok) throw new Error('compile failed');
      const rows = execute(r.value, { productId: null }, db);
      expect(rows).toEqual([]);
    } finally {
      db.close();
    }
  });

  it('matches when param is present', () => {
    const db = makeDb();
    try {
      const r = compile(spec, pdm, qsm);
      if (!r.ok) throw new Error('compile failed');
      const rows = execute(r.value, { productId: 11 }, db);
      expect(rows).toHaveLength(2);
    } finally {
      db.close();
    }
  });
});
