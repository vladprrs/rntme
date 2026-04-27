# identity canonical contract v1 — design

**Status:** design
**Author:** brainstorm 2026-04-26
**Related:**
- `docs/superpowers/specs/2026-04-26-modules-monorepo-structure-design.md` — defines `packages/contracts/<category>/v<n>/` layout, capability-based UNION conformance, governance rule for canonical growth (≥2 vendors OR archetypal), `module.json` schema. This spec produces the first concrete category-contract under that umbrella.
- `docs/superpowers/specs/done/2026-04-19-platform-modules-integration-design.md` — module pattern: wrapper around vendor SDK, gRPC surface, webhook receiver, no choreography. This spec's contract is implemented by Identity wrappers, never by gateways.
- `docs/superpowers/specs/done/2026-04-17-cloudevents-envelope-design.md` — CloudEvents 1.0 envelope; this spec defines the `data` payloads and `type` short-names for the Identity category.
- `.tmp/identity_canonical_api.agent.final.md` — deep-dive review across 12 vendors (Clerk, Auth0, WorkOS, Stytch, Keycloak, Frontegg, FusionAuth, Cognito, Firebase, Logto, Okta, Entra) used as input. Local-only document, not committed.
- `rntme_orchestration_only`, `project_pre_stable_stage` memories.

**Implementation locations:**
- Shared cross-category primitives — new `packages/contracts/_common/v1/` (workspace package `@rntme/contracts-common-v1`)
- Canonical Identity contract — new `packages/contracts/identity/v1/` (workspace package `@rntme/contracts-identity-v1`)
- Category README + conformance suite skeleton — new `modules/identity/README.md` and `modules/identity/conformance/` (workspace package `@rntme/conformance-identity`)
- Implementation plans for this spec — `docs/superpowers/plans/done/identity-canonical-contract/`

## 1. Problem

The `2026-04-26-modules-monorepo-structure-design.md` spec defined where category contracts live (`packages/contracts/<category>/v<n>/`) and how modules declare capability subsets (`module.json#capabilities[]`), but explicitly deferred category content: "Identity-category contract content (canonical RPCs, events, error codes) and the Identity module skeleton + developer task template are not part of these plans — they are the output of the next two brainstorms" (§11).

Without a canonical Identity contract, every vendor module — `identity-clerk`, `identity-auth0`, `identity-workos` — would invent its own gRPC service shape, its own event short-names, its own error codes. Domain blueprints would then bind to vendor-shaped contracts, defeating the categorical-abstraction goal of the modules-monorepo spec. The first concrete category contract has to land before any vendor implementation, and Identity is the highest-leverage starting point because it is the most-converged B2B SaaS category and the dependency every other category sits on top of (Payments customers are users, CRM contacts are users).

A second, structural problem: the modules-monorepo spec's category-package layout (§5.1) does not define a home for primitives every category needs — `CanonicalRef`, `CommandContext`, `Name`, list pagination/filter/sort messages, and the canonical `Metadata` envelope. Inlining these inside each category contract guarantees drift across categories within two iterations. This spec resolves that by adding a small `_common/v1/` umbrella.

## 2. Goal

Define the v1 canonical Identity contract: protobuf service, message types, status enums, event payloads, error codes, and the conformance-scenarios skeleton. Out of this spec, an LLM agent generating a vendor-specific Identity module from `module-skeleton` should know exactly which gRPC surface to implement, which capabilities to declare, which events to emit, and which conformance scenarios to pass.

**In scope:**
- New `packages/contracts/_common/v1/` package with shared cross-category primitives.
- New `packages/contracts/identity/v1/` package: `identity.proto` (service + entities + enums), `identity-events.proto` (17 event payloads), `error-codes.json`, README.
- Six Identity entities: `User`, `Organization`, `OrganizationMembership`, `Invitation`, `Session`, plus the helper type `IdentityResolution`.
- Twenty-four canonical RPCs covering CRUD/list per entity, identity resolution, session introspection, session revocation.
- Seventeen canonical CloudEvents covering the lifecycle of all five aggregates.
- Conformance-scenarios skeleton at `modules/identity/conformance/` with one scenario file per RPC.
- Governance reaffirmation: how Identity v1 grows.

**Explicitly out of scope:**
- Identity module skeleton + developer task template (next brainstorm).
- First vendor implementation (recommended: Clerk — separate spec/plan).
- Impersonation, RoleAssignment as a separate aggregate, AssignRole/RevokeRole RPCs, MFA-policy hierarchy, audit-event stream — deferred per Q3 of brainstorm; live in `<vendor>-extensions.proto` if a vendor supports them, or in future categories (`audit`, `directory-sync`).
- JWT issuance, JWKS endpoint hosted by rntme, SCIM v2 inbound endpoint hosted by rntme — explicitly excluded per Q2 (wrapper, not gateway). The reference review's ADR-003/005/009 are noted-and-rejected for Identity v1.
- Other category contracts (Payments, CRM, AI/LLM, Analytics) — separate brainstorms each. `_common/v1/` is reused.
- Live-conformance secret management — covered by modules-monorepo §7.3 / future spec.

## 3. Decisions matrix

| # | Question | Decision |
|---|---|---|
| Q1 | Scope of this spec | **Canonical Identity contract only** — vendor module skeleton and first vendor are subsequent brainstorms |
| Q2 | Module architectural model | **Wrapper + IntrospectSession helper** — module wraps a single vendor; rntme does not issue its own JWT, host JWKS, or expose SCIM inbound; `IntrospectSession` RPC normalises upstream session/token reading |
| Q3 | Surface size for v1 | **24 RPCs / 6 entities / 17 events** — RoleAssignment as separate aggregate dropped (`roles[]` on Membership covers it); AssignRole/RevokeRole dropped (collapsed into UpdateMembership); Impersonate dropped (Clerk-only, not archetypal); MFA policy dropped (vendor-fragmented) |
| Q4 | Metadata model | **Three-level** (`public` / `private` / `unsafe`) via shared `_common.Metadata` message — chosen for visibility-control fidelity to Clerk and Auth0; flat-attribute vendors map via documented prefix conventions |
| Q5 | Where do shared primitives (CanonicalRef, CommandContext, Name, ListRequest…) live | **New shared package `packages/contracts/_common/v1/`** — extension to modules-monorepo §5.1, single source of truth across categories |
| Q6 | Enum convention | `<TYPE>_UNSPECIFIED = 0` for default, `<TYPE>_VENDOR_SPECIFIC = 100` as escape hatch — proto3 best practice; review's mixed UNKNOWN/UNSPECIFIED normalised |
| Q7 | CloudEvents `type` form | `rntme.identity.v1.<EventShortName>` — per modules-monorepo §8.3.3 reconstruction template |
| Q8 | Kafka topic form | `rntme.identity.<aggregate>` — five topics, no version suffix per CLAUDE.md "topic names carry no version suffix" |
| Q9 | Capability minimum baseline | **No structural enforcement** — modules-monorepo §7.3 anti-conformance only enforces UNIMPLEMENTED for unclaimed RPCs. Recommended baseline (Tier-1: User CRUD + Session created/revoked) lives in category README, not in validator |
| Q10 | Conformance mock-vendor | **Generic, lives in `@rntme/conformance-framework`** — closes modules-monorepo OQ4 for Identity. Identity-conformance package supplies fixtures and assertions only |

## 4. Layout

This spec adds three workspace packages to the repo. All paths are new.

```
packages/contracts/
├── _common/v1/                                # NEW workspace package @rntme/contracts-common-v1
│   ├── proto/
│   │   └── common.proto                        # shared primitives, no business logic
│   ├── src/                                    # generated JS/DTS bindings via protobufjs-cli (OQ-IDV1-1)
│   ├── error-codes.json                        # empty JSON object — _common has no domain errors
│   ├── package.json
│   └── README.md
└── identity/v1/                                # NEW workspace package @rntme/contracts-identity-v1
    ├── proto/
    │   ├── identity.proto                       # service IdentityModule + entities + enums
    │   └── identity-events.proto                # 17 event payloads
    ├── src/                                     # generated TS bindings
    ├── error-codes.json                         # IDENTITY_<LAYER>_<KIND> set
    ├── package.json
    └── README.md

modules/identity/                                # NEW (category root only — vendor dirs are next brainstorm)
├── README.md                                    # category-doc, contributor entry point
└── conformance/                                 # NEW workspace package @rntme/conformance-identity
    ├── src/
    │   ├── suite.ts                              # exports CategoryConformanceSuite
    │   ├── fixtures/
    │   │   ├── users.ts
    │   │   ├── organizations.ts
    │   │   └── invitations.ts
    │   └── scenarios/                            # one file per canonical RPC (24 stubs in v1)
    │       ├── GetUser.scenarios.ts
    │       ├── ListUsers.scenarios.ts
    │       ├── CreateUser.scenarios.ts
    │       └── …
    ├── package.json
    └── README.md
```

`pnpm-workspace.yaml` is extended to include `packages/contracts/**` and `modules/**` (modules-monorepo plan 1 may have done this already; if not, this spec's plan does it).

Layout decisions worth noting:
- **`_common/v1/` is a flat sibling of `identity/v1/`**, not a parent. It sits under `packages/contracts/` so its lifecycle and versioning convention match every category. It still major-bumps independently when its primitives need breaking changes.
- **`error-codes.json` for `_common/v1/` is `{}`**. The package has no domain. This is intentional — it preserves the per-package shape from modules-monorepo §5.1 without inventing a domain for a primitives-only package.
- **`modules/identity/` ships in this spec without any vendor directory**. Only the category README and conformance package land. The first vendor (`modules/identity/<vendor>/`) is a subsequent brainstorm.

## 5. `_common/v1/common.proto`

```protobuf
syntax = "proto3";
package rntme.contracts.common.v1;

import "google/protobuf/timestamp.proto";
import "google/protobuf/struct.proto";

// Canonical reference. Every category aggregate begins with one of these.
message CanonicalRef {
  string canonical_id = 1;        // UUID v4, stable across vendor renames
  string vendor_id = 2;            // raw id from upstream (e.g. "user_2abc...")
  string module_name = 3;          // "identity-clerk" — matches module.json#name
  string module_version = 4;       // semver of the module that produced this snapshot
  string contract_version = 5;     // "v1" — major of the canonical contract
}

// Command context. Required on every Command RPC across every category.
message CommandContext {
  string idempotency_key = 1;      // required; module uses it as dedup key for upstream call
  string correlation_id = 2;       // propagates through CloudEvents `correlationid` extension
  string actor_user_id = 3;        // canonical_id of initiating user/service-account
  string actor_type = 4;           // "user" | "service_account" | "system"
  string tenant_id = 5;            // optional org/tenant scope for multi-tenant services
}

// Person name. Lives in _common because Payments (billing customer) needs the same shape.
message Name {
  string given = 1;
  string family = 2;
  string display = 3;              // when vendor returns full name only, it goes here
}

// Universal List request. Every category's List* RPC nests one of these as field 1.
message ListRequest {
  int32 limit = 1;                 // default 20, max 100
  string cursor = 2;               // opaque cursor (preferred)
  int32 offset = 3;                // fallback for offset-based vendors
  repeated Filter filters = 4;
  repeated Sort sorts = 5;
}

message Filter {
  string field = 1;
  FilterOperator operator = 2;
  string value = 3;
  repeated string values = 4;       // for IN / NOT_IN
}

enum FilterOperator {
  FILTER_OPERATOR_UNSPECIFIED = 0;
  FILTER_OPERATOR_EQ = 1;
  FILTER_OPERATOR_NEQ = 2;
  FILTER_OPERATOR_GT = 3;
  FILTER_OPERATOR_GTE = 4;
  FILTER_OPERATOR_LT = 5;
  FILTER_OPERATOR_LTE = 6;
  FILTER_OPERATOR_IN = 7;
  FILTER_OPERATOR_NOT_IN = 8;
  FILTER_OPERATOR_CONTAINS = 9;
  FILTER_OPERATOR_PREFIX = 10;
  FILTER_OPERATOR_SUFFIX = 11;
}

message Sort {
  string field = 1;
  SortDirection direction = 2;
}

enum SortDirection {
  SORT_DIRECTION_UNSPECIFIED = 0;
  SORT_DIRECTION_ASC = 1;
  SORT_DIRECTION_DESC = 2;
}

message ListResponseMeta {
  int32 limit = 1;
  string next_cursor = 2;
  string prev_cursor = 3;
  int32 total_count = 4;            // 0 if vendor doesn't expose total
  bool has_more = 5;
}

// Three-level metadata. Every category that has user-customisable metadata uses this exact message.
message Metadata {
  google.protobuf.Struct public = 1;   // included in JWT/public projections; readable by all
  google.protobuf.Struct private = 2;  // server-only; never enters JWT or public projection
  google.protobuf.Struct unsafe = 3;   // user-editable from frontend; not in JWT
}
```

## 6. `identity/v1/identity.proto` — entities and enums

### 6.1 Status enums

All Identity status enums follow the rntme convention: `<TYPE>_UNSPECIFIED = 0` (proto3 zero), `<TYPE>_VENDOR_SPECIFIC = 100` (escape hatch for vendor statuses with no canonical equivalent). The 1–99 range is reserved for canonical values; 100+ is reserved for vendor-specific extensions.

```protobuf
syntax = "proto3";
package rntme.contracts.identity.v1;

import "google/protobuf/timestamp.proto";
import "google/protobuf/struct.proto";
import "rntme/contracts/common/v1/common.proto";

enum UserStatus {
  USER_STATUS_UNSPECIFIED = 0;
  USER_STATUS_ACTIVE = 1;
  USER_STATUS_PENDING = 2;          // awaiting email/phone verification
  USER_STATUS_SUSPENDED = 3;        // administrative pause
  USER_STATUS_DELETED = 4;          // soft-deleted
  USER_STATUS_BLOCKED = 5;          // brute-force / breached-password block
  USER_STATUS_VENDOR_SPECIFIC = 100;
}

enum OrgStatus {
  ORG_STATUS_UNSPECIFIED = 0;
  ORG_STATUS_ACTIVE = 1;
  ORG_STATUS_SUSPENDED = 2;
  ORG_STATUS_DELETED = 3;
  ORG_STATUS_VENDOR_SPECIFIC = 100;
}

enum MembershipStatus {
  MEMBERSHIP_STATUS_UNSPECIFIED = 0;
  MEMBERSHIP_STATUS_ACTIVE = 1;
  MEMBERSHIP_STATUS_PENDING = 2;
  MEMBERSHIP_STATUS_REVOKED = 3;
  MEMBERSHIP_STATUS_SUSPENDED = 4;
  MEMBERSHIP_STATUS_VENDOR_SPECIFIC = 100;
}

enum InvitationStatus {
  INVITATION_STATUS_UNSPECIFIED = 0;
  INVITATION_STATUS_PENDING = 1;
  INVITATION_STATUS_ACCEPTED = 2;
  INVITATION_STATUS_REVOKED = 3;
  INVITATION_STATUS_EXPIRED = 4;
  INVITATION_STATUS_VENDOR_SPECIFIC = 100;
}

enum SessionStatus {
  SESSION_STATUS_UNSPECIFIED = 0;
  SESSION_STATUS_ACTIVE = 1;
  SESSION_STATUS_ENDED = 2;          // user-initiated logout
  SESSION_STATUS_REVOKED = 3;        // admin / security
  SESSION_STATUS_EXPIRED = 4;
  SESSION_STATUS_VENDOR_SPECIFIC = 100;
}

enum TokenType {
  TOKEN_TYPE_UNSPECIFIED = 0;
  TOKEN_TYPE_OPAQUE_SESSION = 1;     // Clerk hybrid (HttpOnly cookie + 60s JWT)
  TOKEN_TYPE_JWT_ACCESS = 2;          // Auth0/Stytch/WorkOS pure-JWT
  TOKEN_TYPE_JWT_REFRESH = 3;
}

enum ResolutionInputType {
  RESOLUTION_INPUT_TYPE_UNSPECIFIED = 0;
  RESOLUTION_INPUT_TYPE_EMAIL = 1;
  RESOLUTION_INPUT_TYPE_VENDOR_ID = 2;
  RESOLUTION_INPUT_TYPE_SSO_SUBJECT = 3;
  RESOLUTION_INPUT_TYPE_PHONE = 4;
  RESOLUTION_INPUT_TYPE_USERNAME = 5;
}
```

### 6.2 Entities

The six Identity types: five aggregates (`User`, `Organization`, `OrganizationMembership`, `Invitation`, `Session`) plus the transient helper `IdentityResolution` (no `vendor_raw`, no `CanonicalRef` — it is the response shape of `ResolveIdentity`, not a stored aggregate).

```protobuf
message User {
  rntme.contracts.common.v1.CanonicalRef ref = 1;

  string email = 2;
  bool email_verified = 3;
  rntme.contracts.common.v1.Name name = 4;
  string phone = 5;
  bool phone_verified = 6;
  string avatar_url = 7;

  UserStatus status = 8;
  rntme.contracts.common.v1.Metadata metadata = 9;

  google.protobuf.Timestamp created_at = 10;
  google.protobuf.Timestamp updated_at = 11;
  google.protobuf.Timestamp last_sign_in_at = 12;
  google.protobuf.Timestamp deleted_at = 13;       // soft-delete

  google.protobuf.Struct vendor_raw = 14;
}

message Organization {
  rntme.contracts.common.v1.CanonicalRef ref = 1;

  string name = 2;
  string slug = 3;                 // human-readable URL identifier; empty when vendor doesn't support
  string logo_url = 4;
  string description = 5;

  OrgStatus status = 6;
  rntme.contracts.common.v1.Metadata metadata = 7;

  int32 max_members = 8;            // 0 = unlimited

  google.protobuf.Timestamp created_at = 9;
  google.protobuf.Timestamp updated_at = 10;
  google.protobuf.Timestamp deleted_at = 11;

  google.protobuf.Struct vendor_raw = 12;
}

message OrganizationMembership {
  rntme.contracts.common.v1.CanonicalRef ref = 1;

  string user_id = 2;               // -> User.ref.canonical_id
  string organization_id = 3;       // -> Organization.ref.canonical_id

  // Q3: roles array. Single-role vendors (Clerk, WorkOS) wrap as [primary_role].
  // Writing roles.length > 1 to a single-role vendor returns IDENTITY_CONSISTENCY_UNSUPPORTED_MULTIROLE.
  repeated string roles = 4;
  repeated string permissions = 5;  // derived; read-only on the API surface

  MembershipStatus status = 6;
  rntme.contracts.common.v1.Metadata metadata = 7;

  google.protobuf.Timestamp created_at = 8;
  google.protobuf.Timestamp updated_at = 9;

  google.protobuf.Struct vendor_raw = 10;
}

message Invitation {
  rntme.contracts.common.v1.CanonicalRef ref = 1;

  string email = 2;
  string organization_id = 3;
  string inviter_user_id = 4;       // canonical_id of the inviting admin

  repeated string roles = 5;        // pre-assigned; copied to Membership on ACCEPTED
  rntme.contracts.common.v1.Metadata metadata = 6;  // public-tier copies into the resulting Membership

  InvitationStatus status = 7;

  google.protobuf.Timestamp expires_at = 8;
  google.protobuf.Timestamp accepted_at = 9;
  google.protobuf.Timestamp revoked_at = 10;
  google.protobuf.Timestamp created_at = 11;

  google.protobuf.Struct vendor_raw = 12;
}

message Session {
  rntme.contracts.common.v1.CanonicalRef ref = 1;

  string session_id = 2;            // opaque id or JWT jti
  string user_id = 3;
  string organization_id = 4;       // current active org context (optional)

  TokenType token_type = 5;
  repeated string roles = 6;        // effective in current org context
  repeated string permissions = 7;
  repeated string verified_factors = 8;  // "totp" | "sms" | "webauthn" | …

  SessionStatus status = 9;

  string ip_address = 10;
  string user_agent = 11;

  google.protobuf.Timestamp started_at = 12;
  google.protobuf.Timestamp last_active_at = 13;
  google.protobuf.Timestamp expires_at = 14;
  google.protobuf.Timestamp revoked_at = 15;

  google.protobuf.Struct vendor_raw = 16;
}

// Helper. Used as ResolveIdentity response. Not a stored aggregate.
message IdentityResolution {
  oneof identity {
    User user = 1;
    Organization organization = 2;
  }
  bool exists = 3;
  string canonical_id = 4;

  ResolutionInputType input_type = 5;
  string input_value = 6;

  google.protobuf.Timestamp resolved_at = 7;
}
```

Design notes:
- **`RoleAssignment` is not an entity.** `roles[]` on `OrganizationMembership` is the full role model. Adding it later requires either a second vendor needing it (governance §6.3) or a major bump.
- **`permissions[]` is derived, read-only on the API.** The module computes it from `roles` before publishing. Mutation requests do not accept `permissions`.
- **`vendor_raw` is present on every aggregate, absent on `IdentityResolution`.** The helper type is transient and has no upstream representation.
- **`slug` on `Organization` is an empty string when the vendor doesn't expose one** (Auth0). No alternative `slug_canonical` field — `slug` is optional and the adapter may leave it empty.
- **Soft-delete is canonical.** `deleted_at` plus `status = *_DELETED`. The Delete RPCs accept an opt-in `hard_delete` flag for vendors that do support hard-delete (Auth0).

## 7. `IdentityModule` service

Twenty-four RPCs across queries (twelve, including `IntrospectSession` and `ResolveIdentity`) and commands (twelve, no `Create` for Session — sessions are created by the vendor's auth flow, not by canonical command).

```protobuf
service IdentityModule {
  // ─── Queries ───────────────────────────────────────────────
  rpc GetUser(GetUserRequest) returns (User);
  rpc ListUsers(ListUsersRequest) returns (UserList);
  rpc GetOrganization(GetOrganizationRequest) returns (Organization);
  rpc ListOrganizations(ListOrganizationsRequest) returns (OrganizationList);
  rpc GetMembership(GetMembershipRequest) returns (OrganizationMembership);
  rpc ListMemberships(ListMembershipsRequest) returns (OrganizationMembershipList);
  rpc GetInvitation(GetInvitationRequest) returns (Invitation);
  rpc ListInvitations(ListInvitationsRequest) returns (InvitationList);
  rpc GetSession(GetSessionRequest) returns (Session);
  rpc ListSessions(ListSessionsRequest) returns (SessionList);
  rpc ResolveIdentity(ResolveIdentityRequest) returns (IdentityResolution);
  rpc IntrospectSession(IntrospectSessionRequest) returns (Session);

  // ─── Commands: User ────────────────────────────────────────
  rpc CreateUser(CreateUserRequest) returns (User);
  rpc UpdateUser(UpdateUserRequest) returns (User);
  rpc DeleteUser(DeleteUserRequest) returns (User);

  // ─── Commands: Organization ───────────────────────────────
  rpc CreateOrganization(CreateOrganizationRequest) returns (Organization);
  rpc UpdateOrganization(UpdateOrganizationRequest) returns (Organization);
  rpc DeleteOrganization(DeleteOrganizationRequest) returns (Organization);

  // ─── Commands: Invitation ─────────────────────────────────
  rpc CreateInvitation(CreateInvitationRequest) returns (Invitation);
  rpc RevokeInvitation(RevokeInvitationRequest) returns (Invitation);

  // ─── Commands: Membership ─────────────────────────────────
  rpc AddMembership(AddMembershipRequest) returns (OrganizationMembership);
  rpc UpdateMembership(UpdateMembershipRequest) returns (OrganizationMembership);
  rpc RemoveMembership(RemoveMembershipRequest) returns (OrganizationMembership);

  // ─── Commands: Session ────────────────────────────────────
  rpc RevokeSession(RevokeSessionRequest) returns (Session);
}
```

### 7.1 Request/response conventions

These conventions are uniform across the contract; only the per-RPC scope-filter fields vary.

- **Get*Request** → `string canonical_id = 1;`. No other fields.
- **List*Request** → `rntme.contracts.common.v1.ListRequest base = 1;` followed by domain-specific scope filters (`organization_id`, `user_id`, status enums, exact-match `email`, etc.).
- **\*List response** → `repeated <Entity> items = 1; rntme.contracts.common.v1.ListResponseMeta meta = 2;`.
- **Command*Request** → `rntme.contracts.common.v1.CommandContext context = 1;` first, body fields after. `idempotency_key` is required; missing it returns `IDENTITY_STRUCTURAL_MISSING_IDEMPOTENCY_KEY` (gRPC `INVALID_ARGUMENT`).
- **Update semantics: full replacement.** `Update*Request` carries the new desired state for declared fields; the module overwrites them. No `FieldMask` in v1. If partial-update need surfaces, that is a v1.minor addition (non-breaking).
- **Delete semantics: soft by default.** `Delete*Request { CommandContext context, string canonical_id, bool hard_delete }`. `hard_delete = false` produces `status = *_DELETED` plus `deleted_at`. `hard_delete = true` deletes upstream where supported; vendors that only soft-delete return `IDENTITY_CONSISTENCY_UNSUPPORTED_HARD_DELETE`.

Sample request/response messages — the rest follow the same pattern:

```protobuf
message GetUserRequest {
  string canonical_id = 1;
}

message ListUsersRequest {
  rntme.contracts.common.v1.ListRequest base = 1;
  string organization_id = 2;
  UserStatus status = 3;
  string email = 4;
}

message UserList {
  repeated User items = 1;
  rntme.contracts.common.v1.ListResponseMeta meta = 2;
}

message CreateUserRequest {
  rntme.contracts.common.v1.CommandContext context = 1;
  string email = 2;
  rntme.contracts.common.v1.Name name = 3;
  string phone = 4;
  string avatar_url = 5;
  rntme.contracts.common.v1.Metadata metadata = 6;
  bool email_verified = 7;
}

message UpdateUserRequest {
  rntme.contracts.common.v1.CommandContext context = 1;
  string canonical_id = 2;
  rntme.contracts.common.v1.Name name = 3;
  string phone = 4;
  string avatar_url = 5;
  rntme.contracts.common.v1.Metadata metadata = 6;
}

message DeleteUserRequest {
  rntme.contracts.common.v1.CommandContext context = 1;
  string canonical_id = 2;
  bool hard_delete = 3;
}

message ResolveIdentityRequest {
  ResolutionInputType input_type = 1;
  string input_value = 2;
  string organization_id = 3;       // optional scope
}

message IntrospectSessionRequest {
  string token = 1;                   // upstream session token or JWT
}

message RevokeSessionRequest {
  rntme.contracts.common.v1.CommandContext context = 1;
  string canonical_id = 2;
  string reason = 3;                  // "admin_action" | "security" | "user_action"
}
```

Other request/response pairs (`CreateOrganizationRequest`, `UpdateMembershipRequest`, `RevokeInvitationRequest`, etc.) mirror these patterns exactly. Implementation lands the full set in the proto file.

### 7.2 Special RPCs

- **`IntrospectSession(token) → Session`** is the architectural payoff of the wrapper-plus-helper model (Q2). The module owns the upstream token validation: Clerk via session-introspect API, Auth0 via JWKS-validated JWT decode, Keycloak via realm JWKS, and so on. Domain services receive a uniform canonical `Session` regardless of vendor token shape. Without this RPC, every domain service would carry vendor-specific JWT/JWKS knowledge — exactly what the categorical contract is meant to remove.

- **`ResolveIdentity(input_type, input_value, organization_id) → IdentityResolution`** is the JIT/SSO entry point. On first SSO login or SCIM provisioning, the domain service asks "is there a canonical user for SSO subject `s`?" — the module either resolves or reports `exists = false`, leaving creation to a follow-up `CreateUser`.

- **`RevokeSession`** is the only Session command. There is no `CreateSession` — sessions are created by the vendor's auth flow (password login, magic link, OAuth callback) and surface to the canonical layer via the `SessionCreated` event. The module never accepts a "create session" command from the canonical surface.

### 7.3 Error codes (`error-codes.json`)

Per CLAUDE.md naming convention `<PKG>_<LAYER>_<KIND>` → `IDENTITY_<LAYER>_<KIND>`. Layers map onto the modules-monorepo "parse → structural → references → consistency" canon, plus a `vendor` layer for upstream propagation.

```json
{
  "structural": [
    "IDENTITY_STRUCTURAL_MISSING_IDEMPOTENCY_KEY",
    "IDENTITY_STRUCTURAL_INVALID_EMAIL"
  ],
  "references": [
    "IDENTITY_REFERENCES_USER_NOT_FOUND",
    "IDENTITY_REFERENCES_ORGANIZATION_NOT_FOUND",
    "IDENTITY_REFERENCES_MEMBERSHIP_NOT_FOUND",
    "IDENTITY_REFERENCES_INVITATION_NOT_FOUND",
    "IDENTITY_REFERENCES_SESSION_NOT_FOUND"
  ],
  "consistency": [
    "IDENTITY_CONSISTENCY_DUPLICATE_EMAIL",
    "IDENTITY_CONSISTENCY_INVITATION_ALREADY_ACCEPTED",
    "IDENTITY_CONSISTENCY_INVITATION_EXPIRED",
    "IDENTITY_CONSISTENCY_UNSUPPORTED_MULTIROLE",
    "IDENTITY_CONSISTENCY_UNSUPPORTED_HARD_DELETE",
    "IDENTITY_CONSISTENCY_INVALID_TOKEN",
    "IDENTITY_CONSISTENCY_SESSION_REVOKED"
  ],
  "vendor": [
    "IDENTITY_VENDOR_RATE_LIMITED",
    "IDENTITY_VENDOR_UNAVAILABLE",
    "IDENTITY_VENDOR_UNAUTHORIZED",
    "IDENTITY_VENDOR_INVALID_REQUEST"
  ]
}
```

gRPC status mapping (modules implement this in their adapter, not in the contract package):

| Layer | gRPC `Code` | Notes |
|---|---|---|
| `structural` | `INVALID_ARGUMENT` | request shape problem |
| `references` | `NOT_FOUND` | canonical_id does not resolve |
| `consistency` | `FAILED_PRECONDITION` | state-machine violation, vendor-capability mismatch |
| `vendor.RATE_LIMITED` | `RESOURCE_EXHAUSTED` | with retry-info trailer |
| `vendor.UNAVAILABLE` | `UNAVAILABLE` | upstream timeout / 5xx |
| `vendor.UNAUTHORIZED` | `PERMISSION_DENIED` | upstream rejected module credentials |
| `vendor.INVALID_REQUEST` | `INVALID_ARGUMENT` | upstream reported a 4xx the module didn't catch first |

## 8. `identity/v1/identity-events.proto` — 17 canonical events

Topics, types, and source convention:
- **Kafka topic** (per CLAUDE.md, no version suffix): five topics, one per aggregate — `rntme.identity.user`, `rntme.identity.organization`, `rntme.identity.membership`, `rntme.identity.invitation`, `rntme.identity.session`.
- **CloudEvents `type`** (per modules-monorepo §8.3.3): `rntme.identity.v1.<EventShortName>`. Examples: `rntme.identity.v1.UserCreated`, `rntme.identity.v1.SessionRevoked`.
- **CloudEvents `source`**: set by the module (`module-identity-clerk`, etc.); the contract does not mandate a value.
- **`data` payload**: protobuf-serialised message from `identity-events.proto`.
- **Capability declaration**: `module.json#capabilities.events[]` lists short-names the module emits — e.g. `["UserCreated", "UserUpdated", "UserDeleted", "SessionCreated", "SessionRevoked"]`.

```protobuf
syntax = "proto3";
package rntme.contracts.identity.v1;

import "google/protobuf/timestamp.proto";
import "rntme/contracts/identity/v1/identity.proto";

// ── User lifecycle ─────────────────────────────────────
message UserCreated {
  User user = 1;
  string trigger = 2;              // "self_registration" | "invitation_accepted" | "sso_jit" | "scim_provisioned" | "admin_created"
  string invitation_id = 3;        // set when trigger = invitation_accepted
  string sso_connection_id = 4;    // set when trigger = sso_jit
}

message UserUpdated {
  User user = 1;
  repeated string changed_fields = 2;
  User previous = 3;
}

message UserDeleted {
  string canonical_id = 1;
  string vendor_id = 2;
  bool hard_delete = 3;
  google.protobuf.Timestamp deleted_at = 4;
}

message UserEmailVerified {
  string canonical_id = 1;
  string email = 2;
  google.protobuf.Timestamp verified_at = 3;
}

// ── Organization lifecycle ─────────────────────────────
message OrganizationCreated {
  Organization organization = 1;
  string creator_user_id = 2;        // canonical_id
}

message OrganizationUpdated {
  Organization organization = 1;
  repeated string changed_fields = 2;
  Organization previous = 3;
}

message OrganizationDeleted {
  string canonical_id = 1;
  string vendor_id = 2;
  bool hard_delete = 3;
  google.protobuf.Timestamp deleted_at = 4;
}

// ── Membership lifecycle ───────────────────────────────
message MembershipCreated {
  OrganizationMembership membership = 1;
  string trigger = 2;                // "invitation_accepted" | "admin_added" | "sso_jit" | "domain_auto_join"
  string invitation_id = 3;
}

message MembershipUpdated {
  OrganizationMembership membership = 1;
  repeated string changed_fields = 2;
  OrganizationMembership previous = 3;
}

message MembershipDeleted {
  string canonical_id = 1;
  string user_id = 2;
  string organization_id = 3;
  string reason = 4;
  google.protobuf.Timestamp deleted_at = 5;
}

// ── Invitation lifecycle ───────────────────────────────
message InvitationCreated {
  Invitation invitation = 1;
  string trigger = 2;                // "admin_invited" | "bulk_invite" | "api"
}

message InvitationAccepted {
  Invitation invitation = 1;
  string accepted_by_user_id = 2;
  string created_membership_id = 3;
}

message InvitationRevoked {
  Invitation invitation = 1;
  string revoked_by_user_id = 2;
  google.protobuf.Timestamp revoked_at = 3;
}

message InvitationExpired {
  Invitation invitation = 1;
  google.protobuf.Timestamp expired_at = 2;
}

// ── Session lifecycle ──────────────────────────────────
message SessionCreated {
  Session session = 1;
  string trigger = 2;                // "password_login" | "sso_login" | "magic_link" | "webauthn" | "impersonation"
}

message SessionEnded {
  string session_id = 1;
  string canonical_id = 2;
  string user_id = 3;
  string trigger = 4;                // "user_logout" | "timeout"
  google.protobuf.Timestamp ended_at = 5;
}

message SessionRevoked {
  string session_id = 1;
  string canonical_id = 2;
  string user_id = 3;
  string revoked_by = 4;             // canonical_id or "system"
  string reason = 5;                 // "admin_action" | "security" | "user_action"
  google.protobuf.Timestamp revoked_at = 6;
}
```

What was dropped from the reference review and why:

| Reference review | Decision | Reason |
|---|---|---|
| `MembershipRoleChangedEvent` | folded into `MembershipUpdated` (`changed_fields = ["roles"]`) | Duplicate; consumers inspect `changed_fields`. |
| `RoleAssignedEvent` / `RoleRevokedEvent` | dropped | Q3: `RoleAssignment` is not an aggregate. Role changes surface through `MembershipUpdated`. |
| `UserSuspendedEvent` | folded into `UserUpdated` (status transition with `changed_fields = ["status"]`) | Not a separate event — it is a status change. Reason rides in `vendor_raw` or in a future `audit` category. |
| `ImpersonationStartedEvent` / `ImpersonationEndedEvent` | dropped | Q3: Impersonate is not in v1 (Clerk-only). Vendors that do impersonate emit `SessionCreated` with `trigger = "impersonation"` and `Session.is_impersonated`-equivalent state in `vendor_raw`. |

## 9. Conformance suite

### 9.1 Layout and authorship

`modules/identity/conformance/` is a workspace package `@rntme/conformance-identity`. Per modules-monorepo §7.1 it consumes the shared `@rntme/conformance-framework` (runner, invariants, reporter — generic and category-agnostic) and supplies Identity-specific scenarios and fixtures. rntme-team writes both layers; modules-monorepo §7.2 mandates that any PR changing `packages/contracts/identity/v1/` lands matching scenario changes in `modules/identity/conformance/scenarios/` in the same PR.

### 9.2 Per-RPC scenarios

One file per canonical RPC. Twenty-four files for v1. Each file exports an array of `Scenario` from `@rntme/conformance-framework`. A scenario consists of:

1. **Pre-condition seed** — what entities must exist at the vendor before the scenario runs. The generic mock-vendor receives this seed; live mode pre-creates via the vendor's own API.
2. **Action** — a single canonical RPC call against the module under test.
3. **Assertions**, in this exact order:
   - response shape matches canonical proto (no extra fields, no missing required scope);
   - replay with the same `idempotency_key` returns the same logical result without producing a duplicate event;
   - negative branches return the expected error code from `error-codes.json`;
   - for command RPCs, the expected CloudEvents `type` is published on the matching topic within a 5-second window.

### 9.3 Anti-conformance

Per modules-monorepo §7.3, the runner unconditionally checks that any RPC *not* declared in `module.json#capabilities.rpcs[]` returns gRPC `UNIMPLEMENTED`. Random domain errors fail anti-conformance. This is the only structural enforcement; capability-claim coverage itself is left to the blueprint validator (modules-monorepo §6.2).

### 9.4 Capability-coverage report

Per modules-monorepo §7.4, the runner emits a report shaped like:

```
identity / clerk            (claims 18 / 24 canonical RPCs)
  GetUser                                      ✓
  ListUsers                                    ✓
  CreateUser                                   ✓
  UpdateUser                                   ✓
  DeleteUser                                   ✓
  AddMembership                                ✓
  IntrospectSession                            ✓
  RevokeSession                                ✓
  ResolveIdentity                              ✓
  ListSessions                                 unsupported (declared)
  …
```

This is the artefact a domain-blueprint author or LLM agent reads when picking a vendor for the Identity category.

### 9.5 Mock-vendor

Modules-monorepo OQ4 ("per-category mock-vendor or generic") is closed in this spec **in favour of generic**. The generic mock-vendor lives in `@rntme/conformance-framework` and is driven by canonical proto plus scenario fixtures: it records inputs and replays fixed outputs. `@rntme/conformance-identity` supplies fixtures and assertions only — it does not ship its own mock-vendor implementation.

## 10. Governance

Per modules-monorepo §6.3, additions to `identity/v1/` minor versions require either:

- **(a)** at least two real or planned vendor modules supporting a semantically equivalent operation, **or**
- **(b)** maintainer review confirming an *archetypal* operation for the category.

This spec explicitly records that the surface dropped in Q3 — `Impersonate`, `AssignRole` / `RevokeRole`, MFA-policy hierarchy, `RoleAssignment` as a separate aggregate — does **not** automatically enter v1.x when a single vendor lands. Each lives in `<vendor>-extensions.proto` in the relevant module. Promotion to canonical waits for a second vendor or an explicit archetypal review.

Breaking changes to existing v1 RPCs, signature changes, or removals require a new major (`identity/v2/`). The two majors coexist in the workspace; modules pin one.

## 11. Dependencies and merge order

Identity v1 **assumes** infrastructure introduced by modules-monorepo plan 1 (`@rntme/contracts-*` umbrella, `@rntme/conformance-framework`, `module-manifest-validator`), but **does not block** on it. The proto files and TS bindings can land in `packages/contracts/identity/v1/` and `packages/contracts/_common/v1/` and pass `tsc` independently. Conformance scenarios commit as stubs and get filled in alongside the framework.

Implementation order (covered in the implementation plan):
1. `packages/contracts/_common/v1/` — proto, generated bindings, workspace package, README. Verify `tsc`, `lint`, `test` pass with empty test set.
2. `packages/contracts/identity/v1/` — proto (`identity.proto` + `identity-events.proto`), generated bindings, `error-codes.json`, README.
3. `modules/identity/README.md` — category README per modules-monorepo §5.1 contributor entry-point convention.
4. `modules/identity/conformance/` — package skeleton: `suite.ts`, `fixtures/` (seed users/orgs/invitations), 24 scenario stubs (one per RPC). Each stub is a placeholder that fails with `not_implemented` until the framework lands; this preserves the "scenario-per-RPC" invariant from modules-monorepo §7.2 even before runners exist.
5. **Documentation-touch task** (per CLAUDE.md "every plan must include a documentation-touch task"):
   - `AGENTS.md` §3 (layering): add `packages/contracts/_common/v1/`, `packages/contracts/identity/v1/`, `modules/identity/conformance/` to the layer map.
   - `AGENTS.md` §10 (glossary): entries for **canonical contract**, **category package**, **shared common package**, **capability claim**, **vendor extensions proto**, **conformance scenarios**.
   - `README.md` packages-table: list the three new workspace packages.
   - Per-package READMEs follow the standard template (File map / Quick start / API / Invariants & gotchas / Out of scope / Where to look first / Specs).

## 12. Decomposition into implementation plans

This spec decomposes into **2 implementation plans** in `docs/superpowers/plans/done/identity-canonical-contract/`:

| # | Plan | Covers | Depends on |
|---|---|---|---|
| 1 | `01-common-and-identity-contracts.md` | Create `packages/contracts/_common/v1/`; create `packages/contracts/identity/v1/`; `protobufjs-cli` static-module codegen wiring (closes OQ-IDV1-1); `error-codes.json`; per-package READMEs; extend `pnpm-workspace.yaml`; documentation-touch (AGENTS.md §3 / §10 / main README packages-table) | — |
| 2 | `02-identity-conformance-skeleton.md` | Create `modules/identity/README.md`; create `modules/identity/conformance/` package; one scenario stub per RPC (24 files); fixtures stub; suite.ts wired against `@rntme/conformance-framework` interface (with framework-side stub if framework not yet landed); documentation-touch for new module-tree entries | Plan 1 |

The first vendor module and the Identity module skeleton are NOT covered by these plans. **Recommended first vendor: Clerk**, because it best validates the canonical metadata triad (`public` / `private` / `unsafe`) and the user/org/session abstraction without prematurely narrowing the category contract around WorkOS metadata/session limitations.

## 13. Testing model

- **Unit tests for `_common/v1/`**: `protobufjs-cli` generated binding round-trip for each shared message (`CanonicalRef`, `CommandContext`, `Name`, `ListRequest`, `Filter`, `Sort`, `ListResponseMeta`, `Metadata`).
- **Unit tests for `identity/v1/`**: `protobufjs-cli` generated binding round-trip for each entity, each enum value, each event payload. Verify that every RPC short-name in `service IdentityModule` matches the file naming in `modules/identity/conformance/scenarios/` (catches drift between proto and conformance layout in the same PR).
- **Lint test for `error-codes.json`**: every code matches `IDENTITY_(STRUCTURAL|REFERENCES|CONSISTENCY|VENDOR)_[A-Z_]+`.
- **Conformance scenario stubs**: each of the 24 scenario files compiles and exports a non-empty `Scenario[]` (even if every scenario currently throws `not_implemented`). This guarantees the structural invariant from modules-monorepo §7.2 holds before the framework is fully wired.
- **No vendor SDK touches.** The first integration test that actually calls Clerk / Auth0 / WorkOS lands with the first vendor-module spec, not here.

## 14. Out of scope / future brainstorms

Direct continuations of this design that deserve their own specs, in priority order:

1. **Identity module skeleton + developer task template** — the contributor-facing artefact. Next brainstorm; depends on this spec.
2. **First vendor implementation** (recommended: Clerk). Depends on (1).
3. **Audit category** (`packages/contracts/audit/v1/`) — first-class canonical audit-event stream, separate from category-business events. Identity v1 does not emit audit events.
4. **Directory-sync category** — SCIM v2 inbound endpoints, dsync events. Closes ADR-005 from the reference review at category, not Identity, level.
5. **Impersonation pattern** — only if multiple vendors prove archetypal. Until then lives in `<vendor>-extensions.proto`.

## 15. Resolved follow-up questions

These questions were raised as non-blocking in the first draft and are now closed before the first vendor module lands.

- **OQ-IDV1-1 — proto/codegen library.** Canonical contract packages use **`protobufjs-cli` static-module generation** (`pbjs` + `pbts`) and commit generated JS/DTS artifacts. `.proto` files remain the source of truth. Runtime gRPC continues to use `@grpc/grpc-js` / `@grpc/proto-loader` where dynamic service loading is needed. Buf is deferred to contract-governance tooling (`buf lint` / `buf breaking`) rather than used as the initial TypeScript runtime/codegen path. `ts-proto` is not adopted for v1 to avoid splitting the repo across two protobuf representations.
- **OQ-IDV1-2 — `unsafe_metadata` on flat-attribute vendors.** Adapters **emulate the three-level metadata model via documented namespace mapping** rather than dropping `unsafe` from the canonical contract. Examples: Auth0 maps `unsafe` to `user_metadata.rntme_unsafe_*`, `private` to `app_metadata.rntme_private_*`, and `public` to `app_metadata.rntme_public_*` plus optional custom-claim exposure. Keycloak maps levels through user-profile attributes and permissions: public = user/client view + admin edit, private = admin view/edit, unsafe = user view/edit. WorkOS-style constrained metadata is treated as limited vendor support, not a reason to narrow the canonical model. Conformance should assert namespace round-trip for the three levels where the module claims metadata support.
- **OQ-IDV1-3 — `IntrospectSession` input shape.** `IntrospectSession` stays **token-only**. Lookup by canonical session id remains `GetSession(canonical_id)`. This keeps the hot-path credential validation operation separate from projection/admin reads: `IntrospectSession(token)` validates raw upstream credentials and normalises them into `Session`; `GetSession(canonical_id)` reads a known canonical session. Mixing both into one RPC would duplicate the existing `GetSession` surface and blur live-auth vs read-model semantics.

## 16. References

- `docs/superpowers/specs/2026-04-26-modules-monorepo-structure-design.md` — directory layout, capability-based UNION conformance model, governance rule, `module.json` schema, conformance framework split.
- `docs/superpowers/specs/done/2026-04-19-platform-modules-integration-design.md` — module pattern (wrapper, no choreography), gRPC surface, webhook receiver, P-1/P-2/P-3 primitives.
- `docs/superpowers/specs/done/2026-04-17-cloudevents-envelope-design.md` — envelope and `type` namespacing convention.
- `CLAUDE.md` — error-code format, single-writer event log, Result<T> rule, branded `Validated*` types, doc-touch obligation.
- `AGENTS.md` — repository layout (§3), how-to recipes (§6), glossary (§10) — all need updates per plan 1.
- `.tmp/identity_canonical_api.agent.final.md` — vendor research used as input. Not committed; consulted for entity convergence, event tier classification, and ADR archaeology.
