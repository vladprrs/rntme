import { describe, expect, it } from 'vitest';
import type { ProjectDeploymentPlan } from '@rntme/deploy-core';
import { renderDokployPlan } from '../../src/render.js';

const plan: ProjectDeploymentPlan = {
  project: { orgSlug: 'acme', projectSlug: 'commerce', environment: 'default', mode: 'preview' },
  infrastructure: {
    eventBus: { kind: 'kafka', mode: 'external', brokers: ['redpanda.internal:9092'] },
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
      runtimeFiles: {
        'manifest.json': '{"service":{"name":"catalog"}}',
        'graphs/listCatalog.json': '{"id":"listCatalog"}',
      },
      publicConfigJson: '{}',
      persistence: { mode: 'ephemeral' },
    },
    {
      kind: 'integration-module',
      slug: 'storage-s3',
      serviceSlug: 'storage-s3',
      resourceName: 'rntme-acme-commerce-storage-s3',
      image: 'ghcr.io/acme/storage-s3:test',
      expose: false,
      env: {},
      secretRefs: {},
      modulePackageName: '@rntme/storage-s3',
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

describe('renderDokployPlan', () => {
  it('renders redacted Dokploy resources and digest', () => {
    const r = renderDokployPlan(plan, {
      endpoint: 'https://dokploy.example.com',
      projectId: 'project_123',
      publicBaseUrl: 'https://commerce.example.com',
    });

    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(r.value.deployment).toEqual({
      orgSlug: 'acme',
      projectSlug: 'commerce',
      environment: 'default',
      mode: 'preview',
    });
    expect(r.value.targetProject).toEqual({ mode: 'existing', projectId: 'project_123' });
    expect(r.value.resources).toHaveLength(1);
    const stack = r.value.resources[0];
    expect(stack.kind).toBe('compose');
    if (stack.kind !== 'compose') return;
    expect(stack.services.map((service) => service.name)).toEqual([
      'svc-catalog',
      'mod-storage-s3',
      'edge',
    ]);
    const catalog = stack.services.find((service) => service.name === 'svc-catalog');
    expect(catalog).toMatchObject({
      workloadKind: 'domain-service',
      image: 'rntme-runtime',
      files: {
        '/srv/artifacts/graphs/listCatalog.json': '{"id":"listCatalog"}',
        '/srv/artifacts/manifest.json': '{"service":{"name":"catalog"}}',
        '/srv/config.json': '{}',
      },
    });
    expect(catalog).not.toHaveProperty('build');
    expect(catalog?.env).toContainEqual({
      name: 'RNTME_EVENT_BUS_BROKERS',
      value: 'redpanda.internal:9092',
      secret: false,
    });
    expect(catalog?.env).toContainEqual({
      name: 'RNTME_ARTIFACTS_DIR',
      value: '/srv/artifacts',
      secret: false,
    });
    expect(r.value.digest).toMatch(/^sha256:/);
    expect(JSON.stringify(r.value)).not.toContain('apiToken');
  });

  it('renders provisioned Redpanda as an internal compose resource before applications', () => {
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
    // Compose must attach Redpanda to dokploy-network with a deterministic
    // alias so swarm-service apps can resolve the broker hostname; without
    // this, fresh provisioned deploys fail at boot with `getaddrinfo
    // ENOTFOUND` on the broker host.
    expect(redpanda.composeFile).toContain('dokploy-network');
    expect(redpanda.composeFile).toContain(
      '--advertise-kafka-addr=internal://rntme-acme-commerce-event-bus:9092',
    );
    expect(redpanda.composeFile).toMatch(/networks:\s*\n\s*dokploy-network:\s*\n\s*external: true/);
    expect(redpanda.composeFile).toMatch(
      /services:[\s\S]*redpanda:[\s\S]*networks:\s*\n\s*default:\s*\n\s*dokploy-network:\s*\n\s*aliases:\s*\n\s*- rntme-acme-commerce-event-bus/,
    );

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

  it('renders Redpanda Console behind a public basic-auth proxy without secret material', () => {
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
            persistence: {
              mode: 'persistent',
              volumeName: 'rntme-acme-commerce-event-bus-data',
            },
          },
          manualAccess: {
            redpandaConsole: {
              kind: 'redpanda-console',
              resourceName: 'rntme-acme-commerce-redpanda-console',
              proxyResourceName: 'rntme-acme-commerce-redpanda-console-proxy',
              internalUrl: 'http://rntme-acme-commerce-redpanda-console:8080',
              image: 'docker.redpanda.com/redpandadata/console:v3.7.2',
              publicBaseUrl: 'https://console-commerce.example.com',
              basicAuthUsername: 'operator',
              htpasswdSecretRef: 'console-basic-auth',
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

    expect(r.value.urls.redpandaConsoleUrl).toBe('https://console-commerce.example.com');
    expect(r.value.resources.map((resource) => resource.name)).toEqual([
      'rntme-acme-commerce-event-bus',
      'rntme-acme-commerce-redpanda-console',
      'rntme-acme-commerce-redpanda-console-proxy',
      'rntme-acme-commerce-catalog',
      'rntme-acme-commerce-storage-s3',
      'rntme-acme-commerce-edge',
    ]);

    const consoleApp = r.value.resources.find(
      (resource) => resource.kind === 'application' && resource.infrastructureKind === 'redpanda-console',
    );
    expect(consoleApp).toMatchObject({
      image: 'docker.redpanda.com/redpandadata/console:v3.7.2',
      env: expect.arrayContaining([
        { name: 'KAFKA_BROKERS', value: 'rntme-acme-commerce-event-bus:9092', secret: false },
      ]),
      labels: expect.objectContaining({
        'rntme.infrastructure': 'redpanda-console',
        'rntme.access': 'internal',
      }),
    });
    expect(consoleApp).not.toHaveProperty('ingress');
    expect(consoleApp).not.toHaveProperty('ports');

    const proxy = r.value.resources.find(
      (resource) => resource.kind === 'application' && resource.infrastructureKind === 'redpanda-console-proxy',
    );
    expect(proxy).toMatchObject({
      image: 'nginx:1.27-alpine',
      command: '/bin/sh',
      args: ['/docker-entrypoint-rntme.sh'],
      ingress: {
        publicBaseUrl: 'https://console-commerce.example.com',
        containerPort: 8080,
      },
      env: [{ name: 'RNTME_CONSOLE_HTPASSWD_B64', value: 'console-basic-auth', secret: true }],
      labels: expect.objectContaining({
        'rntme.infrastructure': 'redpanda-console-proxy',
        'rntme.access': 'public',
      }),
    });
    expect(proxy?.files?.['/etc/nginx/nginx.conf']).toContain('auth_basic_user_file /etc/nginx/.htpasswd');
    expect(proxy?.files?.['/etc/nginx/nginx.conf']).toContain('proxy_set_header Authorization "";');
    expect(JSON.stringify(r.value)).not.toContain('$apr1$');
    expect(JSON.stringify(r.value)).not.toContain('plaintext-password');
  });

  it('renders provisioned RustFS compose, public proxy, and storage-s3 env', () => {
    const r = renderDokployPlan(
      {
        ...plan,
        infrastructure: {
          ...plan.infrastructure,
          objectStorage: {
            kind: 's3-compatible',
            mode: 'provisioned',
            provider: 'rustfs',
            resourceName: 'rntme-acme-commerce-storage',
            internalEndpoint: 'http://rntme-acme-commerce-storage:9000',
            publicBaseUrl: 'https://storage.example.test',
            bucketName: 'rntme-acme-commerce-default-storage',
            region: 'us-east-1',
            forcePathStyle: true,
            image: 'rustfs/rustfs:1.0.0',
            credentials: {
              accessKeyRef: 'RUSTFS_ACCESS_KEY',
              secretKeyRef: 'RUSTFS_SECRET_KEY',
            },
            persistence: {
              mode: 'persistent',
              volumeName: 'rntme-acme-commerce-storage-data',
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
    expect(r.value.resources.map((resource) => `${resource.kind}:${resource.logicalId}`)).toEqual([
      'compose:object-storage',
      'application:object-storage-public',
      'application:catalog',
      'application:storage-s3',
      'application:edge',
    ]);

    const rustfs = r.value.resources[0];
    expect(rustfs).toMatchObject({
      kind: 'compose',
      infrastructureKind: 'object-storage',
      name: 'rntme-acme-commerce-storage',
      image: 'rustfs/rustfs:1.0.0',
      labels: {
        'rntme.infrastructure': 'object-storage',
        'rntme.provider': 'rustfs',
      },
    });
    if (rustfs.kind !== 'compose') return;
    expect(rustfs.env).toEqual([
      { name: 'RUSTFS_ACCESS_KEY', value: 'RUSTFS_ACCESS_KEY', secret: true },
      { name: 'RUSTFS_SECRET_KEY', value: 'RUSTFS_SECRET_KEY', secret: true },
    ]);
    expect(rustfs.composeFile).toContain('rustfs/rustfs:1.0.0');
    expect(rustfs.composeFile).toContain('rntme-acme-commerce-storage-data');
    expect(rustfs.composeFile).toContain('dokploy-network');

    const proxy = r.value.resources.find((resource) => resource.logicalId === 'object-storage-public');
    expect(proxy).toMatchObject({
      kind: 'application',
      workloadKind: 'infrastructure-proxy',
      name: 'rntme-acme-commerce-storage-public',
      image: 'nginx:1.27-alpine',
      ingress: {
        publicBaseUrl: 'https://storage.example.test',
        containerPort: 8080,
        healthPath: '/health',
      },
    });
    expect(proxy?.files?.['/etc/nginx/nginx.conf']).toContain('proxy_pass http://rntme-acme-commerce-storage:9000');

    const storageModule = r.value.resources.find((resource) => resource.logicalId === 'storage-s3');
    expect(storageModule?.env).toContainEqual({
      name: 'STORAGE_S3_ENDPOINT',
      value: 'http://rntme-acme-commerce-storage:9000',
      secret: false,
    });
    expect(storageModule?.env).toContainEqual({
      name: 'STORAGE_S3_PUBLIC_ENDPOINT',
      value: 'https://storage.example.test',
      secret: false,
    });
    expect(storageModule?.env).toContainEqual({
      name: 'STORAGE_S3_ACCESS_KEY_ID',
      value: 'RUSTFS_ACCESS_KEY',
      secret: true,
    });
    expect(storageModule?.env).toContainEqual({
      name: 'STORAGE_S3_APP_ORIGINS',
      value: 'https://commerce.example.com',
      secret: false,
    });
  });

  it('omits Kafka runtime env when the plan uses an in-memory event bus', () => {
    const r = renderDokployPlan(
      {
        ...plan,
        infrastructure: {
          ...plan.infrastructure,
          eventBus: { kind: 'memory', mode: 'in-memory' },
        },
      } as ProjectDeploymentPlan,
      {
        endpoint: 'https://dokploy.example.com',
        projectId: 'project_123',
        publicBaseUrl: 'https://commerce.example.com',
      },
    );

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.resources).toHaveLength(1);
    const stack = r.value.resources[0];
    expect(stack.kind).toBe('compose');
    if (stack.kind !== 'compose') return;
    const domain = stack.services.find((service) => service.workloadKind === 'domain-service');
    const envNames = domain?.env.map((env) => env.name) ?? [];
    expect(envNames).not.toContain('RNTME_EVENT_BUS_BROKERS');
    expect(envNames).not.toContain('RNTME_EVENT_BUS_PROTOCOL');
  });

  it('renders edge gateway port and public ingress metadata', () => {
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
    const edge = stack.services.find((service) => service.workloadKind === 'edge-gateway');
    expect(edge).toMatchObject({
      workloadKind: 'edge-gateway',
      files: {
        '/srv/config.json': '{}',
      },
      ports: [8080],
    });
    expect(stack.domains).toEqual([
      {
        host: 'commerce.example.com',
        path: '/',
        serviceName: 'edge',
        containerPort: 8080,
        https: true,
      },
    ]);
    expect(r.value.urls.publicRoutes).toEqual([
      { routeId: 'http:/api/catalog', url: 'https://commerce.example.com/api/catalog' },
    ]);
  });

  it('rejects missing Dokploy project identity when creation is disabled', () => {
    const r = renderDokployPlan(plan, {
      endpoint: 'https://dokploy.example.com',
      publicBaseUrl: 'https://commerce.example.com',
    });

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toContainEqual(
        expect.objectContaining({ code: 'DEPLOY_RENDER_DOKPLOY_MISSING_PROJECT' }),
      );
    }
  });

  it('returns an error result when Nginx rendering rejects the edge config', () => {
    const r = renderDokployPlan(
      {
        ...plan,
        edge: {
          routes: [
            {
              id: 'http:/api/catalog',
              kind: 'http',
              path: '/api/catalog; return 200',
              targetService: 'catalog',
              targetWorkload: 'catalog',
            },
          ],
          middleware: [],
        },
      },
      {
        endpoint: 'https://dokploy.example.com',
        projectId: 'project_123',
        publicBaseUrl: 'https://commerce.example.com',
      },
    );

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toContainEqual(
        expect.objectContaining({ code: 'DEPLOY_RENDER_DOKPLOY_INVALID_NGINX_CONFIG' }),
      );
    }
  });

  it('rejects domain services without runtime artifact files', () => {
    const r = renderDokployPlan(
      {
        ...plan,
        workloads: [
          {
            kind: 'domain-service',
            slug: 'catalog',
            serviceSlug: 'catalog',
            resourceName: 'rntme-acme-commerce-catalog',
            runtime: { image: 'rntme-runtime' },
            artifact: { source: 'composed-project', serviceSlug: 'catalog' },
            runtimeFiles: {},
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
      },
      {
        endpoint: 'https://dokploy.example.com',
        projectId: 'project_123',
        publicBaseUrl: 'https://commerce.example.com',
      },
    );

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toContainEqual(
        expect.objectContaining({
          code: 'DEPLOY_RENDER_DOKPLOY_MISSING_RUNTIME_FILES',
          resource: 'rntme-acme-commerce-catalog',
        }),
      );
    }
  });

  it('joins trailing slash public base URLs and root UI routes without double slashes', () => {
    const r = renderDokployPlan(
      {
        ...plan,
        edge: {
          routes: [
            {
              id: 'ui:/',
              kind: 'ui',
              path: '/',
              targetService: 'catalog',
              targetWorkload: 'catalog',
            },
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
      },
      {
        endpoint: 'https://dokploy.example.com',
        projectId: 'project_123',
        publicBaseUrl: 'https://commerce.example.com/',
      },
    );

    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(r.value.urls.projectUrl).toBe('https://commerce.example.com');
    expect(r.value.urls.uiUrl).toBe('https://commerce.example.com/');
    expect(r.value.urls.publicRoutes).toEqual([
      { routeId: 'http:/api/catalog', url: 'https://commerce.example.com/api/catalog' },
    ]);
  });

  it('sorts integration module env and secret refs for stable rendering', () => {
    const integrationPlan: ProjectDeploymentPlan = {
      ...plan,
      workloads: [
        {
          kind: 'integration-module',
          slug: 'payments',
          serviceSlug: 'payments',
          resourceName: 'rntme-acme-commerce-payments',
          image: 'payments:latest',
          expose: false,
          env: { Z_VAR: 'z', A_VAR: 'a' },
          secretRefs: { Z_SECRET: 'secret/z', A_SECRET: 'secret/a' },
        },
        {
          kind: 'edge-gateway',
          slug: 'edge',
          resourceName: 'rntme-acme-commerce-edge',
          image: 'nginx:1.27-alpine',
        },
      ],
    };

    const r = renderDokployPlan(integrationPlan, {
      endpoint: 'https://dokploy.example.com',
      projectId: 'project_123',
      publicBaseUrl: 'https://commerce.example.com',
    });

    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const stack = r.value.resources[0];
    expect(stack.kind).toBe('compose');
    if (stack.kind !== 'compose') return;
    const moduleService = stack.services.find((service) => service.name === 'mod-payments');
    expect(moduleService?.env).toEqual([
      { name: 'A_VAR', value: 'a', secret: false },
      { name: 'Z_VAR', value: 'z', secret: false },
      { name: 'A_SECRET', value: 'secret/a', secret: true },
      { name: 'Z_SECRET', value: 'secret/z', secret: true },
    ]);
  });

  it('exposes ports 50051 and 50052 on integration-module workloads', () => {
    const integrationPlan: ProjectDeploymentPlan = {
      ...plan,
      workloads: [
        {
          kind: 'integration-module',
          slug: 'identity-auth0',
          serviceSlug: 'identity-auth0',
          resourceName: 'rntme-acme-commerce-identity-auth0',
          image: 'identity-auth0:latest',
          expose: false,
          env: { AUTH0_DOMAIN: 'tenant.us.auth0.com' },
          secretRefs: {},
        },
        {
          kind: 'edge-gateway',
          slug: 'edge',
          resourceName: 'rntme-acme-commerce-edge',
          image: 'nginx:1.27-alpine',
        },
      ],
    };

    const r = renderDokployPlan(integrationPlan, {
      endpoint: 'https://dokploy.example.com',
      projectId: 'project_123',
      publicBaseUrl: 'https://commerce.example.com',
    });

    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const stack = r.value.resources[0];
    expect(stack.kind).toBe('compose');
    if (stack.kind !== 'compose') return;
    const moduleRes = stack.services.find((service) => service.workloadKind === 'integration-module');
    expect(moduleRes).toBeDefined();
    expect(moduleRes?.ports).toEqual([50051, 50052]);
  });

  it('renders create target project when allowed', () => {
    const r = renderDokployPlan(plan, {
      endpoint: 'https://dokploy.example.com',
      projectName: 'commerce-default',
      allowCreateProject: true,
      publicBaseUrl: 'https://commerce.example.com',
    });

    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(r.value.targetProject).toEqual({
      mode: 'create',
      projectName: 'commerce-default',
    });
  });

  it('renders SASL event bus env, auth env, and composed public config for authed domain workloads', () => {
    const publicConfig = {
      '@rntme/identity-auth0': {
        domain: 'tenant.us.auth0.com',
        clientId: 'auth0-public-client-id',
        audience: 'https://commerce.example.com/api',
        redirectUri: 'https://commerce.example.com',
      },
    };
    const authPlan: ProjectDeploymentPlan = {
      ...plan,
      infrastructure: {
        ...plan.infrastructure,
        eventBus: {
          kind: 'kafka',
          mode: 'external',
          brokers: ['redpanda.example.com:9092'],
          topicPrefix: 'rntme.notes',
          security: {
            protocol: 'sasl_ssl',
            mechanism: 'scram-sha-512',
            secretRefs: {
              username: 'RNTME_EVENT_BUS_USERNAME',
              password: 'RNTME_EVENT_BUS_PASSWORD',
            },
          },
        },
        auth: {
          auth0: {
            clientId: 'auth0-public-client-id',
          },
        },
      },
      workloads: [
        {
          kind: 'domain-service',
          slug: 'app',
          serviceSlug: 'app',
          resourceName: 'rntme-acme-commerce-app',
          runtime: { image: 'rntme-runtime' },
          artifact: { source: 'composed-project', serviceSlug: 'app' },
          runtimeFiles: { 'manifest.json': '{"service":{"name":"app"}}' },
          publicConfigJson: JSON.stringify(publicConfig),
          persistence: { mode: 'ephemeral' },
        },
        {
          kind: 'integration-module',
          slug: 'identity-auth0',
          serviceSlug: 'identity-auth0',
          resourceName: 'rntme-acme-commerce-identity-auth0',
          image: 'identity-auth0:latest',
          expose: false,
          env: { AUTH0_DOMAIN: 'tenant.us.auth0.com' },
          secretRefs: {},
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
            id: 'ui:/',
            kind: 'ui',
            path: '/',
            targetService: 'app',
            targetWorkload: 'app',
          },
          {
            id: 'http:/api',
            kind: 'http',
            path: '/api',
            targetService: 'app',
            targetWorkload: 'app',
          },
        ],
        middleware: [
          {
            mountTarget: 'http:/api',
            name: 'auth',
            kind: 'auth',
            provider: 'auth0',
            audience: 'https://commerce.example.com/api',
            moduleSlug: 'identity-auth0',
          },
        ],
      },
    };

    const r = renderDokployPlan(authPlan, {
      endpoint: 'https://dokploy.example.com',
      projectId: 'project_123',
      publicBaseUrl: 'https://commerce.example.com',
    });

    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const stack = r.value.resources[0];
    expect(stack.kind).toBe('compose');
    if (stack.kind !== 'compose') return;
    const app = stack.services.find((service) => service.workloadSlug === 'app');
    expect(app?.env).toEqual(
      expect.arrayContaining([
        { name: 'RNTME_EVENT_BUS_PROTOCOL', value: 'sasl_ssl', secret: false },
        { name: 'RNTME_EVENT_BUS_MECHANISM', value: 'scram-sha-512', secret: false },
        { name: 'RNTME_EVENT_BUS_USERNAME', value: 'RNTME_EVENT_BUS_USERNAME', secret: true },
        { name: 'RNTME_EVENT_BUS_PASSWORD', value: 'RNTME_EVENT_BUS_PASSWORD', secret: true },
        { name: 'RNTME_EVENT_BUS_TOPIC_PREFIX', value: 'rntme.notes', secret: false },
        { name: 'RNTME_AUTH_PROVIDER', value: 'auth0', secret: false },
        { name: 'RNTME_AUTH_AUDIENCE', value: 'https://commerce.example.com/api', secret: false },
        { name: 'RNTME_AUTH_MODULE_SLUG', value: 'identity-auth0', secret: false },
        {
          name: 'RNTME_AUTH_MODULE_ENDPOINT',
          value: 'rntme-acme-commerce-identity-auth0:50051',
          secret: false,
        },
      ]),
    );
    expect(JSON.stringify(app?.env)).not.toContain('scram-password');

    expect(app?.files?.['/srv/config.json']).toBeDefined();
    expect(JSON.parse(app?.files?.['/srv/config.json'] ?? '{}')).toEqual(publicConfig);
    expect(JSON.parse(app?.files?.['/srv/config.json'] ?? '{}')).not.toHaveProperty('auth0');
    expect(JSON.parse(app?.files?.['/srv/config.json'] ?? '{}')).not.toHaveProperty('runtime');

    const edge = stack.services.find((service) => service.workloadKind === 'edge-gateway');
    expect(JSON.parse(edge?.files?.['/srv/config.json'] ?? '{}')).toEqual(publicConfig);
  });

  it('emits protected notes API smoke hints when an auth-protected /api route exists', () => {
    const r = renderDokployPlan(authProtectedPlan(), targetConfig());

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.urls.publicRoutes).toEqual([]);
    expect(r.value.urls.protectedRouteChecks).toEqual([
      { name: 'protected-api-get-notes', method: 'GET', url: 'https://commerce.example.com/api/notes' },
      { name: 'protected-api-post-notes', method: 'POST', url: 'https://commerce.example.com/api/notes' },
    ]);
  });

  it('routes edge auth introspection to the integration module HTTP port', () => {
    const r = renderDokployPlan(authProtectedPlan(), targetConfig());

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const stack = r.value.resources[0];
    expect(stack.kind).toBe('compose');
    if (stack.kind !== 'compose') return;
    const edge = stack.services.find((service) => service.workloadKind === 'edge-gateway');
    const nginx = edge?.files?.['/etc/nginx/nginx.conf'] ?? '';
    expect(nginx).toMatch(/upstream rntme_auth_identity-auth0__[0-9a-f]{8}\s*\{/);
    expect(nginx).toContain('server rntme-acme-commerce-identity-auth0:50052;');
    expect(nginx).not.toContain('server rntme-acme-commerce-identity-auth0:3000;');
  });

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

  it('rejects target resource name collisions after normalization', () => {
    // In the single-stack model the only top-level Dokploy resource is the
    // project-stack compose. Workloads whose slugs differ only by normalization
    // (e.g. `billing-api` vs `billing_api`) now coexist as distinct compose
    // services (`svc-billing-api`, `svc-billing_api`). Top-level collision
    // detection no longer fires for this input. Stack-internal service-name
    // collision detection is a Task 7 concern; this test currently asserts
    // the new behaviour to keep the regression net wired up.
    const r = renderDokployPlan(
      {
        ...plan,
        workloads: [
          {
            kind: 'domain-service',
            slug: 'billing-api',
            serviceSlug: 'billing-api',
            resourceName: 'rntme-acme-commerce-billing-api',
            runtime: { image: 'rntme-runtime' },
            artifact: { source: 'composed-project', serviceSlug: 'billing-api' },
            runtimeFiles: { 'manifest.json': '{}' },
            publicConfigJson: '{}',
            persistence: { mode: 'ephemeral' },
          },
          {
            kind: 'domain-service',
            slug: 'billing_api',
            serviceSlug: 'billing_api',
            resourceName: 'rntme-acme-commerce-billing_api',
            runtime: { image: 'rntme-runtime' },
            artifact: { source: 'composed-project', serviceSlug: 'billing_api' },
            runtimeFiles: { 'manifest.json': '{}' },
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
      },
      {
        endpoint: 'https://dokploy.example.com',
        projectId: 'project_123',
        publicBaseUrl: 'https://commerce.example.com',
      },
    );

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.resources).toHaveLength(1);
    const stack = r.value.resources[0];
    expect(stack.kind).toBe('compose');
    if (stack.kind !== 'compose') return;
    expect(stack.services.map((service) => service.name).sort()).toEqual([
      'edge',
      'svc-billing-api',
      'svc-billing_api',
    ]);
  });
});

function targetConfig() {
  return {
    endpoint: 'https://dokploy.example.com',
    projectId: 'project_123',
    allowCreateProject: false,
    publicBaseUrl: 'https://commerce.example.com',
  };
}

describe('renderDokployPlan — provisioner outputs', () => {
  const baseProvisioned = new Map([
    [
      'identity-auth0',
      {
        projectKey: 'identity-auth0',
        packageName: '@rntme/identity-auth0',
        publicOutputs: { spaClient: { id: 'cid_xyz', name: 'app' } },
        secretOutputs: { m2mClients: [{ name: 'introspect', clientId: 'mid', clientSecret: 'sss' }] },
        provisionedAt: '2026-05-03T00:00:00Z',
      },
    ],
  ]);

  it('bakes a public output into env on the target resource', () => {
    const rendered = renderDokployPlan(authProtectedPlan(), targetConfig(), baseProvisioned, {
      'identity-auth0': [
        { from: 'spaClient.id', envName: 'AUTH0_SPA_CLIENT_ID', secret: false, target: 'app' },
      ],
    });
    expect(rendered.ok).toBe(true);
    if (!rendered.ok) return;
    const stack = rendered.value.resources[0];
    expect(stack.kind).toBe('compose');
    if (stack.kind !== 'compose') return;
    const appResource = stack.services.find((service) => service.workloadSlug === 'app');
    expect(appResource?.env).toContainEqual({ name: 'AUTH0_SPA_CLIENT_ID', value: 'cid_xyz', secret: false });
  });

  it('bakes a secret output as secret env on the target resource', () => {
    const rendered = renderDokployPlan(authProtectedPlan(), targetConfig(), baseProvisioned, {
      'identity-auth0': [
        { from: 'm2mClients.*.clientSecret', envName: 'AUTH0_M2M_${name}_CLIENT_SECRET', secret: true, target: 'identity-auth0' },
      ],
    });
    expect(rendered.ok).toBe(true);
    if (!rendered.ok) return;
    const stack = rendered.value.resources[0];
    expect(stack.kind).toBe('compose');
    if (stack.kind !== 'compose') return;
    const idResource = stack.services.find((service) => service.workloadSlug === 'identity-auth0');
    expect(idResource?.env).toContainEqual({ name: 'AUTH0_M2M_INTROSPECT_CLIENT_SECRET', value: 'sss', secret: true });
  });

  it('digest changes when a provisioned value changes', () => {
    const a = renderDokployPlan(authProtectedPlan(), targetConfig(), baseProvisioned, {
      'identity-auth0': [{ from: 'spaClient.id', envName: 'AUTH0_SPA_CLIENT_ID', secret: false, target: 'app' }],
    });
    const otherProvisioned = new Map([
      [
        'identity-auth0',
        { ...baseProvisioned.get('identity-auth0')!, publicOutputs: { spaClient: { id: 'changed', name: 'app' } } },
      ],
    ]);
    const b = renderDokployPlan(authProtectedPlan(), targetConfig(), otherProvisioned, {
      'identity-auth0': [{ from: 'spaClient.id', envName: 'AUTH0_SPA_CLIENT_ID', secret: false, target: 'app' }],
    });
    if (!a.ok || !b.ok) throw new Error('renders did not succeed');
    expect(a.value.digest).not.toBe(b.value.digest);
  });

  it('skips mapping for modules absent from the provisioned map', () => {
    const rendered = renderDokployPlan(authProtectedPlan(), targetConfig(), new Map(), {
      'identity-auth0': [{ from: 'spaClient.id', envName: 'X', secret: false, target: 'app' }],
    });
    expect(rendered.ok).toBe(true);
    if (!rendered.ok) return;
    const appResource = rendered.value.resources.find((r) => r.workloadSlug === 'app');
    expect(appResource?.env.find((e) => e.name === 'X')).toBeUndefined();
  });
});

function authProtectedPlan(): ProjectDeploymentPlan {
  return {
    project: { orgSlug: 'acme', projectSlug: 'commerce', environment: 'default', mode: 'preview' },
    infrastructure: {
      eventBus: { kind: 'kafka', mode: 'external', brokers: ['redpanda:9092'] },
      objectStorage: { kind: 'none' },
    },
    workloads: [
      {
        kind: 'domain-service',
        slug: 'app',
        serviceSlug: 'app',
        resourceName: 'rntme-acme-commerce-app',
        runtime: { image: 'rntme-runtime' },
        artifact: { source: 'composed-project', serviceSlug: 'app' },
        runtimeFiles: { 'manifest.json': '{}' },
        publicConfigJson: '{}',
        persistence: { mode: 'ephemeral' },
      },
      {
        kind: 'integration-module',
        slug: 'identity-auth0',
        serviceSlug: 'identity-auth0',
        resourceName: 'rntme-acme-commerce-identity-auth0',
        image: 'identity-auth0:test',
        expose: false,
        env: { AUTH0_DOMAIN: 'tenant.us.auth0.com' },
        secretRefs: {},
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
        { id: 'http:/api', kind: 'http', path: '/api', targetService: 'app', targetWorkload: 'app' },
      ],
      middleware: [
        {
          mountTarget: 'http:/api',
          name: 'auth',
          kind: 'auth',
          provider: 'auth0',
          audience: 'https://commerce.example.com/api',
          moduleSlug: 'identity-auth0',
          moduleIntrospectPort: 50052,
        },
      ],
    },
    diagnostics: { warnings: [] },
  };
}
