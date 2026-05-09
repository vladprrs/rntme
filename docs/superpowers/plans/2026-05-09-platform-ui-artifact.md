# Platform UI Artifact Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the current simple platform UI into rntme UI artifacts under the platform blueprint and validate the UI through `@rntme/blueprint` composition.

**Architecture:** The platform UI becomes a JSON UI artifact mounted from the platform blueprint, using generated binding IDs for reads and actions. This is a functional migration, not a redesign. Existing Hono JSX pages in `apps/platform-http/src/ui/**` remain as reference until runtime cutover.

**Tech Stack:** `@rntme/ui` artifact v2, `@rntme/ui-runtime`, `@rntme/blueprint`, JSON UI specs, Vitest, optional Playwright/browser smoke in cutover.

---

## Scope Boundary

This plan depends on the foundation, Auth0, and deployments-service plans. It adds UI authoring artifacts and composition tests. It does not remove Hono JSX UI or make the new UI the hosted platform.

## File Structure

- Modify `apps/platform/blueprint/project.json` — add `routes.ui` and `ui:/` mount.
- Create `apps/platform/blueprint/services/app/service.json` — UI host domain service.
- Create `apps/platform/blueprint/services/app/ui/manifest.json`.
- Create `apps/platform/blueprint/services/app/ui/layouts/main.{spec,screen}.json`.
- Create screen files under `apps/platform/blueprint/services/app/ui/screens/*.json`.
- Create fragments under `apps/platform/blueprint/services/app/ui/fragments/*.spec.json`.
- Create `apps/platform/blueprint/test/platform-ui.test.ts`.
- Modify `docs/current/owners/apps/platform.md`.

## Page Coverage

Port these current pages:

- `/login`
- `/no-org`
- `/:orgSlug`
- `/:orgSlug/projects/:projectId`
- `/:orgSlug/projects/:projectId/versions/:versionId`
- `/:orgSlug/deploy-targets`
- `/:orgSlug/deployments`
- `/:orgSlug/deployments/:deploymentId`
- `/:orgSlug/tokens`
- `/:orgSlug/audit`

Use IDs rather than slugs where the new API surface uses IDs. Breaking API and route changes are allowed.

## Tasks

### Task 1: Add UI Host Service And Route

**Files:**
- Create: `apps/platform/blueprint/services/app/service.json`
- Modify: `apps/platform/blueprint/project.json`

- [ ] **Step 1: Add app service descriptor**

Create `apps/platform/blueprint/services/app/service.json`:

```json
{ "kind": "domain" }
```

- [ ] **Step 2: Add app service to project**

In `apps/platform/blueprint/project.json`:

- add `"app"` to `services`;
- add `routes.ui` with `"/": "app"`;
- add mount `{ "target": "ui:/", "use": ["requestContext"] }`.

Expected merged shape:

```json
{
  "routes": {
    "ui": {
      "/": "app"
    }
  },
  "mounts": [
    { "target": "ui:/", "use": ["requestContext"] }
  ]
}
```

- [ ] **Step 3: Run expected failing composition**

Run:

```bash
pnpm -F @rntme/blueprint test -- ../../apps/platform/blueprint/test/platform-blueprint.test.ts
```

Expected: PASS because UI artifacts are optional until `services/app/ui/manifest.json` exists.

- [ ] **Step 4: Commit**

```bash
git add apps/platform/blueprint/project.json apps/platform/blueprint/services/app/service.json
git commit -m "feat(platform): add platform UI host service"
```

### Task 2: Add UI Manifest And Main Layout

**Files:**
- Create: `apps/platform/blueprint/services/app/ui/manifest.json`
- Create: `apps/platform/blueprint/services/app/ui/layouts/main.screen.json`
- Create: `apps/platform/blueprint/services/app/ui/layouts/main.spec.json`

- [ ] **Step 1: Create manifest**

Create `apps/platform/blueprint/services/app/ui/manifest.json`:

```json
{
  "version": "2.0",
  "pdmRef": "platform.domain.v1",
  "qsmRef": "platform.read.v1",
  "graphSpecRef": "platform.graphs.v1",
  "bindingsRef": "platform.bindings.v1",
  "metadata": { "title": "rntme Platform" },
  "layouts": {
    "main": "layouts/main"
  },
  "routes": {
    "/login": { "layout": "main", "screen": "screens/login" },
    "/no-org": { "layout": "main", "screen": "screens/no-org" },
    "/:orgId": { "layout": "main", "screen": "screens/org" },
    "/:orgId/projects/:projectId": { "layout": "main", "screen": "screens/project" },
    "/:orgId/projects/:projectId/versions/:versionId": { "layout": "main", "screen": "screens/project-version" },
    "/:orgId/deploy-targets": { "layout": "main", "screen": "screens/deploy-targets" },
    "/:orgId/deployments": { "layout": "main", "screen": "screens/deployments" },
    "/:orgId/deployments/:deploymentId": { "layout": "main", "screen": "screens/deployment" },
    "/:orgId/tokens": { "layout": "main", "screen": "screens/tokens" },
    "/:orgId/audit": { "layout": "main", "screen": "screens/audit" }
  }
}
```

- [ ] **Step 2: Create layout screen descriptor**

Create `apps/platform/blueprint/services/app/ui/layouts/main.screen.json`:

```json
{
  "metadata": { "title": "Platform Layout" }
}
```

- [ ] **Step 3: Create layout spec**

Create `apps/platform/blueprint/services/app/ui/layouts/main.spec.json`:

```json
{
  "root": "shell",
  "elements": {
    "shell": {
      "type": "Card",
      "props": { "className": "min-h-screen rounded-none border-0 shadow-none" },
      "children": ["header", "content"]
    },
    "header": {
      "type": "Heading",
      "props": { "level": 1, "text": "rntme Platform" }
    },
    "content": {
      "type": "Slot",
      "props": {}
    }
  }
}
```

- [ ] **Step 4: Run UI package fixture tests**

Run:

```bash
pnpm -F @rntme/ui test
```

Expected: existing UI tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/platform/blueprint/services/app/ui/manifest.json apps/platform/blueprint/services/app/ui/layouts
git commit -m "feat(platform): add platform UI shell artifact"
```

### Task 3: Add Read-Only Browse Screens

**Files:**
- Create: `apps/platform/blueprint/services/app/ui/screens/org.screen.json`
- Create: `apps/platform/blueprint/services/app/ui/screens/org.spec.json`
- Create: `apps/platform/blueprint/services/app/ui/screens/project.screen.json`
- Create: `apps/platform/blueprint/services/app/ui/screens/project.spec.json`
- Create: `apps/platform/blueprint/services/app/ui/screens/deployments.screen.json`
- Create: `apps/platform/blueprint/services/app/ui/screens/deployments.spec.json`
- Create: `apps/platform/blueprint/services/app/ui/screens/audit.screen.json`
- Create: `apps/platform/blueprint/services/app/ui/screens/audit.spec.json`

- [ ] **Step 1: Create organization screen descriptor**

Create `org.screen.json`:

```json
{
  "metadata": { "title": "Organization" },
  "data": {
    "/data/projects": {
      "binding": "projects.listProjects",
      "params": {
        "organizationId": { "$state": "/route/params/orgId" },
        "limit": 100
      },
      "refetchOn": ["mount", "params"]
    }
  }
}
```

- [ ] **Step 2: Create organization screen spec**

Create `org.spec.json`:

```json
{
  "root": "page",
  "elements": {
    "page": { "type": "Card", "props": { "className": "space-y-4" }, "children": ["title", "projects"] },
    "title": { "type": "Heading", "props": { "level": 2, "text": "Projects" } },
    "projects": {
      "type": "DataTable",
      "props": {
        "statePath": "/data/projects",
        "columns": [
          { "key": "slug", "label": "Slug" },
          { "key": "displayName", "label": "Name" },
          { "key": "status", "label": "Status" }
        ]
      }
    }
  }
}
```

- [ ] **Step 3: Create project/deployments/audit screen descriptors**

Use the same descriptor pattern with these bindings:

```json
{
  "project": {
    "/data/versions": {
      "binding": "projects.listProjectVersions",
      "params": { "projectId": { "$state": "/route/params/projectId" }, "limit": 100 },
      "refetchOn": ["mount", "params"]
    }
  },
  "deployments": {
    "/data/deployments": {
      "binding": "deployments.listDeployments",
      "params": {
        "organizationId": { "$state": "/route/params/orgId" },
        "projectId": { "$state": "/route/params/projectId" },
        "limit": 100
      },
      "refetchOn": ["mount", "params"]
    }
  },
  "audit": {
    "/data/events": {
      "binding": "audit.listAuditEvents",
      "params": { "organizationId": { "$state": "/route/params/orgId" }, "limit": 100 },
      "refetchOn": ["mount", "params"]
    }
  }
}
```

- [ ] **Step 4: Create project/deployments/audit specs**

For each screen, use a `Heading` and `DataTable` spec like `org.spec.json`, with table `statePath` matching its descriptor key.

- [ ] **Step 5: Run composition**

Run:

```bash
pnpm -F @rntme/blueprint test -- ../../apps/platform/blueprint/test/platform-blueprint.test.ts
```

Expected: composition validates UI binding references and resolves `DataTable`. If the command reports `UNKNOWN_COMPONENT_TYPE` for `DataTable`, run Task 3A next and then rerun this step.

- [ ] **Step 6: Commit**

```bash
git add apps/platform/blueprint/services/app/ui/screens
git commit -m "feat(platform): add platform browse UI screens"
```

### Task 3A: Add Core DataTable Primitive When Missing

**Files:**
- Modify: `packages/runtime/ui-runtime/src/client/registry.ts`
- Create: `packages/runtime/ui-runtime/test/unit/data-table.test.ts`

- [ ] **Step 1: Write failing catalog test**

Create `packages/runtime/ui-runtime/test/unit/data-table.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createRegistry } from '../../src/client/registry.js';

describe('DataTable catalog primitive', () => {
  it('registers DataTable as a core component', () => {
    const bridge = {
      onNavigate: () => undefined,
      getScreen: () => null,
      store: { get: () => undefined, set: () => undefined, subscribe: () => () => undefined },
      fetchEndpoint: async () => undefined,
      fetchFn: fetch,
    };
    const { registry } = createRegistry(bridge as never);
    expect(registry).toBeDefined();
  });
});
```

- [ ] **Step 2: Add DataTable component registration**

In `packages/runtime/ui-runtime/src/client/registry.ts`, define a local React component before `createRegistry`:

```ts
function DataTable(props: { statePath?: string; columns?: ReadonlyArray<{ key: string; label: string }> }) {
  return React.createElement('div', { 'data-rntme-component': 'DataTable', 'data-state-path': props.statePath ?? '' });
}
```

Then add `DataTable` to the catalog definitions and React components:

```ts
const coreDefs = {
  DataTable: {
    props: z.object({
      statePath: z.string().optional(),
      columns: z.array(z.object({ key: z.string(), label: z.string() })).optional(),
    }),
  },
} as const;
const coreReact = { DataTable };
```

Merge them in `defineCatalog` and `defineRegistry`:

```ts
components: { ...shadcnComponentDefinitions, ...coreDefs, ...(extraDefs as typeof shadcnComponentDefinitions) }
```

```ts
components: { ...shadcnComponents, ...coreReact, ...extraReact }
```

- [ ] **Step 3: Run runtime tests**

Run:

```bash
pnpm -F @rntme/ui-runtime test -- test/unit/data-table.test.ts
pnpm -F @rntme/ui-runtime typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/runtime/ui-runtime/src/client/registry.ts packages/runtime/ui-runtime/test/unit/data-table.test.ts
git commit -m "feat(ui-runtime): add DataTable core primitive"
```

### Task 4: Add Action Screens For Tokens And Deployments

**Files:**
- Create: `apps/platform/blueprint/services/app/ui/screens/tokens.screen.json`
- Create: `apps/platform/blueprint/services/app/ui/screens/tokens.spec.json`
- Create: `apps/platform/blueprint/services/app/ui/screens/deployment.screen.json`
- Create: `apps/platform/blueprint/services/app/ui/screens/deployment.spec.json`
- Create: `apps/platform/blueprint/services/app/ui/screens/project-version.screen.json`
- Create: `apps/platform/blueprint/services/app/ui/screens/project-version.spec.json`
- Create: `apps/platform/blueprint/services/app/ui/screens/deploy-targets.screen.json`
- Create: `apps/platform/blueprint/services/app/ui/screens/deploy-targets.spec.json`

- [ ] **Step 1: Create tokens screen descriptor**

Create `tokens.screen.json`:

```json
{
  "metadata": { "title": "API Tokens" },
  "data": {
    "/data/tokens": {
      "binding": "tokens.listTokens",
      "params": { "organizationId": { "$state": "/route/params/orgId" }, "limit": 100 },
      "refetchOn": ["mount", "params"]
    }
  },
  "actions": {
    "createToken": {
      "kind": "command",
      "binding": "tokens.createToken",
      "paramsFromState": {
        "organizationId": "/route/params/orgId",
        "name": "/form/token/name",
        "scopesJson": "/form/token/scopesJson"
      },
      "onSuccess": {
        "refetchData": ["/data/tokens"],
        "clearFormState": ["/form/token"]
      }
    },
    "revokeToken": {
      "kind": "command",
      "binding": "tokens.revokeToken",
      "paramsFromState": {
        "id": "/actions/revokeToken/id",
        "revokedAt": "/actions/revokeToken/revokedAt"
      },
      "onSuccess": { "refetchData": ["/data/tokens"] }
    }
  }
}
```

- [ ] **Step 2: Create tokens spec**

Create `tokens.spec.json` with a heading, input fields for token name/scopes, a create button dispatching `createToken`, and a table bound to `/data/tokens`. Use existing json-render actions:

```json
{
  "root": "page",
  "elements": {
    "page": { "type": "Card", "props": { "className": "space-y-4" }, "children": ["title", "name", "scopes", "create", "tokens"] },
    "title": { "type": "Heading", "props": { "level": 2, "text": "API Tokens" } },
    "name": { "type": "Input", "props": { "statePath": "/form/token/name", "placeholder": "Token name" } },
    "scopes": { "type": "Input", "props": { "statePath": "/form/token/scopesJson", "placeholder": "[\"project:read\"]" } },
    "create": { "type": "Button", "props": { "label": "Create" }, "on": { "click": { "action": "createToken" } } },
    "tokens": {
      "type": "DataTable",
      "props": {
        "statePath": "/data/tokens",
        "columns": [
          { "key": "name", "label": "Name" },
          { "key": "prefix", "label": "Prefix" },
          { "key": "status", "label": "Status" }
        ]
      }
    }
  }
}
```

- [ ] **Step 3: Create deployment detail screen**

Create `deployment.screen.json`:

```json
{
  "metadata": { "title": "Deployment" },
  "data": {
    "/data/deployment": {
      "binding": "deployments.getDeployment",
      "params": { "id": { "$state": "/route/params/deploymentId" } },
      "refetchOn": ["mount", "params"]
    },
    "/data/logs": {
      "binding": "deployments.readDeploymentLogs",
      "params": { "deploymentId": { "$state": "/route/params/deploymentId" }, "limit": 200 },
      "refetchOn": ["mount", "params"]
    }
  },
  "actions": {
    "refreshDeployment": { "kind": "refetch", "targets": ["/data/deployment", "/data/logs"] }
  }
}
```

Create `deployment.spec.json` with `Heading`, a refresh `Button`, and two `DataTable`/text blocks bound to `/data/deployment` and `/data/logs`.

- [ ] **Step 4: Create project-version and deploy-targets screens**

Create descriptors using:

- `project-version.screen.json`: action `queueDeployment` bound to `deployments.queueDeployment`.
- `deploy-targets.screen.json`: data `deployments.listDeployTargets`, action `deployments.createDeployTarget`.

Use the same `command` action and `refetchData` shapes shown in `tokens.screen.json`.

- [ ] **Step 5: Run focused UI composition**

Run:

```bash
pnpm -F @rntme/blueprint test -- ../../apps/platform/blueprint/test/platform-blueprint.test.ts
```

Expected: UI validation passes or reports exact missing binding/component names.

- [ ] **Step 6: Commit**

```bash
git add apps/platform/blueprint/services/app/ui/screens
git commit -m "feat(platform): add platform action UI screens"
```

### Task 5: Add Login, No-Org, And Error Screens

**Files:**
- Create: `apps/platform/blueprint/services/app/ui/screens/login.screen.json`
- Create: `apps/platform/blueprint/services/app/ui/screens/login.spec.json`
- Create: `apps/platform/blueprint/services/app/ui/screens/no-org.screen.json`
- Create: `apps/platform/blueprint/services/app/ui/screens/no-org.spec.json`

- [ ] **Step 1: Create login descriptor**

Create `login.screen.json`:

```json
{ "metadata": { "title": "Login" } }
```

- [ ] **Step 2: Create login spec**

Create `login.spec.json`:

```json
{
  "root": "page",
  "elements": {
    "page": { "type": "Card", "props": { "className": "space-y-4" }, "children": ["title", "login"] },
    "title": { "type": "Heading", "props": { "level": 2, "text": "Sign in" } },
    "login": { "type": "LoginScreen", "props": {} }
  }
}
```

- [ ] **Step 3: Create no-org descriptor and spec**

Create `no-org.screen.json`:

```json
{ "metadata": { "title": "No Organization" } }
```

Create `no-org.spec.json`:

```json
{
  "root": "page",
  "elements": {
    "page": { "type": "Card", "props": { "className": "space-y-4" }, "children": ["title", "body"] },
    "title": { "type": "Heading", "props": { "level": 2, "text": "No organization" } },
    "body": { "type": "Text", "props": { "text": "Your account is not linked to an organization." } }
  }
}
```

- [ ] **Step 4: Run composition**

Run:

```bash
pnpm -F @rntme/blueprint test -- ../../apps/platform/blueprint/test/platform-blueprint.test.ts
```

Expected: PASS. A `LoginScreen` resolution failure means the Auth0 manifest from the identity plan is missing; restore `apps/platform/blueprint/node_modules/rntme_identity_auth0/module.json` and rerun.

- [ ] **Step 5: Commit**

```bash
git add apps/platform/blueprint/services/app/ui/screens/login.* apps/platform/blueprint/services/app/ui/screens/no-org.*
git commit -m "feat(platform): add platform auth state screens"
```

### Task 6: Add UI Composition Test

**Files:**
- Create: `apps/platform/blueprint/test/platform-ui.test.ts`

- [ ] **Step 1: Write UI test**

Create `apps/platform/blueprint/test/platform-ui.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadComposedBlueprint } from '@rntme/blueprint';

const here = dirname(fileURLToPath(import.meta.url));
const blueprintRoot = join(here, '..');

describe('platform UI artifact', () => {
  it('compiles platform UI routes against platform bindings', async () => {
    const result = await loadComposedBlueprint(blueprintRoot);
    expect(result.ok, result.ok ? '' : JSON.stringify(result.errors, null, 2)).toBe(true);
    if (!result.ok) return;

    const ui = result.value.services.app?.compiledUi;
    expect(ui).toBeDefined();
    expect(ui?.manifest.routes['/:orgId']).toMatchObject({ screen: 'org' });
    expect(ui?.manifest.routes['/:orgId/deployments/:deploymentId']).toMatchObject({ screen: 'deployment' });
    expect(ui?.screens.org?.data?.['/data/projects']?.path).toBe('/api/projects/');
    expect(ui?.screens.deployment?.data?.['/data/logs']?.path).toBe('/api/deployments/{deploymentId}/logs');
  });
});
```

- [ ] **Step 2: Run UI test**

Run:

```bash
pnpm -F @rntme/blueprint test -- ../../apps/platform/blueprint/test/platform-ui.test.ts
```

Expected: PASS with the exact paths asserted in the test.

- [ ] **Step 3: Run UI packages**

Run:

```bash
pnpm -F @rntme/ui test
pnpm -F @rntme/ui-runtime test
pnpm -F @rntme/blueprint test -- ../../apps/platform/blueprint/test/platform-ui.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/platform/blueprint/test/platform-ui.test.ts apps/platform/blueprint/services/app/ui
git commit -m "test(platform): validate platform UI artifact"
```

### Task 7: Documentation Touch

**Files:**
- Modify: `docs/current/owners/apps/platform.md`

- [ ] **Step 1: Add UI section**

Add:

```md
## UI

The platform UI is authored as `@rntme/ui` artifacts under
`apps/platform/blueprint/services/app/ui`. The UI is a functional port of the
legacy Hono JSX platform UI and reads/mutates state through platform blueprint
bindings. `apps/platform-http/src/ui/**` remains legacy reference code until
runtime cutover.
```

- [ ] **Step 2: Final verification**

Run:

```bash
pnpm -F @rntme/blueprint test -- ../../apps/platform/blueprint/test/platform-ui.test.ts
pnpm -F @rntme/ui test
pnpm -F @rntme/ui-runtime test
pnpm depcruise
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add docs/current/owners/apps/platform.md
git commit -m "docs(platform): document platform UI artifact"
```
