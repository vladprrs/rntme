import { Buffer } from 'node:buffer';
import { describe, expect, it } from 'bun:test';
import { Hono } from 'hono';
import type { AuthSubject, BlobStore } from '@rntme/platform-core';
import { FakeStore, SeededIds, createProject, isOk } from '@rntme/platform-core';
import { projectVersionRoutes } from '../../../src/routes/project-versions.js';

const BUNDLE_CONTENT_TYPE = 'application/rntme-project-bundle+json';

const noopBlob: BlobStore = {
  putIfAbsent: async () => ({ ok: true, value: undefined }),
  presignedGet: async () => ({ ok: true, value: 'https://example.com/presigned' }),
  getJson: async () => ({ ok: false, errors: [{ code: 'PLATFORM_INTERNAL' as const, message: 'not implemented' }] }),
  getRaw: async () => ({ ok: false, errors: [{ code: 'PLATFORM_INTERNAL' as const, message: 'not implemented' }] }),
};

describe('projectVersionRoutes', () => {
  it('emits structured errors[] envelope when blueprint is invalid', async () => {
    const store = new FakeStore();
    const ids = new SeededIds(['project-1']);
    const org = await store.seedOrg({ slug: 'acme', workosOrganizationId: 'org_1', displayName: 'Acme' });
    const account = await store.seedAccount({ workosUserId: 'user_1', displayName: 'Ada', email: 'ada@example.com' });
    const project = await createProject(
      { repos: { projects: store.projects }, ids },
      { orgId: org.id, slug: 'notes-demo', displayName: 'Notes Demo' },
    );
    if (!isOk(project)) throw new Error('seed failed');

    const app = new Hono<{ Variables: { subject: AuthSubject } }>();
    app.use('*', async (c, next) => {
      c.set('subject', {
        org: { id: org.id, workosOrgId: org.workosOrganizationId, slug: org.slug },
        account: { id: account.id, workosUserId: account.workosUserId, displayName: account.displayName, email: account.email },
        role: 'admin',
        scopes: ['version:publish', 'project:read'],
        tokenId: undefined,
      });
      c.set('tx', {} as never);
      await next();
    });
    app.route('/v1/orgs/:orgSlug/projects/:projSlug', projectVersionRoutes({
      blob: noopBlob,
      ids,
      resolveDeps: () => ({
        organizations: store.organizations,
        projects: store.projects,
        projectVersions: store.projectVersions,
      } as never),
    }));

    // Deliberately broken bundle: references a service 'missing' with no service dir
    const bundle = {
      version: 2,
      files: { 'project.json': { name: 'demo', services: ['missing'] } },
      assets: {},
    };

    const res = await app.request('/v1/orgs/acme/projects/notes-demo/versions', {
      method: 'POST',
      body: Buffer.from(JSON.stringify(bundle)),
      headers: { 'content-type': BUNDLE_CONTENT_TYPE },
    });

    expect(res.status).toBe(422);
    const json = await res.json() as { error: { code: string; stage: string; errors: Array<{ code: string; path: string }> } };
    expect(json.error.code).toBe('PROJECT_VERSION_BLUEPRINT_INVALID');
    expect(json.error.stage).toBe('validation');
    expect(Array.isArray(json.error.errors)).toBe(true);
    expect(json.error.errors[0]).toMatchObject({
      code: 'BLUEPRINT_IO_ERROR',
      path: 'pdm',
    });
  });
});
