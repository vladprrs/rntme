import { describe, expect, it } from 'bun:test';
import { loadBlueprintForDeploy } from '../../../src/deploy-engine/load-blueprint.js';

describe('loadBlueprintForDeploy', () => {
  it('returns CLI_DEPLOY_BLUEPRINT_INVALID for a non-existent dir', async () => {
    const result = await loadBlueprintForDeploy('/no/such/dir');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('CLI_DEPLOY_BLUEPRINT_INVALID');
  });
});
