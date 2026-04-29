import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/server/index.js';
import { testManifest } from '../fixtures/compiled-manifest.js';
import { testLayout, testScreen } from '../fixtures/compiled-screen.js';

function makeApp() {
  return createApp({
    artifact: {
      manifest: testManifest,
      layouts: { main: testLayout },
      screens: { home: testScreen, about: testScreen },
    },
    assetsDir: '/tmp/nonexistent-assets',
  });
}

describe('createApp', () => {
  it('serves HTML shell at /', async () => {
    const app = makeApp();
    const res = await app.request('/');
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('<div id="root">');
    expect(html).toContain('main.js');
  });

  it('can serve an auth shell that loads /config.json before app.js', async () => {
    const app = createApp({
      artifact: {
        manifest: testManifest,
        layouts: { main: testLayout },
        screens: { home: testScreen, about: testScreen },
      },
      assetsDir: '/tmp/nonexistent-assets',
      authShell: true,
    });

    const res = await app.request('/');

    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('/config.json');
    expect(html).toContain('/assets/app.js');
    expect(html).not.toContain('/assets/main.js');
  });

  it('serves shell responses with CSP and security headers', async () => {
    const app = makeApp();

    for (const path of ['/', '/issues/123']) {
      const res = await app.request(path);

      expect(res.status).toBe(200);
      expect(res.headers.get('content-security-policy')).toBe(
        "default-src 'none'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; font-src 'self'",
      );
      expect(res.headers.get('x-content-type-options')).toBe('nosniff');
      expect(res.headers.get('referrer-policy')).toBe('no-referrer');
      expect(res.headers.get('x-frame-options')).toBe('DENY');
      expect(res.headers.get('permissions-policy')).toBe(
        'camera=(), microphone=(), geolocation=()',
      );
    }
  });

  it('serves manifest at /_manifest.json', async () => {
    const app = makeApp();
    const res = await app.request('/_manifest.json');
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.version).toBe('2.0');
    expect(json.routes['/']).toEqual({ layout: 'main', screen: 'home' });
  });

  it('serves layout at /_layouts/main.json', async () => {
    const app = makeApp();
    const res = await app.request('/_layouts/main.json');
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.spec.root).toBe('shell');
  });

  it('serves screen at /_screens/home.json', async () => {
    const app = makeApp();
    const res = await app.request('/_screens/home.json');
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.spec.root).toBe('page');
  });

  it('returns 404 for unknown screen', async () => {
    const app = makeApp();
    const res = await app.request('/_screens/nonexistent.json');
    expect(res.status).toBe(404);
  });

  it('SPA fallback returns shell for unknown paths', async () => {
    const app = makeApp();
    const res = await app.request('/issues/123');
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('<div id="root">');
  });
});
