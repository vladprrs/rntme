> Status: historical.
> Date: unknown.
> Current source: docs/current/**, docs/decision-system.md, and current code/tests.
> Why retained: Historical rationale and execution context retained for review; it is not current-state truth by itself.

# Extended Command Binding for P2 Callbacks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. User preference: **skip plan-internal review checkpoints during execution**; run to completion autonomously.

**Depends on:** Plans 1, 2, 3. Uses the `CommandExecutor` seam, gRPC transport, pre-fetch middleware, expression evaluator, and idempotency cache already shipped.

**Goal:** Enable rntme services to host **vendor-callback endpoints** (OAuth redirects, hosted-checkout returns, magic-link clicks, SAML callbacks) as first-class command bindings. Three additions to the `command` binding-kind: `method: "GET" | "POST"` relaxation, `inputFrom` extraction map (query / header / form / body-path), and `response.onOk` / `response.onErr` shape (JSON body OR 302/303 redirect with template substitution). No new binding-kind; no new primitive — just three optional fields that compose with the existing `pre[]` + executor pipeline.

**Architecture:** `@rntme/bindings` extends the artifact schema with `inputFrom` (Record<graphInputName, InputSource>) and `response` (OkBranch | ErrBranch each with `json`-template or `redirect`-template). Structural validation loosens the "commands are POST-only" rule when `response.redirect` is declared, forbids query body/header mixing invalid per HTTP, and checks that every `inputFrom` key maps to an existing graph-input name. `@rntme/bindings-http` gets an `extract-inputs.ts` helper that reads values from the right HTTP source, a `render-response.ts` helper that emits JSON or 302/303 with template-resolved URLs, and wires GET routes through the same command handler as POST. OpenAPI emitter is updated to describe GET operations and `3xx` responses.

**Tech Stack:** Same as plans 1-3. No new libraries. Spec: `docs/history/specs/historical/2026-04-19-platform-modules-integration-design.md` §8.

---

## File Structure

### New files

```
packages/bindings/src/
  types/input-from.ts                    ← InputSource, ResponseShape types

packages/bindings-http/src/
  runtime/
    extract-inputs.ts                    ← extract values per InputSource record
    render-response.ts                   ← renderJsonResponse, renderRedirectResponse

packages/bindings-http/test/unit/
  extract-inputs.test.ts
  render-response.test.ts

packages/bindings-http/test/integration/
  callback-binding.test.ts               ← GET /callback → inputFrom.query → command → 302 redirect
```

### Modified files

```
packages/bindings/src/
  parse/schema.ts                        ← inputFrom, response fields on command binding
  types/artifact.ts                      ← add inputFrom, response to BindingEntry
  types/result.ts                        ← 4 new error codes (append-only)
  validate/structural.ts                 ← GET allowed iff response.redirect; inputFrom/parameters consistency
  validate/consistency.ts                ← inputFrom keys must match graph-input names
  openapi/emit.ts                        ← describe GET command operations; 302/303 responses
  index.ts                               ← export InputSource, ResponseShape

packages/bindings-http/src/
  startup/compile-plan.ts                ← carry inputFrom, response into CommandBindingPlan
  runtime/command-handler.ts             ← use extract-inputs + render-response; support GET
  router.ts                              ← mount GET routes for command bindings when appropriate
  runtime/extract.ts                     ← re-exported for parameters[] fallback (unchanged)

demo/pre-step-demo/
  artifacts/bindings.json                ← add a /oauth/stripe/callback GET binding
  src/server.ts                          ← no changes
  test/e2e/callback.test.ts              ← NEW — simulated OAuth callback round-trip

docs/
  superpowers/specs/2026-04-19-platform-modules-integration-design.md  ← mark plan 4 implemented
  AGENTS.md                              ← §6 add "6.14 define a vendor callback"
```

### Out of scope (deferred)

- **SAML assertion parsing** (POST with XML body). P2-b requires a different body parser; deferred until a concrete SAML integration ships. `inputFrom.form` supports POST form-urlencoded, which is enough for the common SAML ACS-via-form case without XML.
- **Nested object extraction from query-string** (e.g., `?foo[bar]=baz`). MVP supports flat query params only.
- **CSRF double-submit cookie helper** — authors implement via `inputFrom.header: "X-Csrf-Token"` + read-prelude check, without a platform-provided utility.
- **HMAC-signed state parameter helper** (`$system.hmac(sessionId, nonce)`) — deferred; for now, authors use `$system.randomBytes` + projection-backed state lookup as described in spec §8.4.

---

## Phase 1 — Schema & types in `@rntme/bindings`

### Task 1: Declare `InputSource` and `ResponseShape` types

**Files:**
- Create: `packages/bindings/src/types/input-from.ts`
- Modify: `packages/bindings/src/types/artifact.ts`
- Modify: `packages/bindings/src/types/result.ts`
- Modify: `packages/bindings/src/index.ts`

- [ ] **Step 1: Create `input-from.ts`**

```ts
// packages/bindings/src/types/input-from.ts
import type { ExpressionTemplate } from './pre.js';

export type InputSource =
  | { from: 'body'; path?: string }                          // JSON body, optional dot-path for nested values
  | { from: 'query'; name: string; required?: boolean }
  | { from: 'header'; name: string; required?: boolean }
  | { from: 'form'; name: string; required?: boolean };      // application/x-www-form-urlencoded

export type InputFromMap = Record<string, InputSource>;

export type ResponseBranch =
  | { json: ExpressionTemplate }
  | { redirect: ExpressionTemplate; status?: 302 | 303 };

export type ResponseShape = {
  onOk: ResponseBranch;
  onErr: ResponseBranch;
};
```

- [ ] **Step 2: Add fields to `BindingEntry`**

In `packages/bindings/src/types/artifact.ts`:

```ts
import type { InputFromMap, ResponseShape } from './input-from.js';

export type BindingEntry = {
  kind?: BindingKind;
  graph: string;
  target: { engine: string; dialect: string };
  http: HttpBinding;
  pre?: PreStep[];            // from plan 3
  inputFrom?: InputFromMap;   // NEW plan 4
  response?: ResponseShape;   // NEW plan 4
};
```

- [ ] **Step 3: Append new error codes**

In `packages/bindings/src/types/result.ts`, append to `ERROR_CODES`:

```ts
  // P2 callback extensions (plan 4)
  BINDINGS_STRUCTURAL_GET_COMMAND_WITHOUT_REDIRECT: 'BINDINGS_STRUCTURAL_GET_COMMAND_WITHOUT_REDIRECT',
  BINDINGS_STRUCTURAL_RESPONSE_REDIRECT_ON_QUERY: 'BINDINGS_STRUCTURAL_RESPONSE_REDIRECT_ON_QUERY',
  BINDINGS_STRUCTURAL_INPUT_FROM_DUPLICATE: 'BINDINGS_STRUCTURAL_INPUT_FROM_DUPLICATE',
  BINDINGS_CONSISTENCY_INPUT_FROM_UNKNOWN_INPUT: 'BINDINGS_CONSISTENCY_INPUT_FROM_UNKNOWN_INPUT',
```

- [ ] **Step 4: Export from barrel**

Append to `packages/bindings/src/index.ts`:

```ts
export type {
  InputSource,
  InputFromMap,
  ResponseBranch,
  ResponseShape,
} from './types/input-from.js';
```

- [ ] **Step 5: Typecheck + commit**

```bash
pnpm -F @rntme/bindings typecheck
```

```bash
git add packages/bindings/src/types/ packages/bindings/src/index.ts
git commit -m "feat(bindings): add InputSource and ResponseShape types for P2 callbacks"
```

---

### Task 2: Zod parsing for `inputFrom` and `response`

**Files:**
- Modify: `packages/bindings/src/parse/schema.ts`
- Create: `packages/bindings/test/unit/input-from-parse.test.ts`

- [ ] **Step 1: Write failing parse tests**

```ts
// packages/bindings/test/unit/input-from-parse.test.ts
import { describe, it, expect } from 'vitest';
import { BindingArtifactSchema } from '../../src/parse/schema.js';

const base = {
  version: '1.0', graphSpecRef: 'g', pdmRef: 'p', qsmRef: 'q',
};

const baseCallback = {
  kind: 'command',
  graph: 'completeOAuth',
  target: { engine: 'graph-ir', dialect: 'sqlite' },
  http: { method: 'GET', path: '/oauth/stripe/callback', parameters: [] },
};

describe('inputFrom + response parsing', () => {
  it('accepts inputFrom.query + redirect response', () => {
    const r = BindingArtifactSchema.safeParse({
      ...base,
      bindings: {
        completeOAuth: {
          ...baseCallback,
          inputFrom: {
            state: { from: 'query', name: 'state', required: true },
            code:  { from: 'query', name: 'code',  required: true },
          },
          response: {
            onOk:  { redirect: '/settings?connected=1', status: 302 },
            onErr: { redirect: '/errors/{$errorCode}' },
          },
        },
      },
    });
    expect(r.success).toBe(true);
  });

  it('accepts inputFrom.header and inputFrom.form', () => {
    const r = BindingArtifactSchema.safeParse({
      ...base,
      bindings: {
        samlAcs: {
          kind: 'command',
          graph: 'handleSaml',
          target: { engine: 'graph-ir', dialect: 'sqlite' },
          http: { method: 'POST', path: '/saml/acs', parameters: [] },
          inputFrom: {
            relayState: { from: 'form', name: 'RelayState' },
            samlResponse: { from: 'form', name: 'SAMLResponse', required: true },
            ua: { from: 'header', name: 'User-Agent' },
          },
          response: { onOk: { json: '$result' }, onErr: { json: '$error' } },
        },
      },
    });
    expect(r.success).toBe(true);
  });

  it('rejects unknown from: kind', () => {
    const r = BindingArtifactSchema.safeParse({
      ...base,
      bindings: {
        bad: { ...baseCallback, inputFrom: { x: { from: 'cookie', name: 'c' } } },
      },
    });
    expect(r.success).toBe(false);
  });

  it('rejects response branch missing both json and redirect', () => {
    const r = BindingArtifactSchema.safeParse({
      ...base,
      bindings: {
        bad: { ...baseCallback, response: { onOk: {}, onErr: { json: '$error' } } },
      },
    });
    expect(r.success).toBe(false);
  });

  it('rejects response.redirect with invalid status', () => {
    const r = BindingArtifactSchema.safeParse({
      ...base,
      bindings: {
        bad: { ...baseCallback, response: { onOk: { redirect: '/x', status: 301 }, onErr: { json: '$error' } } },
      },
    });
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step 2: Verify fail**

Run: `pnpm -F @rntme/bindings vitest run test/unit/input-from-parse.test.ts`
Expected: FAIL.

- [ ] **Step 3: Add Zod schemas**

In `packages/bindings/src/parse/schema.ts`, before `BindingArtifactSchema`:

```ts
const InputSourceSchema = z.discriminatedUnion('from', [
  z.object({ from: z.literal('body'), path: z.string().min(1).optional() }).strict(),
  z.object({ from: z.literal('query'), name: z.string().min(1), required: z.boolean().optional() }).strict(),
  z.object({ from: z.literal('header'), name: z.string().min(1), required: z.boolean().optional() }).strict(),
  z.object({ from: z.literal('form'), name: z.string().min(1), required: z.boolean().optional() }).strict(),
]);

const InputFromMapSchema = z.record(z.string().min(1), InputSourceSchema);

const ResponseBranchSchema = z.union([
  z.object({ json: z.unknown() }).strict(),
  z.object({ redirect: z.unknown(), status: z.union([z.literal(302), z.literal(303)]).optional() }).strict(),
]);

const ResponseShapeSchema = z.object({
  onOk: ResponseBranchSchema,
  onErr: ResponseBranchSchema,
}).strict();
```

Then extend the binding-entry object schema (same location you added `pre` in plan 3) with:

```ts
  inputFrom: InputFromMapSchema.optional(),
  response: ResponseShapeSchema.optional(),
```

Zod note: `z.record(keySchema, valueSchema)` is Zod 4 syntax. If the project is on Zod 3, use `z.record(valueSchema).optional()` and enforce key shape at validation layer.

- [ ] **Step 4: Run tests**

Expected: PASS (all five cases).

- [ ] **Step 5: Commit**

```bash
git add packages/bindings/src/parse/schema.ts \
        packages/bindings/test/unit/input-from-parse.test.ts
git commit -m "feat(bindings): parse inputFrom and response for P2 callback bindings"
```

---

### Task 3: Structural validation loosens command-method check and checks extraction shape

**Files:**
- Modify: `packages/bindings/src/validate/structural.ts`
- Create: `packages/bindings/test/unit/input-from-structural.test.ts`

The existing validator rejects GET on command bindings with `BINDINGS_COMMAND_METHOD_NOT_POST`. We loosen it: GET is allowed **iff** `response.redirect` is present (i.e., the command is a callback). Otherwise the original rejection stands.

- [ ] **Step 1: Write failing structural tests**

```ts
// packages/bindings/test/unit/input-from-structural.test.ts
import { describe, it, expect } from 'vitest';
import { validateStructural } from '../../src/validate/structural.js';
// Reuse the fixture pattern from pre-structural.test.ts for constructing a
// structurally-valid artifact input.

describe('P2 callback structural validation', () => {
  it('accepts GET command binding when response.onOk is a redirect', () => {
    // expect ok for GET + response.onOk.redirect
  });
  it('rejects GET command binding without response.redirect', () => {
    // expect BINDINGS_STRUCTURAL_GET_COMMAND_WITHOUT_REDIRECT
  });
  it('rejects duplicate graph-input mappings across inputFrom and parameters[]', () => {
    // expect BINDINGS_STRUCTURAL_INPUT_FROM_DUPLICATE
  });
  it('rejects redirect response when http.method is GET but query carries a body-bound param', () => {
    // edge: response.redirect.onErr provided, but inputFrom.x.from:"body" — body is not readable on GET.
    // expect BINDINGS_STRUCTURAL_RESPONSE_REDIRECT_ON_QUERY (or reuse BINDINGS_BODY_ON_GET)
  });
});
```

- [ ] **Step 2: Verify fail**

Expected: FAIL.

- [ ] **Step 3: Implement validation changes**

In `packages/bindings/src/validate/structural.ts`, find the existing check emitting `BINDINGS_COMMAND_METHOD_NOT_POST`. Wrap it:

```ts
if (entry.kind === 'command' && entry.http.method === 'GET') {
  const hasRedirect =
    entry.response !== undefined
    && ('redirect' in entry.response.onOk || 'redirect' in entry.response.onErr);
  if (!hasRedirect) {
    errs.push({
      layer: 'structural',
      code: 'BINDINGS_STRUCTURAL_GET_COMMAND_WITHOUT_REDIRECT',
      message: `binding "${bindingId}": GET is only allowed on command bindings when response.onOk or response.onErr is a redirect`,
      path: `bindings.${bindingId}.http.method`,
      hint: 'Vendor-callback bindings (OAuth, magic link) use GET + redirect. Normal commands are POST + json.',
    });
  }
}

// `body`-sourced inputFrom on a GET request is impossible.
if (entry.kind === 'command' && entry.http.method === 'GET' && entry.inputFrom !== undefined) {
  for (const [graphInput, src] of Object.entries(entry.inputFrom)) {
    if (src.from === 'body' || src.from === 'form') {
      errs.push({
        layer: 'structural',
        code: 'BINDINGS_STRUCTURAL_RESPONSE_REDIRECT_ON_QUERY',
        message: `binding "${bindingId}": inputFrom.${graphInput}.from="${src.from}" is not allowed on GET`,
        path: `bindings.${bindingId}.inputFrom.${graphInput}`,
      });
    }
  }
}

// inputFrom keys must not overlap with parameters[].bindTo
if (entry.inputFrom !== undefined) {
  const paramBindTos = new Set(entry.http.parameters.map((p) => p.bindTo));
  for (const inputName of Object.keys(entry.inputFrom)) {
    if (paramBindTos.has(inputName)) {
      errs.push({
        layer: 'structural',
        code: 'BINDINGS_STRUCTURAL_INPUT_FROM_DUPLICATE',
        message: `binding "${bindingId}": graph-input "${inputName}" is bound by both inputFrom and parameters[]`,
        path: `bindings.${bindingId}.inputFrom.${inputName}`,
      });
    }
  }
}
```

Then find the existing `BINDINGS_COMMAND_METHOD_NOT_POST` emission and keep it for `kind === 'command' && http.method !== 'GET' && http.method !== 'POST'` (future-proof against invalid methods).

- [ ] **Step 4: Run tests**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/bindings/src/validate/structural.ts \
        packages/bindings/test/unit/input-from-structural.test.ts
git commit -m "feat(bindings): structural validation for P2 GET-redirect command bindings"
```

---

### Task 4: Consistency — `inputFrom` keys match graph-input names

**Files:**
- Modify: `packages/bindings/src/validate/consistency.ts`
- Create: `packages/bindings/test/unit/input-from-consistency.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// packages/bindings/test/unit/input-from-consistency.test.ts
// Construct a binding whose graph signature has input 'state' but inputFrom has a key 'flowId'.
// Expect BINDINGS_CONSISTENCY_INPUT_FROM_UNKNOWN_INPUT on 'flowId'.
```

- [ ] **Step 2: Verify fail**

Expected: FAIL.

- [ ] **Step 3: Implement**

In `packages/bindings/src/validate/consistency.ts`, find the per-binding loop. After the `pre[]` module check (plan 3), add:

```ts
if (resolvedBinding.entry.inputFrom !== undefined) {
  const graphInputNames = new Set(Object.keys(resolvedBinding.signature.inputs));
  for (const inputName of Object.keys(resolvedBinding.entry.inputFrom)) {
    if (!graphInputNames.has(inputName)) {
      errors.push({
        layer: 'consistency',
        code: 'BINDINGS_CONSISTENCY_INPUT_FROM_UNKNOWN_INPUT',
        message: `binding "${bindingId}": inputFrom key "${inputName}" does not match any graph input`,
        path: `bindings.${bindingId}.inputFrom.${inputName}`,
        hint: `Known graph inputs: ${[...graphInputNames].sort().join(', ')}`,
      });
    }
  }
}
```

- [ ] **Step 4: Run + commit**

Expected: PASS.

```bash
git add packages/bindings/src/validate/consistency.ts \
        packages/bindings/test/unit/input-from-consistency.test.ts
git commit -m "feat(bindings): consistency check — inputFrom keys must be graph inputs"
```

---

### Task 5: OpenAPI emitter — GET operations and 302/303 responses

**Files:**
- Modify: `packages/bindings/src/openapi/emit.ts`

The existing emitter assumes commands are POST with a JSON body. We extend it:
- For GET command bindings: emit a GET operation; drop request-body; pull parameters from `inputFrom` entries where `from` is `query`, `header`, or `path-via-parameters[]`.
- For bindings with `response.redirect`: emit response status 302 (or 303) with `headers.Location.schema.type = 'string'`; **no body**.
- For bindings without explicit `response`: keep current behavior (200 with JSON body).

- [ ] **Step 1: Write a round-trip test — OpenAPI path for a GET callback**

If `packages/bindings/test/unit/openapi/*.test.ts` follows a pattern, add:

```ts
// packages/bindings/test/unit/openapi/callback-operation.test.ts
import { describe, it, expect } from 'vitest';
import { emitOpenApi } from '../../../src/openapi/emit.js';

describe('OpenAPI emission for P2 callback', () => {
  it('emits a GET operation with 302 response for redirect callback', () => {
    const doc = emitOpenApi(/* ValidatedBindings fixture with one GET command + response.redirect */);
    const op = doc.paths['/oauth/stripe/callback']?.get;
    expect(op).toBeDefined();
    expect(op!.responses['302']).toBeDefined();
    expect(op!.requestBody).toBeUndefined();
  });
});
```

If the existing test-kit doesn't expose such a fixture helper, inline it. Details of the emitter's inner API depend on what `emitOpenApi` takes today — open `packages/bindings/src/openapi/emit.ts` and adapt.

- [ ] **Step 2: Verify fail**

Expected: FAIL (emitter rejects GET commands today).

- [ ] **Step 3: Extend the emitter**

Walk through `emit.ts`; at the point where method+path is built per binding, branch:

```ts
const method = entry.http.method.toLowerCase() as 'get' | 'post';
const isRedirectResponse =
  entry.response !== undefined
  && ('redirect' in entry.response.onOk || 'redirect' in entry.response.onErr);

const responses: Record<string, ResponseObject> = {};
if (isRedirectResponse) {
  const redirectStatus = (entry.response?.onOk !== undefined && 'redirect' in entry.response.onOk
    ? entry.response.onOk.status
    : entry.response?.onErr !== undefined && 'redirect' in entry.response.onErr
      ? entry.response.onErr.status
      : undefined) ?? 302;
  responses[String(redirectStatus)] = {
    description: 'Redirect',
    headers: { Location: { schema: { type: 'string' } } },
  };
} else {
  // existing 200 + JSON body behavior
}

const requestBody = method === 'get' ? undefined : /* existing body builder */;

// assemble OperationObject using these fields
```

For `inputFrom`: each entry becomes an OpenAPI `ParameterObject` (with `in: query | header`). `form` entries go into a `requestBody` of type `application/x-www-form-urlencoded`.

- [ ] **Step 4: Run + commit**

Expected: PASS.

```bash
git add packages/bindings/src/openapi/ packages/bindings/test/unit/openapi/
git commit -m "feat(bindings): OpenAPI emission for GET callbacks and 302 redirect responses"
```

---

## Phase 2 — Bindings-http runtime

### Task 6: `extractInputs` — pull values from query, header, form, body-path

**Files:**
- Create: `packages/bindings-http/src/runtime/extract-inputs.ts`
- Create: `packages/bindings-http/test/unit/extract-inputs.test.ts`

- [ ] **Step 1: Write tests**

```ts
// packages/bindings-http/test/unit/extract-inputs.test.ts
import { describe, it, expect } from 'vitest';
import { extractInputs } from '../../src/runtime/extract-inputs.js';
import type { InputFromMap } from '@rntme/bindings';

function mkRequest({
  query = {},
  headers = {},
  body,
  form,
}: {
  query?: Record<string, string | string[]>;
  headers?: Record<string, string>;
  body?: Record<string, unknown>;
  form?: Record<string, string>;
}): Parameters<typeof extractInputs>[1] {
  return {
    query: new URLSearchParams(
      Object.entries(query).flatMap(([k, v]) => (Array.isArray(v) ? v.map((x) => [k, x] as const) : [[k, v] as const])),
    ),
    header: (name) => headers[name.toLowerCase()] ?? null,
    body: body ?? null,
    form: form ?? null,
  };
}

describe('extractInputs', () => {
  it('extracts query values', () => {
    const map: InputFromMap = { state: { from: 'query', name: 'state', required: true } };
    const out = extractInputs(map, mkRequest({ query: { state: 'abc' } }));
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.values.state).toBe('abc');
  });

  it('extracts header values case-insensitively', () => {
    const map: InputFromMap = { ua: { from: 'header', name: 'User-Agent' } };
    const out = extractInputs(map, mkRequest({ headers: { 'user-agent': 'rntme-test' } }));
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.values.ua).toBe('rntme-test');
  });

  it('extracts body-path values', () => {
    const map: InputFromMap = { email: { from: 'body', path: 'profile.email' } };
    const out = extractInputs(map, mkRequest({ body: { profile: { email: 'u@x' } } }));
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.values.email).toBe('u@x');
  });

  it('extracts whole body when no path', () => {
    const map: InputFromMap = { payload: { from: 'body' } };
    const out = extractInputs(map, mkRequest({ body: { a: 1 } }));
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.values.payload).toEqual({ a: 1 });
  });

  it('extracts form values', () => {
    const map: InputFromMap = { samlResponse: { from: 'form', name: 'SAMLResponse', required: true } };
    const out = extractInputs(map, mkRequest({ form: { SAMLResponse: 'data' } }));
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.values.samlResponse).toBe('data');
  });

  it('reports missing required query param', () => {
    const map: InputFromMap = { state: { from: 'query', name: 'state', required: true } };
    const out = extractInputs(map, mkRequest({}));
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error.code).toBe('INPUT_FROM_MISSING');
  });

  it('allows missing optional header → null', () => {
    const map: InputFromMap = { ua: { from: 'header', name: 'User-Agent' } };
    const out = extractInputs(map, mkRequest({}));
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.values.ua).toBeNull();
  });
});
```

- [ ] **Step 2: Verify fail**

Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// packages/bindings-http/src/runtime/extract-inputs.ts
import type { InputFromMap } from '@rntme/bindings';

export type RequestSource = {
  query: URLSearchParams;
  header: (name: string) => string | null;
  body: Record<string, unknown> | null;
  form: Record<string, string> | null;
};

export type ExtractOk = { ok: true; values: Record<string, unknown> };
export type ExtractErr = { ok: false; error: { code: string; message: string; path: string } };
export type ExtractResult = ExtractOk | ExtractErr;

export function extractInputs(map: InputFromMap, req: RequestSource): ExtractResult {
  const values: Record<string, unknown> = {};

  for (const [inputName, src] of Object.entries(map)) {
    const value = extractSingle(src, req);
    if (value.ok === false) {
      // Missing & required is an error; missing & optional → null
      if (src.from !== 'body' && (src as { required?: boolean }).required === true) {
        return {
          ok: false,
          error: {
            code: 'INPUT_FROM_MISSING',
            message: `required input "${inputName}" from ${src.from} is missing`,
            path: inputName,
          },
        };
      }
      values[inputName] = null;
      continue;
    }
    values[inputName] = value.value;
  }
  return { ok: true, values };
}

function extractSingle(src: { from: 'body'; path?: string } | { from: 'query'; name: string } | { from: 'header'; name: string } | { from: 'form'; name: string }, req: RequestSource): { ok: true; value: unknown } | { ok: false } {
  switch (src.from) {
    case 'query': {
      const v = req.query.get(src.name);
      if (v === null) return { ok: false };
      return { ok: true, value: v };
    }
    case 'header': {
      const v = req.header(src.name);
      if (v === null || v === undefined) return { ok: false };
      return { ok: true, value: v };
    }
    case 'form': {
      if (req.form === null) return { ok: false };
      const v = req.form[src.name];
      if (v === undefined) return { ok: false };
      return { ok: true, value: v };
    }
    case 'body': {
      if (req.body === null) return { ok: false };
      if (src.path === undefined) return { ok: true, value: req.body };
      return walkPath(req.body, src.path);
    }
  }
}

function walkPath(obj: Record<string, unknown>, path: string): { ok: true; value: unknown } | { ok: false } {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const p of parts) {
    if (current === null || current === undefined || typeof current !== 'object') return { ok: false };
    if (!(p in (current as Record<string, unknown>))) return { ok: false };
    current = (current as Record<string, unknown>)[p];
  }
  return { ok: true, value: current };
}
```

- [ ] **Step 4: Run + commit**

Expected: PASS.

```bash
git add packages/bindings-http/src/runtime/extract-inputs.ts \
        packages/bindings-http/test/unit/extract-inputs.test.ts
git commit -m "feat(bindings-http): extractInputs handles query, header, form, body-path"
```

---

### Task 7: `renderResponse` — JSON or 302/303 redirect with template substitution

**Files:**
- Create: `packages/bindings-http/src/runtime/render-response.ts`
- Create: `packages/bindings-http/test/unit/render-response.test.ts`

- [ ] **Step 1: Write tests**

```ts
// packages/bindings-http/test/unit/render-response.test.ts
import { describe, it, expect } from 'vitest';
import { renderOkResponse, renderErrResponse } from '../../src/runtime/render-response.js';
import type { ResponseShape } from '@rntme/bindings';

describe('renderResponse', () => {
  it('renders a JSON ok response with template substitution', () => {
    const shape: ResponseShape = {
      onOk: { json: { status: 'active', userId: '$result.userId' } },
      onErr: { json: '$error' },
    };
    const r = renderOkResponse(shape, { result: { userId: 'u-1' }, error: null });
    expect(r.kind).toBe('json');
    if (r.kind === 'json') {
      expect(r.status).toBe(200);
      expect(r.body).toEqual({ status: 'active', userId: 'u-1' });
    }
  });

  it('renders a 302 redirect with substitution', () => {
    const shape: ResponseShape = {
      onOk: { redirect: '/settings?u={$result.userId}', status: 302 },
      onErr: { redirect: '/errors/{$error.code}' },
    };
    const r = renderOkResponse(shape, { result: { userId: 'u-1' }, error: null });
    expect(r.kind).toBe('redirect');
    if (r.kind === 'redirect') {
      expect(r.status).toBe(302);
      expect(r.location).toBe('/settings?u=u-1');
    }
  });

  it('defaults redirect status to 302 when omitted', () => {
    const shape: ResponseShape = {
      onOk: { redirect: '/x' },
      onErr: { json: '$error' },
    };
    const r = renderOkResponse(shape, { result: null, error: null });
    expect(r.kind).toBe('redirect');
    if (r.kind === 'redirect') expect(r.status).toBe(302);
  });

  it('renderErrResponse substitutes error fields', () => {
    const shape: ResponseShape = {
      onOk: { json: '$result' },
      onErr: { redirect: '/errors/{$error.code}' },
    };
    const r = renderErrResponse(shape, { result: null, error: { code: 'BAD', message: 'bad' } });
    expect(r.kind).toBe('redirect');
    if (r.kind === 'redirect') expect(r.location).toBe('/errors/BAD');
  });
});
```

- [ ] **Step 2: Verify fail**

Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// packages/bindings-http/src/runtime/render-response.ts
import type { ResponseShape, ResponseBranch } from '@rntme/bindings';
import { evaluateExpression } from '../pre/expression.js';

export type RenderedResponse =
  | { kind: 'json'; status: number; body: unknown }
  | { kind: 'redirect'; status: 302 | 303; location: string };

export type RenderScope = { result: unknown; error: unknown };

export function renderOkResponse(shape: ResponseShape, scope: RenderScope): RenderedResponse {
  return renderBranch(shape.onOk, scope, 200);
}

export function renderErrResponse(shape: ResponseShape, scope: RenderScope): RenderedResponse {
  return renderBranch(shape.onErr, scope, 400);
}

function renderBranch(branch: ResponseBranch, scope: RenderScope, defaultStatus: number): RenderedResponse {
  if ('json' in branch) {
    const body = evaluateExpression(branch.json, toExprScope(scope));
    return { kind: 'json', status: defaultStatus, body };
  }
  const locRaw = branch.redirect;
  const location = typeof locRaw === 'string'
    ? interpolateTemplate(locRaw, scope)
    : String(evaluateExpression(locRaw, toExprScope(scope)));
  return { kind: 'redirect', status: branch.status ?? 302, location };
}

function toExprScope(scope: RenderScope): import('../pre/expression.js').ExpressionScope {
  return {
    body: {},
    query: {},
    auth: {},
    config: {},
    system: {},
    pre: {},
    // Extend ExpressionScope or cast: redirect templates reference $result and $error.
    // We piggyback on existing evaluator by storing result/error under two custom roots.
    ...({ result: (scope.result ?? {}) as Record<string, unknown>, error: (scope.error ?? {}) as Record<string, unknown> } as Partial<Record<string, Record<string, unknown>>>),
  } as unknown as import('../pre/expression.js').ExpressionScope;
}

/**
 * Minimal {$path} interpolation inside a string.
 *   "/errors/{$error.code}" + { error: {code: 'BAD'} } → "/errors/BAD"
 */
function interpolateTemplate(tpl: string, scope: RenderScope): string {
  return tpl.replace(/\{\$([a-zA-Z0-9_.]+)\}/g, (_match, path: string): string => {
    const root = path.split('.')[0]!;
    const source = (scope as unknown as Record<string, unknown>)[root];
    if (source === undefined || source === null) return '';
    let current: unknown = source;
    const parts = path.split('.').slice(1);
    for (const p of parts) {
      if (current === null || current === undefined || typeof current !== 'object') return '';
      current = (current as Record<string, unknown>)[p];
    }
    return current === undefined || current === null ? '' : String(current);
  });
}
```

Note on `toExprScope`: the existing `evaluateExpression` has a fixed set of scope roots (`body`, `query`, `auth`, `config`, `system`, `pre`). `$result` / `$error` are **new roots** introduced only for response-branch templates. Option A — extend the evaluator's `KNOWN_ROOTS` to include `result` and `error`. Option B — do only string interpolation for redirects (via `interpolateTemplate` above) and use `evaluateExpression` only for `json` branches with a scope that already contains `result`/`error`. **Pick Option A** for consistency: in Task 6 (plan 3) `expression.ts`, extend `KNOWN_ROOTS` to append `'result', 'error'`. That's one line; back-compatible. Update the helper above accordingly and drop the cast.

- [ ] **Step 4: Apply the Option-A change**

Edit `packages/bindings-http/src/pre/expression.ts`:

```ts
const KNOWN_ROOTS: readonly (keyof ExpressionScope)[] = ['body', 'query', 'auth', 'config', 'system', 'pre', 'result', 'error'];

export type ExpressionScope = {
  body?: Record<string, unknown>;
  query?: Record<string, unknown>;
  auth?: Record<string, unknown>;
  config?: Record<string, unknown>;
  system?: Record<string, unknown>;
  pre?: Record<string, unknown>;
  result?: Record<string, unknown>;      // NEW
  error?: Record<string, unknown>;        // NEW
};
```

Then simplify `toExprScope` in `render-response.ts`:

```ts
function toExprScope(scope: RenderScope): ExpressionScope {
  return {
    result: (scope.result ?? {}) as Record<string, unknown>,
    error: (scope.error ?? {}) as Record<string, unknown>,
  };
}
```

- [ ] **Step 5: Run + commit**

Expected: PASS.

```ts
pnpm -F @rntme/bindings-http test
```

```bash
git add packages/bindings-http/src/runtime/render-response.ts \
        packages/bindings-http/src/pre/expression.ts \
        packages/bindings-http/test/unit/render-response.test.ts
git commit -m "feat(bindings-http): renderResponse handles JSON + 302/303 redirect templates"
```

---

### Task 8: Wire `extractInputs` + `renderResponse` into the command handler

**Files:**
- Modify: `packages/bindings-http/src/runtime/command-handler.ts`
- Modify: `packages/bindings-http/src/startup/compile-plan.ts` (carry new fields)
- Modify: `packages/bindings-http/src/router.ts` (mount GET when appropriate)

- [ ] **Step 1: Carry fields into `CommandBindingPlan`**

In `compile-plan.ts`, extend `CommandBindingPlan`:

```ts
export type CommandBindingPlan = BindingPlanCommon & {
  kind: 'command';
  commandName: string;
  pre: import('@rntme/bindings').PreStep[];
  inputFrom: import('@rntme/bindings').InputFromMap | null;
  response: import('@rntme/bindings').ResponseShape | null;
};
```

In `buildPlan`, populate them (`entry.inputFrom ?? null`, `entry.response ?? null`).

- [ ] **Step 2: Route GET methods for command bindings with response.redirect**

In `router.ts`, where command bindings are mounted:

```ts
const method = bp.entry.http.method;
if (method === 'POST') app.post(route, makeCommandHandler(bp, deps));
else if (method === 'GET') app.get(route, makeCommandHandler(bp, deps));
else throw new Error(`unsupported http.method on command binding "${bp.bindingId}": ${method}`);
```

(The structural validator guarantees GET only coexists with a redirect response, so the handler is safe to reach.)

- [ ] **Step 3: Use extraction + rendering in the handler**

In `makeCommandHandler`:

```ts
import { extractInputs } from './extract-inputs.js';
import { renderOkResponse, renderErrResponse } from './render-response.js';

// Inside the handler body, after reading path/query, BEFORE pre-steps:

let graphInputs: Record<string, unknown> = {};
if (plan.inputFrom !== null) {
  const req = {
    query: new URL(c.req.url).searchParams,
    header: (name: string) => c.req.header(name) ?? null,
    body: plan.entry.http.method === 'POST' && !hasFormContentType(c) ? await safeParseJsonBody(c) : null,
    form: plan.entry.http.method === 'POST' && hasFormContentType(c) ? await safeParseFormBody(c) : null,
  };
  const extracted = extractInputs(plan.inputFrom, req);
  if (!extracted.ok) {
    return c.json({ code: extracted.error.code, message: extracted.error.message }, 400);
  }
  graphInputs = extracted.values;
} else {
  // existing path/query/body parsing via `parameters[]` (untouched)
  graphInputs = /* existing extraction via extractPath, extractQuery, body */;
}

// ... pre-steps (from plan 3) run here against this graphInputs as $body ...
// ... commandExecutor.execute runs ...

// Render response:
if (plan.response !== null) {
  const scope = out.ok ? { result: out.value, error: null } : { result: null, error: out.error };
  const rendered = out.ok ? renderOkResponse(plan.response, scope) : renderErrResponse(plan.response, scope);
  if (rendered.kind === 'json') return c.json(rendered.body, rendered.status as 200 | 201 | 400 | 409 | 422 | 500);
  // redirect
  return c.redirect(rendered.location, rendered.status as 302 | 303);
}

// No response shape → existing JSON behavior (plan 1)
if (!out.ok) { /* existing error-to-status mapping */ }
return c.json(out.value, 200);
```

Helpers `hasFormContentType`, `safeParseJsonBody`, `safeParseFormBody` are tiny:

```ts
function hasFormContentType(c: Context): boolean {
  const ct = c.req.header('content-type') ?? '';
  return ct.includes('application/x-www-form-urlencoded');
}

async function safeParseJsonBody(c: Context): Promise<Record<string, unknown> | null> {
  try { const j = await c.req.json(); return (j !== null && typeof j === 'object' && !Array.isArray(j)) ? j as Record<string, unknown> : null; }
  catch { return null; }
}

async function safeParseFormBody(c: Context): Promise<Record<string, string>> {
  const raw = await c.req.parseBody();
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) out[k] = typeof v === 'string' ? v : String(v);
  return out;
}
```

- [ ] **Step 4: Run bindings-http tests**

Run: `pnpm -F @rntme/bindings-http test`
Expected: PASS (existing tests unchanged; no new behavior wired in integration yet — next task).

- [ ] **Step 5: Commit**

```bash
git add packages/bindings-http/src/
git commit -m "feat(bindings-http): wire extractInputs + renderResponse + GET routing"
```

---

### Task 9: Integration test — full callback round-trip

**Files:**
- Create: `packages/bindings-http/test/integration/callback-binding.test.ts`

- [ ] **Step 1: Write the test**

```ts
// packages/bindings-http/test/integration/callback-binding.test.ts
import { describe, it, expect } from 'vitest';
import BetterSqlite3 from 'better-sqlite3';
import { SqliteEventStore } from '@rntme/event-store';
import { CodeCommandExecutor } from '@rntme/runtime';
import { createBindingsRouter } from '../../src/index.js';
// Construct a ValidatedBindings fixture inline: one GET binding /oauth/stripe/callback with
// inputFrom { state, code } and response { onOk: { redirect: '/app?c=1' }, onErr: { redirect: '/app?e={$error.code}' } }.
// A code-handler-based executor reads state/code, returns ok with response=null (executor doesn't
// produce the redirect URL — the binding template does).

describe('P2 callback binding (GET + inputFrom + redirect)', () => {
  it('executes the command and returns 302 Location on success', async () => {
    const db = new BetterSqlite3(':memory:');
    const eventStore = new SqliteEventStore({ filename: ':memory:', serviceName: 'cb' });
    const executor = new CodeCommandExecutor({
      completeCallback: async (_ctx, input) => ({
        ok: true,
        value: {
          aggregateId: String(input.state),
          version: 1,
          eventIds: ['e-1'],
          commandId: 'c', correlationId: 'corr',
        },
      }),
    });

    const router = createBindingsRouter({
      validated: /* minimal fixture with completeCallback binding as described above */,
      graphSpec: {}, pdm: {}, qsm: {},
      db, eventStore, commandExecutor: executor,
    });

    const resp = await router.request('/oauth/stripe/callback?state=abc&code=xyz');
    expect(resp.status).toBe(302);
    expect(resp.headers.get('Location')).toBe('/app?c=1');
  });

  it('returns a 302 to error page when executor returns err', async () => {
    const db = new BetterSqlite3(':memory:');
    const eventStore = new SqliteEventStore({ filename: ':memory:', serviceName: 'cb' });
    const executor = new CodeCommandExecutor({
      completeCallback: async () => ({
        ok: false,
        error: { code: 'FLOW_NOT_FOUND', message: 'no such flow' },
      }),
    });
    const router = createBindingsRouter({ /* same as above, with executor */ });
    const resp = await router.request('/oauth/stripe/callback?state=bad&code=x');
    expect(resp.status).toBe(302);
    expect(resp.headers.get('Location')).toBe('/app?e=FLOW_NOT_FOUND');
  });
});
```

- [ ] **Step 2: Run + commit**

Expected: PASS.

```bash
git add packages/bindings-http/test/integration/callback-binding.test.ts
git commit -m "test(bindings-http): callback GET binding round-trip — ok redirect and err redirect"
```

---

## Phase 3 — Demo & docs

### Task 10: Add callback binding to `demo/pre-step-demo`

**Files:**
- Modify: `demo/pre-step-demo/artifacts/bindings.json`
- Modify: `demo/pre-step-demo/artifacts/pdm.json` / `qsm.json` / `graphs/*.json` (minimum to support a new command)
- Create: `demo/pre-step-demo/test/e2e/callback.test.ts`

Authoring the graph/PDM surface for a realistic OAuth-style flow is non-trivial. To keep this plan focused on plan-4 deliverables, the callback binding we add is a **no-op acknowledgement** command: the graph reads nothing, emits a trivial `CallbackAcknowledged` event, and the binding renders a redirect. This proves the runtime pipeline end-to-end without building a full OAuth state-machine (which belongs to plan 5 when the reference Stripe module arrives).

- [ ] **Step 1: Add a minimal `callbackAck` graph**

Copy the simplest existing command graph from `pre-step-demo/artifacts/graphs/` and rename to `callbackAck.json`. Wire it to emit `CallbackAcknowledged` on an `Ack` aggregate. Update `pdm.json` to add the aggregate + event type. Update `qsm.json` if projections are required.

- [ ] **Step 2: Add the callback binding**

In `bindings.json`:

```json
"stripeCallback": {
  "kind": "command",
  "graph": "callbackAck",
  "target": { "engine": "graph-ir", "dialect": "sqlite" },
  "http": { "method": "GET", "path": "/oauth/stripe/callback", "parameters": [] },
  "inputFrom": {
    "state": { "from": "query", "name": "state", "required": true },
    "code":  { "from": "query", "name": "code",  "required": true }
  },
  "response": {
    "onOk":  { "redirect": "/app/connected?flow={$result.aggregateId}", "status": 302 },
    "onErr": { "redirect": "/app/error?c={$error.code}" }
  }
}
```

- [ ] **Step 3: E2E test**

```ts
// demo/pre-step-demo/test/e2e/callback.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { loadService, startService, type RunningService } from '@rntme/runtime';
import { startFakePayments } from '../../src/fake-payments-module.js';
import { resolve } from 'node:path';

let running: RunningService;
let stopFake: () => Promise<void>;

beforeAll(async () => {
  const artifactDir = resolve(__dirname, '../../artifacts');
  stopFake = await startFakePayments('127.0.0.1:60051', resolve(artifactDir, 'protos/payments.proto'));
  const loaded = await loadService(artifactDir);
  if (!loaded.ok) throw new Error('load failed');
  running = await startService(loaded.value, { artifactDir });
}, 30_000);

afterAll(async () => {
  await running.stop();
  await stopFake();
});

describe('P2 callback E2E', () => {
  it('GET /oauth/stripe/callback → 302 Location', async () => {
    const resp = await fetch(`http://127.0.0.1:${running.httpPort}/api/oauth/stripe/callback?state=abc&code=xyz`, {
      redirect: 'manual',
    });
    expect(resp.status).toBe(302);
    expect(resp.headers.get('Location')).toMatch(/^\/app\/connected\?flow=/);
  });

  it('missing query param returns 400', async () => {
    const resp = await fetch(`http://127.0.0.1:${running.httpPort}/api/oauth/stripe/callback?state=abc`, {
      redirect: 'manual',
    });
    expect(resp.status).toBe(400);
  });
});
```

- [ ] **Step 4: Run**

Run: `pnpm -F @rntme/pre-step-demo test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add demo/pre-step-demo/
git commit -m "test(demo): exercise GET callback binding + redirect response end-to-end"
```

---

### Task 11: Update AGENTS.md §6.14 + mark plan 4 in spec

**Files:**
- Modify: `AGENTS.md`
- Modify: `docs/history/specs/historical/2026-04-19-platform-modules-integration-design.md`

- [ ] **Step 1: Append §6.14**

```markdown
### 6.14 Define a vendor-callback endpoint (OAuth redirect, magic link, hosted checkout return)

1. Read spec §8.
2. In `artifacts/bindings.json`, add a command binding with:

```json
{
  "kind": "command",
  "graph": "completeFlow",
  "http": { "method": "GET", "path": "/oauth/<vendor>/callback", "parameters": [] },
  "inputFrom": {
    "state": { "from": "query", "name": "state", "required": true },
    "code":  { "from": "query", "name": "code",  "required": true }
  },
  "response": {
    "onOk":  { "redirect": "/app/settings?connected=1", "status": 302 },
    "onErr": { "redirect": "/app/errors/{$error.code}" }
  }
}
```

3. Make the `completeFlow` command graph read your `pending_flow` projection as a read-prelude (state→flow lookup), do a `pre[]` RPC to exchange the vendor code, and emit `FlowCompleted`.
4. Validator invariants: GET is allowed only when `response.onOk` or `response.onErr` is a redirect. `inputFrom.<name>` must equal a graph input. `inputFrom.body` / `form` are not allowed on GET.
5. Redirect templates support `{$result.field}` / `{$error.field}` substitutions. Omit `status` to default to 302.
6. Callback endpoint **lives on the domain service**, not the module — see spec §8.5.
```

- [ ] **Step 2: Mark plan 4 implemented in spec §14.**

- [ ] **Step 3: Commit**

```bash
git add AGENTS.md docs/history/specs/historical/2026-04-19-platform-modules-integration-design.md
git commit -m "docs(agents,spec): plan 4 complete — vendor-callback binding recipe"
```

---

## Phase 4 — Finalize

### Task 12: Full regression gate

**Files:** (run-only)

- [ ] **Step 1:** `pnpm install --frozen-lockfile`
- [ ] **Step 2:** `pnpm -r run build`
- [ ] **Step 3:** `pnpm -r run typecheck`
- [ ] **Step 4:** `pnpm -r run test`
- [ ] **Step 5:** `pnpm -r run lint`

Expected: PASS across all packages + both demos.

- [ ] **Step 6: Smoke-boot the demos and hit callback manually**

```bash
timeout 8 pnpm -F @rntme/pre-step-demo start &
sleep 3
curl -i "http://127.0.0.1:3100/api/oauth/stripe/callback?state=x&code=y"
```

Expected: `HTTP/1.1 302 Found` with a `Location` header. Then kill the background process.

- [ ] **Step 7: Commit any fixes discovered**

If steps 1-6 passed cleanly, no commit needed.

---

## Self-review checklist

- Spec §8.1 (`method`, `inputFrom`, `response` fields) → Tasks 1-2 (types + parse) + Task 8 (runtime wiring).
- Spec §8.1 invariant "response.redirect not allowed with JSON on same branch" → enforced by Zod `z.union` — each branch can be `{json}` XOR `{redirect}` (not a joint shape).
- Spec §8.1 `$system.randomBytes` remains in `pre[]` (plan 3); not revisited here.
- Spec §8.2 "method: GET разрешено даже для команд с side-effect" → Task 3 (structural loosening).
- Spec §8.2 redirect default status 302 → Task 7 `renderBranch`.
- Spec §8.4 security (SR1–SR5) → SR1/SR3 live in plan 3 (random state + projection-backed consumption); SR4 CSRF tied to session is author-owned via read-prelude; SR5 expiration is author-owned (projection filter on `expiresAt`). No new primitives in plan 4.
- Spec §8.5 "callback lives on domain service, not module" → documented in AGENTS.md §6.14 and README update not repeated here.
- Error codes appended (not reordered): `BINDINGS_STRUCTURAL_GET_COMMAND_WITHOUT_REDIRECT`, `BINDINGS_STRUCTURAL_RESPONSE_REDIRECT_ON_QUERY`, `BINDINGS_STRUCTURAL_INPUT_FROM_DUPLICATE`, `BINDINGS_CONSISTENCY_INPUT_FROM_UNKNOWN_INPUT`. `INPUT_FROM_MISSING` is a runtime response error (not in the artifact-layer registry).
- Expression scope gets two new roots `result` and `error` (Task 7 Step 4). Existing `$pre.*` / `$body.*` references in `pre[]` unaffected.
- Types consistent: `InputSource`, `InputFromMap`, `ResponseShape`, `ResponseBranch`, `RenderedResponse`, `ExtractResult`.
- No placeholders; every code block complete; file paths absolute; no line numbers.
