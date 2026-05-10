import { isOk } from '@rntme/platform-core';
import { plan as planStage } from '../stages/plan.js';
import { compose as composeStage } from '../stages/compose.js';
import { getPlatformHandlerContext } from './platform-context.js';
import { failStage } from './handler-shared.js';
import type { StageHandlerInput, StageHandlerResult } from './types.js';

/**
 * BPMN task #3: plan. Reads compose + provision rows, re-loads the composed
 * blueprint from `bundleDir`, then runs `stages.plan`. The full
 * `ProjectDeploymentPlan` is large, so we persist it to the blob store and
 * record only `{ planBlobKey, requiredTargetSecrets }` in the row.
 */
export async function planStageHandler(
  input: StageHandlerInput,
): Promise<StageHandlerResult> {
  const ctx = getPlatformHandlerContext();
  await ctx.withOrgTx(input.orgId, (repos) =>
    repos.stageState.begin({
      id: `${input.deploymentId}-plan`,
      deploymentId: input.deploymentId,
      orgId: input.orgId,
      stage: 'plan',
    }),
  );

  try {
    const { composeState, provState, deployment, target } = await ctx.withOrgTx(input.orgId, async (repos) => {
      const composeRow = await repos.stageState.read({ deploymentId: input.deploymentId, stage: 'compose' });
      const provRow = await repos.stageState.read({ deploymentId: input.deploymentId, stage: 'provision' });
      if (
        composeRow === null ||
        composeRow.publicStateJson === null ||
        provRow === null ||
        provRow.publicStateJson === null
      ) {
        throw new Error('DEPLOY_HANDLER_PRIOR_STATE_MISSING');
      }
      const composeState = JSON.parse(composeRow.publicStateJson) as { bundleDir: string };
      const provState = JSON.parse(provRow.publicStateJson) as {
        publicByModule: Record<string, Record<string, unknown>>;
        provisionResultForPlan?: unknown;
        discoveredModulesForPlan?: unknown;
        startedAt: string;
        finishedAt: string;
      };

      const deploymentResult = await repos.deployment.getById(input.deploymentId);
      if (!isOk(deploymentResult) || deploymentResult.value === null) {
        throw new Error('DEPLOY_HANDLER_DEPLOYMENT_MISSING');
      }
      const deployment = deploymentResult.value;
      const targetResult = await repos.deployTarget.getWithSecretById(deployment.targetId);
      if (!isOk(targetResult) || targetResult.value === null) {
        throw new Error('DEPLOY_HANDLER_TARGET_MISSING');
      }
      const target = targetResult.value;
      return { composeState, provState, deployment, target };
    });

    const composed = await composeStage({ bundleDir: composeState.bundleDir });

    const planResult = await planStage({
      ctx: {
        // See apply-handler note: orgSlug placeholder.
        orgSlug: '',
        target: target as never,
        resolvedTargetSecrets: { apiToken: '', extras: {} },
        configOverrides: deployment.configOverrides,
      },
      composed: composed.composed,
      provision: {
        // The plan stage only reads `provisionResultForPlan` and
        // `discoveredModulesForPlan` from the provision envelope; the
        // `provisioned` Map and per-module secrets are render-stage concerns.
        provisioned: new Map(),
        publicByModule: provState.publicByModule,
        secretByModule: {},
        ...(provState.provisionResultForPlan === undefined
          ? {}
          : { provisionResultForPlan: provState.provisionResultForPlan as never }),
        ...(provState.discoveredModulesForPlan === undefined
          ? {}
          : { discoveredModulesForPlan: provState.discoveredModulesForPlan as never }),
        startedAt: provState.startedAt,
        finishedAt: provState.finishedAt,
      },
    });

    const planBlobKey = `deploy/${input.deploymentId}/plan`;
    const putResult = await ctx.blob.putIfAbsent(
      planBlobKey,
      Buffer.from(JSON.stringify(planResult.plan), 'utf8'),
    );
    if (!isOk(putResult)) {
      throw new Error(
        `DEPLOY_HANDLER_BLOB_PUT_FAILED: ${putResult.errors[0]?.message ?? ''}`,
      );
    }

    await ctx.withOrgTx(input.orgId, (repos) =>
      repos.stageState.succeed({
        deploymentId: input.deploymentId,
        stage: 'plan',
        publicStateJson: JSON.stringify({
          planBlobKey,
          requiredTargetSecrets: planResult.plan.requiredTargetSecrets,
        }),
      }),
    );

    return {
      stage: 'plan',
      status: 'succeeded',
      publicSummary: {
        requiredSecretCount: planResult.plan.requiredTargetSecrets.length,
      },
    };
  } catch (cause) {
    return failStage(ctx, input.orgId, input.deploymentId, 'plan', cause, 'DEPLOY_PLAN_FAILED');
  }
}
