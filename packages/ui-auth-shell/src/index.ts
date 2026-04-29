import { createAuth0ShellClient, createAuthSession, type Auth0ClientFactory } from './auth0-client.js';
import { parseAuthShellConfig } from './config.js';
import { createAuthedTransport } from './transport.js';
import { renderLogin, renderShell } from './chrome.js';
import type { AuthShellConfig, MountResult, PublicAuthShellConfig } from './types.js';

type UiRuntimeModule = {
  mountUiRuntime: (opts: {
    manifestUrl: string;
    target: HTMLElement;
    transport?: typeof fetch;
    initialState?: Record<string, unknown>;
  }) => Promise<unknown>;
};

export type MountAuthenticatedAppOptions = {
  createClient?: Auth0ClientFactory;
  baseFetch?: typeof fetch;
  location?: URL;
};

export async function mountAuthenticatedApp(
  rawConfig: AuthShellConfig,
  opts: MountAuthenticatedAppOptions = {}
): Promise<MountResult> {
  const parsed = parseAuthShellConfig(rawConfig);
  if (!parsed.ok) throw new Error(`UI_AUTH_SHELL_CONFIG_INVALID: ${parsed.errors.join('; ')}`);

  const config: PublicAuthShellConfig = parsed.value;
  const target = rawConfig.runtime.target;
  const client = await createAuth0ShellClient(config, opts.createClient);
  let token: string | null = null;

  const renderAnonymous = (message?: string) => {
    token = null;
    renderLogin(target, () => {
      void client.loginWithRedirect();
    }, message);
  };

  const session = await createAuthSession({
    client,
    location: opts.location ?? new URL(window.location.href)
  });

  if (session.state === 'anonymous') {
    renderAnonymous();
  } else {
    token = session.token;
    const runtimeRoot = renderShell(target, session.currentUser, () => {
      void client.logout({ logoutParams: { returnTo: config.auth0.redirectUri } });
    });
    const transport = createAuthedTransport({
      baseFetch: opts.baseFetch ?? fetch.bind(window),
      getToken: () => token,
      onUnauthenticated: () => renderAnonymous('Session expired, please sign in again.')
    });
    const { mountUiRuntime } = (await import('@rntme/ui-runtime/client')) as unknown as UiRuntimeModule;
    await mountUiRuntime({
      manifestUrl: config.runtime.manifestUrl,
      target: runtimeRoot,
      transport,
      initialState: { currentUser: session.currentUser }
    });
  }

  return {
    unmount: () => {
      target.innerHTML = '';
    }
  };
}

export type { AuthShellConfig, CurrentUser, MountResult, PublicAuthShellConfig } from './types.js';
