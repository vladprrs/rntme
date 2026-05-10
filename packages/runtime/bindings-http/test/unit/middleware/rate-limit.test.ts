import { describe, it, expect } from 'bun:test';
import { Hono } from 'hono';
import { InMemoryRateLimiter, rateLimit } from '../../../src/middleware/rate-limit.js';

describe('InMemoryRateLimiter', () => {
  it('returns a rich decision describing the bucket state', () => {
    const l = new InMemoryRateLimiter({ windowMs: 1000, max: 2 });
    const a = l.check('k');
    expect(a.allowed).toBe(true);
    expect(a.limit).toBe(2);
    expect(a.remaining).toBe(1);
    expect(a.resetAtSeconds).toBeGreaterThan(0);
    const b = l.check('k');
    expect(b.allowed).toBe(true);
    expect(b.remaining).toBe(0);
    const c = l.check('k');
    expect(c.allowed).toBe(false);
    expect(c.remaining).toBe(0);
    expect(c.retryAfterSeconds).toBeGreaterThanOrEqual(1);
  });

  it('forgets after window', async () => {
    const l = new InMemoryRateLimiter({ windowMs: 30, max: 1 });
    expect(l.check('k').allowed).toBe(true);
    expect(l.check('k').allowed).toBe(false);
    await new Promise((r) => setTimeout(r, 40));
    expect(l.check('k').allowed).toBe(true);
  });
});

describe('rateLimit middleware', () => {
  it('returns 429 with default code when a boolean limiter rejects', async () => {
    const fake = { check: () => false };
    const app = new Hono()
      .use('*', rateLimit(fake, () => 'k'))
      .get('/x', (c) => c.json({ ok: true }));
    const res = await app.request('/x');
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({
      error: { code: 'RATE_LIMITED', message: 'rate limit exceeded' },
    });
  });

  it('passes through when limiter accepts', async () => {
    const fake = { check: () => true };
    const app = new Hono()
      .use('*', rateLimit(fake, () => 'k'))
      .get('/x', (c) => c.json({ ok: true }));
    const res = await app.request('/x');
    expect(res.status).toBe(200);
  });

  it('emits X-RateLimit-* and Retry-After headers when the limiter returns a rich decision', async () => {
    const limiter = new InMemoryRateLimiter({ windowMs: 60_000, max: 1 });
    const app = new Hono()
      .use('*', rateLimit(limiter, () => 'k'))
      .get('/x', (c) => c.json({ ok: true }));
    const first = await app.request('/x');
    const second = await app.request('/x');
    expect(first.status).toBe(200);
    expect(first.headers.get('x-ratelimit-limit')).toBe('1');
    expect(first.headers.get('x-ratelimit-remaining')).toBe('0');
    expect(first.headers.get('x-ratelimit-reset')).not.toBeNull();
    expect(second.status).toBe(429);
    expect(second.headers.get('retry-after')).not.toBeNull();
  });

  it('honors a caller-supplied error code', async () => {
    const fake = { check: () => false };
    const app = new Hono()
      .use('*', rateLimit(fake, () => 'k', { code: 'PLATFORM_RATE_LIMITED' }))
      .get('/x', (c) => c.json({ ok: true }));
    const res = await app.request('/x');
    expect(await res.json()).toEqual({
      error: { code: 'PLATFORM_RATE_LIMITED', message: 'rate limit exceeded' },
    });
  });
});
