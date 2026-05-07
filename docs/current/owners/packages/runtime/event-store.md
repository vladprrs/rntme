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
    sqlite.ts                (entry) SqliteEventStore class + mapSqliteError; opens better-sqlite3, enforces one live writer per DB file in-process, pins DB serviceName metadata, runs DDL, asserts D9 schema, implements append/read/cursor/delivery-tracking/raw.
    schema.ts                (entry) applyEventStoreSchema(db) + assertSchemaD9Compatible(db); CREATE TABLE event_log / publish_cursor / delivery_tracking / event_store_metadata + indexes.
    row-mapper.ts            (entry) rowToEnvelope(row, serviceName) + EventLogRow type; reverses a sqlite row to a CloudEvents envelope (derives source / type / dataSchema from the DB-pinned serviceName at read time).
  relay/
    loop.ts                  (entry) createRelay({ store, kafka, cursorId, serviceName, now, nextId, ... }) — polling loop, bounded primary retry, DLQ emit (wrapper event), cursor advance.
    topic.ts                 (entry) defaultTopicOf(serviceName, aggregateType) → 'rntme.<serviceName>.<aggregate>'.
    dlq-envelope.ts          (entry) buildDlqEnvelope(...) → CloudEvents wrapper envelope of type '<svc>.Relay.EventDeliveryFailed'. DlqPayload type.
  kafka/
    producer.ts              (entry) KafkaProducer interface + KafkaMessage shape.
    in-memory.ts             (entry) createInMemoryKafkaProducer() — test/demo double with sent[], failNext(), reset().
    wire-codec.ts            (entry) toCloudEventWire(env, topic) / fromCloudEventWire(msg) — CloudEvents 1.0 binary content mode.
    wire-errors.ts           (entry) CloudEventDecodeError (codes: EVENT_STORE_WIRE_DECODE_MISSING_ATTR / _UNKNOWN_SPEC / _INVALID_INT).
  types/
    index.ts                 (internal) Barrel re-export of the four type modules.
    actor.ts                 (entry) ActorRef union (user | system | service) + ACTOR_REF_KINDS runtime guard; local copy, must match @rntme/pdm.
    envelope.ts              (entry) EventEnvelope<TPayload> — CloudEvents 1.0 camelCase shape (see spec §3.1).
    append.ts                (entry) AppendEventInput, AppendRequest, AppendedEvent, AppendResult.
    errors.ts                (entry) EventStoreError, ConcurrencyConflict, DuplicateEventId, EventStoreErrorCode.
```

## Quick start

```ts
import { SqliteEventStore, createInMemoryKafkaProducer, createRelay } from '@rntme/event-store';

const store = new SqliteEventStore({
  filename: './events.db',
  serviceName: 'issue-tracker', // required; pinned into DB metadata on first open.
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

| Export                                                                                                             | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `SqliteEventStore({ filename, serviceName, applySchema?, busyTimeoutMs? })`                                        | Concrete `EventStore`. Opens better-sqlite3, sets `journal_mode=WAL`, `busy_timeout`, applies schema (unless `applySchema: false`), calls `assertSchemaD9Compatible`, then pins/checks `event_store_metadata.service_name`. Reopening an initialized DB with a different `serviceName` throws `EVENT_STORE_SERVICE_NAME_MISMATCH`; an event log with rows but no service-name metadata throws `EVENT_STORE_SERVICE_NAME_UNINITIALIZED`. A second live `SqliteEventStore` for the same file in this process throws `EVENT_STORE_SQLITE_SINGLE_WRITER`; `:memory:` stores are exempt. |
| `SqliteEventStore#appendEvents(requests)`                                                                          | Atomic multi-subject append in one immediate transaction. Throws `ConcurrencyConflict` / `DuplicateEventId`.                                                                                                                                                                                                                                                                                                                                                                   |
| `SqliteEventStore#appendRaw(envelopes, opts?)`                                                                     | Pre-numbered append for seed / replay tooling — caller supplies `rntVersion`. `opts.ignoreDuplicates` pre-skips rows whose `event_id` already exists, making raw replay idempotent by event ID while still surfacing `(subject, version)` conflicts for different event IDs.                                                                                                                                                                                                   |
| `SqliteEventStore#readStream(subject)`                                                                             | Replay one subject in `version ASC` order. Row-mapper derives `source` / `type` / `dataSchema` from the DB-pinned `serviceName` + aggregate metadata.                                                                                                                                                                                                                                                                                                                          |
| `SqliteEventStore#readFrom({ afterId, limit })`                                                                    | Global `id`-ordered tail; envelopes only.                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `SqliteEventStore#readRecordsFrom({ afterId, limit })`                                                             | Same tail with `{ id, envelope }` pairs (relay uses this for cursor advance).                                                                                                                                                                                                                                                                                                                                                                                                  |
| `SqliteEventStore#readCursor(relayId)`                                                                             | Returns persisted `last_event_id` for the named relay (`0` if unset).                                                                                                                                                                                                                                                                                                                                                                                                          |
| `SqliteEventStore#writeCursor(relayId, lastEventId)`                                                               | Upsert; throws if `lastEventId < existing` (monotonic guard).                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `SqliteEventStore#readDeliveryAttempt` / `recordDeliveryAttempt` / `updateLastError` / `markDelivered` / `markDlq` | `delivery_tracking` ops the relay uses for bounded-retry + DLQ. See Invariants.                                                                                                                                                                                                                                                                                                                                                                                                |
| `SqliteEventStore#close()`                                                                                         | Close the underlying SQLite handle.                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `SqliteEventStore#rawDb()`                                                                                         | Test/advanced escape hatch — direct `better-sqlite3.Database`.                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `applyEventStoreSchema(db)`                                                                                        | Apply `event_log` + `publish_cursor` + `delivery_tracking` + `event_store_metadata` DDL to an externally owned database. Idempotent. Fresh schemas include an `actor_kind` CHECK constraint; valid D9 legacy tables without the CHECK are rebuilt in place.                                                                                                                                                                                                                     |
| `assertSchemaD9Compatible(db)`                                                                                     | Panics with `EVENT_STORE_SCHEMA_INCOMPATIBLE` if `event_log` exists but lacks the `correlation_id` column (the D9 sentinel, per spec §8 / §10) or lacks the `actor_kind` CHECK constraint. No-op on a fresh database.                                                                                                                                                                                                                                                           |
| `mapSqliteError(err, subject, expectedVersion, attemptedVersion, eventId?)`                                        | Translate raw SQLite UNIQUE errors into `ConcurrencyConflict` / `DuplicateEventId`. Pass-through for unrelated errors.                                                                                                                                                                                                                                                                                                                                                         |
| `rowToEnvelope(row, serviceName)`                                                                                  | Map an `EventLogRow` to a typed `EventEnvelope`; derives CE `source`, `type`, `dataSchema` from the row + service name.                                                                                                                                                                                                                                                                                                                                                        |

### Relay

| Export                                                                                          | Purpose                                                                                                                                                                                                                                                                                                                                                                              |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `createRelay(opts)`                                                                             | Polling loop. Reads `event_log` after the persisted cursor, encodes each envelope via `toCloudEventWire`, sends through `KafkaProducer.send`, retries primary-topic failures with exponential backoff (10 ms → `maxBackoffMs`) up to `maxAttempts`, then emits a DLQ wrapper event and advances the cursor. Requires `serviceName`, `now: () => string`, and `nextId: () => string`. |
| `defaultTopicOf(serviceName, aggregateType)`                                                    | `rntme.${serviceName.toLowerCase()}.${aggregateType.toLowerCase()}`, e.g. `rntme.issue-tracker.issue`. No version suffix — versioning lives on the event (spec §5.4). Override via `RelayOptions.topicOf`.                                                                                                                                                                           |
| `buildDlqEnvelope({ serviceName, original, attempts, firstAttemptAt, lastError, now, nextId })` | Returns a fresh `EventEnvelope<DlqPayload>` wrapping the failed event. See "DLQ" below.                                                                                                                                                                                                                                                                                              |
| `Relay#start()` / `Relay#stop()`                                                                | `start` is fire-and-forget; `stop()` resolves once the in-flight loop exits.                                                                                                                                                                                                                                                                                                         |

`RelayOptions` defaults: `pollIntervalMs = 100`, `batchSize = 500`, `maxBackoffMs = 1000`, `maxAttempts = 10`, `topicOf = defaultTopicOf`, `onSendError = console.error`, `onDlqError = console.error`.

### Kafka / wire

| Export                          | Purpose                                                                                                                                                                                                                                                                                    |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `KafkaProducer`                 | One-method interface: `send({ topic, key, headers, value }) => Promise<void>`. Implement against kafkajs / confluent-kafka in prod.                                                                                                                                                        |
| `KafkaMessage`                  | `{ topic, key, headers: Record<string,string>, value: string }`. Headers are the CE binary-mode attributes (lowercase `ce_*`); `value` is `JSON.stringify(envelope.data)`; `key` is `envelope.subject` (partition affinity per aggregate).                                                 |
| `toCloudEventWire(env, topic)`  | Encode a CE envelope into a `KafkaMessage` in binary content mode (`content-type: application/json`, `ce_specversion: 1.0`, and one header per CE attribute; optional attrs `ce_causationid`, `ce_commandid`, `ce_rntactorkind`, `ce_rntactorid`, `ce_traceparent` are omitted when null). |
| `fromCloudEventWire(msg)`       | Decode a `KafkaMessage` back to an `EventEnvelope`. Throws `CloudEventDecodeError` on missing required attrs / unknown `ce_specversion` / non-integer `ce_rntversion` or `ce_rntschemaversion`.                                                                                            |
| `createInMemoryKafkaProducer()` | Test double. Exposes `sent: KafkaMessage[]`, `failNext(n, err)` to simulate transient outages, `reset()` between cases.                                                                                                                                                                    |

### Errors

| Code                                        | Class                                                          | Thrown when                                                                                                                       |
| ------------------------------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `CONCURRENCY_CONFLICT`                      | `ConcurrencyConflict(subject, expectedVersion, actualVersion)` | `expectedVersion` mismatches current `MAX(version)` for the subject, OR `UNIQUE(subject, version)` violated.                      |
| `DUPLICATE_EVENT_ID`                        | `DuplicateEventId(eventId)`                                    | `UNIQUE(event_id)` violated on append.                                                                                            |
| `STORAGE_FAILURE`                           | `EventStoreError` (base)                                       | Reserved for non-mapped storage failures; raw errors otherwise pass through.                                                      |
| `EVENT_STORE_WIRE_DECODE_MISSING_ATTR`      | `CloudEventDecodeError`                                        | `fromCloudEventWire` saw a message missing a required `ce_*` header.                                                              |
| `EVENT_STORE_WIRE_DECODE_UNKNOWN_SPEC`      | `CloudEventDecodeError`                                        | `ce_specversion` header is not `1.0`.                                                                                             |
| `EVENT_STORE_WIRE_DECODE_INVALID_INT`       | `CloudEventDecodeError`                                        | `ce_rntversion` or `ce_rntschemaversion` header is not a base-10 integer.                                                         |
| `EVENT_STORE_WIRE_DECODE_INVALID_ACTORKIND` | `CloudEventDecodeError`                                        | `ce_rntactorkind` header is present but not one of `user`/`system`/`service`.                                                     |
| `EVENT_STORE_SCHEMA_INCOMPATIBLE`           | `Error` (plain, message-prefix code)                           | `assertSchemaD9Compatible` found a pre-D9 `event_log` (missing the `correlation_id` sentinel column).                             |
| `EVENT_STORE_ROW_INVALID_ACTORKIND`         | `Error` (plain, message-prefix code)                           | `rowToEnvelope` saw an `actor_kind` value outside `user`/`system`/`service` (DB corruption — write-time validation forbids this). |

### Types

```ts
import type {
  ActorRef,
  EventEnvelope,
  AppendEventInput,
  AppendRequest,
  AppendResult,
  AppendedEvent,
  EventStore,
  ReadFromOptions,
  EventRecord,
  DeliveryAttemptRow,
  SqliteEventStoreOptions,
  EventLogRow,
  KafkaMessage,
  KafkaProducer,
  InMemoryKafkaProducer,
  Relay,
  RelayOptions,
  DlqPayload,
  EventStoreErrorCode,
} from '@rntme/event-store';
```

## Envelope, schema, wire format, DLQ

The CloudEvents envelope spec is retained as historical rationale; current
behavior lives in code and tests. Start with these files:

- **In-memory envelope** — `src/types/envelope.ts`; spec §3.1 (`../../docs/history/specs/historical/2026-04-17-cloudevents-envelope-design.md`).
- **`event_log` / `publish_cursor` / `delivery_tracking` DDL** — `src/store/schema.ts`; spec §3.2.
- **Kafka binary-content wire format** — `src/kafka/wire-codec.ts`; spec §3.3. `toCloudEventWire` encodes, `fromCloudEventWire` decodes; rejection codes are in `src/kafka/wire-errors.ts` (table above).
- **DLQ wrapper envelope + `DlqPayload`** — `src/relay/dlq-envelope.ts`; spec §5.2. Emit path and unbounded-retry semantics live in `emitDlq` inside `src/relay/loop.ts`; see also `docs/history/specs/historical/2026-04-17-relay-dlq-delivery-tracking-design.md` §D-DLQ-RETRY.

Two operational notes that are easy to miss in code review and so stay here:

- CE `source`, `type`, and `dataSchema` are **not stored** on rows — the row-mapper derives them at read time from the DB-pinned `serviceName` + `aggregate_type` + `event_type` + `schema_version`. The first `SqliteEventStore` open initializes `event_store_metadata.service_name`; later opens with a different `serviceName` fail loudly instead of changing how old rows map to envelopes.
- Store-facing input (`AppendEventInput`) carries `actor: ActorRef | null`; the split `rntActorKind` / `rntActorId` is a DB-row concern reassembled by `rowToEnvelope`.

## Topic naming

`defaultTopicOf(serviceName, aggregateType) → 'rntme.<serviceName>.<aggregateType>'` (service and aggregate segments lowercased), e.g. `rntme.issue-tracker.issue`. When a deploy target supplies a topic prefix, `defaultTopicOf(serviceName, aggregateType, topicPrefix)` emits `<topicPrefix>.<serviceName>.<aggregateType>`, e.g. `rntme.rnt364.smoke.issue-tracker.issue`. The service segment remains mandatory — that is the unit of multi-tenancy / multi-service deploy inside the prefix. No version suffix: event versioning lives on the envelope (`rntSchemaVersion` for additive evolution; a new `eventType` for breaking changes). The DLQ topic is always `<primaryTopic>.dlq`. See spec §5.4.

## Invariants & gotchas

- **Caller mints `id` and `time`.** The store never generates them. Keeps appends deterministic for replay/golden tests. See `AppendEventInput` doc-comment in `src/types/append.ts`.
- **Caller mints `correlationId`.** `NOT NULL` in the schema. For command-driven appends the binding layer supplies it; for seed/relay-generated events the producer mints one explicitly.
- **`appendEvents` is atomic across subjects.** All requests in one call run inside `db.transaction(...).immediate(...)`. A `UNIQUE(event_id)` violation in the _second_ subject rolls back the _first_ (test: `sqlite-append-multi.test.ts` "rolls back both subjects when the second subject violates UNIQUE(event_id)").
- **`expectedVersion` is the pre-append `MAX(version)`.** `0` = brand-new subject. Mismatch throws `ConcurrencyConflict`. Omit to skip the pre-check; the `UNIQUE(subject, version)` constraint is the backstop (mapped via `mapSqliteError`).
- **`UNIQUE(subject, version)` and `UNIQUE(event_id)` map to typed errors only when triggered through `appendEvents`.** Raw inserts bypass the mapper. Use `mapSqliteError` directly if you wrap your own statement.
- **`writeCursor` rejects non-monotonic values.** A relay never rewinds; tests assert `tried < existing` throws (test: `cursor.test.ts` "writeCursor rejects non-monotonic values"). To rebuild from offset 0, drop the `publish_cursor` row out-of-band.
- **Per-subject order in Kafka, not cross-subject.** Relay batches by `id ASC` and sets Kafka `key = envelope.subject`, so every event of one aggregate lands on one partition in version order. Cross-subject ordering is not guaranteed (smoke test asserts the per-subject invariant only).
- **Relay advances cursor _only_ after the full batch sends.** A crash between `kafka.send` and `writeCursor` replays the batch on restart; consumers must dedupe by `event_id` (test: `relay.test.ts` "retries after a transient Kafka failure ... cursor only advances on success").
- **`appendRaw` trusts the caller's `rntVersion`.** It supports non-contiguous versions (e.g., `5, 7`) and exists for seed/replay only — the command runtime never uses it (tests: `append-raw.test.ts`).
- **`appendRaw({ ignoreDuplicates: true })` skips by existing `event_id` before insert.** A `(subject, version)` collision at a different event ID still throws (test: `append-raw.test.ts` "still raises on (subject, version) conflict at different eventId").
- **`ActorRef` is locally redeclared.** `src/types/actor.ts` keeps this package free of `@rntme/pdm`. `test/unit/actor-contract.test.ts` compares the normalized local union and `ACTOR_REF_KINDS` against PDM so widening either side fails this package's tests.
- **SQLite is single-writer per file in this process.** The constructor rejects a second live `SqliteEventStore` for the same filename with `EVENT_STORE_SQLITE_SINGLE_WRITER`. `:memory:` stores remain independent and exempt. This is not a cross-process lock; future scale-out target is Turso (SQLite-compatible Rust), not a Postgres dialect path.
- **`serviceName` is load-bearing and immutable per DB.** It flows into CE `source`, `type`, `dataSchema`, and the Kafka topic. `SqliteEventStore` records it in `event_store_metadata` on first initialization, rejects later opens with a different name via `EVENT_STORE_SERVICE_NAME_MISMATCH`, and rejects pre-metadata event logs that already contain rows via `EVENT_STORE_SERVICE_NAME_UNINITIALIZED` because their original service name cannot be recovered safely.
- **Schema compatibility is asserted at startup.** `assertSchemaD9Compatible` runs in the `SqliteEventStore` constructor after `applyEventStoreSchema`. Pointing this build at a pre-D9 sqlite file will throw `EVENT_STORE_SCHEMA_INCOMPATIBLE`; drop the file and re-seed.
- **`actor_kind` is enforced at write time.** The `event_log` schema rejects
  actor kinds outside `user`, `system`, `service`, or `NULL`. When
  `applyEventStoreSchema` sees a D9-compatible table without that CHECK, it
  rebuilds the table and copies valid rows. If legacy rows already contain an
  invalid actor kind, schema application throws `EVENT_STORE_SCHEMA_INCOMPATIBLE`.

## Out of scope / known limits

- **No Kafka client.** Bring your own `KafkaProducer` implementation. The in-memory producer is for tests and demos.
- **No terminal-vs-retryable classification (A2).** All primary-topic errors go through the same bounded-retry + DLQ path; there is no early DLQ for "permanent" errors like schema violations vs. transient outages. A2 will add an `isTerminal(err)` predicate so schema errors skip the retries.
- **No snapshot/replay-rebuild tooling.** Aggregate replay = `readStream(subject)` on every command; snapshots are tier 2.
- **No cross-process multi-writer.** The package enforces one live writer per DB file inside this Node.js process, but it does not claim an OS/process-wide lock.
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

- [`../../docs/history/specs/historical/2026-04-17-cloudevents-envelope-design.md`](/docs/history/specs/historical/2026-04-17-cloudevents-envelope-design.md) — D9 CloudEvents 1.0 envelope end-to-end design (§3.1 envelope shape, §5.2 DLQ wrapper, §6 topic naming, §7 schema).
- [`../../docs/history/specs/historical/2026-04-17-relay-dlq-delivery-tracking-design.md`](/docs/history/specs/historical/2026-04-17-relay-dlq-delivery-tracking-design.md) — A1 delivery-tracking + DLQ retry semantics (`delivery_tracking`, §D-DLQ-RETRY).
- [`../../docs/history/specs/historical/2026-04-14-mutations-design.md`](/docs/history/specs/historical/2026-04-14-mutations-design.md) — original mutation/event model (pre-D9 envelope fields are superseded by the CE design above).
