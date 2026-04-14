# @rntme/graph-ir-compiler

Graph IR → SQL compiler (SQLite target, MVP Tier 1).

## Install

```bash
pnpm add @rntme/graph-ir-compiler better-sqlite3
```

## Quick start

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
        { id: 'paged', type: 'limit', config: { input: 'items', count: { $param: 'limit' } } },
      ],
    },
  },
};

const pdm = { /* see docs/pdm.md */ };
const qsm = { /* see docs/qsm.md */ };

const r = compile(spec, pdm, qsm);
if (!r.ok) throw new Error(r.errors.map((e) => e.code).join(', '));

const db = new Database('app.db');
const rows = execute(r.value, { limit: 5 }, db);
```

## API

| Function | Purpose |
| -------- | ------- |
| `compile(spec, pdm, qsm)` | Returns `Result<CompileResult>` with `sql`, `paramOrder`, output `shape`, `optionalParams`, `paramDefaults`. |
| `execute(compiled, params, db)` | Runs the prepared statement with positional bindings and returns rows. |
| `run(spec, pdm, qsm, params, db)` | Convenience: compile + execute in one call. |
| `explain(spec, pdm, qsm)` | Returns all intermediate artifacts for debugging. |

## Supported features (Tier 1)

- Nodes: `findMany`, `filter` (inline expr), `map`, `reduce`, `sort`, `limit`.
- Input modes: `root`, `required`, `nullable`, `defaulted`, `predicate_optional`.
- EXPR operators: comparison, arithmetic, logical, `is_null`, `like`, `concat`, `coalesce`, `between`, `case`.
- Dot-navigation joins through PDM relations (functional `one`-cardinality only).
- Aggregates: `count`, `count_distinct`, `sum`, `avg`, `min`, `max`, `group_array`.
- Target: SQLite ≥ 3.30 (for `NULLS FIRST/LAST` support).

## Not yet supported

`distinct`, `lookupOne`, `lookup` expr, named predicate graphs, `exists`, `in`, `$list`, role inference beyond `query`, planner/optimizer rules, capability inference, bindings, YAML authoring, multi-dialect.
