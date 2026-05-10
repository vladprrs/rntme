# Deploy Runner Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract deploy orchestration code from `apps/platform-http/src/deploy/` into a new pure library `packages/deploy/deploy-runner` so the same code can be called by both the platform-side BPMN handlers (later plans) and the CLI direct-mode (later plans), without changing current platform behavior.

**Architecture:** A new workspace package `@rntme/deploy-runner` houses pure utilities (log redactor, stage runner, smoke verifier, Dokploy client factory, build-deploy-config, run-teardowns) and a high-level `runDeployment(inputs, hooks)` orchestrator. The orchestrator takes already-fetched/decrypted inputs and emits progress through hooks instead of writing to repos. The platform-http `executor.ts` becomes a thin wrapper that does the DB-coupled glue (fetch deployment row, fetch bundle blob, decrypt target secrets, persist via hooks) and delegates orchestration to `runDeployment`. No HTTP, DB, BPMN, Operaton, or platform-specific types live inside `deploy-runner`.

**Tech Stack:** TypeScript, Bun, `@rntme/deploy-core`, `@rntme/deploy-dokploy`, `@rntme/blueprint`, Bun's `bun test` runner.

---

## Scope Boundary

This plan moves code, defines a hook-based public API, and rewires the existing `platform-http` executor to use it. **It does not change observable behavior**, does not introduce BPMN, does not remove `apps/platform-http`, does not add any CLI command, and does not introduce a target adapter beyond what already exists. Tests added in this plan exercise the new package directly; existing platform-http tests must continue to pass through the wrapper.

The spec for this plan is `docs/superpowers/specs/2026-05-10-cli-universal-deploy-and-platform-http-removal-design.md`.

## File Structure

### Created files

- `packages/deploy/deploy-runner/package.json` — workspace package manifest.
- `packages/deploy/deploy-runner/tsconfig.json` — build config.
- `packages/deploy/deploy-runner/tsconfig.check.json` — typecheck config (extends from `apps/platform-http`'s pattern).
- `packages/deploy/deploy-runner/eslint.config.mjs` — lint config (mirrors `deploy-core`).
- `packages/deploy/deploy-runner/README.md` — package stub pointing to owner doc.
- `packages/deploy/deploy-runner/src/index.ts` — public re-exports.
- `packages/deploy/deploy-runner/src/types.ts` — public types: `NormalizedDeployTarget`, `ResolvedTargetSecrets`, `DeploymentHooks`, `RunDeploymentInputs`, `TerminalResult`, `StageName`, `StageEvidence`, `SanitizedLogLine`, `Result<T,E>`.
- `packages/deploy/deploy-runner/src/redactor.ts` — moved log-redactor.
- `packages/deploy/deploy-runner/src/stage-runner.ts` — moved stage runner.
- `packages/deploy/deploy-runner/src/smoke-verifier.ts` — moved smoke verifier.
- `packages/deploy/deploy-runner/src/dokploy-client-factory.ts` — moved Dokploy client factory.
- `packages/deploy/deploy-runner/src/build-deploy-config.ts` — moved build-deploy-config.
- `packages/deploy/deploy-runner/src/run-teardowns.ts` — moved teardown helpers.
- `packages/deploy/deploy-runner/src/run-deployment.ts` — extracted orchestrator entry point.
- `packages/deploy/deploy-runner/test/redactor.test.ts` — port + extend existing platform-http log-redactor coverage.
- `packages/deploy/deploy-runner/test/stage-runner.test.ts` — covers success, failure, throw paths.
- `packages/deploy/deploy-runner/test/smoke-verifier.test.ts` — port from existing tests.
- `packages/deploy/deploy-runner/test/dokploy-client-factory.test.ts` — port any unit-level tests.
- `packages/deploy/deploy-runner/test/build-deploy-config.test.ts` — port from `test/unit/deploy/build-deploy-config.test.ts`.
- `packages/deploy/deploy-runner/test/run-deployment.test.ts` — minimal smoke for the new entry point against fakes.
- `docs/current/owners/packages/deploy/deploy-runner.md` — owner doc following project convention.

### Modified files

- `apps/platform-http/package.json` — add workspace dependency `@rntme/deploy-runner`.
- `apps/platform-http/src/deploy/log-redactor.ts` — replace contents with `export { redact } from '@rntme/deploy-runner'`.
- `apps/platform-http/src/deploy/stage-runner.ts` — replace contents with re-export.
- `apps/platform-http/src/deploy/smoke-verifier.ts` — replace contents with re-export.
- `apps/platform-http/src/deploy/dokploy-client-factory.ts` — replace contents with re-export.
- `apps/platform-http/src/deploy/build-deploy-config.ts` — replace contents with re-export.
- `apps/platform-http/src/deploy/run-teardowns.ts` — replace contents with re-export.
- `apps/platform-http/src/deploy/executor.ts` — refactor `runDeployment` to delegate to `@rntme/deploy-runner`'s `runDeployment` with caller-side hooks; keep DB-bound glue (heartbeat loop, `withOrgTx`, `finalize`, `appendLog`).
- `apps/platform/README.md` is unaffected.
- `AGENTS.md` — add `packages/deploy/deploy-runner` to the Packages lookup table once the README exists.
- `docs/current/owners/apps/platform-http.md` — note that deploy orchestration now lives in `@rntme/deploy-runner`.

### Deleted

- `apps/platform-http/src/deploy/log-redactor.ts`
- `apps/platform-http/src/deploy/stage-runner.ts`
- `apps/platform-http/src/deploy/smoke-verifier.ts`
- `apps/platform-http/src/deploy/dokploy-client-factory.ts`

These are pure re-exports by Task 11 and are removed in the same task; their callers switch to `@rntme/deploy-runner` directly. `build-deploy-config.ts` and `run-teardowns.ts` keep a small adapter against `@rntme/platform-core` types and stay until the eventual `apps/platform-http` removal plan.

## Hook-Based Public API

The new `runDeployment` function never touches a database, never writes to a blob store, never reads encrypted secrets. The caller does all of that and feeds the result in. Side-effect-bearing events flow back out through hooks, which the caller routes to its own persistence.

```ts
// Public surface, expressed informally; exact field shapes are locked down in Task 2.

interface NormalizedDeployTarget {
  readonly id: string;
  readonly slug: string;
  readonly kind: 'dokploy';                       // discriminated; only Dokploy in this plan
  readonly displayName: string;
  readonly publicBaseUrl?: string;
  readonly dokployUrl: string;
  readonly dokployProjectId: string;
  readonly eventBus?: { mode: 'provisioned' | 'in-memory' | 'external'; /* … */ };
  // No secrets here — those flow through resolvedTargetSecrets.
}

interface ResolvedTargetSecrets {
  readonly apiToken: string;                      // Dokploy API bearer
  readonly extras: Readonly<Record<string, unknown>>;
}

interface DeploymentHooks {
  onLog?(line: SanitizedLogLine): void | Promise<void>;
  onStageBegin?(stage: StageName): void | Promise<void>;
  onStageComplete?(stage: StageName, evidence: StageEvidence): void | Promise<void>;
  onProvisionResult?(payload: { publicByModule: Record<string, unknown>;
                                secretByModule: Record<string, unknown>;
                                startedAt: string; finishedAt: string }): void | Promise<void>;
  onApplyResult?(payload: { actions: unknown; durationMs: number }): void | Promise<void>;
  onVerifyResult?(payload: { report: unknown }): void | Promise<void>;
  onTerminal?(result: TerminalResult): void | Promise<void>;
}

interface RunDeploymentInputs {
  readonly composedBlueprint: ComposedProjectInput | ComposedBlueprint;
  readonly bundleDir: string;                     // already-materialized
  readonly target: NormalizedDeployTarget;
  readonly resolvedTargetSecrets: ResolvedTargetSecrets;
  readonly orgSlug: string;
  readonly configOverrides: Record<string, unknown>;
  readonly priorProvisionOutputs: Record<string, ProvisionerOutput>;
  readonly resolveProvisioner: ResolveProvisioner;       // re-typed from deploy-core
  readonly publicDeployDomain?: string;
  readonly hooks?: DeploymentHooks;
  readonly abortSignal?: AbortSignal;
}

type StageName = 'plan' | 'provision' | 'render' | 'apply' | 'verify';

type TerminalResult =
  | { ok: true;  kind: 'succeeded'; }
  | { ok: false; kind: 'failed'; errorCode: string; errorMessage: string; errorTree?: unknown };

function runDeployment(inputs: RunDeploymentInputs): Promise<TerminalResult>;
```

The platform-http caller wraps `runDeployment` and supplies hooks that:

- `onLog` → `appendLog(deps, deploymentId, orgId, ...)`
- `onStageComplete('provision', ...)` and `onProvisionResult` → `repos.deployments.persistProvisionResult(...)` plus `secretCipher.encrypt(...)` for the secret envelope
- `onApplyResult` → `repos.deployments.persistApplyResult(...)`
- `onVerifyResult` → `repos.deployments.persistVerifyResult(...)`
- `onTerminal({ok:true})` → `finalize(deps, ..., 'succeeded', {})`
- `onTerminal({ok:false, errorCode, errorMessage, errorTree})` → `finalize(deps, ..., 'failed', {...})`

Heartbeat (`setInterval` calling `repos.deployments.touchHeartbeat`) stays in the caller; the runner has no opinion on liveness signaling.

## Tasks

### Task 1: Bootstrap @rntme/deploy-runner package skeleton

**Files:**
- Create: `packages/deploy/deploy-runner/package.json`
- Create: `packages/deploy/deploy-runner/tsconfig.json`
- Create: `packages/deploy/deploy-runner/tsconfig.check.json`
- Create: `packages/deploy/deploy-runner/eslint.config.mjs`
- Create: `packages/deploy/deploy-runner/README.md`
- Create: `packages/deploy/deploy-runner/src/index.ts`
- Create: `packages/deploy/deploy-runner/test/smoke.test.ts`

- [ ] **Step 1: Write the package smoke test**

Create `packages/deploy/deploy-runner/test/smoke.test.ts`:

```ts
import { describe, expect, it } from 'bun:test';
import * as runner from '../src/index.js';

describe('@rntme/deploy-runner package shape', () => {
  it('loads as ESM', () => {
    expect(typeof runner).toBe('object');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test packages/deploy/deploy-runner/test/smoke.test.ts`
Expected: FAIL — package does not exist yet.

- [ ] **Step 3: Add `packages/deploy/deploy-runner/package.json`**

```json
{
  "name": "@rntme/deploy-runner",
  "version": "0.0.0",
  "type": "module",
  "private": true,
  "description": "Pure deploy orchestrator library for rntme. Used by both the platform deployments service and the CLI direct-mode.",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": ["dist", "README.md"],
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "bun test",
    "typecheck": "tsc -p tsconfig.check.json",
    "lint": "eslint --no-error-on-unmatched-pattern \"src/**/*.ts\" \"test/**/*.ts\"",
    "format": "prettier --write ."
  },
  "dependencies": {
    "@rntme/blueprint": "workspace:*",
    "@rntme/deploy-core": "workspace:*",
    "@rntme/deploy-dokploy": "workspace:*"
  },
  "devDependencies": {
    "@eslint/js": "^9.10.0",
    "@types/bun": "latest",
    "@types/node": "^20.14.0",
    "@typescript-eslint/eslint-plugin": "^8.6.0",
    "@typescript-eslint/parser": "^8.6.0",
    "eslint": "^9.10.0",
    "prettier": "^3.3.3",
    "typescript": "^5.5.4"
  }
}
```

- [ ] **Step 4: Add `tsconfig.json` mirroring deploy-core**

```json
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": { "rootDir": "src", "outDir": "dist", "composite": false },
  "include": ["src/**/*.ts"],
  "exclude": ["dist", "node_modules", "test"]
}
```

- [ ] **Step 5: Add `tsconfig.check.json`**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": { "noEmit": true, "rootDir": "." },
  "include": ["src/**/*.ts", "test/**/*.ts"]
}
```

- [ ] **Step 6: Add `eslint.config.mjs` (copy of `packages/deploy/deploy-core/eslint.config.mjs`)**

Use the exact contents of `packages/deploy/deploy-core/eslint.config.mjs`.

- [ ] **Step 7: Add `README.md`**

```markdown
# @rntme/deploy-runner

Pure deploy orchestrator library for rntme. Used by both the platform `deployments` service and the CLI direct-mode.

Current documentation: [docs/current/owners/packages/deploy/deploy-runner.md](../../../docs/current/owners/packages/deploy/deploy-runner.md)

Local commands:
- `bun test`
- `bun run typecheck`
- `bun run build`
- `bun run lint`

Notes:
- No HTTP, no DB, no BPMN, no Operaton, no filesystem state. Side effects only on deploy targets.
- Caller supplies all inputs already-fetched / already-decrypted; persistence happens through hooks.
```

- [ ] **Step 8: Add a placeholder `src/index.ts`**

```ts
// Public surface. Filled in by Task 2 onward.
export {};
```

- [ ] **Step 9: Install + verify**

Run from repo root:

```bash
bun install
bun test packages/deploy/deploy-runner/test/smoke.test.ts
```

Expected: install succeeds, smoke test PASSES.

- [ ] **Step 10: Commit**

```bash
git add packages/deploy/deploy-runner/
git commit -m "feat(deploy-runner): bootstrap empty package"
```

---

### Task 2: Define public types in `src/types.ts`

**Files:**
- Create: `packages/deploy/deploy-runner/src/types.ts`
- Modify: `packages/deploy/deploy-runner/src/index.ts`
- Create: `packages/deploy/deploy-runner/test/types.test.ts`

- [ ] **Step 1: Write the type-shape contract test**

Create `packages/deploy/deploy-runner/test/types.test.ts`:

```ts
import { describe, expect, it } from 'bun:test';
import type {
  NormalizedDeployTarget,
  ResolvedTargetSecrets,
  DeploymentHooks,
  RunDeploymentInputs,
  TerminalResult,
  StageName,
  SanitizedLogLine,
  StageEvidence,
} from '../src/index.js';

describe('public types', () => {
  it('NormalizedDeployTarget discriminates by kind', () => {
    const t: NormalizedDeployTarget = {
      id: 'tgt-1',
      slug: 'preview',
      kind: 'dokploy',
      displayName: 'Preview',
      dokployUrl: 'https://dokploy.example.com',
      dokployProjectId: 'proj-1',
    };
    expect(t.kind).toBe('dokploy');
  });

  it('TerminalResult union is exhaustive', () => {
    const ok: TerminalResult = { ok: true, kind: 'succeeded' };
    const err: TerminalResult = {
      ok: false,
      kind: 'failed',
      errorCode: 'X',
      errorMessage: 'y',
    };
    expect(ok.ok).toBe(true);
    expect(err.ok).toBe(false);
  });

  it('StageName enumerates known stages', () => {
    const stages: StageName[] = ['plan', 'provision', 'render', 'apply', 'verify'];
    expect(stages.length).toBe(5);
  });

  it('DeploymentHooks fields are optional', () => {
    const hooks: DeploymentHooks = {};
    expect(hooks).toEqual({});
  });

  it('RunDeploymentInputs requires the documented fields', () => {
    // Compile-time only; presence of the fields is checked by the type system.
    const _shape: keyof RunDeploymentInputs = 'composedBlueprint';
    expect(_shape).toBe('composedBlueprint');
  });

  it('SanitizedLogLine has level/step/message', () => {
    const l: SanitizedLogLine = { level: 'info', step: 'plan', message: 'ok' };
    expect(l.level).toBe('info');
  });

  it('StageEvidence is keyed by StageName', () => {
    const e: StageEvidence = { stage: 'plan', durationMs: 0 };
    expect(e.stage).toBe('plan');
  });

  it('ResolvedTargetSecrets has apiToken + extras', () => {
    const s: ResolvedTargetSecrets = { apiToken: 'tok', extras: {} };
    expect(s.apiToken).toBe('tok');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test packages/deploy/deploy-runner/test/types.test.ts`
Expected: FAIL — types do not exist.

- [ ] **Step 3: Implement `src/types.ts`**

```ts
import type { ComposedBlueprint } from '@rntme/blueprint';
import type {
  ComposedProjectInput,
  ProvisionerContract,
  ProvisionerOutput,
} from '@rntme/deploy-core';

export type SanitizedLogLine = {
  readonly level: 'info' | 'warn' | 'error';
  readonly step: string;
  readonly message: string;
};

export type StageName = 'plan' | 'provision' | 'render' | 'apply' | 'verify';

export type StageEvidence = {
  readonly stage: StageName;
  readonly durationMs: number;
};

export type NormalizedDeployTarget = {
  readonly id: string;
  readonly slug: string;
  readonly kind: 'dokploy';
  readonly displayName: string;
  readonly publicBaseUrl?: string;
  readonly dokployUrl: string;
  readonly dokployProjectId: string;
  readonly eventBus?: {
    readonly mode: 'provisioned' | 'in-memory' | 'external';
    readonly externalBootstrap?: string;
  };
  readonly workflowEngineImage?: string;
  readonly workflowWorkerImage?: string;
};

export type ResolvedTargetSecrets = {
  readonly apiToken: string;
  readonly extras: Readonly<Record<string, unknown>>;
};

export type ResolveProvisioner = (
  packageName: string,
  entry: string,
  projectDir: string,
) => Promise<ProvisionerContract>;

export type ProvisionResultEnvelope = {
  readonly publicByModule: Record<string, Record<string, unknown>>;
  readonly secretByModule: Record<string, Record<string, unknown>>;
  readonly startedAt: string;
  readonly finishedAt: string;
};

export type ApplyResultEnvelope = {
  readonly actions: unknown;
  readonly durationMs: number;
};

export type VerifyResultEnvelope = {
  readonly report: unknown;
};

export type DeploymentHooks = {
  readonly onLog?: (line: SanitizedLogLine) => void | Promise<void>;
  readonly onStageBegin?: (stage: StageName) => void | Promise<void>;
  readonly onStageComplete?: (stage: StageName, evidence: StageEvidence) => void | Promise<void>;
  readonly onProvisionResult?: (payload: ProvisionResultEnvelope) => void | Promise<void>;
  readonly onApplyResult?: (payload: ApplyResultEnvelope) => void | Promise<void>;
  readonly onVerifyResult?: (payload: VerifyResultEnvelope) => void | Promise<void>;
  readonly onTerminal?: (result: TerminalResult) => void | Promise<void>;
};

export type TerminalResult =
  | { readonly ok: true; readonly kind: 'succeeded' }
  | {
      readonly ok: false;
      readonly kind: 'failed';
      readonly errorCode: string;
      readonly errorMessage: string;
      readonly errorTree?: unknown;
    };

export type RunDeploymentInputs = {
  readonly composedBlueprint: ComposedProjectInput | ComposedBlueprint;
  readonly bundleDir: string;
  readonly target: NormalizedDeployTarget;
  readonly resolvedTargetSecrets: ResolvedTargetSecrets;
  readonly orgSlug: string;
  readonly configOverrides: Record<string, unknown>;
  readonly priorProvisionOutputs: Readonly<Record<string, ProvisionerOutput>>;
  readonly resolveProvisioner: ResolveProvisioner;
  readonly publicDeployDomain?: string;
  readonly hooks?: DeploymentHooks;
  readonly abortSignal?: AbortSignal;
};
```

- [ ] **Step 4: Update `src/index.ts` to re-export types**

```ts
export type {
  NormalizedDeployTarget,
  ResolvedTargetSecrets,
  ResolveProvisioner,
  DeploymentHooks,
  RunDeploymentInputs,
  TerminalResult,
  StageName,
  StageEvidence,
  SanitizedLogLine,
  ProvisionResultEnvelope,
  ApplyResultEnvelope,
  VerifyResultEnvelope,
} from './types.js';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun test packages/deploy/deploy-runner/test/types.test.ts`
Expected: PASS.

- [ ] **Step 6: Typecheck the package**

Run: `bun run --filter @rntme/deploy-runner typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/deploy/deploy-runner/src/ packages/deploy/deploy-runner/test/types.test.ts
git commit -m "feat(deploy-runner): define public types"
```

---

### Task 3: Move `log-redactor` into `deploy-runner` and re-export from platform-http

**Files:**
- Create: `packages/deploy/deploy-runner/src/redactor.ts`
- Create: `packages/deploy/deploy-runner/test/redactor.test.ts`
- Modify: `packages/deploy/deploy-runner/src/index.ts`
- Modify: `apps/platform-http/src/deploy/log-redactor.ts`

- [ ] **Step 1: Write the failing test in deploy-runner**

Create `packages/deploy/deploy-runner/test/redactor.test.ts`:

```ts
import { describe, expect, it } from 'bun:test';
import { redact } from '../src/redactor.js';

describe('redact', () => {
  it('masks Authorization Bearer values', () => {
    expect(redact('Authorization: Bearer abc123')).toBe('Authorization: Bearer ***');
  });

  it('masks api-key query parameters', () => {
    expect(redact('https://x.example?apiToken=secret&foo=1'))
      .toBe('https://x.example?apiToken=***&foo=1');
  });

  it('masks structural secretOutputs JSON values', () => {
    const input = '{"secretOutputs":{"k":"v"},"keep":1}';
    expect(redact(input)).toContain('"secretOutputs":"***"');
    expect(redact(input)).toContain('"keep":1');
  });

  it('passes through strings with no secrets', () => {
    expect(redact('hello world')).toBe('hello world');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test packages/deploy/deploy-runner/test/redactor.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Move the implementation**

Copy the full contents of `apps/platform-http/src/deploy/log-redactor.ts` into a new file `packages/deploy/deploy-runner/src/redactor.ts`. The exported function name stays `redact`. No code changes.

- [ ] **Step 4: Add `redact` to `src/index.ts`**

Append to `packages/deploy/deploy-runner/src/index.ts`:

```ts
export { redact } from './redactor.js';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun test packages/deploy/deploy-runner/test/redactor.test.ts`
Expected: PASS.

- [ ] **Step 6: Add the workspace dependency in platform-http**

Modify `apps/platform-http/package.json` to add under `dependencies`:

```json
"@rntme/deploy-runner": "workspace:*",
```

Then run from repo root:

```bash
bun install
```

- [ ] **Step 7: Replace platform-http file with re-export**

Replace the entire contents of `apps/platform-http/src/deploy/log-redactor.ts` with:

```ts
export { redact } from '@rntme/deploy-runner';
```

- [ ] **Step 8: Verify platform-http typecheck and tests still pass**

Run:

```bash
bun run --filter @rntme/platform-http typecheck
bun run --filter @rntme/platform-http test
```

Expected: PASS (testcontainers can be skipped via `SKIP_TESTCONTAINERS=1`).

- [ ] **Step 9: Commit**

```bash
git add packages/deploy/deploy-runner/src/redactor.ts \
        packages/deploy/deploy-runner/src/index.ts \
        packages/deploy/deploy-runner/test/redactor.test.ts \
        apps/platform-http/src/deploy/log-redactor.ts \
        apps/platform-http/package.json
git commit -m "refactor(deploy-runner): move redactor; re-export from platform-http"
```

---

### Task 4: Move `stage-runner` into `deploy-runner`

**Files:**
- Create: `packages/deploy/deploy-runner/src/stage-runner.ts`
- Create: `packages/deploy/deploy-runner/test/stage-runner.test.ts`
- Modify: `packages/deploy/deploy-runner/src/index.ts`
- Modify: `apps/platform-http/src/deploy/stage-runner.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/deploy/deploy-runner/test/stage-runner.test.ts`:

```ts
import { describe, expect, it } from 'bun:test';
import { runStage } from '../src/stage-runner.js';

describe('runStage', () => {
  it('returns ok result without logging', async () => {
    const logs: unknown[] = [];
    const r = await runStage('plan', async () => ({ ok: true as const, value: 42 }), {
      log: (e) => void logs.push(e),
    });
    expect(r).toEqual({ ok: true, value: 42 });
    expect(logs).toEqual([]);
  });

  it('logs an error entry when fn returns failure', async () => {
    const logs: unknown[] = [];
    const r = await runStage(
      'render',
      async () => ({ ok: false as const, errors: [{ code: 'X', message: 'y' }] }),
      { log: (e) => void logs.push(e) },
    );
    expect(r.ok).toBe(false);
    expect(logs).toEqual([{ step: 'render', level: 'error', code: 'X', message: 'y' }]);
  });

  it('logs and re-throws when fn throws', async () => {
    const logs: unknown[] = [];
    let caught: unknown;
    try {
      await runStage('apply', async () => {
        throw new Error('boom');
      }, { log: (e) => void logs.push(e) });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeDefined();
    expect(logs).toEqual([
      { step: 'apply', level: 'error', code: 'DEPLOY_EXECUTOR_UNCAUGHT', message: 'boom' },
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test packages/deploy/deploy-runner/test/stage-runner.test.ts`
Expected: FAIL.

- [ ] **Step 3: Move implementation**

Copy `apps/platform-http/src/deploy/stage-runner.ts` to `packages/deploy/deploy-runner/src/stage-runner.ts` unchanged.

- [ ] **Step 4: Re-export from package index**

Append to `packages/deploy/deploy-runner/src/index.ts`:

```ts
export { runStage } from './stage-runner.js';
export type { StageLog, StageResult } from './stage-runner.js';
```

- [ ] **Step 5: Replace platform-http file with re-export**

Replace contents of `apps/platform-http/src/deploy/stage-runner.ts`:

```ts
export { runStage } from '@rntme/deploy-runner';
export type { StageLog, StageResult } from '@rntme/deploy-runner';
```

- [ ] **Step 6: Run all relevant tests**

```bash
bun test packages/deploy/deploy-runner/test/stage-runner.test.ts
bun run --filter @rntme/platform-http typecheck
bun run --filter @rntme/platform-http test
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/deploy/deploy-runner/src/stage-runner.ts \
        packages/deploy/deploy-runner/src/index.ts \
        packages/deploy/deploy-runner/test/stage-runner.test.ts \
        apps/platform-http/src/deploy/stage-runner.ts
git commit -m "refactor(deploy-runner): move stage-runner; re-export from platform-http"
```

---

### Task 5: Move `smoke-verifier` into `deploy-runner`

**Files:**
- Create: `packages/deploy/deploy-runner/src/smoke-verifier.ts`
- Create: `packages/deploy/deploy-runner/test/smoke-verifier.test.ts`
- Modify: `packages/deploy/deploy-runner/src/index.ts`
- Modify: `apps/platform-http/src/deploy/smoke-verifier.ts`

- [ ] **Step 1: Port the existing unit test as the failing test**

Read `apps/platform-http/test/unit/deploy/smoke-verifier.test.ts` and copy its contents into `packages/deploy/deploy-runner/test/smoke-verifier.test.ts`, replacing imports of `../../../src/deploy/smoke-verifier.js` with `../src/smoke-verifier.js`. Use the `bun:test` describe/it/expect API; if the source uses Vitest, swap the import:

```ts
import { describe, expect, it } from 'bun:test';
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test packages/deploy/deploy-runner/test/smoke-verifier.test.ts`
Expected: FAIL — module not present.

- [ ] **Step 3: Move implementation**

Copy `apps/platform-http/src/deploy/smoke-verifier.ts` (~219 lines) to `packages/deploy/deploy-runner/src/smoke-verifier.ts` unchanged. Confirm imports inside the file remain valid (they use `node:` builtins and `pino` types only via type-only imports; no platform-core imports).

- [ ] **Step 4: Re-export from package index**

Append to `packages/deploy/deploy-runner/src/index.ts`:

```ts
export { SmokeVerifier, defaultSmokeFetcher } from './smoke-verifier.js';
export type {
  SmokeFetcher,
  ProtectedRouteSpec,
  VerificationHints,
} from './smoke-verifier.js';
```

- [ ] **Step 5: Replace platform-http file with re-export**

Replace contents of `apps/platform-http/src/deploy/smoke-verifier.ts`:

```ts
export { SmokeVerifier, defaultSmokeFetcher } from '@rntme/deploy-runner';
export type {
  SmokeFetcher,
  ProtectedRouteSpec,
  VerificationHints,
} from '@rntme/deploy-runner';
```

- [ ] **Step 6: Run tests**

```bash
bun test packages/deploy/deploy-runner/test/smoke-verifier.test.ts
bun run --filter @rntme/platform-http typecheck
bun run --filter @rntme/platform-http test
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/deploy/deploy-runner/src/smoke-verifier.ts \
        packages/deploy/deploy-runner/src/index.ts \
        packages/deploy/deploy-runner/test/smoke-verifier.test.ts \
        apps/platform-http/src/deploy/smoke-verifier.ts
git commit -m "refactor(deploy-runner): move smoke-verifier; re-export from platform-http"
```

---

### Task 6: Move `dokploy-client-factory` into `deploy-runner`

**Files:**
- Create: `packages/deploy/deploy-runner/src/dokploy-client-factory.ts`
- Create: `packages/deploy/deploy-runner/test/dokploy-client-factory.test.ts`
- Modify: `packages/deploy/deploy-runner/src/index.ts`
- Modify: `apps/platform-http/src/deploy/dokploy-client-factory.ts`

- [ ] **Step 1: Inspect the original for platform-core dependencies**

Read `apps/platform-http/src/deploy/dokploy-client-factory.ts` (`grep -n "from '@rntme/platform-core'" apps/platform-http/src/deploy/dokploy-client-factory.ts`).

If it imports `SecretCipher` or `EncryptedSecret` or `DeployTargetWithSecret` from `@rntme/platform-core`:

The runner cannot depend on `@rntme/platform-core` (platform-domain types). Replace those imports with the equivalent shapes already defined in `packages/deploy/deploy-runner/src/types.ts` (`ResolvedTargetSecrets`) plus a minimal local `SecretCipher` interface declared in this file:

```ts
export interface SecretCipher {
  encrypt(plaintext: string): { ciphertext: string; iv: string; algo: string };
  decrypt(payload: { ciphertext: string; iv: string; algo: string }): string;
}
```

Use these new types throughout the moved file.

- [ ] **Step 2: Write a focused factory smoke test**

Create `packages/deploy/deploy-runner/test/dokploy-client-factory.test.ts`:

```ts
import { describe, expect, it } from 'bun:test';
import { createDokployClientFactory, normalizeDokployBaseUrl } from '../src/dokploy-client-factory.js';

describe('normalizeDokployBaseUrl', () => {
  it('keeps a clean origin', () => {
    expect(normalizeDokployBaseUrl('https://dokploy.example.com'))
      .toBe('https://dokploy.example.com');
  });

  it('strips trailing slash', () => {
    expect(normalizeDokployBaseUrl('https://dokploy.example.com/'))
      .toBe('https://dokploy.example.com');
  });

  it('strips trailing /api', () => {
    expect(normalizeDokployBaseUrl('https://dokploy.example.com/api'))
      .toBe('https://dokploy.example.com');
  });
});

describe('createDokployClientFactory', () => {
  it('returns a callable factory', () => {
    const cipher = {
      encrypt: () => ({ ciphertext: '', iv: '', algo: 'noop' }),
      decrypt: () => '',
    };
    const factory = createDokployClientFactory(cipher);
    expect(typeof factory).toBe('function');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `bun test packages/deploy/deploy-runner/test/dokploy-client-factory.test.ts`
Expected: FAIL.

- [ ] **Step 4: Move implementation with import rewires**

Copy `apps/platform-http/src/deploy/dokploy-client-factory.ts` to `packages/deploy/deploy-runner/src/dokploy-client-factory.ts`. Apply the import substitutions identified in Step 1.

- [ ] **Step 5: Re-export from package index**

Append to `packages/deploy/deploy-runner/src/index.ts`:

```ts
export {
  createDokployClientFactory,
  normalizeDokployBaseUrl,
} from './dokploy-client-factory.js';
export type {
  DokployClientFactory,
  DokployResolvedTargetSecretMap,
  SecretCipher,
} from './dokploy-client-factory.js';
```

- [ ] **Step 6: Replace platform-http file with re-export**

Replace contents of `apps/platform-http/src/deploy/dokploy-client-factory.ts`:

```ts
export {
  createDokployClientFactory,
  normalizeDokployBaseUrl,
} from '@rntme/deploy-runner';
export type {
  DokployClientFactory,
  DokployResolvedTargetSecretMap,
  SecretCipher,
} from '@rntme/deploy-runner';
```

If any callsite in platform-http relied on a `SecretCipher` from `@rntme/platform-core`, point them at the deploy-runner re-export — the local `SecretCipher` in this package is structurally identical and is the new canonical shape for deploy purposes.

- [ ] **Step 7: Run tests**

```bash
bun test packages/deploy/deploy-runner/test/dokploy-client-factory.test.ts
bun run --filter @rntme/platform-http typecheck
bun run --filter @rntme/platform-http test
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/deploy/deploy-runner/src/dokploy-client-factory.ts \
        packages/deploy/deploy-runner/src/index.ts \
        packages/deploy/deploy-runner/test/dokploy-client-factory.test.ts \
        apps/platform-http/src/deploy/dokploy-client-factory.ts
git commit -m "refactor(deploy-runner): move dokploy-client-factory; re-export from platform-http"
```

---

### Task 7: Move `build-deploy-config` into `deploy-runner`

**Files:**
- Create: `packages/deploy/deploy-runner/src/build-deploy-config.ts`
- Create: `packages/deploy/deploy-runner/test/build-deploy-config.test.ts`
- Modify: `packages/deploy/deploy-runner/src/index.ts`
- Modify: `apps/platform-http/src/deploy/build-deploy-config.ts`

- [ ] **Step 1: Inspect dependencies**

Read `apps/platform-http/src/deploy/build-deploy-config.ts` for imports from `@rntme/platform-core`.

Most likely it imports `DeployTarget` (the platform DB row shape). Replace that with `NormalizedDeployTarget` from `packages/deploy/deploy-runner/src/types.ts`. The functions take target metadata fields the runner already exposes.

- [ ] **Step 2: Port the existing test as the failing test**

Read `apps/platform-http/test/unit/deploy/build-deploy-config.test.ts` and copy into `packages/deploy/deploy-runner/test/build-deploy-config.test.ts`. Adjust imports and any `DeployTarget` literals to use `NormalizedDeployTarget` shape (the test will need a minimal `NormalizedDeployTarget` factory; inline literals are fine).

- [ ] **Step 3: Run test to verify it fails**

Run: `bun test packages/deploy/deploy-runner/test/build-deploy-config.test.ts`
Expected: FAIL.

- [ ] **Step 4: Move implementation**

Copy `apps/platform-http/src/deploy/build-deploy-config.ts` to `packages/deploy/deploy-runner/src/build-deploy-config.ts` with the import rewires from Step 1. Function signatures stay byte-identical except the target parameter changes type from `DeployTarget` to `NormalizedDeployTarget`.

- [ ] **Step 5: Re-export from package index**

Append to `packages/deploy/deploy-runner/src/index.ts`:

```ts
export {
  buildProjectDeploymentConfig,
  buildDokployTargetConfig,
  derivePublicBaseUrl,
} from './build-deploy-config.js';
export type { PublicBaseUrlContext } from './build-deploy-config.js';
```

- [ ] **Step 6: Replace platform-http file with re-export and a thin adapter**

Some platform-http callers still pass a `DeployTarget` (the DB row). Rather than rewriting all callsites in this task, add a small adapter alongside the re-export:

```ts
// apps/platform-http/src/deploy/build-deploy-config.ts
import type { DeployTarget } from '@rntme/platform-core';
import type { NormalizedDeployTarget } from '@rntme/deploy-runner';
import {
  buildProjectDeploymentConfig as runnerBuildProjectDeploymentConfig,
  buildDokployTargetConfig as runnerBuildDokployTargetConfig,
  derivePublicBaseUrl,
} from '@rntme/deploy-runner';

export { derivePublicBaseUrl };
export type { PublicBaseUrlContext } from '@rntme/deploy-runner';

export function normalizeDeployTarget(t: DeployTarget): NormalizedDeployTarget {
  return {
    id: t.id,
    slug: t.slug,
    kind: 'dokploy',
    displayName: t.displayName,
    publicBaseUrl: t.publicBaseUrl ?? undefined,
    dokployUrl: t.config.dokployUrl,
    dokployProjectId: t.config.dokployProjectId,
    eventBus: t.config.eventBus,
    workflowEngineImage: t.config.workflowEngineImage ?? undefined,
    workflowWorkerImage: t.config.workflowWorkerImage ?? undefined,
  };
}

export function buildProjectDeploymentConfig(
  target: DeployTarget,
  orgSlug: string,
  overrides: Record<string, unknown>,
  ctx: { projectSlug: string; publicDeployDomain?: string },
) {
  return runnerBuildProjectDeploymentConfig(normalizeDeployTarget(target), orgSlug, overrides, ctx);
}

export function buildDokployTargetConfig(target: DeployTarget) {
  return runnerBuildDokployTargetConfig(normalizeDeployTarget(target));
}
```

This wrapper is intentionally short-lived; it goes away when the executor extraction completes in Task 9.

- [ ] **Step 7: Run tests**

```bash
bun test packages/deploy/deploy-runner/test/build-deploy-config.test.ts
bun run --filter @rntme/platform-http typecheck
bun run --filter @rntme/platform-http test
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/deploy/deploy-runner/src/build-deploy-config.ts \
        packages/deploy/deploy-runner/src/index.ts \
        packages/deploy/deploy-runner/test/build-deploy-config.test.ts \
        apps/platform-http/src/deploy/build-deploy-config.ts
git commit -m "refactor(deploy-runner): move build-deploy-config behind a NormalizedDeployTarget boundary"
```

---

### Task 8: Move `run-teardowns` into `deploy-runner`

**Files:**
- Create: `packages/deploy/deploy-runner/src/run-teardowns.ts`
- Create: `packages/deploy/deploy-runner/test/run-teardowns.test.ts`
- Modify: `packages/deploy/deploy-runner/src/index.ts`
- Modify: `apps/platform-http/src/deploy/run-teardowns.ts`

- [ ] **Step 1: Inspect dependencies**

Read `apps/platform-http/src/deploy/run-teardowns.ts`. Identify any imports from `@rntme/platform-core` and any callbacks that touch DB repos.

If `TearDownDeps` carries DB repos as fields, redesign it as a pure interface that accepts function callbacks (no repo objects):

```ts
export interface TearDownDeps {
  readonly findStaleTargetResources: (input: TearDownInput) => Promise<readonly TargetResourceRef[]>;
  readonly removeTargetResource: (ref: TargetResourceRef) => Promise<{ ok: true } | { ok: false; reason: string }>;
  readonly log: (line: SanitizedLogLine) => void | Promise<void>;
}
```

The exact shape may already be repo-free — if so, no redesign needed.

- [ ] **Step 2: Write a focused test**

Create `packages/deploy/deploy-runner/test/run-teardowns.test.ts` covering at least:

- a happy-path teardown loop with one stale resource
- a failed remove that surfaces an error log

Use inline fakes for `TearDownDeps`. Do not pull in testcontainers here.

- [ ] **Step 3: Run test to verify it fails**

Run: `bun test packages/deploy/deploy-runner/test/run-teardowns.test.ts`
Expected: FAIL.

- [ ] **Step 4: Move implementation**

Copy `apps/platform-http/src/deploy/run-teardowns.ts` to `packages/deploy/deploy-runner/src/run-teardowns.ts` with import rewires from Step 1.

- [ ] **Step 5: Re-export from package index**

Append to `packages/deploy/deploy-runner/src/index.ts`:

```ts
export { runTearDownsForDeployment } from './run-teardowns.js';
export type { TearDownDeps } from './run-teardowns.js';
```

- [ ] **Step 6: Replace platform-http file with re-export plus DB-bound adapter**

Mirror the Task 7 adapter pattern: keep a `runTearDownsForDeployment` in `apps/platform-http/src/deploy/run-teardowns.ts` that constructs the runner-flavored `TearDownDeps` from the platform-http repo set and delegates. This file disappears in the executor extraction task (Task 9 / 10).

- [ ] **Step 7: Run tests**

```bash
bun test packages/deploy/deploy-runner/test/run-teardowns.test.ts
bun run --filter @rntme/platform-http typecheck
bun run --filter @rntme/platform-http test
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/deploy/deploy-runner/src/run-teardowns.ts \
        packages/deploy/deploy-runner/src/index.ts \
        packages/deploy/deploy-runner/test/run-teardowns.test.ts \
        apps/platform-http/src/deploy/run-teardowns.ts
git commit -m "refactor(deploy-runner): move run-teardowns behind a callback-only deps interface"
```

---

### Task 9: Implement `runDeployment(inputs, hooks)` in `deploy-runner`

This is the meat of the extraction. The orchestrator covers the same stages as the current `executor.ts`'s `runDeployment` but stops at the boundaries defined in the public types: it does not touch DB, does not fetch blobs, does not decrypt secrets, does not finalize anything outside the hooks.

**Files:**
- Create: `packages/deploy/deploy-runner/src/run-deployment.ts`
- Create: `packages/deploy/deploy-runner/test/run-deployment.test.ts`
- Modify: `packages/deploy/deploy-runner/src/index.ts`

- [ ] **Step 1: Locate the existing executor test fixture and its in-memory deploy harness**

Open `apps/platform-http/test/unit/deploy/executor.test.ts` and identify:

1. The fixture builder used to create a composed blueprint (look for a helper named like `makeComposedBlueprint`, `loadFixtureBundle`, or an inline `composedBlueprint` literal).
2. The fake `ExecutorDeps` it constructs (look for `withOrgTx`, `dokployClientFactory`, `smoker`, `resolveProvisioner` test doubles).
3. Any test fixtures under `apps/platform-http/test/fixtures/` that the executor test points at.

The orchestrator test reuses these — they are the only deploy-end-to-end fixtures known to be valid in the repo. Do not invent a new minimal blueprint; the deploy plan/provision/render pipeline rejects underspecified inputs and the test would just fight validation.

- [ ] **Step 2: Write the failing orchestrator test that mirrors the executor test's invocation pattern**

Create `packages/deploy/deploy-runner/test/run-deployment.test.ts`. Import the same fixture helpers from the platform-http test directory (relative path is fine for tests; alternatively, copy the fixture into `packages/deploy/deploy-runner/test/fixtures/` if cross-app test imports are not allowed by lint).

The test asserts on hook invocation, terminal shape, and secret redaction — not on persistence (persistence is the caller's job and is exercised by the platform-http executor test):

```ts
import { describe, expect, it } from 'bun:test';
import { runDeployment } from '../src/run-deployment.js';
import type { SanitizedLogLine, StageName, TerminalResult } from '../src/index.js';
// Reuse the existing executor-test fixture builder. Adjust the relative path
// based on where you copied/located the fixture in Step 1.
import { makeRunDeploymentInputsFromExecutorFixture } from './fixtures/executor-bridge.js';

describe('runDeployment', () => {
  it('emits stage hooks in order plan → provision → render → apply → verify', async () => {
    const stages: StageName[] = [];
    const inputs = makeRunDeploymentInputsFromExecutorFixture({
      hooks: { onStageBegin: (s) => void stages.push(s) },
    });
    const result = await runDeployment(inputs);
    expect(result.ok).toBe(true);
    expect(stages).toEqual(['plan', 'provision', 'render', 'apply', 'verify']);
  });

  it('emits onTerminal exactly once with kind succeeded on success', async () => {
    const calls: TerminalResult[] = [];
    const inputs = makeRunDeploymentInputsFromExecutorFixture({
      hooks: { onTerminal: (r) => void calls.push(r) },
    });
    await runDeployment(inputs);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({ ok: true, kind: 'succeeded' });
  });

  it('redacts secrets in logs', async () => {
    const lines: SanitizedLogLine[] = [];
    const inputs = makeRunDeploymentInputsFromExecutorFixture({
      hooks: { onLog: (l) => void lines.push(l) },
      // The fixture seeds a target with a recognizable secret so we can assert it never appears
      // in any log line (the redactor strips `apiToken=...` patterns).
      seedDokployApiToken: 'shibboleth-token',
    });
    await runDeployment(inputs);
    const concatenated = lines.map((l) => l.message).join('\n');
    expect(concatenated).not.toContain('shibboleth-token');
  });
});
```

Then create `packages/deploy/deploy-runner/test/fixtures/executor-bridge.ts` that:

1. Imports the existing executor test's fixture builder (or the parts of it that build a `ComposedBlueprint`, a deploy target, and a stub Dokploy client).
2. Adapts the result to the new `RunDeploymentInputs` shape using `normalizeDeployTarget` (Task 7) and a `ResolvedTargetSecrets` literal `{ apiToken: opts.seedDokployApiToken ?? 'test-token', extras: {} }`.
3. Returns `RunDeploymentInputs` with the supplied `hooks` merged in.

Concretely, the bridge file is ~30 lines and looks like:

```ts
import { normalizeDeployTarget } from '../../../../apps/platform-http/src/deploy/build-deploy-config.js';
import {
  buildExecutorFixtureBundleDir,
  buildExecutorFixtureComposedBlueprint,
  buildExecutorFixtureTarget,
  buildExecutorFixtureResolveProvisioner,
} from '../../../../apps/platform-http/test/unit/deploy/executor.test.fixtures.js';
import type { DeploymentHooks, RunDeploymentInputs } from '../../src/index.js';

export function makeRunDeploymentInputsFromExecutorFixture(opts: {
  hooks?: DeploymentHooks;
  seedDokployApiToken?: string;
} = {}): RunDeploymentInputs {
  return {
    composedBlueprint: buildExecutorFixtureComposedBlueprint(),
    bundleDir: buildExecutorFixtureBundleDir(),
    target: normalizeDeployTarget(buildExecutorFixtureTarget()),
    resolvedTargetSecrets: { apiToken: opts.seedDokployApiToken ?? 'test-token', extras: {} },
    orgSlug: 'test-org',
    configOverrides: {},
    priorProvisionOutputs: {},
    resolveProvisioner: buildExecutorFixtureResolveProvisioner(),
    hooks: opts.hooks,
  };
}
```

If the existing executor test does not export its fixture builders (most likely it does not — they are inline `function` declarations inside the test file), refactor the executor test to export them as a side change in this step. That refactor is a pure code move and does not change the executor test's assertions.

If cross-package test imports trigger a lint or depcruise warning, copy the fixture builders into `packages/deploy/deploy-runner/test/fixtures/executor-fixtures.ts` instead. Either approach is fine; the goal is the orchestrator test exercises the same valid composed blueprint the legacy executor test uses.

- [ ] **Step 3: Run test to verify it fails**

Run: `bun test packages/deploy/deploy-runner/test/run-deployment.test.ts`
Expected: FAIL — module not present.

- [ ] **Step 4: Extract the orchestrator from executor.ts**

Create `packages/deploy/deploy-runner/src/run-deployment.ts`. Copy the body of `runDeployment` from `apps/platform-http/src/deploy/executor.ts` (lines 140-587 approximately) and apply these mechanical transforms:

| Old (executor.ts) | New (run-deployment.ts) |
| --- | --- |
| `deps.withOrgTx(orgId, repos => repos.deployments.touchHeartbeat(...))` | **Removed.** Heartbeat stays in the platform-http caller. |
| `deps.blob.getRaw(ctx.bundleBlobKey)` | **Removed.** Caller passes `bundleDir`. |
| `gunzipSync` + `parseCanonicalBundle` + `materializeBundle` | **Removed.** Caller materialized already. |
| `await resolveTarget(deps, orgId, ctx.targetId)` | **Removed.** Caller passes `target`. |
| `deps.targetSecretsRepoFor(orgId)` + `getAllDecrypted(target.id)` | **Removed.** Caller passes `resolvedTargetSecrets`. |
| `appendLog(deps, deploymentId, orgId, ...)` | `inputs.hooks?.onLog?.({ level, step, message })` |
| `finalize(deps, ..., 'failed', { errorCode, errorMessage, errorTree })` | `return { ok: false, kind: 'failed', errorCode, errorMessage, errorTree }` plus `inputs.hooks?.onTerminal?.(result)` |
| `finalize(deps, ..., 'succeeded', {})` | `return { ok: true, kind: 'succeeded' }` plus `onTerminal` |
| `repos.deployments.persistProvisionResult(...)` | `inputs.hooks?.onProvisionResult?.(envelope)` (envelope built per `ProvisionResultEnvelope`) |
| `deps.secretCipher.encrypt(...)` for provisioner secrets | **Removed.** Caller is responsible for encryption inside `onProvisionResult`. |
| `repos.deployments.persistApplyResult(...)` | `inputs.hooks?.onApplyResult?.(envelope)` |
| `repos.deployments.persistVerifyResult(...)` | `inputs.hooks?.onVerifyResult?.(envelope)` |

Also:

- The function signature changes from `(deploymentId, orgId, deps)` to `(inputs: RunDeploymentInputs): Promise<TerminalResult>`.
- Replace `deps.logger.error/warn/info` calls (if any are needed inside the runner; most should already be appendLog) with `console.error` only behind a guard, or remove entirely. The runner does not own a logger; observability is via hooks.
- `setInterval` heartbeat is removed.
- `tmpDir` cleanup that the executor performs (`rm` on the temp directory) is removed; the caller owns the bundle directory lifecycle.

Internal helpers from the original `executor.ts` (anything declared `function` or `const` between line 200 and the end of `runDeployment`) move with the orchestrator. `deployErrorsToPlatformError` moves too (export it from `run-deployment.ts` so platform-http can keep formatting errors for the API).

- [ ] **Step 5: Re-export from package index**

Append to `packages/deploy/deploy-runner/src/index.ts`:

```ts
export { runDeployment, deployErrorsToPlatformError } from './run-deployment.js';
```

- [ ] **Step 6: Run the orchestrator test**

Run: `bun test packages/deploy/deploy-runner/test/run-deployment.test.ts`
Expected: PASS.

- [ ] **Step 7: Typecheck the package**

Run: `bun run --filter @rntme/deploy-runner typecheck`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/deploy/deploy-runner/src/run-deployment.ts \
        packages/deploy/deploy-runner/src/index.ts \
        packages/deploy/deploy-runner/test/run-deployment.test.ts \
        packages/deploy/deploy-runner/test/fixtures/
git commit -m "feat(deploy-runner): extract runDeployment orchestrator with hook-based outputs"
```

---

### Task 10: Wire `apps/platform-http/src/deploy/executor.ts` to the new orchestrator

Now `executor.ts` becomes the DB-bound caller. It keeps the heartbeat loop, the bundle fetch, the target secret decryption, and the finalization, and delegates the inner stages to `@rntme/deploy-runner`.

**Files:**
- Modify: `apps/platform-http/src/deploy/executor.ts`

- [ ] **Step 1: Read the existing executor to confirm current behavior**

```bash
sed -n '140,200p' apps/platform-http/src/deploy/executor.ts
```

Note the boundary points where DB writes happen (heartbeat, appendLog, finalize, persistProvisionResult, persistApplyResult, persistVerifyResult).

- [ ] **Step 2: Replace the body of `runDeployment` (lines ~140-587)**

The new body of `runDeployment(deploymentId, orgId, deps)` becomes a coordinator:

```ts
import { runDeployment as orchestrate, type RunDeploymentInputs } from '@rntme/deploy-runner';
import { normalizeDeployTarget } from './build-deploy-config.js'; // adapter from Task 7

export async function runDeployment(deploymentId: string, orgId: string, deps: ExecutorDeps): Promise<void> {
  const heartbeat = setInterval(() => {
    void deps.withOrgTx(orgId, (repos) => repos.deployments.touchHeartbeat(deploymentId)).catch(() => undefined);
  }, deps.heartbeatMs ?? 5_000);
  let tmpDir: string | null = null;

  try {
    // 1. Resolve deployment context, fetch project version, target.
    const ctx = await startAndResolveContext(deploymentId, orgId, deps);  // unchanged helper
    await deps.withOrgTx(orgId, (repos) => repos.deployments.touchHeartbeat(deploymentId));

    // 2. Fetch and materialize bundle.
    const bundleDir = await fetchAndMaterializeBundle(deps, deploymentId, orgId, ctx);
    if (bundleDir === null) return;
    tmpDir = bundleDir;

    // 3. Compose blueprint.
    const composed = await loadComposedFor(deps, bundleDir);
    if (!composed.ok) {
      await finalize(deps, deploymentId, orgId, 'failed', {
        errorCode: 'DEPLOY_EXECUTOR_BLUEPRINT_REVALIDATION_FAILED',
        errorMessage: redact(errorSummary(composed.errors)),
      });
      return;
    }

    // 4. Resolve target and decrypt target secrets.
    const target = await resolveTarget(deps, orgId, ctx.targetId);
    const orgSlug = await deps.orgSlugFor(orgId);
    const targetSecretsRepo = await deps.targetSecretsRepoFor(orgId);
    const decryptedExtras = await targetSecretsRepo.getAllDecrypted(target.id);
    const apiToken = String(decryptedExtras['apiToken'] ?? '');

    // 5. Prior provision outputs for var resolution.
    const priorOutputs = await deps.lastSuccessfulProvisionOutputs(deploymentId);

    // 6. Delegate to the orchestrator with hooks that persist via repos.
    const inputs: RunDeploymentInputs = {
      composedBlueprint: composed.value,
      bundleDir,
      target: normalizeDeployTarget(target),
      resolvedTargetSecrets: { apiToken, extras: decryptedExtras },
      orgSlug,
      configOverrides: ctx.configOverrides,
      priorProvisionOutputs: priorOutputs,
      resolveProvisioner: deps.resolveProvisioner,
      ...(deps.publicDeployDomain === undefined ? {} : { publicDeployDomain: deps.publicDeployDomain }),
      hooks: {
        onLog: (line) => appendLog(deps, deploymentId, orgId, line.level, line.step, line.message),
        onProvisionResult: async (envelope) => {
          await persistProvisionResultViaRepos(deps, deploymentId, orgId, envelope);
        },
        onApplyResult: async (envelope) => {
          await persistApplyResultViaRepos(deps, deploymentId, orgId, envelope);
        },
        onVerifyResult: async (envelope) => {
          await persistVerifyResultViaRepos(deps, deploymentId, orgId, envelope);
        },
        onTerminal: async (result) => {
          if (result.ok) {
            await finalize(deps, deploymentId, orgId, 'succeeded', {});
          } else {
            await finalize(deps, deploymentId, orgId, 'failed', {
              errorCode: result.errorCode,
              errorMessage: result.errorMessage,
              errorTree: result.errorTree,
            });
          }
        },
      },
    };

    await orchestrate(inputs);
  } finally {
    clearInterval(heartbeat);
    if (tmpDir !== null) {
      await rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}
```

- [ ] **Step 3: Implement the per-hook persistence helpers**

Add to `executor.ts` (or move to a new `executor-persistence.ts` if file size becomes unwieldy):

```ts
async function persistProvisionResultViaRepos(
  deps: ExecutorDeps,
  deploymentId: string,
  orgId: string,
  envelope: ProvisionResultEnvelope,
): Promise<void> {
  // 1. Build DeploymentProvisionResult JSON for the public part.
  const persistence: DeploymentProvisionResult = {
    modules: Object.fromEntries(
      Object.entries(envelope.publicByModule).map(([k, publicOutputs]) => [
        k,
        { publicOutputs, provisionedAt: envelope.finishedAt },
      ]),
    ),
    startedAt: envelope.startedAt,
    finishedAt: envelope.finishedAt,
  };
  // 2. Encrypt the secret envelope, if any.
  const secretEnvelope = {
    modules: Object.fromEntries(
      Object.entries(envelope.secretByModule).map(([k, secretOutputs]) => [
        k,
        { secretOutputs, provisionedAt: envelope.finishedAt },
      ]),
    ),
  };
  const enc: EncryptedSecret | null =
    Object.keys(secretEnvelope.modules).length > 0
      ? deps.secretCipher.encrypt(JSON.stringify(secretEnvelope))
      : null;
  // 3. Persist via repos.
  await deps.withOrgTx(orgId, async (repos) => {
    await repos.deployments.persistProvisionResult(deploymentId, persistence);
    if (enc) {
      await repos.deployments.persistProvisionSecretCiphertext(deploymentId, enc);
    }
  });
}

async function persistApplyResultViaRepos(/* ... */) { /* analogous */ }
async function persistVerifyResultViaRepos(/* ... */) { /* analogous */ }
```

The original executor already does each of these; you are extracting them into named helpers, not inventing new persistence calls. If a repo method is missing for one of these, find the inline call in the original executor and use that exact path.

- [ ] **Step 4: Remove all dead code paths from `executor.ts`**

Delete from `executor.ts` everything that the orchestrator now owns:

- the body inside the original `runDeployment` between context resolution and `finalize`, except the new helpers above;
- `defaultLoadComposed`, `toDeployCoreInput`, `collectProvisionerModules`, `redactTarget`, `errorSummary`, `isComposedBlueprint`, the `IDENTITY_INTROSPECTION_PROTO` constant, the `runStage` import, etc., **only if** the orchestrator now imports its own copies. If any of these helpers is genuinely shared (e.g., used by `project-delete-executor.ts`), keep it where it is.

After this step, executor.ts should be substantially smaller (target: under ~400 lines).

- [ ] **Step 5: Run the executor unit tests + the wider platform-http test suite**

```bash
SKIP_TESTCONTAINERS=1 bun run --filter @rntme/platform-http test
bun run --filter @rntme/platform-http typecheck
```

Expected: PASS. The legacy `apps/platform-http/test/unit/deploy/executor.test.ts` should still pass — it was written against the public `runDeployment(deploymentId, orgId, deps)` signature, which is unchanged.

- [ ] **Step 6: If any test fails, fix the wiring (do NOT change the test) and re-run**

Common failure modes and their fixes:

- **Hook not invoked in the order the test expects.** Re-check the orchestrator stage order; the contract is `plan → provision → render → apply → verify`.
- **Persistence helper missing a field that the legacy code wrote.** Compare the legacy persistence call site with the new helper; copy the missing field into the envelope or into the persistence helper.
- **Error code mismatch.** The error codes are part of the contract; the orchestrator must emit the same codes as the legacy executor (`DEPLOY_EXECUTOR_BLUEPRINT_REVALIDATION_FAILED`, `DEPLOY_PROVISION_*`, `DEPLOY_APPLY_*`, `DEPLOY_VERIFY_*`, etc.).

- [ ] **Step 7: Commit**

```bash
git add apps/platform-http/src/deploy/executor.ts
git commit -m "refactor(platform-http): delegate deploy orchestration to @rntme/deploy-runner"
```

---

### Task 11: Delete pure re-export files in `apps/platform-http/src/deploy/`

The spec requires deleting the moved files once the executor wrapper passes. Files that became pure one-line re-exports (`log-redactor`, `stage-runner`, `smoke-verifier`, `dokploy-client-factory`) are ready to go. Files that still hold a small platform-http-specific adapter (`build-deploy-config`, `run-teardowns`) remain — their adapter exists precisely because platform-core's `DeployTarget` and DB repos do not belong in the runner. They go away in the final platform-http removal plan.

**Files:**
- Delete: `apps/platform-http/src/deploy/log-redactor.ts`
- Delete: `apps/platform-http/src/deploy/stage-runner.ts`
- Delete: `apps/platform-http/src/deploy/smoke-verifier.ts`
- Delete: `apps/platform-http/src/deploy/dokploy-client-factory.ts`
- Modify: every callsite in `apps/platform-http/` that imports from those four files; switch the import to `@rntme/deploy-runner`.

- [ ] **Step 1: List all callsites of the four files**

Run from repo root:

```bash
grep -RIn "from '\./log-redactor\.js'\|from '\./stage-runner\.js'\|from '\./smoke-verifier\.js'\|from '\./dokploy-client-factory\.js'\|from '\.\./deploy/log-redactor\.js'\|from '\.\./deploy/stage-runner\.js'\|from '\.\./deploy/smoke-verifier\.js'\|from '\.\./deploy/dokploy-client-factory\.js'\|from '\.\.\/\.\.\/deploy/log-redactor\.js'\|from '\.\.\/\.\.\/deploy/stage-runner\.js'\|from '\.\.\/\.\.\/deploy/smoke-verifier\.js'\|from '\.\.\/\.\.\/deploy/dokploy-client-factory\.js'" apps/platform-http
```

Save the list. Each callsite is a single import-line edit.

- [ ] **Step 2: Rewrite each callsite to import from `@rntme/deploy-runner`**

For every file in the list, replace the local-path import with the workspace import. Examples:

```diff
- import { redact } from './log-redactor.js';
+ import { redact } from '@rntme/deploy-runner';
```

```diff
- import { SmokeVerifier } from '../deploy/smoke-verifier.js';
+ import { SmokeVerifier } from '@rntme/deploy-runner';
```

Apply to the whole list. Do not change any other code on those lines.

- [ ] **Step 3: Delete the four re-export files**

```bash
git rm apps/platform-http/src/deploy/log-redactor.ts \
       apps/platform-http/src/deploy/stage-runner.ts \
       apps/platform-http/src/deploy/smoke-verifier.ts \
       apps/platform-http/src/deploy/dokploy-client-factory.ts
```

- [ ] **Step 4: Run the platform-http typecheck and tests**

```bash
bun run --filter @rntme/platform-http typecheck
SKIP_TESTCONTAINERS=1 bun run --filter @rntme/platform-http test
```

Expected: PASS. Any failure here means a callsite was missed in Step 2 — re-grep, fix, re-run.

- [ ] **Step 5: Run lint**

```bash
bun run --filter @rntme/platform-http lint
```

Expected: PASS. Lint may flag unused-import or duplicate-import warnings caused by the rewrites; clean them up.

- [ ] **Step 6: Commit**

```bash
git add apps/platform-http/
git commit -m "chore(platform-http): remove deploy re-export files; import directly from @rntme/deploy-runner"
```

---

### Task 12: Verify the full repo is green

**Files:** none modified.

- [ ] **Step 1: Run typecheck across the workspace**

```bash
bun run typecheck
```

Expected: PASS.

- [ ] **Step 2: Run tests across the workspace**

```bash
SKIP_TESTCONTAINERS=1 bun run test
```

Expected: PASS.

- [ ] **Step 3: Run lint**

```bash
bun run lint
```

Expected: PASS. Fix any lint issues introduced by the move (typically: unused imports in the old files now that they are re-exports).

- [ ] **Step 4: Run depcruise**

```bash
bun run depcruise
```

Expected: PASS. If it complains about a layering violation (e.g., `apps/platform-http` importing from a forbidden direction), revisit the import direction. The expected legal direction is `apps/platform-http → @rntme/deploy-runner → @rntme/deploy-{core,dokploy} → @rntme/blueprint`.

- [ ] **Step 5: Run vendor:check**

```bash
bun run vendor:check
```

Expected: PASS.

---

### Task 13: Documentation

**Files:**
- Create: `docs/current/owners/packages/deploy/deploy-runner.md`
- Modify: `docs/current/owners/apps/platform-http.md`
- Modify: `AGENTS.md`

- [ ] **Step 1: Write the deploy-runner owner doc**

Create `docs/current/owners/packages/deploy/deploy-runner.md`:

```markdown
# @rntme/deploy-runner

Pure deploy orchestrator library used by both the platform `deployments`
service and the rntme CLI direct-mode (planned).

## Role in the system

- Consumes a composed blueprint, a normalized deploy target, and resolved
  target secrets.
- Runs `plan → provision → render → apply → verify`.
- Emits side-effect-bearing events (logs, stage results, terminal status)
  through hooks. The caller persists what it wants.
- Owns no HTTP, DB, BPMN, Operaton, filesystem state, or platform-specific
  types.

## Public API

- `runDeployment(inputs: RunDeploymentInputs): Promise<TerminalResult>`
- `deployErrorsToPlatformError(errors, stage)` — error tree formatter.
- Utilities: `redact`, `runStage`, `SmokeVerifier`, `defaultSmokeFetcher`,
  `createDokployClientFactory`, `normalizeDokployBaseUrl`,
  `buildProjectDeploymentConfig`, `buildDokployTargetConfig`,
  `derivePublicBaseUrl`, `runTearDownsForDeployment`.
- Types: `NormalizedDeployTarget`, `ResolvedTargetSecrets`, `DeploymentHooks`,
  `RunDeploymentInputs`, `TerminalResult`, `StageName`, `StageEvidence`,
  `SanitizedLogLine`, `SecretCipher`.

## Hooks

- `onLog(line)` — every sanitized log line.
- `onStageBegin(stage)` and `onStageComplete(stage, evidence)` — life cycle.
- `onProvisionResult(envelope)` — public + secret outputs per module. The
  caller is responsible for encrypting `secretByModule`.
- `onApplyResult(envelope)` — apply actions and duration.
- `onVerifyResult(envelope)` — smoke verification report.
- `onTerminal(result)` — exactly one terminal callback per `runDeployment`
  invocation.

## Invariants

- The runner never reads secrets from disk and never writes them to disk.
- The runner never opens a database connection.
- The runner never imports `@rntme/platform-core` or any HTTP framework.

## Known consumers

- `apps/platform-http/src/deploy/executor.ts` — production caller (DB-bound).
- `apps/cli/...` — planned CLI direct-mode caller (separate plan).
- `apps/platform/blueprint/services/deployments/workflows/handlers/` —
  planned BPMN task handlers (separate plan).

## Where to look first

- `packages/deploy/deploy-runner/src/types.ts`
- `packages/deploy/deploy-runner/src/run-deployment.ts`

## Specs

- [`docs/superpowers/specs/2026-05-10-cli-universal-deploy-and-platform-http-removal-design.md`](/docs/superpowers/specs/2026-05-10-cli-universal-deploy-and-platform-http-removal-design.md)
```

- [ ] **Step 2: Update `docs/current/owners/apps/platform-http.md`**

Add (or replace) a section near the top:

```markdown
## Deploy orchestration

Deploy orchestration logic now lives in `@rntme/deploy-runner`
(`packages/deploy/deploy-runner`). The platform-http `executor.ts` is a
thin DB-bound wrapper that:

1. Resolves the deployment context, project version, and target from repos.
2. Fetches and materializes the project-version bundle from blob storage.
3. Decrypts target secrets.
4. Calls `runDeployment` from `@rntme/deploy-runner` with hooks that persist
   logs, provision/apply/verify results, and the terminal status via repos.
5. Owns the heartbeat loop and bundle-directory cleanup.

No deploy stage logic lives in `apps/platform-http/src/deploy/` other than
the wrapper and small re-exports kept for backwards compatibility during the
migration. These re-exports are removed in the eventual platform-http removal
plan.
```

- [ ] **Step 3: Update `AGENTS.md` Packages lookup table**

Add a row:

```
| @rntme/deploy-runner | packages/deploy/deploy-runner | Pure deploy orchestrator (no HTTP/DB/BPMN). |
```

(Use the table style already present in `AGENTS.md`.)

- [ ] **Step 4: Commit**

```bash
git add docs/current/owners/packages/deploy/deploy-runner.md \
        docs/current/owners/apps/platform-http.md \
        AGENTS.md
git commit -m "docs(deploy-runner): document new package and update platform-http owner doc"
```

---

### Task 14: Final integration + commit

**Files:** none modified.

- [ ] **Step 1: Run the full repo verification one last time**

```bash
bun run typecheck
SKIP_TESTCONTAINERS=1 bun run test
bun run lint
bun run depcruise
bun run vendor:check
```

Expected: all green.

- [ ] **Step 2: If a Dokploy testcontainer is available locally, run the e2e deploy flow**

```bash
bun test apps/platform-http/test/e2e/deploy-flow.test.ts
```

Expected: PASS. If testcontainers cannot run in the target environment (no Docker), document that this verification is deferred to CI; the unit and integration tests in Step 1 give sufficient confidence that behavior is preserved.

- [ ] **Step 3: Confirm no dead code in platform-http/src/deploy/**

```bash
grep -RIn "from '@rntme/platform-core'" apps/platform-http/src/deploy/
```

Most imports remaining should be on the executor's persistence helpers and on the `DeployTarget`-to-`NormalizedDeployTarget` adapter — both legitimate.

- [ ] **Step 4: Final commit if any unintentional churn remains**

If steps 1-3 produced any incidental fixups (lockfile updates, prettier formatting), stage and commit:

```bash
git status
git add <files>
git commit -m "chore(deploy-runner): post-extraction cleanup"
```

---

## Self-Review Checklist

Run this at the end of execution, not after writing the plan:

- [ ] `apps/platform-http/src/deploy/executor.ts` no longer contains stage logic; only DB-bound glue and persistence helpers.
- [ ] `packages/deploy/deploy-runner/src/run-deployment.ts` exists and has a single exported `runDeployment` matching the public `RunDeploymentInputs → TerminalResult` signature.
- [ ] `@rntme/deploy-runner` has no dependency on `@rntme/platform-core`, `pg`, `pino`, `hono`, or `@hono/node-server`.
- [ ] All previously-existing platform-http unit tests in `test/unit/deploy/` still pass.
- [ ] The deploy executor invokes hooks in the order `plan → provision → render → apply → verify` and emits exactly one `onTerminal` per call.
- [ ] `apps/platform-http/src/deploy/log-redactor.ts`, `stage-runner.ts`, `smoke-verifier.ts`, `dokploy-client-factory.ts` are deleted; all callers in `apps/platform-http/` import the same names from `@rntme/deploy-runner`.
- [ ] `apps/platform-http/src/deploy/build-deploy-config.ts` and `run-teardowns.ts` remain only because they expose the platform-http-specific adapter (`normalizeDeployTarget`, repo-bound `runTearDownsForDeployment`); both files are now under ~50 lines.
- [ ] No file under `apps/platform-http/src/deploy/` exceeds 400 lines after the refactor.
- [ ] `bun run depcruise` shows no new layering violations.

## Risks And Mitigations

- **Behavior drift on persistence shape.** The hook envelopes are new; if any envelope omits a field that the legacy executor wrote, the deployment record loses data. Mitigation: persistence helpers (Step 3 of Task 10) are direct lift-and-rename of the legacy DB calls; do not invent new shapes.
- **Encrypted-secret round-trip.** Encryption moves from runner-internal to caller-side hook. Mitigation: run the existing executor.test.ts assertions that round-trip through the cipher — they catch any divergence.
- **Provisioner package resolution path.** `resolveProvisioner` is passed in as a function; today it imports module packages from `apps/platform-http/node_modules`. The runner does not change that behavior — it just calls the function. Mitigation: re-use `buildResolveProvisioner()` in the platform-http caller exactly as today.
- **`tmpDir` lifecycle.** The runner no longer cleans up the bundle directory; the caller does. The platform-http executor finally-clause must do the cleanup. Mitigation: the executor body in Task 10 step 2 explicitly handles this.
- **Cycle import via `build-deploy-config` adapter.** The Task 7 adapter imports both from `@rntme/deploy-runner` and from `@rntme/platform-core`. There is no cycle (deploy-runner does not import platform-core), but lint/depcruise might flag it. Mitigation: the adapter lives in `apps/platform-http/src/deploy/build-deploy-config.ts` (a leaf) and the layering rules already permit `apps/* → @rntme/*`.

## Out Of Scope (do NOT do here)

- Decompose `runDeployment` into per-stage exported functions (`stages.render`, `stages.apply`, …). That is a Plan 3 concern (BPMN handlers).
- Remove `apps/platform-http` itself, or its deploy adapter files (`build-deploy-config.ts`, `run-teardowns.ts`) that still hold the platform-core ↔ runner adapter. Those go in the eventual platform-http removal plan.
- Add CLI commands. Plan 2.
- Move HTTP middleware into runtime. Plan 4.
- Move bearer-token validation. Plan 5.
- Add Operaton to the platform stack. Plan 3.
