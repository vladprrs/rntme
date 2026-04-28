# Architecture audit — `@rntme/bindings`

This document mirrors the read-only architecture audit posted on Multica so it can be reviewed offline and linked from the repo.

| | |
|---|---|
| **Multica issue** | `RNT-199` (`52aef7be-87bc-4c52-9403-db237b148944`) |
| **Issue title** | Audit: package architecture — @rntme/bindings |
| **Package / scope** | `@rntme/bindings` |
| **Verdict (summary)** | needs cleanup |
| **Audit comment id** | `ccbf776d-a89b-4f4e-b5ce-88badc520a0c` |
| **Audit comment date** | 2026-04-28 |

---

## Audit report

The sections below reproduce the audit comment body **verbatim** from Multica (formatting preserved).


## Audit Report: `@rntme/bindings`

**Verdict:** `needs cleanup` — no blockers, several medium-severity friction points and test gaps that should be fixed before the package stabilizes for broader consumption.

---

### Blocker (0)

None found. All 151 tests pass, lint is clean, typecheck is clean.

---

### High (0)

None found.

---

### Medium (4)

#### M1. `generateOpenApi` accepts unused `_resolvers` parameter — misleading public API
- **Evidence:** `src/openapi/emit.ts:137` — `export function generateOpenApi(validated: ValidatedBindings, _resolvers: BindingResolvers, ...)`
- **Impact:** Callers must pass resolvers that are never consulted (all data already in `ResolvedBinding`). Creates confusion about when resolvers are needed.
- **Recommendation:** Either (a) remove the parameter and bump call-sites, or (b) document explicitly as "reserved for future shape lazy-loading" in README + JSDoc. Current silent no-op is worst of both worlds.

#### M2. `BindingEntry.kind` optional in TS type but has Zod default — type-system drift
- **Evidence:** `src/types/artifact.ts:63` — `kind?: BindingKind`; `src/parse/schema.ts:97` — `kind: z.enum(['query', 'command']).default('query')`
- **Impact:** After `parseBindingArtifact`, `kind` is always present at runtime, but downstream code must still handle `undefined` in the type. This causes unnecessary defensive checks (`entry.kind ?? 'query'` appears in 6+ places).
- **Recommendation:** Make `kind: BindingKind` required in `BindingEntry` type. The parser guarantees it; the type should reflect that.

#### M3. `shapes` property validated but not typed in `BindingArtifact`
- **Evidence:** `src/validate/structural.ts:267` casts to `BindingArtifact & { shapes?: Record<string, unknown> }` to check reserved shape names.
- **Impact:** The validator knows about a property that the type system doesn't. This is a backdoor that bypasses `.strict()` Zod checks for the `shapes` key, creating a hidden contract.
- **Recommendation:** Decide: either (a) add `shapes?: Record<string, unknown>` to `BindingArtifactSchema` and type with validation, or (b) remove the reserved-shape check if `shapes` is not an official artifact field. Current limbo state is inconsistent.

#### M4. Missing edge-case test coverage
- **Evidence:**
  - No test for empty `bindings: {}` artifact (parse + validateStructural).
  - No test for `inputFrom` with `from: 'header'` / `from: 'form'` in OpenAPI emission (`src/openapi/emit.ts:88-98` only handles query/header; form is ignored).
  - No test for redirect with `allowedRedirectHosts` matching vs non-matching in structural layer.
  - No negative test for `pre[]` with `kind: 'system'` on non-command binding (only `module-rpc` tested in pre-structural).
- **Impact:** Silent regressions possible in OpenAPI emission and structural validation for less-common binding types.
- **Recommendation:** Add unit tests for the missing branches above. The `inputFrom` form/header emission gap is particularly notable since the type allows it but emit skips `form`.

---

### Low (5)

#### L1. `demo-openapi.mjs` imports from `./dist/index.js` requiring manual build
- **Evidence:** `demo-openapi.mjs:1` — `import { ... } from './dist/index.js'`
- **Impact:** Script fails if user hasn't run `pnpm build` first. Poor onboarding experience.
- **Recommendation:** Either (a) import from `src/` directly (ESM Node can handle it), or (b) add a `prestart` script and document the build requirement in `docs/examples.md`.

#### L2. No integration / contract tests against `@rntme/bindings-http`
- **Evidence:** All 151 tests are unit/golden within the package. No cross-package test verifies that `ValidatedBindings` actually works when consumed by `bindings-http`.
- **Impact:** Type-level contracts may drift from runtime expectations (e.g., `ValidatedBindings` brand is meaningless at runtime; `bindings-http` may start relying on fields not guaranteed by this package).
- **Recommendation:** Add a minimal contract test in `bindings-http` that asserts "a `ValidatedBindings` produced by `@rntme/bindings` can be passed to `createBindingsRouter` without type error". Even a compile-time check (no runtime) would catch drift.

#### L3. `PathItem` type is overly permissive
- **Evidence:** `src/types/openapi.ts:57-60` — `[key: string]: OperationObject | undefined | string;`
- **Impact:** Allows arbitrary string values alongside `get`/`post`, weakening type safety for OpenAPI consumers.
- **Recommendation:** Restrict to known OpenAPI 3.1 PathItem fields (`$ref`, `summary`, `description`, `servers`, `parameters`, `get`, `post`, `put`, `delete`, `patch`, `options`, `head`, `trace`) rather than `[key: string]`.

#### L4. `generateOpenApi` silently ignores `form`-sourced `inputFrom` entries
- **Evidence:** `src/openapi/emit.ts:88-98` handles `query` and `header` but has no branch for `form`.
- **Impact:** A binding with `inputFrom: { x: { from: 'form', ... } }` will not emit that parameter in OpenAPI at all, creating a mismatch between runtime behavior (bindings-http may support form) and generated documentation.
- **Recommendation:** Either emit `form` as a parameter with `in: query` + `style: form` (OpenAPI convention), or explicitly reject `form` in validation if not supported yet.

#### L5. Error code registry has no versioning / deprecation strategy
- **Evidence:** `src/types/result.ts:20-57` — `ERROR_CODES` is a flat const object. README says "append, never reorder, never delete" but there's no mechanism to enforce this.
- **Impact:** As the package evolves, deprecated codes may be accidentally removed or reused.
- **Recommendation:** Add a CI check (or even a Vitest test) that asserts `ERROR_CODES` keys are strictly monotonically appended (compare against a snapshot or JSON file). Low priority but cheap insurance.

---

### Quick wins (can be done without product decision)

1. **Fix M1** — remove `_resolvers` from `generateOpenApi` signature and update all call-sites (demo, tests, README examples). ~10 min refactor.
2. **Fix M2** — make `BindingEntry.kind` required in type, remove `?? 'query'` fallbacks. ~15 min refactor.
3. **Fix M3** — either type `shapes` properly or remove the reserved-name check. ~10 min decision + implementation.
4. **Fix M4 / L4** — add missing unit tests for empty bindings, form/header inputFrom, redirect host checks. ~30 min.
5. **Fix L1** — change `demo-openapi.mjs` import to `src/index.ts` or add build step to docs. ~5 min.

### Requires product/architectural decision from Влад

1. **M3** — Is `shapes` an official artifact field? If yes, it needs schema + docs. If no, remove the validator check.
2. **L4** — Is `form` input source supported in Tier 1? If yes, fix OpenAPI emission. If no, reject it in `validateStructural` with a clear error code.
3. **Future binding kinds** — The `BindingKind` enum is currently `query | command`. The spec mentions `PUT/PATCH/DELETE` as future work. Should the type be open (`string & {}`) or closed? Closed is safer today; if new kinds land, the compiler will force exhaustive switches.
4. **M1 follow-up** — If `_resolvers` is kept for planned lazy shape loading, document the roadmap. If removed, note that any future lazy-loading will require a new API shape.

---

### Positive findings (what's working well)

- **Clean 4-layer validation pipeline** with branded types enforcing ordering. No casting anti-patterns found.
- **Comprehensive error code registry** (38 codes) covering parse, structural, references, and consistency layers.
- **Good separation of concerns**: artifact parsing, validation, and OpenAPI emission are fully decoupled. No runtime dependencies on other `@rntme/*` packages.
- **Documentation is strong**: per-package README, LLM authoring guide, worked examples, and golden tests create good onboarding.
- **Golden tests** (category-sales, assign-issue) provide stable snapshot coverage for end-to-end pipeline.
- **Zero TODO/FIXME/HACK comments** in source — indicates disciplined development.

---

### Files changed in this audit

None — audit is read-only as requested. Recommended follow-up tasks can be filed as implementation issues.
