import { describe, it, expect } from 'bun:test';
import { Hono } from 'hono';
import { bodyLimit } from '../../../src/middleware/body-limit.js';

describe('bodyLimit', () => {
  it('returns 413 with default code when an oversize body is sent without Content-Length', async () => {
    const app = new Hono();
    app.post('/small', bodyLimit(8), (c) => c.text('ok'));
    const res = await app.request('/small', { method: 'POST', body: 'x'.repeat(100) });
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({
      error: { code: 'BODY_LIMIT_EXCEEDED', message: 'body exceeds 8 bytes' },
    });
  });

  it('passes through small bodies', async () => {
    const app = new Hono();
    app.post('/small', bodyLimit(1024), (c) => c.text('ok'));
    const res = await app.request('/small', { method: 'POST', body: 'ok' });
    expect(res.status).toBe(200);
  });

  it('rejects oversize declared via Content-Length header', async () => {
    const app = new Hono();
    app.post('/small', bodyLimit(8), (c) => c.text('ok'));
    const res = await app.request('/small', {
      method: 'POST',
      headers: { 'content-length': '100' },
      body: 'x'.repeat(100),
    });
    expect(res.status).toBe(413);
  });

  it('drains and rejects when Content-Length is non-finite', async () => {
    const app = new Hono();
    app.post('/small', bodyLimit(8), (c) => c.text('ok'));
    const res = await app.request('/small', {
      method: 'POST',
      headers: { 'content-length': 'Infinity' },
      body: 'x'.repeat(100),
    });
    expect(res.status).toBe(413);
  });

  it('honors a caller-supplied error code', async () => {
    const app = new Hono();
    app.post('/small', bodyLimit(8, { code: 'PLATFORM_PARSE_BODY_INVALID' }), (c) => c.text('ok'));
    const res = await app.request('/small', { method: 'POST', body: 'x'.repeat(100) });
    expect(await res.json()).toEqual({
      error: { code: 'PLATFORM_PARSE_BODY_INVALID', message: 'body exceeds 8 bytes' },
    });
  });
});
