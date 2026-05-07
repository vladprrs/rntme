> Status: historical.
> Date: 2026-04-16.
> Current source: docs/current/**, docs/decision-system.md, and current code/tests.
> Why retained: Historical rationale and execution context retained for review; it is not current-state truth by itself.

# UI Artifact v2 — Multi-screen Source Format, Compiler, and json-render Runtime

## Problem

The current UI artifact system (`packages/ui` + `packages/ui-runtime`) uses a monolithic `ui.json` that inlines all routes, layouts, and elements in one file. The issue-tracker demo has 4 routes and is already ~400 lines. Scaling to 50+ screens (full products like Jira/Linear) makes this format unmanageable.

Additionally, the runtime uses a custom 19-component renderer (`minimal-render.tsx`) instead of the canonical `@json-render/react` + `@json-render/shadcn` stack (60+ components), blocked by a zod@3/zod@4 incompatibility.

## Goals

- Source format that scales to 50+ screens without becoming unwieldy
- Reusable UI fragments (parameterized, compiled away)
- json-render Spec as the canonical element format (portable, validatable, tooling-compatible)
- Clean separation: visual layer (.spec.json) vs data/behavior layer (.screen.json)
- Pre-split runtime artifacts with lazy loading per route
- Full json-render/shadcn runtime replacing the custom renderer
- UI served from root `/`, API bindings under `/api`

## Decisions Log

| Question | Decision | Rationale |
|----------|----------|-----------|
| Scale target | 50+ screens (B) | Full product scope |
| Element format | json-render canonical Spec | Portable, standard tooling |
| File structure | Sidecar: .spec.json + .screen.json | Clean separation of concerns |
| Data contract | Explicit mapping (A) with compiler-inferred shape validation | Simple format, compiler does the heavy lifting |
| Reuse model | Parameterized fragments with $ref/$param (B) | A is subset of B; $param compiled away, output is canonical json-render |
| Layouts | Separate entity, same json-render format (B) | Runtime lifecycle differs from fragments (persistent state across routes) |
| Compiled output | Pre-split artifact, lazy loading (B) | Avoids heavy initial load at 50+ screens |
| Runtime renderer | json-render/react + shadcn, replacing minimal-render.tsx (A) | Part of this design, not deferred |
| Migration strategy | Big bang (1) | Deep alpha, no clients, one demo — clean start over incremental compromise |
| Package naming | New packages take canonical names; old renamed to -legacy | packages/ui and packages/ui-runtime are the new ones |
| URL structure | UI at root `/`, bindings at `/api` | Cleaner than `/ui` prefix |

---

## 1. Source Format

### File Structure

```
app/
  manifest.json
  layouts/
    main.spec.json
    main.screen.json
  screens/
    issues-home.spec.json
    issues-home.screen.json
    issues-browse.spec.json
    issues-browse.screen.json
    issue-detail.spec.json
    issue-detail.screen.json
  fragments/
    issue-card.spec.json
    status-badge.spec.json
```

### manifest.json

Root file describing application structure. Minimal — routes, layout bindings, artifact references.

```json
{
  "version": "2.0",
  "pdmRef": "issue-tracker.domain.v1",
  "qsmRef": "issue-tracker.read.v1",
  "graphSpecRef": "issue-tracker.graphs.v1",
  "bindingsRef": "issue-tracker.bindings.v1",
  "metadata": {
    "title": "Issue Tracker"
  },
  "layouts": {
    "main": "layouts/main"
  },
  "routes": {
    "/issues": {
      "layout": "main",
      "screen": "screens/issues-home"
    },
    "/issues/browse": {
      "layout": "main",
      "screen": "screens/issues-browse"
    },
    "/issues/:id": {
      "layout": "main",
      "screen": "screens/issue-detail"
    }
  }
}
```

Routes and layouts reference base names (no extension). The compiler locates the `.spec.json` + `.screen.json` pair by base name.

### *.spec.json — Canonical json-render Spec

Pure json-render format. Validatable via `catalog.validate()`, renderable with `<Renderer>` and mock state, compatible with any json-render tooling.

```json
{
  "root": "page",
  "elements": {
    "page": {
      "type": "Stack",
      "props": { "direction": "vertical", "gap": 4 },
      "children": ["title", "table"]
    },
    "title": {
      "type": "Heading",
      "props": { "level": 2, "text": "All Issues" }
    },
    "table": {
      "type": "Table",
      "props": {
        "rows": { "$state": "/data/issues" },
        "columns": ["id", "title", "status"]
      }
    }
  }
}
```

### *.screen.json — Data Fetching, Actions, Metadata

Everything json-render doesn't cover: HTTP data sources, application actions, route metadata.

```json
{
  "metadata": { "title": "Browse Issues" },
  "data": {
    "/data/issues": {
      "binding": "listIssuesUi",
      "params": { "limit": 50 },
      "refetchOn": ["mount"]
    }
  },
  "actions": {
    "openIssue": {
      "kind": "navigation",
      "navigateTo": "/issues/:id",
      "paramsFromState": { "id": "/form/openId" }
    },
    "reportIssue": {
      "kind": "command",
      "binding": "reportIssue",
      "paramsFromState": { "title": "/form/title" },
      "onSuccess": { "navigateTo": "/issues/browse" }
    }
  }
}
```

Contract between .spec.json and .screen.json: the `data` section maps state paths to bindings. The compiler verifies that every `$state` path used in the Spec is covered (either by a data binding in .screen.json, by form input paths `/form/*`, by route params `/route/params/*`, or by action status paths `/actions/*/\__status`). Shape compatibility is inferred from the json-render catalog (component prop types) and the bindings artifact (binding output shapes) — no manual type annotations needed.

### Parameterized Fragments

Fragment definition — a json-render Spec using `$param` for parameterized values:

```json
{
  "root": "card",
  "elements": {
    "card": {
      "type": "Card",
      "props": {
        "title": { "$param": "title" },
        "description": { "$param": "description" }
      },
      "children": ["badge"]
    },
    "badge": {
      "type": "Badge",
      "props": { "text": { "$param": "status" } }
    }
  }
}
```

Usage in a screen's .spec.json — the `$ref` element sits inside the `elements` map alongside regular elements. The parent references it by key in `children` like any other element:

```json
{
  "root": "page",
  "elements": {
    "page": {
      "type": "Stack",
      "props": { "direction": "vertical", "gap": 4 },
      "children": ["heading", "issue-card"]
    },
    "heading": {
      "type": "Heading",
      "props": { "level": 2, "text": "Issue Detail" }
    },
    "issue-card": {
      "$ref": "fragments/issue-card",
      "bind": {
        "title": { "$state": "/data/issue/title" },
        "description": { "$state": "/data/issue/description" },
        "status": { "$state": "/data/issue/status" }
      }
    }
  }
}
```

A `$ref` element replaces the normal `{ type, props, children }` shape. The compiler expands it into the fragment's elements (prefixed as `issueCard__card`, `issueCard__badge`) and rewires the parent's `children` to point at the fragment's root.

The compiler substitutes `$param` with values from `bind`, generates unique element IDs (prefixed by usage site, e.g., `issueCard__card`, `issueCard__badge`), and inlines elements into the parent Spec. The compiled output contains no trace of `$ref` or `$param` — it is a canonical json-render Spec.

Fragments can reference other fragments. The compiler resolves recursively and detects cycles.

### Layouts

Layouts use the same json-render Spec format with `Slot` elements:

```json
{
  "root": "shell",
  "elements": {
    "shell": {
      "type": "Stack",
      "props": { "direction": "vertical", "gap": 4 },
      "children": ["header", "slot-main"]
    },
    "header": {
      "type": "Heading",
      "props": { "level": 1, "text": "Issue Tracker" }
    },
    "slot-main": {
      "type": "Slot",
      "props": { "name": "main" }
    }
  }
}
```

Layouts are authored like fragments but treated differently by the compiler and runtime:
- Not inlined — preserved as separate entities in the compiled output
- Runtime mounts them persistently across route transitions
- Layout state (sidebar open/closed, user profile in header) survives navigation
- Layout data (from .screen.json) is fetched once, not on every route change

---

## 2. Compiler Pipeline

### Overview

```
Source files (manifest + specs + screens + fragments)
  → Phase 1: Resolve
  → Phase 2: Expand
  → Phase 3: Validate
  → Phase 4: HTTP Map
  → Phase 5: Emit
Runtime artifact (pre-split)
```

### Phase 1: Resolve

Reads `manifest.json`, locates all referenced files. Verifies that every route/layout has a `.spec.json` + `.screen.json` pair. Resolves `$ref` paths recursively. Detects circular fragment references.

### Phase 2: Expand

Inlines fragments into screen specs:
- For each `$ref` element: load fragment, substitute `$param` → values from `bind`
- Generate unique element IDs (prefix by usage site)
- Insert elements into parent Spec's `elements` map
- Replace the `$ref` element with the fragment's root element
- Output: every screen is a clean json-render Spec with no `$ref` or `$param`

### Phase 3: Validate

Four-layer validation (adapted from current `packages/ui` logic):

1. **Parse** — each expanded Spec validated via json-render `catalog.validate()`. Each .screen.json validated against ScreenDescriptor schema.
2. **Structural** — element tree correctness, Slot elements only in layouts, children references valid, no orphans.
3. **References** — all bindings referenced in .screen.json exist in the bindings artifact. Binding kinds match usage (data=query, action=command). All `$state` paths in Spec are covered by data bindings, form inputs, route params, or action status paths.
4. **Consistency** — shape matching: binding output shapes (from bindings artifact) are compatible with how `$state` paths are consumed by components (inferred from json-render catalog prop types).

### Phase 4: HTTP Map

Converts binding names from .screen.json into resolved HTTP endpoint info (method + path) using the bindings artifact. The compiled screen contains ready-to-call HTTP details — the runtime doesn't need the bindings artifact.

### Phase 5: Emit

Generates pre-split runtime artifact:

```
dist/
  _manifest.json
  _layouts/
    main.json
  _screens/
    issues-home.json
    issues-browse.json
    issue-detail.json
```

---

## 3. Compiled Output Format

### _manifest.json

```json
{
  "version": "2.0",
  "metadata": { "title": "Issue Tracker" },
  "routes": {
    "/issues": { "layout": "main", "screen": "issues-home" },
    "/issues/browse": { "layout": "main", "screen": "issues-browse" },
    "/issues/:id": { "layout": "main", "screen": "issue-detail" }
  }
}
```

### _screens/*.json

```json
{
  "spec": {
    "root": "page",
    "elements": { ... }
  },
  "data": {
    "/data/issues": {
      "method": "GET",
      "path": "/api/issues",
      "params": { "limit": 50 },
      "refetchOn": ["mount"]
    }
  },
  "actions": {
    "openIssue": {
      "kind": "navigation",
      "navigateTo": "/issues/:id",
      "paramsFromState": { "id": "/form/openId" }
    }
  }
}
```

`spec` is a canonical json-render Spec (fragments inlined). `data` contains resolved HTTP endpoints (not binding names). The runtime needs no knowledge of the bindings artifact.

### _layouts/*.json

Same structure as screens — a `spec` with Slot elements, optionally `data` for layout-level fetching.

---

## 4. Runtime Architecture

### Server (Hono)

```
GET /                        ← HTML shell
GET /_manifest.json          ← compiled manifest
GET /_layouts/:name.json     ← compiled layout
GET /_screens/:name.json     ← compiled screen
GET /assets/*                ← static JS/CSS
GET /*                       ← SPA fallback

GET  /api/...                ← query bindings
POST /api/...                ← command bindings
```

`createApp(options)` returns a Hono app that serves the compiled artifact and static assets. API bindings are mounted separately by the consumer under `/api`.

### Client

**entry.tsx** — Fetches `_manifest.json`, initializes app, renders initial route.

**screen-loader.ts** — Lazy loading and caching of screen/layout JSON. Fetches `_screens/:name.json` on demand, caches in memory.

**layout-manager.ts** — Mounts layout, preserves it across route transitions, injects screen Spec into the layout's Slot. Manages layout-level state and data.

**router.ts** — Client-side routing. Matches URL path against manifest routes (exact match and `:param` templates). Triggers screen loading on navigation.

**driver.ts** — HTTP data fetching (GET/POST to `/api/*` using resolved endpoints from compiled screen). Action dispatch (navigation and command execution). On success: navigate, refetch data, clear form state. On error: surface to UI.

**registry.ts** — json-render registry with `@json-render/shadcn` catalog. Registers custom actions: `setState`, `navigate`, `submitCommand`. This is the bridge between json-render's action system and the driver.

### Rendering

```tsx
<Renderer spec={screenSpec} registry={registry} />
```

From `@json-render/react`. No custom renderer. The full shadcn component catalog (60+ components) is available out of the box.

### What json-render Provides (replacing custom code)

| Current custom code | Replaced by |
|---|---|
| `minimal-render.tsx` (19 components) | `@json-render/react` `<Renderer>` + `@json-render/shadcn` catalog (60+ components) |
| `state-store.ts` | json-render `StateProvider` |
| `handlers.ts` | json-render `on` / action system |

### What Remains Custom

| Module | Why |
|---|---|
| `router.ts` | json-render has no routing concept |
| `driver.ts` | HTTP data fetching is app-specific |
| `layout-manager.ts` | Layout persistence across routes is app-specific |
| `screen-loader.ts` | Lazy loading of pre-split artifacts is app-specific |

---

## 5. zod@4 Migration

`@json-render/core@0.17` requires zod@4 as a peer dependency. This is a workspace-wide migration affecting:

- `packages/ui` (new) — uses zod@4 from the start
- `packages/ui-runtime` (new) — uses zod@4 from the start
- `packages/ui-legacy` (renamed current) — no changes needed
- `packages/ui-runtime-legacy` (renamed current) — no changes needed
- Other workspace packages with Zod dependencies (`packages/bindings`, `packages/graph-ir-compiler`, etc.) — migrated to zod@4

---

## 6. Scope

### In Scope

1. New source format (manifest + .spec.json/.screen.json + parameterized fragments)
2. Compiler (`packages/ui`) — resolve, expand, validate, http-map, emit
3. New runtime (`packages/ui-runtime`) — json-render/react + shadcn, lazy screen loading, layout manager, router, driver
4. zod@4 workspace-wide migration
5. UI at root `/`, API bindings at `/api`
6. Demo migration — issue-tracker rewritten to new source format
7. Rename current packages to -legacy

### Out of Scope

- Custom catalog components beyond what json-render/shadcn provides
- Visual editor / drag-and-drop
- SSR / streaming render
- Auth, RBAC, role-based visibility
- Deletion of legacy packages (done after validation)
