# AI/LLM category — module contributor entry point

This directory hosts vendor implementations of the AI/LLM canonical contract `@rntme/contracts-ai-llm-v1`. Each vendor lives at `modules/ai-llm/<vendor>/` and ships:

- A handler implementation against the `AiLlmModule` gRPC service.
- An idempotency dedup-store (Redis / in-memory / Postgres — chosen by the vendor module; ≥24h TTL).
- A webhook receiver that verifies signatures (e.g. OpenAI Standard Webhooks for Batch API), dedupes, and emits canonical CloudEvents.
- A `module.json` manifest declaring `capabilities[]` (vendors, rpcs, events, input_modalities, reasoning_visibility_supported, thread, async_job_types, agent_execution_mode).
- Conformance scenarios passing under both mock-vendor and live-sandbox modes.

The shared conformance suite lives at `modules/ai-llm/conformance/` and is consumed by every vendor module via `pnpm test:conformance:mock` and `pnpm test:conformance:live` (when the framework lands).

## Vendors landed here

None yet. The first vendor (likely `module-ai-llm-openai` or `module-ai-llm-anthropic`) is brainstormed and planned separately after this conformance skeleton merges.

## Capability decision tree (for module authors)

When you scaffold a new AI/LLM vendor module, fill out `module.json#capabilities[]` based on what the vendor supports natively:

| Capability | Decision |
|---|---|
| `vendors[]` | Single SaaS module: 1 entry. Multi-provider gateway: list every upstream you route to. |
| `rpcs[]` | Subset of the 14 canonical RPCs. Unclaimed RPCs return `UNIMPLEMENTED` (anti-conformance enforces this). |
| `events[]` | Subset of the 16 canonical events. Only emit events you actually publish. |
| `input_modalities[]` | Subset of `["text", "image", "audio", "file"]`. Vendor without audio = `["text", "image", "file"]`. |
| `reasoning_visibility_supported[]` | Subset of `["hidden", "summary", "full"]`. Anthropic = `["hidden", "full"]`. OpenAI = `["hidden", "summary"]`. |
| `thread` | `true` only if vendor has native stateful conversation API (OpenAI Responses+Conversations, Bedrock Agents). Otherwise `false`. |
| `async_job_types[]` | Subset of declared `AsyncJobType` canonical values. v1 ships only `["BATCH_COMPLETION"]`. |
| `agent_execution_mode` | `"delegated"` if vendor SaaS owns the agent loop (OpenAI Agents API, Bedrock Agents). `"local"` if you host an in-process agent runtime (LangGraph, CrewAI — v2+). `"none"` for plain LLM wrappers. |

## Specs

- `docs/superpowers/specs/done/2026-04-26-ai-llm-canonical-contract-design.md` — canonical contract design.
- `docs/superpowers/specs/2026-04-26-modules-monorepo-structure-design.md` — module pattern, capability UNION conformance.

## Where to look first

- `modules/ai-llm/conformance/src/scenarios/` — full list of scenarios per RPC (one file per canonical RPC).
- `packages/contracts/ai-llm/v1/proto/ai_llm.proto` — the contract you implement.
- `packages/contracts/ai-llm/v1/error-codes.json` — error codes you map vendor errors to.
