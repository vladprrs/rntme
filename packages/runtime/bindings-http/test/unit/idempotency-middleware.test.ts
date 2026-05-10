import { describe, it, expect } from 'bun:test';
import { openSqliteDatabase } from '@rntme/sqlite';
import { Hono } from 'hono';
import { IdempotencyCache } from '../../src/idempotency/cache.js';
import { idempotencyMiddleware } from '../../src/idempotency/middleware.js';

describe('idempotencyMiddleware', () => {
  it('replays a cached redirect with Location header', async () => {
    const db = openSqliteDatabase({ filename: ':memory:' });
    const cache = new IdempotencyCache(db);
    cache.set('operation.cb', 'k1', { status: 302, body: '', headers: { Location: '/next' } }, Date.now());

    const app = new Hono();
    app.use('/cb', idempotencyMiddleware({
      cache,
      now: Date.now,
      operationNameFromPath: () => 'operation.cb',
    }));
    app.post('/cb', (c) => c.json({ never: 'reached' }));

    const r = await app.fetch(
      new Request('http://x/cb', {
        method: 'POST',
        body: '',
        headers: { 'Idempotency-Key': 'k1' },
      }),
    );

    expect(r.status).toBe(302);
    expect(r.headers.get('Location')).toBe('/next');
    expect(r.headers.get('Idempotency-Replay')).toBe('true');
  });
});
