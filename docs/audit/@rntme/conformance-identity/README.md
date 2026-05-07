# Architecture audit — `@rntme/conformance-identity`

This document mirrors the read-only architecture audit posted on Multica so it can be reviewed offline and linked from the repo.

| | |
|---|---|
| **Multica issue** | `RNT-220` (`9af5a326-37f2-466d-b062-f0658e5d48e1`) |
| **Issue title** | Audit: package architecture — @rntme/conformance-identity |
| **Package / scope** | `@rntme/conformance-identity` |
| **Verdict (summary)** | architectural risk |
| **Audit comment id** | `bc059423-818b-4cc5-a198-1acfe859e57a` |
| **Audit comment date** | 2026-04-28 |

---

## Audit report

The sections below reproduce the audit comment body **verbatim** from Multica (formatting preserved).


## Architectural audit: @rntme/conformance-identity

**Verdict: architectural risk** - package structurally sound, but a critical mismatched standard contract was found between three conformance packages, which will block integration with `@rntme/conformance-framework`.

---

### 1. BLOCKER: The standard contract for conformance packages varies

**Evidence:**
- `modules/identity/conformance/src/types.ts:34-37` — `contractVersion: 'v1'` (camelCase), `scenariosByRpc: Readonly<Record<string, ReadonlyArray<Scenario>>>`
- `modules/crm/conformance/src/types.ts:59-62` — `contract_version: 'v1'` (snake_case), `scenarios: Record<string, Scenario[]>`
- `modules/ai-llm/conformance/src/types.ts:34-37` - matches identity

**Impact:** When `@rntme/conformance-framework` publishes a single `CategoryConformanceSuite`, the CRM package will not be able to import shared types without a breaking change. Three packages claim to be compatible with the same framework, but implement incompatible contracts.

**Recommendation:**
1. Select canonical shape (identity/ai-llm look more correct: camelCase + `scenariosByRpc` + `Readonly`)
2. Migrate the CRM in the same PR where the framework is landing, or create a separate sync-issue
3. Fix the canonical shape in `docs/superpowers/specs/2026-04-26-modules-monorepo-structure-design.md` §7.1 explicitly, with a typical TypeScript signature

---

### 2. HIGH: Missing fixtures-sanity.test.ts

**Evidence:**
- CRM: `modules/crm/conformance/test/fixtures-sanity.test.ts` (checks JSON/webhook fixtures)
- AI-LLM: `modules/ai-llm/conformance/test/fixtures-sanity.test.ts` (checks binary fixtures for magic bytes + size ≤100KB)
- Identity: the `test/` directory contains only `drift.test.ts` and `suite-shape.test.ts`

**Impact:** Fixtures (User, Organization, Invitation) are created via `proto.rntme.contracts.identity.v1.*.create()`, but there is no test that catches runtime protobuf validation errors (for example, missing required fields or type mismatches when updating a contract).

**Recommendation:** Add `test/fixtures-sanity.test.ts` with checks:
- Each fixture from `fixtures/users.ts`, `fixtures/organizations.ts`, `fixtures/invitations.ts` passes `User.verify()`, `Organization.verify()`, `Invitation.verify()`
- All `CanonicalRef` inside fixtures have `canonical_id`, `vendor_id`, `module_name`, `contract_version` filled in

---

### 3. HIGH: No Session fixtures

**Evidence:**
- `packages/contracts/identity/v1/proto/identity.proto` defines `message Session` + RPC `GetSession`, `ListSessions`, `RevokeSession`, `IntrospectSession`
- `modules/identity/conformance/src/fixtures/` contains only `users.ts`, `organizations.ts`, `invitations.ts`
- No `fixtures/sessions.ts`

**Impact:** When scripting for Session-RPC starts, the developer will be forced to create ad-hoc fixtures instead of using shared canonical seeds. This violates the "vendor-agnostic scenarios reference canonical fixtures only" invariant (README §Invariants).

**Recommendation:** Add `src/fixtures/sessions.ts` with 2-3 canonical Session objects (active, expired, revoked) in the same style as `fixtureUsers`.

---

### 4. MEDIUM: Inconsistent naming of suite export

**Evidence:**
- Identity: `export { identityConformanceSuite }` (`src/index.ts:1`)
- AI-LLM: `export { aiLlmConformanceSuite }` (`src/index.ts:1`)
- CRM: `export { suite }` (`src/index.ts:1`) — generic name

**Impact:** Consumers (vendor modules) use different naming conventions: `import { suite }` for CRM vs `import { identityConformanceSuite }` for Identity. This creates unnecessary cognitive load and complicates templating in documentation.

**Recommendation:** Rename CRM export to `crmConformanceSuite` for consistency. This is non-breaking for internal modules, because vendor modules do not exist yet.

---

### 5. MEDIUM: README does not contain an "Out of scope" section

**Evidence:**
- AI-LLM README (`modules/ai-llm/conformance/README.md:66-68`) explicitly declares: “Actual scenario implementations, live-vendor mode, and the framework runner itself — separate packages and plans.”
- Identity README does not have an equivalent section.

**Impact:** A new developer/agent may not understand the boundary between scaffolding and implementation, which will lead to scope creep on PR.

**Recommendation:** Add the “Out of scope” section to the Identity README, mirroring AI-LLM.

---

### 6. LOW: Capabilities.ts registry file is missing

**Evidence:**
- AI-LLM: `src/capabilities.ts` exports `AI_LLM_CANONICAL_RPCS`, `AI_LLM_CANONICAL_EVENTS`, `AI_LLM_CAPABILITY_FIELDS`, etc.
- Identity: there is no similar registry file. The RPC list is obtained only through `Object.keys(identityConformanceSuite.scenariosByRpc)` or `IdentityModule.prototype` reflection.

**Impact:** Vendor modules and blueprint validator do not have a typed source-of-truth for the list of canonical RPCs/events without runtime reflection.

**Recommendation:** Add `src/capabilities.ts` with:
- `IDENTITY_CANONICAL_RPCS: readonly string[]` (24 entries)
- `IDENTITY_CANONICAL_EVENTS: readonly string[]` (17 events from `identity-events.proto`)
- Optional: `IDENTITY_ERROR_CODE_LAYERS`, `IDENTITY_ENTITY_TYPES`

---

### 7. LOW: No test coverage of error codes and events

**Evidence:**
- `test/drift.test.ts` only checks RPC ↔ file ↔ suite mapping (3 tests)
- `test/suite-shape.test.ts` checks category, version, array length (3 tests)
- 6 tests in total, all structural, none semantic

**Impact:** No automated guard against accidental deletion/renaming of error code or event in a contract without updating the conformance package.

**Recommendation:**
- Add a test: “every error code from `error-codes.json` is mentioned in at least one scenario stub” (or create a placeholder-assertion)
- Add test: “each event from `identity-events.proto` has at least one referencing scenario”
- Until real scenarios appear, structural checks (presence of keys) are enough to ensure modules-monorepo §7.2

---

### 8. LOW: package.json#version = "0.0.0"

**Evidence:**
- All three conformance packages have `"version": "0.0.0"`
- These are workspace-private packages (`"private": true`), but the version is used in fixture-data (`module_version: '0.0.0'`)

**Impact:** When updating the contract version (v1 → v2), the fixture metadata will become out of date imperceptibly.

**Recommendation:** Either synchronize `package.json#version` with `contractVersion` (e.g. `"version": "1.0.0"`), or use `${contractVersion}.0.0` pattern in fixtures. Not critical, but reduces confusion.

---

### Quick wins (can be done without an architectural solution)

1. Add `test/fixtures-sanity.test.ts` with `.verify()` on each fixture
2. Add `src/fixtures/sessions.ts` (2-3 objects)
3. Add an “Out of scope” section to the README
4. Add `src/capabilities.ts` with RPC/event list constants

### Requires Vlad's decision/architectural discussion

1. **BLOCKER**: Single canonical `CategoryConformanceSuite` shape - you need to choose between identity/ai-llm and CRM options and fix it in spec
2. **Naming convention**: Rename CRM `suite` → `crmConformanceSuite`?
3. **Versioning strategy**: How to version conformance packages relative to contract versions?

---

### Compliance with product vision and specs

- ✅ The structure of `modules/<category>/conformance/` corresponds to modules-monorepo §7.1
- ✅ 24 scenario files cover all 24 RPCs from `IdentityModule`
- ✅ Drift test implements invariant modules-monorepo §7.2
- ⚠️ The standard contract is not explicitly stated in the spec (§7.1 describes the layout, but not the TypeScript interface)
- ⚠️ No enforcement for “every error code and event is covered by a script” (§9.2 requires assertions on negative branches and CloudEvents, but stubs do not contain them - this is expected, but not documented as temporary)

### Definition of done for this audit

- [x] Full overview of the public API, internal boundaries, dependencies, types, build/test setup
- [x] Comparison with sibling packages (CRM, AI-LLM)
- [x] Checking alignment with `docs/superpowers/specs/done/2026-04-26-identity-canonical-contract-design.md` §9 and `docs/superpowers/specs/2026-04-26-modules-monorepo-structure-design.md` §7
- [x] Specific recommendations with severity, evidence and impact

**Summary:** The package is structurally sound and fulfills its scaffolding role, but requires sync under the standard contract with the CRM package before `@rntme/conformance-framework` begins integration. Without this, CRM migration will be disruptive.
