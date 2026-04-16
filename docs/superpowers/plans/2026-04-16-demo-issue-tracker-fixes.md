# Demo issue-tracker-api Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix four issues found during E2E testing of the demo: seed payload normalization so seeded aggregates are mutable, burndown seed data + graph fix, README actor-header correction, and seed-specific e2e tests.

**Architecture:** The core fix adds a `wrapPayloads()` post-processing step to `validateSeed()` in `@rntme/seed` that transforms flat seed payloads into the `{before, after}` format expected by `replayAggregateState()`. No contract changes needed — `ValidateCtx` already carries both `PdmResolver` and `EventTypeSpec[]`. Demo artifacts get data fixes and a new e2e test file.

**Tech Stack:** TypeScript, Vitest, better-sqlite3, Hono (HTTP surface via @rntme/runtime)

---

### Task 1: Write `wrapPayloads()` unit tests

**Files:**
- Create: `packages/seed/test/unit/wrap-payloads.test.ts`

This task writes the failing tests for the new `wrapPayloads()` function before implementing it.

- [ ] **Step 1: Write the test file**

```typescript
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parsePdm, validatePdm, createPdmResolver, deriveEventTypes } from '@rntme/pdm';
import type { EventEnvelope } from '@rntme/event-store';
import { wrapPayloads } from '../../src/wrap-payloads.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

const pdmRaw = JSON.parse(
  readFileSync(resolve(__dirname, '../fixtures/minimal-pdm.json'), 'utf8'),
);

function ctx() {
  const parsed = parsePdm(pdmRaw);
  if (!parsed.ok) throw new Error('pdm fixture invalid');
  const validated = validatePdm(parsed.value);
  if (!validated.ok) throw new Error('pdm fixture invalid');
  return {
    pdm: createPdmResolver(validated.value),
    events: deriveEventTypes(validated.value),
  };
}

function envelope(
  overrides: Partial<EventEnvelope> & { stream: string; version: number; eventType: string; aggregateType: string; payload: Record<string, unknown> },
): EventEnvelope {
  return {
    eventId: `seed:${overrides.aggregateType}:${overrides.stream.split('-')[1]}:v${overrides.version}`,
    aggregateId: overrides.stream.split('-')[1]!,
    occurredAt: '2026-01-01T00:00:00.000Z',
    actor: { kind: 'system', id: 'seed' },
    schemaVersion: 1,
    ...overrides,
  };
}

describe('wrapPayloads', () => {
  it('wraps a creation event: before=null, after includes stateField', () => {
    const c = ctx();
    const envelopes = [
      envelope({
        stream: 'Thing-1', aggregateType: 'Thing', version: 1,
        eventType: 'ThingCreated', payload: { name: 'hello' },
      }),
    ];
    const wrapped = wrapPayloads(envelopes, c);
    const p = wrapped[0]!.payload as { before: unknown; after: Record<string, unknown> };
    expect(p.before).toBeNull();
    expect(p.after).toEqual({ name: 'hello', status: 'active' });
  });

  it('wraps a non-creation event: before has affected fields from accumulated state', () => {
    const c = ctx();
    const envelopes = [
      envelope({
        stream: 'Thing-1', aggregateType: 'Thing', version: 1,
        eventType: 'ThingCreated', payload: { name: 'hello' },
      }),
      envelope({
        stream: 'Thing-1', aggregateType: 'Thing', version: 2,
        eventType: 'ThingRenamed', payload: { name: 'world', status: 'active' },
      }),
    ];
    const wrapped = wrapPayloads(envelopes, c);
    const p1 = wrapped[0]!.payload as { before: unknown; after: Record<string, unknown> };
    expect(p1.before).toBeNull();
    expect(p1.after).toEqual({ name: 'hello', status: 'active' });

    const p2 = wrapped[1]!.payload as { before: Record<string, unknown>; after: Record<string, unknown> };
    expect(p2.before).toEqual({ status: 'active', name: 'hello' });
    expect(p2.after).toEqual({ name: 'world', status: 'active' });
  });

  it('wraps a terminal transition: before reflects accumulated state', () => {
    const c = ctx();
    const envelopes = [
      envelope({
        stream: 'Thing-1', aggregateType: 'Thing', version: 1,
        eventType: 'ThingCreated', payload: { name: 'hello' },
      }),
      envelope({
        stream: 'Thing-1', aggregateType: 'Thing', version: 2,
        eventType: 'ThingArchived', payload: { status: 'archived' },
      }),
    ];
    const wrapped = wrapPayloads(envelopes, c);
    const p2 = wrapped[1]!.payload as { before: Record<string, unknown>; after: Record<string, unknown> };
    expect(p2.before).toEqual({ status: 'active' });
    expect(p2.after).toEqual({ status: 'archived' });
  });

  it('handles multiple independent streams', () => {
    const c = ctx();
    const envelopes = [
      envelope({
        stream: 'Thing-1', aggregateType: 'Thing', version: 1,
        eventType: 'ThingCreated', payload: { name: 'a' },
      }),
      envelope({
        stream: 'Thing-2', aggregateType: 'Thing', version: 1,
        eventType: 'ThingCreated', payload: { name: 'b' },
      }),
    ];
    const wrapped = wrapPayloads(envelopes, c);
    const p1 = wrapped[0]!.payload as { before: unknown; after: Record<string, unknown> };
    const p2 = wrapped[1]!.payload as { before: unknown; after: Record<string, unknown> };
    expect(p1.after).toEqual({ name: 'a', status: 'active' });
    expect(p2.after).toEqual({ name: 'b', status: 'active' });
  });

  it('skips envelopes whose payload already has {before, after} shape', () => {
    const c = ctx();
    const alreadyWrapped = envelope({
      stream: 'Thing-1', aggregateType: 'Thing', version: 1,
      eventType: 'ThingCreated',
      payload: { before: null, after: { name: 'pre-wrapped', status: 'active' } } as unknown as Record<string, unknown>,
    });
    const wrapped = wrapPayloads([alreadyWrapped], c);
    expect(wrapped[0]!.payload).toEqual({ before: null, after: { name: 'pre-wrapped', status: 'active' } });
  });

  it('preserves envelope fields other than payload', () => {
    const c = ctx();
    const original = envelope({
      stream: 'Thing-1', aggregateType: 'Thing', version: 1,
      eventType: 'ThingCreated', payload: { name: 'x' },
      eventId: 'custom-id',
      actor: { kind: 'user', id: 'alice' },
    });
    const wrapped = wrapPayloads([original], c);
    expect(wrapped[0]!.eventId).toBe('custom-id');
    expect(wrapped[0]!.actor).toEqual({ kind: 'user', id: 'alice' });
    expect(wrapped[0]!.stream).toBe('Thing-1');
    expect(wrapped[0]!.version).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -F @rntme/seed test -- --reporter verbose test/unit/wrap-payloads.test.ts`

Expected: FAIL — `Cannot find module '../../src/wrap-payloads.js'`

- [ ] **Step 3: Commit**

```bash
git add packages/seed/test/unit/wrap-payloads.test.ts
git commit -m "test(seed): failing tests for wrapPayloads flat-to-{before,after} normalization"
```

---

### Task 2: Implement `wrapPayloads()`

**Files:**
- Create: `packages/seed/src/wrap-payloads.ts`
- Modify: `packages/seed/src/index.ts` (add export)

- [ ] **Step 1: Write the implementation**

Create `packages/seed/src/wrap-payloads.ts`:

```typescript
import type { EventEnvelope } from '@rntme/event-store';
import type { ValidateCtx } from './validate.js';

/**
 * Transforms flat seed-event payloads into the `{ before, after }` envelope
 * format that `replayAggregateState()` expects. Creation events get
 * `before: null`; non-creation events get `before` populated from
 * accumulated per-stream state. Already-wrapped payloads are passed through.
 */
export function wrapPayloads(
  envelopes: readonly EventEnvelope[],
  ctx: ValidateCtx,
): EventEnvelope[] {
  const eventByType = new Map(ctx.events.map((e) => [e.eventType, e]));
  const streamState = new Map<string, Record<string, unknown>>();

  return envelopes.map((ev) => {
    if (isAlreadyWrapped(ev.payload)) return ev;

    const spec = eventByType.get(ev.eventType);
    if (!spec) return ev; // unknown event type — pass through (validate already caught it)

    const sm = ctx.pdm.resolveStateMachine(spec.aggregateType);
    const stateField = sm?.stateField ?? 'status';
    const flat = ev.payload as Record<string, unknown>;

    if (spec.isCreation) {
      const after: Record<string, unknown> = { ...flat, [stateField]: spec.to };
      streamState.set(ev.stream, { ...after });
      return { ...ev, payload: { before: null, after } };
    }

    const currentState = streamState.get(ev.stream) ?? {};
    const before: Record<string, unknown> = {};
    for (const field of spec.affects) {
      before[field] = currentState[field] ?? null;
    }
    const after: Record<string, unknown> = { ...flat };
    const merged = { ...currentState, ...after };
    streamState.set(ev.stream, merged);
    return { ...ev, payload: { before, after } };
  });
}

function isAlreadyWrapped(payload: unknown): boolean {
  if (typeof payload !== 'object' || payload === null) return false;
  const p = payload as Record<string, unknown>;
  return 'after' in p && 'before' in p && Object.keys(p).length === 2;
}
```

- [ ] **Step 2: Add export to index.ts**

In `packages/seed/src/index.ts`, add:

```typescript
export { wrapPayloads } from './wrap-payloads.js';
```

- [ ] **Step 3: Run tests to verify they pass**

Run: `pnpm -F @rntme/seed test -- --reporter verbose test/unit/wrap-payloads.test.ts`

Expected: All 6 tests PASS.

- [ ] **Step 4: Run full seed test suite to check for regressions**

Run: `pnpm -F @rntme/seed test`

Expected: All existing tests still pass.

- [ ] **Step 5: Commit**

```bash
git add packages/seed/src/wrap-payloads.ts packages/seed/src/index.ts
git commit -m "feat(seed): wrapPayloads transforms flat seed payloads to {before,after} format"
```

---

### Task 3: Integrate `wrapPayloads` into `validateSeed()`

**Files:**
- Modify: `packages/seed/src/validate.ts:1-77`

- [ ] **Step 1: Write the failing test**

Add to the bottom of `packages/seed/test/unit/validate-semantic.test.ts`:

```typescript
  it('normalizes flat payloads to {before, after} in validated output', () => {
    const result = validateSeed(
      seed([
        {
          stream: 'Thing-1',
          aggregateType: 'Thing',
          aggregateId: '1',
          version: 1,
          eventType: 'ThingCreated',
          payload: { name: 'x' },
          occurredAt: '2026-01-01T00:00:00.000Z',
        },
        {
          stream: 'Thing-1',
          aggregateType: 'Thing',
          aggregateId: '1',
          version: 2,
          eventType: 'ThingRenamed',
          payload: { name: 'y', status: 'active' },
          occurredAt: '2026-01-02T00:00:00.000Z',
        },
      ]),
      ctx(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const e1 = result.value.events[0]!;
    const p1 = e1.payload as { before: unknown; after: Record<string, unknown> };
    expect(p1.before).toBeNull();
    expect(p1.after).toEqual({ name: 'x', status: 'active' });

    const e2 = result.value.events[1]!;
    const p2 = e2.payload as { before: Record<string, unknown>; after: Record<string, unknown> };
    expect(p2.before).toEqual({ status: 'active', name: 'x' });
    expect(p2.after).toEqual({ name: 'y', status: 'active' });
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -F @rntme/seed test -- --reporter verbose test/unit/validate-semantic.test.ts`

Expected: FAIL — the new test fails because `validateSeed` still returns flat payloads.

- [ ] **Step 3: Add wrapPayloads call to validateSeed**

In `packages/seed/src/validate.ts`, add the import at the top:

```typescript
import { wrapPayloads } from './wrap-payloads.js';
```

Then change the return statement at the end of `validateSeed()` (line 76) from:

```typescript
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: { events: normalized } };
```

To:

```typescript
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: { events: wrapPayloads(normalized, ctx) } };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm -F @rntme/seed test -- --reporter verbose test/unit/validate-semantic.test.ts`

Expected: All tests PASS (including the new one).

- [ ] **Step 5: Run full seed test suite**

Run: `pnpm -F @rntme/seed test`

Expected: All tests pass. Existing tests don't inspect payload internals so they should be unaffected.

- [ ] **Step 6: Commit**

```bash
git add packages/seed/src/validate.ts packages/seed/test/unit/validate-semantic.test.ts
git commit -m "feat(seed): integrate wrapPayloads into validateSeed — seed events now store {before,after}"
```

---

### Task 4: Fix PDM, seed data, and burndown graph

**Files:**
- Modify: `demo/issue-tracker-api/artifacts/pdm.json:50` (add `sprintId` to `report.affects`)
- Modify: `demo/issue-tracker-api/artifacts/seed.json:586-637` (trim Issue-7010, add `sprintId`, add Issue-7011)
- Modify: `demo/issue-tracker-api/artifacts/graphs/sprintBurndown.json:15-22`

No existing seed event sets `sprintId` — it's not in any transition's `affects` list. The `report` transition's `affects` is `["title", "projectId", "reporterId", "priority", "storyPoints"]`. To make burndown work, we need `sprintId` settable at creation time.

- [ ] **Step 1: Add `sprintId` to `report.affects` in PDM**

In `demo/issue-tracker-api/artifacts/pdm.json`, change the `report` transition's `affects` from:

```json
"report":   { "from": null,            "to": "draft",        "affects": ["title", "projectId", "reporterId", "priority", "storyPoints"] }
```

To:

```json
"report":   { "from": null,            "to": "draft",        "affects": ["title", "projectId", "reporterId", "priority", "storyPoints", "sprintId"] }
```

- [ ] **Step 2: Trim Issue-7010 + add `sprintId` to its creation event**

In `demo/issue-tracker-api/artifacts/seed.json`:

1. In the Issue-7010 `IssueReport` event (version 1), add `"sprintId": 1` to the payload:

```json
    {
      "stream": "Issue-7010",
      "aggregateType": "Issue",
      "aggregateId": "7010",
      "version": 1,
      "eventType": "IssueReport",
      "payload": {
        "title": "Sprint-tagged",
        "projectId": 1,
        "reporterId": 2,
        "priority": "high",
        "storyPoints": 5,
        "sprintId": 1
      },
      "occurredAt": "2026-04-15T12:30:00.000Z"
    }
```

2. Remove the two events for Issue-7010 with versions 4 (`IssueResolve`) and 5 (`IssueClose`). The stream ends at version 3 (`IssueAssign`), leaving Issue-7010 in `in_progress`.

- [ ] **Step 3: Add Issue-7011 — sprint-tagged, resolved**

After the last Issue-7010 event and before the closing `]`, add:

```json
    {
      "stream": "Issue-7011",
      "aggregateType": "Issue",
      "aggregateId": "7011",
      "version": 1,
      "eventType": "IssueReport",
      "payload": {
        "title": "Sprint burndown resolved",
        "projectId": 1,
        "reporterId": 3,
        "priority": "medium",
        "storyPoints": 3,
        "sprintId": 1
      },
      "occurredAt": "2026-04-15T12:40:00.000Z"
    },
    {
      "stream": "Issue-7011",
      "aggregateType": "Issue",
      "aggregateId": "7011",
      "version": 2,
      "eventType": "IssueSubmit",
      "payload": { "status": "open" },
      "occurredAt": "2026-04-15T12:41:00.000Z"
    },
    {
      "stream": "Issue-7011",
      "aggregateType": "Issue",
      "aggregateId": "7011",
      "version": 3,
      "eventType": "IssueAssign",
      "payload": { "status": "in_progress", "assigneeId": 1 },
      "occurredAt": "2026-04-15T12:42:00.000Z"
    },
    {
      "stream": "Issue-7011",
      "aggregateType": "Issue",
      "aggregateId": "7011",
      "version": 4,
      "eventType": "IssueResolve",
      "payload": {
        "status": "resolved",
        "resolvedAt": "2026-04-15T12:43:00.000Z"
      },
      "occurredAt": "2026-04-15T12:43:00.000Z"
    }
```

- [ ] **Step 4: Fix sprintBurndown graph — remove `neq closed` filter**

In `demo/issue-tracker-api/artifacts/graphs/sprintBurndown.json`, change the filter config's `expr` from:

```json
        "expr": {
          "and": [
            { "eq": ["issue.sprintId", { "$param": "sprintId" }] },
            { "neq": ["issue.status", { "$literal": "closed" }] }
          ]
        }
```

To:

```json
        "expr": { "eq": ["issue.sprintId", { "$param": "sprintId" }] }
```

- [ ] **Step 5: Verify the demo still loads**

Run: `pnpm -F @rntme/issue-tracker-api-demo test`

Expected: Existing smoke test passes (server boots, /health responds, openapi served). This confirms seed.json is valid and the server starts with the updated artifacts.

- [ ] **Step 6: Commit**

```bash
git add demo/issue-tracker-api/artifacts/pdm.json \
        demo/issue-tracker-api/artifacts/seed.json \
        demo/issue-tracker-api/artifacts/graphs/sprintBurndown.json
git commit -m "fix(demo): burndown — add sprintId to report.affects, seed sprint issues, remove closed filter"
```

---

### Task 5: Fix README actor-header wording

**Files:**
- Modify: `demo/issue-tracker-api/README.md:103`

- [ ] **Step 1: Update the wording**

In `demo/issue-tracker-api/README.md`, find:

```
All `POST`s require an `x-actor-id` request header — the runtime turns it into `{ kind: 'user', id }` (header name and actor kind are configurable via `manifest.auth`) and stamps every event envelope's `actor` with it.
```

Replace with:

```
All `POST`s accept an optional `x-actor-id` request header — the runtime turns it into `{ kind: 'user', id }` and stamps every event envelope's `actor` with it. If omitted, `actor` is `null`. Header name and actor kind are configurable via `manifest.auth`.
```

- [ ] **Step 2: Commit**

```bash
git add demo/issue-tracker-api/README.md
git commit -m "docs(demo): correct x-actor-id header from required to optional"
```

---

### Task 6: Write seed-e2e test

**Files:**
- Create: `demo/issue-tracker-api/test/seed-e2e.test.ts`

- [ ] **Step 1: Write the e2e test file**

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

const port = 3012;
const base = `http://127.0.0.1:${port}`;

let child: ChildProcess;

beforeAll(async () => {
  child = spawn('pnpm', ['exec', 'tsx', 'src/server.ts'], {
    cwd: `${here}/..`,
    env: { ...process.env, RNTME_HTTP_PORT: String(port) },
    stdio: 'pipe',
  });
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${base}/health`);
      if (r.ok) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('server did not start within 15 s');
}, 20_000);

afterAll(() => child?.kill('SIGTERM'));

describe('seed-e2e — seeded aggregate mutations + burndown', () => {
  it('assigns a seeded open issue (7004: open → in_progress)', async () => {
    const res = await fetch(`${base}/v1/issues/7004/actions/assign`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-actor-id': 'alice' },
      body: JSON.stringify({ assigneeId: 1 }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { version: number };
    expect(body.version).toBe(3);
  });

  it('submits a seeded draft issue (7005: draft → open)', async () => {
    const res = await fetch(`${base}/v1/issues/7005/actions/submit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-actor-id': 'alice' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { version: number };
    expect(body.version).toBe(2);
  });

  it('rejects illegal transition on seeded closed issue (7001)', async () => {
    const res = await fetch(`${base}/v1/issues/7001/actions/submit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-actor-id': 'alice' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(422);
    const body = (await res.json()) as { message: string };
    expect(body.message).toContain('closed');
  });

  it('returns burndown data for sprint 1 with >= 2 status buckets', async () => {
    const res = await fetch(`${base}/v1/sprints/1/burndown`);
    expect(res.status).toBe(200);
    const rows = (await res.json()) as Array<{ status: string; issueCount: number; totalStoryPoints: number }>;
    expect(rows.length).toBeGreaterThanOrEqual(2);
    for (const row of rows) {
      expect(row.issueCount).toBeGreaterThan(0);
    }
  });

  it('returns empty burndown for non-existent sprint', async () => {
    const res = await fetch(`${base}/v1/sprints/999/burndown`);
    expect(res.status).toBe(200);
    const rows = (await res.json()) as unknown[];
    expect(rows).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test**

Run: `pnpm -F @rntme/issue-tracker-api-demo test`

Expected: Both `smoke.test.ts` and `seed-e2e.test.ts` pass. The seed mutations succeed (confirming `wrapPayloads` is working end-to-end), and the burndown returns data.

- [ ] **Step 3: Commit**

```bash
git add demo/issue-tracker-api/test/seed-e2e.test.ts
git commit -m "test(demo): seed-e2e tests — seeded aggregate mutations + burndown verification"
```

---

### Task 7: Update KNOWN_ISSUES.md + final verification

**Files:**
- Modify: `demo/issue-tracker-api/KNOWN_ISSUES.md`

- [ ] **Step 1: Add a section about the seed payload fix**

Add to the "What works today" section a bullet about seeded aggregates being mutable:

```markdown
- **Seeded aggregate mutations:** Commands against seeded issues (7001–7011) work correctly — `wrapPayloads()` in `@rntme/seed` normalizes flat seed payloads to `{before, after}` format during validation, so `replayAggregateState()` reconstructs state correctly.
```

- [ ] **Step 2: Run full test suite across all affected packages**

Run: `pnpm -F @rntme/seed test && pnpm -F @rntme/issue-tracker-api-demo test`

Expected: All tests pass in both packages.

- [ ] **Step 3: Run typecheck**

Run: `pnpm -F @rntme/seed typecheck && pnpm -F @rntme/issue-tracker-api-demo typecheck`

Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add demo/issue-tracker-api/KNOWN_ISSUES.md
git commit -m "docs(demo): update KNOWN_ISSUES — seed payload normalization, burndown fix"
```
