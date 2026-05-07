> Status: retired.
> Date: 2026-04-27.
> Current source: docs/current/owners/demo/notes-blueprint.md, docs/history/specs/active-rationale/2026-04-29-notes-demo-auth0-design.md, docs/decision-system.md, and current code/tests.
> Why retired: Superseded by the Auth0/ownership Notes demo plan; the no-auth preview deploy path is obsolete and should not guide current implementation.

# Notes Demo E2E — design

**Status:** superseded by `2026-04-29-notes-demo-auth0-design.md`
**Author:** brainstorm 2026-04-27
**Related:**
- `docs/history/specs/historical/2026-04-26-project-deploy-flow-design.md` — упомянутый ниже platform deploy-flow (PR #9, #10 в `merged CLI/platform packages`). Этот спек активирует его в проде и прогоняет первый e2e.
- `docs/history/specs/historical/2026-04-24-project-deployment-pipeline-design.md` — `deploy-core` / `deploy-dokploy` library design.
- `docs/history/specs/historical/2026-04-23-project-first-blueprint-design.md` — project-first blueprint folder shape, на которой строится Notes блюпринт.

## 1. Goal, scope, non-goals

**Goal.** Прогнать первый сквозной e2e деплой через `platform.rntme.com` против реального Dokploy на том же Hetzner-сервере, на специально написанном минималистичном Notes blueprint, и оставить деплой живым как пример. Параллельно ввести в продакшен тот самый deploy-flow (PR #9–13 в `merged CLI/platform packages`), который сейчас merged на `apps/ packages/main`, но не запущен на проде (submodule pointer в parent отстаёт, env-var отсутствует, миграция не накатана).

**В scope.**
- Новый блюпринт `demo/notes-blueprint/` (1 сущность, 2 команды, 2 query, 1 UI page).
- Локальная валидация блюпринта через `@rntme/blueprint.loadComposedBlueprint` — гейт перед прод-работами.
- Bump submodule `merged CLI/platform packages` в parent с `5d36a09` → `f971282` (apps/ packages/main HEAD).
- Установка `PLATFORM_SECRET_ENCRYPTION_KEY` (32 hex bytes, через Dokploy MCP) в env приложения platform-http.
- Применение миграции `0002_project_first.sql` на прод-Postgres (drop `service`/`artifact_version`/`artifact_tag`; create `project_version`/`deploy_target`/`deployment`/`deployment_log_line`). Миграция применяется автоматически в `runMigrations` при старте контейнера.
- Редеплой `platform-http` через push parent → Dokploy watchPaths auto-deploy.
- Smoke-проверка платформы пост-редеплоя.
- E2E walkthrough: `rntme login` → `rntme project create` → `rntme project publish` → UI: deploy-target create → click Deploy → poll до `succeeded` → ручная проверка Notes UI.
- Documentation touches.

**Non-goals.**
- Реализация / правка платформенного кода — он уже мерджнут в apps/ packages/main, активируем как есть.
- Поправки `deploy-core` / `deploy-dokploy`.
- Production mode — `mode: "preview"`, `environment: "default"`.
- Дополнительные проверки (agent-browser smoke, per-route checks).
- Очистка orphan rustfs blobs.
- Автотесты для самого Notes blueprint.

**Не-обещание.** Это не «зелёный e2e тест в CI» — это **первый ручной прогон в проде**. Если найдём баг в executor / smoke verifier / UI Deploy form — фиксим в follow-up плане, не в этом.

## 2. Notes blueprint shape

**Расположение:** `demo/notes-blueprint/` (рядом с deprecated `demo/issue-tracker-api/`).

**Файловое дерево:**

```
demo/notes-blueprint/
├── README.md
├── project.json
├── pdm/
│   ├── pdm.json                          # { "version": "1" }
│   └── entities/
│       └── Note.json
└── services/
    └── app/
        ├── service.json                  # { "kind": "domain" }
        ├── qsm/
        │   ├── qsm.json                  # { "version": "1", "relations": {} }
        │   └── projections/
        │       └── NoteView.json
        ├── graphs/
        │   ├── shapes.json
        │   ├── createNote.json
        │   ├── deleteNote.json
        │   ├── listNotes.json
        │   └── getNote.json
        ├── bindings/
        │   └── bindings.json
        ├── ui/
        │   ├── manifest.json
        │   ├── layouts/
        │   │   ├── main.spec.json
        │   │   └── main.screen.json
        │   └── screens/
        │       ├── home.spec.json
        │       └── home.screen.json
        └── seed/
            └── seed.json
```

### 2.1 `project.json`

Один сервис `app`, UI mount на `/`, без auth-middleware.

```json
{
  "name": "notes-demo",
  "services": ["app"],
  "routes": { "ui": { "/": "app" }, "http": {} },
  "middleware": { "requestContext": { "kind": "request-context" } },
  "mounts": [{ "target": "ui:/", "use": ["requestContext"] }]
}
```

Если на этапе локальной валидации обнаружится, что REST-bindings требуют отдельной HTTP-маршрутизации в `routes.http` (а не пробрасываются под UI route), добавляем `"http": { "/api": "app" }` и в bindings задаём пути `/api/notes` и аналоги.

### 2.2 PDM: `pdm/entities/Note.json`

Owned-entity сервиса `app`, со state-machine на `status` для CQRS:

- `fields`: `id` (string), `title` (string), `body` (string), `status` (string), `createdAt` (`datetime`, `generated: "createdAt"`).
- `keys`: `["id"]`.
- `stateMachine`:
  - `stateField`: `status`
  - `initial`: null
  - `states`: `["active", "deleted"]`
  - `transitions`:
    - `create`: `from=null, to=active, affects=["title","body"]`
    - `delete`: `from=active, to=deleted`

### 2.3 QSM projection: `services/app/qsm/projections/NoteView.json`

Entity-mirror проекция Note, exposes `["title","body","createdAt","status"]`. Фильтрация удалённых заметок делается в graph IR query (filter node), а не в проекции, чтобы projection-consumer не должен был знать про статусы.

### 2.4 Graphs

- `shapes.json` — обязателен для service graphs; объявляет custom shape `NoteView` (`id`, `title`, `body`, `status`, `createdAt`) потому что bindings resolver не берёт output-shapes напрямую из QSM projection names.
- `createNote.json` — `emit { aggregate:"Note", aggregateId:{$param:"id"}, transition:"create", payload:{title,body} }`. UI MVP принимает `id` как явное поле формы; `createdAt` берётся из CloudEvent time через `generated: "createdAt"`, а не из UI-generated params.
- `deleteNote.json` — `emit { aggregate:"Note", aggregateId:{$param:"id"}, transition:"delete" }`.
- `listNotes.json` — `findMany {projection:"NoteView"}` → `filter { eq: ["noteView.status", "active"] }` → `sort by noteView.createdAt desc nulls last` → `limit 100`. Output `rowset<NoteView>`.
- `getNote.json` — `findMany {projection:"NoteView"}` → `filter { eq: ["noteView.id", {$param:"id"}] }` → `limit 1`. Output `rowset<NoteView>` because current query bindings require rowset outputs.

Точные конструкции `findMany` / `filter` сверяются с фикстурами `packages/runtime/runtime/test/fixtures/issue-tracker/graphs/listIssues.json` и `searchIssues.json` при имплементации.

### 2.5 Bindings: `services/app/bindings/bindings.json`

`version: "1.0"`, ссылки на pdm/qsm/graphs через relative refs. Четыре биндинга:

- `createNote` (kind: command, http POST `/notes`).
- `deleteNote` (kind: command, http POST `/notes/{id}/actions/delete`; bindings currently support `GET`/`POST` and Hono-style `{id}` path templates, not `DELETE` or `:id`).
- `listNotes` (kind: query, http GET `/notes`).
- `getNote` (kind: query, http GET `/notes/{id}`).

`target: { engine: "sqlite", dialect: "sqlite" }` для всех bindings; every HTTP parameter includes `bindTo` and `required`.

### 2.6 UI

- `ui/manifest.json` — `version: "2.0"`, `pdmRef`, `qsmRef`, `graphSpecRef`, `bindingsRef`, route `"/"` → screen `home`, layout `main`.
- `screens/home.spec.json` — иерархия:
  - `Stack(vertical)` с детьми `createForm` + `deleteForm` + `notesList`.
  - `createForm` — поля `id`, `title`, `body`, кнопка `Add` → вызывает `createNote`.
  - `deleteForm` — поле `id`, кнопка `Delete` → вызывает `deleteNote`.
  - `notesList` — `DataList` с `repeat` по `/data/notes` (заполняется из `listNotes`), каждая строка показывает `id`, `title`, `body`, `createdAt`.
- `screens/home.screen.json` uses current UI-runtime contracts only: `paramsFromState`, `onSuccess.refetchData`, `refetchOn: ["mount"]`. Не использовать `paramsGenerated`, `paramsFromArgs`, `refetchOn: ["after:<action>"]` в этом плане — их нет в текущем runtime.
- Если ui-runtime не поддерживает какие-то элементы (`Form`, `TextInput`, `TextArea`) — деградируем: список + inline-форма из встроенных DSL-примитивов (минимум — `Stack`, `DataList`, `Text`, `Button`, `Input`).
- Принципиально что **что-то рендерится и кнопки работают**, не «pixel-perfect Form».

### 2.7 Seed: `services/app/seed/seed.json`

Один CloudEvent — welcome-заметка, чтобы UI не был пустым после деплоя. Используем UUID `00000000-0000-0000-0000-000000000001` как стабильный id для seed-заметки. Eventtype текущей конвенции — `NoteCreate` (`PascalCase(entity) + PascalCase(transition)`, см. `packages/artifacts/pdm/src/derive/event-types.ts`).

### 2.8 Локальный гейт

```bash
pnpm install --frozen-lockfile
pnpm --filter @rntme/blueprint... build
pnpm --filter @rntme/blueprint exec node --input-type=module -e "import { loadComposedBlueprint } from '@rntme/blueprint'; \
  const r = loadComposedBlueprint('../../demo/notes-blueprint'); \
  if (!r.ok) { console.error(JSON.stringify(r.errors, null, 2)); process.exit(1); } \
  console.log('ok:', Object.keys(r.value));"
```

Зелёное → продолжаем; красное → стоп, фиксим JSON, повторяем. Гейт обязателен и перед Phase 2, и непосредственно перед `rntme project publish` в Phase 3.

## 3. Platform activation (Phase 2)

**Контекст риска.** Платформа pre-stable, юзеров нет, данных нет. Destructive миграция (drop `service`/`artifact_version`/`artifact_tag`) приемлема. Порядок шагов имеет значение.

### 3.1 Шаг 1 — encryption key

```bash
openssl rand -hex 32
```

64 hex chars. **Не логировать в shared контекстах.** Записать офлайн (вне репозитория, вне memory) — если ключ потерян, все будущие encrypted Dokploy tokens становятся нерасшифровываемыми; пересоздание deploy_targets — ручной workflow.

Через Dokploy MCP: установить `PLATFORM_SECRET_ENCRYPTION_KEY=<hex>` в env application platform-http (id из `project_platform_deployed.md`).

В memory записывается только факт ввода ключа (дата, key_version=1) — **сам hex не попадает в memory**.

### 3.2 Шаг 2 — bump submodule

```bash
cd /home/coder/work/rntme
git fetch origin
git checkout f9712825e414ba009738dbe8f9919fa95fcc67b5  # apps/ packages/main HEAD
cd ..
git add apps packages/deploy packages/platform
git commit -m "chore: bump merged CLI/platform packages to f971282 (project deploy flow live)"
```

Прямой commit в parent main без PR. Pre-stable, активация известного merged-кода.

### 3.3 Шаг 3 — push и наблюдать auto-deploy

```bash
git push origin main
```

Dokploy watchPaths сматчит литеральный gitlink path `merged CLI/platform packages` в `commits[].modified` (по `dokploy_watchpaths_semantics.md`). Триггерится редеплой platform-http.

Через Dokploy MCP мониторим:
- последний deployment на app id platform-http,
- лог контейнера: `parseEnv` ok, `runMigrations` отработал без ошибок, Hono поднял слушающий порт.

Если `parseEnv` падает — env var не подхватился, чиним и перезапускаем контейнер. Если `runMigrations` падает — смотрим какая FK / зависимость ломает drop, фиксим ad-hoc psql'ом, перезапускаем. Никакого «отката миграции» — pre-stable.

### 3.4 Шаг 4 — smoke check платформы

| Проверка | Как | Ожидание |
|---|---|---|
| Сервер живой | `curl -s -o /dev/null -w "%{http_code}\n" https://platform.rntme.com/v1/auth/whoami` | `401` (без токена) |
| Новые таблицы | psql через Dokploy exec на postgres контейнере: `\dt` | `project_version`, `deploy_target`, `deployment`, `deployment_log_line` присутствуют; `service`, `artifact_version`, `artifact_tag` отсутствуют |
| UI Deploy Targets | Залогиниться (test@rntme.com), перейти `/{org}/deploy-targets` | Страница рендерится, пустой список, кнопка `[+ New target]` если у юзера scope `deploy:target:manage` |
| OpenAPI | `curl https://platform.rntme.com/openapi.json | jq '.paths | keys[]' | grep deploy-targets` | присутствует `/v1/orgs/{slug}/deploy-targets` |

**Любая проверка не прошла → стоп.** Не идём в Phase 3 пока 4/4 не зелёные.

### 3.5 Шаг 5 — Dokploy target project (опционально на этой фазе или в 4.5)

Через Dokploy MCP — создать project `rntme-demos`, без приложений. Сохранить `dokployProjectId`. Зачем: изоляция от `platform-http` / `landing` / прочих стеков; чистая идентификация demo-ресурсов; ограничение blast radius для нового Dokploy API token (см. 4.5).

## 4. E2E walkthrough (Phase 3)

После того как Phase 1 (blueprint local) и Phase 2 (platform activation) зелёные.

### 4.1 CLI prerequisites

```bash
pnpm install --frozen-lockfile
pnpm -F @rntme/cli build
alias rntme="node /home/coder/work/rntme/apps/cli/dist/bin/rntme.js"

rntme login
# WorkOS AuthKit (через test@rntme.com) или PAT с /tokens
rntme whoami
```

### 4.2 Создать project в платформе

```bash
rntme project create notes-demo
```

Записать `projectSlug=notes-demo`, `projectId` (UUID).

### 4.3 Локальная re-валидация блюпринта

Повтор гейта из 2.8. Свежесть.

### 4.4 Publish

```bash
rntme project publish --folder demo/notes-blueprint
```

Server-side flow: bundle (canonical JSON, ≤10MB) → re-validate через `loadComposedBlueprint` в server-tmpdir → SHA-256 → upsert blob в rustfs → INSERT `project_version`. Вывод: `Published as version #1, digest sha256:<short>`.

Idempotent: повторный publish того же блюпринта возвращает `Already published as version #1`.

### 4.5 Dokploy API token + project

Если `rntme-demos` project ещё не создан в 3.5 — создаём сейчас. Сгенерировать **новый Dokploy API token** для этого project (не реюзаем application-one токен — изолируем blast radius).

### 4.6 Создать deploy_target в platform UI

`https://platform.rntme.com/{org}/deploy-targets` → `[+ New target]`:

- `slug`: `dokploy-demos`
- `displayName`: `Demos Dokploy (Hetzner)`
- `kind`: `dokploy`
- `dokployUrl`: `https://<dokploy-host>` (без `/api`, по `dokploy_mcp_url_gotcha.md`)
- `dokployProjectId`: `<id from 4.5>`
- `allowCreateProject`: false
- `apiToken`: `<dokploy api token from 4.5>`
- `eventBus`: `{ kind: "kafka", brokers: ["redpanda:9092"], topicPrefix: "rntme-notes-demo" }` — заполняем placeholder если форма требует, иначе оставляем default. `mode: "preview"` не использует bus в runtime.
- `policyValues`: `{ rateLimit: { default: { requestsPerMinute: 60, burst: 20 } }, bodyLimit: { default: { maxBodySize: "2m" } }, timeout: { default: { upstreamTimeoutMs: 30000 } } }`
- `isDefault`: true

Submit → видим запись, `apiToken: ***` редактирована.

### 4.7 Запустить deployment

`/{org}/projects/notes-demo` → секция Versions → `#1` → `[Deploy]` форма:

- `target`: `dokploy-demos` (default).
- `configOverrides`: `{}` (нет integration modules в Notes).

Submit → 303 redirect на `/{org}/projects/notes-demo/deployments/<id>`.

### 4.8 Наблюдать deployment detail page

Polling `/logs?sinceLineId=` каждые 2 сек. Видим прогресс по шагам: `init` → `plan` → `render` → `apply` → `verify` → `finalize`.

**Hard gate.** E2E считается пройденным **только если все нижеследующие истинны** (см. 5.3):

1. `deployments.status = 'succeeded'` (НЕ `succeeded_with_warnings`).
2. `verification_report.checks` все `ok=true`, `partialOk=false`.
3. Edge URL отдаёт Notes UI без console errors.
4. Создание новой заметки через форму → POST `createNote` 2xx → последующий GET `listNotes` возвращает её.
5. Удаление через UI → 2xx → пропадает из списка.
6. Перезагрузка страницы — состояние сохранилось.

Любой пункт false → не считается успехом, открываем follow-up.

### 4.9 Записать факт прогона в memory

`~/.claude/projects/-home-coder-project/memory/notes_demo_deployed.md`: deploymentId, дата, edge URL, какой Dokploy project, открытые косяки если есть.

(Опционально) скриншот UI для landing/PR — снимаем по факту.

## 5. Risks, error handling, rollback

### 5.1 Risk register

| # | Риск | Где всплывёт | Митигация / реакция |
|---|---|---|---|
| R1 | `parseEnv` падает после редеплоя — env var не подхватился или формат не 64 hex | 3.3, container fail to start | Env var ставится в 3.1 **до** bump submodule. Если всё равно падает — через MCP проверяем что переменная видна в env application. |
| R2 | Миграция падает на FK | 3.3, `runMigrations` лог | Просмотр лога, ad-hoc psql DROP конфликтующего объекта, рестарт контейнера. |
| R3 | Bindings не маршрутизируются edge-nginx (404 на `/commands/createNote`) | 4.8, DevTools Network | Добавить `routes.http: { "/api": "app" }` в `project.json`, перепаблишить новую версию, redeploy. |
| R4 | DNS-имя контейнера коллидит с уже работающими стеками | 4.7-4.8, apply падает или поднимается «не тот» Postgres | Деплой использует детерминированные имена `<project>-<service>-<resource>` (`notes-demo-app`, `notes-demo-postgres`). Если коллизия — переименовать demo project в `notes-demo-2` и перепаблишить. (Memory: `dokploy_compose_dns_collision.md`.) |
| R5 | Smoke verifier таймаутит — edge ещё не подхватил DNS | 4.8, `failed` со статусом `timeout` | Кликнуть Deploy ещё раз — apply идемпотентен, второй прогон поднимет verifier против устаканившегося edge. |
| R6 | Heartbeat таймаут — executor завис | 4.8, `failed_orphaned` через 60с | Логи platform-http контейнера в Dokploy — реальный stack trace там. Это баг executor'а, фиксим в follow-up. |
| R7 | UI не работает на edge — `succeeded` row, но белый экран / fetch падает | 4.9 | По hard gate (5.3) — **это провал прогона**. Фиксим. |
| R8 | Dokploy API token / encryption key утёк в логи / MCP response | На любом шаге | По `dokploy_mcp_leaks_secrets.md`: не вставлять MCP-ответы в shared контексты. После прогона ротировать Dokploy токен; encryption key никогда не печатать. |
| R9 | Encryption key потерян / не сохранён | После Phase 2 | Все existing `deploy_target.api_token_ciphertext` перестают расшифровываться. Реакция: пересоздать deploy_targets вручную через UI; миграция дешифрования — отдельный спек. **Поэтому ключ записывается офлайн в момент генерации (3.1).** |
| R10 | Локальная валидация blueprint'а проходит, а server-side нет (версии `@rntme/blueprint` разошлись) | 4.4 | Платформа использует `@rntme/blueprint` той же checkout-точки что apps/ packages/f971282. Расхождение возможно если parent workspace ушёл вперёд после bump'а. Реакция: повторно локально валидировать из той же точки, или bump'нуть submodule до соответствия. |

### 5.2 Откат не определён

Phase 2 changes (миграция + новые таблицы + env var + bump submodule) на pre-stable платформе нужны независимо от того прошёл ли demo. Если Phase 3 упал:

1. Deployment остаётся в БД в `failed` / `succeeded_with_warnings` — это запись истории, не сломанный state. Повторно жмём Deploy (идемпотентно).
2. Полу-созданные ресурсы в Dokploy подмонтируются apply'ом следующего прогона до ожидаемого состояния. Если что-то ушло в безнадёжное — удаляем вручную через Dokploy MCP (project `rntme-demos` именно для этого изолирован).
3. Если Phase 2 миграция упала — Phase 3 даже не стартует, фиксим миграцию, повторяем редеплой. Никакого «отката миграции».

### 5.3 Hard-gate определение «успеха»

Перечислено в 4.8. Дублирую здесь как самостоятельный раздел для удобства:

1. `deployments.status = 'succeeded'` (НЕ `succeeded_with_warnings`).
2. `verification_report.checks` все `ok=true`, `partialOk=false`.
3. Edge URL отдаёт Notes UI без console errors.
4. Создание новой заметки → POST 2xx → видна в `listNotes`.
5. Удаление → 2xx → пропадает из списка.
6. Reload — состояние сохранилось.

### 5.4 Что НЕ откатываем при провале

- Submodule bump в parent — оставляем (новый код корректен, прод его и так требует).
- Encryption key — оставляем.
- Миграция БД — оставляем (старые таблицы pre-stable).
- Deploy_target в платформе — оставляем (ретраи).
- Dokploy `rntme-demos` project — оставляем; ручная очистка только если деплой создал мусор.

## 6. Documentation touches

| Файл | Меняется? | Что |
|---|---|---|
| `CLAUDE.md` Architecture in one paragraph | Нет | Текущая фраза уже описывает прод-shape. |
| `AGENTS.md` package index / how-tos / glossary | Нет | Структура пакетов не меняется. |
| `README.md` packages table / dep graph | Нет | Bump submodule таблицу не меняет. |
| Per-package READMEs | Нет | Уже отражают мерджнутый Track 1+2 код. |
| `vision.md` | Нет | Не buyer-facing change. |
| `docs/architecture.md` | Нет | Архитектура та же. |
| `demo/notes-blueprint/README.md` | **Да, новый** | Что это за демо, scope, как локально валидировать, ссылка на этот спек. |

Решение для CLAUDE.md mandate: «no docs need updating in main project tree — recorded decision; новые файлы только в самом блюпринте и в specs/».

## 7. Plan split


Phase 1 (blueprint local), Phase 2 (platform activation), Phase 3 (e2e walkthrough) — phases внутри одного плана. Каждая phase имеет внутренний gate (Phase 1 = `loadComposedBlueprint` ok; Phase 2 = 4 smoke checks зелёные; Phase 3 = hard gate из 5.3). `executing-plans` встанет на ближайшем красном.

## 8. Why this shape

Три ответственности остаются разделёнными:

- `@rntme/blueprint` валидирует композицию проекта.
- `@rntme/deploy-core` + `@rntme/deploy-dokploy` планируют и применяют деплой.
- `platform-http` оркестрирует интент пользователя (CLI publish, UI Deploy click) и наблюдаемость.

Этот спек ничего не строит — он активирует уже мерджнутый код в проде на уже существующей инфраструктуре, и доказывает работоспособность одним сквозным прогоном на минимальном блюпринте. Минимальный блюпринт (Notes) — необходимый артефакт демо, не реальный продукт; его файловая структура заведомо повторяет рабочую фикстуру `product-catalog-project`, чтобы расхождения между «фикстурой для тестов» и «блюпринтом для прод-деплоя» не маскировали баги.

Hard-gate определение успеха (5.3) — единственный критерий «прошли» / «не прошли», по решению пользователя в брейнсторме. `succeeded_with_warnings` не считается успехом, чтобы UI-уровень был доказан, а не оптимистично принят.
