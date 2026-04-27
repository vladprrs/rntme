# @rntme/conformance-identity

Per-RPC conformance scenarios for the Identity canonical contract `@rntme/contracts-identity-v1`. Every Identity-category vendor module (Clerk, Auth0, WorkOS, …) imports this package and runs the suite under both mock-vendor and live-sandbox modes.

## File map

- `src/types.ts` — local stub of `Scenario` and `CategoryConformanceSuite`. Replace with import from `@rntme/conformance-framework` once it lands.
- `src/fixtures/{users,organizations,invitations}.ts` — canonical seed objects (proto-shaped) referenced from scenarios.
- `src/scenarios/<RPC>.scenarios.ts` × 24 — one file per canonical RPC. All currently empty stubs; fill alongside the framework wiring.
- `src/suite.ts` — assembled `CategoryConformanceSuite`.
- `src/index.ts` — barrel.
- `test/drift.test.ts` — drift detection: contract RPCs ↔ scenarios files ↔ suite keys.
- `test/suite-shape.test.ts` — basic suite invariants.

## Quick start

```ts
import { identityConformanceSuite } from '@rntme/conformance-identity';

console.log(identityConformanceSuite.category); // 'identity'
console.log(identityConformanceSuite.contractVersion); // 'v1'
console.log(Object.keys(identityConformanceSuite.scenariosByRpc).length); // 24
```

## What scenarios cover (when filled)

Each scenario asserts, in this order:

1. Response shape matches canonical proto (no extra fields, no missing required scope).
2. Replay with the same `idempotency_key` returns the same logical result without producing a duplicate event.
3. Negative branches return the expected error code from `error-codes.json`.
4. For command RPCs, the expected CloudEvents `type` is published on the matching topic within a 5-second window.

Plus the unconditional anti-conformance check (modules-monorepo §7.3): any RPC NOT in `module.json#capabilities.rpcs[]` must return gRPC `UNIMPLEMENTED`.

## Mock-vendor vs live-sandbox

- `pnpm test:conformance:mock` (vendor module, after framework lands) — runs every scenario against the generic mock-vendor in `@rntme/conformance-framework`. No secrets, runs on every PR.
- `pnpm test:conformance:live` — same suite, vendor sandbox credentials. Runs at release tag only.

Both filter scenarios by the module's `capabilities[]`.

## Invariants & gotchas

- **Drift test is mandatory CI.** Adding an RPC to `IdentityModule` without a matching `<RPC>.scenarios.ts` file fails `pnpm test`. This enforces modules-monorepo §7.2.
- **Scenarios are vendor-agnostic.** A scenario references canonical proto types and fixture seeds — never vendor-specific behavior. Vendor adapters in `modules/identity/<vendor>/test/conformance.test.ts` import this suite and feed it through the framework runner.
- **Stubs return empty `Scenario[]`.** Until `@rntme/conformance-framework` ships, the runner does not exist. Empty scenarios files preserve the structural invariant (one file per RPC) without committing to runtime semantics that may shift.

## Where to look first

- Spec: [`docs/superpowers/specs/2026-04-26-identity-canonical-contract-design.md`](../../../docs/superpowers/specs/2026-04-26-identity-canonical-contract-design.md) §9.
- Modules-monorepo conformance design: [`docs/superpowers/specs/2026-04-26-modules-monorepo-structure-design.md`](../../../docs/superpowers/specs/2026-04-26-modules-monorepo-structure-design.md) §7.
- Canonical contract this exercises: [`packages/contracts/identity/v1/`](../../../packages/contracts/identity/v1).

## Specs

- `docs/superpowers/specs/2026-04-26-identity-canonical-contract-design.md` (v1 contract).
- `docs/superpowers/specs/2026-04-26-modules-monorepo-structure-design.md` (umbrella conventions).
