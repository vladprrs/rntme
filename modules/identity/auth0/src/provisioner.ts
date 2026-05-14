import { createMgmtClient, type Auth0Client, type Auth0Connection, type Auth0ResourceServer, type MgmtClient } from './mgmt-client.js';
import { err, ok } from './result-shim.js';
import type { ProvisionerEnvMapping } from '@rntme/contracts-provisioner-v1';

export type Auth0PublicConfig = {
  appName: string;
  redirectUri: string;
  audience: string;
  // Optional fields below are defaulted from required fields when absent —
  // a project blueprint that only declares appName/redirectUri/audience
  // gets a sensible single-origin SPA without needing to enumerate every
  // Auth0 reconciliation knob in publicConfig.
  allowedOrigins?: string[];
  allowedLogoutUrls?: string[];
  // `require` makes every interactive login on the SPA client organization-
  // scoped, so the issued access token always carries an `org_id` claim.
  organizationsCapability?: 'allow' | 'deny' | 'require';
  m2mClients?: ReadonlyArray<{ name: string; scopes: string[] }>;
};

// Origin half of redirectUri ("https://example.com/foo" → "https://example.com").
function originOf(redirectUri: string): string {
  try {
    return new URL(redirectUri).origin;
  } catch {
    return redirectUri;
  }
}

export type Auth0TargetSecrets = {
  auth0Mgmt: { tenantDomain: string; mgmtClientId: string; mgmtClientSecret: string };
};

type ProvisionInput = {
  publicConfig: Auth0PublicConfig;
  targetSecrets: Record<string, unknown>;
  priorOutputs?: { publicOutputs: Record<string, unknown>; secretOutputs: Record<string, unknown> };
  log: (entry: { step: string; level: 'info' | 'warn' | 'error'; code?: string; message: string }) => void;
  signal: globalThis.AbortSignal;
  fetch?: typeof globalThis.fetch;
};

const DEFAULT_CONNECTION = 'Username-Password-Authentication';

export async function provision(input: ProvisionInput) {
  const cfg = input.publicConfig;
  const secrets = input.targetSecrets.auth0Mgmt as Auth0TargetSecrets['auth0Mgmt'];
  const mgmt = createMgmtClient({ ...secrets, fetch: input.fetch });

  // Optional-field defaults — single-origin SPA derived from redirectUri.
  const allowedOrigins = cfg.allowedOrigins ?? [originOf(cfg.redirectUri)];
  const allowedLogoutUrls = cfg.allowedLogoutUrls ?? [cfg.redirectUri];
  const organizationsCapability = cfg.organizationsCapability ?? 'allow';
  const m2mClients = cfg.m2mClients ?? [];

  // 1. SPA client
  const spaDesired: Partial<Auth0Client> = {
    name: cfg.appName,
    app_type: 'spa',
    token_endpoint_auth_method: 'none',
    grant_types: ['authorization_code', 'refresh_token'],
    callbacks: [cfg.redirectUri],
    web_origins: allowedOrigins,
    allowed_origins: allowedOrigins,
    allowed_logout_urls: allowedLogoutUrls,
    organization_usage: organizationsCapability,
    // When org membership is required, Auth0 prompts the user to pick their
    // organization before login so the access token carries `org_id`.
    ...(organizationsCapability === 'require'
      ? { organization_require_behavior: 'pre_login_prompt' as const }
      : {}),
  };
  const spaResult = await reconcileClient(mgmt, cfg.appName, spaDesired);
  if (!spaResult.ok) return err(spaResult.errors);
  const spa = spaResult.value;
  input.log({ step: 'spa-client', level: 'info', message: `SPA client ${spa.client_id}` });

  // 2. Resource Server
  const rsDesired: Partial<Auth0ResourceServer> = {
    identifier: cfg.audience,
    name: `${cfg.appName} API`,
    signing_alg: 'RS256',
    token_dialect: 'access_token_authz',
    enforce_policies: true,
  };
  const rsResult = await reconcileResourceServer(mgmt, cfg.audience, rsDesired);
  if (!rsResult.ok) return err(rsResult.errors);
  const rs = rsResult.value;
  input.log({ step: 'resource-server', level: 'info', message: `Resource server ${rs.identifier}` });

  // 3. Connection enablement
  const connResult = await ensureConnectionEnabled(mgmt, DEFAULT_CONNECTION, spa.client_id);
  if (!connResult.ok) return err(connResult.errors);
  input.log({ step: 'connection', level: 'info', message: `Connection ${DEFAULT_CONNECTION}` });

  // 4. M2M clients
  const priorM2M = (input.priorOutputs?.secretOutputs.m2mClients ?? []) as Array<{ name: string; clientId: string; clientSecret: string }>;
  const m2mOut: Array<{ name: string; clientId: string; clientSecret: string }> = [];
  for (const decl of m2mClients) {
    const m2mName = `${cfg.appName}-m2m-${decl.name}`;
    const found = await mgmt.findClientByName(m2mName);
    if (!found.ok) return err(found.errors);
    let clientId: string;
    let clientSecret: string;
    if (found.value === null) {
      const created = await mgmt.createClient({
        name: m2mName,
        app_type: 'non_interactive',
        grant_types: ['client_credentials'],
        token_endpoint_auth_method: 'client_secret_post',
      });
      if (!created.ok) return err(created.errors);
      clientId = created.value.client_id;
      clientSecret = created.value.client_secret ?? '';
    } else {
      clientId = found.value.client_id;
      const prior = priorM2M.find((p) => p.name === decl.name);
      if (!prior) {
        input.log({ step: 'm2m-client', level: 'warn', code: 'AUTH0_M2M_SECRET_LOST', message: `existing M2M ${m2mName} has no priorOutputs entry; secret cannot be recovered without rotate-flow` });
        clientSecret = '';
      } else {
        clientSecret = prior.clientSecret;
      }
    }
    m2mOut.push({ name: decl.name, clientId, clientSecret });

    const grants = await mgmt.listClientGrants(clientId, cfg.audience);
    if (!grants.ok) return err(grants.errors);
    if (grants.value.length === 0) {
      const cg = await mgmt.createClientGrant({ client_id: clientId, audience: cfg.audience, scope: decl.scopes });
      if (!cg.ok) return err(cg.errors);
    }
  }

  return ok({
    publicOutputs: {
      spaClient: { id: spa.client_id, name: spa.name },
      resourceServer: { id: rs.id, identifier: rs.identifier },
    },
    secretOutputs: { m2mClients: m2mOut },
  });
}

async function reconcileClient(mgmt: MgmtClient, name: string, desired: Partial<Auth0Client>) {
  const found = await mgmt.findClientByName(name);
  if (!found.ok) return found;
  if (!found.value) return mgmt.createClient(desired);
  if (clientDiff(found.value, desired)) return mgmt.patchClient(found.value.client_id, desired);
  return ok(found.value);
}

function clientDiff(actual: Auth0Client, desired: Partial<Auth0Client>): boolean {
  for (const k of Object.keys(desired) as (keyof Auth0Client)[]) {
    if (JSON.stringify(actual[k]) !== JSON.stringify(desired[k])) return true;
  }
  return false;
}

async function reconcileResourceServer(mgmt: MgmtClient, identifier: string, desired: Partial<Auth0ResourceServer>) {
  const found = await mgmt.findResourceServerByIdentifier(identifier);
  if (!found.ok) return found;
  if (!found.value) return mgmt.createResourceServer(desired);
  // Auth0 PATCH /resource-servers/{id} rejects the immutable `identifier`
  // field with `Additional properties not allowed: identifier`. Strip it
  // (along with `id`) from the patch body before sending.
  const { id: _id, identifier: _identifier, ...patchBody } = desired;
  void _id;
  void _identifier;
  for (const k of Object.keys(patchBody) as (keyof typeof patchBody)[]) {
    if (JSON.stringify(found.value[k]) !== JSON.stringify(patchBody[k])) return mgmt.patchResourceServer(found.value.id, patchBody);
  }
  return ok(found.value);
}

async function ensureConnectionEnabled(mgmt: MgmtClient, connectionName: string, clientId: string) {
  const found = await mgmt.findConnectionByName(connectionName);
  if (!found.ok) return found;
  if (!found.value) return ok({} as Auth0Connection);
  // Auth0 deprecated PATCH /connections.enabled_clients in favor of dedicated
  // membership endpoints. Read the current membership via the new endpoint
  // so this code keeps working after Auth0 stops populating
  // `enabled_clients` on GET /connections/{id} responses.
  const clients = await mgmt.listConnectionClients(found.value.id);
  if (!clients.ok) return clients;
  if (clients.value.some((c) => c.client_id === clientId)) return ok(found.value);
  const enabled = await mgmt.enableConnectionClient(found.value.id, clientId);
  if (!enabled.ok) return enabled;
  return ok(found.value);
}

export async function tearDown(input: ProvisionInput) {
  const secrets = input.targetSecrets.auth0Mgmt as Auth0TargetSecrets['auth0Mgmt'];
  const mgmt = createMgmtClient({ ...secrets, fetch: input.fetch });

  const prior = input.priorOutputs;
  if (!prior) return ok(undefined);

  const m2m = (prior.secretOutputs.m2mClients ?? []) as Array<{ clientId: string }>;
  for (const m of m2m) {
    const grants = await mgmt.listClientGrants(m.clientId, (prior.publicOutputs.resourceServer as { identifier?: string } | undefined)?.identifier ?? '');
    if (grants.ok) {
      for (const g of grants.value) {
        const r = await mgmt.deleteClientGrant(g.id);
        if (!r.ok) return err(r.errors);
      }
    }
    const r = await mgmt.deleteClient(m.clientId);
    if (!r.ok) return err(r.errors);
  }

  const rs = prior.publicOutputs.resourceServer as { id?: string } | undefined;
  if (rs?.id) {
    const r = await mgmt.deleteResourceServer(rs.id);
    if (!r.ok) return err(r.errors);
  }

  const spa = prior.publicOutputs.spaClient as { id?: string } | undefined;
  if (spa?.id) {
    const conn = await mgmt.findConnectionByName(DEFAULT_CONNECTION);
    if (conn.ok && conn.value) {
      // Use the dedicated membership endpoint — DELETE returns 204 whether
      // or not the client was actually enabled, so we can call it without
      // a pre-check (removes the now-deprecated enabled_clients GET path).
      const disabled = await mgmt.disableConnectionClient(conn.value.id, spa.id);
      if (!disabled.ok) return err(disabled.errors);
    }
    const r = await mgmt.deleteClient(spa.id);
    if (!r.ok) return err(r.errors);
  }

  return ok(undefined);
}

export const ENV_MAPPINGS: ProvisionerEnvMapping = {
  'identity-auth0': [
    { from: 'spaClient.id', envName: 'AUTH0_SPA_CLIENT_ID', secret: false, target: 'app' },
    { from: 'resourceServer.identifier', envName: 'AUTH0_AUDIENCE', secret: false, target: 'app' },
    { from: 'm2mClients.*.clientSecret', envName: 'AUTH0_M2M_${name}_CLIENT_SECRET', secret: true, target: 'identity-auth0' },
    { from: 'm2mClients.*.clientId', envName: 'AUTH0_M2M_${name}_CLIENT_ID', secret: false, target: 'identity-auth0' },
  ],
};
