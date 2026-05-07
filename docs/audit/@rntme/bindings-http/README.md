# Architecture audit — `@rntme/bindings-http`

This document mirrors the read-only architecture audit posted on Multica so it can be reviewed offline and linked from the repo.

| | |
|---|---|
| **Multica issue** | `RNT-201` (`1e7ea5ee-10ee-4f7e-87ca-bc5d314db510`) |
| **Issue title** | Audit: package architecture — @rntme/bindings-http |
| **Package / scope** | `@rntme/bindings-http` |
| **Verdict (summary)** | needs cleanup |
| **Audit comment id** | `40269f3e-872a-410a-8bdb-3115a6637253` |
| **Audit comment date** | 2026-04-28 |

---

## Audit report

The sections below reproduce the audit comment body **verbatim** from Multica (formatting preserved).


## Architectural audit @rntme/bindings-http

**Verdict: needs cleanup**

The package is functional (147 tests, 26 suites, all pass after the workspace is built), well documented (README with detailed file map and invariants), and corresponds to the product vision as a runtime layer for HTTP surface. However, there are architectural risks and technical debt.

---

### Blocker

**1. Public API surface drift vs spec**
- **Evidence:** `src/index.ts:5-6` exports `buildDefaultGraphIrCommandMap`, `buildDefaultGraphIrQueryMap`; `src/index.ts:18` exports `correlationMiddleware`; `src/index.ts:1` exports `VERSION`.
- **Impact:** Spec `2026-04-14-bindings-http-design.md` §3 states that the only public function is `createBindingsRouter`. Violation of source of truth.
- **Recommendation:** Either remove unnecessary exports from `index.ts`, or update the spec with justification. `correlationMiddleware` logically belongs to `@rntme/runtime`.

---

### High

**2. Type duplication/divergence with `@rntme/graph-ir-compiler`**
- **Evidence:** `src/executor-contract.ts` defines its own `CommandExecutor`, `QueryExecutor`, `CommandExecutionContext`, `CorrelationCtx`. But `src/runtime/correlation-middleware.ts:3` imports `CorrelationCtx` from `@rntme/graph-ir-compiler`. `graph-ir-compiler/src/index.ts` exports `CorrelationCtx` and `CommandExecutionError`.
- **Impact:** Risk of types becoming out of sync with changes in graph-ir-compiler.
- **Recommendation:** Import `CommandExecutor`, `QueryExecutor`, `CorrelationCtx` directly from `@rntme/graph-ir-compiler`, or create a shared contract package.

**3. `command-handler.ts` violates SRP (290 lines)**
- **Evidence:** `src/runtime/command-handler.ts` contains: input extraction (both schema + inputFrom), pre-step orchestration, idempotency cache write, response rendering, redirect security, error mapping, metrics emission.
- **Impact:** Difficult to test in isolation, high risk of regression when changes occur.
- **Recommendation:** Break down into pipeline stages: `validateInputs → runPreSteps → executeCommand → renderResponse → writeIdempotencyCache`.

**4. Hard-coded `/api` prefix**
- **Evidence:** `src/router.ts:80` — `const stripped = p.replace(/^\/api/, '') || '/';`
- **Impact:** The package expects to be mounted on `/api`, but this is not documented in the public API. It will break if there is a different mount path.
- **Recommendation:** Add to the `createBindingsRouter({ mountPath?: string })` parameter or remove stripping entirely (commandNameFromPath must be provided by the caller).

**5. `graphSpec/pdm/qsm: unknown` at packet boundary**
- **Evidence:** `src/router.ts:19-22` — all three parameters are `unknown`.
- **Impact:** There are no compile-time guarantees of compatibility with the `@rntme/graph-ir-compiler` API.
- **Recommendation:** Accept as an architectural solution (MVP), but add runtime validation or branded types.

---

### Medium

**6. IdempotencyCache - no automatic cleanup**
- **Evidence:** `src/idempotency/cache.ts:63-68` - `pruneExpired` exists, but is not called anywhere.
- **Impact:** The `idempotency_cache` table will grow indefinitely.
- **Recommendation:** Add a `pruneExpired` call to middleware or startup, or document that cleanup is the caller's responsibility.

**7. Error-to-HTTP mapping is not extensible**
- **Evidence:** `src/runtime/error-to-http.ts:6-12` - a rigid table of 5 codes. New `CommandExecutorErrorCode` from graph-ir-compiler are not mapped automatically.
- **Impact:** Adding a new error code requires changing bindings-http.
- **Recommendation:** Make mapping extensible through the `createBindingsRouter` options, or move the mapping to `@rntme/graph-ir-compiler`.

**8. Zod v4 vs v3 mismatch**
- **Evidence:** `package.json` — `zod: ^4.0.0`. Spec — `zod: ^3.23.0`.
- **Impact:** API v4 may differ (e.g. `z.ZodTypeAny` vs `z.ZodType`).
- **Recommendation:** Check compatibility and update the spec, or fix the exact version.

**9. Lack of e2e/golden tests**
- **Evidence:** `test/` contains unit + integration, but `test/e2e/` does not.
- **Impact:** There is no regression protection at the level of the full request lifecycle through a real Hono server.
- **Recommendation:** Add e2e suite with `demo/issue-tracker-api` as fixture.

**10. Adapter types in bindings-http**
- **Evidence:** `src/runtime-contract.ts` contains `ExternalAdapterClient`, `AdapterResult`, `AdapterErrorCode`, `RetryPolicy`.
- **Impact:** These types are a contract between runtime and module adapter, not HTTP bindings.
- **Recommendation:** Move to `@rntme/runtime` or `@rntme/contracts-common-v1`.

---

### Low

**11. VERSION = '0.0.0'**
- **Evidence:** `src/index.ts:1`. Useless, `package.json#version` already exists.
- **Recommendation:** Delete or synchronize with package.json at build time.

**12. Tests require pre-built workspace**
- **Evidence:** 12 suites crash with `Failed to resolve entry for package` without `pnpm -r run build`.
- **Impact:** CI risk, onboarding friction.
- **Recommendation:** Add `build` as a pre-requisite in CI, or configure Vitest to resolve via TypeScript source.

---

### Quick wins (can be done without Vlad's solution)
1. Remove `VERSION` from `index.ts`.
2. Add a `pruneExpired` call to `idempotencyMiddleware` when there is a cache miss.
3. Add a JSDoc to the `BindingsRouterOptions` about the `/api` prefix.
4. Update the spec with the current public API.

### Solutions that require Vlad
1. **Public API boundary:** Follow spec (`createBindingsRouter` only) or officially extend surface?
2. **Command handler decomposition:** Should we split it into pipeline stages or leave it as a monolithic closure?
3. **Adapter contract ownership:** Where should `ExternalAdapterClient` / `AdapterResult` types live?
4. **Error mapping strategy:** Extensible mapping or centralized registry?
5. **Auto-prune strategy:** Cron, middleware-side, or caller's responsibility?

---

### Compliance with product vision
The package clearly falls into the vision as "runtime layer that turns validated blueprint into working APIs". No service-specific code. Good documentation and onboarding for the next developer.

### DEV Readiness Recommendation
The package is **ready for DEV with edits** after resolution blocker #1 and high-priority items #2-#5. Doesn't require a complete rewrite.
