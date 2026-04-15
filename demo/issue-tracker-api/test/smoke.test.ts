import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

let child: ChildProcess;
let port: number;

beforeAll(async () => {
  port = 13457;
  child = spawn('pnpm', ['exec', 'tsx', 'src/server.ts'], {
    cwd: `${here}/..`,
    env: { ...process.env, RNTME_HTTP_PORT: String(port) },
    stdio: 'pipe',
  });
  // Wait for /health to respond
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/health`);
      if (r.ok) return;
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('server did not start within 15 s');
}, 20_000);

afterAll(() => child?.kill('SIGTERM'));

describe('demo smoke via @rntme/runtime', () => {
  it('serves /health and /openapi.json', async () => {
    const health = await fetch(`http://127.0.0.1:${port}/health`);
    expect(health.status).toBe(200);
    const openapi = await fetch(`http://127.0.0.1:${port}/openapi.json`);
    expect(openapi.status).toBe(200);
    expect(((await openapi.json()) as { openapi: string }).openapi).toBe('3.1.0');
  });
});
