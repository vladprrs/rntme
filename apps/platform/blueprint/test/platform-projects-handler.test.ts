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
import { listProjectServicesHandler } from '../services/projects/handlers/list-project-services.js';
import { getProjectArtifactSummaryHandler } from '../services/projects/handlers/get-project-artifact-summary.js';
import { getProjectArtifactHandler } from '../services/projects/handlers/get-project-artifact.js';
import { listProjectEndpointsHandler } from '../services/projects/handlers/list-project-endpoints.js';
import { listProjectUiComponentsHandler } from '../services/projects/handlers/list-project-ui-components.js';
import { listProjectGraphsHandler } from '../services/projects/handlers/list-project-graphs.js';

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

describe('listProjectServicesHandler', () => {
  function seedProject(db: SqliteDatabase): void {
    db.prepare(`
      INSERT INTO projects (
        id, organization_id, slug, display_name, status, created_at,
        last_event_id, last_event_version, applied_at
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
  }

  function makeServicesBundleBytes(services: string[]): Uint8Array {
    const bundle = {
      version: 2,
      files: {
        'project.json': { name: 'cv-extract', services, routes: { ui: { '/': 'app' }, http: {} }, middleware: {}, mounts: [] },
      },
    };
    const bytes = Buffer.from(canonicalize(bundle), 'utf8');
    return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  it('parses the latest published bundle into deployed service rows', async () => {
    const db = createProjectsDb();
    try {
      seedProject(db);
      const published = await publishProjectBundleHandler(
        {
          authorization: 'Bearer redacted',
          projectId: 'cv-extract',
          bodyBytes: makeServicesBundleBytes(['app', 'organizations', 'projects']),
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
      expect(published.status).toBe('created');

      const out = listProjectServicesHandler(
        { projectId: 'cv-extract', sessionSubject: 'acct-runtime-1', sessionStatus: 'ACTIVE' },
        { qsmDb: db } as never,
      );

      expect(out.status).toBe('ok');
      if (out.status !== 'ok') return;
      expect(out.services).toEqual([
        { name: 'app', status: 'Ready' },
        { name: 'organizations', status: 'Ready' },
        { name: 'projects', status: 'Ready' },
      ]);
    } finally {
      db.close();
    }
  });

  it('resolves the project by canonical id as well as slug', async () => {
    const db = createProjectsDb();
    try {
      seedProject(db);
      const published = await publishProjectBundleHandler(
        {
          authorization: 'Bearer redacted',
          projectId: 'proj-runtime-1',
          bodyBytes: makeServicesBundleBytes(['app']),
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
      expect(published.status).toBe('created');

      const out = listProjectServicesHandler(
        { projectId: 'proj-runtime-1', sessionSubject: 'acct-runtime-1', sessionStatus: 'ACTIVE' },
        { qsmDb: db } as never,
      );
      expect(out.status).toBe('ok');
      if (out.status !== 'ok') return;
      expect(out.services).toEqual([{ name: 'app', status: 'Ready' }]);
    } finally {
      db.close();
    }
  });

  it('returns an empty list when the project has no published version', () => {
    const db = createProjectsDb();
    try {
      seedProject(db);
      const out = listProjectServicesHandler(
        { projectId: 'cv-extract', sessionSubject: 'acct-runtime-1', sessionStatus: 'ACTIVE' },
        { qsmDb: db } as never,
      );
      expect(out.status).toBe('ok');
      if (out.status !== 'ok') return;
      expect(out.services).toEqual([]);
    } finally {
      db.close();
    }
  });

  it('returns PLATFORM_AUTH_INVALID without an active edge session', () => {
    const db = createProjectsDb();
    try {
      seedProject(db);
      const out = listProjectServicesHandler(
        { projectId: 'cv-extract', sessionSubject: null, sessionStatus: null },
        { qsmDb: db } as never,
      );
      expect(out.status).toBe('error');
      if (out.status !== 'error') return;
      expect(out.errors[0]?.code).toBe('PLATFORM_AUTH_INVALID');
    } finally {
      db.close();
    }
  });

  it('returns PLATFORM_TENANCY_PROJECT_NOT_FOUND for an unknown project', () => {
    const db = createProjectsDb();
    try {
      const out = listProjectServicesHandler(
        { projectId: 'no-such-project', sessionSubject: 'acct-runtime-1', sessionStatus: 'ACTIVE' },
        { qsmDb: db } as never,
      );
      expect(out.status).toBe('error');
      if (out.status !== 'error') return;
      expect(out.errors[0]?.code).toBe('PLATFORM_TENANCY_PROJECT_NOT_FOUND');
    } finally {
      db.close();
    }
  });
});

describe('getProjectArtifactSummaryHandler', () => {
  function seedProject(db: SqliteDatabase): void {
    db.prepare(`
      INSERT INTO projects (
        id, organization_id, slug, display_name, status, created_at,
        last_event_id, last_event_version, applied_at
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
  }

  function makeArtifactBundleBytes(): Uint8Array {
    const bundle = {
      version: 2,
      files: {
        'project.json': {
          name: 'cv-extract',
          services: ['app', 'projects'],
          routes: { ui: { '/': 'app' }, http: {} },
          middleware: {},
          mounts: [],
        },
        'pdm/entities/Project.json': { name: 'Project' },
        'pdm/entities/ProjectVersion.json': { name: 'ProjectVersion' },
        'services/projects/graphs/shapes.json': { shapes: {} },
        'services/app/graphs/shapes.json': { shapes: {} },
        'services/projects/graphs/listProjects.json': { id: 'listProjects' },
        'services/projects/graphs/createProject.json': { id: 'createProject' },
        'services/projects/bindings/bindings.json': {
          bindings: { listProjects: {}, createProject: {}, listProjectVersions: {} },
        },
        'services/app/ui/screens/project.spec.json': { root: 'page', elements: {} },
        'services/app/ui/layouts/main.spec.json': { root: 'shell', elements: {} },
      },
    };
    const bytes = Buffer.from(canonicalize(bundle), 'utf8');
    return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  async function publish(db: SqliteDatabase, bodyBytes: Uint8Array, seq: number): Promise<void> {
    const published = await publishProjectBundleHandler(
      {
        authorization: 'Bearer redacted',
        projectId: 'cv-extract',
        bodyBytes,
        sessionSubject: 'acct-runtime-1',
        sessionStatus: 'ACTIVE',
      } as never,
      {
        qsmDb: db,
        nextId: (() => {
          let i = 0;
          return () => `id-${seq}-${++i}`;
        })(),
        now: () => '2026-05-14T00:00:00.000Z',
        correlation: { commandId: `cmd-${seq}`, correlationId: `corr-${seq}`, traceparent: null },
      } as never,
    );
    expect(published.status).toBe('created');
  }

  it('counts services/entities/schemas/graphs/endpoints/uiComponents from the latest bundle', async () => {
    const db = createProjectsDb();
    try {
      seedProject(db);
      await publish(db, makeArtifactBundleBytes(), 1);

      const out = getProjectArtifactSummaryHandler(
        { projectId: 'cv-extract', sessionSubject: 'acct-runtime-1', sessionStatus: 'ACTIVE' },
        { qsmDb: db } as never,
      );

      expect(out.status).toBe('ok');
      if (out.status !== 'ok') return;
      expect(out.summary).toEqual({
        versions: 1,
        services: 2,
        entities: 2,
        schemas: 2,
        graphs: 2,
        endpoints: 3,
        uiComponents: 2,
      });
    } finally {
      db.close();
    }
  });

  it('counts every project_versions row and parses the newest bundle', async () => {
    const db = createProjectsDb();
    try {
      seedProject(db);
      await publish(db, makeServicesBundleBytes(['app']), 1);
      await publish(db, makeArtifactBundleBytes(), 2);

      const out = getProjectArtifactSummaryHandler(
        { projectId: 'proj-runtime-1', sessionSubject: 'acct-runtime-1', sessionStatus: 'ACTIVE' },
        { qsmDb: db } as never,
      );

      expect(out.status).toBe('ok');
      if (out.status !== 'ok') return;
      expect(out.summary.versions).toBe(2);
      expect(out.summary.services).toBe(2);
      expect(out.summary.entities).toBe(2);
    } finally {
      db.close();
    }
  });

  function makeServicesBundleBytes(services: string[]): Uint8Array {
    const bundle = {
      version: 2,
      files: {
        'project.json': { name: 'cv-extract', services, routes: { ui: { '/': 'app' }, http: {} }, middleware: {}, mounts: [] },
      },
    };
    const bytes = Buffer.from(canonicalize(bundle), 'utf8');
    return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  it('returns an all-zero summary when the project has no published version', () => {
    const db = createProjectsDb();
    try {
      seedProject(db);
      const out = getProjectArtifactSummaryHandler(
        { projectId: 'cv-extract', sessionSubject: 'acct-runtime-1', sessionStatus: 'ACTIVE' },
        { qsmDb: db } as never,
      );
      expect(out.status).toBe('ok');
      if (out.status !== 'ok') return;
      expect(out.summary).toEqual({
        versions: 0,
        services: 0,
        entities: 0,
        schemas: 0,
        graphs: 0,
        endpoints: 0,
        uiComponents: 0,
      });
    } finally {
      db.close();
    }
  });

  it('returns PLATFORM_AUTH_INVALID without an active edge session', () => {
    const db = createProjectsDb();
    try {
      seedProject(db);
      const out = getProjectArtifactSummaryHandler(
        { projectId: 'cv-extract', sessionSubject: null, sessionStatus: null },
        { qsmDb: db } as never,
      );
      expect(out.status).toBe('error');
      if (out.status !== 'error') return;
      expect(out.errors[0]?.code).toBe('PLATFORM_AUTH_INVALID');
    } finally {
      db.close();
    }
  });

  it('returns PLATFORM_TENANCY_PROJECT_NOT_FOUND for an unknown project', () => {
    const db = createProjectsDb();
    try {
      const out = getProjectArtifactSummaryHandler(
        { projectId: 'no-such-project', sessionSubject: 'acct-runtime-1', sessionStatus: 'ACTIVE' },
        { qsmDb: db } as never,
      );
      expect(out.status).toBe('error');
      if (out.status !== 'error') return;
      expect(out.errors[0]?.code).toBe('PLATFORM_TENANCY_PROJECT_NOT_FOUND');
    } finally {
      db.close();
    }
  });
});

describe('getProjectArtifactHandler', () => {
  function seedProject(db: SqliteDatabase): void {
    db.prepare(`
      INSERT INTO projects (
        id, organization_id, slug, display_name, status, created_at,
        last_event_id, last_event_version, applied_at
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
  }

  function makeArtifactBundleBytes(): Uint8Array {
    const bundle = {
      version: 2,
      files: {
        'project.json': {
          name: 'cv-extract',
          services: ['app', 'projects'],
          routes: { ui: { '/': 'app' }, http: {} },
          middleware: {},
          mounts: [],
        },
        'pdm/entities/Project.json': { name: 'Project', fields: { id: { type: 'string' } } },
        'pdm/entities/ProjectVersion.json': { name: 'ProjectVersion', fields: {} },
      },
    };
    const bytes = Buffer.from(canonicalize(bundle), 'utf8');
    return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  async function publish(db: SqliteDatabase, bodyBytes: Uint8Array): Promise<void> {
    const published = await publishProjectBundleHandler(
      {
        authorization: 'Bearer redacted',
        projectId: 'cv-extract',
        bodyBytes,
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
    expect(published.status).toBe('created');
  }

  it('returns the parsed JSON body of a single named artifact file', async () => {
    const db = createProjectsDb();
    try {
      seedProject(db);
      await publish(db, makeArtifactBundleBytes());

      const out = getProjectArtifactHandler(
        {
          projectId: 'cv-extract',
          artifactPath: 'pdm/entities/Project.json',
          sessionSubject: 'acct-runtime-1',
          sessionStatus: 'ACTIVE',
        },
        { qsmDb: db } as never,
      );

      expect(out.status).toBe('ok');
      if (out.status !== 'ok') return;
      expect(out.path).toBe('pdm/entities/Project.json');
      expect(out.body).toEqual({ name: 'Project', fields: { id: { type: 'string' } } });
    } finally {
      db.close();
    }
  });

  it('lists matching artifact files when given a directory prefix', async () => {
    const db = createProjectsDb();
    try {
      seedProject(db);
      await publish(db, makeArtifactBundleBytes());

      const out = getProjectArtifactHandler(
        {
          projectId: 'proj-runtime-1',
          artifactPath: 'pdm/entities',
          sessionSubject: 'acct-runtime-1',
          sessionStatus: 'ACTIVE',
        },
        { qsmDb: db } as never,
      );

      expect(out.status).toBe('ok');
      if (out.status !== 'ok') return;
      expect(out.items).toEqual([
        { path: 'pdm/entities/Project.json', name: 'Project' },
        { path: 'pdm/entities/ProjectVersion.json', name: 'ProjectVersion' },
      ]);
    } finally {
      db.close();
    }
  });

  it('returns PROJECT_VERSION_NOT_FOUND when the project has no published version', () => {
    const db = createProjectsDb();
    try {
      seedProject(db);
      const out = getProjectArtifactHandler(
        {
          projectId: 'cv-extract',
          artifactPath: 'pdm/entities',
          sessionSubject: 'acct-runtime-1',
          sessionStatus: 'ACTIVE',
        },
        { qsmDb: db } as never,
      );
      expect(out.status).toBe('error');
      if (out.status !== 'error') return;
      expect(out.errors[0]?.code).toBe('PROJECT_VERSION_NOT_FOUND');
    } finally {
      db.close();
    }
  });

  it('returns PROJECT_VERSION_BUNDLE_INVALID_SHAPE for an artifact absent from the bundle', async () => {
    const db = createProjectsDb();
    try {
      seedProject(db);
      await publish(db, makeArtifactBundleBytes());
      const out = getProjectArtifactHandler(
        {
          projectId: 'cv-extract',
          artifactPath: 'pdm/entities/Missing.json',
          sessionSubject: 'acct-runtime-1',
          sessionStatus: 'ACTIVE',
        },
        { qsmDb: db } as never,
      );
      expect(out.status).toBe('error');
      if (out.status !== 'error') return;
      expect(out.errors[0]?.code).toBe('PROJECT_VERSION_BUNDLE_INVALID_SHAPE');
    } finally {
      db.close();
    }
  });

  it('returns PLATFORM_AUTH_INVALID without an active edge session', () => {
    const db = createProjectsDb();
    try {
      seedProject(db);
      const out = getProjectArtifactHandler(
        { projectId: 'cv-extract', artifactPath: 'pdm/entities', sessionSubject: null, sessionStatus: null },
        { qsmDb: db } as never,
      );
      expect(out.status).toBe('error');
      if (out.status !== 'error') return;
      expect(out.errors[0]?.code).toBe('PLATFORM_AUTH_INVALID');
    } finally {
      db.close();
    }
  });

  it('returns PLATFORM_TENANCY_PROJECT_NOT_FOUND for an unknown project', () => {
    const db = createProjectsDb();
    try {
      const out = getProjectArtifactHandler(
        {
          projectId: 'no-such-project',
          artifactPath: 'pdm/entities',
          sessionSubject: 'acct-runtime-1',
          sessionStatus: 'ACTIVE',
        },
        { qsmDb: db } as never,
      );
      expect(out.status).toBe('error');
      if (out.status !== 'error') return;
      expect(out.errors[0]?.code).toBe('PLATFORM_TENANCY_PROJECT_NOT_FOUND');
    } finally {
      db.close();
    }
  });
});

describe('listProjectEndpointsHandler', () => {
  function seedProject(db: SqliteDatabase): void {
    db.prepare(`
      INSERT INTO projects (
        id, organization_id, slug, display_name, status, created_at,
        last_event_id, last_event_version, applied_at
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
  }

  function makeEndpointsBundleBytes(): Uint8Array {
    const bundle = {
      version: 2,
      files: {
        'project.json': {
          name: 'cv-extract',
          services: ['app', 'projects'],
          routes: { ui: { '/': 'app' }, http: {} },
          middleware: {},
          mounts: [],
        },
        'services/projects/bindings/bindings.json': {
          bindings: {
            listProjects: { graph: 'listProjects', http: { method: 'GET', path: '/' } },
            createProject: { graph: 'createProject', http: { method: 'POST', path: '/' } },
            malformed: { graph: 'noHttp' },
          },
        },
        'services/app/bindings/bindings.json': {
          bindings: {
            renderHome: { graph: 'renderHome', http: { method: 'GET', path: '/home' } },
          },
        },
      },
    };
    const bytes = Buffer.from(canonicalize(bundle), 'utf8');
    return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  async function publish(db: SqliteDatabase, bodyBytes: Uint8Array): Promise<void> {
    const published = await publishProjectBundleHandler(
      {
        authorization: 'Bearer redacted',
        projectId: 'cv-extract',
        bodyBytes,
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
    expect(published.status).toBe('created');
  }

  it('flattens HTTP endpoint bindings into service-grouped rows', async () => {
    const db = createProjectsDb();
    try {
      seedProject(db);
      await publish(db, makeEndpointsBundleBytes());

      const out = listProjectEndpointsHandler(
        { projectId: 'cv-extract', sessionSubject: 'acct-runtime-1', sessionStatus: 'ACTIVE' },
        { qsmDb: db } as never,
      );

      expect(out.status).toBe('ok');
      if (out.status !== 'ok') return;
      expect(out.endpoints).toEqual([
        { service: 'app', operation: 'renderHome', method: 'GET', path: '/home' },
        { service: 'projects', operation: 'createProject', method: 'POST', path: '/' },
        { service: 'projects', operation: 'listProjects', method: 'GET', path: '/' },
      ]);
    } finally {
      db.close();
    }
  });

  it('resolves the project by canonical id as well as slug', async () => {
    const db = createProjectsDb();
    try {
      seedProject(db);
      await publish(db, makeEndpointsBundleBytes());

      const out = listProjectEndpointsHandler(
        { projectId: 'proj-runtime-1', sessionSubject: 'acct-runtime-1', sessionStatus: 'ACTIVE' },
        { qsmDb: db } as never,
      );
      expect(out.status).toBe('ok');
      if (out.status !== 'ok') return;
      expect(out.endpoints.map((row) => row.service)).toEqual(['app', 'projects', 'projects']);
    } finally {
      db.close();
    }
  });

  it('returns an empty list when the project has no published version', () => {
    const db = createProjectsDb();
    try {
      seedProject(db);
      const out = listProjectEndpointsHandler(
        { projectId: 'cv-extract', sessionSubject: 'acct-runtime-1', sessionStatus: 'ACTIVE' },
        { qsmDb: db } as never,
      );
      expect(out.status).toBe('ok');
      if (out.status !== 'ok') return;
      expect(out.endpoints).toEqual([]);
    } finally {
      db.close();
    }
  });

  it('returns PLATFORM_AUTH_INVALID without an active edge session', () => {
    const db = createProjectsDb();
    try {
      seedProject(db);
      const out = listProjectEndpointsHandler(
        { projectId: 'cv-extract', sessionSubject: null, sessionStatus: null },
        { qsmDb: db } as never,
      );
      expect(out.status).toBe('error');
      if (out.status !== 'error') return;
      expect(out.errors[0]?.code).toBe('PLATFORM_AUTH_INVALID');
    } finally {
      db.close();
    }
  });

  it('returns PLATFORM_TENANCY_PROJECT_NOT_FOUND for an unknown project', () => {
    const db = createProjectsDb();
    try {
      const out = listProjectEndpointsHandler(
        { projectId: 'no-such-project', sessionSubject: 'acct-runtime-1', sessionStatus: 'ACTIVE' },
        { qsmDb: db } as never,
      );
      expect(out.status).toBe('error');
      if (out.status !== 'error') return;
      expect(out.errors[0]?.code).toBe('PLATFORM_TENANCY_PROJECT_NOT_FOUND');
    } finally {
      db.close();
    }
  });
});

describe('listProjectUiComponentsHandler', () => {
  function seedProject(db: SqliteDatabase): void {
    db.prepare(`
      INSERT INTO projects (
        id, organization_id, slug, display_name, status, created_at,
        last_event_id, last_event_version, applied_at
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
  }

  function makeUiBundleBytes(): Uint8Array {
    const bundle = {
      version: 2,
      files: {
        'project.json': {
          name: 'cv-extract',
          services: ['app'],
          routes: { ui: { '/': 'app' }, http: {} },
          middleware: {},
          mounts: [],
        },
        'services/app/ui/manifest.json': { routes: {} },
        'services/app/ui/screens/project.json': { binding: 'x' },
        'services/app/ui/screens/project.spec.json': { root: 'page', elements: {} },
        'services/app/ui/screens/data-model.spec.json': { root: 'page', elements: {} },
        'services/app/ui/layouts/main.spec.json': { root: 'shell', elements: {} },
      },
    };
    const bytes = Buffer.from(canonicalize(bundle), 'utf8');
    return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  async function publish(db: SqliteDatabase, bodyBytes: Uint8Array): Promise<void> {
    const published = await publishProjectBundleHandler(
      {
        authorization: 'Bearer redacted',
        projectId: 'cv-extract',
        bodyBytes,
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
    expect(published.status).toBe('created');
  }

  it('flattens *.spec.json files into kind-classified rows, skipping non-spec json', async () => {
    const db = createProjectsDb();
    try {
      seedProject(db);
      await publish(db, makeUiBundleBytes());

      const out = listProjectUiComponentsHandler(
        { projectId: 'cv-extract', sessionSubject: 'acct-runtime-1', sessionStatus: 'ACTIVE' },
        { qsmDb: db } as never,
      );

      expect(out.status).toBe('ok');
      if (out.status !== 'ok') return;
      expect(out.uiComponents).toEqual([
        { kind: 'layout', name: 'main', path: 'services/app/ui/layouts/main.spec.json' },
        { kind: 'screen', name: 'data-model', path: 'services/app/ui/screens/data-model.spec.json' },
        { kind: 'screen', name: 'project', path: 'services/app/ui/screens/project.spec.json' },
      ]);
    } finally {
      db.close();
    }
  });

  it('resolves the project by canonical id as well as slug', async () => {
    const db = createProjectsDb();
    try {
      seedProject(db);
      await publish(db, makeUiBundleBytes());

      const out = listProjectUiComponentsHandler(
        { projectId: 'proj-runtime-1', sessionSubject: 'acct-runtime-1', sessionStatus: 'ACTIVE' },
        { qsmDb: db } as never,
      );
      expect(out.status).toBe('ok');
      if (out.status !== 'ok') return;
      expect(out.uiComponents.map((row) => row.name)).toEqual(['main', 'data-model', 'project']);
    } finally {
      db.close();
    }
  });

  it('returns an empty list when the project has no published version', () => {
    const db = createProjectsDb();
    try {
      seedProject(db);
      const out = listProjectUiComponentsHandler(
        { projectId: 'cv-extract', sessionSubject: 'acct-runtime-1', sessionStatus: 'ACTIVE' },
        { qsmDb: db } as never,
      );
      expect(out.status).toBe('ok');
      if (out.status !== 'ok') return;
      expect(out.uiComponents).toEqual([]);
    } finally {
      db.close();
    }
  });

  it('returns PLATFORM_AUTH_INVALID without an active edge session', () => {
    const db = createProjectsDb();
    try {
      seedProject(db);
      const out = listProjectUiComponentsHandler(
        { projectId: 'cv-extract', sessionSubject: null, sessionStatus: null },
        { qsmDb: db } as never,
      );
      expect(out.status).toBe('error');
      if (out.status !== 'error') return;
      expect(out.errors[0]?.code).toBe('PLATFORM_AUTH_INVALID');
    } finally {
      db.close();
    }
  });

  it('returns PLATFORM_TENANCY_PROJECT_NOT_FOUND for an unknown project', () => {
    const db = createProjectsDb();
    try {
      const out = listProjectUiComponentsHandler(
        { projectId: 'no-such-project', sessionSubject: 'acct-runtime-1', sessionStatus: 'ACTIVE' },
        { qsmDb: db } as never,
      );
      expect(out.status).toBe('error');
      if (out.status !== 'error') return;
      expect(out.errors[0]?.code).toBe('PLATFORM_TENANCY_PROJECT_NOT_FOUND');
    } finally {
      db.close();
    }
  });
});

describe('listProjectGraphsHandler', () => {
  function seedProject(db: SqliteDatabase): void {
    db.prepare(`
      INSERT INTO projects (
        id, organization_id, slug, display_name, status, created_at,
        last_event_id, last_event_version, applied_at
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
  }

  function makeGraphsBundleBytes(): Uint8Array {
    const bundle = {
      version: 2,
      files: {
        'project.json': {
          name: 'cv-extract',
          services: ['app', 'projects'],
          routes: { ui: { '/': 'app' }, http: {} },
          middleware: {},
          mounts: [],
        },
        'services/projects/graphs/createProject.json': {
          id: 'createProject',
          signature: {},
          nodes: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
        },
        'services/projects/graphs/listProjects.json': {
          id: 'listProjects',
          signature: {},
          nodes: [{ id: 'x' }],
        },
        'services/projects/graphs/shapes.json': { ActionResult: {} },
        'services/app/graphs/renderHome.json': {
          id: 'renderHome',
          signature: {},
          nodes: [{ id: 'r1' }, { id: 'r2' }],
        },
        'services/app/ui/screens/home.spec.json': { root: 'page', elements: {} },
      },
    };
    const bytes = Buffer.from(canonicalize(bundle), 'utf8');
    return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  async function publish(db: SqliteDatabase, bodyBytes: Uint8Array): Promise<void> {
    const published = await publishProjectBundleHandler(
      {
        authorization: 'Bearer redacted',
        projectId: 'cv-extract',
        bodyBytes,
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
    expect(published.status).toBe('created');
  }

  it('flattens graph artifacts into service-grouped rows, skipping shapes.json', async () => {
    const db = createProjectsDb();
    try {
      seedProject(db);
      await publish(db, makeGraphsBundleBytes());

      const out = listProjectGraphsHandler(
        { projectId: 'cv-extract', sessionSubject: 'acct-runtime-1', sessionStatus: 'ACTIVE' },
        { qsmDb: db } as never,
      );

      expect(out.status).toBe('ok');
      if (out.status !== 'ok') return;
      expect(out.graphs).toEqual([
        { service: 'app', graph: 'renderHome', nodeCount: 2 },
        { service: 'projects', graph: 'createProject', nodeCount: 3 },
        { service: 'projects', graph: 'listProjects', nodeCount: 1 },
      ]);
    } finally {
      db.close();
    }
  });

  it('resolves the project by canonical id as well as slug', async () => {
    const db = createProjectsDb();
    try {
      seedProject(db);
      await publish(db, makeGraphsBundleBytes());

      const out = listProjectGraphsHandler(
        { projectId: 'proj-runtime-1', sessionSubject: 'acct-runtime-1', sessionStatus: 'ACTIVE' },
        { qsmDb: db } as never,
      );
      expect(out.status).toBe('ok');
      if (out.status !== 'ok') return;
      expect(out.graphs.map((row) => row.graph)).toEqual([
        'renderHome',
        'createProject',
        'listProjects',
      ]);
    } finally {
      db.close();
    }
  });

  it('returns an empty list when the project has no published version', () => {
    const db = createProjectsDb();
    try {
      seedProject(db);
      const out = listProjectGraphsHandler(
        { projectId: 'cv-extract', sessionSubject: 'acct-runtime-1', sessionStatus: 'ACTIVE' },
        { qsmDb: db } as never,
      );
      expect(out.status).toBe('ok');
      if (out.status !== 'ok') return;
      expect(out.graphs).toEqual([]);
    } finally {
      db.close();
    }
  });

  it('returns PLATFORM_AUTH_INVALID without an active edge session', () => {
    const db = createProjectsDb();
    try {
      seedProject(db);
      const out = listProjectGraphsHandler(
        { projectId: 'cv-extract', sessionSubject: null, sessionStatus: null },
        { qsmDb: db } as never,
      );
      expect(out.status).toBe('error');
      if (out.status !== 'error') return;
      expect(out.errors[0]?.code).toBe('PLATFORM_AUTH_INVALID');
    } finally {
      db.close();
    }
  });

  it('returns PLATFORM_TENANCY_PROJECT_NOT_FOUND for an unknown project', () => {
    const db = createProjectsDb();
    try {
      const out = listProjectGraphsHandler(
        { projectId: 'no-such-project', sessionSubject: 'acct-runtime-1', sessionStatus: 'ACTIVE' },
        { qsmDb: db } as never,
      );
      expect(out.status).toBe('error');
      if (out.status !== 'error') return;
      expect(out.errors[0]?.code).toBe('PLATFORM_TENANCY_PROJECT_NOT_FOUND');
    } finally {
      db.close();
    }
  });
});
