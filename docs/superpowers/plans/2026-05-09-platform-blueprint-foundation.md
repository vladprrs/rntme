# Platform Blueprint Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the first validating rntme blueprint for the platform at `apps/platform/blueprint`, covering organizations, projects, project versions, tokens, and audit read/action surfaces without cutting over the running platform.

**Architecture:** This slice adds a blueprint-only platform project and validates it through existing `@rntme/blueprint` composition. It keeps `apps/platform-http` as the active runtime and uses the current platform domain as source material, but the new blueprint becomes the target domain/API shape for later plans. The first service split is explicit: `organizations`, `projects`, `tokens`, and `audit`; `deployments` is added in the deploy plan.

**Tech Stack:** TypeScript, JSON rntme artifacts, `@rntme/blueprint`, `@rntme/pdm`, `@rntme/qsm`, `@rntme/bindings`, `@rntme/graph-ir-compiler`, Vitest, pnpm.

---

## Scope Boundary

This plan creates and validates platform authoring artifacts only. It does not modify `apps/platform-http` routes, auth behavior, deployment execution, or CLI behavior.

## File Structure

- Create `apps/platform/README.md` — short app stub pointing to owner docs.
- Create `docs/current/owners/apps/platform.md` — current owner doc for the platform blueprint app.
- Create `apps/platform/blueprint/project.json` — project routing and service declarations.
- Create `apps/platform/blueprint/pdm/pdm.json` and `pdm/entities/*.json` — platform domain entities.
- Create `apps/platform/blueprint/services/{organizations,projects,tokens,audit}/service.json` — domain service declarations.
- Create each service `qsm/qsm.json` — initial read-side projection metadata.
- Create each service `graphs/shapes.json` and operation graph JSON files — platform reads/actions.
- Create each service `bindings/bindings.json` — generated API surface under `/api/<service>`.
- Create `apps/platform/blueprint/test/platform-blueprint.test.ts` — local validation test for this blueprint.
- Modify `AGENTS.md` — add `apps/platform/README.md` to the Apps lookup table once the README exists.

## Domain Cut For This Slice

Start with these entities and service owners:

| Entity | Owner service | Purpose |
| --- | --- | --- |
| `Organization` | `organizations` | Tenant identity and display metadata. |
| `Account` | `organizations` | Human or machine principal mirror. |
| `Membership` | `organizations` | Account-to-organization role/scopes mirror. |
| `Project` | `projects` | Project metadata and lifecycle state. |
| `ProjectVersion` | `projects` | Immutable published bundle metadata. |
| `ApiToken` | `tokens` | Machine token metadata, prefix, scopes, revocation state. |
| `AuditEvent` | `audit` | Append-only inspectable audit stream. |

Do not add `Deployment`, `DeployTarget`, or `ProjectOperation` in this plan. Those belong to `2026-05-09-platform-deployments-service.md`.

## Tasks

### Task 1: Add Platform App Stub And Navigation

**Files:**
- Create: `apps/platform/README.md`
- Create: `docs/current/owners/apps/platform.md`
- Modify: `AGENTS.md`

- [ ] **Step 1: Create the app README stub**

Create `apps/platform/README.md`:

```md
# @rntme/platform

Platform-as-blueprint authoring surface for the rntme control plane.

Current documentation: [docs/current/owners/apps/platform.md](../../docs/current/owners/apps/platform.md)

Local commands:
- `pnpm -F @rntme/blueprint test -- apps/platform/blueprint/test/platform-blueprint.test.ts`

Notes:
- Keep this file short. Update the current doc when public API, invariants, gotchas, local commands, or package navigation changes.
```

- [ ] **Step 2: Create the owner doc**

Create `docs/current/owners/apps/platform.md`:

```md
# @rntme/platform

Platform-as-blueprint authoring surface for the rntme control plane. The source
of truth lives under `apps/platform/blueprint` and is loaded with
`@rntme/blueprint`.

## Role in the system

- Depends on rntme artifact packages through validation and composition.
- Consumed by future platform runtime cutover work.
- Does not replace `apps/platform-http` until the cutover plan lands.

## Blueprint layout

- `project.json`
- `pdm/pdm.json` and `pdm/entities/*.json`
- `services/organizations`
- `services/projects`
- `services/tokens`
- `services/audit`

## Invariants

- This app owns authoring artifacts only in the foundation slice.
- `apps/platform-http` remains the active hosted platform until cutover.
- Deployment entities are intentionally absent until the deployments-service plan.

## Where to look first

- `apps/platform/blueprint/project.json`
- `apps/platform/blueprint/test/platform-blueprint.test.ts`

## Specs

- [`../../superpowers/specs/2026-05-09-platform-as-blueprint-design.md`](/docs/superpowers/specs/2026-05-09-platform-as-blueprint-design.md)
```

- [ ] **Step 3: Add AGENTS navigation**

In `AGENTS.md`, in the Apps row of the Package Lookup table, add `apps/platform/README.md` after `apps/platform-http/README.md`.

- [ ] **Step 4: Verify navigation text**

Run:

```bash
rg -n "apps/platform/README.md|@rntme/platform" AGENTS.md apps/platform/README.md docs/current/owners/apps/platform.md
```

Expected: output includes all three files.

- [ ] **Step 5: Commit**

```bash
git add AGENTS.md apps/platform/README.md docs/current/owners/apps/platform.md
git commit -m "docs: add platform blueprint navigation"
```

### Task 2: Add Platform Project Skeleton

**Files:**
- Create: `apps/platform/blueprint/project.json`
- Create: `apps/platform/blueprint/services/organizations/service.json`
- Create: `apps/platform/blueprint/services/projects/service.json`
- Create: `apps/platform/blueprint/services/tokens/service.json`
- Create: `apps/platform/blueprint/services/audit/service.json`

- [ ] **Step 1: Create service descriptors**

Create each service descriptor with the same content:

```json
{ "kind": "domain" }
```

Paths:

```text
apps/platform/blueprint/services/organizations/service.json
apps/platform/blueprint/services/projects/service.json
apps/platform/blueprint/services/tokens/service.json
apps/platform/blueprint/services/audit/service.json
```

- [ ] **Step 2: Create project.json**

Create `apps/platform/blueprint/project.json`:

```json
{
  "name": "rntme-platform",
  "services": ["organizations", "projects", "tokens", "audit"],
  "routes": {
    "http": {
      "/api/organizations": "organizations",
      "/api/projects": "projects",
      "/api/tokens": "tokens",
      "/api/audit": "audit"
    }
  },
  "middleware": {
    "requestContext": { "kind": "request-context" }
  },
  "mounts": [
    { "target": "http:/api/organizations", "use": ["requestContext"] },
    { "target": "http:/api/projects", "use": ["requestContext"] },
    { "target": "http:/api/tokens", "use": ["requestContext"] },
    { "target": "http:/api/audit", "use": ["requestContext"] }
  ]
}
```

- [ ] **Step 3: Run structural smoke and capture expected failure**

Run:

```bash
pnpm -F @rntme/blueprint test -- test/unit/load-blueprint.test.ts
```

Expected: existing package tests pass. The new platform blueprint is not loaded by package tests yet.

- [ ] **Step 4: Commit**

```bash
git add apps/platform/blueprint/project.json apps/platform/blueprint/services/*/service.json
git commit -m "feat(platform): add platform blueprint skeleton"
```

### Task 3: Add PDM Entities

**Files:**
- Create: `apps/platform/blueprint/pdm/pdm.json`
- Create: `apps/platform/blueprint/pdm/entities/Organization.json`
- Create: `apps/platform/blueprint/pdm/entities/Account.json`
- Create: `apps/platform/blueprint/pdm/entities/Membership.json`
- Create: `apps/platform/blueprint/pdm/entities/Project.json`
- Create: `apps/platform/blueprint/pdm/entities/ProjectVersion.json`
- Create: `apps/platform/blueprint/pdm/entities/ApiToken.json`
- Create: `apps/platform/blueprint/pdm/entities/AuditEvent.json`

- [ ] **Step 1: Create PDM root**

Create `apps/platform/blueprint/pdm/pdm.json`:

```json
{ "version": "1" }
```

- [ ] **Step 2: Create Organization entity**

Create `apps/platform/blueprint/pdm/entities/Organization.json`:

```json
{
  "ownerService": "organizations",
  "kind": "owned",
  "table": "organizations",
  "fields": {
    "id": { "type": "string", "nullable": false, "column": "id" },
    "slug": { "type": "string", "nullable": false, "column": "slug" },
    "displayName": { "type": "string", "nullable": false, "column": "display_name" },
    "status": { "type": "string", "nullable": false, "column": "status" },
    "createdAt": { "type": "datetime", "nullable": false, "column": "created_at", "generated": "createdAt" }
  },
  "keys": ["id"],
  "stateMachine": {
    "stateField": "status",
    "initial": null,
    "states": ["active", "archived"],
    "transitions": {
      "create": { "from": null, "to": "active", "affects": ["slug", "displayName"] },
      "rename": { "from": "active", "to": "active", "affects": ["displayName"] },
      "archive": { "from": "active", "to": "archived" }
    }
  }
}
```

- [ ] **Step 3: Create Account entity**

Create `apps/platform/blueprint/pdm/entities/Account.json`:

```json
{
  "ownerService": "organizations",
  "kind": "owned",
  "table": "accounts",
  "fields": {
    "id": { "type": "string", "nullable": false, "column": "id" },
    "identityProvider": { "type": "string", "nullable": false, "column": "identity_provider" },
    "identitySubject": { "type": "string", "nullable": false, "column": "identity_subject" },
    "email": { "type": "string", "nullable": true, "column": "email" },
    "displayName": { "type": "string", "nullable": true, "column": "display_name" },
    "status": { "type": "string", "nullable": false, "column": "status" },
    "createdAt": { "type": "datetime", "nullable": false, "column": "created_at", "generated": "createdAt" }
  },
  "keys": ["id"],
  "stateMachine": {
    "stateField": "status",
    "initial": null,
    "states": ["active", "disabled"],
    "transitions": {
      "create": { "from": null, "to": "active", "affects": ["identityProvider", "identitySubject", "email", "displayName"] },
      "updateProfile": { "from": "active", "to": "active", "affects": ["email", "displayName"] },
      "disable": { "from": "active", "to": "disabled" }
    }
  }
}
```

- [ ] **Step 4: Create Membership entity**

Create `apps/platform/blueprint/pdm/entities/Membership.json`:

```json
{
  "ownerService": "organizations",
  "kind": "owned",
  "table": "memberships",
  "fields": {
    "id": { "type": "string", "nullable": false, "column": "id" },
    "organizationId": { "type": "string", "nullable": false, "column": "organization_id" },
    "accountId": { "type": "string", "nullable": false, "column": "account_id" },
    "role": { "type": "string", "nullable": false, "column": "role" },
    "scopesJson": { "type": "json", "nullable": false, "column": "scopes_json" },
    "status": { "type": "string", "nullable": false, "column": "status" },
    "createdAt": { "type": "datetime", "nullable": false, "column": "created_at", "generated": "createdAt" }
  },
  "keys": ["id"],
  "stateMachine": {
    "stateField": "status",
    "initial": null,
    "states": ["active", "revoked"],
    "transitions": {
      "create": { "from": null, "to": "active", "affects": ["organizationId", "accountId", "role", "scopesJson"] },
      "changeRole": { "from": "active", "to": "active", "affects": ["role", "scopesJson"] },
      "revoke": { "from": "active", "to": "revoked" }
    }
  }
}
```

- [ ] **Step 5: Create Project entity**

Create `apps/platform/blueprint/pdm/entities/Project.json`:

```json
{
  "ownerService": "projects",
  "kind": "owned",
  "table": "projects",
  "fields": {
    "id": { "type": "string", "nullable": false, "column": "id" },
    "organizationId": { "type": "string", "nullable": false, "column": "organization_id" },
    "slug": { "type": "string", "nullable": false, "column": "slug" },
    "displayName": { "type": "string", "nullable": false, "column": "display_name" },
    "status": { "type": "string", "nullable": false, "column": "status" },
    "createdAt": { "type": "datetime", "nullable": false, "column": "created_at", "generated": "createdAt" }
  },
  "keys": ["id"],
  "stateMachine": {
    "stateField": "status",
    "initial": null,
    "states": ["active", "deleting", "delete_failed", "decommissioned"],
    "transitions": {
      "create": { "from": null, "to": "active", "affects": ["organizationId", "slug", "displayName"] },
      "rename": { "from": "active", "to": "active", "affects": ["displayName"] },
      "startDelete": { "from": "active", "to": "deleting" },
      "deleteFailed": { "from": "deleting", "to": "delete_failed" },
      "decommission": { "from": "deleting", "to": "decommissioned" }
    }
  }
}
```

- [ ] **Step 6: Create ProjectVersion entity**

Create `apps/platform/blueprint/pdm/entities/ProjectVersion.json`:

```json
{
  "ownerService": "projects",
  "kind": "owned",
  "table": "project_versions",
  "fields": {
    "id": { "type": "string", "nullable": false, "column": "id" },
    "projectId": { "type": "string", "nullable": false, "column": "project_id" },
    "sequence": { "type": "integer", "nullable": false, "column": "sequence" },
    "bundleDigest": { "type": "string", "nullable": false, "column": "bundle_digest" },
    "bundleObjectKey": { "type": "string", "nullable": false, "column": "bundle_object_key" },
    "status": { "type": "string", "nullable": false, "column": "status" },
    "createdAt": { "type": "datetime", "nullable": false, "column": "created_at", "generated": "createdAt" }
  },
  "keys": ["id"],
  "stateMachine": {
    "stateField": "status",
    "initial": null,
    "states": ["published", "rejected"],
    "transitions": {
      "publish": { "from": null, "to": "published", "affects": ["projectId", "sequence", "bundleDigest", "bundleObjectKey"] },
      "reject": { "from": null, "to": "rejected", "affects": ["projectId", "sequence", "bundleDigest", "bundleObjectKey"] }
    }
  }
}
```

- [ ] **Step 7: Create ApiToken entity**

Create `apps/platform/blueprint/pdm/entities/ApiToken.json`:

```json
{
  "ownerService": "tokens",
  "kind": "owned",
  "table": "api_tokens",
  "fields": {
    "id": { "type": "string", "nullable": false, "column": "id" },
    "organizationId": { "type": "string", "nullable": false, "column": "organization_id" },
    "name": { "type": "string", "nullable": false, "column": "name" },
    "prefix": { "type": "string", "nullable": false, "column": "prefix" },
    "scopesJson": { "type": "json", "nullable": false, "column": "scopes_json" },
    "status": { "type": "string", "nullable": false, "column": "status" },
    "createdAt": { "type": "datetime", "nullable": false, "column": "created_at", "generated": "createdAt" },
    "revokedAt": { "type": "datetime", "nullable": true, "column": "revoked_at" }
  },
  "keys": ["id"],
  "stateMachine": {
    "stateField": "status",
    "initial": null,
    "states": ["active", "revoked"],
    "transitions": {
      "create": { "from": null, "to": "active", "affects": ["organizationId", "name", "prefix", "scopesJson"] },
      "revoke": { "from": "active", "to": "revoked", "affects": ["revokedAt"] }
    }
  }
}
```

- [ ] **Step 8: Create AuditEvent entity**

Create `apps/platform/blueprint/pdm/entities/AuditEvent.json`:

```json
{
  "ownerService": "audit",
  "kind": "owned",
  "table": "audit_events",
  "fields": {
    "id": { "type": "string", "nullable": false, "column": "id" },
    "organizationId": { "type": "string", "nullable": false, "column": "organization_id" },
    "actorId": { "type": "string", "nullable": true, "column": "actor_id" },
    "action": { "type": "string", "nullable": false, "column": "action" },
    "targetType": { "type": "string", "nullable": false, "column": "target_type" },
    "targetId": { "type": "string", "nullable": false, "column": "target_id" },
    "detailsJson": { "type": "json", "nullable": false, "column": "details_json" },
    "status": { "type": "string", "nullable": false, "column": "status" },
    "createdAt": { "type": "datetime", "nullable": false, "column": "created_at", "generated": "createdAt" }
  },
  "keys": ["id"],
  "stateMachine": {
    "stateField": "status",
    "initial": null,
    "states": ["recorded"],
    "transitions": {
      "record": { "from": null, "to": "recorded", "affects": ["organizationId", "actorId", "action", "targetType", "targetId", "detailsJson"] }
    }
  }
}
```

- [ ] **Step 9: Run PDM package tests**

Run:

```bash
pnpm -F @rntme/pdm test
```

Expected: existing tests pass.

- [ ] **Step 10: Commit**

```bash
git add apps/platform/blueprint/pdm
git commit -m "feat(platform): add platform PDM foundation"
```

### Task 4: Add Minimal QSM, Shapes, Graphs, And Bindings

**Files:**
- Create: `apps/platform/blueprint/services/*/qsm/qsm.json`
- Create: `apps/platform/blueprint/services/*/graphs/shapes.json`
- Create: read graph JSON files under each service
- Create: action graph JSON files under each service
- Create: `apps/platform/blueprint/services/*/bindings/bindings.json`

- [ ] **Step 1: Create qsm roots**

For each service (`organizations`, `projects`, `tokens`, `audit`), create `qsm/qsm.json`:

```json
{ "version": "1", "relations": {} }
```

- [ ] **Step 2: Create organizations shapes**

Create `apps/platform/blueprint/services/organizations/graphs/shapes.json`:

```json
{
  "OrganizationView": {
    "fields": {
      "id": { "type": "string", "nullable": false },
      "slug": { "type": "string", "nullable": false },
      "displayName": { "type": "string", "nullable": false },
      "status": { "type": "string", "nullable": false },
      "createdAt": { "type": "datetime", "nullable": false }
    }
  },
  "MembershipView": {
    "fields": {
      "id": { "type": "string", "nullable": false },
      "organizationId": { "type": "string", "nullable": false },
      "accountId": { "type": "string", "nullable": false },
      "role": { "type": "string", "nullable": false },
      "scopesJson": { "type": "json", "nullable": false },
      "status": { "type": "string", "nullable": false }
    }
  },
  "ActionResult": {
    "fields": {
      "id": { "type": "string", "nullable": false },
      "version": { "type": "integer", "nullable": true }
    }
  }
}
```

- [ ] **Step 3: Create one read graph per entity family**

Create `apps/platform/blueprint/services/organizations/graphs/listOrganizations.json`:

```json
{
  "id": "listOrganizations",
  "signature": {
    "inputs": {
      "limit": { "type": "integer", "mode": "defaulted", "default": 100 }
    },
    "output": { "type": "rowset<OrganizationView>", "from": "out" }
  },
  "nodes": [
    { "id": "items", "type": "findMany", "config": { "source": { "projection": "OrganizationView" } } },
    {
      "id": "active",
      "type": "filter",
      "config": {
        "input": "items",
        "expr": { "eq": ["organizationView.status", { "$literal": "active" }] }
      }
    },
    { "id": "paged", "type": "limit", "config": { "input": "active", "count": { "$param": "limit" } } },
    { "id": "out", "type": "result", "value": { "$ref": "paged" } }
  ]
}
```

Use this exact graph style for the other read operations, changing shape/projection names:

- `projects/graphs/listProjects.json` -> `rowset<ProjectView>`, `ProjectView`.
- `projects/graphs/listProjectVersions.json` -> inputs `projectId`, `limit`; `rowset<ProjectVersionView>`.
- `tokens/graphs/listTokens.json` -> inputs `organizationId`, `limit`; `rowset<ApiTokenView>`.
- `audit/graphs/listAuditEvents.json` -> inputs `organizationId`, `limit`; `rowset<AuditEventView>`.

- [ ] **Step 4: Create minimal action graphs**

Create action graphs using the `uuid` + `emit` + `result` pattern from `demo/notes-blueprint/services/app/graphs/createNote.json`.

Required actions:

- `organizations/graphs/createOrganization.json`
- `projects/graphs/createProject.json`
- `projects/graphs/publishProjectVersion.json`
- `tokens/graphs/createToken.json`
- `tokens/graphs/revokeToken.json`
- `audit/graphs/recordAuditEvent.json`

Each action result must use the local `ActionResult` shape:

```json
{
  "id": "createOrganization",
  "signature": {
    "inputs": {
      "slug": { "type": "string", "mode": "required" },
      "displayName": { "type": "string", "mode": "required" }
    },
    "output": { "type": "row<ActionResult>", "from": "out" }
  },
  "nodes": [
    { "id": "newId", "type": "uuid", "config": {} },
    {
      "id": "emit",
      "type": "emit",
      "config": {
        "aggregate": "Organization",
        "aggregateId": { "$node": "newId" },
        "transition": "create",
        "payload": {
          "slug": { "$param": "slug" },
          "displayName": { "$param": "displayName" }
        }
      }
    },
    {
      "id": "out",
      "type": "result",
      "value": { "id": { "$ref": "emit.aggregateId" }, "version": { "$ref": "emit.version" } }
    }
  ]
}
```

- [ ] **Step 5: Create bindings for each service**

Create `apps/platform/blueprint/services/organizations/bindings/bindings.json`:

```json
{
  "version": "1.0",
  "graphSpecRef": "../graphs",
  "pdmRef": "../../pdm",
  "qsmRef": "../qsm",
  "bindings": {
    "listOrganizations": {
      "graph": "listOrganizations",
      "target": { "engine": "sqlite", "dialect": "sqlite" },
      "http": {
        "method": "GET",
        "path": "/",
        "parameters": [{ "name": "limit", "in": "query", "bindTo": "limit", "required": false }]
      },
      "exposure": "read"
    },
    "createOrganization": {
      "graph": "createOrganization",
      "target": { "engine": "sqlite", "dialect": "sqlite" },
      "http": {
        "method": "POST",
        "path": "/",
        "parameters": [
          { "name": "slug", "in": "body", "bindTo": "slug", "required": true },
          { "name": "displayName", "in": "body", "bindTo": "displayName", "required": true }
        ]
      },
      "exposure": "action"
    }
  }
}
```

Create the remaining service binding files with these exact route conventions:

- `GET /` list.
- `POST /` create/record.
- `GET /:projectId/versions` for project versions, represented in OpenAPI path syntax as `/{projectId}/versions`.
- `POST /:projectId/versions` as `/{projectId}/versions`.
- `POST /{id}/actions/revoke` for token revocation.

- [ ] **Step 6: Run package-level graph and bindings tests**

Run:

```bash
pnpm -F @rntme/graph-ir-compiler test
pnpm -F @rntme/bindings test
pnpm -F @rntme/blueprint test
```

Expected: existing tests pass. If the new blueprint is not yet covered, Task 5 adds the direct test.

- [ ] **Step 7: Commit**

```bash
git add apps/platform/blueprint/services
git commit -m "feat(platform): add platform service artifacts"
```

### Task 5: Add Blueprint Composition Test

**Files:**
- Create: `apps/platform/blueprint/test/platform-blueprint.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/platform/blueprint/test/platform-blueprint.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadComposedBlueprint } from '@rntme/blueprint';

const here = dirname(fileURLToPath(import.meta.url));
const blueprintRoot = join(here, '..');

describe('platform blueprint', () => {
  it('composes the foundation platform blueprint', async () => {
    const result = await loadComposedBlueprint(blueprintRoot);
    expect(result.ok, result.ok ? '' : JSON.stringify(result.errors, null, 2)).toBe(true);
    if (!result.ok) return;

    expect(result.value.project.name).toBe('rntme-platform');
    expect(Object.keys(result.value.services).sort()).toEqual(['audit', 'organizations', 'projects', 'tokens']);
    expect(result.value.bindingRegistry['organizations.listOrganizations']?.path).toBe('/api/organizations/');
    expect(result.value.bindingRegistry['projects.listProjects']?.path).toBe('/api/projects/');
    expect(result.value.bindingRegistry['tokens.listTokens']?.path).toBe('/api/tokens/');
    expect(result.value.bindingRegistry['audit.listAuditEvents']?.path).toBe('/api/audit/');
  });
});
```

- [ ] **Step 2: Run test to verify current result**

Run:

```bash
pnpm -F @rntme/blueprint test -- ../../apps/platform/blueprint/test/platform-blueprint.test.ts
```

Expected: PASS. A failure is acceptable only when it is a validation error from the new platform artifacts; fix those errors before continuing.

- [ ] **Step 3: Fix validation errors by editing only platform blueprint artifacts**

Use the validation error `path` and `code` fields. Do not weaken validators. Do not cast around `Validated*` brands. Keep edits inside `apps/platform/blueprint/**`.

- [ ] **Step 4: Run focused validation again**

Run:

```bash
pnpm -F @rntme/blueprint test -- ../../apps/platform/blueprint/test/platform-blueprint.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run package smoke**

Run:

```bash
pnpm -F @rntme/blueprint test
pnpm -F @rntme/blueprint typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/platform/blueprint/test apps/platform/blueprint
git commit -m "test(platform): validate platform blueprint foundation"
```

### Task 6: Documentation Touch

**Files:**
- Modify: `docs/decision-system.md`
- Modify: `docs/current/owners/apps/platform.md`

- [ ] **Step 1: Record platform-as-blueprint bet**

In `docs/decision-system.md`, add this line under `3.1 Strategy`:

```md
- **Platform as blueprint** - The rntme control plane is authored, reviewed, deployed, and evolved as a rntme project blueprint rooted at `apps/platform/blueprint`. Hand-written launchers may host or bridge the platform during migration, but domain/API/UI source of truth moves to artifacts. · G1, G2, G3, G5, F2, F4, F5, F6 · `locked-pending` · spec `docs/superpowers/specs/2026-05-09-platform-as-blueprint-design.md`
```

- [ ] **Step 2: Update platform owner doc with actual services**

In `docs/current/owners/apps/platform.md`, add the service table from this plan and the command:

```bash
pnpm -F @rntme/blueprint test -- ../../apps/platform/blueprint/test/platform-blueprint.test.ts
```

- [ ] **Step 3: Verify docs references**

Run:

```bash
rg -n "Platform as blueprint|apps/platform/blueprint|platform-blueprint.test" docs/decision-system.md docs/current/owners/apps/platform.md AGENTS.md
```

Expected: all three concepts are present.

- [ ] **Step 4: Run final verification**

Run:

```bash
pnpm -F @rntme/blueprint test -- ../../apps/platform/blueprint/test/platform-blueprint.test.ts
pnpm -F @rntme/blueprint typecheck
pnpm depcruise
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add docs/decision-system.md docs/current/owners/apps/platform.md AGENTS.md apps/platform/blueprint apps/platform/README.md
git commit -m "docs(platform): document platform blueprint foundation"
```
