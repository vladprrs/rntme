# Demo Issue Tracker → UI v2 + json-render/shadcn Migration

## Problem

The demo/issue-tracker-api has v2 source format files (`artifacts/ui/`) and the compiler + runtime scaffold are in place, but the SPA client doesn't actually render — `registry.ts` is a stub, `entry.tsx` dumps specs as `<pre>JSON</pre>`, and the layout manager doesn't compose layout + screen properly. Additionally, the source specs use custom component types (`Form`, `FormField`, `Table` with object rows) instead of native json-render/shadcn components, and only 4 screens exist despite 14 available bindings.

## Goals

- Working end-to-end v2 runtime using native json-render/react + shadcn catalog (zero custom components)
- Source specs rewritten to use shadcn components and json-render data binding natively
- 6 screens covering all available bindings (up from 4)
- Parameterized fragments exercising the compiler's $ref/$param system
- Layout with persistent navigation bar

## Decisions Log

| Question | Decision | Rationale |
|----------|----------|-----------|
| Renderer | json-render/react `<Renderer>` + shadcn catalog | Spec mandate; replaces minimal-render.tsx |
| Custom components | Zero — all shadcn native | Maximize json-render native usage |
| Data lists | `repeat` + `Card` + `Badge` | Native json-render pattern; shadcn Table is static 2D strings only |
| Forms | `Input` with `$bindState` | Native json-render two-way binding; no Form/FormField wrapper needed |
| Layout composition | Two `<Renderer>` instances (layout + screen) | No custom Slot component needed |
| Navigation actions | Native `navigate` action in spec | Eliminates navigation entries in screen.json |
| Command actions | `dispatch` action + screen.json definitions | Screen.json maps names to HTTP endpoints |
| Fragments | 2 fragments (command-button, command-with-input) | Exercises $ref/$param without artificial complexity |

---

## 1. Runtime: json-render Integration (packages/ui-runtime)

### 1.1 New Dependencies

```json
{
  "dependencies": {
    "@json-render/core": "^0.17.0",
    "@json-render/react": "^0.17.0",
    "@json-render/shadcn": "^0.17.0",
    "tailwindcss": "^4.0.0"
  }
}
```

### 1.2 Registry (registry.ts)

Two registered actions bridge json-render's action system to the rntme driver:

```typescript
import { defineCatalog } from '@json-render/core';
import { schema, defineRegistry } from '@json-render/react';
import { shadcnComponentDefinitions, shadcnComponents } from '@json-render/shadcn';

const catalog = defineCatalog(schema, {
  components: shadcnComponentDefinitions,
  actions: {
    navigate: {
      params: z.object({ to: z.string() }).passthrough(),
      description: 'Client-side navigation. :param placeholders in `to` are replaced from remaining params.',
    },
    dispatch: {
      params: z.object({ name: z.string() }),
      description: 'Execute a screen-defined action by name (command, refetch, or navigation).',
    },
  },
});

const { registry, handlers } = defineRegistry(catalog, {
  components: shadcnComponents,
  actions: {
    navigate: async (params) => {
      let target = params.to as string;
      for (const [k, v] of Object.entries(params)) {
        if (k !== 'to') target = target.replace(`:${k}`, String(v));
      }
      onNavigate(target);
    },
    dispatch: async (params, setState, state) => {
      const action = currentScreen.actions[params.name as string];
      if (!action) return;
      if (action.kind === 'command') {
        // resolve paramsFromState, HTTP POST, handle onSuccess/onError
      } else if (action.kind === 'refetch') {
        // re-fetch data endpoints listed in action.targets
      }
    },
  },
});
```

| Action | Params | Behavior |
|--------|--------|----------|
| `navigate` | `{ to: string, ...substitutions }` | Replace `:param` in `to` with values from remaining params, push history, load screen |
| `dispatch` | `{ name: string }` | Look up compiled screen action, execute based on kind: command → POST, refetch → GET, handle onSuccess |

Built-in json-render `setState` is available for free via `$bindState` — no registration needed.

### 1.3 State Management

json-render supports external state stores via `<StateProvider store={store}>`. The rntme driver writes fetched data into the store; the Renderer reads it via `$state` / `$bindState` / `$item` expressions.

```typescript
// StateStore interface (json-render compatible)
interface StateStore {
  get(path: string): unknown;
  set(path: string, value: unknown): void;
  update(updates: Record<string, unknown>): void;
  getSnapshot(): Record<string, unknown>;
  subscribe(listener: () => void): () => void;
}
```

The driver's `enterScreen()` fetches all data endpoints and writes results into the store at the specified state paths. `$state` params in data endpoint definitions (e.g., route params) are resolved from the store at fetch time.

### 1.4 Entry + Layout Manager (entry.tsx)

The app renders layout and screen as two separate `<Renderer>` instances — no Slot component needed. The layout manager wraps them:

```tsx
function App({ layoutSpec, screenSpec, registry, actionHandlers }) {
  return (
    <StateProvider store={store}>
      <ActionProvider handlers={actionHandlers}>
        <VisibilityProvider>
          <div id="rntme-app">
            <div id="rntme-layout">
              <Renderer spec={layoutSpec} registry={registry} />
            </div>
            <div id="rntme-screen">
              <Renderer spec={screenSpec} registry={registry} />
            </div>
          </div>
        </VisibilityProvider>
      </ActionProvider>
    </StateProvider>
  );
}
```

Lifecycle:
1. Fetch `/_manifest.json`
2. Create state store, registry, action handlers
3. Match current URL to route
4. Load layout + screen JSON
5. Driver `enterScreen()` — fetch data, populate store
6. Render App with layout spec + screen spec
7. On navigation: load new screen, re-enter, re-render (layout preserved if same)

### 1.5 Driver (driver.ts)

Updated responsibilities:

- **`enterScreen(screen)`** — iterate `screen.data`, resolve `$state` params from store, fetch each endpoint, write result to store at the data path
- **`navigate` action handler** — push history state, match route, load screen, enter screen
- **`dispatch` action handler** — look up `screen.actions[name]`:
  - `kind: "command"` → resolve `paramsFromState` from store, HTTP POST to compiled endpoint, on success: refetch specified data / navigate
  - `kind: "refetch"` → re-fetch data endpoints listed in `targets` with current store state
- **`refetchData(targets)`** — re-run `enterScreen` logic for specific data paths

### 1.6 Build (build.ts)

Update esbuild config:
- Add Tailwind CSS 4 processing (PostCSS plugin or `@tailwindcss/cli`)
- Generate `main.css` with shadcn component styles
- Keep ESM bundle format

---

## 2. Source Format: Native json-render/shadcn Components

### 2.1 Component Mapping

All source specs use shadcn component names and props natively:

| Old (custom) | New (shadcn native) | Notes |
|---|---|---|
| `Form` wrapper | Removed | `$bindState` works directly, no wrapper needed |
| `FormField` | `Input` | `value: { "$bindState": "/form/field" }`, `label`, `name`, `type` |
| `Table` with `rows: { "$state" }` | `repeat` + `Card` + `Badge` | json-render native list rendering |
| `Slot` | Removed | Runtime composes layout + screen as two Renderers |
| `Stack` gap `4` (number) | gap `"lg"` (named) | shadcn uses `"none" \| "sm" \| "md" \| "lg" \| "xl"` |
| `watch: { click: ... }` (v1) | `on: { press: ... }` (v2) | Already migrated |

### 2.2 Action Pattern in Specs

Navigation — directly in spec via native `navigate` action:
```json
{
  "type": "Button",
  "props": { "label": "Browse issues" },
  "on": { "press": { "action": "navigate", "params": { "to": "/issues/browse" } } }
}
```

Navigation with params (e.g., from repeat item):
```json
{
  "type": "Card",
  "props": { "title": { "$item": "title" } },
  "on": {
    "press": {
      "action": "navigate",
      "params": { "to": "/issues/:id", "id": { "$item": "id" } }
    }
  }
}
```

Commands — via `dispatch` action referencing screen.json:
```json
{
  "type": "Button",
  "props": { "label": "Submit", "variant": "primary" },
  "on": { "press": { "action": "dispatch", "params": { "name": "cmdSubmit" } } }
}
```

### 2.3 Data List Pattern

All data lists use `repeat` over a state path, rendering each item as a `Card` with `Badge` metadata:

```json
{
  "issues-list": {
    "type": "Stack",
    "props": { "direction": "vertical", "gap": "sm" },
    "children": ["issue-card"],
    "repeat": { "statePath": "/data/issues" }
  },
  "issue-card": {
    "type": "Card",
    "props": { "title": { "$item": "title" } },
    "children": ["card-meta", "card-link"]
  },
  "card-meta": {
    "type": "Stack",
    "props": { "direction": "horizontal", "gap": "sm" },
    "children": ["badge-status", "badge-priority"]
  },
  "badge-status": {
    "type": "Badge",
    "props": { "text": { "$item": "status" } }
  },
  "badge-priority": {
    "type": "Badge",
    "props": { "text": { "$item": "priority" }, "variant": "secondary" }
  },
  "card-link": {
    "type": "Link",
    "props": { "label": "View →" },
    "on": {
      "press": {
        "action": "navigate",
        "params": { "to": "/issues/:id", "id": { "$item": "id" } }
      }
    }
  }
}
```

Note: shadcn `Card` does not emit `press` events. Navigation from list items uses a `Link` inside the Card's children instead.

### 2.4 Form Input Pattern

All form inputs use `Input` with `$bindState` for two-way binding:

```json
{
  "field-title": {
    "type": "Input",
    "props": {
      "label": "Title",
      "name": "title",
      "value": { "$bindState": "/form/title" }
    }
  }
}
```

For number fields, use `type: "number"`:
```json
{
  "field-issueId": {
    "type": "Input",
    "props": {
      "label": "Issue ID",
      "name": "issueId",
      "type": "number",
      "value": { "$bindState": "/form/issueId" }
    }
  }
}
```

---

## 3. Layout with Navigation

### layouts/main.spec.json

Heading + horizontal nav row with 4 buttons. No Slot — runtime composes layout + screen separately.

```json
{
  "root": "shell",
  "elements": {
    "shell": {
      "type": "Stack",
      "props": { "direction": "vertical", "gap": "lg" },
      "children": ["header", "nav"]
    },
    "header": {
      "type": "Heading",
      "props": { "level": 1, "text": "Issue Tracker" }
    },
    "nav": {
      "type": "Stack",
      "props": { "direction": "horizontal", "gap": "sm" },
      "children": ["nav-home", "nav-browse", "nav-new", "nav-search"]
    },
    "nav-home": {
      "type": "Button",
      "props": { "label": "Home", "variant": "secondary" },
      "on": { "press": { "action": "navigate", "params": { "to": "/issues" } } }
    },
    "nav-browse": {
      "type": "Button",
      "props": { "label": "Browse", "variant": "secondary" },
      "on": { "press": { "action": "navigate", "params": { "to": "/issues/browse" } } }
    },
    "nav-new": {
      "type": "Button",
      "props": { "label": "New Issue", "variant": "secondary" },
      "on": { "press": { "action": "navigate", "params": { "to": "/issues/new" } } }
    },
    "nav-search": {
      "type": "Button",
      "props": { "label": "Search", "variant": "secondary" },
      "on": { "press": { "action": "navigate", "params": { "to": "/issues/search" } } }
    }
  }
}
```

### layouts/main.screen.json

```json
{}
```

Navigation is handled by the native `navigate` action directly in the spec — no screen.json entries needed.

---

## 4. Screens

### 4.1 issues-home (`/issues`)

Dashboard showing per-project stats and quick links.

**issues-home.spec.json:**
- Heading "Issues by Project"
- `repeat` over `/data/stats` → Card per project with `$item` fields: `projectKey` (title), `issueCount` + `totalStoryPoints` (Badge children)
- Button "Sprint Burndown" → navigate to `/sprints/1` (seeded sprint ID)

**issues-home.screen.json:**
```json
{
  "metadata": { "title": "Home" },
  "data": {
    "/data/stats": {
      "binding": "issuesByProject",
      "refetchOn": ["mount"]
    }
  }
}
```

No actions section — all navigation is native `navigate` in spec.

### 4.2 issues-browse (`/issues/browse`)

Issue list with click-to-detail.

**issues-browse.spec.json:**
- Heading "Recent Issues"
- `repeat` over `/data/issues` → Card per issue with title (`$item: "title"`), Badge for status and priority, Link "View →" inside Card → `navigate` to `/issues/:id` with `id: { "$item": "id" }`

**issues-browse.screen.json:**
```json
{
  "metadata": { "title": "Browse" },
  "data": {
    "/data/issues": {
      "binding": "listIssuesUi",
      "params": { "limit": 50 },
      "refetchOn": ["mount"]
    }
  }
}
```

### 4.3 issues-new (`/issues/new`)

Report a new issue form.

**issues-new.spec.json:**
- Heading "Report a New Issue"
- Input fields with `$bindState`: issueId (number), title (text), projectId (number), reporterId (number), priority (text), storyPoints (number)
- Button "Submit" → `dispatch` action `"submit"`

**issues-new.screen.json:**
```json
{
  "metadata": { "title": "Report Issue" },
  "actions": {
    "submit": {
      "kind": "command",
      "binding": "reportIssue",
      "paramsFromState": {
        "issueId": "/form/issueId",
        "title": "/form/title",
        "projectId": "/form/projectId",
        "reporterId": "/form/reporterId",
        "priority": "/form/priority",
        "storyPoints": "/form/storyPoints"
      },
      "onSuccess": { "navigateTo": "/issues/browse" },
      "onError": { "showAlert": true }
    }
  }
}
```

### 4.4 issues-search (`/issues/search`) — NEW

Search issues by title, date range, and priority.

**issues-search.spec.json:**
- Heading "Search Issues"
- Input fields with `$bindState`: query (text, required), from date (text), to date (text), priority (text), limit (number)
- Button "Search" → `dispatch` action `"search"`
- `repeat` over `/data/results` → Card per result with title, Badge for status and priority

**issues-search.screen.json:**
```json
{
  "metadata": { "title": "Search" },
  "data": {
    "/data/results": {
      "binding": "searchIssues",
      "params": {
        "q": { "$state": "/form/q" },
        "from": { "$state": "/form/from" },
        "to": { "$state": "/form/to" },
        "priority": { "$state": "/form/priority" },
        "limit": { "$state": "/form/limit" }
      }
    }
  },
  "actions": {
    "search": {
      "kind": "refetch",
      "targets": ["/data/results"]
    }
  }
}
```

Note: `refetchOn: ["mount"]` is deliberately omitted — search results are fetched only when the user clicks "Search" (dispatch → refetch).

### 4.5 issue-detail (`/issues/:id`) — ENHANCED

Full lifecycle management. Uses fragments for action buttons.

**issue-detail.spec.json:**
- Heading "Issue"
- `repeat` over `/data/detail` (single-item array) → Card with title (`$item: "title"`), children showing all detail fields as Badges/Text
- Text "Lifecycle: submit → assign → reassign → resolve → reopen / close"
- Fragment `$ref` usages (6 total):
  - `command-button` × 3: Submit (draft→open), Close (resolved→closed), Reopen (resolved→open)
  - `command-with-input` × 3: Assign (assigneeId), Reassign (assigneeId), Resolve (resolvedAt)

**issue-detail.screen.json:**
```json
{
  "metadata": { "title": "Issue Detail" },
  "data": {
    "/data/detail": {
      "binding": "issueDetail",
      "params": { "id": { "$state": "/route/params/id" } },
      "refetchOn": ["mount"]
    }
  },
  "actions": {
    "cmdSubmit": {
      "kind": "command",
      "binding": "submitIssue",
      "paramsFromState": { "issueId": "/route/params/id" },
      "onSuccess": { "refetchData": ["/data/detail"] },
      "onError": { "showAlert": true }
    },
    "cmdAssign": {
      "kind": "command",
      "binding": "assignIssue",
      "paramsFromState": { "issueId": "/route/params/id", "assigneeId": "/form/assigneeId" },
      "onSuccess": { "refetchData": ["/data/detail"] },
      "onError": { "showAlert": true }
    },
    "cmdReassign": {
      "kind": "command",
      "binding": "reassignIssue",
      "paramsFromState": { "issueId": "/route/params/id", "assigneeId": "/form/assigneeId" },
      "onSuccess": { "refetchData": ["/data/detail"] },
      "onError": { "showAlert": true }
    },
    "cmdResolve": {
      "kind": "command",
      "binding": "resolveIssue",
      "paramsFromState": { "issueId": "/route/params/id", "resolvedAt": "/form/resolvedAt" },
      "onSuccess": { "refetchData": ["/data/detail"] },
      "onError": { "showAlert": true }
    },
    "cmdReopen": {
      "kind": "command",
      "binding": "reopenIssue",
      "paramsFromState": { "issueId": "/route/params/id" },
      "onSuccess": { "refetchData": ["/data/detail"] },
      "onError": { "showAlert": true }
    },
    "cmdClose": {
      "kind": "command",
      "binding": "closeIssue",
      "paramsFromState": { "issueId": "/route/params/id" },
      "onSuccess": { "refetchData": ["/data/detail"] },
      "onError": { "showAlert": true }
    }
  }
}
```

### 4.6 sprint-burndown (`/sprints/:sprintId`) — NEW

Sprint burndown showing open work grouped by status.

**sprint-burndown.spec.json:**
- Heading "Sprint Burndown"
- `repeat` over `/data/burndown` → Card per status group with `$item` fields: `status` (title), `issueCount` + `totalStoryPoints` (Badge children)
- Button "Back to Home" → navigate to `/issues`

**sprint-burndown.screen.json:**
```json
{
  "metadata": { "title": "Sprint Burndown" },
  "data": {
    "/data/burndown": {
      "binding": "sprintBurndown",
      "params": { "sprintId": { "$state": "/route/params/sprintId" } },
      "refetchOn": ["mount"]
    }
  }
}
```

---

## 5. Fragments

### 5.1 fragments/command-button.spec.json

Button-only fragment for commands without form input. Used for: submit, close, reopen.

```json
{
  "root": "btn",
  "elements": {
    "btn": {
      "type": "Button",
      "props": {
        "label": { "$param": "label" },
        "variant": { "$param": "variant" }
      },
      "on": {
        "press": {
          "action": "dispatch",
          "params": { "name": { "$param": "actionName" } }
        }
      }
    }
  }
}
```

Usage in issue-detail.spec.json:
```json
{
  "action-submit": {
    "$ref": "fragments/command-button",
    "bind": {
      "label": "Submit (draft → open)",
      "variant": "secondary",
      "actionName": "cmdSubmit"
    }
  }
}
```

### 5.2 fragments/command-with-input.spec.json

Input + Button fragment for commands with a form parameter. Used for: assign, reassign, resolve.

```json
{
  "root": "row",
  "elements": {
    "row": {
      "type": "Stack",
      "props": { "direction": "horizontal", "gap": "sm", "align": "end" },
      "children": ["field", "btn"]
    },
    "field": {
      "type": "Input",
      "props": {
        "label": { "$param": "fieldLabel" },
        "name": { "$param": "fieldName" },
        "type": { "$param": "fieldType" },
        "value": { "$bindState": { "$param": "fieldPath" } }
      }
    },
    "btn": {
      "type": "Button",
      "props": {
        "label": { "$param": "label" },
        "variant": "primary"
      },
      "on": {
        "press": {
          "action": "dispatch",
          "params": { "name": { "$param": "actionName" } }
        }
      }
    }
  }
}
```

Usage in issue-detail.spec.json:
```json
{
  "action-assign": {
    "$ref": "fragments/command-with-input",
    "bind": {
      "label": "Assign",
      "fieldLabel": "Assignee user ID",
      "fieldName": "assigneeId",
      "fieldType": "number",
      "fieldPath": "/form/assigneeId",
      "actionName": "cmdAssign"
    }
  }
}
```

After compilation, `$param` values are substituted and fragment elements are inlined with prefixed IDs (e.g., `actionAssign__row`, `actionAssign__field`, `actionAssign__btn`). The compiled output is a canonical json-render Spec with no trace of `$ref` or `$param`.

---

## 6. Manifest

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
    "/issues/new": {
      "layout": "main",
      "screen": "screens/issues-new"
    },
    "/issues/search": {
      "layout": "main",
      "screen": "screens/issues-search"
    },
    "/issues/:id": {
      "layout": "main",
      "screen": "screens/issue-detail"
    },
    "/sprints/:sprintId": {
      "layout": "main",
      "screen": "screens/sprint-burndown"
    }
  }
}
```

---

## 7. Compiler Changes (packages/ui)

### 7.1 Structural Validator

Remove the requirement for Slot elements in layouts. Layouts are now pure chrome (header, nav) without a Slot — the runtime composes layout + screen as two separate Renderers.

### 7.2 Screen Descriptor Schema

Add `kind: "refetch"` to action definitions:

```typescript
type ScreenAction =
  | { kind: 'command'; binding: string; paramsFromState: Record<string, string>; onSuccess?: ...; onError?: ... }
  | { kind: 'refetch'; targets: string[] }
  | { kind: 'navigation'; navigateTo: string; paramsFromState?: Record<string, string> };
```

Navigation actions in screen.json remain supported but are no longer the primary pattern — navigation is handled by the native `navigate` action in spec.json.

### 7.3 HTTP Map (Phase 4)

For `kind: "refetch"` actions, resolve the `targets` list to data endpoint definitions (already resolved in the data section). No additional HTTP map work needed — the runtime re-fetches using the already-resolved data endpoints.

### 7.4 Validation

- Stack `gap` prop: shadcn accepts `"none" | "sm" | "md" | "lg" | "xl"` — the consistency validator should accept these (or skip gap validation since the compiler passes props through to json-render, which validates them via catalog)
- `on` field: the compiler currently doesn't validate action bindings in specs (actions are a runtime concern). This can stay as-is.

---

## 8. Binding Coverage

After migration, all 14 bindings are exercised:

| Binding | Screen | Type |
|---------|--------|------|
| `issuesByProject` | issues-home | data |
| `listIssuesUi` | issues-browse | data |
| `searchIssues` | issues-search | data (refetch) |
| `issueDetail` | issue-detail | data |
| `sprintBurndown` | sprint-burndown | data |
| `reportIssue` | issues-new | command |
| `submitIssue` | issue-detail | command |
| `assignIssue` | issue-detail | command |
| `reassignIssue` | issue-detail | command |
| `resolveIssue` | issue-detail | command |
| `reopenIssue` | issue-detail | command |
| `closeIssue` | issue-detail | command |
| `listIssues` | — | Not used (superseded by listIssuesUi for UI) |
| `assignIssueWithGuard` | — | Not used (assign + reassign cover the flow) |

12 of 14 bindings actively used. The remaining 2 (`listIssues` with status filter, `assignIssueWithGuard`) are API-only bindings that don't map to a distinct UI screen.

---

## 9. Scope

### In Scope

1. `packages/ui-runtime` — json-render/shadcn integration (registry, entry, driver, build)
2. `packages/ui` — compiler adjustments (remove Slot requirement, add refetch action kind)
3. `demo/issue-tracker-api/artifacts/ui/` — all source files rewritten to native json-render format
4. 2 new screens (search, sprint-burndown)
5. 2 new fragments (command-button, command-with-input)
6. Enhanced issue-detail (reopen, reassign commands)
7. Layout with navigation bar
8. Updated manifest (6 routes)

### Out of Scope

- `@json-render/shadcn` catalog extensions or custom components
- Visibility conditions on lifecycle buttons (show/hide based on issue status)
- Deletion of legacy ui.json or legacy packages
- SSR / streaming
- Tests for new screens (covered by compiler integration tests + manual E2E)
