import { describe, it, expect, mock } from 'bun:test';
import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { Hono } from 'hono';
import { rateLimit } from '@rntme/bindings-http';
import { PostgresRateLimiter } from '../../src/postgres-rate-limiter.js';

describe('PostgresRateLimiter', () => {
  it('uses the database count, hashes the limiter key, and returns a rich decision', async () => {
    const query = mock()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: 1 }] });
    const limiter = new PostgresRateLimiter({ db: { query } as never, windowMs: 60_000, max: 2 });

    const decision = await limiter.check('account-raw-id');
    expect(decision.allowed).toBe(true);
    expect(decision.limit).toBe(2);
    expect(decision.remaining).toBe(1);

    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[0]?.[0]).toContain('DELETE FROM platform_rate_limit');
    const values = query.mock.calls[1]?.[1] as unknown[];
    expect(Buffer.isBuffer(values[0])).toBe(true);
    expect((values[0] as Buffer).toString('hex')).toBe(
      createHash('sha256').update('account-raw-id').digest('hex'),
    );
    expect(values).not.toContain('account-raw-id');
  });

  it('rejects when the database count exceeds max', async () => {
    const query = mock()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: 3 }] });
    const limiter = new PostgresRateLimiter({ db: { query } as never, windowMs: 60_000, max: 2 });
    const decision = await limiter.check('token-raw-id');
    expect(decision.allowed).toBe(false);
    expect(decision.remaining).toBe(0);
    expect(decision.retryAfterSeconds).toBeGreaterThanOrEqual(1);
  });

  it('returns 429 with PLATFORM_RATE_LIMITED via the bindings-http rateLimit wrapper', async () => {
    const query = mock()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: 3 }] });
    const limiter = new PostgresRateLimiter({ db: { query } as never, windowMs: 60_000, max: 2 });
    const app = new Hono()
      .use('*', rateLimit(limiter, () => 'account-raw-id', { code: 'PLATFORM_RATE_LIMITED' }))
      .get('/limited', (c) => c.json({ ok: true }));

    const res = await app.request('/limited');
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).not.toBeNull();
    expect(res.headers.get('x-ratelimit-limit')).toBe('2');
    await expect(res.json()).resolves.toEqual({
      error: { code: 'PLATFORM_RATE_LIMITED', message: 'rate limit exceeded' },
    });
  });
});
