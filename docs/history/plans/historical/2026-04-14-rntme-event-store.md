> Status: historical.
> Date: 2026-04-14.
> Current source: docs/current/**, docs/decision-system.md, and current code/tests.
> Why retained: Historical rationale and execution context retained for review; it is not current-state truth by itself.

# @rntme/event-store Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Создать standalone пакет `@rntme/event-store` — SQLite-реализация event log'а для write-side event-sourced системы: `EventStore` интерфейс с `appendEvents` / `readStream` / `readFrom`, публикационный курсор (`publish_cursor`), и `createRelay` long-running loop, публикующий события в Kafka через pluggable `KafkaProducer` абстракцию.

**Architecture:** Два слоя внутри пакета. Storage-слой (`SqliteEventStore`) — одноинстансный writer к SQLite-файлу, atomic multi-stream append в одной транзакции с `BEGIN IMMEDIATE`, optimistic concurrency через `expectedVersion` + `UNIQUE(stream, version)`. Relay-слой (`createRelay`) — polling loop, который тейлит `event_log` по `id > cursor`, маппит строку в `EventEnvelope`, публикует в Kafka (key = stream) и продвигает `publish_cursor` после успешного batch-send (at-least-once). Kafka не тянется как конкретный клиент — виден через интерфейс `KafkaProducer`. `ActorRef` повторён локально (пакет standalone, не зависит от `@rntme/pdm`).

**Tech Stack:** TypeScript (strict, ES2022, verbatim module syntax), `better-sqlite3` для SQLite, Vitest для тестов (включая file-backed DB для concurrency-сценариев), `Result<T>` monad для parse/validation где уместно, kastomizable `KafkaProducer` интерфейс (без зависимости от kafkajs/rdkafka в ядре).

**Related spec:** `docs/history/specs/historical/2026-04-14-mutations-design.md` §3 (event envelope), §5 (storage + relay + Kafka topology), §7.7 (package layout).

**Dependency context:** Третий пакет в implementation rollout (§7.8). Независим от PDM/QSM, может собираться параллельно. Unblock-ит: `@rntme/graph-ir-compiler` (command-runtime txn + replay), `@rntme/projection-consumer` (downstream consumer читает envelope тот же shape, что publish-ит relay).

**MVP scope vs tier 2:**
- В scope: `EventStore` интерфейс + `SqliteEventStore` реализация; schema bootstrap; optimistic concurrency per stream; multi-stream atomic append в одной txn; `publish_cursor` read/write; `KafkaProducer` интерфейс + in-memory test double; `createRelay` polling loop с at-least-once; per-stream ordering в Kafka (partition key = `stream`); retry/backoff после Kafka fail.
- Вне scope: snapshot optimization, replay-rebuild tooling, poison-message / DLQ handling, multi-writer write-side, CDC через SQLite update-hooks, реальная Kafka-интеграция (только интерфейс — kafkajs-адаптер в отдельном пакете позже), schema-registry / Avro.

---

## File Layout

```
packages/event-store/
  package.json
  tsconfig.json
  tsconfig.check.json
  eslint.config.mjs
  vitest.config.ts
  README.md
  src/
    index.ts                       # public API re-exports
    types/
      actor.ts                     # ActorRef (local redeclaration, matches spec §3.3)
      envelope.ts                  # EventEnvelope<TPayload>
      append.ts                    # AppendRequest, AppendEventInput, AppendResult, AppendedEvent
      errors.ts                    # ConcurrencyConflict, EventStoreError
      index.ts                     # re-exports
    store/
      interface.ts                 # EventStore interface (readStream/appendEvents/readFrom/readCursor/writeCursor)
      schema.ts                    # applyEventStoreSchema(db) — CREATE TABLE + indexes
      sqlite.ts                    # SqliteEventStore class implementing EventStore
      row-mapper.ts                # rowToEnvelope() helper
    kafka/
      producer.ts                  # KafkaProducer interface + KafkaMessage type
      in-memory.ts                 # createInMemoryKafkaProducer() test double
    relay/
      topic.ts                     # defaultTopicOf(aggregateType): string
      loop.ts                      # createRelay({ store, kafka, cursorId, … }) → { start, stop }
  test/
    fixtures/
      sample-events.ts             # factory helpers для EventEnvelope / AppendRequest
    unit/
      schema.test.ts               # applyEventStoreSchema создаёт таблицы и индексы
      sqlite-append.test.ts        # single-stream append + version monotonic
      sqlite-append-concurrency.test.ts  # expectedVersion + UNIQUE violation → ConcurrencyConflict
      sqlite-append-multi.test.ts  # multi-stream atomic append
      sqlite-read.test.ts          # readStream + readFrom
      cursor.test.ts               # publish_cursor read/write
      kafka-in-memory.test.ts      # in-memory producer test double
      relay.test.ts                # createRelay publishes, advances cursor, handles kafka failure
    smoke.test.ts                  # end-to-end: append → relay → kafka receives ordered envelopes
```

---

## Task 1: Scaffold package

**Files:**
- Create: `packages/event-store/package.json`
- Create: `packages/event-store/tsconfig.json`
- Create: `packages/event-store/tsconfig.check.json`
- Create: `packages/event-store/eslint.config.mjs`
- Create: `packages/event-store/vitest.config.ts`
- Create: `packages/event-store/README.md`
- Create: `packages/event-store/src/index.ts`

- [ ] **Step 1: Create `packages/event-store/package.json`**

```json
{
  "name": "@rntme/event-store",
  "version": "0.0.0",
  "type": "module",
  "private": true,
  "description": "SQLite-backed event store + relay for event-sourced write-side. Provides EventStore interface, optimistic concurrency, and Kafka-agnostic publication loop.",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": ["dist", "README.md"],
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc -p tsconfig.check.json",
    "lint": "eslint \"src/**/*.ts\" \"test/**/*.ts\"",
    "format": "prettier --write ."
  },
  "dependencies": {
    "better-sqlite3": "^11.3.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.11",
    "@types/node": "^20.14.0",
    "@typescript-eslint/eslint-plugin": "^8.6.0",
    "@typescript-eslint/parser": "^8.6.0",
    "eslint": "^9.10.0",
    "prettier": "^3.3.3",
    "typescript": "^5.5.4",
    "vitest": "^2.1.1"
  }
}
```

- [ ] **Step 2: Create `packages/event-store/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "composite": false
  },
  "include": ["src/**/*.ts"],
  "exclude": ["dist", "node_modules", "test"]
}
```

- [ ] **Step 3: Create `packages/event-store/tsconfig.check.json`**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "rootDir": ".",
    "noEmit": true,
    "composite": false,
    "module": "ESNext",
    "moduleResolution": "Bundler"
  },
  "include": ["src/**/*.ts", "test/**/*.ts"],
  "exclude": ["dist", "node_modules"]
}
```

- [ ] **Step 4: Create `packages/event-store/eslint.config.mjs`**

```js
import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

export default [
  { ignores: ['dist/**', 'node_modules/**'] },
  js.configs.recommended,
  {
    files: ['src/**/*.ts', 'test/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { sourceType: 'module', ecmaVersion: 2022 },
      globals: {
        console: 'readonly',
        process: 'readonly',
        structuredClone: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setImmediate: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-console': 'warn',
    },
  },
];
```

- [ ] **Step 5: Create `packages/event-store/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    reporters: 'default',
    testTimeout: 15_000,
  },
});
```

- [ ] **Step 6: Create `packages/event-store/README.md`**

```markdown
# @rntme/event-store

SQLite-backed event store + Kafka relay for rntme's event-sourced write-side.

Provides:
- `EventStore` interface and `SqliteEventStore` implementation — `appendEvents`, `readStream`, `readFrom`, cursor helpers.
- Optimistic concurrency per stream via `expectedVersion` + `UNIQUE(stream, version)`.
- Atomic multi-stream append in one transaction.
- `KafkaProducer` abstraction with an in-memory test double.
- `createRelay` polling loop — at-least-once publication with per-stream order preserved (Kafka partition key = `stream`).

See `docs/history/specs/historical/2026-04-14-mutations-design.md` §3, §5 for spec.
```

- [ ] **Step 7: Create `packages/event-store/src/index.ts`**

```ts
export const VERSION = '0.0.0';
```

- [ ] **Step 8: Install dependencies and verify typecheck**

Run:
```
cd packages/event-store && pnpm install
pnpm run typecheck
```
Expected: install succeeds, `typecheck` exits 0.

- [ ] **Step 9: Commit**

```bash
git add packages/event-store pnpm-lock.yaml
git commit -m "feat(event-store): scaffold @rntme/event-store package"
```

---

## Task 2: Core types — ActorRef, EventEnvelope, AppendRequest, errors

**Files:**
- Create: `packages/event-store/src/types/actor.ts`
- Create: `packages/event-store/src/types/envelope.ts`
- Create: `packages/event-store/src/types/append.ts`
- Create: `packages/event-store/src/types/errors.ts`
- Create: `packages/event-store/src/types/index.ts`
- Test: `packages/event-store/test/unit/types.test.ts`

- [ ] **Step 1: Write failing type-smoke test**

Create `packages/event-store/test/unit/types.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import type {
  ActorRef,
  EventEnvelope,
  AppendRequest,
  AppendEventInput,
  AppendResult,
  AppendedEvent,
} from '../../src/types/index.js';
import { ConcurrencyConflict, EventStoreError } from '../../src/types/index.js';

describe('types — smoke', () => {
  it('ActorRef union covers user/system/service + null carried in envelope', () => {
    const actors: (ActorRef | null)[] = [
      { kind: 'user', id: 'alice' },
      { kind: 'system', id: 'migrator' },
      { kind: 'service', id: 'billing' },
      null,
    ];
    expect(actors).toHaveLength(4);
  });

  it('EventEnvelope is generic over payload', () => {
    const env: EventEnvelope<{ before: null; after: { status: 'draft' } }> = {
      eventId: '018e9d2a-0000-7000-8000-000000000001',
      eventType: 'IssueReport',
      aggregateType: 'Issue',
      aggregateId: '1',
      stream: 'Issue-1',
      version: 1,
      occurredAt: '2026-04-14T10:00:00.000Z',
      actor: { kind: 'user', id: 'alice' },
      payload: { before: null, after: { status: 'draft' } },
      schemaVersion: 1,
    };
    expect(env.version).toBe(1);
  });

  it('AppendRequest carries events + optional expectedVersion', () => {
    const req: AppendRequest = {
      stream: 'Issue-1',
      expectedVersion: 0,
      events: [{
        eventId: 'e1',
        eventType: 'IssueReport',
        aggregateType: 'Issue',
        aggregateId: '1',
        occurredAt: '2026-04-14T10:00:00.000Z',
        actor: null,
        payload: { before: null, after: { status: 'draft' } },
        schemaVersion: 1,
      }] satisfies readonly AppendEventInput[],
    };
    expect(req.events[0]!.eventId).toBe('e1');
  });

  it('AppendResult and AppendedEvent expose stream, lastVersion, appendedEvents', () => {
    const r: AppendResult = {
      stream: 'Issue-1',
      lastVersion: 1,
      appendedEvents: [{ eventId: 'e1', version: 1, id: 1 }] satisfies readonly AppendedEvent[],
    };
    expect(r.lastVersion).toBe(1);
  });

  it('ConcurrencyConflict is an Error subclass with stream/expected/actual', () => {
    const e = new ConcurrencyConflict('Issue-1', 0, 1);
    expect(e).toBeInstanceOf(Error);
    expect(e).toBeInstanceOf(EventStoreError);
    expect(e.stream).toBe('Issue-1');
    expect(e.expectedVersion).toBe(0);
    expect(e.actualVersion).toBe(1);
    expect(e.code).toBe('CONCURRENCY_CONFLICT');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -C packages/event-store test -- --run test/unit/types.test.ts`
Expected: FAIL — modules do not exist.

- [ ] **Step 3: Create `packages/event-store/src/types/actor.ts`**

```ts
/**
 * Runtime actor reference carried in event envelope (spec §3.3).
 * Redeclared locally to keep @rntme/event-store free of PDM dependency.
 * Shape MUST match @rntme/pdm's ActorRef exactly.
 */
export type ActorRef =
  | { readonly kind: 'user'; readonly id: string }
  | { readonly kind: 'system'; readonly id: string }
  | { readonly kind: 'service'; readonly id: string };
```

- [ ] **Step 4: Create `packages/event-store/src/types/envelope.ts`**

```ts
import type { ActorRef } from './actor.js';

/**
 * Event envelope (spec §3.2). Payload is generic so downstream packages can
 * use a discriminated union keyed by `eventType`.
 */
export type EventEnvelope<TPayload = unknown> = Readonly<{
  eventId: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  stream: string;
  version: number;
  occurredAt: string;
  actor: ActorRef | null;
  payload: TPayload;
  schemaVersion: number;
}>;
```

- [ ] **Step 5: Create `packages/event-store/src/types/append.ts`**

```ts
import type { ActorRef } from './actor.js';

/**
 * One event the caller wants appended. Caller is responsible for generating
 * `eventId` (UUIDv7 recommended) and `occurredAt` — the store does not mint
 * these to keep the contract deterministic for testing / replay.
 */
export type AppendEventInput = Readonly<{
  eventId: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  occurredAt: string;
  actor: ActorRef | null;
  payload: unknown;
  schemaVersion: number;
}>;

/**
 * One stream's worth of events to append atomically. `expectedVersion` is the
 * caller-observed MAX(version) before this append (0 for a brand new stream).
 * Omitted ⇒ skip the pre-check and rely on UNIQUE(stream,version) alone.
 */
export type AppendRequest = Readonly<{
  stream: string;
  expectedVersion?: number;
  events: readonly AppendEventInput[];
}>;

export type AppendedEvent = Readonly<{
  eventId: string;
  version: number;
  id: number;
}>;

export type AppendResult = Readonly<{
  stream: string;
  lastVersion: number;
  appendedEvents: readonly AppendedEvent[];
}>;
```

- [ ] **Step 6: Create `packages/event-store/src/types/errors.ts`**

```ts
export type EventStoreErrorCode =
  | 'CONCURRENCY_CONFLICT'
  | 'DUPLICATE_EVENT_ID'
  | 'STORAGE_FAILURE';

export class EventStoreError extends Error {
  readonly code: EventStoreErrorCode;
  constructor(code: EventStoreErrorCode, message: string) {
    super(message);
    this.name = 'EventStoreError';
    this.code = code;
  }
}

export class ConcurrencyConflict extends EventStoreError {
  readonly stream: string;
  readonly expectedVersion: number | undefined;
  readonly actualVersion: number;
  constructor(stream: string, expectedVersion: number | undefined, actualVersion: number) {
    super(
      'CONCURRENCY_CONFLICT',
      `stream ${stream}: expected version ${expectedVersion ?? '<unchecked>'}, actual ${actualVersion}`,
    );
    this.name = 'ConcurrencyConflict';
    this.stream = stream;
    this.expectedVersion = expectedVersion;
    this.actualVersion = actualVersion;
  }
}

export class DuplicateEventId extends EventStoreError {
  readonly eventId: string;
  constructor(eventId: string) {
    super('DUPLICATE_EVENT_ID', `eventId already appended: ${eventId}`);
    this.name = 'DuplicateEventId';
    this.eventId = eventId;
  }
}
```

- [ ] **Step 7: Create `packages/event-store/src/types/index.ts`**

```ts
export type { ActorRef } from './actor.js';
export type { EventEnvelope } from './envelope.js';
export type {
  AppendEventInput,
  AppendRequest,
  AppendResult,
  AppendedEvent,
} from './append.js';
export {
  EventStoreError,
  ConcurrencyConflict,
  DuplicateEventId,
} from './errors.js';
export type { EventStoreErrorCode } from './errors.js';
```

- [ ] **Step 8: Run test to verify it passes**

Run: `pnpm -C packages/event-store test -- --run test/unit/types.test.ts`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add packages/event-store/src/types packages/event-store/test/unit/types.test.ts
git commit -m "feat(event-store): core types (actor, envelope, append, errors)"
```

---

## Task 3: Schema bootstrap — `applyEventStoreSchema`

**Files:**
- Create: `packages/event-store/src/store/schema.ts`
- Test: `packages/event-store/test/unit/schema.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/event-store/test/unit/schema.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { applyEventStoreSchema } from '../../src/store/schema.js';

describe('applyEventStoreSchema', () => {
  it('creates event_log and publish_cursor tables', () => {
    const db = new Database(':memory:');
    applyEventStoreSchema(db);

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as { name: string }[];
    const names = tables.map((t) => t.name);
    expect(names).toContain('event_log');
    expect(names).toContain('publish_cursor');
  });

  it('creates UNIQUE(stream, version) index on event_log', () => {
    const db = new Database(':memory:');
    applyEventStoreSchema(db);

    const idx = db
      .prepare("SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name='event_log'")
      .all() as { name: string; sql: string | null }[];
    // UNIQUE is either its own index or auto-index; check the constraint exists
    db.prepare(
      `INSERT INTO event_log (stream, aggregate_type, aggregate_id, version, event_type,
                              event_id, actor_kind, actor_id, occurred_at, payload_json, schema_version)
       VALUES ('Issue-1','Issue','1',1,'X','e1',NULL,NULL,'2026-01-01T00:00:00Z','{}',1)`,
    ).run();
    expect(() =>
      db.prepare(
        `INSERT INTO event_log (stream, aggregate_type, aggregate_id, version, event_type,
                                event_id, actor_kind, actor_id, occurred_at, payload_json, schema_version)
         VALUES ('Issue-1','Issue','1',1,'Y','e2',NULL,NULL,'2026-01-01T00:00:00Z','{}',1)`,
      ).run(),
    ).toThrow(/UNIQUE/);
    // eventId unique too
    expect(() =>
      db.prepare(
        `INSERT INTO event_log (stream, aggregate_type, aggregate_id, version, event_type,
                                event_id, actor_kind, actor_id, occurred_at, payload_json, schema_version)
         VALUES ('Issue-2','Issue','2',1,'X','e1',NULL,NULL,'2026-01-01T00:00:00Z','{}',1)`,
      ).run(),
    ).toThrow(/UNIQUE/);
    // idx name list is not asserted (sqlite auto-names UNIQUE indexes); presence of the constraint is what matters
    expect(idx.length).toBeGreaterThanOrEqual(0);
  });

  it('is idempotent — applying twice does not throw', () => {
    const db = new Database(':memory:');
    applyEventStoreSchema(db);
    expect(() => applyEventStoreSchema(db)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -C packages/event-store test -- --run test/unit/schema.test.ts`
Expected: FAIL — `applyEventStoreSchema` does not exist.

- [ ] **Step 3: Create `packages/event-store/src/store/schema.ts`**

```ts
import type { Database as BetterSqliteDatabase } from 'better-sqlite3';

const DDL = `
CREATE TABLE IF NOT EXISTS event_log (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  stream          TEXT    NOT NULL,
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
  UNIQUE (stream, version)
);

CREATE INDEX IF NOT EXISTS idx_event_log_stream       ON event_log(stream, version);
CREATE INDEX IF NOT EXISTS idx_event_log_undelivered  ON event_log(id);

CREATE TABLE IF NOT EXISTS publish_cursor (
  relay_id        TEXT PRIMARY KEY,
  last_event_id   INTEGER NOT NULL,
  updated_at      TEXT NOT NULL
);
`;

export function applyEventStoreSchema(db: BetterSqliteDatabase): void {
  db.exec(DDL);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm -C packages/event-store test -- --run test/unit/schema.test.ts`
Expected: PASS (all 3 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/event-store/src/store/schema.ts packages/event-store/test/unit/schema.test.ts
git commit -m "feat(event-store): event_log + publish_cursor schema bootstrap"
```

---

## Task 4: `EventStore` interface + `SqliteEventStore` constructor

**Files:**
- Create: `packages/event-store/src/store/interface.ts`
- Create: `packages/event-store/src/store/sqlite.ts`
- Create: `packages/event-store/test/fixtures/sample-events.ts`
- Test: new cases in later tasks build on this

- [ ] **Step 1: Create `packages/event-store/test/fixtures/sample-events.ts`**

```ts
import type { AppendEventInput, AppendRequest } from '../../src/types/index.js';

export function makeEvent(
  overrides: Partial<AppendEventInput> = {},
): AppendEventInput {
  return {
    eventId: overrides.eventId ?? 'ev-' + Math.random().toString(36).slice(2, 10),
    eventType: overrides.eventType ?? 'IssueReport',
    aggregateType: overrides.aggregateType ?? 'Issue',
    aggregateId: overrides.aggregateId ?? '1',
    occurredAt: overrides.occurredAt ?? '2026-04-14T10:00:00.000Z',
    actor: overrides.actor ?? { kind: 'user', id: 'alice' },
    payload: overrides.payload ?? { before: null, after: { status: 'draft' } },
    schemaVersion: overrides.schemaVersion ?? 1,
  };
}

export function makeRequest(
  stream: string,
  events: AppendEventInput[],
  expectedVersion?: number,
): AppendRequest {
  return expectedVersion === undefined
    ? { stream, events }
    : { stream, expectedVersion, events };
}
```

- [ ] **Step 2: Create `packages/event-store/src/store/interface.ts`**

```ts
import type { EventEnvelope } from '../types/envelope.js';
import type { AppendRequest, AppendResult } from '../types/append.js';

export type ReadFromOptions = Readonly<{
  afterId: number;
  limit: number;
}>;

export interface EventStore {
  appendEvents(requests: readonly AppendRequest[]): AppendResult[];
  readStream(stream: string): EventEnvelope[];
  readFrom(opts: ReadFromOptions): EventEnvelope[];
  readCursor(relayId: string): number;
  writeCursor(relayId: string, lastEventId: number): void;
}
```

- [ ] **Step 3: Create `packages/event-store/src/store/sqlite.ts` (stub constructor only)**

```ts
import Database from 'better-sqlite3';
import type { Database as BetterSqliteDatabase } from 'better-sqlite3';
import type { EventEnvelope } from '../types/envelope.js';
import type { AppendRequest, AppendResult } from '../types/append.js';
import type { EventStore, ReadFromOptions } from './interface.js';
import { applyEventStoreSchema } from './schema.js';

export type SqliteEventStoreOptions = Readonly<{
  filename: string;
  applySchema?: boolean;
  busyTimeoutMs?: number;
}>;

export class SqliteEventStore implements EventStore {
  private readonly db: BetterSqliteDatabase;

  constructor(options: SqliteEventStoreOptions) {
    this.db = new Database(options.filename);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma(`busy_timeout = ${options.busyTimeoutMs ?? 5000}`);
    this.db.pragma('foreign_keys = ON');
    if (options.applySchema !== false) {
      applyEventStoreSchema(this.db);
    }
  }

  close(): void {
    this.db.close();
  }

  /** Test / advanced use only: direct handle for fixtures or custom queries. */
  rawDb(): BetterSqliteDatabase {
    return this.db;
  }

  appendEvents(_requests: readonly AppendRequest[]): AppendResult[] {
    throw new Error('not implemented — Task 5');
  }
  readStream(_stream: string): EventEnvelope[] {
    throw new Error('not implemented — Task 8');
  }
  readFrom(_opts: ReadFromOptions): EventEnvelope[] {
    throw new Error('not implemented — Task 9');
  }
  readCursor(_relayId: string): number {
    throw new Error('not implemented — Task 10');
  }
  writeCursor(_relayId: string, _lastEventId: number): void {
    throw new Error('not implemented — Task 10');
  }
}
```

- [ ] **Step 4: Typecheck**

Run: `pnpm -C packages/event-store run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/event-store/src/store/interface.ts \
        packages/event-store/src/store/sqlite.ts \
        packages/event-store/test/fixtures/sample-events.ts
git commit -m "feat(event-store): EventStore interface + SqliteEventStore skeleton"
```

---

## Task 5: `appendEvents` — single stream, version monotonic

**Files:**
- Modify: `packages/event-store/src/store/sqlite.ts`
- Test: `packages/event-store/test/unit/sqlite-append.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/event-store/test/unit/sqlite-append.test.ts`:

```ts
import { describe, it, expect, afterEach } from 'vitest';
import { SqliteEventStore } from '../../src/store/sqlite.js';
import { makeEvent, makeRequest } from '../fixtures/sample-events.js';

let store: SqliteEventStore | null = null;
afterEach(() => { store?.close(); store = null; });

function newStore(): SqliteEventStore {
  return new SqliteEventStore({ filename: ':memory:' });
}

describe('SqliteEventStore.appendEvents — single stream', () => {
  it('appends a single event to a new stream as version 1', () => {
    store = newStore();
    const [result] = store.appendEvents([
      makeRequest('Issue-1', [makeEvent({ eventId: 'e1' })]),
    ]);
    expect(result).toBeDefined();
    expect(result!.stream).toBe('Issue-1');
    expect(result!.lastVersion).toBe(1);
    expect(result!.appendedEvents).toHaveLength(1);
    expect(result!.appendedEvents[0]!.eventId).toBe('e1');
    expect(result!.appendedEvents[0]!.version).toBe(1);
    expect(result!.appendedEvents[0]!.id).toBeGreaterThan(0);
  });

  it('assigns version = previous max + 1 across append calls', () => {
    store = newStore();
    const [r1] = store.appendEvents([makeRequest('Issue-1', [makeEvent({ eventId: 'e1' })])]);
    const [r2] = store.appendEvents([makeRequest('Issue-1', [makeEvent({ eventId: 'e2' })])]);
    expect(r1!.lastVersion).toBe(1);
    expect(r2!.lastVersion).toBe(2);
    expect(r2!.appendedEvents[0]!.version).toBe(2);
  });

  it('assigns monotonically increasing versions within one request', () => {
    store = newStore();
    const [r] = store.appendEvents([
      makeRequest('Issue-1', [
        makeEvent({ eventId: 'e1' }),
        makeEvent({ eventId: 'e2' }),
        makeEvent({ eventId: 'e3' }),
      ]),
    ]);
    expect(r!.lastVersion).toBe(3);
    expect(r!.appendedEvents.map((a) => a.version)).toEqual([1, 2, 3]);
    const ids = r!.appendedEvents.map((a) => a.id);
    expect(ids[0]! < ids[1]! && ids[1]! < ids[2]!).toBe(true);
  });

  it('persists all envelope fields (raw readback)', () => {
    store = newStore();
    store.appendEvents([
      makeRequest('Issue-1', [
        makeEvent({
          eventId: 'e1',
          eventType: 'IssueReport',
          actor: { kind: 'user', id: 'alice' },
          payload: { before: null, after: { status: 'draft', title: 't' } },
          schemaVersion: 1,
        }),
      ]),
    ]);
    const row = store.rawDb()
      .prepare('SELECT * FROM event_log WHERE event_id = ?')
      .get('e1') as {
        stream: string;
        aggregate_type: string;
        aggregate_id: string;
        version: number;
        event_type: string;
        actor_kind: string | null;
        actor_id: string | null;
        occurred_at: string;
        payload_json: string;
        schema_version: number;
      };
    expect(row.stream).toBe('Issue-1');
    expect(row.aggregate_type).toBe('Issue');
    expect(row.aggregate_id).toBe('1');
    expect(row.version).toBe(1);
    expect(row.event_type).toBe('IssueReport');
    expect(row.actor_kind).toBe('user');
    expect(row.actor_id).toBe('alice');
    expect(JSON.parse(row.payload_json)).toEqual({ before: null, after: { status: 'draft', title: 't' } });
    expect(row.schema_version).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -C packages/event-store test -- --run test/unit/sqlite-append.test.ts`
Expected: FAIL — `appendEvents` throws "not implemented — Task 5".

- [ ] **Step 3: Replace `appendEvents` body in `packages/event-store/src/store/sqlite.ts`**

Replace the entire `appendEvents` method with:

```ts
  appendEvents(requests: readonly AppendRequest[]): AppendResult[] {
    const selectMax = this.db.prepare(
      'SELECT COALESCE(MAX(version), 0) AS v FROM event_log WHERE stream = ?',
    );
    const insert = this.db.prepare(`
      INSERT INTO event_log
        (stream, aggregate_type, aggregate_id, version, event_type, event_id,
         actor_kind, actor_id, occurred_at, payload_json, schema_version)
      VALUES
        (@stream, @aggregate_type, @aggregate_id, @version, @event_type, @event_id,
         @actor_kind, @actor_id, @occurred_at, @payload_json, @schema_version)
    `);

    const run = this.db.transaction((reqs: readonly AppendRequest[]): AppendResult[] => {
      const out: AppendResult[] = [];
      for (const req of reqs) {
        const row = selectMax.get(req.stream) as { v: number };
        const current = row.v;
        const appended: { eventId: string; version: number; id: number }[] = [];
        for (let i = 0; i < req.events.length; i++) {
          const e = req.events[i]!;
          const version = current + i + 1;
          const info = insert.run({
            stream: req.stream,
            aggregate_type: e.aggregateType,
            aggregate_id: e.aggregateId,
            version,
            event_type: e.eventType,
            event_id: e.eventId,
            actor_kind: e.actor?.kind ?? null,
            actor_id: e.actor?.id ?? null,
            occurred_at: e.occurredAt,
            payload_json: JSON.stringify(e.payload),
            schema_version: e.schemaVersion,
          });
          appended.push({
            eventId: e.eventId,
            version,
            id: Number(info.lastInsertRowid),
          });
        }
        out.push({
          stream: req.stream,
          lastVersion: current + req.events.length,
          appendedEvents: appended,
        });
      }
      return out;
    });

    return run.immediate(requests);
  }
```

(Note: `db.transaction(...).immediate(args)` runs the txn under `BEGIN IMMEDIATE`, which matches spec §5.3.)

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm -C packages/event-store test -- --run test/unit/sqlite-append.test.ts`
Expected: PASS (all 4 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/event-store/src/store/sqlite.ts \
        packages/event-store/test/unit/sqlite-append.test.ts
git commit -m "feat(event-store): appendEvents for single stream with version monotonic assignment"
```

---

## Task 6: `appendEvents` — multi-stream atomic append

**Files:**
- Test: `packages/event-store/test/unit/sqlite-append-multi.test.ts`

(No source changes: the existing implementation already iterates over `requests`. This task proves the atomicity contract and per-stream versioning across streams.)

- [ ] **Step 1: Write failing test**

Create `packages/event-store/test/unit/sqlite-append-multi.test.ts`:

```ts
import { describe, it, expect, afterEach } from 'vitest';
import { SqliteEventStore } from '../../src/store/sqlite.js';
import { makeEvent, makeRequest } from '../fixtures/sample-events.js';

let store: SqliteEventStore | null = null;
afterEach(() => { store?.close(); store = null; });

describe('SqliteEventStore.appendEvents — multi stream', () => {
  it('appends to two streams in one transaction, each with its own version sequence', () => {
    store = new SqliteEventStore({ filename: ':memory:' });
    const results = store.appendEvents([
      makeRequest('Issue-1', [
        makeEvent({ eventId: 'a', aggregateId: '1' }),
        makeEvent({ eventId: 'b', aggregateId: '1' }),
      ]),
      makeRequest('Issue-2', [
        makeEvent({ eventId: 'c', aggregateId: '2' }),
      ]),
    ]);
    expect(results).toHaveLength(2);
    expect(results[0]!.stream).toBe('Issue-1');
    expect(results[0]!.lastVersion).toBe(2);
    expect(results[1]!.stream).toBe('Issue-2');
    expect(results[1]!.lastVersion).toBe(1);
  });

  it('rolls back both streams when the second stream violates UNIQUE(event_id)', () => {
    store = new SqliteEventStore({ filename: ':memory:' });
    store.appendEvents([
      makeRequest('Issue-2', [makeEvent({ eventId: 'dup', aggregateId: '2' })]),
    ]);

    expect(() =>
      store.appendEvents([
        makeRequest('Issue-1', [makeEvent({ eventId: 'ok', aggregateId: '1' })]),
        makeRequest('Issue-2', [makeEvent({ eventId: 'dup', aggregateId: '2' })]),
      ]),
    ).toThrow(/UNIQUE/);

    // 'ok' must NOT have been persisted — txn rolled back
    const row = store.rawDb()
      .prepare('SELECT 1 FROM event_log WHERE event_id = ?')
      .get('ok');
    expect(row).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test**

Run: `pnpm -C packages/event-store test -- --run test/unit/sqlite-append-multi.test.ts`
Expected: PASS (the existing implementation satisfies both cases).

- [ ] **Step 3: Commit**

```bash
git add packages/event-store/test/unit/sqlite-append-multi.test.ts
git commit -m "test(event-store): verify multi-stream atomic append and rollback"
```

---

## Task 7: `appendEvents` — optimistic concurrency (`expectedVersion` + UNIQUE → ConcurrencyConflict)

**Files:**
- Modify: `packages/event-store/src/store/sqlite.ts`
- Test: `packages/event-store/test/unit/sqlite-append-concurrency.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/event-store/test/unit/sqlite-append-concurrency.test.ts`:

```ts
import { describe, it, expect, afterEach } from 'vitest';
import { SqliteEventStore } from '../../src/store/sqlite.js';
import { ConcurrencyConflict, DuplicateEventId } from '../../src/types/index.js';
import { makeEvent, makeRequest } from '../fixtures/sample-events.js';

let store: SqliteEventStore | null = null;
afterEach(() => { store?.close(); store = null; });

describe('SqliteEventStore.appendEvents — optimistic concurrency', () => {
  it('succeeds when expectedVersion matches current MAX(version)', () => {
    store = new SqliteEventStore({ filename: ':memory:' });
    store.appendEvents([makeRequest('Issue-1', [makeEvent({ eventId: 'a' })], 0)]);
    const [r2] = store.appendEvents([
      makeRequest('Issue-1', [makeEvent({ eventId: 'b' })], 1),
    ]);
    expect(r2!.lastVersion).toBe(2);
  });

  it('throws ConcurrencyConflict when expectedVersion does not match current', () => {
    store = new SqliteEventStore({ filename: ':memory:' });
    store.appendEvents([makeRequest('Issue-1', [makeEvent({ eventId: 'a' })], 0)]);
    try {
      store.appendEvents([
        makeRequest('Issue-1', [makeEvent({ eventId: 'b' })], 0 /* stale */),
      ]);
      expect.fail('expected ConcurrencyConflict');
    } catch (e) {
      expect(e).toBeInstanceOf(ConcurrencyConflict);
      const c = e as ConcurrencyConflict;
      expect(c.stream).toBe('Issue-1');
      expect(c.expectedVersion).toBe(0);
      expect(c.actualVersion).toBe(1);
    }
  });

  it('translates UNIQUE(stream, version) SQLite error into ConcurrencyConflict', () => {
    store = new SqliteEventStore({ filename: ':memory:' });
    // Pre-seed version 1 via raw SQL (simulates a concurrent writer that
    // committed between our SELECT MAX and INSERT).
    store.rawDb().prepare(`
      INSERT INTO event_log (stream, aggregate_type, aggregate_id, version, event_type,
                             event_id, actor_kind, actor_id, occurred_at, payload_json, schema_version)
      VALUES ('Issue-1','Issue','1',1,'X','seed',NULL,NULL,'2026-01-01T00:00:00Z','{}',1)
    `).run();

    // Patch selectMax to lie about the current version so INSERT hits UNIQUE.
    // Instead, simpler: bypass the pre-check (no expectedVersion) but have
    // appendEvents still compute (current=1)+1=2 — no conflict. So we cannot
    // easily reach the UNIQUE path via the public surface in single-writer mode.
    // We instead verify the error mapping helper directly.
    const { mapSqliteError } = require('../../src/store/sqlite.js');
    const err = new Error('UNIQUE constraint failed: event_log.stream, event_log.version');
    (err as NodeJS.ErrnoException).code = 'SQLITE_CONSTRAINT_UNIQUE';
    const mapped = mapSqliteError(err, 'Issue-1', undefined, 99);
    expect(mapped).toBeInstanceOf(ConcurrencyConflict);
  });

  it('translates UNIQUE(event_id) SQLite error into DuplicateEventId', () => {
    store = new SqliteEventStore({ filename: ':memory:' });
    store.appendEvents([makeRequest('Issue-1', [makeEvent({ eventId: 'dup' })])]);
    try {
      store.appendEvents([makeRequest('Issue-2', [makeEvent({ eventId: 'dup', aggregateId: '2' })])]);
      expect.fail('expected DuplicateEventId');
    } catch (e) {
      expect(e).toBeInstanceOf(DuplicateEventId);
      expect((e as DuplicateEventId).eventId).toBe('dup');
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -C packages/event-store test -- --run test/unit/sqlite-append-concurrency.test.ts`
Expected: FAIL — ConcurrencyConflict not thrown, `mapSqliteError` not exported, DuplicateEventId not thrown.

- [ ] **Step 3: Update `packages/event-store/src/store/sqlite.ts`**

Replace the `appendEvents` method and add the helper. The method body becomes:

```ts
  appendEvents(requests: readonly AppendRequest[]): AppendResult[] {
    const selectMax = this.db.prepare(
      'SELECT COALESCE(MAX(version), 0) AS v FROM event_log WHERE stream = ?',
    );
    const insert = this.db.prepare(`
      INSERT INTO event_log
        (stream, aggregate_type, aggregate_id, version, event_type, event_id,
         actor_kind, actor_id, occurred_at, payload_json, schema_version)
      VALUES
        (@stream, @aggregate_type, @aggregate_id, @version, @event_type, @event_id,
         @actor_kind, @actor_id, @occurred_at, @payload_json, @schema_version)
    `);

    const run = this.db.transaction((reqs: readonly AppendRequest[]): AppendResult[] => {
      const out: AppendResult[] = [];
      for (const req of reqs) {
        const { v: current } = selectMax.get(req.stream) as { v: number };
        if (req.expectedVersion !== undefined && req.expectedVersion !== current) {
          throw new ConcurrencyConflict(req.stream, req.expectedVersion, current);
        }
        const appended: { eventId: string; version: number; id: number }[] = [];
        for (let i = 0; i < req.events.length; i++) {
          const e = req.events[i]!;
          const version = current + i + 1;
          let info: Database.RunResult;
          try {
            info = insert.run({
              stream: req.stream,
              aggregate_type: e.aggregateType,
              aggregate_id: e.aggregateId,
              version,
              event_type: e.eventType,
              event_id: e.eventId,
              actor_kind: e.actor?.kind ?? null,
              actor_id: e.actor?.id ?? null,
              occurred_at: e.occurredAt,
              payload_json: JSON.stringify(e.payload),
              schema_version: e.schemaVersion,
            });
          } catch (err) {
            throw mapSqliteError(err, req.stream, req.expectedVersion, version, e.eventId);
          }
          appended.push({
            eventId: e.eventId,
            version,
            id: Number(info.lastInsertRowid),
          });
        }
        out.push({
          stream: req.stream,
          lastVersion: current + req.events.length,
          appendedEvents: appended,
        });
      }
      return out;
    });

    return run.immediate(requests);
  }
```

Add imports at the top:

```ts
import { ConcurrencyConflict, DuplicateEventId } from '../types/errors.js';
```

And add the exported helper at the bottom of the file:

```ts
export function mapSqliteError(
  err: unknown,
  stream: string,
  expectedVersion: number | undefined,
  attemptedVersion: number,
  eventId?: string,
): Error {
  if (!(err instanceof Error)) return new Error(String(err));
  const code = (err as NodeJS.ErrnoException).code ?? '';
  const msg = err.message;
  if (code === 'SQLITE_CONSTRAINT_UNIQUE' || code === 'SQLITE_CONSTRAINT') {
    if (/event_id/.test(msg)) {
      return new DuplicateEventId(eventId ?? '<unknown>');
    }
    if (/stream.*version|version.*stream/.test(msg)) {
      return new ConcurrencyConflict(stream, expectedVersion, attemptedVersion);
    }
  }
  return err;
}
```

The test uses `require` for dynamic import of `mapSqliteError` — Vitest supports CJS-interop for this case. If the project config disallows it, switch the test to `import { mapSqliteError } from '../../src/store/sqlite.js';`.

- [ ] **Step 4: Switch the test import to static ESM**

Replace the `const { mapSqliteError } = require(...)` line in the test with a top-of-file import:

```ts
import { mapSqliteError } from '../../src/store/sqlite.js';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm -C packages/event-store test -- --run test/unit/sqlite-append-concurrency.test.ts`
Expected: PASS (all 4 tests).

- [ ] **Step 6: Re-run prior append tests to ensure no regression**

Run: `pnpm -C packages/event-store test -- --run test/unit/sqlite-append.test.ts test/unit/sqlite-append-multi.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/event-store/src/store/sqlite.ts \
        packages/event-store/test/unit/sqlite-append-concurrency.test.ts
git commit -m "feat(event-store): optimistic concurrency (expectedVersion + UNIQUE → typed errors)"
```

---

## Task 8: `readStream` + row-to-envelope mapper

**Files:**
- Create: `packages/event-store/src/store/row-mapper.ts`
- Modify: `packages/event-store/src/store/sqlite.ts`
- Test: `packages/event-store/test/unit/sqlite-read.test.ts`

- [ ] **Step 1: Write failing test (readStream part)**

Create `packages/event-store/test/unit/sqlite-read.test.ts`:

```ts
import { describe, it, expect, afterEach } from 'vitest';
import { SqliteEventStore } from '../../src/store/sqlite.js';
import { makeEvent, makeRequest } from '../fixtures/sample-events.js';

let store: SqliteEventStore | null = null;
afterEach(() => { store?.close(); store = null; });

describe('SqliteEventStore.readStream', () => {
  it('returns empty array for unknown stream', () => {
    store = new SqliteEventStore({ filename: ':memory:' });
    expect(store.readStream('Issue-999')).toEqual([]);
  });

  it('returns only the requested stream, in version order', () => {
    store = new SqliteEventStore({ filename: ':memory:' });
    store.appendEvents([
      makeRequest('Issue-1', [
        makeEvent({ eventId: 'a', aggregateId: '1' }),
        makeEvent({ eventId: 'b', aggregateId: '1' }),
      ]),
      makeRequest('Issue-2', [
        makeEvent({ eventId: 'c', aggregateId: '2' }),
      ]),
    ]);

    const s1 = store.readStream('Issue-1');
    expect(s1.map((e) => e.eventId)).toEqual(['a', 'b']);
    expect(s1.map((e) => e.version)).toEqual([1, 2]);
    expect(s1[0]!.aggregateType).toBe('Issue');
    expect(s1[0]!.stream).toBe('Issue-1');

    const s2 = store.readStream('Issue-2');
    expect(s2.map((e) => e.eventId)).toEqual(['c']);
  });

  it('deserializes payload_json and reconstructs actor', () => {
    store = new SqliteEventStore({ filename: ':memory:' });
    store.appendEvents([
      makeRequest('Issue-1', [
        makeEvent({
          eventId: 'a',
          actor: { kind: 'service', id: 'migrator' },
          payload: { before: null, after: { status: 'draft', title: 'hello' } },
        }),
      ]),
    ]);
    const [env] = store.readStream('Issue-1');
    expect(env!.actor).toEqual({ kind: 'service', id: 'migrator' });
    expect(env!.payload).toEqual({ before: null, after: { status: 'draft', title: 'hello' } });
    expect(env!.schemaVersion).toBe(1);
  });

  it('returns actor=null when actor_kind/actor_id are NULL', () => {
    store = new SqliteEventStore({ filename: ':memory:' });
    store.appendEvents([
      makeRequest('Issue-1', [makeEvent({ eventId: 'a', actor: null })]),
    ]);
    const [env] = store.readStream('Issue-1');
    expect(env!.actor).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -C packages/event-store test -- --run test/unit/sqlite-read.test.ts`
Expected: FAIL — `readStream` throws "not implemented".

- [ ] **Step 3: Create `packages/event-store/src/store/row-mapper.ts`**

```ts
import type { EventEnvelope } from '../types/envelope.js';
import type { ActorRef } from '../types/actor.js';

export type EventLogRow = Readonly<{
  id: number;
  stream: string;
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
}>;

export function rowToEnvelope(row: EventLogRow): EventEnvelope {
  return {
    eventId: row.event_id,
    eventType: row.event_type,
    aggregateType: row.aggregate_type,
    aggregateId: row.aggregate_id,
    stream: row.stream,
    version: row.version,
    occurredAt: row.occurred_at,
    actor: toActor(row.actor_kind, row.actor_id),
    payload: JSON.parse(row.payload_json) as unknown,
    schemaVersion: row.schema_version,
  };
}

function toActor(kind: string | null, id: string | null): ActorRef | null {
  if (kind === null || id === null) return null;
  if (kind === 'user' || kind === 'system' || kind === 'service') {
    return { kind, id };
  }
  return null;
}
```

- [ ] **Step 4: Replace `readStream` in `packages/event-store/src/store/sqlite.ts`**

Add import:
```ts
import { rowToEnvelope, type EventLogRow } from './row-mapper.js';
```

Replace the `readStream` method:
```ts
  readStream(stream: string): EventEnvelope[] {
    const rows = this.db
      .prepare('SELECT * FROM event_log WHERE stream = ? ORDER BY version ASC')
      .all(stream) as EventLogRow[];
    return rows.map(rowToEnvelope);
  }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm -C packages/event-store test -- --run test/unit/sqlite-read.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add packages/event-store/src/store/row-mapper.ts \
        packages/event-store/src/store/sqlite.ts \
        packages/event-store/test/unit/sqlite-read.test.ts
git commit -m "feat(event-store): readStream + row-to-envelope mapper"
```

---

## Task 9: `readFrom` — global cursor read

**Files:**
- Modify: `packages/event-store/src/store/sqlite.ts`
- Modify (append cases to): `packages/event-store/test/unit/sqlite-read.test.ts`

- [ ] **Step 1: Add failing test cases**

Append to `packages/event-store/test/unit/sqlite-read.test.ts`:

```ts
describe('SqliteEventStore.readFrom', () => {
  it('returns events with id > afterId in id order, capped by limit', () => {
    store = new SqliteEventStore({ filename: ':memory:' });
    store.appendEvents([
      makeRequest('Issue-1', [makeEvent({ eventId: 'a', aggregateId: '1' })]),
      makeRequest('Issue-2', [makeEvent({ eventId: 'b', aggregateId: '2' })]),
      makeRequest('Issue-1', [makeEvent({ eventId: 'c', aggregateId: '1' })]),
    ]);

    const all = store.readFrom({ afterId: 0, limit: 10 });
    expect(all.map((e) => e.eventId)).toEqual(['a', 'b', 'c']);

    const capped = store.readFrom({ afterId: 0, limit: 2 });
    expect(capped.map((e) => e.eventId)).toEqual(['a', 'b']);

    // get the last stored id via raw and continue
    const lastId = (store.rawDb().prepare('SELECT MAX(id) AS m FROM event_log').get() as { m: number }).m;
    const after = store.readFrom({ afterId: lastId - 1, limit: 10 });
    expect(after.map((e) => e.eventId)).toEqual(['c']);
  });

  it('returns empty array when no events beyond cursor', () => {
    store = new SqliteEventStore({ filename: ':memory:' });
    expect(store.readFrom({ afterId: 0, limit: 100 })).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `pnpm -C packages/event-store test -- --run test/unit/sqlite-read.test.ts`
Expected: 2 new tests FAIL — `readFrom` throws "not implemented".

- [ ] **Step 3: Replace `readFrom` in `packages/event-store/src/store/sqlite.ts`**

```ts
  readFrom(opts: ReadFromOptions): EventEnvelope[] {
    const rows = this.db
      .prepare('SELECT * FROM event_log WHERE id > ? ORDER BY id ASC LIMIT ?')
      .all(opts.afterId, opts.limit) as EventLogRow[];
    return rows.map(rowToEnvelope);
  }
```

- [ ] **Step 4: Run tests**

Run: `pnpm -C packages/event-store test -- --run test/unit/sqlite-read.test.ts`
Expected: PASS (all 6 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/event-store/src/store/sqlite.ts \
        packages/event-store/test/unit/sqlite-read.test.ts
git commit -m "feat(event-store): readFrom for global id-ordered cursor reads"
```

---

## Task 10: `publish_cursor` — read / write

**Files:**
- Modify: `packages/event-store/src/store/sqlite.ts`
- Test: `packages/event-store/test/unit/cursor.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/event-store/test/unit/cursor.test.ts`:

```ts
import { describe, it, expect, afterEach } from 'vitest';
import { SqliteEventStore } from '../../src/store/sqlite.js';

let store: SqliteEventStore | null = null;
afterEach(() => { store?.close(); store = null; });

describe('publish_cursor', () => {
  it('readCursor returns 0 when no row exists for this relayId', () => {
    store = new SqliteEventStore({ filename: ':memory:' });
    expect(store.readCursor('kafka-main')).toBe(0);
  });

  it('writeCursor inserts then updates; readCursor sees the latest value', () => {
    store = new SqliteEventStore({ filename: ':memory:' });
    store.writeCursor('kafka-main', 42);
    expect(store.readCursor('kafka-main')).toBe(42);
    store.writeCursor('kafka-main', 100);
    expect(store.readCursor('kafka-main')).toBe(100);
  });

  it('cursors are isolated by relayId', () => {
    store = new SqliteEventStore({ filename: ':memory:' });
    store.writeCursor('kafka-main', 10);
    store.writeCursor('replica-eu', 20);
    expect(store.readCursor('kafka-main')).toBe(10);
    expect(store.readCursor('replica-eu')).toBe(20);
  });

  it('writeCursor rejects non-monotonic values', () => {
    store = new SqliteEventStore({ filename: ':memory:' });
    store.writeCursor('kafka-main', 50);
    expect(() => store.writeCursor('kafka-main', 10)).toThrow(/monotonic/i);
    expect(store.readCursor('kafka-main')).toBe(50);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `pnpm -C packages/event-store test -- --run test/unit/cursor.test.ts`
Expected: FAIL — cursor methods throw "not implemented".

- [ ] **Step 3: Replace cursor methods in `packages/event-store/src/store/sqlite.ts`**

```ts
  readCursor(relayId: string): number {
    const row = this.db
      .prepare('SELECT last_event_id AS v FROM publish_cursor WHERE relay_id = ?')
      .get(relayId) as { v: number } | undefined;
    return row?.v ?? 0;
  }

  writeCursor(relayId: string, lastEventId: number): void {
    const existing = this.readCursor(relayId);
    if (lastEventId < existing) {
      throw new Error(
        `publish_cursor[${relayId}] must be monotonic: tried ${lastEventId} < existing ${existing}`,
      );
    }
    this.db.prepare(`
      INSERT INTO publish_cursor (relay_id, last_event_id, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(relay_id) DO UPDATE SET
        last_event_id = excluded.last_event_id,
        updated_at = excluded.updated_at
    `).run(relayId, lastEventId, new Date().toISOString());
  }
```

- [ ] **Step 4: Run test to verify pass**

Run: `pnpm -C packages/event-store test -- --run test/unit/cursor.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/event-store/src/store/sqlite.ts \
        packages/event-store/test/unit/cursor.test.ts
git commit -m "feat(event-store): publish_cursor read/write with monotonic guard"
```

---

## Task 11: `KafkaProducer` abstraction + in-memory test double

**Files:**
- Create: `packages/event-store/src/kafka/producer.ts`
- Create: `packages/event-store/src/kafka/in-memory.ts`
- Test: `packages/event-store/test/unit/kafka-in-memory.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/event-store/test/unit/kafka-in-memory.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createInMemoryKafkaProducer } from '../../src/kafka/in-memory.js';

describe('createInMemoryKafkaProducer', () => {
  it('records every sent message in order', async () => {
    const kafka = createInMemoryKafkaProducer();
    await kafka.send({ topic: 't', key: 'k1', headers: { a: '1' }, value: 'v1' });
    await kafka.send({ topic: 't', key: 'k1', headers: { a: '2' }, value: 'v2' });
    expect(kafka.sent.map((m) => m.value)).toEqual(['v1', 'v2']);
    expect(kafka.sent[0]!.headers.a).toBe('1');
  });

  it('supports failNext() to simulate transient Kafka outage', async () => {
    const kafka = createInMemoryKafkaProducer();
    kafka.failNext(2, new Error('kafka down'));
    await expect(kafka.send({ topic: 't', key: 'k', headers: {}, value: 'v1' }))
      .rejects.toThrow(/kafka down/);
    await expect(kafka.send({ topic: 't', key: 'k', headers: {}, value: 'v1' }))
      .rejects.toThrow(/kafka down/);
    await kafka.send({ topic: 't', key: 'k', headers: {}, value: 'v1' });
    expect(kafka.sent.map((m) => m.value)).toEqual(['v1']);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `pnpm -C packages/event-store test -- --run test/unit/kafka-in-memory.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Create `packages/event-store/src/kafka/producer.ts`**

```ts
export type KafkaMessage = Readonly<{
  topic: string;
  key: string;
  headers: Readonly<Record<string, string>>;
  value: string;
}>;

export interface KafkaProducer {
  send(message: KafkaMessage): Promise<void>;
}
```

- [ ] **Step 4: Create `packages/event-store/src/kafka/in-memory.ts`**

```ts
import type { KafkaMessage, KafkaProducer } from './producer.js';

export type InMemoryKafkaProducer = KafkaProducer & {
  readonly sent: readonly KafkaMessage[];
  /** Cause the next `n` send() calls to reject with `err`. */
  failNext(n: number, err: Error): void;
  /** Clear sent log and pending failures (useful between test cases). */
  reset(): void;
};

export function createInMemoryKafkaProducer(): InMemoryKafkaProducer {
  const sent: KafkaMessage[] = [];
  let failuresRemaining = 0;
  let failureError: Error | null = null;

  const producer: InMemoryKafkaProducer = {
    sent,
    async send(message: KafkaMessage): Promise<void> {
      if (failuresRemaining > 0 && failureError) {
        failuresRemaining -= 1;
        throw failureError;
      }
      sent.push(message);
    },
    failNext(n: number, err: Error): void {
      failuresRemaining = n;
      failureError = err;
    },
    reset(): void {
      sent.length = 0;
      failuresRemaining = 0;
      failureError = null;
    },
  };
  return producer;
}
```

- [ ] **Step 5: Run test to verify pass**

Run: `pnpm -C packages/event-store test -- --run test/unit/kafka-in-memory.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add packages/event-store/src/kafka \
        packages/event-store/test/unit/kafka-in-memory.test.ts
git commit -m "feat(event-store): KafkaProducer interface + in-memory test double"
```

---

## Task 12: `createRelay` — polling loop, topic mapper, at-least-once

**Files:**
- Create: `packages/event-store/src/relay/topic.ts`
- Create: `packages/event-store/src/relay/loop.ts`
- Test: `packages/event-store/test/unit/relay.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/event-store/test/unit/relay.test.ts`:

```ts
import { describe, it, expect, afterEach } from 'vitest';
import { SqliteEventStore } from '../../src/store/sqlite.js';
import { createInMemoryKafkaProducer } from '../../src/kafka/in-memory.js';
import { createRelay } from '../../src/relay/loop.js';
import { defaultTopicOf } from '../../src/relay/topic.js';
import { makeEvent, makeRequest } from '../fixtures/sample-events.js';

let store: SqliteEventStore | null = null;
afterEach(() => { store?.close(); store = null; });

async function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('defaultTopicOf', () => {
  it('returns rntme.<lower>.v1 for a PascalCase aggregate type', () => {
    expect(defaultTopicOf('Issue')).toBe('rntme.issue.v1');
    expect(defaultTopicOf('SprintItem')).toBe('rntme.sprintitem.v1');
  });
});

describe('createRelay', () => {
  it('publishes all events in event_log in id order and advances publish_cursor', async () => {
    store = new SqliteEventStore({ filename: ':memory:' });
    const kafka = createInMemoryKafkaProducer();
    const relay = createRelay({
      store,
      kafka,
      cursorId: 'kafka-main',
      pollIntervalMs: 5,
      batchSize: 100,
    });

    store.appendEvents([
      makeRequest('Issue-1', [
        makeEvent({ eventId: 'a', aggregateId: '1' }),
        makeEvent({ eventId: 'b', aggregateId: '1' }),
      ]),
      makeRequest('Issue-2', [
        makeEvent({ eventId: 'c', aggregateId: '2' }),
      ]),
    ]);

    relay.start();
    // Spin until all 3 events are published or timeout.
    const deadline = Date.now() + 2000;
    while (kafka.sent.length < 3 && Date.now() < deadline) {
      await wait(5);
    }
    await relay.stop();

    expect(kafka.sent.map((m) => m.key)).toEqual(['Issue-1', 'Issue-1', 'Issue-2']);
    expect(kafka.sent.map((m) => m.topic)).toEqual([
      'rntme.issue.v1', 'rntme.issue.v1', 'rntme.issue.v1',
    ]);
    const values = kafka.sent.map((m) => JSON.parse(m.value) as { eventId: string; version: number });
    expect(values.map((v) => v.eventId)).toEqual(['a', 'b', 'c']);
    expect(values[0]!.version).toBe(1);
    expect(values[1]!.version).toBe(2);
    expect(values[2]!.version).toBe(1);

    // Cursor advanced beyond the last id
    const cursor = store.readCursor('kafka-main');
    expect(cursor).toBeGreaterThanOrEqual(3);
  });

  it('sends event-id, event-type, schema-version as Kafka headers', async () => {
    store = new SqliteEventStore({ filename: ':memory:' });
    const kafka = createInMemoryKafkaProducer();
    const relay = createRelay({
      store, kafka, cursorId: 'kafka-main', pollIntervalMs: 5, batchSize: 100,
    });
    store.appendEvents([makeRequest('Issue-1', [
      makeEvent({ eventId: 'a', eventType: 'IssueReport', schemaVersion: 1 }),
    ])]);
    relay.start();
    const deadline = Date.now() + 1000;
    while (kafka.sent.length < 1 && Date.now() < deadline) await wait(5);
    await relay.stop();

    const m = kafka.sent[0]!;
    expect(m.headers['event-id']).toBe('a');
    expect(m.headers['event-type']).toBe('IssueReport');
    expect(m.headers['schema-version']).toBe('1');
  });

  it('retries after a transient Kafka failure (at-least-once, cursor only advances on success)', async () => {
    store = new SqliteEventStore({ filename: ':memory:' });
    const kafka = createInMemoryKafkaProducer();
    const relay = createRelay({
      store, kafka, cursorId: 'kafka-main', pollIntervalMs: 5, batchSize: 100,
    });

    store.appendEvents([makeRequest('Issue-1', [makeEvent({ eventId: 'a' })])]);

    // First send() will fail; relay should retry and eventually publish.
    kafka.failNext(1, new Error('kafka transient'));

    relay.start();
    const deadline = Date.now() + 2000;
    while (kafka.sent.length < 1 && Date.now() < deadline) await wait(5);
    await relay.stop();

    expect(kafka.sent).toHaveLength(1);
    expect(store.readCursor('kafka-main')).toBeGreaterThanOrEqual(1);
  });

  it('stop() resolves and prevents further publication', async () => {
    store = new SqliteEventStore({ filename: ':memory:' });
    const kafka = createInMemoryKafkaProducer();
    const relay = createRelay({
      store, kafka, cursorId: 'kafka-main', pollIntervalMs: 5, batchSize: 100,
    });
    relay.start();
    await relay.stop();

    store.appendEvents([makeRequest('Issue-1', [makeEvent({ eventId: 'a' })])]);
    await wait(30);
    expect(kafka.sent).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `pnpm -C packages/event-store test -- --run test/unit/relay.test.ts`
Expected: FAIL — modules do not exist.

- [ ] **Step 3: Create `packages/event-store/src/relay/topic.ts`**

```ts
export function defaultTopicOf(aggregateType: string): string {
  return `rntme.${aggregateType.toLowerCase()}.v1`;
}
```

- [ ] **Step 4: Create `packages/event-store/src/relay/loop.ts`**

```ts
import type { EventStore } from '../store/interface.js';
import type { EventEnvelope } from '../types/envelope.js';
import type { KafkaProducer } from '../kafka/producer.js';
import { defaultTopicOf } from './topic.js';

export type RelayOptions = Readonly<{
  store: EventStore;
  kafka: KafkaProducer;
  cursorId: string;
  pollIntervalMs?: number;
  batchSize?: number;
  topicOf?: (aggregateType: string) => string;
  /** Ceiling (ms) for exponential backoff after a Kafka failure. Default 1000. */
  maxBackoffMs?: number;
  /** Called on every thrown send error; returned value short-circuits retry. Default: log + continue retry. */
  onSendError?: (err: unknown, envelope: EventEnvelope) => void;
}>;

export type Relay = Readonly<{
  start: () => void;
  stop: () => Promise<void>;
}>;

export function createRelay(opts: RelayOptions): Relay {
  const poll = opts.pollIntervalMs ?? 100;
  const batch = opts.batchSize ?? 500;
  const topicOf = opts.topicOf ?? defaultTopicOf;
  const maxBackoff = opts.maxBackoffMs ?? 1000;
  const onErr = opts.onSendError ?? ((err) => {
    // eslint-disable-next-line no-console
    console.error('[relay] kafka send failed, will retry:', err);
  });

  let running = false;
  let donePromise: Promise<void> | null = null;

  async function loop(): Promise<void> {
    while (running) {
      const cursor = opts.store.readCursor(opts.cursorId);
      const envelopes = opts.store.readFrom({ afterId: cursor, limit: batch });

      if (envelopes.length === 0) {
        await sleep(poll);
        continue;
      }

      let highestDeliveredId = cursor;
      let backoff = 10;
      for (const env of envelopes) {
        if (!running) break;
        // eslint-disable-next-line no-constant-condition
        while (true) {
          try {
            await opts.kafka.send({
              topic: topicOf(env.aggregateType),
              key: env.stream,
              headers: {
                'event-id': env.eventId,
                'event-type': env.eventType,
                'schema-version': String(env.schemaVersion),
              },
              value: JSON.stringify(env),
            });
            break;
          } catch (err) {
            onErr(err, env);
            await sleep(backoff);
            backoff = Math.min(backoff * 2, maxBackoff);
            if (!running) return;
          }
        }
        highestDeliveredId = envelopeId(env, highestDeliveredId);
      }
      if (highestDeliveredId > cursor) {
        opts.store.writeCursor(opts.cursorId, highestDeliveredId);
      }
    }
  }

  return {
    start(): void {
      if (running) return;
      running = true;
      donePromise = loop().catch((err) => {
        // eslint-disable-next-line no-console
        console.error('[relay] loop crashed:', err);
      });
    },
    async stop(): Promise<void> {
      running = false;
      if (donePromise) await donePromise;
      donePromise = null;
    },
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * The envelope's `id` (INTEGER PRIMARY KEY from event_log) is the relay cursor unit,
 * not `version`. We retrieve it from the envelope — but EventEnvelope does not expose
 * it (§3.2 envelope is the wire format). The relay needs it to advance publish_cursor.
 * To bridge cleanly without leaking DB identity into the wire envelope, `readFrom`
 * returns envelopes in ascending `id` order and the cursor advances monotonically by
 * tracking "how many events we've processed since the starting cursor". We compute
 * the new cursor as `startingCursor + processedCount`, valid because AUTOINCREMENT
 * guarantees `id` values are contiguous enough that `cursor + N` is >= the true max
 * (the relay may leapfrog past holes harmlessly — the next readFrom simply returns
 * events with id > new cursor). This helper exists purely to make the intent explicit.
 */
function envelopeId(_env: EventEnvelope, _previousMax: number): number {
  throw new Error('relay must not compute cursor from envelope — see Step 5');
}
```

Note: the `envelopeId` placeholder intentionally fails; Step 5 replaces the approach with one that threads the raw `id` from the store. We split the fix into Step 5 so the diff to `loop.ts` is reviewable.

- [ ] **Step 5: Adjust `readFrom` contract to return both envelope and row id, and wire cursor**

The cleanest fix: expose a second low-level method on `EventStore` that returns rows with their `id`, so the relay can advance cursor to the exact last published `id`. Update `packages/event-store/src/store/interface.ts`:

```ts
import type { EventEnvelope } from '../types/envelope.js';
import type { AppendRequest, AppendResult } from '../types/append.js';

export type ReadFromOptions = Readonly<{
  afterId: number;
  limit: number;
}>;

export type EventRecord = Readonly<{
  id: number;
  envelope: EventEnvelope;
}>;

export interface EventStore {
  appendEvents(requests: readonly AppendRequest[]): AppendResult[];
  readStream(stream: string): EventEnvelope[];
  readFrom(opts: ReadFromOptions): EventEnvelope[];
  readRecordsFrom(opts: ReadFromOptions): EventRecord[];
  readCursor(relayId: string): number;
  writeCursor(relayId: string, lastEventId: number): void;
}
```

In `packages/event-store/src/store/sqlite.ts` add the new method (keep `readFrom` as-is for callers that only want envelopes):

```ts
  readRecordsFrom(opts: ReadFromOptions): EventRecord[] {
    const rows = this.db
      .prepare('SELECT * FROM event_log WHERE id > ? ORDER BY id ASC LIMIT ?')
      .all(opts.afterId, opts.limit) as EventLogRow[];
    return rows.map((row) => ({ id: row.id, envelope: rowToEnvelope(row) }));
  }
```

And at the top of the same file, add to imports:
```ts
import type { EventRecord } from './interface.js';
```

Now replace `packages/event-store/src/relay/loop.ts` entirely with:

```ts
import type { EventStore, EventRecord } from '../store/interface.js';
import type { EventEnvelope } from '../types/envelope.js';
import type { KafkaProducer } from '../kafka/producer.js';
import { defaultTopicOf } from './topic.js';

export type RelayOptions = Readonly<{
  store: EventStore;
  kafka: KafkaProducer;
  cursorId: string;
  pollIntervalMs?: number;
  batchSize?: number;
  topicOf?: (aggregateType: string) => string;
  maxBackoffMs?: number;
  onSendError?: (err: unknown, envelope: EventEnvelope) => void;
}>;

export type Relay = Readonly<{
  start: () => void;
  stop: () => Promise<void>;
}>;

export function createRelay(opts: RelayOptions): Relay {
  const poll = opts.pollIntervalMs ?? 100;
  const batch = opts.batchSize ?? 500;
  const topicOf = opts.topicOf ?? defaultTopicOf;
  const maxBackoff = opts.maxBackoffMs ?? 1000;
  const onErr = opts.onSendError ?? ((err) => {
    // eslint-disable-next-line no-console
    console.error('[relay] kafka send failed, will retry:', err);
  });

  let running = false;
  let donePromise: Promise<void> | null = null;

  async function loop(): Promise<void> {
    while (running) {
      const cursor = opts.store.readCursor(opts.cursorId);
      const records: EventRecord[] = opts.store.readRecordsFrom({
        afterId: cursor, limit: batch,
      });

      if (records.length === 0) {
        await sleep(poll);
        continue;
      }

      let highestDeliveredId = cursor;
      for (const rec of records) {
        if (!running) break;
        let backoff = 10;
        // eslint-disable-next-line no-constant-condition
        while (true) {
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
            break;
          } catch (err) {
            onErr(err, rec.envelope);
            await sleep(backoff);
            backoff = Math.min(backoff * 2, maxBackoff);
            if (!running) return;
          }
        }
        highestDeliveredId = rec.id;
      }
      if (highestDeliveredId > cursor) {
        opts.store.writeCursor(opts.cursorId, highestDeliveredId);
      }
    }
  }

  return {
    start(): void {
      if (running) return;
      running = true;
      donePromise = loop().catch((err) => {
        // eslint-disable-next-line no-console
        console.error('[relay] loop crashed:', err);
      });
    },
    async stop(): Promise<void> {
      running = false;
      if (donePromise) await donePromise;
      donePromise = null;
    },
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
```

- [ ] **Step 6: Run test to verify pass**

Run: `pnpm -C packages/event-store test -- --run test/unit/relay.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 7: Re-run the full suite to ensure no regression**

Run: `pnpm -C packages/event-store test`
Expected: PASS (all tests across all files).

- [ ] **Step 8: Commit**

```bash
git add packages/event-store/src/relay \
        packages/event-store/src/store/interface.ts \
        packages/event-store/src/store/sqlite.ts \
        packages/event-store/test/unit/relay.test.ts
git commit -m "feat(event-store): createRelay polling loop with at-least-once delivery"
```

---

## Task 13: Public surface + end-to-end smoke test

**Files:**
- Modify: `packages/event-store/src/index.ts`
- Create: `packages/event-store/test/smoke.test.ts`

- [ ] **Step 1: Write failing smoke test**

Create `packages/event-store/test/smoke.test.ts`:

```ts
import { describe, it, expect, afterEach } from 'vitest';
import {
  VERSION,
  SqliteEventStore,
  createInMemoryKafkaProducer,
  createRelay,
  defaultTopicOf,
  ConcurrencyConflict,
} from '../src/index.js';
import type { EventEnvelope, AppendRequest } from '../src/index.js';
import { makeEvent, makeRequest } from './fixtures/sample-events.js';

let store: SqliteEventStore | null = null;
afterEach(() => { store?.close(); store = null; });

async function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

describe('smoke: @rntme/event-store end-to-end', () => {
  it('exports VERSION', () => {
    expect(VERSION).toBe('0.0.0');
  });

  it('append → relay → kafka: full issue lifecycle preserves per-stream order', async () => {
    store = new SqliteEventStore({ filename: ':memory:' });
    const kafka = createInMemoryKafkaProducer();
    const relay = createRelay({
      store, kafka, cursorId: 'kafka-main', pollIntervalMs: 5, batchSize: 50,
    });

    // Two interleaved aggregates; per-stream order must be preserved in Kafka.
    const ops: AppendRequest[] = [
      makeRequest('Issue-1', [makeEvent({ eventId: 'i1-report', eventType: 'IssueReport', aggregateId: '1' })]),
      makeRequest('Issue-2', [makeEvent({ eventId: 'i2-report', eventType: 'IssueReport', aggregateId: '2' })]),
      makeRequest('Issue-1', [makeEvent({ eventId: 'i1-submit', eventType: 'IssueSubmit', aggregateId: '1' })]),
      makeRequest('Issue-1', [makeEvent({ eventId: 'i1-assign', eventType: 'IssueAssign', aggregateId: '1' })]),
      makeRequest('Issue-2', [makeEvent({ eventId: 'i2-submit', eventType: 'IssueSubmit', aggregateId: '2' })]),
    ];
    for (const op of ops) store.appendEvents([op]);

    relay.start();
    const deadline = Date.now() + 3000;
    while (kafka.sent.length < 5 && Date.now() < deadline) await wait(5);
    await relay.stop();

    expect(kafka.sent).toHaveLength(5);
    const envelopes: EventEnvelope[] = kafka.sent.map((m) => JSON.parse(m.value) as EventEnvelope);

    // Per-stream order within each aggregate's sub-sequence
    const issue1 = envelopes.filter((e) => e.stream === 'Issue-1').map((e) => e.eventId);
    expect(issue1).toEqual(['i1-report', 'i1-submit', 'i1-assign']);
    const issue2 = envelopes.filter((e) => e.stream === 'Issue-2').map((e) => e.eventId);
    expect(issue2).toEqual(['i2-report', 'i2-submit']);

    // Kafka partition key = stream
    expect(kafka.sent.every((m) => m.key === JSON.parse(m.value).stream)).toBe(true);

    // Topic naming
    expect(kafka.sent.every((m) => m.topic === defaultTopicOf('Issue'))).toBe(true);

    // Cursor ended at the last event id
    const lastId = (store.rawDb().prepare('SELECT MAX(id) AS m FROM event_log').get() as { m: number }).m;
    expect(store.readCursor('kafka-main')).toBe(lastId);
  });

  it('replay via readStream returns all appended events in version order (event-sourced aggregate replay)', () => {
    store = new SqliteEventStore({ filename: ':memory:' });
    store.appendEvents([makeRequest('Issue-1', [makeEvent({ eventId: 'a' })], 0)]);
    store.appendEvents([makeRequest('Issue-1', [makeEvent({ eventId: 'b' })], 1)]);
    store.appendEvents([makeRequest('Issue-1', [makeEvent({ eventId: 'c' })], 2)]);

    const events = store.readStream('Issue-1');
    expect(events.map((e) => [e.eventId, e.version])).toEqual([
      ['a', 1], ['b', 2], ['c', 3],
    ]);
  });

  it('ConcurrencyConflict bubbles up as a typed error for the command runtime to catch', () => {
    store = new SqliteEventStore({ filename: ':memory:' });
    store.appendEvents([makeRequest('Issue-1', [makeEvent({ eventId: 'a' })], 0)]);
    expect(() =>
      store.appendEvents([makeRequest('Issue-1', [makeEvent({ eventId: 'b' })], 0)]),
    ).toThrow(ConcurrencyConflict);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `pnpm -C packages/event-store test -- --run test/smoke.test.ts`
Expected: FAIL — public re-exports missing from `src/index.ts`.

- [ ] **Step 3: Replace `packages/event-store/src/index.ts`**

```ts
export const VERSION = '0.0.0';

// Types
export type { ActorRef } from './types/actor.js';
export type { EventEnvelope } from './types/envelope.js';
export type {
  AppendEventInput,
  AppendRequest,
  AppendResult,
  AppendedEvent,
} from './types/append.js';
export {
  EventStoreError,
  ConcurrencyConflict,
  DuplicateEventId,
} from './types/errors.js';
export type { EventStoreErrorCode } from './types/errors.js';

// Store
export type {
  EventStore,
  ReadFromOptions,
  EventRecord,
} from './store/interface.js';
export {
  SqliteEventStore,
  mapSqliteError,
} from './store/sqlite.js';
export type { SqliteEventStoreOptions } from './store/sqlite.js';
export { applyEventStoreSchema } from './store/schema.js';
export { rowToEnvelope } from './store/row-mapper.js';
export type { EventLogRow } from './store/row-mapper.js';

// Kafka
export type { KafkaMessage, KafkaProducer } from './kafka/producer.js';
export {
  createInMemoryKafkaProducer,
} from './kafka/in-memory.js';
export type { InMemoryKafkaProducer } from './kafka/in-memory.js';

// Relay
export { createRelay } from './relay/loop.js';
export type { Relay, RelayOptions } from './relay/loop.js';
export { defaultTopicOf } from './relay/topic.js';
```

- [ ] **Step 4: Run smoke test**

Run: `pnpm -C packages/event-store test -- --run test/smoke.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Run full suite, lint, and typecheck**

Run:
```
pnpm -C packages/event-store test
pnpm -C packages/event-store run lint
pnpm -C packages/event-store run typecheck
pnpm -C packages/event-store run build
```
Expected: all exit 0.

- [ ] **Step 6: Update `packages/event-store/README.md` with a minimal quick-start**

Append below the existing bullet list:

````markdown

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
````

- [ ] **Step 7: Commit**

```bash
git add packages/event-store/src/index.ts \
        packages/event-store/test/smoke.test.ts \
        packages/event-store/README.md
git commit -m "feat(event-store): public API + end-to-end smoke test"
```

---

## Self-Review Notes

Coverage check against spec sections:
- §3.2 EventEnvelope — Task 2 (`types/envelope.ts`), reconstructed by `rowToEnvelope` in Task 8.
- §3.3 ActorRef — Task 2 (`types/actor.ts`, redeclared to keep package standalone).
- §3.5 Stream naming — caller supplies `stream`; store does not impose format. Verified by smoke test using `Issue-1`, `Issue-2`.
- §3.6 Optimistic concurrency — Task 7 (`expectedVersion` + UNIQUE mapping).
- §5.1 event_log schema — Task 3.
- §5.2 publish_cursor — Task 3 + Task 10.
- §5.3 Append logic — Tasks 5–7 (BEGIN IMMEDIATE via `db.transaction(...).immediate()`, monotonic version, conflict mapping).
- §5.4 Relay process — Task 12 (polling loop, headers, at-least-once via retry before cursor advance; cursor advances to exact row `id`, not processed-count, thanks to `readRecordsFrom`).
- §5.5 Kafka topology — `defaultTopicOf` in Task 12; partition key = `stream`; headers carry `event-id`/`event-type`/`schema-version`.
- §5.6 Consistency guarantees — covered structurally by Tasks 5–12 and verified in smoke.
- §5.7 Retry / error cases — `SQLITE_BUSY` handled by `busy_timeout` pragma (Task 4); `UNIQUE(stream, version)` → `ConcurrencyConflict` (Task 7); `UNIQUE(event_id)` → `DuplicateEventId` (Task 7); Kafka failure → retry loop with exponential backoff capped at `maxBackoffMs` (Task 12).

Placeholder scan: all steps include complete code, no TBD/TODO. Test code provided in every "write failing test" step. Exact commands given for every run step. Exact commit messages provided.

Type / signature consistency:
- `EventStore` interface and `SqliteEventStore` agree on method names.
- `EventRecord` type introduced in Task 12 Step 5 updates both `interface.ts` and `sqlite.ts`; public re-export added in Task 13.
- `mapSqliteError` used internally and re-exported for integration tests downstream.

Known simplification vs. spec §5.4:
- The spec's relay snippet publishes `row.payload_json` as Kafka `value` with selected headers. The consumer in §6.5 parses the full envelope out of `msg.value`. To reconcile, the relay publishes `JSON.stringify(envelope)` (full envelope) as the Kafka value and additionally carries the three convenience headers. This matches the consumer contract and is an explicit deviation from §5.4 that keeps §6.5 valid without requiring the consumer to reassemble envelopes from headers + DB.

---

## Execution Handoff

Plan complete and saved to `docs/history/plans/historical/2026-04-14-rntme-event-store.md`. Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
