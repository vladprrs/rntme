# @rntme/projection-consumer

Kafka → SQLite projection updater with three-layer idempotency and batch-transaction apply. Consumes envelopes produced by the [`@rntme/event-store`](../event-store) relay and keeps [`@rntme/qsm`](../qsm) entity-mirror projections eventually consistent.

## Role in the system

- Depends on [`@rntme/pdm`](../pdm) (entity / generated-field metadata), [`@rntme/qsm`](../qsm) (`deriveProjectionHandler`), and [`@rntme/event-store`](../event-store) (envelope + Kafka abstractions).
- Pure compile step (`compileApplyPlan`) plus a runtime loop (`createProjectionConsumer`). The two are separable: production systems can precompile the plan at build time.

## Install

```bash
pnpm add @rntme/projection-consumer @rntme/event-store @rntme/pdm @rntme/qsm better-sqlite3
```

## Quick start

```ts
import Database from 'better-sqlite3';
import { deriveEventTypes, createPdmResolver } from '@rntme/pdm';
import { generateProjectionDdl } from '@rntme/qsm';
import {
  bootstrapProjections,
  compileApplyPlan,
  createProjectionConsumer,
  createInMemoryKafkaConsumer,
} from '@rntme/projection-consumer';

const pdmResolver = createPdmResolver(validatedPdm);
const events     = deriveEventTypes(validatedPdm);
const ddls       = generateProjectionDdl(validatedQsm, pdmResolver);

const db = new Database(':memory:');
db.pragma('foreign_keys = ON');
bootstrapProjections(db, ddls);

const plan = compileApplyPlan({ pdm: pdmResolver, qsm: validatedQsm, events });

const kafka = createInMemoryKafkaConsumer();   // bridge, for tests / demos
const consumer = createProjectionConsumer({ kafka, plan, db });
consumer.start();
// …
// await consumer.stop();
```

In production, swap `createInMemoryKafkaConsumer()` for an adapter over kafkajs / confluent-kafka. Everything else is identical.

## API

| Export | Purpose |
| ------ | ------- |
| `bootstrapProjections(db, ddls)` | Idempotent `CREATE TABLE IF NOT EXISTS` + `CREATE INDEX IF NOT EXISTS` from `generateProjectionDdl` output. |
| `compileApplyPlan({ pdm, qsm, events })` | Pure: builds `ApplyPlan` = map `eventType → CompiledHandler` plus `aggregate → mirror table` index. Throws `ApplyCompileError` on composite keys, missing entity fields, or unresolvable column sources. |
| `applyEvent(db, plan, envelope)` | Idempotent upsert for one envelope. Returns `'applied' \| 'skipped-no-mirror' \| 'skipped-older-version'`. Pure building block for custom loops. |
| `bindValues(handler, envelope)` | Internal helper that materialises `CompiledHandler.bindings` into positional SQL values; exported for advanced consumers. |
| `createProjectionConsumer({ kafka, plan, db, onError? })` | Batch-transaction loop: `BEGIN IMMEDIATE` → apply each → `COMMIT` → `kafka.commitOffsets(batch)`. Returns `{ start, stop }`. |
| `createInMemoryKafkaConsumer()` | Test / demo consumer driven by a matching `createInMemoryKafkaProducer()`. |

## Exported types

```ts
import type {
  // consumer plumbing
  KafkaConsumer,
  ConsumedMessage,
  KafkaBatch,
  InMemoryKafkaConsumer,
  ProjectionConsumer,
  ProjectionConsumerOptions,
  // apply plan
  ApplyPlan,
  CompiledHandler,
  ColumnBinding,
  ApplyResult,           // 'applied' | 'skipped-no-mirror' | 'skipped-older-version'
  ApplyCompileErrorCode, // 'PC_COMPOSITE_KEY_NOT_SUPPORTED' | 'PC_COLUMN_SOURCE_UNRESOLVABLE' | 'PC_MISSING_ENTITY_FIELD'
} from '@rntme/projection-consumer';
```

`CompiledHandler` is a discriminated union of `{ kind: 'insert' | 'update', sql, bindings, keyColumn, … }`. Creation transitions (`payload.before === null`) compile to inserts; everything else — including self-loops — compiles to updates.

## Three-layer idempotency

The consumer guarantees that replayed envelopes never regress a projection, even under relay retries, Kafka redelivery, or crash-and-restart (spec §6.5):

1. **Pre-check `last_event_version`** on the target row. If the row already has a version ≥ `envelope.version`, the apply returns `'skipped-older-version'` without issuing SQL. Guards against pathological cases where two replicas both hold the same message.
2. **Insert path** — `INSERT ... ON CONFLICT(keyColumn) DO UPDATE SET ... WHERE excluded.last_event_version > <table>.last_event_version`. Late inserts for an already-created aggregate degrade to monotonic updates.
3. **Update path** — `UPDATE ... WHERE last_event_version < :newVersion`. If the row was updated by a newer envelope (out-of-order delivery), the statement touches zero rows, which we treat as `'skipped-older-version'`.

`last_event_id` is stored alongside the version for debugging and audit trails.

## Batch-transaction loop

`createProjectionConsumer` iterates `for await (const batch of kafka)` and, for each non-empty batch:

1. `BEGIN IMMEDIATE`
2. `applyEvent(db, plan, m.envelope)` for every message in the batch.
3. `COMMIT`.
4. `await kafka.commitOffsets(batch)` — offsets only advance after the DB transaction is durable.

Any thrown error triggers `ROLLBACK` (the batch is retried on redelivery). If `onError` is provided it receives `(err, batch)` and the loop continues; otherwise the loop rethrows and terminates. At-least-once delivery combined with the three-layer idempotency means retries are always safe.

## Compile-time errors

`compileApplyPlan` fails fast with `ApplyCompileError` for:

- `PC_COMPOSITE_KEY_NOT_SUPPORTED` — composite primary keys are a Tier 2 feature.
- `PC_COLUMN_SOURCE_UNRESOLVABLE` — a projection column has no satisfiable binding (e.g., not in `affects` and not generated and not nullable).
- `PC_MISSING_ENTITY_FIELD` — QSM references a PDM entity or field that the resolver cannot find.

## Spec

See [`docs/superpowers/specs/2026-04-14-mutations-design.md`](../../docs/superpowers/specs/2026-04-14-mutations-design.md) §6 for the authoritative spec.
