import { describe, expect, it } from 'bun:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadComposedBlueprint } from '../../../../packages/artifacts/blueprint/src/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const blueprintRoot = join(here, '..');

describe('platform deployments service', () => {
  it('exposes deployment lifecycle bindings', async () => {
    const result = await loadComposedBlueprint(blueprintRoot);
    expect(result.ok, result.ok ? '' : JSON.stringify(result.errors, null, 2)).toBe(true);
    if (!result.ok) return;

    expect(result.value.services.deployments).toBeDefined();
    expect(result.value.bindingRegistry['deployments.startDeployment']?.path).toBe('/api/deployments');
    expect(result.value.bindingRegistry['deployments.listDeployTargets']?.path).toBe('/api/deployments/targets');
    expect(result.value.bindingRegistry['deployments.getDeployTarget']?.path).toBe('/api/deployments/targets/{slug}');
    expect(result.value.bindingRegistry['deployments.createDeployTarget']?.path).toBe('/api/deployments/targets');
    expect(result.value.bindingRegistry['deployments.updateDeployTarget']?.path).toBe('/api/deployments/targets/{slug}/actions/update');
    expect(result.value.bindingRegistry['deployments.deleteDeployTarget']?.path).toBe('/api/deployments/targets/{slug}/actions/delete');
  });

  it('materializes the project operations read table needed by runtime-native deployment start', async () => {
    const result = await loadComposedBlueprint(blueprintRoot);
    expect(result.ok, result.ok ? '' : JSON.stringify(result.errors, null, 2)).toBe(true);
    if (!result.ok) return;

    expect(result.value.services.deployments?.qsmValidated?.projections.ProjectOperationView).toBeDefined();
  });
});
