// test/unit/lower/sqlite/invariants.test.ts
import { describe, it, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile } from '../../../../src/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const graph = JSON.parse(readFileSync(join(here, '..', '..', '..', 'golden', 'category-sales', 'graph.json'), 'utf8'));
const pdm = JSON.parse(readFileSync(join(here, '..', '..', '..', 'e2e', 'fixtures', 'commerce.pdm.json'), 'utf8'));
const qsm = JSON.parse(readFileSync(join(here, '..', '..', '..', 'e2e', 'fixtures', 'commerce.qsm.json'), 'utf8'));

describe('lowering invariants', () => {
  it('paramOrder.length equals ? count', () => {
    const r = compile(graph, pdm, qsm);
    expect(r.ok).toBe(true);
    if (r.ok) {
      const count = (r.value.sql.match(/\?/g) ?? []).length;
      expect(r.value.paramOrder.length).toBe(count);
    }
  });

  it('compile is deterministic', () => {
    const a = compile(graph, pdm, qsm);
    const b = compile(graph, pdm, qsm);
    if (a.ok && b.ok) {
      expect(a.value.sql).toBe(b.value.sql);
      expect(a.value.paramOrder).toEqual(b.value.paramOrder);
    }
  });
});
