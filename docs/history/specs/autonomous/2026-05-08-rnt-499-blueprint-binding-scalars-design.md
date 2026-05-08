> Status: autonomous-spec.
> Date: 2026-05-08.
> Current source: Multica issue RNT-499, audit U-049 / RNT-202#H2, `docs/decision-system.md`, current blueprint/bindings owner docs, and code/tests on `origin/main` at `dc86ddf8`.
> Why retained: SPEC rationale for making blueprint binding-resolver scalar validation use the bindings package scalar contract; verify current truth against code/tests before implementation.

# RNT-499 Blueprint binding scalars - design

## Problem

`@rntme/blueprint` composes service Graph IR signatures into
`@rntme/bindings` resolver contracts. The resolver type comes from bindings,
but blueprint validates scalar names with its own local literal set:

```ts
const SCALARS: ReadonlySet<ScalarPrimitive> = new Set([
  'integer',
  'decimal',
  'string',
  'boolean',
  'date',
  'datetime',
]);
```

That duplicates the binding scalar primitive contract at the package boundary.
If bindings adds, removes, or renames a scalar, blueprint can keep accepting the
old set or reject the new set even though the TypeScript import still suggests
it is using the binding contract.

## Goals

- Make blueprint scalar validation use a runtime source/helper exported by
  `@rntme/bindings`, not a blueprint-local literal set.
- Keep `@rntme/bindings` the authority for scalar primitives used in
  `BindingResolvers`, `FieldType`, `InputType`, `OutputType`, and OpenAPI
  emission.
- Prove with tests that blueprint accepts and rejects exactly the scalar set
  exported by bindings.
- Avoid circular dependencies and new broad coupling. Blueprint already depends
  on bindings; bindings must not start depending on blueprint or PDM for this
  issue.
- Keep the implementation small and package-local: public helper in bindings,
  consumer cleanup in blueprint, focused docs/tests.

## Non-goals

- No new scalar primitive in this issue.
- No redesign of PDM scalar primitives, Graph IR type strings, or OpenAPI
  encoding.
- No cross-package "global scalar registry" package unless a later audit proves
  multiple package contracts need one.
- No compatibility shim for the old blueprint-local scalar set. The project is
  pre-stable and the intended behavior is to follow bindings.
- No `docs/decision-system.md` edit.

## Current Context

- `docs/decision-system.md` defines **G4 Compose via canonical contracts; keep
  core lean** and **G5 Minimize entropy**.
- Applicable locked bets include **Leaf contracts**, **JSON-only authoring**,
  **4-layer validation**, **`Result<T>` everywhere**, **branded `Validated*`
  types only through validators**, and **Layering enforced by
  dependency-cruiser**.
- `docs/current/owners/packages/artifacts/bindings.md` documents bindings as
  the parser/validator/OpenAPI package for Graph IR operation bindings and
  exposes resolver types as the package boundary.
- `docs/current/owners/packages/artifacts/blueprint.md` documents
  `createServiceBindingResolvers(...)` as the bridge that builds bindings
  validators from service-local graphs and project service context.
- `packages/artifacts/bindings/src/types/resolvers.ts` defines
  `ScalarPrimitive` as the six primitives:
  `integer`, `decimal`, `string`, `boolean`, `date`, `datetime`.
- `packages/artifacts/bindings/src/index.ts` re-exports
  `ScalarPrimitive` only as a type; no runtime primitive list or type guard is
  available.
- `packages/artifacts/blueprint/src/compose/binding-resolvers.ts` imports the
  `ScalarPrimitive` type from bindings, but `parseScalar` gates on its own
  `SCALARS` set.
- `@rntme/blueprint` already has a direct dependency on `@rntme/bindings`.
  `@rntme/bindings` currently depends on artifact-shared, graph-ir-compiler,
  and zod, not blueprint or PDM.

## Decision-System Fit

- **G4 / F3 Contract-boundary check:** the scalar contract consumed by
  `BindingResolvers` belongs at the bindings boundary. Blueprint should consume
  that contract rather than mirror it.
- **G5 / F2 Canonical-way check:** one scalar primitive source prevents a
  second package-local way to decide what a binding scalar is.
- **G2 / F5 LLM-authorability:** a single exported helper gives agent-authored
  blueprint validation deterministic fail-fast behavior when scalar support
  changes.
- **F8 Leverage existing code:** this extends the existing bindings type module
  with a runtime constant/helper instead of adding a new package or hand-rolled
  registry.
- No contradiction with Goals, Filters, or locked Bets found.

## Proposed Design

### 1. Export bindings scalar runtime helpers

Add a runtime helper beside the bindings resolver types, for example in
`packages/artifacts/bindings/src/types/resolvers.ts`:

```ts
export const SCALAR_PRIMITIVES = [
  'integer',
  'decimal',
  'string',
  'boolean',
  'date',
  'datetime',
] as const;

export type ScalarPrimitive = (typeof SCALAR_PRIMITIVES)[number];

const scalarPrimitiveSet: ReadonlySet<string> = new Set(SCALAR_PRIMITIVES);

export function isScalarPrimitive(value: string): value is ScalarPrimitive {
  return scalarPrimitiveSet.has(value);
}
```

Re-export both `SCALAR_PRIMITIVES` and `isScalarPrimitive` from
`packages/artifacts/bindings/src/index.ts`. The exact helper name can vary, but
it should be a public runtime export from `@rntme/bindings`, not a test-only
fixture.

Keep the primitive list in one place by deriving `ScalarPrimitive` from the
constant. Do not maintain a separate union and array.

### 2. Remove the blueprint-local scalar set

In `packages/artifacts/blueprint/src/compose/binding-resolvers.ts`, import the
bindings helper as a value and rewrite `parseScalar`:

```ts
import { isScalarPrimitive, type ScalarPrimitive, ... } from '@rntme/bindings';

function parseScalar(raw: string): ScalarPrimitive | null {
  return isScalarPrimitive(raw) ? raw : null;
}
```

Delete the local `SCALARS` constant. `parseInputType`, `parseFieldType`, and
`parseOutputType` can keep their existing behavior and error mapping.

This preserves the existing package direction: blueprint imports bindings.
Bindings does not import blueprint, PDM, or any runtime package.

### 3. Add drift-focused tests

Bindings tests should cover the public helper:

- `SCALAR_PRIMITIVES` contains the expected current primitives in canonical
  order.
- `isScalarPrimitive` accepts every value in `SCALAR_PRIMITIVES`.
- `isScalarPrimitive` rejects a representative unsupported value such as
  `uuid` or `json`.

Blueprint tests should prove it delegates to bindings' public scalar source,
not an implicit local mirror:

- For every `SCALAR_PRIMITIVES` value, a service graph field/input type using
  that scalar can be converted by `createServiceBindingResolvers`.
- An unsupported scalar still fails with
  `BLUEPRINT_SERVICE_GRAPHS_INVALID`.

Prefer a focused unit test for `createServiceBindingResolvers` if adding one is
straightforward. Otherwise extend the existing service-member or graph tests
with a narrow fixture.

### 4. Docs touch

Update current owner docs only where the public contract becomes explicit:

- `docs/current/owners/packages/artifacts/bindings.md`: document
  `SCALAR_PRIMITIVES` / `isScalarPrimitive` as the public scalar primitive
  contract for binding resolver types and OpenAPI scalar encoding.
- `docs/current/owners/packages/artifacts/blueprint.md`: add a short note near
  `createServiceBindingResolvers(...)` that blueprint consumes bindings'
  scalar helper and should not define a separate scalar list.

No README stub change is expected because current-doc links and local command
hints do not change.

## Alternatives Rejected

- **Keep the local blueprint set and add comments.** Rejected because comments
  do not enforce the contract and leave the drift-prone duplicate in place.
- **Export only `SCALAR_PRIMITIVES` without a type guard.** Rejected because
  callers would keep rebuilding sets or casting strings locally. The helper
  should centralize the safe runtime check.
- **Move the scalar source to PDM.** Rejected for this issue. PDM fields
  currently use the same primitive names, but bindings must stay a lean
  artifact package and should not gain a PDM dependency for its resolver
  contract. If PDM and bindings scalar domains diverge later, bindings still
  owns the set accepted by `BindingResolvers`.
- **Create a new shared scalar package.** Rejected as too broad for one
  duplicate list. A new package would need a stronger cross-package contract
  reason than this blueprint-to-bindings drift.
- **Have blueprint import bindings' OpenAPI scalar mapper and infer support
  from a switch.** Rejected because OpenAPI encoding is not the scalar
  validation contract and would couple blueprint to an emitter detail.

## Validation and Evidence

Required DEV gates:

- `pnpm -F @rntme/bindings test`
- `pnpm -F @rntme/bindings build`
- `pnpm -F @rntme/blueprint test`
- `pnpm -F @rntme/blueprint build`
- `pnpm depcruise` if dependency declarations or package boundaries change
- `git diff --check`

SPEC evidence:

- Reviewed `AGENTS.md`, `docs/README.md`, `docs/decision-system.md`, current
  blueprint and bindings owner docs, local README stubs, audit U-049 entries,
  and current code/tests.
- Confirmed `@rntme/blueprint` already depends on `@rntme/bindings`.
- Confirmed the only current blueprint scalar validation list is the local
  `SCALARS` set in `binding-resolvers.ts`.
- Confirmed `@rntme/bindings` currently exports only the `ScalarPrimitive` type,
  not a runtime list or guard.

## Risks

- Adding value exports to `@rntme/bindings` changes the public barrel. Keep the
  names intentionally small and documented so future packages do not invent
  their own scalar helpers.
- Existing tests that import `ScalarPrimitive` as a normal import instead of
  `type` may need cleanup if lint/typecheck catches mixed value/type imports.
- A future scalar added to bindings must also update OpenAPI scalar emission.
  The helper removes blueprint drift, but it does not by itself validate every
  downstream scalar consumer.

## PLAN/DEV Handoff

Implementation should stay in the canonical workspace for RNT-499 and keep the
PR scoped to:

- `packages/artifacts/bindings/src/types/resolvers.ts`
- `packages/artifacts/bindings/src/index.ts`
- focused bindings tests under `packages/artifacts/bindings/test/**`
- `packages/artifacts/blueprint/src/compose/binding-resolvers.ts`
- focused blueprint tests under `packages/artifacts/blueprint/test/**`
- current owner docs for bindings and blueprint if the helper is made public

Recommended next stage: PLAN/DEV can implement directly from this spec. No
decision-system blocker is present.
