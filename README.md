# rntme

[![CI](https://github.com/vladprrs/rntme/actions/workflows/ci.yml/badge.svg)](https://github.com/vladprrs/rntme/actions/workflows/ci.yml)

A typed, declarative **CQRS / Event-Sourced** backend-authoring toolkit. Author four JSON artifacts — **PDM** (domain), **QSM** (read-side projections), **Graph IR** (queries + commands), **Bindings** (HTTP surface) — and the toolchain produces:

- SQLite DDL for projections and the event log.
- SQL for every query graph and a runtime to execute it.
- An event-sourced command runtime that appends to the log with optimistic concurrency.
- A Kafka-at-least-once relay + idempotent projection consumer that keeps the read-side eventually consistent.
- An OpenAPI 3.1 document and a Hono sub-router that serves queries and commands described by the bindings artifact.

The toolkit is organised as a pnpm monorepo. Each package has a single, testable responsibility and depends only on the packages strictly below it.

## Architecture at a glance

```
            Authoring artifacts (JSON; validated, resolved)
            ┌──────┐  ┌──────┐  ┌──────────────┐  ┌───────────┐
            │ PDM  │  │ QSM  │  │   Graph IR   │  │ Bindings  │
            └──┬───┘  └──┬───┘  └──────┬───────┘  └─────┬─────┘
               │         │             │                │
               ▼         ▼             ▼                ▼
           ┌─────────────────────────────────────────────────┐
           │              Compilers / validators              │
           │  @rntme/pdm · @rntme/qsm · @rntme/graph-ir-     │
           │  compiler · @rntme/bindings                     │
           └──────────────┬─────────────────┬────────────────┘
                          │                 │
                 query path                 command path
                          │                 │
                          ▼                 ▼
                    ┌──────────┐       ┌──────────────────┐
                    │  QSM DB  │◀──────│  event-store      │
                    │ (SQLite) │       │  (SQLite log +   │
                    │ read-side│       │   cursor helper) │
                    └────▲─────┘       └────────┬─────────┘
                         │                      │ relay (at-least-once)
                         │                      ▼
                         │               ┌──────────────┐
                         │               │    Kafka     │
                         │               │  (in-memory  │
                         │               │   in demo)   │
                         │               └──────┬───────┘
                         │                      │
                         │              ┌───────▼──────────────┐
                         └──────────────│ projection-consumer  │
                                        │  (idempotent upsert) │
                                        └──────────────────────┘

                       HTTP surface: @rntme/bindings-http (Hono)
```

## Packages

| Package | Purpose |
| ------- | ------- |
| [`@rntme/pdm`](packages/pdm) | Platform Domain Model: entities, fields, relations and an optional stateMachine per entity; derives event-type specs from transitions. |
| [`@rntme/qsm`](packages/qsm) | Query-Side Materialized projections: declares read-side tables, generates DDL and event-handler specs. |
| [`@rntme/event-store`](packages/event-store) | SQLite-backed event log with optimistic concurrency + at-least-once Kafka relay. |
| [`@rntme/projection-consumer`](packages/projection-consumer) | Kafka → SQLite projection updater with three-layer idempotency and batch transactions. |
| [`@rntme/graph-ir-compiler`](packages/graph-ir-compiler) | Graph IR → SQLite compiler (query path) and state-machine-gated command runtime (command path). |
| [`@rntme/bindings`](packages/bindings) | HTTP bindings artifact + four-layer validator + OpenAPI 3.1 emitter. |
| [`@rntme/bindings-http`](packages/bindings-http) | Hono sub-router that executes queries and commands described by a validated bindings artifact. |

### Demo

[`demo/issue-tracker-api`](demo/issue-tracker-api) is an end-to-end issue tracker that wires every package together: PDM with a stateMachine, QSM entity-mirror projections, 13 graphs (queries + commands), bindings → OpenAPI, a full event pipeline with the in-memory Kafka bridge, and a Hono HTTP server.

### Dependency graph

```
pdm ◀──────────┐
 ▲             │
 │             │
qsm ◀──────┐   │
           │   │
event-store◀┼─◀│──────── projection-consumer
 ▲         │   │
 │         │   │
 └──── graph-ir-compiler ◀──── bindings-http ──▶ bindings
                                      ▲              ▲
                                      └── demo ──────┘
```

`pdm`, `event-store` and `bindings` have no internal dependencies. Everything else layers on top.

## Quick start

Requirements: **Node.js ≥ 20**, **pnpm ≥ 9** (CI uses pnpm 9.12.0).

```bash
pnpm install
pnpm -r run build
pnpm -r run test
```

### Run the demo

```bash
pnpm -F @rntme/issue-tracker-api-demo start
# ➜ issue-tracker-api-demo listening on http://localhost:3000
```

```bash
curl -s 'http://localhost:3000/v1/issues?status=open&limit=5'

curl -s -X POST http://localhost:3000/v1/issues \
  -H 'content-type: application/json' \
  -H 'x-actor-id: alice' \
  -d '{"issueId":7001,"title":"Demo","projectId":1,"reporterId":1,"priority":"high","storyPoints":3}'
```

See [`demo/issue-tracker-api/README.md`](demo/issue-tracker-api/README.md) for the full route inventory, seed instructions and example flow.

## Developer commands

Each library package exposes the same scripts. Run them across all packages from the root, or for one package with `pnpm -F <name>`.

| Command | Effect |
| ------- | ------ |
| `pnpm -r run build` | `tsc -p tsconfig.json` in every package. |
| `pnpm -r run typecheck` | Typecheck-only pass with `tsconfig.check.json`. |
| `pnpm -r run test` | `vitest run` in every package (unit + integration + e2e + golden). |
| `pnpm -r run lint` | ESLint on `src/**` and `test/**`. |
| `pnpm -F <name> test:watch` | Vitest watch mode for one package. |
| `pnpm -F @rntme/issue-tracker-api-demo start` | Start the demo server (`tsx src/server.ts`, `PORT` env var). |
| `pnpm -F @rntme/issue-tracker-api-demo seed [path]` | Seed the read-side DB (default `:memory:`; pass a path for on-disk). |

CI runs `build → typecheck → test → lint` on every push and PR to `main` (see `.github/workflows/ci.yml`).

## Design docs and specs

- `graph_ir_rc_7.md` — Graph IR language spec (rc7 draft). Operators, named shapes, input modes, role inference, binding artifact format.
- `docs/superpowers/specs/2026-04-13-graph-ir-sql-compiler-mvp-design.md` — compiler scope and MVP deviations from rc7.
- `docs/superpowers/specs/2026-04-14-mutations-design.md` — CQRS / ES design: stateMachine, event envelope, command role, event store, relay, projection consumer.
- `docs/superpowers/specs/2026-04-14-bindings-design.md` — bindings artifact, four-layer validation, OpenAPI emission.
- `docs/superpowers/specs/2026-04-14-bindings-http-design.md` — Hono runtime for bindings.
- `docs/superpowers/plans/*.md` — per-package implementation plans.
- `docs/superpowers/reports/*.md` — gap analyses (spec vs. implementation).

## MVP / Tier 1 scope

What ships today:

- SQLite target only (`≥ 3.30`); no PostgreSQL, ksqlDB or other dialects.
- `entity-mirror` projections only; `derived` is accepted by parsers but rejected by validators.
- Single-writer event log; Kafka relay is at-least-once with per-stream ordering (partition key = `stream`).
- The demo uses an in-memory Kafka bridge; plugging a real broker is a `KafkaProducer` / `KafkaConsumer` swap.
- One graph compiled per `compile()` call.
- Query nodes: `findMany`, `filter`, `map`, `reduce`, `sort`, `limit`. Command path adds `emit`.
- JSON authoring; no YAML yet.

Out of scope for now: snapshots, multi-aggregate commands, list/`in` parameters, named predicate graphs, `distinct`, `lookupOne`, window functions, auth/authz, multi-tenancy, schema registry / breaking schema evolution, DLQ.

## Glossary

| Term | Meaning |
| ---- | ------- |
| **PDM** | Platform Domain Model — entities, fields, relations, optional stateMachine per entity. |
| **QSM** | Query-Side Materialized projections — read-side tables derived from PDM. |
| **Graph IR** | Declarative DAG of operators (`findMany`, `filter`, …, `emit`) that compiles to SQL and/or events. |
| **Canonical Graph IR** | Normalised internal form without syntactic sugar. |
| **Semantic plan** | Typed, scope-resolved plan produced by the semantic layer of the compiler. |
| **Bindings** | Artifact mapping graphs to HTTP operations; input to OpenAPI generation. |
| **Event envelope** | Immutable event record (eventId, stream, version, actor, payload, schemaVersion, …). |
| **Aggregate** | Domain entity identified by `<aggregateType>-<aggregateId>`; stream of events. |
| **Relay** | Background loop that tails the event log and publishes to Kafka with a persistent cursor. |
| **Projection** | Materialised view kept up to date by the projection consumer. |
| **Entity-mirror** | Projection backing that mirrors an entity's exposed fields plus generated columns and idempotency columns. |
| **Emit node** | Graph IR node describing an event to append for a mutation. |
| **Result\<T\>** | `{ ok: true; value: T } \| { ok: false; errors: E[] }` — no exceptions in the validation pipeline. |
