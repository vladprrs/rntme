import { isOk, listProjects } from '@rntme/platform-core';
import type {
  ListOrgProjectsHandlerDeps,
  ListOrgProjectsHandlerInput,
  ListOrgProjectsHandlerOutput,
} from './types.js';

type RuntimeCtx = {
  readonly qsmDb: {
    readonly prepare: <P = unknown, R = unknown>(sql: string) => {
      readonly all: (...args: unknown[]) => R[];
    };
  };
};

type ProjectRow = {
  readonly id: string;
  readonly organization_id: string;
  readonly slug: string;
  readonly display_name: string;
  readonly status: string;
  readonly created_at: string;
};

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
  depsOrInput: ListOrgProjectsHandlerDeps | ListOrgProjectsHandlerInput,
  inputOrCtx: ListOrgProjectsHandlerInput | RuntimeCtx,
): Promise<ListOrgProjectsHandlerOutput> {
  if (!isDeps(depsOrInput)) {
    return listOrgProjectsRuntimeNative(depsOrInput, inputOrCtx as RuntimeCtx);
  }

  const deps = depsOrInput;
  const input = inputOrCtx as ListOrgProjectsHandlerInput;
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

function isDeps(value: unknown): value is ListOrgProjectsHandlerDeps {
  if (value === null || typeof value !== 'object') return false;
  const provider = (value as { provider?: { authenticate?: unknown } }).provider;
  return provider !== undefined && typeof provider.authenticate === 'function';
}

function isRuntimeCtx(value: unknown): value is RuntimeCtx {
  return value !== null
    && typeof value === 'object'
    && typeof (value as { qsmDb?: { prepare?: unknown } }).qsmDb?.prepare === 'function';
}

function listOrgProjectsRuntimeNative(
  input: ListOrgProjectsHandlerInput,
  ctx: RuntimeCtx,
): ListOrgProjectsHandlerOutput {
  if (input.sessionStatus !== 'ACTIVE' || typeof input.sessionSubject !== 'string') {
    return {
      status: 'error',
      errors: [{ code: 'PLATFORM_AUTH_INVALID', message: 'active edge session is required' }],
    };
  }
  if (!isRuntimeCtx(ctx)) {
    return {
      status: 'error',
      errors: [{ code: 'PLATFORM_AUTH_INVALID', message: 'runtime project storage is not available' }],
    };
  }
  const limit = typeof input.limit === 'number' && Number.isFinite(input.limit) && input.limit > 0
    ? Math.floor(input.limit)
    : 100;
  const rows = ctx.qsmDb.prepare<[string, number], ProjectRow>(`
    SELECT
      id,
      organization_id,
      slug,
      display_name,
      status,
      created_at
    FROM projects
    WHERE organization_id = ? AND status = 'active'
    ORDER BY created_at DESC
    LIMIT ?
  `).all(input.organizationId, limit);

  return {
    status: 'ok',
    projects: rows.map((row) => ({
      id: row.id,
      orgId: row.organization_id,
      slug: row.slug,
      displayName: row.display_name,
      status: row.status as 'active',
      archivedAt: null,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.created_at),
    })),
  };
}
