# Architecture audit — `@rntme/bindings-http`

This document mirrors the read-only architecture audit posted on Multica so it can be reviewed offline and linked from the repo.

| | |
|---|---|
| **Multica issue** | `RNT-201` (`1e7ea5ee-10ee-4f7e-87ca-bc5d314db510`) |
| **Issue title** | Audit: package architecture — @rntme/bindings-http |
| **Package / scope** | `@rntme/bindings-http` |
| **Verdict (summary)** | needs cleanup |
| **Audit comment id** | `40269f3e-872a-410a-8bdb-3115a6637253` |
| **Audit comment date** | 2026-04-28 |

---

## Audit report

The sections below reproduce the audit comment body **verbatim** from Multica (formatting preserved).


## Архитектурный аудит @rntme/bindings-http

**Verdict: needs cleanup**

Пакет функционален (147 тестов, 26 suites, все проходят после сборки workspace), хорошо документирован (README с detailed file map и invariants), и соответствует product vision как runtime-слой для HTTP surface. Однако есть архитектурные риски и технический долг.

---

### Blocker

**1. Public API surface дрейф vs spec**
- **Evidence:** `src/index.ts:5-6` экспортирует `buildDefaultGraphIrCommandMap`, `buildDefaultGraphIrQueryMap`; `src/index.ts:18` экспортирует `correlationMiddleware`; `src/index.ts:1` экспортирует `VERSION`.
- **Impact:** Spec `2026-04-14-bindings-http-design.md` §3 утверждает, что единственная public функция — `createBindingsRouter`. Нарушение source of truth.
- **Recommendation:** Либо удалить лишние экспорты из `index.ts`, либо обновить spec с обоснованием. `correlationMiddleware` логически принадлежит `@rntme/runtime`.

---

### High

**2. Дублирование/расхождение типов с `@rntme/graph-ir-compiler`**
- **Evidence:** `src/executor-contract.ts` определяет собственные `CommandExecutor`, `QueryExecutor`, `CommandExecutionContext`, `CorrelationCtx`. Но `src/runtime/correlation-middleware.ts:3` импортирует `CorrelationCtx` из `@rntme/graph-ir-compiler`. `graph-ir-compiler/src/index.ts` экспортирует `CorrelationCtx` и `CommandExecutionError`.
- **Impact:** Риск рассинхронизации типов при изменениях в graph-ir-compiler.
- **Recommendation:** Импортировать `CommandExecutor`, `QueryExecutor`, `CorrelationCtx` напрямую из `@rntme/graph-ir-compiler`, либо создать shared contract package.

**3. `command-handler.ts` нарушает SRP (290 строк)**
- **Evidence:** `src/runtime/command-handler.ts` содержит: input extraction (both schema + inputFrom), pre-step orchestration, idempotency cache write, response rendering, redirect security, error mapping, metrics emission.
- **Impact:** Сложно тестировать изолированно, высокий риск regression при изменениях.
- **Recommendation:** Разбить на pipeline stages: `validateInputs → runPreSteps → executeCommand → renderResponse → writeIdempotencyCache`.

**4. Жестко закодированный `/api` префикс**
- **Evidence:** `src/router.ts:80` — `const stripped = p.replace(/^\/api/, '') || '/';`
- **Impact:** Пакет предполагает монтирование на `/api`, но это не документировано в public API. Сломается при другом mount path.
- **Recommendation:** Вынести в параметр `createBindingsRouter({ mountPath?: string })` или убрать stripping entirely (commandNameFromPath должен быть предоставлен caller'ом).

**5. `graphSpec/pdm/qsm: unknown` на границе пакета**
- **Evidence:** `src/router.ts:19-22` — все три параметра `unknown`.
- **Impact:** Нет compile-time гарантий совместимости с `@rntme/graph-ir-compiler` API.
- **Recommendation:** Принять как архитектурное решение (MVP), но добавить runtime validation или branded types.

---

### Medium

**6. IdempotencyCache — нет автоматической очистки**
- **Evidence:** `src/idempotency/cache.ts:63-68` — `pruneExpired` существует, но нигде не вызывается.
- **Impact:** Таблица `idempotency_cache` будет расти бесконечно.
- **Recommendation:** Добавить вызов `pruneExpired` в middleware или в startup, либо документировать, что очистка — ответственность caller'а.

**7. Error-to-HTTP mapping нерасширяем**
- **Evidence:** `src/runtime/error-to-http.ts:6-12` — жесткая таблица из 5 кодов. Новые `CommandExecutorErrorCode` из graph-ir-compiler не маппятся автоматически.
- **Impact:** Добавление нового error code требует изменения bindings-http.
- **Recommendation:** Сделать mapping extensible через опции `createBindingsRouter`, или перенести mapping в `@rntme/graph-ir-compiler`.

**8. Zod v4 vs v3 mismatch**
- **Evidence:** `package.json` — `zod: ^4.0.0`. Spec — `zod: ^3.23.0`.
- **Impact:** API v4 может отличаться (например, `z.ZodTypeAny` vs `z.ZodType`).
- **Recommendation:** Проверить совместимость и обновить spec, или зафиксировать exact version.

**9. Отсутствие e2e/golden тестов**
- **Evidence:** `test/` содержит unit + integration, но нет `test/e2e/`.
- **Impact:** Нет regression защиты на уровне полного request lifecycle через реальный Hono сервер.
- **Recommendation:** Добавить e2e suite с `demo/issue-tracker-api` как fixture.

**10. Adapter-типы в bindings-http**
- **Evidence:** `src/runtime-contract.ts` содержит `ExternalAdapterClient`, `AdapterResult`, `AdapterErrorCode`, `RetryPolicy`.
- **Impact:** Эти типы — контракт между runtime и module adapter, не HTTP bindings.
- **Recommendation:** Перенести в `@rntme/runtime` или `@rntme/contracts-common-v1`.

---

### Low

**11. VERSION = '0.0.0'**
- **Evidence:** `src/index.ts:1`. Бесполезна, `package.json#version` уже есть.
- **Recommendation:** Удалить или синхронизировать с package.json на build time.

**12. Тесты требуют предварительной сборки workspace**
- **Evidence:** 12 suites падают с `Failed to resolve entry for package` без `pnpm -r run build`.
- **Impact:** CI риск, onboarding friction.
- **Recommendation:** Добавить `build` как pre-requisite в CI, или настроить Vitest для resolve через TypeScript source.

---

### Quick wins (можно сделать без решения Влада)
1. Удалить `VERSION` из `index.ts`.
2. Добавить вызов `pruneExpired` в `idempotencyMiddleware` при cache miss.
3. Добавить JSDoc к `BindingsRouterOptions` о `/api` префиксе.
4. Обновить spec с актуальным public API.

### Решения, требующие Влада
1. **Public API boundary:** Следовать spec (только `createBindingsRouter`) или официально расширить surface?
2. **Command handler decomposition:** Разбить на pipeline stages или оставить как монолитный closure?
3. **Adapter contract ownership:** Где должны жить `ExternalAdapterClient` / `AdapterResult` типы?
4. **Error mapping strategy:** Extensible mapping или centralized registry?
5. **Auto-prune strategy:** Cron, middleware-side, или caller's responsibility?

---

### Соответствие product vision
Пакет четко попадает в vision как "runtime layer that turns validated blueprint into working APIs". Нет service-specific code. Хорошая документация и onboarding для следующего разработчика.

### Рекомендация по готовности к DEV
Пакет **готов к DEV с правками** после resolution blocker #1 и high-priority items #2-#5. Не требует полного переписывания.
