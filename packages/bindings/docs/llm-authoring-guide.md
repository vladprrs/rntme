# LLM Authoring Guide — формат артефактов для `@rntme/bindings`

Этот документ — справка для LLM, который будет **генерировать** HTTP-биндинги для
Graph IR: `parseBindingArtifact → validateBindings → generateOpenApi`
из `@rntme/bindings`.

Цель: описать формат **ровно настолько**, чтобы LLM мог писать валидные
артефакты с первой попытки, не гадая. Все правила ниже — нормативные и
подтверждены кодом (ссылки на файлы даны рядом).

## 0. Контракт на вход

```
parseBindingArtifact(input)      → Result<BindingArtifact>
validateBindings(artifact, res)  → Result<ValidatedBindings>
generateOpenApi(valid, res, opt) → Result<OpenApiDoc>
```

Ровно один артефакт, один резолвер, один опциональный объект настроек.

| Артефакт               | Кто его пишет                          | Описывает                                           |
| ---------------------- | -------------------------------------- | --------------------------------------------------- |
| **binding artifact**   | **LLM**                                | HTTP-роуты и маппинг на inputs графа                |
| `BindingResolvers`     | хост-среда (код)                       | возврат `GraphSignature` и `ResolvedShape` по имени |
| `OpenApiGenOptions`    | хост-среда (опционально)               | `decimalEncoding`, `info/servers`, `standardErrors` |

**Важно**: LLM генерирует **только binding artifact**. Резолверы — зона
ответственности runtime; LLM *читает* сигнатуру графа (чтобы знать имена и
режимы inputs, имя output-shape), но сам её не сочиняет.

## 1. Примитивные типы (общие с Graph IR)

Всюду — один и тот же enum:

```ts
type ScalarPrimitive = 'integer' | 'decimal' | 'string' | 'boolean' | 'date' | 'datetime'
```

Как они маппятся в OpenAPI (`src/openapi/shapes.ts:8`):

| primitive  | JSON Schema (default)                           | при `decimalEncoding:'number'` |
| ---------- | ----------------------------------------------- | ------------------------------ |
| `integer`  | `{type:'integer'}`                              | —                              |
| `decimal`  | `{type:'string', format:'decimal'}`             | `{type:'number'}`              |
| `string`   | `{type:'string'}`                               | —                              |
| `boolean`  | `{type:'boolean'}`                              | —                              |
| `date`     | `{type:'string', format:'date'}`                | —                              |
| `datetime` | `{type:'string', format:'date-time'}`           | —                              |

Nullable поле в shape → `{type: [T, 'null']}` (OpenAPI 3.1 union, `src/openapi/shapes.ts:30`).

## 2. Сигнатура графа — что LLM может видеть

Резолвер возвращает вот такой объект (определение: `src/types/resolvers.ts:36`):

```ts
type GraphSignature = {
  id: string
  inputs: Record<string, GraphInput>
  output: { type: OutputType, from: string }
}

type GraphInput = {
  type: InputType
  mode: 'required' | 'nullable' | 'defaulted' | 'predicate_optional' | 'root'
  default?: unknown
}

type InputType =
  | { kind: 'scalar',  primitive: ScalarPrimitive }
  | { kind: 'list',    element:   ScalarPrimitive }
  | { kind: 'row',     shape: string }   // Tier 2
  | { kind: 'rowset',  shape: string }   // Tier 2

type OutputType =
  | { kind: 'rowset',  shape: string }   // ТОЛЬКО rowset биндится
  | { kind: 'row',     shape: string }   // отклоняется consistency-слоем
  | { kind: 'scalar',  primitive: ScalarPrimitive }  // отклоняется
```

LLM **читает** `signature.inputs` чтобы знать: какие имена, какие `mode`, какие
`type`. Это определяет набор допустимых `parameter.bindTo`, `parameter.required`
и `parameter.in`.

## 3. Binding artifact — что генерирует LLM

```jsonc
{
  "version": "1.0",                           // ОБЯЗАТЕЛЬНО ровно эта строка
  "graphSpecRef": "<any string ref>",         // идентификатор GraphSpec
  "pdmRef":       "<any string ref>",         // идентификатор PDM
  "qsmRef":       "<any string ref>",         // идентификатор QSM
  "openapi": {                                // опционально: дефолты для генератора
    "info":    { "title": "...", "version": "1.0.0", "description": "..." },
    "servers": [{ "url": "https://api.example.com", "description": "..." }]
  },
  "bindings": {                               // ≥ 1 ключ (пустой Record валиден, но бесполезен)
    "<bindingId>": {
      "graph":  "<graphId>",                  // должен резолвиться в GraphSignature
      "target": { "engine": "sqlite", "dialect": "sqlite" },   // непрозрачный ярлык движка
      "http":   <HttpBinding>
    }
  }
}
```

Zod-схема (`src/parse/schema.ts:71`) использует `.strict()` всюду — **лишние
поля на любом уровне = ошибка parse**.

### 3.1. `version`

Ровно литерал `"1.0"`. Никаких `"1"`, `"1.0.0"`, `"v1.0"`.

### 3.2. `graphSpecRef` / `pdmRef` / `qsmRef`

Непустые строки. Компилятор их только хранит — не парсит и не разрешает. Это
идентификаторы для вышестоящей трекинг-логики.

### 3.3. `openapi` (top-level)

Все поля опциональны:

```jsonc
"openapi": {
  "info":    { "title"?: string, "version"?: string, "description"?: string },
  "servers": [ { "url": "<non-empty>", "description"?: string }, ... ]
}
```

**Приоритет**: `artifact.openapi.info` > `options.info` > дефолты эмиттера
(`{title:'API', version:'0.0.0'}`) — правило `??` (`src/openapi/emit.ts:34`).
То же для `servers` — любой *определённый* массив в артефакте (даже пустой)
полностью перекрывает `options.servers` (`src/openapi/emit.ts:49`).

### 3.4. `bindings`

Object (Record). Ключ — ID биндинга (используется как `operationId` по
умолчанию). Дубли ID невозможны — это обычный JSON-объект.

## 4. `HttpBinding` — HTTP-роут

```jsonc
{
  "method":      "GET" | "POST",                   // ДРУГИЕ МЕТОДЫ НЕ ПОДДЕРЖАНЫ
  "path":        "/v1/...",                        // обязательно начинается с "/", без "?" и "#"
  "parameters":  [ <HttpParameter>, ... ],         // массив, может быть пустым
  "summary"?:    string,
  "description"?: string,
  "tags"?:       string[] (каждая непустая),
  "operationId"?: string (непустая),               // default: ключ биндинга
  "openapi"?:    Record<string, unknown>           // passthrough, см. §6
}
```

Правила:

- `method` — **только** `GET` или `POST`. `PUT`/`PATCH`/`DELETE` отклоняет
  Zod-схема (`src/parse/schema.ts:24`).
- `path` — регекс `/^\/[^?#]*$/`: начинается с `/`, не содержит `?` и `#`.
  Query-string — это зона `parameters[].in:"query"`, в путь её писать нельзя.
- Плейсхолдеры в пути — `{name}` (фигурные скобки), без типов. Любой `{name}`
  **обязан** иметь соответствующий параметр с `in:"path"`, и наоборот — лишние
  path-параметры тоже запрещены (`BINDINGS_PATH_PLACEHOLDER_MISMATCH`,
  `src/validate/structural.ts:72`).
- Пара `method + path` уникальна в пределах артефакта
  (`BINDINGS_DUPLICATE_METHOD_PATH`, `src/validate/structural.ts:95`).
  Разные методы на одном пути — можно (`GET /x` и `POST /x` — OK).

## 5. `HttpParameter` — один параметр

```jsonc
{
  "name":        "<external-name>",                // непустая, внешнее HTTP-имя
  "in":          "query" | "path" | "body",        // расположение
  "bindTo":      "<inputName>",                    // имя input'а в signature
  "required":    true | false,                     // обязательно
  "description"?: string,
  "openapi"?:    Record<string, unknown>           // passthrough для ParameterObject
}
```

### 5.1. Матрица `mode × required` (consistency-слой)

Таблица `REQUIRED_BY_MODE` (`src/validate/consistency.ts:10`) — нормативна:

| `GraphInput.mode`    | допустимое `parameter.required` | примечание                                           |
| -------------------- | ------------------------------- | ---------------------------------------------------- |
| `required`           | **только** `true`               | обязателен                                           |
| `defaulted`          | **только** `false`              | дефолт из graph попадает в JSON Schema как `default` |
| `predicate_optional` | **только** `false`              | «фильтр по опциональному полю»                       |
| `nullable`           | `true` **или** `false`          | LLM выбирает по смыслу эндпоинта                     |
| `root`               | — (граф вообще нельзя биндить)  | `BINDINGS_GRAPH_HAS_ROOT_INPUT`                      |

Рассинхрон → `BINDINGS_REQUIRED_MISMATCH` (`src/validate/consistency.ts:79`).

### 5.2. Матрица `type.kind × in` (consistency-слой)

Таблица `checkTypeLocation` (`src/validate/consistency.ts:51`):

| `input.type.kind` | `query` | `path` | `body` | примечание                          |
| ----------------- | :-----: | :----: | :----: | ----------------------------------- |
| `scalar`          |   ✓    |   ✓   |   ✓   | везде годится                        |
| `list`            |   ✓    |   ✗   |   ✓   | в query → `style:'form', explode:true` (`src/openapi/parameters.ts:40`) |
| `row` / `rowset`  |   ✗    |   ✗   |   ✗   | недоступно в Tier 1 (`BINDINGS_GRAPH_HAS_ROOT_INPUT` сработает раньше) |

Нарушение → `BINDINGS_TYPE_LOCATION_INVALID`.

### 5.3. Жёсткие структурные ограничения (structural-слой)

- `in:"path"` → `required: true` всегда (`BINDINGS_PATH_NOT_REQUIRED`,
  `src/validate/structural.ts:51`).
- `method:"GET"` + любой `in:"body"` → `BINDINGS_BODY_ON_GET`
  (`src/validate/structural.ts:60`). Для тела нужен `POST`.
- Уникальность пары `(in, name)` внутри биндинга → `BINDINGS_DUPLICATE_PARAM_NAME`.
  Разные `in` с одним `name` — разрешены (`?id=…` и `{id}` одновременно — нет,
  потому что `id` в пути будет `in:"path"`, но можно иметь `?id=…` и
  `body.id` одновременно).
- Уникальность `bindTo` внутри биндинга → `BINDINGS_DUPLICATE_BIND_TO`. Один и
  тот же input нельзя «брать» из двух мест HTTP-запроса.

### 5.4. Unbound inputs (consistency-слой)

Каждый input с `mode: 'required'` или `mode: 'nullable'` **обязан** иметь
биндящий параметр (`BINDINGS_UNBOUND_INPUT`, `src/validate/consistency.ts:113`).
Inputs с `defaulted` / `predicate_optional` — **можно опустить** (у них есть
что подставить).

### 5.5. Nullable-тонкость

`mode: 'nullable'` **НЕ** превращает схему параметра/body-поля в
`type: [T, 'null']`. Это делает только schema *выходного shape*
(`src/openapi/shapes.ts:30`). Для клиента это значит: чтобы «не задать»
nullable-параметр — пропустите поле целиком (особенно для `in:"body"` внутри
объекта), а не пишите `null`.

## 6. Passthrough (`http.openapi` и `parameter.openapi`)

Оба поля — свободная map (Zod-тип `record(unknown)`), мёржатся в итоговый
OpenAPI через deep-merge (`src/openapi/passthrough.ts:5`):

- объекты — рекурсивно;
- массивы и скаляры — заменяются полностью;
- значения из `openapi` выигрывают у сгенерированных (passthrough applied **после** build).

Типичные применения:

```jsonc
"http": {
  ...
  "openapi": {
    "x-rate-limit": 100,
    "deprecated": true,
    "externalDocs": { "url": "https://docs/..." }
  },
  "parameters": [
    { "name": "q", "in": "query", "bindTo": "q", "required": false,
      "openapi": { "example": "laptop", "x-internal-id": "q1" } }
  ]
}
```

**Не** переопределяйте через passthrough то, что компилятор вычисляет сам
(`operationId`, `responses`, `schema`) — deep-merge это технически позволит, но
вы рассинхронизируете документ с реальным контрактом.

## 7. Output shape — что эмитится в ответ

Эмиттер не даёт выбора: ответ всегда

```jsonc
"200": { "description": "OK",
  "content": { "application/json": {
    "schema": { "type": "array",
                "items": { "$ref": "#/components/schemas/<ShapeName>" } } } } }
```

где `<ShapeName>` = `signature.output.type.shape` для `rowset` (а `rowset` —
единственный допустимый вид output, см. §2).

В `components.schemas.<ShapeName>` попадают **все** поля shape'а, причём **все**
фигурируют в `required` — nullable-полe всё равно required, просто его тип —
union с `null` (`src/openapi/shapes.ts:58`).

Дополнительно эмиттер всегда кладёт схему `ErrorResponse` и ссылки на неё из
`400` / `422` / `500` ответов (`src/openapi/errors.ts`). Отключается через
`options.standardErrors = false` (`src/openapi/emit.ts:112`).

## 8. Структурные и семантические правила (резюме)

Порядок валидаторов:
`parse → structural → references → consistency → emit`

Fail-fast между слоями (`src/validate/index.ts:8`). Внутри слоя ошибки
собираются и возвращаются пачкой.

### 8.1. `parse`
- Zod + `.strict()`: лишние/недостающие поля — сразу ошибка.
- Единственный код: `BINDINGS_PARSE_SCHEMA_VIOLATION`.

### 8.2. `structural` (не требует резолверов)
- `DUPLICATE_METHOD_PATH` (глобально).
- `DUPLICATE_PARAM_NAME` (локально, по `(in,name)`).
- `DUPLICATE_BIND_TO` (локально).
- `PATH_PLACEHOLDER_MISMATCH` (симметрия `{name}` ↔ `in:"path"`).
- `BODY_ON_GET`.
- `PATH_NOT_REQUIRED`.

### 8.3. `references` (требует резолверов)
- `UNRESOLVED_GRAPH` — `resolveGraphSignature` вернул `null`.
- `UNKNOWN_BIND_TO` — `bindTo` не входит в `signature.inputs`.
- `UNRESOLVED_OUTPUT_SHAPE` — `resolveShape` вернул `null` для `rowset`/`row`.

### 8.4. `consistency`
- `GRAPH_HAS_ROOT_INPUT` — любой `mode:'root'` → граф небиндим.
- `UNSUPPORTED_OUTPUT_TYPE` — output не `rowset`.
- `REQUIRED_MISMATCH` — см. §5.1.
- `TYPE_LOCATION_INVALID` — см. §5.2.
- `UNBOUND_INPUT` — см. §5.4.

## 9. Минимальный рабочий скелет

Один GET-эндпоинт, без параметров, граф возвращает `rowset<OrderItem>`:

```json
{
  "version": "1.0",
  "graphSpecRef": "commerce.graphs.v1",
  "pdmRef": "commerce.domain.v1",
  "qsmRef": "commerce.read.v1",
  "bindings": {
    "listItems": {
      "graph": "listAllItems",
      "target": { "engine": "sqlite", "dialect": "sqlite" },
      "http": { "method": "GET", "path": "/v1/items", "parameters": [] }
    }
  }
}
```

## 10. Коды ошибок (для отладки LLM-генерации)

| Layer         | Code                                  | Что чинить                                                                 |
| ------------- | ------------------------------------- | -------------------------------------------------------------------------- |
| `parse`       | `BINDINGS_PARSE_SCHEMA_VIOLATION`     | JSON не матчит Zod-схему: лишние поля (`.strict()`), неверный тип, пустая строка там, где нужен непустой string |
| `structural`  | `BINDINGS_DUPLICATE_METHOD_PATH`      | Два биндинга с одинаковыми `method + path` — оставьте один                 |
| `structural`  | `BINDINGS_DUPLICATE_PARAM_NAME`       | Внутри одного биндинга две записи с одинаковым `(in, name)`                |
| `structural`  | `BINDINGS_DUPLICATE_BIND_TO`          | Два параметра «берут» один и тот же input — выбрать одно место             |
| `structural`  | `BINDINGS_PATH_PLACEHOLDER_MISMATCH`  | `{name}` в пути ↔ `in:"path"` параметры не сходятся — добавить/убрать      |
| `structural`  | `BINDINGS_BODY_ON_GET`                | `in:"body"` в `GET` — сменить метод на `POST` или переложить в `query`     |
| `structural`  | `BINDINGS_PATH_NOT_REQUIRED`          | `in:"path"` + `required:false` — path-параметры **всегда** `required:true` |
| `references`  | `BINDINGS_UNRESOLVED_GRAPH`           | `graph` не найден резолвером — проверь имя графа                           |
| `references`  | `BINDINGS_UNKNOWN_BIND_TO`            | `bindTo` не существует в `signature.inputs` — опечатка в имени input'а     |
| `references`  | `BINDINGS_UNRESOLVED_OUTPUT_SHAPE`    | Shape вывода графа не найден — резолвер не знает такого имени              |
| `consistency` | `BINDINGS_GRAPH_HAS_ROOT_INPUT`      | Граф имеет `mode:'root'` input — он не биндится HTTP-эндпоинтом (Tier 2)   |
| `consistency` | `BINDINGS_UNSUPPORTED_OUTPUT_TYPE`    | Граф возвращает `row` / `scalar` — поддерживается только `rowset`          |
| `consistency` | `BINDINGS_REQUIRED_MISMATCH`          | Несовместимые `mode ↔ required` — см. таблицу §5.1                         |
| `consistency` | `BINDINGS_TYPE_LOCATION_INVALID`     | Например, `list` в `path` — см. таблицу §5.2                                |
| `consistency` | `BINDINGS_UNBOUND_INPUT`              | `required`/`nullable` input без параметра — добавить биндинг                |

## 11. Чек-лист перед выдачей артефакта

1. `version` — ровно `"1.0"` (не `"1.0.0"`, не `"v1.0"`).
2. Все ссылки (`graphSpecRef`, `pdmRef`, `qsmRef`) — непустые строки.
3. Никаких лишних полей на любом уровне — Zod `.strict()` отказывает.
4. `method` ∈ `{GET, POST}`. Нужен `PUT/PATCH/DELETE` → **не поддерживается**.
5. `path` начинается с `/` и не содержит `?` / `#`. Query-string — в параметрах.
6. Для каждого `{placeholder}` в пути — ровно один `in:"path"` параметр с тем же `name` и `required:true`. И наоборот.
7. Пара `method + path` уникальна по всему артефакту.
8. Внутри биндинга: уникальные `(in, name)` и уникальные `bindTo`.
9. На `GET` нет параметров `in:"body"`.
10. `parameter.required` сочетается с `mode` input'а по таблице §5.1:
    - `required` → `true`; `defaulted`/`predicate_optional` → `false`; `nullable` → любое.
11. `parameter.in` сочетается с `type.kind` по таблице §5.2:
    - `scalar` — везде; `list` — только `query`/`body`; `row`/`rowset` — нельзя.
12. Для каждого input с `mode:'required'` или `mode:'nullable'` — есть параметр, который его биндит.
13. Граф не имеет `mode:'root'` inputs. Output — `rowset<Shape>`. (Обычно LLM получает это ограничение готовым: если вам дали «не-биндимый» граф, вернитесь и откажитесь от него.)
14. `parameter.name` — это **внешнее** HTTP-имя; `bindTo` — внутреннее имя input'а графа. Они **могут** совпадать, но не обязаны.
15. Строковые литералы везде кодируйте обычной строкой (никаких `{$literal}`-конвенций — это правило из Graph IR, тут его нет).
16. Если нужен кастомный `info`/`servers` — кладите в `artifact.openapi.*`. Если нужны `x-*` или `example` — в `http.openapi` / `parameter.openapi` (passthrough).
17. НЕ добавляйте `responses`, `operationId` (если ID биндинга уже нормальный), `schema`, `requestBody` через passthrough — компилятор их генерирует.
18. `parameter.description` и `http.summary`/`http.description`/`http.tags` — чисто документация, можно и нужно заполнять, когда смысл эндпоинта ясен.

## 12. Живые примеры

Прогоняемые примеры (+ итоговый OpenAPI) — в [`examples.md`](./examples.md).
Исполняемый скрипт — [`../demo-openapi.mjs`](../demo-openapi.mjs)
(`pnpm build && node demo-openapi.mjs`).
Эталонная golden-фикстура — `test/golden/category-sales/artifact.json`
(вход) и `test/golden/category-sales/expected.openapi.json` (ожидаемый выход).
Полный набор тестов — `test/unit/**/*.test.ts`.
