> Status: historical.
> Date: 2026-04-14.
> Current source: docs/current/**, docs/decision-system.md, and current code/tests.
> Why retained: Historical rationale and execution context retained for review; it is not current-state truth by itself.

# Bindings Package — Design

**Date:** 2026-04-14
**Status:** Draft — for implementation-plan input
**Related:** `graph_ir_rc_7.md` (§2.8, §3.1, §6.3.1, §21), `docs/history/specs/historical/2026-04-13-graph-ir-sql-compiler-mvp-design.md`

---

## 1. Мотивация и главный принцип

`@rntme/bindings` — отдельный artifact-слой поверх graph-ir. Его задача: описать HTTP-ручки и сгенерировать OpenAPI 3.1 spec.

**Главный принцип:** ручки описываются первыми, и граф **не диктует их схему**. Binding artifact — независимый документ; validator только проверяет согласованность ссылок и типов.

Из rc7 (§21) binding artifact уже существует концептуально. Этот пакет превращает концепцию в исполняемый код: типы, Zod-схему, validator, OpenAPI generator.

## 2. Scope

**Входит:**
- Типы `BindingArtifact` + Zod schema.
- `parseBindingArtifact(raw): Result<BindingArtifact>`.
- `validateBindings(artifact, resolvers): Result<ValidatedBindings>` — 4 слоя валидации.
- `generateOpenApi(validated, resolvers, options?): OpenApiDoc`.

**Не входит (следующие эпики / отдельные пакеты):**
- Runtime HTTP adapter (Fastify/Express/Hono) — следующий эпик.
- Adapter `from-graph-spec` — живёт в `@rntme/graph-ir-compiler` (или отдельно); не часть текущего пакета.
- Client SDK generation — отдельная история поверх OpenApiDoc.
- Headers, cookies, security schemes, pagination envelope — отложено до явной потребности.
- PUT/PATCH/DELETE — graph-ir read-side (rc7 §24).

## 3. Публичный API

```ts
// @rntme/bindings
export type BindingArtifact = { /* см. §4 */ }
export type ValidatedBindings = { /* branded, см. §6 */ }
export type OpenApiDoc = { /* §7.14 */ }

export type BindingResolvers = {
  resolveGraphSignature(graphId: string): GraphSignature | null
  resolveShape(shapeName: string): ResolvedShape | null
}

export function parseBindingArtifact(raw: unknown): Result<BindingArtifact>
export function validateBindings(
  artifact: BindingArtifact,
  resolvers: BindingResolvers,
): Result<ValidatedBindings>
export function generateOpenApi(
  validated: ValidatedBindings,
  resolvers: BindingResolvers,
  options?: OpenApiGenOptions,
): Result<OpenApiDoc>

export { ok, err, isOk, isErr, ERROR_CODES } from './result.js'
export type {
  Result, BindingsError, BindingsErrorCode, Layer,
  GraphSignature, GraphInput, InputType, InputMode, OutputType,
  ResolvedShape, ShapeField, FieldType, ScalarPrimitive, ShapeOrigin,
  OpenApiGenOptions,
} from './types/index.js'
```

`Result<T>` и `err([...])`-стиль с агрегированием ошибок следуют паттерну `@rntme/graph-ir-compiler` (`src/types/result.ts`).

## 4. Формат `BindingArtifact`

### 4.1. Top-level

```ts
type BindingArtifact = {
  version: '1.0'              // spec version самого artifact (независимо от rc7)
  graphSpecRef: string
  pdmRef: string
  qsmRef: string
  openapi?: {                 // document-level defaults для OpenAPI
    info?: { title?: string; version?: string; description?: string }
    servers?: Array<{ url: string; description?: string }>
  }
  bindings: Record<string, BindingEntry>
}
```

### 4.2. Binding entry

```ts
type BindingEntry = {
  graph: string                     // graph id
  target: { engine: string; dialect: string }
  http: HttpBinding
}

type HttpBinding = {
  method: 'GET' | 'POST'
  path: string                      // "/v1/orders/{orderId}/items"
  parameters: HttpParameter[]
  summary?: string
  description?: string
  tags?: string[]
  operationId?: string              // default = binding id
  openapi?: OperationPassthrough    // §7.11
}

type HttpParameter = {
  name: string                      // внешнее HTTP-имя
  in: 'query' | 'path' | 'body'
  bindTo: string                    // имя runtime input в graph signature
  required: boolean
  description?: string
  openapi?: ParameterPassthrough
}
```

### 4.3. Правила (structural, не требующие резолверов)

- `path` начинается с `/`, не содержит `?` и `#`.
- placeholders `{name}` в `path` ⟷ parameters `in: "path"` с тем же `name`. Симметрия обязательна.
- `method: "GET"` ⇒ никаких `in: "body"` parameters.
- `in: "body"` допустим только при `method: "POST"`.
- `(in, name)` уникально внутри одного binding.
- `bindTo` уникален внутри одного binding.
- `method + path` уникальны глобально.
- binding id (ключ в `bindings`) уникален глобально.
- `in: "path"` всегда `required: true`.

### 4.4. Правила (consistency, требуют резолверов)

Соответствие `mode` входа графа и `required` parameter-а:

| input mode           | allowed `required` | semantics |
|----------------------|--------------------|-----------|
| `required`           | `true` only        | input обязателен |
| `defaulted`          | `false` only       | absent → default в графе |
| `predicate_optional` | `false` only       | absent → NULL (rc7 §6.3.1) |
| `nullable`           | `true` или `false` | автор решает |
| `root`               | — (биндить запрещено) | ошибка |

**Биндинговый contract:**
- `required` и `nullable` inputs: **обязательно** покрыты parameter'ом.
- `defaulted` и `predicate_optional`: необязательно. Не забинженные работают через default / predicate-skip.
- `root` inputs **никогда** не биндятся (rc7 §6.3).

**Graph role restriction:** биндить можно **только** graphs с role = `query` (rc7 §6.5): нет root input + `rowset<T>` output. Predicate/mapper/reducer (имеющие root input) и graphs с row/scalar output — не binding-эндпоинты. Эти кейсы — ошибки на consistency-слое.

**Type compatibility per location:**
- `query`: scalar primitive или `list<T>` для primitive `T`.
- `path`: только scalar primitive.
- `body`: любой допустимый runtime input type.

### 4.5. Пример

```json
{
  "version": "1.0",
  "graphSpecRef": "commerce.graphs.v1",
  "pdmRef": "commerce.domain.v1",
  "qsmRef": "commerce.read.v1",
  "openapi": {
    "info": { "title": "Commerce Analytics API", "version": "1.0.0" },
    "servers": [{ "url": "https://api.example.com" }]
  },
  "bindings": {
    "getCategorySalesHttp": {
      "graph": "getCategorySales",
      "target": { "engine": "sqlite", "dialect": "sqlite" },
      "http": {
        "method": "GET",
        "path": "/v1/analytics/category-sales",
        "tags": ["analytics"],
        "summary": "Category sales aggregation",
        "parameters": [
          { "name": "dateFrom",   "in": "query", "bindTo": "dateFrom",   "required": true  },
          { "name": "dateTo",     "in": "query", "bindTo": "dateTo",     "required": true  },
          { "name": "minRevenue", "in": "query", "bindTo": "minRevenue", "required": false },
          { "name": "limit",      "in": "query", "bindTo": "limit",      "required": false }
        ]
      }
    }
  }
}
```

## 5. Resolver interface и type contract

Bindings работают только с минимальным подмножеством типов graph-ir (inputs, outputs, shape fields). Canonical IR и ниже — не импортируются.

### 5.1. Типы

```ts
type ScalarPrimitive =
  | 'integer' | 'decimal' | 'string' | 'boolean' | 'date' | 'datetime'

type FieldType =
  | { kind: 'scalar'; primitive: ScalarPrimitive }
  | { kind: 'array';  element:   ScalarPrimitive }   // для group_array (rc7 §10)

type ShapeField = { type: FieldType; nullable: boolean }

type ShapeOrigin = 'custom' | 'pdm' | 'qsm'

type ResolvedShape = {
  name: string
  origin: ShapeOrigin
  fields: Record<string, ShapeField>
}

type InputMode =
  | 'required' | 'nullable' | 'defaulted' | 'predicate_optional' | 'root'

type InputType =
  | { kind: 'scalar'; primitive: ScalarPrimitive }
  | { kind: 'list';   element:   ScalarPrimitive }
  | { kind: 'row';    shape: string }       // только root
  | { kind: 'rowset'; shape: string }       // только root

type GraphInput = {
  type: InputType
  mode: InputMode
  default?: unknown
}

type OutputType =
  | { kind: 'rowset'; shape: string }
  | { kind: 'row';    shape: string }
  | { kind: 'scalar'; primitive: ScalarPrimitive }

type GraphSignature = {
  id: string
  inputs: Record<string, GraphInput>
  output: { type: OutputType; from: string }
}

type BindingResolvers = {
  resolveGraphSignature(graphId: string): GraphSignature | null
  resolveShape(shapeName: string): ResolvedShape | null
}
```

### 5.2. Контракт резолверов

- **Pure lookup**: не бросать, возвращать `null` при ненаходе.
- **Уже нормализованные типы**: `"list<integer>"` разбирается резолвером в `{ kind: 'list', element: 'integer' }` до возврата. Bindings не парсит type expressions.
- **Имена shape глобально уникальны**: если имя коллизирует между PDM / QSM / custom, это ответственность adapter-а резолверов (в нашем случае — будущего `from-graph-spec` adapter-а в `@rntme/graph-ir-compiler`). Bindings доверяет результату.

## 6. Validation layers и error model

### 6.1. Пайплайн

```
parseBindingArtifact(raw)
  → validateStructural(artifact)
  → validateReferences(structurallyValid, resolvers)
  → validateConsistency(resolved)
  → ValidatedBindings
```

Слои fail-fast: следующий не запускается, пока предыдущий не вернул `ok`. В рамках одного слоя ошибки агрегируются.

Высокоуровневая обёртка: `validateBindings(artifact, resolvers): Result<ValidatedBindings>` запускает все три пост-parse слоя.

### 6.2. Branded types

```ts
type BindingArtifact       // после parse
type StructurallyValid     // после validateStructural
type ResolvedBindings      // после validateReferences (содержит резолвленные signature/shapes)
type ValidatedBindings     // после validateConsistency
```

Type-level гарантия: `generateOpenApi` принимает только `ValidatedBindings`.

### 6.3. Error shape

```ts
type Layer = 'parse' | 'structural' | 'references' | 'consistency' | 'internal'

type BindingsError = {
  layer: Layer
  code: BindingsErrorCode
  message: string
  path?: string       // JSON path в artifact
  hint?: string
}

type Result<T> =
  | { ok: true; value: T }
  | { ok: false; errors: BindingsError[] }
```

### 6.4. Error codes (полный список)

**Parse:**
- `BINDINGS_PARSE_SCHEMA_VIOLATION`

**Structural:**
- `BINDINGS_DUPLICATE_BINDING_ID`
- `BINDINGS_DUPLICATE_METHOD_PATH`
- `BINDINGS_DUPLICATE_PARAM_NAME`
- `BINDINGS_DUPLICATE_BIND_TO`
- `BINDINGS_PATH_PLACEHOLDER_MISMATCH`
- `BINDINGS_BODY_ON_GET`
- `BINDINGS_PATH_NOT_REQUIRED`

**References:**
- `BINDINGS_UNRESOLVED_GRAPH`
- `BINDINGS_UNKNOWN_BIND_TO`
- `BINDINGS_UNRESOLVED_OUTPUT_SHAPE`

**Consistency:**
- `BINDINGS_GRAPH_HAS_ROOT_INPUT`               // graph нельзя биндить: есть root input
- `BINDINGS_UNSUPPORTED_OUTPUT_TYPE`            // output не rowset<T>
- `BINDINGS_REQUIRED_MISMATCH`
- `BINDINGS_TYPE_LOCATION_INVALID`
- `BINDINGS_UNBOUND_INPUT`                      // required или nullable input не забинжен

**Internal:**
- `BINDINGS_INTERNAL`

## 7. OpenAPI generator — mapping правила

Generator получает `ValidatedBindings` + `BindingResolvers` + опции. Возвращает `Result<OpenApiDoc>`. `err` возможен только при нарушении инвариантов (тогда `BINDINGS_INTERNAL`).

### 7.1. Primitive → JSON Schema

| ScalarPrimitive | Schema |
|---|---|
| `integer`  | `{ "type": "integer" }` |
| `decimal`  | `{ "type": "string", "format": "decimal" }` *(default)* |
| `string`   | `{ "type": "string" }` |
| `boolean`  | `{ "type": "boolean" }` |
| `date`     | `{ "type": "string", "format": "date" }` |
| `datetime` | `{ "type": "string", "format": "date-time" }` |

`decimal` по умолчанию — string, чтобы не терять точность. Опция `options.decimalEncoding = 'number'` переключает на `{ "type": "number" }`.

### 7.2. Nullability (OpenAPI 3.1)

Union-syntax:
```json
{ "type": ["string", "null"] }
```

Для nullable array:
```json
{ "type": ["array", "null"], "items": { ... } }
```

### 7.3. Shape → `components/schemas`

```json
"CategorySalesRow": {
  "type": "object",
  "required": ["categoryId", "revenue", "totalQuantity", "lineCount", "avgItemPrice", "categoryName"],
  "properties": {
    "categoryId":    { "type": "integer" },
    "revenue":       { "type": "string", "format": "decimal" },
    "totalQuantity": { "type": "integer" },
    "lineCount":     { "type": "integer" },
    "avgItemPrice":  { "type": "string", "format": "decimal" },
    "categoryName":  { "type": ["string", "null"] }
  }
}
```

**Правило:** все поля в `required` независимо от `nullable`. Graph output всегда содержит ключ для каждого field; nullability — это возможность значения быть null, не возможность ключу отсутствовать.

### 7.4. Query parameter (scalar)

```json
{ "name": "limit", "in": "query", "required": false,
  "schema": { "type": "integer" } }
```

### 7.5. Query parameter `list<T>`

```json
{ "name": "ids", "in": "query", "required": false,
  "style": "form", "explode": true,
  "schema": { "type": "array", "items": { "type": "integer" } } }
```

Style `form` + `explode: true` — OpenAPI default: `?ids=1&ids=2&ids=3`.

### 7.6. Path parameter

```json
{ "name": "orderId", "in": "path", "required": true,
  "schema": { "type": "string" } }
```

Всегда `required: true` (enforced structurally, §4.3).

### 7.7. Defaults

Если `input.mode === 'defaulted'` — генератор ставит `parameter.schema.default = input.default`. Для `predicate_optional` — `required: false`, без `default`.

### 7.8. Body → `requestBody`

Все `in: "body"` parameters собираются в один JSON object:

```json
"requestBody": {
  "required": true,
  "content": {
    "application/json": {
      "schema": {
        "type": "object",
        "required": ["ids", "threshold"],
        "properties": {
          "ids":       { "type": "array", "items": { "type": "integer" } },
          "threshold": { "type": "string", "format": "decimal" }
        }
      }
    }
  }
}
```

- Ключ в body JSON = `name` (не `bindTo`).
- `schema.required` = parameters с `required: true`.
- `requestBody.required = true`, если хоть один body parameter присутствует.
- Content-Type фиксирован `application/json`.

### 7.9. Responses

По §4.4 binding-эндпоинты — только query graphs, output = `rowset<Shape>`. Single response `200 OK`:

```json
"200": {
  "description": "OK",
  "content": { "application/json": {
    "schema": { "type": "array", "items": { "$ref": "#/components/schemas/Shape" } }
  }}
}
```

Другие формы output (`row<T>`, scalar) не достигают generator-а — они отсекаются на consistency-слое (`BINDINGS_UNSUPPORTED_OUTPUT_TYPE`). Если требование изменится — добавить ветки в `responses.ts` и расширить consistency.

### 7.10. Стандартные error responses

Каждая операция получает `400`, `422`, `500` со ссылкой на общий `ErrorResponse`:

```json
"400": { "description": "Validation error", "content": { "application/json": { "schema": { "$ref": "#/components/schemas/ErrorResponse" }}}},
"422": { "description": "Semantic error",   "content": { "application/json": { "schema": { "$ref": "#/components/schemas/ErrorResponse" }}}},
"500": { "description": "Internal error",   "content": { "application/json": { "schema": { "$ref": "#/components/schemas/ErrorResponse" }}}}
```

```json
"ErrorResponse": {
  "type": "object",
  "required": ["code", "message"],
  "properties": {
    "code":    { "type": "string" },
    "message": { "type": "string" },
    "details": {}
  }
}
```

Отключить — `options.standardErrors = false`.

### 7.11. `x-` passthrough

`OperationPassthrough` и `ParameterPassthrough` — это просто произвольные JSON object fragments (`Record<string, unknown>`). Валидатор их не проверяет: что автор положил — то и попадёт в финальную OpenAPI спеку.

Два уровня merge-а:

- `binding.http.openapi` → deep-merge в operation object после сборки base.
- `binding.http.parameters[i].openapi` → deep-merge в parameter object.

Deep-merge правила:
- objects: рекурсивное слияние ключей,
- arrays: **заменяются полностью** (иначе `tags`/`parameters`/`required` становятся непредсказуемыми),
- scalars: заменяются.

Use case:
```json
"http": {
  "openapi": {
    "x-rate-limit": { "window": "1m", "max": 60 },
    "responses": { "200": { "headers": { "X-Total-Count": { "schema": {"type": "integer"} } } } }
  }
}
```

### 7.12. Operation structure

```json
"paths": {
  "/v1/analytics/category-sales": {
    "get": {
      "operationId": "getCategorySalesHttp",
      "summary":     "...",
      "description": "...",
      "tags":        ["analytics"],
      "parameters":  [...],
      "responses":   {...}
    }
  }
}
```

`operationId` default = binding id (ключ в `bindings`). Override через `http.operationId`.

### 7.13. Components dedup

- Все shape-refs из `output` каждого связанного графа → уникальные записи в `components/schemas` по имени.
- Root-input shapes в components **не попадают**: root inputs не биндятся, значит не отражаются в HTTP layer.
- `ErrorResponse` — один раз, если не отключён.

### 7.14. Options и OpenApiDoc

```ts
type OpenApiGenOptions = {
  decimalEncoding?: 'string' | 'number'   // default: 'string'
  standardErrors?: false                  // default: included
  info?:    { title?: string; version?: string; description?: string }
  servers?: Array<{ url: string; description?: string }>
}

type OpenApiDoc = {
  openapi: '3.1.0'
  info: { title: string; version: string; description?: string }
  servers?: Array<{ url: string; description?: string }>
  paths: Record<string, PathItem>
  components: { schemas: Record<string, JsonSchema> }
}
```

`info` / `servers` — сначала из `artifact.openapi`, затем из `options`, затем fallback `info: { title: "API", version: "0.0.0" }`.

Сериализация в JSON / YAML — вне scope пакета.

## 8. Package layout

```
packages/bindings/
  README.md
  package.json
  tsconfig.json, tsconfig.check.json
  eslint.config.mjs
  vitest.config.ts
  src/
    index.ts
    types/
      artifact.ts         # BindingArtifact + companion types
      openapi.ts          # OpenApiDoc structural types
      resolvers.ts        # BindingResolvers + GraphSignature/ResolvedShape
      result.ts           # Result + BindingsError + ERROR_CODES
      index.ts            # re-exports
    parse/
      schema.ts           # Zod schema for BindingArtifact
      parse.ts            # parseBindingArtifact
    validate/
      structural.ts
      references.ts
      consistency.ts
      index.ts            # validateBindings
    openapi/
      emit.ts             # generateOpenApi
      shapes.ts           # field → schema, shape → components
      parameters.ts       # input → parameter / body
      responses.ts        # output → response
      errors.ts           # стандартный ErrorResponse
      passthrough.ts      # deep-merge
  test/
    parse.test.ts
    validate-structural.test.ts
    validate-references.test.ts
    validate-consistency.test.ts
    openapi-shapes.test.ts
    openapi-parameters.test.ts
    openapi-responses.test.ts
    openapi-passthrough.test.ts
    integration.test.ts
    fixtures/
      category-sales/
        artifact.json
        graph-signature.ts     # fake resolver data
        shapes.ts
        openapi.golden.json
```

### 8.1. package.json

- `"name": "@rntme/bindings"`, `"type": "module"`, `"private": true`.
- `"exports": { ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" } }`.
- Dependencies: `zod`.
- DevDependencies: `typescript`, `vitest`, `@typescript-eslint/*`, `eslint`, `prettier`, `@types/node` (повторяем compiler).
- Scripts: `build`, `test`, `test:watch`, `typecheck`, `lint`, `format` — как в compiler.

### 8.2. Зависимости на другие пакеты

`@rntme/bindings` **не зависит** от `@rntme/graph-ir-compiler` напрямую. Shared типы (`GraphSignature`, `ResolvedShape`, `InputMode` и т.д.) объявлены локально в `src/types/resolvers.ts`. Если позже появится желание делить типы, это делается через soft рефакторинг compiler-а (экспорт selective типов), но не обязательно для MVP.

Adapter `createResolversFromGraphSpec(graphSpec, pdm, qsm): BindingResolvers` — **вне этого пакета**. Предполагаемое место: `@rntme/graph-ir-compiler` (thin adapter). Финальное решение — в implementation plan.

## 9. Тестирование

Vitest, TypeScript strict.

### 9.1. Покрытие по слоям

- **Parse:** per-field Zod tests, path regex, enums. Каждый `BINDINGS_PARSE_SCHEMA_VIOLATION` путь — тест.
- **Structural / references / consistency:** happy path + негатив на каждый error code. Тест агрегации: слой возвращает несколько ошибок одним `err([...])`.
- **OpenAPI submodules:** изолированные unit-тесты для shapes, parameters, responses, passthrough.
- **Integration:** golden tests (`artifact + fake resolvers → OpenApiDoc` vs `.golden.json`).
- **End-to-end:** Category Sales из rc7 §22 → полный OpenAPI snapshot.

### 9.2. Edge cases (explicit)

- `mode: "nullable"` + `required: true` и `required: false`.
- `predicate_optional` без биндинга (OK) и с биндингом (`required: false`).
- `defaulted` без биндинга (OK); с биндингом — `schema.default` пробрасывается.
- Path с двумя placeholders: `/a/{x}/b/{y}`.
- POST + body с несколькими fields + query parameter (mixed location).
- passthrough override стандартных error responses.
- `decimalEncoding: 'number'` option.
- Shape dedup: две ручки, один output shape → одна запись в components.
- Negative: binding на graph с root input → `BINDINGS_GRAPH_HAS_ROOT_INPUT`.
- Negative: binding на graph с `row<T>` output → `BINDINGS_UNSUPPORTED_OUTPUT_TYPE`.
- Negative: unbound `required` / `nullable` input → `BINDINGS_UNBOUND_INPUT`.

## 10. Открытые вопросы / будущие эпики

- **Runtime HTTP adapter.** Следующий эпик. Пакет — `@rntme/bindings-http` (или `-runtime`). Принимает `ValidatedBindings` + compiler + Fastify/Express/Hono adapter.
- **Adapter `from-graph-spec`.** Thin function в `@rntme/graph-ir-compiler`, превращает parsed graph spec + PDM + QSM в `BindingResolvers`. Финализировать в implementation plan.
- **Headers / cookies** — когда появится auth / tenant-routing.
- **Pagination envelope** (`totalCount`, `nextCursor`) — через `response.envelope` или passthrough.
- **Client SDK** — отдельный пакет поверх OpenApiDoc; стандартные OpenAPI codegen.
- **Mutations / security schemes** — вне scope rc7.

## 11. Что пакет сознательно НЕ делает

- Не разбирает и не компилирует graph spec.
- Не знает про SQL / capabilities / dialects (только хранит `target` как opaque).
- Не валидирует совместимость graph с target engine.
- Не генерирует JSON-schema для graph в отрыве от OpenAPI.
- Не сериализует OpenAPI в файл.
