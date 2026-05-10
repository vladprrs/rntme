import { describe, expect, it } from 'bun:test';
import { deployStageState } from '../../src/schema/deploy-stage-state.js';

describe('deploy_stage_state schema', () => {
  it('uses snake_case column names matching PDM', () => {
    const cols = Object.keys(deployStageState);
    expect(cols).toContain('deploymentId');
    expect(cols).toContain('orgId');
    expect(cols).toContain('publicStateJson');
    expect(cols).toContain('secretBlobKey');
  });
});
