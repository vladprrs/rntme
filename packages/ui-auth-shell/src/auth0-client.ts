import { createAuth0Client } from '@auth0/auth0-spa-js';
import type { Auth0ClientOptions, LogoutOptions, RedirectLoginOptions, User } from '@auth0/auth0-spa-js';
import type { CurrentUser, PublicAuthShellConfig } from './types.js';

export type Auth0ShellClient = {
  isAuthenticated: () => Promise<boolean>;
  loginWithRedirect: (options?: RedirectLoginOptions) => Promise<void>;
  handleRedirectCallback: () => Promise<unknown>;
  getTokenSilently: () => Promise<string>;
  getUser: () => Promise<User | undefined>;
  logout: (options?: LogoutOptions) => void | Promise<void>;
};

export type AuthSession =
  | {
      state: 'anonymous';
      token: null;
      currentUser: null;
    }
  | {
      state: 'authenticated';
      token: string;
      currentUser: CurrentUser;
    };

export type Auth0ClientFactory = (options: Auth0ClientOptions) => Promise<Auth0ShellClient>;

export async function createAuth0ShellClient(
  config: PublicAuthShellConfig,
  factory: Auth0ClientFactory = createAuth0Client
): Promise<Auth0ShellClient> {
  return factory({
    domain: config.auth0.domain,
    clientId: config.auth0.clientId,
    authorizationParams: {
      audience: config.auth0.audience,
      redirect_uri: config.auth0.redirectUri,
      scope: config.auth0.scope ?? 'openid profile email'
    },
    useRefreshTokens: false,
    cacheLocation: 'memory'
  });
}

export async function createAuthSession(opts: {
  client: Pick<Auth0ShellClient, 'isAuthenticated' | 'handleRedirectCallback' | 'getTokenSilently' | 'getUser'>;
  location: URL;
}): Promise<AuthSession> {
  if (opts.location.searchParams.has('code') && opts.location.searchParams.has('state')) {
    await opts.client.handleRedirectCallback();
  }

  if (!(await opts.client.isAuthenticated())) {
    return { state: 'anonymous', token: null, currentUser: null };
  }

  const token = await opts.client.getTokenSilently();
  const user = await opts.client.getUser();

  return {
    state: 'authenticated',
    token,
    currentUser: mapCurrentUser(user)
  };
}

function mapCurrentUser(user: User | undefined): CurrentUser {
  return {
    sub: String(user?.sub ?? ''),
    email: typeof user?.email === 'string' ? user.email : null,
    name: typeof user?.name === 'string' ? user.name : null
  };
}
