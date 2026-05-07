> Status: historical.
> Date: 2026-05-04.
> Current source: docs/current/**, docs/decision-system.md, and current code/tests.
> Why retained: Historical rationale and execution context retained for review; it is not current-state truth by itself.

# Platform HTTP Unhandled Error Logging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close U-114 by logging unhandled platform HTTP exceptions with structured request metadata while keeping the 500 response sanitized.

**Architecture:** `errorHandler` becomes a logger-aware Hono error handler that records unhandled exceptions before returning the existing platform error envelope. `createApp` installs it with `app.onError(errorHandler(deps.logger))` so production requests are durable in logs; tests instantiate the handler with a spy logger.

**Tech Stack:** Hono middleware, pino logger type, Vitest.

---

## File Map

- Modify `apps/platform-http/src/middleware/error-handler.ts` to return a Hono `ErrorHandler`, accept `Pick<pino.Logger, 'error'>`, log caught causes, and sanitize the response message.
- Modify `apps/platform-http/src/app.ts` to call `errorHandler(deps.logger)`.
- Modify `apps/platform-http/test/unit/middleware/error-handler.test.ts` with the failing regression test and updated sanitized response assertion.
- Modify `apps/platform-http/README.md`, `docs/audit/00-waves.md`, and `docs/audit/01-current-priority-tasks.md` for the documentation-touch task.

### Task 1: Regression Test

- [x] **Step 1: Write the failing unit test**

In `apps/platform-http/test/unit/middleware/error-handler.test.ts`, add a Hono app using `requestId()` and `app.onError(errorHandler(logger))`, throw an `Error('secret boom')` from a route, then assert:

```ts
expect(logger.error).toHaveBeenCalledWith(
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
expect(await res.json()).toEqual({
  error: { code: 'PLATFORM_INTERNAL', message: 'Internal server error' },
});
```

- [x] **Step 2: Run the targeted test and confirm RED**

Run: `pnpm -F @rntme/platform-http test -- test/unit/middleware/error-handler.test.ts`

Expected before implementation: FAIL because no structured logger call is written and the response leaks `String(cause)`.

### Task 2: Middleware Implementation

- [x] **Step 1: Add logger dependency**

Change `errorHandler()` to `errorHandler(logger?: Pick<pino.Logger, 'error'>): ErrorHandler` and import `type pino from 'pino'`.

- [x] **Step 2: Log before response**

Inside the catch block:

```ts
logger?.error(
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
```

- [x] **Step 3: Sanitize response**

Return `errorEnvelope([{ code: 'PLATFORM_INTERNAL', message: 'Internal server error' }])` instead of `String(cause)`.

- [x] **Step 4: Wire app logger**

In `apps/platform-http/src/app.ts`, change the old middleware registration to `app.onError(errorHandler(deps.logger))`.

- [x] **Step 5: Run targeted test and confirm GREEN**

Run: `pnpm -F @rntme/platform-http test -- test/unit/middleware/error-handler.test.ts`

Expected: PASS.

### Task 3: Documentation And Audit Ledger

- [x] **Step 1: Update README**

Document that the global error handler logs unhandled exceptions with request id, method, path, route, and status, while the response remains sanitized.

- [x] **Step 2: Close U-114 in audit docs**

Mark U-114 `✅ closed | A4`, remove it from the active priority table, and update Package C evidence.

- [x] **Step 3: Full verification**

Run:

```bash
pnpm -F @rntme/platform-http typecheck
pnpm -F @rntme/platform-http test -- test/unit/middleware/error-handler.test.ts
pnpm -F @rntme/platform-http lint
pnpm -F @rntme/platform-http build
```

Expected: all PASS.

---

## Self-Review

- Spec coverage: U-114 requires durable structured logging for unhandled 500s; the logger-aware middleware and test cover that.
- Placeholder scan: no placeholders remain.
- Type consistency: the logger type is a pino-compatible `Pick<Logger, 'error'>`, matching `AppDeps.logger`.
