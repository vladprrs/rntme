# Примеры биндингов: HTTP-артефакт → OpenAPI 3.1

5 примеров, от минимального до «kitchen sink», показывающих что
`generateOpenApi(validateBindings(parseBindingArtifact(input), resolvers), resolvers)`
выдаёт на выходе. Все примеры воспроизводятся скриптом
[`../demo-openapi.mjs`](../demo-openapi.mjs) (`node demo-openapi.mjs` после `pnpm build`).

## Пайплайн

```
binding artifact ──parse──▶ BindingArtifact ──validateStructural──▶ StructurallyValid
                                                                           │
          ValidatedBindings ◀──validateConsistency── ResolvedBindings ◀──validateReferences──┘
                  │
                  └──generateOpenApi──▶ OpenAPI 3.1 document
```

- `parseBindingArtifact` — Zod-разбор (`src/parse/parse.ts:5`).
- `validateStructural` — замкнут на сам артефакт: уникальность `method+path`,
  уникальность `(in,name)` и `bindTo`, симметрия `{placeholder}` и `in:"path"`,
  запрет `body` на `GET`, обязательность path-параметров (`src/validate/structural.ts:17`).
- `validateReferences` — разрешает `graph` и `output.shape` через `resolvers`;
  сверяет `bindTo` с `signature.inputs` (`src/validate/references.ts:66`).
- `validateConsistency` — запрет `root`-входов, только `rowset` на выходе,
  совместимость `mode ↔ required`, `type ↔ location`, все `required/nullable`-входы
  должны быть связаны (`src/validate/consistency.ts:123`).
- `generateOpenApi` — эмиттер без сайд-эффектов
  (`src/openapi/emit.ts:104`); резолверы в этой фазе не вызываются — всё уже в
  `ResolvedBinding.outputShape`.

## Доменная модель

Все примеры используют ту же схему, что и граф-компилятор
(`commerce.pdm.json` / `commerce.qsm.json`). Резолверы в `demo-openapi.mjs` отдают
упрощённые `GraphSignature` / `ResolvedShape`:

| Shape              | Поля                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------ |
| `OrderItem`        | `id, orderId, productId, unitPrice(decimal), quantity` — все non-null                      |
| `CategorySalesRow` | `categoryId, revenue, totalQuantity, lineCount, avgItemPrice, categoryName?` (nullable)    |

Тип `decimal` по умолчанию эмитится как `{type:'string', format:'decimal'}` — опция
`decimalEncoding:'number'` переключает на `{type:'number'}` (`src/openapi/shapes.ts:8`).
Все поля shape попадают в `required`, даже nullable — ключ всегда присутствует
в ответе, отсутствие выражается значением `null` (`src/openapi/shapes.ts:58`).

Любой биндинг в артефакте оборачивается в операцию под ключом `method`
(`get`/`post`); два разных биндинга с одинаковыми `method + path` отвергаются ещё на
structural-слое (`src/validate/structural.ts:88`).

---

## Пример 1 — Минимальный: `GET /v1/items`, без параметров

**Цель:** достать всю таблицу, ровно одна операция.

```js
{
  version: '1.0',
  graphSpecRef: 'commerce.graphs.v1',
  pdmRef:       'commerce.domain.v1',
  qsmRef:       'commerce.read.v1',
  bindings: {
    listItems: {
      graph: 'listAllItems',
      target: { engine: 'sqlite', dialect: 'sqlite' },
      http: { method: 'GET', path: '/v1/items', parameters: [] },
    },
  },
}
// signature: inputs: {}, output: { type: rowset<OrderItem>, from: 'items' }
```

**OpenAPI (сокращённо):**

```jsonc
{
  "openapi": "3.1.0",
  "info": { "title": "API", "version": "0.0.0" },
  "paths": {
    "/v1/items": {
      "get": {
        "operationId": "listItems",
        "responses": {
          "200": { "description": "OK", "content": { "application/json": {
            "schema": { "type": "array", "items": { "$ref": "#/components/schemas/OrderItem" } } } } },
          "400": { /* $ref ErrorResponse */ },
          "422": { /* $ref ErrorResponse */ },
          "500": { /* $ref ErrorResponse */ }
        }
      }
    }
  },
  "components": { "schemas": {
    "OrderItem":     { "type": "object", "required": ["id","orderId","productId","unitPrice","quantity"], "properties": { /* ... */ } },
    "ErrorResponse": { "type": "object", "required": ["code","message"], "properties": { "code": {"type":"string"}, "message": {"type":"string"}, "details": {} } }
  } }
}
```

Замечания:
- `operationId` по умолчанию — ключ биндинга (`listItems`), переопределяется через `http.operationId`
  (`src/openapi/emit.ts:89`).
- `info.title='API'`, `info.version='0.0.0'` — дефолты эмиттера, срабатывают, когда в артефакте
  нет `openapi.info` и в вызов не передан `options.info` (`src/openapi/emit.ts:32`).
- Ответ всегда `type:'array'` с `$ref` на shape — одноэлементные/скалярные результаты на данном этапе
  не поддерживаются (`src/validate/consistency.ts:41`).
- Стандартные ошибки `400/422/500` включены по умолчанию; отключаются
  `generateOpenApi(v, r, { standardErrors: false })` (`src/openapi/emit.ts:27`, usage at
  `src/openapi/emit.ts:112`).

---

## Пример 2 — Обязательный query-параметр

**Цель:** `GET /v1/items?minQty=…`, фильтр `quantity >= :minQty`.

```js
bindings: {
  itemsByMinQty: {
    graph: 'itemsByMinQty',
    target: { engine: 'sqlite', dialect: 'sqlite' },
    http: {
      method: 'GET', path: '/v1/items',
      parameters: [
        { name: 'minQty', in: 'query', bindTo: 'minQty', required: true },
      ],
    },
  },
}
// signature.inputs: { minQty: { type: scalar<integer>, mode: 'required' } }
```

**Параметры в итоговой операции:**

```jsonc
"parameters": [
  { "name": "minQty", "in": "query", "required": true, "schema": { "type": "integer" } }
]
```

Замечания:
- `parameter.name` — внешнее HTTP-имя, `bindTo` — имя входа графа; в OpenAPI попадает именно `name`
  (`src/openapi/parameters.ts:34`).
- `mode:'required'` допускает только `required:true` — рассинхрон ловит consistency-слой
  с кодом `BINDINGS_REQUIRED_MISMATCH` (`src/validate/consistency.ts:10`).
- Схема параметра — это проекция `input.type`; `mode` в схему не протекает, он влияет лишь на
  флаги `required` и `default` (`src/openapi/parameters.ts:31`).

---

## Пример 3 — `predicate_optional` + `defaulted`

**Цель:** листинг по цене с опциональным фильтром и пагинацией:
`GET /v1/items/listing?minPrice=…&limit=…`.

```js
bindings: {
  priceListing: {
    graph: 'priceListing',
    target: { engine: 'sqlite', dialect: 'sqlite' },
    http: {
      method: 'GET', path: '/v1/items/listing',
      parameters: [
        { name: 'minPrice', in: 'query', bindTo: 'minPrice', required: false },
        { name: 'limit',    in: 'query', bindTo: 'limit',    required: false },
      ],
    },
  },
}
// signature.inputs:
//   minPrice: { type: scalar<decimal>, mode: 'predicate_optional' }
//   limit:    { type: scalar<integer>, mode: 'defaulted', default: 20 }
```

**Параметры:**

```jsonc
"parameters": [
  { "name": "minPrice", "in": "query", "required": false,
    "schema": { "type": "string", "format": "decimal" } },
  { "name": "limit",    "in": "query", "required": false,
    "schema": { "type": "integer", "default": 20 } }
]
```

Замечания:
- `predicate_optional` и `defaulted` обязаны иметь `required:false`
  (таблица `REQUIRED_BY_MODE`, `src/validate/consistency.ts:10`).
- Дефолт из `input.default` проникает в JSON Schema через `schemaWithDefault`
  только для `mode:'defaulted'` (`src/openapi/parameters.ts:19`); для `predicate_optional`
  сам факт «опциональности» уже закодирован в SQL (`(? IS NULL) OR ...`) — на уровне HTTP это
  просто `required:false`.
- `decimal` кодируется строкой (precision-safe). Для клиентов, которых это не устраивает,
  — `generateOpenApi(v, r, { decimalEncoding: 'number' })` (`src/openapi/shapes.ts:13`).

---

## Пример 4 — Path-параметр и массив в теле (POST)

**Цель:** `POST /v1/orders/{orderId}/items/search` с JSON-телом, в котором необязательный
список `productIds` — фильтр внутри конкретного заказа.

```js
bindings: {
  itemsOfOrder: {
    graph: 'itemsOfOrder',
    target: { engine: 'sqlite', dialect: 'sqlite' },
    http: {
      method: 'POST',
      path: '/v1/orders/{orderId}/items/search',
      parameters: [
        { name: 'orderId',    in: 'path', bindTo: 'orderId',    required: true  },
        { name: 'productIds', in: 'body', bindTo: 'productIds', required: false },
      ],
    },
  },
}
// signature.inputs:
//   orderId:    { type: scalar<integer>,     mode: 'required' }
//   productIds: { type: list<integer>,       mode: 'nullable' }
```

**Операция:**

```jsonc
"parameters": [
  { "name": "orderId", "in": "path", "required": true, "schema": { "type": "integer" } }
],
"requestBody": {
  "required": true,
  "content": { "application/json": { "schema": {
    "type": "object",
    "required": [],
    "properties": {
      "productIds": { "type": "array", "items": { "type": "integer" } }
    }
  } } }
}
```

Замечания:
- Каждый `{name}` в пути обязан иметь соответствующий `in:"path"`-параметр, и наоборот.
  Регекс `/\{([^{}]+)\}/g` выдёргивает плейсхолдеры (`src/validate/structural.ts:67`);
  рассинхрон — `BINDINGS_PATH_PLACEHOLDER_MISMATCH`.
- `in:"path"` и `required:false` — всегда ошибка: `BINDINGS_PATH_NOT_REQUIRED`
  (`src/validate/structural.ts:51`).
- `in:"body"` на `GET` отсекается structural-слоем (`BINDINGS_BODY_ON_GET`,
  `src/validate/structural.ts:60`). Список в `path` невозможен: `list` разрешён только в
  `query` и `body` (`src/validate/consistency.ts:51`).
- Тело — всегда `application/json`, `requestBody.required:true` вне зависимости от
  required-флагов отдельных полей (`src/openapi/parameters.ts:68`). `required` в inner-schema
  собирает только те body-параметры, у которых собственный `required:true`.
- Список в query получил бы `style:'form', explode:true` — это даёт `?ids=1&ids=2&ids=3`
  (`src/openapi/parameters.ts:40`). В body этот хак не нужен.
- Тонкий момент: `mode:'nullable'` означает «SQL-NULL допустим», но эмиттер сегодня не
  продвигает nullability в схему *параметра/поля тела*. В схеме `productIds` нет `"null"` в
  типе. Nullable отражается только в shapes ответа (`src/openapi/shapes.ts:30`). Для пользователя это
  означает: чтобы «не задать» список — пропустите поле целиком, не пишите `null`.

---

## Пример 5 — Kitchen sink: агрегат с четырьмя параметрами и переопределением `info`

**Цель:** воспроизведение golden-фикстуры
(`test/golden/category-sales/expected.openapi.json`) — аналог пятого примера из
`graph-ir-compiler`, но теперь как HTTP-операция. Демонстрирует все три режима
параметров, `predicate_optional` + `defaulted` одновременно, кастомный shape ответа
с nullable-полем, и override для `info`/`servers` через `artifact.openapi`.

```js
{
  version: '1.0',
  graphSpecRef: 'commerce.graphs.v1',
  pdmRef:       'commerce.domain.v1',
  qsmRef:       'commerce.read.v1',
  openapi: {
    info:    { title: 'Commerce Analytics API', version: '1.0.0' },
    servers: [{ url: 'https://api.example.com' }],
  },
  bindings: {
    getCategorySalesHttp: {
      graph: 'getCategorySales',
      target: { engine: 'sqlite', dialect: 'sqlite' },
      http: {
        method: 'GET',
        path: '/v1/analytics/category-sales',
        tags: ['analytics'],
        summary: 'Category sales aggregation',
        parameters: [
          { name: 'dateFrom',   in: 'query', bindTo: 'dateFrom',   required: true  },
          { name: 'dateTo',     in: 'query', bindTo: 'dateTo',     required: true  },
          { name: 'minRevenue', in: 'query', bindTo: 'minRevenue', required: false },
          { name: 'limit',      in: 'query', bindTo: 'limit',      required: false },
        ],
      },
    },
  },
}
// signature.inputs:
//   dateFrom/dateTo: scalar<date>    required
//   minRevenue:      scalar<decimal> predicate_optional
//   limit:           scalar<integer> defaulted(20)
// output: rowset<CategorySalesRow>  (includes nullable `categoryName`)
```

**OpenAPI (ключевые фрагменты, `paths` + `components`):**

```jsonc
"paths": {
  "/v1/analytics/category-sales": {
    "get": {
      "operationId": "getCategorySalesHttp",
      "summary":     "Category sales aggregation",
      "tags":        ["analytics"],
      "responses": {
        "200": { "description": "OK", "content": { "application/json": {
          "schema": { "type": "array", "items": { "$ref": "#/components/schemas/CategorySalesRow" } } } } },
        "400": { /* $ref ErrorResponse */ },
        "422": { /* $ref ErrorResponse */ },
        "500": { /* $ref ErrorResponse */ }
      },
      "parameters": [
        { "name": "dateFrom",   "in": "query", "required": true,  "schema": { "type": "string",  "format": "date"    } },
        { "name": "dateTo",     "in": "query", "required": true,  "schema": { "type": "string",  "format": "date"    } },
        { "name": "minRevenue", "in": "query", "required": false, "schema": { "type": "string",  "format": "decimal" } },
        { "name": "limit",      "in": "query", "required": false, "schema": { "type": "integer", "default": 20       } }
      ]
    }
  }
},
"components": { "schemas": {
  "CategorySalesRow": {
    "type": "object",
    "required": ["categoryId","revenue","totalQuantity","lineCount","avgItemPrice","categoryName"],
    "properties": {
      "categoryId":    { "type": "integer" },
      "revenue":       { "type": "string", "format": "decimal" },
      "totalQuantity": { "type": "integer" },
      "lineCount":     { "type": "integer" },
      "avgItemPrice":  { "type": "string", "format": "decimal" },
      "categoryName":  { "type": ["string","null"] }
    }
  },
  "ErrorResponse": { /* ... */ }
} },
"servers": [{ "url": "https://api.example.com" }]
```

Замечания:
- `artifact.openapi.info` и `artifact.openapi.servers` имеют приоритет над `options.info`/`options.servers`
  при вызове `generateOpenApi` — значение из артефакта выигрывает, опции подхватываются только
  там, где в артефакте `undefined` (`src/openapi/emit.ts:34`). Для `servers` это `??`-выбор
  целиком: если массив в артефакте задан (даже пустой), опция `options.servers` игнорируется
  (`src/openapi/emit.ts:49`).
- `summary`, `tags`, `description` — чисто косметические, пробрасываются в операцию 1-в-1
  (`src/openapi/emit.ts:92`).
- Nullable-поле `categoryName` в shape отдаётся как `type: ["string","null"]` (OpenAPI 3.1 union)
  и тем не менее остаётся в `required` — контракт «ключ всегда есть, значение может быть `null`»
  (`src/openapi/shapes.ts:33`).
- `http.openapi` (per-operation) и `parameter.openapi` (per-parameter) — это точки расширения
  для `x-*` / готовых passthrough-полей. Мёржатся через deep-merge: объекты — рекурсивно,
  массивы/скаляры — заменяются (`src/openapi/passthrough.ts:5`). Для читаемости примера здесь
  они не использованы; включив `http.openapi = { 'x-rate-limit': 100, description: '...' }`,
  получите эти поля в операции без дополнительной логики.
- Если вы добавите второй биндинг с тем же `method + path` — structural-слой отклонит артефакт
  с `BINDINGS_DUPLICATE_METHOD_PATH` (`src/validate/structural.ts:95`). Ключ строится как
  `"${method} ${path}"`, поэтому `GET /x` и `POST /x` — это разные ключи и прекрасно сосуществуют
  (мёржатся в один `PathItem` при эмите).

### Внутренние представления

`validateBindings` возвращает `ValidatedBindings` — это `ResolvedBindings` с brand-тегом.
В нём по каждому биндингу лежит:

```ts
// src/types/artifact.ts:57
type ResolvedBinding = {
  entry: BindingEntry;            // исходный http + target + graph id
  signature: GraphSignature;      // что отдал resolveGraphSignature
  outputShape: ResolvedShape;     // что отдал resolveShape (или плейсхолдер, если scalar)
};
```

Эмиттер ходит только в эту уже-резолвнутую структуру; никаких повторных лукапов, никакого
парсинга графа — потому `generateOpenApi` чистый и дешёвый, а всю «онтологическую» работу
делает слой references.

---

## Что пока не поддерживается

См. дизайн-док `docs/superpowers/specs/2026-04-14-bindings-design.md`, §2 (Non-goals):

- **Runtime HTTP-адаптер** — маршрутизатор + исполнение графа по HTTP-запросу: отдельный
  будущий пакет `@rntme/bindings-http`.
- **Выходы, отличные от `rowset`** — `row` и скаляры отклоняются consistency-слоем
  (`BINDINGS_UNSUPPORTED_OUTPUT_TYPE`, `src/validate/consistency.ts:39`), даже если resolver
  их выдаёт.
- **`PUT` / `PATCH` / `DELETE`** — Zod-схема принимает только `GET` и `POST`
  (`src/parse/schema.ts:28`). Граф-IR сейчас read-only, write-слой появится отдельно.
- **Headers, cookies, security schemes, pagination, rate-limit** — не кодифицированы в
  артефакте; ручная прокачка через `http.openapi` passthrough работает, но компилятор о них
  ничего не знает и не валидирует.
- **Scalar-nullability в параметрах и body** — `mode:'nullable'` не превращается в `type: [T, null]`
  в схеме параметра/body-поля (см. пример 4). Отражается только в shape ответа.
- **Генератор из GraphSpec** — автоматически выводить разумный дефолт-артефакт по графу
  умеет будущий `@rntme/graph-ir-compiler/from-graph-spec`; сейчас артефакт пишется руками.
- **Сериализация** — ни YAML, ни запись в файл в SDK нет; результат возвращается как JS-объект,
  `JSON.stringify` — на стороне вызывающего.
