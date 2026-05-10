# @rntme/identity-clerk

Clerk vendor module for the rntme Identity canonical contract `identity/v1`.

## Supported capabilities

| Area | Claimed canonical support | Notes |
| --- | --- | --- |
| Users | `GetUser`, `ListUsers`, `CreateUser`, `UpdateUser`, `DeleteUser` | Uses the official `@clerk/backend` users API. `CreateUser.phone` maps to Clerk `phoneNumber`; `UpdateUser.phone` is not supported because Clerk update accepts primary phone ids, not raw phone-number writes. Canonical `avatar_url` and `email_verified` are not writable through Clerk create/update user params and are returned only from vendor state. Hard-delete intent is accepted by the canonical request, but Clerk delete behavior is vendor-defined. |
| Organizations | `GetOrganization`, `ListOrganizations`, `CreateOrganization`, `UpdateOrganization`, `DeleteOrganization` | Uses `organizations.*` from the official SDK. `CreateOrganization.context.actor_user_id` maps to Clerk `createdBy` when provided. |
| Memberships | `ListMemberships`, `AddMembership`, `UpdateMembership`, `RemoveMembership` | Clerk membership update/delete require organization and user ids. This module emits membership canonical ids as `organizationId:userId`. Membership metadata is applied through Clerk `updateOrganizationMembershipMetadata` when present. `GetMembership` is unclaimed. |
| Invitations | `ListInvitations`, `CreateInvitation`, `RevokeInvitation` | Clerk invitation get/revoke require organization context. This module emits invitation canonical ids as `organizationId:invitationId`; `CreateInvitation.context.actor_user_id` maps to Clerk `inviterUserId`, and `expires_at` maps to Clerk `expiresInDays`. `GetInvitation` is unclaimed. |
| Sessions | `GetSession`, `ListSessions`, `IntrospectSession`, `RevokeSession` | Token introspection uses official `verifyToken`. |
| Resolution | none | `ResolveIdentity` is unclaimed until the canonical resolution semantics are pinned for Clerk. |
| Webhooks | user, organization, membership, invitation, and session lifecycle events listed in `module.json` | Verification uses `@clerk/backend/webhooks.verifyWebhook`; dedupe defaults to in-memory process state. |

Unsupported canonical RPCs are present on the handler object and return gRPC `UNIMPLEMENTED` code `12`: `GetMembership`, `GetInvitation`, `ResolveIdentity`.

## Environment

| Variable | Required | Purpose |
| --- | --- | --- |
| `CLERK_SECRET_KEY` | yes for live adapter | Passed to `createClerkClient({ secretKey, publishableKey })` and `verifyToken`. |
| `CLERK_PUBLISHABLE_KEY` | optional | Passed to the official Clerk client when available. |
| `CLERK_WEBHOOK_SIGNING_SECRET` | yes for webhooks | Passed to `verifyWebhook` for Clerk/Svix signature verification. |
| `CLERK_AUTHORIZED_PARTIES` | optional | Comma-separated allowed `azp` values for token verification. |

## Tests and conformance

Mock tests use fake adapters and do not need Clerk secrets or network access:

```sh
bun test
bun run test:conformance:mock
```

Live conformance is intentionally not wired until sandbox secrets are available. The module is structured so a live runner can provide `createClerkAdapter` with real Clerk environment variables.

## Idempotency and correlation

Canonical command requests accept `_common.CommandContext`. Clerk does not expose native idempotency keys for these SDK operations, so this module does not invent replay semantics. Callers should preserve `idempotency_key` and `correlation_id` in their own transport/logging layer around these handlers.
