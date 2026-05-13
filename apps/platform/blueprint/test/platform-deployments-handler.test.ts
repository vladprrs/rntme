import { describe, expect, it } from 'bun:test';
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import {
  ApiTokenProvider,
  canonicalize,
  FakeStore,
  RandomIds,
  type CreateDeployTargetRequest,
  type EncryptedSecret,
  type SecretCipher,
} from '@rntme/platform-core';
import {
  createDeployTargetHandler,
  deleteDeployTargetHandler,
  getDeployTargetHandler,
  listDeployTargetsHandler,
  updateDeployTargetHandler,
} from '../services/deployments/handlers/deploy-targets.js';
import { startDeploymentHandler } from '../services/deployments/handlers/start-deployment.js';

class IdentityCipher implements SecretCipher {
  encrypt(plaintext: string): EncryptedSecret {
    return {
      ciphertext: Buffer.from(plaintext, 'utf8'),
      nonce: Buffer.alloc(12, 0),
      keyVersion: 1,
    };
  }
  decrypt(secret: EncryptedSecret): string {
    return Buffer.from(secret.ciphertext).toString('utf8');
  }
}

async function setup(): Promise<{
  store: FakeStore;
  provider: ApiTokenProvider;
  plain: string;
  orgId: string;
  orgSlug: string;
  workosOrgId: string;
  projectId: string;
  cipher: SecretCipher;
}> {
  const store = new FakeStore();
  const org = await store.seedOrg({
    slug: 'acme',
    workosOrganizationId: 'org_workos_acme',
    displayName: 'Acme',
  });
  const acct = await store.seedAccount({
    workosUserId: 'user_workos_a',
    email: null,
    displayName: 'A',
  });
  await store.membershipMirror.upsert({ orgId: org.id, accountId: acct.id, role: 'admin' });
  const plain = 'rntme_pat_' + 'b'.repeat(22);
  const hash = new Uint8Array(createHash('sha256').update(plain).digest());
  await store.tokensRepo.create({
    id: 'tok-deploy',
    orgId: org.id,
    accountId: acct.id,
    name: 'cli',
    tokenHash: hash,
    prefix: plain.slice(0, 12),
    scopes: ['project:write'],
    expiresAt: null,
  });
  const projectCreate = await store.projects.create({
    id: 'proj-1',
    orgId: org.id,
    slug: 'cv-extract',
    displayName: 'CV Extract',
  });
  if (!projectCreate.ok) throw new Error('failed to seed project');

  const provider = new ApiTokenProvider({
    tokens: store.tokensRepo,
    organizations: store.organizations,
    accounts: store.accountsRepo,
    memberships: store.membershipMirror,
  });

  return {
    store,
    provider,
    plain,
    orgId: org.id,
    orgSlug: org.slug,
    workosOrgId: org.workosOrganizationId,
    projectId: projectCreate.value.id,
    cipher: new IdentityCipher(),
  };
}

function makeCreateTargetReq(overrides: Partial<CreateDeployTargetRequest> = {}): CreateDeployTargetRequest {
  return {
    slug: 'prod',
    displayName: 'Prod',
    kind: 'dokploy',
    dokployUrl: 'https://dokploy.example.com',
    publicBaseUrl: undefined,
    dokployProjectId: 'dokploy-proj-1',
    dokployProjectName: undefined,
    allowCreateProject: false,
    apiToken: 'secret-token',
    eventBus: { kind: 'kafka', mode: 'external', brokers: ['localhost:9092'] },
    modules: {},
    workflows: null,
    storage: { mode: 'external' },
    auth: {},
    policyValues: {},
    manualAccess: {},
    isDefault: true,
    ...overrides,
  } as CreateDeployTargetRequest;
}

async function seedTarget(
  ctx: Awaited<ReturnType<typeof setup>>,
  overrides: Partial<CreateDeployTargetRequest> = {},
): Promise<void> {
  const created = await createDeployTargetHandler(
    {
      provider: ctx.provider,
      repos: { organizations: ctx.store.organizations, deployTargets: ctx.store.deployTargets },
      cipher: ctx.cipher,
      ids: new RandomIds(),
    },
    {
      authorization: `Bearer ${ctx.plain}`,
      organizationId: ctx.orgId,
      body: makeCreateTargetReq(overrides),
    },
  );
  if (created.status !== 'created') {
    throw new Error(`seedTarget failed: ${JSON.stringify(created)}`);
  }
}

function makeBundleBytes(): Uint8Array {
  const bundle = {
    version: 2,
    files: {
      'project.json': { name: 'cv-extract', services: ['app'], routes: { ui: {}, http: {} }, middleware: {}, mounts: [] },
    },
  };
  const buf = Buffer.from(canonicalize(bundle), 'utf8');
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
}

describe('deploy-target CRUD handlers', () => {
  it('createDeployTargetHandler creates a target for the authorized org', async () => {
    const ctx = await setup();
    const out = await createDeployTargetHandler(
      {
        provider: ctx.provider,
        repos: { organizations: ctx.store.organizations, deployTargets: ctx.store.deployTargets },
        cipher: ctx.cipher,
        ids: new RandomIds(),
      },
      {
        authorization: `Bearer ${ctx.plain}`,
        organizationId: ctx.orgId,
        body: makeCreateTargetReq(),
      },
    );
    expect(out.status).toBe('created');
    if (out.status !== 'created') return;
    expect(out.target.slug).toBe('prod');
    expect(out.target.orgId).toBe(ctx.orgId);
    expect(out.target.apiTokenRedacted).toBe('***');
  });

  it('createDeployTargetHandler accepts org slug and workos org id', async () => {
    const ctx = await setup();
    const out = await createDeployTargetHandler(
      {
        provider: ctx.provider,
        repos: { organizations: ctx.store.organizations, deployTargets: ctx.store.deployTargets },
        cipher: ctx.cipher,
        ids: new RandomIds(),
      },
      {
        authorization: `Bearer ${ctx.plain}`,
        organizationId: ctx.orgSlug,
        body: makeCreateTargetReq({ slug: 'staging', isDefault: false }),
      },
    );
    expect(out.status).toBe('created');
    if (out.status !== 'created') return;
    expect(out.target.slug).toBe('staging');
  });

  it('listDeployTargetsHandler returns targets for the authorized org', async () => {
    const ctx = await setup();
    await seedTarget(ctx);
    const out = await listDeployTargetsHandler(
      {
        provider: ctx.provider,
        repos: { organizations: ctx.store.organizations, deployTargets: ctx.store.deployTargets },
        cipher: ctx.cipher,
        ids: new RandomIds(),
      },
      { authorization: `Bearer ${ctx.plain}`, organizationId: ctx.orgId },
    );
    expect(out.status).toBe('ok');
    if (out.status !== 'ok') return;
    expect(out.targets).toHaveLength(1);
    expect(out.targets[0]?.slug).toBe('prod');
  });

  it('getDeployTargetHandler returns the matching target or not_found', async () => {
    const ctx = await setup();
    await seedTarget(ctx);

    const ok = await getDeployTargetHandler(
      {
        provider: ctx.provider,
        repos: { organizations: ctx.store.organizations, deployTargets: ctx.store.deployTargets },
        cipher: ctx.cipher,
        ids: new RandomIds(),
      },
      { authorization: `Bearer ${ctx.plain}`, slug: 'prod' },
    );
    expect(ok.status).toBe('ok');

    const missing = await getDeployTargetHandler(
      {
        provider: ctx.provider,
        repos: { organizations: ctx.store.organizations, deployTargets: ctx.store.deployTargets },
        cipher: ctx.cipher,
        ids: new RandomIds(),
      },
      { authorization: `Bearer ${ctx.plain}`, slug: 'nope' },
    );
    expect(missing.status).toBe('not_found');
  });

  it('updateDeployTargetHandler delegates to the use-case', async () => {
    const ctx = await setup();
    await seedTarget(ctx);
    // FakeStore deployTargets.update returns an error; we only assert the
    // handler propagates the result and resolves the right org/slug pair.
    const out = await updateDeployTargetHandler(
      {
        provider: ctx.provider,
        repos: { organizations: ctx.store.organizations, deployTargets: ctx.store.deployTargets },
        cipher: ctx.cipher,
        ids: new RandomIds(),
      },
      {
        authorization: `Bearer ${ctx.plain}`,
        slug: 'prod',
        body: { displayName: 'Prod Renamed' },
      },
    );
    // FakeStore update is unimplemented; we expect an error result, not a throw.
    expect(out.status).toBe('error');
  });

  it('deleteDeployTargetHandler removes a target for the authorized subject', async () => {
    const ctx = await setup();
    await seedTarget(ctx);
    const out = await deleteDeployTargetHandler(
      {
        provider: ctx.provider,
        repos: { organizations: ctx.store.organizations, deployTargets: ctx.store.deployTargets },
        cipher: ctx.cipher,
        ids: new RandomIds(),
      },
      { authorization: `Bearer ${ctx.plain}`, slug: 'prod' },
    );
    expect(out.status).toBe('deleted');
    if (out.status !== 'deleted') return;
    expect(out.slug).toBe('prod');
  });

  it('rejects requests with an invalid bearer token', async () => {
    const ctx = await setup();
    const out = await listDeployTargetsHandler(
      {
        provider: ctx.provider,
        repos: { organizations: ctx.store.organizations, deployTargets: ctx.store.deployTargets },
        cipher: ctx.cipher,
        ids: new RandomIds(),
      },
      {
        authorization: `Bearer rntme_pat_${'z'.repeat(22)}`,
        organizationId: ctx.orgId,
      },
    );
    expect(out.status).toBe('error');
    if (out.status !== 'error') return;
    expect(out.errors[0]?.code).toBe('PLATFORM_AUTH_INVALID');
  });

  it('rejects when organizationId does not match the authenticated subject', async () => {
    const ctx = await setup();
    const otherOrg = await ctx.store.seedOrg({
      slug: 'other',
      workosOrganizationId: 'org_workos_other',
      displayName: 'Other',
    });
    const out = await listDeployTargetsHandler(
      {
        provider: ctx.provider,
        repos: { organizations: ctx.store.organizations, deployTargets: ctx.store.deployTargets },
        cipher: ctx.cipher,
        ids: new RandomIds(),
      },
      { authorization: `Bearer ${ctx.plain}`, organizationId: otherOrg.id },
    );
    expect(out.status).toBe('error');
    if (out.status !== 'error') return;
    expect(out.errors[0]?.code).toBe('PLATFORM_AUTH_FORBIDDEN');
  });
});

describe('startDeploymentHandler', () => {
  async function publishVersion(ctx: Awaited<ReturnType<typeof setup>>): Promise<number> {
    const ids = new RandomIds();
    // Seed a project version directly through the platform-core use-case via the
    // publish handler so the start-deployment handler has a real seq to point at.
    const { publishProjectVersionFromBundleBytes } = await import('@rntme/platform-core');
    const out = await publishProjectVersionFromBundleBytes(
      {
        repos: { projects: ctx.store.projects, projectVersions: ctx.store.projectVersions },
        blob: ctx.store.blob,
        ids,
      },
      {
        orgId: ctx.orgId,
        projectId: ctx.projectId,
        accountId: 'acc-1',
        tokenId: null,
        bundleBytes: Buffer.from(makeBundleBytes()),
      },
    );
    if (!out.ok) throw new Error(JSON.stringify(out.errors));
    return out.value.seq;
  }

  it('creates a ProjectOperation + queued Deployment when authorized', async () => {
    const ctx = await setup();
    await seedTarget(ctx);
    const seq = await publishVersion(ctx);

    const out = await startDeploymentHandler(
      {
        provider: ctx.provider,
        repos: {
          organizations: ctx.store.organizations,
          projects: ctx.store.projects,
          projectVersions: ctx.store.projectVersions,
          deployTargets: ctx.store.deployTargets,
          deployments: ctx.store.deployments,
          projectOperations: ctx.store.projectOperations,
        },
        ids: new RandomIds(),
      },
      {
        authorization: `Bearer ${ctx.plain}`,
        organizationId: ctx.orgId,
        projectId: ctx.projectId,
        projectVersionSeq: seq,
        targetSlug: 'prod',
      },
    );

    expect(out.status).toBe('started');
    if (out.status !== 'started') return;
    expect(out.operation.kind).toBe('update');
    expect(out.operation.projectId).toBe(ctx.projectId);
    expect(out.deployment.status).toBe('queued');
    expect(out.deployment.projectId).toBe(ctx.projectId);
  });

  it('resolves project by slug and organization by workos id', async () => {
    const ctx = await setup();
    await seedTarget(ctx);
    const seq = await publishVersion(ctx);

    const out = await startDeploymentHandler(
      {
        provider: ctx.provider,
        repos: {
          organizations: ctx.store.organizations,
          projects: ctx.store.projects,
          projectVersions: ctx.store.projectVersions,
          deployTargets: ctx.store.deployTargets,
          deployments: ctx.store.deployments,
          projectOperations: ctx.store.projectOperations,
        },
        ids: new RandomIds(),
      },
      {
        authorization: `Bearer ${ctx.plain}`,
        organizationId: ctx.workosOrgId,
        projectId: 'cv-extract',
        projectVersionSeq: seq,
        targetSlug: 'prod',
      },
    );

    expect(out.status).toBe('started');
  });

  it('returns error when the requested project version does not exist', async () => {
    const ctx = await setup();
    await seedTarget(ctx);

    const out = await startDeploymentHandler(
      {
        provider: ctx.provider,
        repos: {
          organizations: ctx.store.organizations,
          projects: ctx.store.projects,
          projectVersions: ctx.store.projectVersions,
          deployTargets: ctx.store.deployTargets,
          deployments: ctx.store.deployments,
          projectOperations: ctx.store.projectOperations,
        },
        ids: new RandomIds(),
      },
      {
        authorization: `Bearer ${ctx.plain}`,
        organizationId: ctx.orgId,
        projectId: ctx.projectId,
        projectVersionSeq: 99,
        targetSlug: 'prod',
      },
    );
    expect(out.status).toBe('error');
    if (out.status !== 'error') return;
    expect(out.errors[0]?.code).toBe('DEPLOY_REQUEST_VERSION_NOT_FOUND');
  });

  it('returns error when the deploy target slug is unknown', async () => {
    const ctx = await setup();
    const seq = await publishVersion(ctx);

    const out = await startDeploymentHandler(
      {
        provider: ctx.provider,
        repos: {
          organizations: ctx.store.organizations,
          projects: ctx.store.projects,
          projectVersions: ctx.store.projectVersions,
          deployTargets: ctx.store.deployTargets,
          deployments: ctx.store.deployments,
          projectOperations: ctx.store.projectOperations,
        },
        ids: new RandomIds(),
      },
      {
        authorization: `Bearer ${ctx.plain}`,
        organizationId: ctx.orgId,
        projectId: ctx.projectId,
        projectVersionSeq: seq,
        targetSlug: 'missing',
      },
    );
    expect(out.status).toBe('error');
    if (out.status !== 'error') return;
    expect(out.errors[0]?.code).toBe('DEPLOY_REQUEST_TARGET_NOT_FOUND');
  });

  it('rejects when bearer token is invalid', async () => {
    const ctx = await setup();
    const out = await startDeploymentHandler(
      {
        provider: ctx.provider,
        repos: {
          organizations: ctx.store.organizations,
          projects: ctx.store.projects,
          projectVersions: ctx.store.projectVersions,
          deployTargets: ctx.store.deployTargets,
          deployments: ctx.store.deployments,
          projectOperations: ctx.store.projectOperations,
        },
        ids: new RandomIds(),
      },
      {
        authorization: `Bearer rntme_pat_${'z'.repeat(22)}`,
        organizationId: ctx.orgId,
        projectId: ctx.projectId,
        projectVersionSeq: 1,
        targetSlug: 'prod',
      },
    );
    expect(out.status).toBe('error');
    if (out.status !== 'error') return;
    expect(out.errors[0]?.code).toBe('PLATFORM_AUTH_INVALID');
  });
});
