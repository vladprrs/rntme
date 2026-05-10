import { describe, it, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile } from '../../src/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const f = (name: string) => readFileSync(join(here, 'category-sales', name), 'utf8');

const spec = JSON.parse(f('graph.json'));
const pdm = JSON.parse(f('pdm.json'));
const qsm = JSON.parse(f('qsm.json'));

describe('golden: category-sales', () => {
  it('matches expected SQL and paramOrder', async () => {
    const r = compile(spec, pdm, qsm);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.sql + '\n').toBe(f('expected.sql'));
    expect(r.value.paramOrder).toEqual(JSON.parse(f('expected-params.json')));
  });
});
