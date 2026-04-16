import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

const port = 3011;
const base = `http://127.0.0.1:${port}`;
const api = `${base}/api`;

let child: ChildProcess;

beforeAll(async () => {
  child = spawn('pnpm', ['exec', 'tsx', 'src/server.ts'], {
    cwd: `${here}/..`,
    env: { ...process.env, RNTME_HTTP_PORT: String(port) },
    stdio: 'pipe',
  });
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${base}/health`);
      if (r.ok) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('server did not start within 15 s');
}, 20_000);

afterAll(() => child?.kill('SIGTERM'));

describe('demo smoke via @rntme/runtime', () => {
  it('serves openapi, UI list, issue detail, stats, search without date bounds, and POST /v1/issues', async () => {
    const openapi = await fetch(`${api}/openapi.json`);
    expect(openapi.status).toBe(200);
    expect(((await openapi.json()) as { openapi: string }).openapi).toBe('3.1.0');

    const uiIssues = await fetch(`${api}/v1/ui/issues?limit=10`);
    expect(uiIssues.status).toBe(200);
    const uiRows = (await uiIssues.json()) as unknown[];
    expect(uiRows.length).toBeGreaterThan(0);

    const issue7001 = await fetch(`${api}/v1/issues/7001`);
    expect(issue7001.status).toBe(200);
    const detailRows = (await issue7001.json()) as Array<{ id: number }>;
    expect(detailRows[0]?.id).toBe(7001);

    const stats = await fetch(`${api}/v1/stats/by-project`);
    expect(stats.status).toBe(200);
    expect(Array.isArray(await stats.json())).toBe(true);

    const searchNoBounds = await fetch(
      `${api}/v1/issues/search?q=${encodeURIComponent('%lifecycle%')}&limit=10`,
    );
    expect(searchNoBounds.status).toBe(200);
    const searchRows = (await searchNoBounds.json()) as Array<{ id?: number }>;
    expect(searchRows.some((r) => r.id === 7001)).toBe(true);

    const created = await fetch(`${api}/v1/issues`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-actor-id': 'alice',
      },
      body: JSON.stringify({
        issueId: 91001,
        title: 'Smoke test issue',
        projectId: 1,
        reporterId: 1,
        priority: 'low',
        storyPoints: 1,
      }),
    });
    expect(created.status).toBe(200);
    expect(((await created.json()) as { version: number }).version).toBeGreaterThanOrEqual(1);
  });
});
