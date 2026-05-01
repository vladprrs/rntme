# Architecture audit — `@rntme/qsm`

This document mirrors the read-only architecture audit posted on Multica so it can be reviewed offline and linked from the repo.

| | |
|---|---|
| **Multica issue** | `RNT-209` (`afe29a6f-0a47-418f-9eeb-0974f1e49038`) |
| **Issue title** | Audit: package architecture — @rntme/qsm |
| **Package / scope** | `@rntme/qsm` |
| **Verdict (summary)** | needs cleanup |
| **Audit comment id** | `16c037fc-26b8-4c55-91a5-87405c93eb66` |
| **Audit comment date** | 2026-04-28 |

---

## Audit report

The sections below reproduce the audit comment body **verbatim** from Multica (formatting preserved).


# Audit Report: @rntme/qsm

## Verdict: needs cleanup

Пакет имеет чёткую архитектуру и хорошее покрытие unit-тестами (109 тестов, все зелёные), но накопил технический долг в четырёх областях: неполная поддержка `derived` backing, слабый `loadQsmDir` для project-first модели, недостаток интеграционных тестов и «мёртвый вес» в схеме (`pathPrefix`).

---

## Обнаруженные проблемы

### 1. [HIGH] `derived` backing — фасад без runtime-логики
**Severity:** blocker для tier 2, high для MVP.
**Evidence:**
- `src/derive/handler.ts:67` — `deriveProjectionHandler` делает `continue` на `backing !== 'entity-mirror'`
- `src/derive/handler.ts:162-188` — `deriveDerivedProjectionSpecs` возвращает только метаданные (`graphId`, `tableName`), но не спецификацию обработчика событий
- DDL для derived генерируется (`src/derive/ddl.ts:101-114`), но projection-consumer не сможет применить события
**Impact:** Пользователь объявляет `backing: "derived"`, получает валидный DDL, но runtime не обновляет projection. Нарушение контракта «valid artifact → runnable service».
**Recommendation:** Либо довести `derived` до рабочего handler-спека (требует решения по D5 / graph-IR compilation), либо полностью убрать из Zod-схемы до готовности tier 2. Сейчас статус «парсится, но не валидируется и не derivaется» — худший из вариантов.

### 2. [HIGH] Отсутствует интеграционное и e2e покрытие
**Evidence:**
- `find packages/artifacts/qsm/test -type d` → только `unit/`, `fixtures/`
- `test/smoke.test.ts` — всего 2 теста, покрывает только `entity-mirror` + пустые relations
- Нет тестов на взаимодействие с `@rntme/graph-ir-compiler` (JOIN-цепочки) или `@rntme/projection-consumer`
**Impact:** Изменения в `QsmResolver` или `ResolvedRelation` могут сломать compiler/consumer без падения QSM-тестов. Регресс relations-migration (2026-04-16) не защищён на уровне QSM.
**Recommendation:** Добавить `test/integration/` с сценариями «QSM + PDM → resolver → JOIN chain»; `test/e2e/` с полным pipeline через `@rntme/runtime`.

### 3. [MEDIUM] `loadQsmDir` недостаточно надёжен для project-first
**Evidence:**
- `src/load/load-dir.ts:15-68` — ловит любую ошибку как `QSM_PARSE_DIR_INVALID` без контекста файла
- Нет проверки, что имя файла `.json` совпадает с внутренним именем projection
- `QsmDirectoryIndexSchema` (`src/load/load-dir.ts:8-13`) принимает `relations: z.record(z.string(), z.unknown())` — типизация теряется до парсинга
- `test/unit/load-dir.test.ts` — только 2 теста (happy path + missing `qsm.json`)
**Impact:** В project-first модели с десятками сервисов ошибка в одном projection-файле даст бесполезное сообщение без имени файла.
**Recommendation:** Парсить каждый projection-файл отдельно с `path` в ошибке; валидировать consistency имени файла и ключа в `projections`.

### 4. [MEDIUM] `pathPrefix` — мёртвый вес в схеме
**Evidence:**
- `src/parse/schema.ts:15` — `pathPrefix: nonEmptyString.optional()`
- `src/types/artifact.ts:25` — присутствует в `ProjectionSource`
- `src/resolvers/qsm-resolver.ts:64-66` — копируется в `ResolvedProjection`
- Нигде не валидируется, не используется в `derive/*`, не упоминается в project-first spec (2026-04-23)
**Impact:** Путаница для авторов артефактов; ложное ощущение поддержки feature.
**Recommendation:** Либо удалить до появления спеки, либо задокументировать семантику и добавить валидацию. **Требует решения Влада.**

### 5. [MEDIUM] Некорректное имя error code `QSM_DERIVED_EXPOSED_OUT_OF_RANGE`
**Evidence:**
- `src/validate/structural.ts:42-47` — код используется когда `derived` projection не имеет explicit `table`
- `src/types/result.ts:63` — название намекает на проблему с `exposed`, а не с `table`
**Impact:** Машинные потребители ошибок (CLI, UI) показывают misleading message.
**Recommendation:** Добавить новый код `QSM_DERIVED_TABLE_MISSING`, задеприкейтить старый в комментарии (коды append-only по конвенции).

### 6. [MEDIUM] Cross-ref молча пропускает relations с derived-участниками
**Evidence:**
- `src/validate/cross-ref.ts:125` — `if (!isEntityMirrorSource(sourceProj.source)) continue`
- `src/validate/cross-ref.ts:139` — аналогично для target projection
**Impact:** Relation, указывающая на derived projection, не проходит B2 validation. Это пропускает невалидные relations в `ValidatedQsm`, что сломается в runtime graph-ir-compiler.
**Recommendation:** Либо явно запретить relations на derived projections с кодом `QSM_XREF_RELATION_DERIVED_NOT_SUPPORTED`, либо определить и реализовать семантику. **Требует решения Влада.**

### 7. [MEDIUM] Жёсткая зависимость на собранный `@rntme/pdm` — нет mock-резолвера
**Evidence:**
- До `pnpm -r run build` 9 из 14 тестовых файлов падают с `Failed to resolve entry for package "@rntme/pdm"`
- Все тесты cross-ref, derive и smoke импортируют реальный `@rntme/pdm`
**Impact:** Разработка QSM требует сборки всего workspace; замедляет итерации; риск циклической зависимости, если PDM когда-либо потребует типы из QSM.
**Recommendation:** Создать `test/helpers/mock-pdm.ts` с фабрикой минимального `PdmResolver` для unit-тестов QSM, не требующих реальных PDM-фикстур.

### 8. [LOW] `parseQsm` использует `QSM_PARSE_SCHEMA_VIOLATION` для JSON syntax error
**Evidence:** `src/parse/parse.ts:14-26`
**Impact:** Невозможно отличить «сломанный JSON» от «неверная схема».
**Recommendation:** Добавить код `QSM_PARSE_JSON_INVALID`.

### 9. [LOW] `defaultTableName` — риск коллизий для non-ASCII имён
**Evidence:** `src/validate/structural.ts:170` — `projection_${projectionName.toLowerCase()}`
**Impact:** Для турецкого `I` (dotless/dotful) или кириллических имён `toLowerCase()` может вести себя неожиданно в разных locale.
**Recommendation:** Использовать `toLowerCase('en-US')` или задокументировать ограничение.

---

## Quick wins (можно сделать без product-решения)
1. Добавить `QSM_PARSE_JSON_INVALID` и `QSM_DERIVED_TABLE_MISSING` (с депрекацией старого).
2. Создать `test/helpers/mock-pdm.ts` и мигрировать часть unit-тестов на него.
3. Улучшить `loadQsmDir`: добавить имя файла в ошибки парсинга.
4. Добавить 2–3 интеграционных теста в `test/integration/`.
5. Задокументировать `toLowerCase('en-US')` или применить фикс.

## Требуют решения Влада
1. **Статус `derived` backing**: полностью убрать из parser (до tier 2), или довести handler-спеку до runnable state?
2. **Семантика `pathPrefix`**: удалить или спека + реализация?
3. **Relations с derived projections**: запретить явно или определить семантику?
4. **Интеграционные тесты**: заводить в `@rntme/qsm` или в отдельном cross-package test-пакете?

---

## Соответствие product vision и specs
- Пакет реализует спеку relations-migration (2026-04-16) корректно: B2 cross-validation, новые error codes, структура `relations`.
- Поддерживает project-first модель частично: `loadQsmDir` загружает multi-file QSM, но недостаточно надёжен для production authoring.
- Не противоречит mutations spec (2026-04-14): `entity-mirror` projection contract реализован полностью.
- Нарушает принцип «valid artifact → runnable service» из-за фасадности `derived` backing.
