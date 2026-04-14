# @rntme/projection-consumer

Kafka → SQLite projection consumer for the event-sourced read-side.

Provides:
- `KafkaConsumer` abstraction + in-memory test implementation.
- `compileApplyPlan({ pdm, qsm, events })` — pure compile of INSERT/UPDATE SQL + parameter bindings from QSM `ProjectionHandlerSpec` plus PDM field metadata (handles generated columns, nullable fillers, idempotency columns).
- `applyEvent(db, plan, envelope)` — idempotent upsert with three protection layers (spec §6.5): `last_event_version` pre-check, INSERT `ON CONFLICT DO UPDATE WHERE excluded.version > current`, UPDATE `WHERE version < new`.
- `createProjectionConsumer({ kafka, plan, db })` — batch-transaction loop: `BEGIN IMMEDIATE` → apply each → `COMMIT` → `commitOffsets(batch)`.

See `docs/superpowers/specs/2026-04-14-mutations-design.md` §6 for spec.
