# LLM Authoring Guide - Artifact Format for `graph-ir-compiler`

This document is a reference for an LLM that will **generate** input artifacts
(`spec`, `pdm`, `qsm`) for `compile(spec, pdm, qsm)` from `@rntme/graph-ir-compiler`.

Goal: describe the format **only as much as needed** for an LLM to write valid specs
on the first attempt without guessing. Every rule below is normative and backed by code.

## 0. Input Contract

```text
compile(spec, pdm, qsm) -> Result<{ sql, paramOrder, shape, optionalParams, paramDefaults }>
```

Three independent artifacts, each with its own Zod schema:

| Artifact | Author | Changes per query | Describes |
| --- | --- | --- | --- |
| `pdm` | domain description | no (stable) | physical tables, fields, relations |
| `qsm` | query-side marks | no (stable) | projections, relation roles (almost empty in Tier 1) |
| `spec` | authoring spec for one graph/query | yes | query shape (nodes + signature) |

**Important**: an LLM usually generates only **`spec`**, using pre-fixed
`pdm`/`qsm`. Still, it must understand the PDM/QSM structure to reference
entities, fields, and relations correctly.

## 1. Primitive Types

The same primitive set is used across all three artifacts:

```ts
type Primitive = 'integer' | 'long' | 'decimal' | 'string' | 'boolean' | 'date' | 'datetime'
```

Compatibility (widening) rules are implemented in `validate/semantic/types.ts`:
- `integer < long < decimal` (arithmetic and comparisons widen upward).
- `date < datetime`.
- Numbers are comparable only with numbers; `date`/`datetime` only with each other; strings/booleans only with themselves.
- `COMPARABLE = {integer, long, decimal, string, date, datetime, boolean}`; only these work in `eq/neq/gt/gte/lt/lte`.

## 2. PDM - Physical Data Model

Describes **physical tables**. The LLM reads PDM to know entity, field, and relation names.

```jsonc
{
  "entities": {
    "<EntityName>": {                          // logical name (PascalCase, used in spec)
      "table": "<sql_table_name>",             // physical table (typically snake_case)
      "fields": {
        "<fieldName>": {                       // logical field name (camelCase)
          "type": "<Primitive>",
          "nullable": <boolean>,
          "column": "<sql_column_name>"
        }
        // ...
      },
      "relations": {
        "<relName>": {                         // relation alias (camelCase); becomes table alias in SQL
          "to": "<EntityName>",                // target entity
          "cardinality": "one" | "many",       // only "one" is usable in Tier 1
          "localKey": "<fieldName>",           // field on this entity (logical name)
          "foreignKey": "<fieldName>"          // field on the target entity (logical name)
        }
      },
      "keys": ["<fieldName>", ...]             // primary key (logical names)
    }
  }
}
```

Rules:
- `fields` and `relations` keys are **logical names** (camelCase); dot paths reference them.
- `fields[...].column` values are **physical column names** (SQL identifiers).
- Tier 1 supports navigation only through `cardinality: "one"` relations. `many` is not supported in expressions.

## 3. QSM - Query Semantic Model

Used minimally in Tier 1. Both sections default to `{}`.

```jsonc
{
  "projections": {                             // virtual "tables" for QSM sources
    "<ProjectionName>": {
      "grain":  ["<keyField>", ...],
      "keys":   ["<keyField>", ...],
      "exposed": ["<fieldName>", ...],         // public projection fields
      "source": { "entity": "<EntityName>", "pathPrefix": "<dot.path>" }
    }
  },
  "relationRoles": {                           // "EntityName.relationName": "fact" | "dimension" | ...
    "OrderItem.product": "dimension"
  }
}
```

For most Tier 1 scenarios this is enough:
```json
{ "projections": {}, "relationRoles": {} }
```

## 4. Authoring Spec - What the LLM Generates

```jsonc
{
  "version": "1.0-rc7",                        // REQUIRED, exactly this string
  "pdmRef": "<any string ref>",                // identifying PDM reference
  "qsmRef": "<any string ref>",                // identifying QSM reference
  "shapes": {                                  // named shapes for map/reduce.into
    "<ShapeName>": {
      "fields": {
        "<fieldName>": { "type": "<Primitive>", "nullable": <boolean> }
      }
    }
  },
  "graphs": {                                  // Tier 1 MVP: EXACTLY ONE graph per compile() call
    "<graphId>": {
      "id": "<graphId>",                       // must match the key
      "signature": {
        "inputs":  { "<paramName>": <InputDecl>, ... },
        "output":  { "type": "rowset<T>" | "row<T>", "from": "<nodeId>" }
      },
      "nodes": [ <Node>, ... ]                 // array; order = execution order
    }
  }
}
```

### 4.1. Input Declarations

```ts
type InputDecl = {
  type: Primitive | { list: Primitive } | { row: ShapeName } | { rowset: ShapeName }
  mode: 'root' | 'required' | 'nullable' | 'defaulted' | 'predicate_optional'
  default?: unknown   // used only when mode === 'defaulted'
}
```

Mode semantics:

| mode | meaning | position in `paramOrder` | SQL location |
| --- | --- | --- | --- |
| `root` | input rowset/row | - | (Tier 2, not used yet) |
| `required` | must be provided | one `?` | `WHERE ... = ?` |
| `nullable` | may be `null` | one `?` | bound as-is (NULL flows into predicate) |
| `defaulted` | has `default` | one `?` + `paramDefaults[name] = default` | `?` filled by runtime, not baked into SQL |
| `predicate_optional` | optional filter | **two** consecutive `?` slots | `(? IS NULL) OR (<predicate>)` |

Constraints:
- At most one input with `mode: "root"` per graph.
- A `root` input must have `type: row<T>` or `rowset<T>`.
- `predicate_optional` can be used **only inside `filter.config.expr`**. Use in `map.fields`, `reduce.measures`, or `limit.count` produces `SEM_PARAM_CONTEXT`.

## 5. Nodes - Full Reference

Tier 1 supports exactly 6 node types. The `nodes` array order is execution order.
`id` must be unique within the graph. A graph is a DAG with no cycles.
One node is referenced by `signature.output.from`; it becomes the output.

### 5.1. `findMany` - Row Source

```jsonc
{
  "id": "<nodeId>",
  "type": "findMany",
  "config": {
    "source": { "entity": "<EntityName>" } | { "projection": "<ProjectionName>" }
  }
}
```

- A graph must have at least one `findMany` root source.
- SQL table alias = `camelCase(EntityName)` (for example `OrderItem -> orderItem`).
- After `findMany`, scope contains alias = camelCase entity, with fields from that entity.

### 5.2. `filter` - WHERE or HAVING

```jsonc
{
  "id": "<nodeId>",
  "type": "filter",
  "config": {
    "input": "<nodeId>",      // reference to previous node
    "expr":  <Expr>           // boolean expression (REQUIRED in Tier 1)
    // "predicate": "..."     // named predicate graph is NOT supported in Tier 1
  }
}
```

- `expr` must resolve to `boolean`.
- If `filter` is **before** `reduce`, it compiles to `WHERE`.
- If it is **after** `reduce`, it compiles to `HAVING` and its `expr` may reference result-shape fields.

### 5.3. `map` - Projection

```jsonc
{
  "id": "<nodeId>",
  "type": "map",
  "config": {
    "input": "<nodeId>",
    "into":  "<ShapeName>",   // spec.shapes name OR Entity name OR Projection name
    "fields": {
      "<shapeFieldName>": <FieldExpr>,
      // ...
    }
  }
}
```

Rules:
- The `fields` key set must **exactly match** the `into` shape fields
  (otherwise `STRUCT_MAP_SHAPE_COVERAGE`). No extra keys, no missing keys.
- `<FieldExpr>` is an `Expr` OR `{ lookup: {...} }`, but `lookup` is forbidden in Tier 1.
- The expression type must be widen-compatible with the target field type.

### 5.4. `reduce` - GROUP BY + Aggregates

```jsonc
{
  "id": "<nodeId>",
  "type": "reduce",
  "config": {
    "input": "<nodeId>",
    "into":  "<ShapeName>",
    "group": {                              // grouping keys
      "<shapeFieldName>": "<dot.path>"      // only a string dot path, NOT Expr
    },
    "measures": {
      "<shapeFieldName>": {
        "fn": "count" | "count_distinct" | "sum" | "avg" | "min" | "max" | "group_array",
        "expr": <Expr>                      // always required except for "count"
      }
    }
  }
}
```

Rules:
- The combined key set `group union measures` must cover every `into` field (otherwise `STRUCT_REDUCE_SHAPE_COVERAGE`).
- Aggregate return types:
  - `count`, `count_distinct` -> `integer`
  - `sum(integer)` -> `integer`, `sum(long|decimal)` -> `long`/`decimal`
  - `avg(numeric)` -> `decimal`
  - `min`/`max` -> argument type
  - `group_array` -> `string`
- `count` without an argument becomes `COUNT(*)`.

### 5.5. `sort` - ORDER BY

```jsonc
{
  "id": "<nodeId>",
  "type": "sort",
  "config": {
    "input": "<nodeId>",
    "by": [                                 // at least one key
      {
        "field": "<dot.path>" | "<shapeFieldName>",  // after reduce, a shape field
        "dir":   "asc" | "desc",            // default: "asc"
        "nulls": "first" | "last"           // default: "last"
      }
    ]
  }
}
```

### 5.6. `limit` - LIMIT

```jsonc
{
  "id": "<nodeId>",
  "type": "limit",
  "config": {
    "input": "<nodeId>",
    "count": <non-negative int> | { "$param": "<name>" }
  }
}
```

- Literal -> `LIMIT 3` (SQL constant).
- `$param` -> `LIMIT ?` (slot in `paramOrder`). The parameter cannot be `predicate_optional`.

## 6. EXPR - Expression Grammar

**Main subtlety**: a bare string is a **dot path to a field**, NOT a string literal.
To produce a string literal, use `{ "$literal": "text" }`.

```ts
type Expr =
  | string                                      // dot path: "orderItem.order.createdAt" or "revenue" (shape field)
  | number                                      // integer when whole, decimal otherwise
  | boolean
  | null
  | { $literal: string }                        // STRING literal (ONLY strings; use number for numeric values)
  | { $param: string }                          // reference to signature.inputs.<name>
  | { [op: string]: Expr[] }                    // operator node (see table below)
  | { between: [Expr, Expr, Expr] }             // special form
  // ALLOWED BY SCHEMA, BUT NOT SUPPORTED IN TIER 1:
  // | { case: { when: [[Expr, Expr], ...], else: Expr } }   <- parses, then fails semantic: "unsupported operator case"
  // | { exists: { relation: string, where?: Expr } }        <- rejected structurally
  // | { $list: Expr[] }                                     <- rejected structurally
  // | { in: ... }                                           <- rejected structurally
```

### 6.1. Supported Operators (Tier 1)

| Operator | Arity | Argument types | Result type |
| --- | --- | --- | --- |
| `eq`, `neq`, `gt`, `gte`, `lt`, `lte` | 2 | same after widening, both `COMPARABLE` | `boolean` |
| `add`, `sub`, `mul`, `div` | 2 | `numeric x numeric` | widened numeric (integer / long / decimal) |
| `and`, `or` | variadic | all `boolean` | `boolean` |
| `not` | variadic (usually 1) | `boolean` | `boolean` |
| `is_null` | 1 | any | `boolean` (non-null) |
| `like` | 2 | `string x string` | `boolean` |
| `concat` | variadic | all `string` | `string` (non-null) |
| `coalesce` | variadic | types must widen | widened type; nullable if ALL inputs are nullable |
| `between` | 3 | all must widen | `boolean` |

Syntax is unified: `{ "<op>": [arg1, arg2, ...] }`. Exceptions: `between`
uses a **3-tuple**; `case`/`exists` have their own object forms
(but are unavailable in Tier 1).

### 6.2. Examples

```jsonc
// Comparison with parameter
{ "gte": ["orderItem.unitPrice", { "$param": "minPrice" }] }

// AND + LIKE + NOT IS_NULL
{ "and": [
    { "like": ["product.name", { "$param": "q" }] },
    { "not": [{ "is_null": ["product.categoryId"] }] }
] }

// BETWEEN (note: an array with THREE items is the special form)
{ "between": ["orderItem.order.createdAt", { "$param": "from" }, { "$param": "to" }] }

// Arithmetic in measures
{ "mul": ["orderItem.unitPrice", "orderItem.quantity"] }

// String concatenation with literals ($literal is required)
{ "concat": [ { "$literal": "cat#" }, { "coalesce": ["category.name", { "$literal": "n/a" }] } ] }
```

## 7. Dot Paths

A string in EXPR, `sort.by[].field`, or `reduce.group[*]` is a dot path.

Resolver (`validate/semantic/fields.ts`):
1. `head.field` - the head is an **alias** (= camelCase of the active `findMany` entity),
   followed by a field name.
2. `head.rel1.rel2.field` - any chain of `one` relations may appear between head and field.
   Every step makes the result field nullable, even if the source was NOT NULL.
3. After `reduce`, scope contains **output shape** fields; reference them by
   **one name**: `"revenue"`, not `"agg.revenue"`.

Common mistakes:
- `"unitPrice"` instead of `"orderItem.unitPrice"` -> `SEM_FIELD_NOT_FOUND: alias "unitPrice" not in scope` (before reduce there are no shape fields, only entity aliases).
- `"agg.revenue"` after reduce -> same error.

## 8. Shapes

A shape is needed only as the target for `map.config.into` or `reduce.config.into`.
If `into` is an Entity name from PDM or a Projection name from QSM, no separate shape is needed.

```jsonc
"shapes": {
  "Line": {
    "fields": {
      "id":    { "type": "integer", "nullable": false },
      "total": { "type": "decimal", "nullable": false }
    }
  }
}
```

- In `signature.output.type`, write `rowset<ShapeName>` or `row<ShapeName>`.
- `map`/`reduce` may target an entity (`into: "OrderItem"`) or projection; expected fields are then read from that target.

## 9. Structural and Semantic Rules

Validator order: `parse -> structural -> canonical -> semantic -> semantic-plan -> relational -> lowering`.

Key invariants:
- All node `id` values are unique inside the graph.
- The graph has no cycles (it is a DAG by `input -> nodeId` links).
- `signature.output.from` points to an existing `nodeId`.
- Exactly one `findMany` is the chain root (multiple sources mean multiple dependencies; Tier 1 is optimized for a linear pipeline).
- For `map`/`reduce`, the output key set matches the fields of `into` (coverage).
- Tier 1 does NOT support nodes: `distinct`, `lookupOne`.
- Tier 1 does NOT support expressions: `exists`, `$list`, `in`, `lookup` in `map.fields`.
- `case` is accepted by the parser but **fails semantically**; do not generate `case`.
- One `compile()` call must contain **exactly 1** graph name in `graphs`.

## 10. Minimal Working Skeleton

```json
{
  "version": "1.0-rc7",
  "pdmRef": "my.pdm.v1",
  "qsmRef": "my.qsm.v1",
  "shapes": {},
  "graphs": {
    "listItems": {
      "id": "listItems",
      "signature": {
        "inputs": {},
        "output": { "type": "rowset<OrderItem>", "from": "items" }
      },
      "nodes": [
        { "id": "items", "type": "findMany", "config": { "source": { "entity": "OrderItem" } } }
      ]
    }
  }
}
```

## 11. Error Codes (For Debugging LLM Generation)

| Layer | Code | What to fix |
| --- | --- | --- |
| `parse` | `PARSE_SCHEMA_VIOLATION` | JSON does not match the Zod schema (extra/missing fields, wrong type) |
| `structural` | `STRUCT_DUPLICATE_NODE_ID` | duplicate `id` values in `nodes` |
| `structural` | `STRUCT_INVALID_INPUT_REF` | `input: "X"` references a non-existing node |
| `structural` | `STRUCT_DAG_CYCLE` | cycle in graph |
| `structural` | `STRUCT_INVALID_OUTPUT_FROM` | `signature.output.from` does not match any `nodeId` |
| `structural` | `STRUCT_MULTIPLE_ROOT_INPUTS` | more than one input with `mode: "root"` |
| `structural` | `STRUCT_ROOT_INPUT_TYPE` | `root` input is not `row<T>`/`rowset<T>` |
| `structural` | `STRUCT_UNKNOWN_SHAPE` | `into` references a missing shape / entity / projection |
| `structural` | `STRUCT_MAP_SHAPE_COVERAGE` | `map.fields` does not cover `into` fields (missing/extra) |
| `structural` | `STRUCT_REDUCE_SHAPE_COVERAGE` | `group union measures` does not cover `into` fields |
| `structural` | `TIER1_UNSUPPORTED_NODE` | `distinct`, `lookupOne`, or `filter.predicate` |
| `structural` | `TIER1_UNSUPPORTED_EXPR` | `exists`, `$list`, `in`, or `lookup` in `map.fields` |
| `semantic` | `SEM_FIELD_NOT_FOUND` | dot path does not resolve (alias/field/relation missing) |
| `semantic` | `SEM_TYPE_MISMATCH` | incompatible expression types, or `unsupported operator "<op>"` |
| `semantic` | `SEM_SHAPE_MISMATCH` | output field type from map/reduce does not match the expected shape field |
| `semantic` | `SEM_PARAM_UNKNOWN` | `$param` references an undeclared input |
| `semantic` | `SEM_PARAM_CONTEXT` | `predicate_optional` used outside `filter.expr` |

## 12. Checklist Before Emitting a Spec

1. `version` is exactly `"1.0-rc7"`.
2. `graphs` has exactly one key, and graph `id` matches that key.
3. Every `nodes[i].config.input` points to a previous `nodes[j].id`.
4. `signature.output.from` points to a real node.
5. `signature.output.type` is `rowset<X>` or `row<X>` with no spaces.
6. String literals are **always** `{ "$literal": "..." }`; otherwise the parser treats a string as a dot path.
7. In expressions, the first dot-path segment is the **entity alias in camelCase** (`orderItem`, `product`), not `OrderItem`.
8. Numbers in EXPR are numbers, not strings: `3`, not `"3"`.
9. For `map.into` / `reduce.into`, check the key set against target fields (no more, no less).
10. `predicate_optional` appears only in `filter.config.expr`.
11. Do NOT generate: `case`, `exists`, `$list`, `in`, `distinct`, `lookupOne`, `lookup`, `filter.predicate`.
12. JOIN is never written explicitly; writing `orderItem.order.createdAt` in an expression is enough. The compiler synthesizes a LEFT JOIN through the `one` relation.

## 13. Live Examples

Runnable examples plus their SQL are in [`examples.md`](./examples.md).
The full test spec set is `packages/artifacts/graph-ir-compiler/test/e2e/*.test.ts`.
The canonical kitchen-sink spec is `packages/artifacts/graph-ir-compiler/test/golden/category-sales/graph.json`.
