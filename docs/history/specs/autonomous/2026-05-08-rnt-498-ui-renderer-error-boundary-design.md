> Status: autonomous-spec.
> Date: 2026-05-08.
> Current source: Multica issue RNT-498, audit U-347 / RNT-213#M3, `docs/decision-system.md`, current `@rntme/ui-runtime` owner docs, React error-boundary docs, and code/tests on `origin/main` at `ff8bbdb5`.
> Why retained: SPEC rationale for making UI renderer failures visible, local, and recoverable; verify current truth against code/tests before implementation.

# RNT-498 UI renderer ErrorBoundary - design

## Problem

`@rntme/ui-runtime` renders compiled layout and screen specs through
`@json-render/react` without a React Error Boundary:

```tsx
React.createElement(Renderer, { spec: screenRendererSpec, registry })
```

If a generated layout, screen, or module component throws during render, React
can unmount the whole SPA tree. The user sees a blank page or a root-level
crash instead of a local, inspectable failure state. This weakens G3
inspectability and the G2 correction loop because a generated UI defect does
not produce a visible local symptom or a focused regression target.

## Goals

- Catch render-time crashes from generated layout/screen trees with a React
  Error Boundary before they blank the whole app.
- Keep failure local: a screen render failure should not remove the layout,
  and a layout render failure should not remove the screen when the screen can
  still render.
- Show a safe user-visible fallback that does not print raw exception messages,
  stack traces, props, state, tokens, request bodies, or artifact JSON.
- Preserve actionable local diagnostics through a structured runtime error
  record and development/operator logging.
- Define route recovery semantics: navigation to another route must reset the
  screen boundary, and layout boundary reset must follow layout identity.
- Add focused tests that simulate throwing renderer children and prove the
  fallback is rendered instead of unmounting the whole shell.
- Update current runtime docs to describe renderer error behavior.

## Non-goals

- No re-validation or mutation of compiled screen/layout specs in
  `ui-runtime`; the compiler still owns artifact validation.
- No custom json-render engine or replacement for `@json-render/react`.
- No global React root boundary for every boot/runtime failure in this issue;
  the target is generated layout/screen rendering.
- No telemetry backend, OpenTelemetry exporter, or server-side error ingest.
  Console logging and state exposure are enough for this package-local fix.
- No change to unmatched-route behavior, screen-loader caching, action alert
  behavior, or boot error semantics.
- No `docs/decision-system.md` edit.

## Current Context

- `docs/current/owners/packages/runtime/ui-runtime.md` says
  `layout-manager.tsx` composes the json-render providers and renders layout
  and screen `<Renderer>` trees.
- The same owner doc records the current invariant that screen and layout JSON
  are passed verbatim into `<Renderer>` and are not re-validated by runtime.
- `AppShell` returns `#rntme-loading` until a screen spec exists, then renders
  `#rntme-app`, optional `#rntme-layout`, and `#rntme-screen`.
- `entry.tsx` keeps `currentLayout`, `currentLayoutName`, and `currentScreen`
  in local variables. `enterRoute(path)` loads the route's layout/screen and
  calls `rerender()`.
- Existing runtime resilience behavior stores module boot failures in
  `/runtime/bootErrors` and logs them with `console.error`.
- Existing tests cover `layout-manager.tsx`, route mounting, module boot
  resilience, and the production bundle.
- React's official docs describe Error Boundaries as class components using
  `static getDerivedStateFromError` for fallback UI and `componentDidCatch` for
  logging; they catch render errors in children, but not event handlers,
  asynchronous callbacks, server rendering, or errors inside the boundary
  itself.

## Decision-System Fit

- **G3 / F4 Inspectability:** a renderer crash becomes visible in the UI and
  available as structured runtime state instead of requiring a user to infer a
  blank page from source code.
- **G2 / F5 LLM-authorability:** generated UI failures become deterministic,
  local feedback that an agent can reproduce with a focused regression test.
- **G5 / F2 Canonical-way check:** renderer failure handling should live in
  `layout-manager.tsx`, the one place that renders compiled specs, rather than
  in each generated screen/component.
- **F8 Leverage existing standards and libraries:** use React's native Error
  Boundary mechanism instead of a custom render wrapper.
- Applicable locked bets are preserved: JSON-only authoring, 4-layer
  validation, and no exceptions across validation/compile boundaries. This
  issue catches browser render exceptions at the host boundary; it does not
  change artifact validation contracts.
- No contradiction with Goals, Filters, or locked Bets found.

## Proposed Design

### 1. Add a renderer-scoped Error Boundary

Add a small client-side boundary near `layout-manager.tsx`, either in the same
file or a sibling such as `renderer-error-boundary.tsx`. It should be a class
component because React Error Boundaries are lifecycle-based.

The boundary props should include:

- `scope`: `'layout' | 'screen'`
- `identity`: stable reset key (`layout:<layoutName-or-none>` and
  `screen:<route-pattern-or-screen-name>`)
- `store`: the runtime `StateStore`
- `fallbackId`: stable DOM id such as `rntme-layout-error` or
  `rntme-screen-error`
- `children`

State should track `hasError`. `getDerivedStateFromError()` switches to the
fallback. `componentDidCatch(error, info)` should:

- build a sanitized record with `scope`, `identity`, `errorName`, a generic
  message such as `Renderer failed`, and `componentStack` if available;
- write it to `/runtime/renderErrors/<scope>`;
- log one concise `console.error('[rntme] UI renderer failed', record)` entry.

Do not copy raw `error.message`, stack traces, props, state snapshots, screen
JSON, or route data into the visible fallback or store. If DEV wants raw local
diagnostics later, that should be an explicit debug-mode decision.

### 2. Wrap layout and screen Renderer separately

`AppShell` should wrap each `<Renderer>` call, not the whole app:

- layout renderer inside a layout boundary;
- screen renderer inside a screen boundary.

This keeps failures local. If the screen renderer fails, `#rntme-layout`
remains mounted and `#rntme-screen-error` appears in the screen region. If the
layout renderer fails, `#rntme-layout-error` appears and `#rntme-screen`
continues to render.

The fallback UI should be plain React DOM, not json-render, because json-render
itself may be the failing path. Use stable, testable DOM:

- `role="alert"`
- `data-rntme-error-scope`
- short generic copy like `This screen failed to render.`
- optional secondary text naming the scope and suggesting navigation/reload,
  without exposing exception details.

### 3. Reset on route/layout identity changes

React keeps class component state across re-renders, so a boundary that has
entered `hasError` must reset when the rendered artifact identity changes.

Recommended implementation:

- Extend `AppShellProps` with `screenKey` and `layoutKey`.
- In `entry.tsx`, pass `screenKey` from the matched route entry or screen name,
  and `layoutKey` from `routeEntry.layout`.
- Give the boundary a React `key` and/or implement `componentDidUpdate` to
  clear error state when `identity` changes.

Screen recovery semantics:

- navigating to another route resets the screen boundary and attempts to render
  that route;
- navigating back to the same broken screen shows the fallback again until the
  artifact/component is fixed;
- layout recovery happens when the route uses a different layout identity, or
  on full page reload if the same layout remains broken.

This is practical with the current `enterRoute` model and does not require a
new router abstraction.

### 4. Keep state exposure small and stable

Add `/runtime/renderErrors` as the runtime state surface for renderer crashes.
Shape:

```ts
type RenderErrorRecord = {
  scope: 'layout' | 'screen';
  identity: string;
  message: 'Renderer failed';
  errorName: string;
  componentStack?: string;
};
```

Store records under `/runtime/renderErrors/layout` and
`/runtime/renderErrors/screen`, replacing the prior record for that scope. This
matches the current state-store style and avoids growing an unbounded in-memory
log. The docs should call this an inspectability/debug surface, not a user
notification API.

### 5. Tests

Add focused `layout-manager.test.ts` cases in happy-dom:

- a throwing screen component renders `#rntme-screen-error`, keeps
  `#rntme-app`, and records `/runtime/renderErrors/screen`;
- a throwing layout component renders `#rntme-layout-error` while a simple
  screen component still renders;
- changing `screenKey` after a screen failure clears the fallback and renders
  the next screen.

If the key needs to come from `entry.tsx`, add one `entry.test.ts` assertion
that route navigation passes a changed screen identity to `AppShell`. Avoid a
browser smoke unless implementation changes visible styling enough that DOM
assertions are insufficient.

## Docs Touch

- Update `docs/current/owners/packages/runtime/ui-runtime.md`:
  - boot/resilience section: add renderer failure semantics;
  - state slots: document `/runtime/renderErrors`;
  - invariants/gotchas: note layout and screen renderer boundaries and route
    reset semantics;
  - where-to-look-first: update blank-screen debugging guidance.
- No local README stub change expected because command hints and current-doc
  links stay the same.
- No `docs/decision-system.md` change expected because this follows existing
  G2/G3/G5/F8 guidance.

## Alternatives Rejected

- **One boundary around all providers and content.** Rejected because a screen
  crash would still remove the layout and module operation context, making the
  failure less local.
- **Only a screen boundary.** Rejected because generated layouts can also
  render module components and crash.
- **Show `error.message` in the fallback.** Rejected because generated/runtime
  errors can accidentally include secrets, request fragments, or artifact
  internals. The UI should be safe by default.
- **Store a growing render-error history.** Rejected because the current
  package has no persistent client storage or telemetry backend, and an
  unbounded log can leak more context over time.
- **Catch errors in `enterRoute` only.** Rejected because the gap is React
  render-time exceptions inside `<Renderer>`, not only async screen/layout
  loading.

## Validation and Evidence

Required DEV gates:

- `pnpm -F @rntme/contracts-client-runtime-v1 build` if this fresh-worktree
  dependency has no `dist/`.
- `pnpm -F @rntme/ui-runtime test`
- `pnpm -F @rntme/ui-runtime build`
- Browser smoke only if the fallback styling or route recovery cannot be
  verified with DOM tests.
- `git diff --check`

SPEC evidence:

- Reviewed `AGENTS.md`, `docs/README.md`, `docs/decision-system.md`, the
  `@rntme/ui-runtime` README stub and owner doc, audit U-347, current
  `layout-manager.tsx`, `entry.tsx`, registry/state code, and current tests.
- Confirmed `layout-manager.tsx` renders layout and screen `<Renderer>` calls
  without an Error Boundary.
- Confirmed the current package test baseline passes after building the direct
  contract dependency in the fresh worktree:
  `pnpm -F @rntme/ui-runtime test` -> 9 files, 38 tests.
- Confirmed React Error Boundaries catch render errors through official React
  class lifecycle APIs and do not cover event handlers or async callbacks.

## Risks

- React may call `componentDidCatch` more than once in development behaviors.
  Tests should assert the final fallback/state, not exact console call counts
  unless console behavior is explicitly part of the contract.
- Component stacks can expose component names. That is useful for local
  inspectability but should remain out of visible UI and should be documented
  as a diagnostic state surface.
- If layout and screen both crash, two fallbacks can render on the page. That is
  acceptable and more informative than collapsing to one root-level failure.
- This does not catch errors thrown from event handlers inside rendered
  components. A later issue can define action/event failure reporting if needed.

## PLAN/DEV Handoff

Implementation should stay in the canonical workspace for RNT-498 and keep the
PR scoped to:

- `packages/runtime/ui-runtime/src/client/layout-manager.tsx`
- optional sibling boundary file under `packages/runtime/ui-runtime/src/client/`
- `packages/runtime/ui-runtime/src/client/entry.tsx` if route/layout identities
  need to be passed into `AppShell`
- focused tests under `packages/runtime/ui-runtime/test/unit/**`
- `docs/current/owners/packages/runtime/ui-runtime.md`

Recommended next stage: PLAN/DEV can implement directly from this spec. No
decision-system blocker is present.
