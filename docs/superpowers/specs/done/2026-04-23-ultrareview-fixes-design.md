# Ultrareview fixes (2026-04-23) — design

**Status:** design
**Author:** brainstorm 2026-04-23
**Related:**
- `docs/superpowers/specs/done/2026-04-19-platform-modules-integration-design.md` (the integration PR under review)
- Review session: `https://claude.ai/code/session_01LfaF7mRFKjjkuEfnGJnSnU`

**Implementation locations:**
- `packages/bindings-grpc/src/` — emitter (`emit/*`), handler (`server/handler.ts`), shared id helper (`emit/ids.ts`)
- `packages/bindings-http/src/` — command handler, response renderer, idempotency cache + middleware, compile plan
- `packages/bindings/src/` — structural validator, artifact types, error-code enum
- `packages/runtime/src/` — service startup (`start/start-service.ts`), new default query-map helper, gRPC adapter client

## 1. Problem

The 2026-04-23 ultrareview of `feat/platform-modules-integration-pr` against `main` surfaced 17 findings across gRPC surface, HTTP command handler, response rendering, adapter client, and tests/demos. Several are serious:

- The gRPC path does not work end-to-end: proto fields are snake_case but the command/query executor expects camelCase inputs; the handler passes `bindingId` as command name instead of the graph name it is registered under; the runtime wires an empty query map so every gRPC query returns `QUERY_NOT_FOUND`.
- Redirect response templates are vulnerable to injection (substitutions are inserted via `String(value)` without URL encoding), enabling path traversal and open-redirect patterns.
- Idempotency cache is never populated for any binding with a declared response shape — effectively every callback binding and any projection response — because the cache write is gated behind a fall-through path that response-shape bindings skip.
- `renderErrResponse` hardcodes HTTP 400, losing 409 / 422 / 500 semantics for `COMMAND_GUARD_REJECTED`, `COMMAND_CONCURRENCY_CONFLICT`, and `COMMAND_HANDLER_THREW`.
- The main P2 callback integration test is `describe.skip`ped; the author relied on a demo E2E for coverage, which is no longer acceptable.

## 2. Goal

Resolve 13 findings (17 minus 4 demo-specific deferrals) before merging the integration PR. Each fix ships with a regression test that fails against the current code and passes after the change. `pnpm -r run test`, `pnpm -r run typecheck`, and `pnpm -r run lint` remain green.

**In scope (13 findings, 6 clusters):**

- **C1 — gRPC surface correctness.** Proto emitter fixture-path leak, `CommandResult` drop, snake↔camel mismatch; handler uses `bindingId` for command/query name; `start-service` wires empty query executor.
- **C2 — HTTP command-handler control flow.** Idempotency cache skipped when response shape set, `c.redirect` signature drift, GET/form body scope asymmetry, pre-step single-key flatten heuristic, masked `COMMAND_HANDLER_*` errors.
- **C3 — Response rendering and security.** `renderErrResponse` hardcoded 400, redirect template injection (plus open-redirect hardening), plain `$`-reference treated as literal, idempotency-middleware hardcoded `Content-Type` dropping `Location`.
- **C4 — Adapter client.** `statusToAdapterError` extracts a `domainCode` for every terminal status.
- **C5 — Test coverage.** Un-skip `callback-binding.test.ts` with an inline graph-IR fixture.
- **C6 — Validator naming.** Rename `BINDINGS_STRUCTURAL_RESPONSE_REDIRECT_ON_QUERY` to match what it actually guards.

**Out of scope (deferred to a separate demo-hygiene pass):**

- `demo/pre-step-demo/src/fake-payments-module.ts` port-as-string handling.
- `demo/issue-tracker-api/test/e2e/grpc.test.ts` unfalsifiable assertion.
- `demo/pre-step-demo/artifacts/pdm.json` ↔ `artifacts/graphs/createOrder.json` nullable drift.
- `demo/pre-step-demo/artifacts/bindings.json` `bindAs`/`bindTo` collision.

## 3. Cluster C1 — gRPC surface correctness

Six findings. The gRPC path does not work end-to-end today. All fixes live in `packages/bindings-grpc` plus one line in `packages/runtime/src/start/start-service.ts`.

### 3.1 snake_case ↔ camelCase mismatch

The proto emitter writes snake_case field names (idiomatic for protobuf). grpc-js decodes incoming messages to JS objects keyed by those snake_case strings. The command/query executor expects camelCase input names because graph-IR inputs are declared camelCase in PDM and QSM.

**Decision:** keep snake_case in `.proto`, convert at the handler boundary. Rejected alternatives: emitting camelCase in `.proto` (violates proto convention, breaks downstream tooling that expects snake_case); teaching the executor to accept either casing (silent papering, debt grows).

Concretely:

- Consolidate the three duplicated `toSnakeCase` implementations (`emit/shapes.ts`, `emit/service.ts`, `server/handler.ts`) into one shared export in `emit/ids.ts`, alongside the existing `camelToPascal`.
- In `server/handler.ts`, walk `resolved.signature.inputs` (declared camelCase names) and for each name pick `call.request[toSnakeCase(name)]` to build a camelCase-keyed `inputs` object. Pass that to the executor.
- Query response emission already uses `[snakeCase(fromField)]: qout.value`, the symmetric inverse, and keeps working after the local helper is replaced by the shared one.

### 3.2 Handler uses `bindingId` for command/query name

`handler.ts:47` and `:66` pass `commandName: bindingId` / `queryName: bindingId` to the executor. The HTTP compiled plan (`compile-plan.ts:145`) uses `commandName: entry.graph`, which is the graph name the executor is keyed by.

**Fix:** handler reads `resolved.entry.graph` (the same field HTTP uses) and passes it as the executor's `commandName` / `queryName`. No new infrastructure.

### 3.3 `CommandResult` shape drop

`emit-proto.ts:46-52` only emits the canonical `CommandResult` block if no user-declared shape with that name exists, trusting the author-declared shape to have `command_id` and `correlation_id`. A binding that declares its own `CommandResult` without those fields silently drops them from the emitted proto.

**Fix:** reserve the name.

- `emit-proto.ts` always emits `COMMAND_RESULT_BLOCK`.
- New structural validator: any binding that declares a shape named `CommandResult` (the constant `COMMAND_RESULT_SHAPE_NAME` already exists in `packages/bindings/src/validate/consistency.ts`, reuse it) fails with `BINDINGS_STRUCTURAL_RESERVED_SHAPE_NAME`.

The emitter is no longer defensive; the validator guarantees the invariant upstream.

### 3.4 Fixture-path leak in header

`emit-proto.ts:56-61` unconditionally prepends a literal comment `// packages/bindings-grpc/test/fixtures/golden/minimal.proto` to every emitted proto file. A proper header already exists on line 32 (`// Generated from ValidatedBindings…`).

**Fix:** remove the `header` composition; return `parts.join('\n')` directly. Golden-proto fixtures regenerated.

### 3.5 Empty `GraphIrQueryExecutor({})` in start-service

`start-service.ts:89` constructs `new GraphIrQueryExecutor({})`. Every query, HTTP or gRPC, returns `QUERY_NOT_FOUND`.

**Fix:** introduce `buildDefaultGraphIrQueryMap(bindings, graphSpec, pdm, qsm)` mirroring the existing `buildDefaultGraphIrCommandMap`, wire on line 89. Affects HTTP and gRPC query surfaces equally.

## 4. Cluster C2 — HTTP command-handler control flow

Five findings, all in `packages/bindings-http/src/runtime/command-handler.ts`.

### 4.1 Idempotency cache skipped when response shape is set

The handler has three exit points: response-shape render, error fall-through, plain-OK. The cache write lives only on the plain-OK path, so bindings with a declared response shape — including every callback binding and any projection response — are never cached for replay.

**Fix:** move the cache write above the response-shape branch, after `out` is known OK. Cache what the handler actually sends so replay byte-matches the original:

- Extend `CachedResponse` from `{ status, body }` to `{ status, body, headers?: Record<string, string> }`.
- On successful execution, render the response once, compute body + status + optional headers, write to cache, then emit.
- Redirect responses cache with body `""`, status 302/303, and `Location` in `headers`. Middleware replay reads `headers` from the cache (see §5.4).

### 4.2 `c.redirect` signature (Hono v4+)

Hono v4 tightened `c.redirect`'s status parameter type. The current call casts to a raw status-literal union.

**Fix:** verify the current signature via context7 (`hono/context` → `c.redirect`) during implementation; use Hono's exported `RedirectStatusCode` type instead of a literal union. Unit test asserts the returned `Response` has numeric 302/303 status and a `Location` header.

### 4.3 GET / form body scope asymmetry (line 86)

Line 78 sets `req.body = null` for GET and for form-content-type POST (form data goes to `req.form`). Line 86 then sets `bodyValues = req.body ?? {}` — empty in both cases. `scope.body` is used downstream in response templates and pre-step bindings. On a POST form binding, form values are invisible to `$body.X` templates.

**Fix:** in the `hasInputFrom` branch, align the scope with the `req` shape `extractInputs` sees:

```
scope = {
  body: req.body ?? {},
  form: req.form ?? {},
  query: Object.fromEntries(new URL(c.req.url).searchParams.entries()),
  header: (name) => req.header(name),
  auth: { userId: … },
  config: {},
};
```

Templates resolve `$body.X`, `$form.X`, `$query.X`, `$header.X` predictably. GET paths see `body = form = {}`.

### 4.4 Pre-step single-key flatten heuristic

Lines 161-188 silently unwrap pre-step results: if a bindAs result is `{ key: value }` and `key === bindAs.name`, the handler hands `value` to the graph; otherwise it hands the whole object. Authors have no way to declare intent.

**Fix:** replace the heuristic with an explicit selector.

- Artifact schema: `pre[].bindAs` is either a bare string (whole result bound under that name) or `{ name: string, pick?: string }`. When `pick` is set, the handler binds `result[pick]` under `name`.
- Remove flatten heuristic from `command-handler.ts` entirely.
- Structural validator accepts both forms, rejects any other shape.
- Consistency validator: if `bindAs.name` maps to a graph input declared as scalar and the pre-step's declared output is a structured shape, require `pick`.
- `compile-plan.ts` propagates `pick` onto the compiled plan.

This is a behavior change. No external consumers; the one internal fixture that depends on the heuristic (`pre-step-demo`) is out of scope.

### 4.5 Masked `COMMAND_HANDLER_ERROR` / `COMMAND_HANDLER_THREW`

Lines 214-226 branch explicitly on three codes; everything else returns generic 500 with body from `internalErrorBody()`. `COMMAND_HANDLER_ERROR` (author returned `Result.err`) and `COMMAND_HANDLER_THREW` (handler threw) are flattened into the same opaque envelope.

**Fix:** extract an `errorToHttp(code) → { status, bodyFactory }` helper. Extend the mapping:

- `COMMAND_GUARD_REJECTED` → 422 (unchanged).
- `COMMAND_CONCURRENCY_CONFLICT` → 409 (unchanged).
- `COMMAND_NOT_FOUND` → 500, body `{ code, message }` (not `internalErrorBody()`).
- `COMMAND_HANDLER_ERROR` → 400, body `{ code, message }`.
- `COMMAND_HANDLER_THREW` → 500, body `{ code: 'COMMAND_HANDLER_THREW', message }`. Still calls `deps.onError?`.
- Unknown codes → 500, body `{ code, message }`.

The same map is consumed by §5.1 (`renderErrResponse`), giving shape-path and plain-path one source of truth.

## 5. Cluster C3 — Response rendering and security

Four findings in `render-response.ts` plus one in `idempotency/middleware.ts`. Two have security stakes.

### 5.1 `renderErrResponse` hardcoded 400

`renderErrResponse` passes `400` as `defaultStatus` into `renderBranch`. Every error gets 400 unless the author's branch overrides it.

**Fix:**

- Signature: `renderErrResponse(shape, scope, errorCode: string)`.
- `defaultStatus = errorToHttp(errorCode).status` (the same helper from §4.5).
- Author-supplied `branch.status` still wins.

### 5.2 Redirect template injection (two-layer fix)

`interpolateTemplate` at line 48 does `String(current)` without encoding. `redirect: '/oauth/callback?state={$query.state}'` with `state = "../admin?evil=yes"` substitutes unchanged — path-traversal and open-redirect payload delivery.

**Layer 1 — mandatory: encode every substitution.** Always `encodeURIComponent` in `interpolateTemplate`. Over-encodes path-position substitutions (slashes become `%2F`), which is defensive. Documented in the bindings spec as the encoding rule.

**Layer 2 — mandatory (per 2026-04-23 decision): restrict redirect targets.** New structural check:

- String-form `redirect` templates must start with `/` (relative) unless the binding declares `allowedRedirectHosts: string[]`.
- Each entry in `allowedRedirectHosts` is an **origin** — `<scheme>://<host>[:<port>]` — with no path component. Matching is exact on origin; anything after the origin (path, query, fragment) is unconstrained. Path-prefix matching is explicitly rejected to avoid subtle bypasses (e.g., `https://evil.com/attacker/../victim/…`).
- Absolute redirect without allowlist → `BINDINGS_STRUCTURAL_REDIRECT_ABSOLUTE_HOST_NOT_ALLOWED`.
- At runtime, if the interpolated redirect resolves to an absolute URL whose origin is not in the allowlist, the handler refuses to redirect and returns 500 (defensive; validator should have caught it).

### 5.3 Plain `$`-reference treated as literal

`redirect: '$result.redirectUrl'` (no curly braces) is passed to `interpolateTemplate`, which regex-matches only `{$path}` and returns the literal string `$result.redirectUrl`. No evaluation happens; the redirect goes to the literal text.

**Fix:** tighten the schema.

- String form is always a literal template with `{$path}` substitutions.
- Expression redirects use object form: `redirect: { expr: '$result.redirectUrl' }` or structured AST.
- New structural validator: any string `redirect` containing `$` outside a `{$…}` block fails with `BINDINGS_STRUCTURAL_REDIRECT_STRING_CONTAINS_BARE_REFERENCE`, hinting at object form.

### 5.4 Idempotency middleware hardcoded `Content-Type` + dropped `Location`

`middleware.ts:27-30` on cache-hit returns body with hardcoded `Content-Type: application/json` and no other headers. A cached redirect replay returns JSON content-type with no `Location` — broken.

**Fix (follows from §4.1):** `CachedResponse` now carries `headers?`. Replay:

```
const headers = {
  ...(hit.headers ?? { 'Content-Type': 'application/json' }),
  'Idempotency-Replay': 'true',
};
return c.body(hit.body, hit.status, headers);
```

## 6. Cluster C4 — `statusToAdapterError` domainCode overreach

`grpc-adapter-client.ts:146` runs `const domainCode = message.split(':')[0]` for every non-overload/non-internal terminal status. If the vendor returns `"resource not found"`, `domainCode` becomes `"resource not found"` — not a domain code.

**Fix:** extract `domainCode` only when the message matches the documented vendor prefix format:

```
const match = /^([A-Z][A-Z0-9_]+):\s*/.exec(message);
const domainCode = match?.[1];
```

Top-level `code: 'EXTERNAL_VENDOR_DOMAIN'` stays for these statuses; `domainCode` is now meaningful only when the vendor opted into the prefixed convention.

## 7. Cluster C5 — Un-skip `callback-binding.test.ts`

The test at `packages/bindings-http/test/integration/callback-binding.test.ts:110` is `describe.skip`ped. The author's comment pointed at `demo/pre-step-demo` as a substitute — which is now out of scope, so we need real integration coverage for the P2 callback path.

**Fix:**

- Inline a minimal callback graph-IR spec under `packages/bindings-http/test/fixtures/callback-minimal/` or directly in the test file: one graph with two inputs (`state`, `code`), a stub command effect producing a `redirectUrl`, an output shape referencing it.
- Replace `describe.skip` with `describe`.
- Assertions must hold against the post-C2/C3 code: 302 on success with `Location` header, mapped status on errors, body content matching the rendered response shape.
- Extend the suite with a replay case (`Idempotency-Key` on GET callback) to cover §4.1.

## 8. Cluster C6 — Rename structural error code

`structural.ts:155` uses `BINDINGS_STRUCTURAL_RESPONSE_REDIRECT_ON_QUERY` for the "GET command binding has `inputFrom.from='body' | 'form'`" case — unrelated to redirects or queries.

**Fix:** rename to `BINDINGS_STRUCTURAL_INPUT_FROM_BODY_ON_GET`. One emission site, one `ERROR_CODES` entry, update any test that grep-matches the string.

## 9. New and renamed error codes (summary)

Added to `ERROR_CODES`, all follow `<PKG>_<LAYER>_<KIND>`:

| Code | Source | Purpose |
| --- | --- | --- |
| `BINDINGS_STRUCTURAL_RESERVED_SHAPE_NAME` | §3.3 | Bindings declare shape named `CommandResult`. |
| `BINDINGS_STRUCTURAL_REDIRECT_ABSOLUTE_HOST_NOT_ALLOWED` | §5.2 | Absolute redirect without `allowedRedirectHosts` entry. |
| `BINDINGS_STRUCTURAL_REDIRECT_STRING_CONTAINS_BARE_REFERENCE` | §5.3 | String redirect has `$name` outside `{$…}`. |

Renamed:

| From | To |
| --- | --- |
| `BINDINGS_STRUCTURAL_RESPONSE_REDIRECT_ON_QUERY` | `BINDINGS_STRUCTURAL_INPUT_FROM_BODY_ON_GET` |

## 10. Test strategy

Every finding ships with a regression test. Gates:

1. **Red-before-green.** Each test is written to fail against current code and pass after the fix.
2. **Right package level.** Pure-function units (`render-response`, `statusToAdapterError`, `emit-proto`); integration for handler flows (`command-handler`, `handler` for gRPC); one end-to-end boot for the `start-service` query-map wiring.
3. **No demo crutch.** No test added in this spec depends on `demo/*` artifacts. Fixtures live under the relevant package's `test/fixtures/`.

CI: `pnpm -r run test` + `pnpm -r run typecheck` + `pnpm -r run lint` all green.

Test files touched or added:

- `packages/bindings-grpc/test/unit/emit-proto.test.ts` — golden proto no longer contains fixture path; `CommandResult` always present; reserved-name validator.
- `packages/bindings-grpc/test/integration/handler.test.ts` — snake→camel bridge at handler entry; `entry.graph` as commandName/queryName.
- `packages/bindings-http/test/integration/callback-binding.test.ts` — un-skipped with inline graph spec.
- `packages/bindings-http/test/unit/render-response.test.ts` — injection safety; error-status mapping; bare-`$` rejection; absolute-redirect validator.
- `packages/bindings-http/test/integration/command-handler.test.ts` — cache + replay for response-shape bindings; error-code mapping; form/body scope; pre-step `pick`.
- `packages/bindings-http/test/unit/idempotency-middleware.test.ts` — redirect replay preserves `Location` + status.
- `packages/bindings/test/unit/structural.test.ts` — three new structural checks + renamed code.
- `packages/runtime/test/integration/start-service.test.ts` — queries succeed via HTTP and gRPC (not `QUERY_NOT_FOUND`).
- `packages/runtime/test/unit/grpc-adapter-client.test.ts` — domainCode extraction matrix (prefixed / plain / empty).

## 11. Order of operations

Grouped into four batches; earlier unblocks later.

1. **Schema and shared infra.** New error codes; `pre[].bindAs.pick` schema; `allowedRedirectHosts` schema; consolidated `toSnakeCase`; `CachedResponse` headers field; `errorToHttp` helper. No behavioral drift — only foundations the later batches consume.
2. **Cluster C1 (gRPC).** Emitter, handler, `start-service` query-map wiring. Self-contained.
3. **Clusters C2 + C3.** HTTP handler and response renderer must land together: C2.1 (cache carries headers) and C3.4 (middleware reads headers) are symmetric halves of one fix.
4. **Clusters C4 + C5 + C6.** Adapter client, un-skipped callback test, rename. Independent; any order.

Within each batch, the implementation plan sequences finding-by-finding: write failing test → implement → green → next.

## 12. Non-goals

- No changes to demos (`demo/*`). Four demo-scoped findings are deferred.
- No new observability, metrics, or tracing beyond what the command-handler already emits.
- No migration of the binding artifact format beyond the two schema extensions (`pre[].bindAs.pick`, `allowedRedirectHosts`) and the redirect string tightening.
- No compat aliases for the renamed error code. Pre-stable product, no external consumers.
