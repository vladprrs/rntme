import type { ProjectDeploymentPlan } from '@rntme/deploy-core';
import { describe, expect, it } from 'bun:test';
import { renderDokployPlan } from '../../src/index.js';

const plan: ProjectDeploymentPlan = {
  project: {
    orgSlug: 'acme',
    projectSlug: 'order-fulfillment',
    environment: 'default',
    mode: 'preview',
  },
  infrastructure: {
    eventBus: {
      kind: 'kafka',
      mode: 'provisioned',
      provider: 'redpanda',
      resourceName: 'rntme-acme-order-fulfillment-event-bus',
      internalBrokers: ['rntme-acme-order-fulfillment-event-bus:9092'],
      image: 'docker.redpanda.com/redpandadata/redpanda:v24.3.6',
      persistence: {
        mode: 'persistent',
        volumeName: 'rntme-acme-order-fulfillment-event-bus-data',
      },
    },
    workflowEngine: {
      kind: 'operaton',
      mode: 'provisioned',
      resourceName: 'rntme-acme-order-fulfillment-operaton',
      internalBaseUrl: 'http://rntme-acme-order-fulfillment-operaton:8080',
      image: 'operaton/operaton:test',
    },
  },
  workloads: [
    {
      kind: 'domain-service',
      slug: 'orders',
      serviceSlug: 'orders',
      resourceName: 'rntme-acme-order-fulfillment-orders',
      runtime: { image: 'ghcr.io/acme/runtime:v1' },
      artifact: { source: 'composed-project', serviceSlug: 'orders' },
      runtimeFiles: { 'manifest.json': '{}' },
      publicConfigJson: '{}',
      persistence: { mode: 'ephemeral' },
    },
    {
      kind: 'domain-service',
      slug: 'inventory',
      serviceSlug: 'inventory',
      resourceName: 'rntme-acme-order-fulfillment-inventory',
      runtime: { image: 'ghcr.io/acme/runtime:v1' },
      artifact: { source: 'composed-project', serviceSlug: 'inventory' },
      runtimeFiles: { 'manifest.json': '{}' },
      publicConfigJson: '{}',
      persistence: { mode: 'ephemeral' },
    },
    {
      kind: 'bpmn-worker',
      slug: 'bpmn-worker',
      resourceName: 'rntme-acme-order-fulfillment-bpmn-worker',
      image: 'ghcr.io/acme/bpmn-worker:v1',
      workflowManifestPath: '/srv/workflows/workflows.json',
      workflowFiles: {
        'workflows.json': '{"workflowVersion":1}',
        'order-fulfillment.bpmn': '<definitions />',
      },
      subscriptions: [
        {
          messageStartId: 'orderPlaced',
          topic: 'rntme.acme.orders.order',
          service: 'orders',
          aggregateType: 'Order',
          eventType: 'OrderPlaced',
          processId: 'orderFulfillment',
          messageName: 'OrderPlaced',
          businessKey: '$event.rntAggregateId',
        },
      ],
      grpcServices: {
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
    },
    {
      kind: 'edge-gateway',
      slug: 'edge',
      resourceName: 'rntme-acme-order-fulfillment-edge',
      image: 'nginx:1.27-alpine',
    },
  ],
  edge: {
    routes: [],
    middleware: [],
  },
  diagnostics: { warnings: [] },
};

describe('workflow rendering', () => {
  it('renders non-workflow plans that omit workflowEngine', () => {
    const nonWorkflowPlan = {
      ...plan,
      infrastructure: {
        eventBus: plan.infrastructure.eventBus,
      },
      workloads: plan.workloads.filter((workload) => workload.kind !== 'bpmn-worker'),
    } as unknown as ProjectDeploymentPlan;

    const result = renderDokployPlan(nonWorkflowPlan, targetConfig());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const stack = result.value.resources[0];
    expect(stack.kind).toBe('compose');
    if (stack.kind !== 'compose') return;
    expect(stack.services.some((service) => service.name === 'operaton')).toBe(false);
  });

  it('renders Operaton and BPMN worker inside the project stack with compose service endpoints', () => {
    const result = renderDokployPlan(plan, targetConfig());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const stack = result.value.resources[0];
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

  it('renders Operaton and BPMN worker services with deterministic compose env', () => {
    const result = renderDokployPlan(plan, targetConfig());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const stack = result.value.resources[0];
    expect(stack.kind).toBe('compose');
    if (stack.kind !== 'compose') return;

    const operaton = stack.services.find((service) => service.name === 'operaton');
    expect(operaton).toMatchObject({
      serviceClass: 'workflow-engine',
      image: 'operaton/operaton:test',
      restart: { container: 'unless-stopped' },
    });
    expect(stack.composeFile).toContain('  operaton:\n');

    const redpanda = stack.services.find((service) => service.name === 'redpanda');
    expect(redpanda).toMatchObject({
      serviceClass: 'event-bus',
      image: 'docker.redpanda.com/redpandadata/redpanda:v24.3.6',
    });
    // The redpanda compose service command seeds workflow message-start topics
    // referenced by BPMN worker subscriptions.
    expect(redpanda?.entrypoint?.slice(0, 2)).toEqual(['/bin/sh', '-c']);
    expect(redpanda?.entrypoint?.[2]).toStartWith('rpk redpanda start ');
    expect(redpanda?.command).toBeUndefined();
    expect(redpanda?.entrypoint?.[2]).toContain('rntme.acme.orders.order');
    expect(stack.composeFile).toContain('    entrypoint:\n      - /bin/sh\n      - -c\n      - ');

    const worker = stack.services.find((service) => service.name === 'bpmn-worker');
    expect(worker?.serviceClass).toBe('bpmn-worker');
    expect(worker?.command).toBe('packages/runtime/bpmn-worker/dist/bin/worker.js');
    expect(worker?.env).toContainEqual({
      name: 'RNTME_OPERATON_BASE_URL',
      value: 'http://operaton:8080',
      secret: false,
    });
    expect(worker?.env).toContainEqual({
      name: 'RNTME_WORKFLOW_SERVICE_ENDPOINTS_JSON',
      value: JSON.stringify({
        'inventory.reserveStock': 'svc-inventory:50051',
        'orders.confirmOrder': 'svc-orders:50051',
      }),
      secret: false,
    });
    expect(worker?.env).toContainEqual({
      name: 'RNTME_WORKFLOW_SUBSCRIPTIONS_JSON',
      value: JSON.stringify(plan.workloads.find((workload) => workload.kind === 'bpmn-worker')!.subscriptions),
      secret: false,
    });
    expect(worker?.env).toContainEqual({
      name: 'RNTME_WORKFLOW_GRPC_SERVICES_JSON',
      value: JSON.stringify({
        inventory: {
          packageName: 'rntme.inventory.v1',
          serviceName: 'InventoryService',
          protoSource: 'syntax = "proto3"; package rntme.inventory.v1; service InventoryService {}',
        },
        orders: {
          packageName: 'rntme.orders.v1',
          serviceName: 'OrdersService',
          protoSource: 'syntax = "proto3"; package rntme.orders.v1; service OrdersService {}',
        },
      }),
      secret: false,
    });
    expect(worker?.files?.['/srv/workflows/workflows.json']).toBe('{"workflowVersion":1}');
  });

  it('renders deploy poll worker with the image-local poll bin path', () => {
    const result = renderDokployPlan(
      {
        ...plan,
        workloads: [
          ...plan.workloads.filter((workload) => workload.kind !== 'bpmn-worker'),
          {
            kind: 'bpmn-worker',
            slug: 'deploy-worker',
            resourceName: 'rntme-acme-order-fulfillment-deploy-worker',
            image: 'ghcr.io/acme/bpmn-worker:v1',
            command: 'rntme-bpmn-poll-worker',
            workflowManifestPath: '/srv/workflows/workflows.json',
            workflowFiles: {
              'workflows.json': '{"workflowVersion":1}',
            },
            subscriptions: [],
            grpcServices: {},
            serviceTasks: [],
          },
        ],
      },
      targetConfig(),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const stack = result.value.resources[0];
    expect(stack.kind).toBe('compose');
    if (stack.kind !== 'compose') return;

    const worker = stack.services.find((service) => service.name === 'deploy-worker');
    expect(worker?.command).toBe('packages/runtime/bpmn-worker/dist/bin/poll.js');
  });

  it('renders workflow service endpoints with normalized compose service names', () => {
    const result = renderDokployPlan(
      {
        ...plan,
        project: {
          ...plan.project,
          orgSlug: 'Acme_Inc',
          projectSlug: 'Order_Fulfillment',
        },
        workloads: [
          {
            kind: 'domain-service',
            slug: 'Inventory_Service',
            serviceSlug: 'Inventory_Service',
            resourceName: 'rntme-Acme_Inc-Order_Fulfillment-Inventory_Service',
            runtime: { image: 'ghcr.io/acme/runtime:v1' },
            artifact: { source: 'composed-project', serviceSlug: 'Inventory_Service' },
            runtimeFiles: { 'manifest.json': '{}' },
            publicConfigJson: '{}',
            persistence: { mode: 'ephemeral' },
          },
          ...plan.workloads.filter((workload) => workload.kind !== 'domain-service').map((workload) =>
            workload.kind === 'bpmn-worker'
              ? {
                  ...workload,
                  serviceTasks: [
                    {
                      definition: 'orderFulfillment',
                      taskId: 'reserveStock',
                      bindingRef: 'Inventory_Service.reserveStock',
                      targetService: 'Inventory_Service',
                      grpcEndpoint: 'rntme-Acme_Inc-Order_Fulfillment-Inventory_Service:50051',
                    },
                  ],
                }
              : workload,
          ),
        ],
      },
      targetConfig(),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const stack = result.value.resources[0];
    expect(stack.kind).toBe('compose');
    if (stack.kind !== 'compose') return;
    const worker = stack.services.find((service) => service.name === 'bpmn-worker');
    expect(worker?.env).toContainEqual({
      name: 'RNTME_WORKFLOW_SERVICE_ENDPOINTS_JSON',
      value: JSON.stringify({
        'Inventory_Service.reserveStock': 'svc-inventory-service:50051',
      }),
      secret: false,
    });
  });

  it('rejects BPMN service tasks that cannot resolve to a domain-service gRPC endpoint', () => {
    const result = renderDokployPlan(
      {
        ...plan,
        workloads: plan.workloads.map((workload) =>
          workload.kind === 'bpmn-worker'
            ? {
                ...workload,
                serviceTasks: [
                  {
                    definition: 'orderFulfillment',
                    taskId: 'reserveStock',
                    bindingRef: 'payments.reserveStock',
                    targetService: 'payments',
                  },
                ],
              }
            : workload,
        ),
      } as ProjectDeploymentPlan,
      targetConfig(),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        code: 'DEPLOY_RENDER_DOKPLOY_WORKFLOW_SERVICE_ENDPOINT_UNAVAILABLE',
        resource: 'rntme-acme-order-fulfillment-bpmn-worker',
        path: 'workloads.bpmn-worker.serviceTasks.0.targetService',
      }),
    );
  });

  it('renders workflow file mounts in stable path order', () => {
    const result = renderDokployPlan(
      {
        ...plan,
        workloads: plan.workloads.map((workload) =>
          workload.kind === 'bpmn-worker'
            ? {
                ...workload,
                workflowFiles: {
                  'z-last.bpmn': '<z />',
                  'workflows.json': '{"workflowVersion":1}',
                  'a-first.bpmn': '<a />',
                },
              }
            : workload,
        ),
      },
      targetConfig(),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const stack = result.value.resources[0];
    expect(stack.kind).toBe('compose');
    if (stack.kind !== 'compose') return;
    const worker = stack.services.find((service) => service.name === 'bpmn-worker');
    expect(Object.keys(worker?.files ?? {})).toEqual([
      '/srv/workflows/a-first.bpmn',
      '/srv/workflows/workflows.json',
      '/srv/workflows/z-last.bpmn',
    ]);
  });

  it('rejects BPMN workers when workflowEngine is none', () => {
    const result = renderDokployPlan(
      {
        ...plan,
        infrastructure: {
          ...plan.infrastructure,
          workflowEngine: { kind: 'none' },
        },
      },
      targetConfig(),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        code: 'DEPLOY_RENDER_DOKPLOY_BPMN_WORKER_REQUIRES_OPERATON',
        resource: 'rntme-acme-order-fulfillment-bpmn-worker',
      }),
    );
  });

  it('rejects BPMN workers when workflowEngine is omitted', () => {
    const result = renderDokployPlan(
      {
        ...plan,
        infrastructure: {
          eventBus: plan.infrastructure.eventBus,
        },
      } as unknown as ProjectDeploymentPlan,
      targetConfig(),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        code: 'DEPLOY_RENDER_DOKPLOY_BPMN_WORKER_REQUIRES_OPERATON',
        resource: 'rntme-acme-order-fulfillment-bpmn-worker',
      }),
    );
  });

  it('rejects BPMN workers when workflow files omit the manifest mount', () => {
    const result = renderDokployPlan(
      {
        ...plan,
        workloads: plan.workloads.map((workload) =>
          workload.kind === 'bpmn-worker' ? { ...workload, workflowFiles: {} } : workload,
        ),
      },
      targetConfig(),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        code: 'DEPLOY_RENDER_DOKPLOY_WORKFLOW_MANIFEST_FILE_MISSING',
        resource: 'rntme-acme-order-fulfillment-bpmn-worker',
      }),
    );
  });

  it.each([
    '../x.bpmn',
    'nested/../../x',
    './x.bpmn',
    'a//b.bpmn',
    'nested\\x.bpmn',
    'file://x.bpmn',
    '',
    '.',
    '..',
    '/absolute.bpmn',
  ])('rejects unsafe workflow file path %j', (path) => {
    const result = renderDokployPlan(
      {
        ...plan,
        workloads: plan.workloads.map((workload) =>
          workload.kind === 'bpmn-worker'
            ? { ...workload, workflowFiles: { [path]: '<definitions />' } }
            : workload,
        ),
      },
      targetConfig(),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        code: 'DEPLOY_RENDER_DOKPLOY_INVALID_WORKFLOW_FILE_PATH',
        resource: 'rntme-acme-order-fulfillment-bpmn-worker',
      }),
    );
  });

  it('renders external SASL Kafka worker env with secret credentials', () => {
    const result = renderDokployPlan(
      {
        ...plan,
        infrastructure: {
          ...plan.infrastructure,
          eventBus: {
            kind: 'kafka',
            mode: 'external',
            brokers: ['kafka.example.com:9093'],
            topicPrefix: 'orders',
            security: {
              protocol: 'sasl_ssl',
              mechanism: 'scram-sha-512',
              secretRefs: {
                username: 'secret://kafka/username',
                password: 'secret://kafka/password',
              },
            },
          },
        },
      },
      targetConfig(),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const stack = result.value.resources[0];
    expect(stack.kind).toBe('compose');
    if (stack.kind !== 'compose') return;
    const worker = stack.services.find((service) => service.name === 'bpmn-worker');
    expect(worker?.env).toContainEqual({
      name: 'RNTME_EVENT_BUS_USERNAME',
      value: 'secret://kafka/username',
      secret: true,
    });
    expect(worker?.env).toContainEqual({
      name: 'RNTME_EVENT_BUS_PASSWORD',
      value: 'secret://kafka/password',
      secret: true,
    });
    expect(worker?.env).toContainEqual({
      name: 'RNTME_EVENT_BUS_MECHANISM',
      value: 'scram-sha-512',
      secret: false,
    });
  });

  it('renders Operaton compose service with admin user secret file ref', () => {
    const result = renderDokployPlan(
      {
        ...plan,
        infrastructure: {
          ...plan.infrastructure,
          workflowEngine: {
            ...(plan.infrastructure.workflowEngine as Extract<
              ProjectDeploymentPlan['infrastructure']['workflowEngine'],
              { kind: 'operaton' }
            >),
            adminUserSecretRef: 'operaton-admin-user-v1',
          },
        },
      },
      targetConfig(),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const stack = result.value.resources[0];
    expect(stack.kind).toBe('compose');
    if (stack.kind !== 'compose') return;
    const operaton = stack.services.find((service) => service.name === 'operaton');
    expect(operaton?.secretFiles).toEqual({
      '/operaton/configuration/application.yaml': {
        schema: 'operaton-admin-user-v1',
        secretRef: 'operaton-admin-user-v1',
        field: 'applicationYaml',
      },
    });
  });

  it('renders Operaton UI gateway as a compose proxy service with basic auth', () => {
    const result = renderDokployPlan(
      {
        ...plan,
        infrastructure: {
          ...plan.infrastructure,
          workflowEngine: {
            ...(plan.infrastructure.workflowEngine as Extract<
              ProjectDeploymentPlan['infrastructure']['workflowEngine'],
              { kind: 'operaton' }
            >),
            uiAccess: {
              enabled: true,
              publicBaseUrl: 'https://operaton.acme.example.test',
              authKind: 'basic',
              authSecretRef: 'operaton-ui-basic-auth-v1',
            },
          },
        },
      },
      targetConfig(),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const stack = result.value.resources[0];
    expect(stack.kind).toBe('compose');
    if (stack.kind !== 'compose') return;
    const gateway = stack.services.find((service) => service.name === 'operaton-ui-gateway');
    expect(gateway).toBeDefined();
    expect(gateway).toMatchObject({
      serviceClass: 'infrastructure-proxy',
      image: 'nginx:1.27-alpine',
      ports: [8080],
    });
    expect(gateway?.files?.['/etc/nginx/nginx.conf']).toContain('auth_basic "rntme Operaton";');
    expect(gateway?.files?.['/etc/nginx/nginx.conf']).toContain('proxy_pass http://operaton:8080;');
    expect(gateway?.files?.['/etc/nginx/nginx.conf']).toContain('location = /health');
    expect(gateway?.secretFiles).toEqual({
      '/etc/nginx/.htpasswd': {
        schema: 'operaton-ui-basic-auth-v1',
        secretRef: 'operaton-ui-basic-auth-v1',
        field: 'htpasswd',
      },
    });
    const gatewayDomain = stack.domains?.find((domain) => domain.serviceName === 'operaton-ui-gateway');
    expect(gatewayDomain).toEqual({
      host: 'operaton.acme.example.test',
      path: '/',
      serviceName: 'operaton-ui-gateway',
      containerPort: 8080,
      https: true,
    });
  });

  it('includes operatonUiUrl and operatonUiAuthChecks in plan urls', () => {
    const result = renderDokployPlan(
      {
        ...plan,
        infrastructure: {
          ...plan.infrastructure,
          workflowEngine: {
            ...(plan.infrastructure.workflowEngine as Extract<
              ProjectDeploymentPlan['infrastructure']['workflowEngine'],
              { kind: 'operaton' }
            >),
            uiAccess: {
              enabled: true,
              publicBaseUrl: 'https://operaton.acme.example.test',
              authKind: 'basic',
              authSecretRef: 'operaton-ui-basic-auth-v1',
            },
          },
        },
      },
      targetConfig(),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.urls.operatonUiUrl).toBe('https://operaton.acme.example.test');
    expect(result.value.urls.operatonUiAuthChecks).toEqual([
      { name: 'operaton-ui', url: 'https://operaton.acme.example.test' },
    ]);
  });

  it('omits operaton UI gateway when uiAccess is absent', () => {
    const result = renderDokployPlan(plan, targetConfig());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const stack = result.value.resources[0];
    expect(stack.kind).toBe('compose');
    if (stack.kind !== 'compose') return;
    expect(stack.services.some((service) => service.name === 'operaton-ui-gateway')).toBe(false);
    expect(result.value.urls.operatonUiUrl).toBeUndefined();
    expect(result.value.urls.operatonUiAuthChecks).toBeUndefined();
  });
});

function targetConfig() {
  return {
    endpoint: 'https://dokploy.example',
    projectName: 'demo',
    allowCreateProject: true,
    publicBaseUrl: 'https://orders.example',
  };
}
