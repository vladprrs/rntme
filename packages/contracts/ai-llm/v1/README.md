# `@rntme/contracts-ai-llm-v1` - Canonical AI/LLM contract v1

The protobuf shapes, generated TypeScript bindings, and error-code list for the AI/LLM category. Every vendor module (`module-ai-llm-openai`, `module-ai-llm-anthropic`, `module-ai-llm-bedrock`, `module-ai-llm-litellm-gateway`) implements this contract.

## File map

```
packages/contracts/ai-llm/v1/
├── proto/
│   ├── ai_llm.proto
│   └── ai_llm-events.proto
├── scripts/gen.mjs
├── src/
│   ├── proto.gen.{js,d.ts}
│   ├── error-codes.ts
│   └── index.ts
├── test/
├── error-codes.json
└── README.md
```

## Quick start

```typescript
import { proto, isErrorCode } from '@rntme/contracts-ai-llm-v1';

const { Completion, CreateCompletionRequest } = proto.rntme.contracts.ai_llm.v1;

const req = CreateCompletionRequest.create({
  context: {
    idempotency_key: 'req_01J',
    correlation_id: 'corr_01',
    actor_user_id: 'user_42',
    actor_type: 'user',
  },
  model: 'openai/gpt-4o',
  messages: [{ role: 'user', content: [{ type: 1, text: { text: 'Hello' } }] }],
});

const bytes = CreateCompletionRequest.encode(req).finish();
const completion = Completion.decode(responseBytes);

if (isErrorCode(maybeCode)) {
  // The code is one of AI_LLM_<LAYER>_<KIND>.
}
```

## API

### Aggregates

- `Completion` - stateless request/response unit with multi-block content, finish reason, token usage, optional reasoning, and optional tool calls.
- `AssistantThread`, `ThreadItem`, `ThreadRun` - delegated stateful conversation. Modules without native vendor state declare `thread: false` and return `UNIMPLEMENTED` for thread RPCs.
- `AsyncJob` - generic async job state machine. v1 carries only `BATCH_COMPLETION` via `BatchCompletionPayload`.

### Status enums

`FinishReason`, `ContentBlockType`, `ReasoningEffort`, `ReasoningVisibility`, `ThreadStatus`, `ThreadRunStatus`, `AsyncJobType`, and `AsyncJobStatus`.

All status-style enums follow the rntme convention: `<TYPE>_UNSPECIFIED = 0`, `<TYPE>_VENDOR_SPECIFIC = 100`.

### Helper types

`TokenUsage`, `SamplingParams`, `ReasoningInfo`, `ToolDefinition`, `ToolCall`, `ToolResult`, `Message`, and `ContentBlock`. `ContentBlock` is a oneof of text, image, audio, file, tool_use, tool_result, and thinking.

### `service AiLlmModule`

| Group | RPCs |
| --- | --- |
| Completion | `Complete`, `GetCompletion` |
| AssistantThread | `CreateThread`, `GetThread`, `DeleteThread`, `AddMessage`, `ListThreadItems`, `RunThread`, `GetThreadRun`, `CancelThreadRun` |
| AsyncJob | `SubmitJob`, `GetJob`, `CancelJob`, `ListJobs` |

### Events

CloudEvents `type: rntme.ai_llm.v1.<MessageName>`. Topics: `rntme.ai_llm.completion`, `rntme.ai_llm.thread`, `rntme.ai_llm.async_job`. Topics intentionally have no `.v1` suffix.

| Topic | Events |
| --- | --- |
| `completion` | `CompletionStarted`, `CompletionFinished`, `CompletionFailed` |
| `thread` | `ThreadCreated`, `ThreadDeleted`, `ThreadMessageAdded`, `ThreadRunStarted`, `ThreadRunRequiresAction`, `ThreadRunCompleted`, `ThreadRunFailed`, `ThreadRunCancelled` |
| `async_job` | `AsyncJobSubmitted`, `AsyncJobStatusChanged`, `AsyncJobCompleted`, `AsyncJobFailed`, `AsyncJobCancelled` |

### Error codes

`error-codes.json` lists every `AI_LLM_<LAYER>_<KIND>` constant. Layers are `structural`, `references`, `consistency`, and `vendor`.

## Invariants

- Streaming is not in v1. `Complete` and `RunThread` are unary-only; no per-chunk events.
- Model addressing is `<vendor>/<model>`, for example `openai/gpt-4o`.
- Idempotency is required on every command RPC through `CommandContext.idempotency_key`.
- `ToolCall.arguments` is `google.protobuf.Struct`, not a string.
- `vendor_raw` lives on aggregates, not helper messages.

## Capability fields

This contract introduces these `module.json#capabilities` fields for AI/LLM modules:

```json
{
  "capabilities": {
    "vendors": ["openai"],
    "rpcs": ["Complete", "GetCompletion"],
    "events": ["CompletionStarted", "CompletionFinished", "CompletionFailed"],
    "input_modalities": ["text", "image", "audio", "file"],
    "reasoning_visibility_supported": ["hidden", "summary"],
    "thread": true,
    "async_job_types": ["BATCH_COMPLETION"],
    "agent_execution_mode": "none"
  }
}
```

## Out of scope

Streaming RPCs, embeddings, vector storage, knowledge bases, first-class Agent aggregates, tool-registry RPCs, safety guardrails, fine-tuning, model lifecycle, eval, and realtime APIs are separate future categories or v1.minor additions.

## Where to look first

- `proto/ai_llm.proto` - service, aggregates, helpers, enums, request/response messages.
- `proto/ai_llm-events.proto` - all 16 event payloads.
- `error-codes.json` - error-code set.
- `test/service-shape.test.ts` - authoritative RPC and event drift detector.

## Specs

- `docs/superpowers/specs/done/2026-04-26-ai-llm-canonical-contract-design.md`
- `docs/superpowers/specs/2026-04-26-modules-monorepo-structure-design.md`
- `docs/superpowers/specs/2026-04-26-identity-canonical-contract-design.md`
- `docs/superpowers/plans/done/ai-llm-canonical-contract/01-ai-llm-contracts.md`
