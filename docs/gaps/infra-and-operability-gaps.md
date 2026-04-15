# Gaps: Infra and Operability

Thematic gap doc comparing rntme's infra and operability surface against the Medusa.js commerce-class reference, scoped to the medusa-class roadmap (`docs/superpowers/reports/2026-04-14-medusa-class-roadmap-plan.md`). Inputs: Medusa surveys A/B/C (2026-04-14), the top-level rntme `README.md`, and package READMEs for `event-store`, `projection-consumer`, `bindings-http`, `graph-ir-compiler`, and `qsm`.

## What rntme has today

- **Storage engine.** Single SQLite file per service (`better-sqlite3`) for both the write-side event log and the read-side projections. The event store DDL lives at `packages/event-store/src/store/schema.ts:3` — a single `event_log` table with `INTEGER PRIMARY KEY AUTOINCREMENT`, `UNIQUE (stream, version)`, and a `publish_cursor` table for the relay. The store itself (`packages/event-store/src/store/sqlite.ts:16`) wraps `better-sqlite3` synchronously.
- **Event pipeline.** In-process polling relay publishes committed events to Kafka with per-stream ordering (`packages/event-store/src/relay/loop.ts:35`). Keys are `stream`, so per-aggregate order survives partitioning.
- **Read-side projection.** Kafka consumer applies envelopes inside `BEGIN IMMEDIATE` → `COMMIT` → `commitOffsets` (`packages/projection-consumer/src/consumer.ts:26`). Three-layer idempotency (`last_event_version` pre-check + INSERT/UPDATE guards, see `packages/projection-consumer/README.md:7`).
- **HTTP surface.** Thin Fastify bindings over QSM (`packages/bindings-http`) and command wrappers (`packages/bindings`). No first-party observability middleware yet.
- **Runtime dependencies declared.** `pnpm-workspace.yaml:1` — `packages/*`, `demo/*`. Top-level `README.md:15` states Node ≥ 20 and pnpm ≥ 9 only; no Redis, no S3, no tracing stack pinned.
- **What is intentionally absent.** No plugin/module SDK (LLM-agent artifact generation replaces third-party extensibility). No Postgres target (SQLite-dialect SQL only, Turso on the horizon). No HTTP-layer idempotency (delegated to QSM command IDs + event-store optimistic concurrency).

## How Medusa handles it

- **Storage.** Postgres via MikroORM. Migrations generated from DML at startup (survey A §5, research/medusa/packages/core/utils/src/modules-sdk/migration-scripts/migration-generate.ts:18-78). Uses JSONB, ARRAY, enum types, NUMERIC + `raw_*` JSONB twin columns for money — none of these are portable to SQLite.
- **Event bus.** Dual implementation — `event-bus-local` (in-memory `EventEmitter`) for dev and `event-bus-redis` (BullMQ on Redis) for prod, both behind `IEventBusModuleService` (survey B §3). Grouped events are released on transaction commit.
- **Workflow durability.** `TransactionCheckpoint` persisted via `IDistributedTransactionStorage`; default is in-memory, prod uses Redis/Postgres (survey B §5). On restart the orchestrator resumes from the last incomplete step.
- **File storage.** File Module with pluggable provider (local, S3, etc.). Multer `memoryStorage()` for upload staging with an explicit TODO comment about production (survey C §5). Workflow `uploadFilesWorkflow` hands off to the provider.
- **Observability.** Not first-class in Medusa either — Medusa relies on operator-wired loggers and error handlers (survey C §6 shows only a standardized error envelope). There is no mandated tracing or metrics abstraction.
- **Webhooks.** Only inbound payment-provider hooks (`/hooks/payment/:provider` with preserved raw body for signature verification, survey C §7). No outbound webhook registration API.

## Gaps for commerce-class case

#### Turso migration path

- **Constraint.** SQL stays SQLite-dialect. Postgres is **not** a target. Turso (libsql) is the platform vision's answer to "how do we scale the DB" — any SQL we emit from graph-IR-compiler, QSM, PDM, event-store, or projection-consumer must remain a strict subset of SQLite syntax.
- **Test plan.** Run the full rntme test suite under two back-ends: `turso db shell` against a hosted Turso DB, and a local `libsql-server` in edge-replica mode. Both must pass byte-for-byte the same SQL the tests already emit against `better-sqlite3`. Add a CI job (matrix: `sqlite`, `turso-cli`, `libsql-server`) once Turso is stable at our volumes. Today the emitted DDL at `packages/event-store/src/store/schema.ts:3` uses only portable constructs (`INTEGER PRIMARY KEY AUTOINCREMENT`, `TEXT`, `UNIQUE`, `CREATE INDEX IF NOT EXISTS`) — good baseline.
- **Expected incompatibilities.** Window functions (SQLite supports the standard subset only — no Postgres-extension syntax like `FILTER (WHERE ...)` on every aggregate, no `WITHIN GROUP`); FTS variants (FTS5 only — no FTS3/FTS4 reliance, no Postgres `tsvector`/`tsquery`); no `JSONB` (use `TEXT` + `json_extract()`); no `ARRAY` (serialize to JSON array in TEXT); no `gen_random_uuid()` (generate UUIDs in application layer and pass as bound `TEXT` parameters, as rntme already does — see `packages/event-store/README.md:32` `eventId: crypto.randomUUID()`); no `ltree`, `tsvector`, `citext`. Document workarounds in `packages/graph-ir-compiler/README.md` when a Medusa-equivalent feature is requested.
- **Cut-over criteria.** Move a service's store from local SQLite to libsql server when any of: (a) concurrent-writer contention exceeds SQLite's single-writer throughput under load tests, (b) read-replica fan-out is needed for business-user-facing UI traffic at edge, (c) operational DR/backup policy requires managed replication. Migration is drop-in — same SQL, same schema — only the connection URL changes.

### [P1] [non-blocker] Turso (libsql) compatibility audit

**Why critical / DX impact.** rntme's scale-up story is Turso. If we accumulate SQL idioms that `better-sqlite3` tolerates but libsql rejects (e.g., non-standard PRAGMA sequences, obscure collations, implicit `ROWID` tricks), we will hit them late. A CI audit keeps the door open cheaply.

**Pain point in rntme today** (concrete pattern/line). DDL and prepared statements are scattered across `packages/event-store/src/store/sqlite.ts:39`, `packages/event-store/src/store/schema.ts:3`, and the QSM/graph-IR compiler output. No single SQL-linter step ensures Turso-subset conformance; we rely on `better-sqlite3` behaviour.

**Medusa reference**. No direct Medusa analogue — Medusa is single-engine (Postgres) and therefore never audits for a second dialect. This is a rntme-specific concern driven by the SQLite/Turso commitment.

**Authorability / visualization** — A Turso-conformance CI matrix appears as a badge next to `CI` in `README.md:3`. Authors write schema and migrations in one dialect; a lint rule rejects forbidden constructs (`gen_random_uuid()`, `JSONB`, `tsvector`) with a hint pointing at the workaround. Visualization: a per-package "Turso-ready" checkmark in the package index table, updated by CI.

### [P1] [non-blocker] Observability — structured logs, traces, metrics, and projection DLQ

**Why critical / DX impact.** The event pipeline is the spine. When Kafka sends fail, `packages/event-store/src/relay/loop.ts:65` logs to `console.error` and retries forever with capped backoff — no traces, no metrics, no DLQ. Same for projection apply errors (`packages/projection-consumer/src/consumer.ts:42` calls `onError` or rethrows). Operators cannot answer "which stream is stuck, for how long, and why?" without grepping stdout.

**Pain point in rntme today** (concrete pattern/line). `console.error('[relay] kafka send failed, will retry:', err)` at `packages/event-store/src/relay/loop.ts:29` is the observability surface. No structured logger, no OpenTelemetry span around `kafka.send` or `applyEvent`, no metric for `relay_lag = max(event_log.id) − publish_cursor.last_event_id`, no dead-letter topic when a single envelope poisons a batch forever.

**Medusa reference**. Medusa has no first-party observability either (survey B/C do not surface one). Its error envelope (research/medusa/packages/core/framework/src/http/middlewares/error-handler.ts:36) is the closest thing. So this gap is a rntme-native design choice, not a catch-up item — but commerce-class demos need it.

**Authorability / visualization** — Expose a thin `@rntme/observability` package (pino wrapper + optional OpenTelemetry emit, opt-in). Authors add `{ logger, tracer }` to relay/consumer options; operators see spans for `relay.send`, `projection.apply_batch`, `event_store.append_events` with stream IDs as tags. A Grafana-ready dashboard spec (relay lag gauge, projection lag gauge, DLQ count) ships as a doc. Business-user visualization: a read-only HTTP route `GET /v1/_ops/pipeline-lag` that surfaces the cursor gap per relay.

### [P1] [non-blocker] Redis for low-latency pub/sub and cache — scope question

**Why critical / DX impact.** Medusa uses Redis for its production event bus (BullMQ) and for workflow-checkpoint storage. rntme uses Kafka for cross-service eventing, which is higher-latency than Redis pub/sub. Some UI-facing needs (cache, short-lived locks, websocket broadcast) are better served by Redis than Kafka. The question is whether rntme should own a Redis integration or delegate to ksqlDB/Kafka Streams for the stream-transform use-case.

**Pain point in rntme today** (concrete pattern/line). No caching layer in `packages/bindings-http`; every query hits SQLite. No broadcast mechanism for "new event on stream X" to a live UI except "poll the read model". `packages/event-store/src/relay/loop.ts:23` polls every 100 ms — fine for durability, poor for UI push.

**Medusa reference**. `research/medusa/packages/modules/event-bus-redis/src/services/event-bus-redis.ts:50-96` shows Medusa's Redis + BullMQ queue pattern; survey B §3 contrasts it with the local EventEmitter. Medusa treats Redis as a first-class infra dependency for production.

**Authorability / visualization** — Decide explicitly: **(a)** ksqlDB + Kafka covers stream transforms and broadcast fan-out, Redis is optional at the operator's discretion; or **(b)** add a `@rntme/pubsub-redis` package that subscribes to Kafka topics and re-broadcasts for low-latency UI needs. Either way, document the decision in the platform vision. Visualization: the platform-architecture diagram in the top-level `README.md:7` should show the Kafka/ksqlDB/Redis boundary unambiguously.

### [P2] [non-blocker] File/object storage abstraction

**Why critical / DX impact.** Commerce-class demos need uploads (product images, attachments, invoices). rntme today has no upload story; the issue-tracker demo never touches files. A pluggable storage provider is required before the next demo that involves media.

**Pain point in rntme today** (concrete pattern/line). `packages/bindings-http` has no multipart handler. There is no `@rntme/storage` package in `pnpm-workspace.yaml:1`. Adding an upload route today means reaching for raw Fastify multipart plugins inline in a demo.

**Medusa reference**. `research/medusa/packages/medusa/src/api/admin/uploads/route.ts:9-34` shows the pattern: multipart upload → base64 buffer → `uploadFilesWorkflow` → File Module with local/S3 provider. Multer `memoryStorage()` with an explicit production TODO (survey C §5) is the reference staging pattern.

**Authorability / visualization** — Author-facing: `defineFileField({ storage: 's3' | 'local' })` in PDM; the binding layer wires multipart → temp buffer → storage driver → URL persisted in the read model. Visualization: storage provider shows up in the architecture diagram alongside Kafka and SQLite; per-provider health appears in `_ops` diagnostics. No SQL schema change needed — URLs are plain `TEXT`, SQLite-compatible.

### [P2] [non-blocker] Snapshotting for event-store on long-lived aggregates

**Why critical / DX impact.** `event_log` grows unbounded; replaying a 10-year-old `Store` aggregate to rebuild state is linear in event count. For commerce-class demos with long-lived entities (carts that never complete, catalog items edited for years), snapshot support becomes a performance gate.

**Pain point in rntme today** (concrete pattern/line). `packages/event-store/src/store/sqlite.ts:99` — `readStream` returns `SELECT * FROM event_log WHERE stream = ? ORDER BY version ASC` with no snapshot join, no version floor. The schema (`packages/event-store/src/store/schema.ts:3`) has no `snapshot` table.

**Medusa reference**. No direct Medusa analogue — Medusa is state-based (row in Postgres), not event-sourced, so snapshotting is not a concept there. The closest is `TransactionCheckpoint` for workflow resumption (survey B §5), which serves a different purpose (workflow state, not aggregate state).

**Authorability / visualization** — Add `snapshot(stream, version, state_json)` with `UNIQUE(stream, version)` — pure SQLite/Turso-compatible. Replay code checks for the latest snapshot `≤ requested_version`, then reads `event_log WHERE stream = ? AND version > snapshot_version`. Authoring: opt-in per aggregate type via PDM metadata; a background job writes snapshots every N events or on a schedule. Visualization: per-stream "last snapshot at version V" appears in aggregate inspector UI for business users auditing long-lived entities.

## Intersections with out-of-scope

- **Plugin / module extensibility SDK (out of scope).** Medusa exposes a rich `ModuleExports` contract (survey B §1) so third parties can ship modules. rntme deliberately does **not** ship a plugin SDK — the platform vision replaces third-party extensibility with **LLM-agent-driven artifact generation**. New per-service runtimes are scaffolded and modified by agents against the graph-IR / PDM / QSM surface, not by third-party developers shipping npm packages. Observability and storage providers below therefore stay first-party (rntme-owned packages) rather than open extension points.
- **Cross-service sagas (out of scope for this doc).** Zeebe owns cross-service orchestration per the platform vision. Workflow-checkpointing gaps (Medusa's `TransactionCheckpoint`) belong in the Zeebe-integration surface, not in this infra/operability doc.
- **Sync RPC (out of scope).** gRPC between services is the platform answer to synchronous cross-service calls; rntme's Kafka path is async-first. Any "add RPC transport" requests route there, not here.
- **Multi-tenancy at the DML level (out of scope).** Survey A §6 shows Medusa treats tenancy as a query-layer concern, not DML. rntme follows the same split; infra does not need a tenant primitive.

## Open questions

- **Does rntme own an observability abstraction (pino wrapper + OpenTelemetry emit), or is it the operator's responsibility?** The P1 gap above proposes a thin `@rntme/observability` package, but the alternative is to stay library-free and document the integration points (same stance Medusa takes). Decision impacts whether relay/consumer options grow a `{ logger, tracer }` pair or stay minimal.
- **Redis: first-party or delegate to ksqlDB?** If ksqlDB can cover every low-latency pub/sub and cache scenario we care about, Redis stays out. If not, we commit to a `@rntme/pubsub-redis` package. Needs a concrete demo workload to decide.
- **Turso cut-over trigger.** What concrete load metric (writes/sec, p99 latency, replica-lag SLO) flips a service from embedded SQLite to libsql server? Needs a load-test bench before we can set numbers.
- **DLQ policy.** When a projection event poisons a batch, do we (a) halt the consumer and page, (b) route to a DLQ topic and continue, or (c) split-and-retry (process all but the poison event)? Medusa does not have a direct answer; this is a rntme-native design call.
- **Snapshot cadence and retention.** Every N events? Time-based? Retain all snapshots or only the latest? Depends on replay-latency SLOs from real demo aggregates.
- **Object storage: local-first or cloud-first default?** Medusa's File Module defaults to local; rntme demos run in Coolify on a single host — local is fine for now, but the abstraction should be ready for S3-compatible drop-in.
