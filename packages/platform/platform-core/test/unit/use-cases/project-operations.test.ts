import { describe, expect, it } from 'vitest';
import {
  FakeStore,
  SeededIds,
  createProject,
  createDeployTarget,
  publishProjectVersion,
  startProjectDeleteOperation,
  startProjectUpdateOperation,
  finalizeProjectOperation,
  isOk,
  type SecretCipher,
} from '../../../src/index.js';

const cipher: SecretCipher = {
  encrypt: (plaintext) => ({
    ciphertext: Buffer.from(`cipher:${plaintext}`),
    nonce: Buffer.from('nonce'),
    keyVersion: 1,
  }),
  decrypt: (encrypted) => encrypted.ciphertext.toString('utf8').replace(/^cipher:/, ''),
};

async function setup() {
  const store = new FakeStore();
  const ids = new SeededIds([
    'project-1',
    'target-1',
    'version-1',
    'operation-1',
    'deployment-1',
    'operation-2',
    'deployment-2',
  ]);
  const org = await store.seedOrg({ slug: 'acme', workosOrganizationId: 'org_1', displayName: 'Acme' });
  const account = await store.seedAccount({ workosUserId: 'user_1', displayName: 'Ada', email: 'ada@example.com' });
  const project = await createProject({ repos: { projects: store.projects }, ids }, {
    orgId: org.id,
    slug: 'notes-demo',
    displayName: 'Notes Demo',
  });
  if (!isOk(project)) throw new Error('project seed failed');
  const target = await createDeployTarget({ repos: { deployTargets: store.deployTargets }, cipher, ids }, {
    orgId: org.id,
    accountId: account.id,
    tokenId: null,
    req: {
      slug: 'dokploy-preview',
      displayName: 'Dokploy Preview',
      kind: 'dokploy',
      dokployUrl: 'https://dokploy.example.com',
      dokployProjectId: 'dokploy-project-1',
      allowCreateProject: false,
      apiToken: 'secret',
      eventBus: { kind: 'kafka', mode: 'external', brokers: ['redpanda:9092'] },
      modules: {},
      auth: {},
      policyValues: {},
      isDefault: true,
    },
  });
  if (!isOk(target)) throw new Error('target seed failed');
  const version = await publishProjectVersion(
    { repos: { projects: store.projects, projectVersions: store.projectVersions }, blob: store.blob, ids },
    {
      orgId: org.id,
      projectId: project.value.id,
      accountId: account.id,
      tokenId: null,
      bundleBytes: Buffer.from('{"files":{}}'),
      bundleDigest: 'sha256:bundle',
      summary: { projectName: 'notes-demo', services: [], routes: { ui: {}, http: {} }, middleware: {}, mounts: [] },
    },
  );
  if (!isOk(version)) throw new Error('version seed failed');
  return { store, ids, org, account, project: project.value, target: target.value, version: version.value };
}

describe('project operations use-cases', () => {
  it('starts update using an explicit target and creates a linked deployment', async () => {
    const { store, ids, org, account, project, version } = await setup();

    const r = await startProjectUpdateOperation(
      { repos: { projects: store.projects, projectVersions: store.projectVersions, deployTargets: store.deployTargets, deployments: store.deployments, projectOperations: store.projectOperations }, ids },
      {
        orgId: org.id,
        projectId: project.id,
        accountId: account.id,
        tokenId: null,
        req: { projectVersionSeq: version.seq, targetSlug: 'dokploy-preview' },
      },
    );

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.operation.kind).toBe('update');
    expect(r.value.operation.deploymentId).toBe('deployment-1');
    expect(r.value.deployment?.projectVersionId).toBe(version.id);
  });

  it('rejects update when a deployment is active for the same target', async () => {
    const { store, ids, org, account, project, version } = await setup();
    await startProjectUpdateOperation(
      { repos: { projects: store.projects, projectVersions: store.projectVersions, deployTargets: store.deployTargets, deployments: store.deployments, projectOperations: store.projectOperations }, ids },
      {
        orgId: org.id,
        projectId: project.id,
        accountId: account.id,
        tokenId: null,
        req: { projectVersionSeq: version.seq, targetSlug: 'dokploy-preview' },
      },
    );

    const r = await startProjectUpdateOperation(
      { repos: { projects: store.projects, projectVersions: store.projectVersions, deployTargets: store.deployTargets, deployments: store.deployments, projectOperations: store.projectOperations }, ids },
      {
        orgId: org.id,
        projectId: project.id,
        accountId: account.id,
        tokenId: null,
        req: { projectVersionSeq: version.seq, targetSlug: 'dokploy-preview' },
      },
    );

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.code).toBe('PROJECT_OPERATION_ACTIVE_DEPLOYMENT');
  });

  it('rejects a second update while a project operation is still live', async () => {
    const { store, ids, org, account, project, version } = await setup();
    const first = await startProjectUpdateOperation(
      { repos: { projects: store.projects, projectVersions: store.projectVersions, deployTargets: store.deployTargets, deployments: store.deployments, projectOperations: store.projectOperations }, ids },
      {
        orgId: org.id,
        projectId: project.id,
        accountId: account.id,
        tokenId: null,
        req: { projectVersionSeq: version.seq, targetSlug: 'dokploy-preview' },
      },
    );
    if (!isOk(first)) throw new Error('first update failed');
    await store.deployments.finalize(first.value.deployment.id, { status: 'succeeded' });

    const r = await startProjectUpdateOperation(
      { repos: { projects: store.projects, projectVersions: store.projectVersions, deployTargets: store.deployTargets, deployments: store.deployments, projectOperations: store.projectOperations }, ids },
      {
        orgId: org.id,
        projectId: project.id,
        accountId: account.id,
        tokenId: null,
        req: { projectVersionSeq: version.seq, targetSlug: 'dokploy-preview' },
      },
    );

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.code).toBe('PROJECT_OPERATION_INVALID_STATE');
  });

  it('starts delete and moves the project to deleting', async () => {
    const { store, ids, org, account, project } = await setup();

    const r = await startProjectDeleteOperation(
      { repos: { projects: store.projects, deployments: store.deployments, projectOperations: store.projectOperations }, ids },
      {
        orgId: org.id,
        projectId: project.id,
        projectSlug: project.slug,
        accountId: account.id,
        tokenId: null,
        req: { confirm: project.slug },
      },
    );

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.operation.kind).toBe('delete');
    const updated = await store.projects.findById(org.id, project.id);
    expect(isOk(updated) && updated.value?.status).toBe('deleting');
  });

  it('rejects delete confirmation mismatch', async () => {
    const { store, ids, org, account, project } = await setup();

    const r = await startProjectDeleteOperation(
      { repos: { projects: store.projects, deployments: store.deployments, projectOperations: store.projectOperations }, ids },
      {
        orgId: org.id,
        projectId: project.id,
        projectSlug: project.slug,
        accountId: account.id,
        tokenId: null,
        req: { confirm: 'wrong-project' },
      },
    );

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.code).toBe('PROJECT_OPERATION_CONFIRMATION_MISMATCH');
  });

  it('finalizes delete success as project decommissioned', async () => {
    const { store, ids, org, account, project } = await setup();
    const queued = await startProjectDeleteOperation(
      { repos: { projects: store.projects, deployments: store.deployments, projectOperations: store.projectOperations }, ids },
      {
        orgId: org.id,
        projectId: project.id,
        projectSlug: project.slug,
        accountId: account.id,
        tokenId: null,
        req: { confirm: project.slug },
      },
    );
    if (!isOk(queued)) throw new Error('queue failed');

    const done = await finalizeProjectOperation(
      { repos: { projects: store.projects, projectOperations: store.projectOperations } },
      {
        operationId: queued.value.operation.id,
        status: 'succeeded',
        result: { deletedResources: 3 },
      },
    );

    expect(done.ok).toBe(true);
    const updated = await store.projects.findById(org.id, project.id);
    expect(isOk(updated) && updated.value?.status).toBe('decommissioned');
  });
});
