# Relay DLQ + `delivery_tracking` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the rntme relay from halting forever on a single "poison" Kafka-publish failure — add a bounded-attempts policy, a per-event DLQ topic, and a `delivery_tracking` SQLite table so the relay can continue past unsendable events while preserving durability and auditability.

**Architecture:** Add a `delivery_tracking(event_id PK, first_attempt_at, last_attempt_at, attempt_count, last_error, delivered_at, dlq_at)` table to the event-store schema. Extend `EventStore` with five UPSERT/read methods for that table. Rewrite `createRelay`'s per-record retry loop as a state machine that (a) persists the attempt counter so it survives relay restarts, (b) caps at `maxAttempts`, (c) on cap emits the original envelope to `{primary}.dlq` with `x-dlq-*` headers, (d) advances cursor only on terminal state (delivered OR dlq), (e) skips records already in terminal state (crash-gap recovery).

**Tech Stack:** TypeScript, `better-sqlite3` (SQLite, WAL), Vitest, pnpm workspaces. Package affected: `@rntme/event-store`. No dependency changes.

**Source spec:** `docs/superpowers/specs/done/2026-04-17-relay-dlq-delivery-tracking-design.md` (A1 scope — minimum viable; follow-ups A2/A3 listed at the end of the spec are explicitly deferred).

---

## Working directory

All paths in this plan are relative to the repo root `/home/coder/project`. Run commands from the repo root unless noted; `pnpm -F @rntme/event-store <script>` scopes scripts to this package.

## Conventions in the affected package (observe before coding)

- TypeScript ESM. Every intra-package import path ends in `.js` even though source files are `.ts` — mandatory, do not drop the extension.
- `SqliteEventStore` uses prepared statements stored inline in methods (see `packages/event-store/src/store/sqlite.ts:44-54`). Follow the same style — prepare inside method (SQLite caches prepared statements; class-member hoisting is not required here and not how existing code is written).
- Tests live in `packages/event-store/test/{unit,fixtures}/*.test.ts` and the root file `packages/event-store/test/{smoke,append-raw}.test.ts`. Use existing helpers `makeEvent` and `makeRequest` from `packages/event-store/test/fixtures/sample-events.ts`.
- Cleanup pattern: `let store: SqliteEventStore | null = null; afterEach(() => { store?.close(); store = null; });` — replicate in every new test file.
- `close()` exists on `SqliteEventStore` (see `packages/event-store/src/store/sqlite.ts:34-36`). Call it in `afterEach` to release the file handle.

## File map (what gets touched)

**Modify:**
- `packages/event-store/src/store/schema.ts` — append `delivery_tracking` DDL.
- `packages/event-store/src/store/interface.ts` — add `DeliveryAttemptRow` type + 5 method signatures on `EventStore`.
- `packages/event-store/src/store/sqlite.ts` — implement the 5 methods.
- `packages/event-store/src/relay/loop.ts` — rewrite inner retry loop as state machine; add `maxAttempts` option; extend `onSendError` signature.
- `packages/event-store/src/index.ts` — export `DeliveryAttemptRow`.
- `packages/event-store/test/unit/schema.test.ts` — add a test for the new table.

**Create:**
- `packages/event-store/test/unit/delivery-tracking.test.ts` — unit tests for the 5 store methods.
- `packages/event-store/test/unit/relay-dlq.test.ts` — unit tests for the relay state machine.
- `packages/event-store/test/integration/relay-poison.test.ts` — integration-level proof that poison events don't block the relay, and that the attempt counter survives a restart.

**Do NOT touch:** `@rntme/runtime`, `@rntme/projection-consumer`, `@rntme/graph-ir-compiler`, `@rntme/bindings-http`, `@rntme/seed`, the demo. Pre-flight grep has confirmed no mocks of `EventStore` exist outside `SqliteEventStore`; all consumers use the concrete class and will pick up the new methods transparently.

---

## Task 1 — Add `delivery_tracking` DDL to the schema

**Files:**
- Modify: `packages/event-store/src/store/schema.ts`
- Modify: `packages/event-store/test/unit/schema.test.ts`

- [ ] **Step 1.1: Write the failing test**

Append this `it` block inside the existing `describe('applyEventStoreSchema', ...)` in `packages/event-store/test/unit/schema.test.ts` (keep existing tests intact):

```ts
  it('creates delivery_tracking table with expected columns', () => {
    const db = new Database(':memory:');
    applyEventStoreSchema(db);

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as { name: string }[];
    expect(tables.map((t) => t.name)).toContain('delivery_tracking');

    const cols = db
      .prepare("PRAGMA table_info('delivery_tracking')")
      .all() as { name: string; notnull: number; pk: number }[];
    const byName = Object.fromEntries(cols.map((c) => [c.name, c]));
    expect(byName['event_id']?.pk).toBe(1);
    expect(byName['first_attempt_at']?.notnull).toBe(1);
    expect(byName['last_attempt_at']?.notnull).toBe(1);
    expect(byName['attempt_count']?.notnull).toBe(1);
    expect(byName['last_error']?.notnull).toBe(0);
    expect(byName['delivered_at']?.notnull).toBe(0);
    expect(byName['dlq_at']?.notnull).toBe(0);
  });
```

- [ ] **Step 1.2: Run test to confirm it fails**

```bash
pnpm -F @rntme/event-store vitest run test/unit/schema.test.ts
```

Expected: the new `it(...)` block fails (`delivery_tracking` not in table list). Existing three cases still pass.

- [ ] **Step 1.3: Add DDL**

Edit `packages/event-store/src/store/schema.ts`. Append to the `DDL` template literal (inside the backticks, after the existing `publish_cursor` CREATE):

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

Do not add indexes — A2 follow-up lands them when ops queries arrive.

- [ ] **Step 1.4: Run test to confirm it passes**

```bash
pnpm -F @rntme/event-store vitest run test/unit/schema.test.ts
```

Expected: all four `it(...)` blocks pass.

- [ ] **Step 1.5: Commit**

```bash
git add packages/event-store/src/store/schema.ts packages/event-store/test/unit/schema.test.ts
git commit -m "feat(event-store): add delivery_tracking table to schema"
```

---

## Task 2 — Add `DeliveryAttemptRow` type + `EventStore` method signatures

This task is type-only and makes the compile break (stub implementations land in Task 3 onwards). We intentionally keep the compile broken inside this task's commit boundary — next task (Task 3) restores compilability while adding the first real implementation. This reflects that signature and implementation are one logical change, split into two commits for reviewability.

Alternative if preferred: fold this task into Task 3's commit. Both are acceptable.

**Files:**
- Modify: `packages/event-store/src/store/interface.ts`

- [ ] **Step 2.1: Extend the interface**

Edit `packages/event-store/src/store/interface.ts`. Keep all existing exports; append:

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
```

Inside the `interface EventStore { ... }` block, after `writeCursor(...)` and before `appendRaw(...)`, add:

```ts
  /** Returns null when no attempt has been recorded for this event yet. */
  readDeliveryAttempt(eventId: string): DeliveryAttemptRow | null;

  /**
   * UPSERT the tracking row. On first call for `eventId`, inserts with
   * `attempt_count=1`, `first_attempt_at=nowIso`, `last_attempt_at=nowIso`.
   * On subsequent calls, increments `attempt_count` and updates `last_attempt_at`.
   */
  recordDeliveryAttempt(eventId: string, nowIso: string): void;

  /** Null clears the column; non-null string sets it (caller truncates). */
  updateLastError(eventId: string, message: string | null): void;

  /** Sets `delivered_at = nowIso`. Row must already exist (caller has recorded at least one attempt). */
  markDelivered(eventId: string, nowIso: string): void;

  /** Sets `dlq_at = nowIso`. Row must already exist. */
  markDlq(eventId: string, nowIso: string): void;
```

- [ ] **Step 2.2: Confirm the compile is red (expected, transient)**

```bash
pnpm -F @rntme/event-store typecheck
```

Expected: `SqliteEventStore` does not implement 5 new methods — several TS2420 errors. This is expected and fixed in Task 3.

- [ ] **Step 2.3: Commit**

```bash
git add packages/event-store/src/store/interface.ts
git commit -m "feat(event-store): add DeliveryAttemptRow + 5 delivery-tracking method signatures on EventStore"
```

---

## Task 3 — Implement `readDeliveryAttempt` (SqliteEventStore)

**Files:**
- Create: `packages/event-store/test/unit/delivery-tracking.test.ts`
- Modify: `packages/event-store/src/store/sqlite.ts`

- [ ] **Step 3.1: Write the failing test**

Create `packages/event-store/test/unit/delivery-tracking.test.ts` with:

```ts
import { describe, it, expect, afterEach } from 'vitest';
import { SqliteEventStore } from '../../src/store/sqlite.js';

let store: SqliteEventStore | null = null;
afterEach(() => { store?.close(); store = null; });

describe('SqliteEventStore — delivery tracking', () => {
  describe('readDeliveryAttempt', () => {
    it('returns null when no row exists for eventId', () => {
      store = new SqliteEventStore({ filename: ':memory:' });
      expect(store.readDeliveryAttempt('nope')).toBeNull();
    });
  });
});
```

- [ ] **Step 3.2: Add throwing stubs for the other four methods so TS compiles**

Edit `packages/event-store/src/store/sqlite.ts`. Import `DeliveryAttemptRow` and update the import line:

```ts
import type {
  AppendRawOptions,
  DeliveryAttemptRow,
  EventRecord,
  EventStore,
  ReadFromOptions,
} from './interface.js';
```

Inside the `SqliteEventStore` class (anywhere after `writeCursor`), add:

```ts
  readDeliveryAttempt(eventId: string): DeliveryAttemptRow | null {
    const row = this.db
      .prepare(
        `SELECT event_id, first_attempt_at, last_attempt_at, attempt_count,
                last_error, delivered_at, dlq_at
         FROM delivery_tracking WHERE event_id = ?`,
      )
      .get(eventId) as
      | {
          event_id: string;
          first_attempt_at: string;
          last_attempt_at: string;
          attempt_count: number;
          last_error: string | null;
          delivered_at: string | null;
          dlq_at: string | null;
        }
      | undefined;
    if (!row) return null;
    return {
      eventId: row.event_id,
      firstAttemptAt: row.first_attempt_at,
      lastAttemptAt: row.last_attempt_at,
      attemptCount: row.attempt_count,
      lastError: row.last_error,
      deliveredAt: row.delivered_at,
      dlqAt: row.dlq_at,
    };
  }

  recordDeliveryAttempt(_eventId: string, _nowIso: string): void {
    throw new Error('recordDeliveryAttempt: not implemented yet');
  }

  updateLastError(_eventId: string, _message: string | null): void {
    throw new Error('updateLastError: not implemented yet');
  }

  markDelivered(_eventId: string, _nowIso: string): void {
    throw new Error('markDelivered: not implemented yet');
  }

  markDlq(_eventId: string, _nowIso: string): void {
    throw new Error('markDlq: not implemented yet');
  }
```

- [ ] **Step 3.3: Run test to confirm it passes**

```bash
pnpm -F @rntme/event-store vitest run test/unit/delivery-tracking.test.ts
```

Expected: the single `it('returns null...')` case passes. `typecheck` should also be green now:

```bash
pnpm -F @rntme/event-store typecheck
```

Expected: no errors.

- [ ] **Step 3.4: Commit**

```bash
git add packages/event-store/src/store/sqlite.ts packages/event-store/test/unit/delivery-tracking.test.ts
git commit -m "feat(event-store): implement readDeliveryAttempt + stub remaining delivery methods"
```

---

## Task 4 — Implement `recordDeliveryAttempt` (INSERT-then-INCREMENT)

**Files:**
- Modify: `packages/event-store/test/unit/delivery-tracking.test.ts`
- Modify: `packages/event-store/src/store/sqlite.ts`

- [ ] **Step 4.1: Write failing tests**

Append inside `describe('SqliteEventStore — delivery tracking', () => { ... })` in the test file, right after the existing `describe('readDeliveryAttempt', ...)`:

```ts
  describe('recordDeliveryAttempt', () => {
    it('creates a new row with attempt_count=1 and both timestamps set to nowIso', () => {
      store = new SqliteEventStore({ filename: ':memory:' });
      store.recordDeliveryAttempt('ev-1', '2026-04-17T10:00:00.000Z');

      const row = store.readDeliveryAttempt('ev-1');
      expect(row).toEqual({
        eventId: 'ev-1',
        firstAttemptAt: '2026-04-17T10:00:00.000Z',
        lastAttemptAt: '2026-04-17T10:00:00.000Z',
        attemptCount: 1,
        lastError: null,
        deliveredAt: null,
        dlqAt: null,
      });
    });

    it('increments attempt_count and updates last_attempt_at on subsequent calls; first_attempt_at is preserved', () => {
      store = new SqliteEventStore({ filename: ':memory:' });
      store.recordDeliveryAttempt('ev-1', '2026-04-17T10:00:00.000Z');
      store.recordDeliveryAttempt('ev-1', '2026-04-17T10:00:05.000Z');
      store.recordDeliveryAttempt('ev-1', '2026-04-17T10:00:10.000Z');

      const row = store.readDeliveryAttempt('ev-1');
      expect(row?.attemptCount).toBe(3);
      expect(row?.firstAttemptAt).toBe('2026-04-17T10:00:00.000Z');
      expect(row?.lastAttemptAt).toBe('2026-04-17T10:00:10.000Z');
    });
  });
```

- [ ] **Step 4.2: Run tests to confirm they fail**

```bash
pnpm -F @rntme/event-store vitest run test/unit/delivery-tracking.test.ts
```

Expected: the two new cases fail ("not implemented yet"). The `readDeliveryAttempt` case still passes.

- [ ] **Step 4.3: Replace the stub with the real implementation**

Edit `packages/event-store/src/store/sqlite.ts`. Replace the `recordDeliveryAttempt` stub with:

```ts
  recordDeliveryAttempt(eventId: string, nowIso: string): void {
    this.db.prepare(`
      INSERT INTO delivery_tracking
        (event_id, first_attempt_at, last_attempt_at, attempt_count,
         last_error, delivered_at, dlq_at)
      VALUES (?, ?, ?, 1, NULL, NULL, NULL)
      ON CONFLICT(event_id) DO UPDATE SET
        attempt_count   = attempt_count + 1,
        last_attempt_at = excluded.last_attempt_at
    `).run(eventId, nowIso, nowIso);
  }
```

- [ ] **Step 4.4: Run tests to confirm they pass**

```bash
pnpm -F @rntme/event-store vitest run test/unit/delivery-tracking.test.ts
```

Expected: all three cases pass.

- [ ] **Step 4.5: Commit**

```bash
git add packages/event-store/src/store/sqlite.ts packages/event-store/test/unit/delivery-tracking.test.ts
git commit -m "feat(event-store): implement recordDeliveryAttempt (UPSERT with counter increment)"
```

---

## Task 5 — Implement `updateLastError`

**Files:**
- Modify: `packages/event-store/test/unit/delivery-tracking.test.ts`
- Modify: `packages/event-store/src/store/sqlite.ts`

- [ ] **Step 5.1: Write failing tests**

Append inside the outer `describe`, after `describe('recordDeliveryAttempt', ...)`:

```ts
  describe('updateLastError', () => {
    it('sets last_error when given a non-null string', () => {
      store = new SqliteEventStore({ filename: ':memory:' });
      store.recordDeliveryAttempt('ev-1', '2026-04-17T10:00:00.000Z');
      store.updateLastError('ev-1', 'connection refused');

      expect(store.readDeliveryAttempt('ev-1')?.lastError).toBe('connection refused');
    });

    it('clears last_error when given null', () => {
      store = new SqliteEventStore({ filename: ':memory:' });
      store.recordDeliveryAttempt('ev-1', '2026-04-17T10:00:00.000Z');
      store.updateLastError('ev-1', 'boom');
      store.updateLastError('ev-1', null);

      expect(store.readDeliveryAttempt('ev-1')?.lastError).toBeNull();
    });

    it('does nothing when the row does not exist (no row creation, no throw)', () => {
      store = new SqliteEventStore({ filename: ':memory:' });
      expect(() => store!.updateLastError('ghost', 'x')).not.toThrow();
      expect(store.readDeliveryAttempt('ghost')).toBeNull();
    });
  });
```

- [ ] **Step 5.2: Run tests to confirm they fail**

```bash
pnpm -F @rntme/event-store vitest run test/unit/delivery-tracking.test.ts
```

Expected: three new cases fail with "not implemented yet".

- [ ] **Step 5.3: Replace the stub**

In `packages/event-store/src/store/sqlite.ts`, replace `updateLastError` with:

```ts
  updateLastError(eventId: string, message: string | null): void {
    this.db
      .prepare('UPDATE delivery_tracking SET last_error = ? WHERE event_id = ?')
      .run(message, eventId);
  }
```

`UPDATE ... WHERE` against a missing row is a no-op in SQLite — no pre-check needed.

- [ ] **Step 5.4: Run tests to confirm they pass**

```bash
pnpm -F @rntme/event-store vitest run test/unit/delivery-tracking.test.ts
```

Expected: all six cases pass.

- [ ] **Step 5.5: Commit**

```bash
git add packages/event-store/src/store/sqlite.ts packages/event-store/test/unit/delivery-tracking.test.ts
git commit -m "feat(event-store): implement updateLastError"
```

---

## Task 6 — Implement `markDelivered` and `markDlq`

**Files:**
- Modify: `packages/event-store/test/unit/delivery-tracking.test.ts`
- Modify: `packages/event-store/src/store/sqlite.ts`

- [ ] **Step 6.1: Write failing tests**

Append inside the outer `describe`:

```ts
  describe('markDelivered / markDlq', () => {
    it('markDelivered sets delivered_at without touching dlq_at', () => {
      store = new SqliteEventStore({ filename: ':memory:' });
      store.recordDeliveryAttempt('ev-1', '2026-04-17T10:00:00.000Z');
      store.markDelivered('ev-1', '2026-04-17T10:00:03.000Z');

      const row = store.readDeliveryAttempt('ev-1');
      expect(row?.deliveredAt).toBe('2026-04-17T10:00:03.000Z');
      expect(row?.dlqAt).toBeNull();
    });

    it('markDlq sets dlq_at without touching delivered_at', () => {
      store = new SqliteEventStore({ filename: ':memory:' });
      store.recordDeliveryAttempt('ev-1', '2026-04-17T10:00:00.000Z');
      store.markDlq('ev-1', '2026-04-17T10:00:03.000Z');

      const row = store.readDeliveryAttempt('ev-1');
      expect(row?.dlqAt).toBe('2026-04-17T10:00:03.000Z');
      expect(row?.deliveredAt).toBeNull();
    });
  });
```

- [ ] **Step 6.2: Run tests to confirm they fail**

```bash
pnpm -F @rntme/event-store vitest run test/unit/delivery-tracking.test.ts
```

Expected: two new cases fail.

- [ ] **Step 6.3: Replace the stubs**

In `packages/event-store/src/store/sqlite.ts`, replace both stubs:

```ts
  markDelivered(eventId: string, nowIso: string): void {
    this.db
      .prepare('UPDATE delivery_tracking SET delivered_at = ? WHERE event_id = ?')
      .run(nowIso, eventId);
  }

  markDlq(eventId: string, nowIso: string): void {
    this.db
      .prepare('UPDATE delivery_tracking SET dlq_at = ? WHERE event_id = ?')
      .run(nowIso, eventId);
  }
```

- [ ] **Step 6.4: Run tests to confirm they pass**

```bash
pnpm -F @rntme/event-store vitest run test/unit/delivery-tracking.test.ts
```

Expected: all eight cases pass. No stubs remain.

- [ ] **Step 6.5: Commit**

```bash
git add packages/event-store/src/store/sqlite.ts packages/event-store/test/unit/delivery-tracking.test.ts
git commit -m "feat(event-store): implement markDelivered and markDlq"
```

---

## Task 7 — Export `DeliveryAttemptRow` from the package

**Files:**
- Modify: `packages/event-store/src/index.ts`

- [ ] **Step 7.1: Add the export**

Edit `packages/event-store/src/index.ts`. Replace the existing `Store` re-export block (the one starting `export type { EventStore, ReadFromOptions, EventRecord, } from './store/interface.js';`) with:

```ts
export type {
  EventStore,
  ReadFromOptions,
  EventRecord,
  DeliveryAttemptRow,
} from './store/interface.js';
```

- [ ] **Step 7.2: Verify build**

```bash
pnpm -F @rntme/event-store build
```

Expected: clean build, no errors. `dist/index.d.ts` now re-exports `DeliveryAttemptRow` (you can confirm with `grep DeliveryAttemptRow packages/event-store/dist/index.d.ts` — optional).

- [ ] **Step 7.3: Commit**

```bash
git add packages/event-store/src/index.ts
git commit -m "feat(event-store): export DeliveryAttemptRow from package entry"
```

---

## Task 8 — Extend `RelayOptions` with `maxAttempts` + richer `onSendError`

The relay body still uses the old retry-forever code at this point; we're just widening the options surface so Task 9–12 can hang state-machine behavior off these options. No test yet — it is a type-surface change consumed by the next tasks.

**Files:**
- Modify: `packages/event-store/src/relay/loop.ts`

- [ ] **Step 8.1: Update `RelayOptions`**

Edit `packages/event-store/src/relay/loop.ts`. Replace the existing `RelayOptions` type with:

```ts
export type RelayOptions = Readonly<{
  store: EventStore;
  kafka: KafkaProducer;
  cursorId: string;
  pollIntervalMs?: number;
  batchSize?: number;
  topicOf?: (aggregateType: string) => string;
  maxBackoffMs?: number;
  /** Default: 10. Number of primary-topic send attempts before DLQ. Must be >= 1. */
  maxAttempts?: number;
  /** Called once per failed send. `attempt` is 1-indexed. */
  onSendError?: (err: unknown, envelope: EventEnvelope, attempt: number) => void;
}>;
```

- [ ] **Step 8.2: Update the default callback + add a `maxAttempts` binding**

Inside `createRelay`, replace the lines that set `onErr` and add the `maxAttempts` binding. Before the `let running = false` line, the block should read:

```ts
  const poll = opts.pollIntervalMs ?? 100;
  const batch = opts.batchSize ?? 500;
  const topicOf = opts.topicOf ?? defaultTopicOf;
  const maxBackoff = opts.maxBackoffMs ?? 1000;
  const maxAttempts = opts.maxAttempts ?? 10;
  const onErr = opts.onSendError ?? ((err, _envelope, attempt) => {
    // eslint-disable-next-line no-console
    console.error(`[relay] kafka send failed (attempt ${attempt}), will retry:`, err);
  });
```

- [ ] **Step 8.3: Propagate `attempt` argument in the current call site**

For now, change the existing inner loop to pass a hardcoded `1` as the third argument (it will be replaced with a real counter in Task 9). Find the line `onErr(err, rec.envelope);` inside the `catch (err)` block and change it to:

```ts
            onErr(err, rec.envelope, 1);
```

This keeps existing tests green on the expanded signature.

- [ ] **Step 8.4: Run the existing relay tests**

```bash
pnpm -F @rntme/event-store vitest run test/unit/relay.test.ts
```

Expected: all four existing cases still pass. No behavioral change — only type surface.

- [ ] **Step 8.5: Commit**

```bash
git add packages/event-store/src/relay/loop.ts
git commit -m "feat(event-store): widen RelayOptions with maxAttempts + onSendError(attempt)"
```

---

## Task 9 — Relay happy path records `delivery_tracking`

Drive the first behavioral change from a unit test: on successful send, `delivery_tracking` has a row with `attempt_count=1` and `delivered_at` set.

**Files:**
- Create: `packages/event-store/test/unit/relay-dlq.test.ts`
- Modify: `packages/event-store/src/relay/loop.ts`

- [ ] **Step 9.1: Write failing test**

Create `packages/event-store/test/unit/relay-dlq.test.ts`:

```ts
import { describe, it, expect, afterEach } from 'vitest';
import { SqliteEventStore } from '../../src/store/sqlite.js';
import { createInMemoryKafkaProducer } from '../../src/kafka/in-memory.js';
import { createRelay } from '../../src/relay/loop.js';
import { makeEvent, makeRequest } from '../fixtures/sample-events.js';

let store: SqliteEventStore | null = null;
afterEach(() => { store?.close(); store = null; });

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitUntil(pred: () => boolean, timeoutMs = 2000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (!pred() && Date.now() < deadline) await wait(5);
  return pred();
}

describe('relay — delivery_tracking (happy path)', () => {
  it('records attempt_count=1 and delivered_at after a successful send', async () => {
    store = new SqliteEventStore({ filename: ':memory:' });
    const kafka = createInMemoryKafkaProducer();
    const relay = createRelay({
      store, kafka, cursorId: 'kafka-main', pollIntervalMs: 5, batchSize: 100,
    });

    store.appendEvents([makeRequest('Issue-1', [makeEvent({ eventId: 'a' })])]);

    relay.start();
    expect(await waitUntil(() => kafka.sent.length >= 1)).toBe(true);
    await relay.stop();

    const row = store.readDeliveryAttempt('a');
    expect(row?.attemptCount).toBe(1);
    expect(row?.deliveredAt).not.toBeNull();
    expect(row?.dlqAt).toBeNull();
    expect(row?.lastError).toBeNull();
  });
});
```

- [ ] **Step 9.2: Run test to confirm it fails**

```bash
pnpm -F @rntme/event-store vitest run test/unit/relay-dlq.test.ts
```

Expected: `attemptCount` is undefined (no row exists — relay never called `recordDeliveryAttempt`). Test fails.

- [ ] **Step 9.3: Rewrite the inner record-processing block in `loop.ts`**

In `packages/event-store/src/relay/loop.ts`, replace the body of the `for (const rec of records) { ... }` loop (everything from `if (!running) break;` down to `highestDeliveredId = rec.id;`) with:

```ts
        if (!running) break;
        const eventId = rec.envelope.eventId;
        let attempts = 0;
        let backoff = 10;
        while (running) {
          attempts += 1;
          opts.store.recordDeliveryAttempt(eventId, new Date().toISOString());
          try {
            await opts.kafka.send({
              topic: topicOf(rec.envelope.aggregateType),
              key: rec.envelope.stream,
              headers: {
                'event-id': rec.envelope.eventId,
                'event-type': rec.envelope.eventType,
                'schema-version': String(rec.envelope.schemaVersion),
              },
              value: JSON.stringify(rec.envelope),
            });
            opts.store.markDelivered(eventId, new Date().toISOString());
            break;
          } catch (err) {
            onErr(err, rec.envelope, attempts);
            await sleep(backoff);
            backoff = Math.min(backoff * 2, maxBackoff);
            if (!running) return;
          }
        }
        highestDeliveredId = rec.id;
```

- [ ] **Step 9.4: Run the new test + existing relay tests**

```bash
pnpm -F @rntme/event-store vitest run test/unit/relay-dlq.test.ts test/unit/relay.test.ts
```

Expected: new case passes; existing four cases still pass. (Note: the existing retry-then-succeed test will now see `attempt_count=2` in the tracking table after 1 failure + 1 success, but that test doesn't inspect `delivery_tracking` — it will stay green.)

- [ ] **Step 9.5: Commit**

```bash
git add packages/event-store/src/relay/loop.ts packages/event-store/test/unit/relay-dlq.test.ts
git commit -m "feat(event-store): relay records delivery_tracking on successful send"
```

---

## Task 10 — Relay records `last_error` on retries; `delivered_at` on eventual success

**Files:**
- Modify: `packages/event-store/test/unit/relay-dlq.test.ts`
- Modify: `packages/event-store/src/relay/loop.ts`

- [ ] **Step 10.1: Add failing test**

Append inside the existing `describe('relay — delivery_tracking (happy path)', ...)` block:

```ts
  it('increments attempt_count per retry and retains last_error after eventual success', async () => {
    store = new SqliteEventStore({ filename: ':memory:' });
    const kafka = createInMemoryKafkaProducer();
    const relay = createRelay({
      store, kafka, cursorId: 'kafka-main', pollIntervalMs: 5, batchSize: 100,
    });
    store.appendEvents([makeRequest('Issue-1', [makeEvent({ eventId: 'a' })])]);
    kafka.failNext(2, new Error('transient broker hiccup'));

    relay.start();
    expect(await waitUntil(() => kafka.sent.length >= 1)).toBe(true);
    await relay.stop();

    const row = store.readDeliveryAttempt('a');
    expect(row?.attemptCount).toBe(3);
    expect(row?.deliveredAt).not.toBeNull();
    expect(row?.dlqAt).toBeNull();
    expect(row?.lastError).toBe('transient broker hiccup');
  });
```

- [ ] **Step 10.2: Run test to confirm it fails**

```bash
pnpm -F @rntme/event-store vitest run test/unit/relay-dlq.test.ts
```

Expected: `lastError` is `null` — relay catches errors but never calls `updateLastError`.

- [ ] **Step 10.3: Persist error + attempt count on each failed send**

In the `catch (err)` block of the inner `while (running)` loop (in `packages/event-store/src/relay/loop.ts`), insert a call to `updateLastError` BEFORE `onErr(...)`. The catch block should read:

```ts
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            opts.store.updateLastError(eventId, truncate(msg, 1024));
            onErr(err, rec.envelope, attempts);
            await sleep(backoff);
            backoff = Math.min(backoff * 2, maxBackoff);
            if (!running) return;
          }
```

Then add a module-local helper at the bottom of the file, next to `sleep`:

```ts
function truncate(s: string, maxBytes: number): string {
  // Byte-bounded truncation: TextEncoder would be most accurate, but for
  // error messages a char-count upper bound is a safe lower-bound guard.
  // We accept that multi-byte chars may yield strings slightly over maxBytes;
  // the 1024 target is a header-size heuristic, not a hard broker limit.
  return s.length > maxBytes ? s.slice(0, maxBytes) : s;
}
```

- [ ] **Step 10.4: Run tests to confirm the suite passes**

```bash
pnpm -F @rntme/event-store vitest run test/unit/relay-dlq.test.ts test/unit/relay.test.ts
```

Expected: both cases in `relay-dlq.test.ts` pass. All four cases in `relay.test.ts` pass.

- [ ] **Step 10.5: Commit**

```bash
git add packages/event-store/src/relay/loop.ts packages/event-store/test/unit/relay-dlq.test.ts
git commit -m "feat(event-store): relay records last_error on each failed send (truncated to 1024 bytes)"
```

---

## Task 11 — DLQ branch: emit to `{topic}.dlq` after `maxAttempts`, mark `dlq_at`

**Files:**
- Modify: `packages/event-store/test/unit/relay-dlq.test.ts`
- Modify: `packages/event-store/src/relay/loop.ts`

- [ ] **Step 11.1: Add failing test**

Append to `packages/event-store/test/unit/relay-dlq.test.ts`:

```ts
describe('relay — DLQ path', () => {
  it('emits to {topic}.dlq after maxAttempts primary failures, advances cursor, marks dlq_at', async () => {
    store = new SqliteEventStore({ filename: ':memory:' });
    const kafka = createInMemoryKafkaProducer();
    const relay = createRelay({
      store, kafka,
      cursorId: 'kafka-main',
      pollIntervalMs: 5,
      batchSize: 100,
      maxAttempts: 3,
      maxBackoffMs: 5,
      onSendError: () => { /* silence */ },
    });
    store.appendEvents([makeRequest('Issue-1', [makeEvent({ eventId: 'a' })])]);
    // Fail exactly maxAttempts times — primary never succeeds; the next send()
    // is the DLQ emit, which succeeds because failures are exhausted.
    kafka.failNext(3, new Error('schema violation at broker'));

    relay.start();
    // Wait until we see exactly one DLQ message (primary-topic sends all fail; DLQ succeeds on first try).
    expect(await waitUntil(
      () => kafka.sent.some((m) => m.topic === 'rntme.issue.v1.dlq'),
      3000,
    )).toBe(true);
    await relay.stop();

    const primaryMsgs = kafka.sent.filter((m) => m.topic === 'rntme.issue.v1');
    const dlqMsgs = kafka.sent.filter((m) => m.topic === 'rntme.issue.v1.dlq');
    expect(primaryMsgs).toHaveLength(0);
    expect(dlqMsgs).toHaveLength(1);

    const dlq = dlqMsgs[0]!;
    expect(dlq.key).toBe('Issue-1');
    expect(dlq.headers['event-id']).toBe('a');
    expect(dlq.headers['event-type']).toBe('IssueReport');
    expect(dlq.headers['schema-version']).toBe('1');
    expect(dlq.headers['x-dlq-reason']).toBe('max-attempts-exceeded');
    expect(dlq.headers['x-dlq-attempts']).toBe('3');
    expect(dlq.headers['x-dlq-first-attempt-at']).toMatch(/^20\d{2}-/);
    expect(dlq.headers['x-dlq-last-error']).toBe('schema violation at broker');
    // Envelope value preserved verbatim.
    const value = JSON.parse(dlq.value) as { eventId: string };
    expect(value.eventId).toBe('a');

    expect(store.readCursor('kafka-main')).toBeGreaterThanOrEqual(1);
    const row = store.readDeliveryAttempt('a');
    expect(row?.attemptCount).toBe(3);
    expect(row?.dlqAt).not.toBeNull();
    expect(row?.deliveredAt).toBeNull();
    expect(row?.lastError).toBe('schema violation at broker');
  });
});
```

Why `failNext(3)` and not more: the in-memory producer fails the next N `send()` calls regardless of topic. `maxAttempts=3` means 3 primary-topic failures; the 4th `send()` call is to `{topic}.dlq` and must succeed, so exactly 3 failures exhausts the queue at the right moment.

- [ ] **Step 11.2: Run test to confirm it fails**

```bash
pnpm -F @rntme/event-store vitest run test/unit/relay-dlq.test.ts
```

Expected: no DLQ message ever arrives — the relay is still in the infinite-retry mode (no `maxAttempts` check yet). The `waitUntil` returns `false`; expect fails.

- [ ] **Step 11.3: Add DLQ branch to the relay loop**

In `packages/event-store/src/relay/loop.ts`, modify the `catch (err)` block to check `attempts >= maxAttempts` and call an `emitDlq` helper. The final inner loop should look like:

```ts
        if (!running) break;
        const eventId = rec.envelope.eventId;
        const primaryTopic = topicOf(rec.envelope.aggregateType);
        let attempts = 0;
        let backoff = 10;
        while (running) {
          attempts += 1;
          const attemptIso = new Date().toISOString();
          opts.store.recordDeliveryAttempt(eventId, attemptIso);
          try {
            await opts.kafka.send({
              topic: primaryTopic,
              key: rec.envelope.stream,
              headers: {
                'event-id': rec.envelope.eventId,
                'event-type': rec.envelope.eventType,
                'schema-version': String(rec.envelope.schemaVersion),
              },
              value: JSON.stringify(rec.envelope),
            });
            opts.store.markDelivered(eventId, new Date().toISOString());
            break;
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            opts.store.updateLastError(eventId, truncate(msg, 1024));
            onErr(err, rec.envelope, attempts);
            if (attempts >= maxAttempts) {
              const state = opts.store.readDeliveryAttempt(eventId);
              const firstAttemptAt = state?.firstAttemptAt ?? attemptIso;
              await emitDlq({
                kafka: opts.kafka,
                rec,
                primaryTopic,
                attempts,
                firstAttemptAt,
                lastError: msg,
                maxBackoff,
                isRunning: () => running,
              });
              opts.store.markDlq(eventId, new Date().toISOString());
              break;
            }
            await sleep(backoff);
            backoff = Math.min(backoff * 2, maxBackoff);
            if (!running) return;
          }
        }
        if (!running) return;
        highestDeliveredId = rec.id;
```

Then add the `emitDlq` helper at the bottom of the file, below `truncate`:

```ts
type EmitDlqOpts = Readonly<{
  kafka: KafkaProducer;
  rec: EventRecord;
  primaryTopic: string;
  attempts: number;
  firstAttemptAt: string;
  lastError: string;
  maxBackoff: number;
  isRunning: () => boolean;
}>;

async function emitDlq(o: EmitDlqOpts): Promise<void> {
  let backoff = 10;
  while (o.isRunning()) {
    try {
      await o.kafka.send({
        topic: `${o.primaryTopic}.dlq`,
        key: o.rec.envelope.stream,
        headers: {
          'event-id': o.rec.envelope.eventId,
          'event-type': o.rec.envelope.eventType,
          'schema-version': String(o.rec.envelope.schemaVersion),
          'x-dlq-reason': 'max-attempts-exceeded',
          'x-dlq-attempts': String(o.attempts),
          'x-dlq-first-attempt-at': o.firstAttemptAt,
          'x-dlq-last-error': truncate(o.lastError, 1024),
        },
        value: JSON.stringify(o.rec.envelope),
      });
      return;
    } catch (dlqErr) {
      // eslint-disable-next-line no-console
      console.error(`[relay] DLQ-send failed for ${o.rec.envelope.eventId}, will retry:`, dlqErr);
      await sleep(backoff);
      backoff = Math.min(backoff * 2, o.maxBackoff);
    }
  }
}
```

Also add the `EventRecord` type to the imports at the top if it's not already imported — it is, already: `import type { EventStore, EventRecord } from '../store/interface.js';`. No action needed.

- [ ] **Step 11.4: Run tests to confirm all pass**

```bash
pnpm -F @rntme/event-store vitest run test/unit/relay-dlq.test.ts test/unit/relay.test.ts
```

Expected: DLQ-path test passes. All earlier relay-dlq tests still pass. All four cases in `relay.test.ts` still pass.

- [ ] **Step 11.5: Commit**

```bash
git add packages/event-store/src/relay/loop.ts packages/event-store/test/unit/relay-dlq.test.ts
git commit -m "feat(event-store): emit to {topic}.dlq after maxAttempts, mark dlq_at, advance cursor"
```

---

## Task 12 — Defensive skip for records already in terminal state

Catch-up after a crash between `markDelivered`/`markDlq` and `writeCursor`. On restart the relay re-reads the record but must not re-send.

**Files:**
- Modify: `packages/event-store/test/unit/relay-dlq.test.ts`
- Modify: `packages/event-store/src/relay/loop.ts`

- [ ] **Step 12.1: Add failing test**

Append to `packages/event-store/test/unit/relay-dlq.test.ts`:

```ts
describe('relay — defensive skip on terminal state', () => {
  it('does not call kafka.send when delivery_tracking already has delivered_at set', async () => {
    store = new SqliteEventStore({ filename: ':memory:' });
    const kafka = createInMemoryKafkaProducer();
    store.appendEvents([makeRequest('Issue-1', [makeEvent({ eventId: 'a' })])]);

    // Simulate a crash scenario: delivery_tracking terminal, cursor not advanced.
    store.recordDeliveryAttempt('a', '2026-04-17T10:00:00.000Z');
    store.markDelivered('a', '2026-04-17T10:00:01.000Z');

    const relay = createRelay({
      store, kafka, cursorId: 'kafka-main', pollIntervalMs: 5, batchSize: 100,
    });
    relay.start();
    // Give the loop enough time to process; nothing should be sent, cursor should advance past 'a'.
    expect(await waitUntil(() => store!.readCursor('kafka-main') >= 1, 1000)).toBe(true);
    await relay.stop();

    expect(kafka.sent).toHaveLength(0);
  });

  it('does not call kafka.send when delivery_tracking already has dlq_at set', async () => {
    store = new SqliteEventStore({ filename: ':memory:' });
    const kafka = createInMemoryKafkaProducer();
    store.appendEvents([makeRequest('Issue-1', [makeEvent({ eventId: 'a' })])]);

    store.recordDeliveryAttempt('a', '2026-04-17T10:00:00.000Z');
    store.markDlq('a', '2026-04-17T10:00:01.000Z');

    const relay = createRelay({
      store, kafka, cursorId: 'kafka-main', pollIntervalMs: 5, batchSize: 100,
    });
    relay.start();
    expect(await waitUntil(() => store!.readCursor('kafka-main') >= 1, 1000)).toBe(true);
    await relay.stop();

    expect(kafka.sent).toHaveLength(0);
  });
});
```

- [ ] **Step 12.2: Run tests to confirm they fail**

```bash
pnpm -F @rntme/event-store vitest run test/unit/relay-dlq.test.ts
```

Expected: both new cases fail. The relay will send the event again (calling `recordDeliveryAttempt`, which increments `attempt_count`, and then `kafka.send`), so `kafka.sent.length` will be 1, not 0. The `delivered_at` row state does not yet short-circuit processing.

- [ ] **Step 12.3: Add the defensive-skip branch**

In `packages/event-store/src/relay/loop.ts`, at the top of the `for (const rec of records) { ... }` body — BEFORE the `const eventId = rec.envelope.eventId;` line (move that up) — add:

```ts
        if (!running) break;
        const eventId = rec.envelope.eventId;
        const existing = opts.store.readDeliveryAttempt(eventId);
        if (existing && (existing.deliveredAt !== null || existing.dlqAt !== null)) {
          highestDeliveredId = rec.id;
          continue;
        }
        const primaryTopic = topicOf(rec.envelope.aggregateType);
        let attempts = existing?.attemptCount ?? 0;
        let backoff = 10;
        while (running) {
```

(Note: the `attempts` initialization now reads from `existing`, preserving the counter across relay restarts — this is the persistent-counter property from the spec.)

The original `if (!running) break;` line at the top of the block should now be removed (it was the first line of the block — it's folded into the new header).

- [ ] **Step 12.4: Run the full relay + delivery-tracking suite**

```bash
pnpm -F @rntme/event-store vitest run test/unit/relay-dlq.test.ts test/unit/relay.test.ts test/unit/delivery-tracking.test.ts
```

Expected: all cases pass.

- [ ] **Step 12.5: Commit**

```bash
git add packages/event-store/src/relay/loop.ts packages/event-store/test/unit/relay-dlq.test.ts
git commit -m "feat(event-store): defensive skip for already-terminal rows; persistent attempt counter across restarts"
```

---

## Task 13 — Integration test: poison event does not block subsequent events

Integration-level coverage of the primary A1 hazard: a single event that always fails must not prevent delivery of later events.

**Files:**
- Create: `packages/event-store/test/integration/relay-poison.test.ts`

- [ ] **Step 13.1: Write the integration test**

Create `packages/event-store/test/integration/relay-poison.test.ts`:

```ts
import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { SqliteEventStore } from '../../src/store/sqlite.js';
import { createInMemoryKafkaProducer } from '../../src/kafka/in-memory.js';
import { createRelay } from '../../src/relay/loop.js';
import { makeEvent, makeRequest } from '../fixtures/sample-events.js';

let tmpDir: string | null = null;
let store: SqliteEventStore | null = null;
afterEach(() => {
  store?.close();
  store = null;
  if (tmpDir) { rmSync(tmpDir, { recursive: true, force: true }); tmpDir = null; }
});

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitUntil(pred: () => boolean, timeoutMs = 3000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (!pred() && Date.now() < deadline) await wait(5);
  return pred();
}

describe('relay poison-event integration (A1 primary scenario)', () => {
  it('three always-failing events each DLQ after maxAttempts; cursor advances past all three', async () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'rntme-relay-poison-'));
    const dbPath = join(tmpDir, 'events.db');
    store = new SqliteEventStore({ filename: dbPath });

    const kafka = createInMemoryKafkaProducer();
    // Every primary send will fail (3 events × 3 attempts = 9 primary send() calls).
    // Every DLQ send (3 DLQ calls) will succeed.
    kafka.failNext(9, new Error('broker-side schema violation'));

    store.appendEvents([makeRequest('Issue-1', [
      makeEvent({ eventId: 'a', aggregateId: '1' }),
      makeEvent({ eventId: 'b', aggregateId: '1' }),
    ])]);
    store.appendEvents([makeRequest('Issue-2', [
      makeEvent({ eventId: 'c', aggregateId: '2' }),
    ])]);

    const relay = createRelay({
      store, kafka,
      cursorId: 'kafka-main',
      pollIntervalMs: 5,
      batchSize: 100,
      maxAttempts: 3,
      maxBackoffMs: 5,
      onSendError: () => { /* silence for test stability */ },
    });
    relay.start();

    expect(await waitUntil(
      () => kafka.sent.filter((m) => m.topic.endsWith('.dlq')).length >= 3,
      5000,
    )).toBe(true);
    await relay.stop();

    const primary = kafka.sent.filter((m) => !m.topic.endsWith('.dlq'));
    const dlq = kafka.sent.filter((m) => m.topic.endsWith('.dlq'));
    expect(primary).toHaveLength(0);
    expect(dlq).toHaveLength(3);

    const dlqEventIds = dlq.map((m) => m.headers['event-id']).sort();
    expect(dlqEventIds).toEqual(['a', 'b', 'c']);

    for (const id of ['a', 'b', 'c'] as const) {
      const row = store.readDeliveryAttempt(id);
      expect(row?.attemptCount).toBe(3);
      expect(row?.dlqAt).not.toBeNull();
      expect(row?.deliveredAt).toBeNull();
      expect(row?.lastError).toBe('broker-side schema violation');
    }

    // Cursor has advanced past all three events (id 1, 2, 3 in insertion order).
    expect(store.readCursor('kafka-main')).toBeGreaterThanOrEqual(3);
  });
});
```

- [ ] **Step 13.2: Run integration test**

```bash
pnpm -F @rntme/event-store vitest run test/integration/relay-poison.test.ts
```

Expected: passes. If you hit a flake from short timeouts, verify `pollIntervalMs: 5`, `maxBackoffMs: 5` are in place.

- [ ] **Step 13.3: Commit**

```bash
git add packages/event-store/test/integration/relay-poison.test.ts
git commit -m "test(event-store): integration proof that poison events don't block the relay"
```

---

## Task 14 — Integration test: attempt counter survives relay restart

**Files:**
- Modify: `packages/event-store/test/integration/relay-poison.test.ts`

- [ ] **Step 14.1: Append the restart test**

Append inside the existing `describe('relay poison-event integration (A1 primary scenario)', ...)` block:

```ts
  it('attempt_count persists across relay restart: poison event DLQ after exactly maxAttempts total attempts', async () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'rntme-relay-restart-'));
    const dbPath = join(tmpDir, 'events.db');
    store = new SqliteEventStore({ filename: dbPath });

    const kafka = createInMemoryKafkaProducer();
    kafka.failNext(10, new Error('broker unreachable'));

    store.appendEvents([makeRequest('Issue-1', [
      makeEvent({ eventId: 'a', aggregateId: '1' }),
    ])]);

    const relay1 = createRelay({
      store, kafka,
      cursorId: 'kafka-main',
      pollIntervalMs: 5,
      batchSize: 100,
      maxAttempts: 10,
      maxBackoffMs: 5,
      onSendError: () => {},
    });
    relay1.start();
    // Wait for attempt_count to reach at least 4 on the poison event.
    expect(await waitUntil(
      () => (store!.readDeliveryAttempt('a')?.attemptCount ?? 0) >= 4,
      3000,
    )).toBe(true);
    await relay1.stop();

    const midCount = store.readDeliveryAttempt('a')?.attemptCount ?? 0;
    expect(midCount).toBeGreaterThanOrEqual(4);

    const relay2 = createRelay({
      store, kafka,
      cursorId: 'kafka-main',
      pollIntervalMs: 5,
      batchSize: 100,
      maxAttempts: 10,
      maxBackoffMs: 5,
      onSendError: () => {},
    });
    relay2.start();
    expect(await waitUntil(
      () => kafka.sent.some((m) => m.topic.endsWith('.dlq')),
      5000,
    )).toBe(true);
    await relay2.stop();

    const row = store.readDeliveryAttempt('a');
    // Counter continued from midCount; final must be exactly maxAttempts (10).
    expect(row?.attemptCount).toBe(10);
    expect(row?.dlqAt).not.toBeNull();
    expect(store.readCursor('kafka-main')).toBeGreaterThanOrEqual(1);
  });
```

- [ ] **Step 14.2: Run integration test**

```bash
pnpm -F @rntme/event-store vitest run test/integration/relay-poison.test.ts
```

Expected: both cases pass.

- [ ] **Step 14.3: Commit**

```bash
git add packages/event-store/test/integration/relay-poison.test.ts
git commit -m "test(event-store): integration proof that attempt counter survives relay restart"
```

---

## Task 15 — Full verification + package README touch

Confirm nothing else regressed, the package still builds/lints, and leave a small README hint so future readers see the new behavior.

**Files:**
- Modify: `packages/event-store/README.md` (one paragraph)

- [ ] **Step 15.1: Run the package's full test suite**

```bash
pnpm -F @rntme/event-store test
```

Expected: all tests pass (existing + newly added `delivery-tracking.test.ts`, `relay-dlq.test.ts`, `integration/relay-poison.test.ts`).

- [ ] **Step 15.2: Typecheck**

```bash
pnpm -F @rntme/event-store typecheck
```

Expected: no errors.

- [ ] **Step 15.3: Lint**

```bash
pnpm -F @rntme/event-store lint
```

Expected: no errors. If there are warnings about unused `EventEnvelope` import or similar, fix them in the affected file.

- [ ] **Step 15.4: Full workspace typecheck + test — confirm no dependent package broke**

```bash
pnpm -r run typecheck
pnpm -r run test
```

Expected: all packages green. `@rntme/projection-consumer`, `@rntme/runtime`, `@rntme/graph-ir-compiler`, `@rntme/bindings-http`, `@rntme/seed`, and the demo all consume `EventStore` but only call pre-existing methods; the new methods are additive and should not affect them.

- [ ] **Step 15.5: Append a short README section**

Open `packages/event-store/README.md`. Locate the most appropriate section for operational behavior (usually "Invariants & gotchas" or "API" per the uniform README template — if in doubt, append a new short section just before "Out of scope"). Add (inline edit):

```markdown
### Delivery tracking & DLQ (A1)

The relay records every primary-topic send attempt in `delivery_tracking(event_id PK, first_attempt_at, last_attempt_at, attempt_count, last_error, delivered_at, dlq_at)`. After `RelayOptions.maxAttempts` (default 10) consecutive failures on the primary topic, the relay emits the original envelope to `{primaryTopic}.dlq` with `x-dlq-reason`, `x-dlq-attempts`, `x-dlq-first-attempt-at`, `x-dlq-last-error` headers, then marks `dlq_at` and advances `publish_cursor`. The attempt counter is persistent — it survives relay restarts. HTTP ops endpoints (`/_ops/relay-dlq-count`, `/_ops/relay-lag`), terminal-vs-retryable classification, and a retention job for `delivery_tracking` are deferred (A2/A3). See `docs/superpowers/specs/done/2026-04-17-relay-dlq-delivery-tracking-design.md`.
```

- [ ] **Step 15.6: Commit**

```bash
git add packages/event-store/README.md
git commit -m "docs(event-store): note delivery_tracking + DLQ behavior in README"
```

- [ ] **Step 15.7: Final sanity — look at the commit graph**

```bash
git log --oneline main..HEAD
```

Expected: around 12–14 commits, all scoped to `@rntme/event-store`, each reading as one meaningful step. If anything looks mis-scoped (e.g. a change to `projection-consumer` slipped in), investigate before opening a PR.

---

## Follow-ups explicitly NOT in this plan

Defer to later work, tracked in the design doc §9:
- **A2** — `GET /_ops/relay-dlq-count`, `GET /_ops/relay-lag` in `bindings-http`. `isTerminal(err)` predicate for first-attempt DLQ.
- **A3** — `maxAttempts` via `@rntme/runtime` service manifest. Retention job. Integration with D6 topic generator.
- **D9 (CloudEvents)** — `x-dlq-*` header names are transitional; will migrate to `ce_dlq*` extensions when the envelope migrates.
- **Observability** — structured logs / OTel replacing `console.error` — cross-cutting.

---

## Self-review notes (done while drafting, not a work item)

Checked:
- **Spec coverage.** §2 (decisions) and §3–§5 of the spec all map to tasks: data model → Task 1, interface → Task 2, implementations → Tasks 3–7, state machine → Tasks 8–12, integration coverage → Tasks 13–14. §6 test list is covered except the "defensive skip" unit test — covered in Task 12.
- **Placeholders.** Every code block is complete. No TBD/TODO. Truncation helper is explicit.
- **Type consistency.** `DeliveryAttemptRow` field names (`attemptCount`, `deliveredAt`, `dlqAt`, `lastError`, `firstAttemptAt`, `lastAttemptAt`, `eventId`) appear identically in interface, sqlite impl, relay impl, and tests.
- **Commit granularity.** Each task ends with a single commit targeting a single behavior. Commits are reorderable within a stretch only if types resolve — Task 2 → Task 3 is the one type-stub gap, called out explicitly.
- **External impact.** Pre-flight grep confirms no `EventStore` mocks or alternative implementations outside `SqliteEventStore` in this repo; additive interface methods will not break dependents. Task 15.4 verifies this with the repo-wide typecheck + test.
