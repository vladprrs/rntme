import { isOk } from '@rntme/platform-core';
import type { DeploymentApplyResult } from '@rntme/deploy-dokploy';
import { verify as verifyStage } from '../stages/verify.js';
import { getPlatformHandlerContext } from './platform-context.js';
import { failStage } from './handler-shared.js';
import type { StageHandlerInput, StageHandlerResult } from './types.js';

/**
 * BPMN task #6 (terminal): verify. Reads the apply row, fetches the apply
 * result from the blob store, and runs `stages.verify`. On success records
 * `{ ok, partialOk, checkCount }` and on failure records the error code.
 *
 * Operaton-side incident handling decides whether the BPMN process retries —
 * the handler simply reflects success/failure and the deployment row is
 * finalized by a separate caller (TODO: wire into deployment finalize).
 */
export async function verifyStageHandler(
  input: StageHandlerInput,
): Promise<StageHandlerResult> {
  const ctx = getPlatformHandlerContext();
  await ctx.withOrgTx(input.orgId, (repos) =>
    repos.stageState.begin({
      id: `${input.deploymentId}-verify`,
      deploymentId: input.deploymentId,
      orgId: input.orgId,
      stage: 'verify',
    }),
  );

  try {
    const applyState = await ctx.withOrgTx(input.orgId, async (repos) => {
      const applyRow = await repos.stageState.read({ deploymentId: input.deploymentId, stage: 'apply' });
      if (applyRow === null || applyRow.publicStateJson === null) {
        throw new Error('DEPLOY_HANDLER_PRIOR_STATE_MISSING');
      }
      return JSON.parse(applyRow.publicStateJson) as { applyBlobKey: string };
    });

    const appliedRaw = await ctx.blob.getRaw(applyState.applyBlobKey);
    if (!isOk(appliedRaw)) {
      throw new Error(
        `DEPLOY_HANDLER_APPLY_BLOB_FETCH_FAILED: ${appliedRaw.errors[0]?.message ?? ''}`,
      );
    }
    const applied = JSON.parse(appliedRaw.value.toString('utf8')) as DeploymentApplyResult;

    const out = await verifyStage({ applied });

    await ctx.withOrgTx(input.orgId, (repos) =>
      repos.stageState.succeed({
        deploymentId: input.deploymentId,
        stage: 'verify',
        publicStateJson: JSON.stringify({
          ok: out.report.ok,
          partialOk: out.report.partialOk,
          checkCount: out.report.checks.length,
        }),
      }),
    );

    return {
      stage: 'verify',
      status: 'succeeded',
      publicSummary: {
        ok: out.report.ok,
        partialOk: out.report.partialOk,
        checkCount: out.report.checks.length,
      },
    };
  } catch (cause) {
    return failStage(ctx, input.orgId, input.deploymentId, 'verify', cause, 'DEPLOY_VERIFY_FAILED');
  }
}
