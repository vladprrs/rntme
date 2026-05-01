# Dependency Research: react + react-dom

Researched: 2026-04-28
Repository: /home/coder/work/rntme
Domain/ecosystem: npm/react-ui
Current version(s) in rntme: react ^18.3.0 (landing), react ^19.2.5 (ui-runtime); react-dom ^18.3.0 (landing), react-dom ^19.2.5 (ui-runtime); @types/react ^18.3.0–^18.3.3; @types/react-dom ^18.3.0
Latest stable version: react 19.2.5 / react-dom 19.2.5 (2026-04-08); @types/react 19.2.14 / @types/react-dom 19.2.3
Confidence: HIGH

## User Constraints
- Goal: understand current dependencies and migrate rntme to latest safe versions later.
- Output must be written to `docs/research/react-plus-react-dom/README.md`.
- Research-only: do not perform dependency upgrades or runtime code migrations in this issue.
- Look for better-suited libraries/solutions, not only latest version of the current choice.
- Use authoritative current sources: Context7 where applicable, official docs/changelog/releases, npm/GitHub/container registry, migration guides, security advisories.

## Summary

React 19 has been the stable major version since December 2024, with the latest patch 19.2.5 released in April 2026. rntme currently has a **version split**: the `@rntme/ui-runtime` package already upgraded to React 19 (19.2.5) while the landing app (`@rntme/landing`) and type definitions remain on React 18.3.x. The `@json-render/react` dependency (rntme's UI rendering engine) requires React ^19.2.3 as a peer dependency, which is the primary driver for the ui-runtime upgrade.

React 19 introduces Server Components, the `use` API, Actions, `useActionState`, `useOptimistic`, and improved hydration. However, rntme's current usage is limited to classic client-side SPA patterns (`createRoot`, `React.createElement`, basic hooks). The landing app uses minimal React (two small interactive components with `useState`/`useEffect`). For rntme's architecture — a declarative UI runtime compiled from JSON artifacts into a client-side SPA — React remains the standard choice. The main question is whether to unify on React 19 across all packages or keep the split.

Primary recommendation: **KEEP + UPGRADE** to React 19.2.5 across all packages, update @types/react to 19.2.14, and verify `@astrojs/react` compatibility for the landing app.

## Current Usage in rntme

| Package / image / tool | Current version | Used by | Source file(s) | Runtime/dev/build/test | Notes |
|---|---:|---|---|---|---|
| react | ^19.2.5 | @rntme/ui-runtime | `packages/ui-runtime/package.json` | prod | SPA runtime via `createRoot`, `React.createElement` |
| react-dom | ^19.2.5 | @rntme/ui-runtime | `packages/ui-runtime/package.json` | prod | Client-side hydration root |
| react | ^18.3.0 | @rntme/landing | `apps/landing/package.json` | prod | Astro island components (2 interactive components) |
| react-dom | ^18.3.0 | @rntme/landing | `apps/landing/package.json` | prod | Astro island hydration |
| @types/react | ^18.3.3 | @rntme/ui-runtime | `packages/ui-runtime/package.json` | dev | Type definitions (mismatched with runtime 19.2.5) |
| @types/react-dom | ^18.3.0 | @rntme/ui-runtime | `packages/ui-runtime/package.json` | dev | Type definitions (mismatched with runtime 19.2.5) |
| @types/react | ^18.3.0 | @rntme/landing | `apps/landing/package.json` | dev | Type definitions |
| @types/react-dom | ^18.3.0 | @rntme/landing | `apps/landing/package.json` | dev | Type definitions |
| @json-render/react | ^0.17.0 | @rntme/ui-runtime | `packages/ui-runtime/package.json` | prod | Peer dep: react ^19.2.3 |
| @astrojs/react | ^4.0.0 | @rntme/landing | `apps/landing/package.json` | dev | React integration for Astro; peer dep allows up to 19.0.0-beta |

Verified via:
```bash
grep -r "from ['\"]react['\"]" packages/ui-runtime/src apps/landing/src
cat packages/ui-runtime/package.json
cat apps/landing/package.json
npm view react version
npm view @types/react version
npm view @astrojs/react@4.0.0 peerDependencies
```

Usage patterns observed:
- **ui-runtime**: Client-side SPA boot via `createRoot` (`packages/ui-runtime/src/client/entry.tsx:124`), `React.createElement` for rendering JSON specs into DOM (`layout-manager.tsx`), no hooks used directly (rendering delegated to `@json-render/react`)
- **landing**: Two island components (`AhaReveal.tsx`, `SideRail.tsx`) using `useState`, `useEffect`, `useRef`; Astro static site with selective hydration

## Latest Versions / Release State

| Channel | Version | Release date | Source | Notes |
|---|---:|---|---|---|
| Stable (react) | 19.2.5 | 2026-04-08 | [npm](https://www.npmjs.com/package/react) | Latest stable |
| Stable (react-dom) | 19.2.5 | 2026-04-08 | [npm](https://www.npmjs.com/package/react-dom) | Synced with react |
| Stable (@types/react) | 19.2.14 | 2026-04-28 | [npm](https://www.npmjs.com/package/@types/react) | Type definitions for 19.x |
| Stable (@types/react-dom) | 19.2.3 | 2026-04-28 | [npm](https://www.npmjs.com/package/@types/react-dom) | Type definitions for 19.x |
| Prerelease (react) | 19.3.0-canary-* | Ongoing | [npm](https://www.npmjs.com/package/react?activeTab=versions) | Canary channel; not recommended for production |
| Legacy LTS (react) | 18.3.1 | 2024-12-19 | [npm](https://www.npmjs.com/package/react) | Final 18.x release; identical to 18.2 but with 19 migration warnings |

Version gap: ui-runtime is already on 19.2.5 (latest); landing is on 18.3.0 (one major behind). @types packages are one major behind across the board.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---|---:|---|---|
| react | 19.2.5 | UI component library | Industry standard for declarative UIs; rntme's JSON-to-UI pipeline targets React |
| react-dom | 19.2.5 | DOM renderer for React | Required companion to react for web rendering |
| @types/react | 19.2.14 | TypeScript definitions | Keeps types aligned with runtime version |
| @types/react-dom | 19.2.3 | TypeScript definitions | Keeps types aligned with runtime version |

### Supporting
| Library | Version | Purpose | When to Use |
|---|---:|---|---|
| @json-render/react | ^0.17.0 | JSON-to-React renderer | rntme's UI artifact rendering engine; requires React ^19.2.3 |
| @json-render/core | ^0.17.0 | State store and registry | Companion to @json-render/react |
| @json-render/shadcn | ^0.17.0 | shadcn/ui component catalog | Provides UI component primitives for rntme's declarative UI |
| @astrojs/react | ^4.0.0+ | Astro React integration | Landing app only; check for React 19 support in 4.x |

### Alternatives Considered
| Instead of | Could Use | Tradeoff | Recommendation for rntme |
|---|---|---|---|
| react | preact | 3kB vs 40kB bundle; compatible API | **Not recommended** — @json-render/react depends on React internals; Preact compat layer adds risk |
| react | solid | Fine-grained reactivity, no VDOM | **Not recommended** — would require rewriting @json-render/react and entire UI pipeline |
| react | svelte | Compiled away reactivity | **Not recommended** — Svelte is a compiler, not a runtime library; incompatible with rntme's JSON-render approach |
| react | vue | Mature ecosystem, progressive framework | **Not recommended** — @json-render is React-specific; migration would require new JSON-to-Vue compiler |
| react-dom | react-server (RSC) | Server Components, no hydration cost | **Not applicable** — rntme serves a static SPA bundle from Hono; SSR/RSC is out of scope per README.md |
| @json-render/react | custom JSON-to-DOM | Full control over output | **Not recommended** — @json-render handles component registry, state management, validation, and shadcn integration; hand-rolling would be expensive |

Installation / upgrade commands, if eventually recommended:
```bash
# ui-runtime (already on 19.2.5; upgrade types only)
pnpm add -D @types/react@^19.2.14 @types/react-dom@^19.2.3

# landing (upgrade React + types)
pnpm add react@^19.2.5 react-dom@^19.2.5
pnpm add -D @types/react@^19.2.14 @types/react-dom@^19.2.3

# If @astrojs/react@4.0.0 doesn't support React 19 stable, upgrade to @astrojs/react@latest first
pnpm add -D @astrojs/react@latest
```

## Architecture Patterns

### System Architecture Diagram
```mermaid
flowchart LR
  A[Blueprint: UI JSON artifact] -->|compile| B[@rntme/ui validator]
  B -->|emit| C[CompiledManifest + CompiledScreen]
  C -->|serve| D[Hono server /_manifest.json]
  E[Browser] -->|fetch| D
  E -->|hydrate| F[ui-runtime client bundle]
  F -->|createRoot| G[React DOM tree]
  G -->|render| H[@json-render/react Renderer]
  H -->|registry lookup| I[shadcn/ui components]
  H -->|state mgmt| J[@json-render/core StateStore]
  F -->|routing| K[Client-side router]
```

### Component Responsibilities
| Component | Responsibility | Implementation mapping | Notes |
|---|---|---|---|
| react | Component model, hooks API, JSX runtime | `packages/ui-runtime/src/client/entry.tsx`, `layout-manager.tsx` | Pure React.createElement usage; no JSX transform in runtime |
| react-dom/client | Root creation, hydration, rendering | `packages/ui-runtime/src/client/entry.tsx:124` | `createRoot(container)` → `root.render(...)` |
| @json-render/react | JSON spec → React element tree | `packages/ui-runtime/src/client/layout-manager.tsx:24-34` | `<Renderer spec={...} registry={...} />` |
| @json-render/core | State store, action dispatch, validation | `packages/ui-runtime/src/client/entry.tsx:54` | `createStateStore()`, subscribe for re-renders |
| ui-runtime router | Pattern matching, parameter extraction | `packages/ui-runtime/src/client/router.ts` | Simple regex-based routing; no React Router dependency |
| ui-runtime driver | HTTP fetch, action dispatch, navigation | `packages/ui-runtime/src/client/driver.ts` | Pure TS; no React dependency |

### Recommended Project Structure
```text
packages/ui-runtime/src/
├── client/
│   ├── entry.tsx          # SPA bootstrap: createRoot, hydrateApp
│   ├── layout-manager.tsx  # AppShell: layout + screen rendering
│   ├── router.ts           # Client-side route matching
│   ├── driver.ts           # HTTP binding executor
│   ├── registry.ts         # Component registry setup
│   └── screen-loader.ts    # Dynamic screen/layout loading
├── server/
│   ├── index.ts            # Hono sub-router for SPA serving
│   └── static-shell.ts     # HTML shell generation
└── build.ts                # esbuild SPA bundle compilation
```

### Pattern 1: createRoot + Manual Re-render
What: Create a single root, re-render on state changes via store subscription
When to use: rntme's current approach for declarative SPA; simple and predictable
Example:
```ts
// Source: packages/ui-runtime/src/client/entry.tsx
import { createRoot } from 'react-dom/client';

const root = createRoot(container);

function rerender() {
  root.render(
    React.createElement(AppShell, {
      layoutSpec: currentLayout?.spec ?? null,
      screenSpec: currentScreen?.spec ?? null,
      registry,
      actionHandlers,
      store,
    }),
  );
}

store.subscribe(() => rerender());
```

### Pattern 2: JSON Spec Rendering via @json-render
What: Render a declarative JSON UI spec through a component registry
When to use: rntme's core pattern — agent writes JSON, runtime renders it
Example:
```tsx
// Source: packages/ui-runtime/src/client/layout-manager.tsx
import { Renderer, StateProvider, ActionProvider } from '@json-render/react';

return React.createElement(
  StateProvider, { store },
  React.createElement(ActionProvider, { handlers: actionHandlers },
    React.createElement(Renderer, { spec: screenRendererSpec, registry })
  )
);
```

### Anti-Patterns to Avoid
- **String refs**: Removed in React 19; use callback refs or `useRef`
- **Legacy `ReactDOM.render`**: Use `createRoot` (already done in ui-runtime)
- **Direct DOM manipulation inside React components**: Use refs and effects; rntme's current code avoids this
- **Mixing React 18 and 19 in the same app**: Already a risk between landing and ui-runtime; unification recommended

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| JSON-to-React rendering | Custom element factory | `@json-render/react` | Handles component registry, state binding, validation, visibility conditions, and shadcn integration |
| Client-side state management | Custom useState tree | `@json-render/core` Store | Provides path-based state, subscription, and snapshot semantics aligned with rntme's UI artifact |
| SPA routing | Custom history API wrapper | ui-runtime router (current) | Simple pattern-matching router is sufficient for rntme's declarative routes; no need for React Router |
| Component catalog | Hand-rolled UI kit | `@json-render/shadcn` | shadcn/ui primitives maintained upstream; rntme consumes via registry |

Key insight: rntme's UI layer is intentionally thin — it compiles JSON artifacts into React elements via `@json-render`. The value is in the declarative authoring format and the validation pipeline, not in custom React components. Hand-rolling a JSON-to-React renderer would replicate hundreds of edge cases already solved by `@json-render`.

## Common Pitfalls

### Pitfall 1: Type Definition Mismatch
What goes wrong: `@types/react` 18.x with React 19 runtime causes type errors or missing type definitions for new APIs
Why it happens: React 19 introduced new hooks (`useActionState`, `useOptimistic`, `use`) and changed some type signatures (e.g., `ref` callback cleanup)
How to avoid: **Upgrade @types/react to 19.x** alongside React 19 runtime
Warning signs: TypeScript errors on `JSX.Element`, missing `use` type, ref callback types
Evidence: React 19 upgrade guide — "React 19 includes TypeScript changes... use `types-react-codemod`"

### Pitfall 2: @astrojs/react Peer Dependency Ceiling
What goes wrong: `@astrojs/react@4.0.0` peer deps cap at `^19.0.0-beta`; React 19.2.5 may not satisfy
Why it happens: Astro's React integration was released before React 19 GA
How to avoid: Upgrade `@astrojs/react` to latest 4.x or 5.x which supports React 19 stable
Warning signs: `pnpm install` peer dependency warnings; runtime errors in Astro islands
Evidence: `npm view @astrojs/react@4.0.0 peerDependencies` — caps at `^19.0.0-beta`

### Pitfall 3: React 19 Breaking Changes in Refs
What goes wrong: Ref callbacks now support cleanup functions; existing code with non-cleanup callbacks still works but type signatures changed
Why it happens: React 19 added ref cleanup pattern; TypeScript types reflect this
How to avoid: Run `types-react-codemod preset-19` to auto-fix type issues
Warning signs: Type errors on `ref` prop assignments in TypeScript
Evidence: [React 19 upgrade guide](https://react.dev/blog/2024/04/25/react-19-upgrade-guide)

### Pitfall 4: React 19 Hydration Changes
What goes wrong: Stricter hydration mismatch detection; third-party HTML inserted during SSR can cause warnings
Why it happens: React 19 improved hydration to be more resilient but also more vocal about mismatches
How to avoid: Ensure server-rendered HTML matches client render; rntme's SPA shell is static HTML so low risk
Warning signs: Console warnings about hydration mismatches
Evidence: React 19 release notes — "Improvements to hydration"

## Code Examples

### SPA Bootstrap (Current — Compatible with React 19)
```ts
// Source: packages/ui-runtime/src/client/entry.tsx
import { createRoot } from 'react-dom/client';
import * as React from 'react';

const container = document.querySelector('#root');
const root = createRoot(container!);

root.render(React.createElement(AppShell, { ...props }));
```

### State Store Subscription Pattern
```ts
// Source: packages/ui-runtime/src/client/entry.tsx
store.subscribe(() => rerender());

// Note: In React 19, this manual re-render pattern still works.
// For future optimization, could consider React's new use() API
// for reading external stores during render instead of subscribing.
```

### Layout + Screen Composition
```tsx
// Source: packages/ui-runtime/src/client/layout-manager.tsx
export function AppShell({ layoutSpec, screenSpec, registry, actionHandlers, store }: AppShellProps) {
  const content = React.createElement('div', { id: 'rntme-app' },
    layoutSpec ? React.createElement(Renderer, { spec: layoutSpec, registry }) : null,
    React.createElement(Renderer, { spec: screenSpec, registry }),
  );

  return React.createElement(
    StateProvider, { store },
    React.createElement(ActionProvider, { handlers: actionHandlers }, content)
  );
}
```

## State of the Art (2024-2026)

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| `ReactDOM.render` (legacy) | `createRoot` (React 18+) | 2022 | Concurrent features, better hydration |
| `useState` + manual fetch | `use` API + async Server Components | React 19 | Simpler data fetching, but requires RSC framework |
| `useReducer` for forms | `useActionState` | React 19 | Built-in form action state management |
| Manual optimistic UI | `useOptimistic` | React 19 | First-class optimistic updates |
| Class components | Functions + hooks | Ongoing | Class components still work but are legacy |
| Prop drilling | Context + `use` | React 19 | `use(Context)` readable during render |

New tools/patterns to consider:
- **React Compiler (React Forget)**: Automatic memoization without `useMemo`/`useCallback` — still in beta, not yet recommended for production
- **Server Components**: Out of scope for rntme's SPA architecture but worth monitoring
- **View Transitions API**: Native browser transitions; React 19 has experimental support

Deprecated/outdated:
- `ReactDOM.render` (legacy root API)
- String refs (`ref="input"`)
- `defaultProps` on function components
- `propTypes` (in TypeScript codebases)
- Legacy Context (`contextTypes`, `childContextTypes`)

## Migration Assessment

| Area | Finding | Impact | Risk | Evidence |
|---|---|---|---|---|
| **Runtime version gap** | ui-runtime on 19.2.5, landing on 18.3.0 | MEDIUM | LOW | `packages/ui-runtime/package.json`, `apps/landing/package.json` |
| **Type definition gap** | @types packages at 18.x while runtime is 19.x | MEDIUM | MEDIUM | Type mismatches, missing new API types |
| **Astro integration** | `@astrojs/react@4.0.0` peer deps cap at 19.0.0-beta | MEDIUM | MEDIUM | `npm view @astrojs/react@4.0.0 peerDependencies` |
| **Breaking changes** | React 19 removed string refs, legacy APIs | LOW | LOW | rntme code does not use deprecated APIs |
| **@json-render compatibility** | Peer dep requires React ^19.2.3 | LOW | LOW | Already satisfied by ui-runtime |
| **Bundle size** | React 19 ~40kB gzipped; no significant change from 18 | LOW | LOW | Official bundle size docs |
| **Security** | No CVEs in React 18.3 or 19.2.5 | LOW | LOW | npm audit, GitHub security advisories |

**Migration path/effort:**
1. Upgrade landing app: `react` → ^19.2.5, `react-dom` → ^19.2.5
2. Upgrade @types across both packages: `@types/react` → ^19.2.14, `@types/react-dom` → ^19.2.3
3. Upgrade `@astrojs/react` to latest 4.x/5.x with React 19 support
4. Run `types-react-codemod preset-19` on landing app source
5. Run `pnpm install` and typecheck
6. Run test suites for both packages
7. Manual smoke test of landing app islands and ui-runtime demo

**Test strategy:**
- Unit tests: `pnpm -F @rntme/ui-runtime test`, `pnpm -F @rntme/landing test`
- Typecheck: `pnpm -r run typecheck`
- Build: `pnpm -F @rntme/ui-runtime build`, `pnpm -F @rntme/landing build`
- E2E: Run demo app and verify UI renders correctly

**Compatibility:**
- Node.js: React 19 supports Node 18+ (rntme uses 20+)
- Browsers: React 19 drops IE11 support (already dropped in 18); modern browsers only
- @json-render/react: Already requires React 19; compatible

## Recommendation

**Decision: KEEP + UPGRADE** (unify on React 19.2.5)

Rationale:
- React is the de facto standard for declarative UIs and is deeply embedded in rntme's architecture through `@json-render/react`
- `@json-render/react` already requires React ^19.2.3, forcing ui-runtime to 19.x
- The version split between ui-runtime (19) and landing (18) is technical debt that should be resolved
- React 19 is stable, well-tested, and the upgrade from 18 is low-risk for rntme's usage patterns
- No alternatives (Preact, Solid, Vue) are viable without rewriting the entire JSON-to-UI pipeline
- No security issues in current versions; upgrade is for alignment and future-proofing, not urgency

**Follow-up tasks to create later:**
1. `[DEV]` Upgrade landing app (`@rntme/landing`) to React 19.2.5 and update @types
2. `[DEV]` Upgrade `@astrojs/react` to a version supporting React 19 stable
3. `[DEV]` Upgrade `@types/react` and `@types/react-dom` in `ui-runtime` to 19.x
4. `[DEV]` Run `types-react-codemod preset-19` on landing app and verify types
5. `[DEV]` Verify `@json-render/react` compatibility with React 19.2.5 (already using it, but formal verification)
6. `[PLAN]` Evaluate React Compiler (React Forget) for automatic memoization once it reaches stable
7. `[PLAN]` Monitor React Server Components evolution — may become relevant if rntme adds SSR in future

## Open Questions

1. **Should rntme adopt React 19's new hooks (`useActionState`, `useOptimistic`) in the UI runtime?**
   - What we know: React 19 provides first-class form action and optimistic update hooks
   - What's unclear: Whether `@json-render/react` will integrate these patterns; rntme's UI artifact format may need extension
   - Recommendation: Wait for `@json-render` ecosystem to adopt; rntme should follow, not lead, on UI framework patterns

2. **Is `@astrojs/react@4.x` sufficient for React 19 stable, or do we need 5.x?**
   - What we know: 4.0.0 peer deps cap at `^19.0.0-beta`
   - What's unclear: Whether newer 4.x patches or 5.x are required
   - Recommendation: Test `@astrojs/react@latest` (4.4.x or 5.x) with React 19.2.5 before upgrading landing app

3. **Should rntme consider React Compiler (React Forget) for the ui-runtime bundle?**
   - What we know: Compiler automatically memoizes components without `useMemo`/`useCallback`
   - What's unclear: Stability timeline; compatibility with `@json-render/react`'s dynamic component patterns
   - Recommendation: Monitor but do not adopt until stable; manual memoization is not currently a bottleneck in rntme's SPA

4. **What is the impact of React 19's stricter hydration on rntme's static shell?**
   - What we know: React 19 detects hydration mismatches more aggressively
   - What's unclear: Whether the static HTML shell served by `static-shell.ts` could trigger warnings
   - Recommendation: Low risk — shell is minimal and React root mounts into a clean container; test during upgrade

## Sources

### Primary (HIGH confidence)
- [reactjs/react.dev Context7](https://context7.com/reactjs/react.dev) — Official docs, React 19 features, migration guide
- [facebook/react Context7](https://context7.com/facebook/react) — Source code, API references
- [npm registry](https://www.npmjs.com/package/react) (queried via `npm view`) — Version metadata, publication dates
- [React 19 Upgrade Guide](https://react.dev/blog/2024/04/25/react-19-upgrade-guide) — Official breaking changes and codemods
- [React 19 Release Notes](https://react.dev/blog/2024/12/05/react-19) — New features: Actions, `use`, Server Components

### Secondary (MEDIUM confidence)
- `@json-render/react` peerDependencies (`npm view @json-render/react@0.17.0 peerDependencies`) — Confirms React 19 requirement
- `@astrojs/react` peerDependencies (`npm view @astrojs/react@4.0.0 peerDependencies`) — React 19 beta cap
- rntme codebase analysis (`packages/ui-runtime/src`, `apps/landing/src`) — Current usage patterns

### Tertiary (LOW confidence - needs validation)
- Astro React integration changelog — Specific version compatibility with React 19 stable
- `@json-render/react` internal compatibility with React 19.2.5 — Requires smoke testing

## Metadata

Research scope:
- Core technology: react + react-dom
- Ecosystem: @json-render/react, @astrojs/react, @types/react, shadcn/ui
- Patterns: Client-side SPA, JSON-to-React rendering, Astro islands, state store integration
- Pitfalls: Type mismatch, Astro peer deps, hydration, ref API changes

Confidence breakdown:
- Standard stack: **HIGH** — React is the undisputed standard for this use case
- Architecture: **HIGH** — Directly observable in rntme codebase
- Pitfalls: **MEDIUM** — React 19 changes are documented but rntme's light React usage means low exposure
- Code examples: **HIGH** — Verified against official docs and current codebase

Research date: 2026-04-28
Valid until: 2026-07-28 (recommend quarterly review; React 19 is stable with infrequent patch releases)
Ready for migration planning: **YES**
