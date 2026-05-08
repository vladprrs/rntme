> Status: autonomous-spec.
> Date: 2026-05-08.
> Current source: Multica issue RNT-500, audit U-039 / RNT-199#1, `docs/decision-system.md`, current bindings owner docs, and code/tests on `origin/main` at `dc86ddf8`.
> Why retained: SPEC rationale for making the `generateOpenApi` public contract match the already-resolved `ValidatedBindings` data; verify current truth against code/tests before implementation.

# RNT-500 OpenAPI BindingResolvers parameter - design

## Problem

`@rntme/bindings` exposes `generateOpenApi(validated, _resolvers, options)`.
The `_resolvers: BindingResolvers` parameter is intentionally named as unused,
and the emitter reads only `validated.resolved`.

That is misleading at a contract boundary. A caller can reasonably infer that
OpenAPI emission re-resolves graph signatures or output shapes, but it does
not. The references validator has already resolved every binding into:

```ts
type ResolvedBinding = {
  entry: BindingEntry;
  signature: GraphSignature;
  outputShape: ResolvedShape;
};
```

Keeping an unused resolver argument makes it unclear whether emitted docs
reflect the validated graph/input/output truth or some binding-local state.

## Goals

- Make the public `generateOpenApi` signature describe the actual contract:
  emission consumes `ValidatedBindings` and optional OpenAPI generation options.
- Preserve the current OpenAPI output for already-valid bindings.
- Keep graph and shape resolution in `validateBindings`; do not repeat resolver
  lookups during emission.
- Update all in-repo callers, golden tests, examples, and current docs to the
  chosen signature.
- Add a TypeScript guard so future unused parameters in the bindings package are
  caught by package build/typecheck gates.

## Non-goals

- No OpenAPI schema redesign.
- No new resolver behavior or graph parsing inside the emitter.
- No compatibility overload or deprecated three-argument shim; the repo is
  pre-stable and public API cleanup is the point of this issue.
- No decision-system edit.

## Current Context

- `packages/artifacts/bindings/src/openapi/emit.ts` imports
  `BindingResolvers` only for the unused `_resolvers` parameter.
- `buildOperation` reads `binding.signature` and `binding.outputShape` from the
  `ResolvedBinding` already stored on `ValidatedBindings`.
- `docs/current/guides/bindings-examples.md` explicitly documents that
  `generateOpenApi` reads only the already-resolved structure, performs no
  repeated lookups, and leaves ontology work to the references layer.
- Public docs still show `generateOpenApi(validated.value, resolvers)` in the
  bindings owner quick start and authoring/example guides.
- Runtime loading currently builds `bindingResolvers`, passes them to
  `validateBindings`, and then passes the same object again to
  `generateOpenApi`.
- Golden tests and unit tests pass resolver fixtures to the emitter even though
  those fixtures are not read during emission.

## Decision-System Fit

- **G4 / F3 Contract-boundary check:** OpenAPI generation should consume the
  resolved contract produced by validation. Re-resolving through host callbacks
  during emission would make the contract boundary less clear.
- **G5 / F2 Canonical-way check:** validation is the canonical place for graph
  and shape resolution. The emitter should not expose a second resolution
  path.
- **G2 / F5 LLM-authorability:** a smaller, truthful signature makes generated
  code easier to call correctly and makes TypeScript feedback actionable.
- **F8 Leverage existing standards/libraries:** keep emitting OpenAPI 3.1 from
  structured TypeScript data; no custom resolver protocol is needed in the
  emitter.
- **G6 / F7 Pre-stable bias:** removing a misleading public parameter is an
  acceptable breaking change before design partners.

Applicable locked bets: **HTTP entry through `@rntme/bindings-http`**,
**JSON-only authoring**, **4-layer validation: parse -> structural ->
references -> consistency**, **`Result<T>` everywhere**, **Layering enforced by
dependency-cruiser**, and **No backwards-compatibility shims**. This spec does
not contradict any Goal, Filter, or locked bet and does not require a
decision-system update.

## Proposed Design

### 1. Remove the resolver parameter from `generateOpenApi`

Change the public function to:

```ts
export function generateOpenApi(
  validated: ValidatedBindings,
  options: OpenApiGenOptions = {},
): Result<OpenApiDoc>
```

Remove the `BindingResolvers` import from `src/openapi/emit.ts`. The internal
implementation stays the same: iterate `validated.resolved`, build operations
from each `ResolvedBinding`, and emit component schemas from
`binding.outputShape`.

This keeps the one source of truth explicit:

```text
parseBindingArtifact -> validateBindings(..., resolvers) -> ValidatedBindings
ValidatedBindings -> generateOpenApi(..., options) -> OpenAPI 3.1
```

### 2. Update callers and tests to the two-argument contract

Update all in-repo `generateOpenApi` call sites:

- no options: `generateOpenApi(validatedBindings)`;
- with options: `generateOpenApi(validatedBindings, { ... })`.

Expected touch points include:

- `packages/runtime/runtime/src/load/load-service.ts`;
- `packages/artifacts/bindings/demo-openapi.mjs`;
- `packages/artifacts/bindings/test/golden/**`;
- `packages/artifacts/bindings/test/unit/openapi/**`.

Keep resolver fixtures only where tests still need them for
`validateBindings`. Remove emitter-only dummy resolver fixtures that become
unused.

### 3. Add a package TypeScript unused-parameter guard

Enable `noUnusedParameters: true` for `@rntme/bindings`, preferably in
`packages/artifacts/bindings/tsconfig.json` so both `build` and
`tsconfig.check.json` inherit it.

The implementation must clean up any package-local source/test fallout rather
than prefixing new unused parameters with `_`. The goal is that a future
`generateOpenApi(validated, _resolvers, options)` style drift fails the normal
TypeScript gates.

Do not enable this repo-wide in the same PR unless the bindings package cannot
own the guard locally. A repo-wide compiler-policy change is a broader
convention decision and is outside RNT-500.

### 4. Update current docs and examples

Update current docs that show the public signature:

- `docs/current/owners/packages/artifacts/bindings.md`;
- `docs/current/guides/bindings-authoring.md`;
- `docs/current/guides/bindings-examples.md`.

The docs should say `BindingResolvers` are required by validation, not by
OpenAPI emission. Preserve the existing note that the emitter does not perform
repeated graph or shape lookups.

The local package README does not need a content change unless its short
command hint or current-doc link changes.

## Alternatives Rejected

- **Use `BindingResolvers` during OpenAPI emission.** Rejected because the
  validated object already contains the resolved signature and output shape.
  Re-resolving would introduce a second source of truth and could emit docs
  that differ from the artifact that actually passed validation.
- **Keep the unused parameter and rely on `_resolvers` naming.** Rejected
  because it preserves the misleading public API and does not satisfy the audit
  finding.
- **Add an overload accepting both old and new signatures.** Rejected under G6
  and the locked conditional "No backwards-compatibility shims" bet. The
  pre-stable repo should remove the ambiguous API directly.
- **Only enable `noUnusedParameters` without changing the API.** Rejected
  because the contract would remain misleading, and the existing `_resolvers`
  parameter is already known to be unused.

## Docs Touch

Implementation should update:

- `docs/current/owners/packages/artifacts/bindings.md` for public API
  signature and quick-start usage.
- `docs/current/guides/bindings-authoring.md` for the pipeline signature.
- `docs/current/guides/bindings-examples.md` for example calls and the
  explanation of validation-owned resolution.

No `docs/decision-system.md` update is needed because the design follows
existing Goals/Filters/Bets.

## Validation and Evidence

Required regression checks:

- Unit/golden OpenAPI tests still pass and golden files are unchanged unless
  the implementation reveals intentional doc-output drift.
- Runtime service loading still produces an OpenAPI document after validating
  bindings.
- A stale call such as `generateOpenApi(validated, resolvers)` fails TypeScript
  once the signature changes.
- A newly added unused parameter in bindings source fails the package
  TypeScript gate through `noUnusedParameters`.

Suggested gates:

- `pnpm -F @rntme/bindings test`
- `pnpm -F @rntme/bindings build`
- `pnpm -F @rntme/runtime build` or the narrow affected runtime test if build
  time is too high
- `git diff --check`

SPEC evidence:

- Reviewed `docs/decision-system.md`,
  `docs/current/owners/packages/artifacts/bindings.md`,
  `docs/current/guides/bindings-examples.md`,
  `packages/artifacts/bindings/src/openapi/emit.ts`,
  `packages/artifacts/bindings/src/types/artifact.ts`,
  `packages/artifacts/bindings/src/types/resolvers.ts`,
  `packages/runtime/runtime/src/load/load-service.ts`, and current bindings
  tests/golden fixtures.
- Confirmed the emitter reads `ValidatedBindings.resolved` and does not call
  either `resolveGraphSignature` or `resolveShape`.
- Confirmed docs and callers currently pass resolvers to `generateOpenApi`.

## Risks

- The signature change is breaking for any out-of-repo caller. That is
  acceptable under G6/F7 and should be handled by updating docs/examples, not
  by adding an overload.
- Enabling `noUnusedParameters` may expose unrelated unused parameters inside
  `@rntme/bindings`. Keep cleanup scoped to that package and avoid a repo-wide
  compiler policy change in this PR.
- TypeScript structurally rejects most stale calls because `BindingResolvers`
  has no properties in common with `OpenApiGenOptions`, but tests should still
  include build/typecheck coverage rather than relying on runtime behavior.

## PLAN/DEV Handoff

Recommended implementation path:

1. Change `generateOpenApi` to `(validated, options?)` and remove the unused
   resolver import.
2. Update in-repo call sites, tests, demo, owner docs, and current guides.
3. Add `noUnusedParameters: true` in the bindings package TypeScript config and
   clean up package-local fallout.
4. Run the bindings test/build gates and one affected runtime gate.

Next stage can go directly to PLAN/DEV; there is no product-decision blocker.
