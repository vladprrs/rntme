> **Path note:** paths in this document reflect the pre-merge layout (`rntme-cli/packages/...`, `@rntme-cli/*`). After the merge-back PR lands they move per `2026-04-30-merge-rntme-cli-back-design.md` (e.g. `apps/platform-http`, `packages/deploy/deploy-core`, `@rntme/platform-core`).

# platform control-plane — deploy на Dokploy — design

**Status:** design
**Author:** brainstorm 2026-04-19
**Location of implementation:** Dockerfile в корне parent-репо `vladprrs/rntme`; Dokploy ресурсы в project `runtime`
**Related:**
- `docs/superpowers/specs/done/2026-04-19-platform-api-design.md` — спроектировал сам сервис (§4.2 external runtime deps — Postgres, rustfs, WorkOS; §4.4 boot order)
- `docs/superpowers/specs/done/2026-04-18-rntme-cli-submodule-design.md` — механика private submodule'а
- `project_coolify_config`, `platform_domains`, `dokploy_mcp_url_gotcha` memory — инфраструктура
- `rntme_turso_target` memory — **не** применяется: Postgres здесь для control-plane, не для `@rntme/*` runtime

## 1. Problem

Platform control-plane (`@rntme-cli/platform-http`) спроектирован в `platform-api-design.md` и имеет работающий код в private submodule `rntme-cli/packages/platform-http/`. До сегодняшнего дня он ни разу не разворачивался. Нужна полноценная production-установка на Dokploy: приложение + Postgres + S3-compatible object storage + TLS + DNS, чтобы:

- `platform.rntme.com` отвечает 200 на `/health`;
- миграции накатаны;
- WorkOS AuthKit готов принимать OAuth-callback на `/v1/auth/callback`;
- bundle upload в rustfs работает (bucket создан);
- environment доступна для публикации первой версии artifact'а LLM-агентом или вручную.

## 2. Goal

Разложить deploy на три Dokploy-ресурса и описать точный порядок их создания, Dockerfile для parent-репо, полный список env-переменных и критерии готовности. Спека покрывает **инфраструктуру и deploy**, не меняет код платформы.

**In scope:**
- Dockerfile в корне `vladprrs/rntme` (multi-stage, Node 20, pnpm 9.12, filtered workspace build).
- Dokploy Postgres 16 resource.
- Dokploy Application для rustfs (S3-compatible object store).
- Dokploy Application для `platform-http` из `vladprrs/rntme` через GitHub App с `--recurse-submodules`.
- Полный список env-переменных с дефолтами и источниками.
- DNS + TLS для `platform.rntme.com`.
- Health-check и readiness criteria.
- WorkOS post-deploy настройка (Redirect URI, Webhook endpoint).

**Explicitly out of scope:**
- Оптимизация размера Docker image (`pnpm deploy` pattern) — после MVP.
- Multi-replica deploy / migration coordination — после MVP.
- Backup/restore для Postgres и rustfs — отдельная спека.
- Monitoring / alerting / Grafana dashboards — отдельная спека.
- CI (GitHub Actions build-and-push в GHCR) — опциональная альтернатива, не блокирует MVP.
- Deploy-controller / k8s / Zeebe (следующие спеки платформы).
- Production web UI для платформы.

## 3. Decisions

| # | Вопрос | Решение |
|---|---|---|
| D1 | Scope | Full production — real WorkOS, TLS, готовность к реальным tenant publish'ам |
| D2 | S3-compatible backend | rustfs (как в спеке `platform-api-design`), не MinIO |
| D3 | Domain | `platform.rntme.com`, cookie `.rntme.com` (per `platform_domains` memory) |
| D4 | Deploy source access | Установленный Dokploy GitHub App `dokploy-2026-04-06-qgg0mn`, installation 121861470 — имеет доступ к `vladprrs/rntme` (public) и `vladprrs/rntme-cli` (private) |
| D5 | Submodule checkout | `--recurse-submodules` в Dokploy application settings (GitHub App даёт токен для приватного submodule'а) |
| D6 | Dockerfile location | Корень parent-репо `vladprrs/rntme`, builds весь pnpm workspace включая rntme-cli submodule |
| D7 | Build filter | `pnpm --filter '@rntme-cli/platform-http...' build` — билдит только транзитивные deps, не весь monorepo |
| D8 | Migrations | Auto-run на boot через `runMigrations(db, pool)` в `server.ts:26`. Single-replica MVP — ОК. Вынести в отдельный pre-deploy step после multi-replica требования |
| D9 | rustfs bucket creation | `blob.ensureBucket()` в boot (`server.ts:33`). Требует IAM-прав на `CreateBucket` — rustfs в single-node mode даёт root-level доступ по access keys |
| D10 | WorkOS webhook secret | Placeholder (32 байта random) на первичный deploy; реальный секрет получим после настройки Webhook endpoint в WorkOS Dashboard и обновим env |
| D11 | Cookie password | Генерируем random 64 hex chars, хранится только в Dokploy env |
| D12 | CORS origins | `https://*.rntme.com` (schema default) |

## 4. Architecture

Три Dokploy-ресурса в project `runtime`, общаются через internal network, наружу смотрит только `platform-http`:

```
                         Internet
                            │
                            │ TLS (Let's Encrypt, Dokploy-managed)
                            ▼
             ┌─────────────────────────────────┐
             │  platform-http (Dokploy App)    │
             │  domain: platform.rntme.com     │
             │  port: 3000 (internal)          │
             │  Docker: Dockerfile in          │
             │    vladprrs/rntme root          │
             └────┬─────────────┬──────────────┘
                  │ internal    │ internal
                  ▼             ▼
        ┌──────────────┐  ┌──────────────┐
        │  Postgres 16 │  │   rustfs     │
        │  (native     │  │  (Docker     │
        │   Dokploy    │  │   App)       │
        │   resource)  │  │  port: 9000  │
        └──────────────┘  └──────────────┘
```

- Postgres и rustfs **не** имеют внешних endpoint'ов — доступны только через Dokploy internal DNS (hostnames `postgres`, `rustfs` или аналогичные из Dokploy naming convention).
- `platform-http` mounts domain `platform.rntme.com` через Dokploy Traefik + Let's Encrypt.
- DNS `*.rntme.com → server IP` уже настроен (wildcard A-record).

## 5. Dockerfile

Место: `/Dockerfile` в корне parent-репо `vladprrs/rntme`.

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

**Rationale:**
- `node:20-slim` даёт меньше attack surface чем `node:20`.
- `git` нужен в builder для `pnpm install` (resolves workspace-protocol деп через git metadata).
- `--filter '...'` с троеточием = target + all transitive workspace deps. Билдит ровно то что нужно.
- Runtime stage копирует весь `/app` — не оптимально по размеру (~500MB), но корректно resolve'ит workspace-protocol deps без pnpm deploy.

**Известные ограничения (fix в follow-up):**
- Final image размер. Оптимизация через `pnpm deploy --filter @rntme-cli/platform-http /out` в builder'е → copy только `/out` в runtime. Требует тестирования — отложено до MVP-зелёного deploy'я.
- No multi-arch. Dokploy server — x86_64, OK для первой версии.

## 6. Dokploy resources

### 6.1 Postgres 16

- **Type:** Dokploy native Postgres resource.
- **Project:** `runtime` (existing).
- **Database name:** `platform`.
- **User:** `platform`.
- **Password:** auto-generated by Dokploy.
- **Output:** internal `DATABASE_URL` в формате `postgresql://platform:<pass>@<internal-host>:5432/platform`.

### 6.2 rustfs

- **Type:** Dokploy Application (Docker image, не compose).
- **Image:** `rustfs/rustfs:latest`.
- **Ports:** internal 9000 (S3 API).
- **Volumes:** one persistent volume mounted to `/data`.
- **Env vars внутри rustfs:**
  - `RUSTFS_ACCESS_KEY=rntme-platform`
  - `RUSTFS_SECRET_KEY=<random 40 chars>`
  - `RUSTFS_VOLUMES=/data`
- **Internal hostname:** `rustfs` (или Dokploy-generated).

### 6.3 platform-http

- **Type:** Dokploy Application.
- **Source:** `vladprrs/rntme` через установленный GitHub App (`RZoyL3wWcJDcR6qy2aH9Q`).
- **Branch:** `main`.
- **Recurse submodules:** **yes** (critical — иначе `rntme-cli/` будет пустой).
- **Build:** Dockerfile в корне репо (не Nixpacks, не buildpack).
- **Container port:** 3000.
- **Domain:** `platform.rntme.com`, TLS через Let's Encrypt (Dokploy-managed).
- **Health check:** HTTP GET `/health` → 200.
- **Restart policy:** unless-stopped.

## 7. Environment variables

Всего 15 переменных. `DATABASE_URL` и `RUSTFS_ENDPOINT` автоматически связываются через Dokploy internal DNS — остальные задаём руками.

| Name | Value | Source |
|---|---|---|
| `DATABASE_URL` | `postgresql://platform:<gen>@<pg-host>:5432/platform` | Dokploy Postgres |
| `RUSTFS_ENDPOINT` | `http://<rustfs-host>:9000` | Dokploy internal |
| `RUSTFS_ACCESS_KEY_ID` | `rntme-platform` | matches rustfs config |
| `RUSTFS_SECRET_ACCESS_KEY` | `<random 40 chars>` | matches rustfs config |
| `RUSTFS_BUCKET` | `rntme-platform-bundles` | new |
| `WORKOS_API_KEY` | `sk_test_...` (provided out-of-band, set directly in Dokploy env — **not** in this doc) | user-provided |
| `WORKOS_CLIENT_ID` | `client_01KPHYXWZVVXGHC2VCGP6JPT5W` | user-provided |
| `WORKOS_WEBHOOK_SECRET` | `<random 32 bytes hex placeholder>` (set directly in Dokploy env) | real value after step 6 |
| `WORKOS_REDIRECT_URI` | `https://platform.rntme.com/v1/auth/callback` | convention |
| `PLATFORM_BASE_URL` | `https://platform.rntme.com` | |
| `PLATFORM_SESSION_COOKIE_DOMAIN` | `.rntme.com` | `platform_domains` memory |
| `PLATFORM_CORS_ORIGINS` | `https://*.rntme.com` | schema default |
| `PLATFORM_COOKIE_PASSWORD` | random 64 hex chars (generated out-of-band, set directly in Dokploy env) | generated |
| `PORT` | `3000` | matches Dockerfile `EXPOSE` |
| `LOG_LEVEL` | `info` | default |

`PLATFORM_COOKIE_PASSWORD` и `RUSTFS_SECRET_ACCESS_KEY` — секреты; хранить только в Dokploy env, не коммитить.

## 8. Deploy order

Шаги выполняются последовательно; каждый следующий требует результата предыдущего.

1. **Create Postgres resource** в Dokploy project `runtime`. Дождаться `RUNNING` status. Скопировать internal `DATABASE_URL`.
2. **Create rustfs Application** — Docker image deploy, задать access/secret keys, volume, internal port 9000. Дождаться старта, проверить S3 API через `curl http://<rustfs-host>:9000` (из любого контейнера в той же сети) → ответ 403/MissingParameter = OK.
3. **Commit Dockerfile + push** в `vladprrs/rntme` main.
4. **Create platform-http Application:**
   - source GitHub App → `vladprrs/rntme` → main;
   - `recurse submodules: true`;
   - build = Dockerfile;
   - domain = `platform.rntme.com`, TLS Let's Encrypt;
   - все 15 env vars из §7.
5. **First deploy** → watch logs. Ожидаем:
   - `pnpm install` ≈ 60–120s;
   - `pnpm --filter build` ≈ 30–60s;
   - `runMigrations` добавляет `0000_watery_human_robot.sql` + `0001_org_archived_at.sql`;
   - `blob.ensureBucket` создаёт `rntme-platform-bundles`;
   - `platform-http listening` log line;
   - `curl https://platform.rntme.com/health` → 200.
6. **WorkOS post-deploy configuration:**
   - В WorkOS Dashboard → Redirect URIs → добавить `https://platform.rntme.com/v1/auth/callback`.
   - Webhooks → Create endpoint → URL `https://platform.rntme.com/v1/webhooks/workos` → получить signing secret.
   - Обновить `WORKOS_WEBHOOK_SECRET` в Dokploy env → redeploy platform-http.
7. **Smoke test publish path (deferred — проверяется отдельно):**
   - Создать organization в WorkOS.
   - Выпустить machine API token через UI или SQL seed.
   - `curl -H "Authorization: Bearer ..."  https://platform.rntme.com/v1/projects` → 200.

## 9. Readiness criteria

Deploy считается готовым когда все пункты зелёные:

- [ ] `https://platform.rntme.com/health` → 200 с валидным JSON.
- [ ] `https://platform.rntme.com/openapi.json` → 200 с валидным OpenAPI 3.1 документом.
- [ ] TLS сертификат выдан (не self-signed).
- [ ] Postgres shows `platform` database с applied migrations (check `SELECT * FROM __drizzle_migrations`).
- [ ] rustfs shows bucket `rntme-platform-bundles`.
- [ ] WorkOS Redirect URI и Webhook endpoint настроены.
- [ ] `WORKOS_WEBHOOK_SECRET` в env = реальный signing secret из WorkOS.
- [ ] Dokploy logs для platform-http: нет `ERROR`/`FATAL` в последних 100 строках после boot.

## 10. Risks and mitigations

| Риск | Mitigation |
|---|---|
| Dokploy GitHub App не поддерживает `--recurse-submodules` корректно | Fallback: pre-build image в GHCR через GitHub Actions, Dokploy pulls image. Checkpoint на шаге 5: если submodule clone провалится, переключаемся на GHCR flow |
| rustfs `ensureBucket` падает из-за IAM | rustfs в single-node mode даёт root-level access по ключам. Если всё же падает — создать bucket руками через `aws s3 mb s3://rntme-platform-bundles --endpoint-url http://rustfs:9000` из Dokploy shell до следующего boot'а |
| `pnpm install --frozen-lockfile` падает в Docker из-за git-protocol deps | pnpm 9.12 + `git` установлен в builder stage — должно работать. Если нет — добавить `GIT_CONFIG_*` env или переключить на npm pack |
| WorkOS callback не работает до шага 6 | Ожидаемо; `/health` и `/openapi.json` работают без WorkOS. Smoke publish path откладывается до шага 6 |
| Image размер 500MB+ | Принято в MVP. Follow-up: переход на `pnpm deploy` multi-stage — отдельный change |
| Postgres data loss при пересоздании ресурса | Dokploy Postgres использует persistent volume — data survives restarts, но **не** survive delete resource. Backup strategy — out of scope этой спеки |

## 11. Rollback plan

Deploy — additive, не меняет код runtime'а, не мигрирует данные других систем:

- **Platform-http not starting:** stop Application в Dokploy, исправляем код/env, redeploy. Никакой миграции данных не накатано до удачного boot'а (миграции идемпотентны, но `__drizzle_migrations` таблица создана после первой успешной попытки).
- **rustfs broken:** delete + recreate; данных ещё нет на MVP.
- **Postgres broken:** delete + recreate, update `DATABASE_URL` в platform-http env, redeploy (миграции накатаются заново).
- **DNS / TLS:** в Dokploy отключить domain → проверить IP access → re-enable.

Нет pre-existing prod state, который можно сломать — это первая установка.

## 12. Follow-up (после MVP-зелёного)

Отдельные changes, не блокирующие первую установку:

1. `pnpm deploy` оптимизация Dockerfile → image ~100MB.
2. GitHub Actions CI: `docker build && push ghcr.io/vladprrs/rntme-platform` → Dokploy pulls image. Ускоряет deploy с ~3 минут до ~30 секунд.
3. Postgres backup в rustfs через Dokploy cron.
4. Grafana + Prometheus для Postgres, rustfs, platform-http (через Dokploy monitoring stack).
5. Отдельный pre-deploy migration step (когда будет multi-replica).
6. rustfs clustering / replication (текущая конфигурация — single-node, single-disk).

## 13. Open questions

- **OQ1:** `/v1/webhooks/workos` endpoint path — проверить в `rntme-cli/packages/platform-http/src/routes/` что именно такой path. Если отличается, обновить §8 шаг 6.
- **OQ2:** Dokploy поддерживает `--recurse-submodules` через GitHub App? Нет документированного гарантирования; узнаём эмпирически на шаге 5. Если fail — включаем §10 fallback.
- **OQ3:** Нужно ли IPv6 для Dokploy ingress? Пока игнорим; если WorkOS webhooks или клиенты потребуют — добавим AAAA.

## 14. References

- `docs/superpowers/specs/done/2026-04-19-platform-api-design.md` §4 (external deps), §5 (Postgres schema), §14 (boot order)
- `docs/superpowers/specs/done/2026-04-18-rntme-cli-submodule-design.md` — submodule mechanics
- `rntme-cli/packages/platform-http/src/config/env.ts` — env schema (source of truth for §7)
- `rntme-cli/packages/platform-http/src/bin/server.ts` — boot sequence (source for §8 step 5 log expectations)
- `rntme-cli/packages/platform-storage/drizzle/` — migrations
- `project_coolify_config`, `platform_domains`, `dokploy_mcp_url_gotcha` memory
