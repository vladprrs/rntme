# Architecture audit — `@rntme/conformance-crm`

This document mirrors the read-only architecture audit posted on Multica so it can be reviewed offline and linked from the repo.

| | |
|---|---|
| **Multica issue** | `RNT-219` (`37cf6ee4-4fca-42d7-85b2-ef0978c04130`) |
| **Issue title** | Audit: package architecture — @rntme/conformance-crm |
| **Package / scope** | `@rntme/conformance-crm` |
| **Verdict (summary)** | needs cleanup — structural drift from sibling conformance packages and missing build automation create future migration  |
| **Audit comment id** | `30c315f0-47a8-48ef-b473-440daed45dfd` |
| **Audit comment date** | 2026-04-28 |

---

## Audit report

The sections below reproduce the audit comment body **verbatim** from Multica (formatting preserved).


## Audit Report: `@rntme/conformance-crm`

**Verdict:** needs cleanup — structural drift from sibling conformance packages and missing build automation create future migration risk.

---

### 1. BLOCKER

*None found.*

---

### 2. HIGH

#### H1 — `CategoryConformanceSuite` / `Scenario` type schema diverges from identity and ai-llm conformance
- **Evidence:** `modules/crm/conformance/src/types.ts:40-63` vs `modules/identity/conformance/src/types.ts:19-38` vs `modules/ai-llm/conformance/src/types.ts:19-38`
- **Impact:** When `@rntme/conformance-framework` lands, it will need to support **two incompatible `Scenario` shapes** or CRM will require a separate migration. The framework spec (modules-monorepo §7) assumes a single shared type.
- **Details:**
  - Field name: CRM uses `scenarios`, identity/ai-llm use `scenariosByRpc`
  - Field name: CRM uses `contract_version` (snake_case), identity/ai-llm use `contractVersion` (camelCase)
  - `Scenario` shape: CRM has `name`, `capability`, `requires`, `action`/`steps`, `assertionsDescription`; identity/ai-llm have `description`, `seed`, `action`, `assertions` (typed function arrays)
- **Recommendation:** Either (a) align CRM types with identity/ai-llm in a single PR, or (b) document the intentional divergence in README with a framework-compat plan. Default to (a) unless there's a product reason CRM scenarios need a different model.

#### H2 — Missing `build:deps` script breaks CI on fresh clones
- **Evidence:** `modules/crm/conformance/package.json:20-26` has no `build:deps`; compare with `modules/identity/conformance/package.json:19-26` and `modules/ai-llm/conformance/package.json:20-27`
- **Impact:** `pnpm test` and `pnpm typecheck` fail on fresh workspaces because `@rntme/contracts-crm-v1` dist is missing. Confirmed locally: `test/drift.test.ts` and `typecheck` both fail until `pnpm -F @rntme/contracts-crm-v1 build` is run manually.
- **Recommendation:** Add `build:deps` script that builds `@rntme/contracts-crm-v1` (and ideally `@rntme/contracts-common-v1`) before test/typecheck, matching sibling packages.

---

### 3. MEDIUM

#### M1 — Missing direct dependency on `@rntme/contracts-common-v1`
- **Evidence:** `package.json:27-29` lists only `@rntme/contracts-crm-v1`; identity and ai-llm list both the category contract AND `@rntme/contracts-common-v1`
- **Impact:** Relies on transitive resolution today; breaks if `@rntme/contracts-crm-v1` stops re-exporting common primitives.
- **Recommendation:** Add `"@rntme/contracts-common-v1": "workspace:*"` to `dependencies`.

#### M2 — No `capabilities.ts` canonical registry
- **Evidence:** AI-LLM conformance has `src/capabilities.ts` exporting `AI_LLM_CANONICAL_RPCS`, `AI_LLM_CANONICAL_EVENTS`, etc. CRM has no equivalent.
- **Impact:** Vendor modules cannot import a canonical RPC/event list from the conformance package; they must hardcode or reach into the contract package.
- **Recommendation:** Add `src/capabilities.ts` with `CRM_CANONICAL_RPCS` (34 entries), `CRM_CANONICAL_EVENTS` (21 entries), and `CRM_CAPABILITY_FIELDS` — consumed by drift tests and vendor modules.

#### M3 — Scenario stubs are non-executable text descriptions only
- **Evidence:** All 34 `*.scenarios.ts` files export a single `pendingScenario` with `assertionsDescription` string and empty `action`/`steps`. No typed `assertions` array.
- **Impact:** When the framework lands, every scenario file will need a ground-up rewrite from string descriptions to executable assertion functions. The current `assertions.ts` map (76 lines of prose) is useful documentation but not machine-executable.
- **Recommendation:** This is expected for a v1 skeleton, but add a `TODO(framework)` comment in `types.ts` and `README.md` clarifying the migration path from `assertionsDescription` strings → typed assertion arrays.

---

### 4. LOW

#### L1 — `files` array in package.json inconsistently includes `src/fixtures/webhooks`
- **Evidence:** `package.json:15-19` includes `"src/fixtures/webhooks"` alongside `"dist"`. Identity package does not include fixtures; ai-llm includes `"src/fixtures/media"`.
- **Impact:** Published tarball will contain source fixture files, which is fine for a `private: true` workspace package, but inconsistent.
- **Recommendation:** Either standardise all conformance packages to include fixtures in `files`, or remove and rely on `dist` only (fixtures are compiled into JS if imported).

#### L2 — `suite-shape.test.ts` enforces arbitrary `assertionsDescription.length > 120`
- **Evidence:** `test/suite-shape.test.ts:24`
- **Impact:** A legitimate concise scenario could fail this invariant.
- **Recommendation:** Drop the length check or reduce to `> 30` (enough to confirm it's not a placeholder).

#### L3 — `test:watch` script does not build deps
- **Evidence:** `package.json:23` is `"test:watch": "vitest"` without `build:deps` prefix.
- **Impact:** In a fresh workspace, `pnpm test:watch` fails until dependencies are manually built.
- **Recommendation:** Change to `"test:watch": "vitest"` (same as now) but document in README that `build:deps` must be run first, or prepend `pnpm run build:deps &&`.

---

### 5. Quick wins (no product decision needed)

1. Add `build:deps` script to `package.json`.
2. Add `@rntme/contracts-common-v1` to `dependencies`.
3. Fix `test:watch` to build deps first (or document).
4. Reduce `assertionsDescription.length` threshold in `suite-shape.test.ts`.
5. Add `TODO(framework)` comments in `types.ts` and `README.md` about executable assertion migration.

### 6. Requires product/architecture decision from Vlad

1. **H1 — Type schema divergence:** Is CRM's `Scenario` shape (`action`/`steps`, `assertionsDescription` string, `capability` field) intentionally different from identity/ai-llm, or is it drift? If intentional, document the rationale; if drift, schedule alignment.
2. **M2 — `capabilities.ts` registry:** Should CRM conformance export canonical RPC/event registries like AI-LLM does? This affects how vendor modules validate capability claims.
3. **M3 — Scenario executability:** Should the v1 skeleton include at least ONE fully-typed executable scenario as a reference pattern, or stay 100% text-description stubs until the framework lands?

---

### 7. Product fit assessment

The package correctly occupies its intended place in rntme architecture:
- It is the per-category conformance suite for CRM, matching the modules-monorepo §7 pattern.
- 34 RPCs × 1 scenario stub = 34 scenario files, matching the canonical contract.
- Fixtures cover all 5 business aggregates + associations + pipelines + custom fields + owners + 4 webhook formats.
- Drift test enforces 1:1 mapping between proto `CrmModule` RPCs and scenario files — this is the critical invariant and it is correctly implemented.

The package is **architecturally sound in scope** but has **structural inconsistencies** with sibling conformance packages that will compound when the shared framework lands.

---

### 8. Files audited

- `modules/crm/conformance/package.json`
- `modules/crm/conformance/tsconfig.json` / `tsconfig.check.json`
- `modules/crm/conformance/eslint.config.mjs`
- `modules/crm/conformance/src/index.ts`
- `modules/crm/conformance/src/types.ts`
- `modules/crm/conformance/src/suite.ts`
- `modules/crm/conformance/src/scenarios/*.scenarios.ts` (all 34)
- `modules/crm/conformance/src/scenarios/assertions.ts`
- `modules/crm/conformance/src/fixtures/*.ts` (all 9)
- `modules/crm/conformance/src/fixtures/webhooks/*`
- `modules/crm/conformance/test/drift.test.ts`
- `modules/crm/conformance/test/suite-shape.test.ts`
- `modules/crm/conformance/test/fixtures-sanity.test.ts`
- Sibling packages: `modules/identity/conformance/`, `modules/ai-llm/conformance/`
- Specs: `docs/history/specs/historical/2026-04-27-crm-canonical-contract-design.md`, `docs/history/specs/active-rationale/2026-04-26-modules-monorepo-structure-design.md`

---

### 9. Test results

After building `@rntme/contracts-crm-v1`:
- `build`: PASS
- `typecheck`: PASS
- `test`: 11/11 pass (3 suites)
- `lint`: PASS (no errors, no warnings)
