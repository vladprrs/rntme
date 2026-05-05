import type { ValidatedWorkflows } from '@rntme/workflows';
import { describe, expect, it } from 'vitest';
import { buildProjectDeploymentPlan, type ComposedProjectInput } from '../../src/index.js';

const workflows = {
  workflowVersion: 1,
  definitions: [
    {
      id: 'orderFulfillment',
      bpmnFile: 'order-fulfillment.bpmn',
      processId: 'orderFulfillment',
    },
  ],
  messageStarts: [
    {
      id: 'orderPlaced',
      definition: 'orderFulfillment',
      messageName: 'OrderPlaced',
      event: { service: 'orders', aggregateType: 'Order', eventType: 'OrderPlaced' },
      businessKey: '$event.data.orderId',
    },
  ],
  serviceTasks: [
    { definition: 'orderFulfillment', taskId: 'reserveStock', bindingRef: 'inventory.reserveStock' },
    { definition: 'orderFulfillment', taskId: 'confirmOrder', bindingRef: 'orders.confirmOrder' },
  ],
} as unknown as ValidatedWorkflows;

const mixedCaseWorkflows = {
  ...workflows,
  messageStarts: [
    {
      id: 'orderPlaced',
      definition: 'orderFulfillment',
      messageName: 'OrderPlaced',
      event: { service: 'Orders', aggregateType: 'PurchaseOrder', eventType: 'OrderPlaced' },
      businessKey: '$event.data.orderId',
    },
  ],
} as unknown as ValidatedWorkflows;

const project: ComposedProjectInput = {
  name: 'order-fulfillment',
  services: {
    orders: {
      slug: 'orders',
      kind: 'domain',
      runtimeFiles: {
        'manifest.json': '{}',
        'pdm.json': '{}',
        'qsm.json': '{}',
        'bindings.json': '{}',
      },
    },
    inventory: {
      slug: 'inventory',
      kind: 'domain',
      runtimeFiles: {
        'manifest.json': '{}',
        'pdm.json': '{}',
        'qsm.json': '{}',
        'bindings.json': '{}',
      },
    },
  },
  workflows,
};

describe('workflow planning', () => {
  it('plans provisioned Operaton and a BPMN worker when workflows are present', () => {
    const result = buildProjectDeploymentPlan(project, {
      orgSlug: 'acme',
      environment: 'default',
      mode: 'preview',
      runtimeImage: 'ghcr.io/acme/runtime:v1',
      eventBus: {
        kind: 'kafka',
        mode: 'provisioned',
        provider: 'redpanda',
        topicPrefix: 'rntme.orders',
      },
      workflows: {
        engine: { kind: 'operaton', mode: 'provisioned', image: 'operaton/operaton:test' },
        worker: { image: 'ghcr.io/acme/bpmn-worker:v1' },
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.infrastructure.workflowEngine).toEqual({
      kind: 'operaton',
      mode: 'provisioned',
      resourceName: 'rntme-acme-order-fulfillment-operaton',
      internalBaseUrl: 'http://rntme-acme-order-fulfillment-operaton:8080',
      image: 'operaton/operaton:test',
    });
    expect(result.value.workloads.map((workload) => workload.slug)).toEqual([
      'orders',
      'inventory',
      'edge',
      'bpmn-worker',
    ]);
    expect(result.value.workloads.find((workload) => workload.kind === 'bpmn-worker')).toEqual({
      kind: 'bpmn-worker',
      slug: 'bpmn-worker',
      resourceName: 'rntme-acme-order-fulfillment-bpmn-worker',
      image: 'ghcr.io/acme/bpmn-worker:v1',
      workflowManifestPath: '/srv/workflows/workflows.json',
      workflowFiles: {},
      subscriptions: [
        {
          messageStartId: 'orderPlaced',
          topic: 'rntme.orders.orders.order',
          service: 'orders',
          aggregateType: 'Order',
          eventType: 'OrderPlaced',
          processId: 'orderFulfillment',
          messageName: 'OrderPlaced',
          businessKey: '$event.data.orderId',
        },
      ],
      serviceTasks: [
        {
          definition: 'orderFulfillment',
          taskId: 'reserveStock',
          bindingRef: 'inventory.reserveStock',
          targetService: 'inventory',
        },
        {
          definition: 'orderFulfillment',
          taskId: 'confirmOrder',
          bindingRef: 'orders.confirmOrder',
          targetService: 'orders',
        },
      ],
    });
  });

  it('rejects workflows without a provisioned Kafka bus', () => {
    const result = buildProjectDeploymentPlan(project, {
      orgSlug: 'acme',
      environment: 'default',
      mode: 'preview',
      runtimeImage: 'ghcr.io/acme/runtime:v1',
      eventBus: { kind: 'memory', mode: 'in-memory' },
      workflows: {
        engine: { kind: 'operaton', mode: 'provisioned', image: 'operaton/operaton:test' },
        worker: { image: 'ghcr.io/acme/bpmn-worker:v1' },
      },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'DEPLOY_PLAN_WORKFLOWS_REQUIRE_EVENT_BUS',
          path: 'eventBus',
        }),
      );
    }
  });

  it('does not plan workflow infrastructure for projects without workflows', () => {
    const result = buildProjectDeploymentPlan(
      { ...project, workflows: null },
      {
        orgSlug: 'acme',
        environment: 'default',
        mode: 'preview',
        runtimeImage: 'ghcr.io/acme/runtime:v1',
        eventBus: { kind: 'kafka', mode: 'provisioned', provider: 'redpanda' },
      },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.infrastructure.workflowEngine).toEqual({ kind: 'none' });
    expect(result.value.workloads.some((workload) => workload.kind === 'bpmn-worker')).toBe(false);
  });

  it('rejects blank workflow worker images', () => {
    const result = buildProjectDeploymentPlan(project, {
      orgSlug: 'acme',
      environment: 'default',
      mode: 'preview',
      runtimeImage: 'ghcr.io/acme/runtime:v1',
      eventBus: { kind: 'kafka', mode: 'provisioned', provider: 'redpanda' },
      workflows: {
        engine: { kind: 'operaton', mode: 'provisioned', image: 'operaton/operaton:test' },
        worker: { image: '   ' },
      },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'DEPLOY_PLAN_WORKFLOWS_WORKER_IMAGE_MISSING',
          path: 'workflows.worker.image',
        }),
      );
    }
  });

  it('treats empty workflow topic prefixes as absent', () => {
    for (const topicPrefix of ['', '   ', '...']) {
      const result = buildProjectDeploymentPlan(
        { ...project, workflows: mixedCaseWorkflows },
        {
          orgSlug: 'acme',
          environment: 'default',
          mode: 'preview',
          runtimeImage: 'ghcr.io/acme/runtime:v1',
          eventBus: { kind: 'kafka', mode: 'provisioned', provider: 'redpanda', topicPrefix },
          workflows: {
            engine: { kind: 'operaton', mode: 'provisioned', image: 'operaton/operaton:test' },
            worker: { image: 'ghcr.io/acme/bpmn-worker:v1' },
          },
        },
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const worker = result.value.workloads.find((workload) => workload.kind === 'bpmn-worker');
      expect(worker?.subscriptions[0]?.topic).toBe('rntme.orders.purchaseorder');
    }
  });

  it('trims dotted workflow topic prefixes and lowercases service and aggregate segments', () => {
    const result = buildProjectDeploymentPlan(
      { ...project, workflows: mixedCaseWorkflows },
      {
        orgSlug: 'acme',
        environment: 'default',
        mode: 'preview',
        runtimeImage: 'ghcr.io/acme/runtime:v1',
        eventBus: {
          kind: 'kafka',
          mode: 'provisioned',
          provider: 'redpanda',
          topicPrefix: '  .RNTME.Custom.  ',
        },
        workflows: {
          engine: { kind: 'operaton', mode: 'provisioned', image: 'operaton/operaton:test' },
          worker: { image: 'ghcr.io/acme/bpmn-worker:v1' },
        },
      },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const worker = result.value.workloads.find((workload) => workload.kind === 'bpmn-worker');
    expect(worker?.subscriptions[0]?.topic).toBe('RNTME.Custom.orders.purchaseorder');
  });

  it('rejects blank Operaton engine images', () => {
    const result = buildProjectDeploymentPlan(project, {
      orgSlug: 'acme',
      environment: 'default',
      mode: 'preview',
      runtimeImage: 'ghcr.io/acme/runtime:v1',
      eventBus: { kind: 'kafka', mode: 'provisioned', provider: 'redpanda' },
      workflows: {
        engine: { kind: 'operaton', mode: 'provisioned', image: '  ' },
        worker: { image: 'ghcr.io/acme/bpmn-worker:v1' },
      },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'DEPLOY_PLAN_WORKFLOWS_REQUIRE_OPERATON',
          path: 'workflows.engine.image',
        }),
      );
    }
  });

  it('rejects unsupported workflow engine modes from malformed runtime config', () => {
    const result = buildProjectDeploymentPlan(project, {
      orgSlug: 'acme',
      environment: 'default',
      mode: 'preview',
      runtimeImage: 'ghcr.io/acme/runtime:v1',
      eventBus: { kind: 'kafka', mode: 'provisioned', provider: 'redpanda' },
      workflows: {
        engine: { kind: 'operaton', mode: 'external', image: 'operaton/operaton:test' },
        worker: { image: 'ghcr.io/acme/bpmn-worker:v1' },
      },
    } as unknown as Parameters<typeof buildProjectDeploymentPlan>[1]);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'DEPLOY_PLAN_WORKFLOWS_UNSUPPORTED_ENGINE',
          path: 'workflows.engine',
        }),
      );
    }
  });

  it('rejects missing workflow worker config from malformed runtime config', () => {
    const result = buildProjectDeploymentPlan(project, {
      orgSlug: 'acme',
      environment: 'default',
      mode: 'preview',
      runtimeImage: 'ghcr.io/acme/runtime:v1',
      eventBus: { kind: 'kafka', mode: 'provisioned', provider: 'redpanda' },
      workflows: {
        engine: { kind: 'operaton', mode: 'provisioned', image: 'operaton/operaton:test' },
      },
    } as unknown as Parameters<typeof buildProjectDeploymentPlan>[1]);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'DEPLOY_PLAN_WORKFLOWS_WORKER_IMAGE_MISSING',
          path: 'workflows.worker.image',
        }),
      );
    }
  });

  it('rejects malformed workflow worker images from runtime config', () => {
    const result = buildProjectDeploymentPlan(project, {
      orgSlug: 'acme',
      environment: 'default',
      mode: 'preview',
      runtimeImage: 'ghcr.io/acme/runtime:v1',
      eventBus: { kind: 'kafka', mode: 'provisioned', provider: 'redpanda' },
      workflows: {
        engine: { kind: 'operaton', mode: 'provisioned', image: 'operaton/operaton:test' },
        worker: { image: 42 },
      },
    } as unknown as Parameters<typeof buildProjectDeploymentPlan>[1]);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'DEPLOY_PLAN_WORKFLOWS_WORKER_IMAGE_MISSING',
          path: 'workflows.worker.image',
        }),
      );
    }
  });

  it('does not make the BPMN worker route-addressable', () => {
    const result = buildProjectDeploymentPlan(
      {
        ...project,
        routes: {
          http: { '/worker': 'bpmn-worker' },
        },
      },
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
          code: 'DEPLOY_PLAN_ROUTE_TARGET_MISSING_WORKLOAD',
          service: 'bpmn-worker',
          route: '/worker',
        }),
      );
    }
  });
});
