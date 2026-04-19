# Drizzle adoption — staged migration of runtime DB layer to Drizzle ORM

**Date:** 2026-04-18
**Status:** design
**Supersedes:** `2026-04-18-db-studio-design.md` (пакет `@rntme/db-studio` удаляется вместе со scaffold-ом — см. §4.7)
**Related:**
- `2026-04-14-mutations-design.md` — projection-consumer + apply plan (затронуты в Ph-3)
- `2026-04-14-bindings-design.md` + `2026-04-14-bindings-http-design.md` — Zod derivation остаётся from-binding (§3)
- `2026-04-15-runtime-packaging-design.md` — `DbDriver` plugin-seam сохраняется (§4.1)
- `2026-04-16-predicate-optional-fix-design.md` — класс багов закрывается named params (§4.6)
- `2026-04-16-qsm-relations-migration-design.md` — QSM relations остаются source of truth для JOIN-ов (§4.2)
- `2026-04-17-cloudevents-envelope-design.md` — event-store schema = первый `drizzle-kit` consumer (§4.4)
- auto-memory: `rntme_turso_target`, `demo_join_enrichment_todo`, `rntme_predicate_optional_bug`

## 1. Problem

Три независимые боли сходятся в одну архитектурную развилку, плюс одна мотивация по ergonomics:

1. **Миграции отсутствуют как инфра.** `@rntme/qsm` → `buildProjectionSchemas()` → DDL на boot через `IF NOT EXISTS`. При изменении QSM существующая БД молча расходится со схемой. У event-store есть `assertSchemaD9Compatible` guard, но это check, не migration tool.
2. **Позиционный param-binding — источник известного класса багов.** Инцидент `wrapPredicateOptional` (2026-04-16) вскрыл footgun: `?` в SQL выравниваются walk-order, `paramOrder[]` заполняется в другом порядке. Любая перестройка lowerer-а рискует воспроизвести тот же класс.
3. **Turso (Rust-rewrite `tursodatabase/turso`) — scale-out target** по memory `rntme_turso_target`. Клиент `@tursodatabase/database` async; `better-sqlite3` sync. Переход требует async-рефакторинга всего DB-слоя.
4. **Хочется готового ecosystem** (Drizzle Studio, `drizzle-kit` migrations) вместо собственной инфры, которая сейчас ещё не написана.

Собственные решения для каждой из четырёх болей возможны, но суммарно дают: новый пакет QSM-diff миграций + собственный studio (`@rntme/db-studio` scaffold) + свой named-params рефакторинг lowerer-а + `TursoDriver`. Это **дублирует Drizzle ecosystem** в слое, который не является core-value rntme (state-machines, derived event-types, Graph IR, 4-layer validator остаются сверху в любом сценарии).

## 2. Decision

**M2 — Drizzle ORM принимается как internal runtime infrastructure**, с shape-alignment PDM/QSM (M1 elements), staged rollout в 4 фазы; Turso — параллельный независимый трек.

Ключевые принципы:

- **JSON остаётся authoring-артефактом.** Агент пишет PDM/QSM JSON. Drizzle TS генерируется codegen-ом и хранится как tracked-артефакт per service. Агент Drizzle TS не видит и не правит.
- **Drizzle — internal infra, не публичная поверхность.** Потребители сгенерированных сервисов **не** получают Drizzle в публичном API. Читают и пишут только через HTTP bindings. `drizzle-zod` → out of scope.
- **Graph IR compiler не переходит на Drizzle builder.** Lowerer остаётся AST + text, но эмитит `sql` template literals с named params вместо positional `?`. `wrapPredicateOptional` class закрывается на уровне биндинга.
- **Migration policy — гибрид.** `drizzle-kit` владеет event-store схемой (envelopes, cursor, delivery_tracking, seen_events). Projection-tables переезжают через replay из event-log — совместимо с vision-обещанием "migrations become replays", делает drizzle-kit diff на QSM-проекциях тавтологичным.
- **Drizzle Studio полностью заменяет `@rntme/db-studio`.** Пакет удаляется; его spec superseded.
- **Turso — параллельный трек.** Drizzle adoption и Turso adoption друг друга не блокируют.

## 3. Non-goals / Out of scope

Зафиксировано явно:

- **Customer-facing typed queries.** Нет escape-hatch «напиши кастомный Drizzle query в коде сгенерированного сервиса». Весь доступ — через bindings.
- **`drizzle-zod` интеграция.** Zod-схемы для HTTP bindings по-прежнему выводятся из binding-inputs в `bindings-http/startup/zod-schema.ts`. Drizzle-schema → Zod — out of scope.
- **`DbDriver` seam refactor.** Seam остаётся runtime plugin-seam. Drizzle сидит поверх driver-а, не заменяет его. Invariant «SQL stays SQLite-dialect forever» (architecture.md §6.4) сохраняется.
- **Graph IR lowerer на Drizzle builder.** Раскрытие `RelOp` в Drizzle query-builder — out of scope. Lowerer остаётся AST-based.
- **Drizzle Studio в prod.** Studio — dev-only; prod-manifest всегда `studio.enabled = false` (prod-guard в runtime, §4.7).
- **`:memory:` SQLite для сервисов с Drizzle Studio.** Studio не поддерживает `:memory:`; включённая studio требует file-based DB.
- **Turso Rust adoption как часть этой работы.** Turso — Ph-2, параллельный независимый трек.
- **Замена `@rntme/seed` API.** Seed-pipeline остаётся поверх event-store append-raw.
- **ksqlDB / Zeebe / gRPC side-integrations.** Off rntme's plate.

## 4. Architecture

### 4.1 Layer picture

```
┌─ Authoring (JSON — shape slightly aligned to Drizzle, see §4.2) ─┐
│   PDM.json · QSM.json · bindings.json · ui.json · seed.json      │
└───────────────────────┬──────────────────────────────────────────┘
                        │
          @rntme/pdm · @rntme/qsm · @rntme/bindings · ... (validators)
                        │
                        ▼
┌─ Internal codegen (new) ─────────────────────────────────────────┐
│   @rntme/qsm-drizzle : ValidatedQsm → Drizzle TS schema          │
│                         (tracked artifact per service)           │
└───────────────────────┬──────────────────────────────────────────┘
                        │
             ┌──────────┴──────────┐
             ▼                     ▼
     drizzle-kit              Runtime: @rntme/event-store ·
     (event-store             projection-consumer · seed ·
      schema migrations)      bindings-http — queries on Drizzle
             │                     │
             └──────────┬──────────┘
                        ▼
                  DbDriver seam (unchanged)
                        │
                        ▼
     better-sqlite3 (today) / @tursodatabase/database (Ph-2)
```

JSON-авторинг не меняется для агентов. Codegen порождает Drizzle-схему per service как tracked-артефакт. `drizzle-kit` использует эту схему для миграций event-store. Рантайм-пакеты — для типизированных queries. `DbDriver` seam — точка свопа storage-движка; Drizzle сидит поверх.

### 4.2 PDM/QSM shape alignment (M1 foundation)

Поверхность артефактов подгоняется к Drizzle shape в местах, где это не теряет собственной семантики и облегчает codegen:

| Область | Сейчас | После Ph-0 | Замечание |
|---|---|---|---|
| `ScalarPrimitive` | закрытый union из 6 (`integer`, `decimal`, `string`, `boolean`, `date`, `datetime`) | расширенный union, покрывающий Drizzle SQLite column-types: `text`, `integer(mode: number/bigint)`, `real`, `blob` + timestamp-modes | Закрывает часть `docs/gaps/pdm-gaps.md` (`blob`, `real`) |
| Primary keys | `primaryKey: "col"` (single-column only) | `primaryKey: string \| string[]` (composite в shape, но gate в валидаторе — смягчается в Ph-3) | Готовит MVP-gate `PC_COMPOSITE_KEY_NOT_SUPPORTED` к снятию |
| QSM relations | `{ name, to, localKey, foreignKey, cardinality }` | тот же семантический shape + `kind: 'one' \| 'many'` (alias к cardinality) и зарезервированный `through` | Cross-ref против PDM сохраняется |
| Indexes | **нет** | новый блок: `indexes: [{ name, columns, unique? }]` | Первое появление на артефакте; до этого был gap |
| Defaults / notNull / check / generated | `mode: required` | `notNull: boolean`, `default?: literal`, `check?: sql-string`, `generated?: { as, stored? }` | `check` / `generated` — под MVP-gate до явного spec-а |

**Что НЕ меняется (остаётся rntme-native):**
- State-machines и transitions
- `deriveEventTypes`
- `backing: 'entity-mirror' | 'derived'` на проекциях
- 4-layer validator + стабильные `ERROR_CODES`
- Graph IR / rc7

**Миграция demo-артефактов.** Один mechanical rewrite existing PDM/QSM JSON под новый shape; выполняется в Ph-0 как codemod в parse-стадии соответствующего пакета (`"string" → "text"`, `"integer" → { type: "integer", mode: "number" }` и т.д.).

### 4.3 Codegen — JSON → Drizzle TS

Новый пакет **`@rntme/qsm-drizzle`** (peer of `@rntme/qsm`).

**Public API:**
```ts
generateDrizzleSchema(
  qsm: ValidatedQsm,
  pdm: ValidatedPdm,
  opts?: { dialect?: 'sqlite' }
): Result<DrizzleSchemaArtifact, QsmDrizzleCodegenError>
```

`DrizzleSchemaArtifact = { files: { 'schema.ts': string; 'relations.ts': string; 'meta.ts': string } }` — содержимое файлов; запись на диск делает caller (CLI или boot-step).

**Что генерируется:**
- `schema.ts` — `sqliteTable('<table>', { ... })` per projection (entity-mirror backing).
- `relations.ts` — `relations(table, ({ one, many }) => ({ ... }))` per QSM relation.
- `meta.ts` — константы: list проекций, имя сервиса, version-tag (для drizzle-kit metadata).

**Event-store schema не генерируется из артефакта.** Authored вручную в `@rntme/event-store/src/store/drizzle-schema.ts`. Стабильная поверхность: envelopes, cursor, delivery_tracking, seen_events. `drizzle-kit` работает против этой hand-written схемы.

**Policy.** Generated TS — **tracked** в git per service. CI-check `pnpm qsm-drizzle:generate --check` fail-fast при drift между JSON и generated TS. Правка идёт только в JSON; регенерация автоматом.

### 4.4 Migration policy — гибрид

Два физически разных DB-файла имеют разные migration-модели:

**Event-store DB** (envelopes + cursor + delivery_tracking + seen_events):
- `drizzle-kit` владеет полностью.
- Migration-файлы живут per-service в `<service>/drizzle/migrations/`.
- `generate` (diff → ALTER) и `migrate` (apply) через стандартный `drizzle-kit` workflow.
- Схема стабильная; 3-4 миграции ожидаются за жизненный цикл.

**Projection DB** (QSM entity-mirror tables + `seen_events`):
- `drizzle-kit` **НЕ** владеет.
- Migration model = **replay**:
  - При изменении QSM: codegen новой Drizzle-схемы → drop проекций → replay из event-log через `@rntme/projection-consumer`.
- Обоснование: (1) vision обещает «migrations become replays»; (2) drizzle-kit diff на схеме, генерируемой из QSM, тавтологичен QSM diff-у; (3) replay гарантированно не corrupt-ится (starting from events).
- `drizzle.config.ts` строго ограничивает `schema` путём к event-store схеме; попытка сгенерить migration для projection DB невозможна по конфигу.

### 4.5 Runtime integration

В Ph-3 рантайм-пакеты переезжают на Drizzle queries:

| Package | Сейчас | После Ph-3 |
|---|---|---|
| `@rntme/event-store` — `store/sqlite.ts` | raw `better-sqlite3` statements для envelopes/cursor/delivery_tracking | Drizzle queries против hand-written event-store schema; `sql` tag для edge cases |
| `@rntme/projection-consumer` — `apply/apply-event.ts` + `apply/bind.ts` | raw SQL через `compileApplyPlan` | compiled plan эмитит `sql`-tagged query с named params |
| `@rntme/seed` — apply loop | raw `better-sqlite3` append to event store | Drizzle-wrapped append (та же логика) |
| `@rntme/bindings-http` — runtime handlers | `better-sqlite3` execute в graph-ir-compiler | Graph IR compiler эмитит `sql` tag (§4.6), Drizzle client исполняет |

### 4.6 Graph IR compiler — `sql` tag + named params

Lowerer (`packages/graph-ir-compiler/src/lower/sqlite/`) **не** переписывается на Drizzle builder. AST-based лоуэринг остаётся as-is.

**Единственное функциональное изменение:** `emit/emit.ts` и `execute/execute.ts` переходят с positional `?` на named placeholders, и с `paramOrder: string[]` на `params: Record<string, unknown>`:

- `wrapPredicateOptional` теперь эмитит `(pred) OR (:paramName IS NULL)` — имя placeholder-а в SQL и имя в params совпадают by construction; позиционное рассинхронизирование невозможно.
- `execute` принимает Drizzle client и делает `client.execute(sql.raw(sqlText), params)` (или идиоматичный Drizzle bindings API — финальная форма прототипируется в Ph-3 plan).

**Backward compat partial artifacts.** `explain()` API сохраняется; output включает `namedParams: string[]` вместо `paramOrder: string[]`. Golden-тесты IR→SQL актуализируются однократно в Ph-3.

### 4.7 Studio — Drizzle Studio заменяет `@rntme/db-studio`

- Пакет `@rntme/db-studio` удаляется из workspace вместе со scaffold-ом в `src/`.
- Spec `2026-04-18-db-studio-design.md` перемещается в `docs/superpowers/specs/done/` с пометкой «superseded by 2026-04-18-drizzle-adoption-design.md §4.7».
- `AGENTS.md §6.10` («Browse service databases via db-studio») переписывается под Drizzle Studio workflow.
- Demo `issue-tracker-api/artifacts/manifest.json` упрощается: `studio` блок редуцируется до `{ "enabled": boolean }` (без `mountPath`, `maxRows`).
- Dev workflow: `pnpm drizzle-kit studio` запускается отдельно от сервиса; открывает браузер на `local.drizzle.studio`.

**Prod guard.** `packages/runtime/src/load/load-service.ts` добавляет check:
- Если `process.env.NODE_ENV === 'production'` и `manifest.studio?.enabled === true` → boot fails с `RUNTIME_STUDIO_NOT_ALLOWED_IN_PROD`.
- Если `manifest.studio?.enabled === true` и `manifest.eventStorePath === ':memory:'` (или projection DB `:memory:`) → fails с `RUNTIME_STUDIO_REQUIRES_FILE_DB`.

**Caveats (осознанно приняты):**
- Drizzle Studio роутит через SaaS-proxy `local.drizzle.studio` — signaled в runtime README как dev-only ограничение.
- Drizzle Studio пишет в БД по умолчанию — `studio.enabled` жёстко gated в prod через §4.7.
- `:memory:` не поддерживается Drizzle Studio — enforced runtime check.

### 4.8 Turso — parallel track

`TursoDriver implements DbDriver`, using `@tursodatabase/database`. Implementation steps:

- Convert `DbDriver` methods to async (breaking семантика seam-а).
- Cascade async через: event-store (append/read/cursor/relay), projection-consumer batch loop (`BEGIN IMMEDIATE → applyEvent → COMMIT` async), bindings-http handlers, graph-ir-compiler execute, seed apply, тесты.
- Drizzle client уже async в Ph-1; Ph-2 завершает async-transition всего DB-слоя.

**Coupling с Drizzle adoption:** минимальное. PR-ы разных треков независимы; только Ph-3 требует, чтобы оба были готовы.

**Maturity gate.** Turso сам в BETA / «not production-ready». Ph-2 допустимо откладывать бессрочно. Дефолт `DbDriver` остаётся `BetterSqliteDriver`.

## 5. Phases

```
Ph-0         Ph-1              Ph-2           Ph-3
  │            │                 │               │
  │ shape      │ codegen +       │ async         │ runtime
  │ alignment  │ drizzle-kit     │ DbDriver +    │ packages
  │ PDM/QSM    │ for event-store │ TursoDriver   │ on Drizzle
  │ (no new    │ Drizzle Studio  │ (independent  │ + IR named-
  │  deps)     │ replaces        │  of Ph-1)     │ params
  │            │ @rntme/db-studio│               │
  └─────┬──────┴──────┬──────────┘               │
        │             │                          │
        └─────────────┴───────────┬──────────────┘
                                  │
                              Ph-2 ∥ Ph-1
                              Ph-3 depends on both
```

**Ph-0 — shape alignment PDM/QSM.** Dependency-free. Shippable самостоятельно. Закрывает часть `pdm-gaps.md`. Одно-шаговое изменение: PDM/QSM schema обновлена; demo JSON переписан codemod-ом.

**Ph-1 — codegen + drizzle-kit for event-store + studio replacement.** Главный Drizzle step. Drizzle runtime добавляется в deps. Публикуется `@rntme/qsm-drizzle`. Event-store переезжает под `drizzle-kit`. `@rntme/db-studio` удаляется. Demo-манифест упрощается.

**Ph-2 — async `DbDriver` + `TursoDriver`** (параллельно Ph-1). Async-refactor всего DB-слоя. `TursoDriver` landed, но не default в manifest.

**Ph-3 — runtime packages на Drizzle queries + Graph IR named-params.** Последний cascade. event-store/projection-consumer/seed/bindings-http переписывают queries. Graph IR эмитит `sql` tag с named params. После Ph-3 `better-sqlite3` остаётся optional dependency для dev fallback.

Каждая фаза получает собственный spec/plan pair при переходе к writing-plans.

## 6. Package impact summary

| Package | Phases | Change |
|---|---|---|
| `@rntme/pdm` | Ph-0 | Shape: расширение `ScalarPrimitive`, composite primary keys в shape |
| `@rntme/qsm` | Ph-0 | Shape: relations Drizzle-alignment, новый `indexes` блок, defaults/check/generated slots |
| `@rntme/qsm-drizzle` | Ph-1 | **Новый пакет.** Codegen `ValidatedQsm` → Drizzle schema TS |
| `@rntme/event-store` | Ph-1, Ph-2, Ph-3 | drizzle-kit schema (Ph-1), async API (Ph-2), Drizzle client queries (Ph-3) |
| `@rntme/projection-consumer` | Ph-2, Ph-3 | async batch loop (Ph-2), Drizzle compiled plans (Ph-3) |
| `@rntme/seed` | Ph-2, Ph-3 | async append (Ph-2), Drizzle-wrapped (Ph-3) |
| `@rntme/bindings-http` | Ph-2, Ph-3 | async handlers (Ph-2), Drizzle execute path (Ph-3) |
| `@rntme/graph-ir-compiler` | Ph-3 | `emit/` + `execute/` — named params, `sql` tag integration |
| `@rntme/runtime` | Ph-1, Ph-2 | studio-block simplification + prod-guard (Ph-1), async boot (Ph-2) |
| `@rntme/db-studio` | Ph-1 | **УДАЛЯЕТСЯ.** Package + spec superseded |
| `demo/issue-tracker-api` | Ph-0, Ph-1 | JSON rewrite (Ph-0), manifest studio simplification (Ph-1) |

## 7. Risks & mitigations

**R1 — Drizzle `@beta` API churn.** Drizzle's Turso integration и supplementary APIs в beta-канале; breaking changes вероятны.
- **Mitigation:** Exact-version pin. CHANGELOG review per upgrade. Drizzle как internal infra (§2) — не касается public API rntme.

**R2 — Turso Rust beta-maturity.** Сам Turso официально «not production-ready».
- **Mitigation:** Ph-2 можно откладывать бессрочно; дефолт `DbDriver` = `BetterSqliteDriver`. `TursoDriver` — optional.

**R3 — Drizzle Studio SaaS-proxy trust.** `local.drizzle.studio` роутит traffic через их инфру.
- **Mitigation:** Dev-only guard в runtime (§4.7). README package-level warning. Сервисы с чувствительными dev-данными → outerbase-studio desktop как alternative (не wire-up-ится rntme, но не блокируется).

**R4 — Generated TS drift.** Если правят `schema.ts` напрямую и забывают регенерить — JSON и TS расходятся.
- **Mitigation:** CI-check `qsm-drizzle:generate --check` fail при drift. File header `// GENERATED. Do not edit manually.`.

**R5 — Async-refactor стоимость (Ph-2).** Большой cascade.
- **Mitigation:** Независимость от Drizzle adoption. Можно откладывать до реальной необходимости Turso. Ph-3 Drizzle queries всё равно бенефициируют от async (Drizzle native async).

**R6 — Конфликт между drizzle-kit и replay-based projection migrations.** Риск: кто-то запустит `drizzle-kit generate` на projection DB → два источника истины.
- **Mitigation:** `drizzle.config.ts` жёстко ограничивает `schema` путём только к event-store schema. Попытка сгенерить migration для projection DB невозможна по конфигу. Документация в `@rntme/qsm-drizzle` README.

**R7 — Shape-alignment migration для existing demo.** Один-shot rewrite — много файлов.
- **Mitigation:** Mechanical codemod в parser (Ph-0), один-shot commit для demo.

## 8. Error codes

Новые префиксы (appendable по convention, не ломают существующие):

- `QSM_DRIZZLE_CODEGEN_*` — codegen failures (unsupported type, unserializable relation, invalid index spec, ...)
- `ES_MIGRATE_*` — event-store migration failures (drizzle-kit integration layer)
- `RUNTIME_STUDIO_NOT_ALLOWED_IN_PROD` — prod-guard rejection (§4.7)
- `RUNTIME_STUDIO_REQUIRES_FILE_DB` — `:memory:` check (§4.7)
- `IR_EMIT_NAMED_PARAM_COLLISION` — два `$param` с одинаковым именем, разными bindings (Ph-3; defense против shape-collision при named-params transition)

## 9. Design-decisions resolved (не требуют повторной дискуссии)

1. **Generated TS location.** Per-service, tracked. Default path: `<service>/drizzle/schema.ts` (configurable через manifest `drizzle.schemaPath`).
2. **Codegen ownership.** Новый пакет `@rntme/qsm-drizzle`. Узкий blast radius; имеет свой набор `QSM_DRIZZLE_*` кодов.
3. **Drizzle version policy.** Exact-version pin. Upgrade — ручной с CHANGELOG review.
4. **Graph IR compiler lowerer.** Остаётся AST-based. Переключается с positional на named params (Ph-3).
5. **`DbDriver` seam.** Остаётся. Drizzle сидит поверх driver-а.
6. **Demo migration.** Mechanical codemod в Ph-0 + manifest studio update в Ph-1.
7. **Hand-written vs generated event-store schema.** Hand-written (`@rntme/event-store/src/store/drizzle-schema.ts`); не генерируется из артефактов.
8. **Drizzle Studio mounting.** Не монтируется в rntme surface; отдельный dev-процесс `pnpm drizzle-kit studio`.

## 10. Open questions — для плана

Исследуется в writing-plans phase, не блокирует spec:

- **Прототип Drizzle schema output** из codegen — один entity (e.g. `issue`) end-to-end для финализации codegen API.
- **Per-service vs per-package drizzle/ layout.** Inclination: per-service (event-store schema может расширяться service-специфично через `seen_events` и будущие tables), но финализируется в Ph-1 plan.
- **Contract test для Drizzle vs raw SQL equivalence** — golden-тест в Ph-3: одна query даёт идентичный result через старый (`better-sqlite3` prepare/run) и новый (Drizzle) path.
- **Drizzle client API для named-params execute** в graph-ir-compiler — точный shape (`client.execute(sql.raw(...), params)` vs `client.run(sql\`...\`)`) — решается в Ph-3 plan.
- **drizzle-kit workflow в CI** — как migrations применяются в тестах, в demo start, в будущей prod-deploy-pipeline.

## 11. Acceptance

Каждая фаза: landed = CI green + demo end-to-end passes (boot → seed → POST command → GET list → observed projection update).

- **Ph-0 done when:** shape alignment landed; demo JSON rewritten codemod-ом; все existing tests зелёные.
- **Ph-1 done when:** `@rntme/qsm-drizzle` publishable; drizzle-kit for event-store schema wired; Drizzle Studio workflow документирован; `@rntme/db-studio` package + spec removed; demo manifest обновлён.
- **Ph-2 done when:** `TursoDriver` proходит те же contract tests, что и `BetterSqliteDriver`; async cascade завершён; `runtime/src/plugins/contract-tests.ts` coverage unchanged.
- **Ph-3 done when:** все listed runtime пакеты выполняют queries через Drizzle; Graph IR lowerer эмитит named params; `better-sqlite3` остался optional dependency; JOIN-enrichment в demo работает (закрывает `demo_join_enrichment_todo`).

## 12. Links

- `docs/architecture.md` §3, §4, §6, §7 — контекст layering, extensibility seams, known gaps
- `AGENTS.md` §3, §7 — package layering и anti-patterns (SQLite forever, JSON only, branded types — все сохраняются)
- `2026-04-16-qsm-relations-migration-design.md` — предок QSM-relations shape
- `2026-04-17-cloudevents-envelope-design.md` — event-store schema (первый drizzle-kit consumer)
- `2026-04-18-db-studio-design.md` — **superseded** in Ph-1
- [Drizzle — Turso Database (Rust) driver](https://orm.drizzle.team/docs/connect-turso-database)
- [tursodatabase/turso (GitHub)](https://github.com/tursodatabase/turso)
- auto-memory: `rntme_turso_target`, `demo_join_enrichment_todo`, `rntme_predicate_optional_bug`, `rntme_vision_framing`
