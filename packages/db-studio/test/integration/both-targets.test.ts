import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import { Hono } from 'hono';
import { mountStudio } from '../../src/index.js';

let app: Hono;
let eventsDb: Database.Database;
let qsmDb: Database.Database;

beforeAll(() => {
  eventsDb = new Database(':memory:');
  qsmDb = new Database(':memory:');
  eventsDb.exec(`CREATE TABLE events_only (id INTEGER); INSERT INTO events_only VALUES (1)`);
  qsmDb.exec(`CREATE TABLE qsm_only (id INTEGER); INSERT INTO qsm_only VALUES (99)`);
  app = new Hono();
  mountStudio(app, {
    eventStoreDb: eventsDb,
    qsmDb,
    config: { enabled: true, mountPath: '/_studio', maxRows: 100 },
  });
});

afterAll(() => {
  eventsDb.close();
  qsmDb.close();
});

describe('target isolation', () => {
  it('events target sees events_only, not qsm_only', async () => {
    const ok = await postPipeline('/_studio/hrana/events/v3/pipeline', 'SELECT id FROM events_only');
    expect(ok.ok?.rows[0][0]).toEqual({ type: 'integer', value: '1' });

    const fail = await postPipeline('/_studio/hrana/events/v3/pipeline', 'SELECT id FROM qsm_only');
    expect(fail.error?.code).toBe('DB_STUDIO_SQLITE_ERROR');
  });

  it('qsm target sees qsm_only, not events_only', async () => {
    const ok = await postPipeline('/_studio/hrana/qsm/v3/pipeline', 'SELECT id FROM qsm_only');
    expect(ok.ok?.rows[0][0]).toEqual({ type: 'integer', value: '99' });

    const fail = await postPipeline('/_studio/hrana/qsm/v3/pipeline', 'SELECT id FROM events_only');
    expect(fail.error?.code).toBe('DB_STUDIO_SQLITE_ERROR');
  });
});

async function postPipeline(path: string, sql: string) {
  const res = await app.fetch(new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ baton: null, requests: [{ type: 'execute', stmt: { sql } }] }),
  }));
  const body = (await res.json()) as { results: Array<{ type: string; response?: { result: { rows: unknown[][] } }; error?: { code: string } }> };
  const r = body.results[0];
  return {
    ok: r.type === 'ok' ? r.response!.result : undefined,
    error: r.type === 'error' ? r.error : undefined,
  };
}
