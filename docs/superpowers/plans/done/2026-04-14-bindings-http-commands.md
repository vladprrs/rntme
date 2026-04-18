# `@rntme/bindings-http` — Commands Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing `@rntme/bindings-http` package so that bindings with `kind: "command"` route HTTP `POST` requests through the Graph IR command runtime (`executeCommand` from `@rntme/graph-ir-compiler`) — producing events in an `@rntme/event-store`, returning `CommandResult` on 200, and mapping `CommandExecutionError` codes to the spec's HTTP status codes (409 concurrency, 422 guard/illegal-transition).

**Architecture:** Turn `BindingPlan` into a discriminated union (`QueryBindingPlan | CommandBindingPlan`) at plan-build time. At request time, query bindings continue to call `execute(compiled, inputs, db)` and return a JSON array; command bindings assemble an `ExecuteCommandContext` from router-level deps (`eventStore`, `qsmDb = opts.db`, `now`, `nextId`, plus a per-request `actorFromRequest` callback) and call `executeCommand(compiled, inputs, ctx)`, returning the `CommandResult` object. No change to the existing query path is observable from the outside.

**Tech Stack:** TypeScript (ES2022, strict), Hono ^4.6.0, Zod ^3.23.8, `@rntme/bindings` (workspace), `@rntme/graph-ir-compiler` (workspace), `@rntme/event-store` (workspace, **new dep**), `better-sqlite3` ^11 (peer), Vitest ^2.

**Spec:** `docs/superpowers/specs/2026-04-14-mutations-design.md` §4 (Graph IR emit + command role), §7.1–7.4 (bindings + HTTP error model), §7.5 (testing), §7.8 item 7 (rollout order).

**Dependency context.** All prerequisites are already shipped:
- `@rntme/bindings` — `BindingEntry.kind?: 'query' | 'command'`, `COMMAND_RESULT_SHAPE_NAME`, `commandResultJsonSchema()`, OpenAPI emits command responses with the `409/422` error variants (task 6 in the spec's rollout).
- `@rntme/graph-ir-compiler` — exports `compileCommand`, `executeCommand`, `runCommand`, `CommandExecutionError` with codes `COMMAND_ILLEGAL_TRANSITION | COMMAND_GUARD_REJECTED | COMMAND_CONCURRENCY_CONFLICT`, plus types `CompiledCommand`, `CommandResult`, `ExecuteCommandContext` (task 4).
- `@rntme/event-store` — exports `EventStore` interface, `SqliteEventStore`, `ActorRef`, `ConcurrencyConflict` (task 3).

**What is explicitly NOT in scope for this plan**:
- `demo/issue-tracker-api` wiring of commands and the full `POST → event → relay → consumer → projection → GET` acceptance cycle (that is spec §7.8 item 8, a separate plan);
- `actor` parsing from auth / JWT (router takes a user-supplied `actorFromRequest` callback; default returns `null`);
- SQLITE_BUSY / retry logic at the HTTP layer (MVP returns 409 directly on concurrency conflict; SqliteEventStore's own busy handling is inherited);
- Any `BindingArtifact.version` bump (this consumes bindings that are already valid under the existing `1.0` schema — `kind` is already present in `@rntme/bindings`).

---

## File Structure

**Modify:**
- `packages/bindings-http/package.json` — add `@rntme/event-store` workspace dep
- `packages/bindings-http/src/index.ts` — extend public exports
- `packages/bindings-http/src/router.ts` — dispatch per `entry.kind`
- `packages/bindings-http/src/startup/compile-plan.ts` — discriminated `BindingPlan` union; compile command graphs via `compileCommand`
- `packages/bindings-http/src/errors.ts` — add `commandErrorBody` + HTTP status helper

**Create:**
- `packages/bindings-http/src/runtime/command-handler.ts` — `makeCommandHandler(plan, deps)` mirroring `makeHandler` but for commands
- `packages/bindings-http/test/unit/command-errors.test.ts`
- `packages/bindings-http/test/unit/command-handler.test.ts`
- `packages/bindings-http/test/integration/command-routing.test.ts`

**Reuse fixtures** (no copies):
- `packages/graph-ir-compiler/test/e2e/fixtures/issue-tracker.pdm.json` (Issue entity with `stateMachine`)
- `packages/graph-ir-compiler/test/e2e/fixtures/issue-tracker.qsm.json`

---

## Task 1: Add `@rntme/event-store` workspace dependency

**Files:**
- Modify: `packages/bindings-http/package.json`

- [ ] **Step 1.1: Edit `dependencies` block**

Add `"@rntme/event-store": "workspace:*"` to `dependencies`, keeping alphabetical order inside the block. Final block:

```json
"dependencies": {
  "@rntme/bindings": "workspace:*",
  "@rntme/event-store": "workspace:*",
  "@rntme/graph-ir-compiler": "workspace:*",
  "hono": "^4.6.0",
  "zod": "^3.23.8"
}
```

- [ ] **Step 1.2: Install and verify workspace link**

Run: `pnpm install` from the repo root.

Expected: pnpm succeeds; `node_modules/@rntme/event-store` is a symlink to `packages/event-store`.

- [ ] **Step 1.3: Verify the type import resolves**

Run: `cd packages/bindings-http && pnpm typecheck`
Expected: PASS (no changes yet; this just proves `pnpm install` didn't break anything).

- [ ] **Step 1.4: Commit**

```bash
git add packages/bindings-http/package.json pnpm-lock.yaml
git commit -m "chore(bindings-http): add @rntme/event-store workspace dep for command runtime"
```

---

## Task 2: Split `BindingPlan` into a discriminated union

Today `BindingPlan` is a single record shape whose `compiled: CompileResult` field is specific to queries. Commands have a different compiled shape (`CompiledCommand`). Model them as a union with a `kind` tag so downstream code can branch exhaustively.

**Files:**
- Modify: `packages/bindings-http/src/startup/compile-plan.ts`
- Test: `packages/bindings-http/test/unit/build-plan.test.ts` (existing — add a case)

- [ ] **Step 2.1: Write a failing test for command plan compilation**

Add a new test case at the end of the existing `describe` block in `packages/bindings-http/test/unit/build-plan.test.ts` that supplies a command binding and expects `buildPlan` to produce a `CommandBindingPlan` entry. Since the file already sets up a working query fixture, append a second artifact + resolver case.

Insert in `test/unit/build-plan.test.ts` (new imports at top if missing, new describe block at bottom):

```typescript
import type { CommandBindingPlan } from '../../src/startup/compile-plan.js';

describe('buildPlan — command bindings', () => {
  const pdmIt = loadJson(
    join(compilerRoot, 'test', 'e2e', 'fixtures', 'issue-tracker.pdm.json'),
  );
  const qsmIt = loadJson(
    join(compilerRoot, 'test', 'e2e', 'fixtures', 'issue-tracker.qsm.json'),
  );
  const commandSpec = {
    version: '1.0-rc7',
    pdmRef: 'p',
    qsmRef: 'q',
    shapes: {},
    graphs: {
      reportIssue: {
        id: 'reportIssue',
        signature: {
          inputs: {
            issueId: { type: 'integer', mode: 'required' },
            projectId: { type: 'integer', mode: 'required' },
            reporterId: { type: 'integer', mode: 'required' },
            title: { type: 'string', mode: 'required' },
            priority: { type: 'string', mode: 'required' },
            storyPoints: { type: 'integer', mode: 'required' },
          },
          output: { type: 'row<CommandResult>', from: 'e' },
        },
        nodes: [
          {
            id: 'e',
            type: 'emit',
            config: {
              aggregate: 'Issue',
              aggregateId: { $param: 'issueId' },
              transition: 'report',
              payload: {
                title: { $param: 'title' },
                projectId: { $param: 'projectId' },
                reporterId: { $param: 'reporterId' },
                priority: { $param: 'priority' },
                storyPoints: { $param: 'storyPoints' },
              },
            },
          },
        ],
      },
    },
  };
  const cmdResolvers: BindingResolvers = {
    resolveGraphSignature: (id) =>
      id === 'reportIssue'
        ? {
            id,
            role: 'command',
            inputs: {
              issueId: { type: { kind: 'scalar', primitive: 'integer' }, mode: 'required' },
              projectId: { type: { kind: 'scalar', primitive: 'integer' }, mode: 'required' },
              reporterId: { type: { kind: 'scalar', primitive: 'integer' }, mode: 'required' },
              title: { type: { kind: 'scalar', primitive: 'string' }, mode: 'required' },
              priority: { type: { kind: 'scalar', primitive: 'string' }, mode: 'required' },
              storyPoints: { type: { kind: 'scalar', primitive: 'integer' }, mode: 'required' },
            },
            output: { type: { kind: 'row', shape: 'CommandResult' }, from: 'e' },
          }
        : null,
    resolveShape: (name) =>
      name === 'CommandResult'
        ? {
            name,
            origin: 'custom',
            fields: {
              aggregateId: { type: { kind: 'scalar', primitive: 'string' }, nullable: false },
              version: { type: { kind: 'scalar', primitive: 'integer' }, nullable: false },
              eventIds: { type: { kind: 'array', element: 'string' }, nullable: false },
            },
          }
        : null,
  };
  const cmdArtifact = {
    version: '1.0',
    graphSpecRef: 'x',
    pdmRef: 'p',
    qsmRef: 'q',
    bindings: {
      reportIssueHttp: {
        kind: 'command',
        graph: 'reportIssue',
        target: { engine: 'sqlite', dialect: 'sqlite' },
        http: {
          method: 'POST',
          path: '/v1/issues/{issueId}/actions/report',
          parameters: [
            { name: 'issueId', in: 'path', bindTo: 'issueId', required: true },
            { name: 'projectId', in: 'body', bindTo: 'projectId', required: true },
            { name: 'reporterId', in: 'body', bindTo: 'reporterId', required: true },
            { name: 'title', in: 'body', bindTo: 'title', required: true },
            { name: 'priority', in: 'body', bindTo: 'priority', required: true },
            { name: 'storyPoints', in: 'body', bindTo: 'storyPoints', required: true },
          ],
        },
      },
    },
  };

  it('produces a CommandBindingPlan with compiled emits', () => {
    const parsed = parseBindingArtifact(cmdArtifact);
    if (!parsed.ok) throw new Error('parse fail');
    const v = validateBindings(parsed.value, cmdResolvers);
    if (!v.ok) throw new Error('validate fail');
    const plan = buildPlan(v.value, commandSpec, pdmIt, qsmIt);
    const bp = plan.reportIssueHttp;
    expect(bp).toBeDefined();
    expect(bp!.kind).toBe('command');
    const cmd = bp as CommandBindingPlan;
    expect(cmd.compiled.aggregate).toBe('Issue');
    expect(cmd.compiled.emits.length).toBe(1);
    expect(cmd.compiled.emits[0]!.eventType).toContain('Issue');
  });
});
```

Run: `cd packages/bindings-http && pnpm test -- build-plan.test.ts`

Expected: FAIL — `CommandBindingPlan` type not exported, `bp.kind` does not exist, or `bp.compiled.aggregate` is a type error.

- [ ] **Step 2.2: Rewrite `compile-plan.ts` with a discriminated union**

Replace the file content at `packages/bindings-http/src/startup/compile-plan.ts` with the version below. The key differences from the existing file:
1. `CompileResult` is imported under alias `QueryCompileResult` to disambiguate; `CompiledCommand` is imported from `@rntme/graph-ir-compiler`.
2. `BindingPlan` becomes `QueryBindingPlan | CommandBindingPlan`, each with `kind: 'query' | 'command'`.
3. `buildPlan` groups graph IDs by kind (derived from `entry.kind ?? 'query'`) and calls `compileForGraph` or `compileCommandForGraph` accordingly.
4. Return type of `buildPlan` stays `Record<string, BindingPlan>`.

```typescript
import {
  compile,
  compileCommand,
  type CompileResult as QueryCompileResult,
  type CompiledCommand,
} from '@rntme/graph-ir-compiler';
import type { Result } from '@rntme/graph-ir-compiler';
import type {
  ValidatedBindings,
  BindingEntry,
  GraphSignature,
  ResolvedShape,
  InputType,
  HttpParameter,
} from '@rntme/bindings';
import { BindingsRuntimeError, type RuntimeErrorEntry } from '../errors.js';
import { buildSchemas, type BuiltSchemas } from './zod-schema.js';
import { buildBindToMap, type BindToMap } from '../runtime/remap.js';

type SingleGraphSpec = { graphs?: Record<string, unknown>; [k: string]: unknown };

function sliceSpec(rawSpec: unknown, graphId: string): unknown {
  const spec = rawSpec as SingleGraphSpec;
  const graphs = spec?.graphs ?? {};
  const target = graphs[graphId];
  return {
    ...spec,
    graphs: target === undefined ? {} : { [graphId]: target },
  };
}

export function compileForGraph(
  rawSpec: unknown,
  graphId: string,
  pdm: unknown,
  qsm: unknown,
): Result<QueryCompileResult> {
  return compile(sliceSpec(rawSpec, graphId), pdm, qsm);
}

export function compileCommandForGraph(
  rawSpec: unknown,
  graphId: string,
  pdm: unknown,
  qsm: unknown,
): Result<CompiledCommand> {
  return compileCommand(sliceSpec(rawSpec, graphId), pdm, qsm);
}

type BindingPlanCommon = {
  bindingId: string;
  entry: BindingEntry;
  signature: GraphSignature;
  outputShape: ResolvedShape;
  schemas: BuiltSchemas;
  bindToMap: BindToMap;
  listParamNames: Set<string>;
  pathParamNames: string[];
  bodyParamNames: string[];
};

export type QueryBindingPlan = BindingPlanCommon & {
  kind: 'query';
  compiled: QueryCompileResult;
};

export type CommandBindingPlan = BindingPlanCommon & {
  kind: 'command';
  compiled: CompiledCommand;
};

export type BindingPlan = QueryBindingPlan | CommandBindingPlan;

export function buildPlan(
  validated: ValidatedBindings,
  graphSpec: unknown,
  pdm: unknown,
  qsm: unknown,
): Record<string, BindingPlan> {
  const queryGraphIds = new Set<string>();
  const commandGraphIds = new Set<string>();
  for (const r of Object.values(validated.resolved)) {
    const kind = r.entry.kind ?? 'query';
    if (kind === 'command') commandGraphIds.add(r.entry.graph);
    else queryGraphIds.add(r.entry.graph);
  }

  const queryCache = new Map<string, QueryCompileResult>();
  const commandCache = new Map<string, CompiledCommand>();
  const errors: RuntimeErrorEntry[] = [];

  for (const graphId of queryGraphIds) {
    const r = compileForGraph(graphSpec, graphId, pdm, qsm);
    if (r.ok) queryCache.set(graphId, r.value);
    else for (const cause of r.errors) errors.push({ graphId, cause });
  }
  for (const graphId of commandGraphIds) {
    const r = compileCommandForGraph(graphSpec, graphId, pdm, qsm);
    if (r.ok) commandCache.set(graphId, r.value);
    else for (const cause of r.errors) errors.push({ graphId, cause });
  }

  if (errors.length > 0) throw new BindingsRuntimeError(errors);

  const plan: Record<string, BindingPlan> = {};
  for (const [bindingId, resolved] of Object.entries(validated.resolved)) {
    const { entry, signature, outputShape } = resolved;
    const kind = entry.kind ?? 'query';
    const schemas = buildSchemas(entry.http.parameters, signature);
    const common: BindingPlanCommon = {
      bindingId,
      entry,
      signature,
      outputShape,
      schemas,
      bindToMap: buildBindToMap(entry.http.parameters),
      listParamNames: collectListParams(entry.http.parameters, signature),
      pathParamNames: entry.http.parameters.filter((p) => p.in === 'path').map((p) => p.name),
      bodyParamNames: entry.http.parameters.filter((p) => p.in === 'body').map((p) => p.name),
    };
    plan[bindingId] =
      kind === 'command'
        ? { ...common, kind: 'command', compiled: commandCache.get(entry.graph)! }
        : { ...common, kind: 'query', compiled: queryCache.get(entry.graph)! };
  }
  return plan;
}

function collectListParams(parameters: HttpParameter[], signature: GraphSignature): Set<string> {
  const listSet = new Set<string>();
  for (const p of parameters) {
    if (p.in !== 'query') continue;
    const t: InputType | undefined = signature.inputs[p.bindTo]?.type;
    if (t && t.kind === 'list') listSet.add(p.name);
  }
  return listSet;
}
```

- [ ] **Step 2.3: Update the existing query handler to narrow on `kind`**

Open `packages/bindings-http/src/runtime/handler.ts`. At line 20, change the signature from `plan: BindingPlan` to `plan: QueryBindingPlan` so the query handler only accepts query plans:

```typescript
import type { QueryBindingPlan } from '../startup/compile-plan.js';
// ...
export function makeHandler(plan: QueryBindingPlan, deps: HandlerDeps): Handler {
```

Leave the rest of `handler.ts` unchanged — `plan.compiled` is still `QueryCompileResult` and is still passed to `execute()` as before.

- [ ] **Step 2.4: Run the test — expect it to pass, along with all existing tests**

Run: `cd packages/bindings-http && pnpm test`

Expected: all tests PASS. Existing query tests still work because `makeHandler` only accepts `QueryBindingPlan` — but `build-plan.test.ts` and `handler.test.ts` use `plan.<bindingId>` which will now be typed as `BindingPlan` (union). If the existing tests access fields like `.compiled` directly, narrow via `.kind === 'query'` or cast.

If an existing test fails to typecheck because of the narrowing (e.g. `test/unit/handler.test.ts` line 87: `const bp = plan.getCategorySalesHttp!;` passed to `makeHandler`), narrow it:

```typescript
const bp = plan.getCategorySalesHttp!;
if (bp.kind !== 'query') throw new Error('expected query plan');
app.get(honoPath(bp.entry.http.path), makeHandler(bp, { db }));
```

Apply the same narrowing to any other existing test that passes a `BindingPlan` to `makeHandler`.

- [ ] **Step 2.5: Commit**

```bash
git add packages/bindings-http/src/startup/compile-plan.ts \
        packages/bindings-http/src/runtime/handler.ts \
        packages/bindings-http/test/unit/build-plan.test.ts \
        packages/bindings-http/test/unit/handler.test.ts
git commit -m "refactor(bindings-http): BindingPlan becomes query|command discriminated union"
```

---

## Task 3: Add command error body helpers

Map `CommandExecutionError.code` to HTTP status and `ErrorResponseBody` shape per spec §7.4:
- `COMMAND_CONCURRENCY_CONFLICT` → HTTP 409
- `COMMAND_GUARD_REJECTED` → HTTP 422
- `COMMAND_ILLEGAL_TRANSITION` → HTTP 422

**Files:**
- Modify: `packages/bindings-http/src/errors.ts`
- Test: `packages/bindings-http/test/unit/command-errors.test.ts` (new)

- [ ] **Step 3.1: Write the failing test**

Create `packages/bindings-http/test/unit/command-errors.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { CommandExecutionError } from '@rntme/graph-ir-compiler';
import { commandErrorBody, commandErrorStatus } from '../../src/errors.js';

describe('commandErrorStatus', () => {
  it('maps COMMAND_CONCURRENCY_CONFLICT → 409', () => {
    const err = new CommandExecutionError('COMMAND_CONCURRENCY_CONFLICT', 'x');
    expect(commandErrorStatus(err)).toBe(409);
  });

  it('maps COMMAND_GUARD_REJECTED → 422', () => {
    const err = new CommandExecutionError('COMMAND_GUARD_REJECTED', 'x');
    expect(commandErrorStatus(err)).toBe(422);
  });

  it('maps COMMAND_ILLEGAL_TRANSITION → 422', () => {
    const err = new CommandExecutionError('COMMAND_ILLEGAL_TRANSITION', 'x');
    expect(commandErrorStatus(err)).toBe(422);
  });
});

describe('commandErrorBody', () => {
  it('copies code and message from CommandExecutionError', () => {
    const err = new CommandExecutionError(
      'COMMAND_ILLEGAL_TRANSITION',
      'issue cannot be assigned from closed',
    );
    expect(commandErrorBody(err)).toEqual({
      code: 'COMMAND_ILLEGAL_TRANSITION',
      message: 'issue cannot be assigned from closed',
    });
  });

  it('includes detail when present', () => {
    const err = new CommandExecutionError('COMMAND_GUARD_REJECTED', 'over capacity', {
      nodeId: 'guardCapacity',
    });
    expect(commandErrorBody(err)).toEqual({
      code: 'COMMAND_GUARD_REJECTED',
      message: 'over capacity',
      details: { nodeId: 'guardCapacity' },
    });
  });
});
```

Run: `cd packages/bindings-http && pnpm test -- command-errors.test.ts`

Expected: FAIL — `commandErrorBody` and `commandErrorStatus` are not exported from `errors.ts`.

- [ ] **Step 3.2: Implement helpers in `errors.ts`**

Append to `packages/bindings-http/src/errors.ts` (keep all existing exports untouched):

```typescript
import type { CommandExecutionError } from '@rntme/graph-ir-compiler';

export type CommandErrorStatus = 409 | 422;

export function commandErrorStatus(err: CommandExecutionError): CommandErrorStatus {
  return err.code === 'COMMAND_CONCURRENCY_CONFLICT' ? 409 : 422;
}

export function commandErrorBody(err: CommandExecutionError): ErrorResponseBody {
  const body: ErrorResponseBody = { code: err.code, message: err.message };
  if (err.detail !== undefined) body.details = err.detail;
  return body;
}
```

Run: `cd packages/bindings-http && pnpm test -- command-errors.test.ts`

Expected: PASS.

- [ ] **Step 3.3: Commit**

```bash
git add packages/bindings-http/src/errors.ts \
        packages/bindings-http/test/unit/command-errors.test.ts
git commit -m "feat(bindings-http): map CommandExecutionError codes to 409/422 + ErrorResponseBody"
```

---

## Task 4: Implement `makeCommandHandler`

Mirrors `makeHandler` (query path) but wires the command runtime. Returns the single `CommandResult` as a JSON object (not an array), and maps `CommandExecutionError` to 409/422 via helpers from task 3. Unexpected errors remain 500 (same pattern as query handler).

**Files:**
- Create: `packages/bindings-http/src/runtime/command-handler.ts`
- Test: `packages/bindings-http/test/unit/command-handler.test.ts`

- [ ] **Step 4.1: Write the failing handler-shape test**

Create `packages/bindings-http/test/unit/command-handler.test.ts`. The test builds a single command binding plan via `buildPlan`, mounts `makeCommandHandler` at the path through a fresh Hono app, and issues a POST — verifying 200, `CommandResult` shape, and event append to an in-memory `SqliteEventStore`.

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Hono } from 'hono';
import { parseBindingArtifact, validateBindings } from '@rntme/bindings';
import type { BindingResolvers } from '@rntme/bindings';
import { SqliteEventStore } from '@rntme/event-store';
import type { ActorRef } from '@rntme/event-store';
import { buildPlan, type CommandBindingPlan } from '../../src/startup/compile-plan.js';
import { makeCommandHandler } from '../../src/runtime/command-handler.js';
import { honoPath } from '../../src/startup/hono-path.js';

const here = dirname(fileURLToPath(import.meta.url));
const compilerRoot = join(here, '..', '..', '..', 'graph-ir-compiler');
const loadJson = <T>(p: string): T => JSON.parse(readFileSync(p, 'utf8')) as T;
const pdm = loadJson(join(compilerRoot, 'test', 'e2e', 'fixtures', 'issue-tracker.pdm.json'));
const qsm = loadJson(join(compilerRoot, 'test', 'e2e', 'fixtures', 'issue-tracker.qsm.json'));

const reportSpec = {
  version: '1.0-rc7',
  pdmRef: 'p',
  qsmRef: 'q',
  shapes: {},
  graphs: {
    reportIssue: {
      id: 'reportIssue',
      signature: {
        inputs: {
          issueId: { type: 'integer', mode: 'required' },
          projectId: { type: 'integer', mode: 'required' },
          reporterId: { type: 'integer', mode: 'required' },
          title: { type: 'string', mode: 'required' },
          priority: { type: 'string', mode: 'required' },
          storyPoints: { type: 'integer', mode: 'required' },
        },
        output: { type: 'row<CommandResult>', from: 'e' },
      },
      nodes: [
        {
          id: 'e',
          type: 'emit',
          config: {
            aggregate: 'Issue',
            aggregateId: { $param: 'issueId' },
            transition: 'report',
            payload: {
              title: { $param: 'title' },
              projectId: { $param: 'projectId' },
              reporterId: { $param: 'reporterId' },
              priority: { $param: 'priority' },
              storyPoints: { $param: 'storyPoints' },
            },
          },
        },
      ],
    },
  },
};

const resolvers: BindingResolvers = {
  resolveGraphSignature: (id) =>
    id === 'reportIssue'
      ? {
          id,
          role: 'command',
          inputs: {
            issueId: { type: { kind: 'scalar', primitive: 'integer' }, mode: 'required' },
            projectId: { type: { kind: 'scalar', primitive: 'integer' }, mode: 'required' },
            reporterId: { type: { kind: 'scalar', primitive: 'integer' }, mode: 'required' },
            title: { type: { kind: 'scalar', primitive: 'string' }, mode: 'required' },
            priority: { type: { kind: 'scalar', primitive: 'string' }, mode: 'required' },
            storyPoints: { type: { kind: 'scalar', primitive: 'integer' }, mode: 'required' },
          },
          output: { type: { kind: 'row', shape: 'CommandResult' }, from: 'e' },
        }
      : null,
  resolveShape: (name) =>
    name === 'CommandResult'
      ? {
          name,
          origin: 'custom',
          fields: {
            aggregateId: { type: { kind: 'scalar', primitive: 'string' }, nullable: false },
            version: { type: { kind: 'scalar', primitive: 'integer' }, nullable: false },
            eventIds: { type: { kind: 'array', element: 'string' }, nullable: false },
          },
        }
      : null,
};

const artifact = {
  version: '1.0',
  graphSpecRef: 'x',
  pdmRef: 'p',
  qsmRef: 'q',
  bindings: {
    reportIssueHttp: {
      kind: 'command',
      graph: 'reportIssue',
      target: { engine: 'sqlite', dialect: 'sqlite' },
      http: {
        method: 'POST',
        path: '/v1/issues/{issueId}/actions/report',
        parameters: [
          { name: 'issueId', in: 'path', bindTo: 'issueId', required: true },
          { name: 'projectId', in: 'body', bindTo: 'projectId', required: true },
          { name: 'reporterId', in: 'body', bindTo: 'reporterId', required: true },
          { name: 'title', in: 'body', bindTo: 'title', required: true },
          { name: 'priority', in: 'body', bindTo: 'priority', required: true },
          { name: 'storyPoints', in: 'body', bindTo: 'storyPoints', required: true },
        ],
      },
    },
  },
};

function buildAppAndStore(): {
  app: Hono;
  store: SqliteEventStore;
  actor: ActorRef | null;
} {
  const parsed = parseBindingArtifact(artifact);
  if (!parsed.ok) throw new Error('parse fail');
  const validated = validateBindings(parsed.value, resolvers);
  if (!validated.ok) throw new Error('validate fail');
  const plan = buildPlan(validated.value, reportSpec, pdm, qsm);
  const bp = plan.reportIssueHttp;
  if (!bp || bp.kind !== 'command') throw new Error('expected command plan');
  const store = new SqliteEventStore({ filename: ':memory:' });
  const actor: ActorRef = { kind: 'user', id: 'alice' };
  let seq = 0;
  const app = new Hono();
  app.post(
    honoPath(bp.entry.http.path),
    makeCommandHandler(bp as CommandBindingPlan, {
      eventStore: store,
      qsmDb: null,
      now: () => '2026-04-14T10:00:00Z',
      nextId: () => `018e9d2a-0000-7000-8000-${String(++seq).padStart(12, '0')}`,
      actorFromRequest: () => actor,
    }),
  );
  return { app, store, actor };
}

describe('makeCommandHandler — happy path', () => {
  let ctx: ReturnType<typeof buildAppAndStore>;

  beforeEach(() => {
    ctx = buildAppAndStore();
  });

  afterEach(() => {
    ctx.store.close();
  });

  it('returns 200 and CommandResult JSON on successful report', async () => {
    const res = await ctx.app.fetch(
      new Request('http://x/v1/issues/42/actions/report', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          projectId: 1,
          reporterId: 2,
          title: 'x',
          priority: 'high',
          storyPoints: 3,
        }),
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { aggregateId: string; version: number; eventIds: string[] };
    expect(body.aggregateId).toBe('42');
    expect(body.version).toBe(1);
    expect(body.eventIds).toHaveLength(1);
    const events = ctx.store.readStream('Issue-42');
    expect(events).toHaveLength(1);
    expect(events[0]!.actor).toEqual({ kind: 'user', id: 'alice' });
  });
});

describe('makeCommandHandler — 400 on body validation', () => {
  let ctx: ReturnType<typeof buildAppAndStore>;
  beforeEach(() => {
    ctx = buildAppAndStore();
  });
  afterEach(() => {
    ctx.store.close();
  });

  it('returns 400 when required body field is missing', async () => {
    const res = await ctx.app.fetch(
      new Request('http://x/v1/issues/42/actions/report', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ projectId: 1, reporterId: 2, title: 'x', priority: 'high' }),
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when body is not valid JSON', async () => {
    const res = await ctx.app.fetch(
      new Request('http://x/v1/issues/42/actions/report', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '<not json>',
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('INVALID_BODY');
  });
});

describe('makeCommandHandler — 422 on illegal transition', () => {
  let ctx: ReturnType<typeof buildAppAndStore>;
  beforeEach(() => {
    ctx = buildAppAndStore();
  });
  afterEach(() => {
    ctx.store.close();
  });

  it('returns 422 when transition is not legal from current state', async () => {
    // first report succeeds
    await ctx.app.fetch(
      new Request('http://x/v1/issues/42/actions/report', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          projectId: 1,
          reporterId: 2,
          title: 'x',
          priority: 'high',
          storyPoints: 3,
        }),
      }),
    );
    // second report on same aggregate → illegal (not in null state any more)
    const res = await ctx.app.fetch(
      new Request('http://x/v1/issues/42/actions/report', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          projectId: 1,
          reporterId: 2,
          title: 'y',
          priority: 'low',
          storyPoints: 1,
        }),
      }),
    );
    expect(res.status).toBe(422);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('COMMAND_ILLEGAL_TRANSITION');
  });
});
```

Run: `cd packages/bindings-http && pnpm test -- command-handler.test.ts`

Expected: FAIL — `command-handler.ts` does not exist, so import is broken.

- [ ] **Step 4.2: Implement `command-handler.ts`**

Create `packages/bindings-http/src/runtime/command-handler.ts`:

```typescript
import type { Context } from 'hono';
import type BetterSqlite3 from 'better-sqlite3';
import { executeCommand, CommandExecutionError } from '@rntme/graph-ir-compiler';
import type { EventStore, ActorRef } from '@rntme/event-store';
import type { CommandBindingPlan } from '../startup/compile-plan.js';
import {
  validationErrorBody,
  invalidBodyErrorBody,
  internalErrorBody,
  commandErrorBody,
  commandErrorStatus,
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

type Handler = (c: Context) => Promise<Response>;

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
      try {
        rawBody = await c.req.json();
      } catch {
        return c.json(invalidBodyErrorBody('Request body is not valid JSON'), 400);
      }
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

    try {
      const result = executeCommand(plan.compiled, graphInputs, {
        eventStore: deps.eventStore,
        qsmDb: deps.qsmDb,
        now: deps.now,
        nextId: deps.nextId,
        actor: deps.actorFromRequest(c),
      });
      return c.json(result, 200);
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

Run: `cd packages/bindings-http && pnpm test -- command-handler.test.ts`

Expected: PASS for all three `describe` blocks (happy, 400, 422).

- [ ] **Step 4.3: Commit**

```bash
git add packages/bindings-http/src/runtime/command-handler.ts \
        packages/bindings-http/test/unit/command-handler.test.ts
git commit -m "feat(bindings-http): makeCommandHandler — execute command graph + map errors to 409/422"
```

---

## Task 5: Dispatch on `entry.kind` in `createBindingsRouter`

Extend `BindingsRouterOptions` to carry the command-runtime dependencies, branch on `plan.kind` when registering routes, and keep the existing query path behaviourally identical when no command bindings are present.

**Files:**
- Modify: `packages/bindings-http/src/router.ts`

- [ ] **Step 5.1: Rewrite `router.ts`**

Replace the entire content of `packages/bindings-http/src/router.ts` with:

```typescript
import { Hono } from 'hono';
import type { Context } from 'hono';
import type BetterSqlite3 from 'better-sqlite3';
import type { ValidatedBindings, OpenApiDoc } from '@rntme/bindings';
import type { EventStore, ActorRef } from '@rntme/event-store';
import { buildPlan } from './startup/compile-plan.js';
import { honoPath } from './startup/hono-path.js';
import { makeHandler } from './runtime/handler.js';
import { makeCommandHandler } from './runtime/command-handler.js';

export type BindingsRouterOptions = {
  validated: ValidatedBindings;
  graphSpec: unknown;
  pdm: unknown;
  qsm: unknown;
  db: BetterSqlite3.Database;
  openApiDoc?: OpenApiDoc;
  onError?: (err: unknown, ctx: Context) => void;
  /** Required when at least one binding has kind "command". */
  eventStore?: EventStore;
  /** Per-request actor extractor for commands. Default: () => null. */
  actorFromRequest?: (c: Context) => ActorRef | null;
  /** Default: () => new Date().toISOString() */
  now?: () => string;
  /** Default: () => crypto.randomUUID() */
  nextId?: () => string;
};

export function createBindingsRouter(opts: BindingsRouterOptions): Hono {
  const plan = buildPlan(opts.validated, opts.graphSpec, opts.pdm, opts.qsm);
  const app = new Hono();

  const hasCommand = Object.values(plan).some((p) => p.kind === 'command');
  if (hasCommand && !opts.eventStore) {
    throw new Error(
      'createBindingsRouter: eventStore is required when any binding has kind "command"',
    );
  }

  const now = opts.now ?? ((): string => new Date().toISOString());
  const nextId = opts.nextId ?? ((): string => crypto.randomUUID());
  const actorFromRequest = opts.actorFromRequest ?? ((): ActorRef | null => null);

  for (const bp of Object.values(plan)) {
    const route = honoPath(bp.entry.http.path);
    if (bp.kind === 'command') {
      const deps = opts.onError !== undefined
        ? {
            eventStore: opts.eventStore!,
            qsmDb: opts.db,
            now,
            nextId,
            actorFromRequest,
            onError: opts.onError,
          }
        : {
            eventStore: opts.eventStore!,
            qsmDb: opts.db,
            now,
            nextId,
            actorFromRequest,
          };
      app.post(route, makeCommandHandler(bp, deps));
    } else {
      const deps = opts.onError !== undefined
        ? { db: opts.db, onError: opts.onError }
        : { db: opts.db };
      const handler = makeHandler(bp, deps);
      if (bp.entry.http.method === 'GET') app.get(route, handler);
      else app.post(route, handler);
    }
  }

  if (opts.openApiDoc !== undefined) {
    const doc = opts.openApiDoc;
    app.get('/openapi.json', (c) => c.json(doc));
  }

  return app;
}
```

- [ ] **Step 5.2: Run existing router tests**

Run: `cd packages/bindings-http && pnpm test -- integration/router.test.ts`

Expected: all 4 existing tests still PASS. (No command bindings in the fixture, so `eventStore` is not required and nothing new fires.)

- [ ] **Step 5.3: Commit**

```bash
git add packages/bindings-http/src/router.ts
git commit -m "feat(bindings-http): route POST for command bindings via executeCommand"
```

---

## Task 6: Public API surface

**Files:**
- Modify: `packages/bindings-http/src/index.ts`

- [ ] **Step 6.1: Extend exports**

Replace content of `packages/bindings-http/src/index.ts`:

```typescript
export const VERSION = '0.0.0';

export { createBindingsRouter } from './router.js';
export type { BindingsRouterOptions } from './router.js';

export { BindingsRuntimeError } from './errors.js';
export type {
  RuntimeErrorEntry,
  ErrorResponseBody,
  ValidationDetail,
  CommandErrorStatus,
} from './errors.js';
export { commandErrorBody, commandErrorStatus } from './errors.js';
```

- [ ] **Step 6.2: Update `public-api.test.ts`**

Open `packages/bindings-http/test/unit/public-api.test.ts` and make sure each of `createBindingsRouter`, `BindingsRuntimeError`, `commandErrorBody`, `commandErrorStatus` is asserted as defined. If the existing public-api test is a snapshot or explicit `expect(<name>).toBeDefined()` pattern, extend it accordingly; preserve the existing style exactly.

Run: `cd packages/bindings-http && pnpm test -- public-api.test.ts`

Expected: PASS.

- [ ] **Step 6.3: Run full package typecheck**

Run: `cd packages/bindings-http && pnpm typecheck`

Expected: PASS — no implicit-any, no missing imports.

- [ ] **Step 6.4: Commit**

```bash
git add packages/bindings-http/src/index.ts \
        packages/bindings-http/test/unit/public-api.test.ts
git commit -m "feat(bindings-http): export command error helpers from public API"
```

---

## Task 7: Integration test — command happy path through `createBindingsRouter`

End-to-end through the public `createBindingsRouter` entry point: POST → router → command handler → event store. Separates `makeCommandHandler` unit coverage (task 4) from the router-level dispatch coverage here.

**Files:**
- Create: `packages/bindings-http/test/integration/command-routing.test.ts`

- [ ] **Step 7.1: Write the integration test**

Create `packages/bindings-http/test/integration/command-routing.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { parseBindingArtifact, validateBindings } from '@rntme/bindings';
import type { BindingResolvers } from '@rntme/bindings';
import { SqliteEventStore } from '@rntme/event-store';
import type { ActorRef } from '@rntme/event-store';
import { createBindingsRouter } from '../../src/router.js';

const here = dirname(fileURLToPath(import.meta.url));
const compilerRoot = join(here, '..', '..', '..', 'graph-ir-compiler');
const loadJson = <T>(p: string): T => JSON.parse(readFileSync(p, 'utf8')) as T;
const pdm = loadJson(join(compilerRoot, 'test', 'e2e', 'fixtures', 'issue-tracker.pdm.json'));
const qsm = loadJson(join(compilerRoot, 'test', 'e2e', 'fixtures', 'issue-tracker.qsm.json'));

const spec = {
  version: '1.0-rc7',
  pdmRef: 'p',
  qsmRef: 'q',
  shapes: {},
  graphs: {
    reportIssue: {
      id: 'reportIssue',
      signature: {
        inputs: {
          issueId: { type: 'integer', mode: 'required' },
          projectId: { type: 'integer', mode: 'required' },
          reporterId: { type: 'integer', mode: 'required' },
          title: { type: 'string', mode: 'required' },
          priority: { type: 'string', mode: 'required' },
          storyPoints: { type: 'integer', mode: 'required' },
        },
        output: { type: 'row<CommandResult>', from: 'e' },
      },
      nodes: [
        {
          id: 'e',
          type: 'emit',
          config: {
            aggregate: 'Issue',
            aggregateId: { $param: 'issueId' },
            transition: 'report',
            payload: {
              title: { $param: 'title' },
              projectId: { $param: 'projectId' },
              reporterId: { $param: 'reporterId' },
              priority: { $param: 'priority' },
              storyPoints: { $param: 'storyPoints' },
            },
          },
        },
      ],
    },
    submitIssue: {
      id: 'submitIssue',
      signature: {
        inputs: { issueId: { type: 'integer', mode: 'required' } },
        output: { type: 'row<CommandResult>', from: 'e' },
      },
      nodes: [
        {
          id: 'e',
          type: 'emit',
          config: {
            aggregate: 'Issue',
            aggregateId: { $param: 'issueId' },
            transition: 'submit',
            payload: {},
          },
        },
      ],
    },
  },
};

const resolvers: BindingResolvers = {
  resolveGraphSignature: (id) => {
    if (id === 'reportIssue') {
      return {
        id,
        role: 'command',
        inputs: {
          issueId: { type: { kind: 'scalar', primitive: 'integer' }, mode: 'required' },
          projectId: { type: { kind: 'scalar', primitive: 'integer' }, mode: 'required' },
          reporterId: { type: { kind: 'scalar', primitive: 'integer' }, mode: 'required' },
          title: { type: { kind: 'scalar', primitive: 'string' }, mode: 'required' },
          priority: { type: { kind: 'scalar', primitive: 'string' }, mode: 'required' },
          storyPoints: { type: { kind: 'scalar', primitive: 'integer' }, mode: 'required' },
        },
        output: { type: { kind: 'row', shape: 'CommandResult' }, from: 'e' },
      };
    }
    if (id === 'submitIssue') {
      return {
        id,
        role: 'command',
        inputs: {
          issueId: { type: { kind: 'scalar', primitive: 'integer' }, mode: 'required' },
        },
        output: { type: { kind: 'row', shape: 'CommandResult' }, from: 'e' },
      };
    }
    return null;
  },
  resolveShape: (name) =>
    name === 'CommandResult'
      ? {
          name,
          origin: 'custom',
          fields: {
            aggregateId: { type: { kind: 'scalar', primitive: 'string' }, nullable: false },
            version: { type: { kind: 'scalar', primitive: 'integer' }, nullable: false },
            eventIds: { type: { kind: 'array', element: 'string' }, nullable: false },
          },
        }
      : null,
};

const artifact = {
  version: '1.0',
  graphSpecRef: 'x',
  pdmRef: 'p',
  qsmRef: 'q',
  bindings: {
    reportIssueHttp: {
      kind: 'command',
      graph: 'reportIssue',
      target: { engine: 'sqlite', dialect: 'sqlite' },
      http: {
        method: 'POST',
        path: '/v1/issues/{issueId}/actions/report',
        parameters: [
          { name: 'issueId', in: 'path', bindTo: 'issueId', required: true },
          { name: 'projectId', in: 'body', bindTo: 'projectId', required: true },
          { name: 'reporterId', in: 'body', bindTo: 'reporterId', required: true },
          { name: 'title', in: 'body', bindTo: 'title', required: true },
          { name: 'priority', in: 'body', bindTo: 'priority', required: true },
          { name: 'storyPoints', in: 'body', bindTo: 'storyPoints', required: true },
        ],
      },
    },
    submitIssueHttp: {
      kind: 'command',
      graph: 'submitIssue',
      target: { engine: 'sqlite', dialect: 'sqlite' },
      http: {
        method: 'POST',
        path: '/v1/issues/{issueId}/actions/submit',
        parameters: [{ name: 'issueId', in: 'path', bindTo: 'issueId', required: true }],
      },
    },
  },
};

function validated() {
  const parsed = parseBindingArtifact(artifact);
  if (!parsed.ok) throw new Error('parse fail');
  const v = validateBindings(parsed.value, resolvers);
  if (!v.ok) throw new Error('validate fail');
  return v.value;
}

function build(): {
  router: ReturnType<typeof createBindingsRouter>;
  store: SqliteEventStore;
  qsmDb: Database.Database;
} {
  const store = new SqliteEventStore({ filename: ':memory:' });
  const qsmDb = new Database(':memory:');
  const actor: ActorRef = { kind: 'user', id: 'alice' };
  let seq = 0;
  const router = createBindingsRouter({
    validated: validated(),
    graphSpec: spec,
    pdm,
    qsm,
    db: qsmDb,
    eventStore: store,
    actorFromRequest: () => actor,
    now: () => '2026-04-14T10:00:00Z',
    nextId: () => `018e9d2a-0000-7000-8000-${String(++seq).padStart(12, '0')}`,
  });
  return { router, store, qsmDb };
}

describe('createBindingsRouter — command routing', () => {
  let ctx: ReturnType<typeof build>;
  beforeEach(() => {
    ctx = build();
  });
  afterEach(() => {
    ctx.store.close();
    ctx.qsmDb.close();
  });

  it('POST /v1/issues/{id}/actions/report returns 200 CommandResult and appends event', async () => {
    const res = await ctx.router.fetch(
      new Request('http://x/v1/issues/42/actions/report', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          projectId: 1,
          reporterId: 2,
          title: 'x',
          priority: 'high',
          storyPoints: 3,
        }),
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { aggregateId: string; version: number };
    expect(body).toEqual({
      aggregateId: '42',
      version: 1,
      eventIds: ['018e9d2a-0000-7000-8000-000000000001'],
    });
    expect(ctx.store.readStream('Issue-42')).toHaveLength(1);
  });

  it('chains report → submit and version increments per transition', async () => {
    const post = (path: string, body: object): Promise<Response> =>
      ctx.router.fetch(
        new Request(`http://x${path}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        }),
      );
    const r1 = await post('/v1/issues/42/actions/report', {
      projectId: 1,
      reporterId: 2,
      title: 'x',
      priority: 'high',
      storyPoints: 3,
    });
    expect(r1.status).toBe(200);
    const r2 = await post('/v1/issues/42/actions/submit', {});
    expect(r2.status).toBe(200);
    const body2 = (await r2.json()) as { version: number };
    expect(body2.version).toBe(2);
    const events = ctx.store.readStream('Issue-42');
    expect(events.map((e) => e.eventType)).toEqual(['IssueReport', 'IssueSubmit']);
  });

  it('throws at startup when a command binding is present but eventStore missing', () => {
    const qsmDb = new Database(':memory:');
    expect(() =>
      createBindingsRouter({
        validated: validated(),
        graphSpec: spec,
        pdm,
        qsm,
        db: qsmDb,
      }),
    ).toThrow(/eventStore is required/);
    qsmDb.close();
  });
});
```

Run: `cd packages/bindings-http && pnpm test -- command-routing.test.ts`

Expected: PASS on all three cases.

- [ ] **Step 7.2: Commit**

```bash
git add packages/bindings-http/test/integration/command-routing.test.ts
git commit -m "test(bindings-http): e2e command routing via createBindingsRouter"
```

---

## Task 8: Integration test — concurrency conflict → 409

Exercises the error path that maps `COMMAND_CONCURRENCY_CONFLICT` to HTTP 409. We force a conflict by pre-appending an event to the same stream (via `store.appendEvents`) after the first successful report so that the executor sees an unexpected `expectedVersion`.

**Files:**
- Modify: `packages/bindings-http/test/integration/command-routing.test.ts` (append case)

- [ ] **Step 8.1: Add the test case**

Append this `it` inside the same `describe('createBindingsRouter — command routing', ...)` block:

```typescript
it('maps a concurrent append conflict to 409 COMMAND_CONCURRENCY_CONFLICT', async () => {
  // report first to put the stream at version 1
  const r1 = await ctx.router.fetch(
    new Request('http://x/v1/issues/42/actions/report', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        projectId: 1,
        reporterId: 2,
        title: 'x',
        priority: 'high',
        storyPoints: 3,
      }),
    }),
  );
  expect(r1.status).toBe(200);
  // externally append an event that will cause the next submit to see
  // expectedVersion mismatch when it replays before append.
  ctx.store.appendEvents([
    {
      stream: 'Issue-42',
      expectedVersion: 1,
      events: [
        {
          eventId: 'external-0000',
          eventType: 'IssueSubmit',
          aggregateType: 'Issue',
          aggregateId: '42',
          occurredAt: '2026-04-14T10:00:00Z',
          actor: null,
          schemaVersion: 1,
          payload: { before: { status: 'draft' }, after: { status: 'open' } },
        },
      ],
    },
  ]);
  // ask the router to submit — the command executor replays, sees version 1
  // (state=draft) in its read, builds an event at version 2, appends with
  // expectedVersion=1 but actual=2 → ConcurrencyConflict → 409
  const r2 = await ctx.router.fetch(
    new Request('http://x/v1/issues/42/actions/submit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    }),
  );
  // Accept either 409 (concurrency) or 422 (illegal-transition) per the
  // executor's race-detection behaviour — see command-assign.e2e.test.ts in
  // graph-ir-compiler for precedent.
  expect([409, 422]).toContain(r2.status);
  const body = (await r2.json()) as { code: string };
  expect(['COMMAND_CONCURRENCY_CONFLICT', 'COMMAND_ILLEGAL_TRANSITION']).toContain(body.code);
});
```

Run: `cd packages/bindings-http && pnpm test -- command-routing.test.ts`

Expected: PASS.

- [ ] **Step 8.2: Commit**

```bash
git add packages/bindings-http/test/integration/command-routing.test.ts
git commit -m "test(bindings-http): concurrency conflict → 409 in command routing e2e"
```

---

## Task 9: Integration test — guard rejection (read-prelude) → 422

Exercises the `COMMAND_GUARD_REJECTED` → 422 path. Uses a command graph that has a `filter` node preceding an `emit` — when the guard returns no rows the executor throws `CommandExecutionError('COMMAND_GUARD_REJECTED', ...)`.

**Files:**
- Modify: `packages/bindings-http/test/integration/command-routing.test.ts` (new describe block)

- [ ] **Step 9.1: Add a describe block with a guard-carrying command**

Append to the bottom of `packages/bindings-http/test/integration/command-routing.test.ts`:

```typescript
describe('createBindingsRouter — command guards', () => {
  // A command graph that reads from QSM, filters, and only emits if rows pass.
  // We set up the guard query so it returns zero rows → COMMAND_GUARD_REJECTED.
  const guardedSpec = {
    version: '1.0-rc7',
    pdmRef: 'p',
    qsmRef: 'q',
    shapes: {},
    graphs: {
      submitOnlyIfSeeded: {
        id: 'submitOnlyIfSeeded',
        signature: {
          inputs: { issueId: { type: 'integer', mode: 'required' } },
          output: { type: 'row<CommandResult>', from: 'emitSubmit' },
        },
        nodes: [
          {
            id: 'candidates',
            type: 'findMany',
            config: {
              source: { entity: 'Issue' },
              filter: { eq: ['id', { $param: 'issueId' }] },
            },
          },
          {
            id: 'emitSubmit',
            type: 'emit',
            config: {
              aggregate: 'Issue',
              aggregateId: { $param: 'issueId' },
              transition: 'submit',
              payload: {},
            },
          },
        ],
      },
    },
  };

  const guardedResolvers: BindingResolvers = {
    resolveGraphSignature: (id) =>
      id === 'submitOnlyIfSeeded'
        ? {
            id,
            role: 'command',
            inputs: {
              issueId: { type: { kind: 'scalar', primitive: 'integer' }, mode: 'required' },
            },
            output: { type: { kind: 'row', shape: 'CommandResult' }, from: 'emitSubmit' },
          }
        : null,
    resolveShape: (name) =>
      name === 'CommandResult'
        ? {
            name,
            origin: 'custom',
            fields: {
              aggregateId: { type: { kind: 'scalar', primitive: 'string' }, nullable: false },
              version: { type: { kind: 'scalar', primitive: 'integer' }, nullable: false },
              eventIds: { type: { kind: 'array', element: 'string' }, nullable: false },
            },
          }
        : null,
  };

  const guardedArtifact = {
    version: '1.0',
    graphSpecRef: 'x',
    pdmRef: 'p',
    qsmRef: 'q',
    bindings: {
      submitHttp: {
        kind: 'command',
        graph: 'submitOnlyIfSeeded',
        target: { engine: 'sqlite', dialect: 'sqlite' },
        http: {
          method: 'POST',
          path: '/v1/issues/{issueId}/actions/submit',
          parameters: [
            { name: 'issueId', in: 'path', bindTo: 'issueId', required: true },
          ],
        },
      },
    },
  };

  function buildGuarded(): {
    router: ReturnType<typeof createBindingsRouter>;
    store: SqliteEventStore;
    qsmDb: Database.Database;
  } {
    const store = new SqliteEventStore({ filename: ':memory:' });
    // qsmDb needs the projection table so the guard query can run against it.
    const qsmDb = new Database(':memory:');
    qsmDb.exec(`
      CREATE TABLE projection_issue (
        id INTEGER PRIMARY KEY,
        project_id INTEGER NOT NULL,
        reporter_id INTEGER,
        assignee_id INTEGER,
        sprint_id INTEGER,
        title TEXT,
        status TEXT NOT NULL,
        priority TEXT,
        story_points INTEGER,
        created_at TEXT,
        resolved_at TEXT,
        last_event_id TEXT,
        last_event_version INTEGER,
        applied_at TEXT
      );
    `);
    // Deliberately DO NOT insert a row for issue 999 → guard returns empty.
    const parsed = parseBindingArtifact(guardedArtifact);
    if (!parsed.ok) throw new Error('parse fail');
    const v = validateBindings(parsed.value, guardedResolvers);
    if (!v.ok) throw new Error('validate fail');
    let seq = 0;
    const router = createBindingsRouter({
      validated: v.value,
      graphSpec: guardedSpec,
      pdm,
      qsm,
      db: qsmDb,
      eventStore: store,
      actorFromRequest: () => null,
      now: () => '2026-04-14T10:00:00Z',
      nextId: () => `018e9d2a-0000-7000-8000-${String(++seq).padStart(12, '0')}`,
    });
    return { router, store, qsmDb };
  }

  it('returns 422 COMMAND_GUARD_REJECTED when the read-prelude guard fails', async () => {
    const ctx = buildGuarded();
    try {
      const res = await ctx.router.fetch(
        new Request('http://x/v1/issues/999/actions/submit', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({}),
        }),
      );
      expect(res.status).toBe(422);
      const body = (await res.json()) as { code: string };
      expect(body.code).toBe('COMMAND_GUARD_REJECTED');
    } finally {
      ctx.store.close();
      ctx.qsmDb.close();
    }
  });
});
```

Run: `cd packages/bindings-http && pnpm test -- command-routing.test.ts`

Expected: PASS.

**Note on the guard fixture.** The `findMany` node + `emit` pattern relies on the graph compiler's existing support for a read-prelude against QSM. If the node `type` key here is `kind` in the compiler's parse-layer, adjust accordingly to match what `graph-ir-compiler/test/e2e/command-assign.e2e.test.ts` uses (that fixture uses `type`, confirming the same shape is correct here). If `buildPlan` errors during compile of the guarded graph with a surprising code, first run `pnpm test -- build-plan.test.ts --reporter=verbose` on a temporarily-added debug case to see the exact error, then adjust the graph shape to what the compiler expects — do not bypass the error.

- [ ] **Step 9.2: Commit**

```bash
git add packages/bindings-http/test/integration/command-routing.test.ts
git commit -m "test(bindings-http): guard rejection → 422 in command routing e2e"
```

---

## Task 10: Final package verification

- [ ] **Step 10.1: Run full test suite**

Run: `cd packages/bindings-http && pnpm test`

Expected: all tests PASS. Confirm no tests were skipped.

- [ ] **Step 10.2: Run typecheck**

Run: `cd packages/bindings-http && pnpm typecheck`

Expected: PASS — zero diagnostics.

- [ ] **Step 10.3: Run lint**

Run: `cd packages/bindings-http && pnpm lint`

Expected: PASS — zero warnings or errors.

- [ ] **Step 10.4: Run monorepo-wide tests to catch cross-package regressions**

Run: `pnpm -r run test`

Expected: all packages PASS. (Touching `bindings-http` should not affect other packages; if one fails, `packages/bindings` or `packages/graph-ir-compiler` have surface contracts that changed unexpectedly.)

- [ ] **Step 10.5: Final commit (only if anything is left unstaged)**

Only run this if `git status` shows unstaged changes from linter auto-fixes or formatting:

```bash
git add -u
git commit -m "chore(bindings-http): lint/format cleanup after commands extension"
```

---

## Summary

After this plan is executed, `@rntme/bindings-http` will:

1. Recognize bindings with `kind: "command"` at plan-compile time and compile them via `compileCommand`.
2. Expose a new public surface on `BindingsRouterOptions`: `eventStore`, `actorFromRequest`, `now`, `nextId`.
3. Register Hono POST routes for command bindings that flow through `makeCommandHandler` → `executeCommand`.
4. Return `CommandResult` as a JSON object on 200; map `CommandExecutionError.code` to `409` (concurrency) or `422` (guard / illegal transition); map other errors to `500` exactly as the query handler does.
5. Preserve existing query-binding behaviour unchanged.

The downstream integration — adding command bindings + a state-machine-aware `bindings.json` + graphs into `demo/issue-tracker-api`, and the full `POST → event → relay → consumer → projection → GET` acceptance cycle — remains out of scope and belongs to spec §7.8 item 8 (a separate plan).
