# `@rntme/ai-llm-openrouter` — OpenRouter vendor module for AI/LLM v1

Multi-provider LLM gateway module implementing `Complete` and `GetCompletion` against the canonical AI/LLM contract `@rntme/contracts-ai-llm-v1`. Routes to OpenAI, Anthropic, Google, Meta, Mistral, DeepSeek, and others through a single OpenRouter API key.

## File map

```
modules/ai-llm/openrouter/
├── module.json
├── Dockerfile
├── package.json
├── src/
│   ├── bin/server.ts              entry point — reads OPENROUTER_API_KEY etc.
│   ├── server.ts                  gRPC server factory (14 RPCs)
│   ├── handler.ts                 createOpenRouterModule({ apiKey, store, bus, ... })
│   ├── openrouter-client.ts       HTTP wrapper around /chat/completions
│   ├── completion-mapper.ts       proto Completion ↔ OR JSON
│   ├── idempotency-store.ts       SQLite + in-memory IdempotencyStore
│   ├── error-mapper.ts            HTTP/OR error → AI_LLM_VENDOR_*
│   ├── errors.ts                  AiLlmOpenRouterError
│   └── index.ts                   re-exports
└── test/
    ├── unit/                      mappers, error-mapper, idempotency-store, errors, client
    └── integration/               handler with mocked OR fetch
```

## Quick start

Local in-process use (e.g., from a runtime that wires the module via gRPC over a local socket):

```bash
OPENROUTER_API_KEY=sk-or-... \
OPENROUTER_IDEMPOTENCY_MODE=memory \
PORT=50051 \
node modules/ai-llm/openrouter/dist/bin/server.js
```

The server logs `ai_llm_openrouter_grpc_listening` on startup and `ai_llm_openrouter_event` per emitted CloudEvent.

## API

### Capabilities (manifest summary)

`vendors: ["openrouter"]`. Single routing-prefix element. Models are addressed canonically as `openrouter/<upstream>/<model>` (e.g. `openrouter/openai/gpt-4o`). The module strips its `openrouter/` prefix before forwarding to OR.

`gateway_upstreams[]` is an informational subset of OR's actual catalog: `["openai", "anthropic", "google", "meta", "mistralai", "deepseek", "x-ai", "qwen"]`.

`rpcs: ["Complete", "GetCompletion"]`. The other 12 canonical RPCs return `UNIMPLEMENTED`.

`input_modalities: ["text", "image", "file"]`. Audio is not declared in v1; add when a demo requires it.

### `Complete`

Standard unary completion. Request includes `model`, `messages`, optional `sampling`/`tools`/`reasoning_effort`. The module:
1. Checks `idempotency_key` against the SQLite store and returns the cached `Completion` if present (no second OR call).
2. Emits `CompletionStarted` CloudEvent.
3. Calls `POST {OPENROUTER_BASE_URL}/chat/completions` with mapped body and `Authorization: Bearer ${OPENROUTER_API_KEY}`.
4. On 2xx → maps to `Completion` proto, stores in idempotency store, emits `CompletionFinished`, returns.
5. On non-2xx → maps to `AI_LLM_VENDOR_*`, emits `CompletionFailed`, throws.

### `GetCompletion`

Reads from the idempotency store keyed by `canonical_id` (the original request's `idempotency_key`). Within the 24h TTL window: returns the cached `Completion`. Outside the window: `AI_LLM_REFERENCES_COMPLETION_NOT_FOUND`.

### Other RPCs

`CreateThread`, `GetThread`, `DeleteThread`, `AddMessage`, `ListThreadItems`, `RunThread`, `GetThreadRun`, `CancelThreadRun`, `SubmitJob`, `GetJob`, `CancelJob`, `ListJobs` — all return gRPC `UNIMPLEMENTED`.

## Invariants & gotchas

- **`OPENROUTER_API_KEY` is fail-fast at boot.** No default, no fallback. The module crashes on startup if missing.
- **Idempotency persistence.** Default mode is SQLite at `/data/idempotency.sqlite`. The container declares `VOLUME /data`; mount a volume for cross-redeploy persistence. In-memory mode (`OPENROUTER_IDEMPOTENCY_MODE=memory`) is for development only; restart loses everything and re-issues OR calls.
- **No retries.** The module does not retry on 5xx or rate-limit errors. The runtime/policy layer is responsible for retry semantics. (This matches the contract's `policy.retry` on `call` graph nodes.)
- **`vendor_raw.cost_usd`.** OpenRouter returns `usage.cost` in dollars; this lands in `Completion.vendor_raw.cost_usd`. First-class cost tracking is a backlog item on the contract side.
- **PDF/image inputs are inline.** Contract supports `vendor_file_id`, but OR has no Files-API equivalent; we reject FILE blocks with neither `url` nor `base64_data`. URL-based file inputs will become useful when an S3-style file storage module lands (separate brainstorm).

## Out of scope

- Streaming. Contract v1 is unary-only; `StreamComplete` is a v2 backlog item.
- Threads / batch. OR does not natively offer either; future sub-class module `module-ai-llm-openai-batch` could expose `SubmitJob/...` against OpenAI's Batch API.
- Provisioner. There is no external state to reconcile; only an API key, issued manually.
- Webhook receiver. OR has no webhooks for completions.
- Per-model capability resolution. The manifest declares the gateway UNION; specific models may not support tools/reasoning/file/image.

## Where to look first

- `src/handler.ts` — `Complete` and `GetCompletion` orchestration.
- `src/completion-mapper.ts` — bidirectional proto ↔ OR JSON.
- `src/error-mapper.ts` — explicit table of HTTP/OR-error → `AI_LLM_VENDOR_*`.
- `test/integration/handler.test.ts` — end-to-end behaviour against mocked OR.

## Specs

- `docs/superpowers/specs/2026-05-06-ai-llm-openrouter-module-design.md` — design.
- `docs/superpowers/specs/done/2026-04-26-ai-llm-canonical-contract-design.md` — canonical contract.
