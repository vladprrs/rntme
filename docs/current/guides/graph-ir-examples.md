# Compilation Examples: Graph IR -> SQLite

Five examples, from minimal to kitchen sink, showing what `compile(spec, pdm, qsm)`
produces. All examples are compiled and reproduced by
[`../demo-sql.mjs`](/packages/artifacts/graph-ir-compiler/demo-sql.mjs).

## Compiler Pipeline

```text
authoring spec  --parse-->  canonical  --semantic-plan-->  relational IR  --lower-->  SQL AST  --emit-->  SQL
     (JSON)                                                 (Scan/Filter/...)                         (string + paramOrder)
```

Use `explain(spec, pdm, qsm)` to inspect all intermediate artifacts for one graph.

## Domain Model

All examples use the PDM from `test/e2e/fixtures/commerce.pdm.json`:

| Entity | Table | Key fields | Relations (`one`) |
| --- | --- | --- | --- |
| `OrderItem` | `order_items` | `id, orderId, productId, unitPrice, quantity` | `order -> Order`, `product -> Product` |
| `Order` | `orders` | `id, createdAt` | - |
| `Product` | `products` | `id, categoryId, name` | `category -> Category` |
| `Category` | `categories` | `id, name` (nullable) | - |

Field names in specs are camelCase (as in PDM); SQL column names are snake_case (from `column:` in PDM).
SQL table aliases come from the entity name in lowerCamel (`OrderItem` -> `orderItem`).

---

## Example 1 - Minimal: `findMany`

**Goal:** fetch every row from a table.

```js
{
  version: '1.0-rc7', pdmRef: '...', qsmRef: '...', shapes: {},
  graphs: {
    g: {
      id: 'g',
      signature: { inputs: {}, output: { type: 'rowset<OrderItem>', from: 'items' } },
      nodes: [
        { id: 'items', type: 'findMany', config: { source: { entity: 'OrderItem' } } },
      ],
    },
  },
}
```

**SQL:**

```sql
SELECT "orderItem"."id"         AS "id",
       "orderItem"."order_id"   AS "orderId",
       "orderItem"."product_id" AS "productId",
       "orderItem"."unit_price" AS "unitPrice",
       "orderItem"."quantity"   AS "quantity"
FROM   "order_items" AS "orderItem"
```

- `paramOrder: []`
- `shape: OrderItem`

Note: without an explicit `map` node, the select is built from all fields on the entity and aliases columns back to camelCase.

---

## Example 2 - Simple: Filter With a Required Parameter

**Goal:** filter `OrderItem` by `quantity >= :minQty`.

```js
nodes: [
  { id: 'items', type: 'findMany', config: { source: { entity: 'OrderItem' } } },
  { id: 'f',     type: 'filter',
    config: { input: 'items', expr: { gte: ['orderItem.quantity', { $param: 'minQty' }] } } },
]
// signature.inputs: { minQty: { type: 'integer', mode: 'required' } }
```

**SQL:**

```sql
SELECT /* all OrderItem fields */
FROM   "order_items" AS "orderItem"
WHERE  ("orderItem"."quantity" >= ?)
```

- `paramOrder: ["minQty"]`

Note: expressions are written as `{ op: [arg1, arg2] }`. A bare string such as `'orderItem.quantity'` is a field reference (dot path), so a **string literal** must be wrapped in `{ $literal: 'text' }`; otherwise the parser tries to resolve it as a path.

---

## Example 3 - Medium: `predicate_optional` + `sort` + `limit` With a Default

**Goal:** a listing with an optional price filter, price sorting, and pagination.
If the client does not pass `minPrice`, the filter is skipped; `limit` defaults to 20.

```js
{
  signature: {
    inputs: {
      minPrice: { type: 'decimal', mode: 'predicate_optional' },
      limit:    { type: 'integer', mode: 'defaulted', default: 20 },
    },
    output: { type: 'rowset<OrderItem>', from: 'paged' },
  },
  nodes: [
    { id: 'items', type: 'findMany', config: { source: { entity: 'OrderItem' } } },
    { id: 'f', type: 'filter',
      config: { input: 'items', expr: { gte: ['orderItem.unitPrice', { $param: 'minPrice' }] } } },
    { id: 's', type: 'sort',
      config: { input: 'f', by: [{ field: 'orderItem.unitPrice', dir: 'desc', nulls: 'last' }] } },
    { id: 'paged', type: 'limit', config: { input: 's', count: { $param: 'limit' } } },
  ],
}
```

**SQL:**

```sql
SELECT /* all OrderItem fields */
FROM   "order_items" AS "orderItem"
WHERE  ((? IS NULL) OR ("orderItem"."unit_price" >= ?))
ORDER BY "orderItem"."unit_price" DESC NULLS LAST
LIMIT  ?
```

- `paramOrder: ["minPrice", "minPrice", "limit"]`
- `optionalParams: ["minPrice"]`
- `paramDefaults: { limit: 20 }`

Notes:
- `predicate_optional` expands to `(? IS NULL) OR (<predicate>)`, so `minPrice`
  **occupies two slots** in `paramOrder`; runtime binds it twice.
- `defaulted` uses one `paramOrder` slot plus a default value in `paramDefaults`; caller code
  supplies the default (see `execute`), and the compiler does not bake defaults into SQL.

---

## Example 4 - Complex: JOIN Through Dot Navigation

**Goal:** filter `OrderItem` by the date of the related `Order`. The compiler turns dot path
`orderItem.order.createdAt` into a `LEFT JOIN` through `OrderItem.order` (cardinality `one`).

```js
{
  signature: {
    inputs: {
      dateFrom: { type: 'datetime', mode: 'required' },
      dateTo:   { type: 'datetime', mode: 'required' },
    },
    output: { type: 'rowset<OrderItem>', from: 'f' },
  },
  nodes: [
    { id: 'items', type: 'findMany', config: { source: { entity: 'OrderItem' } } },
    { id: 'f', type: 'filter', config: { input: 'items',
        expr: { between: ['orderItem.order.createdAt', { $param: 'dateFrom' }, { $param: 'dateTo' }] } } },
  ],
}
```

**SQL:**

```sql
SELECT /* all OrderItem fields */
FROM   "order_items" AS "orderItem"
LEFT JOIN "orders" AS "order" ON ("orderItem"."order_id" = "order"."id")
WHERE  ("order"."created_at" BETWEEN ? AND ?)
```

- `paramOrder: ["dateFrom", "dateTo"]`

Notes:
- The relation name (`order`) becomes the table alias.
- JOIN is always `LEFT` in the tier-1 MVP; `INNER` is not selected even when the field is NOT NULL.
- The SELECT still contains only fields from the left entity; the JOIN is needed only for the predicate.

### Internal Representations

`explain()` for the same graph:

```jsonc
// semanticPlan.steps
[
  { "kind": "scan", "nodeId": "items", "table": "order_items", "alias": "orderItem",
    "entity": "OrderItem", "fields": [ /* all OrderItem fields */ ] },
  { "kind": "filter", "nodeId": "f",
    "predicate": { "between": ["orderItem.order.createdAt", { "$param": "dateFrom" }, { "$param": "dateTo" }] } }
]

// relational IR
{ "op": "Filter",
  "predicate": { "between": [ /* same predicate */ ] },
  "child": { "op": "Scan", "table": "order_items", "alias": "orderItem", "entity": "OrderItem", "fields": [...] } }
```

The JOIN is not present in relational IR yet; it appears during `lower` from dot paths in predicates.

---

## Example 5 - Kitchen Sink: filter -> 2-hop JOIN -> reduce -> HAVING -> sort -> limit

**Goal:** sales aggregate by product category for a period, with an optional revenue threshold and pagination.
Demonstrates: `reduce` (GROUP BY), `HAVING` (filter **after** reduce), two-hop JOIN
(`orderItem.product.categoryId`), and all three parameter modes.

```js
{
  shapes: {
    CategorySalesAgg: { fields: {
      categoryId:    { type: 'integer', nullable: false },
      revenue:       { type: 'decimal', nullable: false },
      totalQuantity: { type: 'integer', nullable: false },
      lineCount:     { type: 'integer', nullable: false },
      avgItemPrice:  { type: 'decimal', nullable: false },
    } },
  },
  graphs: {
    g: {
      id: 'g',
      signature: {
        inputs: {
          dateFrom:   { type: 'datetime', mode: 'required' },
          dateTo:     { type: 'datetime', mode: 'required' },
          minRevenue: { type: 'decimal',  mode: 'predicate_optional' },
          limit:      { type: 'integer',  mode: 'defaulted', default: 20 },
        },
        output: { type: 'rowset<CategorySalesAgg>', from: 'paged' },
      },
      nodes: [
        { id: 'items', type: 'findMany', config: { source: { entity: 'OrderItem' } } },
        { id: 'dateFiltered', type: 'filter', config: { input: 'items',
            expr: { between: ['orderItem.order.createdAt',
                              { $param: 'dateFrom' }, { $param: 'dateTo' }] } } },
        { id: 'grouped', type: 'reduce', config: {
            input: 'dateFiltered', into: 'CategorySalesAgg',
            group: { categoryId: 'orderItem.product.categoryId' },
            measures: {
              revenue:       { fn: 'sum',   expr: { mul: ['orderItem.unitPrice', 'orderItem.quantity'] } },
              totalQuantity: { fn: 'sum',   expr: 'orderItem.quantity' },
              lineCount:     { fn: 'count' },
              avgItemPrice:  { fn: 'avg',   expr: 'orderItem.unitPrice' },
            },
          } },
        { id: 'revFiltered', type: 'filter', config: { input: 'grouped',
            expr: { gte: ['revenue', { $param: 'minRevenue' }] } } },
        { id: 'sorted', type: 'sort', config: { input: 'revFiltered',
            by: [{ field: 'revenue', dir: 'desc', nulls: 'last' }] } },
        { id: 'paged', type: 'limit', config: { input: 'sorted', count: { $param: 'limit' } } },
      ],
    },
  },
}
```

**SQL:**

```sql
SELECT "product"."category_id"                                   AS "categoryId",
       SUM(("orderItem"."unit_price" * "orderItem"."quantity"))  AS "revenue",
       SUM("orderItem"."quantity")                               AS "totalQuantity",
       COUNT(*)                                                  AS "lineCount",
       AVG("orderItem"."unit_price")                             AS "avgItemPrice"
FROM   "order_items" AS "orderItem"
LEFT JOIN "orders"   AS "order"   ON ("orderItem"."order_id"   = "order"."id")
LEFT JOIN "products" AS "product" ON ("orderItem"."product_id" = "product"."id")
WHERE  ("order"."created_at" BETWEEN ? AND ?)
GROUP BY "product"."category_id"
HAVING ((? IS NULL) OR ("revenue" >= ?))
ORDER BY "revenue" DESC NULLS LAST
LIMIT  ?
```

- `paramOrder: ["dateFrom", "dateTo", "minRevenue", "minRevenue", "limit"]`
- `optionalParams: ["minRevenue"]`
- `paramDefaults: { limit: 20 }`
- `shape: CategorySalesAgg`

Notes:
- Filter `dateFiltered` is **before** `reduce`, so it goes into `WHERE`.
- Filter `revFiltered` is **after** `reduce` and references output field `revenue`, so it goes into `HAVING`.
- The JOIN to `products` is needed not for SELECT (we project only `category_id`) but for `GROUP BY "product"."category_id"`;
  it is the second level of dot path `orderItem.product.categoryId`.
- `count` without arguments becomes `COUNT(*)`; `count_distinct` (not used here) becomes `COUNT(DISTINCT ...)`.

---

## Not Yet Supported

See the README section *Not yet supported*: `distinct`, `lookupOne`, `lookup` expressions, named predicate graphs,
`exists`, `in`, `$list`, `case` (!). The README marks `case` as Tier 1, but the semantic validator does not know it
(`src/validate/semantic/types.ts:163`), which is a documentation bug.
