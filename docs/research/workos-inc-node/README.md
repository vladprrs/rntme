# Dependency Research: @workos-inc/node

Researched: 2026-04-28
Repository: /home/coder/work/rntme
Domain/ecosystem: npm/enterprise-auth-sdk
Current version(s) in rntme: ^7.82.0 (modules/identity/workos, packages/platform-http package.json; WorkOS SSO/SCIM integration)
Latest stable version: 9.1.1 (2026-04-24, npm)
Confidence: HIGH

## User Constraints
- Goal: understand current dependencies and migrate rntme to latest safe versions later.
- Output must be written to `docs/research/workos-inc-node/README.md`.
- Research-only: do not perform dependency upgrades or runtime code migrations in this issue.
- Look for better-suited libraries/solutions, not only latest version of the current choice.
- Use authoritative current sources: Context7 where applicable, official docs/changelog/releases, npm/GitHub/container registry, migration guides, security advisories.

## Summary

`@workos-inc/node` is the official WorkOS SDK for Node.js. rntme currently pins `^7.82.0` in `@rntme/identity-workos`. The SDK has advanced through two major versions since: **v8** (Node 20+, ESM-first, PKCE support, method deprecations removed) and **v9** (Node 22.11+, legacy FGA removal, resource client renames, typed errors).

rntme's WorkOS integration is narrow and well-insulated: it only uses `userManagement` (CRUD users, memberships, invitations), `organizations` (CRUD orgs), and `webhooks.constructEvent`. It does **not** use Directory Sync, SSO, MFA, Vault, Events, FGA/Authorization, Portal, Widgets, or Feature Flags. Therefore, the majority of breaking changes in v8 and v9 do not affect rntme.

The primary obstacle to upgrading is the **Node.js version requirement**: v9 requires Node `>=22.11.0`, while rntme currently specifies `>=20`. Upgrading to v8 (`^8.13.0`) is feasible immediately with minimal code changes. Upgrading to v9 requires a Node.js runtime bump across the monorepo, which should be planned as a separate infrastructure task.

Primary recommendation: **KEEP + UPGRADE to v8.x immediately; plan v9.x after Node 22 migration.**

## Current Usage in rntme

| Package / image / tool | Current version | Used by | Source file(s) | Runtime/dev/build/test | Notes |
|---|---:|---|---|---|---|
| `@workos-inc/node` | `^7.82.0` | `@rntme/identity-workos` | `modules/identity/workos/package.json` | runtime | Direct SDK dependency |

Commands used to verify usage:
```bash
grep -r "@workos-inc/node" --include="package.json" /home/coder/work/rntme/
grep -r "import { WorkOS }" --include="*.ts" /home/coder/work/rntme/modules/identity/workos/src/
```

**API surface actually used by rntme:**
- `new WorkOS(apiKey, options?)` — `adapter.ts`
- `workos.userManagement.getUser` / `listUsers` / `createUser` / `updateUser` / `deleteUser`
- `workos.userManagement.listOrganizationMemberships` / `createOrganizationMembership` / `updateOrganizationMembership` / `deleteOrganizationMembership`
- `workos.userManagement.getInvitation` / `sendInvitation` / `listInvitations` / `revokeInvitation`
- `workos.organizations.getOrganization` / `listOrganizations` / `createOrganization` / `updateOrganization` / `deleteOrganization`
- `workos.webhooks.constructEvent` — `webhooks.ts`

**Not used by rntme** (therefore most breaking changes are irrelevant):
- `directorySync`, `sso`, `mfa`/`multiFactorAuth`, `vault`, `events`, `fga`, `portal`/`adminPortal`, `widgets`, `apiKeys`, `featureFlags`, `authorization`

## Latest Versions / Release State

| Channel | Version | Release date | Source | Notes |
|---|---:|---|---|---|
| latest | 9.1.1 | 2026-04-24 | npm, GitHub | Current stable; requires Node >=22.11.0 |
| v9 | 9.0.0 | 2026-04-21 | GitHub changelog | Major: dropped Node 20, removed legacy FGA, renamed portal/adminPortal |
| v8 | 8.13.0 | 2026-04-13 | GitHub changelog | Last v8 minor; requires Node >=20 |
| v8 LTS-like | 8.11.1 | 2026-04-04 | GitHub changelog | Security fix for miniflare/undici vulns |
| next | 8.0.0-rc.10 | — | npm dist-tags | RC, ignore |
| v7 | 7.82.0 | — | rntme lockfile | Currently installed |

Release cadence: ~1 minor every 2–3 weeks; patch releases within days for regressions.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---|---:|---|---|
| `@workos-inc/node` | 8.x / 9.x | WorkOS API SDK (SSO, Directory Sync, User Management, Webhooks) | Official SDK; covers enterprise auth patterns (SAML, OIDC, SCIM) that are error-prone to implement manually |

### Supporting
| Library | Version | Purpose | When to Use |
|---|---:|---|---|
| `@clerk/backend` | ^1.x | Alternative identity backend (sessions, JWT verification, user management) | When you need drop-in sessions/JWT without enterprise SSO/SCIM |
| `auth0` / `express-openid-connect` | ^3.x / ^2.x | Auth0 SDK and middleware | When Auth0 is the chosen vendor |
| `jose` | ^6.x | JWT/JWS/JWE verification | Always, for any JWT validation regardless of auth vendor |
| `iron-webcrypto` | ^2.x | Sealed session cookies | Used internally by WorkOS v8+; consider directly if rolling custom session cookies |

### Alternatives Considered
| Instead of | Could Use | Tradeoff | Recommendation for rntme |
|---|---|---|---|
| `@workos-inc/node` | `@clerk/backend` | Clerk is simpler for app auth but lacks enterprise SSO/SCIM depth; pricing model differs | Not a replacement — WorkOS targets enterprise integrations; Clerk targets app auth. Keep both if rntme later supports Clerk module (see `modules/identity/clerk`). |
| `@workos-inc/node` | Auth0 Management API SDK | Auth0 has broader ecosystem but higher vendor lock-in and cost at scale | WorkOS is purpose-built for B2B SSO/SCIM; stay with WorkOS for this module. |
| `@workos-inc/node` | Custom SAML/OIDC/SCIM | Extreme complexity, security risk, compliance burden | **Don't hand-roll** — SSO/SCIM protocol edge cases (SLO, IdP metadata rotation, attribute mapping) are hazardous to implement in-house. |

Installation / upgrade commands, if eventually recommended:
```bash
# Step 1: upgrade to v8 (safe on Node 20)
pnpm add @workos-inc/node@^8.13.0

# Step 2: later, after Node 22 runtime migration
pnpm add @workos-inc/node@^9.1.1
```

## Architecture Patterns

### System Architecture Diagram
```mermaid
flowchart LR
  Client[HTTP / gRPC client] --> Surface[rntme Identity Surface]
  Surface --> Adapter[@rntme/identity-workos adapter]
  Adapter --> SDK[WorkOS Node SDK]
  SDK --> WorkOSAPI[(WorkOS REST API)]
  WorkOSAPI --> IdP[(Enterprise IdP / SCIM)]
  WorkOSAPI --> WebhookEvents[Webhook events]
  WebhookEvents --> Verifier[webhooks.constructEvent]
  Verifier --> Adapter
```

### Component Responsibilities
| Component | Responsibility | Implementation mapping | Notes |
|---|---|---|---|
| Identity Surface | Canonical contract (`identity/v1`) | `packages/contracts/identity/v1` | gRPC service definitions |
| WorkOS Adapter | Vendor mapping | `modules/identity/workos/src/adapter.ts` | Translates canonical ↔ WorkOS SDK calls |
| Webhook Handler | Verify & translate events | `modules/identity/workos/src/webhooks.ts` | Uses `workos.webhooks.constructEvent` |
| Conformance Tests | Canonical compliance | `modules/identity/workos/test/conformance.mock.test.ts` | Mock-based, no network |

### Pattern 1: Adapter-as-Bridge
What: A thin module wraps a vendor SDK behind a canonical contract, exposing only claimed capabilities.
When to use: In rntme's module system, every vendor module follows this pattern.
Example:
```ts
// Source: modules/identity/workos/src/adapter.ts
import { WorkOS } from '@workos-inc/node';

export function createWorkOSAdapter(options: { apiKey: string; clientId?: string }) {
  const workos = new WorkOS(options.apiKey, options.clientId ? { clientId: options.clientId } : undefined);
  return {
    getUser: async (userId) => asRecord(await workos.userManagement.getUser(userId)),
    listUsers: async (params) => asPaginated(await workos.userManagement.listUsers(asSdkParams(params))),
    // ...
  };
}
```

### Pattern 2: Webhook Verification with Canonical Translation
What: Verify WorkOS webhook signatures, then map vendor events to canonical lifecycle events.
When to use: Any module that claims webhook support.
Example:
```ts
// Source: modules/identity/workos/src/webhooks.ts
import { WorkOS } from '@workos-inc/node';

const workos = new WorkOS(apiKey);
return async (request) => workos.webhooks.constructEvent(request) as Promise<WorkOSWebhookEvent>;
```

### Anti-Patterns to Avoid
- **Deep-importing SDK internals**: `@workos-inc/node/lib/...` paths are not public API. v8 moved to `tsdown` and restructured internals.
- **Relying on default pagination order**: v9 standardized authorization list endpoints to descending by default. Always pass `order` explicitly if order matters.
- **Ignoring Node version gates**: v9's `engines` field rejects Node 20. `pnpm install` will fail or warn depending on `engine-strict`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| SAML/OIDC SSO | Custom SAML parser + redirect handler | `@workos-inc/node` or `@clerk/backend` | SAML XML signing, Assertion encryption, IdP metadata rotation, and OIDC nonce/state validation are security-critical and easy to get wrong |
| SCIM provisioning | Custom SCIM REST API | `@workos-inc/node` Directory Sync | SCIM filter syntax, pagination, and multi-value attribute normalization are under-specified in practice |
| Sealed session cookies | `crypto.createCipher` + manual cookie logic | `iron-webcrypto` or WorkOS `loadSealedSession` | Timing attacks, cipher selection, and key rotation are handled by battle-tested libraries |
| Webhook signature verification | `crypto.createHmac` with manual tolerance | `workos.webhooks.constructEvent` | WorkOS SDK handles signature format parsing, tolerance windows, and payload normalization |

Key insight: Enterprise auth protocols have dozens of edge cases (clock skew, certificate expiry, ambiguous attribute mappings). The cost of getting any of them wrong is a security incident or customer onboarding failure.

## Common Pitfalls

### Pitfall 1: Node.js Version Mismatch on v9
What goes wrong: `pnpm install` fails or CI breaks because v9 requires Node >=22.11.0.
Why it happens: The `engines` field is enforced by `engine-strict=true` or newer pnpm versions.
How to avoid: Bump monorepo `engines.node` to `>=22.11.0` **before** upgrading the dependency. Test on staging runtimes (Dokploy/Docker) first.
Warning signs: `ERR_PNPM_UNSUPPORTED_ENGINE` during install; `SyntaxError` for newer JS features at runtime.

### Pitfall 2: Silent Webhook Event Changes
What goes wrong: Unknown webhook event types now throw deserialization errors in v9 instead of being loosely handled.
Why it happens: v9 tightened `constructEvent` behavior for unrecognized event types.
How to avoid: Maintain an explicit allow-list in `modules/identity/workos/src/webhooks.ts` and add integration tests for each claimed event type.
Warning signs: Webhook endpoint returns 500 for new WorkOS event types that weren't present in v7.

### Pitfall 3: Deprecated Method Removal Across Two Majors
What goes wrong: Methods deprecated in v6/v7 were removed in v8; methods/renames from v8 were finalized in v9. If rntme ever expands to use SSO/MFA/Portal APIs, those call sites will break.
Why it happens: WorkOS aggressively cleans up deprecated surface to match their OpenAPI-generated SDK.
How to avoid: Keep adapter usage limited to the small canonical surface. Audit any future module expansion against the V8/V9 migration guides before writing code.
Warning signs: TypeScript compilation errors after `pnpm install` for new major versions.

## Code Examples

### Initialize WorkOS Client
```ts
// Source: modules/identity/workos/src/adapter.ts (current v7 pattern)
import { WorkOS } from '@workos-inc/node';

const workos = new WorkOS(options.apiKey, options.clientId ? { clientId: options.clientId } : undefined);
```

### Verify Webhook
```ts
// Source: modules/identity/workos/src/webhooks.ts (current v7 pattern)
import { WorkOS } from '@workos-inc/node';

const workos = new WorkOS(apiKey);
return async (request) =>
  workos.webhooks.constructEvent({
    payload: request.body,
    sigHeader: headerValue(request.headers, 'workos-signature'),
    secret: webhookSecret,
    tolerance: 300_000, // 5 minutes
  }) as Promise<WorkOSWebhookEvent>;
```

### List Users with Pagination
```ts
// Source: WorkOS v9 API (verified via Context7 / official docs)
import { WorkOS } from '@workos-inc/node';

const workos = new WorkOS({ apiKey: 'sk_test_...' });
const page = await workos.userManagement.listUsers({
  organizationId: 'org_123',
  limit: 10,
});
// page.data, page.listMetadata.before, page.listMetadata.after
```

## State of the Art (2024-2026)

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| v7 `new WorkOS(apiKey)` | v8+ `new WorkOS({ apiKey })` or `createWorkOS()` | v8 (2025) | Config object preferred; `createWorkOS()` adds compile-time type safety for public vs confidential clients |
| v7 manual session sealing | v8 `loadSealedSession()` + `session.refresh()` | v8 (2025) | Cleaner session lifecycle |
| v7 `sendMagicAuthCode()` | v8 `userManagement.createMagicAuth()` | v8 (2025) | Consistent CRUD naming |
| v7 `domains: string[]` on org create | v8 `domainData: OrganizationDomain[]` | v8 (2025) | Richer domain state |
| v8 `workos.portal` | v9 `workos.adminPortal` | v9 (2026-04) | Renamed for consistency |
| v8 `workos.mfa` | v9 `workos.multiFactorAuth` | v9 (2026-04) | Renamed for consistency |
| v8 legacy FGA | v9 `workos.authorization` | v9 (2026-04) | FGA deprecated and removed |

New tools/patterns to consider:
- **PKCE in v8**: Useful if rntme ever adds a public/mobile client surface.
- **Feature Flags (v8.11+)**: WorkOS now ships feature flags. Not relevant to identity module today, but worth tracking.
- **Groups API (v9.0+)**: New endpoints for group management.

Deprecated/outdated:
- v7 `sendMagicAuthCode`, `sendPasswordResetEmail`, `refreshAndSealSessionData`
- v7 `getPrimaryEmail()` helper
- v8 `workos.fga` (removed in v9)
- v8 `workos.portal`, `workos.mfa` (renamed in v9)

## Migration Assessment

| Area | Finding | Impact | Risk | Evidence |
|---|---|---|---|---|
| **Breaking changes affecting rntme** | Very few. rntme uses a narrow subset: `userManagement` CRUD, `organizations` CRUD, `webhooks.constructEvent`. | Low | Low | Code audit of `modules/identity/workos/src/adapter.ts` and `webhooks.ts` |
| **Node.js runtime** | v9 requires Node >=22.11.0. rntme currently requires >=20. | High (infra) | Medium | `package.json` engines; [V9_MIGRATION_GUIDE.md](https://github.com/workos/workos-node/blob/main/docs/V9_MIGRATION_GUIDE.md) |
| **TypeScript compilation** | v8 is ESM-first with dual CJS/ESM exports. rntme uses ESM (`"type": "module"`). | Low | Low | `modules/identity/workos/package.json` |
| **Webhook behavior** | v9 tightens unknown event deserialization. | Low | Low | rntme already ignores unclaimed events explicitly |
| **Security posture** | No CVEs found for `@workos-inc/node` itself. v8.11.1 patched miniflare/undici transitive vulns. | Low | Low | `npm audit`, GitHub changelog |
| **Test coverage** | Mock conformance tests exist; live tests need WorkOS sandbox secrets. | Medium | Medium | `test/conformance.mock.test.ts` |
| **Migration effort v7→v8** | ~1–2 hours: bump version, run typecheck/tests, verify `listOrganizationMemberships` still passes params, `createOrganization` uses `domainData` if applicable. | Low | Low | Migration guide analysis |
| **Migration effort v8→v9** | ~2–4 hours plus Node 22 infra work: bump version, run typecheck/tests, verify webhook handling, check error typing. | Medium | Medium | Migration guide analysis |

**Specific code changes required for v8:**
1. `modules/identity/workos/package.json`: bump to `^8.13.0`
2. Verify `listOrganizationMemberships` calls in `adapter.ts` already pass `organizationId` or `userId` (they do, via canonical params mapping).
3. If any direct `createOrganization` uses `domains` array, migrate to `domainData`. rntme adapter maps from canonical shape; verify the canonical shape uses the new field name.

**Specific code changes required for v9:**
1. All of the above, plus Node 22 runtime migration.
2. Verify `constructEvent` behavior with unknown event types in tests.
3. No `portal`/`mfa`/`fga` usage to migrate (confirmed by code audit).

## Recommendation

**Decision: KEEP + UPGRADE (staged)**

Rationale:
- WorkOS remains the right choice for rntme's enterprise identity module. Alternatives (Clerk, Auth0) do not cover the same B2B SSO/SCIM niche.
- The v7→v8 migration is low-risk because rntme's adapter surface is narrow and well-isolated.
- The v8→v9 migration is blocked only by Node.js runtime version, not by API incompatibility.
- No security advisories mandate an immediate emergency upgrade.

Follow-up tasks to create later:
1. **Node 22 runtime migration** (prerequisite for v9): Update root `package.json` `engines.node`, Dockerfile base images, Dokploy Node version, and CI matrix.
2. **v8 upgrade task**: Bump `@workos-inc/node` to `^8.13.0`, run full typecheck/tests, validate webhook behavior.
3. **v9 upgrade task**: After Node 22 is live, bump to `^9.1.1` and repeat validation.
4. **Live conformance wiring**: Provide WorkOS sandbox credentials and wire `test/conformance.mock.test.ts` to a live runner.

## Open Questions

1. **Does rntme plan to claim Session RPCs (`GetSession`, `ListSessions`, `IntrospectSession`, `RevokeSession`) in the Identity canonical contract?**
   - What we know: WorkOS v8+ has `loadSealedSession()` and PKCE flows, but rntme's module currently returns `UNIMPLEMENTED` for all session RPCs.
   - What's unclear: Whether the canonical contract will expand to include sessions, and if so, whether WorkOS session semantics map safely.
   - Recommendation: Defer session claims until a product requirement is explicit; document the gap in module README.

2. **Should rntme adopt `createWorkOS()` for compile-time client type safety?**
   - What we know: v8 introduced `createWorkOS()` which distinguishes public (clientId-only) from confidential (apiKey) clients at compile time.
   - What's unclear: Whether rntme's adapter factory pattern benefits from this, since the adapter is always server-side with an API key.
   - Recommendation: Not required for the current server-only adapter; use `new WorkOS()` for simplicity.

## Sources

### Primary (HIGH confidence)
- `/workos/workos-node` (Context7) — Migration patterns, API examples, PKCE usage, session handling
- [GitHub: workos/workos-node CHANGELOG.md](https://github.com/workos/workos-node/blob/main/CHANGELOG.md) — Release history, breaking changes, bug fixes
- [GitHub: V8_MIGRATION_GUIDE.md](https://github.com/workos/workos-node/blob/main/docs/V8_MIGRATION_GUIDE.md) — Detailed v7→v8 breaking changes
- [GitHub: V9_MIGRATION_GUIDE.md](https://github.com/workos/workos-node/blob/main/docs/V9_MIGRATION_GUIDE.md) — Detailed v8→v9 breaking changes
- npm registry (`npm info @workos-inc/node`) — Version metadata, dist-tags, dependencies, engine requirements

### Secondary (MEDIUM confidence)
- WebFetch verified with official source — Node engine requirements, release dates, changelog entries
- Code audit of `modules/identity/workos/src/adapter.ts` and `webhooks.ts` — Exact SDK surface used by rntme

### Tertiary (LOW confidence - needs validation)
- None.

## Metadata

Research scope:
- Core technology: `@workos-inc/node` WorkOS SDK
- Ecosystem: Node.js enterprise auth SDKs, alternatives (Clerk, Auth0, Keycloak)
- Patterns: Adapter pattern, webhook verification, canonical contract mapping
- Pitfalls: Node version gates, deprecated method removal, webhook deserialization tightening

Confidence breakdown:
- Standard stack: HIGH — WorkOS is the dominant vendor-specific SDK for enterprise SSO/SCIM; alternatives are well-documented.
- Architecture: HIGH — rntme's adapter pattern is clearly implemented and matches best practices.
- Pitfalls: HIGH — Migration guides are explicit; code audit confirms narrow usage surface.
- Code examples: HIGH — Verified against Context7 and official GitHub docs.

Research date: 2026-04-28
Valid until: 2026-07-28 (or next major version release)
Ready for migration planning: **yes**
