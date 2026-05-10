import { gunzipSync } from 'node:zlib';
import { isOk, parseCanonicalBundle } from '@rntme/platform-core';
import { materializeBundle } from '@rntme/blueprint';
import { compose } from '../stages/compose.js';
import { redact } from '../redactor.js';
import { getPlatformHandlerContext } from './platform-context.js';
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
  const repo = ctx.stageStateRepoFor(input.orgId);
  await repo.begin({
    id: stageStateId,
    deploymentId: input.deploymentId,
    orgId: input.orgId,
    stage: 'compose',
  });

  try {
    const deployment = await ctx.deploymentRepoFor(input.orgId).getById(input.deploymentId);
    if (!isOk(deployment) || deployment.value === null) {
      throw new Error('DEPLOY_HANDLER_DEPLOYMENT_MISSING');
    }
    const projectVersion = await ctx
      .projectVersionRepoFor(input.orgId)
      .getById(deployment.value.projectVersionId);
    if (!isOk(projectVersion) || projectVersion.value === null) {
      throw new Error('DEPLOY_HANDLER_PROJECT_VERSION_MISSING');
    }

    const blobKey = projectVersion.value.bundleBlobKey;
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
    await repo.succeed({
      deploymentId: input.deploymentId,
      stage: 'compose',
      publicStateJson: JSON.stringify({ bundleDir, projectName }),
    });

    return {
      stage: 'compose',
      status: 'succeeded',
      publicSummary: { projectName },
    };
  } catch (cause) {
    const code = errorCode(cause, 'DEPLOY_COMPOSE_FAILED');
    const message = redact(errorMessage(cause));
    await repo.fail({
      deploymentId: input.deploymentId,
      stage: 'compose',
      errorCode: code,
      errorMessage: message,
    });
    return { stage: 'compose', status: 'failed', errorCode: code, errorMessage: message };
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

function errorCode(cause: unknown, fallback: string): string {
  if (
    cause instanceof Error &&
    'code' in cause &&
    typeof (cause as Error & { code: string }).code === 'string'
  ) {
    return (cause as Error & { code: string }).code;
  }
  return fallback;
}

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
