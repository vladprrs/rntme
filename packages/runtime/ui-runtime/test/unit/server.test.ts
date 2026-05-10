import { describe, expect, it } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
    expect(html).toContain('<link rel="stylesheet" href="/assets/main.css">');
    expect(html).toContain('<script type="module" src="/assets/main.js"></script>');
  });

  it('serves shell responses with CSP and security headers', async () => {
    const app = makeApp();

    for (const path of ['/', '/issues/123']) {
      const res = await app.request(path);

      expect(res.status).toBe(200);
      expect(res.headers.get('content-security-policy')).toBe(
        "default-src 'none'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; script-src 'self'; style-src 'self'; connect-src 'self' https:; frame-src https:; img-src 'self' data: https:; font-src 'self'",
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

  it('serves nested JavaScript assets from the build directory', async () => {
    const assetsDir = mkdtempSync(join(tmpdir(), 'rntme-ui-assets-'));
    try {
      mkdirSync(join(assetsDir, 'chunks'));
      writeFileSync(join(assetsDir, 'chunks', 'client.js'), 'export const ok = true;');
      const app = createApp({
        artifact: {
          manifest: testManifest,
          layouts: { main: testLayout },
          screens: { home: testScreen },
        },
        assetsDir,
      });

      const res = await app.request('/assets/chunks/client.js');

      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('application/javascript');
      expect(await res.text()).toBe('export const ok = true;');
    } finally {
      rmSync(assetsDir, { recursive: true, force: true });
    }
  });

  it('SPA fallback returns shell for unknown paths', async () => {
    const app = makeApp();
    const res = await app.request('/issues/123');
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('<div id="root">');
  });
});
