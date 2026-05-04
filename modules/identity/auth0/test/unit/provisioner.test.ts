import { describe, expect, it, vi } from 'vitest';
import { provision, tearDown, ENV_MAPPINGS } from '../../src/provisioner.js';

const baseInput = {
  publicConfig: {
    appName: 'test-organization-notes-demo-default',
    redirectUri: 'https://notes-demo.rntme.com/',
    audience: 'https://notes-demo.rntme.com/api',
    allowedOrigins: ['https://notes-demo.rntme.com'],
    allowedLogoutUrls: ['https://notes-demo.rntme.com/'],
    organizationsCapability: 'allow' as const,
    m2mClients: [{ name: 'introspect', scopes: ['read:resource_servers'] }],
  },
  targetSecrets: {
    auth0Mgmt: { tenantDomain: 'demo.us.auth0.com', mgmtClientId: 'a', mgmtClientSecret: 'b' },
  },
  log: () => undefined,
  signal: new AbortController().signal,
};

describe('provision — create path', () => {
  it('creates SPA client + Resource Server + M2M when none exist', async () => {
    const calls: { method: string; path: string; body?: unknown }[] = [];
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      const u = new URL(url);
      calls.push({ method: init?.method ?? 'GET', path: u.pathname + u.search, body: init?.body });
      if (u.pathname === '/oauth/token') return new Response(JSON.stringify({ access_token: 't', expires_in: 3600 }), { status: 200 });
      if (u.pathname === '/api/v2/clients' && (!init?.method || init.method === 'GET')) return new Response('[]', { status: 200 });
      if (u.pathname === '/api/v2/clients' && init?.method === 'POST') {
        const body = JSON.parse(String(init.body));
        return new Response(JSON.stringify({ client_id: `cid_${body.app_type}`, name: body.name, client_secret: 'm2m_sec', ...body }), { status: 201 });
      }
      if (u.pathname === '/api/v2/resource-servers' && (!init?.method || init.method === 'GET')) return new Response('[]', { status: 200 });
      if (u.pathname === '/api/v2/resource-servers' && init?.method === 'POST') {
        const body = JSON.parse(String(init.body));
        return new Response(JSON.stringify({ id: 'rs_1', ...body }), { status: 201 });
      }
      if (u.pathname === '/api/v2/connections') return new Response(JSON.stringify([{ id: 'conn_1', name: 'Username-Password-Authentication', enabled_clients: [] }]), { status: 200 });
      if (u.pathname.startsWith('/api/v2/connections/')) return new Response('{}', { status: 200 });
      if (u.pathname === '/api/v2/client-grants' && (!init?.method || init.method === 'GET')) return new Response('[]', { status: 200 });
      if (u.pathname === '/api/v2/client-grants' && init?.method === 'POST') return new Response('{"id":"grant_1"}', { status: 201 });
      throw new Error(`unhandled ${u.pathname}`);
    });

    const out = await provision({ ...baseInput, fetch: fetcher as typeof fetch });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.value.publicOutputs).toMatchObject({
      spaClient: { name: 'test-organization-notes-demo-default' },
      resourceServer: { id: 'rs_1', identifier: 'https://notes-demo.rntme.com/api' },
    });
    expect(out.value.secretOutputs.m2mClients).toEqual([
      { name: 'introspect', clientId: expect.any(String), clientSecret: 'm2m_sec' },
    ]);

    const spaPost = calls.find((c) => c.method === 'POST' && c.path === '/api/v2/clients' && JSON.parse(String(c.body)).app_type === 'spa');
    expect(spaPost).toBeTruthy();
    const spaBody = JSON.parse(String(spaPost!.body));
    expect(spaBody.token_endpoint_auth_method).toBe('none');
    expect(spaBody.grant_types).toEqual(['authorization_code', 'refresh_token']);
  });
});

describe('provision — reconcile path', () => {
  it('PATCHes a SPA client whose token_endpoint_auth_method differs from desired', async () => {
    let patchCalled = false;
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      const u = new URL(url);
      if (u.pathname === '/oauth/token') return new Response(JSON.stringify({ access_token: 't', expires_in: 3600 }), { status: 200 });
      if (u.pathname === '/api/v2/clients' && u.searchParams.get('name')?.includes('m2m')) return new Response('[]', { status: 200 });
      if (u.pathname === '/api/v2/clients' && (!init?.method || init.method === 'GET')) {
        return new Response(JSON.stringify([{
          client_id: 'spa_existing',
          name: baseInput.publicConfig.appName,
          app_type: 'spa',
          token_endpoint_auth_method: 'client_secret_post',
          grant_types: ['authorization_code', 'refresh_token'],
          callbacks: [baseInput.publicConfig.redirectUri],
          web_origins: baseInput.publicConfig.allowedOrigins,
          allowed_origins: baseInput.publicConfig.allowedOrigins,
          allowed_logout_urls: baseInput.publicConfig.allowedLogoutUrls,
          organization_usage: 'allow',
        }]), { status: 200 });
      }
      if (u.pathname.startsWith('/api/v2/clients/spa_existing') && init?.method === 'PATCH') {
        patchCalled = true;
        const body = JSON.parse(String(init.body));
        expect(body.token_endpoint_auth_method).toBe('none');
        return new Response(JSON.stringify({ client_id: 'spa_existing', name: baseInput.publicConfig.appName, ...body }), { status: 200 });
      }
      if (u.pathname === '/api/v2/clients' && init?.method === 'POST') return new Response(JSON.stringify({ client_id: 'm2m_c', name: 'm2m', client_secret: 's' }), { status: 201 });
      if (u.pathname === '/api/v2/resource-servers' && (!init?.method || init.method === 'GET')) return new Response(JSON.stringify([{ id: 'rs_1', identifier: baseInput.publicConfig.audience, name: `${baseInput.publicConfig.appName} API`, signing_alg: 'RS256', token_dialect: 'access_token_authz', enforce_policies: true }]), { status: 200 });
      if (u.pathname.startsWith('/api/v2/resource-servers/') && init?.method === 'PATCH') return new Response(JSON.stringify({ id: 'rs_1', identifier: baseInput.publicConfig.audience }), { status: 200 });
      if (u.pathname === '/api/v2/connections') return new Response(JSON.stringify([{ id: 'conn_1', name: 'Username-Password-Authentication' }]), { status: 200 });
      if (u.pathname === '/api/v2/connections/conn_1/clients') return new Response(JSON.stringify([{ client_id: 'spa_existing' }]), { status: 200 });
      if (u.pathname === '/api/v2/client-grants' && (!init?.method || init.method === 'GET')) return new Response('[{"id":"g","client_id":"m2m_c","audience":"https://notes-demo.rntme.com/api","scope":["read:resource_servers"]}]', { status: 200 });
      throw new Error(`unhandled ${u.pathname}`);
    });

    const out = await provision({ ...baseInput, fetch: fetcher as typeof fetch });
    expect(out.ok).toBe(true);
    expect(patchCalled).toBe(true);
  });
});

describe('provision — reconcile resource server', () => {
  it('PATCH /resource-servers/{id} body excludes immutable identifier and id', async () => {
    let rsPatchBody: Record<string, unknown> | undefined;
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      const u = new URL(url);
      if (u.pathname === '/oauth/token') return new Response(JSON.stringify({ access_token: 't', expires_in: 3600 }), { status: 200 });
      if (u.pathname === '/api/v2/clients' && u.searchParams.get('name')?.includes('m2m')) {
        return new Response(JSON.stringify([{ client_id: 'm2m_c', name: 'test-organization-notes-demo-default-m2m-introspect', app_type: 'non_interactive', grant_types: ['client_credentials'], token_endpoint_auth_method: 'client_secret_post' }]), { status: 200 });
      }
      if (u.pathname === '/api/v2/clients' && (!init?.method || init.method === 'GET')) {
        return new Response(JSON.stringify([{
          client_id: 'spa_x', name: baseInput.publicConfig.appName,
          app_type: 'spa', token_endpoint_auth_method: 'none',
          grant_types: ['authorization_code', 'refresh_token'],
          callbacks: [baseInput.publicConfig.redirectUri],
          web_origins: baseInput.publicConfig.allowedOrigins,
          allowed_origins: baseInput.publicConfig.allowedOrigins,
          allowed_logout_urls: baseInput.publicConfig.allowedLogoutUrls,
          organization_usage: 'allow',
        }]), { status: 200 });
      }
      // Existing resource server has stale `name`, forcing reconcileResourceServer to PATCH.
      if (u.pathname === '/api/v2/resource-servers' && (!init?.method || init.method === 'GET')) {
        return new Response(JSON.stringify([{
          id: 'rs_1',
          identifier: baseInput.publicConfig.audience,
          name: 'old-stale-name',
          signing_alg: 'RS256',
          token_dialect: 'access_token_authz',
          enforce_policies: true,
        }]), { status: 200 });
      }
      if (u.pathname.startsWith('/api/v2/resource-servers/') && init?.method === 'PATCH') {
        rsPatchBody = JSON.parse(String(init.body));
        return new Response(JSON.stringify({ id: 'rs_1', identifier: baseInput.publicConfig.audience, name: `${baseInput.publicConfig.appName} API` }), { status: 200 });
      }
      if (u.pathname === '/api/v2/connections') return new Response(JSON.stringify([{ id: 'conn_1', name: 'Username-Password-Authentication' }]), { status: 200 });
      if (u.pathname === '/api/v2/connections/conn_1/clients') return new Response(JSON.stringify([{ client_id: 'spa_x' }]), { status: 200 });
      if (u.pathname === '/api/v2/client-grants') return new Response(JSON.stringify([{ id: 'g', client_id: 'm2m_c', audience: baseInput.publicConfig.audience, scope: ['read:resource_servers'] }]), { status: 200 });
      throw new Error(`unhandled ${u.pathname}`);
    });

    const out = await provision({ ...baseInput, fetch: fetcher as typeof fetch });
    expect(out.ok).toBe(true);
    expect(rsPatchBody).toBeDefined();
    // Auth0 PATCH /resource-servers/{id} rejects identifier (and id) as
    // "Additional properties not allowed". Both must be absent from the body.
    expect(rsPatchBody!).not.toHaveProperty('identifier');
    expect(rsPatchBody!).not.toHaveProperty('id');
    expect(rsPatchBody!.name).toBe(`${baseInput.publicConfig.appName} API`);
  });
});

describe('provision — no-op path', () => {
  it('issues zero PATCH/POST when state is already converged', async () => {
    const mutations: string[] = [];
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      const u = new URL(url);
      const method = init?.method ?? 'GET';
      if ((method === 'POST' || method === 'PATCH') && u.pathname.startsWith('/api/v2/')) mutations.push(`${method} ${u.pathname}`);
      if (u.pathname === '/oauth/token') return new Response(JSON.stringify({ access_token: 't', expires_in: 3600 }), { status: 200 });
      // Return fully-converged state for everything
      if (u.pathname === '/api/v2/clients' && u.searchParams.get('name')?.includes('m2m')) {
        return new Response(JSON.stringify([{ client_id: 'm2m_c', name: 'test-organization-notes-demo-default-m2m-introspect', app_type: 'non_interactive', grant_types: ['client_credentials'], token_endpoint_auth_method: 'client_secret_post' }]), { status: 200 });
      }
      if (u.pathname === '/api/v2/clients') {
        return new Response(JSON.stringify([{
          client_id: 'spa_x', name: baseInput.publicConfig.appName,
          app_type: 'spa', token_endpoint_auth_method: 'none',
          grant_types: ['authorization_code', 'refresh_token'],
          callbacks: [baseInput.publicConfig.redirectUri],
          web_origins: baseInput.publicConfig.allowedOrigins,
          allowed_origins: baseInput.publicConfig.allowedOrigins,
          allowed_logout_urls: baseInput.publicConfig.allowedLogoutUrls,
          organization_usage: 'allow',
        }]), { status: 200 });
      }
      if (u.pathname === '/api/v2/resource-servers') return new Response(JSON.stringify([{ id: 'rs_1', identifier: baseInput.publicConfig.audience, name: `${baseInput.publicConfig.appName} API`, signing_alg: 'RS256', token_dialect: 'access_token_authz', enforce_policies: true }]), { status: 200 });
      if (u.pathname === '/api/v2/connections') return new Response(JSON.stringify([{ id: 'conn_1', name: 'Username-Password-Authentication' }]), { status: 200 });
      if (u.pathname === '/api/v2/connections/conn_1/clients') return new Response(JSON.stringify([{ client_id: 'spa_x' }]), { status: 200 });
      if (u.pathname === '/api/v2/client-grants') return new Response(JSON.stringify([{ id: 'g', client_id: 'm2m_c', audience: baseInput.publicConfig.audience, scope: ['read:resource_servers'] }]), { status: 200 });
      throw new Error(`unhandled ${u.pathname}`);
    });

    const out = await provision({
      ...baseInput,
      priorOutputs: {
        publicOutputs: { spaClient: { id: 'spa_x', name: baseInput.publicConfig.appName }, resourceServer: { id: 'rs_1', identifier: baseInput.publicConfig.audience } },
        secretOutputs: { m2mClients: [{ name: 'introspect', clientId: 'm2m_c', clientSecret: 'kept' }] },
      },
      fetch: fetcher as typeof fetch,
    });

    expect(out.ok).toBe(true);
    expect(mutations).toEqual([]);
  });
});

describe('provision — idempotence', () => {
  it('twice in a row produces identical outputs and zero extra mutations', async () => {
    const mutations: string[] = [];
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      const u = new URL(url);
      const method = init?.method ?? 'GET';
      if ((method === 'POST' || method === 'PATCH') && u.pathname.startsWith('/api/v2/')) mutations.push(`${method} ${u.pathname}`);
      if (u.pathname === '/oauth/token') return new Response(JSON.stringify({ access_token: 't', expires_in: 3600 }), { status: 200 });
      // Return fully-converged state for everything (same as no-op test)
      if (u.pathname === '/api/v2/clients' && u.searchParams.get('name')?.includes('m2m')) {
        return new Response(JSON.stringify([{ client_id: 'm2m_c', name: 'test-organization-notes-demo-default-m2m-introspect', app_type: 'non_interactive', grant_types: ['client_credentials'], token_endpoint_auth_method: 'client_secret_post' }]), { status: 200 });
      }
      if (u.pathname === '/api/v2/clients') {
        return new Response(JSON.stringify([{
          client_id: 'spa_x', name: baseInput.publicConfig.appName,
          app_type: 'spa', token_endpoint_auth_method: 'none',
          grant_types: ['authorization_code', 'refresh_token'],
          callbacks: [baseInput.publicConfig.redirectUri],
          web_origins: baseInput.publicConfig.allowedOrigins,
          allowed_origins: baseInput.publicConfig.allowedOrigins,
          allowed_logout_urls: baseInput.publicConfig.allowedLogoutUrls,
          organization_usage: 'allow',
        }]), { status: 200 });
      }
      if (u.pathname === '/api/v2/resource-servers') return new Response(JSON.stringify([{ id: 'rs_1', identifier: baseInput.publicConfig.audience, name: `${baseInput.publicConfig.appName} API`, signing_alg: 'RS256', token_dialect: 'access_token_authz', enforce_policies: true }]), { status: 200 });
      if (u.pathname === '/api/v2/connections') return new Response(JSON.stringify([{ id: 'conn_1', name: 'Username-Password-Authentication' }]), { status: 200 });
      if (u.pathname === '/api/v2/connections/conn_1/clients') return new Response(JSON.stringify([{ client_id: 'spa_x' }]), { status: 200 });
      if (u.pathname === '/api/v2/client-grants') return new Response(JSON.stringify([{ id: 'g', client_id: 'm2m_c', audience: baseInput.publicConfig.audience, scope: ['read:resource_servers'] }]), { status: 200 });
      throw new Error(`unhandled ${u.pathname}`);
    });

    const priorOutputs = {
      publicOutputs: { spaClient: { id: 'spa_x', name: baseInput.publicConfig.appName }, resourceServer: { id: 'rs_1', identifier: baseInput.publicConfig.audience } },
      secretOutputs: { m2mClients: [{ name: 'introspect', clientId: 'm2m_c', clientSecret: 'kept' }] },
    };

    const a = await provision({ ...baseInput, priorOutputs, fetch: fetcher as typeof fetch });
    const mutationsAfterFirst = [...mutations];
    const b = await provision({ ...baseInput, priorOutputs, fetch: fetcher as typeof fetch });

    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) {
      expect(b.value).toEqual(a.value);
    }
    expect(mutations).toEqual(mutationsAfterFirst);
  });
});

describe('ENV_MAPPINGS', () => {
  it('exposes the expected mappings', () => {
    expect(ENV_MAPPINGS).toMatchObject({
      'identity-auth0': expect.arrayContaining([
        expect.objectContaining({ envName: 'AUTH0_SPA_CLIENT_ID' }),
        expect.objectContaining({ envName: 'AUTH0_AUDIENCE' }),
        expect.objectContaining({ envName: expect.stringContaining('AUTH0_M2M_') }),
      ]),
    });
  });
});

describe('tearDown', () => {
  it('deletes M2M clients, client-grants, resource server, and SPA client', async () => {
    const deletes: string[] = [];
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      const u = new URL(url);
      if (u.pathname === '/oauth/token') return new Response(JSON.stringify({ access_token: 't', expires_in: 3600 }), { status: 200 });
      if (init?.method === 'DELETE') {
        deletes.push(u.pathname);
        return new Response('{}', { status: 200 });
      }
      if (u.pathname === '/api/v2/client-grants') return new Response('[{"id":"g","client_id":"m2m_c","audience":"https://x/api"}]', { status: 200 });
      if (u.pathname === '/api/v2/connections') return new Response(JSON.stringify([{ id: 'conn_1', name: 'Username-Password-Authentication', enabled_clients: ['spa_x', 'other_app'] }]), { status: 200 });
      if (u.pathname.startsWith('/api/v2/connections/')) return new Response('{}', { status: 200 });
      throw new Error(`unhandled ${u.pathname}`);
    }) as unknown as typeof fetch;
    const r = await tearDown({ ...baseInput, priorOutputs: {
      publicOutputs: { spaClient: { id: 'spa_x' }, resourceServer: { id: 'rs_1', identifier: 'https://x/api' } },
      secretOutputs: { m2mClients: [{ name: 'introspect', clientId: 'm2m_c', clientSecret: 'shh' }] },
    }, fetch: fetcher });
    expect(r.ok).toBe(true);
    expect(deletes).toContain('/api/v2/client-grants/g');
    expect(deletes).toContain('/api/v2/clients/m2m_c');
    expect(deletes).toContain('/api/v2/resource-servers/rs_1');
    expect(deletes).toContain('/api/v2/clients/spa_x');
  });

  it('disables only the SPA client from the connection, leaving others untouched', async () => {
    // Auth0 deprecated PATCH /connections.enabled_clients in favor of
    // dedicated DELETE /connections/{id}/clients/{clientId}. tearDown must
    // call the dedicated endpoint targeting only the SPA being removed —
    // there is no "list-and-rewrite" path that could accidentally drop
    // sibling clients (`other_app`).
    const deletes: string[] = [];
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      const u = new URL(url);
      if (u.pathname === '/oauth/token') return new Response(JSON.stringify({ access_token: 't', expires_in: 3600 }), { status: 200 });
      if (u.pathname === '/api/v2/connections' && (!init?.method || init.method === 'GET')) return new Response(JSON.stringify([{ id: 'conn_1', name: 'Username-Password-Authentication' }]), { status: 200 });
      if (init?.method === 'DELETE') {
        deletes.push(u.pathname);
        return new Response(null, { status: 204 });
      }
      if (u.pathname === '/api/v2/client-grants') return new Response('[]', { status: 200 });
      throw new Error(`unhandled ${u.pathname}`);
    }) as unknown as typeof fetch;
    const r = await tearDown({ ...baseInput, priorOutputs: {
      publicOutputs: { spaClient: { id: 'spa_x' } },
      secretOutputs: { m2mClients: [] },
    }, fetch: fetcher });
    expect(r.ok).toBe(true);
    expect(deletes).toContain('/api/v2/connections/conn_1/clients/spa_x');
    // No DELETE targeting `other_app` — the old code path that rewrote the
    // full enabled_clients list would have been the only way to disturb it.
    expect(deletes.some((p) => p.endsWith('/clients/other_app'))).toBe(false);
  });

  it('treats 404 on delete as success (idempotent)', async () => {
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      const u = new URL(url);
      if (u.pathname === '/oauth/token') return new Response(JSON.stringify({ access_token: 't', expires_in: 3600 }), { status: 200 });
      if (u.pathname === '/api/v2/connections') return new Response('[]', { status: 200 });
      if (u.pathname === '/api/v2/client-grants') return new Response('[]', { status: 200 });
      if (init?.method === 'DELETE') return new Response('', { status: 404 });
      throw new Error(`unhandled ${u.pathname}`);
    }) as unknown as typeof fetch;
    const r = await tearDown({ ...baseInput, priorOutputs: {
      publicOutputs: { spaClient: { id: 'spa_x' }, resourceServer: { id: 'rs_1', identifier: 'https://x/api' } },
      secretOutputs: { m2mClients: [{ name: 'a', clientId: 'm', clientSecret: 's' }] },
    }, fetch: fetcher });
    expect(r.ok).toBe(true);
  });
});
