> Status: autonomous-spec.
> Date: 2026-05-08.
> Current source: Multica issue RNT-491, docs/current/**, docs/decision-system.md, current code/tests on main.
> Why retained: Handoff rationale for making `loadPdmDir` return only validated PDM from the directory loader; not current-state truth by itself.

# RNT-491 PDM directory load validation - design

## Problem

`@rntme/pdm` documents the safe PDM pipeline as `parsePdm -> validatePdm -> downstream consumers`, and downstream packages accept `ValidatedPdm` for runtime/blueprint work. The directory loader is the exception: `loadPdmDir` assembles `entities/*.json` and returns `parsePdm({ entities })`, so callers can receive a raw `PdmArtifact` that passed only Zod parsing.

That makes the directory layout a weaker authoring path than direct package validation. Structural and state-machine errors surface later, often through a caller-specific wrapper, instead of being tied to the package-owned load contract.

## Goals

- Make `loadPdmDir` return `Promise<Result<ValidatedPdm>>`.
- Preserve the explicit validation layers: parse-directory I/O/layout errors, PDM parse errors, structural validation errors, then state-machine validation errors.
- Keep all package boundaries on `Result<T>`; no thrown validation errors across package boundaries.
- Preserve codified PDM error codes with useful `path` and, for directory parse failures, a machine-readable `cause` where available.
- Remove downstream access to raw parsed PDM from the directory loader.
- Add regression coverage for a valid directory, invalid entity structure, malformed JSON, and missing required directory pieces.

## Non-goals

- No PDM schema expansion or new authoring format.
- No QSM validation change. Shared loader improvements may benefit QSM, but `loadQsmDir` remains parse-only unless a separate issue changes its contract.
- No blueprint behavior redesign beyond consuming the now-validated PDM.
- No decision-system edit.

## Current Context Checked

- `docs/decision-system.md`: locked bets include JSON-only authoring, 4-layer validation, `Result<T>` boundaries, branded validated types, and error code format.
- `docs/current/owners/packages/artifacts/pdm.md`: documents PDM as `parsePdm -> validatePdm -> createPdmResolver / deriveEventTypes`, with `ValidatedPdm` feeding downstream packages.
- `packages/artifacts/pdm/src/load/load-dir.ts`: currently returns `Promise<Result<PdmArtifact>>` and calls only `parsePdm({ entities: leafEntries })`.
- `packages/artifacts/pdm/src/validate/index.ts`: `validatePdm` runs structural validation first and short-circuits state-machine validation on structural failure.
- `packages/artifacts/_shared/src/load.ts`: shared directory helper currently wraps index read, leaf JSON parsing, index schema parse, and `parseFn` in one catch. Missing index/leaf directory paths are precise; malformed JSON/schema failures use the whole directory as path.
- `packages/artifacts/blueprint/src/load/load-blueprint.ts`: calls `loadPdmDir(pdmDir)`, then `validatePdm(rawPdm.value)`, then stores `validatedPdm.value` in the loaded blueprint.
- Current baseline after building `@rntme/artifact-shared`: `pnpm -F @rntme/pdm test` passes 69 tests.

## Decision-System Fit

- **G1 / F6 Repeatability:** directory-loaded blueprint input must deterministically become the same validated PDM or fail before runtime composition.
- **G2 / F5 LLM-authorability:** validation during load gives agents fail-fast, codified errors at the authoring boundary.
- **G5 / F2 Canonical-way check:** the directory path should not be a second, weaker way to obtain PDM. `parsePdm` remains the raw parser; `loadPdmDir` becomes the validated directory entry point.
- **Locked bet: 4-layer validation:** the design preserves parse, structural, and state-machine layers rather than collapsing them into a generic loader error.
- **Locked bet: branded `Validated*` types:** only validators should construct `ValidatedPdm`; `loadPdmDir` should return that brand because it owns the package loader.
- No contradiction with Goals, Filters, or locked Bets found.

## Proposed Design

Change `loadPdmDir` to parse and validate in one package-owned pipeline:

1. Use the existing directory assembly for `pdm.json` plus `entities/*.json`.
2. Call `parsePdm({ entities: leafEntries })`.
3. If parse fails, return the parse errors unchanged.
4. Call `validatePdm(parsed.value)`.
5. Return the validation result unchanged.

The public signature becomes:

```ts
export function loadPdmDir(dir: string): Promise<Result<ValidatedPdm>>;
```

`parsePdm` stays available for direct raw-object parsing and tests. The loader becomes the safe artifact boundary for the entity-per-file directory format.

## Error Contract

Keep parse-directory failures distinct from PDM parse and validation failures:

- Missing `pdm.json` -> `PDM_PARSE_DIR_INVALID`, `layer: "parse"`, `path: "pdm.json"`.
- Missing `entities/` -> `PDM_PARSE_DIR_INVALID`, `layer: "parse"`, `path: "entities"`.
- Malformed `pdm.json` -> `PDM_PARSE_DIR_INVALID`, `path: "pdm.json"`, with `cause` from the JSON parse error.
- Malformed `entities/Product.json` -> `PDM_PARSE_DIR_INVALID`, `path: "entities/Product.json"`, with `cause` from the JSON parse error.
- Invalid assembled PDM shape -> `PDM_PARSE_SCHEMA_VIOLATION` from `parsePdm`, with schema paths such as `entities.Product.fields.id.column`.
- Structural validation failure -> existing `PDM_STRUCT_*` errors from `validatePdm`.
- State-machine validation failure -> existing `PDM_SM_*` errors from `validatePdm`.

To get precise malformed-JSON paths without duplicating directory traversal in PDM, update `@rntme/artifact-shared` so `loadArtifactDir` catches index JSON and each leaf JSON read/parse separately and passes `{ message, path, cause? }` into `buildIoError`. PDM should extend `PdmError` with optional `cause?: unknown` and include the cause for `PDM_PARSE_DIR_INVALID`. QSM can ignore the optional cause in its builder.

Do not catch the returned parse/validation `Result` and rewrap it as `PDM_PARSE_DIR_INVALID`.

## Downstream Impact

`@rntme/blueprint` should stop calling `validatePdm(rawPdm.value)` after `loadPdmDir`; the value is already `ValidatedPdm`. It should keep its current blueprint-level wrapper:

- `loadPdmDir` error -> `BLUEPRINT_IO_ERROR`, `path: "pdm"`, `cause: loadedPdm.errors`.
- No separate "project pdm failed validation" branch is needed for directory-loaded PDM.

This removes the raw parsed PDM escape hatch while keeping blueprint error ownership intact.

## Alternatives Rejected

- **Document caller responsibility only.** Rejected because it leaves two valid authoring paths and keeps the fail-fast boundary outside the PDM package.
- **Add `loadValidatedPdmDir` and keep `loadPdmDir` raw.** Rejected under F2: it creates another way to do the same thing and invites callers to choose the weaker path.
- **Rewrap every validation failure as `PDM_PARSE_DIR_INVALID`.** Rejected because it erases the 4-layer validation model and makes LLM correction worse.
- **Hand-roll a PDM-only directory loader.** Rejected unless shared helper changes prove too invasive. The repo already introduced `loadArtifactDir` to remove duplicate PDM/QSM loader bodies.

## Docs Touch

- Update `packages/artifacts/pdm/README.md` only if the local command hint changes; otherwise leave it as a stub.
- Update `docs/current/owners/packages/artifacts/pdm.md` to list `loadPdmDir` in the API table, describe that it returns `ValidatedPdm`, and include `PDM_PARSE_DIR_INVALID` plus the root-entity state-machine error if the error list is touched.
- No `docs/decision-system.md` change: this derives from existing Goals/Filters/Bets.

## Validation and Gates

Required DEV gates:

- `pnpm -F @rntme/artifact-shared test` if shared loader error behavior changes.
- `pnpm -F @rntme/artifact-shared build`.
- `pnpm -F @rntme/pdm test`.
- `pnpm -F @rntme/pdm build`.
- `pnpm -F @rntme/blueprint test` or the narrow blueprint load tests if blueprint call sites change.
- `git diff --check`.

SPEC evidence:

- `pnpm install --frozen-lockfile` completed in the isolated worktree with existing workspace bin-link warnings for unbuilt local bins.
- Initial `pnpm -F @rntme/pdm test` failed because fresh worktree setup lacked `@rntme/artifact-shared/dist`.
- After `pnpm -F @rntme/artifact-shared build`, `pnpm -F @rntme/pdm test` passed: 11 files, 69 tests.

## Risks

- Changing `loadPdmDir` return type may expose TypeScript callers that relied on raw `PdmArtifact`. Current source search found only blueprint as a real source caller.
- Shared loader path precision changes must not accidentally convert package parse or validation `Result` failures into directory I/O errors.
- Adding `cause` to `PdmError` is a public type widening; it is additive, but docs/tests should show it is only expected for directory parse failures.

## PLAN/DEV Handoff

Implementation should stay in the canonical workspace for RNT-491 and keep the PR scoped to:

- `packages/artifacts/_shared/src/load.ts` and tests if precise malformed JSON path/cause requires shared helper changes.
- `packages/artifacts/pdm/src/load/load-dir.ts`, `src/types/result.ts`, `test/unit/load-dir.test.ts`, and fixture helpers.
- `packages/artifacts/blueprint/src/load/load-blueprint.ts` and focused tests if the type change requires caller updates.
- `docs/current/owners/packages/artifacts/pdm.md` for the loader contract and error docs.
