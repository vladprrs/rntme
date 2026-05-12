import { describe, expect, it } from 'bun:test';
import { resolveSecrets } from '../../../src/deploy-engine/load-secrets.js';

describe('resolveSecrets', () => {
  it('reads env-var refs into plaintext', () => {
    const env = { DOKPLOY_API_TOKEN: 'secret-token' };
    const result = resolveSecrets(
      { apiToken: { source: 'env', name: 'DOKPLOY_API_TOKEN' }, extras: {} },
      env,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.apiToken).toBe('secret-token');
      expect(result.value.extras).toEqual({});
    }
  });

  it('returns CLI_DEPLOY_SECRET_MISSING when env var is unset', () => {
    const result = resolveSecrets(
      { apiToken: { source: 'env', name: 'NOT_SET' }, extras: {} },
      {},
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('CLI_DEPLOY_SECRET_MISSING');
      expect(result.error.message).toContain('NOT_SET');
    }
  });

  it('resolves extra secret refs into the extras map keyed by ref name', () => {
    const env = { CONSOLE_HTPASSWD: 'user:pw' };
    const result = resolveSecrets(
      {
        apiToken: { source: 'env', name: 'TOK' },
        extras: { redpanda_console_htpasswd: { source: 'env', name: 'CONSOLE_HTPASSWD' } },
      },
      { ...env, TOK: 't' },
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.extras['redpanda_console_htpasswd']).toBe('user:pw');
  });

  it('resolves nested-object extras (composite target secrets like auth0Mgmt)', () => {
    const env = {
      TOK: 't',
      A0_DOMAIN: 'demo-rntme.us.auth0.com',
      A0_MGMT_ID: 'mgmt-client-id',
      A0_MGMT_SECRET: 'mgmt-client-secret',
    };
    const result = resolveSecrets(
      {
        apiToken: { source: 'env', name: 'TOK' },
        extras: {
          auth0Mgmt: {
            tenantDomain: { source: 'env', name: 'A0_DOMAIN' },
            mgmtClientId: { source: 'env', name: 'A0_MGMT_ID' },
            mgmtClientSecret: { source: 'env', name: 'A0_MGMT_SECRET' },
          },
        },
      },
      env,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.extras['auth0Mgmt']).toEqual({
        tenantDomain: 'demo-rntme.us.auth0.com',
        mgmtClientId: 'mgmt-client-id',
        mgmtClientSecret: 'mgmt-client-secret',
      });
    }
  });

  it('errors with the composite sub-key path when a nested env var is missing', () => {
    const env = { TOK: 't', A0_DOMAIN: 'demo-rntme.us.auth0.com' };
    const result = resolveSecrets(
      {
        apiToken: { source: 'env', name: 'TOK' },
        extras: {
          auth0Mgmt: {
            tenantDomain: { source: 'env', name: 'A0_DOMAIN' },
            mgmtClientSecret: { source: 'env', name: 'A0_MGMT_SECRET' },
          },
        },
      },
      env,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('CLI_DEPLOY_SECRET_MISSING');
      expect(result.error.message).toContain('A0_MGMT_SECRET');
      expect(result.error.message).toContain('auth0Mgmt.mgmtClientSecret');
    }
  });
});
