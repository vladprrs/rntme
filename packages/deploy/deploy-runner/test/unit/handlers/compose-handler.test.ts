import { afterEach, describe, expect, it } from 'bun:test';
import { composeStageHandler } from '../../../src/handlers/compose-handler.js';
import { _setHandlerContextForTest } from '../../../src/handlers/platform-context.js';
import { makeMockHandlerContext } from './_helpers.js';

afterEach(() => {
  _setHandlerContextForTest(undefined);
});

describe('composeStageHandler', () => {
  it('begins the compose stage and fails when deployment row is missing', async () => {
    const { ctx, stageRepo } = makeMockHandlerContext();
    _setHandlerContextForTest(ctx);

    const result = await composeStageHandler({ deploymentId: 'dep-1', orgId: 'org-1' });

    // Begin is always called first with the right id/stage.
    expect(stageRepo.begin).toHaveBeenCalledTimes(1);
    expect(stageRepo.begin.mock.calls[0]?.[0]).toEqual({
      id: 'dep-1-compose',
      deploymentId: 'dep-1',
      orgId: 'org-1',
      stage: 'compose',
    });
    // With a null deployment lookup, the handler falls into its catch and
    // records a failure; succeed must never have been called.
    expect(stageRepo.fail).toHaveBeenCalledTimes(1);
    expect(stageRepo.succeed).not.toHaveBeenCalled();
    expect(result.status).toBe('failed');
    expect(result.stage).toBe('compose');
    // Plain `new Error(...)` without a `code` property → fallback code wins;
    // the descriptive marker lives in the message.
    expect(result.errorCode).toBe('DEPLOY_COMPOSE_FAILED');
    expect(result.errorMessage).toContain('DEPLOY_HANDLER_DEPLOYMENT_MISSING');
  });
});
