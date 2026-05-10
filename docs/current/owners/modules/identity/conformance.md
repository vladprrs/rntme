# @rntme/conformance-identity

Per-RPC conformance scenarios for the Identity canonical contract `@rntme/contracts-identity-v1`. Every Identity-category vendor module (Clerk, Auth0, WorkOS, …) imports this package and runs the suite under both mock-vendor and live-sandbox modes.

## File map

- `src/types.ts` — local stub of `Scenario` and `CategoryConformanceSuite`. Replace with import from `@rntme/conformance-framework` once it lands.
- `src/capabilities.ts` — canonical RPC/event/capability registries plus structural coverage placeholders for error codes and events.
- `src/fixtures/{users,organizations,invitations,sessions}.ts` — canonical seed objects (proto-shaped) referenced from scenarios.
- `src/fixtures/ref.ts` — shared fixture `CanonicalRef` factory and fixture module version.
- `src/scenarios/<RPC>.scenarios.ts` × 24 — one file per canonical RPC. All currently empty stubs; fill alongside the framework wiring.
- `src/suite.ts` — assembled `CategoryConformanceSuite`.
- `src/index.ts` — barrel.
- `test/drift.test.ts` — drift detection: contract RPCs ↔ scenarios files ↔ suite keys.
- `test/suite-shape.test.ts` — basic suite invariants.
- `test/fixtures-sanity.test.ts` — protobuf `.verify()` coverage for canonical fixtures and fixture metadata.
- `test/capabilities.test.ts` — registry and structural scenario-coverage guards for RPCs, events, and error codes.

## Quick start

```ts
import { identityConformanceSuite } from '@rntme/conformance-identity';

console.log(identityConformanceSuite.category); // 'identity'
console.log(identityConformanceSuite.contractVersion); // 'v1'
console.log(Object.keys(identityConformanceSuite.scenariosByRpc).length); // 24
```

Template-based consumers may also import the generic alias:

```ts
import { suite } from '@rntme/conformance-identity';

console.log(suite.scenariosByRpc.GetUser.length);
```

## What scenarios cover (when filled)

Each scenario asserts, in this order:

1. Response shape matches canonical proto (no extra fields, no missing required scope).
2. Replay with the same `idempotency_key` returns the same logical result without producing a duplicate event.
3. Negative branches return the expected error code from `error-codes.json`.
4. For command RPCs, the expected CloudEvents `type` is published on the matching topic within a 5-second window.

Plus the unconditional anti-conformance check (modules-monorepo §7.3): any RPC NOT in `module.json#capabilities.rpcs[]` must return gRPC `UNIMPLEMENTED`.

## Mock-vendor vs live-sandbox

- `bun test:conformance:mock` (vendor module, after framework lands) — runs every scenario against the generic mock-vendor in `@rntme/conformance-framework`. No secrets, runs on every PR.
- `bun test:conformance:live` — same suite, vendor sandbox credentials. Runs at release tag only.

Both filter scenarios by the module's `capabilities[]`.

## Invariants & gotchas

- **Drift test is mandatory CI.** Adding an RPC to `IdentityModule` without a matching `<RPC>.scenarios.ts` file fails `bun test`. This enforces modules-monorepo §7.2.
- **Suite shape is canonicalized as camelCase.** Identity exposes `contractVersion` and `scenariosByRpc`; `suite` is a non-breaking alias for template consumers, not a separate shape.
- **Capability registry is the typed source of truth.** `IDENTITY_CANONICAL_RPCS`, `IDENTITY_CANONICAL_EVENTS`, and `IDENTITY_SCENARIO_COVERAGE` must move together when the contract changes.
- **Scenarios are vendor-agnostic.** A scenario references canonical proto types and fixture seeds — never vendor-specific behavior. Vendor adapters in `modules/identity/<vendor>/test/conformance.test.ts` import this suite and feed it through the framework runner.
- **Stubs return empty `Scenario[]`.** Until `@rntme/conformance-framework` ships, the runner does not exist. Empty scenarios files preserve the structural invariant (one file per RPC) without committing to runtime semantics that may shift.

## Out of scope

- Actual scenario implementations beyond structural placeholders.
- Live-vendor mode and sandbox credential handling.
- The shared `@rntme/conformance-framework` runner and final cross-category type migration.
- Renaming or reshaping sibling category packages outside Identity.

## Where to look first

- Spec: [`docs/history/specs/historical/2026-04-26-identity-canonical-contract-design.md`](/docs/history/specs/historical/2026-04-26-identity-canonical-contract-design.md) §9.
- Modules-monorepo conformance design: [`docs/history/specs/active-rationale/2026-04-26-modules-monorepo-structure-design.md`](/docs/history/specs/active-rationale/2026-04-26-modules-monorepo-structure-design.md) §7.
- Canonical contract this exercises: [`packages/contracts/identity/v1/`](/docs/current/owners/packages/contracts/identity/v1.md).

## Specs

- `docs/history/specs/historical/2026-04-26-identity-canonical-contract-design.md` (v1 contract).
- `docs/history/specs/active-rationale/2026-04-26-modules-monorepo-structure-design.md` (umbrella conventions).
