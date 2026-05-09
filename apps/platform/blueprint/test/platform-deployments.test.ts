import { describe, expect, it } from 'vitest';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadComposedBlueprint } from '@rntme/blueprint';

const here = dirname(fileURLToPath(import.meta.url));
const blueprintRoot = join(here, '..');

describe('platform deployments service', () => {
  it('exposes deployment lifecycle bindings', async () => {
    const result = await loadComposedBlueprint(blueprintRoot);
    expect(result.ok, result.ok ? '' : JSON.stringify(result.errors, null, 2)).toBe(true);
    if (!result.ok) return;

    expect(result.value.services.deployments).toBeDefined();
    expect(result.value.bindingRegistry['deployments.queueDeployment']?.path).toBe('/api/deployments');
    expect(result.value.bindingRegistry['deployments.listDeployTargets']?.path).toBe('/api/deployments/targets');
  });
});
