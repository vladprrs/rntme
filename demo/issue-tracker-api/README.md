# @rntme/issue-tracker-api-demo

End-to-end demo: a small **issue tracker REST API** that exercises every package in the rntme monorepo. Boots an event-sourced write side, an eventually-consistent read side, and a Hono HTTP surface — all driven by four JSON artifacts.

## What it demonstrates

- **PDM with stateMachine.** The `Issue` aggregate has a state-field `status` and transitions `report → submit → assign → reassign → resolve → reopen → close` (plus `assign-with-guard`, an illustrative capacity-gate variant).
- **QSM entity-mirror projection.** One projection (`issues_projection`) mirrors the `Issue` entity; bootstrap DDL includes idempotency columns.
- **Graph IR — queries + commands.** 13 graphs under `src/artifacts/graphs/`: five queries and eight commands. `assignIssueWithCapacityGuard` additionally uses a read-prelude for a pre-transition guard.
- **Bindings → OpenAPI 3.1.** `src/artifacts/bindings.json` maps every graph to an HTTP operation; the server serves the generated document at `GET /openapi.json`.
- **Full event pipeline with in-memory Kafka bridge.** `event-store → createRelay → in-memory Kafka bridge → createProjectionConsumer → QSM DB`. No external broker required.
- **Hono runtime.** `@rntme/bindings-http`'s router is mounted into a Hono app; an `x-actor-id` header is captured into the command envelope's `actor`.

## Architecture

```
client
   │  HTTP
   ▼
┌──────────────────────────┐
│    Hono app              │
│  + @rntme/bindings-http  │
└──┬──────────────────┬────┘
   │                  │
   │ query path       │ command path
   ▼                  ▼
graph-ir-compiler   graph-ir-compiler
 (compile + exec)    (compile + exec command)
   │                  │
   ▼                  ▼
read-side SQLite   @rntme/event-store
(QSM projections)    │  (SqliteEventStore)
   ▲                  │
   │                  │ createRelay (at-least-once)
   │                  ▼
   │             in-memory Kafka bridge
   │                  │
   │                  ▼
   └── projection-consumer (BEGIN IMMEDIATE / apply / COMMIT / commitOffsets)
```

`src/events.ts` builds the pipeline; `src/server.ts` mounts the router and `GET /` index, `src/artifacts.ts` loads, parses and validates every JSON artifact at boot.

## Run it

Requirements: Node.js ≥ 20, pnpm ≥ 9 (covered by the repo's root instructions).

```bash
pnpm install                                                 # once, at repo root

pnpm -F @rntme/issue-tracker-api-demo start
# ➜ issue-tracker-api-demo listening on http://localhost:3000

# Custom port:
PORT=4000 pnpm -F @rntme/issue-tracker-api-demo start

# Seed an on-disk DB instead of :memory: (useful for inspection):
pnpm -F @rntme/issue-tracker-api-demo seed ./app.db
```

The server uses `:memory:` SQLite for both the event log and the read-side DB. The seed script preloads users (alice, bob, carol, dave, …), projects, sprints and ~22 projection rows so queries return non-empty results immediately.

## Route inventory

| Method & path | Graph | Description |
| ------------- | ----- | ----------- |
| `GET  /v1/issues?status=&limit=` | `listIssues` | Paginated projection read. |
| `GET  /v1/issues/:id` | `issueDetail` | Single-row fetch. |
| `GET  /v1/issues/search?q=&from=&to=&priority=&limit=` | `searchIssues` | Free-text + optional filters (predicate-optional params). |
| `GET  /v1/stats/by-project` | `issuesByProject` | Aggregate count + breakdown per project. |
| `GET  /v1/sprints/:sprintId/burndown` | `sprintBurndown` | Per-day burndown for a sprint. |
| `POST /v1/issues` | `reportIssue` | Create a new Issue (transition `report`). |
| `POST /v1/issues/:issueId/actions/submit` | `submitIssue` | `draft → open`. |
| `POST /v1/issues/:issueId/actions/assign` | `assignIssue` | Assign to a user. |
| `POST /v1/issues/:issueId/actions/assign-with-guard` | `assignIssueWithCapacityGuard` | Assign with a read-prelude capacity check. |
| `POST /v1/issues/:issueId/actions/reassign` | `reassignIssue` | Change assignee. |
| `POST /v1/issues/:issueId/actions/resolve` | `resolveIssue` | `in_progress → resolved`. |
| `POST /v1/issues/:issueId/actions/reopen` | `reopenIssue` | `resolved → open`. |
| `POST /v1/issues/:issueId/actions/close` | `closeIssue` | Terminal transition. |
| `GET  /openapi.json` | — | Generated OpenAPI 3.1 document. |
| `GET  /` | — | JSON index of all routes. |

All `POST`s require an `x-actor-id` request header — the server turns it into `{ kind: 'user', id }` and stamps every event envelope's `actor` with it.

## Example calls

```bash
# 1. List open issues
curl -s 'http://localhost:3000/v1/issues?status=open&limit=5' | jq

# 2. Report a new issue (creation transition)
curl -s -X POST http://localhost:3000/v1/issues \
  -H 'content-type: application/json' \
  -H 'x-actor-id: alice' \
  -d '{"issueId":7001,"title":"Demo bug","projectId":1,"reporterId":1,"priority":"high","storyPoints":3}' | jq
# → { "version": 1 }

# 3. Move it through its lifecycle
curl -s -X POST http://localhost:3000/v1/issues/7001/actions/submit  -H 'x-actor-id: alice' -d '{}' | jq
curl -s -X POST http://localhost:3000/v1/issues/7001/actions/assign \
  -H 'content-type: application/json' -H 'x-actor-id: alice' \
  -d '{"assigneeId":2}' | jq
curl -s -X POST http://localhost:3000/v1/issues/7001/actions/resolve -H 'x-actor-id: alice' -d '{}' | jq

# 4. Inspect the projection (updates arrive asynchronously via the relay + consumer)
curl -s 'http://localhost:3000/v1/issues/7001' | jq
```

Command responses are `{ version: <n> }`. Version-conflict retries surface as `409 COMMAND_CONCURRENCY_CONFLICT`; an illegal transition or guard rejection surfaces as `422`.

## Source map

```
src/
  artifacts/
    pdm.json                     # Issue entity + stateMachine
    qsm.json                     # issues_projection (entity-mirror)
    bindings.json                # HTTP surface
    shapes.json                  # Custom output shapes (PaginatedIssues, etc.)
    graphs/                      # 13 graphs
      listIssues.json
      issueDetail.json
      issuesByProject.json
      searchIssues.json
      sprintBurndown.json
      reportIssue.json
      submitIssue.json
      assignIssue.json
      assignIssueWithCapacityGuard.json
      reassignIssue.json
      resolveIssue.json
      reopenIssue.json
      closeIssue.json
  artifacts.ts                   # load + validate + build resolvers
  events.ts                      # SqliteEventStore + relay + in-memory kafka + projection consumer
  server.ts                      # Hono app + bindings-http router + GET / index
  db/
    schema.sql                   # read-side auxiliary tables (users, projects, sprints, …)
    seed.ts                      # seeded DB factory (:memory: by default, or pass a path)
test/
  artifacts-exports.test.ts
  bindings-validate.test.ts
  command-graphs-compile.test.ts
  e2e.test.ts                    # query-side e2e
  events.test.ts                 # pipeline integration
  mutations-e2e.test.ts          # lifecycle: report → submit → assign → reassign → resolve → close + guard
  seed-projection.test.ts
  server-command-wiring.test.ts
```

## Tests

```bash
pnpm -F @rntme/issue-tracker-api-demo test
pnpm -F @rntme/issue-tracker-api-demo typecheck
```

The e2e suites boot `buildApp()` in-process (no OS listener), exercise queries and the full command lifecycle, and assert that projections reflect the appends after the relay drains.

## Caveats (Tier 1)

- Single-writer SQLite event log. Horizontal scaling on the write side is not in MVP.
- Kafka is an in-process bridge — swap `createInMemoryKafkaProducer/Consumer` for a real broker in prod; nothing else changes.
- No auth, no rate limiting, no multi-tenancy.
- In-memory DB by default — each start loses state. Use `seed ./app.db` + point the server at the path for persistence.
