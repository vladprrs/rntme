import { apiCall, PLATFORM_API, type ClientError } from './client.js';
import type { Result } from '../result.js';
import {
  ProjectResponseSchema,
  ProjectsListResponseSchema,
  ProjectVersionResponseSchema,
  ProjectVersionsListResponseSchema,
  TokenCreatedResponseSchema,
  TokensListResponseSchema,
  AuthMeResponseSchema,
  DeploymentResponseSchema,
  DeploymentsListResponseSchema,
  DeploymentLogsResponseSchema,
  ProjectDeleteOperationResponseSchema,
  ProjectOperationLogsResponseSchema,
  ProjectOperationResponseSchema,
  ProjectOperationsListResponseSchema,
  ProjectUpdateOperationResponseSchema,
} from './types.js';
import type {
  CreateProjectRequest,
  CreateTokenRequest,
  StartDeploymentRequest,
} from './types.js';
import { targetEndpoints } from './target-endpoints.js';

export type Ctx = { baseUrl: string; token: string | null; requestId?: string };

function enc(s: string): string {
  return encodeURIComponent(s);
}

async function deleteNoBody(
  path: string,
  c: Ctx,
): Promise<Result<void, ClientError>> {
  const { z } = await import('zod');
  const r = await apiCall({
    method: 'DELETE',
    path,
    responseSchema: z.object({}).passthrough(),
    ...c,
  });
  return r.ok ? { ok: true, value: undefined } : r;
}

export const endpoints = {
  targets: targetEndpoints,

  auth: {
    me: (c: Ctx) =>
      apiCall({ method: 'GET', path: '/v1/auth/me', responseSchema: AuthMeResponseSchema, ...c }),
  },

  tokens: {
    create: (c: Ctx, org: string, body: CreateTokenRequest) =>
      apiCall({ method: 'POST', path: `/v1/orgs/${enc(org)}/tokens`, body, responseSchema: TokenCreatedResponseSchema, ...c }),
    list: (c: Ctx, org: string) =>
      apiCall({ method: 'GET', path: `/v1/orgs/${enc(org)}/tokens`, responseSchema: TokensListResponseSchema, ...c }),
    revoke: (c: Ctx, org: string, id: string) =>
      deleteNoBody(`/v1/orgs/${enc(org)}/tokens/${enc(id)}`, c),
  },

  projects: {
    // Migrated to platform blueprint surface (`/api/projects`). The first
    // positional argument is treated as `organizationId` (a UUID) — the
    // generated bindings expect IDs, not legacy org slugs.
    create: (c: Ctx, organizationId: string, body: CreateProjectRequest) =>
      apiCall({
        method: 'POST',
        path: PLATFORM_API.projects,
        body: { organizationId, ...body },
        responseSchema: ProjectResponseSchema,
        ...c,
      }),
    list: (c: Ctx, organizationId: string, opts?: { limit?: number }) => {
      const qs = new URLSearchParams();
      qs.set('organizationId', organizationId);
      if (opts?.limit !== undefined) qs.set('limit', String(opts.limit));
      return apiCall({
        method: 'GET',
        path: `${PLATFORM_API.projects}?${qs.toString()}`,
        responseSchema: ProjectsListResponseSchema,
        ...c,
      });
    },
    // Legacy: no `/api/projects/{id}` GET binding exists yet. Kept on the
    // legacy `/v1` surface until the platform blueprint exposes a getProject
    // binding.
    show: (c: Ctx, org: string, project: string) =>
      apiCall({ method: 'GET', path: `/v1/orgs/${enc(org)}/projects/${enc(project)}`,
                responseSchema: ProjectResponseSchema, ...c }),
  },

  projectVersions: {
    // Migrated to platform blueprint surface. The `project` argument is
    // treated as a `projectId` (UUID) — the generated `listProjectVersions`
    // binding takes a path-id, not an org-slug + project-slug pair.
    list: (c: Ctx, projectId: string, opts?: { limit?: number }) => {
      const qs = new URLSearchParams();
      if (opts?.limit !== undefined) qs.set('limit', String(opts.limit));
      const suffix = qs.toString() ? `?${qs.toString()}` : '';
      return apiCall({
        method: 'GET',
        path: `${PLATFORM_API.projects}/${enc(projectId)}/versions${suffix}`,
        responseSchema: ProjectVersionsListResponseSchema,
        ...c,
      });
    },
    // Legacy: there is no platform-blueprint binding for fetching a single
    // version by sequence yet. Kept on `/v1` until exposed.
    show: (c: Ctx, org: string, project: string, seq: number) =>
      apiCall({
        method: 'GET',
        path: `/v1/orgs/${enc(org)}/projects/${enc(project)}/versions/${seq}`,
        responseSchema: ProjectVersionResponseSchema,
        ...c,
      }),
    // Migrated. Path uses projectId; the legacy CLI passed raw bundle bytes
    // and the platform server accepted them — that semantic still flows
    // through the `application/rntme-project-bundle+json` content type. The
    // generated binding expects `{sequence, bundleDigest, bundleObjectKey}`
    // in JSON; bridging that bundle->binding shape is a server-side concern,
    // not the CLI's. The CLI continues to send the bundle bytes as before.
    publishBundle: (c: Ctx, projectId: string, bytes: string) =>
      apiCall({
        method: 'POST',
        path: `${PLATFORM_API.projects}/${enc(projectId)}/versions`,
        rawBody: bytes,
        contentType: 'application/rntme-project-bundle+json',
        responseSchema: ProjectVersionResponseSchema,
        timeoutMs: 120_000,
        ...c,
      }),
  },

  deployments: {
    // Migrated. `organizationId` and `projectId` are now UUIDs — the new
    // `queueDeployment` binding takes them via the request body.
    start: (
      c: Ctx,
      organizationId: string,
      projectId: string,
      body: StartDeploymentRequest,
    ) =>
      apiCall({
        method: 'POST',
        path: PLATFORM_API.deployments,
        body: { organizationId, projectId, ...body },
        responseSchema: DeploymentResponseSchema,
        ...c,
      }),
    list: (
      c: Ctx,
      organizationId: string,
      projectId: string,
      opts?: { limit?: number },
    ) => {
      const qs = new URLSearchParams();
      qs.set('organizationId', organizationId);
      qs.set('projectId', projectId);
      if (opts?.limit !== undefined) qs.set('limit', String(opts.limit));
      return apiCall({
        method: 'GET',
        path: `${PLATFORM_API.deployments}?${qs.toString()}`,
        responseSchema: DeploymentsListResponseSchema,
        ...c,
      });
    },
    show: (c: Ctx, deploymentId: string) =>
      apiCall({
        method: 'GET',
        path: `${PLATFORM_API.deployments}/${enc(deploymentId)}`,
        responseSchema: DeploymentResponseSchema,
        ...c,
      }),
    // Migrated. The platform `readDeploymentLogs` binding lives at
    // `/api/deployments/{deploymentId}/logs` and takes only `limit` (no
    // `sinceLineId` cursor yet). The CLI keeps the `sinceLineId` parameter
    // for backwards-compatible client-side filtering until the binding adds
    // a cursor.
    logs: (
      c: Ctx,
      deploymentId: string,
      opts: { sinceLineId: number; limit: number },
    ) => {
      const qs = new URLSearchParams();
      qs.set('sinceLineId', String(opts.sinceLineId));
      qs.set('limit', String(opts.limit));
      return apiCall({
        method: 'GET',
        path: `${PLATFORM_API.deployments}/${enc(deploymentId)}/logs?${qs.toString()}`,
        responseSchema: DeploymentLogsResponseSchema,
        ...c,
      });
    },
  },

  projectOperations: {
    update: (c: Ctx, org: string, project: string, body: { projectVersionSeq: number; targetSlug: string }) =>
      apiCall({
        method: 'POST',
        path: `/v1/orgs/${enc(org)}/projects/${enc(project)}/operations/update`,
        body,
        responseSchema: ProjectUpdateOperationResponseSchema,
        ...c,
      }),
    delete: (c: Ctx, org: string, project: string, body: { confirm: string }) =>
      apiCall({
        method: 'POST',
        path: `/v1/orgs/${enc(org)}/projects/${enc(project)}/operations/delete`,
        body,
        responseSchema: ProjectDeleteOperationResponseSchema,
        ...c,
      }),
    list: (c: Ctx, org: string, project: string, opts?: { limit?: number }) => {
      const qs = new URLSearchParams();
      if (opts?.limit) qs.set('limit', String(opts.limit));
      const suffix = qs.toString() ? `?${qs.toString()}` : '';
      return apiCall({
        method: 'GET',
        path: `/v1/orgs/${enc(org)}/projects/${enc(project)}/operations${suffix}`,
        responseSchema: ProjectOperationsListResponseSchema,
        ...c,
      });
    },
    show: (c: Ctx, org: string, project: string, operationId: string) =>
      apiCall({
        method: 'GET',
        path: `/v1/orgs/${enc(org)}/projects/${enc(project)}/operations/${enc(operationId)}`,
        responseSchema: ProjectOperationResponseSchema,
        ...c,
      }),
    logs: (c: Ctx, org: string, project: string, operationId: string, opts: { sinceLineId: number; limit: number }) => {
      const qs = new URLSearchParams();
      qs.set('sinceLineId', String(opts.sinceLineId));
      qs.set('limit', String(opts.limit));
      return apiCall({
        method: 'GET',
        path: `/v1/orgs/${enc(org)}/projects/${enc(project)}/operations/${enc(operationId)}/logs?${qs.toString()}`,
        responseSchema: ProjectOperationLogsResponseSchema,
        ...c,
      });
    },
  },

};
