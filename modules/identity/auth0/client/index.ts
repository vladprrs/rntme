import { Auth0Client } from '@auth0/auth0-spa-js';
import type { ModuleBootContext } from '@rntme/contracts-client-runtime-v1';

export { LoginScreen } from './components/LoginScreen.js';
export { UserBadge } from './components/UserBadge.js';

type AuthConfig = {
  domain: string;
  clientId: string;
  audience: string;
  redirectUri: string;
  postLoginRedirectPath?: string;
  authenticatedRedirectPaths?: string[];
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
  let callbackFallbackPath: string | null = null;
  let returnToPath: string | null = null;
  let cameFromCallback = false;

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
    const result = await client.handleRedirectCallback();
    cameFromCallback = true;
    callbackFallbackPath = url.pathname;
    returnToPath = normalizeLocalRedirectPath(readReturnTo(result));
  }

  let authed = false;
  if (await client.isAuthenticated()) {
    try {
      token = await client.getTokenSilently();
      const claims = await client.getIdTokenClaims();
      ctx.state.set('/auth/user', authUserFromClaims(claims));
      ctx.state.set('/auth/status', 'authed');
      authed = true;
      // Auth0 organization-scoped logins carry the org id in `org_id`. Route
      // the user to their org dashboard (`/:orgId`) so the UI lists projects;
      // a token without `org_id` falls back to the configured post-login path.
      const orgPath = orgRedirectPath(claims);
      const redirectPath = cameFromCallback
        ? returnToPath ??
          orgPath ??
          normalizeLocalRedirectPath(cfg.postLoginRedirectPath) ??
          callbackFallbackPath
        : authenticatedRedirectPath(cfg, orgPath);
      if (redirectPath) window.history.replaceState({}, '', redirectPath);
    } catch {
      // Cached session present but refresh failed (revoked / expired refresh
      // token). Fall through to anon — user will re-authenticate via login.
      await client.logout({ openUrl: false });
    }
  }
  if (!authed) {
    if (callbackFallbackPath) window.history.replaceState({}, '', callbackFallbackPath);
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

function readReturnTo(result: unknown): unknown {
  if (!result || typeof result !== 'object') return undefined;
  const appState = (result as { appState?: unknown }).appState;
  if (!appState || typeof appState !== 'object') return undefined;
  return (appState as { returnTo?: unknown }).returnTo;
}

function normalizeLocalRedirectPath(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim() === '') return null;
  try {
    const url = new URL(value, window.location.origin);
    if (url.origin !== window.location.origin) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

function authenticatedRedirectPath(cfg: AuthConfig, orgPath: string | null): string | null {
  // Prefer the org dashboard when the session is org-scoped; otherwise the
  // configured post-login path. Only redirect away from anonymous routes.
  const target = orgPath ?? normalizeLocalRedirectPath(cfg.postLoginRedirectPath);
  if (!target || !Array.isArray(cfg.authenticatedRedirectPaths)) return null;

  for (const raw of cfg.authenticatedRedirectPaths) {
    const path = normalizeLocalRedirectPath(raw);
    if (!path) continue;
    if (new URL(path, window.location.origin).pathname === window.location.pathname) return target;
  }
  return null;
}

/** `/:orgId` route derived from the id token `org_id` claim, or null. */
function orgRedirectPath(claims: unknown): string | null {
  if (!claims || typeof claims !== 'object') return null;
  const orgId = (claims as { org_id?: unknown }).org_id;
  if (typeof orgId !== 'string' || orgId.trim() === '') return null;
  return normalizeLocalRedirectPath(`/${encodeURIComponent(orgId.trim())}`);
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
