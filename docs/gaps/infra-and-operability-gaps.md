# Gaps: Infra and Operability

This document covers runtime, deployment, storage, bus, observability, and
operational gaps after the project-first pivot and deploy-pipeline work. The old
snapshot understated what has landed, but also missed the largest current risk:
the product now promises project blueprints while runtime still boots one
service artifact folder.

## What rntme has today

- `packages/runtime` loads and starts one validated service folder through
  `loadService()` and `startService()`.
- `packages/artifacts/blueprint` can load/compose project blueprint folders, project-level
  PDM, routes/middleware, service members, and a project-routed binding registry.
- `packages/deploy/deploy-core` and `deploy-dokploy` model project deployment
  planning/adaptation, but the main repo runtime still uses one service process
  per artifact folder.
- Runtime default persistence is better-sqlite3; bus default is `InMemoryBus`.
- `packages/runtime/event-store` has `event_log`, `publish_cursor`,
  `delivery_tracking`, CloudEvents fields, bounded relay retry, and DLQ emit.
- `packages/runtime/projection-consumer` applies mirror and derived projections in SQLite
  transactions.
- `packages/runtime/runtime/src/plugins/observability.ts` provides health and Prometheus
  metrics mounting.
- `@rntme/db-studio` is retired; raw SQL inspection is not a supported product
  surface.
- `docs/history/specs/historical/2026-04-24-project-deployment-pipeline-design.md`
  intentionally rejects production deployment mode until bus/storage/auth
  prerequisites are specified.

## Closed or reframed since the original gap doc

- **Delivery tracking/DLQ:** closed at storage/relay level.
- **Basic observability:** partially closed with health/metrics. Residual:
  structured traces/logs, DLQ/lag ops endpoints, dashboards.
- **gRPC/modules:** implemented as runtime surfaces and adapter-client seams.
- **db-studio:** retired; raw SQL browsing is not a production control plane.
- **Redis:** no longer a P1 default. The production bus decision should center
  on Kafka/Redpanda for service events; Redis may be optional cache/pubsub only
  if a concrete workload proves it.

## Gaps

### [P0] Project-level runtime intake and canonical project demo

**Why it matters.** The market-facing unit is a validated project blueprint.
`@rntme/blueprint` composes that model, but `@rntme/runtime` still boots one
service folder. A [DEV] agent cannot implement a full project-blueprint demo
without inventing how composed services, routing, middleware, and edge gateway
map to runtime processes.

**Current evidence.**

- `packages/runtime/runtime/src/load/load-service.ts` expects a single artifact folder
  with `manifest.json`, `pdm.json`, `qsm.json`, graphs, bindings, seed, and UI.
- `packages/artifacts/blueprint/README.md` says `loadComposedBlueprint` is consumed by
  future runtime/tooling tracks.
- `README.md` states project-level runtime intake is not yet wired in runtime.

**Target.**

- Choose and document the runtime shape:
  separate service runtimes plus generated edge gateway (recommended), or a
  single project runtime process.
- Add a canonical project-shaped demo aligned with `vision.md` wedge classes.
- Ensure deploy-core/dokploy and local runtime use the same project composition
  assumptions.

**Acceptance gate.** A project blueprint folder can be validated and launched
locally through one documented command/path, with project routes and UI working
without service-specific glue.

### [P0] Schema registry + backward compatibility gate

**Why it matters.** Agents can change event payloads by editing PDM/graphs.
Without generated schemas and a compatibility gate, downstream consumers break
at runtime. This is the main remaining event-driven architecture gap.

**Current evidence.**

- `packages/artifacts/pdm/src/derive/event-types.ts` derives event type specs from PDM
  state machines.
- There is no committed per-service/project `schemas/` registry and no CI
  backward-compat check.
- This file is the current backlog surface for schema registry gaps.

**Target.**

- Generate JSON Schema files from derived event specs.
- Commit schemas with blueprint/service artifacts or publish them through the
  platform registry.
- Add CI that compares generated schemas against `main` with a backward
  compatibility policy.
- Wire CloudEvents `dataschema` to the generated schema path/URL.

**Acceptance gate.** A breaking event payload change fails CI unless the event
schema versioning/promotion path is explicitly used.

### [P0] Production bus/storage deploy contract

**Why it matters.** Preview deploys are useful, but production mode is
deliberately blocked. The runtime cannot sell repeatable generated services if
its production bus/storage contract is hand-waved.

**Current evidence.**

- Runtime defaults to `InMemoryBus`.
- Deploy pipeline spec rejects production mode until production Kafka/Redpanda,
  persistent storage, auth middleware, and artifact delivery are defined.
- Event-store SQL is SQLite-compatible, but libsql/Turso behavior is not
  continuously tested.

**Target.**

- Define production event bus plugin/config: Kafka/Redpanda endpoints, topic
  retention, DLQ topics, credentials, and health checks.
- Define persistent event-store/QSM storage mode: local volume vs libsql/Turso,
  backup/restore, and migration path.
- Add deploy validation that rejects unsafe production configs with actionable
  errors.

**Acceptance gate.** `production` deploy planning can be enabled only when a
runtime service has durable bus/storage config and smoke evidence.

### [P1] Observability and ops HTTP surfaces

**Why it matters.** Health and Prometheus metrics exist, but operators need
first-class, supported views into relay lag, projection lag, DLQ, and poison
events.

**Current evidence.**

- `packages/runtime/runtime/src/plugins/observability.ts` mounts health/metrics.
- `delivery_tracking` stores per-event attempt/delivery/DLQ state.
- Raw SQL browsing is not an authenticated production ops API.

**Target.**

- Add read-only ops endpoints or package APIs for relay lag, DLQ count/list, and
  projection lag.
- Add structured logger/tracing hooks consistently across relay, consumer,
  bindings, operation calls, and executors.
- Document safe production exposure rules.

**Acceptance gate.** A failed relay/projection event can be diagnosed from
supported runtime surfaces without raw DB access.

### [P1] Turso/libsql compatibility audit

**Why it matters.** rntme commits to SQLite dialect and Turso/libsql as the
scale path. The code currently relies primarily on better-sqlite3 test coverage.

**Current evidence.**

- DDL and SQL live across event-store, QSM, graph-ir-compiler, seed, and
  projection-consumer.
- `packages/runtime/runtime/src/plugins/better-sqlite-driver.ts` is the default driver.
- No CI matrix proves libsql behavior.

**Target.**

- Add a libsql/Turso compatibility test lane for generated SQL and runtime
  behavior.
- Document forbidden SQL constructs and accepted workarounds.

**Acceptance gate.** The canonical demo and package SQL tests pass against both
embedded SQLite and a libsql-compatible target.

### [P2] Event-store snapshotting

**Why it matters.** Long-lived aggregates eventually make replay linear in event
count. This is not blocking the next project demo, but it is a predictable
production follow-up.

**Current evidence.**

- `readStream` replays from `event_log` by stream/version.
- No snapshot table or replay floor exists in event-store schema.

**Target.** Add SQLite-compatible snapshots per stream/version with retention
policy and replay integration.

## Boundaries

- **Deploy pipeline is CLI/platform-side.** Runtime should not become a project
  deploy controller.
- **Project execution should stay service-runtime based unless explicitly
  reversed.** The deploy spec already assumes separate domain service,
  integration module, and edge gateway workloads.
- **Raw SQL inspection is not governance.** Do not treat SQL browsing as the
  business-user review UI.
- **Redis is optional until proven.** Do not add it as a default production
  dependency without a concrete low-latency/cache requirement.

## External API notes

- Context7 check against libSQL confirmed the project is SQLite-derived and has
  SQLite feature flags such as FTS5/JSON1 in its build surface. Treat
  better-sqlite3 passing as necessary but not sufficient: rntme needs a libSQL
  compatibility test lane for generated DDL, JSON functions, FTS, transaction
  behavior, and runtime startup.

## Open questions

1. Should local project launch be implemented in `@rntme/runtime`, a new
   launcher package, or CLI tooling around composed blueprints? Recommended
   default: launcher/CLI orchestrating one runtime per service plus gateway.
2. Should production storage default to persistent local SQLite volumes or
   libsql/Turso first? Recommended default: persistent local volume for preview,
   libsql/Turso for managed production once compatibility tests exist.
3. Which canonical project demo should become the default full-runtime proof?
   Recommended default: approvals workflow.
