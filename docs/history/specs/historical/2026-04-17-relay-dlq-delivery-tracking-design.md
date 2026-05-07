> Status: historical.
> Date: 2026-04-17.
> Current source: docs/current/**, docs/decision-system.md, and current code/tests.
> Why retained: Historical rationale and execution context retained for review; it is not current-state truth by itself.

# Relay DLQ + `delivery_tracking` — Design

**Date.** 2026-04-17
**Scope.** `packages/event-store` — close the operational gap "one poison event halts the relay forever" identified in `docs/gaps/2026-04-15-event-driven-canonical-audit.md` (D1 partial, D10 ❌).
**Out of scope.** CloudEvents envelope migration (D9), schema registry (D8+D11), idempotency-key middleware (D12), non-mirror projection strategy (D5), ops HTTP surface (A2 deferred), service-manifest config (A3 deferred).

## 1. Motivation

Today `packages/event-store/src/relay/loop.ts` retries Kafka `send()` failures forever with capped exponential backoff (`maxBackoffMs = 1000`). Consequences:

- A single event whose publish always fails (schema violation on broker, auth denial, message-too-large) blocks the relay indefinitely.
- Every subsequent event queues behind it — the service silently loses its ability to publish domain events.
- Operator signal is only `console.error` — buried in service logs; no durable record of attempts, errors, or poison events.
- Lag is observable (`max(event_log.id) − cursor.last_event_id`) but cause is opaque.

This design adds a bounded-attempts policy, a dedicated Dead-Letter-Queue Kafka topic per primary topic (`{primary}.dlq`), and a local `delivery_tracking` table so the relay can continue past poison events while preserving durability and auditability.

## 2. Decisions

### D-MVP. Minimum viable scope (A1)

Ship: `delivery_tracking` table, persistent attempt counter, `maxAttempts` cap, DLQ emit on cap, cursor advance on DLQ.

Defer:
- Ops HTTP endpoints (`/_ops/relay-dlq-count`, `/_ops/relay-lag`) → A2.
- First-attempt terminal-vs-retryable classification (`isTerminal(err)`) → A2.
- Retention job for `delivery_tracking` rows → A3.
- `maxAttempts` via service manifest → A3.
- Structured logs / OTel replacement for `console.error` → cross-cutting, filed elsewhere.

Rationale: the demo runs an in-memory Kafka bridge that never produces real broker errors, so terminal classification and ops endpoints have no meaningful test surface until a real broker lands in the harness. Bounded-attempts + DLQ alone removes the `relay halted forever` failure mode, which is the only P0 hazard.

### D-COUNTER. Persistent attempt counter

`attempt_count` lives in the `delivery_tracking` table and is incremented (UPSERT) on every `kafka.send()` call, regardless of whether that call happens in the same relay process or after restart.

Rationale: in-memory-only counters reset on relay crash. If the poison event itself triggers the crash (or the relay flaps for an unrelated reason), an in-memory counter can never reach `maxAttempts` — the exact failure mode this work is meant to fix. Persistent counters cost one UPSERT per send attempt, which is negligible relative to event append cost.

### D-DLQ-SHAPE. DLQ message shape

The DLQ Kafka message uses:
- **`topic`** — `{primary}.dlq` where primary = `defaultTopicOf(aggregateType)`.
- **`key`** — same `envelope.stream` as primary (preserves partition locality for per-stream DLQ consumers).
- **`value`** — identical JSON envelope as primary (downstream consumers parse with the same codec).
- **`headers`** — primary headers (`event-id`, `event-type`, `schema-version`) PLUS DLQ metadata:
  - `x-dlq-reason: "max-attempts-exceeded"`
  - `x-dlq-attempts: "<count>"`
  - `x-dlq-first-attempt-at: "<ISO>"`
  - `x-dlq-last-error: "<truncated to 1024 bytes>"`

Rationale: consumers that want to replay DLQ-ed events reuse their primary parser. Operators that want triage read the headers. Wrapping the envelope would force every DLQ-aware consumer to unwrap, which buys nothing.

### D-CURSOR. Cursor advance semantics

Cursor advances on terminal state only — success (`delivered_at`) OR DLQ (`dlq_at`). It does NOT advance while `attempt_count < maxAttempts`.

Rationale: preserves the invariant "cursor represents the high-water mark of events the relay is done with". After a crash, the relay resumes from cursor and re-reads any in-flight event, finds its `delivery_tracking` row, continues from the persisted attempt count.

### D-DLQ-RETRY. DLQ-send retry policy

If `kafka.send()` to the DLQ topic itself fails, retry forever with the same capped backoff as the primary path. No DLQ-of-DLQ. Log loudly on every attempt.

Rationale: DLQ-produce failure means the broker is in a catastrophic state (DLQ topic unprovisioned, cluster down, credentials invalid). Silently dropping an event on DLQ-produce failure loses data. Crashing the relay is an option but doesn't help — the next start would hit the same failure. Loud infinite retry keeps the signal visible and is recoverable once the broker is repaired. The log message uses a distinct prefix (`[relay] DLQ-send failed`) to distinguish it from primary retries.

### D-ATOMICITY. No transactions around terminal+cursor writes

`markDelivered`/`markDlq` and `writeCursor` are separate statements, not wrapped in `db.transaction(...)`.

Rationale: a crash between the two yields a row with `delivered_at IS NOT NULL` but cursor not advanced past it. On restart, the relay re-reads the record, reads its `delivery_tracking`, sees it's already terminal, skips to cursor advance. The defensive-skip branch costs one extra SQL read on recovery — a trade accepted to keep the schema simple.

### D-INTERFACE. Extend `EventStore`, do not split

New methods (`readDeliveryAttempt`, `recordDeliveryAttempt`, `updateLastError`, `markDelivered`, `markDlq`) land on `EventStore`, not a new `DeliveryTrackingStore` interface.

Rationale: relay is the sole writer of `delivery_tracking`, and it already holds an `EventStore` reference. A separate interface would force plumbing a second store through `createRelay`. When A2 adds ops queries, the interface may split; that's a deferred cleanup, not a blocker.

## 3. Data model

Add to `packages/event-store/src/store/schema.ts`:

```sql
CREATE TABLE IF NOT EXISTS delivery_tracking (
  event_id          TEXT PRIMARY KEY,
  first_attempt_at  TEXT NOT NULL,
  last_attempt_at   TEXT NOT NULL,
  attempt_count     INTEGER NOT NULL,
  last_error        TEXT,
  delivered_at      TEXT,
  dlq_at            TEXT
);
```

**Invariants.**
- `event_id` matches `event_log.event_id` (the UUID column, not `event_log.id`). No FK constraint; SQLite without FK enforcement is fine here.
- While in-flight: `delivered_at IS NULL AND dlq_at IS NULL`.
- Terminal: exactly one of `delivered_at` / `dlq_at` is non-null; the other stays null.
- `attempt_count >= 1` once row exists (row is only created at first attempt).
- `last_error` is null on the first attempt before any failure; populated on every failure; NOT cleared on eventual success (kept as historical signal for "this was a flaky delivery").

**No indexes in A1.** Lookups are by PK (`event_id`). Ops queries (`WHERE dlq_at IS NOT NULL`) are A2 — indexes land with them.

## 4. Relay loop state machine

Rewrite of `packages/event-store/src/relay/loop.ts` inner loop (pseudocode):

```
for rec in readRecordsFrom({ afterId: cursor, limit: batch }):
  state = readDeliveryAttempt(rec.envelope.eventId)

  // Defensive skip: terminal state without cursor advance (crash-gap recovery).
  if state?.deliveredAt or state?.dlqAt:
    highestDeliveredId = rec.id
    continue

  attempts = state?.attemptCount ?? 0
  backoff = 10

  while running:
    attempts += 1
    recordDeliveryAttempt(eventId, now)  // UPSERT: first_attempt_at if new row, last_attempt_at, attempt_count

    try:
      kafka.send({ topic: primary, key, headers: primaryHeaders, value })
      markDelivered(eventId, now)
      highestDeliveredId = rec.id
      break
    except err:
      updateLastError(eventId, truncate(err.message, 1024))
      onErr(err, rec.envelope, attempts)
      if attempts >= maxAttempts:
        emitDlq(rec, attempts, firstAttemptAt, err.message)  // infinite retry inside
        markDlq(eventId, now)
        highestDeliveredId = rec.id
        break
      sleep(backoff); backoff = min(backoff * 2, maxBackoff)

writeCursor(highestDeliveredId) if advanced
```

**`emitDlq` (DLQ-send with infinite retry, loud log):**

```
dlqBackoff = 10
while running:
  try:
    kafka.send({
      topic: `${primary}.dlq`,
      key: rec.envelope.stream,
      value: JSON.stringify(rec.envelope),
      headers: {
        ...primaryHeaders,
        'x-dlq-reason': 'max-attempts-exceeded',
        'x-dlq-attempts': String(attempts),
        'x-dlq-first-attempt-at': firstAttemptAt,
        'x-dlq-last-error': truncate(lastError, 1024),
      },
    })
    return
  except dlqErr:
    console.error(`[relay] DLQ-send failed for ${eventId}:`, dlqErr)
    sleep(dlqBackoff); dlqBackoff = min(dlqBackoff * 2, maxBackoff)
```

**`running` check.** Both inner loops check `running` so `stop()` semantics stay intact (current loop has the same property).

## 5. Interface extensions

`packages/event-store/src/store/interface.ts`:

```ts
export type DeliveryAttemptRow = Readonly<{
  eventId: string;
  firstAttemptAt: string;
  lastAttemptAt: string;
  attemptCount: number;
  lastError: string | null;
  deliveredAt: string | null;
  dlqAt: string | null;
}>;

export interface EventStore {
  // ... existing methods unchanged ...

  readDeliveryAttempt(eventId: string): DeliveryAttemptRow | null;

  /** UPSERT: creates row with attempt_count=1 if new; else ++attempt_count, update last_attempt_at. */
  recordDeliveryAttempt(eventId: string, nowIso: string): void;

  /** Null clears; string sets. */
  updateLastError(eventId: string, message: string | null): void;

  markDelivered(eventId: string, nowIso: string): void;

  markDlq(eventId: string, nowIso: string): void;
}
```

`RelayOptions` in `packages/event-store/src/relay/loop.ts` gains:

```ts
maxAttempts?: number;  // default 10
onSendError?: (err: unknown, envelope: EventEnvelope, attempt: number) => void;
  // existing signature extended with attempt number; callers that ignore it stay compatible
```

Export `DeliveryAttemptRow` from `packages/event-store/src/index.ts`.

## 6. Testing plan

**Unit — `packages/event-store/test/unit/relay-dlq.test.ts` (new).**
- Happy path: one event, `send()` succeeds first try → `attempt_count = 1`, `delivered_at` set, cursor advances, `sent[]` has one primary message.
- Retry-then-succeed: `failNext(2, err)` → 3rd attempt succeeds → `attempt_count = 3`, `delivered_at` set, `last_error` retained (historical signal), `dlq_at IS NULL`.
- DLQ path: `failNext(∞, err)` with `maxAttempts: 3` → `attempt_count = 3`, `dlq_at` set, `delivered_at IS NULL`, `sent[]` has 1 DLQ message with all four `x-dlq-*` headers correctly populated, cursor advances.
- Defensive skip: seed `delivery_tracking` row with `delivered_at` already set, start relay → no `send()` call, cursor advances past the event.

**Integration — `packages/event-store/test/integration/relay-poison.test.ts` (new).**
- **Primary A1 scenario.** `SqliteEventStore` in a temp file, `InMemoryKafkaProducer`, `maxAttempts: 3`. Append E1, E2, E3 to one stream. `failNext(∞, err)`. Start relay. Wait until `sent[]` has 3 DLQ messages (poll with timeout). Assert: no primary messages, 3 DLQ messages with distinct `x-dlq-*` metadata, cursor = id(E3), all three `delivery_tracking` rows have `dlq_at IS NOT NULL`.
- **Transient recovery.** Append E1. `failNext(2, err)`. Start relay. Wait until `sent[]` has 1 primary message. Assert: `attempt_count = 3`, `delivered_at` set, `dlq_at IS NULL`, `last_error` retained.
- **Restart mid-retry (persistent counter).** Append E1. `failNext(∞, err)` with `maxAttempts: 10`. Start relay; poll `delivery_tracking.attempt_count` until it reaches 4. `stop()`. Create a new relay against the same store with `maxAttempts: 10`. Start. After 6 more attempts (total 10), event is DLQ-ed. Assert: `attempt_count = 10` in the final row (not 6), `dlq_at` set.

**Regression checks.** Existing `packages/event-store/test/**` tests must keep passing — the new methods are additive, `maxAttempts` is optional.

## 7. File map

Changed:
- `packages/event-store/src/store/schema.ts` — append DDL for `delivery_tracking`.
- `packages/event-store/src/store/interface.ts` — add `DeliveryAttemptRow` type + 5 methods.
- `packages/event-store/src/store/sqlite.ts` — implement the 5 methods with prepared statements.
- `packages/event-store/src/relay/loop.ts` — rewrite retry logic as state machine per §4.
- `packages/event-store/src/index.ts` — export `DeliveryAttemptRow`.

New:
- `packages/event-store/test/unit/relay-dlq.test.ts`.
- `packages/event-store/test/integration/relay-poison.test.ts`.

Unchanged but checked: `packages/projection-consumer` and `demo/issue-tracker-api` consume `EventStore` through the published interface; additive methods are safe. If either holds a mock/stub of `EventStore` in tests, the stub gains 5 no-op methods (expected: small fixture touch-ups).

## 8. Estimated volume

~200–300 lines of production code (most in `sqlite.ts` and `loop.ts`), ~200 lines of tests. No breaking changes to existing callers. One-commit or two-commit PR (schema+interface first, relay rewrite second) at author's discretion.

## 9. Follow-ups (not this spec)

- **A2.** HTTP ops endpoints in `bindings-http` — `GET /_ops/relay-dlq-count` (count `delivery_tracking WHERE dlq_at IS NOT NULL`), `GET /_ops/relay-lag` (max event_log.id − cursor). Adds an index on `delivery_tracking(dlq_at)` when it lands. Terminal-vs-retryable classification (`isTerminal(err)`) ships here.
- **A3.** `maxAttempts` surfaced through `@rntme/runtime` service manifest. Retention job for delivered rows (`DELETE FROM delivery_tracking WHERE delivered_at < now() − 7d` or similar). Integration with D6 topic generator so DLQ topic is provisioned alongside primary.
- **D9 (CloudEvents).** DLQ metadata headers migrate to CloudEvents extension attributes (`ce_dlqreason`, etc.) when envelope migrates. `x-dlq-*` header set in this spec is intentionally a transitional name; rename is a keyword search.
- **Observability.** `console.error` replacement with structured logs / OTel — tracked separately in `docs/gaps/infra-and-operability-gaps.md`.
