# Architecture audit — `@rntme/deploy-core`

This document mirrors the read-only architecture audit posted on Multica so it can be reviewed offline and linked from the repo.

| | |
|---|---|
| **Multica issue** | `RNT-225` (`7dc6b75d-147d-4197-81e3-a4a40802e9d2`) |
| **Issue title** | Audit: package architecture — @rntme/deploy-core |
| **Package / scope** | `@rntme/deploy-core` |
| **Verdict (summary)** | needs cleanup |
| **Audit comment id** | `7701424f-5442-4314-b9e1-7be46f3fcc18` |
| **Audit comment date** | 2026-04-28 |

---

## Audit report

The sections below reproduce the audit comment body **verbatim** from Multica (formatting preserved).


## Architectural audit @rntme/deploy-core

**Verdict: needs cleanup.** The architecture of the package corresponds to the spec and product vision, the public API is clean, the boundaries of responsibility are respected. However, there are specific problems of code quality and test coverage that need to be addressed before the package begins to grow (production mode, new middleware kinds, multi-environment).

---

### Problems by severity

#### medium - Code duplication in edge.ts (middleware dispatch)
- **Evidence:** src/edge.ts:167–220 - four almost identical blocks for request-context, rate-limit, body-limit, timeout.
- **Impact:** Adding a new middleware kind (for example, auth when it is supported) will require copy-paste of the fifth block. There is a risk of forgetting to update one of the blocks when the general logic changes (for example, adding path to an error).
- **Recommendation:** Make a generic dispatch: after isSupportedMiddlewareKind, make a single call resolvePolicy(decl.kind, ...) and push in planned without switch by kind. The MiddlewarePolicyByKind type already allows you to do this.

#### medium — Dead addiction zod
- **Evidence:** package.json:22 - "zod": "^4.0.0" in dependencies. grep -r zod src/ test/ - zero uses.
- **Impact:** Extra runtime dependency, confuses the reader (you expect runtime validation, but there is none), slows down the install.
- **Recommendation:** Either remove from dependencies (if validation at the level of structural types is an informed choice), or add Zod schemas for ComposedProjectInput and ProjectDeploymentConfig and validate the input before scheduling. This is a product solution.

#### medium — Insufficient unit test coverage
- **Evidence:** 12 tests, all in test/unit/. No tests for:
  - body-limit and timeout middleware (only request-context and rate-limit are covered);
  - empty project (services: {});
  - duplicate service slug in project.services;
  - simultaneous failure of several policy values;
  - orgSlug with spaces (only trim() === '' is checked, but not whitespace-only);
  - runtimeImage override;
  - warnings (now always [], but the DeploymentWarning type is public).
- **Impact:** Regressions when adding new features will not be caught at the level of this package.
- **Recommendation:** Add tests for the listed scenarios. Minimum: cover all 4 supported middleware kinds and empty/edge-case inputs.

#### low — Redundant check in plan.ts
- **Evidence:** src/plan.ts:116 — if (errors.length > 0 || config.eventBus === undefined). If eventBus === undefined, the DEPLOY_PLAN_MISSING_EVENT_BUS error is already added to errors on line 104–110, so errors.length > 0 is already true. The second part of the OR is redundant.
- **Impact:** Minimal, but confuses the reader - it gives the impression that there is an edge case that the first part does not cover.
- **Recommendation:** Simplify to if (errors.length > 0).

#### low — DeploymentPlanError is not type-safe by context
- **Evidence:** src/errors.ts:17–25 - one structure with optional fields path, service, route, middleware, policy. It is impossible to express at the type level that DEPLOY_PLAN_ROUTE_TARGET_MISSING_WORKLOAD must have service and route, and DEPLOY_PLAN_MISSING_ORG_SLUG must have path.
- **Impact:** Downstream code may rely on fields that are not guaranteed. It's easy to forget to fill in the relevant field when adding a new error code.
- **Recommendation:** Consider a discriminated union by code, where each code has its own required fields. This is a breaking change for consumers, and therefore requires a separate follow-up.

#### low - passWithNoTests: true in vitest.config.ts
- **Evidence:** vitest.config.ts:9.
- **Impact:** If all test files accidentally disappear or are excluded, CI will not crash.
- **Recommendation:** Remove this option. The package already has tests, so false positives are not expected.

#### low — No runtime validation of input data
- **Evidence:** buildProjectDeploymentPlan accepts ComposedProjectInput and ProjectDeploymentConfig as plain structural types. There is no check that project.services is not null/undefined, that slugs do not contain invalid characters, that routes.ui and routes.http do not conflict in path.
- **Impact:** Invalid input from the caller (for example, a bug in @rntme/blueprint or platform-http executor) can lead to strange runtime errors instead of readable DEPLOY_PLAN_* errors.
- **Recommendation:** Add defensive checks to the input (or Zod schemes, if we are solving the medium problem with the Zod above).

---

### Compliance with the spec and product vision

- **Spec:** docs/history/specs/historical/2026-04-24-project-deployment-pipeline-design.md - the package implements solutions D1–D36 correctly. The core/adapter/frontend boundaries are respected.
- **Product vision:** The package strengthens the positioning of rntme as a repeatable deployable infrastructure for AI-generated projects. Target-neutral planning will allow future adapters (Fly.io, Railway) to reuse deploy-core without changes.

---

### Quick wins (can be done without a product solution)

1. Remove passWithNoTests: true.
2. Simplify if in plan.ts.
3. Refactor duplication in edge.ts (single dispatch loop).
4. Add the missing unit tests for body-limit, timeout, empty project, runtimeImage override.

### Require Vlad's decision

1. **Delete or use zod?** If validating inputs through structural types is a conscious choice, remove the dependency. If you want runtime validation, add Zod schemes.
2. **Type safety DeploymentPlanError?** Transition to discriminated union - breaking change. Is it needed now or should it be postponed until the API stabilizes?
3. **What test coverage threshold should I set?** Now 12 tests are enough for an MVP, but is a formal coverage gate necessary (for example, 80%)?

---

### Files to which the recommendations apply

- src/edge.ts — dispatch loop refactoring
- src/plan.ts — remove redundant checks
- src/errors.ts — type safety of errors (by decision)
- package.json — zod dependency
- vitest.config.ts — passWithNoTests
- test/unit/plan.test.ts, test/unit/edge.test.ts — add tests

Read-only audit. PR has not been created.
