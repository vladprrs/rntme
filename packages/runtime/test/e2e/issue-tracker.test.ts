import { describe, it, expect, afterEach } from 'vitest';
import { setTimeout } from 'node:timers/promises';
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

describe('issue-tracker e2e via @rntme/runtime', () => {
  it('creates and reads an issue end-to-end', async () => {
    const loaded = loadService(fixtureDir);
    if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
    running = await startService(loaded.value);
    const base = `http://127.0.0.1:${running.httpPort}`;

    const create = await fetch(`${base}/api/v1/issues`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-actor-id': 'alice',
      },
      body: JSON.stringify({
        issueId: 9001,
        title: 'e2e via runtime',
        projectId: 1,
        reporterId: 1,
        priority: 'high',
        storyPoints: 1,
      }),
    });
    expect(create.status).toBe(200);

    await setTimeout(100);

    const list = await fetch(`${base}/api/v1/issues?limit=100`);
    expect(list.status).toBe(200);
    const rows = (await list.json()) as { title: string }[];
    expect(rows.some((row) => row.title === 'e2e via runtime')).toBe(true);
  });
});
