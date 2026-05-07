> Status: historical.
> Date: 2026-04-18.
> Current source: docs/current/**, docs/decision-system.md, and current code/tests.
> Why retained: Historical rationale and execution context retained for review; it is not current-state truth by itself.

# D5 · Consumer Idempotency Hybrid — Design

**Status.** Proposed (2026-04-18). Closes gap D5 in `docs/gaps/2026-04-15-event-driven-canonical-audit.md`.

**Scope.** Unblock non-mirror (derived) projections by (i) introducing a hybrid consumer idempotency strategy — per-row `last_event_version` for mirror projections **plus** a shared `seen_events(event_id, projection_id)` table for derived projections — and (ii) enabling derived projections to be authored in the existing graph-IR, with a tightly constrained MVP operator whitelist. No new DSL is introduced for derived projections; the same graph-IR that powers query graphs is reused.

**Non-goals.** `source: { entity: X }` delta-from-mirror derived projections; multi-eventType sources; `min` / `max` / `avg` / `count_distinct` / `group_array`; `sort` / `limit` / `distinct` / `lookupOne` in derived graphs; `exists`-subqueries inside `filter`; snapshot / restore; rebuild-CLI; cross-service derived (ksqlDB territory — tracked under D3).

---

## 1 · Motivation

The gap audit (D5) records that `packages/projection-consumer/src/apply/apply-event.ts` supports only the per-row `last_event_version` dedup path. This is a correct Confluent "Idempotent Writer" implementation for entity-mirror projections, but it is structurally unable to host counters, top-N, windowed aggregates, or any read model whose rows are not keyed by a single aggregate id. `@rntme/qsm` validator rejects `backing: "derived"` at cross-ref time as a direct consequence — there is nowhere safe to apply the delta.

The goal is to unblock the category without inventing a second authoring surface: users already describe aggregations in graph-IR (`reduce`, `count`, `sum`, `group`), and `sprintBurndown.json` demonstrates that pull-query graphs over entity-mirrors already express derived read models. Reusing the same IR for materialized projections means **one** language, **one** validator surface, and **one** mental model.

## 2 · Architecture overview

Derived projections compile through the same graph-IR pipeline as query graphs, but with a new source kind, a new role, and a second lowering step:

```
┌─────────────────┐     role=query       ┌──────────────────────┐
│  graph-IR parse │ ───────────────────▶ │ lower/sqlite/lower   │ → SELECT SQL
│  + semantic     │                      └──────────────────────┘
│  validate       │     role=projection  ┌──────────────────────┐
│                 │ ───────────────────▶ │ lower/sqlite/event-  │ → bootstrapSql
└─────────────────┘                      │   delta/lower (NEW)  │ → deltaSql + bindings
                                         └──────────────────────┘
```

The QSM artifact declares a derived projection by naming the graph: `{ backing: "derived", source: { graph: "<name>" } }`. `@rntme/qsm` compilation produces a `DerivedHandler` per `(projection, eventType)` pair; `@rntme/projection-consumer` consumes a union `MirrorHandler | DerivedHandler` and branches on `kind` in `apply-event.ts`. Idempotency for derived handlers is enforced through a shared `seen_events(event_id, projection_id)` table; mirror handlers keep the existing `last_event_version` per-row guard unchanged.

Bootstrap in MVP is forward-only: derived tables start empty and accumulate from the first envelope that passes the consumer (seed replay is how a fresh service populates them). A future `rntme projection rebuild` CLI will consume `bootstrapSql` — which is generated but unused by the MVP consumer.

## 3 · Graph-IR changes

### 3.1 New `FindManySource` variant

```ts
type FindManySource =
  | { entity: string }      // existing
  | { projection: string }  // existing
  | { eventType: string };  // new
```

A derived graph has exactly one `findMany` node whose `source` is `{ eventType: X }` and which is the root of the graph. The row shape exposed to downstream nodes is:

| Field path | Source |
|---|---|
| `$event.aggregateId` | `envelope.rntaggregateid`, coerced to the PDM-declared key type |
| `$event.occurredAt` | `envelope.time` |
| `$event.actorId`    | `envelope.rntactorid` (nullable) |
| `<payloadFieldName>` | `json_extract(envelope.data, '$.<name>')`, typed from `deriveEventTypes(pdm)` |

`eventType` must exist in `deriveEventTypes(pdm)` output. An unknown `eventType` is `PROJ_SEMANTIC_UNKNOWN_EVENT_TYPE`. An unknown payload-field path is `PROJ_SEMANTIC_UNKNOWN_FIELD`.

### 3.2 New role: `projection`

`inferRole` (`packages/graph-ir-compiler/src/role/infer.ts`) returns `projection` when the root `findMany.source` is `{ eventType }`. The role gates the operator whitelist:

| Operator | Allowed in `projection` role? |
|---|---|
| `findMany { eventType }` | Yes (exactly one, must be root) |
| `filter` | Yes; `exists`-subquery disallowed |
| `map` | Yes |
| `reduce` with `count` / `sum` | Yes |
| `reduce` with `min` / `max` / `avg` / `count_distinct` / `group_array` | **No** — `PROJ_SEMANTIC_UNSUPPORTED_AGG` |
| `reduce.group` with non-field-path expressions | **No** — `PROJ_SEMANTIC_UNSUPPORTED_GROUP` |
| `sort`, `limit`, `distinct`, `lookupOne` | **No** — `PROJ_SEMANTIC_UNSUPPORTED_OP` |

Rationale for the whitelist: delta-lowering for `count` / `sum` is trivial (`+1` / `+expr` on conflict). `min` / `max` are monotonic on append-only streams but require a different UPSERT shape and are deferred. `avg` derives from `sum/count` but needs two measure columns; deferred. `count_distinct` requires HLL or a member set; deferred. `sort + limit` (top-N) under retractions requires full re-scan; deferred.

### 3.3 New lowering: `lower/sqlite/event-delta/`

Input: the same `RelationalPlan` that `lower/sqlite/lower.ts` consumes. Output:

```ts
type DerivedCompileResult = {
  bootstrapSql: string;
  deltaSql: string;
  deltaBindings: readonly ColumnBinding[];
  filter: { sql: string; bindings: readonly ColumnBinding[] } | null;
  tableSchema: DerivedTableSchema;
};

type DerivedTableSchema = {
  groupColumns: readonly { name: string; sqlType: SqlType }[];
  measureColumns: readonly {
    name: string;
    fn: 'count' | 'sum';
    sqlType: SqlType;
    initialSql: string;          // '1' for count, or the expr SQL for sum-on-first
    deltaSql: string;            // 'count_col + 1', or 'sum_col + excluded.sum_col'
  }[];
};
```

**`bootstrapSql`** template:

```sql
INSERT INTO "<table>"(<group_cols>, <measure_cols>, last_event_id, applied_at)
SELECT <group_exprs>,
       <measure_exprs>,
       '' AS last_event_id,
       strftime('%Y-%m-%dT%H:%M:%fZ','now') AS applied_at
FROM event_log
WHERE event_type = '<EventTypeName>'
  [AND <filter_expr>]   -- optional clause, emitted only if the graph has a `filter` node
GROUP BY <group_cols>;
```

In `bootstrapSql` the filter IS embedded (it is replayed against historical rows, where there is no envelope to bind against). This diverges from `deltaSql`, where the filter is lifted out. `<filter_expr>` references `json_extract(payload_json, '$.<field>')` for payload fields and `aggregate_id` / `occurred_at` / `actor_id` columns directly. Generated but not invoked by the MVP consumer — kept so that a future rebuild-CLI has the artifact it needs.

**`deltaSql`** template (one UPSERT statement executed per accepted envelope):

```sql
INSERT INTO "<table>"(<group_cols>, <measure_cols>, last_event_id, applied_at)
VALUES (<group_binding_placeholders>, <measure_initial_placeholders>, ?, ?)
ON CONFLICT(<group_cols>) DO UPDATE SET
  <each measure_col> = <measure_col.deltaSql>,
  last_event_id = excluded.last_event_id,
  applied_at    = excluded.applied_at;
```

**`filter`** is lifted out of the main delta path and compiled to a standalone predicate SQL: `SELECT 1 WHERE <filterSql>` (SQLite allows `SELECT` without `FROM` — the expression is evaluated over bound placeholders alone). Bindings reuse the same `ColumnBinding` kinds (`payloadField`, `aggregateId`, …) and are populated from the envelope at runtime. The consumer prepares the filter statement once per handler, runs it before the UPSERT, and skips when no row is returned. Rationale: pushing `filter` into the UPSERT's `ON CONFLICT WHERE` makes the SQL harder to read and does not save a round-trip (the INSERT path of the UPSERT would still run); a separate predicate keeps the delta SQL simple and reuses the existing `lower/sqlite/expr.ts` Expr-to-SQL machinery without inventing a JavaScript evaluator.

**`deltaBindings`** reuses the existing `ColumnBinding` vocabulary from `@rntme/projection-consumer/src/types/apply.ts` with one addition:

```ts
| Readonly<{ kind: 'exprScalar'; sql: string; bindings: readonly ColumnBinding[] }>
```

`exprScalar` handles `reduce.measures.someKey = { fn: 'sum', expr: { mul: [...] } }`: the compiler emits the SQL fragment that evaluates the expression over placeholders, plus the recursive bindings.

## 4 · QSM artifact changes

### 4.1 New projection shape

```jsonc
{
  "projections": {
    "resolvedIssueCountByProject": {
      "backing": "derived",
      "source": { "graph": "resolvedIssueCountByProjectGraph" },
      "keys": ["projectId"],
      "grain": ["projectId"],
      "exposed": ["projectId", "count", "totalStoryPoints"],
      "table": "projection_resolved_count"
    }
  }
}
```

`keys` and `grain` are declarative duplicates of the graph's `reduce.group` (required to equal it, checked by the validator — keeps QSM artifact self-describing without reading the graph). `exposed` must be a subset of `(group keys ∪ measure names)`.

### 4.2 Validator changes

`packages/qsm/src/validate/cross-ref.ts` — the current rejection of `backing: "derived"` is replaced with:

1. `source.graph` is present and is a non-empty string; `source.entity` is absent (`QSM_DERIVED_SOURCE_SHAPE`).
2. `keys` and `grain` match each other element-wise (same rule as mirror).
3. `exposed` ⊆ (group keys ∪ measure names) — validated against graph-derived schema, so this check moves to a cross-artifact layer in `@rntme/runtime` where both artifacts are visible. Error code `QSM_DERIVED_EXPOSED_OUT_OF_RANGE`.

Cross-artifact validation (graph existence, role, keys/group match) runs in `@rntme/runtime` startup, where both QSM and graph artifacts are loaded:

- `QSM_DERIVED_UNKNOWN_GRAPH` — graph name not found in authoring spec.
- `QSM_DERIVED_GRAPH_NOT_PROJECTION` — graph's role is not `projection`.
- `QSM_DERIVED_KEYS_MISMATCH` — QSM `keys` differ from graph `reduce.group` keys.

## 5 · DDL for derived tables

`packages/qsm/src/derive/ddl.ts` — `buildSpec` branches on `proj.backing`. For `derived`:

- `ResolvedEntity` path is not used. Instead, `buildSpec` receives the compiled `DerivedTableSchema` (produced by graph-ir-compiler in step 3.3) and lays out columns directly.
- Columns: group keys (types from PDM event-type) → measure columns (types and defaults from `DerivedTableSchema`) → `last_event_id TEXT NOT NULL` → `applied_at TEXT NOT NULL`.
- `last_event_version` is **omitted** — versions are meaningless for derived aggregates whose rows are not aggregate-keyed.
- `PRIMARY KEY (<group keys>)`; no extra state-machine indices (no `stateMachine` on a derived row).

The existing `IDEMPOTENCY_COLUMNS` constant becomes a helper whose output depends on `backing`:

```ts
function idempotencyColumnsFor(backing: ProjectionBacking): ColumnSpec[] {
  return backing === 'entity-mirror'
    ? [ /* current three */ ]
    : [
        { name: 'last_event_id', sqlType: 'TEXT', nullable: false, primaryKey: false },
        { name: 'applied_at',    sqlType: 'TEXT', nullable: false, primaryKey: false },
      ];
}
```

## 6 · Shared `seen_events` table + consumer branch

### 6.1 DDL

Owned by `@rntme/projection-consumer` bootstrap (`packages/projection-consumer/src/store/bootstrap.ts`), added alongside derived-projection tables:

```sql
CREATE TABLE IF NOT EXISTS seen_events (
  event_id       TEXT NOT NULL,
  projection_id  TEXT NOT NULL,
  applied_at     TEXT NOT NULL,
  PRIMARY KEY (event_id, projection_id)
);
CREATE INDEX IF NOT EXISTS idx_seen_events_applied ON seen_events(applied_at);
```

Composite PK because one envelope can apply to multiple derived projections. Index on `applied_at` supports the retention job (§6.4).

### 6.2 Types

`packages/projection-consumer/src/types/apply.ts`:

```ts
export type MirrorHandler =
  | Readonly<{ kind: 'insert'; /* ...existing fields... */ }>
  | Readonly<{ kind: 'update'; /* ...existing fields... */ }>;

export type DerivedHandler = Readonly<{
  kind: 'derived';
  projectionName: string;
  tableName: string;
  aggregateType: string;      // from graph's eventType → aggregateType lookup
  eventType: string;
  deltaSql: string;
  bootstrapSql: string;       // retained for future rebuild-CLI; not invoked in MVP
  bindings: readonly ColumnBinding[];
  /** `SELECT 1 WHERE <sql>` run against bound envelope values. `null` = accept all. */
  filter: Readonly<{ sql: string; bindings: readonly ColumnBinding[] }> | null;
}>;

export type CompiledHandler = MirrorHandler | DerivedHandler;

export type ApplyPlan = Readonly<{
  handlersByEventType: ReadonlyMap<string, readonly CompiledHandler[]>;
  mirrorsByAggregate: ReadonlyMap<string, string>;
}>;

export type ApplyResult =
  | 'applied'
  | 'skipped-no-handler'
  | 'skipped-older-version'   // mirror path only
  | 'skipped-seen-event'      // derived path only
  | 'skipped-filter';         // derived path only
```

`handlersByEventType` becomes `ReadonlyMap<string, readonly CompiledHandler[]>` (was single handler per event type). Multiple handlers may fire for one envelope: zero-or-one mirror handler plus zero-or-more derived handlers. Order is deterministic: mirror first, then derived handlers sorted by `projectionName` — failure in any rolls back the whole envelope.

### 6.3 Apply-event branching

`packages/projection-consumer/src/apply/apply-event.ts` returns a `readonly ApplyResult[]` (one per handler that fired). The consumer outer loop (`consumer.ts`) keeps its `BEGIN IMMEDIATE … COMMIT` around the full handler array.

Per-handler logic:

- **Mirror** (`'insert'` or `'update'`): unchanged from today.
- **Derived**:
  1. If `handler.filter` is set: run `handler.filter.sql` with `bind(handler.filter.bindings, envelope)`; if the prepared statement returns zero rows, `return 'skipped-filter';`.
  2. `SELECT 1 FROM seen_events WHERE event_id = ? AND projection_id = ?` → if row found, `return 'skipped-seen-event';`
  3. Execute `handler.deltaSql` with `bind(handler.bindings, envelope)`.
  4. `INSERT INTO seen_events(event_id, projection_id, applied_at) VALUES (?, ?, now)`.
  5. `return 'applied';`

Step 2 + step 4 are the dedup handshake. Both run inside the same transaction as step 3, so a crash between 3 and 4 rolls everything back and re-delivery re-applies idempotently.

### 6.4 Retention

`@rntme/runtime` startup schedules a periodic cleanup:

```ts
setInterval(() => {
  const cutoff = new Date(Date.now() - retentionDays * 86_400_000).toISOString();
  db.prepare('DELETE FROM seen_events WHERE applied_at < ?').run(cutoff);
}, 60 * 60 * 1000);
```

`retentionDays` defaults to 30, overridable via `RNTME_SEEN_EVENTS_RETENTION_DAYS`. **Invariant (documented):** retention must exceed the maximum late-redelivery window of the broker + consumer (effectively Kafka's `retention.ms` for the topic plus consumer downtime budget). Violating this invariant can cause a late-redelivered envelope to be applied twice.

## 7 · Bootstrap in MVP

Derived tables start empty. The MVP consumer **never** invokes `bootstrapSql`. Three practical boot shapes:

1. **New service with seed.** `@rntme/seed` replays the event stream; derived handlers apply in order as each envelope passes. Resulting state is equivalent to full rebuild.
2. **New service subscribing to Kafka `earliest`.** Equivalent outcome, driven by consumer lag-catch-up. Requires Kafka retention to cover the full history (D3 territory).
3. **Adding a new derived projection to an existing service.** Not supported in MVP: the consumer will start applying from the next envelope onward, leaving the table under-aggregated. Documented as a known limitation. Workaround: regenerate from a fresh DB using option 1 or 2.

The `bootstrapSql` artifact is still compiled and carried in `DerivedHandler` so that the future rebuild-CLI has zero additional compile work to do.

## 8 · Error codes (additions)

Appended to existing tables (never reordered, per project convention):

| Code | Layer | Trigger |
|---|---|---|
| `QSM_DERIVED_SOURCE_SHAPE` | qsm/cross-ref | `backing: "derived"` with missing `source.graph` or extra `source.entity` |
| `QSM_DERIVED_UNKNOWN_GRAPH` | runtime/cross-artifact | `source.graph` name not in authoring spec |
| `QSM_DERIVED_GRAPH_NOT_PROJECTION` | runtime/cross-artifact | Referenced graph's inferred role ≠ `projection` |
| `QSM_DERIVED_KEYS_MISMATCH` | runtime/cross-artifact | QSM `keys` differ from graph `reduce.group` |
| `QSM_DERIVED_EXPOSED_OUT_OF_RANGE` | runtime/cross-artifact | `exposed` contains a name not in group ∪ measures |
| `PROJ_SEMANTIC_UNKNOWN_EVENT_TYPE` | graph-ir/semantic | `findMany { eventType }` references an eventType not in `deriveEventTypes(pdm)` |
| `PROJ_SEMANTIC_UNKNOWN_FIELD` | graph-ir/semantic | A referenced payload field is not in the event-type's `payloadFields` |
| `PROJ_SEMANTIC_UNSUPPORTED_AGG` | graph-ir/semantic | `reduce` uses `min` / `max` / `avg` / `count_distinct` / `group_array` |
| `PROJ_SEMANTIC_UNSUPPORTED_GROUP` | graph-ir/semantic | `reduce.group` contains a non-field-path expression |
| `PROJ_SEMANTIC_UNSUPPORTED_OP` | graph-ir/semantic | Graph with `projection` role contains `sort` / `limit` / `distinct` / `lookupOne` |

## 9 · Testing

### 9.1 Unit — `@rntme/graph-ir-compiler`

- `test/unit/lower/event-delta/count.test.ts` — `reduce { count }` single-group → expected `deltaSql`, `bootstrapSql`, `bindings`.
- `test/unit/lower/event-delta/sum-expr.test.ts` — `reduce { sum: { expr: { mul: [...] } } }` with `exprScalar` binding.
- `test/unit/lower/event-delta/multi-group.test.ts` — `group: { projectId, status }` → composite PK, two group columns.
- `test/unit/lower/event-delta/filter-lift.test.ts` — `filter` is lifted out into `filter.sql` / `filter.bindings`; `deltaSql` does **not** reference the filter expression.
- `test/unit/validate/semantic/projection-whitelist.test.ts` — each forbidden operator and aggregate produces the correct error code.

### 9.2 Unit — `@rntme/qsm`

- `test/unit/validate/derived-projection.test.ts` — exercises every `QSM_DERIVED_*` error code and the happy path.
- `test/unit/derive/ddl-derived.test.ts` — DDL has no `last_event_version`, has `last_event_id`, PK = group keys, measure defaults correct.

### 9.3 Unit — `@rntme/projection-consumer`

- `test/unit/apply-event-derived.test.ts` — `'applied'`, `'skipped-seen-event'`, `'skipped-filter'`, plus mirror+derived coexistence for the same event type.
- `test/unit/seen-events-retention.test.ts` — retention DELETE respects cutoff.

### 9.4 Integration

- `packages/projection-consumer/test/integration/seen-events-dedup.test.ts` — same envelope delivered twice → counter incremented exactly once; `seen_events` has one row.
- `packages/projection-consumer/test/integration/derived-bootstrap-forward.test.ts` — boot with empty table, replay N events from seed, counter reaches N; replay same seed again → counter stays at N.

### 9.5 E2E

`demo/issue-tracker-api` grows one derived projection — `resolvedIssueCountByProject` — with accompanying graph `resolvedIssueCountByProjectGraph.json` (findMany on eventType `IssueResolved` → reduce count by projectId). Test: submit 3 Issue resolutions across 2 projects → projection has correct counts → re-deliver the same envelopes → counts unchanged.

## 10 · Migration & rollout

No runtime migration needed — the `seen_events` table is new, the existing `last_event_version` path is untouched, and no existing projection uses `backing: "derived"`. The only breaking surface is the `ApplyPlan.handlersByEventType` value type (single handler → array of handlers), which is an internal contract between `@rntme/qsm` compile and `@rntme/projection-consumer`. Both packages are in the same pnpm workspace and will be updated atomically in the implementation PR.

Demo's `qsm.json` and new graph artifact are additive — all current entity-mirror projections stay exactly as they are.

## 11 · Risks & open questions

- **Seed ordering.** Seed replay must apply derived handlers for every event they subscribe to. Currently seed feeds envelopes through the same consumer path, so this falls out for free, but the seed test harness should assert a derived projection reaches the expected count after replay.
- **Retention vs. late delivery.** If `RNTME_SEEN_EVENTS_RETENTION_DAYS` is set below Kafka retention, late re-deliveries can double-apply. Default 30d is safe for typical topic retention (7-14d); the ops appendix (D3) should cross-reference this invariant when it lands.
- **DDL drift.** Derived table schema is fully determined by the graph; graph edits that change group keys or measures break the existing table. Implementation should detect and fail startup (`CREATE TABLE IF NOT EXISTS` succeeds silently on mismatch). Out of scope for this design — tracked as a follow-up ops concern.
- **Migration from "derived rejected" today.** `@rntme/qsm` tests that currently assert rejection of `backing: "derived"` must flip to the new happy path. The gap doc D5 remediation sketch point (4) lists this.

## 12 · References

- `docs/gaps/2026-04-15-event-driven-canonical-audit.md` — D5 gap statement this spec resolves.
- `docs/adr/2026-04-15-event-driven-architecture.md` — ADR D5 canonical design.
- `graph_ir_rc_7.md` — authoring-IR spec (`findMany`, `filter`, `map`, `reduce` semantics).
- `packages/pdm/src/derive/event-types.ts` — `deriveEventTypes(pdm)` supplies event-type payload shapes used by the new `eventType` source.
- `packages/projection-consumer/src/apply/apply-event.ts` — today's mirror-only apply path, to be extended.
- `packages/qsm/src/validate/cross-ref.ts` — current rejection of `derived`, to be replaced.
- `packages/qsm/src/derive/ddl.ts`, `packages/qsm/src/derive/handler.ts` — today's DDL and handler derivation for mirror projections.
