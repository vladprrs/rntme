import { describe, it, expect } from 'bun:test';
import { Hono } from 'hono';
import { securityHeaders } from '../../../src/middleware/security-headers.js';

describe('securityHeaders', () => {
  it('sets nosniff and Referrer-Policy by default and no CSP', async () => {
    const app = new Hono().use('*', securityHeaders()).get('/x', (c) => c.text('ok'));
    const res = await app.request('/x');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
    expect(res.headers.get('content-security-policy')).toBeNull();
  });

  it('emits a CSP header when csp is provided', async () => {
    const app = new Hono()
      .use('*', securityHeaders({ csp: "default-src 'self'" }))
      .get('/x', (c) => c.text('ok'));
    const res = await app.request('/x');
    expect(res.headers.get('content-security-policy')).toBe("default-src 'self'");
  });

  it('skips a header when its option is set to null', async () => {
    const app = new Hono()
      .use('*', securityHeaders({ contentTypeOptions: null, referrerPolicy: null }))
      .get('/x', (c) => c.text('ok'));
    const res = await app.request('/x');
    expect(res.headers.get('x-content-type-options')).toBeNull();
    expect(res.headers.get('referrer-policy')).toBeNull();
  });
});
