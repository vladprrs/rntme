# @rntme/projection-consumer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Создать standalone пакет `@rntme/projection-consumer` — Kafka-consumer loop, который идемпотентно применяет события event-store к SQLite-материализованным entity-mirror проекциям, описанным в QSM. Пакет предоставляет `KafkaConsumer` абстракцию (in-memory реализация в комплекте), `ApplyPlan` компиляцию (per-eventType INSERT/UPDATE SQL из `@rntme/qsm` `ProjectionHandlerSpec` + `@rntme/pdm` метаданных), идемпотентный `applyEvent`, DDL-bootstrap helper и `createProjectionConsumer` loop с batch-транзакциями и offset-commit после `COMMIT`.

**Architecture:** Layered pipeline в стиле `@rntme/event-store`. Три слоя: (1) `types/` + `kafka/` — абстракция consumer-а и in-memory реализация для тестов; (2) `store/` + `apply/` — DDL bootstrap, compile ApplyPlan (pure), execute applyEvent (runtime) с тремя idempotency guards: last_event_version check → INSERT ON CONFLICT DO UPDATE WHERE excluded.version > current / UPDATE WHERE version < new; (3) `consumer.ts` — `for await (batch of kafka)` → `BEGIN IMMEDIATE` → apply each → `COMMIT` → `commitOffsets(batch)`. Планирование (compile SQL из `ProjectionHandlerSpec`) отделено от runtime (bind params из envelope + execute) — та же монета, что prepared statements. Пакет держит workspace-deps только на `@rntme/pdm` + `@rntme/qsm` + `@rntme/event-store` (тип `EventEnvelope`), Kafka-клиента как зависимость не тянет.

**Tech Stack:** TypeScript (strict, ES2022, verbatim module syntax), `better-sqlite3` для runtime SQLite, Vitest для тестов, in-memory Kafka fake для unit/smoke.

**Related spec:** `docs/superpowers/specs/2026-04-14-mutations-design.md` §6 (projection consumer + QSM store), §5.1 (event_log → envelope), §2.6 (generated fields), §7.7 (package layout), §7.8 item 5 (rollout order).

**Dependency context:** Пятый пакет в implementation rollout (§7.8). Зависит от `@rntme/pdm` (task 1, уже сделан), `@rntme/qsm` (task 2, уже сделан), `@rntme/event-store` (task 3, уже сделан — нужен только для типа `EventEnvelope`). Independent от task 4 (graph-ir-compiler mutations) и task 6 (bindings). Unblock-ит: end-to-end cycle demo (§7.5) после того, как bindings-http (task 7) вызовет command runtime и события попадут через relay → kafka → consumer → projection_issue.

**MVP scope vs tier 2:**
- В scope: `backing: "entity-mirror"` проекции; single-column aggregate-keys (integer/string); creation transitions (INSERT ON CONFLICT DO UPDATE); non-creation transitions (UPDATE WHERE version<); self-loops (update с теми же affects); generated fields (`createdAt`, `updatedAt`, `actor`) на INSERT и UPDATE; idempotent re-apply; skip-on-unknown-aggregate (entity без mirror); batch-транзакция + offset-commit; in-memory `KafkaConsumer` для тестов.
- Вне scope: composite-key aggregates (будет ошибка компиляции ApplyPlan с чётким кодом, исправление — tier 2); `backing: "derived"` проекции (QSM уже их reject-ит); poison-message / DLQ (throw bubbles); replay tooling для пересборки с offset=0 (можно руками, но не автоматизировано); multi-instance consumer coordination (это Kafka consumer group concern, не этой библиотеки); upcasting старых schemaVersion.

---

## File Layout

```
packages/projection-consumer/
  package.json
  tsconfig.json
  tsconfig.check.json
  eslint.config.mjs
  vitest.config.ts
  README.md
  src/
    index.ts                              # public API re-exports
    types/
      consumer.ts                         # KafkaConsumer, KafkaBatch, ConsumedMessage
      apply.ts                            # ApplyPlan, CompiledHandler, ColumnBinding, ApplyResult
      errors.ts                           # ApplyCompileError (thrown at plan-compile time)
      index.ts                            # re-exports
    kafka/
      in-memory.ts                        # createInMemoryKafkaConsumer() — test harness
    store/
      bootstrap.ts                        # bootstrapProjections(db, ddlSpecs)
    apply/
      compile.ts                          # compileApplyPlan({ pdm, qsm, events }): ApplyPlan
      bind.ts                             # bindValues(handler, envelope): readonly unknown[]
      apply-event.ts                      # applyEvent(db, plan, envelope): ApplyResult
    consumer.ts                           # createProjectionConsumer({ kafka, plan, db }): { start, stop }
  test/
    fixtures/
      issue-tracker.pdm.json              # копия из qsm/test/fixtures
      issue-tracker.qsm.json              # копия из qsm/test/fixtures
      envelopes.ts                        # makeEnvelope(), ISSUE_LIFECYCLE
    unit/
      bootstrap.test.ts                   # DDL runs, idempotency columns present
      compile-insert.test.ts              # creation handler → INSERT ON CONFLICT SQL shape
      compile-update.test.ts              # non-creation handler → UPDATE SQL shape
      compile-composite-key.test.ts       # composite key → ApplyCompileError
      compile-unknown-aggregate.test.ts   # entity без mirror игнорируется при compile
      bind-insert.test.ts                 # key + payload + generated + null-filler binding
      bind-update.test.ts                 # setColumns + updatedAt + idempotency binding
      apply-insert.test.ts                # creation event → row in projection_issue
      apply-update.test.ts                # non-creation event → columns updated
      apply-idempotent.test.ts            # re-apply no-op; out-of-order safe
      apply-unknown-aggregate.test.ts     # envelope без mirror → skipped
      kafka-in-memory.test.ts             # produce / consume / commit semantics
      consumer-loop.test.ts               # batch TX, commit order (DB COMMIT → kafka commitOffsets)
      consumer-rollback.test.ts           # throw during apply → ROLLBACK + no offset commit
    smoke.test.ts                         # end-to-end: PDM → QSM → DDL → compile → consumer → Issue lifecycle projection state
```

---

## Task 1: Scaffold package

**Files:**
- Create: `packages/projection-consumer/package.json`
- Create: `packages/projection-consumer/tsconfig.json`
- Create: `packages/projection-consumer/tsconfig.check.json`
- Create: `packages/projection-consumer/eslint.config.mjs`
- Create: `packages/projection-consumer/vitest.config.ts`
- Create: `packages/projection-consumer/README.md`
- Create: `packages/projection-consumer/src/index.ts`
- Create: `packages/projection-consumer/test/smoke.test.ts`

- [ ] **Step 1: Create `packages/projection-consumer/package.json`**

```json
{
  "name": "@rntme/projection-consumer",
  "version": "0.0.0",
  "type": "module",
  "private": true,
  "description": "Idempotent Kafka → SQLite projection consumer for the event-sourced read-side. Applies event envelopes to QSM entity-mirror projections using handler specs derived from PDM stateMachine.",
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
    "@rntme/event-store": "workspace:*",
    "@rntme/pdm": "workspace:*",
    "@rntme/qsm": "workspace:*",
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

- [ ] **Step 2: Create `packages/projection-consumer/tsconfig.json`**

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

- [ ] **Step 3: Create `packages/projection-consumer/tsconfig.check.json`**

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

- [ ] **Step 4: Create `packages/projection-consumer/eslint.config.mjs`**

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

- [ ] **Step 5: Create `packages/projection-consumer/vitest.config.ts`**

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

- [ ] **Step 6: Create `packages/projection-consumer/README.md`**

```markdown
# @rntme/projection-consumer

Kafka → SQLite projection consumer for the event-sourced read-side.

Provides:
- `KafkaConsumer` abstraction + in-memory test implementation.
- `compileApplyPlan({ pdm, qsm, events })` — pure compile of INSERT/UPDATE SQL + parameter bindings from QSM `ProjectionHandlerSpec` plus PDM field metadata (handles generated columns, nullable fillers, idempotency columns).
- `applyEvent(db, plan, envelope)` — idempotent upsert with three protection layers (spec §6.5): `last_event_version` pre-check, INSERT `ON CONFLICT DO UPDATE WHERE excluded.version > current`, UPDATE `WHERE version < new`.
- `createProjectionConsumer({ kafka, plan, db })` — batch-transaction loop: `BEGIN IMMEDIATE` → apply each → `COMMIT` → `commitOffsets(batch)`.

See `docs/superpowers/specs/2026-04-14-mutations-design.md` §6 for spec.
```

- [ ] **Step 7: Create placeholder `packages/projection-consumer/src/index.ts`**

```ts
export const VERSION = '0.0.0';
```

- [ ] **Step 8: Create scaffold `packages/projection-consumer/test/smoke.test.ts` (fleshed out in Task 9)**

```ts
import { describe, expect, it } from 'vitest';
import { VERSION } from '../src/index.js';

describe('smoke: @rntme/projection-consumer scaffold', () => {
  it('exports VERSION', () => {
    expect(VERSION).toBe('0.0.0');
  });
});
```

- [ ] **Step 9: Install deps + verify scaffolding**

Run from repo root:
```bash
pnpm install
pnpm --filter @rntme/projection-consumer build
pnpm --filter @rntme/projection-consumer test
pnpm --filter @rntme/projection-consumer typecheck
pnpm --filter @rntme/projection-consumer lint
```
Expected: all four exit 0; `dist/index.js` + `dist/index.d.ts` generated; vitest reports 1 passing test.

- [ ] **Step 10: Commit**

```bash
git add packages/projection-consumer pnpm-lock.yaml
git commit -m "feat(projection-consumer): scaffold @rntme/projection-consumer package"
```

---

## Task 2: KafkaConsumer abstraction + error types

**Files:**
- Create: `packages/projection-consumer/src/types/consumer.ts`
- Create: `packages/projection-consumer/src/types/errors.ts`
- Create: `packages/projection-consumer/src/types/index.ts`

No tests for this task — pure type definitions. Types are exercised by Tasks 3+ via the `KafkaConsumer` contract and by `ApplyCompileError` being thrown in Task 4.

- [ ] **Step 1: Create `packages/projection-consumer/src/types/consumer.ts`**

```ts
import type { EventEnvelope } from '@rntme/event-store';

/**
 * One message read from Kafka. The value is the JSON-encoded envelope
 * published by `@rntme/event-store` relay. `offset` is opaque to this package
 * and handed back unchanged to `commitOffsets`.
 */
export type ConsumedMessage = Readonly<{
  topic: string;
  partition: number;
  offset: string;
  key: string;              // = envelope.stream (relay partition key)
  envelope: EventEnvelope;
}>;

/**
 * A batch of messages as yielded by one poll of the underlying Kafka client.
 * `commitOffsets(batch)` persists the high-water mark *after* the projection
 * transaction has committed.
 */
export type KafkaBatch = Readonly<{
  messages: readonly ConsumedMessage[];
}>;

/**
 * Minimal async-iterator + offset-commit contract. Callers obtain a
 * `KafkaConsumer` from an adapter (in-memory for tests, real Kafka client for
 * prod) and hand it to `createProjectionConsumer`.
 *
 * Implementations MUST:
 * - Yield each poll as a `KafkaBatch` (empty batches allowed; the loop sleeps).
 * - Keep offsets uncommitted until `commitOffsets` is awaited.
 * - Exit the async iterator cleanly when `stop()` or equivalent is invoked.
 */
export interface KafkaConsumer {
  [Symbol.asyncIterator](): AsyncIterator<KafkaBatch>;
  commitOffsets(batch: KafkaBatch): Promise<void>;
}
```

- [ ] **Step 2: Create `packages/projection-consumer/src/types/errors.ts`**

```ts
/**
 * Thrown at compile-time by `compileApplyPlan` when a projection spec cannot
 * be realised in MVP scope (e.g. composite aggregate keys) or when PDM/QSM
 * are internally inconsistent (entity missing a column that a handler spec
 * claims to update — should have been caught upstream).
 */
export class ApplyCompileError extends Error {
  public readonly code: ApplyCompileErrorCode;
  public readonly detail: Readonly<Record<string, string>>;
  constructor(code: ApplyCompileErrorCode, detail: Record<string, string>, message: string) {
    super(message);
    this.name = 'ApplyCompileError';
    this.code = code;
    this.detail = { ...detail };
  }
}

export type ApplyCompileErrorCode =
  | 'PC_COMPOSITE_KEY_NOT_SUPPORTED'
  | 'PC_COLUMN_SOURCE_UNRESOLVABLE'
  | 'PC_MISSING_ENTITY_FIELD';
```

- [ ] **Step 3: Create `packages/projection-consumer/src/types/index.ts`**

```ts
export type { KafkaBatch, ConsumedMessage, KafkaConsumer } from './consumer.js';
export { ApplyCompileError } from './errors.js';
export type { ApplyCompileErrorCode } from './errors.js';
```

- [ ] **Step 4: Re-export from `src/index.ts`**

Replace contents of `packages/projection-consumer/src/index.ts`:

```ts
export const VERSION = '0.0.0';

export type { KafkaBatch, ConsumedMessage, KafkaConsumer } from './types/consumer.js';
export { ApplyCompileError } from './types/errors.js';
export type { ApplyCompileErrorCode } from './types/errors.js';
```

- [ ] **Step 5: Verify build + typecheck**

```bash
pnpm --filter @rntme/projection-consumer build
pnpm --filter @rntme/projection-consumer typecheck
pnpm --filter @rntme/projection-consumer test
```
Expected: all pass; smoke test still green.

- [ ] **Step 6: Commit**

```bash
git add packages/projection-consumer/src
git commit -m "feat(projection-consumer): KafkaConsumer abstraction + ApplyCompileError types"
```

---

## Task 3: In-memory Kafka consumer (test harness)

**Files:**
- Create: `packages/projection-consumer/src/kafka/in-memory.ts`
- Create: `packages/projection-consumer/test/unit/kafka-in-memory.test.ts`

- [ ] **Step 1: Write failing test `packages/projection-consumer/test/unit/kafka-in-memory.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { createInMemoryKafkaConsumer } from '../../src/kafka/in-memory.js';
import type { EventEnvelope } from '@rntme/event-store';

function envelope(overrides: Partial<EventEnvelope> = {}): EventEnvelope {
  return {
    eventId: overrides.eventId ?? 'e1',
    eventType: overrides.eventType ?? 'IssueReport',
    aggregateType: overrides.aggregateType ?? 'Issue',
    aggregateId: overrides.aggregateId ?? '1',
    stream: overrides.stream ?? 'Issue-1',
    version: overrides.version ?? 1,
    occurredAt: overrides.occurredAt ?? '2026-04-14T10:00:00.000Z',
    actor: overrides.actor ?? { kind: 'user', id: 'alice' },
    payload: overrides.payload ?? { before: null, after: { status: 'draft' } },
    schemaVersion: overrides.schemaVersion ?? 1,
  };
}

describe('createInMemoryKafkaConsumer', () => {
  it('produces yields batches until stop() is called', async () => {
    const consumer = createInMemoryKafkaConsumer();
    consumer.produce(envelope({ eventId: 'a' }));
    consumer.produce(envelope({ eventId: 'b' }));

    const iter = consumer[Symbol.asyncIterator]();
    const first = await iter.next();
    expect(first.done).toBe(false);
    expect(first.value!.messages.map((m) => m.envelope.eventId)).toEqual(['a', 'b']);

    consumer.stop();
    const done = await iter.next();
    expect(done.done).toBe(true);
  });

  it('subsequent produce between batches is delivered in the next yield', async () => {
    const consumer = createInMemoryKafkaConsumer();
    consumer.produce(envelope({ eventId: 'a' }));
    const iter = consumer[Symbol.asyncIterator]();

    const b1 = await iter.next();
    expect(b1.value!.messages.map((m) => m.envelope.eventId)).toEqual(['a']);

    consumer.produce(envelope({ eventId: 'b' }));
    const b2 = await iter.next();
    expect(b2.value!.messages.map((m) => m.envelope.eventId)).toEqual(['b']);

    consumer.stop();
  });

  it('commitOffsets records the last commit per batch and exposes committed list', async () => {
    const consumer = createInMemoryKafkaConsumer();
    consumer.produce(envelope({ eventId: 'a' }));
    const iter = consumer[Symbol.asyncIterator]();
    const batch = (await iter.next()).value!;
    await consumer.commitOffsets(batch);
    expect(consumer.committed.map((m) => m.envelope.eventId)).toEqual(['a']);
    consumer.stop();
  });

  it('assigns monotonic offsets and partition=0 by default', async () => {
    const consumer = createInMemoryKafkaConsumer();
    consumer.produce(envelope({ eventId: 'a' }));
    consumer.produce(envelope({ eventId: 'b' }));
    const iter = consumer[Symbol.asyncIterator]();
    const batch = (await iter.next()).value!;
    expect(batch.messages.map((m) => m.offset)).toEqual(['0', '1']);
    expect(batch.messages.every((m) => m.partition === 0)).toBe(true);
    consumer.stop();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @rntme/projection-consumer test -- kafka-in-memory
```
Expected: FAIL — `createInMemoryKafkaConsumer is not a function` or module not found.

- [ ] **Step 3: Create `packages/projection-consumer/src/kafka/in-memory.ts`**

```ts
import type { EventEnvelope } from '@rntme/event-store';
import type { ConsumedMessage, KafkaBatch, KafkaConsumer } from '../types/consumer.js';

export type InMemoryKafkaConsumer = KafkaConsumer & Readonly<{
  /** Enqueue one envelope; delivered in the next yielded batch. */
  produce(envelope: EventEnvelope): void;
  /** Close the async iterator (next() resolves to { done: true }). */
  stop(): void;
  /** Messages passed to commitOffsets so far, in commit order. */
  readonly committed: readonly ConsumedMessage[];
}>;

export function createInMemoryKafkaConsumer(options: {
  topicOf?: (aggregateType: string) => string;
  pollIntervalMs?: number;
} = {}): InMemoryKafkaConsumer {
  const topicOf = options.topicOf ?? ((t: string) => `rntme.${t.toLowerCase()}.v1`);
  const poll = options.pollIntervalMs ?? 2;
  const queue: ConsumedMessage[] = [];
  const committed: ConsumedMessage[] = [];
  let nextOffset = 0;
  let stopped = false;

  async function* iterate(): AsyncGenerator<KafkaBatch, void, void> {
    while (!stopped) {
      if (queue.length === 0) {
        await new Promise((r) => setTimeout(r, poll));
        continue;
      }
      const messages = queue.splice(0, queue.length);
      yield { messages };
    }
  }

  return {
    [Symbol.asyncIterator]: () => iterate(),
    async commitOffsets(batch: KafkaBatch): Promise<void> {
      committed.push(...batch.messages);
    },
    produce(envelope: EventEnvelope): void {
      queue.push({
        topic: topicOf(envelope.aggregateType),
        partition: 0,
        offset: String(nextOffset++),
        key: envelope.stream,
        envelope,
      });
    },
    stop(): void {
      stopped = true;
    },
    get committed(): readonly ConsumedMessage[] {
      return committed;
    },
  };
}
```

- [ ] **Step 4: Re-export from `src/index.ts`**

Add to `packages/projection-consumer/src/index.ts`:

```ts
export { createInMemoryKafkaConsumer } from './kafka/in-memory.js';
export type { InMemoryKafkaConsumer } from './kafka/in-memory.js';
```

- [ ] **Step 5: Run test to verify it passes**

```bash
pnpm --filter @rntme/projection-consumer test -- kafka-in-memory
```
Expected: all 4 tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/projection-consumer/src packages/projection-consumer/test
git commit -m "feat(projection-consumer): in-memory KafkaConsumer for tests"
```

---

## Task 4: DDL bootstrap helper

**Files:**
- Create: `packages/projection-consumer/src/store/bootstrap.ts`
- Create: `packages/projection-consumer/test/fixtures/issue-tracker.pdm.json` (copy from `packages/qsm/test/fixtures/issue-tracker.pdm.json`)
- Create: `packages/projection-consumer/test/fixtures/issue-tracker.qsm.json` (copy from `packages/qsm/test/fixtures/issue-tracker.qsm.json`)
- Create: `packages/projection-consumer/test/unit/bootstrap.test.ts`

- [ ] **Step 1: Copy PDM/QSM fixtures**

```bash
cp packages/qsm/test/fixtures/issue-tracker.pdm.json packages/projection-consumer/test/fixtures/issue-tracker.pdm.json
cp packages/qsm/test/fixtures/issue-tracker.qsm.json packages/projection-consumer/test/fixtures/issue-tracker.qsm.json
```

- [ ] **Step 2: Write failing test `packages/projection-consumer/test/unit/bootstrap.test.ts`**

```ts
import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import {
  parsePdm, validatePdm, createPdmResolver,
} from '@rntme/pdm';
import {
  parseQsm, validateQsm, generateProjectionDdl,
} from '@rntme/qsm';
import { bootstrapProjections } from '../../src/store/bootstrap.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(here, '..', 'fixtures');

function setup() {
  const pdmRaw = parsePdm(readFileSync(join(fixtureDir, 'issue-tracker.pdm.json'), 'utf8'));
  if (!pdmRaw.ok) throw new Error('pdm parse');
  const pdm = validatePdm(pdmRaw.value);
  if (!pdm.ok) throw new Error('pdm validate');
  const resolver = createPdmResolver(pdm.value);

  const qsmRaw = parseQsm(readFileSync(join(fixtureDir, 'issue-tracker.qsm.json'), 'utf8'));
  if (!qsmRaw.ok) throw new Error('qsm parse');
  const qsm = validateQsm(qsmRaw.value, resolver);
  if (!qsm.ok) throw new Error('qsm validate');

  return { ddls: generateProjectionDdl(qsm.value, resolver) };
}

let db: Database.Database | null = null;
afterEach(() => { db?.close(); db = null; });

describe('bootstrapProjections', () => {
  it('creates one table per projection with the declared name', () => {
    db = new Database(':memory:');
    const { ddls } = setup();
    bootstrapProjections(db, ddls);
    const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all() as { name: string }[]).map((r) => r.name);
    expect(tables).toContain('projection_issue');
  });

  it('projection table has all mirror columns plus idempotency columns', () => {
    db = new Database(':memory:');
    const { ddls } = setup();
    bootstrapProjections(db, ddls);
    const cols = (db.prepare("PRAGMA table_info('projection_issue')").all() as { name: string }[]).map((c) => c.name);
    expect(cols).toEqual(expect.arrayContaining([
      'id', 'project_id', 'reporter_id', 'assignee_id', 'sprint_id',
      'title', 'status', 'priority', 'story_points',
      'resolved_at', 'created_at',
      'last_event_id', 'last_event_version', 'applied_at',
    ]));
  });

  it('creates declared indexes', () => {
    db = new Database(':memory:');
    const { ddls } = setup();
    bootstrapProjections(db, ddls);
    const idx = (db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'").all() as { name: string }[]).map((r) => r.name);
    expect(idx).toContain('idx_projection_issue_status');
  });

  it('is idempotent when run twice (uses IF NOT EXISTS or wraps in try/catch)', () => {
    db = new Database(':memory:');
    const { ddls } = setup();
    bootstrapProjections(db, ddls);
    expect(() => bootstrapProjections(db!, ddls)).not.toThrow();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
pnpm --filter @rntme/projection-consumer test -- bootstrap
```
Expected: FAIL — `bootstrapProjections is not defined`.

- [ ] **Step 4: Create `packages/projection-consumer/src/store/bootstrap.ts`**

```ts
import type { Database as BetterSqliteDatabase } from 'better-sqlite3';
import type { ProjectionDdlSpec } from '@rntme/qsm';

/**
 * Apply DDL for every projection in `ddls`. Safe to call repeatedly (wraps
 * CREATE TABLE / CREATE INDEX statements in `IF NOT EXISTS` via string
 * rewriting — the QSM-emitted SQL uses plain `CREATE TABLE` / `CREATE INDEX`
 * which we normalize here). Each DDL runs in its own implicit txn.
 */
export function bootstrapProjections(
  db: BetterSqliteDatabase,
  ddls: readonly ProjectionDdlSpec[],
): void {
  for (const spec of ddls) {
    db.exec(toIfNotExists(spec.createTableSql));
    for (const idx of spec.createIndexSql) {
      db.exec(toIfNotExists(idx));
    }
  }
}

function toIfNotExists(sql: string): string {
  return sql
    .replace(/^CREATE TABLE(?!\s+IF NOT EXISTS)/i, 'CREATE TABLE IF NOT EXISTS')
    .replace(/^CREATE INDEX(?!\s+IF NOT EXISTS)/i, 'CREATE INDEX IF NOT EXISTS');
}
```

- [ ] **Step 5: Re-export from `src/index.ts`**

Add:

```ts
export { bootstrapProjections } from './store/bootstrap.js';
```

- [ ] **Step 6: Run test to verify it passes**

```bash
pnpm --filter @rntme/projection-consumer test -- bootstrap
```
Expected: all 4 tests pass.

- [ ] **Step 7: Commit**

```bash
git add packages/projection-consumer/src packages/projection-consumer/test
git commit -m "feat(projection-consumer): DDL bootstrap via ProjectionDdlSpec"
```

---

## Task 5: Compile ApplyPlan — INSERT SQL (creation handlers)

**Files:**
- Create: `packages/projection-consumer/src/types/apply.ts`
- Create: `packages/projection-consumer/src/apply/compile.ts`
- Create: `packages/projection-consumer/test/unit/compile-insert.test.ts`
- Create: `packages/projection-consumer/test/unit/compile-composite-key.test.ts`
- Create: `packages/projection-consumer/test/unit/compile-unknown-aggregate.test.ts`

This task lays out `ApplyPlan` + `CompiledHandler` types + `compileApplyPlan` for creation (INSERT) handlers. Non-creation (UPDATE) is added in Task 6.

- [ ] **Step 1: Create `packages/projection-consumer/src/types/apply.ts`**

```ts
/**
 * Source for one SQL-bound value when applying an event. Resolved at compile
 * time (once per projection/handler), consumed at runtime (once per envelope).
 *
 * - `aggregateId`       — `envelope.aggregateId`, coerced to the entity's key type
 * - `payloadField`      — `envelope.payload.after[fieldName]`
 * - `generatedOccurred` — `envelope.occurredAt` (for `generated: "createdAt" | "updatedAt"`)
 * - `generatedActor`    — `envelope.actor?.id ?? null`
 * - `nullable`          — literal NULL (column nullable + not in affects + not generated)
 * - `eventId`           — idempotency column `last_event_id`
 * - `eventVersion`      — idempotency column `last_event_version`
 * - `appliedAt`         — idempotency column `applied_at` = new Date().toISOString()
 */
export type ColumnBinding =
  | Readonly<{ kind: 'aggregateId'; sqlType: 'INTEGER' | 'TEXT' | 'REAL' }>
  | Readonly<{ kind: 'payloadField'; fieldName: string }>
  | Readonly<{ kind: 'generatedOccurred' }>
  | Readonly<{ kind: 'generatedActor' }>
  | Readonly<{ kind: 'nullable' }>
  | Readonly<{ kind: 'eventId' }>
  | Readonly<{ kind: 'eventVersion' }>
  | Readonly<{ kind: 'appliedAt' }>;

/**
 * Compiled SQL + param bindings for one (projectionName, eventType) pair.
 * `kind: 'insert'` is used for creation transitions (payload.before === null),
 * `kind: 'update'` for all others (including self-loops).
 */
export type CompiledHandler =
  | Readonly<{
      kind: 'insert';
      projectionName: string;
      tableName: string;
      aggregateType: string;
      eventType: string;
      /** Single-element key column for MVP; composite keys rejected at compile. */
      keyColumn: string;
      sql: string;
      bindings: readonly ColumnBinding[];
    }>
  | Readonly<{
      kind: 'update';
      projectionName: string;
      tableName: string;
      aggregateType: string;
      eventType: string;
      keyColumn: string;
      sql: string;
      bindings: readonly ColumnBinding[];
    }>;

/** Compiled plan: eventType → handler. */
export type ApplyPlan = Readonly<{
  handlersByEventType: ReadonlyMap<string, CompiledHandler>;
  /** Lookup: aggregateType → whether a mirror projection exists. */
  mirrorsByAggregate: ReadonlyMap<string, CompiledHandler['tableName']>;
}>;

export type ApplyResult = 'applied' | 'skipped-no-mirror' | 'skipped-older-version';
```

- [ ] **Step 2: Write failing test `packages/projection-consumer/test/unit/compile-insert.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parsePdm, validatePdm, createPdmResolver, deriveEventTypes,
} from '@rntme/pdm';
import {
  parseQsm, validateQsm,
} from '@rntme/qsm';
import { compileApplyPlan } from '../../src/apply/compile.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(here, '..', 'fixtures');

function setup() {
  const pdmRaw = parsePdm(readFileSync(join(fixtureDir, 'issue-tracker.pdm.json'), 'utf8'));
  if (!pdmRaw.ok) throw new Error('pdm parse');
  const pdm = validatePdm(pdmRaw.value);
  if (!pdm.ok) throw new Error('pdm validate');
  const resolver = createPdmResolver(pdm.value);
  const events = deriveEventTypes(pdm.value);

  const qsmRaw = parseQsm(readFileSync(join(fixtureDir, 'issue-tracker.qsm.json'), 'utf8'));
  if (!qsmRaw.ok) throw new Error('qsm parse');
  const qsm = validateQsm(qsmRaw.value, resolver);
  if (!qsm.ok) throw new Error('qsm validate');
  return { pdm: resolver, qsm: qsm.value, events };
}

describe('compileApplyPlan — INSERT (creation) handlers', () => {
  it('emits one insert handler for IssueReport (creation)', () => {
    const { pdm, qsm, events } = setup();
    const plan = compileApplyPlan({ pdm, qsm, events });
    const report = plan.handlersByEventType.get('IssueReport')!;
    expect(report).toBeDefined();
    expect(report.kind).toBe('insert');
    expect(report.tableName).toBe('projection_issue');
    expect(report.aggregateType).toBe('Issue');
    expect(report.keyColumn).toBe('id');
  });

  it('INSERT SQL targets every mirror column + idempotency columns', () => {
    const { pdm, qsm, events } = setup();
    const plan = compileApplyPlan({ pdm, qsm, events });
    const report = plan.handlersByEventType.get('IssueReport')!;
    expect(report.sql).toMatch(/INSERT INTO "projection_issue"/);
    expect(report.sql).toContain('"id"');
    expect(report.sql).toContain('"title"');
    expect(report.sql).toContain('"status"');
    expect(report.sql).toContain('"created_at"');
    expect(report.sql).toContain('"last_event_id"');
    expect(report.sql).toContain('"last_event_version"');
    expect(report.sql).toContain('"applied_at"');
  });

  it('INSERT SQL uses ON CONFLICT DO UPDATE with version guard', () => {
    const { pdm, qsm, events } = setup();
    const plan = compileApplyPlan({ pdm, qsm, events });
    const report = plan.handlersByEventType.get('IssueReport')!;
    expect(report.sql).toMatch(/ON CONFLICT\s*\(\s*"id"\s*\)\s+DO UPDATE SET/i);
    expect(report.sql).toMatch(/WHERE\s+"projection_issue"\."last_event_version"\s*<\s*excluded\."last_event_version"/i);
  });

  it('bindings are in SQL placeholder order: one per column in (mirror ++ idempotency)', () => {
    const { pdm, qsm, events } = setup();
    const plan = compileApplyPlan({ pdm, qsm, events });
    const report = plan.handlersByEventType.get('IssueReport')!;
    // 11 mirror columns + 3 idempotency columns = 14
    expect(report.bindings).toHaveLength(14);
    // first binding is aggregateId (id column, integer)
    expect(report.bindings[0]).toEqual({ kind: 'aggregateId', sqlType: 'INTEGER' });
    // last three are idempotency in fixed order
    expect(report.bindings.slice(-3).map((b) => b.kind)).toEqual(['eventId', 'eventVersion', 'appliedAt']);
  });

  it('non-affects nullable columns (e.g. assignee_id at creation) bind to NULL', () => {
    const { pdm, qsm, events } = setup();
    const plan = compileApplyPlan({ pdm, qsm, events });
    const report = plan.handlersByEventType.get('IssueReport')!;
    // Find the binding position for assignee_id
    const colsMatch = report.sql.match(/\(\s*"(?:[^"]+)"(?:\s*,\s*"(?:[^"]+)")*\s*\)\s+VALUES/);
    expect(colsMatch).not.toBeNull();
    // Cheap structural check: there MUST be at least one 'nullable' binding for assignee_id (payload doesn't carry it)
    expect(report.bindings.some((b) => b.kind === 'nullable')).toBe(true);
  });

  it('generated=createdAt column binds to generatedOccurred', () => {
    const { pdm, qsm, events } = setup();
    const plan = compileApplyPlan({ pdm, qsm, events });
    const report = plan.handlersByEventType.get('IssueReport')!;
    expect(report.bindings.some((b) => b.kind === 'generatedOccurred')).toBe(true);
  });

  it('mirrorsByAggregate maps Issue to projection_issue', () => {
    const { pdm, qsm, events } = setup();
    const plan = compileApplyPlan({ pdm, qsm, events });
    expect(plan.mirrorsByAggregate.get('Issue')).toBe('projection_issue');
  });
});
```

- [ ] **Step 3: Write failing test `packages/projection-consumer/test/unit/compile-composite-key.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import {
  parsePdm, validatePdm, createPdmResolver, deriveEventTypes,
} from '@rntme/pdm';
import { parseQsm, validateQsm } from '@rntme/qsm';
import { compileApplyPlan } from '../../src/apply/compile.js';
import { ApplyCompileError } from '../../src/types/errors.js';

const PDM_COMPOSITE = JSON.stringify({
  entities: {
    Seat: {
      table: 'seats',
      fields: {
        showId: { type: 'integer', nullable: false, column: 'show_id' },
        row:    { type: 'string',  nullable: false, column: 'row' },
        num:    { type: 'integer', nullable: false, column: 'num' },
        status: { type: 'string',  nullable: false, column: 'status' },
      },
      keys: ['showId', 'row', 'num'],
      stateMachine: {
        stateField: 'status',
        initial: null,
        states: ['free', 'held'],
        transitions: {
          hold: { from: null, to: 'held', affects: [] },
        },
      },
    },
  },
});

const QSM_COMPOSITE = {
  projections: {
    SeatView: {
      backing: 'entity-mirror',
      source: { entity: 'Seat' },
      keys: ['showId', 'row', 'num'],
      grain: ['showId', 'row', 'num'],
      exposed: ['showId', 'row', 'num', 'status'],
    },
  },
  relationRoles: {},
};

describe('compileApplyPlan — composite keys (MVP)', () => {
  it('throws PC_COMPOSITE_KEY_NOT_SUPPORTED when entity has composite key', () => {
    const pdmRaw = parsePdm(PDM_COMPOSITE);
    if (!pdmRaw.ok) throw new Error('pdm parse');
    const pdm = validatePdm(pdmRaw.value);
    if (!pdm.ok) throw new Error('pdm validate');
    const resolver = createPdmResolver(pdm.value);
    const events = deriveEventTypes(pdm.value);
    const qsmRaw = parseQsm(QSM_COMPOSITE);
    if (!qsmRaw.ok) throw new Error('qsm parse');
    const qsm = validateQsm(qsmRaw.value, resolver);
    if (!qsm.ok) throw new Error('qsm validate');

    expect(() => compileApplyPlan({ pdm: resolver, qsm: qsm.value, events }))
      .toThrow(ApplyCompileError);
    try {
      compileApplyPlan({ pdm: resolver, qsm: qsm.value, events });
    } catch (e) {
      expect((e as ApplyCompileError).code).toBe('PC_COMPOSITE_KEY_NOT_SUPPORTED');
    }
  });
});
```

- [ ] **Step 4: Write failing test `packages/projection-consumer/test/unit/compile-unknown-aggregate.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parsePdm, validatePdm, createPdmResolver, deriveEventTypes,
} from '@rntme/pdm';
import { parseQsm, validateQsm } from '@rntme/qsm';
import { compileApplyPlan } from '../../src/apply/compile.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(here, '..', 'fixtures');

describe('compileApplyPlan — entities without entity-mirror', () => {
  it('does NOT emit handlers for events whose aggregate has no mirror projection', () => {
    const pdmRaw = parsePdm(readFileSync(join(fixtureDir, 'issue-tracker.pdm.json'), 'utf8'));
    if (!pdmRaw.ok) throw new Error('pdm parse');
    const pdm = validatePdm(pdmRaw.value);
    if (!pdm.ok) throw new Error('pdm validate');
    const resolver = createPdmResolver(pdm.value);
    const events = deriveEventTypes(pdm.value);
    // IssueAssignment is in PDM, has a stateMachine, but QSM fixture only
    // has IssueView (no IssueAssignmentView). Its events should be absent.
    const qsmRaw = parseQsm(readFileSync(join(fixtureDir, 'issue-tracker.qsm.json'), 'utf8'));
    if (!qsmRaw.ok) throw new Error('qsm parse');
    const qsm = validateQsm(qsmRaw.value, resolver);
    if (!qsm.ok) throw new Error('qsm validate');

    const plan = compileApplyPlan({ pdm: resolver, qsm: qsm.value, events });
    expect(plan.handlersByEventType.has('IssueAssignmentAssign')).toBe(false);
    expect(plan.handlersByEventType.has('IssueAssignmentActivate')).toBe(false);
    expect(plan.mirrorsByAggregate.has('IssueAssignment')).toBe(false);
  });
});
```

- [ ] **Step 5: Run tests to verify they fail**

```bash
pnpm --filter @rntme/projection-consumer test -- compile
```
Expected: FAIL — `compileApplyPlan is not defined`.

- [ ] **Step 6: Create `packages/projection-consumer/src/apply/compile.ts`**

```ts
import type { PdmResolver, ResolvedEntity, ResolvedField, EventTypeSpec } from '@rntme/pdm';
import {
  deriveProjectionHandler,
  type ValidatedQsm,
  type ProjectionHandlerSpec,
  type EventHandler,
} from '@rntme/qsm';
import type { ApplyPlan, CompiledHandler, ColumnBinding } from '../types/apply.js';
import { ApplyCompileError } from '../types/errors.js';

export function compileApplyPlan(input: {
  pdm: PdmResolver;
  qsm: ValidatedQsm;
  events: readonly EventTypeSpec[];
}): ApplyPlan {
  const specs = deriveProjectionHandler(input.qsm, input.pdm, input.events);
  const handlersByEventType = new Map<string, CompiledHandler>();
  const mirrorsByAggregate = new Map<string, string>();
  const eventByType = new Map(input.events.map((e) => [e.eventType, e]));

  for (const spec of specs) {
    if (spec.keyColumns.length !== 1) {
      throw new ApplyCompileError(
        'PC_COMPOSITE_KEY_NOT_SUPPORTED',
        { projection: spec.projectionName, aggregate: spec.aggregateType, keyCount: String(spec.keyColumns.length) },
        `Composite-key aggregate "${spec.aggregateType}" (projection "${spec.projectionName}") is not supported in MVP.`,
      );
    }
    const entity = input.pdm.resolveEntity(spec.aggregateType);
    if (!entity) {
      throw new ApplyCompileError(
        'PC_MISSING_ENTITY_FIELD',
        { aggregate: spec.aggregateType },
        `Entity "${spec.aggregateType}" missing from PDM while compiling projection "${spec.projectionName}".`,
      );
    }
    mirrorsByAggregate.set(spec.aggregateType, spec.tableName);

    for (const handler of spec.eventHandlers) {
      const eventSpec = eventByType.get(handler.eventType);
      if (!eventSpec) {
        throw new ApplyCompileError(
          'PC_MISSING_ENTITY_FIELD',
          { eventType: handler.eventType },
          `EventTypeSpec for "${handler.eventType}" missing while compiling projection "${spec.projectionName}".`,
        );
      }
      if (handler.op.kind === 'insert') {
        handlersByEventType.set(handler.eventType, compileInsert(spec, handler, entity, eventSpec));
      }
      // update compiled in Task 6
    }
  }

  return {
    handlersByEventType,
    mirrorsByAggregate,
  };
}

function compileInsert(
  spec: ProjectionHandlerSpec,
  handler: EventHandler,
  entity: ResolvedEntity,
  _eventSpec: EventTypeSpec,
): CompiledHandler {
  if (handler.op.kind !== 'insert') {
    throw new ApplyCompileError('PC_MISSING_ENTITY_FIELD', {}, 'compileInsert called with non-insert handler');
  }
  const keyColumn = spec.keyColumns[0]!;
  const mirrorColumns = handler.op.columns;
  const payloadFields = new Set(handler.op.payloadFields);
  const fieldByColumn = new Map(entity.fields.map((f) => [f.column, f]));
  const fieldByName = new Map(entity.fields.map((f) => [f.name, f]));

  const bindings: ColumnBinding[] = [];
  for (const col of mirrorColumns) {
    bindings.push(bindingForInsertColumn(col, keyColumn, entity, fieldByColumn, fieldByName, payloadFields, spec.projectionName));
  }
  // Idempotency columns always appended in this fixed order:
  bindings.push({ kind: 'eventId' });
  bindings.push({ kind: 'eventVersion' });
  bindings.push({ kind: 'appliedAt' });

  const allCols = [...mirrorColumns, 'last_event_id', 'last_event_version', 'applied_at'];
  const placeholders = allCols.map(() => '?').join(', ');
  const conflictSet = allCols
    .filter((c) => c !== keyColumn)
    .map((c) => `${q(c)} = excluded.${q(c)}`)
    .join(', ');
  const sql =
    `INSERT INTO ${q(spec.tableName)} (${allCols.map(q).join(', ')})\n` +
    `VALUES (${placeholders})\n` +
    `ON CONFLICT (${q(keyColumn)}) DO UPDATE SET\n` +
    `  ${conflictSet}\n` +
    `WHERE ${q(spec.tableName)}.${q('last_event_version')} < excluded.${q('last_event_version')}`;

  return {
    kind: 'insert',
    projectionName: spec.projectionName,
    tableName: spec.tableName,
    aggregateType: spec.aggregateType,
    eventType: handler.eventType,
    keyColumn,
    sql,
    bindings,
  };
}

function bindingForInsertColumn(
  column: string,
  keyColumn: string,
  entity: ResolvedEntity,
  fieldByColumn: Map<string, ResolvedField>,
  fieldByName: Map<string, ResolvedField>,
  payloadFields: Set<string>,
  projectionName: string,
): ColumnBinding {
  if (column === keyColumn) {
    const keyFieldName = entity.keys[0]!;
    const keyField = fieldByName.get(keyFieldName)!;
    return { kind: 'aggregateId', sqlType: sqlTypeOf(keyField) };
  }
  const field = fieldByColumn.get(column);
  if (!field) {
    throw new ApplyCompileError(
      'PC_MISSING_ENTITY_FIELD',
      { column, entity: entity.name, projection: projectionName },
      `Column "${column}" in projection "${projectionName}" has no matching PDM field on entity "${entity.name}".`,
    );
  }
  if (payloadFields.has(field.name)) {
    return { kind: 'payloadField', fieldName: field.name };
  }
  if (field.generated === 'createdAt' || field.generated === 'updatedAt') {
    return { kind: 'generatedOccurred' };
  }
  if (field.generated === 'actor') {
    return { kind: 'generatedActor' };
  }
  if (field.nullable) {
    return { kind: 'nullable' };
  }
  throw new ApplyCompileError(
    'PC_COLUMN_SOURCE_UNRESOLVABLE',
    { column, field: field.name, entity: entity.name, projection: projectionName },
    `Column "${column}" (field "${field.name}") on entity "${entity.name}" is NOT NULL, not in event affects, and not generated — cannot bind a value for creation of projection "${projectionName}".`,
  );
}

function sqlTypeOf(field: ResolvedField): 'INTEGER' | 'TEXT' | 'REAL' {
  switch (field.type) {
    case 'integer':
    case 'boolean':
      return 'INTEGER';
    case 'decimal':
      return 'REAL';
    case 'string':
    case 'date':
    case 'datetime':
      return 'TEXT';
  }
}

function q(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}
```

- [ ] **Step 7: Re-export from `src/index.ts`**

Add:

```ts
export { compileApplyPlan } from './apply/compile.js';
export type {
  ApplyPlan, CompiledHandler, ColumnBinding, ApplyResult,
} from './types/apply.js';
```

- [ ] **Step 8: Run tests to verify they pass**

```bash
pnpm --filter @rntme/projection-consumer test -- compile
pnpm --filter @rntme/projection-consumer typecheck
```
Expected: all compile tests pass, typecheck clean.

- [ ] **Step 9: Commit**

```bash
git add packages/projection-consumer/src packages/projection-consumer/test
git commit -m "feat(projection-consumer): compile ApplyPlan — INSERT SQL for creation handlers"
```

---

## Task 6: Compile ApplyPlan — UPDATE SQL (non-creation handlers)

**Files:**
- Modify: `packages/projection-consumer/src/apply/compile.ts`
- Create: `packages/projection-consumer/test/unit/compile-update.test.ts`

- [ ] **Step 1: Write failing test `packages/projection-consumer/test/unit/compile-update.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parsePdm, validatePdm, createPdmResolver, deriveEventTypes,
} from '@rntme/pdm';
import { parseQsm, validateQsm } from '@rntme/qsm';
import { compileApplyPlan } from '../../src/apply/compile.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(here, '..', 'fixtures');

function setup() {
  const pdmRaw = parsePdm(readFileSync(join(fixtureDir, 'issue-tracker.pdm.json'), 'utf8'));
  if (!pdmRaw.ok) throw new Error();
  const pdm = validatePdm(pdmRaw.value);
  if (!pdm.ok) throw new Error();
  const resolver = createPdmResolver(pdm.value);
  const events = deriveEventTypes(pdm.value);
  const qsmRaw = parseQsm(readFileSync(join(fixtureDir, 'issue-tracker.qsm.json'), 'utf8'));
  if (!qsmRaw.ok) throw new Error();
  const qsm = validateQsm(qsmRaw.value, resolver);
  if (!qsm.ok) throw new Error();
  return { pdm: resolver, qsm: qsm.value, events };
}

describe('compileApplyPlan — UPDATE (non-creation) handlers', () => {
  it('emits update handler for IssueAssign (non-creation)', () => {
    const { pdm, qsm, events } = setup();
    const plan = compileApplyPlan({ pdm, qsm, events });
    const assign = plan.handlersByEventType.get('IssueAssign')!;
    expect(assign).toBeDefined();
    expect(assign.kind).toBe('update');
    expect(assign.keyColumn).toBe('id');
  });

  it('UPDATE SQL sets only affected columns + idempotency columns', () => {
    const { pdm, qsm, events } = setup();
    const plan = compileApplyPlan({ pdm, qsm, events });
    const assign = plan.handlersByEventType.get('IssueAssign')!;
    // affects = [status, assigneeId] → set status, assignee_id
    expect(assign.sql).toMatch(/UPDATE "projection_issue"/);
    expect(assign.sql).toContain('"status" = ?');
    expect(assign.sql).toContain('"assignee_id" = ?');
    expect(assign.sql).toContain('"last_event_id" = ?');
    expect(assign.sql).toContain('"last_event_version" = ?');
    expect(assign.sql).toContain('"applied_at" = ?');
  });

  it('UPDATE SQL uses WHERE key = ? AND last_event_version < ?', () => {
    const { pdm, qsm, events } = setup();
    const plan = compileApplyPlan({ pdm, qsm, events });
    const assign = plan.handlersByEventType.get('IssueAssign')!;
    expect(assign.sql).toMatch(/WHERE\s+"id"\s*=\s*\?\s+AND\s+"last_event_version"\s*<\s*\?/i);
  });

  it('bindings order: SET payload-fields → SET eventId → SET eventVersion → SET appliedAt → WHERE aggregateId → WHERE eventVersion', () => {
    const { pdm, qsm, events } = setup();
    const plan = compileApplyPlan({ pdm, qsm, events });
    const assign = plan.handlersByEventType.get('IssueAssign')!;
    const kinds = assign.bindings.map((b) => b.kind);
    // 2 payload fields (status, assigneeId) + 3 idempotency + 2 where = 7
    expect(assign.bindings).toHaveLength(7);
    // Last 5 must be: eventId, eventVersion, appliedAt, aggregateId, eventVersion
    expect(kinds.slice(-5)).toEqual(['eventId', 'eventVersion', 'appliedAt', 'aggregateId', 'eventVersion']);
    // First 2 must be payloadField
    expect(kinds.slice(0, 2).every((k) => k === 'payloadField')).toBe(true);
  });

  it('self-loop transition (reassign) emits an update, not an insert', () => {
    const { pdm, qsm, events } = setup();
    const plan = compileApplyPlan({ pdm, qsm, events });
    const reassign = plan.handlersByEventType.get('IssueReassign')!;
    expect(reassign.kind).toBe('update');
    expect(reassign.sql).toContain('"status" = ?');
    expect(reassign.sql).toContain('"assignee_id" = ?');
  });

  it('transition with default affects (submit: only stateField) sets exactly one column', () => {
    const { pdm, qsm, events } = setup();
    const plan = compileApplyPlan({ pdm, qsm, events });
    const submit = plan.handlersByEventType.get('IssueSubmit')!;
    expect(submit.kind).toBe('update');
    // 1 payload (status) + 3 idempotency + 2 where = 6
    expect(submit.bindings).toHaveLength(6);
  });

  it('emits insert and update handlers for every transition of Issue (7 total)', () => {
    const { pdm, qsm, events } = setup();
    const plan = compileApplyPlan({ pdm, qsm, events });
    const issueHandlers = [...plan.handlersByEventType.values()].filter((h) => h.aggregateType === 'Issue');
    expect(issueHandlers).toHaveLength(7);
    const inserts = issueHandlers.filter((h) => h.kind === 'insert').map((h) => h.eventType);
    const updates = issueHandlers.filter((h) => h.kind === 'update').map((h) => h.eventType);
    expect(inserts).toEqual(['IssueReport']);
    expect(updates.sort()).toEqual(['IssueAssign', 'IssueClose', 'IssueReassign', 'IssueReopen', 'IssueResolve', 'IssueSubmit']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @rntme/projection-consumer test -- compile-update
```
Expected: FAIL — `IssueAssign` handler missing.

- [ ] **Step 3: Extend `packages/projection-consumer/src/apply/compile.ts` with `compileUpdate`**

In the main `for` loop, add a branch for `handler.op.kind === 'update'`. Append this helper at the bottom of the file:

```ts
function compileUpdate(
  spec: ProjectionHandlerSpec,
  handler: EventHandler,
  entity: ResolvedEntity,
): CompiledHandler {
  if (handler.op.kind !== 'update') {
    throw new ApplyCompileError('PC_MISSING_ENTITY_FIELD', {}, 'compileUpdate called with non-update handler');
  }
  const keyColumn = spec.keyColumns[0]!;
  const fieldByColumn = new Map(entity.fields.map((f) => [f.column, f]));
  const fieldByName = new Map(entity.fields.map((f) => [f.name, f]));

  const setParts: string[] = [];
  const bindings: ColumnBinding[] = [];
  for (let i = 0; i < handler.op.setColumns.length; i++) {
    const col = handler.op.setColumns[i]!;
    const fieldName = handler.op.setFields[i]!;
    if (!fieldByColumn.has(col)) {
      throw new ApplyCompileError(
        'PC_MISSING_ENTITY_FIELD',
        { column: col, entity: entity.name, projection: spec.projectionName },
        `setColumn "${col}" not in entity "${entity.name}" while compiling update handler for projection "${spec.projectionName}".`,
      );
    }
    setParts.push(`${q(col)} = ?`);
    bindings.push({ kind: 'payloadField', fieldName });
  }
  // Bump generated=updatedAt columns (not in affects but present on entity).
  for (const field of entity.fields) {
    if (field.generated === 'updatedAt') {
      setParts.push(`${q(field.column)} = ?`);
      bindings.push({ kind: 'generatedOccurred' });
    }
  }
  // Idempotency columns (SET)
  setParts.push(`${q('last_event_id')} = ?`);
  bindings.push({ kind: 'eventId' });
  setParts.push(`${q('last_event_version')} = ?`);
  bindings.push({ kind: 'eventVersion' });
  setParts.push(`${q('applied_at')} = ?`);
  bindings.push({ kind: 'appliedAt' });

  // WHERE clause bindings
  const keyFieldName = entity.keys[0]!;
  const keyField = fieldByName.get(keyFieldName)!;
  bindings.push({ kind: 'aggregateId', sqlType: sqlTypeOf(keyField) });
  bindings.push({ kind: 'eventVersion' });

  const sql =
    `UPDATE ${q(spec.tableName)}\n` +
    `SET ${setParts.join(', ')}\n` +
    `WHERE ${q(keyColumn)} = ? AND ${q('last_event_version')} < ?`;

  return {
    kind: 'update',
    projectionName: spec.projectionName,
    tableName: spec.tableName,
    aggregateType: spec.aggregateType,
    eventType: handler.eventType,
    keyColumn,
    sql,
    bindings,
  };
}
```

And wire it into the loop (replace `// update compiled in Task 6` with):

```ts
      if (handler.op.kind === 'update') {
        handlersByEventType.set(handler.eventType, compileUpdate(spec, handler, entity));
      }
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm --filter @rntme/projection-consumer test -- compile
```
Expected: all compile tests pass (including previous insert tests).

Note: the Issue fixture has `generated=createdAt` but not `generated=updatedAt`. The "update ALSO bumps updatedAt" branch is exercised by a dedicated fixture — add `Issue.updatedAt` to the test fixture? No — keep fixture aligned with spec. Instead, a single-line assertion confirms absence is handled gracefully (binding count = 6 for submit). Skip updatedAt-binding test for now; covered logically by Task 7 (apply-update tests pass when no `generated=updatedAt` field exists).

- [ ] **Step 5: Commit**

```bash
git add packages/projection-consumer/src packages/projection-consumer/test
git commit -m "feat(projection-consumer): compile ApplyPlan — UPDATE SQL for non-creation handlers"
```

---

## Task 7: bind + applyEvent — idempotent runtime apply

**Files:**
- Create: `packages/projection-consumer/src/apply/bind.ts`
- Create: `packages/projection-consumer/src/apply/apply-event.ts`
- Create: `packages/projection-consumer/test/fixtures/envelopes.ts`
- Create: `packages/projection-consumer/test/unit/bind-insert.test.ts`
- Create: `packages/projection-consumer/test/unit/bind-update.test.ts`
- Create: `packages/projection-consumer/test/unit/apply-insert.test.ts`
- Create: `packages/projection-consumer/test/unit/apply-update.test.ts`
- Create: `packages/projection-consumer/test/unit/apply-idempotent.test.ts`
- Create: `packages/projection-consumer/test/unit/apply-unknown-aggregate.test.ts`

- [ ] **Step 1: Create test fixture `packages/projection-consumer/test/fixtures/envelopes.ts`**

```ts
import type { EventEnvelope } from '@rntme/event-store';

export function makeEnvelope(overrides: Partial<EventEnvelope> = {}): EventEnvelope {
  return {
    eventId: overrides.eventId ?? 'ev-' + Math.random().toString(36).slice(2, 10),
    eventType: overrides.eventType ?? 'IssueReport',
    aggregateType: overrides.aggregateType ?? 'Issue',
    aggregateId: overrides.aggregateId ?? '1',
    stream: overrides.stream ?? `${overrides.aggregateType ?? 'Issue'}-${overrides.aggregateId ?? '1'}`,
    version: overrides.version ?? 1,
    occurredAt: overrides.occurredAt ?? '2026-04-14T10:00:00.000Z',
    actor: 'actor' in overrides ? overrides.actor! : { kind: 'user', id: 'alice' },
    payload: overrides.payload ?? {
      before: null,
      after: {
        status: 'draft',
        title: 'Hello',
        projectId: 7,
        reporterId: 42,
        priority: 'high',
        storyPoints: 5,
      },
    },
    schemaVersion: overrides.schemaVersion ?? 1,
  };
}

/**
 * Canonical lifecycle per spec §7.5 E2E: report → submit → assign → reassign → resolve → close.
 * aggregateId=1, per-stream monotonic version.
 */
export function issueLifecycle(aggregateId = '1'): EventEnvelope[] {
  const stream = `Issue-${aggregateId}`;
  return [
    makeEnvelope({
      eventId: 'e1', eventType: 'IssueReport', aggregateId, stream, version: 1,
      occurredAt: '2026-04-14T10:00:00.000Z',
      payload: { before: null, after: { status: 'draft', title: 'Hello', projectId: 7, reporterId: 42, priority: 'high', storyPoints: 5 } },
    }),
    makeEnvelope({
      eventId: 'e2', eventType: 'IssueSubmit', aggregateId, stream, version: 2,
      occurredAt: '2026-04-14T10:01:00.000Z',
      payload: { before: { status: 'draft' }, after: { status: 'open' } },
    }),
    makeEnvelope({
      eventId: 'e3', eventType: 'IssueAssign', aggregateId, stream, version: 3,
      occurredAt: '2026-04-14T10:02:00.000Z',
      payload: { before: { status: 'open', assigneeId: null }, after: { status: 'in_progress', assigneeId: 99 } },
    }),
    makeEnvelope({
      eventId: 'e4', eventType: 'IssueReassign', aggregateId, stream, version: 4,
      occurredAt: '2026-04-14T10:03:00.000Z',
      payload: { before: { status: 'in_progress', assigneeId: 99 }, after: { status: 'in_progress', assigneeId: 100 } },
    }),
    makeEnvelope({
      eventId: 'e5', eventType: 'IssueResolve', aggregateId, stream, version: 5,
      occurredAt: '2026-04-14T10:04:00.000Z',
      payload: { before: { status: 'in_progress', resolvedAt: null }, after: { status: 'resolved', resolvedAt: '2026-04-14T10:04:00.000Z' } },
    }),
    makeEnvelope({
      eventId: 'e6', eventType: 'IssueClose', aggregateId, stream, version: 6,
      occurredAt: '2026-04-14T10:05:00.000Z',
      payload: { before: { status: 'resolved' }, after: { status: 'closed' } },
    }),
  ];
}
```

- [ ] **Step 2: Write failing test `packages/projection-consumer/test/unit/bind-insert.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parsePdm, validatePdm, createPdmResolver, deriveEventTypes,
} from '@rntme/pdm';
import { parseQsm, validateQsm } from '@rntme/qsm';
import { compileApplyPlan } from '../../src/apply/compile.js';
import { bindValues } from '../../src/apply/bind.js';
import { makeEnvelope } from '../fixtures/envelopes.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(here, '..', 'fixtures');

function setup() {
  const pdmRaw = parsePdm(readFileSync(join(fixtureDir, 'issue-tracker.pdm.json'), 'utf8'));
  if (!pdmRaw.ok) throw new Error();
  const pdm = validatePdm(pdmRaw.value);
  if (!pdm.ok) throw new Error();
  const resolver = createPdmResolver(pdm.value);
  const events = deriveEventTypes(pdm.value);
  const qsmRaw = parseQsm(readFileSync(join(fixtureDir, 'issue-tracker.qsm.json'), 'utf8'));
  if (!qsmRaw.ok) throw new Error();
  const qsm = validateQsm(qsmRaw.value, resolver);
  if (!qsm.ok) throw new Error();
  return compileApplyPlan({ pdm: resolver, qsm: qsm.value, events });
}

describe('bindValues — INSERT', () => {
  it('returns the same number of params as bindings', () => {
    const plan = setup();
    const report = plan.handlersByEventType.get('IssueReport')!;
    const env = makeEnvelope({
      eventId: 'ev-a', aggregateId: '123', version: 1,
      occurredAt: '2026-04-14T10:00:00.000Z',
    });
    const vals = bindValues(report, env);
    expect(vals).toHaveLength(report.bindings.length);
  });

  it('aggregateId coerced to integer for integer-typed key', () => {
    const plan = setup();
    const report = plan.handlersByEventType.get('IssueReport')!;
    const env = makeEnvelope({ aggregateId: '123', version: 1 });
    const vals = bindValues(report, env);
    expect(vals[0]).toBe(123); // id column first
    expect(typeof vals[0]).toBe('number');
  });

  it('payloadField values lifted straight from payload.after', () => {
    const plan = setup();
    const report = plan.handlersByEventType.get('IssueReport')!;
    const env = makeEnvelope({
      aggregateId: '1', version: 1,
      payload: { before: null, after: { status: 'draft', title: 'X', projectId: 9, reporterId: 5, priority: 'low', storyPoints: 2 } },
    });
    const vals = bindValues(report, env);
    // verify all payload fields appear in values
    expect(vals).toContain('draft');
    expect(vals).toContain('X');
    expect(vals).toContain(9);
    expect(vals).toContain(5);
    expect(vals).toContain('low');
    expect(vals).toContain(2);
  });

  it('generatedOccurred binds to envelope.occurredAt', () => {
    const plan = setup();
    const report = plan.handlersByEventType.get('IssueReport')!;
    const env = makeEnvelope({ aggregateId: '1', version: 1, occurredAt: '2030-01-01T00:00:00.000Z' });
    const vals = bindValues(report, env);
    expect(vals).toContain('2030-01-01T00:00:00.000Z');
  });

  it('nullable unbound columns bind to null', () => {
    const plan = setup();
    const report = plan.handlersByEventType.get('IssueReport')!;
    const env = makeEnvelope({ aggregateId: '1', version: 1 });
    const vals = bindValues(report, env);
    // assignee_id has no payload source, nullable → null
    expect(vals.filter((v) => v === null).length).toBeGreaterThanOrEqual(1);
  });

  it('eventId / eventVersion / appliedAt at the tail (insert idempotency)', () => {
    const plan = setup();
    const report = plan.handlersByEventType.get('IssueReport')!;
    const env = makeEnvelope({ eventId: 'ev-xyz', version: 7 });
    const vals = bindValues(report, env);
    const tail = vals.slice(-3);
    expect(tail[0]).toBe('ev-xyz');
    expect(tail[1]).toBe(7);
    expect(typeof tail[2]).toBe('string');
    expect((tail[2] as string).length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 3: Write failing test `packages/projection-consumer/test/unit/bind-update.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parsePdm, validatePdm, createPdmResolver, deriveEventTypes,
} from '@rntme/pdm';
import { parseQsm, validateQsm } from '@rntme/qsm';
import { compileApplyPlan } from '../../src/apply/compile.js';
import { bindValues } from '../../src/apply/bind.js';
import { makeEnvelope } from '../fixtures/envelopes.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(here, '..', 'fixtures');

function setup() {
  const pdmRaw = parsePdm(readFileSync(join(fixtureDir, 'issue-tracker.pdm.json'), 'utf8'));
  if (!pdmRaw.ok) throw new Error();
  const pdm = validatePdm(pdmRaw.value);
  if (!pdm.ok) throw new Error();
  const resolver = createPdmResolver(pdm.value);
  const events = deriveEventTypes(pdm.value);
  const qsmRaw = parseQsm(readFileSync(join(fixtureDir, 'issue-tracker.qsm.json'), 'utf8'));
  if (!qsmRaw.ok) throw new Error();
  const qsm = validateQsm(qsmRaw.value, resolver);
  if (!qsm.ok) throw new Error();
  return compileApplyPlan({ pdm: resolver, qsm: qsm.value, events });
}

describe('bindValues — UPDATE', () => {
  it('IssueAssign: [status, assignee_id, eventId, eventVersion, appliedAt, aggregateId, eventVersion]', () => {
    const plan = setup();
    const assign = plan.handlersByEventType.get('IssueAssign')!;
    const env = makeEnvelope({
      eventType: 'IssueAssign', aggregateId: '42', version: 3, eventId: 'ev-3',
      payload: { before: { status: 'open', assigneeId: null }, after: { status: 'in_progress', assigneeId: 17 } },
    });
    const vals = bindValues(assign, env);
    // SET payload columns come first in the order of handler.setColumns
    // (compile.ts traverses setColumns[i] with setFields[i] in order)
    // Then eventId, eventVersion, appliedAt, aggregateId, eventVersion
    expect(vals).toHaveLength(7);
    expect(vals.slice(-5)).toEqual(['ev-3', 3, expect.any(String), 42, 3]);
    // aggregateId coerced to number (integer key)
    expect(vals[vals.length - 2]).toBe(42);
  });

  it('self-loop (IssueReassign) carries new assigneeId from payload.after', () => {
    const plan = setup();
    const reassign = plan.handlersByEventType.get('IssueReassign')!;
    const env = makeEnvelope({
      eventType: 'IssueReassign', aggregateId: '1', version: 5, eventId: 'ev-5',
      payload: { before: { status: 'in_progress', assigneeId: 17 }, after: { status: 'in_progress', assigneeId: 18 } },
    });
    const vals = bindValues(reassign, env);
    expect(vals).toContain(18);
    expect(vals).toContain('in_progress');
  });
});
```

- [ ] **Step 4: Write failing test `packages/projection-consumer/test/unit/apply-insert.test.ts`**

```ts
import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import {
  parsePdm, validatePdm, createPdmResolver, deriveEventTypes,
} from '@rntme/pdm';
import {
  parseQsm, validateQsm, generateProjectionDdl,
} from '@rntme/qsm';
import { compileApplyPlan } from '../../src/apply/compile.js';
import { bootstrapProjections } from '../../src/store/bootstrap.js';
import { applyEvent } from '../../src/apply/apply-event.js';
import { makeEnvelope } from '../fixtures/envelopes.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(here, '..', 'fixtures');

function setup() {
  const pdmRaw = parsePdm(readFileSync(join(fixtureDir, 'issue-tracker.pdm.json'), 'utf8'));
  if (!pdmRaw.ok) throw new Error();
  const pdm = validatePdm(pdmRaw.value);
  if (!pdm.ok) throw new Error();
  const resolver = createPdmResolver(pdm.value);
  const events = deriveEventTypes(pdm.value);
  const qsmRaw = parseQsm(readFileSync(join(fixtureDir, 'issue-tracker.qsm.json'), 'utf8'));
  if (!qsmRaw.ok) throw new Error();
  const qsm = validateQsm(qsmRaw.value, resolver);
  if (!qsm.ok) throw new Error();
  const ddls = generateProjectionDdl(qsm.value, resolver);
  const plan = compileApplyPlan({ pdm: resolver, qsm: qsm.value, events });
  return { plan, ddls };
}

let db: Database.Database | null = null;
afterEach(() => { db?.close(); db = null; });

describe('applyEvent — INSERT (creation)', () => {
  it('inserts a new row into projection_issue for IssueReport', () => {
    db = new Database(':memory:');
    const { plan, ddls } = setup();
    bootstrapProjections(db, ddls);

    const env = makeEnvelope({
      eventId: 'ev-1', eventType: 'IssueReport', aggregateId: '1', version: 1,
      occurredAt: '2026-04-14T10:00:00.000Z',
      payload: { before: null, after: {
        status: 'draft', title: 'Hello', projectId: 7, reporterId: 42, priority: 'high', storyPoints: 5,
      } },
    });
    const result = applyEvent(db, plan, env);
    expect(result).toBe('applied');

    const row = db.prepare('SELECT * FROM projection_issue WHERE id = ?').get(1) as Record<string, unknown>;
    expect(row.title).toBe('Hello');
    expect(row.status).toBe('draft');
    expect(row.project_id).toBe(7);
    expect(row.created_at).toBe('2026-04-14T10:00:00.000Z');
    expect(row.last_event_id).toBe('ev-1');
    expect(row.last_event_version).toBe(1);
    expect(row.assignee_id).toBeNull();
    expect(row.resolved_at).toBeNull();
  });
});
```

- [ ] **Step 5: Write failing test `packages/projection-consumer/test/unit/apply-update.test.ts`**

```ts
import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import {
  parsePdm, validatePdm, createPdmResolver, deriveEventTypes,
} from '@rntme/pdm';
import { parseQsm, validateQsm, generateProjectionDdl } from '@rntme/qsm';
import { compileApplyPlan } from '../../src/apply/compile.js';
import { bootstrapProjections } from '../../src/store/bootstrap.js';
import { applyEvent } from '../../src/apply/apply-event.js';
import { issueLifecycle } from '../fixtures/envelopes.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(here, '..', 'fixtures');

function setup() {
  const pdmRaw = parsePdm(readFileSync(join(fixtureDir, 'issue-tracker.pdm.json'), 'utf8'));
  if (!pdmRaw.ok) throw new Error();
  const pdm = validatePdm(pdmRaw.value);
  if (!pdm.ok) throw new Error();
  const resolver = createPdmResolver(pdm.value);
  const events = deriveEventTypes(pdm.value);
  const qsmRaw = parseQsm(readFileSync(join(fixtureDir, 'issue-tracker.qsm.json'), 'utf8'));
  if (!qsmRaw.ok) throw new Error();
  const qsm = validateQsm(qsmRaw.value, resolver);
  if (!qsm.ok) throw new Error();
  return {
    plan: compileApplyPlan({ pdm: resolver, qsm: qsm.value, events }),
    ddls: generateProjectionDdl(qsm.value, resolver),
  };
}

let db: Database.Database | null = null;
afterEach(() => { db?.close(); db = null; });

describe('applyEvent — UPDATE (non-creation)', () => {
  it('sequential lifecycle drives projection through correct final state', () => {
    db = new Database(':memory:');
    const { plan, ddls } = setup();
    bootstrapProjections(db, ddls);
    for (const env of issueLifecycle('1')) {
      expect(applyEvent(db, plan, env)).toBe('applied');
    }
    const row = db.prepare('SELECT * FROM projection_issue WHERE id = 1').get() as Record<string, unknown>;
    expect(row.status).toBe('closed');
    expect(row.assignee_id).toBe(100);
    expect(row.resolved_at).toBe('2026-04-14T10:04:00.000Z');
    expect(row.last_event_id).toBe('e6');
    expect(row.last_event_version).toBe(6);
    expect(row.title).toBe('Hello');            // set at creation, untouched since
    expect(row.created_at).toBe('2026-04-14T10:00:00.000Z');
  });

  it('UPDATE does not touch columns absent from payload.after', () => {
    db = new Database(':memory:');
    const { plan, ddls } = setup();
    bootstrapProjections(db, ddls);
    const lifecycle = issueLifecycle('1');
    applyEvent(db, plan, lifecycle[0]!);  // creation
    applyEvent(db, plan, lifecycle[1]!);  // submit: status only
    const row = db.prepare('SELECT title, status FROM projection_issue WHERE id = 1').get() as Record<string, unknown>;
    expect(row.status).toBe('open');
    expect(row.title).toBe('Hello'); // submit has no title in payload
  });
});
```

- [ ] **Step 6: Write failing test `packages/projection-consumer/test/unit/apply-idempotent.test.ts`**

```ts
import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import {
  parsePdm, validatePdm, createPdmResolver, deriveEventTypes,
} from '@rntme/pdm';
import { parseQsm, validateQsm, generateProjectionDdl } from '@rntme/qsm';
import { compileApplyPlan } from '../../src/apply/compile.js';
import { bootstrapProjections } from '../../src/store/bootstrap.js';
import { applyEvent } from '../../src/apply/apply-event.js';
import { makeEnvelope, issueLifecycle } from '../fixtures/envelopes.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(here, '..', 'fixtures');

function setup() {
  const pdmRaw = parsePdm(readFileSync(join(fixtureDir, 'issue-tracker.pdm.json'), 'utf8'));
  if (!pdmRaw.ok) throw new Error();
  const pdm = validatePdm(pdmRaw.value);
  if (!pdm.ok) throw new Error();
  const resolver = createPdmResolver(pdm.value);
  const events = deriveEventTypes(pdm.value);
  const qsmRaw = parseQsm(readFileSync(join(fixtureDir, 'issue-tracker.qsm.json'), 'utf8'));
  if (!qsmRaw.ok) throw new Error();
  const qsm = validateQsm(qsmRaw.value, resolver);
  if (!qsm.ok) throw new Error();
  return {
    plan: compileApplyPlan({ pdm: resolver, qsm: qsm.value, events }),
    ddls: generateProjectionDdl(qsm.value, resolver),
  };
}

let db: Database.Database | null = null;
afterEach(() => { db?.close(); db = null; });

describe('applyEvent — idempotency (spec §6.5)', () => {
  it('re-applying the same creation event is a no-op on the second call', () => {
    db = new Database(':memory:');
    const { plan, ddls } = setup();
    bootstrapProjections(db, ddls);
    const env = makeEnvelope({
      eventId: 'ev-1', eventType: 'IssueReport', aggregateId: '1', version: 1,
    });
    expect(applyEvent(db, plan, env)).toBe('applied');
    expect(applyEvent(db, plan, env)).toBe('skipped-older-version');
    const rows = db.prepare('SELECT COUNT(*) AS c FROM projection_issue').get() as { c: number };
    expect(rows.c).toBe(1);
  });

  it('re-applying an older update (lower version) is a no-op', () => {
    db = new Database(':memory:');
    const { plan, ddls } = setup();
    bootstrapProjections(db, ddls);
    const lifecycle = issueLifecycle('1');
    applyEvent(db, plan, lifecycle[0]!);  // v1 report
    applyEvent(db, plan, lifecycle[1]!);  // v2 submit → status=open
    applyEvent(db, plan, lifecycle[2]!);  // v3 assign → status=in_progress, assignee=99
    // Replay v2 now that we're already at v3
    expect(applyEvent(db, plan, lifecycle[1]!)).toBe('skipped-older-version');
    const row = db.prepare('SELECT status, assignee_id, last_event_version FROM projection_issue WHERE id = 1').get() as Record<string, unknown>;
    expect(row.status).toBe('in_progress');
    expect(row.assignee_id).toBe(99);
    expect(row.last_event_version).toBe(3);
  });

  it('out-of-order delivery: higher version first, then lower → lower is skipped', () => {
    db = new Database(':memory:');
    const { plan, ddls } = setup();
    bootstrapProjections(db, ddls);
    const lifecycle = issueLifecycle('1');
    applyEvent(db, plan, lifecycle[0]!);  // v1 report
    applyEvent(db, plan, lifecycle[2]!);  // v3 assign (skipping v2)
    // last_event_version should be 3
    const mid = db.prepare('SELECT last_event_version FROM projection_issue WHERE id = 1').get() as { last_event_version: number };
    expect(mid.last_event_version).toBe(3);
    // Now v2 arrives — must be skipped
    expect(applyEvent(db, plan, lifecycle[1]!)).toBe('skipped-older-version');
    const after = db.prepare('SELECT last_event_version, status, assignee_id FROM projection_issue WHERE id = 1').get() as Record<string, unknown>;
    expect(after.last_event_version).toBe(3);
    expect(after.status).toBe('in_progress');
    expect(after.assignee_id).toBe(99);
  });
});
```

- [ ] **Step 7: Write failing test `packages/projection-consumer/test/unit/apply-unknown-aggregate.test.ts`**

```ts
import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import {
  parsePdm, validatePdm, createPdmResolver, deriveEventTypes,
} from '@rntme/pdm';
import { parseQsm, validateQsm, generateProjectionDdl } from '@rntme/qsm';
import { compileApplyPlan } from '../../src/apply/compile.js';
import { bootstrapProjections } from '../../src/store/bootstrap.js';
import { applyEvent } from '../../src/apply/apply-event.js';
import { makeEnvelope } from '../fixtures/envelopes.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(here, '..', 'fixtures');

function setup() {
  const pdmRaw = parsePdm(readFileSync(join(fixtureDir, 'issue-tracker.pdm.json'), 'utf8'));
  if (!pdmRaw.ok) throw new Error();
  const pdm = validatePdm(pdmRaw.value);
  if (!pdm.ok) throw new Error();
  const resolver = createPdmResolver(pdm.value);
  const events = deriveEventTypes(pdm.value);
  const qsmRaw = parseQsm(readFileSync(join(fixtureDir, 'issue-tracker.qsm.json'), 'utf8'));
  if (!qsmRaw.ok) throw new Error();
  const qsm = validateQsm(qsmRaw.value, resolver);
  if (!qsm.ok) throw new Error();
  return {
    plan: compileApplyPlan({ pdm: resolver, qsm: qsm.value, events }),
    ddls: generateProjectionDdl(qsm.value, resolver),
  };
}

let db: Database.Database | null = null;
afterEach(() => { db?.close(); db = null; });

describe('applyEvent — entities without mirror', () => {
  it('returns skipped-no-mirror for an aggregateType absent from mirrorsByAggregate', () => {
    db = new Database(':memory:');
    const { plan, ddls } = setup();
    bootstrapProjections(db, ddls);
    const env = makeEnvelope({
      eventType: 'UserJoined', aggregateType: 'User', aggregateId: '7', version: 1,
    });
    expect(applyEvent(db, plan, env)).toBe('skipped-no-mirror');
  });

  it('returns skipped-no-mirror for an unknown eventType on a mirrored aggregate', () => {
    db = new Database(':memory:');
    const { plan, ddls } = setup();
    bootstrapProjections(db, ddls);
    const env = makeEnvelope({
      eventType: 'IssueFoo', aggregateType: 'Issue', aggregateId: '1', version: 1,
    });
    expect(applyEvent(db, plan, env)).toBe('skipped-no-mirror');
  });
});
```

- [ ] **Step 8: Run tests to verify they fail**

```bash
pnpm --filter @rntme/projection-consumer test -- bind apply
```
Expected: FAIL — `bindValues` / `applyEvent` not defined.

- [ ] **Step 9: Create `packages/projection-consumer/src/apply/bind.ts`**

```ts
import type { EventEnvelope } from '@rntme/event-store';
import type { CompiledHandler, ColumnBinding } from '../types/apply.js';

/** Resolve each binding to a concrete SQL param value, in order. */
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
      return b.sqlType === 'INTEGER' ? Number(envelope.aggregateId) : envelope.aggregateId;
    case 'payloadField':
      return after[b.fieldName] ?? null;
    case 'generatedOccurred':
      return envelope.occurredAt;
    case 'generatedActor':
      return envelope.actor?.id ?? null;
    case 'nullable':
      return null;
    case 'eventId':
      return envelope.eventId;
    case 'eventVersion':
      return envelope.version;
    case 'appliedAt':
      return appliedAt;
  }
}

function getAfter(envelope: EventEnvelope): Record<string, unknown> {
  const p = envelope.payload as { after?: Record<string, unknown> } | null;
  return (p && typeof p === 'object' && p.after) ? p.after : {};
}
```

- [ ] **Step 10: Create `packages/projection-consumer/src/apply/apply-event.ts`**

```ts
import type { Database as BetterSqliteDatabase } from 'better-sqlite3';
import type { EventEnvelope } from '@rntme/event-store';
import type { ApplyPlan, ApplyResult, CompiledHandler } from '../types/apply.js';
import { bindValues } from './bind.js';

/**
 * Apply one event envelope to its entity-mirror projection.
 * Idempotency layers (spec §6.5):
 *   1. pre-check: SELECT last_event_version WHERE key = ?; skip if row.version ≥ ev.version
 *   2. INSERT ON CONFLICT DO UPDATE WHERE excluded.version > current (for creation)
 *   3. UPDATE ... WHERE version < new (for non-creation)
 * Returns:
 *   - 'skipped-no-mirror'      — aggregateType has no entity-mirror, or eventType not in plan
 *   - 'skipped-older-version'  — projection already at-or-ahead of this event
 *   - 'applied'                — row inserted or updated
 */
export function applyEvent(
  db: BetterSqliteDatabase,
  plan: ApplyPlan,
  envelope: EventEnvelope,
): ApplyResult {
  const handler = plan.handlersByEventType.get(envelope.eventType);
  if (!handler) return 'skipped-no-mirror';
  if (handler.aggregateType !== envelope.aggregateType) return 'skipped-no-mirror';

  const currentVersion = selectCurrentVersion(db, handler, envelope.aggregateId);
  if (currentVersion !== null && currentVersion >= envelope.version) {
    return 'skipped-older-version';
  }

  const params = bindValues(handler, envelope);
  const info = db.prepare(handler.sql).run(...params);
  return info.changes > 0 ? 'applied' : 'skipped-older-version';
}

function selectCurrentVersion(
  db: BetterSqliteDatabase,
  handler: CompiledHandler,
  aggregateId: string,
): number | null {
  const sql = `SELECT "last_event_version" AS v FROM "${handler.tableName}" WHERE "${handler.keyColumn}" = ?`;
  // MVP: integer-key vs text-key coercion matches bind.ts's aggregateId binding.
  const keyBinding = handler.bindings.find((b) => b.kind === 'aggregateId')!;
  const key = keyBinding.kind === 'aggregateId' && keyBinding.sqlType === 'INTEGER'
    ? Number(aggregateId)
    : aggregateId;
  const row = db.prepare(sql).get(key) as { v: number } | undefined;
  return row ? row.v : null;
}
```

- [ ] **Step 11: Re-export from `src/index.ts`**

Add:

```ts
export { bindValues } from './apply/bind.js';
export { applyEvent } from './apply/apply-event.js';
```

- [ ] **Step 12: Run tests to verify they pass**

```bash
pnpm --filter @rntme/projection-consumer test -- bind apply
pnpm --filter @rntme/projection-consumer typecheck
```
Expected: all 17+ tests pass, typecheck clean.

- [ ] **Step 13: Commit**

```bash
git add packages/projection-consumer/src packages/projection-consumer/test
git commit -m "feat(projection-consumer): applyEvent with 3-layer idempotency + value binding"
```

---

## Task 8: createProjectionConsumer — batch loop + offset commit

**Files:**
- Create: `packages/projection-consumer/src/consumer.ts`
- Create: `packages/projection-consumer/test/unit/consumer-loop.test.ts`
- Create: `packages/projection-consumer/test/unit/consumer-rollback.test.ts`

- [ ] **Step 1: Write failing test `packages/projection-consumer/test/unit/consumer-loop.test.ts`**

```ts
import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import {
  parsePdm, validatePdm, createPdmResolver, deriveEventTypes,
} from '@rntme/pdm';
import { parseQsm, validateQsm, generateProjectionDdl } from '@rntme/qsm';
import { compileApplyPlan } from '../../src/apply/compile.js';
import { bootstrapProjections } from '../../src/store/bootstrap.js';
import { createInMemoryKafkaConsumer } from '../../src/kafka/in-memory.js';
import { createProjectionConsumer } from '../../src/consumer.js';
import { issueLifecycle } from '../fixtures/envelopes.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(here, '..', 'fixtures');

function setup() {
  const pdmRaw = parsePdm(readFileSync(join(fixtureDir, 'issue-tracker.pdm.json'), 'utf8'));
  if (!pdmRaw.ok) throw new Error();
  const pdm = validatePdm(pdmRaw.value);
  if (!pdm.ok) throw new Error();
  const resolver = createPdmResolver(pdm.value);
  const events = deriveEventTypes(pdm.value);
  const qsmRaw = parseQsm(readFileSync(join(fixtureDir, 'issue-tracker.qsm.json'), 'utf8'));
  if (!qsmRaw.ok) throw new Error();
  const qsm = validateQsm(qsmRaw.value, resolver);
  if (!qsm.ok) throw new Error();
  return {
    plan: compileApplyPlan({ pdm: resolver, qsm: qsm.value, events }),
    ddls: generateProjectionDdl(qsm.value, resolver),
  };
}

async function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

let db: Database.Database | null = null;
afterEach(() => { db?.close(); db = null; });

describe('createProjectionConsumer — batch loop', () => {
  it('applies every message in the batch in one SQLite transaction and commits offsets after DB COMMIT', async () => {
    db = new Database(':memory:');
    const { plan, ddls } = setup();
    bootstrapProjections(db, ddls);

    const kafka = createInMemoryKafkaConsumer();
    const consumer = createProjectionConsumer({ kafka, plan, db });

    consumer.start();
    const lifecycle = issueLifecycle('1');
    for (const env of lifecycle) kafka.produce(env);

    const deadline = Date.now() + 2000;
    while (kafka.committed.length < lifecycle.length && Date.now() < deadline) await wait(5);
    await consumer.stop();

    expect(kafka.committed).toHaveLength(lifecycle.length);
    const row = db.prepare('SELECT status, last_event_version FROM projection_issue WHERE id = 1').get() as Record<string, unknown>;
    expect(row.status).toBe('closed');
    expect(row.last_event_version).toBe(6);
  });

  it('stop() resolves the loop cleanly and is idempotent', async () => {
    db = new Database(':memory:');
    const { plan, ddls } = setup();
    bootstrapProjections(db, ddls);
    const kafka = createInMemoryKafkaConsumer();
    const consumer = createProjectionConsumer({ kafka, plan, db });
    consumer.start();
    await consumer.stop();
    await consumer.stop();
    expect(kafka.committed).toEqual([]);
  });

  it('events for aggregates without mirror are committed but do not insert rows', async () => {
    db = new Database(':memory:');
    const { plan, ddls } = setup();
    bootstrapProjections(db, ddls);
    const kafka = createInMemoryKafkaConsumer();
    const consumer = createProjectionConsumer({ kafka, plan, db });
    consumer.start();
    kafka.produce({
      eventId: 'u1', eventType: 'UserJoined', aggregateType: 'User', aggregateId: '7',
      stream: 'User-7', version: 1, occurredAt: '2026-04-14T10:00:00.000Z',
      actor: null, payload: { before: null, after: {} }, schemaVersion: 1,
    });
    const deadline = Date.now() + 1000;
    while (kafka.committed.length < 1 && Date.now() < deadline) await wait(5);
    await consumer.stop();

    expect(kafka.committed).toHaveLength(1);
    const rows = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='projection_user'").all();
    expect(rows).toEqual([]);
  });
});
```

- [ ] **Step 2: Write failing test `packages/projection-consumer/test/unit/consumer-rollback.test.ts`**

```ts
import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import {
  parsePdm, validatePdm, createPdmResolver, deriveEventTypes,
} from '@rntme/pdm';
import { parseQsm, validateQsm, generateProjectionDdl } from '@rntme/qsm';
import { compileApplyPlan } from '../../src/apply/compile.js';
import { bootstrapProjections } from '../../src/store/bootstrap.js';
import { createInMemoryKafkaConsumer } from '../../src/kafka/in-memory.js';
import { createProjectionConsumer } from '../../src/consumer.js';
import { issueLifecycle, makeEnvelope } from '../fixtures/envelopes.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(here, '..', 'fixtures');

function setup() {
  const pdmRaw = parsePdm(readFileSync(join(fixtureDir, 'issue-tracker.pdm.json'), 'utf8'));
  if (!pdmRaw.ok) throw new Error();
  const pdm = validatePdm(pdmRaw.value);
  if (!pdm.ok) throw new Error();
  const resolver = createPdmResolver(pdm.value);
  const events = deriveEventTypes(pdm.value);
  const qsmRaw = parseQsm(readFileSync(join(fixtureDir, 'issue-tracker.qsm.json'), 'utf8'));
  if (!qsmRaw.ok) throw new Error();
  const qsm = validateQsm(qsmRaw.value, resolver);
  if (!qsm.ok) throw new Error();
  return {
    plan: compileApplyPlan({ pdm: resolver, qsm: qsm.value, events }),
    ddls: generateProjectionDdl(qsm.value, resolver),
  };
}

async function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

let db: Database.Database | null = null;
afterEach(() => { db?.close(); db = null; });

describe('createProjectionConsumer — rollback on failure', () => {
  it('throws in apply (NOT NULL violation) → ROLLBACK → no offset commit + no persisted rows', async () => {
    db = new Database(':memory:');
    const { plan, ddls } = setup();
    bootstrapProjections(db, ddls);

    const kafka = createInMemoryKafkaConsumer();
    // Silence the uncaught error that the loop re-throws; test only asserts DB + commit state.
    const errors: unknown[] = [];
    const consumer = createProjectionConsumer({
      kafka, plan, db,
      onError: (err) => errors.push(err),
    });
    consumer.start();

    // Valid first event (would succeed on its own)
    kafka.produce(issueLifecycle('1')[0]!);
    // Invalid second event in the SAME batch: missing required payload fields → NOT NULL violation
    kafka.produce(makeEnvelope({
      eventId: 'bad', eventType: 'IssueReport', aggregateId: '2', version: 1,
      payload: { before: null, after: { status: 'draft' } }, // missing title, projectId, ...
    }));

    const deadline = Date.now() + 2000;
    while (errors.length === 0 && Date.now() < deadline) await wait(5);
    await consumer.stop();

    expect(errors.length).toBeGreaterThan(0);
    // Entire batch rolled back — no rows, no commits
    const count = db.prepare('SELECT COUNT(*) AS c FROM projection_issue').get() as { c: number };
    expect(count.c).toBe(0);
    expect(kafka.committed).toEqual([]);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
pnpm --filter @rntme/projection-consumer test -- consumer
```
Expected: FAIL — `createProjectionConsumer` not defined.

- [ ] **Step 4: Create `packages/projection-consumer/src/consumer.ts`**

```ts
import type { Database as BetterSqliteDatabase } from 'better-sqlite3';
import type { KafkaConsumer } from './types/consumer.js';
import type { ApplyPlan } from './types/apply.js';
import { applyEvent } from './apply/apply-event.js';

export type ProjectionConsumerOptions = Readonly<{
  kafka: KafkaConsumer;
  plan: ApplyPlan;
  db: BetterSqliteDatabase;
  /** Called when a batch fails and is rolled back. Default: log + stop. */
  onError?: (err: unknown) => void;
}>;

export type ProjectionConsumer = Readonly<{
  start(): void;
  stop(): Promise<void>;
}>;

export function createProjectionConsumer(opts: ProjectionConsumerOptions): ProjectionConsumer {
  const onError = opts.onError ?? ((err) => {
    // eslint-disable-next-line no-console
    console.error('[projection-consumer] batch failed, rolled back:', err);
  });

  let running = false;
  let donePromise: Promise<void> | null = null;

  async function loop(): Promise<void> {
    for await (const batch of opts.kafka) {
      if (!running) break;
      if (batch.messages.length === 0) continue;
      try {
        opts.db.exec('BEGIN IMMEDIATE');
        for (const msg of batch.messages) {
          applyEvent(opts.db, opts.plan, msg.envelope);
        }
        opts.db.exec('COMMIT');
      } catch (err) {
        try { opts.db.exec('ROLLBACK'); } catch { /* noop */ }
        onError(err);
        continue;   // don't commit offsets; next poll will re-deliver
      }
      await opts.kafka.commitOffsets(batch);
    }
  }

  return {
    start(): void {
      if (running) return;
      running = true;
      donePromise = loop().catch((err) => {
        // eslint-disable-next-line no-console
        console.error('[projection-consumer] loop crashed:', err);
      });
    },
    async stop(): Promise<void> {
      running = false;
      // Poke underlying consumer if it has `.stop`
      const maybeStop = (opts.kafka as { stop?: () => void }).stop;
      if (typeof maybeStop === 'function') maybeStop.call(opts.kafka);
      if (donePromise) await donePromise;
      donePromise = null;
    },
  };
}
```

- [ ] **Step 5: Re-export from `src/index.ts`**

Final `packages/projection-consumer/src/index.ts`:

```ts
export const VERSION = '0.0.0';

// Types
export type { KafkaBatch, ConsumedMessage, KafkaConsumer } from './types/consumer.js';
export type {
  ApplyPlan, CompiledHandler, ColumnBinding, ApplyResult,
} from './types/apply.js';
export { ApplyCompileError } from './types/errors.js';
export type { ApplyCompileErrorCode } from './types/errors.js';

// Kafka
export { createInMemoryKafkaConsumer } from './kafka/in-memory.js';
export type { InMemoryKafkaConsumer } from './kafka/in-memory.js';

// Bootstrap + apply
export { bootstrapProjections } from './store/bootstrap.js';
export { compileApplyPlan } from './apply/compile.js';
export { bindValues } from './apply/bind.js';
export { applyEvent } from './apply/apply-event.js';

// Consumer
export { createProjectionConsumer } from './consumer.js';
export type { ProjectionConsumer, ProjectionConsumerOptions } from './consumer.js';
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
pnpm --filter @rntme/projection-consumer test -- consumer
pnpm --filter @rntme/projection-consumer typecheck
pnpm --filter @rntme/projection-consumer lint
```
Expected: all tests pass, typecheck clean, lint clean.

- [ ] **Step 7: Commit**

```bash
git add packages/projection-consumer/src packages/projection-consumer/test
git commit -m "feat(projection-consumer): createProjectionConsumer batch loop with rollback-on-fail"
```

---

## Task 9: Smoke end-to-end test

**Files:**
- Modify: `packages/projection-consumer/test/smoke.test.ts`

- [ ] **Step 1: Replace smoke test with full PDM → QSM → DDL → consumer → Issue-lifecycle pipeline**

Replace the contents of `packages/projection-consumer/test/smoke.test.ts`:

```ts
import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import {
  parsePdm, validatePdm, createPdmResolver, deriveEventTypes,
} from '@rntme/pdm';
import {
  parseQsm, validateQsm, generateProjectionDdl,
} from '@rntme/qsm';
import {
  VERSION,
  bootstrapProjections,
  compileApplyPlan,
  createInMemoryKafkaConsumer,
  createProjectionConsumer,
} from '../src/index.js';
import { issueLifecycle } from './fixtures/envelopes.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(here, 'fixtures');

async function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

let db: Database.Database | null = null;
afterEach(() => { db?.close(); db = null; });

describe('smoke: @rntme/projection-consumer end-to-end', () => {
  it('exports VERSION', () => {
    expect(VERSION).toBe('0.0.0');
  });

  it('pipeline parse → validate → bootstrap DDL → compile plan → consume → projection reflects final state', async () => {
    // PDM
    const pdmRaw = parsePdm(readFileSync(join(fixtureDir, 'issue-tracker.pdm.json'), 'utf8'));
    expect(pdmRaw.ok).toBe(true);
    if (!pdmRaw.ok) return;
    const pdm = validatePdm(pdmRaw.value);
    expect(pdm.ok).toBe(true);
    if (!pdm.ok) return;
    const pdmResolver = createPdmResolver(pdm.value);
    const events = deriveEventTypes(pdm.value);

    // QSM
    const qsmRaw = parseQsm(readFileSync(join(fixtureDir, 'issue-tracker.qsm.json'), 'utf8'));
    expect(qsmRaw.ok).toBe(true);
    if (!qsmRaw.ok) return;
    const qsm = validateQsm(qsmRaw.value, pdmResolver);
    expect(qsm.ok).toBe(true);
    if (!qsm.ok) return;

    // Runtime: SQLite + DDL + plan
    db = new Database(':memory:');
    const ddls = generateProjectionDdl(qsm.value, pdmResolver);
    bootstrapProjections(db, ddls);
    const plan = compileApplyPlan({ pdm: pdmResolver, qsm: qsm.value, events });

    // Kafka in-memory harness + consumer
    const kafka = createInMemoryKafkaConsumer();
    const consumer = createProjectionConsumer({ kafka, plan, db });
    consumer.start();

    // Drive the canonical lifecycle (spec §7.5 acceptance)
    const lifecycle = issueLifecycle('1');
    for (const env of lifecycle) kafka.produce(env);
    const deadline = Date.now() + 3000;
    while (kafka.committed.length < lifecycle.length && Date.now() < deadline) await wait(5);
    await consumer.stop();

    // Final state assertions
    expect(kafka.committed).toHaveLength(lifecycle.length);
    const row = db.prepare('SELECT * FROM projection_issue WHERE id = 1').get() as Record<string, unknown>;
    expect(row).toMatchObject({
      id: 1,
      status: 'closed',
      title: 'Hello',
      project_id: 7,
      reporter_id: 42,
      assignee_id: 100,
      priority: 'high',
      story_points: 5,
      resolved_at: '2026-04-14T10:04:00.000Z',
      created_at: '2026-04-14T10:00:00.000Z',
      last_event_id: 'e6',
      last_event_version: 6,
    });
  });

  it('idempotent under Kafka duplicate delivery (at-least-once)', async () => {
    const pdmRaw = parsePdm(readFileSync(join(fixtureDir, 'issue-tracker.pdm.json'), 'utf8'));
    if (!pdmRaw.ok) return;
    const pdm = validatePdm(pdmRaw.value);
    if (!pdm.ok) return;
    const pdmResolver = createPdmResolver(pdm.value);
    const events = deriveEventTypes(pdm.value);
    const qsmRaw = parseQsm(readFileSync(join(fixtureDir, 'issue-tracker.qsm.json'), 'utf8'));
    if (!qsmRaw.ok) return;
    const qsm = validateQsm(qsmRaw.value, pdmResolver);
    if (!qsm.ok) return;

    db = new Database(':memory:');
    bootstrapProjections(db, generateProjectionDdl(qsm.value, pdmResolver));
    const plan = compileApplyPlan({ pdm: pdmResolver, qsm: qsm.value, events });

    const kafka = createInMemoryKafkaConsumer();
    const consumer = createProjectionConsumer({ kafka, plan, db });
    consumer.start();

    const lifecycle = issueLifecycle('1');
    // Deliver each event TWICE (simulating at-least-once)
    for (const env of lifecycle) { kafka.produce(env); kafka.produce(env); }

    const expected = lifecycle.length * 2;
    const deadline = Date.now() + 3000;
    while (kafka.committed.length < expected && Date.now() < deadline) await wait(5);
    await consumer.stop();

    expect(kafka.committed).toHaveLength(expected);
    // Still exactly one row, at final state
    const rows = db.prepare('SELECT * FROM projection_issue').all() as Record<string, unknown>[];
    expect(rows).toHaveLength(1);
    expect(rows[0]!.status).toBe('closed');
    expect(rows[0]!.last_event_version).toBe(6);
  });
});
```

- [ ] **Step 2: Run full test suite**

```bash
pnpm --filter @rntme/projection-consumer test
pnpm --filter @rntme/projection-consumer typecheck
pnpm --filter @rntme/projection-consumer lint
pnpm --filter @rntme/projection-consumer build
```
Expected: all pass; smoke reports 3 passing tests (VERSION + pipeline + idempotent duplicate delivery).

- [ ] **Step 3: Run full monorepo test suite (regression check)**

```bash
pnpm -r run test
pnpm -r run lint
```
Expected: all packages green.

- [ ] **Step 4: Commit**

```bash
git add packages/projection-consumer/test/smoke.test.ts
git commit -m "test(projection-consumer): e2e smoke — parse → validate → bootstrap → compile → consume → final state"
```

---

## Spec Coverage Check

Cross-reference against `docs/superpowers/specs/2026-04-14-mutations-design.md` §6 requirements:

| Spec section | Requirement | Task(s) |
|---|---|---|
| §6.1 | `backing: "entity-mirror"` projections reach SQLite physical tables | Task 4 (bootstrap), Task 5/6 (compile) |
| §6.2 | Auto-derive DDL + consumer handler from PDM+stateMachine | Task 4 (uses `@rntme/qsm` DDL), Task 5/6 (uses `@rntme/qsm` ProjectionHandlerSpec) |
| §6.3 | Mirror has idempotency columns `last_event_id`, `last_event_version`, `applied_at` | Task 4 (verified in test), Tasks 5/6/7 (bind + write them) |
| §6.4 | Consumer loop: batch TX → COMMIT → commitOffsets | Task 8 (`consumer.ts`) |
| §6.5 | Idempotent `applyEvent`: three guards (version pre-check, INSERT ON CONFLICT DO UPDATE WHERE excluded.version>current, UPDATE WHERE version<new) | Task 7 (`apply-event.ts`) + compile SQL from Tasks 5/6 |
| §6.5 | Entity without mirror → skip | Task 7 (`apply-unknown-aggregate.test.ts`) |
| §6.6 | Offset tracking via Kafka consumer-group offsets + `last_event_version` guard on replay | Task 8 commits after DB COMMIT; Task 7 `apply-idempotent.test.ts` covers out-of-order/replay |
| §6.7 | Kafka consumer-group partition key = stream → per-aggregate serialization | Task 3 `KafkaConsumer` abstraction — external concern, but `key: envelope.stream` documented |
| §6.9 | Deferred tier-2: derived projections, replay tooling, DLQ | `backing: "derived"` rejected by `@rntme/qsm` upstream; doc'd in README + MVP scope of this plan |
| §2.6 | `generated` fields filled by consumer (`createdAt`, `updatedAt`, `actor`) | Task 5 (insert binding), Task 6 (update also bumps `updatedAt` when the entity declares one) |
| §7.5 E2E | `report → submit → assign → reassign → resolve → close` full cycle | Task 7 `apply-update.test.ts` + Task 9 smoke |
| §7.7 Package layout | Package dir + files match spec | All tasks |

Gaps: none. Composite-key aggregates are explicitly tier 2 (Task 5 rejects them with `PC_COMPOSITE_KEY_NOT_SUPPORTED`). Multi-instance consumer-group coordination is outside package scope (external to Kafka client). Upcasting old `schemaVersion` is outside MVP.

---

## Placeholder Scan

No "TBD", "TODO", "implement later", "add appropriate error handling", or "similar to task N" phrases. Every step that writes code contains the full code. Every CLI step has the exact command + expected outcome.

---

## Type Consistency Check

- `ApplyPlan`, `CompiledHandler`, `ColumnBinding`, `ApplyResult` defined in Task 5, used unchanged in Tasks 6/7/8/9.
- `compileApplyPlan` signature `({ pdm, qsm, events })` consistent across Tasks 5/6 and all test files.
- `applyEvent(db, plan, envelope)` signature consistent between Tasks 7/8.
- `createProjectionConsumer({ kafka, plan, db, onError? })` consistent between Tasks 8/9.
- `bootstrapProjections(db, ddls)` consistent between Tasks 4/7/8/9.
- `createInMemoryKafkaConsumer({ topicOf?, pollIntervalMs? })` and its `produce/stop/committed` surface consistent between Tasks 3/8/9.
- `ApplyCompileError.code` enum values (`PC_COMPOSITE_KEY_NOT_SUPPORTED`, `PC_COLUMN_SOURCE_UNRESOLVABLE`, `PC_MISSING_ENTITY_FIELD`) referenced only in Tasks 2/5 and kept identical.

---

**Plan complete.**
