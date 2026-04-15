# @rntme/graph-ir-compiler

Graph IR → **SQLite SQL** compiler (query path) and state-machine-gated **event-sourced command runtime** (command path). One authoring language, two execution tracks.

- **Query path.** `findMany / filter / map / reduce / sort / limit` graphs compile to a prepared `SELECT` with a positional parameter order; `execute(...)` runs it against `better-sqlite3`.
- **Command path.** `emit` nodes (plus an optional read-prelude for capacity-style guards) compile into a plan that, at run time, replays the aggregate, validates the transition against PDM's stateMachine, builds event payloads, and appends via [`@rntme/event-store`](../event-store) under optimistic concurrency.

## Role in the system

Depends on [`@rntme/pdm`](../pdm), [`@rntme/qsm`](../qsm), and [`@rntme/event-store`](../event-store). Consumed by [`@rntme/bindings-http`](../bindings-http) and directly usable for programmatic queries.

## Install

```bash
pnpm add @rntme/graph-ir-compiler @rntme/pdm @rntme/qsm @rntme/event-store better-sqlite3
```

## Quick start — query path

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

## Quick start — command path

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
              status:   { $literal: 'draft' },
            },
          },
        },
      ],
    },
  },
};

const compiled = compileCommand(commandSpec, pdm, qsm);
if (!compiled.ok) throw new Error(JSON.stringify(compiled.errors));

const eventStore = new SqliteEventStore({ filename: './events.db' });

const result = executeCommand(compiled.value, { issueId: 1, title: 'bug', priority: 'high' }, {
  eventStore,
  qsmDb: null,                                // only required for guard preludes
  now:   () => new Date().toISOString(),
  nextId: () => crypto.randomUUID(),
  actor: { kind: 'user', id: 'alice' },
});
// → { aggregateId: '1', version: 1, eventIds: ['...'] }
```

## API

| Export | Purpose |
| ------ | ------- |
| `compile(spec, pdm, qsm, opts?)` | `Result<CompileResult>` — parse, validate, normalise, plan, lower, emit SQL. One graph per call. |
| `execute(compiled, params, db)` | Bind `paramOrder` positionally and return rows from `db.prepare(sql).all(...)`. |
| `run(spec, pdm, qsm, params, db)` | Convenience: `compile` then `execute`. Throws on compile error. |
| `compileCommand(spec, pdm, qsm)` | `Result<CompiledCommand>` — command-graph compile (emit plans, optional read-prelude, role check). |
| `executeCommand(compiled, params, ctx)` | Replays the aggregate via `eventStore.readStream(...)`, validates the transition, builds event envelopes from payload expressions, appends under optimistic concurrency. Returns `CommandResult`. Throws `CommandExecutionError`. |
| `runCommand(spec, pdm, qsm, params, ctx)` | Convenience: `compileCommand` then `executeCommand`. |
| `explain(spec, pdm, qsm)` | Returns every intermediate artifact — parsed spec, canonical graph, semantic plan, relational tree, SQL, `paramOrder`. For debugging and for the `bindings-http` runtime to audit per-binding compilations. |
| `inferRole(graph)` | Returns `GraphRole` = `'query' \| 'command' \| 'predicate' \| 'mapper' \| 'reducer'`. |
| `deriveEventTypeName(aggregate, transition)` | `Issue` + `report` → `IssueReport`. |
| `CommandExecutionError` | Thrown by `executeCommand`. `err.code ∈ { COMMAND_ILLEGAL_TRANSITION, COMMAND_GUARD_REJECTED, COMMAND_CONCURRENCY_CONFLICT }`; may carry `detail`. |
| `ok`, `err`, `isOk`, `isErr`, `ERROR_CODES` | `Result<T>` helpers and full error-code registry. |

## Exported types

```ts
import type {
  CompileResult,        // { sql, paramOrder, shape, optionalParams, paramDefaults }
  CompileOptions,       // { target?: 'sqlite' }
  CompiledCommand,      // { graphId, aggregate, emits, readPrelude, readPreludeGuardNodeId, paramOrder, optionalParams, paramDefaults }
  CommandResult,        // { aggregateId, version, eventIds }
  EmitPlan,             // per-emit node: aggregateIdExpr, transition, eventType, affects, payloadExprs, actorExpr?, isCreation, isSelfLoop, fromStates, toState
  ExecuteCommandContext,
  GraphRole,            // 'query' | 'command' | 'predicate' | 'mapper' | 'reducer'
  ExplainOutput,
  Result, GraphIrError, ErrorCode, Layer, Ok, Err,
  ValidatedPdm, ValidatedQsm,   // re-exported for convenience
} from '@rntme/graph-ir-compiler';
```

## Compilation layers

```
authoring JSON
  → parse (Zod)
  → validate structural  (DAG, shape coverage, tier-1 gates)
  → normalise           (canonical graph, explicit scopes)
  → validate semantic    (types, sources, nullability, param context, emit/command rules)
  → semantic plan       (per-node plan: sources, joins, aggregation, output shape)
  → relational algebra  (target-independent)
  → lower to SQLite     (join plan, expr lowering, nulls-first/last, param order)
  → emit SQL string
```

`explain(...)` returns every artifact in the chain, which makes regressions easy to diagnose.

## Supported features (Tier 1)

**Query path.**
- Nodes: `findMany`, `filter` (inline expr), `map`, `reduce`, `sort`, `limit`.
- Input modes: `root`, `required`, `nullable`, `defaulted`, `predicate_optional`.
- Expression operators: comparison, arithmetic, logical, `is_null`, `like`, `concat`, `coalesce`, `between`, `case`.
- Dot-navigation joins through PDM relations (functional `one`-cardinality only).
- Aggregates: `count`, `count_distinct`, `sum`, `avg`, `min`, `max`, `group_array`.

**Command path.**
- `emit` nodes with declarative `aggregate`, `aggregateId` expression, `transition`, `payload{}`, optional `actor`.
- Creation transitions (`from: null`) are detected and compile to a `version = 1` append; others replay-and-validate.
- Role inference promotes a graph from `query` to `command` when any `emit` is present; mixing emit and non-emit terminal outputs is rejected with `GRAPH_MIXED_ROLE`.
- Optional read-prelude on a single guard node (e.g. capacity check) — compiled via the query path and executed before validating the transition.
- Optimistic concurrency: `CommandExecutionError{ code: 'COMMAND_CONCURRENCY_CONFLICT' }` surfaces `ConcurrencyConflict` from the event-store.

**Target dialect.** SQLite ≥ 3.30 (required for `NULLS FIRST/LAST`).

## Not yet supported

`distinct`, `lookupOne`, `lookup` expression, named predicate graphs, `exists`, `in`, `$list`, role inference beyond `query` / `command`, planner / optimizer rules, capability inference, multi-aggregate commands, composite-key aggregates, bindings (see [`@rntme/bindings`](../bindings)), YAML authoring, multi-dialect SQL.

## Error codes (selection)

Parse / structural: `PARSE_INVALID_JSON`, `PARSE_SCHEMA_VIOLATION`, `STRUCT_DUPLICATE_GRAPH_ID`, `STRUCT_DUPLICATE_NODE_ID`, `STRUCT_INVALID_INPUT_REF`, `STRUCT_DAG_CYCLE`, `STRUCT_INVALID_OUTPUT_FROM`, `STRUCT_MULTIPLE_ROOT_INPUTS`, `STRUCT_ROOT_INPUT_TYPE`, `STRUCT_ROOT_REF_WITHOUT_ROOT_INPUT`, `STRUCT_UNKNOWN_SHAPE`, `STRUCT_MAP_SHAPE_COVERAGE`, `STRUCT_REDUCE_SHAPE_COVERAGE`, `TIER1_UNSUPPORTED_NODE`, `TIER1_UNSUPPORTED_EXPR`.

Semantic: `SEM_SOURCE_NOT_FOUND`, `SEM_FIELD_NOT_FOUND`, `SEM_TYPE_MISMATCH`, `SEM_SHAPE_MISMATCH`, `SEM_NULLABILITY_VIOLATION`, `SEM_PARAM_UNKNOWN`, `SEM_PARAM_CONTEXT`.

Command-compile: `GRAPH_MIXED_ROLE`, `CMD_OUTPUT_SHAPE_INVALID`, `CMD_EMIT_UNREACHABLE`, `CMD_UNKNOWN_AGGREGATE`, `CMD_AGGREGATE_WITHOUT_STATE_MACHINE`, `CMD_UNKNOWN_TRANSITION`, `CMD_PAYLOAD_MISSING_FIELD`, `CMD_PAYLOAD_EXTRANEOUS_FIELD`, `CMD_PAYLOAD_TYPE_MISMATCH`, `CMD_AGGREGATE_ID_TYPE_MISMATCH`, `CMD_MULTI_AGGREGATE_NOT_ALLOWED`.

Command-runtime (via `CommandExecutionError`): `COMMAND_ILLEGAL_TRANSITION`, `COMMAND_GUARD_REJECTED`, `COMMAND_CONCURRENCY_CONFLICT`.

Runtime / lowering: `RUNTIME_MISSING_REQUIRED_PARAM`, `RUNTIME_SQLITE_ERROR`.

## Specs

- Language: [`graph_ir_rc_7.md`](../../graph_ir_rc_7.md).
- Compiler scope and MVP deviations: [`docs/superpowers/specs/2026-04-13-graph-ir-sql-compiler-mvp-design.md`](../../docs/superpowers/specs/2026-04-13-graph-ir-sql-compiler-mvp-design.md).
- Command runtime: [`docs/superpowers/specs/2026-04-14-mutations-design.md`](../../docs/superpowers/specs/2026-04-14-mutations-design.md) §4.
