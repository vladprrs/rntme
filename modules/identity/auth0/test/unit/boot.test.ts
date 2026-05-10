import './dom-setup.js';
import { beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';
import { createStateStore } from '@json-render/core';
import {
  createLifecycleBus,
  createModuleBootContext,
  createOperationRegistry,
  createTransportChain,
} from '@rntme/contracts-client-runtime-v1';

const auth0Mock = {
  isAuthenticated: mock(async () => false),
  handleRedirectCallback: mock(async () => undefined),
  getTokenSilently: mock(async () => 'tok'),
  getIdTokenClaims: mock(async () => ({ sub: 'auth0|abc', email: 'e@x', name: 'Eve' })),
  loginWithRedirect: mock(async () => undefined),
  logout: mock(async () => undefined),
};

const Auth0ClientMock = mock(() => auth0Mock);

mock.module('@auth0/auth0-spa-js', () => ({
  Auth0Client: Auth0ClientMock,
}));

const cfg = {
  domain: 'tenant.us.auth0.com',
  clientId: 'client-id',
  audience: 'https://api.example.test',
  redirectUri: 'https://app.example.test/',
};

function makeCtx(
  baseFetch: typeof globalThis.fetch = mock(async () => new Response('{}', { status: 200 })) as unknown as typeof globalThis.fetch,
) {
  const store = createStateStore({});
  const bus = createLifecycleBus();
  const chain = createTransportChain(baseFetch);
  const registry = createOperationRegistry();
  const ctx = createModuleBootContext({
    moduleName: '@rntme/identity-auth0',
    config: cfg,
    store,
    bus,
    chain,
    registry,
  });
  return { ctx, store, chain, registry, baseFetch };
}

beforeEach(() => {
  Auth0ClientMock.mockClear();
  auth0Mock.isAuthenticated.mockClear();
  auth0Mock.handleRedirectCallback.mockClear();
  auth0Mock.getTokenSilently.mockClear();
  auth0Mock.getIdTokenClaims.mockClear();
  auth0Mock.loginWithRedirect.mockClear();
  auth0Mock.logout.mockClear();
  auth0Mock.isAuthenticated.mockResolvedValue(false);
  auth0Mock.handleRedirectCallback.mockResolvedValue(undefined);
  auth0Mock.getTokenSilently.mockResolvedValue('tok');
  auth0Mock.getIdTokenClaims.mockResolvedValue({ sub: 'auth0|abc', email: 'e@x', name: 'Eve' });
  auth0Mock.loginWithRedirect.mockResolvedValue(undefined);
  auth0Mock.logout.mockResolvedValue(undefined);
  window.history.replaceState({}, '', '/');
});

describe('boot', () => {
  it('writes anon status and user null when Auth0 has no authenticated session', async () => {
    const { ctx, store } = makeCtx();
    const { boot } = await import('../../client/index.js');

    await boot(ctx);

    expect(Auth0ClientMock).toHaveBeenCalledWith({
      domain: cfg.domain,
      clientId: cfg.clientId,
      cacheLocation: 'localstorage',
      useRefreshTokens: true,
      authorizationParams: {
        audience: cfg.audience,
        redirect_uri: cfg.redirectUri,
        scope: 'openid profile email',
      },
    });
    expect(store.get('/auth/status')).toBe('anon');
    expect(store.get('/auth/user')).toBe(null);
  });

  it('handles redirect callback, stores user claims, and marks the session authed', async () => {
    auth0Mock.isAuthenticated.mockResolvedValue(true);
    window.history.replaceState({}, '', '/?code=abc&state=xyz');
    const replaceState = spyOn(window.history, 'replaceState');
    const { ctx, store } = makeCtx();
    const { boot } = await import('../../client/index.js');

    await boot(ctx);

    expect(auth0Mock.handleRedirectCallback).toHaveBeenCalledTimes(1);
    expect(replaceState).toHaveBeenCalledWith({}, '', '/');
    expect(auth0Mock.getTokenSilently).toHaveBeenCalledTimes(1);
    expect(store.get('/auth/status')).toBe('authed');
    expect(store.get('/auth/user')).toEqual({
      sub: 'auth0|abc',
      email: 'e@x',
      name: 'Eve',
    });
  });

  it('injects Authorization without mutating the original request and clears auth state on 401', async () => {
    auth0Mock.isAuthenticated.mockResolvedValue(true);
    let response = new Response('{}', { status: 200 });
    const sent: Request[] = [];
    const baseFetch = mock(async (req: Request) => {
      sent.push(req);
      return response;
    });
    const { ctx, store, chain } = makeCtx(baseFetch as unknown as typeof globalThis.fetch);
    const { boot } = await import('../../client/index.js');

    await boot(ctx);

    const original = new Request('https://api.example.test/notes');
    await chain.fetch(original);

    expect(original.headers.get('authorization')).toBe(null);
    expect(sent[0]?.headers.get('authorization')).toBe('Bearer tok');
    expect(store.get('/auth/status')).toBe('authed');

    response = new Response('{}', { status: 401 });
    await chain.fetch(new Request('https://api.example.test/notes'));

    expect(store.get('/auth/status')).toBe('anon');
    expect(store.get('/auth/user')).toBe(null);
  });

  it('falls back to anon when refresh-token redemption fails on a cached session', async () => {
    auth0Mock.isAuthenticated.mockResolvedValue(true);
    auth0Mock.getTokenSilently.mockRejectedValue(Object.assign(new Error('login_required'), { error: 'login_required' }));
    const { ctx, store } = makeCtx();
    const { boot } = await import('../../client/index.js');

    await boot(ctx);

    expect(auth0Mock.logout).toHaveBeenCalledWith({ openUrl: false });
    expect(store.get('/auth/status')).toBe('anon');
    expect(store.get('/auth/user')).toBe(null);
  });

  it('registers login and logout module operations', async () => {
    const { ctx, registry } = makeCtx();
    const { boot } = await import('../../client/index.js');

    await boot(ctx);

    const login = registry.lookupModule('@rntme/identity-auth0', 'login');
    const logout = registry.lookupModule('@rntme/identity-auth0', 'logout');
    expect(login).toBeDefined();
    expect(logout).toBeDefined();

    await login?.({});
    expect(auth0Mock.loginWithRedirect).toHaveBeenCalledTimes(1);

    await logout?.({});
    expect(auth0Mock.logout).toHaveBeenCalledWith({
      logoutParams: { returnTo: cfg.redirectUri },
    });
  });
});
