# Known Issues — `@rntme/issue-tracker-api-demo`

Status: **deferred** — the demo boots and the event-sourced write side works end-to-end, but several read-side endpoints 500 and one 400s on the happy path. Fixing them properly requires two upstream pieces of work that we've chosen to scope separately:

1. a principled seed / reference-data design in `@rntme/runtime` (or elsewhere);
2. a fix to `wrapPredicateOptional` in `@rntme/graph-ir-compiler`.

Until both land, this document is the authoritative catalogue of what's broken and why. The demo README links here from its "Run it" section.

**Last verified against HEAD:** 2026-04-15.

---

## What works today

- HTTP boot on `:3000` (or `RNTME_HTTP_PORT`).
- `GET /`, `GET /health`, `GET /metrics`, `GET /openapi.json`, `GET /ui`.
- Full write side: `report → submit → assign → reassign → resolve → reopen → assign → resolve → close`. Every command returns `{ aggregateId, version, eventIds }`; events flow through the relay → projection consumer → `projection_issue`.
- Concurrency + guard errors: `422 COMMAND_ILLEGAL_TRANSITION`, `409 COMMAND_CONCURRENCY_CONFLICT`, `400 VALIDATION_ERROR`.
- `assign-with-guard` (read-prelude capacity gate).
- `GET /v1/issues`, `GET /v1/ui/issues` (projection reads that do not traverse any relation).

## What's broken

### 1. Reference-JOIN endpoints return 500 — missing `projects` / `users` / `sprints` tables

Affected routes:

| Route | Graph | Missing tables |
|---|---|---|
| `GET /v1/issues/:id` | `issueDetail` | `projects`, `users` |
| `GET /v1/stats/by-project` | `issuesByProject` | `projects` |

**Symptom:** `500 {"code":"INTERNAL_ERROR"}`. Server-side error (surfaced via a temporary `onError` hook during triage): `Error: no such table: projects` (or `users`).

**Root cause:** The PDM (`artifacts/pdm.json`) declares `Project`, `User`, `Sprint` as reference entities with relations from `Issue`. The QSM (`artifacts/qsm.json`) only declares an entity-mirror projection for `Issue` (`projection_issue`). `@rntme/graph-ir-compiler`'s `chainToSqlJoins` (see `packages/graph-ir-compiler/src/lower/sqlite/joins.ts:48`) lowers every relation traversal to a `LEFT JOIN <pdm.entities[target].table>`, so `issue.project.key` compiles to a join against a table named `projects` — which the runtime never creates and nothing populates.

**Why we can't just add QSM projections for Project/User/Sprint:** projections materialise from events, but there are no commands (or state machine transitions) for these reference entities in the PDM. They're conceptually *reference data*, not event-sourced aggregates, so nothing would ever write rows. Closing this gap properly means introducing a seed / fixtures mechanism.

### 2. `GET /v1/issues/search` — `from` and `to` are required, README suggests otherwise

**Symptom:** calling `?q=foo` alone returns `400 VALIDATION_ERROR` with `path=from` / `path=to` / `code=invalid_type`. The current README note about "predicate-optional params" is misleading for this endpoint.

**Root cause:** `artifacts/graphs/searchIssues.json` declares `q`, `from`, `to` as `"mode": "required"` (only `priority` is `predicate_optional`, `limit` is `defaulted`). The HTTP binding faithfully builds a Zod schema from the graph signature, so Zod rejects a request without the two required timestamps.

This is a **docs-vs-artifact mismatch**, not a runtime bug. It would be a one-line artifact edit (flip `from`/`to` to `defaulted` with wide bounds like `1970-01-01T00:00:00.000Z` / `9999-12-31T23:59:59.999Z`). Bundled with the rest of the deferred demo changes (see below) rather than landing alone.

### 3. `wrapPredicateOptional` — latent correctness bug in the compiler

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

### 4. README example for `/resolve` is stale

`README.md` shows:

```bash
curl -s -X POST .../v1/issues/7001/actions/resolve -H 'x-actor-id: alice' -d '{}' | jq
```

The current PDM requires `resolvedAt` on the `resolve` transition, so the example returns `400 VALIDATION_ERROR` with `path=resolvedAt`. Passing `-d '{"resolvedAt":"<iso-8601>"}'` works.

Trivial to fix; bundled with the other README changes below.

---

## Deferred fix — what a full resolution looks like

Once the two upstream pieces below land, the demo-side change is small and mechanical:

1. **Seed mechanism in `@rntme/runtime` (or a deliberately chosen alternative).** A declarative way to populate reference tables at boot, idempotent against re-starts, and correctly interleaved with QSM bootstrap and the event pipeline. We considered three in-band options during brainstorming (full runtime `seed.json` loader, tiny `beforeHttpStart` lifecycle hook, demo-side composition of internals) and deferred the choice until the feature can be designed in isolation rather than under demo-fix pressure.
2. **Compiler fix for `wrapPredicateOptional`** (see Finding 3).

Once both are in place, the demo-side changes are:

- Add QSM entity-mirror projections for `Project`, `User`, `Sprint`. Their `"table"` field **must** equal the PDM `table` value (`projects`, `users`, `sprints`) — not `projection_project` etc. — because `chainToSqlJoins` joins against the PDM table name, not the projection name. Scan and JOIN must end up at the same table.
- Add `artifacts/seed.json` with a small set of Projects, Users, Sprints whose ids match those used in demo curls / smoke tests.
- Flip `from`/`to` in `searchIssues.json` to `"mode": "defaulted"` with wide bounds, so `?q=foo` works without dates.
- Update the `/resolve` curl example in the README.
- Extend `test/smoke.test.ts` to exercise all query endpoints (not just `/health` + `/openapi.json`).

---

## Running the demo today — what you can exercise

Everything in "What works today". If you `curl` the broken endpoints you'll get `500` (Findings 1) or `400` (Finding 2). The SPA at `/ui` will render the "recent issues" list (which uses `listIssuesUi`, not `issueDetail`), but opening a single issue in the SPA hits `issueDetail` and will show the error state.

If you want a local short-term workaround without waiting for the proper fix, the quickest is:

1. Create `projects`, `users`, `sprints` tables manually after startup by attaching to the SQLite DB via the running process — only viable with `persistence.mode: "persistent"` in `artifacts/manifest.json`.
2. Or: monkey-patch `src/server.ts` to pull `qsmDb` out of runtime internals and `INSERT` rows before the first request. This is exactly the shape of the deferred seed feature.

Neither workaround is recommended for anything other than a one-off local exploration.

---

## References

- Memory: `rntme_predicate_optional_bug.md` — upstream analysis of Finding 3 (code re-verified 2026-04-15; matches this document).
- Memory: `rntme_turso_target.md` — relevant to the seed design: whatever we build must stay SQLite-compatible for the planned Turso migration.
- Compiler: `packages/graph-ir-compiler/src/lower/sqlite/lower.ts:159-177`, `packages/graph-ir-compiler/src/lower/sqlite/joins.ts:48`, `packages/graph-ir-compiler/src/validate/semantic/sources.ts:37`.
- Runtime: `packages/runtime/src/start/start-service.ts`, `packages/runtime/src/start/wire-event-pipeline.ts`.
- Demo artifacts: `demo/issue-tracker-api/artifacts/{pdm,qsm,bindings}.json`, `demo/issue-tracker-api/artifacts/graphs/{issueDetail,issuesByProject,searchIssues}.json`.
