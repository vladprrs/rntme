import { afterEach, describe, expect, it } from 'bun:test';
import { planStageHandler } from '../../../src/handlers/plan-handler.js';
import { _setHandlerContextForTest } from '../../../src/handlers/platform-context.js';
import { makeMockHandlerContext } from './_helpers.js';

afterEach(() => {
  _setHandlerContextForTest(undefined);
});

describe('planStageHandler', () => {
  it('begins the plan stage and fails when prior compose/provision state is missing', async () => {
    const { ctx, stageRepo } = makeMockHandlerContext();
    _setHandlerContextForTest(ctx);

    const result = await planStageHandler({ deploymentId: 'dep-1', orgId: 'org-1' });

    expect(stageRepo.begin).toHaveBeenCalledTimes(1);
    expect(stageRepo.begin.mock.calls[0]?.[0]).toEqual({
      id: 'dep-1-plan',
      deploymentId: 'dep-1',
      orgId: 'org-1',
      stage: 'plan',
    });
    expect(stageRepo.fail).toHaveBeenCalledTimes(1);
    expect(stageRepo.succeed).not.toHaveBeenCalled();
    expect(result.status).toBe('failed');
    expect(result.stage).toBe('plan');
    expect(result.errorCode).toBe('DEPLOY_PLAN_FAILED');
    expect(result.errorMessage).toContain('DEPLOY_HANDLER_PRIOR_STATE_MISSING');
  });
});
