import { describe, expect, it } from 'vitest';
import type { ProjectDeploymentPlan } from '@rntme/deploy-core';
import { renderDokployPlan } from '../../src/render.js';

const plan: ProjectDeploymentPlan = {
  project: { orgSlug: 'acme', projectSlug: 'commerce', environment: 'default', mode: 'preview' },
  infrastructure: {
    eventBus: { kind: 'kafka', mode: 'external', brokers: ['redpanda.internal:9092'] },
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
    expect(r.value.resources.map((resource) => resource.name)).toEqual([
      'rntme-acme-commerce-catalog',
      'rntme-acme-commerce-edge',
    ]);
    expect(r.value.resources[0]).toMatchObject({
      kind: 'application',
      workloadKind: 'domain-service',
      image: 'rntme-runtime',
      files: {
        '/srv/artifacts/graphs/listCatalog.json': '{"id":"listCatalog"}',
        '/srv/artifacts/manifest.json': '{"service":{"name":"catalog"}}',
        '/srv/config.json': '{}',
      },
    });
    expect(r.value.resources[0]).not.toHaveProperty('build');
    expect(r.value.resources[0].env).toContainEqual({
      name: 'RNTME_EVENT_BUS_BROKERS',
      value: 'redpanda.internal:9092',
      secret: false,
    });
    expect(r.value.resources[0].env).toContainEqual({
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

  it('omits Kafka runtime env when the plan uses an in-memory event bus', () => {
    const r = renderDokployPlan(
      {
        ...plan,
        infrastructure: {
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
    expect(r.value.resources.map((resource) => resource.kind)).toEqual(['application', 'application']);
    const domain = r.value.resources.find((resource) => resource.workloadKind === 'domain-service');
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

    expect(r.value.resources[1]).toMatchObject({
      kind: 'application',
      workloadKind: 'edge-gateway',
      files: {
        '/srv/config.json': '{}',
      },
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

    expect(r.value.urls.projectUrl).toBe('https://commerce.example.com/');
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

    expect(r.value.resources[0].env).toEqual([
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

    const moduleRes = r.value.resources.find((res) => res.workloadKind === 'integration-module');
    expect(moduleRes).toBeDefined();
    expect(moduleRes?.ports).toEqual([
      { containerPort: 50051, protocol: 'http' },
      { containerPort: 50052, protocol: 'http' },
    ]);
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

    const app = r.value.resources.find((resource) => resource.workloadSlug === 'app');
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

    const edge = r.value.resources.find((resource) => resource.workloadKind === 'edge-gateway');
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
    const edge = r.value.resources.find((res) => res.workloadKind === 'edge-gateway');
    const nginx = edge?.files?.['/etc/nginx/nginx.conf'] ?? '';
    expect(nginx).toMatch(/upstream rntme_auth_identity-auth0__[0-9a-f]{8}\s*\{/);
    expect(nginx).toContain('server rntme-acme-commerce-identity-auth0:50052;');
    expect(nginx).not.toContain('server rntme-acme-commerce-identity-auth0:3000;');
  });

  it('rejects target resource name collisions after normalization', () => {
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

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toContainEqual(
        expect.objectContaining({
          code: 'DEPLOY_RENDER_DOKPLOY_NAME_COLLISION',
          resource: 'rntme-acme-commerce-billing-api',
        }),
      );
    }
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
    const appResource = rendered.value.resources.find((r) => r.workloadSlug === 'app');
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
    const idResource = rendered.value.resources.find((r) => r.workloadSlug === 'identity-auth0');
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
    infrastructure: { eventBus: { kind: 'kafka', mode: 'external', brokers: ['redpanda:9092'] } },
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
