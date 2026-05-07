> Status: historical.
> Date: 2026-04-14.
> Current source: docs/current/**, current code/tests, and the operational state described by the relevant owner docs.
> Why retained: Historical rationale and execution context retained for review; it is not current-state truth by itself.

# Roadmap: rntme как платформа уровня Medusa.js (gap-анализ)

## Context

Сейчас `rntme` доказан на `demo/issue-tracker-api` — issue tracker с PDM (state machine), QSM (entity-mirror проекции), 13 graph-IR графами, Kafka pipeline и Hono+OpenAPI surface. Для следующего витка зрелости нужно понять, чего не хватает продукту, чтобы он мог служить бэкбоном для **сложного, headless-commerce-уровня кейса** (по сложности сравнимого с medusa.js).

Цель — **не** копировать Medusa 1:1, а:
1. Зафиксировать архитектурные приёмы, которыми Medusa решает свою сложность (модули, workflows, DML, link-модель).
2. Сравнить с текущими возможностями rntme и составить gap-каталог.
3. Сфокусироваться на **PDM + OpenAPI** как первоочередных областях (приоритет пользователя), но дать обзор по всем измерениям.
4. Подкрепить gap-анализ конкретным spec'ом демо-проекта `commerce-api`, который "пощупает" пробелы на практике.

Финальная польза: документ, по которому можно нарезать следующие итерации продукта (Tier 1/2/3 фичи, dependencies, последовательность).

## Approach

**Хаб + тематические доки** в `docs/gaps/` (каталог уже существует и пуст — для этого и зарезервирован) + отдельный demo spec в `docs/history/specs/active-rationale/` (соблюдение существующего naming convention `YYYY-MM-DD-<topic>-design.md`).

Источник истины по Medusa — sparse checkout `@medusajs/framework`, core `@medusajs/medusa`, и пакеты `@medusajs/modules-*` в `research/medusa/` (исключено через `.gitignore`).

## Deliverables

| # | Path | Что внутри |
|---|------|-----------|
| 1 | `docs/gaps/2026-04-14-medusa-class-roadmap.md` | **Хаб.** Контекст, целевой кейс, summary текущих возможностей, кросс-cutting tier-разбивка (P0/P1/P2), оглавление и ссылки на тематические доки и demo spec, открытые вопросы. |
| 2 | `docs/gaps/pdm-gaps.md` | Глубоко: вложенные объекты, money/currency, enums, soft delete, multi-tenancy, links между модулями (medusa-style), миграции/эволюция. |
| 3 | `docs/gaps/openapi-gaps.md` | Глубоко: security schemes, idempotency-keys, multipart uploads, discriminator/oneOf, webhooks/callbacks, x-extensions для SDK codegen, error catalog. |
| 4 | `docs/gaps/queries-and-projections-gaps.md` | derived projections, joins/aggregations, distinct, window funcs, cursor pagination, full-text search, list/in params. |
| 5 | `docs/gaps/workflows-and-commands-gaps.md` | multi-aggregate commands, sagas/long-running workflows с компенсацией, scheduled jobs, outbox, idempotency на API-уровне. |
| 6 | `docs/gaps/infra-and-extensibility-gaps.md` | Postgres support, Redis (event bus/cache), file storage, plugin/module system, payment/notification/shipping providers, observability (DLQ, tracing, metrics, snapshots). |
| 7 | `docs/history/specs/active-rationale/2026-04-14-commerce-demo-design.md` | Spec на `demo/commerce-api`: минимальный домен (Product, Variant, Cart, LineItem, Order), 1–2 workflow (checkout), и явная карта "какие гэпы из roadmap блокируют demo сейчас". |
| 8 | `.gitignore` (root) | Добавить `/research/`. |

## Steps

### Step 1 — Подготовка локальной площадки для изучения Medusa

- Создать `/home/coder/project/research/medusa/`.
- В корневой `.gitignore` добавить блок `/research/` (рядом с `/.worktrees/`).
- `git clone --depth 1 --filter=blob:none --sparse https://github.com/medusajs/medusa.git research/medusa`, затем `git sparse-checkout set packages/framework packages/medusa packages/modules README.md` (полный monorepo избыточен; берём framework + core + reference modules).
- Проверить, что `git status` в `/home/coder/project` чист от research-файлов после клонирования.

### Step 2 — Survey medusa (read-only)

Запустить **3 параллельных Explore-агента** по `research/medusa/`:

- **Agent A — Domain & DML:** как описываются модели данных в DML (`packages/framework/src/utils/dml/*` и использования в модулях). Какие типы поддерживаются, как заданы relations и links, как маркируются money/enum/soft-delete. Файлы и сниппеты.
- **Agent B — Module + Workflow runtime:** `packages/framework/src/modules-sdk/*`, `packages/framework/src/workflows-sdk/*`. Как модули регистрируются, как у них API surface, как workflows запускаются и компенсируют, как pub/sub поверх Redis.
- **Agent C — HTTP API surface + OpenAPI:** `packages/medusa/src/api/*`, как генерируется/документируется OpenAPI (или нет), как зашиты admin vs store, idempotency, auth/security, file uploads.

Вывод каждого агента — короткий отчёт (≤800 слов) с конкретными путями.

### Step 3 — Написание тематических gap-доков (deliverables 2–6)

Шаблон для каждой темы:

```markdown
# Gaps: <тема>

## Что есть в rntme сегодня
- Концепт: ...
- Точки в коде: <pkg>:<file>:<lines>

## Как это решено в Medusa
- Концепт: ...
- Точки в коде: research/medusa/...

## Гэпы для commerce-class кейса
- [P0] ... — почему критично
- [P1] ... — что улучшит DX/масштаб
- [P2] ... — nice to have

## Открытые вопросы
- ...
```

### Step 4 — Написание хаба (deliverable 1)

Содержит:
- Context (короткий, отсылка к этому плану).
- Target case definition: что значит "commerce-class сложность" (мульти-агрегатные операции, длинные workflow, мульти-валюта/регион, экстенсибельность).
- Snapshot текущих возможностей rntme (используем уже собранную карту: PDM, QSM entity-mirror, 6 операторов Graph IR + emit, Hono router, OpenAPI 3.1, SQLite, Kafka relay).
- **Cross-cutting tier table:** список всех гэпов из тематических доков, отсортированных по тиру.
- Зависимости между гэпами (например: derived projections → checkout flow workflow).
- Ссылки на 5 тематических доков и demo spec.
- Открытые вопросы для следующей итерации.

### Step 5 — Написание commerce demo spec (deliverable 7)

- Минимальный домен: Product (с Variants), Cart (с LineItems), Order (со статусами).
- 1–2 workflow: `addToCart` (single aggregate), `checkoutCart` (multi-aggregate: cart→order, нужна saga).
- Маппинг каждой entity/workflow на текущие возможности rntme и явная отметка, какие гэпы из roadmap блокируют построение демо как есть (например: `Money` тип в PDM, мульти-агрегатные команды, derived projection для cart totals).
- Минимальный subset roadmap'а, который надо закрыть, чтобы demo был возможен — это станет предложением на P0.

### Step 6 — Verification

- `ls docs/gaps/` показывает 6 файлов; `ls docs/history/specs/active-rationale/` содержит новый commerce-demo spec.
- `git status` показывает изменения только в `.gitignore` и новых docs (а `research/medusa/` — игнорируется).
- Хаб-документ имеет рабочие relative-ссылки на тематические доки и demo spec.
- Каждый тематический док содержит хотя бы по одному P0-гэпу с конкретной точкой в коде rntme и Medusa.
- Demo spec содержит явный mapping demo → требуемые roadmap-гэпы.

## Critical files & references

**rntme (read для cross-reference при написании gap-доков):**
- `/home/coder/project/README.md` — позиционирование
- `/home/coder/project/packages/pdm/src/types/artifact.ts` — Entity/Relation/StateMachine типы
- `/home/coder/project/packages/pdm/src/parse/schema.ts` — JSON-схема валидации PDM
- `/home/coder/project/packages/qsm/src/*` — DDL генерация и projection handler-spec
- `/home/coder/project/packages/bindings/src/openapi/emit.ts` — OpenAPI emitter
- `/home/coder/project/packages/bindings/src/openapi/shapes.ts` — Shape → JSONSchema
- `/home/coder/project/packages/graph-ir-compiler/src/types/relational.ts` — реляционные операторы
- `/home/coder/project/packages/event-store/src/*` — event log + relay
- `/home/coder/project/packages/projection-consumer/src/*` — apply plan + idempotency
- `/home/coder/project/demo/issue-tracker-api/artifacts/{pdm,qsm,bindings}.json` + `graphs/*.json`
- `/home/coder/project/demo/issue-tracker-api/src/{server,events,artifacts}.ts`
- `/home/coder/project/docs/history/specs/active-rationale/2026-04-14-{bindings,bindings-http,mutations}-design.md` — текущие design notes

**Medusa (после клонирования; точные пути уточнятся в Step 2):**
- `research/medusa/packages/framework/src/utils/dml/*`
- `research/medusa/packages/framework/src/modules-sdk/*`
- `research/medusa/packages/framework/src/workflows-sdk/*`
- `research/medusa/packages/medusa/src/api/*`
- `research/medusa/packages/modules/*/src/services/*`

## Open questions для обсуждения по ходу

1. **Postgres-обязательность.** Multi-region/мультиarсh checkout сложно ужать в SQLite (concurrent writes, large payloads). Помечать ли Postgres-поддержку P0 для commerce-кейса, или строить демо на SQLite с явными ограничениями?
2. **Workflow-движок vs multi-aggregate command.** Medusa использует полноценный workflow runtime с компенсацией; rntme сейчас имеет только single-aggregate command. Эволюционировать `emit` до DAG-эмита (минимальный шаг) или вводить отдельный workflow primitive?
3. **Граница "сложного кейса".** Где останавливаемся: достаточно ли Product+Cart+Order+checkout, или demo должен включать также pricing/tax/inventory (это резко увеличивает скоуп демо-spec'а)?

Эти вопросы зафиксируются в хабе и решатся с пользователем уже на этапе ревью отдельных доков.
