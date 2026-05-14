import { describe, expect, it } from 'bun:test';
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import {
  openSqliteDatabase,
  type SqliteDatabase,
} from '../../../../packages/runtime/sqlite/src/index.js';
import {
  ApiTokenProvider,
  canonicalize,
  canonicalDigest,
  FakeStore,
  RandomIds,
} from '@rntme/platform-core';
import { publishProjectBundleHandler } from '../services/projects/handlers/publish-project-bundle.js';
import { listOrgProjectsHandler } from '../services/projects/handlers/list-org-projects.js';

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

function createProjectsDb(): SqliteDatabase {
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
  `);
  return db;
}

describe('publishProjectBundleHandler', () => {
  it('publishes with the runtime-native edge-authenticated call shape', async () => {
    const db = createProjectsDb();
    try {
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
        'org_uZUWhpWgK54VWC2X',
        'cv-extract',
        'CV Extract',
        'active',
        '2026-05-13T00:00:00.000Z',
        'evt-project',
        1,
        '2026-05-13T00:00:00.000Z',
      );
      const { bytes, digest } = makeBundleBytes();

      const out = await publishProjectBundleHandler(
        {
          authorization: 'Bearer redacted',
          projectId: 'cv-extract',
          bodyBytes: bytes,
          sessionSubject: 'acct-runtime-1',
          sessionStatus: 'ACTIVE',
        } as never,
        {
          qsmDb: db,
          nextId: (() => {
            let i = 0;
            return () => `id-${++i}`;
          })(),
          now: () => '2026-05-14T00:00:00.000Z',
          correlation: { commandId: 'cmd-1', correlationId: 'corr-1', traceparent: null },
        } as never,
      );

      expect(out.status).toBe('created');
      if (out.status !== 'created') return;
      expect(out.version.projectId).toBe('proj-runtime-1');
      expect(out.version.orgId).toBe('org_uZUWhpWgK54VWC2X');
      expect(out.version.seq).toBe(1);
      expect(out.version.bundleDigest).toBe(digest);
      expect(out.version.uploadedByAccountId).toBe('acct-runtime-1');

      const row = db.prepare('SELECT * FROM project_versions WHERE id = ?').get(out.version.id) as {
        project_id: string;
        sequence: number;
        bundle_digest: string;
        status: string;
      };
      expect(row).toMatchObject({
        project_id: 'proj-runtime-1',
        sequence: 1,
        bundle_digest: digest,
        status: 'published',
      });

      const bundleRow = db.prepare('SELECT bundle_bytes FROM project_version_bundles WHERE version_id = ?').get(out.version.id) as
        | { bundle_bytes: Uint8Array }
        | undefined;
      expect(bundleRow?.bundle_bytes).toEqual(bytes);
    } finally {
      db.close();
    }
  });

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

describe('listOrgProjectsHandler', () => {
  it('returns active projects when invoked with the runtime-native edge-authenticated call shape', async () => {
    const db = createProjectsDb();
    try {
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
        'org_uZUWhpWgK54VWC2X',
        'cv-extract',
        'CV Extract',
        'active',
        '2026-05-13T00:00:00.000Z',
        'evt-1',
        1,
        '2026-05-13T00:00:00.000Z',
      );

      const out = await listOrgProjectsHandler(
        {
          authorization: 'Bearer redacted',
          organizationId: 'org_uZUWhpWgK54VWC2X',
          limit: 10,
          sessionSubject: 'acct_1',
          sessionStatus: 'ACTIVE',
        } as never,
        {
          qsmDb: db,
          correlation: { commandId: 'cmd-1', correlationId: 'corr-1', traceparent: null },
        } as never,
      );

      expect(out.status).toBe('ok');
      if (out.status !== 'ok') return;
      expect(out.projects).toEqual([
        expect.objectContaining({
          id: 'proj-runtime-1',
          orgId: 'org_uZUWhpWgK54VWC2X',
          slug: 'cv-extract',
          displayName: 'CV Extract',
          status: 'active',
        }),
      ]);
    } finally {
      db.close();
    }
  });

  it('returns active projects for the authorized org', async () => {
    const ctx = await setup();
    const out = await listOrgProjectsHandler(
      {
        provider: ctx.provider,
        repos: { organizations: ctx.store.organizations, projects: ctx.store.projects },
      },
      {
        authorization: `Bearer ${ctx.plain}`,
        organizationId: ctx.orgId,
      },
    );

    expect(out.status).toBe('ok');
    if (out.status !== 'ok') return;
    expect(out.projects).toHaveLength(1);
    expect(out.projects[0]?.id).toBe(ctx.projectId);
    expect(out.projects[0]?.slug).toBe(ctx.projectSlug);
    expect(out.projects[0]?.orgId).toBe(ctx.orgId);
  });

  it('accepts the org slug as organizationId', async () => {
    const ctx = await setup();
    const orgRow = await ctx.store.organizations.findById(ctx.orgId);
    if (!orgRow.ok || !orgRow.value) throw new Error('seed org missing');
    const out = await listOrgProjectsHandler(
      {
        provider: ctx.provider,
        repos: { organizations: ctx.store.organizations, projects: ctx.store.projects },
      },
      {
        authorization: `Bearer ${ctx.plain}`,
        organizationId: orgRow.value.slug,
      },
    );

    expect(out.status).toBe('ok');
    if (out.status !== 'ok') return;
    expect(out.projects.map((p) => p.slug)).toContain(ctx.projectSlug);
  });

  it('accepts the WorkOS organization id as organizationId', async () => {
    const ctx = await setup();
    const orgRow = await ctx.store.organizations.findById(ctx.orgId);
    if (!orgRow.ok || !orgRow.value) throw new Error('seed org missing');
    const out = await listOrgProjectsHandler(
      {
        provider: ctx.provider,
        repos: { organizations: ctx.store.organizations, projects: ctx.store.projects },
      },
      {
        authorization: `Bearer ${ctx.plain}`,
        organizationId: orgRow.value.workosOrganizationId,
      },
    );

    expect(out.status).toBe('ok');
    if (out.status !== 'ok') return;
    expect(out.projects.map((p) => p.slug)).toContain(ctx.projectSlug);
  });

  it('returns PLATFORM_AUTH_INVALID when authorization is missing or invalid', async () => {
    const ctx = await setup();
    const out = await listOrgProjectsHandler(
      {
        provider: ctx.provider,
        repos: { organizations: ctx.store.organizations, projects: ctx.store.projects },
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

  it('returns PLATFORM_AUTH_FORBIDDEN when the org does not match the subject', async () => {
    const ctx = await setup();
    const otherOrg = await ctx.store.seedOrg({
      slug: 'other',
      workosOrganizationId: 'org_workos_other',
      displayName: 'Other',
    });
    const out = await listOrgProjectsHandler(
      {
        provider: ctx.provider,
        repos: { organizations: ctx.store.organizations, projects: ctx.store.projects },
      },
      {
        authorization: `Bearer ${ctx.plain}`,
        organizationId: otherOrg.id,
      },
    );
    expect(out.status).toBe('error');
    if (out.status !== 'error') return;
    expect(out.errors[0]?.code).toBe('PLATFORM_AUTH_FORBIDDEN');
  });

  it('returns PLATFORM_TENANCY_ORG_NOT_FOUND when organizationId does not resolve', async () => {
    const ctx = await setup();
    const out = await listOrgProjectsHandler(
      {
        provider: ctx.provider,
        repos: { organizations: ctx.store.organizations, projects: ctx.store.projects },
      },
      {
        authorization: `Bearer ${ctx.plain}`,
        organizationId: 'no-such-org-id',
      },
    );
    expect(out.status).toBe('error');
    if (out.status !== 'error') return;
    expect(out.errors[0]?.code).toBe('PLATFORM_TENANCY_ORG_NOT_FOUND');
  });

  it('respects the limit parameter when supplied', async () => {
    const ctx = await setup();
    const second = await ctx.store.projects.create({
      id: 'proj-2',
      orgId: ctx.orgId,
      slug: 'second-project',
      displayName: 'Second',
    });
    if (!second.ok) throw new Error('failed to seed second project');

    const out = await listOrgProjectsHandler(
      {
        provider: ctx.provider,
        repos: { organizations: ctx.store.organizations, projects: ctx.store.projects },
      },
      {
        authorization: `Bearer ${ctx.plain}`,
        organizationId: ctx.orgId,
        limit: 1,
      },
    );

    expect(out.status).toBe('ok');
    if (out.status !== 'ok') return;
    expect(out.projects).toHaveLength(1);
  });
});
