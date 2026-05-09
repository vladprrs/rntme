# Platform Deployments Service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `deployments` service to the platform blueprint that owns deploy targets, deployments, project operations, logs, and evidence, with an internal adapter seam to the existing Dokploy deployment packages.

**Architecture:** The platform `deployments` service owns lifecycle state and inspectability. The first execution seam is internal and calls current deployment logic through `@rntme/deploy-core` and `@rntme/deploy-dokploy`; it is not a public deploy-adapter module contract. Existing `apps/platform-http/src/deploy/**` code is reference material; code movement must be called out in the task that performs it.

**Tech Stack:** JSON rntme artifacts, `@rntme/blueprint`, `@rntme/deploy-core`, `@rntme/deploy-dokploy`, TypeScript adapter seam, Vitest, pnpm.

---

## Scope Boundary

This plan depends on the platform blueprint foundation and Auth0 plan. It adds deployment domain authoring and an internal adapter seam. It does not cut over `apps/platform-http`, create a public deploy adapter contract, or update the CLI.

## File Structure

- Modify `apps/platform/blueprint/project.json` — add `deployments` service and `/api/deployments` route.
- Create `apps/platform/blueprint/services/deployments/**` — service descriptor, PDM-owned entities, QSM, Graph IR, bindings.
- Create `apps/platform/blueprint/test/platform-deployments.test.ts` — composition coverage.
- Create `packages/platform/platform-core/src/deploy-adapter/seam.ts` — narrow internal adapter types if this package remains the temporary domain host.
- Create `packages/platform/platform-core/src/deploy-adapter/fake.ts` — fake adapter for tests.
- Create `packages/platform/platform-core/test/deploy-adapter/seam.test.ts` — seam state and redaction tests.
- Modify `docs/current/owners/apps/platform.md` and `docs/decision-system.md`.

## Tasks

### Task 1: Add Deployments Service To Project

**Files:**
- Modify: `apps/platform/blueprint/project.json`
- Create: `apps/platform/blueprint/services/deployments/service.json`

- [ ] **Step 1: Add service descriptor**

Create `apps/platform/blueprint/services/deployments/service.json`:

```json
{ "kind": "domain" }
```

- [ ] **Step 2: Add service to project.json**

In `apps/platform/blueprint/project.json`:

- add `"deployments"` to `services`;
- add route `"deployments": "/api/deployments"` in `routes.http`;
- add mount `{ "target": "http:/api/deployments", "use": ["requestContext", "auth"] }`.

Expected shape:

```json
{
  "routes": {
    "http": {
      "/api/deployments": "deployments"
    }
  },
  "mounts": [
    { "target": "http:/api/deployments", "use": ["requestContext", "auth"] }
  ]
}
```

Merge this into the existing JSON; do not remove prior routes.

- [ ] **Step 3: Run expected failing composition**

Run:

```bash
pnpm -F @rntme/blueprint test -- ../../apps/platform/blueprint/test/platform-blueprint.test.ts
```

Expected: FAIL because the service has no artifacts yet, or PASS if empty domain services are accepted. Task 2 adds artifacts.

- [ ] **Step 4: Commit**

```bash
git add apps/platform/blueprint/project.json apps/platform/blueprint/services/deployments/service.json
git commit -m "feat(platform): add deployments service route"
```

### Task 2: Add Deployment PDM Entities

**Files:**
- Create: `apps/platform/blueprint/pdm/entities/DeployTarget.json`
- Create: `apps/platform/blueprint/pdm/entities/Deployment.json`
- Create: `apps/platform/blueprint/pdm/entities/DeploymentLogLine.json`
- Create: `apps/platform/blueprint/pdm/entities/ProjectOperation.json`
- Create: `apps/platform/blueprint/pdm/entities/ProjectOperationLogLine.json`

- [ ] **Step 1: Create DeployTarget entity**

Create `apps/platform/blueprint/pdm/entities/DeployTarget.json`:

```json
{
  "ownerService": "deployments",
  "kind": "owned",
  "table": "deploy_targets",
  "fields": {
    "id": { "type": "string", "nullable": false, "column": "id" },
    "organizationId": { "type": "string", "nullable": false, "column": "organization_id" },
    "slug": { "type": "string", "nullable": false, "column": "slug" },
    "provider": { "type": "string", "nullable": false, "column": "provider" },
    "environment": { "type": "string", "nullable": false, "column": "environment" },
    "configJson": { "type": "json", "nullable": false, "column": "config_json" },
    "status": { "type": "string", "nullable": false, "column": "status" },
    "createdAt": { "type": "datetime", "nullable": false, "column": "created_at", "generated": "createdAt" }
  },
  "keys": ["id"],
  "stateMachine": {
    "stateField": "status",
    "initial": null,
    "states": ["active", "archived"],
    "transitions": {
      "create": { "from": null, "to": "active", "affects": ["organizationId", "slug", "provider", "environment", "configJson"] },
      "updateConfig": { "from": "active", "to": "active", "affects": ["configJson"] },
      "archive": { "from": "active", "to": "archived" }
    }
  }
}
```

- [ ] **Step 2: Create Deployment entity**

Create `apps/platform/blueprint/pdm/entities/Deployment.json`:

```json
{
  "ownerService": "deployments",
  "kind": "owned",
  "table": "deployments",
  "fields": {
    "id": { "type": "string", "nullable": false, "column": "id" },
    "organizationId": { "type": "string", "nullable": false, "column": "organization_id" },
    "projectId": { "type": "string", "nullable": false, "column": "project_id" },
    "projectVersionId": { "type": "string", "nullable": false, "column": "project_version_id" },
    "targetId": { "type": "string", "nullable": false, "column": "target_id" },
    "status": { "type": "string", "nullable": false, "column": "status" },
    "resultJson": { "type": "json", "nullable": true, "column": "result_json" },
    "createdAt": { "type": "datetime", "nullable": false, "column": "created_at", "generated": "createdAt" },
    "startedAt": { "type": "datetime", "nullable": true, "column": "started_at" },
    "finishedAt": { "type": "datetime", "nullable": true, "column": "finished_at" }
  },
  "keys": ["id"],
  "stateMachine": {
    "stateField": "status",
    "initial": null,
    "states": ["queued", "running", "succeeded", "failed", "cancelled"],
    "transitions": {
      "queue": { "from": null, "to": "queued", "affects": ["organizationId", "projectId", "projectVersionId", "targetId"] },
      "start": { "from": "queued", "to": "running", "affects": ["startedAt"] },
      "succeed": { "from": "running", "to": "succeeded", "affects": ["finishedAt", "resultJson"] },
      "fail": { "from": "running", "to": "failed", "affects": ["finishedAt", "resultJson"] },
      "cancel": { "from": "queued", "to": "cancelled", "affects": ["finishedAt", "resultJson"] }
    }
  }
}
```

- [ ] **Step 3: Create log and operation entities**

Create `DeploymentLogLine.json`, `ProjectOperation.json`, and `ProjectOperationLogLine.json` using the same field pattern:

```json
{
  "ownerService": "deployments",
  "kind": "owned",
  "table": "deployment_log_lines",
  "fields": {
    "id": { "type": "string", "nullable": false, "column": "id" },
    "deploymentId": { "type": "string", "nullable": false, "column": "deployment_id" },
    "level": { "type": "string", "nullable": false, "column": "level" },
    "stage": { "type": "string", "nullable": false, "column": "stage" },
    "message": { "type": "string", "nullable": false, "column": "message" },
    "createdAt": { "type": "datetime", "nullable": false, "column": "created_at", "generated": "createdAt" },
    "status": { "type": "string", "nullable": false, "column": "status" }
  },
  "keys": ["id"],
  "stateMachine": {
    "stateField": "status",
    "initial": null,
    "states": ["recorded"],
    "transitions": {
      "record": { "from": null, "to": "recorded", "affects": ["deploymentId", "level", "stage", "message"] }
    }
  }
}
```

For project operation fields use `operationId` instead of `deploymentId`, and for `ProjectOperation` use fields `id`, `organizationId`, `projectId`, `kind`, `status`, `inputJson`, `resultJson`, `createdAt`, `startedAt`, `finishedAt`.

- [ ] **Step 4: Run PDM validation through blueprint composition**

Run:

```bash
pnpm -F @rntme/blueprint test -- ../../apps/platform/blueprint/test/platform-blueprint.test.ts
```

Expected: PDM errors, if any, name the new entity files. Fix only malformed entity JSON.

- [ ] **Step 5: Commit**

```bash
git add apps/platform/blueprint/pdm/entities
git commit -m "feat(platform): model deployment lifecycle entities"
```

### Task 3: Add Deployments Graphs And Bindings

**Files:**
- Create: `apps/platform/blueprint/services/deployments/qsm/qsm.json`
- Create: `apps/platform/blueprint/services/deployments/graphs/shapes.json`
- Create: `apps/platform/blueprint/services/deployments/graphs/*.json`
- Create: `apps/platform/blueprint/services/deployments/bindings/bindings.json`

- [ ] **Step 1: Add QSM root**

Create `apps/platform/blueprint/services/deployments/qsm/qsm.json`:

```json
{ "version": "1", "relations": {} }
```

- [ ] **Step 2: Add shapes**

Create `apps/platform/blueprint/services/deployments/graphs/shapes.json` with shapes:

```json
{
  "DeployTargetView": {
    "fields": {
      "id": { "type": "string", "nullable": false },
      "organizationId": { "type": "string", "nullable": false },
      "slug": { "type": "string", "nullable": false },
      "provider": { "type": "string", "nullable": false },
      "environment": { "type": "string", "nullable": false },
      "status": { "type": "string", "nullable": false }
    }
  },
  "DeploymentView": {
    "fields": {
      "id": { "type": "string", "nullable": false },
      "organizationId": { "type": "string", "nullable": false },
      "projectId": { "type": "string", "nullable": false },
      "projectVersionId": { "type": "string", "nullable": false },
      "targetId": { "type": "string", "nullable": false },
      "status": { "type": "string", "nullable": false },
      "resultJson": { "type": "json", "nullable": true }
    }
  },
  "LogLineView": {
    "fields": {
      "id": { "type": "string", "nullable": false },
      "deploymentId": { "type": "string", "nullable": false },
      "level": { "type": "string", "nullable": false },
      "stage": { "type": "string", "nullable": false },
      "message": { "type": "string", "nullable": false },
      "createdAt": { "type": "datetime", "nullable": false }
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

- [ ] **Step 3: Add action graphs**

Create:

- `createDeployTarget.json`
- `queueDeployment.json`
- `markDeploymentRunning.json`
- `markDeploymentSucceeded.json`
- `markDeploymentFailed.json`
- `appendDeploymentLog.json`

Use the same `uuid` + `emit` + `result` pattern from the foundation plan. `queueDeployment` must emit aggregate `Deployment`, transition `queue`, and payload keys `organizationId`, `projectId`, `projectVersionId`, `targetId`.

- [ ] **Step 4: Add read graphs**

Create:

- `listDeployTargets.json` with inputs `organizationId`, `limit`.
- `listDeployments.json` with inputs `organizationId`, `projectId`, `limit`.
- `getDeployment.json` with input `id`.
- `readDeploymentLogs.json` with inputs `deploymentId`, `limit`.

Use `findMany`, `filter`, `limit`, and `result` nodes following the foundation plan.

- [ ] **Step 5: Add bindings**

Create `apps/platform/blueprint/services/deployments/bindings/bindings.json`:

```json
{
  "version": "1.0",
  "graphSpecRef": "../graphs",
  "pdmRef": "../../pdm",
  "qsmRef": "../qsm",
  "bindings": {
    "listDeployTargets": {
      "graph": "listDeployTargets",
      "target": { "engine": "sqlite", "dialect": "sqlite" },
      "http": {
        "method": "GET",
        "path": "/targets",
        "parameters": [
          { "name": "organizationId", "in": "query", "bindTo": "organizationId", "required": true },
          { "name": "limit", "in": "query", "bindTo": "limit", "required": false }
        ]
      },
      "exposure": "read",
      "inputFrom": { "authorization": { "from": "header", "name": "authorization", "required": true } }
    },
    "queueDeployment": {
      "graph": "queueDeployment",
      "target": { "engine": "sqlite", "dialect": "sqlite" },
      "http": {
        "method": "POST",
        "path": "/",
        "parameters": [
          { "name": "organizationId", "in": "body", "bindTo": "organizationId", "required": true },
          { "name": "projectId", "in": "body", "bindTo": "projectId", "required": true },
          { "name": "projectVersionId", "in": "body", "bindTo": "projectVersionId", "required": true },
          { "name": "targetId", "in": "body", "bindTo": "targetId", "required": true }
        ]
      },
      "exposure": "action",
      "inputFrom": { "authorization": { "from": "header", "name": "authorization", "required": true } }
    }
  }
}
```

Add the remaining read/action bindings with the same inputFrom block.

- [ ] **Step 6: Run focused composition**

Run:

```bash
pnpm -F @rntme/blueprint test -- ../../apps/platform/blueprint/test/platform-blueprint.test.ts
```

Expected: PASS after graph and binding mismatches are fixed.

- [ ] **Step 7: Commit**

```bash
git add apps/platform/blueprint/services/deployments apps/platform/blueprint/project.json
git commit -m "feat(platform): add deployments service artifacts"
```

### Task 4: Add Internal Deploy Adapter Seam

**Files:**
- Create: `packages/platform/platform-core/src/deploy-adapter/seam.ts`
- Create: `packages/platform/platform-core/src/deploy-adapter/fake.ts`
- Modify: `packages/platform/platform-core/src/index.ts`
- Create: `packages/platform/platform-core/test/deploy-adapter/seam.test.ts`

- [ ] **Step 1: Write failing seam test**

Create `packages/platform/platform-core/test/deploy-adapter/seam.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createFakeDeployAdapter } from '../../src/deploy-adapter/fake.js';

describe('internal deploy adapter seam', () => {
  it('returns sanitized execution evidence without secret values', async () => {
    const adapter = createFakeDeployAdapter({
      result: {
        status: 'succeeded',
        targetProvider: 'dokploy',
        renderedDigest: 'sha256:test',
        logs: [{ level: 'info', stage: 'apply', message: 'applied without secret' }],
        evidence: { health: 'passed' },
      },
    });

    const result = await adapter.run({
      deploymentId: 'dep_1',
      organizationId: 'org_1',
      projectVersionId: 'ver_1',
      targetId: 'target_1',
      bundleObjectKey: 'bundles/ver_1.json',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(JSON.stringify(result.value)).not.toContain('secret');
    expect(result.value.renderedDigest).toBe('sha256:test');
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
pnpm -F @rntme/platform-core test -- test/deploy-adapter/seam.test.ts
```

Expected: FAIL because files do not exist.

- [ ] **Step 3: Add seam types**

Create `packages/platform/platform-core/src/deploy-adapter/seam.ts`:

```ts
import type { Result } from '../types/result.js';

export type DeployAdapterInput = {
  readonly deploymentId: string;
  readonly organizationId: string;
  readonly projectVersionId: string;
  readonly targetId: string;
  readonly bundleObjectKey: string;
};

export type DeployAdapterLogLine = {
  readonly level: 'debug' | 'info' | 'warn' | 'error';
  readonly stage: string;
  readonly message: string;
};

export type DeployAdapterSuccess = {
  readonly status: 'succeeded';
  readonly targetProvider: 'dokploy';
  readonly renderedDigest: string;
  readonly logs: readonly DeployAdapterLogLine[];
  readonly evidence: Readonly<Record<string, unknown>>;
};

export type DeployAdapterFailure = {
  readonly status: 'failed';
  readonly targetProvider: 'dokploy';
  readonly logs: readonly DeployAdapterLogLine[];
  readonly error: { readonly code: string; readonly message: string };
  readonly evidence?: Readonly<Record<string, unknown>>;
};

export type DeployAdapterResult = DeployAdapterSuccess | DeployAdapterFailure;

export type DeployAdapter = {
  readonly run: (input: DeployAdapterInput) => Promise<Result<DeployAdapterResult>>;
};
```

- [ ] **Step 4: Add fake adapter**

Create `packages/platform/platform-core/src/deploy-adapter/fake.ts`:

```ts
import { ok, type Result } from '../types/result.js';
import type { DeployAdapter, DeployAdapterInput, DeployAdapterResult } from './seam.js';

export function createFakeDeployAdapter(opts: {
  readonly result: DeployAdapterResult;
  readonly onRun?: (input: DeployAdapterInput) => void;
}): DeployAdapter {
  return {
    async run(input): Promise<Result<DeployAdapterResult>> {
      opts.onRun?.(input);
      return ok(opts.result);
    },
  };
}
```

- [ ] **Step 5: Export seam**

Add to `packages/platform/platform-core/src/index.ts`:

```ts
export type {
  DeployAdapter,
  DeployAdapterFailure,
  DeployAdapterInput,
  DeployAdapterLogLine,
  DeployAdapterResult,
  DeployAdapterSuccess,
} from './deploy-adapter/seam.js';
export { createFakeDeployAdapter } from './deploy-adapter/fake.js';
```

- [ ] **Step 6: Run seam tests**

Run:

```bash
pnpm -F @rntme/platform-core test -- test/deploy-adapter/seam.test.ts
pnpm -F @rntme/platform-core typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/platform/platform-core/src/deploy-adapter packages/platform/platform-core/src/index.ts packages/platform/platform-core/test/deploy-adapter/seam.test.ts
git commit -m "feat(platform-core): add internal deploy adapter seam"
```

### Task 5: Add Deployments Composition Test

**Files:**
- Create: `apps/platform/blueprint/test/platform-deployments.test.ts`

- [ ] **Step 1: Write composition test**

Create `apps/platform/blueprint/test/platform-deployments.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadComposedBlueprint } from '@rntme/blueprint';

const here = dirname(fileURLToPath(import.meta.url));
const blueprintRoot = join(here, '..');

describe('platform deployments service', () => {
  it('exposes deployment lifecycle bindings', async () => {
    const result = await loadComposedBlueprint(blueprintRoot);
    expect(result.ok, result.ok ? '' : JSON.stringify(result.errors, null, 2)).toBe(true);
    if (!result.ok) return;

    expect(result.value.services.deployments).toBeDefined();
    expect(result.value.bindingRegistry['deployments.queueDeployment']?.path).toBe('/api/deployments/');
    expect(result.value.bindingRegistry['deployments.listDeployTargets']?.path).toBe('/api/deployments/targets');
  });
});
```

- [ ] **Step 2: Run deployments test**

Run:

```bash
pnpm -F @rntme/blueprint test -- ../../apps/platform/blueprint/test/platform-deployments.test.ts
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/platform/blueprint/test/platform-deployments.test.ts
git commit -m "test(platform): validate deployments service composition"
```

### Task 6: Documentation And Decision System

**Files:**
- Modify: `docs/decision-system.md`
- Modify: `docs/current/owners/apps/platform.md`
- Modify: `docs/current/owners/packages/platform/platform-core.md`

- [ ] **Step 1: Add deploy service bet**

In `docs/decision-system.md`, under the deploy/platform or strategy section, add:

```md
- **Deployments service + adapter boundary** - Platform deployment lifecycle is owned by a rntme `deployments` service. Target-neutral planning and provider-specific apply details sit behind an adapter seam. Dokploy remains the first adapter; a public deploy-adapter module contract is deferred until the service boundary stabilizes or a second backend exists. · G3, G4, F1, F3, F4, F8 · `locked-pending` · spec `docs/superpowers/specs/2026-05-09-platform-as-blueprint-design.md`
```

- [ ] **Step 2: Document deployments service**

Add to `docs/current/owners/apps/platform.md`:

```md
## Deployments

The platform blueprint has a `deployments` domain service that owns deploy
targets, deployment records, project operations, sanitized log lines, and
execution evidence. The first implementation uses an internal adapter seam to
call the existing Dokploy deploy path. A public deploy-adapter module contract
is intentionally deferred.
```

- [ ] **Step 3: Document adapter seam**

Add to `docs/current/owners/packages/platform/platform-core.md`:

```md
## Internal deploy adapter seam

`src/deploy-adapter/seam.ts` defines the temporary internal seam used by the
platform `deployments` service while Dokploy execution still lives in existing
deploy packages. The seam returns sanitized status, logs, digest, evidence, and
coded failure details. It is not a public deploy-adapter module contract.
```

- [ ] **Step 4: Final verification**

Run:

```bash
pnpm -F @rntme/blueprint test -- ../../apps/platform/blueprint/test/platform-deployments.test.ts
pnpm -F @rntme/platform-core test -- test/deploy-adapter/seam.test.ts
pnpm -F @rntme/platform-core typecheck
pnpm depcruise
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add docs/decision-system.md docs/current/owners/apps/platform.md docs/current/owners/packages/platform/platform-core.md
git commit -m "docs(platform): document deployments service boundary"
```
