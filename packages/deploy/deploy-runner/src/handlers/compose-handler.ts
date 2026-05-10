import { gunzipSync } from 'node:zlib';
import { isOk, parseCanonicalBundle } from '@rntme/platform-core';
import { materializeBundle } from '@rntme/blueprint';
import { compose } from '../stages/compose.js';
import { getPlatformHandlerContext } from './platform-context.js';
import { failStage } from './handler-shared.js';
import type { StageHandlerInput, StageHandlerResult } from './types.js';

/**
 * BPMN task #1: compose. Loads the canonical bundle from the blob store keyed
 * by the project version, materializes it to a temp dir, and runs the pure
 * `stages.compose` function. Persists `bundleDir` (so subsequent stages can
 * re-load the blueprint without round-tripping through the DB or blob) and
 * the project name into `publicStateJson`.
 */
export async function composeStageHandler(
  input: StageHandlerInput,
): Promise<StageHandlerResult> {
  const ctx = getPlatformHandlerContext();
  const stageStateId = `${input.deploymentId}-compose`;

  await ctx.withOrgTx(input.orgId, (repos) =>
    repos.stageState.begin({
      id: stageStateId,
      deploymentId: input.deploymentId,
      orgId: input.orgId,
      stage: 'compose',
    }),
  );

  try {
    const blobKey = await ctx.withOrgTx(input.orgId, async (repos) => {
      const deployment = await repos.deployment.getById(input.deploymentId);
      if (!isOk(deployment) || deployment.value === null) {
        throw new Error('DEPLOY_HANDLER_DEPLOYMENT_MISSING');
      }
      const projectVersion = await repos.projectVersion.getById(deployment.value.projectVersionId);
      if (!isOk(projectVersion) || projectVersion.value === null) {
        throw new Error('DEPLOY_HANDLER_PROJECT_VERSION_MISSING');
      }
      return projectVersion.value.bundleBlobKey;
    });

    const raw = await ctx.blob.getRaw(blobKey);
    if (!isOk(raw)) {
      throw new Error(
        `DEPLOY_HANDLER_BLOB_FETCH_FAILED: ${raw.errors[0]?.message ?? ''}`,
      );
    }

    const bundleBytes = gunzipSync(raw.value);
    const parsed = parseCanonicalBundle(bundleBytes);
    if (!isOk(parsed)) {
      throw new Error(
        `DEPLOY_HANDLER_BUNDLE_INVALID: ${parsed.errors[0]?.message ?? ''}`,
      );
    }

    const bundleDir = await materializeBundle(parsed.value.bundle);
    const result = await compose({ bundleDir });

    const projectName = extractProjectName(result.composed);
    await ctx.withOrgTx(input.orgId, (repos) =>
      repos.stageState.succeed({
        deploymentId: input.deploymentId,
        stage: 'compose',
        publicStateJson: JSON.stringify({ bundleDir, projectName }),
      }),
    );

    return {
      stage: 'compose',
      status: 'succeeded',
      publicSummary: { projectName },
    };
  } catch (cause) {
    return failStage(ctx, input.orgId, input.deploymentId, 'compose', cause, 'DEPLOY_COMPOSE_FAILED');
  }
}

function extractProjectName(composed: unknown): string {
  // `compose` stage today returns a `ComposedBlueprint` (project.name) cast to
  // `ComposedProjectInput` (name). The lift is pending Task 5; in the meantime
  // we accept either shape so the handler keeps working through the rename.
  if (typeof composed === 'object' && composed !== null) {
    const o = composed as { name?: unknown; project?: { name?: unknown } };
    if (typeof o.name === 'string') return o.name;
    if (typeof o.project?.name === 'string') return o.project.name;
  }
  return '';
}
