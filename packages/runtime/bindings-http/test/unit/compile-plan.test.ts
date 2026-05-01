import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileForGraph } from '../../src/startup/compile-plan.js';

const here = dirname(fileURLToPath(import.meta.url));
const compilerRoot = join(here, '..', '..', '..', '..', 'artifacts', 'graph-ir-compiler');

const loadJson = <T>(p: string): T => JSON.parse(readFileSync(p, 'utf8')) as T;

const spec = loadJson(join(compilerRoot, 'test', 'golden', 'category-sales', 'graph.json'));
const pdm = loadJson(join(compilerRoot, 'test', 'e2e', 'fixtures', 'commerce.pdm.json'));
const qsm = loadJson(join(compilerRoot, 'test', 'e2e', 'fixtures', 'commerce.qsm.json'));

describe('compileForGraph', () => {
  it('compiles a single graph from a multi-graph spec', () => {
    const r = compileForGraph(spec, 'getCategorySales', pdm, qsm);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.sql.length).toBeGreaterThan(0);
      expect(r.value.paramOrder).toEqual(expect.arrayContaining(['dateFrom', 'dateTo']));
    }
  });

  it('returns compiler errors for unknown graph id', () => {
    const r = compileForGraph(spec, 'missingGraph', pdm, qsm);
    expect(r.ok).toBe(false);
  });
});
