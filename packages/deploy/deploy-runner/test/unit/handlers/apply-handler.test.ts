import { afterEach, describe, expect, it } from 'bun:test';
import { applyStageHandler } from '../../../src/handlers/apply-handler.js';
import { _setHandlerContextForTest } from '../../../src/handlers/platform-context.js';
import { makeMockHandlerContext } from './_helpers.js';

afterEach(() => {
  _setHandlerContextForTest(undefined);
});

describe('applyStageHandler', () => {
  it('begins the apply stage and fails when prior render/plan state is missing', async () => {
    const { ctx, stageRepo } = makeMockHandlerContext();
    _setHandlerContextForTest(ctx);

    const result = await applyStageHandler({ deploymentId: 'dep-1', orgId: 'org-1' });

    expect(stageRepo.begin).toHaveBeenCalledTimes(1);
    expect(stageRepo.begin.mock.calls[0]?.[0]).toEqual({
      id: 'dep-1-apply',
      deploymentId: 'dep-1',
      orgId: 'org-1',
      stage: 'apply',
    });
    expect(stageRepo.fail).toHaveBeenCalledTimes(1);
    expect(stageRepo.succeed).not.toHaveBeenCalled();
    expect(result.status).toBe('failed');
    expect(result.stage).toBe('apply');
    expect(result.errorCode).toBe('DEPLOY_APPLY_FAILED');
    expect(result.errorMessage).toContain('DEPLOY_HANDLER_PRIOR_STATE_MISSING');
  });
});
