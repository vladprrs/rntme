# Architecture audit — `@rntme/ui`

This document mirrors the read-only architecture audit posted on Multica so it can be reviewed offline and linked from the repo.

| | |
|---|---|
| **Multica issue** | `RNT-212` (`d709fe78-a617-4673-84e3-7e60d2257494`) |
| **Issue title** | Audit: package architecture — @rntme/ui |
| **Package / scope** | `@rntme/ui` |
| **Verdict (summary)** | needs cleanup — solid foundation with several medium/high gaps between spec and implementation, plus missing validation  |
| **Audit comment id** | `cc070042-1979-448a-b1fb-b53124d0ef3c` |
| **Audit comment date** | 2026-04-28 |

---

## Audit report

The sections below reproduce the audit comment body **verbatim** from Multica (formatting preserved).


## Audit Report: @rntme/ui (packages/ui)

**Verdict:** needs cleanup — solid foundation with several medium/high gaps between spec and implementation, plus missing validation layers and test coverage holes.

---

### Blocker

| # | Problem | Evidence | Impact | Recommendation |
|---|---|---|---|---|
| B1 | **Declared `zod` dependency is completely unused** | `package.json:16` lists `zod: ^4.0.0`; zero imports across `src/`. Spec (2026-04-16-ui-artifact-v2-design.md §2 Phase 3) mandates parse-layer validation via Zod/json-render catalog. | Dependency bloat + spec non-compliance. Parse layer is the first validation gate; missing it means invalid authoring files pass silently. | Wire Zod schemas for `SourceManifest`, `SpecJson`, `ScreenDescriptor`, `RefElement`. Either inline or import from `@json-render/core` catalog if/when available. |

### High

| # | Problem | Evidence | Impact | Recommendation |
|---|---|---|---|---|
| H1 | **No parse-layer validation at all** | `src/resolve/resolve.ts:17` only catches `JSON.parse` failure → `MANIFEST_INVALID`. `SPEC_INVALID` and `SCREEN_SCHEMA_INVALID` codes exist but are never emitted. README §Out of scope confirms: "No parse-layer schema validator." | Invalid authoring shapes (wrong types, missing required fields, unknown keys) compile until they crash downstream or emit nonsensical artifacts. Breaks the "four-layer validator" contract from spec §2.3 and AGENTS.md §4. | Implement Zod schemas for all authoring types. Run parse validation in `resolve` after JSON parse. Emit `SPEC_INVALID` / `SCREEN_SCHEMA_INVALID`. |
| H2 | **Screen key collision is unvalidated** | `src/resolve/resolve.ts:96` derives key as `route.screen.split('/').pop()!`. Two routes with different base paths but same trailing segment (e.g. `screens/admin/home` and `screens/public/home`) silently overwrite each other. | Data loss at compile time. One screen silently disappears from output. | Add collision detection in `resolve`: if two routes resolve to the same screen key, emit an error (new code: `DUPLICATE_SCREEN_KEY`). |
| H3 | **`emit` silently drops missing `httpMap` bindings** | `src/emit/http-map.ts:21,40` `if (!http) continue;`. README §Invariants acknowledges this as "emit silently drops bindings missing from httpMap". | Runtime broken endpoints: a screen declares a data fetch or command action, but the compiled artifact omits it because the caller forgot to include the binding in `httpMap`. Hard to debug. | Change to emit `EMIT_FAILED` or new `MISSING_HTTP_ENTRY` error when a binding referenced in the screen is absent from `httpMap`. Validation already checked `resolveBinding`; `httpMap` should be required to cover the same set. |
| H4 | **Test coverage has critical gaps for reserved error codes** | Reserved codes: `UNBOUND_PARAM`, `UNKNOWN_PARAM`, `SPEC_INVALID`, `SCREEN_SCHEMA_INVALID`, `BINDING_KIND_MISMATCH`, `TYPE_MISMATCH`, `UNCOVERED_INPUT`, `EMIT_FAILED`, `SLOT_NOT_IN_LAYOUT`, `UNRESOLVED_BINDING`, `UNKNOWN_ROUTE`, `UNCOVERED_STATE_PATH`. Of these, only `MISSING_ROOT`, `ORPHAN_ELEMENT`, `BAD_CHILD_REF`, `CIRCULAR_REF` have explicit test coverage. | Reserved error codes that are never exercised rot. When the layers that emit them are eventually added, there will be no regression safety. | Add unit tests for every error code that is currently reachable, and stubs for reserved codes with TODOs linking to the planned layer. |
| H5 | **No consistency/cross-check validation layer** | `TYPE_MISMATCH` and `UNCOVERED_INPUT` are reserved but never emitted. Spec §2.3 Phase 3 layer 4 requires shape matching between binding outputs and component prop types. | UI may reference `$state` paths whose shapes don't match what the component expects. Runtime errors or silent rendering failures. | Design and implement consistency validation. This is a larger piece — requires either json-render catalog prop types or bindings artifact shape introspection. Flag as follow-up issue. |

### Medium

| # | Problem | Evidence | Impact | Recommendation |
|---|---|---|---|---|
| M1 | **`resolveComponent` is dead surface area** | `src/validate/index.ts:8` declares `resolveComponent` in `ValidateResolvers`; no validator calls it. Tests pass `() => ({ childrenModel: 'list' })` as a placeholder. | Confusing API contract. Callers must supply a resolver that is never used. Future component-model validation (e.g. validating that children arrays are only present on components that accept them) is blocked. | Either implement component-model validation in `validateStructural` (check `children` presence against `resolveComponent(type).childrenModel`), or remove `resolveComponent` from the public contract until it is needed. |
| M2 | **No binding-kind mismatch check** | `BINDING_KIND_MISMATCH` exists in `UiErrorCode` but is never emitted. `resolveBinding` returns `unknown | undefined`; the return value is never inspected. | A data binding could resolve to a command endpoint or vice versa. The compiler can't catch category mismatches. | Extend `resolveBinding` return type to include kind metadata (e.g. `{ id, kind: 'query' \| 'command' }`), and validate that data bindings map to queries and command actions map to commands. |
| M3 | **Manifest version `"2.0"` is hardcoded but never validated** | `src/types/source.ts:3` types it as literal `'2.0'`; `src/emit/emit.ts:11` hardcodes `'2.0'`. README says: "Manifest version literal is '2.0'. Anything else must be rejected at parse time." But `resolve` does not check `manifest.version`. | A manifest with `"version": "1.0"` or `"3.0"` would pass through undetected, producing a spec-non-compliant artifact. | Add version check in `resolve`: if `manifest.version !== '2.0'`, emit `MANIFEST_INVALID` with a clear message. |
| M4 | **No artifact serialization (pre-split output)** | Spec §2.5 Phase 5 and §3 require pre-split output: `_manifest.json`, `_screens/*.json`, `_layouts/*.json`. Current `emit` returns a single in-memory `CompiledArtifact`. | Runtime can't lazy-load screens. All 50+ screens load at once. Violates spec §2.5. | Add artifact serialization. This is a medium-sized change — requires new API surface, file writing, and tests. Can be a follow-up issue. |
| M5 | **No validation that layouts contain at least one `Slot`** | `validateStructural` rejects `Slot` outside layouts, but a layout with zero `Slot` elements passes. A layout without a Slot is functionally useless (it has no place to inject the screen). | Silent authoring mistake: layout compiles successfully but runtime can't render any screen inside it. | Add `MISSING_SLOT_IN_LAYOUT` structural rule: if `isLayout && !elements.some(e => e.type === 'Slot')`, emit error. |
| M6 | **`repeat.statePath` is not validated for coverage** | `src/validate/references.ts:79` `collectStatePaths` walks `props`, `visible`, `on`, `watch` but does not walk `repeat.statePath`. | A `repeat` pointing at an uncovered state path passes validation but fails at runtime. | Add `repeat.statePath` to `collectStatePaths` (or validate it separately). |
| M7 | **`isRefElement` guard is overly permissive** | `src/types/source.ts:83` `'$ref' in el` — any object with a `$ref` property passes, even if it also has `type`, `props`, etc. A malformed element that accidentally includes both shapes would be treated as a ref. | Could misclassify malformed elements, causing confusing errors in `expand` or `validate`. | Make the guard stricter: `return '$ref' in el && !('type' in el)` or use a more precise discriminant. |
| M8 | **`collectFragments` exits early on first cycle** | `src/resolve/resolve.ts:58` `return` after pushing `CIRCULAR_REF` aborts the entire fragment collection, missing other independent cycles or errors. | One cycle hides other unrelated errors, forcing fix→recompile→fix cycles. | Change to `continue` instead of `return`, collecting all cycle errors. |
| M9 | **No tests for route parameter matching in validation** | `src/validate/index.ts:30-38` implements `:param` segment matching, but no test exercises navigation to `/issues/:id` with `navigateTo: "/issues/123"`. | Route parameter logic is untested. Regressions possible. | Add validate unit tests for parameterized route matching. |
| M10 | **Missing `composite: true` in tsconfig** | `packages/ui/tsconfig.json:6` `"composite": false`. Most workspace packages use `composite: true` for project references. | Breaks workspace-level incremental builds and project-reference graph. | Set `composite: true` and verify `pnpm -r run build` still passes. |
| M11 | **No per-package lint config** | No `eslint.config.mjs` or `.eslintrc` in `packages/ui/`. | Inconsistent code style; no static analysis for common bugs (unused vars, etc.). | Add `eslint.config.mjs` following the pattern of sibling packages (e.g. `packages/bindings/`). |

### Low

| # | Problem | Evidence | Impact | Recommendation |
|---|---|---|---|---|
| L1 | **Error paths lack file/line source locations** | `UiError.path` is logical (e.g. `screen:home/actions/submit`), not a file/offset. | Harder to map errors back to authoring files for tooling/IDEs. | Acceptable for MVP, but document as known limitation. Add `sourceFile`/`line` fields to `UiError` when parse layer lands. |
| L2 | **`onSuccess.navigateTo` and `onError.showAlert` are underspecified** | `CommandAction.onSuccess?: { navigateTo?: string; refetchData?: string[]; clearFormState?: string[] }` — no validation that `navigateTo` is a known route or that `refetchData` paths exist. | Minor: runtime handles missing routes gracefully, but UX degrades silently. | Add optional consistency checks for `onSuccess.navigateTo` (against route resolver) and `refetchData` / `clearFormState` (against data bindings). |
| L3 | **`baseDir` leaks through the pipeline** | `ResolvedSource.baseDir` and `ExpandedSource.baseDir` carry the filesystem path into the compiled artifact indirectly. Not serialized, but present in intermediate types. | Minor hygiene issue. `baseDir` is only needed for `resolve`; it shouldn't propagate to `ExpandedSource`. | Remove `baseDir` from `ExpandedSource` type. |
| L4 | **`emit.ts` uses `as CompiledScreen` cast** | `src/emit/emit.ts:31,41` casts spread object to `CompiledScreen`. | Type safety hole. The spread shape is close but not checked. | Refactor to build `CompiledScreen` objects explicitly without cast, or use `satisfies`. |
| L5 | **README "Where to look first" references spec paths that may drift** | README §Where to look first links to `../../docs/superpowers/specs/done/...` using relative paths. | If specs are moved or renamed, links break. | Consider using absolute repo-root paths or a permalink scheme. |

---

### Quick wins (can be done in a single PR, <2h each)

1. **Add manifest version validation** (`M3`) — 5-line change in `resolve.ts`.
2. **Add screen-key collision detection** (`H2`) — ~10 lines in `resolve.ts`, add `DUPLICATE_SCREEN_KEY` code.
3. **Fix `isRefElement` guard** (`M7`) — 1-line change.
4. **Fix `collectFragments` early return** (`M8`) — change `return` to `continue`.
5. **Add `MISSING_SLOT_IN_LAYOUT` rule** (`M5`) — ~10 lines in `structural.ts`.
6. **Add `repeat.statePath` to `collectStatePaths`** (`M6`) — 1 line.
7. **Add `eslint.config.mjs`** (`M11`) — copy from sibling package.
8. **Set `composite: true`** (`M10`) — 1 line.
9. **Backfill unit tests for uncovered error codes** (`H4`) — `SLOT_NOT_IN_LAYOUT`, `UNRESOLVED_BINDING`, `UNKNOWN_ROUTE`, `UNCOVERED_STATE_PATH`, `BAD_CHILD_REF`.

### Requires product/architectural decision by Влад

1. **Parse layer / Zod wiring** (`B1`, `H1`) — Is the Zod parse layer blocked on `@json-render/core` catalog availability, or should we write inline Zod schemas now and swap later?
2. **Consistency validation** (`H5`) — Requires json-render catalog prop types and/or bindings artifact shape introspection. Is this blocked on `@json-render/core` integration, or should we design a simplified interim check?
3. **Artifact serialization** (`M4`) — Pre-split output is spec-required but not implemented. Does this block the next demo milestone?
4. **`resolveComponent` fate** (`M1`) — Remove from public API now, or implement component-model validation?
5. **Binding-kind metadata** (`M2`) — Should `resolveBinding` return kind info now, or defer until the consistency layer is designed?

---

### Files changed for this audit

None — audit is read-only per issue requirements. No code changes were made.

### Is the plan ready for [DEV]?

**Not yet.** The spec-to-implementation gaps (missing parse layer, missing consistency layer, missing artifact serialization) are large enough that a [DEV] agent would need to invent product decisions. Recommend:

1. Влад confirms/decides the 5 architectural questions above.
2. A follow-up plan issue is created with concrete implementation tasks ordered by dependency (parse layer first, then consistency layer, then serialization).
3. The quick wins can be farmed out immediately in a standalone cleanup PR.
