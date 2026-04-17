# @rntme/event-store

SQLite-backed event log with optimistic concurrency and an at-least-once Kafka relay — the write-side of rntme's CQRS / event-sourced pipeline. Events are CloudEvents 1.0 envelopes end-to-end (in-memory shape, SQLite schema, Kafka wire, DLQ wrapper).

## Role in the system

- Depends on: `better-sqlite3` (runtime); no internal `@rntme/*` dependencies.
- Consumed by: `@rntme/graph-ir-compiler` (command runtime appends events through `EventStore`), `@rntme/bindings-http` (passes a configured `EventStore` into command handlers), `@rntme/seed` (uses `appendRaw` for fixture loading), `@rntme/projection-consumer` indirectly (consumes the Kafka stream the relay publishes).
- Position in pipeline: command runtime → `appendEvents` → `event_log` (SQLite) → `createRelay` → Kafka (CloudEvents binary content mode) → projection consumer.

## File map

```
src/
  index.ts                   (entry) Public API surface — re-exports types, store, relay, kafka, wire codec.
  store/
    interface.ts             (entry) EventStore interface, ReadFromOptions, EventRecord, AppendRawOptions, DeliveryAttemptRow.
    sqlite.ts                (entry) SqliteEventStore class + mapSqliteError; opens better-sqlite3, runs DDL, asserts D9 schema, implements append/read/cursor/delivery-tracking/raw.
    schema.ts                (entry) applyEventStoreSchema(db) + assertSchemaD9Compatible(db); CREATE TABLE event_log / publish_cursor / delivery_tracking + indexes.
    row-mapper.ts            (entry) rowToEnvelope(row, serviceName) + EventLogRow type; reverses a sqlite row to a CloudEvents envelope (derives source / type / dataSchema at read time).
  relay/
    loop.ts                  (entry) createRelay({ store, kafka, cursorId, serviceName, now, nextId, ... }) — polling loop, bounded primary retry, DLQ emit (wrapper event), cursor advance.
    topic.ts                 (entry) defaultTopicOf(serviceName, aggregateType) → 'rntme.<serviceName>.<aggregate>.v1'.
    dlq-envelope.ts          (entry) buildDlqEnvelope(...) → CloudEvents wrapper envelope of type '<svc>.Relay.EventDeliveryFailed'. DlqPayload type.
  kafka/
    producer.ts              (entry) KafkaProducer interface + KafkaMessage shape.
    in-memory.ts             (entry) createInMemoryKafkaProducer() — test/demo double with sent[], failNext(), reset().
    wire-codec.ts            (entry) toCloudEventWire(env, topic) / fromCloudEventWire(msg) — CloudEvents 1.0 binary content mode.
    wire-errors.ts           (entry) CloudEventDecodeError (codes: EVENT_STORE_WIRE_DECODE_MISSING_ATTR / _UNKNOWN_SPEC / _INVALID_INT).
  types/
    index.ts                 (internal) Barrel re-export of the four type modules.
    actor.ts                 (entry) ActorRef union (user | system | service); local copy, must match @rntme/pdm.
    envelope.ts              (entry) EventEnvelope<TPayload> — CloudEvents 1.0 camelCase shape (see spec §3.1).
    append.ts                (entry) AppendEventInput, AppendRequest, AppendedEvent, AppendResult.
    errors.ts                (entry) EventStoreError, ConcurrencyConflict, DuplicateEventId, EventStoreErrorCode.
```

## Quick start

```ts
import {
  SqliteEventStore,
  createInMemoryKafkaProducer,
  createRelay,
} from '@rntme/event-store';

const store = new SqliteEventStore({
  filename: './events.db',
  serviceName: 'issue-tracker',   // required; flows into CE source / type / dataSchema / topic.
});
const kafka = createInMemoryKafkaProducer(); // swap for kafkajs / confluent-kafka in prod

store.appendEvents([
  {
    subject: 'Issue-1',
    expectedVersion: 0,
    events: [
      {
        id: crypto.randomUUID(),
        eventType: 'IssueReported',
        rntAggregateType: 'Issue',
        rntAggregateId: '1',
        time: new Date().toISOString(),
        actor: { kind: 'user', id: 'alice' },
        data: { before: null, after: { status: 'draft', title: 'bug' } },
        rntSchemaVersion: 1,
        correlationId: crypto.randomUUID(),
        causationId: null,
        commandId: null,
        traceparent: null,
      },
    ],
  },
]);

const relay = createRelay({
  store,
  kafka,
  cursorId: 'kafka-main',
  serviceName: 'issue-tracker',
  now: () => new Date().toISOString(),
  nextId: () => crypto.randomUUID(),
});
relay.start();
// ...
// await relay.stop();
// store.close();
```

## API

### Store

| Export | Purpose |
| ------ | ------- |
| `SqliteEventStore({ filename, serviceName, applySchema?, busyTimeoutMs? })` | Concrete `EventStore`. Opens better-sqlite3, sets `journal_mode=WAL`, `busy_timeout`, applies schema (unless `applySchema: false`), then calls `assertSchemaD9Compatible` which panics on pre-D9 event logs. `serviceName` flows into CE `source` / `type` / `dataSchema` at row-map time and into topic naming. |
| `SqliteEventStore#appendEvents(requests)` | Atomic multi-subject append in one immediate transaction. Throws `ConcurrencyConflict` / `DuplicateEventId`. |
| `SqliteEventStore#appendRaw(envelopes, opts?)` | Pre-numbered append for seed / replay tooling — caller supplies `rntVersion`. `opts.ignoreDuplicates` skips `UNIQUE(event_id)` collisions. |
| `SqliteEventStore#readStream(subject)` | Replay one subject in `version ASC` order. Row-mapper re-derives `source` / `type` / `dataSchema` from `serviceName` + aggregate metadata. |
| `SqliteEventStore#readFrom({ afterId, limit })` | Global `id`-ordered tail; envelopes only. |
| `SqliteEventStore#readRecordsFrom({ afterId, limit })` | Same tail with `{ id, envelope }` pairs (relay uses this for cursor advance). |
| `SqliteEventStore#readCursor(relayId)` | Returns persisted `last_event_id` for the named relay (`0` if unset). |
| `SqliteEventStore#writeCursor(relayId, lastEventId)` | Upsert; throws if `lastEventId < existing` (monotonic guard). |
| `SqliteEventStore#readDeliveryAttempt` / `recordDeliveryAttempt` / `updateLastError` / `markDelivered` / `markDlq` | `delivery_tracking` ops the relay uses for bounded-retry + DLQ. See Invariants. |
| `SqliteEventStore#close()` | Close the underlying SQLite handle. |
| `SqliteEventStore#rawDb()` | Test/advanced escape hatch — direct `better-sqlite3.Database`. |
| `applyEventStoreSchema(db)` | Apply `event_log` + `publish_cursor` + `delivery_tracking` DDL to an externally owned database. Idempotent. |
| `assertSchemaD9Compatible(db)` | Panics with `EVENT_STORE_SCHEMA_INCOMPATIBLE` if `event_log` exists but lacks any of `subject`, `correlation_id`, `causation_id`, `command_id`, `traceparent`. No-op on a fresh database. |
| `mapSqliteError(err, subject, expectedVersion, attemptedVersion, eventId?)` | Translate raw SQLite UNIQUE errors into `ConcurrencyConflict` / `DuplicateEventId`. Pass-through for unrelated errors. |
| `rowToEnvelope(row, serviceName)` | Map an `EventLogRow` to a typed `EventEnvelope`; derives CE `source`, `type`, `dataSchema` from the row + service name. |

### Relay

| Export | Purpose |
| ------ | ------- |
| `createRelay(opts)` | Polling loop. Reads `event_log` after the persisted cursor, encodes each envelope via `toCloudEventWire`, sends through `KafkaProducer.send`, retries primary-topic failures with exponential backoff (10 ms → `maxBackoffMs`) up to `maxAttempts`, then emits a DLQ wrapper event and advances the cursor. Requires `serviceName`, `now: () => string`, and `nextId: () => string`. |
| `defaultTopicOf(serviceName, aggregateType)` | `rntme.${serviceName}.${aggregateType.toLowerCase()}.v1`, e.g. `rntme.issue-tracker.issue.v1`. Override via `RelayOptions.topicOf`. |
| `buildDlqEnvelope({ serviceName, original, attempts, firstAttemptAt, lastError, now, nextId })` | Returns a fresh `EventEnvelope<DlqPayload>` wrapping the failed event. See "DLQ" below. |
| `Relay#start()` / `Relay#stop()` | `start` is fire-and-forget; `stop()` resolves once the in-flight loop exits. |

`RelayOptions` defaults: `pollIntervalMs = 100`, `batchSize = 500`, `maxBackoffMs = 1000`, `maxAttempts = 10`, `topicOf = defaultTopicOf`, `onSendError = console.error`, `onDlqError = console.error`.

### Kafka / wire

| Export | Purpose |
| ------ | ------- |
| `KafkaProducer` | One-method interface: `send({ topic, key, headers, value }) => Promise<void>`. Implement against kafkajs / confluent-kafka in prod. |
| `KafkaMessage` | `{ topic, key, headers: Record<string,string>, value: string }`. Headers are the CE binary-mode attributes (lowercase `ce_*`); `value` is `JSON.stringify(envelope.data)`; `key` is `envelope.subject` (partition affinity per aggregate). |
| `toCloudEventWire(env, topic)` | Encode a CE envelope into a `KafkaMessage` in binary content mode (`content-type: application/json`, `ce_specversion: 1.0`, and one header per CE attribute; optional attrs `ce_causationid`, `ce_commandid`, `ce_rntactorkind`, `ce_rntactorid`, `ce_traceparent` are omitted when null). |
| `fromCloudEventWire(msg)` | Decode a `KafkaMessage` back to an `EventEnvelope`. Throws `CloudEventDecodeError` on missing required attrs / unknown `ce_specversion` / non-integer `ce_rntversion` or `ce_rntschemaversion`. |
| `createInMemoryKafkaProducer()` | Test double. Exposes `sent: KafkaMessage[]`, `failNext(n, err)` to simulate transient outages, `reset()` between cases. |

### Errors

| Code | Class | Thrown when |
| ---- | ----- | ----------- |
| `CONCURRENCY_CONFLICT` | `ConcurrencyConflict(subject, expectedVersion, actualVersion)` | `expectedVersion` mismatches current `MAX(version)` for the subject, OR `UNIQUE(subject, version)` violated. |
| `DUPLICATE_EVENT_ID` | `DuplicateEventId(eventId)` | `UNIQUE(event_id)` violated on append. |
| `STORAGE_FAILURE` | `EventStoreError` (base) | Reserved for non-mapped storage failures; raw errors otherwise pass through. |
| `EVENT_STORE_WIRE_DECODE_MISSING_ATTR` | `CloudEventDecodeError` | `fromCloudEventWire` saw a message missing a required `ce_*` header. |
| `EVENT_STORE_WIRE_DECODE_UNKNOWN_SPEC` | `CloudEventDecodeError` | `ce_specversion` header is not `1.0`. |
| `EVENT_STORE_WIRE_DECODE_INVALID_INT` | `CloudEventDecodeError` | `ce_rntversion` or `ce_rntschemaversion` header is not a base-10 integer. |
| `EVENT_STORE_SCHEMA_INCOMPATIBLE` | `Error` (plain, message-prefix code) | `assertSchemaD9Compatible` found a pre-D9 `event_log` (missing any of `subject` / `correlation_id` / `causation_id` / `command_id` / `traceparent`). |

### Types

```ts
import type {
  ActorRef, EventEnvelope,
  AppendEventInput, AppendRequest, AppendResult, AppendedEvent,
  EventStore, ReadFromOptions, EventRecord, DeliveryAttemptRow,
  SqliteEventStoreOptions, EventLogRow,
  KafkaMessage, KafkaProducer, InMemoryKafkaProducer,
  Relay, RelayOptions,
  DlqPayload,
  EventStoreErrorCode,
} from '@rntme/event-store';
```

## Envelope (CloudEvents 1.0)

In-memory shape (camelCase) — see `src/types/envelope.ts` and [spec §3.1](../../docs/superpowers/specs/2026-04-17-cloudevents-envelope-design.md):

```ts
type EventEnvelope<TPayload = unknown> = Readonly<{
  // Standard CloudEvents attributes
  id: string;                              // UUIDv7, caller-minted
  source: string;                          // `rntme://${serviceName}/${rntAggregateType}`
  eventType: string;                       // short local name (e.g. 'IssueReported')
  type: string;                            // `${serviceName}.${rntAggregateType}.${eventType}`
  time: string;                            // RFC3339 UTC
  subject: string;                         // `${rntAggregateType}-${rntAggregateId}` (== append subject)
  dataContentType: 'application/json';
  dataSchema: string;                      // `rntme://schemas/${serviceName}/${eventType}.v${rntSchemaVersion}.json`
  data: TPayload;

  // rntme extensions (CE extension attributes)
  correlationId: string;
  causationId: string | null;
  commandId: string | null;
  rntAggregateType: string;
  rntAggregateId: string;
  rntVersion: number;                      // per-subject monotonic
  rntSchemaVersion: number;
  rntActorKind: 'user' | 'system' | 'service' | null;
  rntActorId: string | null;
  traceparent: string | null;              // W3C trace-context
}>;
```

Store-facing input (`AppendEventInput`) carries `actor: ActorRef | null` rather than the split `rntActorKind` / `rntActorId` — the store unpacks it at insert time and the row-mapper reassembles on read.

## Schema

```
event_log
  id              INTEGER PRIMARY KEY AUTOINCREMENT  -- global monotonic cursor
  subject         TEXT    NOT NULL                   -- '<rntAggregateType>-<rntAggregateId>'
  aggregate_type  TEXT    NOT NULL
  aggregate_id    TEXT    NOT NULL                   -- string even for integer keys
  version         INTEGER NOT NULL                   -- per-subject monotonic
  event_type      TEXT    NOT NULL                   -- short local name
  event_id        TEXT    NOT NULL UNIQUE            -- UUIDv7, caller-minted; becomes CE `id`
  actor_kind      TEXT NULL
  actor_id        TEXT NULL
  occurred_at     TEXT    NOT NULL                   -- ISO-8601 UTC; becomes CE `time`
  payload_json    TEXT    NOT NULL                   -- becomes CE `data`
  schema_version  INTEGER NOT NULL DEFAULT 1         -- becomes CE extension `rntSchemaVersion`
  correlation_id  TEXT    NOT NULL
  causation_id    TEXT NULL
  command_id      TEXT NULL
  traceparent     TEXT NULL                          -- W3C trace-context, propagated to DLQ wrapper
  UNIQUE (subject, version)
  INDEX idx_event_log_subject(subject, version)
  INDEX idx_event_log_undelivered(id)
  INDEX idx_event_log_correlation(correlation_id)
  INDEX idx_event_log_causation(causation_id)
  INDEX idx_event_log_command(command_id)

publish_cursor
  relay_id        TEXT PRIMARY KEY
  last_event_id   INTEGER NOT NULL
  updated_at      TEXT    NOT NULL

delivery_tracking
  event_id          TEXT PRIMARY KEY
  first_attempt_at  TEXT NOT NULL
  last_attempt_at   TEXT NOT NULL
  attempt_count     INTEGER NOT NULL
  last_error        TEXT NULL
  delivered_at      TEXT NULL
  dlq_at            TEXT NULL
```

Note: CE `source`, `type`, and `dataSchema` are **not** stored — they are derived at row-map time from `serviceName` + `aggregate_type` + `event_type` + `schema_version`. Changing a service's name after events are logged will therefore change the envelope these events present on the wire.

## Kafka wire format (CloudEvents binary content mode)

Every message the relay emits uses CloudEvents 1.0 **binary content mode**. The codec lives in `src/kafka/wire-codec.ts`:

- `key = envelope.subject` — partition by aggregate, preserves per-subject order.
- `value = JSON.stringify(envelope.data)` — the CE `data` only. Envelope metadata is **not** in the value.
- `headers`:
  - `content-type: application/json`
  - `ce_specversion: 1.0`
  - `ce_id`, `ce_source`, `ce_type`, `ce_time`, `ce_subject`, `ce_datacontenttype`, `ce_dataschema` (required standard attrs)
  - `ce_correlationid`, `ce_rntaggregatetype`, `ce_rntaggregateid`, `ce_rntversion`, `ce_rntschemaversion` (required rntme extensions)
  - `ce_causationid`, `ce_commandid`, `ce_rntactorkind`, `ce_rntactorid`, `ce_traceparent` (optional; omitted when null, not emitted empty)

`fromCloudEventWire` is the inverse and is what consumers use in-process (e.g. the `InMemoryBus` adapter and test assertions). It enforces the required-header list, rejects non-`1.0` `ce_specversion`, and validates that integer-typed headers parse.

## Topic naming

`defaultTopicOf(serviceName, aggregateType) → 'rntme.<serviceName>.<aggregateType.toLowerCase()>.v1'`, e.g. `rntme.issue-tracker.issue.v1`. The service segment is mandatory — that is the unit of multi-tenancy / multi-service deploy. The DLQ topic is always `<primaryTopic>.dlq`.

## DLQ

After `maxAttempts` (default 10) consecutive primary-topic send failures, the relay emits a **CloudEvents wrapper event** — not the original envelope — to `${primaryTopic}.dlq`. The wrapper is built by `buildDlqEnvelope` (`src/relay/dlq-envelope.ts`):

- `type: '<serviceName>.Relay.EventDeliveryFailed'` (`eventType: 'EventDeliveryFailed'`).
- `source: 'rntme://<serviceName>/Relay'`.
- `subject: original.subject` (preserves partition affinity — the DLQ key is the failed event's subject).
- `dataSchema: 'rntme://schemas/<serviceName>/EventDeliveryFailed.v1.json'`.
- `data: DlqPayload`:
  ```ts
  type DlqPayload = {
    failedEvent: EventEnvelope;          // the original envelope, verbatim
    reason: 'max-attempts-exceeded';
    attempts: number;
    firstAttemptAt: string;
    lastError: string;
  };
  ```
- `correlationId: original.correlationId` (correlation survives the failure).
- `causationId: original.id` (the failed event caused the DLQ emit).
- `commandId: null`.
- `rntActorKind: 'system'`, `rntActorId: 'relay'`.
- `rntAggregateType: 'Relay'`, `rntAggregateId: serviceName`, `rntVersion: 0`, `rntSchemaVersion: 1`.
- `traceparent: original.traceparent` — W3C trace-context propagates end-to-end so the DLQ event joins the original request's trace.
- `id: nextId()`, `time: now()` — both injected via `RelayOptions.nextId` / `.now` for determinism in tests.

After the DLQ send succeeds, the relay marks `dlq_at` on the `delivery_tracking` row and advances the cursor past the failed event. DLQ-side sends are retried unboundedly with capped backoff (spec §D-DLQ-RETRY): if the DLQ topic itself is unreachable, the relay loops rather than dropping the event or zombie-exiting. Wire `RelayOptions.onDlqError` for operator alerting; it is called once per failed DLQ send. On restart, if `attempt_count` is already at `maxAttempts` (relay crashed mid-DLQ-emit), the relay short-circuits straight to DLQ without another wasted primary send. HTTP ops endpoints (`/_ops/relay-dlq-count`, `/_ops/relay-lag`), terminal-vs-retryable classification, and a retention job for `delivery_tracking` are deferred (A2/A3). See `docs/superpowers/specs/2026-04-17-relay-dlq-delivery-tracking-design.md`.

## Invariants & gotchas

- **Caller mints `id` and `time`.** The store never generates them. Keeps appends deterministic for replay/golden tests. See `AppendEventInput` doc-comment in `src/types/append.ts`.
- **Caller mints `correlationId`.** `NOT NULL` in the schema. For command-driven appends the binding layer supplies it; for seed/relay-generated events the producer mints one explicitly.
- **`appendEvents` is atomic across subjects.** All requests in one call run inside `db.transaction(...).immediate(...)`. A `UNIQUE(event_id)` violation in the *second* subject rolls back the *first* (test: `sqlite-append-multi.test.ts` "rolls back both subjects when the second subject violates UNIQUE(event_id)").
- **`expectedVersion` is the pre-append `MAX(version)`.** `0` = brand-new subject. Mismatch throws `ConcurrencyConflict`. Omit to skip the pre-check; the `UNIQUE(subject, version)` constraint is the backstop (mapped via `mapSqliteError`).
- **`UNIQUE(subject, version)` and `UNIQUE(event_id)` map to typed errors only when triggered through `appendEvents`.** Raw inserts bypass the mapper. Use `mapSqliteError` directly if you wrap your own statement.
- **`writeCursor` rejects non-monotonic values.** A relay never rewinds; tests assert `tried < existing` throws (test: `cursor.test.ts` "writeCursor rejects non-monotonic values"). To rebuild from offset 0, drop the `publish_cursor` row out-of-band.
- **Per-subject order in Kafka, not cross-subject.** Relay batches by `id ASC` and sets Kafka `key = envelope.subject`, so every event of one aggregate lands on one partition in version order. Cross-subject ordering is not guaranteed (smoke test asserts the per-subject invariant only).
- **Relay advances cursor *only* after the full batch sends.** A crash between `kafka.send` and `writeCursor` replays the batch on restart; consumers must dedupe by `event_id` (test: `relay.test.ts` "retries after a transient Kafka failure ... cursor only advances on success").
- **`appendRaw` trusts the caller's `rntVersion`.** It supports non-contiguous versions (e.g., `5, 7`) and exists for seed/replay only — the command runtime never uses it (tests: `append-raw.test.ts`).
- **`appendRaw({ ignoreDuplicates: true })` skips only `UNIQUE(event_id)`.** A `(subject, version)` collision still throws (test: `append-raw.test.ts` "still raises on (subject, version) conflict at different eventId").
- **`ActorRef` is locally redeclared.** `src/types/actor.ts` keeps this package free of `@rntme/pdm`. The shape must stay byte-identical to the PDM definition; if PDM widens the union, mirror it here.
- **SQLite is single-writer.** This store assumes one writer process. The `WAL` journal + `busy_timeout` cushion brief contention but cannot scale-out write-side. Future scale-out target is Turso (SQLite-compatible Rust); do not introduce a Postgres dialect path.
- **`serviceName` is load-bearing.** It flows into CE `source`, `type`, `dataSchema`, and the Kafka topic. Changing it after events exist rewrites what the row-mapper produces and what `defaultTopicOf` computes — treat it as immutable per deployment.
- **Schema compatibility is asserted at startup.** `assertSchemaD9Compatible` runs in the `SqliteEventStore` constructor after `applyEventStoreSchema`. Pointing this build at a pre-D9 sqlite file will throw `EVENT_STORE_SCHEMA_INCOMPATIBLE`; drop the file and re-seed.

## Out of scope / known limits

- **No Kafka client.** Bring your own `KafkaProducer` implementation. The in-memory producer is for tests and demos.
- **No terminal-vs-retryable classification (A2).** All primary-topic errors go through the same bounded-retry + DLQ path; there is no early DLQ for "permanent" errors like schema violations vs. transient outages. A2 will add an `isTerminal(err)` predicate so schema errors skip the retries.
- **No snapshot/replay-rebuild tooling.** Aggregate replay = `readStream(subject)` on every command; snapshots are tier 2.
- **No multi-writer.** Two `SqliteEventStore` instances on the same file race despite WAL.
- **No event payload validation.** `data` is `unknown`; the `graph-ir-compiler` command runtime is responsible for shape.
- **No event upcasting.** `rntSchemaVersion` is stored but the store does not transform old envelopes — that lives in the consumer.
- **No automatic `id` / `time` / `correlationId` minting.** By design (deterministic tests).
- **No process-manager / saga orchestration.** Cross-aggregate composition lives upstream in `@rntme/graph-ir-compiler` command graphs (single-aggregate in MVP).
- **No CloudEvents structured content mode.** Binary mode only; structured mode is out of scope.

## Where to look first

- "Append a new event from a command" → start at `SqliteEventStore.appendEvents` in `src/store/sqlite.ts`; cross-check the contract on `AppendRequest` and `AppendEventInput` in `src/types/append.ts`.
- "What the envelope looks like in-memory vs. on the wire" → `src/types/envelope.ts` for the shape, `src/kafka/wire-codec.ts` for the binary-mode mapping.
- "Map a SQLite error to a typed exception" → `mapSqliteError` in `src/store/sqlite.ts`; tests in `test/unit/sqlite-append-concurrency.test.ts`.
- "Add a new relay tuning option" → `RelayOptions` in `src/relay/loop.ts`; defaults applied at the top of `createRelay`.
- "Change topic naming" → `defaultTopicOf` in `src/relay/topic.ts` or pass `RelayOptions.topicOf`.
- "Plug in a real Kafka client" → implement `KafkaProducer.send` from `src/kafka/producer.ts`; pattern in `src/kafka/in-memory.ts`.
- "Reproduce a failing append/relay test" → fixtures via `makeEvent` / `makeRequest` in `test/fixtures/sample-events.ts`; smoke test in `test/smoke.test.ts`.
- "Understand the DLQ wrapper" → `buildDlqEnvelope` in `src/relay/dlq-envelope.ts`; emit path in `emitDlq` inside `src/relay/loop.ts`; assertion surface in `test/unit/dlq-wrapper.test.ts`.
- "Bootstrap the schema in an externally owned DB" → `applyEventStoreSchema` in `src/store/schema.ts`; pass `applySchema: false` to `SqliteEventStore` to suppress the auto-apply.
- "Seed historical events with caller-supplied versions" → `appendRaw` in `src/store/sqlite.ts`; tests in `test/append-raw.test.ts`.

## Specs

- [`../../docs/superpowers/specs/2026-04-17-cloudevents-envelope-design.md`](../../docs/superpowers/specs/2026-04-17-cloudevents-envelope-design.md) — D9 CloudEvents 1.0 envelope end-to-end design (§3.1 envelope shape, §5.2 DLQ wrapper, §6 topic naming, §7 schema).
- [`../../docs/superpowers/specs/2026-04-17-relay-dlq-delivery-tracking-design.md`](../../docs/superpowers/specs/2026-04-17-relay-dlq-delivery-tracking-design.md) — A1 delivery-tracking + DLQ retry semantics (`delivery_tracking`, §D-DLQ-RETRY).
- [`../../docs/superpowers/specs/done/2026-04-14-mutations-design.md`](../../docs/superpowers/specs/done/2026-04-14-mutations-design.md) — original mutation/event model (pre-D9 envelope fields are superseded by the CE design above).
