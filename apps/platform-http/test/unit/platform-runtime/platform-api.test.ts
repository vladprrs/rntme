import { describe, expect, it } from 'vitest';
import { createPlatformRuntimeApp } from '../../../src/platform-runtime/create-platform-runtime-app.js';
import { loadPlatformBlueprint } from '../../../src/platform-runtime/load-platform-blueprint.js';

describe('platform generated API', () => {
  it('exposes generated OpenAPI for platform services', async () => {
    const loaded = await loadPlatformBlueprint();
    expect(loaded.ok, loaded.ok ? '' : JSON.stringify(loaded.errors, null, 2)).toBe(true);
    if (!loaded.ok) return;

    const app = await createPlatformRuntimeApp({ blueprint: loaded.value });

    const endpoints = [
      '/api/projects/openapi.json',
      '/api/organizations/openapi.json',
      '/api/tokens/openapi.json',
      '/api/audit/openapi.json',
      '/api/deployments/openapi.json',
    ];

    for (const endpoint of endpoints) {
      const res = await app.request(endpoint);
      expect(res.status).toBe(200);
    }
  });
});
