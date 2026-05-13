import { describe, expect, it } from 'bun:test';
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import {
  ApiTokenProvider,
  canonicalize,
  canonicalDigest,
  FakeStore,
  RandomIds,
} from '@rntme/platform-core';
import { publishProjectBundleHandler } from '../services/projects/handlers/publish-project-bundle.js';

async function setup(): Promise<{
  store: FakeStore;
  provider: ApiTokenProvider;
  plain: string;
  projectId: string;
  projectSlug: string;
  orgId: string;
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
  const plain = 'rntme_pat_' + 'a'.repeat(22);
  const hash = new Uint8Array(createHash('sha256').update(plain).digest());
  await store.tokensRepo.create({
    id: 'tok-publish',
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
    projectId: projectCreate.value.id,
    projectSlug: projectCreate.value.slug,
    orgId: org.id,
  };
}

function makeBundleBytes(name = 'cv-extract'): { bytes: Uint8Array; digest: string } {
  const bundle = {
    version: 2,
    files: {
      'project.json': { name, services: ['app'], routes: { ui: { '/': 'app' }, http: {} }, middleware: {}, mounts: [] },
    },
  };
  const canonical = canonicalize(bundle);
  const bytes = Buffer.from(canonical, 'utf8');
  const digest = 'sha256:' + canonicalDigest(bundle);
  return { bytes: new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength), digest };
}

describe('publishProjectBundleHandler', () => {
  it('publishes a new ProjectVersion when authorized and bundle is valid', async () => {
    const ctx = await setup();
    const ids = new RandomIds();
    const { bytes } = makeBundleBytes();

    const out = await publishProjectBundleHandler(
      {
        provider: ctx.provider,
        repos: {
          projects: ctx.store.projects,
          projectVersions: ctx.store.projectVersions,
        },
        blob: ctx.store.blob,
        ids,
      },
      {
        authorization: `Bearer ${ctx.plain}`,
        projectId: ctx.projectId,
        bodyBytes: bytes,
      },
    );

    expect(out.status).toBe('created');
    if (out.status !== 'created') return;
    expect(out.version.projectId).toBe(ctx.projectId);
    expect(out.version.orgId).toBe(ctx.orgId);
    expect(out.version.seq).toBe(1);
    expect(out.version.bundleDigest).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it('resolves the project by org-scoped slug', async () => {
    const ctx = await setup();
    const ids = new RandomIds();
    const { bytes } = makeBundleBytes();

    const out = await publishProjectBundleHandler(
      {
        provider: ctx.provider,
        repos: {
          projects: ctx.store.projects,
          projectVersions: ctx.store.projectVersions,
        },
        blob: ctx.store.blob,
        ids,
      },
      {
        authorization: `Bearer ${ctx.plain}`,
        projectId: ctx.projectSlug,
        bodyBytes: bytes,
      },
    );

    expect(out.status).toBe('created');
    if (out.status !== 'created') return;
    expect(out.version.projectId).toBe(ctx.projectId);
  });

  it('returns the same version when the same bundle is republished (digest dedup)', async () => {
    const ctx = await setup();
    const ids = new RandomIds();
    const { bytes } = makeBundleBytes();

    const first = await publishProjectBundleHandler(
      {
        provider: ctx.provider,
        repos: {
          projects: ctx.store.projects,
          projectVersions: ctx.store.projectVersions,
        },
        blob: ctx.store.blob,
        ids,
      },
      { authorization: `Bearer ${ctx.plain}`, projectId: ctx.projectId, bodyBytes: bytes },
    );
    expect(first.status).toBe('created');

    const second = await publishProjectBundleHandler(
      {
        provider: ctx.provider,
        repos: {
          projects: ctx.store.projects,
          projectVersions: ctx.store.projectVersions,
        },
        blob: ctx.store.blob,
        ids,
      },
      { authorization: `Bearer ${ctx.plain}`, projectId: ctx.projectId, bodyBytes: bytes },
    );
    expect(second.status).toBe('created');
    if (first.status !== 'created' || second.status !== 'created') return;
    expect(second.version.id).toBe(first.version.id);
    expect(second.version.seq).toBe(1);
  });

  it('returns error when authorization is missing or invalid', async () => {
    const ctx = await setup();
    const ids = new RandomIds();
    const { bytes } = makeBundleBytes();

    const out = await publishProjectBundleHandler(
      {
        provider: ctx.provider,
        repos: {
          projects: ctx.store.projects,
          projectVersions: ctx.store.projectVersions,
        },
        blob: ctx.store.blob,
        ids,
      },
      {
        authorization: `Bearer rntme_pat_${'z'.repeat(22)}`,
        projectId: ctx.projectId,
        bodyBytes: bytes,
      },
    );

    expect(out.status).toBe('error');
    if (out.status !== 'error') return;
    expect(out.errors[0]?.code).toBe('PLATFORM_AUTH_INVALID');
  });

  it('returns error when the project is not found under the authenticated org', async () => {
    const ctx = await setup();
    const ids = new RandomIds();
    const { bytes } = makeBundleBytes();

    const out = await publishProjectBundleHandler(
      {
        provider: ctx.provider,
        repos: {
          projects: ctx.store.projects,
          projectVersions: ctx.store.projectVersions,
        },
        blob: ctx.store.blob,
        ids,
      },
      {
        authorization: `Bearer ${ctx.plain}`,
        projectId: 'no-such-project',
        bodyBytes: bytes,
      },
    );

    expect(out.status).toBe('error');
    if (out.status !== 'error') return;
    expect(out.errors[0]?.code).toBe('PLATFORM_TENANCY_PROJECT_NOT_FOUND');
  });
});
