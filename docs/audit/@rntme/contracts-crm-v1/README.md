# Architecture audit — `@rntme/contracts-crm-v1`

This document mirrors the read-only architecture audit posted on Multica so it can be reviewed offline and linked from the repo.

| | |
|---|---|
| **Multica issue** | `RNT-216` (`94cb9620-d2a4-4257-9977-79a9363baf62`) |
| **Issue title** | Audit: package architecture — @rntme/contracts-crm-v1 |
| **Package / scope** | `@rntme/contracts-crm-v1` |
| **Verdict (summary)** | needs cleanup |
| **Audit comment id** | `b37e2f7c-355f-425e-b644-ad7881ff7acb` |
| **Audit comment date** | 2026-04-28 |

---

## Audit report

The sections below reproduce the audit comment body **verbatim** from Multica (formatting preserved).


## Architectural audit @rntme/contracts-crm-v1

### Verdict: needs cleanup

The package is structurally sound and complies with the `crm-canonical-contract-design.md` specification, but contains several medium/high level issues that create risks when enabling conformance scripts and developing contracts. Build, tests, lint and typecheck pass in green.

---

### 🔴 High

#### 1. Conformance-assertions refer to non-existent symbols
**Evidence:**
- `modules/crm/conformance/src/scenarios/assertions.ts:42` - `CRM_REFERENCES_JOB_NOT_FOUND` (should be `CRM_REFERENCES_ASYNC_JOB_NOT_FOUND`)
- `modules/crm/conformance/src/scenarios/assertions.ts:48` - `CRM_REFERENCES_JOB_NOT_FOUND` (same code)
- `modules/crm/conformance/src/scenarios/assertions.ts:55` - `AsyncJobCancelled` event (it is not in proto; canceled tasks generate `AsyncJobFailed`)

**Impact:** When the conformance framework is enabled, scripts will crash at compilation/runtime, creating a false sense of coverage.

**Recommendation:** Fix error codes for `CRM_REFERENCES_ASYNC_JOB_NOT_FOUND`, replace `AsyncJobCancelled` with `AsyncJobFailed` with the desired status.

#### 2. `layerOf` implemented via string-split - fragile
**Evidence:**
- `packages/contracts/crm/v1/src/error-codes.ts:23` — `return code.split('_')[1] as CrmErrorLayer`

**Impact:** If the naming convention is changed (for example, adding the prefix `CRM_INTERNAL_...`), the function will break secretly, since there are no tests for it.

**Recommendation:** Replace with lookup by Set/Map or generate from `error-codes.json` at the build stage.

---

### 🟡 Medium

#### 3. Missing tests for `isErrorCode` / `layerOf`
**Evidence:**
- `packages/contracts/crm/v1/test/error-codes.test.ts` - 7 tests, all check only the list of codes, not runtime-helpers.
- Comparison: `ai-llm/v1/test/error-codes.test.ts` contains 2 additional tests for these functions.

**Impact:** Regressions in the runtime behavior of contracts are not caught by CI.

**Recommendation:** Add tests similar to `ai-llm/v1`.

#### 4. `Rntme` is exported as a type, but undefined at runtime
**Evidence:**
- `packages/contracts/crm/v1/src/index.ts:4` — `export type { Rntme } from './proto.gen.js'`
- Runtime: `import { Rntme } from '@rntme/contracts-crm-v1'; console.log(Rntme)` → `undefined`

**Impact:** Potential confusion for consumers expecting a namespace object.

**Recommendation:** Either remove runtime export (leave only type), or export `rntme` as a value. Requires agreement with identity/ai-llm.

#### 5. Version `0.0.0` and `private: true`
**Evidence:**
- `packages/contracts/crm/v1/package.json` — `"version": "0.0.0"`, `"private": true`

**Impact:** The lack of semantic versioning makes it difficult to understand the stability guarantee for downstream modules.

**Recommendation:** Define a versioning policy for contract packages (pre-release tags, alpha/beta).

#### 6. Generated proto files (~2.4 MB) are committed to the repository
**Evidence:**
- `packages/contracts/crm/v1/dist/proto.gen.js` (~1.8 MB)
- `packages/contracts/crm/v1/dist/proto.gen.d.ts` (~614 KB)
- `.gitattributes` marks them as generated, but they are still in history

**Impact:** Repository bloat, merge-conflicts on regeneration.

**Recommendation:** Place the generation in the `prebuild`/`prepare` script; keep in `.gitignore` (requires a CI solution). **Requires an architectural solution.**

---

### 🟢 Low

#### 7. README — boilerplate without CRM specifics
**Evidence:**
- `packages/contracts/crm/v1/README.md` - general examples from the template, no mention of 34 RPCs, events, aggregates.

**Recommendation:** Add examples of importing service types, enums, error codes, description of connection with proto files.

#### 8. No explicit documentation for 34 RPC
**Evidence:**
- `proto/crm.proto` contains 34 methods, but the README does not describe any.

**Recommendation:** Generate or write a short summary of RPC groups (Leads, Contacts, Opportunities, etc.).

---

### Quick wins (can be done without approval)

1. Fix error codes and events in conformance-assertions.
2. Add tests for `isErrorCode` / `layerOf`.
3. Replace `layerOf` with lookup by Set.
4. Update the README with CRM-specific examples.

### Requires decision from Vlad/architectural committee

1. **Strategy for generated proto files:** commit vs generate during build. Affects CI, Docker, reproducible builds.
2. **Contract versioning policy:** when to upgrade the version, what stability guarantees to give downstream.
3. **Runtime export `Rntme`:** unify behavior between contract packages.
4. **Conformance scenarios:** all 35 scenarios are `pending` stubs. Do we need a real conformance framework in the next quarter?

---

### Summary

The package is ready to use in its current form, but has hidden risks (broken conformance-assertions, fragile `layerOf`, lack of tests for runtime-helpers). It is recommended to close quick wins within one follow-up issue, and bring up architectural issues for discussion.
