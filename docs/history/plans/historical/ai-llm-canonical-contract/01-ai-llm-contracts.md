> Status: historical.
> Date: unknown.
> Current source: docs/current/**, docs/decision-system.md, and current code/tests.
> Why retained: Historical rationale and execution context retained for review; it is not current-state truth by itself.

# AI/LLM Canonical Contract v1 — Plan 1: `ai-llm/v1/` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land one new workspace package — `@rntme/contracts-ai-llm-v1` — implementing the protobuf shapes (`ai_llm.proto` + `ai_llm-events.proto`), generated TS bindings, error codes, and README defined by `docs/history/specs/historical/2026-04-26-ai-llm-canonical-contract-design.md`. After this plan, `pnpm -r run build && test && lint && typecheck` passes for the new package and consumers can `import { proto } from '@rntme/contracts-ai-llm-v1'` to access `Completion`, `AssistantThread`, `AsyncJob`, the `AiLlmModule` service descriptor, and all sixteen event payload types.

**Architecture:** One leaf workspace package under `packages/contracts/ai-llm/v1/`. Owns its `proto/*.proto` source and generates `src/proto.gen.{js,d.ts}` via `protobufjs` static-module codegen (`pbjs --target static-module --wrap es6` followed by `pbts` from `protobufjs-cli`). Declares a workspace dependency on `@rntme/contracts-common-v1` (created by Identity plan 1) and imports its proto via the `protobufjs` `--path` resolver. Tests are vitest round-trip cases that assert encode→decode preserves the canonical shape, plus a drift-detector test that asserts every RPC short-name in `service AiLlmModule` matches the expected event-fixture-name mapping.

**Tech Stack:** TypeScript 5.5, `protobufjs` runtime + `protobufjs-cli` static-module codegen (`pbjs`/`pbts`), Node 20+, pnpm 9.12+ workspaces, vitest, eslint flat config — identical to the merged Identity contract implementation, inheriting its codegen pipeline decision (closes spec OQ-AILLMV1-1 by reuse).

**Spec reference:** `docs/history/specs/historical/2026-04-26-ai-llm-canonical-contract-design.md` §4 (layout), §5 (status enums), §6 (helper types), §7 (ContentBlock), §8 (aggregates), §9 (service & request/response), §10 (events), §11 (error codes), §14 (merge order).

**Depends on:** Identity plan 1 (`docs/history/plans/historical/identity-canonical-contract/01-common-and-identity-contracts.md`) must be merged first — `packages/contracts/_common/v1/` must exist as a workspace package, the `pnpm-workspace.yaml` glob `packages/contracts/*/v*` must be in place, and `tsconfig.base.json` must exist at repo root. This plan does **not** create or modify `_common/v1/`.

---

## File Structure

Files this plan creates or modifies:

**Created**
- `packages/contracts/ai-llm/v1/package.json`
- `packages/contracts/ai-llm/v1/tsconfig.json`
- `packages/contracts/ai-llm/v1/tsconfig.check.json`
- `packages/contracts/ai-llm/v1/eslint.config.mjs`
- `packages/contracts/ai-llm/v1/proto/ai_llm.proto`
- `packages/contracts/ai-llm/v1/proto/ai_llm-events.proto`
- `packages/contracts/ai-llm/v1/scripts/gen.mjs`
- `packages/contracts/ai-llm/v1/src/proto.gen.js` (generated; tracked)
- `packages/contracts/ai-llm/v1/src/proto.gen.d.ts` (generated; tracked)
- `packages/contracts/ai-llm/v1/src/index.ts`
- `packages/contracts/ai-llm/v1/src/error-codes.ts` (typed re-export of JSON)
- `packages/contracts/ai-llm/v1/test/entities.test.ts`
- `packages/contracts/ai-llm/v1/test/content-blocks.test.ts`
- `packages/contracts/ai-llm/v1/test/events.test.ts`
- `packages/contracts/ai-llm/v1/test/error-codes.test.ts`
- `packages/contracts/ai-llm/v1/test/service-shape.test.ts`
- `packages/contracts/ai-llm/v1/error-codes.json`
- `packages/contracts/ai-llm/v1/.gitattributes`
- `packages/contracts/ai-llm/v1/.gitignore`
- `packages/contracts/ai-llm/v1/README.md`

**Modified**
- `AGENTS.md` — §3 layering update (add `packages/contracts/ai-llm/v1/`); §10 glossary entries (canonical AI/LLM contract, vendor-prefixed model addressing, MCP-shape tool definition, boundary-event-only streaming, `agent_execution_mode`, delegated thread).
- `README.md` — packages table entry for `@rntme/contracts-ai-llm-v1`.

**NOT modified by this plan**
- `pnpm-workspace.yaml` — Identity plan 1 already added `packages/contracts/*/v*`. The new `packages/contracts/ai-llm/v1/` directory is matched by that existing glob.
- `module-manifest-validator` — does not yet exist (modules-monorepo plan 1 owns it). Capability schema additions (`vendors[]`, `input_modalities[]`, `reasoning_visibility_supported[]`, `thread`, `async_job_types[]`, `agent_execution_mode`) are documented in the per-package README and become validator extensions when modules-monorepo plan 1 lands. This deferral matches how Identity plan 1 handled the same dependency.

---

## Codegen approach (closes spec OQ-AILLMV1-1)

This plan inherits the merged Identity contract codegen decision: `protobufjs` runtime plus `protobufjs-cli` static-module generation via `pbjs --target static-module --wrap es6` followed by `pbts`. Context7 check on 2026-04-27 and the merged Identity package both confirm that current `protobufjs` installs do **not** provide the CLI by themselves; this package therefore adds a direct `protobufjs-cli` dev dependency. Reasoning is otherwise unchanged from Identity plan 1: no `protoc` binary required, ESM-friendly output. Re-evaluation belongs in a v1.minor or v2 if it bites.

The per-package codegen driver is a tiny ESM script (`scripts/gen.mjs`) invoked via `pnpm run proto:gen`. It resolves `pbjs`/`pbts` through `createRequire('protobufjs-cli/package.json')`, not `node_modules/.bin`, so it is stable under pnpm's symlink layout. Generated files (`src/proto.gen.js`, `src/proto.gen.d.ts`) are committed (so consumers don't need codegen at install time) and `.gitattributes` marks them `linguist-generated=true` so PR diffs collapse them. The build script copies generated artifacts to `dist/`, matching Identity, because the handwritten TypeScript source imports `./proto.gen.js` at runtime.

The codegen driver imports proto files **across packages** via the `--path` flag. This plan's `gen.mjs` includes both:
- `node_modules/protobufjs` — for `google.protobuf.Timestamp`, `Duration`, `Struct` well-known types.
- A temporary `proto-deps/` tree with symlinks for `rntme/contracts/common/v1/common.proto` and `rntme/contracts/ai_llm/v1/ai_llm.proto`, matching the namespace paths used by imports.

---

## Task 1: `@rntme/contracts-ai-llm-v1` package skeleton

**Files:**
- Create: `packages/contracts/ai-llm/v1/package.json`
- Create: `packages/contracts/ai-llm/v1/tsconfig.json`
- Create: `packages/contracts/ai-llm/v1/tsconfig.check.json`
- Create: `packages/contracts/ai-llm/v1/eslint.config.mjs`
- Create: `packages/contracts/ai-llm/v1/.gitattributes`
- Create: `packages/contracts/ai-llm/v1/.gitignore`

- [ ] **Step 1: Create package directory**

Run:
```bash
mkdir -p packages/contracts/ai-llm/v1/{proto,scripts,src,test}
```

- [ ] **Step 2: Write `package.json`**

Create `packages/contracts/ai-llm/v1/package.json`:

```json
{
  "name": "@rntme/contracts-ai-llm-v1",
  "version": "0.0.0",
  "type": "module",
  "private": true,
  "description": "Canonical AI/LLM contract v1 for rntme: Completion, AssistantThread, AsyncJob, and 16 CloudEvents payloads. See docs/history/specs/historical/2026-04-26-ai-llm-canonical-contract-design.md.",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./error-codes": {
      "types": "./dist/error-codes.d.ts",
      "import": "./dist/error-codes.js"
    }
  },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": [
    "dist",
    "proto",
    "error-codes.json",
    "README.md"
  ],
  "scripts": {
    "proto:gen": "node scripts/gen.mjs",
    "build": "tsc -p tsconfig.json && cp src/proto.gen.d.ts src/proto.gen.js dist/",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc -p tsconfig.check.json",
    "lint": "eslint \"src/**/*.ts\" \"test/**/*.ts\""
  },
  "dependencies": {
    "@rntme/contracts-common-v1": "workspace:*",
    "protobufjs": "^8.0.1"
  },
  "devDependencies": {
    "@eslint/js": "^9.10.0",
    "@types/node": "^20.14.0",
    "@typescript-eslint/eslint-plugin": "^8.6.0",
    "@typescript-eslint/parser": "^8.6.0",
    "eslint": "^9.10.0",
    "protobufjs-cli": "^2.0.1",
    "typescript": "^5.5.4",
    "vitest": "^2.1.1"
  }
}
```

- [ ] **Step 3: Write `tsconfig.json`**

Create `packages/contracts/ai-llm/v1/tsconfig.json`:

```json
{
  "extends": "../../../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "composite": false,
    "allowJs": false,
    "module": "NodeNext",
    "moduleResolution": "NodeNext"
  },
  "include": ["src/**/*.ts"],
  "exclude": ["dist", "node_modules", "test"]
}
```

- [ ] **Step 4: Write `tsconfig.check.json`**

Create `packages/contracts/ai-llm/v1/tsconfig.check.json`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "rootDir": ".",
    "noEmit": true,
    "composite": false,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true
  },
  "include": ["src/**/*.ts", "test/**/*.ts"],
  "exclude": ["dist", "node_modules"]
}
```

- [ ] **Step 5: Write `eslint.config.mjs`**

Create `packages/contracts/ai-llm/v1/eslint.config.mjs`:

```javascript
import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

export default [
  { ignores: ['dist/**', 'node_modules/**', 'src/proto.gen.*'] },
  js.configs.recommended,
  {
    files: ['src/**/*.ts', 'test/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { sourceType: 'module', ecmaVersion: 2022 },
      globals: {
        console: 'readonly',
        process: 'readonly',
        structuredClone: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-console': 'warn',
    },
  },
];
```

- [ ] **Step 6: Write `.gitattributes`**

Create `packages/contracts/ai-llm/v1/.gitattributes`:

```
src/proto.gen.js linguist-generated=true
src/proto.gen.d.ts linguist-generated=true
```

- [ ] **Step 7: Write `.gitignore`**

Create `packages/contracts/ai-llm/v1/.gitignore`:

```
proto-deps/
```

- [ ] **Step 8: Run pnpm install and confirm the package is in the workspace**

Run: `pnpm install --frozen-lockfile=false`

Then: `pnpm list -r --depth -1 | grep contracts-ai-llm-v1`
Expected: line containing `@rntme/contracts-ai-llm-v1 0.0.0`.

- [ ] **Step 9: Commit**

```bash
git add pnpm-lock.yaml packages/contracts/ai-llm/v1/package.json packages/contracts/ai-llm/v1/tsconfig.json packages/contracts/ai-llm/v1/tsconfig.check.json packages/contracts/ai-llm/v1/eslint.config.mjs packages/contracts/ai-llm/v1/.gitattributes packages/contracts/ai-llm/v1/.gitignore
git commit -m "feat(contracts-ai-llm-v1): scaffold package"
```

---

## Task 2: `proto/ai_llm.proto` — status enums

**Files:**
- Create: `packages/contracts/ai-llm/v1/proto/ai_llm.proto` (initial file with imports + enums section only; subsequent tasks append)

- [ ] **Step 1: Write the file with imports and all 8 enums**

Create `packages/contracts/ai-llm/v1/proto/ai_llm.proto`:

```protobuf
syntax = "proto3";
package rntme.contracts.ai_llm.v1;

import "google/protobuf/timestamp.proto";
import "google/protobuf/duration.proto";
import "google/protobuf/struct.proto";
import "rntme/contracts/common/v1/common.proto";

// =====================================================
// Section 1: Status enums
// rntme convention: <TYPE>_UNSPECIFIED = 0 (proto3 zero),
// <TYPE>_VENDOR_SPECIFIC = 100 (escape hatch).
// 1–99 reserved for canonical values; 100+ for vendor extensions.
// =====================================================

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

- [ ] **Step 2: Commit**

```bash
git add packages/contracts/ai-llm/v1/proto/ai_llm.proto
git commit -m "feat(contracts-ai-llm-v1): proto enums"
```

---

## Task 3: `proto/ai_llm.proto` — helper types and ContentBlock

**Files:**
- Modify: `packages/contracts/ai-llm/v1/proto/ai_llm.proto` (append helper types and ContentBlock)

- [ ] **Step 1: Append helper types and ContentBlock to the proto file**

Append the following to `packages/contracts/ai-llm/v1/proto/ai_llm.proto`:

```protobuf

// =====================================================
// Section 2: Helper types
// Live inside ai-llm/v1; not promoted to _common because they are
// AI-domain specific (TokenUsage, sampling, reasoning, MCP tools).
// =====================================================

message TokenUsage {
  int32 input_tokens = 1;
  int32 output_tokens = 2;
  int32 reasoning_tokens = 3;
  int32 cached_tokens = 4;
  int32 total_tokens = 5;
}

message SamplingParams {
  optional float temperature = 1;
  optional float top_p = 2;
  optional int32 top_k = 3;
  optional int32 max_tokens = 4;
  optional float frequency_penalty = 5;
  optional float presence_penalty = 6;
  repeated string stop_sequences = 7;
  optional int64 seed = 8;
  optional string response_format = 9;
  google.protobuf.Struct response_schema = 10;
}

message ReasoningInfo {
  ReasoningEffort effort = 1;
  ReasoningVisibility visibility = 2;
  string summary = 3;
}

message ToolDefinition {
  string name = 1;
  string description = 2;
  google.protobuf.Struct input_schema = 3;
  bool strict = 4;
}

message ToolCall {
  string id = 1;
  string name = 2;
  google.protobuf.Struct arguments = 3;
}

message ToolResult {
  string tool_call_id = 1;
  google.protobuf.Struct output = 2;
  bool is_error = 3;
}

message Message {
  string role = 1;
  repeated ContentBlock content = 2;
}

// =====================================================
// Section 3: ContentBlock + sub-blocks (oneof of 7 variants)
// =====================================================

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

message TextBlock {
  string text = 1;
}

message ImageBlock {
  oneof source {
    string url = 1;
    bytes base64_data = 2;
  }
  string media_type = 3;
}

message AudioBlock {
  oneof source {
    string url = 1;
    bytes base64_data = 2;
  }
  string media_type = 3;
  string transcript = 4;
}

message FileBlock {
  oneof source {
    string url = 1;
    bytes base64_data = 2;
    string vendor_file_id = 3;
  }
  string media_type = 4;
  string filename = 5;
}

message ThinkingBlock {
  string text = 1;
  bool redacted = 2;
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/contracts/ai-llm/v1/proto/ai_llm.proto
git commit -m "feat(contracts-ai-llm-v1): proto helpers + ContentBlock"
```

---

## Task 4: `proto/ai_llm.proto` — aggregates

**Files:**
- Modify: `packages/contracts/ai-llm/v1/proto/ai_llm.proto` (append aggregates section)

- [ ] **Step 1: Append the three aggregates plus AsyncJob payload types**

Append the following to `packages/contracts/ai-llm/v1/proto/ai_llm.proto`:

```protobuf

// =====================================================
// Section 4: Aggregates
// Three aggregates: Completion (stateless), AssistantThread + ThreadItem + ThreadRun
// (delegated stateful, capability-flagged), AsyncJob (generic state machine).
// =====================================================

message Completion {
  rntme.contracts.common.v1.CanonicalRef ref = 1;

  string model = 2;
  repeated ContentBlock content = 3;
  FinishReason finish_reason = 4;
  TokenUsage usage = 5;
  ReasoningInfo reasoning = 6;
  repeated ToolCall tool_calls = 7;

  google.protobuf.Timestamp started_at = 8;
  google.protobuf.Timestamp finished_at = 9;
  google.protobuf.Duration time_to_first_token = 10;

  google.protobuf.Struct vendor_raw = 11;
}

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
  string role = 3;
  repeated ContentBlock content = 4;
  google.protobuf.Timestamp created_at = 5;
  string run_id = 6;
  google.protobuf.Struct vendor_raw = 7;
}

message ThreadRun {
  rntme.contracts.common.v1.CanonicalRef ref = 1;
  string thread_id = 2;
  ThreadRunStatus status = 3;
  string model = 4;
  TokenUsage usage = 5;
  repeated ToolCall required_tool_calls = 6;
  ReasoningInfo reasoning = 7;
  string failure_reason = 8;
  google.protobuf.Timestamp started_at = 9;
  google.protobuf.Timestamp completed_at = 10;
  google.protobuf.Struct vendor_raw = 11;
}

message AsyncJob {
  rntme.contracts.common.v1.CanonicalRef ref = 1;
  AsyncJobType type = 2;
  AsyncJobStatus status = 3;
  int32 progress_percentage = 4;
  string result_uri = 5;
  string error_message = 6;
  TokenUsage aggregate_usage = 7;
  google.protobuf.Timestamp created_at = 8;
  google.protobuf.Timestamp completed_at = 9;
  google.protobuf.Timestamp expires_at = 10;
  google.protobuf.Struct vendor_raw = 11;
}

message BatchCompletionPayload {
  repeated BatchCompletionItem items = 1;
  string completion_window = 2;
}

message BatchCompletionItem {
  string custom_id = 1;
  CreateCompletionRequest request = 2;
}
```

Note: `BatchCompletionItem.request` references `CreateCompletionRequest`, which is declared in Task 5. Proto3 allows forward references between messages within a single file; the codegen step in Task 7 verifies resolution.

- [ ] **Step 2: Commit**

```bash
git add packages/contracts/ai-llm/v1/proto/ai_llm.proto
git commit -m "feat(contracts-ai-llm-v1): proto aggregates"
```

---

## Task 5: `proto/ai_llm.proto` — service `AiLlmModule` and request/response messages

**Files:**
- Modify: `packages/contracts/ai-llm/v1/proto/ai_llm.proto` (append service + RPC requests/responses)

- [ ] **Step 1: Append the service definition and all 14 request/response message pairs**

Append the following to `packages/contracts/ai-llm/v1/proto/ai_llm.proto`:

```protobuf

// =====================================================
// Section 5: Service AiLlmModule
// 14 RPCs: 2 Completion + 8 AssistantThread + 4 AsyncJob.
// =====================================================

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

// =====================================================
// Section 6: Request/response messages
// =====================================================

// ───── Completion ─────
message CreateCompletionRequest {
  rntme.contracts.common.v1.CommandContext context = 1;
  string model = 2;
  repeated Message messages = 3;
  repeated ToolDefinition tools = 4;
  string tool_choice = 5;
  SamplingParams sampling = 6;
  ReasoningEffort reasoning_effort = 7;
  ReasoningVisibility reasoning_visibility = 8;
  rntme.contracts.common.v1.Metadata metadata = 9;
}

message GetCompletionRequest {
  string canonical_id = 1;
}

// ───── Thread ─────
message CreateThreadRequest {
  rntme.contracts.common.v1.CommandContext context = 1;
  string title = 2;
  repeated Message initial_messages = 3;
  rntme.contracts.common.v1.Metadata metadata = 4;
}

message GetThreadRequest {
  string canonical_id = 1;
}

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
  string model = 3;
  repeated ToolDefinition tools = 4;
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
  string reason = 4;
}

// ───── AsyncJob ─────
message SubmitJobRequest {
  rntme.contracts.common.v1.CommandContext context = 1;
  oneof body {
    BatchCompletionPayload batch_completion = 2;
  }
  google.protobuf.Duration ttl = 3;
  rntme.contracts.common.v1.Metadata metadata = 4;
}

message GetJobRequest {
  string canonical_id = 1;
}

message CancelJobRequest {
  rntme.contracts.common.v1.CommandContext context = 1;
  string canonical_id = 2;
}

message ListJobsRequest {
  rntme.contracts.common.v1.ListRequest base = 1;
  AsyncJobType type = 2;
  AsyncJobStatus status = 3;
}

message AsyncJobList {
  repeated AsyncJob items = 1;
  rntme.contracts.common.v1.ListResponseMeta meta = 2;
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/contracts/ai-llm/v1/proto/ai_llm.proto
git commit -m "feat(contracts-ai-llm-v1): service AiLlmModule + request/response"
```

---

## Task 6: `proto/ai_llm-events.proto` — 16 events

**Files:**
- Create: `packages/contracts/ai-llm/v1/proto/ai_llm-events.proto`

- [ ] **Step 1: Write the events file**

Create `packages/contracts/ai-llm/v1/proto/ai_llm-events.proto`:

```protobuf
syntax = "proto3";
package rntme.contracts.ai_llm.v1;

import "google/protobuf/timestamp.proto";
import "rntme/contracts/ai_llm/v1/ai_llm.proto";

// =====================================================
// 16 canonical CloudEvent payloads for AI/LLM v1.
// CloudEvents type: rntme.ai_llm.v1.<MessageName>
// Topics: rntme.ai_llm.{completion, thread, async_job}
// =====================================================

// ─── Completion (3) ─────────────────────────────────────
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

// ─── Thread (8) ─────────────────────────────────────────
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
  repeated ThreadItem new_items = 2;
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

// ─── AsyncJob (5) ───────────────────────────────────────
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

- [ ] **Step 2: Commit**

```bash
git add packages/contracts/ai-llm/v1/proto/ai_llm-events.proto
git commit -m "feat(contracts-ai-llm-v1): proto 16 events"
```

---

## Task 7: Codegen wiring + barrel export

**Files:**
- Create: `packages/contracts/ai-llm/v1/scripts/gen.mjs`
- Create: `packages/contracts/ai-llm/v1/src/proto.gen.js` (generated; tracked)
- Create: `packages/contracts/ai-llm/v1/src/proto.gen.d.ts` (generated; tracked)
- Create: `packages/contracts/ai-llm/v1/src/index.ts`

- [ ] **Step 1: Write codegen driver**

Create `packages/contracts/ai-llm/v1/scripts/gen.mjs`:

```javascript
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(here, '..');
const repoRoot = resolve(pkgRoot, '../../../..');

const require = createRequire(resolve(pkgRoot, 'package.json'));
const cliDir = dirname(require.resolve('protobufjs-cli/package.json'));
const pbjs = resolve(cliDir, 'bin/pbjs');
const pbts = resolve(cliDir, 'bin/pbts');

// Single entry: ai_llm-events imports ai_llm (and transitively common via ai_llm).
const protoEntry = resolve(pkgRoot, 'proto/ai_llm-events.proto');
const outJs = resolve(pkgRoot, 'src/proto.gen.js');
const outDts = resolve(pkgRoot, 'src/proto.gen.d.ts');

// Path roots for proto imports:
//   1) protobufjs ships google/protobuf well-known types
//   2) proto-deps mirrors namespaced imports from common + this package.
const pbjsRoot = resolve(pkgRoot, 'node_modules/protobufjs');

const protoDeps = resolve(pkgRoot, 'proto-deps');
rmSync(protoDeps, { recursive: true, force: true });
mkdirSync(resolve(protoDeps, 'rntme/contracts/common/v1'), { recursive: true });
mkdirSync(resolve(protoDeps, 'rntme/contracts/ai_llm/v1'), { recursive: true });
symlinkSync(
  resolve(repoRoot, 'packages/contracts/_common/v1/proto/common.proto'),
  resolve(protoDeps, 'rntme/contracts/common/v1/common.proto'),
);
symlinkSync(
  resolve(pkgRoot, 'proto/ai_llm.proto'),
  resolve(protoDeps, 'rntme/contracts/ai_llm/v1/ai_llm.proto'),
);

function run(cmd) {
  console.log(`> ${cmd}`);
  execSync(cmd, { stdio: 'inherit', cwd: pkgRoot });
}

/** Node ESM: use default import + explicit .js subpath (namespace import breaks on protobufjs 8). */
function patchPbjsEsmImports(filePath) {
  let js = readFileSync(filePath, 'utf8');
  js = js.replace(
    /import \* as \$protobuf from "protobufjs\/minimal\.js"/g,
    'import $protobuf from "protobufjs/minimal.js"',
  );
  js = js.replace(/import \* as \$protobuf from "protobufjs\/minimal"/g, 'import $protobuf from "protobufjs/minimal.js"');
  writeFileSync(filePath, js);
}

run(
  `node "${pbjs}" --target static-module --wrap es6 --es6 --keep-case ` +
    `--path ${pbjsRoot} --path ${protoDeps} --path ${resolve(pkgRoot, 'proto')} ` +
    `--out ${outJs} ${protoEntry}`,
);
patchPbjsEsmImports(outJs);
run(`node "${pbts}" --out ${outDts} ${outJs}`);

console.log('Codegen complete.');
```

The `proto-deps/` symlink tree mirrors how `pbjs` resolves namespaced imports. This must stay aligned with the merged Identity `gen.mjs` pattern; the extra ESM import patch is required for protobufjs 8 static-module output under Node ESM.

- [ ] **Step 2: Write `src/index.ts` barrel**

Create `packages/contracts/ai-llm/v1/src/index.ts`:

```typescript
export * as proto from './proto.gen.js';
export type { rntme as Rntme } from './proto.gen.js';
export { errorCodes, type ErrorCode } from './error-codes.js';
```

The `errorCodes` re-export is added in Task 9 (the `error-codes.ts` file). For now this line will fail typecheck — ignore it until Task 9.

- [ ] **Step 3: Run codegen**

Run: `pnpm -F @rntme/contracts-ai-llm-v1 run proto:gen`

Expected: writes `src/proto.gen.js` and `src/proto.gen.d.ts`. The output is verbose — `pbjs` logs each message it writes. No errors expected.

If you see "common.proto not found", verify Identity plan 1 was merged and `packages/contracts/_common/v1/proto/common.proto` exists.

- [ ] **Step 4: Verify generated artifacts contain expected names**

Run: `grep -c 'AiLlmModule\|Completion\|AssistantThread\|AsyncJob\|ThreadItem\|ThreadRun\|ContentBlock\|TokenUsage' packages/contracts/ai-llm/v1/src/proto.gen.d.ts`

Expected: a number > 30 (each name appears multiple times in the generated declarations).

- [ ] **Step 5: Commit**

```bash
git add packages/contracts/ai-llm/v1/scripts/gen.mjs packages/contracts/ai-llm/v1/src/proto.gen.js packages/contracts/ai-llm/v1/src/proto.gen.d.ts packages/contracts/ai-llm/v1/src/index.ts
git commit -m "feat(contracts-ai-llm-v1): codegen wiring + generated bindings"
```

---

## Task 8: `error-codes.json` and typed re-export

**Files:**
- Create: `packages/contracts/ai-llm/v1/error-codes.json`
- Create: `packages/contracts/ai-llm/v1/src/error-codes.ts`

- [ ] **Step 1: Write `error-codes.json`**

Create `packages/contracts/ai-llm/v1/error-codes.json`:

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

- [ ] **Step 2: Write typed re-export**

Create `packages/contracts/ai-llm/v1/src/error-codes.ts`:

```typescript
import errorCodesJson from '../error-codes.json' with { type: 'json' };

export const errorCodes = errorCodesJson as {
  structural: readonly string[];
  references: readonly string[];
  consistency: readonly string[];
  vendor: readonly string[];
};

export type ErrorLayer = keyof typeof errorCodes;

export type ErrorCode =
  | (typeof errorCodes.structural)[number]
  | (typeof errorCodes.references)[number]
  | (typeof errorCodes.consistency)[number]
  | (typeof errorCodes.vendor)[number];

const ALL_CODES = new Set<string>([
  ...errorCodesJson.structural,
  ...errorCodesJson.references,
  ...errorCodesJson.consistency,
  ...errorCodesJson.vendor,
]);

export function isErrorCode(value: string): value is ErrorCode {
  return ALL_CODES.has(value);
}

export function layerOf(code: ErrorCode): ErrorLayer {
  if ((errorCodesJson.structural as readonly string[]).includes(code)) return 'structural';
  if ((errorCodesJson.references as readonly string[]).includes(code)) return 'references';
  if ((errorCodesJson.consistency as readonly string[]).includes(code)) return 'consistency';
  return 'vendor';
}
```

The `with { type: 'json' }` import attribute requires Node 20.10+ and this package's `tsconfig.json` sets `module: "NodeNext"` / `moduleResolution: "NodeNext"`, matching the merged Identity contract package.

- [ ] **Step 3: Verify build now succeeds**

Run: `pnpm -F @rntme/contracts-ai-llm-v1 run build`
Expected: emits `dist/index.js`, `dist/index.d.ts`, `dist/error-codes.js`, `dist/error-codes.d.ts`, `dist/proto.gen.js`, and `dist/proto.gen.d.ts`. No errors.

Run: `pnpm -F @rntme/contracts-ai-llm-v1 run typecheck`
Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add packages/contracts/ai-llm/v1/error-codes.json packages/contracts/ai-llm/v1/src/error-codes.ts
git commit -m "feat(contracts-ai-llm-v1): error-codes.json + typed re-export"
```

---

## Task 9: Round-trip tests for entities and ContentBlock

**Files:**
- Create: `packages/contracts/ai-llm/v1/test/entities.test.ts`
- Create: `packages/contracts/ai-llm/v1/test/content-blocks.test.ts`

- [ ] **Step 1: Write `test/entities.test.ts`**

Create `packages/contracts/ai-llm/v1/test/entities.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { proto } from '../src/index.js';

const { Completion, AssistantThread, ThreadItem, ThreadRun, AsyncJob, BatchCompletionPayload } =
  proto.rntme.contracts.ai_llm.v1;

describe('AI/LLM v1 aggregates round-trip', () => {
  it('Completion encode→decode preserves content + usage + reasoning', () => {
    const original = Completion.create({
      ref: {
        canonical_id: 'cmpl_01JABCD',
        vendor_id: 'chatcmpl-abc',
        module_name: 'module-ai-llm-openai',
        module_version: '0.1.0',
        contract_version: 'v1',
      },
      model: 'openai/gpt-4o',
      content: [
        {
          type: 1, // CONTENT_BLOCK_TYPE_TEXT
          text: { text: 'Hello, world!' },
        },
      ],
      finish_reason: 1, // FINISH_REASON_STOP
      usage: {
        input_tokens: 12,
        output_tokens: 4,
        reasoning_tokens: 0,
        cached_tokens: 0,
        total_tokens: 16,
      },
      tool_calls: [],
    });

    const buf = Completion.encode(original).finish();
    const round = Completion.decode(buf);

    expect(round.ref?.canonical_id).toBe('cmpl_01JABCD');
    expect(round.model).toBe('openai/gpt-4o');
    expect(round.content).toHaveLength(1);
    expect(round.content[0].type).toBe(1);
    expect(round.usage?.total_tokens).toBe(16);
    expect(round.finish_reason).toBe(1);
  });

  it('Completion preserves multi-block content (text + thinking + tool_use)', () => {
    const original = Completion.create({
      model: 'anthropic/claude-sonnet-4-5',
      finish_reason: 3, // TOOL_CALLS
      content: [
        { type: 7, thinking: { text: 'Let me check the weather.', redacted: false } },
        { type: 1, text: { text: 'I will fetch the weather now.' } },
        {
          type: 5,
          tool_use: {
            id: 'tooluse_1',
            name: 'get_weather',
            arguments: { fields: { city: { stringValue: 'Berlin' } } },
          },
        },
      ],
    });

    const buf = Completion.encode(original).finish();
    const round = Completion.decode(buf);

    expect(round.content).toHaveLength(3);
    expect(round.content[0].type).toBe(7);
    expect(round.content[1].type).toBe(1);
    expect(round.content[2].type).toBe(5);
    expect(round.content[2].tool_use?.name).toBe('get_weather');
  });

  it('AssistantThread round-trip preserves status + metadata', () => {
    const original = AssistantThread.create({
      ref: { canonical_id: 'thr_01J', vendor_id: 'thread_abc', module_name: 'module-ai-llm-openai', module_version: '0.1.0', contract_version: 'v1' },
      title: 'Customer support session',
      status: 1, // ACTIVE
      metadata: {
        public: { fields: { tag: { stringValue: 'support' } } },
      },
    });

    const buf = AssistantThread.encode(original).finish();
    const round = AssistantThread.decode(buf);

    expect(round.title).toBe('Customer support session');
    expect(round.status).toBe(1);
    expect(round.ref?.canonical_id).toBe('thr_01J');
  });

  it('ThreadItem preserves role + multi-block content + run_id linkage', () => {
    const original = ThreadItem.create({
      item_id: 'item_01',
      thread_id: 'thr_01J',
      role: 'assistant',
      run_id: 'run_01',
      content: [{ type: 1, text: { text: 'How can I help?' } }],
    });

    const buf = ThreadItem.encode(original).finish();
    const round = ThreadItem.decode(buf);

    expect(round.role).toBe('assistant');
    expect(round.run_id).toBe('run_01');
    expect(round.content).toHaveLength(1);
  });

  it('ThreadRun preserves required_tool_calls when status=REQUIRES_ACTION', () => {
    const original = ThreadRun.create({
      ref: { canonical_id: 'run_01', vendor_id: 'resp_abc', module_name: 'module-ai-llm-openai', module_version: '0.1.0', contract_version: 'v1' },
      thread_id: 'thr_01J',
      status: 3, // REQUIRES_ACTION
      model: 'openai/gpt-4o',
      required_tool_calls: [
        { id: 'tc_1', name: 'get_weather', arguments: { fields: { city: { stringValue: 'Berlin' } } } },
      ],
    });

    const buf = ThreadRun.encode(original).finish();
    const round = ThreadRun.decode(buf);

    expect(round.status).toBe(3);
    expect(round.required_tool_calls).toHaveLength(1);
    expect(round.required_tool_calls[0].name).toBe('get_weather');
  });

  it('AsyncJob preserves type + progress + result_uri', () => {
    const original = AsyncJob.create({
      ref: { canonical_id: 'job_01', vendor_id: 'batch_abc', module_name: 'module-ai-llm-openai', module_version: '0.1.0', contract_version: 'v1' },
      type: 1, // BATCH_COMPLETION
      status: 5, // COMPLETED
      progress_percentage: 100,
      result_uri: 'https://files.openai.com/batch/output_abc.jsonl',
    });

    const buf = AsyncJob.encode(original).finish();
    const round = AsyncJob.decode(buf);

    expect(round.type).toBe(1);
    expect(round.status).toBe(5);
    expect(round.progress_percentage).toBe(100);
    expect(round.result_uri).toContain('output_abc.jsonl');
  });

  it('BatchCompletionPayload nests CreateCompletionRequest correctly', () => {
    const original = BatchCompletionPayload.create({
      completion_window: '24h',
      items: [
        {
          custom_id: 'req_001',
          request: {
            context: { idempotency_key: 'k1', correlation_id: 'c1', actor_user_id: 'u1', actor_type: 'user' },
            model: 'openai/gpt-4o-mini',
            messages: [
              { role: 'user', content: [{ type: 1, text: { text: 'What is 2+2?' } }] },
            ],
          },
        },
      ],
    });

    const buf = BatchCompletionPayload.encode(original).finish();
    const round = BatchCompletionPayload.decode(buf);

    expect(round.items).toHaveLength(1);
    expect(round.items[0].custom_id).toBe('req_001');
    expect(round.items[0].request?.model).toBe('openai/gpt-4o-mini');
  });
});

describe('AI/LLM v1 enums', () => {
  const { FinishReason, ContentBlockType, ReasoningEffort, ReasoningVisibility, ThreadStatus, ThreadRunStatus, AsyncJobType, AsyncJobStatus } = proto.rntme.contracts.ai_llm.v1;

  it('FinishReason has UNSPECIFIED=0 and VENDOR_SPECIFIC=100', () => {
    expect(FinishReason.FINISH_REASON_UNSPECIFIED).toBe(0);
    expect(FinishReason.FINISH_REASON_VENDOR_SPECIFIC).toBe(100);
    expect(FinishReason.FINISH_REASON_STOP).toBe(1);
    expect(FinishReason.FINISH_REASON_TOOL_CALLS).toBe(3);
  });

  it('ContentBlockType has 7 canonical types + UNSPECIFIED + VENDOR_SPECIFIC', () => {
    expect(ContentBlockType.CONTENT_BLOCK_TYPE_UNSPECIFIED).toBe(0);
    expect(ContentBlockType.CONTENT_BLOCK_TYPE_TEXT).toBe(1);
    expect(ContentBlockType.CONTENT_BLOCK_TYPE_THINKING).toBe(7);
    expect(ContentBlockType.CONTENT_BLOCK_TYPE_VENDOR_SPECIFIC).toBe(100);
  });

  it('ReasoningEffort has 6 levels (UNSPECIFIED through MAX)', () => {
    expect(ReasoningEffort.REASONING_EFFORT_UNSPECIFIED).toBe(0);
    expect(ReasoningEffort.REASONING_EFFORT_MAX).toBe(5);
  });

  it('ReasoningVisibility has 4 levels (UNSPECIFIED through FULL)', () => {
    expect(ReasoningVisibility.REASONING_VISIBILITY_UNSPECIFIED).toBe(0);
    expect(ReasoningVisibility.REASONING_VISIBILITY_FULL).toBe(3);
  });

  it('ThreadStatus has 4 canonical values', () => {
    expect(ThreadStatus.THREAD_STATUS_ACTIVE).toBe(1);
    expect(ThreadStatus.THREAD_STATUS_DELETED).toBe(3);
    expect(ThreadStatus.THREAD_STATUS_VENDOR_SPECIFIC).toBe(100);
  });

  it('ThreadRunStatus has 8 canonical values', () => {
    expect(ThreadRunStatus.THREAD_RUN_STATUS_QUEUED).toBe(1);
    expect(ThreadRunStatus.THREAD_RUN_STATUS_REQUIRES_ACTION).toBe(3);
    expect(ThreadRunStatus.THREAD_RUN_STATUS_EXPIRED).toBe(7);
    expect(ThreadRunStatus.THREAD_RUN_STATUS_VENDOR_SPECIFIC).toBe(100);
  });

  it('AsyncJobType has only BATCH_COMPLETION canonical in v1', () => {
    expect(AsyncJobType.ASYNC_JOB_TYPE_UNSPECIFIED).toBe(0);
    expect(AsyncJobType.ASYNC_JOB_TYPE_BATCH_COMPLETION).toBe(1);
    expect(AsyncJobType.ASYNC_JOB_TYPE_VENDOR_SPECIFIC).toBe(100);
  });

  it('AsyncJobStatus has 9 canonical values', () => {
    expect(AsyncJobStatus.ASYNC_JOB_STATUS_VALIDATING).toBe(1);
    expect(AsyncJobStatus.ASYNC_JOB_STATUS_COMPLETED).toBe(5);
    expect(AsyncJobStatus.ASYNC_JOB_STATUS_EXPIRED).toBe(8);
  });
});
```

- [ ] **Step 2: Write `test/content-blocks.test.ts`**

Create `packages/contracts/ai-llm/v1/test/content-blocks.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { proto } from '../src/index.js';

const { ContentBlock } = proto.rntme.contracts.ai_llm.v1;

describe('ContentBlock oneof variants round-trip', () => {
  it('TEXT block', () => {
    const cb = ContentBlock.create({ type: 1, text: { text: 'hi' } });
    const round = ContentBlock.decode(ContentBlock.encode(cb).finish());
    expect(round.type).toBe(1);
    expect(round.text?.text).toBe('hi');
  });

  it('IMAGE block via URL', () => {
    const cb = ContentBlock.create({
      type: 2,
      image: { url: 'https://example.com/x.png', media_type: 'image/png' },
    });
    const round = ContentBlock.decode(ContentBlock.encode(cb).finish());
    expect(round.type).toBe(2);
    expect(round.image?.url).toBe('https://example.com/x.png');
    expect(round.image?.media_type).toBe('image/png');
  });

  it('IMAGE block via base64_data', () => {
    const cb = ContentBlock.create({
      type: 2,
      image: { base64_data: new Uint8Array([1, 2, 3]), media_type: 'image/jpeg' },
    });
    const round = ContentBlock.decode(ContentBlock.encode(cb).finish());
    expect(round.image?.base64_data).toBeInstanceOf(Uint8Array);
    expect(Array.from(round.image!.base64_data!)).toEqual([1, 2, 3]);
  });

  it('AUDIO block with transcript', () => {
    const cb = ContentBlock.create({
      type: 3,
      audio: { url: 'https://x/call.mp3', media_type: 'audio/mpeg', transcript: 'Hello caller' },
    });
    const round = ContentBlock.decode(ContentBlock.encode(cb).finish());
    expect(round.audio?.transcript).toBe('Hello caller');
  });

  it('FILE block via vendor_file_id', () => {
    const cb = ContentBlock.create({
      type: 4,
      file: { vendor_file_id: 'file_abc', media_type: 'application/pdf', filename: 'report.pdf' },
    });
    const round = ContentBlock.decode(ContentBlock.encode(cb).finish());
    expect(round.file?.vendor_file_id).toBe('file_abc');
    expect(round.file?.filename).toBe('report.pdf');
  });

  it('TOOL_USE block', () => {
    const cb = ContentBlock.create({
      type: 5,
      tool_use: { id: 'tu_1', name: 'lookup_user', arguments: { fields: { id: { stringValue: 'u_42' } } } },
    });
    const round = ContentBlock.decode(ContentBlock.encode(cb).finish());
    expect(round.tool_use?.name).toBe('lookup_user');
  });

  it('TOOL_RESULT block', () => {
    const cb = ContentBlock.create({
      type: 6,
      tool_result: {
        tool_call_id: 'tu_1',
        output: { fields: { name: { stringValue: 'Alice' } } },
        is_error: false,
      },
    });
    const round = ContentBlock.decode(ContentBlock.encode(cb).finish());
    expect(round.tool_result?.tool_call_id).toBe('tu_1');
    expect(round.tool_result?.is_error).toBe(false);
  });

  it('THINKING block', () => {
    const cb = ContentBlock.create({
      type: 7,
      thinking: { text: 'Let me think...', redacted: false },
    });
    const round = ContentBlock.decode(ContentBlock.encode(cb).finish());
    expect(round.thinking?.text).toBe('Let me think...');
  });

  it('THINKING block with redacted=true (Anthropic encrypted thinking)', () => {
    const cb = ContentBlock.create({
      type: 7,
      thinking: { text: '', redacted: true },
    });
    const round = ContentBlock.decode(ContentBlock.encode(cb).finish());
    expect(round.thinking?.redacted).toBe(true);
  });
});
```

- [ ] **Step 3: Run tests**

Run: `pnpm -F @rntme/contracts-ai-llm-v1 run test`
Expected: 16 entity tests + 9 content-block tests pass.

- [ ] **Step 4: Commit**

```bash
git add packages/contracts/ai-llm/v1/test/entities.test.ts packages/contracts/ai-llm/v1/test/content-blocks.test.ts
git commit -m "test(contracts-ai-llm-v1): round-trip entities + ContentBlock variants"
```

---

## Task 10: Round-trip tests for events

**Files:**
- Create: `packages/contracts/ai-llm/v1/test/events.test.ts`

- [ ] **Step 1: Write `test/events.test.ts`**

Create `packages/contracts/ai-llm/v1/test/events.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { proto } from '../src/index.js';

const ns = proto.rntme.contracts.ai_llm.v1;

const EVENT_NAMES = [
  // Completion (3)
  'CompletionStarted',
  'CompletionFinished',
  'CompletionFailed',
  // Thread (8)
  'ThreadCreated',
  'ThreadDeleted',
  'ThreadMessageAdded',
  'ThreadRunStarted',
  'ThreadRunRequiresAction',
  'ThreadRunCompleted',
  'ThreadRunFailed',
  'ThreadRunCancelled',
  // AsyncJob (5)
  'AsyncJobSubmitted',
  'AsyncJobStatusChanged',
  'AsyncJobCompleted',
  'AsyncJobFailed',
  'AsyncJobCancelled',
] as const;

describe('AI/LLM v1 event payloads', () => {
  it('exports exactly 16 event types', () => {
    for (const name of EVENT_NAMES) {
      expect(ns[name as keyof typeof ns], `event ${name} missing`).toBeDefined();
    }
    expect(EVENT_NAMES.length).toBe(16);
  });

  it('CompletionStarted round-trip', () => {
    const original = ns.CompletionStarted.create({
      completion_id: 'cmpl_01',
      model: 'openai/gpt-4o',
      input_token_estimate: 100,
    });
    const round = ns.CompletionStarted.decode(ns.CompletionStarted.encode(original).finish());
    expect(round.completion_id).toBe('cmpl_01');
    expect(round.input_token_estimate).toBe(100);
  });

  it('CompletionFinished embeds Completion aggregate', () => {
    const original = ns.CompletionFinished.create({
      completion: {
        ref: { canonical_id: 'cmpl_01', vendor_id: 'v', module_name: 'm', module_version: '0', contract_version: 'v1' },
        model: 'anthropic/claude-sonnet-4-5',
        finish_reason: 1,
      },
    });
    const round = ns.CompletionFinished.decode(ns.CompletionFinished.encode(original).finish());
    expect(round.completion?.model).toBe('anthropic/claude-sonnet-4-5');
  });

  it('CompletionFailed carries error_code', () => {
    const original = ns.CompletionFailed.create({
      completion_id: 'cmpl_01',
      model: 'openai/gpt-4o',
      error_code: 'AI_LLM_VENDOR_RATE_LIMITED',
      error_message: 'rate limit hit',
    });
    const round = ns.CompletionFailed.decode(ns.CompletionFailed.encode(original).finish());
    expect(round.error_code).toBe('AI_LLM_VENDOR_RATE_LIMITED');
  });

  it('ThreadCreated round-trip with initial_message_count', () => {
    const original = ns.ThreadCreated.create({
      thread: { ref: { canonical_id: 'thr_01', vendor_id: 'v', module_name: 'm', module_version: '0', contract_version: 'v1' }, status: 1 },
      creator_user_id: 'user_42',
      initial_message_count: 3,
    });
    const round = ns.ThreadCreated.decode(ns.ThreadCreated.encode(original).finish());
    expect(round.thread?.ref?.canonical_id).toBe('thr_01');
    expect(round.initial_message_count).toBe(3);
  });

  it('ThreadDeleted round-trip', () => {
    const round = ns.ThreadDeleted.decode(
      ns.ThreadDeleted.encode(ns.ThreadDeleted.create({ canonical_id: 'thr_01', vendor_id: 'v', hard_delete: true })).finish(),
    );
    expect(round.hard_delete).toBe(true);
  });

  it('ThreadMessageAdded embeds ThreadItem', () => {
    const round = ns.ThreadMessageAdded.decode(
      ns.ThreadMessageAdded.encode(
        ns.ThreadMessageAdded.create({
          item: { item_id: 'i_1', thread_id: 'thr_01', role: 'user', content: [{ type: 1, text: { text: 'hi' } }] },
        }),
      ).finish(),
    );
    expect(round.item?.role).toBe('user');
  });

  it('ThreadRunStarted round-trip', () => {
    const round = ns.ThreadRunStarted.decode(
      ns.ThreadRunStarted.encode(
        ns.ThreadRunStarted.create({ thread_id: 'thr_01', run_id: 'run_01', model: 'openai/gpt-4o' }),
      ).finish(),
    );
    expect(round.run_id).toBe('run_01');
  });

  it('ThreadRunRequiresAction carries required_tool_calls[]', () => {
    const round = ns.ThreadRunRequiresAction.decode(
      ns.ThreadRunRequiresAction.encode(
        ns.ThreadRunRequiresAction.create({
          thread_id: 'thr_01',
          run_id: 'run_01',
          required_tool_calls: [{ id: 'tc_1', name: 'lookup', arguments: {} }],
        }),
      ).finish(),
    );
    expect(round.required_tool_calls).toHaveLength(1);
    expect(round.required_tool_calls[0].name).toBe('lookup');
  });

  it('ThreadRunCompleted carries new_items[]', () => {
    const round = ns.ThreadRunCompleted.decode(
      ns.ThreadRunCompleted.encode(
        ns.ThreadRunCompleted.create({
          run: { ref: { canonical_id: 'run_01', vendor_id: 'v', module_name: 'm', module_version: '0', contract_version: 'v1' }, status: 4 },
          new_items: [
            { item_id: 'i_2', thread_id: 'thr_01', role: 'assistant', content: [{ type: 1, text: { text: 'done' } }] },
          ],
        }),
      ).finish(),
    );
    expect(round.new_items).toHaveLength(1);
    expect(round.run?.status).toBe(4);
  });

  it('ThreadRunFailed carries error_code', () => {
    const round = ns.ThreadRunFailed.decode(
      ns.ThreadRunFailed.encode(
        ns.ThreadRunFailed.create({
          run: { ref: { canonical_id: 'run_01', vendor_id: 'v', module_name: 'm', module_version: '0', contract_version: 'v1' }, status: 5 },
          error_code: 'AI_LLM_VENDOR_CONTEXT_WINDOW_EXCEEDED',
          error_message: 'context too long',
        }),
      ).finish(),
    );
    expect(round.error_code).toBe('AI_LLM_VENDOR_CONTEXT_WINDOW_EXCEEDED');
  });

  it('ThreadRunCancelled round-trip', () => {
    const round = ns.ThreadRunCancelled.decode(
      ns.ThreadRunCancelled.encode(
        ns.ThreadRunCancelled.create({ thread_id: 'thr_01', run_id: 'run_01', reason: 'user_action' }),
      ).finish(),
    );
    expect(round.reason).toBe('user_action');
  });

  it('AsyncJobSubmitted carries input_item_count', () => {
    const round = ns.AsyncJobSubmitted.decode(
      ns.AsyncJobSubmitted.encode(
        ns.AsyncJobSubmitted.create({
          job: { ref: { canonical_id: 'job_01', vendor_id: 'v', module_name: 'm', module_version: '0', contract_version: 'v1' }, type: 1, status: 2 },
          type: 1,
          input_item_count: 50,
        }),
      ).finish(),
    );
    expect(round.input_item_count).toBe(50);
  });

  it('AsyncJobStatusChanged carries previous_status + new_status', () => {
    const round = ns.AsyncJobStatusChanged.decode(
      ns.AsyncJobStatusChanged.encode(
        ns.AsyncJobStatusChanged.create({
          canonical_id: 'job_01',
          type: 1,
          previous_status: 2,
          new_status: 3,
          progress_percentage: 25,
        }),
      ).finish(),
    );
    expect(round.previous_status).toBe(2);
    expect(round.new_status).toBe(3);
    expect(round.progress_percentage).toBe(25);
  });

  it('AsyncJobCompleted embeds AsyncJob with result_uri', () => {
    const round = ns.AsyncJobCompleted.decode(
      ns.AsyncJobCompleted.encode(
        ns.AsyncJobCompleted.create({
          job: {
            ref: { canonical_id: 'job_01', vendor_id: 'v', module_name: 'm', module_version: '0', contract_version: 'v1' },
            type: 1,
            status: 5,
            result_uri: 'https://files.openai.com/x.jsonl',
          },
        }),
      ).finish(),
    );
    expect(round.job?.result_uri).toContain('jsonl');
  });

  it('AsyncJobFailed carries error_code', () => {
    const round = ns.AsyncJobFailed.decode(
      ns.AsyncJobFailed.encode(
        ns.AsyncJobFailed.create({
          job: { ref: { canonical_id: 'job_01', vendor_id: 'v', module_name: 'm', module_version: '0', contract_version: 'v1' }, type: 1, status: 6 },
          error_code: 'AI_LLM_VENDOR_QUOTA_EXCEEDED',
          error_message: 'monthly quota exhausted',
        }),
      ).finish(),
    );
    expect(round.error_code).toBe('AI_LLM_VENDOR_QUOTA_EXCEEDED');
  });

  it('AsyncJobCancelled round-trip', () => {
    const round = ns.AsyncJobCancelled.decode(
      ns.AsyncJobCancelled.encode(
        ns.AsyncJobCancelled.create({
          job: { ref: { canonical_id: 'job_01', vendor_id: 'v', module_name: 'm', module_version: '0', contract_version: 'v1' }, type: 1, status: 7 },
          reason: 'admin',
        }),
      ).finish(),
    );
    expect(round.reason).toBe('admin');
  });
});
```

- [ ] **Step 2: Run tests**

Run: `pnpm -F @rntme/contracts-ai-llm-v1 run test`
Expected: all entity, content-block, and 16 event tests pass.

- [ ] **Step 3: Commit**

```bash
git add packages/contracts/ai-llm/v1/test/events.test.ts
git commit -m "test(contracts-ai-llm-v1): round-trip 16 event payloads"
```

---

## Task 11: Error-codes lint test + service-shape drift test

**Files:**
- Create: `packages/contracts/ai-llm/v1/test/error-codes.test.ts`
- Create: `packages/contracts/ai-llm/v1/test/service-shape.test.ts`

- [ ] **Step 1: Write `test/error-codes.test.ts`**

Create `packages/contracts/ai-llm/v1/test/error-codes.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { errorCodes, isErrorCode, layerOf, type ErrorCode } from '../src/error-codes.js';

const PATTERN = /^AI_LLM_(STRUCTURAL|REFERENCES|CONSISTENCY|VENDOR)_[A-Z_]+$/;

describe('error-codes.json', () => {
  it('every code matches AI_LLM_<LAYER>_<KIND>', () => {
    for (const layer of ['structural', 'references', 'consistency', 'vendor'] as const) {
      for (const code of errorCodes[layer]) {
        expect(code, `code ${code} does not match pattern`).toMatch(PATTERN);
      }
    }
  });

  it('has expected counts per layer', () => {
    expect(errorCodes.structural).toHaveLength(9);
    expect(errorCodes.references).toHaveLength(5);
    expect(errorCodes.consistency).toHaveLength(10);
    expect(errorCodes.vendor).toHaveLength(8);
  });

  it('layer prefix matches layer key', () => {
    for (const code of errorCodes.structural) expect(code).toMatch(/^AI_LLM_STRUCTURAL_/);
    for (const code of errorCodes.references) expect(code).toMatch(/^AI_LLM_REFERENCES_/);
    for (const code of errorCodes.consistency) expect(code).toMatch(/^AI_LLM_CONSISTENCY_/);
    for (const code of errorCodes.vendor) expect(code).toMatch(/^AI_LLM_VENDOR_/);
  });

  it('isErrorCode returns true for known codes', () => {
    expect(isErrorCode('AI_LLM_VENDOR_RATE_LIMITED')).toBe(true);
    expect(isErrorCode('NOT_A_CODE')).toBe(false);
  });

  it('layerOf returns the correct layer', () => {
    expect(layerOf('AI_LLM_STRUCTURAL_MISSING_MODEL' as ErrorCode)).toBe('structural');
    expect(layerOf('AI_LLM_VENDOR_UNAVAILABLE' as ErrorCode)).toBe('vendor');
    expect(layerOf('AI_LLM_REFERENCES_THREAD_NOT_FOUND' as ErrorCode)).toBe('references');
    expect(layerOf('AI_LLM_CONSISTENCY_THREAD_DELETED' as ErrorCode)).toBe('consistency');
  });

  it('no duplicate codes across layers', () => {
    const all = [
      ...errorCodes.structural,
      ...errorCodes.references,
      ...errorCodes.consistency,
      ...errorCodes.vendor,
    ];
    const set = new Set(all);
    expect(set.size).toBe(all.length);
  });
});
```

- [ ] **Step 2: Write `test/service-shape.test.ts` (drift detector)**

Create `packages/contracts/ai-llm/v1/test/service-shape.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { proto } from '../src/index.js';

const EXPECTED_RPCS = [
  // Completion (2)
  'Complete',
  'GetCompletion',
  // Thread (8)
  'CreateThread',
  'GetThread',
  'DeleteThread',
  'AddMessage',
  'ListThreadItems',
  'RunThread',
  'GetThreadRun',
  'CancelThreadRun',
  // AsyncJob (4)
  'SubmitJob',
  'GetJob',
  'CancelJob',
  'ListJobs',
] as const;

const EXPECTED_EVENTS = [
  'CompletionStarted',
  'CompletionFinished',
  'CompletionFailed',
  'ThreadCreated',
  'ThreadDeleted',
  'ThreadMessageAdded',
  'ThreadRunStarted',
  'ThreadRunRequiresAction',
  'ThreadRunCompleted',
  'ThreadRunFailed',
  'ThreadRunCancelled',
  'AsyncJobSubmitted',
  'AsyncJobStatusChanged',
  'AsyncJobCompleted',
  'AsyncJobFailed',
  'AsyncJobCancelled',
] as const;

const EXPECTED_RPC_EVENT_FIXTURE_NAMES = {
  Complete: ['CompletionStarted', 'CompletionFinished', 'CompletionFailed'],
  GetCompletion: [],
  CreateThread: ['ThreadCreated'],
  GetThread: [],
  DeleteThread: ['ThreadDeleted'],
  AddMessage: ['ThreadMessageAdded'],
  ListThreadItems: [],
  RunThread: ['ThreadRunStarted', 'ThreadRunRequiresAction', 'ThreadRunCompleted', 'ThreadRunFailed'],
  GetThreadRun: [],
  CancelThreadRun: ['ThreadRunCancelled'],
  SubmitJob: ['AsyncJobSubmitted'],
  GetJob: [],
  CancelJob: ['AsyncJobCancelled'],
  ListJobs: [],
} satisfies Record<(typeof EXPECTED_RPCS)[number], readonly (typeof EXPECTED_EVENTS)[number][]>;

describe('service AiLlmModule shape', () => {
  it('declares exactly 14 RPCs by canonical name', () => {
    // The proto.gen.js exposes the service descriptor at proto.rntme.contracts.ai_llm.v1.AiLlmModule.
    // protobufjs static-module emits service classes whose `methods` map has keys = RPC names.
    const ns = proto.rntme.contracts.ai_llm.v1 as Record<string, unknown>;
    const ServiceCtor = ns['AiLlmModule'] as { methods?: Record<string, unknown> };

    expect(ServiceCtor, 'AiLlmModule service descriptor missing').toBeDefined();
    // protobufjs static-module ships a class wrapping rpcImpl-style invocation;
    // method names are class instance methods. Walk the prototype.
    const proto2 = ServiceCtor as unknown as { prototype: Record<string, unknown> };
    const declaredMethods = Object.getOwnPropertyNames(proto2.prototype).filter((n) => n !== 'constructor');

    const lowerCase = declaredMethods.map((n) => n.toLowerCase()).sort();
    const expectedLowerCase = [...EXPECTED_RPCS].map((n) => n.charAt(0).toLowerCase() + n.slice(1)).sort();

    // pbjs lower-cases the first letter of RPC method names by default.
    expect(lowerCase).toEqual(expectedLowerCase);
  });

  it('every event short-name is exported as a Message constructor', () => {
    const ns = proto.rntme.contracts.ai_llm.v1 as Record<string, unknown>;
    for (const evt of EXPECTED_EVENTS) {
      expect(ns[evt], `event message ${evt} missing from generated proto`).toBeDefined();
    }
    expect(EXPECTED_EVENTS.length).toBe(16);
  });

  it('keeps the RPC short-name to event-fixture-name mapping in sync', () => {
    expect(Object.keys(EXPECTED_RPC_EVENT_FIXTURE_NAMES).sort()).toEqual([...EXPECTED_RPCS].sort());

    const eventSet = new Set(EXPECTED_EVENTS);
    for (const [rpc, eventNames] of Object.entries(EXPECTED_RPC_EVENT_FIXTURE_NAMES)) {
      expect(EXPECTED_RPCS.includes(rpc as (typeof EXPECTED_RPCS)[number]), `unexpected RPC mapping key ${rpc}`).toBe(true);
      for (const eventName of eventNames) {
        expect(
          eventSet.has(eventName as (typeof EXPECTED_EVENTS)[number]),
          `${rpc} maps to unknown event fixture ${eventName}`,
        ).toBe(true);
      }
    }
  });

  it('every aggregate is exported as a Message constructor', () => {
    const ns = proto.rntme.contracts.ai_llm.v1 as Record<string, unknown>;
    const expected = ['Completion', 'AssistantThread', 'ThreadItem', 'ThreadRun', 'AsyncJob', 'BatchCompletionPayload', 'BatchCompletionItem'];
    for (const name of expected) {
      expect(ns[name], `aggregate ${name} missing`).toBeDefined();
    }
  });

  it('every helper type is exported', () => {
    const ns = proto.rntme.contracts.ai_llm.v1 as Record<string, unknown>;
    for (const name of ['TokenUsage', 'SamplingParams', 'ReasoningInfo', 'ToolDefinition', 'ToolCall', 'ToolResult', 'Message', 'ContentBlock', 'TextBlock', 'ImageBlock', 'AudioBlock', 'FileBlock', 'ThinkingBlock']) {
      expect(ns[name], `helper ${name} missing`).toBeDefined();
    }
  });
});
```

This test is the drift detector: if anyone adds an RPC to `service AiLlmModule` without updating `EXPECTED_RPCS` and `EXPECTED_RPC_EVENT_FIXTURE_NAMES`, or adds an event message without updating `EXPECTED_EVENTS`, the test fails. The mapping intentionally leaves read/list RPCs with `[]` because they do not produce boundary events. Conformance plan 2 has a complementary drift test that asserts `EXPECTED_RPCS` matches the scenario filenames and uses the same event-fixture names for capability examples.

- [ ] **Step 3: Run tests**

Run: `pnpm -F @rntme/contracts-ai-llm-v1 run test`
Expected: all tests pass (entities + content-blocks + events + error-codes + service-shape).

- [ ] **Step 4: Run lint and typecheck**

Run: `pnpm -F @rntme/contracts-ai-llm-v1 run lint`
Expected: zero errors.

Run: `pnpm -F @rntme/contracts-ai-llm-v1 run typecheck`
Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
git add packages/contracts/ai-llm/v1/test/error-codes.test.ts packages/contracts/ai-llm/v1/test/service-shape.test.ts
git commit -m "test(contracts-ai-llm-v1): error-codes lint + service-shape drift detector"
```

---

## Task 12: Per-package README

**Files:**
- Create: `packages/contracts/ai-llm/v1/README.md`

- [ ] **Step 1: Write the README**

Create `packages/contracts/ai-llm/v1/README.md`:

```markdown
# `@rntme/contracts-ai-llm-v1` — Canonical AI/LLM contract v1

The protobuf shapes, generated TypeScript bindings, and error-code list for the AI/LLM category. Every vendor module (`module-ai-llm-openai`, `module-ai-llm-anthropic`, `module-ai-llm-bedrock`, `module-ai-llm-litellm-gateway`, …) implements this contract.

## File map

```
packages/contracts/ai-llm/v1/
├── proto/
│   ├── ai_llm.proto           # service AiLlmModule, entities, enums, request/response
│   └── ai_llm-events.proto     # 16 event payloads
├── scripts/gen.mjs             # codegen driver (pbjs/pbts)
├── src/
│   ├── proto.gen.{js,d.ts}     # generated bindings (committed)
│   ├── error-codes.ts           # typed re-export of error-codes.json
│   └── index.ts                 # barrel export
├── test/                        # vitest round-trip + drift tests
├── error-codes.json             # AI_LLM_<LAYER>_<KIND> set
└── README.md
```

## Quick start

```typescript
import { proto, errorCodes, isErrorCode } from '@rntme/contracts-ai-llm-v1';

const { Completion, CreateCompletionRequest, AiLlmModule } = proto.rntme.contracts.ai_llm.v1;

const req = CreateCompletionRequest.create({
  context: {
    idempotency_key: 'req_01J',
    correlation_id: 'corr_01',
    actor_user_id: 'user_42',
    actor_type: 'user',
  },
  model: 'openai/gpt-4o',
  messages: [
    { role: 'user', content: [{ type: 1 /* TEXT */, text: { text: 'Hello' } }] },
  ],
});

// Encode for transport
const bytes = CreateCompletionRequest.encode(req).finish();

// Decode incoming response
const completion = Completion.decode(responseBytes);

if (isErrorCode(maybeCode)) {
  // ...
}
```

## API

### Aggregates (3)

- **`Completion`** — stateless request/response unit. Multi-block content, finish_reason, token_usage, optional reasoning, optional tool_calls.
- **`AssistantThread` + `ThreadItem` + `ThreadRun`** — delegated stateful conversation (capability-flagged). Thread is the container; ThreadItem is a typed message; ThreadRun is one execution cycle.
- **`AsyncJob`** — generic async job state machine. v1 carries only `BATCH_COMPLETION` job type via `BatchCompletionPayload`.

### Status enums (8)

- `FinishReason`, `ContentBlockType`, `ReasoningEffort`, `ReasoningVisibility`, `ThreadStatus`, `ThreadRunStatus`, `AsyncJobType`, `AsyncJobStatus`.
- All follow rntme convention: `<TYPE>_UNSPECIFIED = 0`, `<TYPE>_VENDOR_SPECIFIC = 100`. 1–99 reserved for canonical values.

### Helper types

`TokenUsage`, `SamplingParams`, `ReasoningInfo`, `ToolDefinition` (MCP-shape), `ToolCall`, `ToolResult`, `Message`, `ContentBlock` (oneof of 7 variants: text, image, audio, file, tool_use, tool_result, thinking).

### `service AiLlmModule` (14 RPCs)

| Group | RPCs |
|---|---|
| Completion (2) | `Complete`, `GetCompletion` |
| AssistantThread (8) | `CreateThread`, `GetThread`, `DeleteThread`, `AddMessage`, `ListThreadItems`, `RunThread`, `GetThreadRun`, `CancelThreadRun` |
| AsyncJob (4) | `SubmitJob`, `GetJob`, `CancelJob`, `ListJobs` |

### Events (16)

CloudEvents `type: rntme.ai_llm.v1.<MessageName>`. Topics: `rntme.ai_llm.completion`, `rntme.ai_llm.thread`, `rntme.ai_llm.async_job`. No `.v1` suffix on topic per CLAUDE.md.

| Topic | Events |
|---|---|
| `completion` | CompletionStarted, CompletionFinished, CompletionFailed |
| `thread` | ThreadCreated, ThreadDeleted, ThreadMessageAdded, ThreadRunStarted, ThreadRunRequiresAction, ThreadRunCompleted, ThreadRunFailed, ThreadRunCancelled |
| `async_job` | AsyncJobSubmitted, AsyncJobStatusChanged, AsyncJobCompleted, AsyncJobFailed, AsyncJobCancelled |

### Error codes

`error-codes.json` lists every `AI_LLM_<LAYER>_<KIND>` constant. Layers: `structural`, `references`, `consistency`, `vendor`. See spec §11 for gRPC code mapping.

## Invariants & gotchas

- **Streaming is NOT in v1.** `Complete` and `RunThread` are unary-only; no `CompleteStream`/`RunThreadStream` RPC; no per-chunk events. This is a deliberate scope cut documented in spec Q3.
- **Model addressing is `<vendor>/<model>`.** SaaS modules validate the vendor prefix matches `module.json#capabilities.vendors[]`. Mismatch yields `AI_LLM_STRUCTURAL_VENDOR_MISMATCH`. Gateways use the prefix to route.
- **Idempotency required on every Command.** `context.idempotency_key` missing → `AI_LLM_STRUCTURAL_MISSING_IDEMPOTENCY_KEY`. SaaS modules must implement an internal dedup-store with at least 24h TTL since major LLM vendors do not provide native idempotency.
- **Thread is delegated-only.** Modules without native stateful support (Anthropic, Gemini, gateway) declare `thread: false` and return `UNIMPLEMENTED` for thread RPCs. No emulation in module storage.
- **`tool_calls.arguments` is `google.protobuf.Struct`,** not a string. Modules parse vendor-stringified JSON before publishing.
- **`vendor_raw` is on every aggregate, not on helpers.** `Completion`, `AssistantThread`, `ThreadItem`, `ThreadRun`, `AsyncJob` carry it. `TokenUsage`, `ToolCall`, `ContentBlock` do not.

### Capability fields (`module.json#capabilities`)

This contract introduces six capability fields. Until `module-manifest-validator` lands (modules-monorepo plan 1), these are documented here:

```json
{
  "capabilities": {
    "vendors": ["openai"],                                         // string[], required, ≥1 entry
    "rpcs": ["Complete", "GetCompletion", ...],                    // string[], subset of EXPECTED_RPCS
    "events": ["CompletionStarted", ...],                          // string[], subset of EXPECTED_EVENTS
    "input_modalities": ["text", "image", "audio", "file"],        // string[], subset of canonical 4
    "reasoning_visibility_supported": ["hidden", "summary"],       // string[], subset of {"hidden","summary","full"}
    "thread": true,                                                 // boolean, true requires all 8 thread RPCs declared
    "async_job_types": ["BATCH_COMPLETION"],                       // string[], subset of declared AsyncJobType canonical values
    "agent_execution_mode": "none"                                  // "delegated" | "local" | "none"
  }
}
```

## Out of scope

- Streaming RPCs and per-chunk events (added in v1.minor).
- Embedding, Vector, KnowledgeBase, Agent, Tool-registry, SafetyGuardrail (separate categories).
- Fine-tuning / model lifecycle / eval (separate categories).
- AsyncJob types beyond `BATCH_COMPLETION` (added v1.minor with ≥2 vendors per type).
- Realtime API (separate brainstorm).

## Where to look first

- `proto/ai_llm.proto` — start at `service AiLlmModule` to see the surface; aggregates above; helpers and ContentBlock above that; enums at the top.
- `proto/ai_llm-events.proto` — all 16 events.
- `error-codes.json` — error-code set.
- `test/service-shape.test.ts` — drift detector and authoritative list of canonical RPC + event short-names.

## Specs

- `docs/history/specs/historical/2026-04-26-ai-llm-canonical-contract-design.md` — design.
- `docs/history/specs/active-rationale/2026-04-26-modules-monorepo-structure-design.md` — directory layout, capability-based UNION conformance.
- `docs/history/specs/historical/2026-04-26-identity-canonical-contract-design.md` — sibling spec by the same template.
- `docs/history/plans/historical/ai-llm-canonical-contract/01-ai-llm-contracts.md` — this plan.
- `docs/history/plans/historical/ai-llm-canonical-contract/02-ai-llm-conformance-skeleton.md` — companion plan for conformance package.
```

- [ ] **Step 2: Commit**

```bash
git add packages/contracts/ai-llm/v1/README.md
git commit -m "docs(contracts-ai-llm-v1): per-package README"
```

---

## Task 13: Documentation-touch — `AGENTS.md`

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: Read current `AGENTS.md` §3 (layering) and find Identity's entry**

Run: `grep -n "packages/contracts/identity\|packages/contracts/_common" AGENTS.md`

You should see lines added by Identity plan 1. Identify the section and the form of the entries.

- [ ] **Step 2: Add `packages/contracts/ai-llm/v1/` entry under §3**

Insert next to Identity's entries (alphabetical inside the contracts subsection). The line should mirror Identity's wording. Locate Identity's entry — it likely reads something like:

```
- packages/contracts/identity/v1/      — canonical Identity contract (User, Organization, Membership, Invitation, Session)
```

Add after it:

```
- packages/contracts/ai-llm/v1/        — canonical AI/LLM contract (Completion, AssistantThread, AsyncJob; 16 events; MCP-shape tools)
```

- [ ] **Step 3: Add glossary entries to §10**

Locate §10 (glossary). Insert these entries in alphabetical order; preserve any existing identity-specific terms inserted by Identity plan 1:

```markdown
- **agent_execution_mode** — capability flag in `module.json` for AI/LLM modules: `"delegated"` (vendor SaaS owns the agent loop, e.g. OpenAI Responses), `"local"` (module hosts an in-process agent runtime, e.g. future LangGraph/CrewAI modules), `"none"` (module does not implement Agent surface). Reserved in AI/LLM v1 to keep the door open for `local`-mode modules in v2+ without a major bump.

- **boundary-event-only streaming** — AI/LLM v1's design rule that CloudEvents are emitted only at state transitions (`started` / `finished` / `failed` / `requires_action`), never per-chunk. Token-level streaming, when added in v1.minor, will use a server-streaming gRPC RPC (`CompleteStream`) — the event log stays for state, not bytes.

- **canonical AI/LLM contract** — `@rntme/contracts-ai-llm-v1`: service `AiLlmModule`, 3 aggregates (Completion / AssistantThread / AsyncJob), 16 events. The wrapper protocol every AI/LLM vendor module implements.

- **delegated thread** — AI/LLM v1's design rule that stateful conversation is supported only by modules whose vendor offers a native stateful API (OpenAI Responses+Conversations, Bedrock Agents). Modules without it declare `capabilities.thread: false` and return `UNIMPLEMENTED` for thread RPCs. No emulation in module storage; no fallback to domain emulation.

- **MCP-shape tool definition** — `ToolDefinition { name, description, input_schema: Struct, strict }` matching the Model Context Protocol shape. Adapter modules convert into the vendor-native format (OpenAI tagged, Anthropic input_schema, Gemini functionDeclarations).

- **vendor-prefixed model addressing** — model field convention `<vendor>/<model>` (e.g. `"openai/gpt-4o"`, `"anthropic/claude-sonnet-4-5"`). SaaS modules validate the prefix matches their declared vendor; gateway modules use it to route. Standard adopted from LiteLLM / OpenRouter / Bifrost.
```

- [ ] **Step 4: Add a how-to entry to §6 if Identity plan 1 added one for "Add a category contract"**

Run: `grep -n "Add a category contract\|Add an Identity\|Add a contract" AGENTS.md`

If Identity added a "6.17 Add a category contract package" how-to (see Identity plan 1 task 11), no new entry is needed — that recipe already covers AI/LLM. Verify by reading the section: it should be category-agnostic. If it has Identity-specific assumptions, replace with category-agnostic wording.

If Identity did NOT add such a how-to, add one to §6:

```markdown
### 6.17 Add a category contract package

The pattern is fixed by the modules-monorepo spec and Identity v1 / AI/LLM v1 plans. Every category lands as a leaf workspace package at `packages/contracts/<category>/v<n>/` with this shape:

- `proto/<category>.proto` — service, entities, enums, request/response.
- `proto/<category>-events.proto` — event payloads.
- `error-codes.json` — `<CATEGORY>_<LAYER>_<KIND>` set.
- `scripts/gen.mjs` — `pbjs`/`pbts` driver. Cross-package proto imports use the `proto-deps/` symlink tree from `ai-llm/v1` plan 1 task 7.
- `src/proto.gen.{js,d.ts}` — generated; tracked; `.gitattributes` marks linguist-generated=true.
- `src/index.ts` — barrel re-export.
- `src/error-codes.ts` — typed re-export of JSON.
- `test/{entities,events,error-codes,service-shape}.test.ts` — round-trip + drift detection.
- Per-package README following the standard template (File map / Quick start / API / Invariants / Out of scope / Where to look first / Specs).

Reference plans:
- `docs/history/plans/historical/identity-canonical-contract/01-common-and-identity-contracts.md` — first category.
- `docs/history/plans/historical/ai-llm-canonical-contract/01-ai-llm-contracts.md` — second category, shows cross-package proto import pattern.
```

- [ ] **Step 5: Commit**

```bash
git add AGENTS.md
git commit -m "docs(AGENTS): layering + glossary + how-to for ai-llm contract"
```

---

## Task 14: Documentation-touch — root `README.md` packages table

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Locate the packages table**

Run: `grep -n "@rntme/contracts-identity-v1\|@rntme/contracts-common-v1\|## Packages\|## Workspace packages" README.md`

You should see entries added by Identity plan 1.

- [ ] **Step 2: Append the AI/LLM contract package row**

Add a row matching the table format used by Identity. The row should look like (adjust columns to match the existing schema):

```markdown
| `@rntme/contracts-ai-llm-v1` | Canonical AI/LLM contract (Completion, AssistantThread, AsyncJob; 16 events; MCP-shape tools) |
```

If the table has more columns (e.g. `Stage`, `Owner`), match exactly what Identity's row uses.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs(README): list @rntme/contracts-ai-llm-v1 in packages table"
```

---

## Task 15: Final cross-package verification

**Files:** none (verification only).

- [ ] **Step 1: Run full workspace build**

Run: `pnpm -r run build`
Expected: every package builds, including `@rntme/contracts-ai-llm-v1`.

- [ ] **Step 2: Run full workspace tests**

Run: `pnpm -r run test`
Expected: every test passes. AI/LLM has ~51 test cases (16 entity + 9 content-block + 16 event + 6 error-code + 5 service-shape).

- [ ] **Step 3: Run full workspace lint**

Run: `pnpm -r run lint`
Expected: zero errors.

- [ ] **Step 4: Run full workspace typecheck**

Run: `pnpm -r run typecheck`
Expected: zero errors.

- [ ] **Step 5: Confirm Identity package not touched**

Run: `git log --since="<start-of-this-plan>" -- packages/contracts/identity/v1/ packages/contracts/_common/v1/`
Expected: empty (no commits in this plan touched Identity v1 or `_common/v1/`).

- [ ] **Step 6: Confirm spec coverage**

Run a quick mental cross-check against `docs/history/specs/historical/2026-04-26-ai-llm-canonical-contract-design.md`:
- §4 layout — `packages/contracts/ai-llm/v1/` exists with the right structure ✓
- §5 status enums — 8 enums in proto, tested ✓
- §6 helper types — 7 helper messages in proto, tested ✓
- §7 ContentBlock — oneof with 7 variants, tested ✓
- §8 aggregates — 3 aggregates + ThreadItem + ThreadRun + BatchCompletion payloads, tested ✓
- §9 service — 14 RPCs in service, RPC→event-fixture mapping drift-tested ✓
- §10 events — 16 event payloads, tested ✓
- §11 error codes — 32 codes in JSON, lint-tested ✓
- §14 dependencies — package depends on `@rntme/contracts-common-v1` (workspace:*) ✓

- [ ] **Step 7: Final commit (if any leftover staging)**

If `git status` is clean, no commit needed. Otherwise:

```bash
git add -A
git commit -m "chore(contracts-ai-llm-v1): final cross-package verification"
```

---

## Self-review checklist

Run this checklist after the last task and before closing the PR:

1. **Spec coverage:** Every section §4–§11 in the spec has a corresponding task above. Confirmed in Task 15 step 6.
2. **Placeholder scan:** Search the plan body for `TBD`, `TODO`, `FIXME`, `XXX`, `placeholder`. None should appear except in the §11 explanation that documents how validator extension is deferred.
3. **Type consistency:** RPC names in Task 5 match `EXPECTED_RPCS` and `EXPECTED_RPC_EVENT_FIXTURE_NAMES` in Task 11; event names in Task 6 match `EXPECTED_EVENTS` in Task 11; error codes in Task 8 match the count assertion in Task 11.
4. **Cross-task naming:** `proto.rntme.contracts.ai_llm.v1` namespace used uniformly across Tasks 7, 9, 10, 11. `@rntme/contracts-ai-llm-v1` package name uniform across Tasks 1, 2, 7, 12.

If any check fails: fix inline, re-run the affected task's tests.
