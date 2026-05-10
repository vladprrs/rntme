import { describe, expect, it } from 'bun:test';
import { buildProjectDeploymentPlan } from '../../src/plan.js';
import { planEdge } from '../../src/edge.js';
import type { ComposedProjectInput } from '../../src/composed-project.js';
import type { ProjectDeploymentConfig } from '../../src/config.js';
import type { DeploymentWorkload } from '../../src/plan.js';

const baseProject: ComposedProjectInput = {
  name: 'commerce',
  services: {
    app: { slug: 'app', kind: 'domain' },
    catalog: { slug: 'catalog', kind: 'domain' },
    'mod-workos': { slug: 'mod-workos', kind: 'integration' },
  },
  modules: {
    'mod-workos': {
      edgeAuth: {
        kind: 'introspection-sidecar',
        transport: 'http',
        method: 'GET',
        path: '/introspect',
        port: 50052,
      },
    },
  },
  routes: {
    ui: { '/': 'app' },
    http: {
      '/api/catalog': 'catalog',
      '/oauth': 'mod-workos',
    },
  },
  middleware: {
    requestContext: { kind: 'request-context', policy: 'default' },
    rateLimit: { kind: 'rate-limit', policy: 'default' },
    auth: {
      kind: 'auth',
      provider: 'auth0',
      audience: 'https://commerce.example.com/api',
      moduleSlug: 'mod-workos',
    },
  },
  mounts: [
    { target: 'ui:/', use: ['requestContext'] },
    { target: 'http:/api/catalog', use: ['rateLimit'] },
  ],
};

const config: ProjectDeploymentConfig = {
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
      expose: true,
      env: { AUTH0_DOMAIN: 'tenant.us.auth0.com' },
    },
  },
  auth: {
    auth0: {
      clientId: 'public-spa-client-id',
    },
  },
  policies: {
    requestContext: {
      default: {
        requestIdHeader: 'x-request-id',
        correlationIdHeader: 'x-correlation-id',
      },
    },
    rateLimit: {
      default: { requestsPerMinute: 60, burst: 20 },
    },
  },
};

describe('edge planning', () => {
  it('plans UI and HTTP routes plus supported middleware', () => {
    const middleware = {
      requestContext: baseProject.middleware?.requestContext,
      rateLimit: baseProject.middleware?.rateLimit,
    };
    const project = { ...baseProject, middleware };

    const r = buildProjectDeploymentPlan(project, config);

    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(r.value.edge.routes).toEqual([
      { id: 'ui:/', kind: 'ui', path: '/', targetService: 'app', targetWorkload: 'app' },
      {
        id: 'http:/api/catalog',
        kind: 'http',
        path: '/api/catalog',
        targetService: 'catalog',
        targetWorkload: 'catalog',
      },
      {
        id: 'http:/oauth',
        kind: 'http',
        path: '/oauth',
        targetService: 'mod-workos',
        targetWorkload: 'mod-workos',
      },
    ]);
    expect(r.value.edge.middleware).toEqual([
      {
        mountTarget: 'ui:/',
        name: 'requestContext',
        kind: 'request-context',
        policy: 'default',
        config: { requestIdHeader: 'x-request-id', correlationIdHeader: 'x-correlation-id' },
      },
      {
        mountTarget: 'http:/api/catalog',
        name: 'rateLimit',
        kind: 'rate-limit',
        policy: 'default',
        config: { requestsPerMinute: 60, burst: 20 },
      },
    ]);
  });

  it('plans auth middleware as a runtime marker when the module workload is valid', () => {
    const project = {
      ...baseProject,
      routes: {
        ui: { '/': 'app' },
        http: { '/api/catalog': 'catalog' },
      },
      mounts: [{ target: 'http:/api/catalog', use: ['auth'] }],
    };

    const r = buildProjectDeploymentPlan(project, config);

    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(r.value.edge.middleware).toEqual([
      {
        mountTarget: 'http:/api/catalog',
        name: 'auth',
        kind: 'auth',
        provider: 'auth0',
        audience: 'https://commerce.example.com/api',
        moduleSlug: 'mod-workos',
        moduleIntrospectPort: 50052,
      },
    ]);
  });

  it('rejects auth middleware without required provider, audience, and moduleSlug', () => {
    const project = {
      ...baseProject,
      middleware: {
        auth: { kind: 'auth', provider: 'auth0' },
      },
      mounts: [{ target: 'http:/api/catalog', use: ['auth'] }],
    };

    const r = buildProjectDeploymentPlan(project, config);

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toContainEqual(
        expect.objectContaining({
          code: 'DEPLOY_PLAN_AUTH_MIDDLEWARE_INCOMPLETE',
          middleware: 'auth',
        }),
      );
    }
  });

  it('rejects auth middleware referencing a missing module workload', () => {
    const project = {
      ...baseProject,
      middleware: {
        auth: {
          kind: 'auth',
          provider: 'auth0',
          audience: 'https://commerce.example.com/api',
          moduleSlug: 'identity-auth0',
        },
      },
      mounts: [{ target: 'http:/api/catalog', use: ['auth'] }],
    };

    const r = buildProjectDeploymentPlan(project, config);

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toContainEqual(
        expect.objectContaining({
          code: 'DEPLOY_PLAN_AUTH_MODULE_WORKLOAD_MISSING',
          middleware: 'auth',
          service: 'identity-auth0',
        }),
      );
    }
  });

  it('rejects Auth0 module workloads without AUTH0_DOMAIN env', () => {
    const project = {
      ...baseProject,
      routes: {
        ui: { '/': 'app' },
        http: { '/api/catalog': 'catalog' },
      },
      mounts: [{ target: 'http:/api/catalog', use: ['auth'] }],
    };

    const r = buildProjectDeploymentPlan(project, {
      ...config,
      modules: {
        'mod-workos': {
          image: 'ghcr.io/acme/mod-workos:2026-04-24',
          expose: true,
        },
      },
    });

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toContainEqual(
        expect.objectContaining({
          code: 'DEPLOY_PLAN_AUTH_MODULE_ENV_INCOMPLETE',
          service: 'mod-workos',
          path: 'modules.mod-workos.env.AUTH0_DOMAIN',
        }),
      );
    }
  });

  it('accepts auth middleware without Auth0 SPA client id because public config comes from the composed project', () => {
    const project = {
      ...baseProject,
      routes: {
        ui: { '/': 'app' },
        http: { '/api/catalog': 'catalog' },
      },
      mounts: [{ target: 'http:/api/catalog', use: ['auth'] }],
    };

    const r = buildProjectDeploymentPlan(project, {
      ...config,
      auth: undefined,
    });

    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(r.value.edge.middleware).toContainEqual(
      expect.objectContaining({
        kind: 'auth',
        provider: 'auth0',
        audience: 'https://commerce.example.com/api',
        moduleSlug: 'mod-workos',
      }),
    );
  });

  it('rejects a public integration route when the module is not explicitly exposed', () => {
    const r = buildProjectDeploymentPlan(baseProject, {
      ...config,
      modules: {
        'mod-workos': {
          image: 'ghcr.io/acme/mod-workos:2026-04-24',
          expose: false,
        },
      },
    });

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toContainEqual(
        expect.objectContaining({
          code: 'DEPLOY_PLAN_PUBLIC_MODULE_NOT_EXPOSED',
          service: 'mod-workos',
          route: '/oauth',
        }),
      );
    }
  });

  it('rejects missing policy values', () => {
    const project = {
      ...baseProject,
      middleware: {
        rateLimit: { kind: 'rate-limit', policy: 'missing' },
      },
      mounts: [{ target: 'http:/api/catalog', use: ['rateLimit'] }],
    };

    const r = buildProjectDeploymentPlan(project, config);

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toContainEqual(
        expect.objectContaining({
          code: 'DEPLOY_PLAN_MISSING_POLICY_VALUE',
          policy: 'missing',
          middleware: 'rateLimit',
          cause: [
            expect.objectContaining({
              code: 'DEPLOY_PLAN_MISSING_POLICY_VALUE_HINT',
              message: expect.stringContaining('policyOverrides'),
            }),
          ],
        }),
      );
    }
  });

  it('rejects mount middleware names without declarations', () => {
    const project = {
      ...baseProject,
      middleware: {
        rateLimit: { kind: 'rate-limit', policy: 'default' },
      },
      mounts: [{ target: 'http:/api/catalog', use: ['missingMiddleware', 'rateLimit'] }],
    };

    const r = buildProjectDeploymentPlan(project, config);

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toContainEqual(
        expect.objectContaining({
          code: 'DEPLOY_PLAN_MISSING_MIDDLEWARE_DECLARATION',
          middleware: 'missingMiddleware',
          path: 'mounts.http:/api/catalog.use.missingMiddleware',
        }),
      );
    }
  });

  it('rejects mount targets without matching planned routes', () => {
    const project = {
      ...baseProject,
      middleware: {
        rateLimit: { kind: 'rate-limit', policy: 'default' },
      },
      mounts: [{ target: 'http:/missing', use: ['rateLimit'] }],
    };

    const r = buildProjectDeploymentPlan(project, config);

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toContainEqual(
        expect.objectContaining({
          code: 'DEPLOY_PLAN_MOUNT_TARGET_MISSING_ROUTE',
          route: 'http:/missing',
          path: 'mounts.http:/missing.target',
        }),
      );
      expect(r.errors).not.toContainEqual(
        expect.objectContaining({
          code: 'DEPLOY_PLAN_MISSING_POLICY_VALUE',
          middleware: 'rateLimit',
        }),
      );
    }
  });
});

// ---------------------------------------------------------------------------
// planEdge direct tests — moduleIntrospectPort
// ---------------------------------------------------------------------------

function baseConfigWithModuleImage(moduleSlug: string): ProjectDeploymentConfig {
  return {
    orgSlug: 'acme',
    environment: 'default',
    mode: 'preview',
    eventBus: {
      kind: 'kafka',
      mode: 'external',
      brokers: ['redpanda.internal:9092'],
    },
    modules: {
      [moduleSlug]: {
        image: `ghcr.io/acme/${moduleSlug}:latest`,
        expose: false,
        env: { AUTH0_DOMAIN: 'tenant.us.auth0.com' },
      },
    },
  };
}

function workloadsWith(
  moduleSlug: string,
  opts: { expose: boolean; env: Record<string, string> },
): readonly DeploymentWorkload[] {
  return [
    { kind: 'domain-service', slug: 'app', serviceSlug: 'app', resourceName: 'rntme-acme-p-app', runtime: { image: 'img' }, artifact: { source: 'composed-project', serviceSlug: 'app' }, runtimeFiles: {}, publicConfigJson: '{}', persistence: { mode: 'ephemeral' } },
    { kind: 'integration-module', slug: moduleSlug, serviceSlug: moduleSlug, resourceName: `rntme-acme-p-${moduleSlug}`, image: `ghcr.io/acme/${moduleSlug}:latest`, expose: opts.expose, env: opts.env, secretRefs: {} },
    { kind: 'edge-gateway', slug: 'edge', resourceName: 'rntme-acme-p-edge', image: 'nginx:1.27-alpine' },
  ];
}

describe('planEdge — moduleIntrospectPort', () => {
  it('plans auth middleware with moduleIntrospectPort from module edgeAuth', () => {
    const result = planEdge(
      {
        name: 'p',
        services: {
          app: { slug: 'app', kind: 'domain' },
          'identity-auth0': { slug: 'identity-auth0', kind: 'integration' },
        },
        modules: {
          'identity-auth0': {
            edgeAuth: {
              kind: 'introspection-sidecar',
              transport: 'http',
              method: 'GET',
              path: '/introspect',
              port: 50052,
            },
          },
        },
        routes: { http: { '/api': 'app' } },
        middleware: {
          auth: {
            kind: 'auth',
            provider: 'auth0',
            audience: 'https://demo.example.com/api',
            moduleSlug: 'identity-auth0',
          },
        },
        mounts: [{ target: 'http:/api', use: ['auth'] }],
      },
      /* config */ baseConfigWithModuleImage('identity-auth0'),
      /* workloads */ workloadsWith('identity-auth0', { expose: false, env: { AUTH0_DOMAIN: 'd' } }),
    );
    expect(result.errors).toHaveLength(0);
    const auth = result.edge.middleware.find((m) => m.kind === 'auth')!;
    expect(auth.moduleIntrospectPort).toBe(50052);
  });

  it('rejects auth middleware when module has no edgeAuth', () => {
    const result = planEdge(
      {
        name: 'p',
        services: {
          app: { slug: 'app', kind: 'domain' },
          'identity-noop': { slug: 'identity-noop', kind: 'integration' },
        },
        modules: { 'identity-noop': { edgeAuth: null } },
        routes: { http: { '/api': 'app' } },
        middleware: {
          auth: {
            kind: 'auth',
            provider: 'noop',
            audience: 'https://demo.example.com/api',
            moduleSlug: 'identity-noop',
          },
        },
        mounts: [{ target: 'http:/api', use: ['auth'] }],
      },
      baseConfigWithModuleImage('identity-noop'),
      workloadsWith('identity-noop', { expose: false, env: {} }),
    );
    const codes = result.errors.map((e) => e.code);
    expect(codes).toContain('DEPLOY_PLAN_AUTH_MODULE_HTTP_INTROSPECT_MISSING');
  });
});
