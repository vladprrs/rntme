import { isOk } from '@rntme/platform-core';
import type { ProjectDeploymentPlan, ProvisionedModule } from '@rntme/deploy-core';
import { render as renderStage } from '../stages/render.js';
import { getPlatformHandlerContext } from './platform-context.js';
import { failStage } from './handler-shared.js';
import type { StageHandlerInput, StageHandlerResult } from './types.js';

/**
 * BPMN task #4: render. Reads the plan blob, reloads provisioned modules from
 * the provision-secrets blob, and runs `stages.render`. The rendered Dokploy
 * plan is persisted to the blob store at `deploy/<id>/render` and only the
 * key + digest go into `publicStateJson`.
 */
export async function renderStageHandler(
  input: StageHandlerInput,
): Promise<StageHandlerResult> {
  const ctx = getPlatformHandlerContext();
  await ctx.withOrgTx(input.orgId, (repos) =>
    repos.stageState.begin({
      id: `${input.deploymentId}-render`,
      deploymentId: input.deploymentId,
      orgId: input.orgId,
      stage: 'render',
    }),
  );

  try {
    const { composeState, planState, provState, provSecretBlobKey, deployment, target } = await ctx.withOrgTx(
      input.orgId,
      async (repos) => {
        const composeRow = await repos.stageState.read({ deploymentId: input.deploymentId, stage: 'compose' });
        const provRow = await repos.stageState.read({ deploymentId: input.deploymentId, stage: 'provision' });
        const planRow = await repos.stageState.read({ deploymentId: input.deploymentId, stage: 'plan' });
        if (
          composeRow === null ||
          composeRow.publicStateJson === null ||
          provRow === null ||
          provRow.publicStateJson === null ||
          planRow === null ||
          planRow.publicStateJson === null
        ) {
          throw new Error('DEPLOY_HANDLER_PRIOR_STATE_MISSING');
        }
        const composeState = JSON.parse(composeRow.publicStateJson) as { bundleDir: string };
        const planState = JSON.parse(planRow.publicStateJson) as { planBlobKey: string };
        const provState = JSON.parse(provRow.publicStateJson) as {
          publicByModule: Record<string, Record<string, unknown>>;
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

        return {
          composeState,
          planState,
          provState,
          provSecretBlobKey: provRow.secretBlobKey,
          deployment,
          target,
        };
      },
    );

    const planRaw = await ctx.blob.getRaw(planState.planBlobKey);
    if (!isOk(planRaw)) {
      throw new Error(
        `DEPLOY_HANDLER_PLAN_BLOB_FETCH_FAILED: ${planRaw.errors[0]?.message ?? ''}`,
      );
    }
    const projectPlan = JSON.parse(planRaw.value.toString('utf8')) as ProjectDeploymentPlan;

    let secretByModule: Record<string, Record<string, unknown>> = {};
    if (provSecretBlobKey !== null) {
      const secretRaw = await ctx.blob.getRaw(provSecretBlobKey);
      if (!isOk(secretRaw)) {
        throw new Error(
          `DEPLOY_HANDLER_PROVISION_SECRETS_FETCH_FAILED: ${secretRaw.errors[0]?.message ?? ''}`,
        );
      }
      secretByModule = JSON.parse(secretRaw.value.toString('utf8')) as Record<
        string,
        Record<string, unknown>
      >;
    }

    // Reconstruct the `provisioned` Map from per-module public + secret outputs.
    // ProvisionedModule has more shape than this in deploy-core, but render
    // only reads `publicOutputs` and `secretOutputs`; cast through `unknown`
    // until the shape rounds out.
    const provisioned = new Map<string, ProvisionedModule>();
    const moduleKeys = new Set([
      ...Object.keys(provState.publicByModule),
      ...Object.keys(secretByModule),
    ]);
    for (const key of moduleKeys) {
      provisioned.set(key, {
        projectKey: key,
        publicOutputs: provState.publicByModule[key] ?? {},
        secretOutputs: secretByModule[key] ?? {},
      } as unknown as ProvisionedModule);
    }

    const out = await renderStage({
      ctx: {
        // See apply-handler note: orgSlug placeholder.
        orgSlug: '',
        target: target as never,
        resolvedTargetSecrets: { apiToken: '', extras: {} },
        configOverrides: deployment.configOverrides,
      },
      plan: projectPlan,
      provisioned,
      bundleDir: composeState.bundleDir,
    });

    const renderBlobKey = `deploy/${input.deploymentId}/render`;
    const putResult = await ctx.blob.putIfAbsent(
      renderBlobKey,
      Buffer.from(JSON.stringify(out.rendered), 'utf8'),
    );
    if (!isOk(putResult)) {
      throw new Error(
        `DEPLOY_HANDLER_BLOB_PUT_FAILED: ${putResult.errors[0]?.message ?? ''}`,
      );
    }

    await ctx.withOrgTx(input.orgId, (repos) =>
      repos.stageState.succeed({
        deploymentId: input.deploymentId,
        stage: 'render',
        publicStateJson: JSON.stringify({ renderBlobKey, digest: out.rendered.digest }),
      }),
    );

    return {
      stage: 'render',
      status: 'succeeded',
      publicSummary: { digest: out.rendered.digest },
    };
  } catch (cause) {
    return failStage(ctx, input.orgId, input.deploymentId, 'render', cause, 'DEPLOY_RENDER_FAILED');
  }
}
