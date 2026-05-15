import { describe, expect, it } from 'bun:test';
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
  openSqliteDatabase,
  type SqliteDatabase,
} from '../../../../packages/runtime/sqlite/src/index.js';
import {
  createDeployTargetHandler,
  deleteDeployTargetHandler,
  getDeployTargetHandler,
  listDeployTargetsHandler,
  updateDeployTargetHandler,
} from '../services/deployments/handlers/deploy-targets.js';
import {
  getDeploymentHandler,
  listDeployStagesHandler,
  readDeploymentLogsHandler,
} from '../services/deployments/handlers/deployments.js';
import {
  createRuntimeResolveProvisioner,
  startDeploymentHandler,
} from '../services/deployments/handlers/start-deployment.js';

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

function createDeploymentsRuntimeDb(): SqliteDatabase {
  const db = openSqliteDatabase({ filename: ':memory:' });
  db.exec(`
    CREATE TABLE projects (
      id TEXT NOT NULL PRIMARY KEY,
      organization_id TEXT NOT NULL,
      slug TEXT NOT NULL,
      display_name TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      last_event_id TEXT NOT NULL,
      last_event_version INTEGER NOT NULL,
      applied_at TEXT NOT NULL
    );
    CREATE TABLE project_versions (
      id TEXT NOT NULL PRIMARY KEY,
      project_id TEXT NOT NULL,
      sequence INTEGER NOT NULL,
      bundle_digest TEXT NOT NULL,
      bundle_object_key TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      last_event_id TEXT NOT NULL,
      last_event_version INTEGER NOT NULL,
      applied_at TEXT NOT NULL
    );
    CREATE TABLE deploy_targets (
      id TEXT NOT NULL PRIMARY KEY,
      organization_id TEXT NOT NULL,
      slug TEXT NOT NULL,
      provider TEXT NOT NULL,
      environment TEXT NOT NULL,
      config_json TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      last_event_id TEXT NOT NULL,
      last_event_version INTEGER NOT NULL,
      applied_at TEXT NOT NULL
    );
    CREATE TABLE project_operations (
      id TEXT NOT NULL PRIMARY KEY,
      organization_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      status TEXT NOT NULL,
      input_json TEXT NOT NULL,
      result_json TEXT,
      created_at TEXT NOT NULL,
      started_at TEXT,
      finished_at TEXT,
      last_event_id TEXT NOT NULL,
      last_event_version INTEGER NOT NULL,
      applied_at TEXT NOT NULL
    );
    CREATE TABLE deployments (
      id TEXT NOT NULL PRIMARY KEY,
      organization_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      project_version_id TEXT NOT NULL,
      target_id TEXT NOT NULL,
      status TEXT NOT NULL,
      result_json TEXT,
      created_at TEXT NOT NULL,
      started_at TEXT,
      finished_at TEXT,
      last_event_id TEXT NOT NULL,
      last_event_version INTEGER NOT NULL,
      applied_at TEXT NOT NULL
    );
    CREATE TABLE deployment_log_lines (
      id TEXT NOT NULL PRIMARY KEY,
      deployment_id TEXT NOT NULL,
      level TEXT NOT NULL,
      stage TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL,
      status TEXT NOT NULL,
      last_event_id TEXT NOT NULL,
      last_event_version INTEGER NOT NULL,
      applied_at TEXT NOT NULL
    );
    CREATE TABLE deploy_stage_state (
      id TEXT NOT NULL PRIMARY KEY,
      deployment_id TEXT NOT NULL,
      org_id TEXT NOT NULL,
      stage TEXT NOT NULL,
      status TEXT NOT NULL,
      public_state_json TEXT,
      secret_blob_key TEXT,
      error_code TEXT,
      error_message TEXT,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      last_event_id TEXT NOT NULL,
      last_event_version INTEGER NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);
  return db;
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
  it('lists targets when invoked with the runtime-native edge session shape', async () => {
    const db = createDeploymentsRuntimeDb();
    try {
      const orgId = 'org_uZUWhpWgK54VWC2X';
      db.prepare(`
        INSERT INTO deploy_targets (
          id,
          organization_id,
          slug,
          provider,
          environment,
          config_json,
          status,
          created_at,
          last_event_id,
          last_event_version,
          applied_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        'target-runtime-1',
        orgId,
        'prod',
        'dokploy',
        'prod',
        JSON.stringify({
          displayName: 'Prod',
          kind: 'dokploy',
          dokployUrl: 'https://dokploy.example.com',
          publicBaseUrl: 'https://cv-extract.example.com',
          dokployProjectId: 'dokploy-proj-1',
          dokployProjectName: null,
          allowCreateProject: false,
          apiTokenRedacted: '***',
          eventBus: { kind: 'kafka', mode: 'external', brokers: ['localhost:9092'] },
          modules: {},
          workflows: null,
          storage: { mode: 'external' },
          auth: {},
          policyValues: {},
          manualAccess: {},
          isDefault: true,
        }),
        'active',
        '2026-05-13T00:00:00.000Z',
        'evt-target-1',
        1,
        '2026-05-13T00:00:00.000Z',
      );

      const out = await listDeployTargetsHandler(
        {
          authorization: 'Bearer redacted',
          organizationId: orgId,
          sessionSubject: 'acct-runtime-1',
          sessionStatus: 'ACTIVE',
        } as never,
        {
          qsmDb: db,
        } as never,
      );

      expect(out.status).toBe('ok');
      if (out.status !== 'ok') return;
      expect(out.targets).toEqual([
        expect.objectContaining({
          id: 'target-runtime-1',
          orgId,
          slug: 'prod',
          displayName: 'Prod',
          kind: 'dokploy',
          publicBaseUrl: 'https://cv-extract.example.com',
          isDefault: true,
        }),
      ]);
    } finally {
      db.close();
    }
  });

  it('creates a target and encrypted target secrets when invoked with the runtime-native edge session shape', async () => {
    const db = createDeploymentsRuntimeDb();
    const previousKey = process.env.PLATFORM_SECRET_ENCRYPTION_KEY;
    process.env.PLATFORM_SECRET_ENCRYPTION_KEY = 'a'.repeat(64);
    try {
      const orgId = 'org_uZUWhpWgK54VWC2X';

      const out = await createDeployTargetHandler(
        {
          authorization: 'Bearer redacted',
          organizationId: orgId,
          sessionSubject: 'acct-runtime-1',
          sessionStatus: 'ACTIVE',
          body: makeCreateTargetReq({
            slug: 'prod',
            displayName: 'Prod',
            publicBaseUrl: 'https://cv-extract.example.com',
            targetSecrets: { 'openrouter-api-key': 'sk-test-openrouter' },
          } as never),
        } as never,
        {
          qsmDb: db,
          now: () => '2026-05-14T00:00:00.000Z',
          nextId: () => 'target-runtime-created',
        } as never,
      );

      expect(out.status).toBe('created');
      if (out.status !== 'created') return;
      expect(out.target.slug).toBe('prod');
      expect(out.target.apiTokenRedacted).toBe('***');

      const stored = db.prepare('SELECT config_json FROM deploy_targets WHERE id = ?').get(out.target.id) as
        | { config_json: string }
        | undefined;
      expect(stored?.config_json).not.toContain('secret-token');
      expect(stored?.config_json).not.toContain('sk-test-openrouter');

      const secretRow = db.prepare('SELECT api_token_ciphertext, target_secrets_ciphertext FROM deploy_target_secrets WHERE target_id = ?').get(out.target.id) as
        | { api_token_ciphertext: string; target_secrets_ciphertext: string }
        | undefined;
      expect(secretRow?.api_token_ciphertext).toBeTruthy();
      expect(secretRow?.target_secrets_ciphertext).toBeTruthy();
      expect(secretRow?.api_token_ciphertext).not.toContain('secret-token');
      expect(secretRow?.target_secrets_ciphertext).not.toContain('sk-test-openrouter');
    } finally {
      if (previousKey === undefined) delete process.env.PLATFORM_SECRET_ENCRYPTION_KEY;
      else process.env.PLATFORM_SECRET_ENCRYPTION_KEY = previousKey;
      db.close();
    }
  });

  it('updates target config and encrypted target secrets with the runtime-native edge session shape', async () => {
    const db = createDeploymentsRuntimeDb();
    const previousKey = process.env.PLATFORM_SECRET_ENCRYPTION_KEY;
    process.env.PLATFORM_SECRET_ENCRYPTION_KEY = 'a'.repeat(64);
    try {
      const orgId = 'org_uZUWhpWgK54VWC2X';
      const created = await createDeployTargetHandler(
        {
          authorization: 'Bearer redacted',
          organizationId: orgId,
          sessionSubject: 'acct-runtime-1',
          sessionStatus: 'ACTIVE',
          body: makeCreateTargetReq({ slug: 'prod' }),
        } as never,
        {
          qsmDb: db,
          now: () => '2026-05-14T00:00:00.000Z',
          nextId: (() => {
            let i = 0;
            return () => `id-${++i}`;
          })(),
        } as never,
      );
      expect(created.status).toBe('created');
      if (created.status !== 'created') return;

      const updated = await updateDeployTargetHandler(
        {
          authorization: 'Bearer redacted',
          organizationId: orgId,
          slug: 'prod',
          sessionSubject: 'acct-runtime-1',
          sessionStatus: 'ACTIVE',
          body: {
            modules: {
              openrouter: {
                image: 'ghcr.io/example/openrouter:test',
                secretRefs: { OPENROUTER_API_KEY: 'openrouter-api-key' },
              },
            },
            targetSecrets: { 'openrouter-api-key': 'sk-updated-openrouter' },
          },
        } as never,
        { qsmDb: db, now: () => '2026-05-14T00:01:00.000Z', nextId: () => 'evt-update' } as never,
      );

      expect(updated.status).toBe('updated');
      if (updated.status !== 'updated') return;
      expect(updated.target.modules).toEqual({
        openrouter: {
          image: 'ghcr.io/example/openrouter:test',
          secretRefs: { OPENROUTER_API_KEY: 'openrouter-api-key' },
        },
      });

      const stored = db.prepare('SELECT config_json FROM deploy_targets WHERE id = ?').get(updated.target.id) as
        | { config_json: string }
        | undefined;
      expect(stored?.config_json).not.toContain('sk-updated-openrouter');

      const secretRow = db.prepare('SELECT target_secrets_ciphertext FROM deploy_target_secrets WHERE target_id = ?').get(updated.target.id) as
        | { target_secrets_ciphertext: string }
        | undefined;
      expect(secretRow?.target_secrets_ciphertext).toBeTruthy();
      expect(secretRow?.target_secrets_ciphertext).not.toContain('sk-updated-openrouter');
    } finally {
      if (previousKey === undefined) delete process.env.PLATFORM_SECRET_ENCRYPTION_KEY;
      else process.env.PLATFORM_SECRET_ENCRYPTION_KEY = previousKey;
      db.close();
    }
  });

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

  it('creates a queued operation and deployment when invoked with the runtime-native edge session shape', async () => {
    const db = createDeploymentsRuntimeDb();
    try {
      const orgId = 'org_uZUWhpWgK54VWC2X';
      db.prepare(`
        INSERT INTO projects (
          id,
          organization_id,
          slug,
          display_name,
          status,
          created_at,
          last_event_id,
          last_event_version,
          applied_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        'proj-runtime-1',
        orgId,
        'cv-extract',
        'CV Extract',
        'active',
        '2026-05-13T00:00:00.000Z',
        'evt-project',
        1,
        '2026-05-13T00:00:00.000Z',
      );
      db.prepare(`
        INSERT INTO project_versions (
          id,
          project_id,
          sequence,
          bundle_digest,
          bundle_object_key,
          status,
          created_at,
          last_event_id,
          last_event_version,
          applied_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        'version-runtime-1',
        'proj-runtime-1',
        1,
        'sha256:1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        'project-versions/proj-runtime-1/bundle.json',
        'published',
        '2026-05-13T00:00:00.000Z',
        'evt-version',
        1,
        '2026-05-13T00:00:00.000Z',
      );
      db.prepare(`
        INSERT INTO deploy_targets (
          id,
          organization_id,
          slug,
          provider,
          environment,
          config_json,
          status,
          created_at,
          last_event_id,
          last_event_version,
          applied_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        'target-runtime-1',
        orgId,
        'prod',
        'dokploy',
        'prod',
        JSON.stringify(makeCreateTargetReq({ slug: 'prod' })),
        'active',
        '2026-05-13T00:00:00.000Z',
        'evt-target',
        1,
        '2026-05-13T00:00:00.000Z',
      );
      const ids = [
        'operation-runtime-1',
        'deployment-runtime-1',
        'evt-operation',
        'evt-deployment',
      ];
      const runnerCalls: Array<{ deploymentId: string; operationId: string; orgId: string }> = [];

      const out = await startDeploymentHandler(
        {
          authorization: 'Bearer redacted',
          organizationId: orgId,
          projectId: 'cv-extract',
          projectVersionSeq: 1,
          targetSlug: 'prod',
          sessionSubject: 'acct-runtime-1',
          sessionStatus: 'ACTIVE',
        } as never,
        {
          qsmDb: db,
          now: () => '2026-05-14T00:00:00.000Z',
          nextId: () => ids.shift() ?? 'extra-id',
          awaitRuntimeDeployment: true,
          runtimeDeploymentRunner: async (job: { deploymentId: string; operationId: string; orgId: string }) => {
            runnerCalls.push({
              deploymentId: job.deploymentId,
              operationId: job.operationId,
              orgId: job.orgId,
            });
          },
        } as never,
      );

      expect(out.status).toBe('started');
      if (out.status !== 'started') return;
      expect(out.operation).toMatchObject({
        id: 'operation-runtime-1',
        orgId,
        projectId: 'proj-runtime-1',
        kind: 'update',
        status: 'queued',
        deploymentId: 'deployment-runtime-1',
      });
      expect(out.deployment).toMatchObject({
        id: 'deployment-runtime-1',
        orgId,
        projectId: 'proj-runtime-1',
        projectVersionId: 'version-runtime-1',
        projectVersionSeq: 1,
        targetId: 'target-runtime-1',
        targetSlug: 'prod',
        status: 'queued',
        startedByAccountId: 'acct-runtime-1',
      });

      const row = db.prepare('SELECT status, result_json FROM deployments WHERE id = ?').get(out.deployment.id) as
        | { status: string; result_json: string | null }
        | undefined;
      expect(row?.status).toBe('queued');
      expect(row?.result_json).toContain('"projectVersionSeq":1');
      expect(runnerCalls).toEqual([{
        deploymentId: 'deployment-runtime-1',
        operationId: 'operation-runtime-1',
        orgId,
      }]);

      const shown = getDeploymentHandler(
        {
          authorization: 'Bearer redacted',
          sessionSubject: 'acct-runtime-1',
          sessionStatus: 'ACTIVE',
          id: out.deployment.id,
        } as never,
        { qsmDb: db } as never,
      );
      expect(shown.status).toBe('ok');
      if (shown.status !== 'ok') return;
      expect(shown.deployment).toMatchObject({
        id: out.deployment.id,
        status: 'queued',
        projectVersionSeq: 1,
        targetSlug: 'prod',
      });
    } finally {
      db.close();
    }
  });

  it('allocates runtime deployment log ids across all deployments', async () => {
    const db = createDeploymentsRuntimeDb();
    try {
      const orgId = 'org_uZUWhpWgK54VWC2X';
      db.prepare(`
        INSERT INTO projects (
          id,
          organization_id,
          slug,
          display_name,
          status,
          created_at,
          last_event_id,
          last_event_version,
          applied_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        'proj-runtime-1',
        orgId,
        'cv-extract',
        'CV Extract',
        'active',
        '2026-05-13T00:00:00.000Z',
        'evt-project',
        1,
        '2026-05-13T00:00:00.000Z',
      );
      db.prepare(`
        INSERT INTO project_versions (
          id,
          project_id,
          sequence,
          bundle_digest,
          bundle_object_key,
          status,
          created_at,
          last_event_id,
          last_event_version,
          applied_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        'version-runtime-1',
        'proj-runtime-1',
        1,
        'sha256:1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        'project-versions/proj-runtime-1/bundle.json',
        'published',
        '2026-05-13T00:00:00.000Z',
        'evt-version',
        1,
        '2026-05-13T00:00:00.000Z',
      );
      db.prepare(`
        INSERT INTO deploy_targets (
          id,
          organization_id,
          slug,
          provider,
          environment,
          config_json,
          status,
          created_at,
          last_event_id,
          last_event_version,
          applied_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        'target-runtime-1',
        orgId,
        'prod',
        'dokploy',
        'prod',
        JSON.stringify(makeCreateTargetReq({ slug: 'prod' })),
        'active',
        '2026-05-13T00:00:00.000Z',
        'evt-target',
        1,
        '2026-05-13T00:00:00.000Z',
      );
      db.prepare(`
        INSERT INTO deployment_log_lines (
          id,
          deployment_id,
          level,
          stage,
          message,
          created_at,
          status,
          last_event_id,
          last_event_version,
          applied_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        '1',
        'previous-deployment',
        'info',
        'deploy',
        'Previous deployment log',
        '2026-05-13T00:00:00.000Z',
        'recorded',
        'evt-log-previous',
        1,
        '2026-05-13T00:00:00.000Z',
      );

      const ids = [
        'operation-runtime-1',
        'deployment-runtime-1',
        'evt-operation',
        'evt-deployment',
        'evt-running-deployment',
        'evt-running-operation',
        'evt-log-current',
        'evt-terminal-deployment',
        'evt-terminal-operation',
      ];

      const out = await startDeploymentHandler(
        {
          authorization: 'Bearer redacted',
          organizationId: orgId,
          projectId: 'cv-extract',
          projectVersionSeq: 1,
          targetSlug: 'prod',
          sessionSubject: 'acct-runtime-1',
          sessionStatus: 'ACTIVE',
        } as never,
        {
          qsmDb: db,
          now: () => '2026-05-14T00:00:00.000Z',
          nextId: () => ids.shift() ?? 'extra-id',
          awaitRuntimeDeployment: true,
        } as never,
      );

      expect(out.status).toBe('started');

      const logRows = db.prepare<[string], { id: string; deployment_id: string; message: string }>(`
        SELECT id, deployment_id, message
        FROM deployment_log_lines
        WHERE deployment_id = ?
        ORDER BY CAST(id AS INTEGER) ASC
      `).all('deployment-runtime-1');
      expect(logRows).toEqual([{
        id: '2',
        deployment_id: 'deployment-runtime-1',
        message: 'no such table: project_version_bundles',
      }]);

      const row = db.prepare('SELECT status FROM deployments WHERE id = ?').get('deployment-runtime-1') as
        | { status: string }
        | undefined;
      expect(row?.status).toBe('failed');
    } finally {
      db.close();
    }
  });

  it('reads deployment log lines from the runtime-native storage shape', () => {
    const db = createDeploymentsRuntimeDb();
    try {
      db.prepare(`
        INSERT INTO deployment_log_lines (
          id,
          deployment_id,
          level,
          stage,
          message,
          created_at,
          status,
          last_event_id,
          last_event_version,
          applied_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        '1',
        'deployment-runtime-1',
        'info',
        'plan',
        'Planning deployment',
        '2026-05-14T00:00:00.000Z',
        'recorded',
        'evt-log',
        1,
        '2026-05-14T00:00:00.000Z',
      );

      const out = readDeploymentLogsHandler(
        {
          authorization: 'Bearer redacted',
          sessionSubject: 'acct-runtime-1',
          sessionStatus: 'ACTIVE',
          deploymentId: 'deployment-runtime-1',
          limit: 10,
        } as never,
        { qsmDb: db } as never,
      );

      expect(out.status).toBe('ok');
      if (out.status !== 'ok') return;
      expect(out.lines).toEqual([
        {
          id: 1,
          deploymentId: 'deployment-runtime-1',
          orgId: '',
          ts: new Date('2026-05-14T00:00:00.000Z'),
          level: 'info',
          step: 'plan',
          message: 'Planning deployment',
        },
      ]);
      expect(out.lastLineId).toBe(1);
    } finally {
      db.close();
    }
  });

  it('lists deploy-stage rows for the latest deployment of a project', () => {
    const db = createDeploymentsRuntimeDb();
    try {
      const insertDeployment = db.prepare(`
        INSERT INTO deployments (
          id, organization_id, project_id, project_version_id, target_id,
          status, result_json, created_at, started_at, finished_at,
          last_event_id, last_event_version, applied_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      insertDeployment.run(
        'dep-old', 'org-1', 'proj-1', 'pv-1', 'tgt-1',
        'succeeded', null, '2026-05-13T00:00:00.000Z', null, null,
        'evt-d0', 1, '2026-05-13T00:00:00.000Z',
      );
      insertDeployment.run(
        'dep-latest', 'org-1', 'proj-1', 'pv-2', 'tgt-1',
        'running', null, '2026-05-14T00:00:00.000Z', null, null,
        'evt-d1', 1, '2026-05-14T00:00:00.000Z',
      );

      const insertStage = db.prepare(`
        INSERT INTO deploy_stage_state (
          id, deployment_id, org_id, stage, status,
          public_state_json, secret_blob_key, error_code, error_message,
          started_at, finished_at, last_event_id, last_event_version, applied_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      // Stage rows for the superseded deployment must not leak into the result.
      insertStage.run(
        'stg-old', 'dep-old', 'org-1', 'compose', 'succeeded',
        null, null, null, null,
        '2026-05-13T00:00:01.000Z', '2026-05-13T00:00:02.000Z', 'evt-s0', 1, '2026-05-13T00:00:02.000Z',
      );
      insertStage.run(
        'stg-compose', 'dep-latest', 'org-1', 'compose', 'succeeded',
        null, null, null, null,
        '2026-05-14T00:00:01.000Z', '2026-05-14T00:00:03.000Z', 'evt-s1', 1, '2026-05-14T00:00:03.000Z',
      );
      insertStage.run(
        'stg-provision', 'dep-latest', 'org-1', 'provision', 'running',
        null, null, null, null,
        '2026-05-14T00:00:04.000Z', null, 'evt-s2', 1, '2026-05-14T00:00:04.000Z',
      );

      const out = listDeployStagesHandler(
        {
          authorization: 'Bearer redacted',
          sessionSubject: 'acct-runtime-1',
          sessionStatus: 'ACTIVE',
          organizationId: 'org-1',
          projectId: 'proj-1',
        } as never,
        { qsmDb: db } as never,
      );

      expect(out.status).toBe('ok');
      if (out.status !== 'ok') return;
      expect(out.deploymentId).toBe('dep-latest');
      expect(out.stages).toEqual([
        {
          id: 'stg-compose',
          deploymentId: 'dep-latest',
          orgId: 'org-1',
          stage: 'compose',
          status: 'succeeded',
          errorCode: null,
          errorMessage: null,
          startedAt: '2026-05-14T00:00:01.000Z',
          finishedAt: '2026-05-14T00:00:03.000Z',
        },
        {
          id: 'stg-provision',
          deploymentId: 'dep-latest',
          orgId: 'org-1',
          stage: 'provision',
          status: 'running',
          errorCode: null,
          errorMessage: null,
          startedAt: '2026-05-14T00:00:04.000Z',
          finishedAt: null,
        },
      ]);
    } finally {
      db.close();
    }
  });

  it('returns deploymentId null and no stages when the project has no deployment', () => {
    const db = createDeploymentsRuntimeDb();
    try {
      const out = listDeployStagesHandler(
        {
          authorization: 'Bearer redacted',
          sessionSubject: 'acct-runtime-1',
          sessionStatus: 'ACTIVE',
          organizationId: 'org-1',
          projectId: 'proj-empty',
        } as never,
        { qsmDb: db } as never,
      );

      expect(out.status).toBe('ok');
      if (out.status !== 'ok') return;
      expect(out.deploymentId).toBeNull();
      expect(out.stages).toEqual([]);
    } finally {
      db.close();
    }
  });

  it('rejects deploy-stage reads without an active runtime session', () => {
    const db = createDeploymentsRuntimeDb();
    try {
      const out = listDeployStagesHandler(
        {
          authorization: 'Bearer redacted',
          organizationId: 'org-1',
          projectId: 'proj-1',
        } as never,
        { qsmDb: db } as never,
      );

      expect(out.status).toBe('error');
      if (out.status !== 'error') return;
      expect(out.errors[0]?.code).toBe('PLATFORM_AUTH_INVALID');
    } finally {
      db.close();
    }
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

describe('runtime provisioner resolver', () => {
  it('loads provisioner entries materialized from bundle assets', async () => {
    const projectDir = await mkdtemp(join(tmpdir(), 'rntme-platform-provisioner-'));
    try {
      const provisionerDir = join(projectDir, 'assets', 'provisioners');
      await mkdir(provisionerDir, { recursive: true });
      await writeFile(
        join(provisionerDir, 'rntme__marketing-site-static.entry.js'),
        [
          'export async function provision() {',
          '  return { source: "bundle-asset" };',
          '}',
          '',
        ].join('\n'),
        'utf8',
      );

      const resolved = await createRuntimeResolveProvisioner()(
        '@rntme/marketing-site-static',
        'dist/provisioner.entry.js',
        projectDir,
      );
      const provision = resolved.provision as unknown as (() => Promise<Record<string, unknown>>) | undefined;

      expect(typeof provision).toBe('function');
      expect(await provision?.()).toEqual({ source: 'bundle-asset' });
    } finally {
      await rm(projectDir, { recursive: true, force: true });
    }
  });
});
