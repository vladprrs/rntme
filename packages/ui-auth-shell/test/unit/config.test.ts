import { describe, expect, it, vi } from 'vitest';
import { loadAuthShellConfig, parseAuthShellConfig } from '../../src/config.js';

describe('parseAuthShellConfig', () => {
  const valid = {
    auth0: {
      domain: 'tenant.us.auth0.com',
      clientId: 'client-id',
      audience: 'https://notes-demo.rntme.com/api',
      redirectUri: 'https://notes-demo.rntme.com/'
    },
    runtime: {
      manifestUrl: '/_manifest.json'
    }
  };

  it('accepts public Auth0 config and applies the default scope', () => {
    const parsed = parseAuthShellConfig(valid);

    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.auth0.scope).toBe('openid profile email');
    }
  });

  it('rejects empty public Auth0 fields and does not allow secrets', () => {
    for (const field of ['domain', 'clientId', 'audience', 'redirectUri'] as const) {
      const parsed = parseAuthShellConfig({
        ...valid,
        auth0: { ...valid.auth0, [field]: '' }
      });

      expect(parsed.ok).toBe(false);
    }

    const withSecret = parseAuthShellConfig({
      ...valid,
      auth0: { ...valid.auth0, clientSecret: 'never' }
    });
    expect(withSecret.ok).toBe(false);
  });

  it('loads config from window before falling back to /config.json', async () => {
    const fetchConfig = vi.fn(async () => new Response('{}', { status: 500 })) as unknown as typeof fetch;
    const parsed = await loadAuthShellConfig({
      baseFetch: fetchConfig,
      windowConfig: valid
    });

    expect(parsed.auth0.domain).toBe('tenant.us.auth0.com');
    expect(fetchConfig).not.toHaveBeenCalled();
  });

  it('loads and validates /config.json when no window config is present', async () => {
    const fetchConfig = vi.fn(async () => Response.json(valid)) as unknown as typeof fetch;

    const parsed = await loadAuthShellConfig({ baseFetch: fetchConfig });

    expect(parsed.auth0.clientId).toBe('client-id');
    expect(fetchConfig).toHaveBeenCalledWith('/config.json');
  });
});
