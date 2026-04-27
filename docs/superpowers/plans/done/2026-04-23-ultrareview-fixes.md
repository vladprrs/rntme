# Ultrareview Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve 13 findings from the 2026-04-23 ultrareview across gRPC surface, HTTP command handler, response rendering, and adapter client, with a regression test per finding, before merging `feat/platform-modules-integration-pr`.

**Architecture:** Four batches. Batch 1 lays shared foundations (error codes, type extensions, shared helpers, `errorToHttp`, `CachedResponse.headers`). Batch 2 fixes the gRPC surface (emitter + handler + query-map wiring). Batch 3 fixes the HTTP command handler and response renderer together (they share the cached-response headers contract). Batch 4 sweeps three singletons (adapter client, un-skip callback test, rename stale error code).

**Tech Stack:** TypeScript, Node 20, pnpm workspace, Vitest, Hono v4, @grpc/grpc-js, better-sqlite3, @rntme/graph-ir-compiler.

**Spec:** `docs/superpowers/specs/done/2026-04-23-ultrareview-fixes-design.md`

---

## File Map

**Modified:**
- `packages/bindings/src/types/result.ts` — add 3 new error codes, rename 1
- `packages/bindings/src/types/artifact.ts` — `pre[].bindAs` union; `allowedRedirectHosts`; redirect string constraint
- `packages/bindings/src/validate/structural.ts` — rename emission, 3 new checks, reserved shape name check
- `packages/bindings/src/validate/consistency.ts` — require `pick` for scalar inputs
- `packages/bindings-grpc/src/emit/ids.ts` — add `toSnakeCase` export
- `packages/bindings-grpc/src/emit/shapes.ts` — import shared `toSnakeCase`
- `packages/bindings-grpc/src/emit/service.ts` — import shared `toSnakeCase`
- `packages/bindings-grpc/src/emit/emit-proto.ts` — drop fixture-path prefix, always emit `CommandResult`
- `packages/bindings-grpc/src/server/handler.ts` — use `resolved.entry.graph`; snake→camel bridge
- `packages/bindings-http/src/idempotency/cache.ts` — `CachedResponse.headers?`
- `packages/bindings-http/src/idempotency/middleware.ts` — use cached headers on replay
- `packages/bindings-http/src/runtime/command-handler.ts` — big edit (C2.1/2.3/2.4/2.5, `c.redirect`)
- `packages/bindings-http/src/runtime/render-response.ts` — `encodeURIComponent`; `errorCode` arg; drop bare-`$` path
- `packages/bindings-http/src/startup/compile-plan.ts` — propagate `pre[].bindAs.pick`; expose `compiledQueries`; new `buildDefaultGraphIrQueryMap`
- `packages/bindings-http/src/index.ts` — re-export new helper
- `packages/runtime/src/start/start-service.ts` — wire `buildDefaultGraphIrQueryMap`
- `packages/runtime/src/plugins/adapter-client/grpc-adapter-client.ts` — regex-guarded `domainCode`

**Created:**
- `packages/bindings-http/src/runtime/error-to-http.ts` — shared `errorToHttp(code)` helper
- `packages/bindings-http/test/unit/error-to-http.test.ts`
- `packages/bindings-http/test/fixtures/callback-minimal/` (graph-IR spec + inline artifact)

**Touched tests:**
- `packages/bindings-grpc/test/unit/emit-proto.test.ts`
- `packages/bindings-grpc/test/integration/handler.test.ts` (new or extended)
- `packages/bindings-http/test/integration/callback-binding.test.ts`
- `packages/bindings-http/test/unit/render-response.test.ts`
- `packages/bindings-http/test/integration/command-handler.test.ts`
- `packages/bindings-http/test/unit/idempotency-middleware.test.ts`
- `packages/bindings/test/unit/structural.test.ts`
- `packages/runtime/test/integration/start-service.test.ts`
- `packages/runtime/test/unit/grpc-adapter-client.test.ts`

---

## Batch 1 — Shared Foundations

### Task 1: Error codes — add 3 new, rename 1

**Files:**
- Modify: `packages/bindings/src/types/result.ts`
- Modify: `packages/bindings/src/validate/structural.ts` (emission site for renamed code)

- [ ] **Step 1: Update `ERROR_CODES` in result.ts**

Replace the `BINDINGS_STRUCTURAL_RESPONSE_REDIRECT_ON_QUERY` entry with the renamed code, add three new codes at the end of the enum:

```typescript
export const ERROR_CODES = {
  // …existing entries unchanged…
  BINDINGS_STRUCTURAL_GET_COMMAND_WITHOUT_REDIRECT: 'BINDINGS_STRUCTURAL_GET_COMMAND_WITHOUT_REDIRECT',
  BINDINGS_STRUCTURAL_INPUT_FROM_BODY_ON_GET: 'BINDINGS_STRUCTURAL_INPUT_FROM_BODY_ON_GET',
  BINDINGS_STRUCTURAL_INPUT_FROM_DUPLICATE: 'BINDINGS_STRUCTURAL_INPUT_FROM_DUPLICATE',
  BINDINGS_CONSISTENCY_INPUT_FROM_UNKNOWN_INPUT: 'BINDINGS_CONSISTENCY_INPUT_FROM_UNKNOWN_INPUT',
  // --- new ---
  BINDINGS_STRUCTURAL_RESERVED_SHAPE_NAME: 'BINDINGS_STRUCTURAL_RESERVED_SHAPE_NAME',
  BINDINGS_STRUCTURAL_REDIRECT_ABSOLUTE_HOST_NOT_ALLOWED: 'BINDINGS_STRUCTURAL_REDIRECT_ABSOLUTE_HOST_NOT_ALLOWED',
  BINDINGS_STRUCTURAL_REDIRECT_STRING_CONTAINS_BARE_REFERENCE: 'BINDINGS_STRUCTURAL_REDIRECT_STRING_CONTAINS_BARE_REFERENCE',
} as const;
```

- [ ] **Step 2: Update the single emission site in structural.ts**

In `packages/bindings/src/validate/structural.ts` around line 155, replace `ERROR_CODES.BINDINGS_STRUCTURAL_RESPONSE_REDIRECT_ON_QUERY` with `ERROR_CODES.BINDINGS_STRUCTURAL_INPUT_FROM_BODY_ON_GET`.

- [ ] **Step 3: Search for any remaining references to the old code**

Run: `grep -rn "BINDINGS_STRUCTURAL_RESPONSE_REDIRECT_ON_QUERY" packages/`
Expected: no matches (both the enum and the emission site updated). If tests reference the old string literal, update them.

- [ ] **Step 4: Verify typecheck passes**

Run: `pnpm -F @rntme/bindings typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add packages/bindings/src/types/result.ts packages/bindings/src/validate/structural.ts
git commit -m "refactor(bindings): rename error code + register 3 new structural codes"
```

---

### Task 2: Extend artifact types for `pre[].bindAs.pick` and `allowedRedirectHosts`

**Files:**
- Modify: `packages/bindings/src/types/artifact.ts`
- Modify: `packages/bindings/src/types/input-from.ts` (for `ResponseShape.redirect` object form)

- [ ] **Step 1: Inspect `input-from.ts` to understand `ResponseShape` shape**

Run: `cat packages/bindings/src/types/input-from.ts`
Note the current `ResponseShape.onOk` / `onErr` shape and the current type for `branch.redirect` (currently `string | <expression-object>`).

- [ ] **Step 2: Extend `PreStep.bindAs` to accept object form**

In `packages/bindings/src/types/artifact.ts`, change the `bindAs: string` field on both `PreStep` variants to a union:

```typescript
export type PreStepBindAs = string | { name: string; pick?: string };

export type PreStep =
  | {
      kind: 'system';
      op: 'randomBytes';
      bytes: number;
      bindAs: PreStepBindAs;
    }
  | {
      kind: 'module-rpc';
      module: string;
      rpc: string;
      input: unknown;
      bindAs: PreStepBindAs;
      timeoutMs?: number;
      retry?: {
        attempts?: number;
        backoffMs?: 'exp' | number;
        retryOn?: 'never' | 'transient' | 'all';
      };
    };
```

Export a helper on the same file:

```typescript
export function bindAsName(b: PreStepBindAs): string {
  return typeof b === 'string' ? b : b.name;
}

export function bindAsPick(b: PreStepBindAs): string | null {
  return typeof b === 'string' ? null : (b.pick ?? null);
}
```

- [ ] **Step 3: Add `allowedRedirectHosts` to `BindingEntry`**

In the same file:

```typescript
export type BindingEntry = {
  kind?: BindingKind;
  graph: string;
  target: { engine: string; dialect: string };
  http: HttpBinding;
  pre?: PreStep[];
  inputFrom?: InputFromMap;
  response?: ResponseShape;
  allowedRedirectHosts?: string[];
};
```

- [ ] **Step 4: Tighten redirect value in `ResponseShape`**

In `packages/bindings/src/types/input-from.ts`, change the redirect field to the union `string | { expr: string | ExpressionObject }`. If the field is currently typed `string | ExpressionObject`, update it to `string | { expr: string | ExpressionObject }`. Keep existing callers compiling by adjusting any response-shape fixtures to wrap expression values in `{ expr: ... }` (grep for test fixtures with `redirect:` and an object form).

- [ ] **Step 5: Run typecheck across affected packages**

Run: `pnpm -F @rntme/bindings typecheck && pnpm -F @rntme/bindings-http typecheck && pnpm -F @rntme/bindings-grpc typecheck`
Expected: compilation errors at the consumer call sites that read `step.bindAs` directly. These are fixed in later tasks; the existing tests that construct `bindAs: 'foo'` continue to work because the string form is still accepted.

- [ ] **Step 6: Fix immediate consumer sites to compile**

Wherever TypeScript complains about `step.bindAs` being non-string, use `bindAsName(step.bindAs)`. Focus on: `packages/bindings/src/validate/structural.ts` (duplicate-bindAs check), `packages/bindings/src/validate/consistency.ts`, `packages/bindings-http/src/runtime/command-handler.ts`, `packages/bindings-http/src/startup/compile-plan.ts` and any other direct readers. Just get it compiling — no behavior change yet.

- [ ] **Step 7: Verify typecheck passes**

Run: `pnpm -r typecheck`
Expected: green.

- [ ] **Step 8: Commit**

```bash
git add packages/bindings/src/types/artifact.ts packages/bindings/src/types/input-from.ts \
        packages/bindings/src/validate/structural.ts packages/bindings/src/validate/consistency.ts \
        packages/bindings-http/src/runtime/command-handler.ts packages/bindings-http/src/startup/compile-plan.ts
git commit -m "feat(bindings): extend pre[].bindAs to {name,pick} + add allowedRedirectHosts"
```

---

### Task 3: Consolidate `toSnakeCase` in `bindings-grpc/emit/ids.ts`

**Files:**
- Modify: `packages/bindings-grpc/src/emit/ids.ts`
- Modify: `packages/bindings-grpc/src/emit/shapes.ts`
- Modify: `packages/bindings-grpc/src/emit/service.ts`
- Test: `packages/bindings-grpc/test/unit/ids.test.ts` (new)

- [ ] **Step 1: Write failing test for `toSnakeCase`**

Create `packages/bindings-grpc/test/unit/ids.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { toSnakeCase } from '../../src/emit/ids.js';

describe('toSnakeCase', () => {
  it('converts camelCase to snake_case', () => {
    expect(toSnakeCase('customerId')).toBe('customer_id');
    expect(toSnakeCase('orderLineItems')).toBe('order_line_items');
    expect(toSnakeCase('id')).toBe('id');
  });
  it('handles PascalCase', () => {
    expect(toSnakeCase('OrderLine')).toBe('order_line');
  });
  it('handles digits', () => {
    expect(toSnakeCase('userId42')).toBe('user_id42');
    expect(toSnakeCase('user42Name')).toBe('user42_name');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -F @rntme/bindings-grpc vitest run test/unit/ids.test.ts`
Expected: FAIL — `toSnakeCase` not exported from `ids.ts`.

- [ ] **Step 3: Add `toSnakeCase` to `ids.ts`**

In `packages/bindings-grpc/src/emit/ids.ts`, add (keeping existing `camelToPascal`):

```typescript
export function toSnakeCase(s: string): string {
  return s.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm -F @rntme/bindings-grpc vitest run test/unit/ids.test.ts`
Expected: PASS.

- [ ] **Step 5: Remove duplicated `toSnakeCase` in `shapes.ts`**

In `packages/bindings-grpc/src/emit/shapes.ts`, delete the local `toSnakeCase` function (around line 29) and add the import at the top:

```typescript
import { toSnakeCase } from './ids.js';
```

- [ ] **Step 6: Remove duplicated `toSnakeCase` in `service.ts`**

In `packages/bindings-grpc/src/emit/service.ts`, delete the local `toSnakeCase` function (around line 109) and add the import at the top:

```typescript
import { toSnakeCase } from './ids.js';
```

- [ ] **Step 7: Run the full bindings-grpc test suite**

Run: `pnpm -F @rntme/bindings-grpc test`
Expected: all tests green (golden proto outputs unchanged — we kept identical behavior).

- [ ] **Step 8: Commit**

```bash
git add packages/bindings-grpc/src/emit/ids.ts packages/bindings-grpc/src/emit/shapes.ts \
        packages/bindings-grpc/src/emit/service.ts packages/bindings-grpc/test/unit/ids.test.ts
git commit -m "refactor(bindings-grpc): consolidate toSnakeCase in emit/ids.ts"
```

---

### Task 4: `errorToHttp` shared helper

**Files:**
- Create: `packages/bindings-http/src/runtime/error-to-http.ts`
- Create: `packages/bindings-http/test/unit/error-to-http.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/bindings-http/test/unit/error-to-http.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { errorToHttp } from '../../src/runtime/error-to-http.js';

describe('errorToHttp', () => {
  it('maps COMMAND_GUARD_REJECTED → 422', () => {
    expect(errorToHttp('COMMAND_GUARD_REJECTED').status).toBe(422);
  });
  it('maps COMMAND_CONCURRENCY_CONFLICT → 409', () => {
    expect(errorToHttp('COMMAND_CONCURRENCY_CONFLICT').status).toBe(409);
  });
  it('maps COMMAND_NOT_FOUND → 500', () => {
    expect(errorToHttp('COMMAND_NOT_FOUND').status).toBe(500);
  });
  it('maps COMMAND_HANDLER_ERROR → 400', () => {
    expect(errorToHttp('COMMAND_HANDLER_ERROR').status).toBe(400);
  });
  it('maps COMMAND_HANDLER_THREW → 500', () => {
    expect(errorToHttp('COMMAND_HANDLER_THREW').status).toBe(500);
  });
  it('maps unknown codes → 500 and exposes the code', () => {
    const r = errorToHttp('SOME_UNKNOWN_CODE');
    expect(r.status).toBe(500);
    expect(r.exposeCode).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -F @rntme/bindings-http vitest run test/unit/error-to-http.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the helper**

Create `packages/bindings-http/src/runtime/error-to-http.ts`:

```typescript
export type ErrorHttpMapping = {
  status: number;
  /** When true, the response body should include `code`/`message` from the executor error (rather than an opaque internal-error body). */
  exposeCode: boolean;
};

const TABLE: Record<string, ErrorHttpMapping> = {
  COMMAND_GUARD_REJECTED: { status: 422, exposeCode: true },
  COMMAND_CONCURRENCY_CONFLICT: { status: 409, exposeCode: true },
  COMMAND_NOT_FOUND: { status: 500, exposeCode: true },
  COMMAND_HANDLER_ERROR: { status: 400, exposeCode: true },
  COMMAND_HANDLER_THREW: { status: 500, exposeCode: true },
};

export function errorToHttp(code: string): ErrorHttpMapping {
  return TABLE[code] ?? { status: 500, exposeCode: true };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm -F @rntme/bindings-http vitest run test/unit/error-to-http.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/bindings-http/src/runtime/error-to-http.ts packages/bindings-http/test/unit/error-to-http.test.ts
git commit -m "feat(bindings-http): add errorToHttp shared error→status helper"
```

---

### Task 5: Extend `CachedResponse` with optional `headers`

**Files:**
- Modify: `packages/bindings-http/src/idempotency/cache.ts`
- Test: `packages/bindings-http/test/unit/idempotency-cache.test.ts` (create or extend)

- [ ] **Step 1: Write failing test**

Create or extend `packages/bindings-http/test/unit/idempotency-cache.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { IdempotencyCache } from '../../src/idempotency/cache.js';

describe('IdempotencyCache roundtrip', () => {
  it('preserves headers across set/get', () => {
    const db = new Database(':memory:');
    const cache = new IdempotencyCache(db);
    cache.set(
      'cmd.x',
      'key-1',
      { status: 302, body: '', headers: { Location: '/next', 'X-Thing': 'v' } },
      1000,
    );
    const hit = cache.get('cmd.x', 'key-1', 1500);
    expect(hit).not.toBeNull();
    expect(hit!.status).toBe(302);
    expect(hit!.body).toBe('');
    expect(hit!.headers).toEqual({ Location: '/next', 'X-Thing': 'v' });
  });

  it('returns undefined headers when none were stored', () => {
    const db = new Database(':memory:');
    const cache = new IdempotencyCache(db);
    cache.set('cmd.y', 'key-2', { status: 200, body: '{"ok":true}' }, 1000);
    const hit = cache.get('cmd.y', 'key-2', 1500);
    expect(hit!.headers).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -F @rntme/bindings-http vitest run test/unit/idempotency-cache.test.ts`
Expected: FAIL — `headers` does not exist on CachedResponse.

- [ ] **Step 3: Extend cache.ts**

Replace the contents of `packages/bindings-http/src/idempotency/cache.ts`:

```typescript
import type BetterSqlite3 from 'better-sqlite3';

const TTL_MS = 24 * 3600 * 1000;

const DDL = `
CREATE TABLE IF NOT EXISTS idempotency_cache (
  command_name TEXT NOT NULL,
  key TEXT NOT NULL,
  status INTEGER NOT NULL,
  body TEXT NOT NULL,
  headers_json TEXT,
  stored_at INTEGER NOT NULL,
  PRIMARY KEY (command_name, key)
);
`;

const MIGRATE_ADD_HEADERS = `ALTER TABLE idempotency_cache ADD COLUMN headers_json TEXT`;

export type CachedResponse = {
  status: number;
  body: string;
  headers?: Record<string, string>;
};

export class IdempotencyCache {
  constructor(private readonly db: BetterSqlite3.Database) {
    db.exec(DDL);
    // Idempotent migration for existing DBs without the column.
    try {
      db.exec(MIGRATE_ADD_HEADERS);
    } catch {
      /* column already exists */
    }
  }

  set(commandName: string, key: string, response: CachedResponse, now: number): void {
    this.db.prepare(
      `INSERT OR REPLACE INTO idempotency_cache (command_name, key, status, body, headers_json, stored_at) VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      commandName,
      key,
      response.status,
      response.body,
      response.headers !== undefined ? JSON.stringify(response.headers) : null,
      now,
    );
  }

  get(commandName: string, key: string, now: number): CachedResponse | null {
    const row = this.db.prepare(
      `SELECT status, body, headers_json, stored_at FROM idempotency_cache WHERE command_name = ? AND key = ?`,
    ).get(commandName, key) as { status: number; body: string; headers_json: string | null; stored_at: number } | undefined;
    if (row === undefined) return null;
    if (now - row.stored_at > TTL_MS) return null;
    const out: CachedResponse = { status: row.status, body: row.body };
    if (row.headers_json !== null) out.headers = JSON.parse(row.headers_json) as Record<string, string>;
    return out;
  }

  pruneExpired(now: number): number {
    const result = this.db.prepare(
      `DELETE FROM idempotency_cache WHERE stored_at < ?`,
    ).run(now - TTL_MS);
    return result.changes;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm -F @rntme/bindings-http vitest run test/unit/idempotency-cache.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the full bindings-http test suite to catch regressions**

Run: `pnpm -F @rntme/bindings-http test`
Expected: green.

- [ ] **Step 6: Commit**

```bash
git add packages/bindings-http/src/idempotency/cache.ts packages/bindings-http/test/unit/idempotency-cache.test.ts
git commit -m "feat(bindings-http): cache response headers for idempotency replay"
```

---

## Batch 2 — Cluster C1 (gRPC Surface Correctness)

### Task 6: C1.4 — Remove fixture-path prefix from emitted proto

**Files:**
- Modify: `packages/bindings-grpc/src/emit/emit-proto.ts`
- Test: `packages/bindings-grpc/test/unit/emit-proto.test.ts`

- [ ] **Step 1: Add failing assertion to existing emit-proto test**

In `packages/bindings-grpc/test/unit/emit-proto.test.ts`, add:

```typescript
it('does not leak fixture path in the generated proto header', () => {
  const out = emitProto(validated, shapes, { packageName: 'x.y', serviceName: 'Svc' });
  expect(out).not.toContain('packages/bindings-grpc/test/fixtures/golden/minimal.proto');
});
```

(If the file doesn't exist, create it and import the fixtures the other tests use.)

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -F @rntme/bindings-grpc vitest run test/unit/emit-proto.test.ts`
Expected: FAIL — the output contains the fixture-path line.

- [ ] **Step 3: Remove the header composition in `emit-proto.ts`**

In `packages/bindings-grpc/src/emit/emit-proto.ts`, replace the last six lines (56-62) of `emitProto`:

```typescript
// OLD:
const [firstLine, ...rest] = parts;
const header = [
  '// packages/bindings-grpc/test/fixtures/golden/minimal.proto',
  firstLine,
  ...rest,
].join('\n');
return header;
```

with:

```typescript
return parts.join('\n');
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm -F @rntme/bindings-grpc vitest run test/unit/emit-proto.test.ts`
Expected: PASS.

- [ ] **Step 5: Regenerate any golden-proto fixtures**

If other tests use a golden fixture file (e.g. `packages/bindings-grpc/test/fixtures/golden/minimal.proto`) and they fail with a diff, regenerate the golden by running the fixture generator (or manually edit the file to remove the stray first line). Re-run the suite.

Run: `pnpm -F @rntme/bindings-grpc test`
Expected: green.

- [ ] **Step 6: Commit**

```bash
git add packages/bindings-grpc/src/emit/emit-proto.ts packages/bindings-grpc/test/unit/emit-proto.test.ts packages/bindings-grpc/test/fixtures/
git commit -m "fix(bindings-grpc): remove fixture-path comment from emitted proto"
```

---

### Task 7: C1.3 — `CommandResult` always emitted + reserved-name validator

**Files:**
- Modify: `packages/bindings-grpc/src/emit/emit-proto.ts`
- Modify: `packages/bindings/src/validate/structural.ts`
- Test: `packages/bindings-grpc/test/unit/emit-proto.test.ts`
- Test: `packages/bindings/test/unit/structural.test.ts`

- [ ] **Step 1: Write failing structural-validator test**

In `packages/bindings/test/unit/structural.test.ts` (or create a new file), add:

```typescript
it('rejects a binding that declares a shape named CommandResult', () => {
  const artifact = {
    version: '1.0',
    graphSpecRef: 'g',
    pdmRef: 'p',
    qsmRef: 'q',
    bindings: {
      createOrder: {
        kind: 'command',
        graph: 'createOrder',
        target: { engine: 'sqlite', dialect: 'rntme' },
        http: { method: 'POST', path: '/orders', parameters: [] },
        response: {
          onOk: { json: { $ref: 'CommandResult' } },
          onErr: { json: { message: 'bad' } },
        },
      },
    },
    shapes: { CommandResult: { fields: [{ name: 'x', type: { kind: 'scalar' as const, scalar: 'string' as const } }] } },
  };
  const parsed = parseBindingArtifact(artifact);
  if (!parsed.ok) throw new Error('parse unexpectedly failed');
  const res = validateStructural(parsed.value);
  expect(res.ok).toBe(false);
  if (res.ok) throw new Error();
  expect(res.errors.some((e) => e.code === 'BINDINGS_STRUCTURAL_RESERVED_SHAPE_NAME')).toBe(true);
});
```

(Adjust imports to match the file's style.)

- [ ] **Step 2: Write failing emit-proto test**

In `packages/bindings-grpc/test/unit/emit-proto.test.ts`, add:

```typescript
it('always emits CommandResult with command_id and correlation_id', () => {
  const out = emitProto(validated, shapes, { packageName: 'x.y', serviceName: 'Svc' });
  expect(out).toContain('message CommandResult {');
  expect(out).toContain('string command_id = 4;');
  expect(out).toContain('string correlation_id = 5;');
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm -F @rntme/bindings vitest run test/unit/structural.test.ts`
Run: `pnpm -F @rntme/bindings-grpc vitest run test/unit/emit-proto.test.ts`
Expected: both FAIL.

- [ ] **Step 4: Add structural check in `structural.ts`**

Find where the function receives `shapes: Record<string, ResolvedShape>` or equivalent on the parsed artifact. Add a block that iterates shape names and errors on `CommandResult`:

```typescript
const RESERVED_SHAPE_NAMES = new Set(['CommandResult']);

// … inside validateStructural, after other early checks:
for (const shapeName of Object.keys(artifact.shapes ?? {})) {
  if (RESERVED_SHAPE_NAMES.has(shapeName)) {
    errors.push({
      layer: 'structural',
      code: ERROR_CODES.BINDINGS_STRUCTURAL_RESERVED_SHAPE_NAME,
      message: `shape name "${shapeName}" is reserved`,
      path: `shapes.${shapeName}`,
    });
  }
}
```

(If the artifact's shapes live under a different key, adjust accordingly — grep for how existing code reads shapes.)

- [ ] **Step 5: Simplify `emit-proto.ts` to always emit `CommandResult`**

Replace the conditional block at lines 46-52:

```typescript
// OLD:
if (usesCommandResult) {
  const alreadyInShapes = Object.keys(shapes).some((n) => n === 'CommandResult');
  if (!alreadyInShapes) {
    parts.push(COMMAND_RESULT_BLOCK);
    parts.push('');
  }
}
```

with:

```typescript
if (usesCommandResult) {
  parts.push(COMMAND_RESULT_BLOCK);
  parts.push('');
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm -F @rntme/bindings vitest run test/unit/structural.test.ts`
Run: `pnpm -F @rntme/bindings-grpc vitest run test/unit/emit-proto.test.ts`
Expected: PASS.

- [ ] **Step 7: Run full suites for affected packages**

Run: `pnpm -F @rntme/bindings test && pnpm -F @rntme/bindings-grpc test`
Expected: green. Regenerate any golden-proto fixtures that now include the canonical block unconditionally.

- [ ] **Step 8: Commit**

```bash
git add packages/bindings/src/validate/structural.ts packages/bindings/test/unit/structural.test.ts \
        packages/bindings-grpc/src/emit/emit-proto.ts packages/bindings-grpc/test/unit/emit-proto.test.ts \
        packages/bindings-grpc/test/fixtures/
git commit -m "feat(bindings): reserve CommandResult shape name + always emit canonical block"
```

---

### Task 8: C1.2 — Handler uses `resolved.entry.graph` for command/query name

**Files:**
- Modify: `packages/bindings-grpc/src/server/handler.ts`
- Test: `packages/bindings-grpc/test/integration/handler.test.ts`

- [ ] **Step 1: Write failing test**

Create or extend `packages/bindings-grpc/test/integration/handler.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { makeGrpcHandler, type HandlerDeps } from '../../src/server/handler.js';

describe('makeGrpcHandler', () => {
  it('invokes the command executor with entry.graph, not bindingId', async () => {
    const execute = vi.fn().mockResolvedValue({
      ok: true,
      value: { aggregateId: 'a', version: 1, eventIds: [], commandId: 'c', correlationId: 'r' },
    });
    const deps = {
      commandExecutor: { execute },
      queryExecutor: { execute: vi.fn() },
      eventStore: {} as never,
      qsmDb: {} as never,
      now: () => '2026-04-23T00:00:00.000Z',
      nextId: () => 'id-1',
    } as unknown as HandlerDeps;

    const resolved = {
      entry: {
        kind: 'command',
        graph: 'createOrder',
        target: { engine: 'sqlite', dialect: 'rntme' },
        http: { method: 'POST', path: '/orders', parameters: [] },
      },
      signature: { id: 'createOrder', inputs: {}, output: { from: 'x', type: { kind: 'row', shape: 'CommandResult' } } },
      outputShape: { fields: [] },
    } as never;

    const handler = makeGrpcHandler('OrdersService_CreateOrder', resolved, deps);
    const call = { request: {}, metadata: { getMap: () => ({}) } } as never;
    const callback = vi.fn();
    await new Promise<void>((resolve) => {
      handler(call, (err, res) => { callback(err, res); resolve(); });
    });

    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute.mock.calls[0]![0].commandName).toBe('createOrder');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -F @rntme/bindings-grpc vitest run test/integration/handler.test.ts`
Expected: FAIL — `commandName` is `'OrdersService_CreateOrder'`, not `'createOrder'`.

- [ ] **Step 3: Fix the handler**

In `packages/bindings-grpc/src/server/handler.ts`, replace `bindingId` with `resolved.entry.graph` at both executor call sites (lines 47 and 66):

```typescript
// Line 47:
const out = await deps.commandExecutor.execute({ commandName: resolved.entry.graph, inputs: input, ctx });
// Line 66:
const qout = await deps.queryExecutor.execute({ queryName: resolved.entry.graph, inputs: input, ctx: qctx });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm -F @rntme/bindings-grpc vitest run test/integration/handler.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/bindings-grpc/src/server/handler.ts packages/bindings-grpc/test/integration/handler.test.ts
git commit -m "fix(bindings-grpc): handler passes entry.graph as command/query name"
```

---

### Task 9: C1.1 — snake_case→camelCase bridge at handler entry

**Files:**
- Modify: `packages/bindings-grpc/src/server/handler.ts`
- Test: `packages/bindings-grpc/test/integration/handler.test.ts`

- [ ] **Step 1: Write failing test**

Extend `packages/bindings-grpc/test/integration/handler.test.ts`:

```typescript
it('converts snake_case proto fields to camelCase graph inputs', async () => {
  const execute = vi.fn().mockResolvedValue({
    ok: true,
    value: { aggregateId: 'a', version: 1, eventIds: [], commandId: 'c', correlationId: 'r' },
  });
  const deps = {
    commandExecutor: { execute },
    queryExecutor: { execute: vi.fn() },
    eventStore: {} as never,
    qsmDb: {} as never,
    now: () => '2026-04-23T00:00:00.000Z',
    nextId: () => 'id-1',
  } as unknown as HandlerDeps;
  const resolved = {
    entry: {
      kind: 'command',
      graph: 'createOrder',
      target: { engine: 'sqlite', dialect: 'rntme' },
      http: { method: 'POST', path: '/orders', parameters: [] },
    },
    signature: {
      id: 'createOrder',
      inputs: { customerId: { type: { kind: 'scalar', scalar: 'string' } }, orderLineItems: { type: { kind: 'list' } } },
      output: { from: 'x', type: { kind: 'row', shape: 'CommandResult' } },
    },
    outputShape: { fields: [] },
  } as never;

  const handler = makeGrpcHandler('binding-id', resolved, deps);
  const call = {
    request: { customer_id: 'cust-1', order_line_items: [{ sku: 'S' }] },
    metadata: { getMap: () => ({}) },
  } as never;
  await new Promise<void>((resolve) => handler(call, () => resolve()));

  expect(execute.mock.calls[0]![0].inputs).toEqual({
    customerId: 'cust-1',
    orderLineItems: [{ sku: 'S' }],
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -F @rntme/bindings-grpc vitest run test/integration/handler.test.ts`
Expected: FAIL — inputs still snake_cased.

- [ ] **Step 3: Replace local `snakeCase` and add the bridge**

In `packages/bindings-grpc/src/server/handler.ts`:

1. Remove the local `function snakeCase(s: string)` at the bottom.
2. Add `import { toSnakeCase } from '../emit/ids.js';` at the top.
3. Add a helper above `makeGrpcHandler`:

```typescript
function buildInputs(
  request: Record<string, unknown>,
  inputNames: Iterable<string>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const name of inputNames) {
    const key = toSnakeCase(name);
    if (key in request) out[name] = request[key];
  }
  return out;
}
```

4. In `makeGrpcHandler`, replace `const input = call.request;` (line 30) with:

```typescript
const input = buildInputs(
  call.request as Record<string, unknown>,
  Object.keys(resolved.signature.inputs),
);
```

5. Replace the two `snakeCase(fromField)` call sites (line 75) with `toSnakeCase(fromField)`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm -F @rntme/bindings-grpc vitest run test/integration/handler.test.ts`
Expected: PASS.

- [ ] **Step 5: Run full bindings-grpc suite**

Run: `pnpm -F @rntme/bindings-grpc test`
Expected: green.

- [ ] **Step 6: Commit**

```bash
git add packages/bindings-grpc/src/server/handler.ts packages/bindings-grpc/test/integration/handler.test.ts
git commit -m "fix(bindings-grpc): snake→camel bridge at handler entry for executor inputs"
```

---

### Task 10: C1.5 — `buildDefaultGraphIrQueryMap` + wire in start-service

**Files:**
- Modify: `packages/bindings-http/src/startup/compile-plan.ts`
- Modify: `packages/bindings-http/src/index.ts`
- Modify: `packages/runtime/src/start/start-service.ts`
- Test: `packages/runtime/test/integration/start-service.test.ts`

- [ ] **Step 1: Write failing integration test**

Create or extend `packages/runtime/test/integration/start-service.test.ts`. Use a minimal fixture service that declares one query binding and assert it returns a result (not `QUERY_NOT_FOUND`) through both the HTTP surface and the gRPC handler.

Minimal sketch (adjust imports to match existing test harness):

```typescript
it('wires a compiled query map through GraphIrQueryExecutor', async () => {
  const svc = await startService(minimalFixtureServiceWithOneQuery);
  try {
    const resp = await svc.fetchHttp('/api/items');
    expect(resp.status).not.toBe(500);
    const body = await resp.json();
    expect(body).not.toMatchObject({ code: 'QUERY_NOT_FOUND' });
  } finally {
    await svc.stop();
  }
});
```

If no such test harness exists, use the bindings-http test pattern directly on `makeQueryHandler` with a `GraphIrQueryExecutor` constructed from `buildDefaultGraphIrQueryMap`.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -F @rntme/runtime vitest run test/integration/start-service.test.ts`
Expected: FAIL — query returns 500 with `QUERY_NOT_FOUND` because `queryExecutor` is constructed with `{}`.

- [ ] **Step 3: Expose a compiled-query map from `compile-plan.ts`**

In `packages/bindings-http/src/startup/compile-plan.ts`, extend `BuildPlanResult` and populate it:

```typescript
export type GraphIrQueryMapPublic = Record<string, QueryCompileResult>;

export type BuildPlanResult = {
  plans: Record<string, BindingPlan>;
  compiledCommands: GraphIrCommandMap;
  compiledQueries: GraphIrQueryMapPublic;
};
```

In `buildPlan`, populate:

```typescript
return {
  plans,
  compiledCommands: Object.fromEntries(commandCache),
  compiledQueries: Object.fromEntries(queryCache),
};
```

Add the public helper next to `buildDefaultGraphIrCommandMap`:

```typescript
export function buildDefaultGraphIrQueryMap(
  validated: ValidatedBindings,
  graphSpec: unknown,
  pdm: unknown,
  qsm: unknown,
): GraphIrQueryMapPublic {
  return buildPlan(validated, graphSpec, pdm, qsm).compiledQueries;
}
```

- [ ] **Step 4: Re-export from the package root**

In `packages/bindings-http/src/index.ts`, add:

```typescript
export { buildDefaultGraphIrQueryMap } from './startup/compile-plan.js';
```

- [ ] **Step 5: Wire in `start-service.ts`**

In `packages/runtime/src/start/start-service.ts`:

1. Change the import on line 20:

```typescript
import { buildDefaultGraphIrCommandMap, buildDefaultGraphIrQueryMap } from '@rntme/bindings-http';
```

2. Replace line 89:

```typescript
const defaultQueryMap = buildDefaultGraphIrQueryMap(
  service.bindings,
  service.graphSpec,
  service.pdm,
  service.qsm,
);
const queryExecutor = config.queryExecutor ?? new GraphIrQueryExecutor(defaultQueryMap);
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm -F @rntme/runtime vitest run test/integration/start-service.test.ts`
Expected: PASS.

- [ ] **Step 7: Run full runtime + bindings-http suites**

Run: `pnpm -F @rntme/bindings-http test && pnpm -F @rntme/runtime test`
Expected: green.

- [ ] **Step 8: Commit**

```bash
git add packages/bindings-http/src/startup/compile-plan.ts packages/bindings-http/src/index.ts \
        packages/runtime/src/start/start-service.ts packages/runtime/test/integration/start-service.test.ts
git commit -m "fix(runtime): wire GraphIrQueryExecutor with compiled query map"
```

---

## Batch 3 — Clusters C2 + C3 (HTTP Handler + Response Rendering)

### Task 11: C2.2 — Fix `c.redirect` signature

**Files:**
- Modify: `packages/bindings-http/src/runtime/command-handler.ts`
- Test: `packages/bindings-http/test/integration/command-handler.test.ts`

- [ ] **Step 1: Check the current Hono `c.redirect` signature**

Use context7:

```
mcp__plugin_context7_context7__resolve-library-id query="hono"
mcp__plugin_context7_context7__query-docs library_id=<resolved> query="c.redirect signature status code types"
```

Note the exact exported type (likely `RedirectStatusCode` or `StatusCode`) and whether `c.redirect(url, status)` is current.

- [ ] **Step 2: Write failing integration test**

In `packages/bindings-http/test/integration/command-handler.test.ts`, add:

```typescript
it('emits a valid 302 Response with Location header for redirect response shape', async () => {
  const { router } = await makeRouterWithBinding({
    method: 'POST',
    path: '/x',
    response: { onOk: { redirect: '/next' }, onErr: { json: {} } },
  });
  const r = await router.fetch(new Request('http://x/x', { method: 'POST', body: '{}' }));
  expect(r.status).toBe(302);
  expect(r.headers.get('Location')).toBe('/next');
});
```

(`makeRouterWithBinding` is a helper already used in the file; if not, pattern-match an existing test that builds a router.)

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm -F @rntme/bindings-http vitest run test/integration/command-handler.test.ts`
Expected: FAIL — either type error or incorrect response shape.

- [ ] **Step 4: Update the `c.redirect` call**

In `packages/bindings-http/src/runtime/command-handler.ts` near line 210, replace:

```typescript
return c.redirect(rendered.location, rendered.status as 302 | 303);
```

with the Hono v4 form (based on Step 1 findings; likely):

```typescript
import type { RedirectStatusCode } from 'hono/utils/http-status';
// …
return c.redirect(rendered.location, rendered.status as RedirectStatusCode);
```

If `RedirectStatusCode` is not a valid import path in the installed Hono version, fall back to `ContentfulStatusCode` or `StatusCode` as context7 reveals.

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm -F @rntme/bindings-http vitest run test/integration/command-handler.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/bindings-http/src/runtime/command-handler.ts packages/bindings-http/test/integration/command-handler.test.ts
git commit -m "fix(bindings-http): align c.redirect status typing with Hono v4"
```

---

### Task 12: C3.1 — `renderErrResponse` threads error code through `errorToHttp`

**Files:**
- Modify: `packages/bindings-http/src/runtime/render-response.ts`
- Modify: `packages/bindings-http/src/runtime/command-handler.ts` (call site)
- Test: `packages/bindings-http/test/unit/render-response.test.ts`

- [ ] **Step 1: Write failing unit tests**

In `packages/bindings-http/test/unit/render-response.test.ts`, add:

```typescript
import { renderErrResponse } from '../../src/runtime/render-response.js';

describe('renderErrResponse default status', () => {
  const shape = { onOk: { json: {} }, onErr: { json: { code: '$error.code' } } } as never;
  const scope = { result: null, error: { code: 'COMMAND_GUARD_REJECTED', message: 'nope' } };

  it('maps COMMAND_GUARD_REJECTED to 422', () => {
    const out = renderErrResponse(shape, scope, 'COMMAND_GUARD_REJECTED');
    expect(out.status).toBe(422);
  });
  it('maps COMMAND_CONCURRENCY_CONFLICT to 409', () => {
    const out = renderErrResponse(shape, scope, 'COMMAND_CONCURRENCY_CONFLICT');
    expect(out.status).toBe(409);
  });
  it('defaults unknown codes to 500', () => {
    const out = renderErrResponse(shape, scope, 'SOME_UNKNOWN_CODE');
    expect(out.status).toBe(500);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -F @rntme/bindings-http vitest run test/unit/render-response.test.ts`
Expected: FAIL — `renderErrResponse` does not accept a third argument; all results are 400.

- [ ] **Step 3: Update `render-response.ts`**

In `packages/bindings-http/src/runtime/render-response.ts`:

```typescript
import { errorToHttp } from './error-to-http.js';

export function renderErrResponse(shape: ResponseShape, scope: RenderScope, errorCode: string): RenderedResponse {
  const defaultStatus = errorToHttp(errorCode).status;
  return renderBranch(shape.onErr, scope, defaultStatus);
}
```

Leave `renderOkResponse` with its hardcoded `200` (OK statuses aren't error-code-derived).

- [ ] **Step 4: Update the caller in `command-handler.ts`**

Around line 207, change:

```typescript
const rendered = out.ok ? renderOkResponse(plan.response, scope) : renderErrResponse(plan.response, scope);
```

to:

```typescript
const rendered = out.ok
  ? renderOkResponse(plan.response, scope)
  : renderErrResponse(plan.response, scope, out.error.code);
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm -F @rntme/bindings-http vitest run test/unit/render-response.test.ts`
Expected: PASS.

- [ ] **Step 6: Run full bindings-http suite**

Run: `pnpm -F @rntme/bindings-http test`
Expected: green.

- [ ] **Step 7: Commit**

```bash
git add packages/bindings-http/src/runtime/render-response.ts packages/bindings-http/src/runtime/command-handler.ts packages/bindings-http/test/unit/render-response.test.ts
git commit -m "fix(bindings-http): renderErrResponse derives status from error code"
```

---

### Task 13: C2.5 — command-handler uses `errorToHttp` for error mapping

**Files:**
- Modify: `packages/bindings-http/src/runtime/command-handler.ts`
- Test: `packages/bindings-http/test/integration/command-handler.test.ts`

- [ ] **Step 1: Write failing tests**

In `packages/bindings-http/test/integration/command-handler.test.ts`, add:

```typescript
describe('command-handler error mapping', () => {
  const makeWithError = async (code: string) => {
    return makeRouterWithBinding({
      method: 'POST',
      path: '/cmd',
      executor: { execute: async () => ({ ok: false, error: { code, message: 'm' } }) },
    });
  };

  it('COMMAND_HANDLER_ERROR → 400 with code in body', async () => {
    const { router } = await makeWithError('COMMAND_HANDLER_ERROR');
    const r = await router.fetch(new Request('http://x/cmd', { method: 'POST', body: '{}' }));
    expect(r.status).toBe(400);
    const body = await r.json();
    expect(body).toMatchObject({ code: 'COMMAND_HANDLER_ERROR', message: 'm' });
  });

  it('COMMAND_HANDLER_THREW → 500 with code in body', async () => {
    const { router } = await makeWithError('COMMAND_HANDLER_THREW');
    const r = await router.fetch(new Request('http://x/cmd', { method: 'POST', body: '{}' }));
    expect(r.status).toBe(500);
    const body = await r.json();
    expect(body).toMatchObject({ code: 'COMMAND_HANDLER_THREW' });
  });

  it('unknown code → 500 with code in body', async () => {
    const { router } = await makeWithError('SOME_NOVEL_CODE');
    const r = await router.fetch(new Request('http://x/cmd', { method: 'POST', body: '{}' }));
    expect(r.status).toBe(500);
    const body = await r.json();
    expect(body).toMatchObject({ code: 'SOME_NOVEL_CODE' });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm -F @rntme/bindings-http vitest run test/integration/command-handler.test.ts`
Expected: FAIL — unknown codes return opaque `internalErrorBody`, and no code is surfaced.

- [ ] **Step 3: Replace the error-handling block in `command-handler.ts`**

Around lines 213-227, replace:

```typescript
if (!out.ok) {
  const code = out.error.code;
  if (code === 'COMMAND_GUARD_REJECTED') {
    return c.json(commandErrorBody({ code, message: out.error.message }), 422);
  }
  if (code === 'COMMAND_CONCURRENCY_CONFLICT') {
    return c.json(commandErrorBody({ code, message: out.error.message }), 409);
  }
  if (code === 'COMMAND_NOT_FOUND') {
    return c.json(commandErrorBody({ code, message: out.error.message }), 500);
  }
  deps.onError?.(out.error.detail ?? out.error, c);
  return c.json(internalErrorBody(), 500);
}
```

with:

```typescript
if (!out.ok) {
  const { status } = errorToHttp(out.error.code);
  if (out.error.code === 'COMMAND_HANDLER_THREW' || status === 500) {
    deps.onError?.(out.error.detail ?? out.error, c);
  }
  return c.json(
    commandErrorBody({ code: out.error.code, message: out.error.message }),
    status as 400 | 409 | 422 | 500,
  );
}
```

Add the import at the top:

```typescript
import { errorToHttp } from './error-to-http.js';
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm -F @rntme/bindings-http vitest run test/integration/command-handler.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/bindings-http/src/runtime/command-handler.ts packages/bindings-http/test/integration/command-handler.test.ts
git commit -m "fix(bindings-http): surface all command-handler error codes with correct status"
```

---

### Task 14: C3.2 Layer 1 — `encodeURIComponent` in `interpolateTemplate`

**Files:**
- Modify: `packages/bindings-http/src/runtime/render-response.ts`
- Test: `packages/bindings-http/test/unit/render-response.test.ts`

- [ ] **Step 1: Write failing injection test**

In `packages/bindings-http/test/unit/render-response.test.ts`, add:

```typescript
import { renderOkResponse } from '../../src/runtime/render-response.js';

describe('redirect template injection safety', () => {
  it('URL-encodes substitutions in the template', () => {
    const shape = {
      onOk: { redirect: '/oauth/callback?state={$result.state}' },
      onErr: { json: {} },
    } as never;
    const scope = { result: { state: '../admin?evil=1' }, error: null };
    const out = renderOkResponse(shape, scope);
    expect(out.kind).toBe('redirect');
    if (out.kind !== 'redirect') throw new Error();
    expect(out.location).toBe('/oauth/callback?state=..%2Fadmin%3Fevil%3D1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -F @rntme/bindings-http vitest run test/unit/render-response.test.ts`
Expected: FAIL — substitution is currently unescaped.

- [ ] **Step 3: Add encoding to `interpolateTemplate`**

In `packages/bindings-http/src/runtime/render-response.ts`, at line 48, change:

```typescript
return current === undefined || current === null ? '' : String(current);
```

to:

```typescript
return current === undefined || current === null ? '' : encodeURIComponent(String(current));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm -F @rntme/bindings-http vitest run test/unit/render-response.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/bindings-http/src/runtime/render-response.ts packages/bindings-http/test/unit/render-response.test.ts
git commit -m "fix(bindings-http): URL-encode redirect template substitutions"
```

---

### Task 15: C3.2 Layer 2 — `allowedRedirectHosts` validator + runtime guard

**Files:**
- Modify: `packages/bindings/src/validate/structural.ts`
- Modify: `packages/bindings-http/src/runtime/render-response.ts` (or a new `validate-redirect-target.ts`)
- Modify: `packages/bindings-http/src/runtime/command-handler.ts` (post-render check)
- Test: `packages/bindings/test/unit/structural.test.ts`
- Test: `packages/bindings-http/test/integration/command-handler.test.ts`

- [ ] **Step 1: Write failing validator test**

In `packages/bindings/test/unit/structural.test.ts`:

```typescript
it('rejects absolute redirect template without allowedRedirectHosts', () => {
  const artifact = {
    version: '1.0',
    graphSpecRef: 'g', pdmRef: 'p', qsmRef: 'q',
    bindings: {
      oauthCallback: {
        kind: 'command',
        graph: 'oauth',
        target: { engine: 'sqlite', dialect: 'rntme' },
        http: { method: 'GET', path: '/oauth/callback', parameters: [] },
        inputFrom: { state: { from: 'query', name: 'state' }, code: { from: 'query', name: 'code' } },
        response: { onOk: { redirect: 'https://evil.example.com/steal?t={$result.token}' }, onErr: { json: {} } },
      },
    },
  };
  const parsed = parseBindingArtifact(artifact);
  if (!parsed.ok) throw new Error();
  const r = validateStructural(parsed.value);
  expect(r.ok).toBe(false);
  if (r.ok) throw new Error();
  expect(r.errors.some((e) => e.code === 'BINDINGS_STRUCTURAL_REDIRECT_ABSOLUTE_HOST_NOT_ALLOWED')).toBe(true);
});

it('accepts absolute redirect when origin is in allowedRedirectHosts', () => {
  // Same artifact but with allowedRedirectHosts: ['https://good.example.com'] and the template on that host.
  // Expect r.ok === true (no redirect-host error).
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -F @rntme/bindings vitest run test/unit/structural.test.ts`
Expected: FAIL — no such check.

- [ ] **Step 3: Implement the structural check**

In `packages/bindings/src/validate/structural.ts`, add a helper and a check:

```typescript
function redirectTemplateTarget(redirect: unknown): string | null {
  if (typeof redirect !== 'string') return null;
  return redirect;
}

function isAbsoluteUrl(s: string): boolean {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(s);
}

function originOf(url: string): string | null {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

// Inside the per-binding structural loop:
const response = entry.response;
if (response !== undefined) {
  const okRedirect = redirectTemplateTarget((response.onOk as { redirect?: unknown } | undefined)?.redirect);
  const errRedirect = redirectTemplateTarget((response.onErr as { redirect?: unknown } | undefined)?.redirect);
  for (const tpl of [okRedirect, errRedirect]) {
    if (tpl !== null && isAbsoluteUrl(tpl)) {
      const origin = originOf(tpl);
      const allow = entry.allowedRedirectHosts ?? [];
      if (origin === null || !allow.includes(origin)) {
        errors.push({
          layer: 'structural',
          code: ERROR_CODES.BINDINGS_STRUCTURAL_REDIRECT_ABSOLUTE_HOST_NOT_ALLOWED,
          message: `binding "${id}": absolute redirect to "${origin ?? tpl}" is not in allowedRedirectHosts`,
          path: `bindings.${id}.response`,
        });
      }
    }
  }
}
```

- [ ] **Step 4: Run validator test to verify it passes**

Run: `pnpm -F @rntme/bindings vitest run test/unit/structural.test.ts`
Expected: PASS.

- [ ] **Step 5: Add runtime guard in the handler**

In `packages/bindings-http/src/runtime/command-handler.ts`, immediately before `return c.redirect(rendered.location, …)`, insert:

```typescript
if (rendered.kind === 'redirect' && /^[a-z][a-z0-9+.-]*:\/\//i.test(rendered.location)) {
  const origin = (() => {
    try { const u = new URL(rendered.location); return `${u.protocol}//${u.host}`; } catch { return null; }
  })();
  const allow = plan.entry.allowedRedirectHosts ?? [];
  if (origin === null || !allow.includes(origin)) {
    deps.logger.warn({ location: rendered.location }, 'refused absolute redirect outside allowlist');
    return c.json({ code: 'BINDINGS_RUNTIME_REDIRECT_HOST_NOT_ALLOWED', message: 'absolute redirect target is not permitted' }, 500);
  }
}
```

Add `BINDINGS_RUNTIME_REDIRECT_HOST_NOT_ALLOWED` to `ERROR_CODES` if not already present.

- [ ] **Step 6: Write failing runtime test**

In `packages/bindings-http/test/integration/command-handler.test.ts`:

```typescript
it('refuses absolute redirect outside allowedRedirectHosts at runtime', async () => {
  const { router } = await makeRouterWithBinding({
    method: 'POST', path: '/cb',
    response: { onOk: { redirect: '{$result.url}' }, onErr: { json: {} } },
    allowedRedirectHosts: ['https://good.example.com'],
    executor: { execute: async () => ({ ok: true, value: { url: 'https://evil.example.com/x' } }) },
  });
  const r = await router.fetch(new Request('http://x/cb', { method: 'POST', body: '{}' }));
  expect(r.status).toBe(500);
});
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `pnpm -F @rntme/bindings test && pnpm -F @rntme/bindings-http test`
Expected: green.

- [ ] **Step 8: Commit**

```bash
git add packages/bindings/src/validate/structural.ts packages/bindings/src/types/result.ts \
        packages/bindings-http/src/runtime/command-handler.ts \
        packages/bindings/test/unit/structural.test.ts packages/bindings-http/test/integration/command-handler.test.ts
git commit -m "feat(bindings): restrict absolute redirects to allowedRedirectHosts (validator + runtime)"
```

---

### Task 16: C3.3 — Reject bare `$` in string redirect; require object form for expressions

**Files:**
- Modify: `packages/bindings/src/validate/structural.ts`
- Modify: `packages/bindings-http/src/runtime/render-response.ts`
- Test: `packages/bindings/test/unit/structural.test.ts`
- Test: `packages/bindings-http/test/unit/render-response.test.ts`

- [ ] **Step 1: Write failing validator test**

In `packages/bindings/test/unit/structural.test.ts`:

```typescript
it('rejects string redirect containing bare $reference outside {}', () => {
  const artifact = {
    version: '1.0',
    graphSpecRef: 'g',
    pdmRef: 'p',
    qsmRef: 'q',
    bindings: {
      cb: {
        kind: 'command',
        graph: 'cb',
        target: { engine: 'sqlite', dialect: 'rntme' },
        http: { method: 'GET', path: '/cb', parameters: [] },
        inputFrom: { s: { from: 'query', name: 's' } },
        response: {
          onOk: { redirect: '$result.redirectUrl' },
          onErr: { json: {} },
        },
      },
    },
  };
  const parsed = parseBindingArtifact(artifact);
  if (!parsed.ok) throw new Error();
  const r = validateStructural(parsed.value);
  expect(r.ok).toBe(false);
  if (r.ok) throw new Error();
  expect(r.errors.some((e) => e.code === 'BINDINGS_STRUCTURAL_REDIRECT_STRING_CONTAINS_BARE_REFERENCE')).toBe(true);
});
```

- [ ] **Step 2: Write failing render-response test**

In `packages/bindings-http/test/unit/render-response.test.ts`:

```typescript
it('object-form redirect {expr} evaluates and redirects to the expression result', () => {
  const shape = {
    onOk: { redirect: { expr: '$result.url' } },
    onErr: { json: {} },
  } as never;
  const scope = { result: { url: '/next' }, error: null };
  const out = renderOkResponse(shape, scope);
  expect(out.kind).toBe('redirect');
  if (out.kind !== 'redirect') throw new Error();
  expect(out.location).toBe('/next');
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm -F @rntme/bindings vitest run test/unit/structural.test.ts`
Run: `pnpm -F @rntme/bindings-http vitest run test/unit/render-response.test.ts`
Expected: both FAIL.

- [ ] **Step 4: Add structural check**

In `packages/bindings/src/validate/structural.ts`, extend the per-binding redirect validation:

```typescript
function containsBareReference(tpl: string): boolean {
  // Any `$name` not immediately preceded by `{` and followed by `}` is bare.
  return /(^|[^{])\$[a-zA-Z0-9_.]+/.test(tpl);
}

// Inside the response check loop:
for (const tpl of [okRedirect, errRedirect]) {
  if (tpl !== null && containsBareReference(tpl)) {
    errors.push({
      layer: 'structural',
      code: ERROR_CODES.BINDINGS_STRUCTURAL_REDIRECT_STRING_CONTAINS_BARE_REFERENCE,
      message: `binding "${id}": string redirect contains bare "$reference" — use object form { expr: "..." }`,
      path: `bindings.${id}.response`,
      hint: 'Replace `redirect: "$result.url"` with `redirect: { expr: "$result.url" }`.',
    });
  }
}
```

- [ ] **Step 5: Update render-response to handle object form**

In `packages/bindings-http/src/runtime/render-response.ts`, change the redirect branch inside `renderBranch`:

```typescript
const locRaw = branch.redirect;
let location: string;
if (typeof locRaw === 'string') {
  location = interpolateTemplate(locRaw, scope);
} else if (locRaw !== null && typeof locRaw === 'object' && 'expr' in locRaw) {
  location = String(evaluateExpression((locRaw as { expr: unknown }).expr, toExprScope(scope)));
} else {
  throw new Error('invalid redirect form');
}
return { kind: 'redirect', status: branch.status ?? 302, location };
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm -F @rntme/bindings vitest run test/unit/structural.test.ts`
Run: `pnpm -F @rntme/bindings-http vitest run test/unit/render-response.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/bindings/src/validate/structural.ts packages/bindings/test/unit/structural.test.ts \
        packages/bindings-http/src/runtime/render-response.ts packages/bindings-http/test/unit/render-response.test.ts
git commit -m "feat(bindings): require object form {expr} for expression redirects"
```

---

### Task 17: C2.3 — Scope alignment for body / form / header / query in inputFrom branch

**Files:**
- Modify: `packages/bindings-http/src/runtime/command-handler.ts`
- Test: `packages/bindings-http/test/integration/command-handler.test.ts`

- [ ] **Step 1: Write failing tests**

In `packages/bindings-http/test/integration/command-handler.test.ts`:

```typescript
it('POST form binding exposes form values via $form.X in response template', async () => {
  const { router } = await makeRouterWithBinding({
    method: 'POST', path: '/form',
    contentType: 'application/x-www-form-urlencoded',
    inputFrom: { username: { from: 'form', name: 'u' } },
    response: { onOk: { json: { got: '{$form.u}' } }, onErr: { json: {} } },
    executor: { execute: async () => ({ ok: true, value: { aggregateId: 'a', version: 1, eventIds: [], commandId: 'c', correlationId: 'r' } }) },
  });
  const body = new URLSearchParams({ u: 'alice' }).toString();
  const r = await router.fetch(new Request('http://x/form', { method: 'POST', body, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }));
  expect(r.status).toBe(200);
  expect(await r.json()).toEqual({ got: 'alice' });
});

it('GET callback binding exposes query via $query.X', async () => {
  const { router } = await makeRouterWithBinding({
    method: 'GET', path: '/cb',
    inputFrom: { state: { from: 'query', name: 'state' } },
    response: { onOk: { json: { echoed: '{$query.state}' } }, onErr: { json: {} } },
    executor: { execute: async () => ({ ok: true, value: {} }) },
  });
  const r = await router.fetch(new Request('http://x/cb?state=abc'));
  const body = await r.json();
  expect(body).toEqual({ echoed: 'abc' });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm -F @rntme/bindings-http vitest run test/integration/command-handler.test.ts`
Expected: FAIL — `$form.u` resolves to empty; `$query.state` may work or may not depending on how scope is currently constructed.

- [ ] **Step 3: Rewrite the scope construction in `command-handler.ts`**

Replace lines 120-132 (scope construction) with, in the `hasInputFrom` branch only, a scope that mirrors `req`:

```typescript
const scope = hasInputFrom
  ? {
      body: (req.body ?? {}) as Record<string, unknown>,
      form: (req.form ?? {}) as Record<string, unknown>,
      query: Object.fromEntries(new URL(c.req.url).searchParams.entries()),
      auth: { userId: (deps.actorFromRequest(c) as { id?: string } | null)?.id ?? null },
      config: {},
    }
  : {
      body: bodyValues,
      query: queryData,
      auth: { userId: (deps.actorFromRequest(c) as { id?: string } | null)?.id ?? null },
      config: {},
    };
```

Note: the `hasInputFrom` branch sets `req` inside a block (line 75-80 of current code). Move the `const req = …` declaration out so it's in scope where the `scope` is built. (Restructure is straightforward — `req` is only used inside the `hasInputFrom` branch; declare it at a wider scope as `let req: … | null = null` set inside the `if (hasInputFrom)` block, then consumed by the scope build.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm -F @rntme/bindings-http vitest run test/integration/command-handler.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/bindings-http/src/runtime/command-handler.ts packages/bindings-http/test/integration/command-handler.test.ts
git commit -m "fix(bindings-http): surface body/form/query/header consistently in response scope"
```

---

### Task 18: C2.4 — Explicit `pre[].bindAs.pick` selector, remove flatten heuristic

**Files:**
- Modify: `packages/bindings-http/src/runtime/command-handler.ts`
- Modify: `packages/bindings-http/src/startup/compile-plan.ts`
- Modify: `packages/bindings/src/validate/consistency.ts`
- Test: `packages/bindings-http/test/integration/command-handler.test.ts`
- Test: `packages/bindings/test/unit/consistency.test.ts`

- [ ] **Step 1: Write failing handler tests**

In `packages/bindings-http/test/integration/command-handler.test.ts`:

```typescript
it('pre-step bindAs: {name, pick} extracts inner field', async () => {
  const { router } = await makeRouterWithBinding({
    method: 'POST', path: '/p',
    pre: [{ kind: 'module-rpc', module: 'fake', rpc: 'r', input: {}, bindAs: { name: 'customerId', pick: 'id' } }],
    executor: { execute: async ({ inputs }) => {
      expect((inputs as Record<string, unknown>).customerId).toBe('C-1');
      return { ok: true, value: {} };
    } },
    adapterClient: { moduleRpc: async () => ({ ok: true, value: { id: 'C-1', meta: 'x' } }) },
  });
  const r = await router.fetch(new Request('http://x/p', { method: 'POST', body: '{}' }));
  expect(r.status).toBe(200);
});

it('pre-step bindAs: "name" (bare string) binds the whole result', async () => {
  const { router } = await makeRouterWithBinding({
    method: 'POST', path: '/p2',
    pre: [{ kind: 'module-rpc', module: 'fake', rpc: 'r', input: {}, bindAs: 'customer' }],
    executor: { execute: async ({ inputs }) => {
      expect((inputs as Record<string, unknown>).customer).toEqual({ id: 'C-1', meta: 'x' });
      return { ok: true, value: {} };
    } },
    adapterClient: { moduleRpc: async () => ({ ok: true, value: { id: 'C-1', meta: 'x' } }) },
  });
  const r = await router.fetch(new Request('http://x/p2', { method: 'POST', body: '{}' }));
  expect(r.status).toBe(200);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm -F @rntme/bindings-http vitest run test/integration/command-handler.test.ts`
Expected: FAIL — current handler uses flatten heuristic; second test likely passes only by accident, first test fails because `pick` is ignored.

- [ ] **Step 3: Propagate `pick` in `compile-plan.ts`**

In `packages/bindings-http/src/startup/compile-plan.ts`, line 145 currently passes `pre: entry.pre ?? []`. Transform it to a compiled form that captures `pick`:

```typescript
type CompiledPreStep = (PreStep & { bindName: string; bindPick: string | null });

function compilePre(pre: PreStep[]): CompiledPreStep[] {
  return pre.map((step) => ({
    ...step,
    bindName: bindAsName(step.bindAs),
    bindPick: bindAsPick(step.bindAs),
  }));
}
```

Change line 145 to `pre: compilePre(entry.pre ?? [])`. Adjust the `BindingPlan` type for `pre` accordingly. Import `bindAsName`/`bindAsPick` from `@rntme/bindings/types/artifact.js`.

- [ ] **Step 4: Remove the heuristic from `command-handler.ts`**

Replace lines 159-188 (the `flattened` loop) with:

```typescript
const flattened: Record<string, unknown> = {};
for (const step of plan.pre) {
  const raw = preResult.systemFields[step.bindName];
  const value = step.bindPick === null
    ? raw
    : (raw !== null && typeof raw === 'object' && !Array.isArray(raw)
        ? (raw as Record<string, unknown>)[step.bindPick]
        : undefined);
  flattened[step.bindName] = value;
}
graphInputs = { ...graphInputs, ...flattened };
```

(Adjust how `preResult.systemFields` is keyed — if pre-step results live under a nested `pre` key, unwrap that first. The exact shape is visible in `runPreSteps`' return; match it.)

- [ ] **Step 5: Add the consistency check**

In `packages/bindings/src/validate/consistency.ts`, add:

```typescript
// For each pre step, if the target graph input is declared scalar and the step returns a structured shape, `pick` is required.
for (const step of (entry.pre ?? [])) {
  const name = bindAsName(step.bindAs);
  const pick = bindAsPick(step.bindAs);
  const target = signature.inputs[name];
  if (target === undefined) continue;
  const isScalarTarget = target.type.kind === 'scalar';
  const stepReturnsStruct = step.kind === 'module-rpc'; // module RPCs always return a structured envelope
  if (isScalarTarget && stepReturnsStruct && pick === null) {
    errors.push({
      layer: 'consistency',
      code: ERROR_CODES.BINDINGS_CONSISTENCY_PRE_MODULE_NOT_DECLARED, // reuse or add a new code if more specific fits
      message: `binding "${id}": pre-step binds to scalar "${name}" without pick — specify bindAs: { name: "${name}", pick: "<field>" }`,
      path: `bindings.${id}.pre`,
    });
  }
}
```

If a dedicated code is preferred, add `BINDINGS_CONSISTENCY_PRE_SCALAR_REQUIRES_PICK` to `ERROR_CODES` in Task 1 and reference it here. (If adding now, append to `ERROR_CODES` and update the test in Step 6.)

- [ ] **Step 6: Write failing consistency test**

In `packages/bindings/test/unit/consistency.test.ts`, add a test that constructs a binding with `pre: [{ kind: 'module-rpc', …, bindAs: 'customerId' }]` where `customerId` is a scalar graph input, expecting the new error code.

- [ ] **Step 7: Run all three test files**

Run: `pnpm -F @rntme/bindings-http vitest run test/integration/command-handler.test.ts`
Run: `pnpm -F @rntme/bindings vitest run test/unit/consistency.test.ts`
Expected: PASS.

- [ ] **Step 8: Run full suite**

Run: `pnpm -F @rntme/bindings test && pnpm -F @rntme/bindings-http test`
Expected: green.

- [ ] **Step 9: Commit**

```bash
git add packages/bindings-http/src/runtime/command-handler.ts packages/bindings-http/src/startup/compile-plan.ts \
        packages/bindings/src/validate/consistency.ts packages/bindings/test/unit/consistency.test.ts \
        packages/bindings-http/test/integration/command-handler.test.ts
git commit -m "feat(bindings): replace pre-step flatten heuristic with explicit pick selector"
```

---

### Task 19: C2.1 + C3.4 — Hoist cache write above response-shape branch; middleware uses cached headers

**Files:**
- Modify: `packages/bindings-http/src/runtime/command-handler.ts`
- Modify: `packages/bindings-http/src/idempotency/middleware.ts`
- Test: `packages/bindings-http/test/integration/command-handler.test.ts`
- Test: `packages/bindings-http/test/unit/idempotency-middleware.test.ts`

- [ ] **Step 1: Write failing replay tests**

In `packages/bindings-http/test/integration/command-handler.test.ts`:

```typescript
it('caches and replays a redirect response-shape binding', async () => {
  const calls: unknown[] = [];
  const { router } = await makeRouterWithBinding({
    method: 'POST', path: '/cb',
    idempotency: true,
    response: { onOk: { redirect: '/next' }, onErr: { json: {} } },
    executor: { execute: async (x) => { calls.push(x); return { ok: true, value: {} }; } },
  });
  const key = 'k1';
  const r1 = await router.fetch(new Request('http://x/cb', { method: 'POST', body: '{}', headers: { 'Idempotency-Key': key } }));
  const r2 = await router.fetch(new Request('http://x/cb', { method: 'POST', body: '{}', headers: { 'Idempotency-Key': key } }));
  expect(r1.status).toBe(302);
  expect(r1.headers.get('Location')).toBe('/next');
  expect(r2.status).toBe(302);
  expect(r2.headers.get('Location')).toBe('/next');
  expect(r2.headers.get('Idempotency-Replay')).toBe('true');
  expect(calls.length).toBe(1); // executor invoked only once
});

it('caches and replays a JSON response-shape binding', async () => {
  // Similar, assert JSON body matches across r1/r2 and executor called once.
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm -F @rntme/bindings-http vitest run test/integration/command-handler.test.ts`
Expected: FAIL — executor called twice because cache write is skipped.

- [ ] **Step 3: Hoist the cache write in `command-handler.ts`**

Change the response-shape branch (lines 204-211) to cache before returning:

```typescript
// Render response using response shape if present
if (plan.response !== null) {
  const scope = out.ok
    ? { result: out.value, error: null }
    : { result: null, error: out.error };
  const rendered = out.ok
    ? renderOkResponse(plan.response, scope)
    : renderErrResponse(plan.response, scope, out.error.code);

  if (out.ok && deps.idempotencyCache !== undefined && clientKey !== null) {
    if (rendered.kind === 'json') {
      deps.idempotencyCache.set(
        plan.commandName,
        clientKey,
        { status: rendered.status, body: JSON.stringify(rendered.body) },
        Date.now(),
      );
    } else {
      deps.idempotencyCache.set(
        plan.commandName,
        clientKey,
        {
          status: rendered.status,
          body: '',
          headers: { Location: rendered.location },
        },
        Date.now(),
      );
    }
  }

  // absolute-redirect runtime guard (from Task 15) goes here…

  if (rendered.kind === 'json') {
    return c.json(rendered.body, rendered.status as 200 | 201 | 400 | 409 | 422 | 500);
  }
  return c.redirect(rendered.location, rendered.status as RedirectStatusCode);
}
```

Leave the existing plain-OK cache write (lines 229-232) for response-less bindings as-is.

- [ ] **Step 4: Update middleware to use cached headers**

In `packages/bindings-http/src/idempotency/middleware.ts` lines 26-30, replace the replay with:

```typescript
if (hit !== null) {
  const headers = {
    ...(hit.headers ?? { 'Content-Type': 'application/json' }),
    'Idempotency-Replay': 'true',
  };
  return c.body(
    hit.body,
    hit.status as 200 | 201 | 302 | 303 | 400 | 409 | 422 | 500 | 502 | 503 | 504,
    headers,
  );
}
```

- [ ] **Step 5: Write failing middleware unit test**

In `packages/bindings-http/test/unit/idempotency-middleware.test.ts`:

```typescript
it('replays a cached redirect with Location header', async () => {
  const db = new Database(':memory:');
  const cache = new IdempotencyCache(db);
  cache.set('cmd.cb', 'k1', { status: 302, body: '', headers: { Location: '/next' } }, Date.now());
  const app = new Hono();
  app.use('/cb', idempotencyMiddleware({ cache, now: Date.now, commandNameFromPath: () => 'cmd.cb' }));
  app.post('/cb', (c) => c.json({ never: 'reached' }));
  const r = await app.fetch(new Request('http://x/cb', { method: 'POST', body: '', headers: { 'Idempotency-Key': 'k1' } }));
  expect(r.status).toBe(302);
  expect(r.headers.get('Location')).toBe('/next');
  expect(r.headers.get('Idempotency-Replay')).toBe('true');
});
```

- [ ] **Step 6: Run all tests**

Run: `pnpm -F @rntme/bindings-http test`
Expected: green.

- [ ] **Step 7: Commit**

```bash
git add packages/bindings-http/src/runtime/command-handler.ts packages/bindings-http/src/idempotency/middleware.ts \
        packages/bindings-http/test/integration/command-handler.test.ts packages/bindings-http/test/unit/idempotency-middleware.test.ts
git commit -m "fix(bindings-http): cache response-shape output before rendering; replay preserves headers"
```

---

## Batch 4 — Clusters C4 + C5 + C6 (Singletons)

### Task 20: C4 — Regex-guarded domainCode extraction

**Files:**
- Modify: `packages/runtime/src/plugins/adapter-client/grpc-adapter-client.ts`
- Test: `packages/runtime/test/unit/grpc-adapter-client.test.ts`

- [ ] **Step 1: Write failing tests**

In `packages/runtime/test/unit/grpc-adapter-client.test.ts` (create if missing):

```typescript
import { describe, it, expect } from 'vitest';
import { statusToAdapterError } from '../../src/plugins/adapter-client/grpc-adapter-client.js';
import * as grpc from '@grpc/grpc-js';

describe('statusToAdapterError domainCode extraction', () => {
  it('extracts domainCode from DOMAIN_CODE: message format', () => {
    const e = statusToAdapterError(grpc.status.INVALID_ARGUMENT, 'LIMIT_EXCEEDED: too many');
    expect(e.code).toBe('EXTERNAL_VENDOR_DOMAIN');
    expect((e as { domainCode?: string }).domainCode).toBe('LIMIT_EXCEEDED');
  });
  it('does not extract domainCode from plain English messages', () => {
    const e = statusToAdapterError(grpc.status.NOT_FOUND, 'resource not found');
    expect((e as { domainCode?: string }).domainCode).toBeUndefined();
  });
  it('does not extract domainCode from empty messages', () => {
    const e = statusToAdapterError(grpc.status.ALREADY_EXISTS, '');
    expect((e as { domainCode?: string }).domainCode).toBeUndefined();
  });
});
```

Ensure `statusToAdapterError` is exported from the module (add `export` if private).

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm -F @rntme/runtime vitest run test/unit/grpc-adapter-client.test.ts`
Expected: FAIL — domainCode set to full message or "resource not found".

- [ ] **Step 3: Fix the extraction**

In `packages/runtime/src/plugins/adapter-client/grpc-adapter-client.ts` around line 146:

```typescript
const match = /^([A-Z][A-Z0-9_]+):\s*/.exec(message);
const domainCode = match?.[1];
return {
  code: 'EXTERNAL_VENDOR_DOMAIN',
  message,
  ...(domainCode !== undefined ? { domainCode } : {}),
  httpStatus: httpMap[status] ?? 502,
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm -F @rntme/runtime vitest run test/unit/grpc-adapter-client.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/runtime/src/plugins/adapter-client/grpc-adapter-client.ts packages/runtime/test/unit/grpc-adapter-client.test.ts
git commit -m "fix(runtime): only extract domainCode from DOMAIN_CODE: prefix format"
```

---

### Task 21: C5 — Un-skip callback-binding integration test with inline graph fixture

**Files:**
- Modify: `packages/bindings-http/test/integration/callback-binding.test.ts`
- Create: `packages/bindings-http/test/fixtures/callback-minimal/graph-spec.ts` (or inline in the test)

- [ ] **Step 1: Author the minimal graph-IR fixture**

Create or inline a graph-IR spec that:
- Declares one graph `oauthCallback` with two inputs (`state: string`, `code: string`).
- Output shape `CommandResult` (reuse the canonical).
- A stub command effect that simply echoes `state` into a `redirectUrl` field via the output.

Concrete structure depends on the existing graph-IR test utilities — grep for how other integration tests in `bindings-http` construct minimal graph specs. Match that pattern.

- [ ] **Step 2: Un-skip the test**

In `packages/bindings-http/test/integration/callback-binding.test.ts` line 110, change `describe.skip(` to `describe(`.

- [ ] **Step 3: Wire the fixture into the test setup**

Replace the stubbed `graphSpec` reference in the test with the actual inline fixture from Step 1. Ensure the `validated()` helper (line 100) produces a binding whose `entry.graph` matches the fixture's graph ID.

- [ ] **Step 4: Adjust assertions for post-C2/C3 behavior**

- 302 with `Location` header (from Task 11 + Task 17 + Task 19).
- Error path: e.g. `COMMAND_GUARD_REJECTED` returns 422 with body `{code, message}` (from Task 13).
- Add a replay test: two GETs with the same `Idempotency-Key` return identical `Location` (from Task 19).

- [ ] **Step 5: Run the suite**

Run: `pnpm -F @rntme/bindings-http vitest run test/integration/callback-binding.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/bindings-http/test/integration/callback-binding.test.ts packages/bindings-http/test/fixtures/callback-minimal/
git commit -m "test(bindings-http): un-skip P2 callback integration with inline graph fixture"
```

---

## Post-plan verification

- [ ] **Run the full workspace test suite**

```bash
pnpm -r run typecheck
pnpm -r run lint
pnpm -r run test
```

Expected: all green.

- [ ] **Confirm no ultrareview finding is unaddressed**

Walk the spec's "In scope" list and tick each finding against its task. If any is missing, add a follow-up task before calling the plan complete.

- [ ] **Update the PR description**

Summarize the 13 fixes and link the spec + this plan.
