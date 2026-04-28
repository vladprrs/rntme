# Architecture audit — `@rntme/bindings-grpc`

This document mirrors the read-only architecture audit posted on Multica so it can be reviewed offline and linked from the repo.

| | |
|---|---|
| **Multica issue** | `RNT-200` (`5c6a1616-3a84-4ecc-b88a-0f2e8d8ebab9`) |
| **Issue title** | Audit: package architecture — @rntme/bindings-grpc |
| **Package / scope** | `@rntme/bindings-grpc` |
| **Verdict (summary)** | needs cleanup |
| **Audit comment id** | `014b10cb-fd38-4238-bf0e-1c9c5dbfaba2` |
| **Audit comment date** | 2026-04-28 |

---

## Audit report

The sections below reproduce the audit comment body **verbatim** from Multica (formatting preserved).


Аудит `@rntme/bindings-grpc` завершён. Verdict: **needs cleanup** — пакет работает для MVP, но есть архитектурные риски, которые будут расти по мере расширения платформы.

## 1. Сводка по severity

| Severity | Count | Кратко |
|----------|-------|--------|
| blocker  | 1     | `actor: null` ломает audit/actor-guard для всех gRPC-команд |
| high     | 3     | Неправильное направление зависимости; неисчерпывающие switch; нефальсифицируемый E2E-тест |
| medium   | 4     | Нет `pre[]`; хардкод `CommandResult`; ручная сериализация protobuf; невалидированное имя поля в ответе |
| low      | 5     | Нет health/TLS; только output-шейпы; нет своих ERROR_CODES; пробелы в покрытии |

## 2. Проблемы

### BLOCKER

**B1. `actor: null` во всех gRPC-командах**
Evidence: `packages/bindings-grpc/src/server/handler.ts:60`
Impact: Любая команда, пришедшая по gRPC, теряет actor-атрибуцию. Ломается audit trail и actor-based guard. HTTP-surface в `bindings-http` передаёт `actor: deps.actorFromRequest(c)`. gRPC-surface не принимает `actorFromRequest` в опциях и всегда ставит `null`.
Рекомендация: добавить `actorFromRequest?: (metadata: grpc.Metadata) => ActorRef | null` в `GrpcServerOptions` и пробросить в handler.

### HIGH

**H1. `bindings-grpc` зависит от `bindings-http` только для `executor-contract`**
Evidence: `src/server/handler.ts:3-8`, `src/server/errors.ts:3-5`, `src/types.ts:3-5` импортируют `CommandExecutor` / `QueryExecutor` из `@rntme/bindings-http/executor-contract`.
Impact: Executor seam — это shared контракт между HTTP и gRPC. Зависимость grpc от http нарушает layering и создаёт риск цикла при рефакторинге.
Рекомендация: вынести `executor-contract.ts` в `@rntme/bindings` (или отдельный `@rntme/executor-contract`). Требует решения Влада, потому что затрагивает публичный API обоих пакетов.

**H2. Неисчерпывающие `switch` без fallback-return**
Evidence: `src/emit/scalars.ts:3-11` и `src/emit/shapes.ts:5-16`.
Impact: Если в `@rntme/bindings` добавится новый `ScalarPrimitive` или `FieldType.kind`, компилятор TypeScript (`strict`) выдаст ошибку, но runtime-поведение при пропущенном `case` — `undefined`, и `.proto` будет сгенерирован с `undefined` вместо типа.
Рекомендация: добавить `default` с `throw new Error('unreachable')` после exhaustive-проверки `_exhaustive: never`.

**H3. Нефальсифицируемое assertion в demo E2E**
Evidence: `demo/issue-tracker-api/test/e2e/grpc.test.ts:49` — `expect(error !== null || typeof response === 'object').toBe(true)`.
Impact: Это утверждение всегда истинно для любого gRPC-ответа (даже ошибки). Дает ложное чувство покрытия. Ультраревью (spec `2026-04-23-ultrareview-fixes-design.md`) уже отмечал это как deferred.
Рекомендация: заменить на конкретную проверку полей ответа (`expect(response.rows).toBeDefined()` и т.д.).

### MEDIUM

**M1. Нет поддержки `pre[]` middleware в gRPC surface**
Evidence: `README.md:57` — "Not yet supported: `pre[]` middleware (plan 3)".
Impact: Команды по gRPC не могут делать pre-fetch к модулям. Это core-фича платформы, и её отсутствие в gRPC делает surface вторым сортом.
Рекомендация: либо реализовать `pre[]` оркестрацию в `handler.ts` (сложно, т.к. нет HTTP-контекста), либо явно задокументировать, что gRPC surface — только для internal module-to-service вызовов без `pre[]`, и валидатор должен reject binding с `pre[]` + gRPC exposure. Решение Влада.

**M2. Хардкод строки `'CommandResult'` вместо константы из `@rntme/bindings`**
Evidence: `src/emit/emit-proto.ts:28` фильтрует по `name === 'CommandResult'`.
Impact: Если константа `COMMAND_RESULT_SHAPE_NAME` в `@rntme/bindings` изменится, фильтр сломается и `CommandResult` задублируется.
Рекомендация: импортировать `COMMAND_RESULT_SHAPE_NAME` из `@rntme/bindings`.

**M3. Ручная реализация сериализации в `buildServiceDefinition`**
Evidence: `src/server/create-server.ts:8-26` вручную строит `requestSerialize` / `requestDeserialize` через `protobufjs`.
Impact: Дублирование логики, которую `@grpc/proto-loader` делает из коробки. Усложняет поддержку (например, добавление `google.protobuf.Any` или `Timestamp`).
Рекомендация: рассмотреть переход на `@grpc/proto-loader` для загрузки `.proto` в `grpc.Server` — это соответствует решению в spec `2026-04-19-platform-modules-integration-design.md` §6.2.

**M4. Имя поля в query-ответе не валидируется на существование в shape**
Evidence: `src/server/handler.ts:99` — `{ [toSnakeCase(fromField)]: qout.value }`.
Impact: Если `output.from` указывает на несуществующее поле, ответ будет содержать произвольный ключ. В HTTP-surface эта логика проходит через `render-response`, который имеет дополнительные проверки.
Рекомендация: валидировать `fromField` против `outputShape.fields` на этапе компиляции (в `createGrpcServer`) или хотя бы assert в runtime.

### LOW

**L1. Нет `grpc.health.v1.Health` surface**
Evidence: `README.md:60`. Для production оркестраторы (K8s, Dokploy) ожидают health endpoint.
Рекомендация: добавить `Health` сервис в emitted proto при опции `healthCheck: true`.

**L2. Только insecure credentials**
Evidence: `README.md:61` и `src/server/create-server.ts:58` — `grpc.ServerCredentials.createInsecure()`.
Impact: Внутрикластерный трафик без mTLS.
Рекомендация: roadmap item; пока задокументировать как known limitation.

**L3. `collectShapesFromService` собирает только output-шейпы**
Evidence: `packages/runtime/src/start/build-grpc-surface.ts:38-47` и inline TODO.
Impact: Если binding имеет `row`/`rowset` input, соответствующее message не попадёт в `.proto`.
Рекомендация: реализовать полный shape registry когда появится первый модуль с row-typed inputs (уже tracked).

**L4. Нет собственного реестра `ERROR_CODES`**
Evidence: в пакете нет `src/types/result.ts` с `ERROR_CODES`. Ошибки маппятся из executor contract.
Impact: Невозможно добавить gRPC-специфичные ошибки (например, `GRPC_PROTO_LOAD_FAILED`).
Рекомендация: добавить `ERROR_CODES` по аналогии с другими пакетами.

**L5. Пробелы в тестовом покрытии**
Evidence: анализ `test/`:
- Нет теста на query с реальными данными (только `QUERY_NOT_FOUND` stub в `create-server.test.ts`).
- Нет теста на metadata / correlation propagation.
- Нет теста на `loadProtoFromString` с невалидным proto.
- Нет теста на empty bindings (`emitProto` с пустым `validated.resolved`).
- Нет теста на actor (всегда null).

## 3. Quick wins

1. Исправить `actor: null` → проброс `actorFromRequest` через `GrpcServerOptions`.
2. Добавить fallback `throw` в `scalarToProto` и `fieldTypeToProto`.
3. Заменить хардкод `'CommandResult'` на импорт `COMMAND_RESULT_SHAPE_NAME`.
4. Исправить assertion в `demo/issue-tracker-api/test/e2e/grpc.test.ts`.
5. Добавить unit-тест на `loadProtoFromString` с невалидным proto.
6. Добавить `ERROR_CODES` registry для gRPC-специфичных ошибок.

## 4. Требуют продуктового/архитектурного решения Влада

1. **Вынести `executor-contract` из `bindings-http` в shared пакет.** Это ломает публичный API `bindings-http`.
2. **Поддержка `pre[]` в gRPC.** Реализовать или явно запретить на уровне валидатора?
3. **Health-check proto и TLS/mTLS** — в каком приоритете?
4. **Переход на `@grpc/proto-loader`** вместо ручной сериализации?

## 5. Соответствие product vision

Пакет соответствует vision: gRPC — declared transport для module/service communication. Но текущий scope (emit + server без `pre[]`, без health, без actor) — это "minimal viable gRPC", а не production-ready surface. Необходимо закрыть blocker/high до того, как пакет станет публично документированным контрактом для module authors.

## 6. Definition of done для audit

- [x] Полный обзор исходников, тестов, specs, runtime integration
- [x] Проверены зависимости и направления импортов
- [x] Проверены build/test/lint (все зелёные после `pnpm -r run build`)
- [x] Проблемы ранжированы по severity с evidence и рекомендациями
- [x] Выделены quick wins vs решения, требующие Влада

Audit готов для заведения implementation tasks.
