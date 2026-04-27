# @rntme/identity-workos

WorkOS vendor module for the rntme Identity canonical contract `identity/v1`.

## Supported capabilities

| Area | Claimed canonical support | Notes |
| --- | --- | --- |
| Users | `GetUser`, `ListUsers`, `CreateUser`, `UpdateUser`, `DeleteUser` | Uses the official `@workos-inc/node` User Management API. `CreateUser.email`, `name`, `email_verified`, and public metadata map to WorkOS create params. `UpdateUser` maps writable name and public metadata fields only; canonical email and email verification updates are not in the current canonical update request shape. |
| Organizations | `GetOrganization`, `ListOrganizations`, `CreateOrganization`, `UpdateOrganization`, `DeleteOrganization` | Uses `workos.organizations.*`. `CreateOrganization.context.idempotency_key` is passed only to WorkOS organization create, the SDK operation documented with idempotency options. Other command RPCs do not receive invented idempotency behavior. |
| Memberships | `ListMemberships`, `AddMembership`, `UpdateMembership`, `RemoveMembership` | Uses WorkOS organization membership APIs. Canonical and vendor ids are the WorkOS membership id. `ListMemberships` requires at least `organization_id` or `user_id`; `UpdateMembership` requires a role because the safe canonical mapping is role update. `GetMembership` is unclaimed. |
| Invitations | `ListInvitations`, `CreateInvitation`, `RevokeInvitation` | Uses `sendInvitation`, `listInvitations`, and `revokeInvitation`. Invitations are organization-scoped through `organizationId`; `CreateInvitation.expires_at` maps to WorkOS `expiresInDays`. `GetInvitation` is unclaimed. |
| Sessions | none | WorkOS session/introspection semantics are not claimed until a canonical-safe SDK mapping is documented and implemented. |
| Resolution | none | `ResolveIdentity` is unclaimed. |
| Webhooks | user, organization, membership, and invitation lifecycle events listed in `module.json` | Verification uses `workos.webhooks.constructEvent({ payload, sigHeader, secret, tolerance })` and the `workos-signature` header. Directory Sync and SSO vendor-extension events are ignored unless they exactly match the canonical lifecycle mappings. |

Unsupported canonical RPCs are present on the handler object and return gRPC `UNIMPLEMENTED` code `12`: `GetMembership`, `GetInvitation`, `GetSession`, `ListSessions`, `ResolveIdentity`, `IntrospectSession`, `RevokeSession`.

## Environment

| Variable | Required | Purpose |
| --- | --- | --- |
| `WORKOS_API_KEY` | yes for live adapter/webhook default verifier | Passed to `new WorkOS(apiKey)`. Tests use fake adapters and do not need it. |
| `WORKOS_WEBHOOK_SECRET` | yes for webhooks | Passed as `secret` to `workos.webhooks.constructEvent`. |

## Tests and conformance

Mock tests use fake adapters and do not need WorkOS secrets or network access:

```sh
pnpm -F @rntme/identity-workos run test
pnpm -F @rntme/identity-workos run test:conformance:mock
```

Live conformance is documented but not wired until a WorkOS sandbox and secrets are provided. A live runner should construct `createWorkOSAdapter({ apiKey: process.env.WORKOS_API_KEY })` and keep webhook tests isolated with `WORKOS_WEBHOOK_SECRET`.

## Idempotency and correlation

Canonical command requests accept `_common.CommandContext`. This module passes `context.idempotency_key` only to `CreateOrganization`, because the official WorkOS organization create SDK accepts an idempotency options object. Other WorkOS SDK calls in this module do not expose documented idempotency options, so the module preserves no local replay cache and does not claim stronger idempotency than the vendor API provides.

`correlation_id`, `actor_user_id`, and `tenant_id` are mapped only where WorkOS has a safe corresponding parameter: invitation creation uses `actor_user_id` as `inviterUserId`, and organization creation can use `tenant_id` as `externalId`.

## Limitations

- Session RPCs and `ResolveIdentity` are intentionally unclaimed and return `UNIMPLEMENTED`.
- `GetMembership` and `GetInvitation` are intentionally unclaimed even though SDK helpers exist, because the requested conservative capability set does not include them.
- WorkOS metadata is mapped to canonical public metadata only unless a field has a specific safe canonical destination.
- Directory Sync and SSO events are not claimed as canonical Identity events.
