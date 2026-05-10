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
    filterItems: {
      id: 'filterItems',
      signature: {
        inputs: { minPrice: { type: 'decimal', mode: 'predicate_optional' } },
        output: { type: 'rowset<OrderItem>', from: 'f' },
      },
      nodes: [
        { id: 'items', type: 'findMany' as const, config: { source: { entity: 'OrderItem' } } },
        {
          id: 'f',
          type: 'filter' as const,
          config: {
            input: 'items',
            expr: { gte: ['orderItem.unitPrice', { $param: 'minPrice' }] },
          },
        },
      ],
    },
  },
};

describe('E2E: predicate_optional', () => {
  it('filters when param is present', () => {
    const db = makeDb();
    try {
      const r = compile(spec, pdm, qsm);
      if (!r.ok) throw new Error('compile failed');
      const rows = execute(r.value, { minPrice: 1000 }, db);
      expect(rows).toHaveLength(2);
    } finally {
      db.close();
    }
  });

  it('returns all rows when param is absent', () => {
    const db = makeDb();
    try {
      const r = compile(spec, pdm, qsm);
      if (!r.ok) throw new Error('compile failed');
      const rows = execute(r.value, {}, db);
      expect(rows).toHaveLength(6);
    } finally {
      db.close();
    }
  });
});

const mixedSpec = {
  version: '1.0-rc7' as const,
  pdmRef: 'commerce.domain.v1',
  qsmRef: 'commerce.read.v1',
  shapes: {},
  graphs: {
    filterItemsMixed: {
      id: 'filterItemsMixed',
      signature: {
        inputs: {
          maxPrice: { type: 'decimal', mode: 'required' },
          minPrice: { type: 'decimal', mode: 'predicate_optional' },
        },
        output: { type: 'rowset<OrderItem>', from: 'f' },
      },
      nodes: [
        { id: 'items', type: 'findMany' as const, config: { source: { entity: 'OrderItem' } } },
        {
          id: 'f',
          type: 'filter' as const,
          config: {
            input: 'items',
            expr: {
              and: [
                { lte: ['orderItem.unitPrice', { $param: 'maxPrice' }] },
                { gte: ['orderItem.unitPrice', { $param: 'minPrice' }] },
              ],
            },
          },
        },
      ],
    },
  },
};

describe('E2E: predicate_optional with mixed params', () => {
  it('filters correctly when both required and predicate_optional params are present', () => {
    const db = makeDb();
    try {
      const r = compile(mixedSpec, pdm, qsm);
      if (!r.ok) throw new Error('compile failed');
      // maxPrice=1000, minPrice=100 → only unit_price 500 matches
      const rows = execute(r.value, { maxPrice: 1000, minPrice: 100 }, db);
      expect(rows).toHaveLength(1);
    } finally {
      db.close();
    }
  });

  it('applies only the required filter when predicate_optional param is absent', () => {
    const db = makeDb();
    try {
      const r = compile(mixedSpec, pdm, qsm);
      if (!r.ok) throw new Error('compile failed');
      // maxPrice=1000, no minPrice → guard fires on minPrice IS NULL, entire filter returns TRUE → 6 rows
      const rows = execute(r.value, { maxPrice: 1000 }, db);
      expect(rows).toHaveLength(6);
    } finally {
      db.close();
    }
  });
});
