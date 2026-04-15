import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/server.js';
import type { Hono } from 'hono';

let app: Hono;
let stop: () => Promise<void>;

beforeAll(() => {
  const built = buildApp();
  app = built.app;
  stop = built.stop;
});

afterAll(async () => {
  await stop();
});

async function get(path: string): Promise<{ status: number; body: unknown }> {
  const res = await app.fetch(new Request(`http://x${path}`));
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

describe('issue-tracker-api demo — full REST surface', () => {
  it('GET /v1/issues returns seeded rows (default limit)', async () => {
    const { status, body } = await get('/v1/issues');
    expect(status).toBe(200);
    const rows = body as Array<Record<string, unknown>>;
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]).toHaveProperty('id');
    expect(rows[0]).toHaveProperty('title');
    expect(rows[0]).toHaveProperty('status');
  });

  it('GET /v1/ui/issues returns rows (listIssuesUi binding for SPA)', async () => {
    const { status, body } = await get('/v1/ui/issues?limit=2');
    expect(status).toBe(200);
    const rows = body as Array<Record<string, unknown>>;
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.length).toBe(2);
  });

  it('GET /v1/issues?status=open applies predicate_optional filter', async () => {
    const { status, body } = await get('/v1/issues?status=open&limit=100');
    expect(status).toBe(200);
    const rows = body as Array<{ status: string }>;
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.status === 'open')).toBe(true);
  });

  it('GET /v1/issues?limit=3 respects defaulted param override', async () => {
    const { status, body } = await get('/v1/issues?limit=3');
    expect(status).toBe(200);
    expect((body as unknown[]).length).toBe(3);
  });

  it('GET /v1/issues/:id returns a single enriched row', async () => {
    const { status, body } = await get('/v1/issues/105');
    expect(status).toBe(200);
    const rows = body as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(1);
    const row = rows[0]!;
    expect(row['id']).toBe(105);
    expect(row['projectKey']).toBe('CORE');
    expect(row['reporterUsername']).toBe('carol');
    expect(row['assigneeUsername']).toBe('bob');
  });

  it('GET /v1/issues/:id returns empty array on unknown id', async () => {
    const { status, body } = await get('/v1/issues/99999');
    expect(status).toBe(200);
    expect(body).toEqual([]);
  });

  it('GET /v1/stats/by-project aggregates per project', async () => {
    const { status, body } = await get('/v1/stats/by-project');
    expect(status).toBe(200);
    const rows = body as Array<{
      projectKey: string;
      issueCount: number;
      totalStoryPoints: number;
      avgStoryPoints: string | number;
    }>;
    const keys = rows.map((r) => r.projectKey).sort();
    expect(keys).toEqual(['CORE', 'MOB']);
    const core = rows.find((r) => r.projectKey === 'CORE')!;
    expect(core.issueCount).toBe(13);
    expect(core.totalStoryPoints).toBeGreaterThan(0);
  });

  it('GET /v1/issues/search matches by LIKE + date range', async () => {
    const { status, body } = await get(
      '/v1/issues/search?q=%25crash%25&from=2026-01-01T00:00:00Z&to=2026-12-31T23:59:59Z',
    );
    expect(status).toBe(200);
    const rows = body as Array<{ title: string }>;
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => /crash/i.test(r.title))).toBe(true);
  });

  it('GET /v1/issues/search?priority=high narrows via predicate_optional', async () => {
    const { status, body } = await get(
      '/v1/issues/search?q=%25%25&from=2026-01-01T00:00:00Z&to=2026-12-31T23:59:59Z&priority=high&limit=100',
    );
    expect(status).toBe(200);
    const rows = body as Array<{ priority: string }>;
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.priority === 'high')).toBe(true);
  });

  it('GET /v1/sprints/:sprintId/burndown groups non-closed issues by status', async () => {
    const { status, body } = await get('/v1/sprints/11/burndown');
    expect(status).toBe(200);
    const rows = body as Array<{ status: string; issueCount: number; totalStoryPoints: number }>;
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.status !== 'closed')).toBe(true);
  });

  it('GET /openapi.json is served', async () => {
    const { status, body } = await get('/openapi.json');
    expect(status).toBe(200);
    const doc = body as { openapi: string; paths: Record<string, unknown> };
    expect(doc.openapi).toBe('3.1.0');
    const paths = Object.keys(doc.paths).sort();
    expect(paths).toContain('/v1/issues');
    expect(paths).toContain('/v1/issues/{id}');
    expect(paths).toContain('/v1/stats/by-project');
    expect(paths).toContain('/v1/issues/search');
    expect(paths).toContain('/v1/sprints/{sprintId}/burndown');
  });

  it('GET /v1/issues/:id with non-numeric id yields 400 VALIDATION_ERROR', async () => {
    const { status, body } = await get('/v1/issues/not-a-number');
    expect(status).toBe(400);
    expect((body as { code: string }).code).toBe('VALIDATION_ERROR');
  });

  it('GET /v1/issues/search without required params yields 400 VALIDATION_ERROR', async () => {
    const { status, body } = await get('/v1/issues/search?q=x');
    expect(status).toBe(400);
    expect((body as { code: string }).code).toBe('VALIDATION_ERROR');
  });
});
