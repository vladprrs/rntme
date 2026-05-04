# @rntme/identity-auth0

Auth0 vendor module for the canonical Identity contract `@rntme/contracts-identity-v1`.
This is a mixed module: it exposes backend Identity RPC handlers and a browser
client contribution for Auth0 login in generated UIs.

## File map

- `src/adapter.ts` - Auth0 Management SDK adapter.
- `src/introspect-session.ts` - OIDC/JWKS access-token introspection.
- `src/handlers.ts` - canonical Identity RPC handlers.
- `src/mapping.ts` - Auth0 to canonical mappers.
- `src/events.ts` - Auth0 log record to canonical identity event translator.
- `src/capabilities.ts` - claimed RPCs, session RPCs, and claimed events.
- `src/conformance.ts` - mock conformance suite selection.
- `client/index.ts` - browser boot orchestrator and client exports.
- `client/components/LoginScreen.tsx` - anonymous login component.
- `client/components/UserBadge.tsx` - authenticated user/logout component.
- `module.json` - module manifest and Auth0 limitations.
- `test/unit/` and `test/integration/` - unit coverage plus mock conformance wiring.

## Quick start

```bash
pnpm -F @rntme/identity-auth0 run build
pnpm -F @rntme/identity-auth0 run test
pnpm -F @rntme/identity-auth0 run test:conformance:mock
```

Live Auth0 Management API use requires a tenant with Management API credentials and the scopes needed for users, organizations, members, roles, and invitations. `IntrospectSession` uses OIDC JWKS validation and does not require Management API credentials.

## Build pipeline

This module ships its provisioner as a self-contained ESM bundle. The build
chain is:

1. `pnpm run build:deps` — workspace prerequisites.
2. `tsc -p tsconfig.json` — type-checked output to `dist/`.
3. `pnpm run build:provisioner` — esbuild produces `dist/provisioner.entry.js`,
   inlining `./mgmt-client.js` and `./result-shim.js` and externalizing only
   `node:*` built-ins.

`module.json#provisioner.entry` points at the bundled file, which is what the
CLI embeds in `assets/provisioners/rntme__identity-auth0.entry.js` of the
canonical project bundle.

## Backend API

- `createAuth0Adapter(options)` creates an Auth0 Management SDK-backed adapter.
- `createAuth0IdentityModule(adapter)` wraps an adapter with canonical Identity RPC handlers.
- `translateAuth0LogEvent(log)` converts claimed Auth0 log records into canonical identity events and returns `null` for unsupported or underspecified records.
- `IntrospectSession({ token, audience })` verifies Auth0/OIDC JWT access tokens against the issuer JWKS and returns a canonical `Session`.

## Browser Client

`module.json#client` points to `./dist/client/index.js` and declares:

- `boot(ctx)` - constructs `Auth0Client` with `cacheLocation: 'localstorage'`
  and `useRefreshTokens: true` so the session survives page reloads (the
  in-memory default would force a fresh login on every reload because silent
  auth via third-party cookies is blocked in modern browsers; the SPA client
  already grants `refresh_token`). Handles redirect callbacks, writes
  `/auth/status` as `anon` or `authed`, writes `/auth/user` with `{ sub, email,
  name }`, registers a Bearer transport middleware through `ctx.transport.use`,
  and registers `login` / `logout` operations.
- `LoginScreen` - anonymous branch component that dispatches the module-level
  `login` operation.
- `UserBadge` - authenticated branch component that reads `/auth/user` and
  dispatches `logout`.

Required `project.json#modules.identity.publicConfig` keys are `domain`,
`clientId`, `audience`, and `redirectUri`; optional `scope` defaults to
`openid profile email`. The access token stays in the module-private `boot`
closure and is never written to the json-render state store.

Project layouts must use `visible: { "$state": "/auth/status", ... }` gates
around anonymous and authenticated branches. The Notes demo uses an anonymous
`LoginScreen` branch and an authenticated topbar with `UserBadge`; its routed
screen root is also gated so mount-time authenticated data fetches do not run
before login.

## Supported Capabilities

| Area | Canonical capability | Auth0 mapping |
| --- | --- | --- |
| Users | `GetUser`, `ListUsers`, `CreateUser`, `UpdateUser`, `DeleteUser`, `ResolveIdentity` | Auth0 Management API users manager. |
| Organizations | `GetOrganization`, `ListOrganizations`, `CreateOrganization`, `UpdateOrganization`, `DeleteOrganization` | Auth0 Organizations manager. |
| Memberships | `ListMemberships`, `AddMembership`, `RemoveMembership` | Auth0 organization members plus member roles. |
| Invitations | `CreateInvitation`, `ListInvitations`, `GetInvitation`, `RevokeInvitation` | Auth0 organization invitations. |
| Sessions | `IntrospectSession` | OIDC JWKS verify; maps JWT `sub` to `Session.user_id` and performs no Management API call. |
| Events | `UserCreated`, `UserDeleted`, `UserEmailVerified`, `OrganizationCreated`, `MembershipCreated`, `MembershipDeleted`, `InvitationCreated`, `InvitationAccepted`, `InvitationRevoked` | Best-effort translation from Auth0 logs when payloads include enough identifiers. |

## Environment

- `AUTH0_DOMAIN`: Auth0 tenant domain.
- `AUTH0_ISSUER`: optional explicit OIDC issuer URL for `IntrospectSession`; defaults to `https://${AUTH0_DOMAIN}/`.
- `AUTH0_MANAGEMENT_TOKEN`: Management API token. Alternative to client credentials.
- `AUTH0_CLIENT_ID` and `AUTH0_CLIENT_SECRET`: Management API client credentials.
- `AUTH0_CONNECTION`: default connection for `CreateUser`.
- `AUTH0_INVITATION_CLIENT_ID`: target application client id for organization invitations. This is required for `CreateInvitation` and is intentionally separate from the Management API client id.

## Invariants & Gotchas

- Auth0 Management SDK `4.28.0` is the integration boundary; normal SDK-covered operations do not use raw REST.
- Management SDK construction is lazy. Missing Management API credentials do not affect `IntrospectSession`, but Management-backed RPCs fail with `IDENTITY_CONFIG_MGMT_NOT_CONFIGURED`.
- Browser Auth0 SDK integration is isolated to `client/`; backend RPC handlers never read browser public config.
- `IntrospectSession` returns inactive canonical `Session` values for invalid user tokens. The reason is in `vendor_raw.deactivation_reason`: `TOKEN_EXPIRED`, `INVALID_SIGNATURE`, `INVALID_ISSUER`, `INVALID_AUDIENCE`, `MALFORMED`, or `UNKNOWN`.
- Organization metadata values are stringified before writes because Auth0 organization metadata stores string-like values.
- Membership role values are Auth0 role ids. Role-name and permission expansion depends on additional scopes and is not guaranteed.
- Invitations are organization-scoped. Canonical invitation ids are encoded as `<organization_id>:<invitation_id>`.
- Canonical public metadata maps to Auth0 `user_metadata`; canonical private metadata maps to Auth0 `app_metadata`. Auth0 visibility and merge semantics are preserved best-effort, and raw vendor payloads remain in `vendor_raw`.
- Lifecycle event translation depends on Auth0 log payload shape and returns `null` when required ids are missing.
- Auth0 Management API mutations do not accept rntme idempotency keys or correlation ids. Use rntme-side retry/dedupe controls for replay safety.

## Two transports: gRPC + HTTP introspection

The container exposes two ports:

| Port | Transport | Caller | Endpoint |
|---:|---|---|---|
| 50051 | gRPC | runtime pre-step `module-rpc IntrospectSession` | `IdentityModule/IntrospectSession` |
| 50052 | HTTP | edge nginx via `auth_request` | `GET /introspect` |

Both transports share the in-process `IntrospectSession` handler — there is no duplicated validation logic. The HTTP transport exists so edge can reject unauthenticated requests at nginx without involving the runtime, while runtime continues to call gRPC for the canonical `Session` shape.

Required env:

| Var | Default | Note |
|---|---|---|
| `PORT` (or `GRPC_PORT`) | `50051` | gRPC listener port. |
| `HTTP_PORT` | `50052` | HTTP introspection port. Must match `module.json#capabilities.edgeAuth.port`. |
| `AUTH0_DOMAIN` or `AUTH0_ISSUER` | — required | JWKS issuer; `IntrospectSession` derives `https://<AUTH0_DOMAIN>/.well-known/jwks.json`. |

## Out of Scope

- Auth0 session management RPCs are intentionally unclaimed. `GetSession`, `ListSessions`, and `RevokeSession` return a gRPC-style `UNIMPLEMENTED` error.
- `GetMembership` is unclaimed because Auth0 membership reads are organization-scoped and do not expose a stable standalone membership resource.
- `UpdateMembership` is unclaimed because canonical role replacement does not map safely to Auth0's separate add/remove role APIs without a read/compare/delete cycle that can leave stale roles during concurrent changes.
- Live conformance is not wired in this package; it needs an Auth0 sandbox tenant, disposable organization, and cleanup credentials.

## Where to Look First

- Capability surface: `CLAIMED_RPCS`, `SESSION_RPCS`, and `CLAIMED_EVENTS` in `src/capabilities.ts`.
- Browser auth path: `boot`, `LoginScreen`, and `UserBadge` under `client/`.
- SDK wiring: `Auth0ManagementAdapter` in `src/adapter.ts`.
- JWKS verifier: `introspectJwtToSession` in `src/introspect-session.ts`.
- Handler behavior: `createAuth0IdentityModule` in `src/handlers.ts`.
- Event translation: `translateAuth0LogEvent` in `src/events.ts`.

## Provisioner

`src/provisioner.ts` exports `provision(input)` and `tearDown(input)`. The Auth0 module declares its provisioner block in `module.json`:

- `produces`: `spaClient` (single, public), `resourceServer` (single, public), `m2mClients` (many, secret).
- `requires`: `auth0Mgmt` (schema `auth0-mgmt-api-v1`).
- `timeoutMs`: 60 000.

### Required target secret

Operators write the Auth0 Mgmt API credentials onto the deploy target via:

```
PUT /v1/orgs/<org>/deploy-targets/<slug>/secrets/auth0Mgmt
Content-Type: application/json

{
  "schema": "auth0-mgmt-api-v1",
  "value": {
    "tenantDomain": "demo.us.auth0.com",
    "mgmtClientId": "<machine-to-machine client id>",
    "mgmtClientSecret": "<machine-to-machine client secret>"
  }
}
```

The Mgmt API client must be authorized with `read/create/update/delete:clients`, `read/create/update/delete:resource_servers`, `read/update:connections`, and `read/create/delete:client_grants`.

### What gets reconciled

| Object | Reconcile rules |
|---|---|
| SPA client | name = `appName`; `app_type='spa'`; `token_endpoint_auth_method='none'`; grant_types `['authorization_code','refresh_token']`; callbacks/web_origins/allowed_origins/allowed_logout_urls from blueprint; `organization_usage='allow'`. |
| Resource Server | identifier = blueprint `audience`; `signing_alg='RS256'`; `token_dialect='access_token_authz'`; `enforce_policies=true`. |
| Connection | `Username-Password-Authentication` enabled_clients += SPA client_id. Other clients are preserved. |
| M2M clients | per blueprint `m2mClients[]`: `app_type='non_interactive'`, `grant_types=['client_credentials']`, plus a client_grant for the Resource Server with declared scopes. |

### Output env vars

After provision, render bakes:

- `AUTH0_SPA_CLIENT_ID` (on `app` resource).
- `AUTH0_AUDIENCE` (on `app` resource).
- `AUTH0_M2M_<NAME>_CLIENT_ID` and `AUTH0_M2M_<NAME>_CLIENT_SECRET` (on `identity-auth0` resource), per declared M2M client.

### Tear-down

Triggered by the project-delete operation before Dokploy resource deletion. Removes M2M clients and grants, the Resource Server, removes the SPA client_id from the connection's enabled_clients, and deletes the SPA client. 404 responses are treated as success.

### Limitations

- M2M `clientSecret` is only obtainable at create time. Reconcile does not rotate it; if the stored ciphertext is lost, recovery is a separate CLI flow.
- Only the `Username-Password-Authentication` connection is currently enabled. Multi-connection blueprints are a future extension.

## Specs

- Identity contract package: [`packages/contracts/identity/v1/`](../../../packages/contracts/identity/v1).
- Identity contract design: [`docs/superpowers/specs/done/2026-04-26-identity-canonical-contract-design.md`](../../../docs/superpowers/specs/done/2026-04-26-identity-canonical-contract-design.md).
- Module provisioner contract design: [`docs/superpowers/specs/2026-05-03-module-provisioner-contract-design.md`](../../../docs/superpowers/specs/2026-05-03-module-provisioner-contract-design.md).
