# Dokploy E2E + platform deployment hardening

## Objective

Успешно провести E2E проверку после последних изменений через развернутую на Dokploy платформу и задокументировать/утвердить, что deployment, авторизация и наблюдение через MCP работают корректно.

## Original Request

Нужно подготовить цель: провести успешный e2e тест с Dokploy после последних изменений, успешно развернуть platform (в `.env` уже есть `DOKPLOY_URL` и `DOKPLOY_API_KEY`), использовать `dokploy mcp` для валидации, логов и т.д., а также `AUTH0_DOMAIN`, `AUTH0_MANAGEMENT_AUDIENCE`, `AUTH0_MANAGEMENT_CLIENT_ID`, `AUTH0_MANAGEMENT_CLIENT_SECRET` для авторизации.

## Intake Summary

- Input shape: `specific`
- Audience: текущий разработчик/чемпионы команды и следующий агент, продолжавший релизный цикл
- Authority: `requested`
- Proof type: `test`
- Completion proof: задеплоенная в Dokploy актуальная версия platform и успешный E2E прогон (или чётко зафиксированные шаги/результаты проверки) с подтверждённым доступом к логам/валидации через MCP, и корректной проверкой Auth0-авторизации.
- Likely misfire: считать цель выполненной после локальных unit/integration тестов или после `dokploy`-запроса без факта успешного развертывания и завершённой E2E-проверки в развёрнутом окружении.
- Blind spots considered: доступность и корректность секретов в окружении, readiness/health целевого окружения после деплоя, и корректная граница между smoke- и full e2e в пределах допустимого времени выполнения.
- Existing plan facts: у пользователя уже есть `DOKPLOY_URL`, `DOKPLOY_API_KEY`, `AUTH0_DOMAIN`, `AUTH0_MANAGEMENT_AUDIENCE`, `AUTH0_MANAGEMENT_CLIENT_ID`, `AUTH0_MANAGEMENT_CLIENT_SECRET`; также есть `dokploy mcp`.

## Goal Kind

`specific`

## Current Tranche

Подготовить доску и выполнить первый безопасный цикл: подтвердить текущее состояние источника и инфраструктуры (`.env`/переменные, доступность Dokploy API, readiness платформы), затем выбрать и запустить первый ограниченный Worker-срез для разворачивания и верификации; при успехе продолжать следующими безопасными срезами до полного доказательства выполнения цели в финальном аудите.

## Non-Negotiable Constraints

- Никаких изменений в product-файлах без активного Worker с явно ограниченными `allowed_files`.
- Сохранять чистоту доски: источник истины — `state.yaml`.
- Не изменять данные credentials, не печатать их в открытый лог.
- Не считать цель завершённой после одного этапа, пока не выполнены требования к докладным доказательствам из `completion_proof`.
- Для каждого безопасного среза требуются верификация и receipt.

## Stop Rule

Остановить только после финального аудита с `full_outcome_complete: true`.

Не останавливать после планирования/разведки, если есть безопасный Worker-срез.

Не останавливать из-за отсутствия временно доступной инфраструктуры без создания безопасного альтернативного локального среза.

## Canonical Board

Machine truth lives at:

`docs/goals/dokploy-platform-e2e-deploy/state.yaml`

Если charter и `state.yaml` расходятся, для статусов задач, receipts и проверки истинность имеет `state.yaml`.

## Run Command

```text
/goal Follow docs/goals/dokploy-platform-e2e-deploy/goal.md.
```

## PM Loop

On every `/goal` continuation:

1. Read this charter.
2. Read `state.yaml`.
3. Run the bundled GoalBuddy update checker when available and mention a newer version without blocking.
4. Re-check the intake: original request, input shape, authority, proof, blind spots, existing plan facts, and likely misfire.
5. Work only on the active board task.
6. Assign Scout, Judge, Worker, or PM according to the task.
7. Write a compact task receipt.
8. Update the board.
9. If Judge selected a safe Worker task with `allowed_files`, `verify`, and `stop_if`, activate it and continue unless blocked.
10. If a problem, suggestion, or follow-up should become a repo artifact, create an approved issue/PR or ask the operator whether to create one.
11. Treat a slice audit as a checkpoint, not completion, unless it explicitly proves the full original outcome is complete.
12. Finish only with a Judge/PM audit receipt that maps receipts and verification back to the original user outcome and records `full_outcome_complete: true`.

Issue and PR handoffs are supporting artifacts. `state.yaml` remains authoritative.
