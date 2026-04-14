import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateBindings, parseBindingArtifact } from '@rntme/bindings';
import type { BindingResolvers, ValidatedBindings } from '@rntme/bindings';
import { buildPlan } from '../../src/startup/compile-plan.js';
import { BindingsRuntimeError } from '../../src/errors.js';

const here = dirname(fileURLToPath(import.meta.url));
const compilerRoot = join(here, '..', '..', '..', 'graph-ir-compiler');
const loadJson = <T>(p: string): T => JSON.parse(readFileSync(p, 'utf8')) as T;

const spec = loadJson(join(compilerRoot, 'test', 'golden', 'category-sales', 'graph.json'));
const pdm = loadJson(join(compilerRoot, 'test', 'e2e', 'fixtures', 'commerce.pdm.json'));
const qsm = loadJson(join(compilerRoot, 'test', 'e2e', 'fixtures', 'commerce.qsm.json'));

const resolvers: BindingResolvers = {
  resolveGraphSignature: (id) =>
    id === 'getCategorySales'
      ? {
          id,
          inputs: {
            dateFrom: { type: { kind: 'scalar', primitive: 'datetime' }, mode: 'required' },
            dateTo: { type: { kind: 'scalar', primitive: 'datetime' }, mode: 'required' },
            minRevenue: { type: { kind: 'scalar', primitive: 'decimal' }, mode: 'predicate_optional' },
            limit: { type: { kind: 'scalar', primitive: 'integer' }, mode: 'defaulted', default: 20 },
          },
          output: { type: { kind: 'rowset', shape: 'CategorySalesAgg' }, from: 'paged' },
        }
      : null,
  resolveShape: (name) =>
    name === 'CategorySalesAgg'
      ? {
          name,
          origin: 'custom',
          fields: {
            categoryId: { type: { kind: 'scalar', primitive: 'integer' }, nullable: false },
            revenue: { type: { kind: 'scalar', primitive: 'decimal' }, nullable: false },
            totalQuantity: { type: { kind: 'scalar', primitive: 'integer' }, nullable: false },
            lineCount: { type: { kind: 'scalar', primitive: 'integer' }, nullable: false },
            avgItemPrice: { type: { kind: 'scalar', primitive: 'decimal' }, nullable: false },
          },
        }
      : null,
};

function makeValidated(): ValidatedBindings {
  const artifact = {
    version: '1.0',
    graphSpecRef: 'commerce.graphs.v1',
    pdmRef: 'commerce.domain.v1',
    qsmRef: 'commerce.read.v1',
    bindings: {
      getCategorySalesHttp: {
        graph: 'getCategorySales',
        target: { engine: 'sqlite', dialect: 'sqlite' },
        http: {
          method: 'GET',
          path: '/v1/analytics/category-sales',
          parameters: [
            { name: 'dateFrom', in: 'query', bindTo: 'dateFrom', required: true },
            { name: 'dateTo', in: 'query', bindTo: 'dateTo', required: true },
            { name: 'minRevenue', in: 'query', bindTo: 'minRevenue', required: false },
            { name: 'limit', in: 'query', bindTo: 'limit', required: false },
          ],
        },
      },
    },
  };
  const parsed = parseBindingArtifact(artifact);
  if (!parsed.ok) throw new Error('parse failed: ' + JSON.stringify(parsed.errors));
  const validated = validateBindings(parsed.value, resolvers);
  if (!validated.ok) throw new Error('validate failed: ' + JSON.stringify(validated.errors));
  return validated.value;
}

describe('buildPlan', () => {
  it('returns a plan for every binding with compiled SQL', () => {
    const validated = makeValidated();
    const plan = buildPlan(validated, spec, pdm, qsm);
    expect(Object.keys(plan)).toEqual(['getCategorySalesHttp']);
    expect(plan.getCategorySalesHttp!.compiled.sql.length).toBeGreaterThan(0);
    expect(plan.getCategorySalesHttp!.bindToMap).toEqual({
      dateFrom: 'dateFrom',
      dateTo: 'dateTo',
      minRevenue: 'minRevenue',
      limit: 'limit',
    });
    expect(plan.getCategorySalesHttp!.schemas.querySchema).toBeDefined();
  });

  it('throws BindingsRuntimeError when compile fails', () => {
    const validated = makeValidated();
    const brokenSpec = { version: '1.0-rc7', pdmRef: 'x', qsmRef: 'y', shapes: {}, graphs: {} };
    expect(() => buildPlan(validated, brokenSpec, pdm, qsm)).toThrow(BindingsRuntimeError);
  });
});
