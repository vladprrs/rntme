# Architecture audit — `@rntme/pre-step-demo`

This document mirrors the read-only architecture audit posted on Multica so it can be reviewed offline and linked from the repo.

| | |
|---|---|
| **Multica issue** | `RNT-222` (`66c586e7-f7cf-465e-8123-2896b90e5105`) |
| **Issue title** | Audit: package architecture — @rntme/pre-step-demo |
| **Package / scope** | `@rntme/pre-step-demo` |
| **Verdict (summary)** | needs cleanup — функциональность работает (4/4 тестов зелёные), но есть архитектурный debt и gaps в документации/тестиро |
| **Audit comment id** | `c15f9ece-0f95-4217-ad14-5a1247ea1a0e` |
| **Audit comment date** | 2026-04-28 |

---

## Audit report

The sections below reproduce the audit comment body **verbatim** from Multica (formatting preserved).


## Audit Report: `@rntme/pre-step-demo`

**Verdict:** needs cleanup — функциональность работает (4/4 тестов зелёные), но есть архитектурный debt и gaps в документации/тестировании, которые блокируют использование демо как reference implementation для pre-step и callback bindings.

---

### Blocker (1)

**B1. Нет README и onboarding-документации**
- **Evidence:** файл `demo/pre-step-demo/README.md` отсутствует.
- **Impact:** Демо создано как reference implementation для pre-fetch middleware (plan #03, task 21), но без README следующий разработчик/agent не понимает: (a) что это демо проверяет, (b) какие артефакты за что отвечают, (c) как запустить локально, (d) какие invariants и gotchas. Сравнение: `demo/issue-tracker-api/README.md` — 254 строки с полным file map, quick start, API table, invariants, specs.
- **Recommendation:** Написать README со следующими секциями: Role in system (reference consumer of pre[] + callback bindings), File map, Quick start, API table (createOrder + stripeCallback), Invariants & gotchas (fake module contract, idempotency key chain), Specs cross-reference (`2026-04-19-platform-modules-integration-design.md` §7, §8). Следовать шаблону issue-tracker-api README.

---

### High (3)

**H1. Отсутствие тестов на failure scenarios pre-step**
- **Evidence:** `test/e2e/pre-step.test.ts` — только happy path (200 + idempotency replay). `test/e2e/callback.test.ts` — только 302 + 400 на missing param.
- **Impact:** Демо является единственным E2E-покрытием для pre-step middleware (bindings-http integration test `callback-binding.test.ts` был `describe.skip`ped, ultrareview-fixes §7). Без failure coverage нет уверенности, что circuit breaker, retry, timeout, error mapping работают корректно в полном стеке.
- **Recommendation:** Добавить E2E-тесты: (a) fake module returns UNAVAILABLE → ожидаем 503 + Retry-After, (b) fake module returns INVALID_ARGUMENT → ожидаем 400 с domain-pass-through code, (c) pre-step timeout (mock slow module) → 504, (d) idempotency key chain: второй вызов с тем же Idempotency-Key после module failure → должен повторить тот же запрос к модулю (vendor idempotency), (e) circuit breaker: N ошибок подряд → размыкание, мгновенный 503.

**H2. Fake module не реализует module contract**
- **Evidence:** `src/fake-payments-module.ts` — ручная сборка `grpc.Server`, нет `Health.Check` RPC, нет валидации webhook signature (неприменимо к fake, но нет документации что пропущено), нет dedup-store, нет graceful shutdown гарантий.
- **Impact:** Демо показывает "как не надо" делать module. Платформенный module contract (`2026-04-19-platform-modules-integration-design.md` §12) требует: `.proto`, `module.json`, health-check, idempotency forwarding, webhook dedup. Fake module игнорирует всё это.
- **Recommendation:** Либо (a) расширить fake module до минимального compliant stub'а с `Health.Check` и документировать как reference module skeleton, либо (b) явно задокументировать в README, что fake module — это **не** пример module implementation, а только transport stub для тестирования bindings-http pre-step middleware. Вариант (b) — quick win, но в долгосрочной перспективе нужен (a) для валидации module contract.

**H3. Отсутствие `seed.json` — демо стартует с пустым состоянием**
- **Evidence:** `artifacts/` не содержит `seed.json`. Сравнение: issue-tracker-api имеет seed с детерминированными данными.
- **Impact:** Демо нельзя использовать для smoke-тестирования без ручного создания заказа. Невозможно проверить read-prelude patterns (например, query `pending_flow` в P2 callback flow без seed — пустая таблица).
- **Recommendation:** Добавить `artifacts/seed.json` с 1–2 предзаполненными `Order` (в разных статусах) и 1 `Ack` для callback flow. Это позволит добавить E2E-тест на query-side read-prelude.

---

### Medium (5)

**M1. Дублирование test setup — нет shared helper'а**
- **Evidence:** `test/e2e/pre-step.test.ts:9-26` и `test/e2e/callback.test.ts:8-25` — идентичные 18 строк (artifactDir, protoPath, beforeAll, afterAll).
- **Impact:** DRY-нарушение. Изменение порта или пути к артефактам требует правки в двух местах.
- **Recommendation:** Вынести shared setup в `test/e2e/setup.ts` или `test/helpers/boot.ts`: `async function bootPreStepDemo(): Promise<{ running: RunningService; stopFake: () => Promise<void> }>`. Использовать в обоих test files.

**M2. Hardcoded network configuration без конфигурационной поверхности**
- **Evidence:** `'127.0.0.1:60051'` захардкожен в `src/server.ts:13`, `test/e2e/pre-step.test.ts:17`, `test/e2e/callback.test.ts:16`, `artifacts/manifest.json:7`.
- **Impact:** Порт-конфликты при параллельном запуске тестов или при запуске на машине где 60051 занят. Невозможно запустить два instance демо.
- **Recommendation:** Использовать `process.env.PAYMENTS_MODULE_PORT ?? '60051'` в `server.ts` и тестах. Для тестов — динамический free-port (например, `get-port` или `listen(0)`), или хотя бы переменная окружения.

**M3. Fake module игнорирует idempotency key**
- **Evidence:** `src/fake-payments-module.ts:29` — `call.metadata.get('rntme-idempotency-key').join(',')` считывается в переменную `idem`, но никогда не используется.
- **Impact:** Нарушает idempotency-key chain contract (`2026-04-19-platform-modules-integration-design.md` §7.3). В реальном модуле это привело бы к дублированию vendor-side side-effect'ов при retries.
- **Recommendation:** Добавить in-memory dedup-store в fake module: `Map<idempotencyKey, response>` с TTL ≥ 24h. Возвращать закэшированный `customerId` при повторном вызове с тем же ключом. Документировать в README, что fake module теперь имитирует vendor idempotency.

**M4. Arbitrary sleep в тесте — флакиность**
- **Evidence:** `test/e2e/pre-step.test.ts:48` — `await new Promise((r) => setTimeout(r, 100)); // Wait for cache write`.
- **Impact:** Cache write может занять >100ms на загруженной машине = flaky test.
- **Recommendation:** Заменить на polling или явную синхронизацию. Например, повторить fetch с `Idempotency-Replay` header в цикле с `setTimeout(10)` до max 1s, или добавить hook в runtime для ожидания cache write.

**M5. Отсутствие `lint` script в package.json**
- **Evidence:** `pnpm -F @rntme/pre-step-demo lint` → "None of the selected packages has a 'lint' script".
- **Impact:** Несоответствие workspace conventions (AGENTS.md §5). Код может содержать style issues не обнаруженные CI.
- **Recommendation:** Добавить `"lint": "eslint src test"` в package.json, создать `eslint.config.mjs` (или наследовать от корневого).

---

### Low (4)

**L1. `artifacts/shapes.json` пустой — мёртвый файл**
- **Evidence:** `{}`.
- **Impact:** Шум в артефактах. Не используется ни одним graph'ом (output = `row<CommandResult>`).
- **Recommendation:** Удалить файл и убрать `shapesRef` из `bindings.json` (если валидатор позволяет). Если требуется для runtime — оставить с комментарием в README почему пустой.

**L2. `artifacts/ui/` — пустые UI артефакты**
- **Evidence:** `artifacts/ui/index.json: { "pages": [] }`, `artifacts/ui/manifest.json` — layouts/routes пустые.
- **Impact:** Ненужные файлы для демо, которое тестирует только HTTP API + pre-step. UI не используется ни в тестах, ни в server.ts.
- **Recommendation:** Удалить `artifacts/ui/` директорию целиком, или добавить минимальный UI (1 страница с кнопкой "Create Order") чтобы демо было полноценным.

**L3. Известные drift'ы в артефактах (deferred из ultrareview-fixes)**
- **Evidence:** `docs/superpowers/specs/done/2026-04-23-ultrareview-fixes-design.md` §1 отмечает: (a) `artifacts/pdm.json` ↔ `artifacts/graphs/createOrder.json` nullable drift (`customerId` в PDM `nullable: false`, в graph `mode: nullable`), (b) `artifacts/bindings.json` `bindAs`/`bindTo` collision (`bindAs.name: "customerId"` совпадает с graph input name).
- **Impact:** Неконсистентность между PDM и graph signature. Валидатор текущей версии, по-видимому, пропускает (или это intentional согласно последним изменениям `pick`), но создаёт путаницу.
- **Recommendation:** Синхронизировать `customerId` в PDM и graph (сделать `nullable: true` в PDM, или `required` в graph + bindings). Для `bindAs` — использовать отличное от graph input name имя (например, `bindAs.name: "preCustomerId"`, `pick: "customerId"`), чтобы не было shadowing.

**L4. Нет Dockerfile**
- **Evidence:** issue-tracker-api имеет `Dockerfile`, pre-step-demo — нет.
- **Impact:** Нельзя запустить демо в контейнере для изолированного тестирования.
- **Recommendation:** Скопировать Dockerfile из issue-tracker-api с адаптацией (порт 3100, копирование `artifacts/` + `src/server.ts`).

---

### Quick Wins (можно сделать без продуктовых решений)

1. **Написать README** — максимум 1 час, высокий ROI.
2. **Добавить `lint` script + eslint config** — 15 минут.
3. **Вынести shared test setup** — 20 минут.
4. **Удалить пустые `shapes.json` и `artifacts/ui/`** — 5 минут.
5. **Заменить hardcoded порт на env var** — 10 минут.
6. **Убрать arbitrary sleep из теста** — 10 минут.
7. **Добавить `seed.json`** — 30 минут.

### Требуют продуктового/архитектурного решения Влада

1. **H2 (Fake module vs module contract)** — нужно ли превращать fake module в reference module skeleton, или явно документировать что это transport stub?
2. **H1 (Failure scenario coverage)** — нужны ли E2E-тесты на circuit breaker / retry / timeout в demo, или это ответственность `packages/bindings-http/test/`?
3. **H3 (Seed + read-prelude)** — нужно ли демо покрывать P2 callback flow полностью (initiate command + projection + callback + complete command), или текущий scope (только callback binding) достаточен?
4. **L3 (Artifact drift)** — какой source of truth для `customerId` nullable: PDM или graph signature?

---

### Соответствие product vision и specs

- Демо корректно реализует **Primitive P-1** (pre-fetch gRPC) и **Primitive P-2** (extended command binding для callback'ов) из `2026-04-19-platform-modules-integration-design.md`.
- Артефакты (`bindings.json`, `pdm.json`, `graphs/`) соответствуют формату spec.
- Проблема: демо не демонстрирует **полный P2 pattern** (initiate + pending_flow projection + callback + complete) — только callback binding изолированно. Это упущение, так как P2 pattern — один из ключевых selling points для платёжных интеграций / OAuth.

---

### Definition of Done для аудита

- [x] Полный обзор кода, артефактов, тестов, зависимостей.
- [x] Проверка specs cross-reference.
- [x] Запуск тестов (`pnpm -F @rntme/pre-step-demo test` → 4 passed).
- [x] Typecheck (`pnpm -F @rntme/pre-step-demo typecheck` → clean).
- [x] Сравнение с issue-tracker-api (reference demo).
- [x] Проверка соответствия vision.md и platform-modules-integration spec.

Файлы затронутые аудитом (read-only): нет — аудит не создаёт PR, только комментарий.
