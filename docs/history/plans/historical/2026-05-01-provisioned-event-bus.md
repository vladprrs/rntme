> Status: historical.
> Date: 2026-05-01.
> Current source: docs/current/**, docs/decision-system.md, and current code/tests.
> Why retained: Historical rationale and execution context retained for review; it is not current-state truth by itself.

# Provisioned Event Bus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add explicit provisioned Redpanda event bus support to deploy planning, Dokploy rendering/apply, and the platform deploy target path.

**Architecture:** `deploy-core` owns the target-neutral event bus union and normalizes provisioned Redpanda into planned infrastructure. `deploy-dokploy` renders provisioned Redpanda as a Dokploy Compose resource and applies compose resources before application resources. `platform-core` and `platform-http` accept and pass through the new deploy target event bus shape.

**Tech Stack:** TypeScript ESM, Zod, Vitest, Hono JSX, Dokploy HTTP API, Docker Compose, Redpanda.

---

## File Structure

- `packages/deploy/deploy-core/src/config.ts` - authored deployment config union for external and provisioned event buses.
- `packages/deploy/deploy-core/src/errors.ts` - new planner error codes.
- `packages/deploy/deploy-core/src/plan.ts` - planned event bus normalization and stable provisioned infrastructure names.
- `packages/deploy/deploy-core/src/index.ts` - exports for new event bus types.
- `packages/deploy/deploy-core/test/unit/plan.test.ts` - planner behavior for external compatibility and provisioned Redpanda.
- `packages/deploy/deploy-dokploy/src/render.ts` - rendered resource union, Redpanda compose rendering, provisioned broker env rendering.
- `packages/deploy/deploy-dokploy/src/apply.ts` - generalized resource apply flow for applications and compose resources.
- `packages/deploy/deploy-dokploy/src/client.ts` - `DokployCompose` type and compose client seam.
- `packages/deploy/deploy-dokploy/src/errors.ts` - partial failure resource types generalized to application/compose resources.
- `packages/deploy/deploy-dokploy/test/unit/render.test.ts` - compose resource rendering and provisioned env tests.
- `packages/deploy/deploy-dokploy/test/unit/apply.test.ts` - compose-first apply order and compose create/update/unchanged tests.
- `apps/platform-http/src/deploy/dokploy-client-factory.ts` - real Dokploy Compose API calls.
- `apps/platform-http/test/unit/deploy/dokploy-client-factory.test.ts` - HTTP endpoint tests for compose create/update/deploy.
- `packages/platform/platform-core/src/schemas/deploy-target.ts` - Zod schema for old external, explicit external, and provisioned Redpanda.
- `packages/platform/platform-core/test/unit/use-cases/deploy-targets.test.ts` - deploy target schema/use-case acceptance for provisioned Redpanda.
- `apps/platform-http/src/deploy/build-deploy-config.ts` - pass provisioned event bus config through.
- `apps/platform-http/test/unit/deploy/build-deploy-config.test.ts` - pass-through test.
- `apps/platform-http/src/ui/pages/deploy-targets.tsx` - display event bus mode.
- `apps/platform-http/test/unit/ui/pages.test.tsx` - UI rendering test for provisioned mode.
- `packages/deploy/deploy-core/README.md` - document event bus modes.
- `packages/deploy/deploy-dokploy/README.md` - document Redpanda Compose rendering/apply.
- `apps/platform-http/README.md` - document deploy target event bus options.
- `AGENTS.md` - update §6.14 only if current deploy instructions imply external-only Redpanda.

---

### Task 1: Deploy-Core Event Bus Union

**Files:**
- Modify: `packages/deploy/deploy-core/src/config.ts`
- Modify: `packages/deploy/deploy-core/src/errors.ts`
- Modify: `packages/deploy/deploy-core/src/plan.ts`
- Modify: `packages/deploy/deploy-core/src/index.ts`
- Test: `packages/deploy/deploy-core/test/unit/plan.test.ts`

- [ ] **Step 1: Write failing deploy-core tests**

Append these tests inside the existing `describe('buildProjectDeploymentPlan', () => {` block in `packages/deploy/deploy-core/test/unit/plan.test.ts`.

```ts
  it('normalizes legacy external event bus configs without mode', () => {
    const r = buildProjectDeploymentPlan(project, {
      ...previewConfig,
      eventBus: {
        kind: 'kafka',
        brokers: ['redpanda.internal:9092'],
      } as ProjectDeploymentConfig['eventBus'],
    });

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.infrastructure.eventBus).toEqual({
      kind: 'kafka',
      mode: 'external',
      brokers: ['redpanda.internal:9092'],
    });
  });

  it('plans provisioned Redpanda infrastructure with deterministic names', () => {
    const r = buildProjectDeploymentPlan(project, {
      ...previewConfig,
      eventBus: {
        kind: 'kafka',
        mode: 'provisioned',
        provider: 'redpanda',
        topicPrefix: 'rntme.notes',
      },
    });

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.infrastructure.eventBus).toEqual({
      kind: 'kafka',
      mode: 'provisioned',
      provider: 'redpanda',
      resourceName: 'rntme-acme-commerce-event-bus',
      internalBrokers: ['rntme-acme-commerce-event-bus:9092'],
      topicPrefix: 'rntme.notes',
      image: 'docker.redpanda.com/redpandadata/redpanda:v24.3.6',
      persistence: {
        mode: 'persistent',
        volumeName: 'rntme-acme-commerce-event-bus-data',
      },
    });
  });

  it('allows overriding the provisioned Redpanda image with a pinned image', () => {
    const r = buildProjectDeploymentPlan(project, {
      ...previewConfig,
      eventBus: {
        kind: 'kafka',
        mode: 'provisioned',
        provider: 'redpanda',
        image: 'docker.redpanda.com/redpandadata/redpanda:v25.1.1',
      },
    });

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.infrastructure.eventBus).toMatchObject({
      mode: 'provisioned',
      image: 'docker.redpanda.com/redpandadata/redpanda:v25.1.1',
    });
  });

  it('rejects unsupported provisioned event bus providers', () => {
    const r = buildProjectDeploymentPlan(project, {
      ...previewConfig,
      eventBus: {
        kind: 'kafka',
        mode: 'provisioned',
        provider: 'kafka',
      } as ProjectDeploymentConfig['eventBus'],
    });

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toContainEqual(
        expect.objectContaining({
          code: 'DEPLOY_PLAN_EVENT_BUS_PROVIDER_UNSUPPORTED',
          path: 'eventBus.provider',
        }),
      );
    }
  });

  it('rejects latest as a provisioned Redpanda image tag', () => {
    const r = buildProjectDeploymentPlan(project, {
      ...previewConfig,
      eventBus: {
        kind: 'kafka',
        mode: 'provisioned',
        provider: 'redpanda',
        image: 'docker.redpanda.com/redpandadata/redpanda:latest',
      },
    });

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toContainEqual(
        expect.objectContaining({
          code: 'DEPLOY_PLAN_EVENT_BUS_IMAGE_INVALID',
          path: 'eventBus.image',
        }),
      );
    }
  });
```

- [ ] **Step 2: Run deploy-core tests and verify failure**

Run:

```bash
pnpm -F @rntme/deploy-core test -- test/unit/plan.test.ts
```

Expected: FAIL with TypeScript or assertion errors because `mode: "provisioned"` and the new planner fields are not implemented.

- [ ] **Step 3: Replace event bus config types**

In `packages/deploy/deploy-core/src/config.ts`, replace the existing `ExternalEventBusConfig` definition with these definitions.

```ts
export const DEFAULT_REDPANDA_IMAGE = 'docker.redpanda.com/redpandadata/redpanda:v24.3.6';

export type ExternalEventBusConfig = {
  readonly kind: 'kafka';
  readonly mode?: 'external';
  readonly brokers: readonly string[];
  readonly topicPrefix?: string;
  readonly security?: ExternalEventBusSecurity;
};

export type ProvisionedEventBusConfig = {
  readonly kind: 'kafka';
  readonly mode: 'provisioned';
  readonly provider: 'redpanda';
  readonly image?: string;
  readonly topicPrefix?: string;
};

export type EventBusConfig = ExternalEventBusConfig | ProvisionedEventBusConfig;
```

In the same file, change `ProjectDeploymentConfig.eventBus` to:

```ts
  readonly eventBus?: EventBusConfig;
```

- [ ] **Step 4: Add deploy-core error codes**

In `packages/deploy/deploy-core/src/errors.ts`, add these entries immediately after `DEPLOY_PLAN_MISSING_EVENT_BUS`.

```ts
  DEPLOY_PLAN_EVENT_BUS_MODE_UNSUPPORTED: 'DEPLOY_PLAN_EVENT_BUS_MODE_UNSUPPORTED',
  DEPLOY_PLAN_EVENT_BUS_PROVIDER_UNSUPPORTED: 'DEPLOY_PLAN_EVENT_BUS_PROVIDER_UNSUPPORTED',
  DEPLOY_PLAN_EVENT_BUS_IMAGE_INVALID: 'DEPLOY_PLAN_EVENT_BUS_IMAGE_INVALID',
```

- [ ] **Step 5: Add planned event bus types and normalization**

In `packages/deploy/deploy-core/src/plan.ts`, update the config import to include `DEFAULT_REDPANDA_IMAGE`, `EventBusConfig`, `ExternalEventBusConfig`, and `ExternalEventBusSecurity`.

```ts
import type { ComposedProjectInput } from './composed-project.js';
import {
  DEFAULT_REDPANDA_IMAGE,
  type DeploymentMode,
  type EventBusConfig,
  type ExternalEventBusConfig,
  type ExternalEventBusSecurity,
  type ProjectAuthConfig,
  type ProjectDeploymentConfig,
} from './config.js';
```

Replace `ProjectDeploymentPlan.infrastructure.eventBus: ExternalEventBusConfig` with `PlannedEventBus`, and add this type above `ProjectDeploymentPlan`.

```ts
export type PlannedExternalEventBus = {
  readonly kind: 'kafka';
  readonly mode: 'external';
  readonly brokers: readonly string[];
  readonly topicPrefix?: string;
  readonly security?: ExternalEventBusSecurity;
};

export type PlannedProvisionedEventBus = {
  readonly kind: 'kafka';
  readonly mode: 'provisioned';
  readonly provider: 'redpanda';
  readonly resourceName: string;
  readonly internalBrokers: readonly string[];
  readonly topicPrefix?: string;
  readonly image: string;
  readonly persistence: {
    readonly mode: 'persistent';
    readonly volumeName: string;
  };
};

export type PlannedEventBus = PlannedExternalEventBus | PlannedProvisionedEventBus;
```

In `buildProjectDeploymentPlan`, replace the event bus validation block with this code.

```ts
  const plannedEventBus =
    config.eventBus === undefined
      ? undefined
      : planEventBus(config.eventBus, config.orgSlug, project.name, errors);

  if (config.eventBus === undefined) {
    errors.push({
      code: 'DEPLOY_PLAN_MISSING_EVENT_BUS',
      message: 'preview deployments require one project-level Kafka/Redpanda event bus',
      path: 'eventBus',
    });
  }
```

Replace the final error guard and infrastructure assignment with:

```ts
  if (errors.length > 0 || plannedEventBus === undefined) return err(errors);

  return ok({
    project: {
      orgSlug: config.orgSlug,
      projectSlug: project.name,
      environment: config.environment,
      mode: config.mode,
    },
    infrastructure: {
      eventBus: plannedEventBus,
      ...(config.auth !== undefined ? { auth: config.auth } : {}),
    },
    workloads,
    edge,
    diagnostics: { warnings: [] },
  });
```

Add these helper functions near `validateEventBusSecurity`.

```ts
function planEventBus(
  eventBus: EventBusConfig,
  orgSlug: string,
  projectSlug: string,
  errors: DeploymentPlanError[],
): PlannedEventBus | undefined {
  const mode = (eventBus as { readonly mode?: unknown }).mode ?? 'external';
  if (mode === 'external') {
    const external = eventBus as ExternalEventBusConfig;
    if (external.brokers.length === 0) {
      errors.push({
        code: 'DEPLOY_PLAN_MISSING_EVENT_BUS',
        message: 'preview deployments require one project-level external Kafka/Redpanda endpoint',
        path: 'eventBus',
      });
      return undefined;
    }
    validateEventBusSecurity(external, errors);
    return {
      kind: 'kafka',
      mode: 'external',
      brokers: external.brokers,
      ...(external.topicPrefix === undefined ? {} : { topicPrefix: external.topicPrefix }),
      ...(external.security === undefined ? {} : { security: external.security }),
    };
  }

  if (mode !== 'provisioned') {
    errors.push({
      code: 'DEPLOY_PLAN_EVENT_BUS_MODE_UNSUPPORTED',
      message: `unsupported event bus mode "${String(mode)}"`,
      path: 'eventBus.mode',
    });
    return undefined;
  }

  const provisioned = eventBus as Extract<EventBusConfig, { mode: 'provisioned' }>;
  if (provisioned.provider !== 'redpanda') {
    errors.push({
      code: 'DEPLOY_PLAN_EVENT_BUS_PROVIDER_UNSUPPORTED',
      message: `unsupported provisioned event bus provider "${String(provisioned.provider)}"`,
      path: 'eventBus.provider',
    });
    return undefined;
  }

  const image = provisioned.image ?? DEFAULT_REDPANDA_IMAGE;
  if (!isPinnedContainerImage(image)) {
    errors.push({
      code: 'DEPLOY_PLAN_EVENT_BUS_IMAGE_INVALID',
      message: 'provisioned Redpanda image must use a non-latest tag',
      path: 'eventBus.image',
    });
    return undefined;
  }

  const resource = resourceName(orgSlug, projectSlug, 'event-bus');
  return {
    kind: 'kafka',
    mode: 'provisioned',
    provider: 'redpanda',
    resourceName: resource,
    internalBrokers: [`${resource}:9092`],
    ...(provisioned.topicPrefix === undefined ? {} : { topicPrefix: provisioned.topicPrefix }),
    image,
    persistence: {
      mode: 'persistent',
      volumeName: `${resource}-data`,
    },
  };
}

function isPinnedContainerImage(image: string): boolean {
  const trimmed = image.trim();
  if (trimmed === '') return false;
  const lastSlash = trimmed.lastIndexOf('/');
  const lastColon = trimmed.lastIndexOf(':');
  if (lastColon <= lastSlash) return false;
  return trimmed.slice(lastColon + 1) !== 'latest';
}
```

- [ ] **Step 6: Export new deploy-core types**

In `packages/deploy/deploy-core/src/index.ts`, export the new config and plan types.

```ts
  DEFAULT_REDPANDA_IMAGE,
  type EventBusConfig,
  type ExternalEventBusConfig,
  type ProvisionedEventBusConfig,
```

In the plan exports, add:

```ts
  type PlannedEventBus,
  type PlannedExternalEventBus,
  type PlannedProvisionedEventBus,
```

- [ ] **Step 7: Run deploy-core tests**

Run:

```bash
pnpm -F @rntme/deploy-core test -- test/unit/plan.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit deploy-core work**

Run:

```bash
git add packages/deploy/deploy-core/src/config.ts packages/deploy/deploy-core/src/errors.ts packages/deploy/deploy-core/src/plan.ts packages/deploy/deploy-core/src/index.ts packages/deploy/deploy-core/test/unit/plan.test.ts
git commit -m "feat(deploy-core): plan provisioned event bus"
```

---

### Task 2: Dokploy Rendered Compose Resource

**Files:**
- Modify: `packages/deploy/deploy-dokploy/src/render.ts`
- Test: `packages/deploy/deploy-dokploy/test/unit/render.test.ts`

- [ ] **Step 1: Write failing render tests**

In `packages/deploy/deploy-dokploy/test/unit/render.test.ts`, add this test near the existing rendering tests.

```ts
  it('renders provisioned Redpanda as an internal compose resource before applications', () => {
    const r = renderDokployPlan(
      {
        ...plan,
        infrastructure: {
          eventBus: {
            kind: 'kafka',
            mode: 'provisioned',
            provider: 'redpanda',
            resourceName: 'rntme-acme-commerce-event-bus',
            internalBrokers: ['rntme-acme-commerce-event-bus:9092'],
            topicPrefix: 'rntme.notes',
            image: 'docker.redpanda.com/redpandadata/redpanda:v24.3.6',
            persistence: {
              mode: 'persistent',
              volumeName: 'rntme-acme-commerce-event-bus-data',
            },
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

    expect(r.value.resources.map((resource) => resource.kind)).toEqual([
      'compose',
      'application',
      'application',
    ]);
    const redpanda = r.value.resources[0];
    expect(redpanda).toMatchObject({
      logicalId: 'event-bus',
      kind: 'compose',
      infrastructureKind: 'event-bus',
      name: 'rntme-acme-commerce-event-bus',
      image: 'docker.redpanda.com/redpandadata/redpanda:v24.3.6',
      labels: {
        'rntme.infrastructure': 'event-bus',
        'rntme.provider': 'redpanda',
      },
    });
    expect(redpanda).not.toHaveProperty('ingress');
    expect(redpanda).not.toHaveProperty('ports');
    expect(redpanda.kind).toBe('compose');
    if (redpanda.kind !== 'compose') return;
    expect(redpanda.composeFile).toContain('redpanda start');
    expect(redpanda.composeFile).toContain('rntme-acme-commerce-event-bus-data');

    const domain = r.value.resources.find(
      (resource) => resource.kind === 'application' && resource.workloadKind === 'domain-service',
    );
    expect(domain?.env).toContainEqual({
      name: 'RNTME_EVENT_BUS_BROKERS',
      value: 'rntme-acme-commerce-event-bus:9092',
      secret: false,
    });
    expect(domain?.env).toContainEqual({
      name: 'RNTME_EVENT_BUS_PROTOCOL',
      value: 'plaintext',
      secret: false,
    });
    expect(domain?.env).toContainEqual({
      name: 'RNTME_EVENT_BUS_TOPIC_PREFIX',
      value: 'rntme.notes',
      secret: false,
    });
  });
```

- [ ] **Step 2: Run render tests and verify failure**

Run:

```bash
pnpm -F @rntme/deploy-dokploy test -- test/unit/render.test.ts
```

Expected: FAIL because rendered resources do not support `kind: "compose"` and provisioned event bus env rendering is not implemented.

- [ ] **Step 3: Split rendered resource types**

In `packages/deploy/deploy-dokploy/src/render.ts`, replace the single `RenderedDokployResource` type with these types.

```ts
export type RenderedDokployApplicationResource = {
  readonly logicalId: string;
  readonly kind: 'application';
  readonly workloadKind: DeploymentWorkload['kind'];
  readonly workloadSlug: string;
  readonly name: string;
  readonly image: string;
  readonly build?: RenderedDomainArtifactBuild;
  readonly ports?: readonly RenderedDokployPort[];
  readonly ingress?: RenderedDokployIngress;
  readonly env: readonly RenderedEnvVar[];
  readonly labels: Readonly<Record<string, string>>;
  readonly files?: Readonly<Record<string, string>>;
};

export type RenderedDokployComposeResource = {
  readonly logicalId: string;
  readonly kind: 'compose';
  readonly infrastructureKind: 'event-bus';
  readonly name: string;
  readonly image: string;
  readonly composeFile: string;
  readonly env: readonly RenderedEnvVar[];
  readonly labels: Readonly<Record<string, string>>;
};

export type RenderedDokployResource =
  | RenderedDokployApplicationResource
  | RenderedDokployComposeResource;
```

- [ ] **Step 4: Render Redpanda compose resources before workloads**

In `renderDokployPlan`, replace the `resources` initialization with:

```ts
  const infrastructureResources = renderInfrastructureResources(plan);
  const resources = [
    ...infrastructureResources,
    ...plan.workloads.map((workload) => renderResource(plan, workload, nginxConfig.value)),
  ];
```

Add these helper functions below `resolveProject`.

```ts
function renderInfrastructureResources(plan: ProjectDeploymentPlan): RenderedDokployResource[] {
  const eventBus = plan.infrastructure.eventBus;
  if (eventBus.mode !== 'provisioned') return [];
  return [renderRedpandaCompose(plan)];
}

function renderRedpandaCompose(plan: ProjectDeploymentPlan): RenderedDokployComposeResource {
  const eventBus = plan.infrastructure.eventBus;
  if (eventBus.mode !== 'provisioned') {
    throw new Error('renderRedpandaCompose called for external event bus');
  }

  const labels = {
    ...dokployLabels(
      plan.project.orgSlug,
      plan.project.projectSlug,
      plan.project.environment,
      'event-bus',
    ),
    'rntme.infrastructure': 'event-bus',
    'rntme.provider': eventBus.provider,
  };

  return {
    logicalId: 'event-bus',
    kind: 'compose',
    infrastructureKind: 'event-bus',
    name: eventBus.resourceName,
    image: eventBus.image,
    composeFile: redpandaComposeFile(eventBus),
    env: [],
    labels,
  };
}

function redpandaComposeFile(
  eventBus: Extract<ProjectDeploymentPlan['infrastructure']['eventBus'], { mode: 'provisioned' }>,
): string {
  return [
    'services:',
    '  redpanda:',
    `    image: ${eventBus.image}`,
    '    command:',
    '      - redpanda',
    '      - start',
    '      - --mode=dev-container',
    '      - --smp=1',
    '      - --memory=512M',
    '      - --reserve-memory=0M',
    '      - --overprovisioned',
    '      - --kafka-addr=internal://0.0.0.0:9092',
    '      - --advertise-kafka-addr=internal://redpanda:9092',
    '    volumes:',
    `      - ${eventBus.persistence.volumeName}:/var/lib/redpanda/data`,
    'volumes:',
    `  ${eventBus.persistence.volumeName}:`,
    '    name: ' + eventBus.persistence.volumeName,
    '',
  ].join('\n');
}
```

- [ ] **Step 5: Render event bus env for both modes**

Replace the domain service `RNTME_EVENT_BUS_BROKERS` env entry and `eventBusSecurityEnv` call with:

```ts
        ...eventBusEnv(plan.infrastructure.eventBus),
```

Replace `eventBusSecurityEnv` with:

```ts
function eventBusEnv(
  eventBus: ProjectDeploymentPlan['infrastructure']['eventBus'],
): RenderedEnvVar[] {
  if (eventBus.mode === 'provisioned') {
    return [
      {
        name: 'RNTME_EVENT_BUS_BROKERS',
        value: eventBus.internalBrokers.join(','),
        secret: false,
      },
      { name: 'RNTME_EVENT_BUS_PROTOCOL', value: 'plaintext', secret: false },
      ...(eventBus.topicPrefix === undefined || eventBus.topicPrefix === ''
        ? []
        : [{ name: 'RNTME_EVENT_BUS_TOPIC_PREFIX', value: eventBus.topicPrefix, secret: false }]),
    ];
  }

  const env: RenderedEnvVar[] = [
    {
      name: 'RNTME_EVENT_BUS_BROKERS',
      value: eventBus.brokers.join(','),
      secret: false,
    },
  ];
  if (eventBus.security?.protocol === 'sasl_ssl') {
    env.push(
      { name: 'RNTME_EVENT_BUS_PROTOCOL', value: 'sasl_ssl', secret: false },
      { name: 'RNTME_EVENT_BUS_MECHANISM', value: eventBus.security.mechanism, secret: false },
      { name: 'RNTME_EVENT_BUS_USERNAME', value: eventBus.security.secretRefs.username, secret: true },
      { name: 'RNTME_EVENT_BUS_PASSWORD', value: eventBus.security.secretRefs.password, secret: true },
    );
  } else {
    env.push({ name: 'RNTME_EVENT_BUS_PROTOCOL', value: 'plaintext', secret: false });
  }
  if (eventBus.topicPrefix !== undefined && eventBus.topicPrefix !== '') {
    env.push({ name: 'RNTME_EVENT_BUS_TOPIC_PREFIX', value: eventBus.topicPrefix, secret: false });
  }
  return env;
}
```

- [ ] **Step 6: Keep edge ingress decoration application-only**

In `renderDokployPlan`, replace the resources mapping that adds edge ports/ingress with:

```ts
    resources: resources.map((resource) =>
      resource.kind === 'application' && resource.workloadKind === 'edge-gateway'
        ? {
            ...resource,
            ports: [{ containerPort: 8080, protocol: 'http' as const }],
            ingress: {
              publicBaseUrl: config.publicBaseUrl,
              containerPort: 8080,
              healthPath: '/health' as const,
              routes: publicRoutes,
            },
          }
        : resource,
    ),
```

- [ ] **Step 7: Run render tests**

Run:

```bash
pnpm -F @rntme/deploy-dokploy test -- test/unit/render.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit render work**

Run:

```bash
git add packages/deploy/deploy-dokploy/src/render.ts packages/deploy/deploy-dokploy/test/unit/render.test.ts
git commit -m "feat(deploy-dokploy): render provisioned Redpanda compose"
```

---

### Task 3: Dokploy Apply Compose Resources

**Files:**
- Modify: `packages/deploy/deploy-dokploy/src/client.ts`
- Modify: `packages/deploy/deploy-dokploy/src/errors.ts`
- Modify: `packages/deploy/deploy-dokploy/src/apply.ts`
- Modify: `packages/deploy/deploy-dokploy/src/index.ts`
- Test: `packages/deploy/deploy-dokploy/test/unit/apply.test.ts`

- [ ] **Step 1: Write failing apply tests**

In `packages/deploy/deploy-dokploy/test/unit/apply.test.ts`, add this helper below the existing `rendered` constant.

```ts
const renderedWithCompose: RenderedDokployPlan = {
  ...rendered,
  resources: [
    {
      logicalId: 'event-bus',
      kind: 'compose',
      infrastructureKind: 'event-bus',
      name: 'rntme-acme-commerce-event-bus',
      image: 'docker.redpanda.com/redpandadata/redpanda:v24.3.6',
      composeFile: 'services:\n  redpanda:\n    image: docker.redpanda.com/redpandadata/redpanda:v24.3.6\n',
      env: [],
      labels: { 'rntme.infrastructure': 'event-bus' },
    },
    ...rendered.resources,
  ],
};
```

Add these tests in the `describe('applyDokployPlan', () => {` block.

```ts
  it('applies compose resources before application resources', async () => {
    const client = new FakeDokployClient();
    const r = await applyDokployPlan(renderedWithCompose, client);

    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(client.lifecycleCalls).toEqual([
      'create-compose:rntme-acme-commerce-event-bus',
      'configure-compose:compose_1:rntme-acme-commerce-event-bus',
      'deploy-compose:compose_1',
      'create:rntme-acme-commerce-catalog',
      'configure:app_1:rntme-acme-commerce-catalog',
      'deploy:app_1',
    ]);
    expect(r.value.resources).toEqual([
      {
        logicalId: 'event-bus',
        resourceKind: 'compose',
        infrastructureKind: 'event-bus',
        targetResourceId: 'compose_1',
        targetResourceName: 'rntme-acme-commerce-event-bus',
        action: 'created',
      },
      {
        logicalId: 'catalog',
        resourceKind: 'application',
        workloadSlug: 'catalog',
        kind: 'domain-service',
        targetResourceId: 'app_1',
        targetResourceName: 'rntme-acme-commerce-catalog',
        action: 'created',
      },
    ]);
  });

  it('leaves matching compose resources unchanged', async () => {
    const client = new FakeDokployClient([], [
      {
        id: 'compose_existing',
        name: 'rntme-acme-commerce-event-bus',
        image: 'docker.redpanda.com/redpandadata/redpanda:v24.3.6',
        composeFile: 'services:\n  redpanda:\n    image: docker.redpanda.com/redpandadata/redpanda:v24.3.6\n',
        env: [],
        labels: { 'rntme.infrastructure': 'event-bus' },
      },
    ]);
    const r = await applyDokployPlan(
      { ...renderedWithCompose, resources: [renderedWithCompose.resources[0]] },
      client,
    );

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.resources[0]).toMatchObject({
      resourceKind: 'compose',
      targetResourceId: 'compose_existing',
      action: 'unchanged',
    });
    expect(client.updateComposeCalls).toEqual([]);
  });
```

Extend `FakeDokployClient` constructor and methods in the same test file to compile against the new interface.

Update the client type import at the top of `packages/deploy/deploy-dokploy/test/unit/apply.test.ts`:

```ts
import type { DokployApplication, DokployClient, DokployCompose, DokployProjectRef } from '../../src/client.js';
```

```ts
  readonly composeResources = new Map<string, DokployCompose>();
  readonly createComposeCalls: unknown[] = [];
  readonly updateComposeCalls: unknown[] = [];
  readonly configureComposeCalls: unknown[] = [];

  constructor(
    existing: DokployApplication[] = [],
    existingCompose: DokployCompose[] = [],
  ) {
    for (const app of existing) this.applications.set(app.name, app);
    for (const compose of existingCompose) this.composeResources.set(compose.name, compose);
  }
```

Update existing exact application resource expectations in this file by adding `resourceKind: 'application'` to each expected applied application resource. For the first success test, the expected resource becomes:

```ts
    expect(r.value.resources).toEqual([
      {
        logicalId: 'catalog',
        resourceKind: 'application',
        workloadSlug: 'catalog',
        kind: 'domain-service',
        targetResourceId: 'app_1',
        targetResourceName: 'rntme-acme-commerce-catalog',
        action: 'created',
      },
    ]);
```

For the unchanged-resource test, the expected resource becomes:

```ts
    expect(r.value.resources[0]).toEqual({
      logicalId: 'catalog',
      resourceKind: 'application',
      workloadSlug: 'catalog',
      kind: 'domain-service',
      targetResourceId: 'app_existing',
      targetResourceName: 'rntme-acme-commerce-catalog',
      action: 'unchanged',
    });
```

Add methods to `FakeDokployClient`.

```ts
  async findComposeByName(_environmentId: string, name: string): Promise<DokployCompose | null> {
    return this.composeResources.get(name) ?? null;
  }

  async createCompose(environmentId: string, resource: Extract<RenderedDokployResource, { kind: 'compose' }>): Promise<DokployCompose> {
    this.createComposeCalls.push({ environmentId, resource });
    this.lifecycleCalls.push(`create-compose:${resource.name}`);
    const created = {
      id: `compose_${this.composeResources.size + 1}`,
      name: resource.name,
      image: resource.image,
      composeFile: resource.composeFile,
      env: resource.env,
      labels: resource.labels,
    };
    this.composeResources.set(resource.name, created);
    return created;
  }

  async updateCompose(composeId: string, resource: Extract<RenderedDokployResource, { kind: 'compose' }>): Promise<DokployCompose> {
    this.updateComposeCalls.push({ composeId, resource });
    this.lifecycleCalls.push(`update-compose:${composeId}:${resource.name}`);
    const updated = {
      id: composeId,
      name: resource.name,
      image: resource.image,
      composeFile: resource.composeFile,
      env: resource.env,
      labels: resource.labels,
    };
    this.composeResources.set(resource.name, updated);
    return updated;
  }

  async configureCompose(composeId: string, resource: Extract<RenderedDokployResource, { kind: 'compose' }>): Promise<void> {
    this.configureComposeCalls.push({ composeId, resource });
    this.lifecycleCalls.push(`configure-compose:${composeId}:${resource.name}`);
  }

  async deployCompose(composeId: string): Promise<void> {
    this.lifecycleCalls.push(`deploy-compose:${composeId}`);
  }
```

- [ ] **Step 2: Run apply tests and verify failure**

Run:

```bash
pnpm -F @rntme/deploy-dokploy test -- test/unit/apply.test.ts
```

Expected: FAIL because `DokployCompose` and compose apply branches do not exist.

- [ ] **Step 3: Add compose client types**

In `packages/deploy/deploy-dokploy/src/client.ts`, add this type after `DokployApplication`.

```ts
export type DokployCompose = {
  readonly id: string;
  readonly name: string;
  readonly appName?: string;
  readonly image?: string;
  readonly composeFile?: string;
  readonly env?: readonly RenderedEnvVar[];
  readonly labels?: Readonly<Record<string, string>>;
};
```

Add these methods to `DokployClient`.

```ts
  createApplication(
    environmentId: string,
    resource: Extract<RenderedDokployResource, { kind: 'application' }>,
  ): Promise<DokployApplication>;
  updateApplication(
    applicationId: string,
    resource: Extract<RenderedDokployResource, { kind: 'application' }>,
  ): Promise<DokployApplication>;
  configureApplication(
    applicationId: string,
    resource: Extract<RenderedDokployResource, { kind: 'application' }>,
  ): Promise<void>;
  findComposeByName(environmentId: string, name: string): Promise<DokployCompose | null>;
  createCompose(
    environmentId: string,
    resource: Extract<RenderedDokployResource, { kind: 'compose' }>,
  ): Promise<DokployCompose>;
  updateCompose(
    composeId: string,
    resource: Extract<RenderedDokployResource, { kind: 'compose' }>,
  ): Promise<DokployCompose>;
  configureCompose(
    composeId: string,
    resource: Extract<RenderedDokployResource, { kind: 'compose' }>,
  ): Promise<void>;
  deployCompose(composeId: string): Promise<void>;
```

Replace the existing `createApplication`, `updateApplication`, and `configureApplication` signatures with the narrower application-only signatures shown above.

- [ ] **Step 4: Generalize partial failure resource types**

In `packages/deploy/deploy-dokploy/src/errors.ts`, replace `DokployPartialFailureResource` with:

```ts
export type DokployPartialFailureResource = {
  readonly logicalId: string;
  readonly resourceKind: 'application' | 'compose';
  readonly workloadSlug?: string;
  readonly kind?: 'domain-service' | 'integration-module' | 'edge-gateway';
  readonly infrastructureKind?: 'event-bus';
  readonly targetResourceId: string;
  readonly targetResourceName: string;
  readonly action: 'created' | 'updated' | 'unchanged';
};
```

Replace `DokployPartialFailureStep` with:

```ts
export type DokployPartialFailureStep = {
  readonly action: 'find' | 'create' | 'update' | 'configure' | 'deploy' | 'start';
  readonly resourceName: string;
  readonly resourceKind: 'application' | 'compose';
  readonly workloadSlug?: string;
  readonly infrastructureKind?: 'event-bus';
};
```

- [ ] **Step 5: Generalize apply result and resource apply flow**

In `packages/deploy/deploy-dokploy/src/apply.ts`, replace `DeploymentApplyResource` with:

```ts
export type DeploymentApplyResource = {
  readonly logicalId: string;
  readonly resourceKind: 'application' | 'compose';
  readonly workloadSlug?: string;
  readonly kind?: 'domain-service' | 'integration-module' | 'edge-gateway';
  readonly infrastructureKind?: 'event-bus';
  readonly targetResourceId: string;
  readonly targetResourceName: string;
  readonly action: 'created' | 'updated' | 'unchanged';
};
```

Add these helpers near `appliedResource`.

```ts
function appliedResource(
  resource: RenderedDokployResource,
  target: { readonly id: string; readonly name: string },
  action: DeploymentApplyResource['action'],
): DeploymentApplyResource {
  if (resource.kind === 'compose') {
    return {
      logicalId: resource.logicalId,
      resourceKind: 'compose',
      infrastructureKind: resource.infrastructureKind,
      targetResourceId: target.id,
      targetResourceName: target.name,
      action,
    };
  }

  return {
    logicalId: resource.logicalId,
    resourceKind: 'application',
    workloadSlug: resource.workloadSlug,
    kind: resource.workloadKind,
    targetResourceId: target.id,
    targetResourceName: target.name,
    action,
  };
}

function resourceIdentifier(resource: RenderedDokployResource): {
  readonly resourceKind: 'application' | 'compose';
  readonly workloadSlug?: string;
  readonly infrastructureKind?: 'event-bus';
} {
  return resource.kind === 'compose'
    ? { resourceKind: 'compose', infrastructureKind: resource.infrastructureKind }
    : { resourceKind: 'application', workloadSlug: resource.workloadSlug };
}
```

Update `partialFailure` to include `resourceIdentifier(resource)` in `failedStep`.

```ts
      partialFailure: buildPartialFailure(applied, {
        action,
        resourceName: resource.name,
        ...resourceIdentifier(resource),
      }),
```

- [ ] **Step 6: Add compose prepare and lifecycle branches**

In `applyDokployPlan`, change prepared items to store `RenderedDokployResource` plus either application or compose target.

```ts
  const orderedResources = [...rendered.resources].sort((a, b) => {
    if (a.kind === b.kind) return 0;
    return a.kind === 'compose' ? -1 : 1;
  });
  const prepared: Array<{
    readonly resource: RenderedDokployResource;
    readonly target: DokployApplication | DokployCompose;
    readonly created: boolean;
  }> = [];
```

Replace the resource preparation loop with:

```ts
    for (const resource of orderedResources) {
      const existingResult =
        resource.kind === 'compose'
          ? await findExistingCompose(client, environmentId, resource, applied)
          : await findExistingApplication(client, environmentId, resource, applied);
      if (!existingResult.ok) return existingResult;

      const existing = existingResult.value;
      if (existing === null) {
        const createResult =
          resource.kind === 'compose'
            ? await createComposeTarget(client, environmentId, resource, applied)
            : await createApplicationTarget(client, environmentId, resource, applied);
        if (!createResult.ok) return createResult;
        prepared.push({ resource, target: createResult.value, created: true });
      } else {
        prepared.push({ resource, target: existing, created: false });
      }
    }
```

Add compose helper functions mirroring the application helpers.

```ts
async function findExistingCompose(
  client: DokployClient,
  environmentId: string,
  resource: Extract<RenderedDokployResource, { kind: 'compose' }>,
  applied: readonly DeploymentApplyResource[],
): Promise<Result<DokployCompose | null, DokployDeploymentError>> {
  try {
    return ok(await client.findComposeByName(environmentId, resource.name));
  } catch (cause) {
    return partialFailure(cause, resource, applied, 'find');
  }
}

async function createComposeTarget(
  client: DokployClient,
  environmentId: string,
  resource: Extract<RenderedDokployResource, { kind: 'compose' }>,
  applied: readonly DeploymentApplyResource[],
): Promise<Result<DokployCompose, DokployDeploymentError>> {
  try {
    return ok(await client.createCompose(environmentId, resource));
  } catch (cause) {
    return partialFailure(cause, resource, applied, 'create');
  }
}

async function updateComposeTarget(
  client: DokployClient,
  composeId: string,
  resource: Extract<RenderedDokployResource, { kind: 'compose' }>,
  applied: readonly DeploymentApplyResource[],
): Promise<Result<DokployCompose, DokployDeploymentError>> {
  try {
    return ok(await client.updateCompose(composeId, resource));
  } catch (cause) {
    return partialFailure(cause, resource, applied, 'update');
  }
}

async function runComposeLifecycle(
  client: DokployClient,
  target: DeploymentApplyResource,
  resource: Extract<RenderedDokployResource, { kind: 'compose' }>,
  applied: readonly DeploymentApplyResource[],
): Promise<Result<void, DokployDeploymentError>> {
  try {
    await client.configureCompose(target.targetResourceId, resource);
  } catch (cause) {
    return partialFailure(cause, resource, applied, 'configure');
  }

  try {
    await client.deployCompose(target.targetResourceId);
  } catch (cause) {
    return partialFailure(cause, resource, applied, 'deploy');
  }

  return ok(undefined);
}
```

In the second loop, branch on `resource.kind` when updating and running lifecycle:

```ts
      } else {
        const updateResult =
          resource.kind === 'compose'
            ? await updateComposeTarget(client, item.target.id, resource, applied)
            : await updateApplicationTarget(client, item.target.id, resource, applied);
        if (!updateResult.ok) return updateResult;
        const updated = appliedResource(resource, updateResult.value, 'updated');
        const lifecycleResult =
          resource.kind === 'compose'
            ? await runComposeLifecycle(client, updated, resource, [...applied, updated])
            : await runApplicationLifecycle(client, updated, resource, [...applied, updated]);
        if (!lifecycleResult.ok) return lifecycleResult;
        applied.push(updated);
      }
```

Also branch in the created path:

```ts
        const lifecycleResult =
          resource.kind === 'compose'
            ? await runComposeLifecycle(client, created, resource, [...applied, created])
            : await runApplicationLifecycle(client, created, resource, [...applied, created]);
```

- [ ] **Step 7: Compare compose resources correctly**

Replace `resourceMatches` with this union-aware implementation.

```ts
function resourceMatches(
  existing: {
    readonly image?: string;
    readonly composeFile?: string;
    readonly build?: Extract<RenderedDokployResource, { kind: 'application' }>['build'];
    readonly ports?: Extract<RenderedDokployResource, { kind: 'application' }>['ports'];
    readonly ingress?: Extract<RenderedDokployResource, { kind: 'application' }>['ingress'];
    readonly env?: RenderedDokployResource['env'];
    readonly labels?: RenderedDokployResource['labels'];
    readonly files?: Extract<RenderedDokployResource, { kind: 'application' }>['files'];
  },
  resource: RenderedDokployResource,
): boolean {
  if (existing.image === undefined || existing.image !== resource.image) return false;
  if (existing.env === undefined || !jsonEqual(existing.env, resource.env)) return false;
  if (existing.labels === undefined || !jsonEqual(sortRecord(existing.labels), sortRecord(resource.labels))) {
    return false;
  }

  if (resource.kind === 'compose') {
    return existing.composeFile === resource.composeFile;
  }

  if (!optionalComparableMatches(existing.build, resource.build)) return false;
  if (!optionalComparableMatches(existing.ports, resource.ports)) return false;
  if (!optionalComparableMatches(existing.ingress, resource.ingress)) return false;

  if (resource.files === undefined) return existing.files === undefined;
  if (existing.files === undefined) return false;
  return jsonEqual(sortRecord(existing.files), sortRecord(resource.files));
}
```

- [ ] **Step 8: Export new deploy-dokploy types**

Export the new package surface from `packages/deploy/deploy-dokploy/src/index.ts`:

```ts
  type DokployCompose,
```

from the client export block, and:

```ts
  type RenderedDokployApplicationResource,
  type RenderedDokployComposeResource,
```

from the render export block.

- [ ] **Step 9: Run apply tests**

Run:

```bash
pnpm -F @rntme/deploy-dokploy test -- test/unit/apply.test.ts
```

Expected: PASS.

- [ ] **Step 10: Commit apply work**

Run:

```bash
git add packages/deploy/deploy-dokploy/src/client.ts packages/deploy/deploy-dokploy/src/errors.ts packages/deploy/deploy-dokploy/src/apply.ts packages/deploy/deploy-dokploy/src/index.ts packages/deploy/deploy-dokploy/test/unit/apply.test.ts
git commit -m "feat(deploy-dokploy): apply compose resources"
```

---

### Task 4: Real Dokploy Compose HTTP Client

**Files:**
- Modify: `apps/platform-http/src/deploy/dokploy-client-factory.ts`
- Test: `apps/platform-http/test/unit/deploy/dokploy-client-factory.test.ts`

- [ ] **Step 1: Write failing HTTP client tests**

In `apps/platform-http/test/unit/deploy/dokploy-client-factory.test.ts`, add a test that creates, configures, and deploys a compose resource.

```ts
  it('creates, configures, and deploys Dokploy compose resources', async () => {
    const calls: Array<{ url: string; method: string; body?: unknown }> = [];
    const cipher: SecretCipher = {
      encrypt: vi.fn(),
      decrypt: vi.fn(() => 'dokploy-token-secret'),
    };
    const client = createDokployClientFactory(cipher, async (input, init) => {
      const url = String(input);
      calls.push({
        url,
        method: init?.method ?? 'GET',
        body: init?.body === undefined ? undefined : JSON.parse(String(init.body)),
      });
      if (url.endsWith('/api/project.all')) {
        return jsonResponse([
          {
            projectId: 'project-1',
            name: 'Project',
            environments: [{ environmentId: 'env_default', name: 'default', applications: [], composes: [] }],
          },
        ]);
      }
      if (url.endsWith('/api/compose.create')) {
        return jsonResponse({ composeId: 'compose-1', name: 'rntme-acme-commerce-event-bus' });
      }
      if (url.endsWith('/api/compose.update')) return jsonResponse(true);
      if (url.endsWith('/api/compose.one?composeId=compose-1')) {
        return jsonResponse({ composeId: 'compose-1', name: 'rntme-acme-commerce-event-bus' });
      }
      if (url.endsWith('/api/compose.saveEnvironment')) return jsonResponse({});
      if (url.endsWith('/api/compose.deploy')) return jsonResponse({});
      return jsonResponse({});
    })(target());

    const created = await client.createCompose('env_default', {
      logicalId: 'event-bus',
      kind: 'compose',
      infrastructureKind: 'event-bus',
      name: 'rntme-acme-commerce-event-bus',
      image: 'docker.redpanda.com/redpandadata/redpanda:v24.3.6',
      composeFile: 'services:\n  redpanda:\n    image: docker.redpanda.com/redpandadata/redpanda:v24.3.6\n',
      env: [],
      labels: { 'rntme.infrastructure': 'event-bus' },
    });
    await client.configureCompose(created.id, {
      logicalId: 'event-bus',
      kind: 'compose',
      infrastructureKind: 'event-bus',
      name: 'rntme-acme-commerce-event-bus',
      image: 'docker.redpanda.com/redpandadata/redpanda:v24.3.6',
      composeFile: 'services:\n  redpanda:\n    image: docker.redpanda.com/redpandadata/redpanda:v24.3.6\n',
      env: [],
      labels: { 'rntme.infrastructure': 'event-bus' },
    });
    await client.deployCompose(created.id);

    expect(calls.map((call) => call.url)).toContain('https://dokploy.example.com/api/compose.create');
    expect(calls.map((call) => call.url)).toContain('https://dokploy.example.com/api/compose.update');
    expect(calls.map((call) => call.url)).toContain('https://dokploy.example.com/api/compose.deploy');
    expect(calls.find((call) => call.url.endsWith('/api/compose.create'))?.body).toMatchObject({
      environmentId: 'env_default',
      name: 'rntme-acme-commerce-event-bus',
      composeType: 'docker-compose',
      composeFile: expect.stringContaining('redpanda'),
    });
  });
```

- [ ] **Step 2: Run HTTP client test and verify failure**

Run:

```bash
pnpm -F @rntme/platform-http test -- test/unit/deploy/dokploy-client-factory.test.ts
```

Expected: FAIL because the factory does not implement compose methods.

- [ ] **Step 3: Add Dokploy API compose types**

In `apps/platform-http/src/deploy/dokploy-client-factory.ts`, update imports to include `DokployCompose`.

```ts
import type {
  DokployApplication,
  DokployClient,
  DokployCompose,
  DokployProjectRef,
  RenderedDokployResource,
} from '@rntme/deploy-dokploy';
```

Add these API types near the application API types.

```ts
type DokployApiComposeSummary = {
  composeId: string;
  name: string;
};

type DokployApiCompose = DokployApiComposeSummary & {
  appName?: string;
  composeFile?: string;
  env?: string;
};
```

Extend `DokployApiEnvironment`:

```ts
  composes?: readonly DokployApiComposeSummary[];
```

- [ ] **Step 4: Implement compose methods in the factory**

Add these methods to the object returned by `createDokployClientFactory`.

```ts
      findComposeByName: async (environmentId: string, name: string) => {
        return findComposeByName(request, environmentId, name);
      },
      createCompose: async (environmentId: string, resource: Extract<RenderedDokployResource, { kind: 'compose' }>) => {
        const compose = await request<DokployApiCompose>('POST', '/api/compose.create', {
          environmentId,
          name: resource.name,
          appName: resource.name.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 63),
          description: 'Managed by rntme-cli',
          composeType: 'docker-compose',
          composeFile: resource.composeFile,
        });
        if (compose.composeId === undefined || compose.composeId === '') {
          const created = await findComposeByName(request, environmentId, resource.name);
          if (created === null) throw new Error(`Dokploy compose ${resource.name} not found after create`);
          return created;
        }
        return toDokployCompose(compose, resource);
      },
      updateCompose: async (composeId: string, resource: Extract<RenderedDokployResource, { kind: 'compose' }>) => {
        const compose = await request<DokployApiCompose | boolean>('POST', '/api/compose.update', {
          composeId,
          name: resource.name,
          appName: resource.name.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 63),
          description: 'Managed by rntme-cli',
          sourceType: 'raw',
          composeType: 'docker-compose',
          composeFile: resource.composeFile,
        });
        if (typeof compose !== 'object' || compose === null || compose.composeId === undefined || compose.composeId === '') {
          const updated = await request<DokployApiCompose>('GET', '/api/compose.one', { composeId });
          return toDokployCompose(updated, resource);
        }
        return toDokployCompose(compose, resource);
      },
      configureCompose: async (composeId: string, resource: Extract<RenderedDokployResource, { kind: 'compose' }>) => {
        await request('POST', '/api/compose.update', {
          composeId,
          name: resource.name,
          appName: resource.name.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 63),
          description: 'Managed by rntme-cli',
          sourceType: 'raw',
          composeType: 'docker-compose',
          composeFile: resource.composeFile,
        });
        await request('POST', '/api/compose.saveEnvironment', {
          composeId,
          env: envBlock(resource),
        });
      },
      deployCompose: async (composeId: string) => {
        await request('POST', '/api/compose.deploy', { composeId });
      },
```

Add helper functions near `findApplicationByName`.

```ts
async function findComposeByName(
  request: <T>(method: 'GET' | 'POST', path: string, body?: unknown) => Promise<T>,
  environmentId: string,
  name: string,
): Promise<DokployCompose | null> {
  const projects = await request<DokployApiProject[]>('GET', '/api/project.all');
  for (const p of projects) {
    for (const e of p.environments || []) {
      if (e.environmentId === environmentId) {
        const compose = e.composes?.find((c) => c.name === name);
        if (compose) {
          const details = await request<DokployApiCompose>('GET', '/api/compose.one', { composeId: compose.composeId });
          return toDokployCompose(details);
        }
        return null;
      }
    }
  }
  return null;
}

function toDokployCompose(
  details: DokployApiCompose,
  rendered?: Extract<RenderedDokployResource, { kind: 'compose' }>,
): DokployCompose {
  return {
    id: details.composeId,
    name: details.name,
    ...(details.appName ? { appName: details.appName } : {}),
    ...(details.composeFile ? { composeFile: details.composeFile } : {}),
    ...(rendered === undefined ? {} : { image: rendered.image, labels: rendered.labels }),
    env: parseEnvBlock(details.env),
  };
}
```

- [ ] **Step 5: Run HTTP client tests**

Run:

```bash
pnpm -F @rntme/platform-http test -- test/unit/deploy/dokploy-client-factory.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit HTTP client work**

Run:

```bash
git add apps/platform-http/src/deploy/dokploy-client-factory.ts apps/platform-http/test/unit/deploy/dokploy-client-factory.test.ts
git commit -m "feat(platform-http): call Dokploy compose API"
```

---

### Task 5: Platform Event Bus Schema And Config Plumbing

**Files:**
- Modify: `packages/platform/platform-core/src/schemas/deploy-target.ts`
- Modify: `packages/platform/platform-core/test/unit/use-cases/deploy-targets.test.ts`
- Modify: `apps/platform-http/src/deploy/build-deploy-config.ts`
- Modify: `apps/platform-http/test/unit/deploy/build-deploy-config.test.ts`
- Modify: `apps/platform-http/src/ui/pages/deploy-targets.tsx`
- Modify: `apps/platform-http/test/unit/ui/pages.test.tsx`

- [ ] **Step 1: Write platform schema tests**

In `packages/platform/platform-core/test/unit/use-cases/deploy-targets.test.ts`, add an assertion to the existing create/update tests or add this standalone test.

```ts
  it('accepts provisioned Redpanda deploy target event bus config', async () => {
    const { deps, repo } = setup();
    const parsed = CreateDeployTargetRequestSchema.parse({
      slug: 'dokploy-redpanda',
      displayName: 'Dokploy Redpanda',
      kind: 'dokploy',
      dokployUrl: 'https://dok.example.test',
      dokployProjectId: 'project-1',
      apiToken: 'dokploy-token',
      eventBus: {
        kind: 'kafka',
        mode: 'provisioned',
        provider: 'redpanda',
        topicPrefix: 'rntme.notes',
      },
      modules: {},
      auth: {},
      policyValues: {},
      isDefault: false,
    });

    const result = await createDeployTarget(deps, {
      orgId: '11111111-1111-4111-8111-111111111111',
      accountId: '22222222-2222-4222-8222-222222222222',
      tokenId: null,
      req: parsed,
    });

    expect(result.ok).toBe(true);
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        row: expect.objectContaining({
          eventBusConfig: {
            kind: 'kafka',
            mode: 'provisioned',
            provider: 'redpanda',
            topicPrefix: 'rntme.notes',
          },
        }),
      }),
    );
  });
```

At the top of `packages/platform/platform-core/test/unit/use-cases/deploy-targets.test.ts`, extend the existing schema import:

```ts
import {
  CreateDeployTargetRequestSchema,
  UpdateDeployTargetRequestSchema,
} from '../../../src/schemas/deploy-target.js';
```

- [ ] **Step 2: Write platform-http config pass-through test**

In `apps/platform-http/test/unit/deploy/build-deploy-config.test.ts`, add this test inside `describe('buildProjectDeploymentConfig',`.

Update the existing `maps target event bus and preview/default constants` assertion so it expects normalized external mode:

```ts
    expect(config).toMatchObject({
      orgSlug: 'acme',
      environment: 'default',
      mode: 'preview',
      eventBus: {
        kind: 'kafka',
        mode: 'external',
        brokers: ['redpanda:9092'],
      },
    });
```

```ts
  it('passes provisioned Redpanda event bus config through to deploy-core', () => {
    const provisionedTarget = {
      ...target(),
      eventBus: {
        kind: 'kafka' as const,
        mode: 'provisioned' as const,
        provider: 'redpanda' as const,
        topicPrefix: 'rntme.notes',
      },
    };

    const config = buildProjectDeploymentConfig(provisionedTarget, 'acme', {});

    expect(config.eventBus).toEqual({
      kind: 'kafka',
      mode: 'provisioned',
      provider: 'redpanda',
      topicPrefix: 'rntme.notes',
    });
  });
```

- [ ] **Step 3: Write UI display test**

In `apps/platform-http/test/unit/ui/pages.test.tsx`, add this test in `describe('DeployTargetsPage',`.

```ts
  it('shows provisioned Redpanda event bus mode', () => {
    const html = String(
      <DeployTargetsPage
        subject={subject()}
        otherOrgs={[]}
        publicDeployDomain="*.rntme.com"
        targets={[
          {
            id: 'target-1',
            orgId: 'org-1',
            slug: 'dokploy-redpanda',
            displayName: 'Dokploy Redpanda',
            kind: 'dokploy',
            dokployUrl: 'https://dokploy.example.test',
            publicBaseUrl: null,
            dokployProjectId: 'project-1',
            dokployProjectName: null,
            allowCreateProject: false,
            apiTokenRedacted: '***',
            eventBus: { kind: 'kafka', mode: 'provisioned', provider: 'redpanda' },
            modules: {},
            auth: {},
            policyValues: {},
            isDefault: false,
            createdAt: new Date('2026-01-01T00:00:00Z'),
            updatedAt: new Date('2026-01-01T00:00:00Z'),
          },
        ]}
      />,
    );

    expect(html).toContain('Provisioned Redpanda');
  });
```

- [ ] **Step 4: Run platform tests and verify failure**

Run:

```bash
pnpm -F @rntme/platform-core test -- test/unit/use-cases/deploy-targets.test.ts
pnpm -F @rntme/platform-http test -- test/unit/deploy/build-deploy-config.test.ts test/unit/ui/pages.test.tsx
```

Expected: FAIL because schemas and UI do not know `mode: "provisioned"`.

- [ ] **Step 5: Update platform-core event bus schema**

In `packages/platform/platform-core/src/schemas/deploy-target.ts`, replace `EventBusConfigSchema` with this preprocess-plus-union schema.

```ts
const ExternalEventBusConfigSchema = z.object({
  kind: z.literal('kafka'),
  mode: z.literal('external').optional(),
  brokers: z.array(z.string().min(1)).min(1),
  topicPrefix: z.string().optional(),
  security: KafkaSecuritySchema,
});

const ProvisionedEventBusConfigSchema = z.object({
  kind: z.literal('kafka'),
  mode: z.literal('provisioned'),
  provider: z.literal('redpanda'),
  image: z.string().min(1).optional(),
  topicPrefix: z.string().optional(),
});

export const EventBusConfigSchema = z.preprocess((value) => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const candidate = value as Record<string, unknown>;
    if (candidate.mode === undefined) return { ...candidate, mode: 'external' };
  }
  return value;
}, z.discriminatedUnion('mode', [ExternalEventBusConfigSchema, ProvisionedEventBusConfigSchema]));
export type EventBusConfig = z.infer<typeof EventBusConfigSchema>;
```

- [ ] **Step 6: Simplify buildProjectDeploymentConfig event bus pass-through**

In `apps/platform-http/src/deploy/build-deploy-config.ts`, replace the current `const eventBus =` object construction block with:

```ts
  const eventBus =
    target.eventBus.mode === 'provisioned'
      ? {
          kind: target.eventBus.kind,
          mode: 'provisioned' as const,
          provider: target.eventBus.provider,
          ...(target.eventBus.image === undefined ? {} : { image: target.eventBus.image }),
          ...(target.eventBus.topicPrefix === undefined ? {} : { topicPrefix: target.eventBus.topicPrefix }),
        }
      : {
          kind: target.eventBus.kind,
          mode: 'external' as const,
          brokers: target.eventBus.brokers,
          ...(target.eventBus.topicPrefix === undefined ? {} : { topicPrefix: target.eventBus.topicPrefix }),
          ...(target.eventBus.security === undefined ? {} : { security: target.eventBus.security }),
        };
```

- [ ] **Step 7: Render event bus mode in deploy target UI**

In `apps/platform-http/src/ui/pages/deploy-targets.tsx`, change table headers to include `Event bus`.

```tsx
        headers={['Slug', 'Kind', 'Event bus', 'Public URL', 'Default']}
```

Add `displayEventBus(target)` as the third cell.

```tsx
            displayEventBus(target),
```

In the detail page `<dl>`, add this row after `Kind`.

```tsx
        <div><dt class="font-medium">Event bus</dt><dd>{displayEventBus(target)}</dd></div>
```

Add this helper near `displayPublicUrl`.

```ts
function displayEventBus(target: DeployTarget): string {
  if (target.eventBus.mode === 'provisioned') return 'Provisioned Redpanda';
  return 'External Kafka/Redpanda';
}
```

- [ ] **Step 8: Run platform tests**

Run:

```bash
pnpm -F @rntme/platform-core test -- test/unit/use-cases/deploy-targets.test.ts
pnpm -F @rntme/platform-http test -- test/unit/deploy/build-deploy-config.test.ts test/unit/ui/pages.test.tsx
```

Expected: PASS.

- [ ] **Step 9: Commit platform plumbing**

Run:

```bash
git add packages/platform/platform-core/src/schemas/deploy-target.ts packages/platform/platform-core/test/unit/use-cases/deploy-targets.test.ts apps/platform-http/src/deploy/build-deploy-config.ts apps/platform-http/test/unit/deploy/build-deploy-config.test.ts apps/platform-http/src/ui/pages/deploy-targets.tsx apps/platform-http/test/unit/ui/pages.test.tsx
git commit -m "feat(platform): accept provisioned event bus targets"
```

---

### Task 6: Executor Logs, Docs, And Verification

**Files:**
- Modify: `apps/platform-http/src/deploy/executor.ts`
- Modify: `apps/platform-http/test/unit/deploy/executor.test.ts`
- Modify: `packages/deploy/deploy-core/README.md`
- Modify: `packages/deploy/deploy-dokploy/README.md`
- Modify: `apps/platform-http/README.md`
- Modify: `AGENTS.md` only if §6.14 external-only language remains stale after README updates

- [ ] **Step 1: Write executor log test**

In `apps/platform-http/test/unit/deploy/executor.test.ts`, add a test beside the existing executor success tests.

```ts
  it('logs provisioned Redpanda event bus provisioning before apply', async () => {
    const { deps, deployments } = setup({
      planProject: vi.fn(() =>
        ok({
          project: { orgSlug: 'acme', projectSlug: 'shop', environment: 'default' as const, mode: 'preview' as const },
          infrastructure: {
            eventBus: {
              kind: 'kafka' as const,
              mode: 'provisioned' as const,
              provider: 'redpanda' as const,
              resourceName: 'rntme-acme-shop-event-bus',
              internalBrokers: ['rntme-acme-shop-event-bus:9092'],
              image: 'docker.redpanda.com/redpandadata/redpanda:v24.3.6',
              persistence: { mode: 'persistent' as const, volumeName: 'rntme-acme-shop-event-bus-data' },
            },
          },
          workloads: [],
          edge: { routes: [], middleware: [] },
          diagnostics: { warnings: [] },
        }),
      ) as never,
    });

    await runDeployment('deployment-1', 'org-1', deps);

    expect(deployments.appendLog).toHaveBeenCalledWith(
      expect.objectContaining({
        step: 'plan',
        message: 'Provisioning Redpanda event bus',
      }),
    );
  });
```

- [ ] **Step 2: Run executor test and verify failure**

Run:

```bash
pnpm -F @rntme/platform-http test -- test/unit/deploy/executor.test.ts
```

Expected: FAIL because executor does not emit the provisioned event bus log line.

- [ ] **Step 3: Add executor event bus log**

In `apps/platform-http/src/deploy/executor.ts`, after a successful `planProject` result and before rendering, add:

```ts
    await appendLog(
      deps,
      deploymentId,
      orgId,
      'info',
      'plan',
      plan.value.infrastructure.eventBus.mode === 'provisioned'
        ? 'Provisioning Redpanda event bus'
        : 'Using external Kafka/Redpanda event bus',
    );
```

- [ ] **Step 4: Update deploy-core README**

In `packages/deploy/deploy-core/README.md`, replace the "Auth and SASL" section heading with `Event bus modes, auth, and SASL`, and use this content.

```md
## Event bus modes, auth, and SASL

`ProjectDeploymentConfig.eventBus` supports two Kafka-compatible modes:

- `{ kind: "kafka", mode: "external", brokers, security? }` for an already provisioned Kafka/Redpanda endpoint. Omitted `mode` is normalized to `"external"` for backward compatibility.
- `{ kind: "kafka", mode: "provisioned", provider: "redpanda", image?, topicPrefix? }` for a target-local provisioned bus. The first implementation is Redpanda on Dokploy. The planner derives the internal broker address and persistent volume identity.

`ExternalEventBusConfig.security` is a discriminated union:

- `{ protocol: "plaintext" }` for unauthenticated Kafka-compatible endpoints.
- `{ protocol: "sasl_ssl", mechanism, secretRefs }` for managed Redpanda/Kafka.
  `mechanism` must be `scram-sha-256` or `scram-sha-512`; `secretRefs.username`
  and `secretRefs.password` are required and are secret names, not secret values.

Provisioned Redpanda is internal-only plaintext in this design. Cleanup/deprovisioning is a separate future workflow.
```

- [ ] **Step 5: Update deploy-dokploy README**

In `packages/deploy/deploy-dokploy/README.md`, add this section after the package public API list.

```md
## Provisioned Redpanda

When `plan.infrastructure.eventBus.mode === "provisioned"` and
`provider === "redpanda"`, render adds a Dokploy Compose resource before the
application resources. The compose file starts a single internal Redpanda
broker on port `9092`, uses a deterministic persistent named volume, and does
not expose a public domain or external broker port.

Domain-service workloads receive:

- `RNTME_EVENT_BUS_BROKERS=<provisioned-resource>:9092`
- `RNTME_EVENT_BUS_PROTOCOL=plaintext`
- optional `RNTME_EVENT_BUS_TOPIC_PREFIX`

Apply creates or updates compose resources before applications. It does not
wait for Kafka protocol readiness; runtime bus clients must tolerate broker
warm-up.
```

- [ ] **Step 6: Update platform-http README**

In `apps/platform-http/README.md`, add this paragraph under "Deploy runtime".

```md
Deploy targets may point at an external Kafka/Redpanda bus or request a
provisioned Redpanda bus. Provisioned Redpanda is rendered by
`@rntme/deploy-dokploy` as an internal Dokploy Compose resource with a
persistent named volume. It is explicit per deploy target; missing `eventBus`
config remains invalid.
```

- [ ] **Step 7: Update AGENTS only if needed**

Search:

```bash
rg -n "Redpanda Cloud|external Redpanda|event bus|Deploy a project via Dokploy" AGENTS.md README.md
```

If `AGENTS.md` §6.14 still states or implies that only external Redpanda is valid, update the deploy steps to say:

```md
2. From a validated/composed project model, call `planDeployment(validatedProject, config)`; it returns a target-neutral, redacted plan. The deploy target `eventBus` can be external Kafka/Redpanda or explicit provisioned Redpanda where the target adapter supports it.
```

If `README.md` only says "Kafka-style relay" and does not describe deploy target event bus modes, leave it unchanged.

- [ ] **Step 8: Run focused tests**

Run:

```bash
pnpm -F @rntme/deploy-core test -- test/unit/plan.test.ts
pnpm -F @rntme/deploy-dokploy test -- test/unit/render.test.ts test/unit/apply.test.ts
pnpm -F @rntme/platform-core test -- test/unit/use-cases/deploy-targets.test.ts
pnpm -F @rntme/platform-http test -- test/unit/deploy/build-deploy-config.test.ts test/unit/deploy/dokploy-client-factory.test.ts test/unit/deploy/executor.test.ts test/unit/ui/pages.test.tsx
```

Expected: all commands PASS.

- [ ] **Step 9: Run package typechecks**

Run:

```bash
pnpm -F @rntme/deploy-core typecheck
pnpm -F @rntme/deploy-dokploy typecheck
pnpm -F @rntme/platform-core typecheck
pnpm -F @rntme/platform-http typecheck
```

Expected: all commands PASS.

- [ ] **Step 10: Commit docs and verification cleanup**

Run:

```bash
git add apps/platform-http/src/deploy/executor.ts apps/platform-http/test/unit/deploy/executor.test.ts packages/deploy/deploy-core/README.md packages/deploy/deploy-dokploy/README.md apps/platform-http/README.md AGENTS.md
git commit -m "docs: document provisioned event bus deployment"
```

If `AGENTS.md` was not changed, omit it from the `git add` command.

---

## Final Verification

- [ ] Run the focused test suite:

```bash
pnpm -F @rntme/deploy-core test -- test/unit/plan.test.ts
pnpm -F @rntme/deploy-dokploy test -- test/unit/render.test.ts test/unit/apply.test.ts
pnpm -F @rntme/platform-core test -- test/unit/use-cases/deploy-targets.test.ts
pnpm -F @rntme/platform-http test -- test/unit/deploy/build-deploy-config.test.ts test/unit/deploy/dokploy-client-factory.test.ts test/unit/deploy/executor.test.ts test/unit/ui/pages.test.tsx
```

- [ ] Run package typechecks:

```bash
pnpm -F @rntme/deploy-core typecheck
pnpm -F @rntme/deploy-dokploy typecheck
pnpm -F @rntme/platform-core typecheck
pnpm -F @rntme/platform-http typecheck
```

- [ ] Run lint on touched packages:

```bash
pnpm -F @rntme/deploy-core lint
pnpm -F @rntme/deploy-dokploy lint
pnpm -F @rntme/platform-core lint
pnpm -F @rntme/platform-http lint
```

- [ ] Confirm the worktree only contains intended files:

```bash
git status --short
```

Expected: only files changed by this plan are present, plus any unrelated user-owned files that existed before execution.
