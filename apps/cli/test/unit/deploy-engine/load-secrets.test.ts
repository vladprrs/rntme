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
});
