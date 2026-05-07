# `@rntme/conformance-ai-llm` — AI/LLM conformance scaffolding

Conformance scenarios for the AI/LLM canonical contract `@rntme/contracts-ai-llm-v1`. Consumed by every `modules/ai-llm/<vendor>/` module via the (future) shared conformance runner.

## File map

```text
modules/ai-llm/conformance/
├── src/
│   ├── types.ts                     # local Scenario / CategoryConformanceSuite (until framework lands)
│   ├── capabilities.ts              # canonical RPC/event/capability registries
│   ├── index.ts                     # barrel
│   ├── suite.ts                     # aiLlmConformanceSuite wiring (14 RPCs)
│   ├── fixtures/
│   │   ├── messages.ts              # canonical Message fixtures
│   │   ├── content-blocks.ts        # one fixture per ContentBlockType
│   │   ├── tools.ts                 # MCP-shape ToolDefinition fixtures
│   │   ├── threads.ts               # AssistantThread fixtures
│   │   ├── batch-items.ts           # BatchCompletionItem fixtures
│   │   └── media/                   # binary fixtures (≤100KB each)
│   │       ├── sample.png
│   │       ├── sample.mp3
│   │       ├── sample.pdf
│   │       └── index.ts             # path/URL helpers
│   └── scenarios/                   # one file per canonical RPC (14 total)
├── test/
│   ├── drift.test.ts                # RPC ↔ scenario file drift
│   ├── suite-shape.test.ts          # suite metadata + 14-key invariant
│   └── fixtures-sanity.test.ts      # binary fixture size + magic-byte check
└── README.md
```

## Quick start

```typescript
import { AI_LLM_CANONICAL_RPCS, aiLlmConformanceSuite, samplePngUrl } from '@rntme/conformance-ai-llm';

console.log(aiLlmConformanceSuite.category); // 'ai-llm'
console.log(aiLlmConformanceSuite.contractVersion); // 'v1'
console.log(Object.keys(aiLlmConformanceSuite.scenariosByRpc)); // 14 canonical RPC names
console.log(AI_LLM_CANONICAL_RPCS.length); // 14
console.log(samplePngUrl); // file://…/sample.png
```

When `@rntme/conformance-framework` lands, point its runner at `aiLlmConformanceSuite` and a vendor module's gRPC handler.

## API

### `aiLlmConformanceSuite: CategoryConformanceSuite`

Frozen metadata plus `scenariosByRpc` keyed by canonical RPC name. Every scenarios array is empty in the v1 skeleton until the framework ships an assertion DSL.

### Registry and fixture re-exports

- `AI_LLM_CANONICAL_RPCS`, `AI_LLM_CANONICAL_EVENTS`, `AI_LLM_INPUT_MODALITIES`, `AI_LLM_REASONING_VISIBILITY`, `AI_LLM_ASYNC_JOB_TYPES`, `AI_LLM_AGENT_EXECUTION_MODES`, `AI_LLM_CAPABILITY_FIELDS`.
- `messages`, `contentBlocks`, `tools`, `threads`, `batchItems` namespaces.
- `samplePng{Path,Url}`, `sampleMp3{Path,Url}`, `samplePdf{Path,Url}`.

## Invariants & gotchas

- **One scenario file per canonical RPC.** The drift detector enforces a 1:1 mapping between `service AiLlmModule` RPCs and `src/scenarios/<RPC>.scenarios.ts` files.
- **Scenarios are empty in v1 skeleton.** Real scenarios land with `@rntme/conformance-framework`.
- **Binary fixtures stay ≤ 100KB.** The fixtures-sanity test enforces size and magic bytes.
- **`types.ts` is temporary** until `@rntme/conformance-framework` publishes the shared types.

## Out of scope

- Actual scenario implementations, live-vendor mode, and the framework runner itself — separate packages and plans.

## Where to look first

- `src/scenarios/Complete.scenarios.ts` — stub structure citing spec §12.2.
- `src/scenarios/RunThread.scenarios.ts` — multi-step thread tool-cycle outline.
- `test/drift.test.ts` — authoritative RPC ↔ file wiring checks.

## Specs

- `docs/history/specs/historical/2026-04-26-ai-llm-canonical-contract-design.md` §12.
- `docs/history/specs/active-rationale/2026-04-26-modules-monorepo-structure-design.md` §7.
- `docs/history/plans/historical/ai-llm-canonical-contract/02-ai-llm-conformance-skeleton.md`.
