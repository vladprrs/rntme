# Architecture audit — `@rntme/contracts-identity-v1`

This document mirrors the read-only architecture audit posted on Multica so it can be reviewed offline and linked from the repo.

| | |
|---|---|
| **Multica issue** | `RNT-217` (`7e911548-7705-466d-9750-8e5e812508bf`) |
| **Issue title** | Audit: package architecture — @rntme/contracts-identity-v1 |
| **Package / scope** | `@rntme/contracts-identity-v1` |
| **Verdict (summary)** | needs cleanup |
| **Audit comment id** | `f195b793-6070-4059-821f-797ece6860f8` |
| **Audit comment date** | 2026-04-28 |

---

## Audit report

The sections below reproduce the audit comment body **verbatim** from Multica (formatting preserved).


## Архитектурный аудит `@rntme/contracts-identity-v1`

### 1. Verdict: **needs cleanup**

Архитектурная форма пакета верна и соответствует спецификации `2026-04-26-identity-canonical-contract-design.md`. Публичный API стабилен, тесты проходят, build/lint/typecheck чистые. Однако есть риски поддерживаемости: мёртвый код, отсутствие проверки синхронизации сгенерированных файлов с proto-источниками, и потенциальная проблема ESM/CJS в сгенерированных typings.

---

### 2. Обнаруженные проблемы

#### **HIGH** — `scripts/check-imports.mjs` — мёртвый код
- **Evidence:** файл существует (`packages/contracts/identity/v1/scripts/check-imports.mjs`), но не упомянут ни в одном `package.json#scripts`, не запускается в CI, не импортирован тестами.
- **Impact:** со временем оторвётся от актуального API; создаёт ложное ощущение coverage для импортов. Следующий разработчик может потратить время на поддержку неиспользуемого скрипта.
- **Recommendation:** удалить файл и директорию `scripts/`, либо если интеграционная проверка импортов нужна — завести отдельный task и добавить в `package.json#scripts` + CI.

#### **HIGH** — `import Long = require(\"long\")` в сгенерированном `proto.gen.d.ts`
- **Evidence:** строка 2 в `src/proto.gen.d.ts` и `src/proto.gen.js` содержит `import Long = require(\"long\")`. Пакет не декларирует `long` в `dependencies` / `devDependencies` (только транзитивно через `protobufjs`).
- **Impact:** в strict ESM-окружении или при использовании bundler'ов (vite, esbuild, rollup) этот CJS-require может сломать сборку потребителя. TypeScript с `moduleResolution: NodeNext` / `Bundler` может не разрешить этот импорт без явного `long` в зависимостях.
- **Recommendation:**
  1. Добавить `long` в `devDependencies` (или `dependencies`, если типы нужны потребителям).
  2. Либо перейти на `protobufjs` codegen без `long` (флаг `--no-long` в `pbjs`, если совместимость с 64-bit integers не критична для Identity-контракта — в спеке int64 не используется).
  3. Альтернатива: заменить `import Long = require(...)` на ESM-совместимый синтетический тип в post-generation script.

#### **MEDIUM** — Нет CI-проверки синхронизации `.proto` → `proto.gen.*`
- **Evidence:** `scripts/gen.mjs` есть, но в CI / pre-commit не проверяется, что сгенерированные файлы соответствуют `.proto`-источникам. Разработчик может изменить `.proto`, забыть запустить `proto:gen`, и закоммитить рассинхронизированные артефакты.
- **Impact:** drift между `.proto` (source of truth) и committed `src/proto.gen.{js,d.ts}`. Это нарушает инвариант "spec is source of truth".
- **Recommendation:** добавить в CI шаг `proto:gen` + `git diff --exit-code src/proto.gen.*` (или аналогичную проверку), чтобы fail happened при рассинхронизации.

#### **MEDIUM** — `src/index.ts` реэкспортирует примитивы из `@rntme/contracts-common-v1`
- **Evidence:** строки 26–35 в `src/index.ts` экспортируют `CanonicalRef`, `CommandContext`, `Name`, `ListRequest` и т.д. напрямую из `protoRoot.rntme.contracts.common.v1`.
- **Impact:** потребители могут импортировать common-примитивы из identity-пакета, создавая неявную зависимость. Если common-контракт изменится (v2), identity-пакет станет двойным источником truth — часть потребителей импортирует из common, часть из identity. Это нарушает границу ответственности.
- **Recommendation:** либо убрать реэкспорты common-примитивов из `index.ts` (потребители импортируют напрямую из `@rntme/contracts-common-v1`), либо явно задокументировать, что identity-пакет предоставляет "convenience re-exports" и добавить тест, проверяющий, что они идентичны common-экспортам.

#### **MEDIUM** — Тесты не покрывают прямые экспорты `src/index.ts`
- **Evidence:** все 19 тестов (`entities.test.ts`, `events.test.ts`, `service-shape.test.ts`, `error-codes.test.ts`) обращаются к типам через `proto.rntme.contracts.identity.v1.*` или `errorCodes`. Ни один тест не импортирует `User`, `Organization`, `CanonicalRef` напрямую из `@rntme/contracts-identity-v1`.
- **Impact:** если `index.ts` сломается (например, реэкспорт common-типов перестанет работать из-за изменения в protobufjs-генерации), это не будет поймано тестами пакета.
- **Recommendation:** добавить тест `test/exports.test.ts`, который импортирует каждый символ из `src/index.ts` и проверяет, что он truthy и имеет ожидаемый тип (`typeof User === 'function'` и т.п.).

#### **LOW** — `version: \"0.0.0\"` не несёт смысла
- **Evidence:** `package.json#version` равен `0.0.0`, хотя пакет приватный и не публикуется в npm.
- **Impact:** минимальный, но при использовании `workspace:*` в downstream-пакетах версия может появляться в lockfile / bundle analysis.
- **Recommendation:** установить `version: \"0.1.0\"` или `\"1.0.0\"`, чтобы соответствовать contract version `v1`.

#### **LOW** — Отсутствуют поля `repository`, `bugs`, `homepage` в `package.json`
- **Evidence:** `package.json` не содержит metadata-ссылок на монорепозиторий.
- **Impact:** при навигации через `npm info` / IDE package viewer нет быстрого перехода к исходникам.
- **Recommendation:** добавить стандартные monorepo-поля (см. пример в `@rntme/contracts-common-v1` — там тоже нет, так что это workspace-wide pattern, который стоит зафиксировать отдельным issue).

---

### 3. Quick wins (можно сделать без продуктового решения)

1. **Удалить `scripts/check-imports.mjs`** и пустую директорию `scripts/`, если не нужен.
2. **Добавить `long` в `devDependencies`** как явную зависимость.
3. **Добавить `test/exports.test.ts`** для прямых экспортов `index.ts`.
4. **Обновить `version`** с `0.0.0` на `0.1.0`.
5. **Добавить CI-шаг** `proto:gen` + `git diff --exit-code` для проверки синхронизации.

---

### 4. Решения, требующие Влада / архитектурного решения

1. **Реэкспорты common-примитивов из identity-пакета:** оставлять как convenience-exports или заставить потребителей импортировать из `@rntme/contracts-common-v1`? Это вопрос границ ответственности и discoverability API.
2. **Стратегия `long` / 64-bit integers:** нужен ли `long` в Identity-контракте? В текущей спецификации int64 не используется. Если не нужен — можно перейти на `--no-long` в `pbjs` и упростить ESM-совместимость.
3. **Политика версионирования contract-пакетов:** `0.0.0` vs семантическое версионирование, даже для private workspace-пакетов.

---

### 5. Соответствие product vision и спецификациям

- **Спецификация:** `2026-04-26-identity-canonical-contract-design.md` — реализована полностью. 24 RPC, 6 сущностей, 17 событий, 18 error codes, drift detection в conformance — всё на месте.
- **Product vision:** пакет точно попадает в rntme positioning как "safe runtime for AI-generated business workflow apps" — canonical contract даёт агентам bounded target для генерации vendor-модулей.
- **Единственный архитектурный риск:** если `@rntme/conformance-framework` не появится в ближайшее время, пустые stub-сценарии в `modules/identity/conformance/` могут стать привычкой, и drift между contract и conformance станет менее значимым, чем кажется (сейчас drift-test работает, но scenario-content пуст). Это не проблема самого пакета, а риск downstream.

---

**Итог:** пакет архитектурно здоров, соответствует спеке и vision. Основные риски — мёртвый код, ESM/CJS friction в сгенерированных typings, и отсутствие автоматической проверки sync proto ↔ generated. Все фиксы нетривиальны, но не требуют переписывания контракта.
