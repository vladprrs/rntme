import { describe, it, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile, execute } from '../../src/index.js';
import { makeDb, loadJson } from './helpers.js';

const here = dirname(fileURLToPath(import.meta.url));
/** Graph `getCategorySales` roots on `findMany` with `source: { entity: 'OrderItem' }` (not a QSM projection). */
const spec = JSON.parse(readFileSync(join(here, '..', 'golden', 'category-sales', 'graph.json'), 'utf8'));
const pdm = loadJson('commerce.pdm.json');
const qsm = loadJson('commerce.qsm.json');

describe('E2E: category sales', () => {
  it('aggregates revenue by product category within date range', () => {
    const db = makeDb();
    try {
      const r = compile(spec, pdm, qsm);
      if (!r.ok) throw new Error(`compile failed: ${JSON.stringify(r.errors)}`);
      const rows = execute(r.value, {
        dateFrom: '2026-01-01T00:00:00Z',
        dateTo: '2026-12-31T23:59:59Z',
        limit: 5,
      }, db) as Array<{ categoryId: number; revenue: number; lineCount: number }>;
      expect(rows.length).toBeGreaterThan(0);
      const rev = Object.fromEntries(rows.map((row) => [row.categoryId, row.revenue]));
      expect(rev[1]).toBeCloseTo(500 + 1500 + 1400, 2);
      expect(rev[2]).toBeCloseTo(20 * 2 + 15 * 3, 2);
    } finally {
      db.close();
    }
  });

  it('applies predicate_optional minRevenue', () => {
    const db = makeDb();
    try {
      const r = compile(spec, pdm, qsm);
      if (!r.ok) throw new Error('compile failed');
      const rows = execute(r.value, {
        dateFrom: '2026-01-01T00:00:00Z',
        dateTo: '2026-12-31T23:59:59Z',
        minRevenue: 1000,
      }, db) as Array<{ categoryId: number; revenue: number }>;
      for (const row of rows) expect(row.revenue).toBeGreaterThanOrEqual(1000);
    } finally {
      db.close();
    }
  });
});
