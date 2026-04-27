# @rntme/identity-auth0

Auth0 vendor module for the canonical Identity contract `@rntme/contracts-identity-v1`.

## Supported capabilities

| Area | Canonical capability | Auth0 mapping |
| --- | --- | --- |
| Users | `GetUser`, `ListUsers`, `CreateUser`, `UpdateUser`, `DeleteUser`, `ResolveIdentity` | Auth0 Management API users manager. |
| Organizations | `GetOrganization`, `ListOrganizations`, `CreateOrganization`, `UpdateOrganization`, `DeleteOrganization` | Auth0 Organizations manager. |
| Memberships | `ListMemberships`, `AddMembership`, `RemoveMembership` | Auth0 organization members plus member roles. `GetMembership` and `UpdateMembership` are not claimed. |
| Invitations | `CreateInvitation`, `ListInvitations`, `GetInvitation`, `RevokeInvitation` | Auth0 organization invitations. |
| Sessions | none | Auth0 session/token semantics differ from the canonical session contract; session RPCs return `UNIMPLEMENTED`. |
| Events | `UserCreated`, `UserDeleted`, `UserEmailVerified`, `OrganizationCreated`, `MembershipCreated`, `MembershipDeleted`, `InvitationCreated`, `InvitationAccepted`, `InvitationRevoked` | Best-effort translation from Auth0 logs when payloads include enough identifiers. |

## Environment

- `AUTH0_DOMAIN`: Auth0 tenant domain.
- `AUTH0_MANAGEMENT_TOKEN`: Management API token. Alternative to client credentials.
- `AUTH0_CLIENT_ID` and `AUTH0_CLIENT_SECRET`: Management API client credentials.
- `AUTH0_CONNECTION`: default connection for `CreateUser`.
- `AUTH0_INVITATION_CLIENT_ID`: client id used for organization invitations when different from `AUTH0_CLIENT_ID`.

## Conformance

- Mock: `pnpm -F @rntme/identity-auth0 run test:conformance:mock`
- Live: not wired in this package yet; live conformance needs an Auth0 sandbox tenant, a disposable organization, and cleanup credentials.

## Limitations

- Auth0 sessions are intentionally unclaimed. `GetSession`, `ListSessions`, `IntrospectSession`, and `RevokeSession` return a gRPC-style `UNIMPLEMENTED` error.
- `GetMembership` is unclaimed because Auth0 membership reads are organization-scoped and do not expose a stable standalone membership resource.
- `UpdateMembership` is unclaimed because canonical role replacement does not map safely to Auth0's separate add/remove role APIs without a read/compare/delete cycle that can leave stale roles during concurrent changes.
- Membership role values are Auth0 role ids. Role-name and permission expansion depends on additional scopes and is not guaranteed.
- Invitations are organization-scoped. Canonical invitation ids are encoded as `<organization_id>:<invitation_id>`.
- Canonical public metadata maps to Auth0 `user_metadata`; canonical private metadata maps to Auth0 `app_metadata`. Auth0 visibility and merge semantics are preserved best-effort, and raw vendor payloads remain in `vendor_raw`.
- Lifecycle event translation depends on Auth0 log payload shape and returns `null` when required ids are missing.
- Auth0 Management API mutations do not accept rntme idempotency keys or correlation ids. The handlers preserve canonical request shapes locally, but downstream Auth0 calls cannot be made idempotent by this module; use rntme-side retry/dedupe controls for replay safety.
