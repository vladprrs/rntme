import { isOk } from '@rntme/platform-core';
import { provision } from '../stages/provision.js';
import { compose as composeStage } from '../stages/compose.js';
import { getPlatformHandlerContext } from './platform-context.js';
import { failStage } from './handler-shared.js';
import type { StageHandlerInput, StageHandlerResult } from './types.js';

/**
 * BPMN task #2: provision. Reads the compose row to recover `bundleDir`,
 * loads the deploy target + decrypted secrets, and runs `stages.provision`.
 * Public outputs go to `publicStateJson`; sensitive `secretByModule` is
 * persisted to the blob store (key `deploy/<deploymentId>/provision-secrets`)
 * and only the key is recorded in the row.
 */
export async function provisionStageHandler(
  input: StageHandlerInput,
): Promise<StageHandlerResult> {
  const ctx = getPlatformHandlerContext();
  await ctx.withOrgTx(input.orgId, (repos) =>
    repos.stageState.begin({
      id: `${input.deploymentId}-provision`,
      deploymentId: input.deploymentId,
      orgId: input.orgId,
      stage: 'provision',
    }),
  );

  try {
    const { composeState, deployment, target, decrypted } = await ctx.withOrgTx(input.orgId, async (repos) => {
      const composeRow = await repos.stageState.read({ deploymentId: input.deploymentId, stage: 'compose' });
      if (composeRow === null || composeRow.publicStateJson === null) {
        throw new Error('DEPLOY_HANDLER_COMPOSE_STATE_MISSING');
      }
      const composeState = JSON.parse(composeRow.publicStateJson) as { bundleDir: string };

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
      return { composeState, deployment, target, decrypted };
    });

    // Re-load composed blueprint from disk (cheap; the bundleDir is materialized
    // and persisted by the compose handler). Avoids serializing a large object
    // through Postgres.
    const composed = await composeStage({ bundleDir: composeState.bundleDir });

    const out = await provision(
      {
        // The runner's StageContext.target is `NormalizedDeployTarget`, but the
        // platform-storage DeployTargetWithSecret carries the raw row. The
        // shape overlap is partial; the provisioner pipeline only reads
        // `slug`, `dokployUrl`, and target-secret extras. Cast to `never`
        // pending a proper normalizer in a follow-up.
        ctx: {
          // See apply-handler note: orgSlug placeholder.
          orgSlug: '',
          target: target as never,
          resolvedTargetSecrets: { apiToken: '', extras: decrypted },
          configOverrides: deployment.configOverrides,
        },
        composed: composed.composed,
        bundleDir: composed.bundleDir,
        priorProvisionOutputs: {},
      },
      {
        resolveProvisioner: ctx.resolveProvisioner,
      },
    );

    // Sensitive secret outputs spill to the blob store; only the key goes into
    // the row's secretBlobKey column. Render handler reloads via the blob.
    const secretBlobKey = `deploy/${input.deploymentId}/provision-secrets`;
    const secretBytes = Buffer.from(JSON.stringify(out.secretByModule), 'utf8');
    const putResult = await ctx.blob.putIfAbsent(secretBlobKey, secretBytes);
    if (!isOk(putResult)) {
      throw new Error(
        `DEPLOY_HANDLER_BLOB_PUT_FAILED: ${putResult.errors[0]?.message ?? ''}`,
      );
    }

    await ctx.withOrgTx(input.orgId, (repos) =>
      repos.stageState.succeed({
        deploymentId: input.deploymentId,
        stage: 'provision',
        publicStateJson: JSON.stringify({
          publicByModule: out.publicByModule,
          provisionResultForPlan: out.provisionResultForPlan,
          discoveredModulesForPlan: out.discoveredModulesForPlan,
          startedAt: out.startedAt,
          finishedAt: out.finishedAt,
        }),
        secretBlobKey,
      }),
    );

    return {
      stage: 'provision',
      status: 'succeeded',
      publicSummary: { moduleCount: out.provisioned.size },
    };
  } catch (cause) {
    return failStage(ctx, input.orgId, input.deploymentId, 'provision', cause, 'DEPLOY_PROVISION_FAILED');
  }
}
