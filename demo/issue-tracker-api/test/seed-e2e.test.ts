import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

const port = 3012;
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

describe('seed-e2e — seeded aggregate mutations + burndown', () => {
  it('assigns a seeded open issue (7004: open → in_progress)', async () => {
    const res = await fetch(`${api}/v1/issues/7004/actions/assign`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-actor-id': 'alice' },
      body: JSON.stringify({ assigneeId: 1 }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { version: number };
    expect(body.version).toBe(3);
  });

  it('submits a seeded draft issue (7005: draft → open)', async () => {
    const res = await fetch(`${api}/v1/issues/7005/actions/submit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-actor-id': 'alice' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { version: number };
    expect(body.version).toBe(2);
  });

  it('rejects illegal transition on seeded closed issue (7001)', async () => {
    const res = await fetch(`${api}/v1/issues/7001/actions/submit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-actor-id': 'alice' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(422);
    const body = (await res.json()) as { message: string };
    expect(body.message).toContain('closed');
  });

  it('returns burndown data for sprint 1 with >= 2 status buckets', async () => {
    const res = await fetch(`${api}/v1/sprints/1/burndown`);
    expect(res.status).toBe(200);
    const rows = (await res.json()) as Array<{ status: string; issueCount: number; totalStoryPoints: number }>;
    expect(rows.length).toBeGreaterThanOrEqual(2);
    for (const row of rows) {
      expect(row.issueCount).toBeGreaterThan(0);
    }
  });

  it('returns empty burndown for non-existent sprint', async () => {
    const res = await fetch(`${api}/v1/sprints/999/burndown`);
    expect(res.status).toBe(200);
    const rows = (await res.json()) as unknown[];
    expect(rows).toEqual([]);
  });
});
