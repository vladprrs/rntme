import { describe, expect, it } from 'bun:test';
import type { DeployTargetForBuild } from '../src/deploy-target-types.js';
import { buildProjectDeploymentConfig, buildDokployTargetConfig } from '../src/build-deploy-config.js';

describe('buildProjectDeploymentConfig', () => {
  it('maps target event bus and preview/default constants', () => {
    const config = buildProjectDeploymentConfig(target(), 'acme', {});

    expect(config).toMatchObject({
      targetSlug: 'staging',
      orgSlug: 'acme',
      environment: 'default',
      mode: 'preview',
      eventBus: {
        kind: 'kafka',
        mode: 'external',
        brokers: ['redpanda:9092'],
      },
    });
  });

  it('preserves sasl_ssl security mechanism and secret refs', () => {
    const config = buildProjectDeploymentConfig(
      {
        ...target(),
        eventBus: {
          kind: 'kafka',
          mode: 'external',
          brokers: ['redpanda.example.com:9092'],
          security: {
            protocol: 'sasl_ssl',
            mechanism: 'scram-sha-512',
            secretRefs: {
              username: 'redpanda-username',
              password: 'redpanda-password',
            },
          },
        },
      },
      'acme',
      {},
    );

    expect(config.eventBus).toEqual(
      expect.objectContaining({
        security: {
          protocol: 'sasl_ssl',
          mechanism: 'scram-sha-512',
          secretRefs: {
            username: 'redpanda-username',
            password: 'redpanda-password',
          },
        },
      }),
    );
  });

  it('passes provisioned Redpanda event bus config through to deploy-core', () => {
    const provisionedTarget = {
      ...target(),
      eventBus: {
        kind: 'kafka' as const,
        mode: 'provisioned' as const,
        provider: 'redpanda' as const,
        topicPrefix: 'rntme.notes',
      },
    };

    const config = buildProjectDeploymentConfig(provisionedTarget, 'acme', {});

    expect(config.eventBus).toEqual({
      kind: 'kafka',
      mode: 'provisioned',
      provider: 'redpanda',
      topicPrefix: 'rntme.notes',
    });
  });

  it('passes workflow deployment config through to deploy-core', () => {
    const config = buildProjectDeploymentConfig(
      {
        ...target(),
        eventBus: { kind: 'kafka', mode: 'provisioned', provider: 'redpanda' },
        workflows: {
          engine: { kind: 'operaton', mode: 'provisioned', image: 'operaton/operaton:test' },
          worker: { image: 'ghcr.io/rntme/bpmn-worker:test' },
        },
      },
      'acme',
      {},
    );

    expect(config.workflows).toEqual({
      engine: { kind: 'operaton', mode: 'provisioned', image: 'operaton/operaton:test' },
      worker: { image: 'ghcr.io/rntme/bpmn-worker:test' },
    });
  });

  it('passes provisioned RustFS storage config through to deploy-core', () => {
    const config = buildProjectDeploymentConfig(
      {
        ...target(),
        storage: {
          mode: 'provisioned',
          provider: 'rustfs',
          image: 'rustfs/rustfs:1.0.0-beta.1',
          publicBaseUrl: 'https://storage.example.test',
          accessKeyRef: 'RUSTFS_ACCESS_KEY',
          secretKeyRef: 'RUSTFS_SECRET_KEY',
        },
      },
      'acme',
      {},
    );

    expect(config.storage).toEqual({
      mode: 'provisioned',
      provider: 'rustfs',
      image: 'rustfs/rustfs:1.0.0-beta.1',
      publicBaseUrl: 'https://storage.example.test',
      accessKeyRef: 'RUSTFS_ACCESS_KEY',
      secretKeyRef: 'RUSTFS_SECRET_KEY',
    });
  });

  it('allows deployment config overrides to force the runtime in-memory event bus', () => {
    const config = buildProjectDeploymentConfig(target(), 'acme', {
      eventBusMode: 'in-memory',
    });

    expect(config.eventBus).toEqual({
      kind: 'memory',
      mode: 'in-memory',
    });
  });

  it('maps deploy target modules, override images, auth, and policy overrides', () => {
    const config = buildProjectDeploymentConfig({
      ...target(),
      modules: {
        'identity-auth0': {
          image: 'registry/identity-auth0:1',
          env: { AUTH0_DOMAIN: 'tenant.us.auth0.com' },
        },
      },
      auth: {
        auth0: {
          clientId: 'public-client-id',
          domain: 'demo-rntme.us.auth0.com',
          audience: 'https://notes-demo.rntme.com/api',
          redirectUri: 'https://notes-demo.rntme.com/',
        },
      },
    }, 'acme', {
      integrationModuleImages: { stripe: 'registry/stripe:1' },
      policyOverrides: { timeout: { edge: { upstreamTimeoutMs: 1000 } } },
      runtimeImage: 'ghcr.io/acme/rntme-runtime:rnt-364',
    });

    expect(config.runtimeImage).toBe('ghcr.io/acme/rntme-runtime:rnt-364');
    expect(config.modules).toEqual({
      'identity-auth0': {
        image: 'registry/identity-auth0:1',
        env: { AUTH0_DOMAIN: 'tenant.us.auth0.com' },
      },
      stripe: { image: 'registry/stripe:1' },
    });
    expect(config.auth).toEqual({
      auth0: {
        clientId: 'public-client-id',
        domain: 'demo-rntme.us.auth0.com',
        audience: 'https://notes-demo.rntme.com/api',
        redirectUri: 'https://notes-demo.rntme.com/',
      },
    });
    expect(config.policies).toEqual({
      rateLimit: { edge: { requestsPerMinute: 60, burst: 10 } },
      timeout: { edge: { upstreamTimeoutMs: 1000 } },
    });
  });

  it('preserves arbitrary target module facets used by vars resolution', () => {
    const config = buildProjectDeploymentConfig(
      {
        ...target(),
        modules: {
          'marketing-site': {
            primaryDomain: 'marketing.example.test',
            ssl: 'auto',
          } as never,
        },
      },
      'acme',
      {},
    );

    expect(config.modules?.['marketing-site']).toEqual({
      primaryDomain: 'marketing.example.test',
      ssl: 'auto',
    });
  });

  it('passes operatonUi and adminUserSecretRef through to deploy-core', () => {
    const config = buildProjectDeploymentConfig(
      {
        ...target(),
        eventBus: { kind: 'kafka', mode: 'provisioned', provider: 'redpanda' },
        workflows: {
          engine: {
            kind: 'operaton',
            mode: 'provisioned',
            image: 'operaton/operaton:test',
            adminUserSecretRef: 'operaton-admin-user-v1',
          },
          worker: { image: 'ghcr.io/rntme/bpmn-worker:test' },
          operatonUi: {
            enabled: true,
            publicBaseUrl: 'https://operaton.acme.example.test',
            auth: { kind: 'basic', secretRef: 'operaton-ui-basic-auth-v1' },
          },
        },
      },
      'acme',
      {},
    );

    expect(config.workflows).toEqual({
      engine: {
        kind: 'operaton',
        mode: 'provisioned',
        image: 'operaton/operaton:test',
        adminUserSecretRef: 'operaton-admin-user-v1',
      },
      worker: { image: 'ghcr.io/rntme/bpmn-worker:test' },
      operatonUi: {
        enabled: true,
        publicBaseUrl: 'https://operaton.acme.example.test',
        auth: { kind: 'basic', secretRef: 'operaton-ui-basic-auth-v1' },
      },
    });
  });
});

describe('buildDokployTargetConfig', () => {
  it('normalizes Dokploy endpoint and forwards project ref', () => {
    expect(buildDokployTargetConfig(target(), { publicBaseUrl: 'https://app.example.test' })).toEqual({
      endpoint: 'https://dokploy.example.test',
      projectId: 'project-1',
      allowCreateProject: false,
      publicBaseUrl: 'https://app.example.test',
    });
  });

  it('uses the deploy target public app base URL by default', () => {
    expect(buildDokployTargetConfig(target(), {})).toMatchObject({
      endpoint: 'https://dokploy.example.test',
      publicBaseUrl: 'https://notes.example.test',
    });
  });

  it('derives a wildcard public app URL for legacy targets without a configured URL', () => {
    expect(
      buildDokployTargetConfig(
        { ...target(), publicBaseUrl: null },
        {},
        { orgSlug: 'acme', projectSlug: 'notes-demo', environment: 'default', publicDeployDomain: '*.rntme.com' },
      ).publicBaseUrl,
    ).toBe('https://acme-notes-demo-default.rntme.com');
  });

  it('rejects legacy targets without a public app base URL unless an override is provided', () => {
    expect(() =>
      buildDokployTargetConfig({ ...target(), publicBaseUrl: null }, {}),
    ).toThrow(/DEPLOY_TARGET_PUBLIC_BASE_URL_REQUIRED/);
    expect(
      buildDokployTargetConfig(
        { ...target(), publicBaseUrl: null },
        { publicBaseUrl: 'https://override.example.test' },
      ).publicBaseUrl,
    ).toBe('https://override.example.test');
  });
});

function target(): DeployTargetForBuild {
  return {
    id: 'target-1',
    slug: 'staging',
    displayName: 'Staging',
    kind: 'dokploy',
    dokployUrl: 'https://dokploy.example.test/api',
    publicBaseUrl: 'https://notes.example.test',
    dokployProjectId: 'project-1',
    dokployProjectName: null,
    allowCreateProject: false,
    eventBus: { kind: 'kafka', mode: 'external', brokers: ['redpanda:9092'] },
    storage: { mode: 'external' },
    modules: {},
    workflows: null,
    auth: {},
    policyValues: { rateLimit: { edge: { requestsPerMinute: 60, burst: 10 } } },
    manualAccess: {},
  };
}
