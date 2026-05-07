# Architecture audit — `@rntme/contracts-common-v1`

This document mirrors the read-only architecture audit posted on Multica so it can be reviewed offline and linked from the repo.

| | |
|---|---|
| **Multica issue** | `RNT-214` (`4b76db71-0e9c-4ecd-9b41-2b8705f277af`) |
| **Issue title** | Audit: package architecture — @rntme/contracts-common-v1 |
| **Package / scope** | `@rntme/contracts-common-v1` |
| **Verdict (summary)** | OK - structurally correct, serves as a primitives-only shared package. There are 3 medium risks (test coverage, absent |
| **Audit comment id** | `9c69bf3a-e199-4184-98e5-91b8dc26ca06` |
| **Audit comment date** | 2026-04-28 |

---

## Audit report

The sections below reproduce the audit comment body **verbatim** from Multica (formatting preserved).


## Audit Report: @rntme/contracts-common-v1

**Verdict:** OK - structurally correct, serves as a primitives-only shared package. There are 3 medium risks (test coverage, lack of .gitignore, fragile build script) and 2 low (documentation, lack of cross-package compatibility guard).

---

### 1. Purpose and place in architecture

**Status:** Corresponds to the spec.

The package is a single truth source for cross-category protobuf primitives (`CanonicalRef`, `CommandContext`, `Name`, `ListRequest`/`Filter`/`Sort`/`ListResponseMeta`, `Metadata`). All 3 category contract packages (`identity`, `ai-llm`, `crm`) depend on it via `workspace:*` and import `common.proto` via symlink into `proto-deps/`. This prevents drift between categories.

---

### 2. Public API / exports / naming

**Status:** OK, but there is a gap.

- **Exports:** `proto` (namespace), `Rntme` (type). Enough for consumers.
- **Naming:** Corresponds to the `rntme.contracts.common.v1` spec.
- **Gap:** Category contracts (`identity`, `crm`) re-export common types directly (`export const CanonicalRef = commonv1.CanonicalRef`), but the common package itself does not do this. This is a conscious decision (common are low-level primitives), but means that consumers are required to import common separately or rely on the re-export category package.

---

### 3. Internal boundaries

**Status:** Okay.

- Clean separation: `proto/` (canonical source) → `scripts/gen.mjs` (codegen) → `src/proto.gen.{js,d.ts}` (generated) → `src/index.ts` (thin re-export layer).
- There are no runtime/platform/demo/test concerns inside the package - it is purely compile-time/type-level.

---

### 4. Dependencies

**Status:** OK.

- Direct deps: `protobufjs` only (runtime for generated bindings).
- No workspace deps (by design - it is the root for categories).
- No unwanted imports.

---

### 5. Types, schemes, validation, error handling

**Status:** OK with reservations.

- `common.proto` corresponds to the §5 identity-canonical-contract-design spec.
- `error-codes.json` - empty `{}` (intentional, according to the spec §5.1).
- **Issue:** No `error-codes.ts` (unlike category packages). This is intentional, but creates a template inconsistency: category packages export `errorCodes` / `isErrorCode` / `layerOf`, but common packages do not. When adding common error codes in the future (for example, `COMMON_STRUCTURAL_INVALID_UUID`) you will have to enter this file retroactively.

---

### 6. Build / test / lint setup

**Severity: medium**

| Problem | Evidence | Impact | Recommendation |
|---|---|---|---|
| **6.1 Fragile build script** | `package.json#build`: `"tsc -p tsconfig.json && cp src/proto.gen.d.ts src/proto.gen.js dist/"` | `cp` is not cross-platform, does not check for the presence of dist/, may silently crash | Go to `scripts/build.mjs` as in CRM package (mkdir + copyFileSync + spawnSync with exit code check) |
| **6.2 Missing .gitignore** | No `.gitignore` in `_common/v1/` | `proto-deps/` and `dist/` may accidentally end up in git (CRM package ignores `dist/` and `proto-deps/`) | Add `.gitignore` with `dist/` and `proto-deps/` |
| **6.3 No @vitest/coverage-v8** | `pnpm test --coverage` crashes with MISSING DEPENDENCY | Cannot measure coverage locally | Add `@vitest/coverage-v8` to devDependencies |
| **6.4 Test coverage is minimal** | Only 6 round-trip tests (116 lines), no negative cases | edge cases are not checked (null/undefined fields, empty structs, max int32) | Add tests for default values, empty repeated fields, boundary values ​​|

**Build/test/lint gates:** All pass (`build`, `test`, `typecheck`, `lint`).

---

### 7. Documentation and onboarding

**Severity: low**

- There is a README, but it is short. There are no sections: "Where to look first" (standard rntme package README template), "Invariants & gotchas", "Out of scope".
- There is no example of using `ListRequest` with `Filter` + `Sort` (the main use case).
- There is no mention that `Metadata` uses `google.protobuf.Struct` and requires special construction.

---

### 8. Compliance with product vision and specs

**Status:** Full compliance.

- Implements solution Q5 from identity-canonical-contract-design.md §3.
- Layout complies with modules-monorepo-structure-design.md §5.1.
- Proto package `rntme.contracts.common.v1` complies with naming convention §6.1.

---

### 9. Quick wins (can be done without a product solution)

1. **Add `.gitignore`** (`dist/`, `proto-deps/`) - 1 line.
2. **Improve the build script** - copy `scripts/build.mjs` from the CRM package.
3. **Add `@vitest/coverage-v8`** to devDependencies.
4. **Extend round-trip tests:** empty structs, default values, boundary values ​​(limit=0, limit=2147483647).
5. **Add README** with sections based on the rntme package README template.

---

### 10. Changes requiring Vlad’s product/architectural solution

1. **Is `error-codes.ts` needed in the common package?** Now there is a mismatch with the template: category packages export typed error codes, common does not. If common errors (e.g. `COMMON_STRUCTURAL_INVALID_UUID`) appear in the future, is there a need for a consistent API?
2. **Are cross-package compatibility tests necessary?** Currently there is no automatic check that changing `common.proto` does not break codegen in dependent category packages. You can add a CI job, which, after changing common, rebuilds all category packages.

---

### 11. Problems by severity

| Severity | Count | Problems |
|---|---|---|
| **blocker** | 0 | — |
| **high** | 0 | — |
| **medium** | 3 | Fragile build script, lack of .gitignore, insufficient test coverage |
| **low** | 2 | Incomplete README, missing @vitest/coverage-v8 |

---

### Evidence summary

- Package location: `packages/contracts/_common/v1/`
- Spec: `docs/history/specs/historical/2026-04-26-identity-canonical-contract-design.md` §5
- Layout spec: `docs/history/specs/active-rationale/2026-04-26-modules-monorepo-structure-design.md` §5.1
- Build script: `packages/contracts/_common/v1/package.json:24`
- Test file: `packages/contracts/_common/v1/test/round-trip.test.ts` (116 lines, 6 tests)
- Missing .gitignore: confirmed via `ls -la packages/contracts/_common/v1/`
- Missing coverage: `pnpm test --coverage` → MISSING DEPENDENCY `@vitest/coverage-v8`
