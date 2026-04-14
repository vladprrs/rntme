# @rntme/event-store

SQLite-backed event store + Kafka relay for rntme's event-sourced write-side.

Provides:
- `EventStore` interface and `SqliteEventStore` implementation — `appendEvents`, `readStream`, `readFrom`, cursor helpers.
- Optimistic concurrency per stream via `expectedVersion` + `UNIQUE(stream, version)`.
- Atomic multi-stream append in one transaction.
- `KafkaProducer` abstraction with an in-memory test double.
- `createRelay` polling loop — at-least-once publication with per-stream order preserved (Kafka partition key = `stream`).

See `docs/superpowers/specs/2026-04-14-mutations-design.md` §3, §5 for spec.

## Quick start

```ts
import {
  SqliteEventStore,
  createInMemoryKafkaProducer,
  createRelay,
} from '@rntme/event-store';

const store = new SqliteEventStore({ filename: './events.db' });
const kafka = createInMemoryKafkaProducer(); // replace with a real adapter in production

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
// ... later:
// await relay.stop(); store.close();
```
