# Architecture audit — `@rntme/ui-runtime`

This document mirrors the read-only architecture audit posted on Multica so it can be reviewed offline and linked from the repo.

| | |
|---|---|
| **Multica issue** | `RNT-213` (`1ea545da-e944-488b-9c13-bdbeff11cc9d`) |
| **Issue title** | Audit: package architecture — @rntme/ui-runtime |
| **Package / scope** | `@rntme/ui-runtime` |
| **Verdict (summary)** | needs cleanup — архитектура верная, но накопился значительный implementation debt: дублирование логики, отсутствие lint, |
| **Audit comment id** | `4bf08867-b20a-4308-adb8-fdfb46479fe2` |
| **Audit comment date** | 2026-04-28 |

---

## Audit report

The sections below reproduce the audit comment body **verbatim** from Multica (formatting preserved).


## Audit Report: @rntme/ui-runtime

**Verdict:** needs cleanup — архитектура верная, но накопился значительный implementation debt: дублирование логики, отсутствие lint, type mismatch и неполное покрытие тестами.

---

### 1. BLOCKER

**B1. React 19 + @types/react 18 version mismatch**
- **Evidence:** `package.json` declares `"react": "^19.2.5"`, `"react-dom": "^19.2.5"`, но `"@types/react": "^18.3.3"`, `"@types/react-dom": "^18.3.0"`.
- **Impact:** React 19 изменил типы (например, `ReactElement`, `JSX`, `ref` forwarding). @types/react@18 не покрывает новые API и может давать ложные type errors или, наоборот, пропускать реальные. Уже вызывало `TS2307` / `TS2345` при сборке до того как `@rntme/ui` был собран.
- **Recommendation:** Поднять `@types/react` и `@types/react-dom` до версий, совместимых с React 19 (≥19.0.0), или использовать встроенные типы React 19 (если пакет это поддерживает).

---

### 2. HIGH

**H1. Отсутствие ESLint — единственный пакет в `packages/` без lint**
- **Evidence:** `find packages -maxdepth 2 -name "eslint.config.mjs"` — 13 пакетов имеют конфиг, `packages/runtime/ui-runtime` и `packages/artifacts/ui` — нет. `package.json#scripts` не содержит `"lint"`.
- **Impact:** Нет проверки на unused vars, inconsistent type imports, no-console. Код со временем будет дрейфовать от conventions остального монорепо.
- **Recommendation:** Скопировать `eslint.config.mjs` из `packages/runtime/runtime/` и добавить `"lint": "eslint \"src/**/*.ts\" \"test/**/*.ts\""` в `package.json#scripts`.

**H2. Массовое дублирование логики между client-модулями**
- **Evidence:**
  - `buildUrl` + `resolveParamValue` — дублируется в `driver.ts:15` и `entry.tsx:10/17` (идентичная логика подстановки `{param}` и `$state` refs).
  - `paramsFromState` обработка — дублируется в `driver.ts:86,103`, `registry.ts:53,74` (навигация + команды).
  - Action dispatch (navigation/refetch/command) — дублируется в `driver.ts:83` и `registry.ts:43`.
  - `fetchEndpoint` — есть в `driver.ts:48` и `entry.tsx:60`, но `entry.tsx` не использует `driver.ts` вообще.
- **Impact:** Любое изменение в data fetching, action handling или URL building требует синхронизации в 3+ местах. Высокий риск рассинхронизации и багов.
- **Recommendation:** Вынести shared utilities (`buildUrl`, `resolveParamValue`, `dispatchAction`) в `client/shared.ts`. Либо удалить `driver.ts` как публичный API, если `entry.tsx` и `registry.ts` покрывают все use cases (но тогда нужно понять, зачем `driver.ts` экспортируется).

**H3. Неполное покрытие тестами — 5/9 файлов без прямых unit-тестов**
- **Evidence:**
  - Тесты есть: `server.test.ts` (6), `router.test.ts` (8), `screen-loader.test.ts` (3), `driver.test.ts` (7) = 24 теста.
  - Тестов нет: `registry.ts` (123 строки), `layout-manager.tsx` (47 строк), `entry.tsx` (161 строка — основной entry point SPA), `build.ts` (38 строк), `static-shell.ts` (15 строк).
  - Source: ~626 строк, Tests: ~329 строк. Соотношение ≈ 0.5:1.
- **Impact:** `entry.tsx` — критический путь загрузки SPA, но его логика (routing, data fetching on mount, store subscription, error handling) не покрыта unit-тестами. `registry.ts` — обработка всех пользовательских actions, тоже без тестов.
- **Recommendation:** Добавить unit-тесты для `registry.ts` (mock bridge, проверка dispatch navigate/refetch/command). Для `entry.tsx` — либо разбить на тестируемые хуки/функции, либо покрыть через e2e/playwright.

---

### 3. MEDIUM

**M1. Path traversal в `/assets/:file` — потенциально уязвимая проверка**
- **Evidence:** `server/index.ts:47` использует `!fp.startsWith(resolvedAssetsDir + sep)`.
- **Impact:** На Windows `resolve()` может давать разные разделители; `startsWith` не является canonical path traversal defense. Хотя `resolve()` нормализует `..`, edge cases возможны (symlinks, unicode normalization).
- **Recommendation:** Использовать `path.relative(resolvedAssetsDir, fp).startsWith('..')` или `!fp.startsWith(path.join(resolvedAssetsDir, sep))` после нормализации.

**M2. Отсутствие CSP и security headers в HTML shell**
- **Evidence:** `static-shell.ts` генерирует bare-bones HTML без `<meta http-equiv="Content-Security-Policy">`, `X-Frame-Options`, `Referrer-Policy`.
- **Impact:** XSS через внедрение inline scripts/styles, clickjacking через iframe embedding.
- **Recommendation:** Добавить базовый CSP (`default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'`) и `X-Frame-Options: DENY` (или `SAMEORIGIN`). Сделать конфигурируемым через `CreateAppOptions`.

**M3. Отсутствие Error Boundaries в React**
- **Evidence:** `layout-manager.tsx` рендерит `<Renderer>` без `ErrorBoundary`. `entry.tsx` оборачивает в провайдеры, но нет catch для render errors.
- **Impact:** Любой exception в json-render компоненте или shadcn виджете приведет к unmount всего SPA и белому экрану.
- **Recommendation:** Обернуть `<Renderer>` в `React.ErrorBoundary` (или встроенный в json-render механизм, если есть) и добавить fallback UI.

**M4. `driver.ts` экспортируется, но `entry.tsx` его не использует**
- **Evidence:** `client/index.ts` экспортирует `createDriver`, но `entry.tsx` реализует свою версию `fetchEndpoint` и `buildUrl`.
- **Impact:** Неясно, является ли `driver.ts` публичным API для внешних потребителей или dead code. Если публичный — он должен быть протестирован и использоваться внутри. Если нет — следует удалить или сделать internal.
- **Recommendation:** Принять архитектурное решение: либо `driver.ts` становится единственным источником truth для data fetching, и `entry.tsx` его использует; либо `driver.ts` удаляется, а его тесты переносятся на `entry.tsx`.

**M5. `globalThis.alert` — неприемлемо для production**
- **Evidence:** `driver.ts:125,135` и `registry.ts:96,115` используют `globalThis.alert?.(text) ?? console.error(text)`.
- **Impact:** В production alert блокирует UI thread и не дает структурированной информации об ошибках. Невозможно интегрировать с Sentry/logging.
- **Recommendation:** Заменить на callback-based error reporting (`onActionError?: (error: ActionError) => void`) в `DriverOptions` и `RuntimeBridge`.

---

### 4. LOW

**L1. Версия пакета `0.0.0`**
- **Recommendation:** Выставить `0.1.0` или синхронизировать с workspace versioning strategy.

**L2. `build.ts` использует `execSync` без timeout**
- **Evidence:** `build.ts:30` вызывает `npx @tailwindcss/cli` через `execSync` с `{ stdio: 'inherit' }`.
- **Impact:** Блокирует event loop на неопределенное время. Если Tailwind CLI зависнет, build зависнет.
- **Recommendation:** Добавить `timeout: 60_000` или перейти на programmatic Tailwind API (v4 поддерживает `@tailwindcss/postcss` или direct JS API).

**L3. `vitest.config.ts` использует `environment: 'node'` для browser-кода**
- **Evidence:** Все client-модули (router, driver, screen-loader, registry) — браузерный код, но тесты запускаются в Node.
- **Impact:** Нет проверки реального DOM поведения, `window`, `document`, `fetch` — моки. Может пропускать browser-specific баги.
- **Recommendation:** Для unit-тестов с моками это ок, но нужны integration/e2e тесты в реальном браузере (playwright/cypress) для `entry.tsx` и `layout-manager.tsx`.

**L4. SPA fallback редиректит на первый маршрут при 404**
- **Evidence:** `entry.tsx:143-147` — если `window.location.pathname` не матчится, редиректит на `patterns[0]`.
- **Impact:** Непредсказуемое поведение для пользователя, зашедшего по невалидной ссылке. Нет отображения 404-страницы.
- **Recommendation:** Добавить compiled 404 screen в artifact и матчить на `*` или показывать fallback.

**L5. `screen-loader.ts` — кеш без инвалидации**
- **Evidence:** `Map`-based cache без TTL, max size или version-based invalidation.
- **Impact:** При обновлении deployed artifact клиенты с открытым SPA будут видеть stale screens/layouts до перезагрузки.
- **Recommendation:** Добавить `?v=<artifactVersion>` к URL при загрузке, или expose `clearCache()` метод.

---

### 5. Quick wins (можно сделать без продуктового решения)

1. Исправить `@types/react` / `@types/react-dom` версии.
2. Добавить `eslint.config.mjs` и `lint` script.
3. Добавить CSP meta tag и `X-Frame-Options` в `static-shell.ts`.
4. Исправить path traversal defense в `server/index.ts`.
5. Вынести `buildUrl` / `resolveParamValue` в shared utility.
6. Выставить `version: "0.1.0"` в `package.json`.
7. Добавить `timeout` к `execSync` в `build.ts`.

### 6. Требуют продуктового/архитектурного решения Влада

1. **Судьба `driver.ts`:** публичный API или internal? Если публичный — почему `entry.tsx` его не использует? Нужен ли он вообще при наличии `registry.ts` + `entry.tsx`?
2. **Стратегия ошибок в UI:** Заменить `alert()` на структурированный error callback? Какой UX ожидается для action errors (toast, inline, modal)?
3. **Покрытие тестами:** Нужны ли integration/e2e тесты для SPA (playwright)? Или достаточно unit-тестов + demo smoke tests?
4. **Error Boundaries:** Нужен ли fallback UI при render crash? Какой (generic error screen, retry button)?
5. **404-страница:** Должна ли быть compiled 404 screen в artifact, или достаточно редиректа?
6. **Cache invalidation:** Нужна ли runtime cache invalidation для screen/layout loader?

---

### 7. Соответствие product vision и specs

- **Alignment:** Пакет точно соответствует спеке `2026-04-16-ui-artifact-v2-design.md` §4 (runtime architecture). Server/client split, lazy loading, json-render/shadcn stack — всё на месте.
- **Gap:** Спека §4 упоминает `layout-level data fetching`, которого нет в коде (README это честно признает в Out of scope). Спека §6 — «No SSR», «No auth» — тоже соблюдены.
- **Risk:** Дублирование логики и отсутствие lint создают риск, что при масштабировании до 50+ экранов (цель спеки) поддержка станет болезненной.
