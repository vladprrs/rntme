# Architecture audit — `@rntme-cli/platform-http`

This document mirrors the read-only architecture audit posted on Multica so it can be reviewed offline and linked from the repo.

| | |
|---|---|
| **Multica issue** | `RNT-228` (`f9b67162-9df9-4b8f-90ea-98d0c256ac30`) |
| **Issue title** | Audit: package architecture — @rntme-cli/platform-http |
| **Package / scope** | `@rntme-cli/platform-http` |
| **Verdict (summary)** | needs cleanup |
| **Audit comment id** | `17571ba7-144c-4570-af1a-f908571f5a88` |
| **Audit comment date** | 2026-04-28 |

---

## Audit report

The sections below reproduce the audit comment body **verbatim** from Multica (formatting preserved).


# Audit Report: @rntme-cli/platform-http

## Verdict: needs cleanup (архитектурный риск)

Пакет выполняет свою функцию — HTTP-сервер платформы с REST API и SSR UI, — но накопил значительный технический долг и имеет архитектурные риски, особенно в области смешения слоев и масштабируемости.

---

## High Severity

### 1. God object `createApp` и смешение ответственности
**Evidence:** `src/app.ts:69-250`
**Impact:** Функция `createApp` (~180 LOC) создаёт middleware, auth-провайдеры, маршруты, фоновые циклы, планировщик деплоя и управление транзакциями. Это нарушает SRP и делает тестирование изоляции невозможным без полной инициализации.
**Recommendation:** Разделить на фабрики: `createApiApp()`, `createUiApp()`, `createBackgroundJobs()` уже есть, но `createApp` всё равно их связывает. Внедрить composition root отдельно от wiring-логики.

### 2. Выполнение деплоя внутри HTTP-процесса
**Evidence:** `src/app.ts:106-112`, `src/deploy/executor.ts:62-168`
**Impact:** `runDeployment` запускается через `setImmediate()` в том же процессе, что и HTTP-сервер. Долгий деплой блокирует event loop, orphan-detector использует `setInterval`. При падении процесса теряются running-деплои.
**Recommendation:** Вынести executor в отдельный worker/queue (Bull, pg-boss, или отдельный процесс). Требует продуктового решения Влада.

### 3. In-memory rate limiter не работает в multi-process
**Evidence:** `src/middleware/rate-limit.ts:3-18`
**Impact:** `InMemoryRateLimiter` хранит счётчики в `Map`. При горизонтальном масштабировании (кластеризация, PM2, Kubernetes с несколькими репликами) лимит обходится.
**Recommendation:** Заменить на Redis-backed rate limiter или вынести за edge (CloudFlare, nginx). Требует продуктового решения.

### 4. `errorHandler` не логирует ошибки
**Evidence:** `src/middleware/error-handler.ts:54-63`
**Impact:** Все непойманные исключения превращаются в `{ error: { code: 'PLATFORM_INTERNAL', message: String(cause) } }` с HTTP 500, но **не логируются**. В production ошибки будут потеряны.
**Recommendation:** Добавить `logger.error({ err: cause }, 'unhandled error')` перед ответом. Quick win.

### 5. Неиспользуемая зависимость `@hono/zod-openapi`
**Evidence:** `package.json:33`, поиск по `src/` — нет импортов `@hono/zod-openapi`
**Impact:** OpenAPI-спекфикация (`src/openapi.ts`) написана руками в виде статического JSON. Зависимость ~100KB+ мёртвый груз.
**Recommendation:** Либо начать использовать `@hono/zod-openapi` для генерации спеки из Zod-схем, либо удалить зависимость. Quick win.

### 6. Dokploy-клиент просочился в platform-http
**Evidence:** `src/deploy/dokploy-client-factory.ts` (278 LOC)
**Impact:** Фабрика Dokploy-клиента, знание API-путей `/api/application.create`, парсинг ответов Dokploy — всё это живёт в `platform-http`, хотя есть отдельный пакет `@rntme-cli/deploy-dokploy`. Нарушает границы слоёв.
**Recommendation:** Перенести `createDokployClientFactory` и типы в `@rntme-cli/deploy-dokploy`. Требует продуктового решения.

### 7. `bodyLimit` middleware создаёт новый Request с потерей потока
**Evidence:** `src/middleware/body-limit.ts:34-41`
**Impact:** При chunked-передаче (нет `Content-Length`) middleware читает весь body в память, создаёт `new Blob(chunks)` и подменяет `c.req.raw`. Это потенциально удваивает потребление памяти и ломает streaming.
**Recommendation:** Использовать `hono/body-limit` из коробки или реализовать через tee-стрим. При невозможности — документировать ограничение.

---

## Medium Severity

### 8. Дублирование создания auth-провайдеров
**Evidence:** `src/app.ts:130-142` и `src/ui/app.tsx:100-112`
**Impact:** `ApiTokenProvider` и `WorkOSAuthKitProvider` создаются дважды: один раз для `/v1/*`, второй для UI. Конфигурация может рассинхронизироваться.
**Recommendation:** Создавать один раз в `createApp` и передавать в `createUiApp` через deps. Quick win.

### 9. `withOrgTx` скопирован в тестах и production
**Evidence:** `src/app.ts:79-93` vs `test/e2e/deploy-flow.test.ts:120-135`
**Impact:** Логика транзакций с `set_config('app.org_id', ...)` дублируется. Изменения в одном месте сломают другое.
**Recommendation:** Вынести в `@rntme-cli/platform-storage` или shared-утилиту. Quick win.

### 10. Разные типы `poolRepos` в `AppDeps` и `UiDeps`
**Evidence:** `src/app.ts:47-67` vs `src/ui/app.tsx:53-67`
**Impact:** `AppDeps['poolRepos']` включает `workosEventLog`, `UiDeps['poolRepos']` — нет. Несогласованность типов усложняет рефакторинг.
**Recommendation:** Выделить единый тип `PoolRepos` и использовать в обоих местах. Quick win.

### 11. `ops.ts` ready-check ломается на некоторых планах WorkOS
**Evidence:** `src/routes/ops.ts:33-39`
**Impact:** Проверка `workos` вызывает `listApiKeys`, которого может не быть в некоторых тарифах WorkOS. `/ready` будет возвращать `degraded` без реальной проблемы.
**Recommendation:** Заменить на `getOrganization` с известным ID или удалить WorkOS из readiness probe. Quick win.

### 12. CORS regex потенциально уязвим к ReDoS
**Evidence:** `src/middleware/cors.ts:14-16`
**Impact:** `new RegExp(...)` строится из пользовательского `PLATFORM_CORS_ORIGINS`. При сложном wildcard-шаблоне возможен ReDoS.
**Recommendation:** Заменить на явный список origins или на prefix-matching без regex. Quick win.

### 13. `log-redactor.ts` — слишком простые паттерны
**Evidence:** `src/deploy/log-redactor.ts:1-12`
**Impact:** Регекспы пропустят многие форматы секретов (base64-json, JWT, env-переменные с нестандартными именами).
**Recommendation:** Добавить dictionary-based redaction (известные ключи) + интегрировать с `pino.redact`. Quick win.

### 14. Отсутствие валидации query-параметров в UI-роутах
**Evidence:** `src/ui/app.tsx:139-164`, `365-400`
**Impact:** `c.req.param('orgSlug')` и `c.req.param('projSlug')` используются без валидации/экранирования. XSS-риск через slug (хотя hono/jsx экранирует, логика может сломаться при спецсимволах).
**Recommendation:** Добавить Zod-схемы для path/query параметров UI. Medium effort.

### 15. `tsconfig.json` не включает `test`, `tsconfig.check.json` включает
**Evidence:** `tsconfig.json:11`, `tsconfig.check.json:8`
**Impact:** Несогласованность: сборка не компилирует тесты, но typecheck проверяет. Может привести к "зелёному" билду с ошибками в тестах.
**Recommendation:** Использовать `tsconfig.check.json` как единственный источник truth для typecheck. Quick win.

---

## Low Severity

### 16. `index.ts` экспортирует только VERSION
**Evidence:** `src/index.ts:1`
**Impact:** Публичный API пакета фактически пуст. Все потребители (включая тесты) импортируют из внутренних модулей напрямую.
**Recommendation:** Определить публичный API: экспортировать `createApp`, `AppDeps`, `parseEnv`, `createLogger`. Или документировать, что пакет предназначен только для self-consumption.

### 17. Пропуск тестов при отсутствии Docker
**Evidence:** `test/e2e/*.test.ts` — все используют `describe.skipIf(!e2eContainersAvailable())`
**Impact:** В CI без Docker (или локально без Docker) e2e-тесты молча пропускаются. `passWithNoTests: true` в `vitest.config.ts` усиливает проблему.
**Recommendation:** Добавить CI-job с Docker, убрать `passWithNoTests: true` или сделать его false для e2e. Quick win.

### 18. Отсутствие unit-тестов для критичных middleware
**Evidence:** `test/unit/middleware/` — только `rate-limit.test.ts`, нет тестов для: `auth.ts`, `body-limit.ts`, `cors.ts`, `error-handler.ts`, `same-origin.ts`, `security-headers.ts`, `tx.ts`
**Impact:** Базовые механизмы безопасности и надёжности не покрыты unit-тестами.
**Recommendation:** Добавить unit-тесты для `same-origin`, `security-headers`, `error-handler`, `tx`. Medium effort.

### 19. Хардкод версии и режима
**Evidence:** `src/index.ts:1` (`VERSION = '0.0.0'`), `src/openapi.ts:8` (`version: '0.0.0'`), `src/deploy/build-deploy-config.ts:56` (`mode: 'preview'`)
**Impact:** Версия нигде не обновляется, режим деплоя всегда preview.
**Recommendation:** Загружать VERSION из `package.json` во время сборки, вынести `mode` в конфигурацию deploy target.

### 20. `workos-client.ts` — хак типов
**Evidence:** `src/auth/workos-client.ts:10-18`
**Impact:** Каст `as WorkOSClient` обходит типы SDK. При обновлении `@workos-inc/node` сломается silently.
**Recommendation:** Завести issue upstream в WorkOS или обернуть в свой adapter с явным интерфейсом.

---

## Quick Wins (можно сделать без продуктового решения)

1. Добавить логирование в `errorHandler`
2. Удалить `@hono/zod-openapi` или начать использовать
3. Вынести `withOrgTx` в shared-утилиту
4. Унифицировать тип `poolRepos`
5. Исправить `ops.ts` ready-check (убрать `listApiKeys`)
6. Заменить CORS regex на безопасный matching
7. Улучшить `log-redactor` (dictionary-based)
8. Экспортировать публичный API из `index.ts`
9. Добавить unit-тесты для middleware
10. Убрать `passWithNoTests: true` или ограничить его scope

## Требуют продуктового/архитектурного решения Влада

1. **Архитектура деплоя:** executor должен быть в отдельном worker/queue?
2. **Границы пакетов:** перенести Dokploy-клиент в `deploy-dokploy`?
3. **Масштабирование:** Redis-backed rate limiter или edge-based?
4. **API versioning:** стратегия для `/v2`, `/v3`?
5. **UI как отдельное приложение:** или оставить в том же сервере?
6. **Версионирование:** откуда брать `VERSION`? semantic versioning?

---

## Итог

Пакет **функционально работает**, но архитектурно находится на переломном моменте: смешение HTTP-слоя с деплоем, отсутствие масштабируемых механизмов (rate limit, queue), и дублирование логики создают риски при росте нагрузки и команды. Рекомендуется приоритизировать вынесение executor'а из HTTP-процесса и перенос Dokploy-специфики в `deploy-dokploy`.
