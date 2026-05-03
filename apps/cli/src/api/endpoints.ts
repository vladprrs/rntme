import { apiCall, type ClientError } from './client.js';
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
    create: (c: Ctx, org: string, body: CreateProjectRequest) =>
      apiCall({ method: 'POST', path: `/v1/orgs/${enc(org)}/projects`, body, responseSchema: ProjectResponseSchema, ...c }),
    list: (c: Ctx, org: string, opts?: { includeArchived?: boolean }) =>
      apiCall({
        method: 'GET',
        path: `/v1/orgs/${enc(org)}/projects${opts?.includeArchived ? '?includeArchived=1' : ''}`,
        responseSchema: ProjectsListResponseSchema,
        ...c,
      }),
    show: (c: Ctx, org: string, project: string) =>
      apiCall({ method: 'GET', path: `/v1/orgs/${enc(org)}/projects/${enc(project)}`,
                responseSchema: ProjectResponseSchema, ...c }),
  },

  projectVersions: {
    list: (c: Ctx, org: string, project: string, opts?: { limit?: number; cursor?: string }) => {
      const qs = new URLSearchParams();
      if (opts?.limit) qs.set('limit', String(opts.limit));
      if (opts?.cursor) qs.set('cursor', opts.cursor);
      const suffix = qs.toString() ? `?${qs.toString()}` : '';
      return apiCall({
        method: 'GET',
        path: `/v1/orgs/${enc(org)}/projects/${enc(project)}/versions${suffix}`,
        responseSchema: ProjectVersionsListResponseSchema,
        ...c,
      });
    },
    show: (c: Ctx, org: string, project: string, seq: number) =>
      apiCall({
        method: 'GET',
        path: `/v1/orgs/${enc(org)}/projects/${enc(project)}/versions/${seq}`,
        responseSchema: ProjectVersionResponseSchema,
        ...c,
      }),
    publishBundle: (c: Ctx, org: string, project: string, bytes: string) =>
      apiCall({
        method: 'POST',
        path: `/v1/orgs/${enc(org)}/projects/${enc(project)}/versions`,
        rawBody: bytes,
        contentType: 'application/rntme-project-bundle+json',
        responseSchema: ProjectVersionResponseSchema,
        timeoutMs: 120_000,
        ...c,
      }),
  },

  deployments: {
    start: (c: Ctx, org: string, project: string, body: StartDeploymentRequest) =>
      apiCall({
        method: 'POST',
        path: `/v1/orgs/${enc(org)}/projects/${enc(project)}/deployments`,
        body,
        responseSchema: DeploymentResponseSchema,
        ...c,
      }),
    list: (c: Ctx, org: string, project: string, opts?: { limit?: number }) => {
      const qs = new URLSearchParams();
      if (opts?.limit) qs.set('limit', String(opts.limit));
      const suffix = qs.toString() ? `?${qs.toString()}` : '';
      return apiCall({
        method: 'GET',
        path: `/v1/orgs/${enc(org)}/projects/${enc(project)}/deployments${suffix}`,
        responseSchema: DeploymentsListResponseSchema,
        ...c,
      });
    },
    show: (c: Ctx, org: string, project: string, deploymentId: string) =>
      apiCall({
        method: 'GET',
        path: `/v1/orgs/${enc(org)}/projects/${enc(project)}/deployments/${enc(deploymentId)}`,
        responseSchema: DeploymentResponseSchema,
        ...c,
      }),
    logs: (c: Ctx, org: string, project: string, deploymentId: string, opts: { sinceLineId: number; limit: number }) => {
      const qs = new URLSearchParams();
      qs.set('sinceLineId', String(opts.sinceLineId));
      qs.set('limit', String(opts.limit));
      return apiCall({
        method: 'GET',
        path: `/v1/orgs/${enc(org)}/projects/${enc(project)}/deployments/${enc(deploymentId)}/logs?${qs.toString()}`,
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
