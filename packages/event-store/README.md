# @rntme/event-store

SQLite-backed event store + Kafka relay for rntme's event-sourced write-side.

Provides:
- `EventStore` interface and `SqliteEventStore` implementation — `appendEvents`, `readStream`, `readFrom`, cursor helpers.
- Optimistic concurrency per stream via `expectedVersion` + `UNIQUE(stream, version)`.
- Atomic multi-stream append in one transaction.
- `KafkaProducer` abstraction with an in-memory test double.
- `createRelay` polling loop — at-least-once publication with per-stream order preserved (Kafka partition key = `stream`).

See `docs/superpowers/specs/2026-04-14-mutations-design.md` §3, §5 for spec.
