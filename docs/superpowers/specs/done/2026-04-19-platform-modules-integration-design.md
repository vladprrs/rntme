# platform modules & external integration — design

**Status:** design
**Author:** brainstorm 2026-04-19
**Related:**
- `docs/superpowers/specs/done/2026-04-19-platform-api-design.md` (control-plane; §2 оговаривает, что gRPC surface и Zeebe integration отложены — эта спека закрывает часть отложенного)
- `docs/adr/2026-04-15-event-driven-architecture.md` (Kafka как integration SoT, gRPC для sync, Zeebe для cross-service sagas)
- `docs/gaps/commands-and-transactions-gaps.md` (intra-service multi-aggregate; outbox P0)
- `docs/superpowers/specs/done/2026-04-17-cloudevents-envelope-design.md` (envelope и event-schema референс для модулей)
- `project_platform_vision`, `rntme_orchestration_only` memory

**Implementation locations:**
- Core runtime seams — `packages/runtime/`, `packages/bindings/`, `packages/bindings-http/`, новый `packages/bindings-grpc/`
- Reference module (Stripe) — `demo/stripe-module/` или отдельный applet-пакет (решение в плане)
- Implementation plans для этой спеки — `docs/superpowers/plans/done/platform-modules-integration/`

## 1. Problem

Платформа rntme заявлена как место, где LLM-агенты и люди собирают бизнес-сервисы из JSON-артефактов. Сегодня любой рантайм-сервис может только: (а) принимать HTTP-команды/запросы, (б) читать/писать собственный event-log и проекции. Полностью отсутствует способ:

1. **Вызывать внешний API** (платёжный шлюз, email-провайдер, geocoding, search) в ходе исполнения команды или запроса.
2. **Принимать инициированные вендором обратные вызовы** — ни webhook'и, ни OAuth-redirect'ы, ни SSO-callback'и.
3. **Компоновать cross-service flow** — сервис не может ни позвать другой сервис синхронно, ни отреагировать на его событие.

Наивные решения (положить fetch() в обработчик команды, зашить adapter-DSL в Graph IR, развести side-effect consumers на каждый чужой event) ломают одно из трёх центральных свойств платформы: детерминизм event-sourcing'а, CQRS-разделение write/read, либо orchestration-only asynchrony (см. `rntme_orchestration_only` memory). Нужен дизайн, совместимый со всеми тремя.

## 2. Goal

Зафиксировать набор примитивов, по которому LLM-агент или человек может:

1. Писать domain-сервис на rntme-артефактах, который **синхронно зовёт "platform module"** (сервис, реализующий интеграцию с внешней системой) и получает результат ДО эмита события.
2. Принимать vendor-callback'и (OAuth-redirect, hosted-checkout return, magic-link click) в рамках обычной рантайм-модели, без специальной side-channel infrastructure.
3. Реплицировать cross-service события **пассивно** в read-model (как уже делается), **не** реагируя на них автономно.

Плюс — описать **module contract**: что именно должен уметь и выполнять платформенный модуль, чтобы быть пригодным для использования domain-сервисами.

**In scope:**
- Концепция three-tier integration (reference / outbound-simple / module).
- `CommandExecutor` / `QueryExecutor` seam в `@rntme/runtime` для альтернативных (code-based) реализаций исполнителей.
- gRPC surface как отдельный Surface plugin или пакет `@rntme/bindings-grpc`.
- `ExternalAdapterClient` seam (gRPC client registry с retry/timeout/circuit-breaker).
- Расширение `command` binding-kind тремя полями (`method`, `inputFrom`, `response`) для P2-callback endpoints.
- Обязательное `pre[]` поле в `command` binding, со схемой одного шага и ограничениями.
- Module contract (что обязан экспонировать модуль).
- Error-handling рамка (классификация отказов, idempotency-key chain, error-code namespace).
- Decomposition на 5 implementation plan'ов.

**Explicitly out of scope:**
- Zeebe worker adapter и BPMN task-conventions — отдельная спека (см. §15).
- Streaming primitive (server-streaming gRPC, SSE-proxy для LLM-интеграций) — отдельная спека.
- Tier-2 mini-adapter-DSL (lightweight HTTP adapter для geocode/captcha без полного модуля) — отдельная спека.
- `onError: fallback/skip` политика pre-fetch'а — deferred S5.
- Автодеградация sync→async при открытом circuit-breaker'е — deferred S8.
- Deploy/packaging модулей (CI, registry, версионирование) — часть control-plane roadmap'а.
- Client-direct scoped-credential pattern (S3 upload, Stripe Elements) — документируется как recipe, без новых примитивов; глубокая проработка — отдельно.
- Side-effect consumer'ы (автономно реагирующие на cross-service события) — **отклонены архитектурно**, не out-of-scope.

## 3. Decisions matrix

| # | Вопрос | Решение |
|---|---|---|
| Q1 | Где живёт сложная интеграция (Stripe/Resend/Algolia) — в adapter-DSL или отдельным сервисом? | **Отдельный сервис-модуль** (Anti-Corruption Layer) |
| Q2 | Как модуль реализован — код или артефакты? | Код + vendor SDK, но может переиспользовать rntme runtime-seam'ы (event-store, projection) |
| Q3 | Как domain-сервис зовёт модуль синхронно? | pre-fetch gRPC в `command` binding (поле `pre[]`) |
| Q4 | Добавлять ли в Graph IR оператор `external_call`? | **Нет.** Graph IR остаётся pure read+emit |
| Q5 | Как принимать vendor-callback (OAuth, hosted-checkout)? | Расширить `command` binding-kind тремя полями (`method`, `inputFrom`, `response`) |
| Q6 | Разрешены ли side-effect consumers (choreography)? | **Нет.** Cross-service async → Zeebe only |
| Q7 | Cross-service projection-consumer (read-model replication) разрешён? | Да — это пассивное чтение, не choreography |
| Q8 | Где живёт webhook handler модуля? | Внутри модуля (его HTTP-endpoint), **не** binding в `@rntme/bindings` |
| Q9 | Сколько pre-fetch steps разрешено в одной команде? | **≤ 2** (hard validator gate); больше — upgrade to Zeebe |
| Q10 | Idempotency-key chain — обязательная? | **Да.** HTTP `Idempotency-Key` → command cache → module gRPC metadata → vendor SDK |
| Q11 | Какой transport для module ↔ domain-service? | gRPC (protobuf). HTTP — только для webhook inbound и legacy |
| Q12 | State storage для P2 multi-step flow (OAuth и т.д.)? | Обычная QSM projection, derived from `FlowStarted` / `FlowCompleted` events |
| Q13 | Объём первой итерации | 5 implementation plan'ов (§14); Stripe reference — последний как валидация |

## 4. Three-tier integration model

Платформа различает три tier'а интеграций с нарастающей сложностью. LLM-агент и дизайнер сервиса выбирает tier по характеристикам вендора — ниже эвристика.

### 4.1 Tier 1 — Reference data

**Когда:** источник — медленно меняющийся справочник (курсы валют, страны, ZIP-коды, telecom-префиксы).
**Решение:** scheduled-sync consumer, результат — локальная QSM projection, доступная в query/command read-prelude как обычная таблица.
**Не в скоупе этой спеки;** упомянут для полноты.

### 4.2 Tier 2 — Simple outbound read

**Когда:** вендор отвечает быстро (<500ms), без собственного state, без webhook'ов (geocode, captcha verify, WHOIS).
**Решение:** pre-fetch в `command` binding через **легковесный HTTP adapter** (не полный модуль). Детали — отдельная спека на mini-adapter-DSL, здесь оговариваем только интерфейс между bindings-http и adapter-wrapper'ом.

### 4.3 Tier 3 — Rich integration (module)

**Когда:** вендор имеет собственный state, webhook'и, сложный SDK, retry-quirks, multi-step flows (Stripe, Resend, Algolia, OpenAI, Clerk).
**Решение:** отдельный сервис-модуль с vendor SDK в коде, gRPC-surface наружу, webhook receiver внутри. Domain-сервисы зовут модуль через pre-fetch gRPC. Основа этой спеки — именно tier 3.

## 5. Module pattern

**Определение:** platform module — это рантайм-сервис, который:

- Использует runtime-инфраструктуру rntme (event-store, relay, projection-consumer, service manifest) — но **не обязан**.
- Реализует свой `CommandExecutor` / `QueryExecutor` кодом (а не Graph IR), потому что сложность vendor SDK нельзя и не нужно выражать в artifact-языке.
- Экспонирует публичный gRPC API (набор RPC), определённый `.proto`.
- Экспонирует публичные event-типы (CloudEvents-envelope, см. related), публикуемые в Kafka-topic `platform.<module>.<aggregate>`.
- Принимает webhook'и от своего вендора собственным HTTP-endpoint'ом, верифицирует, dedupлит, трансформирует в события.

Модуль выглядит снаружи как обычный rntme-сервис (такой же контракт с Kafka/Zeebe/service-registry), отличается только тем, что его бизнес-логика — код.

### 5.1 Что модуль обязан публиковать

1. **`.proto` файл** — определение gRPC service + message types. Публикуется в contract-registry платформы (см. `platform-api-design.md` §2 — registry будет хранить эти файлы).
2. **Event-schema файл(ы)** — CloudEvents `dataschema`-compatible. Публикуется туда же.
3. **`module.json` манифест** — metadata (name, version, contact, required secrets, webhook path). Минимальный формат определяется в implementation-плане.

### 5.2 Что модуль свободен выбрать

- Язык (любой — Node/Go/Python/Rust), пока экспонирует gRPC и соответствует contract'у.
- Внутренняя БД — SQLite через `DbDriver` seam, Postgres, Redis, in-memory — любая.
- Использование rntme artifact'ов для собственных проекций (если удобно — можно авторить QSM + projection-consumer внутри модуля).

### 5.3 Что модуль **не** делает

- **Не** вызывает другие platform-модули напрямую. Composition — через Zeebe или через domain-сервис.
- **Не** реагирует автономно на события других сервисов (choreography запрещена).
- **Не** хранит tenant/user-authorization state платформенного уровня (этим занимается control-plane и domain-сервисы).

## 6. Runtime seam changes

### 6.1 Новые seam'ы в `@rntme/runtime`

```typescript
// packages/runtime/src/plugins/interfaces.ts (конcептуально)

export interface CommandExecutor {
  execute(
    ctx: CommandContext,
    input: CommandInput
  ): Promise<Result<{ events: EventEnvelope[]; response?: unknown }>>;
}

export interface QueryExecutor {
  execute(
    ctx: QueryContext,
    input: QueryInput
  ): Promise<Result<unknown>>;
}

export interface ExternalAdapterClient {
  call(
    module: string,
    rpc: string,
    input: unknown,
    opts: { idempotencyKey: string; timeoutMs: number; retry: RetryPolicy }
  ): Promise<Result<unknown>>;
}
```

**Defaults:**
- `CommandExecutor` default = `GraphIrCommandExecutor` (текущий, из `graph-ir-compiler`).
- `QueryExecutor` default = `GraphIrQueryExecutor`.
- `ExternalAdapterClient` default = `GrpcAdapterClient` (новая имплементация с circuit-breaker, connection pool, idempotency-header forwarding).

**Alternatives:**
- `CodeExecutor` — для модулей: принимает map `{ commandName → async (ctx, input) => Result<events> }`. Никакого graph-IR. Остальные seam'ы (event-store, projections, relay) работают нормально.

### 6.2 Новый пакет `@rntme/bindings-grpc`

Symmetric `@rntme/bindings-http`, но:
- Читает `BindingsArtifact`.
- Генерирует `.proto` из command/query definitions.
- Mount'ит gRPC-сервер (@grpc/grpc-js) вместо Hono.
- Один сервис может иметь оба surface'а одновременно (HTTP для внешних клиентов, gRPC для internal platform).

`@rntme/runtime` manifest получает поле `surfaces: [{ kind: "http", ... }, { kind: "grpc", port: 50051 }]`.

## 7. Primitive P-1: pre-fetch gRPC in `command` binding

### 7.1 Schema extension

`command` binding получает опциональное поле `pre[]`:

```typescript
type PreStep =
  | { kind: "system"; op: "randomBytes"; bytes: number; bindAs: string }
  | { kind: "module-rpc"; module: string; rpc: string;
      input: Expression; bindAs: string;
      timeoutMs?: number;      // default 2000
      retry?: RetryPolicy;     // default { attempts: 3, backoffMs: "exp", retryOn: "transient" } }
```

**Invariants (validator-enforced):**
- `pre.length ≤ 2` (hard gate; error `BINDINGS_CONSISTENCY_PRE_TOO_MANY`).
- Каждый `pre[i].bindAs` уникален в рамках binding.
- `input` expression может ссылаться на `$body`, `$query`, `$auth`, `$config`, `$system.*`, `$pre.<previousStep>`.
- `module` должен быть объявлен в `manifest.json` > `modules[]` с адресом gRPC endpoint'а.

### 7.2 Runtime semantics

`bindings-http` middleware (pseudocode):

```
function runPreSteps(binding, request):
  systemFields.pre = {}
  for step in binding.pre:
    switch step.kind:
      case "system":  value = generateSystemValue(step.op, step.params)
      case "module-rpc":
        idempotencyKey = deriveKey(request.commandRunId, stepIndex)
        value = await externalAdapterClient.call(
          module = step.module, rpc = step.rpc,
          input = evalExpression(step.input, { body, query, auth, config, system, pre: systemFields.pre }),
          opts = { idempotencyKey, timeoutMs: step.timeoutMs, retry: step.retry })
        if value.isErr: return failBindingWithMappedHttpStatus(value.error)
    systemFields.pre[step.bindAs] = value

  return executeCommand(binding.command, { ...parsedInput, systemFields })
```

Event payload, emitted командой, **содержит** все значения pre-fetch (через expression'ы emit'а). Replay из event-log'а НЕ перевызывает pre-steps — их результаты уже в payload событий.

### 7.3 Idempotency-key chain (mandatory)

Цепочка из трёх слоёв, каждый обязан форвардить нижележащему:

```
Client:       HTTP Header  `Idempotency-Key: <client-key>`
                │
bindings-http:  commandRunId = deriveRunId(commandName, clientKey)
                Response cache keyed on (commandName, clientKey), TTL 24h
                │
pre-fetch:      step-key = hash(commandRunId + ":pre:" + stepIndex)
                gRPC metadata `rntme-idempotency-key: <step-key>`
                │
module:         forwards to vendor SDK (e.g. stripe.createCustomer({ idempotencyKey: step-key }))
```

Любой retry в любой точке цепочки безопасен — vendor вернёт тот же результат (native idempotency).

### 7.4 Failure classification (S1 + S3)

gRPC status → HTTP status + rntme error code:

| gRPC Status | Retryable? | HTTP out | Error code |
|---|---|---|---|
| OK | — | 200 | — |
| DEADLINE_EXCEEDED | yes | 504 | `EXTERNAL_MODULE_TIMEOUT` |
| UNAVAILABLE | yes | 503 (+ Retry-After) | `EXTERNAL_MODULE_UNAVAILABLE` |
| RESOURCE_EXHAUSTED | yes (backoff) | 503 | `EXTERNAL_MODULE_OVERLOAD` |
| INTERNAL, UNKNOWN | yes (+ alert) | 502 | `EXTERNAL_MODULE_INTERNAL` |
| INVALID_ARGUMENT | no | 400 | domain-pass-through (`PAYMENTS_*`, `EMAIL_*`, ...) |
| NOT_FOUND | no | 404/400 | domain-pass-through |
| FAILED_PRECONDITION | no | 409 | domain-pass-through |
| PERMISSION_DENIED | no | 403 | domain-pass-through |

Domain-error codes модуль объявляет в своём event-schema / `.proto` описании; bindings-http пробрасывает их без трансформации в тело ответа.

### 7.5 Circuit breaker per module (S6)

`ExternalAdapterClient` держит per-(module, rpc) state: error-rate over sliding window. При превышении threshold (default: >50% over 30s, >10 calls) размыкается, pre-step возвращает `EXTERNAL_MODULE_UNAVAILABLE` мгновенно без сетевого вызова. Half-open probe каждые 30s.

### 7.6 Observability (S7)

Каждый pre-step производит:
- Structured log `pre_step_started` / `pre_step_completed` с полями `command`, `step_index`, `module`, `rpc`, `idempotency_key`, `duration_ms`, `attempts`, `result`, `error_code`.
- OpenTelemetry span (child of HTTP span, parent of internal gRPC span).
- Counter: `external_pre_step_total{module, rpc, result, error_code}`.

### 7.7 Partial success ("orphan artifacts") policy (S4)

Если `pre[0]` успешна, `pre[1]` падает на non-retryable error — команда не исполняется, `pre[0]`-овский vendor-side-effect "осиротел". Официальная позиция:

- **Default:** accept orphans. Vendor-side idempotency гарантирует, что retry команды (с тем же `commandRunId`) переиспользует артефакт (customer, session, etc.).
- **Escalation:** если цепочка из 2 шагов с real-money side-effect'ами (например, оба — side-effectful write'ы) — автор обязан перенести flow в Zeebe. Валидатор флагает `pre[].length == 2` + оба `pre[]` помечены side-effectful → warning, не error (в первой итерации).

## 8. Primitive P-2: extended `command` binding for P2 callbacks

### 8.1 Schema additions

`command` binding получает три новых опциональных поля:

```typescript
type CommandBinding = {
  kind: "command";
  command: string;
  path: string;
  method?: "GET" | "POST";                       // default "POST"
  inputFrom?: Record<string, InputSource>;       // default: body (JSON)
  response?: ResponseShape;                       // default: { onOk: { json: "$result" }, onErr: { json: "$error" } }
  pre?: PreStep[];                                // from §7
};

type InputSource =
  | { from: "body"; path?: string }
  | { from: "query"; name: string; required?: boolean }
  | { from: "header"; name: string; required?: boolean }
  | { from: "form"; name: string };               // POST form-encoded, используется в SAML

type ResponseShape = {
  onOk:  { json: Expression } | { redirect: Expression; status?: 302 | 303 };
  onErr: { json: Expression } | { redirect: Expression; status?: 302 | 303 };
};
```

### 8.2 Semantics

- `method: GET` **разрешено** даже для команд с side-effect (для callback'ов это ожидаемо, документируем как исключение из REST-convention).
- `response.redirect.expr` поддерживает template-substitution: `"/app/settings?connected={$result.accountId}"`.
- При `response.redirect` тело пусто, статус 302 (или 303).

### 8.3 P2 pattern — canonical recipe

Multi-step interactive vendor flow (OAuth, hosted-checkout, magic link) реализуется **двумя командами + одним callback-binding'ом**, без новых примитивов:

1. **Initiate command.**
   - `pre[]`: `{ kind: "system", op: "randomBytes", bytes: 32, bindAs: "state" }` + `{ kind: "module-rpc", rpc: "BuildRedirectUrl", ..., bindAs: "redirect" }`.
   - Graph emit: `FlowStarted { flowId: uuid(), userId, state, expiresAt, returnUrl }`.
   - Response: `{ json: "{ redirectTo: $pre.redirect.url }" }`.

2. **Local projection `pending_flow`** (обычная QSM projection derived from `FlowStarted` + `FlowCompleted` / `FlowCanceled`): поля `flowId, state, userId, status, expiresAt, consumedAt`.

3. **Callback binding (extended `command`)**:
   - `path: "/oauth/<vendor>/callback"`, `method: "GET"`, `inputFrom.state`/`code` from query.
   - Target command — **Complete command** (ниже).
   - `response`: onOk redirect в app UI, onErr redirect в error page.

4. **Complete command.**
   - Read-prelude: query `pending_flow where state = $input.state and status = 'pending' and expiresAt > now()` — fail `FLOW_NOT_FOUND_OR_EXPIRED` иначе.
   - `pre[]`: `{ kind: "module-rpc", rpc: "ExchangeFlowResult", input: "{ sessionId: $flow.id, code: $input.code }", bindAs: "result" }`.
   - Graph emit: `FlowCompleted { userId, <vendor artifact>, flowId }`.
   - Response (через binding): redirect URL из `$result.returnUrl` или fixed.

### 8.4 Security requirements (SR1–SR5)

- **SR1 Random state:** `$system.randomBytes(32)` в pre-step, результат попадает в event payload → replay детерминистичен.
- **SR2 State→flow mapping через projection** (не cookie).
- **SR3 Single-use:** `FlowCompleted` emit → projection-consumer помечает `status='completed'`; повторный callback находит completed → fail `FLOW_ALREADY_CONSUMED`.
- **SR4 CSRF binding to session:** в `pending_flow.userId` записан инициировавший user; при наличии session-cookie на callback'е — сверяем, иначе (magic-link стиль) — принимаем как identity-claim.
- **SR5 Expiration:** `expiresAt` поле в projection; фильтр в read-prelude + scheduled pruning опционально.

### 8.5 Module role in P2

Модуль экспонирует через gRPC две операции: `BuildRedirectUrl(sessionParams) → {sessionId, url}` и `ExchangeFlowResult(sessionId, artifact) → {resolvedData}`. Callback endpoint — **на domain-сервисе**, не на модуле (state encoding — domain concern, не vendor wrapper'а).

Исключение: когда вендор требует единственный зарегистрированный `redirect_uri` без поддержки динамического — может быть развёрнут централизованный `@rntme-platform/callback-router` сервис, который диспатчит в domain-сервис через sync gRPC. Опциональный компонент инфраструктуры, не часть MVP.

## 9. Primitive P-3: cross-service projection-consumer (boundary clarification)

Domain-сервис **может** держать projection-consumer, подписанный на Kafka-топики других сервисов / модулей — **только для read-model репликации**. Например, SubscriptionService может читать `platform.payments.checkout.*` и вести локальную таблицу `paid_checkouts`.

**Запрещено:** projection-consumer, который в ответ на внешний event эмитит свои события или вызывает свои же command'ы. Это choreography.

**Разрешённые паттерны:**
- Passive denormalization для query performance.
- Audit log / analytics ingestion в локальный read-model.

**Для реактивной обработки cross-service events** — Zeebe BPMN process subscribe'ится на Kafka topic (BPMN Message Start Event), затем вызывает domain-сервисы через gRPC в явной orchestration.

Это разделение уже соответствует канону `docs/adr/2026-04-15-event-driven-architecture.md`; здесь мы явно фиксируем, что **никаких новых механизмов для cross-service reaction в rntme-слое не появляется**.

## 10. Data flow examples

### 10.1 Subscribe-to-Pro через Stripe module

**Trigger:** пользователь жмёт "Subscribe to Pro" в UI.

```
[Client] ──POST /commands/subscribe {planId}──▶ [SubService bindings-http]
                                                  │ inputFrom.body.planId
                                                  │
                                                  ├─ pre[0] (kind=module-rpc, bindAs="customer"):
                                                  │     module=payments, rpc=GetOrCreateCustomer
                                                  │     input={ userId: $auth.userId, email: $auth.email }
                                                  │     idempotencyKey derived, timeout=2000ms
                                                  │     ▼
                                                  │   [payments module] GrpcAdapterClient → Stripe SDK
                                                  │     stripe.customers.create({ idempotencyKey: ... })
                                                  │     returns { customerId }
                                                  │
                                                  ├─ pre[1] (kind=module-rpc, bindAs="session"):
                                                  │     module=payments, rpc=CreateCheckoutSession
                                                  │     input={ customerId: $pre.customer.customerId, priceId: lookup($body.planId) }
                                                  │     ▼
                                                  │   [payments module] → Stripe createCheckoutSession
                                                  │     returns { sessionId, url }
                                                  │
                                                  ▼ executeCommand "subscribe" with systemFields.pre.*
                                                [SubService graph-IR]
                                                  emit CheckoutSessionCreated {
                                                    userId, planId, stripeCustomerId, sessionId, url }
                                                  response: { json: "{ checkoutUrl: $pre.session.url }" }

[Client] ◀── { checkoutUrl } ──
[Client] redirect ─▶ [Stripe Checkout] ─▶ user pays ─▶

[Stripe] ──webhook checkout.session.completed──▶ [payments module /webhooks/stripe]
                                                    │ verify signature
                                                    │ check webhook_dedupe(stripe_event_id)
                                                    │ if not seen: emit envelope event
                                                    ▼
                                                  Kafka topic: platform.payments.checkout
                                                  event: CheckoutCompleted { sessionId, customerId, amount, ... }

[Zeebe BPMN] (subscribed via message-start-event on platform.payments.checkout)
             ▼
             task: gRPC SubService.ActivateSubscription(userId, sessionId)
             ▼
[SubService]  pre[]: <none>
             execute graph:
               read-prelude: query paid_checkouts by sessionId (consumed from passive projection)
               emit SubscriptionActivated { userId, plan, activatedAt }
             return ok to Zeebe
             ▼
[Zeebe] process completes
```

### 10.2 Stripe Connect OAuth (P2)

```
[Client] ──POST /commands/connectStripe──▶ [SubService]
                                             pre[0] (bindAs="state"): system.randomBytes(32)
                                             pre[1] (bindAs="connect"):
                                               payments.BuildConnectUrl({
                                                 state: $pre.state,
                                                 returnUrl: $config.selfUrl + "/oauth/stripe/callback"
                                               }) → { url }
                                             execute graph:
                                               emit ConnectFlowStarted {
                                                 flowId, userId, state: $pre.state,
                                                 expiresAt: now+15m }
                                             response: { json: "{ redirectTo: $pre.connect.url }" }

[Client] redirect ──▶ [Stripe OAuth page] ──user authorizes──▶
[Stripe] 302 ──▶ GET /oauth/stripe/callback?state=abc&code=xyz

[SubService bindings-http] matches extended command binding:
  method=GET, inputFrom.state=query.state, inputFrom.code=query.code
  ▼
  executeCommand "completeStripeConnect":
    read-prelude: pending_connect_flow where state=$input.state and status='pending' and expiresAt>now()
                  → if not found: return FLOW_NOT_FOUND_OR_EXPIRED
    pre[0]: payments.ExchangeConnectCode({ flowId: $flow.id, code: $input.code })
            → { stripeAccountId }
    emit StripeAccountConnected { userId: $flow.userId, stripeAccountId }
  
  response.onOk: { redirect: "/settings/billing?connected=1", status: 302 }
  response.onErr: { redirect: "/settings/billing?error={$errorCode}", status: 302 }

[Client browser] ◀── 302 /settings/billing?connected=1
```

## 11. Error handling framework

Сведено из §7; повторяется для удобства как единый блок:

- **S1 — Retry classifier:** transient (DEADLINE_EXCEEDED, UNAVAILABLE, RESOURCE_EXHAUSTED, INTERNAL) автоматически ретраятся per-step по policy; non-retryable (INVALID_ARGUMENT, NOT_FOUND, FAILED_PRECONDITION, PERMISSION_DENIED) фэйлят pre-step сразу.
- **S2 — Idempotency-key chain:** mandatory, часть module contract.
- **S3 — Error mapping:** таблица в §7.4; domain errors pass-through without translation.
- **S4 — Partial success:** accept orphans as default.
- **S6 — Circuit breaker:** per (module, rpc) в `ExternalAdapterClient`.
- **S7 — Observability:** structured logs + metrics + traces mandatory per step.
- **S5 (`onError: fallback/skip`):** deferred, можно добавить без breaking change.
- **S8 (auto sync→async degradation):** deferred.

Error-code namespace:

- `EXTERNAL_MODULE_TIMEOUT`, `_UNAVAILABLE`, `_OVERLOAD`, `_INTERNAL`, `_SCHEMA_MISMATCH`, `_CONTRACT_VIOLATION` — для transport/module-level failures.
- Domain-level: модуль объявляет свои (`PAYMENTS_PRICE_NOT_FOUND`, `EMAIL_INVALID_ADDRESS`, etc.) в контракт-реестре.
- `BINDINGS_CONSISTENCY_PRE_TOO_MANY` — validator-level for `pre.length > 2`.

## 12. Module contract

Публикуется модулем в contract-registry (часть control-plane, см. `platform-api-design.md`).

### 12.1 Required artifacts

1. **`module.json`** — манифест:
   ```json
   {
     "name": "payments",
     "version": "1.0.0",
     "contact": "...",
     "grpcServiceName": "platform.payments.v1.PaymentsModule",
     "webhookPath": "/webhooks/stripe",
     "secrets": [{ "name": "STRIPE_SECRET_KEY", "scope": "tenant" }]
   }
   ```
2. **`<module>.proto`** — gRPC service definition; message types для всех RPC.
3. **`<module>.events.json`** — schema каждого emit'имого типа события (совместимо с CloudEvents `dataschema`).

### 12.2 Required behaviour

- Все RPC с vendor-side side-effect принимают `rntme-idempotency-key` в gRPC metadata и форвардят в vendor SDK.
- Webhook endpoint верифицирует vendor-signature.
- Webhook dedupes по `<vendor>_event_id` в собственной таблице (reflects exactly-once delivery приёма).
- Health-check RPC (standard platform convention `Health.Check`).
- Domain errors возвращаются через gRPC status + `error_details` message с stable code.

### 12.3 Optional but recommended

- Internal use of rntme runtime для собственных проекций (e.g., cached Stripe customers).
- OpenTelemetry instrumentation для всех RPC + webhook handlers.
- Graceful degradation (cache-backed read RPCs continuing when vendor is down).

## 13. Testing model

### 13.1 Domain service

- Unit tests: `ExternalAdapterClient` мок; фейковые ответы `pre[]` шагов; проверка emit events matches expectations.
- Contract tests: `.proto` модулей в dependencies — typed clients генерятся в CI; mismatch detected at build time.
- Integration tests: поднимать real-module-docker ИЛИ `@rntme/external-adapter-fake` (in-memory server implementing `.proto` stub) + cover happy-path + error scenarios.

### 13.2 Module

- Vendor SDK stub (Stripe provides official test library; Resend has fixture-based mocks).
- gRPC contract tests against own `.proto`.
- Webhook signature unit tests (valid / invalid / replayed).
- Webhook dedupe unit test (same event_id twice → only one envelope).

### 13.3 End-to-end

- **Not** extending demo/issue-tracker-api; создаём отдельный demo (`demo/stripe-subscribe-demo/`) для E2E-валидации Stripe module.
- Stripe CLI used for webhook delivery in E2E (local dev), replaced by WireMock or similar in CI.

## 14. Decomposition into implementation plans

Эта спека декомпозируется на **5 implementation plan'ов**, каждый пишется отдельно после approval этой спеки. Все планы лежат в `docs/superpowers/plans/done/platform-modules-integration/` (отдельная подпапка, не общий `plans/`).

| # | Plan | Что охватывает | Зависимости |
|---|---|---|---|
| 1 | `01-code-executor-seam.md` | `CommandExecutor` / `QueryExecutor` seams в `@rntme/runtime`; module skeleton package template; health-check convention | — |
| 2 | `02-bindings-grpc-surface.md` | Новый пакет `@rntme/bindings-grpc`; proto generation from BindingsArtifact; manifest surfaces[] | Plan 1 | implemented 2026-04-22 |
| 3 | `03-pre-fetch-middleware.md` | `pre[]` schema extension в `@rntme/bindings`; middleware в `@rntme/bindings-http`; `ExternalAdapterClient` seam; idempotency-key chain; error-code namespace; circuit breaker; observability | Plan 2 | implemented 2026-04-22 |
| 4 | `04-extended-command-binding-p2.md` | Поля `method`/`inputFrom`/`response` на `command` binding; `$system.randomBytes`; validator rules; OpenAPI emit для GET endpoints | Plan 3 | implemented 2026-04-23 |
| 5 | `05-reference-stripe-module.md` | Работающий Stripe module (subscribe + connect OAuth); E2E demo `demo/stripe-subscribe-demo/`; валидация полного стека | Plans 1-4 |

Порядок — sequential; параллелится только внутри отдельного плана. Каждый plan завершается зелёным `pnpm -r test` и обновлённым gap-report'ом.

## 15. Out of scope / future brainstorms

Прямые продолжения этого дизайна, которые заслуживают собственных спек:

1. **Zeebe worker adapter** (`@rntme-platform/zeebe-worker`) + BPMN task-conventions. Без этого cross-service async работает "только на бумаге".
2. **Streaming primitive** (server-streaming gRPC / SSE proxy) — для LLM integrations (OpenAI, Anthropic, RAG-pipelines).
3. **Tier-2 mini-adapter-DSL** — lightweight HTTP adapter для geocode/captcha/WHOIS без развёртывания отдельного module-сервиса.
4. **Client-direct scoped-credential pattern** — recipe (не примитив) для S3 uploads, Stripe Elements, Plaid Link widget.
5. **Multi-tenant secret management** для модулей — как модуль получает per-tenant vendor-creds, как они ротируются, audit.
6. **S5 `onError` policy** (fallback/skip) — когда появятся реальные use-cases не-критичного enrichment.
7. **S8 auto degradation sync→async** — сложная примитива, отложена до появления use-case'а с неприемлемым UX при vendor down.

## 16. Open questions

Вопросы, которые не блокируют start плана #1 но должны быть закрыты до плана #5:

- **OQ1:** В `manifest.json` domain-сервиса, как описываем доступные modules? Inline адреса (`{ name: "payments", grpc: "grpc://payments:50051" }`) или reference через contract-registry (`{ name: "payments", version: "^1.0.0" }` → registry resolves). Склоняюсь к registry-reference, но в MVP может быть inline для простоты.
- **OQ2:** Proto generation: генерируем ли TypeScript types для каждого модуля внутри `bindings-grpc` или на стороне domain-сервиса через codegen CLI. Влияет на DX и CI-pipeline.
- **OQ3:** Webhook endpoint модуля — host/port/path convention. Должен ли платформенный router перед модулями знать о webhook routes для TLS-termination / DDoS-protection.
- **OQ4:** Tenant scope vendor secrets. В платформенной архитектуре "один модуль на N tenants" — secrets per-tenant. Формат storage и резолвер — отдельное решение, но влияет на module contract §12.
- **OQ5:** Versioning модулей. Если домен-сервис объявляет `payments ^1.0.0`, как control-plane enforces compatibility при deploy'е. Частично покрывается `platform-api-design.md`; здесь отмечаем лишь точку пересечения.

## 17. References

- `docs/adr/2026-04-15-event-driven-architecture.md` — SQLite per-service + Kafka + Zeebe + ksqlDB разделение.
- `docs/gaps/commands-and-transactions-gaps.md` — P1 idempotency-key canon, P0 outbox pattern.
- `docs/superpowers/specs/done/2026-04-19-platform-api-design.md` — control-plane registry, §2 deferred items (gRPC surface + Zeebe) здесь частично покрыты.
- `docs/superpowers/specs/done/2026-04-17-cloudevents-envelope-design.md` — envelope/dataschema format, используется модулями.
- `docs/superpowers/specs/done/2026-04-18-rntme-cli-submodule-design.md` — где живёт control-plane код.
- `rntme_orchestration_only` memory — принцип запрета choreography.
- `project_platform_vision` memory — видение rntme внутри DDD-платформы.
- `rntme_topic_no_version_suffix` memory — Kafka topic convention.
