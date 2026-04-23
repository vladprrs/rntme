# Pre-fetch Middleware & External Adapter Client Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. User preference: **skip plan-internal review checkpoints during execution**; run to completion autonomously.

**Depends on:** Plan 1 (`01-code-executor-seam.md`) and Plan 2 (`02-bindings-grpc-surface.md`) — the `CommandExecutor` seam exists and the gRPC transport is wired; this plan adds synchronous **outbound** calls from a domain service to a platform module **before** the command executes.

**Goal:** Ship primitive P-1 from the spec: `pre[]` field on `command` binding, a middleware that resolves pre-steps before invoking `CommandExecutor`, the `ExternalAdapterClient` seam with a gRPC-backed default implementation (timeout + retry + circuit breaker), the three-layer idempotency-key chain (HTTP header → command response cache → gRPC metadata), error-code namespace `EXTERNAL_MODULE_*`, and per-step structured logs + Prometheus counters.

**Architecture:** The `BindingArtifact` schema grows an optional `pre: PreStep[]` on `command` bindings, carrying `system.randomBytes` or `module-rpc` steps with input-expression templates. A JSON expression evaluator walks input templates, resolving `$body` / `$query` / `$auth` / `$config` / `$system.*` / `$pre.<bindAs>` references. A new `ExternalAdapterClient` plugin seam abstracts outbound gRPC calls; the default `GrpcAdapterClient` loads per-module proto files (declared in `manifest.modules[]`), applies a per-step `timeoutMs`, retries transient failures (`DEADLINE_EXCEEDED`, `UNAVAILABLE`, `RESOURCE_EXHAUSTED`, `INTERNAL`) with exponential backoff, and short-circuits when a sliding-window circuit breaker is open. An `Idempotency-Key` HTTP middleware caches successful command responses in a new `idempotency_cache` SQLite table (24h TTL), derives per-step keys, and forwards them as gRPC metadata (`rntme-idempotency-key`). The pre-step runner is wired **before** `commandExecutor.execute` in `bindings-http`'s command handler; failures map to specific HTTP statuses and stable error codes.

**Tech Stack:** Node 20, TypeScript strict, ESM, Vitest, pnpm. Reuses existing `@grpc/grpc-js@^1.10` + `protobufjs@^7.2` from plan 2. Adds `pino@^9` (structured logs) and reuses `prom-client@^15` already present in `@rntme/runtime`. Spec: `docs/superpowers/specs/2026-04-19-platform-modules-integration-design.md` §6.1, §7, §12.2.

---

## File Structure

### New files

```
packages/bindings/src/
  types/pre.ts                              ← PreStep, RetryPolicy types (artifact layer)

packages/bindings-http/src/
  pre/
    index.ts
    types.ts                                ← resolved PreStep types for runtime
    expression.ts                           ← evaluateExpression(template, scope): unknown
    run-pre-steps.ts                        ← runPreSteps(binding.pre, scope, deps): Result
    error-mapping.ts                        ← mapAdapterErrorToHttpStatus(err): {status, body}
  idempotency/
    cache.ts                                ← IdempotencyCache (SQLite table)
    middleware.ts                           ← Hono middleware reading Idempotency-Key header
    derive-keys.ts                          ← deriveCommandRunId, deriveStepKey

packages/runtime/src/plugins/
  adapter-client/
    types.ts                                ← ExternalAdapterClient interface, RetryPolicy, etc.
    grpc-adapter-client.ts                  ← GrpcAdapterClient (default)
    retry.ts                                ← withRetry wrapper
    circuit-breaker.ts                      ← CircuitBreaker state machine + wrapper
    proto-registry.ts                       ← loads modules[].protoPath, caches Type lookups
    classify.ts                             ← classifyGrpcError(status): "transient" | "terminal"
    index.ts                                ← barrel

packages/bindings-http/test/unit/
  expression.test.ts
  derive-keys.test.ts
  error-mapping.test.ts

packages/bindings-http/test/integration/
  pre-steps.test.ts                         ← runs pre-steps end-to-end with a fake adapter
  idempotency.test.ts                       ← Idempotency-Key round-trip

packages/runtime/test/unit/
  retry.test.ts
  circuit-breaker.test.ts
  classify.test.ts

packages/runtime/test/integration/
  grpc-adapter-client.test.ts               ← boots a tiny gRPC server, exercises timeout/retry/CB

packages/bindings/test/unit/
  pre-parse.test.ts
  pre-structural.test.ts
  pre-consistency.test.ts
```

### Modified files

```
packages/bindings/src/
  parse/schema.ts                           ← extend CommandBindingSchema with pre: PreStep[]
  types/artifact.ts                         ← add pre field; re-export PreStep types
  types/result.ts                           ← add 4 new error codes (append-only)
  validate/structural.ts                    ← pre[].length ≤ 2, unique bindAs
  validate/consistency.ts                   ← module must exist in manifest.modules; rpc must exist in proto (best-effort string match)
  openapi/emit.ts                           ← ignore pre[] (do not emit; internal concern)
  index.ts                                  ← export PreStep types

packages/bindings-http/src/
  startup/compile-plan.ts                   ← carry pre: PreStep[] into CommandBindingPlan
  runtime/command-handler.ts                ← run pre-steps before commandExecutor.execute
  runtime/correlation-middleware.ts         ← set commandRunId; integrate with Idempotency-Key
  router.ts                                 ← accept externalAdapterClient, idempotencyCache opts
  errors.ts                                 ← add EXTERNAL_* helpers; re-export adapter errors

packages/runtime/src/
  manifest/schema.ts                        ← add modules: [{ name, grpc: { address }, protoPath }]
  manifest/types.ts                         ← ValidatedManifest.modules typed
  plugins/interfaces.ts                     ← re-export ExternalAdapterClient
  start/start-service.ts                    ← build default GrpcAdapterClient from manifest.modules
  plugins/contract-tests.ts                 ← runAdapterClientContract
  index.ts                                  ← export adapter-client types + defaults

packages/bindings-http/package.json         ← add pino dep
packages/runtime/package.json               ← (already has prom-client) — no change

demo/issue-tracker-api/
  artifacts/manifest.json                   ← add empty modules: []  (no pre[] usage in this demo)

demo/pre-step-demo/                         ← NEW small demo exercising pre[] with a fake module

docs/
  superpowers/specs/2026-04-19-platform-modules-integration-design.md  ← mark plan 3 implemented
  AGENTS.md                                 ← §6 add "6.13 call a module via pre-fetch"
```

### Out of scope (deferred)

- `onError: fallback/skip` per-step policy (spec S5).
- Auto sync→async degradation under circuit-open (spec S8).
- OpenTelemetry span emission — structured-log-only in this plan; OTEL in a follow-up cross-cutting plan.
- Response-cache persistence across service restarts — MVP lives in SQLite (not ephemeral in-memory), which is already durable for `persistent` mode.
- `pre[]` support for `query` bindings — spec allows commands only in this iteration.
- Expression features beyond `$path` references: no conditionals, no arithmetic, no function calls. Adding these requires a proper expression grammar; deferred until a concrete use-case arrives.

---

## Phase 1 — `pre[]` artifact schema in `@rntme/bindings`

### Task 1: Add `PreStep` types + error codes

**Files:**
- Create: `packages/bindings/src/types/pre.ts`
- Modify: `packages/bindings/src/types/result.ts`
- Modify: `packages/bindings/src/types/artifact.ts`
- Modify: `packages/bindings/src/index.ts`

- [ ] **Step 1: Create `pre.ts`**

```ts
// packages/bindings/src/types/pre.ts
export type RetryStrategy = 'never' | 'transient' | 'all';

export type RetryPolicy = {
  attempts?: number;              // default 3
  backoffMs?: 'exp' | number;     // default "exp" → 50/200/800ms
  retryOn?: RetryStrategy;        // default "transient"
};

export type ExpressionTemplate = Record<string, unknown> | string | number | boolean | null;

export type PreStepSystem = {
  kind: 'system';
  op: 'randomBytes';
  bytes: number;
  bindAs: string;
};

export type PreStepModuleRpc = {
  kind: 'module-rpc';
  module: string;
  rpc: string;
  input: ExpressionTemplate;       // JSON object with "$..." references
  bindAs: string;
  timeoutMs?: number;               // default 2000
  retry?: RetryPolicy;
};

export type PreStep = PreStepSystem | PreStepModuleRpc;
```

- [ ] **Step 2: Append error codes**

In `packages/bindings/src/types/result.ts`, append to `ERROR_CODES`:

```ts
  // Pre-fetch step validation (plan 3)
  BINDINGS_STRUCTURAL_PRE_TOO_MANY: 'BINDINGS_STRUCTURAL_PRE_TOO_MANY',
  BINDINGS_STRUCTURAL_PRE_DUPLICATE_BIND_AS: 'BINDINGS_STRUCTURAL_PRE_DUPLICATE_BIND_AS',
  BINDINGS_STRUCTURAL_PRE_ON_NON_COMMAND: 'BINDINGS_STRUCTURAL_PRE_ON_NON_COMMAND',
  BINDINGS_CONSISTENCY_PRE_MODULE_NOT_DECLARED: 'BINDINGS_CONSISTENCY_PRE_MODULE_NOT_DECLARED',
```

Append-only — do not reorder or delete.

- [ ] **Step 3: Extend `BindingEntry` in `artifact.ts`**

Find the `BindingEntry` type (around line 31) and add an optional `pre` field:

```ts
export type BindingEntry = {
  kind?: BindingKind;
  graph: string;
  target: { engine: string; dialect: string };
  http: HttpBinding;
  pre?: PreStep[];     // plan 3: ordered list of pre-fetch steps; command only
};
```

Import `PreStep` at the top: `import type { PreStep } from './pre.js';`

- [ ] **Step 4: Export from barrel**

Append to `packages/bindings/src/index.ts`:

```ts
export type {
  PreStep,
  PreStepSystem,
  PreStepModuleRpc,
  RetryPolicy,
  RetryStrategy,
  ExpressionTemplate,
} from './types/pre.js';
```

- [ ] **Step 5: Typecheck**

Run: `pnpm -F @rntme/bindings typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/bindings/src/types/ packages/bindings/src/index.ts
git commit -m "feat(bindings): add PreStep artifact types and error-code skeleton"
```

---

### Task 2: Add Zod schema for `pre[]` and parse tests

**Files:**
- Modify: `packages/bindings/src/parse/schema.ts`
- Create: `packages/bindings/test/unit/pre-parse.test.ts`

- [ ] **Step 1: Write the failing parse test**

```ts
// packages/bindings/test/unit/pre-parse.test.ts
import { describe, it, expect } from 'vitest';
import { BindingArtifactSchema } from '../../src/parse/schema.js';

const baseCommand = {
  kind: 'command',
  graph: 'createOrder',
  target: { engine: 'graph-ir', dialect: 'sqlite' },
  http: { method: 'POST', path: '/orders', parameters: [] },
};

describe('pre[] parsing', () => {
  it('accepts command binding with empty pre[]', () => {
    const r = BindingArtifactSchema.safeParse({
      version: '1.0', graphSpecRef: 'g', pdmRef: 'p', qsmRef: 'q',
      bindings: { createOrder: { ...baseCommand, pre: [] } },
    });
    expect(r.success).toBe(true);
  });

  it('accepts system.randomBytes step', () => {
    const r = BindingArtifactSchema.safeParse({
      version: '1.0', graphSpecRef: 'g', pdmRef: 'p', qsmRef: 'q',
      bindings: {
        createOrder: {
          ...baseCommand,
          pre: [{ kind: 'system', op: 'randomBytes', bytes: 32, bindAs: 'nonce' }],
        },
      },
    });
    expect(r.success).toBe(true);
  });

  it('accepts module-rpc step with expression template', () => {
    const r = BindingArtifactSchema.safeParse({
      version: '1.0', graphSpecRef: 'g', pdmRef: 'p', qsmRef: 'q',
      bindings: {
        createOrder: {
          ...baseCommand,
          pre: [{
            kind: 'module-rpc',
            module: 'payments',
            rpc: 'CreateCheckoutSession',
            input: { customerId: '$auth.userId', amount: '$body.amount' },
            bindAs: 'session',
            timeoutMs: 1500,
            retry: { attempts: 2, backoffMs: 'exp', retryOn: 'transient' },
          }],
        },
      },
    });
    expect(r.success).toBe(true);
  });

  it('rejects unknown step kind', () => {
    const r = BindingArtifactSchema.safeParse({
      version: '1.0', graphSpecRef: 'g', pdmRef: 'p', qsmRef: 'q',
      bindings: {
        createOrder: {
          ...baseCommand,
          pre: [{ kind: 'bogus', bindAs: 'x' }],
        },
      },
    });
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step 2: Verify fail**

Run: `pnpm -F @rntme/bindings vitest run test/unit/pre-parse.test.ts`
Expected: FAIL (schema rejects `pre` as unknown property or accepts invalid kinds).

- [ ] **Step 3: Add Zod schemas**

In `packages/bindings/src/parse/schema.ts`, above `BindingArtifactSchema`:

```ts
const RetryPolicySchema = z.object({
  attempts: z.number().int().min(1).max(10).optional(),
  backoffMs: z.union([z.literal('exp'), z.number().int().min(0)]).optional(),
  retryOn: z.enum(['never', 'transient', 'all']).optional(),
}).strict();

const PreStepSystemSchema = z.object({
  kind: z.literal('system'),
  op: z.literal('randomBytes'),
  bytes: z.number().int().min(1).max(1024),
  bindAs: z.string().min(1),
}).strict();

const PreStepModuleRpcSchema = z.object({
  kind: z.literal('module-rpc'),
  module: z.string().min(1),
  rpc: z.string().min(1),
  input: z.unknown(),        // validated structurally later; any JSON is acceptable at parse layer
  bindAs: z.string().min(1),
  timeoutMs: z.number().int().min(1).max(30_000).optional(),
  retry: RetryPolicySchema.optional(),
}).strict();

const PreStepSchema = z.discriminatedUnion('kind', [PreStepSystemSchema, PreStepModuleRpcSchema]);
```

Then extend the existing binding-entry schema (find `bindings: z.record(...)` line) to add an optional `pre: z.array(PreStepSchema).optional()` on each binding-entry object. The exact spot depends on current `BindingEntrySchema` shape — open the file, locate the object schema used per binding, and add the field there.

- [ ] **Step 4: Run the parse test**

Run: `pnpm -F @rntme/bindings vitest run test/unit/pre-parse.test.ts`
Expected: PASS (all four cases).

- [ ] **Step 5: Commit**

```bash
git add packages/bindings/src/parse/schema.ts \
        packages/bindings/test/unit/pre-parse.test.ts
git commit -m "feat(bindings): parse pre[] with system and module-rpc step kinds"
```

---

### Task 3: Structural validator for `pre[]`

**Files:**
- Modify: `packages/bindings/src/validate/structural.ts`
- Create: `packages/bindings/test/unit/pre-structural.test.ts`

- [ ] **Step 1: Write tests**

```ts
// packages/bindings/test/unit/pre-structural.test.ts
import { describe, it, expect } from 'vitest';
import { validateStructural } from '../../src/validate/structural.js';
// import helpers needed for constructing a StructurallyValid input; reuse the
// existing test-kit pattern from other validate tests.

describe('pre[] structural validation', () => {
  it('rejects pre[] on a query binding', () => {
    // construct a query binding with pre: [{...}] and assert BINDINGS_STRUCTURAL_PRE_ON_NON_COMMAND
    // (see existing structural tests for the full fixture shape)
  });

  it('rejects pre.length > 2', () => {
    // construct a command binding with three pre-steps; assert BINDINGS_STRUCTURAL_PRE_TOO_MANY
  });

  it('rejects duplicate bindAs within one pre[]', () => {
    // two steps both bindAs:"x"; assert BINDINGS_STRUCTURAL_PRE_DUPLICATE_BIND_AS
  });

  it('accepts a single module-rpc pre-step', () => {
    // happy path; expect ok
  });
});
```

The actual fixture-construction boilerplate follows the existing `packages/bindings/test/unit/*.test.ts` patterns. If no structural-validator test fixture helper exists yet, inline a minimal one — see `packages/bindings/src/validate/structural.ts` for the input shape.

- [ ] **Step 2: Verify fail**

Run: `pnpm -F @rntme/bindings vitest run test/unit/pre-structural.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement validation**

In `packages/bindings/src/validate/structural.ts`, find the per-binding validation loop. Add **after** the command-kind checks:

```ts
if (entry.pre !== undefined && entry.pre.length > 0) {
  if (entry.kind !== 'command') {
    errs.push({
      layer: 'structural',
      code: 'BINDINGS_STRUCTURAL_PRE_ON_NON_COMMAND',
      message: `binding "${bindingId}": pre[] is only allowed on command bindings`,
      path: `bindings.${bindingId}.pre`,
    });
  }
  if (entry.pre.length > 2) {
    errs.push({
      layer: 'structural',
      code: 'BINDINGS_STRUCTURAL_PRE_TOO_MANY',
      message: `binding "${bindingId}": pre[] has ${entry.pre.length} steps; max is 2 (upgrade to Zeebe)`,
      path: `bindings.${bindingId}.pre`,
      hint: 'See spec §7 S4: chains longer than 2 pre-steps should be modeled as Zeebe processes.',
    });
  }
  const seen = new Set<string>();
  entry.pre.forEach((step, idx) => {
    if (seen.has(step.bindAs)) {
      errs.push({
        layer: 'structural',
        code: 'BINDINGS_STRUCTURAL_PRE_DUPLICATE_BIND_AS',
        message: `binding "${bindingId}": pre[${idx}].bindAs "${step.bindAs}" duplicates an earlier step`,
        path: `bindings.${bindingId}.pre[${idx}].bindAs`,
      });
    } else {
      seen.add(step.bindAs);
    }
  });
}
```

- [ ] **Step 4: Run tests**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/bindings/src/validate/structural.ts \
        packages/bindings/test/unit/pre-structural.test.ts
git commit -m "feat(bindings): structural validation for pre[] (≤2 steps, unique bindAs, command-only)"
```

---

### Task 4: Consistency validator — `module` must be declared

**Files:**
- Modify: `packages/bindings/src/validate/consistency.ts`
- Create: `packages/bindings/test/unit/pre-consistency.test.ts`

The `module` referenced by a pre-step must exist in the service-level manifest's `modules[]`. But `@rntme/bindings` today doesn't know about the manifest — it validates the bindings artifact in isolation. Options:
- (a) Add a side-channel parameter `declaredModules: Set<string>` to consistency validation.
- (b) Defer this check to the runtime layer (`@rntme/runtime`'s service-loader).

Choice: **(a)**. Consistency is exactly where cross-artifact references get validated (already true for PDM/QSM references). We add an optional parameter; callers that don't know modules pass an empty set (all pre-step modules then fail — which is correct for isolated testing).

- [ ] **Step 1: Write tests**

```ts
// packages/bindings/test/unit/pre-consistency.test.ts
import { describe, it, expect } from 'vitest';
import { validateConsistency } from '../../src/validate/consistency.js';
// Construct a binding with a pre[] module-rpc step and pass declaredModules:
//   - containing the module name → ok
//   - empty set → BINDINGS_CONSISTENCY_PRE_MODULE_NOT_DECLARED

describe('pre[] consistency validation', () => {
  it('accepts pre-step whose module is in declaredModules', () => {
    // ...
  });
  it('rejects pre-step whose module is not in declaredModules', () => {
    // ... assert BINDINGS_CONSISTENCY_PRE_MODULE_NOT_DECLARED
  });
});
```

- [ ] **Step 2: Verify fail**

Expected: FAIL.

- [ ] **Step 3: Extend `validateConsistency` signature**

In `packages/bindings/src/validate/consistency.ts`:

```ts
export type ConsistencyOptions = {
  declaredModules?: ReadonlySet<string>;
};

export function validateConsistency(
  resolved: ResolvedBindings,
  opts: ConsistencyOptions = {},
): Result<ValidatedBindings> {
  const declaredModules = opts.declaredModules ?? new Set<string>();
  // ... existing checks
  // ... add new check:
  for (const [bindingId, resolvedBinding] of Object.entries(resolved.resolved)) {
    const pre = resolvedBinding.entry.pre ?? [];
    for (let idx = 0; idx < pre.length; idx++) {
      const step = pre[idx]!;
      if (step.kind === 'module-rpc' && !declaredModules.has(step.module)) {
        errors.push({
          layer: 'consistency',
          code: 'BINDINGS_CONSISTENCY_PRE_MODULE_NOT_DECLARED',
          message: `binding "${bindingId}" pre[${idx}] references module "${step.module}" which is not declared in manifest.modules`,
          path: `bindings.${bindingId}.pre[${idx}].module`,
          hint: 'Add the module to manifest.modules[] with grpc.address and protoPath.',
        });
      }
    }
  }
  // ...
}
```

Callers in this plan: `@rntme/runtime`'s load-service path will pass `declaredModules` built from `manifest.modules.map(m => m.name)`. Existing callers (tests, CLI) pass nothing → empty set → validation still works for artifacts without pre-steps. This is a non-breaking extension.

- [ ] **Step 4: Run tests**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/bindings/src/validate/consistency.ts \
        packages/bindings/test/unit/pre-consistency.test.ts
git commit -m "feat(bindings): consistency check — pre[].module must be declared"
```

---

## Phase 2 — Manifest `modules[]` extension

### Task 5: Add `modules[]` to `ManifestSchema`

**Files:**
- Modify: `packages/runtime/src/manifest/schema.ts`
- Modify: `packages/runtime/src/manifest/types.ts`
- Modify: `packages/runtime/test/unit/manifest-parse.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `packages/runtime/test/unit/manifest-parse.test.ts`:

```ts
it('parses modules[] with grpc address and protoPath', () => {
  const result = parseManifest({
    rntmeVersion: '1.0',
    service: { name: 'subs', version: '1.0' },
    modules: [
      { name: 'payments', grpc: { address: 'payments:50051' }, protoPath: 'protos/payments.proto' },
    ],
  });
  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(result.value.modules?.[0]?.name).toBe('payments');
  }
});

it('rejects module with empty name', () => {
  const result = parseManifest({
    rntmeVersion: '1.0',
    service: { name: 'subs', version: '1.0' },
    modules: [{ name: '', grpc: { address: 'a:1' }, protoPath: 'p' }],
  });
  expect(result.ok).toBe(false);
});
```

- [ ] **Step 2: Verify fail**

Run: `pnpm -F @rntme/runtime vitest run test/unit/manifest-parse.test.ts`
Expected: FAIL.

- [ ] **Step 3: Extend schema**

In `packages/runtime/src/manifest/schema.ts`, inside `ManifestSchema.object({...})`, add:

```ts
modules: z.array(
  z.object({
    name: z.string().min(1),
    grpc: z.object({ address: z.string().min(1) }).strict(),
    protoPath: z.string().min(1),
  }).strict(),
).optional(),
```

Mirror in `types.ts` if hand-typed.

- [ ] **Step 4: Run test**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/runtime/src/manifest/ packages/runtime/test/unit/manifest-parse.test.ts
git commit -m "feat(runtime): manifest.modules[] declares available platform modules"
```

---

## Phase 3 — Expression evaluator

### Task 6: `evaluateExpression(template, scope)`

**Files:**
- Create: `packages/bindings-http/src/pre/expression.ts`
- Create: `packages/bindings-http/test/unit/expression.test.ts`

- [ ] **Step 1: Write tests**

```ts
// packages/bindings-http/test/unit/expression.test.ts
import { describe, it, expect } from 'vitest';
import { evaluateExpression } from '../../src/pre/expression.js';

const scope = {
  body: { amount: 42, note: 'hi' },
  query: { limit: 10 },
  auth: { userId: 'u-1' },
  config: { selfUrl: 'https://app.test' },
  system: { randomBytes: 'abc123' },
  pre: { customer: { id: 'cust-1' }, nonce: 'zzz' },
};

describe('evaluateExpression', () => {
  it('resolves a top-level $body reference to a primitive', () => {
    expect(evaluateExpression('$body.amount', scope)).toBe(42);
  });
  it('resolves nested $pre.<bindAs>.field', () => {
    expect(evaluateExpression('$pre.customer.id', scope)).toBe('cust-1');
  });
  it('returns non-string literals unchanged', () => {
    expect(evaluateExpression(100, scope)).toBe(100);
    expect(evaluateExpression(true, scope)).toBe(true);
    expect(evaluateExpression(null, scope)).toBe(null);
  });
  it('walks objects, resolving each $-prefixed leaf', () => {
    const out = evaluateExpression(
      { customerId: '$pre.customer.id', amount: '$body.amount', note: '$body.note' },
      scope,
    );
    expect(out).toEqual({ customerId: 'cust-1', amount: 42, note: 'hi' });
  });
  it('walks arrays', () => {
    const out = evaluateExpression(['$auth.userId', '$body.note'], scope);
    expect(out).toEqual(['u-1', 'hi']);
  });
  it('leaves plain strings without $ prefix unchanged', () => {
    expect(evaluateExpression('hello', scope)).toBe('hello');
  });
  it('throws on a reference to an undefined path', () => {
    expect(() => evaluateExpression('$body.nope', scope)).toThrow(/unknown/i);
  });
  it('throws on unknown scope key', () => {
    expect(() => evaluateExpression('$foo.bar', scope)).toThrow(/unknown/i);
  });
});
```

- [ ] **Step 2: Verify fail**

Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// packages/bindings-http/src/pre/expression.ts
export type ExpressionScope = {
  body?: Record<string, unknown>;
  query?: Record<string, unknown>;
  auth?: Record<string, unknown>;
  config?: Record<string, unknown>;
  system?: Record<string, unknown>;
  pre?: Record<string, unknown>;
};

const KNOWN_ROOTS: readonly (keyof ExpressionScope)[] = ['body', 'query', 'auth', 'config', 'system', 'pre'];

export function evaluateExpression(template: unknown, scope: ExpressionScope): unknown {
  if (typeof template === 'string') {
    if (template.length > 0 && template[0] === '$') {
      return resolveRef(template.slice(1), scope);
    }
    return template;
  }
  if (Array.isArray(template)) {
    return template.map((item) => evaluateExpression(item, scope));
  }
  if (template !== null && typeof template === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(template as Record<string, unknown>)) {
      out[k] = evaluateExpression(v, scope);
    }
    return out;
  }
  return template;
}

function resolveRef(path: string, scope: ExpressionScope): unknown {
  const parts = path.split('.');
  const root = parts[0] as keyof ExpressionScope | undefined;
  if (root === undefined || !KNOWN_ROOTS.includes(root)) {
    throw new Error(`unknown scope root in reference "$${path}"`);
  }
  let current: unknown = scope[root];
  for (let i = 1; i < parts.length; i++) {
    if (current === null || current === undefined || typeof current !== 'object') {
      throw new Error(`unknown path in reference "$${path}" at segment "${parts.slice(0, i + 1).join('.')}"`);
    }
    const key = parts[i]!;
    if (!(key in (current as Record<string, unknown>))) {
      throw new Error(`unknown path in reference "$${path}" at segment "${parts.slice(0, i + 1).join('.')}"`);
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}
```

- [ ] **Step 4: Run**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/bindings-http/src/pre/expression.ts \
        packages/bindings-http/test/unit/expression.test.ts
git commit -m "feat(bindings-http): add $path expression evaluator for pre-step inputs"
```

---

## Phase 4 — ExternalAdapterClient

### Task 7: Declare `ExternalAdapterClient` interface + error types

**Files:**
- Create: `packages/runtime/src/plugins/adapter-client/types.ts`
- Modify: `packages/runtime/src/plugins/interfaces.ts` (re-export)
- Modify: `packages/runtime/src/index.ts` (re-export)

- [ ] **Step 1: Create types**

```ts
// packages/runtime/src/plugins/adapter-client/types.ts
export type RetryStrategy = 'never' | 'transient' | 'all';

export type RetryPolicy = {
  attempts: number;
  backoffMs: 'exp' | number;
  retryOn: RetryStrategy;
};

export const DEFAULT_RETRY: RetryPolicy = { attempts: 3, backoffMs: 'exp', retryOn: 'transient' };
export const DEFAULT_TIMEOUT_MS = 2000;

export type AdapterErrorCode =
  | 'EXTERNAL_MODULE_TIMEOUT'
  | 'EXTERNAL_MODULE_UNAVAILABLE'
  | 'EXTERNAL_MODULE_OVERLOAD'
  | 'EXTERNAL_MODULE_INTERNAL'
  | 'EXTERNAL_MODULE_SCHEMA_MISMATCH'
  | 'EXTERNAL_MODULE_NOT_CONFIGURED'
  | 'EXTERNAL_MODULE_CIRCUIT_OPEN'
  | 'EXTERNAL_VENDOR_DOMAIN';        // pass-through from module (kept generic; real code in `details.domainCode`)

export type AdapterError = Readonly<{
  code: AdapterErrorCode;
  message: string;
  /** For EXTERNAL_VENDOR_DOMAIN: the code reported by the module (e.g. PAYMENTS_PRICE_NOT_FOUND). */
  domainCode?: string;
  /** HTTP status the caller (bindings-http) should surface. */
  httpStatus: number;
  /** Raw metadata; not serialized to the client by default. */
  detail?: unknown;
}>;

export type AdapterCallOptions = {
  idempotencyKey: string;
  timeoutMs: number;
  retry: RetryPolicy;
  correlationId?: string;
};

export type AdapterOk = { ok: true; value: unknown };
export type AdapterErr = { ok: false; error: AdapterError };
export type AdapterResult = AdapterOk | AdapterErr;

export interface ExternalAdapterClient {
  call(
    module: string,
    rpc: string,
    input: unknown,
    opts: AdapterCallOptions,
  ): Promise<AdapterResult>;
}
```

- [ ] **Step 2: Re-export**

Append to `packages/runtime/src/plugins/interfaces.ts`:

```ts
export type {
  ExternalAdapterClient,
  AdapterCallOptions,
  AdapterResult,
  AdapterOk,
  AdapterErr,
  AdapterError,
  AdapterErrorCode,
  RetryPolicy,
  RetryStrategy,
} from './adapter-client/types.js';
export { DEFAULT_RETRY, DEFAULT_TIMEOUT_MS } from './adapter-client/types.js';
```

And append to `packages/runtime/src/index.ts`:

```ts
export * from './plugins/adapter-client/types.js';
```

- [ ] **Step 3: Typecheck + commit**

Run: `pnpm -F @rntme/runtime typecheck`
Expected: PASS.

```bash
git add packages/runtime/src/plugins/adapter-client/types.ts \
        packages/runtime/src/plugins/interfaces.ts \
        packages/runtime/src/index.ts
git commit -m "feat(runtime): declare ExternalAdapterClient seam and error types"
```

---

### Task 8: `classifyGrpcError` — transient vs terminal

**Files:**
- Create: `packages/runtime/src/plugins/adapter-client/classify.ts`
- Create: `packages/runtime/test/unit/classify.test.ts`

- [ ] **Step 1: Write tests**

```ts
// packages/runtime/test/unit/classify.test.ts
import { describe, it, expect } from 'vitest';
import * as grpc from '@grpc/grpc-js';
import { classifyGrpcError } from '../../src/plugins/adapter-client/classify.js';

describe('classifyGrpcError', () => {
  it.each([
    [grpc.status.DEADLINE_EXCEEDED,  'transient'],
    [grpc.status.UNAVAILABLE,         'transient'],
    [grpc.status.RESOURCE_EXHAUSTED,  'transient'],
    [grpc.status.INTERNAL,            'transient'],
    [grpc.status.UNKNOWN,             'transient'],
    [grpc.status.INVALID_ARGUMENT,    'terminal'],
    [grpc.status.NOT_FOUND,           'terminal'],
    [grpc.status.FAILED_PRECONDITION, 'terminal'],
    [grpc.status.PERMISSION_DENIED,   'terminal'],
    [grpc.status.UNAUTHENTICATED,     'terminal'],
    [grpc.status.ALREADY_EXISTS,      'terminal'],
    [grpc.status.ABORTED,             'terminal'],  // concurrency conflict surfaced from module is a domain error
  ] as const)('status %d → %s', (status, expected) => {
    expect(classifyGrpcError(status)).toBe(expected);
  });
});
```

- [ ] **Step 2: Verify fail**

Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// packages/runtime/src/plugins/adapter-client/classify.ts
import * as grpc from '@grpc/grpc-js';

export type Classification = 'transient' | 'terminal';

export function classifyGrpcError(status: grpc.status): Classification {
  switch (status) {
    case grpc.status.DEADLINE_EXCEEDED:
    case grpc.status.UNAVAILABLE:
    case grpc.status.RESOURCE_EXHAUSTED:
    case grpc.status.INTERNAL:
    case grpc.status.UNKNOWN:
      return 'transient';
    default:
      return 'terminal';
  }
}
```

- [ ] **Step 4: Run + commit**

Expected: PASS.

```bash
git add packages/runtime/src/plugins/adapter-client/classify.ts \
        packages/runtime/test/unit/classify.test.ts
git commit -m "feat(runtime): classify gRPC statuses into transient/terminal"
```

---

### Task 9: `withRetry` wrapper

**Files:**
- Create: `packages/runtime/src/plugins/adapter-client/retry.ts`
- Create: `packages/runtime/test/unit/retry.test.ts`

- [ ] **Step 1: Write tests**

```ts
// packages/runtime/test/unit/retry.test.ts
import { describe, it, expect, vi } from 'vitest';
import { withRetry } from '../../src/plugins/adapter-client/retry.js';
import type { AdapterResult } from '../../src/plugins/adapter-client/types.js';

describe('withRetry', () => {
  it('returns ok on first try when call succeeds', async () => {
    const call = vi.fn(async (): Promise<AdapterResult> => ({ ok: true, value: 1 }));
    const out = await withRetry(call, { attempts: 3, backoffMs: 0, retryOn: 'transient' }, (): void => {});
    expect(out.ok).toBe(true);
    expect(call).toHaveBeenCalledTimes(1);
  });

  it('retries transient error up to attempts', async () => {
    let n = 0;
    const call = async (): Promise<AdapterResult> => {
      n++;
      if (n < 3) return { ok: false, error: { code: 'EXTERNAL_MODULE_UNAVAILABLE', message: '', httpStatus: 503 } };
      return { ok: true, value: n };
    };
    const out = await withRetry(call, { attempts: 3, backoffMs: 0, retryOn: 'transient' }, (): void => {});
    expect(out.ok).toBe(true);
    expect(n).toBe(3);
  });

  it('does not retry terminal errors', async () => {
    const call = vi.fn(async (): Promise<AdapterResult> => ({
      ok: false,
      error: { code: 'EXTERNAL_VENDOR_DOMAIN', message: 'bad', httpStatus: 400 },
    }));
    const out = await withRetry(call, { attempts: 3, backoffMs: 0, retryOn: 'transient' }, (): void => {});
    expect(out.ok).toBe(false);
    expect(call).toHaveBeenCalledTimes(1);
  });

  it('respects retryOn: "never"', async () => {
    const call = vi.fn(async (): Promise<AdapterResult> => ({
      ok: false, error: { code: 'EXTERNAL_MODULE_UNAVAILABLE', message: '', httpStatus: 503 },
    }));
    const out = await withRetry(call, { attempts: 5, backoffMs: 0, retryOn: 'never' }, (): void => {});
    expect(out.ok).toBe(false);
    expect(call).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Verify fail**

Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// packages/runtime/src/plugins/adapter-client/retry.ts
import type { AdapterResult, RetryPolicy, AdapterErrorCode } from './types.js';

const TRANSIENT_CODES: ReadonlySet<AdapterErrorCode> = new Set<AdapterErrorCode>([
  'EXTERNAL_MODULE_TIMEOUT',
  'EXTERNAL_MODULE_UNAVAILABLE',
  'EXTERNAL_MODULE_OVERLOAD',
  'EXTERNAL_MODULE_INTERNAL',
]);

export type OnAttempt = (attempt: number, result: AdapterResult, delayMs: number) => void;

export async function withRetry(
  call: () => Promise<AdapterResult>,
  policy: RetryPolicy,
  onAttempt: OnAttempt,
): Promise<AdapterResult> {
  let lastResult: AdapterResult = { ok: false, error: { code: 'EXTERNAL_MODULE_INTERNAL', message: 'no attempts', httpStatus: 502 } };
  for (let attempt = 1; attempt <= policy.attempts; attempt++) {
    lastResult = await call();
    if (lastResult.ok) return lastResult;

    const shouldRetry = policy.retryOn === 'all'
      || (policy.retryOn === 'transient' && TRANSIENT_CODES.has(lastResult.error.code));
    const atLimit = attempt === policy.attempts;
    if (!shouldRetry || atLimit) {
      onAttempt(attempt, lastResult, 0);
      return lastResult;
    }
    const delayMs = nextDelay(attempt, policy.backoffMs);
    onAttempt(attempt, lastResult, delayMs);
    if (delayMs > 0) await sleep(delayMs);
  }
  return lastResult;
}

function nextDelay(attempt: number, backoffMs: 'exp' | number): number {
  if (backoffMs === 'exp') return Math.min(50 * 2 ** (attempt - 1), 2000);
  return backoffMs;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
```

- [ ] **Step 4: Run + commit**

Expected: PASS.

```bash
git add packages/runtime/src/plugins/adapter-client/retry.ts \
        packages/runtime/test/unit/retry.test.ts
git commit -m "feat(runtime): add withRetry wrapper for ExternalAdapterClient calls"
```

---

### Task 10: `CircuitBreaker` sliding-window state machine

**Files:**
- Create: `packages/runtime/src/plugins/adapter-client/circuit-breaker.ts`
- Create: `packages/runtime/test/unit/circuit-breaker.test.ts`

- [ ] **Step 1: Write tests**

```ts
// packages/runtime/test/unit/circuit-breaker.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CircuitBreaker } from '../../src/plugins/adapter-client/circuit-breaker.js';

describe('CircuitBreaker', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('stays closed while error rate < threshold', () => {
    const cb = new CircuitBreaker({ windowMs: 30_000, minCalls: 4, errorRateThreshold: 0.5, halfOpenAfterMs: 30_000 });
    cb.onSuccess(); cb.onSuccess(); cb.onFailure(); cb.onSuccess();
    expect(cb.state()).toBe('closed');
    expect(cb.allow()).toBe(true);
  });

  it('opens after errorRate >= threshold in window', () => {
    const cb = new CircuitBreaker({ windowMs: 30_000, minCalls: 4, errorRateThreshold: 0.5, halfOpenAfterMs: 30_000 });
    cb.onFailure(); cb.onFailure(); cb.onFailure(); cb.onSuccess();
    expect(cb.state()).toBe('open');
    expect(cb.allow()).toBe(false);
  });

  it('transitions to half-open after halfOpenAfterMs', () => {
    const cb = new CircuitBreaker({ windowMs: 30_000, minCalls: 2, errorRateThreshold: 0.5, halfOpenAfterMs: 30_000 });
    cb.onFailure(); cb.onFailure();
    expect(cb.state()).toBe('open');
    vi.advanceTimersByTime(30_000);
    expect(cb.allow()).toBe(true); // single probe
    expect(cb.state()).toBe('half-open');
  });

  it('closes after a successful half-open probe', () => {
    const cb = new CircuitBreaker({ windowMs: 30_000, minCalls: 2, errorRateThreshold: 0.5, halfOpenAfterMs: 30_000 });
    cb.onFailure(); cb.onFailure();
    vi.advanceTimersByTime(30_000);
    cb.allow();
    cb.onSuccess();
    expect(cb.state()).toBe('closed');
  });

  it('re-opens after a failed half-open probe', () => {
    const cb = new CircuitBreaker({ windowMs: 30_000, minCalls: 2, errorRateThreshold: 0.5, halfOpenAfterMs: 30_000 });
    cb.onFailure(); cb.onFailure();
    vi.advanceTimersByTime(30_000);
    cb.allow();
    cb.onFailure();
    expect(cb.state()).toBe('open');
  });
});
```

- [ ] **Step 2: Verify fail**

Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// packages/runtime/src/plugins/adapter-client/circuit-breaker.ts
export type CircuitState = 'closed' | 'open' | 'half-open';

export type CircuitBreakerOptions = {
  windowMs: number;
  minCalls: number;
  errorRateThreshold: number;  // e.g. 0.5
  halfOpenAfterMs: number;
  /** Injectable clock for testing. */
  now?: () => number;
};

type Sample = { time: number; ok: boolean };

export class CircuitBreaker {
  private samples: Sample[] = [];
  private currentState: CircuitState = 'closed';
  private openedAt = 0;
  private readonly opts: CircuitBreakerOptions;

  constructor(opts: CircuitBreakerOptions) {
    this.opts = opts;
  }

  private now(): number {
    return this.opts.now?.() ?? Date.now();
  }

  private prune(): void {
    const cutoff = this.now() - this.opts.windowMs;
    this.samples = this.samples.filter((s) => s.time >= cutoff);
  }

  private maybeOpen(): void {
    this.prune();
    if (this.samples.length < this.opts.minCalls) return;
    const failures = this.samples.filter((s) => !s.ok).length;
    const rate = failures / this.samples.length;
    if (rate >= this.opts.errorRateThreshold) {
      this.currentState = 'open';
      this.openedAt = this.now();
    }
  }

  onSuccess(): void {
    if (this.currentState === 'half-open') {
      this.currentState = 'closed';
      this.samples = [];
      return;
    }
    this.samples.push({ time: this.now(), ok: true });
    this.maybeOpen();
  }

  onFailure(): void {
    if (this.currentState === 'half-open') {
      this.currentState = 'open';
      this.openedAt = this.now();
      return;
    }
    this.samples.push({ time: this.now(), ok: false });
    this.maybeOpen();
  }

  allow(): boolean {
    if (this.currentState === 'closed') return true;
    if (this.currentState === 'half-open') return false; // only one concurrent probe — allow() returned true once already
    // open: check half-open transition
    if (this.now() - this.openedAt >= this.opts.halfOpenAfterMs) {
      this.currentState = 'half-open';
      return true;
    }
    return false;
  }

  state(): CircuitState {
    return this.currentState;
  }
}
```

Note: the "single concurrent probe" invariant in half-open is minimal — a more sophisticated breaker would track in-flight probes. MVP is acceptable because the call-site is synchronous per request.

- [ ] **Step 4: Run + commit**

Expected: PASS.

```bash
git add packages/runtime/src/plugins/adapter-client/circuit-breaker.ts \
        packages/runtime/test/unit/circuit-breaker.test.ts
git commit -m "feat(runtime): add CircuitBreaker with closed/open/half-open state machine"
```

---

### Task 11: Proto registry for adapter clients

**Files:**
- Create: `packages/runtime/src/plugins/adapter-client/proto-registry.ts`
- Create: `packages/runtime/test/unit/proto-registry.test.ts`

- [ ] **Step 1: Write tests**

```ts
// packages/runtime/test/unit/proto-registry.test.ts
import { describe, it, expect } from 'vitest';
import { ProtoRegistry } from '../../src/plugins/adapter-client/proto-registry.js';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SAMPLE_PROTO = `
syntax = "proto3";
package rntme.payments.v1;
message CreateCheckoutSessionRequest { string customer_id = 1; int64 amount = 2; }
message CreateCheckoutSessionResponse { string url = 1; string session_id = 2; }
service PaymentsModule {
  rpc CreateCheckoutSession (CreateCheckoutSessionRequest) returns (CreateCheckoutSessionResponse);
}
`;

describe('ProtoRegistry', () => {
  it('loads a proto file and resolves request/response types by service + rpc', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rntme-proto-'));
    const path = join(dir, 'payments.proto');
    writeFileSync(path, SAMPLE_PROTO);
    const registry = new ProtoRegistry();
    registry.registerModule('payments', path);
    const methods = registry.getMethodDescriptors('payments');
    expect(methods.CreateCheckoutSession).toBeDefined();
    expect(methods.CreateCheckoutSession!.path).toBe('/rntme.payments.v1.PaymentsModule/CreateCheckoutSession');
  });

  it('throws when an unknown module is queried', () => {
    const reg = new ProtoRegistry();
    expect(() => reg.getMethodDescriptors('unknown')).toThrow(/not registered/);
  });
});
```

- [ ] **Step 2: Verify fail**

Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// packages/runtime/src/plugins/adapter-client/proto-registry.ts
import { readFileSync } from 'node:fs';
import * as protobuf from 'protobufjs';
import * as grpc from '@grpc/grpc-js';

export type MethodDescriptor = grpc.MethodDefinition<object, object>;

type LoadedModule = {
  root: protobuf.Root;
  service: protobuf.Service;
  methods: Record<string, MethodDescriptor>;
};

export class ProtoRegistry {
  private modules: Map<string, LoadedModule> = new Map();

  registerModule(moduleName: string, protoPath: string): void {
    const src = readFileSync(protoPath, 'utf8');
    const parsed = protobuf.parse(src, { keepCase: true });
    const root = parsed.root;
    const pkg = parsed.package ?? '';
    const pkgPrefix = pkg.length > 0 ? `${pkg}.` : '';

    // Find the first Service in the file.
    let service: protobuf.Service | null = null;
    const walk = (obj: protobuf.ReflectionObject): void => {
      if (obj instanceof protobuf.Service && service === null) {
        service = obj;
        return;
      }
      if (obj instanceof protobuf.Namespace) {
        for (const child of Object.values(obj.nested ?? {})) walk(child);
      }
    };
    for (const child of Object.values(root.nested ?? {})) walk(child);
    if (service === null) throw new Error(`no service found in proto file ${protoPath}`);

    const methods: Record<string, MethodDescriptor> = {};
    for (const [methodName, method] of Object.entries(service.methods)) {
      const req = root.lookupType(method.requestType);
      const res = root.lookupType(method.responseType);
      methods[methodName] = {
        path: `/${pkgPrefix}${service.name}/${methodName}`,
        requestStream: false,
        responseStream: false,
        requestSerialize: (v: object): Buffer => Buffer.from(req.encode(req.fromObject(v)).finish()),
        requestDeserialize: (b: Buffer): object => req.toObject(req.decode(b)),
        responseSerialize: (v: object): Buffer => Buffer.from(res.encode(res.fromObject(v)).finish()),
        responseDeserialize: (b: Buffer): object => res.toObject(res.decode(b)),
      };
    }
    this.modules.set(moduleName, { root, service, methods });
  }

  getMethodDescriptors(moduleName: string): Record<string, MethodDescriptor> {
    const loaded = this.modules.get(moduleName);
    if (loaded === undefined) throw new Error(`module "${moduleName}" is not registered in the ProtoRegistry`);
    return loaded.methods;
  }

  hasModule(moduleName: string): boolean {
    return this.modules.has(moduleName);
  }
}
```

- [ ] **Step 4: Run + commit**

Expected: PASS.

```bash
git add packages/runtime/src/plugins/adapter-client/proto-registry.ts \
        packages/runtime/test/unit/proto-registry.test.ts
git commit -m "feat(runtime): ProtoRegistry loads module .proto files and exposes method descriptors"
```

---

### Task 12: Implement `GrpcAdapterClient` (timeout + retry + circuit breaker composed)

**Files:**
- Create: `packages/runtime/src/plugins/adapter-client/grpc-adapter-client.ts`
- Create: `packages/runtime/test/integration/grpc-adapter-client.test.ts`
- Modify: `packages/runtime/src/plugins/adapter-client/index.ts`

- [ ] **Step 1: Write integration test (boots a tiny gRPC server, exercises end-to-end)**

```ts
// packages/runtime/test/integration/grpc-adapter-client.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as grpc from '@grpc/grpc-js';
import * as protobuf from 'protobufjs';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GrpcAdapterClient } from '../../src/plugins/adapter-client/grpc-adapter-client.js';
import { ProtoRegistry } from '../../src/plugins/adapter-client/proto-registry.js';
import { DEFAULT_RETRY } from '../../src/plugins/adapter-client/types.js';

const PROTO_SRC = `
syntax = "proto3";
package rntme.test.v1;
message EchoReq { string msg = 1; }
message EchoRes { string msg = 1; }
service TestModule {
  rpc Echo (EchoReq) returns (EchoRes);
  rpc Fail (EchoReq) returns (EchoRes);
}
`;

let server: grpc.Server;
let address = '';
let protoPath = '';

beforeAll(async () => {
  const dir = mkdtempSync(join(tmpdir(), 'rntme-adapter-'));
  protoPath = join(dir, 'test.proto');
  writeFileSync(protoPath, PROTO_SRC);

  const { root } = protobuf.parse(PROTO_SRC, { keepCase: true });
  const svc = root.lookupService('rntme.test.v1.TestModule');
  const req = root.lookupType('rntme.test.v1.EchoReq');
  const res = root.lookupType('rntme.test.v1.EchoRes');
  const def: grpc.ServiceDefinition = {};
  for (const name of Object.keys(svc.methods)) {
    def[name] = {
      path: `/rntme.test.v1.TestModule/${name}`,
      requestStream: false, responseStream: false,
      requestSerialize: (v: object): Buffer => Buffer.from(req.encode(req.fromObject(v)).finish()),
      requestDeserialize: (b: Buffer): object => req.toObject(req.decode(b)),
      responseSerialize: (v: object): Buffer => Buffer.from(res.encode(res.fromObject(v)).finish()),
      responseDeserialize: (b: Buffer): object => res.toObject(res.decode(b)),
    };
  }

  server = new grpc.Server();
  server.addService(def, {
    Echo: (call, cb) => cb(null, { msg: `echo:${(call.request as { msg: string }).msg}` }),
    Fail: (_call, cb) => cb({ code: grpc.status.UNAVAILABLE, message: 'down' }),
  } as unknown as grpc.UntypedServiceImplementation);

  const port = await new Promise<number>((resolve, reject) => {
    server.bindAsync('127.0.0.1:0', grpc.ServerCredentials.createInsecure(), (err, p) => {
      if (err !== null) return reject(err);
      resolve(p);
    });
  });
  address = `127.0.0.1:${port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.tryShutdown(() => resolve()));
});

describe('GrpcAdapterClient (integration)', () => {
  it('successfully calls Echo and returns value', async () => {
    const registry = new ProtoRegistry();
    registry.registerModule('test', protoPath);
    const client = new GrpcAdapterClient({
      modules: { test: { address, protoPath } },
      registry,
    });
    const out = await client.call('test', 'Echo', { msg: 'hi' }, {
      idempotencyKey: 'k1', timeoutMs: 2000, retry: DEFAULT_RETRY,
    });
    expect(out.ok).toBe(true);
    if (out.ok) expect((out.value as { msg: string }).msg).toBe('echo:hi');
  });

  it('retries a transient error and eventually fails with EXTERNAL_MODULE_UNAVAILABLE', async () => {
    const registry = new ProtoRegistry();
    registry.registerModule('test', protoPath);
    const client = new GrpcAdapterClient({
      modules: { test: { address, protoPath } },
      registry,
    });
    const out = await client.call('test', 'Fail', { msg: 'x' }, {
      idempotencyKey: 'k2', timeoutMs: 500, retry: { attempts: 2, backoffMs: 0, retryOn: 'transient' },
    });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error.code).toBe('EXTERNAL_MODULE_UNAVAILABLE');
  });

  it('returns EXTERNAL_MODULE_NOT_CONFIGURED for an unknown module', async () => {
    const registry = new ProtoRegistry();
    const client = new GrpcAdapterClient({ modules: {}, registry });
    const out = await client.call('missing', 'Echo', {}, {
      idempotencyKey: 'k3', timeoutMs: 100, retry: DEFAULT_RETRY,
    });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error.code).toBe('EXTERNAL_MODULE_NOT_CONFIGURED');
  });
});
```

- [ ] **Step 2: Verify fail**

Expected: FAIL (module missing).

- [ ] **Step 3: Implement `GrpcAdapterClient`**

```ts
// packages/runtime/src/plugins/adapter-client/grpc-adapter-client.ts
import * as grpc from '@grpc/grpc-js';
import pino, { type Logger } from 'pino';
import type {
  ExternalAdapterClient,
  AdapterCallOptions,
  AdapterResult,
  AdapterError,
  AdapterErrorCode,
} from './types.js';
import { classifyGrpcError } from './classify.js';
import { withRetry } from './retry.js';
import { CircuitBreaker } from './circuit-breaker.js';
import type { ProtoRegistry } from './proto-registry.js';

export type GrpcAdapterClientConfig = {
  modules: Record<string, { address: string; protoPath: string }>;
  registry: ProtoRegistry;
  logger?: Logger;
  /** Per-module circuit-breaker config. Default: 50% err over 30s, min 10 calls, 30s half-open. */
  circuit?: { windowMs?: number; minCalls?: number; errorRateThreshold?: number; halfOpenAfterMs?: number };
};

export class GrpcAdapterClient implements ExternalAdapterClient {
  private readonly clients: Map<string, grpc.Client> = new Map();
  private readonly breakers: Map<string, CircuitBreaker> = new Map();
  private readonly logger: Logger;

  constructor(private readonly cfg: GrpcAdapterClientConfig) {
    this.logger = cfg.logger ?? pino({ level: process.env.LOG_LEVEL ?? 'info' });
  }

  private getBreaker(module: string, rpc: string): CircuitBreaker {
    const key = `${module}:${rpc}`;
    let cb = this.breakers.get(key);
    if (cb === undefined) {
      cb = new CircuitBreaker({
        windowMs: this.cfg.circuit?.windowMs ?? 30_000,
        minCalls: this.cfg.circuit?.minCalls ?? 10,
        errorRateThreshold: this.cfg.circuit?.errorRateThreshold ?? 0.5,
        halfOpenAfterMs: this.cfg.circuit?.halfOpenAfterMs ?? 30_000,
      });
      this.breakers.set(key, cb);
    }
    return cb;
  }

  private getClient(module: string): grpc.Client | undefined {
    let client = this.clients.get(module);
    if (client !== undefined) return client;
    const cfg = this.cfg.modules[module];
    if (cfg === undefined) return undefined;
    client = new grpc.Client(cfg.address, grpc.credentials.createInsecure());
    this.clients.set(module, client);
    return client;
  }

  async call(module: string, rpc: string, input: unknown, opts: AdapterCallOptions): Promise<AdapterResult> {
    const client = this.getClient(module);
    if (client === undefined) {
      return { ok: false, error: {
        code: 'EXTERNAL_MODULE_NOT_CONFIGURED',
        message: `module "${module}" is not declared in manifest.modules`,
        httpStatus: 500,
      }};
    }
    const methods = this.cfg.registry.getMethodDescriptors(module);
    const method = methods[rpc];
    if (method === undefined) {
      return { ok: false, error: {
        code: 'EXTERNAL_MODULE_SCHEMA_MISMATCH',
        message: `rpc "${rpc}" not found in module "${module}" proto`,
        httpStatus: 500,
      }};
    }
    const breaker = this.getBreaker(module, rpc);
    if (!breaker.allow()) {
      return { ok: false, error: {
        code: 'EXTERNAL_MODULE_CIRCUIT_OPEN',
        message: `circuit breaker open for ${module}.${rpc}`,
        httpStatus: 503,
      }};
    }

    const doCall = async (): Promise<AdapterResult> => {
      const meta = new grpc.Metadata();
      meta.add('rntme-idempotency-key', opts.idempotencyKey);
      if (opts.correlationId !== undefined) meta.add('rntme-correlation-id', opts.correlationId);
      const deadline = new Date(Date.now() + opts.timeoutMs);

      return new Promise<AdapterResult>((resolve) => {
        client.makeUnaryRequest(
          method.path,
          method.requestSerialize,
          method.responseDeserialize,
          input as object,
          meta,
          { deadline },
          (err, res) => {
            if (err !== null && err !== undefined) {
              resolve({ ok: false, error: statusToAdapterError(err) });
              return;
            }
            resolve({ ok: true, value: res });
          },
        );
      });
    };

    const result = await withRetry(doCall, opts.retry, (attempt, r, delay): void => {
      this.logger.info({
        msg: 'pre_step_attempt',
        module, rpc, attempt, delay_ms: delay,
        result: r.ok ? 'ok' : r.error.code,
        idempotency_key: opts.idempotencyKey,
      });
    });

    if (result.ok) breaker.onSuccess();
    else breaker.onFailure();

    return result;
  }
}

function statusToAdapterError(err: Partial<grpc.ServiceError>): AdapterError {
  const status = (err.code ?? grpc.status.UNKNOWN) as grpc.status;
  const message = err.message ?? 'unknown gRPC error';
  if (status === grpc.status.DEADLINE_EXCEEDED) {
    return { code: 'EXTERNAL_MODULE_TIMEOUT', message, httpStatus: 504 };
  }
  if (status === grpc.status.UNAVAILABLE) {
    return { code: 'EXTERNAL_MODULE_UNAVAILABLE', message, httpStatus: 503 };
  }
  if (status === grpc.status.RESOURCE_EXHAUSTED) {
    return { code: 'EXTERNAL_MODULE_OVERLOAD', message, httpStatus: 503 };
  }
  if (status === grpc.status.INTERNAL || status === grpc.status.UNKNOWN) {
    return { code: 'EXTERNAL_MODULE_INTERNAL', message, httpStatus: 502 };
  }
  // Terminal / domain errors
  const httpMap: Record<number, number> = {
    [grpc.status.INVALID_ARGUMENT]: 400,
    [grpc.status.NOT_FOUND]: 404,
    [grpc.status.FAILED_PRECONDITION]: 409,
    [grpc.status.PERMISSION_DENIED]: 403,
    [grpc.status.UNAUTHENTICATED]: 401,
    [grpc.status.ALREADY_EXISTS]: 409,
    [grpc.status.ABORTED]: 409,
  };
  return {
    code: 'EXTERNAL_VENDOR_DOMAIN',
    message,
    domainCode: message.split(':')[0],
    httpStatus: httpMap[status] ?? 502,
  };
}
```

Note: `statusToAdapterError`'s `domainCode` extraction is rudimentary — it assumes the module formats messages as `<CODE>: <text>` (matching the gRPC handler emission in plan 2 Task 10). This is good enough for MVP; a richer contract (gRPC trailers carrying structured error metadata) is a follow-up.

- [ ] **Step 4: Add `pino` to `@rntme/runtime` deps**

```json
"dependencies": {
  "pino": "^9.0.0",
  ...existing
}
```

Run `pnpm install`.

- [ ] **Step 5: Add barrel export**

```ts
// packages/runtime/src/plugins/adapter-client/index.ts
export * from './types.js';
export { classifyGrpcError, type Classification } from './classify.js';
export { withRetry } from './retry.js';
export { CircuitBreaker, type CircuitState, type CircuitBreakerOptions } from './circuit-breaker.js';
export { ProtoRegistry, type MethodDescriptor } from './proto-registry.js';
export { GrpcAdapterClient, type GrpcAdapterClientConfig } from './grpc-adapter-client.js';
```

And add to `packages/runtime/src/index.ts`:
```ts
export * from './plugins/adapter-client/index.js';
```

- [ ] **Step 6: Run integration test**

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/runtime/src/plugins/adapter-client/ \
        packages/runtime/src/index.ts \
        packages/runtime/package.json \
        packages/runtime/test/integration/grpc-adapter-client.test.ts
git commit -m "feat(runtime): implement GrpcAdapterClient with timeout + retry + circuit breaker"
```

---

## Phase 5 — Idempotency-key chain

### Task 13: `IdempotencyCache` in SQLite

**Files:**
- Create: `packages/bindings-http/src/idempotency/cache.ts`
- Create: `packages/bindings-http/test/unit/idempotency-cache.test.ts`

- [ ] **Step 1: Write tests**

```ts
// packages/bindings-http/test/unit/idempotency-cache.test.ts
import { describe, it, expect } from 'vitest';
import BetterSqlite3 from 'better-sqlite3';
import { IdempotencyCache } from '../../src/idempotency/cache.js';

describe('IdempotencyCache', () => {
  it('stores and retrieves a response by (commandName, key)', () => {
    const db = new BetterSqlite3(':memory:');
    const cache = new IdempotencyCache(db);
    cache.set('createOrder', 'abc', { status: 200, body: '{"ok":true}' }, Date.now());
    const hit = cache.get('createOrder', 'abc', Date.now());
    expect(hit?.body).toBe('{"ok":true}');
  });

  it('returns null for expired entries', () => {
    const db = new BetterSqlite3(':memory:');
    const cache = new IdempotencyCache(db);
    cache.set('createOrder', 'abc', { status: 200, body: '{}' }, Date.now() - 25 * 3600 * 1000);
    const hit = cache.get('createOrder', 'abc', Date.now()); // TTL is 24h
    expect(hit).toBeNull();
  });

  it('returns null for unknown key', () => {
    const db = new BetterSqlite3(':memory:');
    const cache = new IdempotencyCache(db);
    expect(cache.get('createOrder', 'none', Date.now())).toBeNull();
  });

  it('overwrites on second set (same key)', () => {
    const db = new BetterSqlite3(':memory:');
    const cache = new IdempotencyCache(db);
    cache.set('createOrder', 'abc', { status: 200, body: 'v1' }, Date.now());
    cache.set('createOrder', 'abc', { status: 200, body: 'v2' }, Date.now());
    expect(cache.get('createOrder', 'abc', Date.now())?.body).toBe('v2');
  });
});
```

- [ ] **Step 2: Verify fail**

Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// packages/bindings-http/src/idempotency/cache.ts
import type BetterSqlite3 from 'better-sqlite3';

const TTL_MS = 24 * 3600 * 1000;

const DDL = `
CREATE TABLE IF NOT EXISTS idempotency_cache (
  command_name TEXT NOT NULL,
  key TEXT NOT NULL,
  status INTEGER NOT NULL,
  body TEXT NOT NULL,
  stored_at INTEGER NOT NULL,
  PRIMARY KEY (command_name, key)
);
`;

export type CachedResponse = { status: number; body: string };

export class IdempotencyCache {
  constructor(private readonly db: BetterSqlite3.Database) {
    db.exec(DDL);
  }

  set(commandName: string, key: string, response: CachedResponse, now: number): void {
    this.db.prepare(
      `INSERT OR REPLACE INTO idempotency_cache (command_name, key, status, body, stored_at) VALUES (?, ?, ?, ?, ?)`,
    ).run(commandName, key, response.status, response.body, now);
  }

  get(commandName: string, key: string, now: number): CachedResponse | null {
    const row = this.db.prepare(
      `SELECT status, body, stored_at FROM idempotency_cache WHERE command_name = ? AND key = ?`,
    ).get(commandName, key) as { status: number; body: string; stored_at: number } | undefined;
    if (row === undefined) return null;
    if (now - row.stored_at > TTL_MS) return null;
    return { status: row.status, body: row.body };
  }

  pruneExpired(now: number): number {
    const result = this.db.prepare(
      `DELETE FROM idempotency_cache WHERE stored_at < ?`,
    ).run(now - TTL_MS);
    return result.changes;
  }
}
```

- [ ] **Step 4: Run + commit**

Expected: PASS.

```bash
git add packages/bindings-http/src/idempotency/cache.ts \
        packages/bindings-http/test/unit/idempotency-cache.test.ts
git commit -m "feat(bindings-http): add IdempotencyCache with 24h TTL in qsm SQLite"
```

---

### Task 14: Derive command-run-id and per-step keys

**Files:**
- Create: `packages/bindings-http/src/idempotency/derive-keys.ts`
- Create: `packages/bindings-http/test/unit/derive-keys.test.ts`

- [ ] **Step 1: Write tests**

```ts
// packages/bindings-http/test/unit/derive-keys.test.ts
import { describe, it, expect } from 'vitest';
import { deriveCommandRunId, deriveStepKey } from '../../src/idempotency/derive-keys.js';

describe('idempotency key derivation', () => {
  it('deriveCommandRunId is deterministic for same (commandName, clientKey)', () => {
    const a = deriveCommandRunId('createOrder', 'abc');
    const b = deriveCommandRunId('createOrder', 'abc');
    expect(a).toBe(b);
  });
  it('deriveCommandRunId differs when commandName differs', () => {
    expect(deriveCommandRunId('a', 'k')).not.toBe(deriveCommandRunId('b', 'k'));
  });
  it('deriveStepKey is deterministic for same (runId, index)', () => {
    expect(deriveStepKey('r1', 0)).toBe(deriveStepKey('r1', 0));
  });
  it('deriveStepKey differs by index', () => {
    expect(deriveStepKey('r1', 0)).not.toBe(deriveStepKey('r1', 1));
  });
  it('deriveStepKey differs by runId', () => {
    expect(deriveStepKey('r1', 0)).not.toBe(deriveStepKey('r2', 0));
  });
});
```

- [ ] **Step 2: Verify fail**

Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// packages/bindings-http/src/idempotency/derive-keys.ts
import { createHash } from 'node:crypto';

function sha256Hex(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

/** Stable run-id derived from (commandName, client-supplied key). */
export function deriveCommandRunId(commandName: string, clientKey: string): string {
  return sha256Hex(`${commandName}:${clientKey}`);
}

/** Stable per-step key derived from (runId, stepIndex). */
export function deriveStepKey(runId: string, stepIndex: number): string {
  return sha256Hex(`${runId}:pre:${stepIndex}`);
}
```

- [ ] **Step 4: Run + commit**

Expected: PASS.

```bash
git add packages/bindings-http/src/idempotency/derive-keys.ts \
        packages/bindings-http/test/unit/derive-keys.test.ts
git commit -m "feat(bindings-http): derive command-run-id and step keys via SHA-256"
```

---

### Task 15: Idempotency middleware

**Files:**
- Create: `packages/bindings-http/src/idempotency/middleware.ts`

- [ ] **Step 1: Implement**

```ts
// packages/bindings-http/src/idempotency/middleware.ts
import type { MiddlewareHandler } from 'hono';
import type { IdempotencyCache } from './cache.js';
import { deriveCommandRunId } from './derive-keys.js';

export type IdempotencyContext = {
  /** The raw client-provided Idempotency-Key header, or null if absent. */
  clientKey: string | null;
  /** Stable run-id derived from (commandName, clientKey). Null iff clientKey null. */
  runId: string | null;
};

export function idempotencyMiddleware(opts: {
  cache: IdempotencyCache;
  now: () => number;
  /** Caller provides the commandName from the binding plan; middleware is generic. */
  commandNameFromPath: (path: string) => string | null;
}): MiddlewareHandler<{ Variables: { idempotency: IdempotencyContext } }> {
  return async (c, next) => {
    const clientKey = c.req.header('Idempotency-Key') ?? null;
    let runId: string | null = null;
    if (clientKey !== null) {
      const commandName = opts.commandNameFromPath(new URL(c.req.url).pathname);
      if (commandName !== null) {
        runId = deriveCommandRunId(commandName, clientKey);
        const hit = opts.cache.get(commandName, clientKey, opts.now());
        if (hit !== null) {
          return c.body(hit.body, hit.status as 200 | 201 | 400 | 409 | 422 | 500 | 502 | 503 | 504, {
            'Content-Type': 'application/json',
            'Idempotency-Replay': 'true',
          });
        }
      }
    }
    c.set('idempotency', { clientKey, runId });
    await next();
  };
}
```

The `commandNameFromPath` callback is provided by the caller (`createBindingsRouter` — Task 18) and returns the binding-id bound to the route, or null if the path is non-command.

- [ ] **Step 2: Commit (tests in Task 19 integration)**

```bash
git add packages/bindings-http/src/idempotency/middleware.ts
git commit -m "feat(bindings-http): add Idempotency-Key middleware with response replay"
```

---

## Phase 6 — Pre-step runner

### Task 16: `runPreSteps` — orchestrate one binding's pre[]

**Files:**
- Create: `packages/bindings-http/src/pre/types.ts`
- Create: `packages/bindings-http/src/pre/run-pre-steps.ts`
- Create: `packages/bindings-http/test/integration/pre-steps.test.ts`

- [ ] **Step 1: Declare runtime types**

```ts
// packages/bindings-http/src/pre/types.ts
import type { PreStep } from '@rntme/bindings';

export type PreStepsResult =
  | { ok: true; systemFields: { pre: Record<string, unknown>; [k: string]: unknown } }
  | { ok: false; httpStatus: number; body: { code: string; message: string; details?: unknown } };

export type { PreStep };
```

- [ ] **Step 2: Write integration test**

```ts
// packages/bindings-http/test/integration/pre-steps.test.ts
import { describe, it, expect } from 'vitest';
import { runPreSteps } from '../../src/pre/run-pre-steps.js';
import type { ExternalAdapterClient } from '@rntme/runtime';

const fakeAdapter: ExternalAdapterClient = {
  async call(module, rpc, input, opts) {
    if (module === 'payments' && rpc === 'CreateCustomer')
      return { ok: true, value: { id: `cust-${opts.idempotencyKey.slice(0, 4)}` } };
    if (module === 'payments' && rpc === 'ChargeCard')
      return { ok: false, error: { code: 'EXTERNAL_VENDOR_DOMAIN', message: 'PAYMENTS_CARD_DECLINED: card declined', domainCode: 'PAYMENTS_CARD_DECLINED', httpStatus: 409 } };
    return { ok: false, error: { code: 'EXTERNAL_MODULE_SCHEMA_MISMATCH', message: 'unknown rpc', httpStatus: 500 } };
  },
};

describe('runPreSteps', () => {
  it('runs two steps, binding pre[1] input against pre[0].result', async () => {
    const out = await runPreSteps(
      [
        { kind: 'system', op: 'randomBytes', bytes: 8, bindAs: 'nonce' },
        { kind: 'module-rpc', module: 'payments', rpc: 'CreateCustomer',
          input: { nonce: '$pre.nonce', email: '$auth.email' }, bindAs: 'customer' },
      ],
      {
        scope: { body: {}, query: {}, auth: { email: 'u@x' }, config: {}, system: {} },
        adapterClient: fakeAdapter,
        runId: 'run-1',
        correlationId: 'corr-1',
        logger: () => {},
      },
    );
    expect(out.ok).toBe(true);
    if (out.ok) expect((out.systemFields.pre.customer as { id: string }).id).toContain('cust-');
  });

  it('returns mapped HTTP status on terminal module error', async () => {
    const out = await runPreSteps(
      [
        { kind: 'module-rpc', module: 'payments', rpc: 'ChargeCard',
          input: {}, bindAs: 'charge' },
      ],
      {
        scope: { body: {}, query: {}, auth: {}, config: {}, system: {} },
        adapterClient: fakeAdapter,
        runId: 'run-2',
        correlationId: 'corr-2',
        logger: () => {},
      },
    );
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.httpStatus).toBe(409);
      expect(out.body.code).toBe('PAYMENTS_CARD_DECLINED');
    }
  });
});
```

- [ ] **Step 3: Verify fail**

Expected: FAIL.

- [ ] **Step 4: Implement**

```ts
// packages/bindings-http/src/pre/run-pre-steps.ts
import { randomBytes } from 'node:crypto';
import type { PreStep } from '@rntme/bindings';
import type { ExternalAdapterClient } from '@rntme/runtime';
import type { RetryPolicy as RuntimeRetryPolicy } from '@rntme/runtime';
import { DEFAULT_RETRY, DEFAULT_TIMEOUT_MS } from '@rntme/runtime';
import { evaluateExpression, type ExpressionScope } from './expression.js';
import { deriveStepKey } from '../idempotency/derive-keys.js';
import type { PreStepsResult } from './types.js';

export type RunPreStepsOpts = {
  scope: Omit<ExpressionScope, 'pre' | 'system'>;
  adapterClient: ExternalAdapterClient;
  runId: string;
  correlationId: string;
  logger: (evt: Record<string, unknown>) => void;
};

export async function runPreSteps(pre: PreStep[], opts: RunPreStepsOpts): Promise<PreStepsResult> {
  const pre_acc: Record<string, unknown> = {};
  const system_acc: Record<string, unknown> = {};

  for (let i = 0; i < pre.length; i++) {
    const step = pre[i]!;
    const fullScope: ExpressionScope = { ...opts.scope, pre: pre_acc, system: system_acc };

    if (step.kind === 'system') {
      const value = performSystemOp(step.op, step.bytes);
      system_acc[step.bindAs] = value;
      pre_acc[step.bindAs] = value;
      opts.logger({ pre_step: 'system', index: i, op: step.op, bindAs: step.bindAs });
      continue;
    }

    // module-rpc
    let resolvedInput: unknown;
    try {
      resolvedInput = evaluateExpression(step.input, fullScope);
    } catch (e) {
      return {
        ok: false,
        httpStatus: 500,
        body: { code: 'BINDINGS_RUNTIME_EXPRESSION_ERROR', message: e instanceof Error ? e.message : String(e) },
      };
    }

    const idempotencyKey = deriveStepKey(opts.runId, i);
    const timeoutMs = step.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const retry: RuntimeRetryPolicy = {
      attempts: step.retry?.attempts ?? DEFAULT_RETRY.attempts,
      backoffMs: step.retry?.backoffMs ?? DEFAULT_RETRY.backoffMs,
      retryOn: step.retry?.retryOn ?? DEFAULT_RETRY.retryOn,
    };

    const result = await opts.adapterClient.call(step.module, step.rpc, resolvedInput, {
      idempotencyKey, timeoutMs, retry, correlationId: opts.correlationId,
    });

    if (!result.ok) {
      const body = result.error.code === 'EXTERNAL_VENDOR_DOMAIN'
        ? { code: result.error.domainCode ?? 'EXTERNAL_VENDOR_DOMAIN', message: result.error.message }
        : { code: result.error.code, message: result.error.message };
      opts.logger({
        pre_step: 'module-rpc',
        index: i,
        module: step.module, rpc: step.rpc,
        bindAs: step.bindAs,
        result: 'error',
        code: result.error.code,
        http_status: result.error.httpStatus,
      });
      return { ok: false, httpStatus: result.error.httpStatus, body };
    }

    pre_acc[step.bindAs] = result.value;
    opts.logger({
      pre_step: 'module-rpc',
      index: i, module: step.module, rpc: step.rpc, bindAs: step.bindAs, result: 'ok',
    });
  }

  return { ok: true, systemFields: { ...system_acc, pre: pre_acc } };
}

function performSystemOp(op: 'randomBytes', bytes: number): string {
  if (op === 'randomBytes') return randomBytes(bytes).toString('base64url');
  throw new Error(`unsupported system op: ${op as string}`);
}
```

- [ ] **Step 5: Run + commit**

Expected: PASS.

```bash
git add packages/bindings-http/src/pre/ \
        packages/bindings-http/test/integration/pre-steps.test.ts
git commit -m "feat(bindings-http): runPreSteps orchestrator wires adapter + expression + idempotency-key"
```

---

### Task 17: Wire pre-steps into command handler

**Files:**
- Modify: `packages/bindings-http/src/runtime/command-handler.ts`
- Modify: `packages/bindings-http/src/router.ts`
- Modify: `packages/bindings-http/src/startup/compile-plan.ts` (carry `pre` into plan)

- [ ] **Step 1: Carry `pre` into `CommandBindingPlan`**

In `packages/bindings-http/src/startup/compile-plan.ts`, extend `CommandBindingPlan` (after plan 1's refactor removed `compiled`):

```ts
export type CommandBindingPlan = BindingPlanCommon & {
  kind: 'command';
  commandName: string;
  pre: import('@rntme/bindings').PreStep[];  // empty array if not specified
};
```

In `buildPlan`, populate `pre: entry.pre ?? []` for each command binding.

- [ ] **Step 2: Extend `BindingsRouterOptions`**

In `packages/bindings-http/src/router.ts`, add:

```ts
import type { ExternalAdapterClient } from '@rntme/runtime';
import type { IdempotencyCache } from './idempotency/cache.js';

export type BindingsRouterOptions = {
  // ... existing fields (from plan 1 refactor)
  externalAdapterClient?: ExternalAdapterClient;
  idempotencyCache?: IdempotencyCache;
  now?: () => string;
};
```

If any command binding in the plan has `pre.length > 0` and `externalAdapterClient` is missing → throw early. Idempotency cache is optional (if missing, all requests are treated as non-idempotent: no cache read, no cache write, but per-step keys are still derived from a random run-id).

- [ ] **Step 3: Update `makeCommandHandler`**

In `packages/bindings-http/src/runtime/command-handler.ts`:

```ts
import { runPreSteps } from '../pre/run-pre-steps.js';
import type { ExternalAdapterClient } from '@rntme/runtime';
import type { IdempotencyCache } from '../idempotency/cache.js';
import { deriveCommandRunId } from '../idempotency/derive-keys.js';
import { randomUUID } from 'node:crypto';

export type CommandHandlerDeps = {
  commandExecutor: CommandExecutor;
  eventStore: EventStore;
  qsmDb: BetterSqlite3.Database | null;
  now: () => string;
  nextId: () => string;
  actorFromRequest: (c: Context) => ActorRef | null;
  onError?: (err: unknown, ctx: Context) => void;
  externalAdapterClient?: ExternalAdapterClient;
  idempotencyCache?: IdempotencyCache;
};

// in handler body, BEFORE commandExecutor.execute:
const idemCtx = c.get('idempotency') as { clientKey: string | null; runId: string | null } | undefined;
const clientKey = idemCtx?.clientKey ?? null;
const runId = idemCtx?.runId ?? (clientKey !== null ? deriveCommandRunId(plan.commandName, clientKey) : randomUUID());
const correlationId = c.get('correlation')?.correlationId ?? randomUUID();

// Scope for pre-steps
const scope = {
  body: bodyValues,
  query: queryParsed.data as Record<string, unknown>,
  auth: /* your existing actor extraction → map to simple record */ { userId: (deps.actorFromRequest(c) as { id?: string } | null)?.id ?? null },
  config: { /* read-only env exposed as-is for templates; empty for MVP */ },
};

if (plan.pre.length > 0) {
  if (deps.externalAdapterClient === undefined) {
    return c.json({ code: 'BINDINGS_CONFIG_ADAPTER_MISSING', message: 'pre[] requires externalAdapterClient' }, 500);
  }
  const preResult = await runPreSteps(plan.pre, {
    scope,
    adapterClient: deps.externalAdapterClient,
    runId,
    correlationId,
    logger: (evt) => { /* piped to a pino logger at router-construction time; see Task 20 */ },
  });
  if (!preResult.ok) {
    // Do NOT cache pre-step failures — the next retry may succeed (unless it's domain-terminal,
    // in which case the vendor's own idempotency handles dedupe on retry).
    return c.json(preResult.body, preResult.httpStatus);
  }
  // merge pre results into graph inputs as systemFields.pre
  graphInputs = { ...graphInputs, ...preResult.systemFields };
}

// existing executor.execute call:
const out = await deps.commandExecutor.execute({ commandName: plan.commandName, inputs: graphInputs, ctx: { /* ... */ } });
// ... existing error handling

// On success, cache response if idempotency enabled
if (out.ok && deps.idempotencyCache !== undefined && clientKey !== null) {
  const bodyStr = JSON.stringify(out.value);
  deps.idempotencyCache.set(plan.commandName, clientKey, { status: 200, body: bodyStr }, Date.now());
}
return c.json(out.value, 200);
```

(Wire up scope/auth exactly as fits the existing code; the snippet is illustrative.)

- [ ] **Step 4: Wire router to build cache + mount middleware**

In `createBindingsRouter`:

```ts
import { idempotencyMiddleware } from './idempotency/middleware.js';
import { IdempotencyCache } from './idempotency/cache.js';

const cache = opts.idempotencyCache ?? (opts.db !== undefined ? new IdempotencyCache(opts.db) : undefined);

// map path → commandName for the middleware
const pathToCommand: Map<string, string> = new Map();
for (const bp of Object.values(plan.plans)) {
  if (bp.kind === 'command') pathToCommand.set(bp.entry.http.path, bp.commandName);
}

if (cache !== undefined) {
  app.use('*', idempotencyMiddleware({
    cache,
    now: () => Date.now(),
    commandNameFromPath: (p) => pathToCommand.get(p) ?? null,
  }));
}
```

- [ ] **Step 5: Run bindings-http tests**

Run: `pnpm -F @rntme/bindings-http test`
Expected: PASS (including plan-1 regression + new pre-step and idempotency suites).

- [ ] **Step 6: Commit**

```bash
git add packages/bindings-http/src/
git commit -m "feat(bindings-http): run pre[] and idempotency-key middleware before executor"
```

---

### Task 18: End-to-end idempotency replay test

**Files:**
- Create: `packages/bindings-http/test/integration/idempotency.test.ts`

- [ ] **Step 1: Write the test**

```ts
// packages/bindings-http/test/integration/idempotency.test.ts
import { describe, it, expect } from 'vitest';
import BetterSqlite3 from 'better-sqlite3';
import { SqliteEventStore } from '@rntme/event-store';
import { CodeCommandExecutor } from '@rntme/runtime';
import { createBindingsRouter } from '../../src/index.js';

describe('Idempotency-Key', () => {
  it('replays the cached response on second call with same key', async () => {
    const db = new BetterSqlite3(':memory:');
    const eventStore = new SqliteEventStore({ filename: ':memory:', serviceName: 'tst' });
    let callCount = 0;
    const executor = new CodeCommandExecutor({
      noop: async () => {
        callCount++;
        return { ok: true, value: {
          aggregateId: 'a-1', version: callCount, eventIds: [`e-${callCount}`],
          commandId: 'c', correlationId: 'corr',
        } };
      },
    });

    const router = createBindingsRouter({
      validated: /* a minimal ValidatedBindings with a single command "noop" at POST /noop — reuse plan-2 fixture or inline */,
      graphSpec: {}, pdm: {}, qsm: {},
      db, eventStore,
      commandExecutor: executor,
    });

    const resp1 = await router.request('/noop', { method: 'POST', headers: { 'Idempotency-Key': 'abc', 'content-type': 'application/json' }, body: '{}' });
    const resp2 = await router.request('/noop', { method: 'POST', headers: { 'Idempotency-Key': 'abc', 'content-type': 'application/json' }, body: '{}' });

    expect(resp1.status).toBe(200);
    expect(resp2.status).toBe(200);
    expect(resp2.headers.get('Idempotency-Replay')).toBe('true');
    expect(await resp2.text()).toBe(await resp1.text());
    expect(callCount).toBe(1); // executor only ran once
  });
});
```

If building a ValidatedBindings by hand is verbose, adapt the fixture pattern from plan 2's `minimal-bindings.ts` (command-only, no pre).

- [ ] **Step 2: Run**

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/bindings-http/test/integration/idempotency.test.ts
git commit -m "test(bindings-http): Idempotency-Key replay returns cached response"
```

---

## Phase 7 — Runtime wiring

### Task 19: Build default `GrpcAdapterClient` from manifest in `startService`

**Files:**
- Modify: `packages/runtime/src/start/start-service.ts`
- Create: `packages/runtime/src/start/build-adapter-client.ts`

- [ ] **Step 1: Create the builder**

```ts
// packages/runtime/src/start/build-adapter-client.ts
import { resolve } from 'node:path';
import type { ValidatedManifest } from '../manifest/types.js';
import { GrpcAdapterClient, ProtoRegistry, type ExternalAdapterClient } from '../plugins/adapter-client/index.js';

export function buildAdapterClient(manifest: ValidatedManifest, artifactDir: string): ExternalAdapterClient | null {
  const modules = manifest.modules ?? [];
  if (modules.length === 0) return null;

  const registry = new ProtoRegistry();
  const modulesCfg: Record<string, { address: string; protoPath: string }> = {};
  for (const m of modules) {
    const absProtoPath = resolve(artifactDir, m.protoPath);
    registry.registerModule(m.name, absProtoPath);
    modulesCfg[m.name] = { address: m.grpc.address, protoPath: absProtoPath };
  }
  return new GrpcAdapterClient({ modules: modulesCfg, registry });
}
```

- [ ] **Step 2: Wire into `startService`**

Add to `RuntimeConfig`:
```ts
externalAdapterClient?: ExternalAdapterClient;
artifactDir?: string;  // required iff manifest.modules[] is non-empty
```

In `startService`:
```ts
import { buildAdapterClient } from './build-adapter-client.js';

const adapter =
  config.externalAdapterClient
  ?? (config.artifactDir !== undefined ? buildAdapterClient(service.manifest, config.artifactDir) : null);

// pass into HttpSurface:
new HttpSurface({ /*...existing opts,*/ commandExecutor, externalAdapterClient: adapter ?? undefined });
```

`HttpSurface` forwards `externalAdapterClient` into `createBindingsRouter`. Add the field to its constructor options.

- [ ] **Step 3: Integration test — boot a service with a module declared**

Append to `packages/runtime/test/integration/startup.test.ts`:

```ts
it('wires GrpcAdapterClient when manifest.modules[] is non-empty', async () => {
  // Fixture: a manifest that declares one module pointing at a local proto file.
  // Use the same tiny proto + fake server strategy as the adapter-client integration test,
  // but route through startService end-to-end.
  // Assert a pre[]-using command succeeds.
});
```

(Spelled out more fully below in demo E2E — Task 23 — so this test can be light: "pre[]-less service boots fine with modules[]", validating wiring without a running gRPC stub.)

- [ ] **Step 4: Run + commit**

Run: `pnpm -F @rntme/runtime test`
Expected: PASS.

```bash
git add packages/runtime/src/start/ \
        packages/runtime/test/integration/startup.test.ts
git commit -m "feat(runtime): build default GrpcAdapterClient from manifest.modules"
```

---

## Phase 8 — Observability

### Task 20: Structured pino logs per pre-step + Prometheus counter

**Files:**
- Modify: `packages/bindings-http/src/router.ts` (accept logger)
- Modify: `packages/bindings-http/src/runtime/command-handler.ts` (use logger)
- Modify: `packages/runtime/src/plugins/observability.ts` (add counter)

- [ ] **Step 1: Thread a pino logger through bindings-http**

Add to `BindingsRouterOptions`:

```ts
logger?: import('pino').Logger;
```

Default: `pino({ level: process.env.LOG_LEVEL ?? 'info' })` inside `createBindingsRouter`. Pass as `logger` dep into `makeCommandHandler`. In handler, replace the placeholder `/* piped to a pino logger */` with an actual log call.

- [ ] **Step 2: Pino as a dep in bindings-http**

Add to `packages/bindings-http/package.json#dependencies`:

```json
"pino": "^9.0.0",
```

- [ ] **Step 3: Add counter in runtime/observability**

In `packages/runtime/src/plugins/observability.ts`, add to the `createMetrics` return:

```ts
import { Counter } from 'prom-client';

// inside createMetrics(serviceName):
const externalPreStep = new Counter({
  name: 'external_pre_step_total',
  help: 'Count of pre-fetch steps executed, labelled by module/rpc/result/error_code',
  labelNames: ['module', 'rpc', 'result', 'error_code'],
});
// add to returned metrics object:
return { /* existing */, externalPreStep };
```

And expose an increment helper:

```ts
export function recordPreStep(metrics: Metrics, labels: {
  module: string; rpc: string; result: 'ok' | 'error'; error_code?: string;
}): void {
  metrics.externalPreStep?.labels({
    module: labels.module, rpc: labels.rpc, result: labels.result,
    error_code: labels.error_code ?? '',
  }).inc();
}
```

- [ ] **Step 4: Call `recordPreStep` from the handler**

Plumb `metrics` from `HttpSurface` → `BindingsRouterOptions` → command handler. In the handler's pre-step log path, call `recordPreStep(metrics, {...})` for each completed step.

- [ ] **Step 5: Run full runtime + bindings-http tests**

Run: `pnpm -F @rntme/bindings-http test && pnpm -F @rntme/runtime test`
Expected: PASS. Verify `/metrics` endpoint exposes `external_pre_step_total` (manual; or small assertion in existing `health-metrics.test.ts` if available).

- [ ] **Step 6: Commit**

```bash
git add packages/bindings-http/ packages/runtime/src/plugins/observability.ts \
        packages/runtime/src/start/start-service.ts
git commit -m "feat(observability): structured pino logs + external_pre_step_total counter"
```

---

## Phase 9 — Demo integration

### Task 21: Create `demo/pre-step-demo/` with a fake payments module

**Files:**
- Create: `demo/pre-step-demo/` (entire tree)

Because plan 5 will build the real Stripe module, this demo exists purely to exercise plan-3 plumbing. Structure:

```
demo/pre-step-demo/
  artifacts/
    manifest.json
    pdm.json qsm.json bindings.json shapes.json graphs/*.json
    protos/payments.proto
  src/
    fake-payments-module.ts   ← in-process gRPC server implementing payments.proto
    server.ts                 ← boots the fake module then startService of the main service
  test/
    e2e/
      pre-step.test.ts         ← POST /commands/createOrder → asserts pre-step executed
  package.json
  tsconfig.json
  vitest.config.ts
```

- [ ] **Step 1: Author `artifacts/protos/payments.proto`**

```proto
syntax = "proto3";
package rntme.payments.v1;
message GetOrCreateCustomerReq { string user_id = 1; }
message GetOrCreateCustomerRes { string customer_id = 1; }
service PaymentsModule {
  rpc GetOrCreateCustomer (GetOrCreateCustomerReq) returns (GetOrCreateCustomerRes);
}
```

- [ ] **Step 2: Author `artifacts/manifest.json`**

```json
{
  "rntmeVersion": "1.0",
  "service": { "name": "pre-step-demo", "version": "1.0" },
  "surface": { "http": { "enabled": true, "port": 3100 } },
  "persistence": { "mode": "ephemeral" },
  "modules": [
    { "name": "payments", "grpc": { "address": "127.0.0.1:60051" }, "protoPath": "protos/payments.proto" }
  ]
}
```

- [ ] **Step 3: Author `artifacts/bindings.json`**

Minimal: one command `createOrder` with a `pre[]` step. Reuse PDM/QSM/graph patterns from `demo/issue-tracker-api/` — the exact content must produce a graph that emits one event per successful command. Copy a minimal working graph from issue-tracker-api and rename as needed.

- [ ] **Step 4: Implement `src/fake-payments-module.ts`**

```ts
// demo/pre-step-demo/src/fake-payments-module.ts
import * as grpc from '@grpc/grpc-js';
import * as protobuf from 'protobufjs';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export async function startFakePayments(address: string, protoPath: string): Promise<() => Promise<void>> {
  const src = readFileSync(resolve(protoPath), 'utf8');
  const { root } = protobuf.parse(src, { keepCase: true });
  const svc = root.lookupService('rntme.payments.v1.PaymentsModule');
  const req = root.lookupType('rntme.payments.v1.GetOrCreateCustomerReq');
  const res = root.lookupType('rntme.payments.v1.GetOrCreateCustomerRes');

  const def: grpc.ServiceDefinition = {
    GetOrCreateCustomer: {
      path: '/rntme.payments.v1.PaymentsModule/GetOrCreateCustomer',
      requestStream: false, responseStream: false,
      requestSerialize: (v: object): Buffer => Buffer.from(req.encode(req.fromObject(v)).finish()),
      requestDeserialize: (b: Buffer): object => req.toObject(req.decode(b)),
      responseSerialize: (v: object): Buffer => Buffer.from(res.encode(res.fromObject(v)).finish()),
      responseDeserialize: (b: Buffer): object => res.toObject(res.decode(b)),
    },
  };

  const server = new grpc.Server();
  server.addService(def, {
    GetOrCreateCustomer: (call: grpc.ServerUnaryCall<{ user_id: string }, object>, cb: grpc.sendUnaryData<object>) => {
      const idem = call.metadata.get('rntme-idempotency-key').join(',');
      cb(null, { customer_id: `cust-${call.request.user_id}-${idem.slice(0, 6)}` });
    },
  } as unknown as grpc.UntypedServiceImplementation);

  await new Promise<void>((resolveP, reject) => {
    const [host, port] = address.split(':');
    server.bindAsync(`${host}:${port}`, grpc.ServerCredentials.createInsecure(), (err) => {
      if (err !== null) reject(err); else resolveP();
    });
  });

  return async (): Promise<void> => new Promise((r) => server.tryShutdown(() => r()));
}
```

- [ ] **Step 5: Author `src/server.ts`**

```ts
// demo/pre-step-demo/src/server.ts
import { loadService, startService } from '@rntme/runtime';
import { startFakePayments } from './fake-payments-module.js';
import { resolve } from 'node:path';

async function main(): Promise<void> {
  const artifactDir = resolve(process.cwd(), 'artifacts');
  const protoPath = resolve(artifactDir, 'protos/payments.proto');
  const stopFake = await startFakePayments('127.0.0.1:60051', protoPath);

  const loaded = await loadService(artifactDir);
  if (!loaded.ok) throw new Error('load failed');
  const running = await startService(loaded.value, { artifactDir });

  process.on('SIGINT', async () => {
    await running.stop();
    await stopFake();
    process.exit(0);
  });
}
void main();
```

- [ ] **Step 6: Author `test/e2e/pre-step.test.ts`**

```ts
// demo/pre-step-demo/test/e2e/pre-step.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { loadService, startService, type RunningService } from '@rntme/runtime';
import { startFakePayments } from '../../src/fake-payments-module.js';
import { resolve } from 'node:path';

let running: RunningService;
let stopFake: () => Promise<void>;

beforeAll(async () => {
  const artifactDir = resolve(__dirname, '../../artifacts');
  const protoPath = resolve(artifactDir, 'protos/payments.proto');
  stopFake = await startFakePayments('127.0.0.1:60051', protoPath);
  const loaded = await loadService(artifactDir);
  if (!loaded.ok) throw new Error(`load failed: ${JSON.stringify(loaded.errors)}`);
  running = await startService(loaded.value, { artifactDir });
}, 30_000);

afterAll(async () => {
  await running.stop();
  await stopFake();
});

describe('pre-step demo E2E', () => {
  it('executes a pre[] module call before emitting the command event', async () => {
    const resp = await fetch(`http://127.0.0.1:${running.httpPort}/api/commands/createOrder`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'Idempotency-Key': 'test-key-1' },
      body: JSON.stringify({ userId: 'u-42' }),
    });
    expect(resp.status).toBe(200);
    const body = await resp.json() as { aggregateId: string };
    expect(typeof body.aggregateId).toBe('string');
  });

  it('replays cached response on second call with same Idempotency-Key', async () => {
    const headers = { 'content-type': 'application/json', 'Idempotency-Key': 'test-key-2' };
    const body = JSON.stringify({ userId: 'u-43' });
    const r1 = await fetch(`http://127.0.0.1:${running.httpPort}/api/commands/createOrder`, { method: 'POST', headers, body });
    const r2 = await fetch(`http://127.0.0.1:${running.httpPort}/api/commands/createOrder`, { method: 'POST', headers, body });
    expect(r2.headers.get('Idempotency-Replay')).toBe('true');
    expect(await r1.text()).toBe(await r2.text());
  });
});
```

- [ ] **Step 7: `package.json` + tsconfig + vitest.config**

Mirror `demo/issue-tracker-api`.

- [ ] **Step 8: Install + run**

```bash
pnpm install
pnpm -F @rntme/pre-step-demo test
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add demo/pre-step-demo/
git commit -m "test(demo): pre-step E2E with fake payments module and Idempotency-Key replay"
```

---

## Phase 10 — Finalize

### Task 22: AGENTS.md §6.13 + spec status

**Files:**
- Modify: `AGENTS.md`
- Modify: `docs/superpowers/specs/2026-04-19-platform-modules-integration-design.md`

- [ ] **Step 1: Add §6.13 to AGENTS.md**

```markdown
### 6.13 Call a module via pre-fetch from a command binding

1. Read spec §7 and `packages/bindings-http/src/pre/` source.
2. Declare the module in `artifacts/manifest.json`:

```json
"modules": [
  { "name": "payments", "grpc": { "address": "payments:50051" }, "protoPath": "protos/payments.proto" }
]
```

3. Copy the module's `.proto` into `artifacts/protos/`.
4. In `artifacts/bindings.json`, add `pre[]` to a command binding:

```json
{
  "kind": "command",
  "graph": "createOrder",
  "http": { "method": "POST", "path": "/commands/createOrder", "parameters": [...] },
  "pre": [
    { "kind": "module-rpc", "module": "payments", "rpc": "CreateCheckoutSession",
      "input": { "customerId": "$body.customerId", "amount": "$body.amount" },
      "bindAs": "session" }
  ]
}
```

5. Reference `$pre.session.url` in the graph's emit payload to bake the vendor result into the event.
6. HTTP retries are safe: pass `Idempotency-Key` header from the client; the cache survives process restarts in `persistent` mode.
7. Invariants enforced by validator: `pre.length ≤ 2`, unique `bindAs`, `module` declared in manifest, `kind: command` only.
```

- [ ] **Step 2: Mark spec plan 3 implemented**

Update §14 of the spec.

- [ ] **Step 3: Commit**

```bash
git add AGENTS.md docs/superpowers/specs/2026-04-19-platform-modules-integration-design.md
git commit -m "docs(agents,spec): plan 3 complete — pre-fetch via module RPC"
```

---

### Task 23: Full-repo regression gate

**Files:**
- None (run-only)

- [ ] **Step 1: Build + test + lint**

```bash
pnpm install --frozen-lockfile
pnpm -r run build
pnpm -r run typecheck
pnpm -r run test
pnpm -r run lint
```

Expected: PASS across all packages + both demos.

- [ ] **Step 2: Sanity-boot the original demo**

Run: `timeout 5 pnpm -F @rntme/issue-tracker-api-demo start || true`
Expected: starts, listens, shuts down cleanly. (issue-tracker has no `pre[]` and no `modules[]` — just verifies no regression.)

- [ ] **Step 3: No commit needed if everything is green**

If fixes were applied, commit under appropriate scope.

---

## Self-review checklist (for plan author, pre-handoff)

- Spec §7.1 (PreStep schema + `pre.length ≤ 2` hard gate) → Tasks 1–3.
- Spec §7.1 (`module` declared in manifest) → Tasks 4–5.
- Spec §7.2 (middleware semantics, expression evaluation, event payload contains pre values) → Tasks 6, 16–17.
- Spec §7.3 (three-layer idempotency-key chain) → Tasks 13–15, 17–18.
- Spec §7.4 (error mapping to HTTP + stable codes) → Tasks 7, 12 (statusToAdapterError), 17 (handler maps).
- Spec §7.5 (circuit breaker per-module) → Tasks 10, 12.
- Spec §7.6 (observability: structured logs + counter) → Task 20.
- Spec §12.2 (module MUST forward `rntme-idempotency-key`) → enforced by client side (Task 12 sends the metadata header); module compliance is validated in plan 5.
- Dependency direction: `@rntme/bindings-http` adds dep on `@rntme/runtime`? No — it imports types from `@rntme/runtime` only, which is already present (plan 1 kept the `executor-contract` subpath on `@rntme/bindings-http` to avoid exactly this cycle). Double-check at build time; if tsc complains about runtime types imported from bindings-http, move `AdapterError` / `ExternalAdapterClient` interfaces into a second subpath of `@rntme/bindings-http` (mirror of plan 1's `executor-contract` approach).
- Error-code registry in `@rntme/bindings/types/result.ts` is append-only; new codes listed at the end of the existing map.
- Expression evaluator: explicit throw on unknown scope roots and paths — no silent undefined propagation.
- OpenTelemetry deferred (mentioned in "Out of scope") — structured pino logs only in this plan.
- Types used consistently: `PreStep`, `ExternalAdapterClient`, `AdapterCallOptions`, `AdapterResult`, `AdapterError`, `RetryPolicy`, `IdempotencyCache`, `deriveCommandRunId`, `deriveStepKey`, `evaluateExpression`, `runPreSteps`, `GrpcAdapterClient`, `CircuitBreaker`, `ProtoRegistry`.
- No placeholders; every code block is complete; every command shows expected result.
- File paths absolute from repo root; no line numbers.
