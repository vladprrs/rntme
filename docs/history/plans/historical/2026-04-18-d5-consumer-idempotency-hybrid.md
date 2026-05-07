> Status: historical.
> Date: 2026-04-18.
> Current source: docs/current/**, docs/decision-system.md, and current code/tests.
> Why retained: Historical rationale and execution context retained for review; it is not current-state truth by itself.

# D5 · Consumer Idempotency Hybrid + Derived Projections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close gap D5 — unblock non-mirror (derived) projections. Add a hybrid consumer idempotency strategy (`last_event_version` per-row for mirrors plus shared `seen_events(event_id, projection_id)` for derived), reuse the existing graph-IR for derived projection authoring (new `{ eventType }` source + new `projection` role + operator whitelist `filter` / `map` / `reduce(count|sum)`), and generate `bootstrapSql` + `deltaSql` at compile time so the consumer stays thin.

**Architecture:** Derived projections compile through the same graph-IR pipeline as query graphs, then fork into a new SQLite lowering (`lower/sqlite/event-delta/`) that emits two SQL artifacts per handler: a `bootstrapSql` (unused by the MVP consumer, kept for a future rebuild-CLI) and a `deltaSql` UPSERT. QSM artifact links projection ↔ graph by name (`{ backing: "derived", source: { graph: "<name>" } }`). `@rntme/projection-consumer` receives a union `MirrorHandler | DerivedHandler` and branches on `kind` in `apply-event.ts`, running a filter SELECT → `seen_events` lookup → UPSERT → `seen_events` insert per derived handler, all inside the existing per-envelope transaction. `@rntme/runtime` adds a cross-artifact validation step (graph existence / role / keys) and a periodic `seen_events` retention DELETE.

**Tech Stack:** TypeScript, ESM, pnpm workspaces, `better-sqlite3`, Vitest. Packages touched: `@rntme/graph-ir-compiler`, `@rntme/qsm`, `@rntme/projection-consumer`, `@rntme/runtime`, `demo/issue-tracker-api`. No new runtime dependencies.

**Source spec:** `docs/history/specs/historical/2026-04-18-d5-consumer-idempotency-hybrid-design.md`. This plan covers the full MVP scope called out in §1–§10 of that spec; §11 follow-ups (rebuild-CLI, min/max/avg/top-N, delta-from-mirror) are explicitly out of scope.

---

## Working directory

All paths in this plan are relative to the repo root `/home/coder/project`. Run commands from the repo root unless noted; `pnpm -F @rntme/<pkg>` scopes to one package.

## Conventions in affected packages (observe before coding)

- **TypeScript ESM.** Every intra-package import path ends in `.js` even though source files are `.ts` — mandatory.
- **Error codes are append-only, stable API.** Never reorder or delete. Format `<PKG>_<LAYER>_<KIND>`. New codes added in this plan are listed in each task.
- **`Result<T>` everywhere at compile / validate boundaries.** The shape is `{ ok: true, value } | { ok: false, errors: GraphIrError[] }` — never throw in validator paths. Runtime apply paths (`apply-event.ts`) return enum strings.
- **Branded validated types.** `ValidatedPdm`, `ValidatedQsm`, `StructurallyValidQsm` — never cast into the brand outside the validator.
- **No line numbers in cross-file references in code / comments** — use file + symbol. (Line numbers drift; they're fine in *this plan* because it's a point-in-time artifact.)
- **Tests:** Vitest, `test/unit/**`, `test/integration/**`, `test/e2e/**`. Use existing helper factories. `SqliteEventStore`-style `close()` cleanup in `afterEach` where applicable.
- **SQLite target forever.** No Postgres-specific SQL.
- **SELECT without FROM.** SQLite supports `SELECT 1 WHERE <expr>` with no `FROM` clause — used for the filter-predicate pattern in the derived path.

## File map

### `@rntme/graph-ir-compiler`

**Modify:**
- `packages/graph-ir-compiler/src/types/authoring.ts` — extend `FindManyNode.config.source` union with `{ eventType: string }`.
- `packages/graph-ir-compiler/src/parse/schema.ts` — extend parse schema for the new source shape.
- `packages/graph-ir-compiler/src/types/result.ts` — add new error codes.
- `packages/graph-ir-compiler/src/validate/structural/tier1-nodes.ts` — accept `{ eventType }` in `findMany.source`.
- `packages/graph-ir-compiler/src/role/infer.ts` — return `'projection'` for event-source graphs with reduce output.
- `packages/graph-ir-compiler/src/validate/structural/role.ts` — register the new role.
- `packages/graph-ir-compiler/src/validate/semantic/sources.ts` — resolve `{ eventType }` to a virtual `event_log`-filtered source with payload-field typing.
- `packages/graph-ir-compiler/src/validate/semantic/index.ts` — dispatch the new projection whitelist validator.
- `packages/graph-ir-compiler/src/semantic-plan/build.ts` — represent the event-source in the plan.
- `packages/graph-ir-compiler/src/relational/build.ts` — wire event-source → relational read over `event_log`.
- `packages/graph-ir-compiler/src/index.ts` — export `compileProjectionGraph`, new types, and error codes.

**Create:**
- `packages/graph-ir-compiler/src/types/projection.ts` — `DerivedCompileResult`, `DerivedTableSchema`, `DerivedColumnBinding` types (shared with `@rntme/qsm` & `@rntme/projection-consumer`).
- `packages/graph-ir-compiler/src/validate/semantic/projection-whitelist.ts` — operator / aggregate / group / op whitelist checks; new error codes.
- `packages/graph-ir-compiler/src/lower/sqlite/event-delta/lower.ts` — entry point of the new lowering.
- `packages/graph-ir-compiler/src/lower/sqlite/event-delta/bootstrap.ts` — `bootstrapSql` generation.
- `packages/graph-ir-compiler/src/lower/sqlite/event-delta/delta.ts` — `deltaSql` + `deltaBindings` generation.
- `packages/graph-ir-compiler/src/lower/sqlite/event-delta/filter.ts` — `filter.sql` + `filter.bindings` lifting (reuses `lower/sqlite/expr.ts`).
- `packages/graph-ir-compiler/src/lower/sqlite/event-delta/table-schema.ts` — `DerivedTableSchema` builder from `RelationalPlan`.
- `packages/graph-ir-compiler/src/projection-compile.ts` — `compileProjectionGraph(spec, pdm, qsm) → Result<DerivedCompileResult>` orchestrator.
- Unit tests under `packages/graph-ir-compiler/test/unit/` mirroring the new modules.

### `@rntme/qsm`

**Modify:**
- `packages/qsm/src/types/artifact.ts` — `ProjectionSource` becomes a tagged union (`{ entity } | { graph }`); `Projection.backing` narrowed by source tag.
- `packages/qsm/src/parse/schema.ts` — accept `source: { graph: string }`.
- `packages/qsm/src/validate/cross-ref.ts` — remove "derived not supported" rejection; add `QSM_DERIVED_*` checks for `backing === 'derived'`.
- `packages/qsm/src/validate/structural.ts` — structural rules for derived (table name, exposed shape).
- `packages/qsm/src/derive/ddl.ts` — branch on `backing`; derived DDL from externally-supplied `DerivedTableSchema` (no PDM entity in the derived path).
- `packages/qsm/src/derive/handler.ts` — existing export kept for mirror; add `deriveDerivedProjectionHandlers()` returning `DerivedProjectionSpec[]` (thin pass-through of already-compiled DerivedCompileResult).
- `packages/qsm/src/types/result.ts` — new `QSM_DERIVED_*` error codes.
- `packages/qsm/src/index.ts` — export the new types and functions.

### `@rntme/projection-consumer`

**Modify:**
- `packages/projection-consumer/src/types/apply.ts` — `CompiledHandler` becomes `MirrorHandler | DerivedHandler`; `ApplyPlan.handlersByEventType` → `ReadonlyMap<string, readonly CompiledHandler[]>`; `ApplyResult` gains `'skipped-seen-event' | 'skipped-filter' | 'skipped-no-handler'`.
- `packages/projection-consumer/src/apply/compile.ts` — accept a `derivedHandlers` input alongside mirror handlers; populate the array-valued map.
- `packages/projection-consumer/src/apply/apply-event.ts` — iterate the handler array, branch on `kind`, return `readonly ApplyResult[]`.
- `packages/projection-consumer/src/apply/bind.ts` — add bindings for `eventId`-only idempotency (no version), and recursive `exprScalar`.
- `packages/projection-consumer/src/store/bootstrap.ts` — add `seen_events` DDL alongside projection tables.
- `packages/projection-consumer/src/consumer.ts` — collect array of `ApplyResult` per envelope; preserve the single `BEGIN IMMEDIATE…COMMIT` transaction boundary.
- `packages/projection-consumer/src/types/errors.ts` — retain; extend if new compile errors surface.
- `packages/projection-consumer/src/index.ts` — re-export `DerivedHandler`.

### `@rntme/runtime`

**Create:**
- `packages/runtime/src/projections/cross-validate.ts` — cross-artifact D5 validation (graph exists, role, keys match graph group, exposed in range).
- `packages/runtime/src/projections/seen-events-retention.ts` — retention interval job + config env var read.

**Modify:**
- `packages/runtime/src/start/start-service.ts` — invoke cross-validate before consumer start; schedule retention job; stop the job on service close.
- `packages/runtime/src/index.ts` — re-export new error codes for tooling.

### `demo/issue-tracker-api`

**Create:**
- `demo/issue-tracker-api/artifacts/graphs/resolvedIssueCountByProject.json` — derived projection graph: `findMany { eventType: "IssueResolved" } → reduce count by projectId`.
- `demo/issue-tracker-api/test/e2e/derived-projection.test.ts` — end-to-end: submit issue resolutions, assert projection table, replay for idempotency.

**Modify:**
- `demo/issue-tracker-api/artifacts/qsm.json` — add `resolvedIssueCountByProject` derived projection.

### Do NOT touch
- `@rntme/event-store` — D5 does not change the write path or the relay.
- `@rntme/bindings` / `@rntme/bindings-http` — no HTTP surface change in this plan.
- `@rntme/seed` — seed replay works through the consumer unchanged.
- `@rntme/pdm` — `deriveEventTypes` is already what the new source needs.

---

## Task 1 — New error codes + authoring type for `{ eventType }` source

**Goal:** Land the type-system scaffolding so downstream tasks can compile against the new shape.

**Files:**
- Modify: `packages/graph-ir-compiler/src/types/authoring.ts`
- Modify: `packages/graph-ir-compiler/src/types/result.ts`

**New error codes (appended, never reordered):**

- `PROJ_SEMANTIC_UNKNOWN_EVENT_TYPE`
- `PROJ_SEMANTIC_UNKNOWN_FIELD`
- `PROJ_SEMANTIC_UNSUPPORTED_AGG`
- `PROJ_SEMANTIC_UNSUPPORTED_GROUP`
- `PROJ_SEMANTIC_UNSUPPORTED_OP`
- `PROJ_ROLE_UNINFERRABLE`

- [ ] **Step 1.1: Extend `FindManyNode.config.source`**

In `packages/graph-ir-compiler/src/types/authoring.ts`, replace the existing `FindManyNode`:

```ts
export type FindManyNode = {
  id: string;
  type: 'findMany';
  config: {
    source:
      | { entity: string }
      | { projection: string }
      | { eventType: string };
  };
};
```

- [ ] **Step 1.2: Append error codes**

In `packages/graph-ir-compiler/src/types/result.ts`, append to `ERROR_CODES`:

```ts
  PROJ_SEMANTIC_UNKNOWN_EVENT_TYPE: 'PROJ_SEMANTIC_UNKNOWN_EVENT_TYPE',
  PROJ_SEMANTIC_UNKNOWN_FIELD: 'PROJ_SEMANTIC_UNKNOWN_FIELD',
  PROJ_SEMANTIC_UNSUPPORTED_AGG: 'PROJ_SEMANTIC_UNSUPPORTED_AGG',
  PROJ_SEMANTIC_UNSUPPORTED_GROUP: 'PROJ_SEMANTIC_UNSUPPORTED_GROUP',
  PROJ_SEMANTIC_UNSUPPORTED_OP: 'PROJ_SEMANTIC_UNSUPPORTED_OP',
  PROJ_ROLE_UNINFERRABLE: 'PROJ_ROLE_UNINFERRABLE',
```

Keep them in insertion order; do not reorder prior entries.

- [ ] **Step 1.3: Typecheck**

Run: `pnpm -F @rntme/graph-ir-compiler typecheck`
Expected: PASS. The only diff is new union branch and new const keys; no usage sites yet, so nothing narrows to fail.

- [ ] **Step 1.4: Commit**

```bash
git add packages/graph-ir-compiler/src/types/authoring.ts packages/graph-ir-compiler/src/types/result.ts
git commit -m "feat(graph-ir): add { eventType } source variant + PROJ_* error codes (D5 prep)"
```

---

## Task 2 — Parse schema accepts `{ eventType }` source

**Files:**
- Modify: `packages/graph-ir-compiler/src/parse/schema.ts`
- Modify: `packages/graph-ir-compiler/test/unit/parse/findMany-source.test.ts` (or the nearest existing parse test file — confirm with `ls packages/graph-ir-compiler/test/unit/parse/`)

- [ ] **Step 2.1: Locate the source parser**

Run: `grep -n "source" packages/graph-ir-compiler/src/parse/schema.ts | head -20`
Identify the current union that accepts `{ entity }` / `{ projection }`. The new variant is added parallel to these.

- [ ] **Step 2.2: Write the failing test**

Append to the existing parse test file (or create one following the file-naming pattern you observe):

```ts
import { describe, expect, it } from 'vitest';
import { parseAuthoringSpec } from '../../../src/parse/parse.js';

describe('parseAuthoringSpec — findMany source { eventType }', () => {
  it('accepts { eventType: "IssueResolved" } as a findMany source', () => {
    const spec = {
      version: '1.0-rc7',
      pdmRef: 'test-pdm',
      qsmRef: 'test-qsm',
      shapes: {},
      graphs: {
        g: {
          id: 'g',
          signature: {
            inputs: {},
            output: { type: 'rowset<Counts>', from: 'r' },
          },
          nodes: [
            { id: 's', type: 'findMany', config: { source: { eventType: 'IssueResolved' } } },
            {
              id: 'r',
              type: 'reduce',
              config: { input: 's', into: 'Counts', group: {}, measures: { n: { fn: 'count' } } },
            },
          ],
        },
      },
    };
    const r = parseAuthoringSpec(spec);
    expect(r.ok).toBe(true);
  });

  it('rejects empty eventType string', () => {
    const spec = /* same as above but with eventType: '' */;
    const r = parseAuthoringSpec(spec);
    expect(r.ok).toBe(false);
  });
});
```

- [ ] **Step 2.3: Run test; confirm failure**

Run: `pnpm -F @rntme/graph-ir-compiler vitest run parse/findMany-source`
Expected: FAIL with a parse error (the source union does not yet accept `eventType`).

- [ ] **Step 2.4: Extend the parser**

In `packages/graph-ir-compiler/src/parse/schema.ts`, find the source union (search for `projection` literal) and add an `eventType` branch. Implementation follows the existing branching pattern — if entries are Zod-style, add `z.object({ eventType: z.string().min(1) })`; if hand-rolled, add a guard `if ('eventType' in src && typeof src.eventType === 'string' && src.eventType.length > 0) return ok(...)`.

- [ ] **Step 2.5: Run tests; confirm pass**

Run: `pnpm -F @rntme/graph-ir-compiler vitest run parse/findMany-source`
Expected: both tests PASS.

- [ ] **Step 2.6: Commit**

```bash
git add packages/graph-ir-compiler/src/parse/schema.ts packages/graph-ir-compiler/test/unit/parse/findMany-source.test.ts
git commit -m "feat(graph-ir): parse { eventType } source variant"
```

---

## Task 3 — Structural validator accepts `{ eventType }`

**Files:**
- Modify: `packages/graph-ir-compiler/src/validate/structural/tier1-nodes.ts`
- Create: `packages/graph-ir-compiler/test/unit/validate/structural/findMany-event-source.test.ts`

- [ ] **Step 3.1: Find the existing source-shape check**

Run: `grep -n "source" packages/graph-ir-compiler/src/validate/structural/tier1-nodes.ts`
Observe how `entity` vs `projection` is discriminated.

- [ ] **Step 3.2: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { validateStructural } from '../../../../src/validate/structural/index.js';
import { minimalPdm, minimalQsm } from '../../../fixtures/minimal-artifacts.js';

describe('structural validator — findMany { eventType }', () => {
  it('accepts a findMany with eventType source', () => {
    const spec = /* authoring spec w/ eventType source, reduce count */;
    const r = validateStructural(spec, minimalPdm, minimalQsm);
    expect(r.ok).toBe(true);
  });
});
```

- [ ] **Step 3.3: Run; confirm failure**

Expected: FAIL with structural error about unknown source variant.

- [ ] **Step 3.4: Extend validator**

In `tier1-nodes.ts`, add the `eventType` branch alongside `entity` and `projection`. The structural layer only checks **shape**: `config.source` has exactly one of the three keys, value is a non-empty string. **Do not** verify the eventType exists in PDM — that belongs to the semantic layer (Task 5).

- [ ] **Step 3.5: Run; confirm pass**

- [ ] **Step 3.6: Commit**

```bash
git add packages/graph-ir-compiler/src/validate/structural/tier1-nodes.ts packages/graph-ir-compiler/test/unit/validate/structural/findMany-event-source.test.ts
git commit -m "feat(graph-ir): structural validator accepts { eventType } findMany source"
```

---

## Task 4 — Role inference: new `projection` role

**Files:**
- Modify: `packages/graph-ir-compiler/src/role/infer.ts`
- Create: `packages/graph-ir-compiler/test/unit/role/projection-role.test.ts`

- [ ] **Step 4.1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { inferRole } from '../../../src/role/infer.js';
import type { CanonicalGraph } from '../../../src/types/canonical.js';

describe('inferRole — projection', () => {
  it('returns "projection" for graph rooted at findMany { eventType } with reduce', () => {
    const graph: CanonicalGraph = {
      id: 'g',
      signature: {
        inputs: {},
        output: { type: 'rowset<Counts>', from: 'r' },
      },
      nodes: [
        { id: 's', kind: 'findMany', alias: 'ev', source: { eventType: 'IssueResolved' } },
        { id: 'r', kind: 'reduce', /* ... */ },
      ],
    } as CanonicalGraph; // cast ok in a test
    const r = inferRole(graph);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe('projection');
  });

  it('returns "projection" even when there is a filter before reduce', () => { /* ... */ });
});
```

- [ ] **Step 4.2: Run; confirm failure**

Expected: FAIL with `GRAPH_MIXED_ROLE` (current inferRole does not recognise event-source).

- [ ] **Step 4.3: Extend `inferRole`**

Replace the body of `inferRole` to include:

```ts
export type GraphRole = 'predicate' | 'mapper' | 'reducer' | 'query' | 'command' | 'projection';

export function inferRole(graph: CanonicalGraph): Result<GraphRole> {
  const hasEmit = graph.nodes.some((n) => n.kind === 'emit');
  const hasReduce = graph.nodes.some((n) => n.kind === 'reduce');
  const rootFindMany = graph.nodes.find(
    (n) => n.kind === 'findMany' && 'eventType' in (n as { source: object }).source,
  );
  const outputType = graph.signature.output.type;
  const outputIsRowset = outputType.startsWith('rowset<');

  // NEW: projection role
  if (rootFindMany && hasReduce && outputIsRowset && !hasEmit) return ok('projection');

  // ... existing cases unchanged below ...
}
```

Update `GraphRole` type export. Error `GRAPH_MIXED_ROLE` stays for un-recognisable combinations.

- [ ] **Step 4.4: Run; confirm pass**

Run also: `pnpm -F @rntme/graph-ir-compiler vitest run role`
Expected: new tests PASS; existing role tests still PASS.

- [ ] **Step 4.5: Commit**

```bash
git add packages/graph-ir-compiler/src/role/infer.ts packages/graph-ir-compiler/test/unit/role/projection-role.test.ts
git commit -m "feat(graph-ir): inferRole returns 'projection' for event-sourced reduce graphs"
```

---

## Task 5 — Projection-role whitelist validator

**Files:**
- Create: `packages/graph-ir-compiler/src/validate/semantic/projection-whitelist.ts`
- Modify: `packages/graph-ir-compiler/src/validate/semantic/index.ts`
- Create: `packages/graph-ir-compiler/test/unit/validate/semantic/projection-whitelist.test.ts`

**Whitelist summary (spec §3.2):**
- Allowed node kinds: `findMany` (root, `{ eventType }`), `filter`, `map`, `reduce`.
- Forbidden: `sort`, `limit`, `distinct`, `lookupOne` → `PROJ_SEMANTIC_UNSUPPORTED_OP`.
- `reduce.measures`: only `count`, `sum`. Others → `PROJ_SEMANTIC_UNSUPPORTED_AGG`.
- `reduce.group` values: only dot-paths / literal field paths. Expression values → `PROJ_SEMANTIC_UNSUPPORTED_GROUP`.
- `filter.expr`: disallow `exists`-subquery. Present → `PROJ_SEMANTIC_UNSUPPORTED_OP` with hint "exists-subquery not supported in projection role".

- [ ] **Step 5.1: Write the failing test**

Test every rejection path and the happy path:

```ts
import { describe, it, expect } from 'vitest';
import { validateProjectionWhitelist } from '../../../../src/validate/semantic/projection-whitelist.js';
import { ERROR_CODES } from '../../../../src/types/result.js';
import type { CanonicalGraph } from '../../../../src/types/canonical.js';

function graphWith(nodes: CanonicalGraph['nodes']): CanonicalGraph {
  return {
    id: 'g',
    signature: { inputs: {}, output: { type: 'rowset<R>', from: 'r' } },
    nodes,
  } as CanonicalGraph;
}

describe('validateProjectionWhitelist', () => {
  it('accepts findMany + filter + map + reduce(count, sum)', () => { /* ... */ });

  it('rejects sort node', () => {
    const g = graphWith([
      { id: 's', kind: 'findMany', alias: 'ev', source: { eventType: 'X' } },
      { id: 'o', kind: 'sort', input: 's', by: [{ field: 'ev.x', dir: 'asc' }] },
      { id: 'r', kind: 'reduce', input: 'o', into: 'R', group: {}, measures: { n: { fn: 'count' } } },
    ] as unknown as CanonicalGraph['nodes']);
    const errs = validateProjectionWhitelist(g);
    expect(errs.map((e) => e.code)).toContain(ERROR_CODES.PROJ_SEMANTIC_UNSUPPORTED_OP);
  });

  it('rejects reduce with min aggregate', () => { /* → PROJ_SEMANTIC_UNSUPPORTED_AGG */ });
  it('rejects reduce.group with { add: [...] }', () => { /* → PROJ_SEMANTIC_UNSUPPORTED_GROUP */ });
  it('rejects filter with exists-subquery', () => { /* → PROJ_SEMANTIC_UNSUPPORTED_OP */ });
});
```

- [ ] **Step 5.2: Run; confirm failure (module not found)**

- [ ] **Step 5.3: Implement the whitelist module**

```ts
// packages/graph-ir-compiler/src/validate/semantic/projection-whitelist.ts
import type { CanonicalGraph } from '../../types/canonical.js';
import { ERROR_CODES, type GraphIrError } from '../../types/result.js';

const ALLOWED_KINDS = new Set(['findMany', 'filter', 'map', 'reduce']);
const ALLOWED_AGG = new Set(['count', 'sum']);

export function validateProjectionWhitelist(graph: CanonicalGraph): GraphIrError[] {
  const errors: GraphIrError[] = [];
  for (const node of graph.nodes) {
    if (!ALLOWED_KINDS.has(node.kind)) {
      errors.push({
        layer: 'semantic',
        code: ERROR_CODES.PROJ_SEMANTIC_UNSUPPORTED_OP,
        message: `node kind "${node.kind}" is not supported in projection-role graphs`,
        hint: 'projection graphs support findMany, filter, map, reduce only (MVP)',
        location: { graphId: graph.id, nodeId: node.id },
      });
      continue;
    }
    if (node.kind === 'reduce') {
      for (const [name, m] of Object.entries(node.measures)) {
        if (!ALLOWED_AGG.has(m.fn)) {
          errors.push({
            layer: 'semantic',
            code: ERROR_CODES.PROJ_SEMANTIC_UNSUPPORTED_AGG,
            message: `measure "${name}" uses fn="${m.fn}"; only count, sum are allowed in projection-role graphs (MVP)`,
            location: { graphId: graph.id, nodeId: node.id },
          });
        }
      }
      for (const [name, g] of Object.entries(node.group)) {
        if (typeof g !== 'string') {
          errors.push({
            layer: 'semantic',
            code: ERROR_CODES.PROJ_SEMANTIC_UNSUPPORTED_GROUP,
            message: `group key "${name}" is not a field-path; expression group keys are not allowed in projection-role graphs (MVP)`,
            location: { graphId: graph.id, nodeId: node.id },
          });
        }
      }
    }
    if (node.kind === 'filter' && containsExists(node.expr)) {
      errors.push({
        layer: 'semantic',
        code: ERROR_CODES.PROJ_SEMANTIC_UNSUPPORTED_OP,
        message: 'filter with exists-subquery is not allowed in projection-role graphs (MVP)',
        location: { graphId: graph.id, nodeId: node.id },
      });
    }
  }
  return errors;
}

function containsExists(expr: unknown): boolean {
  if (!expr || typeof expr !== 'object') return false;
  if ('exists' in (expr as Record<string, unknown>)) return true;
  if (Array.isArray(expr)) return expr.some(containsExists);
  return Object.values(expr as Record<string, unknown>).some(containsExists);
}
```

- [ ] **Step 5.4: Wire into semantic validator dispatch**

In `packages/graph-ir-compiler/src/validate/semantic/index.ts`, after role inference (or equivalent dispatch point), call `validateProjectionWhitelist(graph)` when role is `projection` and append its errors.

- [ ] **Step 5.5: Run; confirm pass**

- [ ] **Step 5.6: Commit**

```bash
git add packages/graph-ir-compiler/src/validate/semantic/projection-whitelist.ts packages/graph-ir-compiler/src/validate/semantic/index.ts packages/graph-ir-compiler/test/unit/validate/semantic/projection-whitelist.test.ts
git commit -m "feat(graph-ir): projection-role operator whitelist validator"
```

---

## Task 6 — Semantic sources: resolve `{ eventType }` with payload typing

**Files:**
- Modify: `packages/graph-ir-compiler/src/validate/semantic/sources.ts`
- Modify: `packages/graph-ir-compiler/src/validate/semantic/fields.ts` (wherever payload-field typing lookup happens — confirm by grep)
- Create: `packages/graph-ir-compiler/test/unit/validate/semantic/event-source.test.ts`

**Design:**
- Extend `ResolvedSource` with a third variant `{ kind: 'eventType'; eventType: string; aggregateType: string; payloadFields: Record<string, EventFieldSpec>; alias: string }`.
- In `resolveSources`, when `node.source.eventType` is present, look up the spec in `deriveEventTypes(pdm)` — emit `PROJ_SEMANTIC_UNKNOWN_EVENT_TYPE` if missing.
- Field-resolution for the `{ eventType }` source: valid field paths are `<alias>.aggregateId`, `<alias>.occurredAt`, `<alias>.actorId`, and `<alias>.<payloadFieldName>`. Unknown → `PROJ_SEMANTIC_UNKNOWN_FIELD`.

- [ ] **Step 6.1: Write failing tests**

Three tests minimum:
1. Unknown eventType → `PROJ_SEMANTIC_UNKNOWN_EVENT_TYPE`.
2. Known eventType with valid payload field → OK.
3. Known eventType with bogus payload field → `PROJ_SEMANTIC_UNKNOWN_FIELD`.

- [ ] **Step 6.2: Run; confirm failures**

- [ ] **Step 6.3: Extend `ResolvedSource` type and `resolveSources`**

```ts
// sources.ts additions
import { deriveEventTypes, type EventTypeSpec } from '@rntme/pdm';

export type EventSource = {
  kind: 'eventType';
  eventType: string;
  aggregateType: string;
  payloadFields: EventTypeSpec['payloadFields'];
  alias: string;
};
export type ResolvedSource = EntitySource | ProjectionSource | EventSource;
```

Inside `resolveSources`, handle the new variant:

```ts
if ('eventType' in node.source) {
  const events = deriveEventTypes(pdm);
  const spec = events.find((e) => e.eventType === node.source.eventType);
  if (!spec) {
    errors.push({
      layer: 'semantic',
      code: ERROR_CODES.PROJ_SEMANTIC_UNKNOWN_EVENT_TYPE,
      message: `eventType "${node.source.eventType}" not found in PDM-derived events`,
      location: { graphId: graph.id, nodeId: node.id },
    });
    continue;
  }
  map.set(node.id, {
    kind: 'eventType',
    eventType: spec.eventType,
    aggregateType: spec.aggregateType,
    payloadFields: spec.payloadFields,
    alias: node.alias,
  });
  continue;
}
```

- [ ] **Step 6.4: Extend field-resolution for event-source aliases**

In `packages/graph-ir-compiler/src/validate/semantic/fields.ts` (or wherever paths are resolved per alias — locate via `grep -n "EntitySource\|projection-source" packages/graph-ir-compiler/src/validate/semantic/`), add a branch: when the alias resolves to an `EventSource`, allowed field-leaves are `aggregateId`, `occurredAt`, `actorId`, and keys of `payloadFields`. Unknown → `PROJ_SEMANTIC_UNKNOWN_FIELD`.

- [ ] **Step 6.5: Run; confirm pass**

- [ ] **Step 6.6: Commit**

```bash
git add packages/graph-ir-compiler/src/validate/semantic/sources.ts packages/graph-ir-compiler/src/validate/semantic/fields.ts packages/graph-ir-compiler/test/unit/validate/semantic/event-source.test.ts
git commit -m "feat(graph-ir): resolve { eventType } source with typed payload fields"
```

---

## Task 7 — Semantic plan + relational build: event-source → `event_log` read

**Goal:** Make the existing plan-building pipeline represent an event-source read so that the query-graph lowering (used for `bootstrapSql`) can produce SQL against `event_log`.

**Files:**
- Modify: `packages/graph-ir-compiler/src/semantic-plan/build.ts`
- Modify: `packages/graph-ir-compiler/src/relational/build.ts`
- Create: `packages/graph-ir-compiler/test/unit/semantic-plan/event-source.test.ts`

**Mapping (spec §3.1):**
- Source table: `event_log`.
- Filter injected at the scan level: `event_type = '<EventTypeName>'`.
- Virtual columns exposed on the scan:
  - `aggregateId` → `event_log.aggregate_id`, cast/coerced per PDM entity key type.
  - `occurredAt` → `event_log.occurred_at`.
  - `actorId` → `event_log.actor_id`.
  - `<payloadField>` → `json_extract(event_log.payload_json, '$.<name>')`, result type per `payloadFields[<name>].type`.

- [ ] **Step 7.1: Test — semantic plan pass-through**

Write a test that compiles (via the existing `buildSemanticPlan` entry point) a trivial graph `findMany { eventType } → reduce count` and asserts the plan's source references `event_log` with the `event_type` constant predicate.

- [ ] **Step 7.2: Run; confirm failure**

- [ ] **Step 7.3: Extend `semantic-plan/build.ts`**

Where existing code branches on `resolved.kind === 'entity'` vs `'projection'`, add a branch for `'eventType'`. Plan representation:

```ts
// pseudo-shape — follow existing SemanticPlanSource discriminants
{ kind: 'eventLog',
  eventType: source.eventType,
  aggregateType: source.aggregateType,
  payloadFields: source.payloadFields,
  columns: {
    aggregateId: { sourceColumn: 'aggregate_id', sqlType: /* per PDM entity key */ },
    occurredAt: { sourceColumn: 'occurred_at', sqlType: 'TEXT' },
    actorId: { sourceColumn: 'actor_id', sqlType: 'TEXT', nullable: true },
    ...Object.fromEntries(Object.entries(source.payloadFields).map(([name, spec]) =>
      [name, { extractor: { jsonPath: `$.${name}` }, sqlType: sqlTypeOf(spec.type), nullable: spec.nullable }],
    )),
  },
  filterPredicate: { eq: [{ column: 'event_type' }, { literal: source.eventType }] },
}
```

Follow the existing shape of `SemanticPlanSource` in `packages/graph-ir-compiler/src/types/semantic-plan.ts`; extend the discriminated union there if no `eventLog` variant exists.

- [ ] **Step 7.4: Extend `relational/build.ts` accordingly**

For the new plan-source variant, emit a relational scan over table `event_log`, projecting virtual columns via SQL expressions (`json_extract(payload_json, '$.<name>') AS <name>`) and attaching the constant filter. The rest of the relational pipeline (filter/map/reduce lowering) should not need changes — they operate on the column projection regardless of source.

- [ ] **Step 7.5: Run; confirm pass**

- [ ] **Step 7.6: Sanity — `explain` end-to-end**

Add an integration test (`packages/graph-ir-compiler/test/integration/event-source-explain.test.ts`) that calls the existing `explain()` export with a minimal spec+pdm+qsm and asserts the emitted SQL contains both `FROM event_log` and `WHERE "event_type" = 'IssueResolved'` and `json_extract(payload_json, '$.projectId')`.

- [ ] **Step 7.7: Commit**

```bash
git add packages/graph-ir-compiler/src/semantic-plan/build.ts packages/graph-ir-compiler/src/relational/build.ts packages/graph-ir-compiler/src/types/semantic-plan.ts packages/graph-ir-compiler/test/unit/semantic-plan/event-source.test.ts packages/graph-ir-compiler/test/integration/event-source-explain.test.ts
git commit -m "feat(graph-ir): semantic plan + relational build for event_log source"
```

---

## Task 8 — Shared `DerivedCompileResult` types

**Files:**
- Create: `packages/graph-ir-compiler/src/types/projection.ts`
- Modify: `packages/graph-ir-compiler/src/index.ts`

**Shared types (no behaviour yet — just the contract referenced by later tasks):**

```ts
// packages/graph-ir-compiler/src/types/projection.ts
import type { ScalarPrimitive } from '@rntme/pdm';

export type DerivedSqlType = 'INTEGER' | 'TEXT' | 'REAL';

export type DerivedMeasureColumn = Readonly<{
  name: string;
  fn: 'count' | 'sum';
  sqlType: DerivedSqlType;
  /** SQL expression used on first insert (1 for count; <expr-sql> for sum). */
  initialSql: string;
  /** SQL fragment used in ON CONFLICT DO UPDATE SET (e.g. `count_col + 1`). */
  deltaSql: string;
  /**
   * Bindings referenced by `initialSql` (and therefore bound for the INSERT's
   * VALUES clause at delta time). Empty for `count` (initialSql = '1'); for
   * `sum` with a payload expression, carries the nested payloadField / exprScalar bindings.
   */
  bindings?: readonly DerivedColumnBinding[];
}>;

export type DerivedGroupColumn = Readonly<{
  name: string;
  sqlType: DerivedSqlType;
  nullable: boolean;
  /** Binding used at delta-apply time to resolve this column from the envelope. */
  binding: DerivedColumnBinding;
}>;

export type DerivedTableSchema = Readonly<{
  tableName: string;                  // "" at compile time; filled in by QSM consumer using proj.table
  groupColumns: readonly DerivedGroupColumn[];
  measureColumns: readonly DerivedMeasureColumn[];
}>;

export type DerivedColumnBinding =
  | Readonly<{ kind: 'aggregateId'; sqlType: DerivedSqlType }>
  | Readonly<{ kind: 'payloadField'; fieldName: string; sqlType: DerivedSqlType }>
  | Readonly<{ kind: 'eventOccurredAt' }>
  | Readonly<{ kind: 'eventActorId' }>
  | Readonly<{ kind: 'eventId' }>
  | Readonly<{ kind: 'appliedAt' }>
  | Readonly<{ kind: 'literal'; sql: string }>  // used by measure initialSql/deltaSql
  | Readonly<{ kind: 'exprScalar'; sql: string; bindings: readonly DerivedColumnBinding[] }>;

export type DerivedCompileResult = Readonly<{
  /** For `rntme projection rebuild` (future); not invoked in MVP. */
  bootstrapSql: string;
  /** UPSERT statement, one execution per accepted envelope. */
  deltaSql: string;
  /** Parameter bindings in ?-placeholder order, matching `deltaSql`. */
  deltaBindings: readonly DerivedColumnBinding[];
  /** Optional predicate, bound then executed as `SELECT 1 WHERE <sql>`. */
  filter: Readonly<{ sql: string; bindings: readonly DerivedColumnBinding[] }> | null;
  /** DDL inputs for the projection table (consumer / qsm owns CREATE TABLE). */
  tableSchema: DerivedTableSchema;
  /** Event type this handler subscribes to. */
  eventType: string;
  /** For projection-consumer's `mirrorsByAggregate` map population. */
  aggregateType: string;
}>;
```

- [ ] **Step 8.1: Create the file with exactly the content above.**

- [ ] **Step 8.2: Re-export from package root**

In `packages/graph-ir-compiler/src/index.ts`:

```ts
export type {
  DerivedCompileResult,
  DerivedTableSchema,
  DerivedGroupColumn,
  DerivedMeasureColumn,
  DerivedColumnBinding,
  DerivedSqlType,
} from './types/projection.js';
```

- [ ] **Step 8.3: Typecheck**

Run: `pnpm -F @rntme/graph-ir-compiler typecheck`
Expected: PASS.

- [ ] **Step 8.4: Commit**

```bash
git add packages/graph-ir-compiler/src/types/projection.ts packages/graph-ir-compiler/src/index.ts
git commit -m "feat(graph-ir): DerivedCompileResult + shared projection types"
```

---

## Task 9 — Event-delta lowering: `DerivedTableSchema` builder

**Files:**
- Create: `packages/graph-ir-compiler/src/lower/sqlite/event-delta/table-schema.ts`
- Create: `packages/graph-ir-compiler/test/unit/lower/event-delta/table-schema.test.ts`

**Responsibility:** Given a `RelationalPlan` whose outer op is `reduce(findMany { eventType } [filter] [map])`, produce a `DerivedTableSchema`:
- `groupColumns` = one per `reduce.group` entry, sqlType derived from the source-resolved column type (see Task 7 mapping), binding derived from the path (`aggregateId` / `payloadField` / etc).
- `measureColumns` = one per `reduce.measures` entry:
  - `fn === 'count'`: `sqlType = 'INTEGER'`, `initialSql = '1'`, `deltaSql = '"<name>" + 1'`.
  - `fn === 'sum'`: `sqlType = 'INTEGER'` or `'REAL'` per the `expr` scalar type, `initialSql = <exprSql>`, `deltaSql = '"<name>" + excluded."<name>"'`.

- [ ] **Step 9.1: Failing tests**

```ts
// table-schema.test.ts — sketch
describe('buildDerivedTableSchema', () => {
  it('count with single group key → one INTEGER measure, one group col', () => { /* ... */ });
  it('sum with expr { mul: [...] } and two group keys → REAL measure, two group cols', () => { /* ... */ });
});
```

- [ ] **Step 9.2: Implement `table-schema.ts`**

Use the existing `RelationalPlan` shape (trace `packages/graph-ir-compiler/src/types/relational.ts` to understand the reduce structure).

- [ ] **Step 9.3: Run; confirm pass**

- [ ] **Step 9.4: Commit**

---

## Task 10 — Event-delta lowering: `deltaSql` + bindings

**Files:**
- Create: `packages/graph-ir-compiler/src/lower/sqlite/event-delta/delta.ts`
- Create: `packages/graph-ir-compiler/test/unit/lower/event-delta/delta.test.ts`

**Output template (spec §3.3):**

```sql
INSERT INTO "<table>"(<group_cols>, <measure_cols>, "last_event_id", "applied_at")
VALUES (<group_placeholders>, <measure_initials_or_placeholders>, ?, ?)
ON CONFLICT(<group_cols>) DO UPDATE SET
  "<m1>" = <m1.deltaSql>,
  "<m2>" = <m2.deltaSql>,
  "last_event_id" = excluded."last_event_id",
  "applied_at"    = excluded."applied_at";
```

**Bindings order:** group columns (in declaration order) → measure `initialSql` bindings (for `sum` with `exprScalar`; `count` has no bindings since `initialSql = '1'`) → `{ kind: 'eventId' }` → `{ kind: 'appliedAt' }`.

- [ ] **Step 10.1: Failing test — count**

```ts
describe('buildDeltaArtifact — count', () => {
  it('emits one-liner UPSERT with count + 1', () => {
    const schema: DerivedTableSchema = /* one group col "project_id", one count measure "n" */;
    const { deltaSql, deltaBindings } = buildDeltaArtifact(schema);
    expect(deltaSql).toContain('INSERT INTO "projection_resolved_count"');
    expect(deltaSql).toContain('ON CONFLICT("project_id") DO UPDATE');
    expect(deltaSql).toContain('"n" = "n" + 1');
    expect(deltaBindings).toEqual([
      { kind: 'payloadField', fieldName: 'projectId', sqlType: 'INTEGER' },
      { kind: 'eventId' },
      { kind: 'appliedAt' },
    ]);
  });
});
```

- [ ] **Step 10.2: Failing test — sum with exprScalar**

Assert that a sum measure whose `initialSql` uses `json_extract(payload_json, '$.amount') * json_extract(...)` produces bindings including an `exprScalar` entry.

- [ ] **Step 10.3: Implement `delta.ts`**

```ts
// packages/graph-ir-compiler/src/lower/sqlite/event-delta/delta.ts
import type { DerivedColumnBinding, DerivedTableSchema } from '../../../types/projection.js';

function q(id: string): string { return `"${id.replace(/"/g, '""')}"`; }

export function buildDeltaArtifact(schema: DerivedTableSchema): {
  deltaSql: string;
  deltaBindings: readonly DerivedColumnBinding[];
} {
  const groupCols = schema.groupColumns.map((c) => q(c.name)).join(', ');
  const measureCols = schema.measureColumns.map((c) => q(c.name)).join(', ');
  const groupPlaceholders = schema.groupColumns.map(() => '?').join(', ');
  const measureInitials = schema.measureColumns.map((c) => c.initialSql).join(', ');
  const setList = schema.measureColumns
    .map((c) => `${q(c.name)} = ${c.deltaSql}`)
    .concat([
      `${q('last_event_id')} = excluded.${q('last_event_id')}`,
      `${q('applied_at')} = excluded.${q('applied_at')}`,
    ])
    .join(', ');

  const sql =
    `INSERT INTO ${q(schema.tableName)}(${groupCols}, ${measureCols}, ${q('last_event_id')}, ${q('applied_at')})\n` +
    `VALUES (${groupPlaceholders}, ${measureInitials}, ?, ?)\n` +
    `ON CONFLICT(${groupCols}) DO UPDATE SET ${setList}`;

  const bindings: DerivedColumnBinding[] = [
    ...schema.groupColumns.map((c) => c.binding),
    ...schema.measureColumns.flatMap((c) => extractExprBindings(c.initialSql, c)),
    { kind: 'eventId' },
    { kind: 'appliedAt' },
  ];
  return { deltaSql: sql, deltaBindings: bindings };
}

// exprScalar bindings are propagated by the schema builder (Task 9).
// `count` measures have no extra bindings (initialSql = '1').
// `sum` measures carry their Expr bindings via DerivedMeasureColumn (extend that type in Task 9 if needed).
function extractExprBindings(
  _initialSql: string,
  measure: { initialSql: string; bindings?: readonly DerivedColumnBinding[] },
): readonly DerivedColumnBinding[] {
  return measure.bindings ?? [];
}
```

Note: `DerivedMeasureColumn.bindings` (declared optional in Task 8) is populated by Task 9 when the measure's `initialSql` references bound values (sum with payload expr); `count` measures leave it empty / undefined.

- [ ] **Step 10.4: Run; confirm pass**

- [ ] **Step 10.5: Commit**

---

## Task 11 — Event-delta lowering: `bootstrapSql`

**Files:**
- Create: `packages/graph-ir-compiler/src/lower/sqlite/event-delta/bootstrap.ts`
- Create: `packages/graph-ir-compiler/test/unit/lower/event-delta/bootstrap.test.ts`

**Template (spec §3.3):**

```sql
INSERT INTO "<table>"(<group_cols>, <measure_cols>, "last_event_id", "applied_at")
SELECT <group_exprs>,
       <measure_exprs>,
       '' AS "last_event_id",
       strftime('%Y-%m-%dT%H:%M:%fZ','now') AS "applied_at"
FROM event_log
WHERE "event_type" = '<EventTypeName>'
  [AND <filter_expr>]
GROUP BY <group_cols>;
```

Filter expression is embedded (unlike deltaSql). Payload fields → `json_extract(payload_json, '$.<name>')`.

- [ ] **Step 11.1: Failing test — count, no filter, one group**

Assert the SQL contains all expected clauses; no `AND` filter clause (there is no filter).

- [ ] **Step 11.2: Failing test — with filter**

Filter `{ eq: ['ev.status', { $literal: 'Done' }] }` → assert `AND json_extract(payload_json, '$.status') = 'Done'` appears after the event-type predicate.

- [ ] **Step 11.3: Implement `bootstrap.ts`**

Reuse `packages/graph-ir-compiler/src/lower/sqlite/expr.ts` to lower the filter expression against the event-source column mapping (same mapping as in Task 7).

- [ ] **Step 11.4: Run; confirm pass**

- [ ] **Step 11.5: Commit**

---

## Task 12 — Event-delta lowering: filter-predicate lifting

**Files:**
- Create: `packages/graph-ir-compiler/src/lower/sqlite/event-delta/filter.ts`
- Create: `packages/graph-ir-compiler/test/unit/lower/event-delta/filter.test.ts`

**Output:** Either `null` (no `filter` node in the graph) or `{ sql, bindings }` where `sql` is the predicate body suitable for `SELECT 1 WHERE <sql>`, bindings in `?`-order.

- [ ] **Step 12.1: Failing test**

```ts
it('lifts filter { eq: ["ev.status", { $literal: "Done" }] } into predicate-only sql', () => {
  const plan = /* relational plan with filter on event-source */;
  const result = buildFilterArtifact(plan);
  expect(result).not.toBeNull();
  expect(result!.sql.trim()).toBe("json_extract(payload_json, '$.status') = ?");
  expect(result!.bindings).toEqual([{ kind: 'literal', sql: "'Done'" }]);
});
```

Reuse `lower/sqlite/expr.ts` to render expressions; the "literal" binding conversion is cosmetic — inline literals can be emitted directly into SQL without binding.

- [ ] **Step 12.2: Implement**

For `{ $param: X }` expressions inside filter: projection-role graphs should not have signature inputs (they run without parameters). Assert during validation (in Task 5) that projection graphs have empty `signature.inputs` OR limit to what the consumer can inject (MVP: **empty inputs only** → simpler). If non-empty, emit `PROJ_SEMANTIC_UNSUPPORTED_OP` with hint "projection graphs take no inputs".

- [ ] **Step 12.3: Run; confirm pass**

- [ ] **Step 12.4: Commit**

---

## Task 13 — Event-delta lowering: top-level `lower()`

**Files:**
- Create: `packages/graph-ir-compiler/src/lower/sqlite/event-delta/lower.ts`
- Create: `packages/graph-ir-compiler/test/unit/lower/event-delta/lower.test.ts`

**Responsibility:** Glue `table-schema.ts` + `bootstrap.ts` + `delta.ts` + `filter.ts` into a single function:

```ts
export function lowerToEventDelta(
  plan: RelationalPlan,
  ctx: { pdm: ValidatedPdm; qsm: ValidatedQsm; projectionTable: string; aggregateType: string; eventType: string },
): DerivedCompileResult;
```

- [ ] **Step 13.1: Failing test — end-to-end fixture**

Fixture: minimal PDM with entity `Issue (id int, projectId int, status string)`, event `IssueResolved` (creates `status='Resolved'`, payload has `projectId`, `storyPoints`). Graph: `findMany IssueResolved → reduce { group: { projectId }, measures: { n: count, sp: { fn: sum, expr: 'ev.storyPoints' } } }`.

Expected: both SQL strings well-formed, bindings correct, `filter` null.

- [ ] **Step 13.2: Implement**

- [ ] **Step 13.3: Run; confirm pass**

- [ ] **Step 13.4: Commit**

---

## Task 14 — Public API: `compileProjectionGraph`

**Files:**
- Create: `packages/graph-ir-compiler/src/projection-compile.ts`
- Modify: `packages/graph-ir-compiler/src/index.ts`
- Create: `packages/graph-ir-compiler/test/integration/projection-compile.test.ts`

**Signature:**

```ts
export function compileProjectionGraph(
  rawSpec: unknown,
  rawPdm: unknown,
  rawQsm: unknown,
  opts: { graphId: string; projectionTable: string },
): Result<DerivedCompileResult>;
```

Pipeline: parse → structural → canonical → semantic (incl. projection-whitelist) → semantic-plan → relational → `lowerToEventDelta`. Error out if the graph's inferred role ≠ `'projection'`.

- [ ] **Step 14.1: Failing test**

Integration test: passes full JSON spec/pdm/qsm triplet, asserts a happy `DerivedCompileResult`. Second test: unsupported aggregate surface → `PROJ_SEMANTIC_UNSUPPORTED_AGG` in `errors`.

- [ ] **Step 14.2: Implement; wire into `src/index.ts` export.**

- [ ] **Step 14.3: Run; confirm pass**

- [ ] **Step 14.4: Commit**

```bash
git add packages/graph-ir-compiler/src/projection-compile.ts packages/graph-ir-compiler/src/index.ts packages/graph-ir-compiler/test/integration/projection-compile.test.ts packages/graph-ir-compiler/src/lower/sqlite/event-delta/
git commit -m "feat(graph-ir): compileProjectionGraph public API (event-delta lowering)"
```

---

## Task 15 — QSM artifact: accept `source: { graph }` + validator changes

**Files:**
- Modify: `packages/qsm/src/types/artifact.ts`
- Modify: `packages/qsm/src/parse/schema.ts`
- Modify: `packages/qsm/src/validate/structural.ts`
- Modify: `packages/qsm/src/validate/cross-ref.ts`
- Modify: `packages/qsm/src/types/result.ts`
- Update: `packages/qsm/test/unit/validate/derived-rejection.test.ts` (existing) → rename to `derived-projection.test.ts` and flip cases

**New error codes (appended):**
- `QSM_DERIVED_SOURCE_SHAPE`
- `QSM_DERIVED_EXPOSED_OUT_OF_RANGE` (structural portion — name/shape check only; cross-artifact check in Task 21)

- [ ] **Step 15.1: Redefine `ProjectionSource` as a discriminated union**

```ts
// types/artifact.ts
export type ProjectionSource =
  | { entity: string; pathPrefix?: string }
  | { graph: string };
```

- [ ] **Step 15.2: Update parser**

In `packages/qsm/src/parse/schema.ts`, accept either shape for `source`. Emit `QSM_DERIVED_SOURCE_SHAPE` if both / neither key present when `backing === 'derived'`, or if `source.entity` is given with `backing === 'derived'`.

- [ ] **Step 15.3: Structural rule changes**

In `packages/qsm/src/validate/structural.ts`: for `backing === 'derived'`:
- `source.graph` must be a non-empty string.
- `table` is required (derived tables have no default name path via PDM entity).
- `exposed` must be non-empty.

Mirror rules untouched.

- [ ] **Step 15.4: Flip cross-ref rejection**

In `packages/qsm/src/validate/cross-ref.ts`, replace:

```ts
if (backing === 'derived') {
  errors.push({
    layer: 'cross-ref',
    code: ERROR_CODES.QSM_DERIVED_NOT_SUPPORTED, // if this exists
    message: `projection "${projName}": backing "derived" is not supported in MVP`,
    path: `${pPath}.backing`,
    hint: 'Use backing "entity-mirror" or wait for tier 2.',
  });
}
```

with a positive check: when `backing === 'derived'`, skip the entity-mirror rules entirely (no `source.entity` lookup, no state-machine requirement). Cross-artifact checks (graph existence, role, keys match) are deferred to `@rntme/runtime` (Task 21).

- [ ] **Step 15.5: Flip existing tests**

The currently-green test in `packages/qsm/test/unit/validate/` that asserts `derived is rejected` must be rewritten to assert the happy path and the new error codes. Any call site that casts to `StructurallyValidQsm` around a derived fixture should stop failing.

- [ ] **Step 15.6: Run all qsm tests**

Run: `pnpm -F @rntme/qsm test`
Expected: all green, including old mirror tests.

- [ ] **Step 15.7: Commit**

```bash
git add packages/qsm/src/ packages/qsm/test/
git commit -m "feat(qsm): accept source: { graph } for derived projections; positive validator"
```

---

## Task 16 — QSM DDL derivation branches on `backing`

**Files:**
- Modify: `packages/qsm/src/derive/ddl.ts`
- Create: `packages/qsm/test/unit/derive/ddl-derived.test.ts`

**Behavior:**
- Signature additive: `generateProjectionDdl(artifact, pdm, opts?: { derivedSchemas?: Record<string, DerivedTableSchema> }): ProjectionDdlSpec[]`.
- For `backing === 'derived'`, the function requires a `derivedSchemas[projName]` entry (produced by the runtime after compiling the graph). Missing → throw `invariantViolated('derivedSchemas[X] required for derived projection X')`.
- DDL columns: group columns (from schema) + measure columns (from schema) + `last_event_id TEXT NOT NULL` + `applied_at TEXT NOT NULL`. **No** `last_event_version`. PK = group columns (composite if ≥ 2).

- [ ] **Step 16.1: Failing test**

```ts
it('generates DDL for a derived projection from supplied DerivedTableSchema', () => {
  const artifact = /* qsm with one derived projection referencing graph "g" */;
  const schema: DerivedTableSchema = {
    tableName: 'projection_resolved_count',
    groupColumns: [{ name: 'project_id', sqlType: 'INTEGER', nullable: false, binding: /* ... */ }],
    measureColumns: [
      { name: 'n', fn: 'count', sqlType: 'INTEGER', initialSql: '1', deltaSql: '"n" + 1' },
    ],
  };
  const specs = generateProjectionDdl(artifact, pdm, { derivedSchemas: { resolvedIssueCountByProject: schema } });
  const derived = specs.find((s) => s.projectionName === 'resolvedIssueCountByProject')!;
  expect(derived.createTableSql).toContain('"project_id" INTEGER NOT NULL');
  expect(derived.createTableSql).toContain('"n" INTEGER NOT NULL DEFAULT 0');
  expect(derived.createTableSql).toContain('"last_event_id" TEXT NOT NULL');
  expect(derived.createTableSql).toContain('"applied_at" TEXT NOT NULL');
  expect(derived.createTableSql).not.toContain('last_event_version');
  expect(derived.createTableSql).toMatch(/PRIMARY KEY\s*\(\s*"project_id"\s*\)/);
});
```

- [ ] **Step 16.2: Implement the branch**

- [ ] **Step 16.3: Run; confirm pass**

- [ ] **Step 16.4: Commit**

---

## Task 17 — QSM handler derivation split

**Files:**
- Modify: `packages/qsm/src/derive/handler.ts`
- Modify: `packages/qsm/src/index.ts`
- Create: `packages/qsm/test/unit/derive/derived-handler.test.ts`

**Behavior:**
- Existing `deriveProjectionHandler(artifact, pdm, events)` keeps returning mirror handlers only (filter by `backing === 'entity-mirror'` — it already does so).
- New export `deriveDerivedProjectionSpecs(artifact): DerivedProjectionSpec[]` where:

```ts
export type DerivedProjectionSpec = Readonly<{
  projectionName: string;
  tableName: string;
  graphId: string;
}>;
```

Simply walks projections with `backing === 'derived'` and emits one spec per entry — the runtime uses this list to know which graphs to compile via `compileProjectionGraph`.

- [ ] **Step 17.1: Failing test**

- [ ] **Step 17.2: Implement**

- [ ] **Step 17.3: Re-export from `src/index.ts`.**

- [ ] **Step 17.4: Commit**

---

## Task 18 — `projection-consumer`: union handler types + `seen_events` DDL

**Files:**
- Modify: `packages/projection-consumer/src/types/apply.ts`
- Modify: `packages/projection-consumer/src/store/bootstrap.ts`
- Modify: `packages/projection-consumer/src/index.ts`
- Create: `packages/projection-consumer/test/unit/store/seen-events-ddl.test.ts`

- [ ] **Step 18.1: Extend `types/apply.ts`**

```ts
import type { DerivedColumnBinding } from '@rntme/graph-ir-compiler';

export type MirrorHandler =
  | Readonly<{ kind: 'insert'; /* existing fields unchanged */ }>
  | Readonly<{ kind: 'update'; /* existing fields unchanged */ }>;

export type DerivedHandler = Readonly<{
  kind: 'derived';
  projectionName: string;
  tableName: string;
  aggregateType: string;
  eventType: string;
  deltaSql: string;
  bootstrapSql: string;
  deltaBindings: readonly DerivedColumnBinding[];
  filter: Readonly<{ sql: string; bindings: readonly DerivedColumnBinding[] }> | null;
}>;

export type CompiledHandler = MirrorHandler | DerivedHandler;

export type ApplyPlan = Readonly<{
  handlersByEventType: ReadonlyMap<string, readonly CompiledHandler[]>;
  mirrorsByAggregate: ReadonlyMap<string, string>;
}>;

export type ApplyResult =
  | 'applied'
  | 'skipped-no-handler'      // replaces 'skipped-no-mirror' — see note below
  | 'skipped-older-version'   // mirror-only
  | 'skipped-seen-event'      // derived-only
  | 'skipped-filter';         // derived-only
```

**Note:** Rename `'skipped-no-mirror'` → `'skipped-no-handler'` across producers and assertions — `apply-event.ts`, consumer tests, etc. This is the only cross-cutting string-literal rename; grep to confirm coverage: `grep -rn "skipped-no-mirror" packages/ demo/`.

- [ ] **Step 18.2: Add `seen_events` DDL to bootstrap**

In `packages/projection-consumer/src/store/bootstrap.ts`, after the projection-table DDL loop, `db.exec` the following:

```sql
CREATE TABLE IF NOT EXISTS seen_events (
  event_id       TEXT NOT NULL,
  projection_id  TEXT NOT NULL,
  applied_at     TEXT NOT NULL,
  PRIMARY KEY (event_id, projection_id)
);
CREATE INDEX IF NOT EXISTS idx_seen_events_applied ON seen_events(applied_at);
```

- [ ] **Step 18.3: Test the DDL**

```ts
// seen-events-ddl.test.ts
it('bootstrapProjections creates seen_events table with composite PK', () => {
  const db = new Database(':memory:');
  bootstrapProjections(db, []);  // no projections, but seen_events should still be created
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];
  expect(tables.map((t) => t.name)).toContain('seen_events');
  const info = db.prepare("PRAGMA table_info('seen_events')").all() as { name: string; pk: number }[];
  expect(info.find((c) => c.name === 'event_id')!.pk).toBe(1);
  expect(info.find((c) => c.name === 'projection_id')!.pk).toBe(2);
});
```

- [ ] **Step 18.4: Run; confirm pass**

- [ ] **Step 18.5: Commit**

```bash
git add packages/projection-consumer/src/ packages/projection-consumer/test/unit/store/seen-events-ddl.test.ts
git commit -m "feat(projection-consumer): union handler types + seen_events DDL"
```

---

## Task 19 — `projection-consumer`: compile step accepts derived handlers

**Files:**
- Modify: `packages/projection-consumer/src/apply/compile.ts`
- Modify: `packages/projection-consumer/src/apply/bind.ts`
- Create: `packages/projection-consumer/test/unit/apply/compile-derived.test.ts`

- [ ] **Step 19.1: Extend `compileApplyPlan` signature**

```ts
export function compileApplyPlan(input: {
  pdm: PdmResolver;
  qsm: ValidatedQsm;
  events: readonly EventTypeSpec[];
  derivedHandlers?: readonly DerivedHandler[];  // NEW
}): ApplyPlan;
```

Body change: build `handlersByEventType` as `Map<string, CompiledHandler[]>`. For every mirror handler, `map.get(eventType)?.push(mirror) ?? map.set(eventType, [mirror])`. For every derived handler passed in, append to the same map key. Order within a bucket: mirror first (insert/update), then derived handlers sorted by `projectionName` (stable).

- [ ] **Step 19.2: Extend bindings resolution in `bind.ts`**

Add runtime resolution for the new `DerivedColumnBinding` kinds:

```ts
export function bindDerivedValue(binding: DerivedColumnBinding, envelope: EventEnvelope): unknown {
  switch (binding.kind) {
    case 'aggregateId':
      return binding.sqlType === 'INTEGER' ? Number(envelope.aggregateId) : String(envelope.aggregateId);
    case 'payloadField': {
      const v = (envelope.payload as Record<string, unknown>)[binding.fieldName];
      return v === undefined ? null : v;
    }
    case 'eventOccurredAt':
      return envelope.occurredAt;
    case 'eventActorId':
      return envelope.actor?.id ?? null;
    case 'eventId':
      return envelope.eventId;
    case 'appliedAt':
      return new Date().toISOString();
    case 'literal':
      // `literal` never produces a runtime value — it's embedded in SQL text.
      throw new Error('literal bindings are not bound at runtime');
    case 'exprScalar':
      // exprScalar is a composition of other bindings; compile inlined them already.
      throw new Error('exprScalar bindings are decomposed at compile time');
  }
}
```

**CloudEvents field names** — after D9, `envelope.eventId` etc. are already the CE fields; the existing `ColumnBinding.kind: 'eventId'` resolves to the same value. Keep the existing `bind.ts` mirror bindings intact; add `bindDerivedValue` as a parallel entry point.

- [ ] **Step 19.3: Test compile with derived**

```ts
it('compileApplyPlan merges mirror + derived handlers under same eventType', () => {
  const derived: DerivedHandler = { kind: 'derived', projectionName: 'c', aggregateType: 'Issue', eventType: 'IssueResolved', /* ... */ };
  const plan = compileApplyPlan({ pdm, qsm, events, derivedHandlers: [derived] });
  const handlers = plan.handlersByEventType.get('IssueResolved')!;
  expect(handlers.length).toBe(2);  // mirror update + derived
  expect(handlers[0].kind).toBe('update');
  expect(handlers[1].kind).toBe('derived');
});
```

- [ ] **Step 19.4: Run; confirm pass**

- [ ] **Step 19.5: Commit**

---

## Task 20 — `projection-consumer`: `apply-event.ts` branching

**Files:**
- Modify: `packages/projection-consumer/src/apply/apply-event.ts`
- Modify: `packages/projection-consumer/src/consumer.ts`
- Create: `packages/projection-consumer/test/unit/apply/apply-event-derived.test.ts`
- Create: `packages/projection-consumer/test/integration/seen-events-dedup.test.ts`

**New signature:**

```ts
export function applyEvent(
  db: BetterSqliteDatabase,
  plan: ApplyPlan,
  envelope: EventEnvelope,
): readonly ApplyResult[];
```

**Logic (spec §6.3):**
1. `const handlers = plan.handlersByEventType.get(envelope.eventType) ?? [];`
2. If `handlers.length === 0` → return `['skipped-no-handler']`.
3. For each `handler`, compute one result via `applyOne(handler, envelope, db)`.
4. Return the array. The consumer's outer transaction covers the whole call.

**`applyOne` branches:**
- `kind === 'insert' | 'update'`: existing mirror logic (lifted from today's `applyEvent` body).
- `kind === 'derived'`:
  1. If `handler.filter`, run `db.prepare('SELECT 1 WHERE ' + handler.filter.sql).get(...params)`; if no row → return `'skipped-filter'`.
  2. `const seen = db.prepare('SELECT 1 FROM seen_events WHERE event_id = ? AND projection_id = ?').get(envelope.eventId, handler.projectionName);` — if defined → `'skipped-seen-event'`.
  3. `db.prepare(handler.deltaSql).run(...bindArray(handler.deltaBindings, envelope));`
  4. `db.prepare('INSERT INTO seen_events(event_id, projection_id, applied_at) VALUES (?, ?, ?)').run(envelope.eventId, handler.projectionName, new Date().toISOString());`
  5. Return `'applied'`.

- [ ] **Step 20.1: Unit tests**

Cover every branch: `skipped-no-handler` (no eventType), `skipped-filter`, `skipped-seen-event`, `applied` (fresh event), and the **mirror + derived coexistence** case (assert both results in array).

- [ ] **Step 20.2: Refactor `apply-event.ts`**

Extract `applyOne(handler, envelope, db)` to keep the outer loop tidy; move existing mirror code into the mirror branch verbatim.

- [ ] **Step 20.3: Integration test — dedup**

```ts
it('applying the same envelope twice increments count once', async () => {
  // boot a minimal projection-consumer with one derived handler (count by projectId)
  // apply envelope E1 (projectId=1) -> count(1)=1
  // apply E1 again -> count(1) still 1; seen_events has one row
});
```

- [ ] **Step 20.4: Update `consumer.ts` outer loop**

Today's loop (`packages/projection-consumer/src/consumer.ts`) wraps each envelope in `BEGIN IMMEDIATE … COMMIT` and calls `applyEvent`. Update to expect `readonly ApplyResult[]`; if any result is not a `'skipped-*'` / `'applied'` (i.e. a thrown error bubbles), rollback as before. Commit offsets only after the transaction commits.

- [ ] **Step 20.5: Run; confirm pass**

Run: `pnpm -F @rntme/projection-consumer test`
Expected: all pass. Check that the `'skipped-no-mirror'` rename is clean across old tests.

- [ ] **Step 20.6: Commit**

```bash
git add packages/projection-consumer/src/ packages/projection-consumer/test/
git commit -m "feat(projection-consumer): apply-event branches on handler kind (mirror + derived)"
```

---

## Task 21 — `@rntme/runtime`: cross-artifact projection validation

**Files:**
- Create: `packages/runtime/src/projections/cross-validate.ts`
- Create: `packages/runtime/src/projections/index.ts`
- Modify: `packages/runtime/src/start/start-service.ts`
- Create: `packages/runtime/test/unit/projections/cross-validate.test.ts`

**Error codes (appended to runtime's error-code set or shared one):**
- `QSM_DERIVED_UNKNOWN_GRAPH`
- `QSM_DERIVED_GRAPH_NOT_PROJECTION`
- `QSM_DERIVED_KEYS_MISMATCH`
- `QSM_DERIVED_EXPOSED_OUT_OF_RANGE` (cross-artifact check)

**Behavior:**

```ts
export function crossValidateDerivedProjections(input: {
  qsm: ValidatedQsm;
  authoringSpec: AuthoringSpec;     // graphs are inside
  pdm: ValidatedPdm;
}): Result<Map<string, DerivedCompileResult>>;
```

For each projection with `backing === 'derived'`:
1. Verify `spec.graphs[projection.source.graph]` exists — else `QSM_DERIVED_UNKNOWN_GRAPH`.
2. Compile the graph with `compileProjectionGraph(authoringSpec, pdm, qsm, { graphId, projectionTable })`. If the role is not `projection`, it errors with the graph-ir code; re-tag as `QSM_DERIVED_GRAPH_NOT_PROJECTION` in the runtime error set (keep the original code in the `hint`).
3. Verify `projection.keys` (sorted) equals the graph's `reduce.group` keys (sorted) — else `QSM_DERIVED_KEYS_MISMATCH`.
4. Verify `projection.exposed ⊆ (group keys ∪ measure names)` from the `DerivedTableSchema` — else `QSM_DERIVED_EXPOSED_OUT_OF_RANGE`.

Returns `Map<projectionName, DerivedCompileResult>` on success; the runtime passes this map downstream to `generateProjectionDdl` (Task 16) and to `compileApplyPlan` (Task 19).

- [ ] **Step 21.1: Failing tests**

One test per error code, plus a happy path.

- [ ] **Step 21.2: Implement**

- [ ] **Step 21.3: Wire into `start-service.ts`**

Insert the call right after QSM structural validation and graph parse, before DB bootstrap:

```ts
const xr = crossValidateDerivedProjections({ qsm, authoringSpec, pdm });
if (!xr.ok) throw new RuntimeConfigError('derived-projection validation failed', xr.errors);
const derivedResults = xr.value; // Map<string, DerivedCompileResult>

// Pass to DDL + apply-plan:
const ddl = generateProjectionDdl(qsm, pdm, { derivedSchemas: mapDdl(derivedResults) });
const plan = compileApplyPlan({ pdm, qsm, events, derivedHandlers: mapHandlers(derivedResults) });
```

Inline helpers `mapDdl` / `mapHandlers` transform `DerivedCompileResult` → respective input shapes. Keep them close to the call site (no need to export).

- [ ] **Step 21.4: Run; confirm pass**

- [ ] **Step 21.5: Commit**

```bash
git add packages/runtime/src/projections/ packages/runtime/src/start/start-service.ts packages/runtime/test/unit/projections/
git commit -m "feat(runtime): cross-artifact validation + wiring for derived projections"
```

---

## Task 22 — `@rntme/runtime`: `seen_events` retention job

**Files:**
- Create: `packages/runtime/src/projections/seen-events-retention.ts`
- Modify: `packages/runtime/src/start/start-service.ts`
- Create: `packages/runtime/test/unit/projections/seen-events-retention.test.ts`

**Behavior:**

```ts
export function startSeenEventsRetention(db: Database, opts?: { retentionDays?: number; intervalMs?: number }): () => void {
  const days = opts?.retentionDays ?? Number(process.env.RNTME_SEEN_EVENTS_RETENTION_DAYS ?? 30);
  const intervalMs = opts?.intervalMs ?? 60 * 60 * 1000;
  const stmt = db.prepare('DELETE FROM seen_events WHERE applied_at < ?');
  const tick = (): void => {
    const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
    stmt.run(cutoff);
  };
  // Run once at start, then on interval:
  tick();
  const handle = setInterval(tick, intervalMs);
  return () => clearInterval(handle);
}
```

- [ ] **Step 22.1: Tests**

- Happy path: inserts 3 rows with `applied_at` in distant past → tick deletes them.
- Env var override: `RNTME_SEEN_EVENTS_RETENTION_DAYS=1` respected.
- Returned dispose function clears the interval (hook into `setInterval` with fake timers).

- [ ] **Step 22.2: Implement; wire into `start-service.ts`**

Collect the disposer and call it in the service shutdown path.

- [ ] **Step 22.3: Document invariant**

Append to `packages/runtime/README.md` (or create a short `docs/operability/` note if runtime README does not exist — confirm with `ls packages/runtime/`): "seen_events retention must exceed max Kafka `retention.ms` of subscribed topics plus maximum consumer downtime; violation allows double-apply of late-redelivered envelopes".

- [ ] **Step 22.4: Commit**

---

## Task 23 — Demo: derived projection graph + qsm entry

**Files:**
- Create: `demo/issue-tracker-api/artifacts/graphs/resolvedIssueCountByProject.json`
- Modify: `demo/issue-tracker-api/artifacts/qsm.json`
- Modify: `demo/issue-tracker-api/artifacts/manifest.json` (if graphs are registered explicitly — confirm by reading manifest)

- [ ] **Step 23.1: Write the graph**

```jsonc
{
  "id": "resolvedIssueCountByProject",
  "signature": {
    "inputs": {},
    "output": { "type": "rowset<ResolvedCountRow>", "from": "r" }
  },
  "nodes": [
    {
      "id": "src",
      "type": "findMany",
      "config": { "source": { "eventType": "IssueResolved" } }
    },
    {
      "id": "r",
      "type": "reduce",
      "config": {
        "input": "src",
        "into": "ResolvedCountRow",
        "group": { "projectId": "src.projectId" },
        "measures": { "count": { "fn": "count" } }
      }
    }
  ]
}
```

- [ ] **Step 23.2: Register shape**

Confirm demo's `shapes.json` has `ResolvedCountRow` or add it:

```jsonc
"ResolvedCountRow": {
  "fields": {
    "projectId": { "type": "integer", "nullable": false },
    "count":     { "type": "integer", "nullable": false }
  }
}
```

- [ ] **Step 23.3: Add QSM projection entry**

Insert into `demo/issue-tracker-api/artifacts/qsm.json.projections`:

```jsonc
"resolvedIssueCountByProject": {
  "backing": "derived",
  "source": { "graph": "resolvedIssueCountByProject" },
  "keys": ["projectId"],
  "grain": ["projectId"],
  "exposed": ["projectId", "count"],
  "table": "projection_resolved_count"
}
```

- [ ] **Step 23.4: Typecheck + run demo build**

Run: `pnpm -F @rntme/issue-tracker-api-demo build`
Expected: PASS.

- [ ] **Step 23.5: Smoke-run the server briefly**

Run (separate terminal): `pnpm -F @rntme/issue-tracker-api-demo start`
Expected: service boots without runtime validation errors; `projection_resolved_count` table exists in SQLite.

- [ ] **Step 23.6: Commit**

```bash
git add demo/issue-tracker-api/artifacts/
git commit -m "feat(demo): resolvedIssueCountByProject derived projection"
```

---

## Task 24 — Demo e2e: derived projection end-to-end

**Files:**
- Create: `demo/issue-tracker-api/test/e2e/derived-projection.test.ts`

**Test flow:**
1. Boot service (in-memory SQLite + in-memory bus — same pattern as existing demo e2e tests).
2. POST three `ReportIssue` + `ResolveIssue` command pairs across two projects.
3. Query the projection table (direct DB access in the test, or via a bindings query graph if one exists over this projection): expect `[{ projectId: 1, count: 2 }, { projectId: 2, count: 1 }]`.
4. Re-emit the same `IssueResolved` envelope through the in-memory bus (duplicate delivery simulation) — assert counts unchanged and `seen_events` has exactly 3 rows.

- [ ] **Step 24.1: Identify existing e2e test pattern**

Run: `ls demo/issue-tracker-api/test/e2e/` and read one existing file to copy the bootstrap helper.

- [ ] **Step 24.2: Write the test**

Replicate the existing helper; assert per step 4 above.

- [ ] **Step 24.3: Run**

Run: `pnpm -F @rntme/issue-tracker-api-demo test:e2e` (or whichever script runs e2e — check `demo/issue-tracker-api/package.json`).
Expected: PASS.

- [ ] **Step 24.4: Commit**

```bash
git add demo/issue-tracker-api/test/e2e/derived-projection.test.ts
git commit -m "test(demo): e2e derived projection + dedup assertion"
```

---

## Task 25 — Full-workspace verification + gap-doc flip + plan archive

**Files:**
- Modify: `docs/gaps/2026-04-15-event-driven-canonical-audit.md` — update D5 verdict from ❌ to ✅ with a resolution note.
- Move: `docs/history/plans/historical/2026-04-18-d5-consumer-idempotency-hybrid.md` → `docs/history/plans/historical/2026-04-18-d5-consumer-idempotency-hybrid.md` (follows existing archive pattern — confirm with `ls docs/history/plans/historical/`).

- [ ] **Step 25.1: Full workspace checks**

Run in parallel:
- `pnpm -r run typecheck`
- `pnpm -r run lint`
- `pnpm -r run test`

Expected: all green. If any red, fix in a focused commit before proceeding.

- [ ] **Step 25.2: Update D5 verdict**

In `docs/gaps/2026-04-15-event-driven-canonical-audit.md`, change the D5 row in the verdict matrix:

```md
| **D5** | ... | ... | ✅ resolved 2026-04-18 (hybrid: last_event_version + seen_events; graph-IR for derived) |
```

And replace the body of §D5 with a "Resolved" preamble summarising what shipped:
- `seen_events(event_id, projection_id)` table.
- `{ eventType }` source in graph-IR with `projection` role and operator whitelist.
- `compileProjectionGraph` public API emitting `bootstrapSql` + `deltaSql`.
- QSM accepts `source: { graph }`; runtime cross-validates.
- Demo ships `resolvedIssueCountByProject` with e2e dedup proof.
- Retention: 30-day default via `RNTME_SEEN_EVENTS_RETENTION_DAYS`.

Preserve the original gap statement below the preamble (same format as D1/D9/D10 entries).

- [ ] **Step 25.3: Update remediation-order summary**

In the same file's "Remaining, ordered by (priority, dependency)" list, remove D5 and move it into "Shipped".

- [ ] **Step 25.4: Archive the plan**

Run: `git mv docs/history/plans/historical/2026-04-18-d5-consumer-idempotency-hybrid.md docs/history/plans/historical/`

- [ ] **Step 25.5: Commit**

```bash
git add docs/gaps/2026-04-15-event-driven-canonical-audit.md docs/history/plans/historical/
git commit -m "docs(gaps): D5 resolved — hybrid idempotency + graph-IR derived projections"
```

---

## Out of scope (tracked for follow-ups, NOT in this plan)

- `source: { entity: X }` delta-from-mirror for derived projections.
- `source: { eventLog: {...} }` union-of-event-types source.
- `reduce` aggregates: `min`, `max`, `avg`, `count_distinct`, `group_array`.
- `sort` / `limit` / `distinct` / `lookupOne` in projection-role graphs.
- `exists`-subquery inside `filter`.
- `rntme projection rebuild <name>` CLI (the `bootstrapSql` artifact lands in MVP to unblock this).
- Snapshot / restore for derived tables.
- Cross-service derived read-models (ksqlDB territory — D3).
- HTTP Ops surface for `seen_events` size / retention health.

These are documented in `docs/gaps/2026-04-15-event-driven-canonical-audit.md` under their respective decisions, and in the spec §1 "Non-goals" / §11 "Risks & open questions".
