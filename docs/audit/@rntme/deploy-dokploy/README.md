# Architecture audit — `@rntme/deploy-dokploy`

This document mirrors the read-only architecture audit posted on Multica so it can be reviewed offline and linked from the repo.

| | |
|---|---|
| **Multica issue** | `RNT-226` (`79ce411d-fb7b-4976-9390-96519025de04`) |
| **Issue title** | Audit: package architecture — @rntme/deploy-dokploy |
| **Package / scope** | `@rntme/deploy-dokploy` |
| **Verdict (summary)** | needs cleanup |
| **Audit comment id** | `55cfe0be-e015-4acb-91e2-96084d9384be` |
| **Audit comment date** | 2026-04-28 |

---

## Audit report

The sections below reproduce the audit comment body **verbatim** from Multica (formatting preserved).


## Architectural audit `@rntme/deploy-dokploy`

**Verdict: needs cleanup** - the package as a whole is designed cleanly (render/apply/client are separated, secrets are not leaked), but there are specific architectural risks and gaps that should be closed before production.

---

### No blockers found

---

### High

1. **`resourceMatches` uses `JSON.stringify` to compare complex objects**
   *Evidence:* `src/apply.ts:235` (`jsonEqual`), `src/apply.ts:209-233` (`resourceMatches`).  
   *Impact:* False positives on differences in key order, `undefined` vs missing key, nested objects. Leads to unnecessary `update` calls to the Dokploy API or, conversely, to missing real changes.
   *Recommendation:* Replace with structural deep comparison with explicit field schema (or normalized representation hashing).

2. **No rollback/cleanup mechanism for partial failure**
   *Evidence:* `src/apply.ts:36-91` - if there is an error on the Nth resource, already created/updated resources remain in Dokploy. `retrySafe: true` is declared, but does not guarantee idempotency when external state changes between retries.
   *Impact:* Orphan resources, inconsistent state of deployment, need for manual cleaning.
   *Recommendation:* Either add an explicit rollback step (removing created resources), or document the "at-least-once apply" contract and add orphan-detect at the executor level.

3. **`DokployClient` is strongly related to `RenderedDokployResource`**
   *Evidence:* `src/client.ts:24-35` - all `createApplication`, `updateApplication`, `configureApplication` methods accept the full `RenderedDokployResource`. `platform-http/src/deploy/dokploy-client-factory.ts` is forced to know the rendering internals.
   *Impact:* Adapter boundary violation. Changing the `RenderedDokployResource` fields breaks the client implementation in another package.
   *Recommendation:* Introduce DTO types for the client (`CreateApplicationInput`, `UpdateApplicationInput`, `ConfigureApplicationInput`) and mapping at the `apply.ts` level.

4. **Sequential application of resources without concurrency**
   *Evidence:* `src/apply.ts:45-71` - `for...of` loop with `await` on each iteration.
   *Impact:* For projects with 5+ workloads, deployment takes linearly longer. Dokploy API allows parallel operations.
   *Recommendation:* Add a concurrency pull (for example, `p-limit` or a simple `Promise.all` with `batchSize`) taking into account dependencies (edge-gateway should be deployed after upstream services if there are health-check dependencies).

---

### Medium

5. **`build` field in `RenderedDokployResource` is declared but never filled by the renderer**
   *Evidence:* `src/render.ts:266-294` - for `domain-service` only `image` is filled in, `build` is not touched. `src/render.ts:64` - `build?: RenderedDomainArtifactBuild` in type.
   *Impact:* Dead code/type. Creates confusion: is a build context expected for a domain-service or not?
   *Recommendation:* Either remove `build` from the renderer (if not needed) or implement build context generation. **Requires Vlad's decision.**

6. **No validation of `publicBaseUrl` and `endpoint` in `DokployTargetConfig`**
   *Evidence:* `src/config.ts` - simple type, `src/render.ts:86-182` - direct use without checks. `joinPublicUrl` will fail on an invalid URL.
   *Impact:* Runtime errors at render stage instead of early reject.
   *Recommendation:* Add runtime URL validation (via `new URL()`) to `renderDokployPlan` or introduce a zod scheme for `DokployTargetConfig`.

7. **Re-export of `Result`-helpers duplicates `deploy-core`**
   *Evidence:* `src/result.ts` is its own copy of `ok/err/isOk/isErr`. `src/index.ts:27` - re-export. `deploy-core` exports identical symbols.
   *Impact:* Two sources of truth. Risk of semantic desynchronization (for example, if `Result.map` is added to `deploy-core`).
   *Recommendation:* Depend on `Result` from `deploy-core` directly, remove `src/result.ts`.

8. **Insufficient coverage of edge cases tests**
   *Evidence:* `test/unit/render.test.ts` - no tests for: empty `workloads`[], several middleware of the same type on one route, `integration-module` with `expose: true` and public routes, invalid `endpoint`/`publicBaseUrl`.
   *Impact:* Regressions will occur in non-trivial scenarios.
   *Recommendation:* Add tests for the above scenarios.

9. **`assertNever` in `render.ts` throws plain Error**
   *Evidence:* `src/render.ts:335-337`.  
   *Impact:* Structured error contract violation (`DokployDeploymentError`). The calling code expects `Result<Err<...>>` and receives throw.
   *Recommendation:* Return `err([{ code: 'DEPLOY_RENDER_DOKPLOY_UNKNOWN_WORKLOAD', ... }])` instead of throw.

10. **`sanitizeCause` aggressively edits ALL error messages**
    *Evidence:* `src/apply.ts:268-276` - any `Error` turns into `"redacted client error"`.
    *Impact:* Lost diagnostics when debugging Dokploy network problems.
    *Recommendation:* Edit only known secret patterns (Bearer, apiToken, password), leaving the rest of the error text.

---

### Low

11. **README refers to a non-existent spec**
    *Evidence:* `README.md:32` - `docs/superpowers/specs/2026-04-24-project-deployment-pipeline-design.md` is missing from the repo.
    *Recommendation:* Correct the link or delete it.

12. **Version `0.0.0` in `package.json`**
    *Evidence:* `package.json:3`.  
    *Impact:* Unable to track breaking changes.
    *Recommendation:* Start semver (`0.1.0`) and commit the public API to stable.

13. **Lack of integration tests with the real Dokploy client factory**
    *Evidence:* All tests use `FakeDokployClient`. No e2e/smoke tests with `platform-http` client factory.
    *Impact:* Inconsistencies between the `DokployClient` interface and the actual implementation in `dokploy-client-factory.ts` are only detected in production.
    *Recommendation:* Add contract tests between interface and implementation, or integration tests with Dokploy dev instance.

---

### Quick wins (can be done without a product solution)

- Fix link in README.
- Add URL validation to `renderDokployPlan`.
- Fix `assertNever` to return `err()`.
- Soften `sanitizeCause`.
- Remove/re-export `Result` from `deploy-core`.
- Upgrade version to `0.1.0`.
- Add unit tests for empty workloads and multiple middleware.

---

### Require Vlad's decision

1. **What should I do with the `build` field?** Should I remove or implement the generation of an artifact build for domain-service?
2. **Rollback for partial failure:** implement automatic cleanup of created resources, or consider retry-safe sufficient?
3. **Refactoring `DokployClient` interface:** decouple from `RenderedDokployResource` through separate DTOs?
4. **Concurrency apply:** add parallel application of resources taking into account dependencies?

---

### Summary

The package fulfills its role as a "Dokploy adapter" well and isolates secrets correctly. The main risks are fragile comparison of states, lack of cleanup on errors, and strong coupling of `DokployClient` with internal render types. All problems can be resolved without changing the product vision.
