import { afterEach, describe, expect, it } from 'bun:test';
import { provisionStageHandler } from '../../../src/handlers/provision-handler.js';
import { _setHandlerContextForTest } from '../../../src/handlers/platform-context.js';
import { makeMockHandlerContext } from './_helpers.js';

afterEach(() => {
  _setHandlerContextForTest(undefined);
});

describe('provisionStageHandler', () => {
  it('begins the provision stage and fails when prior compose state is missing', async () => {
    // Default stageRepo.read returns null → the handler fails with
    // DEPLOY_HANDLER_COMPOSE_STATE_MISSING.
    const { ctx, stageRepo } = makeMockHandlerContext();
    _setHandlerContextForTest(ctx);

    const result = await provisionStageHandler({ deploymentId: 'dep-1', orgId: 'org-1' });

    expect(stageRepo.begin).toHaveBeenCalledTimes(1);
    expect(stageRepo.begin.mock.calls[0]?.[0]).toEqual({
      id: 'dep-1-provision',
      deploymentId: 'dep-1',
      orgId: 'org-1',
      stage: 'provision',
    });
    expect(stageRepo.fail).toHaveBeenCalledTimes(1);
    expect(stageRepo.succeed).not.toHaveBeenCalled();
    expect(result.status).toBe('failed');
    expect(result.stage).toBe('provision');
    expect(result.errorCode).toBe('DEPLOY_PROVISION_FAILED');
    expect(result.errorMessage).toContain('DEPLOY_HANDLER_COMPOSE_STATE_MISSING');
  });
});
