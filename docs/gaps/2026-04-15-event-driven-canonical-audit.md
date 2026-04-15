# Gaps: Event-Driven Canonical Audit

**Scope.** Honest delta between the best design (per `docs/adr/2026-04-15-event-driven-architecture.md`) and the current rntme implementation. Each decision from the ADR (D1..D12) gets a verdict and — where diverged — evidence, blast radius, and a remediation sketch. This audit is not comparative against Medusa or any other product; it is canon-vs-implementation.

**Inputs.** The ADR above; `packages/event-store`, `packages/projection-consumer`, `packages/graph-ir-compiler/src/command-runtime`, `packages/bindings-http`, `demo/issue-tracker-api`. Confluent whitepaper at `/20201028-WP-Event_Driven_Microservices.pdf`. Research notes saved in the ADR's References section.

---

## Verdict matrix

| ADR | Best design | Current | Verdict |
|-----|-------------|---------|---------|
| **D1** | `event_log` + immutable log + `delivery_tracking` telemetry table | `event_log` + `publish_cursor` only | ⚠️ partial — delivery telemetry missing |
| **D2** | sync write-behind | sync write-behind | ✅ match |
| **D3** | SQLite = per-service SoT; Kafka = long-retained inter-service integration SoT | SQLite = SoT; Kafka = ephemeral (in-memory demo) | ⚠️ retention contract undocumented |
| **D4** | at-least-once + idempotent consumer | at-least-once + idempotent consumer | ✅ match |
| **D5** | hybrid: per-row `last_event_version` (mirror) **+** `seen_events(event_id)` (non-mirror) | per-row `last_event_version` only | ❌ gap — blocks non-mirror projections |
| **D6** | topic per aggregate type; partition key = stream; versioned topic name | topic per aggregate type; partition key = stream | ⚠️ topic naming missing service name |
| **D7** | polling + in-process condvar for low latency | polling only (100 ms) | ⚠️ tail-latency optimization missing |
| **D8** | per-event JSON Schema files + CI BACKWARD-compat gate | none (int `schemaVersion` field, nothing else) | ❌ gap — silent breakage possible |
| **D9** | CloudEvents 1.0 envelope end-to-end + correlationid / causationid | custom envelope; Kafka headers carry only `event-id`, `event-type`, `schema-version` | ❌ major gap — blocker for Zeebe |
| **D10** | max-attempts + `delivery_tracking.dlq_at` parking; broker-DLQ as opt-in | infinite retry + `console.error` | ❌ gap — poison events silently block relay |
| **D11** | generated per-service schema registry (JSON Schema files from PDM + graphs) | no registry; shapes scattered across artifacts | ❌ gap — no authoritative event-shape source |
| **D12** | `Idempotency-Key` header → `(commandId, key)` response cache | none; OCC-only | ❌ gap — HTTP retry unsafe |

Legend: ✅ conforms — ⚠️ partial drift — ❌ missing / must change.

---

## D1 · Outbox shape — ⚠️ partial

**Best design (ADR D1).** `event_log` is the authoritative append-only log; `publish_cursor(relay_id, last_event_id)` tracks bulk progress; a new mutable `delivery_tracking(event_id PK, first_attempt_at, last_attempt_at, attempt_count, last_error, delivered_at, dlq_at)` table records per-event delivery state.

**Current state.** `packages/event-store/src/store/schema.ts:3-28` defines `event_log` and `publish_cursor`, nothing else. `packages/event-store/src/relay/loop.ts:47-75` advances the cursor after a batch of successful sends; no per-event record of attempt count or last error survives past the in-memory `console.error` at `loop.ts:29`.

**Delta.**

- Missing table `delivery_tracking`.
- Relay loop does not record attempts.
- No surface to query "which events are slow / failing / parked".
- Operator visibility is limited to lag = `max(event_log.id) − cursor.last_event_id`.

**Remediation sketch.**

1. Add `delivery_tracking` DDL to `packages/event-store/src/store/schema.ts`.
2. Extend relay loop `packages/event-store/src/relay/loop.ts:47-77` to `UPSERT` into `delivery_tracking` before each attempt (`attempt_count += 1`, `last_attempt_at = now`); on success write `delivered_at`; on terminal failure write `dlq_at`, `last_error` (see D10).
3. Ops surface: `GET /_ops/relay-dlq`, `GET /_ops/relay-lag` (ties D10 remediation).

**Priority.** P1 — prerequisite for D10 parking behaviour.

---

## D2 · Write-path topology — ✅ match

**Best design (ADR D2).** Sync write-behind: command → SQLite append → ack → async relay.

**Current state.** `packages/graph-ir-compiler/src/command-runtime/execute.ts:42-107` — `executeCommand` synchronously reads history, validates, appends, returns. `packages/bindings-http/src/runtime/command-handler.ts:63-71` wires HTTP → `executeCommand` → JSON response, entirely in-request. Relay runs in a separate loop (`packages/event-store/src/relay/loop.ts:22-94`), no coupling to the write path.

**Delta.** None.

**Priority.** N/A (conforms).

---

## D3 · Source-of-truth scope — ⚠️ contract undocumented

**Best design (ADR D3).** SQLite = per-service command SoT. Kafka = inter-service integration SoT with long retention or compaction; new consumers backfill from Kafka history.

**Current state.** SQLite is treated as SoT by construction (relay reads from it, never writes back). Kafka topic naming (`packages/event-store/src/relay/topic.ts:1-3` — `rntme.{aggregateType.toLowerCase()}.v1`) is per-aggregate-type, consistent with D6. The demo runs an **in-memory Kafka bridge** (`docs/gaps/commands-and-transactions-gaps.md` references the swap point); production retention policy is not specified anywhere in the code or docs.

**Delta.**

- The split "SQLite = write SoT, Kafka = inter-service SoT" is implicit. No deployment doc says "production Kafka topics MUST have retention or compaction configured as follows".
- If a new service subscribes to an existing service's topic after retention expiry, it cannot backfill. This breaks the canon contract silently.
- Demo runtime uses zero-retention in-memory bridge; test coverage therefore never exercises "new-consumer-joins-after-producer-has-events" flow.

**Remediation sketch.**

1. Add `docs/adr/2026-04-15-event-driven-architecture.md` production-deployment appendix (or separate `docs/operability/kafka-retention.md`) specifying per-topic retention / compaction policy per aggregate kind.
2. `@rntme/runtime` adds a startup assertion or warning if `KafkaProducer` is configured against a broker with default (short) retention.
3. Demo can keep in-memory bridge but documentation marks it "demo-only; zero retention".

**Priority.** P2 — affects platform contract, not current functionality. Must be resolved before the second production service is deployed.

---

## D4 · Delivery semantics — ✅ match

**Best design (ADR D4).** At-least-once delivery; idempotent consumer mandatory.

**Current state.** `packages/event-store/src/relay/loop.ts:50-72` retries sends forever on failure (at-least-once producer side). `packages/projection-consumer/src/consumer.ts:30-45` wraps apply in `BEGIN IMMEDIATE … COMMIT` then `commitOffsets`. `packages/projection-consumer/src/apply/apply-event.ts:26-33` enforces idempotency on the DB side.

**Delta.** None on delivery semantics themselves. Related gaps are filed under D5 (idempotency strategy limited to entity-mirror) and D10 (infinite retry = no poison-event handling). The semantic choice is correct; the mechanics around it need work.

**Priority.** N/A.

---

## D5 · Consumer idempotency strategy — ❌ gap

**Best design (ADR D5).** Hybrid: per-row `last_event_version` for entity-mirror projections **plus** `seen_events(event_id PRIMARY KEY, applied_at, projection_id)` for non-mirror projections. QSM artifact declares the strategy per projection.

**Current state.** `packages/projection-consumer/src/apply/apply-event.ts:26-33` performs only the per-row `last_event_version` check:

```ts
const currentVersion = selectCurrentVersion(db, handler, envelope.aggregateId);
if (currentVersion !== null && currentVersion >= envelope.version) {
  return 'skipped-older-version';
}
```

This pattern is canonical Confluent "Idempotent Writer" and correct for entity-mirror projections. But it **only works when every projection row is keyed by a single aggregate id**. A counter projection (`open_issue_count`) has no version column per row — every delivery increments the counter. Under retry, the counter double-counts.

This is why the current QSM validator rejects anything that is not `entity-mirror` (`@rntme/qsm` accepts the `derived` kind at parse time but rejects at validation). The rejection is not a design preference — it is a direct consequence of the idempotency limitation.

**Delta.**

- No `seen_events` table.
- No per-projection declaration of idempotency strategy in QSM artifact.
- Projection consumer has no second dedup path.
- Every non-trivial read model (counters, top-N, windowed aggregates) is unauthorable.

**Remediation sketch.**

1. Add `seen_events(event_id TEXT PK, projection_id TEXT, applied_at TEXT)` DDL to the QSM-managed DB (projection consumer owns it).
2. Extend QSM artifact schema: per-projection field `idempotency: "entity-mirror" | "seen-events"`. Default = `entity-mirror` for backward compatibility.
3. Extend `packages/projection-consumer/src/apply/apply-event.ts` with a branch: if handler strategy is `seen-events`, first check `SELECT 1 FROM seen_events WHERE event_id = ?`; skip if present; on apply, insert `(event_id, projection_id, now)`.
4. Remove the `derived` kind rejection from QSM validator once (2) and (3) ship.
5. Add retention job: delete `seen_events WHERE applied_at < now() − 30d` (configurable; must exceed max replay window).

**Priority.** P1 — unblocks the entire non-mirror projection category.

---

## D6 · Topic and partition-key strategy — ⚠️ minor drift

**Best design (ADR D6).** Topic per aggregate type. Partition key = `stream`. Naming: `rntme.{serviceName}.{aggregateType}.v{major}` (where `v{major}` = event schema major version).

**Current state.** `packages/event-store/src/relay/topic.ts:1-3`:

```ts
export function defaultTopicOf(aggregateType: string): string {
  return `rntme.${aggregateType.toLowerCase()}.v1`;
}
```

Partition key is set at `packages/event-store/src/relay/loop.ts:55`: `key: rec.envelope.stream`. Correct per canon.

**Delta.**

- Topic name missing service segment: two rntme services emitting the same aggregate name (e.g. two services with `Issue` aggregates) collide on the topic.
- `v1` is hard-coded. Should be derived from the event-type's major schema version once D8 lands.

**Remediation sketch.**

1. Change `defaultTopicOf` signature to accept `(serviceName, aggregateType, majorVersion)` and build `rntme.{serviceName}.{aggregateType}.v{majorVersion}`.
2. `@rntme/runtime` reads service name from `manifest.json` and passes it to the relay.
3. Migration for existing `rntme.issue.v1` topics: rename to `rntme.issue-tracker.issue.v1` is breaking; do it alongside D9 envelope migration so the break is bundled.

**Priority.** P2 — fixable atomically with D9.

---

## D7 · Relay mechanism — ⚠️ tail-latency gap

**Best design (ADR D7).** Polling loop is durability path. An in-process condvar signal from `appendEvents` wakes the poller immediately, cutting tail latency from poll interval to ~1 ms.

**Current state.** `packages/event-store/src/relay/loop.ts:35-77` polls every 100 ms by default (`opts.pollIntervalMs ?? 100`). No notify mechanism from append path. Between an `appendEvents` commit and the next poll, events sit for up to 100 ms before Kafka publish attempt.

**Delta.**

- Tail latency floor is poll interval, not near-zero.
- At low event rate this is invisible; at high rate (say, 10k events / sec with 100 ms polling), batches pile up unnecessarily.

**Remediation sketch.**

1. `SqliteEventStore.appendEvents` exposes an `onAppendCommit` signal (`EventEmitter` or simple callback list).
2. `createRelay` subscribes, sets a promise that `sleep(poll)` races against: whichever fires first wakes the loop.
3. Cursor persistence remains the durability boundary — the signal is advisory.
4. Keep the poll fallback; on a crash the condvar is lost but the cursor scan catches up.

**Priority.** P3 — perf optimization, not a correctness gap.

---

## D8 · Schema governance — ❌ gap

**Best design (ADR D8).** Per-event JSON Schema files committed to the repo. CI step runs a BACKWARD-compat checker between `HEAD` schemas and `main` schemas. PR blocked on violations.

**Current state.** The only schema-evolution signal is `packages/event-store/src/types/envelope.ts:17` — a bare `schemaVersion: number` field on the envelope. No schema files exist. No compatibility checker. No CI gate. Reviewers depend on eyeballing graph-IR `emit.payloadExprs` for changes to see if they are breaking.

**Delta.**

- A LLM-agent PR can add or remove a field from an event payload with zero automated feedback.
- Downstream consumers discover breakage at runtime on the first event with the new shape.
- The `schemaVersion` field exists but is never enforced, read, or validated.

**Remediation sketch.**

1. New package `@rntme/schema-codec` (or new export from `@rntme/pdm`) — a generator: `(pdm, graphs) → schemas[]`.
2. `pnpm build` runs the generator and writes `schemas/{EventType}.v{N}.json` per service. Files committed.
3. CI job `pnpm schema:check` loads previous schemas from `git show main:schemas/`, loads current schemas, runs `json-schema-diff` (or equivalent) with BACKWARD policy. Exit 1 on violations.
4. Promotion script `pnpm schema:promote` for intentional major bumps (rename, removal) — bumps major version and writes a new file rather than overwriting.
5. Ties into D11 (the generator is the registry).

**Priority.** P1 — LLM-agent workflows are the primary intended author. Without this gate, shipping new events without breaking consumers is a discipline problem the tool should solve, not a human review problem.

---

## D9 · Envelope format — ❌ major gap

**Best design (ADR D9).** CloudEvents 1.0 envelope end-to-end (in `event_log`, in Kafka messages via binary content mode, in internal APIs). Standard attributes (`id`, `source`, `type`, `time`, `subject`, `datacontenttype`, `dataschema`, `specversion`) + extensions (`correlationid`, `causationid`, `traceparent`, `rntaggregatetype`, `rntaggregateid`, `rntversion`, `rntschemaversion`, `rntactorkind`, `rntactorid`).

**Current state.** `packages/event-store/src/types/envelope.ts:1-18` — proprietary envelope:

```ts
export type EventEnvelope<TPayload = unknown> = Readonly<{
  eventId: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  stream: string;
  version: number;
  occurredAt: string;
  actor: ActorRef | null;
  payload: TPayload;
  schemaVersion: number;
}>;
```

No `source`, no `specversion`, no `correlationid`, no `causationid`, no `datacontenttype`, no `dataschema`.

`packages/event-store/src/relay/loop.ts:53-62` emits Kafka messages with only three headers (`event-id`, `event-type`, `schema-version`); the full envelope is serialized into `value` as JSON. No CloudEvents binary or structured content mode.

`demo/issue-tracker-api/src/server.ts:8-22` does not propagate any correlation/trace header to commands. `packages/bindings-http/src/runtime/command-handler.ts:63-71` does not read correlation headers or plumb them to `executeCommand`. The chain from HTTP → command → event carries zero correlation/causation context.

**Delta (blast radius).**

- **Envelope shape.** Full field rename. Breaking change to event_log schema.
- **Kafka wire format.** Consumer side must understand CloudEvents binary content mode.
- **Correlation propagation.** New plumbing HTTP → command → event. New middleware in bindings-http. New parameter in `executeCommand`.
- **Causation chain.** `executeCommand` must look up the id of the prior event (from `readStream`) and stamp `causationid` on the new one.
- **Zeebe readiness.** Cross-service sagas NEED `correlationid` to correlate BPMN instances with rntme commands. Current envelope cannot participate.

**Remediation sketch (phased).**

- **Phase A — envelope migration.** Introduce new CloudEvents-shaped envelope type. Update `event-store` to serialize it. Migrate existing demo events (one-shot script). Update all tests.
- **Phase B — correlation propagation.** HTTP middleware reads `Correlation-Id` / `traceparent` → passes through Hono context → `executeCommand` gets `correlationId` param → event stamped.
- **Phase C — causation.** On non-root events, stamp `causationid = previous_event_in_stream.id`.
- **Phase D — Kafka binary content mode.** Relay emits CE headers (`ce_specversion`, `ce_id`, `ce_type`, `ce_source`, …) and puts `data` as body. Consumer adapts.

**Priority.** P0 — largest single delta from canon. Prerequisite for Zeebe integration. Must land before the platform vision's cross-service step starts.

---

## D10 · Failure handling in relay — ❌ gap

**Best design (ADR D10).** Default: max-attempts + parking in `delivery_tracking.dlq_at`. Optional broker-DLQ mode via runtime flag.

**Current state.** `packages/event-store/src/relay/loop.ts:50-70`:

```ts
while (true) {
  try {
    await opts.kafka.send(...)
    break;
  } catch (err) {
    onErr(err, rec.envelope);
    await sleep(backoff);
    backoff = Math.min(backoff * 2, maxBackoff);
    if (!running) return;
  }
}
```

Unbounded retry. No attempt counter. Default `onErr` is `console.error`. If a single event is permanently unsendable (schema violation on broker, authorization denied, payload too large), the relay retries forever and **every subsequent event is blocked** because the outer loop processes records in order without skipping.

**Delta.**

- One poison event halts the entire relay indefinitely.
- No operator-facing record of which events are stuck.
- `console.error` is the only operator signal — buried in service logs.
- No tooling to inspect, replay, or drop parked events.

**Remediation sketch.**

1. After D1 `delivery_tracking` lands, record attempt count per send.
2. On `attempt_count >= max_attempts`, relay writes `dlq_at = now()`, `last_error = …`, advances cursor **past the parked event**, continues with the next.
3. Ops endpoints: `GET /_ops/relay-dlq` (list parked), `POST /_ops/relay-dlq/{event_id}/replay` (retry with attempt counter reset), `POST /_ops/relay-dlq/{event_id}/drop` (delete from delivery_tracking; event stays in event_log for audit).
4. Runtime flag `RNTME_RELAY_DLQ_MODE = "parking" | "broker"` toggles; `broker` mode sends to `topicOf(rec) + ".dlq"` instead of parking.
5. CLI: `rntme relay dlq list|replay|drop`.

**Priority.** P0 — current behaviour is a silent operational hazard. Any real-world event whose schema fails broker-side validation halts the service.

---

## D11 · Event-shape registry — ❌ gap

**Best design (ADR D11).** A per-service registry of JSON Schema files, generated at build time from PDM stateMachine transitions + graph emit nodes. Committed to the repo. Source for D8's compat-checker and for external consumers (Zeebe, dashboards, other services).

**Current state.** None. Event shapes live implicitly across:

- PDM stateMachine transitions (per-aggregate).
- Graph-IR `emit` nodes (one per command).
- The payload expression evaluated at runtime in `packages/graph-ir-compiler/src/emit/payload.ts`.

To know what `IssueCreated` v2 contains, a reviewer must read the aggregate PDM, find the transition that emits it, read the `emit` node in the command graph, and mentally simulate `derivePayload`. No single file describes the shape.

**Delta.**

- No consolidated event shape documentation.
- External consumer integration requires reading rntme source.
- Schema compat-checker (D8) has no input.
- LLM-agent cannot read "what does this event look like today" from one place.

**Remediation sketch.** (Same package work as D8 remediation; listed separately because it is the data surface that D8 governs.)

1. New module in `@rntme/pdm` (or new `@rntme/schema-codec`): `generateEventSchemas(pdm, graphs) → Map<EventTypeFQN, JSONSchema>`.
2. `pnpm build` writes `schemas/{EventType}.v{major}.json` per service, committed.
3. Publishable as `@rntme/{service-name}-schemas` npm package for external consumers.
4. CloudEvents `dataschema` (D9) points to the URL of these schema files.
5. Runtime opt-in: projection consumer can validate `envelope.data` against `dataschema` in dev mode; off in production for perf.

**Priority.** P1 — paired with D8 (same delivery unit).

---

## D12 · Command idempotency — ❌ gap

**Best design (ADR D12).** `Idempotency-Key` HTTP header → middleware cache `idempotency_cache(command_id, key, response_json, created_at PK (command_id, key))`. Retention 24h. `executeCommand` accepts optional `idempotencyKey` param for non-HTTP callers.

**Current state.** `packages/bindings-http/src/runtime/command-handler.ts:31-79` — no header read, no cache, no dedup. `packages/graph-ir-compiler/src/command-runtime/execute.ts:42-107` — `executeCommand` signature has no `idempotencyKey`. OCC catches some duplicates (`ConcurrencyConflict` when aggregate state moved), but:

- For commands whose domain is idempotent (adding a line item), OCC does NOT fire — both appends succeed.
- On a true retry (client lost the first response), client receives an error it cannot interpret ("conflict" — did the first call succeed or fail?).

This gap is partially noted in `docs/gaps/commands-and-transactions-gaps.md` P1; included here for EDA completeness.

**Delta.**

- No header reading.
- No cache table.
- `executeCommand` signature lacks the parameter.
- OpenAPI emission (`packages/bindings`) does not document `Idempotency-Key`.

**Remediation sketch.**

1. New table `idempotency_cache` in the service's DB.
2. Middleware in `packages/bindings-http` reads `Idempotency-Key`; before command execution, looks up `(command_id, key)`; on hit replays response; on miss runs command and caches response.
3. `executeCommand(compiled, params, ctx, opts?: { idempotencyKey?: string })` — additive signature.
4. Bindings emit `Idempotency-Key` header in OpenAPI for mutating ops.
5. Retention cleanup job: `DELETE FROM idempotency_cache WHERE created_at < now() − 24h`.

**Priority.** P1 — table stakes for production HTTP APIs.

---

## Cross-cutting observations (not tied to a single decision)

Several concerns span multiple decisions; listed here for completeness.

### Observability is absent across the event pipeline

All relay / consumer errors surface through `console.error` (`packages/event-store/src/relay/loop.ts:29`, `packages/projection-consumer/src/consumer.ts:42-44`). No structured logs, no OpenTelemetry spans, no metrics. D9 `traceparent` extension and D1 `delivery_tracking` close part of this, but the larger observability story is tracked separately in `docs/gaps/infra-and-operability-gaps.md` §P1 "Observability".

**Interaction with this ADR.** After D9 (CloudEvents + `traceparent`) lands, plugging an OTel exporter becomes additive; the trace context is already in the envelope.

### Demo uses in-memory Kafka; no integration-level proof of delivery semantics

`demo/issue-tracker-api` runs with an in-memory Kafka bridge. This validates the shape of the pipeline but never exercises:

- Broker downtime + relay recovery.
- Slow-consumer scenarios.
- Retention-based backfill for a new consumer.
- Multi-consumer-group rebalancing.

**Interaction.** D3 retention contract and D10 DLQ behaviour have no integration test coverage until a real broker is in the test harness.

### Schema-evolution test coverage is zero

The `schemaVersion` field is set to `1` on every event everywhere in the codebase. No test constructs a `schemaVersion: 2` envelope. No test demonstrates a consumer handling two versions of the same event. Once D8 / D11 land, this becomes a first-class test axis.

### Actor propagation ends at the envelope

`actor: ActorRef` is on the envelope (`envelope.ts:15`). It is populated from an HTTP header by `actorFromRequest` (`command-handler.ts:21`) and stored in `event_log.actor_kind` / `actor_id`. It is NOT copied to Kafka headers, so downstream consumers must parse the value JSON to see the actor. After D9, actor flows through `rntactorkind` / `rntactorid` CloudEvents extensions.

---

## Summary: remediation order

Ordered by (priority, dependency):

1. **P0 / D9** — CloudEvents envelope migration + correlationid / causationid propagation. Blocks Zeebe. Forces a breaking change anyway; bundle D6 topic naming fix with it.
2. **P0 / D10** — DLQ parking via `delivery_tracking.dlq_at` (requires D1 table first).
3. **P1 / D1** — `delivery_tracking` table. Prerequisite for D10.
4. **P1 / D5** — hybrid idempotency; unblock non-mirror projections.
5. **P1 / D8 + D11** — schema registry generator + BACKWARD compat CI gate (single work unit).
6. **P1 / D12** — `Idempotency-Key` middleware + cache.
7. **P2 / D3** — production Kafka retention contract doc (and startup warning).
8. **P2 / D6** — topic naming service-segment fix (bundle with D9 migration).
9. **P3 / D7** — condvar tail-latency optimization.

D2, D4 conform today — no work required.

This ordering assumes Zeebe cross-service work is the next platform milestone. If Zeebe is pushed back, D9 drops from P0 to P1 and D12 rises to the top.
