import { describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import { createUiApp } from '../../src/server/index.js';
import { artifact } from '../fixtures/validated-artifact.js';

function mount() {
  const app = new Hono();
  app.route('/', createUiApp({ artifact, assetsDir: '/nonexistent-so-asset-404s' }));
  return app;
}

describe('createUiApp', () => {
  it('serves the shell on /ui', async () => {
    const res = await mount().request('/ui');
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('<div id="root"></div>');
  });

  it('serves the artifact at /ui/__artifact.json', async () => {
    const res = await mount().request('/ui/__artifact.json');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { artifact: unknown };
    expect(body.artifact).toBeDefined();
  });

  it('404s for missing assets', async () => {
    const res = await mount().request('/ui/assets/main.js');
    expect(res.status).toBe(404);
  });

  it('SPA-fallbacks arbitrary sub-paths to the shell', async () => {
    const res = await mount().request('/ui/any/deep/path');
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('<div id="root"></div>');
  });

  it('enforces asset directory boundary', async () => {
    const { mkdirSync, writeFileSync, rmSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const base = join(tmpdir(), 'ui-runtime-test-' + Math.random().toString(36).slice(2));
    const sibling = join(tmpdir(), 'ui-runtime-sibling-' + Math.random().toString(36).slice(2));
    try {
      mkdirSync(base, { recursive: true });
      mkdirSync(sibling, { recursive: true });
      writeFileSync(join(sibling, 'secret.txt'), 'SECRET');
      const app = new Hono();
      app.route('/', createUiApp({ artifact, assetsDir: base }));
      // Hono decodes %2F to / in :file param, so the handler receives ../../<sibling>/secret.txt.
      // The path-traversal guard must catch this and return 404.
      const siblingDir = sibling.split('/').pop()!;
      const relative = `../../${siblingDir}/secret.txt`;
      const encoded = encodeURIComponent(relative);
      const res = await app.request(`/ui/assets/${encoded}`);
      expect(res.status).toBe(404); // must NOT be 200 with SECRET content
      const body = await res.text();
      expect(body).not.toContain('SECRET');
    } finally {
      try { rmSync(base, { recursive: true, force: true }); } catch { /* ignore */ }
      try { rmSync(sibling, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  });
});
