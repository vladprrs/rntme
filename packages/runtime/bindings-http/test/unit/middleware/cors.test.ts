import { describe, expect, it } from 'bun:test';
import { Hono } from 'hono';
import { cors, isAllowedOrigin } from '../../../src/middleware/cors.js';

describe('isAllowedOrigin', () => {
  it('allows exact origins', () => {
    expect(isAllowedOrigin('https://platform.rntme.com', ['https://platform.rntme.com'])).toBe(true);
  });

  it('allows wildcard subdomains', () => {
    expect(isAllowedOrigin('https://app.rntme.com', ['https://*.rntme.com'])).toBe(true);
  });

  it('rejects suffix confusion for wildcard subdomains', () => {
    expect(isAllowedOrigin('https://app.rntme.com.evil.test', ['https://*.rntme.com'])).toBe(false);
  });

  it('does not rely on RegExp for pathological wildcard input', () => {
    const originalRegExp = globalThis.RegExp;
    try {
      globalThis.RegExp = function ThrowingRegExp() {
        throw new Error('RegExp must not be used for CORS wildcard matching');
      } as unknown as RegExpConstructor;

      expect(
        isAllowedOrigin(`https://${'a.'.repeat(200)}rntme.com`, [
          `https://${'*.'.repeat(80)}rntme.com`,
        ]),
      ).toBe(true);
    } finally {
      globalThis.RegExp = originalRegExp;
    }
  });
});

describe('cors middleware', () => {
  it('reflects an allowed origin and sets credentials', async () => {
    const app = new Hono()
      .use('*', cors({ origins: ['https://allowed.example'] }))
      .get('/x', (c) => c.text('ok'));
    const res = await app.request('/x', {
      method: 'OPTIONS',
      headers: { origin: 'https://allowed.example', 'access-control-request-method': 'GET' },
    });
    expect(res.headers.get('access-control-allow-origin')).toBe('https://allowed.example');
    expect(res.headers.get('access-control-allow-credentials')).toBe('true');
  });

  it('does not reflect a foreign origin', async () => {
    const app = new Hono()
      .use('*', cors({ origins: ['https://allowed.example'] }))
      .get('/x', (c) => c.text('ok'));
    const res = await app.request('/x', {
      method: 'OPTIONS',
      headers: { origin: 'https://evil.example', 'access-control-request-method': 'GET' },
    });
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });
});
