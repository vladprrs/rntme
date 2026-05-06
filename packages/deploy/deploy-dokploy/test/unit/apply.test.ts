import { describe, expect, it } from 'vitest';
import { applyDokployPlan } from '../../src/apply.js';
import type {
  DokployApplication,
  DokployClient,
  DokployCompose,
  DokployProjectRef,
} from '../../src/client.js';
import type { RenderedDokployPlan, RenderedDokployResource } from '../../src/render.js';

const rendered: RenderedDokployPlan = {
  target: { kind: 'dokploy', endpoint: 'https://dokploy.example.com' },
  targetProject: { mode: 'existing', projectId: 'project_123' },
  deployment: {
    orgSlug: 'acme',
    projectSlug: 'commerce',
    environment: 'default',
    mode: 'preview',
  },
  resources: [
    {
      logicalId: 'catalog',
      kind: 'application',
      workloadKind: 'domain-service',
      workloadSlug: 'catalog',
      name: 'rntme-acme-commerce-catalog',
      image: 'rntme-runtime',
      env: [
        { name: 'RNTME_EVENT_BUS_BROKERS', value: 'redpanda.internal:9092', secret: false },
      ],
      labels: { 'rntme.workload': 'catalog' },
    },
  ],
  urls: {
    projectUrl: 'https://commerce.example.com',
    publicRoutes: [{ routeId: 'http:/api/catalog', url: 'https://commerce.example.com/api/catalog' }],
    protectedRouteChecks: [],
  },
  digest: 'sha256:abc',
  warnings: [],
};

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

describe('applyDokployPlan', () => {
  it('creates missing resources and returns structured result', async () => {
    const client = new FakeDokployClient();
    const r = await applyDokployPlan(rendered, client);

    expect(r.ok).toBe(true);
    if (!r.ok) return;

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
    expect(r.value.deployment).toEqual({
      orgSlug: 'acme',
      projectSlug: 'commerce',
      environment: 'default',
      mode: 'preview',
    });
    expect(r.value.urls.publicRoutes[0]?.url).toBe('https://commerce.example.com/api/catalog');
    expect(client.createCalls).toEqual([
      {
        environmentId: 'env_default',
        resource: expect.objectContaining({
          name: 'rntme-acme-commerce-catalog',
          labels: { 'rntme.workload': 'catalog' },
        }),
      },
    ]);
    expect(r.value.verificationHints.healthUrl).toBe('https://commerce.example.com/health');
    expect(r.value.verificationHints.uiUrl).toBeUndefined();
    expect(JSON.stringify(r.value)).not.toContain('token');
  });

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
      'inspect:app_1',
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

  it('applies workflow engine before apps and BPMN worker before edge', async () => {
    const client = new FakeDokployClient();
    const eventBus = renderedWithCompose.resources[0] as Extract<RenderedDokployResource, { kind: 'compose' }>;
    const workflowEngine: Extract<RenderedDokployResource, { kind: 'compose' }> = {
      logicalId: 'workflow-engine',
      kind: 'compose',
      infrastructureKind: 'workflow-engine',
      name: 'rntme-acme-commerce-operaton',
      image: 'operaton/operaton:test',
      composeFile: 'services:\n  operaton:\n    image: operaton/operaton:test\n',
      env: [],
      labels: { 'rntme.infrastructure': 'workflow-engine' },
    };
    const worker = resource({
      logicalId: 'bpmn-worker',
      workloadKind: 'bpmn-worker',
      workloadSlug: 'bpmn-worker',
      name: 'rntme-acme-commerce-bpmn-worker',
      image: 'ghcr.io/acme/bpmn-worker:v1',
      env: [],
    });
    const edge = resource({
      logicalId: 'edge',
      workloadKind: 'edge-gateway',
      workloadSlug: 'edge',
      name: 'rntme-acme-commerce-edge',
      image: 'nginx:1.27-alpine',
      env: [],
    });

    const r = await applyDokployPlan(
      {
        ...rendered,
        resources: [edge, worker, workflowEngine, rendered.resources[0], eventBus],
      },
      client,
    );

    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(client.lifecycleCalls).toEqual([
      'create-compose:rntme-acme-commerce-event-bus',
      'configure-compose:compose_1:rntme-acme-commerce-event-bus',
      'deploy-compose:compose_1',
      'create-compose:rntme-acme-commerce-operaton',
      'configure-compose:compose_2:rntme-acme-commerce-operaton',
      'deploy-compose:compose_2',
      'create:rntme-acme-commerce-catalog',
      'create:rntme-acme-commerce-bpmn-worker',
      'create:rntme-acme-commerce-edge',
      'configure:app_1:rntme-acme-commerce-catalog',
      'deploy:app_1',
      'inspect:app_1',
      'configure:app_2:rntme-acme-commerce-bpmn-worker',
      'deploy:app_2',
      'inspect:app_2',
      'configure:app_3:rntme-acme-commerce-edge',
      'deploy:app_3',
      'inspect:app_3',
    ]);
    expect(r.value.resources.map((resource) => resource.logicalId)).toEqual([
      'event-bus',
      'workflow-engine',
      'catalog',
      'bpmn-worker',
      'edge',
    ]);
  });

  it('keeps BPMN worker compose references on deterministic compose network aliases', async () => {
    const client = new FakeDokployClient();
    const eventBus = renderedWithCompose.resources[0] as Extract<RenderedDokployResource, { kind: 'compose' }>;
    const workflowEngine: Extract<RenderedDokployResource, { kind: 'compose' }> = {
      logicalId: 'workflow-engine',
      kind: 'compose',
      infrastructureKind: 'workflow-engine',
      name: 'rntme-acme-commerce-operaton',
      image: 'operaton/operaton:test',
      composeFile: 'services:\n  operaton:\n    image: operaton/operaton:test\n',
      env: [],
      labels: { 'rntme.infrastructure': 'workflow-engine' },
    };
    const worker = resource({
      logicalId: 'bpmn-worker',
      workloadKind: 'bpmn-worker',
      workloadSlug: 'bpmn-worker',
      name: 'rntme-acme-commerce-bpmn-worker',
      image: 'ghcr.io/acme/bpmn-worker:v1',
      env: [
        {
          name: 'RNTME_EVENT_BUS_BROKERS',
          value: 'rntme-acme-commerce-event-bus:9092',
          secret: false,
        },
        {
          name: 'RNTME_OPERATON_BASE_URL',
          value: 'http://rntme-acme-commerce-operaton:8080',
          secret: false,
        },
      ],
    });

    const r = await applyDokployPlan(
      {
        ...rendered,
        resources: [worker, workflowEngine, eventBus],
      },
      client,
    );

    expect(r.ok).toBe(true);
    const configure = client.configureCalls.find(
      (call) => call.resource.name === 'rntme-acme-commerce-bpmn-worker',
    );
    expect(configure?.resource.env).toContainEqual({
      name: 'RNTME_EVENT_BUS_BROKERS',
      value: 'rntme-acme-commerce-event-bus:9092',
      secret: false,
    });
    expect(configure?.resource.env).toContainEqual({
      name: 'RNTME_OPERATON_BASE_URL',
      value: 'http://rntme-acme-commerce-operaton:8080',
      secret: false,
    });
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

  it('leaves matching compose resources unchanged when env order differs', async () => {
    const baseCompose = renderedWithCompose.resources[0] as Extract<RenderedDokployResource, { kind: 'compose' }>;
    const compose = {
      ...baseCompose,
      env: [
        { name: 'RNTME_EVENT_BUS_PROTOCOL', value: 'plaintext', secret: false },
        { name: 'RNTME_EVENT_BUS_BROKERS', value: 'redpanda:9092', secret: false },
      ],
    };
    const client = new FakeDokployClient([], [
      {
        id: 'compose_existing',
        name: compose.name,
        image: compose.image,
        composeFile: compose.composeFile,
        env: [...compose.env].reverse(),
        labels: compose.labels,
      },
    ]);
    const r = await applyDokployPlan({ ...renderedWithCompose, resources: [compose] }, client);

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.resources[0]?.action).toBe('unchanged');
    expect(client.updateComposeCalls).toEqual([]);
  });

  it('configures and deploys created applications before returning success', async () => {
    const client = new FakeDokployClient();
    const resourceWithRuntimeConfig = resource({
      build: {
        kind: 'domain-service-artifact',
        baseImage: 'rntme-runtime',
        image: 'rntme-acme-commerce-catalog:artifact',
        artifact: { source: 'composed-project', serviceSlug: 'catalog' },
        context: {
          kind: 'generated',
          serviceSlug: 'catalog',
          files: ['Dockerfile', 'artifacts/catalog/manifest.json'],
        },
      },
      image: 'rntme-acme-commerce-catalog:artifact',
      ports: [{ containerPort: 8080, protocol: 'http' }],
      ingress: {
        publicBaseUrl: 'https://commerce.example.com',
        containerPort: 8080,
        healthPath: '/health',
        routes: [
          {
            routeId: 'ui:/',
            path: '/',
            url: 'https://commerce.example.com/',
          },
        ],
      },
      files: { '/etc/rntme/generated.json': '{"ok":true}' },
    });

    const r = await applyDokployPlan({ ...rendered, resources: [resourceWithRuntimeConfig] }, client);

    expect(r.ok).toBe(true);
    expect(client.lifecycleCalls).toEqual([
      'create:rntme-acme-commerce-catalog',
      'configure:app_1:rntme-acme-commerce-catalog',
      'deploy:app_1',
      'inspect:app_1',
    ]);
    expect(client.configureCalls).toEqual([
      {
        applicationId: 'app_1',
        resource: expect.objectContaining({
          build: resourceWithRuntimeConfig.build,
          ports: resourceWithRuntimeConfig.ports,
          ingress: resourceWithRuntimeConfig.ingress,
          files: resourceWithRuntimeConfig.files,
        }),
      },
    ]);
  });

  it('inspects applications after deploy before returning success', async () => {
    const client = new FakeDokployClient();

    const r = await applyDokployPlan(rendered, client);

    expect(r.ok).toBe(true);
    expect(client.lifecycleCalls).toEqual([
      'create:rntme-acme-commerce-catalog',
      'configure:app_1:rntme-acme-commerce-catalog',
      'deploy:app_1',
      'inspect:app_1',
    ]);
  });

  it('returns a partial failure when application task inspection reports rejected', async () => {
    const client = new FakeDokployClient([], [], { inspectStatus: 'rejected' });

    const r = await applyDokployPlan(rendered, client);

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toContainEqual(
        expect.objectContaining({
          code: 'DEPLOY_APPLY_DOKPLOY_PARTIAL_FAILURE',
          partialFailure: expect.objectContaining({
            failedStep: {
              action: 'inspect',
              resourceName: 'rntme-acme-commerce-catalog',
              resourceKind: 'application',
              workloadSlug: 'catalog',
            },
          }),
        }),
      );
    }
  });

  it('joins trailing slash project URLs for health checks and includes UI hints when present', async () => {
    const client = new FakeDokployClient();
    const r = await applyDokployPlan(
      {
        ...rendered,
        urls: {
          ...rendered.urls,
          projectUrl: 'https://commerce.example.com/',
          uiUrl: 'https://commerce.example.com/app',
        },
      },
      client,
    );

    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(r.value.verificationHints.healthUrl).toBe('https://commerce.example.com/health');
    expect(r.value.verificationHints.uiUrl).toBe('https://commerce.example.com/app');
  });

  it('updates existing resources by name and labels', async () => {
    const client = new FakeDokployClient([
      {
        id: 'app_existing',
        name: 'rntme-acme-commerce-catalog',
      },
    ]);
    const r = await applyDokployPlan(rendered, client);

    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(r.value.resources[0]).toMatchObject({
      targetResourceId: 'app_existing',
      action: 'updated',
    });
    expect(client.updateCalls).toEqual([
      {
        applicationId: 'app_existing',
        resource: expect.objectContaining({
          labels: { 'rntme.workload': 'catalog' },
        }),
      },
    ]);
  });

  it('leaves existing resources unchanged when comparable current state matches', async () => {
    const client = new FakeDokployClient([
      {
        id: 'app_existing',
        name: 'rntme-acme-commerce-catalog',
        image: 'rntme-runtime',
        env: rendered.resources[0].env,
        labels: { 'rntme.workload': 'catalog' },
      },
    ]);
    const r = await applyDokployPlan(rendered, client);

    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(r.value.resources[0]).toEqual({
      logicalId: 'catalog',
      resourceKind: 'application',
      workloadSlug: 'catalog',
      kind: 'domain-service',
      targetResourceId: 'app_existing',
      targetResourceName: 'rntme-acme-commerce-catalog',
      action: 'unchanged',
    });
    expect(client.updateCalls).toEqual([]);
  });

  it('leaves existing applications unchanged when env order differs', async () => {
    const resourceWithEnv = resource({
      env: [
        { name: 'RNTME_EVENT_BUS_PROTOCOL', value: 'plaintext', secret: false },
        { name: 'RNTME_EVENT_BUS_BROKERS', value: 'redpanda.internal:9092', secret: false },
      ],
    });
    const client = new FakeDokployClient([
      {
        id: 'app_existing',
        name: resourceWithEnv.name,
        image: resourceWithEnv.image,
        env: [...resourceWithEnv.env].reverse(),
        labels: resourceWithEnv.labels,
      },
    ]);
    const r = await applyDokployPlan({ ...rendered, resources: [resourceWithEnv] }, client);

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.resources[0]?.action).toBe('unchanged');
    expect(client.updateCalls).toEqual([]);
  });

  it('updates existing applications when env values drift', async () => {
    const resourceWithEnv = resource({
      env: [
        { name: 'RNTME_EVENT_BUS_PROTOCOL', value: 'plaintext', secret: false },
        { name: 'RNTME_EVENT_BUS_BROKERS', value: 'redpanda.internal:9092', secret: false },
      ],
    });
    const client = new FakeDokployClient([
      {
        id: 'app_existing',
        name: resourceWithEnv.name,
        image: resourceWithEnv.image,
        env: [
          { name: 'RNTME_EVENT_BUS_PROTOCOL', value: 'plaintext', secret: false },
          { name: 'RNTME_EVENT_BUS_BROKERS', value: 'old-redpanda.internal:9092', secret: false },
        ],
        labels: resourceWithEnv.labels,
      },
    ]);
    const r = await applyDokployPlan({ ...rendered, resources: [resourceWithEnv] }, client);

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.resources[0]?.action).toBe('updated');
    expect(client.updateCalls).toHaveLength(1);
  });

  it('updates existing resources when comparable current state differs', async () => {
    const client = new FakeDokployClient([
      {
        id: 'app_existing',
        name: 'rntme-acme-commerce-catalog',
        image: 'outdated-image',
        env: rendered.resources[0].env,
        labels: { 'rntme.workload': 'catalog' },
      },
    ]);
    const r = await applyDokployPlan(rendered, client);

    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(r.value.resources[0]).toMatchObject({
      targetResourceId: 'app_existing',
      action: 'updated',
    });
    expect(client.updateCalls).toHaveLength(1);
  });

  it('updates existing resources when rendered build, ports, or ingress metadata is missing from current state', async () => {
    const resourceWithMetadata = resource({
      build: {
        kind: 'domain-service-artifact',
        baseImage: 'rntme-runtime',
        image: 'rntme-acme-commerce-catalog:artifact',
        artifact: { source: 'composed-project', serviceSlug: 'catalog' },
        context: {
          kind: 'generated',
          serviceSlug: 'catalog',
          files: ['Dockerfile', 'artifacts/catalog/manifest.json'],
        },
      },
      image: 'rntme-acme-commerce-catalog:artifact',
      ports: [{ containerPort: 8080, protocol: 'http' }],
      ingress: {
        publicBaseUrl: 'https://commerce.example.com',
        containerPort: 8080,
        healthPath: '/health',
        routes: [
          {
            routeId: 'http:/api/catalog',
            path: '/api/catalog',
            url: 'https://commerce.example.com/api/catalog',
          },
        ],
      },
    });
    const client = new FakeDokployClient([
      {
        id: 'app_existing',
        name: 'rntme-acme-commerce-catalog',
        image: 'rntme-acme-commerce-catalog:artifact',
        env: resourceWithMetadata.env,
        labels: resourceWithMetadata.labels,
      },
    ]);
    const r = await applyDokployPlan({ ...rendered, resources: [resourceWithMetadata] }, client);

    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(r.value.resources[0]).toMatchObject({
      targetResourceId: 'app_existing',
      action: 'updated',
    });
    expect(client.updateCalls).toHaveLength(1);
  });

  it('configures service-to-service references with Dokploy app names', async () => {
    const client = new FakeDokployClient();
    const app = resource({
      logicalId: 'app',
      workloadSlug: 'app',
      name: 'rntme-acme-commerce-app',
      env: [
        {
          name: 'RNTME_AUTH_MODULE_ENDPOINT',
          value: 'rntme-acme-commerce-identity-auth0:50051',
          secret: false,
        },
      ],
    });
    const auth = resource({
      logicalId: 'identity-auth0',
      workloadKind: 'integration-module',
      workloadSlug: 'identity-auth0',
      name: 'rntme-acme-commerce-identity-auth0',
      image: 'ghcr.io/acme/identity-auth0:latest',
      env: [],
    });
    const edge = resource({
      logicalId: 'edge',
      workloadKind: 'edge-gateway',
      workloadSlug: 'edge',
      name: 'rntme-acme-commerce-edge',
      image: 'nginx:1.27-alpine',
      env: [],
      files: {
        '/etc/nginx/nginx.conf':
          'proxy_pass http://rntme-acme-commerce-app:3000; grpc_pass grpc://rntme-acme-commerce-identity-auth0:50051;',
      },
    });

    const r = await applyDokployPlan({ ...rendered, resources: [app, auth, edge] }, client);

    expect(r.ok).toBe(true);
    const appConfigure = client.configureCalls.find((call) => call.resource.name === 'rntme-acme-commerce-app');
    const edgeConfigure = client.configureCalls.find((call) => call.resource.name === 'rntme-acme-commerce-edge');
    expect(appConfigure?.resource.env).toContainEqual({
      name: 'RNTME_AUTH_MODULE_ENDPOINT',
      value: 'rntme-acme-commerce-identity-auth0-dns:50051',
      secret: false,
    });
    expect(edgeConfigure?.resource.files?.['/etc/nginx/nginx.conf']).toContain(
      'http://rntme-acme-commerce-app-dns:3000',
    );
    expect(edgeConfigure?.resource.files?.['/etc/nginx/nginx.conf']).toContain(
      'grpc://rntme-acme-commerce-identity-auth0-dns:50051',
    );
  });

  it('leaves existing resources unchanged when rendered build, ports, and ingress metadata matches', async () => {
    const resourceWithMetadata = resource({
      build: {
        kind: 'domain-service-artifact',
        baseImage: 'rntme-runtime',
        image: 'rntme-acme-commerce-catalog:artifact',
        artifact: { source: 'composed-project', serviceSlug: 'catalog' },
        context: {
          kind: 'generated',
          serviceSlug: 'catalog',
          files: ['Dockerfile', 'artifacts/catalog/manifest.json'],
        },
      },
      image: 'rntme-acme-commerce-catalog:artifact',
      ports: [{ containerPort: 8080, protocol: 'http' }],
      ingress: {
        publicBaseUrl: 'https://commerce.example.com',
        containerPort: 8080,
        healthPath: '/health',
        routes: [
          {
            routeId: 'http:/api/catalog',
            path: '/api/catalog',
            url: 'https://commerce.example.com/api/catalog',
          },
        ],
      },
    });
    const client = new FakeDokployClient([
      {
        id: 'app_existing',
        name: 'rntme-acme-commerce-catalog',
        image: 'rntme-acme-commerce-catalog:artifact',
        env: resourceWithMetadata.env,
        labels: resourceWithMetadata.labels,
        build: resourceWithMetadata.build,
        ports: resourceWithMetadata.ports,
        ingress: resourceWithMetadata.ingress,
      },
    ]);
    const r = await applyDokployPlan({ ...rendered, resources: [resourceWithMetadata] }, client);

    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(r.value.resources[0]?.action).toBe('unchanged');
    expect(client.updateCalls).toEqual([]);
  });

  it('leaves existing resources unchanged when rendered ports and ingress routes match in a different order', async () => {
    const resourceWithMetadata = resource({
      image: 'rntme-acme-commerce-catalog:artifact',
      ports: [
        { containerPort: 8080, protocol: 'http' },
        { containerPort: 9090, protocol: 'http' },
      ],
      ingress: {
        publicBaseUrl: 'https://commerce.example.com',
        containerPort: 8080,
        healthPath: '/health',
        routes: [
          {
            routeId: 'http:/api/catalog',
            path: '/api/catalog',
            url: 'https://commerce.example.com/api/catalog',
          },
          {
            routeId: 'http:/api/catalog/search',
            path: '/api/catalog/search',
            url: 'https://commerce.example.com/api/catalog/search',
          },
        ],
      },
    });
    const client = new FakeDokployClient([
      {
        id: 'app_existing',
        name: resourceWithMetadata.name,
        image: resourceWithMetadata.image,
        env: resourceWithMetadata.env,
        labels: resourceWithMetadata.labels,
        ports: [...resourceWithMetadata.ports!].reverse(),
        ingress: {
          ...resourceWithMetadata.ingress!,
          routes: [...resourceWithMetadata.ingress!.routes].reverse(),
        },
      },
    ]);
    const r = await applyDokployPlan({ ...rendered, resources: [resourceWithMetadata] }, client);

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.resources[0]?.action).toBe('unchanged');
    expect(client.updateCalls).toEqual([]);
  });

  it('returns partial failure metadata with applied resources and retry safety', async () => {
    const client = new FakeDokployClient(
      [{ id: 'app_existing', name: 'rntme-acme-commerce-billing' }],
      [],
      { failFindFor: 'rntme-acme-commerce-search' },
    );
    const r = await applyDokployPlan(
      {
        ...rendered,
        resources: [
          resource({ logicalId: 'catalog', workloadSlug: 'catalog', name: 'rntme-acme-commerce-catalog' }),
          resource({ logicalId: 'billing', workloadSlug: 'billing', name: 'rntme-acme-commerce-billing' }),
          resource({ logicalId: 'search', workloadSlug: 'search', name: 'rntme-acme-commerce-search' }),
        ],
      },
      client,
    );

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toContainEqual(
        expect.objectContaining({
          code: 'DEPLOY_APPLY_DOKPLOY_PARTIAL_FAILURE',
          message: 'failed while applying resource "rntme-acme-commerce-search"',
          resource: 'rntme-acme-commerce-search',
          partialFailure: expect.objectContaining({
            createdResources: [expect.objectContaining({ targetResourceId: 'app_1' })],
            updatedResources: [],
            failedStep: {
              action: 'find',
              resourceName: 'rntme-acme-commerce-search',
              resourceKind: 'application',
              workloadSlug: 'search',
            },
            cleanup: expect.objectContaining({
              deletedResources: [expect.objectContaining({ targetResourceId: 'app_1' })],
              errors: [],
            }),
            retrySafe: true,
          }),
        }),
      );
      expect(JSON.stringify(r.errors)).not.toContain('dokploy-token-secret');
    }
  });

  it('cleans up resources created earlier in the same apply when a later create fails', async () => {
    const client = new FakeDokployClient([], [], {
      failCreateFor: 'rntme-acme-commerce-search',
    });
    const r = await applyDokployPlan(
      {
        ...rendered,
        resources: [
          resource({ logicalId: 'catalog', workloadSlug: 'catalog', name: 'rntme-acme-commerce-catalog' }),
          resource({ logicalId: 'search', workloadSlug: 'search', name: 'rntme-acme-commerce-search' }),
        ],
      },
      client,
    );

    expect(r.ok).toBe(false);
    if (!r.ok) {
      const error = r.errors[0]!;
      expect(client.deletedApplications).toEqual(['app_1']);
      expect(error.partialFailure?.cleanup).toMatchObject({
        attempted: true,
        deletedResources: [expect.objectContaining({ targetResourceId: 'app_1' })],
        warnings: [],
        errors: [],
      });
      expect(error.partialFailure?.retrySafe).toBe(true);
    }
  });

  it('records cleanup errors and marks retry safety false when rollback deletion fails', async () => {
    const client = new FakeDokployClient([], [], {
      failCreateFor: 'rntme-acme-commerce-search',
      failDeleteApplicationFor: 'app_1',
    });
    const r = await applyDokployPlan(
      {
        ...rendered,
        resources: [
          resource({ logicalId: 'catalog', workloadSlug: 'catalog', name: 'rntme-acme-commerce-catalog' }),
          resource({ logicalId: 'search', workloadSlug: 'search', name: 'rntme-acme-commerce-search' }),
        ],
      },
      client,
    );

    expect(r.ok).toBe(false);
    if (!r.ok) {
      const error = r.errors[0]!;
      expect(client.deletedApplications).toEqual(['app_1']);
      expect(error.partialFailure?.cleanup).toMatchObject({
        attempted: true,
        deletedResources: [],
        errors: [
          expect.objectContaining({
            code: 'DEPLOY_APPLY_DOKPLOY_API_ERROR',
            resource: 'rntme-acme-commerce-catalog',
          }),
        ],
      });
      expect(error.partialFailure?.retrySafe).toBe(false);
      expect(JSON.stringify(error.partialFailure?.cleanup)).not.toContain('dokploy-token-secret');
    }
  });

  it('reports create as the failed step when application creation fails', async () => {
    const client = new FakeDokployClient([], [], { failCreateFor: 'rntme-acme-commerce-catalog' });
    const r = await applyDokployPlan(rendered, client);

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toContainEqual(
        expect.objectContaining({
          code: 'DEPLOY_APPLY_DOKPLOY_PARTIAL_FAILURE',
          resource: 'rntme-acme-commerce-catalog',
          partialFailure: expect.objectContaining({
            failedStep: {
              action: 'create',
              resourceName: 'rntme-acme-commerce-catalog',
              resourceKind: 'application',
              workloadSlug: 'catalog',
            },
            retrySafe: true,
          }),
        }),
      );
      expect(JSON.stringify(r.errors)).not.toContain('dokploy-token-secret');
    }
  });

  it('reports update as the failed step when application update fails', async () => {
    const client = new FakeDokployClient(
      [{ id: 'app_existing', name: 'rntme-acme-commerce-catalog' }],
      [],
      { failUpdateFor: 'rntme-acme-commerce-catalog' },
    );
    const r = await applyDokployPlan(rendered, client);

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toContainEqual(
        expect.objectContaining({
          code: 'DEPLOY_APPLY_DOKPLOY_PARTIAL_FAILURE',
          resource: 'rntme-acme-commerce-catalog',
          partialFailure: expect.objectContaining({
            failedStep: {
              action: 'update',
              resourceName: 'rntme-acme-commerce-catalog',
              resourceKind: 'application',
              workloadSlug: 'catalog',
            },
            retrySafe: true,
          }),
        }),
      );
      expect(JSON.stringify(r.errors)).not.toContain('dokploy-token-secret');
    }
  });

  it('reports lifecycle failures after resource apply as partial failures', async () => {
    const client = new FakeDokployClient([], [], { failDeployFor: 'app_1' });
    const r = await applyDokployPlan(rendered, client);

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toContainEqual(
        expect.objectContaining({
          code: 'DEPLOY_APPLY_DOKPLOY_PARTIAL_FAILURE',
          resource: 'rntme-acme-commerce-catalog',
          partialFailure: expect.objectContaining({
            failedStep: {
              action: 'deploy',
              resourceName: 'rntme-acme-commerce-catalog',
              resourceKind: 'application',
              workloadSlug: 'catalog',
            },
            retrySafe: true,
          }),
        }),
      );
      expect(client.lifecycleCalls).toEqual([
        'create:rntme-acme-commerce-catalog',
        'configure:app_1:rntme-acme-commerce-catalog',
        'deploy:app_1',
      ]);
    }
  });

  it('returns environment initialization failures with a sanitized cause', async () => {
    const client = new FakeDokployClient([], [], { failEnvironment: true });
    const r = await applyDokployPlan(rendered, client);

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toContainEqual(
        expect.objectContaining({
          code: 'DEPLOY_APPLY_DOKPLOY_API_ERROR',
        }),
      );
      expect(JSON.stringify(r.errors)).not.toContain('dokploy-token-secret');
    }
  });

  it('preserves benign client error messages in serialized apply errors', async () => {
    const client = new FakeDokployClient([], [], {
      failEnvironment: true,
      failMessage: 'Dokploy returned 502 while ensuring environment',
      includeSecretFixture: false,
    });
    const r = await applyDokployPlan(rendered, client);

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toContainEqual(
        expect.objectContaining({
          cause: {
            message: 'Dokploy returned 502 while ensuring environment',
          },
        }),
      );
    }
  });

  it('redacts sensitive bearer and API token text while preserving diagnostic context', async () => {
    const client = new FakeDokployClient([], [], {
      failEnvironment: true,
      failMessage:
        'request failed with Bearer bearer-secret and apiToken=api-secret at https://dokploy.example.com/hook?apiToken=query-secret&ok=true password=pw-secret secret: sec-secret token=generic-secret while ensuring environment',
      includeSecretFixture: false,
    });
    const r = await applyDokployPlan(rendered, client);

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(JSON.stringify(r.errors)).toContain('request failed with');
      expect(JSON.stringify(r.errors)).toContain('ok=true');
      expect(JSON.stringify(r.errors)).toContain('while ensuring environment');
      expect(JSON.stringify(r.errors)).toContain('[redacted]');
      expect(JSON.stringify(r.errors)).not.toContain('bearer-secret');
      expect(JSON.stringify(r.errors)).not.toContain('api-secret');
      expect(JSON.stringify(r.errors)).not.toContain('query-secret');
      expect(JSON.stringify(r.errors)).not.toContain('pw-secret');
      expect(JSON.stringify(r.errors)).not.toContain('sec-secret');
      expect(JSON.stringify(r.errors)).not.toContain('generic-secret');
      expect(JSON.stringify(r.errors)).not.toContain('Bearer bearer-secret');
      expect(JSON.stringify(r.errors)).not.toContain('apiToken=api-secret');
      expect(JSON.stringify(r.errors)).not.toContain('apiToken=query-secret');
    }
  });

  it('redacts the existing token fixture value without dropping benign context', async () => {
    const client = new FakeDokployClient([], [], {
      failEnvironment: true,
      failMessage: 'environment failed after Dokploy timeout',
    });
    const r = await applyDokployPlan(rendered, client);

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(JSON.stringify(r.errors)).toContain('environment failed after Dokploy timeout');
      expect(JSON.stringify(r.errors)).toContain('[redacted]');
      expect(JSON.stringify(r.errors)).not.toContain('dokploy-token-secret');
    }
  });

  it('redacts JSON-style credential keys while preserving surrounding diagnostic context', async () => {
    const client = new FakeDokployClient([], [], {
      failEnvironment: true,
      failMessage:
        'Dokploy response body {"apiToken":"json-secret","password":"pw-secret",' +
        '"access_token":"access-secret","refresh_token":"refresh-secret",' +
        '"client_secret":"client-secret","DOKPLOY_TOKEN":"env-secret","status":"denied"} ' +
        'while configuring app',
      includeSecretFixture: false,
    });
    const r = await applyDokployPlan(rendered, client);

    expect(r.ok).toBe(false);
    if (!r.ok) {
      const errors = JSON.stringify(r.errors);
      expect(errors).toContain('Dokploy response body');
      expect(errors).toContain('status');
      expect(errors).toContain('denied');
      expect(errors).toContain('while configuring app');
      expect(errors).toContain('[redacted]');
      expect(errors).not.toContain('json-secret');
      expect(errors).not.toContain('pw-secret');
      expect(errors).not.toContain('access-secret');
      expect(errors).not.toContain('refresh-secret');
      expect(errors).not.toContain('client-secret');
      expect(errors).not.toContain('env-secret');
    }
  });
});

class FakeDokployClient implements DokployClient {
  private readonly apps = new Map<string, DokployApplication>();
  readonly composeResources = new Map<string, DokployCompose>();
  readonly createCalls: Array<{
    readonly environmentId: string;
    readonly resource: RenderedDokployResource;
  }> = [];
  readonly updateCalls: Array<{
    readonly applicationId: string;
    readonly resource: RenderedDokployResource;
  }> = [];
  readonly configureCalls: Array<{
    readonly applicationId: string;
    readonly resource: RenderedDokployResource;
  }> = [];
  readonly createComposeCalls: unknown[] = [];
  readonly updateComposeCalls: unknown[] = [];
  readonly configureComposeCalls: unknown[] = [];
  readonly deployCalls: Array<{ readonly applicationId: string }> = [];
  readonly startCalls: Array<{ readonly applicationId: string }> = [];
  readonly lifecycleCalls: string[] = [];
  readonly deletedApplications: string[] = [];
  readonly deletedComposes: string[] = [];

  private next = 1;

  constructor(
    existing: DokployApplication[] = [],
    existingCompose: DokployCompose[] = [],
    private readonly failures: {
      readonly failEnvironment?: boolean;
      readonly failFindFor?: string;
      readonly failCreateFor?: string;
      readonly failUpdateFor?: string;
      readonly failConfigureFor?: string;
      readonly failDeployFor?: string;
      readonly failStartFor?: string;
      readonly failDeleteApplicationFor?: string;
      readonly failDeleteComposeFor?: string;
      readonly inspectStatus?: 'running' | 'done' | 'failed' | 'rejected' | 'unknown';
      readonly failMessage?: string;
      readonly includeSecretFixture?: boolean;
    } = {},
  ) {
    for (const app of existing) this.apps.set(app.name, app);
    for (const compose of existingCompose) this.composeResources.set(compose.name, compose);
  }

  async ensureEnvironment(
    ref: DokployProjectRef,
    environmentName: string,
  ): Promise<{ environmentId: string }> {
    void ref;
    if (this.failures.failEnvironment === true) {
      throw clientError(this.failures.failMessage ?? 'environment failed', {
        includeSecretFixture: this.failures.includeSecretFixture ?? true,
      });
    }
    return { environmentId: `env_${environmentName}` };
  }

  async findApplicationByName(
    environmentId: string,
    name: string,
  ): Promise<DokployApplication | null> {
    void environmentId;
    if (this.failures.failFindFor === name) throw secretError('find failed');
    return this.apps.get(name) ?? null;
  }

  async createApplication(
    environmentId: string,
    input: RenderedDokployResource,
  ): Promise<{ id: string; name: string }> {
    if (this.failures.failCreateFor === input.name) throw secretError('create failed');
    this.lifecycleCalls.push(`create:${input.name}`);
    this.createCalls.push({ environmentId, resource: input });
    const app = { id: `app_${this.next++}`, name: input.name, appName: `${input.name}-dns` };
    this.apps.set(app.name, app);
    return app;
  }

  async updateApplication(
    id: string,
    input: RenderedDokployResource,
  ): Promise<{ id: string; name: string }> {
    if (this.failures.failUpdateFor === input.name) throw secretError('update failed');
    this.lifecycleCalls.push(`update:${id}:${input.name}`);
    this.updateCalls.push({ applicationId: id, resource: input });
    const app = { id, name: input.name, appName: `${input.name}-dns` };
    this.apps.set(input.name, app);
    return app;
  }

  async configureApplication(id: string, input: RenderedDokployResource): Promise<void> {
    this.lifecycleCalls.push(`configure:${id}:${input.name}`);
    this.configureCalls.push({ applicationId: id, resource: input });
    if (this.failures.failConfigureFor === id) throw secretError('configure failed');
  }

  async deployApplication(id: string): Promise<void> {
    this.lifecycleCalls.push(`deploy:${id}`);
    this.deployCalls.push({ applicationId: id });
    if (this.failures.failDeployFor === id) throw secretError('deploy failed');
  }

  async startApplication(id: string): Promise<void> {
    this.lifecycleCalls.push(`start:${id}`);
    this.startCalls.push({ applicationId: id });
    if (this.failures.failStartFor === id) throw secretError('start failed');
  }

  async inspectApplication(id: string): Promise<{ status: 'running' | 'done' | 'failed' | 'rejected' | 'unknown'; message?: string }> {
    this.lifecycleCalls.push(`inspect:${id}`);
    return {
      status: this.failures.inspectStatus ?? 'running',
      message: this.failures.inspectStatus === undefined ? undefined : `task ${this.failures.inspectStatus}`,
    };
  }

  async findComposeByName(_environmentId: string, name: string): Promise<DokployCompose | null> {
    return this.composeResources.get(name) ?? null;
  }

  async createCompose(
    environmentId: string,
    resource: Extract<RenderedDokployResource, { kind: 'compose' }>,
  ): Promise<DokployCompose> {
    this.createComposeCalls.push({ environmentId, resource });
    this.lifecycleCalls.push(`create-compose:${resource.name}`);
    const created = {
      id: `compose_${this.composeResources.size + 1}`,
      name: resource.name,
      appName: `${resource.name}-dns`,
      image: resource.image,
      composeFile: resource.composeFile,
      env: resource.env,
      labels: resource.labels,
    };
    this.composeResources.set(resource.name, created);
    return created;
  }

  async updateCompose(
    composeId: string,
    resource: Extract<RenderedDokployResource, { kind: 'compose' }>,
  ): Promise<DokployCompose> {
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

  async configureCompose(
    composeId: string,
    resource: Extract<RenderedDokployResource, { kind: 'compose' }>,
  ): Promise<void> {
    this.configureComposeCalls.push({ composeId, resource });
    this.lifecycleCalls.push(`configure-compose:${composeId}:${resource.name}`);
  }

  async deployCompose(composeId: string): Promise<void> {
    this.lifecycleCalls.push(`deploy-compose:${composeId}`);
  }

  async deleteApplication(applicationId: string): Promise<void> {
    this.deletedApplications.push(applicationId);
    if (this.failures.failDeleteApplicationFor === applicationId) throw secretError('delete app failed');
  }

  async deleteCompose(composeId: string): Promise<void> {
    this.deletedComposes.push(composeId);
    if (this.failures.failDeleteComposeFor === composeId) throw secretError('delete compose failed');
  }
}

function resource(overrides: Partial<RenderedDokployResource>): RenderedDokployResource {
  return {
    ...rendered.resources[0],
    ...overrides,
    labels: { 'rntme.workload': overrides.workloadSlug ?? rendered.resources[0].workloadSlug },
  };
}

function secretError(message: string): Error & { readonly token: string } {
  return clientError(message, { includeSecretFixture: true });
}

function clientError(
  message: string,
  options: { readonly includeSecretFixture: boolean },
): Error & { readonly token: string } {
  const errorMessage = options.includeSecretFixture ? `${message}: dokploy-token-secret` : message;
  return Object.assign(new Error(errorMessage), {
    token: 'dokploy-token-secret',
  });
}
