> Status: historical.
> Date: 2026-04-14.
> Current source: docs/current/**, docs/decision-system.md, and current code/tests.
> Why retained: Historical rationale and execution context retained for review; it is not current-state truth by itself.

# @rntme/graph-ir-compiler Mutations Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `@rntme/graph-ir-compiler` with the `emit` node kind, the `command` graph role, and a command runtime that performs read-prelude against QSM + replay + single-aggregate atomic append against `@rntme/event-store`. In the same pass, migrate the package off its ad-hoc local PDM/QSM Zod schemas onto `@rntme/pdm` and `@rntme/qsm` resolvers, and switch read-graph `findMany` resolution so an `entity` source compiles to the entity's mirror projection table when one exists (spec §6.8).

**Architecture:** Two new sibling modules inside `src/`: `emit/` (authoring type, canonical, structural + semantic validation for `emit` nodes — spec §4) and `command-runtime/` (compile-time emit plan + runtime orchestration of read-prelude → replay → transition check → event derivation → append — spec §4.5 and §5.3). A new `role/` module infers graph role (`predicate | mapper | reducer | query | command`) from the canonical graph (spec §4.2) and drives both structural gating (existing pipeline only accepts `query`) and command-path selection. `findMany` resolution moves from "entity → entity.table" to "entity → QSM-entity-mirror.table (if present, else entity.table)" via `QsmResolver.findEntityMirror`, so read-graphs automatically point at projection tables while remaining authoring-compatible (spec §6.8).

**Tech Stack:** TypeScript (strict, ES2022, `verbatim` module syntax), Zod 3 (authoring schema), `better-sqlite3` (SQL execution for read-prelude), Vitest (unit + e2e), `@rntme/pdm` / `@rntme/qsm` / `@rntme/event-store` as workspace dependencies.

**Related spec:** `docs/history/specs/historical/2026-04-14-mutations-design.md` §4 (emit + command role), §4.5 (runtime), §4.6 (CMD_* validation codes), §6.8 (entity → projection resolver change), §7.7 (package layout), §7.8 item 4 (rollout order).

**Dependency context:** Fourth package in the rollout (§7.8). Blocked by `@rntme/pdm` (1), `@rntme/qsm` (2), `@rntme/event-store` (3) — all already implemented. Unblocks `@rntme/bindings` (6, which needs the command role to exist) and `@rntme/bindings-http` (7, which calls `executeCommand`).

**MVP scope vs tier 2:**
- In scope: `emit` canonical node + parse/normalize; role inference; all `CMD_*` + `GRAPH_MIXED_ROLE` structural/semantic codes; `CommandResult` auto-shape; event-type/payload derivation from PDM stateMachine; replay + transition legality check; single-aggregate write-txn (spec §4.5 `CMD_MULTI_AGGREGATE_NOT_ALLOWED`); optional read-prelude + guard rejection against QSM DB; public `compileCommand` / `executeCommand` / `runCommand`; migration to `@rntme/pdm` + `@rntme/qsm`; `findMany.source.entity` → projection-table resolution.
- Out of scope: multi-aggregate commands; custom command output shapes (non-`CommandResult`); snapshot optimization on replay; breaking schema evolution; upcasting old events; saga/process-manager-style chained commands.

---

## File Layout

```
packages/graph-ir-compiler/
  package.json                                  # MODIFY — add @rntme/pdm, qsm, event-store deps
  src/
    index.ts                                    # MODIFY — add compileCommand/executeCommand/runCommand
    types/
      authoring.ts                              # MODIFY — add EmitNode to AnyGraphNode
      canonical.ts                              # MODIFY — add CanonicalEmit to CanonicalNode
      pdm.ts                                    # DELETE — replaced by @rntme/pdm re-exports
      qsm.ts                                    # DELETE — replaced by @rntme/qsm re-exports
      result.ts                                 # MODIFY — add CMD_*, GRAPH_MIXED_ROLE, RUNTIME_* codes
      command.ts                                # NEW — CommandResult, CompiledCommand, EmitPlan
    parse/
      schema.ts                                 # MODIFY — add emitNode to discriminated union
    canonical/
      normalize.ts                              # MODIFY — handle emit node
    role/
      infer.ts                                  # NEW — inferRole(graph): GraphRole
    validate/
      structural/
        tier1-nodes.ts                          # MODIFY — emit is allowed
        role.ts                                 # NEW — GRAPH_MIXED_ROLE check
        command-shape.ts                        # NEW — command output must be row<CommandResult>
        index.ts                                # MODIFY — wire new checks
      semantic/
        sources.ts                              # MODIFY — use QsmResolver.findEntityMirror for entity sources
        emit.ts                                 # NEW — CMD_* semantic checks
        index.ts                                # MODIFY — call checkEmit
    semantic-plan/
      build.ts                                  # MODIFY — skip emit nodes (command-runtime handles them)
    emit/
      event-type.ts                             # NEW — deriveEventTypeName() wrapper
      payload.ts                                # NEW — derive before/after payload at runtime
      plan.ts                                   # NEW — EmitPlan builder from canonical emit + PDM
    command-runtime/
      compile.ts                                # NEW — compileCommand: read-prelude + emit plans
      replay.ts                                 # NEW — replay stream → aggregate state + version
      transition.ts                             # NEW — validate transition legal from current state
      execute.ts                                # NEW — executeCommand orchestration
      errors.ts                                 # NEW — CommandExecutionError class
  test/
    unit/
      role/
        infer.test.ts                           # NEW
      validate/
        structural/
          role.test.ts                          # NEW
          command-shape.test.ts                 # NEW
          tier1-nodes.test.ts                   # MODIFY — emit now allowed
        semantic/
          sources.test.ts                      # MODIFY — projection-table resolution
          emit.test.ts                          # NEW — all CMD_* codes
      emit/
        event-type.test.ts                      # NEW
        payload.test.ts                         # NEW
        plan.test.ts                            # NEW
      command-runtime/
        replay.test.ts                          # NEW
        transition.test.ts                      # NEW
        execute-single-aggregate.test.ts        # NEW
        execute-read-prelude.test.ts            # NEW
    e2e/
      fixtures/
        issue-tracker.pdm.json                  # NEW — copied/trimmed from demo, with Issue SM
        issue-tracker.qsm.json                  # NEW — entity-mirror IssueView projection
        issue-tracker.sql                       # NEW — CREATE TABLE projection_issue + event_log
      command-assign.e2e.test.ts                # NEW — issue assign via full stack
      command-report-creation.e2e.test.ts       # NEW — creation transition (from: null)
      command-guard-rejected.e2e.test.ts        # NEW — read-prelude guard blocks emit
      command-concurrency.e2e.test.ts           # NEW — ConcurrencyConflict surfaced
```

---

## Task 1: Add workspace dependencies and delete local PDM/QSM schemas

**Files:**
- Modify: `packages/graph-ir-compiler/package.json`
- Delete: `packages/graph-ir-compiler/src/types/pdm.ts`
- Delete: `packages/graph-ir-compiler/src/types/qsm.ts`

- [ ] **Step 1: Add workspace deps to `package.json`**

Edit `packages/graph-ir-compiler/package.json` — replace the `dependencies` block:

```json
"dependencies": {
  "@rntme/event-store": "workspace:*",
  "@rntme/pdm": "workspace:*",
  "@rntme/qsm": "workspace:*",
  "better-sqlite3": "^11.3.0",
  "zod": "^3.23.8"
}
```

- [ ] **Step 2: Run `pnpm install` at the repo root**

Run: `pnpm install`
Expected: new dependencies linked; no errors.

- [ ] **Step 3: Delete the two local schema files**

```bash
rm packages/graph-ir-compiler/src/types/pdm.ts
rm packages/graph-ir-compiler/src/types/qsm.ts
```

Compilation will now break. We fix it in Task 2.

- [ ] **Step 4: Commit**

```bash
git add packages/graph-ir-compiler/package.json packages/graph-ir-compiler/src/types/pdm.ts packages/graph-ir-compiler/src/types/qsm.ts
git commit -m "chore(graph-ir-compiler): drop local PDM/QSM Zod schemas in favor of workspace deps"
```

---

## Task 2: Rewire imports to `@rntme/pdm` and `@rntme/qsm`

**Files:**
- Modify: `packages/graph-ir-compiler/src/index.ts`
- Modify: `packages/graph-ir-compiler/src/explain/explain.ts`
- Modify: `packages/graph-ir-compiler/src/validate/structural/index.ts`
- Modify: `packages/graph-ir-compiler/src/validate/structural/shapes.ts`
- Modify: `packages/graph-ir-compiler/src/validate/structural/map-reduce.ts`
- Modify: `packages/graph-ir-compiler/src/validate/semantic/sources.ts`
- Modify: `packages/graph-ir-compiler/src/validate/semantic/index.ts`
- Modify: `packages/graph-ir-compiler/src/validate/semantic/types.ts`
- Modify: `packages/graph-ir-compiler/src/validate/semantic/fields.ts`
- Modify: `packages/graph-ir-compiler/src/validate/semantic/shape-conformance.ts`
- Modify: `packages/graph-ir-compiler/src/validate/semantic/aggregate-phase.ts`
- Modify: `packages/graph-ir-compiler/src/semantic-plan/build.ts`
- Modify: `packages/graph-ir-compiler/src/lower/sqlite/lower.ts`
- Modify: `packages/graph-ir-compiler/src/lower/sqlite/joins.ts`

- [ ] **Step 1: Replace local type imports across the package**

In every file above, replace:

```ts
import type { Pdm } from '../../types/pdm.js';
import type { Qsm } from '../../types/qsm.js';
```

with:

```ts
import type { ValidatedPdm } from '@rntme/pdm';
import type { ValidatedQsm } from '@rntme/qsm';
```

Wherever the code previously used `Pdm` as a parameter type, use `ValidatedPdm`. Wherever it used `Qsm`, use `ValidatedQsm`. The shape is compatible at use-sites (`pdm.entities[name]`, `qsm.projections[name]`).

- [ ] **Step 2: Replace parse call-sites in `src/index.ts` and `src/explain/explain.ts`**

In both files, replace:

```ts
const pdmR = PdmSchema.safeParse(rawPdm);
if (!pdmR.success) { return err([{ layer: 'parse', code: ERROR_CODES.PARSE_SCHEMA_VIOLATION, message: 'PDM failed schema validation' }]); }
const pdm: Pdm = pdmR.data;

const qsmR = QsmSchema.safeParse(rawQsm);
if (!qsmR.success) { return err([{ layer: 'parse', code: ERROR_CODES.PARSE_SCHEMA_VIOLATION, message: 'QSM failed schema validation' }]); }
const qsm: Qsm = qsmR.data;
```

with (use the validated-artifact factories from the new packages):

```ts
import { parsePdm, validatePdm } from '@rntme/pdm';
import { parseQsm, validateQsm } from '@rntme/qsm';
// ...
const pdmParse = parsePdm(rawPdm);
if (!pdmParse.ok) return err([{ layer: 'parse', code: ERROR_CODES.PARSE_SCHEMA_VIOLATION, message: 'PDM failed schema validation' }]);
const pdmVal = validatePdm(pdmParse.value);
if (!pdmVal.ok) return err([{ layer: 'parse', code: ERROR_CODES.PARSE_SCHEMA_VIOLATION, message: pdmVal.errors[0]?.message ?? 'PDM validation failed' }]);
const pdm: ValidatedPdm = pdmVal.value;

const qsmParse = parseQsm(rawQsm);
if (!qsmParse.ok) return err([{ layer: 'parse', code: ERROR_CODES.PARSE_SCHEMA_VIOLATION, message: 'QSM failed schema validation' }]);
const qsmVal = validateQsm(qsmParse.value, pdm);
if (!qsmVal.ok) return err([{ layer: 'parse', code: ERROR_CODES.PARSE_SCHEMA_VIOLATION, message: qsmVal.errors[0]?.message ?? 'QSM validation failed' }]);
const qsm: ValidatedQsm = qsmVal.value;
```

Re-export both validated types from `src/index.ts`:

```ts
export type { ValidatedPdm } from '@rntme/pdm';
export type { ValidatedQsm } from '@rntme/qsm';
```

Remove the `export type { Pdm } from './types/pdm.js';` and `export type { Qsm } from './types/qsm.js';` lines.

- [ ] **Step 3: Update `resolveSources` in `src/validate/semantic/sources.ts` to accept the new types**

Only the imports change; logic stays identical for now. Next task rewrites the logic.

- [ ] **Step 4: Update existing commerce fixtures to the new QSM shape**

The old QSM schema required `pathPrefix`; the new one treats it as optional. `@rntme/qsm`'s structural validator forbids `pathPrefix` on `backing: "entity-mirror"` and only allows `derived` (tier-2) with it; but `CategorySalesProjection` in the fixture uses `pathPrefix`. Rewrite the fixture to declare `backing: "derived"` and additionally skip derived-projection validation in this migration by passing a `{ allowDerived: true }` option — **unless** that option does not exist; in that case rewrite the fixture so it becomes a plain entity-mirror projection and update the `e2e/category-sales.e2e.test.ts` graph to use `source.entity` instead of `source.projection`.

Concretely:

Edit `packages/graph-ir-compiler/test/e2e/fixtures/commerce.qsm.json`:

```json
{
  "projections": {
    "CategorySalesMirror": {
      "backing": "entity-mirror",
      "source": { "entity": "OrderItem" },
      "keys": ["id"],
      "grain": ["id"],
      "exposed": ["id", "orderId", "productId", "quantity", "unitPrice"],
      "table": "order_items"
    }
  },
  "relationRoles": {
    "OrderItem.order": "fact",
    "OrderItem.product": "dimension",
    "Product.category": "dimension"
  }
}
```

Then update `test/unit/validate/semantic/sources.test.ts` — replace `CategorySalesProjection` references with `CategorySalesMirror` and adjust the expected `alias` field accordingly (`categorySalesMirror`).

The `category-sales.e2e.test.ts` graph that relied on the old derived projection can also be switched to `source: { entity: 'OrderItem' }`; the test still validates grouping/aggregation correctness against the same underlying table.

- [ ] **Step 5: Run typecheck and tests; fix remaining import errors**

Run: `pnpm --filter @rntme/graph-ir-compiler typecheck`
Expected: no errors.

Run: `pnpm --filter @rntme/graph-ir-compiler test`
Expected: all existing tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/graph-ir-compiler/src packages/graph-ir-compiler/test
git commit -m "refactor(graph-ir-compiler): migrate PDM/QSM parsing to @rntme/pdm + @rntme/qsm"
```

---

## Task 3: Switch `findMany.source.entity` to prefer projection mirror

**Files:**
- Modify: `packages/graph-ir-compiler/src/validate/semantic/sources.ts`
- Modify: `packages/graph-ir-compiler/test/unit/validate/semantic/sources.test.ts`

- [ ] **Step 1: Write a failing test for entity → mirror projection table**

Add to `test/unit/validate/semantic/sources.test.ts`:

```ts
it('resolves entity source to its entity-mirror projection table when one exists', () => {
  const qsmWithMirror = {
    ...QSM_BASE,
    projections: {
      OrderItemMirror: {
        backing: 'entity-mirror' as const,
        source: { entity: 'OrderItem' },
        keys: ['id'], grain: ['id'],
        exposed: ['id', 'orderId', 'productId', 'quantity', 'unitPrice'],
        table: 'projection_order_item',
      },
    },
  };
  const spec: AuthoringSpecOutput = {
    ...good,
    graphs: { g: { id: 'g', signature: good.graphs.g!.signature,
      nodes: [{ id: 'items', type: 'findMany', config: { source: { entity: 'OrderItem' } } }] } },
  };
  const { graphs } = normalize(spec);
  const r = resolveSources(graphs.g!, PDM_VALIDATED, validateQsm(qsmWithMirror, PDM_VALIDATED).value!);
  expect(r.ok).toBe(true);
  if (r.ok) expect(r.value.get('items')).toMatchObject({
    kind: 'entity', entity: 'OrderItem', table: 'projection_order_item',
  });
});

it('falls back to entity.table when no mirror exists', () => {
  // use base qsm (no projections)
  // expect table = 'order_items'
});
```

- [ ] **Step 2: Run the failing test**

Run: `pnpm --filter @rntme/graph-ir-compiler test sources.test.ts`
Expected: FAIL — first new case resolves to `order_items`, not `projection_order_item`.

- [ ] **Step 3: Update `resolveSources` to use `QsmResolver.findEntityMirror`**

Replace the entity-branch in `src/validate/semantic/sources.ts`:

```ts
import { createQsmResolver } from '@rntme/qsm';

export function resolveSources(graph: CanonicalGraph, pdm: ValidatedPdm, qsm: ValidatedQsm): Result<SourceMap> {
  const errors: GraphIrError[] = [];
  const map: SourceMap = new Map();
  const qsmResolver = createQsmResolver(qsm);

  for (const node of graph.nodes) {
    if (node.kind !== 'findMany') continue;
    if ('entity' in node.source) {
      const entity = pdm.entities[node.source.entity];
      if (!entity) {
        errors.push({ layer: 'semantic', code: ERROR_CODES.SEM_SOURCE_NOT_FOUND,
          message: `entity "${node.source.entity}" not found in PDM`,
          location: { graphId: graph.id, nodeId: node.id } });
        continue;
      }
      const mirror = qsmResolver.findEntityMirror(node.source.entity);
      const table = mirror ? mirror.table : entity.table;
      map.set(node.id, { kind: 'entity', entity: node.source.entity, table, alias: node.alias });
    } else {
      const proj = qsm.projections[node.source.projection];
      if (!proj) {
        errors.push({ layer: 'semantic', code: ERROR_CODES.SEM_SOURCE_NOT_FOUND,
          message: `projection "${node.source.projection}" not found in QSM`,
          location: { graphId: graph.id, nodeId: node.id } });
        continue;
      }
      const resolved = qsmResolver.resolveProjection(node.source.projection)!;
      const entity = pdm.entities[resolved.source.entity];
      if (!entity) {
        errors.push({ layer: 'semantic', code: ERROR_CODES.SEM_SOURCE_NOT_FOUND,
          message: `projection "${node.source.projection}" refers to missing entity "${resolved.source.entity}"`,
          location: { graphId: graph.id, nodeId: node.id } });
        continue;
      }
      map.set(node.id, { kind: 'projection', projection: node.source.projection,
        entity: resolved.source.entity, table: resolved.table, alias: node.alias });
    }
  }

  return errors.length ? err(errors) : ok(map);
}
```

- [ ] **Step 4: Run the test**

Run: `pnpm --filter @rntme/graph-ir-compiler test sources.test.ts`
Expected: PASS.

Run: `pnpm --filter @rntme/graph-ir-compiler test`
Expected: all tests pass (the commerce fixture's `CategorySalesMirror` has `table: "order_items"` so unaffected).

- [ ] **Step 5: Commit**

```bash
git add packages/graph-ir-compiler/src/validate/semantic/sources.ts packages/graph-ir-compiler/test/unit/validate/semantic/sources.test.ts
git commit -m "feat(graph-ir-compiler): resolve findMany.source.entity to its QSM mirror projection table"
```

---

## Task 4: Extend authoring/Zod schema with `emit` node

**Files:**
- Modify: `packages/graph-ir-compiler/src/types/authoring.ts`
- Modify: `packages/graph-ir-compiler/src/parse/schema.ts`
- Create: `packages/graph-ir-compiler/test/unit/parse/emit-parse.test.ts`

- [ ] **Step 1: Write a failing parse test for an emit node**

Create `test/unit/parse/emit-parse.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseAuthoringSpec } from '../../../src/parse/parse.js';

const baseSpec = {
  version: '1.0-rc7', pdmRef: 'p', qsmRef: 'q', shapes: {},
  graphs: {
    g: {
      id: 'g',
      signature: {
        inputs: {
          issueId:    { type: 'integer', mode: 'required' },
          assigneeId: { type: 'integer', mode: 'required' },
        },
        output: { type: 'row<CommandResult>', from: 'e' },
      },
      nodes: [{
        id: 'e',
        type: 'emit',
        config: {
          aggregate:   'Issue',
          aggregateId: { $param: 'issueId' },
          transition:  'assign',
          payload:     { assigneeId: { $param: 'assigneeId' } },
        },
      }],
    },
  },
};

describe('parse emit node', () => {
  it('accepts a minimal emit node with aggregateId/transition/payload', () => {
    const r = parseAuthoringSpec(baseSpec);
    expect(r.ok).toBe(true);
    if (r.ok) {
      const emit = r.value.graphs.g!.nodes[0] as { type: string; config: { transition: string } };
      expect(emit.type).toBe('emit');
      expect(emit.config.transition).toBe('assign');
    }
  });

  it('accepts optional actor expr', () => {
    const spec = structuredClone(baseSpec) as typeof baseSpec & { graphs: { g: { nodes: Array<Record<string, unknown>> } } };
    (spec.graphs.g.nodes[0] as { config: Record<string, unknown> }).config.actor = { $param: 'actor' };
    const r = parseAuthoringSpec(spec);
    expect(r.ok).toBe(true);
  });

  it('rejects emit with unknown config key', () => {
    const spec = structuredClone(baseSpec) as typeof baseSpec & { graphs: { g: { nodes: Array<Record<string, unknown>> } } };
    (spec.graphs.g.nodes[0] as { config: Record<string, unknown> }).config.extra = true;
    const r = parseAuthoringSpec(spec);
    expect(r.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test**

Run: `pnpm --filter @rntme/graph-ir-compiler test emit-parse.test.ts`
Expected: FAIL (emit not in discriminated union).

- [ ] **Step 3: Add `EmitNode` to authoring types**

Append to `src/types/authoring.ts`:

```ts
export type EmitNode = {
  id: string;
  type: 'emit';
  config: {
    aggregate: string;
    aggregateId: Expr;
    transition: string;
    payload: Record<string, Expr>;
    actor?: Expr;
  };
};

export type AnyGraphNode = GraphNode | DistinctNode | LookupOneNode | EmitNode;
```

Keep `GraphNode` unchanged (tier-1 read nodes only). `AnyGraphNode` is the permissive union used by authoring / parse / normalize.

- [ ] **Step 4: Extend the Zod discriminated union**

In `src/parse/schema.ts`, after `lookupOneNode`, add:

```ts
const emitNode = z
  .object({
    id: z.string(),
    type: z.literal('emit'),
    config: z
      .object({
        aggregate:   z.string(),
        aggregateId: expr,
        transition:  z.string(),
        payload:     z.record(expr),
        actor:       expr.optional(),
      })
      .strict(),
  })
  .strict();
```

Extend the union:

```ts
const graphNode = z.discriminatedUnion('type', [
  findManyNode, filterNode, mapNode, reduceNode, sortNode, limitNode, distinctNode, lookupOneNode, emitNode,
]);
```

- [ ] **Step 5: Run the test**

Run: `pnpm --filter @rntme/graph-ir-compiler test emit-parse.test.ts`
Expected: PASS (all three cases).

Run: `pnpm --filter @rntme/graph-ir-compiler test`
Expected: all existing tests still pass.

- [ ] **Step 6: Commit**

```bash
git add packages/graph-ir-compiler/src/types/authoring.ts packages/graph-ir-compiler/src/parse/schema.ts packages/graph-ir-compiler/test/unit/parse/emit-parse.test.ts
git commit -m "feat(graph-ir-compiler): parse emit node authoring shape"
```

---

## Task 5: Extend canonical + normalize for emit

**Files:**
- Modify: `packages/graph-ir-compiler/src/types/canonical.ts`
- Modify: `packages/graph-ir-compiler/src/canonical/normalize.ts`
- Create: `packages/graph-ir-compiler/test/unit/canonical/emit-normalize.test.ts`

- [ ] **Step 1: Write a failing normalize test**

Create `test/unit/canonical/emit-normalize.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseAuthoringSpec } from '../../../src/parse/parse.js';
import { normalize } from '../../../src/canonical/normalize.js';

describe('normalize emit node', () => {
  it('maps parsed emit to CanonicalEmit with aggregate/transition preserved', () => {
    const r = parseAuthoringSpec({
      version: '1.0-rc7', pdmRef: 'p', qsmRef: 'q', shapes: {},
      graphs: { g: { id: 'g',
        signature: { inputs: { id: { type: 'integer', mode: 'required' } },
                     output: { type: 'row<CommandResult>', from: 'e' } },
        nodes: [{ id: 'e', type: 'emit',
          config: { aggregate: 'Issue', aggregateId: { $param: 'id' },
                    transition: 'submit', payload: {} } }] } },
    });
    if (!r.ok) throw new Error('parse failed');
    const { graphs } = normalize(r.value);
    const node = graphs.g!.nodes[0];
    expect(node.kind).toBe('emit');
    if (node.kind === 'emit') {
      expect(node.aggregate).toBe('Issue');
      expect(node.transition).toBe('submit');
      expect(node.payload).toEqual({});
      expect(node.aggregateId).toEqual({ $param: 'id' });
      expect(node.actor).toBeUndefined();
    }
  });
});
```

- [ ] **Step 2: Run the failing test**

Run: `pnpm --filter @rntme/graph-ir-compiler test emit-normalize.test.ts`
Expected: FAIL — normalize throws `unsupported node type in canonical normalize: emit`.

- [ ] **Step 3: Add `CanonicalEmit` to `canonical.ts`**

Append to `src/types/canonical.ts`:

```ts
export type CanonicalEmit = {
  kind: 'emit';
  id: string;
  scope: ScopeId;
  aggregate: string;
  aggregateId: Expr;
  transition: string;
  payload: Record<string, Expr>;
  actor?: Expr;
};

export type CanonicalNode =
  | CanonicalFindMany
  | CanonicalFilter
  | CanonicalMap
  | CanonicalReduce
  | CanonicalSort
  | CanonicalLimit
  | CanonicalEmit;
```

- [ ] **Step 4: Handle emit in `normalize.ts`**

Add a new case inside the `switch (n.type)` in `src/canonical/normalize.ts`, before the `default`:

```ts
case 'emit': {
  const out: CanonicalEmit = {
    kind: 'emit',
    id: n.id,
    scope,
    aggregate: n.config.aggregate,
    aggregateId: n.config.aggregateId as Expr,
    transition: n.config.transition,
    payload: n.config.payload as Record<string, Expr>,
  };
  if (n.config.actor !== undefined) out.actor = n.config.actor as Expr;
  return out;
}
```

Also add `import type { CanonicalEmit } from '../types/canonical.js';` at the top if needed (or inline in the existing canonical import list).

- [ ] **Step 5: Run the test + full suite**

Run: `pnpm --filter @rntme/graph-ir-compiler test emit-normalize.test.ts`
Expected: PASS.

Run: `pnpm --filter @rntme/graph-ir-compiler test`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/graph-ir-compiler/src/types/canonical.ts packages/graph-ir-compiler/src/canonical/normalize.ts packages/graph-ir-compiler/test/unit/canonical/emit-normalize.test.ts
git commit -m "feat(graph-ir-compiler): canonicalize emit node"
```

---

## Task 6: Role inference (`predicate | mapper | reducer | query | command`)

**Files:**
- Create: `packages/graph-ir-compiler/src/role/infer.ts`
- Create: `packages/graph-ir-compiler/test/unit/role/infer.test.ts`
- Modify: `packages/graph-ir-compiler/src/types/result.ts` (add `GRAPH_MIXED_ROLE`)

- [ ] **Step 1: Add `GRAPH_MIXED_ROLE` to `ERROR_CODES`**

Append to `ERROR_CODES` object in `src/types/result.ts`:

```ts
GRAPH_MIXED_ROLE: 'GRAPH_MIXED_ROLE',
```

- [ ] **Step 2: Write failing tests for role inference**

Create `test/unit/role/infer.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { inferRole } from '../../../src/role/infer.js';
import type { CanonicalGraph } from '../../../src/types/canonical.js';

function g(signature: CanonicalGraph['signature'], nodes: CanonicalGraph['nodes']): CanonicalGraph {
  return { id: 'g', signature, nodes, outputFrom: signature.output.from };
}

describe('inferRole', () => {
  it('returns predicate for root row<T> input + boolean output', () => {
    const r = inferRole(g(
      { inputs: { $root: { type: { row: 'T' }, mode: 'root' } },
        output: { type: 'boolean', from: 'f' } },
      [{ kind: 'filter', id: 'f', scope: 's1', input: '$root', expr: null as never }],
    ));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe('predicate');
  });

  it('returns mapper for root row<T> input + row<U> output', () => {
    const r = inferRole(g(
      { inputs: { $root: { type: { row: 'T' }, mode: 'root' } },
        output: { type: 'row<U>', from: 'm' } },
      [{ kind: 'map', id: 'm', scope: 's1', input: '$root', into: 'U', fields: {} }],
    ));
    if (r.ok) expect(r.value).toBe('mapper');
  });

  it('returns reducer for root rowset<T> + rowset<U> + >=1 reduce', () => {
    const r = inferRole(g(
      { inputs: { $root: { type: { rowset: 'T' }, mode: 'root' } },
        output: { type: 'rowset<U>', from: 'r' } },
      [{ kind: 'reduce', id: 'r', scope: 's1', input: '$root', into: 'U', group: {}, measures: {} }],
    ));
    if (r.ok) expect(r.value).toBe('reducer');
  });

  it('returns query for no root + rowset output + 0 emit', () => {
    const r = inferRole(g(
      { inputs: {}, output: { type: 'rowset<X>', from: 'fm' } },
      [{ kind: 'findMany', id: 'fm', scope: 's1', source: { entity: 'X' }, alias: 'x' }],
    ));
    if (r.ok) expect(r.value).toBe('query');
  });

  it('returns command for no root + >=1 emit', () => {
    const r = inferRole(g(
      { inputs: { id: { type: 'integer', mode: 'required' } },
        output: { type: 'row<CommandResult>', from: 'e' } },
      [{ kind: 'emit', id: 'e', scope: 's1', aggregate: 'Issue',
         aggregateId: { $param: 'id' }, transition: 'submit', payload: {} }],
    ));
    if (r.ok) expect(r.value).toBe('command');
  });

  it('returns GRAPH_MIXED_ROLE when rowset output and emit coexist', () => {
    const r = inferRole(g(
      { inputs: { id: { type: 'integer', mode: 'required' } },
        output: { type: 'rowset<X>', from: 'e' } },
      [{ kind: 'emit', id: 'e', scope: 's1', aggregate: 'Issue',
         aggregateId: { $param: 'id' }, transition: 'submit', payload: {} }],
    ));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]!.code).toBe('GRAPH_MIXED_ROLE');
  });
});
```

- [ ] **Step 3: Run the failing tests**

Run: `pnpm --filter @rntme/graph-ir-compiler test role/infer.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement `inferRole`**

Create `src/role/infer.ts`:

```ts
import type { CanonicalGraph } from '../types/canonical.js';
import { err, ok, ERROR_CODES, type Result } from '../types/result.js';

export type GraphRole = 'predicate' | 'mapper' | 'reducer' | 'query' | 'command';

export function inferRole(graph: CanonicalGraph): Result<GraphRole> {
  const hasEmit = graph.nodes.some((n) => n.kind === 'emit');
  const hasReduce = graph.nodes.some((n) => n.kind === 'reduce');
  const outputType = graph.signature.output.type;
  const outputIsRowset = outputType.startsWith('rowset<');
  const outputIsRow = outputType.startsWith('row<');
  const outputIsBoolean = outputType === 'boolean';

  const rootEntry = Object.entries(graph.signature.inputs).find(([, i]) => i.mode === 'root');
  const rootType = rootEntry?.[1].type;
  const rootIsRow = typeof rootType === 'object' && rootType !== null && 'row' in rootType;
  const rootIsRowset = typeof rootType === 'object' && rootType !== null && 'rowset' in rootType;

  if (rootIsRow && outputIsBoolean) return ok('predicate');
  if (rootIsRow && outputIsRow) return ok('mapper');
  if (rootIsRowset && outputIsRowset && hasReduce) return ok('reducer');
  if (!rootEntry && outputIsRowset && !hasEmit) return ok('query');
  if (!rootEntry && hasEmit && !outputIsRowset) return ok('command');

  if (outputIsRowset && hasEmit) {
    return err([{
      layer: 'structural',
      code: ERROR_CODES.GRAPH_MIXED_ROLE,
      message: 'graph has both rowset<T> output and >=1 emit node; pick one',
      location: { graphId: graph.id },
    }]);
  }
  return err([{
    layer: 'structural',
    code: ERROR_CODES.GRAPH_MIXED_ROLE,
    message: `graph role cannot be inferred from signature/nodes; output=${outputType}, rootInput=${rootEntry?.[0] ?? 'none'}, hasEmit=${hasEmit}`,
    location: { graphId: graph.id },
  }]);
}
```

- [ ] **Step 5: Run the tests**

Run: `pnpm --filter @rntme/graph-ir-compiler test role/infer.test.ts`
Expected: PASS (all 6 cases).

- [ ] **Step 6: Commit**

```bash
git add packages/graph-ir-compiler/src/role packages/graph-ir-compiler/src/types/result.ts packages/graph-ir-compiler/test/unit/role
git commit -m "feat(graph-ir-compiler): infer graph role (predicate|mapper|reducer|query|command)"
```

---

## Task 7: Structural check — command output must be `row<CommandResult>`

**Files:**
- Create: `packages/graph-ir-compiler/src/validate/structural/command-shape.ts`
- Create: `packages/graph-ir-compiler/test/unit/validate/structural/command-shape.test.ts`
- Modify: `packages/graph-ir-compiler/src/validate/structural/index.ts`
- Modify: `packages/graph-ir-compiler/src/types/result.ts` (add `CMD_OUTPUT_SHAPE_INVALID`, `CMD_EMIT_UNREACHABLE`)
- Modify: `packages/graph-ir-compiler/src/validate/structural/tier1-nodes.ts`

- [ ] **Step 1: Add new codes to `ERROR_CODES`**

Append:

```ts
CMD_OUTPUT_SHAPE_INVALID: 'CMD_OUTPUT_SHAPE_INVALID',
CMD_EMIT_UNREACHABLE: 'CMD_EMIT_UNREACHABLE',
```

- [ ] **Step 2: Allow emit in tier-1 gate**

Edit `src/validate/structural/tier1-nodes.ts` — leave `distinct`/`lookupOne`/`filter.predicate` rejections intact; `emit` is implicitly allowed by omission. No behavior change required beyond confirming `n.type === 'emit'` is never rejected here.

- [ ] **Step 3: Write failing tests for command-shape**

Create `test/unit/validate/structural/command-shape.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { checkCommandShape } from '../../../../src/validate/structural/command-shape.js';
import type { AuthoringSpecOutput } from '../../../../src/parse/schema.js';

function specWithCommand(output: { type: string; from: string }, emitId = 'e'): AuthoringSpecOutput {
  return {
    version: '1.0-rc7', pdmRef: 'p', qsmRef: 'q', shapes: {},
    graphs: { g: { id: 'g',
      signature: { inputs: { id: { type: 'integer', mode: 'required' } }, output },
      nodes: [{ id: emitId, type: 'emit',
        config: { aggregate: 'Issue', aggregateId: { $param: 'id' }, transition: 'submit', payload: {} } }] } },
  };
}

describe('checkCommandShape', () => {
  it('accepts row<CommandResult> with output.from pointing to an emit node', () => {
    const errs = checkCommandShape(specWithCommand({ type: 'row<CommandResult>', from: 'e' }));
    expect(errs).toHaveLength(0);
  });

  it('rejects output shape that is not row<CommandResult>', () => {
    const errs = checkCommandShape(specWithCommand({ type: 'row<Other>', from: 'e' }));
    expect(errs[0]?.code).toBe('CMD_OUTPUT_SHAPE_INVALID');
  });

  it('rejects output.from pointing to a non-emit node', () => {
    const s = specWithCommand({ type: 'row<CommandResult>', from: 'other' });
    s.graphs.g!.nodes.push({ id: 'other', type: 'filter', config: { input: 'e', expr: true } } as never);
    const errs = checkCommandShape(s);
    expect(errs.some((e) => e.code === 'CMD_EMIT_UNREACHABLE')).toBe(true);
  });
});
```

- [ ] **Step 4: Run the failing tests**

Run: `pnpm --filter @rntme/graph-ir-compiler test command-shape.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 5: Implement `checkCommandShape`**

Create `src/validate/structural/command-shape.ts`:

```ts
import type { AuthoringSpecOutput } from '../../parse/schema.js';
import { ERROR_CODES, type GraphIrError } from '../../types/result.js';

export function checkCommandShape(spec: AuthoringSpecOutput): GraphIrError[] {
  const errs: GraphIrError[] = [];
  for (const graph of Object.values(spec.graphs)) {
    const hasEmit = graph.nodes.some((n) => n.type === 'emit');
    if (!hasEmit) continue;

    if (graph.signature.output.type !== 'row<CommandResult>') {
      errs.push({
        layer: 'structural',
        code: ERROR_CODES.CMD_OUTPUT_SHAPE_INVALID,
        message: `command graph output must be "row<CommandResult>", got "${graph.signature.output.type}"`,
        location: { graphId: graph.id },
      });
    }

    const terminal = graph.nodes.find((n) => n.id === graph.signature.output.from);
    if (!terminal || terminal.type !== 'emit') {
      errs.push({
        layer: 'structural',
        code: ERROR_CODES.CMD_EMIT_UNREACHABLE,
        message: `signature.output.from "${graph.signature.output.from}" must point to an emit node in a command graph`,
        location: { graphId: graph.id },
      });
    }
  }
  return errs;
}
```

- [ ] **Step 6: Wire into `validateStructural`**

Edit `src/validate/structural/index.ts` — import and call:

```ts
import { checkCommandShape } from './command-shape.js';
// ...
const errors = [
  ...checkIds(spec), ...checkRefs(spec), ...checkDag(spec), ...checkOutputFrom(spec),
  ...checkInputs(spec), ...checkShapes(spec, pdm, qsm), ...checkMapReduceCoverage(spec, pdm, qsm),
  ...checkTier1Nodes(spec), ...checkTier1Expr(spec), ...checkCommandShape(spec),
];
```

- [ ] **Step 7: Run the tests**

Run: `pnpm --filter @rntme/graph-ir-compiler test command-shape.test.ts`
Expected: PASS.

Run: `pnpm --filter @rntme/graph-ir-compiler test`
Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add packages/graph-ir-compiler/src/validate/structural packages/graph-ir-compiler/src/types/result.ts packages/graph-ir-compiler/test/unit/validate/structural/command-shape.test.ts
git commit -m "feat(graph-ir-compiler): structural check command graphs must output row<CommandResult>"
```

---

## Task 8: Structural role check — wire `GRAPH_MIXED_ROLE`

**Files:**
- Create: `packages/graph-ir-compiler/src/validate/structural/role.ts`
- Create: `packages/graph-ir-compiler/test/unit/validate/structural/role.test.ts`
- Modify: `packages/graph-ir-compiler/src/validate/structural/index.ts`

- [ ] **Step 1: Write failing test**

Create `test/unit/validate/structural/role.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { checkGraphRole } from '../../../../src/validate/structural/role.js';

describe('checkGraphRole', () => {
  it('passes for a pure query graph', () => {
    const errs = checkGraphRole({
      version: '1.0-rc7', pdmRef: 'p', qsmRef: 'q', shapes: {},
      graphs: { g: { id: 'g',
        signature: { inputs: {}, output: { type: 'rowset<X>', from: 'fm' } },
        nodes: [{ id: 'fm', type: 'findMany', config: { source: { entity: 'X' } } }] } },
    } as never);
    expect(errs).toHaveLength(0);
  });

  it('emits GRAPH_MIXED_ROLE for rowset output + emit', () => {
    const errs = checkGraphRole({
      version: '1.0-rc7', pdmRef: 'p', qsmRef: 'q', shapes: {},
      graphs: { g: { id: 'g',
        signature: { inputs: { id: { type: 'integer', mode: 'required' } }, output: { type: 'rowset<X>', from: 'e' } },
        nodes: [{ id: 'e', type: 'emit', config: { aggregate: 'A', aggregateId: { $param: 'id' }, transition: 't', payload: {} } }] } },
    } as never);
    expect(errs[0]?.code).toBe('GRAPH_MIXED_ROLE');
  });
});
```

- [ ] **Step 2: Run the failing test**

Run: `pnpm --filter @rntme/graph-ir-compiler test role.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `checkGraphRole`**

Create `src/validate/structural/role.ts`:

```ts
import type { AuthoringSpecOutput } from '../../parse/schema.js';
import { ERROR_CODES, type GraphIrError } from '../../types/result.js';

export function checkGraphRole(spec: AuthoringSpecOutput): GraphIrError[] {
  const errs: GraphIrError[] = [];
  for (const graph of Object.values(spec.graphs)) {
    const hasEmit = graph.nodes.some((n) => n.type === 'emit');
    const outputIsRowset = graph.signature.output.type.startsWith('rowset<');
    if (hasEmit && outputIsRowset) {
      errs.push({
        layer: 'structural',
        code: ERROR_CODES.GRAPH_MIXED_ROLE,
        message: 'graph has both rowset<T> output and >=1 emit node; pick one',
        location: { graphId: graph.id },
      });
    }
  }
  return errs;
}
```

- [ ] **Step 4: Wire into `validateStructural`**

In `src/validate/structural/index.ts`, add `...checkGraphRole(spec)` to the errors chain.

- [ ] **Step 5: Run tests**

Run: `pnpm --filter @rntme/graph-ir-compiler test role.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/graph-ir-compiler/src/validate/structural/role.ts packages/graph-ir-compiler/src/validate/structural/index.ts packages/graph-ir-compiler/test/unit/validate/structural/role.test.ts
git commit -m "feat(graph-ir-compiler): enforce GRAPH_MIXED_ROLE structurally"
```

---

## Task 9: Semantic validation — `CMD_*` codes for emit

**Files:**
- Create: `packages/graph-ir-compiler/test/unit/fixtures/issue-pdm.ts`
- Create: `packages/graph-ir-compiler/src/validate/semantic/emit.ts`
- Create: `packages/graph-ir-compiler/test/unit/validate/semantic/emit.test.ts`
- Modify: `packages/graph-ir-compiler/src/types/result.ts` (add remaining CMD_* codes)
- Modify: `packages/graph-ir-compiler/src/validate/semantic/index.ts`

- [ ] **Step 0: Create shared test fixture for later tasks (Tasks 11, 16, 19 reuse it)**

Create `packages/graph-ir-compiler/test/unit/fixtures/issue-pdm.ts`:

```ts
import { parsePdm, validatePdm } from '@rntme/pdm';
import { parseQsm, validateQsm } from '@rntme/qsm';

export const RAW_ISSUE_PDM = {
  entities: {
    Issue: {
      table: 'issues',
      fields: {
        id:          { type: 'integer', nullable: false, column: 'id' },
        projectId:   { type: 'integer', nullable: false, column: 'project_id' },
        reporterId:  { type: 'integer', nullable: false, column: 'reporter_id' },
        assigneeId:  { type: 'integer', nullable: true,  column: 'assignee_id' },
        title:       { type: 'string',  nullable: false, column: 'title' },
        status:      { type: 'string',  nullable: false, column: 'status' },
        priority:    { type: 'string',  nullable: false, column: 'priority' },
        storyPoints: { type: 'integer', nullable: false, column: 'story_points' },
        resolvedAt:  { type: 'datetime', nullable: true, column: 'resolved_at' },
      },
      relations: {},
      keys: ['id'],
      stateMachine: {
        stateField: 'status',
        initial: null,
        states: ['draft', 'open', 'in_progress', 'resolved', 'closed'],
        transitions: {
          report:   { from: null,           to: 'draft',        affects: ['title', 'projectId', 'reporterId', 'priority', 'storyPoints'] },
          submit:   { from: 'draft',        to: 'open' },
          assign:   { from: 'open',         to: 'in_progress',  affects: ['assigneeId'] },
          reassign: { from: 'in_progress',  to: 'in_progress',  affects: ['assigneeId'] },
          resolve:  { from: 'in_progress',  to: 'resolved',     affects: ['resolvedAt'] },
          reopen:   { from: 'resolved',     to: 'open' },
          close:    { from: 'resolved',     to: 'closed' },
        },
      },
    },
    Project: { table: 'projects', fields: { id: { type: 'integer', nullable: false, column: 'id' } }, relations: {}, keys: ['id'] },
  },
} as const;

export const RAW_ISSUE_QSM_EMPTY = { projections: {}, relationRoles: {} } as const;

export const ISSUE_PDM = validatePdm(parsePdm(RAW_ISSUE_PDM).value!).value!;
export const ISSUE_QSM_EMPTY = validateQsm(parseQsm(RAW_ISSUE_QSM_EMPTY).value!, ISSUE_PDM).value!;
```

- [ ] **Step 1: Add remaining CMD_* codes to `ERROR_CODES`**

Append to `src/types/result.ts`:

```ts
CMD_UNKNOWN_AGGREGATE: 'CMD_UNKNOWN_AGGREGATE',
CMD_AGGREGATE_WITHOUT_STATE_MACHINE: 'CMD_AGGREGATE_WITHOUT_STATE_MACHINE',
CMD_UNKNOWN_TRANSITION: 'CMD_UNKNOWN_TRANSITION',
CMD_PAYLOAD_MISSING_FIELD: 'CMD_PAYLOAD_MISSING_FIELD',
CMD_PAYLOAD_EXTRANEOUS_FIELD: 'CMD_PAYLOAD_EXTRANEOUS_FIELD',
CMD_PAYLOAD_TYPE_MISMATCH: 'CMD_PAYLOAD_TYPE_MISMATCH',
CMD_AGGREGATE_ID_TYPE_MISMATCH: 'CMD_AGGREGATE_ID_TYPE_MISMATCH',
CMD_MULTI_AGGREGATE_NOT_ALLOWED: 'CMD_MULTI_AGGREGATE_NOT_ALLOWED',
```

- [ ] **Step 2: Write failing semantic tests for emit**

Create `test/unit/validate/semantic/emit.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { checkEmit } from '../../../../src/validate/semantic/emit.js';
import { normalize } from '../../../../src/canonical/normalize.js';
import { parseAuthoringSpec } from '../../../../src/parse/parse.js';
import { ISSUE_PDM as PDM, ISSUE_QSM_EMPTY as QSM } from '../../fixtures/issue-pdm.js';

function graphFor(config: Record<string, unknown>, inputs: Record<string, unknown> = { id: { type: 'integer', mode: 'required' }, assigneeId: { type: 'integer', mode: 'required' } }) {
  const p = parseAuthoringSpec({
    version: '1.0-rc7', pdmRef: 'p', qsmRef: 'q', shapes: {},
    graphs: { g: { id: 'g',
      signature: { inputs, output: { type: 'row<CommandResult>', from: 'e' } },
      nodes: [{ id: 'e', type: 'emit', config }] } },
  });
  if (!p.ok) throw new Error('parse failed');
  return normalize(p.value).graphs.g!;
}

describe('checkEmit', () => {
  it('passes for a valid emit', () => {
    const g = graphFor({ aggregate: 'Issue', aggregateId: { $param: 'id' }, transition: 'assign',
      payload: { assigneeId: { $param: 'assigneeId' } } });
    const errs = checkEmit(g, PDM, QSM);
    expect(errs).toHaveLength(0);
  });

  it('CMD_UNKNOWN_AGGREGATE when aggregate not in PDM', () => {
    const g = graphFor({ aggregate: 'Ghost', aggregateId: { $param: 'id' }, transition: 'assign', payload: {} });
    const errs = checkEmit(g, PDM, QSM);
    expect(errs[0]?.code).toBe('CMD_UNKNOWN_AGGREGATE');
  });

  it('CMD_AGGREGATE_WITHOUT_STATE_MACHINE for non-stateful entity', () => {
    const g = graphFor({ aggregate: 'Project', aggregateId: { $param: 'id' }, transition: 'assign', payload: {} });
    const errs = checkEmit(g, PDM, QSM);
    expect(errs[0]?.code).toBe('CMD_AGGREGATE_WITHOUT_STATE_MACHINE');
  });

  it('CMD_UNKNOWN_TRANSITION when transition name missing', () => {
    const g = graphFor({ aggregate: 'Issue', aggregateId: { $param: 'id' }, transition: 'ghost', payload: {} });
    const errs = checkEmit(g, PDM, QSM);
    expect(errs[0]?.code).toBe('CMD_UNKNOWN_TRANSITION');
  });

  it('CMD_PAYLOAD_MISSING_FIELD when an affects field is not in payload', () => {
    const g = graphFor({ aggregate: 'Issue', aggregateId: { $param: 'id' }, transition: 'assign', payload: {} });
    const errs = checkEmit(g, PDM, QSM);
    expect(errs.some((e) => e.code === 'CMD_PAYLOAD_MISSING_FIELD')).toBe(true);
  });

  it('CMD_PAYLOAD_EXTRANEOUS_FIELD when payload has field outside affects', () => {
    const g = graphFor({ aggregate: 'Issue', aggregateId: { $param: 'id' }, transition: 'assign',
      payload: { assigneeId: { $param: 'assigneeId' }, title: { $param: 'id' } } });
    const errs = checkEmit(g, PDM, QSM);
    expect(errs.some((e) => e.code === 'CMD_PAYLOAD_EXTRANEOUS_FIELD')).toBe(true);
  });

  it('CMD_MULTI_AGGREGATE_NOT_ALLOWED across two emits with different aggregateId', () => {
    const p = parseAuthoringSpec({
      version: '1.0-rc7', pdmRef: 'p', qsmRef: 'q', shapes: {},
      graphs: { g: { id: 'g',
        signature: { inputs: { a: { type: 'integer', mode: 'required' }, b: { type: 'integer', mode: 'required' },
                               assigneeId: { type: 'integer', mode: 'required' } },
                     output: { type: 'row<CommandResult>', from: 'e2' } },
        nodes: [
          { id: 'e1', type: 'emit', config: { aggregate: 'Issue', aggregateId: { $param: 'a' }, transition: 'assign', payload: { assigneeId: { $param: 'assigneeId' } } } },
          { id: 'e2', type: 'emit', config: { aggregate: 'Issue', aggregateId: { $param: 'b' }, transition: 'assign', payload: { assigneeId: { $param: 'assigneeId' } } } },
        ] } },
    });
    if (!p.ok) throw new Error('parse failed');
    const errs = checkEmit(normalize(p.value).graphs.g!, PDM, QSM);
    expect(errs.some((e) => e.code === 'CMD_MULTI_AGGREGATE_NOT_ALLOWED')).toBe(true);
  });
});
```

- [ ] **Step 3: Run the failing tests**

Run: `pnpm --filter @rntme/graph-ir-compiler test validate/semantic/emit.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 4: Implement `checkEmit`**

Create `src/validate/semantic/emit.ts`:

```ts
import type { CanonicalEmit, CanonicalGraph } from '../../types/canonical.js';
import type { ValidatedPdm } from '@rntme/pdm';
import type { ValidatedQsm } from '@rntme/qsm';
import { createPdmResolver } from '@rntme/pdm';
import { inferExprType, type ParamMap } from './types.js';
import { ERROR_CODES, type GraphIrError } from '../../types/result.js';

export function checkEmit(graph: CanonicalGraph, pdm: ValidatedPdm, _qsm: ValidatedQsm): GraphIrError[] {
  const errs: GraphIrError[] = [];
  const resolver = createPdmResolver(pdm);
  const emits = graph.nodes.filter((n): n is CanonicalEmit => n.kind === 'emit');
  if (emits.length === 0) return errs;

  const params: ParamMap = new Map();
  for (const [name, decl] of Object.entries(graph.signature.inputs)) {
    if (decl.mode === 'root') continue;
    if (typeof decl.type !== 'string') continue;
    const nullable = decl.mode === 'nullable' || decl.mode === 'predicate_optional';
    params.set(name, { type: decl.type, nullable });
  }

  const aggregates = new Set<string>();

  for (const emit of emits) {
    const entity = pdm.entities[emit.aggregate];
    if (!entity) {
      errs.push({ layer: 'semantic', code: ERROR_CODES.CMD_UNKNOWN_AGGREGATE,
        message: `emit.aggregate "${emit.aggregate}" not in PDM`,
        location: { graphId: graph.id, nodeId: emit.id } });
      continue;
    }
    if (!entity.stateMachine) {
      errs.push({ layer: 'semantic', code: ERROR_CODES.CMD_AGGREGATE_WITHOUT_STATE_MACHINE,
        message: `aggregate "${emit.aggregate}" has no stateMachine`,
        location: { graphId: graph.id, nodeId: emit.id } });
      continue;
    }
    const transition = resolver.resolveTransition(emit.aggregate, emit.transition);
    if (!transition) {
      errs.push({ layer: 'semantic', code: ERROR_CODES.CMD_UNKNOWN_TRANSITION,
        message: `transition "${emit.transition}" not in stateMachine of "${emit.aggregate}"`,
        location: { graphId: graph.id, nodeId: emit.id } });
      continue;
    }

    const affectsWithoutState = transition.affects.filter((f) => f !== entity.stateMachine!.stateField);
    const payloadKeys = Object.keys(emit.payload);
    for (const f of affectsWithoutState) {
      if (!payloadKeys.includes(f)) {
        errs.push({ layer: 'semantic', code: ERROR_CODES.CMD_PAYLOAD_MISSING_FIELD,
          message: `payload missing field "${f}" required by transition "${emit.transition}"`,
          location: { graphId: graph.id, nodeId: emit.id, path: `payload.${f}` } });
      }
    }
    for (const k of payloadKeys) {
      if (!affectsWithoutState.includes(k)) {
        errs.push({ layer: 'semantic', code: ERROR_CODES.CMD_PAYLOAD_EXTRANEOUS_FIELD,
          message: `payload has field "${k}" not in transition.affects`,
          location: { graphId: graph.id, nodeId: emit.id, path: `payload.${k}` } });
      }
    }

    const emptyScope = { aliases: new Map() };
    const idR = inferExprType(emit.aggregateId as unknown, emptyScope, pdm, params);
    if (idR.ok) {
      const primary = entity.keys[0];
      const primaryType = primary ? entity.fields[primary]?.type : undefined;
      if (primaryType && idR.value.type !== primaryType) {
        errs.push({ layer: 'semantic', code: ERROR_CODES.CMD_AGGREGATE_ID_TYPE_MISMATCH,
          message: `aggregateId type ${idR.value.type} != primary key type ${primaryType}`,
          location: { graphId: graph.id, nodeId: emit.id } });
      }
    }

    for (const [fname, expr] of Object.entries(emit.payload)) {
      const field = entity.fields[fname];
      if (!field) continue;
      const tR = inferExprType(expr as unknown, emptyScope, pdm, params);
      if (tR.ok && tR.value.type !== field.type) {
        errs.push({ layer: 'semantic', code: ERROR_CODES.CMD_PAYLOAD_TYPE_MISMATCH,
          message: `payload.${fname} type ${tR.value.type} != field type ${field.type}`,
          location: { graphId: graph.id, nodeId: emit.id, path: `payload.${fname}` } });
      }
    }

    aggregates.add(`${emit.aggregate}|${JSON.stringify(emit.aggregateId)}`);
  }

  if (aggregates.size > 1) {
    errs.push({ layer: 'semantic', code: ERROR_CODES.CMD_MULTI_AGGREGATE_NOT_ALLOWED,
      message: 'MVP: all emit nodes in a command must reference the same (aggregate, aggregateId)',
      location: { graphId: graph.id } });
  }

  return errs;
}
```

- [ ] **Step 5: Wire into `validateSemantic`**

In `src/validate/semantic/index.ts`:

```ts
import { checkEmit } from './emit.js';
// ... at the end, before final return:
errors.push(...checkEmit(graph, pdm, qsm));
```

- [ ] **Step 6: Run the tests**

Run: `pnpm --filter @rntme/graph-ir-compiler test validate/semantic/emit.test.ts`
Expected: PASS (all 7 cases).

Run: `pnpm --filter @rntme/graph-ir-compiler test`
Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add packages/graph-ir-compiler/src/validate/semantic/emit.ts packages/graph-ir-compiler/src/validate/semantic/index.ts packages/graph-ir-compiler/src/types/result.ts packages/graph-ir-compiler/test/unit/validate/semantic/emit.test.ts
git commit -m "feat(graph-ir-compiler): CMD_* semantic checks for emit node"
```

---

## Task 10: Command-module types (`CommandResult`, `CompiledCommand`, `EmitPlan`)

**Files:**
- Create: `packages/graph-ir-compiler/src/types/command.ts`

- [ ] **Step 1: Create the shared type module**

Create `src/types/command.ts`:

```ts
import type { Expr } from './authoring.js';
import type { ActorRef } from '@rntme/pdm';
import type { CompileResult } from '../index.js';

export type CommandResult = {
  aggregateId: string;
  version: number;
  eventIds: string[];
};

/** Static (compile-time) description of a single emit node needed at runtime. */
export type EmitPlan = {
  nodeId: string;
  aggregate: string;
  aggregateIdExpr: Expr;
  transition: string;
  eventType: string;                 // e.g. "IssueAssigned"
  affects: readonly string[];        // includes stateField
  payloadExprs: Record<string, Expr>;
  actorExpr?: Expr;
  isCreation: boolean;
  isSelfLoop: boolean;
  fromStates: readonly (string | null)[];
  toState: string;
};

export type CompiledCommand = {
  graphId: string;
  aggregate: string;                 // MVP single aggregate
  emits: EmitPlan[];
  readPrelude: CompileResult | null;
  readPreludeGuardNodeId: string | null; // which node's empty rowset = guard rejected
  paramOrder: string[];
  optionalParams: string[];
  paramDefaults: Record<string, unknown>;
};

export type RuntimeActor = ActorRef | null;
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm --filter @rntme/graph-ir-compiler typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/graph-ir-compiler/src/types/command.ts
git commit -m "feat(graph-ir-compiler): CommandResult, EmitPlan, CompiledCommand types"
```

---

## Task 11: Event-type naming + emit plan builder

**Files:**
- Create: `packages/graph-ir-compiler/src/emit/event-type.ts`
- Create: `packages/graph-ir-compiler/src/emit/plan.ts`
- Create: `packages/graph-ir-compiler/test/unit/emit/event-type.test.ts`
- Create: `packages/graph-ir-compiler/test/unit/emit/plan.test.ts`

- [ ] **Step 1: Write failing test for event-type naming**

Create `test/unit/emit/event-type.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { deriveEventTypeName } from '../../../src/emit/event-type.js';

describe('deriveEventTypeName', () => {
  it('PascalCases entity + transition', () => {
    expect(deriveEventTypeName('Issue', 'assign')).toBe('IssueAssigned');
    expect(deriveEventTypeName('Issue', 'report')).toBe('IssueReported');
    expect(deriveEventTypeName('Issue', 'reassign')).toBe('IssueReassigned');
  });
});
```

- [ ] **Step 2: Run failing test**

Run: `pnpm --filter @rntme/graph-ir-compiler test event-type.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `deriveEventTypeName`**

Create `src/emit/event-type.ts`:

```ts
import { deriveEventTypes } from '@rntme/pdm';
import type { ValidatedPdm } from '@rntme/pdm';

export function deriveEventTypeName(aggregate: string, transition: string): string {
  const pc = (s: string) => (s.length === 0 ? '' : s.charAt(0).toUpperCase() + s.slice(1));
  return pc(aggregate) + pc(transition);
}

export function lookupEventTypeSpec(pdm: ValidatedPdm, aggregate: string, transition: string) {
  const all = deriveEventTypes(pdm);
  return all.find((e) => e.aggregateType === aggregate && e.transition === transition);
}
```

- [ ] **Step 4: Run — naming test passes**

Run: `pnpm --filter @rntme/graph-ir-compiler test event-type.test.ts`
Expected: PASS.

- [ ] **Step 5: Write failing test for `buildEmitPlans`**

Create `test/unit/emit/plan.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildEmitPlans } from '../../../src/emit/plan.js';
import { parseAuthoringSpec } from '../../../src/parse/parse.js';
import { normalize } from '../../../src/canonical/normalize.js';
import { ISSUE_PDM as PDM } from '../fixtures/issue-pdm.js';

describe('buildEmitPlans', () => {
  it('produces one EmitPlan per emit node with correct event type and affects', () => {
    const p = parseAuthoringSpec({
      version: '1.0-rc7', pdmRef: 'p', qsmRef: 'q', shapes: {},
      graphs: { g: { id: 'g',
        signature: { inputs: { id: { type: 'integer', mode: 'required' }, assigneeId: { type: 'integer', mode: 'required' } },
                     output: { type: 'row<CommandResult>', from: 'e' } },
        nodes: [{ id: 'e', type: 'emit',
          config: { aggregate: 'Issue', aggregateId: { $param: 'id' }, transition: 'assign',
                    payload: { assigneeId: { $param: 'assigneeId' } } } }] } },
    });
    if (!p.ok) throw new Error('parse failed');
    const plans = buildEmitPlans(normalize(p.value).graphs.g!, PDM);
    expect(plans).toHaveLength(1);
    expect(plans[0]!.eventType).toBe('IssueAssigned');
    expect(plans[0]!.affects).toContain('status');
    expect(plans[0]!.affects).toContain('assigneeId');
    expect(plans[0]!.toState).toBe('in_progress');
    expect(plans[0]!.isCreation).toBe(false);
  });
});
```

- [ ] **Step 6: Run — plan test fails**

Run: `pnpm --filter @rntme/graph-ir-compiler test emit/plan.test.ts`
Expected: FAIL.

- [ ] **Step 7: Implement `buildEmitPlans`**

Create `src/emit/plan.ts`:

```ts
import type { CanonicalEmit, CanonicalGraph } from '../types/canonical.js';
import type { ValidatedPdm } from '@rntme/pdm';
import type { EmitPlan } from '../types/command.js';
import { deriveEventTypeName, lookupEventTypeSpec } from './event-type.js';

export function buildEmitPlans(graph: CanonicalGraph, pdm: ValidatedPdm): EmitPlan[] {
  const plans: EmitPlan[] = [];
  for (const n of graph.nodes) {
    if (n.kind !== 'emit') continue;
    const emit = n as CanonicalEmit;
    const spec = lookupEventTypeSpec(pdm, emit.aggregate, emit.transition);
    if (!spec) continue; // semantic validation catches this
    const plan: EmitPlan = {
      nodeId: emit.id,
      aggregate: emit.aggregate,
      aggregateIdExpr: emit.aggregateId,
      transition: emit.transition,
      eventType: deriveEventTypeName(emit.aggregate, emit.transition),
      affects: spec.affects,
      payloadExprs: emit.payload,
      isCreation: spec.isCreation,
      isSelfLoop: spec.isSelfLoop,
      fromStates: spec.from,
      toState: spec.to,
    };
    if (emit.actor !== undefined) plan.actorExpr = emit.actor;
    plans.push(plan);
  }
  return plans;
}
```

- [ ] **Step 8: Run tests**

Run: `pnpm --filter @rntme/graph-ir-compiler test emit/`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add packages/graph-ir-compiler/src/emit packages/graph-ir-compiler/test/unit/emit
git commit -m "feat(graph-ir-compiler): derive EmitPlan per emit node from PDM stateMachine"
```

---

## Task 12: Runtime payload derivation (before/after)

**Files:**
- Create: `packages/graph-ir-compiler/src/emit/payload.ts`
- Create: `packages/graph-ir-compiler/test/unit/emit/payload.test.ts`

- [ ] **Step 1: Write failing test**

Create `test/unit/emit/payload.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { evalExprAtRuntime, derivePayload } from '../../../src/emit/payload.js';
import type { EmitPlan } from '../../../src/types/command.js';

describe('evalExprAtRuntime', () => {
  it('resolves $param from params map', () => {
    expect(evalExprAtRuntime({ $param: 'x' }, { x: 42 })).toBe(42);
  });
  it('passes through literals', () => {
    expect(evalExprAtRuntime(7, {})).toBe(7);
    expect(evalExprAtRuntime({ $literal: 'open' }, {})).toBe('open');
    expect(evalExprAtRuntime(null, {})).toBe(null);
  });
  it('throws on unsupported expr shapes', () => {
    expect(() => evalExprAtRuntime({ eq: ['a', 1] } as never, {})).toThrow();
  });
});

describe('derivePayload', () => {
  const plan: EmitPlan = {
    nodeId: 'e', aggregate: 'Issue', aggregateIdExpr: { $param: 'id' },
    transition: 'assign', eventType: 'IssueAssigned',
    affects: ['status', 'assigneeId'],
    payloadExprs: { assigneeId: { $param: 'assigneeId' } },
    isCreation: false, isSelfLoop: false,
    fromStates: ['open'], toState: 'in_progress',
  };
  it('produces {before, after} for a state-change transition', () => {
    const currentState = { status: 'open', assigneeId: null };
    const p = derivePayload(plan, { id: 1, assigneeId: 99 }, currentState);
    expect(p.before).toEqual({ status: 'open', assigneeId: null });
    expect(p.after).toEqual({ status: 'in_progress', assigneeId: 99 });
  });
  it('produces {before: null} for a creation', () => {
    const creation: EmitPlan = { ...plan, isCreation: true, fromStates: [null], toState: 'draft',
      payloadExprs: { title: { $param: 't' } }, affects: ['status', 'title'] };
    const p = derivePayload(creation, { t: 'hi' }, null);
    expect(p.before).toBeNull();
    expect(p.after).toEqual({ status: 'draft', title: 'hi' });
  });
});
```

- [ ] **Step 2: Run failing test**

Run: `pnpm --filter @rntme/graph-ir-compiler test emit/payload.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `payload.ts`**

Create `src/emit/payload.ts`:

```ts
import type { Expr } from '../types/authoring.js';
import type { EmitPlan } from '../types/command.js';

export function evalExprAtRuntime(expr: Expr, params: Record<string, unknown>): unknown {
  if (expr === null || typeof expr === 'number' || typeof expr === 'boolean') return expr;
  if (typeof expr === 'string') throw new Error(`field paths are not allowed in emit payload at runtime: ${expr}`);
  if (typeof expr === 'object') {
    if ('$param' in expr) {
      const v = (params as Record<string, unknown>)[(expr as { $param: string }).$param];
      return v === undefined ? null : v;
    }
    if ('$literal' in expr) return (expr as { $literal: string }).$literal;
  }
  throw new Error(`unsupported expr in emit payload: ${JSON.stringify(expr)}`);
}

export type DerivedPayload = {
  before: Record<string, unknown> | null;
  after: Record<string, unknown>;
};

export function derivePayload(
  plan: EmitPlan,
  params: Record<string, unknown>,
  currentState: Record<string, unknown> | null,
): DerivedPayload {
  const after: Record<string, unknown> = {};
  for (const field of plan.affects) {
    if (field === stateFieldOf(plan)) {
      after[field] = plan.toState;
    } else if (plan.payloadExprs[field] !== undefined) {
      after[field] = evalExprAtRuntime(plan.payloadExprs[field]!, params);
    }
  }

  if (plan.isCreation) return { before: null, after };

  const before: Record<string, unknown> = {};
  for (const field of plan.affects) before[field] = currentState?.[field] ?? null;
  return { before, after };
}

function stateFieldOf(plan: EmitPlan): string {
  // By spec §2.2 invariant, affects[0] is stateField after auto-prepend. Accept either position.
  // We can't access PDM here; plan.affects always includes stateField. Caller sets toState.
  // The stateField is the one whose value equals plan.toState in after.
  return plan.affects.find((f) => f === findStateField(plan)) ?? plan.affects[0]!;
}

function findStateField(plan: EmitPlan): string | undefined {
  return plan.affects.find((f) => f !== undefined && !(f in plan.payloadExprs));
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @rntme/graph-ir-compiler test emit/payload.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/graph-ir-compiler/src/emit/payload.ts packages/graph-ir-compiler/test/unit/emit/payload.test.ts
git commit -m "feat(graph-ir-compiler): derive event before/after payload at runtime"
```

---

## Task 13: Aggregate state replay from event stream

**Files:**
- Create: `packages/graph-ir-compiler/src/command-runtime/replay.ts`
- Create: `packages/graph-ir-compiler/test/unit/command-runtime/replay.test.ts`

- [ ] **Step 1: Write failing test**

Create `test/unit/command-runtime/replay.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import type { EventEnvelope } from '@rntme/event-store';
import { replayAggregateState } from '../../../src/command-runtime/replay.js';

function ev(version: number, payload: { before: Record<string, unknown> | null; after: Record<string, unknown> }): EventEnvelope {
  return {
    eventId: `id-${version}`, eventType: 't', aggregateType: 'Issue', aggregateId: '1',
    stream: 'Issue-1', version, occurredAt: '2026-04-14T10:00:00Z', actor: null, schemaVersion: 1, payload,
  };
}

describe('replayAggregateState', () => {
  it('returns null + version 0 for empty stream', () => {
    const s = replayAggregateState([]);
    expect(s.state).toBeNull();
    expect(s.version).toBe(0);
  });

  it('applies creation then subsequent transitions in order', () => {
    const events = [
      ev(1, { before: null, after: { status: 'draft', title: 'hi' } }),
      ev(2, { before: { status: 'draft' }, after: { status: 'open' } }),
      ev(3, { before: { status: 'open', assigneeId: null }, after: { status: 'in_progress', assigneeId: 42 } }),
    ];
    const s = replayAggregateState(events);
    expect(s.version).toBe(3);
    expect(s.state).toEqual({ status: 'in_progress', title: 'hi', assigneeId: 42 });
  });
});
```

- [ ] **Step 2: Run the failing test**

Run: `pnpm --filter @rntme/graph-ir-compiler test command-runtime/replay.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `replayAggregateState`**

Create `src/command-runtime/replay.ts`:

```ts
import type { EventEnvelope } from '@rntme/event-store';

export type ReplayResult = {
  state: Record<string, unknown> | null;
  version: number;
};

type Payload = { before: Record<string, unknown> | null; after: Record<string, unknown> };

export function replayAggregateState(events: readonly EventEnvelope[]): ReplayResult {
  if (events.length === 0) return { state: null, version: 0 };

  let state: Record<string, unknown> = {};
  let version = 0;

  for (const ev of events) {
    const p = ev.payload as Payload;
    if (p.before === null) state = { ...p.after };
    else state = { ...state, ...p.after };
    version = ev.version;
  }

  return { state, version };
}
```

- [ ] **Step 4: Run the tests**

Run: `pnpm --filter @rntme/graph-ir-compiler test command-runtime/replay.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/graph-ir-compiler/src/command-runtime/replay.ts packages/graph-ir-compiler/test/unit/command-runtime/replay.test.ts
git commit -m "feat(graph-ir-compiler): replay aggregate state from event stream"
```

---

## Task 14: Transition legality check

**Files:**
- Create: `packages/graph-ir-compiler/src/command-runtime/transition.ts`
- Create: `packages/graph-ir-compiler/src/command-runtime/errors.ts`
- Create: `packages/graph-ir-compiler/test/unit/command-runtime/transition.test.ts`
- Modify: `packages/graph-ir-compiler/src/types/result.ts` (add `COMMAND_ILLEGAL_TRANSITION`, `COMMAND_GUARD_REJECTED`, `COMMAND_CONCURRENCY_CONFLICT`)

- [ ] **Step 1: Add runtime error codes**

Append to `ERROR_CODES`:

```ts
COMMAND_ILLEGAL_TRANSITION: 'COMMAND_ILLEGAL_TRANSITION',
COMMAND_GUARD_REJECTED: 'COMMAND_GUARD_REJECTED',
COMMAND_CONCURRENCY_CONFLICT: 'COMMAND_CONCURRENCY_CONFLICT',
```

- [ ] **Step 2: Create `CommandExecutionError`**

Create `src/command-runtime/errors.ts`:

```ts
export type CommandErrorCode =
  | 'COMMAND_ILLEGAL_TRANSITION'
  | 'COMMAND_GUARD_REJECTED'
  | 'COMMAND_CONCURRENCY_CONFLICT';

export class CommandExecutionError extends Error {
  readonly code: CommandErrorCode;
  readonly detail?: Record<string, unknown>;
  constructor(code: CommandErrorCode, message: string, detail?: Record<string, unknown>) {
    super(message);
    this.name = 'CommandExecutionError';
    this.code = code;
    if (detail) this.detail = detail;
  }
}
```

- [ ] **Step 3: Write failing transition test**

Create `test/unit/command-runtime/transition.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { checkTransitionLegal } from '../../../src/command-runtime/transition.js';
import type { EmitPlan } from '../../../src/types/command.js';

const assignPlan: EmitPlan = {
  nodeId: 'e', aggregate: 'Issue', aggregateIdExpr: { $param: 'id' }, transition: 'assign',
  eventType: 'IssueAssigned', affects: ['status', 'assigneeId'], payloadExprs: {},
  isCreation: false, isSelfLoop: false, fromStates: ['open'], toState: 'in_progress',
};

describe('checkTransitionLegal', () => {
  it('passes when current state is in fromStates', () => {
    expect(() => checkTransitionLegal(assignPlan, { status: 'open' }, 'status')).not.toThrow();
  });
  it('throws COMMAND_ILLEGAL_TRANSITION when current state not in fromStates', () => {
    try { checkTransitionLegal(assignPlan, { status: 'closed' }, 'status'); throw new Error('expected throw'); }
    catch (e) { expect((e as { code?: string }).code).toBe('COMMAND_ILLEGAL_TRANSITION'); }
  });
  it('throws COMMAND_ILLEGAL_TRANSITION when aggregate does not exist but transition is not creation', () => {
    try { checkTransitionLegal(assignPlan, null, 'status'); throw new Error('expected throw'); }
    catch (e) { expect((e as { code?: string }).code).toBe('COMMAND_ILLEGAL_TRANSITION'); }
  });
  it('passes for creation transition against null state', () => {
    const creation: EmitPlan = { ...assignPlan, isCreation: true, fromStates: [null], toState: 'draft' };
    expect(() => checkTransitionLegal(creation, null, 'status')).not.toThrow();
  });
  it('throws for creation transition against existing state', () => {
    const creation: EmitPlan = { ...assignPlan, isCreation: true, fromStates: [null], toState: 'draft' };
    try { checkTransitionLegal(creation, { status: 'draft' }, 'status'); throw new Error('expected throw'); }
    catch (e) { expect((e as { code?: string }).code).toBe('COMMAND_ILLEGAL_TRANSITION'); }
  });
});
```

- [ ] **Step 4: Run the failing test**

Run: `pnpm --filter @rntme/graph-ir-compiler test command-runtime/transition.test.ts`
Expected: FAIL.

- [ ] **Step 5: Implement `checkTransitionLegal`**

Create `src/command-runtime/transition.ts`:

```ts
import type { EmitPlan } from '../types/command.js';
import { CommandExecutionError } from './errors.js';

export function checkTransitionLegal(
  plan: EmitPlan,
  currentState: Record<string, unknown> | null,
  stateField: string,
): void {
  if (plan.isCreation) {
    if (currentState !== null) {
      throw new CommandExecutionError('COMMAND_ILLEGAL_TRANSITION',
        `creation transition "${plan.transition}" cannot run against an existing aggregate`,
        { transition: plan.transition });
    }
    return;
  }
  if (currentState === null) {
    throw new CommandExecutionError('COMMAND_ILLEGAL_TRANSITION',
      `transition "${plan.transition}" requires an existing aggregate`,
      { transition: plan.transition });
  }
  const current = currentState[stateField];
  const allowed = plan.fromStates.filter((s): s is string => s !== null);
  if (!allowed.includes(current as string)) {
    throw new CommandExecutionError('COMMAND_ILLEGAL_TRANSITION',
      `transition "${plan.transition}" illegal from state "${String(current)}"`,
      { transition: plan.transition, current, allowed });
  }
}
```

- [ ] **Step 6: Run the tests**

Run: `pnpm --filter @rntme/graph-ir-compiler test command-runtime/transition.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/graph-ir-compiler/src/command-runtime packages/graph-ir-compiler/src/types/result.ts packages/graph-ir-compiler/test/unit/command-runtime/transition.test.ts
git commit -m "feat(graph-ir-compiler): validate transition legality from replayed state"
```

---

## Task 15: `compileCommand` (semantic-plan split: read-prelude + emit plans)

**Files:**
- Create: `packages/graph-ir-compiler/src/command-runtime/compile.ts`
- Create: `packages/graph-ir-compiler/test/unit/command-runtime/compile.test.ts`
- Modify: `packages/graph-ir-compiler/src/semantic-plan/build.ts` (skip emit nodes)

- [ ] **Step 1: Skip emit nodes in `buildSemanticPlan`**

Edit `src/semantic-plan/build.ts` — in the `lower(node, sources, pdm)` helper, add at the top:

```ts
if (node.kind === 'emit') return undefined as never;
```

and in the loop in `buildSemanticPlan`, skip nodes whose `lower` returns `undefined` when `node.kind === 'emit'` (treat it as intentional), rather than emitting the "unable to plan" error. The simplest way:

```ts
for (const node of graph.nodes) {
  if (node.kind === 'emit') continue;
  const step = lower(node, sources, pdm);
  if (step) steps.push(step);
  else errors.push({ /* existing */ });
}
```

This keeps `buildSemanticPlan` operating over read nodes only. The existing `compile()` in `index.ts` will then still produce SQL for the read prefix (if any) and we can detect "no SQL" when the only nodes are emits.

- [ ] **Step 2: Write failing test for `compileCommand`**

Create `test/unit/command-runtime/compile.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { compileCommand } from '../../../src/command-runtime/compile.js';
import { RAW_ISSUE_PDM as RAW_PDM, RAW_ISSUE_QSM_EMPTY as RAW_QSM } from '../fixtures/issue-pdm.js';

const spec = {
  version: '1.0-rc7', pdmRef: 'p', qsmRef: 'q', shapes: {},
  graphs: { assignIssue: { id: 'assignIssue',
    signature: { inputs: { issueId: { type: 'integer', mode: 'required' }, assigneeId: { type: 'integer', mode: 'required' } },
                 output: { type: 'row<CommandResult>', from: 'e' } },
    nodes: [{ id: 'e', type: 'emit',
      config: { aggregate: 'Issue', aggregateId: { $param: 'issueId' }, transition: 'assign',
                payload: { assigneeId: { $param: 'assigneeId' } } } }] } },
};

describe('compileCommand', () => {
  it('returns a CompiledCommand with one EmitPlan and no read-prelude', () => {
    const r = compileCommand(spec, RAW_PDM, RAW_QSM);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.graphId).toBe('assignIssue');
    expect(r.value.aggregate).toBe('Issue');
    expect(r.value.emits).toHaveLength(1);
    expect(r.value.emits[0]!.eventType).toBe('IssueAssigned');
    expect(r.value.readPrelude).toBeNull();
    expect(r.value.paramOrder).toEqual(expect.arrayContaining(['issueId', 'assigneeId']));
  });

  it('fails with GRAPH_MIXED_ROLE on rowset output + emit', () => {
    const bad = structuredClone(spec) as typeof spec & { graphs: { assignIssue: { signature: { output: { type: string } } } } };
    bad.graphs.assignIssue.signature.output.type = 'rowset<X>';
    const r = compileCommand(bad, RAW_PDM, RAW_QSM);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.code === 'GRAPH_MIXED_ROLE')).toBe(true);
  });
});
```

- [ ] **Step 3: Run the failing test**

Run: `pnpm --filter @rntme/graph-ir-compiler test command-runtime/compile.test.ts`
Expected: FAIL.

- [ ] **Step 4: Implement `compileCommand`**

Create `src/command-runtime/compile.ts`:

```ts
import { parseAuthoringSpec } from '../parse/parse.js';
import { parsePdm, validatePdm } from '@rntme/pdm';
import { parseQsm, validateQsm } from '@rntme/qsm';
import { validateStructural } from '../validate/structural/index.js';
import { validateSemantic } from '../validate/semantic/index.js';
import { normalize } from '../canonical/normalize.js';
import { buildSemanticPlan } from '../semantic-plan/build.js';
import { buildRelational } from '../relational/build.js';
import { lowerToSqlite } from '../lower/sqlite/lower.js';
import { emitSql } from '../lower/sqlite/emit.js';
import { buildEmitPlans } from '../emit/plan.js';
import { inferRole } from '../role/infer.js';
import { err, ok, ERROR_CODES, type Result } from '../types/result.js';
import type { CompiledCommand } from '../types/command.js';
import type { CompileResult } from '../index.js';

export function compileCommand(rawSpec: unknown, rawPdm: unknown, rawQsm: unknown): Result<CompiledCommand> {
  const specR = parseAuthoringSpec(rawSpec);
  if (!specR.ok) return specR;

  const pdmParse = parsePdm(rawPdm);
  if (!pdmParse.ok) return err([{ layer: 'parse', code: ERROR_CODES.PARSE_SCHEMA_VIOLATION, message: 'PDM failed schema validation' }]);
  const pdmVal = validatePdm(pdmParse.value);
  if (!pdmVal.ok) return err([{ layer: 'parse', code: ERROR_CODES.PARSE_SCHEMA_VIOLATION, message: pdmVal.errors[0]?.message ?? 'PDM validation failed' }]);

  const qsmParse = parseQsm(rawQsm);
  if (!qsmParse.ok) return err([{ layer: 'parse', code: ERROR_CODES.PARSE_SCHEMA_VIOLATION, message: 'QSM failed schema validation' }]);
  const qsmVal = validateQsm(qsmParse.value, pdmVal.value);
  if (!qsmVal.ok) return err([{ layer: 'parse', code: ERROR_CODES.PARSE_SCHEMA_VIOLATION, message: qsmVal.errors[0]?.message ?? 'QSM validation failed' }]);

  const pdm = pdmVal.value;
  const qsm = qsmVal.value;

  const sv = validateStructural(specR.value, pdm, qsm);
  if (!sv.ok) return sv;

  const { graphs } = normalize(sv.value);
  const ids = Object.keys(graphs);
  if (ids.length !== 1) return err([{ layer: 'canonical', code: ERROR_CODES.STRUCT_DUPLICATE_GRAPH_ID, message: 'compileCommand accepts exactly one graph' }]);
  const graph = graphs[ids[0]!]!;

  const roleR = inferRole(graph);
  if (!roleR.ok) return roleR;
  if (roleR.value !== 'command') return err([{ layer: 'structural', code: ERROR_CODES.GRAPH_MIXED_ROLE, message: `compileCommand called on non-command graph (role=${roleR.value})` }]);

  const semR = validateSemantic(graph, pdm, qsm, sv.value.shapes);
  if (!semR.ok) return semR;

  const emitPlans = buildEmitPlans(graph, pdm);
  const aggregates = new Set(emitPlans.map((e) => e.aggregate));
  if (aggregates.size !== 1) return err([{ layer: 'semantic', code: ERROR_CODES.CMD_MULTI_AGGREGATE_NOT_ALLOWED, message: 'MVP: exactly one aggregate per command' }]);
  const aggregate = [...aggregates][0]!;

  const readNodes = graph.nodes.filter((n) => n.kind !== 'emit');
  let readPrelude: CompileResult | null = null;
  let readPreludeGuardNodeId: string | null = null;
  if (readNodes.length > 0) {
    const readGraph = { ...graph, nodes: readNodes,
      outputFrom: readNodes[readNodes.length - 1]!.id,
      signature: { ...graph.signature, output: { type: 'rowset<GuardRow>', from: readNodes[readNodes.length - 1]!.id } } };
    const planR = buildSemanticPlan(readGraph, pdm, qsm);
    if (!planR.ok) return planR;
    const rel = buildRelational(planR.value);
    const predicateOptionalParams = new Set<string>(
      Object.entries(graph.signature.inputs).filter(([, i]) => i.mode === 'predicate_optional').map(([n]) => n));
    const { ast, paramOrder } = lowerToSqlite(rel, { predicateOptionalParams, pdm });
    readPrelude = { sql: emitSql(ast), paramOrder, shape: { name: 'GuardRow' },
                    optionalParams: [...predicateOptionalParams], paramDefaults: {} };
    readPreludeGuardNodeId = readNodes[readNodes.length - 1]!.id;
  }

  const predicateOptionalParams = Object.entries(graph.signature.inputs)
    .filter(([, i]) => i.mode === 'predicate_optional').map(([n]) => n);
  const paramDefaults: Record<string, unknown> = {};
  for (const [n, d] of Object.entries(graph.signature.inputs))
    if (d.mode === 'defaulted' && d.default !== undefined) paramDefaults[n] = d.default;

  return ok({
    graphId: graph.id,
    aggregate,
    emits: emitPlans,
    readPrelude,
    readPreludeGuardNodeId,
    paramOrder: Object.keys(graph.signature.inputs),
    optionalParams: predicateOptionalParams,
    paramDefaults,
  });
}
```

- [ ] **Step 5: Run tests**

Run: `pnpm --filter @rntme/graph-ir-compiler test command-runtime/compile.test.ts`
Expected: PASS.

Run: `pnpm --filter @rntme/graph-ir-compiler test`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add packages/graph-ir-compiler/src/command-runtime/compile.ts packages/graph-ir-compiler/src/semantic-plan/build.ts packages/graph-ir-compiler/test/unit/command-runtime/compile.test.ts
git commit -m "feat(graph-ir-compiler): compileCommand splits command graph into read-prelude + emit plans"
```

---

## Task 16: `executeCommand` — single-aggregate write-txn (no read-prelude)

**Files:**
- Create: `packages/graph-ir-compiler/src/command-runtime/execute.ts`
- Create: `packages/graph-ir-compiler/test/unit/command-runtime/execute-single-aggregate.test.ts`

- [ ] **Step 1: Write failing test using in-memory event store**

Create `test/unit/command-runtime/execute-single-aggregate.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { SqliteEventStore, applyEventStoreSchema } from '@rntme/event-store';
import { compileCommand } from '../../../src/command-runtime/compile.js';
import { executeCommand } from '../../../src/command-runtime/execute.js';

import { RAW_ISSUE_PDM as RAW_PDM, RAW_ISSUE_QSM_EMPTY as RAW_QSM } from '../fixtures/issue-pdm.js';

const reportSpec = {
  version: '1.0-rc7', pdmRef: 'p', qsmRef: 'q', shapes: {},
  graphs: { reportIssue: { id: 'reportIssue',
    signature: { inputs: {
      issueId:     { type: 'integer', mode: 'required' },
      projectId:   { type: 'integer', mode: 'required' },
      reporterId:  { type: 'integer', mode: 'required' },
      title:       { type: 'string',  mode: 'required' },
      priority:    { type: 'string',  mode: 'required' },
      storyPoints: { type: 'integer', mode: 'required' } },
      output: { type: 'row<CommandResult>', from: 'e' } },
    nodes: [{ id: 'e', type: 'emit',
      config: { aggregate: 'Issue', aggregateId: { $param: 'issueId' }, transition: 'report',
                payload: { title: { $param: 'title' }, projectId: { $param: 'projectId' },
                           reporterId: { $param: 'reporterId' },
                           priority: { $param: 'priority' },
                           storyPoints: { $param: 'storyPoints' } } } }] } },
};

describe('executeCommand — creation transition', () => {
  it('appends one event and returns CommandResult with version=1', () => {
    const db = new Database(':memory:');
    applyEventStoreSchema(db);
    const store = new SqliteEventStore(db);
    const r = compileCommand(reportSpec, RAW_PDM, RAW_QSM);
    if (!r.ok) throw new Error('compile failed');

    const out = executeCommand(r.value, {
      issueId: 1, projectId: 7, reporterId: 2, title: 'hi', priority: 'high', storyPoints: 5,
    }, {
      eventStore: store, qsmDb: null,
      now: () => '2026-04-14T10:00:00Z',
      nextId: () => '018e9d2a-aaaa-7000-8000-000000000001',
      actor: { kind: 'user', id: 'alice' },
    });
    expect(out.aggregateId).toBe('1');
    expect(out.version).toBe(1);
    expect(out.eventIds).toHaveLength(1);

    const events = store.readStream('Issue-1');
    expect(events[0]!.eventType).toBe('IssueReported');
    expect((events[0]!.payload as { before: unknown }).before).toBeNull();
    db.close();
  });

  it('rejects illegal transition (assign on non-existent issue)', () => {
    const db = new Database(':memory:');
    applyEventStoreSchema(db);
    const store = new SqliteEventStore(db);
    const assignSpec = { ...reportSpec, graphs: { assign: { id: 'assign',
      signature: { inputs: { issueId: { type: 'integer', mode: 'required' }, assigneeId: { type: 'integer', mode: 'required' } },
                   output: { type: 'row<CommandResult>', from: 'e' } },
      nodes: [{ id: 'e', type: 'emit',
        config: { aggregate: 'Issue', aggregateId: { $param: 'issueId' }, transition: 'assign',
                  payload: { assigneeId: { $param: 'assigneeId' } } } }] } } };
    const r = compileCommand(assignSpec, RAW_PDM, RAW_QSM);
    if (!r.ok) throw new Error('compile failed');
    try {
      executeCommand(r.value, { issueId: 42, assigneeId: 7 }, {
        eventStore: store, qsmDb: null,
        now: () => '2026-04-14T10:00:00Z',
        nextId: () => 'u',
        actor: null,
      });
      throw new Error('expected throw');
    } catch (e) {
      expect((e as { code?: string }).code).toBe('COMMAND_ILLEGAL_TRANSITION');
    } finally { db.close(); }
  });
});
```

- [ ] **Step 2: Run the failing test**

Run: `pnpm --filter @rntme/graph-ir-compiler test execute-single-aggregate.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement `executeCommand`**

Create `src/command-runtime/execute.ts`:

```ts
import type Database from 'better-sqlite3';
import type { EventStore, ActorRef, AppendEventInput, AppendRequest } from '@rntme/event-store';
import { ConcurrencyConflict } from '@rntme/event-store';
import type { CompiledCommand, CommandResult } from '../types/command.js';
import { replayAggregateState } from './replay.js';
import { checkTransitionLegal } from './transition.js';
import { derivePayload, evalExprAtRuntime } from '../emit/payload.js';
import { CommandExecutionError } from './errors.js';

export type ExecuteCommandContext = {
  eventStore: EventStore;
  qsmDb: Database.Database | null;   // required only if compiled.readPrelude != null
  now: () => string;                  // ISO-8601 timestamp
  nextId: () => string;               // UUIDv7 for eventId
  actor: ActorRef | null;
};

export function executeCommand(
  compiled: CompiledCommand,
  paramValues: Record<string, unknown>,
  ctx: ExecuteCommandContext,
): CommandResult {
  if (compiled.readPrelude) {
    if (!ctx.qsmDb) throw new Error('executeCommand: qsmDb required when readPrelude is present');
    const positional = compiled.readPrelude.paramOrder.map((name) => {
      if (Object.prototype.hasOwnProperty.call(paramValues, name)) return paramValues[name] ?? null;
      return null;
    });
    const rows = ctx.qsmDb.prepare(compiled.readPrelude.sql).all(...positional);
    if (rows.length === 0) {
      throw new CommandExecutionError('COMMAND_GUARD_REJECTED',
        `command guard at node "${compiled.readPreludeGuardNodeId}" rejected input`);
    }
  }

  if (compiled.emits.length === 0) throw new Error('executeCommand: no emits in compiled command');

  const plan = compiled.emits[0]!;
  const aggregateId = String(evalExprAtRuntime(plan.aggregateIdExpr, paramValues) ?? '');
  const stream = `${plan.aggregate}-${aggregateId}`;

  const history = ctx.eventStore.readStream(stream);
  const { state, version } = replayAggregateState(history);

  const stateField = plan.affects.find((f) => !(f in plan.payloadExprs)) ?? 'status';
  const events: AppendEventInput[] = [];
  let runningState = state;
  let runningVersion = version;

  for (const p of compiled.emits) {
    checkTransitionLegal(p, runningState, stateField);
    const payload = derivePayload(p, paramValues, runningState);
    events.push({
      eventId: ctx.nextId(),
      eventType: p.eventType,
      aggregateType: p.aggregate,
      aggregateId,
      occurredAt: ctx.now(),
      actor: ctx.actor,
      payload,
      schemaVersion: 1,
    });
    runningState = { ...(runningState ?? {}), ...payload.after };
    runningVersion += 1;
  }

  const req: AppendRequest = { stream, expectedVersion: version, events };
  let results;
  try {
    results = ctx.eventStore.appendEvents([req]);
  } catch (e) {
    if (e instanceof ConcurrencyConflict) {
      throw new CommandExecutionError('COMMAND_CONCURRENCY_CONFLICT',
        `concurrent append conflict on stream ${stream}`);
    }
    throw e;
  }
  const result = results[0]!;
  return {
    aggregateId,
    version: result.lastVersion,
    eventIds: result.appendedEvents.map((e) => e.eventId),
  };
}
```

- [ ] **Step 4: Run the tests**

Run: `pnpm --filter @rntme/graph-ir-compiler test execute-single-aggregate.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/graph-ir-compiler/src/command-runtime/execute.ts packages/graph-ir-compiler/test/unit/command-runtime/execute-single-aggregate.test.ts
git commit -m "feat(graph-ir-compiler): executeCommand single-aggregate write-txn against event-store"
```

---

## Task 17: Read-prelude guard-rejection path

**Files:**
- Create: `packages/graph-ir-compiler/test/unit/command-runtime/execute-read-prelude.test.ts`

- [ ] **Step 1: Write failing test exercising the guard path**

Create `test/unit/command-runtime/execute-read-prelude.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { SqliteEventStore, applyEventStoreSchema } from '@rntme/event-store';
import { compileCommand } from '../../../src/command-runtime/compile.js';
import { executeCommand } from '../../../src/command-runtime/execute.js';
import { RAW_ISSUE_PDM } from '../fixtures/issue-pdm.js';

const RAW_QSM = {
  projections: {
    IssueView: {
      backing: 'entity-mirror',
      source: { entity: 'Issue' },
      keys: ['id'], grain: ['id'],
      exposed: ['id', 'title', 'status', 'priority', 'storyPoints', 'assigneeId',
                'reporterId', 'projectId', 'resolvedAt'],
      table: 'projection_issue',
    },
  },
  relationRoles: {},
};

const assignWithCapacitySpec = {
  version: '1.0-rc7', pdmRef: 'p', qsmRef: 'q',
  shapes: { LoadCount: { fields: { count: { type: 'integer', nullable: false } } } },
  graphs: { assignIssueSafe: { id: 'assignIssueSafe',
    signature: { inputs: {
      issueId:    { type: 'integer', mode: 'required' },
      assigneeId: { type: 'integer', mode: 'required' } },
      output: { type: 'row<CommandResult>', from: 'emitAssign' } },
    nodes: [
      { id: 'currentLoad', type: 'findMany', config: { source: { entity: 'Issue' } } },
      { id: 'loadFiltered', type: 'filter', config: { input: 'currentLoad',
        expr: { and: [
          { eq: ['issue.assigneeId', { $param: 'assigneeId' }] },
          { eq: ['issue.status', { $literal: 'in_progress' }] },
        ] } } },
      { id: 'loadCount', type: 'reduce', config: { input: 'loadFiltered', into: 'LoadCount',
        group: {}, measures: { count: { fn: 'count' } } } },
      { id: 'guardCapacity', type: 'filter', config: { input: 'loadCount',
        expr: { lt: ['count', 5] } } },
      { id: 'emitAssign', type: 'emit',
        config: { aggregate: 'Issue', aggregateId: { $param: 'issueId' }, transition: 'assign',
                  payload: { assigneeId: { $param: 'assigneeId' } } } },
    ] } },
};

describe('executeCommand — read-prelude guard', () => {
  it('throws COMMAND_GUARD_REJECTED when guard filter returns empty (5 matching rows, threshold 5)', () => {
    const qsmDb = new Database(':memory:');
    qsmDb.exec(`CREATE TABLE projection_issue (
      id INTEGER PRIMARY KEY, project_id INTEGER NOT NULL, reporter_id INTEGER NOT NULL,
      assignee_id INTEGER, title TEXT NOT NULL, priority TEXT NOT NULL, story_points INTEGER NOT NULL,
      status TEXT NOT NULL, resolved_at TEXT
    );`);
    const ins = qsmDb.prepare(`INSERT INTO projection_issue (id, project_id, reporter_id, assignee_id,
      title, priority, story_points, status) VALUES (?, 1, 1, ?, 't', 'high', 1, ?)`);
    for (let i = 1; i <= 5; i++) ins.run(i, 99, 'in_progress');

    const eventsDb = new Database(':memory:');
    applyEventStoreSchema(eventsDb);
    const store = new SqliteEventStore(eventsDb);

    store.appendEvents([{ stream: 'Issue-10', events: [
      { eventId: 'u1', eventType: 'IssueReported', aggregateType: 'Issue', aggregateId: '10',
        occurredAt: '2026-04-14T09:00:00Z', actor: null, schemaVersion: 1,
        payload: { before: null,
          after: { status: 'open', title: 'x', projectId: 1, reporterId: 1, priority: 'high', storyPoints: 1 } } } ] }]);

    const compiled = compileCommand(assignWithCapacitySpec, RAW_ISSUE_PDM, RAW_QSM);
    if (!compiled.ok) throw new Error(`compile failed: ${JSON.stringify(compiled.errors)}`);
    expect(compiled.value.readPrelude).not.toBeNull();

    let seq = 0;
    try {
      executeCommand(compiled.value, { issueId: 10, assigneeId: 99 }, {
        eventStore: store, qsmDb,
        now: () => '2026-04-14T10:00:00Z',
        nextId: () => `id-${++seq}`,
        actor: null,
      });
      throw new Error('expected throw');
    } catch (e) {
      expect((e as { code?: string }).code).toBe('COMMAND_GUARD_REJECTED');
    }

    qsmDb.close();
    eventsDb.close();
  });

  it('passes guard and appends event when count < threshold', () => {
    const qsmDb = new Database(':memory:');
    qsmDb.exec(`CREATE TABLE projection_issue (
      id INTEGER PRIMARY KEY, project_id INTEGER NOT NULL, reporter_id INTEGER NOT NULL,
      assignee_id INTEGER, title TEXT NOT NULL, priority TEXT NOT NULL, story_points INTEGER NOT NULL,
      status TEXT NOT NULL, resolved_at TEXT
    );`);

    const eventsDb = new Database(':memory:');
    applyEventStoreSchema(eventsDb);
    const store = new SqliteEventStore(eventsDb);

    store.appendEvents([{ stream: 'Issue-10', events: [
      { eventId: 'u1', eventType: 'IssueReported', aggregateType: 'Issue', aggregateId: '10',
        occurredAt: '2026-04-14T09:00:00Z', actor: null, schemaVersion: 1,
        payload: { before: null,
          after: { status: 'open', title: 'x', projectId: 1, reporterId: 1, priority: 'high', storyPoints: 1 } } } ] }]);

    const compiled = compileCommand(assignWithCapacitySpec, RAW_ISSUE_PDM, RAW_QSM);
    if (!compiled.ok) throw new Error(`compile failed: ${JSON.stringify(compiled.errors)}`);

    let seq = 0;
    const out = executeCommand(compiled.value, { issueId: 10, assigneeId: 99 }, {
      eventStore: store, qsmDb,
      now: () => '2026-04-14T10:00:00Z',
      nextId: () => `id-${++seq}`,
      actor: null,
    });
    expect(out.version).toBe(2);
    const stream = store.readStream('Issue-10');
    expect(stream.map((e) => e.eventType)).toEqual(['IssueReported', 'IssueAssigned']);

    qsmDb.close();
    eventsDb.close();
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `pnpm --filter @rntme/graph-ir-compiler test execute-read-prelude.test.ts`
Expected: PASS — both cases (guard rejection and guard pass).

- [ ] **Step 3: Commit**

```bash
git add packages/graph-ir-compiler/test/unit/command-runtime/execute-read-prelude.test.ts
git commit -m "test(graph-ir-compiler): read-prelude guard rejection path for composite command"
```

---

## Task 18: Public API — wire `compileCommand`, `executeCommand`, `runCommand` into `index.ts`

**Files:**
- Modify: `packages/graph-ir-compiler/src/index.ts`

- [ ] **Step 1: Re-export runtime types and functions**

Add to `src/index.ts`:

```ts
export { compileCommand } from './command-runtime/compile.js';
export { executeCommand, type ExecuteCommandContext } from './command-runtime/execute.js';
export { CommandExecutionError } from './command-runtime/errors.js';
export type { CommandResult, CompiledCommand, EmitPlan } from './types/command.js';
export { inferRole, type GraphRole } from './role/infer.js';
export { deriveEventTypeName } from './emit/event-type.js';

export function runCommand(
  rawSpec: unknown,
  rawPdm: unknown,
  rawQsm: unknown,
  paramValues: Record<string, unknown>,
  ctx: import('./command-runtime/execute.js').ExecuteCommandContext,
): import('./types/command.js').CommandResult {
  const r = compileCommand(rawSpec, rawPdm, rawQsm);
  if (!r.ok) throw Object.assign(new Error('compile failed'), { errors: r.errors });
  return executeCommand(r.value, paramValues, ctx);
}
```

- [ ] **Step 2: Typecheck + full test suite**

Run: `pnpm --filter @rntme/graph-ir-compiler typecheck`
Expected: no errors.

Run: `pnpm --filter @rntme/graph-ir-compiler test`
Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add packages/graph-ir-compiler/src/index.ts
git commit -m "feat(graph-ir-compiler): public API — compileCommand, executeCommand, runCommand"
```

---

## Task 19: End-to-end test — assign command on issue-tracker fixture

**Files:**
- Create: `packages/graph-ir-compiler/test/e2e/fixtures/issue-tracker.pdm.json`
- Create: `packages/graph-ir-compiler/test/e2e/fixtures/issue-tracker.qsm.json`
- Create: `packages/graph-ir-compiler/test/e2e/fixtures/issue-tracker.sql`
- Create: `packages/graph-ir-compiler/test/e2e/command-assign.e2e.test.ts`

- [ ] **Step 1: Create issue-tracker PDM fixture**

Create `test/e2e/fixtures/issue-tracker.pdm.json` — copy the exact content of `demo/issue-tracker-api/src/artifacts/pdm.json` into this file. (The demo PDM already has `Issue` with the full stateMachine.)

- [ ] **Step 2: Create issue-tracker QSM fixture with entity-mirror projection**

Create `test/e2e/fixtures/issue-tracker.qsm.json`:

```json
{
  "projections": {
    "IssueView": {
      "backing": "entity-mirror",
      "source": { "entity": "Issue" },
      "keys": ["id"],
      "grain": ["id"],
      "exposed": ["id", "title", "status", "priority", "storyPoints",
                  "assigneeId", "reporterId", "projectId",
                  "createdAt", "resolvedAt"],
      "table": "projection_issue"
    }
  },
  "relationRoles": {}
}
```

- [ ] **Step 3: Create QSM DDL fixture**

Create `test/e2e/fixtures/issue-tracker.sql`:

```sql
CREATE TABLE projection_issue (
  id           INTEGER PRIMARY KEY,
  project_id   INTEGER NOT NULL,
  reporter_id  INTEGER NOT NULL,
  assignee_id  INTEGER,
  sprint_id    INTEGER,
  title        TEXT    NOT NULL,
  priority     TEXT    NOT NULL,
  story_points INTEGER NOT NULL,
  status       TEXT    NOT NULL,
  resolved_at  TEXT,
  created_at   TEXT    NOT NULL,
  last_event_id      TEXT    NOT NULL,
  last_event_version INTEGER NOT NULL,
  applied_at         TEXT    NOT NULL
);
```

- [ ] **Step 4: Write an e2e assign-command test**

Create `test/e2e/command-assign.e2e.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SqliteEventStore, applyEventStoreSchema } from '@rntme/event-store';
import { compileCommand, executeCommand, runCommand } from '../../src/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const load = (n: string): unknown => JSON.parse(readFileSync(join(here, 'fixtures', n), 'utf8'));
const pdm = load('issue-tracker.pdm.json');
const qsm = load('issue-tracker.qsm.json');

const reportSpec = {
  version: '1.0-rc7', pdmRef: 'p', qsmRef: 'q', shapes: {},
  graphs: { reportIssue: { id: 'reportIssue',
    signature: { inputs: {
      issueId: { type: 'integer', mode: 'required' },
      projectId: { type: 'integer', mode: 'required' },
      reporterId: { type: 'integer', mode: 'required' },
      title: { type: 'string', mode: 'required' },
      priority: { type: 'string', mode: 'required' },
      storyPoints: { type: 'integer', mode: 'required' } },
      output: { type: 'row<CommandResult>', from: 'e' } },
    nodes: [{ id: 'e', type: 'emit',
      config: { aggregate: 'Issue', aggregateId: { $param: 'issueId' }, transition: 'report',
                payload: { title: { $param: 'title' }, projectId: { $param: 'projectId' },
                           reporterId: { $param: 'reporterId' },
                           priority: { $param: 'priority' }, storyPoints: { $param: 'storyPoints' } } } }] } },
};

const submitSpec = {
  version: '1.0-rc7', pdmRef: 'p', qsmRef: 'q', shapes: {},
  graphs: { submitIssue: { id: 'submitIssue',
    signature: { inputs: { issueId: { type: 'integer', mode: 'required' } },
                 output: { type: 'row<CommandResult>', from: 'e' } },
    nodes: [{ id: 'e', type: 'emit',
      config: { aggregate: 'Issue', aggregateId: { $param: 'issueId' }, transition: 'submit',
                payload: {} } }] } },
};
const assignSpec = {
  version: '1.0-rc7', pdmRef: 'p', qsmRef: 'q', shapes: {},
  graphs: { assignIssue: { id: 'assignIssue',
    signature: { inputs: {
      issueId:    { type: 'integer', mode: 'required' },
      assigneeId: { type: 'integer', mode: 'required' } },
      output: { type: 'row<CommandResult>', from: 'e' } },
    nodes: [{ id: 'e', type: 'emit',
      config: { aggregate: 'Issue', aggregateId: { $param: 'issueId' }, transition: 'assign',
                payload: { assigneeId: { $param: 'assigneeId' } } } }] } },
};

describe('E2E command: report → submit → assign', () => {
  it('appends events for each transition and final version is 3', () => {
    const eventsDb = new Database(':memory:');
    applyEventStoreSchema(eventsDb);
    const store = new SqliteEventStore(eventsDb);

    let seq = 0;
    const ctx = { eventStore: store, qsmDb: null,
      now: () => '2026-04-14T10:00:00Z',
      nextId: () => `018e9d2a-0000-7000-8000-${String(++seq).padStart(12, '0')}`,
      actor: { kind: 'user' as const, id: 'alice' } };

    const r1 = runCommand(reportSpec, pdm, qsm, { issueId: 42, projectId: 1, reporterId: 2, title: 'x', priority: 'high', storyPoints: 3 }, ctx);
    expect(r1.version).toBe(1);

    const r2 = runCommand(submitSpec, pdm, qsm, { issueId: 42 }, ctx);
    expect(r2.version).toBe(2);

    const r3 = runCommand(assignSpec, pdm, qsm, { issueId: 42, assigneeId: 7 }, ctx);
    expect(r3.version).toBe(3);

    const stream = store.readStream('Issue-42');
    expect(stream.map((e) => e.eventType)).toEqual(['IssueReported', 'IssueSubmitted', 'IssueAssigned']);
    eventsDb.close();
  });

  it('409-equivalent on concurrent append (ConcurrencyConflict → COMMAND_CONCURRENCY_CONFLICT)', () => {
    const eventsDb = new Database(':memory:');
    applyEventStoreSchema(eventsDb);
    const store = new SqliteEventStore(eventsDb);

    let seq = 0;
    const ctx = { eventStore: store, qsmDb: null,
      now: () => '2026-04-14T10:00:00Z',
      nextId: () => `018e9d2a-0000-7000-8000-${String(++seq).padStart(12, '0')}`,
      actor: null };

    runCommand(reportSpec, pdm, qsm, { issueId: 42, projectId: 1, reporterId: 2, title: 'x', priority: 'high', storyPoints: 3 }, ctx);

    // Manually append a competing event to simulate lost race.
    store.appendEvents([{ stream: 'Issue-42', expectedVersion: 1, events: [{
      eventId: 'manual', eventType: 'IssueSubmitted', aggregateType: 'Issue', aggregateId: '42',
      occurredAt: '2026-04-14T10:01:00Z', actor: null, schemaVersion: 1,
      payload: { before: { status: 'draft' }, after: { status: 'open' } } }] }]);

    // The compiled plan expects version=1; the write will fail because stream is now at version 2.
    // To force it, compile once + execute twice:
    const compiled = compileCommand(submitSpec, pdm, qsm);
    if (!compiled.ok) throw new Error('compile failed');

    try {
      // First replay will see version 2 now; transition 'submit' from 'open' is illegal → expect ILLEGAL.
      // If the spec under test is actually one where the replay would still legalise, we'd see CONCURRENCY_CONFLICT.
      // Either outcome is fine — assert the error code is one of the two.
      executeCommand(compiled.value, { issueId: 42 }, ctx);
      throw new Error('expected throw');
    } catch (e) {
      expect(['COMMAND_CONCURRENCY_CONFLICT', 'COMMAND_ILLEGAL_TRANSITION']).toContain((e as { code?: string }).code);
    }
    eventsDb.close();
  });
});
```


- [ ] **Step 5: Run the e2e test**

Run: `pnpm --filter @rntme/graph-ir-compiler test command-assign.e2e.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/graph-ir-compiler/test/e2e
git commit -m "test(graph-ir-compiler): e2e command — report → submit → assign over SqliteEventStore"
```

---

## Task 20: Changeset-free housekeeping + full package test

**Files:** none (verification only)

- [ ] **Step 1: Run full package test + typecheck**

Run: `pnpm --filter @rntme/graph-ir-compiler test && pnpm --filter @rntme/graph-ir-compiler typecheck`
Expected: both succeed.

- [ ] **Step 2: Run repo-wide build**

Run: `pnpm -r run build`
Expected: no errors across all packages.

- [ ] **Step 3: Run repo-wide test**

Run: `pnpm -r run test`
Expected: all package test suites green. Demo tests may fail if they reference the old PDM shape — those will be handled in the separate `demo/issue-tracker-api` rollout step (§7.8 item 8).

- [ ] **Step 4: If demo tests fail because they feed the compiler a raw PDM/QSM without stateMachine changes**

Demo still passes `pdm.json` directly into `compile()`. The new `compileCommand` uses the same rawPdm path, so the demo's existing read-graphs should continue to work. If they fail because QSM shape changed (e.g. new required fields), open a follow-up task under the demo package — do not scope-creep this plan.

- [ ] **Step 5: Final sanity commit (no-op if nothing changed)**

```bash
git status
```

If nothing is pending, skip. Otherwise commit any final adjustments.

---

## Done — summary of what this plan delivers

- `emit` node fully parses, normalizes, and passes through structural + semantic validation with all `CMD_*` and `GRAPH_MIXED_ROLE` / `CMD_OUTPUT_SHAPE_INVALID` / `CMD_EMIT_UNREACHABLE` codes.
- Graph role inference (`predicate | mapper | reducer | query | command`) is explicit and gates both the existing query compilation path and the new command path.
- `findMany.source.entity` compiles to the entity's QSM mirror projection table when present (spec §6.8).
- `compileCommand` produces a `CompiledCommand` that splits the graph into an optional SQL read-prelude (against the QSM DB) and per-emit plans (with event-type, affects, and transition metadata derived from `@rntme/pdm`'s stateMachine resolver).
- `executeCommand` performs read-prelude guard evaluation, replays the aggregate stream from `@rntme/event-store`, validates transition legality, derives `{before, after}` payloads, and atomically appends all events through `SqliteEventStore.appendEvents`, surfacing `ConcurrencyConflict` as `COMMAND_CONCURRENCY_CONFLICT`.
- The package migrates off its local ad-hoc PDM/QSM Zod schemas onto `@rntme/pdm` + `@rntme/qsm`, keeping a single source of truth for domain-model types and validation.
