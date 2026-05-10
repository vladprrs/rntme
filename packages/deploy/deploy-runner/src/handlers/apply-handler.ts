import { isOk } from '@rntme/platform-core';
import type { RenderedDokployPlan } from '@rntme/deploy-dokploy';
import { apply as applyStage } from '../stages/apply.js';
import { getPlatformHandlerContext } from './platform-context.js';
import { failStage } from './handler-shared.js';
import type { StageHandlerInput, StageHandlerResult } from './types.js';

/**
 * BPMN task #5: apply. Reads the render row + plan row, fetches the rendered
 * Dokploy plan blob, resolves required target secrets, and runs `stages.apply`.
 * The `DeploymentApplyResult` is persisted to the blob store at
 * `deploy/<id>/apply` and the row records `{ applyBlobKey, durationMs }`.
 */
export async function applyStageHandler(
  input: StageHandlerInput,
): Promise<StageHandlerResult> {
  const ctx = getPlatformHandlerContext();
  await ctx.withOrgTx(input.orgId, (repos) =>
    repos.stageState.begin({
      id: `${input.deploymentId}-apply`,
      deploymentId: input.deploymentId,
      orgId: input.orgId,
      stage: 'apply',
    }),
  );

  try {
    const { renderState, planState, deployment, target, decrypted } = await ctx.withOrgTx(
      input.orgId,
      async (repos) => {
        const renderRow = await repos.stageState.read({ deploymentId: input.deploymentId, stage: 'render' });
        const planRow = await repos.stageState.read({ deploymentId: input.deploymentId, stage: 'plan' });
        if (
          renderRow === null ||
          renderRow.publicStateJson === null ||
          planRow === null ||
          planRow.publicStateJson === null
        ) {
          throw new Error('DEPLOY_HANDLER_PRIOR_STATE_MISSING');
        }
        const renderState = JSON.parse(renderRow.publicStateJson) as { renderBlobKey: string };
        const planState = JSON.parse(planRow.publicStateJson) as {
          requiredTargetSecrets: readonly { secretRef: string; schema: string; purpose: string }[];
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

        const decrypted = await repos.targetSecrets.getAllDecrypted(target.id);
        return { renderState, planState, deployment, target, decrypted };
      },
    );

    const renderedRaw = await ctx.blob.getRaw(renderState.renderBlobKey);
    if (!isOk(renderedRaw)) {
      throw new Error(
        `DEPLOY_HANDLER_RENDER_BLOB_FETCH_FAILED: ${renderedRaw.errors[0]?.message ?? ''}`,
      );
    }
    const rendered = JSON.parse(renderedRaw.value.toString('utf8')) as RenderedDokployPlan;

    const resolvedRequiredSecrets: Record<string, unknown> = {};
    for (const ref of planState.requiredTargetSecrets) {
      const v = decrypted[ref.secretRef];
      if (v === undefined) {
        throw new Error(`DEPLOY_EXECUTOR_TARGET_SECRET_MISSING: ${ref.secretRef}`);
      }
      resolvedRequiredSecrets[ref.secretRef] = v;
    }

    const out = await applyStage({
      ctx: {
        // `Deployment` carries `orgId` (uuid) but the runner's `StageContext`
        // wants an `orgSlug`. Threading the slug through requires a
        // round-trip via the org repo; left as '' for now, Task 17 smoke
        // will surface whether downstream stages depend on the slug.
        orgSlug: '',
        target: target as never,
        resolvedTargetSecrets: { apiToken: '', extras: decrypted },
        configOverrides: deployment.configOverrides,
      },
      rendered,
      resolvedRequiredSecrets,
      // The runner's StageContext.dokployClientFactory takes (apiToken, extras?)
      // but the platform-side factory closes over `target` and decrypts
      // internally. Wrap to match the signature.
      dokployClientFactory: (_apiToken, extras) =>
        ctx.dokployClientFactoryFor(target, extras),
    });

    const applyBlobKey = `deploy/${input.deploymentId}/apply`;
    const putResult = await ctx.blob.putIfAbsent(
      applyBlobKey,
      Buffer.from(JSON.stringify(out.applied), 'utf8'),
    );
    if (!isOk(putResult)) {
      throw new Error(
        `DEPLOY_HANDLER_BLOB_PUT_FAILED: ${putResult.errors[0]?.message ?? ''}`,
      );
    }

    await ctx.withOrgTx(input.orgId, (repos) =>
      repos.stageState.succeed({
        deploymentId: input.deploymentId,
        stage: 'apply',
        publicStateJson: JSON.stringify({ applyBlobKey, durationMs: out.durationMs }),
      }),
    );

    return {
      stage: 'apply',
      status: 'succeeded',
      publicSummary: { durationMs: out.durationMs },
    };
  } catch (cause) {
    return failStage(ctx, input.orgId, input.deploymentId, 'apply', cause, 'DEPLOY_APPLY_FAILED');
  }
}
