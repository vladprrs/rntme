# AI/LLM Canonical Contract v1 — Plan 2: `modules/ai-llm/conformance/` Skeleton Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land `modules/ai-llm/README.md` (category-doc) and `modules/ai-llm/conformance/` (workspace package `@rntme/conformance-ai-llm`) — the per-category conformance scaffolding for AI/LLM v1. The package ships a minimal local `Scenario` type stub (until `@rntme/conformance-framework` lands), 14 scenario stub files (one per canonical RPC), text + binary fixtures (including `sample.png`, `sample.mp3`, `sample.pdf` for multimodal scenarios), a `suite.ts` exporting `aiLlmConformanceSuite`, and a drift-detection test that fails when any canonical RPC lacks a matching scenarios file.

**Architecture:** New `modules/ai-llm/` directory under the existing `modules/*/*` workspace glob (added by Identity plan 2). Inside, `modules/ai-llm/conformance/` is a workspace package depending on `@rntme/contracts-ai-llm-v1`. The package mirrors the already-merged Identity conformance shape: `CategoryConformanceSuite` uses `contractVersion` and `scenariosByRpc`, `src/index.ts` re-exports a named `aiLlmConformanceSuite`, and package test/build scripts build contract dependencies before running. Every scenario file ships an empty `ReadonlyArray<Scenario>` plus a docstring pointing at spec §12.2 listing the assertions each scenario must cover when the framework lands. The drift-detection test introspects `proto.rntme.contracts.ai_llm.v1.AiLlmModule` and asserts a 1:1 file match against `src/scenarios/`. A separate fixture-sanity test validates the binary media files.

**Tech Stack:** Same as Plan 1 and merged Identity conformance — TypeScript 5.5, vitest, eslint flat config via `@eslint/js`, pnpm 9.12+ workspaces. Context7 check (2026-04-27): Vitest supports `vitest run <file>`; ESLint v9 flat config uses `@eslint/js` for `js.configs.recommended`.

**Spec reference:** `docs/superpowers/specs/2026-04-26-ai-llm-canonical-contract-design.md` §12 (conformance suite). Modules-monorepo `docs/superpowers/specs/2026-04-26-modules-monorepo-structure-design.md` §7 (conformance suite layout, authorship rule, anti-conformance, capability-coverage report).

**Depends on:**
- Plan 1 must be merged first — `@rntme/contracts-ai-llm-v1` must exist as a workspace package and its generated proto must export `AiLlmModule` so the drift-detection test can introspect it.
- Identity plan 2 (`docs/superpowers/plans/done/identity-canonical-contract/02-identity-conformance-skeleton.md`) must be merged first — it adds the `modules/*/*` glob to `pnpm-workspace.yaml`, creates the `modules/` top-level directory, and establishes the conformance package shape this plan follows. This plan reuses those conventions. If Identity plan 2 has not landed in a downstream branch, Step 1 of Task 1 below adds the glob; otherwise it verifies and skips.

---

## File Structure

Files this plan creates or modifies:

**Created**
- `modules/ai-llm/README.md`
- `modules/ai-llm/conformance/package.json`
- `modules/ai-llm/conformance/tsconfig.json`
- `modules/ai-llm/conformance/tsconfig.check.json`
- `modules/ai-llm/conformance/eslint.config.mjs`
- `modules/ai-llm/conformance/vitest.config.ts`
- `modules/ai-llm/conformance/README.md`
- `modules/ai-llm/conformance/src/types.ts` (local `Scenario` / `CategoryConformanceSuite` stub)
- `modules/ai-llm/conformance/src/capabilities.ts` (canonical capability lists for module authors and reports)
- `modules/ai-llm/conformance/src/index.ts`
- `modules/ai-llm/conformance/src/suite.ts`
- `modules/ai-llm/conformance/src/fixtures/messages.ts`
- `modules/ai-llm/conformance/src/fixtures/content-blocks.ts`
- `modules/ai-llm/conformance/src/fixtures/tools.ts`
- `modules/ai-llm/conformance/src/fixtures/threads.ts`
- `modules/ai-llm/conformance/src/fixtures/batch-items.ts`
- `modules/ai-llm/conformance/src/fixtures/media/sample.png` (binary; ≤100KB)
- `modules/ai-llm/conformance/src/fixtures/media/sample.mp3` (binary; ≤100KB)
- `modules/ai-llm/conformance/src/fixtures/media/sample.pdf` (binary; ≤100KB)
- `modules/ai-llm/conformance/src/fixtures/media/index.ts`
- `modules/ai-llm/conformance/src/scenarios/Complete.scenarios.ts`
- `modules/ai-llm/conformance/src/scenarios/GetCompletion.scenarios.ts`
- `modules/ai-llm/conformance/src/scenarios/CreateThread.scenarios.ts`
- `modules/ai-llm/conformance/src/scenarios/GetThread.scenarios.ts`
- `modules/ai-llm/conformance/src/scenarios/DeleteThread.scenarios.ts`
- `modules/ai-llm/conformance/src/scenarios/AddMessage.scenarios.ts`
- `modules/ai-llm/conformance/src/scenarios/ListThreadItems.scenarios.ts`
- `modules/ai-llm/conformance/src/scenarios/RunThread.scenarios.ts`
- `modules/ai-llm/conformance/src/scenarios/GetThreadRun.scenarios.ts`
- `modules/ai-llm/conformance/src/scenarios/CancelThreadRun.scenarios.ts`
- `modules/ai-llm/conformance/src/scenarios/SubmitJob.scenarios.ts`
- `modules/ai-llm/conformance/src/scenarios/GetJob.scenarios.ts`
- `modules/ai-llm/conformance/src/scenarios/CancelJob.scenarios.ts`
- `modules/ai-llm/conformance/src/scenarios/ListJobs.scenarios.ts`
- `modules/ai-llm/conformance/test/drift.test.ts`
- `modules/ai-llm/conformance/test/suite-shape.test.ts`
- `modules/ai-llm/conformance/test/fixtures-sanity.test.ts`

**Modified**
- `pnpm-workspace.yaml` — verify `modules/*/*` glob exists (added by Identity plan 2); add if missing.
- `AGENTS.md` — §3 add `modules/ai-llm/` note; §6 entry "Add an AI/LLM vendor module" stub pointer.
- `README.md` — packages table: append `@rntme/conformance-ai-llm`.

---

## Task 1: Workspace bootstrap — verify globs, create `modules/ai-llm/` tree

**Files:**
- Modify: `pnpm-workspace.yaml` (only if `modules/*/*` glob is missing)
- Create: `modules/ai-llm/conformance/.gitkeep`

- [ ] **Step 1: Check current `pnpm-workspace.yaml`**

Run: `cat pnpm-workspace.yaml`

If the output already includes `- "modules/*/*"`, proceed to Step 3. If not (Identity plan 2 hasn't landed yet), continue to Step 2.

- [ ] **Step 2 (only if `modules/*/*` is missing): Add the glob**

Edit `pnpm-workspace.yaml` to insert `- "modules/*/*"` between `packages/contracts/*/v*` and `demo/*`:

```yaml
packages:
  - "packages/*"
  - "packages/contracts/*/v*"
  - "modules/*/*"
  - "demo/*"
  - "rntme-cli/packages/*"
```

The `modules/*/*` glob matches `modules/ai-llm/conformance` (this plan), `modules/identity/conformance` (Identity plan 2), and future vendor packages like `modules/ai-llm/openai`, `modules/identity/clerk`, etc. Two-level depth is the published convention in modules-monorepo §5.1.

- [ ] **Step 3: Create the AI/LLM module tree**

Run:
```bash
mkdir -p modules/ai-llm/conformance/src/scenarios
mkdir -p modules/ai-llm/conformance/src/fixtures/media
mkdir -p modules/ai-llm/conformance/test
touch modules/ai-llm/conformance/.gitkeep
```

(`modules/ai-llm/` itself does not get a `package.json` — it is a category container. Only `modules/ai-llm/conformance/` and future vendor subdirs are workspace packages.)

- [ ] **Step 4: Verify pnpm still installs cleanly**

Run: `pnpm install --frozen-lockfile=false`
Expected: install succeeds. The empty `modules/ai-llm/conformance` directory has no `package.json` yet.

- [ ] **Step 5: Commit**

```bash
git add pnpm-workspace.yaml modules/ai-llm/conformance/.gitkeep
git commit -m "chore: bootstrap modules/ai-llm/ tree for conformance package"
```

If Step 2 was skipped (glob already present), `pnpm-workspace.yaml` will not be in the staged set — that is fine.

---

## Task 2: Category README at `modules/ai-llm/README.md`

**Files:**
- Create: `modules/ai-llm/README.md`

- [ ] **Step 1: Write the category README**

Create `modules/ai-llm/README.md`:

```markdown
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

- `docs/superpowers/specs/2026-04-26-ai-llm-canonical-contract-design.md` — canonical contract design.
- `docs/superpowers/specs/2026-04-26-modules-monorepo-structure-design.md` — module pattern, capability UNION conformance.

## Where to look first

- `modules/ai-llm/conformance/src/scenarios/` — full list of scenarios per RPC (one file per canonical RPC).
- `packages/contracts/ai-llm/v1/proto/ai_llm.proto` — the contract you implement.
- `packages/contracts/ai-llm/v1/error-codes.json` — error codes you map vendor errors to.
```

- [ ] **Step 2: Commit**

```bash
git add modules/ai-llm/README.md
git commit -m "docs(modules/ai-llm): category README"
```

---

## Task 3: `@rntme/conformance-ai-llm` package skeleton

**Files:**
- Create: `modules/ai-llm/conformance/package.json`
- Create: `modules/ai-llm/conformance/tsconfig.json`
- Create: `modules/ai-llm/conformance/tsconfig.check.json`
- Create: `modules/ai-llm/conformance/eslint.config.mjs`
- Delete: `modules/ai-llm/conformance/.gitkeep`

- [ ] **Step 1: Write `package.json`**

Create `modules/ai-llm/conformance/package.json`:

```json
{
  "name": "@rntme/conformance-ai-llm",
  "version": "0.0.0",
  "type": "module",
  "private": true,
  "description": "Conformance scenarios for AI/LLM canonical contract v1. Consumed by every modules/ai-llm/<vendor>/ module via the conformance runner.",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": [
    "dist",
    "src/fixtures/media",
    "README.md"
  ],
  "scripts": {
    "build": "pnpm run build:deps && tsc -p tsconfig.json",
    "build:deps": "pnpm --dir ../../../packages/contracts/_common/v1 run build && pnpm --dir ../../../packages/contracts/ai-llm/v1 run build",
    "test": "pnpm run build:deps && vitest run",
    "test:watch": "vitest",
    "typecheck": "pnpm run build:deps && tsc -p tsconfig.check.json",
    "lint": "eslint \"src/**/*.ts\" \"test/**/*.ts\""
  },
  "dependencies": {
    "@rntme/contracts-ai-llm-v1": "workspace:*",
    "@rntme/contracts-common-v1": "workspace:*"
  },
  "devDependencies": {
    "@eslint/js": "^9.10.0",
    "@types/node": "^20.14.0",
    "@typescript-eslint/eslint-plugin": "^8.6.0",
    "@typescript-eslint/parser": "^8.6.0",
    "eslint": "^9.10.0",
    "typescript": "^5.5.4",
    "vitest": "^2.1.1"
  }
}
```

- [ ] **Step 2: Write `tsconfig.json`**

Create `modules/ai-llm/conformance/tsconfig.json`:

```json
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "composite": false
  },
  "include": ["src/**/*.ts"],
  "exclude": ["dist", "node_modules", "test"]
}
```

- [ ] **Step 3: Write `tsconfig.check.json`**

Create `modules/ai-llm/conformance/tsconfig.check.json`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "rootDir": ".",
    "noEmit": true,
    "composite": false,
    "module": "ESNext",
    "moduleResolution": "Bundler"
  },
  "include": ["src/**/*.ts", "test/**/*.ts"],
  "exclude": ["dist", "node_modules"]
}
```

- [ ] **Step 4: Write `eslint.config.mjs`**

Create `modules/ai-llm/conformance/eslint.config.mjs`:

```javascript
import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

export default [
  { ignores: ['dist/**', 'node_modules/**'] },
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

- [ ] **Step 5: Write `vitest.config.ts`**

Create `modules/ai-llm/conformance/vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    reporters: 'default',
    testTimeout: 15_000,
  },
});
```

This mirrors `modules/identity/conformance/vitest.config.ts` and keeps package-local test discovery explicit.

- [ ] **Step 6: Remove `.gitkeep`**

Run: `rm modules/ai-llm/conformance/.gitkeep`

- [ ] **Step 7: Run pnpm install and confirm package is in workspace**

Run: `pnpm install --frozen-lockfile=false`

Then: `pnpm list -r --depth -1 | grep conformance-ai-llm`
Expected: line containing `@rntme/conformance-ai-llm 0.0.0`.

- [ ] **Step 8: Commit**

```bash
git add pnpm-lock.yaml modules/ai-llm/conformance/package.json modules/ai-llm/conformance/tsconfig.json modules/ai-llm/conformance/tsconfig.check.json modules/ai-llm/conformance/eslint.config.mjs modules/ai-llm/conformance/vitest.config.ts
git commit -m "feat(conformance-ai-llm): scaffold package"
```

---

## Task 4: Local `Scenario` / `CategoryConformanceSuite` types stub

**Files:**
- Create: `modules/ai-llm/conformance/src/types.ts`

- [ ] **Step 1: Write the types stub**

Create `modules/ai-llm/conformance/src/types.ts`:

```typescript
/**
 * Local stub of the contracts that @rntme/conformance-framework will
 * publish. Replace these with imports from the framework once it lands.
 *
 * Source-of-truth shape: docs/superpowers/specs/2026-04-26-modules-monorepo-structure-design.md §7.
 */

export type ScenarioStatus =
  | 'pending' // scaffold only; not yet implementable
  | 'mock_only' // runs against generic mock-vendor
  | 'live_only' // requires vendor sandbox secrets
  | 'mock_and_live'; // covers both

export interface ScenarioContext {
  readonly idempotencyKey: string;
  readonly correlationId: string;
}

export interface Scenario {
  /** Unique within its scenarios file. Convention: `{rpc}_{shortName}`. */
  readonly id: string;
  /** Human-readable purpose. */
  readonly description: string;
  /** When this scenario can run. */
  readonly status: ScenarioStatus;
  /** Pre-condition seed for the vendor (mock or live). */
  readonly seed?: () => Promise<void> | void;
  /** Action under test. */
  readonly action: (ctx: ScenarioContext) => Promise<unknown> | unknown;
  /** Assertions over the action's result. */
  readonly assertions: ReadonlyArray<(result: unknown, ctx: ScenarioContext) => Promise<void> | void>;
}

export interface CategoryConformanceSuite {
  readonly category: 'ai-llm';
  readonly contractVersion: 'v1';
  readonly scenariosByRpc: Readonly<Record<string, ReadonlyArray<Scenario>>>;
}

/**
 * Marker for stub scenarios that must be filled before the package
 * declares conformance against any real vendor. The runner from the
 * future framework reports these as `pending`.
 */
export const UNIMPLEMENTED_SCENARIO_STATUS: ScenarioStatus = 'pending';
```

- [ ] **Step 2: Commit**

```bash
git add modules/ai-llm/conformance/src/types.ts
git commit -m "feat(conformance-ai-llm): local Scenario / CategoryConformanceSuite stubs"
```

---

## Task 5: Fixtures — text, content-blocks, tools, threads, batch-items

**Files:**
- Create: `modules/ai-llm/conformance/src/fixtures/messages.ts`
- Create: `modules/ai-llm/conformance/src/fixtures/content-blocks.ts`
- Create: `modules/ai-llm/conformance/src/fixtures/tools.ts`
- Create: `modules/ai-llm/conformance/src/fixtures/threads.ts`
- Create: `modules/ai-llm/conformance/src/fixtures/batch-items.ts`

- [ ] **Step 1: `fixtures/messages.ts`**

Create `modules/ai-llm/conformance/src/fixtures/messages.ts`:

```typescript
/**
 * Canonical Message fixtures: short, deterministic, suitable for the generic
 * mock-vendor (which returns a fixed Completion shape) and acceptable for
 * live-vendor smoke runs (won't burn many tokens).
 */

export const userHello = {
  role: 'user' as const,
  content: [{ type: 1 /* TEXT */, text: { text: 'Hello' } }],
};

export const userMath = {
  role: 'user' as const,
  content: [{ type: 1 /* TEXT */, text: { text: 'What is 2+2?' } }],
};

export const userWeather = {
  role: 'user' as const,
  content: [{ type: 1 /* TEXT */, text: { text: "What's the weather in Berlin?" } }],
};

export const systemHelpful = {
  role: 'system' as const,
  content: [{ type: 1 /* TEXT */, text: { text: 'You are a helpful assistant.' } }],
};

export const assistantAck = {
  role: 'assistant' as const,
  content: [{ type: 1 /* TEXT */, text: { text: 'Got it.' } }],
};
```

- [ ] **Step 2: `fixtures/content-blocks.ts`**

Create `modules/ai-llm/conformance/src/fixtures/content-blocks.ts`:

```typescript
/**
 * One ContentBlock fixture per canonical type. media references in IMAGE / AUDIO / FILE
 * blocks point at the local binary fixtures from media/.
 */

import { samplePngUrl, sampleMp3Url, samplePdfUrl } from './media/index.js';

export const textBlock = { type: 1, text: { text: 'Hello, world!' } };

export const imageBlockUrl = {
  type: 2,
  image: { url: samplePngUrl, media_type: 'image/png' },
};

export const audioBlockUrl = {
  type: 3,
  audio: { url: sampleMp3Url, media_type: 'audio/mpeg', transcript: '' },
};

export const fileBlockUrl = {
  type: 4,
  file: { url: samplePdfUrl, media_type: 'application/pdf', filename: 'sample.pdf' },
};

export const toolUseBlock = {
  type: 5,
  tool_use: {
    id: 'tu_fixture_1',
    name: 'get_weather',
    arguments: { fields: { city: { stringValue: 'Berlin' } } },
  },
};

export const toolResultBlock = {
  type: 6,
  tool_result: {
    tool_call_id: 'tu_fixture_1',
    output: { fields: { temp_c: { numberValue: 18 } } },
    is_error: false,
  },
};

export const thinkingBlock = {
  type: 7,
  thinking: { text: 'Let me reason about this...', redacted: false },
};
```

- [ ] **Step 3: `fixtures/tools.ts`**

Create `modules/ai-llm/conformance/src/fixtures/tools.ts`:

```typescript
/**
 * MCP-shape tool definitions. input_schema is JSON Schema as a Struct.
 */

export const getWeatherTool = {
  name: 'get_weather',
  description: 'Get the current weather in a city.',
  input_schema: {
    fields: {
      type: { stringValue: 'object' },
      properties: {
        structValue: {
          fields: {
            city: {
              structValue: {
                fields: {
                  type: { stringValue: 'string' },
                  description: { stringValue: 'City name' },
                },
              },
            },
          },
        },
      },
      required: { listValue: { values: [{ stringValue: 'city' }] } },
    },
  },
  strict: true,
};

export const lookupUserTool = {
  name: 'lookup_user',
  description: 'Fetch user details by canonical id.',
  input_schema: {
    fields: {
      type: { stringValue: 'object' },
      properties: {
        structValue: {
          fields: {
            user_id: {
              structValue: {
                fields: {
                  type: { stringValue: 'string' },
                },
              },
            },
          },
        },
      },
      required: { listValue: { values: [{ stringValue: 'user_id' }] } },
    },
  },
  strict: true,
};
```

- [ ] **Step 4: `fixtures/threads.ts`**

Create `modules/ai-llm/conformance/src/fixtures/threads.ts`:

```typescript
/**
 * Thread / ThreadItem fixtures. Used by Thread.* scenarios.
 */

import { systemHelpful, userMath } from './messages.js';

export const supportThread = {
  title: 'Customer support session',
  initial_messages: [systemHelpful],
  metadata: {
    public: { fields: { tag: { stringValue: 'support' } } },
  },
};

export const mathThread = {
  title: 'Math tutor session',
  initial_messages: [systemHelpful, userMath],
};

export const emptyThread = {
  title: 'Empty thread',
  initial_messages: [],
};
```

- [ ] **Step 5: `fixtures/batch-items.ts`**

Create `modules/ai-llm/conformance/src/fixtures/batch-items.ts`:

```typescript
/**
 * BatchCompletionItem fixtures. Each carries a small canonical CreateCompletionRequest.
 * The vendor model is intentionally left as a placeholder that scenarios can override
 * (since vendor-prefix is module-specific).
 */

import { systemHelpful, userMath, userHello } from './messages.js';

export const tinyBatch = (vendorPrefix: string) => ({
  completion_window: '24h',
  items: [
    {
      custom_id: 'req_001',
      request: {
        context: {
          idempotency_key: 'batch-001',
          correlation_id: 'corr-batch-001',
          actor_user_id: 'system',
          actor_type: 'system',
        },
        model: `${vendorPrefix}/<smallest-model>`,
        messages: [systemHelpful, userMath],
      },
    },
    {
      custom_id: 'req_002',
      request: {
        context: {
          idempotency_key: 'batch-002',
          correlation_id: 'corr-batch-002',
          actor_user_id: 'system',
          actor_type: 'system',
        },
        model: `${vendorPrefix}/<smallest-model>`,
        messages: [userHello],
      },
    },
  ],
});

export const oversizedBatch = (vendorPrefix: string) => ({
  completion_window: '24h',
  items: Array.from({ length: 60_000 }, (_, i) => ({
    custom_id: `req_${i}`,
    request: {
      context: {
        idempotency_key: `oversize-${i}`,
        correlation_id: `corr-oversize-${i}`,
        actor_user_id: 'system',
        actor_type: 'system',
      },
      model: `${vendorPrefix}/<smallest-model>`,
      messages: [userHello],
    },
  })),
});
```

The `oversizedBatch` fixture is for the negative scenario `SubmitJob: AI_LLM_CONSISTENCY_BATCH_TOO_LARGE`.

- [ ] **Step 6: Commit**

```bash
git add modules/ai-llm/conformance/src/fixtures/messages.ts modules/ai-llm/conformance/src/fixtures/content-blocks.ts modules/ai-llm/conformance/src/fixtures/tools.ts modules/ai-llm/conformance/src/fixtures/threads.ts modules/ai-llm/conformance/src/fixtures/batch-items.ts
git commit -m "feat(conformance-ai-llm): text fixtures (messages, content-blocks, tools, threads, batch-items)"
```

---

## Task 6: Binary media fixtures

**Files:**
- Create: `modules/ai-llm/conformance/src/fixtures/media/sample.png`
- Create: `modules/ai-llm/conformance/src/fixtures/media/sample.mp3`
- Create: `modules/ai-llm/conformance/src/fixtures/media/sample.pdf`
- Create: `modules/ai-llm/conformance/src/fixtures/media/index.ts`

- [ ] **Step 1: Create `sample.png` — a tiny valid PNG**

A valid 1×1 white PNG is 67 bytes. Generate it via Node:

```bash
node -e "const fs=require('fs'); const b64='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='; fs.writeFileSync('modules/ai-llm/conformance/src/fixtures/media/sample.png', Buffer.from(b64, 'base64'));"
```

Verify:
```bash
ls -la modules/ai-llm/conformance/src/fixtures/media/sample.png
file modules/ai-llm/conformance/src/fixtures/media/sample.png
```
Expected: file ~67 bytes; `file` reports `PNG image data, 1 x 1, ...`.

- [ ] **Step 2: Create `sample.mp3` — a tiny silent MP3**

A 0.1-second silent MP3 (constant 32 kbps) is ~500 bytes. Generate via `ffmpeg` if available, or via this base64-encoded fixture (already silent, ~500 bytes):

```bash
node -e "
const fs = require('fs');
// Silent MP3 frame, ~0.026s at 32kbps. Tiny but valid.
const frame = Buffer.from([
  0xff, 0xfb, 0x10, 0x64,
  ...new Array(80).fill(0),
]);
// Pad to a few frames (~0.1s) so it's not suspicious to validators
const buf = Buffer.concat(Array.from({length: 4}, () => frame));
fs.writeFileSync('modules/ai-llm/conformance/src/fixtures/media/sample.mp3', buf);
"
```

If you have `ffmpeg` installed, prefer:
```bash
ffmpeg -f lavfi -i anullsrc=channel_layout=mono:sample_rate=8000 -t 0.1 -b:a 32k modules/ai-llm/conformance/src/fixtures/media/sample.mp3 -y
```

Verify:
```bash
ls -la modules/ai-llm/conformance/src/fixtures/media/sample.mp3
```
Expected: file ≤ 5 KB. If it exceeds 100 KB, regenerate with shorter duration / lower bitrate.

- [ ] **Step 3: Create `sample.pdf` — a minimal valid PDF**

A "Hello world" PDF is ~750 bytes:

```bash
cat > modules/ai-llm/conformance/src/fixtures/media/sample.pdf <<'EOF'
%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Count 1 /Kids [3 0 R] >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj
4 0 obj << /Length 44 >> stream
BT /F1 18 Tf 50 100 Td (Sample PDF) Tj ET
endstream endobj
5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
xref
0 6
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000112 00000 n
0000000218 00000 n
0000000311 00000 n
trailer << /Size 6 /Root 1 0 R >>
startxref
380
%%EOF
EOF
```

Verify:
```bash
ls -la modules/ai-llm/conformance/src/fixtures/media/sample.pdf
file modules/ai-llm/conformance/src/fixtures/media/sample.pdf
```
Expected: file ≤ 1 KB; `file` reports `PDF document, version 1.4`.

- [ ] **Step 4: Write `media/index.ts` — file URL helper**

Create `modules/ai-llm/conformance/src/fixtures/media/index.ts`:

```typescript
/**
 * URLs for the local binary fixtures. The mock-vendor accepts file:// URLs;
 * live-vendor runs upload via vendor file APIs and substitute the vendor_file_id.
 */

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

export const samplePngPath = resolve(here, 'sample.png');
export const sampleMp3Path = resolve(here, 'sample.mp3');
export const samplePdfPath = resolve(here, 'sample.pdf');

export const samplePngUrl = `file://${samplePngPath}`;
export const sampleMp3Url = `file://${sampleMp3Path}`;
export const samplePdfUrl = `file://${samplePdfPath}`;
```

- [ ] **Step 5: Commit**

```bash
git add modules/ai-llm/conformance/src/fixtures/media/sample.png modules/ai-llm/conformance/src/fixtures/media/sample.mp3 modules/ai-llm/conformance/src/fixtures/media/sample.pdf modules/ai-llm/conformance/src/fixtures/media/index.ts
git commit -m "feat(conformance-ai-llm): binary media fixtures (png/mp3/pdf) + URL helpers"
```

---

## Task 7: Scenario stubs — Completion (2 files)

**Files:**
- Create: `modules/ai-llm/conformance/src/scenarios/Complete.scenarios.ts`
- Create: `modules/ai-llm/conformance/src/scenarios/GetCompletion.scenarios.ts`

Each stub is a comment-rich placeholder. The `scenarios` array is empty — when the framework lands, scenarios are filled in. The structure is set up so a follow-up PR can add scenarios without touching scaffolding.

- [ ] **Step 1: `Complete.scenarios.ts`**

Create `modules/ai-llm/conformance/src/scenarios/Complete.scenarios.ts`:

```typescript
/**
 * Conformance scenarios for AiLlmModule.Complete.
 *
 * Spec § 12.2 mandates the following scenarios at minimum:
 *
 *   Happy path:
 *     - Complete: text-only single-turn (asserts: response shape, finish_reason=STOP|LENGTH,
 *       usage.input_tokens > 0, usage.output_tokens > 0, content[0].type=TEXT,
 *       CompletionFinished event published within 5s).
 *     - Complete: same idempotency_key returns same completion_id, no duplicate event.
 *
 *   Capability-flagged:
 *     - Complete: image input (requires input_modalities ⊇ ["image"]).
 *     - Complete: audio input (requires input_modalities ⊇ ["audio"]).
 *     - Complete: file input (requires input_modalities ⊇ ["file"]).
 *     - Complete: model returns tool_calls (asserts finish_reason=TOOL_CALLS,
 *       tool_calls[0].name matches input tool, arguments parses to expected struct).
 *     - Complete: reasoning with FULL visibility (requires reasoning_visibility_supported ⊇ ["full"];
 *       asserts usage.reasoning_tokens > 0, ContentBlock type=THINKING present).
 *     - Complete: reasoning with SUMMARY visibility (requires ⊇ ["summary"]).
 *
 *   Negative (structural):
 *     - Complete: missing model returns AI_LLM_STRUCTURAL_MISSING_MODEL.
 *     - Complete: missing idempotency_key returns AI_LLM_STRUCTURAL_MISSING_IDEMPOTENCY_KEY.
 *     - Complete: empty messages returns AI_LLM_STRUCTURAL_EMPTY_MESSAGES.
 *     - Complete: foreign vendor prefix returns AI_LLM_STRUCTURAL_VENDOR_MISMATCH.
 *     - Complete: invalid tool schema returns AI_LLM_STRUCTURAL_INVALID_TOOL_SCHEMA.
 *
 *   Negative (consistency):
 *     - Complete: audio block when input_modalities ⊉ ["audio"] returns
 *       AI_LLM_CONSISTENCY_UNSUPPORTED_MODALITY.
 *     - Complete: REASONING_VISIBILITY_FULL when reasoning_visibility_supported ⊉ ["full"]
 *       returns AI_LLM_CONSISTENCY_UNSUPPORTED_REASONING_VISIBILITY.
 *
 * Scenarios are empty in v1 skeleton — the runner does not yet exist. When
 * @rntme/conformance-framework lands, replace this array with concrete Scenario
 * objects per spec §12.2 and the framework's assertion DSL.
 */

import type { Scenario } from '../types.js';

export const scenarios: ReadonlyArray<Scenario> = [];
```

- [ ] **Step 2: `GetCompletion.scenarios.ts`**

Create `modules/ai-llm/conformance/src/scenarios/GetCompletion.scenarios.ts`:

```typescript
/**
 * Conformance scenarios for AiLlmModule.GetCompletion.
 *
 * Spec § 12.2 mandates:
 *
 *   Happy path:
 *     - GetCompletion: returns canonical Completion shape for a previously-Completed canonical_id
 *       (only when vendor retains; gateway and Anthropic likely return UNIMPLEMENTED here —
 *       enforced via anti-conformance, see modules-monorepo §7.3).
 *
 *   Negative:
 *     - GetCompletion: unknown canonical_id returns AI_LLM_REFERENCES_COMPLETION_NOT_FOUND.
 *
 * Scenarios are empty in v1 skeleton.
 */

import type { Scenario } from '../types.js';

export const scenarios: ReadonlyArray<Scenario> = [];
```

- [ ] **Step 3: Commit**

```bash
git add modules/ai-llm/conformance/src/scenarios/Complete.scenarios.ts modules/ai-llm/conformance/src/scenarios/GetCompletion.scenarios.ts
git commit -m "feat(conformance-ai-llm): completion scenario stubs (2 files)"
```

---

## Task 8: Scenario stubs — Thread (8 files)

**Files:**
- Create: `modules/ai-llm/conformance/src/scenarios/CreateThread.scenarios.ts`
- Create: `modules/ai-llm/conformance/src/scenarios/GetThread.scenarios.ts`
- Create: `modules/ai-llm/conformance/src/scenarios/DeleteThread.scenarios.ts`
- Create: `modules/ai-llm/conformance/src/scenarios/AddMessage.scenarios.ts`
- Create: `modules/ai-llm/conformance/src/scenarios/ListThreadItems.scenarios.ts`
- Create: `modules/ai-llm/conformance/src/scenarios/RunThread.scenarios.ts`
- Create: `modules/ai-llm/conformance/src/scenarios/GetThreadRun.scenarios.ts`
- Create: `modules/ai-llm/conformance/src/scenarios/CancelThreadRun.scenarios.ts`

All eight are gated by `requires: { thread: true }`. Modules with `thread: false` skip them all. Anti-conformance separately verifies that `thread: false` modules return `UNIMPLEMENTED`.

- [ ] **Step 1: `CreateThread.scenarios.ts`**

Create `modules/ai-llm/conformance/src/scenarios/CreateThread.scenarios.ts`:

```typescript
/**
 * Conformance scenarios for AiLlmModule.CreateThread (capability: thread=true).
 *
 * Spec § 12.2:
 *   Happy path:
 *     - CreateThread: empty thread (no initial_messages) — asserts ThreadCreated event
 *       with initial_message_count=0, status=ACTIVE.
 *     - CreateThread: with initial_messages — asserts initial_message_count matches.
 *     - CreateThread: idempotency replay returns same thread_id, no duplicate event.
 *
 *   Negative:
 *     - CreateThread: missing idempotency_key returns AI_LLM_STRUCTURAL_MISSING_IDEMPOTENCY_KEY.
 *
 * Scenarios are empty in v1 skeleton.
 */

import type { Scenario } from '../types.js';

export const scenarios: ReadonlyArray<Scenario> = [];
```

- [ ] **Step 2: `GetThread.scenarios.ts`**

Create `modules/ai-llm/conformance/src/scenarios/GetThread.scenarios.ts`:

```typescript
/**
 * Conformance scenarios for AiLlmModule.GetThread (capability: thread=true).
 *
 * Spec § 12.2:
 *   Happy path:
 *     - GetThread: returns canonical AssistantThread shape for an existing thread.
 *
 *   Negative:
 *     - GetThread: unknown canonical_id returns AI_LLM_REFERENCES_THREAD_NOT_FOUND.
 *
 * Scenarios are empty in v1 skeleton.
 */

import type { Scenario } from '../types.js';

export const scenarios: ReadonlyArray<Scenario> = [];
```

- [ ] **Step 3: `DeleteThread.scenarios.ts`**

Create `modules/ai-llm/conformance/src/scenarios/DeleteThread.scenarios.ts`:

```typescript
/**
 * Conformance scenarios for AiLlmModule.DeleteThread (capability: thread=true).
 *
 * Spec § 12.2:
 *   Happy path:
 *     - DeleteThread soft: returns thread with status=DELETED, deleted_at set,
 *       ThreadDeleted event with hard_delete=false.
 *     - DeleteThread hard: returns terminal thread, ThreadDeleted with hard_delete=true
 *       (only on vendors with native hard-delete; otherwise expect
 *       AI_LLM_CONSISTENCY_UNSUPPORTED_HARD_DELETE).
 *     - DeleteThread idempotency replay returns same final state, no duplicate event.
 *
 *   Negative:
 *     - DeleteThread: unknown canonical_id returns AI_LLM_REFERENCES_THREAD_NOT_FOUND.
 *
 * Scenarios are empty in v1 skeleton.
 */

import type { Scenario } from '../types.js';

export const scenarios: ReadonlyArray<Scenario> = [];
```

- [ ] **Step 4: `AddMessage.scenarios.ts`**

Create `modules/ai-llm/conformance/src/scenarios/AddMessage.scenarios.ts`:

```typescript
/**
 * Conformance scenarios for AiLlmModule.AddMessage (capability: thread=true).
 *
 * Spec § 12.2:
 *   Happy path:
 *     - AddMessage user role: returns ThreadItem with role=user, run_id="",
 *       ThreadMessageAdded event published.
 *     - AddMessage tool role with tool_result content: only valid in REQUIRES_ACTION
 *       state of an open run; otherwise AI_LLM_CONSISTENCY_RUN_NOT_REQUIRES_ACTION
 *       OR AI_LLM_CONSISTENCY_TOOL_RESULT_MISMATCH.
 *
 *   Capability-flagged:
 *     - AddMessage with image content (requires input_modalities ⊇ ["image"]).
 *     - AddMessage with audio content (requires input_modalities ⊇ ["audio"]).
 *     - AddMessage with file content (requires input_modalities ⊇ ["file"]).
 *
 *   Negative:
 *     - AddMessage to deleted thread returns AI_LLM_CONSISTENCY_THREAD_DELETED.
 *     - AddMessage to unknown thread returns AI_LLM_REFERENCES_THREAD_NOT_FOUND.
 *     - AddMessage with tool_result whose tool_call_id is unknown returns
 *       AI_LLM_CONSISTENCY_TOOL_RESULT_MISMATCH.
 *
 * Scenarios are empty in v1 skeleton.
 */

import type { Scenario } from '../types.js';

export const scenarios: ReadonlyArray<Scenario> = [];
```

- [ ] **Step 5: `ListThreadItems.scenarios.ts`**

Create `modules/ai-llm/conformance/src/scenarios/ListThreadItems.scenarios.ts`:

```typescript
/**
 * Conformance scenarios for AiLlmModule.ListThreadItems (capability: thread=true).
 *
 * Spec § 12.2:
 *   Happy path:
 *     - ListThreadItems: returns items in created_at DESC order by default.
 *     - ListThreadItems: limit=N returns at most N items, has_more accurate.
 *     - ListThreadItems: cursor pagination round-trip yields full set without dupes.
 *     - ListThreadItems: after_item_id shortcut returns items strictly after that id.
 *
 *   Negative:
 *     - ListThreadItems: unknown thread_id returns AI_LLM_REFERENCES_THREAD_NOT_FOUND.
 *
 * Scenarios are empty in v1 skeleton.
 */

import type { Scenario } from '../types.js';

export const scenarios: ReadonlyArray<Scenario> = [];
```

- [ ] **Step 6: `RunThread.scenarios.ts`**

Create `modules/ai-llm/conformance/src/scenarios/RunThread.scenarios.ts`:

```typescript
/**
 * Conformance scenarios for AiLlmModule.RunThread (capability: thread=true).
 *
 * Spec § 12.2 — RunThread is the most complex multi-step scenario.
 *
 *   Happy path:
 *     - Thread: full tool-call cycle:
 *         steps:
 *           1. CreateThread
 *           2. AddMessage(user, "What is the weather in Berlin?")
 *           3. RunThread(tools=[get_weather])
 *           4. assertEventWithin: ThreadRunRequiresAction (30s)
 *           5. AddMessage(role=tool, ContentBlock{tool_result, tool_call_id matches event})
 *           6. RunThread()  // same thread, new run
 *           7. assertEventWithin: ThreadRunCompleted (30s)
 *
 *     - RunThread plain: simple run without tools, asserts ThreadRunCompleted with
 *       new_items containing assistant message.
 *
 *   Negative:
 *     - RunThread: unknown thread_id returns AI_LLM_REFERENCES_THREAD_NOT_FOUND.
 *     - RunThread: thread with status=DELETED returns AI_LLM_CONSISTENCY_THREAD_DELETED.
 *
 *   Capability-flagged:
 *     - RunThread with reasoning_effort=HIGH (requires reasoning_visibility_supported
 *       to include hidden at minimum).
 *
 * Scenarios are empty in v1 skeleton; the multi-step Thread tool-cycle is the canonical
 * acceptance test for this RPC and lands first when the framework gains step+substitution
 * support ($1.canonical_id).
 */

import type { Scenario } from '../types.js';

export const scenarios: ReadonlyArray<Scenario> = [];
```

- [ ] **Step 7: `GetThreadRun.scenarios.ts`**

Create `modules/ai-llm/conformance/src/scenarios/GetThreadRun.scenarios.ts`:

```typescript
/**
 * Conformance scenarios for AiLlmModule.GetThreadRun (capability: thread=true).
 *
 * Spec § 12.2:
 *   Happy path:
 *     - GetThreadRun: returns canonical ThreadRun shape with current status.
 *
 *   Negative:
 *     - GetThreadRun: unknown thread_id returns AI_LLM_REFERENCES_THREAD_NOT_FOUND.
 *     - GetThreadRun: unknown run_id returns AI_LLM_REFERENCES_THREAD_RUN_NOT_FOUND.
 *
 * Scenarios are empty in v1 skeleton.
 */

import type { Scenario } from '../types.js';

export const scenarios: ReadonlyArray<Scenario> = [];
```

- [ ] **Step 8: `CancelThreadRun.scenarios.ts`**

Create `modules/ai-llm/conformance/src/scenarios/CancelThreadRun.scenarios.ts`:

```typescript
/**
 * Conformance scenarios for AiLlmModule.CancelThreadRun (capability: thread=true).
 *
 * Spec § 12.2:
 *   Happy path:
 *     - CancelThreadRun: in-progress run transitions to CANCELLED, ThreadRunCancelled event.
 *     - CancelThreadRun: best-effort — already-terminal run returns current state without error.
 *
 *   Negative:
 *     - CancelThreadRun: unknown run_id returns AI_LLM_REFERENCES_THREAD_RUN_NOT_FOUND.
 *
 * Scenarios are empty in v1 skeleton.
 */

import type { Scenario } from '../types.js';

export const scenarios: ReadonlyArray<Scenario> = [];
```

- [ ] **Step 9: Commit**

```bash
git add modules/ai-llm/conformance/src/scenarios/CreateThread.scenarios.ts modules/ai-llm/conformance/src/scenarios/GetThread.scenarios.ts modules/ai-llm/conformance/src/scenarios/DeleteThread.scenarios.ts modules/ai-llm/conformance/src/scenarios/AddMessage.scenarios.ts modules/ai-llm/conformance/src/scenarios/ListThreadItems.scenarios.ts modules/ai-llm/conformance/src/scenarios/RunThread.scenarios.ts modules/ai-llm/conformance/src/scenarios/GetThreadRun.scenarios.ts modules/ai-llm/conformance/src/scenarios/CancelThreadRun.scenarios.ts
git commit -m "feat(conformance-ai-llm): thread scenario stubs (8 files)"
```

---

## Task 9: Scenario stubs — AsyncJob (4 files)

**Files:**
- Create: `modules/ai-llm/conformance/src/scenarios/SubmitJob.scenarios.ts`
- Create: `modules/ai-llm/conformance/src/scenarios/GetJob.scenarios.ts`
- Create: `modules/ai-llm/conformance/src/scenarios/CancelJob.scenarios.ts`
- Create: `modules/ai-llm/conformance/src/scenarios/ListJobs.scenarios.ts`

All four are gated by `requires: { async_job_types: ["BATCH_COMPLETION"] }`.

- [ ] **Step 1: `SubmitJob.scenarios.ts`**

Create `modules/ai-llm/conformance/src/scenarios/SubmitJob.scenarios.ts`:

```typescript
/**
 * Conformance scenarios for AiLlmModule.SubmitJob (capability: async_job_types ⊇ ["BATCH_COMPLETION"]).
 *
 * Spec § 12.2:
 *   Happy path:
 *     - SubmitJob batch_completion: small batch (2 items) — asserts AsyncJob shape
 *       with type=BATCH_COMPLETION, status one of VALIDATING|QUEUED, AsyncJobSubmitted
 *       event with input_item_count=2.
 *     - SubmitJob lifecycle: full state machine
 *         steps:
 *           1. SubmitJob(small batch)
 *           2. assertEventWithin: AsyncJobStatusChanged transitions through QUEUED → RUNNING
 *           3. assertEventWithin: AsyncJobCompleted (timeout up to 24h in live mode; mock
 *              vendor completes in <5s).
 *           4. GetJob: returns COMPLETED with non-empty result_uri.
 *
 *     - SubmitJob idempotency replay returns same job_id, no duplicate event.
 *
 *   Negative:
 *     - SubmitJob: missing idempotency_key returns AI_LLM_STRUCTURAL_MISSING_IDEMPOTENCY_KEY.
 *     - SubmitJob: empty body returns AI_LLM_STRUCTURAL_EMPTY_MESSAGES (no items).
 *     - SubmitJob: oversized batch returns AI_LLM_CONSISTENCY_BATCH_TOO_LARGE.
 *     - SubmitJob with VENDOR_SPECIFIC type returns AI_LLM_CONSISTENCY_UNSUPPORTED_ASYNC_JOB_TYPE.
 *
 * Scenarios are empty in v1 skeleton.
 */

import type { Scenario } from '../types.js';

export const scenarios: ReadonlyArray<Scenario> = [];
```

- [ ] **Step 2: `GetJob.scenarios.ts`**

Create `modules/ai-llm/conformance/src/scenarios/GetJob.scenarios.ts`:

```typescript
/**
 * Conformance scenarios for AiLlmModule.GetJob (capability: async_job_types non-empty).
 *
 * Spec § 12.2:
 *   Happy path:
 *     - GetJob: returns canonical AsyncJob with current status.
 *
 *   Negative:
 *     - GetJob: unknown canonical_id returns AI_LLM_REFERENCES_ASYNC_JOB_NOT_FOUND.
 *
 * Scenarios are empty in v1 skeleton.
 */

import type { Scenario } from '../types.js';

export const scenarios: ReadonlyArray<Scenario> = [];
```

- [ ] **Step 3: `CancelJob.scenarios.ts`**

Create `modules/ai-llm/conformance/src/scenarios/CancelJob.scenarios.ts`:

```typescript
/**
 * Conformance scenarios for AiLlmModule.CancelJob (capability: async_job_types non-empty).
 *
 * Spec § 12.2:
 *   Happy path:
 *     - CancelJob: in-progress job transitions to CANCELLED, AsyncJobCancelled event.
 *     - CancelJob: best-effort — already-terminal job returns current state without error.
 *
 *   Negative:
 *     - CancelJob: unknown canonical_id returns AI_LLM_REFERENCES_ASYNC_JOB_NOT_FOUND.
 *
 * Scenarios are empty in v1 skeleton.
 */

import type { Scenario } from '../types.js';

export const scenarios: ReadonlyArray<Scenario> = [];
```

- [ ] **Step 4: `ListJobs.scenarios.ts`**

Create `modules/ai-llm/conformance/src/scenarios/ListJobs.scenarios.ts`:

```typescript
/**
 * Conformance scenarios for AiLlmModule.ListJobs (capability: async_job_types non-empty).
 *
 * Spec § 12.2:
 *   Happy path:
 *     - ListJobs: returns jobs in created_at DESC order.
 *     - ListJobs filtered by type=BATCH_COMPLETION returns only matching jobs.
 *     - ListJobs filtered by status=COMPLETED returns only matching jobs.
 *     - ListJobs cursor pagination round-trip yields full set without dupes.
 *
 *   Negative:
 *     - (none — empty result is valid).
 *
 * Scenarios are empty in v1 skeleton.
 */

import type { Scenario } from '../types.js';

export const scenarios: ReadonlyArray<Scenario> = [];
```

- [ ] **Step 5: Commit**

```bash
git add modules/ai-llm/conformance/src/scenarios/SubmitJob.scenarios.ts modules/ai-llm/conformance/src/scenarios/GetJob.scenarios.ts modules/ai-llm/conformance/src/scenarios/CancelJob.scenarios.ts modules/ai-llm/conformance/src/scenarios/ListJobs.scenarios.ts
git commit -m "feat(conformance-ai-llm): async-job scenario stubs (4 files)"
```

---

## Task 10: `capabilities.ts`, `suite.ts`, and `index.ts` barrel

**Files:**
- Create: `modules/ai-llm/conformance/src/capabilities.ts`
- Create: `modules/ai-llm/conformance/src/suite.ts`
- Create: `modules/ai-llm/conformance/src/index.ts`

- [ ] **Step 1: Write `capabilities.ts`**

Create `modules/ai-llm/conformance/src/capabilities.ts`:

```typescript
/**
 * Canonical AI/LLM v1 capability universe. Vendor modules declare subsets of
 * these values in module.json#capabilities; the future conformance runner uses
 * the same lists for skip/report labelling.
 */

export const AI_LLM_CANONICAL_RPCS = [
  'Complete',
  'GetCompletion',
  'CreateThread',
  'GetThread',
  'DeleteThread',
  'AddMessage',
  'ListThreadItems',
  'RunThread',
  'GetThreadRun',
  'CancelThreadRun',
  'SubmitJob',
  'GetJob',
  'CancelJob',
  'ListJobs',
] as const;

export const AI_LLM_CANONICAL_EVENTS = [
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

export const AI_LLM_INPUT_MODALITIES = ['text', 'image', 'audio', 'file'] as const;
export const AI_LLM_REASONING_VISIBILITY = ['hidden', 'summary', 'full'] as const;
export const AI_LLM_ASYNC_JOB_TYPES = ['BATCH_COMPLETION'] as const;
export const AI_LLM_AGENT_EXECUTION_MODES = ['delegated', 'local', 'none'] as const;

export const AI_LLM_CAPABILITY_FIELDS = [
  'vendors',
  'rpcs',
  'events',
  'input_modalities',
  'reasoning_visibility_supported',
  'thread',
  'async_job_types',
  'agent_execution_mode',
] as const;
```

- [ ] **Step 2: Write `suite.ts`**

Create `modules/ai-llm/conformance/src/suite.ts`:

```typescript
import type { CategoryConformanceSuite } from './types.js';

import { scenarios as Complete } from './scenarios/Complete.scenarios.js';
import { scenarios as GetCompletion } from './scenarios/GetCompletion.scenarios.js';
import { scenarios as CreateThread } from './scenarios/CreateThread.scenarios.js';
import { scenarios as GetThread } from './scenarios/GetThread.scenarios.js';
import { scenarios as DeleteThread } from './scenarios/DeleteThread.scenarios.js';
import { scenarios as AddMessage } from './scenarios/AddMessage.scenarios.js';
import { scenarios as ListThreadItems } from './scenarios/ListThreadItems.scenarios.js';
import { scenarios as RunThread } from './scenarios/RunThread.scenarios.js';
import { scenarios as GetThreadRun } from './scenarios/GetThreadRun.scenarios.js';
import { scenarios as CancelThreadRun } from './scenarios/CancelThreadRun.scenarios.js';
import { scenarios as SubmitJob } from './scenarios/SubmitJob.scenarios.js';
import { scenarios as GetJob } from './scenarios/GetJob.scenarios.js';
import { scenarios as CancelJob } from './scenarios/CancelJob.scenarios.js';
import { scenarios as ListJobs } from './scenarios/ListJobs.scenarios.js';

export const aiLlmConformanceSuite: CategoryConformanceSuite = {
  category: 'ai-llm',
  contractVersion: 'v1',
  scenariosByRpc: {
    Complete,
    GetCompletion,
    CreateThread,
    GetThread,
    DeleteThread,
    AddMessage,
    ListThreadItems,
    RunThread,
    GetThreadRun,
    CancelThreadRun,
    SubmitJob,
    GetJob,
    CancelJob,
    ListJobs,
  },
};
```

- [ ] **Step 3: Write `index.ts`**

Create `modules/ai-llm/conformance/src/index.ts`:

```typescript
export { aiLlmConformanceSuite } from './suite.js';
export type { Scenario, ScenarioContext, ScenarioStatus, CategoryConformanceSuite } from './types.js';
export {
  AI_LLM_CANONICAL_RPCS,
  AI_LLM_CANONICAL_EVENTS,
  AI_LLM_INPUT_MODALITIES,
  AI_LLM_REASONING_VISIBILITY,
  AI_LLM_ASYNC_JOB_TYPES,
  AI_LLM_AGENT_EXECUTION_MODES,
  AI_LLM_CAPABILITY_FIELDS,
} from './capabilities.js';

// Re-export fixtures so vendor modules can compose scenarios on top.
export * as messages from './fixtures/messages.js';
export * as contentBlocks from './fixtures/content-blocks.js';
export * as tools from './fixtures/tools.js';
export * as threads from './fixtures/threads.js';
export * as batchItems from './fixtures/batch-items.js';
export {
  samplePngPath,
  sampleMp3Path,
  samplePdfPath,
  samplePngUrl,
  sampleMp3Url,
  samplePdfUrl,
} from './fixtures/media/index.js';
```

- [ ] **Step 4: Verify build**

Run: `pnpm -F @rntme/conformance-ai-llm run build`
Expected: emits `dist/index.js` and `dist/index.d.ts`. No errors.

Run: `pnpm -F @rntme/conformance-ai-llm run typecheck`
Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
git add modules/ai-llm/conformance/src/capabilities.ts modules/ai-llm/conformance/src/suite.ts modules/ai-llm/conformance/src/index.ts
git commit -m "feat(conformance-ai-llm): capabilities registry + suite wiring + barrel"
```

---

## Task 11: Drift test — RPC names ↔ scenario filenames

**Files:**
- Create: `modules/ai-llm/conformance/test/drift.test.ts`

- [ ] **Step 1: Write the drift test**

Create `modules/ai-llm/conformance/test/drift.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { proto } from '@rntme/contracts-ai-llm-v1';
import { AI_LLM_CANONICAL_RPCS, aiLlmConformanceSuite } from '../src/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const scenariosDir = resolve(here, '../src/scenarios');

function rpcsFromContract(): Set<string> {
  const ns = proto.rntme.contracts.ai_llm.v1 as Record<string, unknown>;
  const ServiceCtor = ns['AiLlmModule'] as { prototype: Record<string, unknown> };
  expect(ServiceCtor, 'AiLlmModule service descriptor missing').toBeDefined();
  const names = new Set<string>();
  for (const key of Object.getOwnPropertyNames(ServiceCtor.prototype)) {
    if (key === 'constructor') continue;
    const fn = ServiceCtor.prototype[key];
    if (typeof fn !== 'function') continue;
    const rpcName = (fn as { name?: string }).name;
    if (rpcName && /^[A-Z][a-zA-Z0-9]*$/.test(rpcName)) names.add(rpcName);
  }
  return names;
}

describe('AI/LLM conformance drift detector', () => {
  it('every canonical RPC has a matching scenario file', () => {
    const filenames = readdirSync(scenariosDir).filter((n) => n.endsWith('.scenarios.ts'));
    const rpcNamesFromFiles = filenames.map((n) => n.replace('.scenarios.ts', '')).sort();
    const expected = [...AI_LLM_CANONICAL_RPCS].sort();
    expect(rpcNamesFromFiles).toEqual(expected);
  });

  it('every scenario file is wired in suite.ts', () => {
    const filenames = readdirSync(scenariosDir).filter((n) => n.endsWith('.scenarios.ts'));
    const rpcNamesFromFiles = filenames.map((n) => n.replace('.scenarios.ts', ''));
    const wiredKeys = Object.keys(aiLlmConformanceSuite.scenariosByRpc);
    expect(wiredKeys.sort()).toEqual(rpcNamesFromFiles.sort());
  });

  it('AI_LLM_CANONICAL_RPCS matches the canonical contract service', () => {
    // Introspect AiLlmModule to confirm the file list matches the proto definition.
    expect([...rpcsFromContract()].sort()).toEqual([...AI_LLM_CANONICAL_RPCS].sort());
  });

  it('suite metadata is fixed', () => {
    expect(aiLlmConformanceSuite.category).toBe('ai-llm');
    expect(aiLlmConformanceSuite.contractVersion).toBe('v1');
  });
});
```

- [ ] **Step 2: Run test**

Run: `pnpm -F @rntme/conformance-ai-llm run test test/drift.test.ts`
Expected: 4 passing tests.

- [ ] **Step 3: Commit**

```bash
git add modules/ai-llm/conformance/test/drift.test.ts
git commit -m "test(conformance-ai-llm): drift detector for RPC ↔ scenario filenames"
```

---

## Task 12: Suite-shape and fixtures-sanity tests

**Files:**
- Create: `modules/ai-llm/conformance/test/suite-shape.test.ts`
- Create: `modules/ai-llm/conformance/test/fixtures-sanity.test.ts`

- [ ] **Step 1: Write `test/suite-shape.test.ts`**

Create `modules/ai-llm/conformance/test/suite-shape.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import {
  AI_LLM_AGENT_EXECUTION_MODES,
  AI_LLM_ASYNC_JOB_TYPES,
  AI_LLM_CANONICAL_EVENTS,
  AI_LLM_CANONICAL_RPCS,
  AI_LLM_CAPABILITY_FIELDS,
  AI_LLM_INPUT_MODALITIES,
  AI_LLM_REASONING_VISIBILITY,
  aiLlmConformanceSuite,
} from '../src/index.js';

describe('CategoryConformanceSuite shape', () => {
  it('every scenarios entry is an array (possibly empty in v1 skeleton)', () => {
    for (const [rpc, scenarios] of Object.entries(aiLlmConformanceSuite.scenariosByRpc)) {
      expect(Array.isArray(scenarios), `scenarios[${rpc}] must be an array`).toBe(true);
    }
  });

  it('exactly 14 RPCs wired', () => {
    expect(Object.keys(aiLlmConformanceSuite.scenariosByRpc)).toHaveLength(14);
  });

  it('all scenario arrays are empty in v1 skeleton (until framework lands)', () => {
    // When a follow-up PR adds real scenarios, this test stops being trivial —
    // update the assertion to "non-empty for at least Complete + RunThread".
    for (const [rpc, scenarios] of Object.entries(aiLlmConformanceSuite.scenariosByRpc)) {
      expect(scenarios.length, `scenarios[${rpc}] should be empty in skeleton`).toBe(0);
    }
  });

  it('exports canonical capability registries for vendor module authors', () => {
    expect(AI_LLM_CANONICAL_RPCS).toHaveLength(14);
    expect(AI_LLM_CANONICAL_EVENTS).toEqual([
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
    ]);
    expect(AI_LLM_INPUT_MODALITIES).toEqual(['text', 'image', 'audio', 'file']);
    expect(AI_LLM_REASONING_VISIBILITY).toEqual(['hidden', 'summary', 'full']);
    expect(AI_LLM_ASYNC_JOB_TYPES).toEqual(['BATCH_COMPLETION']);
    expect(AI_LLM_AGENT_EXECUTION_MODES).toEqual(['delegated', 'local', 'none']);
    expect(AI_LLM_CAPABILITY_FIELDS).toEqual([
      'vendors',
      'rpcs',
      'events',
      'input_modalities',
      'reasoning_visibility_supported',
      'thread',
      'async_job_types',
      'agent_execution_mode',
    ]);
  });
});
```

- [ ] **Step 2: Write `test/fixtures-sanity.test.ts`**

Create `modules/ai-llm/conformance/test/fixtures-sanity.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { statSync, readFileSync } from 'node:fs';
import { samplePngPath, sampleMp3Path, samplePdfPath } from '../src/fixtures/media/index.js';

const MAX_SIZE_BYTES = 100 * 1024;  // 100 KB per spec §16

describe('binary media fixtures', () => {
  it('sample.png exists and is ≤ 100KB and is a valid PNG', () => {
    const stat = statSync(samplePngPath);
    expect(stat.size).toBeGreaterThan(0);
    expect(stat.size).toBeLessThanOrEqual(MAX_SIZE_BYTES);
    const head = readFileSync(samplePngPath).subarray(0, 8);
    // PNG magic: 89 50 4E 47 0D 0A 1A 0A
    expect(Array.from(head)).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  });

  it('sample.mp3 exists and is ≤ 100KB and starts with an MP3 frame sync', () => {
    const stat = statSync(sampleMp3Path);
    expect(stat.size).toBeGreaterThan(0);
    expect(stat.size).toBeLessThanOrEqual(MAX_SIZE_BYTES);
    const head = readFileSync(sampleMp3Path).subarray(0, 2);
    // MPEG-1 layer 3 frame: first 11 bits = 1 (frame sync). Byte 0 = 0xff,
    // byte 1 has top 3 bits set → 0xfb is "MPEG-1 Layer 3 no CRC".
    expect(head[0]).toBe(0xff);
    expect((head[1] & 0xe0) === 0xe0).toBe(true);
  });

  it('sample.pdf exists and is ≤ 100KB and starts with %PDF-', () => {
    const stat = statSync(samplePdfPath);
    expect(stat.size).toBeGreaterThan(0);
    expect(stat.size).toBeLessThanOrEqual(MAX_SIZE_BYTES);
    const head = readFileSync(samplePdfPath, { encoding: 'utf8' }).slice(0, 5);
    expect(head).toBe('%PDF-');
  });
});
```

- [ ] **Step 3: Run tests**

Run: `pnpm -F @rntme/conformance-ai-llm run test`
Expected: all tests pass (drift + suite-shape + fixtures-sanity).

- [ ] **Step 4: Run lint and typecheck**

Run: `pnpm -F @rntme/conformance-ai-llm run lint`
Expected: zero errors.

Run: `pnpm -F @rntme/conformance-ai-llm run typecheck`
Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
git add modules/ai-llm/conformance/test/suite-shape.test.ts modules/ai-llm/conformance/test/fixtures-sanity.test.ts
git commit -m "test(conformance-ai-llm): suite-shape + fixtures-sanity tests"
```

---

## Task 13: Per-package README

**Files:**
- Create: `modules/ai-llm/conformance/README.md`

- [ ] **Step 1: Write the README**

Create `modules/ai-llm/conformance/README.md`:

```markdown
# `@rntme/conformance-ai-llm` — AI/LLM conformance scaffolding

Conformance scenarios for the AI/LLM canonical contract `@rntme/contracts-ai-llm-v1`. Consumed by every `modules/ai-llm/<vendor>/` module via the (future) shared conformance runner.

## File map

```
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
│   │       ├── sample.png            # 1×1 PNG
│   │       ├── sample.mp3            # tiny silent MP3
│   │       ├── sample.pdf            # minimal "Sample PDF"
│   │       └── index.ts              # path/URL helpers
│   └── scenarios/                    # one file per canonical RPC (14 total)
│       ├── Complete.scenarios.ts
│       ├── GetCompletion.scenarios.ts
│       ├── CreateThread.scenarios.ts ... (8 thread files)
│       └── SubmitJob.scenarios.ts ... (4 async-job files)
├── test/
│   ├── drift.test.ts                # RPC ↔ scenario file drift
│   ├── suite-shape.test.ts          # suite metadata + 14-key invariant
│   └── fixtures-sanity.test.ts       # binary fixture size + magic-byte check
└── README.md
```

## Quick start

```typescript
import { AI_LLM_CANONICAL_RPCS, aiLlmConformanceSuite, samplePngUrl } from '@rntme/conformance-ai-llm';

console.log(aiLlmConformanceSuite.category);                       // 'ai-llm'
console.log(aiLlmConformanceSuite.contractVersion);                // 'v1'
console.log(Object.keys(aiLlmConformanceSuite.scenariosByRpc));    // 14 canonical RPC names
console.log(AI_LLM_CANONICAL_RPCS.length);                         // 14
```

When `@rntme/conformance-framework` lands, point its runner at `aiLlmConformanceSuite` and a vendor module's gRPC handler:

```typescript
import { run } from '@rntme/conformance-framework';
import { aiLlmConformanceSuite } from '@rntme/conformance-ai-llm';

const report = await run(aiLlmConformanceSuite, vendorModuleHandler, { mode: 'mock' });
```

## API

### `aiLlmConformanceSuite: CategoryConformanceSuite`

Frozen metadata + `scenariosByRpc` keyed by canonical RPC name. Every scenarios array is empty in the v1 skeleton — populated when the framework gains assertion DSL.

### Registry and fixture re-exports

- `AI_LLM_CANONICAL_RPCS`, `AI_LLM_CANONICAL_EVENTS`, `AI_LLM_INPUT_MODALITIES`, `AI_LLM_REASONING_VISIBILITY`, `AI_LLM_ASYNC_JOB_TYPES`, `AI_LLM_AGENT_EXECUTION_MODES`, `AI_LLM_CAPABILITY_FIELDS` — canonical registries used by vendor module authors and future conformance reports.
- `messages` — `userHello`, `userMath`, `userWeather`, `systemHelpful`, `assistantAck`.
- `contentBlocks` — `textBlock`, `imageBlockUrl`, `audioBlockUrl`, `fileBlockUrl`, `toolUseBlock`, `toolResultBlock`, `thinkingBlock`.
- `tools` — `getWeatherTool`, `lookupUserTool` (MCP-shape).
- `threads` — `supportThread`, `mathThread`, `emptyThread`.
- `batchItems` — `tinyBatch(vendorPrefix)`, `oversizedBatch(vendorPrefix)` factories.
- `samplePng{Path,Url}`, `sampleMp3{Path,Url}`, `samplePdf{Path,Url}` — binary fixture references.

## Invariants & gotchas

- **One scenario file per canonical RPC.** Drift detector enforces 1:1 mapping between `service AiLlmModule` RPCs and `src/scenarios/<RPC>.scenarios.ts` files. Adding an RPC to the contract without a scenario file (or vice versa) fails CI.
- **Scenarios are empty in v1 skeleton.** Real scenarios land when `@rntme/conformance-framework` ships. Until then, every file is a documented placeholder citing spec §12.2.
- **Binary fixtures stay ≤ 100KB.** Sanity test enforces. Use `git diff --stat` after touching media to confirm.
- **`types.ts` is a temporary mirror** of (future) `@rntme/conformance-framework` types. Migrate when framework lands.

## Out of scope

- Actual scenario implementations — wait for framework runner.
- Live-vendor mode (real OpenAI/Anthropic calls) — runner plus secret-management is framework-side.
- Framework runner itself — separate `@rntme/conformance-framework` package, separate plan.

## Where to look first

- `src/scenarios/Complete.scenarios.ts` — canonical structure for a stub; comments cite spec §12.2 line-by-line.
- `src/scenarios/RunThread.scenarios.ts` — structure for the multi-step Thread tool-cycle (the most complex scenario family).
- `test/drift.test.ts` — authoritative list of canonical RPCs.

## Specs

- `docs/superpowers/specs/2026-04-26-ai-llm-canonical-contract-design.md` §12 — conformance suite design.
- `docs/superpowers/specs/2026-04-26-modules-monorepo-structure-design.md` §7 — conformance suite layout, anti-conformance, capability-coverage report.
- `docs/superpowers/plans/ai-llm-canonical-contract/02-ai-llm-conformance-skeleton.md` — this plan.
- `docs/superpowers/plans/ai-llm-canonical-contract/01-ai-llm-contracts.md` — companion plan for contracts package.
```

- [ ] **Step 2: Commit**

```bash
git add modules/ai-llm/conformance/README.md
git commit -m "docs(conformance-ai-llm): per-package README"
```

---

## Task 14: Documentation-touch — `AGENTS.md` and root `README.md`

**Files:**
- Modify: `AGENTS.md`
- Modify: `README.md`

- [ ] **Step 1: Add `modules/ai-llm/` to `AGENTS.md` §3**

Run: `grep -n "modules/identity" AGENTS.md`

You should see entries from Identity plan 2. Insert next to them, alphabetical:

```
- modules/ai-llm/                       — AI/LLM category root: README + conformance/ workspace package
- modules/ai-llm/conformance/           — workspace package @rntme/conformance-ai-llm: 14 scenario stubs + fixtures
```

- [ ] **Step 2: Add §6 how-to entry "Add an AI/LLM vendor module"**

Run: `grep -n "Add an Identity vendor module\|6.1[0-9]" AGENTS.md`

If Identity plan 2 added "6.18 Add an Identity vendor module" or similar, add a parallel "Add an AI/LLM vendor module" entry after it:

```markdown
### 6.19 Add an AI/LLM vendor module

The pattern is the same as Identity vendor modules but with the AI/LLM canonical contract. Each vendor lands at `modules/ai-llm/<vendor>/` with:

1. A handler implementation against `proto.rntme.contracts.ai_llm.v1.AiLlmModule`. SaaS module wraps one vendor; gateway module proxies to many. If Plan 1 exports direct convenience symbols by the time this plan is implemented, `AiLlmModule` may also be imported from `@rntme/contracts-ai-llm-v1`.
2. An idempotency dedup-store (in-memory, Redis sidecar, or Postgres) with ≥24h TTL. Major LLM vendors do not provide native idempotency; this is mandatory.
3. A webhook receiver for AsyncJob status callbacks (OpenAI Standard Webhooks for Batch API; Bedrock EventBridge for batch).
4. A `module.json` manifest declaring all eight capability fields (see `modules/ai-llm/README.md` for the decision tree).
5. Vendor-specific extensions in `<vendor>-extensions.proto` if the vendor has features not in canon (impersonation, MFA-policy, etc.).
6. Conformance scenarios passing under both mock-vendor and live-sandbox modes (live mode requires API keys in a secret store).

Reference the canonical contract package at `packages/contracts/ai-llm/v1/` and the conformance suite at `modules/ai-llm/conformance/`.
```

If Identity plan 2 did NOT add such an entry, skip Step 2 — when the first Identity vendor module brainstorm/plan lands, both how-to entries can land together.

- [ ] **Step 3: Append `@rntme/conformance-ai-llm` to root `README.md` packages table**

Run: `grep -n "@rntme/conformance-identity\|@rntme/contracts-ai-llm-v1" README.md`

Add a row after the Identity conformance entry (or after the AI/LLM contracts entry from plan 1):

```markdown
| `@rntme/conformance-ai-llm` | AI/LLM conformance scenarios + fixtures (14 RPCs, binary media) |
```

- [ ] **Step 4: Commit**

```bash
git add AGENTS.md README.md
git commit -m "docs: AGENTS layering + how-to + README packages-table for ai-llm conformance"
```

---

## Task 15: Final cross-package verification

**Files:** none (verification only).

- [ ] **Step 1: Run full workspace build**

Run: `pnpm -r run build`
Expected: every package builds, including `@rntme/conformance-ai-llm`.

- [ ] **Step 2: Run full workspace tests**

Run: `pnpm -r run test`
Expected: every test passes. Conformance package contributes ~11 test cases (4 drift + 4 suite-shape/capability-registry + 3 fixtures-sanity).

- [ ] **Step 3: Run full workspace lint and typecheck**

Run: `pnpm -r run lint && pnpm -r run typecheck`
Expected: zero errors.

- [ ] **Step 4: Confirm Identity packages and AI/LLM contracts not touched**

Run:
```bash
git log --since="<start-of-this-plan>" -- packages/contracts/ai-llm/v1/ packages/contracts/identity/v1/ packages/contracts/_common/v1/ modules/identity/
```
Expected: empty (this plan only touched `modules/ai-llm/` and the two doc files).

- [ ] **Step 5: Confirm spec coverage**

Cross-check against `docs/superpowers/specs/2026-04-26-ai-llm-canonical-contract-design.md`:
- §12.1 layout — `modules/ai-llm/` + `conformance/` exists with the right structure ✓
- §12.2 per-RPC scenarios — 14 stub files, one per canonical RPC, each citing spec ✓
- §12.3 anti-conformance — documented in scenario stub comments; runner-side enforcement deferred to framework ✓
- §12.4 capability-coverage report — documented in category README and backed by `src/capabilities.ts` registry exports ✓
- §12.5 mock-vendor — documented as deferred to `@rntme/conformance-framework` ✓
- §12.6 binary fixtures — three files in `media/`, sanity-tested for size + magic bytes ✓

- [ ] **Step 6: Final commit (if any leftover staging)**

If `git status` is clean, no commit needed. Otherwise:

```bash
git add -A
git commit -m "chore(conformance-ai-llm): final cross-package verification"
```

---

## Self-review checklist

Run this checklist after the last task and before closing the PR:

1. **Spec coverage:** §12.1–§12.6 each have a corresponding task above. Confirmed in Task 15 step 5.
2. **Placeholder scan:** Search the plan body for `TBD`, `TODO`, `FIXME`, `XXX`, `placeholder`. The only legitimate occurrence is in scenario stub comments that read "Scenarios are empty in v1 skeleton" — that is not a placeholder; it is the documented contract of this plan (every scenario file is a structured placeholder until the framework lands).
3. **Type consistency:** RPC names in Tasks 7–9 match `AI_LLM_CANONICAL_RPCS` in Task 10 and Task 11. Filename pattern `<RPC>.scenarios.ts` enforced consistently. The `Scenario` type in Task 4 is used by every scenario file in Tasks 7–9 and by `suite.ts` in Task 10.
4. **Cross-task naming:** `@rntme/conformance-ai-llm` package name uniform across Tasks 3, 11, 13. `aiLlmConformanceSuite`, `contractVersion`, and `scenariosByRpc` match merged Identity conformance naming. `proto.rntme.contracts.ai_llm.v1` namespace import in Task 11 matches Plan 1's barrel export and does not require direct convenience exports.
5. **Capability gating coverage:** Every Thread scenario stub (Task 8) cites `capability: 'thread'` in its docstring; every AsyncJob stub (Task 9) cites `async_job_types`. Multimodal scenarios (Task 7 Complete + Task 8 AddMessage) cite `input_modalities`.

If any check fails: fix inline, re-run the affected task's tests.
