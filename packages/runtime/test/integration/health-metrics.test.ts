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

describe('observability endpoints', () => {
  it('serves /metrics in Prometheus text format', async () => {
    const loaded = loadService(fixtureDir);
    if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
    running = await startService(loaded.value);
    const res = await fetch(`http://127.0.0.1:${running.httpPort}/metrics`);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('rntme_commands_total');
    expect(body).toContain('rntme_events_appended_total');
  });
});
