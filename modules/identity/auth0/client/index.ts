import { Auth0Client } from '@auth0/auth0-spa-js';
import type { ModuleBootContext } from '@rntme/contracts-client-runtime-v1';

export { LoginScreen } from './components/LoginScreen.js';
export { UserBadge } from './components/UserBadge.js';

type AuthConfig = {
  domain: string;
  clientId: string;
  audience: string;
  redirectUri: string;
  scope?: string;
};

type AuthUser = {
  sub: string;
  email: string | null;
  name: string | null;
};

const DEFAULT_SCOPE = 'openid profile email';

export async function boot(ctx: ModuleBootContext): Promise<void> {
  const cfg = ctx.config as AuthConfig;
  const client = new Auth0Client({
    domain: cfg.domain,
    clientId: cfg.clientId,
    cacheLocation: 'localstorage',
    useRefreshTokens: true,
    authorizationParams: {
      audience: cfg.audience,
      redirect_uri: cfg.redirectUri,
      scope: cfg.scope ?? DEFAULT_SCOPE,
    },
  });

  let token: string | null = null;

  ctx.transport.use(async (req, next) => {
    const headers = new Headers(req.headers);
    if (token) headers.set('authorization', `Bearer ${token}`);
    const res = await next(new Request(req, { headers }));
    if (res.status === 401) {
      token = null;
      ctx.state.set('/auth/status', 'anon');
      ctx.state.set('/auth/user', null);
    }
    return res;
  });

  const url = new URL(window.location.href);
  if (url.searchParams.has('code') && url.searchParams.has('state')) {
    await client.handleRedirectCallback();
    window.history.replaceState({}, '', url.pathname);
  }

  let authed = false;
  if (await client.isAuthenticated()) {
    try {
      token = await client.getTokenSilently();
      ctx.state.set('/auth/user', authUserFromClaims(await client.getIdTokenClaims()));
      ctx.state.set('/auth/status', 'authed');
      authed = true;
    } catch {
      // Cached session present but refresh failed (revoked / expired refresh
      // token). Fall through to anon — user will re-authenticate via login.
      await client.logout({ openUrl: false });
    }
  }
  if (!authed) {
    ctx.state.set('/auth/status', 'anon');
    ctx.state.set('/auth/user', null);
  }

  ctx.registerOperation('login', async () => {
    await client.loginWithRedirect();
  });
  ctx.registerOperation('logout', async () => {
    await client.logout({ logoutParams: { returnTo: cfg.redirectUri } });
  });
}

function authUserFromClaims(claims: unknown): AuthUser {
  const value = claims && typeof claims === 'object'
    ? (claims as { sub?: unknown; email?: unknown; name?: unknown })
    : {};
  return {
    sub: typeof value.sub === 'string' ? value.sub : '',
    email: typeof value.email === 'string' ? value.email : null,
    name: typeof value.name === 'string' ? value.name : null,
  };
}
