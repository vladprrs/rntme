# LLM Authoring Guide — формат артефактов для `graph-ir-compiler`

Этот документ — справка для LLM, который будет **генерировать** входные артефакты
(`spec`, `pdm`, `qsm`) для `compile(spec, pdm, qsm)` из `@rntme/graph-ir-compiler`.

Цель: описать формат **ровно настолько**, чтобы LLM мог писать валидные спеки
с первой попытки, не гадая. Все правила ниже — нормативные и подтверждены кодом.

## 0. Контракт на вход

```
compile(spec, pdm, qsm) → Result<{ sql, paramOrder, shape, optionalParams, paramDefaults }>
```

Три независимых артефакта, каждый со своим Zod-схемой:

| Артефакт | Кто его пишет                           | Меняется ли per-query | Описывает                                     |
| -------- | --------------------------------------- | --------------------- | --------------------------------------------- |
| `pdm`    | описание домена                         | нет (стабильный)      | физические таблицы, поля, связи               |
| `qsm`    | query-side marks                        | нет (стабильный)      | проекции, роли связей (в Tier 1 почти пустой) |
| `spec`   | authoring-спека конкретного графа (запроса) | да                    | форма запроса (узлы + сигнатура)              |

**Важно**: LLM обычно генерирует только **`spec`**, используя заранее
зафиксированные `pdm`/`qsm`. Но структуру pdm/qsm надо понимать, чтобы
правильно ссылаться на сущности, поля и связи.

## 1. Примитивные типы

Единый набор типов во всех трёх артефактах:

```ts
type Primitive = 'integer' | 'long' | 'decimal' | 'string' | 'boolean' | 'date' | 'datetime'
```

Правила совместимости (widening) — реализованы в `validate/semantic/types.ts`:
- `integer ⊂ long ⊂ decimal` (арифметика и сравнения расширяются вверх).
- `date ⊂ datetime`.
- Числа сравнимы только с числами; `date`/`datetime` — только между собой; строки/булы — только с самими собой.
- `COMPARABLE = {integer, long, decimal, string, date, datetime, boolean}` — только эти годятся в `eq/neq/gt/gte/lt/lte`.

## 2. PDM — Physical Data Model

Описывает **физические таблицы**. LLM читает PDM, чтобы знать имена entity, полей, связей.

```jsonc
{
  "entities": {
    "<EntityName>": {                          // логическое имя (PascalCase, используется в спеке)
      "table": "<sql_table_name>",             // физическая таблица (snake_case типично)
      "fields": {
        "<fieldName>": {                       // логическое имя поля (camelCase)
          "type": "<Primitive>",
          "nullable": <boolean>,
          "column": "<sql_column_name>"
        }
        // ...
      },
      "relations": {
        "<relName>": {                         // алиас связи (camelCase); станет алиасом таблицы в SQL
          "to": "<EntityName>",                // куда указывает
          "cardinality": "one" | "many",       // в Tier 1 используется только "one"
          "localKey": "<fieldName>",           // поле этой сущности (логическое имя)
          "foreignKey": "<fieldName>"          // поле той сущности (логическое имя)
        }
      },
      "keys": ["<fieldName>", ...]             // первичный ключ (логические имена)
    }
  }
}
```

Правила:
- Ключи `fields` и `relations` — **логические имена** (camelCase), на них ссылаются дот-пути.
- Значения `fields[...].column` — **физические имена колонок** (SQL-идентификаторы).
- В Tier 1 доступна только навигация по `cardinality: "one"`-связям. `many` — не поддерживается в выражениях.

## 3. QSM — Query Semantic Model

В Tier 1 используется минимально. Обе секции имеют дефолт `{}`.

```jsonc
{
  "projections": {                             // виртуальные «таблицы» для QSM-источников
    "<ProjectionName>": {
      "grain":  ["<keyField>", ...],
      "keys":   ["<keyField>", ...],
      "exposed": ["<fieldName>", ...],         // публичные поля проекции
      "source": { "entity": "<EntityName>", "pathPrefix": "<dot.path>" }
    }
  },
  "relationRoles": {                           // "EntityName.relationName": "fact" | "dimension" | ...
    "OrderItem.product": "dimension"
  }
}
```

Для большинства Tier 1-сценариев достаточно:
```json
{ "projections": {}, "relationRoles": {} }
```

## 4. Authoring spec — что генерирует LLM

```jsonc
{
  "version": "1.0-rc7",                        // ОБЯЗАТЕЛЬНО ровно эта строка
  "pdmRef": "<any string ref>",                // опознавательный идентификатор PDM
  "qsmRef": "<any string ref>",                // опознавательный идентификатор QSM
  "shapes": {                                  // именованные shape'ы для map/reduce.into
    "<ShapeName>": {
      "fields": {
        "<fieldName>": { "type": "<Primitive>", "nullable": <boolean> }
      }
    }
  },
  "graphs": {                                  // Tier 1 MVP: РОВНО ОДИН граф на вызов compile()
    "<graphId>": {
      "id": "<graphId>",                       // должно совпадать с ключом
      "signature": {
        "inputs":  { "<paramName>": <InputDecl>, ... },
        "output":  { "type": "rowset<T>" | "row<T>", "from": "<nodeId>" }
      },
      "nodes": [ <Node>, ... ]                 // массив; порядок = порядок исполнения
    }
  }
}
```

### 4.1. Input declarations

```ts
type InputDecl = {
  type: Primitive | { list: Primitive } | { row: ShapeName } | { rowset: ShapeName }
  mode: 'root' | 'required' | 'nullable' | 'defaulted' | 'predicate_optional'
  default?: unknown   // используется только при mode === 'defaulted'
}
```

Семантика режимов:

| mode                 | значение            | место в `paramOrder`   | место в SQL                                          |
| -------------------- | ------------------- | ---------------------- | ---------------------------------------------------- |
| `root`               | входной rowset/row  | —                      | (Tier 2, пока не используется)                       |
| `required`           | обязан быть передан | один `?`               | `WHERE ... = ?`                                      |
| `nullable`           | может быть `null`   | один `?`               | подставляется как есть (NULL пройдёт в предикат)     |
| `defaulted`          | есть `default`      | один `?` + `paramDefaults[name] = default` | `?` заполняется рантаймом (не зашивается в SQL) |
| `predicate_optional` | опциональный фильтр | **два** `?` подряд     | `(? IS NULL) OR (<predicate>)`                       |

Ограничения:
- Не более одного input с `mode: "root"` на граф.
- `root`-input обязан иметь `type: row<T>` или `rowset<T>`.
- `predicate_optional` можно использовать **только внутри `filter.config.expr`**. Использование в `map.fields`, `reduce.measures`, `limit.count` → `SEM_PARAM_CONTEXT`.

## 5. Узлы (nodes) — полный справочник

Tier 1 поддерживает ровно 6 типов. Порядок узлов в массиве = порядок исполнения.
Поле `id` должно быть уникально в пределах графа. Граф — DAG без циклов.
Один из узлов упоминается в `signature.output.from` — он становится «выходом».

### 5.1. `findMany` — источник строк

```jsonc
{
  "id": "<nodeId>",
  "type": "findMany",
  "config": {
    "source": { "entity": "<EntityName>" } | { "projection": "<ProjectionName>" }
  }
}
```

- Должен быть как минимум один `findMany` в графе (корневой источник).
- Алиас таблицы в SQL = `camelCase(EntityName)` (например `OrderItem → orderItem`).
- После `findMany` в scope попадает alias = camelCase entity, с полями этой entity.

### 5.2. `filter` — WHERE или HAVING

```jsonc
{
  "id": "<nodeId>",
  "type": "filter",
  "config": {
    "input": "<nodeId>",      // ссылка на предыдущий узел
    "expr":  <Expr>           // булево выражение (ОБЯЗАТЕЛЬНО в Tier 1)
    // "predicate": "..."     // именованный predicate-граф НЕ поддержан в Tier 1
  }
}
```

- Тип `expr` должен резолвиться в `boolean`.
- Если `filter` стоит **до** `reduce` — компилируется в `WHERE`.
- Если **после** `reduce` — в `HAVING` (и его `expr` может ссылаться на поля результирующего shape).

### 5.3. `map` — проекция

```jsonc
{
  "id": "<nodeId>",
  "type": "map",
  "config": {
    "input": "<nodeId>",
    "into":  "<ShapeName>",   // имя shape из spec.shapes ИЛИ имя Entity ИЛИ Projection
    "fields": {
      "<shapeFieldName>": <FieldExpr>,
      // ...
    }
  }
}
```

Правила:
- Набор ключей `fields` должен **точно совпадать** с набором полей `into`-shape
  (иначе `STRUCT_MAP_SHAPE_COVERAGE`). Ни добавить лишнего, ни пропустить.
- `<FieldExpr>` — это `Expr` ИЛИ `{ lookup: {...} }` (но `lookup` в Tier 1 запрещён).
- Тип выражения должен widен-совместим с типом целевого поля.

### 5.4. `reduce` — GROUP BY + агрегаты

```jsonc
{
  "id": "<nodeId>",
  "type": "reduce",
  "config": {
    "input": "<nodeId>",
    "into":  "<ShapeName>",
    "group": {                              // ключи группировки
      "<shapeFieldName>": "<dot.path>"      // только строка-дот-путь, НЕ Expr
    },
    "measures": {
      "<shapeFieldName>": {
        "fn": "count" | "count_distinct" | "sum" | "avg" | "min" | "max" | "group_array",
        "expr": <Expr>                      // обязателен ВСЕГДА, кроме "count"
      }
    }
  }
}
```

Правила:
- Объединённый набор ключей `group ∪ measures` должен покрывать все поля `into` (иначе `STRUCT_REDUCE_SHAPE_COVERAGE`).
- Типы возврата агрегатов:
  - `count`, `count_distinct` → `integer`
  - `sum(integer)` → `integer`, `sum(long|decimal)` → `long`/`decimal`
  - `avg(numeric)` → `decimal`
  - `min`/`max` → тип аргумента
  - `group_array` → `string`
- `count` без аргумента → `COUNT(*)`.

### 5.5. `sort` — ORDER BY

```jsonc
{
  "id": "<nodeId>",
  "type": "sort",
  "config": {
    "input": "<nodeId>",
    "by": [                                 // минимум один ключ
      {
        "field": "<dot.path>" | "<shapeFieldName>",  // для sort после reduce — поле shape'а
        "dir":   "asc" | "desc",            // default: "asc"
        "nulls": "first" | "last"           // default: "last"
      }
    ]
  }
}
```

### 5.6. `limit` — LIMIT

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

- Литерал → `LIMIT 3` (константа в SQL).
- `$param` → `LIMIT ?` (слот в paramOrder). Параметр не может быть `predicate_optional`.

## 6. EXPR — грамматика выражений

**Главная тонкость**: голая строка — это **дот-путь к полю**, НЕ строковый литерал.
Чтобы получить строковый литерал, используй `{ "$literal": "text" }`.

```ts
type Expr =
  | string                                      // dot-path: "orderItem.order.createdAt" или "revenue" (поле shape)
  | number                                      // integer если целое, иначе decimal
  | boolean
  | null
  | { $literal: string }                        // СТРОКОВЫЙ литерал (ТОЛЬКО строка — для чисел используй number)
  | { $param: string }                          // ссылка на signature.inputs.<name>
  | { [op: string]: Expr[] }                    // оператор-узел (см. таблицу ниже)
  | { between: [Expr, Expr, Expr] }             // специальная форма
  // РАЗРЕШЕНО СХЕМОЙ, НО НЕ ПОДДЕРЖАНО В TIER 1:
  // | { case: { when: [[Expr, Expr], ...], else: Expr } }   ← парсится, но валится в semantic: "unsupported operator case"
  // | { exists: { relation: string, where?: Expr } }        ← запрещено на структурной фазе
  // | { $list: Expr[] }                                     ← запрещено на структурной фазе
  // | { in: ... }                                           ← запрещено на структурной фазе
```

### 6.1. Поддерживаемые операторы (Tier 1)

| Оператор                         | Арность | Типы аргументов                             | Тип результата                   |
| -------------------------------- | ------- | ------------------------------------------- | -------------------------------- |
| `eq`, `neq`, `gt`, `gte`, `lt`, `lte` | 2  | одинаковые (после widen), оба `COMPARABLE`  | `boolean`                        |
| `add`, `sub`, `mul`, `div`       | 2       | `numeric × numeric`                         | `widen` (integer / long / decimal) |
| `and`, `or`                      | variadic | все `boolean`                              | `boolean`                        |
| `not`                            | variadic (обычно 1) | `boolean`                         | `boolean`                        |
| `is_null`                        | 1       | любой                                       | `boolean` (non-null)             |
| `like`                           | 2       | `string × string`                           | `boolean`                        |
| `concat`                         | variadic | все `string`                               | `string` (non-null)              |
| `coalesce`                       | variadic | типы должны widen'иться                    | widen; nullable если ВСЕ nullable |
| `between`                        | 3       | все должны widen'иться                      | `boolean`                        |

Синтаксис унифицирован: `{ "<op>": [arg1, arg2, ...] }`. Исключения: `between`
использует **кортеж-тройку**, `case`/`exists` имеют собственные объектные формы
(но недоступны в Tier 1).

### 6.2. Примеры

```jsonc
// Сравнение с параметром
{ "gte": ["orderItem.unitPrice", { "$param": "minPrice" }] }

// AND + LIKE + NOT IS_NULL
{ "and": [
    { "like": ["product.name", { "$param": "q" }] },
    { "not": [{ "is_null": ["product.categoryId"] }] }
] }

// BETWEEN (обрати внимание: массив из ТРЁХ элементов — это особая форма)
{ "between": ["orderItem.order.createdAt", { "$param": "from" }, { "$param": "to" }] }

// Арифметика в measures
{ "mul": ["orderItem.unitPrice", "orderItem.quantity"] }

// Строковая конкатенация с литералами (обязательно $literal!)
{ "concat": [ { "$literal": "cat#" }, { "coalesce": ["category.name", { "$literal": "n/a" }] } ] }
```

## 7. Дот-пути (dot-paths)

Строка в EXPR или в `sort.by[].field` или в `reduce.group[*]` — это дот-путь.

Резолвер (`validate/semantic/fields.ts`):
1. `head.field` — головой идёт **алиас** (= camelCase имени entity активного `findMany`),
   затем имя поля.
2. `head.rel1.rel2.field` — между head и field может быть любая цепочка `one`-связей.
   Каждый шаг делает поле результата nullable (даже если исходное NOT NULL).
3. После `reduce` в scope появляются поля **выходного shape** — к ним обращаются
   по **одному имени**: `"revenue"`, а не `"agg.revenue"`.

Типичные ошибки:
- `"unitPrice"` вместо `"orderItem.unitPrice"` → `SEM_FIELD_NOT_FOUND: alias "unitPrice" not in scope` (до reduce нет shape-полей, только entity aliases).
- `"agg.revenue"` после reduce → то же самое.

## 8. Shapes

Shape нужен только как target для `map.config.into` или `reduce.config.into`.
Если `into` — имя Entity из PDM или Projection из QSM, отдельный shape **не нужен**.

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

- В поле `signature.output.type` пишется `rowset<ShapeName>` или `row<ShapeName>`.
- В `map`/`reduce` можно целиться в entity (`into: "OrderItem"`) или projection,
  тогда набор ожидаемых полей берётся оттуда.

## 9. Структурные и семантические правила

Порядок валидаторов: `parse → structural → canonical → semantic → semantic-plan → relational → lowering`.

Ключевые инварианты:
- Все `id` узлов уникальны внутри графа.
- Нет циклов в графе (он DAG по связям `input → nodeId`).
- `signature.output.from` указывает на существующий `nodeId`.
- Ровно один `findMany` как корень chain'а (несколько источников = несколько deps, Tier 1 оптимизирован под линейный pipeline).
- Для `map`/`reduce`: набор ключей выхода совпадает с полями `into` (coverage).
- Tier 1 НЕ поддерживает узлы: `distinct`, `lookupOne`.
- Tier 1 НЕ поддерживает выражения: `exists`, `$list`, `in`, `lookup` в `map.fields`.
- `case` принимается парсером, но **валится на семантике** — не генерируй `case`.
- В одном `compile()`-вызове должно быть **ровно 1** имя графа в `graphs`.

## 10. Минимальный рабочий скелет

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

## 11. Коды ошибок (для отладки LLM-генерации)

| Layer          | Code                           | Что чинить                                                                  |
| -------------- | ------------------------------ | --------------------------------------------------------------------------- |
| `parse`        | `PARSE_SCHEMA_VIOLATION`       | JSON не соответствует Zod-схеме (лишние/недостающие поля, неверный тип)     |
| `structural`   | `STRUCT_DUPLICATE_NODE_ID`     | повторяющиеся `id` в `nodes`                                                |
| `structural`   | `STRUCT_INVALID_INPUT_REF`     | `input: "X"` ссылается на несуществующий узел                                |
| `structural`   | `STRUCT_DAG_CYCLE`             | цикл в графе                                                                 |
| `structural`   | `STRUCT_INVALID_OUTPUT_FROM`   | `signature.output.from` не совпадает ни с одним `nodeId`                     |
| `structural`   | `STRUCT_MULTIPLE_ROOT_INPUTS`  | больше одного input с `mode: "root"`                                        |
| `structural`   | `STRUCT_ROOT_INPUT_TYPE`       | `root`-input имеет не `row<T>`/`rowset<T>`                                  |
| `structural`   | `STRUCT_UNKNOWN_SHAPE`         | `into` ссылается на несуществующий shape / entity / projection              |
| `structural`   | `STRUCT_MAP_SHAPE_COVERAGE`    | `map.fields` не покрывает поля `into` (missing/extra)                       |
| `structural`   | `STRUCT_REDUCE_SHAPE_COVERAGE` | `group ∪ measures` не покрывает поля `into`                                 |
| `structural`   | `TIER1_UNSUPPORTED_NODE`       | `distinct`, `lookupOne`, или `filter.predicate`                             |
| `structural`   | `TIER1_UNSUPPORTED_EXPR`       | `exists`, `$list`, `in`, или `lookup` в `map.fields`                        |
| `semantic`     | `SEM_FIELD_NOT_FOUND`          | дот-путь не резолвится (alias/field/relation отсутствует)                   |
| `semantic`     | `SEM_TYPE_MISMATCH`            | несовместимые типы в выражении, либо `unsupported operator "<op>"`          |
| `semantic`     | `SEM_SHAPE_MISMATCH`           | тип выходного поля map/reduce не совпадает с ожидаемым в shape              |
| `semantic`     | `SEM_PARAM_UNKNOWN`            | `$param` ссылается на неописанный input                                     |
| `semantic`     | `SEM_PARAM_CONTEXT`            | `predicate_optional` использован вне `filter.expr`                          |

## 12. Чек-лист перед выдачей спеки

1. `version` — ровно `"1.0-rc7"`.
2. Ровно один ключ в `graphs`, и `id` графа совпадает с ключом.
3. Каждый `nodes[i].config.input` указывает на предыдущий `nodes[j].id`.
4. `signature.output.from` указывает на реальный узел.
5. `signature.output.type` — строка `rowset<X>` или `row<X>` без пробелов.
6. Строковые литералы — **всегда** `{ "$literal": "..." }`, иначе парсер примет строку за дот-путь.
7. В выражениях первое имя сегмента дот-пути — **alias entity в camelCase** (`orderItem`, `product`), не `OrderItem`.
8. Числа в EXPR — пишем числами, не строками: `3`, не `"3"`.
9. Для `map.into` / `reduce.into` — сверить набор ключей с полями цели (ни больше, ни меньше).
10. `predicate_optional` — только в `filter.config.expr`.
11. НЕ генерировать: `case`, `exists`, `$list`, `in`, `distinct`, `lookupOne`, `lookup`, `filter.predicate`.
12. JOIN не пишется явно — достаточно написать `orderItem.order.createdAt` в выражении, JOIN синтезируется автоматически (LEFT JOIN по `one`-связи).

## 13. Живые примеры

Прогоняемые примеры (+ их SQL) — в [`examples.md`](./examples.md).
Полный набор тестовых спек — `packages/artifacts/graph-ir-compiler/test/e2e/*.test.ts`.
Эталонная «kitchen sink»-спека — `packages/artifacts/graph-ir-compiler/test/golden/category-sales/graph.json`.
