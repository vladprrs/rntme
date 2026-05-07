> Status: historical.
> Date: 2026-04-14.
> Current source: docs/current/**, current code/tests, and the operational state described by the relevant owner docs.
> Why retained: Historical rationale and execution context retained for review; it is not current-state truth by itself.

# Mutations design — gap analysis: спека vs реализация

**Date:** 2026-04-14
**Spec under review:** [`docs/history/specs/historical/2026-04-14-mutations-design.md`](../specs/2026-04-14-mutations-design.md)
**Scope:** 7 пакетов (`pdm`, `qsm`, `event-store`, `graph-ir-compiler`, `projection-consumer`, `bindings`, `bindings-http`) + demo `issue-tracker-api`.

## Context

Спека `2026-04-14-mutations-design.md` описывает ES/CQRS-контур: PDM stateMachine → event model → Graph IR emit + command role → event_store + relay + Kafka → projection consumer + QSM materialization → bindings/commands + bindings-http. Работа по ней завершена (см. `git log` по эпикам `feat/rntme-*` и `feat/bindings-*`). Этот документ — построчная ревизия того, что совпало со спекой, что отклонилось, и что требует решения — материал для последующей spec-revision или implementation follow-up.

---

## 1. Что реализовано по спеке (без оговорок)

| Раздел спеки | Пакет / файл | Статус |
|---|---|---|
| §2.1 stateMachine parsing (stateField, initial, states, transitions) | `packages/pdm/src/parse/schema.ts` | ✓ |
| §2.1 `from` поддерживает scalar \| array \| null | там же | ✓ |
| §2.5 валидация: state-field-missing/type-invalid, unknown-state, unknown-affected-field, affects-key, empty-self-loop, creation-missing-affects, unreachable-state | `packages/pdm/src/validate/state-machine.ts` | ✓ |
| §2.6 `generated: "createdAt" \| "updatedAt" \| "actor" \| "id"` | `packages/pdm/src/types/artifact.ts` | ✓ |
| §3.1 derivation формулы `PascalCase(entity)+PascalCase(transition)` | `packages/pdm/src/derive/event-types.ts:64` | ✓ (формула; см. §3 ниже про расхождение с примерами) |
| §3.2 event envelope shape (eventId, eventType, aggregateType, aggregateId, stream, version, occurredAt, actor, payload, schemaVersion) | `packages/event-store/src/types/envelope.ts` | ✓ |
| §3.3 ActorRef { user \| system \| service } | `packages/event-store/src/types/actor.ts` | ✓ |
| §3.5 stream = `<aggregateType>-<aggregateId>` | `packages/graph-ir-compiler/src/command-runtime/execute.ts:63` | ✓ |
| §3.6 optimistic concurrency через UNIQUE(stream, version) | `packages/event-store/src/store/sqlite.ts` | ✓ |
| §4.1 emit-нода: aggregate, aggregateId, transition, payload, actor | `graph-ir-compiler/src/emit/*`, `lower/sqlite/emit.ts` | ✓ |
| §4.2 role inference (command = no-root + ≥1 emit); `GRAPH_MIXED_ROLE` | `graph-ir-compiler/src/role/infer.ts` | ✓ |
| §4.4 `CommandResult { aggregateId, version, eventIds }`, signature.output = row<CommandResult> | `graph-ir-compiler/src/types/command.ts`, `validate/structural/command-shape.ts` | ✓ |
| §4.5 runtime: read-prelude на QSM → guard → write-txn на event-store; single-aggregate MVP | `graph-ir-compiler/src/command-runtime/{compile,execute}.ts` | ✓ |
| §4.6 все CMD_* validation codes + COMMAND_ILLEGAL_TRANSITION/GUARD_REJECTED/CONCURRENCY_CONFLICT | `graph-ir-compiler/src/types/result.ts:28–67` | ✓ |
| §5.1 `event_log` DDL (все колонки, UNIQUE(stream,version), индексы) | `packages/event-store/src/store/schema.ts` | ✓ |
| §5.2 `publish_cursor` DDL | там же | ✓ |
| §5.3 appendEvents: BEGIN IMMEDIATE, per-stream MAX+1, UNIQUE→ConcurrencyConflict | `packages/event-store/src/store/sqlite.ts` | ✓ |
| §5.4 relay loop: topic `rntme.<aggregate>.v1`, partition key = stream, headers (event-id/type/schema-version), at-least-once | `packages/event-store/src/relay/loop.ts`, `relay/topic.ts` | ✓ |
| §6.1 QSM projection: backing ∈ {entity-mirror, derived (тип), MVP = entity-mirror only} | `packages/qsm/src/types/artifact.ts`, `validate/cross-ref.ts:25` | ✓ |
| §6.3 DDL: три idempotency-колонки (`last_event_id`, `last_event_version`, `applied_at`), grain == keys enforcement | `packages/qsm/src/derive/ddl.ts` | ✓ |
| §6.5 idempotent apply: pre-guard по last_event_version; INSERT ON CONFLICT для creation; UPDATE WHERE version< для не-creation | `packages/projection-consumer/src/apply/{apply-event,compile,bind}.ts` | ✓ |
| §6.5 generated-field binding: `generatedOccurred` для createdAt/updatedAt, `generatedActor` для actor | `projection-consumer/src/apply/compile.ts:147–215`, `bind.ts:26–29` | ✓ |
| §6.8 findMany resolver: entity → QSM mirror table | `graph-ir-compiler/src/validate/semantic/sources.ts:36–38` | ✓ |
| §7.1 BindingEntry.kind union query\|command, default "query" | `packages/bindings/src/types/artifact.ts` | ✓ |
| §7.1 method=POST enforced; in=query запрещён для command | `packages/bindings/src/validate/structural.ts:22–29, 75–81` | ✓ |
| §7.1 kind×role crossover (BINDINGS_COMMAND_ON_NON_COMMAND_GRAPH / BINDINGS_QUERY_ON_COMMAND_GRAPH) | `bindings/src/validate/consistency.ts:42–59` | ✓ |
| §7.1 CommandResult reserved в shapes | `bindings/src/openapi/command-result.ts` | ✓ |
| §7.1 OpenAPI ответ 200 → CommandResult, 409/422 → ErrorResponse | `bindings/src/openapi/responses.ts`, `bindings-http/src/errors.ts:20–55` | ✓ |
| §7.1 bindings-http: makeCommandHandler, code→HTTP (409 для concurrency, 422 для guard/illegal) | `bindings-http/src/runtime/command-handler.ts`, `errors.ts:54–55` | ✓ |
| §7.5 E2E `report→submit→assign→reassign→resolve→close` + guard | `demo/issue-tracker-api/test/mutations-e2e.test.ts` | ✓ |

---

## 2. Существенные расхождения

### 2.1. Авто-retry при `ConcurrencyConflict` не реализован

**Спека §3.6 / §5.7:** «Concurrent writer... получит constraint violation → `CONCURRENCY_CONFLICT` → **command runtime auto-retry с replay+re-execute graph до N раз**; потом возвращает 409 Conflict клиенту.»

**Реализация:** `packages/graph-ir-compiler/src/command-runtime/execute.ts:92–101` — один attempt, при `ConcurrencyConflict` сразу бросает `CommandExecutionError('COMMAND_CONCURRENCY_CONFLICT')` без retry-цикла. `bindings-http/src/runtime/command-handler.ts` тоже не заворачивает в retry — маппит прямо в 409.

**Impact:** для MVP (single-writer SQLite) этот путь вырожденный — в живом демо конфликт возникает редко. Но при будущей миграции write-side на multi-writer (Postgres/Kafka-as-log) 409 будет прилетать клиентам там, где спека обещает прозрачный retry. Это semantic gap contract-уровня.

**Решение:** либо добавить auto-retry wrapper в `executeCommand` (с ограничителем N + jitter), либо явно зафиксировать в спеке «retry — не MVP».

### 2.2. `updatedAt` в PDM demo отсутствует

**Спека §2.6:** пример показывает обе auto-generated колонки — `createdAt` и `updatedAt`.

**Реализация:** `demo/issue-tracker-api/src/artifacts/pdm.json` для Issue объявляет только `createdAt: { generated: "createdAt" }`. `updatedAt` нет ни в `fields`, ни в QSM `exposed`, ни в DDL.

**Impact:** в проекции нет ручки «когда последний раз менялось» — типичное ожидание CRUD-API. Handler-compiler в projection-consumer уже умеет `generatedOccurred` для `updatedAt` (`compile.ts:213–215`) — ruka готова, PDM просто не объявил поле.

**Решение:** это demo-пробел, не core-пробел. Добавить `updatedAt` в Issue одной строкой в PDM (и QSM exposed).

### 2.3. Пример событий в спеке vs. реальная derivation

**Спека §3.1, таблица примеров:**

| Transition | Event type |
|---|---|
| `report` | `IssueReported` |
| `assign` | `IssueAssigned` |

**Реализация и тесты:** event types — `IssueReport`, `IssueAssign`, `IssueSubmit`, ... (`packages/pdm/test/smoke.test.ts:55–61`, `demo/issue-tracker-api/test/artifacts-exports.test.ts:36`).

**Причина:** спека декларирует формулу `EventType = PascalCase(entity) + PascalCase(transition)` и в том же §3.1 явно разрешает: «Стиль имени transition (past-tense или present-tense) — выбор автора PDM». Demo выбрал present-tense (`report`, `assign`). По формуле получается `IssueReport`, `IssueAssign`. Примерная таблица в спеке при этом показывает past-tense — это внутренняя несогласованность самой спеки, а не баг реализации.

**Impact:** ожидания читателя спеки отклоняются от того, что в wire-format. Kafka topic key, schema-registry identifiers — все используют present-tense. Консистентно внутри системы, но отличается от литературных примеров спеки.

**Решение:** либо обновить demo на past-tense transition-names (`reported`, `assigned`), либо обновить примерную таблицу §3.1. Рекомендую второе — past-tense имена transition ломают естественный UX авторинга («вызвать transition `report`» читается лучше, чем «вызвать `reported`»).

---

## 3. Минорные расхождения и edge-cases

### 3.1. `PDM_SM_TRAPPED_STATE` декларирован, но не enforcement

**Спека §2.5:** «state без исходящих transitions (warning в MVP; tier 2 — error если не помечен `terminal: true`)».

**Реализация:** ERROR_CODE константа есть (`packages/pdm/src/types/result.ts`), валидационная логика в `validate/state-machine.ts` — отсутствует. В демо transition `close → closed` — терминальное состояние, соответственно trapped, и warning не срабатывает.

**Impact:** минорный — в MVP это warning, и для demo ничего плохого не происходит.

### 3.2. `PDM_SM_DUPLICATE_TRANSITION_NAME` — trivially dead

`transitions` парсится как `Record<string, Transition>`, JSON.parse уже схлопывает дубли до last-write-wins; Zod-слой от повторного ключа не защищает. Код-константа есть для symmetry, явной проверки нет. Функциональный impact = 0 для JSON-авторинга, но при переходе на другой формат (YAML с duplicate-key preservation) код превратится в live check.

### 3.3. PDM derivation не строит envelope `{before, after}` shape

Спека §3.4 формально описывает `TransitionPayload<E,T> = { before, after }`. `@rntme/pdm` derive считает только *список* полей (`affects` + stateField); *конструкция* before/after-объектов делается в runtime — `graph-ir-compiler/src/emit/payload.ts:derivePayload`. Это осознанный split: compile-time у pdm = shape-описание, runtime-construction — у исполнителя. Спека явно этот split не упоминает, но и не запрещает.

**Impact:** 0 для MVP. Документация — стоит упомянуть в спеке.

### 3.4. QSM DDL включает поля, помеченные `generated: true`

**Спека §6.3:** «mirror entity-полей» — без уточнения «кроме generated».
**Спека §2.6 (косвенно):** generated-поля «не попадают в `affects` / event payload `before`/`after`» — про DDL прямо не сказано.

**Реализация:** `qsm/src/derive/ddl.ts:60` — `entity.fields.map()` проливает все поля, включая generated, в DDL. Это корректно: проекции *должны* хранить `created_at`/`updated_at`/`actor_id` (это же current-state mirror). Просто заполняются не из event.payload.after, а из envelope.occurredAt/actor — и `projection-consumer` это делает (binding kinds `generatedOccurred`, `generatedActor`).

**Impact:** отсутствует — поведение корректное. Фиксирую только как ложное срабатывание первичного аудита и как пример подразумеваемой, но не зафиксированной семантики.

### 3.5. Topic versioning hard-coded в `.v1`

**Спека §5.5:** «`rntme.<aggregate>.v<majorSchema>`».
**Реализация:** `event-store/src/relay/topic.ts` захардкоженно `.v1`. Схема-major = 1 всегда, потому что breaking evolution вне scope MVP (§7.3).

**Impact:** 0 сейчас. При первом breaking-bump нужно будет протащить `majorSchemaVersion` из PDM-артефакта через релейный config.

---

## 4. Внутренние противоречия спеки (вне реализации)

Замечены при аудите — не баги кода, а вещи, которые надо починить в следующей ревизии самой спеки:

1. **§3.1 past-tense vs. present-tense.** Формула + пример PDM в §2.1 дают present-tense; таблица примеров событий — past-tense. Одно из двух.
2. **§2.6 generated=true vs. §6.3 "mirror entity-полей".** Стоит явно сказать: generated-поля присутствуют в projection DDL (mirror включает их), но **не появляются в event payload** — заполняются консумером из envelope.occurredAt / envelope.actor.
3. **§3.6 auto-retry.** Либо зафиксировать «N retries с jitter, N=3 default» как нормативное требование и реализовать, либо снять из MVP-scope.
4. **§4.3 vs §4.5 read-prelude consistency.** §4.3 примечает, что read-nodes «выполняются против QSM store (eventually consistent) — допустимо для soft guards». §4.5 говорит то же, но не объясняет, как автор graph-ir должен различать soft guard (против QSM) и hard invariant (через replay). Сейчас это implicit: guard-filter в графе — soft; transition-legality — hard. Стоит описать.

---

## 5. Рекомендации по приоритету

| # | Действие | Scope | Приоритет |
|---|---|---|---|
| 1 | Добавить `updatedAt` в demo PDM+QSM (однострочник) | `demo/issue-tracker-api/src/artifacts/*.json` | low |
| 2 | Решить: реализовать auto-retry или вычеркнуть из §3.6 MVP | `graph-ir-compiler/command-runtime/execute.ts` + spec edit | medium — semantic contract |
| 3 | Доп. enforcement `PDM_SM_TRAPPED_STATE` (warning layer) | `packages/pdm/src/validate/state-machine.ts` | low |
| 4 | Обновить §3.1 примеры (past-tense → present-tense, чтобы соответствовать формуле + demo) | spec edit | low |
| 5 | Явно описать в §2.6/§6.3 behavior generated-полей в projection DDL | spec edit | low |
| 6 | Если multi-schema-version выйдет из scope — выдернуть topic versioning в config | `event-store/relay/topic.ts` | deferred |

---

## Итог

Реализация покрывает спеку на ~95%. Единственное контрактное расхождение — отсутствие auto-retry на concurrency-conflict (§3.6). Остальное — либо edge-cases с нулевым impact в MVP (trapped-state warning, duplicate-transition-name), либо косметика demo (`updatedAt`), либо несогласованности внутри самой спеки (past- vs. present-tense events, подразумевания про generated-поля).
