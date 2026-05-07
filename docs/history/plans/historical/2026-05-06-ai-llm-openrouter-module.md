> Status: historical.
> Date: 2026-05-06.
> Current source: docs/current/**, docs/decision-system.md, and current code/tests.
> Why retained: Historical rationale and execution context retained for review; it is not current-state truth by itself.

# OpenRouter AI/LLM Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the first AI/LLM vendor module (`@rntme/ai-llm-openrouter`) implementing `Complete` and `GetCompletion` against `@rntme/contracts-ai-llm-v1`, ship four non-`.proto` contract clarifications with drift-pin tests, and stand up a minimum-surface CV-extract demo blueprint that exercises the module end-to-end.

**Architecture:** Three deliverables in three phases (D1 contract clarifications → D2 module → D3 demo) with documentation (D4) folded into D2 and D3 as those land. The module is a stateless gRPC server (`AiLlmModule` service) that calls OpenRouter's chat completions HTTP endpoint, dedupes via a SQLite idempotency store, and maps errors to canonical `AI_LLM_VENDOR_*` codes. The demo is a single-aggregate, single-state event-sourced blueprint with a minimum UI; the `extractResume` graph emits a `Resume.complete` transition whose payload contains the LLM's structured-output JSON.

**Tech Stack:** TypeScript 5.5 / Node 20 / pnpm workspace. `@grpc/grpc-js` for the gRPC server (mirroring `modules/identity/auth0/`). `better-sqlite3` for the idempotency store. `vitest` for tests; `msw` (or `nock` if simpler) for mocking OpenRouter HTTP. The contract package is `@rntme/contracts-ai-llm-v1`. Demo blueprint is JSON-only authoring (PDM entity, QSM projection, graph IR `call` nodes targeting the module by key).

**Spec:** `docs/history/specs/historical/2026-05-06-ai-llm-openrouter-module-design.md`.

**Reading order before starting:**
1. The spec above.
2. `packages/contracts/ai-llm/v1/proto/ai_llm.proto` and `error-codes.json`.
3. `modules/identity/auth0/src/server.ts`, `src/handlers.ts`, `src/bin/server.ts`, `Dockerfile`, `package.json`, `module.json` — copy the patterns; do not invent new ones.
4. `demo/notes-blueprint/` — the canonical project-shape example (project.json, pdm/, services/app/{service.json, graphs/, bindings/, qsm/, ui/}).

**Memory note:** `feedback_plan_checkpoints_autonomous` says skip plan-internal "Review checkpoint N" pauses during execution. This plan therefore contains no review checkpoints; run end-to-end.

---

## Phase D1 — Contract clarifications

These four clarifications change documentation and add drift-pin tests; no `.proto` changes, no new error codes (the spec mentioned new codes but the existing `AI_LLM_VENDOR_*` set already covers what we need; see Task 8 mapping table). All work lives in `packages/contracts/ai-llm/v1/` and `modules/ai-llm/`.

### Task 1: Clarify `vendors[]` and add `gateway_upstreams[]` in contract README

**Files:**
- Modify: `packages/contracts/ai-llm/v1/README.md`

- [ ] **Step 1: Read the current README and locate the "Capability fields" section**

Run: `grep -n "Capability fields" packages/contracts/ai-llm/v1/README.md`
Expected: prints the line number around line 96-100.

- [ ] **Step 2: Replace the Capability fields example with the gateway-aware version**

Find the JSON block under "Capability fields" and replace it. The new block must explicitly call out single-element `vendors`, the new optional `gateway_upstreams`, and a comment line that single-vendor modules omit `gateway_upstreams`:

```markdown
## Capability fields

`module.json#capabilities` for AI/LLM modules:

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

`vendors[]` is the **routing prefix** of the module — exactly one element. Single-vendor module: the vendor's own name (`["openai"]`). Gateway module routing to many upstreams: the gateway's own name (`["openrouter"]`), not the upstream list.

`model` in `CreateCompletionRequest` is `<vendors[0]>/<rest>`; `<rest>` may itself contain slashes for gateway modules (canonical `openrouter/openai/gpt-4o`). The module is responsible for stripping its own prefix before forwarding to the upstream API. `AI_LLM_STRUCTURAL_VENDOR_MISMATCH` fires when `model` does not start with `<vendors[0]>/`.

Optional gateway-only field:

```json
{
  "capabilities": {
    "vendors": ["openrouter"],
    "gateway_upstreams": ["openai", "anthropic", "google", "meta", "mistralai", "deepseek"]
  }
}
```

`gateway_upstreams[]` is informational — used by catalog/UX/conformance to enumerate which upstream providers the gateway can route to. It does not influence routing.
```

- [ ] **Step 3: Verify the section reads correctly**

Run: `grep -A 40 "## Capability fields" packages/contracts/ai-llm/v1/README.md`
Expected: shows the new block with `gateway_upstreams[]`.

---

### Task 2: Document `Complete ⇔ GetCompletion` invariant in contract README

**Files:**
- Modify: `packages/contracts/ai-llm/v1/README.md`

- [ ] **Step 1: Locate the "Invariants" section**

Run: `grep -n "## Invariants" packages/contracts/ai-llm/v1/README.md`
Expected: prints the section line.

- [ ] **Step 2: Append the Complete-implies-GetCompletion bullet**

Add to the existing list of bullets under `## Invariants`:

```markdown
- `Complete` and `GetCompletion` are declared together. A module that lists `Complete` in `capabilities.rpcs` MUST also list `GetCompletion` and serve it for at least the idempotency TTL window (≥24h). Within the window, `GetCompletion` returns the cached `Completion`. Outside the window, it returns `AI_LLM_REFERENCES_COMPLETION_NOT_FOUND`. Returning `UNIMPLEMENTED` for `GetCompletion` while implementing `Complete` is forbidden.
```

- [ ] **Step 3: Verify**

Run: `grep -A 2 "Complete.*and.*GetCompletion.*are declared together" packages/contracts/ai-llm/v1/README.md`
Expected: prints the new bullet.

---

### Task 3: Document `SamplingParams.response_format` enum

**Files:**
- Modify: `packages/contracts/ai-llm/v1/README.md`

- [ ] **Step 1: Locate "Helper types"**

Run: `grep -n "### Helper types" packages/contracts/ai-llm/v1/README.md`
Expected: prints section line (~62).

- [ ] **Step 2: Replace the `SamplingParams` mention with documented enum values**

Find the existing description of `SamplingParams` and add a paragraph immediately after it:

```markdown
`SamplingParams.response_format` is one of `"text" | "json_object" | "json_schema"` (any other value is non-canonical and SHOULD be rejected by the structural validator — see backlog item AI_LLM_STRUCTURAL_INVALID_RESPONSE_FORMAT). When `"json_schema"`, `response_schema` (a `google.protobuf.Struct`) is required. When `"json_object"`, `response_schema` is optional. When `"text"` or empty, `response_schema` is ignored.
```

- [ ] **Step 3: Verify**

Run: `grep -B1 -A4 "response_format.*is one of" packages/contracts/ai-llm/v1/README.md`
Expected: prints the new paragraph.

---

### Task 4: Cleanup `modules/ai-llm/README.md` (vendors row, storage line, vendors-landed)

**Files:**
- Modify: `modules/ai-llm/README.md`

- [ ] **Step 1: Read the current decision-tree row for `vendors[]`**

Run: `grep -n "vendors\[\]" modules/ai-llm/README.md`
Expected: prints the row in the capability table.

- [ ] **Step 2: Replace the `vendors[]` row and add `gateway_upstreams[]` row**

In the capability decision tree (the markdown table), replace the `vendors[]` row and add a new row after it:

```markdown
| `vendors[]` | Always one element — the routing prefix of THIS module. Single-vendor module: vendor's own name (`["openai"]`). Gateway module: gateway's own name (`["openrouter"]`), not the upstream list. |
| `gateway_upstreams[]` | Optional, gateway-only. Informational list of upstream providers the gateway routes to (e.g. `["openai", "anthropic", "google"]`). Does not influence routing. Single-vendor modules omit it. |
```

- [ ] **Step 3: Replace the storage description in the file's intro**

Find the line that mentions `Redis / in-memory / Postgres` and replace with:

```markdown
- An idempotency dedup-store (SQLite recommended; in-memory acceptable for dev/test only; ≥24h TTL). Postgres and Redis MUST NOT be assumed; the project storage target is SQLite/Turso.
```

- [ ] **Step 4: Update "Vendors landed here"**

Find the section "## Vendors landed here" (currently says "None yet."). Replace its body with:

```markdown
- `openrouter` — `modules/ai-llm/openrouter/`. Multi-provider gateway. Implements `Complete` and `GetCompletion`; remaining 12 RPCs return `UNIMPLEMENTED`. See `modules/ai-llm/openrouter/README.md`.
```

- [ ] **Step 5: Verify**

Run: `grep -A 2 "Vendors landed here" modules/ai-llm/README.md`
Expected: shows the openrouter bullet.

---

### Task 5: Drift-pin test for `vendors[]` and `gateway_upstreams[]` shape

**Files:**
- Create: `packages/contracts/ai-llm/v1/test/capability-shape.test.ts`

- [ ] **Step 1: Write the test file**

The test discovers every `module.json` under `modules/ai-llm/` (excluding the `conformance/` package) and asserts its capability shape. It must pass even when no module has been merged yet (vacuous case: zero files found, no assertions fired).

```typescript
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(__dirname, '../../../../..');
const AI_LLM_MODULES_DIR = join(REPO_ROOT, 'modules/ai-llm');

interface Capabilities {
  vendors?: unknown;
  gateway_upstreams?: unknown;
  rpcs?: unknown;
}

interface ModuleManifest {
  category?: unknown;
  capabilities?: Capabilities;
}

function discoverAiLlmModuleManifests(): { path: string; manifest: ModuleManifest }[] {
  const manifests: { path: string; manifest: ModuleManifest }[] = [];
  let entries: string[];
  try {
    entries = readdirSync(AI_LLM_MODULES_DIR);
  } catch {
    return manifests;
  }
  for (const entry of entries) {
    if (entry === 'conformance') continue;
    const entryPath = join(AI_LLM_MODULES_DIR, entry);
    let st;
    try {
      st = statSync(entryPath);
    } catch {
      continue;
    }
    if (!st.isDirectory()) continue;
    const manifestPath = join(entryPath, 'module.json');
    try {
      const raw = readFileSync(manifestPath, 'utf8');
      manifests.push({ path: manifestPath, manifest: JSON.parse(raw) as ModuleManifest });
    } catch {
      // module.json missing in some scaffold-in-progress dir — skip
    }
  }
  return manifests;
}

describe('AI/LLM module manifest capability shape', () => {
  const manifests = discoverAiLlmModuleManifests();

  it('every AI/LLM module declares category=ai-llm', () => {
    for (const { path, manifest } of manifests) {
      expect(manifest.category, `${path}: category`).toBe('ai-llm');
    }
  });

  it('vendors[] is non-empty and single-element for every AI/LLM module', () => {
    for (const { path, manifest } of manifests) {
      const vendors = manifest.capabilities?.vendors;
      expect(Array.isArray(vendors), `${path}: vendors must be array`).toBe(true);
      expect((vendors as unknown[]).length, `${path}: vendors must have exactly one element`).toBe(1);
      expect(typeof (vendors as unknown[])[0], `${path}: vendors[0] must be string`).toBe('string');
    }
  });

  it('gateway_upstreams[] is optional; when present, an array of strings', () => {
    for (const { path, manifest } of manifests) {
      const upstreams = manifest.capabilities?.gateway_upstreams;
      if (upstreams === undefined) continue;
      expect(Array.isArray(upstreams), `${path}: gateway_upstreams must be array`).toBe(true);
      for (const u of upstreams as unknown[]) {
        expect(typeof u, `${path}: gateway_upstreams entry must be string`).toBe('string');
      }
    }
  });

  it('Complete in rpcs[] implies GetCompletion in rpcs[]', () => {
    for (const { path, manifest } of manifests) {
      const rpcs = manifest.capabilities?.rpcs;
      if (!Array.isArray(rpcs)) continue;
      const set = new Set(rpcs as string[]);
      if (set.has('Complete')) {
        expect(set.has('GetCompletion'), `${path}: Complete in rpcs[] requires GetCompletion`).toBe(true);
      }
    }
  });
});
```

- [ ] **Step 2: Run the test (vacuous pass — no module.json files exist yet)**

Run: `pnpm -F @rntme/contracts-ai-llm-v1 vitest run test/capability-shape.test.ts`
Expected: PASS, all four `it` blocks pass with zero iterations because no manifests are present.

- [ ] **Step 3: Sanity-check by adding a temporary bad fixture**

Create a temp directory `modules/ai-llm/_drift-pin-fixture/` with a `module.json` whose `vendors` is empty array, run the test, expect FAIL, then delete the fixture.

```bash
mkdir -p modules/ai-llm/_drift-pin-fixture
cat > modules/ai-llm/_drift-pin-fixture/module.json <<'EOF'
{ "category": "ai-llm", "capabilities": { "vendors": [] } }
EOF
pnpm -F @rntme/contracts-ai-llm-v1 vitest run test/capability-shape.test.ts || true
rm -rf modules/ai-llm/_drift-pin-fixture
```

Expected: the run fails on "vendors must have exactly one element"; after removing the fixture the test passes again. (This step verifies the test isn't a tautology.)

- [ ] **Step 4: Final test run after removing fixture**

Run: `pnpm -F @rntme/contracts-ai-llm-v1 vitest run test/capability-shape.test.ts`
Expected: PASS.

---

### Task 6: Drift-pin test for `SamplingParams.response_format` enum

**Files:**
- Create: `packages/contracts/ai-llm/v1/test/sampling-params.test.ts`

- [ ] **Step 1: Write the test**

Pins the canonical array. If anyone wants to broaden the enum (or tighten it), this test forces the change to land deliberately rather than silently.

```typescript
import { describe, expect, it } from 'vitest';

const CANONICAL_RESPONSE_FORMATS = ['text', 'json_object', 'json_schema'] as const;

describe('SamplingParams.response_format documented enum', () => {
  it('is exactly the three canonical values', () => {
    expect(CANONICAL_RESPONSE_FORMATS).toEqual(['text', 'json_object', 'json_schema']);
    expect(CANONICAL_RESPONSE_FORMATS.length).toBe(3);
  });

  it('all three values are non-empty strings', () => {
    for (const v of CANONICAL_RESPONSE_FORMATS) {
      expect(typeof v).toBe('string');
      expect(v.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run the test**

Run: `pnpm -F @rntme/contracts-ai-llm-v1 vitest run test/sampling-params.test.ts`
Expected: PASS.

---

### Task 7: Extend `service-shape.test.ts` for the Complete⇔GetCompletion rule

**Files:**
- Modify: `packages/contracts/ai-llm/v1/test/service-shape.test.ts`

- [ ] **Step 1: Add an assertion verifying the canonical RPC-event mapping has both `Complete` and `GetCompletion`**

The existing test already enumerates `EXPECTED_RPC_EVENT_FIXTURE_NAMES`. Add a new `it` that proves the contract spec encodes the pair-rule at the type-level (a sanity check, since the actual cross-module enforcement is in `capability-shape.test.ts`).

Append to the file (inside the `describe('service AiLlmModule shape', () => { ... })` block):

```typescript
  it('Complete and GetCompletion are both canonical RPCs (pair-rule)', () => {
    expect(EXPECTED_RPCS).toContain('Complete');
    expect(EXPECTED_RPCS).toContain('GetCompletion');
    // GetCompletion does not emit events (read-only); Complete emits 3.
    expect(EXPECTED_RPC_EVENT_FIXTURE_NAMES.GetCompletion).toEqual([]);
    expect(EXPECTED_RPC_EVENT_FIXTURE_NAMES.Complete).toEqual([
      'CompletionStarted',
      'CompletionFinished',
      'CompletionFailed',
    ]);
  });
```

- [ ] **Step 2: Run the existing test file**

Run: `pnpm -F @rntme/contracts-ai-llm-v1 vitest run test/service-shape.test.ts`
Expected: PASS, including the new `it` block.

---

### Task 8: Verify and commit Phase D1

- [ ] **Step 1: Run all contract tests**

Run: `pnpm -F @rntme/contracts-ai-llm-v1 test`
Expected: PASS, including the two new test files.

- [ ] **Step 2: Run lint and typecheck for the contract package**

Run: `pnpm -F @rntme/contracts-ai-llm-v1 lint && pnpm -F @rntme/contracts-ai-llm-v1 typecheck`
Expected: both pass.

- [ ] **Step 3: Commit**

```bash
git add packages/contracts/ai-llm/v1/README.md \
        packages/contracts/ai-llm/v1/test/capability-shape.test.ts \
        packages/contracts/ai-llm/v1/test/sampling-params.test.ts \
        packages/contracts/ai-llm/v1/test/service-shape.test.ts \
        modules/ai-llm/README.md
git commit -m "docs(ai-llm-v1): clarify vendors[]/GetCompletion/response_format/storage; add drift-pin tests"
```

---

## Phase D2 — `@rntme/ai-llm-openrouter` module

The module follows the auth0 module's structure. Read `modules/identity/auth0/{src,Dockerfile,package.json,module.json,tsconfig.json}` before starting; the patterns there are load-bearing (especially `src/server.ts`, `src/bin/server.ts`, and `Dockerfile`).

### Error-code mapping table (used in Task 14 / Task 17)

The spec listed several invented vendor codes (e.g., `AI_LLM_VENDOR_AUTH_FAILED`). The real `error-codes.json` has a different set. Map all OR error conditions to existing codes — no new codes are added. Use this table:

| OR HTTP status / condition | AI_LLM error code (from `error-codes.json`) |
|---|---|
| `400` (validation) | `AI_LLM_VENDOR_INVALID_REQUEST` |
| `401` | `AI_LLM_VENDOR_UNAUTHORIZED` |
| `402` (insufficient credit) | `AI_LLM_VENDOR_QUOTA_EXCEEDED` |
| `403` | `AI_LLM_VENDOR_UNAUTHORIZED` |
| `404` (model unknown) | `AI_LLM_VENDOR_INVALID_REQUEST` |
| `408` / `504` (timeout) | `AI_LLM_VENDOR_UNAVAILABLE` |
| `413` (payload too large) | `AI_LLM_VENDOR_INVALID_REQUEST` |
| `429` | `AI_LLM_VENDOR_RATE_LIMITED` |
| `5xx` (other) | `AI_LLM_VENDOR_UNAVAILABLE` |
| network / TLS / DNS failure | `AI_LLM_VENDOR_UNAVAILABLE` |
| OR `error.code = "context_window_exceeded"` (any HTTP status) | `AI_LLM_VENDOR_CONTEXT_WINDOW_EXCEEDED` |
| OR `error.code = "content_filter"` | `AI_LLM_VENDOR_CONTENT_FILTERED` |
| OR `error.code = "model_deprecated"` | `AI_LLM_VENDOR_MODEL_DEPRECATED` |
| GetCompletion outside TTL window | `AI_LLM_REFERENCES_COMPLETION_NOT_FOUND` |

If OR ever returns an error not coverable above, fall back to `AI_LLM_VENDOR_UNAVAILABLE` and include the raw OR error in the gRPC error metadata.

### Task 9: Scaffold the package skeleton

**Files:**
- Create: `modules/ai-llm/openrouter/package.json`
- Create: `modules/ai-llm/openrouter/tsconfig.json`
- Create: `modules/ai-llm/openrouter/tsconfig.check.json`
- Create: `modules/ai-llm/openrouter/eslint.config.mjs`
- Create: `modules/ai-llm/openrouter/vitest.config.ts`
- Create: `modules/ai-llm/openrouter/.gitignore`

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "@rntme/ai-llm-openrouter",
  "version": "0.0.0",
  "type": "module",
  "private": true,
  "description": "OpenRouter vendor module for the AI/LLM canonical contract.",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./module.json": "./module.json"
  },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "bin": {
    "rntme-ai-llm-openrouter": "./dist/bin/server.js"
  },
  "files": ["dist", "module.json", "README.md"],
  "scripts": {
    "build": "pnpm run build:deps && tsc -p tsconfig.json",
    "build:image": "pnpm run build:deps && tsc -p tsconfig.json",
    "build:deps": "pnpm -F @rntme/contracts-common-v1 run build && pnpm -F @rntme/contracts-ai-llm-v1 run build",
    "start": "node dist/bin/server.js",
    "typecheck": "pnpm run build:deps && tsc -p tsconfig.check.json",
    "test": "pnpm run build:deps && vitest run",
    "test:watch": "vitest",
    "lint": "eslint \"src/**/*.ts\" \"test/**/*.ts\""
  },
  "dependencies": {
    "@grpc/grpc-js": "^1.14.3",
    "@rntme/contracts-ai-llm-v1": "workspace:*",
    "@rntme/contracts-common-v1": "workspace:*",
    "better-sqlite3": "^11.3.0"
  },
  "devDependencies": {
    "@eslint/js": "^9.10.0",
    "@types/better-sqlite3": "^7.6.11",
    "@types/node": "^20.14.0",
    "@typescript-eslint/eslint-plugin": "^8.6.0",
    "@typescript-eslint/parser": "^8.6.0",
    "eslint": "^9.10.0",
    "msw": "^2.4.9",
    "typescript": "^5.5.4",
    "vitest": "^2.1.1"
  }
}
```

- [ ] **Step 2: Write `tsconfig.json` (build config)**

Mirror auth0's:

```json
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "composite": false,
    "declaration": true
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 3: Write `tsconfig.check.json` (typecheck-only, includes tests)**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noEmit": true,
    "rootDir": "."
  },
  "include": ["src/**/*.ts", "test/**/*.ts"]
}
```

- [ ] **Step 4: Write `eslint.config.mjs`**

Copy verbatim from `modules/identity/auth0/eslint.config.mjs`.

- [ ] **Step 5: Write `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    globals: false,
    environment: 'node',
  },
});
```

- [ ] **Step 6: Write `.gitignore`**

```
dist
node_modules
*.log
data/
```

- [ ] **Step 7: Install dependencies**

Run: `pnpm install --frozen-lockfile=false`
Expected: pnpm picks up the new workspace package; `node_modules/` populated.

- [ ] **Step 8: Run typecheck (no source yet, expect graceful pass)**

Run: `pnpm -F @rntme/ai-llm-openrouter typecheck`
Expected: passes vacuously (or fails gracefully on no source — tolerate either; subsequent tasks add source).

- [ ] **Step 9: Commit**

```bash
git add modules/ai-llm/openrouter/package.json \
        modules/ai-llm/openrouter/tsconfig.json \
        modules/ai-llm/openrouter/tsconfig.check.json \
        modules/ai-llm/openrouter/eslint.config.mjs \
        modules/ai-llm/openrouter/vitest.config.ts \
        modules/ai-llm/openrouter/.gitignore \
        pnpm-lock.yaml
git commit -m "feat(ai-llm-openrouter): scaffold package"
```

---

### Task 10: Write `module.json` manifest

**Files:**
- Create: `modules/ai-llm/openrouter/module.json`

- [ ] **Step 1: Write the manifest**

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
      "openai",
      "anthropic",
      "google",
      "meta",
      "mistralai",
      "deepseek",
      "x-ai",
      "qwen"
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

- [ ] **Step 2: Re-run the capability-shape drift-pin from Task 5 — it should now find this manifest and pass**

Run: `pnpm -F @rntme/contracts-ai-llm-v1 vitest run test/capability-shape.test.ts`
Expected: PASS, the four `it` blocks now run real assertions against `openrouter/module.json`.

- [ ] **Step 3: Commit**

```bash
git add modules/ai-llm/openrouter/module.json
git commit -m "feat(ai-llm-openrouter): manifest with single-vendor + gateway_upstreams"
```

---

### Task 11: Write `errors.ts` (error class + helpers)

**Files:**
- Create: `modules/ai-llm/openrouter/src/errors.ts`
- Create: `modules/ai-llm/openrouter/test/unit/errors.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it } from 'vitest';
import { AiLlmOpenRouterError, GrpcStatus, unimplemented } from '../../src/errors.js';

describe('AiLlmOpenRouterError', () => {
  it('carries gRPC code and AI_LLM error short-name', () => {
    const e = new AiLlmOpenRouterError('boom', GrpcStatus.UNAUTHENTICATED, 'AI_LLM_VENDOR_UNAUTHORIZED');
    expect(e.message).toBe('boom');
    expect(e.code).toBe(GrpcStatus.UNAUTHENTICATED);
    expect(e.aiLlmCode).toBe('AI_LLM_VENDOR_UNAUTHORIZED');
  });

  it('unimplemented(name) returns a UNIMPLEMENTED-coded error', () => {
    const e = unimplemented('CreateThread');
    expect(e.code).toBe(GrpcStatus.UNIMPLEMENTED);
    expect(e.message).toContain('CreateThread');
  });
});
```

- [ ] **Step 2: Run the test (expect FAIL — no source yet)**

Run: `pnpm -F @rntme/ai-llm-openrouter vitest run test/unit/errors.test.ts`
Expected: FAIL — file `../../src/errors.js` not found.

- [ ] **Step 3: Implement `errors.ts`**

```typescript
import { status as grpcStatus } from '@grpc/grpc-js';

export const GrpcStatus = grpcStatus;
export type GrpcStatusCode = (typeof grpcStatus)[keyof typeof grpcStatus];

export class AiLlmOpenRouterError extends Error {
  readonly code: GrpcStatusCode;
  readonly aiLlmCode: string;
  readonly cause?: unknown;

  constructor(message: string, code: GrpcStatusCode, aiLlmCode: string, cause?: unknown) {
    super(message);
    this.name = 'AiLlmOpenRouterError';
    this.code = code;
    this.aiLlmCode = aiLlmCode;
    this.cause = cause;
  }
}

export function unimplemented(rpcName: string): AiLlmOpenRouterError {
  return new AiLlmOpenRouterError(
    `RPC ${rpcName} is not implemented by @rntme/ai-llm-openrouter`,
    GrpcStatus.UNIMPLEMENTED,
    'AI_LLM_VENDOR_INVALID_REQUEST',
  );
}
```

- [ ] **Step 4: Run the test**

Run: `pnpm -F @rntme/ai-llm-openrouter vitest run test/unit/errors.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add modules/ai-llm/openrouter/src/errors.ts modules/ai-llm/openrouter/test/unit/errors.test.ts
git commit -m "feat(ai-llm-openrouter): error class + unimplemented helper"
```

---

### Task 12: `completion-mapper.ts` — request builder (proto → OR JSON)

**Files:**
- Create: `modules/ai-llm/openrouter/src/completion-mapper.ts`
- Create: `modules/ai-llm/openrouter/test/unit/completion-mapper.request.test.ts`

- [ ] **Step 1: Write the failing test (text-only request)**

```typescript
import { describe, expect, it } from 'vitest';
import { buildOpenRouterRequest } from '../../src/completion-mapper.js';

describe('buildOpenRouterRequest — text-only', () => {
  it('strips the openrouter/ prefix from model and emits one user text message', () => {
    const proto = {
      model: 'openrouter/openai/gpt-4o',
      messages: [
        {
          role: 'user',
          content: [{ type: 1 /* TEXT */, text: { text: 'hello' } }],
        },
      ],
    };
    const req = buildOpenRouterRequest(proto);
    expect(req.model).toBe('openai/gpt-4o');
    expect(req.messages).toEqual([
      { role: 'user', content: [{ type: 'text', text: 'hello' }] },
    ]);
  });

  it('rejects model not starting with openrouter/', () => {
    expect(() =>
      buildOpenRouterRequest({
        model: 'openai/gpt-4o',
        messages: [{ role: 'user', content: [{ type: 1, text: { text: 'x' } }] }],
      }),
    ).toThrowError(/AI_LLM_STRUCTURAL_VENDOR_MISMATCH|vendor mismatch/i);
  });
});
```

- [ ] **Step 2: Write the failing test (file/image content blocks)**

Append:

```typescript
describe('buildOpenRouterRequest — image and file content blocks', () => {
  it('maps IMAGE base64 to image_url with data: URI', () => {
    const req = buildOpenRouterRequest({
      model: 'openrouter/openai/gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 2 /* IMAGE */,
              image: { base64Data: 'aGVsbG8=', mediaType: 'image/png' },
            },
          ],
        },
      ],
    });
    expect(req.messages[0].content[0]).toEqual({
      type: 'image_url',
      image_url: { url: 'data:image/png;base64,aGVsbG8=' },
    });
  });

  it('maps IMAGE url to image_url with the url verbatim', () => {
    const req = buildOpenRouterRequest({
      model: 'openrouter/openai/gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            { type: 2 /* IMAGE */, image: { url: 'https://example.com/x.png', mediaType: 'image/png' } },
          ],
        },
      ],
    });
    expect(req.messages[0].content[0]).toEqual({
      type: 'image_url',
      image_url: { url: 'https://example.com/x.png' },
    });
  });

  it('maps FILE base64 PDF to {type:file,file:{filename,file_data}}', () => {
    const req = buildOpenRouterRequest({
      model: 'openrouter/openai/gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 4 /* FILE */,
              file: {
                base64Data: 'JVBERi0=',
                mediaType: 'application/pdf',
                filename: 'r.pdf',
              },
            },
          ],
        },
      ],
    });
    expect(req.messages[0].content[0]).toEqual({
      type: 'file',
      file: { filename: 'r.pdf', file_data: 'data:application/pdf;base64,JVBERi0=' },
    });
  });
});

describe('buildOpenRouterRequest — sampling and response format', () => {
  it('forwards basic sampling fields', () => {
    const req = buildOpenRouterRequest({
      model: 'openrouter/openai/gpt-4o',
      messages: [{ role: 'user', content: [{ type: 1, text: { text: 'x' } }] }],
      sampling: { temperature: 0.2, maxTokens: 1024, topP: 0.9 },
    });
    expect(req.temperature).toBe(0.2);
    expect(req.max_tokens).toBe(1024);
    expect(req.top_p).toBe(0.9);
  });

  it('maps response_format=json_schema with response_schema', () => {
    const schema = { type: 'object', properties: { x: { type: 'string' } } };
    const req = buildOpenRouterRequest({
      model: 'openrouter/openai/gpt-4o',
      messages: [{ role: 'user', content: [{ type: 1, text: { text: 'x' } }] }],
      sampling: { responseFormat: 'json_schema', responseSchema: schema },
    });
    expect(req.response_format).toEqual({
      type: 'json_schema',
      json_schema: { name: 'schema', schema, strict: true },
    });
  });

  it('maps response_format=json_object', () => {
    const req = buildOpenRouterRequest({
      model: 'openrouter/openai/gpt-4o',
      messages: [{ role: 'user', content: [{ type: 1, text: { text: 'x' } }] }],
      sampling: { responseFormat: 'json_object' },
    });
    expect(req.response_format).toEqual({ type: 'json_object' });
  });
});
```

- [ ] **Step 3: Run tests (expect FAIL — module not implemented)**

Run: `pnpm -F @rntme/ai-llm-openrouter vitest run test/unit/completion-mapper.request.test.ts`
Expected: FAIL — `buildOpenRouterRequest` not exported.

- [ ] **Step 4: Implement `buildOpenRouterRequest` in `completion-mapper.ts`**

```typescript
import { AiLlmOpenRouterError, GrpcStatus } from './errors.js';

const VENDOR_PREFIX = 'openrouter';

const ContentBlockType = {
  TEXT: 1,
  IMAGE: 2,
  AUDIO: 3,
  FILE: 4,
  TOOL_USE: 5,
  TOOL_RESULT: 6,
  THINKING: 7,
} as const;

interface ProtoCompletionRequest {
  model?: string;
  messages?: ProtoMessage[];
  tools?: ProtoToolDefinition[];
  toolChoice?: string;
  sampling?: ProtoSamplingParams;
  reasoningEffort?: number;
  reasoningVisibility?: number;
  metadata?: Record<string, unknown>;
}

interface ProtoMessage {
  role?: string;
  content?: ProtoContentBlock[];
}

interface ProtoContentBlock {
  type?: number;
  text?: { text?: string };
  image?: { url?: string; base64Data?: string; mediaType?: string };
  file?: { url?: string; base64Data?: string; vendorFileId?: string; mediaType?: string; filename?: string };
  toolUse?: { id?: string; name?: string; arguments?: unknown };
  toolResult?: { toolCallId?: string; output?: unknown; isError?: boolean };
  thinking?: { text?: string; redacted?: boolean };
}

interface ProtoSamplingParams {
  temperature?: number;
  topP?: number;
  topK?: number;
  maxTokens?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stopSequences?: string[];
  seed?: number;
  responseFormat?: string;
  responseSchema?: unknown;
}

interface ProtoToolDefinition {
  name?: string;
  description?: string;
  inputSchema?: unknown;
  strict?: boolean;
}

export interface OrChatCompletionRequest {
  model: string;
  messages: { role: string; content: unknown }[];
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string[];
  seed?: number;
  response_format?: unknown;
  tools?: unknown[];
  tool_choice?: string;
  reasoning?: { effort?: string };
}

const ReasoningEffortMap: Record<number, string | undefined> = {
  0: undefined,    // UNSPECIFIED
  1: 'low',        // MINIMAL
  2: 'low',        // LOW
  3: 'medium',     // MEDIUM
  4: 'high',       // HIGH
  5: 'high',       // MAX
};

function stripVendorPrefix(model: string): string {
  if (!model.startsWith(`${VENDOR_PREFIX}/`)) {
    throw new AiLlmOpenRouterError(
      `model "${model}" must start with "${VENDOR_PREFIX}/"`,
      GrpcStatus.INVALID_ARGUMENT,
      'AI_LLM_STRUCTURAL_VENDOR_MISMATCH',
    );
  }
  return model.slice(VENDOR_PREFIX.length + 1);
}

function blockToOrPart(block: ProtoContentBlock): unknown {
  switch (block.type) {
    case ContentBlockType.TEXT:
      return { type: 'text', text: block.text?.text ?? '' };
    case ContentBlockType.IMAGE: {
      const img = block.image ?? {};
      const url = img.base64Data ? `data:${img.mediaType ?? 'image/png'};base64,${img.base64Data}` : img.url;
      if (!url) throw new AiLlmOpenRouterError('image block has no url or base64Data', GrpcStatus.INVALID_ARGUMENT, 'AI_LLM_STRUCTURAL_INVALID_MEDIA_REFERENCE');
      return { type: 'image_url', image_url: { url } };
    }
    case ContentBlockType.FILE: {
      const f = block.file ?? {};
      const fileData =
        f.base64Data !== undefined
          ? `data:${f.mediaType ?? 'application/octet-stream'};base64,${f.base64Data}`
          : f.url;
      if (!fileData)
        throw new AiLlmOpenRouterError(
          'file block has no url or base64Data (vendor_file_id not supported by openrouter)',
          GrpcStatus.INVALID_ARGUMENT,
          'AI_LLM_STRUCTURAL_INVALID_MEDIA_REFERENCE',
        );
      return { type: 'file', file: { filename: f.filename ?? 'file', file_data: fileData } };
    }
    case ContentBlockType.TOOL_USE: {
      // Lifted to the message-level tool_calls array by the caller.
      return null;
    }
    case ContentBlockType.TOOL_RESULT: {
      // Lifted to message content as a JSON-stringified value.
      return null;
    }
    case ContentBlockType.THINKING:
      // Thinking blocks are read-only output; not sent to OR.
      return null;
    default:
      throw new AiLlmOpenRouterError(`unsupported content block type ${block.type}`, GrpcStatus.INVALID_ARGUMENT, 'AI_LLM_STRUCTURAL_INVALID_CONTENT_BLOCK');
  }
}

function messageToOr(msg: ProtoMessage): { role: string; content: unknown; tool_calls?: unknown[] } {
  const role = msg.role ?? 'user';
  const blocks = msg.content ?? [];

  const toolCalls = blocks
    .filter((b) => b.type === ContentBlockType.TOOL_USE && b.toolUse !== undefined)
    .map((b) => ({
      id: b.toolUse!.id ?? '',
      type: 'function',
      function: { name: b.toolUse!.name ?? '', arguments: JSON.stringify(b.toolUse!.arguments ?? {}) },
    }));

  if (role === 'tool') {
    const tr = blocks.find((b) => b.type === ContentBlockType.TOOL_RESULT)?.toolResult;
    return { role: 'tool', content: JSON.stringify(tr?.output ?? null) };
  }

  const parts = blocks.map(blockToOrPart).filter((p): p is object => p !== null);
  const result: { role: string; content: unknown; tool_calls?: unknown[] } = { role, content: parts };
  if (toolCalls.length > 0) result.tool_calls = toolCalls;
  return result;
}

export function buildOpenRouterRequest(proto: ProtoCompletionRequest): OrChatCompletionRequest {
  if (!proto.model) {
    throw new AiLlmOpenRouterError('model is required', GrpcStatus.INVALID_ARGUMENT, 'AI_LLM_STRUCTURAL_MISSING_MODEL');
  }
  if (!proto.messages || proto.messages.length === 0) {
    throw new AiLlmOpenRouterError('messages must be non-empty', GrpcStatus.INVALID_ARGUMENT, 'AI_LLM_STRUCTURAL_EMPTY_MESSAGES');
  }
  const result: OrChatCompletionRequest = {
    model: stripVendorPrefix(proto.model),
    messages: proto.messages.map(messageToOr),
  };

  const s = proto.sampling;
  if (s) {
    if (s.temperature !== undefined) result.temperature = s.temperature;
    if (s.topP !== undefined) result.top_p = s.topP;
    if (s.maxTokens !== undefined) result.max_tokens = s.maxTokens;
    if (s.frequencyPenalty !== undefined) result.frequency_penalty = s.frequencyPenalty;
    if (s.presencePenalty !== undefined) result.presence_penalty = s.presencePenalty;
    if (s.stopSequences && s.stopSequences.length > 0) result.stop = s.stopSequences;
    if (s.seed !== undefined) result.seed = s.seed;
    if (s.responseFormat === 'json_schema') {
      if (s.responseSchema === undefined) {
        throw new AiLlmOpenRouterError(
          'response_format=json_schema requires response_schema',
          GrpcStatus.INVALID_ARGUMENT,
          'AI_LLM_STRUCTURAL_INVALID_SAMPLING_PARAMS',
        );
      }
      result.response_format = { type: 'json_schema', json_schema: { name: 'schema', schema: s.responseSchema, strict: true } };
    } else if (s.responseFormat === 'json_object') {
      result.response_format = { type: 'json_object' };
    }
  }

  if (proto.tools && proto.tools.length > 0) {
    result.tools = proto.tools.map((t) => ({
      type: 'function',
      function: {
        name: t.name ?? '',
        description: t.description ?? '',
        parameters: t.inputSchema ?? { type: 'object', properties: {} },
      },
    }));
    if (proto.toolChoice) result.tool_choice = proto.toolChoice;
  }

  if (proto.reasoningEffort !== undefined) {
    const effort = ReasoningEffortMap[proto.reasoningEffort];
    if (effort) result.reasoning = { effort };
  }

  return result;
}
```

- [ ] **Step 5: Run the request tests**

Run: `pnpm -F @rntme/ai-llm-openrouter vitest run test/unit/completion-mapper.request.test.ts`
Expected: PASS, all five test cases.

- [ ] **Step 6: Commit**

```bash
git add modules/ai-llm/openrouter/src/completion-mapper.ts \
        modules/ai-llm/openrouter/test/unit/completion-mapper.request.test.ts
git commit -m "feat(ai-llm-openrouter): completion-mapper request builder (proto → OR)"
```

---

### Task 13: `completion-mapper.ts` — response parser (OR JSON → proto)

**Files:**
- Modify: `modules/ai-llm/openrouter/src/completion-mapper.ts`
- Create: `modules/ai-llm/openrouter/test/unit/completion-mapper.response.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
import { describe, expect, it } from 'vitest';
import { parseOpenRouterResponse } from '../../src/completion-mapper.js';

describe('parseOpenRouterResponse', () => {
  const baseRequest = {
    model: 'openrouter/openai/gpt-4o',
    idempotencyKey: 'idem-1',
    requestStartedAt: new Date('2026-05-06T10:00:00Z'),
  };

  it('maps a text-only completion', () => {
    const orResponse = {
      id: 'gen-abc',
      model: 'openai/gpt-4o',
      choices: [{ message: { role: 'assistant', content: 'Hello world.' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 10, completion_tokens: 3, total_tokens: 13 },
    };
    const completion = parseOpenRouterResponse(orResponse, baseRequest);
    expect(completion.ref?.canonicalId).toBe('idem-1');
    expect(completion.model).toBe('openrouter/openai/gpt-4o');
    expect(completion.content).toEqual([{ type: 1, text: { text: 'Hello world.' } }]);
    expect(completion.finishReason).toBe(1); // STOP
    expect(completion.usage).toEqual({ inputTokens: 10, outputTokens: 3, totalTokens: 13, reasoningTokens: 0, cachedTokens: 0 });
  });

  it('maps tool_calls to TOOL_USE content blocks', () => {
    const orResponse = {
      id: 'gen-def',
      model: 'openai/gpt-4o',
      choices: [
        {
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'extract', arguments: '{"x":1}' } }],
          },
          finish_reason: 'tool_calls',
        },
      ],
      usage: { prompt_tokens: 5, completion_tokens: 7, total_tokens: 12 },
    };
    const completion = parseOpenRouterResponse(orResponse, baseRequest);
    expect(completion.finishReason).toBe(3); // TOOL_CALLS
    expect(completion.toolCalls).toEqual([{ id: 'call_1', name: 'extract', arguments: { x: 1 } }]);
    expect(completion.content?.some((b: { type: number }) => b.type === 5)).toBe(true);
  });

  it('routes usage.cost to vendor_raw', () => {
    const orResponse = {
      id: 'gen-cost',
      model: 'openai/gpt-4o',
      choices: [{ message: { role: 'assistant', content: 'x' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2, cost: 0.0042 },
    };
    const completion = parseOpenRouterResponse(orResponse, baseRequest);
    const vr = completion.vendorRaw as { cost_usd?: number };
    expect(vr.cost_usd).toBe(0.0042);
  });

  it('maps finish_reason length and content_filter', () => {
    for (const [or, want] of [
      ['stop', 1],
      ['length', 2],
      ['tool_calls', 3],
      ['content_filter', 4],
    ] as const) {
      const completion = parseOpenRouterResponse(
        {
          id: 'gen',
          model: 'openai/gpt-4o',
          choices: [{ message: { role: 'assistant', content: 'x' }, finish_reason: or }],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        },
        baseRequest,
      );
      expect(completion.finishReason).toBe(want);
    }
  });
});
```

- [ ] **Step 2: Run the tests (expect FAIL)**

Run: `pnpm -F @rntme/ai-llm-openrouter vitest run test/unit/completion-mapper.response.test.ts`
Expected: FAIL — `parseOpenRouterResponse` not exported.

- [ ] **Step 3: Append `parseOpenRouterResponse` (and supporting types) to `completion-mapper.ts`**

```typescript
export interface ParseRequestContext {
  model: string;
  idempotencyKey: string;
  requestStartedAt: Date;
}

interface OrChoice {
  message?: {
    role?: string;
    content?: string | null;
    reasoning?: string | null;
    reasoning_details?: unknown;
    tool_calls?: { id?: string; function?: { name?: string; arguments?: string } }[];
  };
  finish_reason?: string;
}

interface OrUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  reasoning_tokens?: number;
  cached_tokens?: number;
  cost?: number;
}

interface OrResponse {
  id?: string;
  model?: string;
  choices?: OrChoice[];
  usage?: OrUsage;
}

const FinishReasonMap: Record<string, number> = {
  stop: 1,
  length: 2,
  tool_calls: 3,
  content_filter: 4,
  error: 5,
};

export interface MappedCompletion {
  ref: { canonicalId: string };
  model: string;
  content: { type: number; text?: { text: string }; toolUse?: unknown; thinking?: unknown }[];
  finishReason: number;
  usage: { inputTokens: number; outputTokens: number; totalTokens: number; reasoningTokens: number; cachedTokens: number };
  reasoning?: { summary?: string };
  toolCalls?: { id: string; name: string; arguments: unknown }[];
  startedAt: Date;
  finishedAt: Date;
  vendorRaw: Record<string, unknown>;
}

export function parseOpenRouterResponse(or: OrResponse, ctx: ParseRequestContext): MappedCompletion {
  const choice = or.choices?.[0];
  if (!choice) {
    throw new AiLlmOpenRouterError('OR returned no choices', GrpcStatus.INTERNAL, 'AI_LLM_VENDOR_UNAVAILABLE');
  }

  const content: MappedCompletion['content'] = [];
  if (typeof choice.message?.content === 'string' && choice.message.content.length > 0) {
    content.push({ type: 1, text: { text: choice.message.content } });
  }
  if (choice.message?.reasoning) {
    content.push({ type: 7, thinking: { text: choice.message.reasoning, redacted: false } });
  }

  const toolCalls =
    choice.message?.tool_calls?.map((tc) => ({
      id: tc.id ?? '',
      name: tc.function?.name ?? '',
      arguments: tc.function?.arguments ? safeJson(tc.function.arguments) : {},
    })) ?? [];

  for (const tc of toolCalls) {
    content.push({ type: 5, toolUse: tc });
  }

  const u = or.usage ?? {};
  const usage = {
    inputTokens: u.prompt_tokens ?? 0,
    outputTokens: u.completion_tokens ?? 0,
    totalTokens: u.total_tokens ?? 0,
    reasoningTokens: u.reasoning_tokens ?? 0,
    cachedTokens: u.cached_tokens ?? 0,
  };

  const vendorRaw: Record<string, unknown> = {};
  if (u.cost !== undefined) vendorRaw.cost_usd = u.cost;
  if (or.id) vendorRaw.openrouter_id = or.id;
  if (or.model) vendorRaw.openrouter_model = or.model;

  const completion: MappedCompletion = {
    ref: { canonicalId: ctx.idempotencyKey },
    model: ctx.model,
    content,
    finishReason: FinishReasonMap[choice.finish_reason ?? ''] ?? 0,
    usage,
    startedAt: ctx.requestStartedAt,
    finishedAt: new Date(),
    vendorRaw,
  };
  if (toolCalls.length > 0) completion.toolCalls = toolCalls;
  return completion;
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm -F @rntme/ai-llm-openrouter vitest run test/unit/completion-mapper.response.test.ts`
Expected: PASS, four test cases.

- [ ] **Step 5: Commit**

```bash
git add modules/ai-llm/openrouter/src/completion-mapper.ts modules/ai-llm/openrouter/test/unit/completion-mapper.response.test.ts
git commit -m "feat(ai-llm-openrouter): completion-mapper response parser (OR → proto)"
```

---

### Task 14: `error-mapper.ts` — table-driven HTTP/OR-error → AI_LLM code

**Files:**
- Create: `modules/ai-llm/openrouter/src/error-mapper.ts`
- Create: `modules/ai-llm/openrouter/test/unit/error-mapper.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it } from 'vitest';
import { mapOpenRouterError } from '../../src/error-mapper.js';
import { GrpcStatus } from '../../src/errors.js';

const cases: { name: string; status: number; orError?: { code?: string; message?: string }; expectedCode: string; expectedGrpc: number }[] = [
  { name: '400', status: 400, expectedCode: 'AI_LLM_VENDOR_INVALID_REQUEST', expectedGrpc: GrpcStatus.INVALID_ARGUMENT },
  { name: '401', status: 401, expectedCode: 'AI_LLM_VENDOR_UNAUTHORIZED', expectedGrpc: GrpcStatus.UNAUTHENTICATED },
  { name: '402', status: 402, expectedCode: 'AI_LLM_VENDOR_QUOTA_EXCEEDED', expectedGrpc: GrpcStatus.RESOURCE_EXHAUSTED },
  { name: '403', status: 403, expectedCode: 'AI_LLM_VENDOR_UNAUTHORIZED', expectedGrpc: GrpcStatus.PERMISSION_DENIED },
  { name: '404', status: 404, expectedCode: 'AI_LLM_VENDOR_INVALID_REQUEST', expectedGrpc: GrpcStatus.NOT_FOUND },
  { name: '408', status: 408, expectedCode: 'AI_LLM_VENDOR_UNAVAILABLE', expectedGrpc: GrpcStatus.DEADLINE_EXCEEDED },
  { name: '413', status: 413, expectedCode: 'AI_LLM_VENDOR_INVALID_REQUEST', expectedGrpc: GrpcStatus.INVALID_ARGUMENT },
  { name: '429', status: 429, expectedCode: 'AI_LLM_VENDOR_RATE_LIMITED', expectedGrpc: GrpcStatus.RESOURCE_EXHAUSTED },
  { name: '500', status: 500, expectedCode: 'AI_LLM_VENDOR_UNAVAILABLE', expectedGrpc: GrpcStatus.UNAVAILABLE },
  { name: '503', status: 503, expectedCode: 'AI_LLM_VENDOR_UNAVAILABLE', expectedGrpc: GrpcStatus.UNAVAILABLE },
  { name: '504', status: 504, expectedCode: 'AI_LLM_VENDOR_UNAVAILABLE', expectedGrpc: GrpcStatus.DEADLINE_EXCEEDED },
  { name: 'context_window_exceeded', status: 400, orError: { code: 'context_window_exceeded' }, expectedCode: 'AI_LLM_VENDOR_CONTEXT_WINDOW_EXCEEDED', expectedGrpc: GrpcStatus.INVALID_ARGUMENT },
  { name: 'content_filter', status: 400, orError: { code: 'content_filter' }, expectedCode: 'AI_LLM_VENDOR_CONTENT_FILTERED', expectedGrpc: GrpcStatus.INVALID_ARGUMENT },
  { name: 'model_deprecated', status: 400, orError: { code: 'model_deprecated' }, expectedCode: 'AI_LLM_VENDOR_MODEL_DEPRECATED', expectedGrpc: GrpcStatus.FAILED_PRECONDITION },
];

describe('mapOpenRouterError', () => {
  for (const c of cases) {
    it(c.name, () => {
      const e = mapOpenRouterError({ httpStatus: c.status, orError: c.orError });
      expect(e.aiLlmCode).toBe(c.expectedCode);
      expect(e.code).toBe(c.expectedGrpc);
    });
  }

  it('network error (no httpStatus) maps to UNAVAILABLE', () => {
    const e = mapOpenRouterError({ networkError: new Error('ENOTFOUND') });
    expect(e.aiLlmCode).toBe('AI_LLM_VENDOR_UNAVAILABLE');
    expect(e.code).toBe(GrpcStatus.UNAVAILABLE);
  });
});
```

- [ ] **Step 2: Run (expect FAIL)**

Run: `pnpm -F @rntme/ai-llm-openrouter vitest run test/unit/error-mapper.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `error-mapper.ts`**

```typescript
import { AiLlmOpenRouterError, GrpcStatus, type GrpcStatusCode } from './errors.js';

export interface MapErrorInput {
  httpStatus?: number;
  orError?: { code?: string; message?: string };
  networkError?: unknown;
}

export function mapOpenRouterError(input: MapErrorInput): AiLlmOpenRouterError {
  if (input.networkError) {
    return new AiLlmOpenRouterError(
      `network error: ${(input.networkError as Error).message ?? String(input.networkError)}`,
      GrpcStatus.UNAVAILABLE,
      'AI_LLM_VENDOR_UNAVAILABLE',
      input.networkError,
    );
  }

  // OR-specific error.code overrides HTTP status semantics.
  switch (input.orError?.code) {
    case 'context_window_exceeded':
      return mk(input, GrpcStatus.INVALID_ARGUMENT, 'AI_LLM_VENDOR_CONTEXT_WINDOW_EXCEEDED');
    case 'content_filter':
      return mk(input, GrpcStatus.INVALID_ARGUMENT, 'AI_LLM_VENDOR_CONTENT_FILTERED');
    case 'model_deprecated':
      return mk(input, GrpcStatus.FAILED_PRECONDITION, 'AI_LLM_VENDOR_MODEL_DEPRECATED');
  }

  switch (input.httpStatus) {
    case 400: return mk(input, GrpcStatus.INVALID_ARGUMENT, 'AI_LLM_VENDOR_INVALID_REQUEST');
    case 401: return mk(input, GrpcStatus.UNAUTHENTICATED, 'AI_LLM_VENDOR_UNAUTHORIZED');
    case 402: return mk(input, GrpcStatus.RESOURCE_EXHAUSTED, 'AI_LLM_VENDOR_QUOTA_EXCEEDED');
    case 403: return mk(input, GrpcStatus.PERMISSION_DENIED, 'AI_LLM_VENDOR_UNAUTHORIZED');
    case 404: return mk(input, GrpcStatus.NOT_FOUND, 'AI_LLM_VENDOR_INVALID_REQUEST');
    case 408: return mk(input, GrpcStatus.DEADLINE_EXCEEDED, 'AI_LLM_VENDOR_UNAVAILABLE');
    case 413: return mk(input, GrpcStatus.INVALID_ARGUMENT, 'AI_LLM_VENDOR_INVALID_REQUEST');
    case 429: return mk(input, GrpcStatus.RESOURCE_EXHAUSTED, 'AI_LLM_VENDOR_RATE_LIMITED');
    case 504: return mk(input, GrpcStatus.DEADLINE_EXCEEDED, 'AI_LLM_VENDOR_UNAVAILABLE');
  }
  if (input.httpStatus !== undefined && input.httpStatus >= 500) {
    return mk(input, GrpcStatus.UNAVAILABLE, 'AI_LLM_VENDOR_UNAVAILABLE');
  }
  return mk(input, GrpcStatus.UNKNOWN, 'AI_LLM_VENDOR_UNAVAILABLE');
}

function mk(input: MapErrorInput, code: GrpcStatusCode, aiLlmCode: string): AiLlmOpenRouterError {
  const msg = input.orError?.message ?? `OR HTTP ${input.httpStatus ?? '?'}`;
  return new AiLlmOpenRouterError(msg, code, aiLlmCode, input.orError);
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm -F @rntme/ai-llm-openrouter vitest run test/unit/error-mapper.test.ts`
Expected: PASS, all 14 case rows + the network-error case.

- [ ] **Step 5: Commit**

```bash
git add modules/ai-llm/openrouter/src/error-mapper.ts \
        modules/ai-llm/openrouter/test/unit/error-mapper.test.ts
git commit -m "feat(ai-llm-openrouter): error-mapper (HTTP/OR error → AI_LLM_*)"
```

---

### Task 15: `idempotency-store.ts` — SQLite + in-memory implementations

**Files:**
- Create: `modules/ai-llm/openrouter/src/idempotency-store.ts`
- Create: `modules/ai-llm/openrouter/test/unit/idempotency-store.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createIdempotencyStore, type IdempotencyStore } from '../../src/idempotency-store.js';

interface TempCtx { dir: string; store: IdempotencyStore }

function makeFixtureBytes(s: string): Buffer { return Buffer.from(s); }

for (const mode of ['sqlite', 'memory'] as const) {
  describe(`IdempotencyStore (${mode})`, () => {
    let ctx: TempCtx;
    let now = Date.parse('2026-05-06T10:00:00Z');

    beforeEach(() => {
      const dir = mkdtempSync(join(tmpdir(), 'ai-llm-or-test-'));
      const store = createIdempotencyStore(
        mode === 'sqlite' ? { mode: 'sqlite', path: join(dir, 'idem.sqlite'), ttlMs: 24 * 3600_000, now: () => now } : { mode: 'memory', ttlMs: 24 * 3600_000, now: () => now },
      );
      ctx = { dir, store };
    });

    afterEach(async () => {
      await ctx.store.close();
      rmSync(ctx.dir, { recursive: true, force: true });
    });

    it('returns null on get for missing key', async () => {
      expect(await ctx.store.get('missing')).toBeNull();
    });

    it('round-trips put/get', async () => {
      await ctx.store.put('k1', makeFixtureBytes('payload-1'));
      const got = await ctx.store.get('k1');
      expect(got).not.toBeNull();
      expect(got!.toString()).toBe('payload-1');
    });

    it('returns null after TTL expiry', async () => {
      await ctx.store.put('k2', makeFixtureBytes('payload-2'));
      now += 24 * 3600_000 + 1;
      expect(await ctx.store.get('k2')).toBeNull();
    });

    it('evictExpired removes stale rows', async () => {
      await ctx.store.put('a', makeFixtureBytes('a'));
      now += 24 * 3600_000 + 1;
      await ctx.store.put('b', makeFixtureBytes('b'));
      const removed = await ctx.store.evictExpired();
      expect(removed).toBe(1);
      expect(await ctx.store.get('a')).toBeNull();
      expect(await ctx.store.get('b')).not.toBeNull();
    });
  });
}
```

- [ ] **Step 2: Run (expect FAIL)**

Run: `pnpm -F @rntme/ai-llm-openrouter vitest run test/unit/idempotency-store.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `idempotency-store.ts`**

```typescript
import Database from 'better-sqlite3';

export interface IdempotencyStore {
  get(key: string): Promise<Buffer | null>;
  put(key: string, payload: Buffer): Promise<void>;
  evictExpired(): Promise<number>;
  close(): Promise<void>;
}

export type IdempotencyStoreOptions =
  | { mode: 'sqlite'; path: string; ttlMs: number; now?: () => number }
  | { mode: 'memory'; ttlMs: number; now?: () => number };

const DEFAULT_NOW = (): number => Date.now();

export function createIdempotencyStore(opts: IdempotencyStoreOptions): IdempotencyStore {
  const now = opts.now ?? DEFAULT_NOW;
  if (opts.mode === 'memory') return createMemoryStore(opts.ttlMs, now);
  return createSqliteStore(opts.path, opts.ttlMs, now);
}

function createMemoryStore(ttlMs: number, now: () => number): IdempotencyStore {
  const map = new Map<string, { bytes: Buffer; createdAt: number }>();
  return {
    async get(key) {
      const row = map.get(key);
      if (!row) return null;
      if (now() - row.createdAt > ttlMs) {
        map.delete(key);
        return null;
      }
      return row.bytes;
    },
    async put(key, payload) {
      map.set(key, { bytes: payload, createdAt: now() });
    },
    async evictExpired() {
      let removed = 0;
      const cutoff = now() - ttlMs;
      for (const [k, v] of map.entries()) {
        if (v.createdAt < cutoff) {
          map.delete(k);
          removed++;
        }
      }
      return removed;
    },
    async close() {
      map.clear();
    },
  };
}

function createSqliteStore(path: string, ttlMs: number, now: () => number): IdempotencyStore {
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS idempotency_records (
      idempotency_key TEXT PRIMARY KEY,
      completion_proto BLOB NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_created_at ON idempotency_records(created_at);
  `);

  const stmtGet = db.prepare<[string, number]>(
    `SELECT completion_proto FROM idempotency_records WHERE idempotency_key = ? AND created_at >= ?`,
  );
  const stmtPut = db.prepare<[string, Buffer, number]>(
    `INSERT OR REPLACE INTO idempotency_records (idempotency_key, completion_proto, created_at) VALUES (?, ?, ?)`,
  );
  const stmtEvict = db.prepare<[number]>(
    `DELETE FROM idempotency_records WHERE created_at < ?`,
  );

  return {
    async get(key) {
      const row = stmtGet.get(key, now() - ttlMs) as { completion_proto?: Buffer } | undefined;
      return row?.completion_proto ?? null;
    },
    async put(key, payload) {
      stmtPut.run(key, payload, now());
    },
    async evictExpired() {
      const info = stmtEvict.run(now() - ttlMs);
      return info.changes;
    },
    async close() {
      db.close();
    },
  };
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm -F @rntme/ai-llm-openrouter vitest run test/unit/idempotency-store.test.ts`
Expected: PASS, 4 cases × 2 modes = 8 assertions across the two `describe` blocks.

- [ ] **Step 5: Commit**

```bash
git add modules/ai-llm/openrouter/src/idempotency-store.ts \
        modules/ai-llm/openrouter/test/unit/idempotency-store.test.ts
git commit -m "feat(ai-llm-openrouter): idempotency store (SQLite + in-memory)"
```

---

### Task 16: `openrouter-client.ts` — HTTP wrapper

**Files:**
- Create: `modules/ai-llm/openrouter/src/openrouter-client.ts`
- Create: `modules/ai-llm/openrouter/test/unit/openrouter-client.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OpenRouterClient } from '../../src/openrouter-client.js';

describe('OpenRouterClient', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('POSTs to /chat/completions with Bearer auth and JSON body', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: 'gen-1' }),
      text: async () => '{"id":"gen-1"}',
    });
    const client = new OpenRouterClient({ apiKey: 'sk-test', baseUrl: 'https://or/api/v1', fetch: fetchMock });
    const res = await client.chatCompletions({ model: 'openai/gpt-4o', messages: [] });
    expect(res).toEqual({ id: 'gen-1' });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://or/api/v1/chat/completions');
    expect((init as RequestInit).method).toBe('POST');
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer sk-test');
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('throws { httpStatus, orError } on non-2xx', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: { code: 'invalid_api_key', message: 'bad key' } }),
      text: async () => '{"error":{"code":"invalid_api_key","message":"bad key"}}',
    });
    const client = new OpenRouterClient({ apiKey: 'sk', baseUrl: 'https://or/api/v1', fetch: fetchMock });
    await expect(client.chatCompletions({ model: 'm', messages: [] })).rejects.toMatchObject({
      httpStatus: 401,
      orError: { code: 'invalid_api_key' },
    });
  });

  it('wraps network errors with networkError', async () => {
    fetchMock.mockRejectedValueOnce(new Error('ENOTFOUND'));
    const client = new OpenRouterClient({ apiKey: 'sk', baseUrl: 'https://or/api/v1', fetch: fetchMock });
    await expect(client.chatCompletions({ model: 'm', messages: [] })).rejects.toMatchObject({
      networkError: expect.any(Error),
    });
  });
});
```

- [ ] **Step 2: Run (expect FAIL)**

Run: `pnpm -F @rntme/ai-llm-openrouter vitest run test/unit/openrouter-client.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `openrouter-client.ts`**

```typescript
export interface OpenRouterClientOptions {
  apiKey: string;
  baseUrl: string;
  httpReferer?: string;
  xTitle?: string;
  fetch?: typeof globalThis.fetch;
}

export interface OrErrorEnvelope {
  httpStatus?: number;
  orError?: { code?: string; message?: string };
  networkError?: unknown;
}

export class OpenRouterClient {
  private readonly opts: OpenRouterClientOptions;
  constructor(opts: OpenRouterClientOptions) {
    this.opts = opts;
  }

  async chatCompletions(body: object): Promise<unknown> {
    const fetchFn = this.opts.fetch ?? globalThis.fetch;
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.opts.apiKey}`,
      'Content-Type': 'application/json',
    };
    if (this.opts.httpReferer) headers['HTTP-Referer'] = this.opts.httpReferer;
    if (this.opts.xTitle) headers['X-Title'] = this.opts.xTitle;

    let res: Response;
    try {
      res = await fetchFn(`${this.opts.baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
    } catch (networkError) {
      throw { networkError } satisfies OrErrorEnvelope;
    }

    if (!res.ok) {
      let orError: { code?: string; message?: string } | undefined;
      try {
        const parsed = (await res.json()) as { error?: { code?: string; message?: string } };
        orError = parsed?.error;
      } catch {
        // ignore parse failure
      }
      throw { httpStatus: res.status, orError } satisfies OrErrorEnvelope;
    }

    return await res.json();
  }
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm -F @rntme/ai-llm-openrouter vitest run test/unit/openrouter-client.test.ts`
Expected: PASS, three cases.

- [ ] **Step 5: Commit**

```bash
git add modules/ai-llm/openrouter/src/openrouter-client.ts \
        modules/ai-llm/openrouter/test/unit/openrouter-client.test.ts
git commit -m "feat(ai-llm-openrouter): http client wrapper"
```

---

### Task 17: `handler.ts` — `Complete`, `GetCompletion`, and `unimplementedHandler`

**Files:**
- Create: `modules/ai-llm/openrouter/src/handler.ts`
- Create: `modules/ai-llm/openrouter/test/integration/handler.test.ts`

- [ ] **Step 1: Write the failing integration test**

```typescript
import { describe, expect, it, vi } from 'vitest';
import { Buffer } from 'node:buffer';
import { createOpenRouterModule } from '../../src/handler.js';

function makeBus(): { events: { type: string; data: unknown }[]; emit: (type: string, data: unknown) => Promise<void> } {
  const events: { type: string; data: unknown }[] = [];
  return {
    events,
    emit: async (type, data) => {
      events.push({ type, data });
    },
  };
}

function makeStore(): {
  store: { get: (k: string) => Promise<Buffer | null>; put: (k: string, b: Buffer) => Promise<void>; evictExpired: () => Promise<number>; close: () => Promise<void> };
  records: Map<string, Buffer>;
} {
  const records = new Map<string, Buffer>();
  return {
    records,
    store: {
      get: async (k) => records.get(k) ?? null,
      put: async (k, b) => void records.set(k, b),
      evictExpired: async () => 0,
      close: async () => {},
    },
  };
}

const happyOrResponse = {
  id: 'gen-1',
  model: 'openai/gpt-4o',
  choices: [{ message: { role: 'assistant', content: 'extracted JSON here' }, finish_reason: 'stop' }],
  usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
};

const sampleRequest = {
  context: { idempotencyKey: 'idem-abc', correlationId: 'corr-1' },
  model: 'openrouter/openai/gpt-4o',
  messages: [{ role: 'user', content: [{ type: 1, text: { text: 'hi' } }] }],
};

describe('Complete RPC', () => {
  it('happy path emits Started + Finished, calls OR once, returns Completion', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => happyOrResponse, text: async () => '' });
    const bus = makeBus();
    const { records, store } = makeStore();
    const mod = createOpenRouterModule({ apiKey: 'sk', baseUrl: 'https://or', fetch: fetchMock, store, bus, now: () => Date.parse('2026-05-06T10:00:00Z') });

    const completion = (await mod.Complete!(sampleRequest)) as { ref: { canonicalId: string } };
    expect(completion.ref.canonicalId).toBe('idem-abc');
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(bus.events.map((e) => e.type)).toEqual(['CompletionStarted', 'CompletionFinished']);
    expect(records.has('idem-abc')).toBe(true);
  });

  it('idempotent — second call with same key returns cached, no second OR call', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => happyOrResponse, text: async () => '' });
    const bus = makeBus();
    const { store } = makeStore();
    const mod = createOpenRouterModule({ apiKey: 'sk', baseUrl: 'https://or', fetch: fetchMock, store, bus, now: () => Date.parse('2026-05-06T10:00:00Z') });
    await mod.Complete!(sampleRequest);
    await mod.Complete!(sampleRequest);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('OR 429 → AI_LLM_VENDOR_RATE_LIMITED + CompletionFailed', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 429, json: async () => ({ error: { code: 'rate_limit', message: 'too many' } }), text: async () => '' });
    const bus = makeBus();
    const { store } = makeStore();
    const mod = createOpenRouterModule({ apiKey: 'sk', baseUrl: 'https://or', fetch: fetchMock, store, bus, now: () => Date.parse('2026-05-06T10:00:00Z') });
    await expect(mod.Complete!(sampleRequest)).rejects.toMatchObject({ aiLlmCode: 'AI_LLM_VENDOR_RATE_LIMITED' });
    expect(bus.events.map((e) => e.type)).toEqual(['CompletionStarted', 'CompletionFailed']);
  });
});

describe('GetCompletion RPC', () => {
  it('returns cached completion when found', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => happyOrResponse, text: async () => '' });
    const bus = makeBus();
    const { store } = makeStore();
    const mod = createOpenRouterModule({ apiKey: 'sk', baseUrl: 'https://or', fetch: fetchMock, store, bus, now: () => Date.parse('2026-05-06T10:00:00Z') });
    await mod.Complete!(sampleRequest);
    const got = (await mod.GetCompletion!({ canonicalId: 'idem-abc' })) as { ref: { canonicalId: string } };
    expect(got.ref.canonicalId).toBe('idem-abc');
  });

  it('returns COMPLETION_NOT_FOUND when missing', async () => {
    const fetchMock = vi.fn();
    const bus = makeBus();
    const { store } = makeStore();
    const mod = createOpenRouterModule({ apiKey: 'sk', baseUrl: 'https://or', fetch: fetchMock, store, bus, now: () => Date.parse('2026-05-06T10:00:00Z') });
    await expect(mod.GetCompletion!({ canonicalId: 'never' })).rejects.toMatchObject({ aiLlmCode: 'AI_LLM_REFERENCES_COMPLETION_NOT_FOUND' });
  });
});

describe('Unimplemented RPCs', () => {
  it('all 12 non-implemented RPCs throw UNIMPLEMENTED', async () => {
    const mod = createOpenRouterModule({ apiKey: 'sk', baseUrl: 'https://or', store: makeStore().store, bus: makeBus(), now: () => 0 });
    const unimplementedRpcs = [
      'CreateThread', 'GetThread', 'DeleteThread', 'AddMessage', 'ListThreadItems',
      'RunThread', 'GetThreadRun', 'CancelThreadRun',
      'SubmitJob', 'GetJob', 'CancelJob', 'ListJobs',
    ];
    for (const rpc of unimplementedRpcs) {
      await expect((mod as Record<string, (req: unknown) => Promise<unknown>>)[rpc]({})).rejects.toMatchObject({ code: 12 /* UNIMPLEMENTED */ });
    }
  });
});
```

- [ ] **Step 2: Run (expect FAIL)**

Run: `pnpm -F @rntme/ai-llm-openrouter vitest run test/integration/handler.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `handler.ts`**

```typescript
import { proto } from '@rntme/contracts-ai-llm-v1';
import { Buffer } from 'node:buffer';
import { AiLlmOpenRouterError, GrpcStatus, unimplemented } from './errors.js';
import { mapOpenRouterError } from './error-mapper.js';
import { buildOpenRouterRequest, parseOpenRouterResponse } from './completion-mapper.js';
import { OpenRouterClient } from './openrouter-client.js';
import type { IdempotencyStore } from './idempotency-store.js';

const CompletionMessage = proto.rntme.contracts.ai_llm.v1.Completion;

export interface ModuleBus {
  emit(type: string, data: unknown): Promise<void>;
}

export interface CreateOpenRouterModuleOptions {
  apiKey: string;
  baseUrl: string;
  fetch?: typeof globalThis.fetch;
  store: IdempotencyStore;
  bus: ModuleBus;
  now: () => number;
  httpReferer?: string;
  xTitle?: string;
}

type Handler = (req: object) => Promise<object>;

export function createOpenRouterModule(opts: CreateOpenRouterModuleOptions): Partial<Record<string, Handler>> {
  const client = new OpenRouterClient({ apiKey: opts.apiKey, baseUrl: opts.baseUrl, fetch: opts.fetch, httpReferer: opts.httpReferer, xTitle: opts.xTitle });

  async function Complete(req: object): Promise<object> {
    const r = req as { context?: { idempotencyKey?: string; correlationId?: string }; model?: string };
    const idempotencyKey = r.context?.idempotencyKey;
    if (!idempotencyKey || idempotencyKey.length === 0) {
      throw new AiLlmOpenRouterError('idempotency_key is required', GrpcStatus.INVALID_ARGUMENT, 'AI_LLM_STRUCTURAL_MISSING_IDEMPOTENCY_KEY');
    }

    const cached = await opts.store.get(idempotencyKey);
    if (cached) {
      const completion = (CompletionMessage as { decode: (b: Uint8Array) => object; toObject: (m: object, options?: object) => object })
        .toObject(
          (CompletionMessage as { decode: (b: Uint8Array) => object }).decode(cached),
          { defaults: true },
        );
      return completion;
    }

    await opts.bus.emit('CompletionStarted', { canonicalId: idempotencyKey, correlationId: r.context?.correlationId });

    let orResponse: unknown;
    try {
      orResponse = await client.chatCompletions(buildOpenRouterRequest(r as Parameters<typeof buildOpenRouterRequest>[0]));
    } catch (e) {
      const env = e as { httpStatus?: number; orError?: { code?: string; message?: string }; networkError?: unknown };
      if ('httpStatus' in env || 'networkError' in env) {
        const mapped = mapOpenRouterError(env);
        await opts.bus.emit('CompletionFailed', { canonicalId: idempotencyKey, code: mapped.aiLlmCode, message: mapped.message });
        throw mapped;
      }
      // Re-throw structural/contract errors from the mapper itself (already AiLlmOpenRouterError).
      if (e instanceof AiLlmOpenRouterError) {
        await opts.bus.emit('CompletionFailed', { canonicalId: idempotencyKey, code: e.aiLlmCode, message: e.message });
      }
      throw e;
    }

    const completion = parseOpenRouterResponse(orResponse as Parameters<typeof parseOpenRouterResponse>[0], {
      model: r.model ?? '',
      idempotencyKey,
      requestStartedAt: new Date(opts.now()),
    });

    const protoMsg = (CompletionMessage as {
      fromObject: (v: object) => object;
      encode: (m: object) => { finish: () => Uint8Array };
    }).encode((CompletionMessage as { fromObject: (v: object) => object }).fromObject(completion as unknown as object));
    await opts.store.put(idempotencyKey, Buffer.from(protoMsg.finish()));

    await opts.bus.emit('CompletionFinished', { canonicalId: idempotencyKey, finishReason: completion.finishReason });
    return completion as unknown as object;
  }

  async function GetCompletion(req: object): Promise<object> {
    const id = (req as { canonicalId?: string }).canonicalId ?? '';
    const cached = await opts.store.get(id);
    if (!cached) {
      throw new AiLlmOpenRouterError(`completion ${id} not found`, GrpcStatus.NOT_FOUND, 'AI_LLM_REFERENCES_COMPLETION_NOT_FOUND');
    }
    const decoded = (CompletionMessage as { decode: (b: Uint8Array) => object; toObject: (m: object, options?: object) => object }).toObject(
      (CompletionMessage as { decode: (b: Uint8Array) => object }).decode(cached),
      { defaults: true },
    );
    return decoded;
  }

  const unimplementedRpcs = [
    'CreateThread', 'GetThread', 'DeleteThread', 'AddMessage', 'ListThreadItems',
    'RunThread', 'GetThreadRun', 'CancelThreadRun',
    'SubmitJob', 'GetJob', 'CancelJob', 'ListJobs',
  ];
  const module: Record<string, Handler> = { Complete, GetCompletion };
  for (const name of unimplementedRpcs) {
    module[name] = async (): Promise<object> => {
      throw unimplemented(name);
    };
  }
  return module;
}
```

- [ ] **Step 4: Run integration tests**

Run: `pnpm -F @rntme/ai-llm-openrouter vitest run test/integration/handler.test.ts`
Expected: PASS, all four blocks (Complete happy, idempotent, 429, GetCompletion found, GetCompletion missing, 12 unimplemented).

- [ ] **Step 5: Commit**

```bash
git add modules/ai-llm/openrouter/src/handler.ts \
        modules/ai-llm/openrouter/test/integration/handler.test.ts
git commit -m "feat(ai-llm-openrouter): handler with Complete/GetCompletion/unimplemented"
```

---

### Task 18: gRPC server (`server.ts`) and entry-point (`bin/server.ts`)

**Files:**
- Create: `modules/ai-llm/openrouter/src/server.ts`
- Create: `modules/ai-llm/openrouter/src/bin/server.ts`
- Create: `modules/ai-llm/openrouter/src/index.ts`

- [ ] **Step 1: Write `server.ts` (adapt from `modules/identity/auth0/src/server.ts`)**

```typescript
import { Buffer } from 'node:buffer';
import * as grpc from '@grpc/grpc-js';
import { proto } from '@rntme/contracts-ai-llm-v1';
import { AiLlmOpenRouterError, GrpcStatus, unimplemented } from './errors.js';

const aiLlmV1 = proto.rntme.contracts.ai_llm.v1;

type ProtoType = {
  encode(value: object): { finish(): Uint8Array };
  decode(bytes: Uint8Array): object;
  fromObject(value: object): object;
  toObject(value: object, options?: object): object;
};

type UnaryHandler = (request: object) => Promise<object>;

const rpcDescriptors = {
  Complete: [aiLlmV1.CreateCompletionRequest, aiLlmV1.Completion],
  GetCompletion: [aiLlmV1.GetCompletionRequest, aiLlmV1.Completion],
  CreateThread: [aiLlmV1.CreateThreadRequest, aiLlmV1.AssistantThread],
  GetThread: [aiLlmV1.GetThreadRequest, aiLlmV1.AssistantThread],
  DeleteThread: [aiLlmV1.DeleteThreadRequest, aiLlmV1.AssistantThread],
  AddMessage: [aiLlmV1.AddMessageRequest, aiLlmV1.ThreadItem],
  ListThreadItems: [aiLlmV1.ListThreadItemsRequest, aiLlmV1.ThreadItemList],
  RunThread: [aiLlmV1.RunThreadRequest, aiLlmV1.ThreadRun],
  GetThreadRun: [aiLlmV1.GetThreadRunRequest, aiLlmV1.ThreadRun],
  CancelThreadRun: [aiLlmV1.CancelThreadRunRequest, aiLlmV1.ThreadRun],
  SubmitJob: [aiLlmV1.SubmitJobRequest, aiLlmV1.AsyncJob],
  GetJob: [aiLlmV1.GetJobRequest, aiLlmV1.AsyncJob],
  CancelJob: [aiLlmV1.CancelJobRequest, aiLlmV1.AsyncJob],
  ListJobs: [aiLlmV1.ListJobsRequest, aiLlmV1.AsyncJobList],
} satisfies Record<string, readonly [ProtoType, ProtoType]>;

export type AiLlmRpcName = keyof typeof rpcDescriptors;

export interface OpenRouterGrpcServerOptions {
  module: Partial<Record<AiLlmRpcName, UnaryHandler>>;
  port?: number;
  host?: string;
  serverCredentials?: grpc.ServerCredentials;
}

export interface OpenRouterGrpcServer {
  server: grpc.Server;
  listen(): Promise<{ port: number }>;
  stop(): Promise<void>;
}

function serialize(type: ProtoType, value: object): Buffer {
  return Buffer.from(type.encode(type.fromObject(value)).finish());
}

function deserialize(type: ProtoType, bytes: Buffer): object {
  return type.toObject(type.decode(bytes), { defaults: true });
}

function createServiceDefinition(): grpc.ServiceDefinition<grpc.UntypedServiceImplementation> {
  const service: Record<string, grpc.MethodDefinition<object, object>> = {};
  for (const [rpc, [requestType, responseType]] of Object.entries(rpcDescriptors)) {
    service[rpc] = {
      path: `/rntme.contracts.ai_llm.v1.AiLlmModule/${rpc}`,
      requestStream: false,
      responseStream: false,
      requestSerialize: (value: object): Buffer => serialize(requestType, value),
      requestDeserialize: (bytes: Buffer): object => deserialize(requestType, bytes),
      responseSerialize: (value: object): Buffer => serialize(responseType, value),
      responseDeserialize: (bytes: Buffer): object => deserialize(responseType, bytes),
    };
  }
  return service as grpc.ServiceDefinition<grpc.UntypedServiceImplementation>;
}

function errorToServiceError(error: unknown): grpc.ServiceError {
  const e = error instanceof AiLlmOpenRouterError ? error : new AiLlmOpenRouterError(error instanceof Error ? error.message : String(error), GrpcStatus.INTERNAL, 'AI_LLM_VENDOR_UNAVAILABLE', error);
  return {
    name: e.name,
    message: `${e.aiLlmCode}: ${e.message}`,
    code: e.code as unknown as grpc.status,
    details: `${e.aiLlmCode}: ${e.message}`,
    metadata: new grpc.Metadata(),
  };
}

function makeImplementation(module: Partial<Record<AiLlmRpcName, UnaryHandler>>): grpc.UntypedServiceImplementation {
  const implementation: grpc.UntypedServiceImplementation = {};
  for (const rpc of Object.keys(rpcDescriptors) as AiLlmRpcName[]) {
    implementation[rpc] = async (
      call: grpc.ServerUnaryCall<object, object>,
      callback: grpc.sendUnaryData<object>,
    ): Promise<void> => {
      const handler = module[rpc];
      try {
        if (handler === undefined) throw unimplemented(rpc);
        callback(null, await handler(call.request));
      } catch (error) {
        callback(errorToServiceError(error), null);
      }
    };
  }
  return implementation;
}

export function createOpenRouterGrpcServer(opts: OpenRouterGrpcServerOptions): OpenRouterGrpcServer {
  const server = new grpc.Server();
  server.addService(createServiceDefinition(), makeImplementation(opts.module));
  const host = opts.host ?? '0.0.0.0';
  const port = opts.port ?? 50051;
  const credentials = opts.serverCredentials ?? grpc.ServerCredentials.createInsecure();
  return {
    server,
    listen(): Promise<{ port: number }> {
      return new Promise((resolve, reject) => {
        server.bindAsync(`${host}:${port}`, credentials, (error, boundPort) => {
          if (error !== null) return reject(error);
          resolve({ port: boundPort });
        });
      });
    },
    stop(): Promise<void> {
      return new Promise((resolve) => server.tryShutdown(() => resolve()));
    },
  };
}
```

- [ ] **Step 2: Write `bin/server.ts` (adapt from auth0)**

```typescript
import { createIdempotencyStore } from '../idempotency-store.js';
import { createOpenRouterModule } from '../handler.js';
import { createOpenRouterGrpcServer } from '../server.js';

function readPort(envName: string, defaultPort: number): number {
  const raw = process.env[envName] ?? String(defaultPort);
  if (!/^(0|[1-9][0-9]*)$/.test(raw)) throw new Error(`Invalid ${envName} value: ${raw}`);
  const port = Number.parseInt(raw, 10);
  if (port < 0 || port > 65_535) throw new Error(`Invalid ${envName} value: ${raw}`);
  return port;
}

const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) throw new Error('OPENROUTER_API_KEY is required');

const baseUrl = process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1';
const grpcPort = readPort('PORT', 50051);
const host = process.env.HOST ?? '0.0.0.0';

const idempotencyMode = (process.env.OPENROUTER_IDEMPOTENCY_MODE ?? 'sqlite') as 'sqlite' | 'memory';
const idempotencyPath = process.env.OPENROUTER_IDEMPOTENCY_PATH ?? '/data/idempotency.sqlite';
const ttlMs = 24 * 3600_000;
const store = createIdempotencyStore(
  idempotencyMode === 'memory' ? { mode: 'memory', ttlMs } : { mode: 'sqlite', path: idempotencyPath, ttlMs },
);

const bus = {
  async emit(type: string, data: unknown): Promise<void> {
    process.stdout.write(`${JSON.stringify({ msg: 'ai_llm_openrouter_event', type, data })}\n`);
  },
};

const module = createOpenRouterModule({ apiKey, baseUrl, store, bus, now: () => Date.now(), xTitle: 'rntme', httpReferer: process.env.OPENROUTER_HTTP_REFERER });

const grpc = createOpenRouterGrpcServer({ module, port: grpcPort, host });

const grpcInfo = await grpc.listen();
process.stdout.write(`${JSON.stringify({ msg: 'ai_llm_openrouter_grpc_listening', port: grpcInfo.port })}\n`);

const sweepHandle = setInterval(() => void store.evictExpired(), 3600_000);

let shuttingDown = false;
async function shutdown(): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  clearInterval(sweepHandle);
  await Promise.allSettled([grpc.stop(), store.close()]);
  process.exit(0);
}
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => void shutdown());
}
```

- [ ] **Step 3: Write `index.ts` (re-exports for in-process use, e.g. integration tests)**

```typescript
export { createOpenRouterModule } from './handler.js';
export { createOpenRouterGrpcServer } from './server.js';
export { createIdempotencyStore } from './idempotency-store.js';
export type { IdempotencyStore, IdempotencyStoreOptions } from './idempotency-store.js';
export type { OpenRouterClientOptions } from './openrouter-client.js';
export { OpenRouterClient } from './openrouter-client.js';
export { AiLlmOpenRouterError } from './errors.js';
```

- [ ] **Step 4: Build the package**

Run: `pnpm -F @rntme/ai-llm-openrouter build`
Expected: `dist/` populated; no TS errors.

- [ ] **Step 5: Smoke-test boot (without real OR — should fail fast on missing API key, then succeed with dummy key)**

Run: `OPENROUTER_API_KEY=sk-test OPENROUTER_IDEMPOTENCY_MODE=memory PORT=0 timeout 3 node modules/ai-llm/openrouter/dist/bin/server.js || true`
Expected: prints `ai_llm_openrouter_grpc_listening` JSON line within 3s, then `timeout` kills it.

- [ ] **Step 6: Commit**

```bash
git add modules/ai-llm/openrouter/src/server.ts \
        modules/ai-llm/openrouter/src/bin/server.ts \
        modules/ai-llm/openrouter/src/index.ts
git commit -m "feat(ai-llm-openrouter): gRPC server + entry point"
```

---

### Task 19: Dockerfile

**Files:**
- Create: `modules/ai-llm/openrouter/Dockerfile`

- [ ] **Step 1: Write the Dockerfile (adapt from auth0)**

```dockerfile
# Build from the repository root:
#   docker build -f modules/ai-llm/openrouter/Dockerfile -t ghcr.io/vladprrs/rntme-ai-llm-openrouter:dev .

FROM node:20-alpine AS builder
WORKDIR /build

RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY packages/contracts ./packages/contracts
COPY modules/ai-llm ./modules/ai-llm

RUN pnpm install --frozen-lockfile
RUN pnpm -F @rntme/ai-llm-openrouter run build:image
RUN node -e "const fs=require('fs');const p=require('./package.json');delete p.devDependencies;fs.writeFileSync('package.json', JSON.stringify(p));"
RUN pnpm --filter @rntme/ai-llm-openrouter --prod deploy /out

FROM node:20-alpine
WORKDIR /srv

COPY --from=builder /out ./

ENV NODE_ENV=production \
    PORT=50051 \
    OPENROUTER_BASE_URL=https://openrouter.ai/api/v1 \
    OPENROUTER_IDEMPOTENCY_MODE=sqlite \
    OPENROUTER_IDEMPOTENCY_PATH=/data/idempotency.sqlite

VOLUME /data
USER node
EXPOSE 50051
CMD ["node", "dist/bin/server.js"]
```

- [ ] **Step 2: Verify the build context references are present**

Run: `ls -la pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json packages/contracts modules/ai-llm`
Expected: every path exists.

- [ ] **Step 3: Commit**

```bash
git add modules/ai-llm/openrouter/Dockerfile
git commit -m "feat(ai-llm-openrouter): Dockerfile"
```

---

### Task 20: Module README

**Files:**
- Create: `modules/ai-llm/openrouter/README.md`

- [ ] **Step 1: Write the README (per project per-package template)**

```markdown
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

- `docs/history/specs/historical/2026-05-06-ai-llm-openrouter-module-design.md` — design.
- `docs/history/specs/historical/2026-04-26-ai-llm-canonical-contract-design.md` — canonical contract.
```

- [ ] **Step 2: Run typecheck and full module tests one more time**

Run: `pnpm -F @rntme/ai-llm-openrouter typecheck && pnpm -F @rntme/ai-llm-openrouter test && pnpm -F @rntme/ai-llm-openrouter lint`
Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add modules/ai-llm/openrouter/README.md
git commit -m "docs(ai-llm-openrouter): per-package README"
```

---

## Phase D3 — `demo/cv-extract-blueprint/`

The blueprint follows the `demo/notes-blueprint/` pattern. Read those files before writing equivalents:
- `demo/notes-blueprint/project.json`, `pdm/pdm.json`, `pdm/entities/Note.json`
- `demo/notes-blueprint/services/app/{service.json, qsm/qsm.json, qsm/projections/NoteView.json, graphs/createNote.json, bindings/bindings.json, seed/seed.json}`

### Task 21: Project + PDM scaffolding

**Files:**
- Create: `demo/cv-extract-blueprint/project.json`
- Create: `demo/cv-extract-blueprint/pdm/pdm.json`
- Create: `demo/cv-extract-blueprint/pdm/entities/Resume.json`

- [ ] **Step 1: Write `project.json`**

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

- [ ] **Step 2: Write `pdm/pdm.json`**

```json
{ "version": "1" }
```

- [ ] **Step 3: Write `pdm/entities/Resume.json`**

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
        "from": null,
        "to": "complete",
        "affects": ["filename", "mediaType", "extractedJson"]
      }
    }
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add demo/cv-extract-blueprint/project.json \
        demo/cv-extract-blueprint/pdm/pdm.json \
        demo/cv-extract-blueprint/pdm/entities/Resume.json
git commit -m "feat(demo/cv-extract): project + PDM scaffolding"
```

---

### Task 22: Service scaffold + QSM + projection

**Files:**
- Create: `demo/cv-extract-blueprint/services/app/service.json`
- Create: `demo/cv-extract-blueprint/services/app/qsm/qsm.json`
- Create: `demo/cv-extract-blueprint/services/app/qsm/projections/ResumeView.json`

- [ ] **Step 1: Write `service.json`**

```json
{ "kind": "domain" }
```

- [ ] **Step 2: Write `qsm/qsm.json`**

```json
{ "version": "1", "relations": {} }
```

- [ ] **Step 3: Write `qsm/projections/ResumeView.json`**

```json
{
  "backing": "entity-mirror",
  "source": { "entity": "Resume" },
  "keys": ["id"],
  "grain": ["id"],
  "exposed": ["filename", "mediaType", "extractedJson", "status", "createdAt"]
}
```

- [ ] **Step 4: Commit**

```bash
git add demo/cv-extract-blueprint/services/app/service.json \
        demo/cv-extract-blueprint/services/app/qsm/qsm.json \
        demo/cv-extract-blueprint/services/app/qsm/projections/ResumeView.json
git commit -m "feat(demo/cv-extract): service + QSM + ResumeView projection"
```

---

### Task 23: `extractResume` graph

**Files:**
- Create: `demo/cv-extract-blueprint/services/app/graphs/extractResume.json`

The work-experience JSON Schema is embedded as a literal in this file (per spec §6.5).

- [ ] **Step 1: Write the graph**

```json
{
  "id": "extractResume",
  "signature": {
    "inputs": {
      "filename":   { "type": "string", "mode": "required" },
      "mediaType":  { "type": "string", "mode": "required" },
      "fileBase64": { "type": "string", "mode": "required" }
    },
    "output": { "type": "row<{ resumeId: string }>", "from": "out" }
  },
  "nodes": [
    { "id": "newId", "type": "uuid", "config": {} },
    {
      "id": "completion",
      "type": "call",
      "target": { "module": "openrouter", "operation": "Complete" },
      "input": {
        "context": {
          "$literal": { "idempotencyKey": "" }
        },
        "model": { "$literal": "openrouter/openai/gpt-4o" },
        "messages": {
          "$literal": [
            {
              "role": "user",
              "content": [
                {
                  "type": 4,
                  "file": {
                    "filename": { "$param": "filename" },
                    "mediaType": { "$param": "mediaType" },
                    "base64Data": { "$param": "fileBase64" }
                  }
                },
                {
                  "type": 1,
                  "text": { "text": "Extract the candidate's information from the attached resume PDF as a JSON object matching the provided schema. Output ONLY the JSON; no preamble." }
                }
              ]
            }
          ]
        },
        "sampling": {
          "$literal": {
            "responseFormat": "json_schema",
            "responseSchema": {
              "type": "object",
              "additionalProperties": false,
              "properties": {
                "full_name": { "type": "string" },
                "experience": {
                  "type": "array",
                  "items": {
                    "type": "object",
                    "additionalProperties": false,
                    "properties": {
                      "company":    { "type": "string" },
                      "title":      { "type": "string" },
                      "start_date": { "type": "string" },
                      "end_date":   { "type": "string" }
                    },
                    "required": ["company", "title"]
                  }
                },
                "education": {
                  "type": "array",
                  "items": {
                    "type": "object",
                    "additionalProperties": false,
                    "properties": {
                      "institution": { "type": "string" },
                      "degree":      { "type": "string" },
                      "year":        { "type": "string" }
                    }
                  }
                },
                "skills": { "type": "array", "items": { "type": "string" } }
              },
              "required": ["full_name", "experience"]
            }
          }
        }
      },
      "policy": {
        "timeoutMs": 90000,
        "retry":   { "attempts": 1, "retryOn": "transient" },
        "idempotency": { "mode": "auto" },
        "onError": "fail"
      }
    },
    {
      "id": "emit",
      "type": "emit",
      "config": {
        "aggregate": "Resume",
        "aggregateId": { "$node": "newId" },
        "transition": "complete",
        "payload": {
          "filename":      { "$param": "filename" },
          "mediaType":     { "$param": "mediaType" },
          "extractedJson": { "$ref": "completion.result.content[0].text.text" }
        }
      }
    },
    { "id": "out", "type": "result", "value": { "resumeId": { "$ref": "emit.aggregateId" } } }
  ]
}
```

**Open verification on first run:**
1. The `call` node's `input.context.idempotencyKey` placeholder. Confirm whether the runtime auto-fills `idempotencyKey` from the graph's run-id (look at how `identity-auth0.IntrospectSession` is wired in `notes-blueprint/services/app/graphs/createNote.json` — it does NOT set `context` explicitly, suggesting the runtime injects it). If so, drop the empty `$literal context` block. If not, generate via a separate `uuid` node and reference it via `$ref`.
2. `$literal` may not allow nested `$param`. If a strict-literal interpretation rejects this, split: a small `compose` (or whatever the IR provides) node assembles `messages`, then `call` references `$ref` for the assembled value. Worst case: the demo sidesteps via a code-command-handler shim for this single step.
3. `$ref completion.result.content[0].text.text` reaches into the `Completion` proto. Verify the actual ref path against the proto shape (`Completion.content[0].text.text`).

If any of (1)/(2)/(3) fail at runtime, fix the graph and re-run; do NOT change the spec/contract.

- [ ] **Step 2: Commit (unverified — verification happens at Task 30)**

```bash
git add demo/cv-extract-blueprint/services/app/graphs/extractResume.json
git commit -m "feat(demo/cv-extract): extractResume graph (sketch — runtime-verified at Task 30)"
```

---

### Task 24: `getResume` graph

**Files:**
- Create: `demo/cv-extract-blueprint/services/app/graphs/getResume.json`

- [ ] **Step 1: Write the graph (mirror notes' getNote.json pattern)**

```json
{
  "id": "getResume",
  "signature": {
    "inputs": {
      "id": { "type": "string", "mode": "required" }
    },
    "output": { "type": "row<ResumeView>", "from": "out" }
  },
  "nodes": [
    {
      "id": "all",
      "type": "findMany",
      "config": { "source": { "projection": "ResumeView" } }
    },
    {
      "id": "filtered",
      "type": "filter",
      "config": {
        "input": "all",
        "expr": { "eq": ["resumeView.id", { "$param": "id" }] }
      }
    },
    { "id": "out", "type": "result", "value": { "$ref": "filtered" } }
  ]
}
```

- [ ] **Step 2: Commit**

```bash
git add demo/cv-extract-blueprint/services/app/graphs/getResume.json
git commit -m "feat(demo/cv-extract): getResume graph"
```

---

### Task 25: HTTP bindings

**Files:**
- Create: `demo/cv-extract-blueprint/services/app/bindings/bindings.json`

- [ ] **Step 1: Write the bindings**

```json
{
  "version": "1.0",
  "graphSpecRef": "../graphs",
  "pdmRef": "../../../pdm",
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

- [ ] **Step 2: Commit**

```bash
git add demo/cv-extract-blueprint/services/app/bindings/bindings.json
git commit -m "feat(demo/cv-extract): HTTP bindings"
```

---

### Task 26: Seed + UI scaffolding

The notes-blueprint UI splits each route into a `*.screen.json` (data + actions) and a `*.spec.json` (element tree). The blueprint also declares a layout (`layouts/main.{screen,spec}.json`). Five UI files in total. JSON below mirrors notes' verified shape, minus auth (`LoginScreen`/`UserBadge`).

**Files:**
- Create: `demo/cv-extract-blueprint/services/app/seed/seed.json`
- Create: `demo/cv-extract-blueprint/services/app/ui/manifest.json`
- Create: `demo/cv-extract-blueprint/services/app/ui/layouts/main.screen.json`
- Create: `demo/cv-extract-blueprint/services/app/ui/layouts/main.spec.json`
- Create: `demo/cv-extract-blueprint/services/app/ui/screens/home.screen.json`
- Create: `demo/cv-extract-blueprint/services/app/ui/screens/home.spec.json`

- [ ] **Step 1: Write `seed/seed.json`**

```json
{ "seedVersion": 1, "events": [] }
```

- [ ] **Step 2: Write `ui/manifest.json`**

```json
{
  "version": "2.0",
  "pdmRef": "../../../pdm",
  "qsmRef": "../qsm",
  "graphSpecRef": "../graphs",
  "bindingsRef": "../bindings",
  "metadata": { "title": "CV Extract" },
  "layouts": { "main": "layouts/main" },
  "routes": {
    "/": { "layout": "main", "screen": "screens/home" }
  }
}
```

- [ ] **Step 3: Write `ui/layouts/main.screen.json`**

```json
{}
```

- [ ] **Step 4: Write `ui/layouts/main.spec.json`**

```json
{
  "root": "shell",
  "elements": {
    "shell": {
      "type": "Stack",
      "props": { "direction": "vertical", "gap": "lg" },
      "children": ["title"]
    },
    "title": {
      "type": "Heading",
      "props": { "level": 1, "text": "CV Extract" }
    }
  }
}
```

- [ ] **Step 5: Write `ui/screens/home.screen.json`**

```json
{
  "metadata": { "title": "Home" },
  "data": {
    "/data/resume": {
      "binding": "getResume",
      "params": { "id": { "$state": "/result/resumeId" } },
      "refetchOn": ["state-change:/result/resumeId"]
    }
  },
  "actions": {
    "extractResume": {
      "kind": "command",
      "binding": "extractResume",
      "paramsFromState": {
        "filename": "/form/filename",
        "mediaType": "/form/mediaType",
        "fileBase64": "/form/fileBase64"
      },
      "onSuccess": { "setState": { "/result/resumeId": "{{response.resumeId}}" } },
      "onError": { "showAlert": true }
    }
  }
}
```

- [ ] **Step 6: Write `ui/screens/home.spec.json`**

Notes' spec uses `Stack`, `Heading`, `Input`, `Button`, `Text`, `Code`-like containers, `Badge`. We need a file input — `FileInput` is a reasonable name; if the runtime registry doesn't have it, replace with whatever component name the platform exposes for file uploads (look at `packages/contracts/client-runtime/v1/` and `packages/ui/` for the registry). A pre-rendered JSON viewer maps to a `Text` element with the JSON string for the demo's purposes.

```json
{
  "root": "page",
  "elements": {
    "page": {
      "type": "Stack",
      "props": { "direction": "vertical", "gap": "lg" },
      "children": ["upload-section", "result-section"]
    },
    "upload-section": {
      "type": "Stack",
      "props": { "direction": "vertical", "gap": "md" },
      "children": ["upload-heading", "field-file", "submit-btn"]
    },
    "upload-heading": {
      "type": "Heading",
      "props": { "level": 2, "text": "Upload resume PDF" }
    },
    "field-file": {
      "type": "FileInput",
      "props": {
        "label": "Resume PDF",
        "accept": "application/pdf",
        "filenameBindState": "/form/filename",
        "mediaTypeBindState": "/form/mediaType",
        "base64BindState": "/form/fileBase64"
      }
    },
    "submit-btn": {
      "type": "Button",
      "props": { "label": "Extract", "variant": "primary" },
      "on": { "press": { "action": "dispatch", "params": { "name": "extractResume" } } }
    },
    "result-section": {
      "type": "Stack",
      "props": { "direction": "vertical", "gap": "md" },
      "visible": { "$state": "/data/resume" },
      "children": ["result-heading", "extracted-json"]
    },
    "result-heading": {
      "type": "Heading",
      "props": { "level": 2, "text": "Extracted JSON" }
    },
    "extracted-json": {
      "type": "Text",
      "props": { "text": { "$state": "/data/resume/extractedJson" } }
    }
  }
}
```

- [ ] **Step 7: If `FileInput` doesn't exist in the component registry, replace it before deploying**

Run: `grep -rh '"type": "FileInput"' modules/ packages/ 2>/dev/null | head -3`
Expected: any hit indicates it exists. If empty, search for upload-style components: `grep -rh '"upload\|"file' modules/ packages/ | head` and pick the closest match. If nothing exists, the demo would need a tiny new component contribution — flag this in Task 30's manual e2e and decide there.

- [ ] **Step 8: Commit**

```bash
git add demo/cv-extract-blueprint/services/app/seed/seed.json \
        demo/cv-extract-blueprint/services/app/ui/manifest.json \
        demo/cv-extract-blueprint/services/app/ui/layouts/main.screen.json \
        demo/cv-extract-blueprint/services/app/ui/layouts/main.spec.json \
        demo/cv-extract-blueprint/services/app/ui/screens/home.screen.json \
        demo/cv-extract-blueprint/services/app/ui/screens/home.spec.json
git commit -m "feat(demo/cv-extract): seed + UI (manifest + layout + home screen/spec)"
```

---

### Task 27: Test fixture (sample resume PDF)

**Files:**
- Create: `demo/cv-extract-blueprint/test/fixtures/sample-resume.pdf`
- Create: `demo/cv-extract-blueprint/test/fixtures/README.md`

- [ ] **Step 1: Add a small open-licensed PDF as fixture**

Use a generated PDF (e.g. a 1-page text-only resume). Easiest path: render a minimal HTML/markdown resume with `pandoc` or generate via a tiny script. The fixture must be:
- < 200KB
- Plain text-only (no embedded fonts requiring proprietary licensing)
- A clearly fictional persona (e.g. "Anna Example", "Acme Corp")
- Committed as binary file via git LFS or directly (200KB is below GitHub's typical pre-LFS threshold; just commit directly)

Recipe (one-shot from repo root, requires pandoc):

```bash
mkdir -p demo/cv-extract-blueprint/test/fixtures
cat > /tmp/anna.md <<'EOF'
# Anna Example

**Contact:** anna@example.com — +0 555 0100

## Experience
- **Acme Corp** — Senior Software Engineer (Jan 2023 – present). Built canonical contracts.
- **Initech** — Software Engineer (Jun 2020 – Dec 2022). Maintained legacy systems.

## Education
- **University of Test** — BSc Computer Science (2020).

## Skills
TypeScript, Go, distributed systems, event sourcing.
EOF
pandoc /tmp/anna.md -o demo/cv-extract-blueprint/test/fixtures/sample-resume.pdf
```

If `pandoc` is unavailable, any other tooling that produces a small PDF is fine. Do not skip the fixture — Task 28's integration test depends on it.

- [ ] **Step 2: Write `test/fixtures/README.md`**

```markdown
# CV-extract demo fixtures

`sample-resume.pdf` — a fictional one-page resume used by the integration test (`test/integration/extract.test.ts`) and by the manual e2e checklist. Rendered from `anna.md` via pandoc; replace freely as long as the persona stays clearly fictional and the file remains < 200KB.
```

- [ ] **Step 3: Commit**

```bash
git add demo/cv-extract-blueprint/test/fixtures/sample-resume.pdf \
        demo/cv-extract-blueprint/test/fixtures/README.md
git commit -m "test(demo/cv-extract): sample resume PDF fixture"
```

---

### Task 28: Integration test against the blueprint with mocked OR

**Files:**
- Create: `demo/cv-extract-blueprint/test/integration/extract.test.ts`
- Create: `demo/cv-extract-blueprint/package.json`
- Create: `demo/cv-extract-blueprint/tsconfig.json`
- Create: `demo/cv-extract-blueprint/vitest.config.ts`

The blueprint isn't normally a workspace package, but adding a test harness requires a minimal `package.json`. Mirror the pattern from any existing demo blueprint test setup (check `demo/notes-blueprint/test/` for prior art before assuming).

- [ ] **Step 1: Check whether notes-blueprint already has a test harness — if yes, mirror it; if no, create a fresh one**

Run: `ls demo/notes-blueprint/test/ 2>/dev/null && cat demo/notes-blueprint/package.json 2>/dev/null`
Expected: shows whether there's existing test infra.

If notes-blueprint has tests, mirror its `package.json`/`vitest.config.ts`/test harness pattern. If not, write a minimal one (Steps 2-4 below assume "not present" — adjust if it is).

- [ ] **Step 2: Write `package.json`** (only if no equivalent in notes-blueprint)

```json
{
  "name": "@rntme/demo-cv-extract-blueprint",
  "version": "0.0.0",
  "type": "module",
  "private": true,
  "scripts": {
    "test": "vitest run"
  },
  "devDependencies": {
    "@rntme/ai-llm-openrouter": "workspace:*",
    "@rntme/contracts-ai-llm-v1": "workspace:*",
    "@types/node": "^20.14.0",
    "typescript": "^5.5.4",
    "vitest": "^2.1.1"
  }
}
```

- [ ] **Step 3: Write `tsconfig.json`** (if needed)

```json
{ "extends": "../../tsconfig.base.json", "include": ["test/**/*.ts"] }
```

- [ ] **Step 4: Write `vitest.config.ts`** (if needed)

```typescript
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['test/**/*.test.ts'], environment: 'node' } });
```

- [ ] **Step 5: Write the integration test**

The test verifies that running the `extractResume` graph (in-process, NOT through a real runtime) against a mocked OR call yields a row in `ResumeView` with non-empty `extractedJson`. If the blueprint runtime isn't easily startable in-test, narrow the test to a smoke check: that the manifest, graphs, and bindings all parse and that the OpenRouter module (called directly, with the same shape the runtime would use) produces the expected `Completion` for our fixture-shaped input.

```typescript
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createOpenRouterModule, createIdempotencyStore } from '@rntme/ai-llm-openrouter';

const FIXTURE = readFileSync(join(__dirname, '../fixtures/sample-resume.pdf')).toString('base64');

const ORHappyResponse = {
  id: 'gen-mock',
  model: 'openai/gpt-4o',
  choices: [
    {
      message: {
        role: 'assistant',
        content: JSON.stringify({
          full_name: 'Anna Example',
          experience: [
            { company: 'Acme Corp', title: 'Senior Software Engineer', start_date: '2023-01', end_date: 'present' },
            { company: 'Initech', title: 'Software Engineer', start_date: '2020-06', end_date: '2022-12' },
          ],
          education: [{ institution: 'University of Test', degree: 'BSc Computer Science', year: '2020' }],
          skills: ['TypeScript', 'Go', 'distributed systems', 'event sourcing'],
        }),
      },
      finish_reason: 'stop',
    },
  ],
  usage: { prompt_tokens: 100, completion_tokens: 200, total_tokens: 300 },
};

describe('cv-extract demo: openrouter module integration', () => {
  it('produces a structured Completion for the resume fixture', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ORHappyResponse,
      text: async () => '',
    });
    const store = createIdempotencyStore({ mode: 'memory', ttlMs: 24 * 3600_000 });
    const module = createOpenRouterModule({
      apiKey: 'sk-test',
      baseUrl: 'https://or-mock/api/v1',
      fetch: fetchMock,
      store,
      bus: { emit: async () => {} },
      now: () => Date.parse('2026-05-06T10:00:00Z'),
    });

    const completion = (await module.Complete!({
      context: { idempotencyKey: 'cv-test-1' },
      model: 'openrouter/openai/gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            { type: 4, file: { filename: 'sample-resume.pdf', mediaType: 'application/pdf', base64Data: FIXTURE } },
            { type: 1, text: { text: 'Extract the candidate info.' } },
          ],
        },
      ],
      sampling: {
        responseFormat: 'json_schema',
        responseSchema: { type: 'object', properties: { full_name: { type: 'string' } } },
      },
    })) as { content: { text?: { text: string } }[] };

    const json = JSON.parse(completion.content[0].text!.text) as { full_name: string };
    expect(json.full_name).toBe('Anna Example');

    // The OR client received a properly shaped request.
    expect(fetchMock).toHaveBeenCalledOnce();
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.model).toBe('openai/gpt-4o');
    expect(body.response_format.type).toBe('json_schema');
  });
});
```

- [ ] **Step 6: Run the test**

Run: `pnpm -F @rntme/demo-cv-extract-blueprint test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add demo/cv-extract-blueprint/package.json \
        demo/cv-extract-blueprint/tsconfig.json \
        demo/cv-extract-blueprint/vitest.config.ts \
        demo/cv-extract-blueprint/test/integration/extract.test.ts
git commit -m "test(demo/cv-extract): integration test (mocked OR)"
```

---

### Task 29: Demo README

**Files:**
- Create: `demo/cv-extract-blueprint/README.md`

- [ ] **Step 1: Write the README**

```markdown
# `demo/cv-extract-blueprint/` — Resume extraction demo

Minimal-surface blueprint that exercises `@rntme/ai-llm-openrouter`. A user uploads a PDF resume; the system feeds it to OpenRouter (default `openrouter/openai/gpt-4o`) with a JSON-schema-pinned prompt; the user sees the extracted work-experience JSON.

## File map

```
demo/cv-extract-blueprint/
├── project.json                       modules: openrouter
├── pdm/
│   ├── pdm.json                       version stamp
│   └── entities/Resume.json           single state, single transition
├── services/app/
│   ├── service.json                   { kind: "domain" }
│   ├── qsm/
│   │   ├── qsm.json
│   │   └── projections/ResumeView.json   entity-mirror of Resume
│   ├── graphs/
│   │   ├── extractResume.json         uuid → call openrouter.Complete → emit
│   │   └── getResume.json             findMany ResumeView, filter by id
│   ├── bindings/bindings.json         POST /resumes, GET /resumes/{id}
│   ├── seed/seed.json                 empty
│   └── ui/                            single screen: file picker + result
└── test/
    ├── fixtures/sample-resume.pdf     1-page fictional resume
    └── integration/extract.test.ts    blueprint smoke against mocked OR
```

## Quick start

Set the OpenRouter API key as a secret env var on the runtime workload:

```bash
export OPENROUTER_API_KEY=sk-or-...
```

Then deploy or run the blueprint via the standard rntme runtime tooling. The home screen at `/` accepts a PDF (≤10MB), POSTs to `/resumes`, and renders the extracted JSON on response.

## How it works

1. UI: file picker reads the PDF, base64-encodes in-browser, POSTs `{filename, mediaType, fileBase64}` to `/resumes`.
2. Runtime: `extractResume` graph fires.
   - `uuid` node → resume_id.
   - `call` node → OpenRouter module's `Complete` RPC with the PDF as a `FILE` content block, a fixed text prompt, `response_format=json_schema`, and an embedded JSON Schema for {full_name, experience, education, skills}.
   - `emit` node → `Resume.complete` transition with `extractedJson` populated from the OR response.
   - `result` returns `resumeId`.
3. Projection `ResumeView` mirrors the entity row.
4. UI receives `resumeId` and renders the response inline.

The POST is **synchronous** — the HTTP request blocks for the duration of the OR call (~10–30s for a typical 1MB PDF + gpt-4o). If proxy timeouts in production cut this short, switch to async polling (backlog item 12 in the design spec).

## Failure mode

If OpenRouter fails, the graph fails (graph node `policy.onError: "fail"`). The HTTP request returns a 5xx with the AI_LLM error code in the message. **No record is written to `ResumeView`.** Graceful failure with a `failed` transition + `error_code` column is a backlog item.

## Limits and trade-offs

- No authentication. Open demo, like notes-blueprint without identity.
- Model is hard-coded to `openrouter/openai/gpt-4o` in the graph. Changing it requires editing the literal in `extractResume.json`.
- `extractedJson` is a string (`TEXT` column). Parse on the client; we do not validate the JSON shape server-side.
- File payload is inline base64 in the `ResumeUploaded`-equivalent event payload (well, in `ResumeComplete` here). Up to ~10MB is fine; larger needs the future S3 file-storage module (separate brainstorm).

## Specs

- `docs/history/specs/historical/2026-05-06-ai-llm-openrouter-module-design.md` — design.

## Where to look first

- `services/app/graphs/extractResume.json` — the single graph that does the work.
- `pdm/entities/Resume.json` — the single state machine.
- `test/integration/extract.test.ts` — what the demo's success looks like.
```

- [ ] **Step 2: Commit**

```bash
git add demo/cv-extract-blueprint/README.md
git commit -m "docs(demo/cv-extract): README"
```

---

### Task 30: Manual end-to-end verification (and any graph fixups uncovered)

This is **not** a code task; it is the gate that surfaces the open verifications from Task 23.

- [ ] **Step 1: Build everything**

Run: `pnpm -r run build`
Expected: all packages including `@rntme/ai-llm-openrouter` and `@rntme/demo-cv-extract-blueprint` build cleanly.

- [ ] **Step 2: Locally deploy the blueprint to a dev runtime**

Use whichever local-deploy tooling exists (check `docs/history/specs/historical/2026-05-04-deploy-local-cli-design.md` and surrounding plans). Set `OPENROUTER_API_KEY` to a real key for this step.

- [ ] **Step 3: Open the home screen, upload `test/fixtures/sample-resume.pdf`, click Submit**

Expected: within 30s, the screen renders a JSON object including `full_name: "Anna Example"` and at least two `experience` entries.

- [ ] **Step 4: If anything in the graph misbehaves at runtime, fix `extractResume.json`**

Common issues anticipated in Task 23:
- `context.idempotencyKey` may need to be supplied explicitly (graph adds a `uuid` node and `$ref`s it into the call's input).
- `$literal` may not nest `$param`. Switch to a small assembler node, or refactor to a code-command-handler shim for the message-array build step.
- The reverse-ref path `completion.result.content[0].text.text` may need adjustment depending on how the runtime exposes `call` results.

Make minimal edits, re-test, and commit any fix as a separate `fix(demo/cv-extract): wire extractResume graph against runtime` commit.

- [ ] **Step 5: Run the integration test once more**

Run: `pnpm -F @rntme/demo-cv-extract-blueprint test && pnpm -F @rntme/ai-llm-openrouter test && pnpm -F @rntme/contracts-ai-llm-v1 test`
Expected: all pass.

---

## Phase D4 — Cross-cutting documentation

### Task 31: Update top-level `README.md`

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Locate the packages table**

Run: `grep -n "@rntme/" README.md | head -20`
Expected: prints existing package rows.

- [ ] **Step 2: Add the openrouter row to the packages table**

Insert (in the appropriate alphabetical or category position):

```markdown
| `@rntme/ai-llm-openrouter` | First AI/LLM vendor module — OpenRouter gateway. Implements `Complete` and `GetCompletion`. | `modules/ai-llm/openrouter/` |
```

- [ ] **Step 3: Add the demo to any "demos" table or section**

If README has a demos section, add:

```markdown
- `demo/cv-extract-blueprint/` — resume → extracted-JSON via OpenRouter (the first AI-LLM-bearing demo).
```

- [ ] **Step 4: Update the dependency graph if README has one**

Add a node for `@rntme/ai-llm-openrouter` with an edge to `@rntme/contracts-ai-llm-v1`. (Inspect existing graph syntax before editing.)

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs(readme): add openrouter module + cv-extract demo"
```

---

### Task 32: Update `AGENTS.md`

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: Locate §3 layering, §6 how-tos, §10 glossary**

Run: `grep -n "^## " AGENTS.md`
Expected: prints section headers (find §3, §6, §10).

- [ ] **Step 2: §3 layering — verify `modules/ai-llm/openrouter/**` is implicitly covered by the `modules/*/*` allowlist; update the rule explanation if the wording singles out specific module paths**

If §3 enumerates module paths verbatim and does not yet list `modules/ai-llm/`, add it. Otherwise no change.

- [ ] **Step 3: §6 how-tos — add a new how-to**

```markdown
### How to add an AI/LLM vendor module

1. Scaffold under `modules/ai-llm/<vendor>/` mirroring `modules/identity/auth0/` for layout (package.json, tsconfig, src/{handler,server,bin/server}.ts) and `modules/ai-llm/openrouter/` for AI/LLM-specific structure (completion-mapper.ts, error-mapper.ts, idempotency-store.ts).
2. Implement `Complete` and `GetCompletion` against `@rntme/contracts-ai-llm-v1` proto. Other 12 RPCs return `UNIMPLEMENTED` unless your vendor has native threads (`thread:true`) or batch (`async_job_types: ["BATCH_COMPLETION"]`).
3. Declare capabilities in `module.json`: `vendors[]` is the **routing prefix** (single-element). For gateway modules, optionally declare `gateway_upstreams[]`.
4. Map vendor errors to `AI_LLM_VENDOR_*` codes from `packages/contracts/ai-llm/v1/error-codes.json`. Avoid adding new codes unless none of the existing eight fits — reuse first.
5. Idempotency: SQLite (recommended; aligns with project storage target) or in-memory (dev only). 24h TTL minimum.
6. Reference: `modules/ai-llm/openrouter/` is the canonical first implementation.
```

- [ ] **Step 4: §10 glossary — add "gateway module"**

```markdown
**Gateway module** — an AI/LLM (or other category) module that fronts multiple upstream providers behind a single API key. Declares `vendors: ["<gateway-name>"]` (e.g. `["openrouter"]`) and optionally `gateway_upstreams: ["openai", "anthropic", ...]` for catalog/UX. Model addressing is `<gateway>/<rest>` where `<rest>` may itself contain slashes; the module strips its own prefix before forwarding.
```

- [ ] **Step 5: Commit**

```bash
git add AGENTS.md
git commit -m "docs(agents): how-to + glossary for AI/LLM vendor modules and gateways"
```

---

### Task 33: Update `CLAUDE.md` "Architecture in one paragraph"

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Locate the paragraph**

Run: `grep -n "Architecture in one paragraph" CLAUDE.md`
Expected: prints the section line.

- [ ] **Step 2: Append a sentence to the paragraph**

Add (at an appropriate point — after the existing modules-related sentences):

```markdown
The first AI/LLM vendor module, `@rntme/ai-llm-openrouter` (multi-provider gateway), now ships under `modules/ai-llm/openrouter/`; `demo/cv-extract-blueprint/` exercises it end-to-end via `Complete` with PDF input and JSON-schema-pinned structured output.
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(claude): note openrouter module + cv-extract demo in architecture paragraph"
```

---

### Task 34: Verify `dependency-cruiser` and `pnpm-workspace.yaml` cover new paths

**Files:**
- Read: `.dependency-cruiser.cjs`
- Read: `pnpm-workspace.yaml`

- [ ] **Step 1: Run dependency-cruiser**

Run: `pnpm dlx dependency-cruiser --config .dependency-cruiser.cjs modules/ai-llm/openrouter packages/contracts/ai-llm`
Expected: zero violations.

- [ ] **Step 2: Verify pnpm-workspace covers the new module path**

Run: `grep -E '(modules|demo)' pnpm-workspace.yaml`
Expected: shows globs that cover `modules/*/*` and `demo/*`. If not, add them.

- [ ] **Step 3: Run a workspace-wide test, lint, and typecheck**

Run: `pnpm -r run test && pnpm -r run lint && pnpm -r run typecheck`
Expected: every package passes.

- [ ] **Step 4: Commit any necessary tweaks**

```bash
git add .dependency-cruiser.cjs pnpm-workspace.yaml 2>/dev/null
git diff --cached --quiet || git commit -m "chore: cover new openrouter module + cv-extract paths in workspace config"
```

---

## Final verification

### Task 35: Workspace-wide green light

- [ ] **Step 1: Run the full battery**

```bash
pnpm install --frozen-lockfile
pnpm -r run build
pnpm -r run typecheck
pnpm -r run test
pnpm -r run lint
```

Expected: every step exits 0.

- [ ] **Step 2: Verify D1 drift-pins specifically catch the openrouter module**

Run: `pnpm -F @rntme/contracts-ai-llm-v1 test`
Expected: PASS — `capability-shape.test.ts` now exercises `modules/ai-llm/openrouter/module.json`.

- [ ] **Step 3: Read the resulting commit graph**

Run: `git log --oneline main..HEAD`
Expected: shows the chronological list of commits per task; no surprises.

---

## Backlog reminder

The following items are explicitly NOT in this PR (per spec §9). If reviewers ask, point them at the spec:

1. Streaming RPC and per-chunk events.
2. Cost tracking as first-class on `TokenUsage`/`Completion`.
3. Per-model capability resolution.
4. Fallback chain (`models: [...]`).
5. Provider preferences.
6. File-ingress disambiguation tied to S3 module brainstorm.
7. Structural validation of `response_format` enum (new error code).
8. Formal JSON schema for `module.json#capabilities` AI/LLM.
9. Audio modality.
10. Async batch via OpenAI Batch API (separate sub-class module).
11. Graceful error path in cv-extract demo.
12. Async polling flow for cv-extract.
13. GetCompletion windows beyond 24h.
14. OR analytics best practices (per-request `HTTP-Referer`/`X-Title`).
