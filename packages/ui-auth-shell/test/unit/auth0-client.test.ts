import { describe, expect, it, vi } from 'vitest';
import { createAuth0ShellClient, createAuthSession } from '../../src/auth0-client.js';

function fakeAuth0(overrides: Record<string, unknown> = {}) {
  return {
    isAuthenticated: vi.fn(async () => false),
    loginWithRedirect: vi.fn(async () => undefined),
    handleRedirectCallback: vi.fn(async () => undefined),
    getTokenSilently: vi.fn(async () => 'tok'),
    getUser: vi.fn(async () => ({ sub: 'auth0|x', email: 'e@example.com', name: 'Example' })),
    logout: vi.fn(async () => undefined),
    ...overrides
  };
}

describe('createAuthSession', () => {
  it('reports anonymous state when not authenticated and no callback params are present', async () => {
    const client = fakeAuth0();

    const session = await createAuthSession({
      client,
      location: new URL('https://app.example/')
    });

    expect(session.state).toBe('anonymous');
    expect(session.token).toBe(null);
    expect(client.handleRedirectCallback).not.toHaveBeenCalled();
  });

  it('handles Auth0 redirect callback before reading token and user', async () => {
    const client = fakeAuth0({ isAuthenticated: vi.fn(async () => true) });

    const session = await createAuthSession({
      client,
      location: new URL('https://app.example/?code=abc&state=xyz')
    });

    expect(session.state).toBe('authenticated');
    expect(session.token).toBe('tok');
    expect(session.currentUser).toEqual({
      sub: 'auth0|x',
      email: 'e@example.com',
      name: 'Example'
    });
    expect(client.handleRedirectCallback).toHaveBeenCalledOnce();
  });
});

describe('createAuth0ShellClient', () => {
  it('creates an Auth0 SPA client with PKCE redirect parameters', async () => {
    const client = fakeAuth0();
    const factory = vi.fn(async () => client);

    const result = await createAuth0ShellClient(
      {
        auth0: {
          domain: 'tenant.us.auth0.com',
          clientId: 'cid',
          audience: 'https://api.example/',
          redirectUri: 'https://app.example/',
          scope: 'openid email'
        },
        runtime: {
          manifestUrl: '/_manifest.json'
        }
      },
      factory
    );

    expect(result).toBe(client);
    expect(factory).toHaveBeenCalledWith({
      domain: 'tenant.us.auth0.com',
      clientId: 'cid',
      authorizationParams: {
        audience: 'https://api.example/',
        redirect_uri: 'https://app.example/',
        scope: 'openid email'
      },
      useRefreshTokens: false,
      cacheLocation: 'memory'
    });
  });
});
