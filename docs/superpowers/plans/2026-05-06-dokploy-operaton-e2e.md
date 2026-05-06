# Dokploy Operaton E2E Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a gated live E2E test that deploys the order-fulfillment demo to a real Dokploy target with provisioned Redpanda, Operaton, and a deployable BPMN worker, then proves both BPMN business branches through the public demo API.

**Architecture:** The live E2E stays outside default CI unless `RNTME_DOKPLOY_E2E=1` is set. `@rntme/bpmn-worker` becomes a real Dockerized process: it consumes CloudEvents from Kafka, starts Operaton message-start processes, polls/completes external tasks, and calls rntme gRPC command bindings. The platform deploy executor supplies the worker with workflow subscriptions, gRPC endpoints, and generated proto sources so the Dokploy deployment can run without mock seams.

**Tech Stack:** TypeScript strict ESM, Vitest, Hono platform e2e harness, Dokploy HTTP API, Operaton REST API, KafkaJS, `@rntme/event-store` CloudEvents wire codec, `@grpc/grpc-js`, `protobufjs`, Docker.

---

## References

- Operaton external-task docs: `https://docs.operaton.org/docs/documentation/user-guide/process-engine/external-tasks/`
- Operaton REST deployment endpoint docs: `https://docs.operaton.org/docs/get-started/quick-start/deploy/`
- Operaton REST API specification entrypoint: `https://docs.operaton.org/docs/documentation/reference/rest/specification/`
- Existing BPMN spec: `docs/superpowers/specs/2026-05-05-provisioned-bpmn-operaton-design.md`
- Existing BPMN implementation plan: `docs/superpowers/plans/2026-05-05-provisioned-bpmn-operaton.md`

## Live E2E Contract

The test must skip by default. It runs only when all required live variables are present:

```bash
RNTME_DOKPLOY_E2E=1
RNTME_DOKPLOY_URL=https://dokploy.example.com
RNTME_DOKPLOY_API_TOKEN=...
RNTME_DOKPLOY_PROJECT_ID=...
RNTME_DOKPLOY_PUBLIC_DEPLOY_DOMAIN=preview.example.com
RNTME_E2E_RUNTIME_IMAGE=ghcr.io/<owner>/rntme-runtime:<tag>
RNTME_E2E_BPMN_WORKER_IMAGE=ghcr.io/<owner>/rntme-bpmn-worker:<tag>
RNTME_E2E_OPERATON_IMAGE=operaton/operaton:<pinned-tag>
```

Optional:

```bash
RNTME_E2E_REDPANDA_IMAGE=docker.redpanda.com/redpandadata/redpanda:v24.3.6
RNTME_E2E_HTTP_TIMEOUT_MS=180000
```

`RNTME_DOKPLOY_PUBLIC_DEPLOY_DOMAIN` must be a wildcard DNS domain routed to the Dokploy ingress. The test derives a unique public URL through the existing platform deploy-domain path: `https://<org>-<project>-default.<domain>`.

## File Structure

Create:

- `apps/platform-http/test/e2e/live-dokploy-env.ts` - parse and gate live Dokploy env.
- `apps/platform-http/test/e2e/project-bundle-helper.ts` - build a canonical v2 project bundle with JSON files and text assets for e2e tests.
- `apps/platform-http/test/e2e/seed-auth-helper.ts` - shared org/account/token seeding used by mock and live deploy e2e.
- `apps/platform-http/test/e2e/order-fulfillment-dokploy-live.test.ts` - real Dokploy deploy plus business-flow assertions.
- `packages/runtime/bpmn-worker/src/env.ts` - parse worker runtime env into `WorkerConfig`.
- `packages/runtime/bpmn-worker/src/operaton-rest.ts` - concrete Operaton REST client.
- `packages/runtime/bpmn-worker/src/kafka-consumer.ts` - KafkaJS consumer adapter that yields decoded workflow events.
- `packages/runtime/bpmn-worker/src/run.ts` - process entry orchestration and shutdown handling.
- `packages/runtime/bpmn-worker/src/bin/worker.ts` - CLI entrypoint.
- `packages/runtime/bpmn-worker/Dockerfile` - deployable worker image.
- `packages/runtime/bpmn-worker/test/unit/env.test.ts`
- `packages/runtime/bpmn-worker/test/unit/operaton-rest.test.ts`
- `packages/runtime/bpmn-worker/test/unit/kafka-consumer.test.ts`

Modify:

- `apps/platform-http/package.json` - add `@rntme/bindings-grpc` dependency for proto emission in the deploy executor.
- `apps/platform-http/src/deploy/executor.ts` - generate workflow gRPC service registry and pass it into deploy-core input.
- `apps/platform-http/test/unit/deploy/executor.test.ts` - assert workflow proto registry is produced from the order-fulfillment demo.
- `apps/platform-http/test/e2e/deploy-flow.test.ts` - reuse `seed-auth-helper.ts`; keep mock Dokploy coverage unchanged.
- `packages/deploy/deploy-core/src/composed-project.ts` - add workflow gRPC service registry input.
- `packages/deploy/deploy-core/src/plan.ts` - add planned workflow gRPC service type to `BpmnWorkerWorkload`.
- `packages/deploy/deploy-core/src/workflows.ts` - validate/copy workflow gRPC service configs into the BPMN worker workload.
- `packages/deploy/deploy-core/test/unit/plan-workflows.test.ts` - assert registry is required and planned.
- `packages/deploy/deploy-dokploy/src/workflow-render.ts` - render subscriptions and gRPC service registry env for the worker.
- `packages/deploy/deploy-dokploy/test/unit/render-workflows.test.ts` - assert worker env includes subscriptions and proto registry.
- `packages/runtime/bpmn-worker/package.json` - add `bin`, `@rntme/event-store`, and `kafkajs`.
- `packages/runtime/bpmn-worker/src/config.ts` - export env/config loader public API.
- `packages/runtime/bpmn-worker/src/index.ts` - export concrete worker entry helpers.
- `packages/runtime/bpmn-worker/src/types.ts` - add subscription and runtime-loop types.
- `packages/runtime/bpmn-worker/src/worker.ts` - preserve `runWorkflowEventOnce`; only extend parameters if needed by concrete Operaton tasks.
- `packages/runtime/bpmn-worker/README.md` - document env, Docker image build, and live e2e role.
- `demo/order-fulfillment-blueprint/README.md` - replace mock image example with the live e2e env contract.
- `docs/superpowers/specs/2026-05-05-provisioned-bpmn-operaton-design.md` - add a live Dokploy acceptance addendum.
- `AGENTS.md` - update §6.14 or §6.15 with the live BPMN/Dokploy e2e command if this branch owns that docs touch.

---

### Task 1: Add Live Dokploy E2E Gating Helpers

**Files:**
- Create: `apps/platform-http/test/e2e/live-dokploy-env.ts`
- Create: `apps/platform-http/test/e2e/project-bundle-helper.ts`
- Create: `apps/platform-http/test/e2e/seed-auth-helper.ts`
- Modify: `apps/platform-http/test/e2e/deploy-flow.test.ts`
- Test: `apps/platform-http/test/e2e/order-fulfillment-dokploy-live.test.ts`

- [ ] **Step 1: Extract shared auth seeding**

Move the existing `seedOrgWithToken(...)` helper from `apps/platform-http/test/e2e/deploy-flow.test.ts` into `apps/platform-http/test/e2e/seed-auth-helper.ts`:

```ts
import { createHash, randomUUID } from 'node:crypto';
import { Buffer } from 'node:buffer';
import type { E2eEnv } from './harness.js';

export async function seedOrgWithToken(
  env: E2eEnv,
  slug: string,
  workosId: string,
  workosUser: string,
): Promise<{ plain: string; orgId: string }> {
  const org = await env.ownerPool.query<{ id: string }>(
    `INSERT INTO organization (id, workos_organization_id, slug, display_name)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (workos_organization_id) DO UPDATE SET slug=EXCLUDED.slug, display_name=EXCLUDED.display_name
     RETURNING id`,
    [randomUUID(), workosId, slug, slug],
  );
  const acc = await env.ownerPool.query<{ id: string }>(
    `INSERT INTO account (id, workos_user_id, email, display_name)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (workos_user_id) DO UPDATE SET email=EXCLUDED.email, display_name=EXCLUDED.display_name
     RETURNING id`,
    [randomUUID(), workosUser, null, workosUser],
  );
  await env.ownerPool.query(
    `INSERT INTO membership_mirror (org_id, account_id, role)
     VALUES ($1,$2,'admin')
     ON CONFLICT (org_id, account_id) DO UPDATE SET role=EXCLUDED.role, updated_at=now()`,
    [org.rows[0]!.id, acc.rows[0]!.id],
  );
  const plain = 'rntme_pat_' + randomUUID().replace(/-/g, '').slice(0, 22);
  const hash = new Uint8Array(createHash('sha256').update(plain).digest());
  await env.ownerPool.query(
    `INSERT INTO api_token (id, org_id, account_id, name, token_hash, prefix, scopes, expires_at)
     VALUES ($1,$2,$3,'deploy',$4,$5,$6,NULL)`,
    [
      randomUUID(),
      org.rows[0]!.id,
      acc.rows[0]!.id,
      Buffer.from(hash),
      plain.slice(0, 12),
      ['project:read', 'project:write', 'version:publish', 'deploy:target:manage', 'deploy:execute'],
    ],
  );
  return { plain, orgId: org.rows[0]!.id };
}
```

Update `deploy-flow.test.ts` to import this helper and remove its local copy.

- [ ] **Step 2: Add live env parser**

Create `apps/platform-http/test/e2e/live-dokploy-env.ts`:

```ts
export type LiveDokployEnv =
  | { readonly enabled: false; readonly reason: string }
  | {
      readonly enabled: true;
      readonly dokployUrl: string;
      readonly dokployApiToken: string;
      readonly dokployProjectId: string;
      readonly publicDeployDomain: string;
      readonly runtimeImage: string;
      readonly bpmnWorkerImage: string;
      readonly operatonImage: string;
      readonly redpandaImage?: string;
      readonly httpTimeoutMs: number;
    };

export function readLiveDokployEnv(env: NodeJS.ProcessEnv = process.env): LiveDokployEnv {
  if (env['RNTME_DOKPLOY_E2E'] !== '1') {
    return { enabled: false, reason: 'RNTME_DOKPLOY_E2E is not 1' };
  }
  const required = [
    'RNTME_DOKPLOY_URL',
    'RNTME_DOKPLOY_API_TOKEN',
    'RNTME_DOKPLOY_PROJECT_ID',
    'RNTME_DOKPLOY_PUBLIC_DEPLOY_DOMAIN',
    'RNTME_E2E_RUNTIME_IMAGE',
    'RNTME_E2E_BPMN_WORKER_IMAGE',
    'RNTME_E2E_OPERATON_IMAGE',
  ] as const;
  const missing = required.filter((name) => (env[name] ?? '').trim() === '');
  if (missing.length > 0) {
    return { enabled: false, reason: `missing ${missing.join(', ')}` };
  }
  return {
    enabled: true,
    dokployUrl: env['RNTME_DOKPLOY_URL']!.trim(),
    dokployApiToken: env['RNTME_DOKPLOY_API_TOKEN']!.trim(),
    dokployProjectId: env['RNTME_DOKPLOY_PROJECT_ID']!.trim(),
    publicDeployDomain: env['RNTME_DOKPLOY_PUBLIC_DEPLOY_DOMAIN']!.trim().replace(/^\*\./, ''),
    runtimeImage: env['RNTME_E2E_RUNTIME_IMAGE']!.trim(),
    bpmnWorkerImage: env['RNTME_E2E_BPMN_WORKER_IMAGE']!.trim(),
    operatonImage: env['RNTME_E2E_OPERATON_IMAGE']!.trim(),
    ...(env['RNTME_E2E_REDPANDA_IMAGE'] ? { redpandaImage: env['RNTME_E2E_REDPANDA_IMAGE'].trim() } : {}),
    httpTimeoutMs: Number.parseInt(env['RNTME_E2E_HTTP_TIMEOUT_MS'] ?? '180000', 10),
  };
}
```

- [ ] **Step 3: Add canonical bundle helper with assets**

Create `apps/platform-http/test/e2e/project-bundle-helper.ts`:

```ts
import { Buffer } from 'node:buffer';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';
import {
  canonicalBundleDigest,
  canonicalize,
  type CanonicalBundle,
} from '@rntme/platform-core';

export function buildProjectBundleForE2e(root: string): { readonly bytes: string; readonly digest: string } {
  const files: Record<string, unknown> = {};
  const assets: Record<string, string> = {};
  for (const relPath of collectFiles(root)) {
    const abs = resolve(root, relPath);
    if (relPath.endsWith('.json')) {
      files[relPath] = JSON.parse(readFileSync(abs, 'utf8'));
    } else if (
      relPath.endsWith('.bpmn') ||
      relPath.endsWith('.mjs') ||
      relPath.endsWith('.js') ||
      relPath.endsWith('.ts') ||
      relPath.endsWith('.tsx') ||
      relPath.endsWith('.css')
    ) {
      assets[relPath] = Buffer.from(readFileSync(abs)).toString('base64');
    }
  }
  const bundle: CanonicalBundle = { version: 2, files, assets };
  return { bytes: canonicalize(bundle), digest: canonicalBundleDigest(bundle) };
}

function collectFiles(root: string): string[] {
  const out: string[] = [];
  function walk(dir: string): void {
    for (const name of readdirSync(dir).sort()) {
      const abs = resolve(dir, name);
      const st = statSync(abs);
      if (st.isDirectory()) walk(abs);
      else if (st.isFile()) out.push(relative(root, abs).split(sep).join('/'));
    }
  }
  walk(root);
  return out.sort();
}
```

- [ ] **Step 4: Add the skipped live e2e shell**

Create `apps/platform-http/test/e2e/order-fulfillment-dokploy-live.test.ts` with a skipped guard and a minimal assertion:

```ts
import { describe, expect, it } from 'vitest';
import { readLiveDokployEnv } from './live-dokploy-env.js';

const live = readLiveDokployEnv();

describe.skipIf(!live.enabled)(`live Dokploy order fulfillment${live.enabled ? '' : ` (${live.reason})`}`, () => {
  it('has live env configured', () => {
    expect(live.enabled).toBe(true);
  });
});
```

- [ ] **Step 5: Run focused tests**

Run:

```bash
pnpm -F @rntme/platform-http test -- test/e2e/order-fulfillment-dokploy-live.test.ts test/e2e/deploy-flow.test.ts
```

Expected without live env: deploy-flow passes as before; order-fulfillment live suite is skipped.

- [ ] **Step 6: Commit**

```bash
git add apps/platform-http/test/e2e/live-dokploy-env.ts \
  apps/platform-http/test/e2e/project-bundle-helper.ts \
  apps/platform-http/test/e2e/seed-auth-helper.ts \
  apps/platform-http/test/e2e/deploy-flow.test.ts \
  apps/platform-http/test/e2e/order-fulfillment-dokploy-live.test.ts
git commit -m "test: scaffold live dokploy e2e harness"
```

---

### Task 2: Generate Workflow gRPC Proto Registry During Deploy Input Assembly

**Files:**
- Modify: `apps/platform-http/package.json`
- Modify: `apps/platform-http/src/deploy/executor.ts`
- Modify: `apps/platform-http/test/unit/deploy/executor.test.ts`
- Modify: `packages/deploy/deploy-core/src/composed-project.ts`
- Test: `apps/platform-http/test/unit/deploy/executor.test.ts`

- [ ] **Step 1: Write failing executor assertion**

Extend `passes workflow artifacts into planning and records workflow resources` or `materializes a stored workflow bundle through compose, plan, render, and apply` in `apps/platform-http/test/unit/deploy/executor.test.ts` to assert `workflowGrpcServices`:

```ts
expect(planProject).toHaveBeenCalledWith(
  expect.objectContaining({
    workflowGrpcServices: {
      orders: expect.objectContaining({
        packageName: 'rntme.orders.v1',
        serviceName: 'OrdersService',
        protoSource: expect.stringContaining('service OrdersService'),
      }),
      inventory: expect.objectContaining({
        packageName: 'rntme.inventory.v1',
        serviceName: 'InventoryService',
        protoSource: expect.stringContaining('rpc ReserveStock'),
      }),
    },
  }),
  expect.any(Object),
  expect.any(Object),
);
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
pnpm -F @rntme/platform-http test -- test/unit/deploy/executor.test.ts
```

Expected: FAIL because `workflowGrpcServices` is missing from the deploy-core input.

- [ ] **Step 3: Add deploy-core input type**

Modify `packages/deploy/deploy-core/src/composed-project.ts`:

```ts
export type WorkflowGrpcServiceConfig = {
  readonly packageName: string;
  readonly serviceName: string;
  readonly protoSource: string;
};

export type ComposedProjectInput = {
  readonly name: string;
  readonly services: Readonly<Record<string, ComposedProjectService>>;
  readonly publicConfigJson?: string | null;
  readonly routes?: ProjectRouteMap;
  readonly middleware?: Readonly<Record<string, ProjectMiddlewareDecl>>;
  readonly mounts?: readonly ProjectMountDecl[];
  readonly modules?: Readonly<Record<string, ComposedProjectModuleInfo>>;
  readonly workflows?: ValidatedWorkflows | null;
  readonly workflowFiles?: Readonly<Record<string, string>>;
  readonly workflowGrpcServices?: Readonly<Record<string, WorkflowGrpcServiceConfig>>;
  readonly varsManifest?: VarsManifest;
};
```

- [ ] **Step 4: Add platform dependency**

Add to `apps/platform-http/package.json` dependencies:

```json
"@rntme/bindings-grpc": "workspace:*"
```

- [ ] **Step 5: Implement proto generation in executor**

In `apps/platform-http/src/deploy/executor.ts`, import `emitProto` and add helpers:

```ts
import { emitProto } from '@rntme/bindings-grpc';
```

```ts
function workflowGrpcServicesForProject(
  project: ComposedBlueprint,
): Record<string, { packageName: string; serviceName: string; protoSource: string }> {
  if (project.workflows === null || project.workflows === undefined) return {};
  const serviceSlugs = new Set(project.workflows.serviceTasks.map((task) => task.bindingRef.split('.')[0]).filter(Boolean));
  const out: Record<string, { packageName: string; serviceName: string; protoSource: string }> = {};
  for (const serviceSlug of [...serviceSlugs].sort()) {
    const service = project.services[serviceSlug];
    if (service?.bindings === null || service?.bindings === undefined || service.graphSpec === null) continue;
    const packageName = grpcPackageNameForService(serviceSlug);
    const serviceName = grpcServiceNameForService(serviceSlug);
    out[serviceSlug] = {
      packageName,
      serviceName,
      protoSource: emitProto(service.bindings, service.graphSpec.shapes, { packageName, serviceName }),
    };
  }
  return out;
}

function grpcPackageNameForService(serviceSlug: string): string {
  return `rntme.${serviceSlug.trim().toLowerCase().replace(/-/g, '_')}.v1`;
}

function grpcServiceNameForService(serviceSlug: string): string {
  return `${serviceSlug
    .split(/[^A-Za-z0-9]+/)
    .filter((part) => part.length > 0)
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join('')}Service`;
}
```

Add the field in `toDeployCoreInput(...)`:

```ts
const workflowGrpcServices = workflowGrpcServicesForProject(value);

return {
  name: value.project.name,
  // existing fields
  ...(Object.keys(workflowGrpcServices).length === 0 ? {} : { workflowGrpcServices }),
};
```

- [ ] **Step 6: Run focused tests**

Run:

```bash
pnpm -F @rntme/platform-http test -- test/unit/deploy/executor.test.ts
pnpm -F @rntme/platform-http typecheck
```

Expected: executor test and typecheck pass.

- [ ] **Step 7: Commit**

```bash
git add apps/platform-http/package.json \
  apps/platform-http/src/deploy/executor.ts \
  apps/platform-http/test/unit/deploy/executor.test.ts \
  packages/deploy/deploy-core/src/composed-project.ts
git commit -m "feat: pass workflow grpc proto registry into deploy planning"
```

---

### Task 3: Pass Workflow Subscriptions and Proto Registry Into the Rendered Worker

**Files:**
- Modify: `packages/deploy/deploy-core/src/plan.ts`
- Modify: `packages/deploy/deploy-core/src/workflows.ts`
- Modify: `packages/deploy/deploy-core/test/unit/plan-workflows.test.ts`
- Modify: `packages/deploy/deploy-dokploy/src/workflow-render.ts`
- Modify: `packages/deploy/deploy-dokploy/test/unit/render-workflows.test.ts`

- [ ] **Step 1: Write failing deploy-core tests**

In `packages/deploy/deploy-core/test/unit/plan-workflows.test.ts`, extend the happy-path project fixture:

```ts
const project: ComposedProjectInput = {
  // existing fields
  workflowGrpcServices: {
    orders: {
      packageName: 'rntme.orders.v1',
      serviceName: 'OrdersService',
      protoSource: 'syntax = "proto3"; package rntme.orders.v1; service OrdersService {}',
    },
    inventory: {
      packageName: 'rntme.inventory.v1',
      serviceName: 'InventoryService',
      protoSource: 'syntax = "proto3"; package rntme.inventory.v1; service InventoryService {}',
    },
  },
};
```

Extend the expected `bpmn-worker` workload:

```ts
grpcServices: {
  orders: expect.objectContaining({
    packageName: 'rntme.orders.v1',
    serviceName: 'OrdersService',
  }),
  inventory: expect.objectContaining({
    packageName: 'rntme.inventory.v1',
    serviceName: 'InventoryService',
  }),
},
```

Add a rejection case:

```ts
it('rejects workflow service tasks when proto config is missing for the target service', () => {
  const result = buildProjectDeploymentPlan(
    { ...project, workflowGrpcServices: { orders: project.workflowGrpcServices!.orders! } },
    {
      orgSlug: 'acme',
      environment: 'default',
      mode: 'preview',
      runtimeImage: 'ghcr.io/acme/runtime:v1',
      eventBus: { kind: 'kafka', mode: 'provisioned', provider: 'redpanda' },
      workflows: {
        engine: { kind: 'operaton', mode: 'provisioned', image: 'operaton/operaton:test' },
        worker: { image: 'ghcr.io/acme/bpmn-worker:v1' },
      },
    },
  );

  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        code: 'DEPLOY_PLAN_WORKFLOWS_BINDING_GRPC_PROTO_UNAVAILABLE',
        path: 'workflows.serviceTasks.0.bindingRef',
        service: 'inventory',
      }),
    );
  }
});
```

- [ ] **Step 2: Run deploy-core test to verify failure**

Run:

```bash
pnpm -F @rntme/deploy-core test -- test/unit/plan-workflows.test.ts
```

Expected: FAIL because `grpcServices` and the new error code are missing.

- [ ] **Step 3: Update deploy-core plan types and planner**

Modify `packages/deploy/deploy-core/src/plan.ts`:

```ts
export type PlannedWorkflowGrpcService = {
  readonly packageName: string;
  readonly serviceName: string;
  readonly protoSource: string;
};

export type BpmnWorkerWorkload = {
  readonly kind: 'bpmn-worker';
  readonly slug: 'bpmn-worker';
  readonly resourceName: string;
  readonly image: string;
  readonly workflowManifestPath: '/srv/workflows/workflows.json';
  readonly workflowFiles: Readonly<Record<string, string>>;
  readonly subscriptions: readonly PlannedWorkflowSubscription[];
  readonly serviceTasks: readonly PlannedWorkflowServiceTask[];
  readonly grpcServices: Readonly<Record<string, PlannedWorkflowGrpcService>>;
};
```

Modify `packages/deploy/deploy-core/src/workflows.ts` to validate and copy proto configs:

```ts
function buildGrpcServices(
  workflows: ValidatedWorkflows,
  project: ComposedProjectInput,
  errors: DeploymentPlanError[],
): Readonly<Record<string, PlannedWorkflowGrpcService>> {
  const services = new Set(workflows.serviceTasks.map((task) => task.bindingRef.split('.')[0] ?? '').filter(Boolean));
  const out: Record<string, PlannedWorkflowGrpcService> = {};
  for (const service of [...services].sort()) {
    const config = project.workflowGrpcServices?.[service];
    if (config === undefined) {
      errors.push({
        code: 'DEPLOY_PLAN_WORKFLOWS_BINDING_GRPC_PROTO_UNAVAILABLE',
        message: `workflow service tasks target service "${service}" without generated gRPC proto config`,
        path: `workflows.serviceTasks.${workflows.serviceTasks.findIndex((task) => task.bindingRef.startsWith(`${service}.`))}.bindingRef`,
        service,
      });
      continue;
    }
    out[service] = config;
  }
  return out;
}
```

Set `grpcServices: buildGrpcServices(workflows, input.project, input.errors)` when building the worker.

- [ ] **Step 4: Write failing render tests**

In `packages/deploy/deploy-dokploy/test/unit/render-workflows.test.ts`, extend the plan fixture's worker with `grpcServices`, then assert:

```ts
expect(worker.env).toContainEqual({
  name: 'RNTME_WORKFLOW_SUBSCRIPTIONS_JSON',
  value: JSON.stringify(plan.workloads.find((w) => w.kind === 'bpmn-worker')!.subscriptions),
  secret: false,
});
expect(worker.env).toContainEqual({
  name: 'RNTME_WORKFLOW_GRPC_SERVICES_JSON',
  value: JSON.stringify({
    inventory: {
      packageName: 'rntme.inventory.v1',
      serviceName: 'InventoryService',
      protoSource: expect.any(String),
    },
    orders: {
      packageName: 'rntme.orders.v1',
      serviceName: 'OrdersService',
      protoSource: expect.any(String),
    },
  }),
  secret: false,
});
```

Use exact strings instead of `expect.any(String)` if TypeScript rejects asymmetric matchers inside `JSON.stringify`.

- [ ] **Step 5: Render worker env**

Modify `packages/deploy/deploy-dokploy/src/workflow-render.ts`:

```ts
{
  name: 'RNTME_WORKFLOW_SUBSCRIPTIONS_JSON',
  value: JSON.stringify([...workload.subscriptions].sort((a, b) => a.messageStartId.localeCompare(b.messageStartId))),
  secret: false,
},
{
  name: 'RNTME_WORKFLOW_GRPC_SERVICES_JSON',
  value: JSON.stringify(Object.fromEntries(Object.entries(workload.grpcServices).sort(([a], [b]) => a.localeCompare(b)))),
  secret: false,
},
```

Keep existing `RNTME_WORKFLOW_SERVICE_ENDPOINTS_JSON` for binding-ref to `host:port` resolution.

- [ ] **Step 6: Run focused tests**

Run:

```bash
pnpm -F @rntme/deploy-core test -- test/unit/plan-workflows.test.ts
pnpm -F @rntme/deploy-dokploy test -- test/unit/render-workflows.test.ts
pnpm -F @rntme/deploy-core typecheck
pnpm -F @rntme/deploy-dokploy typecheck
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add packages/deploy/deploy-core/src/plan.ts \
  packages/deploy/deploy-core/src/workflows.ts \
  packages/deploy/deploy-core/test/unit/plan-workflows.test.ts \
  packages/deploy/deploy-dokploy/src/workflow-render.ts \
  packages/deploy/deploy-dokploy/test/unit/render-workflows.test.ts
git commit -m "feat: render workflow worker runtime config"
```

---

### Task 4: Make `@rntme/bpmn-worker` Configurable and Dockerizable

**Files:**
- Modify: `packages/runtime/bpmn-worker/package.json`
- Create: `packages/runtime/bpmn-worker/src/env.ts`
- Create: `packages/runtime/bpmn-worker/src/bin/worker.ts`
- Create: `packages/runtime/bpmn-worker/Dockerfile`
- Modify: `packages/runtime/bpmn-worker/src/config.ts`
- Modify: `packages/runtime/bpmn-worker/src/index.ts`
- Test: `packages/runtime/bpmn-worker/test/unit/env.test.ts`

- [ ] **Step 1: Write env parser tests**

Create `packages/runtime/bpmn-worker/test/unit/env.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { loadWorkerConfigFromEnv } from '../../src/env.js';

describe('loadWorkerConfigFromEnv', () => {
  it('loads worker config from rendered Dokploy env', () => {
    const config = loadWorkerConfigFromEnv({
      RNTME_EVENT_BUS_BROKERS: 'redpanda:9092',
      RNTME_EVENT_BUS_PROTOCOL: 'plaintext',
      RNTME_OPERATON_BASE_URL: 'http://operaton:8080/engine-rest',
      RNTME_WORKFLOWS_MANIFEST_PATH: '/srv/workflows/workflows.json',
      RNTME_WORKFLOW_SERVICE_ENDPOINTS_JSON: '{"inventory.reserveStock":"inventory:50051"}',
      RNTME_WORKFLOW_GRPC_SERVICES_JSON: '{"inventory":{"packageName":"rntme.inventory.v1","serviceName":"InventoryService","protoSource":"syntax = \\"proto3\\";"}}',
      RNTME_WORKFLOW_SUBSCRIPTIONS_JSON: '[{"messageStartId":"orderPlaced","topic":"rntme.orders.order","service":"orders","aggregateType":"Order","eventType":"OrderPlaced","processId":"orderFulfillment","messageName":"OrderPlaced","businessKey":"$event.data.orderId"}]',
    });

    expect(config.eventBusBrokers).toEqual(['redpanda:9092']);
    expect(config.workflowServiceEndpoints).toEqual({ 'inventory.reserveStock': 'inventory:50051' });
    expect(config.workflowGrpcServices?.inventory?.serviceName).toBe('InventoryService');
    expect(config.workflowSubscriptions[0]?.eventType).toBe('OrderPlaced');
  });

  it('throws a stable message when required env is missing', () => {
    expect(() => loadWorkerConfigFromEnv({})).toThrow('BPMN_WORKER_ENV_MISSING: RNTME_EVENT_BUS_BROKERS');
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
pnpm -F @rntme/bpmn-worker test -- test/unit/env.test.ts
```

Expected: FAIL because `loadWorkerConfigFromEnv` does not exist.

- [ ] **Step 3: Add package dependencies and bin**

Modify `packages/runtime/bpmn-worker/package.json`:

```json
"bin": {
  "rntme-bpmn-worker": "./dist/bin/worker.js"
},
"dependencies": {
  "@grpc/grpc-js": "^1.10.0",
  "@rntme/event-store": "workspace:*",
  "@rntme/workflows": "workspace:*",
  "kafkajs": "^2.2.4",
  "protobufjs": "^7.2.0"
}
```

- [ ] **Step 4: Implement env parser**

Create `packages/runtime/bpmn-worker/src/env.ts`:

```ts
import type {
  PlannedWorkflowSubscriptionInput,
  WorkerConfig,
  WorkflowGrpcServiceRegistry,
  WorkflowServiceEndpointMap,
} from './types.js';

export function loadWorkerConfigFromEnv(env: Record<string, string | undefined> = process.env): WorkerConfig {
  const brokers = required(env, 'RNTME_EVENT_BUS_BROKERS').split(',').map((part) => part.trim()).filter(Boolean);
  if (brokers.length === 0) throw new Error('BPMN_WORKER_ENV_INVALID: RNTME_EVENT_BUS_BROKERS');
  return {
    eventBusBrokers: brokers,
    eventBusProtocol: protocol(env['RNTME_EVENT_BUS_PROTOCOL'] ?? 'plaintext'),
    ...(env['RNTME_EVENT_BUS_TOPIC_PREFIX'] ? { topicPrefix: env['RNTME_EVENT_BUS_TOPIC_PREFIX'] } : {}),
    operatonBaseUrl: normalizeOperatonBaseUrl(required(env, 'RNTME_OPERATON_BASE_URL')),
    workflowsManifestPath: required(env, 'RNTME_WORKFLOWS_MANIFEST_PATH'),
    workflowServiceEndpoints: jsonRecord<WorkflowServiceEndpointMap>(
      env['RNTME_WORKFLOW_SERVICE_ENDPOINTS_JSON'] ?? '{}',
      'RNTME_WORKFLOW_SERVICE_ENDPOINTS_JSON',
    ),
    workflowGrpcServices: jsonRecord<WorkflowGrpcServiceRegistry>(
      env['RNTME_WORKFLOW_GRPC_SERVICES_JSON'] ?? '{}',
      'RNTME_WORKFLOW_GRPC_SERVICES_JSON',
    ),
    workflowSubscriptions: jsonArray(env['RNTME_WORKFLOW_SUBSCRIPTIONS_JSON'] ?? '[]', 'RNTME_WORKFLOW_SUBSCRIPTIONS_JSON'),
  };
}

function required(env: Record<string, string | undefined>, name: string): string {
  const value = env[name]?.trim();
  if (value === undefined || value === '') throw new Error(`BPMN_WORKER_ENV_MISSING: ${name}`);
  return value;
}

function protocol(value: string): 'plaintext' | 'sasl_ssl' {
  if (value === 'plaintext' || value === 'sasl_ssl') return value;
  throw new Error(`BPMN_WORKER_ENV_INVALID: RNTME_EVENT_BUS_PROTOCOL=${value}`);
}

function jsonRecord<T extends Record<string, unknown>>(value: string, name: string): T {
  const parsed = JSON.parse(value) as unknown;
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`BPMN_WORKER_ENV_INVALID: ${name}`);
  }
  return parsed as T;
}

function jsonArray(value: string, name: string): PlannedWorkflowSubscriptionInput[] {
  const parsed = JSON.parse(value) as unknown;
  if (!Array.isArray(parsed)) throw new Error(`BPMN_WORKER_ENV_INVALID: ${name}`);
  return parsed as PlannedWorkflowSubscriptionInput[];
}

function normalizeOperatonBaseUrl(value: string): string {
  const trimmed = value.replace(/\/+$/, '');
  return trimmed.endsWith('/engine-rest') ? trimmed : `${trimmed}/engine-rest`;
}
```

Add the missing `workflowSubscriptions` field and `PlannedWorkflowSubscriptionInput` type to `packages/runtime/bpmn-worker/src/types.ts`.

- [ ] **Step 5: Add executable entrypoint**

Create `packages/runtime/bpmn-worker/src/bin/worker.ts`:

```ts
#!/usr/bin/env node
import { runBpmnWorkerFromEnv } from '../run.js';

runBpmnWorkerFromEnv().catch((cause) => {
  console.error(cause);
  process.exitCode = 1;
});
```

Modify package `postbuild` if needed to add a shebang/chmod, matching `apps/cli/package.json` style:

```json
"postbuild": "node -e \"const f='dist/bin/worker.js';const fs=require('fs');if(!fs.existsSync(f))process.exit(0);const s=fs.readFileSync(f,'utf8');if(!s.startsWith('#!'))fs.writeFileSync(f,'#!/usr/bin/env node\\n'+s);fs.chmodSync(f,0o755);\""
```

- [ ] **Step 6: Add Dockerfile**

Create `packages/runtime/bpmn-worker/Dockerfile`:

```dockerfile
FROM node:20-alpine AS deps
WORKDIR /repo
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages ./packages
RUN pnpm install --frozen-lockfile

FROM deps AS build
RUN pnpm -F @rntme/bpmn-worker build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable
COPY --from=deps /repo/node_modules /app/node_modules
COPY --from=build /repo/packages/runtime/bpmn-worker/dist /app/dist
COPY --from=build /repo/packages/runtime/bpmn-worker/package.json /app/package.json
CMD ["node", "/app/dist/bin/worker.js"]
```

- [ ] **Step 7: Export public helpers**

Modify `packages/runtime/bpmn-worker/src/config.ts` and `src/index.ts`:

```ts
export { loadWorkerConfigFromEnv } from './env.js';
export { runBpmnWorkerFromEnv, runBpmnWorker } from './run.js';
```

- [ ] **Step 8: Run focused checks**

Run:

```bash
pnpm -F @rntme/bpmn-worker test -- test/unit/env.test.ts
pnpm -F @rntme/bpmn-worker build
pnpm -F @rntme/bpmn-worker typecheck
docker build -f packages/runtime/bpmn-worker/Dockerfile -t rntme-bpmn-worker:e2e .
```

Expected: tests, build, typecheck, and Docker image build pass.

- [ ] **Step 9: Commit**

```bash
git add packages/runtime/bpmn-worker/package.json \
  packages/runtime/bpmn-worker/src/env.ts \
  packages/runtime/bpmn-worker/src/bin/worker.ts \
  packages/runtime/bpmn-worker/src/config.ts \
  packages/runtime/bpmn-worker/src/index.ts \
  packages/runtime/bpmn-worker/src/types.ts \
  packages/runtime/bpmn-worker/Dockerfile \
  packages/runtime/bpmn-worker/test/unit/env.test.ts
git commit -m "feat: make bpmn worker deployable"
```

---

### Task 5: Implement Operaton REST Client

**Files:**
- Create: `packages/runtime/bpmn-worker/src/operaton-rest.ts`
- Modify: `packages/runtime/bpmn-worker/src/operaton.ts`
- Test: `packages/runtime/bpmn-worker/test/unit/operaton-rest.test.ts`

- [ ] **Step 1: Write client tests against a fake fetch**

Create `packages/runtime/bpmn-worker/test/unit/operaton-rest.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createOperatonRestClient } from '../../src/operaton-rest.js';

describe('createOperatonRestClient', () => {
  it('deploys BPMN definitions through deployment/create', async () => {
    const calls: Array<{ url: string; method?: string }> = [];
    const client = createOperatonRestClient({
      baseUrl: 'http://operaton:8080/engine-rest',
      workerId: 'worker-1',
      topics: ['reserveStock'],
      fetch: async (url, init) => {
        calls.push({ url: String(url), method: init?.method });
        return new Response('{}', { status: 200 });
      },
    });

    await client.deployDefinitions({ 'order-fulfillment.bpmn': '<definitions />' });

    expect(calls).toEqual([{ url: 'http://operaton:8080/engine-rest/deployment/create', method: 'POST' }]);
  });

  it('correlates message starts and returns the process instance id', async () => {
    const bodies: unknown[] = [];
    const client = createOperatonRestClient({
      baseUrl: 'http://operaton:8080/engine-rest',
      workerId: 'worker-1',
      topics: ['reserveStock'],
      fetch: async (_url, init) => {
        bodies.push(JSON.parse(String(init?.body)));
        return new Response(JSON.stringify([{ processInstance: { id: 'proc_1' } }]), { status: 200 });
      },
    });

    const result = await client.startProcess({
      processId: 'orderFulfillment',
      messageName: 'OrderPlaced',
      businessKey: 'ord_1',
      variables: { orderId: 'ord_1', quantity: 1 },
    });

    expect(result).toEqual({ processInstanceId: 'proc_1' });
    expect(bodies[0]).toMatchObject({
      messageName: 'OrderPlaced',
      businessKey: 'ord_1',
      resultEnabled: true,
      processVariables: {
        orderId: { value: 'ord_1', type: 'String' },
        quantity: { value: 1, type: 'Integer' },
      },
    });
  });

  it('fetches, completes, and fails external tasks with the configured worker id', async () => {
    const calls: Array<{ url: string; body: unknown }> = [];
    const client = createOperatonRestClient({
      baseUrl: 'http://operaton:8080/engine-rest',
      workerId: 'worker-1',
      topics: ['reserveStock'],
      fetch: async (url, init) => {
        calls.push({ url: String(url), body: init?.body === undefined ? null : JSON.parse(String(init.body)) });
        if (String(url).endsWith('/external-task/fetchAndLock')) {
          return new Response(JSON.stringify([
            {
              id: 'task_1',
              activityId: 'reserveStock',
              processInstanceId: 'proc_1',
              activityInstanceId: 'act_1',
              variables: { orderId: { value: 'ord_1' } },
            },
          ]), { status: 200 });
        }
        return new Response('{}', { status: 200 });
      },
    });

    expect(await client.fetchAndLock()).toEqual([
      {
        id: 'task_1',
        taskId: 'reserveStock',
        processInstanceId: 'proc_1',
        activityInstanceId: 'act_1',
        variables: { orderId: 'ord_1' },
      },
    ]);
    await client.completeTask('task_1', { reservation: { reserved: true } });
    await client.failTask('task_1', 'inventory unavailable');

    expect(calls.map((call) => call.url)).toEqual([
      'http://operaton:8080/engine-rest/external-task/fetchAndLock',
      'http://operaton:8080/engine-rest/external-task/task_1/complete',
      'http://operaton:8080/engine-rest/external-task/task_1/failure',
    ]);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
pnpm -F @rntme/bpmn-worker test -- test/unit/operaton-rest.test.ts
```

Expected: FAIL because `createOperatonRestClient` is missing.

- [ ] **Step 3: Implement REST client**

Create `packages/runtime/bpmn-worker/src/operaton-rest.ts`:

```ts
import type { OperatonClient, OperatonStartProcessInput, OperatonTask } from './operaton.js';

export type OperatonRestClient = OperatonClient & {
  readonly deployDefinitions: (files: Readonly<Record<string, string>>) => Promise<void>;
};

export function createOperatonRestClient(options: {
  readonly baseUrl: string;
  readonly workerId: string;
  readonly topics: readonly string[];
  readonly fetch?: typeof globalThis.fetch;
  readonly lockDurationMs?: number;
  readonly maxTasks?: number;
  readonly asyncResponseTimeoutMs?: number;
}): OperatonRestClient {
  const httpFetch = options.fetch ?? globalThis.fetch;
  const baseUrl = options.baseUrl.replace(/\/+$/, '');
  const lockDuration = options.lockDurationMs ?? 30_000;
  const maxTasks = options.maxTasks ?? 8;
  const asyncResponseTimeout = options.asyncResponseTimeoutMs ?? 10_000;

  async function json<T>(path: string, body: unknown): Promise<T> {
    const response = await httpFetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`OPERATON_HTTP_${response.status}: ${await response.text()}`);
    const text = await response.text();
    return (text.trim() === '' ? {} : JSON.parse(text)) as T;
  }

  return {
    async deployDefinitions(files) {
      const form = new FormData();
      form.set('deployment-name', 'rntme-workflows');
      form.set('enable-duplicate-filtering', 'true');
      for (const [name, content] of Object.entries(files).filter(([path]) => path.endsWith('.bpmn'))) {
        form.set(name, new Blob([content], { type: 'application/xml' }), name);
      }
      const response = await httpFetch(`${baseUrl}/deployment/create`, { method: 'POST', body: form });
      if (!response.ok) throw new Error(`OPERATON_HTTP_${response.status}: ${await response.text()}`);
    },
    async startProcess(input: OperatonStartProcessInput) {
      const result = await json<Array<{ processInstance?: { id?: string } }>>('/message', {
        messageName: input.messageName,
        businessKey: input.businessKey,
        processVariables: toOperatonVariables(input.variables),
        resultEnabled: true,
      });
      const id = result[0]?.processInstance?.id;
      if (typeof id !== 'string' || id === '') {
        throw new Error(`OPERATON_MESSAGE_NOT_CORRELATED: ${input.messageName}`);
      }
      return { processInstanceId: id };
    },
    async fetchAndLock() {
      const result = await json<readonly OperatonExternalTask[]>('/external-task/fetchAndLock', {
        workerId: options.workerId,
        maxTasks,
        usePriority: true,
        asyncResponseTimeout,
        topics: options.topics.map((topicName) => ({ topicName, lockDuration })),
      });
      return result.map(toTask);
    },
    async completeTask(taskId, variables) {
      await json(`/external-task/${encodeURIComponent(taskId)}/complete`, {
        workerId: options.workerId,
        variables: toOperatonVariables(variables),
      });
    },
    async failTask(taskId, message) {
      await json(`/external-task/${encodeURIComponent(taskId)}/failure`, {
        workerId: options.workerId,
        errorMessage: message.slice(0, 666),
        errorDetails: message,
        retries: 0,
        retryTimeout: 0,
      });
    },
  };
}

type OperatonExternalTask = {
  readonly id: string;
  readonly activityId?: string;
  readonly taskId?: string;
  readonly processInstanceId: string;
  readonly activityInstanceId: string;
  readonly variables?: Readonly<Record<string, { readonly value?: unknown }>>;
};

function toTask(task: OperatonExternalTask): OperatonTask {
  return {
    id: task.id,
    taskId: task.activityId ?? task.taskId ?? '',
    processInstanceId: task.processInstanceId,
    activityInstanceId: task.activityInstanceId,
    variables: Object.fromEntries(Object.entries(task.variables ?? {}).map(([key, value]) => [key, value.value])),
  };
}

function toOperatonVariables(input: unknown): Record<string, { value: unknown; type: string }> {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) return {};
  return Object.fromEntries(Object.entries(input as Record<string, unknown>).map(([key, value]) => [key, toVariable(value)]));
}

function toVariable(value: unknown): { value: unknown; type: string } {
  if (Number.isInteger(value)) return { value, type: 'Integer' };
  if (typeof value === 'number') return { value, type: 'Double' };
  if (typeof value === 'boolean') return { value, type: 'Boolean' };
  if (value === null) return { value: null, type: 'Null' };
  if (typeof value === 'object') return { value: JSON.stringify(value), type: 'Json' };
  return { value: String(value), type: 'String' };
}
```

- [ ] **Step 4: Export the client**

Modify `packages/runtime/bpmn-worker/src/index.ts`:

```ts
export { createOperatonRestClient } from './operaton-rest.js';
export type { OperatonRestClient } from './operaton-rest.js';
```

- [ ] **Step 5: Run focused checks**

Run:

```bash
pnpm -F @rntme/bpmn-worker test -- test/unit/operaton-rest.test.ts test/integration/worker.test.ts
pnpm -F @rntme/bpmn-worker typecheck
```

Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add packages/runtime/bpmn-worker/src/operaton-rest.ts \
  packages/runtime/bpmn-worker/src/operaton.ts \
  packages/runtime/bpmn-worker/src/index.ts \
  packages/runtime/bpmn-worker/test/unit/operaton-rest.test.ts
git commit -m "feat: add operaton rest client"
```

---

### Task 6: Add Kafka Event Intake and Worker Run Loop

**Files:**
- Create: `packages/runtime/bpmn-worker/src/kafka-consumer.ts`
- Create: `packages/runtime/bpmn-worker/src/run.ts`
- Modify: `packages/runtime/bpmn-worker/src/types.ts`
- Modify: `packages/runtime/bpmn-worker/src/index.ts`
- Test: `packages/runtime/bpmn-worker/test/unit/kafka-consumer.test.ts`
- Test: `packages/runtime/bpmn-worker/test/integration/worker.test.ts`

- [ ] **Step 1: Write Kafka consumer codec tests**

Create `packages/runtime/bpmn-worker/test/unit/kafka-consumer.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { toCloudEventWire, type EventEnvelope } from '@rntme/event-store';
import { decodeKafkaJsMessage } from '../../src/kafka-consumer.js';

describe('decodeKafkaJsMessage', () => {
  it('decodes KafkaJS buffers through the event-store CloudEvents codec', () => {
    const envelope: EventEnvelope = {
      id: 'evt_1',
      source: 'rntme://services/orders',
      specversion: '1.0',
      type: 'orders.Order.OrderPlaced.v1',
      subject: 'Order:ord_1',
      time: '2026-05-06T00:00:00.000Z',
      datacontenttype: 'application/json',
      dataschema: 'rntme://schemas/orders/Order/OrderPlaced/v1',
      data: { orderId: 'ord_1' },
      rntAggregateType: 'Order',
      rntAggregateId: 'ord_1',
      rntVersion: 1,
      rntSchemaVersion: 1,
      rntActorKind: 'system',
      rntActorId: 'test',
      correlationId: 'corr_1',
      causationId: null,
      commandId: null,
      traceparent: null,
    };
    const wire = toCloudEventWire(envelope, 'rntme.orders.order');
    const decoded = decodeKafkaJsMessage({
      key: Buffer.from(wire.key),
      value: Buffer.from(wire.value),
      headers: Object.fromEntries(Object.entries(wire.headers).map(([key, value]) => [key, Buffer.from(value)])),
    });

    expect(decoded.id).toBe('evt_1');
    expect(decoded.data).toEqual({ orderId: 'ord_1' });
  });
});
```

- [ ] **Step 2: Write run-loop integration test with fakes**

Add to `packages/runtime/bpmn-worker/test/integration/worker.test.ts`:

```ts
import { runBpmnWorker } from '../../src/run.js';

it('consumes matching workflow events and commits after processing', async () => {
  const calls: string[] = [];
  const consumer = {
    async *events() {
      yield {
        envelope: createEvent(),
        eventRef: { service: 'orders', aggregateType: 'Order', eventType: 'OrderPlaced' },
        commit: async () => { calls.push('commit'); },
      };
    },
    stop: async () => { calls.push('stop'); },
  };

  await runBpmnWorker({
    manifest: createManifest(),
    subscriptions: [{
      messageStartId: 'orderPlaced',
      topic: 'rntme.orders.order',
      service: 'orders',
      aggregateType: 'Order',
      eventType: 'OrderPlaced',
      processId: 'orderFulfillment',
      messageName: 'OrderPlaced',
      businessKey: '$event.data.orderId',
    }],
    operaton: createOperaton(calls),
    commands: createCommands(calls),
    consumer,
    stopAfterEvents: 1,
  });

  expect(calls).toEqual([
    'start:orderFulfillment:ord_1',
    'command:inventory.reserveStock:ord_1:bpmn:proc_1:reserveStock:act_1',
    'complete:task_1:true',
    'commit',
    'stop',
  ]);
});
```

- [ ] **Step 3: Run tests to verify failure**

Run:

```bash
pnpm -F @rntme/bpmn-worker test -- test/unit/kafka-consumer.test.ts test/integration/worker.test.ts
```

Expected: FAIL because consumer/run-loop code is missing.

- [ ] **Step 4: Implement KafkaJS decoder and consumer adapter**

Create `packages/runtime/bpmn-worker/src/kafka-consumer.ts`:

```ts
import { fromCloudEventWire, type EventEnvelope, type KafkaMessage } from '@rntme/event-store';
import type { WorkflowEventRef } from '@rntme/workflows';
import type { PlannedWorkflowSubscriptionInput, WorkflowEventConsumer } from './types.js';

type KafkaJsMessage = {
  readonly key?: Buffer | null;
  readonly value?: Buffer | null;
  readonly headers?: Record<string, Buffer | string | undefined>;
};

export function decodeKafkaJsMessage(message: KafkaJsMessage): EventEnvelope {
  const wire: KafkaMessage = {
    topic: '',
    key: message.key?.toString('utf8') ?? '',
    value: message.value?.toString('utf8') ?? '{}',
    headers: Object.fromEntries(
      Object.entries(message.headers ?? {}).map(([key, value]) => [
        key,
        Buffer.isBuffer(value) ? value.toString('utf8') : String(value ?? ''),
      ]),
    ),
  };
  return fromCloudEventWire(wire);
}

export async function createKafkaWorkflowConsumer(input: {
  readonly brokers: readonly string[];
  readonly clientId: string;
  readonly groupId: string;
  readonly subscriptions: readonly PlannedWorkflowSubscriptionInput[];
}): Promise<WorkflowEventConsumer> {
  const { Kafka } = await import('kafkajs');
  const kafka = new Kafka({ clientId: input.clientId, brokers: [...input.brokers] });
  const consumer = kafka.consumer({ groupId: input.groupId });
  const queue: Array<{ envelope: EventEnvelope; eventRef: WorkflowEventRef; commit: () => Promise<void> }> = [];
  let waiter: (() => void) | null = null;
  const byTopic = new Map(input.subscriptions.map((sub) => [sub.topic, sub]));

  await consumer.connect();
  for (const topic of [...new Set(input.subscriptions.map((sub) => sub.topic))].sort()) {
    await consumer.subscribe({ topic, fromBeginning: false });
  }
  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      const sub = byTopic.get(topic);
      if (sub === undefined) return;
      const envelope = decodeKafkaJsMessage(message);
      queue.push({
        envelope,
        eventRef: { service: sub.service, aggregateType: sub.aggregateType, eventType: sub.eventType },
        commit: async () => undefined,
      });
      waiter?.();
      waiter = null;
    },
  });

  return {
    async *events() {
      while (true) {
        if (queue.length === 0) {
          await new Promise<void>((resolve) => { waiter = resolve; });
        }
        const next = queue.shift();
        if (next !== undefined) yield next;
      }
    },
    stop: async () => {
      await consumer.disconnect();
    },
  };
}
```

- [ ] **Step 5: Implement run loop and env entry**

Create `packages/runtime/bpmn-worker/src/run.ts`:

```ts
import { readFile } from 'node:fs/promises';
import { createGrpcCommandClient } from './command-client.js';
import { loadWorkerConfigFromEnv } from './env.js';
import { createKafkaWorkflowConsumer } from './kafka-consumer.js';
import { createOperatonRestClient } from './operaton-rest.js';
import { runWorkflowEventOnce } from './worker.js';
import type { LoadedWorkerManifest, PlannedWorkflowSubscriptionInput, WorkflowEventConsumer } from './types.js';

export async function runBpmnWorker(input: {
  readonly manifest: LoadedWorkerManifest;
  readonly subscriptions: readonly PlannedWorkflowSubscriptionInput[];
  readonly operaton: Parameters<typeof runWorkflowEventOnce>[0]['operaton'];
  readonly commands: Parameters<typeof runWorkflowEventOnce>[0]['commands'];
  readonly consumer: WorkflowEventConsumer;
  readonly stopAfterEvents?: number;
}): Promise<void> {
  let processed = 0;
  try {
    for await (const event of input.consumer.events()) {
      await runWorkflowEventOnce({
        manifest: input.manifest,
        event: event.envelope,
        eventRef: event.eventRef,
        operaton: input.operaton,
        commands: input.commands,
      });
      await event.commit();
      processed += 1;
      if (input.stopAfterEvents !== undefined && processed >= input.stopAfterEvents) break;
    }
  } finally {
    await input.consumer.stop();
  }
}

export async function runBpmnWorkerFromEnv(env: Record<string, string | undefined> = process.env): Promise<void> {
  const config = loadWorkerConfigFromEnv(env);
  const manifest = JSON.parse(await readFile(config.workflowsManifestPath, 'utf8')) as LoadedWorkerManifest;
  const topics = [...new Set(manifest.serviceTasks.map((task) => task.taskId))].sort();
  const operaton = createOperatonRestClient({
    baseUrl: config.operatonBaseUrl,
    workerId: `rntme-bpmn-worker-${process.pid}`,
    topics,
  });
  await operaton.deployDefinitions(
    Object.fromEntries(
      await Promise.all(
        manifest.definitions.map(async (definition) => [
          definition.bpmnFile,
          await readFile(`/srv/workflows/${definition.bpmnFile}`, 'utf8'),
        ]),
      ),
    ),
  );
  const commands = createGrpcCommandClient({
    endpoints: config.workflowServiceEndpoints ?? {},
    services: config.workflowGrpcServices ?? {},
  });
  const consumer = await createKafkaWorkflowConsumer({
    brokers: config.eventBusBrokers,
    clientId: 'rntme-bpmn-worker',
    groupId: `rntme-bpmn-worker-${process.env['HOSTNAME'] ?? 'local'}`,
    subscriptions: config.workflowSubscriptions,
  });
  await runBpmnWorker({ manifest, subscriptions: config.workflowSubscriptions, operaton, commands, consumer });
}
```

Extend `WorkerConfig` in `types.ts` with:

```ts
export type PlannedWorkflowSubscriptionInput = {
  readonly messageStartId: string;
  readonly topic: string;
  readonly service: string;
  readonly aggregateType: string;
  readonly eventType: string;
  readonly processId: string;
  readonly messageName: string;
  readonly businessKey: string;
};

export type WorkflowEventConsumer = {
  readonly events: () => AsyncIterable<{
    readonly envelope: EventEnvelopeLike;
    readonly eventRef: WorkflowEventRef;
    readonly commit: () => Promise<void>;
  }>;
  readonly stop: () => Promise<void>;
};
```

Import `WorkflowEventRef` from `@rntme/workflows` in `types.ts`.

- [ ] **Step 6: Run focused checks**

Run:

```bash
pnpm -F @rntme/bpmn-worker test -- test/unit/kafka-consumer.test.ts test/unit/env.test.ts test/unit/operaton-rest.test.ts test/integration/worker.test.ts
pnpm -F @rntme/bpmn-worker build
pnpm -F @rntme/bpmn-worker lint
```

Expected: pass.

- [ ] **Step 7: Commit**

```bash
git add packages/runtime/bpmn-worker/src/kafka-consumer.ts \
  packages/runtime/bpmn-worker/src/run.ts \
  packages/runtime/bpmn-worker/src/types.ts \
  packages/runtime/bpmn-worker/src/index.ts \
  packages/runtime/bpmn-worker/test/unit/kafka-consumer.test.ts \
  packages/runtime/bpmn-worker/test/integration/worker.test.ts
git commit -m "feat: run bpmn worker from kafka events"
```

---

### Task 7: Implement the Real Dokploy Order-Fulfillment E2E

**Files:**
- Modify: `apps/platform-http/test/e2e/order-fulfillment-dokploy-live.test.ts`
- Modify: `apps/platform-http/test/e2e/live-dokploy-env.ts`
- Test: `apps/platform-http/test/e2e/order-fulfillment-dokploy-live.test.ts`

- [ ] **Step 1: Fill the live e2e test**

Replace the shell test with a full flow:

```ts
import { gunzipSync } from 'node:zlib';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { createDokployClientFactory } from '../../src/deploy/dokploy-client-factory.js';
import { runDeployment } from '../../src/deploy/executor.js';
import { SmokeVerifier } from '../../src/deploy/smoke-verifier.js';
import { resolveDeps } from '../../src/resolve-deps.js';
import { bootE2e, type E2eEnv } from './harness.js';
import { buildProjectBundleForE2e } from './project-bundle-helper.js';
import { readLiveDokployEnv } from './live-dokploy-env.js';
import { seedOrgWithToken } from './seed-auth-helper.js';
import { isOk } from '@rntme/platform-core';
import { deleteDokployResources } from '@rntme/deploy-dokploy';

const live = readLiveDokployEnv();

describe.skipIf(!live.enabled)(`live Dokploy order fulfillment${live.enabled ? '' : ` (${live.reason})`}`, () => {
  let env: E2eEnv;

  beforeAll(async () => {
    env = await bootE2e();
  }, 300_000);

  afterAll(async () => {
    await env.teardown();
  });

  it('deploys Operaton and demo services, then proves confirmed and cancelled branches', async () => {
    if (!live.enabled) throw new Error(live.reason);
    const suffix = randomUUID().replace(/-/g, '').slice(0, 8);
    const orgSlug = `bpmn-e2e-${suffix}`;
    const projectSlug = `order-${suffix}`;
    const auth = await seedOrgWithToken(env, orgSlug, `bpmn_org_${suffix}`, `bpmn_user_${suffix}`);
    let deploymentId: string | null = null;

    try {
      await expectStatus(env.app.request(`/v1/orgs/${orgSlug}/projects`, {
        method: 'POST',
        headers: jsonAuth(auth.plain),
        body: JSON.stringify({ slug: projectSlug, displayName: 'Order Fulfillment E2E' }),
      }), 201);

      const bundle = buildProjectBundleForE2e(fileURLToPath(new URL('../../../../demo/order-fulfillment-blueprint', import.meta.url)));
      const published = await expectStatus(env.app.request(`/v1/orgs/${orgSlug}/projects/${projectSlug}/versions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/rntme-project-bundle+json',
          authorization: `Bearer ${auth.plain}`,
        },
        body: bundle.bytes,
      }), 201);
      const publishedJson = await published.json() as { version: { bundleBlobKey: string } };
      const stored = await env.deps.blob.getRaw(publishedJson.version.bundleBlobKey);
      expect(isOk(stored)).toBe(true);
      if (isOk(stored)) expect(gunzipSync(stored.value).toString('utf8')).toBe(bundle.bytes);

      await expectStatus(env.app.request(`/v1/orgs/${orgSlug}/deploy-targets`, {
        method: 'POST',
        headers: jsonAuth(auth.plain),
        body: JSON.stringify({
          slug: 'live',
          displayName: 'Live Dokploy',
          kind: 'dokploy',
          dokployUrl: live.dokployUrl,
          dokployProjectId: live.dokployProjectId,
          allowCreateProject: false,
          apiToken: live.dokployApiToken,
          eventBus: {
            kind: 'kafka',
            mode: 'provisioned',
            provider: 'redpanda',
            ...(live.redpandaImage === undefined ? {} : { image: live.redpandaImage }),
            topicPrefix: `rntme.${suffix}`,
          },
          workflows: {
            engine: { kind: 'operaton', mode: 'provisioned', image: live.operatonImage },
            worker: { image: live.bpmnWorkerImage },
          },
          modules: {},
          auth: {},
          policyValues: { requestContext: { default: {} } },
          isDefault: true,
        }),
      }), 201);

      const queued = await expectStatus(env.app.request(`/v1/orgs/${orgSlug}/projects/${projectSlug}/deployments`, {
        method: 'POST',
        headers: jsonAuth(auth.plain),
        body: JSON.stringify({
          projectVersionSeq: 1,
          targetSlug: 'live',
          configOverrides: {
            runtimeImage: live.runtimeImage,
            policyOverrides: { requestContext: { default: {} } },
          },
        }),
      }), 202);
      deploymentId = ((await queued.json()) as { deployment: { id: string } }).deployment.id;

      await runDeployment(deploymentId, auth.orgId, deploymentDeps(env, orgSlug, live.publicDeployDomain));

      const show = await expectStatus(env.app.request(`/v1/orgs/${orgSlug}/projects/${projectSlug}/deployments/${deploymentId}`, {
        headers: { authorization: `Bearer ${auth.plain}` },
      }), 200);
      const showJson = await show.json() as { deployment: { status: string; applyResult: { resources?: unknown[] } | null } };
      expect(showJson.deployment.status, JSON.stringify(showJson.deployment)).toBe('succeeded');
      expect(showJson.deployment.applyResult?.resources).toEqual(expect.arrayContaining([
        expect.objectContaining({ infrastructureKind: 'event-bus' }),
        expect.objectContaining({ infrastructureKind: 'workflow-engine' }),
        expect.objectContaining({ kind: 'bpmn-worker' }),
        expect.objectContaining({ workloadSlug: 'orders' }),
        expect.objectContaining({ workloadSlug: 'inventory' }),
        expect.objectContaining({ workloadSlug: 'edge' }),
      ]));

      const baseUrl = `https://${orgSlug}-${projectSlug}-default.${live.publicDeployDomain}`;
      const confirmed = await placeOrder(baseUrl, { sku: 'sku-ok', quantity: 1 });
      await waitForOrder(baseUrl, confirmed.aggregateId, (order) =>
        order.status === 'confirmed' && typeof order.reservationId === 'string',
      );

      const cancelled = await placeOrder(baseUrl, { sku: 'missing-stock', quantity: 1 });
      await waitForOrder(baseUrl, cancelled.aggregateId, (order) =>
        order.status === 'cancelled' && order.cancelReason === 'insufficient stock',
      );
    } finally {
      if (deploymentId !== null) await cleanupDeploymentResources(env, auth.orgId, deploymentId);
    }
  }, live.enabled ? live.httpTimeoutMs + 300_000 : 10_000);
});
```

- [ ] **Step 2: Add test helper functions in the same file**

Append helpers below the test:

```ts
function jsonAuth(token: string): Record<string, string> {
  return { 'content-type': 'application/json', authorization: `Bearer ${token}` };
}

async function expectStatus(responsePromise: Promise<Response>, status: number): Promise<Response> {
  const response = await responsePromise;
  expect(response.status, await response.clone().text()).toBe(status);
  return response;
}

function deploymentDeps(env: E2eEnv, orgSlug: string, publicDeployDomain: string) {
  return {
    blob: env.deps.blob,
    withOrgTx: async <T>(orgId: string, fn: (repos: ReturnType<typeof resolveDeps>) => Promise<T>) => {
      const client = await env.deps.pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(`SELECT set_config('app.org_id', $1, true)`, [orgId]);
        const result = await fn(resolveDeps(client));
        await client.query('COMMIT');
        return result;
      } catch (cause) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw cause;
      } finally {
        client.release();
      }
    },
    orgSlugFor: async () => orgSlug,
    dokployClientFactory: createDokployClientFactory(env.deps.cipher!),
    smoker: new SmokeVerifier(fetchSmoke),
    logger: env.deps.logger,
    publicDeployDomain,
    resolveProvisioner: async () => {
      throw new Error('live order-fulfillment demo does not declare provisioner modules');
    },
    targetSecretsRepoFor: async () => ({
      list: async () => [],
      upsert: async () => undefined,
      remove: async () => undefined,
      getAllDecrypted: async () => ({}),
    }),
    secretCipher: env.deps.cipher!,
    lastSuccessfulProvisionOutputs: async () => ({}),
  };
}

async function fetchSmoke(url: string): Promise<{ status: number | 'error'; latencyMs: number; contentType?: string; body?: string }> {
  const started = Date.now();
  try {
    const response = await fetch(url);
    return {
      status: response.status,
      latencyMs: Date.now() - started,
      contentType: response.headers.get('content-type') ?? undefined,
      body: await response.text(),
    };
  } catch (cause) {
    return { status: 'error', latencyMs: Date.now() - started, body: String(cause) };
  }
}

type CommandResult = { readonly aggregateId: string };
type OrderView = {
  readonly id: string;
  readonly sku: string;
  readonly quantity: number;
  readonly reservationId?: string | null;
  readonly cancelReason?: string | null;
  readonly status: string;
};

async function placeOrder(baseUrl: string, input: { sku: string; quantity: number }): Promise<CommandResult> {
  const response = await fetch(`${baseUrl}/api/orders/orders`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  expect(response.status, await response.clone().text()).toBe(200);
  const body = await response.json() as Partial<CommandResult>;
  if (typeof body.aggregateId !== 'string' || body.aggregateId === '') {
    throw new Error(`PLACE_ORDER_RESPONSE_INVALID: ${JSON.stringify(body)}`);
  }
  return { aggregateId: body.aggregateId };
}

async function waitForOrder(
  baseUrl: string,
  orderId: string,
  predicate: (order: OrderView) => boolean,
): Promise<OrderView> {
  const deadline = Date.now() + 180_000;
  let last: unknown;
  while (Date.now() < deadline) {
    const response = await fetch(`${baseUrl}/api/orders/orders/${encodeURIComponent(orderId)}`);
    if (response.status === 200) {
      last = await response.json();
      const order = Array.isArray(last) ? last[0] : last;
      if (order && typeof order === 'object' && predicate(order as OrderView)) return order as OrderView;
    } else {
      last = await response.text();
    }
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  throw new Error(`ORDER_STATE_TIMEOUT: ${orderId}: ${JSON.stringify(last)}`);
}

async function cleanupDeploymentResources(env: E2eEnv, orgId: string, deploymentId: string): Promise<void> {
  const targetAndResources = await withOrgTx(env, orgId, async (repos) => {
    const deployment = await repos.deployments.getById(deploymentId);
    if (!deployment.ok || deployment.value === null || deployment.value.applyResult === null) return null;
    const target = await repos.deployTargets.getWithSecretById(deployment.value.targetId);
    if (!target.ok || target.value === null) return null;
    const resources = Array.isArray(deployment.value.applyResult.resources)
      ? deployment.value.applyResult.resources.filter(isDeleteResource)
      : [];
    return { target: target.value, resources };
  });
  if (targetAndResources === null || targetAndResources.resources.length === 0) return;
  const result = await deleteDokployResources(
    targetAndResources.resources,
    createDokployClientFactory(env.deps.cipher!)(targetAndResources.target),
  );
  if (!result.ok) throw new Error(`DOKPLOY_E2E_CLEANUP_FAILED: ${JSON.stringify(result.errors)}`);
}

async function withOrgTx<T>(env: E2eEnv, orgId: string, fn: (repos: ReturnType<typeof resolveDeps>) => Promise<T>): Promise<T> {
  const client = await env.deps.pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SELECT set_config('app.org_id', $1, true)`, [orgId]);
    const result = await fn(resolveDeps(client));
    await client.query('COMMIT');
    return result;
  } catch (cause) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw cause;
  } finally {
    client.release();
  }
}

function isDeleteResource(value: unknown): value is { resourceKind: 'application' | 'compose'; targetResourceId: string; targetResourceName: string } {
  if (value === null || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    (candidate.resourceKind === 'application' || candidate.resourceKind === 'compose') &&
    typeof candidate.targetResourceId === 'string' &&
    typeof candidate.targetResourceName === 'string'
  );
}
```

- [ ] **Step 3: Run skipped test locally**

Run without live env:

```bash
pnpm -F @rntme/platform-http test -- test/e2e/order-fulfillment-dokploy-live.test.ts
```

Expected: skipped.

- [ ] **Step 4: Run live test against Dokploy**

Build and push images first:

```bash
docker build -f packages/runtime/runtime/Dockerfile -t "$RNTME_E2E_RUNTIME_IMAGE" .
docker push "$RNTME_E2E_RUNTIME_IMAGE"
docker build -f packages/runtime/bpmn-worker/Dockerfile -t "$RNTME_E2E_BPMN_WORKER_IMAGE" .
docker push "$RNTME_E2E_BPMN_WORKER_IMAGE"
```

Run:

```bash
RNTME_DOKPLOY_E2E=1 \
RNTME_DOKPLOY_URL="$RNTME_DOKPLOY_URL" \
RNTME_DOKPLOY_API_TOKEN="$RNTME_DOKPLOY_API_TOKEN" \
RNTME_DOKPLOY_PROJECT_ID="$RNTME_DOKPLOY_PROJECT_ID" \
RNTME_DOKPLOY_PUBLIC_DEPLOY_DOMAIN="$RNTME_DOKPLOY_PUBLIC_DEPLOY_DOMAIN" \
RNTME_E2E_RUNTIME_IMAGE="$RNTME_E2E_RUNTIME_IMAGE" \
RNTME_E2E_BPMN_WORKER_IMAGE="$RNTME_E2E_BPMN_WORKER_IMAGE" \
RNTME_E2E_OPERATON_IMAGE="$RNTME_E2E_OPERATON_IMAGE" \
pnpm -F @rntme/platform-http test -- test/e2e/order-fulfillment-dokploy-live.test.ts
```

Expected: deployment succeeds; resources include Redpanda compose, Operaton compose, `orders`, `inventory`, `bpmn-worker`, and `edge`; confirmed and cancelled order assertions pass; cleanup deletes created apps/composes.

- [ ] **Step 5: Commit**

```bash
git add apps/platform-http/test/e2e/order-fulfillment-dokploy-live.test.ts \
  apps/platform-http/test/e2e/live-dokploy-env.ts
git commit -m "test: add live dokploy operaton e2e"
```

---

### Task 8: Documentation Touch

**Files:**
- Modify: `packages/runtime/bpmn-worker/README.md`
- Modify: `demo/order-fulfillment-blueprint/README.md`
- Modify: `docs/superpowers/specs/2026-05-05-provisioned-bpmn-operaton-design.md`
- Modify: `AGENTS.md`

- [ ] **Step 1: Update worker README**

Add sections to `packages/runtime/bpmn-worker/README.md`:

```md
## Deployable worker image

`@rntme/bpmn-worker` ships a `rntme-bpmn-worker` bin and Dockerfile.
The image expects the Dokploy-rendered env:

- `RNTME_EVENT_BUS_BROKERS`
- `RNTME_EVENT_BUS_PROTOCOL`
- `RNTME_OPERATON_BASE_URL`
- `RNTME_WORKFLOWS_MANIFEST_PATH`
- `RNTME_WORKFLOW_SERVICE_ENDPOINTS_JSON`
- `RNTME_WORKFLOW_GRPC_SERVICES_JSON`
- `RNTME_WORKFLOW_SUBSCRIPTIONS_JSON`

Build:

```bash
docker build -f packages/runtime/bpmn-worker/Dockerfile -t ghcr.io/<owner>/rntme-bpmn-worker:<tag> .
```
```

- [ ] **Step 2: Update demo README**

Replace the current smoke section in `demo/order-fulfillment-blueprint/README.md` with the live env contract from this plan and the command:

```md
## Live Dokploy E2E

The real deploy acceptance test is:

```bash
RNTME_DOKPLOY_E2E=1 \
RNTME_DOKPLOY_URL=... \
RNTME_DOKPLOY_API_TOKEN=... \
RNTME_DOKPLOY_PROJECT_ID=... \
RNTME_DOKPLOY_PUBLIC_DEPLOY_DOMAIN=preview.example.com \
RNTME_E2E_RUNTIME_IMAGE=ghcr.io/<owner>/rntme-runtime:<tag> \
RNTME_E2E_BPMN_WORKER_IMAGE=ghcr.io/<owner>/rntme-bpmn-worker:<tag> \
RNTME_E2E_OPERATON_IMAGE=operaton/operaton:<pinned-tag> \
pnpm -F @rntme/platform-http test -- test/e2e/order-fulfillment-dokploy-live.test.ts
```

The test deploys provisioned Redpanda, provisioned Operaton, the two demo services, the BPMN worker, and the edge gateway. It then creates one order that reaches `confirmed` and one order that reaches `cancelled`.
```

- [ ] **Step 3: Add spec addendum**

Append to `docs/superpowers/specs/2026-05-05-provisioned-bpmn-operaton-design.md`:

```md
## 15. Live Dokploy Acceptance

The BPMN/Operaton slice is not accepted by mock Dokploy tests alone. The acceptance gate includes a gated live e2e test, skipped unless `RNTME_DOKPLOY_E2E=1`, that deploys `demo/order-fulfillment-blueprint/` to a real Dokploy target with provisioned Redpanda, provisioned Operaton, a deployable BPMN worker image, the demo domain services, and the edge gateway.

The test must prove:

- deployment resources include event bus, workflow engine, BPMN worker, orders, inventory, and edge;
- a normal order reaches `confirmed` through `reserveStock -> confirmOrder`;
- a `missing-stock` order reaches `cancelled` through `reserveStock -> cancelOrder`;
- resources created by the test are deleted from Dokploy in `finally`.
```

- [ ] **Step 4: Update AGENTS common-task guidance**

Add a short entry under §6:

```md
### 6.16 Run the live Dokploy BPMN e2e

1. Build and push runtime and BPMN worker images.
2. Set the `RNTME_DOKPLOY_E2E=1` env block documented in `demo/order-fulfillment-blueprint/README.md`.
3. Run `pnpm -F @rntme/platform-http test -- test/e2e/order-fulfillment-dokploy-live.test.ts`.
4. Confirm the test reports both `confirmed` and `cancelled` order branches and that cleanup removed Dokploy resources.
```

- [ ] **Step 5: Run docs-adjacent checks**

Run:

```bash
pnpm -F @rntme/bpmn-worker lint
pnpm -F @rntme/platform-http lint
```

Expected: pass. Markdown is not linted by package scripts, but the changed code blocks must be copy-pasteable.

- [ ] **Step 6: Commit**

```bash
git add packages/runtime/bpmn-worker/README.md \
  demo/order-fulfillment-blueprint/README.md \
  docs/superpowers/specs/2026-05-05-provisioned-bpmn-operaton-design.md \
  AGENTS.md
git commit -m "docs: document live dokploy bpmn e2e"
```

---

### Task 9: Final Verification

**Files:**
- No source edits unless verification finds a defect.

- [ ] **Step 1: Run targeted package checks**

Run:

```bash
pnpm -F @rntme/bpmn-worker build
pnpm -F @rntme/bpmn-worker test
pnpm -F @rntme/bpmn-worker lint
pnpm -F @rntme/bpmn-worker typecheck
pnpm -F @rntme/deploy-core test -- test/unit/plan-workflows.test.ts
pnpm -F @rntme/deploy-dokploy test -- test/unit/render-workflows.test.ts
pnpm -F @rntme/platform-http test -- test/unit/deploy/executor.test.ts test/e2e/order-fulfillment-dokploy-live.test.ts
pnpm -F @rntme/platform-http typecheck
```

Expected: pass; live e2e is skipped unless env is enabled.

- [ ] **Step 2: Build Docker image locally**

Run:

```bash
docker build -f packages/runtime/bpmn-worker/Dockerfile -t rntme-bpmn-worker:e2e .
```

Expected: image builds.

- [ ] **Step 3: Run live Dokploy e2e**

Run the command from Task 7 Step 4 with real env.

Expected: pass and cleanup succeeds. If cleanup fails, manually delete the resources whose names start with `rntme-bpmn-e2e-` in the configured Dokploy project, then fix the cleanup path before marking this task complete.

- [ ] **Step 4: Run architectural and repository checks**

Run:

```bash
pnpm depcruise
git diff --check HEAD
git status --short --branch
```

Expected: depcruise reports no violations; diff check is clean; only intentional commits are ahead of the branch base.

- [ ] **Step 5: Capture final evidence**

Add a short implementation report comment to the PR or final handoff containing:

```md
Verified:
- `pnpm -F @rntme/bpmn-worker build`
- `pnpm -F @rntme/bpmn-worker test`
- `pnpm -F @rntme/deploy-core test -- test/unit/plan-workflows.test.ts`
- `pnpm -F @rntme/deploy-dokploy test -- test/unit/render-workflows.test.ts`
- `pnpm -F @rntme/platform-http test -- test/unit/deploy/executor.test.ts test/e2e/order-fulfillment-dokploy-live.test.ts`
- `docker build -f packages/runtime/bpmn-worker/Dockerfile -t rntme-bpmn-worker:e2e .`
- live Dokploy e2e: `<timestamp>`, public host `<host>`, cleanup `<ok|failure-details>`
```

## Self-Review

- Spec coverage: this plan covers the missing live Dokploy acceptance gate, deployable worker runtime, Operaton REST integration, Kafka event intake, gRPC proto handoff, real demo business assertions, cleanup, and documentation touch.
- Scope check: the work is one acceptance slice, but it is split into independent commits. If execution needs to pause, stop after Task 3 for deploy config plumbing or after Task 6 for a deployable worker without live Dokploy proof.
- Placeholder scan: passed after checking for common incomplete-plan markers.
