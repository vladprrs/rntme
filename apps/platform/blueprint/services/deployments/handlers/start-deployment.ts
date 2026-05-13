import { isOk, startProjectUpdateOperation } from '@rntme/platform-core';
import { resolveAuthorizedOrg } from './shared.js';
import type {
  StartDeploymentHandlerDeps,
  StartDeploymentHandlerInput,
  StartDeploymentHandlerOutput,
} from './types.js';

/**
 * Native handler for POST /api/deployments.
 *
 * Authenticates with the platform API-token provider, resolves the
 * organization (id, slug, or WorkOS org id), the project (id or slug under
 * that org), then delegates to `startProjectUpdateOperation` which creates a
 * ProjectOperation + a queued Deployment row. The platform's BPMN/native
 * deploy-runner picks the queued deployment up from there.
 */
export async function startDeploymentHandler(
  deps: StartDeploymentHandlerDeps,
  input: StartDeploymentHandlerInput,
): Promise<StartDeploymentHandlerOutput> {
  const authz = await resolveAuthorizedOrg({
    provider: deps.provider,
    organizations: deps.repos.organizations,
    authorization: input.authorization,
    organizationId: input.organizationId,
  });
  if (authz.status !== 'ok') return { status: 'error', errors: authz.errors };
  const { subject, orgId } = authz;

  const byId = await deps.repos.projects.findById(orgId, input.projectId);
  if (!isOk(byId)) return { status: 'error', errors: byId.errors };
  let project = byId.value;
  if (!project) {
    const bySlug = await deps.repos.projects.findBySlug(orgId, input.projectId);
    if (!isOk(bySlug)) return { status: 'error', errors: bySlug.errors };
    project = bySlug.value;
  }
  if (!project) {
    return {
      status: 'error',
      errors: [{ code: 'PLATFORM_TENANCY_PROJECT_NOT_FOUND', message: input.projectId }],
    };
  }

  const result = await startProjectUpdateOperation(
    {
      repos: {
        projects: deps.repos.projects,
        projectVersions: deps.repos.projectVersions,
        deployTargets: deps.repos.deployTargets,
        deployments: deps.repos.deployments,
        projectOperations: deps.repos.projectOperations,
      },
      ids: deps.ids,
    },
    {
      orgId,
      projectId: project.id,
      accountId: subject.account.id,
      tokenId: subject.tokenId ?? null,
      req: {
        targetSlug: input.targetSlug,
        projectVersionSeq: input.projectVersionSeq,
      },
    },
  );
  if (!isOk(result)) return { status: 'error', errors: result.errors };
  return {
    status: 'started',
    operation: result.value.operation,
    deployment: result.value.deployment,
  };
}
