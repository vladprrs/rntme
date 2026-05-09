import { describe, expect, it } from 'vitest';
import { loadPlatformBlueprint } from '../../../src/platform-runtime/load-platform-blueprint.js';
import { createPlatformRuntimeApp } from '../../../src/platform-runtime/create-platform-runtime-app.js';

describe('platform runtime cutover surface', () => {
  it('does not expose legacy v1 routes from the runtime app', async () => {
    const loaded = await loadPlatformBlueprint();
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    const app = await createPlatformRuntimeApp({ blueprint: loaded.value });
    // The runtime app is a SPA — unrecognised paths are served the HTML shell
    // (not legacy API JSON). Assert no 401 JSON auth gate is present.
    const legacy = await app.request('/v1/auth/me');
    // SPA fallback returns 200 HTML, not a 401 JSON auth error from legacy API
    expect(legacy.status).not.toBe(401);
    const ct = legacy.headers.get('content-type') ?? '';
    expect(ct).toMatch(/text\/html/);
  });

  it('serves platform UI manifest in blueprint mode', async () => {
    const loaded = await loadPlatformBlueprint();
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    const app = await createPlatformRuntimeApp({ blueprint: loaded.value });
    const manifest = await app.request('/_manifest.json');
    expect(manifest.status).toBe(200);
    const body = await manifest.json() as { routes: Record<string, unknown> };
    expect(body.routes['/:orgId']).toBeDefined();
  });
});
