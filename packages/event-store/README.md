# @rntme/event-store

SQLite-backed event log with optimistic concurrency, a persistent publish cursor, and an at-least-once Kafka relay. The write-side of rntme's CQRS / Event-Sourced pipeline.

## Role in the system

- Stand-alone package with zero internal dependencies.
- Consumed directly by [`@rntme/graph-ir-compiler`](../graph-ir-compiler) (the command runtime appends events via `EventStore`) and by [`@rntme/bindings-http`](../bindings-http) (passes `eventStore` into command handlers).
- Consumed indirectly by [`@rntme/projection-consumer`](../projection-consumer) — the relay publishes to Kafka, the consumer applies envelopes to the read side.

## Install

```bash
pnpm add @rntme/event-store better-sqlite3
```

## Quick start

```ts
import {
  SqliteEventStore,
  createInMemoryKafkaProducer,
  createRelay,
} from '@rntme/event-store';

const store = new SqliteEventStore({ filename: './events.db' });
const kafka = createInMemoryKafkaProducer(); // swap for a real broker in prod

store.appendEvents([
  {
    stream: 'Issue-1',
    expectedVersion: 0,
    events: [
      {
        eventId: crypto.randomUUID(),
        eventType: 'IssueReport',
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
// …
// await relay.stop();
// store.close();
```

## API

| Export | Purpose |
| ------ | ------- |
| `SqliteEventStore` | Concrete store; opens / reuses a better-sqlite3 connection, runs schema DDL on construction. Methods: `appendEvents(requests)`, `readStream(stream)`, `readFrom({ afterId, limit })`, `readRecordsFrom({ afterId, limit })`, `readCursor(relayId)`, `writeCursor(relayId, id)`, `close()`. |
| `applyEventStoreSchema(db)` | Applies the `event_log` + `publish_cursor` DDL to an existing `better-sqlite3` database (used when embedding the store in an existing DB). |
| `mapSqliteError(err)` | Translates SQLite constraint errors into `ConcurrencyConflict` / `DuplicateEventId` where possible. |
| `rowToEnvelope(row)` | Maps an `event_log` row into a typed `EventEnvelope`. |
| `createRelay(opts)` | Polling loop that tails `event_log` from the stored cursor, publishes each envelope to Kafka (retrying on send error with exponential backoff up to `maxBackoffMs`), and advances the cursor only after a batch succeeds. |
| `defaultTopicOf(aggregateType)` | Default topic router (override via `RelayOptions.topicOf`). |
| `createInMemoryKafkaProducer()` | Test / demo double implementing `KafkaProducer`. |
| `ConcurrencyConflict`, `DuplicateEventId`, `EventStoreError` | Error classes thrown by `appendEvents`. |

## Exported types

```ts
import type {
  // envelope + actor
  EventEnvelope,
  ActorRef,
  // append contract
  AppendEventInput,
  AppendRequest,
  AppendResult,
  AppendedEvent,
  // store
  EventStore,
  ReadFromOptions,
  EventRecord,
  SqliteEventStoreOptions,
  EventLogRow,
  // kafka
  KafkaMessage,
  KafkaProducer,
  InMemoryKafkaProducer,
  // relay
  Relay,
  RelayOptions,
  // errors
  EventStoreErrorCode,   // 'CONCURRENCY_CONFLICT' | 'DUPLICATE_EVENT_ID' | 'STORAGE_FAILURE'
} from '@rntme/event-store';
```

## Schema

```
event_log
  id              INTEGER PRIMARY KEY AUTOINCREMENT
  stream          TEXT    NOT NULL
  aggregate_type  TEXT    NOT NULL
  aggregate_id    TEXT    NOT NULL
  version         INTEGER NOT NULL
  event_type      TEXT    NOT NULL
  event_id        TEXT    NOT NULL UNIQUE
  actor_kind      TEXT NULL
  actor_id        TEXT NULL
  occurred_at     TEXT    NOT NULL
  payload_json    TEXT    NOT NULL
  schema_version  INTEGER NOT NULL DEFAULT 1
  UNIQUE (stream, version)
  INDEX (stream, version), (id)

publish_cursor
  relay_id        TEXT PRIMARY KEY
  last_event_id   INTEGER NOT NULL
  updated_at      TEXT NOT NULL
```

Callers mint `eventId` (UUIDv7 recommended) and `occurredAt` themselves — the store is deterministic on purpose, so tests can replay appends byte-for-byte.

## Concurrency semantics

- **Per-stream optimistic concurrency**: each `AppendRequest` provides `expectedVersion` (the caller-observed `MAX(version)` before the append; `0` for a fresh stream). A version collision throws `ConcurrencyConflict(stream, expectedVersion, actualVersion)`. Omitting `expectedVersion` skips the pre-check and relies on `UNIQUE(stream, version)` alone.
- **Atomic multi-stream append**: `appendEvents(requests)` runs inside a single SQLite transaction; either all streams advance or none.
- **Idempotency**: `UNIQUE(event_id)` guarantees each `eventId` appears at most once. Retries with the same id throw `DuplicateEventId`.

## Relay semantics

- **At-least-once publication**: the relay reads a batch of `EventRecord`s after the persisted cursor, sends each to Kafka (retrying failed sends with exponential backoff up to `maxBackoffMs`), and only advances the cursor after the batch finishes. A crash between send and cursor-advance replays that event on restart; consumers must be idempotent (see [`@rntme/projection-consumer`](../projection-consumer)).
- **Per-stream ordering**: partition key is `stream`, so Kafka preserves the order within a stream. Cross-stream ordering is not guaranteed.
- **Topic routing**: `topicOf(aggregateType)` — default maps to `${aggregateType.toLowerCase()}.events.v1`; override via `RelayOptions.topicOf`.
- **Backpressure & tuning**: `pollIntervalMs` (default `100`), `batchSize` (default `500`), `maxBackoffMs` (default `1000`).
- **Plug a real broker**: implement `KafkaProducer.send(msg)` against kafkajs / confluent-kafka and pass it as `opts.kafka`. Nothing else changes.

## Spec

See [`docs/superpowers/specs/2026-04-14-mutations-design.md`](../../docs/superpowers/specs/2026-04-14-mutations-design.md) §3 (storage) and §5 (relay) for the authoritative spec.
