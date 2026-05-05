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
      serviceSlug: 'bpmn-worker',
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
});
