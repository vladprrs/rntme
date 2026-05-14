import { describe, expect, it } from 'bun:test';
import { buildProjectDeploymentPlan } from '../../src/plan.js';
import type { ComposedProjectInput } from '../../src/composed-project.js';
import type { ProjectDeploymentConfig } from '../../src/config.js';
import { DEFAULT_REDPANDA_CONSOLE_IMAGE } from '../../src/config.js';

const project: ComposedProjectInput = {
  name: 'commerce',
  services: {
    catalog: { slug: 'catalog', kind: 'domain', runtimeFiles: { 'manifest.json': '{}' } },
    app: { slug: 'app', kind: 'domain', runtimeFiles: { 'manifest.json': '{}' } },
    'mod-workos': { slug: 'mod-workos', kind: 'integration', runtimeFiles: { 'storage.json': '{"routes":{}}' } },
  },
  routes: {
    ui: { '/': 'app' },
    http: { '/api/catalog': 'catalog' },
  },
  middleware: {},
  mounts: [],
};

const previewConfig: ProjectDeploymentConfig = {
  orgSlug: 'acme',
  environment: 'default',
  mode: 'preview',
  eventBus: {
    kind: 'kafka',
    mode: 'external',
    brokers: ['redpanda.internal:9092'],
  },
  modules: {
    'mod-workos': {
      image: 'ghcr.io/acme/mod-workos:2026-04-24',
      expose: false,
    },
  },
  policies: {},
};

describe('buildProjectDeploymentPlan', () => {
  it('builds preview workloads for domain services, integration modules, and edge', () => {
    const r = buildProjectDeploymentPlan(
      {
        ...project,
        publicConfigJson:
          '{"@rntme/identity-auth0":{"domain":"tenant.us.auth0.com","clientId":"spa-client","audience":"https://commerce.example.com/api","redirectUri":"https://commerce.example.com"}}',
      },
      previewConfig,
    );

    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(r.value.project).toEqual({
      orgSlug: 'acme',
      projectSlug: 'commerce',
      environment: 'default',
      mode: 'preview',
    });
    expect(r.value.infrastructure.eventBus.brokers).toEqual(['redpanda.internal:9092']);
    expect(r.value.workloads.map((w) => w.slug)).toEqual([
      'catalog',
      'app',
      'mod-workos',
      'edge',
    ]);
    expect(r.value.workloads.find((w) => w.kind === 'domain-service' && w.slug === 'catalog')).toMatchObject({
      runtime: { image: 'ghcr.io/vladprrs/rntme-runtime:latest' },
      runtimeFiles: { 'manifest.json': '{}' },
      publicConfigJson:
        '{"@rntme/identity-auth0":{"domain":"tenant.us.auth0.com","clientId":"spa-client","audience":"https://commerce.example.com/api","redirectUri":"https://commerce.example.com"}}',
      persistence: { mode: 'ephemeral' },
    });
    expect(r.value.workloads.find((w) => w.kind === 'integration-module')).toMatchObject({
      slug: 'mod-workos',
      image: 'ghcr.io/acme/mod-workos:2026-04-24',
      expose: false,
      runtimeFiles: { 'storage.json': '{"routes":{}}' },
    });
  });

  it('defaults the public config sidecar to an empty object when the composed project has none', () => {
    const r = buildProjectDeploymentPlan(
      {
        ...project,
        publicConfigJson: null,
      },
      previewConfig,
    );

    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(r.value.workloads.find((w) => w.kind === 'domain-service' && w.slug === 'app')).toMatchObject({
      publicConfigJson: '{}',
    });
  });

  it('plans a persistent SQLite store for domain services that request persistence', () => {
    const r = buildProjectDeploymentPlan(
      {
        ...project,
        services: {
          ...project.services,
          tokens: {
            slug: 'tokens',
            kind: 'domain',
            runtimeFiles: { 'manifest.json': '{}' },
            persistence: {
              mode: 'persistent',
              eventStorePath: '/srv/data/events.sqlite',
              qsmPath: '/srv/data/qsm.sqlite',
            },
          } as never,
        },
      },
      previewConfig,
    );

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.workloads.find((w) => w.kind === 'domain-service' && w.slug === 'tokens')).toMatchObject({
      persistence: {
        mode: 'persistent',
        volumeName: 'rntme-acme-commerce-tokens-data',
        eventStorePath: '/srv/data/events.sqlite',
        qsmPath: '/srv/data/qsm.sqlite',
        mountPath: '/srv/data',
      },
    });
    expect(r.value.workloads.find((w) => w.kind === 'domain-service' && w.slug === 'catalog')).toMatchObject({
      persistence: { mode: 'ephemeral' },
    });
  });

  it('uses a requested persistent SQLite volume name for domain services', () => {
    const r = buildProjectDeploymentPlan(
      {
        ...project,
        services: {
          ...project.services,
          projects: {
            slug: 'projects',
            kind: 'domain',
            runtimeFiles: { 'manifest.json': '{}' },
            persistence: {
              mode: 'persistent',
              volumeName: 'rntme-platform-control-data',
              eventStorePath: '/srv/data/events.sqlite',
              qsmPath: '/srv/data/qsm.sqlite',
            },
          } as never,
        },
      },
      previewConfig,
    );

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.workloads.find((w) => w.kind === 'domain-service' && w.slug === 'projects')).toMatchObject({
      persistence: {
        mode: 'persistent',
        volumeName: 'rntme-platform-control-data',
        eventStorePath: '/srv/data/events.sqlite',
        qsmPath: '/srv/data/qsm.sqlite',
        mountPath: '/srv/data',
      },
    });
  });

  it('passes domain service env and secretRefs from deployment config', () => {
    const r = buildProjectDeploymentPlan(project, {
      ...previewConfig,
      services: {
        catalog: {
          env: { FEATURE_FLAG: 'enabled' },
          secretRefs: { PLATFORM_SECRET_ENCRYPTION_KEY: 'platform-secret-encryption-key' },
        },
      },
    });

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.workloads.find((w) => w.kind === 'domain-service' && w.slug === 'catalog')).toMatchObject({
      env: { FEATURE_FLAG: 'enabled' },
      secretRefs: { PLATFORM_SECRET_ENCRYPTION_KEY: 'platform-secret-encryption-key' },
    });
  });

  it('rejects production mode in the MVP', () => {
    const r = buildProjectDeploymentPlan(project, {
      ...previewConfig,
      mode: 'production',
    });

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toContainEqual(
        expect.objectContaining({
          code: 'DEPLOY_PLAN_UNSUPPORTED_PRODUCTION_MODE',
        }),
      );
    }
  });

  it('rejects preview plans without an event bus', () => {
    const r = buildProjectDeploymentPlan(project, {
      ...previewConfig,
      eventBus: undefined,
    });

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toContainEqual(
        expect.objectContaining({
          code: 'DEPLOY_PLAN_MISSING_EVENT_BUS',
          path: 'eventBus',
        }),
      );
    }
  });

  it('normalizes legacy external event bus configs without mode', () => {
    const r = buildProjectDeploymentPlan(project, {
      ...previewConfig,
      eventBus: {
        kind: 'kafka',
        brokers: ['redpanda.internal:9092'],
      } as ProjectDeploymentConfig['eventBus'],
    });

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.infrastructure.eventBus).toEqual({
      kind: 'kafka',
      mode: 'external',
      brokers: ['redpanda.internal:9092'],
    });
  });

  it('plans provisioned Redpanda infrastructure with deterministic names', () => {
    const r = buildProjectDeploymentPlan(project, {
      ...previewConfig,
      eventBus: {
        kind: 'kafka',
        mode: 'provisioned',
        provider: 'redpanda',
        topicPrefix: 'rntme.notes',
      },
    });

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.infrastructure.eventBus).toEqual({
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
    });
  });

  it('defaults object storage infrastructure to none', () => {
    const r = buildProjectDeploymentPlan(project, previewConfig);

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.infrastructure.objectStorage).toEqual({ kind: 'none' });
  });

  it('plans provisioned RustFS object storage with deterministic names', () => {
    const r = buildProjectDeploymentPlan(project, {
      ...previewConfig,
      storage: {
        mode: 'provisioned',
        provider: 'rustfs',
        publicBaseUrl: 'https://storage.example.test',
        accessKeyRef: 'RUSTFS_ACCESS_KEY',
        secretKeyRef: 'RUSTFS_SECRET_KEY',
      },
    });

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.infrastructure.objectStorage).toEqual({
      kind: 's3-compatible',
      mode: 'provisioned',
      provider: 'rustfs',
      resourceName: 'rntme-acme-commerce-storage',
      internalEndpoint: 'http://rntme-acme-commerce-storage:9000',
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
    });
  });

  it('rejects latest as a provisioned RustFS image tag', () => {
    const r = buildProjectDeploymentPlan(project, {
      ...previewConfig,
      storage: {
        mode: 'provisioned',
        provider: 'rustfs',
        image: 'rustfs/rustfs:latest',
        publicBaseUrl: 'https://storage.example.test',
        accessKeyRef: 'RUSTFS_ACCESS_KEY',
        secretKeyRef: 'RUSTFS_SECRET_KEY',
      },
    });

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toContainEqual(
        expect.objectContaining({
          code: 'DEPLOY_PLAN_STORAGE_IMAGE_INVALID',
          path: 'storage.image',
        }),
      );
    }
  });

  it('allows preview deployments to use a non-durable in-memory event bus', () => {
    const r = buildProjectDeploymentPlan(project, {
      ...previewConfig,
      eventBus: {
        kind: 'memory',
        mode: 'in-memory',
      } as ProjectDeploymentConfig['eventBus'],
    });

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.infrastructure.eventBus).toEqual({
      kind: 'memory',
      mode: 'in-memory',
    });
    expect(r.value.diagnostics.warnings).toContainEqual({
      code: 'DEPLOY_PLAN_IN_MEMORY_EVENT_BUS',
      message: 'in-memory event bus is non-durable and intended only for preview/e2e deployments',
    });
  });

  it('allows overriding the provisioned Redpanda image with a pinned image', () => {
    const r = buildProjectDeploymentPlan(project, {
      ...previewConfig,
      eventBus: {
        kind: 'kafka',
        mode: 'provisioned',
        provider: 'redpanda',
        image: 'docker.redpanda.com/redpandadata/redpanda:v25.1.1',
      },
    });

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.infrastructure.eventBus).toMatchObject({
      mode: 'provisioned',
      image: 'docker.redpanda.com/redpandadata/redpanda:v25.1.1',
    });
  });

  it('rejects unsupported provisioned event bus providers', () => {
    const r = buildProjectDeploymentPlan(project, {
      ...previewConfig,
      eventBus: {
        kind: 'kafka',
        mode: 'provisioned',
        provider: 'kafka',
      } as ProjectDeploymentConfig['eventBus'],
    });

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toContainEqual(
        expect.objectContaining({
          code: 'DEPLOY_PLAN_EVENT_BUS_PROVIDER_UNSUPPORTED',
          path: 'eventBus.provider',
        }),
      );
    }
  });

  it('rejects latest as a provisioned Redpanda image tag', () => {
    const r = buildProjectDeploymentPlan(project, {
      ...previewConfig,
      eventBus: {
        kind: 'kafka',
        mode: 'provisioned',
        provider: 'redpanda',
        image: 'docker.redpanda.com/redpandadata/redpanda:latest',
      },
    });

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toContainEqual(
        expect.objectContaining({
          code: 'DEPLOY_PLAN_EVENT_BUS_IMAGE_INVALID',
          path: 'eventBus.image',
        }),
      );
    }
  });

  it('rejects integration modules without explicit image config', () => {
    const r = buildProjectDeploymentPlan(project, {
      ...previewConfig,
      modules: {},
    });

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toContainEqual(
        expect.objectContaining({
          code: 'DEPLOY_PLAN_MISSING_MODULE_IMAGE',
          service: 'mod-workos',
          path: 'modules.mod-workos.image',
        }),
      );
    }
  });

  it('accumulates missing event bus and module image errors in validation order', () => {
    const r = buildProjectDeploymentPlan(project, {
      ...previewConfig,
      eventBus: undefined,
      modules: {},
    });

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.map((error) => error.code)).toEqual([
        'DEPLOY_PLAN_MISSING_EVENT_BUS',
        'DEPLOY_PLAN_MISSING_MODULE_IMAGE',
      ]);
    }
  });

  it('accepts complete SASL_SSL/SCRAM event bus security config', () => {
    const r = buildProjectDeploymentPlan(project, {
      ...previewConfig,
      eventBus: {
        kind: 'kafka',
        mode: 'external',
        brokers: ['redpanda.example.com:9092'],
        security: {
          protocol: 'sasl_ssl',
          mechanism: 'scram-sha-512',
          secretRefs: {
            username: 'RNTME_EVENT_BUS_USERNAME',
            password: 'RNTME_EVENT_BUS_PASSWORD',
          },
        },
      },
    });

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.infrastructure.eventBus.security).toEqual({
      protocol: 'sasl_ssl',
      mechanism: 'scram-sha-512',
      secretRefs: {
        username: 'RNTME_EVENT_BUS_USERNAME',
        password: 'RNTME_EVENT_BUS_PASSWORD',
      },
    });
  });

  it('rejects unsupported SASL mechanisms', () => {
    const r = buildProjectDeploymentPlan(project, {
      ...previewConfig,
      eventBus: {
        kind: 'kafka',
        mode: 'external',
        brokers: ['redpanda.example.com:9092'],
        security: {
          protocol: 'sasl_ssl',
          mechanism: 'plain',
          secretRefs: {
            username: 'RNTME_EVENT_BUS_USERNAME',
            password: 'RNTME_EVENT_BUS_PASSWORD',
          },
        },
      } as ProjectDeploymentConfig['eventBus'],
    });

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toContainEqual(
        expect.objectContaining({
          code: 'DEPLOY_PLAN_EVENT_BUS_SASL_MECHANISM_UNSUPPORTED',
          path: 'eventBus.security.mechanism',
        }),
      );
    }
  });

  it('reads integration package metadata from project.modules[moduleKey] when descriptor has a module alias', () => {
    const r = buildProjectDeploymentPlan(
      {
        ...project,
        services: {
          ...project.services,
          'storage-s3': { slug: 'storage-s3', kind: 'integration-module', moduleKey: 'storage' },
        },
        modules: {
          storage: { packageName: '@rntme/storage-s3' },
        },
      },
      {
        ...previewConfig,
        modules: {
          ...previewConfig.modules,
          'storage-s3': { image: 'ghcr.io/acme/storage-s3:1.0.0' },
        },
      },
    );

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const workload = r.value.workloads.find(
      (w) => w.kind === 'integration-module' && w.slug === 'storage-s3',
    );
    expect(workload).toMatchObject({
      kind: 'integration-module',
      image: 'ghcr.io/acme/storage-s3:1.0.0',
      modulePackageName: '@rntme/storage-s3',
    });
  });

  it('reports DEPLOY_PLAN_MISSING_MODULE_IMAGE per service slug when multiple integration services miss target images', () => {
    const r = buildProjectDeploymentPlan(
      {
        ...project,
        services: {
          ...project.services,
          'mod-openrouter': { slug: 'mod-openrouter', kind: 'integration' },
          'storage-s3': { slug: 'storage-s3', kind: 'integration-module', moduleKey: 'storage' },
        },
      },
      {
        ...previewConfig,
        modules: {},
      },
    );

    expect(r.ok).toBe(false);
    if (r.ok) return;
    const codes = r.errors
      .filter((e) => e.code === 'DEPLOY_PLAN_MISSING_MODULE_IMAGE')
      .map((e) => e.service)
      .sort();
    expect(codes).toContain('mod-openrouter');
    expect(codes).toContain('storage-s3');
  });

  it('does not raise DEPLOY_PLAN_MISSING_MODULE_IMAGE when no service maps to the target.modules entry', () => {
    const r = buildProjectDeploymentPlan(
      {
        name: 'commerce',
        services: {
          app: { slug: 'app', kind: 'domain', runtimeFiles: { 'manifest.json': '{}' } },
        },
        routes: { ui: { '/': 'app' } },
        middleware: {},
        mounts: [],
      },
      {
        ...previewConfig,
        modules: {
          marketing: { primaryDomain: 'marketing.example.test' } as never,
        },
      },
    );

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(
      r.value.workloads.some(
        (w) => w.kind === 'integration-module' && (w.slug === 'marketing' || w.slug === 'app'),
      ),
    ).toBe(false);
  });

  it('resolves a target.modules.<slug>.<facet> path through vars before planning', () => {
    const r = buildProjectDeploymentPlan(
      {
        ...project,
        publicConfigJson: '{"marketing":{"domain":"${MARKETING_DOMAIN}"}}',
        varsManifest: {
          MARKETING_DOMAIN: { from: 'target.modules.marketing.primaryDomain', required: true },
        },
      },
      {
        ...previewConfig,
        modules: {
          ...previewConfig.modules,
          marketing: { primaryDomain: 'marketing.example.test' } as never,
        },
      },
    );

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const appWorkload = r.value.workloads.find(
      (w) => w.kind === 'domain-service' && w.slug === 'app',
    );
    expect(appWorkload).toBeDefined();
    expect((appWorkload as { publicConfigJson: string }).publicConfigJson).toContain(
      '"domain":"marketing.example.test"',
    );
  });

  it('rejects incomplete SASL secret refs', () => {
    const r = buildProjectDeploymentPlan(project, {
      ...previewConfig,
      eventBus: {
        kind: 'kafka',
        mode: 'external',
        brokers: ['redpanda.example.com:9092'],
        security: {
          protocol: 'sasl_ssl',
          mechanism: 'scram-sha-256',
          secretRefs: { username: 'RNTME_EVENT_BUS_USERNAME' },
        },
      } as ProjectDeploymentConfig['eventBus'],
    });

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toContainEqual(
        expect.objectContaining({
          code: 'DEPLOY_PLAN_EVENT_BUS_SASL_INCOMPLETE',
          path: 'eventBus.security.secretRefs',
        }),
      );
    }
  });
});

describe('buildProjectDeploymentPlan with provisionResult', () => {
  const provisionProject: ComposedProjectInput = {
    name: 'shop',
    services: {
      api: { slug: 'api', kind: 'domain', runtimeFiles: { 'manifest.json': '{}' } },
    },
    routes: { http: { '/api': 'api' } },
    middleware: {},
    mounts: [],
  };

  const provisionConfig: ProjectDeploymentConfig = {
    targetSlug: 'staging',
    orgSlug: 'acme',
    environment: 'default',
    mode: 'preview',
    eventBus: {
      kind: 'kafka',
      mode: 'external',
      brokers: ['redpanda.internal:9092'],
    },
    policies: {},
  };

  it('substitutes a provision.* var into publicConfigJson on the domain workload', () => {
    const r = buildProjectDeploymentPlan(
      {
        ...provisionProject,
        publicConfigJson: '{"identity":{"clientId":"${AUTH0_SPA_CLIENT_ID}"}}',
        varsManifest: {
          AUTH0_SPA_CLIENT_ID: {
            from: 'provision.identity.spaClient.id',
            required: true,
          },
        },
      },
      provisionConfig,
      {
        provisionResult: {
          modules: {
            identity: { publicOutputs: { spaClient: { id: 'spa_real' } } },
          },
        },
        discoveredModules: { identity: { producesNames: ['spaClient'] } },
      },
    );

    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const workload = r.value.workloads.find(
      (w) => w.kind === 'domain-service' && w.slug === 'api',
    );
    expect(workload).toBeDefined();
    const publicConfigJson = (workload as { publicConfigJson: string }).publicConfigJson;
    expect(publicConfigJson).toContain('"clientId":"spa_real"');
    expect(publicConfigJson).not.toContain('${AUTH0_SPA_CLIENT_ID}');
  });

  it('fails with BLUEPRINT_VAR_PROVISION_OUTPUT_MISSING when a required provision.* var has no provisionResult entry', () => {
    const r = buildProjectDeploymentPlan(
      {
        ...provisionProject,
        publicConfigJson: '{"identity":{"clientId":"${AUTH0_SPA_CLIENT_ID}"}}',
        varsManifest: {
          AUTH0_SPA_CLIENT_ID: {
            from: 'provision.identity.spaClient.id',
            required: true,
          },
        },
      },
      provisionConfig,
      {
        discoveredModules: { identity: { producesNames: ['spaClient'] } },
      },
    );

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors[0]?.code).toBe('BLUEPRINT_VAR_PROVISION_OUTPUT_MISSING');
    }
  });

  it('plans Redpanda Console access for provisioned Redpanda', () => {
    const r = buildProjectDeploymentPlan(project, {
      ...previewConfig,
      eventBus: {
        kind: 'kafka',
        mode: 'provisioned',
        provider: 'redpanda',
      },
      manualAccess: {
        redpandaConsole: {
          enabled: true,
          publicBaseUrl: 'https://console-acme-commerce-default.example.com',
          basicAuth: {
            username: 'ops',
            htpasswdSecretRef: 'console-auth',
          },
        },
      },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.infrastructure.manualAccess?.redpandaConsole).toMatchObject({
      kind: 'redpanda-console',
      resourceName: 'rntme-acme-commerce-redpanda-console',
      proxyResourceName: 'rntme-acme-commerce-redpanda-console-proxy',
      publicBaseUrl: 'https://console-acme-commerce-default.example.com',
      basicAuthUsername: 'ops',
      htpasswdSecretRef: 'console-auth',
      image: DEFAULT_REDPANDA_CONSOLE_IMAGE,
    });
  });

  it('rejects Console access for external event bus', () => {
    const r = buildProjectDeploymentPlan(project, {
      ...previewConfig,
      manualAccess: {
        redpandaConsole: {
          enabled: true,
          publicBaseUrl: 'https://c.example.com',
          basicAuth: { username: 'a', htpasswdSecretRef: 'r' },
        },
      },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some((e) => e.code === 'DEPLOY_PLAN_REDPANDA_CONSOLE_EVENT_BUS_INVALID')).toBe(true);
    }
  });

  it('rejects Console image with latest tag', () => {
    const r = buildProjectDeploymentPlan(project, {
      ...previewConfig,
      eventBus: {
        kind: 'kafka',
        mode: 'provisioned',
        provider: 'redpanda',
      },
      manualAccess: {
        redpandaConsole: {
          enabled: true,
          image: 'docker.redpanda.com/redpandadata/console:latest',
          publicBaseUrl: 'https://c.example.com',
          basicAuth: { username: 'a', htpasswdSecretRef: 'r' },
        },
      },
    });
    expect(r.ok).toBe(false);
  });
});
