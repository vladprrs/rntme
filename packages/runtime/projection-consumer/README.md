# @rntme/projection-consumer

Kafka-to-SQLite read-side runner: bootstraps entity-mirror DDL, compiles per-event apply handlers from QSM + PDM, and drains envelopes into projection rows under a batch transaction with three-layer idempotency.

## Role in the system

- Depends on:
  - [`@rntme/pdm`](../pdm) — `PdmResolver`, `EventTypeSpec`, `deriveEventTypes` (entity + field metadata, creation-transition detection).
  - [`@rntme/qsm`](../qsm) — `ValidatedQsm`, `deriveProjectionHandler`, `generateProjectionDdl`, `ProjectionDdlSpec` (entity-mirror table layout + per-event handler specs).
  - [`@rntme/event-store`](../event-store) — `EventEnvelope` shape (relay output is the consumer input).
  - `better-sqlite3` — sole runtime DB driver (peer; SQLite-only target).
- Consumed by:
  - [`@rntme/runtime`](../runtime) — wires the consumer into the demo runtime.
  - `demo/issue-tracker-api` — end-to-end smoke + canonical lifecycle.
- Position in pipeline: relay (event-store) → Kafka (any adapter conforming to `KafkaConsumer`) → **projection-consumer** → SQLite mirror tables → read-graph compiler reads from `projection_<name>`.

## File map

```
src/
  index.ts                 (entry) Public API surface — re-exports + VERSION.
  consumer.ts              (entry) createProjectionConsumer batch loop (BEGIN IMMEDIATE → apply → COMMIT → commitOffsets).
  apply/
    apply-event.ts         (entry) applyEvent: pre-check version, run compiled SQL, classify outcome.
    bind.ts                (entry) bindValues: resolve each ColumnBinding to a positional SQL value.
    compile.ts             (entry) compileApplyPlan: ProjectionHandlerSpec[] → CompiledHandler[] (insert / update SQL + bindings).
  kafka/
    in-memory.ts           (entry) createInMemoryKafkaConsumer: test/demo adapter implementing KafkaConsumer.
  store/
    bootstrap.ts           (entry) bootstrapProjections: rewrite QSM DDLs to CREATE TABLE/INDEX IF NOT EXISTS and exec.
  types/
    index.ts                       Type barrel re-export of consumer + errors types.
    apply.ts                       ColumnBinding, CompiledHandler, ApplyPlan, ApplyResult.
    consumer.ts                    ConsumedMessage, KafkaBatch, KafkaConsumer interface.
    errors.ts                      ApplyCompileError class + ApplyCompileErrorCode union.
```

## Quick start

```ts
import Database from 'better-sqlite3';
import { createPdmResolver, deriveEventTypes } from '@rntme/pdm';
import { generateProjectionDdl } from '@rntme/qsm';
import {
  bootstrapProjections,
  compileApplyPlan,
  createInMemoryKafkaConsumer,
  createProjectionConsumer,
} from '@rntme/projection-consumer';

// `validatedPdm` and `validatedQsm` come from @rntme/pdm and @rntme/qsm validators.
const pdm    = createPdmResolver(validatedPdm);
const events = deriveEventTypes(validatedPdm);
const ddls   = generateProjectionDdl(validatedQsm, pdm);

const db = new Database(':memory:');
db.pragma('foreign_keys = ON');
bootstrapProjections(db, ddls);

const plan  = compileApplyPlan({ pdm, qsm: validatedQsm, events });
const kafka = createInMemoryKafkaConsumer();
const consumer = createProjectionConsumer({ kafka, plan, db });

consumer.start();
// produce envelopes (in tests via `kafka.produce(envelope)`; in prod via a real Kafka adapter)
// ...
await consumer.stop();
```

## API

| Export | Signature | Purpose |
| --- | --- | --- |
| `VERSION` | `string` | Package version constant (`'0.0.0'`). |
| `bootstrapProjections` | `(db: Database, ddls: readonly ProjectionDdlSpec[]) => void` | Idempotent DDL bootstrap. Rewrites `CREATE TABLE` / `CREATE INDEX` to their `IF NOT EXISTS` form before `db.exec`. |
| `compileApplyPlan` | `(input: { pdm: PdmResolver; qsm: ValidatedQsm; events: readonly EventTypeSpec[] }) => ApplyPlan` | Pure compile: `eventType → CompiledHandler` map plus `aggregateType → tableName` index. Throws `ApplyCompileError`. |
| `applyEvent` | `(db: Database, plan: ApplyPlan, envelope: EventEnvelope) => ApplyResult` | One envelope, one transaction step. Pre-checks `last_event_version`, then runs the compiled SQL. |
| `bindValues` | `(handler: CompiledHandler, envelope: EventEnvelope) => unknown[]` | Materialise `CompiledHandler.bindings` to positional SQL params. Exposed for adapters that bypass `applyEvent`. |
| `createProjectionConsumer` | `(options: ProjectionConsumerOptions) => ProjectionConsumer` | Construct the batch loop. Returns `{ start, stop }`; the loop is single-flight (re-`start` after `start` is a no-op). |
| `createInMemoryKafkaConsumer` | `(options?: { topicOf?; pollIntervalMs? }) => InMemoryKafkaConsumer` | Test/demo adapter. Exposes `produce(envelope)`, `committed`, and `stop()`. |
| `ApplyCompileError` | `class extends Error { code; detail? }` | Thrown by `compileApplyPlan`. `code: ApplyCompileErrorCode`. |

### `ProjectionConsumerOptions`

```ts
type ProjectionConsumerOptions = Readonly<{
  kafka: KafkaConsumer;                 // adapter from src/types/consumer.ts
  plan:  ApplyPlan;                     // produced by compileApplyPlan
  db:    Database;                      // better-sqlite3 instance, foreign_keys=ON recommended
  onError?: (err: unknown, batch: KafkaBatch) => void; // optional; without it, a thrown apply rethrows out of the loop
}>;
type ProjectionConsumer = Readonly<{ start(): void; stop(): Promise<void> }>;
```

### `KafkaConsumer` contract (adapter interface)

```ts
interface KafkaConsumer {
  [Symbol.asyncIterator](): AsyncIterator<KafkaBatch>;
  commitOffsets(batch: KafkaBatch): Promise<void>;
  stop?(): void;                        // optional clean-shutdown hook
}
type ConsumedMessage = Readonly<{
  topic: string; partition: number; offset: string;
  key: string;                          // = envelope.stream (relay partition key)
  envelope: EventEnvelope;
}>;
type KafkaBatch = Readonly<{ messages: readonly ConsumedMessage[] }>;
```

Implementations MUST yield each poll as a `KafkaBatch` (empty batches allowed; the loop sleeps on them), keep offsets uncommitted until `commitOffsets` is awaited, and exit the async-iterator cleanly when `stop()` (or the adapter equivalent) is invoked.

### `InMemoryKafkaConsumer` extras (test/demo only)

```ts
type InMemoryKafkaConsumer = KafkaConsumer & Readonly<{
  produce(envelope: EventEnvelope): void;        // append to the in-memory queue
  stop(): void;                                  // ends the async-iterator
  readonly committed: readonly ConsumedMessage[]; // history of commitOffsets() inputs (for assertions)
}>;
```

`createInMemoryKafkaConsumer({ topicOf?, pollIntervalMs? })`: `topicOf` defaults to the canonical relay format — the serviceName is extracted from `envelope.source` and passed with `rntAggregateType` through `defaultTopicOf` (re-exported from `@rntme/event-store`) — yielding `rntme.<serviceName>.<aggregateType>` (no version suffix; see event-store spec §5.4). `pollIntervalMs` defaults to `2`. Offsets are monotonic strings starting at `'0'`; partition is always `0`.

### Update-handler bind order

`compileUpdate` emits `setParts` and `bindings` in this fixed order; deviating from it desynchronises positional `?` placeholders from the `bindings` array.

1. For each `(setColumns[i], setFields[i])` pair from the QSM handler — `<col> = ?` with `{ kind: 'payloadField', fieldName: setFields[i] }`.
2. For every `entity.fields` entry with `generated === 'updatedAt'` — `<col> = ?` with `{ kind: 'generatedOccurred' }`.
3. `last_event_id = ?` (`{ kind: 'eventId' }`).
4. `last_event_version = ?` (`{ kind: 'eventVersion' }`).
5. `applied_at = ?` (`{ kind: 'appliedAt' }`).
6. `WHERE <key> = ?` — `{ kind: 'aggregateId', sqlType }`.
7. `AND last_event_version < ?` — `{ kind: 'eventVersion' }` (re-emitted; the same `envelope.version` is bound twice per update).

Verified by `test/unit/bind-update.test.ts` "IssueAssign" assertion `vals.slice(-5)` = `[eventId, eventVersion, appliedAt, aggregateId, eventVersion]`.

### Result discriminator (`ApplyResult`)

| Value | Meaning |
| --- | --- |
| `'applied'` | Row inserted or updated; `info.changes > 0`. |
| `'skipped-no-handler'` | No handler for this `eventType`, OR `envelope.aggregateType` does not match the handler's `aggregateType`. |
| `'skipped-older-version'` | Pre-check found `current.version >= envelope.version`, OR the conditional `WHERE last_event_version <` matched zero rows. |
| `'skipped-seen-event'` | Derived-projection idempotency found the same `(eventId, projectionName)` already applied. |
| `'skipped-filter'` | Derived-projection filter predicate evaluated false for this envelope. |

### Compile error codes (`ApplyCompileErrorCode`)

| Code | Cause |
| --- | --- |
| `PC_COMPOSITE_KEY_NOT_SUPPORTED` | `spec.keyColumns.length !== 1`. Composite keys are tier 2. |
| `PC_COLUMN_SOURCE_UNRESOLVABLE` | A creation-handler mirror column is NOT NULL, not in `affects`, not generated, and not the state-machine target — no value can be bound. |
| `PC_MISSING_ENTITY_FIELD` | Entity, field, or `EventTypeSpec` referenced by a `ProjectionHandlerSpec` is absent from PDM/events. |

### `ColumnBinding` kinds (resolved at compile, consumed per envelope)

| `kind` | Source value |
| --- | --- |
| `aggregateId` | `envelope.aggregateId`, coerced to `INTEGER` / `TEXT` / `REAL` per entity-key field type. |
| `payloadField` | `envelope.payload.after[fieldName] ?? null`. |
| `generatedOccurred` | `envelope.occurredAt` (for `generated: 'createdAt' \| 'updatedAt'`). |
| `generatedActor` | `envelope.actor?.id ?? null`. |
| `nullable` | Literal `NULL`. |
| `literalString` | Compile-time string (e.g., creation-transition target for the state column). |
| `eventId` | `envelope.eventId` → `last_event_id`. |
| `eventVersion` | `envelope.version` → `last_event_version`. |
| `appliedAt` | `new Date().toISOString()` → `applied_at`. |

## Invariants & gotchas

- **DDL bootstrap rewrites to `IF NOT EXISTS`.** `bootstrapProjections` regex-rewrites the leading `CREATE TABLE` / `CREATE INDEX` from `generateProjectionDdl` so that re-running on a populated DB is a no-op (commit `ba0ef97` — fix(projection-consumer): align DDL bootstrap with plan; covered by `test/unit/bootstrap.test.ts` "idempotent twice"). Adapters that hand-craft DDL outside `bootstrapProjections` skip this rewrite and break re-bootstrap.
- **Three-layer idempotency (spec §6.5) — all three layers are required.**
  1. `selectCurrentVersion` pre-check — skips before issuing the mutation when `current >= envelope.version`.
  2. `INSERT ... ON CONFLICT (key) DO UPDATE SET ... WHERE table.last_event_version < excluded.last_event_version` for creation transitions.
  3. `UPDATE ... WHERE last_event_version < :newVersion` for non-creation. A 0-row write is reclassified as `'skipped-older-version'`.
  Removing any layer regresses replay safety. Verified by `test/unit/apply-idempotent.test.ts` (re-apply, lower-version replay, out-of-order delivery).
- **Insert vs update is decided by `payload.before === null`** at QSM derivation time, not here. `compileApplyPlan` reads `handler.op.kind`. Self-loops (e.g., `IssueReassign`) compile to `update`.
- **Single-column key only.** `compileApplyPlan` throws `PC_COMPOSITE_KEY_NOT_SUPPORTED` when `spec.keyColumns.length !== 1` (`test/unit/compile-composite-key.test.ts`). Composite keys are deferred (spec §6.9).
- **Aggregate-id type coercion is centralised.** `bindValues` and `selectCurrentVersion` both coerce via the same `aggregateId` `ColumnBinding.sqlType`. Diverging the coercion paths breaks the version pre-check for INTEGER keys.
- **Idempotency columns are appended in fixed order.** Inserts always emit `last_event_id, last_event_version, applied_at` after the mirror columns; updates always emit them in `setParts` after the mirror SET clauses, then the `WHERE` parameters (`aggregateId`, `eventVersion`). Reordering the binding pushes silently mis-typed values into SQL. See `compile.ts` `compileInsert` / `compileUpdate`.
- **Batch transaction semantics — all-or-nothing per Kafka batch (spec §6.4).** `createProjectionConsumer` runs `BEGIN IMMEDIATE` → apply each → `COMMIT`, then awaits `kafka.commitOffsets(batch)`. A throw rolls the whole batch back; offsets remain uncommitted; the batch is retried on redelivery. Verified by `test/unit/consumer-rollback.test.ts`.
- **`onError` swaps termination for continue.** Without `onError`, the batch error rethrows out of the loop and terminates the consumer. With `onError`, the loop logs via the callback and continues with the next batch (offsets for the failed batch stay uncommitted).
- **`stop()` is idempotent.** It calls `kafka.stop?.()` and awaits the in-flight loop promise. A second `stop()` returns immediately. `start()` is single-flight: a second `start()` while the loop is running is a no-op.
- **Empty batches are skipped explicitly** (`if (batch.messages.length === 0) continue;`). The in-memory adapter never yields an empty batch (it sleeps `pollIntervalMs` instead), but real adapters may.
- **`payload.after` extraction tolerates either shape.** `getAfter` accepts `{ before, after }` envelopes and also legacy flat-record payloads (drops `before`, takes the rest). Non-object payloads resolve to `{}`.
- **Unknown-aggregate envelopes commit but do not write.** When `aggregateType` has no handler (e.g. `User`), `applyEvent` returns `'skipped-no-handler'`. The batch still commits the offset (`test/unit/consumer-loop.test.ts` "events for aggregates without mirror").
- **Identifier quoting is internal.** All emitted SQL passes table/column names through `q()` (double-quote with `"` escaping). Hand-built SQL in adapters must match or `applyEvent`'s pre-check `SELECT` will diverge from the compiled handler's UPSERT.
- **SQLite-only.** No dialect abstraction; uses `BEGIN IMMEDIATE`, `ON CONFLICT ... DO UPDATE`, and `excluded.<col>` syntax. Future scale-out target is Turso (SQLite-compatible Rust).
- **`compileApplyPlan` is pure.** It does not touch the DB. The two-stage shape (compile once, apply per envelope) lets production wiring move `compileApplyPlan` to build time and ship the serialised plan; runtime needs only `applyEvent` + the `db`. Tests rely on this purity to set up plans without a transaction.
- **State-column literal binding fires only on `isCreation` + state-machine `to`.** `bindingForInsertColumn` emits `{ kind: 'literalString', value: eventSpec.to }` only when `eventSpec.isCreation === true` AND the entity has a `stateMachine` AND the column matches `entity.stateMachine.stateField`. Non-creation handlers never literal-bind state — state changes flow through `payloadField` from `payload.after`.
- **`generated: 'createdAt' | 'updatedAt'` both bind to `envelope.occurredAt`.** Updates additionally re-emit `updatedAt` columns in `setParts` on every event (`compileUpdate` loop over `entity.fields` checking `field.generated === 'updatedAt'`). Inserts set both stamps from the same `occurredAt`.
- **`actor` is optional.** `bindValues` resolves `generatedActor` to `envelope.actor?.id ?? null`; `actor: null` envelopes apply without error (`test/unit/consumer-loop.test.ts` "events for aggregates without mirror" uses `actor: null`).
- **`applied_at` is generated at bind time, not compile time.** `bindValues` captures `new Date().toISOString()` once per call and reuses it for every `{ kind: 'appliedAt' }` binding in the same envelope. Two apply-calls for the same envelope (a replay) will write different `applied_at` values — but the `last_event_version` guard prevents the second write from taking effect.
- **`handler.aggregateType` is cross-checked against the envelope.** `applyEvent` returns `'skipped-no-handler'` if `handler.aggregateType !== envelope.aggregateType`, even when the `eventType` is in the plan. This protects against event-type collisions across aggregates.
- **Consumer `run` is launched from `start()` without awaiting.** `start()` assigns `loop = run()` and returns synchronously. `stop()` awaits the stored promise. Callers that need the loop-end signal must `await stop()` (or handle rejection on the returned `ProjectionConsumer` via the `onError` callback).

## Out of scope / known limits

- **No real Kafka adapter.** Only `createInMemoryKafkaConsumer` ships in this package; production deployments wire kafkajs / confluent-kafka behind the `KafkaConsumer` interface in `src/types/consumer.ts`. No reconnect, retry, or rebalance logic is provided here.
- **No poison-message / DLQ handling.** Per spec §6.9 (deferred tier 2), a thrown apply terminates the loop unless `onError` is supplied. `onError` cannot route a single bad message — it sees the whole batch.
- **No replay tooling.** Resetting the consumer offset and replaying from offset 0 works because of idempotency, but no helper exists to truncate-and-reseed a projection.
- **No composite-key projections.** Rejected at compile (`PC_COMPOSITE_KEY_NOT_SUPPORTED`).
- **No `backing: "derived"` projections.** Only `entity-mirror` is wired through `deriveProjectionHandler`; derived projections are deferred (spec §6.9).
- **No cross-aggregate consistency / process-manager.** A consumer instance applies one aggregate at a time; cross-aggregate sagas are a Zeebe / external-orchestrator concern, not this package's.
- **No partition / consumer-group affinity logic.** Partition-key = `envelope.stream` is set by the relay; this package consumes whatever batches the adapter yields.

## Where to look first

- "Add a new `ColumnBinding` kind" → extend the union in `src/types/apply.ts`, then add the `case` in `src/apply/bind.ts` `resolveBinding`, then emit it from `src/apply/compile.ts` (`bindingForInsertColumn` for inserts; the loop bodies in `compileUpdate` for updates). Cover with a test mirroring `test/unit/bind-insert.test.ts`.
- "Add a new compile-time error code" → append to `ApplyCompileErrorCode` in `src/types/errors.ts`, throw via `new ApplyCompileError(...)` from `src/apply/compile.ts`, document in the table above.
- "Plug in a real Kafka client" → implement `KafkaConsumer` from `src/types/consumer.ts` (async-iterator + `commitOffsets` + optional `stop`); model lifecycle on `src/kafka/in-memory.ts`. No change to `consumer.ts` is required.
- "Change idempotency / replay semantics" → spec §6.5; touch `src/apply/apply-event.ts` (`selectCurrentVersion` and the post-`run` reclassification) and the SQL emitted in `src/apply/compile.ts` (`ON CONFLICT` and `WHERE last_event_version <` clauses). Validate with `test/unit/apply-idempotent.test.ts` plus the smoke test's "idempotent under Kafka duplicate delivery" case.
- "Debug a failing apply / wrong column value" → start at `src/apply/bind.ts` `resolveBinding`; the binding kind on the failing column tells you whether the value source is the envelope, an idempotency column, or a generated field. Compile-time emission is in `src/apply/compile.ts` `bindingForInsertColumn`.
- "Investigate a rolled-back batch" → `src/consumer.ts` — the `try/catch` around `db.prepare('COMMIT').run()` always issues `ROLLBACK` then rethrows. Reproduction harness: `test/unit/consumer-rollback.test.ts`.
- "Bootstrap a fresh DB" → `src/store/bootstrap.ts`. DDL specs come from `@rntme/qsm` `generateProjectionDdl(qsm, pdm)`.
- "End-to-end repro of the canonical lifecycle" → `test/smoke.test.ts` plus `test/fixtures/envelopes.ts` `issueLifecycle` (spec §7.5: report → submit → assign → reassign → resolve → close).
- "Verify out-of-order safety" → `test/unit/apply-idempotent.test.ts` "out-of-order delivery" (apply v1 then v3, then v2 — v2 returns `'skipped-older-version'`, row stays at v3).
- "Verify duplicate-delivery safety end-to-end" → `test/smoke.test.ts` "idempotent under Kafka duplicate delivery (at-least-once)" (each lifecycle envelope produced twice; final row is single, at v6).
- "Compile-time plan inspection" → `test/unit/compile-insert.test.ts` and `test/unit/compile-update.test.ts` exercise `CompiledHandler.sql` and `bindings` directly without running a DB.
- "Adapter behavioural contract" → `test/unit/kafka-in-memory.test.ts` documents the four required behaviours (yield-until-stop, between-batch produce, `commitOffsets` capture, monotonic offsets / single partition).

## Specs

- [`../../docs/superpowers/specs/done/2026-04-14-mutations-design.md`](../../docs/superpowers/specs/done/2026-04-14-mutations-design.md) — §6 (projection consumer + QSM store) is authoritative: §6.1–6.3 mirror table shape, §6.4 batch loop, §6.5 three-layer idempotent apply, §6.6 offset tracking, §6.7 scaling, §6.9 deferred tier-2 list (composite keys, derived projections, replay tooling, DLQ).
