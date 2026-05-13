import { isOk, listProjects } from '@rntme/platform-core';
import type {
  ListOrgProjectsHandlerDeps,
  ListOrgProjectsHandlerInput,
  ListOrgProjectsHandlerOutput,
} from './types.js';

/**
 * Native handler for GET /api/projects?organizationId=<id|slug|workosId>.
 *
 * Authenticates the request via the platform API-token provider, verifies the
 * supplied `organizationId` resolves to the same platform org as the
 * authenticated subject (accepts platform id, slug, or WorkOS id), then
 * returns the active projects for that org via the `listProjects` use-case.
 *
 * Archived projects are excluded by default to match the listing semantics
 * the dashboard surface needs.
 */
export async function listOrgProjectsHandler(
  deps: ListOrgProjectsHandlerDeps,
  input: ListOrgProjectsHandlerInput,
): Promise<ListOrgProjectsHandlerOutput> {
  const auth = await deps.provider.authenticate({
    authorizationHeader: input.authorization,
    cookieHeader: undefined,
  });
  if (!isOk(auth)) return { status: 'error', errors: auth.errors };
  const subject = auth.value;

  const byId = await deps.repos.organizations.findById(input.organizationId);
  if (!isOk(byId)) return { status: 'error', errors: byId.errors };
  let resolved = byId.value;
  if (!resolved) {
    const bySlug = await deps.repos.organizations.findBySlug(input.organizationId);
    if (!isOk(bySlug)) return { status: 'error', errors: bySlug.errors };
    resolved = bySlug.value;
  }
  if (!resolved) {
    const byWorkos = await deps.repos.organizations.findByWorkosId(input.organizationId);
    if (!isOk(byWorkos)) return { status: 'error', errors: byWorkos.errors };
    resolved = byWorkos.value;
  }
  if (!resolved) {
    return {
      status: 'error',
      errors: [{ code: 'PLATFORM_TENANCY_ORG_NOT_FOUND', message: input.organizationId }],
    };
  }
  if (resolved.id !== subject.org.id) {
    return {
      status: 'error',
      errors: [{ code: 'PLATFORM_AUTH_FORBIDDEN', message: 'organization does not match subject' }],
    };
  }

  const result = await listProjects(
    { repos: { projects: deps.repos.projects } },
    { orgId: resolved.id, includeArchived: false },
  );
  if (!isOk(result)) return { status: 'error', errors: result.errors };

  const limit = typeof input.limit === 'number' && Number.isFinite(input.limit) && input.limit > 0
    ? Math.floor(input.limit)
    : 100;
  const projects = result.value.slice(0, limit);
  return { status: 'ok', projects };
}
