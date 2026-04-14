import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { Hono } from 'hono';
import { validateBindings, parseBindingArtifact } from '@rntme/bindings';
import type { BindingResolvers } from '@rntme/bindings';
import { buildPlan } from '../../src/startup/compile-plan.js';
import { makeHandler } from '../../src/runtime/handler.js';
import { honoPath } from '../../src/startup/hono-path.js';

const here = dirname(fileURLToPath(import.meta.url));
const compilerRoot = join(here, '..', '..', '..', 'graph-ir-compiler');
const loadJson = <T>(p: string): T => JSON.parse(readFileSync(p, 'utf8')) as T;
const spec = loadJson(join(compilerRoot, 'test', 'golden', 'category-sales', 'graph.json'));
const pdm = loadJson(join(compilerRoot, 'test', 'e2e', 'fixtures', 'commerce.pdm.json'));
const qsm = loadJson(join(compilerRoot, 'test', 'e2e', 'fixtures', 'commerce.qsm.json'));
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
let app: Hono;

beforeAll(() => {
  const parsed = parseBindingArtifact(artifact);
  if (!parsed.ok) throw new Error('parse fail');
  const validated = validateBindings(parsed.value, resolvers);
  if (!validated.ok) throw new Error('validate fail');
  const plan = buildPlan(validated.value, spec, pdm, qsm);
  db = new Database(':memory:');
  db.exec(seedSql);
  app = new Hono();
  const bp = plan.getCategorySalesHttp!;
  app.get(honoPath(bp.entry.http.path), makeHandler(bp, { db }));
});

afterAll(() => {
  db.close();
});

describe('makeHandler — happy path', () => {
  it('returns 200 and a JSON array for valid query', async () => {
    const res = await app.fetch(
      new Request(
        'http://x/v1/analytics/category-sales?dateFrom=2026-01-01T00:00:00Z&dateTo=2026-12-31T23:59:59Z',
      ),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as Array<Record<string, unknown>>;
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
    expect(body[0]).toHaveProperty('categoryId');
    expect(body[0]).toHaveProperty('revenue');
  });
});

describe('makeHandler — 400 on validation errors', () => {
  it('400 when required param missing', async () => {
    const res = await app.fetch(new Request('http://x/v1/analytics/category-sales'));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { code: string; details: Array<{ path: string }> };
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.details.some((d) => d.path === 'dateFrom')).toBe(true);
  });

  it('400 when datetime is malformed', async () => {
    const res = await app.fetch(
      new Request(
        'http://x/v1/analytics/category-sales?dateFrom=not-a-date&dateTo=2026-12-31T23:59:59Z',
      ),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  it('400 when unknown query parameter present', async () => {
    const res = await app.fetch(
      new Request(
        'http://x/v1/analytics/category-sales?dateFrom=2026-01-01T00:00:00Z&dateTo=2026-12-31T23:59:59Z&evil=true',
      ),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('VALIDATION_ERROR');
  });
});

describe('makeHandler — 500 on execute failure', () => {
  it('returns 500 and calls onError when db is closed', async () => {
    const brokenDb = new Database(':memory:');
    brokenDb.close();
    const parsed = parseBindingArtifact(artifact);
    if (!parsed.ok) throw new Error('parse fail');
    const validated = validateBindings(parsed.value, resolvers);
    if (!validated.ok) throw new Error('validate fail');
    const plan = buildPlan(validated.value, spec, pdm, qsm);
    const errors: unknown[] = [];
    const localApp = new Hono();
    const bp = plan.getCategorySalesHttp!;
    localApp.get(
      honoPath(bp.entry.http.path),
      makeHandler(bp, {
        db: brokenDb,
        onError: (e) => {
          errors.push(e);
        },
      }),
    );
    const res = await localApp.fetch(
      new Request(
        'http://x/v1/analytics/category-sales?dateFrom=2026-01-01T00:00:00Z&dateTo=2026-12-31T23:59:59Z',
      ),
    );
    expect(res.status).toBe(500);
    expect(errors).toHaveLength(1);
    const body = (await res.json()) as { code: string; message: string };
    expect(body).toEqual({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  });
});
