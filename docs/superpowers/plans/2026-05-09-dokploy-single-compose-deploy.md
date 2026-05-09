# Dokploy Single Compose Deploy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Dokploy preview deployments with one Docker Compose resource per project/environment, including restart/resource hardening and post-apply crash-loop verification.

**Architecture:** `deploy-core` stays target-neutral. `deploy-dokploy` renders a structured single Compose stack, serializes deterministic YAML, and applies one Dokploy Compose resource. `platform-http` owns Dokploy API details, secret resolution, and post-apply verification orchestration.

**Tech Stack:** TypeScript, Vitest, Node 20, pnpm, Dokploy HTTP API, Docker Compose YAML.

---

## File Structure

- Create `packages/deploy/deploy-dokploy/src/compose-model.ts`: structured service/domain/file/policy model used by renderer, apply, and tests.
- Create `packages/deploy/deploy-dokploy/src/compose-yaml.ts`: deterministic YAML serializer for the structured Compose model.
- Modify `packages/deploy/deploy-dokploy/src/render.ts`: render one `project-stack` Compose resource and switch runtime endpoints to Compose service names.
- Modify `packages/deploy/deploy-dokploy/src/workflow-render.ts`: return BPMN worker and Operaton UI definitions as Compose services through helper functions or moved logic.
- Modify `packages/deploy/deploy-dokploy/src/redpanda-console.ts`: return Console services/domains for the single stack.
- Modify `packages/deploy/deploy-dokploy/src/client.ts`: add Compose domain/service/task inspection methods to `DokployClient`.
- Modify `packages/deploy/deploy-dokploy/src/apply.ts`: apply one Compose resource, configure domains/files, inspect service inventory, and cleanup old topology after success.
- Modify `apps/platform-http/src/deploy/dokploy-client-factory.ts`: implement the new Dokploy client methods using Dokploy Compose/domain APIs.
- Modify `apps/platform-http/src/deploy/executor.ts`: run stack guard before smoke verification.
- Modify `packages/platform/platform-core/src/schemas/deployment.ts`: extend verification check status for workload checks.
- Modify `packages/deploy/deploy-core/src/errors-verify.ts`: append `DEPLOY_VERIFY_WORKLOAD_CRASH_LOOP`.
- Modify `docs/current/owners/packages/deploy/deploy-dokploy.md`: document topology, policies, apply flow, and verifier gotchas.
- Modify tests under `packages/deploy/deploy-dokploy/test/unit/`, `apps/platform-http/test/unit/deploy/`, and `packages/platform/platform-storage/test/integration/` when the exact task lists them.

## Task 1: Structured Compose Model

**Files:**
- Create: `packages/deploy/deploy-dokploy/src/compose-model.ts`
- Modify: `packages/deploy/deploy-dokploy/src/render.ts`
- Test: `packages/deploy/deploy-dokploy/test/unit/render.test.ts`

- [ ] **Step 1: Write failing render-model tests**

Append these tests to `packages/deploy/deploy-dokploy/test/unit/render.test.ts`:

```ts
it('renders one project-stack compose resource with service inventory', () => {
  const r = renderDokployPlan(plan, {
    endpoint: 'https://dokploy.example.com',
    projectId: 'project_123',
    publicBaseUrl: 'https://commerce.example.com',
  });

  expect(r.ok).toBe(true);
  if (!r.ok) return;

  expect(r.value.resources).toHaveLength(1);
  const stack = r.value.resources[0];
  expect(stack).toMatchObject({
    logicalId: 'project-stack',
    kind: 'compose',
    infrastructureKind: 'project-stack',
    name: 'rntme-acme-commerce',
  });
  expect(stack.kind).toBe('compose');
  if (stack.kind !== 'compose') return;
  expect(stack.services.map((service) => [service.name, service.serviceClass])).toEqual([
    ['svc-catalog', 'domain-service'],
    ['mod-storage-s3', 'integration-module'],
    ['edge', 'edge-gateway'],
  ]);
});

it('renders default restart and resource policy by compose service class', () => {
  const r = renderDokployPlan(plan, {
    endpoint: 'https://dokploy.example.com',
    projectId: 'project_123',
    publicBaseUrl: 'https://commerce.example.com',
  });

  expect(r.ok).toBe(true);
  if (!r.ok) return;
  const stack = r.value.resources[0];
  expect(stack.kind).toBe('compose');
  if (stack.kind !== 'compose') return;

  const catalog = stack.services.find((service) => service.name === 'svc-catalog');
  const module = stack.services.find((service) => service.name === 'mod-storage-s3');
  const edge = stack.services.find((service) => service.name === 'edge');

  expect(catalog?.restart).toEqual({
    container: 'on-failure:3',
    swarm: { condition: 'on-failure', delay: '30s', maxAttempts: 3, window: '5m' },
  });
  expect(module?.resources).toEqual({ cpus: '0.50', memory: '512M' });
  expect(edge?.resources).toEqual({ cpus: '0.10', memory: '128M' });
});
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
pnpm -F @rntme/deploy-dokploy test -- render.test.ts
```

Expected: FAIL because compose resources do not expose `services`, project-stack does not exist, and resources are still separate applications.

- [ ] **Step 3: Add compose model types**

Create `packages/deploy/deploy-dokploy/src/compose-model.ts`:

```ts
import type { DeploymentWorkload } from '@rntme/deploy-core';
import type { RenderedEnvVar, RenderedSecretFileRef } from './render.js';

export type RenderedComposeServiceClass =
  | 'domain-service'
  | 'integration-module'
  | 'edge-gateway'
  | 'bpmn-worker'
  | 'event-bus'
  | 'workflow-engine'
  | 'object-storage'
  | 'infrastructure-proxy';

export type RenderedComposeRestartPolicy = {
  readonly container: 'on-failure:3' | 'unless-stopped';
  readonly swarm?: {
    readonly condition: 'on-failure';
    readonly delay: '30s';
    readonly maxAttempts: 3;
    readonly window: '5m';
  };
};

export type RenderedComposeResourceLimits = {
  readonly cpus: '0.10' | '0.25' | '0.50' | '1.00';
  readonly memory: '128M' | '256M' | '512M' | '1G';
};

export type RenderedComposeVolumeMount = {
  readonly source: string;
  readonly target: string;
  readonly readOnly: boolean;
};

export type RenderedComposeService = {
  readonly name: string;
  readonly logicalId: string;
  readonly serviceClass: RenderedComposeServiceClass;
  readonly workloadKind?: DeploymentWorkload['kind'] | 'infrastructure-proxy';
  readonly workloadSlug?: string;
  readonly image: string;
  readonly command?: string;
  readonly args?: readonly string[];
  readonly env: readonly RenderedEnvVar[];
  readonly files?: Readonly<Record<string, string>>;
  readonly secretFiles?: Readonly<Record<string, RenderedSecretFileRef>>;
  readonly ports?: readonly number[];
  readonly volumes?: readonly RenderedComposeVolumeMount[];
  readonly restart: RenderedComposeRestartPolicy;
  readonly resources: RenderedComposeResourceLimits;
};

export type RenderedComposeDomain = {
  readonly host: string;
  readonly path: '/';
  readonly serviceName: string;
  readonly containerPort: number;
  readonly https: boolean;
};

export function runtimeRestartPolicy(): RenderedComposeRestartPolicy {
  return {
    container: 'on-failure:3',
    swarm: { condition: 'on-failure', delay: '30s', maxAttempts: 3, window: '5m' },
  };
}

export function infraRestartPolicy(): RenderedComposeRestartPolicy {
  return { container: 'unless-stopped' };
}

export function runtimeLimits(): RenderedComposeResourceLimits {
  return { cpus: '0.50', memory: '512M' };
}

export function proxyLimits(): RenderedComposeResourceLimits {
  return { cpus: '0.10', memory: '128M' };
}

export function redpandaLimits(): RenderedComposeResourceLimits {
  return { cpus: '1.00', memory: '1G' };
}

export function operatonLimits(): RenderedComposeResourceLimits {
  return { cpus: '1.00', memory: '1G' };
}

export function rustfsLimits(): RenderedComposeResourceLimits {
  return { cpus: '0.50', memory: '512M' };
}

export function consoleLimits(): RenderedComposeResourceLimits {
  return { cpus: '0.25', memory: '256M' };
}
```

- [ ] **Step 4: Extend rendered compose resource type**

In `packages/deploy/deploy-dokploy/src/render.ts`, import the model:

```ts
import type { RenderedComposeDomain, RenderedComposeService } from './compose-model.js';
```

Change `RenderedDokployComposeResource.infrastructureKind` to include `project-stack`, and add fields:

```ts
export type RenderedDokployComposeResource = {
  readonly logicalId: string;
  readonly kind: 'compose';
  readonly infrastructureKind: 'event-bus' | 'workflow-engine' | 'object-storage' | 'project-stack';
  readonly name: string;
  readonly image: string;
  readonly composeFile: string;
  readonly services?: readonly RenderedComposeService[];
  readonly domains?: readonly RenderedComposeDomain[];
  readonly env: readonly RenderedEnvVar[];
  readonly labels: Readonly<Record<string, string>>;
  readonly secretFiles?: Readonly<Record<string, RenderedSecretFileRef>>;
};
```

- [ ] **Step 5: Add temporary project-stack resource builder**

In `render.ts`, add `renderProjectStackResource` that maps current workloads into service inventory and uses a minimal `services: {}` compose file. This makes the first task establish the public render shape before Task 2 fills in the deterministic YAML serializer:

```ts
function renderProjectStackResource(
  plan: ProjectDeploymentPlan,
  nginxConfig: string,
  publicBaseUrl: string,
): Result<RenderedDokployComposeResource, DokployDeploymentError> {
  const workloadResources = renderWorkloadResources(plan, nginxConfig, publicBaseUrl);
  if (!workloadResources.ok) return workloadResources;
  const services: RenderedComposeService[] = workloadResources.value.map((resource) => ({
    name: composeServiceName(resource),
    logicalId: resource.logicalId,
    serviceClass: resource.workloadKind === 'edge-gateway'
      ? 'edge-gateway'
      : resource.workloadKind === 'integration-module'
        ? 'integration-module'
        : resource.workloadKind === 'bpmn-worker'
          ? 'bpmn-worker'
          : 'domain-service',
    ...(resource.workloadKind !== undefined ? { workloadKind: resource.workloadKind } : {}),
    ...(resource.workloadSlug !== undefined ? { workloadSlug: resource.workloadSlug } : {}),
    image: resource.image,
    ...(resource.command !== undefined ? { command: resource.command } : {}),
    ...(resource.args !== undefined ? { args: resource.args } : {}),
    env: resource.env,
    ...(resource.files !== undefined ? { files: resource.files } : {}),
    ...(resource.secretFiles !== undefined ? { secretFiles: resource.secretFiles } : {}),
    ports: resource.workloadKind === 'edge-gateway' ? [8080] : resource.ports?.map((port) => port.containerPort),
    restart: resource.workloadKind === 'edge-gateway' ? runtimeRestartPolicy() : runtimeRestartPolicy(),
    resources: resource.workloadKind === 'edge-gateway' ? proxyLimits() : runtimeLimits(),
  }));

  return ok({
    logicalId: 'project-stack',
    kind: 'compose',
    infrastructureKind: 'project-stack',
    name: dokployResourceName(plan.project.orgSlug, plan.project.projectSlug, ''),
    image: 'docker-compose',
    composeFile: 'services: {}\n',
    services,
    domains: [composeDomain(publicBaseUrl, 'edge', 8080)],
    env: [],
    labels: {
      ...dokployLabels(plan.project.orgSlug, plan.project.projectSlug, plan.project.environment, 'project-stack'),
      'rntme.infrastructure': 'project-stack',
    },
  });
}

function composeServiceName(resource: RenderedDokployApplicationResource): string {
  if (resource.workloadKind === 'edge-gateway') return 'edge';
  if (resource.workloadKind === 'integration-module') return `mod-${resource.workloadSlug ?? resource.logicalId}`;
  if (resource.workloadKind === 'bpmn-worker') return 'bpmn-worker';
  if (resource.workloadKind === 'infrastructure-proxy') return resource.workloadSlug ?? resource.logicalId;
  return `svc-${resource.workloadSlug ?? resource.logicalId}`;
}

function composeDomain(publicBaseUrl: string, serviceName: string, containerPort: number): RenderedComposeDomain {
  const url = new URL(publicBaseUrl);
  return {
    host: url.host,
    path: '/',
    serviceName,
    containerPort,
    https: url.protocol === 'https:',
  };
}
```

Update the imports to include:

```ts
import {
  proxyLimits,
  runtimeLimits,
  runtimeRestartPolicy,
  type RenderedComposeDomain,
  type RenderedComposeService,
} from './compose-model.js';
```

Replace the current `resources` construction in `renderDokployPlan` with:

```ts
const stackResource = renderProjectStackResource(plan, nginxConfig.value, resolvedConfig.publicBaseUrl);
if (!stackResource.ok) return stackResource;
const resources = [stackResource.value];
```

- [ ] **Step 6: Run test to verify it passes**

Run:

```bash
pnpm -F @rntme/deploy-dokploy test -- render.test.ts
```

Expected: PASS for the new service inventory tests. Some older tests may fail because they still expect separate resources; update them in Task 2 and Task 3, not here.

- [ ] **Step 7: Commit**

```bash
git add packages/deploy/deploy-dokploy/src/compose-model.ts packages/deploy/deploy-dokploy/src/render.ts packages/deploy/deploy-dokploy/test/unit/render.test.ts
git commit -m "feat(deploy-dokploy): introduce compose stack render model"
```

## Task 2: Deterministic Compose YAML

**Files:**
- Create: `packages/deploy/deploy-dokploy/src/compose-yaml.ts`
- Modify: `packages/deploy/deploy-dokploy/src/render.ts`
- Test: `packages/deploy/deploy-dokploy/test/unit/render.test.ts`

- [ ] **Step 1: Write failing YAML tests**

Append to `render.test.ts`:

```ts
it('serializes compose services with restart policy resources networks and mounts', () => {
  const r = renderDokployPlan(plan, {
    endpoint: 'https://dokploy.example.com',
    projectId: 'project_123',
    publicBaseUrl: 'https://commerce.example.com',
  });

  expect(r.ok).toBe(true);
  if (!r.ok) return;
  const stack = r.value.resources[0];
  expect(stack.kind).toBe('compose');
  if (stack.kind !== 'compose') return;

  expect(stack.composeFile).toContain('services:\n');
  expect(stack.composeFile).toContain('  svc-catalog:\n');
  expect(stack.composeFile).toContain('    image: rntme-runtime\n');
  expect(stack.composeFile).toContain('    restart: on-failure:3\n');
  expect(stack.composeFile).toContain('      max_attempts: 3\n');
  expect(stack.composeFile).toContain('      memory: 512M\n');
  expect(stack.composeFile).toContain('  edge:\n');
  expect(stack.composeFile).toContain('      memory: 128M\n');
  expect(stack.composeFile).toContain('networks:\n  dokploy-network:\n    external: true\n');
});
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
pnpm -F @rntme/deploy-dokploy test -- render.test.ts
```

Expected: FAIL because `composeFile` is still `services: {}`.

- [ ] **Step 3: Implement YAML serializer**

Create `packages/deploy/deploy-dokploy/src/compose-yaml.ts`:

```ts
import type { RenderedComposeService } from './compose-model.js';

export function renderComposeYaml(services: readonly RenderedComposeService[]): string {
  const lines: string[] = ['services:'];
  for (const service of [...services].sort((a, b) => a.name.localeCompare(b.name))) {
    lines.push(`  ${service.name}:`);
    lines.push(`    image: ${yamlScalar(service.image)}`);
    if (service.command !== undefined) lines.push(`    command: ${yamlScalar(service.command)}`);
    if (service.args !== undefined && service.args.length > 0) {
      lines.push('    args:');
      for (const arg of service.args) lines.push(`      - ${yamlScalar(arg)}`);
    }
    lines.push(`    restart: ${service.restart.container}`);
    if (service.env.length > 0) {
      lines.push('    environment:');
      for (const env of [...service.env].sort((a, b) => a.name.localeCompare(b.name))) {
        lines.push(`      ${env.name}: ${yamlScalar(`\${${env.name}}`)}`);
      }
    }
    if (service.ports !== undefined && service.ports.length > 0) {
      lines.push('    expose:');
      for (const port of [...service.ports].sort((a, b) => a - b)) lines.push(`      - "${port}"`);
    }
    if (service.volumes !== undefined && service.volumes.length > 0) {
      lines.push('    volumes:');
      for (const volume of service.volumes) {
        const suffix = volume.readOnly ? ':ro' : '';
        lines.push(`      - ${yamlScalar(`${volume.source}:${volume.target}${suffix}`)}`);
      }
    }
    lines.push('    networks:');
    lines.push('      - default');
    if (service.name === 'edge' || service.serviceClass === 'infrastructure-proxy') {
      lines.push('      - dokploy-network');
    }
    lines.push('    deploy:');
    if (service.restart.swarm !== undefined) {
      lines.push('      restart_policy:');
      lines.push(`        condition: ${service.restart.swarm.condition}`);
      lines.push(`        delay: ${service.restart.swarm.delay}`);
      lines.push(`        max_attempts: ${service.restart.swarm.maxAttempts}`);
      lines.push(`        window: ${service.restart.swarm.window}`);
    }
    lines.push('      resources:');
    lines.push('        limits:');
    lines.push(`          cpus: "${service.resources.cpus}"`);
    lines.push(`          memory: ${service.resources.memory}`);
  }
  lines.push('networks:');
  lines.push('  dokploy-network:');
  lines.push('    external: true');
  lines.push('');
  return lines.join('\n');
}

function yamlScalar(value: string): string {
  if (/^[A-Za-z0-9._/:@{}$-]+$/.test(value)) return value;
  return JSON.stringify(value);
}
```

- [ ] **Step 4: Use serializer in renderer**

In `render.ts`, import:

```ts
import { renderComposeYaml } from './compose-yaml.js';
```

In `renderProjectStackResource`, change:

```ts
composeFile: 'services: {}\n',
```

to:

```ts
composeFile: renderComposeYaml(services),
```

- [ ] **Step 5: Run test to verify pass**

Run:

```bash
pnpm -F @rntme/deploy-dokploy test -- render.test.ts
```

Expected: PASS after updating older resource-order assertions to expect one stack resource and to inspect `stack.services`.

- [ ] **Step 6: Commit**

```bash
git add packages/deploy/deploy-dokploy/src/compose-yaml.ts packages/deploy/deploy-dokploy/src/render.ts packages/deploy/deploy-dokploy/test/unit/render.test.ts
git commit -m "feat(deploy-dokploy): render deterministic project compose yaml"
```

## Task 3: Provisioned Infra And Workflow Services In The Stack

**Files:**
- Modify: `packages/deploy/deploy-dokploy/src/render.ts`
- Modify: `packages/deploy/deploy-dokploy/src/workflow-render.ts`
- Modify: `packages/deploy/deploy-dokploy/src/redpanda-console.ts`
- Test: `packages/deploy/deploy-dokploy/test/unit/render.test.ts`
- Test: `packages/deploy/deploy-dokploy/test/unit/render-workflows.test.ts`

- [ ] **Step 1: Write failing infra and workflow tests**

In `render.test.ts`, replace the old Redpanda separate-resource assertion with:

```ts
it('renders provisioned infra as services inside the project stack', () => {
  const r = renderDokployPlan(
    {
      ...plan,
      infrastructure: {
        ...plan.infrastructure,
        eventBus: {
          kind: 'kafka',
          mode: 'provisioned',
          provider: 'redpanda',
          resourceName: 'rntme-acme-commerce-event-bus',
          internalBrokers: ['rntme-acme-commerce-event-bus:9092'],
          image: 'docker.redpanda.com/redpandadata/redpanda:v24.3.6',
          persistence: { mode: 'persistent', volumeName: 'rntme-acme-commerce-event-bus-data' },
        },
      },
    },
    {
      endpoint: 'https://dokploy.example.com',
      projectId: 'project_123',
      publicBaseUrl: 'https://commerce.example.com',
    },
  );

  expect(r.ok).toBe(true);
  if (!r.ok) return;
  const stack = r.value.resources[0];
  expect(stack.kind).toBe('compose');
  if (stack.kind !== 'compose') return;

  const redpanda = stack.services.find((service) => service.name === 'redpanda');
  const catalog = stack.services.find((service) => service.name === 'svc-catalog');
  expect(redpanda).toMatchObject({
    serviceClass: 'event-bus',
    image: 'docker.redpanda.com/redpandadata/redpanda:v24.3.6',
    restart: { container: 'unless-stopped' },
    resources: { cpus: '1.00', memory: '1G' },
  });
  expect(catalog?.env).toContainEqual({
    name: 'RNTME_EVENT_BUS_BROKERS',
    value: 'redpanda:9092',
    secret: false,
  });
  expect(stack.composeFile).toContain('  redpanda:\n');
  expect(stack.composeFile).toContain('    restart: unless-stopped\n');
});
```

In `render-workflows.test.ts`, add:

```ts
it('renders Operaton and BPMN worker inside the project stack with compose service endpoints', () => {
  const r = renderDokployPlan(workflowPlan, {
    endpoint: 'https://dokploy.example.com',
    projectId: 'project_123',
    publicBaseUrl: 'https://workflow.example.com',
  });

  expect(r.ok).toBe(true);
  if (!r.ok) return;
  const stack = r.value.resources[0];
  expect(stack.kind).toBe('compose');
  if (stack.kind !== 'compose') return;

  expect(stack.services.map((service) => service.name)).toContain('operaton');
  expect(stack.services.map((service) => service.name)).toContain('bpmn-worker');
  const worker = stack.services.find((service) => service.name === 'bpmn-worker');
  expect(worker?.env).toContainEqual({
    name: 'RNTME_OPERATON_BASE_URL',
    value: 'http://operaton:8080',
    secret: false,
  });
  expect(worker?.env.find((entry) => entry.name === 'RNTME_WORKFLOW_SERVICE_ENDPOINTS_JSON')?.value).toContain('svc-');
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
pnpm -F @rntme/deploy-dokploy test -- render.test.ts render-workflows.test.ts
```

Expected: FAIL because infra is still rendered through old helper resources or old endpoint names.

- [ ] **Step 3: Convert event bus env to Compose service names**

In `render.ts`, change provisioned event bus env:

```ts
value: eventBus.internalBrokers.join(','),
```

to:

```ts
value: 'redpanda:9092',
```

Apply the same change in `workflow-render.ts` `workerEventBusEnv`.

- [ ] **Step 4: Add infra service builders in `render.ts`**

Add helpers:

```ts
function renderRedpandaService(plan: ProjectDeploymentPlan): RenderedComposeService | null {
  const eventBus = plan.infrastructure.eventBus;
  if (eventBus.mode !== 'provisioned') return null;
  return {
    name: 'redpanda',
    logicalId: 'event-bus',
    serviceClass: 'event-bus',
    image: eventBus.image,
    command: redpandaCommand(eventBus, workflowMessageStartTopics(plan)),
    env: [],
    ports: [9092],
    restart: infraRestartPolicy(),
    resources: redpandaLimits(),
  };
}

function renderRustfsService(plan: ProjectDeploymentPlan): RenderedComposeService | null {
  const storage = plan.infrastructure.objectStorage;
  if (storage.kind !== 's3-compatible') return null;
  return {
    name: 'rustfs',
    logicalId: 'object-storage',
    serviceClass: 'object-storage',
    image: storage.image,
    command: 'server /data',
    env: [
      { name: 'RUSTFS_ACCESS_KEY', value: storage.credentials.accessKeyRef, secret: true },
      { name: 'RUSTFS_SECRET_KEY', value: storage.credentials.secretKeyRef, secret: true },
    ],
    ports: [9000],
    restart: infraRestartPolicy(),
    resources: rustfsLimits(),
  };
}
```

Import needed helpers from `compose-model.ts`:

```ts
import {
  infraRestartPolicy,
  operatonLimits,
  proxyLimits,
  redpandaLimits,
  runtimeLimits,
  runtimeRestartPolicy,
  rustfsLimits,
  type RenderedComposeDomain,
  type RenderedComposeService,
} from './compose-model.js';
```

- [ ] **Step 5: Move workflow helpers to Compose services**

In `workflow-render.ts`, add exported helpers:

```ts
export function renderOperatonService(plan: ProjectDeploymentPlan): RenderedComposeService | null {
  const engine = workflowEngine(plan);
  if (engine.kind === 'none') return null;
  return {
    name: 'operaton',
    logicalId: 'workflow-engine',
    serviceClass: 'workflow-engine',
    image: engine.image,
    env: [],
    ports: [8080],
    restart: infraRestartPolicy(),
    resources: operatonLimits(),
    ...(engine.adminUserSecretRef === undefined
      ? {}
      : {
          secretFiles: {
            '/operaton/configuration/application.yaml': {
              schema: 'operaton-admin-user-v1',
              secretRef: engine.adminUserSecretRef,
              field: 'applicationYaml',
            },
          },
        }),
  };
}

export function renderBpmnWorkerService(
  plan: ProjectDeploymentPlan,
  workload: BpmnWorkerWorkload,
): Result<RenderedComposeService, DokployDeploymentError> {
  const rendered = renderBpmnWorker(plan, workload);
  if (!rendered.ok) return rendered;
  return ok({
    name: 'bpmn-worker',
    logicalId: rendered.value.logicalId,
    serviceClass: 'bpmn-worker',
    workloadKind: 'bpmn-worker',
    workloadSlug: rendered.value.workloadSlug,
    image: rendered.value.image,
    env: rendered.value.env.map((entry) =>
      entry.name === 'RNTME_OPERATON_BASE_URL'
        ? { ...entry, value: 'http://operaton:8080' }
        : entry,
    ),
    ...(rendered.value.files === undefined ? {} : { files: rendered.value.files }),
    restart: runtimeRestartPolicy(),
    resources: runtimeLimits(),
  });
}
```

Update imports in `workflow-render.ts` for `infraRestartPolicy`, `operatonLimits`, `runtimeLimits`, `runtimeRestartPolicy`, and `RenderedComposeService`.

- [ ] **Step 6: Build final service list in stack renderer**

In `renderProjectStackResource`, prepend infra and workflow services:

```ts
const services: RenderedComposeService[] = [];
const redpanda = renderRedpandaService(plan);
if (redpanda !== null) services.push(redpanda);
const rustfs = renderRustfsService(plan);
if (rustfs !== null) services.push(rustfs);
const operaton = renderOperatonService(plan);
if (operaton !== null) services.push(operaton);

for (const workload of plan.workloads) {
  if (workload.kind === 'bpmn-worker') {
    const worker = renderBpmnWorkerService(plan, workload);
    if (!worker.ok) return worker;
    services.push(worker.value);
    continue;
  }
  const resource = renderResource(plan, workload, nginxConfig, publicBaseUrl);
  if (!resource.ok) return resource;
  services.push(applicationResourceToComposeService(resource.value));
}
```

Extract the mapping code from Task 1 into:

```ts
function applicationResourceToComposeService(resource: RenderedDokployApplicationResource): RenderedComposeService {
  return {
    name: composeServiceName(resource),
    logicalId: resource.logicalId,
    serviceClass: resource.workloadKind === 'edge-gateway'
      ? 'edge-gateway'
      : resource.workloadKind === 'integration-module'
        ? 'integration-module'
        : resource.workloadKind === 'infrastructure-proxy'
          ? 'infrastructure-proxy'
          : 'domain-service',
    ...(resource.workloadKind !== undefined ? { workloadKind: resource.workloadKind } : {}),
    ...(resource.workloadSlug !== undefined ? { workloadSlug: resource.workloadSlug } : {}),
    image: resource.image,
    ...(resource.command !== undefined ? { command: resource.command } : {}),
    ...(resource.args !== undefined ? { args: resource.args } : {}),
    env: resource.env,
    ...(resource.files !== undefined ? { files: resource.files } : {}),
    ...(resource.secretFiles !== undefined ? { secretFiles: resource.secretFiles } : {}),
    ports: resource.workloadKind === 'edge-gateway' ? [8080] : resource.ports?.map((port) => port.containerPort),
    restart: resource.workloadKind === 'edge-gateway' || resource.workloadKind === 'infrastructure-proxy'
      ? runtimeRestartPolicy()
      : runtimeRestartPolicy(),
    resources: resource.workloadKind === 'edge-gateway' || resource.workloadKind === 'infrastructure-proxy'
      ? proxyLimits()
      : runtimeLimits(),
  };
}
```

- [ ] **Step 7: Run tests to verify pass**

Run:

```bash
pnpm -F @rntme/deploy-dokploy test -- render.test.ts render-workflows.test.ts
```

Expected: PASS after updating old tests to inspect `stack.services` rather than separate resources.

- [ ] **Step 8: Commit**

```bash
git add packages/deploy/deploy-dokploy/src/render.ts packages/deploy/deploy-dokploy/src/workflow-render.ts packages/deploy/deploy-dokploy/src/redpanda-console.ts packages/deploy/deploy-dokploy/test/unit/render.test.ts packages/deploy/deploy-dokploy/test/unit/render-workflows.test.ts
git commit -m "feat(deploy-dokploy): render project infra inside compose stack"
```

## Task 4: Apply One Compose Stack With Domains And Service Inventory

**Files:**
- Modify: `packages/deploy/deploy-dokploy/src/client.ts`
- Modify: `packages/deploy/deploy-dokploy/src/apply.ts`
- Test: `packages/deploy/deploy-dokploy/test/unit/apply.test.ts`

- [ ] **Step 1: Write failing apply tests**

Add to `apply.test.ts`:

```ts
it('applies a single project-stack compose and configures compose domains', async () => {
  const client = new FakeDokployClient();
  const stack = projectStackRendered();

  const r = await applyDokployPlan(stack, client);

  expect(r.ok).toBe(true);
  if (!r.ok) return;
  expect(client.lifecycleCalls).toEqual([
    'create-compose:rntme-acme-commerce',
    'configure-compose:compose_1:rntme-acme-commerce',
    'configure-compose-domains:compose_1:edge:8080',
    'deploy-compose:compose_1',
    'start-compose:compose_1',
    'load-compose-services:compose_1',
    'inspect-compose-tasks:compose_1',
  ]);
  expect(r.value.resources).toEqual([
    {
      logicalId: 'project-stack',
      resourceKind: 'compose',
      infrastructureKind: 'project-stack',
      targetResourceId: 'compose_1',
      targetResourceName: 'rntme-acme-commerce',
      action: 'created',
      services: [
        { name: 'svc-catalog', serviceClass: 'domain-service' },
        { name: 'edge', serviceClass: 'edge-gateway' },
      ],
    },
  ]);
  expect(r.value.verificationHints.stack).toEqual({
    composeId: 'compose_1',
    services: [
      { name: 'svc-catalog', serviceClass: 'domain-service' },
      { name: 'edge', serviceClass: 'edge-gateway' },
    ],
  });
});
```

Define `projectStackRendered()` in the test:

```ts
function projectStackRendered(): RenderedDokployPlan {
  return {
    ...rendered,
    resources: [
      {
        logicalId: 'project-stack',
        kind: 'compose',
        infrastructureKind: 'project-stack',
        name: 'rntme-acme-commerce',
        image: 'docker-compose',
        composeFile: 'services:\n  edge:\n    image: nginx:1.27-alpine\n',
        env: [],
        labels: { 'rntme.infrastructure': 'project-stack' },
        domains: [{ host: 'commerce.example.com', path: '/', serviceName: 'edge', containerPort: 8080, https: true }],
        services: [
          {
            name: 'svc-catalog',
            logicalId: 'catalog',
            serviceClass: 'domain-service',
            image: 'rntme-runtime',
            env: [],
            restart: { container: 'on-failure:3', swarm: { condition: 'on-failure', delay: '30s', maxAttempts: 3, window: '5m' } },
            resources: { cpus: '0.50', memory: '512M' },
          },
          {
            name: 'edge',
            logicalId: 'edge',
            serviceClass: 'edge-gateway',
            image: 'nginx:1.27-alpine',
            env: [],
            restart: { container: 'on-failure:3', swarm: { condition: 'on-failure', delay: '30s', maxAttempts: 3, window: '5m' } },
            resources: { cpus: '0.10', memory: '128M' },
          },
        ],
      },
    ],
  };
}
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
pnpm -F @rntme/deploy-dokploy test -- apply.test.ts
```

Expected: FAIL because the client seam lacks domain/service/task methods and apply still handles many resources.

- [ ] **Step 3: Extend client seam types**

In `client.ts`, import `RenderedComposeDomain` and `RenderedComposeServiceClass`, then add:

```ts
export type DokployComposeServiceSummary = {
  readonly name: string;
  readonly serviceClass: RenderedComposeServiceClass;
};

export type DokployComposeTaskInspection = {
  readonly serviceName: string;
  readonly status: 'running' | 'healthy' | 'starting' | 'failed' | 'rejected' | 'exited' | 'unknown';
  readonly failedCount: number;
  readonly message?: string;
};
```

Add optional methods to `DokployClient`:

```ts
  configureComposeDomains?(
    composeId: string,
    domains: readonly RenderedComposeDomain[],
  ): Promise<void>;
  startCompose?(composeId: string): Promise<void>;
  loadComposeServices?(composeId: string): Promise<readonly DokployComposeServiceSummary[]>;
  inspectComposeTasks?(
    composeId: string,
    services: readonly DokployComposeServiceSummary[],
  ): Promise<readonly DokployComposeTaskInspection[]>;
```

- [ ] **Step 4: Extend apply result types**

In `apply.ts`, import `DokployComposeServiceSummary` and add `services` to compose apply resources:

```ts
export type DeploymentApplyResource = {
  readonly logicalId: string;
  readonly resourceKind: 'application' | 'compose';
  readonly workloadSlug?: string;
  readonly kind?: RenderedApplicationResource['workloadKind'];
  readonly infrastructureKind?:
    | RenderedComposeResource['infrastructureKind']
    | RenderedApplicationResource['infrastructureKind'];
  readonly targetResourceId: string;
  readonly targetResourceName: string;
  readonly action: 'created' | 'updated' | 'unchanged';
  readonly services?: readonly DokployComposeServiceSummary[];
};
```

Extend `verificationHints`:

```ts
readonly stack?: {
  readonly composeId: string;
  readonly services: readonly DokployComposeServiceSummary[];
  readonly inspections?: readonly DokployComposeTaskInspection[];
};
```

- [ ] **Step 5: Configure domains and inspect services after compose lifecycle**

In `runComposeLifecycle`, after `deployCompose`, add:

```ts
  if (resource.infrastructureKind === 'project-stack' && resource.domains !== undefined) {
    try {
      await client.configureComposeDomains?.(target.targetResourceId, resource.domains);
    } catch (cause) {
      return partialFailure(client, cause, resource, applied, createdForCleanup, 'configure');
    }
  }

  if (resource.infrastructureKind === 'project-stack') {
    try {
      await client.startCompose?.(target.targetResourceId);
    } catch (cause) {
      return partialFailure(client, cause, resource, applied, createdForCleanup, 'deploy');
    }
  }
```

Add helper:

```ts
function serviceSummaries(resource: RenderedComposeResource): readonly DokployComposeServiceSummary[] {
  return (resource.services ?? []).map((service) => ({
    name: service.name,
    serviceClass: service.serviceClass,
  }));
}
```

Update `appliedResource` for compose resources:

```ts
services: serviceSummaries(resource),
```

Set `verificationHints.stack` from the project-stack resource in `verificationHints(rendered)`.

- [ ] **Step 6: Run apply tests**

Run:

```bash
pnpm -F @rntme/deploy-dokploy test -- apply.test.ts
```

Expected: PASS after updating `FakeDokployClient` with methods that push the lifecycle calls shown in Step 1.

- [ ] **Step 7: Commit**

```bash
git add packages/deploy/deploy-dokploy/src/client.ts packages/deploy/deploy-dokploy/src/apply.ts packages/deploy/deploy-dokploy/test/unit/apply.test.ts
git commit -m "feat(deploy-dokploy): apply single compose stack"
```

## Task 5: Platform Dokploy Client Implements Compose Domains And Inspection

**Files:**
- Modify: `apps/platform-http/src/deploy/dokploy-client-factory.ts`
- Test: `apps/platform-http/test/unit/deploy/dokploy-client-factory.test.ts`

- [ ] **Step 1: Write failing client factory tests**

Append:

```ts
it('configures domains for a compose service and port', async () => {
  const calls: Array<{ path: string; body?: unknown }> = [];
  const client = createDokployClientFactory(cipher, async (_input, init) => {
    const body = init?.body === undefined ? undefined : JSON.parse(String(init.body));
    calls.push({ path: new URL(String(_input)).pathname, body });
    return new Response('{}', { status: 200 });
  })(target());

  await client.configureComposeDomains?.('compose-1', [
    { host: 'commerce.example.com', path: '/', serviceName: 'edge', containerPort: 8080, https: true },
  ]);

  expect(calls.map((call) => call.path)).toContain('/api/domain.create');
  expect(calls.at(-1)?.body).toMatchObject({
    composeId: 'compose-1',
    host: 'commerce.example.com',
    path: '/',
    serviceName: 'edge',
    port: 8080,
    https: true,
  });
});

it('normalizes compose task inspection for failed services', async () => {
  const client = createDokployClientFactory(cipher, async (input) => {
    const url = new URL(String(input));
    if (url.pathname === '/api/compose.loadServices') {
      return new Response(JSON.stringify([{ name: 'svc-catalog' }, { name: 'edge' }]), { status: 200 });
    }
    if (url.pathname === '/api/compose.inspectTasks') {
      return new Response(JSON.stringify([
        { serviceName: 'svc-catalog', status: 'failed', failedCount: 2, message: 'exit code 1' },
        { serviceName: 'edge', status: 'running', failedCount: 0 },
      ]), { status: 200 });
    }
    return new Response('{}', { status: 200 });
  })(target());

  await expect(client.loadComposeServices?.('compose-1')).resolves.toEqual([
    { name: 'svc-catalog', serviceClass: 'domain-service' },
    { name: 'edge', serviceClass: 'edge-gateway' },
  ]);
  await expect(client.inspectComposeTasks?.('compose-1', [
    { name: 'svc-catalog', serviceClass: 'domain-service' },
    { name: 'edge', serviceClass: 'edge-gateway' },
  ])).resolves.toEqual([
    { serviceName: 'svc-catalog', status: 'failed', failedCount: 2, message: 'exit code 1' },
    { serviceName: 'edge', status: 'running', failedCount: 0 },
  ]);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
pnpm -F @rntme/platform-http test -- dokploy-client-factory.test.ts
```

Expected: FAIL because methods are missing.

- [ ] **Step 3: Implement compose methods**

In `dokploy-client-factory.ts`, add methods to returned client:

```ts
configureComposeDomains: async (composeId, domains) => {
  const existingResponse = await request<unknown>('GET', '/api/domain.byComposeId', { composeId });
  const existing = Array.isArray(existingResponse) ? (existingResponse as DokployApiDomain[]) : [];
  for (const domain of domains) {
    const current = existing.find((item) => item.host === domain.host);
    const body = {
      composeId,
      host: domain.host,
      path: domain.path,
      serviceName: domain.serviceName,
      port: domain.containerPort,
      https: domain.https,
      certificateType: 'letsencrypt',
    };
    if (current === undefined) {
      await request('POST', '/api/domain.create', body);
    } else {
      await request('POST', '/api/domain.update', { ...body, domainId: current.domainId });
    }
  }
},
startCompose: async (composeId) => {
  await request('POST', '/api/compose.start', { composeId });
},
loadComposeServices: async (composeId) => {
  const response = await request<unknown>('GET', '/api/compose.loadServices', { composeId });
  const rows = Array.isArray(response) ? response : [];
  return rows
    .map((row) => normalizeComposeService(row))
    .filter((row): row is NonNullable<ReturnType<typeof normalizeComposeService>> => row !== null);
},
inspectComposeTasks: async (composeId, services) => {
  const response = await request<unknown>('GET', '/api/compose.inspectTasks', { composeId });
  return normalizeComposeTaskInspections(response, services);
},
```

Add helpers:

```ts
function normalizeComposeService(input: unknown): { name: string; serviceClass: RenderedComposeServiceClass } | null {
  if (typeof input !== 'object' || input === null) return null;
  const raw = input as Record<string, unknown>;
  const name = typeof raw.name === 'string' ? raw.name : typeof raw.serviceName === 'string' ? raw.serviceName : '';
  if (name === '') return null;
  return { name, serviceClass: serviceClassFromName(name) };
}

function serviceClassFromName(name: string): RenderedComposeServiceClass {
  if (name === 'edge') return 'edge-gateway';
  if (name === 'bpmn-worker') return 'bpmn-worker';
  if (name === 'redpanda') return 'event-bus';
  if (name === 'operaton') return 'workflow-engine';
  if (name === 'rustfs') return 'object-storage';
  if (name.startsWith('mod-')) return 'integration-module';
  if (name.endsWith('-public') || name.endsWith('-proxy') || name === 'operaton-ui') return 'infrastructure-proxy';
  return 'domain-service';
}

function normalizeComposeTaskInspections(
  input: unknown,
  services: readonly { name: string; serviceClass: RenderedComposeServiceClass }[],
): readonly DokployComposeTaskInspection[] {
  const rows = Array.isArray(input) ? input : [];
  const byName = new Map<string, DokployComposeTaskInspection>();
  for (const row of rows) {
    if (typeof row !== 'object' || row === null) continue;
    const raw = row as Record<string, unknown>;
    const serviceName = typeof raw.serviceName === 'string' ? raw.serviceName : typeof raw.name === 'string' ? raw.name : '';
    if (serviceName === '') continue;
    byName.set(serviceName, {
      serviceName,
      status: normalizeTaskStatus(raw.status),
      failedCount: typeof raw.failedCount === 'number' ? raw.failedCount : normalizeTaskStatus(raw.status) === 'running' ? 0 : 1,
      ...(typeof raw.message === 'string' ? { message: raw.message } : {}),
    });
  }
  return services.map((service) => byName.get(service.name) ?? {
    serviceName: service.name,
    status: 'unknown',
    failedCount: 0,
  });
}

function normalizeTaskStatus(input: unknown): DokployComposeTaskInspection['status'] {
  const value = typeof input === 'string' ? input.toLowerCase() : '';
  if (value === 'running' || value === 'healthy' || value === 'starting' || value === 'failed' || value === 'rejected' || value === 'exited') return value;
  return 'unknown';
}
```

Add imports for `RenderedComposeServiceClass` and `DokployComposeTaskInspection`.

- [ ] **Step 4: Run tests**

Run:

```bash
pnpm -F @rntme/platform-http test -- dokploy-client-factory.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/platform-http/src/deploy/dokploy-client-factory.ts apps/platform-http/test/unit/deploy/dokploy-client-factory.test.ts
git commit -m "feat(platform-http): support dokploy compose service inspection"
```

## Task 6: Post-Apply Crash-Loop Verification

**Files:**
- Modify: `packages/platform/platform-core/src/schemas/deployment.ts`
- Modify: `packages/deploy/deploy-core/src/errors-verify.ts`
- Modify: `apps/platform-http/src/deploy/executor.ts`
- Test: `apps/platform-http/test/unit/deploy/executor.test.ts`

- [ ] **Step 1: Write failing executor test**

Append to `executor.test.ts`:

```ts
it('finalizes failed when compose stack guard detects crash-looping workload', async () => {
  const deployments = deploymentRepo();
  const rendered = renderedPlan();
  const applyResult = applyResultFromRendered(rendered);
  const deps = depsWith({
    deployments,
    renderPlan: async () => ({ ok: true, value: rendered }),
    applyPlan: async () => ({
      ok: true,
      value: {
        ...applyResult,
        verificationHints: {
          ...applyResult.verificationHints,
          stack: {
            composeId: 'compose_1',
            services: [{ name: 'svc-catalog', serviceClass: 'domain-service' }],
            inspections: [{ serviceName: 'svc-catalog', status: 'failed', failedCount: 3, message: 'exit code 1' }],
          },
        },
      },
    }),
  });

  await runDeployment('deployment-1', 'org-1', deps);

  expect(deployments.finalize).toHaveBeenCalledWith('deployment-1', expect.objectContaining({
    status: 'failed',
    errorCode: 'DEPLOY_VERIFY_WORKLOAD_CRASH_LOOP',
    errorMessage: 'workload crash loop detected',
  }));
  expect(deps.smoker.verify).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
pnpm -F @rntme/platform-http test -- executor.test.ts
```

Expected: FAIL because executor does not inspect stack verification hints.

- [ ] **Step 3: Extend verification schema**

In `packages/platform/platform-core/src/schemas/deployment.ts`, change `VerificationCheckSchema.status`:

```ts
const WorkloadStatusSchema = z.enum(['running', 'healthy', 'starting', 'failed', 'rejected', 'exited', 'unknown']);

export const VerificationCheckSchema = z.object({
  name: z.string(),
  url: z.string(),
  status: z.union([z.number().int(), z.literal('timeout'), z.literal('error'), WorkloadStatusSchema]),
  latencyMs: z.number().int().nonnegative(),
  ok: z.boolean(),
  note: z.string().optional(),
});
```

- [ ] **Step 4: Append verify error code**

In `packages/deploy/deploy-core/src/errors-verify.ts`, add:

```ts
  DEPLOY_VERIFY_WORKLOAD_CRASH_LOOP: 'DEPLOY_VERIFY_WORKLOAD_CRASH_LOOP',
```

- [ ] **Step 5: Add stack guard helper**

In `executor.ts`, add:

```ts
function verifyComposeStack(applyResult: DeploymentApplyResult): VerificationReport | null {
  const stack = applyResult.verificationHints.stack;
  if (stack === undefined) return null;
  const checks = (stack.inspections ?? []).map((inspection) => {
    const ok =
      inspection.status === 'running' ||
      inspection.status === 'healthy' ||
      inspection.status === 'starting' ||
      inspection.status === 'unknown';
    return {
      name: `workload ${inspection.serviceName}`,
      url: `dokploy:compose/${stack.composeId}/${inspection.serviceName}`,
      status: inspection.status,
      latencyMs: 0,
      ok: ok && inspection.failedCount === 0,
      note: inspection.message ?? `failedCount=${inspection.failedCount}`,
    };
  });
  if (checks.length === 0) return { checks: [], ok: true, partialOk: false };
  return { checks, ok: checks.every((check) => check.ok), partialOk: false };
}
```

- [ ] **Step 6: Run stack guard before smoke**

In `runDeployment`, before:

```ts
await appendLog(deps, deploymentId, orgId, 'info', 'verify', 'Running smoke verification');
const verification = await deps.smoker.verify(applied.value as DeploymentApplyResult);
await finalizeFromVerification(deps, deploymentId, orgId, verification);
```

insert:

```ts
await appendLog(deps, deploymentId, orgId, 'info', 'verify', 'Running compose stack verification');
const stackVerification = verifyComposeStack(applied.value as DeploymentApplyResult);
if (stackVerification !== null && !stackVerification.ok) {
  await finalize(deps, deploymentId, orgId, 'failed', {
    errorCode: 'DEPLOY_VERIFY_WORKLOAD_CRASH_LOOP',
    errorMessage: 'workload crash loop detected',
    verificationReport: stackVerification,
  });
  return;
}
```

Then keep existing smoke verification.

- [ ] **Step 7: Run tests**

Run:

```bash
pnpm -F @rntme/platform-http test -- executor.test.ts
pnpm -F @rntme/platform-core test -- package-smoke.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/platform/platform-core/src/schemas/deployment.ts packages/deploy/deploy-core/src/errors-verify.ts apps/platform-http/src/deploy/executor.ts apps/platform-http/test/unit/deploy/executor.test.ts
git commit -m "feat(platform): fail deployments on compose crash loops"
```

## Task 7: Old Topology Cleanup And Owner Docs

**Files:**
- Modify: `packages/deploy/deploy-dokploy/src/delete.ts`
- Modify: `packages/deploy/deploy-dokploy/src/apply.ts`
- Modify: `docs/current/owners/packages/deploy/deploy-dokploy.md`
- Test: `packages/deploy/deploy-dokploy/test/unit/apply.test.ts`

- [ ] **Step 1: Write cleanup test**

Add to `apply.test.ts`:

```ts
it('cleans old rntme-managed topology after project stack deploy succeeds', async () => {
  const client = new FakeDokployClient();
  client.oldApplications = [
    { id: 'app_old_1', name: 'rntme-acme-commerce-catalog', labels: { 'rntme.managed-by': 'rntme-deploy-dokploy' } },
  ];
  client.oldComposes = [
    { id: 'compose_old_1', name: 'rntme-acme-commerce-event-bus', labels: { 'rntme.managed-by': 'rntme-deploy-dokploy' } },
  ];

  const r = await applyDokployPlan(projectStackRendered(), client);

  expect(r.ok).toBe(true);
  expect(client.lifecycleCalls).toContain('delete-application:app_old_1');
  expect(client.lifecycleCalls).toContain('delete-compose:compose_old_1');
});
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
pnpm -F @rntme/deploy-dokploy test -- apply.test.ts
```

Expected: FAIL because there is no old-topology cleanup.

- [ ] **Step 3: Add optional list methods to client seam**

In `client.ts`, add:

```ts
  listApplications?(environmentId: string): Promise<readonly DokployApplication[]>;
  listComposes?(environmentId: string): Promise<readonly DokployCompose[]>;
```

- [ ] **Step 4: Implement best-effort cleanup in apply**

In `apply.ts`, after a successful project-stack apply and before `return ok`, call:

```ts
await cleanupOldTopology(client, environmentId, rendered, applied).catch(() => undefined);
```

Add helper:

```ts
async function cleanupOldTopology(
  client: DokployClient,
  environmentId: string,
  rendered: RenderedDokployPlan,
  applied: readonly DeploymentApplyResource[],
): Promise<void> {
  const stackName = applied.find((resource) => resource.infrastructureKind === 'project-stack')?.targetResourceName;
  const expectedPrefix = `rntme-${rendered.deployment.orgSlug}-${rendered.deployment.projectSlug}-`;
  const applications = await client.listApplications?.(environmentId) ?? [];
  for (const app of applications) {
    if (app.name === stackName) continue;
    if (!app.name.startsWith(expectedPrefix)) continue;
    if (app.labels?.['rntme.managed-by'] !== 'rntme-deploy-dokploy') continue;
    await client.deleteApplication(app.id);
  }
  const composes = await client.listComposes?.(environmentId) ?? [];
  for (const compose of composes) {
    if (compose.name === stackName) continue;
    if (!compose.name.startsWith(expectedPrefix)) continue;
    if (compose.labels?.['rntme.managed-by'] !== 'rntme-deploy-dokploy') continue;
    await client.deleteCompose(compose.id);
  }
}
```

- [ ] **Step 5: Update owner docs**

In `docs/current/owners/packages/deploy/deploy-dokploy.md`, replace the old topology description with:

```md
## Single Compose topology

Dokploy preview deploys render one Compose resource per
org/project/environment. The Compose resource is the deployment unit and
contains per-workload services for domain runtime services, integration modules,
edge, BPMN worker, and provisioned project infrastructure.

Service names are stable:

- `edge`
- `svc-<serviceSlug>`
- `mod-<moduleSlug>`
- `bpmn-worker`
- `redpanda`
- `operaton`
- `rustfs`

Runtime, module, worker, edge, and proxy services render bounded restart policy
and resource limits. Provisioned infra renders `restart: unless-stopped` for
host reboot recovery. Post-apply verification inspects Compose service/task
state before HTTP smoke verification and fails the deployment with
`DEPLOY_VERIFY_WORKLOAD_CRASH_LOOP` when failed/rejected/exited workload tasks
are observed.
```

- [ ] **Step 6: Run tests**

Run:

```bash
pnpm -F @rntme/deploy-dokploy test -- apply.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/deploy/deploy-dokploy/src/client.ts packages/deploy/deploy-dokploy/src/apply.ts packages/deploy/deploy-dokploy/test/unit/apply.test.ts docs/current/owners/packages/deploy/deploy-dokploy.md
git commit -m "feat(deploy-dokploy): cleanup old dokploy topology"
```

## Task 8: Final Integration Verification

**Files:**
- Verify: `packages/deploy/deploy-dokploy/src/`
- Verify: `apps/platform-http/src/deploy/`
- Verify: `packages/platform/platform-core/src/schemas/deployment.ts`
- Verify: `packages/deploy/deploy-core/src/errors-verify.ts`
- Verify: `docs/current/owners/packages/deploy/deploy-dokploy.md`

- [ ] **Step 1: Run package tests**

Run:

```bash
pnpm -F @rntme/deploy-dokploy test
pnpm -F @rntme/platform-http test
pnpm -F @rntme/platform-core test
```

Expected: all PASS.

- [ ] **Step 2: Run typecheck for touched packages**

Run:

```bash
pnpm -F @rntme/deploy-dokploy run typecheck
pnpm -F @rntme/platform-http run typecheck
pnpm -F @rntme/platform-core run typecheck
pnpm -F @rntme/deploy-core run typecheck
```

Expected: all PASS. If package scripts use `check` instead of `typecheck`, run the package's existing typecheck-equivalent script from `package.json`.

- [ ] **Step 3: Run lint for touched packages**

Run:

```bash
pnpm -F @rntme/deploy-dokploy run lint
pnpm -F @rntme/platform-http run lint
pnpm -F @rntme/platform-core run lint
pnpm -F @rntme/deploy-core run lint
```

Expected: all PASS.

- [ ] **Step 4: Run dependency layering**

Run:

```bash
pnpm depcruise
```

Expected: PASS.

- [ ] **Step 5: Inspect final diff**

Run:

```bash
git status --short
git log --oneline -n 8
```

Expected: only intentional changes remain; commits from Tasks 1-7 are present.

- [ ] **Step 6: Final commit for verification fixes**

If Step 1-4 required fixes, commit them:

```bash
git add packages/deploy/deploy-dokploy apps/platform-http packages/platform docs/current/owners/packages/deploy/deploy-dokploy.md
git commit -m "fix(deploy): align single compose deploy verification"
```

If Step 1-4 required no fixes, do not create an empty commit.

## Self-Review Notes

- Spec coverage: topology, restart/resource policy, render model, apply flow, files/secrets, crash-loop guard, migration cleanup, errors, tests, and docs each map to Tasks 1-8.
- Scope retained: background circuit breaker and service-level stop/scale remain outside this plan.
- Documentation touch: owner docs are updated in Task 7; decision-system was updated by the accepted spec commit.
