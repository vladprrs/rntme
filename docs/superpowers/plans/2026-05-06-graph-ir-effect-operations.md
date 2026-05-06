# Graph IR Effect Operations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the query/command Graph IR split with effect-based operations, first-class call/branch/result nodes, clean-break binding exposure, and no executable domain-service command handlers.

**Architecture:** Graph IR compiles one operation into an effect summary and a single operation execution plan. Bindings expose operations with `exposure: "read" | "action"` and validate that exposure against inferred effects. Runtime HTTP/gRPC surfaces execute compiled operations through one executor; local emits stay service-owned, synchronous calls go through a typed operation registry, and BPMN remains the durable saga boundary.

**Tech Stack:** TypeScript strict ESM, Zod, Vitest, Hono, `better-sqlite3`, `@grpc/grpc-js`, existing rntme packages (`@rntme/graph-ir-compiler`, `@rntme/bindings`, `@rntme/bindings-http`, `@rntme/runtime`, `@rntme/blueprint`, CLI/platform deploy).

---

## File Structure

Primary spec:

- `docs/superpowers/specs/2026-05-06-graph-ir-effect-operations-design.md`

Graph IR compiler:

- Create `packages/artifacts/graph-ir-compiler/src/types/effects.ts` - `EffectSummary`, `CallEffect`, local emit effect, exposure helper types.
- Create `packages/artifacts/graph-ir-compiler/src/types/operation.ts` - `CompiledOperation`, `OperationResult`, execution context, operation registry contracts.
- Modify `packages/artifacts/graph-ir-compiler/src/types/authoring.ts` - add `findOne`, `call`, `branch`, `result`, `$ref` expressions; remove target-model `$pre` dependency.
- Modify `packages/artifacts/graph-ir-compiler/src/parse/schema.ts` - Zod schema for new nodes and refs.
- Modify `packages/artifacts/graph-ir-compiler/src/types/canonical.ts` and `src/canonical/normalize.ts` - canonical node variants.
- Modify `packages/artifacts/graph-ir-compiler/src/validate/structural/*.ts` - DAG/output/reachability rules for branch/result/call.
- Create `packages/artifacts/graph-ir-compiler/src/validate/effects.ts` - infer and validate effects, local emit ownership, call target resolution.
- Create `packages/artifacts/graph-ir-compiler/src/operation/compile.ts` - `compileOperation(...)`.
- Create `packages/artifacts/graph-ir-compiler/src/operation/execute.ts` - `executeOperation(...)`.
- Create `packages/artifacts/graph-ir-compiler/src/operation/eval.ts` - runtime expression and `$ref` evaluator.
- Create `packages/artifacts/graph-ir-compiler/src/operation/local-read.ts` - execute `findOne`/read subplans.
- Modify `packages/artifacts/graph-ir-compiler/src/index.ts` - export operation APIs and keep old APIs only until the final cleanup task removes callers.

Bindings:

- Modify `packages/artifacts/bindings/src/types/artifact.ts` - replace `kind` with `exposure`, remove `pre`.
- Modify `packages/artifacts/bindings/src/types/resolvers.ts` - expose `EffectSummary` on `GraphSignature`, remove graph role.
- Modify `packages/artifacts/bindings/src/parse/schema.ts` - parse `exposure`.
- Modify `packages/artifacts/bindings/src/validate/structural.ts`, `references.ts`, `consistency.ts` - exposure/effect validation and no `pre`.
- Modify `packages/artifacts/bindings/src/openapi/*` - output schemas from graph result shape, not `CommandResult`.
- Modify bindings tests and goldens.

Bindings HTTP/gRPC runtime:

- Create `packages/runtime/bindings-http/src/operation-contract.ts` - operation executor and call client contracts for surfaces.
- Replace `packages/runtime/bindings-http/src/startup/compile-plan.ts` with operation-plan compilation.
- Replace split query/command handlers with one operation handler in `packages/runtime/bindings-http/src/runtime/operation-handler.ts`.
- Modify `packages/runtime/bindings-http/src/router.ts` - route by exposure/effects, not kind.
- Modify `packages/runtime/bindings-grpc/src/server/handler.ts`, `emit/*`, and tests - typed operation result output.

Runtime:

- Create `packages/runtime/runtime/src/plugins/executors/graph-operation-executor.ts`.
- Modify `packages/runtime/runtime/src/start/start-service.ts` and `src/plugins/http-surface.ts` - inject one operation executor.
- Modify/remove `packages/runtime/runtime/src/plugins/executors/{graph-ir-command-executor,graph-ir-query-executor,code-command-executor,composite-command-executor}.ts` once no caller remains.
- Modify `packages/runtime/runtime/src/manifest/{schema,types,validate}.ts` - remove `commands.handlersModule`.

Blueprint / CLI / deploy:

- Modify `packages/artifacts/blueprint/src/types/artifact.ts` and `src/compose/discover-service-artifacts.ts` - add `ServiceArtifactPresence.hasCommandHandlers` by checking `services/<slug>/commands/handlers.mjs`.
- Modify `packages/artifacts/blueprint/src/validate/composition.ts` - remove `$pre` checks and reject `kind: "domain"` services with `artifacts.hasCommandHandlers === true`.
- Modify `packages/artifacts/blueprint/src/types/result.ts` - append error code for domain executable handler files.
- Modify `apps/cli/src/bundle/collect-assets.ts` - stop collecting `services/*/commands/**/*.mjs`.
- Modify `apps/platform-http/src/deploy/executor.ts` - stop copying service command handler assets and stop emitting `manifest.commands`.

Demos/docs:

- Rewrite `demo/order-fulfillment-blueprint/services/inventory/graphs/reserveStock.json`.
- Delete `demo/order-fulfillment-blueprint/services/inventory/commands/handlers.mjs`.
- Migrate all `bindings.json` files from `kind` to `exposure`.
- Migrate graph outputs away from `row<CommandResult>` where the graph is action-like.
- Update package READMEs, root `AGENTS.md`, root `README.md`, CLI bundled skills, and demo READMEs.

---

### Task 1: Add Graph IR Effect And Operation Types

**Files:**
- Create: `packages/artifacts/graph-ir-compiler/src/types/effects.ts`
- Create: `packages/artifacts/graph-ir-compiler/src/types/operation.ts`
- Modify: `packages/artifacts/graph-ir-compiler/src/index.ts`
- Test: `packages/artifacts/graph-ir-compiler/test/unit/types/effects.test.ts`

- [ ] **Step 1: Write failing effect type tests**

Create `packages/artifacts/graph-ir-compiler/test/unit/types/effects.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  effectSummaryHasAction,
  effectSummaryHasLocalEmit,
  type EffectSummary,
} from '../../../src/types/effects.js';

describe('EffectSummary helpers', () => {
  it('detects local emits', () => {
    const summary: EffectSummary = {
      localReads: false,
      localEmits: [{ aggregate: 'Order', transition: 'place', eventType: 'OrderPlaced' }],
      calls: [],
      waits: false,
    };

    expect(effectSummaryHasLocalEmit(summary)).toBe(true);
    expect(effectSummaryHasAction(summary)).toBe(true);
  });

  it('detects action-like calls', () => {
    const summary: EffectSummary = {
      localReads: false,
      localEmits: [],
      calls: [{
        target: 'service',
        operation: 'inventory.reserveStock',
        effect: 'action',
        idempotency: 'required',
      }],
      waits: false,
    };

    expect(effectSummaryHasLocalEmit(summary)).toBe(false);
    expect(effectSummaryHasAction(summary)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm -F @rntme/graph-ir-compiler test -- test/unit/types/effects.test.ts
```

Expected: FAIL with missing `src/types/effects.js`.

- [ ] **Step 3: Add effect and operation types**

Create `packages/artifacts/graph-ir-compiler/src/types/effects.ts`:

```ts
export type Exposure = 'read' | 'action';

export type LocalEmitEffect = Readonly<{
  aggregate: string;
  transition: string;
  eventType: string;
}>;

export type CallEffect = Readonly<{
  target: 'module' | 'service';
  operation: string;
  effect: 'read' | 'action';
  idempotency: 'none' | 'optional' | 'required';
}>;

export type EffectSummary = Readonly<{
  localReads: boolean;
  localEmits: readonly LocalEmitEffect[];
  calls: readonly CallEffect[];
  waits: false;
}>;

export const EMPTY_EFFECT_SUMMARY: EffectSummary = {
  localReads: false,
  localEmits: [],
  calls: [],
  waits: false,
};

export function effectSummaryHasLocalEmit(summary: EffectSummary): boolean {
  return summary.localEmits.length > 0;
}

export function effectSummaryHasAction(summary: EffectSummary): boolean {
  return effectSummaryHasLocalEmit(summary) || summary.calls.some((call) => call.effect === 'action');
}
```

Create `packages/artifacts/graph-ir-compiler/src/types/operation.ts`:

```ts
import type BetterSqlite3 from 'better-sqlite3';
import type { EventStore, ActorRef } from '@rntme/event-store';
import type { ValidatedPdm } from '@rntme/pdm';
import type { ValidatedQsm } from '@rntme/qsm';
import type { EffectSummary } from './effects.js';
import type { CanonicalGraph } from './canonical.js';

export type OperationTarget =
  | Readonly<{ module: string; operation: string }>
  | Readonly<{ service: string; operation: string }>;

export type OperationEffect = 'read' | 'action';
export type OperationIdempotency = 'none' | 'optional' | 'required';

export type OperationRegistryEntry = Readonly<{
  id: string;
  target: OperationTarget;
  effect: OperationEffect;
  idempotency: OperationIdempotency;
  inputShape: string;
  outputShape: string;
}>;

export interface OperationRegistry {
  resolve(target: OperationTarget): OperationRegistryEntry | null;
}

export interface OperationCallClient {
  call(input: {
    target: OperationRegistryEntry;
    payload: Record<string, unknown>;
    idempotencyKey: string | null;
    correlationId: string;
  }): Promise<{ ok: true; value: unknown } | { ok: false; error: { code: string; message: string; detail?: unknown } }>;
}

export type CompiledOperation = Readonly<{
  graphId: string;
  graph: CanonicalGraph;
  effects: EffectSummary;
  resultNodeId: string;
  pdm: ValidatedPdm;
  qsm: ValidatedQsm;
}>;

export type OperationExecutionContext = Readonly<{
  qsmDb: BetterSqlite3.Database;
  eventStore: EventStore | null;
  callClient: OperationCallClient | null;
  now: () => string;
  nextId: () => string;
  actor: ActorRef | null;
  correlation: {
    commandId: string;
    correlationId: string;
    traceparent: string | null;
  };
  idempotencyKey: string | null;
}>;

export type OperationResult = Readonly<{
  value: unknown;
  metadata: {
    eventIds: readonly string[];
    commandId: string;
    correlationId: string;
  };
}>;
```

Modify `packages/artifacts/graph-ir-compiler/src/index.ts` exports:

```ts
export type {
  Exposure,
  EffectSummary,
  LocalEmitEffect,
  CallEffect,
} from './types/effects.js';
export {
  effectSummaryHasAction,
  effectSummaryHasLocalEmit,
} from './types/effects.js';
export type {
  CompiledOperation,
  OperationRegistry,
  OperationRegistryEntry,
  OperationTarget,
  OperationCallClient,
  OperationExecutionContext,
  OperationResult,
} from './types/operation.js';
```

- [ ] **Step 4: Verify**

Run:

```bash
pnpm -F @rntme/graph-ir-compiler test -- test/unit/types/effects.test.ts
pnpm -F @rntme/graph-ir-compiler typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/artifacts/graph-ir-compiler/src/types/effects.ts \
  packages/artifacts/graph-ir-compiler/src/types/operation.ts \
  packages/artifacts/graph-ir-compiler/src/index.ts \
  packages/artifacts/graph-ir-compiler/test/unit/types/effects.test.ts
git commit -m "feat(graph-ir): add effect operation types"
```

### Task 2: Parse And Normalize New Operation Nodes

**Files:**
- Modify: `packages/artifacts/graph-ir-compiler/src/types/authoring.ts`
- Modify: `packages/artifacts/graph-ir-compiler/src/parse/schema.ts`
- Modify: `packages/artifacts/graph-ir-compiler/src/types/canonical.ts`
- Modify: `packages/artifacts/graph-ir-compiler/src/canonical/normalize.ts`
- Test: `packages/artifacts/graph-ir-compiler/test/unit/parse/operation-nodes.test.ts`
- Test: `packages/artifacts/graph-ir-compiler/test/unit/canonical/operation-normalize.test.ts`

- [ ] **Step 1: Write failing parse tests**

Create `packages/artifacts/graph-ir-compiler/test/unit/parse/operation-nodes.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseAuthoringSpec } from '../../../src/parse/parse.js';

const base = {
  version: '1.0-rc7',
  pdmRef: 'demo.pdm',
  qsmRef: 'demo.qsm',
  shapes: {
    ReservationResult: {
      fields: {
        reserved: { type: 'boolean', nullable: false },
        reason: { type: 'string', nullable: true },
      },
    },
  },
};

describe('operation nodes parse', () => {
  it('accepts findOne, call, branch, emit, result, and $ref', () => {
    const r = parseAuthoringSpec({
      ...base,
      graphs: {
        reserveStock: {
          id: 'reserveStock',
          signature: {
            inputs: {
              sku: { type: 'string', mode: 'required' },
              quantity: { type: 'integer', mode: 'required' },
            },
            output: { type: 'row<ReservationResult>', from: 'out' },
          },
          nodes: [
            {
              id: 'item',
              type: 'findOne',
              config: {
                source: { projection: 'InventoryItemView' },
                where: { eq: ['inventoryItemView.sku', { $param: 'sku' }] },
              },
            },
            {
              id: 'credit',
              type: 'call',
              target: { service: 'customers', operation: 'getCreditStatus' },
              input: { customerId: { $ref: 'item.customerId' } },
              policy: {
                timeoutMs: 500,
                retry: { attempts: 2, retryOn: 'transient' },
                idempotency: { mode: 'inherit' },
                onError: 'fail',
              },
            },
            {
              id: 'decision',
              type: 'branch',
              cases: [
                { when: { gte: [{ $ref: 'item.available' }, { $param: 'quantity' }] }, then: 'emitReserved' },
                { default: true, then: 'emitRejected' },
              ],
            },
            {
              id: 'emitReserved',
              type: 'emit',
              config: {
                aggregate: 'StockReservation',
                aggregateId: { $node: 'newId' },
                transition: 'reserve',
                payload: { sku: { $param: 'sku' }, quantity: { $param: 'quantity' } },
              },
            },
            {
              id: 'out',
              type: 'result',
              value: { reserved: { $literal: true }, reservationId: { $ref: 'emitReserved.aggregateId' } },
            },
          ],
        },
      },
    });

    expect(r.ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run parse test to verify it fails**

Run:

```bash
pnpm -F @rntme/graph-ir-compiler test -- test/unit/parse/operation-nodes.test.ts
```

Expected: FAIL with schema violations for `findOne`, `call`, `branch`, `result`, or `$ref`.

- [ ] **Step 3: Extend authoring and parser types**

In `packages/artifacts/graph-ir-compiler/src/types/authoring.ts`, add to `Expr`:

```ts
  | { $ref: string }
```

Add node types:

```ts
export type FindOneNode = {
  id: string;
  type: 'findOne';
  config: {
    source: FindManySource;
    where: Expr;
  };
};

export type CallPolicy = {
  timeoutMs: number;
  retry?: { attempts?: number; retryOn?: 'never' | 'transient' | 'all' };
  idempotency?: { mode: 'inherit' | 'none' | 'derive'; key?: Expr };
  onError: 'fail';
};

export type CallNode = {
  id: string;
  type: 'call';
  target: { module: string; operation: string } | { service: string; operation: string };
  input: Record<string, Expr>;
  policy: CallPolicy;
};

export type BranchCase = { when: Expr; then: string } | { default: true; then: string };

export type BranchNode = {
  id: string;
  type: 'branch';
  cases: BranchCase[];
};

export type ResultNode = {
  id: string;
  type: 'result';
  value: Record<string, Expr> | Expr;
};
```

Update unions:

```ts
export type GraphNode =
  | FindManyNode
  | FindOneNode
  | FilterNode
  | MapNode
  | ReduceNode
  | SortNode
  | LimitNode;

export type AnyGraphNode =
  | GraphNode
  | DistinctNode
  | LookupOneNode
  | UuidNode
  | EmitNode
  | CallNode
  | BranchNode
  | ResultNode;
```

In `packages/artifacts/graph-ir-compiler/src/parse/schema.ts`, add:

```ts
z.object({ $ref: z.string().min(1) }).strict(),
```

to `expr`.

Add node schemas:

```ts
const findOneNode = z.object({
  id: z.string(),
  type: z.literal('findOne'),
  config: z.object({
    source: z.union([
      z.object({ entity: sourceName }).strict(),
      z.object({ projection: sourceName }).strict(),
      z.object({ eventType: sourceName }).strict(),
      preRef,
    ]),
    where: expr,
  }).strict(),
}).strict();

const callNode = z.object({
  id: z.string(),
  type: z.literal('call'),
  target: z.union([
    z.object({ module: z.string().min(1), operation: z.string().min(1) }).strict(),
    z.object({ service: z.string().min(1), operation: z.string().min(1) }).strict(),
  ]),
  input: z.record(z.string(), expr),
  policy: z.object({
    timeoutMs: z.number().int().min(1).max(30_000),
    retry: z.object({
      attempts: z.number().int().min(1).max(10).optional(),
      retryOn: z.enum(['never', 'transient', 'all']).optional(),
    }).strict().optional(),
    idempotency: z.object({
      mode: z.enum(['inherit', 'none', 'derive']),
      key: expr.optional(),
    }).strict().optional(),
    onError: z.literal('fail'),
  }).strict(),
}).strict();

const branchNode = z.object({
  id: z.string(),
  type: z.literal('branch'),
  cases: z.array(z.union([
    z.object({ when: expr, then: z.string().min(1) }).strict(),
    z.object({ default: z.literal(true), then: z.string().min(1) }).strict(),
  ])).min(1),
}).strict();

const resultNode = z.object({
  id: z.string(),
  type: z.literal('result'),
  value: z.union([expr, z.record(z.string(), expr)]),
}).strict();
```

Add them to `graphNode` discriminated union.

- [ ] **Step 4: Write failing canonical test**

Create `packages/artifacts/graph-ir-compiler/test/unit/canonical/operation-normalize.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { normalize } from '../../../src/canonical/normalize.js';
import type { AuthoringSpecOutput } from '../../../src/parse/schema.js';

describe('operation node normalization', () => {
  it('normalizes call, branch, and result nodes', () => {
    const spec = {
      version: '1.0-rc7',
      pdmRef: 'x',
      qsmRef: 'y',
      shapes: {},
      graphs: {
        g: {
          id: 'g',
          signature: {
            inputs: { sku: { type: 'string', mode: 'required' } },
            output: { type: 'row<Result>', from: 'out' },
          },
          nodes: [
            { id: 'call', type: 'call', target: { service: 's', operation: 'op' }, input: { sku: { $param: 'sku' } }, policy: { timeoutMs: 500, onError: 'fail' } },
            { id: 'branch', type: 'branch', cases: [{ default: true, then: 'out' }] },
            { id: 'out', type: 'result', value: { ok: { $literal: true } } },
          ],
        },
      },
    } as unknown as AuthoringSpecOutput;

    const normalized = normalize(spec);
    const graph = normalized.graphs.g!;
    expect(graph.nodes.map((node) => node.kind)).toEqual(['call', 'branch', 'result']);
    expect(graph.outputFrom).toBe('out');
  });
});
```

- [ ] **Step 5: Extend canonical types and normalize**

In `packages/artifacts/graph-ir-compiler/src/types/canonical.ts`, add:

```ts
import type { CallPolicy, Expr, FindManySource } from './authoring.js';
import type { OperationTarget } from './operation.js';

export type CanonicalFindOne = {
  kind: 'findOne';
  id: string;
  scope: ScopeId;
  source: { entity: string } | { projection: string } | { eventType: string };
  alias: string;
  where: Expr;
};

export type CanonicalCall = {
  kind: 'call';
  id: string;
  scope: ScopeId;
  target: OperationTarget;
  input: Record<string, Expr>;
  policy: CallPolicy;
};

export type CanonicalBranch = {
  kind: 'branch';
  id: string;
  scope: ScopeId;
  cases: Array<{ when: Expr; then: string } | { default: true; then: string }>;
};

export type CanonicalResult = {
  kind: 'result';
  id: string;
  scope: ScopeId;
  value: Record<string, Expr> | Expr;
};
```

Add these to `CanonicalNode`.

In `packages/artifacts/graph-ir-compiler/src/canonical/normalize.ts`, mirror the existing node cases:

```ts
case 'findOne':
  return {
    kind: 'findOne',
    id: node.id,
    scope,
    source: normalizeSource(node.config.source),
    alias: aliasForSource(node.config.source),
    where: node.config.where,
  };
case 'call':
  return { kind: 'call', id: node.id, scope, target: node.target, input: node.input, policy: node.policy };
case 'branch':
  return { kind: 'branch', id: node.id, scope, cases: node.cases };
case 'result':
  return { kind: 'result', id: node.id, scope, value: node.value };
```

`normalize.ts` already has `sourceAlias(...)`; reuse it for `findOne.alias` and widen its parameter type to include the same source union used by `findMany`.

- [ ] **Step 6: Verify**

Run:

```bash
pnpm -F @rntme/graph-ir-compiler test -- test/unit/parse/operation-nodes.test.ts test/unit/canonical/operation-normalize.test.ts
pnpm -F @rntme/graph-ir-compiler typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/artifacts/graph-ir-compiler/src/types/authoring.ts \
  packages/artifacts/graph-ir-compiler/src/parse/schema.ts \
  packages/artifacts/graph-ir-compiler/src/types/canonical.ts \
  packages/artifacts/graph-ir-compiler/src/canonical/normalize.ts \
  packages/artifacts/graph-ir-compiler/test/unit/parse/operation-nodes.test.ts \
  packages/artifacts/graph-ir-compiler/test/unit/canonical/operation-normalize.test.ts
git commit -m "feat(graph-ir): parse effect operation nodes"
```

### Task 3: Infer And Validate Operation Effects

**Files:**
- Create: `packages/artifacts/graph-ir-compiler/src/validate/effects.ts`
- Modify: `packages/artifacts/graph-ir-compiler/src/types/result.ts`
- Modify: `packages/artifacts/graph-ir-compiler/src/index.ts`
- Test: `packages/artifacts/graph-ir-compiler/test/unit/validate/effects.test.ts`

- [ ] **Step 1: Write failing effect validation tests**

Create `packages/artifacts/graph-ir-compiler/test/unit/validate/effects.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { inferEffectSummary, validateOperationEffects } from '../../../src/validate/effects.js';
import type { CanonicalGraph } from '../../../src/types/canonical.js';
import type { OperationRegistry } from '../../../src/types/operation.js';

const registry: OperationRegistry = {
  resolve(target) {
    if ('service' in target && target.operation === 'getCreditStatus') {
      return {
        id: 'service:customers.getCreditStatus',
        target,
        effect: 'read',
        idempotency: 'none',
        inputShape: 'GetCreditStatusInput',
        outputShape: 'CreditStatus',
      };
    }
    if ('module' in target && target.operation === 'CreateCheckoutSession') {
      return {
        id: 'module:payments.CreateCheckoutSession',
        target,
        effect: 'action',
        idempotency: 'required',
        inputShape: 'CheckoutInput',
        outputShape: 'CheckoutSession',
      };
    }
    return null;
  },
};

function graph(nodes: CanonicalGraph['nodes']): CanonicalGraph {
  return {
    id: 'g',
    signature: { inputs: {}, output: { type: 'row<Result>', from: 'out' } },
    nodes,
    outputFrom: 'out',
  };
}

describe('operation effects', () => {
  it('infers local reads, local emits, and call effects', () => {
    const r = inferEffectSummary(graph([
      { kind: 'findOne', id: 'item', scope: 's1', source: { projection: 'InventoryItemView' }, alias: 'inventoryItemView', where: { $literal: 'x' } },
      { kind: 'call', id: 'credit', scope: 's2', target: { service: 'customers', operation: 'getCreditStatus' }, input: {}, policy: { timeoutMs: 500, onError: 'fail' } },
      { kind: 'emit', id: 'e', scope: 's3', aggregate: 'StockReservation', aggregateId: { $param: 'id' }, transition: 'reserve', payload: {} },
      { kind: 'result', id: 'out', scope: 's4', value: { ok: true } },
    ]), registry, { StockReservation: 'StockReserved' });

    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.localReads).toBe(true);
      expect(r.value.calls).toEqual([{ target: 'service', operation: 'customers.getCreditStatus', effect: 'read', idempotency: 'none' }]);
      expect(r.value.localEmits).toEqual([{ aggregate: 'StockReservation', transition: 'reserve', eventType: 'StockReserved' }]);
    }
  });

  it('rejects unresolved call targets and foreign emits', () => {
    const r = validateOperationEffects({
      graph: graph([
        { kind: 'call', id: 'missing', scope: 's1', target: { service: 'unknown', operation: 'nope' }, input: {}, policy: { timeoutMs: 500, onError: 'fail' } },
        { kind: 'emit', id: 'e', scope: 's2', aggregate: 'ForeignAggregate', aggregateId: { $param: 'id' }, transition: 'x', payload: {} },
        { kind: 'result', id: 'out', scope: 's3', value: { ok: true } },
      ]),
      registry,
      ownedAggregates: new Set(['StockReservation']),
      eventTypesByAggregateTransition: new Map(),
    });

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.map((e) => e.code)).toEqual(expect.arrayContaining([
        'GRAPH_CALL_TARGET_UNRESOLVED',
        'GRAPH_EMIT_FOREIGN_AGGREGATE',
      ]));
    }
  });
});
```

- [ ] **Step 2: Add error codes**

Append to `ERROR_CODES` in `packages/artifacts/graph-ir-compiler/src/types/result.ts`:

```ts
GRAPH_CALL_TARGET_UNRESOLVED: 'GRAPH_CALL_TARGET_UNRESOLVED',
GRAPH_EMIT_FOREIGN_AGGREGATE: 'GRAPH_EMIT_FOREIGN_AGGREGATE',
GRAPH_ACTION_CALL_POLICY_INVALID: 'GRAPH_ACTION_CALL_POLICY_INVALID',
GRAPH_EXPOSURE_EFFECT_FORBIDDEN: 'GRAPH_EXPOSURE_EFFECT_FORBIDDEN',
GRAPH_RESULT_NODE_REQUIRED: 'GRAPH_RESULT_NODE_REQUIRED',
GRAPH_BRANCH_DEFAULT_REQUIRED: 'GRAPH_BRANCH_DEFAULT_REQUIRED',
```

Add them only at the end of the registry object. Do not reorder existing codes.

- [ ] **Step 3: Implement effect inference and validation**

Create `packages/artifacts/graph-ir-compiler/src/validate/effects.ts`:

```ts
import { deriveEventTypeName } from '../emit/event-type.js';
import { err, ok, ERROR_CODES, type GraphIrError, type Result } from '../types/result.js';
import type { CanonicalGraph } from '../types/canonical.js';
import type { EffectSummary, CallEffect, LocalEmitEffect, Exposure } from '../types/effects.js';
import type { OperationRegistry } from '../types/operation.js';

export function inferEffectSummary(
  graph: CanonicalGraph,
  registry: OperationRegistry,
  eventTypesByAggregateTransition: Record<string, string>,
): Result<EffectSummary> {
  const errors: GraphIrError[] = [];
  const calls: CallEffect[] = [];
  const localEmits: LocalEmitEffect[] = [];
  let localReads = false;

  for (const node of graph.nodes) {
    if (node.kind === 'findMany' || node.kind === 'findOne') localReads = true;
    if (node.kind === 'call') {
      const entry = registry.resolve(node.target);
      if (entry === null) {
        errors.push({
          layer: 'semantic',
          code: ERROR_CODES.GRAPH_CALL_TARGET_UNRESOLVED,
          message: `call node "${node.id}" target could not be resolved`,
          location: { graphId: graph.id, nodeId: node.id },
        });
        continue;
      }
      calls.push({
        target: 'module' in node.target ? 'module' : 'service',
        operation: 'module' in node.target ? `${node.target.module}.${node.target.operation}` : `${node.target.service}.${node.target.operation}`,
        effect: entry.effect,
        idempotency: entry.idempotency,
      });
    }
    if (node.kind === 'emit') {
      const key = `${node.aggregate}.${node.transition}`;
      localEmits.push({
        aggregate: node.aggregate,
        transition: node.transition,
        eventType: eventTypesByAggregateTransition[key] ?? deriveEventTypeName(node.aggregate, node.transition),
      });
    }
  }

  if (errors.length > 0) return err(errors);
  return ok({ localReads, localEmits, calls, waits: false });
}

export function validateOperationEffects(input: {
  graph: CanonicalGraph;
  registry: OperationRegistry;
  ownedAggregates: ReadonlySet<string>;
  eventTypesByAggregateTransition: ReadonlyMap<string, string>;
  exposure?: Exposure;
}): Result<EffectSummary> {
  const eventTypes: Record<string, string> = {};
  for (const [key, value] of input.eventTypesByAggregateTransition) eventTypes[key] = value;

  const summary = inferEffectSummary(input.graph, input.registry, eventTypes);
  const errors: GraphIrError[] = summary.ok ? [] : [...summary.errors];

  if (summary.ok) {
    for (const emit of summary.value.localEmits) {
      if (!input.ownedAggregates.has(emit.aggregate)) {
        errors.push({
          layer: 'semantic',
          code: ERROR_CODES.GRAPH_EMIT_FOREIGN_AGGREGATE,
          message: `emit target aggregate "${emit.aggregate}" is not owned by the current service`,
          location: { graphId: input.graph.id },
        });
      }
    }
    if (input.exposure === 'read') {
      if (summary.value.localEmits.length > 0 || summary.value.calls.some((call) => call.effect === 'action')) {
        errors.push({
          layer: 'semantic',
          code: ERROR_CODES.GRAPH_EXPOSURE_EFFECT_FORBIDDEN,
          message: 'exposure "read" cannot include local emits or action calls',
          location: { graphId: input.graph.id },
        });
      }
    }
  }

  if (!input.graph.nodes.some((node) => node.kind === 'result')) {
    errors.push({
      layer: 'structural',
      code: ERROR_CODES.GRAPH_RESULT_NODE_REQUIRED,
      message: `graph "${input.graph.id}" must contain a result node`,
      location: { graphId: input.graph.id },
    });
  }

  for (const node of input.graph.nodes) {
    if (node.kind !== 'branch') continue;
    const defaults = node.cases.filter((c) => 'default' in c).length;
    if (defaults !== 1) {
      errors.push({
        layer: 'structural',
        code: ERROR_CODES.GRAPH_BRANCH_DEFAULT_REQUIRED,
        message: `branch "${node.id}" must declare exactly one default case`,
        location: { graphId: input.graph.id, nodeId: node.id },
      });
    }
  }

  if (errors.length > 0) return err(errors);
  return summary as Result<EffectSummary>;
}
```

- [ ] **Step 4: Export validation API**

Add to `packages/artifacts/graph-ir-compiler/src/index.ts`:

```ts
export {
  inferEffectSummary,
  validateOperationEffects,
} from './validate/effects.js';
```

- [ ] **Step 5: Verify**

Run:

```bash
pnpm -F @rntme/graph-ir-compiler test -- test/unit/validate/effects.test.ts
pnpm -F @rntme/graph-ir-compiler typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/artifacts/graph-ir-compiler/src/validate/effects.ts \
  packages/artifacts/graph-ir-compiler/src/types/result.ts \
  packages/artifacts/graph-ir-compiler/src/index.ts \
  packages/artifacts/graph-ir-compiler/test/unit/validate/effects.test.ts
git commit -m "feat(graph-ir): infer operation effects"
```

### Task 4: Compile And Execute Local Operation Graphs

**Files:**
- Create: `packages/artifacts/graph-ir-compiler/src/operation/compile.ts`
- Create: `packages/artifacts/graph-ir-compiler/src/operation/eval.ts`
- Create: `packages/artifacts/graph-ir-compiler/src/operation/local-read.ts`
- Create: `packages/artifacts/graph-ir-compiler/src/operation/execute.ts`
- Modify: `packages/artifacts/graph-ir-compiler/src/index.ts`
- Test: `packages/artifacts/graph-ir-compiler/test/integration/operation-local.test.ts`

- [ ] **Step 1: Write failing local operation integration test**

Create `packages/artifacts/graph-ir-compiler/test/integration/operation-local.test.ts`.

Use a minimal PDM/QSM fixture inline. The important behavior is branch + local emit + explicit result:

```ts
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { SqliteEventStore } from '@rntme/event-store';
import { compileOperation, executeOperation, type OperationRegistry } from '../../src/index.js';

const registry: OperationRegistry = { resolve: () => null };

const pdm = {
  version: '1.0',
  entities: {
    StockReservation: {
      ownerService: 'inventory',
      kind: 'owned',
      table: 'stock_reservations',
      fields: {
        id: { type: 'string', nullable: false, column: 'id' },
        sku: { type: 'string', nullable: false, column: 'sku' },
        quantity: { type: 'integer', nullable: false, column: 'quantity' },
        reason: { type: 'string', nullable: true, column: 'reason' },
        status: { type: 'string', nullable: false, column: 'status' },
      },
      keys: ['id'],
      stateMachine: {
        stateField: 'status',
        initial: null,
        states: ['reserved', 'rejected'],
        transitions: {
          reserve: { from: null, to: 'reserved', affects: ['sku', 'quantity'], eventType: 'StockReserved' },
          rejected: { from: null, to: 'rejected', affects: ['sku', 'quantity', 'reason'], eventType: 'StockReservationRejected' },
        },
      },
    },
  },
};

const qsm = {
  version: '1.0',
  pdmRef: 'inventory',
  projections: {
    InventoryItemView: {
      kind: 'entity-mirror',
      source: { entity: 'StockReservation' },
      table: 'inventory_items',
      exposed: ['sku', 'quantity'],
    },
  },
};

const graph = {
  version: '1.0-rc7',
  pdmRef: 'inventory',
  qsmRef: 'inventory.read',
  shapes: {
    ReservationResult: {
      fields: {
        reserved: { type: 'boolean', nullable: false },
        reservationId: { type: 'string', nullable: true },
        reason: { type: 'string', nullable: true },
      },
    },
  },
  graphs: {
    reserveStock: {
      id: 'reserveStock',
      signature: {
        inputs: {
          reservationId: { type: 'string', mode: 'required' },
          sku: { type: 'string', mode: 'required' },
          quantity: { type: 'integer', mode: 'required' },
        },
        output: { type: 'row<ReservationResult>', from: 'out' },
      },
      nodes: [
        {
          id: 'item',
          type: 'findOne',
          config: {
            source: { projection: 'InventoryItemView' },
            where: { eq: ['inventoryItemView.sku', { $param: 'sku' }] },
          },
        },
        {
          id: 'decision',
          type: 'branch',
          cases: [
            { when: { gte: [{ $ref: 'item.quantity' }, { $param: 'quantity' }] }, then: 'emitReserved' },
            { default: true, then: 'emitRejected' },
          ],
        },
        {
          id: 'emitReserved',
          type: 'emit',
          config: {
            aggregate: 'StockReservation',
            aggregateId: { $param: 'reservationId' },
            transition: 'reserve',
            payload: { sku: { $param: 'sku' }, quantity: { $param: 'quantity' } },
          },
        },
        {
          id: 'emitRejected',
          type: 'emit',
          config: {
            aggregate: 'StockReservation',
            aggregateId: { $param: 'reservationId' },
            transition: 'rejected',
            payload: { sku: { $param: 'sku' }, quantity: { $param: 'quantity' }, reason: { $literal: 'insufficient stock' } },
          },
        },
        {
          id: 'out',
          type: 'result',
          value: {
            reserved: { $ref: 'emitReserved.didRun' },
            reservationId: { $ref: 'emitReserved.aggregateId' },
            reason: { $ref: 'emitRejected.payload.after.reason' },
          },
        },
      ],
    },
  },
};

describe('effect operation local execution', () => {
  it('branches to reserved or rejected and returns typed output', async () => {
    const compiled = compileOperation(graph, pdm, qsm, {
      registry,
      serviceName: 'inventory',
      ownedAggregates: new Set(['StockReservation']),
      exposure: 'action',
    });
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;

    const db = new Database(':memory:');
    db.exec('CREATE TABLE inventory_items (sku TEXT PRIMARY KEY, quantity INTEGER NOT NULL)');
    db.prepare('INSERT INTO inventory_items (sku, quantity) VALUES (?, ?)').run('sku-ok', 5);
    db.prepare('INSERT INTO inventory_items (sku, quantity) VALUES (?, ?)').run('missing-stock', 0);
    const eventStore = new SqliteEventStore({ filename: ':memory:' });

    const ok = await executeOperation(compiled.value, {
      reservationId: 'reservation-1',
      sku: 'sku-ok',
      quantity: 1,
    }, {
      qsmDb: db,
      eventStore,
      callClient: null,
      now: () => '2026-05-06T00:00:00.000Z',
      nextId: () => crypto.randomUUID(),
      actor: null,
      correlation: { commandId: 'cmd-1', correlationId: 'corr-1', traceparent: null },
      idempotencyKey: 'idem-1',
    });

    expect(ok.value).toMatchObject({ reserved: true, reservationId: 'reservation-1' });

    const rejected = await executeOperation(compiled.value, {
      reservationId: 'reservation-2',
      sku: 'missing-stock',
      quantity: 1,
    }, {
      qsmDb: db,
      eventStore,
      callClient: null,
      now: () => '2026-05-06T00:00:00.000Z',
      nextId: () => crypto.randomUUID(),
      actor: null,
      correlation: { commandId: 'cmd-2', correlationId: 'corr-2', traceparent: null },
      idempotencyKey: 'idem-2',
    });

    expect(rejected.value).toMatchObject({ reserved: false, reason: 'insufficient stock' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm -F @rntme/graph-ir-compiler test -- test/integration/operation-local.test.ts
```

Expected: FAIL with missing `compileOperation`.

- [ ] **Step 3: Implement compileOperation shell**

Create `packages/artifacts/graph-ir-compiler/src/operation/compile.ts`:

```ts
import { parseAuthoringSpec } from '../parse/parse.js';
import { parseGraphIrArtifacts } from '../explain/explain.js';
import { validateStructural } from '../validate/structural/index.js';
import { validateSemantic } from '../validate/semantic/index.js';
import { normalize } from '../canonical/normalize.js';
import { validateOperationEffects } from '../validate/effects.js';
import { err, ok, ERROR_CODES, type Result } from '../types/result.js';
import { toGraphIrError } from '../types/errors.js';
import { deriveEventTypes } from '@rntme/pdm';
import type { CompiledOperation, OperationRegistry } from '../types/operation.js';
import type { Exposure } from '../types/effects.js';

export type CompileOperationOptions = Readonly<{
  registry: OperationRegistry;
  serviceName: string;
  ownedAggregates: ReadonlySet<string>;
  exposure: Exposure;
}>;

export function compileOperation(
  rawSpec: unknown,
  rawPdm: unknown,
  rawQsm: unknown,
  opts: CompileOperationOptions,
): Result<CompiledOperation> {
  const specR = parseAuthoringSpec(rawSpec);
  if (!specR.ok) return specR;

  const pq = parseGraphIrArtifacts(rawPdm, rawQsm);
  if (!pq.ok) return pq;

  const sv = validateStructural(specR.value, pq.value.pdm, pq.value.qsm);
  if (!sv.ok) return sv;

  let canonical;
  try {
    canonical = normalize(sv.value);
  } catch (e) {
    return err([toGraphIrError(e, 'canonical')]);
  }

  const graphIds = Object.keys(canonical.graphs);
  if (graphIds.length !== 1) {
    return err([{ layer: 'canonical', code: ERROR_CODES.STRUCT_DUPLICATE_GRAPH_ID, message: 'compileOperation accepts exactly one graph' }]);
  }

  const graph = canonical.graphs[graphIds[0]!]!;
  const semR = validateSemantic(graph, pq.value.pdm, pq.value.qsm, sv.value.shapes);
  if (!semR.ok) return semR;

  const eventTypes = new Map(
    deriveEventTypes(pq.value.pdm).map((event) => [
      `${event.aggregateType}.${event.transition}`,
      event.eventType,
    ]),
  );

  const effects = validateOperationEffects({
    graph,
    registry: opts.registry,
    ownedAggregates: opts.ownedAggregates,
    eventTypesByAggregateTransition: eventTypes,
    exposure: opts.exposure,
  });
  if (!effects.ok) return effects;

  return ok({
    graphId: graph.id,
    graph,
    effects: effects.value,
    resultNodeId: graph.outputFrom,
    pdm: pq.value.pdm,
    qsm: pq.value.qsm,
  });
}
```

- [ ] **Step 4: Implement runtime evaluator and local reads**

Create `packages/artifacts/graph-ir-compiler/src/operation/eval.ts`:

```ts
import { runtimeError } from '../types/errors.js';
import type { Expr } from '../types/authoring.js';

export type NodeOutputs = Record<string, unknown>;

export function evalOperationExpr(
  expr: Expr,
  params: Record<string, unknown>,
  outputs: NodeOutputs,
): unknown {
  if (expr === null || typeof expr === 'number' || typeof expr === 'boolean') return expr;
  if (typeof expr === 'string') return readPath(outputs, expr);
  if ('$literal' in expr) return expr.$literal;
  if ('$param' in expr) return params[expr.$param] ?? null;
  if ('$ref' in expr) return readPath(outputs, expr.$ref);
  if ('$node' in expr) return outputs[expr.$node] ?? null;
  if ('gte' in expr) {
    const [a, b] = expr.gte ?? [];
    return Number(evalOperationExpr(a!, params, outputs)) >= Number(evalOperationExpr(b!, params, outputs));
  }
  if ('eq' in expr) {
    const [a, b] = expr.eq ?? [];
    return evalOperationExpr(a!, params, outputs) === evalOperationExpr(b!, params, outputs);
  }
  if ('and' in expr) return (expr.and ?? []).every((e) => Boolean(evalOperationExpr(e, params, outputs)));
  if ('or' in expr) return (expr.or ?? []).some((e) => Boolean(evalOperationExpr(e, params, outputs)));
  if ('not' in expr) return !Boolean(evalOperationExpr((expr.not ?? [])[0]!, params, outputs));
  throw runtimeError('RUNTIME_INTERNAL_ERROR', `unsupported operation expression: ${JSON.stringify(expr)}`);
}

export function evalObjectExpr(
  value: Record<string, Expr> | Expr,
  params: Record<string, unknown>,
  outputs: NodeOutputs,
): unknown {
  if (value !== null && typeof value === 'object' && !Array.isArray(value) && !isExprObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [key, expr] of Object.entries(value)) out[key] = evalOperationExpr(expr, params, outputs);
    return out;
  }
  return evalOperationExpr(value as Expr, params, outputs);
}

function isExprObject(value: Record<string, unknown>): boolean {
  return Object.keys(value).some((key) => key.startsWith('$') || ['eq', 'gte', 'and', 'or', 'not'].includes(key));
}

function readPath(root: NodeOutputs, path: string): unknown {
  let cur: unknown = root;
  for (const part of path.split('.')) {
    if (cur === null || cur === undefined) return null;
    if (typeof cur !== 'object' || Array.isArray(cur)) return null;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur ?? null;
}
```

Create `packages/artifacts/graph-ir-compiler/src/operation/local-read.ts`:

```ts
import type BetterSqlite3 from 'better-sqlite3';
import { createQsmResolver, type ValidatedQsm } from '@rntme/qsm';
import type { CanonicalFindOne } from '../types/canonical.js';
import { evalOperationExpr, type NodeOutputs } from './eval.js';

export function executeFindOne(
  node: CanonicalFindOne,
  params: Record<string, unknown>,
  outputs: NodeOutputs,
  db: BetterSqlite3.Database,
  qsm: ValidatedQsm,
): Record<string, unknown> | null {
  if (!('projection' in node.source)) {
    throw new Error('findOne MVP supports projection sources only');
  }
  const where = node.where;
  if (typeof where !== 'object' || where === null || !('eq' in where)) {
    throw new Error('findOne MVP supports eq predicate only');
  }
  const [field, rhs] = where.eq as [string, unknown];
  if (typeof field !== 'string') throw new Error('findOne lhs must be a field path');
  const column = field.split('.').at(-1)!;
  const value = evalOperationExpr(rhs as never, params, outputs);
  const projection = createQsmResolver(qsm).resolveProjection(node.source.projection);
  if (projection === null) throw new Error(`projection "${node.source.projection}" not found`);
  const table = projection.table;
  const rows = db.prepare(`SELECT * FROM "${table}" WHERE "${column}" = ?`).all(value) as Record<string, unknown>[];
  if (rows.length > 1) throw new Error(`findOne "${node.id}" matched ${rows.length} rows`);
  return rows[0] ?? null;
}
```

- [ ] **Step 5: Implement executeOperation**

Create `packages/artifacts/graph-ir-compiler/src/operation/execute.ts`:

```ts
import { executeFindOne } from './local-read.js';
import { evalObjectExpr, evalOperationExpr, type NodeOutputs } from './eval.js';
import { buildEmitPlans } from '../emit/plan.js';
import { derivePayload, evalExprAtRuntime } from '../emit/payload.js';
import { replayAggregateState } from '../command-runtime/replay.js';
import { checkTransitionLegal } from '../command-runtime/transition.js';
import type { CompiledOperation, OperationExecutionContext, OperationResult } from '../types/operation.js';
import type { AppendEventInput } from '@rntme/event-store';

export async function executeOperation(
  compiled: CompiledOperation,
  params: Record<string, unknown>,
  ctx: OperationExecutionContext,
): Promise<OperationResult> {
  const outputs: NodeOutputs = {};
  const eventIds: string[] = [];
  const reached = new Set<string>();
  let active: string | null = null;

  const emitPlans = new Map(buildEmitPlans(compiled.graph, compiled.pdm).map((plan) => [plan.nodeId, plan]));

  for (const node of compiled.graph.nodes) {
    if (node.kind === 'findOne') {
      outputs[node.id] = executeFindOne(node, params, outputs, ctx.qsmDb, compiled.qsm);
      continue;
    }
    if (node.kind === 'branch') {
      const selected = node.cases.find((c) => 'when' in c ? Boolean(evalOperationExpr(c.when, params, outputs)) : true);
      active = selected?.then ?? null;
      outputs[node.id] = { selected: active };
      continue;
    }
    if (node.kind === 'call') {
      if (ctx.callClient === null) throw new Error(`call node "${node.id}" requires callClient`);
      throw new Error('call execution is implemented in Task 5');
    }
    if (node.kind === 'emit') {
      if (active !== null && active !== node.id) {
        outputs[node.id] = { didRun: false, aggregateId: null, eventIds: [], payload: null };
        continue;
      }
      if (ctx.eventStore === null) throw new Error(`emit node "${node.id}" requires eventStore`);
      const plan = emitPlans.get(node.id);
      if (plan === undefined) throw new Error(`emit plan missing for "${node.id}"`);
      const aggregateId = String(evalExprAtRuntime(plan.aggregateIdExpr, params, outputs) ?? '');
      const subject = `${plan.aggregate}-${aggregateId}`;
      const history = ctx.eventStore.readStream(subject);
      const { state, version } = replayAggregateState(history);
      checkTransitionLegal(plan, state, stateFieldForPlan(plan));
      const payload = derivePayload(plan, params, state, outputs);
      const event: AppendEventInput = {
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
      };
      const result = ctx.eventStore.appendEvents([{ subject, expectedVersion: version, events: [event] }])[0]!;
      const ids = result.appendedEvents.map((e) => e.id);
      eventIds.push(...ids);
      outputs[node.id] = { didRun: true, aggregateId, version: result.lastVersion, eventIds: ids, payload };
      reached.add(node.id);
      active = null;
      continue;
    }
    if (node.kind === 'result') {
      outputs[node.id] = evalObjectExpr(node.value, params, outputs);
    }
  }

  return {
    value: outputs[compiled.resultNodeId] ?? null,
    metadata: {
      eventIds,
      commandId: ctx.correlation.commandId,
      correlationId: ctx.correlation.correlationId,
    },
  };
}

function stateFieldForPlan(plan: { affects: readonly string[]; payloadExprs: Record<string, unknown> }): string {
  return plan.affects.find((field) => !(field in plan.payloadExprs)) ?? 'status';
}
```

- [ ] **Step 6: Export operation APIs**

Modify `packages/artifacts/graph-ir-compiler/src/index.ts`:

```ts
export { compileOperation, type CompileOperationOptions } from './operation/compile.js';
export { executeOperation } from './operation/execute.js';
```

- [ ] **Step 7: Verify and tighten**

Run:

```bash
pnpm -F @rntme/graph-ir-compiler test -- test/integration/operation-local.test.ts
pnpm -F @rntme/graph-ir-compiler typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/artifacts/graph-ir-compiler/src/operation \
  packages/artifacts/graph-ir-compiler/src/index.ts \
  packages/artifacts/graph-ir-compiler/test/integration/operation-local.test.ts
git commit -m "feat(graph-ir): compile and execute local operations"
```

### Task 5: Execute Call Nodes Through The Operation Registry

**Files:**
- Modify: `packages/artifacts/graph-ir-compiler/src/operation/execute.ts`
- Modify: `packages/artifacts/graph-ir-compiler/src/operation/eval.ts`
- Test: `packages/artifacts/graph-ir-compiler/test/integration/operation-call.test.ts`

- [ ] **Step 1: Write failing call-node integration test**

Create `packages/artifacts/graph-ir-compiler/test/integration/operation-call.test.ts`:

```ts
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import {
  compileOperation,
  executeOperation,
  type OperationCallClient,
  type OperationRegistry,
} from '../../src/index.js';

const registry: OperationRegistry = {
  resolve(target) {
    if ('service' in target && target.service === 'customers') {
      return {
        id: 'service:customers.getCreditStatus',
        target,
        effect: 'read',
        idempotency: 'none',
        inputShape: 'CreditInput',
        outputShape: 'CreditStatus',
      };
    }
    return null;
  },
};

describe('operation call nodes', () => {
  it('uses call output in branch and result', async () => {
    const graph = {
      version: '1.0-rc7',
      pdmRef: 'x',
      qsmRef: 'y',
      shapes: {
        Decision: { fields: { approved: { type: 'boolean', nullable: false } } },
      },
      graphs: {
        decide: {
          id: 'decide',
          signature: {
            inputs: { customerId: { type: 'string', mode: 'required' } },
            output: { type: 'row<Decision>', from: 'out' },
          },
          nodes: [
            {
              id: 'credit',
              type: 'call',
              target: { service: 'customers', operation: 'getCreditStatus' },
              input: { customerId: { $param: 'customerId' } },
              policy: { timeoutMs: 500, onError: 'fail' },
            },
            {
              id: 'out',
              type: 'result',
              value: { approved: { $ref: 'credit.result.approved' } },
            },
          ],
        },
      },
    };

    const compiled = compileOperation(graph, { version: '1.0', entities: {} }, { version: '1.0', pdmRef: 'x', projections: {} }, {
      registry,
      serviceName: 'orders',
      ownedAggregates: new Set(),
      exposure: 'read',
    });
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;

    const calls: unknown[] = [];
    const callClient: OperationCallClient = {
      async call(input) {
        calls.push(input);
        return { ok: true, value: { approved: true } };
      },
    };

    const out = await executeOperation(compiled.value, { customerId: 'cust-1' }, {
      qsmDb: new Database(':memory:'),
      eventStore: null,
      callClient,
      now: () => '2026-05-06T00:00:00.000Z',
      nextId: () => 'id',
      actor: null,
      correlation: { commandId: 'cmd', correlationId: 'corr', traceparent: null },
      idempotencyKey: null,
    });

    expect(calls).toHaveLength(1);
    expect(out.value).toEqual({ approved: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm -F @rntme/graph-ir-compiler test -- test/integration/operation-call.test.ts
```

Expected: FAIL with `call execution is implemented in Task 5`.

- [ ] **Step 3: Implement call execution**

Modify the `node.kind === 'call'` branch in `packages/artifacts/graph-ir-compiler/src/operation/execute.ts`:

```ts
if (node.kind === 'call') {
  if (ctx.callClient === null) throw new Error(`call node "${node.id}" requires callClient`);
  const target = compiled.effects.calls.find((call) => {
    const op = 'module' in node.target ? `${node.target.module}.${node.target.operation}` : `${node.target.service}.${node.target.operation}`;
    return call.operation === op;
  });
  if (target === undefined) throw new Error(`call node "${node.id}" effect metadata missing`);
  const registryEntry = {
    id: target.operation,
    target: node.target,
    effect: target.effect,
    idempotency: target.idempotency,
    inputShape: '',
    outputShape: '',
  };
  const payload = evalObjectExpr(node.input, params, outputs) as Record<string, unknown>;
  const callResult = await ctx.callClient.call({
    target: registryEntry,
    payload,
    idempotencyKey: target.effect === 'action' ? ctx.idempotencyKey : null,
    correlationId: ctx.correlation.correlationId,
  });
  if (!callResult.ok) {
    throw new Error(`${callResult.error.code}: ${callResult.error.message}`);
  }
  outputs[node.id] = { result: callResult.value };
  continue;
}
```

Then improve `CompiledOperation` in `types/operation.ts` and `compileOperation` to store `registryEntriesByNodeId: Record<string, OperationRegistryEntry>` so execute does not reconstruct registry entries from the summary. Update the call branch to use:

```ts
const registryEntry = compiled.registryEntriesByNodeId[node.id];
if (registryEntry === undefined) throw new Error(`call node "${node.id}" target metadata missing`);
```

- [ ] **Step 4: Verify**

Run:

```bash
pnpm -F @rntme/graph-ir-compiler test -- test/integration/operation-call.test.ts test/integration/operation-local.test.ts
pnpm -F @rntme/graph-ir-compiler typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/artifacts/graph-ir-compiler/src/operation/execute.ts \
  packages/artifacts/graph-ir-compiler/src/types/operation.ts \
  packages/artifacts/graph-ir-compiler/src/operation/compile.ts \
  packages/artifacts/graph-ir-compiler/test/integration/operation-call.test.ts
git commit -m "feat(graph-ir): execute operation call nodes"
```

### Task 6: Clean-Break Bindings Exposure

**Files:**
- Modify: `packages/artifacts/bindings/src/types/artifact.ts`
- Modify: `packages/artifacts/bindings/src/types/resolvers.ts`
- Modify: `packages/artifacts/bindings/src/parse/schema.ts`
- Modify: `packages/artifacts/bindings/src/validate/structural.ts`
- Modify: `packages/artifacts/bindings/src/validate/references.ts`
- Modify: `packages/artifacts/bindings/src/validate/consistency.ts`
- Modify: `packages/artifacts/bindings/src/types/result.ts`
- Test: `packages/artifacts/bindings/test/unit/parse/schema.test.ts`
- Test: `packages/artifacts/bindings/test/unit/validate/consistency.test.ts`

- [ ] **Step 1: Write failing parse tests for clean-break shape**

Modify `packages/artifacts/bindings/test/unit/parse/schema.test.ts`:

```ts
it('requires exposure and rejects legacy kind/pre', () => {
  const r = BindingArtifactSchema.safeParse({
    version: '1.0',
    graphSpecRef: '../graphs',
    pdmRef: '../../pdm',
    qsmRef: '../qsm',
    bindings: {
      list: {
        exposure: 'read',
        graph: 'listThings',
        target: { engine: 'sqlite', dialect: 'sqlite' },
        http: { method: 'GET', path: '/things', parameters: [] },
      },
    },
  });
  expect(r.success).toBe(true);

  const legacy = BindingArtifactSchema.safeParse({
    version: '1.0',
    graphSpecRef: '../graphs',
    pdmRef: '../../pdm',
    qsmRef: '../qsm',
    bindings: {
      bad: {
        kind: 'command',
        graph: 'x',
        target: { engine: 'sqlite', dialect: 'sqlite' },
        http: { method: 'POST', path: '/x', parameters: [] },
        pre: [],
      },
    },
  });
  expect(legacy.success).toBe(false);
});
```

- [ ] **Step 2: Run parse test to verify it fails**

Run:

```bash
pnpm -F @rntme/bindings test -- test/unit/parse/schema.test.ts
```

Expected: FAIL because `kind` still defaults and `exposure` is unknown.

- [ ] **Step 3: Replace BindingKind with exposure**

In `packages/artifacts/bindings/src/types/artifact.ts`:

```ts
export type BindingExposure = 'read' | 'action';
```

Replace in `BindingEntry`:

```ts
exposure: BindingExposure;
```

Remove `kind?: BindingKind` and `pre?: PreStep[]` from `BindingEntry`.
Delete `PreStepBindAs`, `PreStep`, `bindAsName`, and `bindAsPick` from `artifact.ts`; the remaining binding authoring surface no longer has binding-level pre-fetch data.

In `packages/artifacts/bindings/src/parse/schema.ts`, replace:

```ts
kind: z.enum(['query', 'command']).default('query'),
pre: z.array(PreStepSchema).optional(),
```

with:

```ts
exposure: z.enum(['read', 'action']),
```

Delete `RetryPolicySchema`, `PreStepBindAsSchema`, `PreStepSystemSchema`, `PreStepModuleRpcSchema`, and `PreStepSchema` from `parse/schema.ts`.

- [ ] **Step 4: Update resolver signature**

In `packages/artifacts/bindings/src/types/resolvers.ts`, import effect summary:

```ts
import type { EffectSummary } from '@rntme/graph-ir-compiler';
```

Replace:

```ts
export type GraphRole = 'query' | 'command';
...
role?: GraphRole;
```

with:

```ts
effects: EffectSummary;
```

- [ ] **Step 5: Write failing exposure consistency tests**

Modify `packages/artifacts/bindings/test/unit/validate/consistency.test.ts` to assert:

```ts
it('rejects exposure=read on a graph with local emits', () => {
  const r = validateConsistency(makeResolved({
    entry: { exposure: 'read', graph: 'reserveStock', target: { engine: 'sqlite', dialect: 'sqlite' }, http: { method: 'GET', path: '/x', parameters: [] } },
    signature: {
      id: 'reserveStock',
      inputs: {},
      output: { type: { kind: 'row', shape: 'ReservationResult' }, from: 'out' },
      effects: {
        localReads: true,
        localEmits: [{ aggregate: 'StockReservation', transition: 'reserve', eventType: 'StockReserved' }],
        calls: [],
        waits: false,
      },
    },
    outputShape: { name: 'ReservationResult', origin: 'custom', fields: {} },
  }));

  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.errors.some((e) => e.code === 'BINDINGS_EXPOSURE_EFFECT_FORBIDDEN')).toBe(true);
});
```

`packages/artifacts/bindings/test/unit/validate/consistency.test.ts` already defines `makeResolved(...)`; update that helper's default entry to include `exposure: 'read'` and use it for this assertion.

- [ ] **Step 6: Update consistency validation**

In `packages/artifacts/bindings/src/types/result.ts`, append:

```ts
BINDINGS_EXPOSURE_EFFECT_FORBIDDEN: 'BINDINGS_EXPOSURE_EFFECT_FORBIDDEN',
```

In `packages/artifacts/bindings/src/validate/consistency.ts`, replace `checkGraphShape` role/kind checks with exposure/effect checks:

```ts
function checkGraphShape(
  id: string,
  exposure: 'read' | 'action',
  signature: GraphSignature,
  errors: BindingsError[],
): boolean {
  const basePath = `bindings.${id}.graph`;
  let fatal = false;

  for (const [inputName, input] of Object.entries(signature.inputs)) {
    if (input.mode === 'root') {
      errors.push({
        layer: 'consistency',
        code: ERROR_CODES.BINDINGS_GRAPH_HAS_ROOT_INPUT,
        message: `Graph "${signature.id}" has root input "${inputName}" and cannot be bound as HTTP endpoint`,
        path: basePath,
      });
      fatal = true;
    }
  }

  if (
    exposure === 'read' &&
    (signature.effects.localEmits.length > 0 || signature.effects.calls.some((call) => call.effect === 'action'))
  ) {
    errors.push({
      layer: 'consistency',
      code: ERROR_CODES.BINDINGS_EXPOSURE_EFFECT_FORBIDDEN,
      message: `Binding "${id}" has exposure="read" but graph "${signature.id}" has action effects`,
      path: basePath,
    });
    fatal = true;
  }

  if (signature.output.type.kind !== 'row' && signature.output.type.kind !== 'rowset') {
    errors.push({
      layer: 'consistency',
      code: ERROR_CODES.BINDINGS_UNSUPPORTED_OUTPUT_TYPE,
      message: `Graph "${signature.id}" output kind "${signature.output.type.kind}" is not bindable`,
      path: basePath,
    });
    fatal = true;
  }

  return !fatal;
}
```

Then in `validateConsistency`, use:

```ts
const exposure = binding.entry.exposure;
const shapeOk = checkGraphShape(id, exposure, binding.signature, errors);
```

Remove all pre-step consistency checks.

- [ ] **Step 7: Verify bindings**

Run:

```bash
pnpm -F @rntme/bindings test -- test/unit/parse/schema.test.ts test/unit/validate/consistency.test.ts
pnpm -F @rntme/bindings typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/artifacts/bindings/src \
  packages/artifacts/bindings/test/unit/parse/schema.test.ts \
  packages/artifacts/bindings/test/unit/validate/consistency.test.ts
git commit -m "feat(bindings): replace kind with exposure"
```

### Task 7: Compile Binding Operation Plans

**Files:**
- Modify: `packages/runtime/bindings-http/src/startup/compile-plan.ts`
- Create: `packages/runtime/bindings-http/src/operation-contract.ts`
- Modify: `packages/runtime/bindings-http/src/executor-contract.ts`
- Test: `packages/runtime/bindings-http/test/unit/compile-plan-operation.test.ts`

- [ ] **Step 1: Write failing operation compile-plan test**

Create `packages/runtime/bindings-http/test/unit/compile-plan-operation.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildPlan } from '../../src/startup/compile-plan.js';

describe('operation compile plan', () => {
  it('compiles read/action exposures into operation plans', () => {
    const result = buildPlan(
      {
        artifact: {} as never,
        resolved: {
          reserveStock: {
            entry: {
              exposure: 'action',
              graph: 'reserveStock',
              target: { engine: 'sqlite', dialect: 'sqlite' },
              http: { method: 'POST', path: '/reservations', parameters: [] },
            },
            signature: {
              id: 'reserveStock',
              inputs: {},
              output: { type: { kind: 'row', shape: 'ReservationResult' }, from: 'out' },
              effects: {
                localReads: true,
                localEmits: [{ aggregate: 'StockReservation', transition: 'reserve', eventType: 'StockReserved' }],
                calls: [],
                waits: false,
              },
            },
            outputShape: { name: 'ReservationResult', origin: 'custom', fields: {} },
          },
        },
      } as never,
      {
        version: '1.0-rc7',
        pdmRef: 'pdm',
        qsmRef: 'qsm',
        shapes: { ReservationResult: { fields: {} } },
        graphs: {
          reserveStock: {
            id: 'reserveStock',
            signature: { inputs: {}, output: { type: 'row<ReservationResult>', from: 'out' } },
            nodes: [{ id: 'out', type: 'result', value: { ok: { $literal: true } } }],
          },
        },
      } as never,
      { entities: {} } as never,
      { projections: {} } as never,
    );

    expect(result.plans.reserveStock?.exposure).toBe('action');
    expect(result.compiledOperations.reserveStock).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm -F @rntme/bindings-http test -- test/unit/compile-plan-operation.test.ts
```

Expected: FAIL because `BindingPlan` still uses `kind` and `compiledOperations` does not exist.

- [ ] **Step 3: Add operation executor contract**

Create `packages/runtime/bindings-http/src/operation-contract.ts`:

```ts
import type { OperationExecutionContext, OperationResult } from '@rntme/graph-ir-compiler';

export type OperationExecutorError = Readonly<{
  code: string;
  message: string;
  detail?: unknown;
}>;

export type OperationExecutorOutput =
  | Readonly<{ ok: true; value: OperationResult }>
  | Readonly<{ ok: false; error: OperationExecutorError }>;

export type OperationExecutorInput = Readonly<{
  operationName: string;
  inputs: Record<string, unknown>;
  ctx: OperationExecutionContext;
}>;

export interface OperationExecutor {
  execute(input: OperationExecutorInput): Promise<OperationExecutorOutput>;
}
```

- [ ] **Step 4: Refactor compile-plan shape**

In `packages/runtime/bindings-http/src/startup/compile-plan.ts`:

Replace command/query compile imports with:

```ts
import { compileOperation, type CompiledOperation } from '@rntme/graph-ir-compiler';
```

Define:

```ts
export type OperationBindingPlan = BindingPlanCommon & {
  exposure: 'read' | 'action';
  operationName: string;
  inputFrom: InputFromMap | null;
  response: ResponseShape | null;
};

export type BindingPlan = OperationBindingPlan;

export type GraphIrOperationMap = Record<string, CompiledOperation>;

export type BuildPlanResult = {
  plans: Record<string, BindingPlan>;
  compiledOperations: GraphIrOperationMap;
};
```

Replace per-kind graph id sets with one operation set:

```ts
const graphIds = new Set(Object.values(validated.resolved).map((r) => r.entry.graph));
const operationCache = new Map<string, CompiledOperation>();
```

Compile with:

```ts
const r = compileOperation(sliceSpec(graphSpec, graphId), pdm, qsm, {
  registry: emptyOperationRegistry,
  serviceName: '',
  ownedAggregates: ownedAggregatesFromPdm(pdm),
  exposure: resolvedExposureForGraph(validated, graphId),
});
```

Add local helpers in this file:

```ts
const emptyOperationRegistry = { resolve: () => null };

function resolvedExposureForGraph(validated: ValidatedBindings, graphId: string): 'read' | 'action' {
  return Object.values(validated.resolved).some((r) => r.entry.graph === graphId && r.entry.exposure === 'action')
    ? 'action'
    : 'read';
}

function ownedAggregatesFromPdm(pdm: ValidatedPdm): Set<string> {
  const out = new Set<string>();
  const entities = Array.isArray((pdm as { entities?: unknown }).entities)
    ? (pdm as { entities: Array<{ name: string; ownerService?: string }> }).entities
    : Object.entries((pdm as { entities?: Record<string, unknown> }).entities ?? {}).map(([name]) => ({ name }));
  for (const entity of entities) out.add(entity.name);
  return out;
}
```

Later runtime tasks replace `emptyOperationRegistry` with a project/service registry. Keep the function local for this task to avoid broad runtime coupling.

- [ ] **Step 5: Verify**

Run:

```bash
pnpm -F @rntme/bindings-http test -- test/unit/compile-plan-operation.test.ts
pnpm -F @rntme/bindings-http typecheck
```

Expected: PASS or a small set of expected downstream compile errors in router/handlers. If downstream files still import `QueryBindingPlan` or `CommandBindingPlan`, leave type aliases temporarily:

```ts
export type QueryBindingPlan = OperationBindingPlan;
export type CommandBindingPlan = OperationBindingPlan;
```

Remove those aliases in Task 8.

- [ ] **Step 6: Commit**

```bash
git add packages/runtime/bindings-http/src/startup/compile-plan.ts \
  packages/runtime/bindings-http/src/operation-contract.ts \
  packages/runtime/bindings-http/test/unit/compile-plan-operation.test.ts
git commit -m "feat(bindings-http): compile operation plans"
```

### Task 8: Replace HTTP Query/Command Handlers With Operation Handler

**Files:**
- Create: `packages/runtime/bindings-http/src/runtime/operation-handler.ts`
- Modify: `packages/runtime/bindings-http/src/router.ts`
- Modify: `packages/runtime/bindings-http/src/runtime/error-to-http.ts`
- Test: `packages/runtime/bindings-http/test/integration/operation-routing.test.ts`

- [ ] **Step 1: Write failing operation routing test**

Create `packages/runtime/bindings-http/test/integration/operation-routing.test.ts`:

```ts
import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { createBindingsRouter } from '../../src/router.js';
import type { OperationExecutor } from '../../src/operation-contract.js';

describe('operation routing', () => {
  it('routes exposure=action through OperationExecutor and returns graph result', async () => {
    const executor: OperationExecutor = {
      async execute(input) {
        expect(input.operationName).toBe('reserveStock');
        return {
          ok: true,
          value: {
            value: { reserved: false, reason: 'insufficient stock' },
            metadata: { eventIds: ['evt-1'], commandId: input.ctx.correlation.commandId, correlationId: input.ctx.correlation.correlationId },
          },
        };
      },
    };

    const app = new Hono();
    app.route('/api', createBindingsRouter({
      validated: {
        resolved: {
          reserveStock: {
            entry: {
              exposure: 'action',
              graph: 'reserveStock',
              target: { engine: 'sqlite', dialect: 'sqlite' },
              http: { method: 'POST', path: '/reservations', parameters: [] },
            },
            signature: {
              id: 'reserveStock',
              inputs: {},
              output: { type: { kind: 'row', shape: 'ReservationResult' }, from: 'out' },
              effects: { localReads: false, localEmits: [], calls: [], waits: false },
            },
            outputShape: { name: 'ReservationResult', origin: 'custom', fields: {} },
          },
        },
      } as never,
      graphSpec: { version: '1.0-rc7', pdmRef: 'p', qsmRef: 'q', shapes: {}, graphs: {} } as never,
      pdm: {} as never,
      qsm: {} as never,
      db: new Database(':memory:'),
      eventStore: {} as never,
      operationExecutor: executor,
    }));

    const res = await app.request('/api/reservations', { method: 'POST' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ reserved: false, reason: 'insufficient stock' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm -F @rntme/bindings-http test -- test/integration/operation-routing.test.ts
```

Expected: FAIL because `operationExecutor` is not accepted.

- [ ] **Step 3: Add operation handler**

Create `packages/runtime/bindings-http/src/runtime/operation-handler.ts`:

```ts
import { randomUUID } from 'node:crypto';
import type { Context } from 'hono';
import type BetterSqlite3 from 'better-sqlite3';
import type { EventStore, ActorRef } from '@rntme/event-store';
import type { BindingPlan } from '../startup/compile-plan.js';
import type { OperationExecutor } from '../operation-contract.js';
import { extractQuery, extractPath } from './extract.js';
import { remapToGraphInputs } from './remap.js';
import { validationErrorBody, invalidBodyErrorBody } from '../errors.js';

export type OperationHandlerDeps = {
  operationExecutor: OperationExecutor;
  eventStore: EventStore | null;
  qsmDb: BetterSqlite3.Database;
  now: () => string;
  nextId: () => string;
  actorFromRequest: (c: Context) => ActorRef | null;
};

export function makeOperationHandler(plan: BindingPlan, deps: OperationHandlerDeps) {
  const declaredQueryParams = plan.entry.http.parameters.filter((p) => p.in === 'query');
  const hasBody = plan.bodyParamNames.length > 0;

  return async (c: Context): Promise<Response> => {
    const pathParsed = plan.schemas.pathSchema.safeParse(extractPath(c, plan.pathParamNames));
    if (!pathParsed.success) return c.json(validationErrorBody(pathParsed.error), 400);

    const queryParsed = plan.schemas.querySchema.safeParse(extractQuery(c, declaredQueryParams, plan.listParamNames));
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

    const combined = {
      ...(queryParsed.data as Record<string, unknown>),
      ...(pathParsed.data as Record<string, unknown>),
      ...bodyValues,
    };
    const inputs = remapToGraphInputs(combined, plan.bindToMap);
    const commandId = randomUUID();
    const correlationId = randomUUID();

    const out = await deps.operationExecutor.execute({
      operationName: plan.operationName,
      inputs,
      ctx: {
        qsmDb: deps.qsmDb,
        eventStore: deps.eventStore,
        callClient: null,
        now: deps.now,
        nextId: deps.nextId,
        actor: deps.actorFromRequest(c),
        correlation: { commandId, correlationId, traceparent: c.req.header('traceparent') ?? null },
        idempotencyKey: c.req.header('idempotency-key') ?? null,
      },
    });

    if (!out.ok) {
      return c.json({ code: out.error.code, message: out.error.message, detail: out.error.detail }, 500);
    }
    return c.json(out.value.value as object, 200);
  };
}
```

- [ ] **Step 4: Refactor router**

In `packages/runtime/bindings-http/src/router.ts`:

- Replace `commandExecutor?: CommandExecutor` with `operationExecutor?: OperationExecutor`.
- Remove `makeHandler` and `makeCommandHandler` imports.
- Import `makeOperationHandler`.
- Determine runtime dependencies from compiled effect summaries:

```ts
const firstAction = planEntries.find((p) => p.exposure === 'action');
if (firstAction !== undefined && !opts.eventStore) ...
if (opts.operationExecutor === undefined) ...
```

- Mount every binding through `makeOperationHandler`.

Use:

```ts
if (bp.entry.http.method === 'GET') app.get(route, makeOperationHandler(bp, deps));
else app.post(route, makeOperationHandler(bp, deps));
```

- [ ] **Step 5: Verify**

Run:

```bash
pnpm -F @rntme/bindings-http test -- test/integration/operation-routing.test.ts
pnpm -F @rntme/bindings-http typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/runtime/bindings-http/src/runtime/operation-handler.ts \
  packages/runtime/bindings-http/src/router.ts \
  packages/runtime/bindings-http/test/integration/operation-routing.test.ts
git commit -m "feat(bindings-http): route unified operations"
```

### Task 9: Runtime Operation Executor And Handler Removal

**Files:**
- Create: `packages/runtime/runtime/src/plugins/executors/graph-operation-executor.ts`
- Modify: `packages/runtime/runtime/src/plugins/executors/index.ts`
- Modify: `packages/runtime/runtime/src/plugins/http-surface.ts`
- Modify: `packages/runtime/runtime/src/start/start-service.ts`
- Modify: `packages/runtime/runtime/src/manifest/schema.ts`
- Modify: `packages/runtime/runtime/src/manifest/types.ts`
- Modify: `packages/runtime/runtime/src/manifest/validate.ts`
- Delete: `packages/runtime/runtime/src/plugins/executors/code-command-executor.ts`
- Delete: `packages/runtime/runtime/src/plugins/executors/composite-command-executor.ts`
- Test: `packages/runtime/runtime/test/integration/startup.test.ts`
- Test: `packages/runtime/runtime/test/unit/manifest-parse.test.ts`

- [ ] **Step 1: Write failing manifest test that rejects commands block**

Add to `packages/runtime/runtime/test/unit/manifest-parse.test.ts`:

```ts
it('rejects commands.handlersModule in clean-break runtime manifests', () => {
  const parsed = parseManifest(JSON.stringify({
    rntmeVersion: '1.0',
    service: { name: 'api', version: '1.0.0' },
    commands: { handlersModule: 'commands/handlers.mjs' },
  }));

  expect(parsed.ok).toBe(false);
  if (!parsed.ok) {
    expect(parsed.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'MANIFEST_UNKNOWN_KEY',
          path: '<root>.commands',
        }),
      ]),
    );
  }
});
```

- [ ] **Step 2: Write failing runtime startup test for operation executor**

Add to `packages/runtime/runtime/test/integration/startup.test.ts`:

```ts
it('starts with the graph operation executor and no service-local handlers', async () => {
  const service = loadService(fixtureDir);
  expect(service.ok).toBe(true);
  if (!service.ok) return;

  const running = await startService(service.value, { onReady: () => undefined });
  await running.stop();
  expect(running.httpPort).toBeGreaterThan(0);
});
```

- [ ] **Step 3: Implement GraphOperationExecutor**

Create `packages/runtime/runtime/src/plugins/executors/graph-operation-executor.ts`:

```ts
import {
  executeOperation,
  type CompiledOperation,
  type OperationExecutionContext,
  type OperationResult,
} from '@rntme/graph-ir-compiler';
import type {
  OperationExecutor,
  OperationExecutorInput,
  OperationExecutorOutput,
} from '@rntme/bindings-http/operation-contract';

export type GraphOperationMap = Record<string, CompiledOperation>;

export class GraphOperationExecutor implements OperationExecutor {
  constructor(private readonly operations: GraphOperationMap) {}

  async execute(input: OperationExecutorInput): Promise<OperationExecutorOutput> {
    const compiled = this.operations[input.operationName];
    if (compiled === undefined) {
      return { ok: false, error: { code: 'OPERATION_NOT_FOUND', message: `operation "${input.operationName}" not found` } };
    }
    try {
      const value: OperationResult = await executeOperation(compiled, input.inputs, input.ctx as OperationExecutionContext);
      return { ok: true, value };
    } catch (err) {
      return {
        ok: false,
        error: {
          code: 'OPERATION_EXECUTION_FAILED',
          message: err instanceof Error ? err.message : String(err),
          detail: err instanceof Error ? { name: err.name } : undefined,
        },
      };
    }
  }
}
```

- [ ] **Step 4: Refactor start-service**

In `packages/runtime/runtime/src/start/start-service.ts`:

- Remove imports of `CodeCommandExecutor`, `CompositeCommandExecutor`, `GraphIrCommandExecutor`, `GraphIrQueryExecutor`, `buildDefaultGraphIrCommandMap`, and `buildDefaultGraphIrQueryMap`.
- Import `buildDefaultGraphIrOperationMap` from `@rntme/bindings-http` after Task 7 exposes it.
- Import `GraphOperationExecutor`.
- Build one executor:

```ts
const defaultOperationMapResult = buildDefaultGraphIrOperationMap(
  service.bindings,
  service.graphSpec,
  service.pdm,
  service.qsm,
);
if (!defaultOperationMapResult.ok) {
  await pipeline.stop();
  if (bus.stop) await bus.stop();
  throw new Error(`Failed to compile operation bindings: ${JSON.stringify(defaultOperationMapResult.errors)}`);
}
const operationExecutor =
  runtimeConfig.operationExecutor ?? new GraphOperationExecutor(defaultOperationMapResult.value);
```

- Pass `operationExecutor` to `HttpSurface`.
- Delete `buildConfiguredCommandExecutor`, `importCommandHandlers`, and `isCodeCommandHandlerMap`.

- [ ] **Step 5: Remove manifest commands block**

In `packages/runtime/runtime/src/manifest/types.ts`, remove:

```ts
export type ManifestCommandsConfig = { handlersModule?: string };
commands?: ManifestCommandsConfig;
commands?: { handlersModule: string };
```

In `schema.ts`, delete the `commands` object.

In `validate.ts`, delete `validateCommandsConfig` and any assignment to `commands`.

- [ ] **Step 6: Verify runtime**

Run:

```bash
pnpm -F @rntme/runtime test -- test/unit/manifest-parse.test.ts test/integration/startup.test.ts
pnpm -F @rntme/runtime typecheck
```

Expected: PASS.

- [ ] **Step 7: Delete unused executor files**

Delete files only after typecheck proves no imports remain:

```bash
rm packages/runtime/runtime/src/plugins/executors/code-command-executor.ts
rm packages/runtime/runtime/src/plugins/executors/composite-command-executor.ts
```

Remove their exports from `packages/runtime/runtime/src/plugins/executors/index.ts`.

- [ ] **Step 8: Commit**

```bash
git add packages/runtime/runtime/src \
  packages/runtime/runtime/test/integration/startup.test.ts \
  packages/runtime/runtime/test/unit/manifest-parse.test.ts
git commit -m "feat(runtime): use unified graph operation executor"
```

### Task 10: gRPC Surface Operation Results

**Files:**
- Modify: `packages/runtime/bindings-grpc/src/server/handler.ts`
- Modify: `packages/runtime/bindings-grpc/src/emit/emit-proto.ts`
- Modify: `packages/runtime/runtime/src/start/build-grpc-surface.ts`
- Test: `packages/runtime/bindings-grpc/test/integration/create-server.test.ts`
- Test: `packages/runtime/bindings-grpc/test/unit/emit-proto.test.ts`

- [ ] **Step 1: Write failing gRPC operation result tests**

In `packages/runtime/bindings-grpc/test/integration/create-server.test.ts`, replace the `CommandExecutor`/`QueryExecutor` imports with `OperationExecutor` from `@rntme/bindings-http/operation-contract` and replace the first test with:

```ts
it('routes an action exposure to OperationExecutor and returns operation result', async () => {
  const eventStore = new SqliteEventStore({ filename: ':memory:', serviceName: 'minimal' });
  const qsmDb = new BetterSqlite3(':memory:');
  const receivedInputs: Record<string, unknown>[] = [];

  const operationExecutor: OperationExecutor = {
    async execute(req) {
      if (req.operationName !== 'createOrder') {
        return { ok: false, error: { code: 'OPERATION_NOT_FOUND', message: req.operationName } };
      }
      receivedInputs.push(req.inputs as Record<string, unknown>);
      return {
        ok: true,
        value: {
          value: { reserved: true, reservationId: 'r1' },
          metadata: { eventIds: ['e1'], commandId: 'cmd', correlationId: 'corr' },
        },
      };
    },
  };

  handle = createGrpcServer({
    validated: minimalValidated,
    shapes: minimalShapeRegistry,
    packageName: 'rntme.minimal.v1',
    serviceName: 'MinimalService',
    operationExecutor,
    eventStore,
    qsmDb,
  });

  const port = await handle.listen(0, '127.0.0.1');
  const { root, service } = loadProto(handle.protoSource, 'rntme.minimal.v1.MinimalService');
  const ClientCtor = grpc.makeGenericClientConstructor(toServiceDef(root, service), 'MinimalService', {});
  const client = new ClientCtor(`127.0.0.1:${port}`, grpc.credentials.createInsecure());

  const response = await new Promise<Record<string, unknown>>((resolve, reject) => {
    const typedClient = client as unknown as {
      CreateOrder?: (arg: object, cb: (err: unknown, res: object) => void) => void;
    };
    if (!typedClient.CreateOrder) throw new Error('CreateOrder method missing');
    typedClient.CreateOrder({ amount: 42, note: 'hello' }, (err, res) => {
      if (err !== null && err !== undefined) reject(err);
      else resolve(res as Record<string, unknown>);
    });
  });

  expect(response.aggregate_id).toBeUndefined();
  expect(response.version).toBeUndefined();
  expect(response.event_ids).toBeUndefined();
  expect(structToJson(response.result)).toEqual({ reserved: true, reservationId: 'r1' });
  expect(receivedInputs[0]).toMatchObject({ amount: 42, note: 'hello' });
});
```

- [ ] **Step 2: Decide proto output encoding and update emitter**

For this implementation, use a single `google.protobuf.Struct result = 1;` response for operation outputs. This avoids regenerating bespoke messages for every result shape in the first clean-break pass.

In `packages/runtime/bindings-grpc/src/emit/emit-proto.ts`, for every binding operation emit:

```proto
message <RpcName>Response {
  google.protobuf.Struct result = 1;
}
```

Keep typed shape emission for OpenAPI/HTTP. Do not add bespoke per-result protobuf messages in this plan; the first clean-break gRPC surface is intentionally `Struct`-based.

- [ ] **Step 3: Refactor server handler**

In `packages/runtime/bindings-grpc/src/server/handler.ts`:

- Replace `CommandExecutor` and `QueryExecutor` deps with `OperationExecutor`.
- Use `resolved.entry.exposure` only for idempotency/correlation policy, not dispatch.
- Call:

```ts
const out = await deps.operationExecutor.execute({
  operationName: resolved.entry.graph,
  inputs: input,
  ctx: {
    qsmDb: deps.qsmDb,
    eventStore: deps.eventStore,
    callClient: null,
    now: deps.now,
    nextId: deps.nextId,
    actor: null,
    correlation,
    idempotencyKey: typeof metadata['rntme-idempotency-key'] === 'string' ? metadata['rntme-idempotency-key'] : null,
  },
});
```

Return:

```ts
callback(null, { result: jsonToStruct(out.value.value) });
```

- [ ] **Step 4: Refactor runtime gRPC surface builder**

In `packages/runtime/runtime/src/start/build-grpc-surface.ts`, accept:

```ts
operationExecutor: OperationExecutor;
```

and pass it into `GrpcSurface`.

- [ ] **Step 5: Verify**

Run:

```bash
pnpm -F @rntme/bindings-grpc test -- test/unit/emit-proto.test.ts test/integration/create-server.test.ts
pnpm -F @rntme/bindings-grpc typecheck
pnpm -F @rntme/runtime typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/runtime/bindings-grpc/src \
  packages/runtime/bindings-grpc/test/unit/emit-proto.test.ts \
  packages/runtime/bindings-grpc/test/integration/create-server.test.ts \
  packages/runtime/runtime/src/start/build-grpc-surface.ts
git commit -m "feat(bindings-grpc): serve unified operation results"
```

### Task 11: Blueprint, CLI, And Deploy Handler Ban

**Files:**
- Modify: `packages/artifacts/blueprint/src/types/result.ts`
- Modify: `packages/artifacts/blueprint/src/types/artifact.ts`
- Modify: `packages/artifacts/blueprint/src/compose/discover-service-artifacts.ts`
- Modify: `packages/artifacts/blueprint/src/validate/composition.ts`
- Modify: `packages/artifacts/blueprint/test/smoke-order-fulfillment-demo.test.ts`
- Create: `packages/artifacts/blueprint/test/unit/service-command-handlers.test.ts`
- Modify: `apps/cli/src/bundle/collect-assets.ts`
- Modify: `apps/cli/test/unit/bundle/build.test.ts`
- Modify: `apps/platform-http/src/deploy/executor.ts`
- Modify: `apps/platform-http/test/unit/deploy/executor.test.ts`

- [ ] **Step 1: Add blueprint failure test for service-local handlers**

Create `packages/artifacts/blueprint/test/unit/service-command-handlers.test.ts`:

```ts
import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadComposedBlueprint } from '../../src/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const notesDemoDir = join(here, '..', '..', '..', '..', '..', 'demo', 'notes-blueprint');

describe('domain service command handler files', () => {
  it('rejects executable command handlers in domain service blueprints', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rntme-blueprint-handlers-'));
    cpSync(notesDemoDir, dir, { recursive: true });
    mkdirSync(join(dir, 'services', 'app', 'commands'), { recursive: true });
    writeFileSync(join(dir, 'services', 'app', 'commands', 'handlers.mjs'), 'export default {};\n');

    const result = loadComposedBlueprint(dir);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'BLUEPRINT_DOMAIN_COMMAND_HANDLER_FORBIDDEN')).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Add error code**

Append to `packages/artifacts/blueprint/src/types/result.ts`:

```ts
BLUEPRINT_DOMAIN_COMMAND_HANDLER_FORBIDDEN: 'BLUEPRINT_DOMAIN_COMMAND_HANDLER_FORBIDDEN',
```

- [ ] **Step 3: Implement discovery/composition check**

In `packages/artifacts/blueprint/src/types/artifact.ts`, extend `ServiceArtifactPresence`:

```ts
export type ServiceArtifactPresence = {
  hasGraphs: boolean;
  hasBindings: boolean;
  hasUi: boolean;
  hasSeed: boolean;
  hasQsm: boolean;
  hasCommandHandlers: boolean;
};
```

In `packages/artifacts/blueprint/src/compose/discover-service-artifacts.ts`, add:

```ts
hasCommandHandlers: isFile(join(serviceDir, 'commands', 'handlers.mjs')),
```

In `packages/artifacts/blueprint/src/validate/composition.ts`, before route validation or immediately after `routeTargets`, add:

```ts
for (const [slug, service] of Object.entries(input.services)) {
  if (service.kind === 'domain' && service.artifacts.hasCommandHandlers) {
    errors.push({
      layer: 'composition',
      code: ERROR_CODES.BLUEPRINT_DOMAIN_COMMAND_HANDLER_FORBIDDEN,
      message: `domain service "${slug}" must not include executable command handler files`,
      path: `services/${slug}/commands/handlers.mjs`,
    });
  }
}
```

- [ ] **Step 4: Remove CLI handler asset collection**

In `apps/cli/src/bundle/collect-assets.ts`:

- Delete `collectCommandHandlerAssetsInto(...)`.
- Delete `isServiceCommandModulePath(...)`.
- Remove the call:

```ts
const commandHandlers = collectCommandHandlerAssetsInto(root, projectFiles, out, budget);
if (!commandHandlers.ok) return commandHandlers;
```

Update `apps/cli/test/unit/bundle/build.test.ts`: replace the old "emits service-local command handler modules as assets" test with:

```ts
it('does not bundle service-local command handler modules', () => {
  const bundle = buildProjectBundle(projectDirWithServiceHandler);
  expect(bundle.ok).toBe(false);
  if (!bundle.ok) {
    expect(bundle.errors.some((e) => e.code === 'BLUEPRINT_DOMAIN_COMMAND_HANDLER_FORBIDDEN')).toBe(true);
  }
});
```

- [ ] **Step 5: Remove platform deploy copy**

In `apps/platform-http/src/deploy/executor.ts`:

- Delete `optionalCommandHandlersModule`.
- Remove `commands` manifest emission.
- Remove `addOptionalDirectoryFiles(... commands ...)`.

Update `apps/platform-http/test/unit/deploy/executor.test.ts` so generated runtime manifest never includes:

```json
"commands": { "handlersModule": "commands/handlers.mjs" }
```

and runtime files never include `commands/handlers.mjs`.

- [ ] **Step 6: Verify**

Run:

```bash
pnpm -F @rntme/blueprint test -- test/smoke-order-fulfillment-demo.test.ts
pnpm -F @rntme/cli test -- test/unit/bundle/build.test.ts
pnpm -F @rntme/platform-http test -- test/unit/deploy/executor.test.ts
pnpm -F @rntme/blueprint typecheck
pnpm -F @rntme/cli typecheck
pnpm -F @rntme/platform-http typecheck
```

Expected: unit tests PASS. The order-fulfillment smoke remains red until Task 12 removes the real demo handler file, which is the intended TDD handoff between these tasks.

- [ ] **Step 7: Commit**

```bash
git add packages/artifacts/blueprint/src \
  packages/artifacts/blueprint/test \
  apps/cli/src/bundle/collect-assets.ts \
  apps/cli/test/unit/bundle/build.test.ts \
  apps/platform-http/src/deploy/executor.ts \
  apps/platform-http/test/unit/deploy/executor.test.ts
git commit -m "feat(blueprint): forbid domain command handler files"
```

### Task 12: Migrate Demos And Fixtures

**Files:**
- Delete: `demo/order-fulfillment-blueprint/services/inventory/commands/handlers.mjs`
- Modify: `demo/order-fulfillment-blueprint/services/inventory/graphs/reserveStock.json`
- Modify: `demo/order-fulfillment-blueprint/services/inventory/graphs/shapes.json`
- Modify: `demo/order-fulfillment-blueprint/services/inventory/bindings/bindings.json`
- Modify: `demo/order-fulfillment-blueprint/services/orders/bindings/bindings.json`
- Modify: `demo/notes-blueprint/services/app/bindings/bindings.json`
- Modify: `packages/runtime/runtime/test/fixtures/issue-tracker/**/*.json`
- Modify: UI fixtures that reference binding `kind`
- Test: `packages/artifacts/blueprint/test/smoke-order-fulfillment-demo.test.ts`

- [ ] **Step 1: Rewrite order-fulfillment reserveStock graph**

Replace `demo/order-fulfillment-blueprint/services/inventory/graphs/reserveStock.json` with:

```json
{
  "id": "reserveStock",
  "signature": {
    "inputs": {
      "orderId": { "type": "string", "mode": "required" },
      "sku": { "type": "string", "mode": "required" },
      "quantity": { "type": "integer", "mode": "required" }
    },
    "output": { "type": "row<ReservationResult>", "from": "out" }
  },
  "nodes": [
    {
      "id": "item",
      "type": "findOne",
      "config": {
        "source": { "projection": "InventoryItemView" },
        "where": {
          "eq": ["inventoryItemView.sku", { "$param": "sku" }]
        }
      }
    },
    {
      "id": "newId",
      "type": "uuid",
      "config": {}
    },
    {
      "id": "decision",
      "type": "branch",
      "cases": [
        {
          "when": {
            "gte": [
              { "$ref": "item.available" },
              { "$param": "quantity" }
            ]
          },
          "then": "emitReserved"
        },
        { "default": true, "then": "emitRejected" }
      ]
    },
    {
      "id": "emitReserved",
      "type": "emit",
      "config": {
        "aggregate": "StockReservation",
        "aggregateId": { "$node": "newId" },
        "transition": "reserve",
        "payload": {
          "orderId": { "$param": "orderId" },
          "sku": { "$param": "sku" },
          "quantity": { "$param": "quantity" }
        }
      }
    },
    {
      "id": "emitRejected",
      "type": "emit",
      "config": {
        "aggregate": "StockReservation",
        "aggregateId": { "$node": "newId" },
        "transition": "rejected",
        "payload": {
          "orderId": { "$param": "orderId" },
          "sku": { "$param": "sku" },
          "quantity": { "$param": "quantity" },
          "reason": { "$literal": "insufficient stock" }
        }
      }
    },
    {
      "id": "out",
      "type": "result",
      "value": {
        "reserved": { "$ref": "emitReserved.didRun" },
        "reservationId": { "$ref": "emitReserved.aggregateId" },
        "reason": { "$ref": "emitRejected.payload.after.reason" }
      }
    }
  ]
}
```

Add `ReservationResult` to `graphs/shapes.json`:

```json
"ReservationResult": {
  "fields": {
    "reserved": { "type": "boolean", "nullable": false },
    "reservationId": { "type": "string", "nullable": true },
    "reason": { "type": "string", "nullable": true }
  }
}
```

- [ ] **Step 2: Delete executable handler**

```bash
git rm demo/order-fulfillment-blueprint/services/inventory/commands/handlers.mjs
```

- [ ] **Step 3: Migrate bindings**

For every `bindings.json`:

- replace `"kind": "query"` with `"exposure": "read"`;
- replace `"kind": "command"` with `"exposure": "action"`;
- remove `pre[]`;
- move pre-step module calls into graph `call` nodes.

For notes Auth0 bindings, add `call` nodes to affected graphs:

```json
{
  "id": "session",
  "type": "call",
  "target": { "module": "identity-auth0", "operation": "IntrospectSession" },
  "input": {
    "token": { "$param": "authorization" },
    "audience": { "$literal": "${auth.audience}" }
  },
  "policy": {
    "timeoutMs": 1000,
    "retry": { "attempts": 2, "retryOn": "transient" },
    "idempotency": { "mode": "none" },
    "onError": "fail"
  }
}
```

For each notes graph that previously used Auth0 `pre[]`, add a required graph input:

```json
"authorization": { "type": "string", "mode": "required" }
```

In each corresponding binding entry, add:

```json
"inputFrom": {
  "authorization": { "from": "header", "name": "authorization", "required": true }
}
```

Use `{ "$param": "authorization" }` as the call token input. Replace graph expressions such as `{ "$pre": "session.user_id" }` with `{ "$ref": "session.result.user_id" }`.

- [ ] **Step 4: Update UI fixtures that use binding kind**

UI source action `kind: "command"` may remain a UI action kind. Do not rename UI action kinds in this task unless the UI validator imports binding `kind`. Update only validator expectations that read binding metadata:

- data bindings must reference `exposure: "read"`;
- action bindings must reference `exposure: "action"`.

- [ ] **Step 5: Update smoke assertions**

In `packages/artifacts/blueprint/test/smoke-order-fulfillment-demo.test.ts`:

- Remove reading `services/inventory/commands/handlers.mjs`.
- Assert the reserveStock graph contains:

```ts
expect(reserveGraph.nodes.some((node) => node.type === 'branch')).toBe(true);
expect(reserveGraph.nodes.some((node) => node.id === 'emitRejected')).toBe(true);
expect(reserveGraph.nodes.some((node) => node.type === 'result')).toBe(true);
```

- Keep BPMN result variable assertions.

- [ ] **Step 6: Verify demos and fixtures**

Run:

```bash
pnpm -F @rntme/blueprint test -- test/smoke-order-fulfillment-demo.test.ts
pnpm -F @rntme/runtime test -- test/integration/startup.test.ts
pnpm -F @rntme/bindings test
pnpm -F @rntme/bindings-http test
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add demo packages apps
git commit -m "refactor(demos): migrate bindings to effect operations"
```

### Task 13: Documentation Touch

**Files:**
- Modify: `packages/artifacts/graph-ir-compiler/README.md`
- Modify: `packages/artifacts/bindings/README.md`
- Modify: `packages/runtime/bindings-http/README.md`
- Modify: `packages/runtime/bindings-grpc/README.md`
- Modify: `packages/runtime/runtime/README.md`
- Modify: `packages/artifacts/blueprint/README.md`
- Modify: `apps/cli/README.md`
- Modify: `apps/platform-http/README.md`
- Modify: `demo/order-fulfillment-blueprint/README.md`
- Modify: `AGENTS.md`
- Modify: `README.md`
- Modify: `apps/cli/src/skills/sources/designing-graph-ir.md`
- Modify: `apps/cli/src/skills/sources/designing-bindings.md`
- Modify: `apps/cli/src/skills/sources/designing-ui.md`

- [ ] **Step 1: Update Graph IR README**

Document:

- Graph IR is effect-based.
- New nodes: `findOne`, `call`, `branch`, `result`.
- Emits are local-only.
- QSM vs call boundary.
- BPMN boundary.
- `compileOperation`/`executeOperation` replace query/command API for new code.

Add a "Where to look first" row:

```md
| Add a new operation effect | `src/types/effects.ts`, `src/validate/effects.ts`, `src/operation/compile.ts`, `src/operation/execute.ts`; tests in `test/unit/validate/effects.test.ts` and `test/integration/operation-*.test.ts`. |
```

- [ ] **Step 2: Update bindings README**

Replace `kind: query|command` docs with:

```md
Bindings expose graph operations with `exposure: "read" | "action"`. Exposure is validated against the graph's inferred `EffectSummary`; `read` rejects local emits and action calls.
```

Remove `pre[]` as authoring guidance and point to Graph IR `call` nodes.

- [ ] **Step 3: Update runtime READMEs**

In bindings-http/runtime/bindings-grpc/runtime READMEs:

- Replace command/query executor language with operation executor.
- Remove `commands.handlersModule`.
- Remove service-local handler module docs.
- Explain operation result shape.

- [ ] **Step 4: Update project guidance**

In `AGENTS.md`:

- Replace §6.11 "Call a module via pre-fetch from a command binding" with "Call a module/service from Graph IR".
- Add common task "Add a Graph IR operation call".
- Add a hard rule: domain blueprints must not contain `services/*/commands/handlers.mjs`.
- Update package glossary entries for Graph IR, bindings, runtime, platform-http, CLI.

In root `README.md`, update package table and architecture diagram text if it mentions command/query split, `pre[]`, or `CommandResult`.

- [ ] **Step 5: Update CLI skill source docs**

In `apps/cli/src/skills/sources/designing-graph-ir.md`:

- Remove `inferRole()` guidance as primary authoring.
- Document `exposure`, `EffectSummary`, `call`, `branch`, `result`.

In `apps/cli/src/skills/sources/designing-bindings.md`:

- Use `exposure` instead of `kind`.
- Remove `pre[]` examples.

In `apps/cli/src/skills/sources/designing-ui.md`:

- Keep UI action `kind` terminology if still used by UI.
- Clarify that binding metadata uses `exposure`.

- [ ] **Step 6: Verify docs do not contain stale primary guidance**

Run:

```bash
rg -n "pre\\[\\]|kind: \\\"query\\\"|kind: \\\"command\\\"|row<CommandResult>|commands\\.handlersModule|services/.*/commands/handlers\\.mjs|inferRole\\(\\)" AGENTS.md README.md packages apps demo docs/superpowers/specs/2026-05-06-graph-ir-effect-operations-design.md
```

Expected: only historical specs/plans under `docs/superpowers/specs/done/` and `docs/superpowers/plans/done/` may still mention old terms. Current READMEs, AGENTS, demos, and CLI skill sources must not present old terms as current guidance.

- [ ] **Step 7: Commit**

```bash
git add AGENTS.md README.md packages apps demo
git commit -m "docs: document graph ir effect operations"
```

### Task 14: Full Verification And Cleanup

**Files:**
- Modify only files with stale imports or snapshots discovered by verification.
- Test: workspace checks.

- [ ] **Step 1: Run package-focused checks**

Run:

```bash
pnpm -F @rntme/graph-ir-compiler test
pnpm -F @rntme/bindings test
pnpm -F @rntme/bindings-http test
pnpm -F @rntme/bindings-grpc test
pnpm -F @rntme/runtime test
pnpm -F @rntme/blueprint test
pnpm -F @rntme/cli test
pnpm -F @rntme/platform-http test
```

Expected: all exit 0.

- [ ] **Step 2: Run workspace build/typecheck/lint**

Run:

```bash
pnpm -r run build
pnpm -r run typecheck
pnpm -r run lint
```

Expected: all exit 0.

- [ ] **Step 3: Run layering check**

Run:

```bash
pnpm depcruise
```

Expected: exit 0. If a new dependency violates layering, move the shared type into an existing contracts package or keep the dependency at the runtime/app layer. Do not add a warning rule.

- [ ] **Step 4: Run stale-reference search**

Run:

```bash
rg -n "CodeCommandExecutor|CompositeCommandExecutor|GraphIrCommandExecutor|GraphIrQueryExecutor|compileCommand\\(|executeCommand\\(|buildDefaultGraphIrCommandMap|buildDefaultGraphIrQueryMap|commands\\.handlersModule|services/.*/commands/handlers\\.mjs|BINDINGS_COMMAND_ON_NON_COMMAND_GRAPH|BINDINGS_QUERY_ON_COMMAND_GRAPH|BINDINGS_STRUCTURAL_PRE|BLUEPRINT_GRAPH_PRE_REF_UNDEFINED_BINDING" packages apps demo AGENTS.md README.md
```

Expected: no current-code references. Historical specs/plans are not included in this command.

- [ ] **Step 5: Update generated snapshots**

Run the CLI snapshot generator exposed by `apps/cli/package.json`:

```bash
pnpm -F @rntme/cli gen:snapshots
git diff -- apps/cli/src/skills/verify/snapshots
```

Expected: snapshots reflect `exposure`, no `kind` default, and no `pre[]`.

- [ ] **Step 6: Final commit**

```bash
git add .
git commit -m "chore: finish graph ir effect operation migration"
```
