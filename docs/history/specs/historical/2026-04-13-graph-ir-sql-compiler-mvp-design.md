> Status: historical.
> Date: 2026-04-13.
> Current source: docs/current/**, docs/decision-system.md, and current code/tests.
> Why retained: Historical rationale and execution context retained for review; it is not current-state truth by itself.

# Graph IR → SQL Compiler — MVP Design

**Date:** 2026-04-13
**Status:** Approved for implementation planning
**Scope:** Tier 1 MVP, single target (SQLite)
**Source spec:** `graph_ir_rc_7.md` (see "Deviations from spec" below)

---

## 1. Goal

Build a TypeScript library that compiles Graph IR authoring specs into executable SQL against SQLite, with a TDD-driven implementation and real end-to-end tests against an in-memory database.

The goal is a working tool, not a literal implementation of every section of rc7. Where the spec is underspecified, contradictory, or would add MVP cost with no Tier 1 benefit, this document records a justified deviation.

## 2. Scope

### 2.1. In scope (Tier 1)

- **Node catalog (§8.1):** `findMany`, `filter` (inline expr only), `map` (plain fields + EXPR), `reduce`, `sort`, `limit`.
- **EXPR grammar (§9.1) excluding:** `exists`, `in`, `lookup` (expr and node), list literals, `$list`.
- **Input modes (§6.3):** all five — `root`, `required`, `nullable`, `defaulted`, `predicate_optional`.
- **Shape system (§4):** named shapes in `shapes`, PDM entity rows, QSM projection rows.
- **Validation Layer A (§20.1):** full structural validation.
- **Validation Layer B (§20.2):** field resolution, source resolution, type checking with coercion rules from §9.5, shape conformance, nullability propagation, aggregate phase correctness. Join-safety checks (functional lookup safety, ambiguous path, chasm trap) are not relevant at Tier 1 because `lookupOne` / `lookup` expr are excluded.
- **Target:** SQLite dialect only. Driver: `better-sqlite3` (synchronous).
- **Execution:** in-process, against a caller-supplied `Database` instance.
- **TDD workflow:** unit per layer, golden tests for compile output, e2e tests against `:memory:` SQLite.

### 2.2. Out of scope (explicit)

- `distinct`, `lookupOne`, `lookup` expr in `map.fields`, named predicate graphs via `filter.predicate`, `exists` operator, `in` operator, `list<T>` parameters.
- Role inference (§6.5) beyond rule #4 (`query`). Predicate/mapper/reducer graphs are not supported in MVP.
- Planner / optimizer (§18) — a no-op identity pass is kept as an extension point.
- Capability inference (§14) and Layer C / Layer D validations.
- Binding artifact (§21), HTTP exposure, stream bindings.
- Mutations, window functions, set operations, security scopes (§24).
- YAML authoring format (JSON only in MVP).
- Multi-dialect support. PostgreSQL/ksqlDB/etc. deferred to later.

### 2.3. Deviations from spec rc7

1. **Input-mode `nullable` in Tier 1.** Spec §6.3 lists it but the semantics are thin. MVP treats it as a regular nullable value in EXPR; if it turns out unused in Tier 1 examples, we document it as "pass-through" and revisit in Tier 2.
2. **`between` and `coalesce` in canonical IR.** Spec §9.1 lists them as first-class operators. Canonical IR keeps them as first-class operators (not lowered to primitives) because SQLite supports them natively. Lowering to primitives only happens if a future dialect doesn't.
3. **Error accumulation within a layer.** Spec doesn't prescribe this; MVP collects all independent errors in one layer before stopping.

Any additional deviations discovered during implementation are documented in the implementation plan.

## 3. Deliverable

- **Type:** single npm package, TypeScript (ESM), Node.js ≥ 20.
- **Package manager:** pnpm.
- **Test framework:** Vitest.
- **Linter/formatter:** eslint + prettier.
- **CI:** GitHub Actions, single Node 20 matrix, `pnpm install --frozen-lockfile && pnpm test && pnpm lint`.

## 4. Public API

```ts
// Compile graph spec + PDM/QSM → SQL with positional placeholders.
compile(
  spec: GraphSpec,
  pdm: Pdm,
  qsm: Qsm,
  options?: { target?: 'sqlite' }
): Result<CompileResult>;

// Execute compiled result against a better-sqlite3 Database.
execute(
  compiled: CompileResult,
  paramValues: Record<string, unknown>,
  db: import('better-sqlite3').Database
): unknown[];

// Convenience: compile + execute in one call.
run(spec, pdm, qsm, paramValues, db, options?): unknown[];

// Intermediate artifacts for debugging/tooling (§23 subset).
explain(spec, pdm, qsm, options?): ExplainOutput;

type CompileResult = {
  sql: string;
  paramOrder: string[];       // signature input names in order of `?` occurrence
  shape: NamedShapeRef;        // output shape reference
};

type Result<T> =
  | { ok: true; value: T }
  | { ok: false; errors: GraphIrError[] };

type GraphIrError = {
  layer: 'parse' | 'structural' | 'canonical' | 'semantic'
       | 'semantic-plan' | 'relational' | 'lowering' | 'runtime';
  code: string;               // stable machine-readable, e.g. "STRUCT_DUPLICATE_NODE_ID"
  message: string;
  location?: { graphId?: string; nodeId?: string; path?: string };
  hint?: string;
};
```

`compile()` returns `Result`; errors are collected, not thrown.
`execute()` throws on runtime errors (missing required param, SQLite failure).

## 5. PDM / QSM formats (MVP)

Spec rc7 treats PDM and QSM as external artifacts without defining a concrete format. MVP fixes minimal JSON shapes sufficient for Tier 1.

### 5.1. PDM

```json
{
  "entities": {
    "OrderItem": {
      "table": "order_items",
      "fields": {
        "id":        { "type": "integer", "nullable": false, "column": "id" },
        "orderId":   { "type": "integer", "nullable": false, "column": "order_id" },
        "productId": { "type": "integer", "nullable": false, "column": "product_id" },
        "unitPrice": { "type": "decimal", "nullable": false, "column": "unit_price" },
        "quantity":  { "type": "integer", "nullable": false, "column": "quantity" }
      },
      "relations": {
        "order":   { "to": "Order",   "cardinality": "one", "localKey": "orderId",   "foreignKey": "id" },
        "product": { "to": "Product", "cardinality": "one", "localKey": "productId", "foreignKey": "id" }
      },
      "keys": ["id"]
    }
  }
}
```

- `table` and `column` attributes give physical mapping to SQLite tables (MVP addition — spec assumes this exists implicitly).
- `relations[].cardinality`: only `one` is required in Tier 1 (MVP excludes fan-out).
- `keys`: primary keys for functional dependency reasoning.

### 5.2. QSM

```json
{
  "projections": {
    "CategorySalesProjection": {
      "grain": ["categoryId"],
      "keys":  ["categoryId"],
      "exposed": ["revenue", "lineCount", "categoryName"],
      "source": { "entity": "OrderItem", "pathPrefix": "orderItem.product.category" }
    }
  },
  "relationRoles": {
    "OrderItem.order":   "fact",
    "OrderItem.product": "dimension"
  }
}
```

Tier 1 uses `findMany.source.entity` for the category sales example; `projection` source is supported structurally but need not be exercised in MVP fixtures.

## 6. Architecture: faithful 7-layer pipeline

Mirrors §15 compile pipeline. Each layer is a pure function returning `Result`.

```
authoring JSON
  │ parse              → AuthoringSpec
  │ validate/structural → StructurallyValidSpec      (Layer A, §20.1)
  │ canonical           → CanonicalGraph             (§16)
  │ validate/semantic   → SemanticallyValidGraph     (Layer B, §20.2, against PDM/QSM)
  │ semantic-plan       → SemanticPlan               (§17, central contract)
  │ relational          → RelAlgPlan                 (§19)
  │ lower/sqlite        → CompileResult
  ▼
{ sql, paramOrder, shape }
```

### 6.1. Project structure

```
src/
  parse/                  # JSON → AuthoringSpec (Zod schema)
  validate/
    structural/           # Layer A
    semantic/             # Layer B (takes PDM/QSM)
  canonical/              # Canonical Graph IR
  semantic-plan/          # Scope, shape, nullability, cardinality propagation
  relational/             # Scan, Project, Filter, Join, Aggregate, Sort, Limit
  lower/
    sqlite/               # RelAlg → SQL AST → string + paramOrder
  execute/                # better-sqlite3 wrapper + param binding
  api.ts                  # public exports: compile, execute, run, explain
  types/                  # shared TS types, Result, GraphIrError
test/
  unit/                   # per-layer (co-located under src also acceptable)
  golden/                 # input JSON + expected SQL + expected paramOrder
  e2e/
    fixtures/             # commerce.sql, commerce.pdm.json, commerce.qsm.json
    *.e2e.test.ts
```

### 6.2. Canonical Graph IR (§16) — Tier 1 content

For Tier 1 (no sugar), canonical IR is close to a mirror of authoring spec plus:

- explicit scope ids attached to each node;
- `$root` references resolved to scope alias;
- typed operator nodes (no string-keyed polymorphism at the lowering layer);
- shape references inlined to typed field sets;
- `config.input` references resolved to actual upstream node references.

This is still a separate layer because once Tier 2 adds `lookup` expr / `lookupOne` / named predicates, canonical IR is where they get lowered into explicit join operators.

### 6.3. Semantic plan (§17) — content

- Resolved sources (entity → physical table; projection → source path).
- Join plan (initially only from dot-navigation in field paths — e.g. `orderItem.order.createdAt` → `OrderItem JOIN Order`).
- Phase boundaries (pre-aggregate vs post-aggregate filters).
- Scope at each node (set of accessible field paths).
- Shape at each node (propagated from input + operator).
- Nullability propagation (e.g. left joins mark right-side fields nullable).
- Cardinality class (row vs rowset).
- Aggregate grouping semantics (for `reduce`).

Semantic plan is the **only** contract between frontend (parse → semantic) and backend (relational → lower). Future dialects plug in behind semantic plan.

### 6.4. Relational Algebra Plan (§19) — operators

Tier 1 set:

- `Scan { table, alias }`
- `Project { input, cols: map from outputName to expr }`
- `Filter { input, predicate }`
- `Join { left, right, on, kind: 'inner' | 'left' }`
- `Aggregate { input, groupBy, measures }`
- `Sort { input, keys: { field, dir, nulls }[] }`
- `Limit { input, count }`

Dot-navigation paths in field references become explicit `Join` nodes during relational lowering. For Tier 1, all joins are functional (cardinality `one`).

### 6.5. SQLite lowering

Two sub-steps:

1. RelAlg → SQL AST (typed tree: `SelectStmt`, `FromClause`, `WhereClause`, `GroupByClause`, `HavingClause`, `OrderByClause`, `LimitClause`).
2. SQL AST → string with positional `?` placeholders + `paramOrder: string[]`.

**Predicate lifting (§6.3.1).** When a parameter declared with `mode: "predicate_optional"` is referenced inside a filter/predicate EXPR, the lowering layer wraps the enclosing boolean sub-expression with a null-guard on that parameter.

Example: parameter `minRevenue: predicate_optional` referenced in `gte(revenue, $param minRevenue)` lowers to:

```sql
(? IS NULL OR revenue >= ?)
```

Both `?` placeholders bind to the same signature input name `minRevenue` in `paramOrder`. When the parameter is absent at runtime, both placeholders receive `NULL` and the predicate evaluates to `true` (condition skipped); when present, the predicate applies normally.

## 7. Data flow

### 7.1. Compile-time

Linear pipeline above. On error in any layer, stop and return `{ ok: false, errors }`. Within a layer, collect all independent errors before stopping (e.g. all duplicate node ids, not just the first).

Cascading errors (e.g. missing field → downstream unresolved) are suppressed — report the root cause once.

### 7.2. Runtime (`execute`)

```
paramValues: Record<string, unknown>
  → resolve defaults (defaulted → default; predicate_optional absent → null)
  → validate required (missing → throw RuntimeError)
  → map to positional array per compiled.paramOrder
  → better-sqlite3: db.prepare(sql).all(...positional)
  → rows: unknown[]
```

Row mapping in MVP is passthrough of `better-sqlite3` rows. Column names in SQL match output shape field names, so the caller gets objects keyed by shape fields. Type coercion (e.g. SQLite's numeric affinity for `decimal`) handled at this boundary by the caller if strict types are needed.

## 8. Error handling

- `compile()` returns `Result<CompileResult>` — never throws for domain errors (parse, validation, lowering). Throws only on programmer errors (e.g. null spec).
- `execute()` throws for runtime errors. Runtime error messages include the failing param name or SQL snippet.
- `GraphIrError.code` is a **stable** API. Codes are enumerated and documented. Tests assert codes, not messages. Adding a code is semver-minor; renaming is semver-major.
- `explain()` returns all intermediate artifacts up to the failure point (helpful for TDD debugging).

Tier 1 unsupported features produce explicit structural errors:

```json
{
  "layer": "structural",
  "code": "TIER1_UNSUPPORTED_NODE",
  "message": "node type \"distinct\" is not supported in MVP Tier 1",
  "location": { "graphId": "...", "nodeId": "..." },
  "hint": "Planned for Tier 2."
}
```

## 9. Testing strategy (TDD-first)

### 9.1. Unit per layer

Each module tested in isolation against fixtures:

- `parse.test.ts`: well-formed / malformed authoring JSON.
- `validate/structural.test.ts`: duplicate ids, cycles, invalid refs, Tier 1 unsupported features.
- `validate/semantic.test.ts`: field resolution, type mismatches, shape conformance — fed with minimal PDM/QSM fixtures.
- `semantic-plan.test.ts`: scope propagation, nullability after aggregate, phase boundary placement.
- `lower/sqlite.test.ts`: small `RelAlgPlan` inputs → expected SQL string and `paramOrder`.

### 9.2. Golden tests

For nontrivial authoring specs, snapshot the compiled output:

```
test/golden/category-sales/
  graph.json
  pdm.json
  qsm.json
  expected.sql
  expected-params.json
```

Reviewable in PRs, updatable via `vitest -u`. Catches regressions in SQL generation without spinning up a DB.

### 9.3. E2E tests against in-memory SQLite

```
test/e2e/
  fixtures/
    commerce.sql           # schema + seed data
    commerce.pdm.json
    commerce.qsm.json
  category-sales.e2e.test.ts
  predicate-optional.e2e.test.ts
  defaulted-param.e2e.test.ts
  required-param.e2e.test.ts
  empty-result.e2e.test.ts
```

Scenario template: create `:memory:` DB → load `commerce.sql` → `compile(spec, pdm, qsm)` → `execute(compiled, paramValues, db)` → assert rows.

Tier 1 e2e fixture uses a simplified version of §22 (category sales) **without** the `categoryName` field (since `lookup` is not in Tier 1). Output shape `CategorySalesAgg` directly.

### 9.4. Property/invariant tests (budget permitting)

- `compile` is deterministic for a given input.
- `paramOrder.length === count('?')` in generated SQL.

### 9.5. TDD discipline in implementation plan

Implementation plan structures work as vertical slices. The first slice is the smallest realistic query (`findMany + limit`), and each subsequent slice adds one feature with its own e2e test first.

## 10. Open questions / deferred decisions

1. **Projection source in `findMany`.** Structurally supported, not exercised in e2e fixtures for MVP. If it requires more PDM/QSM surface, deferred to Tier 2 follow-up.
2. **Type mapping SQLite ↔ domain types.** SQLite uses type affinity; `decimal` in PDM maps to `NUMERIC`, `date` / `datetime` to `TEXT` (ISO-8601). Documented in implementation plan as part of lowering.
3. **`explain()` output structure.** Sketched in §23 of spec as a large structure; MVP returns the intermediate artifacts as JSON with minimal shape. Concrete schema in implementation plan.

## 11. Success criteria for MVP

- Category sales e2e test passes (Tier 1 subset of §22 example) against real SQLite.
- All Tier 1 input modes exercised by e2e tests (`required`, `defaulted`, `predicate_optional` present, `predicate_optional` absent).
- All Tier 1 unsupported features produce `TIER1_UNSUPPORTED_NODE` errors with clear hints.
- Public API documented in a README with one full example.
- CI green on Node 20.
