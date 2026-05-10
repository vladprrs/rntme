import { afterEach, describe, expect, it } from 'bun:test';
import { renderStageHandler } from '../../../src/handlers/render-handler.js';
import { _setHandlerContextForTest } from '../../../src/handlers/platform-context.js';
import { makeMockHandlerContext } from './_helpers.js';

afterEach(() => {
  _setHandlerContextForTest(undefined);
});

describe('renderStageHandler', () => {
  it('begins the render stage and fails when prior compose/provision/plan state is missing', async () => {
    const { ctx, stageRepo } = makeMockHandlerContext();
    _setHandlerContextForTest(ctx);

    const result = await renderStageHandler({ deploymentId: 'dep-1', orgId: 'org-1' });

    expect(stageRepo.begin).toHaveBeenCalledTimes(1);
    expect(stageRepo.begin.mock.calls[0]?.[0]).toEqual({
      id: 'dep-1-render',
      deploymentId: 'dep-1',
      orgId: 'org-1',
      stage: 'render',
    });
    expect(stageRepo.fail).toHaveBeenCalledTimes(1);
    expect(stageRepo.succeed).not.toHaveBeenCalled();
    expect(result.status).toBe('failed');
    expect(result.stage).toBe('render');
    expect(result.errorCode).toBe('DEPLOY_RENDER_FAILED');
    expect(result.errorMessage).toContain('DEPLOY_HANDLER_PRIOR_STATE_MISSING');
  });
});
