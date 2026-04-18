import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const port = 3015;
const base = `http://127.0.0.1:${port}`;

let child: ChildProcess;

async function waitForReady(): Promise<void> {
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
  throw new Error(`server did not start on ${port} within 15 s`);
}

async function pipeline(target: string, sql: string): Promise<{ type: string; response?: { result: { rows: unknown[][] } }; error?: { code: string } }> {
  const res = await fetch(`${base}/_studio/hrana/${target}/v3/pipeline`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ baton: null, requests: [{ type: 'execute', stmt: { sql } }] }),
  });
  const body = (await res.json()) as { results: Array<{ type: string; response?: { result: { rows: unknown[][] } }; error?: { code: string } }> };
  return body.results[0]!;
}

beforeAll(async () => {
  child = spawn('pnpm', ['exec', 'tsx', 'src/server.ts'], {
    cwd: `${here}/..`,
    env: { ...process.env, RNTME_HTTP_PORT: String(port) },
    stdio: 'pipe',
  });
  await waitForReady();
}, 20_000);

afterAll(() => child?.kill('SIGTERM'));

describe('db-studio e2e in demo', () => {
  it('landing page reachable', async () => {
    const res = await fetch(`${base}/_studio`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('rntme DB Studio');
    expect(html).toContain('/_studio/hrana/events');
    expect(html).toContain('/_studio/hrana/qsm');
  });

  it('events target returns seeded events', async () => {
    const r = await pipeline('events', 'SELECT count(*) FROM event_log');
    expect(r.type).toBe('ok');
    const n = Number((r.response!.result.rows[0]![0] as { value: string }).value);
    expect(n).toBeGreaterThan(0);
  });

  it('qsm target returns 11 seeded issues', async () => {
    const r = await pipeline('qsm', 'SELECT count(*) FROM projection_issue');
    const n = Number((r.response!.result.rows[0]![0] as { value: string }).value);
    expect(n).toBe(11);
  });

  it('UPDATE is rejected and state is unchanged', async () => {
    const r = await pipeline('qsm', "UPDATE projection_issue SET title='hacked'");
    expect(r.error?.code).toBe('DB_STUDIO_READONLY_NOT_SELECT');

    const readback = await pipeline('qsm', "SELECT title FROM projection_issue WHERE id=7001");
    const title = (readback.response!.result.rows[0]![0] as { value: string }).value;
    expect(title).not.toBe('hacked');
  });

  it('ATTACH is rejected', async () => {
    const r = await pipeline('qsm', "ATTACH DATABASE ':memory:' AS evil");
    expect(r.error?.code).toBe('DB_STUDIO_READONLY_ATTACH_DENIED');
  });
});
