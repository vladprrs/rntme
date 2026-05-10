import { afterEach, describe, expect, it } from 'bun:test';
import { verifyStageHandler } from '../../../src/handlers/verify-handler.js';
import { _setHandlerContextForTest } from '../../../src/handlers/platform-context.js';
import { makeMockHandlerContext } from './_helpers.js';

afterEach(() => {
  _setHandlerContextForTest(undefined);
});

describe('verifyStageHandler', () => {
  it('begins the verify stage and fails when prior apply state is missing', async () => {
    const { ctx, stageRepo } = makeMockHandlerContext();
    _setHandlerContextForTest(ctx);

    const result = await verifyStageHandler({ deploymentId: 'dep-1', orgId: 'org-1' });

    expect(stageRepo.begin).toHaveBeenCalledTimes(1);
    expect(stageRepo.begin.mock.calls[0]?.[0]).toEqual({
      id: 'dep-1-verify',
      deploymentId: 'dep-1',
      orgId: 'org-1',
      stage: 'verify',
    });
    expect(stageRepo.fail).toHaveBeenCalledTimes(1);
    expect(stageRepo.succeed).not.toHaveBeenCalled();
    expect(result.status).toBe('failed');
    expect(result.stage).toBe('verify');
    expect(result.errorCode).toBe('DEPLOY_VERIFY_FAILED');
    expect(result.errorMessage).toContain('DEPLOY_HANDLER_PRIOR_STATE_MISSING');
  });
});
