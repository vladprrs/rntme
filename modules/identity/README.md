# Identity category — module contributor entry point

This directory hosts vendor implementations of the Identity canonical contract `@rntme/contracts-identity-v1`. Each vendor lives at `modules/identity/<vendor>/` and ships:

- A handler implementation against the `IdentityModule` gRPC service.
- A webhook receiver that verifies signatures, dedupes, and emits canonical CloudEvents.
- A `module.json` manifest declaring `capabilities[]`.
- Conformance scenarios passing under both mock-vendor and live-sandbox modes.

The shared conformance suite lives at `modules/identity/conformance/` and is consumed by every vendor module via `pnpm test:conformance:mock` and `pnpm test:conformance:live`.

## Canonical contract

Vendor modules implement `@rntme/contracts-identity-v1`. The contract is the source of truth for:

- The `service IdentityModule` gRPC surface (24 RPCs).
- The seventeen canonical CloudEvents payloads.
- The `IDENTITY_<LAYER>_<KIND>` error-code catalogue.
- The three-level metadata model and status enums.

Read the contract's README first: [`packages/contracts/identity/v1/README.md`](../../packages/contracts/identity/v1/README.md). Then read the contract spec: [`docs/superpowers/specs/done/2026-04-26-identity-canonical-contract-design.md`](../../docs/superpowers/specs/done/2026-04-26-identity-canonical-contract-design.md).

## Capability claims

A module declares which canonical RPCs and events it supports via `module.json#capabilities[]`. The runtime blueprint validator checks that every domain blueprint's used RPC/event subset is covered by the module's claims; missing coverage rejects the blueprint with `BLUEPRINT_CAPABILITY_MISSING`.

A recommended Tier-1 baseline (not enforced — capabilities are UNION) is:

- RPCs: `GetUser`, `ListUsers`, `CreateUser`, `UpdateUser`, `DeleteUser`, `IntrospectSession`, `RevokeSession`, `ResolveIdentity`.
- Events: `UserCreated`, `UserUpdated`, `UserDeleted`, `SessionCreated`, `SessionRevoked`.

Modules below this baseline are technically valid but rarely useful in practice. Module authors are expected to be explicit about why they fall short, in the module's README.

## Vendors

- [`auth0/`](./auth0) — Auth0 Management API backed Identity module. It supports users, organizations, organization memberships, organization invitations, and best-effort log/event translation. Canonical session RPCs are intentionally unclaimed because Auth0 session/token semantics differ from the canonical contract.

## Where to look first

- Canonical contract: [`packages/contracts/identity/v1/`](../../packages/contracts/identity/v1).
- Conformance suite: [`./conformance/`](./conformance).
- Modules-monorepo spec: [`docs/superpowers/specs/2026-04-26-modules-monorepo-structure-design.md`](../../docs/superpowers/specs/2026-04-26-modules-monorepo-structure-design.md) §7 covers the conformance framework split.
- Module pattern (wrapper, no choreography): [`docs/superpowers/specs/done/2026-04-19-platform-modules-integration-design.md`](../../docs/superpowers/specs/done/2026-04-19-platform-modules-integration-design.md).
