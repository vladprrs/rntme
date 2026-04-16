# Demo Issue Tracker v2 Migration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the demo/issue-tracker-api render a working SPA via native json-render/shadcn, add 2 new screens (search, sprint burndown), enhance issue-detail with full lifecycle commands, and add parameterized fragments.

**Architecture:** The compiler (packages/ui) validates and emits pre-split artifacts from source files (manifest + .spec.json/.screen.json pairs + fragments). The runtime (packages/ui-runtime) serves compiled artifacts via Hono and renders them client-side using `@json-render/react` `<Renderer>` with the `@json-render/shadcn` catalog. Two registered actions (`navigate`, `dispatch`) bridge json-render's action system to the rntme driver for HTTP commands and client-side routing.

**Tech Stack:** TypeScript (strict, ESM), zod@4, @json-render/core+react+shadcn@0.17, React 19, Tailwind CSS 4, Hono (server), esbuild (client bundle), vitest (tests)

**Spec:** `docs/superpowers/specs/2026-04-16-demo-v2-migration-design.md`

---

## File Structure Overview

### packages/ui (compiler — modifications)

```
packages/ui/src/
  types/
    source.ts                     — ADD RefetchAction to ActionDef union
  validate/
    structural.ts                 — RELAX Slot requirement in layouts
  emit/
    http-map.ts                   — PASS THROUGH refetch actions
packages/ui/test/
  fixtures/
    minimal-app/layouts/main.spec.json  — REMOVE Slot element
    refetch-app/                  — NEW fixture for refetch action
  unit/
    validate.test.ts              — ADD test for layout-without-Slot
    emit.test.ts                  — ADD test for refetch action passthrough
```

### packages/ui-runtime (runtime — major rewrite of client)

```
packages/ui-runtime/
  package.json                    — ADD json-render + tailwind deps
  src/
    client/
      state-store.ts              — NEW: reactive store for json-render StateProvider
      registry.ts                 — REWRITE: defineCatalog + defineRegistry + shadcn
      entry.tsx                   — REWRITE: StateProvider + ActionProvider + Renderer
      layout-manager.tsx          — REWRITE: dual Renderer composition
      driver.ts                   — ADD refetch support, stateGetter param resolution
      styles.css                  — NEW: Tailwind CSS entry
    build.ts                      — ADD Tailwind CSS processing
  test/
    unit/
      state-store.test.ts         — NEW: store tests
      registry.test.ts            — NEW: catalog/registry wiring tests
      driver.test.ts              — ADD refetch test
```

### demo/issue-tracker-api/artifacts/ui (source files — rewrite)

```
demo/issue-tracker-api/artifacts/ui/
  manifest.json                   — REWRITE: 6 routes
  layouts/
    main.spec.json                — REWRITE: nav bar, no Slot
    main.screen.json              — KEEP as {}
  screens/
    issues-home.spec.json         — REWRITE: repeat + Card
    issues-home.screen.json       — REWRITE: remove navigation actions
    issues-browse.spec.json       — REWRITE: repeat + Card + Link
    issues-browse.screen.json     — REWRITE: remove navigation actions
    issues-new.spec.json          — REWRITE: Input + $bindState
    issues-new.screen.json        — KEEP (command action stays)
    issue-detail.spec.json        — REWRITE: fragments + reopen/reassign
    issue-detail.screen.json      — REWRITE: add reopen/reassign/refetch
    issues-search.spec.json       — NEW
    issues-search.screen.json     — NEW
    sprint-burndown.spec.json     — NEW
    sprint-burndown.screen.json   — NEW
  fragments/
    command-button.spec.json      — NEW
    command-with-input.spec.json  — NEW
```

---

## Task 1: Compiler — Relax Slot Validation in Layouts

**Files:**
- Modify: `packages/ui/src/validate/structural.ts:68-78`
- Modify: `packages/ui/test/fixtures/minimal-app/layouts/main.spec.json`
- Modify: `packages/ui/test/unit/validate.test.ts`

The structural validator currently requires layouts to have at least one Slot element. The v2 design removes Slot — layouts are pure chrome (header, nav) rendered as a separate `<Renderer>` instance. Remove the Slot requirement.

- [ ] **Step 1: Write test for layout without Slot**

Add to `packages/ui/test/unit/validate.test.ts`:

```typescript
it('accepts layout without Slot element', () => {
  const expanded = loadExpanded('minimal-app');
  // Remove Slot from layout
  const layout = expanded.layouts['main']!;
  delete layout.spec.elements['slot-main'];
  layout.spec.elements['shell']!.children = [];
  const result = validate(expanded, noopResolvers);
  expect(result.ok).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/ui && pnpm test -- --reporter=verbose 2>&1 | tail -20
```

Expected: FAIL — `SLOT_DUPLICATE` error ("Layout layout:main has no Slot element").

- [ ] **Step 3: Remove Slot requirement from structural.ts**

In `packages/ui/src/validate/structural.ts`, delete lines 68-78 (the "Layout must have at least one Slot" block):

```typescript
  // Layout must have at least one Slot
  if (isLayout) {
    const hasSlot = Object.values(elements).some((el) => el.type === 'Slot');
    if (!hasSlot) {
      errors.push({
        code: 'SLOT_DUPLICATE',
        message: `Layout ${context} has no Slot element`,
        path: context,
      });
    }
  }
```

The "Slot elements only allowed in screens" check (lines 55-66) stays — Slots in screens are still an error.

- [ ] **Step 4: Run tests to verify all pass**

```bash
cd packages/ui && pnpm test -- --reporter=verbose 2>&1 | tail -30
```

Expected: all tests pass including the new one.

- [ ] **Step 5: Update minimal-app fixture to remove Slot**

Rewrite `packages/ui/test/fixtures/minimal-app/layouts/main.spec.json`:

```json
{
  "root": "shell",
  "elements": {
    "shell": {
      "type": "Stack",
      "props": { "direction": "vertical" },
      "children": ["header"]
    },
    "header": {
      "type": "Heading",
      "props": { "level": 1, "text": "Test App" }
    }
  }
}
```

- [ ] **Step 6: Run all compiler tests**

```bash
cd packages/ui && pnpm test -- --reporter=verbose 2>&1 | tail -30
```

Expected: all 23+ tests pass. The integration test for minimal-app still passes because layout Slot is now optional.

- [ ] **Step 7: Commit**

```bash
git add packages/ui/src/validate/structural.ts packages/ui/test/
git commit -m "fix(ui): make Slot element optional in layouts"
```

---

## Task 2: Compiler — Add RefetchAction Type

**Files:**
- Modify: `packages/ui/src/types/source.ts`
- Modify: `packages/ui/src/types/compiled.ts`
- Modify: `packages/ui/src/emit/http-map.ts`
- Modify: `packages/ui/test/unit/emit.test.ts`

Add `kind: "refetch"` action to the source and compiled types. The http-map phase passes refetch actions through unchanged (they have no binding to resolve).

- [ ] **Step 1: Add RefetchAction to source types**

In `packages/ui/src/types/source.ts`, add after the `CommandAction` type:

```typescript
export type RefetchAction = {
  kind: 'refetch';
  targets: string[];
};
```

Update the `ActionDef` union:

```typescript
export type ActionDef = NavigationAction | CommandAction | RefetchAction;
```

- [ ] **Step 2: Add CompiledRefetchAction to compiled types**

In `packages/ui/src/types/compiled.ts`, add to the `CompiledAction` union:

```typescript
export type CompiledAction =
  | { kind: 'navigation'; navigateTo: string; paramsFromState?: Record<string, string> }
  | {
      kind: 'command';
      method: 'POST';
      path: string;
      paramsFromState: Record<string, string>;
      onSuccess?: { navigateTo?: string; refetchData?: string[]; clearFormState?: string[] };
      onError?: { showAlert?: boolean };
    }
  | { kind: 'refetch'; targets: string[] };
```

- [ ] **Step 3: Update http-map.ts to pass through refetch actions**

In `packages/ui/src/emit/http-map.ts`, update the actions loop (line 33-46) to handle refetch:

```typescript
  const actions: Record<string, unknown> = {};
  if (screen.actions) {
    for (const [actionId, action] of Object.entries(screen.actions)) {
      if (action.kind === 'navigation') {
        actions[actionId] = { ...action };
      } else if (action.kind === 'refetch') {
        actions[actionId] = { ...action };
      } else {
        const http = httpMap[action.binding];
        if (!http) continue;
        const { binding: _, ...rest } = action;
        actions[actionId] = {
          ...rest,
          method: http.method,
          path: http.path,
        };
      }
    }
  }
```

- [ ] **Step 4: Write test for refetch action passthrough**

Create test fixture `packages/ui/test/fixtures/refetch-app/manifest.json`:

```json
{
  "version": "2.0",
  "pdmRef": "test.domain.v1",
  "qsmRef": "test.read.v1",
  "graphSpecRef": "test.graphs.v1",
  "bindingsRef": "test.bindings.v1",
  "metadata": { "title": "Refetch Test" },
  "layouts": {
    "main": "layouts/main"
  },
  "routes": {
    "/": { "layout": "main", "screen": "screens/home" }
  }
}
```

Create `packages/ui/test/fixtures/refetch-app/layouts/main.spec.json`:

```json
{
  "root": "shell",
  "elements": {
    "shell": { "type": "Heading", "props": { "level": 1, "text": "Test" } }
  }
}
```

Create `packages/ui/test/fixtures/refetch-app/layouts/main.screen.json`:

```json
{}
```

Create `packages/ui/test/fixtures/refetch-app/screens/home.spec.json`:

```json
{
  "root": "page",
  "elements": {
    "page": { "type": "Heading", "props": { "level": 2, "text": "Home" } }
  }
}
```

Create `packages/ui/test/fixtures/refetch-app/screens/home.screen.json`:

```json
{
  "metadata": { "title": "Home" },
  "data": {
    "/data/results": {
      "binding": "searchItems",
      "params": { "q": { "$state": "/form/q" } }
    }
  },
  "actions": {
    "doSearch": {
      "kind": "refetch",
      "targets": ["/data/results"]
    }
  }
}
```

Add test to `packages/ui/test/unit/emit.test.ts`:

```typescript
it('passes through refetch actions in compiled output', () => {
  const result = compile({
    sourceDir: join(fixtures, 'refetch-app'),
    httpMap: {
      searchItems: { method: 'GET', path: '/api/search' },
    },
    resolvers: {
      resolveBinding: () => ({}),
      resolveComponent: () => ({ childrenModel: 'list' }),
      resolveRoute: () => true,
    },
  });
  expect(result.ok).toBe(true);
  if (!result.ok) return;

  const home = result.value.screens['home']!;
  expect(home.actions).toBeDefined();
  const doSearch = home.actions!['doSearch'] as { kind: string; targets: string[] };
  expect(doSearch.kind).toBe('refetch');
  expect(doSearch.targets).toEqual(['/data/results']);
});
```

- [ ] **Step 5: Run tests**

```bash
cd packages/ui && pnpm test -- --reporter=verbose 2>&1 | tail -30
```

Expected: all tests pass including the new refetch test.

- [ ] **Step 6: Commit**

```bash
git add packages/ui/src/types/ packages/ui/src/emit/http-map.ts packages/ui/test/
git commit -m "feat(ui): add refetch action kind to source and compiled types"
```

---

## Task 3: Demo Source Files — Manifest, Layout, Fragments

**Files:**
- Rewrite: `demo/issue-tracker-api/artifacts/ui/manifest.json`
- Rewrite: `demo/issue-tracker-api/artifacts/ui/layouts/main.spec.json`
- Create: `demo/issue-tracker-api/artifacts/ui/fragments/command-button.spec.json`
- Create: `demo/issue-tracker-api/artifacts/ui/fragments/command-with-input.spec.json`

- [ ] **Step 1: Rewrite manifest.json with 6 routes**

Write `demo/issue-tracker-api/artifacts/ui/manifest.json`:

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

- [ ] **Step 2: Rewrite layout with nav bar (no Slot)**

Write `demo/issue-tracker-api/artifacts/ui/layouts/main.spec.json`:

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

Keep `demo/issue-tracker-api/artifacts/ui/layouts/main.screen.json` as `{}`.

- [ ] **Step 3: Create command-button fragment**

Create directory and write `demo/issue-tracker-api/artifacts/ui/fragments/command-button.spec.json`:

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

- [ ] **Step 4: Create command-with-input fragment**

Write `demo/issue-tracker-api/artifacts/ui/fragments/command-with-input.spec.json`:

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

- [ ] **Step 5: Commit**

```bash
git add demo/issue-tracker-api/artifacts/ui/manifest.json demo/issue-tracker-api/artifacts/ui/layouts/ demo/issue-tracker-api/artifacts/ui/fragments/
git commit -m "feat(demo): rewrite manifest with 6 routes, nav layout, and fragments"
```

---

## Task 4: Demo Source Files — Existing Screens Rewrite

**Files:**
- Rewrite: `demo/issue-tracker-api/artifacts/ui/screens/issues-home.spec.json`
- Rewrite: `demo/issue-tracker-api/artifacts/ui/screens/issues-home.screen.json`
- Rewrite: `demo/issue-tracker-api/artifacts/ui/screens/issues-browse.spec.json`
- Rewrite: `demo/issue-tracker-api/artifacts/ui/screens/issues-browse.screen.json`
- Rewrite: `demo/issue-tracker-api/artifacts/ui/screens/issues-new.spec.json`
- Rewrite: `demo/issue-tracker-api/artifacts/ui/screens/issues-new.screen.json`

- [ ] **Step 1: Rewrite issues-home**

Write `demo/issue-tracker-api/artifacts/ui/screens/issues-home.spec.json`:

```json
{
  "root": "page",
  "elements": {
    "page": {
      "type": "Stack",
      "props": { "direction": "vertical", "gap": "lg" },
      "children": ["heading", "stats-list", "burndown-link"]
    },
    "heading": {
      "type": "Heading",
      "props": { "level": 2, "text": "Issues by Project" }
    },
    "stats-list": {
      "type": "Stack",
      "props": { "direction": "vertical", "gap": "sm" },
      "children": ["stat-card"],
      "repeat": { "statePath": "/data/stats" }
    },
    "stat-card": {
      "type": "Card",
      "props": { "title": { "$item": "projectKey" } },
      "children": ["stat-badges"]
    },
    "stat-badges": {
      "type": "Stack",
      "props": { "direction": "horizontal", "gap": "sm" },
      "children": ["badge-count", "badge-points"]
    },
    "badge-count": {
      "type": "Badge",
      "props": { "text": { "$template": "${$item.issueCount} issues" } }
    },
    "badge-points": {
      "type": "Badge",
      "props": { "text": { "$template": "${$item.totalStoryPoints} pts" }, "variant": "secondary" }
    },
    "burndown-link": {
      "type": "Button",
      "props": { "label": "Sprint Burndown (Sprint 1)", "variant": "secondary" },
      "on": { "press": { "action": "navigate", "params": { "to": "/sprints/1" } } }
    }
  }
}
```

Write `demo/issue-tracker-api/artifacts/ui/screens/issues-home.screen.json`:

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

- [ ] **Step 2: Rewrite issues-browse**

Write `demo/issue-tracker-api/artifacts/ui/screens/issues-browse.spec.json`:

```json
{
  "root": "page",
  "elements": {
    "page": {
      "type": "Stack",
      "props": { "direction": "vertical", "gap": "lg" },
      "children": ["heading", "issues-list"]
    },
    "heading": {
      "type": "Heading",
      "props": { "level": 2, "text": "Recent Issues" }
    },
    "issues-list": {
      "type": "Stack",
      "props": { "direction": "vertical", "gap": "sm" },
      "children": ["issue-card"],
      "repeat": { "statePath": "/data/issues" }
    },
    "issue-card": {
      "type": "Card",
      "props": { "title": { "$item": "title" } },
      "children": ["card-content"]
    },
    "card-content": {
      "type": "Stack",
      "props": { "direction": "horizontal", "gap": "sm", "align": "center" },
      "children": ["badge-id", "badge-status", "badge-priority", "link-detail"]
    },
    "badge-id": {
      "type": "Badge",
      "props": { "text": { "$template": "#${$item.id}" }, "variant": "outline" }
    },
    "badge-status": {
      "type": "Badge",
      "props": { "text": { "$item": "status" } }
    },
    "badge-priority": {
      "type": "Badge",
      "props": { "text": { "$item": "priority" }, "variant": "secondary" }
    },
    "link-detail": {
      "type": "Link",
      "props": { "label": "View \u2192" },
      "on": {
        "press": {
          "action": "navigate",
          "params": { "to": "/issues/:id", "id": { "$item": "id" } }
        }
      }
    }
  }
}
```

Write `demo/issue-tracker-api/artifacts/ui/screens/issues-browse.screen.json`:

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

- [ ] **Step 3: Rewrite issues-new**

Write `demo/issue-tracker-api/artifacts/ui/screens/issues-new.spec.json`:

```json
{
  "root": "page",
  "elements": {
    "page": {
      "type": "Stack",
      "props": { "direction": "vertical", "gap": "lg" },
      "children": ["heading", "form-fields", "submit-btn"]
    },
    "heading": {
      "type": "Heading",
      "props": { "level": 2, "text": "Report a New Issue" }
    },
    "form-fields": {
      "type": "Stack",
      "props": { "direction": "vertical", "gap": "md" },
      "children": ["field-issueId", "field-title", "field-projectId", "field-reporterId", "field-priority", "field-storyPoints"]
    },
    "field-issueId": {
      "type": "Input",
      "props": { "label": "Issue ID", "name": "issueId", "type": "number", "value": { "$bindState": "/form/issueId" } }
    },
    "field-title": {
      "type": "Input",
      "props": { "label": "Title", "name": "title", "value": { "$bindState": "/form/title" } }
    },
    "field-projectId": {
      "type": "Input",
      "props": { "label": "Project ID", "name": "projectId", "type": "number", "value": { "$bindState": "/form/projectId" } }
    },
    "field-reporterId": {
      "type": "Input",
      "props": { "label": "Reporter ID", "name": "reporterId", "type": "number", "value": { "$bindState": "/form/reporterId" } }
    },
    "field-priority": {
      "type": "Input",
      "props": { "label": "Priority", "name": "priority", "value": { "$bindState": "/form/priority" } }
    },
    "field-storyPoints": {
      "type": "Input",
      "props": { "label": "Story Points", "name": "storyPoints", "type": "number", "value": { "$bindState": "/form/storyPoints" } }
    },
    "submit-btn": {
      "type": "Button",
      "props": { "label": "Submit", "variant": "primary" },
      "on": { "press": { "action": "dispatch", "params": { "name": "submit" } } }
    }
  }
}
```

Write `demo/issue-tracker-api/artifacts/ui/screens/issues-new.screen.json`:

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

- [ ] **Step 4: Commit**

```bash
git add demo/issue-tracker-api/artifacts/ui/screens/issues-home.* demo/issue-tracker-api/artifacts/ui/screens/issues-browse.* demo/issue-tracker-api/artifacts/ui/screens/issues-new.*
git commit -m "feat(demo): rewrite home/browse/new screens with native json-render format"
```

---

## Task 5: Demo Source Files — Issue Detail (Enhanced) + New Screens

**Files:**
- Rewrite: `demo/issue-tracker-api/artifacts/ui/screens/issue-detail.spec.json`
- Rewrite: `demo/issue-tracker-api/artifacts/ui/screens/issue-detail.screen.json`
- Create: `demo/issue-tracker-api/artifacts/ui/screens/issues-search.spec.json`
- Create: `demo/issue-tracker-api/artifacts/ui/screens/issues-search.screen.json`
- Create: `demo/issue-tracker-api/artifacts/ui/screens/sprint-burndown.spec.json`
- Create: `demo/issue-tracker-api/artifacts/ui/screens/sprint-burndown.screen.json`

- [ ] **Step 1: Rewrite issue-detail with fragments and full lifecycle**

Write `demo/issue-tracker-api/artifacts/ui/screens/issue-detail.spec.json`:

```json
{
  "root": "page",
  "elements": {
    "page": {
      "type": "Stack",
      "props": { "direction": "vertical", "gap": "lg" },
      "children": ["heading", "detail-list", "lifecycle-hint", "actions-section"]
    },
    "heading": {
      "type": "Heading",
      "props": { "level": 2, "text": "Issue Detail" }
    },
    "detail-list": {
      "type": "Stack",
      "props": { "direction": "vertical", "gap": "sm" },
      "children": ["detail-card"],
      "repeat": { "statePath": "/data/detail" }
    },
    "detail-card": {
      "type": "Card",
      "props": { "title": { "$item": "title" } },
      "children": ["detail-badges"]
    },
    "detail-badges": {
      "type": "Stack",
      "props": { "direction": "horizontal", "gap": "sm" },
      "children": ["badge-id", "badge-status", "badge-priority", "badge-project", "badge-assignee", "badge-reporter"]
    },
    "badge-id": {
      "type": "Badge",
      "props": { "text": { "$template": "#${$item.id}" }, "variant": "outline" }
    },
    "badge-status": {
      "type": "Badge",
      "props": { "text": { "$item": "status" } }
    },
    "badge-priority": {
      "type": "Badge",
      "props": { "text": { "$item": "priority" }, "variant": "secondary" }
    },
    "badge-project": {
      "type": "Badge",
      "props": { "text": { "$template": "Project: ${$item.projectKey}" }, "variant": "outline" }
    },
    "badge-assignee": {
      "type": "Badge",
      "props": { "text": { "$template": "Assignee: ${$item.assigneeUsername}" }, "variant": "outline" }
    },
    "badge-reporter": {
      "type": "Badge",
      "props": { "text": { "$template": "Reporter: ${$item.reporterUsername}" }, "variant": "outline" }
    },
    "lifecycle-hint": {
      "type": "Text",
      "props": { "text": "Lifecycle: Submit (draft\u2192open), Assign, Reassign, Resolve (in_progress\u2192resolved), Reopen, Close (resolved\u2192closed)." }
    },
    "actions-section": {
      "type": "Stack",
      "props": { "direction": "vertical", "gap": "md" },
      "children": ["action-submit", "action-assign", "action-reassign", "action-resolve", "action-reopen", "action-close"]
    },
    "action-submit": {
      "$ref": "fragments/command-button",
      "bind": { "label": "Submit (draft \u2192 open)", "variant": "secondary", "actionName": "cmdSubmit" }
    },
    "action-assign": {
      "$ref": "fragments/command-with-input",
      "bind": { "label": "Assign", "fieldLabel": "Assignee user ID", "fieldName": "assigneeId", "fieldType": "number", "fieldPath": "/form/assigneeId", "actionName": "cmdAssign" }
    },
    "action-reassign": {
      "$ref": "fragments/command-with-input",
      "bind": { "label": "Reassign", "fieldLabel": "New assignee ID", "fieldName": "assigneeId", "fieldType": "number", "fieldPath": "/form/assigneeId", "actionName": "cmdReassign" }
    },
    "action-resolve": {
      "$ref": "fragments/command-with-input",
      "bind": { "label": "Resolve", "fieldLabel": "Resolved at (ISO-8601)", "fieldName": "resolvedAt", "fieldType": "text", "fieldPath": "/form/resolvedAt", "actionName": "cmdResolve" }
    },
    "action-reopen": {
      "$ref": "fragments/command-button",
      "bind": { "label": "Reopen (resolved \u2192 open)", "variant": "secondary", "actionName": "cmdReopen" }
    },
    "action-close": {
      "$ref": "fragments/command-button",
      "bind": { "label": "Close (resolved \u2192 closed)", "variant": "danger", "actionName": "cmdClose" }
    }
  }
}
```

Write `demo/issue-tracker-api/artifacts/ui/screens/issue-detail.screen.json`:

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

- [ ] **Step 2: Create issues-search screen**

Write `demo/issue-tracker-api/artifacts/ui/screens/issues-search.spec.json`:

```json
{
  "root": "page",
  "elements": {
    "page": {
      "type": "Stack",
      "props": { "direction": "vertical", "gap": "lg" },
      "children": ["heading", "search-form", "search-btn", "results-list"]
    },
    "heading": {
      "type": "Heading",
      "props": { "level": 2, "text": "Search Issues" }
    },
    "search-form": {
      "type": "Stack",
      "props": { "direction": "vertical", "gap": "md" },
      "children": ["field-q", "field-from", "field-to", "field-priority", "field-limit"]
    },
    "field-q": {
      "type": "Input",
      "props": { "label": "Query (title search)", "name": "q", "value": { "$bindState": "/form/q" } }
    },
    "field-from": {
      "type": "Input",
      "props": { "label": "From date (ISO-8601)", "name": "from", "placeholder": "2025-01-01T00:00:00.000Z", "value": { "$bindState": "/form/from" } }
    },
    "field-to": {
      "type": "Input",
      "props": { "label": "To date (ISO-8601)", "name": "to", "placeholder": "2026-12-31T23:59:59.999Z", "value": { "$bindState": "/form/to" } }
    },
    "field-priority": {
      "type": "Input",
      "props": { "label": "Priority (optional)", "name": "priority", "value": { "$bindState": "/form/priority" } }
    },
    "field-limit": {
      "type": "Input",
      "props": { "label": "Max results", "name": "limit", "type": "number", "value": { "$bindState": "/form/limit" } }
    },
    "search-btn": {
      "type": "Button",
      "props": { "label": "Search", "variant": "primary" },
      "on": { "press": { "action": "dispatch", "params": { "name": "search" } } }
    },
    "results-list": {
      "type": "Stack",
      "props": { "direction": "vertical", "gap": "sm" },
      "children": ["result-card"],
      "repeat": { "statePath": "/data/results" }
    },
    "result-card": {
      "type": "Card",
      "props": { "title": { "$item": "title" } },
      "children": ["result-meta"]
    },
    "result-meta": {
      "type": "Stack",
      "props": { "direction": "horizontal", "gap": "sm" },
      "children": ["result-badge-id", "result-badge-status", "result-badge-priority", "result-link"]
    },
    "result-badge-id": {
      "type": "Badge",
      "props": { "text": { "$template": "#${$item.id}" }, "variant": "outline" }
    },
    "result-badge-status": {
      "type": "Badge",
      "props": { "text": { "$item": "status" } }
    },
    "result-badge-priority": {
      "type": "Badge",
      "props": { "text": { "$item": "priority" }, "variant": "secondary" }
    },
    "result-link": {
      "type": "Link",
      "props": { "label": "View \u2192" },
      "on": {
        "press": {
          "action": "navigate",
          "params": { "to": "/issues/:id", "id": { "$item": "id" } }
        }
      }
    }
  }
}
```

Write `demo/issue-tracker-api/artifacts/ui/screens/issues-search.screen.json`:

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

- [ ] **Step 3: Create sprint-burndown screen**

Write `demo/issue-tracker-api/artifacts/ui/screens/sprint-burndown.spec.json`:

```json
{
  "root": "page",
  "elements": {
    "page": {
      "type": "Stack",
      "props": { "direction": "vertical", "gap": "lg" },
      "children": ["heading", "burndown-list", "back-btn"]
    },
    "heading": {
      "type": "Heading",
      "props": { "level": 2, "text": "Sprint Burndown" }
    },
    "burndown-list": {
      "type": "Stack",
      "props": { "direction": "vertical", "gap": "sm" },
      "children": ["status-card"],
      "repeat": { "statePath": "/data/burndown" }
    },
    "status-card": {
      "type": "Card",
      "props": { "title": { "$item": "status" } },
      "children": ["status-badges"]
    },
    "status-badges": {
      "type": "Stack",
      "props": { "direction": "horizontal", "gap": "sm" },
      "children": ["badge-issues", "badge-points"]
    },
    "badge-issues": {
      "type": "Badge",
      "props": { "text": { "$template": "${$item.issueCount} issues" } }
    },
    "badge-points": {
      "type": "Badge",
      "props": { "text": { "$template": "${$item.totalStoryPoints} pts" }, "variant": "secondary" }
    },
    "back-btn": {
      "type": "Button",
      "props": { "label": "\u2190 Back to Home", "variant": "secondary" },
      "on": { "press": { "action": "navigate", "params": { "to": "/issues" } } }
    }
  }
}
```

Write `demo/issue-tracker-api/artifacts/ui/screens/sprint-burndown.screen.json`:

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

- [ ] **Step 4: Commit**

```bash
git add demo/issue-tracker-api/artifacts/ui/screens/
git commit -m "feat(demo): enhanced issue-detail + search and sprint-burndown screens"
```

---

## Task 6: Demo Compilation Verification

**Files:**
- Test: run compiler on new demo source files

Verify the v2 compiler successfully compiles the new demo source files with all fragments, 6 routes, and the refetch action.

- [ ] **Step 1: Write a quick verification script**

Run from project root:

```bash
cd packages/ui && node -e "
const { compile } = await import('./dist/compile.js');
const { join } = await import('node:path');
const result = compile({
  sourceDir: join(process.cwd(), '../../demo/issue-tracker-api/artifacts/ui'),
  httpMap: {
    issuesByProject: { method: 'GET', path: '/api/v1/stats/by-project' },
    listIssuesUi: { method: 'GET', path: '/api/v1/ui/issues' },
    searchIssues: { method: 'GET', path: '/api/v1/issues/search' },
    issueDetail: { method: 'GET', path: '/api/v1/issues/{id}' },
    sprintBurndown: { method: 'GET', path: '/api/v1/sprints/{sprintId}/burndown' },
    reportIssue: { method: 'POST', path: '/api/v1/issues' },
    submitIssue: { method: 'POST', path: '/api/v1/issues/{issueId}/actions/submit' },
    assignIssue: { method: 'POST', path: '/api/v1/issues/{issueId}/actions/assign' },
    reassignIssue: { method: 'POST', path: '/api/v1/issues/{issueId}/actions/reassign' },
    resolveIssue: { method: 'POST', path: '/api/v1/issues/{issueId}/actions/resolve' },
    reopenIssue: { method: 'POST', path: '/api/v1/issues/{issueId}/actions/reopen' },
    closeIssue: { method: 'POST', path: '/api/v1/issues/{issueId}/actions/close' },
  },
  resolvers: {
    resolveBinding: () => ({}),
    resolveComponent: () => ({ childrenModel: 'list' }),
    resolveRoute: () => true,
  },
});
if (!result.ok) { console.error(JSON.stringify(result.errors, null, 2)); process.exit(1); }
console.log('OK — routes:', Object.keys(result.value.manifest.routes));
console.log('OK — screens:', Object.keys(result.value.screens));
console.log('OK — layouts:', Object.keys(result.value.layouts));
const detail = result.value.screens['issue-detail'];
const hasFragments = Object.keys(detail.spec.elements).some(k => k.includes('__'));
console.log('OK — fragments inlined:', hasFragments);
const hasRefetch = detail.actions?.search || Object.values(result.value.screens).some(s => s.actions && Object.values(s.actions).some(a => a.kind === 'refetch'));
console.log('OK — refetch action:', !!hasRefetch);
"
```

Expected output:
```
OK — routes: [ '/issues', '/issues/browse', '/issues/new', '/issues/search', '/issues/:id', '/sprints/:sprintId' ]
OK — screens: [ 'issues-home', 'issues-browse', 'issues-new', 'issues-search', 'issue-detail', 'sprint-burndown' ]
OK — layouts: [ 'main' ]
OK — fragments inlined: true
OK — refetch action: true
```

- [ ] **Step 2: Fix any compilation errors**

If the compiler reports errors, fix the source files and re-run. Common issues:
- Typos in element key references (children pointing to nonexistent elements)
- Missing fragment files
- Invalid `$state` paths not covered by data bindings (check `/form/` prefix)

- [ ] **Step 3: Run all compiler tests to verify no regressions**

```bash
cd packages/ui && pnpm test -- --reporter=verbose 2>&1 | tail -30
```

Expected: all tests pass.

- [ ] **Step 4: Commit (if any fixes were needed)**

```bash
git add demo/issue-tracker-api/artifacts/ui/ packages/ui/
git commit -m "fix(demo): compilation fixes for v2 source format"
```

---

## Task 7: Runtime — Dependencies + State Store

**Files:**
- Modify: `packages/ui-runtime/package.json`
- Create: `packages/ui-runtime/src/client/state-store.ts`
- Create: `packages/ui-runtime/test/unit/state-store.test.ts`

- [ ] **Step 1: Add json-render and Tailwind dependencies**

Add to `packages/ui-runtime/package.json` dependencies:

```json
"@json-render/core": "^0.17.0",
"@json-render/react": "^0.17.0",
"@json-render/shadcn": "^0.17.0"
```

Add to devDependencies:

```json
"@tailwindcss/cli": "^4.0.0"
```

Run:

```bash
pnpm install
```

- [ ] **Step 2: Write state store tests**

Create `packages/ui-runtime/test/unit/state-store.test.ts`:

```typescript
import { describe, expect, it, vi } from 'vitest';
import { createStateStore } from '../../src/client/state-store.js';

describe('createStateStore', () => {
  it('gets and sets values by path', () => {
    const store = createStateStore();
    store.set('/data/items', [1, 2, 3]);
    expect(store.get('/data/items')).toEqual([1, 2, 3]);
  });

  it('returns snapshot as a plain object', () => {
    const store = createStateStore();
    store.set('/a', 1);
    store.set('/b', 2);
    const snap = store.getSnapshot();
    expect(snap).toEqual({ '/a': 1, '/b': 2 });
  });

  it('notifies subscribers on set', () => {
    const store = createStateStore();
    const listener = vi.fn();
    store.subscribe(listener);
    store.set('/x', 'hello');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('unsubscribes correctly', () => {
    const store = createStateStore();
    const listener = vi.fn();
    const unsub = store.subscribe(listener);
    unsub();
    store.set('/x', 'hello');
    expect(listener).not.toHaveBeenCalled();
  });

  it('batch updates via update()', () => {
    const store = createStateStore();
    const listener = vi.fn();
    store.subscribe(listener);
    store.update({ '/a': 1, '/b': 2 });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.get('/a')).toBe(1);
    expect(store.get('/b')).toBe(2);
  });

  it('returns stable snapshot reference between sets', () => {
    const store = createStateStore();
    const snap1 = store.getSnapshot();
    const snap2 = store.getSnapshot();
    expect(snap1).toBe(snap2);

    store.set('/x', 1);
    const snap3 = store.getSnapshot();
    expect(snap3).not.toBe(snap1);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd packages/ui-runtime && pnpm test -- --reporter=verbose 2>&1 | tail -20
```

Expected: FAIL — module not found.

- [ ] **Step 4: Implement state store**

Create `packages/ui-runtime/src/client/state-store.ts`:

```typescript
export type StateStore = {
  get(path: string): unknown;
  set(path: string, value: unknown): void;
  update(changes: Record<string, unknown>): void;
  getSnapshot(): Record<string, unknown>;
  subscribe(listener: () => void): () => void;
};

export function createStateStore(): StateStore {
  const data: Record<string, unknown> = {};
  let snapshot: Record<string, unknown> = {};
  const listeners = new Set<() => void>();

  function notify(): void {
    snapshot = { ...data };
    for (const fn of listeners) fn();
  }

  return {
    get: (path) => data[path],
    set: (path, value) => {
      data[path] = value;
      notify();
    },
    update: (changes) => {
      Object.assign(data, changes);
      notify();
    },
    getSnapshot: () => snapshot,
    subscribe: (fn) => {
      listeners.add(fn);
      return () => { listeners.delete(fn); };
    },
  };
}
```

- [ ] **Step 5: Run tests**

```bash
cd packages/ui-runtime && pnpm test -- --reporter=verbose 2>&1 | tail -30
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/ui-runtime/package.json packages/ui-runtime/src/client/state-store.ts packages/ui-runtime/test/unit/state-store.test.ts
git commit -m "feat(ui-runtime): add json-render deps and reactive state store"
```

---

## Task 8: Runtime — Registry with shadcn + Custom Actions

**Files:**
- Rewrite: `packages/ui-runtime/src/client/registry.ts`

Implement the registry using `defineCatalog` + `defineRegistry` from `@json-render/react` with the full shadcn component catalog and two custom actions: `navigate` and `dispatch`.

- [ ] **Step 1: Rewrite registry.ts**

Rewrite `packages/ui-runtime/src/client/registry.ts`:

```typescript
import { defineCatalog } from '@json-render/core';
import { schema, defineRegistry } from '@json-render/react';
import { shadcnComponentDefinitions } from '@json-render/shadcn/catalog';
import { shadcnComponents } from '@json-render/shadcn';
import { z } from 'zod';
import type { CompiledScreen, CompiledAction, CompiledDataEndpoint } from '@rntme/ui';
import type { StateStore } from './state-store.js';

export type RuntimeBridge = {
  onNavigate: (path: string) => void;
  getScreen: () => CompiledScreen | null;
  store: StateStore;
  fetchEndpoint: (statePath: string, endpoint: CompiledDataEndpoint) => Promise<void>;
};

const catalog = defineCatalog(schema, {
  components: shadcnComponentDefinitions,
  actions: {
    navigate: {
      params: z.object({ to: z.string() }).passthrough(),
      description: 'Client-side navigation. :param placeholders in `to` are replaced from remaining params.',
    },
    dispatch: {
      params: z.object({ name: z.string() }),
      description: 'Execute a screen-defined action by name (command, refetch).',
    },
  },
});

export function createRegistry(bridge: RuntimeBridge) {
  const { registry, handlers } = defineRegistry(catalog, {
    components: shadcnComponents,
    actions: {
      navigate: async (params: Record<string, unknown>) => {
        let target = params.to as string;
        for (const [k, v] of Object.entries(params)) {
          if (k !== 'to') target = target.replace(`:${k}`, String(v));
        }
        bridge.onNavigate(target);
      },
      dispatch: async (params: Record<string, unknown>) => {
        const screen = bridge.getScreen();
        if (!screen?.actions) return;
        const actionName = params.name as string;
        const action = screen.actions[actionName] as CompiledAction | undefined;
        if (!action) return;

        if (action.kind === 'navigation') {
          let target = action.navigateTo;
          if (action.paramsFromState) {
            for (const [param, statePath] of Object.entries(action.paramsFromState)) {
              target = target.replace(`:${param}`, String(bridge.store.get(statePath) ?? ''));
            }
          }
          bridge.onNavigate(target);
          return;
        }

        if (action.kind === 'refetch') {
          const screen = bridge.getScreen();
          if (!screen?.data) return;
          for (const target of action.targets) {
            const endpoint = screen.data[target];
            if (endpoint) await bridge.fetchEndpoint(target, endpoint);
          }
          return;
        }

        // Command action
        const cmdParams: Record<string, unknown> = {};
        if (action.paramsFromState) {
          for (const [param, statePath] of Object.entries(action.paramsFromState)) {
            cmdParams[param] = bridge.store.get(statePath);
          }
        }

        let url = action.path;
        url = url.replace(/\{([^}]+)\}/g, (_, key: string) => {
          const v = cmdParams[key];
          delete cmdParams[key];
          return String(v ?? '');
        });

        try {
          const res = await fetch(url, {
            method: action.method,
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(cmdParams),
          });
          if (!res.ok) {
            if (action.onError?.showAlert) {
              const text = await res.text().catch(() => `HTTP ${res.status}`);
              globalThis.alert?.(text) ?? console.error(text);
            }
            return;
          }
          if (action.onSuccess?.refetchData) {
            const screen = bridge.getScreen();
            if (screen?.data) {
              for (const dataPath of action.onSuccess.refetchData) {
                const endpoint = screen.data[dataPath];
                if (endpoint) await bridge.fetchEndpoint(dataPath, endpoint);
              }
            }
          }
          if (action.onSuccess?.navigateTo) {
            bridge.onNavigate(action.onSuccess.navigateTo);
          }
        } catch (e) {
          if (action.onError?.showAlert) {
            const msg = e instanceof Error ? e.message : String(e);
            globalThis.alert?.(msg) ?? console.error(msg);
          }
        }
      },
    },
  });

  return { catalog, registry, handlers };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd packages/ui-runtime && pnpm run build 2>&1 | head -30
```

If there are type errors from json-render imports, check the exact import paths:
- `@json-render/core` exports `defineCatalog`
- `@json-render/react` exports `schema`, `defineRegistry`
- `@json-render/shadcn/catalog` exports `shadcnComponentDefinitions`
- `@json-render/shadcn` exports `shadcnComponents`

Adjust imports based on actual package export maps if needed.

- [ ] **Step 3: Run existing tests to verify no regressions**

```bash
cd packages/ui-runtime && pnpm test -- --reporter=verbose 2>&1 | tail -30
```

Expected: existing tests still pass (registry is not imported by existing tests).

- [ ] **Step 4: Commit**

```bash
git add packages/ui-runtime/src/client/registry.ts
git commit -m "feat(ui-runtime): implement registry with shadcn catalog and navigate/dispatch actions"
```

---

## Task 9: Runtime — Entry + Layout Manager Rewrite

**Files:**
- Rewrite: `packages/ui-runtime/src/client/entry.tsx`
- Rewrite: `packages/ui-runtime/src/client/layout-manager.tsx`

Replace `<pre>JSON</pre>` rendering with json-render `<Renderer>` using `StateProvider`, `ActionProvider`, and `VisibilityProvider`. Layout and screen render as two separate `<Renderer>` instances.

- [ ] **Step 1: Rewrite layout-manager.tsx**

Rewrite `packages/ui-runtime/src/client/layout-manager.tsx`:

```tsx
import * as React from 'react';
import type { CompiledSpec } from '@rntme/ui';
import { Renderer, StateProvider, ActionProvider, VisibilityProvider } from '@json-render/react';
import type { StateStore } from './state-store.js';

export type AppShellProps = {
  layoutSpec: CompiledSpec | null;
  screenSpec: CompiledSpec | null;
  registry: Record<string, unknown>;
  actionHandlers: Record<string, unknown>;
  store: StateStore;
};

export function AppShell({ layoutSpec, screenSpec, registry, actionHandlers, store }: AppShellProps): React.ReactElement {
  if (!screenSpec) {
    return React.createElement('div', { id: 'rntme-loading' }, 'Loading...');
  }

  return React.createElement(
    StateProvider as React.ComponentType<{ store: StateStore; children: React.ReactNode }>,
    { store },
    React.createElement(
      ActionProvider as React.ComponentType<{ handlers: Record<string, unknown>; children: React.ReactNode }>,
      { handlers: actionHandlers },
      React.createElement(
        VisibilityProvider as React.ComponentType<{ children: React.ReactNode }>,
        null,
        React.createElement(
          'div',
          { id: 'rntme-app', style: { maxWidth: 960, margin: '0 auto', padding: 24 } },
          layoutSpec
            ? React.createElement('div', { id: 'rntme-layout', key: 'layout' },
                React.createElement(Renderer as React.ComponentType<{ spec: CompiledSpec; registry: Record<string, unknown> }>, { spec: layoutSpec, registry }),
              )
            : null,
          React.createElement('div', { id: 'rntme-screen', key: 'screen' },
            React.createElement(Renderer as React.ComponentType<{ spec: CompiledSpec; registry: Record<string, unknown> }>, { spec: screenSpec, registry }),
          ),
        ),
      ),
    ),
  );
}
```

Note: The type casts on provider components may need adjustment based on actual @json-render/react export types. If JSX is available, this can be rewritten more cleanly — check if the tsconfig.json `jsx: "react-jsx"` works with the json-render types.

- [ ] **Step 2: Rewrite entry.tsx**

Rewrite `packages/ui-runtime/src/client/entry.tsx`:

```tsx
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import type { CompiledManifest, CompiledScreen, CompiledSpec, CompiledDataEndpoint } from '@rntme/ui';
import { matchRoute } from './router.js';
import { createScreenLoader } from './screen-loader.js';
import { createStateStore } from './state-store.js';
import { createRegistry } from './registry.js';
import { AppShell } from './layout-manager.js';

function buildUrl(path: string, params?: Record<string, unknown>, stateGetter?: (path: string) => unknown): string {
  let url = path;
  url = url.replace(/\{([^}]+)\}/g, (_, key: string) => {
    const value = params?.[key];
    if (value !== undefined) return String(value);
    return `{${key}}`;
  });

  const queryParams = { ...params };
  for (const m of path.matchAll(/\{([^}]+)\}/g)) {
    delete queryParams[m[1]!];
  }

  for (const [k, v] of Object.entries(queryParams)) {
    if (v && typeof v === 'object' && '$state' in (v as Record<string, unknown>)) {
      queryParams[k] = stateGetter?.((v as { $state: string }).$state);
    }
  }

  const qs = Object.entries(queryParams)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');

  return qs ? `${url}?${qs}` : url;
}

export async function hydrateApp(opts: { rootSelector: string }): Promise<void> {
  const container = document.querySelector(opts.rootSelector);
  if (!container) throw new Error(`hydrateApp: ${opts.rootSelector} not found`);

  const manifestRes = await fetch('/_manifest.json');
  const manifest = (await manifestRes.json()) as CompiledManifest;

  const loader = createScreenLoader();
  const patterns = Object.keys(manifest.routes);
  const store = createStateStore();

  let currentLayout: CompiledScreen | null = null;
  let currentScreen: CompiledScreen | null = null;
  let currentLayoutName: string | null = null;

  async function fetchEndpoint(statePath: string, endpoint: CompiledDataEndpoint): Promise<void> {
    const url = buildUrl(endpoint.path, endpoint.params, (p) => store.get(p));
    store.set(`/data/__status${statePath}`, 'pending');
    try {
      const res = await fetch(url, {
        method: endpoint.method,
        headers: { 'content-type': 'application/json' },
      });
      if (!res.ok) {
        store.set(`/data/__status${statePath}`, 'error');
        store.set(`/data/__error${statePath}`, `HTTP ${res.status}`);
        return;
      }
      const data = await res.json();
      store.set(statePath, data);
      store.set(`/data/__status${statePath}`, 'ok');
    } catch (e) {
      store.set(`/data/__status${statePath}`, 'error');
      store.set(`/data/__error${statePath}`, e instanceof Error ? e.message : String(e));
    }
  }

  const { registry, handlers } = createRegistry({
    onNavigate: (path) => {
      window.history.pushState({}, '', path);
      void enterRoute(path);
    },
    getScreen: () => currentScreen,
    store,
    fetchEndpoint,
  });

  const actionHandlers = handlers(
    () => (updater: (prev: Record<string, unknown>) => Record<string, unknown>) => {
      const next = updater(store.getSnapshot());
      store.update(next);
    },
    () => store.getSnapshot(),
  );

  async function enterRoute(path: string): Promise<void> {
    const match = matchRoute(patterns, path);
    if (!match) return;

    const routeEntry = manifest.routes[match.pattern];
    if (!routeEntry) return;

    for (const [k, v] of Object.entries(match.params)) {
      store.set(`/route/params/${k}`, v);
    }

    if (routeEntry.layout !== currentLayoutName) {
      currentLayout = await loader.loadLayout(routeEntry.layout);
      currentLayoutName = routeEntry.layout;
    }

    currentScreen = await loader.loadScreen(routeEntry.screen);
    rerender();

    // Fetch data for mount-triggered endpoints
    if (currentScreen.data) {
      const fetches = Object.entries(currentScreen.data)
        .filter(([, ep]) => ep.refetchOn?.includes('mount'))
        .map(([statePath, ep]) => fetchEndpoint(statePath, ep));
      await Promise.all(fetches);
    }
  }

  const root = createRoot(container);

  function rerender(): void {
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

  const initialPath = window.location.pathname || '/';
  await enterRoute(initialPath);

  window.addEventListener('popstate', () => {
    void enterRoute(window.location.pathname);
  });
}

void hydrateApp({ rootSelector: '#root' }).catch((err: unknown) => {
  console.error('[rntme ui-runtime]', err);
  const el = document.querySelector('#root');
  if (el) el.textContent = err instanceof Error ? err.message : String(err);
});
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd packages/ui-runtime && pnpm run build 2>&1 | head -40
```

Fix any type errors. The most likely issues are:
- json-render provider component prop types
- `handlers()` function signature

If `handlers()` expects different arguments, adjust based on the actual types from `@json-render/react`.

- [ ] **Step 4: Run existing tests**

```bash
cd packages/ui-runtime && pnpm test -- --reporter=verbose 2>&1 | tail -30
```

The server tests should still pass. The driver tests may need updating since `driver.ts` exports are still used.

Note: The driver module (`driver.ts`) is no longer imported by `entry.tsx` (data fetching is inlined as `fetchEndpoint`, action dispatch is in `registry.ts`). The `driver.ts` module can remain as-is for now — its tests still pass and it can be cleaned up later.

- [ ] **Step 5: Commit**

```bash
git add packages/ui-runtime/src/client/entry.tsx packages/ui-runtime/src/client/layout-manager.tsx
git commit -m "feat(ui-runtime): wire json-render Renderer with StateProvider and shadcn catalog"
```

---

## Task 10: Runtime — CSS + Build Pipeline

**Files:**
- Create: `packages/ui-runtime/src/client/styles.css`
- Modify: `packages/ui-runtime/src/build.ts`

Set up Tailwind CSS 4 for shadcn component styling and update the esbuild config.

- [ ] **Step 1: Create CSS entry file**

Create `packages/ui-runtime/src/client/styles.css`:

```css
@import "tailwindcss";
```

- [ ] **Step 2: Update build.ts**

Rewrite `packages/ui-runtime/src/build.ts`:

```typescript
import { build } from 'esbuild';
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, existsSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const buildDir = join(__dirname, '..', 'build');

if (!existsSync(buildDir)) mkdirSync(buildDir, { recursive: true });

// Build CSS with Tailwind CSS 4
try {
  execSync(
    `npx @tailwindcss/cli -i ${join(__dirname, 'client', 'styles.css')} -o ${join(buildDir, 'main.css')} --minify`,
    { stdio: 'inherit' },
  );
  console.log('CSS built → build/main.css');
} catch {
  console.warn('Tailwind CSS build failed — generating empty main.css');
  const { writeFileSync } = await import('node:fs');
  writeFileSync(join(buildDir, 'main.css'), '/* tailwind css build failed */\n');
}

// Build JS with esbuild
await build({
  entryPoints: [join(__dirname, 'client', 'entry.tsx')],
  outfile: join(buildDir, 'main.js'),
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  sourcemap: true,
  external: [],
});

console.log('JS built → build/main.js');
```

- [ ] **Step 3: Test the build**

```bash
cd packages/ui-runtime && pnpm run build:client 2>&1
```

Expected: both main.css and main.js are generated in build/ without errors.

If `@tailwindcss/cli` is not found, install it:
```bash
cd packages/ui-runtime && pnpm add -D @tailwindcss/cli@^4.0.0
```

- [ ] **Step 4: Verify build output exists**

```bash
ls -la packages/ui-runtime/build/
```

Expected: `main.js`, `main.js.map`, `main.css` all present.

- [ ] **Step 5: Commit**

```bash
git add packages/ui-runtime/src/client/styles.css packages/ui-runtime/src/build.ts
git commit -m "feat(ui-runtime): add Tailwind CSS 4 build pipeline for shadcn components"
```

---

## Task 11: Runtime — Update Test Fixtures

**Files:**
- Modify: `packages/ui-runtime/test/fixtures/compiled-screen.ts`

Update the test layout fixture to remove the Slot element (matching the new design).

- [ ] **Step 1: Update compiled-screen fixture**

Edit `packages/ui-runtime/test/fixtures/compiled-screen.ts`:

```typescript
import type { CompiledScreen } from '@rntme/ui';

export const testLayout: CompiledScreen = {
  spec: {
    root: 'shell',
    elements: {
      shell: { type: 'Stack', props: { direction: 'vertical', gap: 'lg' }, children: ['header'] },
      header: { type: 'Heading', props: { level: 1, text: 'Test App' } },
    },
  },
};

export const testScreen: CompiledScreen = {
  spec: {
    root: 'page',
    elements: {
      page: { type: 'Heading', props: { level: 1, text: 'Home' } },
    },
  },
};
```

- [ ] **Step 2: Run all runtime tests**

```bash
cd packages/ui-runtime && pnpm test -- --reporter=verbose 2>&1 | tail -30
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add packages/ui-runtime/test/fixtures/
git commit -m "fix(ui-runtime): update test fixtures to match v2 layout format (no Slot)"
```

---

## Task 12: End-to-End Verification

**Files:**
- Build and test all packages
- Start demo server and verify in browser

- [ ] **Step 1: Build all packages**

```bash
pnpm -r run build 2>&1 | tail -30
```

Expected: all packages build without errors.

- [ ] **Step 2: Run all tests across the workspace**

```bash
pnpm -r run test 2>&1 | tail -40
```

Expected: all tests pass across all packages.

- [ ] **Step 3: Start the demo server**

```bash
cd demo/issue-tracker-api && pnpm start &
sleep 3
```

Expected: server starts and loads artifacts.

- [ ] **Step 4: Verify manifest endpoint**

```bash
curl -s http://localhost:3000/_manifest.json | head -20
```

Expected: JSON with `version: "2.0"` and 6 routes.

- [ ] **Step 5: Verify screen endpoint**

```bash
curl -s http://localhost:3000/_screens/issues-home.json | head -20
```

Expected: JSON with compiled spec (repeat elements, no $ref/$param).

- [ ] **Step 6: Verify HTML shell loads**

```bash
curl -s http://localhost:3000/ | head -10
```

Expected: HTML with `<div id="root">`, `main.js`, `main.css` links.

- [ ] **Step 7: Verify API bindings at /api**

```bash
curl -s http://localhost:3000/api/v1/stats/by-project | head -5
```

Expected: JSON array of project stats.

- [ ] **Step 8: Stop the demo server**

```bash
kill %1 2>/dev/null || true
```

- [ ] **Step 9: Fix any issues found**

If endpoints fail, check:
- `http-surface.ts` — is the v2 path being taken? (`compiledUi` should be non-null)
- Are assets being served? (`/assets/main.js`)
- Does the client bundle load without console errors?

- [ ] **Step 10: Final commit**

```bash
git add -A
git commit -m "feat(demo): end-to-end v2 UI with json-render/shadcn runtime"
```

---

## Discovered Scope

### $template with $item

The `$template` expression uses `${/json/pointer/path}` syntax for state paths. Inside a `repeat` scope, accessing item fields via `$template` may use `${$item.fieldName}` syntax — verify this works with json-render 0.17. If `$template` cannot reference `$item` fields, replace with `$computed` or restructure to use separate `Text` + `Badge` elements with `$item` props.

### json-render Provider Type Compatibility

The exact TypeScript types for `StateProvider`, `ActionProvider`, `VisibilityProvider`, and `Renderer` from `@json-render/react` may differ from the types used in Task 9. If the cast approach doesn't work, check if:
- JSX syntax works better than `React.createElement`
- The providers accept generic `children` props
- The store interface matches json-render's expected `StateStore`

### driver.ts Cleanup

After Task 9, `driver.ts` is no longer imported by `entry.tsx` — data fetching is inlined and action dispatch moved to `registry.ts`. The module and its tests remain for now. It can be removed or kept as a standalone utility in a follow-up.
