> Status: historical.
> Date: 2026-05-04.
> Current source: docs/current/**, docs/decision-system.md, and current code/tests.
> Why retained: Historical rationale and execution context retained for review; it is not current-state truth by itself.

# Audit Package B UI Runtime Confidence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Close audit units U-341 and U-344 so `@rntme/ui-runtime` has React 19-aligned type packages and focused tests around the client boot/registry paths that protect the demo SPA.

**Architecture:** Keep `@rntme/ui-runtime` as the runtime consumer of compiled UI artifacts. The strategic choice is low-churn hardening: align React type packages with the actual React runtime major, then add unit tests at the public client seams (`entry.tsx`, `registry.ts`, driver/layout behavior) instead of refactoring the client architecture.

**Tech Stack:** TypeScript ESM, React 19, Vitest, jsdom/happy-dom if already available, package-local fixtures, existing `pnpm -F @rntme/ui-runtime build` and `test` scripts.

---

### Task 1: U-341 React 19 Types Alignment

**Files:**
- Modify: `packages/runtime/ui-runtime/package.json`
- Modify: `pnpm-lock.yaml`

- [x] **Step 1: Confirm current mismatch**

Read `packages/runtime/ui-runtime/package.json` and verify `react` / `react-dom` are `^19.2.5` while `@types/react` / `@types/react-dom` are `^18.x`.

- [x] **Step 2: Resolve current React 19 type versions**

Run:

```bash
pnpm view @types/react version
pnpm view @types/react-dom version
```

Use the current React 19-compatible versions returned by npm.

- [x] **Step 3: Update package dev dependencies**

Run:

```bash
pnpm -F @rntme/ui-runtime add -D @types/react@<version> @types/react-dom@<version>
```

This updates `packages/runtime/ui-runtime/package.json` and `pnpm-lock.yaml`.

- [x] **Step 4: Verify U-341**

Run:

```bash
pnpm -F @rntme/ui-runtime build
```

Expected: TypeScript and SPA bundle build complete successfully.

### Task 2: U-344 Focused Client Coverage

**Files:**
- Modify or create focused tests under `packages/runtime/ui-runtime/test/unit/`
- Modify production client code only if the tests expose a real bug

- [x] **Step 1: Inventory current tests**

Run:

```bash
find packages/runtime/ui-runtime/test -maxdepth 3 -type f | sort
```

Map existing coverage before adding tests to avoid duplicate assertions.

- [x] **Step 2: Add registry action-dispatch tests**

Cover `createRegistry` dispatch behavior for:

```text
navigation action -> bridge.onNavigate called with substituted route params
refetch action -> bridge.fetchEndpoint called for each listed data target
command action -> bridge.fetchFn called with method/path/body and onSuccess refetches requested data
module-action -> operationRegistry lookup receives resolved params from state
```

- [x] **Step 3: Add entry/boot fallback tests**

Cover `mountUiRuntime` behavior for:

```text
identity module boot throws before setting /auth/status -> runtime sets /auth/status = 'anon' and /auth/user = null
non-identity module boot throws -> /runtime/bootErrors is populated and render still proceeds
transport middleware supplied by module boot is used for manifest/screen/data fetches after boot
```

- [x] **Step 4: Add route/render smoke tests if missing**

Cover current-route fallback and loading/render behavior where existing tests are thin:

```text
unknown browser path falls back to first manifest route
AppShell renders layout and screen when both specs are loaded
```

- [x] **Step 5: Verify U-344**

Run:

```bash
pnpm -F @rntme/ui-runtime test
pnpm -F @rntme/ui-runtime build
```

Expected: all ui-runtime tests and build pass.

### Task 3: Documentation Touch And Audit Queue Update

**Files:**
- Modify: `packages/runtime/ui-runtime/README.md`
- Modify: `docs/audit/00-waves.md`
- Modify: `docs/audit/01-current-priority-tasks.md`

- [x] **Step 1: Update README**

Update dependency notes if needed and replace the known-limit statement that client paths are under-tested with a precise description of covered test seams.

- [x] **Step 2: Update audit docs**

Mark U-341 and U-344 closed in `docs/audit/00-waves.md`, remove them from the active sorted queue in `docs/audit/01-current-priority-tasks.md`, and record verification evidence.

- [x] **Step 3: Completion audit**

Map each unit to evidence:

```text
U-341 -> package.json/lockfile React 19 type packages + ui-runtime build
U-344 -> focused registry/entry/runtime tests + ui-runtime test/build
Docs -> README and audit queue updates
```
