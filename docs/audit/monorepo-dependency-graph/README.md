# Architecture audit — `monorepo dependency graph`

This document mirrors the read-only architecture audit posted on Multica so it can be reviewed offline and linked from the repo.

| | |
|---|---|
| **Multica issue** | `RNT-230` (`b085b758-7c27-4181-9be0-1a396461ca71`) |
| **Issue title** | Audit: monorepo dependency graph architecture |
| **Package / scope** | `monorepo dependency graph` |
| **Verdict (summary)** | needs cleanup — includes blocker-level workspace issues |
| **Audit comment id** | `caabaeb1-bcca-436e-b3bf-98a23af38b73` |
| **Audit comment date** | 2026-04-28 |

---

## Audit report

The sections below reproduce the audit comment body **verbatim** from Multica (formatting preserved).


## Audit Report: Monorepo Dependency Graph Architecture

### 1. Краткая карта текущего графа

**30 workspace packages** (29 активных + 1 пустой submodule):

```
Layer 0 — Contracts (4):
  @rntme/contracts-common-v1
  @rntme/contracts-{ai-llm,crm,identity}-v1
  
Layer 1 — Core Primitives (3):
  @rntme/pdm, @rntme/qsm, @rntme/event-store
  
Layer 2 — Compilation (2):
  @rntme/graph-ir-compiler, @rntme/projection-consumer
  
Layer 3 — Transport (2):
  @rntme/bindings, @rntme/bindings-{http,grpc}
  
Layer 4 — Runtime (2):
  @rntme/runtime, @rntme/ui-runtime
  
Layer 5 — Tooling (2):
  @rntme/blueprint, @rntme/seed
  
Layer 6 — Modules (8):
  @rntme/{conformance,crm-amocrm,crm-bitrix24,identity-auth0,...}
```

**Ключевые ребра:**
- runtime → 12 packages (god package pattern)
- bindings-grpc → bindings-http (grpc depends on http transport)
- blueprint → seed (build-time tool depends on runtime seed)
- bindings-http → graph-ir-compiler (transport layer depends on compiler)

---

### 2. Список проблем по severity

#### BLOCKER

**B1. legacy CLI submodule — superseded**
- Evidence at audit time: pnpm-workspace.yaml referenced the separate CLI package tree while `.gitmodules` pointed at the CLI repo and the directory was empty. Current layout has these packages merged under `apps/` and `packages/{platform,deploy}/`.
- Impact: Любой pnpm install или pnpm -r run build может падать на отсутствующем workspace member. Невозможен полный workspace build.
- Recommendation: Либо инициализировать submodule (git submodule update --init), либо убрать из pnpm-workspace.yaml если CLI — отдельный repo.
- Owner: infra/devops

**B2. @rntme/runtime — god package (11 workspace deps)**
- Evidence: runtime зависит от: bindings, bindings-grpc, bindings-http, event-store, graph-ir-compiler, pdm, projection-consumer, qsm, seed, ui, ui-runtime
- Impact: Любое изменение в любом core-пакете требует пересборки runtime. Невозможно использовать runtime без всего стека. Циклический риск при расширении.
- Recommendation: Разделить runtime на runtime-core (только orchestration) и runtime-full (сборка). Вынести seed, ui, ui-runtime в опциональные peer deps.
- Owner: @rntme/runtime

**B3. bindings-grpc → bindings-http (transport cross-dependency)**
- Evidence: bindings-grpc имеет dependencies["@rntme/bindings-http"]: "workspace:*"
- Impact: gRPC transport тянет HTTP transport на runtime. Нарушение separation of concerns. Увеличение bundle size для gRPC-only сервисов.
- Recommendation: Извлечь общие типы/утилиты из bindings-http в bindings (shared base), или создать bindings-shared. gRPC не должен зависеть от HTTP.
- Owner: @rntme/bindings-grpc, @rntme/bindings-http

#### HIGH

**H1. Несогласованные версии external dependencies**
- Evidence:
  - @grpc/grpc-js: ^1.10.0, ^1.12.0, ^1.14.3 (3 версии)
  - protobufjs: ^7.2.0, ^7.4.0, ^8.0.1 (3 версии)
  - better-sqlite3: ^11.0.0, ^11.3.0, ^11.10.0 (3 версии)
  - typescript: ^5.5.4 vs ^5.6.0
  - vitest: ^2.1.0 vs ^2.1.1
- Impact: Непредсказуемое поведение при hoisting, duplicate bundles, type incompatibilities, silent runtime bugs.
- Recommendation: Синхронизировать через catalog: (pnpm 9.5+) или root devDependencies + pnpm.overrides.
- Owner: infra

**H2. Module packages — прямые build-скрипты чужих пакетов**
- Evidence: 8 module packages имеют build:deps с pnpm --dir ../../../packages/... run build или pnpm -F @rntme/... run build
- Impact: Распределённая логика сборки вместо workspace orchestration. Хрупкие относительные пути. Невозможно использовать pnpm -r run build корректно.
- Recommendation: Убрать build:deps из module packages. Полагаться на pnpm -r run build или turbo/nx с topological execution.
- Owner: modules/

**H3. Dev/prod dependency путаница в conformance**
- Evidence:
  - crm-bitrix24: conformance-crm в dependencies
  - crm-amocrm: conformance-crm в devDependencies
  - identity-auth0: conformance-identity в dependencies
  - identity-clerk: conformance-identity в devDependencies
- Impact: Непредсказуемое включение conformance tests в production bundles. Нарушение принципа least surprise.
- Recommendation: conformance — всегда devDependencies (test-only). Перенести все conformance в devDeps.
- Owner: modules/

**H4. runtime зависит от seed (CLI tool)**
- Evidence: runtime has dependencies["@rntme/seed"]: "workspace:^" (единственный workspace:^ вместо workspace:*)
- Impact: Runtime тянет CLI-tool зависимости. seed — инструмент для инициализации БД, не должен быть в production runtime.
- Recommendation: Перенести seed в devDependencies runtime, или разделить seed на seed-core (runtime API) и seed-cli (CLI).
- Owner: @rntme/runtime, @rntme/seed

#### MEDIUM

**M1. Internal import bypassing exports**
- Evidence: packages/runtime/runtime/src/index.ts содержит комментарий: Import directly from '@rntme/runtime/src/plugins/contract-tests.js' in test files.
- Impact: Хрупкий контракт. Изменение внутренней структуры директорий ломает тесты внешних пакетов.
- Recommendation: Добавить ./contract-tests в exports runtime, либо вынести contract-tests в отдельный пакет @rntme/contract-tests.
- Owner: @rntme/runtime

**M2. blueprint зависит от seed и ui**
- Evidence: blueprint → seed, ui
- Impact: Blueprint (parse/validate) тянет seed (CLI) и UI components. Нарушает single responsibility.
- Recommendation: Разделить blueprint на blueprint-core (pure parser/validator) и blueprint-compose (оркестрация с seed/ui).
- Owner: @rntme/blueprint

**M3. bindings-http зависит от graph-ir-compiler**
- Evidence: bindings-http → graph-ir-compiler
- Impact: HTTP transport layer тянет SQL compiler. Нарушает layer boundaries.
- Recommendation: Извлечь shared types/interfaces из graph-ir-compiler в отдельный пакет, или перенести зависимость в devDeps если используется только для types.
- Owner: @rntme/bindings-http

**M4. Отсутствие .gitignore в 22 пакетах**
- Evidence: Только packages/bindings-http, packages/contracts-*, demo/* имеют .gitignore. 22 пакета — нет.
- Impact: Риск случайного коммита dist/, .turbo/, логов.
- Recommendation: Добавить .gitignore в каждый пакет (или root-level с **/dist/).
- Owner: infra

**M5. Отсутствие описаний у 2 пакетов**
- Evidence: ui, ui-runtime — no description
- Impact: Непонятно назначение пакетов для новых разработчиков.
- Recommendation: Добавить description в package.json.
- Owner: соответствующие пакеты

---

### 3. Рекомендации по автоматическим guardrails

1. **dependency-cruiser** или **skott** — автоматическая проверка layer violations в CI
2. **pnpm.catalogs** — единые версии external deps (typescript, vitest, eslint, protobufjs, better-sqlite3)
3. **eslint-plugin-import** с `no-internal-modules` — запрет импортов в обход exports
4. **custom eslint rule** — запрет `workspace:^` (только `workspace:*`)
5. **CI check** — `pnpm -r run build` должен проходить без `build:deps` скриптов
6. **dependency graph diff** в PR — показывать изменения в графе при изменении package.json

---

### 4. Follow-up implementation tasks

1. **[DEV] B1**: Удалить legacy submodule wiring after merge-back
2. **[DEV] B2**: Сплит runtime на runtime-core + runtime-full
3. **[DEV] B3**: Извлечь shared bindings types из bindings-http
4. **[DEV] H1**: Внедрить pnpm.catalogs для external deps
5. **[DEV] H2**: Удалить build:deps из module packages
6. **[DEV] H3**: Нормализовать conformance в devDependencies
7. **[DEV] H4**: Разделить seed на core + CLI
8. **[PLAN] M1-M3**: Рефакторинг layer boundaries (blueprint, bindings-http, runtime exports)

---

### 5. Системные vs локальные проблемы

**Системные (требуют архитектурных решений):**
- B2 (runtime god package)
- B3 (transport cross-dependency)
- H1 (version divergence)
- H2 (build orchestration)
- M2 (blueprint responsibilities)
- M3 (transport→compiler leak)

**Локальные (можно починить пакет за пакетом):**
- B1 (submodule)
- H3 (conformance deps)
- H4 (seed dep type)
- M1 (exports)
- M4 (.gitignore)
- M5 (descriptions)
- L1 (demo exports)
