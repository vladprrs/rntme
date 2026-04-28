# Architecture audit — `@rntme-cli/platform-storage`

This document mirrors the read-only architecture audit posted on Multica so it can be reviewed offline and linked from the repo.

| | |
|---|---|
| **Multica issue** | `RNT-229` (`408fa332-724c-42f8-a11b-4ebd0eb99983`) |
| **Issue title** | Audit: package architecture — @rntme-cli/platform-storage |
| **Package / scope** | `@rntme-cli/platform-storage` |
| **Verdict (summary)** | needs cleanup — несколько medium/high рисков, нет blockers, но debt накапливается быстро. |
| **Audit comment id** | `5b17a0dc-39cf-4a0b-ae99-998a72021aca` |
| **Audit comment date** | 2026-04-28 |

---

## Audit report

The sections below reproduce the audit comment body **verbatim** from Multica (formatting preserved).


## Audit Report: `@rntme-cli/platform-storage`

**Verdict:** needs cleanup — несколько medium/high рисков, нет blockers, но debt накапливается быстро.

---

### 1. HIGH — Дублирование transaction/helpers в каждом repo-файле
**Evidence:** `pg-deploy-target-repo.ts:352-390`, `pg-deployment-repo.ts:377-452`, `pg-project-version-repo.ts` (inline raw SQL без helper'ов), etc.
**Impact:** 6+ файлов дублируют `withOptionalTransaction`, `isPool`, `dbErr`, `audit`. Изменение логики rollback или error code требует правки во всех файлах. Риск рассинхронизации.
**Fix:** Вынести shared helpers в `src/repos/_shared.ts` или `src/pg/helpers.ts`.

### 2. HIGH — Transaction / Result semantics mismatch
**Evidence:** `pg-deploy-target-repo.ts:352-378` — `withOptionalTransaction` откатывает по `!result.ok` только если сама создала транзакцию. При вложенности в `withTransaction` (`pg/tx.ts:5-26`) ошибка `Result` НЕ вызывает rollback, потому что внешний `withTransaction` откатывает только по exception.
**Impact:** Use-case, вызывающий `repo.create()` → `repo.delete()` внутри `withTransaction`, получит `DEPLOY_TARGET_IN_USE` как `Result.error`, но `audit_log` от первой операции и любые side-effects останутся закоммиченными.
**Fix:** Либо задокументировать, что `Result.error` внутри `withTransaction` НЕ откатывает (и перенести проверку в use-case), либо изменить `withTransaction` для проверки `Result.ok`. Требует архитектурного решения.

### 3. MEDIUM — Непоследовательный выбор Drizzle vs raw SQL
**Evidence:** `pg-org-repo.ts`, `pg-account-repo.ts`, `pg-project-repo.ts`, `pg-membership-mirror-repo.ts` — Drizzle ORM. `pg-deploy-target-repo.ts`, `pg-deployment-repo.ts`, `pg-project-version-repo.ts`, `pg-token-repo.ts`, `pg-audit-repo.ts`, `pg-outbox-repo.ts` — raw SQL.
**Impact:** Новый разработчик не понимает, когда какой подход использовать. Разные паттерны error handling (Drizzle-репозитории ловят constraint error по regex, raw-SQL-репозитории — нет). Нет явного architectural rule.
**Fix:** Зафиксировать guideline: Drizzle для CRUD с простой типизацией, raw SQL для сложных запросов (locking, dynamic WHERE, advisory locks). Рефакторинг под единый стандарт.

### 4. MEDIUM — RLS test coverage gap для identity-репозиториев
**Evidence:** `test/integration/identity-repos.test.ts` использует `env.pool` (owner/superuser), который bypass RLS. Тесты `rls-enforcement.test.ts` проверяют только `project`, но не `organization`, `account`, `membership_mirror`, `api_token`.
**Impact:** Регрессия в RLS-политиках для identity-таблиц может остаться незамеченной.
**Fix:** Добавить `withTransaction(h.appPool, orgId, ...)` в identity-репозитории тесты, либо расширить `rls-enforcement.test.ts`.

### 5. MEDIUM — Schema drift: drizzle migration vs runtime policies.sql
**Evidence:** `drizzle/0003_deploy.sql:92-99` — `current_setting('app.org_id', true)::uuid` (без NULLIF). `src/sql/policies.sql:39-46` — `NULLIF(current_setting('app.org_id', true), '')::uuid`.
**Impact:** Если миграция применяется без `policies.sql` (например, на чистой базе через `drizzle-kit migrate`), RLS-политики ведут себя по-разному при пустом `app.org_id`: `NULL::uuid` vs `''::uuid`.
**Fix:** Синхронизировать. Вероятно, `NULLIF` — правильный вариант (fail-closed). Обновить migration SQL или перегенерировать.

### 6. MEDIUM — S3BlobStore: один error code на все операции
**Evidence:** `s3-blob-store.ts:58,68,78,88` — все операции возвращают `PLATFORM_STORAGE_BLOB_UPLOAD_FAILED`, включая `getJson`, `getRaw`, `presignedGet`.
**Impact:** Невозможно отличить "blob not found" от "network error" от "upload failed" без парсинга `message`.
**Fix:** Добавить `PLATFORM_STORAGE_BLOB_DOWNLOAD_FAILED`, `PLATFORM_STORAGE_BLOB_NOT_FOUND`.

### 7. LOW — `getWithSecretById` может вызываться с RLS-enabled клиентом
**Evidence:** `pg-deploy-target-repo.ts:266-273` — метод возвращает `DeployTargetWithSecret` (с ciphertext). В системных sweeps он вызывается с `pool` без RLS, что ок. Но нет runtime guard, запрещающего вызов с app-клиентом.
**Impact:** При ошибке в wiring можно случайно отдать секреты в tenant-контексте.
**Fix:** Добавить assert `isPool(this.db)` или документировать, что метод требует admin/system client.

### 8. LOW — `AesGcmSecretCipher` rejects cross-version decrypt
**Evidence:** `aes-gcm-cipher.ts:39-41` — `decrypt` бросает, если `keyVersion !== this.keyVersion`.
**Impact:** При key rotation старый экземпляр cipher не сможет расшифровать данные, зашифрованные новым. Это может быть intentional, но не задокументировано.
**Fix:** Задокументировать rotation strategy: либо хранить несколько ключей, либо обновить cipher для поддержки multi-version.

### 9. LOW — Missing dedicated tests для PgProjectVersionRepo, PgAuditRepo
**Evidence:** `PgProjectVersionRepo` не импортируется ни в одном `.test.ts` напрямую. `PgAuditRepo` тестируется только через side-effects других репозиториев.
**Impact:** Регрессия в seq generation, advisory locks, audit filtering — не покрыта.
**Fix:** Добавить `pg-project-version-repo.test.ts` и `pg-audit-repo.test.ts`.

### 10. LOW — `resetSchema` в test harness хардкодит таблицы
**Evidence:** `test/integration/harness.ts:51-54` — `TRUNCATE TABLE ...` со списком из 11 таблиц.
**Impact:** Добавление новой таблицы требует ручного обновления harness.
**Fix:** Использовать `SELECT tablename FROM pg_tables WHERE schemaname='public'` для динамического truncate.

### 11. LOW — `platform-storage` экспортирует Drizzle schemas
**Evidence:** `src/index.ts:5` — `export * from './schema/index.js'`.
**Impact:** Потребители могут заимпортировать Drizzle-таблицы напрямую, создавая coupling к ORM-специфичным типам.
**Fix:** Убрать schema exports из публичного API, оставив только repo-реализации и infrastructure utilities. Schemas — implementation detail адаптера.

---

### Quick wins (можно сделать без product decision)
1. Extract shared helpers (`withOptionalTransaction`, `isPool`, `dbErr`, `audit`) в `src/pg/helpers.ts`.
2. Добавить distinct error codes в `S3BlobStore`.
3. Синхронизировать `drizzle/0003_deploy.sql` с `policies.sql` (добавить `NULLIF`).
4. Добавить тесты для `PgProjectVersionRepo` и `PgAuditRepo`.
5. Убрать `export * from './schema'` из `src/index.ts`.
6. Заменить хардкод `resetSchema` на динамический truncate.

### Требуют решения Влада / архитектурного обсуждения
1. **Drizzle vs raw SQL:** зафиксировать guideline и провести рефакторинг под единый стиль.
2. **Transaction / Result semantics:** должна ли `withTransaction` откатывать при `Result.error`? Это меняет контракт use-cases.
3. **Key rotation strategy для AES-GCM:** multi-version decrypt или single-key с re-encryption?
4. **Schema exports:** нужны ли Drizzle schemas за пределами пакета (например, для миграций в другом пакете)?

### Build / CI состояние
- `pnpm install` на уровне workspace падает из-за отсутствия `@rntme/bindings`, `@rntme/pdm` и др. (зависимости из основного `rntme` mono-repo). `rntme-cli` не является standalone репозиторием для локальной разработки без основного mono-repo. Это workspace-level issue, не специфичен для `platform-storage`, но блокирует CI для этого пакета в изоляции.
