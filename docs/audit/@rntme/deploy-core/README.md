# Architecture audit — `@rntme/deploy-core`

This document mirrors the read-only architecture audit posted on Multica so it can be reviewed offline and linked from the repo.

| | |
|---|---|
| **Multica issue** | `RNT-225` (`7dc6b75d-147d-4197-81e3-a4a40802e9d2`) |
| **Issue title** | Audit: package architecture — @rntme/deploy-core |
| **Package / scope** | `@rntme/deploy-core` |
| **Verdict (summary)** | needs cleanup |
| **Audit comment id** | `7701424f-5442-4314-b9e1-7be46f3fcc18` |
| **Audit comment date** | 2026-04-28 |

---

## Audit report

The sections below reproduce the audit comment body **verbatim** from Multica (formatting preserved).


## Архитектурный аудит @rntme/deploy-core

**Verdict: needs cleanup.** Архитектура пакета соответствует спеке и product vision, публичный API чистый, границы ответственности соблюдены. Однако есть конкретные проблемы качества кода и покрытия тестами, которые нужно устранить до того, как пакет начнёт расти (production mode, новые middleware kinds, multi-environment).

---

### Проблемы по severity

#### medium — Code duplication в edge.ts (middleware dispatch)
- **Evidence:** src/edge.ts:167–220 — четыре почти идентичных блока для request-context, rate-limit, body-limit, timeout.
- **Impact:** Добавление нового middleware kind (например, auth когда он будет поддерживаться) потребует copy-paste пятого блока. Риск забыть обновить один из блоков при изменении общей логики (например, добавить path в ошибку).
- **Рекомендация:** Вынести generic dispatch: после isSupportedMiddlewareKind сделать единый вызов resolvePolicy(decl.kind, ...) и push в planned без switch по kind. Тип MiddlewarePolicyByKind уже позволяет это сделать.

#### medium — Мёртвая зависимость zod
- **Evidence:** package.json:22 — "zod": "^4.0.0" в dependencies. grep -r zod src/ test/ — ноль использований.
- **Impact:** Лишний runtime dependency, путает читателя (ожидаешь runtime validation, а её нет), замедляет install.
- **Рекомендация:** Либо удалить из dependencies (если валидация на уровне структурных типов — осознанный выбор), либо добавить Zod-схемы для ComposedProjectInput и ProjectDeploymentConfig и валидировать вход до планирования. Это решение продукта.

#### medium — Недостаточное покрытие unit-тестами
- **Evidence:** 12 тестов, все в test/unit/. Нет тестов для:
  - body-limit и timeout middleware (только request-context и rate-limit покрыты);
  - пустого project (services: {});
  - duplicate service slug в project.services;
  - одновременного failure нескольких policy values;
  - orgSlug с пробелами (только trim() === '' проверяется, но не whitespace-only);
  - runtimeImage override;
  - warnings (сейчас всегда [], но тип DeploymentWarning публичный).
- **Impact:** Регрессии при добавлении новых features не будут ловиться на уровне этого пакета.
- **Рекомендация:** Добавить тесты на перечисленные сценарии. Минимум: покрыть все 4 supported middleware kinds и empty/edge-case inputs.

#### low — Избыточная проверка в plan.ts
- **Evidence:** src/plan.ts:116 — if (errors.length > 0 || config.eventBus === undefined). Если eventBus === undefined, ошибка DEPLOY_PLAN_MISSING_EVENT_BUS уже добавлена в errors на строке 104–110, поэтому errors.length > 0 уже true. Вторая часть OR избыточна.
- **Impact:** Минимальный, но путает читателя — создаёт впечатление, что есть edge case, который первая часть не покрывает.
- **Рекомендация:** Упростить до if (errors.length > 0).

#### low — DeploymentPlanError не типобезопасен по контексту
- **Evidence:** src/errors.ts:17–25 — одна структура с необязательными полями path, service, route, middleware, policy. Нельзя на уровне типов выразить, что DEPLOY_PLAN_ROUTE_TARGET_MISSING_WORKLOAD обязан иметь service и route, а DEPLOY_PLAN_MISSING_ORG_SLUG — path.
- **Impact:** Код downstream может полагаться на поля, которые не гарантированы. Легко забыть заполнить релевантное поле при добавлении нового error code.
- **Рекомендация:** Рассмотреть discriminated union по code, где каждый code несёт свои обязательные поля. Это breaking change для потребителей, поэтому требует отдельного follow-up.

#### low — passWithNoTests: true в vitest.config.ts
- **Evidence:** vitest.config.ts:9.
- **Impact:** Если все тестовые файлы случайно пропадут или будут исключены, CI не упадёт.
- **Рекомендация:** Удалить эту опцию. В пакете уже есть тесты, так что false positive не ожидается.

#### low — Нет runtime validation входных данных
- **Evidence:** buildProjectDeploymentPlan принимает ComposedProjectInput и ProjectDeploymentConfig как plain structural types. Нет проверки, что project.services не null/undefined, что slug'и не содержат недопустимых символов, что routes.ui и routes.http не конфликтуют по path.
- **Impact:** Невалидный input от caller'а (например, баг в @rntme/blueprint или platform-http executor) может привести к странным runtime ошибкам вместо читаемых DEPLOY_PLAN_* ошибок.
- **Рекомендация:** Добавить defensive checks на вход (или Zod-схемы, если решаем medium-проблему с zod выше).

---

### Соответствие спеке и product vision

- **Спека:** docs/superpowers/specs/done/2026-04-24-project-deployment-pipeline-design.md — пакет реализует решения D1–D36 корректно. Границы core/adapter/frontend соблюдены.
- **Product vision:** Пакет усиливает позиционирование rntme как repeatable deploy-инфраструктуры для AI-generated проектов. Target-neutral planning позволит будущим адаптерам (Fly.io, Railway) переиспользовать deploy-core без изменений.

---

### Quick wins (можно сделать без продуктового решения)

1. Убрать passWithNoTests: true.
2. Упростить if в plan.ts.
3. Отрефакторить дублирование в edge.ts (единый dispatch loop).
4. Добавить недостающие unit-тесты на body-limit, timeout, empty project, runtimeImage override.

### Требуют решения Влада

1. **Удалить или использовать zod?** Если валидация входов через structural types — осознанный выбор, удаляем зависимость. Если хочется runtime validation, добавляем Zod-схемы.
2. **Типобезопасность DeploymentPlanError?** Переход на discriminated union — breaking change. Нужен ли он сейчас или отложить до стабилизации API?
3. **Какой порог покрытия тестами установить?** Сейчас 12 тестов — достаточно для MVP, но нужен ли formal coverage gate (например, 80%)?

---

### Файлы, к которым применимы рекомендации

- src/edge.ts — рефакторинг dispatch loop
- src/plan.ts — убрать избыточную проверку
- src/errors.ts — типобезопасность ошибок (по решению)
- package.json — zod dependency
- vitest.config.ts — passWithNoTests
- test/unit/plan.test.ts, test/unit/edge.test.ts — дополнить тесты

Аудит read-only. PR не создан.
