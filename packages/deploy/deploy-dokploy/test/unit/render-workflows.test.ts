import type { ProjectDeploymentPlan } from '@rntme/deploy-core';
import { describe, expect, it } from 'vitest';
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
      kind: 'bpmn-worker',
      slug: 'bpmn-worker',
      resourceName: 'rntme-acme-order-fulfillment-bpmn-worker',
      image: 'ghcr.io/acme/bpmn-worker:v1',
      workflowManifestPath: '/srv/workflows/workflows.json',
      workflowFiles: {
        'workflows.json': '{"workflowVersion":1}',
        'order-fulfillment.bpmn': '<definitions />',
      },
      subscriptions: [],
      serviceTasks: [],
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
  it('renders Operaton and BPMN worker resources', () => {
    const result = renderDokployPlan(plan, {
      endpoint: 'https://dokploy.example',
      projectName: 'demo',
      allowCreateProject: true,
      publicBaseUrl: 'https://orders.example',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(
      result.value.resources.some(
        (resource) => resource.kind === 'compose' && resource.logicalId === 'workflow-engine',
      ),
    ).toBe(true);

    const worker = result.value.resources.find(
      (resource) => resource.kind === 'application' && resource.logicalId === 'bpmn-worker',
    );
    expect(worker).toBeDefined();
    if (worker?.kind !== 'application') return;

    expect(worker.env).toContainEqual({
      name: 'RNTME_OPERATON_BASE_URL',
      value: 'http://rntme-acme-order-fulfillment-operaton:8080',
      secret: false,
    });
    expect(worker.files?.['/srv/workflows/workflows.json']).toBe('{"workflowVersion":1}');
  });
});
