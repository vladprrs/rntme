import { createMgmtClient, type Auth0Client, type Auth0Connection, type Auth0ResourceServer, type MgmtClient } from './mgmt-client.js';
import { err, ok } from './result-shim.js';
import type { ProvisionerEnvMapping } from '@rntme/deploy-core';

export type Auth0PublicConfig = {
  appName: string;
  redirectUri: string;
  audience: string;
  allowedOrigins: string[];
  allowedLogoutUrls: string[];
  organizationsCapability: 'allow' | 'deny';
  m2mClients: ReadonlyArray<{ name: string; scopes: string[] }>;
};

export type Auth0TargetSecrets = {
  auth0Mgmt: { tenantDomain: string; mgmtClientId: string; mgmtClientSecret: string };
};

type ProvisionInput = {
  publicConfig: Auth0PublicConfig;
  targetSecrets: Record<string, unknown>;
  priorOutputs?: { publicOutputs: Record<string, unknown>; secretOutputs: Record<string, unknown> };
  log: (entry: { step: string; level: 'info' | 'warn' | 'error'; code?: string; message: string }) => void;
  signal: AbortSignal;
  fetch?: typeof fetch;
};

const DEFAULT_CONNECTION = 'Username-Password-Authentication';

export async function provision(input: ProvisionInput) {
  const cfg = input.publicConfig;
  const secrets = input.targetSecrets.auth0Mgmt as Auth0TargetSecrets['auth0Mgmt'];
  const mgmt = createMgmtClient({ ...secrets, fetch: input.fetch });

  // 1. SPA client
  const spaDesired: Partial<Auth0Client> = {
    name: cfg.appName,
    app_type: 'spa',
    token_endpoint_auth_method: 'none',
    grant_types: ['authorization_code', 'refresh_token'],
    callbacks: [cfg.redirectUri],
    web_origins: cfg.allowedOrigins,
    allowed_origins: cfg.allowedOrigins,
    allowed_logout_urls: cfg.allowedLogoutUrls,
    organization_usage: cfg.organizationsCapability,
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
  for (const decl of cfg.m2mClients) {
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
  for (const k of Object.keys(desired) as (keyof Auth0ResourceServer)[]) {
    if (k === 'id' || k === 'identifier') continue;
    if (JSON.stringify(found.value[k]) !== JSON.stringify(desired[k])) return mgmt.patchResourceServer(found.value.id, desired);
  }
  return ok(found.value);
}

async function ensureConnectionEnabled(mgmt: MgmtClient, connectionName: string, clientId: string) {
  const found = await mgmt.findConnectionByName(connectionName);
  if (!found.ok) return found;
  if (!found.value) return ok({} as Auth0Connection);
  const enabled = found.value.enabled_clients ?? [];
  if (enabled.includes(clientId)) return ok(found.value);
  return mgmt.patchConnection(found.value.id, { enabled_clients: [...enabled, clientId] });
}

export const ENV_MAPPINGS: ProvisionerEnvMapping = {
  'identity-auth0': [
    { from: 'spaClient.id', envName: 'AUTH0_SPA_CLIENT_ID', secret: false, target: 'app' },
    { from: 'resourceServer.identifier', envName: 'AUTH0_AUDIENCE', secret: false, target: 'app' },
    { from: 'm2mClients.*.clientSecret', envName: 'AUTH0_M2M_${name}_CLIENT_SECRET', secret: true, target: 'identity-auth0' },
    { from: 'm2mClients.*.clientId', envName: 'AUTH0_M2M_${name}_CLIENT_ID', secret: false, target: 'identity-auth0' },
  ],
};
