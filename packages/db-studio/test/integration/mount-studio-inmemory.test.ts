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
  eventsDb.exec(`CREATE TABLE events (id INTEGER PRIMARY KEY);
                 INSERT INTO events VALUES (1), (2);`);
  qsmDb.exec(`CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT);
              INSERT INTO t VALUES (1, 'a');`);
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

describe('mountStudio — :memory: reuse', () => {
  it('SELECT on events in-memory DB works', async () => {
    const res = await app.fetch(
      new Request('http://localhost/_studio/hrana/events/v3/pipeline', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          baton: null,
          requests: [{ type: 'execute', stmt: { sql: 'SELECT count(*) FROM events' } }],
        }),
      }),
    );
    const body = (await res.json()) as { results: Array<{ response?: { result?: { rows?: unknown[][] } } }> };
    expect(body.results[0]?.response?.result?.rows?.[0]?.[0]).toEqual({ type: 'integer', value: '2' });
  });

  it('whitelist still blocks writes on reused writable handle', async () => {
    const res = await app.fetch(
      new Request('http://localhost/_studio/hrana/qsm/v3/pipeline', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          baton: null,
          requests: [{ type: 'execute', stmt: { sql: "INSERT INTO t VALUES (2, 'b')" } }],
        }),
      }),
    );
    const body = (await res.json()) as { results: Array<{ error?: { code: string } }> };
    expect(body.results[0]?.error?.code).toBe('DB_STUDIO_READONLY_NOT_SELECT');

    // Verify row not inserted.
    const count = qsmDb.prepare('SELECT count(*) AS c FROM t').get() as { c: number };
    expect(count.c).toBe(1);
  });
});
