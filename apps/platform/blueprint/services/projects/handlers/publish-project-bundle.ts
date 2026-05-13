import { Buffer } from 'node:buffer';
import { isOk, publishProjectVersionFromBundleBytes } from '@rntme/platform-core';
import type {
  PublishProjectBundleHandlerDeps,
  PublishProjectBundleHandlerInput,
  PublishProjectBundleHandlerOutput,
} from './types.js';

/**
 * Native handler for POST /api/projects/{projectId}/versions.
 *
 * Authenticates with the platform API-token provider via the `authorization`
 * header, resolves the project (id or slug under the authenticated org), then
 * delegates to `publishProjectVersionFromBundleBytes` with the raw canonical
 * bundle bytes. Returns the created (or matching, by digest) ProjectVersion.
 */
export async function publishProjectBundleHandler(
  deps: PublishProjectBundleHandlerDeps,
  input: PublishProjectBundleHandlerInput,
): Promise<PublishProjectBundleHandlerOutput> {
  const auth = await deps.provider.authenticate({
    authorizationHeader: input.authorization,
    cookieHeader: undefined,
  });
  if (!isOk(auth)) {
    return { status: 'error', errors: auth.errors };
  }
  const subject = auth.value;

  // Resolve project id-or-slug under the authenticated org.
  const orgId = subject.org.id;
  const byId = await deps.repos.projects.findById(orgId, input.projectId);
  if (!isOk(byId)) return { status: 'error', errors: byId.errors };
  let projectRow = byId.value;
  if (!projectRow) {
    const bySlug = await deps.repos.projects.findBySlug(orgId, input.projectId);
    if (!isOk(bySlug)) return { status: 'error', errors: bySlug.errors };
    projectRow = bySlug.value;
  }
  if (!projectRow) {
    return {
      status: 'error',
      errors: [{ code: 'PLATFORM_TENANCY_PROJECT_NOT_FOUND', message: input.projectId }],
    };
  }

  const bundleBytes = Buffer.from(input.bodyBytes.buffer, input.bodyBytes.byteOffset, input.bodyBytes.byteLength);

  const result = await publishProjectVersionFromBundleBytes(
    {
      repos: { projects: deps.repos.projects, projectVersions: deps.repos.projectVersions },
      blob: deps.blob,
      ids: deps.ids,
    },
    {
      orgId,
      projectId: projectRow.id,
      accountId: subject.account.id,
      tokenId: subject.tokenId ?? null,
      bundleBytes,
    },
  );
  if (!isOk(result)) {
    return { status: 'error', errors: result.errors };
  }
  return { status: 'created', version: result.value };
}
