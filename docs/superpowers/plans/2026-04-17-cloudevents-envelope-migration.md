# CloudEvents Envelope Migration (D9) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate rntme's event envelope to CloudEvents 1.0 end-to-end — in-memory TS type (camelCase), `event_log` storage, Kafka binary content mode, HTTP response shape, correlation + causation + commandId propagation from HTTP middleware through events, DLQ as a wrapper CE event. Bundles D6 topic-naming fix.

**Architecture:** Breaking cascade across `@rntme/event-store`, `@rntme/graph-ir-compiler`, `@rntme/bindings-http`, `@rntme/projection-consumer`, `@rntme/seed`, `@rntme/runtime`, `demo/issue-tracker-api`. Single feature branch; per-package tasks land sequentially; cross-package `pnpm -r run build` only re-greens after final task. Per-task `pnpm -F <pkg> test` always green at task end.

**Tech Stack:** TypeScript, better-sqlite3, Hono, Kafka (in-memory bus for demo), Vitest, CloudEvents 1.0 binary content mode.

**Spec source:** `docs/superpowers/specs/2026-04-17-cloudevents-envelope-design.md`.

**Branch name (suggested):** `feature/cloudevents-envelope`.

---

## Preparation

- [ ] **Step P.1: Create feature branch and worktree**

```bash
cd /home/coder/project
git checkout main
git pull
git checkout -b feature/cloudevents-envelope
```

- [ ] **Step P.2: Verify baseline green**

```bash
pnpm install --frozen-lockfile
pnpm -r run build
pnpm -r run test
```

Expected: all packages build and test-green before starting.

---

## Task 1: `@rntme/event-store` — new envelope type and column map

**Files:**
- Modify: `packages/event-store/src/types/envelope.ts`
- Modify: `packages/event-store/src/types/append.ts`
- Modify: `packages/event-store/src/store/schema.ts`
- Modify: `packages/event-store/src/store/row-mapper.ts`
- Modify: `packages/event-store/src/store/sqlite.ts`
- Modify: `packages/event-store/src/store/interface.ts`
- Modify: `packages/event-store/src/index.ts`
- Test: `packages/event-store/test/unit/sqlite-event-store.test.ts` (likely exists; update field names)

- [ ] **Step 1.1: Rewrite `types/envelope.ts` to CE camelCase shape**

```ts
// packages/event-store/src/types/envelope.ts
import type { ActorRef } from './actor.js';

/**
 * CloudEvents 1.0 envelope (spec 2026-04-17-cloudevents-envelope-design §3.1).
 * In-memory shape is camelCase; wire form (Kafka binary content mode) is
 * lowercase `ce_*`; conversion is via `toCloudEventWire` / `fromCloudEventWire`.
 */
export type EventEnvelope<TPayload = unknown> = Readonly<{
  // Standard CloudEvents attributes
  id: string;
  source: string;                          // `rntme://${serviceName}/${rntAggregateType}`
  eventType: string;                       // short local name (e.g. "IssueCreated")
  type: string;                            // `${serviceName}.${rntAggregateType}.${eventType}`
  time: string;                            // RFC3339
  subject: string;                         // `${rntAggregateType}-${rntAggregateId}` (== stream)
  dataContentType: 'application/json';
  dataSchema: string;                      // `rntme://schemas/${serviceName}/${eventType}.v${rntSchemaVersion}.json`
  data: TPayload;

  // rntme extensions
  correlationId: string;
  causationId: string | null;
  commandId: string | null;
  rntAggregateType: string;
  rntAggregateId: string;
  rntVersion: number;
  rntSchemaVersion: number;
  rntActorKind: ActorRef['kind'] | null;
  rntActorId: string | null;
  traceparent: string | null;
}>;
```

- [ ] **Step 1.2: Update `types/append.ts` to match**

```ts
// packages/event-store/src/types/append.ts
import type { ActorRef } from './actor.js';

export type AppendEventInput = Readonly<{
  id: string;
  eventType: string;
  rntAggregateType: string;
  rntAggregateId: string;
  time: string;
  actor: ActorRef | null;
  data: unknown;
  rntSchemaVersion: number;
  correlationId: string;
  causationId: string | null;
  commandId: string | null;
  traceparent: string | null;
}>;

export type AppendRequest = Readonly<{
  subject: string;
  expectedVersion?: number;
  events: readonly AppendEventInput[];
}>;

export type AppendedEvent = Readonly<{
  id: string;
  version: number;
  rowId: number;
}>;

export type AppendResult = Readonly<{
  subject: string;
  lastVersion: number;
  appendedEvents: readonly AppendedEvent[];
}>;
```

- [ ] **Step 1.3: Rewrite `store/schema.ts` DDL**

```ts
// packages/event-store/src/store/schema.ts
import type { Database as BetterSqliteDatabase } from 'better-sqlite3';

const DDL = `
CREATE TABLE IF NOT EXISTS event_log (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  subject         TEXT    NOT NULL,
  aggregate_type  TEXT    NOT NULL,
  aggregate_id    TEXT    NOT NULL,
  version         INTEGER NOT NULL,
  event_type      TEXT    NOT NULL,
  event_id        TEXT    NOT NULL UNIQUE,
  actor_kind      TEXT,
  actor_id        TEXT,
  occurred_at     TEXT    NOT NULL,
  payload_json    TEXT    NOT NULL,
  schema_version  INTEGER NOT NULL DEFAULT 1,
  correlation_id  TEXT    NOT NULL,
  causation_id    TEXT,
  command_id      TEXT,
  traceparent     TEXT,
  UNIQUE (subject, version)
);

CREATE INDEX IF NOT EXISTS idx_event_log_subject      ON event_log(subject, version);
CREATE INDEX IF NOT EXISTS idx_event_log_undelivered  ON event_log(id);
CREATE INDEX IF NOT EXISTS idx_event_log_correlation  ON event_log(correlation_id);
CREATE INDEX IF NOT EXISTS idx_event_log_causation    ON event_log(causation_id);
CREATE INDEX IF NOT EXISTS idx_event_log_command      ON event_log(command_id);

CREATE TABLE IF NOT EXISTS publish_cursor (
  relay_id        TEXT PRIMARY KEY,
  last_event_id   INTEGER NOT NULL,
  updated_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS delivery_tracking (
  event_id          TEXT PRIMARY KEY,
  first_attempt_at  TEXT NOT NULL,
  last_attempt_at   TEXT NOT NULL,
  attempt_count     INTEGER NOT NULL,
  last_error        TEXT,
  delivered_at      TEXT,
  dlq_at            TEXT
);
`;

export function applyEventStoreSchema(db: BetterSqliteDatabase): void {
  db.exec(DDL);
}

export function assertSchemaD9Compatible(db: BetterSqliteDatabase): void {
  const cols = db.prepare("PRAGMA table_info(event_log)").all() as { name: string }[];
  const names = new Set(cols.map((c) => c.name));
  const required = ['subject', 'correlation_id', 'causation_id', 'command_id', 'traceparent'];
  const missing = required.filter((n) => !names.has(n));
  if (missing.length > 0 && cols.length > 0) {
    throw new Error(
      `EVENT_STORE_SCHEMA_INCOMPATIBLE: event_log missing columns [${missing.join(', ')}]. ` +
      `This build is post-D9; drop the sqlite file and re-run with a fresh database.`,
    );
  }
}
```

- [ ] **Step 1.4: Rewrite `store/row-mapper.ts`**

```ts
// packages/event-store/src/store/row-mapper.ts
import type { EventEnvelope } from '../types/envelope.js';
import type { ActorRef } from '../types/actor.js';

export type EventLogRow = Readonly<{
  id: number;
  subject: string;
  aggregate_type: string;
  aggregate_id: string;
  version: number;
  event_type: string;
  event_id: string;
  actor_kind: string | null;
  actor_id: string | null;
  occurred_at: string;
  payload_json: string;
  schema_version: number;
  correlation_id: string;
  causation_id: string | null;
  command_id: string | null;
  traceparent: string | null;
}>;

export function rowToEnvelope(row: EventLogRow, serviceName: string): EventEnvelope {
  const source = `rntme://${serviceName}/${row.aggregate_type}`;
  const type = `${serviceName}.${row.aggregate_type}.${row.event_type}`;
  const dataSchema = `rntme://schemas/${serviceName}/${row.event_type}.v${row.schema_version}.json`;
  const actorKind = toActorKind(row.actor_kind);
  return {
    id: row.event_id,
    source,
    eventType: row.event_type,
    type,
    time: row.occurred_at,
    subject: row.subject,
    dataContentType: 'application/json',
    dataSchema,
    data: JSON.parse(row.payload_json) as unknown,
    correlationId: row.correlation_id,
    causationId: row.causation_id,
    commandId: row.command_id,
    rntAggregateType: row.aggregate_type,
    rntAggregateId: row.aggregate_id,
    rntVersion: row.version,
    rntSchemaVersion: row.schema_version,
    rntActorKind: actorKind,
    rntActorId: actorKind === null ? null : row.actor_id,
    traceparent: row.traceparent,
  };
}

function toActorKind(kind: string | null): ActorRef['kind'] | null {
  if (kind === 'user' || kind === 'system' || kind === 'service') return kind;
  return null;
}
```

- [ ] **Step 1.5: Update `store/sqlite.ts` — new ctor param + column list**

Rewrite the file's key sections:

```ts
// packages/event-store/src/store/sqlite.ts  (relevant changes)
export type SqliteEventStoreOptions = Readonly<{
  filename: string;
  serviceName: string;          // NEW required
  applySchema?: boolean;
  busyTimeoutMs?: number;
}>;

export class SqliteEventStore implements EventStore {
  private readonly db: BetterSqliteDatabase;
  private readonly serviceName: string;

  constructor(options: SqliteEventStoreOptions) {
    if (!options.serviceName) {
      throw new Error('SqliteEventStore: serviceName is required');
    }
    this.db = new Database(options.filename);
    this.serviceName = options.serviceName;
    this.db.pragma('journal_mode = WAL');
    this.db.pragma(`busy_timeout = ${options.busyTimeoutMs ?? 5000}`);
    this.db.pragma('foreign_keys = ON');
    if (options.applySchema !== false) {
      applyEventStoreSchema(this.db);
    }
    assertSchemaD9Compatible(this.db);
  }
  // ...
}
```

In `appendEvents` and `appendRaw`, update the INSERT statement to include the 4 new columns and the renamed `subject`:

```ts
const insert = this.db.prepare(`
  INSERT INTO event_log
    (subject, aggregate_type, aggregate_id, version, event_type, event_id,
     actor_kind, actor_id, occurred_at, payload_json, schema_version,
     correlation_id, causation_id, command_id, traceparent)
  VALUES
    (@subject, @aggregate_type, @aggregate_id, @version, @event_type, @event_id,
     @actor_kind, @actor_id, @occurred_at, @payload_json, @schema_version,
     @correlation_id, @causation_id, @command_id, @traceparent)
`);
```

In `appendEvents`, the per-event parameter mapping:

```ts
info = insert.run({
  subject: req.subject,
  aggregate_type: e.rntAggregateType,
  aggregate_id: e.rntAggregateId,
  version,
  event_type: e.eventType,
  event_id: e.id,
  actor_kind: e.actor?.kind ?? null,
  actor_id: e.actor?.id ?? null,
  occurred_at: e.time,
  payload_json: JSON.stringify(e.data),
  schema_version: e.rntSchemaVersion,
  correlation_id: e.correlationId,
  causation_id: e.causationId,
  command_id: e.commandId,
  traceparent: e.traceparent,
});
appended.push({ id: e.id, version, rowId: Number(info.lastInsertRowid) });
```

The `appendRaw` method takes full envelopes, so:

```ts
appendRaw(envelopes: readonly EventEnvelope[], opts?: AppendRawOptions): void {
  const insert = this.db.prepare(/* same SQL as above */);
  const run = this.db.transaction((items: readonly EventEnvelope[]): void => {
    for (const e of items) {
      try {
        insert.run({
          subject: e.subject,
          aggregate_type: e.rntAggregateType,
          aggregate_id: e.rntAggregateId,
          version: e.rntVersion,
          event_type: e.eventType,
          event_id: e.id,
          actor_kind: e.rntActorKind,
          actor_id: e.rntActorId,
          occurred_at: e.time,
          payload_json: JSON.stringify(e.data),
          schema_version: e.rntSchemaVersion,
          correlation_id: e.correlationId,
          causation_id: e.causationId,
          command_id: e.commandId,
          traceparent: e.traceparent,
        });
      } catch (err) {
        // existing duplicate-ignore logic preserved; update field references:
        const code = (err as Error & { code?: string }).code ?? '';
        const msg = err instanceof Error ? err.message : String(err);
        if (opts?.ignoreDuplicates &&
            (code === 'SQLITE_CONSTRAINT_UNIQUE' || code === 'SQLITE_CONSTRAINT') &&
            /event_id/.test(msg)) {
          continue;
        }
        throw mapSqliteError(err, e.subject, undefined, e.rntVersion, e.id);
      }
    }
  });
  run.immediate(envelopes);
}
```

Read methods thread `serviceName` through to `rowToEnvelope`:

```ts
readStream(subject: string): EventEnvelope[] {
  const rows = this.db
    .prepare('SELECT * FROM event_log WHERE subject = ? ORDER BY version ASC')
    .all(subject) as EventLogRow[];
  return rows.map((r) => rowToEnvelope(r, this.serviceName));
}
readFrom(opts: ReadFromOptions): EventEnvelope[] {
  const rows = this.db
    .prepare('SELECT * FROM event_log WHERE id > ? ORDER BY id ASC LIMIT ?')
    .all(opts.afterId, opts.limit) as EventLogRow[];
  return rows.map((r) => rowToEnvelope(r, this.serviceName));
}
readRecordsFrom(opts: ReadFromOptions): EventRecord[] {
  const rows = this.db
    .prepare('SELECT * FROM event_log WHERE id > ? ORDER BY id ASC LIMIT ?')
    .all(opts.afterId, opts.limit) as EventLogRow[];
  return rows.map((row) => ({ id: row.id, envelope: rowToEnvelope(row, this.serviceName) }));
}
```

`mapSqliteError` signature — rename `stream` → `subject`:

```ts
export function mapSqliteError(
  err: unknown,
  subject: string,
  expectedVersion: number | undefined,
  attemptedVersion: number,
  eventId?: string,
): Error { /* body unchanged except uses `subject` where `stream` was used */ }
```

The `ConcurrencyConflict` class probably stores `.stream`; update its field name. Check `packages/event-store/src/types/errors.ts`:

```ts
// packages/event-store/src/types/errors.ts (expected shape; update field name)
export class ConcurrencyConflict extends Error {
  constructor(
    public readonly subject: string,            // was `stream`
    public readonly expectedVersion: number | undefined,
    public readonly actualVersion: number,
  ) {
    super(`Concurrency conflict on subject="${subject}": expected ${expectedVersion}, actual ${actualVersion}`);
  }
}
```

Consumers of `.stream` on this error (in `graph-ir-compiler` / `seed`) will be updated in their own tasks.

- [ ] **Step 1.6: Update `store/interface.ts` method names to match**

```ts
// packages/event-store/src/store/interface.ts
export interface EventStore {
  appendEvents(requests: readonly AppendRequest[]): AppendResult[];
  readStream(subject: string): EventEnvelope[];           // param renamed
  readFrom(opts: ReadFromOptions): EventEnvelope[];
  readRecordsFrom(opts: ReadFromOptions): EventRecord[];
  readCursor(relayId: string): number;
  writeCursor(relayId: string, lastEventId: number): void;
  readDeliveryAttempt(eventId: string): DeliveryAttemptRow | null;
  recordDeliveryAttempt(eventId: string, nowIso: string): void;
  updateLastError(eventId: string, message: string | null): void;
  markDelivered(eventId: string, nowIso: string): void;
  markDlq(eventId: string, nowIso: string): void;
  appendRaw(envelopes: readonly EventEnvelope[], opts?: AppendRawOptions): void;
}
```

- [ ] **Step 1.7: Re-export new types from `src/index.ts`**

Ensure the package exports include: `EventEnvelope`, `AppendEventInput`, `AppendRequest`, `AppendResult`, `AppendedEvent`, `assertSchemaD9Compatible` and the existing `SqliteEventStore`, `ConcurrencyConflict`, etc.

- [ ] **Step 1.8: Update existing `packages/event-store/test/unit/sqlite-event-store.test.ts` to new field names**

Every test that builds an `AppendEventInput` or `EventEnvelope` needs the new names (`id` not `eventId`, `data` not `payload`, `rntVersion` not `version` at the appender — note: `AppendEventInput` no longer has `version`; stream's version is computed). Every assertion that reads envelope fields must use the new names.

Common renames to apply across the file:
- `eventId` → `id`
- `aggregateType` → `rntAggregateType`
- `aggregateId` → `rntAggregateId`
- `stream` → `subject`
- `version` (on envelope) → `rntVersion`
- `schemaVersion` → `rntSchemaVersion`
- `occurredAt` → `time`
- `payload` → `data`
- `actor: { kind, id }` on the envelope → two fields `rntActorKind`, `rntActorId`; on `AppendEventInput` remains `actor: ActorRef | null`.

Ensure `SqliteEventStore` is constructed with `serviceName: 'test-service'` in every test.

New assertions: after `appendEvents`, read the envelope back — it should include `source`, `type`, `dataSchema`, `correlationId`, `causationId`, `commandId`, `traceparent`. Add dedicated tests for these derivable fields.

Add a test for ctor rejecting missing serviceName:

```ts
it('rejects missing serviceName', () => {
  expect(() => new SqliteEventStore({ filename: ':memory:', serviceName: '' }))
    .toThrow(/serviceName is required/);
});
```

Add a test for schema incompatibility guard:

```ts
it('rejects pre-D9 event_log schema', () => {
  const db = new Database(':memory:');
  db.exec(`CREATE TABLE event_log (id INTEGER PRIMARY KEY, stream TEXT, version INTEGER, event_type TEXT, event_id TEXT UNIQUE);`);
  db.prepare(`INSERT INTO event_log (stream, version, event_type, event_id) VALUES ('s', 1, 't', 'e')`).run();
  expect(() => assertSchemaD9Compatible(db)).toThrow(/EVENT_STORE_SCHEMA_INCOMPATIBLE/);
});
```

- [ ] **Step 1.9: Run package tests and fix until green**

```bash
pnpm -F @rntme/event-store test
```

Expected: all tests in event-store pass. Iterate until green.

- [ ] **Step 1.10: Commit**

```bash
git add packages/event-store/src/types/envelope.ts \
        packages/event-store/src/types/append.ts \
        packages/event-store/src/types/errors.ts \
        packages/event-store/src/store/schema.ts \
        packages/event-store/src/store/row-mapper.ts \
        packages/event-store/src/store/sqlite.ts \
        packages/event-store/src/store/interface.ts \
        packages/event-store/src/index.ts \
        packages/event-store/test/unit/sqlite-event-store.test.ts
git commit -m "feat(event-store): CE envelope shape + new event_log columns"
```

---

## Task 2: `@rntme/event-store` — Kafka wire codec (CE binary content mode)

**Files:**
- Modify: `packages/event-store/src/kafka/producer.ts` (no change expected, but verify)
- Create: `packages/event-store/src/kafka/wire-codec.ts`
- Create: `packages/event-store/src/kafka/wire-errors.ts`
- Create: `packages/event-store/test/unit/wire-codec.test.ts`
- Modify: `packages/event-store/src/index.ts` (export wire codec)

- [ ] **Step 2.1: Define wire error classes**

```ts
// packages/event-store/src/kafka/wire-errors.ts
export class CloudEventDecodeError extends Error {
  constructor(
    public readonly code:
      | 'EVENT_STORE_WIRE_DECODE_MISSING_ATTR'
      | 'EVENT_STORE_WIRE_DECODE_UNKNOWN_SPEC'
      | 'EVENT_STORE_WIRE_DECODE_INVALID_INT',
    message: string,
  ) {
    super(message);
    this.name = 'CloudEventDecodeError';
  }
}
```

- [ ] **Step 2.2: Write failing roundtrip test**

```ts
// packages/event-store/test/unit/wire-codec.test.ts
import { describe, it, expect } from 'vitest';
import { toCloudEventWire, fromCloudEventWire } from '../../src/kafka/wire-codec.js';
import { CloudEventDecodeError } from '../../src/kafka/wire-errors.js';
import type { EventEnvelope } from '../../src/types/envelope.js';

function sampleEnvelope(overrides: Partial<EventEnvelope> = {}): EventEnvelope {
  return {
    id: 'ev-1',
    source: 'rntme://svc/Issue',
    eventType: 'IssueCreated',
    type: 'svc.Issue.IssueCreated',
    time: '2026-04-17T10:00:00.000Z',
    subject: 'Issue-abc',
    dataContentType: 'application/json',
    dataSchema: 'rntme://schemas/svc/IssueCreated.v1.json',
    data: { title: 'hello' },
    correlationId: 'corr-1',
    causationId: 'cmd-1',
    commandId: 'cmd-1',
    rntAggregateType: 'Issue',
    rntAggregateId: 'abc',
    rntVersion: 1,
    rntSchemaVersion: 1,
    rntActorKind: 'user',
    rntActorId: 'u1',
    traceparent: null,
    ...overrides,
  };
}

describe('wire-codec roundtrip', () => {
  it('roundtrips a fully populated envelope', () => {
    const env = sampleEnvelope();
    const msg = toCloudEventWire(env, 'rntme.svc.issue');
    const back = fromCloudEventWire(msg);
    expect(back).toEqual(env);
  });

  it('roundtrips with nullables absent', () => {
    const env = sampleEnvelope({
      causationId: null, commandId: null, traceparent: null,
      rntActorKind: null, rntActorId: null,
    });
    const msg = toCloudEventWire(env, 't');
    expect(msg.headers).not.toHaveProperty('ce_causationid');
    expect(msg.headers).not.toHaveProperty('ce_commandid');
    expect(msg.headers).not.toHaveProperty('ce_traceparent');
    expect(msg.headers).not.toHaveProperty('ce_rntactorkind');
    expect(msg.headers).not.toHaveProperty('ce_rntactorid');
    const back = fromCloudEventWire(msg);
    expect(back).toEqual(env);
  });

  it('serializes `data` as JSON in value (bit-exact)', () => {
    const env = sampleEnvelope({ data: { k: 'v', n: 42 } });
    const msg = toCloudEventWire(env, 't');
    expect(msg.value).toBe(JSON.stringify(env.data));
  });
});

describe('wire-codec decode errors', () => {
  const required = [
    'ce_id', 'ce_source', 'ce_type', 'ce_time', 'ce_subject',
    'ce_datacontenttype', 'ce_dataschema', 'ce_correlationid',
    'ce_rntaggregatetype', 'ce_rntaggregateid', 'ce_rntversion',
    'ce_rntschemaversion', 'ce_specversion',
  ];
  for (const h of required) {
    it(`throws MISSING_ATTR when ${h} absent`, () => {
      const msg = toCloudEventWire(sampleEnvelope(), 't');
      const { [h]: _, ...rest } = msg.headers;
      const broken = { ...msg, headers: rest };
      expect(() => fromCloudEventWire(broken)).toThrow(CloudEventDecodeError);
      expect(() => fromCloudEventWire(broken)).toThrow(/MISSING_ATTR/);
    });
  }

  it('throws UNKNOWN_SPEC for non-1.0 specversion', () => {
    const msg = toCloudEventWire(sampleEnvelope(), 't');
    const broken = { ...msg, headers: { ...msg.headers, ce_specversion: '0.3' } };
    expect(() => fromCloudEventWire(broken)).toThrow(/UNKNOWN_SPEC/);
  });

  it('throws INVALID_INT for non-integer ce_rntversion', () => {
    const msg = toCloudEventWire(sampleEnvelope(), 't');
    const broken = { ...msg, headers: { ...msg.headers, ce_rntversion: 'xx' } };
    expect(() => fromCloudEventWire(broken)).toThrow(/INVALID_INT/);
  });
});
```

- [ ] **Step 2.3: Run the test, confirm it fails**

```bash
pnpm -F @rntme/event-store vitest run test/unit/wire-codec.test.ts
```

Expected: all fail (module `wire-codec` not found).

- [ ] **Step 2.4: Implement `wire-codec.ts`**

```ts
// packages/event-store/src/kafka/wire-codec.ts
import type { EventEnvelope } from '../types/envelope.js';
import type { KafkaMessage } from './producer.js';
import { CloudEventDecodeError } from './wire-errors.js';

const REQUIRED_HEADERS = [
  'ce_id', 'ce_source', 'ce_type', 'ce_time', 'ce_subject',
  'ce_datacontenttype', 'ce_dataschema', 'ce_correlationid',
  'ce_rntaggregatetype', 'ce_rntaggregateid', 'ce_rntversion',
  'ce_rntschemaversion', 'ce_specversion',
] as const;

export function toCloudEventWire(env: EventEnvelope, topic: string): KafkaMessage {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    ce_specversion: '1.0',
    ce_id: env.id,
    ce_source: env.source,
    ce_type: env.type,
    ce_time: env.time,
    ce_subject: env.subject,
    ce_datacontenttype: env.dataContentType,
    ce_dataschema: env.dataSchema,
    ce_correlationid: env.correlationId,
    ce_rntaggregatetype: env.rntAggregateType,
    ce_rntaggregateid: env.rntAggregateId,
    ce_rntversion: String(env.rntVersion),
    ce_rntschemaversion: String(env.rntSchemaVersion),
  };
  if (env.causationId !== null) headers.ce_causationid = env.causationId;
  if (env.commandId !== null) headers.ce_commandid = env.commandId;
  if (env.rntActorKind !== null) headers.ce_rntactorkind = env.rntActorKind;
  if (env.rntActorId !== null) headers.ce_rntactorid = env.rntActorId;
  if (env.traceparent !== null) headers.ce_traceparent = env.traceparent;
  return {
    topic,
    key: env.subject,
    headers,
    value: JSON.stringify(env.data),
  };
}

export function fromCloudEventWire(msg: KafkaMessage): EventEnvelope {
  const h = msg.headers;
  for (const name of REQUIRED_HEADERS) {
    if (!(name in h)) {
      throw new CloudEventDecodeError(
        'EVENT_STORE_WIRE_DECODE_MISSING_ATTR',
        `Missing required CloudEvents header "${name}"`,
      );
    }
  }
  if (h.ce_specversion !== '1.0') {
    throw new CloudEventDecodeError(
      'EVENT_STORE_WIRE_DECODE_UNKNOWN_SPEC',
      `Unsupported ce_specversion "${h.ce_specversion}"`,
    );
  }
  const version = parseIntStrict(h.ce_rntversion!, 'ce_rntversion');
  const schemaVersion = parseIntStrict(h.ce_rntschemaversion!, 'ce_rntschemaversion');
  const data: unknown = JSON.parse(msg.value);
  const actorKind = h.ce_rntactorkind === undefined ? null : toActorKind(h.ce_rntactorkind);
  return {
    id: h.ce_id!,
    source: h.ce_source!,
    eventType: deriveEventType(h.ce_type!),
    type: h.ce_type!,
    time: h.ce_time!,
    subject: h.ce_subject!,
    dataContentType: 'application/json',
    dataSchema: h.ce_dataschema!,
    data,
    correlationId: h.ce_correlationid!,
    causationId: h.ce_causationid ?? null,
    commandId: h.ce_commandid ?? null,
    rntAggregateType: h.ce_rntaggregatetype!,
    rntAggregateId: h.ce_rntaggregateid!,
    rntVersion: version,
    rntSchemaVersion: schemaVersion,
    rntActorKind: actorKind,
    rntActorId: h.ce_rntactorid ?? null,
    traceparent: h.ce_traceparent ?? null,
  };
}

function parseIntStrict(s: string, attr: string): number {
  if (!/^-?\d+$/.test(s)) {
    throw new CloudEventDecodeError(
      'EVENT_STORE_WIRE_DECODE_INVALID_INT',
      `Header "${attr}" is not a valid integer: "${s}"`,
    );
  }
  return Number(s);
}

function toActorKind(s: string): 'user' | 'system' | 'service' | null {
  if (s === 'user' || s === 'system' || s === 'service') return s;
  return null;
}

function deriveEventType(type: string): string {
  const lastDot = type.lastIndexOf('.');
  return lastDot === -1 ? type : type.slice(lastDot + 1);
}
```

- [ ] **Step 2.5: Re-run tests — verify pass**

```bash
pnpm -F @rntme/event-store vitest run test/unit/wire-codec.test.ts
```

Expected: all green.

- [ ] **Step 2.6: Export wire codec from `src/index.ts`**

Add: `export { toCloudEventWire, fromCloudEventWire } from './kafka/wire-codec.js';`
Add: `export { CloudEventDecodeError } from './kafka/wire-errors.js';`

- [ ] **Step 2.7: Full event-store package test + commit**

```bash
pnpm -F @rntme/event-store test
git add packages/event-store/src/kafka/wire-codec.ts \
        packages/event-store/src/kafka/wire-errors.ts \
        packages/event-store/test/unit/wire-codec.test.ts \
        packages/event-store/src/index.ts
git commit -m "feat(event-store): CloudEvents binary-mode wire codec"
```

---

## Task 3: `@rntme/event-store` — relay binary emission + DLQ wrapper + D6 topic name

**Files:**
- Modify: `packages/event-store/src/relay/topic.ts`
- Create: `packages/event-store/src/relay/dlq-envelope.ts`
- Modify: `packages/event-store/src/relay/loop.ts`
- Modify: `packages/event-store/test/unit/relay-loop.test.ts` (likely exists)

- [ ] **Step 3.1: Update `relay/topic.ts` with D6 service segment**

```ts
// packages/event-store/src/relay/topic.ts
export function defaultTopicOf(serviceName: string, aggregateType: string): string {
  return `rntme.${serviceName.toLowerCase()}.${aggregateType.toLowerCase()}`;
}
```

No version suffix on topic — versioning lives on the event (`rntSchemaVersion` for additive evolution; new `eventType` for breaking). See spec §5.4.

- [ ] **Step 3.2: Create `relay/dlq-envelope.ts`**

```ts
// packages/event-store/src/relay/dlq-envelope.ts
import type { EventEnvelope } from '../types/envelope.js';

export type DlqPayload = Readonly<{
  failedEvent: EventEnvelope;
  reason: 'max-attempts-exceeded';
  attempts: number;
  firstAttemptAt: string;
  lastError: string;
}>;

export function buildDlqEnvelope(opts: {
  serviceName: string;
  original: EventEnvelope;
  attempts: number;
  firstAttemptAt: string;
  lastError: string;
  now: () => string;
  nextId: () => string;
}): EventEnvelope<DlqPayload> {
  const { serviceName, original } = opts;
  return {
    id: opts.nextId(),
    source: `rntme://${serviceName}/Relay`,
    eventType: 'EventDeliveryFailed',
    type: `${serviceName}.Relay.EventDeliveryFailed`,
    time: opts.now(),
    subject: original.subject,
    dataContentType: 'application/json',
    dataSchema: `rntme://schemas/${serviceName}/EventDeliveryFailed.v1.json`,
    data: {
      failedEvent: original,
      reason: 'max-attempts-exceeded',
      attempts: opts.attempts,
      firstAttemptAt: opts.firstAttemptAt,
      lastError: opts.lastError,
    },
    correlationId: original.correlationId,
    causationId: original.id,
    commandId: null,
    rntAggregateType: 'Relay',
    rntAggregateId: serviceName,
    rntVersion: 0,
    rntSchemaVersion: 1,
    rntActorKind: 'system',
    rntActorId: 'relay',
    traceparent: original.traceparent,
  };
}
```

- [ ] **Step 3.3: Update `relay/loop.ts` — new opts + wire codec + DLQ wrapper**

Add to `RelayOptions`:

```ts
serviceName: string;
now: () => string;
nextId: () => string;
```

Change `topicOf?: (aggregateType: string) => string;` signature to `topicOf?: (serviceName: string, aggregateType: string) => string;` (or drop the override and hard-code `defaultTopicOf(opts.serviceName, rec.envelope.rntAggregateType)`; keeping the override hook is fine, just update its signature).

Replace the `kafka.send` call in the primary-topic branch:

```ts
// was: { topic, key: rec.envelope.stream, headers: {...manual...}, value: JSON.stringify(rec.envelope) }
const primaryMsg = toCloudEventWire(rec.envelope, primaryTopic);
try {
  await opts.kafka.send(primaryMsg);
  opts.store.markDelivered(eventId, new Date().toISOString());
  break;
}
```

Replace the DLQ emission (previously built the `x-dlq-*` headers inline): call `emitDlq` with the new wrapper. Update `emitDlq` to build the wrapper envelope and send via `toCloudEventWire`:

```ts
async function emitDlq(o: EmitDlqOpts): Promise<boolean> {
  let backoff = 10;
  let dlqAttempt = 0;
  const dlqEnvelope = buildDlqEnvelope({
    serviceName: o.serviceName,
    original: o.rec.envelope,
    attempts: o.attempts,
    firstAttemptAt: o.firstAttemptAt,
    lastError: o.lastError,
    now: o.now,
    nextId: o.nextId,
  });
  const dlqMsg = toCloudEventWire(dlqEnvelope, `${o.primaryTopic}.dlq`);
  while (o.isRunning()) {
    dlqAttempt += 1;
    try {
      await o.kafka.send(dlqMsg);
      return true;
    } catch (dlqErr) {
      o.onDlqError(dlqErr, o.rec.envelope, dlqAttempt);
      await sleep(backoff);
      backoff = Math.min(backoff * 2, o.maxBackoff);
    }
  }
  return false;
}

type EmitDlqOpts = Readonly<{
  kafka: KafkaProducer;
  rec: EventRecord;
  primaryTopic: string;
  attempts: number;
  firstAttemptAt: string;
  lastError: string;
  maxBackoff: number;
  isRunning: () => boolean;
  onDlqError: (err: unknown, envelope: EventEnvelope, attempt: number) => void;
  serviceName: string;
  now: () => string;
  nextId: () => string;
}>;
```

Threading `serviceName`, `now`, `nextId` into `emitDlq` call sites in `loop.ts`: the outer loop reads them from `opts`. Replace the existing `topicOf` call:

```ts
const primaryTopic = topicOf(opts.serviceName, rec.envelope.rntAggregateType);
```

Replace references to `rec.envelope.stream` with `rec.envelope.subject`; `rec.envelope.eventId` with `rec.envelope.id`; `rec.envelope.schemaVersion` with `rec.envelope.rntSchemaVersion`.

- [ ] **Step 3.4: Update existing relay-loop tests**

Field renames applied throughout. Fake `KafkaProducer` now asserts that `send` is called with `ce_*` headers and `data`-only value. A representative updated test:

```ts
import { toCloudEventWire, fromCloudEventWire } from '../../src/index.js';

it('emits CE binary-mode message on successful send', async () => {
  const sent: KafkaMessage[] = [];
  const kafka: KafkaProducer = { send: async (m) => { sent.push(m); } };
  // ... build a store with one event (use new field names everywhere) ...
  const relay = createRelay({
    store, kafka, cursorId: 't',
    serviceName: 'svc', now: () => 't0', nextId: () => 'nid',
  });
  relay.start();
  await waitForCondition(() => sent.length === 1);
  await relay.stop();
  expect(sent[0].headers.ce_specversion).toBe('1.0');
  expect(sent[0].headers.ce_id).toBe(originalEnv.id);
  expect(JSON.parse(sent[0].value)).toEqual(originalEnv.data);
});
```

Add a new dedicated DLQ-wrapper test:

```ts
// packages/event-store/test/unit/dlq-wrapper.test.ts  (new file)
it('wraps original event in EventDeliveryFailed on DLQ emit', async () => {
  const sent: KafkaMessage[] = [];
  let nthCall = 0;
  const kafka: KafkaProducer = {
    send: async (m) => {
      if (!m.topic.endsWith('.dlq')) {
        nthCall += 1;
        if (nthCall <= 3) throw new Error('broker down');  // fail 3 times
      }
      sent.push(m);
    },
  };
  const store = makeStoreWithOneEvent();            // helper, builds envelope with new shape
  const relay = createRelay({
    store, kafka, cursorId: 't', maxAttempts: 3,
    serviceName: 'svc', now: () => '2026-04-17T00:00:00.000Z', nextId: () => 'dlq-id-1',
  });
  relay.start();
  await waitForCondition(() => sent.some((m) => m.topic.endsWith('.dlq')));
  await relay.stop();

  const dlqMsg = sent.find((m) => m.topic.endsWith('.dlq'))!;
  const decoded = fromCloudEventWire(dlqMsg);
  expect(decoded.type).toBe('svc.Relay.EventDeliveryFailed');
  expect(decoded.source).toBe('rntme://svc/Relay');
  expect(decoded.correlationId).toBe(originalEnv.correlationId);
  expect(decoded.causationId).toBe(originalEnv.id);
  expect(decoded.commandId).toBeNull();
  expect((decoded.data as DlqPayload).failedEvent).toEqual(originalEnv);
  expect((decoded.data as DlqPayload).reason).toBe('max-attempts-exceeded');
  expect((decoded.data as DlqPayload).attempts).toBe(3);
});
```

- [ ] **Step 3.5: Run full event-store tests, iterate until green**

```bash
pnpm -F @rntme/event-store test
```

- [ ] **Step 3.6: Commit**

```bash
git add packages/event-store/src/relay/topic.ts \
        packages/event-store/src/relay/dlq-envelope.ts \
        packages/event-store/src/relay/loop.ts \
        packages/event-store/test/unit/relay-loop.test.ts \
        packages/event-store/test/unit/dlq-wrapper.test.ts
git commit -m "feat(event-store): relay emits CE binary mode; DLQ is wrapper event"
```

---

## Task 4: `@rntme/graph-ir-compiler` — `ExecuteCommandContext.correlation` + rename internals

**Files:**
- Modify: `packages/graph-ir-compiler/src/command-runtime/execute.ts`
- Modify: `packages/graph-ir-compiler/src/command-runtime/replay.ts`
- Modify: `packages/graph-ir-compiler/src/command-runtime/transition.ts`
- Modify: `packages/graph-ir-compiler/src/emit/payload.ts`
- Modify: `packages/graph-ir-compiler/src/types/command.ts`
- Modify: `packages/graph-ir-compiler/src/command-runtime/errors.ts` (check references to `ConcurrencyConflict.stream`)
- Modify existing tests under `packages/graph-ir-compiler/test/`

- [ ] **Step 4.1: Update `types/command.ts` — `CommandResult` fields**

```ts
// packages/graph-ir-compiler/src/types/command.ts  (relevant)
export type CommandResult = Readonly<{
  aggregateId: string;
  version: number;
  eventIds: readonly string[];
  commandId: string;
  correlationId: string;
}>;
```

- [ ] **Step 4.2: Update `command-runtime/execute.ts` — new context + per-event stamping**

`CorrelationCtx` is defined here and exported from `@rntme/graph-ir-compiler`; `@rntme/bindings-http` (Task 6) imports it from there so the HTTP middleware and the command executor share one type.

```ts
export type CorrelationCtx = Readonly<{
  commandId: string;
  correlationId: string;
  traceparent: string | null;
}>;

export type ExecuteCommandContext = {
  eventStore: EventStore;
  qsmDb: BetterSqlite3.Database | null;
  now: () => string;
  nextId: () => string;
  actor: ActorRef | null;
  correlation: CorrelationCtx;                  // NEW, required
};

export function executeCommand(
  compiled: CompiledCommand,
  paramValues: Record<string, unknown>,
  ctx: ExecuteCommandContext,
): CommandResult {
  // ...existing read-prelude + replay logic unchanged...
  const head = compiled.emits[0]!;
  const aggregateId = String(evalExprAtRuntime(head.aggregateIdExpr, paramValues) ?? '');
  const subject = `${head.aggregate}-${aggregateId}`;   // renamed `stream` → `subject`
  const history = ctx.eventStore.readStream(subject);
  const { state, version } = replayAggregateState(history);

  const events: AppendEventInput[] = [];
  let runningState = state;

  for (const plan of compiled.emits) {
    const stateField = stateFieldForPlan(plan);
    checkTransitionLegal(plan, runningState, stateField);
    const payload = derivePayload(plan, paramValues, runningState);
    events.push({
      id: ctx.nextId(),
      eventType: plan.eventType,
      rntAggregateType: plan.aggregate,
      rntAggregateId: aggregateId,
      time: ctx.now(),
      actor: ctx.actor,
      data: payload,
      rntSchemaVersion: 1,
      correlationId: ctx.correlation.correlationId,
      causationId: ctx.correlation.commandId,
      commandId: ctx.correlation.commandId,
      traceparent: ctx.correlation.traceparent,
    });
    runningState = { ...(runningState ?? {}), ...payload.after };
  }

  const req: AppendRequest = { subject, expectedVersion: version, events };
  let results;
  try {
    results = ctx.eventStore.appendEvents([req]);
  } catch (e) {
    if (e instanceof ConcurrencyConflict) {
      throw new CommandExecutionError(
        'COMMAND_CONCURRENCY_CONFLICT',
        `concurrent append conflict on subject ${subject}`,
      );
    }
    throw e;
  }
  const result = results[0]!;
  return {
    aggregateId,
    version: result.lastVersion,
    eventIds: result.appendedEvents.map((e) => e.id),
    commandId: ctx.correlation.commandId,
    correlationId: ctx.correlation.correlationId,
  };
}
```

- [ ] **Step 4.3: Update `replay.ts` and `transition.ts` — envelope field renames**

In `replayAggregateState(history: EventEnvelope[])`, accesses like `envelope.payload` become `envelope.data`; `envelope.version` → `envelope.rntVersion`. In `transition.ts` no envelope access expected, but double-check.

- [ ] **Step 4.4: Update emit/payload.ts if it reads envelope fields**

Grep for envelope-field usage inside `graph-ir-compiler/src/emit/`. Apply the standard rename set. No behavior changes otherwise.

- [ ] **Step 4.5: Update package tests**

All test files in `packages/graph-ir-compiler/test/`:
- construct `EventEnvelope` with new field names;
- build `ExecuteCommandContext` with `correlation: { commandId, correlationId, traceparent }`;
- assertions on `CommandResult` include new `commandId`, `correlationId`.

Test helper (add if not present):

```ts
export function testCorrelation(overrides: Partial<CorrelationContext> = {}): CorrelationContext {
  return {
    commandId: 'cmd-test',
    correlationId: 'corr-test',
    traceparent: null,
    ...overrides,
  };
}
```

And wherever tests built the old `ExecuteCommandContext`, thread through `correlation: testCorrelation()`.

- [ ] **Step 4.6: Re-export `CorrelationCtx` from the package index**

Open `packages/graph-ir-compiler/src/index.ts` and add:

```ts
export type { CorrelationCtx } from './command-runtime/execute.js';
```

- [ ] **Step 4.7: Run tests and commit**

```bash
pnpm -F @rntme/graph-ir-compiler test
git add packages/graph-ir-compiler
git commit -m "feat(graph-ir-compiler): ExecuteCommandContext.correlation; per-event stamping"
```

---

## Task 5: `@rntme/projection-consumer` — apply-event field renames

**Files:**
- Modify: `packages/projection-consumer/src/apply/apply-event.ts`
- Modify: `packages/projection-consumer/src/apply/bind.ts`
- Modify: `packages/projection-consumer/src/types/apply.ts` (if it references envelope fields)
- Modify: existing tests in `packages/projection-consumer/test/`

- [ ] **Step 5.1: Update `apply/apply-event.ts`**

```ts
export function applyEvent(
  db: BetterSqliteDatabase,
  plan: ApplyPlan,
  envelope: EventEnvelope,
): ApplyResult {
  const handler = plan.handlersByEventType.get(envelope.eventType);
  if (!handler) return 'skipped-no-mirror';
  if (handler.aggregateType !== envelope.rntAggregateType) return 'skipped-no-mirror';

  const currentVersion = selectCurrentVersion(db, handler, envelope.rntAggregateId);
  if (currentVersion !== null && currentVersion >= envelope.rntVersion) {
    return 'skipped-older-version';
  }

  const params = bindValues(handler, envelope);
  const info = db.prepare(handler.sql).run(...params);
  return info.changes > 0 ? 'applied' : 'skipped-older-version';
}
```

- [ ] **Step 5.2: Update `apply/bind.ts`**

```ts
export function bindValues(handler: CompiledHandler, envelope: EventEnvelope): unknown[] {
  const appliedAt = new Date().toISOString();
  const values: unknown[] = [];
  const after = getAfter(envelope);
  for (const b of handler.bindings) {
    values.push(resolveBinding(b, envelope, after, appliedAt));
  }
  return values;
}

function resolveBinding(
  b: ColumnBinding,
  envelope: EventEnvelope,
  after: Record<string, unknown>,
  appliedAt: string,
): unknown {
  switch (b.kind) {
    case 'aggregateId':
      return b.sqlType === 'INTEGER' ? Number(envelope.rntAggregateId) : envelope.rntAggregateId;
    case 'payloadField':
      return after[b.fieldName] ?? null;
    case 'generatedOccurred':
      return envelope.time;
    case 'generatedActor':
      return envelope.rntActorId;
    case 'nullable':
      return null;
    case 'literalString':
      return b.value;
    case 'eventId':
      return envelope.id;
    case 'eventVersion':
      return envelope.rntVersion;
    case 'appliedAt':
      return appliedAt;
  }
}

function getAfter(envelope: EventEnvelope): Record<string, unknown> {
  const p = envelope.data;
  if (p === null || typeof p !== 'object' || Array.isArray(p)) return {};
  const rec = p as Record<string, unknown>;
  const inner = rec.after;
  if (inner !== undefined && inner !== null && typeof inner === 'object' && !Array.isArray(inner)) {
    return inner as Record<string, unknown>;
  }
  const { before: _before, ...rest } = rec;
  return rest;
}
```

- [ ] **Step 5.3: Update tests**

Rename envelope field references in every test file under `packages/projection-consumer/test/`:
- `eventId` → `id`
- `aggregateType` → `rntAggregateType`
- `aggregateId` → `rntAggregateId`
- `version` → `rntVersion`
- `occurredAt` → `time`
- `payload` → `data`
- `actor: { kind: 'user', id: 'u' }` on the envelope → `rntActorKind: 'user'`, `rntActorId: 'u'`

Add `correlationId: 'c'`, `causationId: null`, `commandId: null`, `traceparent: null`, `source`, `type`, `subject`, `dataContentType: 'application/json'`, `dataSchema`, `rntSchemaVersion: 1` as required fields wherever an envelope is constructed.

Consider adding a local helper `sampleEnvelope(overrides)` in a test support file (`packages/projection-consumer/test/support/envelope.ts`) to reduce duplication across tests. This helper is test-only; keep its file path under `test/`.

- [ ] **Step 5.4: Run tests and commit**

```bash
pnpm -F @rntme/projection-consumer test
git add packages/projection-consumer
git commit -m "feat(projection-consumer): rename envelope fields to CE shape"
```

---

## Task 6: `@rntme/bindings-http` — correlation middleware + command handler

**Files:**
- Create: `packages/bindings-http/src/runtime/correlation-middleware.ts`
- Modify: `packages/bindings-http/src/runtime/command-handler.ts`
- Modify: `packages/bindings-http/src/index.ts` (export middleware)
- Create: `packages/bindings-http/test/unit/correlation-middleware.test.ts`

- [ ] **Step 6.1: Write failing test for correlation middleware**

```ts
// packages/bindings-http/test/unit/correlation-middleware.test.ts
import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { correlationMiddleware } from '../../src/runtime/correlation-middleware.js';

function buildApp() {
  const app = new Hono<{ Variables: { correlation: { commandId: string; correlationId: string; traceparent: string | null } } }>();
  app.use('*', correlationMiddleware());
  app.get('/ping', (c) => c.json(c.get('correlation')));
  return app;
}

describe('correlationMiddleware', () => {
  it('generates both ids when no headers present', async () => {
    const res = await buildApp().request('/ping');
    const body = await res.json();
    expect(body.commandId).toMatch(/^[0-9a-f-]{36}$/);
    expect(body.correlationId).toMatch(/^[0-9a-f-]{36}$/);
    expect(body.traceparent).toBeNull();
    expect(res.headers.get('Correlation-Id')).toBe(body.correlationId);
  });

  it('propagates incoming Correlation-Id', async () => {
    const res = await buildApp().request('/ping', { headers: { 'Correlation-Id': 'abc' } });
    const body = await res.json();
    expect(body.correlationId).toBe('abc');
    expect(body.commandId).not.toBe('abc');
    expect(res.headers.get('Correlation-Id')).toBe('abc');
  });

  it('extracts correlationId from traceparent when no Correlation-Id', async () => {
    const tp = '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01';
    const res = await buildApp().request('/ping', { headers: { traceparent: tp } });
    const body = await res.json();
    expect(body.correlationId).toBe('0af7651916cd43dd8448eb211c80319c');
    expect(body.traceparent).toBe(tp);
  });

  it('Correlation-Id wins over traceparent when both present', async () => {
    const tp = '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01';
    const res = await buildApp().request('/ping', { headers: { 'Correlation-Id': 'manual', traceparent: tp } });
    const body = await res.json();
    expect(body.correlationId).toBe('manual');
    expect(body.traceparent).toBe(tp);
  });

  it('tolerates malformed traceparent (sets to null, does not throw)', async () => {
    const res = await buildApp().request('/ping', { headers: { traceparent: 'not-a-valid-tp' } });
    const body = await res.json();
    expect(body.traceparent).toBeNull();
    expect(body.correlationId).toMatch(/^[0-9a-f-]{36}$/);
  });
});
```

- [ ] **Step 6.2: Run the test — verify fail**

```bash
pnpm -F @rntme/bindings-http vitest run test/unit/correlation-middleware.test.ts
```

Expected: fail (module not found).

- [ ] **Step 6.3: Implement `correlation-middleware.ts`**

`CorrelationCtx` is imported from `@rntme/graph-ir-compiler` (defined there in Task 4.2). This keeps one type for both the HTTP boundary and the command executor.

```ts
// packages/bindings-http/src/runtime/correlation-middleware.ts
import type { MiddlewareHandler } from 'hono';
import { randomUUID } from 'node:crypto';
import type { CorrelationCtx } from '@rntme/graph-ir-compiler';

const TP_RE = /^[0-9a-f]{2}-([0-9a-f]{32})-[0-9a-f]{16}-[0-9a-f]{2}$/;

export type { CorrelationCtx };

export type CorrelationVariables = { correlation: CorrelationCtx };

export function correlationMiddleware(): MiddlewareHandler<{ Variables: CorrelationVariables }> {
  return async (c, next) => {
    const incoming = c.req.header('Correlation-Id');
    const tpRaw = c.req.header('traceparent');
    const tpMatch = tpRaw ? TP_RE.exec(tpRaw) : null;
    const traceparent = tpMatch ? tpRaw! : null;
    const correlationId =
      incoming ??
      (tpMatch ? tpMatch[1]! : randomUUID());
    const commandId = randomUUID();
    c.set('correlation', { commandId, correlationId, traceparent });
    c.res.headers.set('Correlation-Id', correlationId);
    await next();
    // Re-set header after downstream handler (Hono may rebuild Response)
    c.res.headers.set('Correlation-Id', correlationId);
  };
}
```

- [ ] **Step 6.4: Re-run — verify pass**

```bash
pnpm -F @rntme/bindings-http vitest run test/unit/correlation-middleware.test.ts
```

- [ ] **Step 6.5: Update `command-handler.ts`**

```ts
// packages/bindings-http/src/runtime/command-handler.ts
import type { Context } from 'hono';
import type BetterSqlite3 from 'better-sqlite3';
import { executeCommand, CommandExecutionError } from '@rntme/graph-ir-compiler';
import type { EventStore, ActorRef } from '@rntme/event-store';
import type { CommandBindingPlan } from '../startup/compile-plan.js';
import type { CorrelationCtx } from './correlation-middleware.js';
import {
  validationErrorBody, invalidBodyErrorBody, internalErrorBody,
  commandErrorBody, commandErrorStatus,
} from '../errors.js';
import { extractQuery, extractPath } from './extract.js';
import { remapToGraphInputs } from './remap.js';

export type CommandHandlerDeps = {
  eventStore: EventStore;
  qsmDb: BetterSqlite3.Database | null;
  now: () => string;
  nextId: () => string;
  actorFromRequest: (c: Context) => ActorRef | null;
  onError?: (err: unknown, ctx: Context) => void;
};

type Handler = (c: Context<{ Variables: { correlation: CorrelationCtx } }>) => Promise<Response>;

export function makeCommandHandler(plan: CommandBindingPlan, deps: CommandHandlerDeps): Handler {
  const declaredQueryParams = plan.entry.http.parameters.filter((p) => p.in === 'query');
  const hasBody = plan.bodyParamNames.length > 0;

  return async (c) => {
    const pathBag = extractPath(c, plan.pathParamNames);
    const pathParsed = plan.schemas.pathSchema.safeParse(pathBag);
    if (!pathParsed.success) return c.json(validationErrorBody(pathParsed.error), 400);

    const queryBag = extractQuery(c, declaredQueryParams, plan.listParamNames);
    const queryParsed = plan.schemas.querySchema.safeParse(queryBag);
    if (!queryParsed.success) return c.json(validationErrorBody(queryParsed.error), 400);

    let bodyValues: Record<string, unknown> = {};
    if (hasBody) {
      let rawBody: unknown;
      try { rawBody = await c.req.json(); }
      catch { return c.json(invalidBodyErrorBody('Request body is not valid JSON'), 400); }
      if (rawBody === null || typeof rawBody !== 'object' || Array.isArray(rawBody)) {
        return c.json(invalidBodyErrorBody('Request body must be a JSON object'), 400);
      }
      const bodyParsed = plan.schemas.bodySchema!.safeParse(rawBody);
      if (!bodyParsed.success) return c.json(validationErrorBody(bodyParsed.error), 400);
      bodyValues = bodyParsed.data as Record<string, unknown>;
    }

    const combined: Record<string, unknown> = {
      ...(queryParsed.data as Record<string, unknown>),
      ...(pathParsed.data as Record<string, unknown>),
      ...bodyValues,
    };
    const graphInputs = remapToGraphInputs(combined, plan.bindToMap);
    const correlation = c.get('correlation');      // set by correlationMiddleware

    try {
      const result = executeCommand(plan.compiled, graphInputs, {
        eventStore: deps.eventStore,
        qsmDb: deps.qsmDb,
        now: deps.now,
        nextId: deps.nextId,
        actor: deps.actorFromRequest(c),
        correlation,
      });
      return c.json(result, 200);                   // CommandResult already includes commandId, correlationId
    } catch (e) {
      if (e instanceof CommandExecutionError) {
        return c.json(commandErrorBody(e), commandErrorStatus(e));
      }
      deps.onError?.(e, c);
      return c.json(internalErrorBody(), 500);
    }
  };
}
```

- [ ] **Step 6.6: Export from package index**

`packages/bindings-http/src/index.ts` add `export { correlationMiddleware } from './runtime/correlation-middleware.js';` and its types.

- [ ] **Step 6.7: Update any existing bindings-http tests that build command handler**

Every test that builds a `Context` or expects `CommandResult` shape needs:
- Use `correlationMiddleware()` in the Hono app OR manually `c.set('correlation', { commandId: 'x', correlationId: 'y', traceparent: null })` before invoking the handler.
- Assertions on the response body: include new `commandId`, `correlationId`.

- [ ] **Step 6.8: Run package tests and commit**

```bash
pnpm -F @rntme/bindings-http test
git add packages/bindings-http
git commit -m "feat(bindings-http): correlationMiddleware + CommandResult body fields"
```

---

## Task 7: `@rntme/seed` — new envelope shape + seed:<uuid> correlation

**Files:**
- Modify: `packages/seed/src/schema.ts` (JSON Schema / Zod for validation)
- Modify: `packages/seed/src/validate.ts`
- Modify: `packages/seed/src/builder.ts`
- Modify: `packages/seed/src/wrap-payloads.ts`
- Modify: `packages/seed/src/apply.ts`
- Modify: `packages/seed/src/parse.ts` / `load.ts` as needed
- Modify: tests under `packages/seed/test/`

- [ ] **Step 7.1: Update seed schema to require CE fields**

Open `packages/seed/src/schema.ts`; the per-event validator should require: `id`, `eventType`, `time`, `subject`, `data`, `rntAggregateType`, `rntAggregateId`, `rntVersion`, `rntSchemaVersion`, `correlationId`; allow-optional: `causationId` (default null), `commandId` (default null), `rntActorKind` (default null), `rntActorId` (default null), `traceparent` (default null). Fields NOT in seed.json (derived on append): `source`, `type`, `dataSchema`, `dataContentType` — validator rejects them if present (or silently ignores).

Because `appendRaw` needs the full `EventEnvelope`, the validator's output adds the derived fields with the service name from context. Either:
(a) `applySeed` takes `serviceName` and computes derived fields before calling `appendRaw`, OR
(b) `SqliteEventStore` exposes a helper `completeEnvelopeFromSeed(partial) → EventEnvelope` that derives `source`/`type`/`dataSchema`.

Pick (a) for clarity — keeps seed aware of what it's constructing.

- [ ] **Step 7.2: Update `apply.ts`**

```ts
// packages/seed/src/apply.ts (key change)
export async function applySeed(
  seed: ValidatedSeed,
  eventStore: EventStore,
  opts: { mode?: ApplyMode; serviceName: string } = { serviceName: '' },
): Promise<ApplyResult> {
  if (!opts.serviceName) throw new Error('applySeed: serviceName required');
  const completed = seed.events.map((partial) => completeEnvelope(partial, opts.serviceName));
  // ... rest of logic uses `completed: EventEnvelope[]` everywhere ...
}

function completeEnvelope(partial: SeedEnvelope, serviceName: string): EventEnvelope {
  return {
    id: partial.id,
    source: `rntme://${serviceName}/${partial.rntAggregateType}`,
    eventType: partial.eventType,
    type: `${serviceName}.${partial.rntAggregateType}.${partial.eventType}`,
    time: partial.time,
    subject: partial.subject,
    dataContentType: 'application/json',
    dataSchema: `rntme://schemas/${serviceName}/${partial.eventType}.v${partial.rntSchemaVersion}.json`,
    data: partial.data,
    correlationId: partial.correlationId,
    causationId: partial.causationId ?? null,
    commandId: partial.commandId ?? null,
    rntAggregateType: partial.rntAggregateType,
    rntAggregateId: partial.rntAggregateId,
    rntVersion: partial.rntVersion,
    rntSchemaVersion: partial.rntSchemaVersion,
    rntActorKind: partial.rntActorKind ?? null,
    rntActorId: partial.rntActorId ?? null,
    traceparent: partial.traceparent ?? null,
  };
}
```

Define `SeedEnvelope` as the partial input shape (without derivable fields).

Update all references `envelope.stream` → `envelope.subject` and `envelope.eventId` → `envelope.id` in the dedup / error paths.

- [ ] **Step 7.3: Update `builder.ts`**

If `builder.ts` emits events programmatically (used by tooling or tests), it should:
- Generate one `seedCorrelationId = "seed:" + randomUUID()` per builder instance;
- Stamp every constructed event with that `correlationId` unless overridden;
- Default `commandId: null`, `causationId: null`, `traceparent: null`.

Example fragment:

```ts
import { randomUUID } from 'node:crypto';

export function newSeedBuilder() {
  const seedCorrelationId = `seed:${randomUUID()}`;
  // ... internal state ...
  return {
    addEvent(partial: Omit<SeedEnvelope, 'correlationId'>): void {
      events.push({ ...partial, correlationId: seedCorrelationId });
    },
    // ...
  };
}
```

- [ ] **Step 7.4: Update seed tests**

All test `seed.json` fixtures rewritten. Example after-shape:

```json
{
  "events": [
    {
      "id": "seed-evt-1",
      "eventType": "IssueCreated",
      "time": "2026-04-17T00:00:00.000Z",
      "subject": "Issue-seed-1",
      "rntAggregateType": "Issue",
      "rntAggregateId": "seed-1",
      "rntVersion": 1,
      "rntSchemaVersion": 1,
      "correlationId": "seed:fixed-for-test",
      "data": { "title": "Hello" }
    }
  ]
}
```

Tests calling `applySeed` now also pass `serviceName: 'test-service'`.

Add a new test: after seeding, `event_log` rows have `command_id IS NULL`, `correlation_id = 'seed:fixed-for-test'`.

- [ ] **Step 7.5: Run tests and commit**

```bash
pnpm -F @rntme/seed test
git add packages/seed
git commit -m "feat(seed): CE envelope shape; seed:<uuid> correlation; serviceName required"
```

---

## Task 8: `@rntme/runtime` — thread serviceName; in-memory bus via wire codec

**Files:**
- Modify: `packages/runtime/src/start/wire-event-pipeline.ts`
- Modify: `packages/runtime/src/start/start-service.ts` (if it reads/uses eventStore ctor differently; verify)
- Modify: `packages/runtime/src/plugins/in-memory-bus.ts`
- Modify: runtime tests that instantiate `SqliteEventStore` or `InMemoryBus`

- [ ] **Step 8.1: Update `wire-event-pipeline.ts`**

```ts
// packages/runtime/src/start/wire-event-pipeline.ts (relevant)
const eventStore = new SqliteEventStore({
  filename: eventStorePath,
  serviceName: manifest.service.name,
});

const relay: Relay = createRelay({
  store: eventStore,
  kafka: bus.producer(),
  cursorId: `${manifest.service.name}:relay`,
  pollIntervalMs: 10,
  batchSize: 100,
  serviceName: manifest.service.name,
  now: () => new Date().toISOString(),
  nextId: () => randomUUID(),                  // import at top
});
```

Add `import { randomUUID } from 'node:crypto';`.

Seed application now needs `serviceName`; update the call site (find `applySeed` usage — likely in `start-service.ts` or a seed-specific wire step):

```ts
await applySeed(validatedSeed, eventPipeline.eventStore, {
  mode: 'strict',
  serviceName: manifest.service.name,
});
```

- [ ] **Step 8.2: Update `in-memory-bus.ts`**

```ts
// packages/runtime/src/plugins/in-memory-bus.ts
import type { KafkaMessage, KafkaProducer } from '@rntme/event-store';
import { fromCloudEventWire } from '@rntme/event-store';
import {
  createInMemoryKafkaConsumer,
  type InMemoryKafkaConsumer,
  type KafkaConsumer,
} from '@rntme/projection-consumer';
import type { EventBus } from './interfaces.js';

export class InMemoryBus implements EventBus {
  private readonly inner: InMemoryKafkaConsumer;

  constructor(opts: { pollIntervalMs?: number } = {}) {
    this.inner = createInMemoryKafkaConsumer({ pollIntervalMs: opts.pollIntervalMs ?? 2 });
  }

  producer(): KafkaProducer {
    const inner = this.inner;
    return {
      async send(message: KafkaMessage): Promise<void> {
        const envelope = fromCloudEventWire(message);
        inner.produce(envelope);
      },
    };
  }

  consumer(): KafkaConsumer {
    return this.inner;
  }
}
```

- [ ] **Step 8.3: Update runtime tests**

`packages/runtime/test/integration/plugin-contracts.test.ts` and similar: construct `InMemoryBus`, build a fake `KafkaMessage` via `toCloudEventWire`, verify the consumer side receives the full envelope after decode.

- [ ] **Step 8.4: Run package tests and commit**

```bash
pnpm -F @rntme/runtime test
git add packages/runtime
git commit -m "feat(runtime): wire serviceName into event-store/relay; InMemoryBus via CE codec"
```

---

## Task 9: `demo/issue-tracker-api` — seed.json rewrite + e2e updates

**Files:**
- Modify: `demo/issue-tracker-api/artifacts/seed.json` (rewrite every event)
- Modify: `demo/issue-tracker-api/src/server.ts` (if it builds an app, may need `correlationMiddleware` mount — check existing setup)
- Modify: demo e2e tests under `demo/issue-tracker-api/test/e2e/`

- [ ] **Step 9.1: Rewrite `seed.json`**

For each existing event, apply the mapping:
- `eventId` → `id`
- `eventType` → `eventType` (unchanged)
- `aggregateType` → `rntAggregateType`
- `aggregateId` → `rntAggregateId`
- `stream` → `subject`
- `version` → `rntVersion`
- `schemaVersion` → `rntSchemaVersion`
- `occurredAt` → `time`
- `payload` → `data`
- `actor: { kind, id }` → `rntActorKind`, `rntActorId` (or omit both if null)
- Add `correlationId: "seed:<stable-uuid-per-seed-file>"` (pick one UUID and reuse across all events in this file so the seed is deterministic).
- Add `causationId: null`, `commandId: null`, `traceparent: null`.

Do not add `source`, `type`, `dataSchema`, `dataContentType`.

Use a script to transform if the file is large — write a one-off Node script under `scripts/migrate-seed-d9.mjs` (not committed; run locally).

- [ ] **Step 9.2: Verify `correlationMiddleware` is mounted**

Inspect `demo/issue-tracker-api/src/server.ts` (or wherever Hono app is assembled in `@rntme/runtime`'s surface plugin). The default `HttpSurface` in `@rntme/runtime` should mount the middleware automatically as part of bindings; confirm. If it is not, add the mount in the runtime's `HttpSurface` plugin (`packages/runtime/src/plugins/http-surface.ts` or similar):

```ts
import { correlationMiddleware } from '@rntme/bindings-http';
// ...
app.use('/api/*', correlationMiddleware());
```

If that wiring was missed in Task 6, do it here.

- [ ] **Step 9.3: Update demo e2e tests**

Every test hitting `POST /api/commands/*`:
- Expect response body to include `commandId` (UUID-shape) and `correlationId`.
- Expect response header `Correlation-Id`.
- Optionally: assert that sending `Correlation-Id: custom-xyz` yields `correlationId: 'custom-xyz'` in the body.

- [ ] **Step 9.4: Clean local sqlite files before running**

```bash
rm -rf demo/issue-tracker-api/data/*.sqlite || true
rm -rf .rntme/*.sqlite || true
```

(If the demo persists to a different path, adapt.)

- [ ] **Step 9.5: Run demo package tests and start the demo once manually**

```bash
pnpm -F @rntme/issue-tracker-api-demo test
pnpm -F @rntme/issue-tracker-api-demo start &    # background
sleep 2
curl -s -X POST http://localhost:3000/api/commands/createIssue \
  -H 'Content-Type: application/json' \
  -H 'Correlation-Id: manual-test-1' \
  -d '{"title":"hello"}'                         # expect {aggregateId, version, eventIds, commandId, correlationId:"manual-test-1"}
kill %1
```

Expected: JSON response body contains `commandId` UUID-shaped and `correlationId: "manual-test-1"`.

- [ ] **Step 9.6: Commit**

```bash
git add demo/issue-tracker-api/artifacts/seed.json \
        demo/issue-tracker-api/test/ \
        packages/runtime/src/plugins/http-surface.ts     # only if step 9.2 edited it
git commit -m "feat(demo): seed.json and e2e tests on CE envelope shape"
```

---

## Task 10: Integration tests — end-to-end correlation propagation

**Files:**
- Create: `packages/runtime/test/integration/correlation-e2e.test.ts`
- Create: `packages/seed/test/integration/seed-ce.test.ts`

- [ ] **Step 10.1: Write `correlation-e2e.test.ts`**

```ts
// packages/runtime/test/integration/correlation-e2e.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startService } from '../../src/index.js';             // adjust import path

describe('D9 correlation end-to-end', () => {
  let service: Awaited<ReturnType<typeof startService>>;
  beforeAll(async () => {
    service = await startService({
      manifestPath: 'test/fixtures/minimal-service/manifest.json',   // use a minimal harness fixture
    });
  });
  afterAll(async () => { await service.stop(); });

  it('propagates correlation & command ids from HTTP header to event_log to projection', async () => {
    const res = await fetch(`${service.baseUrl}/api/commands/createIssue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Correlation-Id': 'corr-integration' },
      body: JSON.stringify({ title: 'hi' }),
    });
    const body = await res.json();
    expect(res.headers.get('Correlation-Id')).toBe('corr-integration');
    expect(body.correlationId).toBe('corr-integration');
    expect(body.commandId).toMatch(/^[0-9a-f-]{36}$/);

    // event_log row
    const row = service.eventStoreRawDb()
      .prepare('SELECT * FROM event_log ORDER BY id DESC LIMIT 1').get() as any;
    expect(row.correlation_id).toBe('corr-integration');
    expect(row.command_id).toBe(body.commandId);
    expect(row.causation_id).toBe(body.commandId);

    // projection row (any projection that surfaces the aggregate — adjust query per fixture schema)
    await waitForProjection(service, body.aggregateId);
    // assertion here; depends on the fixture's projection shape
  });
});
```

If a minimal service fixture does not yet exist in `packages/runtime/test/fixtures/`, reuse the demo's artifacts via a relative path; note this coupling in the test file header. (If the runtime tests currently import from `demo/issue-tracker-api/artifacts/`, follow that same pattern.)

- [ ] **Step 10.2: Write `seed-ce.test.ts`**

```ts
// packages/seed/test/integration/seed-ce.test.ts
import { describe, it, expect } from 'vitest';
import { SqliteEventStore } from '@rntme/event-store';
import { applySeed, parseSeed, validateSeed } from '../../src/index.js';
import { readFileSync } from 'node:fs';

describe('seed events preserve correlation shape', () => {
  it('applies CE-shape seed and stamps seed: correlationId', async () => {
    const raw = JSON.parse(readFileSync('test/fixtures/seed-ce.json', 'utf8'));
    const parsed = parseSeed(raw);
    const validated = validateSeed(parsed);
    const store = new SqliteEventStore({ filename: ':memory:', serviceName: 'svc' });
    await applySeed(validated, store, { mode: 'strict', serviceName: 'svc' });
    const db = store.rawDb();
    const rows = db.prepare('SELECT correlation_id, command_id, causation_id FROM event_log').all() as any[];
    for (const r of rows) {
      expect(r.command_id).toBeNull();
      expect(r.causation_id).toBeNull();
      expect(r.correlation_id).toMatch(/^seed:/);
    }
  });
});
```

Create the fixture file `packages/seed/test/fixtures/seed-ce.json`:

```json
{
  "events": [
    {
      "id": "seed-evt-1",
      "eventType": "IssueCreated",
      "time": "2026-04-17T00:00:00.000Z",
      "subject": "Issue-seed-1",
      "rntAggregateType": "Issue",
      "rntAggregateId": "seed-1",
      "rntVersion": 1,
      "rntSchemaVersion": 1,
      "correlationId": "seed:fixed",
      "data": {}
    }
  ]
}
```

- [ ] **Step 10.3: Run integration tests and commit**

```bash
pnpm -F @rntme/runtime test
pnpm -F @rntme/seed test
git add packages/runtime/test/integration/correlation-e2e.test.ts \
        packages/seed/test/integration/seed-ce.test.ts \
        packages/seed/test/fixtures/seed-ce.json
git commit -m "test: D9 correlation e2e + seed CE integration"
```

---

## Task 11: Final cross-repo green

- [ ] **Step 11.1: Run full monorepo build**

```bash
pnpm -r run build
```

Expected: all packages build. Any fallout from missed renames surfaces here — fix inline, referencing the spec's TS shapes.

- [ ] **Step 11.2: Run full test suite**

```bash
pnpm -r run test
```

Expected: all packages green.

- [ ] **Step 11.3: Run lint**

```bash
pnpm -r run lint
```

- [ ] **Step 11.4: Run typecheck**

```bash
pnpm -r run typecheck
```

- [ ] **Step 11.5: If any cleanup commits needed, commit**

```bash
git add .
git commit -m "chore: D9 cross-repo cleanup"
```

- [ ] **Step 11.6: Push branch**

```bash
git push -u origin feature/cloudevents-envelope
```

---

## Task 12: PR description

- [ ] **Step 12.1: Open PR against `main`**

Title: `D9: CloudEvents 1.0 envelope end-to-end`

Body template:

```md
## Summary
- Replaces proprietary event envelope with CloudEvents 1.0 (in-memory TS type, event_log storage, Kafka binary content mode, HTTP response body).
- Adds `commandId`, `correlationId`, `causationId`, `traceparent` propagation end-to-end.
- DLQ becomes a wrapper CE event (`{service}.Relay.EventDeliveryFailed`).
- Bundles D6 topic-naming fix (adds `{serviceName}` segment).

## Breaking
- `event_log` schema incompatible with any pre-D9 database. Dev workflow: drop `.rntme/*.sqlite` / `demo/.../data/*.sqlite` before running. Runtime guard `EVENT_STORE_SCHEMA_INCOMPATIBLE` panics on stale schemas.
- `EventEnvelope`, `AppendEventInput`, `CommandResult` all changed shape.
- `SqliteEventStore` and `createRelay` require new `serviceName` option; `createRelay` also requires `now` and `nextId`.

## Test plan
- [ ] `pnpm -r run build`
- [ ] `pnpm -r run test`
- [ ] Manual: `pnpm -F @rntme/issue-tracker-api-demo start`, send command with `Correlation-Id` header, verify response body and `event_log` row.

Spec: `docs/superpowers/specs/2026-04-17-cloudevents-envelope-design.md`.
```

---

## Self-review checklist (read before starting; re-check at the end)

- Spec §3.1 (TS envelope shape) → Task 1.1.
- Spec §3.2 (`event_log` DDL) → Task 1.3.
- Spec §3.3 (wire format) → Task 2.
- Spec §3.4 (`SqliteEventStore` ctor) → Task 1.5, used Task 8.
- Spec §4.1 (`ExecuteCommandContext.correlation`) → Task 4.
- Spec §4.2 (correlation middleware) → Task 6.
- Spec §4.3 (command handler body augmentation) → Task 6.
- Spec §5.1 (relay primary-topic CE emission) → Task 3.
- Spec §5.2 (DLQ wrapper) → Task 3.
- Spec §5.3 (relay needs serviceName/now/nextId) → Task 3 + Task 8 wiring.
- Spec §5.4 (D6 topic naming) → Task 3.1.
- Spec §6 (projection-consumer + in-memory bus) → Task 5 + Task 8.
- Spec §7 (seed) → Task 7.
- Spec §8 (new error codes) → Task 1 (schema guard), Task 2 (wire decode errors).
- Spec §9 (tests) → Tasks 2.2, 3.4, 6.1, 10.
- Spec §10 (dev migration) → Task 9.4.
- Spec §12 (rollout order) → tasks are ordered consistent with it.

Spec §4.4 (OpenAPI emission augmentation) — explicitly scoped out per spec caveat; no task.
Spec §8 `EVENT_STORE_WIRE_DECODE_*` codes — class `CloudEventDecodeError` carries the code string (Task 2.1).
