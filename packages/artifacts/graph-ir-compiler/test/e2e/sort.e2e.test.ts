import { describe, it, expect } from 'bun:test';
import { compile, execute } from '../../src/index.js';
import { makeDb, loadJson } from './helpers.js';

const pdm = loadJson('commerce.pdm.json');
const qsm = loadJson('commerce.qsm.json');

const spec = {
  version: '1.0-rc7' as const,
  pdmRef: 'x',
  qsmRef: 'y',
  shapes: {},
  graphs: {
    sortedCategories: {
      id: 'sortedCategories',
      signature: { inputs: {}, output: { type: 'rowset<Category>', from: 's' } },
      nodes: [
        { id: 'cats', type: 'findMany' as const, config: { source: { entity: 'Category' } } },
        {
          id: 's',
          type: 'sort' as const,
          config: {
            input: 'cats',
            by: [{ field: 'category.name', dir: 'asc', nulls: 'last' }],
          },
        },
      ],
    },
  },
};

describe('E2E: sort', () => {
  it('orders categories alphabetically with NULL last', () => {
    const db = makeDb();
    try {
      const r = compile(spec, pdm, qsm);
      if (!r.ok) throw new Error('compile failed');
      const rows = execute(r.value, {}, db) as Array<{ id: number; name: string | null }>;
      expect(rows.map((row) => row.name)).toEqual(['Books', 'Electronics', null]);
    } finally {
      db.close();
    }
  });
});
