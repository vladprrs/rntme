import { describe, expect, it } from 'bun:test';
import { readFile } from 'node:fs/promises';
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

  it('registers the dashboard deploy-stage read binding under the invoked native operation id', async () => {
    const operations = JSON.parse(
      await readFile(join(here, '../services/deployments/operations.json'), 'utf8'),
    );
    const bindings = JSON.parse(
      await readFile(join(here, '../services/deployments/bindings/bindings.json'), 'utf8'),
    );

    expect(bindings.bindings.listDeployStages.graph).toBe('readDeployStages');
    expect(bindings.bindings.listDeployStages.target).toEqual({ engine: 'native', dialect: 'platform' });
    expect(operations.operations.readDeployStages).toEqual({
      handler: {
        kind: 'native',
        entry: './handlers/deployments.ts',
        export: 'listDeployStagesHandler',
      },
      input: {
        authorization: { type: 'string', mode: 'required' },
        sessionSubject: { type: 'string', mode: 'optional' },
        sessionStatus: { type: 'string', mode: 'optional' },
        organizationId: { type: 'string', mode: 'required' },
        projectId: { type: 'string', mode: 'required' },
      },
      output: { type: 'ListDeployStagesResult' },
      effect: 'read',
      idempotency: 'none',
    });
  });

  it('materializes the project operations read table needed by runtime-native deployment start', async () => {
    const result = await loadComposedBlueprint(blueprintRoot);
    expect(result.ok, result.ok ? '' : JSON.stringify(result.errors, null, 2)).toBe(true);
    if (!result.ok) return;

    expect(result.value.services.deployments?.qsmValidated?.projections.ProjectOperationView).toBeDefined();
  });
});
