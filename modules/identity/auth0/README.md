# @rntme/identity-auth0

Auth0 vendor module for the canonical Identity contract `@rntme/contracts-identity-v1`.

## File map

- `src/adapter.ts` - Auth0 Management SDK adapter.
- `src/introspect-session.ts` - OIDC/JWKS access-token introspection.
- `src/handlers.ts` - canonical Identity RPC handlers.
- `src/mapping.ts` - Auth0 to canonical mappers.
- `src/events.ts` - Auth0 log record to canonical identity event translator.
- `src/capabilities.ts` - claimed RPCs, session RPCs, and claimed events.
- `src/conformance.ts` - mock conformance suite selection.
- `module.json` - module manifest and Auth0 limitations.
- `test/unit/` and `test/integration/` - unit coverage plus mock conformance wiring.

## Quick start

```bash
pnpm -F @rntme/identity-auth0 run build
pnpm -F @rntme/identity-auth0 run test
pnpm -F @rntme/identity-auth0 run test:conformance:mock
```

Live Auth0 Management API use requires a tenant with Management API credentials and the scopes needed for users, organizations, members, roles, and invitations. `IntrospectSession` uses OIDC JWKS validation and does not require Management API credentials.

## API

- `createAuth0Adapter(options)` creates an Auth0 Management SDK-backed adapter.
- `createAuth0IdentityModule(adapter)` wraps an adapter with canonical Identity RPC handlers.
- `translateAuth0LogEvent(log)` converts claimed Auth0 log records into canonical identity events and returns `null` for unsupported or underspecified records.
- `IntrospectSession({ token, audience })` verifies Auth0/OIDC JWT access tokens against the issuer JWKS and returns a canonical `Session`.

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
- `IntrospectSession` returns inactive canonical `Session` values for invalid user tokens. The reason is in `vendor_raw.deactivation_reason`: `TOKEN_EXPIRED`, `INVALID_SIGNATURE`, `INVALID_ISSUER`, `INVALID_AUDIENCE`, `MALFORMED`, or `UNKNOWN`.
- Organization metadata values are stringified before writes because Auth0 organization metadata stores string-like values.
- Membership role values are Auth0 role ids. Role-name and permission expansion depends on additional scopes and is not guaranteed.
- Invitations are organization-scoped. Canonical invitation ids are encoded as `<organization_id>:<invitation_id>`.
- Canonical public metadata maps to Auth0 `user_metadata`; canonical private metadata maps to Auth0 `app_metadata`. Auth0 visibility and merge semantics are preserved best-effort, and raw vendor payloads remain in `vendor_raw`.
- Lifecycle event translation depends on Auth0 log payload shape and returns `null` when required ids are missing.
- Auth0 Management API mutations do not accept rntme idempotency keys or correlation ids. Use rntme-side retry/dedupe controls for replay safety.

## Out of Scope

- Auth0 session management RPCs are intentionally unclaimed. `GetSession`, `ListSessions`, and `RevokeSession` return a gRPC-style `UNIMPLEMENTED` error.
- `GetMembership` is unclaimed because Auth0 membership reads are organization-scoped and do not expose a stable standalone membership resource.
- `UpdateMembership` is unclaimed because canonical role replacement does not map safely to Auth0's separate add/remove role APIs without a read/compare/delete cycle that can leave stale roles during concurrent changes.
- Live conformance is not wired in this package; it needs an Auth0 sandbox tenant, disposable organization, and cleanup credentials.

## Where to Look First

- Capability surface: `CLAIMED_RPCS`, `SESSION_RPCS`, and `CLAIMED_EVENTS` in `src/capabilities.ts`.
- SDK wiring: `Auth0ManagementAdapter` in `src/adapter.ts`.
- JWKS verifier: `introspectJwtToSession` in `src/introspect-session.ts`.
- Handler behavior: `createAuth0IdentityModule` in `src/handlers.ts`.
- Event translation: `translateAuth0LogEvent` in `src/events.ts`.

## Specs

- Identity contract package: [`packages/contracts/identity/v1/`](../../../packages/contracts/identity/v1).
- Identity contract design: [`docs/superpowers/specs/done/2026-04-26-identity-canonical-contract-design.md`](../../../docs/superpowers/specs/done/2026-04-26-identity-canonical-contract-design.md).
