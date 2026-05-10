import { describe, expect, it } from 'bun:test';
import { buildProjectDeploymentPlan } from '../../src/plan.js';
import type { ComposedProjectInput } from '../../src/composed-project.js';
import type { ProjectDeploymentConfig } from '../../src/config.js';

const baseProject: ComposedProjectInput = {
  name: 'shop',
  services: {
    api: { slug: 'api', kind: 'domain', runtimeFiles: { 'manifest.json': '{}' } },
  },
  routes: { http: { '/api': 'api' } },
  middleware: {},
  mounts: [],
};

const baseConfig: ProjectDeploymentConfig = {
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

describe('buildProjectDeploymentPlan vars', () => {
  it('substitutes ${VAR} from target into module publicConfig', () => {
    const plan = buildProjectDeploymentPlan(
      {
        ...baseProject,
        publicConfigJson: '{"identity":{"clientId":"${CID}"}}',
        varsManifest: { CID: { from: 'target.auth.auth0.clientId', required: true } },
      },
      {
        ...baseConfig,
        auth: { auth0: { clientId: 'CCC' } },
      },
    );
    expect(plan.ok).toBe(true);
    if (plan.ok) {
      const workload = plan.value.workloads.find(
        (w) => w.kind === 'domain-service' && w.slug === 'api',
      );
      expect(workload).toBeDefined();
      expect((workload as { publicConfigJson: string }).publicConfigJson).toContain('"clientId":"CCC"');
      expect((workload as { publicConfigJson: string }).publicConfigJson).not.toContain('${CID}');
    }
  });

  it('fails the plan with DEPLOY_PLAN_TARGET_VAR_MISSING when required var unavailable', () => {
    const plan = buildProjectDeploymentPlan(
      {
        ...baseProject,
        publicConfigJson: '{"identity":{"clientId":"${CID}"}}',
        varsManifest: { CID: { from: 'target.auth.auth0.clientId', required: true } },
      },
      {
        ...baseConfig,
        auth: {},
      },
    );
    expect(plan.ok).toBe(false);
    if (!plan.ok) {
      expect(plan.errors[0]!.code).toBe('DEPLOY_PLAN_TARGET_VAR_MISSING');
      expect(plan.errors[0]!.varName).toBe('CID');
      expect(plan.errors[0]!.targetSlug).toBe('staging');
    }
  });

  it('leaves unresolved placeholders intact when var is optional and missing', () => {
    const plan = buildProjectDeploymentPlan(
      {
        ...baseProject,
        publicConfigJson: '{"identity":{"clientId":"${CID}"}}',
        varsManifest: { CID: { from: 'target.auth.auth0.clientId', required: false } },
      },
      {
        ...baseConfig,
        auth: {},
      },
    );
    expect(plan.ok).toBe(true);
    if (plan.ok) {
      const workload = plan.value.workloads.find(
        (w) => w.kind === 'domain-service' && w.slug === 'api',
      );
      expect(workload).toBeDefined();
      expect((workload as { publicConfigJson: string }).publicConfigJson).toContain('${CID}');
    }
  });

  it('substitutes ${VAR} from target into auth middleware audience', () => {
    const plan = buildProjectDeploymentPlan(
      {
        ...baseProject,
        services: {
          ...baseProject.services,
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
        middleware: {
          auth: {
            kind: 'auth',
            provider: 'auth0',
            audience: '${AUD}',
            moduleSlug: 'identity-auth0',
          },
        },
        mounts: [{ target: 'http:/api', use: ['auth'] }],
        varsManifest: { AUD: { from: 'target.auth.auth0.audience', required: true } },
      },
      {
        ...baseConfig,
        modules: {
          'identity-auth0': {
            image: 'ghcr.io/rntme/identity-auth0:test',
            env: { AUTH0_DOMAIN: 'demo-rntme.us.auth0.com' },
          },
        },
        auth: {
          auth0: {
            clientId: 'spa-client',
            audience: 'https://notes-demo.rntme.com/api',
          },
        } as ProjectDeploymentConfig['auth'],
      },
    );
    expect(plan.ok).toBe(true);
    if (plan.ok) {
      expect(plan.value.edge.middleware).toContainEqual(
        expect.objectContaining({
          kind: 'auth',
          audience: 'https://notes-demo.rntme.com/api',
        }),
      );
    }
  });
});
