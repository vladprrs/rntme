# Lift HTTP Middleware to Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the generic HTTP middleware that today lives in `apps/platform-http/src/middleware/` (request-id, logger, error-handler, cors, body-limit, rate-limit, security-headers, same-origin) into `@rntme/bindings-http`, wire them as default-on inside `@rntme/runtime`'s `HttpSurface`, and switch `apps/platform-http` to import from the new home so the directory becomes free of generic HTTP plumbing. `auth` and `tx` middleware stay in `platform-http` — they are out of scope per plan 5 (auth) and intrinsically platform-specific (tx).

**Architecture:** New `packages/runtime/bindings-http/src/middleware/` houses one file per middleware. Each is a generic Hono `MiddlewareHandler` factory with an explicit options record — no platform-specific error codes, no Postgres dependency, no UI-specific CSP. `HttpSurface.mount` (in `@rntme/runtime`) installs `requestId`, `requestLogger`, `cors`, `errorHandler`, and `securityHeaders` globally, and keeps `bodyLimit`, `rateLimit`, `correlationMiddleware` scoped to `/api/*` (their current scope). `sameOriginOnly` is exported but not default-on; consumers add it per-route on cookie-auth UI mutation paths. Behavior visible to platform-http is preserved by passing platform-flavored options (origins CSV, error code `PLATFORM_INTERNAL`) at the call site. Platform-only `PostgresRateLimiter`, `errorEnvelope`, and `statusForCode` move to platform-http-internal files but do not move into the runtime or bindings-http.

**Tech Stack:** TypeScript, Bun, Hono 4.x, pino 9.x, Zod (manifest schema), `@rntme/bindings-http`, `@rntme/runtime`.

---

## Scope Boundary

This plan moves middleware code, gives it a generic API, makes the runtime apply it default-on, and rewires platform-http imports. **It does not change observable behavior of `apps/platform-http`** (response shapes, error codes, headers must match before/after). It does not delete `apps/platform-http` (plan 6), does not change the auth flow (plan 5), does not introduce BPMN-orchestrated deploy (plan 3), does not touch the CLI direct-mode (plan 2). It does add a small set of new manifest fields (`surface.http.cors`, `surface.http.securityHeaders`) so blueprints can configure default-on middleware without overriding the surface.

The spec for this plan is `docs/superpowers/specs/2026-05-10-cli-universal-deploy-and-platform-http-removal-design.md`, migration step 4.

## File Structure

### Created files

- `packages/runtime/bindings-http/src/middleware/index.ts` — re-export every middleware symbol added below.
- `packages/runtime/bindings-http/src/middleware/request-id.ts` — `requestId()` factory.
- `packages/runtime/bindings-http/src/middleware/request-logger.ts` — `requestLogger(opts)` factory (renamed from platform-http `loggerMiddleware` to avoid clashing with a pino logger named `logger`).
- `packages/runtime/bindings-http/src/middleware/error-handler.ts` — generic `errorHandler(opts)` factory.
- `packages/runtime/bindings-http/src/middleware/cors.ts` — `cors(opts)` factory and exported `isAllowedOrigin` helper.
- `packages/runtime/bindings-http/src/middleware/body-limit.ts` — `bodyLimit(maxBytes, opts?)` factory.
- `packages/runtime/bindings-http/src/middleware/rate-limit.ts` — `rateLimit(limiter, keyFn)` factory and `InMemoryRateLimiter` class.
- `packages/runtime/bindings-http/src/middleware/security-headers.ts` — `securityHeaders(opts?)` factory.
- `packages/runtime/bindings-http/src/middleware/same-origin.ts` — `sameOriginOnly(baseUrl, opts?)` factory.
- `packages/runtime/bindings-http/test/unit/middleware/request-id.test.ts`
- `packages/runtime/bindings-http/test/unit/middleware/request-logger.test.ts`
- `packages/runtime/bindings-http/test/unit/middleware/error-handler.test.ts`
- `packages/runtime/bindings-http/test/unit/middleware/cors.test.ts`
- `packages/runtime/bindings-http/test/unit/middleware/body-limit.test.ts`
- `packages/runtime/bindings-http/test/unit/middleware/rate-limit.test.ts`
- `packages/runtime/bindings-http/test/unit/middleware/security-headers.test.ts`
- `packages/runtime/bindings-http/test/unit/middleware/same-origin.test.ts`
- `packages/runtime/runtime/test/integration/http-surface-default-middleware.test.ts` — integration test asserting default-on middleware fire on a fixture service.
- `apps/platform-http/src/error-codes.ts` — receives `STATUS`, `statusForCode`, `errorEnvelope` from the deleted `middleware/error-handler.ts`.
- `apps/platform-http/src/postgres-rate-limiter.ts` — receives `PostgresRateLimiter` from the deleted `middleware/rate-limit.ts`.
- `apps/platform-http/test/unit/error-codes.test.ts` — receives the `statusForCode` + `errorEnvelope` assertions split out from `middleware/error-handler.test.ts`.
- `apps/platform-http/test/unit/postgres-rate-limiter.test.ts` — receives the `PostgresRateLimiter` assertions split out from `middleware/rate-limit.test.ts`.

### Modified files

- `packages/runtime/bindings-http/src/index.ts` — add re-exports from the new `middleware/index.ts`.
- `packages/runtime/runtime/src/plugins/http-surface.ts` — import the new middleware, replace inline `bodyLimitMiddleware` / `createInMemoryRateLimiter` with calls into bindings-http, mount `requestId`, `requestLogger`, `cors`, `errorHandler`, `securityHeaders` default-on, accept new options for logger/cors/security-headers.
- `packages/runtime/runtime/src/start/start-service.ts` — pass new HttpSurface options derived from `RuntimeConfig.logger` and `service.manifest.surface.http.{cors,securityHeaders}`.
- `packages/runtime/runtime/src/start/runtime-config.ts` — add optional `logger?: pino.Logger` field to `RuntimeConfig`, plus a `RUNTIME_CONFIG_LOGGER_INVALID` validation code.
- `packages/runtime/runtime/src/manifest/schema.ts` — extend `surface.http` with `cors` and `securityHeaders` Zod schemas.
- `packages/runtime/runtime/src/manifest/types.ts` — add `HttpCorsConfig`, `HttpSecurityHeadersConfig`, `ValidatedHttpCorsConfig`, `ValidatedHttpSecurityHeadersConfig`, and add the validated fields to `ValidatedManifest['surface']['http']`.
- `packages/runtime/runtime/src/manifest/validate.ts` — fill defaults for the new fields; honor `RNTME_HTTP_CORS_ORIGINS` and `RNTME_HTTP_CSP` env overrides in `applyEnvOverrides`.
- `apps/platform-http/src/app.ts` — replace `./middleware/{request-id,logger,error-handler,cors,rate-limit,body-limit}.js` imports with `@rntme/bindings-http`; replace `./middleware/rate-limit.js`'s `PostgresRateLimiter` import with `./postgres-rate-limiter.js`; pass `code: 'PLATFORM_INTERNAL'` and `bodyCode: 'PLATFORM_PARSE_BODY_INVALID'` and `rateLimitCode: 'PLATFORM_RATE_LIMITED'` and `csrfCode: 'PLATFORM_AUTH_CSRF'` so platform-http's response envelopes do not change.
- `apps/platform-http/src/ui/app.tsx` — replace `../middleware/{security-headers,same-origin}.js` imports with `@rntme/bindings-http`.
- `apps/platform-http/src/routes/helpers.ts` — replace `../middleware/error-handler.js` import with `../error-codes.js`.
- `packages/runtime/bindings-http/package.json` — no dep changes (pino and hono are already direct deps).
- `docs/current/owners/packages/runtime/bindings-http.md` — document the new middleware exports.
- `docs/current/owners/packages/runtime/runtime.md` — document the manifest additions and HttpSurface default-on middleware.
- `docs/current/owners/apps/platform-http.md` — note the middleware now comes from `@rntme/bindings-http`; only `auth.ts` and `tx.ts` remain platform-local.
- `AGENTS.md` — touch only if new lookup pointers are needed; otherwise leave unchanged (the change is internal restructuring).

### Deleted files

- `apps/platform-http/src/middleware/request-id.ts`
- `apps/platform-http/src/middleware/logger.ts`
- `apps/platform-http/src/middleware/error-handler.ts`
- `apps/platform-http/src/middleware/cors.ts`
- `apps/platform-http/src/middleware/body-limit.ts`
- `apps/platform-http/src/middleware/rate-limit.ts`
- `apps/platform-http/src/middleware/security-headers.ts`
- `apps/platform-http/src/middleware/same-origin.ts`
- `apps/platform-http/test/unit/middleware/request-id.test.ts`
- `apps/platform-http/test/unit/middleware/error-handler.test.ts`
- `apps/platform-http/test/unit/middleware/cors.test.ts`
- `apps/platform-http/test/unit/middleware/body-limit.test.ts`
- `apps/platform-http/test/unit/middleware/rate-limit.test.ts`
- `apps/platform-http/test/unit/middleware/security-headers.test.ts`
- `apps/platform-http/test/unit/middleware/same-origin.test.ts`

`apps/platform-http/src/middleware/auth.ts`, `apps/platform-http/src/middleware/tx.ts`, and their tests are NOT deleted in this plan.

## Public API of the New Middleware

All middleware live in `@rntme/bindings-http` and are exported from its root entrypoint. Each accepts an options record so platform-http (and any other consumer) can keep its existing response shapes without forking the function.

```ts
// @rntme/bindings-http

export function requestId(): MiddlewareHandler;
// Sets c.set('requestId', id) and the `X-Request-ID` response header.
// Honors an incoming X-Request-ID header; otherwise mints a v4 UUID.
// Augments hono's ContextVariableMap with `requestId: string`.

export type RequestLoggerOptions = { logger: pino.Logger };
export function requestLogger(opts: RequestLoggerOptions): MiddlewareHandler;
// After next(), logs `{ requestId, method, path, status, durationMs }` at info level.

export type ErrorHandlerOptions = {
  logger?: Pick<pino.Logger, 'error'>;
  /** Error code emitted in the JSON envelope. Default: 'INTERNAL_ERROR'. */
  code?: string;
  /** Optional human-readable message. Default: 'Internal server error'. */
  message?: string;
};
export function errorHandler(opts?: ErrorHandlerOptions): ErrorHandler;
// Hono onError handler. Logs { err, requestId, method, path, route, status: 500 }
// and returns 500 with { error: { code, message } }.

export type CorsOptions = {
  /** Allowed origins. Strings may include `*` wildcards. */
  origins: readonly string[];
  /** Whether to send Access-Control-Allow-Credentials: true. Default: true. */
  credentials?: boolean;
  /** Allowed headers. Default: ['Content-Type', 'Authorization', 'X-Request-ID']. */
  allowHeaders?: readonly string[];
};
export function cors(opts: CorsOptions): MiddlewareHandler;
export function isAllowedOrigin(origin: string, allow: readonly string[]): boolean;
// Wildcard matcher does not use RegExp (preserves the pathological-input safety
// guarantee from the existing platform-http test).

export type BodyLimitOptions = {
  /** Error code in the 413 envelope. Default: 'BODY_LIMIT_EXCEEDED'. */
  code?: string;
};
export function bodyLimit(maxBytes: number, opts?: BodyLimitOptions): MiddlewareHandler;
// 413 with { error: { code, message: `body exceeds ${maxBytes} bytes` } }.

export interface RateLimiter {
  check(key: string): boolean | Promise<boolean>;
}
export class InMemoryRateLimiter implements RateLimiter {
  constructor(opts: { windowMs: number; max: number });
  check(key: string): boolean;
}
export type RateLimitOptions = {
  /** Error code in the 429 envelope. Default: 'RATE_LIMITED'. */
  code?: string;
};
export function rateLimit(
  limiter: RateLimiter,
  keyFn: (c: Parameters<MiddlewareHandler>[0]) => string,
  opts?: RateLimitOptions,
): MiddlewareHandler;
// 429 with { error: { code, message: 'rate limit exceeded' } }.

export type SecurityHeadersOptions = {
  /** When set, emitted as Content-Security-Policy. Default: undefined (no CSP header). */
  csp?: string;
  /** Default: 'nosniff'. */
  contentTypeOptions?: string | null;
  /** Default: 'strict-origin-when-cross-origin'. */
  referrerPolicy?: string | null;
};
export function securityHeaders(opts?: SecurityHeadersOptions): MiddlewareHandler;

export type SameOriginOptions = {
  /** Error code in the 403 envelope. Default: 'CROSS_ORIGIN_BLOCKED'. */
  code?: string;
};
export function sameOriginOnly(baseUrl: string, opts?: SameOriginOptions): MiddlewareHandler;
// Skips GET/HEAD/OPTIONS. For other methods, requires Origin to equal baseUrl
// or Referer to start with `${baseUrl}/`.
```

`requestId` augments `hono`'s `ContextVariableMap` with `requestId: string` (single source of truth — the platform-http augmentation is removed when its file is deleted).

## Default-On Wiring in HttpSurface

After this plan, `HttpSurface.mount` performs (in order):

1. `app.use('*', requestId())`
2. `app.use('*', requestLogger({ logger }))` — logger comes from `RuntimeConfig.logger`, defaulting to `pino()` minted at startup.
3. `app.onError(errorHandler({ logger }))`
4. If `manifest.surface.http.cors.origins.length > 0`: `app.use('*', cors({ origins, credentials, allowHeaders }))`. If empty, no CORS middleware is mounted (no `Access-Control-*` headers; same-origin only).
5. `app.use('*', securityHeaders({ csp }))` where `csp` comes from manifest; defaults add only `X-Content-Type-Options` and `Referrer-Policy`.
6. Existing `service.json` route, `mountObservability(...)`.
7. UI app construction.
8. `app.use('/api/*', bodyLimit(manifest.surface.http.bodyLimit.maxBytes))` — only when `bodyLimit.enabled === true`; current behavior.
9. `app.use('/api/*', rateLimit(new InMemoryRateLimiter(manifest.surface.http.rateLimit), () => 'process'))` — only when `rateLimit.enabled === true`; current behavior. The keyFn matches the `'process'` bucket used today.
10. `app.use('/api/*', correlationMiddleware())` — current behavior.
11. `app.route('/api', router)`, `app.route('/', uiApp)` — current behavior.

`sameOriginOnly` is **not** default-on; consumers (platform-http UI) call it per-route.

## Manifest Additions

```ts
// surface.http
{
  cors?: {
    origins?: string[];          // wildcard-matched, default: []
    credentials?: boolean;       // default: true
    allowHeaders?: string[];     // default: ['Content-Type','Authorization','X-Request-ID']
  };
  securityHeaders?: {
    csp?: string | null;         // default: null (no CSP header)
    contentTypeOptions?: string | null;  // default: 'nosniff'
    referrerPolicy?: string | null;      // default: 'strict-origin-when-cross-origin'
  };
}
```

Env overrides in `applyEnvOverrides`:

- `RNTME_HTTP_CORS_ORIGINS` — CSV, splits on `,`, trims, drops empties.
- `RNTME_HTTP_CSP` — overrides `securityHeaders.csp` literally; the empty string disables CSP.

`applyEnvOverrides` validates that `RNTME_HTTP_CORS_ORIGINS` does not yield zero non-empty entries when set (it must either be unset or yield ≥1 origin) — the empty-string case fails with `MANIFEST_INVALID_TYPE` at path `surface.http.cors.origins (from RNTME_HTTP_CORS_ORIGINS)`.

## Tasks

### Task 1: Bootstrap the `bindings-http/src/middleware/` directory

**Files:**
- Create: `packages/runtime/bindings-http/src/middleware/index.ts`
- Modify: `packages/runtime/bindings-http/src/index.ts:33-34`

- [ ] **Step 1: Create the empty middleware barrel**

Write `packages/runtime/bindings-http/src/middleware/index.ts` with the exact contents below. The file holds re-exports only; each module is added in later tasks.

```ts
// Generic Hono middleware shared between @rntme/runtime and consumers like
// apps/platform-http. Each module is added in its own task; this barrel
// gathers them so callers do a single named import.
```

- [ ] **Step 2: Wire the barrel into the package entrypoint**

In `packages/runtime/bindings-http/src/index.ts`, after the `correlationMiddleware` exports (line 34), append:

```ts
export * from './middleware/index.js';
```

- [ ] **Step 3: Run typecheck and confirm it stays green**

Run: `bun run --filter @rntme/bindings-http typecheck`
Expected: PASS (the barrel is empty, so nothing changes).

- [ ] **Step 4: Commit**

```bash
git add packages/runtime/bindings-http/src/middleware/index.ts packages/runtime/bindings-http/src/index.ts
git commit -m "chore(bindings-http): scaffold middleware/ barrel for the lift"
```

---

### Task 2: Lift `requestId` to bindings-http

**Files:**
- Create: `packages/runtime/bindings-http/src/middleware/request-id.ts`
- Create: `packages/runtime/bindings-http/test/unit/middleware/request-id.test.ts`
- Modify: `packages/runtime/bindings-http/src/middleware/index.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/runtime/bindings-http/test/unit/middleware/request-id.test.ts`:

```ts
import { describe, it, expect } from 'bun:test';
import { Hono } from 'hono';
import { requestId } from '../../../src/middleware/request-id.js';

describe('requestId', () => {
  it('echoes incoming X-Request-ID header', async () => {
    const app = new Hono().use(requestId()).get('/', (c) => c.json({ id: c.get('requestId') }));
    const r = await app.request('/', { headers: { 'x-request-id': 'abc123' } });
    expect(r.headers.get('x-request-id')).toBe('abc123');
    expect((await r.json()).id).toBe('abc123');
  });

  it('generates a UUID when header missing', async () => {
    const app = new Hono().use(requestId()).get('/', (c) => c.json({ id: c.get('requestId') }));
    const r = await app.request('/');
    const hdr = r.headers.get('x-request-id');
    expect(hdr).toMatch(/^[0-9a-f-]{36}$/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run --filter @rntme/bindings-http test packages/runtime/bindings-http/test/unit/middleware/request-id.test.ts`
Expected: FAIL — the import `../../../src/middleware/request-id.js` does not resolve.

- [ ] **Step 3: Write the implementation**

Create `packages/runtime/bindings-http/src/middleware/request-id.ts`:

```ts
import type { MiddlewareHandler } from 'hono';
import { randomUUID } from 'node:crypto';

declare module 'hono' {
  interface ContextVariableMap {
    requestId: string;
  }
}

export function requestId(): MiddlewareHandler {
  return async (c, next) => {
    const incoming = c.req.header('x-request-id');
    const id = incoming ?? randomUUID();
    c.set('requestId', id);
    c.header('X-Request-ID', id);
    await next();
  };
}
```

- [ ] **Step 4: Re-export from the barrel**

In `packages/runtime/bindings-http/src/middleware/index.ts`, add:

```ts
export { requestId } from './request-id.js';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun run --filter @rntme/bindings-http test packages/runtime/bindings-http/test/unit/middleware/request-id.test.ts`
Expected: PASS, both tests green.

- [ ] **Step 6: Commit**

```bash
git add packages/runtime/bindings-http/src/middleware/{request-id.ts,index.ts} packages/runtime/bindings-http/test/unit/middleware/request-id.test.ts
git commit -m "feat(bindings-http): lift requestId middleware from platform-http"
```

---

### Task 3: Lift `requestLogger` to bindings-http

**Files:**
- Create: `packages/runtime/bindings-http/src/middleware/request-logger.ts`
- Create: `packages/runtime/bindings-http/test/unit/middleware/request-logger.test.ts`
- Modify: `packages/runtime/bindings-http/src/middleware/index.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, mock } from 'bun:test';
import { Hono } from 'hono';
import { requestId } from '../../../src/middleware/request-id.js';
import { requestLogger } from '../../../src/middleware/request-logger.js';

describe('requestLogger', () => {
  it('logs requestId, method, path, status, and durationMs after the handler runs', async () => {
    const info = mock();
    const logger = { info, error: () => undefined } as never;
    const app = new Hono()
      .use(requestId())
      .use(requestLogger({ logger }))
      .get('/items/:id', (c) => c.json({ id: c.req.param('id') }));

    const res = await app.request('/items/42', { headers: { 'x-request-id': 'req-7' } });

    expect(res.status).toBe(200);
    expect(info).toHaveBeenCalledTimes(1);
    const [payload, message] = info.mock.calls[0]!;
    expect(message).toBe('request');
    expect(payload).toEqual(
      expect.objectContaining({
        requestId: 'req-7',
        method: 'GET',
        path: '/items/42',
        status: 200,
      }),
    );
    expect(typeof (payload as { durationMs: number }).durationMs).toBe('number');
    expect((payload as { durationMs: number }).durationMs).toBeGreaterThanOrEqual(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run --filter @rntme/bindings-http test packages/runtime/bindings-http/test/unit/middleware/request-logger.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `packages/runtime/bindings-http/src/middleware/request-logger.ts`:

```ts
import type { MiddlewareHandler } from 'hono';
import type pino from 'pino';

export type RequestLoggerOptions = {
  logger: pino.Logger;
};

export function requestLogger(opts: RequestLoggerOptions): MiddlewareHandler {
  return async (c, next) => {
    const start = Date.now();
    await next();
    const durationMs = Date.now() - start;
    opts.logger.info(
      {
        requestId: c.get('requestId'),
        method: c.req.method,
        path: c.req.path,
        status: c.res.status,
        durationMs,
      },
      'request',
    );
  };
}
```

- [ ] **Step 4: Re-export from the barrel**

Add to `packages/runtime/bindings-http/src/middleware/index.ts`:

```ts
export { requestLogger, type RequestLoggerOptions } from './request-logger.js';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun run --filter @rntme/bindings-http test packages/runtime/bindings-http/test/unit/middleware/request-logger.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/runtime/bindings-http/src/middleware/{request-logger.ts,index.ts} packages/runtime/bindings-http/test/unit/middleware/request-logger.test.ts
git commit -m "feat(bindings-http): lift requestLogger middleware from platform-http"
```

---

### Task 4: Lift `errorHandler` to bindings-http (generic shape)

**Files:**
- Create: `packages/runtime/bindings-http/src/middleware/error-handler.ts`
- Create: `packages/runtime/bindings-http/test/unit/middleware/error-handler.test.ts`
- Modify: `packages/runtime/bindings-http/src/middleware/index.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, mock } from 'bun:test';
import { Hono } from 'hono';
import { requestId } from '../../../src/middleware/request-id.js';
import { errorHandler } from '../../../src/middleware/error-handler.js';

describe('errorHandler', () => {
  it('emits a sanitized 500 with the default INTERNAL_ERROR code and logs request metadata', async () => {
    const error = mock();
    const cause = new Error('boom');
    const app = new Hono();
    app.use('*', requestId());
    app.onError(errorHandler({ logger: { error } as never }));
    app.get('/boom/:id', () => {
      throw cause;
    });

    const res = await app.request('/boom/123', { headers: { 'x-request-id': 'req-1' } });

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({
        err: cause,
        requestId: 'req-1',
        method: 'GET',
        path: '/boom/123',
        route: '/boom/:id',
        status: 500,
      }),
      'unhandled error',
    );
  });

  it('honors a custom error code for callers that want to keep their own envelope', async () => {
    const app = new Hono();
    app.use('*', requestId());
    app.onError(errorHandler({ code: 'PLATFORM_INTERNAL' }));
    app.get('/boom', () => {
      throw new Error('x');
    });

    const res = await app.request('/boom');
    expect(await res.json()).toEqual({
      error: { code: 'PLATFORM_INTERNAL', message: 'Internal server error' },
    });
  });

  it('omits the logger call when no logger is supplied', async () => {
    const app = new Hono();
    app.use('*', requestId());
    app.onError(errorHandler());
    app.get('/boom', () => {
      throw new Error('x');
    });
    const res = await app.request('/boom');
    expect(res.status).toBe(500);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run --filter @rntme/bindings-http test packages/runtime/bindings-http/test/unit/middleware/error-handler.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `packages/runtime/bindings-http/src/middleware/error-handler.ts`:

```ts
import type { ErrorHandler } from 'hono';
import type pino from 'pino';

export type ErrorHandlerOptions = {
  logger?: Pick<pino.Logger, 'error'>;
  code?: string;
  message?: string;
};

export function errorHandler(opts: ErrorHandlerOptions = {}): ErrorHandler {
  const code = opts.code ?? 'INTERNAL_ERROR';
  const message = opts.message ?? 'Internal server error';
  return (cause, c) => {
    opts.logger?.error(
      {
        err: cause,
        requestId: c.get('requestId'),
        method: c.req.method,
        path: c.req.path,
        route: c.req.routePath,
        status: 500,
      },
      'unhandled error',
    );
    return c.json({ error: { code, message } }, 500);
  };
}
```

- [ ] **Step 4: Re-export from the barrel**

Add:

```ts
export { errorHandler, type ErrorHandlerOptions } from './error-handler.js';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun run --filter @rntme/bindings-http test packages/runtime/bindings-http/test/unit/middleware/error-handler.test.ts`
Expected: PASS, three tests green.

- [ ] **Step 6: Commit**

```bash
git add packages/runtime/bindings-http/src/middleware/{error-handler.ts,index.ts} packages/runtime/bindings-http/test/unit/middleware/error-handler.test.ts
git commit -m "feat(bindings-http): lift errorHandler middleware with configurable code"
```

---

### Task 5: Lift `cors` to bindings-http

**Files:**
- Create: `packages/runtime/bindings-http/src/middleware/cors.ts`
- Create: `packages/runtime/bindings-http/test/unit/middleware/cors.test.ts`
- Modify: `packages/runtime/bindings-http/src/middleware/index.ts`

- [ ] **Step 1: Write the failing test**

Port the platform-http test verbatim, including the no-RegExp guarantee. Create `packages/runtime/bindings-http/test/unit/middleware/cors.test.ts`:

```ts
import { describe, expect, it } from 'bun:test';
import { Hono } from 'hono';
import { cors, isAllowedOrigin } from '../../../src/middleware/cors.js';

describe('isAllowedOrigin', () => {
  it('allows exact origins', () => {
    expect(isAllowedOrigin('https://platform.rntme.com', ['https://platform.rntme.com'])).toBe(true);
  });

  it('allows wildcard subdomains', () => {
    expect(isAllowedOrigin('https://app.rntme.com', ['https://*.rntme.com'])).toBe(true);
  });

  it('rejects suffix confusion for wildcard subdomains', () => {
    expect(isAllowedOrigin('https://app.rntme.com.evil.test', ['https://*.rntme.com'])).toBe(false);
  });

  it('does not rely on RegExp for pathological wildcard input', () => {
    const originalRegExp = globalThis.RegExp;
    try {
      globalThis.RegExp = function ThrowingRegExp() {
        throw new Error('RegExp must not be used for CORS wildcard matching');
      } as unknown as RegExpConstructor;

      expect(
        isAllowedOrigin(`https://${'a.'.repeat(200)}rntme.com`, [
          `https://${'*.'.repeat(80)}rntme.com`,
        ]),
      ).toBe(true);
    } finally {
      globalThis.RegExp = originalRegExp;
    }
  });
});

describe('cors middleware', () => {
  it('reflects an allowed origin and sets credentials', async () => {
    const app = new Hono()
      .use('*', cors({ origins: ['https://allowed.example'] }))
      .get('/x', (c) => c.text('ok'));
    const res = await app.request('/x', {
      method: 'OPTIONS',
      headers: { origin: 'https://allowed.example', 'access-control-request-method': 'GET' },
    });
    expect(res.headers.get('access-control-allow-origin')).toBe('https://allowed.example');
    expect(res.headers.get('access-control-allow-credentials')).toBe('true');
  });

  it('does not reflect a foreign origin', async () => {
    const app = new Hono()
      .use('*', cors({ origins: ['https://allowed.example'] }))
      .get('/x', (c) => c.text('ok'));
    const res = await app.request('/x', {
      method: 'OPTIONS',
      headers: { origin: 'https://evil.example', 'access-control-request-method': 'GET' },
    });
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run --filter @rntme/bindings-http test packages/runtime/bindings-http/test/unit/middleware/cors.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `packages/runtime/bindings-http/src/middleware/cors.ts`:

```ts
import { cors as honoCors } from 'hono/cors';
import type { MiddlewareHandler } from 'hono';

const DEFAULT_ALLOW_HEADERS = ['Content-Type', 'Authorization', 'X-Request-ID'] as const;

export type CorsOptions = {
  origins: readonly string[];
  credentials?: boolean;
  allowHeaders?: readonly string[];
};

export function isAllowedOrigin(origin: string, allow: readonly string[]): boolean {
  for (const allowed of allow) {
    if (allowed === '*') return true;
    if (allowed === origin) return true;
    if (allowed.includes('*') && wildcardMatch(origin, allowed)) return true;
  }
  return false;
}

export function cors(opts: CorsOptions): MiddlewareHandler {
  const credentials = opts.credentials ?? true;
  const allowHeaders = opts.allowHeaders ?? DEFAULT_ALLOW_HEADERS;
  return honoCors({
    origin: (origin) => (isAllowedOrigin(origin, opts.origins) ? origin : null),
    credentials,
    allowHeaders: [...allowHeaders],
  });
}

function wildcardMatch(text: string, pattern: string): boolean {
  let textIndex = 0;
  let patternIndex = 0;
  let starIndex = -1;
  let textAfterStar = 0;

  while (textIndex < text.length) {
    if (patternIndex < pattern.length && pattern[patternIndex] === text[textIndex]) {
      textIndex += 1;
      patternIndex += 1;
      continue;
    }

    if (patternIndex < pattern.length && pattern[patternIndex] === '*') {
      starIndex = patternIndex;
      textAfterStar = textIndex;
      patternIndex += 1;
      continue;
    }

    if (starIndex !== -1) {
      patternIndex = starIndex + 1;
      textAfterStar += 1;
      textIndex = textAfterStar;
      continue;
    }

    return false;
  }

  while (patternIndex < pattern.length && pattern[patternIndex] === '*') {
    patternIndex += 1;
  }

  return patternIndex === pattern.length;
}
```

- [ ] **Step 4: Re-export from the barrel**

```ts
export { cors, isAllowedOrigin, type CorsOptions } from './cors.js';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun run --filter @rntme/bindings-http test packages/runtime/bindings-http/test/unit/middleware/cors.test.ts`
Expected: PASS, six tests green.

- [ ] **Step 6: Commit**

```bash
git add packages/runtime/bindings-http/src/middleware/{cors.ts,index.ts} packages/runtime/bindings-http/test/unit/middleware/cors.test.ts
git commit -m "feat(bindings-http): lift cors middleware with array origins API"
```

---

### Task 6: Lift `bodyLimit` to bindings-http

**Files:**
- Create: `packages/runtime/bindings-http/src/middleware/body-limit.ts`
- Create: `packages/runtime/bindings-http/test/unit/middleware/body-limit.test.ts`
- Modify: `packages/runtime/bindings-http/src/middleware/index.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'bun:test';
import { Hono } from 'hono';
import { bodyLimit } from '../../../src/middleware/body-limit.js';

describe('bodyLimit', () => {
  it('returns 413 with default code when an oversize body is sent without Content-Length', async () => {
    const app = new Hono();
    app.post('/small', bodyLimit(8), (c) => c.text('ok'));
    const res = await app.request('/small', { method: 'POST', body: 'x'.repeat(100) });
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({
      error: { code: 'BODY_LIMIT_EXCEEDED', message: 'body exceeds 8 bytes' },
    });
  });

  it('passes through small bodies', async () => {
    const app = new Hono();
    app.post('/small', bodyLimit(1024), (c) => c.text('ok'));
    const res = await app.request('/small', { method: 'POST', body: 'ok' });
    expect(res.status).toBe(200);
  });

  it('rejects oversize declared via Content-Length header', async () => {
    const app = new Hono();
    app.post('/small', bodyLimit(8), (c) => c.text('ok'));
    const res = await app.request('/small', {
      method: 'POST',
      headers: { 'content-length': '100' },
      body: 'x'.repeat(100),
    });
    expect(res.status).toBe(413);
  });

  it('drains and rejects when Content-Length is non-finite', async () => {
    const app = new Hono();
    app.post('/small', bodyLimit(8), (c) => c.text('ok'));
    const res = await app.request('/small', {
      method: 'POST',
      headers: { 'content-length': 'Infinity' },
      body: 'x'.repeat(100),
    });
    expect(res.status).toBe(413);
  });

  it('honors a caller-supplied error code', async () => {
    const app = new Hono();
    app.post('/small', bodyLimit(8, { code: 'PLATFORM_PARSE_BODY_INVALID' }), (c) => c.text('ok'));
    const res = await app.request('/small', { method: 'POST', body: 'x'.repeat(100) });
    expect(await res.json()).toEqual({
      error: { code: 'PLATFORM_PARSE_BODY_INVALID', message: 'body exceeds 8 bytes' },
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run --filter @rntme/bindings-http test packages/runtime/bindings-http/test/unit/middleware/body-limit.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `packages/runtime/bindings-http/src/middleware/body-limit.ts`:

```ts
import type { MiddlewareHandler } from 'hono';

export type BodyLimitOptions = {
  code?: string;
};

export function bodyLimit(maxBytes: number, opts: BodyLimitOptions = {}): MiddlewareHandler {
  const code = opts.code ?? 'BODY_LIMIT_EXCEEDED';
  const tooLarge = (c: Parameters<MiddlewareHandler>[0]): Response =>
    c.json({ error: { code, message: `body exceeds ${maxBytes} bytes` } }, 413);

  return async (c, next) => {
    const header = c.req.header('content-length');
    const declared = header !== undefined ? Number(header) : undefined;
    const declaredValid = declared !== undefined && Number.isFinite(declared) && declared >= 0;
    if (declaredValid) {
      if (declared > maxBytes) return tooLarge(c);
      return next();
    }
    const raw = c.req.raw.body;
    if (raw) {
      const reader = raw.getReader();
      let total = 0;
      const chunks: Uint8Array[] = [];
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > maxBytes) return tooLarge(c);
        chunks.push(value);
      }
      const body = new Blob(chunks as unknown as BlobPart[]);
      const req = new Request(c.req.url, {
        method: c.req.method,
        headers: c.req.raw.headers,
        body,
      });
      (c.req as unknown as { raw: Request }).raw = req;
    }
    return next();
  };
}
```

- [ ] **Step 4: Re-export from the barrel**

```ts
export { bodyLimit, type BodyLimitOptions } from './body-limit.js';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun run --filter @rntme/bindings-http test packages/runtime/bindings-http/test/unit/middleware/body-limit.test.ts`
Expected: PASS, five tests green.

- [ ] **Step 6: Commit**

```bash
git add packages/runtime/bindings-http/src/middleware/{body-limit.ts,index.ts} packages/runtime/bindings-http/test/unit/middleware/body-limit.test.ts
git commit -m "feat(bindings-http): lift bodyLimit middleware with configurable code"
```

---

### Task 7: Lift `rateLimit` and `InMemoryRateLimiter` to bindings-http

`RateLimiter.check` returns either a boolean (back-compat for simple limiters) or a richer `RateLimitDecision` so the middleware can set `X-RateLimit-*` and `Retry-After` headers — preserving the response headers the inline runtime limiter emits today (asserted by `runtime/test/integration/startup.test.ts`).

**Files:**
- Create: `packages/runtime/bindings-http/src/middleware/rate-limit.ts`
- Create: `packages/runtime/bindings-http/test/unit/middleware/rate-limit.test.ts`
- Modify: `packages/runtime/bindings-http/src/middleware/index.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'bun:test';
import { Hono } from 'hono';
import { InMemoryRateLimiter, rateLimit } from '../../../src/middleware/rate-limit.js';

describe('InMemoryRateLimiter', () => {
  it('returns a rich decision describing the bucket state', () => {
    const l = new InMemoryRateLimiter({ windowMs: 1000, max: 2 });
    const a = l.check('k');
    expect(a.allowed).toBe(true);
    expect(a.limit).toBe(2);
    expect(a.remaining).toBe(1);
    expect(a.resetAtSeconds).toBeGreaterThan(0);
    const b = l.check('k');
    expect(b.allowed).toBe(true);
    expect(b.remaining).toBe(0);
    const c = l.check('k');
    expect(c.allowed).toBe(false);
    expect(c.remaining).toBe(0);
    expect(c.retryAfterSeconds).toBeGreaterThanOrEqual(1);
  });

  it('forgets after window', async () => {
    const l = new InMemoryRateLimiter({ windowMs: 30, max: 1 });
    expect(l.check('k').allowed).toBe(true);
    expect(l.check('k').allowed).toBe(false);
    await new Promise((r) => setTimeout(r, 40));
    expect(l.check('k').allowed).toBe(true);
  });
});

describe('rateLimit middleware', () => {
  it('returns 429 with default code when a boolean limiter rejects', async () => {
    const fake = { check: () => false };
    const app = new Hono()
      .use('*', rateLimit(fake, () => 'k'))
      .get('/x', (c) => c.json({ ok: true }));
    const res = await app.request('/x');
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({
      error: { code: 'RATE_LIMITED', message: 'rate limit exceeded' },
    });
  });

  it('passes through when limiter accepts', async () => {
    const fake = { check: () => true };
    const app = new Hono()
      .use('*', rateLimit(fake, () => 'k'))
      .get('/x', (c) => c.json({ ok: true }));
    const res = await app.request('/x');
    expect(res.status).toBe(200);
  });

  it('emits X-RateLimit-* and Retry-After headers when the limiter returns a rich decision', async () => {
    const limiter = new InMemoryRateLimiter({ windowMs: 60_000, max: 1 });
    const app = new Hono()
      .use('*', rateLimit(limiter, () => 'k'))
      .get('/x', (c) => c.json({ ok: true }));
    const first = await app.request('/x');
    const second = await app.request('/x');
    expect(first.status).toBe(200);
    expect(first.headers.get('x-ratelimit-limit')).toBe('1');
    expect(first.headers.get('x-ratelimit-remaining')).toBe('0');
    expect(first.headers.get('x-ratelimit-reset')).not.toBeNull();
    expect(second.status).toBe(429);
    expect(second.headers.get('retry-after')).not.toBeNull();
  });

  it('honors a caller-supplied error code', async () => {
    const fake = { check: () => false };
    const app = new Hono()
      .use('*', rateLimit(fake, () => 'k', { code: 'PLATFORM_RATE_LIMITED' }))
      .get('/x', (c) => c.json({ ok: true }));
    const res = await app.request('/x');
    expect(await res.json()).toEqual({
      error: { code: 'PLATFORM_RATE_LIMITED', message: 'rate limit exceeded' },
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run --filter @rntme/bindings-http test packages/runtime/bindings-http/test/unit/middleware/rate-limit.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `packages/runtime/bindings-http/src/middleware/rate-limit.ts`:

```ts
import type { MiddlewareHandler } from 'hono';

export type RateLimitDecision = {
  readonly allowed: boolean;
  readonly limit: number;
  readonly remaining: number;
  /** Unix seconds at which the bucket resets. */
  readonly resetAtSeconds: number;
  /** Seconds until the bucket resets. Always >= 1 when blocked. */
  readonly retryAfterSeconds: number;
};

export interface RateLimiter {
  check(key: string): boolean | RateLimitDecision | Promise<boolean | RateLimitDecision>;
}

export class InMemoryRateLimiter implements RateLimiter {
  private readonly buckets = new Map<string, { count: number; resetAtMs: number }>();
  constructor(private readonly opts: { windowMs: number; max: number }) {}

  check(key: string): RateLimitDecision {
    const now = Date.now();
    for (const [bucketKey, bucket] of this.buckets) {
      if (bucket.resetAtMs <= now) this.buckets.delete(bucketKey);
    }
    let entry = this.buckets.get(key);
    if (entry === undefined || entry.resetAtMs <= now) {
      entry = { count: 0, resetAtMs: now + this.opts.windowMs };
      this.buckets.set(key, entry);
    }
    entry.count += 1;
    const remaining = Math.max(0, this.opts.max - entry.count);
    const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetAtMs - now) / 1000));
    return {
      allowed: entry.count <= this.opts.max,
      limit: this.opts.max,
      remaining,
      resetAtSeconds: Math.ceil(entry.resetAtMs / 1000),
      retryAfterSeconds,
    };
  }
}

export type RateLimitOptions = {
  code?: string;
};

function isDecision(value: boolean | RateLimitDecision): value is RateLimitDecision {
  return typeof value === 'object' && value !== null && 'allowed' in value;
}

export function rateLimit(
  limiter: RateLimiter,
  keyFn: (c: Parameters<MiddlewareHandler>[0]) => string,
  opts: RateLimitOptions = {},
): MiddlewareHandler {
  const code = opts.code ?? 'RATE_LIMITED';
  return async (c, next) => {
    const key = keyFn(c);
    const result = await limiter.check(key);
    if (isDecision(result)) {
      c.header('X-RateLimit-Limit', String(result.limit));
      c.header('X-RateLimit-Remaining', String(result.remaining));
      c.header('X-RateLimit-Reset', String(result.resetAtSeconds));
      if (!result.allowed) {
        c.header('Retry-After', String(result.retryAfterSeconds));
        return c.json({ error: { code, message: 'rate limit exceeded' } }, 429);
      }
      await next();
      return;
    }
    if (result === false) {
      return c.json({ error: { code, message: 'rate limit exceeded' } }, 429);
    }
    await next();
  };
}
```

- [ ] **Step 4: Re-export from the barrel**

```ts
export {
  InMemoryRateLimiter,
  rateLimit,
  type RateLimiter,
  type RateLimitDecision,
  type RateLimitOptions,
} from './rate-limit.js';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun run --filter @rntme/bindings-http test packages/runtime/bindings-http/test/unit/middleware/rate-limit.test.ts`
Expected: PASS, five tests green.

- [ ] **Step 6: Commit**

```bash
git add packages/runtime/bindings-http/src/middleware/{rate-limit.ts,index.ts} packages/runtime/bindings-http/test/unit/middleware/rate-limit.test.ts
git commit -m "feat(bindings-http): lift rate-limit middleware and InMemoryRateLimiter"
```

---

### Task 8: Lift `securityHeaders` to bindings-http

**Files:**
- Create: `packages/runtime/bindings-http/src/middleware/security-headers.ts`
- Create: `packages/runtime/bindings-http/test/unit/middleware/security-headers.test.ts`
- Modify: `packages/runtime/bindings-http/src/middleware/index.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'bun:test';
import { Hono } from 'hono';
import { securityHeaders } from '../../../src/middleware/security-headers.js';

describe('securityHeaders', () => {
  it('sets nosniff and Referrer-Policy by default and no CSP', async () => {
    const app = new Hono().use('*', securityHeaders()).get('/x', (c) => c.text('ok'));
    const res = await app.request('/x');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
    expect(res.headers.get('content-security-policy')).toBeNull();
  });

  it('emits a CSP header when csp is provided', async () => {
    const app = new Hono()
      .use('*', securityHeaders({ csp: "default-src 'self'" }))
      .get('/x', (c) => c.text('ok'));
    const res = await app.request('/x');
    expect(res.headers.get('content-security-policy')).toBe("default-src 'self'");
  });

  it('skips a header when its option is set to null', async () => {
    const app = new Hono()
      .use('*', securityHeaders({ contentTypeOptions: null, referrerPolicy: null }))
      .get('/x', (c) => c.text('ok'));
    const res = await app.request('/x');
    expect(res.headers.get('x-content-type-options')).toBeNull();
    expect(res.headers.get('referrer-policy')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run --filter @rntme/bindings-http test packages/runtime/bindings-http/test/unit/middleware/security-headers.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `packages/runtime/bindings-http/src/middleware/security-headers.ts`:

```ts
import type { MiddlewareHandler } from 'hono';

export type SecurityHeadersOptions = {
  csp?: string;
  contentTypeOptions?: string | null;
  referrerPolicy?: string | null;
};

export function securityHeaders(opts: SecurityHeadersOptions = {}): MiddlewareHandler {
  const csp = opts.csp;
  const contentTypeOptions = opts.contentTypeOptions === undefined ? 'nosniff' : opts.contentTypeOptions;
  const referrerPolicy =
    opts.referrerPolicy === undefined ? 'strict-origin-when-cross-origin' : opts.referrerPolicy;
  return async (c, next) => {
    await next();
    if (csp !== undefined && csp !== '') c.res.headers.set('Content-Security-Policy', csp);
    if (contentTypeOptions !== null) c.res.headers.set('X-Content-Type-Options', contentTypeOptions);
    if (referrerPolicy !== null) c.res.headers.set('Referrer-Policy', referrerPolicy);
  };
}
```

- [ ] **Step 4: Re-export from the barrel**

```ts
export { securityHeaders, type SecurityHeadersOptions } from './security-headers.js';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun run --filter @rntme/bindings-http test packages/runtime/bindings-http/test/unit/middleware/security-headers.test.ts`
Expected: PASS, three tests green.

- [ ] **Step 6: Commit**

```bash
git add packages/runtime/bindings-http/src/middleware/{security-headers.ts,index.ts} packages/runtime/bindings-http/test/unit/middleware/security-headers.test.ts
git commit -m "feat(bindings-http): lift securityHeaders middleware with optional CSP"
```

---

### Task 9: Lift `sameOriginOnly` to bindings-http

**Files:**
- Create: `packages/runtime/bindings-http/src/middleware/same-origin.ts`
- Create: `packages/runtime/bindings-http/test/unit/middleware/same-origin.test.ts`
- Modify: `packages/runtime/bindings-http/src/middleware/index.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'bun:test';
import { Hono } from 'hono';
import { sameOriginOnly } from '../../../src/middleware/same-origin.js';

describe('sameOriginOnly', () => {
  const make = (base: string, opts?: Parameters<typeof sameOriginOnly>[1]): Hono => {
    const app = new Hono();
    app.use('*', sameOriginOnly(base, opts));
    app.post('/x', (c) => c.text('ok'));
    app.get('/x', (c) => c.text('ok'));
    return app;
  };

  it('allows a request whose Origin matches the base URL', async () => {
    const app = make('https://platform.rntme.com');
    const res = await app.request('/x', {
      method: 'POST',
      headers: { Origin: 'https://platform.rntme.com' },
    });
    expect(res.status).toBe(200);
  });

  it('allows a request whose Referer starts with the base URL', async () => {
    const app = make('https://platform.rntme.com');
    const res = await app.request('/x', {
      method: 'POST',
      headers: { Referer: 'https://platform.rntme.com/tokens' },
    });
    expect(res.status).toBe(200);
  });

  it('rejects a Referer that is the base URL with no trailing path', async () => {
    const app = make('https://platform.rntme.com');
    const res = await app.request('/x', {
      method: 'POST',
      headers: { Referer: 'https://platform.rntme.com' },
    });
    expect(res.status).toBe(403);
  });

  it('rejects a foreign Origin with the default code', async () => {
    const app = make('https://platform.rntme.com');
    const res = await app.request('/x', {
      method: 'POST',
      headers: { Origin: 'https://evil.example' },
    });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      error: { code: 'CROSS_ORIGIN_BLOCKED', message: 'cross-origin request blocked' },
    });
  });

  it('honors a caller-supplied error code', async () => {
    const app = make('https://platform.rntme.com', { code: 'PLATFORM_AUTH_CSRF' });
    const res = await app.request('/x', {
      method: 'POST',
      headers: { Origin: 'https://evil.example' },
    });
    expect(await res.json()).toEqual({
      error: { code: 'PLATFORM_AUTH_CSRF', message: 'cross-origin request blocked' },
    });
  });

  it('skips GET requests', async () => {
    const app = make('https://platform.rntme.com');
    const res = await app.request('/x');
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run --filter @rntme/bindings-http test packages/runtime/bindings-http/test/unit/middleware/same-origin.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `packages/runtime/bindings-http/src/middleware/same-origin.ts`:

```ts
import type { MiddlewareHandler } from 'hono';

export type SameOriginOptions = {
  code?: string;
};

export function sameOriginOnly(baseUrl: string, opts: SameOriginOptions = {}): MiddlewareHandler {
  const base = baseUrl.replace(/\/$/, '');
  const code = opts.code ?? 'CROSS_ORIGIN_BLOCKED';
  return async (c, next) => {
    if (c.req.method === 'GET' || c.req.method === 'HEAD' || c.req.method === 'OPTIONS') {
      return next();
    }
    const origin = c.req.header('origin');
    const referer = c.req.header('referer');
    const matches =
      (origin !== undefined && origin === base) ||
      (referer !== undefined && referer.startsWith(base + '/'));
    if (!matches) {
      return c.json({ error: { code, message: 'cross-origin request blocked' } }, 403);
    }
    return next();
  };
}
```

- [ ] **Step 4: Re-export from the barrel**

```ts
export { sameOriginOnly, type SameOriginOptions } from './same-origin.js';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun run --filter @rntme/bindings-http test packages/runtime/bindings-http/test/unit/middleware/same-origin.test.ts`
Expected: PASS, six tests green.

- [ ] **Step 6: Run the full bindings-http test suite to confirm no regression**

Run: `bun run --filter @rntme/bindings-http test`
Expected: PASS — all bindings-http tests, including the eight new middleware suites and the existing correlation, idempotency, etc., remain green.

- [ ] **Step 7: Commit**

```bash
git add packages/runtime/bindings-http/src/middleware/{same-origin.ts,index.ts} packages/runtime/bindings-http/test/unit/middleware/same-origin.test.ts
git commit -m "feat(bindings-http): lift sameOriginOnly middleware with configurable code"
```

---

### Task 10: Extend the runtime manifest schema with `cors` and `securityHeaders`

**Files:**
- Modify: `packages/runtime/runtime/src/manifest/schema.ts`
- Modify: `packages/runtime/runtime/src/manifest/types.ts`
- Modify: `packages/runtime/runtime/src/manifest/validate.ts`
- Modify: `packages/runtime/runtime/test/unit/manifest-parse.test.ts`
- Modify: `packages/runtime/runtime/test/unit/manifest-validate.test.ts`
- Modify: `packages/runtime/runtime/test/unit/env-override.test.ts`

- [ ] **Step 1: Write a failing parse test**

Open `packages/runtime/runtime/test/unit/manifest-parse.test.ts` and add the following test inside the existing top-level `describe('parseManifest', ...)` block:

```ts
it('accepts surface.http.cors and surface.http.securityHeaders', () => {
  const raw = JSON.stringify({
    rntmeVersion: '1.0',
    service: { name: 's', version: '1' },
    surface: {
      http: {
        cors: { origins: ['https://*.rntme.com'], credentials: true },
        securityHeaders: { csp: "default-src 'self'", referrerPolicy: 'no-referrer' },
      },
    },
  });
  const parsed = parseManifest(raw);
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
  expect(parsed.value.surface?.http?.cors?.origins).toEqual(['https://*.rntme.com']);
  expect(parsed.value.surface?.http?.securityHeaders?.csp).toBe("default-src 'self'");
});
```

(Use the file's existing `parseManifest` import.)

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run --filter @rntme/runtime test packages/runtime/runtime/test/unit/manifest-parse.test.ts`
Expected: FAIL with a Zod strict-mode error: `Unknown keys "cors", "securityHeaders" in surface.http`.

- [ ] **Step 3: Extend the schema**

In `packages/runtime/runtime/src/manifest/schema.ts`, add above `ManifestSchema`:

```ts
const HttpCorsSchema = z
  .object({
    origins: z.array(z.string().min(1)).optional(),
    credentials: z.boolean().optional(),
    allowHeaders: z.array(z.string().min(1)).optional(),
  })
  .strict();

const HttpSecurityHeadersSchema = z
  .object({
    csp: z.union([z.string(), z.null()]).optional(),
    contentTypeOptions: z.union([z.string(), z.null()]).optional(),
    referrerPolicy: z.union([z.string(), z.null()]).optional(),
  })
  .strict();
```

Then in the `surface.http` object literal, after `rateLimit: HttpRateLimitSchema.optional(),`, add:

```ts
cors: HttpCorsSchema.optional(),
securityHeaders: HttpSecurityHeadersSchema.optional(),
```

- [ ] **Step 4: Extend the parsed and validated manifest types**

In `packages/runtime/runtime/src/manifest/types.ts`, after the existing `ValidatedHttpRateLimitConfig` line, add:

```ts
export type HttpCorsConfig = {
  origins?: string[];
  credentials?: boolean;
  allowHeaders?: string[];
};
export type ValidatedHttpCorsConfig = {
  origins: string[];
  credentials: boolean;
  allowHeaders: string[];
};
export type HttpSecurityHeadersConfig = {
  csp?: string | null;
  contentTypeOptions?: string | null;
  referrerPolicy?: string | null;
};
export type ValidatedHttpSecurityHeadersConfig = {
  csp: string | null;
  contentTypeOptions: string | null;
  referrerPolicy: string | null;
};
```

In the `ParsedManifest['surface']['http']` literal, add fields:

```ts
cors?: HttpCorsConfig;
securityHeaders?: HttpSecurityHeadersConfig;
```

In the `ValidatedManifest['surface']['http']` literal, add:

```ts
cors: ValidatedHttpCorsConfig;
securityHeaders: ValidatedHttpSecurityHeadersConfig;
```

- [ ] **Step 5: Fill defaults in `validateManifest`**

In `packages/runtime/runtime/src/manifest/validate.ts`, inside the `surface.http` object literal returned at the end of `validateManifest`, after `rateLimit: { … }`, add:

```ts
cors: {
  origins: parsed.surface?.http?.cors?.origins ?? [],
  credentials: parsed.surface?.http?.cors?.credentials ?? true,
  allowHeaders: parsed.surface?.http?.cors?.allowHeaders ?? [
    'Content-Type',
    'Authorization',
    'X-Request-ID',
  ],
},
securityHeaders: {
  csp: parsed.surface?.http?.securityHeaders?.csp ?? null,
  contentTypeOptions: parsed.surface?.http?.securityHeaders?.contentTypeOptions ?? 'nosniff',
  referrerPolicy:
    parsed.surface?.http?.securityHeaders?.referrerPolicy ?? 'strict-origin-when-cross-origin',
},
```

- [ ] **Step 6: Add env override paths**

Still in `validate.ts`, inside `applyEnvOverrides`, add after the existing `auth` block (just before the `if (errors.length > 0)` check):

```ts
let cors = v.surface.http.cors;
if (env.RNTME_HTTP_CORS_ORIGINS !== undefined) {
  const origins = env.RNTME_HTTP_CORS_ORIGINS
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (origins.length === 0) {
    errors.push({
      code: 'MANIFEST_INVALID_TYPE',
      path: 'surface.http.cors.origins (from RNTME_HTTP_CORS_ORIGINS)',
      message: 'RNTME_HTTP_CORS_ORIGINS must list at least one origin',
    });
  } else {
    cors = { ...cors, origins };
  }
}

let securityHeaders = v.surface.http.securityHeaders;
if (env.RNTME_HTTP_CSP !== undefined) {
  const csp = env.RNTME_HTTP_CSP === '' ? null : env.RNTME_HTTP_CSP;
  securityHeaders = { ...securityHeaders, csp };
}
```

Update the returned `surface.http` literal to merge `cors` and `securityHeaders`:

```ts
surface: {
  http: { ...v.surface.http, port, cors, securityHeaders },
  grpc: v.surface.grpc,
},
```

- [ ] **Step 7: Add validate and env-override tests**

In `packages/runtime/runtime/test/unit/manifest-validate.test.ts`, append:

```ts
it('fills CORS and security-header defaults when manifest omits them', () => {
  const parsed = parseManifest(JSON.stringify({
    rntmeVersion: '1.0',
    service: { name: 's', version: '1' },
  }));
  if (!parsed.ok) throw new Error('parse failed');
  const v = validateManifest(parsed.value, { major: 1, minor: 0, patch: 0 });
  if (!v.ok) throw new Error(JSON.stringify(v.errors));
  expect(v.value.surface.http.cors).toEqual({
    origins: [],
    credentials: true,
    allowHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  });
  expect(v.value.surface.http.securityHeaders).toEqual({
    csp: null,
    contentTypeOptions: 'nosniff',
    referrerPolicy: 'strict-origin-when-cross-origin',
  });
});
```

In `packages/runtime/runtime/test/unit/env-override.test.ts`:

a) Update the existing top-level `const base: ValidatedManifest = { ... }` literal so its `surface.http` block includes the new fields (the file will not compile otherwise once `ValidatedManifest['surface']['http']` requires them):

```ts
surface: {
  http: {
    enabled: true,
    port: 3000,
    bodyLimit: { enabled: true, maxBytes: 1_048_576 },
    rateLimit: { enabled: true, windowMs: 60_000, max: 600 },
    cors: {
      origins: [],
      credentials: true,
      allowHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    },
    securityHeaders: {
      csp: null,
      contentTypeOptions: 'nosniff',
      referrerPolicy: 'strict-origin-when-cross-origin',
    },
  },
},
```

b) Inside the existing `describe('applyEnvOverrides', ...)` block, append:

```ts
it('overrides cors origins from RNTME_HTTP_CORS_ORIGINS and CSP from RNTME_HTTP_CSP', () => {
  const out = applyEnvOverrides(base, {
    RNTME_HTTP_CORS_ORIGINS: 'https://a.example, https://*.b.example',
    RNTME_HTTP_CSP: "default-src 'self'",
  });
  if (!out.ok) throw new Error(JSON.stringify(out.errors));
  expect(out.value.surface.http.cors.origins).toEqual([
    'https://a.example',
    'https://*.b.example',
  ]);
  expect(out.value.surface.http.securityHeaders.csp).toBe("default-src 'self'");
});

it('disables CSP when RNTME_HTTP_CSP is the empty string', () => {
  const out = applyEnvOverrides(base, { RNTME_HTTP_CSP: '' });
  if (!out.ok) throw new Error(JSON.stringify(out.errors));
  expect(out.value.surface.http.securityHeaders.csp).toBeNull();
});

it('rejects RNTME_HTTP_CORS_ORIGINS that resolves to zero origins', () => {
  const out = applyEnvOverrides(base, { RNTME_HTTP_CORS_ORIGINS: ' , ' });
  expect(out.ok).toBe(false);
});
```

If any other existing test files in the runtime package construct a `ValidatedManifest` literal inline, update them in the same fashion — type errors will pinpoint each one when typecheck runs in step 8.

- [ ] **Step 8: Run the manifest tests**

Run: `bun run --filter @rntme/runtime test packages/runtime/runtime/test/unit/manifest-parse.test.ts packages/runtime/runtime/test/unit/manifest-validate.test.ts packages/runtime/runtime/test/unit/env-override.test.ts`
Expected: PASS for all manifest tests, including the new ones.

- [ ] **Step 9: Commit**

```bash
git add packages/runtime/runtime/src/manifest/{schema.ts,types.ts,validate.ts} packages/runtime/runtime/test/unit/{manifest-parse,manifest-validate,env-override}.test.ts
git commit -m "feat(runtime): manifest fields for surface.http.cors and securityHeaders"
```

---

### Task 11: Add `logger` to `RuntimeConfig`

**Files:**
- Modify: `packages/runtime/runtime/src/start/runtime-config.ts`
- Modify: `packages/runtime/runtime/test/unit/runtime-config.test.ts`

- [ ] **Step 1: Write the failing config test**

In `packages/runtime/runtime/test/unit/runtime-config.test.ts`, add:

```ts
it('accepts a pino-shaped logger', () => {
  const result = validateRuntimeConfig({ logger: { info() {}, error() {} } });
  expect(result.ok).toBe(true);
});

it('rejects a logger that is not an object with info+error', () => {
  const result = validateRuntimeConfig({ logger: { info: 'no' } });
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.errors[0]?.code).toBe('RUNTIME_CONFIG_LOGGER_INVALID');
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run --filter @rntme/runtime test packages/runtime/runtime/test/unit/runtime-config.test.ts`
Expected: FAIL — `RuntimeConfig` accepts no `logger` field, so the second test asserts a specific error code that does not exist.

- [ ] **Step 3: Add the field and validator**

In `packages/runtime/runtime/src/start/runtime-config.ts`:

a) Extend the imports:

```ts
import type pino from 'pino';
```

b) Add the field to the `RuntimeConfig` type:

```ts
logger?: pino.Logger;
```

c) Add `'RUNTIME_CONFIG_LOGGER_INVALID'` to the `RuntimeConfigValidationErrorCode` union.

d) In `validateRuntimeConfig`, after `validateShutdownTimeout(...)`, add:

```ts
validateLogger(config, errors);
```

e) Add the validator:

```ts
function validateLogger(
  config: Record<string, unknown>,
  errors: RuntimeConfigValidationError[],
): void {
  const logger = config.logger;
  if (logger === undefined) return;
  if (
    !isRecord(logger) ||
    typeof logger.info !== 'function' ||
    typeof logger.error !== 'function'
  ) {
    errors.push({
      code: 'RUNTIME_CONFIG_LOGGER_INVALID',
      path: 'logger',
      message: 'logger must expose info(obj, msg) and error(obj, msg) methods',
    });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run --filter @rntme/runtime test packages/runtime/runtime/test/unit/runtime-config.test.ts`
Expected: PASS, both new tests green.

- [ ] **Step 5: Commit**

```bash
git add packages/runtime/runtime/src/start/runtime-config.ts packages/runtime/runtime/test/unit/runtime-config.test.ts
git commit -m "feat(runtime): RuntimeConfig.logger field with structural validation"
```

---

### Task 12: Wire HttpSurface to apply default-on middleware

**Files:**
- Modify: `packages/runtime/runtime/src/plugins/http-surface.ts` (full rewrite)
- Modify: `packages/runtime/runtime/src/start/start-service.ts` (HttpSurface options)
- Modify: `packages/runtime/runtime/test/integration/startup.test.ts:76,101` (body-limit envelope assertions)
- Create: `packages/runtime/runtime/test/integration/http-surface-default-middleware.test.ts`

- [ ] **Step 1: Write the failing integration test**

Create `packages/runtime/runtime/test/integration/http-surface-default-middleware.test.ts`:

```ts
import { describe, it, expect, afterEach } from 'bun:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, cpSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { loadService } from '../../src/load/load-service.js';
import { startService } from '../../src/start/start-service.js';
import type { RunningService } from '../../src/types.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = join(here, '..', 'fixtures', 'issue-tracker');

let running: RunningService | null = null;
afterEach(async () => {
  if (running) await running.stop();
  running = null;
});

function cloneFixture(overrides?: (m: Record<string, unknown>) => void): string {
  const dir = mkdtempSync(join(tmpdir(), 'rntme-http-default-mw-'));
  cpSync(fixture, dir, { recursive: true });
  const manifestPath = join(dir, 'manifest.json');
  const m = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, unknown>;
  overrides?.(m);
  writeFileSync(manifestPath, JSON.stringify(m));
  return dir;
}

describe('HttpSurface default-on middleware', () => {
  it('echoes X-Request-ID and emits security headers on /health', async () => {
    const dir = cloneFixture();
    const loaded = loadService(dir);
    if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
    running = await startService(loaded.value);
    const res = await fetch(`http://127.0.0.1:${running.httpPort}/health`, {
      headers: { 'x-request-id': 'rid-1' },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('x-request-id')).toBe('rid-1');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
    expect(res.headers.get('content-security-policy')).toBeNull();
  });

  it('emits CSP and CORS reflection when configured in the manifest', async () => {
    const dir = cloneFixture((m) => {
      const surface = (m.surface = (m.surface as Record<string, unknown>) ?? {});
      const http = (surface.http = (surface.http as Record<string, unknown>) ?? {});
      http.cors = { origins: ['https://allowed.example'] };
      http.securityHeaders = { csp: "default-src 'self'" };
    });
    const loaded = loadService(dir);
    if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
    running = await startService(loaded.value);

    const res = await fetch(`http://127.0.0.1:${running.httpPort}/health`, {
      headers: { origin: 'https://allowed.example' },
    });
    expect(res.headers.get('content-security-policy')).toBe("default-src 'self'");
    expect(res.headers.get('access-control-allow-origin')).toBe('https://allowed.example');
  });

  it('returns the configured 500 envelope when a route throws', async () => {
    const dir = cloneFixture();
    const loaded = loadService(dir);
    if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
    running = await startService(loaded.value);

    // The issue-tracker fixture has no route that throws on demand; assert that
    // /api/openapi.json (which exists) returns 200 and that an unknown route
    // returns a JSON 404 — the runtime's onError still applies if a downstream
    // handler ever throws. Most coverage of errorHandler lives in the bindings-http
    // unit tests; this integration test only confirms the wiring exists.
    const ok = await fetch(`http://127.0.0.1:${running.httpPort}/api/openapi.json`);
    expect(ok.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run --filter @rntme/runtime test packages/runtime/runtime/test/integration/http-surface-default-middleware.test.ts`
Expected: FAIL — the manifest has no `cors`/`securityHeaders` defaults applied to the response yet (the fixture currently has no CSP, no Referrer-Policy header on `/health`).

- [ ] **Step 3: Rewrite `HttpSurface.mount`**

Replace the contents of `packages/runtime/runtime/src/plugins/http-surface.ts` with:

```ts
import type { Hono } from 'hono';
import pino, { type Logger } from 'pino';
import {
  createBindingsRouter,
  correlationMiddleware,
  requestId,
  requestLogger,
  cors,
  errorHandler,
  securityHeaders,
  bodyLimit,
  rateLimit,
  InMemoryRateLimiter,
  type CorrelationVariables,
} from '@rntme/bindings-http';
import type { OperationExecutor } from '@rntme/bindings-http/operation-contract';
import { createApp as createUiApp } from '@rntme/ui-runtime';
import type { Surface, SurfaceContext } from './interfaces.js';
import { mountObservability, type Metrics, type HealthProbe } from './observability.js';

export type HttpSurfaceOptions = {
  healthPath: string;
  metricsPath: string;
  metrics: Metrics;
  healthProbe: HealthProbe;
  operationExecutor: OperationExecutor;
  logger?: Logger;
};

export type { CorrelationVariables };

export class HttpSurface implements Surface {
  constructor(private readonly opts: HttpSurfaceOptions) {}

  async mount(app: Hono, ctx: SurfaceContext): Promise<void> {
    const logger = this.opts.logger ?? pino({ level: 'info', name: ctx.service.manifest.service.name });
    const httpCfg = ctx.service.manifest.surface.http;

    app.use('*', requestId());
    app.use('*', requestLogger({ logger }));
    app.onError(errorHandler({ logger }));
    if (httpCfg.cors.origins.length > 0) {
      app.use(
        '*',
        cors({
          origins: httpCfg.cors.origins,
          credentials: httpCfg.cors.credentials,
          allowHeaders: httpCfg.cors.allowHeaders,
        }),
      );
    }
    app.use(
      '*',
      securityHeaders({
        ...(httpCfg.securityHeaders.csp === null ? {} : { csp: httpCfg.securityHeaders.csp }),
        contentTypeOptions: httpCfg.securityHeaders.contentTypeOptions,
        referrerPolicy: httpCfg.securityHeaders.referrerPolicy,
      }),
    );

    const routerOpts: Parameters<typeof createBindingsRouter>[0] = {
      validated: ctx.service.bindings,
      graphSpec: ctx.service.graphSpec,
      pdm: ctx.service.pdm,
      qsm: ctx.service.qsm,
      db: ctx.qsmDb,
      eventStore: ctx.eventStore,
      actorFromRequest: ctx.actorFromRequest,
      openApiDoc: ctx.service.openApiDoc,
      operationExecutor: this.opts.operationExecutor,
    };
    const router = createBindingsRouter(routerOpts);

    app.get('/service.json', (c) =>
      c.json({
        name: ctx.service.manifest.service.name,
        version: ctx.service.manifest.service.version,
        rntmeVersion: ctx.service.manifest.rntmeVersion,
      }),
    );
    mountObservability(app, {
      healthPath: this.opts.healthPath,
      metricsPath: this.opts.metricsPath,
      probe: this.opts.healthProbe,
      metrics: this.opts.metrics,
    });

    const uiApp = createUiApp({
      artifact: ctx.service.compiledUi,
      ...(ctx.service.uiAssetsDir === null ? {} : { assetsDir: ctx.service.uiAssetsDir }),
    });

    if (httpCfg.bodyLimit.enabled) {
      app.use('/api/*', bodyLimit(httpCfg.bodyLimit.maxBytes));
    }
    if (httpCfg.rateLimit.enabled) {
      const limiter = new InMemoryRateLimiter({
        windowMs: httpCfg.rateLimit.windowMs,
        max: httpCfg.rateLimit.max,
      });
      // Per-process bucket — Hono's Node adapter cannot expose a trusted peer
      // address. The same conservative default the previous inline limiter used.
      app.use('/api/*', rateLimit(limiter, () => 'process'));
    }
    app.use('/api/*', correlationMiddleware());
    app.route('/api', router);

    app.route('/', uiApp);
  }
}
```

The previous inline `bodyLimitMiddleware` and `createInMemoryRateLimiter` helpers are deleted from this file — the canonical implementations now live in `@rntme/bindings-http`.

- [ ] **Step 4: Pipe `RuntimeConfig.logger` through `startService`**

In `packages/runtime/runtime/src/start/start-service.ts`, in the surfaces default block:

```ts
const surfaces =
  runtimeConfig.surfaces ??
  [
    new HttpSurface({
      healthPath: service.manifest.observability.health.path,
      metricsPath: service.manifest.observability.metrics.path,
      metrics,
      healthProbe: probe,
      operationExecutor,
      ...(runtimeConfig.logger ? { logger: runtimeConfig.logger } : {}),
    }),
  ];
```

- [ ] **Step 5: Update existing runtime tests that assert the old body-limit envelope**

Pre-existing tests in `packages/runtime/runtime/test/integration/startup.test.ts` assert `{ error: 'REQUEST_BODY_TOO_LARGE', maxBytes: 8 }` (lines 76 and 101). The lifted `bodyLimit` emits `{ error: { code, message } }`. Update both assertions to:

```ts
expect(res.status).toBe(413);
const body = (await res.json()) as { error: { code: string; message: string } };
expect(body.error.code).toBe('BODY_LIMIT_EXCEEDED');
expect(body.error.message).toBe('body exceeds 8 bytes');
```

The rate-limit assertions on `Retry-After` / `X-RateLimit-*` headers (startup.test.ts lines 115-117) keep passing — Task 7's rich `RateLimitDecision` preserves those headers.

- [ ] **Step 6: Run the integration test**

Run: `bun run --filter @rntme/runtime test packages/runtime/runtime/test/integration/http-surface-default-middleware.test.ts`
Expected: PASS, three tests green.

- [ ] **Step 7: Run the full runtime suite**

Run: `bun run --filter @rntme/runtime test`
Expected: PASS — all existing runtime tests stay green, including the updated `startup.test.ts`. `correlation-e2e.test.ts` keeps passing because correlation is still mounted under `/api/*`.

- [ ] **Step 8: Commit**

```bash
git add packages/runtime/runtime/src/plugins/http-surface.ts packages/runtime/runtime/src/start/start-service.ts packages/runtime/runtime/test/integration/http-surface-default-middleware.test.ts packages/runtime/runtime/test/integration/startup.test.ts
git commit -m "feat(runtime): apply requestId/logger/cors/security/error default-on in HttpSurface"
```

---

### Task 13: Carve `errorEnvelope` and `statusForCode` out of platform-http middleware

**Files:**
- Create: `apps/platform-http/src/error-codes.ts`
- Create: `apps/platform-http/test/unit/error-codes.test.ts`
- Modify: `apps/platform-http/src/routes/helpers.ts:5`

- [ ] **Step 1: Write the failing test**

Create `apps/platform-http/test/unit/error-codes.test.ts`:

```ts
import { describe, it, expect } from 'bun:test';
import { errorEnvelope, statusForCode } from '../../src/error-codes.js';

describe('error-codes', () => {
  it('maps known PLATFORM_* codes to HTTP statuses', () => {
    expect(statusForCode('PLATFORM_AUTH_MISSING')).toBe(401);
    expect(statusForCode('PLATFORM_AUTH_FORBIDDEN')).toBe(403);
    expect(statusForCode('PLATFORM_TENANCY_PROJECT_NOT_FOUND')).toBe(404);
    expect(statusForCode('PLATFORM_CONFLICT_SLUG_TAKEN')).toBe(409);
    expect(statusForCode('PLATFORM_TENANCY_RESOURCE_ARCHIVED')).toBe(410);
    expect(statusForCode('PLATFORM_VALIDATION_BUNDLE_FAILED')).toBe(422);
    expect(statusForCode('PLATFORM_RATE_LIMITED')).toBe(429);
    expect(statusForCode('PLATFORM_STORAGE_DB_UNAVAILABLE')).toBe(503);
  });
  it('errorEnvelope shapes the JSON body', () => {
    const e = errorEnvelope([{ code: 'PLATFORM_INTERNAL', message: 'oops' }]);
    expect(e.error.code).toBe('PLATFORM_INTERNAL');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run --filter @rntme/platform-http test apps/platform-http/test/unit/error-codes.test.ts`
Expected: FAIL — `apps/platform-http/src/error-codes.ts` does not exist.

- [ ] **Step 3: Move the helpers**

Create `apps/platform-http/src/error-codes.ts` with these contents (lifted verbatim from `apps/platform-http/src/middleware/error-handler.ts:1-59`):

```ts
import type { PlatformError, ErrorCode } from '@rntme/platform-core';

const STATUS: Partial<Record<ErrorCode, number>> = {
  PLATFORM_AUTH_MISSING: 401,
  PLATFORM_AUTH_INVALID: 401,
  PLATFORM_AUTH_TOKEN_REVOKED: 401,
  PLATFORM_AUTH_TOKEN_EXPIRED: 401,
  PLATFORM_AUTH_FORBIDDEN: 403,
  PLATFORM_PARSE_BODY_INVALID: 400,
  PLATFORM_PARSE_PATH_INVALID: 400,
  PLATFORM_TENANCY_ORG_NOT_FOUND: 404,
  PLATFORM_TENANCY_PROJECT_NOT_FOUND: 404,
  PLATFORM_TENANCY_SERVICE_NOT_FOUND: 404,
  PLATFORM_TENANCY_VERSION_NOT_FOUND: 404,
  PLATFORM_TENANCY_RESOURCE_ARCHIVED: 410,
  PLATFORM_VALIDATION_BUNDLE_FAILED: 422,
  PROJECT_VERSION_BUNDLE_PARSE_ERROR: 400,
  PROJECT_VERSION_BUNDLE_INVALID_SHAPE: 400,
  PROJECT_VERSION_BUNDLE_TOO_LARGE: 413,
  PROJECT_VERSION_BLUEPRINT_INVALID: 422,
  PROJECT_VERSION_DIGEST_MISMATCH: 400,
  PROJECT_VERSION_NOT_FOUND: 404,
  PLATFORM_STORAGE_BLOB_UPLOAD_FAILED: 502,
  PLATFORM_STORAGE_DB_UNAVAILABLE: 503,
  PLATFORM_CONCURRENCY_VERSION_CONFLICT: 409,
  PLATFORM_CONCURRENCY_LAST_OWNER: 409,
  PLATFORM_CONFLICT_SLUG_TAKEN: 409,
  DEPLOY_TARGET_SLUG_TAKEN: 409,
  DEPLOY_TARGET_NOT_FOUND: 404,
  DEPLOY_TARGET_IN_USE: 409,
  DEPLOY_REQUEST_TARGET_NOT_FOUND: 404,
  DEPLOY_REQUEST_VERSION_NOT_FOUND: 404,
  DEPLOYMENT_INVALID_TRANSITION: 409,
  DEPLOYMENT_NOT_FOUND: 404,
  PLATFORM_RATE_LIMITED: 429,
  PLATFORM_INTERNAL: 500,
  PLATFORM_WORKOS_WEBHOOK_INVALID: 400,
  PLATFORM_WORKOS_UNAVAILABLE: 503,
  PROJECT_OPERATION_NOT_FOUND: 404,
  PROJECT_OPERATION_ACTIVE_DEPLOYMENT: 409,
  PROJECT_OPERATION_DEFAULT_TARGET_MISSING: 409,
  PROJECT_OPERATION_INVALID_STATE: 409,
  PROJECT_OPERATION_CONFIRMATION_MISMATCH: 400,
  PROJECT_OPERATION_BUNDLE_SOURCE_CONFLICT: 400,
  PROJECT_OPERATION_DELETE_TEARDOWN_FAILED: 500,
};

export function statusForCode(code: ErrorCode): number {
  return STATUS[code] ?? 500;
}

export function errorEnvelope(
  errors: readonly PlatformError[],
): { error: PlatformError; errors?: readonly PlatformError[] } {
  const first = errors[0] ?? { code: 'PLATFORM_INTERNAL', message: 'unknown' };
  return errors.length > 1 ? { error: first, errors } : { error: first };
}
```

- [ ] **Step 4: Update the existing route helper import**

In `apps/platform-http/src/routes/helpers.ts`, change line 5 from:

```ts
import { errorEnvelope, statusForCode } from '../middleware/error-handler.js';
```

to:

```ts
import { errorEnvelope, statusForCode } from '../error-codes.js';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun run --filter @rntme/platform-http test apps/platform-http/test/unit/error-codes.test.ts`
Expected: PASS, both tests green.

- [ ] **Step 6: Commit**

```bash
git add apps/platform-http/src/error-codes.ts apps/platform-http/src/routes/helpers.ts apps/platform-http/test/unit/error-codes.test.ts
git commit -m "refactor(platform-http): split errorEnvelope+statusForCode out of error-handler"
```

---

### Task 14: Carve `PostgresRateLimiter` out of platform-http middleware

**Files:**
- Create: `apps/platform-http/src/postgres-rate-limiter.ts`
- Create: `apps/platform-http/test/unit/postgres-rate-limiter.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/platform-http/test/unit/postgres-rate-limiter.test.ts`:

```ts
import { describe, it, expect, mock } from 'bun:test';
import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { Hono } from 'hono';
import { rateLimit } from '@rntme/bindings-http';
import { PostgresRateLimiter } from '../../src/postgres-rate-limiter.js';

describe('PostgresRateLimiter', () => {
  it('uses the database count, hashes the limiter key, and returns a rich decision', async () => {
    const query = mock()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: 1 }] });
    const limiter = new PostgresRateLimiter({ db: { query } as never, windowMs: 60_000, max: 2 });

    const decision = await limiter.check('account-raw-id');
    expect(decision.allowed).toBe(true);
    expect(decision.limit).toBe(2);
    expect(decision.remaining).toBe(1);

    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[0]?.[0]).toContain('DELETE FROM platform_rate_limit');
    const values = query.mock.calls[1]?.[1] as unknown[];
    expect(Buffer.isBuffer(values[0])).toBe(true);
    expect((values[0] as Buffer).toString('hex')).toBe(
      createHash('sha256').update('account-raw-id').digest('hex'),
    );
    expect(values).not.toContain('account-raw-id');
  });

  it('rejects when the database count exceeds max', async () => {
    const query = mock()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: 3 }] });
    const limiter = new PostgresRateLimiter({ db: { query } as never, windowMs: 60_000, max: 2 });
    const decision = await limiter.check('token-raw-id');
    expect(decision.allowed).toBe(false);
    expect(decision.remaining).toBe(0);
    expect(decision.retryAfterSeconds).toBeGreaterThanOrEqual(1);
  });

  it('returns 429 with PLATFORM_RATE_LIMITED via the bindings-http rateLimit wrapper', async () => {
    const query = mock()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: 3 }] });
    const limiter = new PostgresRateLimiter({ db: { query } as never, windowMs: 60_000, max: 2 });
    const app = new Hono()
      .use('*', rateLimit(limiter, () => 'account-raw-id', { code: 'PLATFORM_RATE_LIMITED' }))
      .get('/limited', (c) => c.json({ ok: true }));

    const res = await app.request('/limited');
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).not.toBeNull();
    expect(res.headers.get('x-ratelimit-limit')).toBe('2');
    await expect(res.json()).resolves.toEqual({
      error: { code: 'PLATFORM_RATE_LIMITED', message: 'rate limit exceeded' },
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run --filter @rntme/platform-http test apps/platform-http/test/unit/postgres-rate-limiter.test.ts`
Expected: FAIL — `apps/platform-http/src/postgres-rate-limiter.ts` does not exist.

- [ ] **Step 3: Move the limiter**

Create `apps/platform-http/src/postgres-rate-limiter.ts` (lifted from `apps/platform-http/src/middleware/rate-limit.ts:1-58`, returning the rich `RateLimitDecision` so it composes with the bindings-http `rateLimit` wrapper's header emission):

```ts
import { createHash } from 'node:crypto';
import type { RateLimiter, RateLimitDecision } from '@rntme/bindings-http';

type Queryable = {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    values?: readonly unknown[],
  ): Promise<{ rows: T[] }>;
};

export class PostgresRateLimiter implements RateLimiter {
  private lastCleanupMs = 0;

  constructor(private readonly opts: { db: Queryable; windowMs: number; max: number }) {}

  async check(key: string): Promise<RateLimitDecision> {
    const now = Date.now();
    if (now - this.lastCleanupMs >= this.opts.windowMs) {
      this.lastCleanupMs = now;
      await this.opts.db.query(
        `DELETE FROM platform_rate_limit WHERE expires_at < $1`,
        [new Date(now)],
      );
    }

    const bucketKeyHash = createHash('sha256').update(key).digest();
    const windowStartMs = Math.floor(now / this.opts.windowMs) * this.opts.windowMs;
    const windowStart = new Date(windowStartMs);
    const resetAtMs = windowStartMs + this.opts.windowMs;
    const expiresAt = new Date(resetAtMs);
    const result = await this.opts.db.query<{ count: number }>(
      `INSERT INTO platform_rate_limit (bucket_key_hash, window_start, count, expires_at)
       VALUES ($1, $2, 1, $3)
       ON CONFLICT (bucket_key_hash, window_start)
       DO UPDATE SET count = platform_rate_limit.count + 1, expires_at = EXCLUDED.expires_at
       RETURNING count`,
      [bucketKeyHash, windowStart, expiresAt],
    );
    const count = Number(result.rows[0]?.count ?? 0);
    const remaining = Math.max(0, this.opts.max - count);
    return {
      allowed: count <= this.opts.max,
      limit: this.opts.max,
      remaining,
      resetAtSeconds: Math.ceil(resetAtMs / 1000),
      retryAfterSeconds: Math.max(1, Math.ceil((resetAtMs - now) / 1000)),
    };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run --filter @rntme/platform-http test apps/platform-http/test/unit/postgres-rate-limiter.test.ts`
Expected: PASS, three tests green.

- [ ] **Step 5: Commit**

```bash
git add apps/platform-http/src/postgres-rate-limiter.ts apps/platform-http/test/unit/postgres-rate-limiter.test.ts
git commit -m "refactor(platform-http): split PostgresRateLimiter out of middleware/rate-limit"
```

---

### Task 15: Switch `apps/platform-http/src/app.ts` to import from `@rntme/bindings-http`

**Files:**
- Modify: `apps/platform-http/src/app.ts`

- [ ] **Step 1: Replace the middleware imports**

In `apps/platform-http/src/app.ts`, replace the import block at lines 10-17:

```ts
import { requestId } from './middleware/request-id.js';
import { loggerMiddleware } from './middleware/logger.js';
import { errorHandler } from './middleware/error-handler.js';
import { corsMiddleware } from './middleware/cors.js';
import { rateLimit, PostgresRateLimiter } from './middleware/rate-limit.js';
import { bodyLimit } from './middleware/body-limit.js';
import { requireAuth } from './middleware/auth.js';
import { openOrgScopedTx } from './middleware/tx.js';
```

with:

```ts
import {
  requestId,
  requestLogger,
  errorHandler,
  cors,
  rateLimit,
  bodyLimit,
} from '@rntme/bindings-http';
import { PostgresRateLimiter } from './postgres-rate-limiter.js';
import { requireAuth } from './middleware/auth.js';
import { openOrgScopedTx } from './middleware/tx.js';
```

- [ ] **Step 2: Update the call sites to keep the platform-http response shape**

a) Replace each `loggerMiddleware(deps.logger)` call (lines 122 and 208) with `requestLogger({ logger: deps.logger })`.

b) Replace each `errorHandler(deps.logger)` call (lines 123 and 209) with `errorHandler({ logger: deps.logger, code: 'PLATFORM_INTERNAL' })`.

c) Replace each `corsMiddleware(deps.env.PLATFORM_CORS_ORIGINS)` call (lines 124 and 210) with:

```ts
cors({
  origins: deps.env.PLATFORM_CORS_ORIGINS.split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0),
}),
```

d) In the pre-auth body-size guard at lines 215-222, replace `bodyLimit(cap)` with `bodyLimit(cap, { code: 'PLATFORM_PARSE_BODY_INVALID' })` to preserve the existing platform error code.

e) In the authed sub-app middleware at line 283, replace `rateLimit(rateLimiter, …)` with `rateLimit(rateLimiter, (c) => c.get('subject').tokenId ?? c.get('subject').account.id, { code: 'PLATFORM_RATE_LIMITED' })`.

- [ ] **Step 3: Run the platform-http suite**

Run: `bun run --filter @rntme/platform-http test`
Expected: PASS — every existing platform-http test (including `app.test.ts`, deployment flows, route tests, and the still-present `auth.test.ts` / `tx.test.ts`) stays green. The previously-imported file paths are still alive because the deletion happens in Task 17, so the in-tree module resolution is unaffected.

- [ ] **Step 4: Run typecheck**

Run: `bun run --filter @rntme/platform-http typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/platform-http/src/app.ts
git commit -m "refactor(platform-http): import middleware from @rntme/bindings-http"
```

---

### Task 16: Switch `apps/platform-http/src/ui/app.tsx` to import from `@rntme/bindings-http`

**Files:**
- Modify: `apps/platform-http/src/ui/app.tsx:9-10`, line 81, lines 90/241/317/423/444/567

- [ ] **Step 1: Replace the imports**

In `apps/platform-http/src/ui/app.tsx`, replace lines 9-10:

```ts
import { sameOriginOnly } from '../middleware/same-origin.js';
import { securityHeaders } from '../middleware/security-headers.js';
```

with:

```ts
import { sameOriginOnly, securityHeaders } from '@rntme/bindings-http';
```

- [ ] **Step 2: Pass platform-flavored options at every call site**

a) Replace the line `app.use('*', securityHeaders());` (around line 81) with the call below to keep the existing CSP. Use the exact CSP string the platform UI ships today.

```ts
app.use(
  '*',
  securityHeaders({
    csp: [
      "default-src 'self'",
      "script-src 'self' https://cdn.tailwindcss.com https://unpkg.com",
      "style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com",
      "connect-src 'self'",
      "img-src 'self' data:",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  }),
);
```

b) Replace each `sameOriginOnly(deps.env.PLATFORM_BASE_URL)` call (lines 90, 241, 317, 423, 444, 567) with `sameOriginOnly(deps.env.PLATFORM_BASE_URL, { code: 'PLATFORM_AUTH_CSRF' })` to preserve the platform CSRF code.

- [ ] **Step 3: Run the platform-http suite (UI sub-app coverage)**

Run: `bun run --filter @rntme/platform-http test`
Expected: PASS — UI route tests confirm the `PLATFORM_AUTH_CSRF` envelope and the CSP/Referrer-Policy/X-Content-Type-Options headers stay identical.

- [ ] **Step 4: Commit**

```bash
git add apps/platform-http/src/ui/app.tsx
git commit -m "refactor(platform-http): import securityHeaders + sameOriginOnly from @rntme/bindings-http"
```

---

### Task 17: Delete the old platform-http middleware files

**Files:**
- Delete: `apps/platform-http/src/middleware/request-id.ts`
- Delete: `apps/platform-http/src/middleware/logger.ts`
- Delete: `apps/platform-http/src/middleware/error-handler.ts`
- Delete: `apps/platform-http/src/middleware/cors.ts`
- Delete: `apps/platform-http/src/middleware/body-limit.ts`
- Delete: `apps/platform-http/src/middleware/rate-limit.ts`
- Delete: `apps/platform-http/src/middleware/security-headers.ts`
- Delete: `apps/platform-http/src/middleware/same-origin.ts`
- Delete: `apps/platform-http/test/unit/middleware/request-id.test.ts`
- Delete: `apps/platform-http/test/unit/middleware/error-handler.test.ts`
- Delete: `apps/platform-http/test/unit/middleware/cors.test.ts`
- Delete: `apps/platform-http/test/unit/middleware/body-limit.test.ts`
- Delete: `apps/platform-http/test/unit/middleware/rate-limit.test.ts`
- Delete: `apps/platform-http/test/unit/middleware/security-headers.test.ts`
- Delete: `apps/platform-http/test/unit/middleware/same-origin.test.ts`

- [ ] **Step 1: Confirm no remaining imports**

Run: `rg -n "from '\.\./middleware/(request-id|logger|error-handler|cors|body-limit|rate-limit|security-headers|same-origin)|from '\./middleware/(request-id|logger|error-handler|cors|body-limit|rate-limit|security-headers|same-origin)" apps/platform-http`
Expected: empty output. Any match means a call site (or a test) was missed in Tasks 13-16; fix that file before proceeding.

- [ ] **Step 2: Delete the source files and tests**

Run:

```bash
rm apps/platform-http/src/middleware/{request-id,logger,error-handler,cors,body-limit,rate-limit,security-headers,same-origin}.ts
rm apps/platform-http/test/unit/middleware/{request-id,error-handler,cors,body-limit,rate-limit,security-headers,same-origin}.test.ts
```

`apps/platform-http/src/middleware/{auth,tx}.ts` and `apps/platform-http/test/unit/middleware/{auth,tx}.test.ts` remain.

- [ ] **Step 3: Run the platform-http suite**

Run: `bun run --filter @rntme/platform-http test`
Expected: PASS, with the deleted files no longer compiled or executed.

- [ ] **Step 4: Run typecheck and lint for platform-http**

Run: `bun run --filter @rntme/platform-http typecheck && bun run --filter @rntme/platform-http lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git rm apps/platform-http/src/middleware/{request-id,logger,error-handler,cors,body-limit,rate-limit,security-headers,same-origin}.ts apps/platform-http/test/unit/middleware/{request-id,error-handler,cors,body-limit,rate-limit,security-headers,same-origin}.test.ts
git commit -m "refactor(platform-http): remove generic middleware now lifted to bindings-http"
```

---

### Task 18: Update owner docs and root navigation

**Files:**
- Modify: `docs/current/owners/packages/runtime/bindings-http.md`
- Modify: `docs/current/owners/packages/runtime/runtime.md`
- Modify: `docs/current/owners/apps/platform-http.md`

- [ ] **Step 1: Update `bindings-http.md`**

In the `## API` table or its closest equivalent, add rows for the new exports:

| Export | Signature | Purpose |
|---|---|---|
| `requestId` | `() => MiddlewareHandler` | Echo or mint `X-Request-ID`; sets `c.var.requestId`. |
| `requestLogger` | `(opts: { logger: pino.Logger }) => MiddlewareHandler` | Pino-logged request access log. |
| `errorHandler` | `(opts?: ErrorHandlerOptions) => Hono ErrorHandler` | Generic 500 envelope; configurable `code` and `message`. |
| `cors` | `(opts: CorsOptions) => MiddlewareHandler` | Wildcard-aware CORS using `isAllowedOrigin`. |
| `bodyLimit` | `(maxBytes: number, opts?) => MiddlewareHandler` | 413 with configurable `code`. |
| `rateLimit` / `InMemoryRateLimiter` / `RateLimitDecision` | function + class + type | Generic Hono adapter, per-process bucket limiter, and rich decision shape that drives `X-RateLimit-*` and `Retry-After` headers when emitted. |
| `securityHeaders` | `(opts?: SecurityHeadersOptions) => MiddlewareHandler` | CSP / nosniff / referrer-policy with opt-outs via `null`. |
| `sameOriginOnly` | `(baseUrl: string, opts?) => MiddlewareHandler` | Same-origin-or-allowed-Referer guard for non-GET methods. |

Add a short "## Generic HTTP middleware" section above the existing operation handler description, briefly stating that these middleware are reused by `@rntme/runtime`'s `HttpSurface` and by `apps/platform-http` until that app is removed.

- [ ] **Step 2: Update `runtime.md`**

a) In the existing `### HTTP ingress limits` section (lines 207-228), add a paragraph after the example JSON:

```
The same `surface.http` block also accepts `cors` (allowed origins, credentials,
allow-headers) and `securityHeaders` (CSP, content-type-options, referrer-policy).
Defaults: empty CORS allow-list (no `Access-Control-*` headers), no CSP, `nosniff`,
`strict-origin-when-cross-origin`. `RNTME_HTTP_CORS_ORIGINS` (CSV) and
`RNTME_HTTP_CSP` (literal value; empty string disables CSP) override the manifest.
```

b) Update the "Where to look first" / "Tune `/api` ingress safety" bullet to mention the two new manifest blocks.

c) In the `### `RuntimeConfig`` table, add a new row:

| `logger` | `pino()` minted at startup | Pino logger threaded into `HttpSurface` for the global request log and the error handler. |

d) In the manifest error code list, append `RUNTIME_CONFIG_LOGGER_INVALID` to the list of `RuntimeConfigValidationErrorCode` values.

- [ ] **Step 3: Update `apps/platform-http` owner doc**

Find the owner doc at `docs/current/owners/apps/platform-http.md`. Update the file map / surface description so the `middleware/` section now lists only `auth.ts` and `tx.ts`. Add a one-line note: "Generic HTTP middleware (request-id, logger, error-handler, cors, body-limit, rate-limit, security-headers, same-origin) is imported from `@rntme/bindings-http`. Platform-specific helpers (`PostgresRateLimiter`, `errorEnvelope`, `statusForCode`) live next to `app.ts` as `postgres-rate-limiter.ts` and `error-codes.ts`."

- [ ] **Step 4: Confirm AGENTS.md needs no change**

Run: `rg -n "platform-http/src/middleware|middleware/request-id|middleware/error-handler|middleware/cors|middleware/security-headers|middleware/same-origin" AGENTS.md docs/current docs/decision-system.md`
Expected: empty output (the docs reference middleware indirectly via package READMEs, not by file path). If a match shows up, edit the doc on the spot to point to the new owner.

- [ ] **Step 5: Commit**

```bash
git add docs/current/owners/packages/runtime/{bindings-http,runtime}.md docs/current/owners/apps/platform-http.md
git commit -m "docs: bindings-http middleware exports, runtime cors/securityHeaders manifest, platform-http surface trim"
```

---

### Task 19: Final green build

- [ ] **Step 1: Workspace install (defensive — no new deps were added but the `bun.lockb` may have file-list updates)**

Run: `bun install --frozen-lockfile`
Expected: PASS, no lockfile drift.

- [ ] **Step 2: Build every package**

Run: `bun run build`
Expected: PASS.

- [ ] **Step 3: Typecheck**

Run: `bun run typecheck`
Expected: PASS.

- [ ] **Step 4: Test**

Run: `bun run test`
Expected: PASS for every workspace, including the eight new bindings-http middleware suites, the new runtime integration test, the carved-out platform-http error-codes / postgres-rate-limiter tests, and the still-present `apps/platform-http` `auth.test.ts` / `tx.test.ts`.

- [ ] **Step 5: Lint**

Run: `bun run lint`
Expected: PASS.

- [ ] **Step 6: Layering check**

Run: `bun run depcruise`
Expected: PASS. The added `@rntme/bindings-http` exports stay inside `packages/runtime/**`; `apps/platform-http` already depends on `@rntme/bindings-http`.

- [ ] **Step 7: No commit needed**

If steps 2-6 all passed, the previous task commits already cover the work. If a fix landed during the final pass, commit it now with a small descriptive message.

---

## Self-Review

Run the following review against the spec and against this plan before handing off.

**Spec coverage.**
- Spec migration step 4 says "Audit `apps/platform-http/src/middleware/` against `@rntme/bindings-http`. Move missing pieces. Default-on in runtime; remove from platform-http." ✓ Tasks 1-9 audit + lift; Task 12 makes them default-on; Tasks 15-17 remove them from platform-http.
- "These already exist in `@rntme/bindings-http` to a partial extent." Audited: only `correlationMiddleware` exists today; everything else is added in this plan.
- "The runtime exposes them as default-on for any HTTP surface." ✓ Task 12 in `HttpSurface.mount`.
- "Per-blueprint overrides come through the binding manifest where already supported." ✓ Task 10 adds `surface.http.cors` and `surface.http.securityHeaders`; existing `bodyLimit` / `rateLimit` manifest fields remain the override surface for those.

**Out-of-scope items deliberately excluded.**
- `auth.ts` (plan 5) — not lifted, file kept in place.
- `tx.ts` (Postgres-coupled, platform-specific) — not lifted, file kept in place.
- Removal of `apps/platform-http` itself (plan 6) — not in this plan.
- BPMN handlers, CLI direct mode, deploy-runner work — separate plans.

**Placeholder scan.**
- No "TBD", "TODO", "implement later" inside step bodies.
- No "similar to Task N" without showing the code; every step that touches code embeds the exact code or the exact regex/path to operate on.
- All command outputs are stated explicitly (PASS / FAIL with reason).

**Type / name consistency.**
- `requestLogger` (not `loggerMiddleware`) is used uniformly in Tasks 3, 12, 15, 18.
- `errorHandler` accepts `{ logger, code, message }` everywhere; platform-http passes `code: 'PLATFORM_INTERNAL'` (Task 15) to keep its envelope.
- `bodyLimit(maxBytes, opts?)`, `rateLimit(limiter, keyFn, opts?)`, `cors({ origins })`, `securityHeaders({ csp })`, `sameOriginOnly(baseUrl, opts?)` signatures match across Tasks 5-9 and the call sites in Tasks 12 and 15-16.
- `RateLimiter` interface from bindings-http is used to type `PostgresRateLimiter` (Task 14) — keeps cross-package layering clean.
- Manifest types `ValidatedHttpCorsConfig` / `ValidatedHttpSecurityHeadersConfig` introduced in Task 10 are consumed by `HttpSurface` in Task 12.
- `RUNTIME_CONFIG_LOGGER_INVALID` introduced in Task 11 is documented in Task 18.

## Documentation Touch (per AGENTS.md `Docs Touch`)

- `docs/decision-system.md` — no change. The "Locked-pending" entries from the spec already cover this plan; no new bet is introduced. The middleware lift is execution work under those bets.
- Local README stubs — no change. The lookup tables in `AGENTS.md` already point at `packages/runtime/bindings-http/README.md` and `packages/runtime/runtime/README.md`, both of which point at the owner docs that get updated in Task 18.
- `docs/current/owners/packages/runtime/bindings-http.md` — updated in Task 18 (new middleware exports).
- `docs/current/owners/packages/runtime/runtime.md` — updated in Task 18 (manifest fields, RuntimeConfig.logger, default-on middleware).
- `docs/current/owners/apps/platform-http.md` — updated in Task 18 (file map trim + new platform-local files).
- `docs/current/guides/**` — no change. No authoring rule changes.
- `AGENTS.md` — verified clean in Task 18 step 4; no edit unless the verification turns up a stale reference.
- `README.md`, `CLAUDE.md` — no change. No user-facing surface or bootstrap instructions change.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-10-lift-http-middleware-to-runtime.md`. Two execution options:

1. **Subagent-Driven (recommended)** — Dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
