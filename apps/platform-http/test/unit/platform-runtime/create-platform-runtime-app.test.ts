import { describe, expect, it } from 'vitest';
import { createPlatformRuntimeApp } from '../../../src/platform-runtime/create-platform-runtime-app.js';
import { loadPlatformBlueprint } from '../../../src/platform-runtime/load-platform-blueprint.js';

describe('createPlatformRuntimeApp', () => {
  it('serves platform UI and API health surfaces', async () => {
    const loaded = await loadPlatformBlueprint();
    expect(loaded.ok, loaded.ok ? '' : JSON.stringify(loaded.errors, null, 2)).toBe(true);
    if (!loaded.ok) return;

    const app = await createPlatformRuntimeApp({ blueprint: loaded.value });
    const ui = await app.request('/');
    expect(ui.status).toBe(200);

    const manifest = await app.request('/_manifest.json');
    expect(manifest.status).toBe(200);
  });
});
