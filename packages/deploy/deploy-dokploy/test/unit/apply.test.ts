import { describe, expect, it } from 'bun:test';
import type { ProjectDeploymentPlan } from '@rntme/deploy-core';
import { applyDokployPlan } from '../../src/apply.js';
import type {
  DokployApplication,
  DokployClient,
  DokployCompose,
  DokployComposeServiceSummary,
  DokployComposeTaskInspection,
  DokployProjectRef,
} from '../../src/client.js';
import type { RenderedComposeDomain } from '../../src/compose-model.js';
import { renderDokployPlan } from '../../src/render.js';
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
        domains: [
          { host: 'commerce.example.com', path: '/', serviceName: 'edge', containerPort: 8080, https: true },
        ],
        services: [
          {
            name: 'svc-catalog',
            logicalId: 'catalog',
            serviceClass: 'domain-service',
            image: 'rntme-runtime',
            env: [],
            restart: {
              container: 'on-failure:3',
              swarm: { condition: 'on-failure', delay: '30s', maxAttempts: 3, window: '5m' },
            },
            resources: { cpus: '0.50', memory: '512M' },
          },
          {
            name: 'edge',
            logicalId: 'edge',
            serviceClass: 'edge-gateway',
            image: 'nginx:1.27-alpine',
            env: [],
            restart: {
              container: 'on-failure:3',
              swarm: { condition: 'on-failure', delay: '30s', maxAttempts: 3, window: '5m' },
            },
            resources: { cpus: '0.10', memory: '128M' },
          },
        ],
      },
    ],
  };
}

describe('applyDokployPlan', () => {
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

  it('configures compose with the folded stack env so ${VAR} interpolations resolve', async () => {
    // Regression: the rendered compose YAML emits `<NAME>: ${<NAME>}` for
    // every service env entry. If the renderer ever stops folding service
    // envs up into the stack-level env block, the resource passed to
    // configureCompose would carry an empty env list and the deployed
    // containers would come up with no environment configuration. This test
    // exercises render -> apply end-to-end and asserts the env survives.
    const renderedResult = renderDokployPlan(envFoldingPlan(), {
      endpoint: 'https://dokploy.example.com',
      projectId: 'project_123',
      publicBaseUrl: 'https://commerce.example.com',
    });
    expect(renderedResult.ok).toBe(true);
    if (!renderedResult.ok) return;

    const client = new FakeDokployClient();
    const r = await applyDokployPlan(renderedResult.value, client);
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(client.configureComposeCalls).toHaveLength(1);
    const configured = client.configureComposeCalls[0] as {
      readonly composeId: string;
      readonly resource: Extract<RenderedDokployResource, { kind: 'compose' }>;
    };
    expect(configured.resource.env.length).toBeGreaterThan(0);
    const envByName = new Map(configured.resource.env.map((entry) => [entry.name, entry]));
    expect(envByName.get('RNTME_EVENT_BUS_BROKERS')).toEqual({
      name: 'RNTME_EVENT_BUS_BROKERS',
      value: 'redpanda:9092',
      secret: false,
    });
    expect(envByName.get('RNTME_PERSISTENCE_MODE')).toEqual({
      name: 'RNTME_PERSISTENCE_MODE',
      value: 'ephemeral',
      secret: false,
    });
    // Every service env entry must have a corresponding stack env entry,
    // otherwise its `${VAR}` reference in the rendered YAML would resolve
    // to empty at deploy time.
    for (const service of configured.resource.services ?? []) {
      for (const entry of service.env) {
        expect(envByName.has(entry.name)).toBe(true);
      }
    }
  });

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

  it('applies object storage before storage public proxy and workloads', async () => {
    const client = new FakeDokployClient();
    const objectStorage: Extract<RenderedDokployResource, { kind: 'compose' }> = {
      logicalId: 'object-storage',
      kind: 'compose',
      infrastructureKind: 'object-storage',
      name: 'rntme-acme-commerce-storage',
      image: 'rustfs/rustfs:1.0.0',
      composeFile: 'services:\n  rustfs:\n    image: rustfs/rustfs:1.0.0\n',
      env: [],
      labels: { 'rntme.infrastructure': 'object-storage' },
    };
    const proxy = resource({
      logicalId: 'object-storage-public',
      workloadKind: 'infrastructure-proxy',
      workloadSlug: 'object-storage-public',
      name: 'rntme-acme-commerce-storage-public',
      image: 'nginx:1.27-alpine',
      env: [],
    });

    const r = await applyDokployPlan(
      {
        ...rendered,
        resources: [rendered.resources[0], proxy, objectStorage],
      },
      client,
    );

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(client.lifecycleCalls).toEqual([
      'create-compose:rntme-acme-commerce-storage',
      'configure-compose:compose_1:rntme-acme-commerce-storage',
      'deploy-compose:compose_1',
      'create:rntme-acme-commerce-catalog',
      'create:rntme-acme-commerce-storage-public',
      'configure:app_1:rntme-acme-commerce-catalog',
      'deploy:app_1',
      'inspect:app_1',
      'configure:app_2:rntme-acme-commerce-storage-public',
      'deploy:app_2',
      'inspect:app_2',
    ]);
    expect(r.value.resources.map((resource) => resource.logicalId)).toEqual([
      'object-storage',
      'catalog',
      'object-storage-public',
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

  it('applies Redpanda Console and proxy before workloads with resolved upstream and command args', async () => {
    const client = new FakeDokployClient();
    const eventBus = renderedWithCompose.resources[0] as Extract<RenderedDokployResource, { kind: 'compose' }>;
    const consoleApp = resource({
      logicalId: 'redpanda-console',
      infrastructureKind: 'redpanda-console',
      workloadKind: undefined,
      workloadSlug: undefined,
      name: 'rntme-acme-commerce-redpanda-console',
      image: 'docker.redpanda.com/redpandadata/console:v3.7.2',
      env: [{ name: 'KAFKA_BROKERS', value: 'rntme-acme-commerce-event-bus:9092', secret: false }],
      labels: { 'rntme.infrastructure': 'redpanda-console' },
    });
    const proxy = resource({
      logicalId: 'redpanda-console-proxy',
      infrastructureKind: 'redpanda-console-proxy',
      workloadKind: undefined,
      workloadSlug: undefined,
      name: 'rntme-acme-commerce-redpanda-console-proxy',
      image: 'nginx:1.27-alpine',
      command: '/bin/sh',
      args: ['/docker-entrypoint-rntme.sh'],
      env: [{ name: 'RNTME_CONSOLE_HTPASSWD_B64', value: 'console-basic-auth', secret: true }],
      labels: { 'rntme.infrastructure': 'redpanda-console-proxy' },
      files: {
        '/etc/nginx/nginx.conf':
          'proxy_pass http://rntme-acme-commerce-redpanda-console:8080;\nproxy_set_header Authorization "";',
      },
    });

    const r = await applyDokployPlan(
      {
        ...rendered,
        resources: [rendered.resources[0], proxy, eventBus, consoleApp],
        urls: {
          ...rendered.urls,
          redpandaConsoleUrl: 'https://console-commerce.example.com',
        },
      },
      client,
    );

    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(client.lifecycleCalls).toEqual([
      'create-compose:rntme-acme-commerce-event-bus',
      'configure-compose:compose_1:rntme-acme-commerce-event-bus',
      'deploy-compose:compose_1',
      'create:rntme-acme-commerce-redpanda-console',
      'create:rntme-acme-commerce-redpanda-console-proxy',
      'create:rntme-acme-commerce-catalog',
      'configure:app_1:rntme-acme-commerce-redpanda-console',
      'deploy:app_1',
      'inspect:app_1',
      'configure:app_2:rntme-acme-commerce-redpanda-console-proxy',
      'deploy:app_2',
      'inspect:app_2',
      'configure:app_3:rntme-acme-commerce-catalog',
      'deploy:app_3',
      'inspect:app_3',
    ]);
    const proxyConfigure = client.configureCalls.find(
      (call) => call.resource.name === 'rntme-acme-commerce-redpanda-console-proxy',
    );
    expect(proxyConfigure?.resource).toMatchObject({
      command: '/bin/sh',
      args: ['/docker-entrypoint-rntme.sh'],
    });
    expect(proxyConfigure?.resource.files?.['/etc/nginx/nginx.conf']).toContain(
      'http://rntme-acme-commerce-redpanda-console-dns:8080',
    );
    expect(r.value.verificationHints.redpandaConsoleUrl).toBe('https://console-commerce.example.com');
    expect(r.value.resources.map((resource) => resource.logicalId)).toEqual([
      'event-bus',
      'redpanda-console',
      'redpanda-console-proxy',
      'catalog',
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

  it('treats compose resources with secretFiles as changed even when all other fields match', async () => {
    const baseCompose = renderedWithCompose.resources[0] as Extract<RenderedDokployResource, { kind: 'compose' }>;
    const compose = {
      ...baseCompose,
      secretFiles: {
        '/etc/operaton/application.yaml': {
          schema: 'operaton-admin-user-v1',
          secretRef: 'operaton-admin',
          field: 'applicationYaml',
        },
      },
    };
    const client = new FakeDokployClient([], [
      {
        id: 'compose_existing',
        name: compose.name,
        image: compose.image,
        composeFile: compose.composeFile,
        env: compose.env,
        labels: compose.labels,
      },
    ]);
    const r = await applyDokployPlan({ ...renderedWithCompose, resources: [compose] }, client);

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.resources[0]).toMatchObject({
      resourceKind: 'compose',
      targetResourceId: 'compose_existing',
      action: 'updated',
    });
    expect(client.updateComposeCalls).toHaveLength(1);
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

  it('treats resources with secretFiles as changed even when all other fields match', async () => {
    const client = new FakeDokployClient([
      {
        id: 'app_existing',
        name: 'rntme-acme-commerce-catalog',
        image: 'rntme-runtime',
        env: rendered.resources[0].env,
        labels: { 'rntme.workload': 'catalog' },
        files: { '/etc/nginx/nginx.conf': 'events {}' },
      },
    ]);
    const resourceWithSecretFiles = resource({
      files: { '/etc/nginx/nginx.conf': 'events {}' },
      secretFiles: {
        '/etc/nginx/.htpasswd': {
          schema: 'operaton-ui-basic-auth-v1',
          secretRef: 'operaton-ui-basic-auth',
          field: 'htpasswd',
        },
      },
    });
    const r = await applyDokployPlan({ ...rendered, resources: [resourceWithSecretFiles] }, client);

    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(r.value.resources[0]).toMatchObject({
      targetResourceId: 'app_existing',
      action: 'updated',
    });
    expect(client.updateCalls).toHaveLength(1);
  });

  it('includes operatonUiAuthChecks in verification hints when present', async () => {
    const client = new FakeDokployClient();
    const r = await applyDokployPlan(
      {
        ...rendered,
        urls: {
          ...rendered.urls,
          operatonUiAuthChecks: [
            { name: 'operaton-ui-basic-auth', url: 'https://commerce.example.com/operaton/login' },
          ],
        },
      },
      client,
    );

    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(r.value.verificationHints.operatonUiAuthChecks).toEqual([
      { name: 'operaton-ui-basic-auth', url: 'https://commerce.example.com/operaton/login' },
    ]);
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
        'delete-application:app_1',
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

  it('cleans old rntme-managed topology after project stack deploy succeeds', async () => {
    const client = new FakeDokployClient();
    client.oldApplications = [
      {
        id: 'app_old_1',
        name: 'rntme-acme-commerce-catalog',
        // Dokploy's list APIs do not return labels, so the realistic case is
        // an absent label; cleanup must treat that as ours-by-name.
        labels: undefined,
      },
      {
        id: 'app_unmanaged',
        name: 'rntme-acme-commerce-other',
        // A foreign `rntme.managed-by` value is the only veto signal we have
        // when labels happen to be present; cleanup must respect it.
        labels: { 'rntme.managed-by': 'something-else' },
      },
      {
        id: 'app_other_project',
        name: 'rntme-acme-otherproject-thing',
        labels: { 'rntme.managed-by': 'rntme-deploy-dokploy' },
      },
    ];
    client.oldComposes = [
      {
        id: 'compose_old_1',
        name: 'rntme-acme-commerce-event-bus',
        labels: { 'rntme.managed-by': 'rntme-deploy-dokploy' },
      },
      {
        id: 'compose_foreign',
        name: 'rntme-acme-commerce-legacy',
        labels: { 'rntme.managed-by': 'manual-import' },
      },
    ];

    const r = await applyDokployPlan(projectStackRendered(), client);

    expect(r.ok).toBe(true);
    expect(client.lifecycleCalls).toContain('delete-application:app_old_1');
    expect(client.lifecycleCalls).toContain('delete-compose:compose_old_1');
    expect(client.deletedApplications).toContain('app_old_1');
    expect(client.deletedApplications).not.toContain('app_unmanaged');
    expect(client.deletedApplications).not.toContain('app_other_project');
    expect(client.deletedComposes).toContain('compose_old_1');
    expect(client.deletedComposes).not.toContain('compose_foreign');
    expect(client.deletedComposes).not.toContain('compose_1');
  });

  it('isolates per-resource cleanup failures and surfaces them as warnings', async () => {
    const client = new FakeDokployClient();
    client.oldApplications = [
      {
        id: 'app_old_fail',
        name: 'rntme-acme-commerce-catalog',
        labels: { 'rntme.managed-by': 'rntme-deploy-dokploy' },
      },
      {
        id: 'app_old_ok',
        name: 'rntme-acme-commerce-orders',
        labels: { 'rntme.managed-by': 'rntme-deploy-dokploy' },
      },
    ];
    client.failureModes.failDeleteApplicationFor = 'app_old_fail';

    const r = await applyDokployPlan(projectStackRendered(), client);

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // First failure must NOT abort the loop — the second app still gets deleted.
    expect(client.deletedApplications).toContain('app_old_ok');
    expect(client.deletedApplications).toContain('app_old_fail');
    // The cleanup error must surface as a warning so operators can see it.
    expect(r.value.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining('failed to delete legacy application rntme-acme-commerce-catalog (app_old_fail)'),
      ]),
    );
    // The token fixture leaks must still be redacted in warnings.
    expect(JSON.stringify(r.value.warnings)).not.toContain('dokploy-token-secret');
  });

  it('surfaces a warning when listing legacy resources fails', async () => {
    const client = new FakeDokployClient();
    client.failListApplications = true;
    client.oldComposes = [
      {
        id: 'compose_old',
        name: 'rntme-acme-commerce-event-bus',
        labels: { 'rntme.managed-by': 'rntme-deploy-dokploy' },
      },
    ];

    const r = await applyDokployPlan(projectStackRendered(), client);

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // List failure for applications must not block compose cleanup.
    expect(client.deletedComposes).toContain('compose_old');
    expect(r.value.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining('failed to list legacy applications')]),
    );
  });

  it('normalizes org/project slugs when building the cleanup name prefix', async () => {
    const client = new FakeDokployClient();
    // Applied resources were named via `dokployResourceName`, which lower-cases
    // and slugifies. The legacy resource here uses the *normalized* prefix
    // `rntme-acme-corp-commerce-foo-` derived from `Acme_Corp` / `commerce`.
    client.oldApplications = [
      {
        id: 'app_old',
        name: 'rntme-acme-corp-commerce-legacy',
        labels: { 'rntme.managed-by': 'rntme-deploy-dokploy' },
      },
    ];
    const stack: RenderedDokployPlan = {
      ...projectStackRendered(),
      deployment: {
        ...projectStackRendered().deployment,
        orgSlug: 'Acme_Corp',
      },
      resources: projectStackRendered().resources.map((resource) =>
        resource.kind === 'compose' && resource.infrastructureKind === 'project-stack'
          ? { ...resource, name: 'rntme-acme-corp-commerce' }
          : resource,
      ),
    };

    const r = await applyDokployPlan(stack, client);

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // Without normalization the prefix would have been `rntme-Acme_Corp-commerce-`,
    // which would never match the actual lower-cased resource names and the
    // legacy app would survive forever.
    expect(client.deletedApplications).toContain('app_old');
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

function envFoldingPlan(): ProjectDeploymentPlan {
  return {
    project: { orgSlug: 'acme', projectSlug: 'commerce', environment: 'default', mode: 'preview' },
    infrastructure: {
      eventBus: {
        kind: 'kafka',
        mode: 'provisioned',
        provider: 'redpanda',
        resourceName: 'rntme-acme-commerce-event-bus',
        internalBrokers: ['rntme-acme-commerce-event-bus:9092'],
        image: 'docker.redpanda.com/redpandadata/redpanda:v24.3.6',
        persistence: { mode: 'persistent', volumeName: 'rntme-acme-commerce-event-bus-data' },
      },
      objectStorage: { kind: 'none' },
    },
    workloads: [
      {
        kind: 'domain-service',
        slug: 'catalog',
        serviceSlug: 'catalog',
        resourceName: 'rntme-acme-commerce-catalog',
        runtime: { image: 'rntme-runtime' },
        artifact: { source: 'composed-project', serviceSlug: 'catalog' },
        runtimeFiles: { 'manifest.json': '{"service":{"name":"catalog"}}' },
        publicConfigJson: '{}',
        persistence: { mode: 'ephemeral' },
      },
      {
        kind: 'domain-service',
        slug: 'orders',
        serviceSlug: 'orders',
        resourceName: 'rntme-acme-commerce-orders',
        runtime: { image: 'rntme-runtime' },
        artifact: { source: 'composed-project', serviceSlug: 'orders' },
        runtimeFiles: { 'manifest.json': '{"service":{"name":"orders"}}' },
        publicConfigJson: '{}',
        persistence: { mode: 'ephemeral' },
      },
      {
        kind: 'edge-gateway',
        slug: 'edge',
        resourceName: 'rntme-acme-commerce-edge',
        image: 'nginx:1.27-alpine',
      },
    ],
    edge: {
      routes: [
        {
          id: 'http:/api/catalog',
          kind: 'http',
          path: '/api/catalog',
          targetService: 'catalog',
          targetWorkload: 'catalog',
        },
      ],
      middleware: [],
    },
    diagnostics: { warnings: [] },
  };
}

type FakeFailures = {
  failEnvironment?: boolean;
  failFindFor?: string;
  failCreateFor?: string;
  failUpdateFor?: string;
  failConfigureFor?: string;
  failDeployFor?: string;
  failStartFor?: string;
  failDeleteApplicationFor?: string;
  failDeleteComposeFor?: string;
  inspectStatus?: 'running' | 'done' | 'failed' | 'rejected' | 'unknown';
  failMessage?: string;
  includeSecretFixture?: boolean;
};

class FakeDokployClient implements DokployClient {
  private readonly apps = new Map<string, DokployApplication>();
  readonly composeResources = new Map<string, DokployCompose>();
  private readonly composeStackServices = new Map<string, readonly DokployComposeServiceSummary[]>();
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
  oldApplications: DokployApplication[] = [];
  oldComposes: DokployCompose[] = [];
  failListApplications = false;
  failListComposes = false;
  readonly failureModes: FakeFailures;

  private next = 1;

  constructor(
    existing: DokployApplication[] = [],
    existingCompose: DokployCompose[] = [],
    failures: FakeFailures = {},
  ) {
    for (const app of existing) this.apps.set(app.name, app);
    for (const compose of existingCompose) this.composeResources.set(compose.name, compose);
    this.failureModes = failures;
  }

  async ensureEnvironment(
    ref: DokployProjectRef,
    environmentName: string,
  ): Promise<{ environmentId: string }> {
    void ref;
    if (this.failureModes.failEnvironment === true) {
      throw clientError(this.failureModes.failMessage ?? 'environment failed', {
        includeSecretFixture: this.failureModes.includeSecretFixture ?? true,
      });
    }
    return { environmentId: `env_${environmentName}` };
  }

  async findApplicationByName(
    environmentId: string,
    name: string,
  ): Promise<DokployApplication | null> {
    void environmentId;
    if (this.failureModes.failFindFor === name) throw secretError('find failed');
    return this.apps.get(name) ?? null;
  }

  async createApplication(
    environmentId: string,
    input: RenderedDokployResource,
  ): Promise<{ id: string; name: string }> {
    if (this.failureModes.failCreateFor === input.name) throw secretError('create failed');
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
    if (this.failureModes.failUpdateFor === input.name) throw secretError('update failed');
    this.lifecycleCalls.push(`update:${id}:${input.name}`);
    this.updateCalls.push({ applicationId: id, resource: input });
    const app = { id, name: input.name, appName: `${input.name}-dns` };
    this.apps.set(input.name, app);
    return app;
  }

  async configureApplication(id: string, input: RenderedDokployResource): Promise<void> {
    this.lifecycleCalls.push(`configure:${id}:${input.name}`);
    this.configureCalls.push({ applicationId: id, resource: input });
    if (this.failureModes.failConfigureFor === id) throw secretError('configure failed');
  }

  async deployApplication(id: string): Promise<void> {
    this.lifecycleCalls.push(`deploy:${id}`);
    this.deployCalls.push({ applicationId: id });
    if (this.failureModes.failDeployFor === id) throw secretError('deploy failed');
  }

  async startApplication(id: string): Promise<void> {
    this.lifecycleCalls.push(`start:${id}`);
    this.startCalls.push({ applicationId: id });
    if (this.failureModes.failStartFor === id) throw secretError('start failed');
  }

  async inspectApplication(id: string): Promise<{ status: 'running' | 'done' | 'failed' | 'rejected' | 'unknown'; message?: string }> {
    this.lifecycleCalls.push(`inspect:${id}`);
    return {
      status: this.failureModes.inspectStatus ?? 'running',
      message: this.failureModes.inspectStatus === undefined ? undefined : `task ${this.failureModes.inspectStatus}`,
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
    if (resource.services !== undefined) {
      this.composeStackServices.set(
        resource.name,
        resource.services.map((service) => ({
          name: service.name,
          serviceClass: service.serviceClass,
        })),
      );
    }
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

  async configureComposeDomains(
    composeId: string,
    domains: readonly RenderedComposeDomain[],
  ): Promise<void> {
    for (const domain of domains) {
      this.lifecycleCalls.push(
        `configure-compose-domains:${composeId}:${domain.serviceName}:${domain.containerPort}`,
      );
    }
  }

  async startCompose(composeId: string): Promise<void> {
    this.lifecycleCalls.push(`start-compose:${composeId}`);
  }

  async loadComposeServices(
    composeId: string,
  ): Promise<readonly DokployComposeServiceSummary[]> {
    this.lifecycleCalls.push(`load-compose-services:${composeId}`);
    const compose = [...this.composeResources.values()].find((value) => value.id === composeId);
    if (compose === undefined) return [];
    return this.composeStackServices.get(compose.name) ?? [];
  }

  async inspectComposeTasks(
    composeId: string,
    services: readonly DokployComposeServiceSummary[],
  ): Promise<readonly DokployComposeTaskInspection[]> {
    this.lifecycleCalls.push(`inspect-compose-tasks:${composeId}`);
    return services.map((service) => ({
      serviceName: service.name,
      status: 'running',
      failedCount: 0,
    }));
  }

  async deleteApplication(applicationId: string): Promise<void> {
    this.lifecycleCalls.push(`delete-application:${applicationId}`);
    this.deletedApplications.push(applicationId);
    if (this.failureModes.failDeleteApplicationFor === applicationId) throw secretError('delete app failed');
  }

  async deleteCompose(composeId: string): Promise<void> {
    this.lifecycleCalls.push(`delete-compose:${composeId}`);
    this.deletedComposes.push(composeId);
    if (this.failureModes.failDeleteComposeFor === composeId) throw secretError('delete compose failed');
  }

  async listApplications(_environmentId: string): Promise<readonly DokployApplication[]> {
    void _environmentId;
    if (this.failListApplications) throw secretError('list applications failed');
    return this.oldApplications;
  }

  async listComposes(_environmentId: string): Promise<readonly DokployCompose[]> {
    void _environmentId;
    if (this.failListComposes) throw secretError('list composes failed');
    return this.oldComposes;
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
