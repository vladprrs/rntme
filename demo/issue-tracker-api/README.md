# @rntme/issue-tracker-api-demo

End-to-end demo: a small **issue tracker REST API** that exercises every package in the rntme monorepo. Boots an event-sourced write side, an eventually-consistent read side, and a Hono HTTP surface — all driven by four JSON artifacts, loaded and validated by [`@rntme/runtime`](../../packages/runtime) with zero hand-written wiring.

## What it demonstrates

- **PDM with stateMachine.** The `Issue` aggregate has a state-field `status` and transitions `report → submit → assign → reassign → resolve → reopen → close` (plus `assign-with-guard`, an illustrative capacity-gate variant).
- **QSM entity-mirror projection.** One projection (`issues_projection`) mirrors the `Issue` entity; bootstrap DDL includes idempotency columns.
- **Graph IR — queries + commands.** 14 graphs under `artifacts/graphs/`: six queries and eight commands. `listIssuesUi` is a UI-friendly list query (no `predicate_optional` inputs). `assignIssueWithCapacityGuard` additionally uses a read-prelude for a pre-transition guard.
- **Bindings → OpenAPI 3.1.** `artifacts/bindings.json` maps every graph to an HTTP operation; the server serves the generated document at `GET /openapi.json`.
- **Full event pipeline with in-memory Kafka bridge.** `event-store → createRelay → in-memory Kafka bridge → createProjectionConsumer → QSM DB`. No external broker required.
- **Declarative UI.** `@rntme/ui` compiler (`artifacts/ui/`) + `@rntme/ui-runtime` serve a SPA at **`GET /ui`** (static shell + client bundle via json-render/shadcn). The SPA calls the same REST API.

## Seed

The runtime loads [`demo/issue-tracker-api/artifacts/seed.json`](./artifacts/seed.json) on startup (unless `seed.enabled` is set to `false` in `artifacts/manifest.json`). It replays deterministic events so the read model includes users, projects, and sample issues (including **`7001`**) without manual setup.

From the repository root:

```bash
pnpm install
pnpm -F @rntme/issue-tracker-api-demo start
```

## Architecture

```
client
   │  HTTP
   ▼
┌──────────────────────┐
│  @rntme/runtime       │
│  loadService(dir) →  │
│  startService(...)   │
└──┬───────────────┬────┘
   │               │
   │ query path    │ command path
   ▼               ▼
read-side SQLite  @rntme/event-store
(QSM projections)   │  (SqliteEventStore)
   ▲                │
   │                │ createRelay (at-least-once)
   │                ▼
   │           in-memory Kafka bridge
   │                │
   │                ▼
   └── projection-consumer (BEGIN IMMEDIATE / apply / COMMIT / commitOffsets)
```

`src/server.ts` is ~12 lines: resolve `./artifacts`, call `loadService`, call `startService`. All artifact loading, validation, pipeline wiring, and Hono mounting is owned by `@rntme/runtime`.

## Known issues

Some read-side edge cases may still surface as 500s while upstream work lands. See [KNOWN_ISSUES.md](./KNOWN_ISSUES.md) for details.

## Run it

Requirements: Node.js ≥ 20, pnpm ≥ 9.

```bash
pnpm install                                                 # once, at repo root

pnpm -F @rntme/issue-tracker-api-demo start
# ➜ binds whichever port artifacts/manifest.json says (default 3000)
```

Open **[http://localhost:3000/ui](http://localhost:3000/ui)** in a browser to use the demo UI: home (stats by project), browse issues, report a new issue, open an issue by id and run lifecycle actions.

```bash
# Custom port via env (overrides the manifest):
RNTME_HTTP_PORT=4000 pnpm -F @rntme/issue-tracker-api-demo start

# Run via the CLI instead of embedding:
pnpm -F @rntme/issue-tracker-api-demo start:runtime-cli
# equivalent to: rntme-runtime start ./artifacts
```

The runtime uses `:memory:` SQLite for both the event log and the read-side DB by default. Set `persistence.mode: "persistent"` in `artifacts/manifest.json` (plus `eventStorePath` and `qsmPath`) for on-disk storage.

## Route inventory

| Method & path | Graph | Description |
| ------------- | ----- | ----------- |
| `GET  /api/v1/ui/issues?limit=` | `listIssuesUi` | Recent issues for the SPA (no predicate-optional params). |
| `GET  /api/v1/issues?status=&limit=` | `listIssues` | Paginated projection read. |
| `GET  /api/v1/issues/:id` | `issueDetail` | Single-row fetch. |
| `GET  /api/v1/issues/search?q=&from=&to=&priority=&limit=` | `searchIssues` | Free-text + date range (`from` / `to` default to full range when omitted) + optional filters. |
| `GET  /api/v1/stats/by-project` | `issuesByProject` | Aggregate count + breakdown per project. |
| `GET  /api/v1/sprints/:sprintId/burndown` | `sprintBurndown` | Per-day burndown for a sprint. |
| `POST /api/v1/issues` | `reportIssue` | Create a new Issue (transition `report`). |
| `POST /api/v1/issues/:issueId/actions/submit` | `submitIssue` | `draft → open`. |
| `POST /api/v1/issues/:issueId/actions/assign` | `assignIssue` | Assign to a user. |
| `POST /api/v1/issues/:issueId/actions/assign-with-guard` | `assignIssueWithCapacityGuard` | Assign with a read-prelude capacity check. |
| `POST /api/v1/issues/:issueId/actions/reassign` | `reassignIssue` | Change assignee. |
| `POST /api/v1/issues/:issueId/actions/resolve` | `resolveIssue` | `in_progress → resolved`. |
| `POST /api/v1/issues/:issueId/actions/reopen` | `reopenIssue` | `resolved → open`. |
| `POST /api/v1/issues/:issueId/actions/close` | `closeIssue` | Terminal transition. |
| `GET  /api/openapi.json` | — | Generated OpenAPI 3.1 document. |
| `GET  /` | — | JSON service identity (name + version). |
| `GET  /health`, `GET /metrics` | — | Observability endpoints owned by `@rntme/runtime`. |
| `GET  /issues` | — | Issue tracker SPA (see `@rntme/ui-runtime`). |

All `POST`s accept an optional `x-actor-id` request header — the runtime turns it into `{ kind: 'user', id }` and stamps every event envelope's `actor` with it. If omitted, `actor` is `null`. Header name and actor kind are configurable via `manifest.auth`.

## Example calls

```bash
# 1. Report a new issue (creation transition)
curl -s -X POST http://localhost:3000/api/v1/issues \
  -H 'content-type: application/json' \
  -H 'x-actor-id: alice' \
  -d '{"issueId":7001,"title":"Demo bug","projectId":1,"reporterId":1,"priority":"high","storyPoints":3}' | jq
# → { "version": 1 }

# 2. Move it through its lifecycle
curl -s -X POST http://localhost:3000/api/v1/issues/7001/actions/submit  -H 'x-actor-id: alice' -d '{}' | jq
curl -s -X POST http://localhost:3000/api/v1/issues/7001/actions/assign \
  -H 'content-type: application/json' -H 'x-actor-id: alice' \
  -d '{"assigneeId":2}' | jq
curl -s -X POST http://localhost:3000/api/v1/issues/7001/actions/resolve \
  -H 'content-type: application/json' \
  -H 'x-actor-id: alice' \
  -d '{"resolvedAt":"2026-04-15T12:30:00.000Z"}' | jq

# 3. Inspect the projection (updates arrive asynchronously via the relay + consumer)
curl -s 'http://localhost:3000/api/v1/issues/7001' | jq
```

Command responses are `{ version: <n> }`. Version-conflict retries surface as `409 COMMAND_CONCURRENCY_CONFLICT`; an illegal transition or guard rejection surfaces as `422`.

## Source map

```
artifacts/
  manifest.json                  # rntme runtime config (service name, port, persistence, auth)
  pdm.json                       # Issue entity + stateMachine
  qsm.json                       # issues_projection (entity-mirror)
  bindings.json                  # HTTP surface
  shapes.json                    # Custom output shapes (PaginatedIssues, etc.)
  ui/                            # Declarative UI source (manifest + screens + layouts + fragments)
  graphs/                        # 14 graphs — queries + commands
    ...
src/
  server.ts                      # loadService + startService; ~12 lines
test/
  smoke.test.ts                  # subprocess boot + /health + /openapi.json
Dockerfile                       # FROM ghcr.io/vladprrs/rntme-runtime:1.0 + COPY artifacts
```

All artifact-loading, pipeline wiring, and pipeline teardown now lives in `@rntme/runtime`. The runtime's own test suite (`packages/runtime/test`) exercises the happy path, every manifest error code, graceful shutdown, `/health` + `/metrics`, plugin contracts, the CLI, and the issue-tracker e2e using the fixture under `packages/runtime/test/fixtures/issue-tracker/` (copied from `demo/issue-tracker-api/artifacts/`).

## Tests

```bash
pnpm -F @rntme/issue-tracker-api-demo test
pnpm -F @rntme/issue-tracker-api-demo typecheck
```

The smoke test spawns `tsx src/server.ts` as a subprocess, waits for `/health`, and asserts `/openapi.json` serves the generated document. Fuller coverage of query paths and command lifecycles lives in the runtime's own e2e + fixture suite.

## Run in Docker

```bash
# Base image with artifacts mounted at /srv/artifacts
docker run --rm -p 3000:3000 \
  -v "$(pwd)/artifacts:/srv/artifacts:ro" \
  ghcr.io/vladprrs/rntme-runtime:1.0

# Or bake them in:
docker build -t issue-tracker-api-demo:dev .
docker run --rm -p 3000:3000 issue-tracker-api-demo:dev
```

## Caveats (Tier 1)

- Single-writer SQLite event log. Horizontal scaling on the write side is not in MVP.
- Kafka is an in-process bridge — swap `@rntme/runtime`'s `InMemoryBus` for a future `@rntme/bus-kafka` adapter via `RuntimeConfig.bus` when the package lands.
- No auth, no rate limiting, no multi-tenancy.
- In-memory DB by default — each start loses state. Switch `persistence.mode` in `artifacts/manifest.json` for persistence.
