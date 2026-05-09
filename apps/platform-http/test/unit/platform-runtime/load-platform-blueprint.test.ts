import { describe, expect, it } from 'vitest';
import { loadPlatformBlueprint } from '../../../src/platform-runtime/load-platform-blueprint.js';

describe('loadPlatformBlueprint', () => {
  it('loads the platform blueprint from the repo apps/platform path', async () => {
    const result = await loadPlatformBlueprint();
    expect(result.ok, result.ok ? '' : JSON.stringify(result.errors, null, 2)).toBe(true);
    if (!result.ok) return;
    expect(result.value.project.name).toBe('rntme-platform');
    expect(result.value.services.app?.compiledUi).toBeDefined();
    expect(result.value.services.deployments).toBeDefined();
  });
});
