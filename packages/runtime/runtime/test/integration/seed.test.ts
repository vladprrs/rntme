import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, cpSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { loadService } from '../../src/load/load-service.js';
import { startService } from '../../src/start/start-service.js';
import type { RunningService } from '../../src/types.js';

const here = dirname(fileURLToPath(import.meta.url));
const issueTrackerFixture = join(here, '..', 'fixtures', 'issue-tracker');

let running: RunningService | null = null;

afterEach(async () => {
  if (running) await running.stop();
  running = null;
});

function cloneIssueTracker(overrides: (m: Record<string, unknown>, dir: string) => void): string {
  const dir = mkdtempSync(join(tmpdir(), 'rntme-seed-it-'));
  cpSync(issueTrackerFixture, dir, { recursive: true });
  const manifestPath = join(dir, 'manifest.json');
  const m = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, unknown>;
  overrides(m, dir);
  writeFileSync(manifestPath, JSON.stringify(m));
  return dir;
}

async function waitForIssues(base: string, minRows: number): Promise<Record<string, unknown>[]> {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const res = await fetch(`${base}/api/v1/issues?limit=10`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as unknown;
    if (Array.isArray(body) && body.length >= minRows) {
      return body as Record<string, unknown>[];
    }
    await delay(50);
  }
  throw new Error('timeout waiting for issues projection');
}

describe('startService — seed', () => {
  it('ephemeral: applies seed and exposes the row via HTTP', async () => {
    const dir = cloneIssueTracker((m, _dir) => {
      m.seed = { enabled: true };
    });
    const loaded = loadService(dir);
    if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
    running = await startService(loaded.value);
    const base = `http://127.0.0.1:${running.httpPort}`;
    const rows = await waitForIssues(base, 1);
    const row = rows.find((r) => r.title === 'Seeded issue');
    expect(row).toBeDefined();
    expect(row?.id).toBe(9001);
  });

  it('persistent: first boot applies seed; second boot skips SEED_STORE_NOT_EMPTY without throwing', async () => {
    const dir = cloneIssueTracker((m, d) => {
      m.seed = { enabled: true };
      m.persistence = {
        mode: 'persistent',
        eventStorePath: join(d, 'events.sqlite'),
        qsmPath: join(d, 'qsm.sqlite'),
      };
    });
    const loaded1 = loadService(dir);
    if (!loaded1.ok) throw new Error(JSON.stringify(loaded1.errors));
    running = await startService(loaded1.value);
    const base1 = `http://127.0.0.1:${running.httpPort}`;
    await waitForIssues(base1, 1);
    await running.stop();
    running = null;

    const loaded2 = loadService(dir);
    if (!loaded2.ok) throw new Error(JSON.stringify(loaded2.errors));
    running = await startService(loaded2.value);
    const base2 = `http://127.0.0.1:${running.httpPort}`;
    const rows = await waitForIssues(base2, 1);
    expect(rows.some((r) => r.title === 'Seeded issue')).toBe(true);
  });

  it('skipSeed: does not project seeded rows', async () => {
    const dir = cloneIssueTracker((m, _d) => {
      m.seed = { enabled: true };
    });
    const loaded = loadService(dir);
    if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
    running = await startService(loaded.value, { skipSeed: true });
    const res = await fetch(`http://127.0.0.1:${running.httpPort}/api/v1/issues?limit=10`);
    expect(res.status).toBe(200);
    const rows = (await res.json()) as { id?: number }[];
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.some((r) => r.id === 9001)).toBe(false);
  });

  it('health is 200 after startService resolves', async () => {
    const dir = cloneIssueTracker((m, _d) => {
      m.seed = { enabled: true };
    });
    const loaded = loadService(dir);
    if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
    running = await startService(loaded.value);
    const res = await fetch(`http://127.0.0.1:${running.httpPort}/health`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
  });
});
