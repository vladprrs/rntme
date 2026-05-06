# Current Audit Priorities

> Snapshot date: 2026-05-04.
>
> Source ledger: [`00-waves.md`](./00-waves.md). This document is an
> operator-facing reorder of active audit units. It intentionally does not
> follow raw audit severity alone.

## Selection Rule

The current product goal is not "clean every high-severity audit finding".
The near-term proof point is: a project blueprint can be authored by an agent,
published, deployed, logged into, and used as a working app without manual
repair. For that reason, tasks are ranked by how directly they protect:

1. validated blueprint correctness;
2. fail-fast UI / binding compilation;
3. deploy reliability and diagnosability;
4. platform/runtime data correctness;
5. later architectural cleanup.

Closed, obsolete, and rejected units from `00-waves.md` are excluded. Some rows
combine multiple audit units when the correct fix should land as one PR.

## Sorted List

No active code-work rows remain in this snapshot. The previous remaining rows
were retired to the deferred backlog because their own fix shapes require a
future trigger instead of standalone churn.

| Rank | Priority | Units | Area | Why This Matters Now | Expected Fix Shape |
|---:|---|---|---|---|---|

## Suggested Work Packages

### Package A: Blueprint/UI Fail-Fast — closed 2026-05-04

Units: U-048, U-050, U-319, U-320, U-321, U-322.

Closed by `docs/superpowers/plans/done/2026-05-04-audit-package-a-blueprint-ui-fail-fast.md`.
Evidence: `BLUEPRINT_SERVICE_JSON_MALFORMED`, strict project-aware UI
route/component validation, Zod parse schemas, `DUPLICATE_SCREEN_KEY`, and
missing-`httpMap` `EMIT_FAILED` tests.

### Package B: UI Runtime Confidence — closed 2026-05-04

Units: U-341, U-344, then optionally U-342.

Closed by `docs/superpowers/plans/done/2026-05-04-audit-package-b-ui-runtime-confidence.md`.
Evidence: React 19 type packages aligned, registry dispatch tests added,
identity boot fallback now asserts `/auth/user = null`, boot errors are asserted
through `/runtime/bootErrors`, and `@rntme/ui-runtime` test/build pass.

### Package C: Deploy Safety And Logs — closed 2026-05-04

Closed units: U-114, U-079, U-078.

Remaining units: none.

Closed by `docs/superpowers/plans/done/2026-05-04-audit-platform-http-unhandled-error-logging.md`
and `docs/superpowers/plans/done/2026-05-04-audit-deploy-dokploy-partial-apply-cleanup.md`
and `docs/superpowers/plans/done/2026-05-04-audit-deploy-dokploy-resource-comparison.md`.
Evidence: unhandled exceptions now flow through `app.onError(errorHandler(deps.logger))`,
log request metadata plus `err`, and return a sanitized `PLATFORM_INTERNAL`
response. Partial Dokploy apply failures now delete resources created earlier in
the same attempt, record `partialFailure.cleanup`, retain updated-resource
metadata without rollback, and mark `retrySafe=false` when cleanup fails.
Dokploy resource comparison now uses typed application/compose comparators; env,
labels, files, ports, and ingress routes are order-insensitive where order is
not meaningful, while real field drift still triggers updates.

### Package D: Runtime Boundary Hygiene — closed 2026-05-04

Closed units: U-031, U-355, U-289, U-288, U-293.

Remaining units: none.

Closed by `docs/superpowers/plans/done/2026-05-04-audit-runtime-boundary-hygiene-bindings-http.md`
and `docs/superpowers/plans/done/2026-05-04-audit-runtime-config-validation.md`
and `docs/superpowers/plans/done/2026-05-04-audit-runtime-actor-validation.md`
and `docs/superpowers/plans/done/2026-05-04-audit-runtime-derived-projection-validation-boundary.md`.
Evidence: `BindingsRouterOptions` / `buildPlan` now consume `RuntimeGraphSpec`,
`ValidatedPdm`, and `ValidatedQsm`; missing runtime dependencies now throw
`BindingsRuntimeError` with `BINDINGS_HTTP_STARTUP_MISSING_RUNTIME_DEPENDENCY`.
`startService` now validates runtime config before boot, exposes
`validateRuntimeConfig`, and rejects invalid plugin shapes or contradictory seed
options with `RuntimeConfigError`. Actor extraction now validates
`auth.actorKind`, trims safe actor IDs, and drops invalid header values instead
of stamping them into events. Derived projection validation now calls
`compileProjectionGraphFromValidated` with parsed Graph IR, `ValidatedPdm`, and
`ValidatedQsm`; raw PDM/QSM input slots are rejected by a type fixture.

### Package E: Platform Storage Data Correctness — closed 2026-05-04

Closed units: U-132.

Closed by `docs/superpowers/plans/done/2026-05-04-audit-platform-storage-result-transaction-rollback.md`.
Evidence: `withTransaction` now rolls back when callbacks return the platform
`Result.err` shape, returns the error result unchanged, and has unit coverage
for `ROLLBACK` instead of `COMMIT`; a deploy-target integration regression is
present for container-enabled environments.

### Package F: Event Store Data Integrity — closed 2026-05-04

Closed units: U-363.

Closed by `docs/superpowers/plans/done/2026-05-04-audit-event-store-actor-kind-check.md`.
Evidence: `event_log.actor_kind` is enforced by a SQLite `CHECK`, valid D9
legacy tables without the check are rebuilt in place, and corrupted legacy rows
fail schema application with `EVENT_STORE_SCHEMA_INCOMPATIBLE`.

### Package G: QSM DDL Bootstrap Coverage — closed 2026-05-04

Closed units: U-275.

Closed by `docs/superpowers/plans/done/2026-05-04-audit-qsm-ddl-bootstrap-integration.md`.
Evidence: QSM now has `test/integration/ddl-bootstrap.test.ts`, which validates
realistic fixtures, emits projection DDL, applies it to in-memory SQLite, and
asserts explicit tables, omitted-table fallback, indexes, idempotency columns,
resolver/table alignment, and composite-key DDL.

### Package H: UI Validation Consistency — closed 2026-05-04

Closed units: U-323, U-324, U-326.

Closed by `docs/superpowers/plans/done/2026-05-04-audit-ui-validation-consistency.md`.
Evidence: UI validation now emits `BINDING_KIND_MISMATCH` when optional binding
kind metadata conflicts with data/query or command/action usage, `TYPE_MISMATCH`
for literal component prop schema mismatches, and `UNCOVERED_INPUT` for
uncovered data/action input state paths. Focused validator coverage exercises
all three codes.

### Package I: Runtime Shutdown Timeout — closed 2026-05-04

Closed units: U-292.

Closed by `docs/superpowers/plans/done/2026-05-04-audit-runtime-shutdown-timeout.md`.
Evidence: `RunningService.stop()` now uses a validated `shutdownTimeoutMs`
budget, starts with graceful `server.close()`, closes idle connections when
available, force-closes active HTTP connections after the timeout, and has a
regression test for a request handler that never resolves.

## Retired From Current Priority

These rows were previously listed above but are no longer current-priority work:

- U-029 — keep parked; split `command-handler.ts` when a concrete command
  behavior change touches that file.
- U-111 — keep parked; extract `createApp` wiring when another platform HTTP
  change needs that area.
- U-112 — keep parked; move the deploy executor out of the HTTP process only
  after deploy semantics/logging are stable and a worker/queue design exists.
- U-002 — keep parked; revisit the runtime package split after project-level
  runtime intake and plugin seams stabilize.
- U-003 — keep parked; extract shared executor contracts when touching
  gRPC/bindings runtime boundaries.
- U-004 — closed against the standing dependency-upgrade deferral spec
  (`docs/superpowers/specs/2026-04-30-dependency-upgrade-deferral-design.md`).

## Explicitly Deprioritized For Now

The following parked findings are real but should not drive the next work wave
unless they block CI, a live deploy, or a planned feature:

- Monorepo dependency topology cleanup: U-002, U-003, U-005, U-006, U-007.
- Broad SRP refactors without behavior change: U-029, U-111.
- Deploy executor process split: U-112.
- Version `0.0.0` cleanup across packages: covered by future release/versioning
  policy, not a demo blocker.
- Generic coverage gates across every package: useful later, noisy before the
  high-risk validation paths above are fixed.
- Landing-site audit findings: not on the critical path for blueprint deploy
  correctness.

## Notes For Future Triage

- If a task can make an invalid blueprint pass validation, it should outrank
  cleaner architecture work.
- If a task makes a failed deployment hard to diagnose, it should outrank
  non-user-visible cleanup.
- If a task only matters at "many services / many contributors" scale, keep it
  below the first repeatable blueprint deploy path unless it is already causing
  failures.
