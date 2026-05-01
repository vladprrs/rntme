> **Path note:** paths in this document reflect the pre-merge layout (`rntme-cli/packages/...`, `@rntme-cli/*`). After the merge-back PR lands they move per `2026-04-30-merge-rntme-cli-back-design.md` (e.g. `apps/platform-http`, `packages/deploy/deploy-core`, `@rntme/platform-core`).

# rntme CLI — platform commands (publish loop + tag management)

**Status:** design
**Author:** brainstorm 2026-04-19
**Location of implementation:** `rntme-cli/packages/cli` (private submodule `vladprrs/rntme-cli`)
**Related:**
- `docs/superpowers/specs/done/2026-04-19-platform-api-design.md` (control-plane API contract)
- `docs/superpowers/specs/done/2026-04-19-platform-api-errata-01.md`, `…-errata-02.md` (post-landing corrections to the API)
- `docs/superpowers/specs/done/2026-04-18-rntme-cli-submodule-design.md` (submodule mechanics)
- `AGENTS.md` §3 (package layering), `CLAUDE.md` (non-obvious conventions)
- memory: `project_platform_deployed` (live platform at `platform.rntme.com`)

## 1. Problem

Платформа (`@rntme-cli/platform-http`) уже развёрнута на `https://platform.rntme.com` и экспонирует полный HTTP control-plane для `Organization → Project → Service → ArtifactVersion + Tag` (см. platform-api-design §11). Пакет `@rntme-cli/cli` существует, но пуст: это скелет на `node:util.parseArgs`, без единой команды.

Нужен минимальный набор команд, после которого:

1. Человек на laptop'е может из терминала создать project/service и опубликовать bundle;
2. LLM-агент (Claude-code, Cursor) может делать то же самое через `exec()` shell, получая стабильно парсимый вывод;
3. CI/GitOps-пайплайн может делать `rntme publish` с machine-token'ом без interactive prompts;
4. Ошибки с платформы (`PLATFORM_*`) и локальные ошибки (`CLI_*`) — оба с stable-кодами, оба mapped в стабильные exit-коды.

## 2. Goal

Реализовать в `rntme-cli/packages/cli` команды для publish-loop'а и tag-management'а:

- `rntme login / logout / whoami`
- `rntme token {create, list, revoke}`
- `rntme project {create, list, show}`
- `rntme service {create, list, show}`
- `rntme version {list, show}`
- `rntme tag {list, set, delete}`
- `rntme publish`
- `rntme validate`

**In scope:**
- Вся command-surface выше (scope B из brainstorm Q1).
- `rntme.json` per-service project config; `~/.config/rntme/credentials.json` с XDG discovery.
- Handwritten typed HTTP-client (Approach 1 из brainstorm Q-approach).
- Zod-схемы запросов/ответов, hand-mirrored с платформы.
- `rntme validate` с lazy-import'ом `@rntme/*` валидаторов.
- Human- и `--json`-output для каждой команды.
- Unit + integration (MSW-mock) + e2e (против `platform.rntme.com`) тесты.

**Explicitly out of scope:**
- archive/un-archive команды (projects, services) — следующая итерация.
- audit log viewer — следующая итерация.
- member management — platform делегирует в WorkOS dashboard (spec §7), CLI зеркалит.
- version bundle download (`…/versions/:seq/bundle`) — agent'у пока хватит `version show`.
- Browser loopback login (`rntme login` через WorkOS AuthKit) — ждёт web UI платформы.
- Device-code flow.
- MCP-server обёртка над CLI — отдельный пакет (`@rntme-cli/cli-mcp`), future work.
- OpenAPI client generation (YAGNI на 15 endpoint'ов).
- Retry-политика (в MVP единственный retry — manual re-run; idempotency-key на сервере защищает).
- `rntme publish --validate-locally` — комбо-флаг, прогоняющий §9 chain перед POST'ом; тривиальное расширение в следующую итерацию. В MVP: отдельный `rntme validate` и отдельный `rntme publish`.

## 3. Decisions matrix

| # | Решение |
|---|---|
| Q1 | Scope B: publish-loop + tag-management (без archive/audit/member в MVP) |
| Q2 | Config — `rntme.json` per service, walk-up от cwd |
| Q3 | Login — `rntme login --token <pat>` MVP; browser-flow отложен до web UI |
| Q4 | `rntme validate` — отдельная команда с локальными `@rntme/*` валидаторами; `rntme publish` — server-only gate |
| Q5 | Layout — one `rntme.json` per service, один сервис в каталоге (матчит `demo/issue-tracker-api/`) |
| Q-approach | Flat `@rntme-cli/cli` + handwritten fetch; без command-framework'а, без openapi-generator'а |

## 4. Architecture & module boundaries

### 4.1 Package layout

Пакет один — расширяем существующий `@rntme-cli/cli`. Новых workspace-пакетов не создаём.

```
rntme-cli/packages/cli/
  src/
    bin/cli.ts                  entry; top-level dispatcher (parseArgs + positional routing)
    commands/
      login.ts
      logout.ts
      whoami.ts
      publish.ts
      validate.ts
      token/{create,list,revoke}.ts
      project/{create,list,show}.ts
      service/{create,list,show}.ts
      version/{list,show}.ts
      tag/{list,set,delete}.ts
    config/
      project.ts                rntme.json discover + parse
      credentials.ts            ~/.config/rntme/credentials.json read/write
      resolve.ts                flag > env > project > credentials > default
    api/
      client.ts                 typed fetch + Authorization + error-envelope mapping
      endpoints.ts              thin typed wrappers per platform endpoint
      types.ts                  Zod schemas for requests/responses
    errors/
      codes.ts                  CLI_* append-only registry
      render.ts                 envelope → human / --json
      exit.ts                   code → exit-code mapping
    validate/
      run.ts                    @rntme/* chain orchestration (lazy-import)
    output/
      format.ts                 human vs --json renderer
      tables.ts                 ASCII table helper
      progress.ts               stderr progress (non-TTY: silent)
    util/
      canonical-json.ts         sorted-keys JSON → sha256 → bundleDigest
  test/{unit,integration,e2e,fixtures}/
```

### 4.2 Runtime deps (production)

- `zod` — уже есть в workspace.
- `@truestamp/canonify` (или эквивалентный canonical-JSON) — для `bundleDigest`.
- Всё остальное — `node:*` standard library (`parseArgs`, `fs/promises`, `path`, `crypto`, global `fetch`).

### 4.3 Local-validation-only deps (imported by `validate/run.ts` only, lazy)

- `@rntme/pdm`, `@rntme/qsm`, `@rntme/graph-ir-compiler`, `@rntme/bindings`, `@rntme/ui`, `@rntme/seed` (+ manifest layer — уточнит implementation plan).

**Rationale for lazy-import:** `@rntme/*` — 6+ пакетов с транзитивным деревом. Cold-start (`rntme login`, `rntme whoami`) должен быть дешёвым — agent'ы spawn'ят процесс на каждый tool-call.

### 4.4 Invariant — HTTP-client only

`@rntme-cli/cli` НЕ импортирует:
- `@rntme-cli/platform-core`, `platform-storage`, `platform-http`
- `@workos-inc/*`
- `drizzle-orm`, `pg`, `pg-pool`
- `@aws-sdk/*`

Машинно-проверяется в lint step (`no-restricted-imports` или explicit grep). Матчит platform-api-design §4.3: «@rntme-cli/cli — HTTP-client».

### 4.5 Distribution

В MVP — private submodule, build'ится родительским `pnpm -r build`. Публичная публикация (`npm i -g @rntme-cli/cli`) — future work; лейаут deps уже подготовлен под неё.

## 5. Command inventory

### 5.1 Top-level

| Command | Purpose | Scope | HTTP |
|---|---|---|---|
| `rntme login --token <pat>` | Save PAT to credentials | — | — |
| `rntme login` (no args) | Print instructions | — | — |
| `rntme logout` | Remove credentials | — | — |
| `rntme whoami` | Identity + scopes | auth | `GET /v1/auth/me` |
| `rntme validate` | Local 4-layer chain | — | — |
| `rntme publish [--tag …] [--message s] [--previous-version-seq N]` | Publish current service | `version:publish` | `POST /v1/orgs/:o/projects/:p/services/:s/versions` |

### 5.2 `rntme token …`

| Command | HTTP |
|---|---|
| `rntme token create --name <s> --scopes <csv> [--expires <iso>]` | `POST /v1/orgs/:o/tokens` (prints plaintext **once**) |
| `rntme token list` | `GET /v1/orgs/:o/tokens` |
| `rntme token revoke <id>` | `DELETE /v1/orgs/:o/tokens/:id` |

### 5.3 `rntme project …`

| Command | HTTP |
|---|---|
| `rntme project create <slug> [--display-name <s>]` | `POST /v1/orgs/:o/projects` |
| `rntme project list [--include-archived]` | `GET /v1/orgs/:o/projects` |
| `rntme project show [<slug>]` | `GET /v1/orgs/:o/projects/:p` |

### 5.4 `rntme service …`

| Command | HTTP |
|---|---|
| `rntme service create <slug> [--display-name <s>]` | `POST …/services` |
| `rntme service list` | `GET …/services` |
| `rntme service show [<slug>]` | `GET …/services/:s` (includes `latestVersion` + tags) |

### 5.5 `rntme version …`

| Command | HTTP |
|---|---|
| `rntme version list [--limit N] [--cursor C]` | `GET …/versions` |
| `rntme version show <seq\|tag>` | `GET …/versions/:seq` (resolving tag → seq client-side через `GET …/tags`) |

### 5.6 `rntme tag …`

| Command | HTTP |
|---|---|
| `rntme tag list` | `GET …/tags` |
| `rntme tag set <name> <seq>` | `PUT …/tags/:name` |
| `rntme tag delete <name>` | `DELETE …/tags/:name` |

### 5.7 Global flags (all commands)

- `--json` — machine-readable output.
- `--base-url <url>` — overrides config/env.
- `--profile <name>` — selects entry in credentials (MVP: только `default`).
- `--org <slug>`, `--project <slug>`, `--service <slug>` — override `rntme.json`.
- `--no-color`, `-v/--verbose`, `-q/--quiet`, `-h/--help`, `--version`.

### 5.8 Explicitly NOT in MVP

- archive/un-archive (projects, services).
- audit log viewer (`GET /v1/orgs/:o/audit`).
- member management (WorkOS-delegated).
- version bundle download (`…/versions/:seq/bundle`).
- Browser loopback login (ждёт web UI).

## 6. Config files

### 6.1 Project config — `rntme.json`

**Discovery:** CLI walks up от cwd до ближайшего `rntme.json`. Найден → Zod-parse → `RntmeProjectConfig`. Не найден → command-specific: `publish`/`validate` → `CLI_CONFIG_MISSING` (exit 2); `login`/`token`/`whoami` → продолжают, им нужен только token + base URL.

Schema:

```ts
const RntmeProjectConfig = z.object({
  $schema: z.string().url().optional(),
  org: z.string().regex(/^[a-z0-9-]{3,40}$/),
  project: z.string().regex(/^[a-z0-9-]{3,60}$/),
  service: z.string().regex(/^[a-z0-9-]{3,60}$/),
  artifacts: z.object({
    manifest: z.string(),
    pdm: z.string(),
    qsm: z.string(),
    graphIr: z.string(),
    bindings: z.string(),
    ui: z.string(),
    seed: z.string(),
  }),
  defaults: z.object({
    tags: z.array(z.string()).optional(),
    message: z.string().optional(),
  }).optional(),
});
```

**Rules:**
- Пути в `artifacts` — relative к каталогу `rntme.json`. Абсолютные пути → `CLI_CONFIG_INVALID`.
- Slug-regex'ы матчат spec §5.3 платформы.

### 6.2 Credentials — `~/.config/rntme/credentials.json`

**Path resolution:** XDG-compliant. Linux/macOS: `$XDG_CONFIG_HOME/rntme/credentials.json` → fallback `~/.config/rntme/credentials.json`. Windows: `%APPDATA%\rntme\credentials.json`.

Schema:

```ts
const CredentialsFile = z.object({
  version: z.literal(1),
  profiles: z.record(z.string(), z.object({
    baseUrl: z.string().url(),
    token: z.string().regex(/^rntme_pat_[a-zA-Z0-9]{22}$/),
    addedAt: z.string().datetime(),
  })),
  defaultProfile: z.string(),
});
```

**File system rules:**
- File mode `0600`; dir mode `0700`. Проверяется на чтение — шире → `CLI_CREDENTIALS_PERMISSIONS_TOO_OPEN` (exit 2). Матчит поведение `gh`, `aws` CLI.
- `rntme login --token X` пишет/обновляет profile `default` (или `--profile name`).

### 6.3 Env vars

| Var | Effect |
|---|---|
| `RNTME_TOKEN` | override credentials-file token |
| `RNTME_BASE_URL` | override default base URL и credentials baseUrl |
| `RNTME_PROFILE` | select profile (default: `default`) |
| `RNTME_NO_COLOR` | disable ANSI |
| `NO_COLOR` | same, standard |
| `RNTME_DEBUG` | print every HTTP request/response to stderr (redact `Authorization`) |

### 6.4 Resolution order

Для полей `baseUrl`, `token`, `org`, `project`, `service`:

```
flag                      highest
env (RNTME_*)
project file (rntme.json)  — only for org/project/service
credentials file (profile) — only for baseUrl/token
built-in default           — baseUrl: https://platform.rntme.com; no token
                           lowest
```

Missing required field → `CLI_CONFIG_MISSING` (exit 2) + hint.

### 6.5 Token-prompt security

`--token X` в argv виден через `ps` — нежелательно. Варианты:

- `rntme login --token -` — читает из stdin (preferred для pipe).
- `rntme login` без args — hidden prompt (termios `ECHO` off).
- `rntme login --token XXX` — работает, но stderr-warning «token visible in process list».

## 7. HTTP client & error handling

### 7.1 Client

Один helper `api/client.ts` поверх global `fetch`:

```ts
type ApiError = {
  kind: 'http';
  status: number;
  code: string;
  stage?: string;
  pkg?: string;
  path?: string;
  message: string;
  requestId?: string;
  nested?: ValidationErrorItem[];
};
type NetworkError = { kind: 'network'; cause: unknown };
type ClientError  = ApiError | NetworkError;

async function apiCall<T>(opts: {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  body?: unknown;
  responseSchema: z.ZodType<T>;
  baseUrl: string;
  token: string | null;
  requestId?: string;
}): Promise<Result<T, ClientError>>
```

**Behaviour:**
- `Authorization: Bearer <token>` когда есть token.
- `X-Request-ID: <uuid-v4>` генерируется client'ом; печатается в `--verbose` и в любой ошибке.
- `User-Agent: rntme-cli/<version> (node/<version>)`.
- `Content-Type: application/json`.
- 2xx → `responseSchema.safeParse`; fail → `CLI_RESPONSE_PARSE_FAILED`.
- 4xx/5xx → parse error envelope per spec §9.3; fail → synthetic `PLATFORM_INTERNAL`.
- Network-level fail → `NetworkError`.

**No automatic retries in MVP.** Idempotency — на server side (`(service_id, bundle_digest)` uniqueness). Manual re-run всегда safe.

### 7.2 Endpoint wrappers

`api/endpoints.ts` — тонкие функции, одна на endpoint. Zod-схемы в `api/types.ts` hand-mirrored с платформы. Drift'ы ловятся integration-test'ом (MSW) + e2e-test'ом против live-платформы.

### 7.3 Error rendering

**Human mode (TTY):** заголовок + code + request-id + nested error list + hint.

**`--json` mode:**

```json
{
  "ok": false,
  "error": {
    "code": "PLATFORM_VALIDATION_BUNDLE_FAILED",
    "status": 422,
    "requestId": "req_01HW3K8Y9M2P4X",
    "message": "bundle validation failed",
    "nested": [ { "pkg": "qsm", "stage": "structural",
                  "code": "QSM_STRUCTURAL_DUPLICATE_PROJECTION",
                  "path": "projections[1].name",
                  "message": "projection \"issue\" declared twice" } ]
  }
}
```

### 7.4 Exit codes

| Exit | When |
|---|---|
| `0` | success |
| `1` | generic (usage, internal) |
| `2` | config/credentials problem |
| `3` | auth failed (`PLATFORM_AUTH_*`) |
| `4` | forbidden/scope |
| `5` | not found / archived |
| `6` | validation failed (422 или local `rntme validate`) |
| `7` | concurrency conflict (`PLATFORM_CONCURRENCY_VERSION_CONFLICT`) |
| `8` | rate limited |
| `9` | network error |
| `10` | 5xx from platform |

Документируется в README и `--help`.

### 7.5 CLI-local error codes

Append-only registry (`errors/codes.ts`), format `CLI_<LAYER>_<KIND>`:

```
CLI_CONFIG_MISSING
CLI_CONFIG_INVALID
CLI_CONFIG_ARTIFACT_NOT_FOUND
CLI_CREDENTIALS_MISSING
CLI_CREDENTIALS_INVALID
CLI_CREDENTIALS_PERMISSIONS_TOO_OPEN
CLI_RESPONSE_PARSE_FAILED
CLI_VALIDATE_LOCAL_FAILED
CLI_PUBLISH_DIGEST_MISMATCH
CLI_NETWORK_TIMEOUT
CLI_USAGE
```

## 8. `rntme publish` — flow

```
1. resolve config
   1.1 walk-up cwd → rntme.json → Zod-parse
       fail: CLI_CONFIG_MISSING | CLI_CONFIG_INVALID
   1.2 resolve credentials (profile, flags, env)
       fail: CLI_CREDENTIALS_MISSING

2. load artifact files
   2.1 для каждого из 7 ключей в config.artifacts:
       resolve path relative → fs.readFile → JSON.parse → z.record(z.unknown())
       fail: CLI_CONFIG_ARTIFACT_NOT_FOUND | CLI_CONFIG_INVALID

3. build request body
   body = { bundle: { manifest, pdm, qsm, graphIr, bindings, ui, seed },
            previousVersionSeq: --previous-version-seq,   // undefined by default
            message: --message || config.defaults.message,
            moveTags: --tag (multi) || config.defaults.tags || [] }

4. compute local bundleDigest (util/canonical-json.ts)
   per file: sha256(canonify(file))
   bundleDigest_local = sha256(concat(digest_manifest, digest_pdm, digest_qsm,
                                       digest_graphIr, digest_bindings,
                                       digest_ui, digest_seed))          // fixed order
   --verbose → print per-file digests + bundleDigest_local to stderr

5. POST /v1/orgs/<org>/projects/<project>/services/<service>/versions
   headers: Authorization, X-Request-ID, Content-Type
   body: step-3
   timeout: 120s

6. response
   201/200 → { version: { seq, bundleDigest, previousVersionSeq, publishedAt, moveTags } }
   invariant: response.bundleDigest === bundleDigest_local
     fail → CLI_PUBLISH_DIGEST_MISMATCH (exit 1, report-bug hint)

7. render output
   human: ✓ message + seq, digest, previousSeq, tags, url
   200 (replay) → помечается "idempotent replay"
   --json: { ok: true, data: <response> } passthrough

8. exit 0
```

### 8.1 Server-error mapping

| Server | CLI action |
|---|---|
| 200 replay | render as "already-published, seq=N"; exit 0 |
| 409 | hint "concurrent publish, re-run"; exit 7 |
| 422 | render nested errors; exit 6 |
| 401 | exit 3 |
| 403 | exit 4 |
| 404/410 | hint "check project/service slugs"; exit 5 |
| 413 | hint "bundle too large (10 MiB cap)"; exit 2 |
| 429 | hint "rate limited; retry after N" (Retry-After); exit 8 |
| 5xx | exit 10 |
| network timeout | exit 9 |

### 8.2 `--previous-version-seq <N>` (advanced)

Позволяет агенту явно передать ожидаемый `previousVersionSeq` для поимки race между `GET /versions` и `POST /versions`. Без флага — сервер auto-increments.

### 8.3 Idempotency UX

Повтор `rntme publish` после network-drop/SIGKILL — safe: сервер по `(service_id, bundle_digest)` вернёт существующую версию. CLI рендерит как «idempotent replay» чтобы не смешивать с fresh success.

### 8.4 What publish does NOT do

- Не апдейтит `rntme.json`.
- Не коммитит в git, не пушит в remote.
- Не резолвит tag alias — прокидывает `moveTags` как есть, сервер делает атомарно.

## 9. `rntme validate` — local validator chain

### 9.1 Flow

```
1. resolve config (identical to publish step 1.1; credentials не нужны)
2. load 7 artifact files (identical to publish step 2)
3. lazy-import validators:
   const { validate: validatePdm }      = await import('@rntme/pdm')
   const { validate: validateQsm }      = await import('@rntme/qsm')
   const { validate: validateGraphIr }  = await import('@rntme/graph-ir-compiler')
   const { validate: validateBindings } = await import('@rntme/bindings')
   const { validate: validateUi }       = await import('@rntme/ui')
   const { validate: validateSeed }     = await import('@rntme/seed')
   // manifest validator — per implementation plan
4. run chain in spec-mandated order (platform-api-design §6 step 4):
   pdm → qsm(pdm) → graphIr(pdm,qsm) → bindings(pdm,qsm) → ui(bindings,qsm) → seed(pdm) → manifest(all)
   fail-fast на первом слое с ошибками (branded Validated* не даёт передать invalid)
5. render report
   human: ✓ bundle valid (7 artifacts, bundleDigest=<sha256>)
   failure: group by pkg; { code, path, message }; aggregate count
   --json: { ok, errors: [{ pkg, stage, code, path, message }] }
6. exit 0 | 6
```

### 9.2 Fail-fast rationale

Матчит поведение платформы (§6 step 4). Внутри одного layer'а — собираем все ошибки (валидаторы `@rntme/*` возвращают `Result<T, Error[]>`), печатаем весь массив.

### 9.3 Validator-interface assumption

Ожидаемое публичное API:
```ts
export function validate(input: unknown, deps?: {...}): Result<Validated<Pkg>, ValidationError[]>;
```
Если реальные exports расходятся — НЕ подстраиваем `@rntme/*` под CLI (CLAUDE.md: «bypassing a layer loses downstream codes»). Implementation plan добавит thin adapter в `validate/run.ts` без изменения core-пакетов.

### 9.4 Not validated locally

- tenancy (org/project/service существуют, не archived) — нужна сеть.
- token scope — нужна сеть.
- `previousVersionSeq`, `bundleDigest` uniqueness — серверные инварианты.

Документируется в `--help` явно: «validate не гарантирует, что publish пройдёт — только внутренняя консистентность bundle'а».

## 10. Output format

### 10.1 Default (TTY, human)

- stdout — строго то, что парсит prod-pipeline (id/seq/slug после create/publish, error-code при fail).
- stderr — progress, warnings, verbose-logs.
- ANSI color только если `isTTY && !NO_COLOR && !RNTME_NO_COLOR`.
- Без spinner'ов и анимаций (шум в agent-log'ах).
- Tables — minimal ASCII, autosized columns, no unicode box drawing.

### 10.2 `--json` mode

Single shape для всех команд:

```json
{ "ok": true,  "data":  ...passthrough от платформы... }
{ "ok": false, "error": { "code", "status", "requestId", "message", "nested" } }
```

- Agent jq'ает один ключ → знает success/fail без exit-code check'а.
- `data` — passthrough response body без CLI-side трансформаций.
- List-команды возвращают массив/объект от сервера (pagination-мета не оборачивается).

### 10.3 Non-TTY

- No color (auto).
- No progress (auto).
- Human-mode всё ещё default, но plain ASCII.
- Agent'ам рекомендовано `--json`, но не форсируется.

### 10.4 `--verbose` / `-v`

Stderr, structured prefixed lines:

```
[rntme] POST https://platform.rntme.com/v1/orgs/acme/projects
[rntme] request-id: req_01HW3K8Y9M2P4X
[rntme] status: 201 (234ms)
```

`-vv` — full request/response body (redact `Authorization`).

### 10.5 `--quiet` / `-q`

Только id/seq на stdout при success, stderr silenced. `SEQ=$(rntme publish -q)` — use case.

## 11. Testing

### 11.1 Unit (`test/unit/`)

| Subject | Tests |
|---|---|
| `config/project.ts` | walk-up discovery matrix; Zod errors; relative-path resolution; абсолютные пути отвергаются |
| `config/credentials.ts` | XDG path resolution (Linux/macOS/Windows env stubbed); permission check; profile select; write creates `0700`/`0600` |
| `config/resolve.ts` | precedence matrix flag > env > project > credentials > default |
| `util/canonical-json.ts` | sorted keys; no whitespace; deterministic digest для golden fixtures |
| `errors/render.ts` | human + json для каждого error-kind; ANSI strip без TTY |
| `errors/exit.ts` | code-to-exit для каждой константы |
| `output/tables.ts` | column sizing, truncation, `--quiet` short-output |

Target coverage: ≥90% для `config/`, `errors/`, `util/`, `output/`.

### 11.2 Integration (`test/integration/`)

MSW (`msw/node`) поднимает fake HTTP-server, matchs routes, возвращает typed responses.

| Scenario | Expectation |
|---|---|
| `whoami` → 200 | stdout org+account; exit 0 |
| `whoami` → 401 `PLATFORM_AUTH_INVALID` | stderr code; exit 3 |
| `project create` → 201 | stdout slug; exit 0 |
| `project create` → 409 | exit 7 |
| `publish` happy → 201 | digest matches echo; exit 0 |
| `publish` → 422 с nested QSM error | stderr nested code; exit 6 |
| `publish` → 200 replay | output marks «idempotent replay»; exit 0 |
| `publish` → server digest mismatch | `CLI_PUBLISH_DIGEST_MISMATCH`; exit 1 |
| `tag set preview 42` → 200 | exit 0 |
| `tag set preview 99` → 404 | exit 5 + hint |
| MSW throws | `NetworkError`; exit 9 |
| `X-Request-ID` echoed | always in error stderr |

### 11.3 E2E (`test/e2e/`)

**Target:** live `https://platform.rntme.com` (задеплоена через Dokploy).

**Setup:**
- `RNTME_E2E_TOKEN` — long-lived PAT в CI secret, admin-role в seed-org `rntme-cli-e2e`.
- `RNTME_E2E_BASE_URL` — default `https://platform.rntme.com`.
- Seed-данные на платформе: org `rntme-cli-e2e` + token создаются один раз вручную, token записывается в GitHub Actions secret.

**Scenarios:**
- Full happy path: project create → service create → publish v1 → tag move → re-publish identical → 200 same seq → tag list → tag delete → version list.
- Invalid bundle → 422 nested code.
- Tag move between seqs.

**Guards:**
- `describe.skipIf(!process.env.RNTME_E2E_TOKEN)` — локально skip без токена.
- Unique service slugs (timestamp + random) — parallel CI-runs не конфликтуют.
- Timeouts: 30s per test, 120s per file.

**Dokploy MCP для ad-hoc observability** (не CI): `application-readLogs` на `platform-http` сервисе — tail'им логи при локальном debug'е падающего e2e; `X-Request-ID` из CLI stderr → grep в server log'ах.

### 11.4 Fixtures (`test/fixtures/`)

- `rntme.json` — sample config (`rntme-cli-e2e` / `issue-tracker` / `api`).
- `artifacts/*.json` — минимальный валидный bundle.
- `artifacts-broken/*.json` — с намеренной ошибкой (duplicate projection в qsm) для 422-test'а.
- `credentials-0600.json`, `credentials-0644.json` — permissions-тест.
- Golden files для human-output (strip ANSI before compare).

### 11.5 CI integration

- `pnpm -F @rntme-cli/cli test` — unit + integration на каждом PR.
- `pnpm -F @rntme-cli/cli test:e2e` — новый script, runs на merge в main (CI has secret).
- E2E не блокирует PR; блокирует main — flake → revert merge.

## 12. Verification

### 12.1 Build & typecheck

- `pnpm install --frozen-lockfile` из корня — clean resolve.
- `pnpm -F @rntme-cli/cli build` → `dist/bin/cli.js` с shebang и `0755`.
- `pnpm -F @rntme-cli/cli typecheck | lint | test` — зелёные.

### 12.2 Smoke tests (local)

- `rntme --version`, `rntme --help` — exit 0.
- `rntme whoami` без credentials → `CLI_CREDENTIALS_MISSING`, exit 2.
- `rntme publish` без `rntme.json` → `CLI_CONFIG_MISSING`, exit 2 + hint.
- `rntme validate` в `demo/issue-tracker-api/` (после коммита `rntme.json` туда) → exit 0 + bundleDigest.
- `rntme validate` с подломанным qsm → exit 6.

### 12.3 E2E против `platform.rntme.com`

Полный loop в human и в `--json` оба:

```bash
export RNTME_TOKEN=rntme_pat_...
export RNTME_BASE_URL=https://platform.rntme.com

rntme whoami                                    # { org: rntme-cli-e2e, role: admin, ... }
rntme project create test-$TS                   # 201
rntme service create api --project test-$TS    # 201
cd demo/issue-tracker-api                       # contains rntme.json
rntme publish --tag preview --message "smoke"   # 201 seq=1
rntme publish --tag preview                     # 200 replay, same seq=1
rntme tag set stable 1                          # 200
rntme tag list                                  # shows preview+stable → seq 1
rntme version list                              # 1 entry
rntme tag delete preview                        # 204
```

### 12.4 Cross-cutting

- **Idempotency:** двукратный publish → same seq, 2nd marked «idempotent replay».
- **Digest invariant:** local `bundleDigest` ≡ server echo. Break → `CLI_PUBLISH_DIGEST_MISMATCH` (integration test).
- **Scope-wall:** token со scope'ом `project:read` + `rntme project create` → 403, exit 4.
- **Cross-org isolation:** token org-A не видит ресурсы org-B (сервер enforce'ит, CLI ретранслирует).
- **Log correlation:** `X-Request-ID` из CLI stderr присутствует в pino-логах `platform-http` (через Dokploy `application-readLogs`).
- **Machine-checked invariant (§4.4):** `@rntme-cli/cli` не импортирует `platform-*`, `@workos-inc/*`, `drizzle-orm`, `@aws-sdk/*`. Проверяется в lint step (`no-restricted-imports` или explicit grep).

### 12.5 Documentation

- `rntme-cli/packages/cli/README.md` — Quick start, command reference, error-code table, exit-code table, env vars.
- `demo/issue-tracker-api/rntme.json` — committed; `rntme validate` в этом каталоге returns 0.

## 13. Risks & known limitations

- **Zod-схемы hand-mirrored с платформы.** Drift между `@rntme-cli/platform-core` schemas и CLI `api/types.ts` — риск silent parse fail. Integration-test (MSW против нашей же схемы) + e2e (реальная платформа) — two lines of defense. Долгосрочно: миграция на Approach 3 (`@rntme-cli/cli-core` + shared Zod) когда появится MCP/VS Code потребитель.
- **No retry policy.** Network flap на publish → user видит `NetworkError` (exit 9), делает re-run — idempotency-key спасает. Flap на read-only (list) — пользователь сам retry'ит. При реальных жалобах добавим exponential-backoff retry в `client.ts`.
- **Local validator API assumption.** `@rntme/*` exports могут отличаться от `validate(input, deps) → Result`. Implementation plan пишет thin adapter-layer в `validate/run.ts`, НЕ меняя core-пакеты.
- **E2E зависит от live-платформы.** Outage `platform.rntme.com` → e2e red на main. Mitigation: e2e skip'ается без `RNTME_E2E_TOKEN`, так что dev-loop не блокируется. При сбое платформы main-gate можно временно override'нуть.
- **Token plaintext в `rntme login --token X` visible через `ps`.** Mitigation: stdin-mode (`--token -`) + hidden prompt + stderr-warning для inline-path'а.
- **CLI version ≠ platform version.** Если платформа поменяет error envelope format или path prefix — старый CLI сломается. Mitigation: `GET /v1/auth/me` response включает `platformVersion` (уточнит implementation plan с платформенной стороны — мелкий additive change). CLI рендерит warning при major-mismatch'е.
- **No pagination UI для list-команд в MVP.** `rntme version list` принимает `--limit/--cursor`, но не агрегирует страницы. Agent/скрипт итерирует сам.

## 14. Glossary

- **Bundle** — набор из 7 artifact-файлов одного сервиса (manifest, pdm, qsm, graphIr, bindings, ui, seed).
- **`rntme.json`** — per-service project config в корне каталога сервиса; source of truth для `org/project/service` и путей артефактов.
- **bundleDigest** — sha256 от конкатенации 7 per-file canonical-JSON digest'ов в фиксированном порядке; идемпотентность-key при publish'е (spec §6).
- **Profile** — named entry в `~/.config/rntme/credentials.json`; в MVP всегда `default`.
- **Idempotent replay** — second publish с тем же `bundleDigest` → server возвращает существующую версию (200 OK, тот же seq); CLI рендерит этот случай отдельно от fresh 201.
- **CLI invariant (§4.4)** — `@rntme-cli/cli` не импортирует platform-runtime-пакеты (platform-\*, WorkOS, Drizzle, AWS-SDK); машинно-проверяется в lint step.
