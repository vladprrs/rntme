# @rntme/issue-tracker-api-demo

End-to-end demo: a small issue-tracker REST API + SPA wired from four JSON artifacts (PDM, QSM, bindings, graphs) plus a seed stream and a UI tree — all driven through `@rntme/runtime` with zero hand-written wiring. Exercises every package in the monorepo.

## Role in the system

- Depends on: `@rntme/runtime` (runtime import) — which transitively depends on every other `@rntme/*` package (pdm, qsm, event-store, graph-ir-compiler, bindings, bindings-http, projection-consumer, seed, ui, ui-runtime).
- Consumed by: nothing. This is a leaf application, not a library.
- Position in pipeline: reference consumer. Loads authored JSON artifacts → boots an event-sourced write side, a projection read side, a Hono HTTP surface, and a json-render SPA.
- Why it exists: the entry point for "how does X get wired up end-to-end" questions. Also copied into `packages/runtime/test/fixtures/issue-tracker/` as the fixture for the runtime's own e2e suite.
- Boundary: no hand-written wiring. `src/server.ts` calls `loadService(dir)` then `startService(loaded)` — every other behaviour is driven by the four JSON artifacts + `seed.json` + the `ui/` tree.

## File map

Two sub-trees — `src/` is a 23-line bootstrap; `artifacts/` is the entire authoring surface.

```
src/
  server.ts                                       (entry) loadService + startService + SIGINT/SIGTERM wiring. ~20 lines.

artifacts/
  manifest.json                                   Runtime config — rntmeVersion, service name/version, HTTP port.
  pdm.json                                        Four entities (Issue, Project, Sprint, User), each with stateMachine + relations.
  qsm.json                                        Four entity-mirror projections (IssueView + project/user/sprint mirrors) + relation metadata.
  shapes.json                                     Custom output shapes: IssueDetail, IssueListItem, ProjectStats, BurndownBucket, LoadCount.
  bindings.json                                   OpenAPI-producing HTTP bindings — 14 operations, one per graph.
  seed.json                                       Deterministic event stream — seeds users, projects, sprint, issues 7001–7011.
  graphs/
    listIssues.json                               Query — paginated list + status filter + JOIN enrichment (project/reporter/assignee/sprint names).
    listIssuesUi.json                             Query — UI-friendly list (no predicate_optional params) + JOIN enrichment.
    searchIssues.json                             Query — LIKE on title + date range + optional priority + JOIN enrichment.
    issueDetail.json                              Query — single-row fetch by id + JOIN to project/reporter/assignee.
    issuesByProject.json                          Query — reduce(group=projectKey, count/sum/avg storyPoints).
    sprintBurndown.json                           Query — filter by sprintId + reduce(group=status, count/sum storyPoints).
    reportIssue.json                              Command — emit `report` transition (creation).
    submitIssue.json                              Command — emit `submit` transition (draft → open).
    assignIssue.json                              Command — emit `assign` (open → in_progress).
    assignIssueWithCapacityGuard.json             Command — read-prelude capacity count + `assign` emit, guard `< 3`.
    reassignIssue.json                            Command — emit `reassign` (in_progress self-loop).
    resolveIssue.json                             Command — emit `resolve` (in_progress → resolved).
    reopenIssue.json                              Command — emit `reopen` (resolved → open).
    closeIssue.json                               Command — emit `close` (resolved → closed).
  ui/
    manifest.json                                 UI v2 manifest — layouts, routes (/issues, /issues/browse, /issues/new, /issues/search, /issues/:id, /sprints/:sprintId).
    fragments/
      command-button.spec.json                    Parameterized Button + dispatch action fragment ($param: label, variant, actionName).
      command-with-input.spec.json                Input + Button fragment for commands that take one body field.
    layouts/
      main.screen.json                            Persistent nav bar screen JSON (binding references, action map).
      main.spec.json                              Persistent nav bar spec (json-render element tree).
    screens/
      issues-home.screen.json                     Home — issuesByProject stats + nav links. Binding references.
      issues-home.spec.json                       Home — Card + Badge tree.
      issues-browse.screen.json                   Browse — listIssuesUi binding + actions.
      issues-browse.spec.json                     Browse — repeat over rows.
      issues-new.screen.json                      New — reportIssue command mapping.
      issues-new.spec.json                        New — Input($bindState) + Button tree.
      issues-search.screen.json                   Search — searchIssues binding + q/priority/limit inputs.
      issues-search.spec.json                     Search — Input + Button + repeat(results).
      issue-detail.screen.json                    Detail — issueDetail binding + lifecycle command map.
      issue-detail.spec.json                      Detail — fields + fragment(command-button) per lifecycle action.
      sprint-burndown.screen.json                 Sprint — sprintBurndown binding.
      sprint-burndown.spec.json                   Sprint — Card per bucket.

test/
  smoke.test.ts                                   Subprocess boot on :3011 + /openapi.json + /ui list + /stats + /search + POST /v1/issues.
  seed-e2e.test.ts                                Subprocess boot on :3012 + assign 7004 + submit 7005 + illegal-transition 7001 + burndown sprint 1.
  list-enrichment-e2e.test.ts                     Subprocess boot on :3013 + asserts projectKey/reporterUsername/sprintName appear on list + search rows.

Dockerfile                                        FROM ghcr.io/vladprrs/rntme-runtime:1.0 + COPY artifacts /srv/artifacts.
package.json                                      Scripts: start (tsx), start:runtime-cli (rntme-runtime CLI), test (vitest), typecheck (tsc --noEmit).
tsconfig.json                                     TS project config.
vitest.config.ts                                  Vitest config.
KNOWN_ISSUES.md                                   Historical fix log (status: all resolved). Cross-referenced below.
```

## Quick start

### Run the demo locally

Requirements: Node.js ≥ 20, pnpm ≥ 9.

From the repository root:

```bash
pnpm install                                      # once
pnpm -F @rntme/issue-tracker-api-demo start       # tsx src/server.ts
```

The runtime binds the port from `artifacts/manifest.json` (`surface.http.port`, default `3000`). Override with `RNTME_HTTP_PORT`.

```bash
RNTME_HTTP_PORT=4000 pnpm -F @rntme/issue-tracker-api-demo start

# Equivalent via the runtime CLI:
pnpm -F @rntme/issue-tracker-api-demo start:runtime-cli
```

Smoke-test URLs once the server is up:

```bash
curl http://localhost:3000/health                 # runtime health probe
curl http://localhost:3000/api/openapi.json       # generated OpenAPI 3.1 document
curl http://localhost:3000/api/v1/ui/issues       # seeded rows (listIssuesUi)
curl http://localhost:3000/api/v1/issues/7001     # seeded issue, fully resolved lifecycle
open  http://localhost:3000/ui                    # SPA (json-render + shadcn)
```

Seed behaviour: `artifacts/seed.json` is replayed on boot via `@rntme/seed` before the relay starts, so the read model contains users 1–3, projects 1–2, sprint 1, and issues 7001–7011. Disable by setting `seed.enabled: false` in `artifacts/manifest.json`.

Persistence: the runtime defaults to `:memory:` SQLite for both event log and projection DB. Set `persistence.mode: "persistent"` + `eventStorePath` + `qsmPath` in `artifacts/manifest.json` for on-disk storage.

Tests:

```bash
pnpm -F @rntme/issue-tracker-api-demo test        # vitest run (smoke + seed-e2e + list-enrichment-e2e)
pnpm -F @rntme/issue-tracker-api-demo typecheck   # tsc --noEmit
```

Run in Docker (artifacts baked in):

```bash
docker build -t issue-tracker-api-demo:dev .
docker run --rm -p 3000:3000 issue-tracker-api-demo:dev
```

Or mount artifacts into the base runtime image:

```bash
docker run --rm -p 3000:3000 \
  -v "$(pwd)/artifacts:/srv/artifacts:ro" \
  ghcr.io/vladprrs/rntme-runtime:1.0
```

## API

HTTP routes are produced by `@rntme/bindings-http` from `artifacts/bindings.json`. The OpenAPI document is served at `GET /api/openapi.json`.

| Method & path | Graph | Purpose |
| ------------- | ----- | ------- |
| `GET  /api/v1/ui/issues?limit=` | `listIssuesUi` | Recent issues, enriched. No `predicate_optional` params (UI-safe). |
| `GET  /api/v1/issues?status=&limit=` | `listIssues` | Paginated list with optional status filter + JOIN enrichment. |
| `GET  /api/v1/issues/:id` | `issueDetail` | Single issue + project/reporter/assignee names. |
| `GET  /api/v1/issues/search?q=&from=&to=&priority=&limit=` | `searchIssues` | LIKE + date range (optional) + optional priority + JOIN enrichment. |
| `GET  /api/v1/stats/by-project` | `issuesByProject` | Reduce: count + totalStoryPoints + avgStoryPoints per `projectKey`. |
| `GET  /api/v1/sprints/:sprintId/burndown` | `sprintBurndown` | Reduce: count + totalStoryPoints per status, filtered by sprintId. |
| `POST /api/v1/issues` | `reportIssue` | Creation — `report` transition. |
| `POST /api/v1/issues/:issueId/actions/submit` | `submitIssue` | `draft → open`. |
| `POST /api/v1/issues/:issueId/actions/assign` | `assignIssue` | `open → in_progress`. |
| `POST /api/v1/issues/:issueId/actions/assign-with-guard` | `assignIssueWithCapacityGuard` | Read-prelude capacity guard (`< 3` in-progress for assignee). |
| `POST /api/v1/issues/:issueId/actions/reassign` | `reassignIssue` | `in_progress` self-loop. |
| `POST /api/v1/issues/:issueId/actions/resolve` | `resolveIssue` | `in_progress → resolved` (body: `resolvedAt`). |
| `POST /api/v1/issues/:issueId/actions/reopen` | `reopenIssue` | `resolved → open`. |
| `POST /api/v1/issues/:issueId/actions/close` | `closeIssue` | `resolved → closed`. |
| `GET  /api/openapi.json` | — | Generated OpenAPI 3.1 document. |
| `GET  /health` | — | Runtime health probe (owned by `@rntme/runtime`). |
| `GET  /metrics` | — | Runtime metrics endpoint (owned by `@rntme/runtime`). |
| `GET  /` | — | JSON service identity `{ name, version }`. |
| `GET  /ui` | — | SPA shell + client bundle (json-render/react + shadcn). |
| `GET  /issues` | — | Alias route into the SPA (see `artifacts/ui/manifest.json` routes). |

All `POST` routes accept an optional `x-actor-id` request header. The runtime converts it to `{ kind: 'user', id }` and stamps every event envelope's `actor` field. Absent header yields `actor: null`. The header name and actor kind are configurable via `manifest.auth`.

Command responses: `{ aggregateId, version, eventIds }`. Query responses: an array of shape-validated rows (`rowset<T>`) or a single row (`row<T>`). Error mappings owned by `@rntme/bindings-http`:

- `400 VALIDATION_ERROR` — request payload fails graph-input validation.
- `409 COMMAND_CONCURRENCY_CONFLICT` — optimistic-lock miss after N retries.
- `422 COMMAND_ILLEGAL_TRANSITION` — PDM stateMachine rejects the transition (body contains current state name, e.g. `"closed"` for 7001 coverage).
- `422` (guard rejection) — capacity-guard filter in `assignIssueWithCapacityGuard` returns empty rowset; the runtime reports the violation via the command handler.

Example: POST, lifecycle, projection read (updates arrive asynchronously via the relay → bus → consumer):

```bash
curl -s -X POST http://localhost:3000/api/v1/issues \
  -H 'content-type: application/json' -H 'x-actor-id: alice' \
  -d '{"issueId":9001,"title":"Demo","projectId":1,"reporterId":1,"priority":"high","storyPoints":3}'

curl -s -X POST http://localhost:3000/api/v1/issues/9001/actions/submit  -H 'x-actor-id: alice' -d '{}'
curl -s -X POST http://localhost:3000/api/v1/issues/9001/actions/assign \
  -H 'content-type: application/json' -H 'x-actor-id: alice' -d '{"assigneeId":2}'
curl -s -X POST http://localhost:3000/api/v1/issues/9001/actions/resolve \
  -H 'content-type: application/json' -H 'x-actor-id: alice' \
  -d '{"resolvedAt":"2026-04-15T12:30:00.000Z"}'

curl -s http://localhost:3000/api/v1/issues/9001
```

## Invariants & gotchas

- **Seed events are normalized before being recorded.** `@rntme/seed` `wrapPayloads()` converts flat seed payloads to `{ before, after }` using PDM transitions, so `replayAggregateState()` reconstructs state and subsequent commands against seeded issues succeed. The `stateField` in a flat seed payload is ignored in favor of `transition.to` (PDM is authoritative). Regression coverage: `test/seed-e2e.test.ts` assigns 7004 (→ version 3) and submits 7005 (→ version 2). Spec: `2026-04-16-demo-issue-tracker-fixes-design.md` §1.
- **Seed runs before the relay starts.** Ordering is: load → validate (PDM/QSM/bindings/graphs/shapes) → apply seed events to the event log → bootstrap DDL → start relay → start projection consumer → mount HTTP. Starting the relay before seed ingestion would race the consumer against half-seeded offsets. Wiring: `packages/runtime/src/start/start-service.ts` + `packages/runtime/src/start/wire-event-pipeline.ts`.
- **`wrapPredicateOptional` SQL `?` alignment (historical).** The compiler used to emit `(? IS NULL) OR (<inner>)` while pushing the guard param last in `paramOrder`, so the guard bound to the wrong positional value whenever a filter mixed predicate_optional with other params. Fixed in `packages/graph-ir-compiler/src/lower/sqlite/lower.ts` (`args: [acc, isNull]` swap) with regression tests at unit and e2e level. Demo-side, `searchIssues.json` still splits its filter into two sequential `filter` nodes (`baseFiltered` + `priorityFiltered`) so a single predicate-optional param lives alone in its node — belt-and-braces. Auto-memory: `rntme_predicate_optional_bug.md`. Spec: `2026-04-16-predicate-optional-fix-design.md`.
- **`sprintBurndown` reports every status, not only open work.** The `neq closed` clause was removed so burndown returns all buckets for the sprint. Fix spec: `2026-04-16-demo-issue-tracker-fixes-design.md` §3. Coverage: `test/seed-e2e.test.ts` asserts `≥ 2` buckets for sprint 1 + empty for sprint 999.
- **`searchIssues.from` / `searchIssues.to` are optional.** Both use `mode: defaulted` with bounds `1970-01-01T00:00:00.000Z` / `9999-12-31T23:59:59.999Z`. Calling `/v1/issues/search?q=…` without `from`/`to` returns the full-range match. Coverage: `test/smoke.test.ts` calls `/v1/issues/search?q=%lifecycle%&limit=10` and expects row `7001` back.
- **List/search endpoints traverse QSM relations to produce enriched columns.** `listIssues`, `listIssuesUi`, `searchIssues`, `issueDetail` emit a final `map` with JOIN paths (`issue.project.key`, `issue.reporter.username`, `issue.assignee.username`, `issue.sprint.name`). This requires `qsm.json` to declare `relations` (see `IssueView.project`, `IssueView.reporter`, `IssueView.assignee`, `IssueView.sprint`) and the reference-projection tables (`project_mirror`, `user_mirror`, `sprint_mirror`) to be seeded. Coverage: `test/list-enrichment-e2e.test.ts`. If a seed is skipped the JOINs return NULL columns rather than erroring.
- **`x-actor-id` is optional.** The README formerly claimed it was required; runtime behaviour is to stamp `actor: null` when absent. Fix spec: `2026-04-16-demo-issue-tracker-fixes-design.md` §4. Name/kind are configurable via `manifest.auth` (absent in this demo's manifest — defaults apply).
- **`src/server.ts` is ~20 lines on purpose.** Manifest loading, artifact validation, pipeline wiring, `/health` + `/metrics` mount, graceful shutdown, plugin contracts — all owned by `@rntme/runtime`. Do not expand `server.ts`; extend the runtime or the artifacts instead.
- **Kafka is in-process.** `@rntme/runtime` uses `InMemoryBus` by default. Swapping to a real broker is a future `RuntimeConfig.bus` change; no demo-side edit required.
- **SQLite is the forever target.** Future scale is via Turso (SQLite-compatible Rust). Do not introduce Postgres-specific syntax in new graphs or shapes. Auto-memory: `rntme_turso_target.md`.
- **The `ui/` tree is v2 format.** `ui/manifest.json` `version: "2.0"` drives the json-render/shadcn compiler in `@rntme/ui`. Splitting `*.screen.json` (data bindings + actions) from `*.spec.json` (element tree) is required by v2; mixing them breaks the compiler. Spec: `2026-04-16-ui-artifact-v2-design.md`.

## Out of scope / known limits

- **JOIN enrichment recipes beyond the current shape.** Lists and search already JOIN to `projects`, `users`, `sprints` via `map` with `issue.<rel>.<field>` paths. Multi-hop chains (e.g. `issue.sprint.project.key`) and aggregated join-targets (e.g. open-count on `project`) are not exercised. Follow-up work is scoped in `2026-04-16-demo-issue-tracker-fixes-design.md` §"Out of scope" and in auto-memory `demo_join_enrichment_todo`; `qsm.json` already carries the `relations` block to enable further additions.
- **Single-writer SQLite event log.** No horizontal write-side scaling in MVP.
- **Real Kafka broker.** `@rntme/bus-kafka` does not exist. `InMemoryBus` is the only bus; a future `RuntimeConfig.bus` swap will replace it without artifact changes.
- **Auth, rate limiting, multi-tenancy.** Not wired. The actor header is identity-only; there is no authentication.
- **In-memory DB by default.** State is lost on restart unless `persistence.mode: "persistent"` is set in the manifest.
- **`assignIssueWithCapacityGuard` is illustrative.** The guard reads the full `Issue` set and counts; it is not a production capacity model.
- **UI v2 covers 6 routes.** `assignIssueWithCapacityGuard` is not surfaced in the SPA. Adding it means a new screen spec + screen JSON + `manifest.json` route entry.
- **No OpenTelemetry exporter wired.** `/metrics` is the text-based scrape endpoint owned by `@rntme/runtime`.
- **No Postgres adapter.** The dialect is SQLite forever. Turso migration is the scale-out path (auto-memory `rntme_turso_target.md`).

## Where to look first

- "How is the demo booted?" → `src/server.ts` → `packages/runtime/src/load/load-service.ts` + `packages/runtime/src/start/start-service.ts`.
- "Where does an HTTP route come from?" → `artifacts/bindings.json` → binding name → `artifacts/graphs/<graphId>.json`.
- "How is an event appended and projected?" → `packages/runtime/src/start/wire-event-pipeline.ts` (relay → InMemoryBus → projection consumer).
- "How is the seed applied?" → `packages/seed/src/validate.ts` (`wrapPayloads`) + `packages/runtime/src/load/load-service.ts` + `artifacts/seed.json`.
- "Why does the SPA render?" → `artifacts/ui/manifest.json` routes → `artifacts/ui/layouts/main.*.json` + `artifacts/ui/screens/*.*.json` → `packages/ui/` (compiler) → `packages/ui-runtime/` (json-render/shadcn registry).
- "How are shapes inferred for the OpenAPI doc?" → `artifacts/shapes.json` + `packages/bindings-http/` OpenAPI emitter.
- "Why is seed ordered before the relay?" → invariant bullet above + `packages/runtime/src/start/start-service.ts`.
- "Where is the predicate_optional workaround?" → `artifacts/graphs/searchIssues.json` — two sequential `filter` nodes (`baseFiltered` + `priorityFiltered`) + compiler fix in `packages/graph-ir-compiler/src/lower/sqlite/lower.ts`.
- "Why do commands return `{ version }` not `{ aggregateId, version, eventIds }`?" — they do return the full shape. Earlier README versions mislabelled. See `packages/bindings-http/` command handler.
- "Where is the fixture copy used by `@rntme/runtime`'s own e2e?" → `packages/runtime/test/fixtures/issue-tracker/` (kept in sync with `demo/issue-tracker-api/artifacts/`).
- "How do I add a new HTTP route?" → extend `artifacts/bindings.json` with a new entry keyed by binding name; reference a graph under `artifacts/graphs/`; if the graph's output type is a new custom shape, add it to `artifacts/shapes.json`; restart — the runtime rebuilds OpenAPI and the Hono router from the manifest on boot.
- "How do I add a new lifecycle transition?" → extend `Issue.stateMachine.transitions` in `artifacts/pdm.json` with `from`, `to`, `affects`; create `artifacts/graphs/<name>Issue.json` with a single `emit` node; add the binding; add a screen fragment if needed in `artifacts/ui/screens/issue-detail.spec.json`.
- "How do I debug a query?" → `pnpm -F @rntme/issue-tracker-api-demo start` with `LOG_LEVEL=debug`; the runtime logs compiled SQL + `paramOrder` at graph-binding invocation. Compare against `packages/graph-ir-compiler/src/lower/sqlite/lower.ts` output.

## Reading the example

- **A query end-to-end** → `artifacts/bindings.json` (`listIssues`) → `artifacts/graphs/listIssues.json` (findMany → filter → sort → limit → map) → `artifacts/qsm.json` (`IssueView` projection + `IssueView.project|reporter|assignee|sprint` relations) → `artifacts/shapes.json` (`IssueListItem`).
- **A command end-to-end** → `artifacts/bindings.json` (`resolveIssue`) → `artifacts/graphs/resolveIssue.json` (single `emit` node) → `artifacts/pdm.json` (`Issue.stateMachine.transitions.resolve`: `in_progress → resolved`, `affects: ["resolvedAt"]`).
- **A read-prelude command (guard)** → `artifacts/bindings.json` (`assignIssueWithGuard`) → `artifacts/graphs/assignIssueWithCapacityGuard.json` (findMany → filter → reduce `count` → filter `lt 3` → emit) → `artifacts/pdm.json` (`Issue.stateMachine.transitions.assign`).
- **A UI screen end-to-end** → `artifacts/ui/manifest.json` (route `/issues/:id` → `screens/issue-detail`) → `artifacts/ui/screens/issue-detail.screen.json` (binding = `issueDetail`, action map) → `artifacts/ui/screens/issue-detail.spec.json` (json-render element tree, references fragment `command-button`) → `artifacts/ui/fragments/command-button.spec.json`.
- **A projection** → `artifacts/qsm.json` (`IssueView` entity-mirror, `table: projection_issue`, `exposed` fields) → `packages/projection-consumer/` (bootstrap DDL + event apply).
- **An event** → `artifacts/seed.json` (seed event envelope shape) → `packages/seed/src/validate.ts` (`wrapPayloads` normalization) → `packages/event-store/` (SqliteEventStore append) → `packages/runtime/src/start/wire-event-pipeline.ts` (relay → bus → projection consumer).
- **A state-machine transition** → `artifacts/pdm.json` (`Issue.stateMachine.transitions.<name>`: `from`, `to`, `affects`) → the emitting graph (`artifacts/graphs/<X>Issue.json`) + HTTP surface row in `artifacts/bindings.json`. Adding a new transition means: add to PDM → add a command graph (`emit` node) → add a binding → add a SPA screen fragment if needed.
- **A projection relation** → `artifacts/qsm.json` `relations` block (`IssueView.project` etc.) → `artifacts/graphs/*.json` `map.fields` paths (e.g. `issue.project.key`) → `artifacts/shapes.json` output shape fields (e.g. `IssueListItem.projectKey`). All three must line up; a missing relation declaration makes the JOIN-path `map` fail cross-ref validation.
- **A layout + screen** → `artifacts/ui/manifest.json` route entry → `layouts/main.spec.json` (shell Stack + nav Buttons with `navigate` action) → `screens/<name>.screen.json` (binding references under `/data/…`, refetch triggers) → `screens/<name>.spec.json` (json-render element tree, optional `{ $ref: "fragments/command-button", $param: { ... } }`).

## Specs

- [`../../docs/superpowers/specs/2026-04-16-demo-issue-tracker-fixes-design.md`](../../docs/superpowers/specs/2026-04-16-demo-issue-tracker-fixes-design.md) — Seed payload normalization (`wrapPayloads`), burndown filter fix, actor-header wording fix, `seed-e2e.test.ts` scope, and the JOIN-enrichment deferral note.
- [`../../docs/superpowers/specs/2026-04-16-demo-v2-migration-design.md`](../../docs/superpowers/specs/2026-04-16-demo-v2-migration-design.md) — UI v2 migration: json-render/react + shadcn adoption, 6-screen catalog, fragment/$ref system, layout composition via two `<Renderer>` instances.
- [`../../docs/superpowers/specs/2026-04-15-runtime-seed-design.md`](../../docs/superpowers/specs/2026-04-15-runtime-seed-design.md) — Runtime seed-loading contract consumed by this demo (`seed.json` shape, ordering before the relay).
- [`../../docs/superpowers/specs/2026-04-16-predicate-optional-fix-design.md`](../../docs/superpowers/specs/2026-04-16-predicate-optional-fix-design.md) — Compiler fix cross-referenced from Invariants & gotchas (`wrapPredicateOptional`).
- [`../../docs/superpowers/specs/2026-04-16-ui-artifact-v2-design.md`](../../docs/superpowers/specs/2026-04-16-ui-artifact-v2-design.md) — UI v2 artifact format produced under `artifacts/ui/`.
- Cross-reference: [`KNOWN_ISSUES.md`](./KNOWN_ISSUES.md) — historical fix log (status: all resolved). Retains `wrapPredicateOptional` analysis, JOIN-reference seeding story, and the `searchIssues` from/to optionality note for future reference.
- Auto-memory cross-refs: `rntme_predicate_optional_bug.md` (compiler bug analysis), `rntme_turso_target.md` (SQLite-forever dialect target), `demo_join_enrichment_todo.md` (multi-hop JOIN follow-up).
