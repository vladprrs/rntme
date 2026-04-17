# @rntme/event-store

SQLite-backed event log with optimistic concurrency and an at-least-once Kafka relay — the write-side of rntme's CQRS / event-sourced pipeline.

## Role in the system

- Depends on: `better-sqlite3` (runtime); no internal `@rntme/*` dependencies.
- Consumed by: `@rntme/graph-ir-compiler` (command runtime appends events through `EventStore`), `@rntme/bindings-http` (passes a configured `EventStore` into command handlers), `@rntme/seed` (uses `appendRaw` for fixture loading), `@rntme/projection-consumer` indirectly (consumes the Kafka stream the relay publishes).
- Position in pipeline: command runtime → `appendEvents` → `event_log` (SQLite) → `createRelay` → Kafka → projection consumer.

## File map

```
src/
  index.ts                   (entry) Public API surface — re-exports types, store, relay, kafka.
  store/
    interface.ts             (entry) EventStore interface, ReadFromOptions, EventRecord, AppendRawOptions.
    sqlite.ts                (entry) SqliteEventStore class + mapSqliteError; opens better-sqlite3, runs DDL, implements append/read/cursor/raw.
    schema.ts                (entry) applyEventStoreSchema(db) — CREATE TABLE event_log + publish_cursor + indexes.
    row-mapper.ts            (entry) rowToEnvelope(row) + EventLogRow type; reverses sqlite row to EventEnvelope.
  relay/
    loop.ts                  (entry) createRelay({ store, kafka, cursorId, ... }) — polling loop, retry-with-backoff, cursor advance.
    topic.ts                 (entry) defaultTopicOf(aggregateType) → 'rntme.<lower>.v1'.
  kafka/
    producer.ts              (entry) KafkaProducer interface + KafkaMessage shape.
    in-memory.ts             (entry) createInMemoryKafkaProducer() — test/demo double with sent[], failNext(), reset().
  types/
    index.ts                 (internal) Barrel re-export of the four type modules.
    actor.ts                 (entry) ActorRef union (user | system | service); local copy, must match @rntme/pdm.
    envelope.ts              (entry) EventEnvelope<TPayload> envelope shape.
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

const store = new SqliteEventStore({ filename: './events.db' });
const kafka = createInMemoryKafkaProducer(); // swap for kafkajs / confluent-kafka in prod

store.appendEvents([
  {
    stream: 'Issue-1',
    expectedVersion: 0,
    events: [
      {
        eventId: crypto.randomUUID(),
        eventType: 'IssueReported',
        aggregateType: 'Issue',
        aggregateId: '1',
        occurredAt: new Date().toISOString(),
        actor: { kind: 'user', id: 'alice' },
        payload: { before: null, after: { status: 'draft', title: 'bug' } },
        schemaVersion: 1,
      },
    ],
  },
]);

const relay = createRelay({ store, kafka, cursorId: 'kafka-main' });
relay.start();
// ...
// await relay.stop();
// store.close();
```

## API

### Store

| Export | Purpose |
| ------ | ------- |
| `SqliteEventStore(options)` | Concrete `EventStore`. Opens better-sqlite3, sets `journal_mode=WAL`, `busy_timeout`, applies schema (unless `applySchema: false`). |
| `SqliteEventStore#appendEvents(requests)` | Atomic multi-stream append in one immediate transaction. Throws `ConcurrencyConflict` / `DuplicateEventId`. |
| `SqliteEventStore#appendRaw(envelopes, opts?)` | Pre-numbered append for seed / replay tooling — caller supplies `version`. `opts.ignoreDuplicates` skips `UNIQUE(event_id)` collisions. |
| `SqliteEventStore#readStream(stream)` | Replay one stream in `version ASC` order. |
| `SqliteEventStore#readFrom({ afterId, limit })` | Global `id`-ordered tail; envelopes only. |
| `SqliteEventStore#readRecordsFrom({ afterId, limit })` | Same tail with `{ id, envelope }` pairs (relay uses this for cursor advance). |
| `SqliteEventStore#readCursor(relayId)` | Returns persisted `last_event_id` for the named relay (`0` if unset). |
| `SqliteEventStore#writeCursor(relayId, lastEventId)` | Upsert; throws if `lastEventId < existing` (monotonic guard). |
| `SqliteEventStore#close()` | Close the underlying SQLite handle. |
| `SqliteEventStore#rawDb()` | Test/advanced escape hatch — direct `better-sqlite3.Database`. |
| `applyEventStoreSchema(db)` | Apply `event_log` + `publish_cursor` DDL to an externally owned database. Idempotent. |
| `mapSqliteError(err, stream, expectedVersion, attemptedVersion, eventId?)` | Translate raw SQLite UNIQUE errors into `ConcurrencyConflict` / `DuplicateEventId`. Pass-through for unrelated errors. |
| `rowToEnvelope(row)` | Map an `EventLogRow` to a typed `EventEnvelope`. |

### Relay

| Export | Purpose |
| ------ | ------- |
| `createRelay(opts)` | Polling loop. Reads `event_log` after the persisted cursor, sends each envelope through `KafkaProducer.send`, retries with exponential backoff (10 ms → `maxBackoffMs`), and writes the cursor only after the batch finishes. |
| `defaultTopicOf(aggregateType)` | `rntme.${aggregateType.toLowerCase()}.v1`. Override via `RelayOptions.topicOf`. |
| `Relay#start()` / `Relay#stop()` | `start` is fire-and-forget; `stop()` resolves once the in-flight loop exits. |

`RelayOptions` defaults: `pollIntervalMs = 100`, `batchSize = 500`, `maxBackoffMs = 1000`, `topicOf = defaultTopicOf`, `onSendError = console.error`.

### Kafka

| Export | Purpose |
| ------ | ------- |
| `KafkaProducer` | One-method interface: `send({ topic, key, headers, value }) => Promise<void>`. Implement against kafkajs / confluent-kafka in prod. |
| `createInMemoryKafkaProducer()` | Test double. Exposes `sent: KafkaMessage[]`, `failNext(n, err)` to simulate transient outages, `reset()` between cases. |

### Errors

| Code | Class | Thrown when |
| ---- | ----- | ----------- |
| `CONCURRENCY_CONFLICT` | `ConcurrencyConflict(stream, expectedVersion, actualVersion)` | `expectedVersion` mismatches current `MAX(version)` for the stream, OR `UNIQUE(stream, version)` violated. |
| `DUPLICATE_EVENT_ID` | `DuplicateEventId(eventId)` | `UNIQUE(event_id)` violated on append. |
| `STORAGE_FAILURE` | `EventStoreError` (base) | Reserved for non-mapped storage failures; raw errors otherwise pass through. |

### Types

```ts
import type {
  ActorRef, EventEnvelope,
  AppendEventInput, AppendRequest, AppendResult, AppendedEvent,
  EventStore, ReadFromOptions, EventRecord,
  SqliteEventStoreOptions, EventLogRow,
  KafkaMessage, KafkaProducer, InMemoryKafkaProducer,
  Relay, RelayOptions,
  EventStoreErrorCode,
} from '@rntme/event-store';
```

## Schema

```
event_log
  id              INTEGER PRIMARY KEY AUTOINCREMENT  -- global monotonic cursor
  stream          TEXT    NOT NULL                   -- '<AggregateType>-<aggregateId>'
  aggregate_type  TEXT    NOT NULL
  aggregate_id    TEXT    NOT NULL                   -- string even for integer keys
  version         INTEGER NOT NULL                   -- per-stream monotonic
  event_type      TEXT    NOT NULL
  event_id        TEXT    NOT NULL UNIQUE            -- UUIDv7, caller-minted
  actor_kind      TEXT NULL
  actor_id        TEXT NULL
  occurred_at     TEXT    NOT NULL                   -- ISO-8601 UTC
  payload_json    TEXT    NOT NULL
  schema_version  INTEGER NOT NULL DEFAULT 1
  UNIQUE (stream, version)
  INDEX idx_event_log_stream(stream, version)
  INDEX idx_event_log_undelivered(id)

publish_cursor
  relay_id        TEXT PRIMARY KEY
  last_event_id   INTEGER NOT NULL
  updated_at      TEXT    NOT NULL
```

## Invariants & gotchas

- **Caller mints `eventId` and `occurredAt`.** The store never generates them. Keeps appends deterministic for replay/golden tests. See `AppendEventInput` doc-comment in `src/types/append.ts`.
- **`appendEvents` is atomic across streams.** All requests in one call run inside `db.transaction(...).immediate(...)`. A `UNIQUE(event_id)` violation in the *second* stream rolls back the *first* (test: `sqlite-append-multi.test.ts` "rolls back both streams when the second stream violates UNIQUE(event_id)").
- **`expectedVersion` is the pre-append `MAX(version)`.** `0` = brand-new stream. Mismatch throws `ConcurrencyConflict`. Omit to skip the pre-check; the `UNIQUE(stream, version)` constraint is the backstop (mapped via `mapSqliteError`).
- **`UNIQUE(stream, version)` and `UNIQUE(event_id)` map to typed errors only when triggered through `appendEvents`.** Raw inserts bypass the mapper. Use `mapSqliteError` directly if you wrap your own statement.
- **`writeCursor` rejects non-monotonic values.** A relay never rewinds; tests assert `tried < existing` throws (test: `cursor.test.ts` "writeCursor rejects non-monotonic values"). To rebuild from offset 0, drop the `publish_cursor` row out-of-band.
- **Per-stream order in Kafka, not cross-stream.** Relay batches by `id ASC` and Kafka `key = stream`, so every event of one aggregate lands on one partition in version order. Cross-stream ordering is not guaranteed (smoke test asserts the per-stream invariant only).
- **Relay advances cursor *only* after the full batch sends.** A crash between `kafka.send` and `writeCursor` replays the batch on restart; consumers must dedupe by `event_id` (test: `relay.test.ts` "retries after a transient Kafka failure ... cursor only advances on success").
- **`appendRaw` trusts the caller's `version`.** It supports non-contiguous versions (e.g., `5, 7`) and exists for seed/replay only — the command runtime never uses it (tests: `append-raw.test.ts`).
- **`appendRaw({ ignoreDuplicates: true })` skips only `UNIQUE(event_id)`.** A `(stream, version)` collision still throws (test: `append-raw.test.ts` "still raises on (stream, version) conflict at different eventId").
- **`ActorRef` is locally redeclared.** `src/types/actor.ts` keeps this package free of `@rntme/pdm`. The shape must stay byte-identical to the PDM definition; if PDM widens the union, mirror it here.
- **SQLite is single-writer.** This store assumes one writer process. The `WAL` journal + `busy_timeout` cushion brief contention but cannot scale-out write-side. Future scale-out target is Turso (SQLite-compatible Rust); do not introduce a Postgres dialect path.

## Out of scope / known limits

- **No Kafka client.** Bring your own `KafkaProducer` implementation. The in-memory producer is for tests and demos.
- **No DLQ / poison-message handling.** A persistent Kafka send failure spins forever in the retry loop; `onSendError` is for observability, not recovery.
- **No snapshot/replay-rebuild tooling.** Aggregate replay = `readStream(stream)` on every command; snapshots are tier 2.
- **No multi-writer.** Two `SqliteEventStore` instances on the same file race despite WAL.
- **No event payload validation.** `payload` is `unknown`; the `graph-ir-compiler` command runtime is responsible for shape.
- **No event upcasting.** `schemaVersion` is stored but the store does not transform old envelopes — that lives in the consumer.
- **No automatic `eventId` / `occurredAt` minting.** By design (deterministic tests).
- **No process-manager / saga orchestration.** Cross-aggregate composition lives upstream in `@rntme/graph-ir-compiler` command graphs (single-aggregate in MVP).

## Where to look first

- "Append a new event from a command" → start at `SqliteEventStore.appendEvents` in `src/store/sqlite.ts`; cross-check the contract on `AppendRequest` in `src/types/append.ts`.
- "Map a SQLite error to a typed exception" → `mapSqliteError` in `src/store/sqlite.ts`; tests in `test/unit/sqlite-append-concurrency.test.ts`.
- "Add a new relay tuning option" → `RelayOptions` in `src/relay/loop.ts`; defaults applied at the top of `createRelay`.
- "Change topic naming" → `defaultTopicOf` in `src/relay/topic.ts` or pass `RelayOptions.topicOf`.
- "Plug in a real Kafka client" → implement `KafkaProducer.send` from `src/kafka/producer.ts`; pattern in `src/kafka/in-memory.ts`.
- "Reproduce a failing append/relay test" → fixtures via `makeEvent` / `makeRequest` in `test/fixtures/sample-events.ts`; smoke test in `test/smoke.test.ts`.
- "Bootstrap the schema in an externally owned DB" → `applyEventStoreSchema` in `src/store/schema.ts`; pass `applySchema: false` to `SqliteEventStore` to suppress the auto-apply.
- "Seed historical events with caller-supplied versions" → `appendRaw` in `src/store/sqlite.ts`; tests in `test/append-raw.test.ts`.

## Specs

- [`../../docs/superpowers/specs/done/2026-04-14-mutations-design.md`](../../docs/superpowers/specs/done/2026-04-14-mutations-design.md) — authoritative §3 (event model), §5 (storage and delivery), §7.7 (`packages/event-store` layout).
