import { describe, it, expect } from 'bun:test';
import { Hono } from 'hono';
import { sameOriginOnly } from '../../../src/middleware/same-origin.js';

describe('sameOriginOnly', () => {
  const make = (base: string, opts?: Parameters<typeof sameOriginOnly>[1]): Hono => {
    const app = new Hono();
    app.use('*', sameOriginOnly(base, opts));
    app.post('/x', (c) => c.text('ok'));
    app.get('/x', (c) => c.text('ok'));
    return app;
  };

  it('allows a request whose Origin matches the base URL', async () => {
    const app = make('https://platform.rntme.com');
    const res = await app.request('/x', {
      method: 'POST',
      headers: { Origin: 'https://platform.rntme.com' },
    });
    expect(res.status).toBe(200);
  });

  it('allows a request whose Referer starts with the base URL', async () => {
    const app = make('https://platform.rntme.com');
    const res = await app.request('/x', {
      method: 'POST',
      headers: { Referer: 'https://platform.rntme.com/tokens' },
    });
    expect(res.status).toBe(200);
  });

  it('rejects a Referer that is the base URL with no trailing path', async () => {
    const app = make('https://platform.rntme.com');
    const res = await app.request('/x', {
      method: 'POST',
      headers: { Referer: 'https://platform.rntme.com' },
    });
    expect(res.status).toBe(403);
  });

  it('rejects a foreign Origin with the default code', async () => {
    const app = make('https://platform.rntme.com');
    const res = await app.request('/x', {
      method: 'POST',
      headers: { Origin: 'https://evil.example' },
    });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      error: { code: 'CROSS_ORIGIN_BLOCKED', message: 'cross-origin request blocked' },
    });
  });

  it('honors a caller-supplied error code', async () => {
    const app = make('https://platform.rntme.com', { code: 'PLATFORM_AUTH_CSRF' });
    const res = await app.request('/x', {
      method: 'POST',
      headers: { Origin: 'https://evil.example' },
    });
    expect(await res.json()).toEqual({
      error: { code: 'PLATFORM_AUTH_CSRF', message: 'cross-origin request blocked' },
    });
  });

  it('skips GET requests', async () => {
    const app = make('https://platform.rntme.com');
    const res = await app.request('/x');
    expect(res.status).toBe(200);
  });
});
