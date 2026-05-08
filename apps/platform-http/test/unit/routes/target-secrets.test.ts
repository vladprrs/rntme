import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { targetSecretsRoutes } from '../../../src/routes/target-secrets.js';
import type { AuthSubject, DeployTargetRepo, TargetSecretsRepo } from '@rntme/platform-core';
import type { RequestRepos } from '../../../src/resolve-deps.js';

// ---------------------------------------------------------------------------
// Fake helpers
// ---------------------------------------------------------------------------

const FAKE_TARGET_ID = 'target-1';
const FAKE_ORG_ID = 'org-1';
const ORG_SLUG = 'acme';
const TARGET_SLUG = 'my-target';

function fakeDeployTargetRepo(found: boolean): DeployTargetRepo {
  return {
    create: async () => { throw new Error('not used'); },
    update: async () => { throw new Error('not used'); },
    list: async () => ({ ok: true, value: [] }),
    getBySlug: async (_orgId: string, _slug: string) =>
      found
        ? {
            ok: true,
            value: {
              id: FAKE_TARGET_ID,
              orgId: FAKE_ORG_ID,
              slug: TARGET_SLUG,
              displayName: 'My Target',
              kind: 'dokploy' as const,
              dokployUrl: 'https://example.com',
              publicBaseUrl: null,
              dokployProjectId: null,
              dokployProjectName: null,
              allowCreateProject: false,
              eventBusConfig: { enabled: false },
              modules: {},
              auth: { enabled: false },
              policyValues: {},
              isDefault: false,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          }
        : { ok: true, value: null },
    getDefault: async () => ({ ok: true, value: null }),
    getById: async () => ({ ok: true, value: null }),
    setDefault: async () => { throw new Error('not used'); },
    delete: async () => { throw new Error('not used'); },
  } as unknown as DeployTargetRepo;
}

function fakeSecretsRepo(
  initial: Record<string, { schema: string; value: unknown; updatedAt: Date }> = {},
): TargetSecretsRepo {
  const store = { ...initial };
  return {
    async list(_targetId: string) {
      return Object.entries(store).map(([name, e]) => ({
        name,
        schema: e.schema,
        updatedAt: e.updatedAt,
      }));
    },
    async upsert(_targetId: string, record: { name: string; schema: string; value: unknown }, now: Date) {
      store[record.name] = { schema: record.schema, value: record.value, updatedAt: now };
    },
    async remove(_targetId: string, name: string) {
      delete store[name];
    },
    async getAllDecrypted(_targetId: string) {
      const out: Record<string, unknown> = {};
      for (const [name, e] of Object.entries(store)) out[name] = e.value;
      return out;
    },
  };
}

const mockSubject: AuthSubject = {
  account: {
    id: 'acct-1',
    workosUserId: 'user_wos_01',
    displayName: 'Test User',
    email: 'test@example.com',
  },
  org: {
    id: FAKE_ORG_ID,
    workosOrgId: 'org_wos_01',
    slug: ORG_SLUG,
  },
  role: 'admin',
  scopes: ['deploy:target:manage'],
  tokenId: undefined,
};

// ---------------------------------------------------------------------------
// Build test app factory
// ---------------------------------------------------------------------------

function buildApp(opts: {
  targetFound?: boolean;
  secretsRepo?: TargetSecretsRepo;
}) {
  const { targetFound = true, secretsRepo = fakeSecretsRepo() } = opts;
  const deployTargets = fakeDeployTargetRepo(targetFound);

  const app = new Hono<{ Variables: { subject: AuthSubject; tx: unknown } }>();

  // Inject auth subject and a fake tx
  app.use('*', async (c, next) => {
    c.set('subject', mockSubject);
    c.set('tx', {} as never);
    await next();
  });

  const fakeCipher = {} as never;

  app.route(
    `/v1/orgs/:orgSlug/deploy-targets/:targetSlug/secrets`,
    targetSecretsRoutes({
      ids: {} as never,
      cipher: fakeCipher,
      resolveDeps: () =>
        ({
          deployTargets,
        } as unknown as RequestRepos),
      secretsRepoFactory: () => secretsRepo,
    }),
  );

  return app;
}

const BASE = `/v1/orgs/${ORG_SLUG}/deploy-targets/${TARGET_SLUG}/secrets`;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('target-secrets routes', () => {
  describe('GET /', () => {
    it('returns empty secrets array when no secrets exist', async () => {
      const app = buildApp({});
      const res = await app.request(BASE);
      expect(res.status).toBe(200);
      const body = await res.json() as { secrets: unknown[] };
      expect(body.secrets).toEqual([]);
    });

    it('returns names+schema+updatedAt, never values', async () => {
      const now = new Date('2025-01-01T00:00:00.000Z');
      const secretsRepo = fakeSecretsRepo({
        'auth0-mgmt-api-v1': {
          schema: 'auth0-mgmt-api-v1',
          value: { tenantDomain: 'secret.auth0.com', mgmtClientId: 'id', mgmtClientSecret: 'secret' },
          updatedAt: now,
        },
      });
      const app = buildApp({ secretsRepo });
      const res = await app.request(BASE);
      expect(res.status).toBe(200);
      const body = await res.json() as { secrets: Array<{ name: string; schema: string; updatedAt: string }> };
      expect(body.secrets).toHaveLength(1);
      const entry = body.secrets[0];
      expect(entry?.name).toBe('auth0-mgmt-api-v1');
      expect(entry?.schema).toBe('auth0-mgmt-api-v1');
      expect(entry?.updatedAt).toBe(now.toISOString());
      // value must NOT be present
      expect((entry as Record<string, unknown>).value).toBeUndefined();
    });

    it('returns 404 when target not found', async () => {
      const app = buildApp({ targetFound: false });
      const res = await app.request(BASE);
      expect(res.status).toBe(404);
      const body = await res.json() as { error: { code: string } };
      expect(body.error.code).toBe('DEPLOY_TARGET_NOT_FOUND');
    });
  });

  describe('PUT /:secretName', () => {
    it('stores a valid secret and returns name+schema', async () => {
      const secretsRepo = fakeSecretsRepo();
      const app = buildApp({ secretsRepo });
      const res = await app.request(`${BASE}/auth0-mgmt-api-v1`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          schema: 'auth0-mgmt-api-v1',
          value: { tenantDomain: 'example.auth0.com', mgmtClientId: 'client_id', mgmtClientSecret: 'secret_val' },
        }),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as { name: string; schema: string };
      expect(body.name).toBe('auth0-mgmt-api-v1');
      expect(body.schema).toBe('auth0-mgmt-api-v1');
      // value must NOT be in the response
      expect((body as Record<string, unknown>).value).toBeUndefined();
    });

    it('rejects body without schema field', async () => {
      const app = buildApp({});
      const res = await app.request(`${BASE}/my-secret`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ value: { foo: 'bar' } }),
      });
      expect(res.status).toBe(400);
      const body = await res.json() as { error: { code: string } };
      expect(body.error.code).toBe('TARGET_SECRET_SCHEMA_REQUIRED');
    });

    it('rejects an unknown schema id', async () => {
      const app = buildApp({});
      const res = await app.request(`${BASE}/my-secret`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ schema: 'unknown-schema-xyz', value: {} }),
      });
      expect(res.status).toBe(400);
      const body = await res.json() as { error: { code: string } };
      expect(body.error.code).toBe('TARGET_SECRET_SCHEMA_UNKNOWN');
    });

    it('rejects a body that does not match the schema', async () => {
      const app = buildApp({});
      const res = await app.request(`${BASE}/my-secret`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          schema: 'auth0-mgmt-api-v1',
          value: { tenantDomain: 'example.auth0.com' }, // missing required fields
        }),
      });
      expect(res.status).toBe(400);
      const body = await res.json() as { error: { code: string } };
      expect(body.error.code).toBe('TARGET_SECRET_VALIDATION_FAILED');
    });

    it('stores a valid operaton-ui-basic-auth-v1 secret', async () => {
      const secretsRepo = fakeSecretsRepo();
      const app = buildApp({ secretsRepo });
      const res = await app.request(`${BASE}/operaton-ui-basic-auth-v1`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          schema: 'operaton-ui-basic-auth-v1',
          value: { htpasswd: 'admin:$2y$10$...\nuser:$2y$10$...' },
        }),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as { name: string; schema: string };
      expect(body.name).toBe('operaton-ui-basic-auth-v1');
      expect(body.schema).toBe('operaton-ui-basic-auth-v1');
    });

    it('rejects operaton-ui-basic-auth-v1 with invalid htpasswd format', async () => {
      const app = buildApp({});
      const res = await app.request(`${BASE}/operaton-ui-basic-auth-v1`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          schema: 'operaton-ui-basic-auth-v1',
          value: { htpasswd: 'no-colon-line' },
        }),
      });
      expect(res.status).toBe(400);
      const body = await res.json() as { error: { code: string } };
      expect(body.error.code).toBe('TARGET_SECRET_VALIDATION_FAILED');
    });

    it('stores a valid operaton-admin-user-v1 secret', async () => {
      const secretsRepo = fakeSecretsRepo();
      const app = buildApp({ secretsRepo });
      const res = await app.request(`${BASE}/operaton-admin-user-v1`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          schema: 'operaton-admin-user-v1',
          value: { id: 'admin', password: 'secret', firstName: 'Admin', lastName: 'User' },
        }),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as { name: string; schema: string };
      expect(body.name).toBe('operaton-admin-user-v1');
      expect(body.schema).toBe('operaton-admin-user-v1');
    });

    it('stores operaton-admin-user-v1 with optional email', async () => {
      const secretsRepo = fakeSecretsRepo();
      const app = buildApp({ secretsRepo });
      const res = await app.request(`${BASE}/operaton-admin-user-v1`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          schema: 'operaton-admin-user-v1',
          value: { id: 'admin', password: 'secret', firstName: 'Admin', lastName: 'User', email: 'admin@example.com' },
        }),
      });
      expect(res.status).toBe(200);
    });

    it('rejects operaton-admin-user-v1 missing required fields', async () => {
      const app = buildApp({});
      const res = await app.request(`${BASE}/operaton-admin-user-v1`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          schema: 'operaton-admin-user-v1',
          value: { id: 'admin' },
        }),
      });
      expect(res.status).toBe(400);
      const body = await res.json() as { error: { code: string } };
      expect(body.error.code).toBe('TARGET_SECRET_VALIDATION_FAILED');
    });

    it('returns 404 when target not found', async () => {
      const app = buildApp({ targetFound: false });
      const res = await app.request(`${BASE}/auth0-mgmt-api-v1`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ schema: 'auth0-mgmt-api-v1', value: {} }),
      });
      expect(res.status).toBe(404);
      const body = await res.json() as { error: { code: string } };
      expect(body.error.code).toBe('DEPLOY_TARGET_NOT_FOUND');
    });
  });

  describe('DELETE /:secretName', () => {
    it('removes an existing secret and returns 204', async () => {
      const now = new Date();
      const secretsRepo = fakeSecretsRepo({
        'auth0-mgmt-api-v1': { schema: 'auth0-mgmt-api-v1', value: {}, updatedAt: now },
      });
      const app = buildApp({ secretsRepo });
      const res = await app.request(`${BASE}/auth0-mgmt-api-v1`, { method: 'DELETE' });
      expect(res.status).toBe(204);
      // Confirm removal
      const listRes = await app.request(BASE);
      const listBody = await listRes.json() as { secrets: unknown[] };
      expect(listBody.secrets).toHaveLength(0);
    });

    it('returns 204 even when the named secret does not exist (idempotent delete)', async () => {
      const app = buildApp({});
      const res = await app.request(`${BASE}/non-existent`, { method: 'DELETE' });
      expect(res.status).toBe(204);
    });

    it('returns 404 when target not found', async () => {
      const app = buildApp({ targetFound: false });
      const res = await app.request(`${BASE}/some-secret`, { method: 'DELETE' });
      expect(res.status).toBe(404);
      const body = await res.json() as { error: { code: string } };
      expect(body.error.code).toBe('DEPLOY_TARGET_NOT_FOUND');
    });
  });
});
