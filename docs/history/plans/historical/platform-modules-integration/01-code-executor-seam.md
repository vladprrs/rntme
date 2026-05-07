> Status: historical.
> Date: unknown.
> Current source: docs/current/**, docs/decision-system.md, and current code/tests.
> Why retained: Historical rationale and execution context retained for review; it is not current-state truth by itself.

# Code Executor Seam & Module Skeleton Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. User preference: **skip plan-internal review checkpoints during execution**; run to completion autonomously.

**Goal:** Add `CommandExecutor` / `QueryExecutor` plugin seams to `@rntme/runtime` so that a service can be executed by something other than `graph-ir-compiler` (specifically: hand-written TypeScript handlers for platform modules). Ship the default graph-IR-backed executors (no behaviour change for existing services), a `CodeCommandExecutor` alternative, contract tests, a reusable `packages/module-skeleton/` starter, and the HTTP health-check convention.

**Architecture:** Two new plugin interfaces in `@rntme/runtime` (`CommandExecutor`, `QueryExecutor`). The existing synchronous `executeCommand(compiled, inputs, ctx)` from `@rntme/graph-ir-compiler` gets wrapped into an async, `Result`-returning `GraphIrCommandExecutor` that owns `Map<commandName, CompiledCommand>`. `bindings-http`'s `CommandBindingPlan` loses its inline `compiled` field; instead, the executor is injected via `BindingsRouterOptions.commandExecutor`, defaulting to a freshly-built `GraphIrCommandExecutor` so existing callers keep working. Modules replace the executor with a `CodeCommandExecutor` backed by a `Record<commandName, (ctx, input) => Promise<Result<CommandResult>>>`. Queries get the same interface-plus-default treatment but no runtime refactor in this plan (makeHandler already uses compiled SQL — seam added for forward-compatibility).

**Tech Stack:** Node 20, TypeScript strict, ESM, Vitest, pnpm workspaces. Spec: `docs/history/specs/historical/2026-04-19-platform-modules-integration-design.md` §5, §6, §12.

---

## File Structure

### New files

```
packages/runtime/
  src/
    plugins/
      executors/
        types.ts                          ← CommandExecutor, QueryExecutor, CommandExecutorError, shared types
        graph-ir-command-executor.ts      ← GraphIrCommandExecutor (default)
        graph-ir-query-executor.ts        ← GraphIrQueryExecutor (default)
        code-command-executor.ts          ← CodeCommandExecutor (handler map)
        index.ts                          ← barrel
  test/
    unit/
      graph-ir-command-executor.test.ts
      code-command-executor.test.ts

packages/module-skeleton/
  package.json
  tsconfig.json
  tsconfig.check.json
  vitest.config.ts
  eslint.config.mjs                       ← copied from runtime
  README.md
  src/
    index.ts                              ← barrel (re-exports handlers + bootModule placeholder)
    handlers.ts                           ← example handler map with `echo` command
    manifest-shape.ts                     ← minimal manifest schema for modules (for plan 2 to extend)
  test/
    unit/
      handlers.test.ts                    ← tests echo handler contract
      boot-skeleton.test.ts               ← wires CodeCommandExecutor + runs a handler smoke-test
```

### Modified files

```
packages/runtime/src/
  plugins/interfaces.ts                   ← re-export executor interfaces (barrel-level only)
  plugins/contract-tests.ts               ← add runCommandExecutorContract, runQueryExecutorContract
  start/start-service.ts                  ← add commandExecutor / queryExecutor to RuntimeConfig
  types.ts                                ← no change (ValidatedService still applies to domain services)
  index.ts                                ← export new executor types + default impls

packages/runtime/test/integration/
  plugin-contracts.test.ts                ← run new executor contract suites on defaults

packages/bindings-http/src/
  startup/compile-plan.ts                 ← CommandBindingPlan loses inline `compiled`; keep only route metadata
  runtime/command-handler.ts              ← call commandExecutor.execute(...) instead of raw executeCommand
  router.ts                               ← add commandExecutor to BindingsRouterOptions; build default if absent
  index.ts                                ← export CommandExecutor-related types if needed

packages/bindings-http/test/
  — existing tests stay green (no new tests required in this package, regression-only)

docs/
  superpowers/specs/2026-04-19-platform-modules-integration-design.md   ← add cross-link "Plan 1 status: implementing"
  AGENTS.md                               ← §6 new entry "6.11 Add a platform module" pointing to module-skeleton
  adr/                                    ← no ADR in this plan

pnpm-workspace.yaml                       ← no change (packages/* already globs module-skeleton)
```

### Out of scope (go to later plans)

- `@rntme/bindings-grpc` (plan 2)
- `ExternalAdapterClient` + `pre[]` middleware + idempotency chain (plan 3)
- `method`/`inputFrom`/`response` on command binding (plan 4)
- Reference Stripe module (plan 5)
- `startModule` bootstrap — module-skeleton demonstrates handler shape only; true module boot waits for gRPC in plan 2

---

## Phase 1 — Executor interfaces

### Task 1: Define `CommandExecutor` interface and supporting types

**Files:**
- Create: `packages/runtime/src/plugins/executors/types.ts`

- [ ] **Step 1: Create the types file**

```ts
// packages/runtime/src/plugins/executors/types.ts
import type BetterSqlite3 from 'better-sqlite3';
import type { EventStore, ActorRef } from '@rntme/event-store';

export type CorrelationCtx = Readonly<{
  commandId: string;
  correlationId: string;
  traceparent: string | null;
}>;

export type CommandExecutionContext = {
  eventStore: EventStore;
  qsmDb: BetterSqlite3.Database | null;
  now: () => string;
  nextId: () => string;
  actor: ActorRef | null;
  correlation: CorrelationCtx;
};

export type CommandExecutionResult = Readonly<{
  aggregateId: string;
  version: number;
  eventIds: readonly string[];
  commandId: string;
  correlationId: string;
}>;

export type CommandExecutorErrorCode =
  | 'COMMAND_NOT_FOUND'
  | 'COMMAND_GUARD_REJECTED'
  | 'COMMAND_CONCURRENCY_CONFLICT'
  | 'COMMAND_HANDLER_THREW'
  | 'COMMAND_HANDLER_ERROR';

export type CommandExecutorError = Readonly<{
  code: CommandExecutorErrorCode;
  message: string;
  detail?: unknown;
}>;

export type CommandExecutorOk = { ok: true; value: CommandExecutionResult };
export type CommandExecutorErr = { ok: false; error: CommandExecutorError };
export type CommandExecutorOutput = CommandExecutorOk | CommandExecutorErr;

export type CommandExecutorInput = {
  commandName: string;
  inputs: Record<string, unknown>;
  ctx: CommandExecutionContext;
};

export interface CommandExecutor {
  execute(input: CommandExecutorInput): Promise<CommandExecutorOutput>;
}

export type QueryExecutionContext = {
  qsmDb: BetterSqlite3.Database;
};

export type QueryExecutorErrorCode = 'QUERY_NOT_FOUND' | 'QUERY_HANDLER_THREW';

export type QueryExecutorError = Readonly<{
  code: QueryExecutorErrorCode;
  message: string;
  detail?: unknown;
}>;

export type QueryExecutorOk = { ok: true; value: unknown };
export type QueryExecutorErr = { ok: false; error: QueryExecutorError };
export type QueryExecutorOutput = QueryExecutorOk | QueryExecutorErr;

export type QueryExecutorInput = {
  queryName: string;
  inputs: Record<string, unknown>;
  ctx: QueryExecutionContext;
};

export interface QueryExecutor {
  execute(input: QueryExecutorInput): Promise<QueryExecutorOutput>;
}
```

- [ ] **Step 2: Create barrel**

```ts
// packages/runtime/src/plugins/executors/index.ts
export * from './types.js';
```

- [ ] **Step 3: Typecheck and lint**

Run: `pnpm -F @rntme/runtime typecheck && pnpm -F @rntme/runtime lint`
Expected: PASS (no test file yet — lint may warn on empty dir, ignore).

- [ ] **Step 4: Commit**

```bash
git add packages/runtime/src/plugins/executors/
git commit -m "feat(runtime): add CommandExecutor and QueryExecutor interface types"
```

---

## Phase 2 — GraphIrCommandExecutor (default)

### Task 2: Write failing unit test for `GraphIrCommandExecutor` happy path

**Files:**
- Create: `packages/runtime/test/unit/graph-ir-command-executor.test.ts`

- [ ] **Step 1: Write the test**

```ts
// packages/runtime/test/unit/graph-ir-command-executor.test.ts
import { describe, it, expect } from 'vitest';
import { SqliteEventStore } from '@rntme/event-store';
import type { CompiledCommand } from '@rntme/graph-ir-compiler';
import { GraphIrCommandExecutor } from '../../src/plugins/executors/graph-ir-command-executor.js';
import type { CommandExecutionContext } from '../../src/plugins/executors/types.js';

function mkCtx(): CommandExecutionContext {
  const store = new SqliteEventStore({ filename: ':memory:', serviceName: 'test' });
  let idc = 0;
  return {
    eventStore: store,
    qsmDb: null,
    now: () => '2026-04-19T00:00:00.000Z',
    nextId: () => `id-${++idc}`,
    actor: null,
    correlation: { commandId: 'cmd-1', correlationId: 'corr-1', traceparent: null },
  };
}

function mkCompiled(): CompiledCommand {
  // A hand-constructed, minimal CompiledCommand that emits a single event on aggregate `A`.
  // Mirrors shapes used in packages/graph-ir-compiler tests; see src/types/command.ts.
  return {
    readPrelude: null,
    readPreludeGuardNodeId: null,
    emits: [
      {
        eventType: 'NoopHappened',
        aggregate: 'A',
        aggregateIdExpr: { kind: 'param', name: 'id' },
        affects: ['status'],
        payloadExprs: { status: { kind: 'const', value: 'done' } },
        legalTransitions: { from: [null], to: 'done' },
      } as unknown as CompiledCommand['emits'][number],
    ],
  } as CompiledCommand;
}

describe('GraphIrCommandExecutor', () => {
  it('executes a known command and returns success', async () => {
    const executor = new GraphIrCommandExecutor({ noopCmd: mkCompiled() });
    const out = await executor.execute({
      commandName: 'noopCmd',
      inputs: { id: 'A-1' },
      ctx: mkCtx(),
    });
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.value.aggregateId).toBe('A-1');
      expect(out.value.version).toBe(1);
      expect(out.value.eventIds).toHaveLength(1);
    }
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm -F @rntme/runtime vitest run test/unit/graph-ir-command-executor.test.ts`
Expected: FAIL ("Cannot find module .../graph-ir-command-executor.js").

---

### Task 3: Implement `GraphIrCommandExecutor`

**Files:**
- Create: `packages/runtime/src/plugins/executors/graph-ir-command-executor.ts`

- [ ] **Step 1: Create implementation**

```ts
// packages/runtime/src/plugins/executors/graph-ir-command-executor.ts
import {
  executeCommand,
  CommandExecutionError,
  type CompiledCommand,
} from '@rntme/graph-ir-compiler';
import type {
  CommandExecutor,
  CommandExecutorInput,
  CommandExecutorOutput,
  CommandExecutorError,
} from './types.js';

export type GraphIrCommandMap = Record<string, CompiledCommand>;

export class GraphIrCommandExecutor implements CommandExecutor {
  private readonly commands: GraphIrCommandMap;

  constructor(commands: GraphIrCommandMap) {
    this.commands = commands;
  }

  async execute(input: CommandExecutorInput): Promise<CommandExecutorOutput> {
    const compiled = this.commands[input.commandName];
    if (compiled === undefined) {
      return {
        ok: false,
        error: {
          code: 'COMMAND_NOT_FOUND',
          message: `no compiled command registered for name "${input.commandName}"`,
        },
      };
    }

    try {
      const result = executeCommand(compiled, input.inputs, input.ctx);
      return { ok: true, value: result };
    } catch (e) {
      return { ok: false, error: mapError(e) };
    }
  }
}

function mapError(e: unknown): CommandExecutorError {
  if (e instanceof CommandExecutionError) {
    const code = e.code === 'COMMAND_CONCURRENCY_CONFLICT'
      ? 'COMMAND_CONCURRENCY_CONFLICT'
      : 'COMMAND_GUARD_REJECTED';
    return { code, message: e.message, detail: e.detail };
  }
  return {
    code: 'COMMAND_HANDLER_THREW',
    message: e instanceof Error ? e.message : String(e),
    detail: e instanceof Error ? { name: e.name } : undefined,
  };
}
```

- [ ] **Step 2: Run test to verify it passes**

Run: `pnpm -F @rntme/runtime vitest run test/unit/graph-ir-command-executor.test.ts`
Expected: PASS (happy-path test from Task 2).

- [ ] **Step 3: Commit**

```bash
git add packages/runtime/src/plugins/executors/graph-ir-command-executor.ts \
        packages/runtime/test/unit/graph-ir-command-executor.test.ts
git commit -m "feat(runtime): add GraphIrCommandExecutor default implementation"
```

---

### Task 4: Add error-path tests for `GraphIrCommandExecutor`

**Files:**
- Modify: `packages/runtime/test/unit/graph-ir-command-executor.test.ts`

- [ ] **Step 1: Append tests**

```ts
// append inside the describe('GraphIrCommandExecutor', ...) block

it('returns COMMAND_NOT_FOUND for an unknown command name', async () => {
  const executor = new GraphIrCommandExecutor({});
  const out = await executor.execute({
    commandName: 'missing',
    inputs: {},
    ctx: mkCtx(),
  });
  expect(out.ok).toBe(false);
  if (!out.ok) {
    expect(out.error.code).toBe('COMMAND_NOT_FOUND');
    expect(out.error.message).toContain('missing');
  }
});

it('returns COMMAND_HANDLER_THREW when underlying executeCommand throws a non-CommandExecutionError', async () => {
  // Force a throw by passing a compiled command missing `emits`; executeCommand
  // throws a plain Error in that case ("executeCommand: no emits in compiled command").
  const brokenCompiled = { readPrelude: null, readPreludeGuardNodeId: null, emits: [] } as unknown as import('@rntme/graph-ir-compiler').CompiledCommand;
  const executor = new GraphIrCommandExecutor({ broken: brokenCompiled });
  const out = await executor.execute({
    commandName: 'broken',
    inputs: { id: 'A-1' },
    ctx: mkCtx(),
  });
  expect(out.ok).toBe(false);
  if (!out.ok) {
    expect(out.error.code).toBe('COMMAND_HANDLER_THREW');
    expect(out.error.message).toContain('no emits');
  }
});
```

- [ ] **Step 2: Run tests**

Run: `pnpm -F @rntme/runtime vitest run test/unit/graph-ir-command-executor.test.ts`
Expected: PASS (all three tests).

- [ ] **Step 3: Commit**

```bash
git add packages/runtime/test/unit/graph-ir-command-executor.test.ts
git commit -m "test(runtime): cover error paths of GraphIrCommandExecutor"
```

---

## Phase 3 — CodeCommandExecutor (alternative)

### Task 5: Write failing unit test for `CodeCommandExecutor`

**Files:**
- Create: `packages/runtime/test/unit/code-command-executor.test.ts`

- [ ] **Step 1: Write test**

```ts
// packages/runtime/test/unit/code-command-executor.test.ts
import { describe, it, expect } from 'vitest';
import { SqliteEventStore } from '@rntme/event-store';
import { CodeCommandExecutor } from '../../src/plugins/executors/code-command-executor.js';
import type { CommandExecutionContext } from '../../src/plugins/executors/types.js';

function mkCtx(): CommandExecutionContext {
  return {
    eventStore: new SqliteEventStore({ filename: ':memory:', serviceName: 'test' }),
    qsmDb: null,
    now: () => '2026-04-19T00:00:00.000Z',
    nextId: () => 'id-1',
    actor: null,
    correlation: { commandId: 'cmd-1', correlationId: 'corr-1', traceparent: null },
  };
}

describe('CodeCommandExecutor', () => {
  it('calls the registered handler and returns success', async () => {
    const executor = new CodeCommandExecutor({
      echo: async (_ctx, input) => ({
        ok: true,
        value: {
          aggregateId: String(input.id),
          version: 1,
          eventIds: ['id-1'],
          commandId: 'cmd-1',
          correlationId: 'corr-1',
        },
      }),
    });
    const out = await executor.execute({ commandName: 'echo', inputs: { id: 'X-1' }, ctx: mkCtx() });
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.value.aggregateId).toBe('X-1');
  });

  it('returns COMMAND_NOT_FOUND for unknown handler', async () => {
    const executor = new CodeCommandExecutor({});
    const out = await executor.execute({ commandName: 'nope', inputs: {}, ctx: mkCtx() });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error.code).toBe('COMMAND_NOT_FOUND');
  });

  it('converts handler throws into COMMAND_HANDLER_THREW', async () => {
    const executor = new CodeCommandExecutor({
      boom: async () => {
        throw new Error('kaboom');
      },
    });
    const out = await executor.execute({ commandName: 'boom', inputs: {}, ctx: mkCtx() });
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.error.code).toBe('COMMAND_HANDLER_THREW');
      expect(out.error.message).toContain('kaboom');
    }
  });

  it('passes through handler-returned errors', async () => {
    const executor = new CodeCommandExecutor({
      reject: async () => ({ ok: false, error: { code: 'COMMAND_HANDLER_ERROR', message: 'invalid price' } }),
    });
    const out = await executor.execute({ commandName: 'reject', inputs: {}, ctx: mkCtx() });
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.error.code).toBe('COMMAND_HANDLER_ERROR');
      expect(out.error.message).toBe('invalid price');
    }
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm -F @rntme/runtime vitest run test/unit/code-command-executor.test.ts`
Expected: FAIL (module missing).

---

### Task 6: Implement `CodeCommandExecutor`

**Files:**
- Create: `packages/runtime/src/plugins/executors/code-command-executor.ts`

- [ ] **Step 1: Create implementation**

```ts
// packages/runtime/src/plugins/executors/code-command-executor.ts
import type {
  CommandExecutor,
  CommandExecutorInput,
  CommandExecutorOutput,
  CommandExecutionContext,
} from './types.js';

export type CodeCommandHandler = (
  ctx: CommandExecutionContext,
  input: Record<string, unknown>,
) => Promise<CommandExecutorOutput>;

export type CodeCommandHandlerMap = Record<string, CodeCommandHandler>;

export class CodeCommandExecutor implements CommandExecutor {
  private readonly handlers: CodeCommandHandlerMap;

  constructor(handlers: CodeCommandHandlerMap) {
    this.handlers = handlers;
  }

  async execute(input: CommandExecutorInput): Promise<CommandExecutorOutput> {
    const handler = this.handlers[input.commandName];
    if (handler === undefined) {
      return {
        ok: false,
        error: {
          code: 'COMMAND_NOT_FOUND',
          message: `no code handler registered for command "${input.commandName}"`,
        },
      };
    }

    try {
      return await handler(input.ctx, input.inputs);
    } catch (e) {
      return {
        ok: false,
        error: {
          code: 'COMMAND_HANDLER_THREW',
          message: e instanceof Error ? e.message : String(e),
          detail: e instanceof Error ? { name: e.name, stack: e.stack } : e,
        },
      };
    }
  }
}
```

- [ ] **Step 2: Run tests to verify pass**

Run: `pnpm -F @rntme/runtime vitest run test/unit/code-command-executor.test.ts`
Expected: PASS (all four tests).

- [ ] **Step 3: Commit**

```bash
git add packages/runtime/src/plugins/executors/code-command-executor.ts \
        packages/runtime/test/unit/code-command-executor.test.ts
git commit -m "feat(runtime): add CodeCommandExecutor handler-map executor"
```

---

## Phase 4 — QueryExecutor default (interface only, minimal)

### Task 7: Implement `GraphIrQueryExecutor` skeleton

**Files:**
- Create: `packages/runtime/src/plugins/executors/graph-ir-query-executor.ts`

- [ ] **Step 1: Create file**

```ts
// packages/runtime/src/plugins/executors/graph-ir-query-executor.ts
// graph-ir-compiler public API (verified in packages/graph-ir-compiler/src/index.ts):
//   - `execute(compiled: CompileResult, paramValues, db): unknown[]`
//   - `CompileResult` is the value returned by `compile(...)` on success
import { execute as executeGraphIr, type CompileResult } from '@rntme/graph-ir-compiler';
import type {
  QueryExecutor,
  QueryExecutorInput,
  QueryExecutorOutput,
} from './types.js';

export type GraphIrQueryMap = Record<string, CompileResult>;

export class GraphIrQueryExecutor implements QueryExecutor {
  private readonly queries: GraphIrQueryMap;

  constructor(queries: GraphIrQueryMap) {
    this.queries = queries;
  }

  async execute(input: QueryExecutorInput): Promise<QueryExecutorOutput> {
    const compiled = this.queries[input.queryName];
    if (compiled === undefined) {
      return {
        ok: false,
        error: { code: 'QUERY_NOT_FOUND', message: `no compiled query for "${input.queryName}"` },
      };
    }
    try {
      const value = executeGraphIr(compiled, input.inputs, input.ctx.qsmDb);
      return { ok: true, value };
    } catch (e) {
      return {
        ok: false,
        error: {
          code: 'QUERY_HANDLER_THREW',
          message: e instanceof Error ? e.message : String(e),
          detail: e instanceof Error ? { name: e.name, stack: e.stack } : e,
        },
      };
    }
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm -F @rntme/runtime typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/runtime/src/plugins/executors/graph-ir-query-executor.ts
git commit -m "feat(runtime): add GraphIrQueryExecutor default implementation"
```

---

### Task 8: Barrel-export all executors

**Files:**
- Modify: `packages/runtime/src/plugins/executors/index.ts`
- Modify: `packages/runtime/src/plugins/interfaces.ts`
- Modify: `packages/runtime/src/index.ts`

- [ ] **Step 1: Update executor barrel**

Replace `packages/runtime/src/plugins/executors/index.ts` with:

```ts
export * from './types.js';
export { GraphIrCommandExecutor } from './graph-ir-command-executor.js';
export type { GraphIrCommandMap } from './graph-ir-command-executor.js';
export { GraphIrQueryExecutor } from './graph-ir-query-executor.js';
export type { GraphIrQueryMap } from './graph-ir-query-executor.js';
export { CodeCommandExecutor } from './code-command-executor.js';
export type { CodeCommandHandler, CodeCommandHandlerMap } from './code-command-executor.js';
```

- [ ] **Step 2: Re-export from plugins/interfaces.ts**

Append to `packages/runtime/src/plugins/interfaces.ts`:

```ts
export type {
  CommandExecutor,
  CommandExecutorInput,
  CommandExecutorOutput,
  CommandExecutorError,
  CommandExecutionContext,
  CommandExecutionResult,
  QueryExecutor,
  QueryExecutorInput,
  QueryExecutorOutput,
  QueryExecutorError,
  QueryExecutionContext,
  CorrelationCtx,
} from './executors/types.js';
```

- [ ] **Step 3: Update package barrel**

Append to `packages/runtime/src/index.ts`:

```ts
export * from './plugins/executors/index.js';
```

- [ ] **Step 4: Typecheck**

Run: `pnpm -F @rntme/runtime typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/runtime/src/plugins/executors/index.ts \
        packages/runtime/src/plugins/interfaces.ts \
        packages/runtime/src/index.ts
git commit -m "feat(runtime): barrel-export executor types and defaults"
```

---

## Phase 5 — Contract tests

### Task 9: Add `runCommandExecutorContract` and `runQueryExecutorContract`

**Files:**
- Modify: `packages/runtime/src/plugins/contract-tests.ts`

- [ ] **Step 1: Append contract helpers**

```ts
// append to packages/runtime/src/plugins/contract-tests.ts
import type {
  CommandExecutor,
  QueryExecutor,
  CommandExecutionContext,
} from './executors/types.js';
import { SqliteEventStore } from '@rntme/event-store';
import BetterSqlite3 from 'better-sqlite3';

function makeCommandCtx(): CommandExecutionContext {
  return {
    eventStore: new SqliteEventStore({ filename: ':memory:', serviceName: 'contract' }),
    qsmDb: null,
    now: () => '2026-04-19T00:00:00.000Z',
    nextId: () => 'id-1',
    actor: null,
    correlation: { commandId: 'cmd-1', correlationId: 'corr-1', traceparent: null },
  };
}

/**
 * `makeExecutor` must return an executor that knows the command name "contractEcho"
 * and emits at least one event when given `{ id: "X" }`.
 */
export function runCommandExecutorContract(
  label: string,
  makeExecutor: () => CommandExecutor,
): void {
  describe(`CommandExecutor contract — ${label}`, () => {
    it('execute returns ok for a known command', async () => {
      const executor = makeExecutor();
      const out = await executor.execute({
        commandName: 'contractEcho',
        inputs: { id: 'X' },
        ctx: makeCommandCtx(),
      });
      expect(out.ok).toBe(true);
    });

    it('execute returns COMMAND_NOT_FOUND for unknown command', async () => {
      const executor = makeExecutor();
      const out = await executor.execute({
        commandName: '__definitely_not_registered__',
        inputs: {},
        ctx: makeCommandCtx(),
      });
      expect(out.ok).toBe(false);
      if (!out.ok) expect(out.error.code).toBe('COMMAND_NOT_FOUND');
    });
  });
}

/**
 * `makeExecutor` must know a query named "contractNoop" that returns `[]` for any input.
 */
export function runQueryExecutorContract(
  label: string,
  makeExecutor: () => QueryExecutor,
): void {
  describe(`QueryExecutor contract — ${label}`, () => {
    it('execute returns ok for a known query', async () => {
      const executor = makeExecutor();
      const db = new BetterSqlite3(':memory:');
      const out = await executor.execute({
        queryName: 'contractNoop',
        inputs: {},
        ctx: { qsmDb: db },
      });
      expect(out.ok).toBe(true);
      db.close();
    });

    it('execute returns QUERY_NOT_FOUND for unknown query', async () => {
      const executor = makeExecutor();
      const db = new BetterSqlite3(':memory:');
      const out = await executor.execute({
        queryName: '__nope__',
        inputs: {},
        ctx: { qsmDb: db },
      });
      expect(out.ok).toBe(false);
      if (!out.ok) expect(out.error.code).toBe('QUERY_NOT_FOUND');
      db.close();
    });
  });
}
```

- [ ] **Step 2: Wire contract into `plugin-contracts.test.ts`**

In `packages/runtime/test/integration/plugin-contracts.test.ts`, append:

```ts
import {
  runCommandExecutorContract,
  runQueryExecutorContract,
} from '../../src/plugins/contract-tests.js';
import { CodeCommandExecutor } from '../../src/plugins/executors/code-command-executor.js';
import { GraphIrCommandExecutor } from '../../src/plugins/executors/graph-ir-command-executor.js';
import { GraphIrQueryExecutor } from '../../src/plugins/executors/graph-ir-query-executor.js';
// mkCompiled and mkCompiledQuery exist as fixtures; if not, inline a minimal compiled shape
// similar to test/unit/graph-ir-command-executor.test.ts.

runCommandExecutorContract('CodeCommandExecutor', () =>
  new CodeCommandExecutor({
    contractEcho: async (_ctx, input) => ({
      ok: true,
      value: {
        aggregateId: String(input.id),
        version: 1,
        eventIds: ['id-1'],
        commandId: 'cmd-1',
        correlationId: 'corr-1',
      },
    }),
  }),
);

runCommandExecutorContract('GraphIrCommandExecutor', () => {
  // Use a minimal compiled shape identical to graph-ir-command-executor.test.ts
  const compiled = {
    readPrelude: null,
    readPreludeGuardNodeId: null,
    emits: [
      {
        eventType: 'ContractEchoed',
        aggregate: 'A',
        aggregateIdExpr: { kind: 'param', name: 'id' },
        affects: ['status'],
        payloadExprs: { status: { kind: 'const', value: 'done' } },
        legalTransitions: { from: [null], to: 'done' },
      },
    ],
  } as unknown as import('@rntme/graph-ir-compiler').CompiledCommand;
  return new GraphIrCommandExecutor({ contractEcho: compiled });
});

runQueryExecutorContract('GraphIrQueryExecutor', () =>
  new GraphIrQueryExecutor({
    // If building a real CompileResult is heavy, wrap with a tiny stub-shape that
    // execute() understands; otherwise leave the map empty and the NOT_FOUND test
    // still passes while ok-path is skipped for this label.
  } as unknown as import('../../src/plugins/executors/graph-ir-query-executor.js').GraphIrQueryMap),
);
```

- [ ] **Step 3: Run integration tests**

Run: `pnpm -F @rntme/runtime vitest run test/integration/plugin-contracts.test.ts`
Expected: PASS (Code + GraphIr Command contracts; Query contract may skip ok-path if stub map is empty).

- [ ] **Step 4: Commit**

```bash
git add packages/runtime/src/plugins/contract-tests.ts \
        packages/runtime/test/integration/plugin-contracts.test.ts
git commit -m "test(runtime): add CommandExecutor and QueryExecutor contract suites"
```

---

## Phase 6 — Wire through `@rntme/bindings-http`

### Task 10: Add `commandExecutor` to `BindingsRouterOptions`

**Files:**
- Modify: `packages/bindings-http/src/router.ts`
- Modify: `packages/bindings-http/src/index.ts` (if it needs to re-export types)
- Modify: `packages/bindings-http/package.json` (add `@rntme/runtime` as dev-or-peer if needed — but avoid cycle; see Step 1)

- [ ] **Step 1: Decide interface location**

The `CommandExecutor` interface is exported from `@rntme/runtime`. `bindings-http` depends on `@rntme/bindings` but not `@rntme/runtime`. Introducing that dep would create a cycle (runtime depends on bindings-http). Move the *interface* into a new zero-dep file: `packages/bindings-http/src/executor-contract.ts` and have `@rntme/runtime` re-export from there.

Create `packages/bindings-http/src/executor-contract.ts` with the contents of `types.ts` from Task 1 — **identical shape, different file** — then update `packages/runtime/src/plugins/executors/types.ts` to re-export those types:

```ts
// packages/runtime/src/plugins/executors/types.ts (replace contents)
export type {
  CommandExecutor,
  CommandExecutorInput,
  CommandExecutorOutput,
  CommandExecutorOk,
  CommandExecutorErr,
  CommandExecutorError,
  CommandExecutorErrorCode,
  CommandExecutionContext,
  CommandExecutionResult,
  CorrelationCtx,
  QueryExecutor,
  QueryExecutorInput,
  QueryExecutorOutput,
  QueryExecutorError,
  QueryExecutorErrorCode,
  QueryExecutionContext,
} from '@rntme/bindings-http/executor-contract';
```

Add the subpath export in `packages/bindings-http/package.json`:

```json
"exports": {
  ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" },
  "./executor-contract": { "types": "./dist/executor-contract.d.ts", "import": "./dist/executor-contract.js" }
}
```

(Preserve any existing export paths; just add the new one.)

- [ ] **Step 2: Add `commandExecutor` option**

Edit `packages/bindings-http/src/router.ts`:

```ts
// add import
import type { CommandExecutor } from './executor-contract.js';

// inside BindingsRouterOptions type, add:
commandExecutor?: CommandExecutor;
```

- [ ] **Step 3: Typecheck both packages**

Run: `pnpm -F @rntme/bindings-http build && pnpm -F @rntme/runtime typecheck`
Expected: PASS. If the runtime's `types.ts` now just re-exports from bindings-http, delete the original interface bodies there.

- [ ] **Step 4: Commit**

```bash
git add packages/bindings-http/src/executor-contract.ts \
        packages/bindings-http/package.json \
        packages/bindings-http/src/router.ts \
        packages/runtime/src/plugins/executors/types.ts
git commit -m "refactor(bindings-http,runtime): move CommandExecutor contract into bindings-http to break cycle"
```

---

### Task 11: Refactor `CommandBindingPlan` to no longer carry `compiled`

**Files:**
- Modify: `packages/bindings-http/src/startup/compile-plan.ts`
- Modify: `packages/bindings-http/src/runtime/command-handler.ts`

- [ ] **Step 1: Remove `compiled` from the command-plan shape**

In `compile-plan.ts`, find the `CommandBindingPlan` type (below the common type). Replace the field `compiled: CompiledCommand` with `commandName: string`. Update `buildPlan` to store the compiled command in a **side map** returned alongside:

```ts
export type BuildPlanResult = {
  plans: Record<string, BindingPlan>;
  compiledCommands: Record<string, CompiledCommand>;
};

export function buildPlan(
  validated: ValidatedBindings,
  graphSpec: unknown,
  pdm: unknown,
  qsm: unknown,
): BuildPlanResult {
  // existing logic, but accumulate compiled commands into a separate map
  // instead of attaching to each CommandBindingPlan.
}
```

(Preserve the rest of the function body; only the return shape changes.)

- [ ] **Step 2a: Widen `errors.ts` helpers to accept plain executor error shape**

Edit `packages/bindings-http/src/errors.ts`:

```ts
// REPLACE the two existing functions:
export type CommandErrorLike = { code: string; message: string; detail?: unknown };

export function commandErrorStatus(err: CommandErrorLike): CommandErrorStatus {
  return err.code === 'COMMAND_CONCURRENCY_CONFLICT' ? 409 : 422;
}

export function commandErrorBody(err: CommandErrorLike): ErrorResponseBody {
  const body: ErrorResponseBody = { code: err.code, message: err.message };
  if (err.detail !== undefined) body.details = err.detail;
  return body;
}
```

Also remove the unused import of `CommandExecutionError` at the top of the file. This is a widening change (subtype compatible) — any existing call site that passes a `CommandExecutionError` continues to work because the class has `code`, `message`, and `detail` fields.

Run: `pnpm -F @rntme/bindings-http typecheck`
Expected: PASS.

- [ ] **Step 2b: Update `makeCommandHandler` to call the executor**

Rewrite `packages/bindings-http/src/runtime/command-handler.ts` core:

```ts
import type { CommandExecutor } from '../executor-contract.js';

export type CommandHandlerDeps = {
  commandExecutor: CommandExecutor;
  eventStore: EventStore;
  qsmDb: BetterSqlite3.Database | null;
  now: () => string;
  nextId: () => string;
  actorFromRequest: (c: Context) => ActorRef | null;
  onError?: (err: unknown, ctx: Context) => void;
};

// inside the handler:
const out = await deps.commandExecutor.execute({
  commandName: plan.commandName,
  inputs: graphInputs,
  ctx: {
    eventStore: deps.eventStore,
    qsmDb: deps.qsmDb,
    now: deps.now,
    nextId: deps.nextId,
    actor: deps.actorFromRequest(c),
    correlation,
  },
});

if (!out.ok) {
  const code = out.error.code;
  if (code === 'COMMAND_GUARD_REJECTED')
    return c.json(commandErrorBody({ code, message: out.error.message }), 422);
  if (code === 'COMMAND_CONCURRENCY_CONFLICT')
    return c.json(commandErrorBody({ code, message: out.error.message }), 409);
  if (code === 'COMMAND_NOT_FOUND')
    return c.json(commandErrorBody({ code, message: out.error.message }), 500);
  deps.onError?.(out.error.detail ?? out.error, c);
  return c.json(internalErrorBody(), 500);
}
return c.json(out.value, 200);
```

The JSON body format stays byte-identical: `commandErrorBody` (widened in Step 2a) produces `{ code, message, details? }` for both old `CommandExecutionError` instances and new plain executor error shapes.

- [ ] **Step 3: Update `router.ts` to require `commandExecutor` as a mandatory option**

Dependency rule (deterministic choice, no hedging): `@rntme/bindings-http` **must not** depend on `@rntme/runtime` (that would be a cycle — runtime already depends on bindings-http). Therefore `createBindingsRouter` does **not** construct a default executor itself. It requires the caller to pass one, mirroring the existing mandatory `eventStore` option.

In `createBindingsRouter`, after `buildPlan` produces `{ plans, compiledCommands }`:

```ts
const hasCommand = Object.values(plan.plans).some((p) => p.kind === 'command');
if (hasCommand && opts.commandExecutor === undefined) {
  throw new Error(
    'createBindingsRouter: commandExecutor is required when any binding has kind "command"',
  );
}
const commandExecutor = opts.commandExecutor!;
```

The `compiledCommands` map produced by `buildPlan` is exported via a new return field (`BuildPlanResult.compiledCommands`) so that the caller — typically `HttpSurface` in `@rntme/runtime` — can hand it to `new GraphIrCommandExecutor(compiledCommands)` before calling `createBindingsRouter`. Export `BuildPlanResult` and a helper `buildDefaultGraphIrCommandMap(validated, graphSpec, pdm, qsm): GraphIrCommandMap` from `@rntme/bindings-http/src/startup/compile-plan.ts` so the runtime can build the map without duplicating the compile loop.

- [ ] **Step 4: Run bindings-http tests**

Run: `pnpm -F @rntme/bindings-http test`
Expected: PASS. Existing integration tests exercise the command path end-to-end; any failure indicates a behavioural regression in the refactor.

- [ ] **Step 5: Commit**

```bash
git add packages/bindings-http/src/
git commit -m "refactor(bindings-http): route commands through CommandExecutor seam"
```

---

## Phase 7 — Wire through `@rntme/runtime`

### Task 12: Add `commandExecutor` / `queryExecutor` to `RuntimeConfig`

**Files:**
- Modify: `packages/runtime/src/start/start-service.ts`
- Modify: `packages/runtime/src/plugins/http-surface.ts`
- Modify: `packages/runtime/src/plugins/interfaces.ts` (SurfaceContext extension)

- [ ] **Step 1: Extend `RuntimeConfig`**

In `start-service.ts`:

```ts
import type {
  CommandExecutor,
  QueryExecutor,
} from '../plugins/executors/types.js';

export type RuntimeConfig = {
  // ... existing fields
  commandExecutor?: CommandExecutor;
  queryExecutor?: QueryExecutor;
};
```

- [ ] **Step 2: Default to GraphIrCommandExecutor (runtime owns default construction)**

In `startService`, after `wireEventPipeline` and before surface mount:

```ts
import { GraphIrCommandExecutor } from '../plugins/executors/graph-ir-command-executor.js';
import { GraphIrQueryExecutor } from '../plugins/executors/graph-ir-query-executor.js';
import { buildDefaultGraphIrCommandMap } from '@rntme/bindings-http/startup/compile-plan';

const defaultCommandMap = buildDefaultGraphIrCommandMap(
  service.bindings,
  service.graphSpec,
  service.pdm,
  service.qsm,
);
const commandExecutor =
  config.commandExecutor ?? new GraphIrCommandExecutor(defaultCommandMap);

// Query executor default is a placeholder — current createBindingsRouter still calls
// @rntme/graph-ir-compiler `execute` directly for queries (refactor deferred to a
// later plan). Passing queryExecutor is a no-op in this plan; we still wire it
// through RuntimeConfig so the field is stable for downstream plans.
const queryExecutor = config.queryExecutor ?? new GraphIrQueryExecutor({});
```

(The subpath `@rntme/bindings-http/startup/compile-plan` matches the exports map added in Task 10 Step 1; if that export name was not added there, add `"./startup/compile-plan"` in `packages/bindings-http/package.json#exports` now.)

- [ ] **Step 3: Thread through `HttpSurface`**

In `packages/runtime/src/plugins/http-surface.ts`, add optional `commandExecutor` / `queryExecutor` fields to the `HttpSurface` constructor options; pass them into `createBindingsRouter`:

```ts
// HttpSurface constructor options add:
commandExecutor?: CommandExecutor;
queryExecutor?: QueryExecutor;

// inside mount, pass to createBindingsRouter:
createBindingsRouter({
  // ... existing opts
  commandExecutor: this.commandExecutor,
});
```

In `startService`, construct `HttpSurface` with the configured executors.

- [ ] **Step 4: Run runtime tests**

Run: `pnpm -F @rntme/runtime test`
Expected: PASS (existing startup.test / e2e issue-tracker test unchanged).

- [ ] **Step 5: Commit**

```bash
git add packages/runtime/src/start/start-service.ts \
        packages/runtime/src/plugins/http-surface.ts \
        packages/runtime/src/plugins/interfaces.ts
git commit -m "feat(runtime): thread CommandExecutor/QueryExecutor through RuntimeConfig"
```

---

### Task 13: Full-repo regression check

**Files:**
- None (run-only)

- [ ] **Step 1: Run all tests**

Run: `pnpm -r run test`
Expected: PASS across `@rntme/runtime`, `@rntme/bindings-http`, `@rntme/graph-ir-compiler`, and `demo/issue-tracker-api`. If anything fails, stop and debug — this is the regression gate.

- [ ] **Step 2: Run lint + typecheck**

Run: `pnpm -r run typecheck && pnpm -r run lint`
Expected: PASS.

- [ ] **Step 3: Commit empty merge-marker (skip if no changes)**

If any fixes were needed during Step 1–2, commit them under `fix(<package>): <what>`. Otherwise move on.

---

## Phase 8 — Module skeleton package

### Task 14: Scaffold `packages/module-skeleton/`

**Files:**
- Create: `packages/module-skeleton/package.json`
- Create: `packages/module-skeleton/tsconfig.json`
- Create: `packages/module-skeleton/tsconfig.check.json`
- Create: `packages/module-skeleton/vitest.config.ts`
- Create: `packages/module-skeleton/eslint.config.mjs`
- Create: `packages/module-skeleton/src/index.ts`
- Create: `packages/module-skeleton/test/unit/_smoke.test.ts`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "@rntme/module-skeleton",
  "version": "0.0.0",
  "type": "module",
  "private": true,
  "description": "Starter template and reference for rntme platform modules (code-executor based). Copy this directory to bootstrap a new module.",
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" }
  },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": ["dist", "README.md"],
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc -p tsconfig.check.json",
    "lint": "eslint \"src/**/*.ts\" \"test/**/*.ts\""
  },
  "dependencies": {
    "@rntme/runtime": "workspace:*"
  },
  "devDependencies": {
    "@types/node": "^20.14.0",
    "eslint": "^9.10.0",
    "typescript": "^5.5.4",
    "vitest": "^2.1.1"
  }
}
```

- [ ] **Step 2: Create tsconfig files**

Copy from `packages/runtime/tsconfig.json` and `packages/runtime/tsconfig.check.json`. Adjust `outDir` / `include` paths as needed (they are relative, so no changes usually).

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
// packages/module-skeleton/vitest.config.ts
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { include: ['test/**/*.test.ts'] },
});
```

- [ ] **Step 4: Create `eslint.config.mjs`**

Copy verbatim from `packages/runtime/eslint.config.mjs`.

- [ ] **Step 5: Write smoke test**

```ts
// packages/module-skeleton/test/unit/_smoke.test.ts
import { describe, it, expect } from 'vitest';
import { VERSION, exampleHandlers } from '../../src/index.js';

describe('@rntme/module-skeleton', () => {
  it('exports VERSION', () => {
    expect(typeof VERSION).toBe('string');
  });
  it('exports exampleHandlers map with echo handler', () => {
    expect(typeof exampleHandlers.echo).toBe('function');
  });
});
```

- [ ] **Step 6: Initial index stub**

```ts
// packages/module-skeleton/src/index.ts
export const VERSION = '0.0.0';
export { exampleHandlers } from './handlers.js';
```

- [ ] **Step 7: Install workspace**

Run: `pnpm install --frozen-lockfile` (or `pnpm install` if the lockfile needs update — check with user first; if the workspace already globs `packages/*`, it will be picked up).

- [ ] **Step 8: Commit scaffold**

```bash
git add packages/module-skeleton/
git commit -m "feat(module-skeleton): scaffold starter package for platform modules"
```

---

### Task 15: Implement example `echo` handler

**Files:**
- Create: `packages/module-skeleton/src/handlers.ts`
- Create: `packages/module-skeleton/test/unit/handlers.test.ts`

- [ ] **Step 1: Write the test**

```ts
// packages/module-skeleton/test/unit/handlers.test.ts
import { describe, it, expect } from 'vitest';
import { SqliteEventStore } from '@rntme/event-store';
import { exampleHandlers } from '../../src/handlers.js';
import type { CommandExecutionContext } from '@rntme/runtime';

function mkCtx(): CommandExecutionContext {
  return {
    eventStore: new SqliteEventStore({ filename: ':memory:', serviceName: 'module-skeleton' }),
    qsmDb: null,
    now: () => '2026-04-19T00:00:00.000Z',
    nextId: () => 'id-1',
    actor: null,
    correlation: { commandId: 'cmd-1', correlationId: 'corr-1', traceparent: null },
  };
}

describe('exampleHandlers.echo', () => {
  it('returns the input payload verbatim wrapped in CommandExecutionResult', async () => {
    const out = await exampleHandlers.echo(mkCtx(), { message: 'hello' });
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.value.aggregateId).toBe('echo');
      expect(out.value.eventIds).toEqual([]);
    }
  });
});
```

- [ ] **Step 2: Verify fail**

Run: `pnpm -F @rntme/module-skeleton vitest run test/unit/handlers.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement handlers**

```ts
// packages/module-skeleton/src/handlers.ts
import type { CodeCommandHandlerMap } from '@rntme/runtime';

export const exampleHandlers: CodeCommandHandlerMap = {
  echo: async (ctx, _input) => ({
    ok: true,
    value: {
      aggregateId: 'echo',
      version: 0,
      eventIds: [],
      commandId: ctx.correlation.commandId,
      correlationId: ctx.correlation.correlationId,
    },
  }),
};
```

- [ ] **Step 4: Verify pass**

Run: `pnpm -F @rntme/module-skeleton vitest run test/unit/handlers.test.ts`
Expected: PASS.

- [ ] **Step 5: Integration smoke test — wire CodeCommandExecutor around handlers**

Create `packages/module-skeleton/test/unit/boot-skeleton.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { SqliteEventStore } from '@rntme/event-store';
import { CodeCommandExecutor } from '@rntme/runtime';
import { exampleHandlers } from '../../src/handlers.js';
import type { CommandExecutionContext } from '@rntme/runtime';

function mkCtx(): CommandExecutionContext {
  return {
    eventStore: new SqliteEventStore({ filename: ':memory:', serviceName: 'boot-test' }),
    qsmDb: null,
    now: () => '2026-04-19T00:00:00.000Z',
    nextId: () => 'id-1',
    actor: null,
    correlation: { commandId: 'cmd-1', correlationId: 'corr-1', traceparent: null },
  };
}

describe('module-skeleton boot wiring', () => {
  it('CodeCommandExecutor successfully runs exampleHandlers.echo', async () => {
    const exec = new CodeCommandExecutor(exampleHandlers);
    const out = await exec.execute({ commandName: 'echo', inputs: { m: 1 }, ctx: mkCtx() });
    expect(out.ok).toBe(true);
  });

  it('CodeCommandExecutor returns COMMAND_NOT_FOUND for a command missing from exampleHandlers', async () => {
    const exec = new CodeCommandExecutor(exampleHandlers);
    const out = await exec.execute({ commandName: 'missing', inputs: {}, ctx: mkCtx() });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error.code).toBe('COMMAND_NOT_FOUND');
  });
});
```

- [ ] **Step 6: Run all module-skeleton tests**

Run: `pnpm -F @rntme/module-skeleton test`
Expected: PASS (smoke + handlers + boot-skeleton).

- [ ] **Step 7: Commit**

```bash
git add packages/module-skeleton/src/handlers.ts \
        packages/module-skeleton/test/unit/handlers.test.ts \
        packages/module-skeleton/test/unit/boot-skeleton.test.ts
git commit -m "feat(module-skeleton): add exampleHandlers.echo and boot-wiring tests"
```

---

### Task 16: Write `packages/module-skeleton/README.md`

**Files:**
- Create: `packages/module-skeleton/README.md`

- [ ] **Step 1: Write the README**

```markdown
# @rntme/module-skeleton

Starter template for **rntme platform modules** (spec: `docs/history/specs/historical/2026-04-19-platform-modules-integration-design.md`).

A *platform module* is a service that uses `@rntme/runtime` infrastructure (event-store, projections, relay) but replaces graph-IR execution with hand-written TypeScript handlers via `CodeCommandExecutor`. This is the right shape for integration services that wrap a vendor SDK (Stripe, Resend, Algolia, OpenAI, etc.) — the SDK's semantics are too complex to express in Graph IR, and nothing is lost by writing code.

## What's inside

- `src/handlers.ts` — example `CodeCommandHandlerMap` with a single `echo` command. This is what you replace with your own handlers.
- `src/index.ts` — barrel re-exporting the handler map.
- `test/unit/*.test.ts` — example unit tests for a handler + a wiring smoke test using `CodeCommandExecutor`.

## Copy to bootstrap your module

1. `cp -r packages/module-skeleton packages/<your-module-name>`.
2. Rename the package in `package.json`.
3. Replace the contents of `src/handlers.ts` with your vendor's operations.
4. Add your vendor SDK to `dependencies` (e.g. `"stripe": "^14.0.0"`).
5. Run `pnpm install` at the repo root.
6. (After plan 2 lands — gRPC surface) register your handlers with the gRPC surface in your module's `start-module.ts` entry.

## What is not here (yet)

- **gRPC surface** — comes in plan 2 (`packages/bindings-grpc`). Until then, modules do not have their own exposed public API; this package only demonstrates the handler shape.
- **Webhook receiver** — modules own their webhook endpoint. After plan 2 lands, use `@rntme/bindings-http` inside the module to mount `/webhooks/<vendor>` and do signature verification + dedupe + emit.
- **Pre-fetch / `pre[]` support** — domain services call modules via the seam described in plan 3. Modules themselves don't use `pre[]`.

## Health-check convention

Every platform module **must** expose a liveness endpoint. When running on `HttpSurface` (the default), the runtime mounts `/health` automatically from `manifest.observability.health.path`. The body shape is `{ "ok": boolean, "reason"?: string }`. Modules that run on the gRPC surface (plan 2) will additionally implement the standard `grpc.health.v1.Health/Check` RPC — schema documented when that plan lands.

## Testing your module

Handlers are pure async functions. Test them in isolation with any `CommandExecutionContext` stub:

```ts
const out = await myHandlers.createCheckoutSession(mkCtx(), { priceId: 'price_123' });
expect(out.ok).toBe(true);
```

Integration tests should use an in-memory event-store (`new SqliteEventStore({ filename: ':memory:' })`) and assert on emitted events rather than vendor SDK calls (mock the SDK).

## References

- Spec: `docs/history/specs/historical/2026-04-19-platform-modules-integration-design.md` §5, §12.
- Default executors: `packages/runtime/src/plugins/executors/`.
- Contract tests: `runCommandExecutorContract` in `packages/runtime/src/plugins/contract-tests.ts`.
```

- [ ] **Step 2: Commit**

```bash
git add packages/module-skeleton/README.md
git commit -m "docs(module-skeleton): add README explaining usage and roadmap"
```

---

## Phase 9 — Health-check convention documentation

### Task 17: Document the health-check convention and add AGENTS.md entry

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: Add §6.11 to AGENTS.md**

Append to the "How to do common tasks" section:

```markdown
### 6.11 Add a platform module (code-executor-based integration service)

1. Read `docs/history/specs/historical/2026-04-19-platform-modules-integration-design.md` (§5 module pattern, §12 contract).
2. Copy `packages/module-skeleton/` to `packages/<module-name>/` and update `package.json#name`.
3. Replace `src/handlers.ts` with your vendor-specific handlers; add vendor SDK to dependencies.
4. Register handlers with `new CodeCommandExecutor(handlers)` and pass via `startService({ commandExecutor })`.
5. Expose `/health` via the runtime's default `HttpSurface` (automatic) — no extra work.
6. (Plan 2 and later) add your gRPC surface + webhook receiver per plan deliverables.
7. Contract tests: run `runCommandExecutorContract('<module>', () => new CodeCommandExecutor(handlers))` in your module's integration test file.
8. Anti-patterns to avoid: do not emit events from handlers that correspond to other services' aggregates; do not read projections owned by a domain service — request data via gRPC in plan 2.
```

- [ ] **Step 2: Add to decisions index in §8**

Append to "Where decisions live" table:

```markdown
- "Why a separate module package instead of adapter-DSL inside a domain service?" →
  `docs/history/specs/historical/2026-04-19-platform-modules-integration-design.md` §3 Q1 + §5.
```

- [ ] **Step 3: Commit**

```bash
git add AGENTS.md
git commit -m "docs(agents): document how to add a platform module (§6.11)"
```

---

## Phase 10 — Final gate

### Task 18: Full-repo regression check (second pass) + tag plan complete

**Files:**
- None (run-only)

- [ ] **Step 1: Full build + test + lint**

Run in order (sequentially, stop on any failure):

```bash
pnpm install --frozen-lockfile
pnpm -r run build
pnpm -r run typecheck
pnpm -r run test
pnpm -r run lint
```

Expected: PASS across every package including `demo/issue-tracker-api`.

- [ ] **Step 2: Verify the demo still boots**

Run: `pnpm -F @rntme/issue-tracker-api-demo start &` (in a separate terminal, or use `timeout 10 pnpm -F ... start` in scripts). Hit `curl http://localhost:3000/health` — expect `{"ok":true}`.

Stop the demo server.

- [ ] **Step 3: Update spec cross-reference**

In `docs/history/specs/historical/2026-04-19-platform-modules-integration-design.md` §14, change the status pill next to Plan 1 from implicit "pending" to "implemented 2026-04-..." (use the actual date). No code change, docs only.

- [ ] **Step 4: Commit and finalize**

```bash
git add docs/history/specs/historical/2026-04-19-platform-modules-integration-design.md
git commit -m "docs(spec): mark plan #1 (code-executor seam) implemented"
```

---

## Self-review checklist (for plan author, pre-handoff)

- Spec §5 (module pattern) → Tasks 14–16 (module-skeleton).
- Spec §6.1 (CommandExecutor, QueryExecutor, defaults) → Tasks 1, 3, 6, 7, 8.
- Spec §6.1 alternatives (CodeExecutor) → Tasks 5, 6.
- Spec §12.3 health-check recommendation → Task 17, plus runtime's existing `/health` observability.
- Spec §13.1 testing model (mock external adapter client, contract tests) → Task 9 (contract suites). External adapter client itself is out of scope for Plan 1.
- Nothing in this plan depends on `ExternalAdapterClient`, `pre[]`, gRPC surface, or `method`/`inputFrom`/`response` extensions — all explicitly in later plans.
- No "TBD" or placeholder steps. Every code block is complete; every command shows expected result.
- Types used across tasks are consistent (`CommandExecutor`, `CommandExecutorOutput`, `CommandExecutorError`, `CommandExecutionContext`, `CommandExecutionResult`, `CodeCommandHandler`, `CodeCommandHandlerMap`, `GraphIrCommandMap`, `GraphIrQueryMap`).
- File paths are absolute relative to repo root; no line numbers (they drift).
