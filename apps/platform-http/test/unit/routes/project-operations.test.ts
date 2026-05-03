import { Buffer } from 'node:buffer';
import { describe, expect, it, vi } from 'vitest';
import { projectOperationRoutes } from '../../../src/routes/project-operations.js';
import { Hono } from 'hono';
import type { AuthSubject } from '@rntme/platform-core';
import { FakeStore, SeededIds, createProject, isOk } from '@rntme/platform-core';

describe('projectOperationRoutes', () => {
  it('rejects delete confirmation mismatch', async () => {
    const store = new FakeStore();
    const ids = new SeededIds(['project-1', 'operation-1']);
    const org = await store.seedOrg({ slug: 'acme', workosOrganizationId: 'org_1', displayName: 'Acme' });
    const account = await store.seedAccount({ workosUserId: 'user_1', displayName: 'Ada', email: 'ada@example.com' });
    const project = await createProject({ repos: { projects: store.projects }, ids }, { orgId: org.id, slug: 'notes-demo', displayName: 'Notes Demo' });
    if (!isOk(project)) throw new Error('seed failed');

    const app = new Hono<{ Variables: { subject: AuthSubject } }>();
    app.use('*', async (c, next) => {
      c.set('subject', {
        org: { id: org.id, workosOrgId: org.workosOrganizationId, slug: org.slug },
        account: { id: account.id, workosUserId: account.workosUserId, displayName: account.displayName, email: account.email },
        role: 'admin',
        scopes: ['project:read', 'project:delete'],
        tokenId: undefined,
      });
      c.set('tx', {} as never);
      await next();
    });
    app.route('/v1/orgs/:orgSlug/projects/:projSlug/operations', projectOperationRoutes({
      ids,
      resolveDeps: () => ({
        organizations: store.organizations,
        projects: store.projects,
        deployments: store.deployments,
        projectOperations: store.projectOperations,
        projectVersions: store.projectVersions,
        deployTargets: store.deployTargets,
      } as never),
    }));

    const res = await app.request('/v1/orgs/acme/projects/notes-demo/operations/delete', {
      method: 'POST',
      body: JSON.stringify({ confirm: 'wrong' }),
      headers: { 'content-type': 'application/json' },
    });

    expect(res.status).toBe(400);
    const json = await res.json() as { error: { code: string } };
    expect(json.error.code).toBe('PROJECT_OPERATION_CONFIRMATION_MISMATCH');
  });

  it('queues update and schedules the linked deployment', async () => {
    const scheduleDeployment = vi.fn();
    const store = new FakeStore();
    const ids = new SeededIds(['project-1', 'target-1', 'version-1', 'operation-1', 'deployment-1']);
    const org = await store.seedOrg({ slug: 'acme', workosOrganizationId: 'org_1', displayName: 'Acme' });
    const account = await store.seedAccount({ workosUserId: 'user_1', displayName: 'Ada', email: 'ada@example.com' });

    const app = await operationApp(store, ids, org, account, scheduleDeployment);
    const res = await app.request('/v1/orgs/acme/projects/notes-demo/operations/update', {
      method: 'POST',
      body: JSON.stringify({ projectVersionSeq: 1, targetSlug: 'dokploy-preview' }),
      headers: { 'content-type': 'application/json' },
    });

    expect(res.status).toBe(202);
    const json = await res.json() as { operation: { kind: string; deploymentId: string } };
    expect(json.operation.kind).toBe('update');
    expect(json.operation.deploymentId).toBe('deployment-1');
    expect(scheduleDeployment).toHaveBeenCalledWith('deployment-1', org.id);
  });
});

async function operationApp(
  store: FakeStore,
  ids: SeededIds,
  org: Awaited<ReturnType<FakeStore['seedOrg']>>,
  account: Awaited<ReturnType<FakeStore['seedAccount']>>,
  scheduleDeployment: (deploymentId: string, orgId: string) => void,
): Promise<Hono<{ Variables: { subject: AuthSubject } }>> {
  const project = await createProject({ repos: { projects: store.projects }, ids }, { orgId: org.id, slug: 'notes-demo', displayName: 'Notes Demo' });
  if (!isOk(project)) throw new Error('project seed failed');
  await store.deployTargets.create({
    row: {
      id: ids.uuid(),
      orgId: org.id,
      slug: 'dokploy-preview',
      displayName: 'Dokploy Preview',
      kind: 'dokploy',
      dokployUrl: 'https://dokploy.example.com',
      publicBaseUrl: null,
      dokployProjectId: 'dokploy-project',
      dokployProjectName: null,
      allowCreateProject: false,
      apiTokenCiphertext: Buffer.from('secret'),
      apiTokenNonce: Buffer.from('nonce'),
      apiTokenKeyVersion: 1,
      eventBusConfig: { kind: 'kafka', mode: 'external', brokers: ['redpanda:9092'] },
      modules: {},
      auth: {},
      policyValues: {},
      isDefault: true,
    },
    auditActorAccountId: account.id,
    auditActorTokenId: null,
  });
  await store.projectVersions.create({
    projectId: project.value.id,
    row: {
      id: ids.uuid(),
      orgId: org.id,
      bundleDigest: 'sha256:bundle',
      bundleBlobKey: 'projects/p/versions/bundle.json.gz',
      bundleSizeBytes: 2,
      summary: { projectName: 'notes-demo', services: [], routes: { ui: {}, http: {} }, middleware: {}, mounts: [] },
      uploadedByAccountId: account.id,
    },
    auditActorAccountId: account.id,
    auditActorTokenId: null,
  });

  const app = new Hono<{ Variables: { subject: AuthSubject } }>();
  app.use('*', async (c, next) => {
    c.set('subject', {
      org: { id: org.id, workosOrgId: org.workosOrganizationId, slug: org.slug },
      account: { id: account.id, workosUserId: account.workosUserId, displayName: account.displayName, email: account.email },
      role: 'admin',
      scopes: ['project:read', 'version:publish', 'deploy:execute', 'project:delete'],
      tokenId: undefined,
    });
    c.set('tx', {} as never);
    await next();
  });
  app.route('/v1/orgs/:orgSlug/projects/:projSlug/operations', projectOperationRoutes({
    ids,
    scheduleDeployment,
    resolveDeps: () => ({
      organizations: store.organizations,
      projects: store.projects,
      deployments: store.deployments,
      projectOperations: store.projectOperations,
      projectVersions: store.projectVersions,
      deployTargets: store.deployTargets,
    } as never),
  }));
  return app;
}
