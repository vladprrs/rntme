> Status: autonomous-spec.
> Date: 2026-05-09.
> Current source: Multica issue RNT-497, audit U-353 / RNT-213#L4, `docs/decision-system.md`, current ui-runtime owner docs, and code/tests on `origin/main` at `ff8bbdb5`.
> Why retained: SPEC rationale for making unmatched UI routes visible and deterministic instead of silently replacing the URL with the first manifest route; verify current truth against code/tests before implementation.

# RNT-497 UI unmatched route not-found - design

## Problem

`@rntme/ui-runtime` serves every unknown server path with the SPA shell so deep
links can be resolved in the browser. The client then loads
`manifest.routes`, matches `window.location.pathname`, and currently does this
when no pattern matches:

```ts
const defaultRoute = patterns[0] ?? '/';
window.history.replaceState({}, '', defaultRoute);
await enterRoute(defaultRoute);
```

That hides authoring and routing bugs. A user opening `/typo` sees the first
route instead of a clear not-found state, the address bar is silently changed,
and testing a generated app can produce a false pass.

## Goals

- Preserve the original browser URL for an unmatched initial path.
- Render an explicit deterministic not-found/error state instead of leaving the
  app blank or redirecting to `patterns[0]`.
- Keep valid initial routes, route-param matching, programmatic navigation, and
  browser back/forward behavior working through the existing history-based
  router.
- Keep the server SPA fallback route unchanged: unknown browser paths still
  receive the shell so the client can decide whether the path is valid.
- Add focused regression tests for unmatched initial path and normal route
  entry; include popstate/unmatched-path coverage if the implementation changes
  the shared route-entry path.
- Update current ui-runtime docs so generated-app authors and future agents know
  unmatched browser paths do not redirect to the first route.

## Non-goals

- No UI artifact schema change for authored `notFound` screens in this issue.
- No wildcard route support in `@rntme/contracts-client-runtime-v1`.
- No HTTP 404 status for SPA deep links from `createApp`; the static shell must
  continue to serve unknown paths so direct links can hydrate client-side.
- No custom renderer or error-boundary work; renderer exceptions are covered by
  RNT-498.
- No `docs/decision-system.md` edit.

## Current Context

- `packages/runtime/ui-runtime/src/client/entry.tsx` owns browser routing for
  the SPA host. It builds route patterns from `manifest.routes`, calls
  `matchRoute`, loads layout/screen JSON through `createScreenLoader`, emits the
  `navigate` lifecycle event for matched routes, and listens to `popstate`.
- `enterRoute(path)` currently returns early when `matchRoute` returns `null`.
  The unmatched initial-path branch works around that by replacing the URL with
  the first pattern before calling `enterRoute`.
- `AppShell` can render a screen without a layout: when `screenSpec` is non-null
  and `layoutSpec` is null, it renders only the screen inside `#rntme-screen`.
  That gives the runtime a minimal way to show a generated fallback screen
  without selecting an arbitrary app layout.
- Server `createApp` intentionally returns the shell for unknown paths. Current
  server tests cover that behavior and should not be inverted by this issue.
- Current owner docs explicitly document the problematic behavior under
  "Invariants & gotchas": the SPA initial route falls back to the first manifest
  pattern and `replaceState`s the URL.
- Existing `entry.test.ts` covers normal route entry, transport usage, module
  boot/navigation event behavior, and visible-root data refetch behavior. It
  does not cover unmatched initial paths.

## Decision-System Fit

- **G3 / F4 Inspectability:** unmatched paths must be visible to humans through
  the running UI, not hidden behind a URL rewrite.
- **G2 / F5 LLM-authorability:** agent-authored routes should fail fast and
  predictably during testing; a typo should produce an inspectable fallback
  state.
- **G1 / F6 Repeatability:** the same manifest and input URL should produce the
  same route state without relying on manifest insertion order as an implicit
  default route.
- **G5 / F2 Canonical-way check:** preserve the existing history-based client
  router and `matchRoute` helper. Do not add a second wildcard-routing
  mechanism unless a later artifact/router spec intentionally does that.
- **F8 Leverage existing code:** use the existing `AppShell`, json-render
  registry, state store, and browser history plumbing; no new routing library is
  needed.

Applicable locked bets include **Blueprint folder = authoring/versioning/deploy
unit**, **AI agent = primary author**, **JSON-only authoring**, **4-layer
validation**, **Browser module contract `@rntme/contracts-client-runtime-v1`**,
and **No backwards-compatibility shims**. This design does not contradict any
Goal, Filter, or locked Bet.

## Proposed Design

### 1. Add a client-side runtime not-found state

Add a small internal helper in `entry.tsx`, for example
`renderNotFound(path: string)`, used whenever the client route cannot match the
manifest.

The helper should:

- preserve `window.location.pathname` and never call `history.replaceState`;
- set `currentLayout = null`, `currentLayoutName = null`, and
  `currentScreen` to a runtime-generated `CompiledScreen`;
- store route diagnostics such as `/route/status = 'not_found'` and
  `/route/path = path` so runtime state is inspectable;
- replace `/route/params` with `{}` for unmatched paths so stale params from a
  previously matched route are not exposed as current route state;
- call `rerender()`;
- avoid layout/screen JSON fetches and mount data refetches for the unmatched
  path.

The generated screen should be intentionally plain and independent of app
artifacts. A minimal json-render spec is enough:

```ts
const notFoundScreen: CompiledScreen = {
  spec: {
    root: 'notFound',
    elements: {
      notFound: { type: 'Stack', props: { direction: 'vertical', gap: 'lg' }, children: ['title', 'path'] },
      title: { type: 'Heading', props: { level: 1, text: 'Page not found' } },
      path: { type: 'Text', props: { text: path } },
    },
  },
};
```

The exact component names should use the existing shadcn/json-render catalog
names already exercised by `entry.test.ts` fixtures. If `Text` is not available
or would make the fallback brittle, use only catalog components already present
in tests and bundle coverage.

### 2. Route all unmatched paths through the same branch

Change `enterRoute(path)` so unmatched routes render not-found directly instead
of returning with stale UI:

```ts
async function enterRoute(path: string): Promise<void> {
  const match = matchRoute(patterns, path);
  if (!match) {
    renderNotFound(path);
    return;
  }
  // existing matched-route behavior
}
```

Then simplify initial load to always call `enterRoute(initialPath)`. This
removes the special `patterns[0]` fallback branch and makes initial load,
programmatic navigation to a bad route, and browser back/forward to a bad route
deterministic.

For matched routes, set `/route/status = 'ok'`, `/route/path = path`, and
`/route/params = match.params` before rendering the valid screen. This keeps
route diagnostics consistent after a user moves from a not-found path back to a
valid path and prevents old params from surviving route changes. Existing
per-param state paths such as `/route/params/:name` may continue to work if the
runtime still writes params individually, but the object snapshot is the
inspectable route authority.

Do not add a new lifecycle event in the client-runtime contract for this issue.
Existing modules that listen for `navigate` should continue receiving events for
matched routes. A later observability/module contract spec can add a dedicated
not-found event if needed.

### 3. Preserve server fallback behavior and route matching semantics

Leave `createApp` fallback responses as `200` shell responses for `GET /*`.
That behavior is required for direct deep links and is already documented under
server routes.

Do not change `matchRoute` precedence or add wildcard support in
`@rntme/contracts-client-runtime-v1`. Literal-first and parameterized matching
remain the route authority for valid paths.

### 4. Tests

Add focused tests in `packages/runtime/ui-runtime/test/unit/entry.test.ts`:

- unmatched initial path preserves the path in `window.location.pathname`,
  does not fetch any `/_layouts/*` or `/_screens/*` JSON, renders a not-found
  screen, and does not call `history.replaceState` with the first route;
- normal initial route still loads manifest, layout, screen, and mount data as
  today;
- back/forward from a valid path to an unmatched path renders not-found so stale
  screens are not left mounted.

Keep server tests unchanged except for comments if needed: `/issues/123` should
still receive the shell from `createApp`; the visible not-found state is a
client decision after manifest load.

### 5. Docs touch

Update `docs/current/owners/packages/runtime/ui-runtime.md`:

- replace the gotcha that says unmatched initial routes fall back to the first
  manifest pattern;
- document the new behavior: unknown browser paths hydrate the shell, the
  client preserves the URL, renders the runtime not-found screen, and exposes
  route diagnostics in state;
- keep the note that server unknown paths return the shell for client-side deep
  link resolution.

The local `packages/runtime/ui-runtime/README.md` does not need a change unless
the command hint or current-doc link changes.

## Alternatives Rejected

- **Keep redirecting to the first manifest route and document it.** Rejected
  because it hides route bugs and keeps behavior dependent on manifest pattern
  order.
- **Return HTTP 404 for unknown server paths.** Rejected for this issue because
  it would change `createApp`'s server-side SPA fallback contract and broaden
  the audit fix into server route-status semantics. The server has the artifact
  manifest and could perform route matching in a later design, but this issue
  keeps the current shell fallback and makes the client route state explicit.
- **Require every artifact to define a 404 route now.** Rejected as too broad
  for a runtime audit fix. Authored not-found routes may be useful later, but
  they need artifact schema, validation, docs, and compiler decisions.
- **Add wildcard route matching to the shared client-runtime router.** Rejected
  for this issue because it changes route semantics across packages. The audit
  gap is the silent redirect, not missing wildcard support.
- **Use the first route's layout around the fallback screen.** Rejected because
  it would still make the first route special and could load app layout data or
  auth-dependent UI unrelated to the bad path.

## Validation and Evidence

Required DEV gates:

- `pnpm -F @rntme/ui-runtime test`
- `pnpm -F @rntme/ui-runtime build`
- `git diff --check`

If DEV changes the visual fallback in a way that needs browser confidence, add
a generated UI app smoke that opens an unmatched path, verifies the URL is
unchanged, and confirms the not-found state is visible.

SPEC evidence:

- Reviewed `AGENTS.md`, `docs/README.md`, `docs/decision-system.md`,
  `packages/runtime/ui-runtime/README.md`, current ui-runtime owner docs,
  audit U-353 entries, `entry.tsx`, `layout-manager.tsx`, server tests, and
  entry client tests.
- Confirmed the current client code uses `patterns[0] ?? '/'`,
  `history.replaceState`, and `enterRoute(defaultRoute)` for an unmatched
  initial path.
- Confirmed `createApp` intentionally returns the shell for unknown paths and
  should remain server-side SPA fallback.
- Confirmed `AppShell` can render a screen with `layoutSpec: null`, allowing a
  runtime not-found screen without selecting a manifest route or layout.

## Risks

- A generated fallback screen depends on catalog component names. Use only
  components already covered by package tests or add a test that renders the
  fallback through `AppShell`.
- Programmatic navigation to an invalid route will now show not-found instead
  of silently leaving the previous screen mounted. That is more inspectable, but
  tests should lock the new behavior so it is intentional.
- Route diagnostics under `/route/*` are runtime-owned state. Keep them small
  and documented; do not imply they are authored artifact schema.
- Browser history tests in happy-dom can be brittle. Prefer direct assertions on
  pathname, fetch calls, and the rendered `AppShell` props over timing-sensitive
  history-length checks.

## PLAN/DEV Handoff

Implementation should stay in the canonical workspace for RNT-497 and keep the
PR scoped to:

- `packages/runtime/ui-runtime/src/client/entry.tsx`;
- focused tests under `packages/runtime/ui-runtime/test/unit/entry.test.ts`;
- `docs/current/owners/packages/runtime/ui-runtime.md`.

Recommended next stage: PLAN/DEV can implement directly from this spec. No
decision-system blocker is present.
