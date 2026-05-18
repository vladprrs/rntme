> Status: historical.
> Date: 2026-05-09.
> Current source: docs/current/**, docs/decision-system.md, and current code/tests.
> Why retained: Completed RNT-498 execution plan retained as historical rationale and handoff context; it is not current-state truth by itself.

# UI Renderer ErrorBoundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add local React Error Boundaries around generated layout and screen rendering in `@rntme/ui-runtime`.

**Architecture:** Keep runtime-owned failure handling at the single renderer composition point: `layout-manager.tsx`. Add a small class Error Boundary that writes one sanitized record per scope to the runtime state store and renders a plain DOM fallback. Pass route/layout identities from `entry.tsx` so navigation resets only the affected boundary.

**Tech Stack:** TypeScript strict ESM, React 19 class Error Boundary lifecycle APIs, `@json-render/react`, `@json-render/core` state store, Vitest happy-dom, pnpm workspace filters.

---

## File Map

- Create `packages/runtime/ui-runtime/src/client/renderer-error-boundary.tsx`: class Error Boundary, sanitized render-error record type, fallback DOM, and state write/log side effects.
- Modify `packages/runtime/ui-runtime/src/client/layout-manager.tsx`: import the boundary, add `layoutKey`/`screenKey` props, and wrap layout and screen `<Renderer>` calls separately.
- Modify `packages/runtime/ui-runtime/src/client/entry.tsx`: track stable layout/screen identities from the matched route and pass them into `AppShell`.
- Modify `packages/runtime/ui-runtime/test/unit/layout-manager.test.ts`: add happy-dom regression coverage for screen crash locality, layout crash locality, sanitized state/logging, and screen-key recovery.
- Modify `packages/runtime/ui-runtime/test/unit/entry.test.ts`: add one routing assertion that `mountUiRuntime` passes route-derived `screenKey`/`layoutKey` and changes `screenKey` after navigation.
- Modify `docs/current/owners/packages/runtime/ui-runtime.md`: document renderer failure semantics, `/runtime/renderErrors`, reset behavior, and blank-screen debugging guidance.
- Do not modify `packages/runtime/ui-runtime/README.md`: current-doc link and local commands stay correct.
- Do not modify `docs/decision-system.md`: approved SPEC found no new strategic, architectural, or convention decision.

## Current Truth

- `packages/runtime/ui-runtime/src/client/layout-manager.tsx` renders `Renderer` directly for both `layoutRendererSpec` and `screenRendererSpec`.
- `AppShell` returns `#rntme-loading` until `screenSpec` exists, then renders `#rntme-app`, optional `#rntme-layout`, and `#rntme-screen`.
- `entry.tsx` already knows the matched route pattern, `routeEntry.layout`, and `routeEntry.screen` inside `enterRoute(path)`, but does not pass any identity to `AppShell`.
- `createRuntimeStateStore()` exposes `get`, `set`, and `update`; runtime boot errors already use `/runtime/bootErrors`.
- Existing layout-manager tests mount real React in happy-dom and can be extended to assert actual fallback DOM.
- Existing entry tests mock `react-dom/client` and inspect the last `AppShell` element passed to `root.render`.

## Implementation Tasks

### Task 1: Add Renderer Error Boundary

**Files:**
- Create `packages/runtime/ui-runtime/src/client/renderer-error-boundary.tsx`
- Test later in Task 3 through `layout-manager.test.ts`

- [ ] **Step 1: Create the boundary file**

Create `packages/runtime/ui-runtime/src/client/renderer-error-boundary.tsx`:

```tsx
import * as React from 'react';
import type { StateStore } from '@json-render/core';

export type RendererErrorScope = 'layout' | 'screen';

export type RenderErrorRecord = {
  scope: RendererErrorScope;
  identity: string;
  message: 'Renderer failed';
  errorName: string;
  componentStack?: string;
};

type RendererErrorBoundaryProps = {
  scope: RendererErrorScope;
  identity: string;
  store: StateStore;
  fallbackId: string;
  children: React.ReactNode;
};

type RendererErrorBoundaryState = {
  hasError: boolean;
};

export class RendererErrorBoundary extends React.Component<
  RendererErrorBoundaryProps,
  RendererErrorBoundaryState
> {
  state: RendererErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): RendererErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo): void {
    const record: RenderErrorRecord = {
      scope: this.props.scope,
      identity: this.props.identity,
      message: 'Renderer failed',
      errorName: error instanceof Error ? error.name : typeof error,
    };

    if (info.componentStack) {
      record.componentStack = info.componentStack;
    }

    this.props.store.set(`/runtime/renderErrors/${this.props.scope}`, record);
    console.error('[rntme] UI renderer failed', record);
  }

  componentDidUpdate(prevProps: RendererErrorBoundaryProps): void {
    if (prevProps.identity !== this.props.identity && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render(): React.ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const label =
      this.props.scope === 'screen'
        ? 'This screen failed to render.'
        : 'This layout failed to render.';

    return React.createElement(
      'div',
      {
        id: this.props.fallbackId,
        role: 'alert',
        'data-rntme-error-scope': this.props.scope,
        style: { border: '1px solid #b91c1c', padding: 16, background: '#fef2f2' },
      },
      React.createElement('strong', null, label),
      React.createElement(
        'p',
        null,
        this.props.scope === 'screen'
          ? 'Navigate to another route or reload after the screen is fixed.'
          : 'Reload after the layout is fixed, or navigate to a route with another layout.',
      ),
    );
  }
}
```

- [ ] **Step 2: Run typecheck expectation for the new file**

Run:

```bash
pnpm -F @rntme/ui-runtime exec tsc -p tsconfig.json --noEmit --pretty false
```

Expected after only this file exists: PASS. If direct workspace dependency `dist/` is missing in a fresh worktree, first run `pnpm -F @rntme/contracts-client-runtime-v1 build`.

- [ ] **Step 3: Commit the boundary shell**

Run:

```bash
git add packages/runtime/ui-runtime/src/client/renderer-error-boundary.tsx
git commit -m "feat(ui-runtime): add renderer error boundary"
```

### Task 2: Wrap Layout And Screen Renderers Separately

**Files:**
- Modify `packages/runtime/ui-runtime/src/client/layout-manager.tsx`

- [ ] **Step 1: Import the boundary**

Add this import near the other local imports:

```tsx
import { RendererErrorBoundary } from './renderer-error-boundary.js';
```

- [ ] **Step 2: Extend `AppShellProps` with renderer identities**

Add optional keys to `AppShellProps`:

```tsx
  layoutKey?: string | undefined;
  screenKey?: string | undefined;
```

Use optional props so existing direct `AppShell` tests and external host consumers are not forced to change at the same time as the internal runtime.

- [ ] **Step 3: Destructure keys with stable defaults**

Change the function signature to:

```tsx
export function AppShell({
  layoutSpec,
  screenSpec,
  registry,
  actionHandlers,
  store,
  operationRegistry,
  layoutKey = layoutSpec ? 'layout:default' : 'layout:none',
  screenKey = 'screen:default',
}: AppShellProps): React.ReactElement {
```

- [ ] **Step 4: Wrap the layout renderer**

Replace the current layout branch:

```tsx
layoutRendererSpec
  ? React.createElement('div', { id: 'rntme-layout', key: 'layout' },
      React.createElement(Renderer, { spec: layoutRendererSpec, registry }),
    )
  : null,
```

with:

```tsx
layoutRendererSpec
  ? React.createElement('div', { id: 'rntme-layout', key: 'layout' },
      React.createElement(RendererErrorBoundary, {
        key: layoutKey,
        scope: 'layout',
        identity: layoutKey,
        store,
        fallbackId: 'rntme-layout-error',
      },
        React.createElement(Renderer, { spec: layoutRendererSpec, registry }),
      ),
    )
  : null,
```

- [ ] **Step 5: Wrap the screen renderer**

Replace the current screen renderer:

```tsx
React.createElement('div', { id: 'rntme-screen', key: 'screen' },
  React.createElement(Renderer, { spec: screenRendererSpec, registry }),
),
```

with:

```tsx
React.createElement('div', { id: 'rntme-screen', key: 'screen' },
  React.createElement(RendererErrorBoundary, {
    key: screenKey,
    scope: 'screen',
    identity: screenKey,
    store,
    fallbackId: 'rntme-screen-error',
  },
    React.createElement(Renderer, { spec: screenRendererSpec, registry }),
  ),
),
```

- [ ] **Step 6: Run focused typecheck**

Run:

```bash
pnpm -F @rntme/ui-runtime exec tsc -p tsconfig.json --noEmit --pretty false
```

Expected: PASS.

- [ ] **Step 7: Commit layout-manager wiring**

Run:

```bash
git add packages/runtime/ui-runtime/src/client/layout-manager.tsx
git commit -m "feat(ui-runtime): isolate layout and screen render failures"
```

### Task 3: Add Layout-Manager Regression Tests

**Files:**
- Modify `packages/runtime/ui-runtime/test/unit/layout-manager.test.ts`

- [ ] **Step 1: Add local test helpers**

Below the `IS_REACT_ACT_ENVIRONMENT` assignment in `layout-manager.test.ts`, add:

```ts
function mountShell(props: Partial<React.ComponentProps<typeof AppShell>> = {}) {
  const target = document.createElement('div');
  document.body.appendChild(target);
  const root = createRoot(target);
  const store = createRuntimeStateStore();

  const baseProps: React.ComponentProps<typeof AppShell> = {
    layoutSpec: null,
    screenSpec: {
      root: 'page',
      elements: {
        page: { type: 'SafeBlock', props: { text: 'screen ok' } },
      },
    },
    registry: {
      SafeBlock: ({ element }) =>
        React.createElement('div', null, String(element.props.text ?? 'ok')),
      ThrowBlock: () => {
        throw new Error('secret token 123');
      },
    },
    actionHandlers: {},
    store,
    screenKey: 'screen:/',
    layoutKey: 'layout:none',
  };

  return {
    target,
    root,
    store,
    render: async (nextProps: Partial<React.ComponentProps<typeof AppShell>> = {}) => {
      await act(async () => {
        root.render(React.createElement(AppShell, { ...baseProps, ...props, ...nextProps }));
      });
    },
    unmount: () => root.unmount(),
  };
}
```

This helper intentionally throws `secret token 123`; later assertions must prove that text never reaches fallback DOM or `/runtime/renderErrors/*`.

- [ ] **Step 2: Silence React console noise without asserting call counts**

Inside the existing `describe('AppShell module component bridge', ...)` block, add:

```ts
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  document.body.innerHTML = '';
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleErrorSpy.mockRestore();
});
```

Update the Vitest import to include `afterEach` and `beforeEach`.

- [ ] **Step 3: Test screen crash locality and sanitized diagnostics**

Add this test:

```ts
it('renders a sanitized screen fallback without unmounting the app shell', async () => {
  const shell = mountShell({
    screenSpec: {
      root: 'boom',
      elements: {
        boom: { type: 'ThrowBlock', props: {} },
      },
    },
    screenKey: 'screen:/broken:broken',
  });

  await shell.render();

  expect(shell.target.querySelector('#rntme-app')).not.toBeNull();
  expect(shell.target.querySelector('#rntme-screen')).not.toBeNull();
  expect(shell.target.querySelector('#rntme-screen-error')?.textContent).toContain(
    'This screen failed to render.',
  );
  expect(shell.target.textContent).not.toContain('secret token 123');

  const record = shell.store.get('/runtime/renderErrors/screen') as {
    scope: string;
    identity: string;
    message: string;
    errorName: string;
  };

  expect(record).toMatchObject({
    scope: 'screen',
    identity: 'screen:/broken:broken',
    message: 'Renderer failed',
    errorName: 'Error',
  });
  expect(JSON.stringify(record)).not.toContain('secret token 123');
  expect(consoleErrorSpy.mock.calls.some(([message]) => message === '[rntme] UI renderer failed')).toBe(true);
});
```

- [ ] **Step 4: Test layout crash locality**

Add this test:

```ts
it('renders a layout fallback while the screen still renders', async () => {
  const shell = mountShell({
    layoutSpec: {
      root: 'layout',
      elements: {
        layout: { type: 'ThrowBlock', props: {} },
      },
    },
    layoutKey: 'layout:main',
    screenSpec: {
      root: 'page',
      elements: {
        page: { type: 'SafeBlock', props: { text: 'screen survived' } },
      },
    },
  });

  await shell.render();

  expect(shell.target.querySelector('#rntme-layout-error')?.textContent).toContain(
    'This layout failed to render.',
  );
  expect(shell.target.querySelector('#rntme-screen')?.textContent).toContain('screen survived');
  expect(shell.store.get('/runtime/renderErrors/layout')).toMatchObject({
    scope: 'layout',
    identity: 'layout:main',
    message: 'Renderer failed',
  });
});
```

- [ ] **Step 5: Test screen recovery when identity changes**

Add this test:

```ts
it('resets a failed screen boundary when screenKey changes', async () => {
  const shell = mountShell({
    screenSpec: {
      root: 'boom',
      elements: {
        boom: { type: 'ThrowBlock', props: {} },
      },
    },
    screenKey: 'screen:/broken:broken',
  });

  await shell.render();
  expect(shell.target.querySelector('#rntme-screen-error')).not.toBeNull();

  await shell.render({
    screenKey: 'screen:/healthy:healthy',
    screenSpec: {
      root: 'page',
      elements: {
        page: { type: 'SafeBlock', props: { text: 'healthy screen' } },
      },
    },
  });

  expect(shell.target.querySelector('#rntme-screen-error')).toBeNull();
  expect(shell.target.querySelector('#rntme-screen')?.textContent).toContain('healthy screen');
});
```

- [ ] **Step 6: Run the focused layout-manager tests**

Run:

```bash
pnpm -F @rntme/ui-runtime test -- test/unit/layout-manager.test.ts
```

Expected: PASS. Do not assert an exact `console.error` call count; React dev mode may log additional boundary diagnostics.

- [ ] **Step 7: Commit regression tests**

Run:

```bash
git add packages/runtime/ui-runtime/test/unit/layout-manager.test.ts
git commit -m "test(ui-runtime): cover renderer error boundaries"
```

### Task 4: Pass Route And Layout Identities From Entry

**Files:**
- Modify `packages/runtime/ui-runtime/src/client/entry.tsx`
- Modify `packages/runtime/ui-runtime/test/unit/entry.test.ts`

- [ ] **Step 1: Add current identity variables**

Near existing `currentLayoutName` in `entry.tsx`, add:

```tsx
  let currentLayoutKey = 'layout:none';
  let currentScreenKey = 'screen:none';
```

- [ ] **Step 2: Set identities in `enterRoute(path)`**

After `const routeEntry = manifest.routes[match.pattern];`, once the null guard has passed, add:

```tsx
    currentLayoutKey = `layout:${routeEntry.layout}`;
    currentScreenKey = `screen:${match.pattern}:${routeEntry.screen}`;
```

This resets screen failures when the matched route pattern changes, even when two route patterns reuse the same compiled screen.

- [ ] **Step 3: Pass identities to `AppShell`**

In `rerender()`, add these props:

```tsx
        layoutKey: currentLayoutKey,
        screenKey: currentScreenKey,
```

- [ ] **Step 4: Add an entry test for route-derived keys**

In `packages/runtime/ui-runtime/test/unit/entry.test.ts`, add a test:

```ts
  it('passes route-derived renderer identity keys to AppShell and updates them on navigation', async () => {
    const { mountUiRuntime } = await import('../../src/client/entry.js');
    const manifest: CompiledManifest = {
      version: '2.0',
      metadata: { title: 'Notes' },
      routes: {
        '/': { layout: 'main', screen: 'home' },
        '/settings': { layout: 'main', screen: 'settings' },
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
    const home: CompiledScreen = {
      spec: {
        root: 'home',
        elements: {
          home: { type: 'Heading', props: { text: 'Home' } },
        },
      },
    };
    const settings: CompiledScreen = {
      spec: {
        root: 'settings',
        elements: {
          settings: { type: 'Heading', props: { text: 'Settings' } },
        },
      },
    };
    const transport = vi.fn(async (input: RequestInfo | URL) => {
      const url = requestPath(input);
      if (url === '/_manifest.json') return Response.json(manifest);
      if (url === '/_layouts/main.json') return Response.json(layout);
      if (url === '/_screens/home.json') return Response.json(home);
      if (url === '/_screens/settings.json') return Response.json(settings);
      return new Response('missing', { status: 404 });
    }) as unknown as typeof fetch;

    await mountUiRuntime({
      manifestUrl: '/_manifest.json',
      target: document.querySelector<HTMLElement>('#root')!,
      transport,
    });

    const firstApp = render.mock.calls.at(-1)?.[0] as {
      props: {
        actionHandlers: Record<string, (params: Record<string, unknown>) => Promise<void>>;
        layoutKey: string;
        screenKey: string;
      };
    };
    expect(firstApp.props.layoutKey).toBe('layout:main');
    expect(firstApp.props.screenKey).toBe('screen:/:home');

    await firstApp.props.actionHandlers.navigate({ to: '/settings' });

    const secondApp = render.mock.calls.at(-1)?.[0] as {
      props: {
        layoutKey: string;
        screenKey: string;
      };
    };
    expect(secondApp.props.layoutKey).toBe('layout:main');
    expect(secondApp.props.screenKey).toBe('screen:/settings:settings');
  });
```

- [ ] **Step 5: Run focused entry tests**

Run:

```bash
pnpm -F @rntme/ui-runtime test -- test/unit/entry.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit route identity wiring**

Run:

```bash
git add packages/runtime/ui-runtime/src/client/entry.tsx packages/runtime/ui-runtime/test/unit/entry.test.ts
git commit -m "feat(ui-runtime): reset renderer boundaries by route identity"
```

### Task 5: Update Current Runtime Docs

**Files:**
- Modify `docs/current/owners/packages/runtime/ui-runtime.md`

- [ ] **Step 1: Document state slots**

In the "Boot lifecycle and resilience" state slots section, add:

```md
- `/runtime/renderErrors/layout` and `/runtime/renderErrors/screen`:
  optional sanitized renderer-failure records shaped as
  `{ scope, identity, message: 'Renderer failed', errorName, componentStack? }`.
  These are inspectability/debug slots, not user notification APIs. The runtime
  replaces the prior record for the same scope instead of keeping a growing log.
```

- [ ] **Step 2: Document renderer failure semantics**

After "Failure semantics for non-identity modules", add:

```md
### Renderer failure semantics

Generated layout and screen specs are rendered behind separate React Error
Boundaries in `layout-manager.tsx`. A screen render crash replaces only the
screen region with `#rntme-screen-error`; the layout remains mounted. A layout
render crash replaces only the layout region with `#rntme-layout-error`; the
screen still renders when it can.

Fallback UI is plain React DOM with `role="alert"` and
`data-rntme-error-scope`. It intentionally does not show raw exception
messages, JavaScript stacks, props, state snapshots, request data, or compiled
artifact JSON. Sanitized records are written to `/runtime/renderErrors/<scope>`
and logged once with `[rntme] UI renderer failed`.

Screen boundaries reset when navigation changes the route-derived screen
identity (`screen:<route-pattern>:<screen-name>`). Layout boundaries reset when
the layout identity changes (`layout:<layout-name>`) or the page reloads.
```

- [ ] **Step 3: Update invariants and gotchas**

Add a gotcha near the existing `AppShell`/blank-screen notes:

```md
- **Renderer crashes fail locally** (`layout-manager.tsx`). Layout and screen
  `<Renderer>` calls have separate boundaries; fallback copy is sanitized and
  diagnostics live under `/runtime/renderErrors/<scope>`. If the same broken
  route is revisited, the boundary will throw and show the fallback again until
  the compiled artifact or module component is fixed.
```

- [ ] **Step 4: Update where-to-look-first**

Replace the current blank-screen bullet:

```md
- "Debug a blank screen after navigation" -> `layout-manager.tsx` renders `Loading...` until `screenSpec` is non-null; check the `_screens/:name.json` response and the store subscribe callback in `entry.tsx`.
```

with:

```md
- "Debug a blank screen after navigation" -> first check for `#rntme-screen-error`,
  `#rntme-layout-error`, and `/runtime/renderErrors/<scope>`; then check that
  `_screens/:name.json` loaded and that the store subscribe callback in
  `entry.tsx` rerendered `AppShell`.
```

- [ ] **Step 5: Commit docs**

Run:

```bash
git add docs/current/owners/packages/runtime/ui-runtime.md
git commit -m "docs(ui-runtime): describe renderer error fallback"
```

### Task 6: Package Gates And PR Update

**Files:**
- No additional expected source files unless gates reveal issues.

- [ ] **Step 1: Run package test gate**

Run:

```bash
pnpm -F @rntme/ui-runtime test
```

Expected: PASS. Expected count will be higher than the SPEC baseline of 9 files / 38 tests because this plan adds renderer-boundary cases.

- [ ] **Step 2: Run package build gate**

Run:

```bash
pnpm -F @rntme/ui-runtime build
```

Expected: PASS. If the fresh worktree lacks direct dependency output, run:

```bash
pnpm -F @rntme/contracts-client-runtime-v1 build
pnpm -F @rntme/artifact-shared build
pnpm -F @rntme/ui build
pnpm -F @rntme/ui-runtime build
```

- [ ] **Step 3: Run whitespace gate**

Run:

```bash
git diff --check origin/main...HEAD
```

Expected: PASS.

- [ ] **Step 4: Evaluate browser smoke**

Default: no browser smoke required if the happy-dom tests verify visible fallback DOM and route reset. Run a browser smoke only if implementation changes fallback styling, app shell composition, or static bundle behavior beyond the DOM assertions above.

- [ ] **Step 5: Update branch against latest main before handoff**

Run:

```bash
git fetch --prune origin
git merge origin/main
```

Resolve only conflicts in this issue's files. Re-run:

```bash
pnpm -F @rntme/ui-runtime test
pnpm -F @rntme/ui-runtime build
git diff --check origin/main...HEAD
```

- [ ] **Step 6: Push the canonical branch and update PR #187**

Run:

```bash
git push origin auto/rnt-498-ui-renderer-error-boundary
```

Use the existing draft PR: https://github.com/vladprrs/rntme/pull/187. Do not create another branch, worktree, child issue, or phase PR.

## Acceptance Checklist

- Renderer crashes in generated screen rendering show `#rntme-screen-error` instead of blanking `#rntme-app`.
- Renderer crashes in generated layout rendering show `#rntme-layout-error` while the screen still renders when possible.
- Fallback UI uses plain DOM with `role="alert"` and does not expose raw error message, JavaScript stack, props, state, route data, tokens, request bodies, or artifact JSON.
- `/runtime/renderErrors/layout` and `/runtime/renderErrors/screen` store bounded sanitized records with `scope`, `identity`, `message: 'Renderer failed'`, `errorName`, and optional React `componentStack`.
- `console.error` logging is present but tests do not depend on exact React dev-mode call counts.
- Navigation to a different route-derived screen identity resets the screen boundary.
- Layout boundary resets on layout identity change or full reload; same broken layout keeps showing fallback.
- Owner docs describe renderer error behavior and reset semantics.
- No `docs/decision-system.md` or package README update unless implementation changes a documented command/link/convention.

## Risks And Collision Points

- React Error Boundaries do not catch event-handler errors, async callback errors, server-rendering errors, or errors thrown inside the boundary itself; docs should not imply broader coverage.
- `error.message` can contain secrets or artifact details. Keep it out of DOM, runtime state, and planned record shape.
- React dev-mode logging can add extra `console.error` calls. Tests should look for the runtime log prefix, not assert exact call counts.
- If another active agent edits `layout-manager.tsx`, `entry.tsx`, or `docs/current/owners/packages/runtime/ui-runtime.md`, coordinate on the same canonical worktree/branch and do not race.
