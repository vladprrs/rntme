import { describe, expect, it } from 'vitest';
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
});
