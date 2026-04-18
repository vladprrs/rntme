import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import Database from 'better-sqlite3';
import { Hono } from 'hono';
import { mountStudio } from '../../src/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, '..', 'fixtures');

let app: Hono;
let eventsDb: Database.Database;
let qsmDb: Database.Database;
let eventsPath: string;
let qsmPath: string;

beforeAll(() => {
  eventsPath = join(tmpdir(), `db-studio-events-${Date.now()}.sqlite`);
  qsmPath = join(tmpdir(), `db-studio-qsm-${Date.now()}.sqlite`);
  eventsDb = new Database(eventsPath);
  qsmDb = new Database(qsmPath);
  eventsDb.exec(readFileSync(join(fixtures, 'events-fixture.sql'), 'utf-8'));
  qsmDb.exec(readFileSync(join(fixtures, 'qsm-fixture.sql'), 'utf-8'));
  app = new Hono();
  mountStudio(app, {
    eventStoreDb: eventsDb,
    qsmDb,
    config: { enabled: true, mountPath: '/_studio', maxRows: 1000 },
  });
});

afterAll(() => {
  eventsDb.close();
  qsmDb.close();
});

describe('mountStudio — basic pipeline', () => {
  it('GET landing page', async () => {
    const res = await app.fetch(new Request('http://localhost/_studio'));
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('rntme DB Studio');
    expect(html).toContain('/_studio/hrana/events');
    expect(html).toContain('/_studio/hrana/qsm');
  });

  it('executes SELECT on events target', async () => {
    const res = await app.fetch(
      new Request('http://localhost/_studio/hrana/events/v3/pipeline', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          baton: null,
          requests: [
            { type: 'execute', stmt: { sql: 'SELECT count(*) AS c FROM events' } },
            { type: 'close' },
          ],
        }),
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      results: Array<{ type?: string; response?: { result?: { rows?: unknown[][] } } }>;
    };
    expect(body.results).toHaveLength(1);
    const r = body.results[0];
    expect(r?.type).toBe('ok');
    const rows = r?.response?.result?.rows;
    expect(rows).toBeDefined();
    if (rows && rows[0]) {
      expect(rows[0][0]).toEqual({ type: 'integer', value: '2' });
    }
  });

  it('rejects UPDATE via inline Hrana error', async () => {
    const res = await app.fetch(
      new Request('http://localhost/_studio/hrana/qsm/v3/pipeline', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          baton: null,
          requests: [{ type: 'execute', stmt: { sql: "UPDATE projection_issue SET title='x'" } }],
        }),
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { results: Array<{ type?: string; error?: { code?: string } }> };
    expect(body.results[0]?.type).toBe('error');
    expect(body.results[0]?.error?.code).toBe('DB_STUDIO_READONLY_NOT_SELECT');
  });

  it('rejects ATTACH with specific code', async () => {
    const res = await app.fetch(
      new Request('http://localhost/_studio/hrana/qsm/v3/pipeline', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          baton: null,
          requests: [{ type: 'execute', stmt: { sql: "ATTACH DATABASE ':memory:' AS x" } }],
        }),
      }),
    );
    const body = (await res.json()) as { results: Array<{ error?: { code?: string } }> };
    expect(body.results[0]?.error?.code).toBe('DB_STUDIO_READONLY_ATTACH_DENIED');
  });

  it('handles PRAGMA table_info for schema introspection', async () => {
    const res = await app.fetch(
      new Request('http://localhost/_studio/hrana/qsm/v3/pipeline', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          baton: null,
          requests: [{ type: 'execute', stmt: { sql: 'PRAGMA table_info(projection_issue)' } }],
        }),
      }),
    );
    const body = (await res.json()) as { results: Array<{ response?: { result?: { rows?: unknown[][] } } }> };
    const rows = body.results[0]?.response?.result?.rows ?? [];
    expect(rows.length).toBeGreaterThan(0);
  });

  it('returns inline error for unknown target', async () => {
    const res = await app.fetch(
      new Request('http://localhost/_studio/hrana/unknown/v3/pipeline', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ baton: null, requests: [] }),
      }),
    );
    const body = (await res.json()) as { results: Array<{ error?: { code?: string } }> };
    expect(body.results[0]?.error?.code).toBe('DB_STUDIO_TARGET_UNKNOWN');
  });
});
