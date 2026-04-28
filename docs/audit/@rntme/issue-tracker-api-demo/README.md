# Architecture audit — `@rntme/issue-tracker-api-demo`

This document mirrors the read-only architecture audit posted on Multica so it can be reviewed offline and linked from the repo.

| | |
|---|---|
| **Multica issue** | `RNT-221` (`dd7ef572-b7f2-4f2b-ac85-8a7be08c8ae3`) |
| **Issue title** | Audit: package architecture — @rntme/issue-tracker-api-demo |
| **Package / scope** | `@rntme/issue-tracker-api-demo` |
| **Verdict (summary)** | needs cleanup |
| **Audit comment id** | `2da1382c-2af1-4121-b91c-225c3271f417` |
| **Audit comment date** | 2026-04-28 |

---

## Audit report

The sections below reproduce the audit comment body **verbatim** from Multica (formatting preserved).


## Audit Report: `@rntme/issue-tracker-api-demo`

**Verdict: needs cleanup** — the package is functional, well-documented, and exercises the full runtime pipeline, but it carries architectural drift from the project-first pivot, fixture-sync debt, and an ambiguous "deprecated" status that contradicts its heavy use in CI and docs.

---

### Problems

#### HIGH

1. **Runtime fixture copy is significantly out of sync with demo artifacts**
   - **Evidence:** `diff -r demo/issue-tracker-api/artifacts packages/runtime/test/fixtures/issue-tracker` shows 30+ divergences across `bindings.json`, `graphs/*.json`, `pdm.json`, `qsm.json`, `seed.json`, `shapes.json`. The README claims they are "kept in sync" (README.md:229) but they are not.
   - **Impact:** Runtime e2e tests exercise stale artifacts, undermining regression coverage for JOIN enrichment, seed normalization, and derived projections.
   - **Recommendation:** Add a CI check (`diff -r` or `rsync --dry-run`) that fails on divergence. Better: have runtime tests reference the demo package artifacts directly and remove the fixture copy.

2. **"Deprecated" status contradicts actual usage**
   - **Evidence:** README.md:3 calls this a "Deprecated historical reference", yet it is the primary e2e target in CI, referenced in 15+ specs/plans, AGENTS.md §6, and the root README.
   - **Impact:** New contributors and agents receive conflicting signals about whether this package is canonical or dead code.
   - **Recommendation:** Product decision needed — either remove the deprecation banner and maintain it as the canonical single-service demo, or finish the project-first blueprint migration and update all cross-references.

3. **`graph-ir.json` is a large compiled artifact at drift risk**
   - **Evidence:** `artifacts/graph-ir.json` (1038 lines) duplicates all individual `graphs/*.json` + `shapes.json`. `rntme.json` references it, but the runtime also loads individual graph files.
   - **Impact:** Edits to individual graphs must be manually synced to `graph-ir.json`. If it is stale, different code paths may read different graph definitions.
   - **Recommendation:** Clarify the canonical source — individual graph files or the monolithic `graph-ir.json`. If the latter is generated, add it to `.gitignore` and generate at build time.

#### MEDIUM

4. **`vitest.config.ts` forces sequential test execution unnecessarily**
   - **Evidence:** `fileParallelism: false` (vitest.config.ts:16). Each e2e test already uses a unique port (3011, 3012, 3013, 3015).
   - **Impact:** Slower CI (~60s vs ~20s for the e2e suite).
   - **Recommendation:** Remove `fileParallelism: false` or switch to `pool: 'forks'` and verify port isolation holds.

5. **Test pattern inconsistency: `grpc.test.ts` uses in-process runtime, others spawn subprocess**
   - **Evidence:** `test/e2e/grpc.test.ts` calls `loadService()` + `startService()` directly; all other e2e tests use `spawn('pnpm', ['exec', 'tsx', 'src/server.ts'], ...)`.
   - **Impact:** The gRPC test validates a different boot path. A breakage in `src/server.ts` would not be caught by `grpc.test.ts`.
   - **Recommendation:** Unify to subprocess spawning for all e2e tests, or split into `e2e-subprocess/` and `e2e-inprocess/` with an explicit rationale doc.

6. **Local type stubs in `derived-projection.test.ts`**
   - **Evidence:** Lines 23-29 define a private `SqlDb` stub; lines 35-40 define `KafkaMessageLike` / `KafkaProducerLike`.
   - **Impact:** Type duplication across test files; if the runtime's DB interface changes, tests silently desync.
   - **Recommendation:** Export test helpers from `@rntme/runtime` (e.g. `createTestDbDriver`, `createTestBus`) or create a `@rntme/test-utils` package.

7. **`KNOWN_ISSUES.md` is a zombie file**
   - **Evidence:** File header says "Status: all resolved" and "Deprecated historical reference", yet it remains at 79 lines and is cross-linked from README.
   - **Impact:** Clutters the package and creates the impression of lingering debt.
   - **Recommendation:** Delete or archive to `docs/history/`. Move still-relevant notes (e.g. `wrapPredicateOptional` analysis) to the per-package README or inline code comments.

8. **Missing `lint` script in `package.json`**
   - **Evidence:** No `"lint"` entry in `scripts`.
   - **Impact:** Inconsistent DX; CI may skip linting for this package.
   - **Recommendation:** Add `"lint": "eslint src test"` following the pattern of sibling packages.

#### LOW

9. **`ui.json` duplicates the `ui/` directory tree**
   - **Evidence:** `artifacts/ui.json` (1229 lines) is a flattened version of `artifacts/ui/manifest.json` + `screens/` + `layouts/` + `fragments/`.
   - **Impact:** Same drift risk as `graph-ir.json`.
   - **Recommendation:** Determine if `ui.json` is generated or canonical. If generated, `.gitignore` it and add a build step.

10. **`Dockerfile` hardcodes runtime image version without update automation**
    - **Evidence:** `FROM ghcr.io/vladprrs/rntme-runtime:1.0`
    - **Impact:** Security/feature drift if the base image updates.
    - **Recommendation:** Add Dependabot/Renovate config for Docker base images, or parameterize the tag via build arg.

---

### Quick wins (no product decision needed)
- Add CI fixture-sync check.
- Remove `fileParallelism: false` from `vitest.config.ts`.
- Delete/archive `KNOWN_ISSUES.md`.
- Add `lint` script to `package.json`.
- Document which artifacts under `artifacts/` are hand-authored vs generated.

### Requires product/architecture decision
- **Canonical status:** Is this demo deprecated or not? If deprecated, what is the replacement timeline? If not, remove the deprecation banner.
- **Generated artifacts:** Should `graph-ir.json` and `ui.json` be generated at build time? If yes, they should be `.gitignore`d and the build pipeline should produce them.
- **Fixture strategy:** Should runtime tests consume demo artifacts directly, or maintain a separate fixture copy? The current "copy" strategy is failing silently.

---

### Coverage assessment
- **Smoke + seed + enrichment e2e:** Good coverage of HTTP surface, seed replay, and JOIN enrichment.
- **Derived projection dedup:** Good coverage via `derived-projection.test.ts` with the marker-event pattern.
- **gRPC surface:** Minimal — only asserts pipeline reachability, not functional correctness.
- **UI v2:** No automated test coverage for the SPA routes or json-render output.
- **Edge cases:** Missing tests for concurrent command retries (409), invalid transition messages (422), and empty search results.

### Documentation assessment
- README.md is excellent — detailed file map, API table, invariants, and cross-references to specs.
- The "Deprecated" banner is the main documentation risk.
- Onboarding for the next agent is straightforward thanks to the "Where to look first" section.

### Final note
No PR is opened by this audit. All findings are read-only observations. Implementation tasks can be created from the recommendations above.
