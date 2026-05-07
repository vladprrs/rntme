# Architecture audit — `@rntme/platform-core`

This document mirrors the read-only architecture audit posted on Multica so it can be reviewed offline and linked from the repo.

| | |
|---|---|
| **Multica issue** | `RNT-227` (`ca378534-30c3-464e-939a-3ec303478aa8`) |
| **Issue title** | Audit: package architecture — @rntme/platform-core |
| **Package / scope** | `@rntme/platform-core` |
| **Verdict (summary)** | needs cleanup |
| **Audit comment id** | `480a686a-7626-4f62-a213-ddcde7349ee7` |
| **Audit comment date** | 2026-04-28 |

---

## Audit report

The sections below reproduce the audit comment body **verbatim** from Multica (formatting preserved).


## Verdict: needs cleanup

Архитектурные границы пакета чистые (domain → use-cases → repo-интерфейсы), нет циклических зависимостей, нет утечки инфраструктуры (pg/http) в домен. Но есть ряд проблем, которые нужно закрыть до того, как пакет станет основой для production API.

---

## Проблемы

### 🔴 High

**1. 6 неиспользуемых workspace-зависимостей в package.json**
- **Evidence:** `@rntme/pdm`, `@rntme/qsm`, `@rntme/bindings`, `@rntme/graph-ir-compiler`, `@rntme/seed`, `@rntme/ui` перечислены в `dependencies` (package.json:22–29), но ни один `import` из них не встречается ни в `src/`, ни в `test/`.
- **Impact:** Ложная купленность, замедление установки, риск версионных конфликтов при обновлении.
- **Fix:** Удалить все 6 пакетов из `dependencies`. Типы `PerFileDigests` и `ValidatedPublishBundle` используют `unknown`, поэтому реальные импорты не нужны.

**2. `archiveOrgCascade` не покрыт unit-тестами внутри пакета**
- **Evidence:** `test/unit/use-cases/` не содержит `archive-org-cascade.test.ts`. Тесты есть только на уровне интеграции в `platform-storage`.
- **Impact:** Критичная бизнес-логика (каскадное архивирование орг-и) не защищена от регрессий на уровне домена.
- **Fix:** Добавить unit-тесты на `FakeStore`.

**3. `fast-check` объявлен в `devDependencies`, но не используется**
- **Evidence:** package.json:37, zero usage in tests.
- **Impact:** Мёртвый вес.
- **Fix:** Либо удалить, либо начать использовать property-based тесты (например, для `canonicalize`/`canonicalDigest`).

---

### 🟡 Medium

**4. `MembershipMirrorSchema` использует `z.string().min(1)` для роли вместо `RoleSchema`**
- **Evidence:** `src/schemas/entities.ts:40` vs `src/auth/scopes.ts:5`.
- **Impact:** Расхождение между схемой данных и бизнес-типами. Роль может быть любой строкой на уровне БД, что ломает инвариант `admin`/`member`.
- **Fix:** Использовать `RoleSchema` или явно задокументировать, почему роль — произвольная строка.

**5. `apiToken` в `CreateDeployTargetRequestSchema` не имеет верхней границы длины**
- **Evidence:** `src/schemas/deploy-target.ts:44` — `z.string().min(1)` без `.max()`.
- **Impact:** Потенциальный вектор DoS при отправке токена гигантского размера.
- **Fix:** Добавить `.max(2048)` или другое разумное ограничение.

**6. Версия `0.0.0` без механизма управления изменениями**
- **Evidence:** package.json:3. Пакет импортируется `platform-http`, `platform-storage`, `cli`.
- **Impact:** Любой breaking change в `platform-core` сломает зависимости незаметно.
- **Fix:** Нужно решение Влада — либо начать семвер, либо подключить changesets.

**7. Нет настройки coverage в vitest**
- **Evidence:** `vitest.config.ts` — нет `coverage` блока.
- **Impact:** Невозможно измерить покрытие, сложно находить слепые зоны.
- **Fix:** Добавить `@vitest/coverage-v8` и пороговые значения.

---

### 🟢 Low

**8. README ссылается на документы, которых нет в репозитории**
- **Evidence:** README.md:16–17 — `docs/history/specs/historical/...` и `docs/history/specs/active-rationale/2026-04-24-...`.
- **Fix:** Уточнить путь или добавить ссылки на внешний репозиторий.

**9. `BlobStore` в доменном пакете содержит `presignedGet`**
- **Evidence:** `src/blob/store.ts:30`.
- **Impact:** Инфраструктурная деталь (presigned URL) просачивается в домен.
- **Fix:** Либо вынести в отдельный инфраструктурный интерфейс, либо задокументировать как допустимый seam.

**10. `./testing` сабпас экспортирует только `fakes.ts`**
- **Evidence:** package.json:9.
- **Fix:** Можно расширить фабриками фикстур, если тесты в `platform-http` начнут дублировать setup-код.

---

## Quick wins (можно сделать без продакт-решений)
1. Удалить 6 мёртвых workspace-зависимостей.
2. Удалить или начать использовать `fast-check`.
3. Добавить `.max()` на `apiToken`.
4. Унифицировать тип `role` в `MembershipMirrorSchema`.
5. Добавить unit-тест `archiveOrgCascade`.
6. Добавить coverage в vitest config.

## Требуют решения Влада / архитектурного обсуждения
- Стратегия версионирования `platform-core` (семвер / changesets).
- Должен ли `BlobStore` оставаться в домене или переехать в `platform-storage`.
- Инвестировать ли в property-based testing (fast-check) для критичных алгоритмов (`canonicalize`, `sha256Hex`).

---

## Позитивные находки
- ✅ Чистые границы: нет импортов `pg`, `express`, `http` в домене.
- ✅ Нет циклических зависимостей внутри пакета.
- ✅ Правильное направление зависимостей: `platform-http` и `platform-storage` зависят от `platform-core`, а не наоборот.
- ✅ `FakeStore` хорошо спроектирован и переиспользуется в `platform-http` тестах.
- ✅ Result-тип и error codes последовательны across use-cases.
