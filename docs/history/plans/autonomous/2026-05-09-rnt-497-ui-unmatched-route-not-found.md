# RNT-497 UI Unmatched Route Not-Found Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `@rntme/ui-runtime` preserve unmatched browser URLs and render an explicit deterministic not-found state instead of redirecting to the first manifest route.

**Architecture:** Keep `createApp` server SPA fallback unchanged and make `client/entry.tsx` the single authority for matched and unmatched browser routes. Route every initial load, programmatic navigation, and `popstate` through `enterRoute(path)`, with matched routes loading manifest screens/layouts and unmatched routes rendering a runtime-generated no-layout screen plus inspectable `/route/*` diagnostics.

**Tech Stack:** TypeScript, React 19, `@json-render/react`, `@json-render/core` JSON Pointer state paths, Vitest with happy-dom, pnpm workspace filters.

---

## Context

Accepted SPEC: `docs/history/specs/autonomous/2026-05-09-rnt-497-ui-unmatched-route-not-found-design.md`.

Canonical workspace:
- Branch: `auto/rnt-497-ui-unmatched-route-not-found`
- Worktree: `/home/coder/work/rntme/.worktrees/rnt-497-ui-unmatched-route-not-found`
- PR: https://github.com/vladprrs/rntme/pull/188

Current evidence checked during PLAN:
- `packages/runtime/ui-runtime/src/client/entry.tsx` currently handles unmatched initial paths by computing `patterns[0] ?? '/'`, calling `window.history.replaceState`, then entering that route.
- `enterRoute(path)` currently returns on `matchRoute(patterns, path) === null`, which would leave stale UI on unmatched `popstate` or programmatic navigation if the initial fallback branch is removed without adding a not-found branch.
- `AppShell` already renders a screen with `layoutSpec: null`; no layout is needed for a runtime not-found screen.
- Current `entry.test.ts` mocks `react-dom/client`, so tests should assert `AppShell` props, store state, fetch calls, and pathname instead of DOM text.
- `@json-render/core` documents JSON Pointer state paths. Setting `/route/params` to an object is the preferred inspectable snapshot; keep a test for stale nested params so DEV verifies actual store behavior.

Decision constraints:
- Do not change `packages/runtime/ui-runtime/src/server/index.ts`; `GET /*` must keep returning the HTML shell.
- Do not change `packages/contracts/client-runtime/v1/src/router.ts`; no wildcard route support or route precedence changes in this issue.
- Do not change UI artifact schema, authored route format, module lifecycle contracts, or `@rntme/contracts-client-runtime-v1`.
- Do not update `docs/decision-system.md`; SPEC-REVIEW found no decision-system conflict.

## File Structure

- Modify `packages/runtime/ui-runtime/src/client/entry.tsx`: add runtime not-found screen creation, route diagnostics writes, and route all unmatched paths through `enterRoute`.
- Modify `packages/runtime/ui-runtime/test/unit/entry.test.ts`: add focused regression tests for unmatched initial path, matched route diagnostics, and `popstate` to unmatched path.
- Modify `docs/current/owners/packages/runtime/ui-runtime.md`: replace the existing gotcha that documents first-route fallback with the new client not-found behavior and `/route/*` diagnostics.

No local README change is expected because `packages/runtime/ui-runtime/README.md` only links the owner doc and already lists the package test command.

## Implementation Tasks

### Task 1: Lock The Current Gap With Failing Entry Tests

**Files:**
- Modify: `packages/runtime/ui-runtime/test/unit/entry.test.ts`

- [ ] **Step 1: Add test helpers for rendered AppShell props**

Add these helpers after `requestPath`:

```ts
type RenderedAppShell = {
  props: {
    layoutSpec: unknown;
    screenSpec: {
      root: string;
      elements: Record<string, { type: string; props?: Record<string, unknown>; children?: string[] }>;
    } | null;
    store: {
      get: (path: string) => unknown;
    };
  };
};

function lastRenderedApp(): RenderedAppShell {
  const app = render.mock.calls.at(-1)?.[0] as RenderedAppShell | undefined;
  if (!app) throw new Error('expected AppShell to render');
  return app;
}
```

- [ ] **Step 2: Add an unmatched initial path regression test**

Add this test in the existing `describe('mountUiRuntime', ...)` block:

```ts
it('renders not-found for unmatched initial path without redirecting to the first route', async () => {
  const { mountUiRuntime } = await import('../../src/client/entry.js');
  const manifest: CompiledManifest = {
    version: '2.0',
    metadata: { title: 'Notes' },
    routes: {
      '/': { layout: 'main', screen: 'home' },
      '/issues/:id': { layout: 'main', screen: 'issue' },
    },
  };
  const transport = vi.fn(async (input: RequestInfo | URL) => {
    const url = requestPath(input);
    if (url === '/_manifest.json') return Response.json(manifest);
    if (url === '/_layouts/main.json') {
      throw new Error('unmatched route must not load the first layout');
    }
    if (url === '/_screens/home.json' || url === '/_screens/issue.json') {
      throw new Error('unmatched route must not load a manifest screen');
    }
    return new Response('missing', { status: 404 });
  }) as unknown as typeof fetch;
  const replaceState = vi.spyOn(window.history, 'replaceState');

  window.history.replaceState({}, '', '/missing');
  replaceState.mockClear();

  await mountUiRuntime({
    manifestUrl: '/_manifest.json',
    target: document.querySelector<HTMLElement>('#root')!,
    transport,
    initialState: { '/route/params/id': 'stale' },
  });

  const app = lastRenderedApp();

  expect(window.location.pathname).toBe('/missing');
  expect(replaceState).not.toHaveBeenCalled();
  expect(vi.mocked(transport).mock.calls.map(([input]) => requestPath(input))).toEqual([
    '/_manifest.json',
  ]);
  expect(app.props.layoutSpec).toBeNull();
  expect(app.props.screenSpec?.root).toBe('runtimeNotFound');
  expect(app.props.screenSpec?.elements.runtimeNotFoundTitle?.props?.text).toBe('Page not found');
  expect(app.props.screenSpec?.elements.runtimeNotFoundPath?.props?.text).toBe('/missing');
  expect(app.props.store.get('/route/status')).toBe('not_found');
  expect(app.props.store.get('/route/path')).toBe('/missing');
  expect(app.props.store.get('/route/params')).toEqual({});
  expect(app.props.store.get('/route/params/id')).toBeUndefined();

  replaceState.mockRestore();
});
```

Expected now: FAIL. Current code calls `history.replaceState` to `/`, fetches the first route's layout and screen, and does not render a runtime not-found screen.

- [ ] **Step 3: Add matched route diagnostics coverage**

Add this test in the same `describe` block:

```ts
it('sets route diagnostics for matched parameterized routes', async () => {
  const { mountUiRuntime } = await import('../../src/client/entry.js');
  const manifest: CompiledManifest = {
    version: '2.0',
    metadata: { title: 'Notes' },
    routes: {
      '/': { layout: 'main', screen: 'home' },
      '/issues/:id': { layout: 'main', screen: 'issue' },
    },
  };
  const layout: CompiledScreen = {
    spec: {
      root: 'layout',
      elements: {
        layout: { type: 'Stack', props: {} },
      },
    },
  };
  const issueScreen: CompiledScreen = {
    spec: {
      root: 'page',
      elements: {
        page: { type: 'Heading', props: { text: 'Issue' } },
      },
    },
  };
  const transport = vi.fn(async (input: RequestInfo | URL) => {
    const url = requestPath(input);
    if (url === '/_manifest.json') return Response.json(manifest);
    if (url === '/_layouts/main.json') return Response.json(layout);
    if (url === '/_screens/issue.json') return Response.json(issueScreen);
    return new Response('missing', { status: 404 });
  }) as unknown as typeof fetch;

  window.history.replaceState({}, '', '/issues/42');

  await mountUiRuntime({
    manifestUrl: '/_manifest.json',
    target: document.querySelector<HTMLElement>('#root')!,
    transport,
  });

  const app = lastRenderedApp();

  expect(app.props.store.get('/route/status')).toBe('ok');
  expect(app.props.store.get('/route/path')).toBe('/issues/42');
  expect(app.props.store.get('/route/params')).toEqual({ id: '42' });
  expect(app.props.store.get('/route/params/id')).toBe('42');
});
```

Expected now: FAIL because current matched routes only set individual `/route/params/:name` paths.

- [ ] **Step 4: Add `popstate` unmatched coverage**

Add this test in the same `describe` block:

```ts
it('renders not-found on browser back to an unmatched path without leaving the previous screen mounted', async () => {
  const { mountUiRuntime } = await import('../../src/client/entry.js');
  const manifest: CompiledManifest = {
    version: '2.0',
    metadata: { title: 'Notes' },
    routes: {
      '/issues/:id': { layout: 'main', screen: 'issue' },
    },
  };
  const layout: CompiledScreen = {
    spec: {
      root: 'layout',
      elements: {
        layout: { type: 'Stack', props: {} },
      },
    },
  };
  const issueScreen: CompiledScreen = {
    spec: {
      root: 'page',
      elements: {
        page: { type: 'Heading', props: { text: 'Issue' } },
      },
    },
  };
  const transport = vi.fn(async (input: RequestInfo | URL) => {
    const url = requestPath(input);
    if (url === '/_manifest.json') return Response.json(manifest);
    if (url === '/_layouts/main.json') return Response.json(layout);
    if (url === '/_screens/issue.json') return Response.json(issueScreen);
    return new Response('missing', { status: 404 });
  }) as unknown as typeof fetch;

  window.history.replaceState({}, '', '/issues/42');

  await mountUiRuntime({
    manifestUrl: '/_manifest.json',
    target: document.querySelector<HTMLElement>('#root')!,
    transport,
  });

  expect(lastRenderedApp().props.screenSpec?.elements.page?.props?.text).toBe('Issue');

  window.history.pushState({}, '', '/missing');
  window.dispatchEvent(new PopStateEvent('popstate'));
  await Promise.resolve();

  const app = lastRenderedApp();

  expect(window.location.pathname).toBe('/missing');
  expect(app.props.layoutSpec).toBeNull();
  expect(app.props.screenSpec?.root).toBe('runtimeNotFound');
  expect(app.props.store.get('/route/status')).toBe('not_found');
  expect(app.props.store.get('/route/path')).toBe('/missing');
  expect(app.props.store.get('/route/params')).toEqual({});
  expect(app.props.store.get('/route/params/id')).toBeUndefined();
});
```

Expected now: FAIL because current `enterRoute('/missing')` returns without changing the rendered screen or route state.

- [ ] **Step 5: Run the focused test file and verify failures**

Run:

```bash
pnpm -F @rntme/ui-runtime test -- test/unit/entry.test.ts
```

Expected now: FAIL on the three new tests. Existing tests may pass or continue to run before the failures.

- [ ] **Step 6: Commit the failing tests**

Run:

```bash
git add packages/runtime/ui-runtime/test/unit/entry.test.ts
git commit -m "test(ui-runtime): cover unmatched route fallback"
```

### Task 2: Render Runtime Not-Found From The Shared Route Entry Path

**Files:**
- Modify: `packages/runtime/ui-runtime/src/client/entry.tsx`

- [ ] **Step 1: Add a runtime not-found screen helper**

Add this helper near `buildUrl`:

```ts
function createNotFoundScreen(path: string): CompiledScreen {
  return {
    spec: {
      root: 'runtimeNotFound',
      elements: {
        runtimeNotFound: {
          type: 'Stack',
          props: { direction: 'vertical', gap: 'lg' },
          children: ['runtimeNotFoundTitle', 'runtimeNotFoundPath'],
        },
        runtimeNotFoundTitle: {
          type: 'Heading',
          props: { level: 1, text: 'Page not found' },
        },
        runtimeNotFoundPath: {
          type: 'Heading',
          props: { level: 2, text: path },
        },
      },
    },
  };
}
```

This deliberately uses `Stack` and `Heading` because they are already used by package fixtures and entry tests.

- [ ] **Step 2: Add route-state helpers inside `mountUiRuntime`**

Add these helpers after `isCurrentScreenRootVisible()`:

```ts
function setMatchedRouteState(path: string, params: Record<string, string>): void {
  store.set('/route/status', 'ok');
  store.set('/route/path', path);
  store.set('/route/params', params);
}

function setNotFoundRouteState(path: string): void {
  store.set('/route/status', 'not_found');
  store.set('/route/path', path);
  store.set('/route/params', {});
}

function renderNotFound(path: string): void {
  currentLayout = null;
  currentLayoutName = null;
  currentScreen = createNotFoundScreen(path);
  setNotFoundRouteState(path);
  rerender();
}
```

If the focused tests show `store.set('/route/params', {})` does not clear `store.get('/route/params/id')`, keep the same public state contract but add the smallest local helper needed to clear stale nested route params before or during `setNotFoundRouteState`. Do not expose a new state-store API for this issue.

- [ ] **Step 3: Route unmatched paths through `renderNotFound`**

Replace the unmatched branch in `enterRoute(path)`:

```ts
const match = matchRoute(patterns, path);
if (!match) return;
```

with:

```ts
const match = matchRoute(patterns, path);
if (!match) {
  renderNotFound(path);
  return;
}
```

- [ ] **Step 4: Set matched route diagnostics before emitting navigation**

Replace the current per-param-only block:

```ts
for (const [k, v] of Object.entries(match.params)) {
  store.set(`/route/params/${k}`, v);
}
bus.emit('navigate', { path, params: match.params });
```

with:

```ts
setMatchedRouteState(path, match.params);
bus.emit('navigate', { path, params: match.params });
```

Do not emit `navigate` for unmatched routes in this issue.

- [ ] **Step 5: Simplify initial route entry**

Replace the current initial-route fallback:

```ts
const initialPath = window.location.pathname || '/';
const initialMatch = matchRoute(patterns, initialPath);
if (!initialMatch) {
  const defaultRoute = patterns[0] ?? '/';
  window.history.replaceState({}, '', defaultRoute);
  await enterRoute(defaultRoute);
} else {
  await enterRoute(initialPath);
}
```

with:

```ts
const initialPath = window.location.pathname || '/';
await enterRoute(initialPath);
```

This is the behavior change: no `patterns[0]` fallback and no `replaceState` redirect.

- [ ] **Step 6: Run the focused tests**

Run:

```bash
pnpm -F @rntme/ui-runtime test -- test/unit/entry.test.ts
```

Expected: PASS for the existing entry tests plus the three new tests.

- [ ] **Step 7: Commit the client implementation**

Run:

```bash
git add packages/runtime/ui-runtime/src/client/entry.tsx
git commit -m "fix(ui-runtime): render not-found for unmatched routes"
```

### Task 3: Update Current Runtime Documentation

**Files:**
- Modify: `docs/current/owners/packages/runtime/ui-runtime.md`

- [ ] **Step 1: Replace the stale routing gotcha**

Find this bullet under `## Invariants & gotchas`:

```md
- **The SPA initial route falls back to the first manifest pattern** (`entry.tsx`). If `window.location.pathname` matches no pattern, the client `history.replaceState`s to `patterns[0] ?? '/'`. Put a root route in the manifest to avoid surprise redirects.
```

Replace it with:

```md
- **Unknown browser paths render a client not-found state** (`entry.tsx`). The server still returns the HTML shell for unknown paths so deep links can hydrate, but after the manifest loads the client preserves `window.location.pathname`, renders a runtime-generated not-found screen without an app layout, and writes `/route/status = 'not_found'`, `/route/path`, and `/route/params = {}`. Matched routes write `/route/status = 'ok'`, `/route/path`, and `/route/params`.
```

- [ ] **Step 2: Update the deep-link debugging pointer**

Find this bullet under `## Where to look first`:

```md
- "Debug a failing SPA deep link" -> confirm the server falls through to the shell (`app.get('/*', ...)`), then verify the path matches a pattern in the manifest.
```

Replace it with:

```md
- "Debug a failing SPA deep link" -> confirm the server falls through to the shell (`app.get('/*', ...)`), then inspect `/route/status`, `/route/path`, and `/route/params` from `entry.tsx`; unmatched manifest paths render the runtime not-found screen without changing the URL.
```

- [ ] **Step 3: Run a docs diff check**

Run:

```bash
git diff -- docs/current/owners/packages/runtime/ui-runtime.md
```

Expected: only the stale first-route fallback gotcha and the deep-link debugging pointer changed.

- [ ] **Step 4: Commit the docs update**

Run:

```bash
git add docs/current/owners/packages/runtime/ui-runtime.md
git commit -m "docs(ui-runtime): document unmatched route behavior"
```

### Task 4: Run Final Gates And Prepare The DEV Handoff

**Files:**
- No new edits expected unless a gate reveals an issue in files touched by Tasks 1-3.

- [ ] **Step 1: Run package tests**

Run:

```bash
pnpm -F @rntme/ui-runtime test
```

Expected: PASS. This should include `test/unit/entry.test.ts`, server fallback tests, registry tests, screen-loader tests, and layout-manager tests.

- [ ] **Step 2: Run package build**

Run:

```bash
pnpm -F @rntme/ui-runtime build
```

Expected: PASS. If Tailwind emits its existing fallback CSS warning behavior from `src/build.ts`, record the exact output in the stage comment and verify the command exit code is still zero.

- [ ] **Step 3: Run whitespace validation**

Run:

```bash
git diff --check
```

Expected: no output and exit code 0.

- [ ] **Step 4: Optional browser smoke when practical**

If DEV has a generated UI app or local host already available, open an unmatched path such as `/missing-route-rnt-497` and verify:
- the address bar remains `/missing-route-rnt-497`;
- the visible page shows the runtime not-found screen;
- a valid manifest route still renders normally;
- browser back/forward between valid and unmatched paths swaps between the valid screen and not-found screen.

If no generated UI app is available without extra setup, skip this smoke and state that focused happy-dom route tests cover the behavior.

- [ ] **Step 5: Update the canonical PR**

Run:

```bash
git status --short
git push origin auto/rnt-497-ui-unmatched-route-not-found
```

Expected: working tree clean before push; PR #188 receives the new commits.

## Acceptance Checklist

- Unmatched initial path no longer calls `history.replaceState` to the first manifest route.
- Unmatched initial path preserves `window.location.pathname`.
- Unmatched initial path avoids layout, screen, and mount-data fetches for arbitrary manifest routes.
- Unmatched initial path renders a deterministic runtime-generated not-found screen through `AppShell` with `layoutSpec: null`.
- Unmatched routes set `/route/status = 'not_found'`, `/route/path`, and `/route/params = {}` without stale nested params.
- Matched routes set `/route/status = 'ok'`, `/route/path`, and `/route/params = match.params`.
- Valid route entry, module `navigate` event emission for matched routes, data refetch behavior, and browser `popstate` still work.
- Server SPA fallback still returns the shell for unknown paths; no server 404 behavior added.
- Current ui-runtime owner docs describe the new behavior.
- Required gates pass: `pnpm -F @rntme/ui-runtime test`, `pnpm -F @rntme/ui-runtime build`, `git diff --check`.

## Risks And Collision Points

- `entry.tsx` is also the host for module boot, transport middleware, route lifecycle events, registry actions, and screen data refetch. Keep edits local to route-state and route-entry branches.
- If another PR changes `@json-render/core` state-store behavior or route state conventions, re-run the stale-param tests before merging.
- Do not "improve" the fallback into authored custom 404 screens in this issue; that requires artifact schema, compiler validation, authoring docs, and probably a separate spec.
- Do not change the server fallback status code. `createApp` must keep returning the shell for direct deep links so the client can decide route validity.
- Browser history assertions can be brittle in happy-dom. Prefer assertions on pathname, fetch calls, rendered `AppShell` props, and store state over history length.
