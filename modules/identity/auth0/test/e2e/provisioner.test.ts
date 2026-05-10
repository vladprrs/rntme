import { describe, expect, it } from 'bun:test';
import { provision, tearDown } from '../../src/provisioner.js';

const ENABLED = process.env.AUTH0_E2E === '1';
const TENANT = process.env.AUTH0_E2E_TENANT_DOMAIN ?? '';
const CLIENT_ID = process.env.AUTH0_E2E_MGMT_CLIENT_ID ?? '';
const CLIENT_SECRET = process.env.AUTH0_E2E_MGMT_CLIENT_SECRET ?? '';

describe.skipIf(!ENABLED)('provisioner — Auth0 E2E', () => {
  it('roundtrips create -> reconcile -> tearDown against a real tenant', async () => {
    const suffix = Math.floor(Date.now() / 1000);
    const appName = `rntme-e2e-${suffix}`;
    const audience = `https://e2e-${suffix}.example/api`;
    const input = {
      publicConfig: {
        appName,
        redirectUri: `https://e2e-${suffix}.example/`,
        audience,
        allowedOrigins: [`https://e2e-${suffix}.example`],
        allowedLogoutUrls: [`https://e2e-${suffix}.example/`],
        organizationsCapability: 'allow' as const,
        m2mClients: [{ name: 'introspect', scopes: [] }],
      },
      targetSecrets: { auth0Mgmt: { tenantDomain: TENANT, mgmtClientId: CLIENT_ID, mgmtClientSecret: CLIENT_SECRET } },
      log: () => undefined,
      signal: new globalThis.AbortController().signal,
    };

    const first = await provision(input);
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const second = await provision({
      ...input,
      priorOutputs: { publicOutputs: first.value.publicOutputs, secretOutputs: first.value.secretOutputs },
    });
    expect(second.ok).toBe(true);

    const teardown = await tearDown({
      ...input,
      priorOutputs: { publicOutputs: first.value.publicOutputs, secretOutputs: first.value.secretOutputs },
    });
    expect(teardown.ok).toBe(true);
  }, 30_000);
});
