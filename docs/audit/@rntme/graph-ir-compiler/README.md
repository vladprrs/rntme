# Architecture audit — `@rntme/graph-ir-compiler`

This document mirrors the read-only architecture audit posted on Multica so it can be reviewed offline and linked from the repo.

| | |
|---|---|
| **Multica issue** | `RNT-205` (`a866a26a-d107-4a85-8d53-ef22e45680a8`) |
| **Issue title** | Audit: package architecture — @rntme/graph-ir-compiler |
| **Package / scope** | `@rntme/graph-ir-compiler` |
| **Verdict (summary)** | needs cleanup — multiple medium-to-high architectural risks and debt items. |
| **Audit comment id** | `a0410cb5-9c4f-4eb2-bd5c-b93987b7f0a1` |
| **Audit comment date** | 2026-04-28 |

---

## Audit report

The sections below reproduce the audit comment body **verbatim** from Multica (formatting preserved).


## Audit Report: @rntme/graph-ir-compiler

**Verdict:** needs cleanup — multiple medium-to-high architectural risks and debt items.

---

### 1. High — 66 `throw new Error` in src/ violate package-boundary convention
**Evidence:** `grep -r "throw new Error" src/` returns 66 hits across:
- `src/lower/sqlite/lower.ts`, `expr.ts`, `joins.ts` (lowering paths)
- `src/lower/sqlite/event-delta/{lower,bootstrap,filter,table-schema}.ts` (projection delta codegen)
- `src/relational/build.ts` (plan folding)
- `src/command-runtime/execute.ts` (runtime invariants)
- `src/canonical/normalize.ts`

**Impact:** AGENTS.md §4 states "No exceptions across package boundaries." Today many lowering/codegen paths throw instead of returning `Result.err`. Consumers (`@rntme/runtime`, `@rntme/bindings-http`) cannot distinguish internal bugs from invalid input without catching generic `Error`.

**Recommendation:** Refactor lowering and codegen functions to return `Result<T>` (or use an internal `assertNever` helper that is explicitly documented as "panic on internal invariant violation"). At minimum, the public-facing compile paths should catch and wrap these into `RUNTIME_SQLITE_ERROR` or new `LOWERING_INTERNAL_ERROR` codes.

---

### 2. High — Four top-level compile functions duplicate the parse→validate→normalize pipeline
**Evidence:** Compare:
- `src/index.ts:compile` (lines 58-113)
- `src/command-runtime/compile.ts:compileCommand` (lines 16-141)
- `src/index.ts:explain` (lines 152-216)
- `src/projection-compile.ts:compileProjectionGraph` (lines 28-118)

Each repeats: `parseAuthoringSpec → parseGraphIrArtifacts → validateStructural → normalize → validateSemantic`.

**Impact:** Bug fixes or new validation layers must be applied in 4 places. `compileCommand` even re-parses PDM/QSM manually instead of using `parseGraphIrArtifacts`.

**Recommendation:** Extract a `compilePipeline(builder)` or `PipelineContext` that holds the intermediate artifacts and runs stages in order. Each top-level function would configure the builder (e.g. `.withRoleCheck('command')`, `.withReadPrelude()`, `.withProjectionLowering()`) and call `.build()` once.

---

### 3. High — Event-delta lowering has zero unit tests
**Evidence:**
- `test/integration/projection-compile.test.ts` has only 2 cases (happy path + unsupported agg).
- No `test/unit/lower/sqlite/event-delta/` directory exists.
- `src/lower/sqlite/event-delta/` contains 5 modules (~400+ lines of SQL generation logic) with zero dedicated unit coverage.

**Impact:** The projection-consumer depends on this for idempotent UPSERT correctness. A bug in `buildDeltaArtifact`, `buildBootstrapSql`, or `buildDerivedTableSchema` would corrupt projection tables at runtime and be hard to debug.

**Recommendation:** Add unit tests for each event-delta submodule: bootstrap SQL rendering, delta SQL + binding order, filter artifact generation, table schema derivation, and virtual-column binding resolution. At least 10-15 tests.

---

### 4. Medium — `compileCommand` re-parses PDM/QSM manually
**Evidence:** `src/command-runtime/compile.ts:16-44` manually calls `parsePdm → validatePdm → parseQsm → validateQsm` instead of reusing `parseGraphIrArtifacts` from `src/explain/explain.ts`.

**Impact:** Duplicate error-mapping logic (PDM/QSM errors are mapped to `PARSE_SCHEMA_VIOLATION` in two places with slightly different messages). If `parseGraphIrArtifacts` gains better hints or new layers, `compileCommand` stays behind.

**Recommendation:** Replace the manual parsing block with `parseGraphIrArtifacts(rawPdm, rawQsm)`.

---

### 5. Medium — Projection-compile catch block misuses `PROJ_ROLE_UNINFERRABLE`
**Evidence:** `src/projection-compile.ts:105-117`:
```ts
try {
  const result = lowerToEventDelta(...);
  return ok(result);
} catch (e) {
  return err([{ code: ERROR_CODES.PROJ_ROLE_UNINFERRABLE, ... }]);
}
```

**Impact:** Any lowering error (missing scan step, unsupported measure, malformed expression) surfaces as `PROJ_ROLE_UNINFERRABLE` — a completely unrelated code. This breaks the error-code contract (stable, machine-readable) and confuses consumers.

**Recommendation:** Introduce a dedicated `PROJ_LOWERING_ERROR` code, or let `lowerToEventDelta` return `Result<DerivedCompileResult>` instead of throwing.

---

### 6. Medium — `lowerToSqlite` has unsafe default parameter
**Evidence:** `src/lower/sqlite/lower.ts:20`:
```ts
context: LowerContext = { predicateOptionalParams: new Set(), qsm: {} as unknown as ValidatedQsm }
```

**Impact:** Any caller that omits the context (or passes a partial one) gets a cast empty object pretending to be a `ValidatedQsm`. This is a type-system bypass that can crash at runtime during join resolution.

**Recommendation:** Remove the default parameter; make `context` required. If a test helper needs a dummy, provide an explicit `makeTestLowerContext()` factory.

---

### 7. Medium — `STRUCT_DUPLICATE_GRAPH_ID` overloaded with wrong semantics
**Evidence:** The code `src/index.ts:76-84`, `src/command-runtime/compile.ts:54-61`, `src/projection-compile.ts:46-55` all return `STRUCT_DUPLICATE_GRAPH_ID` when the spec contains 0 or >1 graphs, or when a requested `graphId` is missing.

**Impact:** The name says "duplicate graph ID" but the error actually means "exactly one graph expected" or "graph not found". Consumers parsing the code will be misled.

**Recommendation:** Introduce `STRUCT_SINGLE_GRAPH_REQUIRED` and `STRUCT_GRAPH_NOT_FOUND` codes. Deprecate `STRUCT_DUPLICATE_GRAPH_ID` for its original meaning (two graphs with the same key in the `graphs` map).

---

### 8. Medium — Package exports internal functions as public API
**Evidence:** `src/index.ts:30-33` exports `parseAuthoringSpec`, `validateStructural`, `validateSemantic`, `normalize` despite the README marking them "(internal)".

**Impact:** Consumers (`@rntme/runtime`, `@rntme/bindings-http`) may come to depend on these unstable surfaces. Future refactors become breaking changes.

**Recommendation:** Either remove these from `index.ts` exports (keep them importable via deep imports for tests) or document them as `@deprecated unstable — subject to change without notice`.

---

### 9. Low — `explain` duplicates `compile` logic
**Evidence:** `src/index.ts:152-216` mirrors `src/index.ts:58-113` almost line-for-line, just collecting intermediate artifacts.

**Impact:** Same as #2 but localized to one file. Any change to compile ordering or param handling must be mirrored in `explain`.

**Recommendation:** Once a shared pipeline builder exists (#2), `explain` becomes a thin wrapper that asks the builder to return all intermediate artifacts.

---

### 10. Low — No test coverage reporting configured
**Evidence:** `vitest run --coverage` fails with `Cannot find dependency '@vitest/coverage-v8'`. The package is not in `devDependencies`.

**Impact:** No quantitative visibility into which lowering branches or error paths are actually exercised.

**Recommendation:** Add `@vitest/coverage-v8` to devDependencies and enforce a coverage gate in CI (e.g. 80% for src/).

---

## Quick wins (can be done in a single PR without product debate)
1. Replace manual PDM/QSM parsing in `compileCommand` with `parseGraphIrArtifacts`.
2. Fix `projection-compile.ts` catch block to use a correct error code.
3. Remove unsafe default parameter from `lowerToSqlite`.
4. Add `@vitest/coverage-v8` and a coverage baseline.
5. Rename overloaded `STRUCT_DUPLICATE_GRAPH_ID` usages to clearer codes.

## Changes requiring product/architectural decision from Vlad
1. **Pipeline builder extraction** (#2) — affects 4 top-level functions and their consumers.
2. **Lowering exception → Result migration** (#1) — touches ~30 functions across `src/lower/`; needs a decision on whether internal invariants should panic or return errors.
3. **Event-delta unit test strategy** (#3) — needs prioritization; projection-consumer correctness is critical.
4. **Public API boundary cleanup** (#8) — decide which exports are truly public vs test-only.

---

**Files examined:**
- `src/index.ts`, `src/command-runtime/compile.ts`, `src/command-runtime/execute.ts`, `src/projection-compile.ts`
- `src/lower/sqlite/lower.ts`, `src/lower/sqlite/expr.ts`, `src/lower/sqlite/joins.ts`
- `src/lower/sqlite/event-delta/{lower,delta,bootstrap,filter,table-schema}.ts`
- `src/explain/explain.ts`, `src/relational/build.ts`, `src/canonical/normalize.ts`
- `src/validate/structural/index.ts`, `src/validate/semantic/index.ts`
- `src/types/result.ts`, `src/types/projection.ts`, `src/role/infer.ts`
- `test/` (90 test files, 297 tests passing)
- `README.md`, `package.json`, `demo-sql.mjs`
- Spec: `docs/history/specs/historical/2026-04-13-graph-ir-sql-compiler-mvp-design.md`
