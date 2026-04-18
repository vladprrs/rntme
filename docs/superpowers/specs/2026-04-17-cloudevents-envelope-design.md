# D9 · CloudEvents 1.0 envelope — end-to-end design

**Status.** Draft for implementation.
**Scope.** Full end-to-end CloudEvents 1.0 envelope: in-memory TS type, `event_log` storage, Kafka binary content mode on wire, HTTP response shape, correlation + causation propagation, DLQ as a wrapper CE event. Bundles D6 topic-naming fix (service segment) into the same migration.
**Out of scope.** D8 schema-registry CI gate; D11 JSON-Schema generator (the `dataschema` URI lands as a dangling reference — D11 makes it resolvable additive-ly). D12 Idempotency-Key middleware — `commandId` is a prerequisite, the HTTP header plumbing stays for a later spec. Reactive / process-manager cross-command causation — no such handlers exist in rntme today; the contract is documented, not implemented.
**Breaking change policy.** System is pre-user; no online migration. Dropping sqlite databases between pre- and post-migration worktrees is the expected dev path.

---

## 1 · Motivation

The current envelope is proprietary: `eventId`, `aggregateType`, `aggregateId`, `stream`, `version`, `eventType`, `occurredAt`, `actor`, `payload`, `schemaVersion`. No `correlationId`, no `causationId`, no `commandId`, no trace-context. Kafka headers carry only three fields (`event-id`, `event-type`, `schema-version`) and the full envelope is stuffed as JSON into `value`.

Consequences documented in `docs/gaps/2026-04-15-event-driven-canonical-audit.md` §D9:

- Cross-service Zeebe saga integration cannot correlate BPMN instances with rntme commands — the envelope has no business-process id.
- Every consumer (future ksqlDB, future second rntme service) needs bespoke envelope mapping — no standard CE-SDK works.
- Actor data is JSON-in-body only; headers cannot route or audit by actor.
- No causation graph — "what caused this event" is not recoverable from the envelope.

D9 fixes all four by adopting CloudEvents 1.0 as a single wire+storage+in-memory format.

---

## 2 · Architecture overview

### 2.1 Invariants

1. **One envelope shape, two representations.** In-memory TS type uses camelCase (`correlationId`, `rntAggregateType`). Wire form uses CE-canonical lowercase (`ce_correlationid`, `ce_rntaggregatetype`). A single mapper `toCloudEventWire` / `fromCloudEventWire` in `@rntme/event-store` is the only code that knows both names.
2. **Kafka uses CE binary content mode.** CE attributes in headers prefixed `ce_`; `data` as JSON bytes in `value`; `content-type: application/json`. No structured-mode fallback.
3. **`commandId` is born at the HTTP boundary.** `bindings-http` middleware generates it per request; it propagates through `ExecuteCommandContext.correlation.commandId`; every event of that command stamps `causationId = commandId`. All events of one command share one `commandId`.
4. **`correlationId` is required on every envelope.** HTTP: read `Correlation-Id` header, else extract trace-id segment of `traceparent`, else generate UUID. Returned to client in response body and in `Correlation-Id` response header. Seed: one shared `seed:<uuid>` per seed invocation.
5. **`source` = `rntme://{serviceName}/{aggregateType}`; `type` = `{serviceName}.{AggregateType}.{EventType}`** (no `.v{N}` suffix — version lives in `rntSchemaVersion` and `dataSchema` URI).
6. **`dataSchema` is dangling until D11.** Format `rntme://schemas/{serviceName}/{EventType}.v{rntSchemaVersion}.json`. No runtime resolver. D11 makes the URI point to real files — additive change, no envelope churn.
7. **DLQ is a wrapper CE event, not re-sent original.** New type `{serviceName}.Relay.EventDeliveryFailed`, `data.failedEvent` = full original CE envelope, `correlationId` inherited from original, `causationId = original.id`. Type hard-coded in relay (not declared in PDM) — platform event outside the service's domain.
8. **Roundtrip invariance.** `fromCloudEventWire(toCloudEventWire(env))` equals `env` structurally. Property-tested.
9. **Existing TS camelCase (`eventId`, `aggregateId`, `payload`, `occurredAt`) is renamed across all packages** to the new names (`id`, `rntAggregateId`, `data`, `time`, etc.). No shim layer, no dual-name compat. Single breaking cascade.

### 2.2 Affected packages

| Package | Nature of change |
|---|---|
| `@rntme/event-store` | New `EventEnvelope` shape; new `wire-codec.ts`; `SqliteEventStore` ctor takes `serviceName`; `event_log` DDL + 4 new indexed columns; relay emits binary CE; DLQ wrapper envelope hard-coded. |
| `@rntme/graph-ir-compiler` | `ExecuteCommandContext.correlation`; `executeCommand` stamps `correlationId`/`causationId`/`commandId`/`traceparent` per event; `CommandResult` adds `commandId`, `correlationId`. `replayAggregateState` reads `env.data`. |
| `@rntme/bindings-http` | `correlationMiddleware`; `makeCommandHandler` consumes ctx-stored correlation; response body augmented. |
| `@rntme/projection-consumer` | `ConsumedMessage` carries the new envelope shape (content unchanged at this boundary — adapter reconstructs envelope). `apply-event.ts` reads `env.data`, `env.rntVersion`. |
| `@rntme/seed` | New CE-shaped `envelope` schema in `seed.json`; builder stamps `seed:<uuid>` correlation; validator updated. |
| `@rntme/runtime` | Passes `manifest.service.name` into `SqliteEventStore` ctor; `InMemoryBus.producer().send` uses `fromCloudEventWire` instead of `JSON.parse`. |
| `@rntme/pdm` | Nothing. `deriveEventTypes` is unaffected; D11 will consume it later. |
| `@rntme/qsm` / `@rntme/ui` / `@rntme/ui-runtime` / `@rntme/bindings` | No changes. |
| `demo/issue-tracker-api` | `seed.json` rewritten to new shape; e2e tests expect `commandId`/`correlationId` in responses. |

---

## 3 · Types and data

### 3.1 `EventEnvelope` (in-memory, TS)

```ts
// packages/event-store/src/types/envelope.ts
export type EventEnvelope<TPayload = unknown> = Readonly<{
  // Standard CloudEvents attributes
  id: string;
  source: string;                         // derived: `rntme://${serviceName}/${rntAggregateType}`
  eventType: string;                      // short local name (e.g. "IssueCreated")
  type: string;                           // derived: `${serviceName}.${rntAggregateType}.${eventType}`
  time: string;                           // RFC3339
  subject: string;                        // = `${rntAggregateType}-${rntAggregateId}` (same as stream)
  dataContentType: 'application/json';
  dataSchema: string;                     // derived: `rntme://schemas/${serviceName}/${eventType}.v${rntSchemaVersion}.json`
  data: TPayload;

  // rntme extensions (camelCase in TS; lowercase `ce_rnt*` on wire)
  correlationId: string;                  // required
  causationId: string | null;             // = commandId for HTTP-born events; null for seed / (future) root reactive events
  commandId: string | null;               // string for HTTP-born events; null for seed-imported events
  rntAggregateType: string;
  rntAggregateId: string;
  rntVersion: number;
  rntSchemaVersion: number;
  rntActorKind: 'user' | 'system' | 'service' | null;
  rntActorId: string | null;
  traceparent: string | null;
}>;
```

Renamed TS fields (relative to pre-D9):

| old | new | notes |
|---|---|---|
| `eventId` | `id` | |
| `eventType` | kept as `eventType` (local short name); new `type` derivable FQN added | |
| `aggregateType` | `rntAggregateType` | |
| `aggregateId` | `rntAggregateId` | |
| `version` | `rntVersion` | |
| `schemaVersion` | `rntSchemaVersion` | |
| `occurredAt` | `time` | |
| `stream` | `subject` | (drops the `stream` alias; `subject` is the canonical name; relay partition key still derives from it) |
| `actor` (object) | `rntActorKind` + `rntActorId` | flattened to two scalars |
| `payload` | `data` | |
| — | `source`, `type`, `dataContentType`, `dataSchema` | derivable, not stored |
| — | `correlationId`, `causationId`, `commandId`, `traceparent` | new, stored as dedicated columns |

### 3.2 `event_log` DDL

```sql
CREATE TABLE IF NOT EXISTS event_log (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  subject          TEXT    NOT NULL,             -- was `stream` (renamed for CE parity; same values)
  aggregate_type   TEXT    NOT NULL,             -- == rntAggregateType
  aggregate_id     TEXT    NOT NULL,             -- == rntAggregateId
  version          INTEGER NOT NULL,             -- == rntVersion
  event_type       TEXT    NOT NULL,             -- short name (NOT the FQN `type`)
  event_id         TEXT    NOT NULL UNIQUE,      -- == CE `id`
  actor_kind       TEXT,
  actor_id         TEXT,
  occurred_at      TEXT    NOT NULL,             -- == CE `time` (kept local name)
  payload_json     TEXT    NOT NULL,             -- == CE `data`
  schema_version  INTEGER NOT NULL DEFAULT 1,   -- == rntSchemaVersion

  -- NEW columns
  correlation_id   TEXT    NOT NULL,
  causation_id     TEXT,
  command_id       TEXT,
  traceparent      TEXT,

  UNIQUE (subject, version)
);

CREATE INDEX IF NOT EXISTS idx_event_log_subject        ON event_log(subject, version);
CREATE INDEX IF NOT EXISTS idx_event_log_undelivered    ON event_log(id);
CREATE INDEX IF NOT EXISTS idx_event_log_correlation    ON event_log(correlation_id);
CREATE INDEX IF NOT EXISTS idx_event_log_causation      ON event_log(causation_id);
CREATE INDEX IF NOT EXISTS idx_event_log_command        ON event_log(command_id);
```

`publish_cursor` and `delivery_tracking` (DLQ telemetry, already present from spec 2026-04-17-relay-dlq) are **unchanged**.

Column renaming note: old `stream` → new `subject`. This is a DDL rename; the TS type already carries both `subject` (the CE name, stored) and optional derivations. We do NOT keep a `stream` column alias. All code reading/writing the column updates to `subject`.

### 3.3 Wire format (CE Kafka binary content mode)

`toCloudEventWire(env: EventEnvelope, topic: string): KafkaMessage`:

- `topic`: passed by caller (relay knows the primary / DLQ topic).
- `key`: `env.subject`.
- `headers`: all `ce_*` below, plus `content-type: application/json`.
- `value`: `JSON.stringify(env.data)` (NOT the whole envelope).

CE headers (all `string` values; absent = null for nullables):

| Header | Source |
|---|---|
| `ce_specversion` | `"1.0"` (constant) |
| `ce_id` | `env.id` |
| `ce_source` | `env.source` |
| `ce_type` | `env.type` |
| `ce_time` | `env.time` |
| `ce_subject` | `env.subject` |
| `ce_datacontenttype` | `env.dataContentType` (always `"application/json"`) |
| `ce_dataschema` | `env.dataSchema` |
| `ce_correlationid` | `env.correlationId` |
| `ce_causationid` | `env.causationId` (omit header if null) |
| `ce_commandid` | `env.commandId` (omit header if null) |
| `ce_rntaggregatetype` | `env.rntAggregateType` |
| `ce_rntaggregateid` | `env.rntAggregateId` |
| `ce_rntversion` | `String(env.rntVersion)` |
| `ce_rntschemaversion` | `String(env.rntSchemaVersion)` |
| `ce_rntactorkind` | `env.rntActorKind` (omit header if null) |
| `ce_rntactorid` | `env.rntActorId` (omit header if null) |
| `ce_traceparent` | `env.traceparent` (omit header if null) |

`fromCloudEventWire(msg): EventEnvelope`:

- Parse `msg.value` as JSON → `data`.
- Read headers; missing required attribute (`ce_id`, `ce_source`, `ce_type`, `ce_time`, `ce_subject`, `ce_datacontenttype`, `ce_dataschema`, `ce_correlationid`, `ce_rntaggregatetype`, `ce_rntaggregateid`, `ce_rntversion`, `ce_rntschemaversion`, `ce_specversion`) → throws `CloudEventDecodeError` with code `EVENT_STORE_WIRE_DECODE_MISSING_ATTR`.
- `ce_specversion !== '1.0'` → throws `EVENT_STORE_WIRE_DECODE_UNKNOWN_SPEC`.
- `eventType` derivation: parse `ce_type`; take last dotted segment (e.g. `"issue-tracker.Issue.IssueCreated"` → `"IssueCreated"`).
- Integers (`rntVersion`, `rntSchemaVersion`) parsed via `Number()`; NaN → throws `EVENT_STORE_WIRE_DECODE_INVALID_INT`.
- Null-handling: header absent → field is `null` (for nullable fields).

### 3.4 `SqliteEventStore` constructor

```ts
new SqliteEventStore({ db, serviceName })
```

`serviceName` required. Used by `readStream` / `readRecordsFrom` / `readFrom` to compute `source`, `type`, `dataSchema` when reconstructing envelopes from rows.

`appendEvents` accepts the new envelope shape and writes the new columns. `appendRaw` same.

### 3.5 `DeliveryTracking` — unchanged

The DLQ telemetry table designed in `2026-04-17-relay-dlq-delivery-tracking-design.md` is orthogonal and unchanged: `delivery_tracking(event_id PK, first_attempt_at, last_attempt_at, attempt_count, last_error, delivered_at, dlq_at)`. New-shape envelopes get tracked by `env.id` (same column).

---

## 4 · Command path

### 4.1 `ExecuteCommandContext`

```ts
// packages/graph-ir-compiler/src/command-runtime/execute.ts
export type ExecuteCommandContext = {
  eventStore: EventStore;
  qsmDb: BetterSqlite3.Database | null;
  now: () => string;
  nextId: () => string;
  actor: ActorRef | null;

  // NEW
  correlation: {
    commandId: string;                    // required
    correlationId: string;                // required
    traceparent: string | null;
  };
};
```

`executeCommand` changes:

- For each event in `compiled.emits`: build `EventEnvelope` with `correlationId = ctx.correlation.correlationId`, `causationId = ctx.correlation.commandId`, `commandId = ctx.correlation.commandId`, `traceparent = ctx.correlation.traceparent`. `source`, `type`, `dataSchema` — computed from `serviceName` (passed to event-store) at append time or on read.
- `CommandResult` gains `commandId: string` and `correlationId: string`:

```ts
export type CommandResult = Readonly<{
  aggregateId: string;
  version: number;
  eventIds: readonly string[];
  commandId: string;
  correlationId: string;
}>;
```

### 4.2 `correlationMiddleware` (bindings-http)

```ts
// packages/bindings-http/src/runtime/correlation-middleware.ts
export function correlationMiddleware(): MiddlewareHandler {
  return async (c, next) => {
    const incoming = c.req.header('Correlation-Id');
    const tp = c.req.header('traceparent');

    const traceparent = parseTraceparentLoose(tp);          // returns string | null
    const correlationId =
      incoming ??
      (traceparent ? extractTraceId(traceparent) : crypto.randomUUID());
    const commandId = crypto.randomUUID();

    c.set('correlation', { commandId, correlationId, traceparent });
    c.res.headers.set('Correlation-Id', correlationId);
    await next();
  };
}
```

- `parseTraceparentLoose(tp)`: valid W3C `00-<32hex>-<16hex>-<2hex>` → return `tp`; invalid → return `null` (log warning once per request). Does not throw.
- `extractTraceId(tp)`: take the 32-hex `trace-id` segment; re-hex-validated.
- `commandId`: always fresh UUID v4.

### 4.3 `makeCommandHandler`

After existing validators, build correlation from `c.get('correlation')`; pass into `executeCommand`. Response body becomes:

```ts
c.json({
  aggregateId: result.aggregateId,
  version: result.version,
  eventIds: result.eventIds,
  commandId: result.commandId,
  correlationId: result.correlationId,
}, 200);
```

### 4.4 OpenAPI emission

`@rntme/bindings` is NOT changed structurally, but the OpenAPI emitter for command endpoints adds:

- `Correlation-Id` request header (optional, `string`, description: "Business correlation id; generated if omitted and returned in response header of same name");
- `traceparent` request header (optional, W3C format);
- `Correlation-Id` response header (string, always returned);
- Response body schema adds `commandId: string`, `correlationId: string`.

*Caveat:* the current bindings package does not touch the emitter in this spec. This bullet is scoped as "document the contract; wiring into the emitter is an additive follow-up when we next touch bindings." The runtime `bindings-http` handler implements the contract; the spec-emitter alignment is not on the critical path for D9 itself.

---

## 5 · Relay path

### 5.1 Primary-topic emission

Relay loop (`packages/event-store/src/relay/loop.ts`) changes:

- `kafka.send` receives a `KafkaMessage` built by `toCloudEventWire(rec.envelope, primaryTopic)`.
- The old three-header path (`event-id`, `event-type`, `schema-version`) is removed.

### 5.2 DLQ wrapper event

On terminal failure (`attempts >= maxAttempts`), relay constructs a **new** CE envelope:

```ts
const dlqEnvelope: EventEnvelope<DlqPayload> = {
  id: nextId(),
  source: `rntme://${serviceName}/Relay`,
  eventType: 'EventDeliveryFailed',
  type: `${serviceName}.Relay.EventDeliveryFailed`,
  time: nowIso(),
  subject: originalEnvelope.subject,
  dataContentType: 'application/json',
  dataSchema: `rntme://schemas/${serviceName}/EventDeliveryFailed.v1.json`,
  data: {
    failedEvent: originalEnvelope,        // full CE envelope, camelCase
    reason: 'max-attempts-exceeded',
    attempts,
    firstAttemptAt,
    lastError,
  },
  correlationId: originalEnvelope.correlationId,
  causationId: originalEnvelope.id,
  commandId: null,
  rntAggregateType: 'Relay',
  rntAggregateId: serviceName,
  rntVersion: 0,
  rntSchemaVersion: 1,
  rntActorKind: 'system',
  rntActorId: 'relay',
  traceparent: originalEnvelope.traceparent,
};
```

Emitted to `{primaryTopic}.dlq` via `toCloudEventWire`. The unbounded DLQ-retry loop (per §D-DLQ-RETRY from prior spec) stays; only the shape of the thing being retried changes.

`DlqPayload` type is not declared in PDM (service domain has no notion of platform relay). Defined as a TS interface in `packages/event-store/src/relay/dlq-envelope.ts` and documented in the package README under "platform events". When D11 lands, the team can register it in a platform-schemas module — that's additive and out of D9 scope.

### 5.3 Relay needs `serviceName`, `now`, `nextId`

`createRelay({ ..., serviceName, now, nextId })`:

- `serviceName: string` — threaded through from `@rntme/runtime` (reads `manifest.service.name`). Used only to build the DLQ envelope and to compute `source` for re-emitted primary events if needed.
- `now: () => string` — RFC3339 timestamp source; stamps `time` on the DLQ wrapper envelope.
- `nextId: () => string` — UUID source; stamps `id` on the DLQ wrapper envelope.

`now` and `nextId` mirror the existing `ExecuteCommandContext` convention and give tests a seam. Injected by `@rntme/runtime` alongside the ones it already passes to `executeCommand`.

### 5.4 Topic naming — D6 bundled fix

`defaultTopicOf` signature changes:

```ts
// old: defaultTopicOf(aggregateType: string): string
// new:
export function defaultTopicOf(serviceName: string, aggregateType: string): string {
  return `rntme.${serviceName.toLowerCase()}.${aggregateType.toLowerCase()}`;
}
```

**No version suffix.** The topic reflects the stable aggregate boundary, not the schema version. Versioning lives on the event itself:

- **Non-breaking (additive) schema evolution** of a given `eventType` is tracked via `rntSchemaVersion` and the `dataSchema` URI. Consumers tolerate unknown optional fields.
- **Breaking schema change** is semantically a different event — introduce a new `eventType` (e.g. `IssueCreated` → `IssueCreatedV2` or a more meaningful new name). Old consumers ignore unknown `type` values; new consumers subscribe to the new `type`. No topic split, no parallel-read choreography.

This obsoletes the previously-planned D8 "schema-major topic versioning"; that work is no longer needed.

Relay caller passes `serviceName` from `createRelay` opts. Consumer callers subscribe to the relay's topic format (e.g. `rntme.${serviceName}.${aggregateType}` or the broker-specific wildcard form `rntme.${serviceName}.*`).

---

## 6 · Consumer path

### 6.1 `InMemoryBus.producer().send`

```ts
// packages/runtime/src/plugins/in-memory-bus.ts
producer(): KafkaProducer {
  const inner = this.inner;
  return {
    async send(message: KafkaMessage): Promise<void> {
      const envelope = fromCloudEventWire(message);
      inner.produce(envelope);
    },
  };
}
```

No more `JSON.parse(message.value) as EventEnvelope` shortcut — the in-memory bus speaks the same wire format as a real Kafka client would.

### 6.2 `createInMemoryKafkaConsumer` — minimal change

The consumer still yields `ConsumedMessage` with a parsed `envelope`. The in-memory bus's `produce(envelope)` path stays the same internally; only the producer side (the adapter between `KafkaProducer.send(msg)` and `inner.produce(envelope)`) changes. Consumer contract is stable.

### 6.3 `applyEvent`

`packages/projection-consumer/src/apply/apply-event.ts`:

- `selectCurrentVersion(db, handler, envelope.aggregateId)` → `envelope.rntAggregateId`.
- `envelope.version` → `envelope.rntVersion`.
- `envelope.payload` → `envelope.data`.
- Handler signature unchanged (handlers receive the same domain data).

---

## 7 · Seed path

### 7.1 `seed.json` envelope shape

Before (current):

```json
{
  "eventId": "...", "eventType": "...", "aggregateType": "...",
  "aggregateId": "...", "stream": "...", "version": 1,
  "occurredAt": "...", "actor": null, "payload": {...}, "schemaVersion": 1
}
```

After:

```json
{
  "id": "...", "eventType": "IssueCreated",
  "time": "...",
  "subject": "Issue-abc123",
  "data": {...},
  "correlationId": "seed:<uuid>",
  "causationId": null,
  "commandId": null,
  "rntAggregateType": "Issue",
  "rntAggregateId": "abc123",
  "rntVersion": 1,
  "rntSchemaVersion": 1,
  "rntActorKind": null,
  "rntActorId": null,
  "traceparent": null
}
```

`source`, `type`, `dataSchema`, `dataContentType` — NOT in seed.json. `appendRaw` computes them from `serviceName` before writing.

### 7.2 Seed builder

`packages/seed/src/builder.ts`: generates one `seedCorrelationId = "seed:" + crypto.randomUUID()` per `applySeed` invocation; stamps it onto every envelope where `correlationId` is absent.

### 7.3 Seed validator

`packages/seed/src/validate.ts`: updated schema; new required fields (`id`, `rntAggregateType`, `rntAggregateId`, `rntVersion`, `rntSchemaVersion`, `correlationId`, `eventType`, `subject`, `time`, `data`); nullable fields accept `null` or omission.

---

## 8 · Error codes (added)

Appended per project convention (never reorder / delete):

- `EVENT_STORE_WIRE_DECODE_MISSING_ATTR` — required CE header absent on inbound message.
- `EVENT_STORE_WIRE_DECODE_UNKNOWN_SPEC` — `ce_specversion` not `"1.0"`.
- `EVENT_STORE_WIRE_DECODE_INVALID_INT` — `ce_rntversion` or `ce_rntschemaversion` not a valid integer.
- `EVENT_STORE_SCHEMA_INCOMPATIBLE` — runtime detected pre-D9 `event_log` (no `correlation_id` column); panic with migration instruction.

---

## 9 · Testing

**Unit — wire codec (`packages/event-store/test/unit/wire-codec.test.ts`).**

- Property test: for a generator of valid envelopes, `fromCloudEventWire(toCloudEventWire(env, topic))` equals `env` structurally.
- `ce_*` header set matches §3.3 exactly (neither extra nor missing headers for a fully-populated envelope).
- `value` equals `JSON.stringify(env.data)` (bit-exact).
- Each required header removed in turn → `EVENT_STORE_WIRE_DECODE_MISSING_ATTR`.
- `ce_specversion: "0.3"` → `EVENT_STORE_WIRE_DECODE_UNKNOWN_SPEC`.
- `ce_rntversion: "not-a-number"` → `EVENT_STORE_WIRE_DECODE_INVALID_INT`.
- Null-optional fields (`causationId`, `commandId`, `traceparent`, `rntActorKind`, `rntActorId`) roundtrip through "header absent" correctly.

**Unit — `SqliteEventStore` (existing test file extended).**

- Ctor throws when `serviceName` omitted.
- After `appendEvents`, `readStream(subject)[0]` has `source = "rntme://<svc>/<aggType>"`, `type = "<svc>.<AggType>.<EventType>"`, `dataSchema = "rntme://schemas/<svc>/<EventType>.v<N>.json"`.
- New columns (`correlation_id`, `causation_id`, `command_id`, `traceparent`) land in the right rows.
- `PRAGMA table_info` guard: a pre-D9 DB (no `correlation_id` column) raises `EVENT_STORE_SCHEMA_INCOMPATIBLE` on `applyEventStoreSchema` / first read.

**Unit — correlation middleware (`packages/bindings-http/test/unit/correlation-middleware.test.ts`).**

- No headers → both ids generated (UUID-shaped), `traceparent = null`, response `Correlation-Id` header matches generated `correlationId`.
- `Correlation-Id: abc` only → `correlationId = "abc"`, `commandId` fresh, response header `"abc"`.
- `traceparent: 00-<32hex>-<16hex>-01` only → `correlationId` equals the 32-hex trace-id segment, `traceparent` preserved in ctx.
- Both headers → `Correlation-Id` wins for `correlationId`; `traceparent` still preserved.
- Malformed `traceparent` → `traceparent` in ctx is `null`; no throw; correlation still set (generated or from `Correlation-Id` if present).

**Unit — DLQ wrapper (`packages/event-store/test/unit/dlq-wrapper.test.ts`).**

- After `maxAttempts` primary-topic failures, next produce call targets `{primaryTopic}.dlq`.
- Decoded DLQ envelope: `type = "<svc>.Relay.EventDeliveryFailed"`, `source = "rntme://<svc>/Relay"`, `correlationId` equals original, `causationId` equals original `id`, `commandId` is `null`, `data.failedEvent` equals original envelope structurally, `data.reason = "max-attempts-exceeded"`, `attempts` and `firstAttemptAt` and `lastError` present.

**Integration — HTTP → SQLite → consumer (`packages/runtime/test/integration/correlation-e2e.test.ts`).**

- `POST /api/commands/createIssue` with `Correlation-Id: test-abc`; assertions:
  - response body has `commandId` (UUID-shaped), `correlationId = "test-abc"`;
  - response header `Correlation-Id: test-abc`;
  - `event_log` row: `correlation_id = "test-abc"`, `causation_id = <response.commandId>`, `command_id = <response.commandId>`;
  - the projection-consumer receives an envelope with the same three values (captured via spy on `applyEvent` or verified via QSM row).

**Integration — seed (`packages/seed/test/integration/seed-ce.test.ts`).**

- Apply a seed with two events; both rows in `event_log` have `command_id IS NULL`, `correlation_id LIKE 'seed:%'`, and share the same `correlation_id`.
- Relay publishes them; consumer receives envelopes with `commandId = null`.

**Demo — `demo/issue-tracker-api` e2e.**

- `seed.json` rewritten to the new shape (one-shot, committed).
- Existing e2e tests touching command responses extended to assert `commandId` and `correlationId` presence.

**Out of scope for tests in this spec:** real Kafka broker; resolvability of `dataSchema` URIs; reactive-handler / process-manager causation chains.

---

## 10 · Migration (dev environment)

Dev workflow after merging D9:

1. `rm -rf .rntme/*.sqlite demo/issue-tracker-api/data/*.sqlite` (or per project conventions).
2. `pnpm install && pnpm -r run build`.
3. `pnpm -r run test`.
4. `pnpm -F @rntme/issue-tracker-api-demo start` — runtime applies new seed on empty store.

Runtime startup guard (`@rntme/runtime` → `SqliteEventStore` apply schema): query `PRAGMA table_info(event_log)`; if `correlation_id` column missing on an existing non-empty DB, throw `EVENT_STORE_SCHEMA_INCOMPATIBLE` with the drop-and-reseed instruction. No online migration code path.

---

## 11 · Non-goals explicitly rejected

- **Dual-envelope period.** No "accept both old and new shapes for N releases" — migration is atomic.
- **Structured content mode fallback.** CE structured mode (whole envelope in `value` with `content-type: application/cloudevents+json`) is not supported; we standardize on binary.
- **`source` scheme negotiation.** `rntme://` is fixed; not configurable.
- **`type` as `{svc}.{Agg}.{Evt}.v{N}`.** Versions live outside `type`; `rntSchemaVersion` + `dataSchema` carry version info.
- **Reactive cross-command causation implementation.** Contract documented; no code until a process-manager or reactive handler lands.
- **D12 Idempotency-Key caching.** `commandId` is a prerequisite; the cache is a separate spec.
- **D8 CI compatibility gate.** Separate spec; `dataSchema` URIs stay dangling until then.
- **D11 schema-file emission.** Separate spec; URIs are placeholders.

---

## 12 · Rollout ordering

One branch, one PR series (no user-facing compatibility; pre-user).

1. Envelope type + wire codec (`@rntme/event-store`) — the new type is introduced; downstream packages still reference the old shape until their own step lands.
2. `event_log` DDL + `SqliteEventStore` reconstruction with `serviceName`.
3. `executeCommand` + `ExecuteCommandContext.correlation` + `CommandResult` fields.
4. Relay primary-topic emission via `toCloudEventWire`.
5. DLQ wrapper envelope.
6. `bindings-http` correlation middleware + response body.
7. `projection-consumer` field renames (`rntVersion`, `rntAggregateId`, `data`).
8. `InMemoryBus.producer` via `fromCloudEventWire`.
9. `@rntme/seed` validator + builder.
10. `@rntme/runtime` wires `serviceName` into event-store and relay.
11. `demo/issue-tracker-api` seed + e2e tests.
12. Unit tests filled in per §9.

Every step compiles only once the types in step 1 are in place; expect a `git add -A && pnpm -r run build` at the end of each logical commit rather than per-file typecheck.

---

## 13 · References

- `docs/adr/2026-04-15-event-driven-architecture.md` §D9.
- `docs/gaps/2026-04-15-event-driven-canonical-audit.md` §D9 (audit & remediation sketch).
- `docs/superpowers/specs/2026-04-17-relay-dlq-delivery-tracking-design.md` (`delivery_tracking` table — orthogonal; reused as-is).
- CloudEvents 1.0 specification — `github.com/cloudevents/spec`.
- CloudEvents Kafka protocol binding — binary content mode.
- W3C Trace Context — `traceparent` format.
