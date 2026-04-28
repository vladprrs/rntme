# Architecture audit — `@rntme/pdm`

This document mirrors the read-only architecture audit posted on Multica so it can be reviewed offline and linked from the repo.

| | |
|---|---|
| **Multica issue** | `RNT-207` (`df23b2f2-e6d4-4502-9fd1-b9997f3d5c6c`) |
| **Issue title** | Audit: package architecture — @rntme/pdm |
| **Package / scope** | `@rntme/pdm` |
| **Verdict (summary)** | needs cleanup |
| **Audit comment id** | `b966a8a9-93fe-42a2-b99b-23460be67638` |
| **Audit comment date** | 2026-04-28 |

---

## Audit report

The sections below reproduce the audit comment body **verbatim** from Multica (formatting preserved).


## Audit Report: @rntme/pdm

**Verdict: needs cleanup** — пакет архитектурно здоров для MVP, но накопил ~7 конкретных проблем: 2 medium (технический debt, дублирование), 4 low (покрытие тестами, консистентность, coupling), 1 architectural risk (граница пакета vs. `ActorRef`). Ни одна не блокирует продакшн, но в совокупности замедлят onboarding следующего разработчика.

---

### 1. [medium] `loadPdmDir` — architectural boundary violation: парсит, но не валидирует

**Evidence:** `src/load/load-dir.ts:50` вызывает `parsePdm({ entities })`, но не `validatePdm`. Это единственный entrypoint в пакете, который возвращает "сырой" `PdmArtifact` вместо `ValidatedPdm`.

**Impact:** Потребители `loadPdmDir` (например, `@rntme/blueprint` в Track A) вынуждены сами помнить о вызове `validatePdm`. Нарушает инвариант README: "Output feeds every downstream package".

**Recommendation:** Либо добавить `validatePdm` внутрь `loadPdmDir` и вернуть `Result<ValidatedPdm>`, либо переименовать в `loadPdmDirRaw` и явно документировать, что validation — ответственность вызывающей стороны. Предпочтительнее первое, т.к. пакет сам владеет брендом `ValidatedPdm`.

---

### 2. [medium] Трижды дублируется `normalizeFrom`

**Evidence:**
- `src/validate/state-machine.ts:182`
- `src/resolvers/pdm-resolver.ts:125`
- `src/derive/event-types.ts:95`

Все три функции идентичны вплоть до сигнатуры.

**Impact:** Расходимость семантики при изменении (например, добавление `readonly` или нормализации `null[]`). Сейчас риск невелик, но при расширении Transition (например, массив `to`) это станет ловушкой.

**Recommendation:** Вынести в `src/types/transition-helpers.ts` (или `src/utils/normalize.ts`) и импортировать из одного места. Это internal refactoring, не ломает публичный API.

---

### 3. [low] `loadPdmDir` использует строковый литерал `'PDM_PARSE_DIR_INVALID'` вместо `ERROR_CODES`

**Evidence:** `src/load/load-dir.ts:23`, `33`, `55` — код ошибки задан строкой, а не через `ERROR_CODES.PDM_PARSE_DIR_INVALID`. Константа `PDM_PARSE_DIR_INVALID` есть в `ERROR_CODES` (`src/types/result.ts:24`).

**Impact:** Нарушает конвенцию AGENTS.md §4: "Error codes... stable across releases... exported as `ERROR_CODES`". Риск рассинхронизации при переименовании.

**Recommendation:** Заменить литералы на `ERROR_CODES.PDM_PARSE_DIR_INVALID`.

---

### 4. [low] Отсутствуют тесты на ключевые edge cases

**Evidence:**
- Нет теста на **составной ключ** (`keys: ['a', 'b']`) — `test/unit/validate-structural.test.ts` использует только `['id']`.
- Нет теста на **self-relation** (entity ссылается сама на себя через `relations`) — в structural validator есть логика для этого (`targetEntityKnown`), но она не покрыта.
- Нет теста на **несколько entities со stateMachine** — `deriveEventTypes` и `validateStateMachine` тестируются только с одной entity.
- Нет теста на **entity без relations** с проверкой, что `resolveEntity` возвращает `relations: []` (а не `undefined` или отсутствие поля).
- Нет теста на **creation transition с `affects: []`** — граничный случай, валидный по спеке.
- `load-dir.test.ts` имеет только 2 теста и не покрывает ошибку чтения invalid JSON в entity-файле.

**Impact:** Регрессии в этих сценариях не поймаются до интеграции. Особенно рискованно для `keys` — downstream пакеты (graph-ir-compiler, projection-consumer) полагаются на семантику составных ключей.

**Recommendation:** Добавить unit-тесты в `validate-structural.test.ts` (composite key, self-relation), `derive-event-types.test.ts` (multi-entity stateMachine), `resolvers.test.ts` (entity без relations), `load-dir.test.ts` (malformed entity JSON).

---

### 5. [low] `ActorRef` находится в `@rntme/pdm`, хотя не имеет отношения к PDM

**Evidence:** `src/types/artifact.ts:73` объявляет `ActorRef` — runtime-концепция событийного конверта. В README (`README.md:70`) написано: "Declared here because command executor and projection consumer both consume it from downstream of PDM resolution."

**Impact:** Нарушает границу пакета. `@rntme/pdm` — парсер/валидатор/резолвер PDM-артефакта. `ActorRef` — runtime-примитив event store. Это создаёт ложную зависимость: пакет, который нужен только для compile-time валидации, тащит runtime-тип.

**Recommendation:** Перенести `ActorRef` в `@rntme/contracts-common-v1` или `@rntme/event-store`. Если нужен в `deriveEventTypes` для payload metadata — сделать import из runtime-пакета, а не держать в PDM. Это breaking change для типов, но не для runtime.

---

### 6. [low] `PdmDirectoryIndexSchema` не валидирует содержимое `pdm.json`

**Evidence:** `src/load/load-dir.ts:8` — `PdmDirectoryIndexSchema` требует только `{ version?: string }`. Он не проверяет, что `version` — semver, не проверяет другие поля, которые могут появиться в будущем (например, `name`, `description` по спеке project-first blueprint).

**Impact:** `loadPdmDir` молча проглатывает невалидный `pdm.json` с лишними полями (`.strict()` отсутствует? На самом деле `.strict()` есть, но `version: z.string().optional()` слишком слабый контракт). При расширении формата directory layout это создаст тихие ошибки.

**Recommendation:** Ужесточить схему: `version: z.enum(['1'])` на текущий момент, и добавить тест на отклонение `version: '2'` или unknown keys.

---

### 7. [low] Нет теста на отсутствие `stateMachine` у root entity на parse-слое

**Evidence:** `test/unit/project-entity.test.ts:29` проверяет, что `validatePdm` отклоняет root entity с stateMachine (`PDM_SM_ROOT_STATE_MACHINE_FORBIDDEN`). Но Zod-схема (`src/parse/schema.ts:57`) **разрешает** `stateMachine` на любой entity. Это корректно по дизайну (parse — только shape), но нет теста, который подтверждает, что parse проходит, а validate ловит.

На самом деле тест `project-entity.test.ts:29` именно это и делает, но это интеграционный тест. Нет unit-теста на `validateStateMachine` в `validate-state-machine.test.ts` для `kind: 'root'`.

**Recommendation:** Добавить unit-тест в `validate-state-machine.test.ts` для `kind: 'root'` + stateMachine, чтобы правило было покрыто и на unit-уровне.

---

## Quick wins (можно сделать за 1 PR, без продуктового решения)

1. **Deduplicate `normalizeFrom`** — вынести в shared helper.
2. **Fix `'PDM_PARSE_DIR_INVALID'` literal** — использовать `ERROR_CODES` константу.
3. **Добавить missing unit tests** — composite keys, self-relation, multi-entity stateMachine, creation with `affects: []`, root entity stateMachine rejection.
4. **Ужесточить `PdmDirectoryIndexSchema`** — `version: z.literal('1')`.

## Изменения, требующие продуктового/архитектурного решения Влада

1. **`loadPdmDir` должен ли возвращать `ValidatedPdm`?** — меняет контракт потребителей (blueprint), нужен alignment.
2. **Перенос `ActorRef` из `@rntme/pdm`** — затрагивает типные импорты в `event-store`, `graph-ir-compiler`, `projection-consumer`. Нужно выбрать новый дом.
3. **Должен ли `@rntme/pdm` экспортировать `loadPdmDir` вообще?** — Согласно спеке project-first blueprint, загрузка directory layout — ответственность `@rntme/blueprint` (Track A). `loadPdmDir` в `@rntme/pdm` создаёт дублирование ответственности. Возможно, он должен быть internal или вообще удалён.

---

## Alignment с product vision и specs

- **Product vision:** Пакет выполняет свою роль "canonical entity/field/relation/state source" чётко. Поддержка `root`/`owned` entity kinds и `ownerService` корректно отражает project-first pivot (spec 2026-04-23).
- **Mutations spec (2026-04-14):** `stateMachine`, `deriveEventTypes`, creation transitions, affects-правила — все реализованы согласно спеке §2-3.
- **Gaps:** `docs/gaps/pdm-gaps.md` корректно перечисляет P0/P1/P2 gaps (Money, JSON/embedded, soft-delete, foreign-service-ref, migrations). Код не претендует на закрытие этих gaps — это соответствует MVP scope.
- **AGENTS.md §4 conventions:** `Result<T>`, branded types, error codes, no exceptions across boundaries — всё соблюдено.

## Test / build / lint summary

| Команда | Результат |
|---------|-----------|
| `pnpm -F @rntme/pdm test` | 10 files, 65 tests — **all pass** |
| `pnpm -F @rntme/pdm typecheck` | **clean** |
| `pnpm -F @rntme/pdm lint` | **clean** |
| `pnpm -F @rntme/pdm build` | **clean** |

Coverage не мерялась (vitest без `@vitest/coverage-v8` в devDeps), но по анализу исходников:
- Parse layer: хорошее покрытие (9 тестов).
- Structural validation: умеренное (7 тестов), не хватает edge cases.
- State-machine validation: хорошее (18 тестов).
- Resolvers: хорошее (8 тестов).
- Event types derivation: хорошее (9 тестов).
- `loadPdmDir`: **слабое** (2 теста).

## Definition of done for this audit

- [x] Полный обзор архитектуры, API, слоёв, зависимостей, типов, тестов, документации.
- [x] Список проблем с severity, evidence, impact, recommendation.
- [x] Разделение quick wins vs. architectural decisions.
- [x] Подтверждение соответствия product vision и specs.
- [x] Проверка build/test/lint.
- [x] Нет кода изменено (read-only audit).

**Статус:** Готов к заведению implementation tasks по quick wins и follow-up issues по архитектурным решениям.
