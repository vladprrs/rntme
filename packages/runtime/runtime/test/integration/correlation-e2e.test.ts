import { describe, it, expect, afterEach } from 'bun:test';
import { mkdtempSync, cpSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { openSqliteDatabase } from '@rntme/sqlite';
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

/**
 * Clone the runtime's issue-tracker fixture into a temp dir and switch it to
 * persistent mode so this test can open a second read-only connection to the
 * same sqlite file and inspect `event_log` rows. The fixture already ships
 * seed.json in CE envelope shape (Task 8); we disable seed here to keep the
 * event_log focused on events this test creates.
 */
function cloneFixturePersistent(overrides?: (m: Record<string, unknown>, dir: string) => void): {
  dir: string;
  eventStorePath: string;
} {
  const dir = mkdtempSync(join(tmpdir(), 'rntme-corr-e2e-'));
  cpSync(issueTrackerFixture, dir, { recursive: true });
  const manifestPath = join(dir, 'manifest.json');
  const m = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, unknown>;
  const eventStorePath = join(dir, 'events.sqlite');
  const qsmPath = join(dir, 'qsm.sqlite');
  m.persistence = { mode: 'persistent', eventStorePath, qsmPath };
  m.seed = { enabled: false };
  overrides?.(m, dir);
  writeFileSync(manifestPath, JSON.stringify(m));
  return { dir, eventStorePath };
}

describe('D9 correlation E2E (HTTP → response → event_log)', () => {
  it('propagates Correlation-Id from request header to response body/header and to every event_log row; commandId is server-minted and echoed in body; causationId equals commandId', async () => {
    const { dir, eventStorePath } = cloneFixturePersistent();
    const loaded = loadService(dir);
    if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
    running = await startService(loaded.value);

    const base = `http://127.0.0.1:${running.httpPort}`;
    const res = await fetch(`${base}/api/v1/issues`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Correlation-Id': 'corr-integration',
      },
      body: JSON.stringify({
        issueId: 424242,
        title: 'Correlation E2E probe',
        projectId: 1,
        reporterId: 42,
        priority: 'high',
        storyPoints: 3,
      }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('Correlation-Id')).toBe('corr-integration');

    const body = (await res.json()) as {
      aggregateId: string;
      version: number;
      eventIds: string[];
      commandId: string;
      correlationId: string;
    };
    expect(body.correlationId).toBe('corr-integration');
    expect(body.commandId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(body.aggregateId).toBe('424242');
    expect(body.eventIds.length).toBeGreaterThan(0);

    // Open a second read-only handle on the same sqlite file and assert CE
    // correlation columns on the persisted event_log rows.
    const db = openSqliteDatabase({ filename: eventStorePath, readonly: true });
    try {
      const rows = db
        .prepare(
          'SELECT event_id, correlation_id, command_id, causation_id FROM event_log WHERE subject = ? ORDER BY id ASC',
        )
        .all('Issue-424242') as Array<{
        event_id: string;
        correlation_id: string;
        command_id: string | null;
        causation_id: string | null;
      }>;
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) {
        expect(row.correlation_id).toBe('corr-integration');
        expect(row.command_id).toBe(body.commandId);
        expect(row.causation_id).toBe(body.commandId);
      }
      // And every appended event_id from the command result is present in event_log.
      const persistedIds = new Set(rows.map((r) => r.event_id));
      for (const id of body.eventIds) {
        expect(persistedIds.has(id)).toBe(true);
      }
    } finally {
      db.close();
    }
  });

  it('mints a fresh correlationId when none is supplied; body/header/event_log all carry the same value', async () => {
    const { dir, eventStorePath } = cloneFixturePersistent();
    const loaded = loadService(dir);
    if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
    running = await startService(loaded.value);

    const base = `http://127.0.0.1:${running.httpPort}`;
    const res = await fetch(`${base}/api/v1/issues`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        issueId: 424243,
        title: 'No incoming correlation',
        projectId: 1,
        reporterId: 42,
        priority: 'low',
        storyPoints: 1,
      }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { commandId: string; correlationId: string };
    const headerCorr = res.headers.get('Correlation-Id');
    if (headerCorr === null) throw new Error('missing Correlation-Id response header');
    expect(body.correlationId).toBe(headerCorr);
    // UUID v4 shape
    expect(body.correlationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    // And commandId is distinct from correlationId.
    expect(body.commandId).not.toBe(body.correlationId);

    const db = openSqliteDatabase({ filename: eventStorePath, readonly: true });
    try {
      const rows = db
        .prepare(
          'SELECT correlation_id, command_id, causation_id FROM event_log WHERE subject = ?',
        )
        .all('Issue-424243') as Array<{
        correlation_id: string;
        command_id: string | null;
        causation_id: string | null;
      }>;
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) {
        expect(row.correlation_id).toBe(body.correlationId);
        expect(row.command_id).toBe(body.commandId);
        expect(row.causation_id).toBe(body.commandId);
      }
    } finally {
      db.close();
    }
  });
});
