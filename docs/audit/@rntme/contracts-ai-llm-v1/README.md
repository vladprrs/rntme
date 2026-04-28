# Architecture audit — `@rntme/contracts-ai-llm-v1`

This document mirrors the read-only architecture audit posted on Multica so it can be reviewed offline and linked from the repo.

| | |
|---|---|
| **Multica issue** | `RNT-215` (`f1d0c8cb-59dc-40d8-9105-c48354dc44ab`) |
| **Issue title** | Audit: package architecture — @rntme/contracts-ai-llm-v1 |
| **Package / scope** | `@rntme/contracts-ai-llm-v1` |
| **Verdict (summary)** | needs cleanup — пакет структурно здоров, но есть type-safety пробелы, тестовые дыры и cross-package несоответствия, кото |
| **Audit comment id** | `079963bc-1073-4622-8d42-5585d6a3c82f` |
| **Audit comment date** | 2026-04-28 |

---

## Audit report

The sections below reproduce the audit comment body **verbatim** from Multica (formatting preserved).


## Архитектурный аудит @rntme/contracts-ai-llm-v1

**Verdict:** needs cleanup — пакет структурно здоров, но есть type-safety пробелы, тестовые дыры и cross-package несоответствия, которые нужно закрыть до первого vendor-модуля.

---

### Проблемы

#### 1. HIGH — Plain-string поля в местах, где нужны enum
**Evidence:** proto/ai_llm.proto:133, 280, 310, 470, 514 — tool_choice, Message.role, ThreadItem.role, response_format объявлены как string.
**Impact:** Каждый vendor-модуль будет изобретать свои константы. Нарушает цель canonical contract — быть единым типизированным surface. Сейчас нет единого источника truth для значений вроде "auto"|"required"|"none".
**Recommendation:** Ввести enum ToolChoice, MessageRole, ResponseFormat в proto. Обновить fixtures и тесты.

#### 2. HIGH — Пустые conformance-сценарии
**Evidence:** modules/ai-llm/conformance/src/scenarios/*.scenarios.ts — все 14 файлов экспортируют []. test/suite-shape.test.ts:24-28 явно проверяет, что массивы пусты.
**Impact:** Spec §12.2 требует конкретных сценариев per RPC. Vendor-модуль не может начать conformance без них. Сейчас skeleton не даёт реальной ценности.
**Recommendation:** Либо (a) заполнить сценарии минимальными stub-ами со status: pending и seed/action/assertion структурой, либо (b) создать follow-up issue на заполнение после landing @rntme/conformance-framework. Не оставлять пустыми — это замаскированный technical debt.

#### 3. MEDIUM — layerOf молча возвращает vendor для любого неизвестного кода
**Evidence:** src/error-codes.ts:29-34 — fallthrough без проверки.
**Impact:** Если внешний код сделает layerOf неизвестного кода, получит vendor вместо ошибки. Маскирует баги при дрейфе error-codes.
**Recommendation:** Изменить возвращаемый тип на ErrorLayer | null, вернуть null для неизвестных кодов. Добавить тест на invalid code.

#### 4. MEDIUM — Поле time_to_first_token в v1 proto
**Evidence:** proto/ai_llm.proto:196 — Duration time_to_first_token на aggregate Completion.
**Impact:** Spec §Q3 явно исключает streaming из v1. Наличие этого поля вводит implementerов в заблуждение — они будут ожидать, что streaming поддерживается или скоро появится.
**Recommendation:** Удалить поле из v1 (reserved = 10) или добавить комментарий. Второе — быстрый fix.

#### 5. MEDIUM — Несоответствие build-скриптов между contract-пакетами
**Evidence:** AI-LLM и Identity используют inline shell. CRM использует scripts/build.mjs.
**Impact:** Расхождение усложняет обслуживание workspace — фикс нужно делать в N местах по-разному.
**Recommendation:** Унифицировать: либо все на inline shell (просто), либо все на build.mjs (если нужна кросс-платформенность).

#### 6. MEDIUM — Отсутствие range-валидации в тестах
**Evidence:** progress_percentage (0-100), TokenUsage.total_tokens (должен быть >= sum частей), SamplingParams.temperature (0-2) — нет тестов на граничные значения.
**Impact:** Vendor-модули могут получать или генерировать невалидные значения, и contract не даёт им signal о допустимых диапазонах.
**Recommendation:** Добавить unit-тесты на граничные значения. Рассмотреть proto validation rules если в workspace появится protoc-gen-validate.

#### 7. LOW — Версия 0.0.0 у всех contract-пакетов
**Evidence:** package.json:3 — version 0.0.0.
**Impact:** Невозможно отследить breaking changes через semver. Workspace consumers не могут pin version.
**Recommendation:** Определить стратегию версионирования contract-пакетов. Предлагаю: 0.1.0 для v1 skeleton, 1.0.0 когда первый vendor-модуль проходит live-conformance.

#### 8. LOW — JSON import assertion в error-codes.ts
**Evidence:** src/error-codes.ts:1 — import with type json.
**Impact:** Некоторые bundler-конфигурации потребителей могут не поддерживать import assertions.
**Recommendation:** Заменить на readFileSync + JSON.parse или добавить fallback. Низкий приоритет — workspace target = Node 20.

---

### Quick wins (можно сделать без продуктового решения)
- Исправить layerOf -> ErrorLayer | null + тест
- Добавить комментарий к time_to_first_token или сделать reserved
- Унифицировать build-скрипт с CRM или Identity
- Добавить unit-тесты на invalid error code и enum sentinel values
- Добавить vitest.config.ts для консистентности с другими пакетами

### Требуют решения Влада / архитектурного комитета
- Нужны ли enum для tool_choice/role/response_format в v1, или string — осознанный trade-off?
- Когда и кем заполняются conformance-сценарии: сейчас (skeleton с pending-статусом) или после landing framework?
- Стратегия semver для contract-пакетов

---

### Что сделано хорошо
- Чистая структура, полностью повторяет pattern Identity/CRM.
- Все 35 тестов проходят, build/lint/typecheck — зелёные.
- 32 error-кода покрывают все 4 слоя (structural/references/consistency/vendor).
- Правильное разделение ai_llm.proto (service) и ai_llm-events.proto (events).
- Drift-тесты гарантируют 1:1 соответствие RPC <-> scenario-файл.
- Binary fixtures проверены на magic bytes и size <= 100KB.
- Зависимости минимальны: только @rntme/contracts-common-v1 + protobufjs.

---

### Готовность к DEV
План готов к DEV с оговоркой: перед началом первого vendor-модуля нужно закрыть HIGH-проблемы (#1 enum strings, #2 empty scenarios). Остальное — MEDIUM/LOW — можно фиксить параллельно. Рекомендую завести follow-up issue на заполнение conformance-сценариев с приоритетом blocker.
