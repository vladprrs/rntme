# Architecture audit — `@rntme/db-studio`

This document mirrors the read-only architecture audit posted on Multica so it can be reviewed offline and linked from the repo.

| | |
|---|---|
| **Multica issue** | `RNT-203` (`92d8e763-7e5b-4586-aa4b-0e1be0a3461b`) |
| **Issue title** | Audit: package architecture — @rntme/db-studio |
| **Package / scope** | `@rntme/db-studio` |
| **Verdict (summary)** | needs cleanup — well-scoped and generally well-implemented, but has several medium-to-high issues around security robust |
| **Audit comment id** | `4500ddae-0970-4c6c-904f-fdfd2ad1ded1` |
| **Audit comment date** | 2026-04-28 |

---

## Audit report

The sections below reproduce the audit comment body **verbatim** from Multica (formatting preserved).


## Audit Report: `@rntme/db-studio`

**Verdict:** needs cleanup — well-scoped and generally well-implemented, but has several medium-to-high issues around security robustness, type safety, test coverage gaps, and integration wiring that need attention.

---

### Problems Found

#### High Severity

1. **SQL whitelist classifier has bypass vectors (security)**
   - **Evidence:** `src/whitelist/classify.ts` uses a ~150 LOC hand-rolled tokenizer + regex instead of a real SQL parser. `WRITE_KEYWORDS_IN_CTE` only checks for `INSERT|UPDATE|DELETE|REPLACE|MERGE` but does not guard against other write-adjacent syntax.
   - **Impact:** Potential for creative SQL injection / write bypass (e.g., compound statements, unicode keyword equivalents, or SQLite-specific syntax not caught by the regex). The `:memory:` path relies on this classifier as its *only* guard.
   - **Recommendation:** Add a dedicated fuzz-test suite for the classifier (generate valid/invalid SQL and assert rejection). Medium-term, evaluate `node-sql-parser` or `sqlite-parser` for AST-based classification. Document the accepted risk if keeping the hand-rolled approach.

2. **`batch` request type silently ignores `condition` field (semantic bug)**
   - **Evidence:** `src/handler/pipeline.ts:37` — `steps.map((s) => executeOne(s.stmt, deps))` completely ignores `s.condition`.
   - **Impact:** Clients sending conditional batch steps (e.g., `condition: { type: "ok", step: 0 }`) get unconditional execution, which violates Hrana semantics and can lead to unexpected side effects.
   - **Recommendation:** Either reject batch steps with non-null `condition` with `DB_STUDIO_HRANA_UNSUPPORTED`, or implement condition evaluation. Do not silently ignore.

#### Medium Severity

3. **`applyRowCap` regex is brittle for nested LIMITs**
   - **Evidence:** `src/handle/cap.ts:5` — `LIMIT_RE` only matches the trailing clause. SQL like `SELECT * FROM (SELECT * FROM t LIMIT 100000) x` is wrapped with an outer LIMIT, but the inner LIMIT already executed with a large count.
   - **Impact:** Performance degradation on pathological queries; the cap bounds final rows but not intermediate work.
   - **Recommendation:** Use a proper SQL parser to identify the *outermost* LIMIT, or document the limitation explicitly. Add a test for nested LIMIT behavior.

4. **`StudioLogger` interface is defined but never wired from runtime**
   - **Evidence:** `packages/runtime/src/plugins/http-surface.ts:74-78` — `mountStudio()` is called without a `logger` field. `src/mount.ts` has `logger?.info(...)` which is always a no-op in production.
   - **Impact:** Studio operations are invisible in runtime logs, making debugging production issues impossible.
   - **Recommendation:** Wire the runtime logger into the `mountStudio` call in `http-surface.ts`.

5. **Missing test coverage for `END` keyword in transaction rejection**
   - **Evidence:** `test/unit/classify.test.ts` tests `BEGIN`, `COMMIT`, `ROLLBACK`, `SAVEPOINT` but not `END`. `classify.ts:107` handles `END` but it is untested.
   - **Impact:** Regression risk if the `END` case is accidentally removed or modified.
   - **Recommendation:** Add a one-line test case: `it('END', () => rejected('END', 'DB_STUDIO_READONLY_TXN_DENIED'))`.

6. **No e2e test for `:memory:` mode in the demo**
   - **Evidence:** `demo/issue-tracker-api/test/studio-e2e.test.ts` boots the demo with persistent SQLite. The `:memory:` code path (which reuses writable handles and relies solely on the whitelist) is only covered in integration tests.
   - **Impact:** The most security-sensitive code path (`:memory:` + whitelist-only) is not exercised end-to-end.
   - **Recommendation:** Add an e2e test that boots the demo with `:memory:` and verifies studio read/write behavior.

#### Low Severity

7. **Error code inconsistency in manifest validation**
   - **Evidence:** `packages/runtime/src/manifest/validate.ts:21` uses `MANIFEST_INVALID_TYPE` for `maxRows` bounds, while other studio-specific errors use `RUNTIME_MANIFEST_STUDIO_PATH_CONFLICT`.
   - **Impact:** Inconsistent error taxonomy makes automated alerting and client error handling harder.
   - **Recommendation:** Use `RUNTIME_MANIFEST_STUDIO_MAXROWS_INVALID` or similar.

8. **`encodeValue` coerces arbitrary objects to strings**
   - **Evidence:** `src/hrana/encode.ts:18` — `return { type: 'text', value: String(v) }` for unknown types.
   - **Impact:** Silent data corruption if unexpected types (e.g., Date, custom objects) leak into the query result.
   - **Recommendation:** Add a warning log or return an error for unexpected types instead of coercing.

9. **`VERSION` constant is hardcoded to `'0.0.0'`**
   - **Evidence:** `src/index.ts:1`
   - **Impact:** Not useful for debugging in production.
   - **Recommendation:** Sync with `package.json#version` at build time or remove the export.

10. **README doesn't document `StudioLogger`**
    - **Evidence:** `README.md` API table and Quick start example don't mention the optional logger.
    - **Impact:** Users don't know they can pass a logger.
    - **Recommendation:** Add `StudioLogger` to the API table and Quick start example.

11. **`mountPath` trailing slash not validated**
    - **Evidence:** `StudioConfigSchema` in `packages/runtime/src/manifest/schema.ts` only checks `startsWith('/')`.
    - **Impact:** A trailing slash like `/_studio/` creates double slashes in routes (`/_studio//hrana/...`) and breaks the landing page root match.
    - **Recommendation:** Add `z.string().regex(/\\/$/, { message: 'must not end with /' })` or normalize the path in `mountStudio`.

---

### Quick Wins (can be done immediately)

- Add `END` keyword test case (#5).
- Wire runtime logger into `mountStudio` call (#4).
- Document `StudioLogger` in README (#10).
- Fix `VERSION` or remove it (#9).
- Add trailing-slash validation to `mountPath` (#11).

### Requires Product/Architecture Decision

- SQL parser strategy (#1) — accept hand-rolled risk + add fuzz tests, or invest in a parser dependency.
- Batch condition handling (#2) — explicitly reject or implement.

### Architectural Observations

- **Positive:** Clean separation of concerns (`hrana/`, `whitelist/`, `handle/`, `handler/`). No workspace dependencies — good isolation. Lazy import from runtime keeps bundle small when disabled.
- **Positive:** Matches the spec closely. The implementation is a faithful translation of `docs/superpowers/specs/done/2026-04-18-db-studio-design.md`.
- **Concern:** The hand-rolled SQL classifier was an accepted spec tradeoff (§5.2), but without a fuzz/penetration test suite, the security boundary is unverified. Given that `:memory:` mode is the default for demos and likely common in dev, this is the package's single biggest risk.
- **Concern:** The `batch` condition silently-ignored bug is a deviation from Hrana semantics that should be fixed before any client relies on batch behavior.

### Test Coverage Assessment

| Category | Files | Coverage | Gaps |
|----------|-------|----------|------|
| Unit | classify, cap, encode, pragma, errors, hrana-schema | Good for happy path | Missing fuzz tests for classifier; missing `END` test; missing nested LIMIT test |
| Integration | mount-studio, mount-studio-inmemory, cors, both-targets | Good for basic flows | Missing batch condition test; missing large payload/DoS test |
| E2E | demo/studio-e2e.test.ts | Good for persistent mode | Missing `:memory:` e2e |

### Dependency Analysis

- **Runtime deps:** `hono`, `zod` — both aligned with workspace versions.
- **Peer dep:** `better-sqlite3` — correctly declared; injected by caller.
- **No workspace deps** — clean isolation, no circular dependency risk.

---

### Conclusion

The package architecture is sound and well-scoped. The main risks are:
1. The hand-rolled SQL whitelist needs either a parser migration or a dedicated fuzz/penetration test suite.
2. The `batch` condition silent-ignore is a semantic bug that should be fixed.
3. The runtime should wire the logger for observability.

No code changes were made during this audit (read-only as requested). Recommended next step: create a follow-up issue for the high-severity items (#1, #2) and a separate issue for quick wins (#4, #5, #9, #10, #11).
