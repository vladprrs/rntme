import { describe, expect, it } from 'bun:test';
import { Buffer } from 'node:buffer';
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
        'ui-build/main.js': 'console.log("prebuilt ui")',
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
      runtimeFiles: { 'storage.json': '{"version":"1.0","routes":{}}' },
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
    const storage = stack.services.find((service) => service.name === 'mod-storage-s3');
    expect(storage?.files?.['/srv/storage.json']).toBe('{"version":"1.0","routes":{}}');
    expect(storage?.literalEnv?.RNTME_FILE_MOUNTS_DIGEST).toMatch(/^sha256:/);
    expect(stack.composeFile).toContain('/srv/storage.json:ro');
    const manifestVolume = catalog?.volumes?.find((volume) => volume.target === '/srv/artifacts/manifest.json');
    expect(manifestVolume?.source).toMatch(
      /^\/etc\/dokploy\/compose\/\$\{APP_NAME\}\/files\/svc-catalog\/srv\/artifacts\/manifest\.json\.rntme-sha256-[a-f0-9]{16}$/,
    );
    expect(manifestVolume?.readOnly).toBe(true);
    const manifestMount = stack.fileMounts?.find((mount) =>
      /^\/__rntme_mounts\/svc-catalog\/srv\/artifacts\/manifest\.json\.rntme-sha256-[a-f0-9]{16}$/.test(mount.mountPath),
    );
    expect(manifestMount?.filePath).toMatch(/^svc-catalog\/srv\/artifacts\/manifest\.json\.rntme-sha256-[a-f0-9]{16}$/);
    expect(manifestMount?.content).toBe('{"service":{"name":"catalog"}}');
    expect(catalog?.files?.['/srv/artifacts/ui-build/main.js']).toBe('console.log("prebuilt ui")');
    const uiBuildMount = stack.fileMounts?.find((mount) =>
      /^\/__rntme_mounts\/svc-catalog\/srv\/artifacts\/ui-build\/main\.js\.rntme-sha256-[a-f0-9]{16}$/.test(mount.mountPath),
    );
    expect(uiBuildMount?.filePath).toMatch(/^svc-catalog\/srv\/artifacts\/ui-build\/main\.js\.rntme-sha256-[a-f0-9]{16}$/);
    expect(uiBuildMount?.content).toBe('console.log("prebuilt ui")');
    expect(stack.composeFile).toContain('/srv/artifacts/ui-build/main.js');
    expect(catalog?.literalEnv?.RNTME_FILE_MOUNTS_DIGEST).toMatch(/^sha256:/);
    const edge = stack.services.find((service) => service.name === 'edge');
    expect(edge?.literalEnv?.RNTME_FILE_MOUNTS_DIGEST).toMatch(/^sha256:/);
    expect(stack.composeFile).toContain('RNTME_FILE_MOUNTS_DIGEST: sha256:');
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

  it('renders persistent domain-service SQLite paths and a writable data volume', () => {
    const r = renderDokployPlan(
      {
        ...plan,
        workloads: [
          {
            kind: 'domain-service',
            slug: 'tokens',
            serviceSlug: 'tokens',
            resourceName: 'rntme-acme-commerce-tokens',
            runtime: { image: 'rntme-runtime' },
            artifact: { source: 'composed-project', serviceSlug: 'tokens' },
            runtimeFiles: { 'manifest.json': '{"service":{"name":"tokens"}}' },
            publicConfigJson: '{}',
            persistence: {
              mode: 'persistent',
              volumeName: 'rntme-acme-commerce-tokens-data',
              mountPath: '/srv/data',
              eventStorePath: '/srv/data/events.sqlite',
              qsmPath: '/srv/data/qsm.sqlite',
            },
          } as never,
          ...plan.workloads.filter((w) => w.kind !== 'domain-service'),
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
    const stack = r.value.resources[0];
    expect(stack.kind).toBe('compose');
    if (stack.kind !== 'compose') return;
    const tokens = stack.services.find((service) => service.name === 'svc-tokens');
    expect(tokens?.env).toEqual(
      expect.arrayContaining([
        { name: 'RNTME_EVENT_STORE_PATH', value: '/srv/data/events.sqlite', secret: false },
        { name: 'RNTME_QSM_PATH', value: '/srv/data/qsm.sqlite', secret: false },
      ]),
    );
    expect(tokens?.literalEnv?.RNTME_PERSISTENCE_MODE).toBe('persistent');
    expect(tokens?.volumes).toContainEqual({
      source: 'rntme-acme-commerce-tokens-data',
      target: '/srv/data',
      readOnly: false,
    });
    expect(tokens?.user).toBe('0:0');
    expect(stack.composeFile).toContain('rntme-acme-commerce-tokens-data:/srv/data');
    expect(stack.composeFile).toContain('volumes:\n  rntme-acme-commerce-tokens-data: {}\n');
    expect(stack.composeFile).toContain('    user: 0:0');
  });

  it('renders oversized runtime artifacts through chunked bootstrap mounts', () => {
    const largeArtifact = 'x'.repeat(1_200_000);
    const r = renderDokployPlan(
      {
        ...plan,
        workloads: plan.workloads.map((workload) =>
          workload.kind === 'domain-service'
            ? {
                ...workload,
                runtimeFiles: {
                  ...workload.runtimeFiles,
                  'ui-build/chunks/large.js': largeArtifact,
                },
              }
            : workload,
        ),
      },
      {
        endpoint: 'https://dokploy.example.com',
        projectId: 'project_123',
        publicBaseUrl: 'https://commerce.example.com',
      },
    );

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const stack = r.value.resources[0];
    expect(stack.kind).toBe('compose');
    if (stack.kind !== 'compose') return;
    const catalog = stack.services.find((service) => service.name === 'svc-catalog');
    expect(catalog?.entrypoint).toEqual(['/bin/sh', '/srv/rntme-bootstrap/start.sh']);
    expect(catalog?.files?.['/srv/artifacts/ui-build/chunks/large.js']).toBeUndefined();
    expect(catalog?.files?.['/srv/rntme-bootstrap/start.sh']).toBeDefined();
    expect(catalog?.files?.['/srv/rntme-bootstrap/extract-artifacts.mjs']).toBeDefined();
    expect(catalog?.files?.['/srv/rntme-bootstrap/start.sh']).toContain('ARTIFACTS_DIR="/tmp/rntme-artifacts"');
    expect(catalog?.files?.['/srv/rntme-bootstrap/start.sh']).not.toContain('RNTME_ARTIFACTS_DIR:-');
    expect(Object.keys(catalog?.files ?? {})).toContain('/srv/rntme-bootstrap/artifacts.json.gz.b64.part000');
    expect(catalog?.literalEnv?.RNTME_RUNTIME_ARTIFACTS_DIGEST).toMatch(/^sha256:/);
    expect(stack.composeFile).toContain('RNTME_RUNTIME_ARTIFACTS_DIGEST: sha256:');
    expect(stack.composeFile).toContain('/srv/rntme-bootstrap/start.sh');
    expect(stack.fileMounts?.some((mount) => mount.mountPath.includes('/srv/artifacts/ui-build/chunks/large.js'))).toBe(false);
    for (const mount of stack.fileMounts ?? []) {
      expect(Buffer.byteLength(mount.content, 'utf8')).toBeLessThan(700_000);
    }
  });

  it('renders provisioned infra as services inside the project stack', () => {
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
            persistence: { mode: 'persistent', volumeName: 'rntme-acme-commerce-event-bus-data' },
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
    const stack = r.value.resources[0];
    expect(stack.kind).toBe('compose');
    if (stack.kind !== 'compose') return;

    const redpanda = stack.services.find((service) => service.name === 'redpanda');
    const catalog = stack.services.find((service) => service.name === 'svc-catalog');
    expect(redpanda).toMatchObject({
      serviceClass: 'event-bus',
      image: 'docker.redpanda.com/redpandadata/redpanda:v24.3.6',
      restart: { container: 'unless-stopped' },
      resources: { cpus: '1.00', memory: '1G' },
    });
    expect(catalog?.env).toContainEqual({
      name: 'RNTME_EVENT_BUS_BROKERS',
      value: 'redpanda:9092',
      secret: false,
    });
    expect(stack.composeFile).toContain('  redpanda:\n');
    expect(stack.composeFile).toContain('    restart: unless-stopped\n');
  });

  it('downgrades binding exposure to legacy kind for known pre-exposure runtime images', () => {
    const r = renderDokployPlan(
      {
        ...plan,
        workloads: plan.workloads.map((workload) =>
          workload.kind === 'domain-service'
            ? {
                ...workload,
                runtime: { image: 'ghcr.io/vladprrs/rntme-runtime:runtime-pr108-27c70ad' },
                runtimeFiles: {
                  ...workload.runtimeFiles,
                  'bindings.json': JSON.stringify({
                    version: '1.0',
                    graphSpecRef: 'catalog.graphs.v1',
                    pdmRef: 'catalog.domain.v1',
                    qsmRef: 'catalog.read.v1',
                    bindings: {
                      listCatalog: {
                        exposure: 'read',
                        graph: 'listCatalog',
                        target: { engine: 'sqlite', dialect: 'sqlite' },
                        http: { method: 'GET', path: '/catalog' },
                      },
                      createCatalog: {
                        exposure: 'action',
                        graph: 'createCatalog',
                        target: { engine: 'sqlite', dialect: 'sqlite' },
                        http: { method: 'POST', path: '/catalog' },
                      },
                    },
                  }),
                },
              }
            : workload,
        ),
      },
      {
        endpoint: 'https://dokploy.example.com',
        projectId: 'project_123',
        publicBaseUrl: 'https://commerce.example.com',
      },
    );

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const stack = r.value.resources[0];
    expect(stack.kind).toBe('compose');
    if (stack.kind !== 'compose') return;
    const catalog = stack.services?.find((service) => service.name === 'svc-catalog');
    const bindings = JSON.parse(catalog?.files?.['/srv/artifacts/bindings.json'] ?? '{}');
    expect(bindings.bindings.listCatalog).toMatchObject({ kind: 'query' });
    expect(bindings.bindings.createCatalog).toMatchObject({ kind: 'command' });
    expect(bindings.bindings.listCatalog).not.toHaveProperty('exposure');
    expect(bindings.bindings.createCatalog).not.toHaveProperty('exposure');
  });

  it('renders Redpanda Console as compose services with a public basic-auth proxy', () => {
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
    expect(r.value.resources).toHaveLength(1);
    const stack = r.value.resources[0];
    expect(stack.kind).toBe('compose');
    if (stack.kind !== 'compose') return;

    const consoleService = stack.services.find((service) => service.name === 'redpanda-console');
    expect(consoleService).toMatchObject({
      serviceClass: 'infrastructure-proxy',
      image: 'docker.redpanda.com/redpandadata/console:v3.7.2',
      env: expect.arrayContaining([
        { name: 'KAFKA_BROKERS', value: 'redpanda:9092', secret: false },
      ]),
    });

    const proxyService = stack.services.find((service) => service.name === 'redpanda-console-proxy');
    expect(proxyService).toMatchObject({
      serviceClass: 'infrastructure-proxy',
      image: 'nginx:1.27-alpine',
      command: '/bin/sh',
      args: ['/docker-entrypoint-rntme.sh'],
    });
    const proxyEntrypointVolume = proxyService?.volumes?.find((volume) => volume.target === '/docker-entrypoint-rntme.sh');
    expect(proxyEntrypointVolume?.source).toMatch(
      /^\/etc\/dokploy\/compose\/\$\{APP_NAME\}\/files\/redpanda-console-proxy\/docker-entrypoint-rntme\.sh\.rntme-sha256-[a-f0-9]{16}$/,
    );
    expect(proxyEntrypointVolume?.readOnly).toBe(true);
    expect(proxyService?.env).toContainEqual({ name: 'RNTME_CONSOLE_HTPASSWD_B64', value: 'console-basic-auth', secret: true });
    expect(proxyService?.files?.['/etc/nginx/nginx.conf']).toContain('auth_basic_user_file /etc/nginx/.htpasswd');
    expect(proxyService?.files?.['/etc/nginx/nginx.conf']).toContain('proxy_set_header Authorization "";');
    expect(proxyService?.files?.['/etc/nginx/nginx.conf']).toContain('proxy_pass http://redpanda-console:8080;');

    const consoleDomain = stack.domains?.find((domain) => domain.serviceName === 'redpanda-console-proxy');
    expect(consoleDomain).toEqual({
      host: 'console-commerce.example.com',
      path: '/',
      serviceName: 'redpanda-console-proxy',
      containerPort: 8080,
      https: true,
    });

    expect(JSON.stringify(r.value)).not.toContain('$apr1$');
    expect(JSON.stringify(r.value)).not.toContain('plaintext-password');
  });

  it('renders provisioned RustFS as compose services with a public proxy and storage-s3 env', () => {
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
            internalEndpoint: 'http://rustfs:9000',
            publicBaseUrl: 'https://storage.example.test',
            bucketName: 'rntme-acme-commerce-default-storage',
            region: 'us-east-1',
            forcePathStyle: true,
            image: 'rustfs/rustfs:1.0.0-beta.1',
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
    expect(r.value.resources).toHaveLength(1);
    const stack = r.value.resources[0];
    expect(stack.kind).toBe('compose');
    if (stack.kind !== 'compose') return;

    const rustfs = stack.services.find((service) => service.name === 'rustfs');
    expect(rustfs).toMatchObject({
      serviceClass: 'object-storage',
      image: 'rustfs/rustfs:1.0.0-beta.1',
      command: 'server /data',
      env: [
        { name: 'RUSTFS_ACCESS_KEY', value: 'RUSTFS_ACCESS_KEY', secret: true },
        { name: 'RUSTFS_SECRET_KEY', value: 'RUSTFS_SECRET_KEY', secret: true },
      ],
      restart: { container: 'unless-stopped' },
    });

    const proxy = stack.services.find((service) => service.name === 'object-storage-public');
    expect(proxy).toMatchObject({
      serviceClass: 'infrastructure-proxy',
      image: 'nginx:1.27-alpine',
    });
    expect(proxy?.files?.['/etc/nginx/nginx.conf']).toContain('proxy_pass http://rustfs:9000');

    const proxyDomain = stack.domains?.find((domain) => domain.serviceName === 'object-storage-public');
    expect(proxyDomain).toEqual({
      host: 'storage.example.test',
      path: '/',
      serviceName: 'object-storage-public',
      containerPort: 8080,
      https: true,
    });

    const storageModule = stack.services.find((service) => service.workloadSlug === 'storage-s3');
    expect(storageModule?.env).toContainEqual({
      name: 'STORAGE_S3_ENDPOINT',
      value: 'http://rustfs:9000',
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
            providers: [
              {
                index: 0,
                provider: 'auth0',
                audience: 'https://commerce.example.com/api',
                moduleSlug: 'identity-auth0',
                introspectPath: '/introspect',
                introspectPort: 50052,
              },
            ],
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
          value: 'mod-identity-auth0:50051',
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
    expect(nginx).toMatch(/upstream rntme_auth_identity-auth0__0\s*\{/);
    expect(nginx).toContain('server mod-identity-auth0:50052;');
    expect(nginx).not.toContain('server mod-identity-auth0:3000;');
  });

  it('uses the raw module slug for the auth endpoint env so it matches the compose service name', () => {
    // Regression: the auth endpoint env value must agree byte-for-byte with the
    // compose service name. The compose service name is `mod-${workload.slug}`
    // (raw, no normalization), so the env must use the raw `moduleSlug` too —
    // otherwise a slug like `IdentityAuth0` (mixed case is rewritten by
    // `normalizePart` but kept as-is by `composeServiceName`) would resolve
    // to a non-existent host inside the compose network.
    const rawModuleSlug = 'IdentityAuth0';
    const authPlan: ProjectDeploymentPlan = {
      ...plan,
      infrastructure: {
        ...plan.infrastructure,
        auth: { auth0: { clientId: 'auth0-public-client-id' } },
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
          publicConfigJson: '{}',
          persistence: { mode: 'ephemeral' },
        },
        {
          kind: 'integration-module',
          slug: rawModuleSlug,
          serviceSlug: rawModuleSlug,
          resourceName: `rntme-acme-commerce-${rawModuleSlug}`,
          image: 'identity-auth0:latest',
          expose: false,
          env: {},
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
            providers: [
              {
                index: 0,
                provider: 'auth0',
                audience: 'https://commerce.example.com/api',
                moduleSlug: rawModuleSlug,
                introspectPath: '/introspect',
                introspectPort: 50052,
              },
            ],
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

    // The compose service for the integration module keeps the raw slug.
    const moduleService = stack.services.find(
      (service) => service.workloadKind === 'integration-module',
    );
    expect(moduleService?.name).toBe(`mod-${rawModuleSlug}`);

    // The auth endpoint env MUST point at that exact service name (no normalization drift).
    const app = stack.services.find((service) => service.workloadSlug === 'app');
    const authEndpoint = app?.env.find((entry) => entry.name === 'RNTME_AUTH_MODULE_ENDPOINT');
    expect(authEndpoint?.value).toBe(`mod-${rawModuleSlug}:50051`);
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
    expect(stack.composeFile).toContain('    volumes:\n');
    expect(stack.composeFile).toMatch(
      /\/etc\/dokploy\/compose\/\$\{APP_NAME\}\/files\/edge\/etc\/nginx\/nginx\.conf\.rntme-sha256-[a-f0-9]{16}:\/etc\/nginx\/nginx\.conf:ro/,
    );
    expect(stack.composeFile).toContain('RNTME_FILE_MOUNTS_DIGEST: sha256:');
    expect(stack.composeFile).toContain('      memory: 128M\n');
    expect(stack.composeFile).toContain('networks:\n  dokploy-network:\n    external: true\n');
  });

  it('changes the edge upstream digest when a routed service changes', () => {
    const base = renderDokployPlan(plan, {
      endpoint: 'https://dokploy.example.com',
      projectId: 'project_123',
      publicBaseUrl: 'https://commerce.example.com',
    });
    const changed = renderDokployPlan(
      {
        ...plan,
        workloads: plan.workloads.map((workload) =>
          workload.kind === 'domain-service'
            ? {
                ...workload,
                runtimeFiles: {
                  ...workload.runtimeFiles,
                  'ui-build/main.js': 'console.log("changed ui")',
                },
              }
            : workload,
        ),
      },
      {
        endpoint: 'https://dokploy.example.com',
        projectId: 'project_123',
        publicBaseUrl: 'https://commerce.example.com',
      },
    );

    expect(base.ok).toBe(true);
    expect(changed.ok).toBe(true);
    if (!base.ok || !changed.ok) return;
    const baseStack = base.value.resources[0];
    const changedStack = changed.value.resources[0];
    expect(baseStack.kind).toBe('compose');
    expect(changedStack.kind).toBe('compose');
    if (baseStack.kind !== 'compose' || changedStack.kind !== 'compose') return;

    const baseEdge = baseStack.services.find((service) => service.name === 'edge');
    const changedEdge = changedStack.services.find((service) => service.name === 'edge');
    expect(baseEdge?.literalEnv?.RNTME_EDGE_UPSTREAMS_DIGEST).toMatch(/^sha256:/);
    expect(changedEdge?.literalEnv?.RNTME_EDGE_UPSTREAMS_DIGEST).toMatch(/^sha256:/);
    expect(changedEdge?.literalEnv?.RNTME_EDGE_UPSTREAMS_DIGEST).not.toBe(
      baseEdge?.literalEnv?.RNTME_EDGE_UPSTREAMS_DIGEST,
    );
    expect(changedStack.composeFile).toContain('RNTME_EDGE_UPSTREAMS_DIGEST: sha256:');
  });

  it('folds service env entries up into the stack env so ${VAR} references resolve at deploy time', () => {
    // Compose YAML emits `<NAME>: ${<NAME>}` for every service env entry.
    // Those interpolations resolve against the stack-level env block
    // (delivered via `compose.saveEnvironment`). The stack env therefore
    // MUST contain every name referenced by any service or the rendered
    // containers boot without their environment configuration.
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
            persistence: { mode: 'persistent', volumeName: 'rntme-acme-commerce-event-bus-data' },
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
    const stack = r.value.resources[0];
    expect(stack.kind).toBe('compose');
    if (stack.kind !== 'compose') return;

    // Both catalog and any other service that references the broker share
    // the same value, so the stack env must dedupe to one entry.
    const brokers = stack.env.filter((entry) => entry.name === 'RNTME_EVENT_BUS_BROKERS');
    expect(brokers).toEqual([
      { name: 'RNTME_EVENT_BUS_BROKERS', value: 'redpanda:9092', secret: false },
    ]);

    // Every distinct env name on any service must be present on the stack
    // env, otherwise its `${VAR}` interpolation in YAML would render empty.
    const stackNames = new Set(stack.env.map((entry) => entry.name));
    for (const service of stack.services ?? []) {
      for (const entry of service.env) {
        expect(stackNames.has(entry.name)).toBe(true);
      }
    }

    // Stack env is alphabetized so digests stay stable.
    const sortedNames = [...stack.env].map((entry) => entry.name);
    const expectedSortedNames = [...sortedNames].sort((a, b) => a.localeCompare(b));
    expect(sortedNames).toEqual(expectedSortedNames);
  });

  it('preserves the secret flag when folding service env into the stack env', () => {
    // Provisioned RustFS exposes secret credentials on the service. After
    // folding those values up to the stack level the secret flag must be
    // preserved so the Dokploy client can flag them appropriately.
    const r = renderDokployPlan(
      {
        ...plan,
        infrastructure: {
          ...plan.infrastructure,
          objectStorage: {
            kind: 's3-compatible',
            mode: 'provisioned',
            provider: 'rustfs',
            resourceName: 'rntme-acme-commerce-object-storage',
            image: 'rustfs/rustfs:1.0.0-alpha.65',
            internalEndpoint: 'http://rntme-acme-commerce-object-storage:9000',
            publicBaseUrl: 'https://storage-commerce.example.com',
            bucketName: 'rntme-commerce',
            region: 'us-east-1',
            forcePathStyle: true,
            credentials: {
              accessKeyRef: 'rntme-rustfs-access-key',
              secretKeyRef: 'rntme-rustfs-secret-key',
            },
            persistence: {
              mode: 'persistent',
              volumeName: 'rntme-acme-commerce-object-storage-data',
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
    const stack = r.value.resources[0];
    if (stack.kind !== 'compose') throw new Error('expected compose stack');

    const accessKey = stack.env.find((entry) => entry.name === 'RUSTFS_ACCESS_KEY');
    expect(accessKey).toEqual({
      name: 'RUSTFS_ACCESS_KEY',
      value: 'rntme-rustfs-access-key',
      secret: true,
    });
  });

  it('rejects stack env collisions when two services disagree on the same env name', () => {
    // Construct a plan where two integration-module workloads declare the
    // same env name with different values. Folding those into the stack env
    // must error so the rendered stack does not silently pick a winner.
    const r = renderDokployPlan(
      {
        ...plan,
        workloads: [
          {
            kind: 'integration-module',
            slug: 'storage-a',
            serviceSlug: 'storage-a',
            resourceName: 'rntme-acme-commerce-storage-a',
            image: 'ghcr.io/acme/storage-a:test',
            expose: false,
            env: { SHARED_TOKEN: 'value-a' },
            secretRefs: {},
            modulePackageName: '@rntme/storage-a',
          },
          {
            kind: 'integration-module',
            slug: 'storage-b',
            serviceSlug: 'storage-b',
            resourceName: 'rntme-acme-commerce-storage-b',
            image: 'ghcr.io/acme/storage-b:test',
            expose: false,
            env: { SHARED_TOKEN: 'value-b' },
            secretRefs: {},
            modulePackageName: '@rntme/storage-b',
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
    if (r.ok) return;
    expect(r.errors[0]?.code).toBe('DEPLOY_RENDER_DOKPLOY_STACK_ENV_COLLISION');
    expect(r.errors[0]?.message).toContain('SHARED_TOKEN');
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

describe('renderDokployPlan — static-site outputs', () => {
  it('renders a marketing-site staticSite payload as its own nginx application resource', () => {
    const provisioned = new Map([
      [
        'marketing',
        {
          projectKey: 'marketing',
          packageName: '@rntme/marketing-site-static',
          publicOutputs: {
            url: { href: 'https://mkt.example.com' },
            deployedSha256: { value: 'a'.repeat(64) },
            staticSite: {
              kind: 'static-site-v1',
              primaryDomain: 'mkt.example.com',
              ssl: 'auto',
              sha256: 'a'.repeat(64),
              files: {
                'index.html': '<h1>cv extract</h1>',
                'styles.css': 'body{color:#111}',
              },
            },
          },
          secretOutputs: {},
          provisionedAt: '2026-05-13T00:00:00Z',
        },
      ],
    ]);

    const rendered = renderDokployPlan(plan, targetConfig(), provisioned, {});
    expect(rendered.ok).toBe(true);
    if (!rendered.ok) return;

    const staticSite = rendered.value.resources.find(
      (r) => r.kind === 'application' && r.workloadKind === 'static-site',
    );
    expect(staticSite).toBeDefined();
    if (staticSite === undefined || staticSite.kind !== 'application') return;
    expect(staticSite.image).toBe('nginx:1.27-alpine');
    expect(staticSite.workloadSlug).toBe('marketing-site');
    expect(staticSite.files?.['/usr/share/nginx/html/index.html']).toContain('<h1>cv extract</h1>');
    expect(staticSite.files?.['/usr/share/nginx/html/styles.css']).toContain('color:#111');
    expect(staticSite.files?.['/etc/nginx/nginx.conf']).toContain('try_files');
    expect(staticSite.ingress?.publicBaseUrl).toBe('https://mkt.example.com');
    expect(staticSite.ingress?.routes[0]?.url).toBe('https://mkt.example.com/');
    expect(staticSite.ports?.[0]?.containerPort).toBe(8080);
    expect(staticSite.labels['rntme.module']).toBe('marketing');
    expect(staticSite.labels['rntme.static-site.sha256']).toBe('a'.repeat(64));
  });

  it('omits the static-site resource when no provisioned module emits a staticSite output', () => {
    const provisioned = new Map([
      [
        'other',
        {
          projectKey: 'other',
          packageName: '@rntme/other',
          publicOutputs: { url: { href: 'https://x' } },
          secretOutputs: {},
          provisionedAt: '2026-05-13T00:00:00Z',
        },
      ],
    ]);
    const rendered = renderDokployPlan(plan, targetConfig(), provisioned, {});
    expect(rendered.ok).toBe(true);
    if (!rendered.ok) return;
    const staticSite = rendered.value.resources.find(
      (r) => r.kind === 'application' && r.workloadKind === 'static-site',
    );
    expect(staticSite).toBeUndefined();
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
          providers: [
            {
              index: 0,
              provider: 'auth0',
              audience: 'https://commerce.example.com/api',
              moduleSlug: 'identity-auth0',
              introspectPath: '/introspect',
              introspectPort: 50052,
            },
          ],
        },
      ],
    },
    diagnostics: { warnings: [] },
  };
}
