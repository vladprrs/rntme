> Status: historical.
> Date: 2026-04-15.
> Current source: docs/decision-system.md, docs/current/owners/packages/runtime/event-store.md, docs/current/owners/packages/runtime/projection-consumer.md, and current code/tests.
> Why retained: ADR rationale for event-log/outbox and delivery decisions; it is not current-state truth by itself.

# ADR 2026-04-15 · Event-Driven Architecture of rntme

**Status:** Proposed — analysis artifact.
**Scope:** command path, event store, relay, projection consumer, Kafka surface, schema evolution.
**Non-goals:** cross-service saga orchestration (Zeebe territory), read-side SQL dialect (covered by Turso ADR), UI artifact format.

This ADR defines the canonical event-driven architecture for a rntme service. Each decision answers one design question with alternatives explicitly weighed. Where this historical design differs from the current implementation, use current owner docs, live gap docs, and code/tests instead of this ADR as current-state truth.

**Note on implementation commitment.** This document is an analysis artifact. Accepting or scheduling any specific decision is a separate product-value call made per decision, per release, against the gaps backlog. The ADR does not obligate the platform to implement every decision; it records what the canonical design looks like so product prioritization has an honest baseline.

---

## Context

rntme is a per-service CQRS / Event-Sourced backend-authoring toolkit. An LLM agent authors five JSON artifacts (PDM, QSM, Graph IR, Bindings, UI). The toolchain compiles them into a runnable service backed by SQLite, with a Kafka relay publishing committed events for other services.

Architectural constraints that shape every decision below:

1. **Per-service autonomy.** Each rntme service runs with one SQLite file and one optional Kafka connection. No shared DB, no shared runtime, no mandatory broker on boot.
2. **Turso migration path.** SQL stays SQLite-dialect. The event store must remain a strict subset of SQLite syntax compatible with libsql.
3. **Zeebe owns cross-service orchestration.** rntme does NOT implement sagas, compensations, or timer-driven commands. Those live one layer up (BPMN → Zeebe → gRPC to rntme commands).
4. **LLM-agent authoring.** Artifacts are produced by an agent, reviewed by a human, and compiled. Anything not expressible in artifacts cannot ship. Decisions below favour mechanisms that surface in artifacts over runtime-only behaviours.
5. **Read-your-writes is a product requirement.** Authoring UX expects `POST /x` → `GET /x` consistency within the same request chain. Any architecture that violates this is rejected, regardless of canonical pedigree.

Canon references (Confluent, Kleppmann, Stopford, CloudEvents) are cited per decision, not tallied here.

---

## D1 · Outbox shape

**Question.** How is every committed event guaranteed to reach Kafka?

**Alternatives considered.**

- **(a)** `event_log` doubles as outbox; a separate `publish_cursor(relay_id, last_event_id)` tracks bulk progress. Single append-only table.
- **(b)** Separate `outbox` table written in the same transaction as `event_log`; relay drains `outbox` and deletes rows on success.
- **(c)** CDC via SQLite WAL tailing (Debezium-style). Not applicable today — SQLite has no standard changefeed; libsql may expose one later.

**Decision.** **(a) with operational enrichment.** The event log IS the outbox — the Stopford / Kleppmann position that "log IS the outbox" applies natively to event-sourced systems. But the current `publish_cursor`-only model gives no per-event telemetry. Add a companion `delivery_tracking(event_id PRIMARY KEY, first_attempt_at, last_attempt_at, attempt_count, last_error, delivered_at, dlq_at)` table. `event_log` stays immutable; `delivery_tracking` is mutable and populated by the relay. `publish_cursor` stays as bulk progress marker — new relays / backfilling relays rely on it.

**Rationale.** Splitting event log and outbox into two tables (option b) creates two sources of truth and a write-amplification cost on the hot path. Keeping log authoritative and delivery state separate mirrors the Confluent pattern and surfaces operational metrics (retry count, last error, DLQ state) without touching the immutable log.

**Consequences.**

- Schema additions: one new table; no changes to `event_log`.
- Relay writes `delivery_tracking` rows on each attempt; transactional coupling is not required (delivery state is derived, not authoritative).
- Dashboards can compute `relay_lag = max(event_log.id) - publish_cursor.last_event_id` and `parked_count = count(delivery_tracking) WHERE dlq_at IS NOT NULL`.
- Interacts with D10 (failure handling) — after a message is produced to the `.dlq` topic, the relay writes `dlq_at` for local auditability.

**Canon refs.** Stopford, *Designing Event-Driven Systems* ch. 2. Kleppmann, "Turning the database inside-out". Confluent developer course, "Transactional Outbox" — Waldron explicitly notes that event sourcing eliminates the need for a separate outbox table.

---

## D2 · Write-path topology

**Question.** On an inbound command, does the service write to SQLite first (and publish async), or publish to Kafka first (and consume its own publication)?

**Alternatives considered.**

- **(a)** Write-behind: command → SQLite append (sync) → ack → async Kafka relay.
- **(b)** Listen to Yourself: command → Kafka publish (sync) → ack → self-consume → SQLite write.
- **(c)** Hybrid: some commands (a), some (b), author-selected per command.

**Decision.** **(a).** Write-behind with embedded outbox (see D1).

**Rationale.**

- (b) breaks read-your-writes. Between HTTP `200 OK` and the self-consumer applying the event to the read-side, the service cannot answer a follow-up query about the aggregate just created. This violates Context §5 — a product-level veto, not a stylistic choice.
- (b) makes Kafka a hard runtime dependency for the write path. A service must be bootable, testable, and demo-usable with SQLite alone. Kafka goes on an optional durability tier.
- (c) doubles the surface the LLM agent must learn without clear payoff — interactive commerce-style flows are the common case, and they're exactly the ones that need (a).
- (b)'s supposed advantage — "one fewer write" — is negligible when the first write is a local SQLite fsync (~100µs on modern NVMe; faster on Turso). Not worth the semantic cost.

**Consequences.**

- Command handler is synchronous w.r.t. SQLite; user sees the commit in their own follow-up reads.
- Kafka outage does not block writes — events accumulate in `event_log`, relay catches up when Kafka returns.
- Command path remains stateless w.r.t. Kafka; relay is the only component that touches it.

**Canon refs.** Confluent developer course, "The Listen to Yourself Pattern" — Waldron notes LtY leaves the service eventually consistent; fits only when downstream queries can tolerate it. Jimmy Bogard, *Refactoring Towards Resilience* — lands on Outbox, not LtY.

---

## D3 · Source-of-truth scope

**Question.** Where is the authoritative store for (a) this service's own aggregates, and (b) events consumed by other services?

**Alternatives considered.**

- **(a)** SQLite = service-local SoT. Kafka = inter-service integration SoT with **long retention or compaction** — new consumers backfill from Kafka, never from service.
- **(b)** Kafka = SoT everywhere. SQLite is disposable materialized view (Kleppmann "inside-out"). Commands take LtY path.
- **(c)** SQLite = SoT. Kafka = ephemeral transport. New consumers ask the producing service to replay from its SQLite event_log back into Kafka.

**Decision.** **(a), with ksqlDB as the canonical cross-service read layer.** Three authorities:

- **Write-side per-service SoT: SQLite `event_log`.** Owns causal history of this service's aggregates. Source for state rebuild, local queries, audit.
- **Inter-service integration SoT: Kafka topics** (configured with long retention, compacted where appropriate). This is the raw integration layer — the durable, replayable log of every domain event emitted by every service.
- **Inter-service read model: ksqlDB** streams and tables. New services consuming another service's events do not typically subscribe to raw Kafka topics — they query ksqlDB streams/tables derived from those topics. ksqlDB owns the joins, windowed aggregations, and enrichment that individual services would otherwise re-implement.

**Rationale.**

- (b) conflicts with D2 (requires LtY) and with rntme's SQLite-first boot model.
- (c) creates a hidden coupling: every producer must expose a replay endpoint and every new consumer must negotiate backfill. That is the anti-pattern the whitepaper explicitly calls out ("expose an endpoint on the producer side, and use this endpoint to regenerate the desired events … we cannot guarantee that these events will be identical"). It also pushes the producer to re-emit, which violates immutability guarantees of the log.
- (a) is Confluent canon: Kafka as central log between services, producer-service owns its local state. It cleanly lets a new service join the ecosystem by subscribing to the right topic from offset-0, without asking any producer to do anything.
- Adding ksqlDB as the default cross-service read layer matches the Confluent whitepaper's four-layer model (native client / Kafka Connect / Kafka Streams / ksqlDB) and keeps cross-service projections out of rntme. A rntme service's QSM is strictly its OWN read-side. Cross-service read models (a dashboard joining OrderPlaced with CustomerCreated from another service, a risk score combining payment + inventory signals) live in ksqlDB, not inside a rntme service.

**Consequences — retention becomes a contract; ksqlDB becomes platform infrastructure.**

- Production Kafka config: `retention.ms = -1` (infinite) OR compacted topics for aggregate-current-state events. This must be a platform-level deployment policy, not per-service tuning.
- Compacted topics require a stable key per aggregate (see D6 — `key = stream`).
- For events that are not compact-able (command-driven business events where every occurrence matters), configure long retention + tiered storage (if available on the broker).
- Service can rebuild its OWN state from its own SQLite (faster, local). Other services see this service's events through Kafka and, typically, through ksqlDB-derived streams/tables rather than raw topics.
- rntme's projection-consumer remains service-local. Cross-service projections are ksqlDB's job — explicitly out of scope for rntme artifacts. This boundary clarifies why QSM stays entity-mirror-focused and why cross-aggregate joins belong one layer up.
- Demo runtime uses in-memory Kafka → no retention → zero-history for new consumers. Document this as "demo-only". Production must have retention. ksqlDB is not wired in the demo; production platform provides it.

**Canon refs.** Stopford, *Designing Event-Driven Systems* ch. 4-5 ("Kafka as central nervous system"). Confluent whitepaper (2020), §"The Four Layers of Abstraction" — ksqlDB as streaming-SQL layer. Kleppmann, "Making sense of stream processing".

---

## D4 · Delivery semantics

**Question.** What delivery guarantee does the relay-to-consumer path provide?

**Alternatives considered.**

- **(a)** at-least-once + idempotent consumer.
- **(b)** end-to-end exactly-once via Kafka transactions — impossible for SQLite sink without 2PC between Kafka and SQLite.
- **(c)** at-most-once — data loss unacceptable.

**Decision.** **(a).** At-least-once delivery. Consumer idempotency is a hard requirement (see D5).

**Rationale.** EOS in Kafka is exactly-once *within* Kafka (consume-transform-produce). As soon as the sink is an external store (SQLite), EOS does not apply — Confluent docs are explicit: "when writing to an external system, the limitation is in the need to coordinate the consumer's position with what is actually stored as output." The options are 2PC (rejected — out of scope, brittle, and Confluent-discouraged) or idempotent sink writes (canonical). We pick the canonical path.

**Consequences.**

- Every projection must be idempotent by construction.
- Producer enables `enable.idempotence=true` to avoid duplicates within Kafka itself (cheap, default since Kafka 3.0).
- No transactional producer (`transactional.id`) is configured — nothing to coordinate across.

**Canon refs.** Confluent, "Exactly-Once Semantics Are Possible" (Narkhede). Confluent docs, "Message Delivery Guarantees".

---

## D5 · Consumer idempotency strategy

**Question.** How does the projection consumer dedupe a re-delivered event?

**Alternatives considered.**

- **(a)** Per-row `last_event_version` on the projection row. Works for entity-mirror only (one aggregate → one row).
- **(b)** Universal `seen_events(event_id)` table — reject events whose id is already applied.
- **(c)** Per-batch `(topic, partition, offset)` dedup table.
- **(d)** Hybrid: (a) for entity-mirror; (b) for non-mirror projections (counters, windowed aggregates, top-N leaderboards).

**Decision.** **(d).** Keep per-row `last_event_version` for entity-mirror projections (canonical Confluent "Idempotent Writer" pattern). Add `seen_events(event_id TEXT PK, applied_at TEXT, projection_id TEXT)` for non-mirror projections. QSM artifact declares which idempotency strategy each projection uses.

**Rationale.**

- (a) alone is strictly limited: a counter `UPDATE … SET n = n + 1` is not idempotent under replay; no version column on a scalar. Every non-mirror projection today is blocked (this is why QSM accepts only `entity-mirror` per MVP).
- (b) works universally but adds 1 row per event forever (or within a retention window) — storage cost but no correctness cost.
- (c) breaks when Kafka partition assignment changes (repartition, replay from mirror, consumer-group rebalance with different semantics). Confluent docs prefer business-key-based dedup over offset-based.
- (d) is strictly stronger than any single option and matches Confluent's guidance: use business key (here: per-row version) when available, fall back to `event_id` seen-set when not.

**Consequences.**

- `seen_events` gets a retention policy (default: 30 days, purged by background job) — retention must exceed max expected replay window.
- QSM artifact adds `idempotency: "entity-mirror" | "seen-events"` per projection.
- Projection-consumer gains a pre-apply check against `seen_events` when the projection declares `seen-events`.
- Counters, sliding-window aggregates, top-N leaderboards become authorable in QSM.

**Canon refs.** developer.confluent.io/patterns/event-processing/idempotent-writer, /idempotent-reader. Confluent docs, "Handling duplicates in idempotent consumers".

---

## D6 · Topic and partition-key strategy

**Question.** How are events routed to Kafka topics and partitions?

**Alternatives considered.**

- **(a)** Topic per aggregate type; partition key = `stream` (= `{aggregateType}-{aggregateId}`).
- **(b)** Single topic per service; partition key = stream.
- **(c)** Topic per event-type; partition key = stream.

**Decision.** **(a).** Topic per aggregate type. Partition key = stream. Naming: `rntme.{serviceName}.{aggregateType}.v{major}` (where `v{major}` is event-schema major version, not runtime version).

**Rationale.**

- Per-aggregate ordering requires same partition key for all events of one aggregate — all three options preserve this via `key = stream`.
- Topic granularity choice: (a) lets consumers subscribe to exactly the aggregate types they care about, without receiving unrelated noise; matches the Debezium Outbox Event Router convention. (b) forces every consumer to read everything and filter client-side — wasteful at scale. (c) makes cross-event-type per-aggregate ordering awkward (events for one aggregate split across multiple topics lose their natural ordering guarantee).
- Adding the service name to the topic prefix prevents global collisions when multiple rntme services emit the same aggregate-type name.

**Consequences.**

- Topic provisioning is part of service-deploy. `pnpm build` generates a `topics.json` from PDM aggregates for provisioning automation.
- Downstream consumers can subscribe precisely.
- Hot-partition risk: if a single aggregate id has 90 % of traffic, one partition saturates. Mitigation is a design signal (aggregate too coarse) rather than a partitioning trick — rewrite the aggregate, don't composite the key.

**Canon refs.** Confluent, "Apache Kafka Partition Key: A Comprehensive Guide". Stopford, *Designing Event-Driven Systems* ch. 6.

---

## D7 · Relay mechanism

**Question.** How does the relay detect newly-committed events?

**Alternatives considered.**

- **(a)** Polling with cursor — reads `event_log WHERE id > cursor`.
- **(b)** CDC via WAL tailing — SQLite has no standard changefeed; libsql may expose one.
- **(c)** In-process hook in `appendEvents` that wakes a publish task.

**Decision.** **(a) with (c) as latency optimization.** A crash-safe polling loop is the durability mechanism. In the happy path, the `appendEvents` code path also signals an in-memory condvar that wakes the polling loop immediately, reducing tail latency from ~poll-interval (100 ms) to ~1 ms. The cursor remains the durability boundary — the condvar is advisory.

**Rationale.**

- (a) alone: simple, durable, but tail latency equals poll interval.
- (b) alone: SQLite standard API has no WAL tail hook; libsql roadmap may add one. Not available today. Revisit when Turso/libsql exposes changefeeds.
- (c) alone: crash window — event committed, hook didn't fire before crash → event unpublished until next restart-with-cursor-scan. Safe only when always paired with (a).
- (a)+(c) combines durability of polling with low-latency of push.

**Consequences.**

- Tail latency ~1-5 ms under normal load.
- On crash, (c) loses nothing because (a) re-scans on restart.
- Revisit trigger for migrating to CDC: (i) polling overhead measured > 5 % CPU at target load, OR (ii) libsql exposes stable changefeed API.

**Canon refs.** Debezium Outbox Event Router (canonical CDC approach, not currently available for SQLite). Confluent, "Transactional Outbox Pattern".

---

## D8 · Schema governance

**Question.** How do event schemas evolve without silently breaking consumers?

**Alternatives considered.**

- **(a)** Int `schemaVersion` in envelope + informal peer review.
- **(b)** Confluent Schema Registry server + Avro with BACKWARD compatibility.
- **(c)** JSON Schema files per event-type in repo + CI-gate BACKWARD compatibility checker. No runtime server.

**Decision.** **(c).** Per-event JSON Schema files committed to the repo. CI step runs `json-schema-diff` (or equivalent) against the previous main-branch schema and rejects PRs that break BACKWARD compatibility (remove required field, narrow type, remove enum value, etc.). Payloads stay JSON on the wire — no Avro migration.

**Rationale.**

- (a) gives zero guarantees. An LLM-agent PR can introduce a breaking change; reviewer may not catch it; consumers break at runtime.
- (b) adds a runtime server dependency and Avro serialization cost. Overkill pre-cross-service. Registry server is the right target for the cross-service phase (when multiple services author independently against a contract); not now.
- (c) gives offline correctness guarantee with zero runtime cost. BACKWARD compat mode matches Confluent's default rationale: upgrade consumers first, producers later.

**Consequences.**

- Ties into D11: the schema files are *generated* from PDM stateMachine transitions + graph emit nodes, not hand-written.
- CI adds one check: `pnpm schema:check` compares `HEAD` schemas against `main`.
- A second deliberate gate — `pnpm schema:promote` — is required to publish a MAJOR version bump (breaking change); rarely used.
- Later migration to Schema Registry server is additive: the CI-gate stays; the server adds runtime enforcement across services.

**Canon refs.** docs.confluent.io/schema-registry/fundamentals/schema-evolution (BACKWARD mode). developer.confluent.io/courses/schema-registry/schema-subjects.

---

## D9 · Envelope format

**Question.** What fields does every event carry, and in what format?

**Alternatives considered.**

- **(a)** Custom envelope (current: `eventId`, `stream`, `aggregateType`, `aggregateId`, `version`, `eventType`, `actor`, `occurredAt`, `payload`, `schemaVersion`).
- **(b)** CloudEvents 1.0 with extensions for `correlationid`, `causationid`, `traceparent`, plus rntme-specific extension attributes.
- **(c)** Custom internal, CloudEvents only at wire boundary (Kafka headers) — internal storage stays proprietary.

**Decision.** **(b).** Envelope is CloudEvents 1.0 end-to-end: in `event_log.envelope_json`, in Kafka messages (binary content mode — CE attributes in headers, `data` in body), and in internal APIs. Fields:

| CE attribute | rntme value |
|---|---|
| `specversion` | `"1.0"` |
| `id` | UUID (was `eventId`) |
| `source` | URI: `rntme://{serviceName}/{aggregateType}` |
| `type` | Event-type FQN: `{serviceName}.{AggregateType}.{EventType}.v{major}` |
| `time` | RFC3339 timestamp (was `occurredAt`) |
| `subject` | `stream` (= `{aggregateType}-{aggregateId}`) |
| `datacontenttype` | `"application/json"` |
| `dataschema` | URI ref to generated JSON Schema (ties D8) |
| `data` | Event payload |

Extensions (lowercase alpha, per CE spec):

| Extension | Purpose |
|---|---|
| `correlationid` | Required. Propagated from originating command; stable across causal chain. |
| `causationid` | Id of immediately prior event or command. Nullable for root events. |
| `rntaggregatetype` | Kept as extension for backward routing; mirrors `source` path segment. |
| `rntaggregateid` | String id. |
| `rntversion` | Integer stream version (was `version`). |
| `rntschemaversion` | Integer schema version (was `schemaVersion`). |
| `rntactorkind` / `rntactorid` | Was `actor`. |
| `traceparent` | W3C Trace Context (optional, for OpenTelemetry propagation). |

**Rationale.**

- (a) is proprietary. Every cross-service consumer needs bespoke mapping. No tooling. Breaks the moment Zeebe tries to correlate.
- (c) splits the format across a wire boundary — internal code stays unaware of CE, loses value in internal consumers, and forces the mapping layer to exist. Fragile.
- (b) gives a single format everywhere. CloudEvents SDKs exist for the languages Zeebe and downstream consumers may use. Correlation and causation become first-class.

**Consequences.**

- One-time envelope migration: update event-store schema (rename / split columns), adjust relay to emit CE binary content mode over Kafka, migrate tests.
- `correlationId` must be propagated from HTTP layer → command handler → event. Bindings-http middleware reads `Correlation-Id` or `traceparent` header; command handler plumbs it through.
- `causationId`: for root commands, null. For events that reduce a prior event, previous event's id.
- rntme-specific extensions are deliberately namespaced with `rnt` prefix to avoid collision with future standard extensions.

**Canon refs.** CloudEvents 1.0 spec. CloudEvents Kafka protocol binding. OpenTelemetry W3C Trace Context.

---

## D10 · Failure handling in relay (DLQ strategy)

**Question.** What happens when Kafka send fails past N retries? (This question does not have a deliberate answer in the current implementation — infinite retry is an omission, not a decision.)

**Alternatives considered.**

- **(a)** Infinite retry + exp backoff (status quo — rejected).
- **(b)** Max-attempts + dedicated DLQ Kafka topic. Canonical.
- **(c)** Max-attempts + parking in `delivery_tracking` (SQLite row marked `dlq_at`, `last_error`). Single-node model.

**Decision.** **(b).** Dedicated DLQ Kafka topic is the canonical pattern and the default for rntme. Default config: `max_attempts = 10`, exp backoff capped at 30 s, after exhaustion relay produces the failed envelope (plus error metadata — `last_error`, `attempt_count`, `first_attempt_at`) to a DLQ topic named `{originalTopic}.dlq`, marks `delivery_tracking.dlq_at`, advances `publish_cursor`, continues. Operator tooling consumes the DLQ topic (standard Kafka consumer) rather than reading SQLite rows.

**Rationale.**

- (a) lets one poison event silently halt the entire relay. Lag grows unbounded. Unacceptable at any scale.
- (b) is Kafka-canonical. Kafka Connect defines DLQ semantics natively (`errors.tolerance = all`, `errors.deadletterqueue.topic.name`). Any downstream tooling (ksqlDB DLQ dashboards, Kafka monitoring stacks, replay scripts) speaks this dialect. Aligns with D3 — DLQ is itself an inter-service contract surface, belongs in Kafka.
- (c) local parking was considered because rntme is per-service SQLite. Rejected: it fragments DLQ tooling across services, makes cross-service DLQ dashboards impossible, and offers no real advantage over (b) once a real broker is assumed (and D3 already assumes one for production).

**Consequences.**

- Relay loop advances past poison events; subsequent events are not blocked.
- DLQ topic is part of service deployment. Provisioning automation (from D6 topic generator) emits the DLQ topic alongside the primary topic.
- `delivery_tracking.dlq_at` still set for local auditability — but the authoritative DLQ is the Kafka topic.
- Poison-event classification: retryable = connection refused, broker unavailable, timeout. Terminal = schema violations, serialization errors, authorization failures, message-too-large → DLQ on first attempt.
- Demo runtime's in-memory Kafka bridge must implement DLQ topic semantics (or the demo tests must accept retries without DLQ). Platform contract: real brokers have DLQ; demo bridge is best-effort.

**Canon refs.** Confluent, "Handling failure with Kafka dead letter queues". Kafka Connect default DLQ semantics (`errors.deadletterqueue.*`). Stopford, *Designing Event-Driven Systems* — failure-handling chapter.

---

## D11 · Event-shape registry

**Question.** Where are event-type definitions stored, and who generates them?

**Alternatives considered.**

- **(a)** Implicit — event shapes live only in PDM stateMachine transitions; no standalone readable artifact. The compiler derives them on every run.
- **(b)** Per-service registry generated at build time from PDM: JSON Schema files per `(eventType, majorVersion)`, committed to the repo.
- **(c)** Central platform Schema Registry server (Confluent or compatible).

**Decision.** **(b).** Build step generates `schemas/<EventType>.v{N}.json` **from PDM alone** — specifically from `deriveEventTypes(pdm)` in `packages/pdm/src/derive/event-types.ts`, which already produces `EventTypeSpec[]` with full `payloadFields` shape per transition. The registry is a thin serializer: `EventTypeSpec → JSON Schema`, one file per event type, committed to the repo.

**Rationale.**

- Event shape is determined by the PDM stateMachine transition that produces the event — `transition.affects` + state-field + entity field types. Graph `emit` nodes reference these event types and bind runtime expressions to their fields; they do NOT alter the shape. Including graphs in registry generation would be wrong — they are the *how* (how to populate a payload at runtime), not the *what* (what fields exist).
- (a) scatters nothing (PDM is already the single source) but forces anyone — LLM-agent, reviewer, downstream consumer — to run `deriveEventTypes()` mentally to know what an event type contains. A file-on-disk registry makes the shape readable, diff-able, and externally linkable (see CloudEvents `dataschema` in D9).
- (c) is the right cross-service solution. Too heavy for a per-service pre-Zeebe runtime. Introduce when platform-wide governance exists and multiple services need runtime enforcement of contracts.

**Consequences.**

- Thin new module in `@rntme/pdm` (or sibling `@rntme/schema-codec`): `eventTypeSpecToJsonSchema(spec: EventTypeSpec) → JSONSchema`.
- `pnpm build` produces `schemas/<EventType>.v{major}.json` per service. Committed to repo; CI gate (D8) enforces they match PDM.
- Consumers outside rntme (Zeebe, dashboards, other services, ksqlDB DDL generators) read `schemas/*.json` directly or via a published npm package.
- Ties into D8: schema files are the input to the BACKWARD compat-checker.
- Ties into D9: CloudEvents `dataschema` URI points to the schema file.

**Canon refs.** Confluent Schema Registry (concept, not server — we adopt the structure, defer the service). CloudEvents `dataschema` attribute (D9). `packages/pdm/src/derive/event-types.ts` — existing derivation used as input.

---

## D12 · Command idempotency (HTTP retry safety)

**Question.** If a client retries a POST after a network blip, how does the server avoid applying the command twice?

**Alternatives considered.**

- **(a)** Rely on OCC: second attempt produces `COMMAND_CONCURRENCY_CONFLICT` because aggregate state changed.
- **(b)** `Idempotency-Key` HTTP header + server-side response cache keyed on `(commandId, key)`.
- **(c)** Client-generated stable `commandId` in body — natural dedup key.

**Decision.** **(b).** Bindings-http middleware reads `Idempotency-Key` header. Keyed cache `idempotency_cache(command_id TEXT, key TEXT, response_json TEXT, created_at TEXT, PRIMARY KEY (command_id, key))`. On cache hit: replay cached response (same status + body). On miss: execute command; cache result. Retention: 24h (configurable). `executeCommand` gains an optional `idempotencyKey` parameter for non-HTTP callers (gRPC, internal).

**Rationale.**

- (a) fails two ways. (i) For idempotent-by-domain commands (e.g. "add line item"), OCC does NOT detect duplicates — both appends succeed, double work happens. (ii) Even when OCC catches it, the client receives an error and cannot distinguish "original succeeded, response lost" from "real failure". Client retry loop has no correct action.
- (c) works when the domain naturally has a stable external id, but forces every command shape to include one. Couples domain modeling to dedup.
- (b) is the Stripe-standard pattern. Header is optional (callers that don't care ignore it); cached response survives client retry; key scope is 24h which covers reasonable retry windows.

**Consequences.**

- New table `idempotency_cache`.
- Bindings-http middleware adds ~5 LOC per command route.
- `executeCommand` signature becomes additive: `(compiled, params, ctx, opts?: { idempotencyKey?: string })`.
- OpenAPI emission includes `Idempotency-Key` header parameter on mutating operations.
- Cross-links with `docs/gaps/commands-and-transactions-gaps.md` (P1 — idempotency on API-level command retries).

**Canon refs.** Stripe API Idempotent Requests docs. RFC draft `draft-ietf-httpapi-idempotency-key-header`. Medusa `TransactionMetadata.idempotencyKey` (conceptual parallel).

---

## Explicitly rejected alternatives (cross-cutting)

These options are coherent, written up in the canon, and will not be adopted. Listed so that re-opens later cite this ADR.

- **Two-phase commit / XA between Kafka and SQLite.** Confluent-discouraged; KIP-939 frames 2PC as a niche recovery option, not a default. Rntme has the idempotent-consumer path instead.
- **Raw CDC on domain tables (Debezium without Outbox Event Router).** Emits row-delta events coupled to storage schema. Breaks the clean domain-event contract.
- **Single global Kafka topic.** Forces every consumer to read everything; scaling ceiling; naming collision risk.
- **Kafka as per-service write SoT (pure LtY architecture).** Violates D2 (read-your-writes) and D3 (SQLite-first boot).
- **Re-introducing a separate `outbox` table alongside `event_log`.** Creates two sources of truth; write amplification; Confluent guidance for event-sourced systems says no.
- **HTTP long-poll for event notifications to UI.** Out of scope for this ADR (UI ADR territory); mentioned because adjacent.

---

## Consequences summary

Where this ADR converges with current code:

- D1 event-log-as-outbox (with added delivery_tracking).
- D2 write-behind topology.
- D3 SoT split (implicit today, contract-ified here).
- D4 at-least-once semantics.
- D6 topic-per-aggregate + partition-by-stream.
- D7 polling relay.

Where this ADR diverges from current code (ranked by blast radius):

- **D9 envelope → CloudEvents 1.0.** Breaking envelope migration.
- **D11 schema registry (generated).** New package, build step, CI gate.
- **D5 hybrid idempotency.** Unblocks non-mirror projections; new QSM field; seen_events table.
- **D10 DLQ via delivery_tracking.dlq_at.** New column, relay loop change, operator tools.
- **D12 idempotency-key middleware.** New table, middleware, OpenAPI emission.
- **D8 schema-compat CI gate.** New script, PR gate.
- **D1 delivery_tracking additions.** New table; additive to relay.

Current eventing gaps live in `docs/gaps/**` and the current runtime owner docs. This ADR is retained as rationale only.

---

## References

- Confluent, *Event-Driven Microservices* whitepaper (2020) — `/20201028-WP-Event_Driven_Microservices.pdf` in this repo.
- Ben Stopford, *Designing Event-Driven Systems* (O'Reilly / Confluent).
- Martin Kleppmann, "Turning the Database Inside-Out".
- Wade Waldron, "The Transactional Outbox Pattern" — developer.confluent.io.
- Wade Waldron, "The Listen to Yourself Pattern" — developer.confluent.io.
- Jimmy Bogard, *Refactoring Towards Resilience* series.
- CloudEvents 1.0 specification — `github.com/cloudevents/spec`.
- CloudEvents Kafka protocol binding.
- Confluent, "Exactly-Once Semantics Are Possible" — Narkhede.
- Confluent Schema Registry — schema-evolution fundamentals.
- Confluent, "Apache Kafka Partition Key: A Comprehensive Guide".
- Debezium, "Outbox Event Router" SMT.
- RFC draft, "The Idempotency-Key HTTP Header Field".
- Stripe, "Idempotent Requests" (api.stripe.com/docs).

Internal:

- `docs/gaps/commands-and-transactions-gaps.md` — earlier gap analysis against Medusa, complements D12.
- `docs/gaps/infra-and-operability-gaps.md` — observability and Turso audit.
- `docs/history/specs/historical/2026-04-14-mutations-design.md` — CQRS/ES mutation design.
