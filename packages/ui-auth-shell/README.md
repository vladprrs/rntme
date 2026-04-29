# @rntme/ui-auth-shell

Auth0 SPA shell for mounting `@rntme/ui-runtime` with an authenticated fetch transport.

## Public Config

The shell accepts only public SPA configuration:

```ts
{
  auth0: {
    domain: 'tenant.us.auth0.com',
    clientId: 'spa-client-id',
    audience: 'https://notes-demo.rntme.com/api',
    redirectUri: 'https://notes-demo.rntme.com/',
    scope: 'openid profile email'
  },
  runtime: {
    manifestUrl: '/_manifest.json',
    target: document.getElementById('root')!
  }
}
```

`clientSecret`, `client_secret`, and `secret` are rejected. The browser config can come from
`window.__RNTME_AUTH_SHELL_CONFIG__` or `/config.json`; both forms are validated before Auth0 is
created.

## Runtime Mount

```ts
import { mountAuthenticatedApp } from '@rntme/ui-auth-shell';

await mountAuthenticatedApp(config);
```

On first load, callback URLs containing `code` and `state` are completed with Auth0's PKCE redirect
handler. Authenticated sessions mount ui-runtime with:

- a fetch transport that injects `Authorization: Bearer <token>`;
- `initialState.currentUser` derived from Auth0 `getUser()`;
- no exposed access-token getter.

On a `401` response, the transport calls the unauthenticated callback and throws
`UI_AUTH_SHELL_UNAUTHENTICATED`, so token-expiry response bodies do not enter ui-runtime state.

## Chrome

The shell renders vanilla DOM login/logout chrome. The authenticated layout includes a topbar with
the user email/name/sub and mounts ui-runtime into `#rntme-runtime-root`.
