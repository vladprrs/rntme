# AI/LLM canonical contract v1 — design

**Status:** design
**Author:** brainstorm 2026-04-26
**Related:**
- `docs/superpowers/specs/2026-04-26-modules-monorepo-structure-design.md` — directory layout `packages/contracts/<category>/v<n>/`, capability-based UNION conformance, governance rule for canonical growth (≥2 vendors OR archetypal), `module.json` schema. This spec produces the second concrete category contract under that umbrella (Identity is the first).
- `docs/superpowers/specs/2026-04-26-identity-canonical-contract-design.md` — sibling spec by the same template; defines `_common/v1/` shared primitives that this spec reuses unchanged. This spec follows the same section pattern.
- `docs/superpowers/specs/2026-04-19-platform-modules-integration-design.md` — module pattern (wrapper around vendor SDK, gRPC surface, webhook receiver, no choreography). This spec's contract is implemented by AI/LLM wrappers, not gateways.
- `docs/superpowers/specs/done/2026-04-17-cloudevents-envelope-design.md` — CloudEvents 1.0 envelope; this spec defines the `data` payloads and `type` short-names for the AI/LLM category.
- `.tmp/rntme_ai_llm_spec.agent.final.md` — vendor research v2.0 (3736 lines) used as input. Local-only document, not committed.
- `rntme_orchestration_only`, `project_pre_stable_stage`, `rntme_topic_no_version_suffix` memories.

**Implementation locations:**
- Canonical AI/LLM contract — new `packages/contracts/ai-llm/v1/` (workspace package `@rntme/contracts-ai-llm-v1`).
- Category README + conformance suite skeleton — new `modules/ai-llm/README.md` and `modules/ai-llm/conformance/` (workspace package `@rntme/conformance-ai-llm`).
- Implementation plans for this spec — `docs/superpowers/plans/done/ai-llm-canonical-contract/`.

## 1. Problem

The modules-monorepo spec defined where category contracts live and how modules declare capability subsets, but explicitly deferred category content. Identity v1 landed the first concrete contract; AI/LLM is the natural next category — it underpins every AI-augmented product and has the most complex vendor convergence to canonicalise.

Without a canonical AI/LLM contract, every vendor module — `module-ai-llm-openai`, `module-ai-llm-anthropic`, `module-ai-llm-bedrock` — would invent its own gRPC service shape, its own event short-names, its own multimodal content shape, its own tool-call format. Domain blueprints would then bind to vendor-shaped contracts, defeating the categorical-abstraction goal.

A second, structural problem: the AI/LLM landscape in 2025–2026 is mid-convergence. Providers are aligning on four core primitives (Agent, Tool, Memory, Orchestration), MCP is becoming the de-facto tool format, and LiteLLM-style `<vendor>/<model>` addressing is ubiquitous. We canonicalise what has converged, defer what has not, and design v1 so that converging primitives (streaming, agents, vector) can be added in v1.minor without breaking changes.

## 2. Goal

Define the v1 canonical AI/LLM contract for the **language-model-and-conversation** subset of the AI category: protobuf service, message types, status enums, event payloads, error codes, and the conformance-scenarios skeleton. Out of this spec, an LLM agent generating a vendor-specific AI/LLM module from `module-skeleton` should know exactly which gRPC surface to implement, which capabilities to declare, which events to emit, and which conformance scenarios to pass.

**In scope:**
- New `packages/contracts/ai-llm/v1/` package: `ai_llm.proto` (service + entities + enums), `ai_llm-events.proto` (16 event payloads), `error-codes.json`, README.
- Three AI/LLM aggregates: `Completion` (stateless), `AssistantThread` (delegated stateful, capability-flagged), `AsyncJob` (generic async-job state machine, in v1 carrying `BATCH_COMPLETION` only).
- Helper messages: `ContentBlock` (oneof of 7 types), `Message`, `ThreadItem`, `ThreadRun`, `ToolDefinition`, `ToolCall`, `ToolResult`, `TokenUsage`, `SamplingParams`, `ReasoningInfo`, `BatchCompletionPayload`, `BatchCompletionItem`.
- Fourteen canonical RPCs covering Completion, AssistantThread, and AsyncJob.
- Sixteen canonical CloudEvents covering the lifecycle of all three aggregates (boundary events only — no per-chunk events in v1).
- Conformance-scenarios skeleton at `modules/ai-llm/conformance/` with one scenario file per RPC.
- Capability-declaration extensions to `module.json#capabilities`: `vendors[]`, `input_modalities[]`, `reasoning_visibility_supported[]`, `thread`, `async_job_types[]`, `agent_execution_mode`.
- Governance reaffirmation: how AI/LLM v1 grows.

**Explicitly out of scope:**
- Streaming RPCs (`CompleteStream`, `RunThreadStream`) and per-chunk events (`completion.chunk_generated`) — added in v1.minor when first blueprint requires typing-animation UI. Q3 decision.
- Embedding aggregate, Embedding RPCs, Embedding events — separate `ai-embedding/v1` category.
- Vector aggregate (VectorIndex, VectorRecord), vector RPCs and events — separate `ai-vector/v1` category.
- KnowledgeBase aggregate (managed RAG: OpenAI Vector Store, Bedrock KB) — separate `ai-knowledge/v1` category.
- Agent aggregate (Agent config, AgentRun, agent-loop execution) — separate `ai-agent/v1` category. The contract does reserve the `agent_execution_mode` capability flag (`"delegated"|"local"|"none"`) so that future Agent v1 can be added non-breaking.
- Tool-registry RPCs (`RegisterTool`, `ListTools`, `ExecuteToolCall`) — `ToolDefinition`/`ToolCall` remain as field types inside Completion and Thread, but no separate aggregate.
- Safety/Guardrails (`SafetyGuardrail` aggregate, `safety_settings` first-class field) — separate `ai-safety/v1` category. Vendor-specific safety rides through `vendor_raw`.
- Fine-tuning, model lifecycle, eval — separate categories.
- Realtime API (bidirectional audio streaming) — separate brainstorm post-v1.
- First vendor module skeleton + first vendor implementation (`module-ai-llm-openai` or `module-ai-llm-anthropic`) — subsequent brainstorm.
- Multi-provider gateway implementation (`module-ai-llm-litellm-gateway`) — subsequent brainstorm; the contract is designed to support it (vendor-prefixed model addressing).

## 3. Decisions matrix

| # | Question | Decision |
|---|---|---|
| Q1 | Scope of this spec | **3 aggregates only:** Completion + AssistantThread + AsyncJob. Embedding, Vector, KnowledgeBase, Agent, Tool-registry, SafetyGuardrail — separate future categories. |
| Q2 | Module architectural model | **Wrapper (thin or thick)** around one SaaS LLM provider OR one multi-provider gateway. Local agent frameworks (LangGraph, CrewAI) are NOT modules in v1; the contract is designed to support them in v2+ via `agent_execution_mode = "local"` capability. Choreography stays forbidden per `rntme_orchestration_only`. |
| Q3 | Streaming model | **Boundary events only.** No `CompleteStream`/`RunThreadStream` RPC in v1; no per-chunk CloudEvents. `Complete` and `RunThread` are unary (block until vendor returns full response). Events emitted at state transitions only (`started` / `finished` / `failed` / `requires_action`). gRPC streaming is a non-breaking minor addition later. |
| Q4 | Multimodal scope | **Full input multimodal:** text + image + audio + file + tool_use + tool_result + thinking. No Realtime API (bidirectional streaming) in v1. Output is text by default; audio output is opt-in per vendor capability. |
| Q5 | AssistantThread | **Delegated-only via capability.** Modules with native stateful conversation API (OpenAI Responses+Conversations, Bedrock Agents) declare `thread: true`. Other modules return `UNIMPLEMENTED` for thread RPCs. No emulation in module storage; no fallback to domain emulation. |
| Q6 | Tool definitions | **MCP-shape:** `Tool { string name; string description; google.protobuf.Struct input_schema; bool strict; }`. `ToolCall.arguments` is `google.protobuf.Struct` (parsed JSON object), not a string — the module parses vendor-stringified arguments before publishing. |
| Q7 | AsyncJob types | **Generic AsyncJob aggregate;** in v1 the only declared `AsyncJobType` is `BATCH_COMPLETION`. `SubmitJobRequest.body` is a `oneof` with one variant in v1; future variants (BATCH_EMBEDDING, FINE_TUNING, FILE_PROCESSING, EVAL) slot in non-breaking. |
| Q8 | Naming | `ai-llm`. Path `packages/contracts/ai-llm/v1/`, workspace `@rntme/contracts-ai-llm-v1`, proto package `rntme.contracts.ai_llm.v1`, CloudEvents type `rntme.ai_llm.v1.<EventShortName>`, Kafka topics `rntme.ai_llm.{completion,thread,async_job}` (no version suffix per CLAUDE.md), error codes `AI_LLM_<LAYER>_<KIND>`, module names `module-ai-llm-<vendor>`. |
| Q9 | Reasoning tokens | **Full surface:** `ReasoningEffort` enum (UNSPECIFIED/MINIMAL/LOW/MEDIUM/HIGH/MAX), `ReasoningVisibility` enum (UNSPECIFIED/HIDDEN/SUMMARY/FULL), `thinking` ContentBlock for full reasoning content, `ReasoningInfo.summary` for vendor summary, `TokenUsage.reasoning_tokens` separate counter, `capabilities.reasoning_visibility_supported[]` subset declaration. |
| Q10 | Model addressing | **Vendor-prefixed `<vendor>/<model>`** (LiteLLM convention). SaaS module validates prefix matches `module.json#capabilities.vendors[]`; mismatch yields `AI_LLM_STRUCTURAL_VENDOR_MISMATCH`. Gateway module uses prefix for upstream routing. `Vendor` is open-string in v1; canonical enum may come later as cross-category shared utility. |

## 4. Layout

This spec adds two workspace packages. `_common/v1/` is reused unchanged from Identity.

```
packages/contracts/
├── _common/v1/                                  # REUSED, no changes
└── ai-llm/v1/                                   # NEW workspace package @rntme/contracts-ai-llm-v1
    ├── proto/
    │   ├── ai_llm.proto                          # service AiLlmModule + entities + enums
    │   └── ai_llm-events.proto                    # 16 event payloads
    ├── src/                                      # generated TS bindings
    ├── error-codes.json                           # AI_LLM_<LAYER>_<KIND> set
    ├── package.json
    └── README.md

modules/ai-llm/                                    # NEW (category root only — vendor dirs are next brainstorm)
├── README.md                                      # category-doc, contributor entry point
└── conformance/                                   # NEW workspace package @rntme/conformance-ai-llm
    ├── src/
    │   ├── suite.ts                                # exports CategoryConformanceSuite
    │   ├── fixtures/
    │   │   ├── messages.ts
    │   │   ├── content-blocks.ts
    │   │   ├── tools.ts
    │   │   ├── threads.ts
    │   │   ├── batch-items.ts
    │   │   └── media/
    │   │       ├── sample.png                     # multimodal image fixture (≤100KB)
    │   │       ├── sample.mp3                     # multimodal audio fixture (≤100KB)
    │   │       └── sample.pdf                     # multimodal file fixture (≤100KB)
    │   └── scenarios/                              # one file per canonical RPC (14 stubs in v1)
    │       ├── Complete.scenarios.ts
    │       ├── GetCompletion.scenarios.ts
    │       ├── CreateThread.scenarios.ts
    │       ├── GetThread.scenarios.ts
    │       ├── DeleteThread.scenarios.ts
    │       ├── AddMessage.scenarios.ts
    │       ├── ListThreadItems.scenarios.ts
    │       ├── RunThread.scenarios.ts
    │       ├── GetThreadRun.scenarios.ts
    │       ├── CancelThreadRun.scenarios.ts
    │       ├── SubmitJob.scenarios.ts
    │       ├── GetJob.scenarios.ts
    │       ├── CancelJob.scenarios.ts
    │       └── ListJobs.scenarios.ts
    ├── package.json
    └── README.md
```

`modules/ai-llm/` ships in this spec without any vendor directory — only the category README and conformance package land. The first vendor (`modules/ai-llm/<vendor>/`) is a subsequent brainstorm.

## 5. Status enums

All AI/LLM status enums follow the rntme convention: `<TYPE>_UNSPECIFIED = 0` (proto3 zero), `<TYPE>_VENDOR_SPECIFIC = 100` (escape hatch for vendor-specific values without canonical equivalent). The 1–99 range is reserved for canonical values; 100+ for vendor extensions.

```protobuf
syntax = "proto3";
package rntme.contracts.ai_llm.v1;

import "google/protobuf/timestamp.proto";
import "google/protobuf/duration.proto";
import "google/protobuf/struct.proto";
import "rntme/contracts/common/v1/common.proto";

enum FinishReason {
  FINISH_REASON_UNSPECIFIED = 0;
  FINISH_REASON_STOP = 1;
  FINISH_REASON_LENGTH = 2;
  FINISH_REASON_TOOL_CALLS = 3;
  FINISH_REASON_CONTENT_FILTER = 4;
  FINISH_REASON_ERROR = 5;
  FINISH_REASON_VENDOR_SPECIFIC = 100;
}

enum ContentBlockType {
  CONTENT_BLOCK_TYPE_UNSPECIFIED = 0;
  CONTENT_BLOCK_TYPE_TEXT = 1;
  CONTENT_BLOCK_TYPE_IMAGE = 2;
  CONTENT_BLOCK_TYPE_AUDIO = 3;
  CONTENT_BLOCK_TYPE_FILE = 4;
  CONTENT_BLOCK_TYPE_TOOL_USE = 5;
  CONTENT_BLOCK_TYPE_TOOL_RESULT = 6;
  CONTENT_BLOCK_TYPE_THINKING = 7;
  CONTENT_BLOCK_TYPE_VENDOR_SPECIFIC = 100;
}

enum ReasoningEffort {
  REASONING_EFFORT_UNSPECIFIED = 0;
  REASONING_EFFORT_MINIMAL = 1;
  REASONING_EFFORT_LOW = 2;
  REASONING_EFFORT_MEDIUM = 3;
  REASONING_EFFORT_HIGH = 4;
  REASONING_EFFORT_MAX = 5;
}

enum ReasoningVisibility {
  REASONING_VISIBILITY_UNSPECIFIED = 0;
  REASONING_VISIBILITY_HIDDEN = 1;
  REASONING_VISIBILITY_SUMMARY = 2;
  REASONING_VISIBILITY_FULL = 3;
}

enum ThreadStatus {
  THREAD_STATUS_UNSPECIFIED = 0;
  THREAD_STATUS_ACTIVE = 1;
  THREAD_STATUS_ARCHIVED = 2;
  THREAD_STATUS_DELETED = 3;
  THREAD_STATUS_VENDOR_SPECIFIC = 100;
}

enum ThreadRunStatus {
  THREAD_RUN_STATUS_UNSPECIFIED = 0;
  THREAD_RUN_STATUS_QUEUED = 1;
  THREAD_RUN_STATUS_IN_PROGRESS = 2;
  THREAD_RUN_STATUS_REQUIRES_ACTION = 3;
  THREAD_RUN_STATUS_COMPLETED = 4;
  THREAD_RUN_STATUS_FAILED = 5;
  THREAD_RUN_STATUS_CANCELLED = 6;
  THREAD_RUN_STATUS_EXPIRED = 7;
  THREAD_RUN_STATUS_VENDOR_SPECIFIC = 100;
}

enum AsyncJobType {
  ASYNC_JOB_TYPE_UNSPECIFIED = 0;
  ASYNC_JOB_TYPE_BATCH_COMPLETION = 1;
  ASYNC_JOB_TYPE_VENDOR_SPECIFIC = 100;
}

enum AsyncJobStatus {
  ASYNC_JOB_STATUS_UNSPECIFIED = 0;
  ASYNC_JOB_STATUS_VALIDATING = 1;
  ASYNC_JOB_STATUS_QUEUED = 2;
  ASYNC_JOB_STATUS_RUNNING = 3;
  ASYNC_JOB_STATUS_FINALIZING = 4;
  ASYNC_JOB_STATUS_COMPLETED = 5;
  ASYNC_JOB_STATUS_FAILED = 6;
  ASYNC_JOB_STATUS_CANCELLED = 7;
  ASYNC_JOB_STATUS_EXPIRED = 8;
  ASYNC_JOB_STATUS_VENDOR_SPECIFIC = 100;
}
```

## 6. Helper types

```protobuf
// Token accounting. Reasoning separated from output for billing fidelity.
message TokenUsage {
  int32 input_tokens = 1;
  int32 output_tokens = 2;
  int32 reasoning_tokens = 3;        // 0 for non-reasoning models
  int32 cached_tokens = 4;            // prompt caching (Anthropic, OpenAI)
  int32 total_tokens = 5;
}

// Sampling parameters; all optional. Vendor applies defaults on UNSPECIFIED.
message SamplingParams {
  optional float temperature = 1;
  optional float top_p = 2;
  optional int32 top_k = 3;
  optional int32 max_tokens = 4;
  optional float frequency_penalty = 5;
  optional float presence_penalty = 6;
  repeated string stop_sequences = 7;
  optional int64 seed = 8;
  optional string response_format = 9;          // "text" | "json_object" | "json_schema"
  google.protobuf.Struct response_schema = 10;  // for json_schema mode
}

// Reasoning request flags + summary in response.
message ReasoningInfo {
  ReasoningEffort effort = 1;
  ReasoningVisibility visibility = 2;
  string summary = 3;                          // when visibility=SUMMARY
  // full reasoning content arrives as ContentBlock type=THINKING
}

// MCP-shape tool definition.
message ToolDefinition {
  string name = 1;
  string description = 2;
  google.protobuf.Struct input_schema = 3;     // JSON Schema
  bool strict = 4;                              // OpenAI strict-mode (full schema validation)
}

// Tool call in response. arguments is parsed object, not string.
message ToolCall {
  string id = 1;                               // vendor-assigned, used to match tool_result
  string name = 2;
  google.protobuf.Struct arguments = 3;
}

// Tool result inside ContentBlock.tool_result.
message ToolResult {
  string tool_call_id = 1;
  google.protobuf.Struct output = 2;
  bool is_error = 3;
}

// Input/output message form. Reused in CreateCompletionRequest.messages and AddMessage.
message Message {
  string role = 1;                              // "system"|"user"|"assistant"|"tool"
  repeated ContentBlock content = 2;
}
```

## 7. ContentBlock (oneof of 7 variants)

```protobuf
message ContentBlock {
  ContentBlockType type = 1;
  oneof body {
    TextBlock text = 2;
    ImageBlock image = 3;
    AudioBlock audio = 4;
    FileBlock file = 5;
    ToolCall tool_use = 6;
    ToolResult tool_result = 7;
    ThinkingBlock thinking = 8;
  }
}

message TextBlock { string text = 1; }

message ImageBlock {
  oneof source {
    string url = 1;
    bytes base64_data = 2;
  }
  string media_type = 3;                       // "image/jpeg", "image/png", ...
}

message AudioBlock {
  oneof source {
    string url = 1;
    bytes base64_data = 2;
  }
  string media_type = 3;                       // "audio/mpeg", "audio/wav", ...
  string transcript = 4;                       // optional hint to the model
}

message FileBlock {
  oneof source {
    string url = 1;
    bytes base64_data = 2;
    string vendor_file_id = 3;                  // vendor-managed upload reference
  }
  string media_type = 4;
  string filename = 5;
}

message ThinkingBlock {
  string text = 1;                             // raw reasoning content (visibility=FULL)
  bool redacted = 2;                           // true when vendor returned encrypted thinking (Anthropic)
}
```

## 8. Aggregates

```protobuf
// ───── 1. Completion (stateless) ─────
message Completion {
  rntme.contracts.common.v1.CanonicalRef ref = 1;

  string model = 2;                              // canonical "<vendor>/<model>"
  repeated ContentBlock content = 3;             // assistant response, may be multi-block
  FinishReason finish_reason = 4;
  TokenUsage usage = 5;
  ReasoningInfo reasoning = 6;                    // null when model is not reasoning
  repeated ToolCall tool_calls = 7;               // populated when finish_reason=TOOL_CALLS

  google.protobuf.Timestamp started_at = 8;
  google.protobuf.Timestamp finished_at = 9;
  google.protobuf.Duration time_to_first_token = 10;  // null when no streaming

  google.protobuf.Struct vendor_raw = 11;
}

// ───── 2. AssistantThread + ThreadItem + ThreadRun ─────
message AssistantThread {
  rntme.contracts.common.v1.CanonicalRef ref = 1;
  string title = 2;
  ThreadStatus status = 3;
  rntme.contracts.common.v1.Metadata metadata = 4;
  google.protobuf.Timestamp created_at = 5;
  google.protobuf.Timestamp updated_at = 6;
  google.protobuf.Struct vendor_raw = 7;
}

message ThreadItem {
  string item_id = 1;
  string thread_id = 2;
  string role = 3;                              // "user"|"assistant"|"system"|"tool"
  repeated ContentBlock content = 4;
  google.protobuf.Timestamp created_at = 5;
  string run_id = 6;                            // populated when item generated during a run
  google.protobuf.Struct vendor_raw = 7;
}

message ThreadRun {
  rntme.contracts.common.v1.CanonicalRef ref = 1;
  string thread_id = 2;
  ThreadRunStatus status = 3;
  string model = 4;                             // canonical "<vendor>/<model>"
  TokenUsage usage = 5;                         // null until COMPLETED/FAILED
  repeated ToolCall required_tool_calls = 6;     // populated when status=REQUIRES_ACTION
  ReasoningInfo reasoning = 7;
  string failure_reason = 8;                     // human-readable, when FAILED
  google.protobuf.Timestamp started_at = 9;
  google.protobuf.Timestamp completed_at = 10;
  google.protobuf.Struct vendor_raw = 11;
}

// ───── 3. AsyncJob ─────
message AsyncJob {
  rntme.contracts.common.v1.CanonicalRef ref = 1;
  AsyncJobType type = 2;
  AsyncJobStatus status = 3;
  int32 progress_percentage = 4;                 // 0–100
  string result_uri = 5;                         // signed URL → JSONL of results
  string error_message = 6;                      // when status=FAILED
  TokenUsage aggregate_usage = 7;                // totals across the batch
  google.protobuf.Timestamp created_at = 8;
  google.protobuf.Timestamp completed_at = 9;
  google.protobuf.Timestamp expires_at = 10;     // when result_uri expires
  google.protobuf.Struct vendor_raw = 11;
}

// Payload for SubmitJob.body oneof.
message BatchCompletionPayload {
  repeated BatchCompletionItem items = 1;
  string completion_window = 2;                  // "24h"|"7d" — vendor-specific window
}

message BatchCompletionItem {
  string custom_id = 1;                          // for matching against result entries
  CreateCompletionRequest request = 2;
}
```

Design notes:

- **`ContentBlock` is shared** between `Completion.content` and `ThreadItem.content`. Multi-block responses (text + tool_use + thinking) are typical for reasoning models with tools.
- **`ThreadRun` is a top-level aggregate**, not a sub-entity, because it carries its own lifecycle, its own events, and its state lives independently of `AssistantThread`.
- **`BatchCompletionItem.request: CreateCompletionRequest`** is a recursive import from §9. Proto allows cyclic imports between messages.
- **`vendor_raw: Struct` on every aggregate**; helper types (`TokenUsage`, `ToolCall`, `ContentBlock`) do not have `vendor_raw` because they are sub-fields, not aggregates.
- **`cached_tokens` separated from `input_tokens`** — critical for billing fidelity when providers offer cache-hit discounts (Anthropic 90%, OpenAI 50%).

## 9. `AiLlmModule` service

Fourteen RPCs across Completion (2), AssistantThread (8), AsyncJob (4).

```protobuf
service AiLlmModule {
  // ─── Completion (stateless) ────────────────────────────
  rpc Complete(CreateCompletionRequest) returns (Completion);
  rpc GetCompletion(GetCompletionRequest) returns (Completion);

  // ─── AssistantThread (capability: thread, delegated) ───
  rpc CreateThread(CreateThreadRequest) returns (AssistantThread);
  rpc GetThread(GetThreadRequest) returns (AssistantThread);
  rpc DeleteThread(DeleteThreadRequest) returns (AssistantThread);
  rpc AddMessage(AddMessageRequest) returns (ThreadItem);
  rpc ListThreadItems(ListThreadItemsRequest) returns (ThreadItemList);
  rpc RunThread(RunThreadRequest) returns (ThreadRun);
  rpc GetThreadRun(GetThreadRunRequest) returns (ThreadRun);
  rpc CancelThreadRun(CancelThreadRunRequest) returns (ThreadRun);

  // ─── AsyncJob (capability: async_job) ──────────────────
  rpc SubmitJob(SubmitJobRequest) returns (AsyncJob);
  rpc GetJob(GetJobRequest) returns (AsyncJob);
  rpc CancelJob(CancelJobRequest) returns (AsyncJob);
  rpc ListJobs(ListJobsRequest) returns (AsyncJobList);
}
```

What was dropped vs the reference research and why:

| Reference research | Decision | Reason |
|---|---|---|
| `CompleteStream` (server-streaming RPC) | drop in v1 | Q3: boundary events only. Non-breaking minor addition later. |
| `RunThreadStream` | drop in v1 | Q3 (same). |
| `ListCompletions` | drop | Completion is ephemeral; state lives in events; consumers project from events, not from canonical query. |
| `UpdateThread` | drop | Title/metadata-only updates are not archetypal; domains can recreate threads. |
| `ListThreads` / `ListThreadRuns` | drop | Derive from events; cross-vendor list APIs are highly fragmented (Anthropic has none). |
| `Embed` / `EmbedBatch` | drop | Embedding is a separate category. |
| `VectorSearch` / `UpsertVector` / `DeleteVectors` / `GetVector` | drop | Vector is a separate category. |
| `CreateVectorIndex` / `DeleteVectorIndex` / `DescribeVectorIndex` / `ListVectorIndexes` | drop | Same. |
| `CreateAgent` / `RunAgent` / `GetAgentRun` / `ExecuteAgentStep` / `RequestHumanInput` | drop in v1 | Agent is a separate future category. |
| `RegisterTool` / `ListTools` / `ExecuteToolCall` | drop | Tool-registry is out of v1; `ToolDefinition`/`ToolCall` remain as embedded types in Completion/Thread. |
| `CreateKnowledgeBase` / `IngestDocument` / `QueryKnowledgeBase` / `DeleteKnowledgeBase` | drop | Separate `ai-knowledge/v1` category. |
| `SubmitToolResults` | drop | Tool results are submitted as `AddMessage(thread_id, ContentBlock{tool_result})` — uniform with the rest of the message flow. |

### 9.1 Request/response samples

```protobuf
message CreateCompletionRequest {
  rntme.contracts.common.v1.CommandContext context = 1;
  string model = 2;                                // "<vendor>/<model>"
  repeated Message messages = 3;
  repeated ToolDefinition tools = 4;
  string tool_choice = 5;                          // "auto"|"required"|"none"|"<tool_name>"
  SamplingParams sampling = 6;
  ReasoningEffort reasoning_effort = 7;
  ReasoningVisibility reasoning_visibility = 8;
  rntme.contracts.common.v1.Metadata metadata = 9;
}

message GetCompletionRequest { string canonical_id = 1; }

message CreateThreadRequest {
  rntme.contracts.common.v1.CommandContext context = 1;
  string title = 2;
  repeated Message initial_messages = 3;
  rntme.contracts.common.v1.Metadata metadata = 4;
}

message GetThreadRequest { string canonical_id = 1; }

message DeleteThreadRequest {
  rntme.contracts.common.v1.CommandContext context = 1;
  string canonical_id = 2;
  bool hard_delete = 3;
}

message AddMessageRequest {
  rntme.contracts.common.v1.CommandContext context = 1;
  string thread_id = 2;
  Message message = 3;
}

message ListThreadItemsRequest {
  rntme.contracts.common.v1.ListRequest base = 1;
  string thread_id = 2;
  string after_item_id = 3;
}

message ThreadItemList {
  repeated ThreadItem items = 1;
  rntme.contracts.common.v1.ListResponseMeta meta = 2;
}

message RunThreadRequest {
  rntme.contracts.common.v1.CommandContext context = 1;
  string thread_id = 2;
  string model = 3;                                // override per-run
  repeated ToolDefinition tools = 4;               // override per-run
  string tool_choice = 5;
  SamplingParams sampling = 6;
  ReasoningEffort reasoning_effort = 7;
  ReasoningVisibility reasoning_visibility = 8;
}

message GetThreadRunRequest {
  string thread_id = 1;
  string run_id = 2;
}

message CancelThreadRunRequest {
  rntme.contracts.common.v1.CommandContext context = 1;
  string thread_id = 2;
  string run_id = 3;
  string reason = 4;                                // "user_action"|"timeout"|"admin"
}

message SubmitJobRequest {
  rntme.contracts.common.v1.CommandContext context = 1;
  oneof body {
    BatchCompletionPayload batch_completion = 2;
    // future: BatchEmbeddingPayload, FineTuningPayload, EvalPayload, FileProcessingPayload
  }
  google.protobuf.Duration ttl = 3;
  rntme.contracts.common.v1.Metadata metadata = 4;
}

message GetJobRequest { string canonical_id = 1; }

message CancelJobRequest {
  rntme.contracts.common.v1.CommandContext context = 1;
  string canonical_id = 2;
}

message ListJobsRequest {
  rntme.contracts.common.v1.ListRequest base = 1;
  AsyncJobType type = 2;                           // optional filter
  AsyncJobStatus status = 3;                        // optional filter
}

message AsyncJobList {
  repeated AsyncJob items = 1;
  rntme.contracts.common.v1.ListResponseMeta meta = 2;
}
```

### 9.2 Conventions and invariants

- **Idempotency required on every Command.** Missing `context.idempotency_key` returns `AI_LLM_STRUCTURAL_MISSING_IDEMPOTENCY_KEY` (gRPC `INVALID_ARGUMENT`). SaaS modules must implement an internal dedup-store with **at least 24h TTL**, since major LLM vendors do not provide native idempotency for completions and replays would double-charge.
- **Tool-result flow for Thread.** Domain receives `ThreadRunRequiresAction` event → executes tool calls in its own logic → calls `AddMessage(thread_id, Message{role:"tool", content:[ContentBlock{tool_result:...}]})` for each call → re-invokes `RunThread(thread_id)` (creates a new run on the same thread). No separate `SubmitToolResults` RPC.
- **`model` field convention.** Always `<vendor>/<model>` (e.g. `"openai/gpt-4o"`, `"anthropic/claude-sonnet-4-5"`, `"google/gemini-2.5-pro"`). SaaS modules validate that the prefix matches `module.json#capabilities.vendors[]`; mismatch yields `AI_LLM_STRUCTURAL_VENDOR_MISMATCH`. Gateway modules use the prefix to route.
- **Reasoning capability.** When the module declares `reasoning_visibility_supported: ["hidden", "summary"]` and the request specifies `REASONING_VISIBILITY_FULL`, it returns `AI_LLM_CONSISTENCY_UNSUPPORTED_REASONING_VISIBILITY`.
- **Multimodal capability.** `module.json#capabilities.input_modalities[]` is a subset of `["text", "image", "audio", "file"]`. ContentBlock with a type outside the declared set yields `AI_LLM_CONSISTENCY_UNSUPPORTED_MODALITY`.
- **Thread capability.** All eight Thread RPCs return `UNIMPLEMENTED` if the module does not declare `thread: true`. Conformance runner enforces this per modules-monorepo §7.3.
- **AsyncJob capability.** All four AsyncJob RPCs gated on `async_job_types[]` non-empty; specific job types gated on the array contents.
- **`Delete*` semantics — soft by default.** `status=*_DELETED` plus `deleted_at`. `hard_delete=true` is opt-in per vendor capability; vendors without hard-delete return `AI_LLM_CONSISTENCY_UNSUPPORTED_HARD_DELETE`.
- **`Cancel*` is best-effort.** Returns the current run/job state. If the operation is already terminal, the module returns the current state — not an error.
- **List ordering.** Items sorted `created_at DESC` by default; `base.sorts[]` overrides. Cursor-based pagination preferred over offset.

## 10. CloudEvents

### 10.1 Conventions

- **Topics (3):** `rntme.ai_llm.completion`, `rntme.ai_llm.thread`, `rntme.ai_llm.async_job`. No `.v1` suffix per CLAUDE.md.
- **CloudEvents `type`:** `rntme.ai_llm.v1.<EventShortName>`.
- **`source`:** module name (e.g. `module-ai-llm-openai`); the contract does not mandate a value.
- **`subject`:** canonical_id of the aggregate (completion_id, thread_id, run_id, job_id).
- **`data`:** protobuf-serialised payload from `ai_llm-events.proto`.
- **Kafka partition key:** `completion_id` for completion topic; `thread_id` for thread topic (ensures all events for one thread land at one consumer in order); `job_id` for async_job topic.

### 10.2 Event matrix (16 events)

| # | EventShortName | Topic | Trigger |
|---|---|---|---|
| **Completion (3)** | | | |
| 1 | `CompletionStarted` | `completion` | Module accepted `Complete`, vendor invoked |
| 2 | `CompletionFinished` | `completion` | Vendor returned successful response (any `finish_reason`, including `TOOL_CALLS`) |
| 3 | `CompletionFailed` | `completion` | Vendor returned error or structural/consistency check failed |
| **Thread (8)** | | | |
| 4 | `ThreadCreated` | `thread` | `CreateThread` succeeded |
| 5 | `ThreadDeleted` | `thread` | `DeleteThread` succeeded (soft or hard) |
| 6 | `ThreadMessageAdded` | `thread` | `AddMessage` succeeded — domain-initiated only, NOT for run-generated items |
| 7 | `ThreadRunStarted` | `thread` | `RunThread` accepted, vendor execution started |
| 8 | `ThreadRunRequiresAction` | `thread` | Run paused with `tool_calls` awaiting submission |
| 9 | `ThreadRunCompleted` | `thread` | Run finished; payload includes all run-generated items |
| 10 | `ThreadRunFailed` | `thread` | Run errored |
| 11 | `ThreadRunCancelled` | `thread` | Run cancelled via `CancelThreadRun` |
| **AsyncJob (5)** | | | |
| 12 | `AsyncJobSubmitted` | `async_job` | `SubmitJob` accepted; vendor batch-id obtained |
| 13 | `AsyncJobStatusChanged` | `async_job` | Any intermediate transition (VALIDATING→QUEUED→RUNNING→FINALIZING). Not emitted for terminal transitions — those have dedicated events. |
| 14 | `AsyncJobCompleted` | `async_job` | Terminal success; `result_uri` ready |
| 15 | `AsyncJobFailed` | `async_job` | Terminal failure (including EXPIRED) |
| 16 | `AsyncJobCancelled` | `async_job` | `CancelJob` accepted and applied |

### 10.3 Payload structures

```protobuf
syntax = "proto3";
package rntme.contracts.ai_llm.v1;

import "google/protobuf/timestamp.proto";
import "rntme/contracts/ai_llm/v1/ai_llm.proto";

// ─── Completion ─────────────────────────────────────────
message CompletionStarted {
  string completion_id = 1;
  string model = 2;
  int32 input_token_estimate = 3;
  google.protobuf.Timestamp started_at = 4;
}

message CompletionFinished {
  Completion completion = 1;
}

message CompletionFailed {
  string completion_id = 1;
  string model = 2;
  string error_code = 3;
  string error_message = 4;
  google.protobuf.Timestamp failed_at = 5;
}

// ─── Thread ─────────────────────────────────────────────
message ThreadCreated {
  AssistantThread thread = 1;
  string creator_user_id = 2;
  int32 initial_message_count = 3;
}

message ThreadDeleted {
  string canonical_id = 1;
  string vendor_id = 2;
  bool hard_delete = 3;
  google.protobuf.Timestamp deleted_at = 4;
}

message ThreadMessageAdded {
  ThreadItem item = 1;
}

message ThreadRunStarted {
  string thread_id = 1;
  string run_id = 2;
  string model = 3;
  google.protobuf.Timestamp started_at = 4;
}

message ThreadRunRequiresAction {
  string thread_id = 1;
  string run_id = 2;
  repeated ToolCall required_tool_calls = 3;
}

message ThreadRunCompleted {
  ThreadRun run = 1;
  repeated ThreadItem new_items = 2;             // all items generated during the run
}

message ThreadRunFailed {
  ThreadRun run = 1;
  string error_code = 2;
  string error_message = 3;
}

message ThreadRunCancelled {
  string thread_id = 1;
  string run_id = 2;
  string reason = 3;
  google.protobuf.Timestamp cancelled_at = 4;
}

// ─── AsyncJob ───────────────────────────────────────────
message AsyncJobSubmitted {
  AsyncJob job = 1;
  AsyncJobType type = 2;
  int32 input_item_count = 3;
}

message AsyncJobStatusChanged {
  string canonical_id = 1;
  AsyncJobType type = 2;
  AsyncJobStatus previous_status = 3;
  AsyncJobStatus new_status = 4;
  int32 progress_percentage = 5;
  google.protobuf.Timestamp transitioned_at = 6;
}

message AsyncJobCompleted {
  AsyncJob job = 1;
}

message AsyncJobFailed {
  AsyncJob job = 1;
  string error_code = 2;
  string error_message = 3;
}

message AsyncJobCancelled {
  AsyncJob job = 1;
  string reason = 2;
  google.protobuf.Timestamp cancelled_at = 3;
}
```

What was dropped vs the reference research:

| Research | Decision | Reason |
|---|---|---|
| `completion.chunk_generated` | drop | Q3: boundary events only. |
| `completion.reasoning.generated` | drop | Reasoning content rides in `CompletionFinished.completion.content` as `thinking` ContentBlock. |
| `completion.tool_calls_required` | folded | Subsumed by `CompletionFinished` with `finish_reason=TOOL_CALLS`. |
| `embedding.batch.completed` / `embedding.batch.failed` | drop | Embedding is out of v1. |
| `vector.*` | drop | Vector is a separate category. |
| `agent.*` | drop | Agent is a separate future category. |
| `kb.*` | drop | KnowledgeBase is a separate category. |
| `thread.run.completed` per-item events | folded | `ThreadRunCompleted.new_items[]` carries all items in one message. |

### 10.4 Capability declaration in `module.json`

Example: `module-ai-llm-openai`.

```json
{
  "name": "module-ai-llm-openai",
  "category": "ai-llm",
  "contract_version": "v1",
  "capabilities": {
    "vendors": ["openai"],
    "rpcs": [
      "Complete", "GetCompletion",
      "CreateThread", "GetThread", "DeleteThread",
      "AddMessage", "ListThreadItems",
      "RunThread", "GetThreadRun", "CancelThreadRun",
      "SubmitJob", "GetJob", "CancelJob", "ListJobs"
    ],
    "events": [
      "CompletionStarted", "CompletionFinished", "CompletionFailed",
      "ThreadCreated", "ThreadDeleted", "ThreadMessageAdded",
      "ThreadRunStarted", "ThreadRunRequiresAction",
      "ThreadRunCompleted", "ThreadRunFailed", "ThreadRunCancelled",
      "AsyncJobSubmitted", "AsyncJobStatusChanged",
      "AsyncJobCompleted", "AsyncJobFailed", "AsyncJobCancelled"
    ],
    "input_modalities": ["text", "image", "audio", "file"],
    "reasoning_visibility_supported": ["hidden", "summary"],
    "thread": true,
    "async_job_types": ["BATCH_COMPLETION"],
    "agent_execution_mode": "none"
  }
}
```

Compare: `module-ai-llm-anthropic` (no Thread, no AsyncJob, full reasoning visibility):

```json
{
  "capabilities": {
    "vendors": ["anthropic"],
    "rpcs": ["Complete", "GetCompletion"],
    "events": ["CompletionStarted", "CompletionFinished", "CompletionFailed"],
    "input_modalities": ["text", "image", "file"],
    "reasoning_visibility_supported": ["hidden", "full"],
    "thread": false,
    "async_job_types": [],
    "agent_execution_mode": "none"
  }
}
```

Compare: `module-ai-llm-litellm-gateway` (multi-vendor, completion-only):

```json
{
  "capabilities": {
    "vendors": ["openai", "anthropic", "google", "bedrock", "azure"],
    "rpcs": ["Complete"],
    "events": ["CompletionStarted", "CompletionFinished", "CompletionFailed"],
    "input_modalities": ["text", "image"],
    "reasoning_visibility_supported": ["hidden"],
    "thread": false,
    "async_job_types": [],
    "agent_execution_mode": "none"
  }
}
```

## 11. Error codes

Per CLAUDE.md `<PKG>_<LAYER>_<KIND>` → `AI_LLM_<LAYER>_<KIND>`.

```json
{
  "structural": [
    "AI_LLM_STRUCTURAL_MISSING_IDEMPOTENCY_KEY",
    "AI_LLM_STRUCTURAL_MISSING_MODEL",
    "AI_LLM_STRUCTURAL_INVALID_MODEL_FORMAT",
    "AI_LLM_STRUCTURAL_VENDOR_MISMATCH",
    "AI_LLM_STRUCTURAL_EMPTY_MESSAGES",
    "AI_LLM_STRUCTURAL_INVALID_TOOL_SCHEMA",
    "AI_LLM_STRUCTURAL_INVALID_CONTENT_BLOCK",
    "AI_LLM_STRUCTURAL_INVALID_MEDIA_REFERENCE",
    "AI_LLM_STRUCTURAL_INVALID_SAMPLING_PARAMS"
  ],
  "references": [
    "AI_LLM_REFERENCES_COMPLETION_NOT_FOUND",
    "AI_LLM_REFERENCES_THREAD_NOT_FOUND",
    "AI_LLM_REFERENCES_THREAD_ITEM_NOT_FOUND",
    "AI_LLM_REFERENCES_THREAD_RUN_NOT_FOUND",
    "AI_LLM_REFERENCES_ASYNC_JOB_NOT_FOUND"
  ],
  "consistency": [
    "AI_LLM_CONSISTENCY_THREAD_DELETED",
    "AI_LLM_CONSISTENCY_RUN_NOT_REQUIRES_ACTION",
    "AI_LLM_CONSISTENCY_RUN_ALREADY_TERMINAL",
    "AI_LLM_CONSISTENCY_TOOL_RESULT_MISMATCH",
    "AI_LLM_CONSISTENCY_UNSUPPORTED_MODALITY",
    "AI_LLM_CONSISTENCY_UNSUPPORTED_REASONING_VISIBILITY",
    "AI_LLM_CONSISTENCY_UNSUPPORTED_HARD_DELETE",
    "AI_LLM_CONSISTENCY_UNSUPPORTED_ASYNC_JOB_TYPE",
    "AI_LLM_CONSISTENCY_UNSUPPORTED_THREAD",
    "AI_LLM_CONSISTENCY_BATCH_TOO_LARGE"
  ],
  "vendor": [
    "AI_LLM_VENDOR_RATE_LIMITED",
    "AI_LLM_VENDOR_UNAVAILABLE",
    "AI_LLM_VENDOR_UNAUTHORIZED",
    "AI_LLM_VENDOR_INVALID_REQUEST",
    "AI_LLM_VENDOR_CONTEXT_WINDOW_EXCEEDED",
    "AI_LLM_VENDOR_CONTENT_FILTERED",
    "AI_LLM_VENDOR_QUOTA_EXCEEDED",
    "AI_LLM_VENDOR_MODEL_DEPRECATED"
  ]
}
```

gRPC status mapping (modules implement this in their adapter, not in the contract package):

| Layer | gRPC `Code` | Notes |
|---|---|---|
| `structural` | `INVALID_ARGUMENT` | Request shape: missing field, malformed `<vendor>/<model>`, empty messages |
| `references` | `NOT_FOUND` | canonical_id does not resolve |
| `consistency` | `FAILED_PRECONDITION` | State-machine violation, capability mismatch |
| `vendor.RATE_LIMITED` | `RESOURCE_EXHAUSTED` | + retry-info trailer (Retry-After from vendor) |
| `vendor.UNAVAILABLE` | `UNAVAILABLE` | Upstream timeout / 5xx |
| `vendor.UNAUTHORIZED` | `PERMISSION_DENIED` | Vendor rejected module credentials |
| `vendor.INVALID_REQUEST` | `INVALID_ARGUMENT` | Vendor returned a 4xx the module did not catch structurally |
| `vendor.CONTEXT_WINDOW_EXCEEDED` | `INVALID_ARGUMENT` | Discriminated separately from INVALID_REQUEST due to high frequency in production and distinct retry/compaction policies |
| `vendor.CONTENT_FILTERED` | `FAILED_PRECONDITION` | Vendor refused to generate (input safety filter) |
| `vendor.QUOTA_EXCEEDED` | `RESOURCE_EXHAUSTED` | Tenant/monthly quota, distinct from per-second RATE_LIMITED |
| `vendor.MODEL_DEPRECATED` | `FAILED_PRECONDITION` | Requested model has been retired |

Design notes:

- **`AI_LLM_VENDOR_CONTENT_FILTERED` ≠ `finish_reason=CONTENT_FILTER`.** The error code is for vendor-rejected inputs (gRPC error). The finish_reason is for completions that started but were terminated by output filters (gRPC success). Adapter chooses based on vendor signal.
- **`AI_LLM_VENDOR_CONTEXT_WINDOW_EXCEEDED`** is split out because it is the most frequent 4xx in production (~60% of OpenAI 400s observed in LiteLLM logs). Domain consumers want immediate detection for compaction strategies.
- **`AI_LLM_VENDOR_QUOTA_EXCEEDED` vs `AI_LLM_VENDOR_RATE_LIMITED`** — split by retry policy: rate-limit retries are seconds-scale; quota retries are useless until reset (hours/days).
- **`AI_LLM_CONSISTENCY_TOOL_RESULT_MISMATCH`** — when `AddMessage` carries a tool_result whose `tool_call_id` is not in the current `requires_action` run. Protects Thread state machine from desync.
- **`AI_LLM_CONSISTENCY_BATCH_TOO_LARGE`** — vendors cap batch size (OpenAI: 50k items / 100MB). Cleaner to catch structurally than propagate vendor 400.
- **`AI_LLM_CONSISTENCY_RUN_NOT_REQUIRES_ACTION`** — `AddMessage` with tool_result attempted while run is COMPLETED/IN_PROGRESS/FAILED instead of REQUIRES_ACTION.
- **`AI_LLM_CONSISTENCY_RUN_ALREADY_TERMINAL`** — info-level; for double-cancellation or retry of a SubmitJob already past terminal.

## 12. Conformance suite

### 12.1 Layout and authorship

`modules/ai-llm/conformance/` is a workspace package `@rntme/conformance-ai-llm`. Per modules-monorepo §7.1 it consumes the shared `@rntme/conformance-framework` (runner, invariants, reporter, generic mock-vendor) and supplies AI/LLM-specific scenarios and fixtures. rntme-team writes both layers; modules-monorepo §7.2 mandates that any PR changing `packages/contracts/ai-llm/v1/` lands matching scenario changes in `modules/ai-llm/conformance/scenarios/` in the same PR.

### 12.2 Per-RPC scenarios

One file per canonical RPC. Fourteen files for v1. Each file exports an array of `Scenario` from `@rntme/conformance-framework`. A scenario consists of:

1. **Pre-condition seed** — what entities must exist at the vendor before the scenario runs. The generic mock-vendor receives this seed; live mode pre-creates via the vendor's own API.
2. **Capability gating** — `requires: { input_modalities: ["audio"] }` etc. — scenarios skip on modules that don't declare the capability.
3. **Action** — a single canonical RPC call, OR for Thread tool-cycle, a `steps[]` array of multiple RPCs with cross-step substitution (`$1.canonical_id`).
4. **Assertions**, in this order:
   - response shape matches canonical proto;
   - replay with the same `idempotency_key` returns the same logical result without duplicate event emission;
   - negative branches return the expected error code from `error-codes.json`;
   - for command RPCs, the expected CloudEvent `type` is published on the matching topic within a 5-second (or longer for long-running ops) window;
   - for Thread/Run lifecycle, expected event sequence emitted in order.

### 12.3 Anti-conformance

Per modules-monorepo §7.3, the runner unconditionally checks that any RPC not declared in `module.json#capabilities.rpcs[]` returns gRPC `UNIMPLEMENTED`. Random domain errors fail anti-conformance. This is the only structural enforcement; capability-claim coverage itself is left to the blueprint validator (modules-monorepo §6.2).

### 12.4 Capability-coverage report

Per modules-monorepo §7.4, the runner emits a report shaped like:

```
ai-llm / openai            (claims 14 / 14 canonical RPCs)
  Complete                                     ✓
  GetCompletion                                ✓
  CreateThread                                 ✓
  ...
  capabilities.input_modalities                [text, image, audio, file]   (4 / 4 canonical)
  capabilities.reasoning_visibility            [hidden, summary]              (2 / 3 canonical)
  capabilities.async_job_types                 [BATCH_COMPLETION]              (1 / 1 in v1)

ai-llm / anthropic         (claims 2 / 14 canonical RPCs)
  Complete                                     ✓
  GetCompletion                                ✓
  CreateThread                                 unsupported (declared)
  RunThread                                    unsupported (declared)
  ...
```

This is the artefact a domain-blueprint author or LLM agent reads when picking a vendor for the AI/LLM category.

### 12.5 Mock-vendor

Generic mock-vendor lives in `@rntme/conformance-framework` (closes modules-monorepo OQ4 in favour of generic, set by Identity v1 spec §9.5). AI/LLM-specific behaviour is supplied via fixtures and deterministic stub responses:

- `Complete` with `messages: ["What is 2+2?"]` returns a fixed Completion with `content: [{ text: "4" }]`. Conformance checks shape, not content.
- Tool calling: mock detects `tools[]` + `tool_choice="auto"` and returns a fixed `tool_calls[]` with pre-set name/arguments.
- Multimodal: mock validates that media_type matches declared modalities; does not "understand" the media.

Live-conformance (real OpenAI/Anthropic) is a separate runner mode requiring API keys in a secret store. v1 conformance-skeleton fixes only mock mode; live mode is the responsibility of the implementation plan and/or a dedicated CI branch.

### 12.6 What is AI-specific in the template vs Identity

- **Non-deterministic responses.** All assertions are semantic (`finish_reason`, `usage.tokens > 0`, `content[0].type == TEXT`), not content-equality. Identity could check `email == "alice@example.com"` strictly; Completion cannot.
- **Long-running operations.** Complete up to 30s, Thread.run up to 5 minutes (multi-turn), AsyncJob hours-to-days. Conformance runner supports `assertEventWithin({ seconds })` with large timeouts.
- **Multi-step scenarios.** Identity scenarios are single-RPC. Thread tool-cycle is fundamentally multi-step (`$1.canonical_id` substitution, intermediate event wait, continuation).
- **Binary fixtures.** Multimodal needs image/audio/PDF in the repo. Each ≤100KB, kept in git, no Git-LFS.

## 13. Governance

Per modules-monorepo §6.3, additions to `ai-llm/v1` minor versions require either:

- **(a)** at least two real or planned vendor modules supporting a semantically equivalent operation, **or**
- **(b)** maintainer review confirming an *archetypal* operation for the category.

Archetypal evidence for v1 inclusions:

| Surface | Vendor evidence |
|---|---|
| `Complete` | OpenAI Chat Completions + Anthropic Messages + Gemini generateContent + Bedrock Converse + DeepSeek + Groq |
| Multimodal text+image | OpenAI gpt-4o + Anthropic Claude + Gemini 2.x + Bedrock |
| Multimodal audio input | OpenAI gpt-4o-audio + Gemini 2.x |
| Multimodal file | Gemini 2.x + Anthropic + Bedrock |
| Reasoning hidden+summary | OpenAI o-series + Gemini 2.x thinking |
| Reasoning hidden+full | Anthropic extended thinking + DeepSeek R1 |
| Tool calling (MCP-shape) | All vendors (MCP is de-facto standard) |
| AsyncJob `BATCH_COMPLETION` | OpenAI Batch + Anthropic Message Batches |
| AssistantThread | OpenAI Responses+Conversations + Bedrock Agents conversation |
| Vendor-prefixed model addressing | LiteLLM + OpenRouter + Bifrost (de-facto standard) |

What is **not** in v1 and **does not** automatically enter v1.x with one vendor:

- Streaming (`CompleteStream`, `RunThreadStream`, `chunk_generated` events) — added to v1.minor when the first production blueprint requires it.
- Embedding, Vector, KnowledgeBase, Agent, Tool-registry, SafetyGuardrail — separate categories.
- AsyncJob types beyond `BATCH_COMPLETION` (fine-tuning, eval, file-processing, batch-embedding) — added to v1.minor with ≥2 vendors per type.
- Realtime API (bidirectional audio) — separate brainstorm/category.

Breaking changes to existing v1 RPCs, signature changes, or removals require a new major (`ai-llm/v2/`). Two majors coexist; modules pin one.

## 14. Dependencies and merge order

`ai-llm/v1` depends on:

- `packages/contracts/_common/v1/` — already exists from Identity v1 plan 1. Reused as-is, no changes.
- `@rntme/conformance-framework` — already exists from Identity plan 2 + first vendor brainstorm.
- `module-manifest-validator` — needs extension for new capability fields (`vendors[]`, `input_modalities[]`, `reasoning_visibility_supported[]`, `thread`, `async_job_types[]`, `agent_execution_mode`). This extension is part of plan 1 in this spec.

Merge order:

1. **`packages/contracts/ai-llm/v1/`** — proto (`ai_llm.proto` + `ai_llm-events.proto`), ts-bindings, `error-codes.json`, README. Standalone; passes `tsc`/`lint`/`test` independently. No vendor SDK touches.
2. **`module-manifest-validator` schema extension** — new capability fields validated for `category=ai-llm`. Backward-compatible: new fields are optional, identity modules unaffected.
3. **`modules/ai-llm/README.md`** — category README per modules-monorepo §5.1 contributor entry-point convention.
4. **`modules/ai-llm/conformance/`** — package skeleton: `suite.ts`, fixtures (including binary media), 14 scenario stubs (one per canonical RPC). Each stub fails with `not_implemented` until framework gains AI-specific assertions; preserves the "scenario-per-RPC" invariant from modules-monorepo §7.2.
5. **Documentation-touch task** (per CLAUDE.md "every plan must include a documentation-touch task"):
   - `AGENTS.md` §3 (layering): add `packages/contracts/ai-llm/v1/`, `modules/ai-llm/conformance/` to the layer map.
   - `AGENTS.md` §10 (glossary): entries for **canonical AI/LLM contract**, **vendor-prefixed model addressing**, **MCP-shape tool definition**, **boundary-event-only streaming**, **agent_execution_mode**, **delegated thread**.
   - `README.md` packages-table: list the two new workspace packages.
   - Per-package READMEs follow the standard template (File map / Quick start / API / Invariants & gotchas / Out of scope / Where to look first / Specs).

## 15. Decomposition into implementation plans

This spec decomposes into **2 implementation plans** in `docs/superpowers/plans/done/ai-llm-canonical-contract/`:

| # | Plan | Covers | Depends on |
|---|---|---|---|
| 1 | `01-ai-llm-contracts.md` | Create `packages/contracts/ai-llm/v1/`: `ai_llm.proto`, `ai_llm-events.proto`, ts-bindings, `error-codes.json`, README. Extend `module-manifest-validator` for new capability fields. Documentation-touch (AGENTS.md §3 / §10, README packages-table). | Identity plan 1 (for `_common/v1/`) |
| 2 | `02-ai-llm-conformance-skeleton.md` | Create `modules/ai-llm/README.md`; create `modules/ai-llm/conformance/` workspace package; 14 scenario stubs (one per canonical RPC); fixtures stubs (text, content-blocks, tools, threads, batch-items, binary media); suite.ts wired against `@rntme/conformance-framework`; documentation-touch for new module-tree. | Plan 1 + Identity plan 2 (for conformance-framework) |

The first vendor module (`module-ai-llm-openai` or `module-ai-llm-anthropic` — TBD in next brainstorm) and the AI/LLM module skeleton are NOT covered by these plans.

## 16. Testing model

- **Unit tests for `ai-llm/v1/`:** ts-proto round-trip for each entity (Completion, AssistantThread, ThreadItem, ThreadRun, AsyncJob, BatchCompletionPayload, BatchCompletionItem); each ContentBlock variant (TextBlock, ImageBlock, AudioBlock, FileBlock, ToolCall, ToolResult, ThinkingBlock); each helper type (TokenUsage, SamplingParams, ReasoningInfo, ToolDefinition); each enum value including `*_VENDOR_SPECIFIC = 100`; each event payload (16 events).
- **Drift test (proto ↔ scenarios):** RPC short-names in `service AiLlmModule` must match scenario filenames in `modules/ai-llm/conformance/scenarios/`. Mismatch is a test failure.
- **Drift test (events ↔ proto):** event short-names in conformance fixtures (`module.json#capabilities.events[]` examples) must match message names in `ai_llm-events.proto`.
- **Lint test for `error-codes.json`:** every code matches `AI_LLM_(STRUCTURAL|REFERENCES|CONSISTENCY|VENDOR)_[A-Z_]+`. No other prefixes accepted.
- **Conformance scenario stubs:** each of the 14 scenario files compiles and exports a non-empty `Scenario[]` (even if every scenario currently throws `not_implemented`). Preserves the structural invariant from modules-monorepo §7.2.
- **Multi-step scenario validator:** scenarios with `steps[]` (Thread tool-cycle, AsyncJob lifecycle) verify substitution-expression correctness (`$1.canonical_id`) at compile time via TypeScript helper.
- **Module manifest validator unit tests:** new capability fields validated with positive and negative cases; backward compat for `category=identity` does not break (new fields are optional until `category=ai-llm`).
- **Binary fixtures sanity test:** `sample.png` ≤ 100KB, `sample.mp3` ≤ 100KB, `sample.pdf` ≤ 100KB. Size and media-type validation runs in CI.
- **No vendor SDK touches.** No `openai`/`@anthropic-ai/sdk`/`@google-cloud/vertexai` import in `packages/contracts/ai-llm/v1/` or `modules/ai-llm/conformance/`. The first vendor SDK integration lands with the first vendor module, not here.

## 17. Out of scope / future brainstorms

In priority order:

1. **First vendor module + skeleton** for `module-ai-llm-openai` or `module-ai-llm-anthropic`. Depends on this spec.
2. **Multi-provider gateway module** (`module-ai-llm-litellm-gateway`). Separate brainstorm — capability-routing logic, secret per-upstream credential management.
3. **Streaming v1.minor** — adds `CompleteStream`/`RunThreadStream` RPC + `CompletionChunk` payload + `completion.chunk_generated` event. Non-breaking minor. Triggered when first blueprint requires typing-animation UI.
4. **Embedding category** (`packages/contracts/ai-embedding/v1/`).
5. **Vector category** (`packages/contracts/ai-vector/v1/`) — Pinecone, Qdrant, Weaviate, pgvector, Chroma, Milvus.
6. **KnowledgeBase category** (`packages/contracts/ai-knowledge/v1/`) — managed RAG (OpenAI Vector Store, Bedrock KB).
7. **Agent category** (`packages/contracts/ai-agent/v1/`) — opens `agent_execution_mode = local` for LangGraph/CrewAI; SaaS Agent Platforms (OpenAI Agents API, Bedrock Agents) for `delegated`.
8. **Tool / MCP-bridge category** (`packages/contracts/ai-tools/v1/` or `module-mcp-bridge`).
9. **Safety / Guardrails category** (`packages/contracts/ai-safety/v1/`) — Bedrock Guardrails, OpenAI Moderation, Llama Guard.
10. **Fine-tuning / model lifecycle category**.
11. **Eval / observability category**.

## 18. Open questions

Non-blocking for plans 1–2; must be closed before the first vendor module lands.

- **OQ-AILLMV1-1.** Codegen pipeline (`ts-proto` vs `buf` vs hand-written). If Identity plan 1 chose, inherit; otherwise close in plan 1.
- **OQ-AILLMV1-2.** Idempotency dedup-store for Completion: in-memory (lost on restart), Redis sidecar, Postgres persistent, vendor-SDK builtin (none of major vendors ship one). Decision in first vendor brainstorm; this spec only mandates the contract ("module guarantees 24h dedup"), not the storage mechanism.
- **OQ-AILLMV1-3.** Webhook-receiver (P-3 per modules-monorepo) for AsyncJob status callbacks: one HTTP endpoint per module process, or shared platform gateway. Decision in first vendor brainstorm.
- **OQ-AILLMV1-4.** `Vendor` namespace in model-prefix: open string (`"openai"`, `"anthropic"`, …) vs canonical enum. v1 spec leaves it open-string; canonical enum may come later as a cross-category shared utility in `_common/v1/` if 3+ categories require coordinated vendor identifiers.

## 19. References

- `docs/superpowers/specs/2026-04-26-modules-monorepo-structure-design.md` — directory layout, capability-based UNION conformance model, governance rule, `module.json` schema, conformance framework split.
- `docs/superpowers/specs/2026-04-26-identity-canonical-contract-design.md` — sibling spec by the same template; defines `_common/v1/` shared primitives reused unchanged here.
- `docs/superpowers/specs/2026-04-19-platform-modules-integration-design.md` — module pattern (wrapper, no choreography), gRPC surface, webhook receiver, P-1/P-2/P-3 primitives.
- `docs/superpowers/specs/done/2026-04-17-cloudevents-envelope-design.md` — CloudEvents 1.0 envelope and `type` namespacing convention.
- `CLAUDE.md` — error-code format, single-writer event log, Result<T> rule, branded `Validated*` types, doc-touch obligation, "topic names carry no version suffix".
- `AGENTS.md` — repository layout (§3), how-to recipes (§6), glossary (§10) — all need updates per plan 1.
- `.tmp/rntme_ai_llm_spec.agent.final.md` — vendor research v2.0 (3736 lines) used as input. Not committed; consulted for vendor convergence, event tier classification, MCP/multimodal/reasoning archaeology, AsyncJob lifecycle. Notable deviations from research recorded: scope reduced to 3 aggregates (vs 10), streaming reduced to boundary events (vs full chunk events), namespace `rntme.ai_llm.v1.*` (vs `platform.ai.*`), proto package `rntme.contracts.ai_llm.v1` (vs `platform.ai.types`).
- `MEMORY.md / rntme_orchestration_only` — cross-service async via Zeebe only; choreography forbidden.
- `MEMORY.md / project_pre_stable_stage` — pre-revenue; backward-compat shims dropped; renames/removals free.
- `MEMORY.md / rntme_topic_no_version_suffix` — Kafka topic without `.v1`.
