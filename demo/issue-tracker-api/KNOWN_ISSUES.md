# Known Issues — `@rntme/issue-tracker-api-demo`

> **Deprecated historical reference.** This file tracks a single-service demo kept for runtime history and smoke tests. It is not the canonical project-first example; new docs should point to validated project blueprint folders.

Status: **all resolved** — the demo boots with declarative seeding and all previously tracked issues are now closed. The **compiler** issue (`wrapPredicateOptional` in `@rntme/graph-ir-compiler`) has been fixed; see Finding 3 below. The demo README links here from its "Run it" section.

**Last verified against HEAD:** 2026-04-16.

---

## What works today

- HTTP boot on `:3000` (or `RNTME_HTTP_PORT`).
- `GET /`, `GET /health`, `GET /metrics`, `GET /openapi.json`, `GET /ui`.
- Full write side: `report → submit → assign → reassign → resolve → reopen → assign → resolve → close`. Every command returns `{ aggregateId, version, eventIds }`; events flow through the relay → projection consumer → `projection_issue`.
- Concurrency + guard errors: `422 COMMAND_ILLEGAL_TRANSITION`, `409 COMMAND_CONCURRENCY_CONFLICT`, `400 VALIDATION_ERROR`.
- `assign-with-guard` (read-prelude capacity gate).
- `GET /v1/issues`, `GET /v1/ui/issues` (projection reads that do not traverse any relation).
- **Declarative seed:** [`artifacts/seed.json`](./artifacts/seed.json) is loaded by `@rntme/runtime` (see manifest `seed` options) using `@rntme/seed`, after PDM/QSM validation, so reference entities (`Project`, `User`, `Sprint`) are populated through the normal event → projection path. Design: [`docs/superpowers/specs/done/2026-04-15-runtime-seed-design.md`](../../docs/superpowers/specs/done/2026-04-15-runtime-seed-design.md).
- **Seeded aggregate mutations:** Commands against seeded issues (7001–7011) work correctly — `wrapPayloads()` in `@rntme/seed` normalizes flat seed payloads to `{before, after}` format during validation, so `replayAggregateState()` reconstructs state correctly.

## What's broken

### 1. Reference-JOIN endpoints return 500 — missing `projects` / `users` / `sprints` tables — **CLOSED**

**Resolution:** The `@rntme/seed` package and runtime integration apply a validated `seed.json` of event envelopes before the relay starts; the demo’s PDM declares reference aggregates whose events project into QSM tables named like the PDM `table` fields (`projects`, `users`, `sprints`), so `chainToSqlJoins` can resolve `issue.project.key` and related paths. The catalogue of seeded streams lives in [`artifacts/seed.json`](./artifacts/seed.json). For behaviour and invariants, see [`docs/superpowers/specs/done/2026-04-15-runtime-seed-design.md`](../../docs/superpowers/specs/done/2026-04-15-runtime-seed-design.md).

### 2. `GET /v1/issues/search` — `from` and `to` are required, README suggests otherwise — **CLOSED**

**Resolution:** [`artifacts/graphs/searchIssues.json`](./artifacts/graphs/searchIssues.json) now uses `"mode": "defaulted"` for `from` and `to` with wide bounds; the HTTP binding and [`demo/issue-tracker-api/README.md`](./README.md) describe optional range parameters consistent with the artifact.

### 3. `wrapPredicateOptional` — latent correctness bug in the compiler — **CLOSED**

**Resolution:** Swapped OR argument order in `wrapPredicateOptional` (`args: [acc, isNull]`) so inner `?` precedes guard `?` in emitted SQL, aligning with `paramOrder` push order. Regression tests added at unit and e2e level with mixed required + predicate_optional params.

**Where:** `packages/graph-ir-compiler/src/lower/sqlite/lower.ts:159-177`.

**The bug:** `wrapPredicateOptional` wraps an inner predicate SQL expression as `(? IS NULL) OR (<inner>)` and appends the guard param to `paramOrder` **after** all inner params are already pushed. better-sqlite3 (and SQLite generally) binds `?` placeholders by walk-order of the SQL text, not by array index — so the guard `?` on the left of the `OR` resolves to the *first* value in `paramOrder`, not the last. Whenever the surrounding filter contains any `$param` other than the predicate-optional one, the guard silently binds to the wrong value and the filter's semantics collapse.

**Why existing tests don't catch it:** the current unit (`test/unit/lower/sqlite/predicate-optional.test.ts`) and e2e (`test/e2e/predicate-optional.e2e.test.ts`) suites exercise filters with *only* predicate-optional params, in which case every `?` binds to the same scalar and the misalignment is invisible.

**How it hit this demo:** the original `searchIssues` graph used a single filter combining `like q`, `between from/to`, and `eq priority-predicate_optional`. The `paramOrder` came out as `[q, from, to, priority, priority, limit]` but the SQL emitted the guard `?` before the inner predicate body, causing the `IS NULL` check to read `q` and the `priority =` check to read `q` as well. Queries returned zero rows.

**Current workaround in this demo's artifact:** `artifacts/graphs/searchIssues.json` already splits the predicate into two sequential `filter` nodes (`baseFiltered` + `priorityFiltered`) so the single predicate-optional param lives alone in its node, hiding the bug. That workaround works but is fragile — anyone adding a second predicate-optional param into the same filter will rediscover the broken behaviour.

**Fixes under consideration** (all compiler-side, not demo-side):

- Swap the OR argument order in the emitted expression (`args: [inner, isNull]`) so the inner SQL is walked before the guard and param positions line up.
- Or: push the guard param onto `paramOrder` **before** recursing into inner params.
- Either way, add a regression test with mixed (required × predicate-optional) params.

This fix belongs in `@rntme/graph-ir-compiler` and is out of scope here.

### 4. README example for `/resolve` is stale — **CLOSED**

**Resolution:** [`README.md`](./README.md) documents `POST .../resolve` with a JSON body including `resolvedAt`, matching the PDM transition payload.

---

## Deferred fix — remaining upstream work

All upstream items for this demo are now resolved. The compiler fix for `wrapPredicateOptional` landed in `@rntme/graph-ir-compiler`. The demo’s `searchIssues` graph workaround (split filter nodes) remains valid but is no longer required.

---

## Running the demo today — what you can exercise

Everything in "What works today". The SPA at `/ui` can list and open issues; JOIN-backed routes are satisfied by seeded projection rows. If you need to disable seeding for experiments, set `seed.enabled` to `false` in `artifacts/manifest.json` (see runtime seed options in [`docs/superpowers/specs/done/2026-04-15-runtime-seed-design.md`](../../docs/superpowers/specs/done/2026-04-15-runtime-seed-design.md)).

---

## References

- Memory: `rntme_predicate_optional_bug.md` — upstream analysis of Finding 3 (code re-verified 2026-04-15; matches this document).
- Memory: `rntme_turso_target.md` — relevant to the seed design: whatever we build must stay SQLite-compatible for the planned Turso migration.
- Compiler: `packages/graph-ir-compiler/src/lower/sqlite/lower.ts:159-177`, `packages/graph-ir-compiler/src/lower/sqlite/joins.ts:48`, `packages/graph-ir-compiler/src/validate/semantic/sources.ts:37`.
- Runtime: `packages/runtime/src/start/start-service.ts`, `packages/runtime/src/start/wire-event-pipeline.ts`.
- Seed: `packages/seed/README.md`, `packages/runtime/src/load/load-service.ts`.
- Demo artifacts: `demo/issue-tracker-api/artifacts/{pdm,qsm,bindings,seed}.json`, `demo/issue-tracker-api/artifacts/graphs/{issueDetail,issuesByProject,searchIssues}.json`.
