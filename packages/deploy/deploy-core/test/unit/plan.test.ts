import { describe, expect, it } from 'vitest';
import { buildProjectDeploymentPlan } from '../../src/plan.js';
import type { ComposedProjectInput } from '../../src/composed-project.js';
import type { ProjectDeploymentConfig } from '../../src/config.js';
import { DEFAULT_REDPANDA_CONSOLE_IMAGE } from '../../src/config.js';

const project: ComposedProjectInput = {
  name: 'commerce',
  services: {
    catalog: { slug: 'catalog', kind: 'domain', runtimeFiles: { 'manifest.json': '{}' } },
    app: { slug: 'app', kind: 'domain', runtimeFiles: { 'manifest.json': '{}' } },
    'mod-workos': { slug: 'mod-workos', kind: 'integration' },
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
          path: 'modules.mod-workos',
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
