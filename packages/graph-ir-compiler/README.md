# @rntme/graph-ir-compiler

Graph IR (rc7) authoring JSON compiler — query graphs lower to SQLite SELECT, command graphs lower to event-sourced emit plans.

## Role in the system

- Depends on:
  - [`@rntme/pdm`](../pdm) — entities, fields, state machines, derived event-type table.
  - [`@rntme/qsm`](../qsm) — projections (`entity-mirror` / derived) and `projections.relations` for dot-nav join planning.
  - [`@rntme/event-store`](../event-store) — `EventStore`, `appendEvents`, `ConcurrencyConflict` (command runtime only).
  - `better-sqlite3` (peer) — the `Database` handle passed to `execute(...)`.
  - `zod` — authoring-spec schema in `parse/schema.ts`.
- Consumed by:
  - [`@rntme/bindings-http`](../bindings-http) — HTTP surface compiles each binding's graph and runs it per-request.
  - [`@rntme/runtime`](../runtime) — composes compiler with bindings/projections.
  - [`demo/issue-tracker-api`](../../demo/issue-tracker-api) — end-to-end wiring of every package.
- Position in pipeline: `parse → canonical → semantic-plan → role/relational → lower → emit → execute` (queries) / `command-runtime` (commands). `explain(...)` returns every intermediate artifact.

## File map

```
src/
  index.ts                                  (entry) Public API: compile, execute, run, compileCommand, executeCommand, runCommand, explain, deriveEventTypeName, inferRole; re-exports Result helpers and types.

  parse/
    parse.ts                                (internal) parseAuthoringSpec(input) — accepts string or object, returns Result<AuthoringSpecOutput>; emits PARSE_INVALID_JSON / PARSE_SCHEMA_VIOLATION.
    schema.ts                               (internal) Zod schema for the rc7 authoring spec (version, pdmRef, qsmRef, shapes, graphs); discriminated union of node types.

  canonical/
    normalize.ts                            (internal) normalize(spec) — lifts each authoring node to a CanonicalNode (kind-tagged), allocates fresh scope IDs, fills sort defaults (asc/last), sets findMany.alias = camelCase(source).

  validate/
    structural/
      index.ts                              (internal) validateStructural(spec, pdm, qsm) — runs all structural rules; returns Result<AuthoringSpecOutput>.
      ids.ts                                (internal) checkIds — graph.id matches map key; node IDs unique within a graph.
      refs.ts                               (internal) checkRefs — every node.input references an existing node ID.
      dag.ts                                (internal) checkDag — STRUCT_DAG_CYCLE; iterative-deepening cycle detect.
      output-from.ts                        (internal) checkOutputFrom — signature.output.from points at a node and is reachable.
      inputs.ts                             (internal) checkInputs — at most one root input; STRUCT_ROOT_INPUT_TYPE; STRUCT_ROOT_REF_WITHOUT_ROOT_INPUT.
      shapes.ts                             (internal) checkShapes / shapeExists — STRUCT_UNKNOWN_SHAPE for map.into / reduce.into.
      map-reduce.ts                         (internal) checkMapReduceCoverage — STRUCT_MAP_SHAPE_COVERAGE / STRUCT_REDUCE_SHAPE_COVERAGE; every shape field is produced exactly once.
      tier1-nodes.ts                        (internal) checkTier1Nodes — TIER1_UNSUPPORTED_NODE for distinct, lookupOne, etc.
      tier1-expr.ts                         (internal) checkTier1Expr — TIER1_UNSUPPORTED_EXPR for $list, exists, lookup-expr, named predicate refs.
      command-shape.ts                      (internal) checkCommandShape — CMD_OUTPUT_SHAPE_INVALID for emit-bearing graphs whose output type is not 'CommandResult'.
      role.ts                               (internal) checkGraphRole — structural pre-check for GRAPH_MIXED_ROLE (rowset output + emit node combination).
    semantic/
      index.ts                              (internal) validateSemantic(graph, pdm, qsm, shapes) — orchestrates source-resolution, type/scope inference, NAV checks, shape conformance, param-context, emit checks.
      sources.ts                            (internal) resolveSources / checkNavProjectionRequired / checkNavRelations — collectDotNavPaths walks expressions; emits NAV_PROJECTION_REQUIRED / NAV_NOT_ALLOWED / NAV_FAN_OUT_NOT_ALLOWED.
      scope.ts                              (internal) Scope = { aliases: Map<alias, {entity}>, shapeFields? } — alias→entity bindings used by type inference.
      types.ts                              (internal) inferExprType / ParamMap — recursive Expr type-inference; resolves field paths via fields.ts; checks param nullability.
      fields.ts                             (internal) resolveField(scope, pdm, path) — alias.field / multi-hop dot-nav field resolution; SEM_FIELD_NOT_FOUND.
      param-context.ts                      (internal) checkParamContext / walkExprParams — SEM_PARAM_CONTEXT (predicate_optional only allowed in filter), SEM_PARAM_UNKNOWN.
      shape-conformance.ts                  (internal) checkMapShapeConformance — every map.into shape field's expression has the declared type and nullability.
      aggregate-phase.ts                    (internal) checkReduce — group/measures expressions valid under post-scan scope; validates measure args.
      emit.ts                               (internal) checkEmit — CMD_UNKNOWN_AGGREGATE / CMD_AGGREGATE_WITHOUT_STATE_MACHINE / CMD_UNKNOWN_TRANSITION / CMD_PAYLOAD_MISSING_FIELD / CMD_PAYLOAD_EXTRANEOUS_FIELD / CMD_PAYLOAD_TYPE_MISMATCH / CMD_AGGREGATE_ID_TYPE_MISMATCH.

  semantic-plan/
    build.ts                                (internal) buildSemanticPlan(graph, pdm, qsm) — converts each non-emit canonical node to a typed PlanStep (scan/filter/project/aggregate/sort/limit) with materialised field metadata.

  relational/
    build.ts                                (internal) buildRelational(plan) — folds PlanStep[] into a RelOp tree (Scan → Filter → Project / Aggregate → Sort → Limit).

  role/
    infer.ts                                (entry — re-exported) inferRole(graph) → 'query' | 'command' | 'predicate' | 'mapper' | 'reducer'; enforces GRAPH_MIXED_ROLE.

  lower/
    sqlite/
      lower.ts                              (internal) lowerToSqlite(rel, ctx) — folds RelOp to SqlSelect AST and accumulates paramOrder; owns wrapPredicateOptional, makeColumnOf (dot-nav join synthesis), measureToAggSql.
      ast.ts                                (internal) SqlExpr / SqlSelect / SqlJoin / SqlOrderKey types — typed SQLite AST.
      expr.ts                               (internal) lowerExpr(e, ctx) — Expr → SqlExpr; appends to ctx.paramOrder on each $param visit (positional binding).
      joins.ts                              (internal) expandChain / chainToSqlJoins — walks QSM.relations, returns JoinChain with path-qualified aliases (parts.slice(1, i+1).join('_')).
      emit.ts                               (internal) emitSql(ast) — string serialiser; uses double-quoted identifiers, '?' placeholders, NULLS FIRST/LAST, LIKE.

  execute/
    execute.ts                              (internal) executeCompiled(compiled, params, db) — binds positional params (defaults / nullable / predicate_optional → null), prepares, runs .all(); throws RUNTIME_MISSING_REQUIRED_PARAM / RUNTIME_SQLITE_ERROR.

  emit/
    plan.ts                                 (internal) buildEmitPlans(graph, pdm) — for each emit node, joins canonical config with PDM's derived event-type table to produce EmitPlan[].
    event-type.ts                           (entry — deriveEventTypeName) deriveEventTypeName(aggregate, transition) = PascalCase(aggregate)+PascalCase(transition); lookupEventTypeSpec(pdm, agg, t).
    payload.ts                              (internal) derivePayload / evalExprAtRuntime — runtime payload assembly: stateField ← plan.toState; field paths are rejected at runtime (params/literals only).

  command-runtime/
    compile.ts                              (entry — compileCommand) compileCommand(spec, pdm, qsm) — full structural+semantic compile, role check, optional read-prelude (lowered as a query), CMD_MULTI_AGGREGATE_NOT_ALLOWED.
    execute.ts                              (entry — executeCommand, ExecuteCommandContext) executeCommand(compiled, params, ctx) — runs read-prelude (rejects with COMMAND_GUARD_REJECTED if 0 rows), replays stream, validates transition, builds EventEnvelopes, appends with optimistic concurrency.
    replay.ts                               (internal) replayAggregateState(events) — reduces EventEnvelopes to { state, version }; before:null events replace, otherwise merge after into running state.
    transition.ts                           (internal) checkTransitionLegal(plan, state, stateField) — COMMAND_ILLEGAL_TRANSITION; creation requires state===null, else current state must be in plan.fromStates.
    errors.ts                               (entry — CommandExecutionError) class CommandExecutionError extends Error; .code ∈ { COMMAND_ILLEGAL_TRANSITION, COMMAND_GUARD_REJECTED, COMMAND_CONCURRENCY_CONFLICT }; optional .detail.

  explain/
    explain.ts                              (internal) parseGraphIrArtifacts(rawPdm, rawQsm) — wraps @rntme/pdm + @rntme/qsm parse/validate behind a graph-ir Result<{pdm,qsm}>; ExplainArtifacts / ExplainOutput types.

  types/
    authoring.ts                            (internal) Expr / FieldExpr / Signature / InputMode / PrimitiveType / ListType / RowType / RowsetType / SortKey / AggregateFn — rc7 authoring AST types.
    canonical.ts                            (internal) CanonicalNode union (findMany/filter/map/reduce/sort/limit/emit) + CanonicalGraph — output of normalize().
    semantic-plan.ts                        (internal) PlanStep union + SemanticPlan — output of buildSemanticPlan().
    relational.ts                           (internal) RelOp union (Scan/Filter/Project/Aggregate/Sort/Limit/Join) — target-independent algebra.
    command.ts                              (entry — re-exports CommandResult, CompiledCommand, EmitPlan) ReadPreludeCompileResult (mirrors CompileResult to avoid import cycle); RuntimeActor.
    result.ts                               (entry — Result, GraphIrError, ErrorCode, Layer, Ok, Err, ok, err, isOk, isErr, ERROR_CODES) Layer union covers parse / structural / canonical / semantic / semantic-plan / relational / lowering / runtime.
```

## Quick start

### Query path

```ts
import Database from 'better-sqlite3';
import { compile, execute } from '@rntme/graph-ir-compiler';

const spec = {
  version: '1.0-rc7',
  pdmRef: 'commerce.domain.v1',
  qsmRef: 'commerce.read.v1',
  shapes: {},
  graphs: {
    listItems: {
      id: 'listItems',
      signature: {
        inputs: { limit: { type: 'integer', mode: 'defaulted', default: 20 } },
        output: { type: 'rowset<OrderItem>', from: 'paged' },
      },
      nodes: [
        { id: 'items', type: 'findMany', config: { source: { entity: 'OrderItem' } } },
        { id: 'paged', type: 'limit',    config: { input: 'items', count: { $param: 'limit' } } },
      ],
    },
  },
};

const r = compile(spec, pdm, qsm);
if (!r.ok) throw new Error(r.errors.map((e) => e.code).join(', '));

const db = new Database('app.db');
const rows = execute(r.value, { limit: 5 }, db);
```

### Command path

```ts
import { compileCommand, executeCommand } from '@rntme/graph-ir-compiler';
import { SqliteEventStore } from '@rntme/event-store';

const commandSpec = {
  version: '1.0-rc7',
  pdmRef: 'issue.domain.v1',
  qsmRef: 'issue.read.v1',
  shapes: {},
  graphs: {
    reportIssue: {
      id: 'reportIssue',
      signature: {
        inputs: {
          issueId:  { type: 'integer', mode: 'required' },
          title:    { type: 'string',  mode: 'required' },
          priority: { type: 'string',  mode: 'required' },
        },
        output: { type: 'CommandResult', from: 'reported' },
      },
      nodes: [
        {
          id: 'reported',
          type: 'emit',
          config: {
            aggregate: 'Issue',
            aggregateId: { $param: 'issueId' },
            transition: 'report',
            payload: {
              title:    { $param: 'title' },
              priority: { $param: 'priority' },
            },
          },
        },
      ],
    },
  },
};

const compiled = compileCommand(commandSpec, pdm, qsm);
if (!compiled.ok) throw new Error(JSON.stringify(compiled.errors));

const result = executeCommand(compiled.value, { issueId: 1, title: 'bug', priority: 'high' }, {
  eventStore: new SqliteEventStore({ filename: './events.db' }),
  qsmDb: null,
  now:    () => new Date().toISOString(),
  nextId: () => crypto.randomUUID(),
  actor:  { kind: 'user', id: 'alice' },
});
// → { aggregateId: '1', version: 1, eventIds: ['...'] }
```

`runCommand(spec, pdm, qsm, params, ctx)` and `run(spec, pdm, qsm, params, db)` collapse compile+execute into a single call (and throw on compile failure).

## API

### Top-level functions

| Export | Signature | Purpose |
| --- | --- | --- |
| `compile` | `(rawSpec, rawPdm, rawQsm, opts?) → Result<CompileResult>` | Parse → validate (structural + semantic) → normalise → semantic-plan → relational → lower → emit. Returns `{ sql, paramOrder, shape, optionalParams, paramDefaults }`. One graph per call. |
| `execute` | `(compiled, params, db) → unknown[]` | Bind `paramOrder` positionally (defaults / nullable / predicate_optional → null) and run `db.prepare(sql).all(...)`. |
| `run` | `(rawSpec, rawPdm, rawQsm, params, db, opts?) → unknown[]` | `compile` then `execute`. Throws on compile failure (Error with `.errors`). |
| `compileCommand` | `(rawSpec, rawPdm, rawQsm) → Result<CompiledCommand>` | Command-graph compile: full validation, role-check, emit plans, optional read-prelude (lowered as a SELECT). MVP: exactly one aggregate per command. |
| `executeCommand` | `(compiled, params, ctx) → CommandResult` | Read-prelude → replay → transition check → derive payloads → append. Throws `CommandExecutionError`. |
| `runCommand` | `(rawSpec, rawPdm, rawQsm, params, ctx) → CommandResult` | `compileCommand` then `executeCommand`. |
| `explain` | `(rawSpec, rawPdm, rawQsm) → ExplainOutput` | Returns every intermediate artifact (parsed, canonical, semanticPlan, relational, sql, paramOrder) on success, or `{ ok: false, artifacts, errors }` partial on failure. |
| `inferRole` | `(graph) → Result<GraphRole>` | `'query' \| 'command' \| 'predicate' \| 'mapper' \| 'reducer'`; `GRAPH_MIXED_ROLE` on rowset+emit combinations. |
| `deriveEventTypeName` | `(aggregate, transition) → string` | `Issue` + `report` → `IssueReport` (PascalCase concat). |
| `CommandExecutionError` | `class extends Error` | `.code ∈ { COMMAND_ILLEGAL_TRANSITION, COMMAND_GUARD_REJECTED, COMMAND_CONCURRENCY_CONFLICT }`; optional `.detail`. |
| `ok / err / isOk / isErr / ERROR_CODES` | Result helpers | `Result<T> = Ok<T> \| Err`; `ERROR_CODES` is the full string registry. |

### Exported types

```ts
import type {
  CompileResult,        // { sql, paramOrder, shape, optionalParams, paramDefaults }
  CompileOptions,       // { target?: 'sqlite' }
  CompiledCommand,      // { graphId, aggregate, emits, readPrelude, readPreludeGuardNodeId, paramOrder, optionalParams, paramDefaults }
  CommandResult,        // { aggregateId, version, eventIds }
  EmitPlan,             // per-emit node: aggregateIdExpr, transition, eventType, affects, payloadExprs, actorExpr?, isCreation, isSelfLoop, fromStates, toState
  ExecuteCommandContext,// { eventStore, qsmDb, now, nextId, actor }
  GraphRole,            // 'query' | 'command' | 'predicate' | 'mapper' | 'reducer'
  ExplainOutput,
  Result, GraphIrError, ErrorCode, Layer, Ok, Err,
  ValidatedPdm, ValidatedQsm,    // re-exported from @rntme/pdm and @rntme/qsm
} from '@rntme/graph-ir-compiler';
```

### Pipeline walkthrough

`compile(spec, pdm, qsm)` runs these stages in this exact order. Diverging from the order produces incorrect errors (e.g., type-checking before source resolution names entities the validator has not yet rejected).

1. **`parseAuthoringSpec(rawSpec)`** — accepts an object or a JSON string; on string input, runs `JSON.parse` first and reports `PARSE_INVALID_JSON` on failure. On schema mismatch, every Zod issue becomes one `PARSE_SCHEMA_VIOLATION` with `location.path`.
2. **`parseGraphIrArtifacts(rawPdm, rawQsm)`** — wraps `@rntme/pdm` and `@rntme/qsm` parse + validate so all errors fold into a single `PARSE_SCHEMA_VIOLATION` from the graph-ir error space.
3. **`validateStructural(spec, pdm, qsm)`** — runs every rule in `validate/structural/index.ts` and accumulates errors. Order inside the file matches table-of-contents order in §File map.
4. **Single-graph guard** — `compile` and `compileCommand` enforce `Object.keys(spec.graphs).length === 1` and emit `STRUCT_DUPLICATE_GRAPH_ID` otherwise. Multi-graph orchestration belongs in callers (`@rntme/runtime`).
5. **`normalize(spec)`** — produces `CanonicalGraph`. Allocates monotonic scope IDs (`s1`, `s2`, ...), defaults sort `dir = 'asc'` and `nulls = 'last'`, sets `findMany.alias = camelCase(source)`.
6. **`inferRole(graph)` (command path only)** — `compileCommand` rejects non-command graphs with `GRAPH_MIXED_ROLE`.
7. **`validateSemantic(graph, pdm, qsm, shapes)`** — resolves sources, infers expression types, runs NAV checks (relations + projection-required), shape-conformance, param-context, emit checks.
8. **`buildSemanticPlan(graph, pdm, qsm)` (query path)** — emits a `PlanStep` per non-emit node, materialising entity field metadata into `ScanStep.fields`.
9. **`buildEmitPlans(graph, pdm)` (command path)** — per emit node, joins canonical config with `deriveEventTypes(pdm)` to produce `EmitPlan`.
10. **`buildRelational(plan)` (query path)** — folds `PlanStep[]` into the `RelOp` tree.
11. **`lowerToSqlite(rel, ctx)` + `emitSql(ast)` (query path)** — produces `{ sql, paramOrder }`. `ctx` carries `predicateOptionalParams`, `pdm`, `qsm` so dot-nav joins resolve.
12. **`executeCompiled(compiled, params, db)` (query runtime)** — binds positional params, prepares, runs `.all()`. `defaulted` and `nullable`/`predicate_optional` params fall back to default / `null`; missing required throws `RUNTIME_MISSING_REQUIRED_PARAM`.
13. **`executeCommand(compiled, params, ctx)` (command runtime)** — runs read-prelude (if present), replays the stream, validates each transition, derives payloads, appends with `expectedVersion`.

### Compilation layers

| Layer (`GraphIrError.layer`) | Stage | Owner file |
| --- | --- | --- |
| `parse`           | Zod parse + JSON parse                                | `parse/parse.ts`, `parse/schema.ts` |
| `structural`      | DAG, refs, role, shape coverage, tier-1 gates         | `validate/structural/*.ts` |
| `canonical`       | Lift to kind-tagged tree; assign scope IDs            | `canonical/normalize.ts` |
| `semantic`        | Source resolution, types, NAV checks, emit checks     | `validate/semantic/*.ts` |
| `semantic-plan`   | Plan steps with materialised field metadata           | `semantic-plan/build.ts` |
| `relational`      | Algebra tree (Scan/Filter/Project/Aggregate/Sort/Limit/Join) | `relational/build.ts` |
| `lowering`        | SQLite AST + `paramOrder` accumulation                | `lower/sqlite/*.ts` |
| `runtime`         | Param binding, prepare/all, command runtime           | `execute/execute.ts`, `command-runtime/*.ts` |

### Supported features (Tier 1)

| Area | Supported | Files |
| --- | --- | --- |
| Nodes               | `findMany`, `filter`, `map`, `reduce`, `sort`, `limit`, `emit` | `validate/structural/tier1-nodes.ts` |
| Input modes         | `root`, `required`, `nullable`, `defaulted`, `predicate_optional` | `parse/schema.ts → inputMode`, `validate/semantic/param-context.ts` |
| Expression operators| comparison (`eq/neq/gt/gte/lt/lte`), arithmetic (`add/sub/mul/div`), logical (`and/or/not`), `is_null`, `like`, `concat`, `coalesce`, `between`, `case` | `lower/sqlite/expr.ts`, `lower/sqlite/emit.ts → operator()` |
| Aggregates          | `count`, `count_distinct`, `sum`, `avg`, `min`, `max`, `group_array` (json_group_array) | `lower/sqlite/lower.ts → measureToAggSql` |
| Joins               | Dot-navigation through QSM `relations` (`one`-cardinality only) with shared dedup | `lower/sqlite/joins.ts`, `lower/sqlite/lower.ts → makeColumnOf` |
| Targets             | SQLite ≥ 3.30 (`NULLS FIRST/LAST` required) | `lower/sqlite/emit.ts` |

### Error codes

Every code is exported via `ERROR_CODES` and listed in `src/types/result.ts`. Codes are append-only — agents must not delete or reorder them.

| Group | Codes |
| --- | --- |
| Parse / structural | `PARSE_INVALID_JSON`, `PARSE_SCHEMA_VIOLATION`, `STRUCT_DUPLICATE_GRAPH_ID`, `STRUCT_DUPLICATE_NODE_ID`, `STRUCT_INVALID_INPUT_REF`, `STRUCT_DAG_CYCLE`, `STRUCT_INVALID_OUTPUT_FROM`, `STRUCT_MULTIPLE_ROOT_INPUTS`, `STRUCT_ROOT_INPUT_TYPE`, `STRUCT_ROOT_REF_WITHOUT_ROOT_INPUT`, `STRUCT_UNKNOWN_SHAPE`, `STRUCT_MAP_SHAPE_COVERAGE`, `STRUCT_REDUCE_SHAPE_COVERAGE`, `TIER1_UNSUPPORTED_NODE`, `TIER1_UNSUPPORTED_EXPR` |
| Semantic           | `SEM_SOURCE_NOT_FOUND`, `SEM_FIELD_NOT_FOUND`, `SEM_TYPE_MISMATCH`, `SEM_SHAPE_MISMATCH`, `SEM_NULLABILITY_VIOLATION`, `SEM_PARAM_UNKNOWN`, `SEM_PARAM_CONTEXT`, `NAV_PROJECTION_REQUIRED`, `NAV_NOT_ALLOWED`, `NAV_FAN_OUT_NOT_ALLOWED` |
| Command compile    | `GRAPH_MIXED_ROLE`, `CMD_OUTPUT_SHAPE_INVALID`, `CMD_EMIT_UNREACHABLE`, `CMD_UNKNOWN_AGGREGATE`, `CMD_AGGREGATE_WITHOUT_STATE_MACHINE`, `CMD_UNKNOWN_TRANSITION`, `CMD_PAYLOAD_MISSING_FIELD`, `CMD_PAYLOAD_EXTRANEOUS_FIELD`, `CMD_PAYLOAD_TYPE_MISMATCH`, `CMD_AGGREGATE_ID_TYPE_MISMATCH`, `CMD_MULTI_AGGREGATE_NOT_ALLOWED` |
| Command runtime    | `COMMAND_ILLEGAL_TRANSITION`, `COMMAND_GUARD_REJECTED`, `COMMAND_CONCURRENCY_CONFLICT` (thrown via `CommandExecutionError`) |
| Runtime            | `RUNTIME_MISSING_REQUIRED_PARAM`, `RUNTIME_SQLITE_ERROR` (thrown as decorated `Error`, not `Result`) |

## Invariants & gotchas

- **`wrapPredicateOptional` SQL `?` positional alignment.** When a `filter` mixes a `predicate_optional` param with other params, the placeholder ordinals must match the bind order produced by `lowerExpr`. The OR arguments in `wrapPredicateOptional` (`lower/sqlite/lower.ts`) are `[predicateSql, IS NULL(?_optional)]` in that order; swapping them shifts the optional `?`'s ordinal off-by-N. Regressions are caught by `test/unit/lower/sqlite/predicate-optional.test.ts` and `test/e2e/predicate-optional.e2e.test.ts`. (Fix commit `bcce017`.)
- **NAV operator restrictions are validator errors, not raw throws.** `checkNavRelations` (`validate/semantic/sources.ts`) emits `NAV_NOT_ALLOWED` (relation key not declared in `QSM.relations`) and `NAV_FAN_OUT_NOT_ALLOWED` (relation cardinality is `many`) as semantic-layer errors. The lowering site in `lower/sqlite/joins.ts → expandChain` keeps defensive `throw new Error(...)` calls only as a safety net for callers that bypass the semantic layer; production paths always hit the validator first. (Fix commit `6f43483`.)
- **`collectDotNavPaths` skips `$literal`, `$param`, and `lookup` sub-trees.** These carry strings that are not field paths; descending into them produces phantom `NAV_*` errors. The walker in `validate/semantic/sources.ts` short-circuits each, mirroring the `walkExprParams` pattern. (Fix commits `fd2ddd9`, `69c87bf`.)
- **Path-qualified join aliases are `parts.slice(1, i+1).join('_')`.** Two graphs joining `customer.organization.name` and `customer.organization.country` share the alias `customer_organization` — that shared alias is used as the join-table dedup key in `makeColumnOf` (`lower/sqlite/lower.ts`) so both columns reuse one JOIN. (Fix commit `2af0de0`.)
- **`makeColumnOf` requires an entity-mirror projection on the scan's entity for dot-nav.** Without one, lowering throws `NAV_PROJECTION_REQUIRED`; the same condition is checked earlier and reported via `checkNavProjectionRequired` so authors see a typed semantic error before lowering runs.
- **Param order is bind order.** `lowerExpr` appends to `ctx.paramOrder` on each `$param` visit; `wrapPredicateOptional` appends after; `Limit` count appends last per its own visit. `execute` / `executeCommand` map `paramOrder` → positional values in that exact order — never reorder.
- **Tier 1 MVP compiles exactly one graph per call.** `compile` and `compileCommand` reject specs whose `graphs` map size ≠ 1 with `STRUCT_DUPLICATE_GRAPH_ID` (per `index.ts` and `command-runtime/compile.ts`).
- **`predicate_optional` is only legal in `filter` predicates.** `checkParamContext` (`validate/semantic/param-context.ts`) emits `SEM_PARAM_CONTEXT` if a `predicate_optional` param appears in `map`, `reduce`, `sort`, `limit`, or `emit`.
- **Role inference promotes `query` → `command` when any `emit` exists.** `inferRole` (`role/infer.ts`) returns `'command'` only if there is no root input and ≥1 emit and the output is non-rowset; rowset+emit yields `GRAPH_MIXED_ROLE`. The structural pre-check `validate/structural/role.ts` blocks the impossible combinations early.
- **Emit payload runtime allows `$param` and `$literal` only.** `evalExprAtRuntime` (`emit/payload.ts`) throws on field-path strings and on any other expression; payload field expressions must be assembled before reaching runtime.
- **Creation transitions append at `version=0` (expected version of an empty stream).** `replayAggregateState` returns `{ state: null, version: 0 }` for an empty stream; `executeCommand` passes `expectedVersion: 0` so the first append succeeds with `lastVersion = 1`. `checkTransitionLegal` rejects creation against an existing aggregate with `COMMAND_ILLEGAL_TRANSITION`.
- **State field for the after-payload is the first `affects` field outside the explicit payload.** `stateFieldFromPlan` in `emit/payload.ts` (and `stateFieldForPlan` in `command-runtime/execute.ts`) — typically `status`. Authors who include `status` in `payload` change which field carries `plan.toState`.
- **`COMMAND_CONCURRENCY_CONFLICT` is the only event-store error mapped.** `executeCommand` catches `ConcurrencyConflict` from `appendEvents` and wraps it as `CommandExecutionError`; other store errors propagate unchanged.
- **`compile` validates structural rules before normalising; `compileCommand` runs `inferRole` after structural+canonical and before `validateSemantic`.** Order matters: callers should not invoke layers individually unless they replicate this order (see `index.ts` and `command-runtime/compile.ts`).
- **`explain(...)` returns partial artifacts on failure** so an agent diagnosing a broken stage can read every artifact produced before the failing stage. Use it instead of stepping the pipeline by hand.
- **SQLite ≥ 3.30 is required** for `NULLS FIRST / NULLS LAST` emitted by `lower/sqlite/emit.ts`. `better-sqlite3` ≥ 11 ships a recent enough engine.
- **`compileCommand` re-validates PDM and QSM internally** rather than trusting pre-validated artifacts (see `command-runtime/compile.ts`). All PDM/QSM failures collapse to a single `PARSE_SCHEMA_VIOLATION` with the first underlying message; do not assume per-field error fan-out matches `@rntme/pdm` / `@rntme/qsm` directly.
- **`map.into` / `reduce.into` must reference a shape declared in `spec.shapes`.** `STRUCT_UNKNOWN_SHAPE` is structural; `STRUCT_MAP_SHAPE_COVERAGE` / `STRUCT_REDUCE_SHAPE_COVERAGE` enforce that every shape field is produced exactly once. See `validate/structural/shapes.ts` and `validate/structural/map-reduce.ts`.
- **Reduce changes scope.** `validateSemantic` (`validate/semantic/index.ts`) replaces the alias-based scope after a `reduce` node with a `shapeFields`-only scope (typed by the named output shape). Field-path expressions after a `reduce` resolve against the shape's field types, not the original entity columns.
- **`group_array` lowers to `json_group_array`.** Aggregating a list-typed column requires SQLite's JSON1 extension (built into stock SQLite ≥ 3.38 and into `better-sqlite3`).
- **Path-qualified column lookup is alias-rooted.** `makeColumnOf` requires the first segment of any multi-segment path to match the scan alias (e.g. `customer.organization.name` only when the scan alias is `customer`); otherwise lowering throws. Multi-scan graphs are not yet supported.
- **`signature.output.from` must be reachable from the DAG roots and refer to a node id.** `validate/structural/output-from.ts` rejects unreachable or unknown ids with `STRUCT_INVALID_OUTPUT_FROM`. Output cardinality (`row` vs `rowset`) is read off the type's prefix in `buildSemanticPlan`.
- **`Filter` over an `Aggregate` lowers to `HAVING`, otherwise to `WHERE`.** `lowerToSqlite → toSelect/Filter` checks `rel.child.op === 'Aggregate'` and routes accordingly. Authors writing post-aggregate predicates must place the `filter` node after the `reduce` node.
- **`Limit.count` may be a literal or a `$param`.** A `$param` count appends to `paramOrder` like any other expression-bound param — `LIMIT ?` produces a `?` whose ordinal is the position in `paramOrder` at the time `Limit` is lowered (last in the visit order).
- **Identifier quoting is double-quote.** `emit.ts → q()` wraps every table/alias/column in `"..."` and doubles embedded `"`. SQL keywords are emitted in uppercase. String literals are single-quoted with embedded `'` doubled. Booleans collapse to `1` / `0`.
- **No partial canonical normalisation.** `normalize()` throws on an unknown node `kind` rather than silently dropping it. The structural validator is the source of truth for "is this a Tier-1 node"; if you reach normalize with a non-Tier-1 node, validation has been bypassed.
- **`buildEmitPlans` silently skips `emit` nodes whose `(aggregate, transition)` pair is unknown to PDM.** The semantic validator (`validate/semantic/emit.ts → checkEmit`) emits `CMD_UNKNOWN_AGGREGATE` / `CMD_UNKNOWN_TRANSITION` upstream — if those pass and the plan still ends up empty, the canonical graph and PDM are out of sync.

## Out of scope / known limits

- **No JOIN-based FK enrichment for list/search endpoints in the demo.** `demo/issue-tracker-api`'s list / search endpoints currently return raw FK IDs; a JOIN compilation strategy is brainstormed in the `demo_join_enrichment_todo` memory entry. The compiler supports dot-nav joins for individual field paths today; bulk enrichment is not modeled.
- **Tier 1 nodes only.** `distinct`, `lookupOne`, `lookup` expression, named predicate graphs, and `exists` / `in` / `$list` parse but are validator-rejected by `tier1-nodes.ts` / `tier1-expr.ts`.
- **Single-graph-per-call.** Multi-graph specs are rejected with `STRUCT_DUPLICATE_GRAPH_ID`; multi-graph compilation belongs in the runtime layer.
- **One aggregate per command.** Multi-aggregate sagas are rejected with `CMD_MULTI_AGGREGATE_NOT_ALLOWED`; per the platform vision, cross-service sagas are owned by Zeebe, not the compiler.
- **Composite aggregate keys are not supported.** `aggregateId` is a single Expr coerced to string in `executeCommand`.
- **Dot-navigation cardinality must be `one`.** Many-cardinality NAV is rejected with `NAV_FAN_OUT_NOT_ALLOWED`; explicit JOIN nodes are not yet a feature.
- **No planner / optimizer.** Lowering is a direct fold; no predicate pushdown, no JOIN reordering, no projection pruning beyond what `Project` / `Aggregate` already declare.
- **No HTTP / binding surface here.** Bindings live in [`@rntme/bindings`](../bindings) and [`@rntme/bindings-http`](../bindings-http).
- **No YAML.** Authoring artifacts are JSON only.
- **SQLite forever.** No Postgres dialect path; future scale-out is via Turso (SQLite-compatible Rust) per the project memory entry. Do not introduce Postgres-specific syntax.
- **Multi-graph `explain` is single-graph too.** The `explain` API matches `compile`'s single-graph contract.
- **No streaming / pagination cursor.** `execute` runs `stmt.all(...)` and returns the full row set. Callers wanting cursor / chunked iteration must compose `LIMIT` / sort externally.
- **No projection materialisation.** The compiler reads from QSM-declared tables (entity-mirror or derived); building those tables is `@rntme/projection-consumer`'s job.
- **No actor / authorisation policy.** `executeCommand` accepts an `actor` and stores it on each event envelope; it does not check whether the actor is allowed to run the transition. Authorisation belongs in the binding layer.
- **No idempotency dedup.** A repeat `executeCommand` call against the same stream with the same payload appends a new event (subject only to optimistic concurrency on `expectedVersion`). Idempotency keys are not consumed.
- **No transactional read-prelude across stores.** `qsmDb` and `eventStore` may be different SQLite files; the read-prelude is queried from `qsmDb` and the append goes to `eventStore`. The two are not joined in a single transaction.

## Where to look first

| Task | Start at |
| --- | --- |
| Trace a query through the pipeline | `src/index.ts → compile()` (top-down: `parseAuthoringSpec` → `validateStructural` → `normalize` → `validateSemantic` → `buildSemanticPlan` → `buildRelational` → `lowerToSqlite` → `emitSql`). |
| Trace a command through the pipeline | `src/command-runtime/compile.ts → compileCommand()` then `src/command-runtime/execute.ts → executeCommand()` (replay → `checkTransitionLegal` → `derivePayload` → `appendEvents`). |
| Read every intermediate artifact for a failing spec | `src/explain/explain.ts → explain()`; failure returns partial `artifacts`. |
| Debug param-position misalignment in SQL | `src/lower/sqlite/lower.ts → wrapPredicateOptional` and `src/lower/sqlite/expr.ts → lowerExpr` ($param branch); regression tests in `test/unit/lower/sqlite/predicate-optional.test.ts` and `test/e2e/predicate-optional.e2e.test.ts`. |
| Debug a `NAV_*` error | `src/validate/semantic/sources.ts → checkNavRelations / checkNavProjectionRequired / collectDotNavPaths`; tests in `test/unit/validate/semantic/nav-relations.test.ts`, `test/unit/validate/semantic/nav-projection-required.test.ts`, `test/unit/validate/semantic/fields-nav.test.ts`. |
| Debug a JOIN that should be deduplicated | `src/lower/sqlite/lower.ts → makeColumnOf` (the `addedAliases` set) and `src/lower/sqlite/joins.ts → expandChain → step.toAlias`; tests in `test/unit/lower/sqlite/joins-dedup.test.ts`, `joins-qsm.test.ts`, `joins.test.ts`. |
| Debug a command-runtime error | `src/command-runtime/execute.ts` (catch site for `ConcurrencyConflict`), `src/command-runtime/transition.ts` (`COMMAND_ILLEGAL_TRANSITION`), `src/command-runtime/replay.ts` (state shape). Tests in `test/unit/command-runtime/`. |
| Add a new graph operator | (1) Add a Zod variant to `src/parse/schema.ts`. (2) Add a `Canonical*` type and a `normalize()` case in `src/canonical/normalize.ts`. (3) Add a `PlanStep` and `buildSemanticPlan()` case in `src/semantic-plan/build.ts`. (4) Add a `RelOp` and `buildRelational()` case in `src/relational/build.ts`. (5) Add a `toSelect()` case in `src/lower/sqlite/lower.ts`. (6) Remove the `TIER1_UNSUPPORTED_NODE` entry in `src/validate/structural/tier1-nodes.ts`. (7) Add structural and semantic validators alongside the existing rules. (8) Update spec/MVP doc. |
| Add a new validator rule (structural) | Pick a file in `src/validate/structural/` matching the rule's domain; export `check<Name>(spec, ...)`; register it in `src/validate/structural/index.ts → validateStructural`. Mirror `tier1-nodes.ts` for shape. |
| Add a new validator rule (semantic) | Add a `check<Name>(graph, ...)` in `src/validate/semantic/<file>.ts`; call it from `src/validate/semantic/index.ts → validateSemantic`. Mirror `checkParamContext` for shape. |
| Add a new error code | Append the code to `ERROR_CODES` in `src/types/result.ts`; never delete or reorder existing entries. Update the `## Error codes` table in this README. |
| Add a new emit / command rule | Edit `src/validate/semantic/emit.ts` (compile-time) or `src/command-runtime/transition.ts` / `src/command-runtime/replay.ts` (runtime). Test fixtures live in `test/unit/command-runtime/` and `test/unit/emit/`. |
| Add a new SQLite expression | Extend `SqlExpr` in `src/lower/sqlite/ast.ts`; handle the new `kind` in `src/lower/sqlite/emit.ts → expr()` and add a `lowerExpr` case in `src/lower/sqlite/expr.ts`. |
| Verify SQL output | `test/golden/category-sales/` (full pipeline golden); `test/e2e/*.e2e.test.ts` runs `compile + execute` against `test/e2e/fixtures/*.sql` schemas. |
| Reproduce a failing CI test | `pnpm -F @rntme/graph-ir-compiler test` or `pnpm -F @rntme/graph-ir-compiler test:watch`; vitest config in `vitest.config.ts`. |
| Trace why an emit graph errors at compile-time | `src/validate/semantic/emit.ts → checkEmit` (payload coverage, type, aggregateId), then `src/role/infer.ts → inferRole` (`GRAPH_MIXED_ROLE`), then `src/command-runtime/compile.ts → compileCommand` (`CMD_MULTI_AGGREGATE_NOT_ALLOWED`). |
| Trace a `STRUCT_*` rejection | `src/validate/structural/<rule>.ts`; orchestrated in `src/validate/structural/index.ts`. Each rule file is one ≤ 100-line function; tests at `test/unit/validate/structural/<rule>.test.ts` mirror the file. |
| Trace a `SEM_*` rejection | `src/validate/semantic/<rule>.ts`; orchestrated in `src/validate/semantic/index.ts`. Type-inference lives in `validate/semantic/types.ts` (`inferExprType`); field resolution in `validate/semantic/fields.ts` (`resolveField`). |
| Inspect compiled SQL for a graph | `import { explain } from '@rntme/graph-ir-compiler'; const r = explain(spec, pdm, qsm); r.value.sql; r.value.paramOrder;` — also returns `parsed`, `canonical`, `semanticPlan`, `relational`. |
| Map an event-store envelope back to a transition | `src/emit/event-type.ts → deriveEventTypeName(aggregate, transition)` produces the envelope's `eventType`. To go the other way: walk PDM's derived event-type table (`@rntme/pdm → deriveEventTypes`) and match on `eventType`. |
| Add a new aggregate function | (1) Add the function name to the `measureSpec` enum in `src/parse/schema.ts`. (2) Handle it in `src/lower/sqlite/lower.ts → measureToAggSql`. (3) Add a semantic-validator case in `src/validate/semantic/aggregate-phase.ts`. (4) Document in MVP spec. |
| Wire the compiler into a new runtime | Use `compile / execute` for queries and `compileCommand / executeCommand` for commands. Re-validate PDM and QSM before passing them in (compileCommand re-validates internally; compile assumes pre-validated). Hold one `better-sqlite3.Database` per QSM target; one `EventStore` for command-side. |
| Find an example end-to-end command | `test/e2e/command-assign.e2e.test.ts` exercises `compileCommand → executeCommand` against the issue-tracker fixture, including replay and concurrency. |
| Find an example end-to-end query with JOINs | `test/e2e/join.e2e.test.ts` and `test/e2e/category-sales.e2e.test.ts` (latter is also the golden-test source for the SQL-emission pipeline). |
| Diagnose a "missing required param" at runtime | `src/execute/execute.ts → executeCompiled`; the throw decorates the Error with `code: 'RUNTIME_MISSING_REQUIRED_PARAM'`. Check that the input mode for the param is `required` and that the caller is supplying the key in `paramValues`. |
| Diagnose a SQLite error wrapped at runtime | `src/execute/execute.ts → executeCompiled` catches and rethrows as `RUNTIME_SQLITE_ERROR`. The original SQLite message is preserved in `.message`; the SQL is in `compiled.sql`. |
| Add a new input mode | (1) Add the mode to the `inputMode` enum in `src/parse/schema.ts`. (2) Add a branch in `src/index.ts → compile` (and `command-runtime/compile.ts`) that maps the mode to `optionalParams` / `paramDefaults` as appropriate. (3) Update `src/execute/execute.ts → executeCompiled` if the runtime binding rules differ. (4) Add a semantic rule in `src/validate/semantic/param-context.ts`. |
| Confirm a rule's regression coverage | Every rule file `src/validate/<kind>/<rule>.ts` has a sibling `test/unit/validate/<kind>/<rule>.test.ts`. Every lower case `src/lower/sqlite/<area>.ts` has a sibling `test/unit/lower/sqlite/<area>.test.ts`. Missing sibling = missing coverage. |

## Specs

- [`../../graph_ir_rc_7.md`](../../graph_ir_rc_7.md) — Graph IR rc7 language: operators, expression grammar, named shapes, input modes, role inference, signature/output shapes.
- [`../../docs/superpowers/specs/done/2026-04-13-graph-ir-sql-compiler-mvp-design.md`](../../docs/superpowers/specs/done/2026-04-13-graph-ir-sql-compiler-mvp-design.md) — Authoritative MVP design: layer order, Tier 1 scope, error code conventions, what is intentionally out of scope.
- [`../../docs/superpowers/specs/done/2026-04-14-mutations-design.md`](../../docs/superpowers/specs/done/2026-04-14-mutations-design.md) — Command path: emit nodes, read prelude, replay-and-validate, optimistic concurrency. §4 = command-runtime.
- [`../../docs/superpowers/specs/2026-04-16-predicate-optional-fix-design.md`](../../docs/superpowers/specs/2026-04-16-predicate-optional-fix-design.md) — Root-cause analysis and fix for the `wrapPredicateOptional` SQL `?` misalignment.
- [`../../docs/superpowers/specs/2026-04-16-qsm-relations-migration-design.md`](../../docs/superpowers/specs/2026-04-16-qsm-relations-migration-design.md) — Recent QSM relations migration that retargeted dot-nav planning at `qsm.relations` (consumed in `lower/sqlite/joins.ts → expandChain` and validated in `validate/semantic/sources.ts → checkNavRelations`).

## Glossary

- **Authoring spec.** The top-level rc7 JSON document: `{ version: '1.0-rc7', pdmRef, qsmRef, shapes, graphs }`. Type: `AuthoringSpecOutput` in `parse/schema.ts`.
- **Canonical graph.** Output of `normalize()` — a kind-tagged node tree (`CanonicalFindMany | CanonicalFilter | CanonicalMap | ...`) with allocated scope IDs and defaulted sort keys. Type: `CanonicalGraph` in `types/canonical.ts`.
- **Semantic plan.** Output of `buildSemanticPlan()` — a flat `PlanStep[]` where each step carries materialised field metadata (column names, types, nullability) needed by lowering. Type: `SemanticPlan` in `types/semantic-plan.ts`.
- **Relational tree.** Output of `buildRelational()` — target-independent algebra (`Scan / Filter / Project / Aggregate / Sort / Limit / Join`). Type: `RelOp` in `types/relational.ts`.
- **`paramOrder`.** The list of parameter names in the positional order their `?` placeholders appear in the emitted SQL. Bind values must be supplied in this exact order; `execute()` does the mapping.
- **`predicate_optional`.** An input mode that lets a `filter` predicate accept `null` and degrade to `TRUE` for that conjunct. Implemented as `OR (? IS NULL)` appended via `wrapPredicateOptional`.
- **Dot-nav.** A field path `alias.relation[.relation...].field` resolved at lower-time into LEFT JOINs against the `relation`-target projection. Validated in `checkNavRelations`; planned in `expandChain`.
- **Entity-mirror projection.** A QSM projection whose `backing` is `entity-mirror` and whose `source.entity` matches the scan entity. Required for dot-nav to start from a `findMany` over an entity (vs. a projection).
- **Read prelude.** A non-emit subgraph compiled as a SELECT and run before the emit-plan executes; zero rows means `COMMAND_GUARD_REJECTED`. Used for capacity-style checks.
- **Emit plan.** Compile-time data for one `emit` node: aggregate, transition, derived event type, `affects` field list, payload exprs, `isCreation`, `fromStates`, `toState`. Built by `buildEmitPlans` from PDM's derived event-type table.
- **Affects.** PDM-declared list of fields a transition modifies. Drives `derivePayload`'s `after` shape and the choice of `stateField`.
- **State field.** First field in `affects` that has no explicit payload entry — set to `plan.toState` at runtime. Defaults to `'status'` if all `affects` fields are explicitly listed in `payload`.
- **Optimistic concurrency.** `executeCommand` calls `appendEvents` with `expectedVersion` from replay; a stale write surfaces as `ConcurrencyConflict` from the store and is wrapped as `CommandExecutionError{ code: 'COMMAND_CONCURRENCY_CONFLICT' }`.
- **`Validated*` brand.** `ValidatedPdm` and `ValidatedQsm` are nominally-typed by their respective packages and re-exported here. Constructible only via the validators in `@rntme/pdm` and `@rntme/qsm` — do not cast.
- **Tier 1 / Tier 2.** Tier 1 = MVP feature set permitted by the structural validator. Tier 2 = features the schema accepts but the validator rejects (`distinct`, `lookupOne`, `lookup`, `exists`, `$list`, named predicate refs).
- **Guard node.** The last non-emit node of a command graph (when present). Lowered as an independent SELECT by `command-runtime/compile.ts` and stored on `compiled.readPrelude`; its node id lives at `compiled.readPreludeGuardNodeId`.
- **Scope.** `{ aliases: Map<alias, {entity}>, shapeFields?: Map<field, {type, nullable}> }`. Built per-node by `validate/semantic/index.ts`; before `reduce` it is alias-based, after `reduce` it is shape-based.
- **Explain artifacts.** Intermediate products accumulated by `explain()`: `parsed` (after Zod), `canonical` (after `normalize`), `semanticPlan` (after `buildSemanticPlan`), `relational` (after `buildRelational`), and the final `sql` + `paramOrder`. On failure, `explain()` returns the partial set reached before the failing stage.
- **Derived event type.** PascalCase(aggregate) + PascalCase(transition), e.g. `Issue` + `report` → `IssueReport`. Canonical source: `@rntme/pdm → deriveEventTypes(pdm)`; single-pair lookup via `emit/event-type.ts → lookupEventTypeSpec`.
- **Before/after payload.** Each emitted event's payload is `{ before: state-before-or-null, after: state-after }`. `before` is `null` on creation transitions; otherwise it is the projection of `currentState` onto `plan.affects`. `after` is `{ stateField: plan.toState, ...explicit-payload-exprs-evaluated }`.
- **Expected version.** The version number `executeCommand` passes to `appendEvents`. Equal to the `version` returned by `replayAggregateState` (the last seen event's `version`, or `0` for an empty stream). A mismatch triggers `ConcurrencyConflict` in the event-store and `COMMAND_CONCURRENCY_CONFLICT` from this package.
- **`GraphIrError`.** The error record shape: `{ layer, code, message, location?: { graphId?, nodeId?, path? }, hint? }`. Every error-producing path in this package constructs one.
