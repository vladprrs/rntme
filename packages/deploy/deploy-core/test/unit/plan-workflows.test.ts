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
  workflowFiles: {
    'order-fulfillment.bpmn': '<definitions />',
  },
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

describe('workflow planning', () => {
  it('plans provisioned Operaton and a BPMN worker when workflows are present', () => {
    const result = buildProjectDeploymentPlan(
      {
        ...project,
        workflowFiles: {
          'workflows.json': '{"workflowVersion":1}',
          'order-fulfillment.bpmn': '<definitions />',
        },
      },
      {
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
      },
    );

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
      workflowFiles: {
        'workflows.json': expect.stringContaining('"workflowVersion": 1'),
        'order-fulfillment.bpmn': '<definitions />',
      },
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
          grpcEndpoint: 'rntme-acme-order-fulfillment-inventory:50051',
        },
        {
          definition: 'orderFulfillment',
          taskId: 'confirmOrder',
          bindingRef: 'orders.confirmOrder',
          targetService: 'orders',
          grpcEndpoint: 'rntme-acme-order-fulfillment-orders:50051',
        },
      ],
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
    });
  });

  it('rejects workflow service tasks when proto config is missing for the target service', () => {
    const result = buildProjectDeploymentPlan(
      {
        ...project,
        workflowGrpcServices: {
          orders: project.workflowGrpcServices!.orders!,
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
          code: 'DEPLOY_PLAN_WORKFLOWS_BINDING_GRPC_PROTO_UNAVAILABLE',
          path: 'workflows.serviceTasks.0.bindingRef',
          service: 'inventory',
        }),
      );
    }
  });

  it.each([
    {
      name: 'missing service',
      services: {
        orders: project.services.orders,
      },
      service: 'inventory',
    },
    {
      name: 'non-domain service',
      services: {
        ...project.services,
        inventory: { slug: 'inventory', kind: 'integration' },
      },
      service: 'inventory',
    },
  ] satisfies Array<{
    name: string;
    services: ComposedProjectInput['services'];
    service: string;
  }>)(
    'rejects workflow service task bindings when the target service has no gRPC endpoint: $name',
    ({ services, service }) => {
      const result = buildProjectDeploymentPlan(
        { ...project, services },
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
            code: 'DEPLOY_PLAN_WORKFLOWS_BINDING_GRPC_UNAVAILABLE',
            path: 'workflows.serviceTasks.0.bindingRef',
            service,
          }),
        );
      }
    },
  );

  it('serializes the validated workflow manifest and BPMN files into worker mounts', () => {
    const result = buildProjectDeploymentPlan(
      {
        ...project,
        workflowFiles: {
          'order-fulfillment.bpmn': '<definitions id="orderFulfillment" />',
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

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const worker = result.value.workloads.find((workload) => workload.kind === 'bpmn-worker');
    expect(worker?.workflowFiles['workflows.json']).toContain('"workflowVersion": 1');
    expect(worker?.workflowFiles['order-fulfillment.bpmn']).toBe('<definitions id="orderFulfillment" />');
  });

  it('rejects workflow projects when a referenced BPMN file was not provided', () => {
    const result = buildProjectDeploymentPlan(
      {
        ...project,
        workflowFiles: { 'workflows.json': '{"workflowVersion":1}' },
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
          code: 'DEPLOY_PLAN_WORKFLOW_FILE_MISSING',
          path: 'workflows.definitions.0.bpmnFile',
        }),
      );
    }
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
          cause: [
            expect.objectContaining({
              code: 'DEPLOY_PLAN_WORKFLOWS_REQUIRE_OPERATON_HINT',
              message: expect.stringContaining('rntme target set-config'),
            }),
          ],
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

  it('populates uiAccess and requiredTargetSecrets when operatonUi is configured', () => {
    const result = buildProjectDeploymentPlan(
      {
        ...project,
        workflowFiles: {
          'workflows.json': '{"workflowVersion":1}',
          'order-fulfillment.bpmn': '<definitions />',
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
          operatonUi: {
            enabled: true,
            publicBaseUrl: 'https://operaton.acme.example.test',
            auth: { kind: 'basic', secretRef: 'operaton-ui-basic-auth-v1' },
          },
        },
      },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.infrastructure.workflowEngine).toMatchObject({
      uiAccess: {
        enabled: true,
        publicBaseUrl: 'https://operaton.acme.example.test',
        authKind: 'basic',
        authSecretRef: 'operaton-ui-basic-auth-v1',
      },
    });
    expect(result.value.requiredTargetSecrets).toContainEqual({
      kind: 'target-secret',
      secretRef: 'operaton-ui-basic-auth-v1',
      purpose: 'Operaton UI Basic Auth htpasswd',
    });
  });

  it('populates adminUserSecretRef on the planned engine when configured', () => {
    const result = buildProjectDeploymentPlan(
      {
        ...project,
        workflowFiles: {
          'workflows.json': '{"workflowVersion":1}',
          'order-fulfillment.bpmn': '<definitions />',
        },
      },
      {
        orgSlug: 'acme',
        environment: 'default',
        mode: 'preview',
        runtimeImage: 'ghcr.io/acme/runtime:v1',
        eventBus: { kind: 'kafka', mode: 'provisioned', provider: 'redpanda' },
        workflows: {
          engine: {
            kind: 'operaton',
            mode: 'provisioned',
            image: 'operaton/operaton:test',
            adminUserSecretRef: 'operaton-admin-user-v1',
          },
          worker: { image: 'ghcr.io/acme/bpmn-worker:v1' },
        },
      },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.infrastructure.workflowEngine).toMatchObject({
      adminUserSecretRef: 'operaton-admin-user-v1',
    });
  });

  it('rejects operatonUi when publicBaseUrl is missing', () => {
    const result = buildProjectDeploymentPlan(project, {
      orgSlug: 'acme',
      environment: 'default',
      mode: 'preview',
      runtimeImage: 'ghcr.io/acme/runtime:v1',
      eventBus: { kind: 'kafka', mode: 'provisioned', provider: 'redpanda' },
      workflows: {
        engine: { kind: 'operaton', mode: 'provisioned', image: 'operaton/operaton:test' },
        worker: { image: 'ghcr.io/acme/bpmn-worker:v1' },
        operatonUi: {
          enabled: true,
          publicBaseUrl: '',
          auth: { kind: 'basic', secretRef: 'operaton-ui-basic-auth-v1' },
        },
      },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'DEPLOY_PLAN_WORKFLOWS_UI_PUBLIC_URL_MISSING',
          path: 'workflows.operatonUi.publicBaseUrl',
        }),
      );
    }
  });

  it('rejects operatonUi when auth.secretRef is missing', () => {
    const result = buildProjectDeploymentPlan(project, {
      orgSlug: 'acme',
      environment: 'default',
      mode: 'preview',
      runtimeImage: 'ghcr.io/acme/runtime:v1',
      eventBus: { kind: 'kafka', mode: 'provisioned', provider: 'redpanda' },
      workflows: {
        engine: { kind: 'operaton', mode: 'provisioned', image: 'operaton/operaton:test' },
        worker: { image: 'ghcr.io/acme/bpmn-worker:v1' },
        operatonUi: {
          enabled: true,
          publicBaseUrl: 'https://operaton.acme.example.test',
          auth: { kind: 'basic', secretRef: '' },
        },
      },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'DEPLOY_PLAN_WORKFLOWS_UI_AUTH_SECRET_MISSING',
          path: 'workflows.operatonUi.auth.secretRef',
        }),
      );
    }
  });

  it('rejects empty adminUserSecretRef on the Operaton engine', () => {
    const result = buildProjectDeploymentPlan(project, {
      orgSlug: 'acme',
      environment: 'default',
      mode: 'preview',
      runtimeImage: 'ghcr.io/acme/runtime:v1',
      eventBus: { kind: 'kafka', mode: 'provisioned', provider: 'redpanda' },
      workflows: {
        engine: {
          kind: 'operaton',
          mode: 'provisioned',
          image: 'operaton/operaton:test',
          adminUserSecretRef: '   ',
        },
        worker: { image: 'ghcr.io/acme/bpmn-worker:v1' },
      },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'DEPLOY_PLAN_WORKFLOWS_OPERATON_ADMIN_SECRET_MISSING',
          path: 'workflows.engine.adminUserSecretRef',
        }),
      );
    }
  });

  it('rejects operatonUi when engine is not provisioned Operaton', () => {
    const result = buildProjectDeploymentPlan(project, {
      orgSlug: 'acme',
      environment: 'default',
      mode: 'preview',
      runtimeImage: 'ghcr.io/acme/runtime:v1',
      eventBus: { kind: 'kafka', mode: 'provisioned', provider: 'redpanda' },
      workflows: {
        engine: { kind: 'operaton', mode: 'external', image: 'operaton/operaton:test' },
        worker: { image: 'ghcr.io/acme/bpmn-worker:v1' },
        operatonUi: {
          enabled: true,
          publicBaseUrl: 'https://operaton.acme.example.test',
          auth: { kind: 'basic', secretRef: 'operaton-ui-basic-auth-v1' },
        },
      },
    } as unknown as Parameters<typeof buildProjectDeploymentPlan>[1]);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'DEPLOY_PLAN_WORKFLOWS_UI_REQUIRES_OPERATON',
          path: 'workflows.operatonUi',
        }),
      );
    }
  });
});
