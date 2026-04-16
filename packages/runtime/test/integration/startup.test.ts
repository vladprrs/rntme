import { describe, it, expect, afterEach } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadService } from '../../src/load/load-service.js';
import { startService } from '../../src/start/start-service.js';
import type { RunningService } from '../../src/types.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(here, '..', 'fixtures', 'issue-tracker');

let running: RunningService | null = null;

afterEach(async () => {
  if (running) await running.stop();
  running = null;
});

describe('startService', () => {
  it('boots the service and serves /health', async () => {
    const loaded = loadService(fixtureDir);
    if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
    running = await startService(loaded.value, {
      onReady: () => undefined,
    });
    const res = await fetch(`http://127.0.0.1:${running.httpPort}/health`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
  });

  it('exposes OpenAPI + service identity', async () => {
    const loaded = loadService(fixtureDir);
    if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
    running = await startService(loaded.value);
    const root = await (await fetch(`http://127.0.0.1:${running.httpPort}/`)).json();
    expect((root as { name: string }).name).toBe('issue-tracker-api');
    const openapi = await (await fetch(`http://127.0.0.1:${running.httpPort}/api/openapi.json`)).json();
    expect((openapi as { openapi: string }).openapi).toBe('3.1.0');
  });
});
