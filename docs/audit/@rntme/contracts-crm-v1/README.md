# Architecture audit — `@rntme/contracts-crm-v1`

This document mirrors the read-only architecture audit posted on Multica so it can be reviewed offline and linked from the repo.

| | |
|---|---|
| **Multica issue** | `RNT-216` (`94cb9620-d2a4-4257-9977-79a9363baf62`) |
| **Issue title** | Audit: package architecture — @rntme/contracts-crm-v1 |
| **Package / scope** | `@rntme/contracts-crm-v1` |
| **Verdict (summary)** | needs cleanup |
| **Audit comment id** | `b37e2f7c-355f-425e-b644-ad7881ff7acb` |
| **Audit comment date** | 2026-04-28 |

---

## Audit report

The sections below reproduce the audit comment body **verbatim** from Multica (formatting preserved).


## Архитектурный аудит @rntme/contracts-crm-v1

### Verdict: needs cleanup

Пакет структурно целостен и соответствует спецификации `crm-canonical-contract-design.md`, но содержит несколько проблем среднего/высокого уровня, которые создают риски при включении conformance-сценариев и развитии контрактов. Билд, тесты, линт и typecheck проходят зелёным.

---

### 🔴 High

#### 1. Conformance-assertions ссылаются на несуществующие символы
**Evidence:**
- `modules/crm/conformance/src/scenarios/assertions.ts:42` — `CRM_REFERENCES_JOB_NOT_FOUND` (должен быть `CRM_REFERENCES_ASYNC_JOB_NOT_FOUND`)
- `modules/crm/conformance/src/scenarios/assertions.ts:48` — `CRM_REFERENCES_JOB_NOT_FOUND` (тот же код)
- `modules/crm/conformance/src/scenarios/assertions.ts:55` — событие `AsyncJobCancelled` (в proto его нет; отменённые задачи порождают `AsyncJobFailed`)

**Impact:** При включении conformance-фреймворка сценарии упадут на этапе компиляции/рантайма, создавая ложное ощущение покрытия.

**Recommendation:** Исправить коды ошибок на `CRM_REFERENCES_ASYNC_JOB_NOT_FOUND`, заменить `AsyncJobCancelled` на `AsyncJobFailed` с нужным статусом.

#### 2. `layerOf` реализован через string-split — хрупко
**Evidence:**
- `packages/contracts/crm/v1/src/error-codes.ts:23` — `return code.split('_')[1] as CrmErrorLayer`

**Impact:** При изменении naming-конвенции (например, добавление префикса `CRM_INTERNAL_...`) функция сломается скрытно, так как нет тестов на неё.

**Recommendation:** Заменить на lookup по Set/Map или сгенерировать из `error-codes.json` на этапе сборки.

---

### 🟡 Medium

#### 3. Отсутствуют тесты на `isErrorCode` / `layerOf`
**Evidence:**
- `packages/contracts/crm/v1/test/error-codes.test.ts` — 7 тестов, все проверяют только список кодов, не runtime-helpers.
- Сравнение: `ai-llm/v1/test/error-codes.test.ts` содержит 2 дополнительных теста на эти функции.

**Impact:** Регрессии в runtime-поведении контрактов не ловятся CI.

**Recommendation:** Добавить тесты, аналогичные `ai-llm/v1`.

#### 4. `Rntme` экспортируется как тип, но undefined в runtime
**Evidence:**
- `packages/contracts/crm/v1/src/index.ts:4` — `export type { Rntme } from './proto.gen.js'`
- Runtime: `import { Rntme } from '@rntme/contracts-crm-v1'; console.log(Rntme)` → `undefined`

**Impact:** Потенциальная путаница для потребителей, ожидающих объект пространства имён.

**Recommendation:** Либо удалить runtime-экспорт (оставить только type), либо экспортировать `rntme` как значение. Требует согласования с identity/ai-llm.

#### 5. Версия `0.0.0` и `private: true`
**Evidence:**
- `packages/contracts/crm/v1/package.json` — `"version": "0.0.0"`, `"private": true`

**Impact:** Отсутствие семантического версионирования затрудняет понимание stability guarantee для downstream-модулей.

**Recommendation:** Определить политику версионирования контрактных пакетов (pre-release tags, alpha/beta).

#### 6. Сгенерированные proto-файлы (~2.4 МБ) коммитятся в репозиторий
**Evidence:**
- `packages/contracts/crm/v1/dist/proto.gen.js` (~1.8 MB)
- `packages/contracts/crm/v1/dist/proto.gen.d.ts` (~614 KB)
- `.gitattributes` помечает их как generated, но они всё равно в истории

**Impact:** Раздувание репозитория, merge-conflicts при регенерации.

**Recommendation:** Вынести генерацию в `prebuild`/`prepare` скрипт; держать в `.gitignore` (требует решения по CI). **Требует архитектурного решения.**

---

### 🟢 Low

#### 7. README — boilerplate без CRM-специфики
**Evidence:**
- `packages/contracts/crm/v1/README.md` — общие примеры из шаблона, нет упоминания 34 RPC, событий, aggregates.

**Recommendation:** Добавить примеры импорта service-типов, enums, error codes, описание связи с proto-файлами.

#### 8. Отсутствует явная документация по 34 RPC
**Evidence:**
- `proto/crm.proto` содержит 34 метода, но README не описывает ни одного.

**Recommendation:** Сгенерировать или написать краткую сводку RPC-групп (Leads, Contacts, Opportunities и т.д.).

---

### Quick wins (можно сделать без согласования)

1. Исправить коды ошибок и события в conformance-assertions.
2. Добавить тесты на `isErrorCode` / `layerOf`.
3. Заменить `layerOf` на lookup по Set.
4. Обновить README CRM-специфичными примерами.

### Требуют решения Влада / архитектурного комитета

1. **Стратегия для generated proto-файлов:** коммитить vs генерировать при сборке. Влияет на CI, Docker, reproducible builds.
2. **Политика версионирования контрактов:** когда поднимать версию, какие stability guarantees давать downstream.
3. **Runtime-экспорт `Rntme`:** унифицировать поведение между contracts-пакетами.
4. **Conformance-сценарии:** все 35 сценариев — `pending` stubs. Нужен ли реальный conformance-фреймворк в ближайшем квартале?

---

### Итог

Пакет готов к использованию в текущем виде, но имеет скрытые риски (сломанные conformance-assertions, хрупкий `layerOf`, отсутствие тестов на runtime-helpers). Рекомендуется закрыть quick wins в рамках одного follow-up issue, а архитектурные вопросы вынести на обсуждение.
