# Architecture audit — `@rntme/contracts-identity-v1`

This document mirrors the read-only architecture audit posted on Multica so it can be reviewed offline and linked from the repo.

| | |
|---|---|
| **Multica issue** | `RNT-217` (`7e911548-7705-466d-9750-8e5e812508bf`) |
| **Issue title** | Audit: package architecture — @rntme/contracts-identity-v1 |
| **Package / scope** | `@rntme/contracts-identity-v1` |
| **Verdict (summary)** | needs cleanup |
| **Audit comment id** | `f195b793-6070-4059-821f-797ece6860f8` |
| **Audit comment date** | 2026-04-28 |

---

## Audit report

The sections below reproduce the audit comment body **verbatim** from Multica (formatting preserved).


## Architectural audit `@rntme/contracts-identity-v1`

### 1. Verdict: **needs cleanup**

The architectural form of the package is correct and conforms to the `2026-04-26-identity-canonical-contract-design.md` specification. The public API is stable, tests pass, build/lint/typecheck are clean. However, there are maintainability risks: dead code, lack of synchronization check of generated files with proto-sources, and a potential ESM/CJS problem in generated typings.

---

### 2. Issues found

#### **HIGH** - `scripts/check-imports.mjs` - dead code
- **Evidence:** the file exists (`packages/contracts/identity/v1/scripts/check-imports.mjs`), but is not mentioned in any `package.json#scripts`, not run in CI, not imported by tests.
- **Impact:** will eventually break away from the current API; creates a false sense of coverage for imports. The next developer may waste time maintaining an unused script.
- **Recommendation:** delete the file and directory `scripts/`, or if an integration check of imports is needed, create a separate task and add it to `package.json#scripts` + CI.

#### **HIGH** - `import Long = require(\"long\")` in the generated `proto.gen.d.ts`
- **Evidence:** line 2 in `src/proto.gen.d.ts` and `src/proto.gen.js` contains `import Long = require(\"long\")`. The package does not declare `long` in `dependencies` / `devDependencies` (only transitively via `protobufjs`).
- **Impact:** in a strict ESM environment or when using bundlers (vite, esbuild, rollup) this CJS-require can break the consumer build. TypeScript with `moduleResolution: NodeNext` / `Bundler` may not resolve this import without an explicit `long` in the dependencies.
- **Recommendation:**
  1. Add `long` to `devDependencies` (or `dependencies` if the types are needed by consumers).
  2. Or switch to `protobufjs` codegen without `long` (the `--no-long` flag in `pbjs`, if compatibility with 64-bit integers is not critical for the Identity contract - int64 is not used in the spec).
  3. Alternative: replace `import Long = require(...)` with an ESM-compatible synthetic type in the post-generation script.

#### **MEDIUM** - No CI synchronization check `.proto` → `proto.gen.*`
- **Evidence:** `scripts/gen.mjs` is there, but CI/pre-commit does not check that the generated files correspond to the `.proto` sources. A developer can change `.proto`, forget to run `proto:gen`, and commit out-of-sync artifacts.
- **Impact:** drift between `.proto` (source of truth) and committed `src/proto.gen.{js,d.ts}`. This violates the "spec is source of truth" invariant.
- **Recommendation:** add the `proto:gen` + `git diff --exit-code src/proto.gen.*` step (or a similar check) to CI so that it fails when out of sync.

#### **MEDIUM** - `src/index.ts` re-exports primitives from `@rntme/contracts-common-v1`
- **Evidence:** lines 26-35 in `src/index.ts` export `CanonicalRef`, `CommandContext`, `Name`, `ListRequest`, etc. directly from `protoRoot.rntme.contracts.common.v1`.
- **Impact:** Consumers can import common primitives from an identity package, creating an implicit dependency. If the common contract changes (v2), the identity package will become a dual source of truth - some consumers import from common, some from identity. This violates the line of responsibility.
- **Recommendation:** Either remove the common primitive re-exports from `index.ts` (consumers import directly from `@rntme/contracts-common-v1`), or explicitly document that the identity package provides "convenience re-exports" and add a test to check that they are identical to the common exports.

#### **MEDIUM** - Tests do not cover direct exports `src/index.ts`
- **Evidence:** all 19 tests (`entities.test.ts`, `events.test.ts`, `service-shape.test.ts`, `error-codes.test.ts`) access types via `proto.rntme.contracts.identity.v1.*` or `errorCodes`. No test imports `User`, `Organization`, `CanonicalRef` directly from `@rntme/contracts-identity-v1`.
- **Impact:** if `index.ts` breaks (for example, re-exporting common types stops working due to a change in protobufjs generation), it will not be caught by the package's tests.
- **Recommendation:** add a test `test/exports.test.ts` that imports each symbol from `src/index.ts` and checks that it is truthy and has the expected type (`typeof User === 'function'`, etc.).

#### **LOW** — `version: \"0.0.0\"` makes no sense
- **Evidence:** `package.json#version` is `0.0.0`, although the package is private and not published to npm.
- **Impact:** is minimal, but when using `workspace:*` in downstream bundles, the version may appear in the lockfile/bundle analysis.
- **Recommendation:** set `version: \"0.1.0\"` or `\"1.0.0\"` to match contract version `v1`.

#### **LOW** — Missing fields `repository`, `bugs`, `homepage` in `package.json`
- **Evidence:** `package.json` does not contain metadata links to the monorepository.
- **Impact:** There is no quick access to sources when navigating through `npm info` / IDE package viewer.
- **Recommendation:** add standard monorepo fields (see example in `@rntme/contracts-common-v1` - it’s not there either, so this is a workspace-wide pattern that should be recorded in a separate issue).

---

### 3. Quick wins (can be done without a product solution)

1. **Delete `scripts/check-imports.mjs`** and the empty `scripts/` directory if not needed.
2. **Add `long` to `devDependencies`** as an explicit dependency.
3. **Add `test/exports.test.ts`** for direct `index.ts` exports.
4. **Update `version`** from `0.0.0` to `0.1.0`.
5. **Add CI step** `proto:gen` + `git diff --exit-code` to check synchronization.

---

### 4. Solutions requiring Vlad / architectural solution

1. **Re-exports of common primitives from the identity package:** leave them as convenience-exports or force consumers to import from `@rntme/contracts-common-v1`? This is a question of boundaries of responsibility and discoverability of the API.
2. **Strategy `long` / 64-bit integers:** Is `long` needed in the Identity contract? The current specification does not use int64. If you don’t need it, you can switch to `--no-long` in `pbjs` and simplify ESM compatibility.
3. **Versioning policy for contract packages:** `0.0.0` vs semantic versioning, even for private workspace packages.

---

### 5. Compliance with product vision and specifications

- **Specification:** `2026-04-26-identity-canonical-contract-design.md` - fully implemented. 24 RPCs, 6 entities, 17 events, 18 error codes, drift detection in conformance - everything is in place.
- **Product vision:** the package exactly falls into rntme positioning as “safe runtime for AI-generated business workflow apps” - the canonical contract gives agents a bounded target for generating vendor modules.
- **The only architectural risk:** if `@rntme/conformance-framework` does not appear soon, empty stub-scenarios in `modules/identity/conformance/` may become a habit, and the drift between contract and conformance will become less significant than it seems (currently drift-test works, but scenario-content is empty). This is not a problem with the package itself, but a downstream risk.

---

**Result:** the package is architecturally sound, corresponds to the spec and vision. The main risks are dead code, ESM/CJS friction in generated typings, and lack of automatic checking sync proto ↔ generated. All fixes are non-trivial, but do not require rewriting the contract.
