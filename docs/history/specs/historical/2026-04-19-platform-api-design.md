> Status: historical.
> Date: 2026-04-19.
> Current source: docs/current/**, docs/decision-system.md, and current code/tests.
> Why retained: Historical rationale and execution context retained for review; it is not current-state truth by itself.

> **Path note:** paths in this document reflect the pre-merge layout (`rntme-cli/packages/...`, `@rntme-cli/*`). After the merge-back PR lands they move per `2026-04-30-merge-rntme-cli-back-design.md` (e.g. `apps/platform-http`, `packages/deploy/deploy-core`, `@rntme/platform-core`).

> **Errata 01 (2026-04-19, same-day):** a post-landing code review found
> several drift points from this design. See
> `docs/history/specs/historical/2026-04-19-platform-api-errata-01.md` for the
> authoritative corrections to §5.5 (RLS middleware), §5.2 (schema +
> organization.archived_at), §8.5 (org-deleted cascade), §7 (slug
> immutability), §9.2 (error-code registry), §14 (body-size caps), and
> §6 (canonical-json upload). This document is preserved unchanged as a
> historical artifact.

# platform API — дизайн control-plane (registry + validation gate)

**Status:** design
**Author:** brainstorm 2026-04-19
**Location of implementation:** `rntme-cli/packages/` (private submodule `vladprrs/rntme-cli`)

## 1. Problem

Следующая ступень rntme — multi-tenant control-plane, в котором LLM-агенты и люди создают **проекты** (группы сервисов), внутри них **сервисы**, и **публикуют bundle'ы артефактов** (`manifest.json` + `pdm.json` + `qsm.json` + `graph-ir.json` + `bindings.json` + `ui.json` + `seed.json`), которые позже бутят `@rntme/runtime`. Нужен единый API, который:

- служит реестром проектов/сервисов/версий (как npm для пакетов или Vercel для проектов);
- **валидирует** каждую публикуемую версию `@rntme/*` 4-слойным конвейером до её принятия, чтобы в реестре лежали только гарантированно загружаемые артефакты;
- хранит сам bundle в object-storage, приспособленном под будущий FUSE/mount-в-контейнер (`rustfs`);
- изолирует tenant'ов (orgs) на уровне БД, а не только application-layer;
- даёт стабильные коды ошибок и идемпотентную семантику, подходящую для LLM-генерации (агент должен уметь повторить запрос без побочных эффектов).

Развёртывание и исполнение опубликованных сервисов (deploy-controller, k8s, Zeebe) — **не** в этой спеке; это следующий брейншторм.

## 2. Goal

Спроектировать пакет(ы) в приватном субмодуле `rntme-cli/`, реализующие HTTP API control-plane для:

1. `Organization` (implicit) → `Project` → `Service` → `ArtifactVersion` CRUD;
2. publish-flow с 4-слойным валидационным gate (parse → structural → references → consistency) по `@rntme/*` валидаторам и content-addressed сохранением bundle'а в rustfs;
3. movable `ArtifactTag`'ов поверх immutable versions (`stable`, `preview`, etc.);
4. machine-API-tokens для агентов и CLI, human-auth через WorkOS AuthKit, multi-tenant RLS в Postgres;
5. transactional outbox с событием `artifact.version.published` — на вход будущему deploy-controller'у.

**In scope:**
- Три новых workspace-пакета: `@rntme-cli/platform-core`, `@rntme-cli/platform-storage`, `@rntme-cli/platform-http`.
- Postgres schema + Drizzle migrations.
- rustfs (S3-compatible) client для bundle-файлов.
- WorkOS AuthKit интеграция + webhook sync.
- REST + OpenAPI 3.1 (эмитится из Zod-схем).
- Stable error-code registry.
- Observability (pino structured logs, request IDs, audit_log).

**Explicitly out of scope:**
- Deploy-controller / service runtime orchestration (следующая спека).
- Web UI для платформы (будущая спека, поверх этого API).
- Zeebe integration для cross-service sagas (`project_platform_vision` roadmap).
- gRPC surface (добавляется в платформу как отдельный пакет `@rntme-cli/platform-rpc` когда понадобится deploy-controller'у).
- Auto-semver diff worker (зарезервировано, Q6 обсуждение).
- Billing, quotas сверх базового rate-limit'а.
- Retention / GC orphan blobs (зарезервировано).

## 3. Decisions matrix

| # | Решение |
|---|---|
| Q1 | Surface — HTTP control-plane service (не in-process библиотека) |
| Q2 | Hand-written, **не** rntme-dogfood (платформа не self-generated) |
| Q3 | Multi-tenant с day one |
| Q4 | Content-addressed storage в rustfs (каждый файл → sha256-key) |
| Q5 | Registry + validation gate; deploy — другая спека |
| Q6 | Monotonic `seq` per service + movable tags + `bundleDigest` + `previousVersionId` |
| Q7 | Postgres (не SQLite) — для RLS, composite-FK, зрелого multi-tenant |
| Q8 | REST + OpenAPI 3.1 (эмит из Zod) |
| Q9 | WorkOS AuthKit (humans) + local API tokens (machines), identity-seam |

## 4. Architecture & package boundaries

### 4.1 Package layout

```
rntme-cli/
  packages/
    cli/                     existing — HTTP-клиент (будущие команды, вне этой спеки)
    platform-core/           domain + use-cases + seam interfaces
    platform-storage/        Drizzle/Postgres + rustfs S3 adapter
    platform-http/           Hono server, REST+OpenAPI, WorkOS, boot
```

Стрелка — "depends on":

```
@rntme-cli/platform-http ──┬─→ @rntme-cli/platform-core
                           └─→ @rntme-cli/platform-storage ──→ @rntme-cli/platform-core

@rntme-cli/platform-core ──→ @rntme/pdm, @rntme/qsm, @rntme/bindings,
                             @rntme/graph-ir-compiler, @rntme/seed, @rntme/ui
                             (validators only; workspace:* через submodule boundary)

@rntme-cli/cli            ──→ (HTTP client; не импортирует platform-* напрямую)
```

**Invariant.** `platform-core` не импортирует Hono/Drizzle/AWS-SDK/WorkOS-SDK — ядро unit-тестируемо с in-memory фейками и готово к альтернативным транспортам (gRPC, MCP, in-process embed) без изменений.

### 4.2 External runtime deps

- **Postgres 16+** — метаданные.
- **rustfs** (S3-compatible Rust object store) — bundle-файлы, клиент `@aws-sdk/client-s3` с custom `endpoint`.
- **WorkOS AuthKit** — human identity, OrgMembership source of truth. SDK `@workos-inc/node`.

### 4.3 Consumers (не в скоупе спеки, задают контракт)

- `@rntme-cli/cli` — будущие команды `rntme login`, `rntme project create`, `rntme publish`.
- LLM-агенты — прямой HTTP/JSON с `Authorization: Bearer rntme_pat_…`.
- Будущий Web UI платформы.
- Будущий deploy-controller — подписка на `artifact.version.published` через outbox.

### 4.4 Boot order в `platform-http` (`main()`)

1. Read env, Zod-validate, fail-fast on missing.
2. Drizzle pool → `PgProjectRepo`, `PgServiceRepo`, `PgArtifactRepo`, `PgMembershipMirrorRepo`, `PgTokenRepo`, `PgAuditRepo`, `PgOutboxRepo`, `PgWorkosEventLogRepo`.
3. `S3BlobStore` (rustfs endpoint + creds + bucket).
4. `WorkOSAuthKitProvider` + `ApiTokenProvider`.
5. `PlatformCore` — фасад use-case'ов с инжектированными seam-импл'ами.
6. Mount Hono routes; start listener on `PORT`.

## 5. Data model (Postgres)

Все tenant-scoped таблицы содержат `org_id UUID NOT NULL` и попадают под RLS policy `org_id = current_setting('app.org_id')::uuid`. `organization` и `account` — не под RLS (нужны для cross-org lookup'ов типа `workos_user_id → account`).

### 5.1 Identity mirrors (source of truth — WorkOS)

**`account`**
- `id` UUID PK
- `workos_user_id` TEXT UNIQUE NOT NULL
- `email` TEXT (кэш)
- `display_name` TEXT (кэш)
- `deleted_at` TIMESTAMPTZ NULL
- `created_at`, `updated_at`

**`organization`**
- `id` UUID PK
- `workos_organization_id` TEXT UNIQUE NOT NULL
- `slug` TEXT UNIQUE — `[a-z0-9-]{3,40}`, reserved list: `api`, `oauth`, `health`, `v1`, `admin`, `ready`, `openapi`
- `display_name` TEXT (кэш)
- `created_at`, `updated_at`

**`membership_mirror`** (write-only от webhook handler'а)
- `org_id` UUID FK → `organization`
- `account_id` UUID FK → `account`
- `role` TEXT — `admin | member` (плюс custom роли из WorkOS dashboard если появятся)
- `updated_at`
- PK `(org_id, account_id)`

**`workos_event_log`** — webhook idempotency
- `event_id` TEXT PK
- `event_type` TEXT
- `processed_at` TIMESTAMPTZ

### 5.2 API tokens (owned by platform)

**`api_token`**
- `id` UUID PK
- `org_id` UUID FK, `account_id` UUID FK
- `name` TEXT (human label: "laptop-cli", "claude-agent")
- `token_hash` BYTEA — SHA-256 от plaintext'а
- `prefix` TEXT(12) — первые 12 chars plaintext для быстрого lookup
- `scopes` TEXT[]
- `last_used_at` TIMESTAMPTZ NULL
- `expires_at` TIMESTAMPTZ NULL
- `revoked_at` TIMESTAMPTZ NULL
- `created_at` TIMESTAMPTZ
- Index: `(prefix)` — auth hot-path; `(org_id, revoked_at)` — list.

Plaintext формат: `rntme_pat_<22-char-base62-random>`.

### 5.3 Project / Service / Version / Tag

**`project`**
- `id` UUID PK
- `org_id` UUID FK (RLS)
- `slug` TEXT — `[a-z0-9-]{3,60}`; UNIQUE `(org_id, slug)`
- `display_name` TEXT
- `archived_at` TIMESTAMPTZ NULL
- `created_at`, `updated_at`

**`service`**
- `id` UUID PK
- `org_id`, `project_id` UUID FK
- `slug` TEXT; UNIQUE `(project_id, slug)`
- `display_name` TEXT
- `archived_at` NULL
- `created_at`, `updated_at`

**`artifact_version`**
- `id` UUID PK
- `org_id`, `service_id` UUID FK
- `seq` INTEGER NOT NULL — monotonic per service; UNIQUE `(service_id, seq)`
- `bundle_digest` TEXT NOT NULL — sha256 полного bundle'а; UNIQUE `(service_id, bundle_digest)` (idempotency)
- `previous_version_id` UUID FK → `artifact_version` NULL
- `manifest_digest`, `pdm_digest`, `qsm_digest`, `graph_ir_digest`, `bindings_digest`, `ui_digest`, `seed_digest` — TEXT (sha256 per-file; rustfs key)
- `validation_snapshot` JSONB — `{ rntmePdmVersion, rntmeQsmVersion, ... }` для репродуцируемости
- `published_by_account_id` UUID FK → `account`
- `published_by_token_id` UUID FK → `api_token` NULL
- `published_at` TIMESTAMPTZ
- `message` TEXT NULL — commit-like свободная строка

CHECK (triggered): `previous_version_id IS NULL OR EXISTS(SELECT 1 FROM artifact_version p WHERE p.id = previous_version_id AND p.service_id = service_id)`.

Index: `(service_id, seq DESC)` — list/latest.

**`artifact_tag`** (movable pointers)
- `service_id` UUID FK
- `name` TEXT — `[a-z0-9_-]{1,40}`
- `version_id` UUID FK → `artifact_version`
- `updated_at`, `updated_by_account_id` UUID FK
- PK `(service_id, name)`

### 5.4 Audit & outbox

**`audit_log`**
- `id` BIGSERIAL PK
- `org_id` UUID
- `actor_account_id` UUID FK, `actor_token_id` UUID FK NULL
- `action` TEXT — `project.created | project.archived | service.created | service.archived | version.published | tag.moved | tag.deleted | token.created | token.revoked | member.synced | …`
- `resource_kind`, `resource_id` TEXT
- `payload` JSONB
- `created_at` TIMESTAMPTZ
- Index: `(org_id, created_at DESC)`.

**`event_outbox`** (transactional outbox pattern)
- `id` BIGSERIAL PK
- `org_id` UUID
- `event_type` TEXT — `artifact.version.published | tag.moved | …`
- `payload` JSONB
- `created_at` TIMESTAMPTZ
- `delivered_at` TIMESTAMPTZ NULL
- Index: `(delivered_at NULLS FIRST, id)` — poller gets non-delivered earliest-first.

### 5.5 RLS

Каждая tenant-scoped таблица:

```sql
ALTER TABLE <t> ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON <t>
  USING (org_id = current_setting('app.org_id')::uuid)
  WITH CHECK (org_id = current_setting('app.org_id')::uuid);
```

Middleware выставляет `SET LOCAL app.org_id = '…'` после аутентификации. Отсутствие setup'а → SELECT вернёт 0 rows, INSERT упадёт (NOT NULL `org_id`). Fail-closed by construction.

## 6. Publish flow (validation gate)

`POST /v1/orgs/:orgSlug/projects/:projSlug/services/:svcSlug/versions` — scope `version:publish`.

Request body (JSON, max 10 MiB):

```json
{
  "bundle": {
    "manifest": {...}, "pdm": {...}, "qsm": {...}, "graphIr": {...},
    "bindings": {...}, "ui": {...}, "seed": {...}
  },
  "previousVersionSeq": 41,
  "message": "add priority field to issue",
  "moveTags": ["preview"]
}
```

### Steps

1. **Auth** (middleware). Извлечь Bearer-token; `ApiTokenProvider.authenticate()` → `AuthSubject` или 401. Проверить scope `version:publish` → иначе 403. `SET LOCAL app.org_id = <orgId>`.

2. **Parse** (`platform-core`). `PublishRequestSchema` — Zod. Ошибка → 400 `PLATFORM_PARSE_BODY_INVALID`.

3. **Resolve tenancy.** `orgSlug → org.id` (должен совпадать с subject; иначе 403). `(org.id, projSlug) → project.id`, `(project.id, svcSlug) → service.id`. 404 если не найдено. 410 если `archived_at IS NOT NULL`.

4. **Cross-artifact validation.** Порядок: `pdm → qsm → graph-ir → bindings → ui → seed → manifest`. Каждый слой — public `validate()` из `@rntme/<pkg>`. Кросс-зависимости передаются через branded `Validated*` типы (QSM принимает `ValidatedPdm`; bindings — `ValidatedPdm + ValidatedQsm`; graph-ir — `ValidatedPdm + ValidatedQsm`; ui — `ValidatedBindings + ValidatedQsm`; seed — `ValidatedPdm`; manifest — все). Любой `err` прерывает; возвращается `ValidationReport { failingPkg, failingLayer, errors: [{ code, path, message }] }`. HTTP 422, внешний code `PLATFORM_VALIDATION_BUNDLE_FAILED`, вложенные `@rntme/*` codes передаются как есть.

5. **Content-addressing & upload.** Для каждого из 7 файлов: `canonical_json(file) → sha256 → digest`. `bundleDigest = sha256(digest_manifest || digest_pdm || … || digest_seed)` (фиксированный порядок). **Idempotency check**: `SELECT FROM artifact_version WHERE service_id = :id AND bundle_digest = :d` → если есть, 200 OK с существующей версией. Иначе upload каждого файла в rustfs key `sha256/<first-2>/<digest>.json`. Retry 3× exponential backoff; окончательная ошибка → 502 `PLATFORM_STORAGE_BLOB_UPLOAD_FAILED`.

6. **Transaction.**
   - `BEGIN`, `SET LOCAL app.org_id = …`.
   - `pg_advisory_xact_lock(hashtext(service_id::text))` — serialize concurrent publish'ы на один сервис.
   - Если `previousVersionSeq` задан: `SELECT MAX(seq) FROM artifact_version WHERE service_id = …` → сравнить; несовпадение → 409 `PLATFORM_CONCURRENCY_VERSION_CONFLICT`.
   - `INSERT artifact_version` с `seq = max+1`, `previous_version_id = latest.id`, `validation_snapshot = <pinned versions>`.
   - Для каждого из `moveTags`: `INSERT INTO artifact_tag (…) ON CONFLICT (service_id, name) DO UPDATE SET version_id = EXCLUDED.version_id, updated_at = now(), updated_by_account_id = …`.
   - `INSERT audit_log` (`version.published`, `tag.moved` × N).
   - `INSERT event_outbox (event_type='artifact.version.published', payload=...)`.
   - `COMMIT`.

7. **Response** 201:
   ```json
   {
     "version": {
       "seq": 42,
       "bundleDigest": "sha256:a3f1…",
       "previousVersionSeq": 41,
       "publishedAt": "2026-04-19T12:34:56Z",
       "moveTags": ["preview"]
     }
   }
   ```

**Canonical-JSON.** Sorted keys, no whitespace; используем `@truestamp/canonify` или эквивалент. Не включает пробелы/CRLF → digest устойчив к форматированию.

## 7. CRUD endpoints (summary)

Полный inventory — §11. Здесь — инварианты:

- **Slug immutable.** `project.slug`, `service.slug`, `organization.slug` не меняются через API (ломают rustfs пути и внешние ссылки). Переименование = создать новый + archive старого.
- **Soft delete only в MVP.** `archived_at` ставится; hard delete — admin-only endpoint вне MVP.
- **Archived resource** возвращает 410 Gone на write-запросах; read-запросы — 200, но resource явно маркируется `archivedAt`.
- **Version immutable.** Нет `PATCH`/`DELETE` для `artifact_version`. Retention — вне MVP.
- **Tag rewritable & deletable.** Удаление tag'а не трогает версию.
- **Member management is delegated to WorkOS.** Платформа не даёт endpoint'ов на add/remove member — всё в WorkOS dashboard. Webhook синхронизирует mirror.
- **Personal org** создаётся автоматически из WorkOS `organization_membership.created` события при первом login'е (если пользователь ещё не в org'е → WorkOS auto-provisions его personal).

## 8. Auth & multi-tenancy (WorkOS AuthKit)

### 8.1 Identity-seam

```ts
// platform-core/src/auth/provider.ts
export interface IdentityProvider {
  readonly name: string;
  authenticate(ctx: AuthContext): Promise<Result<AuthSubject, AuthError>>;
}

export interface AuthSubject {
  account: { id: string; workosUserId: string; displayName: string; email: string };
  org:     { id: string; workosOrgId: string; slug: string };
  role:    'admin' | 'member';
  scopes:  string[];
  tokenId?: string;
}
```

Провайдеры в `platform-http`: `[ApiTokenProvider, WorkOSAuthKitProvider]`. Первый, кто опознал credentials, — выигрывает. Никто — 401.

### 8.2 WorkOS flow (humans)

- `GET /v1/auth/login` — redirect на AuthKit hosted page через `workos.userManagement.getAuthorizationUrl({ provider: 'authkit', ... })`.
- `GET /v1/auth/callback?code=…` — `authenticateWithCode({ code })` → `{ user, organizationId, sealedSession }`. Upsert mirrors (defensive, на случай если webhook опоздал). Установить sealed session cookie (HttpOnly, SameSite=Lax, Secure, Domain=`.rntme.com`).
- `POST /v1/auth/logout` — `getLogoutUrl()` redirect + clear cookie.
- **Org switching** — через WorkOS UI (в MVP у нас один org per subject за раз; refresh session при смене).

### 8.3 API tokens (machines)

- `POST /v1/orgs/:o/tokens` создаёт. plaintext = `rntme_pat_<22-char-base62>`, `hash = sha256(plaintext)`, `prefix = plaintext[0..12]`. Response возвращает plaintext **один раз**; потом только hash в БД.
- Auth middleware: `SELECT FROM api_token WHERE prefix = :first12 AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now())` → `timingSafeEqual(row.token_hash, sha256(plaintext))`. Async update `last_used_at = now()`.
- Rate limit: 1000 req/min per token; 100 publish/hour per token. In-memory sliding window в MVP.

### 8.4 Scope set

| Scope | Доступ |
|---|---|
| `project:read` | list/get projects, services, versions, tags |
| `project:write` | create/archive project, service; move/delete tags |
| `version:publish` | POST new version |
| `member:read` | list member mirrors |
| `token:manage` | list/create/revoke tokens в своей org |

Role → scopes (для WorkOS-session):
- `admin` → все 5 scopes.
- `member` → `project:read, project:write, version:publish`.

Token scopes — явный opt-in при создании; ⊆ scope'ов создателя.

### 8.5 WorkOS webhook sync

Endpoint `POST /v1/webhooks/workos`. Signature validation через `webhooks.verifyHeader(body, sig, WORKOS_WEBHOOK_SECRET)`. Idempotency через `workos_event_log`.

Обрабатываемые events:
- `user.created` / `user.updated` → upsert `account`.
- `user.deleted` → `account.deleted_at = now()`.
- `organization.created` / `updated` → upsert `organization`.
- `organization.deleted` → cascade: archive всех projects, revoke все tokens org'а.
- `organization_membership.created` → upsert `membership_mirror`.
- `organization_membership.deleted` → delete row.

## 9. Error handling

### 9.1 Result pattern

`platform-core` — `Result<T, E>` везде, без throws через границу use-case → handler. Internal helpers могут кидать, use-case catch'ит и мапит в `Result.err({ code, cause })`.

### 9.2 Error code registry

```
PLATFORM_AUTH_MISSING
PLATFORM_AUTH_INVALID
PLATFORM_AUTH_FORBIDDEN
PLATFORM_AUTH_TOKEN_REVOKED
PLATFORM_AUTH_TOKEN_EXPIRED
PLATFORM_PARSE_BODY_INVALID
PLATFORM_PARSE_PATH_INVALID
PLATFORM_TENANCY_ORG_NOT_FOUND
PLATFORM_TENANCY_PROJECT_NOT_FOUND
PLATFORM_TENANCY_SERVICE_NOT_FOUND
PLATFORM_TENANCY_RESOURCE_ARCHIVED
PLATFORM_VALIDATION_BUNDLE_FAILED
PLATFORM_STORAGE_BLOB_UPLOAD_FAILED
PLATFORM_STORAGE_DB_UNAVAILABLE
PLATFORM_CONCURRENCY_VERSION_CONFLICT
PLATFORM_CONCURRENCY_LAST_OWNER
PLATFORM_RATE_LIMITED
PLATFORM_INTERNAL
PLATFORM_WORKOS_WEBHOOK_INVALID
PLATFORM_WORKOS_UNAVAILABLE
```

Append-only. Format `<PKG>_<LAYER>_<KIND>` (AGENTS.md §4). Клиенты (CLI, агенты) кодируют retry/UX по этим кодам.

### 9.3 HTTP envelope

```json
{
  "error": {
    "code": "QSM_STRUCTURAL_DUPLICATE_PROJECTION",
    "stage": "validation",
    "pkg": "qsm",
    "path": "projections[1].name",
    "message": "…"
  },
  "errors": [ /* для batch-errors */ ]
}
```

Валидационные ошибки из `@rntme/*` передаются внутри envelope'а **как есть** — их стабильные коды клиентам уже известны через `@rntme/*` error registries.

### 9.4 Branded types

`ValidatedPublishBundle` создаётся только функцией `validateBundle()`. Downstream use-case'ы принимают только branded тип, никогда сырой input. Обход = нарушение архитектуры.

## 10. Testing

### 10.1 `@rntme-cli/platform-core` (unit)

- In-memory fakes `FakeProjectRepo`, `FakeArtifactRepo`, `FakeBlobStore`, `FakeIdentityProvider`, `FakeClock`, `FakeOutbox`.
- Property-based (fast-check): idempotent publish под любым bundle'ом, tag moves не создают циклов, concurrency-lock сериализует.
- Validation-adapter tests: подаём известно-невалидные `@rntme/*` артефакты, проверяем bubble конкретного кода.
- Target coverage: >95%.

### 10.2 `@rntme-cli/platform-storage` (integration)

- `testcontainers` Postgres + MinIO (S3-compatible, drop-in replacement для rustfs в тестах).
- Drizzle migrations в `beforeAll`.
- RLS tests: `SELECT` без `SET LOCAL app.org_id` → 0 rows; cross-org `SELECT` → 0 rows; `INSERT` без `org_id` → error.
- Transactional-outbox: INSERT version + INSERT event_outbox атомарны (crash между ними невозможен).
- Advisory-lock concurrency: два параллельных publish'а → один падает 409.

### 10.3 `@rntme-cli/platform-http` (e2e)

- supertest против собранного Hono app.
- Postgres + MinIO из testcontainers; WorkOS — stub (локальный HTTP-сервер, отвечающий на `authenticateWithCode`, `verifyHeader`).
- Scenarios: login → create project → create service → publish v1 → move tag → republish identical → 200 с тем же seq.
- Contract: OpenAPI эмитится; responses валидируются `@readme/openapi-validator`.

### 10.4 Test layout

`test/unit/ · test/integration/ · test/e2e/ · test/fixtures/` — как во всём rntme (AGENTS.md §4).

## 11. HTTP API inventory

### 11.1 Auth

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/v1/auth/login` | Redirect → WorkOS AuthKit |
| `GET` | `/v1/auth/callback` | OAuth callback |
| `POST` | `/v1/auth/logout` | WorkOS logout |
| `GET` | `/v1/auth/me` | Current `{ account, org, role, scopes }` |

### 11.2 Webhooks

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/v1/webhooks/workos` | Signature-verified sync |

### 11.3 Orgs

| Method | Path | Scope | Purpose |
|---|---|---|---|
| `GET` | `/v1/orgs` | auth | Orgs текущего subject'а |
| `GET` | `/v1/orgs/:orgSlug` | `project:read` | Detail |

### 11.4 Projects

| Method | Path | Scope | Purpose |
|---|---|---|---|
| `POST` | `/v1/orgs/:o/projects` | `project:write` | Create |
| `GET` | `/v1/orgs/:o/projects` | `project:read` | List, `?includeArchived` |
| `GET` | `/v1/orgs/:o/projects/:p` | `project:read` | Detail + counts |
| `PATCH` | `/v1/orgs/:o/projects/:p` | `project:write` | `displayName` only |
| `POST` | `/v1/orgs/:o/projects/:p/archive` | `project:write` | Soft delete |

### 11.5 Services

| Method | Path | Scope | Purpose |
|---|---|---|---|
| `POST` | `/v1/orgs/:o/projects/:p/services` | `project:write` | Create |
| `GET` | `/v1/orgs/:o/projects/:p/services` | `project:read` | List |
| `GET` | `/v1/orgs/:o/projects/:p/services/:s` | `project:read` | Detail + `latestVersion` + tags |
| `PATCH` | `/v1/orgs/:o/projects/:p/services/:s` | `project:write` | `displayName` only |
| `POST` | `/v1/orgs/:o/projects/:p/services/:s/archive` | `project:write` | Soft delete |

### 11.6 Versions

| Method | Path | Scope | Purpose |
|---|---|---|---|
| `POST` | `…/services/:s/versions` | `version:publish` | Publish (§6) |
| `GET` | `…/services/:s/versions` | `project:read` | List, `?limit&cursor` |
| `GET` | `…/services/:s/versions/:seq` | `project:read` | Metadata + pre-signed GETs |
| `GET` | `…/services/:s/versions/by-digest/:bundleDigest` | `project:read` | Lookup |
| `GET` | `…/services/:s/versions/:seq/bundle` | `project:read` | Full bundle (rate-limited) |

### 11.7 Tags

| Method | Path | Scope | Purpose |
|---|---|---|---|
| `GET` | `…/services/:s/tags` | `project:read` | List |
| `PUT` | `…/services/:s/tags/:tagName` | `project:write` | Move/create |
| `DELETE` | `…/services/:s/tags/:tagName` | `project:write` | Remove |

### 11.8 Tokens

| Method | Path | Scope | Purpose |
|---|---|---|---|
| `POST` | `/v1/orgs/:o/tokens` | `token:manage` | Create (plaintext once) |
| `GET` | `/v1/orgs/:o/tokens` | `token:manage` | List (prefix/metadata only) |
| `DELETE` | `/v1/orgs/:o/tokens/:id` | `token:manage` | Revoke |

### 11.9 Audit

| Method | Path | Scope | Purpose |
|---|---|---|---|
| `GET` | `/v1/orgs/:o/audit` | derived | Filtered; `?resource&actor&action&since&limit` |

### 11.10 Ops

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Liveness (no deps) |
| `GET` | `/ready` | Postgres + rustfs + WorkOS ping |
| `GET` | `/openapi.json` | OpenAPI 3.1 spec |
| `GET` | `/openapi.yaml` | Same, YAML |

### 11.11 HTTP statuses

200 ok read / idempotent replay · 201 created · 204 delete · 400 parse · 401 no/bad credentials · 403 scope/tenancy · 404 not found · 409 conflict · 410 archived · 422 validation · 429 rate · 5xx internal/storage/3rd-party.

### 11.12 Versioning

Major в path'е (`/v1`). Внутри major — additive only. Break → `/v2` с `Sunset: <date>` header на старых endpoints.

## 12. Observability

- **Structured logging** (pino): `{ requestId, orgId?, actorId?, action, durationMs, status, errorCode? }`.
- **Request ID**: middleware принимает/генерит `X-Request-ID`; проброс в sub-calls.
- **Audit log** (§5.4) — application-level; complementary к pino.
- Redact в логах: `authorization`, `cookie`, `token_hash`, `token_plain`, `rustfs_secret_access_key`, `workos_api_key`, `workos_webhook_secret`.
- OpenTelemetry — **не в MVP**, но middleware-стек готов для injection.

## 13. Config (env)

```
DATABASE_URL                   postgres://...
RUSTFS_ENDPOINT                https://rustfs.internal  (S3-compatible URL)
RUSTFS_ACCESS_KEY_ID
RUSTFS_SECRET_ACCESS_KEY
RUSTFS_BUCKET                  rntme-artifacts
WORKOS_API_KEY
WORKOS_CLIENT_ID
WORKOS_WEBHOOK_SECRET
WORKOS_REDIRECT_URI            https://platform.rntme.com/v1/auth/callback
PLATFORM_BASE_URL              https://platform.rntme.com
PLATFORM_SESSION_COOKIE_DOMAIN .rntme.com
PLATFORM_CORS_ORIGINS          https://*.rntme.com
PORT                           default 3000
LOG_LEVEL                      default info
```

Zod-валидация env'а на boot'е; отсутствие обязательного → crash до listen.

## 14. Security

- Secrets только в env; никогда в логах, никогда в error envelope'е.
- Rate limit: 1000 req/min per token, 100 publish/hour per token (in-memory sliding window в MVP).
- Body cap: 10 MiB на `POST /versions`; 1 MiB на остальные `POST`.
- HTTPS-only в проде; `Strict-Transport-Security: max-age=31536000; includeSubDomains` header; HTTP→HTTPS redirect на reverse proxy.
- CORS: `PLATFORM_CORS_ORIGINS` allow-list. Default prod: `https://*.rntme.com`. Dev: `http://localhost:*`.
- CSRF: AuthKit sealed session + HMAC-signed `state` cookie для OAuth flow.
- Cookie domain: `.rntme.com` — для будущего SSO на `app.rntme.com`, `docs.rntme.com`.

## 15. Future hooks (зарезервировано)

- **`event_outbox` poller** — placeholder в MVP (только помечает `delivered_at`). Deploy-спека определит фактический транспорт (Kafka/NATS/webhook/pull). Transactional-outbox семантика уже на месте.
- **gRPC surface** — `@rntme-cli/platform-rpc` как новый пакет, reuse use-case'ов из `-core`.
- **Auto-semver diff worker** — процесс, читающий outbox, считающий diff(previous, new), писающий `semver_version` additively. Q6 обсуждение.
- **Retention / GC orphan blobs** — periodic job, удаляющая blobs без ссылок из `artifact_version` после N дней.
- **MCP server** — обёртка над OpenAPI → MCP tool definitions, reuse API tokens.
- **Web UI платформы** — отдельный пакет / отдельный хост (`app.rntme.com`); share sealed session cookie domain.

## 16. Verification

После реализации:

- `pnpm install --frozen-lockfile` в корне `rntme/` — clean resolve включая новые `@rntme-cli/platform-*`.
- `pnpm -F @rntme-cli/platform-core build|typecheck|test|lint` — зелёные.
- `pnpm -F @rntme-cli/platform-storage test` — integration tests (Postgres + MinIO из testcontainers) зелёные.
- `pnpm -F @rntme-cli/platform-http test` — e2e зелёные; WorkOS-stub integrated.
- `pnpm -F @rntme-cli/platform-http start` в dev-env — `GET /health` возвращает 200, `GET /openapi.json` возвращает валидный OpenAPI 3.1.
- Scenario: curl-флоу "create token (seed admin) → create project → create service → POST versions с валидным bundle'ом → 201 → GET tags → PUT tags/stable → 200 → repost same bundle → 200 same seq".
- Cross-org isolation: два токена разных org'ов; попытка доступа к чужому ресурсу → 404/403, никогда 200.
- WorkOS webhook: отправить signed test-event → `workos_event_log` row появился, `membership_mirror` обновился.
- Невалидный bundle (сломанный PDM) → 422 с `PLATFORM_VALIDATION_BUNDLE_FAILED` + nested `PDM_STRUCTURAL_*` code.

## 17. Risks & known limitations

- **WorkOS single-vendor lock-in для humans.** Если WorkOS закроется / поднимут цены — миграция непростая, но границу через `IdentityProvider` seam мы сохранили. Machine-tokens никак не зависят от WorkOS в hot-path.
- **rustfs зрелость.** rustfs — относительно молодой проект; в case'е проблем MinIO — drop-in replacement (тот же S3-API). Тесты уже на MinIO, миграция подтверждена по интерфейсу.
- **In-memory rate-limit** не переживёт horizontal scaling. До scale-out → Redis-backed.
- **Personal org создаётся автоматически** по `organization_membership.created` webhook'у. Если WorkOS не auto-provisions — потребуется доп. шаг в `/v1/auth/callback`. Подтвердить поведение AuthKit'а до implementation'а.
- **Bundle size cap 10 MiB** — может оказаться мал для сложных PDM; мониторим p95 published bundle size, bump если >6 MiB.
- **Outbox-poller placeholder** без real dispatcher'а — events накопятся. До deploy-спеки нужно либо truncate-on-startup для dev, либо написать тривиальный dispatcher (log-only).
- **Postgres single-writer.** Горизонтальное масштабирование — read replicas; advisory-lock per-service естественно параллелится на разные сервисы.
- **Slug immutability** = миграция "переименовать project" требует новый project + archive старого + перевыпуск всех active токенов. Осознанная цена.

## 18. Glossary

- **Bundle** — набор из 7 artifact-файлов (`manifest`, `pdm`, `qsm`, `graphIr`, `bindings`, `ui`, `seed`) одного сервиса.
- **ArtifactVersion** — атомарный snapshot bundle'а; immutable; идентифицируется `(service_id, seq)` или `(service_id, bundle_digest)`.
- **ArtifactTag** — movable pointer `(service_id, name) → version_id`; rewritable и deletable.
- **bundleDigest** — sha256 от конкатенации 7 per-file digest'ов в фиксированном порядке; идемпотентность-key при publish'е.
- **validation gate** — 4-слойный `@rntme/*` валидационный конвейер, который должен пройти каждая публикуемая версия до записи в реестр.
- **Identity-seam** — `IdentityProvider` interface; конкретные реализации — `WorkOSAuthKitProvider` (humans), `ApiTokenProvider` (machines).
- **Transactional outbox** — паттерн, где событие `artifact.version.published` пишется в таблицу в той же Postgres-транзакции что и `artifact_version`; отдельный poller разносит в внешний bus.
- **RLS** — Postgres row-level security; policy `org_id = current_setting('app.org_id')::uuid` обеспечивает tenant-изоляцию на уровне БД.
- **Mirror tables** — `account`, `organization`, `membership_mirror` — локальные копии WorkOS-сущностей, синхронизируются webhook'ами; source of truth — WorkOS.
