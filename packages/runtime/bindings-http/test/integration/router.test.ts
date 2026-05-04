import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import {
  validateBindings,
  parseBindingArtifact,
  generateOpenApi,
} from '@rntme/bindings';
import type { BindingResolvers } from '@rntme/bindings';
import { createBindingsRouter } from '../../src/router.js';
import { BindingsRuntimeError } from '../../src/errors.js';
import {
  loadJson,
  parseGraphRuntimeInputs,
  parseRuntimeGraphSpec,
} from '../helpers/runtime-artifacts.js';

const here = dirname(fileURLToPath(import.meta.url));
const compilerRoot = join(here, '..', '..', '..', '..', 'artifacts', 'graph-ir-compiler');
const runtimeInputs = parseGraphRuntimeInputs({
  graphSpec: loadJson(join(compilerRoot, 'test', 'golden', 'category-sales', 'graph.json')),
  pdm: loadJson(join(compilerRoot, 'test', 'e2e', 'fixtures', 'commerce.pdm.json')),
  qsm: loadJson(join(compilerRoot, 'test', 'e2e', 'fixtures', 'commerce.qsm.json')),
});
const { graphSpec: spec, pdm, qsm } = runtimeInputs;
const seedSql = readFileSync(join(compilerRoot, 'test', 'e2e', 'fixtures', 'commerce.sql'), 'utf8');

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

let db: Database.Database;

beforeAll(() => {
  db = new Database(':memory:');
  db.exec(seedSql);
});

afterAll(() => {
  db.close();
});

function validated() {
  const parsed = parseBindingArtifact(artifact);
  if (!parsed.ok) throw new Error('parse fail');
  const v = validateBindings(parsed.value, resolvers);
  if (!v.ok) throw new Error('validate fail');
  return v.value;
}

describe('createBindingsRouter — end to end', () => {
  it('serves the configured binding and returns rows', async () => {
    const router = createBindingsRouter({
      validated: validated(),
      graphSpec: spec,
      pdm,
      qsm,
      db,
    });
    const res = await router.fetch(
      new Request(
        'http://x/v1/analytics/category-sales?dateFrom=2026-01-01T00:00:00Z&dateTo=2026-12-31T23:59:59Z&limit=5',
      ),
    );
    expect(res.status).toBe(200);
    const rows = (await res.json()) as Array<Record<string, unknown>>;
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]).toHaveProperty('categoryId');
  });

  it('mounts GET /openapi.json when openApiDoc is provided', async () => {
    const openApiResult = generateOpenApi(validated(), resolvers);
    if (!openApiResult.ok) throw new Error('generateOpenApi failed');
    const router = createBindingsRouter({
      validated: validated(),
      graphSpec: spec,
      pdm,
      qsm,
      db,
      openApiDoc: openApiResult.value,
    });
    const res = await router.fetch(new Request('http://x/openapi.json'));
    expect(res.status).toBe(200);
    const doc = (await res.json()) as { openapi: string; paths: Record<string, unknown> };
    expect(doc.openapi).toBe('3.1.0');
    expect(Object.keys(doc.paths)).toContain('/v1/analytics/category-sales');
  });

  it('does not mount /openapi.json when openApiDoc is absent', async () => {
    const router = createBindingsRouter({
      validated: validated(),
      graphSpec: spec,
      pdm,
      qsm,
      db,
    });
    const res = await router.fetch(new Request('http://x/openapi.json'));
    expect(res.status).toBe(404);
  });

  it('throws BindingsRuntimeError when compile fails at startup', () => {
    const brokenSpec = parseRuntimeGraphSpec({
      version: '1.0-rc7',
      pdmRef: 'x',
      qsmRef: 'y',
      shapes: {},
      graphs: {},
    });
    expect(() =>
      createBindingsRouter({
        validated: validated(),
        graphSpec: brokenSpec,
        pdm,
        qsm,
        db,
      }),
    ).toThrow(BindingsRuntimeError);
  });
});
