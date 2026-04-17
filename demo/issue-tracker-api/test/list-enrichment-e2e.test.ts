import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

const port = 3013;
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

describe('list/search enrichment', () => {
  it('listIssues returns enriched fields', async () => {
    const r = await fetch(`${api}/v1/issues?limit=5`);
    expect(r.status).toBe(200);
    const body = (await r.json()) as unknown[];
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
    for (const it of body as Record<string, unknown>[]) {
      expect(it).toHaveProperty('id');
      expect(it).toHaveProperty('title');
      expect(it).toHaveProperty('projectKey');
      expect(it).toHaveProperty('projectName');
      expect(it).toHaveProperty('reporterUsername');
      expect(it).toHaveProperty('assigneeUsername');
      expect(it).toHaveProperty('sprintName');
      if (it.projectKey !== null) expect(typeof it.projectKey).toBe('string');
    }
  });

  it('searchIssues returns enriched fields with priority missing', async () => {
    const r = await fetch(`${api}/v1/issues/search?q=${encodeURIComponent('%a%')}&limit=5`);
    expect(r.status).toBe(200);
    const body = (await r.json()) as Record<string, unknown>[];
    for (const it of body) {
      expect(it).toHaveProperty('projectKey');
      expect(it).toHaveProperty('reporterUsername');
    }
  });

  it('searchIssues returns enriched fields with priority provided', async () => {
    const r = await fetch(`${api}/v1/issues/search?q=${encodeURIComponent('%a%')}&priority=high&limit=5`);
    expect(r.status).toBe(200);
    const body = (await r.json()) as Record<string, unknown>[];
    for (const it of body) {
      expect(it).toHaveProperty('projectKey');
    }
  });
});
