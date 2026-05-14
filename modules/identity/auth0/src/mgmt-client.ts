import type { Result } from './result-shim.js';
import { err, ok } from './result-shim.js';

export type MgmtError = { code: string; message: string };

export type Auth0Client = {
  client_id: string;
  name: string;
  app_type?: string;
  token_endpoint_auth_method?: string;
  client_secret?: string;
  grant_types?: string[];
  callbacks?: string[];
  web_origins?: string[];
  allowed_origins?: string[];
  allowed_logout_urls?: string[];
  organization_usage?: 'allow' | 'deny' | 'require';
  organization_require_behavior?: 'no_prompt' | 'pre_login_prompt' | 'post_login_prompt';
};

export type Auth0ResourceServer = {
  id: string;
  identifier: string;
  name?: string;
  signing_alg?: string;
  token_dialect?: string;
  enforce_policies?: boolean;
};

export type Auth0Connection = {
  id: string;
  name: string;
  enabled_clients?: string[];
};

export type Auth0ClientGrant = {
  id: string;
  client_id: string;
  audience: string;
  scope?: string[];
};

export type MgmtClientConfig = {
  tenantDomain: string;
  mgmtClientId: string;
  mgmtClientSecret: string;
  fetch?: typeof globalThis.fetch;
  retryDelayMs?: number;
};

export type MgmtClient = {
  findClientByName(name: string): Promise<Result<Auth0Client | null, MgmtError>>;
  createClient(body: Partial<Auth0Client>): Promise<Result<Auth0Client, MgmtError>>;
  patchClient(id: string, body: Partial<Auth0Client>): Promise<Result<Auth0Client, MgmtError>>;
  deleteClient(id: string): Promise<Result<void, MgmtError>>;

  findResourceServerByIdentifier(identifier: string): Promise<Result<Auth0ResourceServer | null, MgmtError>>;
  createResourceServer(body: Partial<Auth0ResourceServer>): Promise<Result<Auth0ResourceServer, MgmtError>>;
  patchResourceServer(id: string, body: Partial<Auth0ResourceServer>): Promise<Result<Auth0ResourceServer, MgmtError>>;
  deleteResourceServer(id: string): Promise<Result<void, MgmtError>>;

  findConnectionByName(name: string): Promise<Result<Auth0Connection | null, MgmtError>>;
  patchConnection(id: string, body: Partial<Auth0Connection>): Promise<Result<Auth0Connection, MgmtError>>;
  /**
   * Auth0 deprecated `enabled_clients` on `PATCH /connections/{id}`; the
   * Management API rejects it with `Additional properties not allowed:
   * enabled_clients`. The dedicated client-membership endpoints below are
   * the replacement: `POST /connections/{id}/clients/{client_id}` to enable,
   * `DELETE /connections/{id}/clients/{client_id}` to disable, and
   * `GET /connections/{id}/clients` to enumerate. All three return 204 or
   * a paginated list and are safe to call unconditionally — the POST is
   * idempotent (Auth0 returns 204 for an already-enabled client).
   */
  listConnectionClients(id: string): Promise<Result<readonly { readonly client_id: string }[], MgmtError>>;
  enableConnectionClient(connectionId: string, clientId: string): Promise<Result<void, MgmtError>>;
  disableConnectionClient(connectionId: string, clientId: string): Promise<Result<void, MgmtError>>;

  listClientGrants(clientId: string, audience: string): Promise<Result<Auth0ClientGrant[], MgmtError>>;
  createClientGrant(body: { client_id: string; audience: string; scope: string[] }): Promise<Result<Auth0ClientGrant, MgmtError>>;
  deleteClientGrant(id: string): Promise<Result<void, MgmtError>>;
};

export function createMgmtClient(cfg: MgmtClientConfig): MgmtClient {
  const fetcher = cfg.fetch ?? globalThis.fetch;
  const retryDelay = cfg.retryDelayMs ?? 250;
  const apiBase = `https://${cfg.tenantDomain}/api/v2`;
  let token: { value: string; expiresAt: number } | null = null;

  async function getToken(): Promise<Result<string, MgmtError>> {
    if (token && token.expiresAt > Date.now() + 30_000) return ok(token.value);
    const res = await fetcher(`https://${cfg.tenantDomain}/oauth/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: cfg.mgmtClientId,
        client_secret: cfg.mgmtClientSecret,
        audience: `https://${cfg.tenantDomain}/api/v2/`,
      }),
    });
    if (res.status === 401 || res.status === 403) {
      return err([{ code: 'AUTH0_UNAUTHORIZED', message: 'mgmt token request failed; rotate target secret auth0Mgmt' }]);
    }
    if (!res.ok) return err([{ code: 'AUTH0_UPSTREAM_5XX', message: `token endpoint returned ${res.status}` }]);
    const body = (await res.json()) as { access_token: string; expires_in: number };
    token = { value: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
    return ok(body.access_token);
  }

  async function call<T>(method: string, path: string, body?: unknown): Promise<Result<T, MgmtError>> {
    for (let attempt = 0; attempt < 3; attempt++) {
      const tok = await getToken();
      if (!tok.ok) return err(tok.errors as MgmtError[]);
      const res = await fetcher(`${apiBase}${path}`, {
        method,
        headers: { authorization: `Bearer ${tok.value}`, 'content-type': 'application/json' },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      if (res.status === 429) {
        if (attempt === 2) return err([{ code: 'AUTH0_RATE_LIMITED', message: `429 after 3 attempts on ${method} ${path}` }]);
        await new Promise((r) => globalThis.setTimeout(r, retryDelay * Math.pow(2, attempt)));
        continue;
      }
      if (res.status === 404 && method === 'DELETE') return ok(undefined as T);
      if (res.status === 401 || res.status === 403) return err([{ code: 'AUTH0_UNAUTHORIZED', message: `${res.status} on ${method} ${path}` }]);
      if (res.status === 409) return err([{ code: 'AUTH0_CONFLICT', message: `409 on ${method} ${path}` }]);
      if (res.status >= 500) return err([{ code: 'AUTH0_UPSTREAM_5XX', message: `${res.status} on ${method} ${path}` }]);
      if (res.status >= 400) {
        const text = await res.text();
        return err([{ code: 'AUTH0_INVALID_INPUT', message: `${res.status} on ${method} ${path}: ${text.slice(0, 200)}` }]);
      }
      if (res.status === 204) return ok(undefined as T);
      return ok((await res.json()) as T);
    }
    return err([{ code: 'AUTH0_RATE_LIMITED', message: 'unreachable' }]);
  }

  return {
    async findClientByName(name) {
      const r = await call<Auth0Client[]>('GET', `/clients?name=${encodeURIComponent(name)}&fields=client_id,name,app_type,token_endpoint_auth_method,grant_types,callbacks,web_origins,allowed_origins,allowed_logout_urls,organization_usage&include_fields=true`);
      if (!r.ok) return r;
      return ok(r.value[0] ?? null);
    },
    createClient: (body) => call<Auth0Client>('POST', '/clients', body),
    patchClient: (id, body) => call<Auth0Client>('PATCH', `/clients/${encodeURIComponent(id)}`, body),
    deleteClient: (id) => call<void>('DELETE', `/clients/${encodeURIComponent(id)}`),
    async findResourceServerByIdentifier(identifier) {
      const r = await call<Auth0ResourceServer[]>('GET', `/resource-servers?identifiers=${encodeURIComponent(identifier)}`);
      if (!r.ok) return r;
      return ok(r.value[0] ?? null);
    },
    createResourceServer: (body) => call<Auth0ResourceServer>('POST', '/resource-servers', body),
    patchResourceServer: (id, body) => call<Auth0ResourceServer>('PATCH', `/resource-servers/${encodeURIComponent(id)}`, body),
    deleteResourceServer: (id) => call<void>('DELETE', `/resource-servers/${encodeURIComponent(id)}`),
    async findConnectionByName(name) {
      const r = await call<Auth0Connection[]>('GET', `/connections?name=${encodeURIComponent(name)}&strategy=auth0`);
      if (!r.ok) return r;
      return ok(r.value[0] ?? null);
    },
    patchConnection: (id, body) => call<Auth0Connection>('PATCH', `/connections/${encodeURIComponent(id)}`, body),
    async listConnectionClients(id) {
      const r = await call<{ clients?: { client_id: string }[] } | { client_id: string }[]>(
        'GET',
        `/connections/${encodeURIComponent(id)}/clients`,
      );
      if (!r.ok) return r;
      // Auth0 returns either a bare array or a paginated envelope depending
      // on whether `take`/`include_totals` are passed. Normalize to a flat list.
      const clients = Array.isArray(r.value) ? r.value : r.value.clients ?? [];
      return ok(clients.map((c) => ({ client_id: c.client_id })));
    },
    enableConnectionClient: (connectionId, clientId) =>
      call<void>(
        'POST',
        `/connections/${encodeURIComponent(connectionId)}/clients/${encodeURIComponent(clientId)}`,
      ),
    disableConnectionClient: (connectionId, clientId) =>
      call<void>(
        'DELETE',
        `/connections/${encodeURIComponent(connectionId)}/clients/${encodeURIComponent(clientId)}`,
      ),
    async listClientGrants(clientId, audience) {
      return call<Auth0ClientGrant[]>('GET', `/client-grants?client_id=${encodeURIComponent(clientId)}&audience=${encodeURIComponent(audience)}`);
    },
    createClientGrant: (body) => call<Auth0ClientGrant>('POST', '/client-grants', body),
    deleteClientGrant: (id) => call<void>('DELETE', `/client-grants/${encodeURIComponent(id)}`),
  };
}
