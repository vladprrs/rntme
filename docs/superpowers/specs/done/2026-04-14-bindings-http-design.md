# Bindings HTTP Runtime Package — Design

**Date:** 2026-04-14
**Status:** Draft — for implementation-plan input
**Related:** `docs/superpowers/specs/2026-04-14-bindings-design.md` (§10), `graph_ir_rc_7.md` (§2.8, §6.3.1, §21)

---

## 1. Мотивация и главный принцип

`@rntme/bindings-http` — runtime-слой, исполняющий HTTP-ручки, описанные в `BindingArtifact`. Принимает `ValidatedBindings` (из `@rntme/bindings`), graph spec + PDM + QSM (для compile) и `better-sqlite3` Database. Возвращает готовый Hono sub-router, который caller монтирует в своё приложение.

**Главный принцип:** пакет — тонкая связка между уже существующими слоями. Он **не** придумывает собственных правил для bindings (все правила — в `@rntme/bindings`) и **не** придумывает способа исполнять графы (это делает `@rntme/graph-ir-compiler`). Его работа — конвертировать HTTP wire-формат в параметры графа и обратно.

## 2. Scope

**Входит:**
- `createBindingsRouter(opts): Hono` — единственная public entry-point функция.
- Компиляция всех биндженных графов на старте, кэш скомпилированных артефактов.
- Построение Zod-схем для coercion query/path/body параметров из `GraphSignature + HttpParameter[]`.
- Маппинг HTTP-имён → graph input names через `bindTo`.
- Исполнение графа через `executeCompiled` и сериализация rowset в JSON-массив.
- Error responses в формате `{ code, message, details? }` (400, 500).
- Опциональный `GET /openapi.json`, если передан `openApiDoc`.
- `BindingsRuntimeError` — исключение startup-фазы при compile-ошибках.

**Не входит (отдельные эпики / будущие пакеты):**
- Auth, CORS, rate-limiting, tracing — стандартные Hono middleware на стороне caller'а.
- Multi-tenant routing / per-request DB selection.
- Pagination envelope (`totalCount`, `nextCursor`).
- Shape-aware response post-processing.
- Streaming ответов.
- Mutations (write-графы).
- Client SDK generation.
- Non-SQLite executors.
- Hot reload.
- 422 response code в runtime (зарезервирован в OpenAPI документе).

## 3. Публичный API

```ts
// @rntme/bindings-http
import type { Hono } from 'hono';
import type BetterSqlite3 from 'better-sqlite3';
import type { ValidatedBindings, OpenApiDoc } from '@rntme/bindings';
import type { Context } from 'hono';

export type BindingsRouterOptions = {
  validated: ValidatedBindings;
  graphSpec: unknown;          // тот же объект, что передавался в compile
  pdm: unknown;
  qsm: unknown;
  db: BetterSqlite3.Database;

  openApiDoc?: OpenApiDoc;     // если задан — монтируется GET /openapi.json
  onError?: (err: unknown, ctx: Context) => void;   // observability hook, не меняет ответ
};

export function createBindingsRouter(opts: BindingsRouterOptions): Hono;

export class BindingsRuntimeError extends Error {
  readonly errors: ReadonlyArray<{ bindingId: string; graphId: string; cause: unknown }>;
}
```

- Единственная публичная функция. Всё остальное — детали реализации.
- Caller передаёт тот же `graphSpec/pdm/qsm`, что использовался для построения `ValidatedBindings` (их согласованность — ответственность caller'а / будущего `from-graph-spec` adapter-а). `signature` и `outputShape` для каждого binding берутся напрямую из `validated.resolved[bindingId]` — резолверы в runtime не нужны.
- `onError` вызывается для каждой неожиданной ошибки в handler-е. Его задача — логирование / репортинг; форма HTTP-ответа от него не зависит.
- `BindingsRuntimeError` бросается только из `createBindingsRouter`, никогда — из runtime-handler'ов.

## 4. Request lifecycle

Для одной ручки (например, `GET /v1/analytics/category-sales?dateFrom=...&limit=...`):

```
Hono matches route → handler(ctx)
  1. extract(ctx, paramSpecs) → raw bag: Record<httpName, string | string[] | null | undefined | jsonValue>
       - query: ctx.req.queries(name) (массив; для single-param берём last)
       - path:  ctx.req.param(name)
       - body:  await ctx.req.json() (один раз на запрос, если у binding есть body-параметры)
  2. zodParse(rawBag) → typed values | ZodError
       - err → 400 { code: 'VALIDATION_ERROR', details: [...] }
  3. remap: Record<httpName, value> → Record<graphInputName, value> через bindToMap
  4. executeCompiled(cachedCompileResult, graphParams, db) → unknown[]
       - catch: onError?.(err, ctx); return 500 { code: 'INTERNAL_ERROR' }
  5. ctx.json(rows, 200)
```

Детали:

- **Content-Type для body**: если binding имеет body-параметры, handler проверяет Content-Type; невалидный/пустой/невалидный JSON → 400 `{ code: 'INVALID_BODY' }`.
- **`list<T>` в query**: форма `?ids=1&ids=2&ids=3` (OpenAPI `style: form, explode: true`). `ctx.req.queries('ids')` возвращает `['1','2','3']`.
- **Дубликат single query**: `?limit=1&limit=2` для non-array параметра → берём последний (last-wins, HTTP-convention).
- **Response**: сырой JSON-массив, без envelope. Decimal-поля ожидаются уже в строковой форме из PDM (TEXT columns).
- **Header Content-Type ответа**: `application/json; charset=utf-8` — Hono выставляет автоматически.

## 5. Zod-схемы: построение и правила

Для каждого binding на старте строим **две** Zod-схемы — раздельно, чтобы сообщения об ошибках были чище:

### 5.1. Path + Query schema

```ts
z.object({
  [name]: primitiveSchema(inputType, { nullable, optional, default })
  // для каждого HttpParameter, где in in ('path', 'query')
}).strict()  // unknown query params → 400
```

### 5.2. Body schema

```ts
z.object({
  [name]: primitiveSchema(inputType, { nullable, optional, default })
  // для каждого HttpParameter, где in === 'body'
}).strict()
```

Строится только если у binding есть body-параметры.

### 5.3. `primitiveSchema` правила

| input type | schema |
|---|---|
| `integer`  | `z.coerce.number().int()` |
| `boolean`  | `z.preprocess(v => typeof v === 'boolean' ? v : v === 'true' \|\| v === '1' ? true : v === 'false' \|\| v === '0' ? false : v, z.boolean())` |
| `string`   | `z.string()` |
| `date`     | `z.string().regex(ISO_DATE_RE)` (оставляем строкой; compiler не ожидает `Date`) |
| `datetime` | `z.string().regex(ISO_DATETIME_RE)` (тот же принцип) |
| `decimal`  | `z.string().regex(/^-?\d+(\.\d+)?$/)` — строго строка, никаких `Number()` |
| `list<T>`  | `z.preprocess(v => Array.isArray(v) ? v : [v], z.array(primitiveSchema(T)))` |

Регулярки:
- `ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/`
- `ISO_DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/`

Модификаторы:
- `required: false` + `mode: 'predicate_optional'` → `.optional()` (без default — compiler подставит null по семантике predicate).
- `required: false` + `mode: 'defaulted'` → `.optional()` (без Zod-default). Compiler сам подставит default через `paramDefaults` при отсутствии ключа в params bag — это single source of truth для default-значений (см. `packages/graph-ir-compiler/src/execute/execute.ts`).
- `nullable: true` на input → `.nullable()` на schema. Для query/path строка `"null"` не принимается; `null` валиден только в body (JSON `null`).
- `required: true` → без `.optional()`; отсутствие → ZodError(`invalid_type`, received: `undefined`).

### 5.4. Error mapping из ZodError

```ts
{
  code: 'VALIDATION_ERROR',
  message: 'Invalid request parameters',
  details: error.issues.map(i => ({
    path: i.path.join('.'),
    message: i.message,
    code: i.code,   // zod issue code: invalid_type, too_small, custom и т.д.
  })),
}
```

Единый формат для path/query/body — в `path` попадает имя поля (не location). Location можно добавить через префикс при merge если пользователи попросят.

### 5.5. Edge cases

- **Single query передан два раза**: last-wins.
- **List query не передан вообще**: с `required: false` — undefined; с `required: true` — ZodError.
- **Nullable + required: false**: можно опустить, можно передать `null` (только в body); `z.string().nullable().optional()`.
- **Path parameter mismatch**: теоретически невозможен, Hono уже смэтчил маршрут.

## 6. Startup pipeline

Синхронная последовательность в `createBindingsRouter`:

```
1. uniqueGraphIds = new Set(values(validated.resolved).map(r => r.entry.graph))
2. compileCache: Map<graphId, CompileResult> = new Map()
   errors: Array<{ bindingId?: string; graphId: string; cause: unknown }> = []
   for graphId in uniqueGraphIds:
     result = compileForGraph(graphSpec, graphId, pdm, qsm)
     if (result.ok) compileCache.set(graphId, result.value)
     else errors.push(... result.errors.map(e => ({ graphId, cause: e })))
3. if (errors.length) throw new BindingsRuntimeError(errors)
4. plan: Record<bindingId, BindingPlan> = {}
   for [bindingId, resolved] in entries(validated.resolved):
     plan[bindingId] = {
       entry: resolved.entry,
       signature: resolved.signature,
       outputShape: resolved.outputShape,
       querySchema, pathSchema, bodySchema,                         // §5
       bindToMap: buildBindToMap(resolved.entry.http.parameters),
       compiled: compileCache.get(resolved.entry.graph),            // non-null by construction
     }
5. app = new Hono()
   for [bindingId, bp] in entries(plan):
     app[method](honoPath(bp.binding.http.path), makeHandler(bp, { db, onError }))
   if (openApiDoc): app.get('/openapi.json', c => c.json(openApiDoc))
   return app
```

### 6.1. `compileForGraph` helper

Текущий `compile()` в `@rntme/graph-ir-compiler` работает только со spec-ом, содержащим ровно один graph (см. `packages/graph-ir-compiler/src/index.ts`, проверка `graphIds.length !== 1`).

Workaround: перед вызовом `compile` shallow-клонируем spec и оставляем только нужный graph:

```ts
function compileForGraph(
  rawSpec: unknown,
  graphId: string,
  pdm: unknown,
  qsm: unknown,
): Result<CompileResult> {
  const spec = rawSpec as { graphs: Record<string, unknown> };
  const singleGraphSpec = { ...spec, graphs: { [graphId]: spec.graphs[graphId] } };
  return compile(singleGraphSpec, pdm, qsm);
}
```

Цена: `compile` повторно парсит PDM/QSM на каждом вызове. Для MVP (десятки bindings) приемлемо. Когда compiler научится multi-graph spec — хелпер снимается за один коммит.

### 6.2. `honoPath` helper

OpenAPI path syntax (`/v1/orders/{orderId}`) ≠ Hono syntax (`/v1/orders/:orderId`). Утилита:

```ts
function honoPath(openApiPath: string): string {
  return openApiPath.replace(/\{([^/}]+)\}/g, ':$1');
}
```

Тесты: no placeholders, one, multiple, nested segments.

### 6.3. `makeHandler`

Чистая closure над `BindingPlan` и deps (`db`, `onError`). Никакого глобального state. Возвращает `(c: Context) => Promise<Response>`.

## 7. Error model

### 7.1. 400 — VALIDATION_ERROR

- Zod-schema не прошла `safeParse` для query/path или body.
- Невалидный/пустой body при POST с body-параметрами → отдельный code `INVALID_BODY` (не `VALIDATION_ERROR`, потому что details нет).
- Unknown query-параметр (`.strict()`) → `VALIDATION_ERROR` с issue code `unrecognized_keys`.

### 7.2. 500 — INTERNAL_ERROR

- Исключение из `executeCompiled` (например, SQLite закрыт, таблица отсутствует, any unexpected).
- Исключение в handler-е (никогда не должно случаться, но защита).
- Тело всегда: `{ code: 'INTERNAL_ERROR', message: 'Internal server error' }`. **Никаких стектрейсов или внутренних сообщений** — они уходят в `onError`, но не в response.

### 7.3. Что НЕ генерируется

- **422** — зарезервирован в OpenAPI-документе, но read-only query-графы его не производят. Если в будущем появятся write-графы или кастомные handler-гейты — добавим.
- **404** — Hono сам отдаёт для непроматченных маршрутов, мы не переопределяем.
- **405** — Hono сам отдаёт для mismatch-метода.

## 8. Package layout

```
packages/bindings-http/
  README.md
  package.json
  tsconfig.json
  tsconfig.check.json
  eslint.config.mjs
  vitest.config.ts
  src/
    index.ts                    # public barrel: createBindingsRouter, BindingsRuntimeError, types
    router.ts                   # createBindingsRouter — оркестратор
    errors.ts                   # BindingsRuntimeError + error-response helpers
    startup/
      compile-plan.ts           # compileForGraph + per-binding plan builder
      zod-schema.ts             # buildSchemas(params, signature) → { query, path, body? }
      hono-path.ts              # {name} → :name
    runtime/
      handler.ts                # makeHandler(plan, deps): Hono handler
      extract.ts                # ctx → raw bag (query/path/body)
      remap.ts                  # http names → graph input names
  test/
    unit/
      zod-schema.test.ts
      hono-path.test.ts
      extract.test.ts
      remap.test.ts
      errors.test.ts
    integration/
      router.test.ts            # end-to-end через app.fetch(Request)
    fixtures/
      category-sales/
        spec.ts
        pdm.ts
        qsm.ts
        artifact.json
        schema.sql
      seed.ts                   # in-memory sqlite helper
```

### 8.1. package.json

```json
{
  "name": "@rntme/bindings-http",
  "type": "module",
  "private": true,
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" }
  },
  "dependencies": {
    "@rntme/bindings": "workspace:*",
    "@rntme/graph-ir-compiler": "workspace:*",
    "hono": "^4.0.0",
    "zod": "^3.23.0"
  },
  "peerDependencies": {
    "better-sqlite3": "^11.0.0"
  },
  "devDependencies": {
    "better-sqlite3": "^11.0.0",
    "@types/better-sqlite3": "*",
    "typescript": "*",
    "vitest": "*",
    "eslint": "*",
    "prettier": "*",
    "@types/node": "*"
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc -p tsconfig.check.json --noEmit",
    "lint": "eslint src test",
    "format": "prettier --write src test"
  }
}
```

- `better-sqlite3` — peer, потому что caller уже держит его (передаёт `db: Database` как аргумент). Натив, один инстанс на проект — критично.
- Hono и Zod — прямые runtime deps.

### 8.2. Точные версии

Значения `*`/`^x` в `devDependencies` будут выровнены с версиями из `packages/bindings` и `packages/graph-ir-compiler` при создании пакета в implementation plan'е.

## 9. Тестирование

Vitest, TypeScript strict, те же стандарты что в `@rntme/bindings` и `@rntme/graph-ir-compiler`.

### 9.1. Unit

- **`zod-schema`** — per-primitive happy+negative (`integer`, `decimal`, `string`, `boolean`, `date`, `datetime`), `list<T>`, `nullable`, `optional`, `defaulted`. Проверяется точный вывод `safeParse`.
- **`hono-path`** — no-placeholder, один, два, nested segments.
- **`extract`** — моки Hono Context: query/path/body; last-wins для дубликата query; пустой body → undefined.
- **`remap`** — таблица бинд-имён; 3-4 case'а.
- **`errors`** — `BindingsRuntimeError` агрегация; 400-builder из ZodError; 500-builder без стектрейса.

### 9.2. Integration — через `app.fetch(Request)`

Hono умеет принимать Web `Request` и возвращать `Response`:

```ts
const router = createBindingsRouter({ validated, resolvers, graphSpec, pdm, qsm, db, openApiDoc });
const res = await router.fetch(new Request('http://x/v1/analytics/category-sales?dateFrom=2024-01-01&dateTo=2024-03-01'));
expect(res.status).toBe(200);
expect(await res.json()).toEqual([...]);
```

Сценарии:
- Happy GET с query.
- Happy POST с body (если fixture покрывает; иначе — синтетический binding).
- Happy path parameter (`/v1/orders/{orderId}`).
- Happy `list<T>` query (`?ids=1&ids=2`).
- 400: missing required query.
- 400: decimal с невалидной формой (`minRevenue=abc`).
- 400: unknown query parameter (`.strict()`).
- 400: invalid body JSON или неверный Content-Type → `INVALID_BODY`.
- 500: broken db (закрытый Database) → `onError` вызывается, 500 без стектрейса.
- `GET /openapi.json` при переданном `openApiDoc` — возвращает документ.
- `GET /openapi.json` отсутствует при не-переданном `openApiDoc`.
- `BindingsRuntimeError` на старте при заведомо некомпилируемом binding.

### 9.3. Fixture

Category Sales из rc7 §22: spec, pdm, qsm, artifact уже используются в test-suite `@rntme/bindings`. Для MVP копируем в `test/fixtures/category-sales/` нашего пакета (DRY через shared workspace-fixture — отдельный рефакторинг).

`schema.sql` + seed через `beforeAll` на in-memory SQLite (`new Database(':memory:')`).

### 9.4. Что не тестируем

- Внутренности compiler-а и `@rntme/bindings` — это их ответственность.
- Производительность и нагрузка.
- Hono маршрутизация и middleware-порядок (доверяем фреймворку).

## 10. Открытые вопросы / будущие эпики

- **Multi-graph compile**: когда compiler поддержит spec с несколькими графами — `compileForGraph` workaround снимается.
- **Multi-tenant DB**: `db: Database` → `getDb: (ctx) => Database`. Простой рефакторинг за одну итерацию, когда появится потребность.
- **Streaming rowset**: для больших ответов `ctx.json` буферизует всё. Когда станет узким местом — опциональный `stream: true` режим через Hono streaming API.
- **Shape-aware response serialization**: если окажется, что PDM разрешает decimal как REAL (а не TEXT), добавим шаг "post-process rows по output shape". Пока полагаемся на convention.
- **422 для semantic errors**: появится вместе с mutations / кастомными handler-гейтами.
- **Re-use fixture** через отдельный workspace-пакет (`@rntme/test-fixtures`) — когда станет больно копировать.
- **Ре-экспорт типов из `@rntme/bindings`** — по запросу; по умолчанию два импорта.

## 11. Что пакет сознательно НЕ делает

- Не валидирует `BindingArtifact` (это `@rntme/bindings`).
- Не компилирует SQL (это `@rntme/graph-ir-compiler`).
- Не генерирует OpenAPI spec (это `@rntme/bindings`).
- Не содержит auth / rate-limit / tracing / CORS.
- Не поддерживает multi-tenant routing из коробки.
- Не оборачивает ответ в envelope (сырой JSON-массив).
- Не делает shape-aware post-processing ответа.
- Не умеет hot reload.
- Не поддерживает streaming.
- Не знает про не-SQLite engines.
