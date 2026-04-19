# platform control-plane — Dokploy deploy — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Развернуть `@rntme-cli/platform-http` на Dokploy с Postgres 16 + rustfs + TLS на `platform.rntme.com`, готовое принимать tenant publish'ы.

**Architecture:** Три Dokploy-ресурса в project `runtime` (env `2HJhor6CZm0SX4vLDLI4q`): Postgres resource, rustfs Application (Docker image), platform-http Application (из `vladprrs/rntme` через GitHub App с recurse-submodules). Общение через Dokploy internal network; наружу только platform-http.

**Tech Stack:** Node 20, pnpm 9.12, Hono, Drizzle, Postgres 16, rustfs S3, WorkOS AuthKit, Dokploy, Let's Encrypt.

**Reference spec:** `docs/superpowers/specs/2026-04-19-platform-deploy-dokploy-design.md`

**Known context for executor:**
- Parent repo path: `/home/coder/project/` (`vladprrs/rntme`, public).
- Submodule: `/home/coder/project/rntme-cli/` (`vladprrs/rntme-cli`, private).
- Dokploy project `runtime` ID: `RK4scgw5bryx2qolyzkSc`.
- Dokploy environment ID (production, default in project): `2HJhor6CZm0SX4vLDLI4q`.
- GitHub App `githubId`: `RZoyL3wWcJDcR6qy2aH9Q`, installation 121861470.
- All Dokploy operations go through `mcp__dokploy-mcp__*` MCP tools.
- DNS `*.rntme.com` уже указывает на Dokploy server IP.

---

## File map

Файлы, которые создаём или меняем в коде:

- **Create:** `/home/coder/project/Dockerfile` — multi-stage build platform-http из parent workspace.

Всё остальное — Dokploy API calls (MCP) и внешние UI-настройки (WorkOS Dashboard).

---

## Task 1: Создать Dockerfile в parent-репо

**Files:**
- Create: `/home/coder/project/Dockerfile`

- [ ] **Step 1.1: Написать Dockerfile**

Содержимое `/home/coder/project/Dockerfile`:

```dockerfile
# stage 1 — builder
FROM node:20-slim AS builder
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates git \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm --filter '@rntme-cli/platform-http...' build

# stage 2 — runtime
FROM node:20-slim AS runtime
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

COPY --from=builder /app /app

WORKDIR /app/rntme-cli/packages/platform-http
EXPOSE 3000
CMD ["node", "dist/bin/server.js"]
```

- [ ] **Step 1.2: Убедиться что submodule инициализирован локально**

Run:
```bash
git -C /home/coder/project submodule status
```
Expected: строка начинается с пробела (не `-` или `+`) — submodule checked out, HEAD matches.

Если submodule не инициализирован:
```bash
git -C /home/coder/project submodule update --init --recursive
```

- [ ] **Step 1.3: Верифицировать Dockerfile локальным build'ом**

Run:
```bash
docker build -t rntme-platform-test /home/coder/project
```
Expected: успешный build до строки `Successfully tagged rntme-platform-test:latest` (≈3-5 минут).

Если `pnpm install` падает — проверить что `pnpm-lock.yaml` в корне, не устарел.
Если `pnpm --filter build` падает — запустить отдельно `pnpm -F @rntme-cli/platform-http... build` вне Docker и починить.

- [ ] **Step 1.4: Smoke-run образ с фейковыми env**

Run:
```bash
docker run --rm -e DATABASE_URL=postgresql://x:y@localhost:5432/z \
  -e RUSTFS_ENDPOINT=http://localhost:9000 \
  -e RUSTFS_ACCESS_KEY_ID=x -e RUSTFS_SECRET_ACCESS_KEY=x \
  -e RUSTFS_BUCKET=x -e WORKOS_API_KEY=x -e WORKOS_CLIENT_ID=x \
  -e WORKOS_WEBHOOK_SECRET=x -e WORKOS_REDIRECT_URI=http://x/cb \
  -e PLATFORM_BASE_URL=http://x -e PLATFORM_SESSION_COOKIE_DOMAIN=x \
  -e PLATFORM_COOKIE_PASSWORD=01234567890123456789012345678901 \
  rntme-platform-test
```
Expected: процесс стартует, падает на попытке коннекта к Postgres (`ECONNREFUSED` или "getaddrinfo"). Это ОК — значит env прошёл validation, Postgres недоступен потому что не запущен.

Если падает с `Invalid environment: ...` — значит env schema требует чего-то дополнительного, зафиксировать и обновить спеку §7.

- [ ] **Step 1.5: Commit Dockerfile**

Run:
```bash
git -C /home/coder/project add Dockerfile
git -C /home/coder/project commit -m "$(cat <<'EOF'
chore(deploy): add Dockerfile for platform-http

Multi-stage Node 20 + pnpm 9.12 build, filtered to
'@rntme-cli/platform-http...' transitive deps. Runs node
on dist/bin/server.js. Used by Dokploy deploy.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 1.6: Push в main**

Run:
```bash
git -C /home/coder/project push origin main
```
Expected: "main -> main" success.

---

## Task 2: Создать Postgres resource в Dokploy

**Dokploy objects created:** один Postgres resource в project `runtime`.

- [ ] **Step 2.1: Создать Postgres через MCP**

Tool: `mcp__dokploy-mcp__postgres-create`

Args:
```json
{
  "name": "platform-pg",
  "appName": "platform-pg",
  "databaseName": "platform",
  "databaseUser": "platform",
  "dockerImage": "postgres:16-alpine",
  "environmentId": "2HJhor6CZm0SX4vLDLI4q",
  "description": "platform control-plane metadata"
}
```

Expected: response с `postgresId`, `databasePassword` (auto-generated).

**Критично:** сохранить возвращённые `postgresId` и `databasePassword` — понадобятся в Task 4.

- [ ] **Step 2.2: Задеплоить Postgres**

Tool: `mcp__dokploy-mcp__postgres-deploy`

Args: `{ "postgresId": "<id-from-2.1>" }`

Expected: deploy поехал.

- [ ] **Step 2.3: Дождаться status = RUNNING**

Tool: `mcp__dokploy-mcp__postgres-one`

Args: `{ "postgresId": "<id-from-2.1>" }`

Polling: вызывать раз в 10 секунд до `applicationStatus == "done"` (или eq.). Обычно 30-60 секунд.

Expected: status `done`, `externalPort` null (internal only), `appName` = `platform-pg-...` (Dokploy-generated suffix).

Записать `appName` — это internal hostname для DATABASE_URL.

- [ ] **Step 2.4: Собрать DATABASE_URL**

Формула:
```
postgresql://platform:<databasePassword>@<appName>:5432/platform
```

Где:
- `platform` (user + db) — из args step 2.1
- `<databasePassword>` — из response step 2.1
- `<appName>` — из response step 2.3
- `5432` — standard postgres port (internal)

Сохранить строку как переменную для Task 4.

**Commit:** этот task не меняет файлы в репо, commit не нужен.

---

## Task 3: Создать rustfs Application в Dokploy

**Dokploy objects created:** одна Application (Docker image based) + один volume mount + один port + env.

- [ ] **Step 3.1: Сгенерировать секреты для rustfs**

Run:
```bash
node -e "console.log(require('crypto').randomBytes(20).toString('base64').replace(/[+/=]/g, ''))"
```
Expected: 27 символов base64-no-pad. Сохранить как `RUSTFS_SECRET_KEY_VALUE`.

Access key фиксированный: `RUSTFS_ACCESS_KEY_VALUE = "rntme-platform"`.

- [ ] **Step 3.2: Создать Application через MCP**

Tool: `mcp__dokploy-mcp__application-create`

Args:
```json
{
  "name": "rustfs",
  "appName": "rustfs",
  "environmentId": "2HJhor6CZm0SX4vLDLI4q",
  "description": "S3-compatible object storage for platform bundles"
}
```

Expected: response с `applicationId`. Сохранить как `RUSTFS_APP_ID`.

- [ ] **Step 3.3: Установить build type = Docker image**

Tool: `mcp__dokploy-mcp__application-saveDockerProvider`

Args:
```json
{
  "applicationId": "<RUSTFS_APP_ID>",
  "dockerImage": "rustfs/rustfs:latest"
}
```

Expected: success response.

- [ ] **Step 3.4: Настроить env для rustfs**

Tool: `mcp__dokploy-mcp__application-saveEnvironment`

Args:
```json
{
  "applicationId": "<RUSTFS_APP_ID>",
  "env": "RUSTFS_ACCESS_KEY=rntme-platform\nRUSTFS_SECRET_KEY=<RUSTFS_SECRET_KEY_VALUE>\nRUSTFS_VOLUMES=/data"
}
```

Expected: success.

- [ ] **Step 3.5: Создать persistent volume mount**

Tool: `mcp__dokploy-mcp__mounts-create`

Args:
```json
{
  "serviceId": "<RUSTFS_APP_ID>",
  "serviceType": "application",
  "type": "volume",
  "volumeName": "rustfs-data",
  "mountPath": "/data"
}
```

Expected: mount created.

- [ ] **Step 3.6: Задеплоить rustfs**

Tool: `mcp__dokploy-mcp__application-deploy`

Args: `{ "applicationId": "<RUSTFS_APP_ID>" }`

Expected: deploy started.

- [ ] **Step 3.7: Дождаться status done**

Tool: `mcp__dokploy-mcp__application-one`

Args: `{ "applicationId": "<RUSTFS_APP_ID>" }`

Polling каждые 10 сек до `applicationStatus == "done"`.

Сохранить `appName` (Dokploy-generated) как `RUSTFS_HOSTNAME`.

- [ ] **Step 3.8: Проверить что rustfs отвечает (из Dokploy shell или через logs)**

Tool: `mcp__dokploy-mcp__application-readLogs`

Args: `{ "applicationId": "<RUSTFS_APP_ID>", "tail": 50 }`

Expected: строки вида "listening on 0.0.0.0:9000" или "started".

Если rustfs падает — проверить логи, чаще всего проблема в правах на volume или неправильных env. Починить и redeploy через Step 3.6.

- [ ] **Step 3.9: Собрать RUSTFS_ENDPOINT**

Формула: `http://<RUSTFS_HOSTNAME>:9000`

Сохранить как переменную для Task 4.

---

## Task 4: Создать platform-http Application

**Dokploy objects created:** Application + GitHub provider config + env (15 vars) + domain + TLS.

- [ ] **Step 4.1: Сгенерировать PLATFORM_COOKIE_PASSWORD**

Run:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Expected: 64 hex chars. Сохранить как `COOKIE_PASSWORD_VALUE`.

- [ ] **Step 4.2: Сгенерировать placeholder WORKOS_WEBHOOK_SECRET**

Run:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Expected: 64 hex chars. Сохранить как `WEBHOOK_SECRET_PLACEHOLDER`. **Замен** на реальный WorkOS signing secret в Task 6.

- [ ] **Step 4.3: Создать Application**

Tool: `mcp__dokploy-mcp__application-create`

Args:
```json
{
  "name": "platform-http",
  "appName": "platform-http",
  "environmentId": "2HJhor6CZm0SX4vLDLI4q",
  "description": "rntme platform control-plane HTTP API"
}
```

Сохранить `applicationId` как `PLATFORM_APP_ID`.

- [ ] **Step 4.4: Привязать GitHub provider с recurse submodules**

Tool: `mcp__dokploy-mcp__application-saveGithubProvider`

Args:
```json
{
  "applicationId": "<PLATFORM_APP_ID>",
  "githubId": "RZoyL3wWcJDcR6qy2aH9Q",
  "repository": "rntme",
  "owner": "vladprrs",
  "branch": "main",
  "buildPath": "/",
  "enableSubmodules": true
}
```

Expected: success. **Критично:** `enableSubmodules: true`. Если MCP не поддерживает это поле — проверить реальную схему через MCP error и подстроиться (возможно поле называется `gitSubmodules` или `recurseSubmodules`).

- [ ] **Step 4.5: Установить build type = Dockerfile**

Tool: `mcp__dokploy-mcp__application-saveBuildType`

Args:
```json
{
  "applicationId": "<PLATFORM_APP_ID>",
  "buildType": "dockerfile",
  "dockerfile": "./Dockerfile"
}
```

Expected: success. Dockerfile resolved относительно `buildPath` из step 4.4 (т.е. корня репо).

- [ ] **Step 4.6: Записать env (15 переменных)**

Tool: `mcp__dokploy-mcp__application-saveEnvironment`

Args (подставить реальные значения; `<WORKOS_API_KEY_VALUE>` и `<WORKOS_CLIENT_ID_VALUE>` берутся из WorkOS Dashboard → API Keys непосредственно перед этим шагом — **не** хранить в этом файле или где-либо ещё в git):
```json
{
  "applicationId": "<PLATFORM_APP_ID>",
  "env": "DATABASE_URL=<DATABASE_URL_FROM_TASK_2>\nRUSTFS_ENDPOINT=<RUSTFS_ENDPOINT_FROM_TASK_3>\nRUSTFS_ACCESS_KEY_ID=rntme-platform\nRUSTFS_SECRET_ACCESS_KEY=<RUSTFS_SECRET_KEY_VALUE>\nRUSTFS_BUCKET=rntme-platform-bundles\nWORKOS_API_KEY=<WORKOS_API_KEY_VALUE>\nWORKOS_CLIENT_ID=<WORKOS_CLIENT_ID_VALUE>\nWORKOS_WEBHOOK_SECRET=<WEBHOOK_SECRET_PLACEHOLDER>\nWORKOS_REDIRECT_URI=https://platform.rntme.com/v1/auth/callback\nPLATFORM_BASE_URL=https://platform.rntme.com\nPLATFORM_SESSION_COOKIE_DOMAIN=.rntme.com\nPLATFORM_CORS_ORIGINS=https://*.rntme.com\nPLATFORM_COOKIE_PASSWORD=<COOKIE_PASSWORD_VALUE>\nPORT=3000\nLOG_LEVEL=info"
}
```

Expected: success.

- [ ] **Step 4.7: Создать domain с TLS**

Tool: `mcp__dokploy-mcp__domain-create`

Args:
```json
{
  "applicationId": "<PLATFORM_APP_ID>",
  "host": "platform.rntme.com",
  "path": "/",
  "port": 3000,
  "https": true,
  "certificateType": "letsencrypt"
}
```

Expected: domain entry created. Dokploy автоматически запросит Let's Encrypt cert (подождёт DNS verification).

- [ ] **Step 4.8: Задеплоить**

Tool: `mcp__dokploy-mcp__application-deploy`

Args: `{ "applicationId": "<PLATFORM_APP_ID>" }`

Expected: deploy triggered.

- [ ] **Step 4.9: Наблюдать logs первого deploy'я**

Tool: `mcp__dokploy-mcp__application-readLogs`

Args: `{ "applicationId": "<PLATFORM_APP_ID>", "tail": 200 }`

Ожидаемая последовательность в логах:
1. `git clone https://github.com/vladprrs/rntme.git` — clone parent.
2. `git submodule update --init --recursive` — clone rntme-cli.
3. Docker build stage 1: `pnpm install --frozen-lockfile` (60-120s).
4. Docker build stage 1: `pnpm --filter ... build` (30-60s).
5. Docker build stage 2: copy + corepack.
6. Container start: `platform-http listening { port: 3000, baseUrl: https://platform.rntme.com }`.

**Если submodule НЕ склонился** (видно по тому что `rntme-cli/` пустой или build падает с "Cannot find module '@rntme-cli/platform-core'"):
- идти на fallback из спеки §10: GHCR pre-built image.
- Остановиться, создать задачу на GitHub Actions flow, сообщить пользователю.

**Если `runMigrations` падает:**
- проверить что DATABASE_URL корректно резолвится из контейнера: `application-readLogs` покажет точную ошибку.
- проверить что Postgres ещё RUNNING (`postgres-one`).

**Если `blob.ensureBucket` падает:**
- проверить `RUSTFS_ENDPOINT` резолвит: скорее всего hostname неправильный или rustfs упал.
- можно создать bucket руками через AWS CLI из любого контейнера в сети:
  ```
  aws --endpoint-url=http://rustfs:9000 s3 mb s3://rntme-platform-bundles
  ```

---

## Task 5: Verify readiness

- [ ] **Step 5.1: Дождаться TLS issuance**

Let's Encrypt verification может занять 30-120 секунд после deploy'я.

Run:
```bash
curl -sI https://platform.rntme.com/health
```
Expected: `HTTP/2 200` и `server: Traefik` или аналогичный. TLS cert — от Let's Encrypt (не Traefik default self-signed).

Если `curl: (60) SSL certificate problem` — подождать ещё 60 секунд. Если и через 5 минут не выдан — проверить `domain-one` status в Dokploy, chances are DNS не резолвится.

- [ ] **Step 5.2: Проверить /health body**

Run:
```bash
curl -s https://platform.rntme.com/health
```
Expected: валидный JSON вида `{"status":"ok",...}`.

- [ ] **Step 5.3: Проверить OpenAPI**

Run:
```bash
curl -s https://platform.rntme.com/openapi.json | jq -r '.openapi'
```
Expected: `3.1.0` или `3.1.x`.

- [ ] **Step 5.4: Проверить что миграции применены**

Подключиться к Postgres через Dokploy shell (или через postgres-proxy если включён) и выполнить:
```sql
SELECT hash, created_at FROM __drizzle_migrations ORDER BY id;
```
Expected: 2 ряда (`0000_watery_human_robot`, `0001_org_archived_at`).

Если 0 рядов — миграции не накатились, проверить application logs.

- [ ] **Step 5.5: Проверить что rustfs bucket создан**

Через `docker-uploadFileToContainer` или shell в rustfs контейнере:
```bash
ls -la /data/
```
Expected: директория `rntme-platform-bundles/` существует.

---

## Task 6: WorkOS post-deploy configuration

**Внешние UI-шаги в WorkOS Dashboard — выполняет пользователь, но плану нужно их записать.**

- [ ] **Step 6.1: Настроить Redirect URI в WorkOS**

Пользователь открывает https://dashboard.workos.com → Configuration → Redirects.

Добавить: `https://platform.rntme.com/v1/auth/callback`

- [ ] **Step 6.2: Создать Webhook endpoint в WorkOS**

Dashboard → Webhooks → Create endpoint.

- URL: `https://platform.rntme.com/v1/webhooks/workos`
- Events: как минимум `organization.created`, `organization.updated`, `organization.deleted`, `organization_membership.created`, `organization_membership.updated`, `organization_membership.deleted`, `user.updated`, `user.deleted` (точный список зависит от того, что консьюмит платформа — проверить `rntme-cli/packages/platform-http/src/routes/webhooks.ts`).
- Сохранить.

WorkOS покажет **Signing secret** вида `wh_sec_...`. Скопировать.

- [ ] **Step 6.3: Верифицировать webhook path**

Если в коде endpoint не `/v1/webhooks/workos` — найти реальный:
```bash
grep -rn "webhook" /home/coder/project/rntme-cli/packages/platform-http/src/routes/ | head
```
Обновить URL в Step 6.2 и спеке.

- [ ] **Step 6.4: Обновить WORKOS_WEBHOOK_SECRET в Dokploy**

Tool: `mcp__dokploy-mcp__application-saveEnvironment`

Args: те же 15 vars что в Task 4 Step 4.6, но `WORKOS_WEBHOOK_SECRET=<реальный wh_sec_... из WorkOS>` вместо placeholder'а.

**Альтернатива** (проще): использовать `mcp__dokploy-mcp__bulk_env_update` если инструмент есть в Dokploy MCP — обновит одну переменную без переписывания всего env.

- [ ] **Step 6.5: Redeploy platform-http**

Tool: `mcp__dokploy-mcp__application-redeploy`

Args: `{ "applicationId": "<PLATFORM_APP_ID>" }`

Expected: redeploy; logs show same startup sequence. Короче первого раза (cache слоёв) — 30-60 сек.

- [ ] **Step 6.6: Проверить что webhook endpoint отвечает**

Run:
```bash
curl -sI https://platform.rntme.com/v1/webhooks/workos -X POST -H "Content-Type: application/json" -d '{}'
```
Expected: 400 или 401 ("missing signature" / "invalid signature"). **Не** 404.

Если 404 — path неправильный, вернуться на Step 6.3.

- [ ] **Step 6.7: Тестовый webhook из WorkOS Dashboard**

В WorkOS Dashboard → Webhooks → твой endpoint → "Send test event".

Expected: ответ 2xx от endpoint'а. Application logs покажут received + verified + processed event.

---

## Task 7: Financial readiness checklist

Финальная проверка всех readiness criteria из спеки §9.

- [ ] **Step 7.1: Пройти весь чеклист**

Выполнить и убедиться что каждый пункт зелёный:

- [ ] `https://platform.rntme.com/health` → 200 с валидным JSON.
- [ ] `https://platform.rntme.com/openapi.json` → 200, openapi 3.1.
- [ ] TLS cert выдан Let's Encrypt (не self-signed). Check: `curl -v` shows issuer.
- [ ] Postgres: `SELECT * FROM __drizzle_migrations` возвращает ≥ 2 ряда.
- [ ] rustfs: bucket `rntme-platform-bundles` существует.
- [ ] WorkOS Redirect URI настроен.
- [ ] WorkOS Webhook endpoint настроен, test event проходит.
- [ ] `WORKOS_WEBHOOK_SECRET` в env = реальный wh_sec_... (не placeholder).
- [ ] Dokploy logs для platform-http: нет ERROR/FATAL в последних 100 строках после последнего deploy'я.

Если всё зелёное — deploy готов.

- [ ] **Step 7.2: Сохранить memory-заметку о production deploy'е**

Создать memory:
- filename: `project_platform_deployed.md`
- type: `project`
- content: факт, что `platform.rntme.com` живой; ID'ы Dokploy ресурсов; что WorkOS настроен; дата 2026-04-19. Why: будущие вопросы про platform URL / ресурсы не требуют повторного discovery. How to apply: на вопросы про платформу ссылаться на эти ID.

Обновить `MEMORY.md` pointer.

---

## Self-review

Self-review выполнена в процессе написания плана:

**Spec coverage:** проверены §4 (три ресурса ✓ tasks 2-4), §5 (Dockerfile ✓ task 1), §6 (все три ресурса детально ✓), §7 (все 15 env vars ✓ task 4 step 6), §8 (порядок deploy совпадает ✓ tasks 1→7), §9 (readiness criteria ✓ task 7), §10 (риски адресованы в шагах 4.9 и 5.1), §11 (rollback — implicit, каждый ресурс независимый).

**Placeholder scan:** нет TBD/TODO. Значения переменных в env блоке — placeholder-формы `<VAR_FROM_TASK_N>` указывают executor'у откуда брать — это легитимно для плана, не baked-in константы.

**Type consistency:** имена переменных (`PLATFORM_APP_ID`, `RUSTFS_APP_ID`, `RUSTFS_SECRET_KEY_VALUE`, etc.) консистентны между задачами.

---

## Execution notes for executor

- MCP tool-схемы могут отличаться от того что я описал в args (например, `enableSubmodules` vs `gitSubmodules`). При первой ошибке `InputValidationError` — смотри реальную схему через `ToolSearch`, подстраивай args.
- MCP `application-saveEnvironment` принимает весь env как строку с `\n`-разделителями — не JSON. Экранирование '\n' важно.
- WorkOS webhook setup (Task 6) — часть шагов в UI WorkOS. Если выполняешь автономно и UI недоступен — остановись на Step 6.1 и проси пользователя.
- Памятка `dokploy_mcp_url_gotcha`: `DOKPLOY_URL` env должен быть host без `/api` — MCP сам добавляет `/api`. Если MCP calls 404 — проверить.
