# Примеры компиляции: Graph IR → SQLite

5 примеров, от минимального до «kitchen sink», показывающих что `compile(spec, pdm, qsm)`
генерирует на выходе. Все примеры компилируются и воспроизводятся скриптом
[`../demo-sql.mjs`](../demo-sql.mjs).

## Пайплайн компилятора

```
authoring spec  ──parse──▶  canonical  ──semantic-plan──▶  relational IR  ──lower──▶  SQL AST  ──emit──▶  SQL
     (JSON)                                                 (Scan/Filter/...)                            (строка + paramOrder)
```

Посмотреть все промежуточные артефакты одного графа можно через `explain(spec, pdm, qsm)`.

## Доменная модель

Все примеры используют PDM из `test/e2e/fixtures/commerce.pdm.json`:

| Сущность    | Таблица       | Ключевые поля                                            | Связи (`one`)                             |
| ----------- | ------------- | -------------------------------------------------------- | ----------------------------------------- |
| `OrderItem` | `order_items` | `id, orderId, productId, unitPrice, quantity`            | `order → Order`, `product → Product`      |
| `Order`     | `orders`      | `id, createdAt`                                          | —                                         |
| `Product`   | `products`    | `id, categoryId, name`                                   | `category → Category`                     |
| `Category`  | `categories`  | `id, name` (nullable)                                    | —                                         |

Имена полей в спеке — camelCase (как в PDM), имена колонок в SQL — snake_case (из `column:` в PDM).
Алиасы таблиц в SQL берутся из имени entity в lowerCamel (`OrderItem` → `orderItem`).

---

## Пример 1 — Минимальный: `findMany`

**Цель:** достать все строки таблицы.

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

Замечание: без явного `map`-узла селект строится по всем полям сущности; колонки заaliases в camelCase.

---

## Пример 2 — Простой: фильтр с обязательным параметром

**Цель:** отфильтровать `OrderItem` по `quantity >= :minQty`.

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
SELECT /* все поля OrderItem */
FROM   "order_items" AS "orderItem"
WHERE  ("orderItem"."quantity" >= ?)
```

- `paramOrder: ["minQty"]`

Замечание: выражения записываются как `{ op: [arg1, arg2] }`. Голая строка `'orderItem.quantity'` — это ссылка
на поле (dot-path), поэтому **строковый литерал** нужно оборачивать в `{ $literal: 'text' }` — иначе парсер
попробует резолвить его как путь.

---

## Пример 3 — Средний: `predicate_optional` + `sort` + `limit` с дефолтом

**Цель:** «листинг» с опциональным фильтром цены, сортировкой по цене и пагинацией.
Если клиент не передал `minPrice`, фильтр пропускается; `limit` имеет дефолт 20.

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
SELECT /* все поля OrderItem */
FROM   "order_items" AS "orderItem"
WHERE  ((? IS NULL) OR ("orderItem"."unit_price" >= ?))
ORDER BY "orderItem"."unit_price" DESC NULLS LAST
LIMIT  ?
```

- `paramOrder: ["minPrice", "minPrice", "limit"]`
- `optionalParams: ["minPrice"]`
- `paramDefaults: { limit: 20 }`

Замечания:
- `predicate_optional` раскрывается в шаблон `(? IS NULL) OR (<предикат>)` — поэтому параметр `minPrice`
  **занимает два слота** в `paramOrder`; рантайм биндит его дважды.
- `defaulted` — одно место в `paramOrder` + значение по умолчанию в `paramDefaults`; подставить дефолт должен вызывающий
  код (см. `execute`), компилятор дефолты в SQL не зашивает.

---

## Пример 4 — Сложный: JOIN через точечную навигацию

**Цель:** отфильтровать `OrderItem` по дате связанного `Order`. Дот-путь
`orderItem.order.createdAt` компилятор превращает в `LEFT JOIN` по `OrderItem.order` (cardinality `one`).

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
SELECT /* все поля OrderItem */
FROM   "order_items" AS "orderItem"
LEFT JOIN "orders" AS "order" ON ("orderItem"."order_id" = "order"."id")
WHERE  ("order"."created_at" BETWEEN ? AND ?)
```

- `paramOrder: ["dateFrom", "dateTo"]`

Замечания:
- Имя relation (`order`) становится алиасом таблицы.
- JOIN всегда `LEFT` (tier-1 MVP); `INNER` не выбирается, даже если поле NOT NULL.
- В SELECT остаются только поля «левой» сущности — JOIN тут нужен исключительно для предиката.

### Внутренние представления

`explain()` для этого же графа:

```jsonc
// semanticPlan.steps
[
  { "kind": "scan", "nodeId": "items", "table": "order_items", "alias": "orderItem",
    "entity": "OrderItem", "fields": [ /* все поля OrderItem */ ] },
  { "kind": "filter", "nodeId": "f",
    "predicate": { "between": ["orderItem.order.createdAt", { "$param": "dateFrom" }, { "$param": "dateTo" }] } }
]

// relational IR
{ "op": "Filter",
  "predicate": { "between": [ /* тот же */ ] },
  "child": { "op": "Scan", "table": "order_items", "alias": "orderItem", "entity": "OrderItem", "fields": [...] } }
```

JOIN в relational IR ещё нет — он появляется на стадии `lower` из дот-путей в предикатах.

---

## Пример 5 — Kitchen sink: filter → 2-hop JOIN → reduce → HAVING → sort → limit

**Цель:** агрегат продаж по категории товара за период, с опциональным порогом выручки и пагинацией.
Демонстрирует: `reduce` (GROUP BY), `HAVING` (фильтр **после** reduce), двухуровневый JOIN
(`orderItem.product.categoryId`), все три режима параметров.

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

Замечания:
- Фильтр `dateFiltered` стоит **до** `reduce` → попадает в `WHERE`.
- Фильтр `revFiltered` стоит **после** `reduce` и ссылается на выходное поле `revenue` → попадает в `HAVING`.
- JOIN на `products` нужен не для SELECT (мы проецируем только `category_id`), а для `GROUP BY "product"."category_id"`
  — это второй уровень дот-пути `orderItem.product.categoryId`.
- `count` без аргументов → `COUNT(*)`; `count_distinct` (в примере не использован) → `COUNT(DISTINCT ...)`.

---

## Что пока не поддерживается

См. README, раздел *Not yet supported*: `distinct`, `lookupOne`, `lookup`-expr, именованные predicate-графы,
`exists`, `in`, `$list`, `case` (!) — в README он помечен как Tier 1, но семантический валидатор его не
знает (`src/validate/semantic/types.ts:163`), баг документации.
