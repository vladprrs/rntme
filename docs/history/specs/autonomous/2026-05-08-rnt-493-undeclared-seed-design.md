> Status: autonomous-spec.
> Date: 2026-05-08.
> Current source: Multica issue RNT-493, audit U-053 / RNT-202#M3, `docs/decision-system.md`, current blueprint owner docs, and code/tests on `origin/main` at `28ae720a`.
> Why retained: SPEC rationale for making service seed loading obey the discover-then-load artifact contract; verify current truth against code/tests before implementation.

# RNT-493 Undeclared seed loading - design

## Problem

`@rntme/blueprint` treats `discoverServiceArtifacts` as the service artifact
presence contract. The composed service member loader should then load only the
artifacts represented by that contract.

On `main`, `loadServiceMember` breaks that rule for seed:

```ts
if (input.service.artifacts.hasSeed || (await pathExists(seedAbsPath))) {
  ...
}
```

That opportunistic filesystem fallback means the same `CompositionService`
input can produce different output if `services/<svc>/seed/seed.json` appears
after discovery, if a test constructs `artifacts.hasSeed: false` manually, or
if a cached descriptor is replayed against a different directory. The behavior
is no longer determined by the discovered artifact set.

## Goals

- Make seed loading depend only on the explicit/discovered artifact contract:
  `input.service.artifacts.hasSeed`.
- Make an undeclared `services/<svc>/seed/seed.json` on disk deterministic by
  ignoring it when `hasSeed` is false.
- Preserve current behavior for valid discovered seed files: parse and validate
  through `@rntme/seed`, scoped to events owned by the service.
- Preserve current behavior when `hasSeed` is true but the file is missing,
  unreadable, malformed, or invalid: return structured blueprint errors rather
  than silently skipping it.
- Document the rule in the blueprint owner doc so future loaders do not
  reintroduce a second source of truth.
- Add regression coverage for the undeclared-on-disk case.

## Non-goals

- No seed artifact schema or `@rntme/seed` validation changes.
- No new `project.json` declaration syntax for seed.
- No runtime seed application changes.
- No broad cleanup of other optional artifact fallbacks. `storage.json` has a
  similar defensive existence check today, but this issue is scoped to audit
  U-053 and seed loading.
- No decision-system edit.

## Current Context

- `docs/decision-system.md` defines **G1 Blueprint = unit of truth** and
  **F6 Repeatability check**: identical blueprint inputs must produce identical
  running systems.
- Locked bets relevant here include **Blueprint folder =
  authoring/versioning/deploy unit**, **JSON-only authoring**, **4-layer
  validation**, **`Result<T>` everywhere**, **Error code format
  `<PKG>_<LAYER>_<KIND>`**, and **Seed as module (not part of core)**.
- `docs/current/owners/packages/artifacts/blueprint.md` lists
  `services/<svc>/seed/seed.json` as the service seed convention and exposes
  `discoverServiceArtifacts(...)` plus `loadServiceMember(...)` as public API.
- `discoverServiceArtifacts(rootDir, slug)` sets `hasSeed` only when
  `services/<slug>/seed/seed.json` is a file.
- `loadServiceMember` already uses `input.service.artifacts.hasBindings`,
  `hasGraphs`, and `hasSeed` to decide which optional service artifacts to
  load, but seed adds a second filesystem check.
- `packages/artifacts/blueprint/test/unit/load-service-member.test.ts` covers
  invalid discovered seed scope but does not cover a seed file present on disk
  while `hasSeed` is false.

## Decision-System Fit

- **G1 / F6 Repeatability:** the discovered service artifact contract becomes
  the single input that controls seed loading. A cached or explicit
  `CompositionService` cannot be changed by an incidental file on disk.
- **G2 / F5 LLM-authorability:** agents get a clear correction model: run
  discovery or set `hasSeed` truthfully; undeclared files do not produce hidden
  validation failures.
- **G4 / F1 Lean-core:** seed remains an optional service/module artifact, not
  a core behavior that blueprint discovers dynamically at every load step.
- **G5 / F2 Canonical-way:** `discoverServiceArtifacts` remains the canonical
  way to derive optional artifact presence. `loadServiceMember` no longer has a
  seed-specific second way.

Applicable locked bets: **Blueprint folder = authoring/versioning/deploy
unit**, **JSON-only authoring**, **4-layer validation**, **`Result<T>`
everywhere**, **Error code format `<PKG>_<LAYER>_<KIND>`**, and **Seed as
module (not part of core)**. This spec does not contradict any Goal, Filter, or
locked bet and does not require a decision-system update.

## Proposed Design

### 1. Remove opportunistic seed existence fallback

In `packages/artifacts/blueprint/src/compose/load-service-member.ts`, change
the seed branch to:

```ts
if (input.service.artifacts.hasSeed) {
  ...
}
```

Remove the seed-specific `pathExists(seedAbsPath)` check and any helper/import
that becomes unused. Keep `seedPath` and `seedAbsPath` for the declared seed
read path.

When `hasSeed` is false, `loadServiceMember` must not call `readFile` or
`loadSeed` for `services/<svc>/seed/seed.json`, even if that file exists on
disk. The returned `ValidatedServiceMember.seed` remains `null`.

### 2. Keep declared seed failures strict

If `hasSeed` is true, keep the current strict path:

- read `services/<svc>/seed/seed.json`;
- on filesystem failure, return `BLUEPRINT_IO_ERROR` with `path` set to the
  seed file path;
- call `loadSeed(seedBuffer, { pdm, events, serviceName })`;
- on validation failure, return `BLUEPRINT_SERVICE_SEED_INVALID` with the
  seed package errors in `cause`;
- on success, attach the `ValidatedSeed` to the service member.

This preserves fail-fast validation for discovered seed artifacts and avoids
making missing declared seed files silently optional.

### 3. Document artifact-presence ownership

Update `docs/current/owners/packages/artifacts/blueprint.md` near the directory
conventions or public API notes:

- `discoverServiceArtifacts` owns optional service artifact presence.
- `loadServiceMember` loads seed only when `service.artifacts.hasSeed` is true.
- If a `seed/seed.json` file appears after discovery or is present while
  `hasSeed` is false, the loader ignores it; callers that want it loaded must
  re-run discovery or pass an updated artifact presence object.

No local README change is expected because the current-doc target and command
hint do not change.

## Alternatives Rejected

- **Return a structured validation error for undeclared seed files.** Rejected
  as more invasive and less compatible. `loadServiceMember` receives an
  already-discovered `CompositionService`; detecting undeclared files there
  would reintroduce filesystem discovery as a second authority. Ignoring
  undeclared files keeps the contract deterministic.
- **Keep `hasSeed || existsSync/pathExists` and document filesystem as source
  of truth.** Rejected because it weakens the discover-then-load model and
  violates F6 for cached or manually constructed descriptors.
- **Add a new explicit seed declaration in `service.json` or `project.json`.**
  Rejected as unnecessary for this audit item. The current project-first
  convention already has a discovery contract for service artifacts.
- **Broaden the issue to all optional artifact fallbacks.** Rejected to keep
  this PR scoped to U-053. Similar patterns should be audited separately if
  they are promoted from parked findings.

## Docs Touch

Implementation should update:

- `docs/current/owners/packages/artifacts/blueprint.md`: document
  discover-owned optional artifact presence and the undeclared seed ignore
  rule.

No `docs/decision-system.md` update is needed because the design follows
existing Goals/Filters/Bets.

## Validation and Evidence

Required regression tests:

- A service with `artifacts.hasSeed: false` and an invalid
  `services/<svc>/seed/seed.json` file on disk returns `ok`, keeps
  `service.seed === null`, and does not emit `BLUEPRINT_SERVICE_SEED_INVALID`.
- A service with `artifacts.hasSeed: true` and a valid seed still loads a
  non-null `ValidatedSeed`.
- Existing invalid discovered seed tests continue to fail with
  `BLUEPRINT_SERVICE_SEED_INVALID`.

Suggested gates:

- `pnpm -F @rntme/blueprint test`
- `pnpm -F @rntme/blueprint build`
- `git diff --check`

SPEC evidence:

- Reviewed `docs/decision-system.md`, `docs/current/owners/packages/artifacts/blueprint.md`,
  audit U-053 entries, `discover-service-artifacts.ts`,
  `load-service-member.ts`, and current blueprint unit tests.
- Confirmed `discoverServiceArtifacts` derives `hasSeed` from the service seed
  file convention.
- Confirmed `loadServiceMember` currently bypasses that contract with a
  seed-specific `pathExists` fallback.

## Risks

- A caller that manually constructs `CompositionService` with `hasSeed: false`
  while relying on disk fallback will stop loading seed. That is the intended
  correction: callers must pass an accurate discovered artifact presence object.
- The implementation should avoid changing `storage.json` behavior in the same
  PR unless a separate accepted spec expands scope.
- If tests depend on opportunistic seed loading, update them to call
  `discoverServiceArtifacts` or set `hasSeed: true`; do not preserve the
  fallback for tests only.

## PLAN/DEV Handoff

Implementation should stay in the canonical workspace for RNT-493 and keep the
PR scoped to:

- `packages/artifacts/blueprint/src/compose/load-service-member.ts`
- `packages/artifacts/blueprint/test/unit/load-service-member.test.ts`
- `docs/current/owners/packages/artifacts/blueprint.md`

The recommended implementation is a small behavior change plus focused tests;
no product decision or Goal/Filter/Bet update is required.
