# Architecture audit — `@rntme/contracts-common-v1`

This document mirrors the read-only architecture audit posted on Multica so it can be reviewed offline and linked from the repo.

| | |
|---|---|
| **Multica issue** | `RNT-214` (`4b76db71-0e9c-4ecd-9b41-2b8705f277af`) |
| **Issue title** | Audit: package architecture — @rntme/contracts-common-v1 |
| **Package / scope** | `@rntme/contracts-common-v1` |
| **Verdict (summary)** | OK — структурно корректен, выполняет роль primitives-only shared package. Есть 3 medium-риска (тестовое покрытие, отсутс |
| **Audit comment id** | `9c69bf3a-e199-4184-98e5-91b8dc26ca06` |
| **Audit comment date** | 2026-04-28 |

---

## Audit report

The sections below reproduce the audit comment body **verbatim** from Multica (formatting preserved).


## Audit Report: @rntme/contracts-common-v1

**Verdict:** OK — структурно корректен, выполняет роль primitives-only shared package. Есть 3 medium-риска (тестовое покрытие, отсутствие .gitignore, хрупкий build-скрипт) и 2 low (документация, отсутствие cross-package compatibility guard).

---

### 1. Назначение и место в архитектуре

**Статус:** Соответствует спеке.

Пакет — единый источник truth для cross-category protobuf-примитивов (`CanonicalRef`, `CommandContext`, `Name`, `ListRequest`/`Filter`/`Sort`/`ListResponseMeta`, `Metadata`). Все 3 category contract packages (`identity`, `ai-llm`, `crm`) зависят от него через `workspace:*` и импортируют `common.proto` через symlink в `proto-deps/`. Это предотвращает дрифт между категориями.

---

### 2. Публичный API / exports / naming

**Статус:** OK, но есть gap.

- **Exports:** `proto` (namespace), `Rntme` (type). Достаточно для потребителей.
- **Naming:** Соответствует спеке `rntme.contracts.common.v1`.
- **Gap:** Category contracts (`identity`, `crm`) re-export common types напрямую (`export const CanonicalRef = commonv1.CanonicalRef`), но common package сам этого не делает. Это сознательное решение (common — низкоуровневые примитивы), но означает, что потребители обязаны импортировать common отдельно или полагаться на re-export category package.

---

### 3. Внутренние границы

**Статус:** Хорошо.

- Чистое разделение: `proto/` (canonical source) → `scripts/gen.mjs` (codegen) → `src/proto.gen.{js,d.ts}` (generated) → `src/index.ts` (thin re-export layer).
- Нет runtime/platform/demo/test concerns внутри пакета — он чисто compile-time / type-level.

---

### 4. Зависимости

**Статус:** OK.

- Прямые deps: только `protobufjs` (runtime для generated bindings).
- Нет workspace deps (by design — он корневой для категорий).
- Нет нежелательных импортов.

---

### 5. Типы, схемы, валидация, error handling

**Статус:** OK с оговорками.

- `common.proto` соответствует спеке §5 identity-canonical-contract-design.
- `error-codes.json` — пустой `{}` (intentional, по спеке §5.1).
- **Issue:** Нет `error-codes.ts` (в отличие от category packages). Это intentional, но создает несоответствие в шаблоне: category packages экспортируют `errorCodes` / `isErrorCode` / `layerOf`, а common — нет. При добавлении общих error codes в будущем (например, `COMMON_STRUCTURAL_INVALID_UUID`) придется вводить этот файл retroactively.

---

### 6. Build / test / lint setup

**Severity: medium**

| Проблема | Evidence | Impact | Рекомендация |
|---|---|---|---|
| **6.1 Хрупкий build-скрипт** | `package.json#build`: `"tsc -p tsconfig.json && cp src/proto.gen.d.ts src/proto.gen.js dist/"` | `cp` не кроссплатформенный, не проверяет наличие dist/, может молча падать | Перейти на `scripts/build.mjs` как в CRM package (mkdir + copyFileSync + spawnSync с проверкой exit code) |
| **6.2 Отсутствие .gitignore** | Нет `.gitignore` в `_common/v1/` | `proto-deps/` и `dist/` могут случайно попасть в git (CRM package игнорирует `dist/` и `proto-deps/`) | Добавить `.gitignore` с `dist/` и `proto-deps/` |
| **6.3 Нет @vitest/coverage-v8** | `pnpm test --coverage` падает с MISSING DEPENDENCY | Невозможно измерить покрытие локально | Добавить `@vitest/coverage-v8` в devDependencies |
| **6.4 Тестовое покрытие минимально** | Только 6 round-trip тестов (116 строк), нет negative cases | Не проверяются edge cases (null/undefined fields, empty structs, max int32) | Добавить тесты на default values, empty repeated fields, boundary values |

**Build/test/lint gates:** Все проходят (`build`, `test`, `typecheck`, `lint`).

---

### 7. Документация и onboarding

**Severity: low**

- README есть, но краток. Нет секций: "Where to look first" (стандартный шаблон rntme package README), "Invariants & gotchas", "Out of scope".
- Нет примера использования `ListRequest` с `Filter` + `Sort` (основной use case).
- Нет упоминания о том, что `Metadata` использует `google.protobuf.Struct` и требует специального construction.

---

### 8. Соответствие product vision и specs

**Статус:** Полное соответствие.

- Реализует решение Q5 из identity-canonical-contract-design.md §3.
- Layout соответствует modules-monorepo-structure-design.md §5.1.
- Proto package `rntme.contracts.common.v1` соответствует naming convention §6.1.

---

### 9. Quick wins (можно сделать без продуктового решения)

1. **Добавить `.gitignore`** (`dist/`, `proto-deps/`) — 1 строка.
2. **Улучшить build-скрипт** — скопировать `scripts/build.mjs` из CRM package.
3. **Добавить `@vitest/coverage-v8`** в devDependencies.
4. **Расширить round-trip тесты:** empty structs, default values, boundary values (limit=0, limit=2147483647).
5. **Дополнить README** секциями по шаблону rntme package README.

---

### 10. Изменения, требующие продуктового/архитектурного решения Влада

1. **Нужен ли `error-codes.ts` в common package?** Сейчас несоответствие шаблону: category packages экспортируют типизированные error codes, common — нет. Если в будущем появятся общие ошибки (например, `COMMON_STRUCTURAL_INVALID_UUID`), нужен ли единообразный API?
2. **Нужны ли cross-package compatibility тесты?** Сейчас нет автоматической проверки, что изменение `common.proto` не ломает codegen в зависимых category packages. Можно добавить CI job, который после изменения common пересобирает все category packages.

---

### 11. Проблемы по severity

| Severity | Count | Проблемы |
|---|---|---|
| **blocker** | 0 | — |
| **high** | 0 | — |
| **medium** | 3 | Хрупкий build-скрипт, отсутствие .gitignore, недостаточное тестовое покрытие |
| **low** | 2 | Неполный README, отсутствие @vitest/coverage-v8 |

---

### Evidence summary

- Package location: `packages/contracts/_common/v1/`
- Spec: `docs/superpowers/specs/done/2026-04-26-identity-canonical-contract-design.md` §5
- Layout spec: `docs/superpowers/specs/2026-04-26-modules-monorepo-structure-design.md` §5.1
- Build script: `packages/contracts/_common/v1/package.json:24`
- Test file: `packages/contracts/_common/v1/test/round-trip.test.ts` (116 lines, 6 tests)
- Missing .gitignore: confirmed via `ls -la packages/contracts/_common/v1/`
- Missing coverage: `pnpm test --coverage` → MISSING DEPENDENCY `@vitest/coverage-v8`
