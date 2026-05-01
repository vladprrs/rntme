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
  eventsDb.exec(`CREATE TABLE t (x INTEGER)`);
  qsmDb.exec(`CREATE TABLE t (x INTEGER)`);
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

describe('CORS', () => {
  it('responds with wildcard on preflight', async () => {
    const res = await app.fetch(
      new Request('http://localhost/_studio/hrana/qsm/v3/pipeline', {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://libsqlstudio.com',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type',
        },
      }),
    );
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    expect(res.headers.get('access-control-allow-methods')).toContain('POST');
    expect(res.headers.get('access-control-allow-headers')?.toLowerCase()).toContain('content-type');
  });

  it('carries CORS header on actual POST', async () => {
    const res = await app.fetch(
      new Request('http://localhost/_studio/hrana/qsm/v3/pipeline', {
        method: 'POST',
        headers: { 'content-type': 'application/json', Origin: 'https://libsqlstudio.com' },
        body: JSON.stringify({ baton: null, requests: [] }),
      }),
    );
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });
});
