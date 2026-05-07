# OpenRouter AI/LLM module + canonical contract clarifications — design

**Status:** design
**Author:** brainstorm 2026-05-06
**Related:**
- `docs/superpowers/specs/done/2026-04-26-ai-llm-canonical-contract-design.md` — defines the canonical AI/LLM contract this module implements. This spec lands the first vendor module against that contract and adds non-breaking text/test clarifications.
- `docs/superpowers/specs/2026-04-26-modules-monorepo-structure-design.md` — module pattern, capability declarations, conformance UNION; this spec follows it.
- `docs/superpowers/specs/done/2026-05-06-graph-ir-effect-operations-design.md` — graph-IR `call` node mechanics that the demo depends on for invoking `AiLlmModule.Complete`.
- `rntme_turso_target` memory — project storage target is SQLite/Turso, never Postgres/Redis.
- `project_pre_stable_stage` memory — pre-revenue, no users; no backwards-compat shims.

**Implementation locations:**
- New module — `modules/ai-llm/openrouter/` (workspace package `@rntme/ai-llm-openrouter`).
- New demo blueprint — `demo/cv-extract-blueprint/`.
- Contract clarifications — text changes in `packages/contracts/ai-llm/v1/README.md` and `modules/ai-llm/README.md`; new drift-pin tests in `packages/contracts/ai-llm/v1/test/`. **No `.proto` changes.**
- Implementation plan for this spec — `docs/superpowers/plans/ai-llm-openrouter-module/` (created by writing-plans after this spec is approved).

## 1. Problem

The canonical AI/LLM contract `@rntme/contracts-ai-llm-v1` has been merged but no vendor module has landed. Without a working vendor implementation, two consequences:
1. We cannot demonstrate the contract end-to-end, and the existing conformance skeleton (empty scenario files in `modules/ai-llm/conformance/`) has no implementation to test against.
2. Demo blueprints that need an LLM (e.g. anything that ingests user content and returns structured output) have no way to invoke one through the canonical surface.

A concrete demo motivates this work: a user uploads a resume PDF in the UI; the system feeds it to an LLM with a JSON-schema-pinned prompt; the user sees the extracted work-experience JSON. This is the simplest possible end-to-end exercise of `Complete` with file input and structured output — the kind of scenario the contract was designed for.

OpenRouter is a deliberate choice for the **first** vendor module. As a multi-provider gateway it routes to OpenAI, Anthropic, Google, Meta, Mistral, DeepSeek, and others under a single API and a single API key. One module unblocks any model the gateway covers — useful for a project that has not yet committed to a primary upstream and wants to pick per-demo. It also surfaces gateway-specific assumptions in the contract that single-vendor modules would never expose.

The brainstorm explicitly chose the **C strategy** from option C ("demo-минимум сейчас + явный backlog для контракта"): build only what the demo needs, but write down every contract gap discovered along the way so future work has a roadmap.

## 2. Goal

Land a working OpenRouter vendor module sufficient to power a minimum-surface CV-extract demo, plus the smallest set of contract clarifications that close ambiguities encountered while building it. No `.proto` changes; documentation, schema, and drift-pin tests only.

**In scope:**
- New module `modules/ai-llm/openrouter/` implementing `AiLlmModule.Complete` and `AiLlmModule.GetCompletion`. Twelve other RPCs return `UNIMPLEMENTED`.
- SQLite-backed idempotency dedup-store (≥24h TTL), reused as the GetCompletion backing store within the same window.
- HTTP client to OpenRouter `https://openrouter.ai/api/v1/chat/completions` with bidirectional proto ↔ OR JSON mapping for text, image, file (PDF), tool-use, tool-result, and thinking content blocks.
- Error-mapper from OR HTTP status + error body to `AI_LLM_VENDOR_*` codes.
- New demo blueprint `demo/cv-extract-blueprint/` with one entity (`Resume`), one projection (`ResumeView`), two graphs (`extractResume`, `getResume`), HTTP bindings (`POST /resumes`, `GET /resumes/{id}`), and a single-page UI.
- Four contract clarifications (see §4): `vendors[]` semantics for gateway modules, `GetCompletion` semantics for stateless modules, `SamplingParams.response_format` enum values, idempotency-store recommendation.
- Two new drift-pin test files in `packages/contracts/ai-llm/v1/test/`.
- Documentation touches per CLAUDE.md §11 (see §8).

**Explicitly out of scope:**
- Streaming (`StreamComplete` and per-chunk events) — contract v1 is unary-only, deferred to v2.
- Threads (`AssistantThread*` RPCs) — OpenRouter has no native thread state.
- Async batch jobs (`AsyncJob*` RPCs) — OpenRouter does not proxy OpenAI Batch API; a future sub-class module `module-ai-llm-openai-batch` would handle these.
- Audio modality — declared `false` for openrouter v1; demo uses PDF only.
- Cost tracking as a first-class field — OR returns `usage.cost`; lands in `Completion.vendor_raw` until the contract gets `cost_micro_usd`.
- Per-model capability resolution — `module.json#capabilities` declares the gateway's UNION; per-model variance is a backlog item.
- Provisioner — not needed; OpenRouter has no external state to reconcile, only a single API key.
- Webhook receiver — OpenRouter has no webhooks for completions.
- File storage via S3/blob — separate brainstorm; this demo uses inline base64 in event payloads.
- Graceful error path in the demo — graph fails on OR error → HTTP 5xx → no record in `ResumeView`.
- Async polling flow in the demo — `POST /resumes` is synchronous and waits for the LLM call.
- Conformance scenario implementations — runner does not yet exist.

## 3. Approach

We chose **B** out of the two approaches discussed in the brainstorm: build the module + ship the smallest possible non-`.proto` contract clarifications. Rationale:

- The four clarifications (§4) are gaps we are forced to nail down while implementing the module anyway. Documenting them now is cheaper than retroactively reverse-engineering the module's behaviour later.
- All four are pure text and drift-pin tests: zero risk to existing modules, no migration pain.
- Strategy C from the brainstorm — explicit backlog of larger contract changes (§9) — keeps the rest of the iceberg visible without forcing it into this PR.

The PR ships three deliverable groups (D1 contract clarifications, D2 module, D3 demo) plus documentation (D4) and an explicit backlog appendix (D5). See §10.

## 4. Contract clarifications

All clarifications land in `packages/contracts/ai-llm/v1/` and `modules/ai-llm/`. **No proto changes.** Two new test files act as drift-pins.

### 4.1 `vendors[]` and model addressing for gateway modules

**Current state.** `modules/ai-llm/README.md` says: *"Multi-provider gateway: list every upstream you route to."* This creates a routing collision: `module-ai-llm-openrouter` declaring `vendors: ["openai", "anthropic", ...]` and a future `module-ai-llm-openai` declaring `vendors: ["openai"]` both claim the `openai/*` model prefix.

**Clarification.**
- `capabilities.vendors[]` is the **routing prefix** of the module. Single element. For single-vendor: `["openai"]`. For gateway: `["openrouter"]` (the gateway's identity, not its upstreams).
- `model` field in `CreateCompletionRequest` is `<vendor>/<rest>`. For gateway modules, `<rest>` may itself contain slashes; canonical form is `openrouter/openai/gpt-4o`. The OpenRouter module strips its own `openrouter/` prefix and forwards `openai/gpt-4o` to OR's API as-is.
- `AI_LLM_STRUCTURAL_VENDOR_MISMATCH` fires when `model` does not start with `<vendors[0]>/`.
- New optional capability field: `capabilities.gateway_upstreams: string[]`. Informational only — it does not influence routing. Used by catalog/UX/conformance to enumerate which upstream providers the gateway can route to. For OpenRouter: `["openai", "anthropic", "google", "meta", "mistralai", "deepseek", "x-ai", "qwen"]` (a representative subset; not exhaustive).

**Where it lands.**
- `packages/contracts/ai-llm/v1/README.md` — extend the "Capability fields" section.
- `modules/ai-llm/README.md` — rewrite the row for `vendors[]` in the capability decision tree; add a row for `gateway_upstreams[]`.
- New drift-pin test `test/capability-shape.test.ts`: asserts `vendors[]` is non-empty single-element for AI/LLM modules; asserts `gateway_upstreams[]` (when present) is `string[]`.

### 4.2 `GetCompletion` semantics for stateless modules

**Current state.** README does not specify what stateless modules should do with `GetCompletion`. A module that returns `UNIMPLEMENTED` is internally inconsistent: `Complete` already issued a `Completion.ref.canonical_id`, but the caller cannot retrieve that completion afterwards.

**Clarification.**
- A module that implements `Complete` MUST implement `GetCompletion` for at least the idempotency TTL window (≥24h).
- Within the window: returns the cached `Completion` (the same proto-bytes returned synchronously from the original `Complete`).
- Outside the window: returns `AI_LLM_VENDOR_NOT_FOUND` (added to `error-codes.json` if not already present; otherwise reuse existing canonical NOT_FOUND code).
- `UNIMPLEMENTED` is forbidden for `GetCompletion` if `Complete` is implemented.

**Where it lands.**
- `packages/contracts/ai-llm/v1/README.md` — new line in the "Invariants" section.
- Existing `test/service-shape.test.ts` — add an assertion: any module manifest that lists `Complete` in `capabilities.rpcs` must also list `GetCompletion`.

### 4.3 `SamplingParams.response_format` allowed values

**Current state.** `optional string response_format = 9` — free-form string. Modules will accept anything.

**Clarification.**
- Documented allowed set: `"text" | "json_object" | "json_schema"`.
- When `"json_schema"`: `response_schema` (Struct) is required.
- When `"json_object"`: `response_schema` is optional; the caller may post-validate.
- When `"text"` or empty: `response_schema` is ignored.
- Structural validation with a new `AI_LLM_STRUCTURAL_INVALID_RESPONSE_FORMAT` code is **deferred to the backlog** (§9). This PR ships only documentation and a drift-pin.

**Where it lands.**
- `packages/contracts/ai-llm/v1/README.md` — extend the `SamplingParams` description in "Helper types".
- New drift-pin test `test/sampling-params.test.ts`: exports the canonical array `["text", "json_object", "json_schema"]` and asserts no other values appear in any committed module.json.

### 4.4 Idempotency-store recommendation

**Current state.** `modules/ai-llm/README.md` reads: *"An idempotency dedup-store (Redis / in-memory / Postgres — chosen by the vendor module; ≥24h TTL)."* Both Redis and Postgres are off-target for this project (memory `rntme_turso_target`).

**Clarification.**
- Replace the line with: *"An idempotency dedup-store (SQLite recommended; in-memory acceptable for dev/test only; ≥24h TTL). Postgres and Redis MUST NOT be assumed; the project storage target is SQLite/Turso."*

**Where it lands.**
- `modules/ai-llm/README.md` — single line edit.

## 5. Module `@rntme/ai-llm-openrouter`

### 5.1 File layout

```
modules/ai-llm/openrouter/
├── package.json                    @rntme/ai-llm-openrouter
├── tsconfig.json
├── tsconfig.check.json
├── eslint.config.mjs
├── vitest.config.ts
├── module.json                     manifest with capabilities + gateway_upstreams
├── Dockerfile                      node:20-alpine, exposes 50051, mounts /data volume
├── README.md                       per-package template
├── src/
│   ├── boot.ts                     gRPC server entry; reads OPENROUTER_API_KEY
│   ├── handler.ts                  AiLlmModule service implementation
│   ├── openrouter-client.ts        HTTP wrapper around OR /chat/completions
│   ├── completion-mapper.ts        proto Completion ↔ OR JSON (both directions)
│   ├── idempotency-store.ts        SQLite or in-memory store, 24h TTL
│   └── error-mapper.ts             HTTP status + OR error body → AI_LLM_VENDOR_*
└── test/
    ├── unit/
    │   ├── completion-mapper.test.ts
    │   ├── error-mapper.test.ts
    │   └── idempotency-store.test.ts
    └── integration/
        ├── handler.test.ts         against mocked OR HTTP
        └── unimplemented.test.ts   12 RPCs return UNIMPLEMENTED
```

### 5.2 `module.json`

```json
{
  "name": "@rntme/ai-llm-openrouter",
  "version": "0.0.0",
  "category": "ai-llm",
  "vendor": "openrouter",
  "contract": "ai-llm/v1",
  "capabilities": {
    "vendors": ["openrouter"],
    "gateway_upstreams": [
      "openai", "anthropic", "google", "meta",
      "mistralai", "deepseek", "x-ai", "qwen"
    ],
    "rpcs": ["Complete", "GetCompletion"],
    "events": ["CompletionStarted", "CompletionFinished", "CompletionFailed"],
    "input_modalities": ["text", "image", "file"],
    "reasoning_visibility_supported": ["hidden", "summary"],
    "thread": false,
    "async_job_types": [],
    "agent_execution_mode": "none"
  },
  "limitations": [
    "Streaming not supported (contract v1 is unary-only).",
    "Threads/Batch RPCs return UNIMPLEMENTED.",
    "Per-model capability variance — declared values are the gateway UNION; specific models may not support tools/reasoning/file/image. Caller pins model based on use case.",
    "Cost from OR exposed only via Completion.vendor_raw.cost_usd.",
    "Audio modality not declared in v1."
  ]
}
```

### 5.3 Source modules

- **`boot.ts`** — fail-fast on missing `OPENROUTER_API_KEY`. Reads `OPENROUTER_BASE_URL` (default `https://openrouter.ai/api/v1`), `OPENROUTER_IDEMPOTENCY_MODE` (`sqlite` default, `memory` for dev), `OPENROUTER_IDEMPOTENCY_PATH` (default `/data/idempotency.sqlite`), `PORT` (default `50051`). Constructs the gRPC server, registers `AiLlmModule.service` with `handler.ts`.

- **`handler.ts`** — implements all 14 RPCs.
  - `Complete`: idempotency-check → emit `CompletionStarted` CloudEvent → call `openrouter-client` → on success map response → store in idempotency-store keyed by `idempotency_key` → emit `CompletionFinished` → return `Completion`. On failure: map error → emit `CompletionFailed` → return error.
  - `GetCompletion`: read by `canonical_id` (= `idempotency_key`) from store; return `AI_LLM_VENDOR_NOT_FOUND` outside window.
  - 12 others: shared `unimplementedHandler`.

- **`openrouter-client.ts`** — `OpenRouterClient.chatCompletions(req)`. Sets `Authorization: Bearer ${apiKey}`, optional `HTTP-Referer` and `X-Title` headers (best practice for OR analytics, not load-bearing). Body is the OR chat completions JSON. No streaming, no provider preferences, no fallback chain in v1.

- **`completion-mapper.ts`** — bidirectional. The mapping table:

| Proto field | OR JSON |
|---|---|
| `model: "openrouter/<X>"` | `model: "<X>"` (strip `openrouter/`) |
| `messages[].role` ∈ `system|user|assistant|tool` | `messages[].role` (1:1) |
| `ContentBlock TEXT` | `{type: "text", text}` |
| `ContentBlock IMAGE.url` | `{type: "image_url", image_url: {url}}` |
| `ContentBlock IMAGE.base64_data` | `{type: "image_url", image_url: {url: "data:${media_type};base64,${b64}"}}` |
| `ContentBlock FILE.url` | `{type: "file", file: {filename, file_data: url}}` |
| `ContentBlock FILE.base64_data` | `{type: "file", file: {filename, file_data: "data:${media_type};base64,${b64}"}}` |
| `ContentBlock TOOL_USE` (assistant) | `tool_calls[]` (assistant message) |
| `ContentBlock TOOL_RESULT` (tool) | `content` as JSON-stringified `output` |
| `SamplingParams.{temperature,top_p,top_k,max_tokens,frequency_penalty,presence_penalty,stop_sequences,seed}` | matching OR fields |
| `response_format: "json_schema"` + `response_schema` | `response_format: {type: "json_schema", json_schema: {name: "schema", schema: <Struct>, strict: true}}` |
| `response_format: "json_object"` | `response_format: {type: "json_object"}` |
| `tools[]` + `tool_choice` | `tools[{type:"function", function:{name,description,parameters}}]` + `tool_choice` |
| `ReasoningEffort` enum | `reasoning.effort: "low"|"medium"|"high"` (MINIMAL/MAX→low/high) |

Reverse (OR response → `Completion`):
- `choices[0].message.content` (string) → single `ContentBlock TEXT`.
- `choices[0].message.tool_calls` → repeated `ContentBlock TOOL_USE`.
- `choices[0].message.reasoning` / `reasoning_details` → `ContentBlock THINKING` + `ReasoningInfo`.
- `finish_reason` → `FinishReason` enum (lookup table).
- `usage.{prompt_tokens, completion_tokens, total_tokens, reasoning_tokens?, cached_tokens?}` → `TokenUsage` matching fields. `usage.cost` and any unmapped fields → `vendor_raw`.
- `Completion.ref.canonical_id` = the request's `idempotency_key` (so `GetCompletion` works on it).
- `Completion.model` = `openrouter/${response.model}` (response.model may differ from request when OR's fallback chain fires; we don't enable that here, so they match).

- **`idempotency-store.ts`** — SQLite via `better-sqlite3` (synchronous; module is single-threaded gRPC server) or `libsql` if we want HTTP-target alignment. Schema:
  ```sql
  CREATE TABLE idempotency_records (
    idempotency_key TEXT PRIMARY KEY,
    completion_proto BLOB NOT NULL,
    created_at INTEGER NOT NULL  -- unix epoch ms
  );
  CREATE INDEX idx_created_at ON idempotency_records(created_at);
  ```
  TTL = 24h. Lazy eviction on read (`WHERE created_at > now - 24h`). Background sweep every hour. In-memory mode is a `Map<string, {bytes: Buffer; createdAt: number}>` with the same eviction logic.

- **`error-mapper.ts`** — explicit table:

| OR HTTP status / condition | AI_LLM error |
|---|---|
| `401` | `AI_LLM_VENDOR_AUTH_FAILED` |
| `402` | `AI_LLM_VENDOR_INSUFFICIENT_FUNDS` (add to error-codes.json if absent) |
| `403` | `AI_LLM_VENDOR_FORBIDDEN_MODEL` |
| `404` (model) | `AI_LLM_VENDOR_MODEL_NOT_FOUND` |
| `408` / `504` | `AI_LLM_VENDOR_TIMEOUT` |
| `413` | `AI_LLM_VENDOR_PAYLOAD_TOO_LARGE` |
| `429` | `AI_LLM_VENDOR_RATE_LIMITED` |
| `5xx` (other) | `AI_LLM_VENDOR_UPSTREAM_ERROR` |
| network/TLS | `AI_LLM_VENDOR_NETWORK_ERROR` |

If any of the listed codes do not exist in `packages/contracts/ai-llm/v1/error-codes.json`, they are added in this PR (JSON-only, no proto change).

### 5.4 Dockerfile

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod
COPY dist ./dist
VOLUME /data
ENV PORT=50051
EXPOSE 50051
CMD ["node", "dist/boot.js"]
```

The `/data` volume holds `idempotency.sqlite` across redeploys.

### 5.5 What the module does NOT ship

- **No provisioner.** OR has no external state to reconcile; the API key is a one-time manual issuance.
- **No webhook receiver.** OR has no webhooks for completions.
- **No streaming.** Contract v1 is unary-only.
- **No client-runtime.** Server-only module; no UI contributions.

## 6. Demo `demo/cv-extract-blueprint/`

### 6.1 File layout

```
demo/cv-extract-blueprint/
├── README.md
├── project.json
├── pdm/
│   ├── pdm.json                       { "version": "1" }
│   └── entities/Resume.json
└── services/app/
    ├── service.json                   { "kind": "domain" }
    ├── qsm/
    │   ├── qsm.json                   { "version": "1", "relations": {} }
    │   └── projections/ResumeView.json
    ├── graphs/
    │   ├── extractResume.json
    │   └── getResume.json
    ├── bindings/bindings.json
    ├── seed/seed.json                 { "seedVersion": 1, "events": [] }
    └── ui/
        ├── manifest.json
        └── screens/home.screen.json
```

### 6.2 `project.json`

```json
{
  "name": "cv-extract",
  "modules": {
    "openrouter": {
      "package": "@rntme/ai-llm-openrouter",
      "publicConfig": {
        "defaultModel": "openrouter/openai/gpt-4o",
        "timeoutMs": 60000
      }
    }
  },
  "services": ["app"]
}
```

`OPENROUTER_API_KEY` is injected as a secret env var on the module's workload via Dokploy target config; it is not part of `publicConfig`.

### 6.3 `pdm/entities/Resume.json`

Single state, single transition. If the OR call fails, the graph fails and no record is written — the user sees an HTTP 5xx. Graceful failure path is in the backlog.

```json
{
  "ownerService": "app",
  "kind": "owned",
  "table": "resumes",
  "fields": {
    "id":            { "type": "string",   "nullable": false, "column": "id" },
    "filename":      { "type": "string",   "nullable": false, "column": "filename" },
    "mediaType":     { "type": "string",   "nullable": false, "column": "media_type" },
    "extractedJson": { "type": "string",   "nullable": false, "column": "extracted_json" },
    "status":        { "type": "string",   "nullable": false, "column": "status" },
    "createdAt":     { "type": "datetime", "nullable": false, "column": "created_at", "generated": "createdAt" }
  },
  "keys": ["id"],
  "stateMachine": {
    "stateField": "status",
    "initial": null,
    "states": ["complete"],
    "transitions": {
      "complete": {
        "from": null, "to": "complete",
        "affects": ["filename", "mediaType", "extractedJson"]
      }
    }
  }
}
```

### 6.4 `qsm/projections/ResumeView.json`

```json
{
  "backing": "entity-mirror",
  "source": { "entity": "Resume" },
  "keys": ["id"],
  "grain": ["id"],
  "exposed": ["filename", "mediaType", "extractedJson", "status", "createdAt"]
}
```

### 6.5 `graphs/extractResume.json` (sketch)

Nodes: `uuid` (resume_id) → `call` (openrouter.Complete with literal model + messages built from `$param` fileBase64 + literal prompt + literal JSON Schema) → `emit` (`Resume`/`complete` transition with `filename`, `mediaType`, and `extractedJson` taken from `$ref completion.result.content[0].text`) → `result` (returns `resumeId`).

Two implementation questions resolved in the plan, not the spec:
1. Whether `target.operation: "Complete"` on the `call` node maps directly to the gRPC RPC name. The same mechanism works in `notes-blueprint` for `identity-auth0.IntrospectSession`, so it should — the plan verifies on first implementation.
2. Whether `$literal` supports nested `$param` references for the message content array. If not, the plan introduces an intermediate compose node, or routes that step through a thin code-command-handler.

The work-experience JSON Schema is embedded as a literal in the graph file, not seeded separately. Minimum fields: `full_name`, `experience: [{company, title, start_date, end_date}]`, `education: [{institution, degree, year}]`, `skills: string[]`.

### 6.6 `graphs/getResume.json`

Single `findMany` over `ResumeView` filtered by `id = $param.id`, returns the row or empty.

### 6.7 `bindings/bindings.json`

```json
{
  "version": "1.0",
  "graphSpecRef": "../graphs",
  "pdmRef": "../../pdm",
  "qsmRef": "../qsm",
  "bindings": {
    "extractResume": {
      "graph": "extractResume",
      "target": { "engine": "sqlite", "dialect": "sqlite" },
      "http": {
        "method": "POST",
        "path": "/resumes",
        "parameters": [
          { "name": "filename",   "in": "body", "bindTo": "filename",   "required": true },
          { "name": "mediaType",  "in": "body", "bindTo": "mediaType",  "required": true },
          { "name": "fileBase64", "in": "body", "bindTo": "fileBase64", "required": true }
        ]
      },
      "exposure": "action"
    },
    "getResume": {
      "graph": "getResume",
      "target": { "engine": "sqlite", "dialect": "sqlite" },
      "http": {
        "method": "GET",
        "path": "/resumes/{id}",
        "parameters": [
          { "name": "id", "in": "path", "bindTo": "id", "required": true }
        ]
      },
      "exposure": "read"
    }
  }
}
```

`POST /resumes` is **synchronous** — the response returns after the LLM call completes (~10–30s for a 1–3MB PDF + gpt-4o). If proxy timeouts in production cut this short, an asynchronous polling flow is in the backlog.

### 6.8 UI

A single screen `home.screen.json`: file input (PDF, ≤10MB) + Submit. On submit, POST `/resumes` and render the response inline — `extractedJson` as preformatted JSON, or the HTTP error message otherwise. No polling, no list view, no auth.

### 6.9 What the demo does NOT ship

- No authentication (open demo, like notes-blueprint without identity).
- No multi-tenancy.
- No batch / multi-resume flow.
- No editing of extracted JSON (read-only).
- No model picker (model is pinned in the graph).
- No graceful error path (graph fails → HTTP 5xx → no record).

## 7. Testing strategy

### 7.1 Module unit tests

- `completion-mapper.test.ts` — round-trip fixtures: text-only, text+image (base64 + url), text+file (PDF base64), text+tool_use, text+thinking. Each fixture asserted in both directions.
- `error-mapper.test.ts` — table-driven: `(http_status, or_error_body) → expected AI_LLM_VENDOR_*`.
- `idempotency-store.test.ts` — `put/get/expire` against a temp SQLite file and against in-memory mode. Time advancement via injected `now()`.

### 7.2 Module integration tests

- `handler.test.ts` against mocked OR HTTP (`msw` or `nock`). Scenarios:
  - Happy path: `Complete` → 200 → valid `Completion`. `CompletionStarted` and `CompletionFinished` CloudEvents emitted to a captured bus.
  - Idempotency: same `idempotency_key` twice → exactly 1 OR HTTP call, identical responses.
  - GetCompletion within window: succeeds with the cached `Completion`.
  - GetCompletion outside window: `AI_LLM_VENDOR_NOT_FOUND`.
  - OR `429` → `AI_LLM_VENDOR_RATE_LIMITED`, `CompletionFailed` emitted.
  - OR `401` → `AI_LLM_VENDOR_AUTH_FAILED`.
- `unimplemented.test.ts` — all 12 non-implemented RPCs return gRPC `UNIMPLEMENTED`.

### 7.3 Contract drift-pin tests

- New `packages/contracts/ai-llm/v1/test/capability-shape.test.ts` — pins single-element `vendors[]`, optional `gateway_upstreams: string[]`, `Complete ⇔ GetCompletion`.
- New `packages/contracts/ai-llm/v1/test/sampling-params.test.ts` — pins canonical `response_format` array `["text", "json_object", "json_schema"]`.
- Existing `test/service-shape.test.ts` extended with the `Complete ⇒ GetCompletion` assertion.

### 7.4 Demo tests

- Fixture `test/fixtures/sample-resume.pdf` (any openly-licensed two-page resume).
- `test/integration/extract.test.ts` — bring up the blueprint locally (or its event store + projector independently), POST `/resumes` with the fixture, mock the OR HTTP layer, assert a row appears in `ResumeView` with non-empty `extractedJson`.
- Manual e2e — deploy to local runtime, upload a real PDF in the browser, see the JSON. Listed in the plan as a manual checklist item, not automated.

### 7.5 CI

`pnpm -F @rntme/ai-llm-openrouter test` and `pnpm -F @rntme/contracts-ai-llm-v1 test` both run on every PR. Existing `pnpm -r run test` workspace-wide pass continues to gate merges.

## 8. Documentation touches

Per CLAUDE.md §11, every plan must include a documentation-touch task. This PR updates:

| File | Change |
|---|---|
| `packages/contracts/ai-llm/v1/README.md` | "Vendor prefix and model addressing" extended; "Invariants" gains the `Complete ⇔ GetCompletion` line; "Helper types → SamplingParams" gains `response_format` enum doc |
| `modules/ai-llm/README.md` | Capability decision tree row for `vendors[]` rewritten; new row for `gateway_upstreams[]`; storage line cleaned of Redis/Postgres; "Vendors landed here" updated to list `openrouter` |
| `modules/ai-llm/openrouter/README.md` | New file, per-package template (File map / Quick start / API / Invariants & gotchas / Out of scope / Where to look first / Specs) |
| `demo/cv-extract-blueprint/README.md` | New file describing the blueprint, its entities, how to run locally, link to this spec |
| `README.md` (top level) | Packages table adds `@rntme/ai-llm-openrouter`; dependency graph adds the node and its edge to `contracts-ai-llm-v1`; MVP scope notes the first AI/LLM vendor module landed |
| `AGENTS.md` | §3 layering rules confirm `modules/ai-llm/*` imports only contracts; §6 a new how-to "How to add an AI/LLM vendor module" with a pointer to openrouter; §10 glossary gains "gateway module" |
| `CLAUDE.md` | "Architecture in one paragraph" gains a sentence noting the first AI/LLM vendor module (`module-ai-llm-openrouter`) and its demo (`cv-extract-blueprint`) |
| `vision.md` | Not touched (internal infra, not market-facing) |
| `.dependency-cruiser.cjs` | Verified only; no edit expected (existing patterns cover `modules/ai-llm/openrouter/**` and `demo/cv-extract-blueprint/**`) |
| `pnpm-workspace.yaml` | Verified only; existing `modules/*/*` glob covers the new module |

## 9. Backlog

Items observed during this brainstorm that this PR explicitly does not address. Each is a future spec or a v2 contract concern.

1. **Streaming** — `StreamComplete` server-streaming RPC + per-chunk events. Separate v2 spec.
2. **Cost tracking as first-class** — `cost_micro_usd` on `TokenUsage`, or a new field on `Completion`. Currently routes via `vendor_raw`.
3. **Per-model capabilities** — gateway modules expose the UNION; specific models may not support tools/reasoning/file. Solution: capability-discovery RPC, or a catalog convention.
4. **Fallback chain** — OR-native `models: [primary, fallback...]`. First-class in contract or vendor-only?
5. **Provider preferences** — OR-only `provider: { order, allow_fallbacks }`. First-class or vendor_raw forever?
6. **File ingress disambiguation** — when `vendor_file_id` vs `url` vs `base64_data`. Tied to the upcoming S3-module brainstorm.
7. **Structural validation of `response_format`** — `AI_LLM_STRUCTURAL_INVALID_RESPONSE_FORMAT` + pipeline check.
8. **Formal JSON schema for `module.json#capabilities`** — if the AI/LLM category does not yet have one, add `module.schema.json`.
9. **Audio modality** — declared `false` in v1; add when a demo requires it.
10. **Async batch via OpenAI Batch API** — separate sub-class module `module-ai-llm-openai-batch` implementing `SubmitJob/GetJob/CancelJob/ListJobs`.
11. **Graceful error path in cv-extract demo** — separate `fail` transition + `error_code` column + UI rendering of errors.
12. **Async polling flow for cv-extract** — for cases where proxy timeouts cut synchronous POST. Resumes a `pending → complete | failed` state machine.
13. **GetCompletion across longer windows** — once we have a real persistence story, the 24h limit can grow.
14. **OR analytics best practices** — `HTTP-Referer` and `X-Title` headers configurable per request, not per process.

## 10. Deliverables

- **D1.** Contract clarifications (text + two new drift-pin tests). No `.proto` changes.
- **D2.** `modules/ai-llm/openrouter/` — handler, mappers, SQLite idempotency store, error-mapper, manifest, Dockerfile, unit + integration tests, README.
- **D3.** `demo/cv-extract-blueprint/` — entity, projection, two graphs, bindings, minimal UI, README, fixture PDF.
- **D4.** Documentation touches per §8.
- **D5.** Backlog appendix in this spec (§9), referenced from the implementation plan.

The implementation plan, written next from this spec, will sequence these deliverables. A reasonable order: D1 first (cheapest, unblocks everything else by pinning the contract semantics), then D2 (the module proper), then D3 (the demo on top of D2), with D4 landing alongside D2 and D3 as those land. D5 lives in this spec only.
