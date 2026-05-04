# Runtime Shutdown Timeout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close U-292 by making `RunningService.stop()` bounded when HTTP connections stay open.

**Architecture:** Keep graceful shutdown as the first path by calling `server.close()`. Add a validated `RuntimeConfig.shutdownTimeoutMs` option with a package default; when the timeout expires, call Node HTTP `closeAllConnections()` when available and resolve the stop wait. Call `closeIdleConnections()` after initiating close for modern Node compatibility. Continue stopping gRPC, projections, and bus after the HTTP listener has closed or the timeout has forced the boundary.

**Tech Stack:** TypeScript strict ESM, Node HTTP server APIs through `@hono/node-server`, Vitest integration/unit tests.

---

## File Map

- Modify `packages/runtime/runtime/src/start/runtime-config.ts` to add and validate `shutdownTimeoutMs`.
- Modify `packages/runtime/runtime/src/start/start-service.ts` to enforce bounded HTTP shutdown.
- Modify `packages/runtime/runtime/test/unit/runtime-config.test.ts` for invalid/valid timeout config.
- Modify `packages/runtime/runtime/test/integration/shutdown.test.ts` with a hanging request regression.
- Modify `packages/runtime/runtime/README.md`, `docs/audit/00-waves.md`, and `docs/audit/01-current-priority-tasks.md` for documentation-touch.

### Task 1: Failing Tests

- [x] **Step 1: Add runtime config validation tests**

Add tests for valid `shutdownTimeoutMs` and invalid zero/non-integer values.

- [x] **Step 2: Add hanging shutdown regression**

Add an integration test that mounts a custom surface with a `/hang` handler that never resolves, starts a request, then calls `running.stop()` with a short `shutdownTimeoutMs` and asserts it resolves inside a bounded window.

- [x] **Step 3: Confirm RED**

Run:

```bash
pnpm -F @rntme/runtime test -- test/unit/runtime-config.test.ts test/integration/shutdown.test.ts
```

Expected before implementation: config validation accepts invalid timeout values and the hanging shutdown test times out or exceeds the assertion.

### Task 2: Bounded Shutdown Implementation

- [x] **Step 1: Add config field and validation**

Add `shutdownTimeoutMs?: number` to `RuntimeConfig`, validate it as a positive integer, and add a stable validation error code.

- [x] **Step 2: Add HTTP close helper**

Add a helper in `start-service.ts` that races `server.close()` against the timeout, invokes `closeIdleConnections()` immediately when present, and invokes `closeAllConnections()` on timeout when present.

- [x] **Step 3: Wire `RunningService.stop()`**

Use the helper with `runtimeConfig.shutdownTimeoutMs ?? DEFAULT_SHUTDOWN_TIMEOUT_MS` before stopping gRPC, pipeline, and bus.

- [x] **Step 4: Confirm GREEN**

Run the focused tests again.

### Task 3: Documentation, Audit, Full Verification

- [x] **Step 1: Update runtime README**

Document the shutdown timeout config and stop behavior.

- [x] **Step 2: Close U-292 in audit docs**

Mark U-292 `✅ closed | A13`, remove it from the active priority list, and add package evidence.

- [x] **Step 3: Full verification**

Run:

```bash
pnpm -F @rntme/runtime typecheck
pnpm -F @rntme/runtime test
pnpm -F @rntme/runtime lint
pnpm -F @rntme/runtime build
```

Expected: all PASS.

---

## Self-Review

- Spec coverage: U-292 asks for bounded graceful shutdown and a hanging connection test; this plan covers both.
- Backward compatibility: default behavior remains graceful first; only stalled connections trigger force-close after the timeout.
- Documentation-touch: runtime README and audit docs are updated in the same pass.
