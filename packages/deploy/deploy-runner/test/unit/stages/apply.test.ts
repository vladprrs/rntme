import { describe, expect, it } from 'bun:test';
import type { DeploymentApplyResult, DokployClient, RenderedDokployPlan } from '@rntme/deploy-dokploy';
import { apply } from '../../../src/stages/apply.js';

describe('stages.apply', () => {
  it('exports an apply function', () => {
    expect(typeof apply).toBe('function');
  });

  it('passes required secrets without dropping unrelated target-secret extras', async () => {
    let seenExtras: Readonly<Record<string, unknown>> | undefined;

    await apply(
      {
        ctx: {
          orgSlug: 'acme',
          target: { kind: 'dokploy' } as never,
          resolvedTargetSecrets: {
            apiToken: 'dokploy-token',
            extras: {
              'module-api-key': 'sk-module',
              'operaton-ui-basic-auth': 'raw-required-secret',
            },
          },
          configOverrides: {},
        },
        rendered: renderedPlan(),
        resolvedRequiredSecrets: {
          'operaton-ui-basic-auth': { htpasswd: 'user:hash' },
        },
        dokployClientFactory: (_apiToken, extras) => {
          seenExtras = extras;
          return {} as DokployClient;
        },
      },
      async () => ({
        ok: true,
        value: applyResult(),
      }),
    );

    expect(seenExtras).toEqual({
      'module-api-key': 'sk-module',
      'operaton-ui-basic-auth': { htpasswd: 'user:hash' },
    });
  });
});

function renderedPlan(): RenderedDokployPlan {
  return {
    target: { kind: 'dokploy', endpoint: 'https://dokploy.example.com' },
    targetProject: { mode: 'existing', projectId: 'project_1' },
    deployment: {
      orgSlug: 'acme',
      projectSlug: 'demo',
      environment: 'default',
      mode: 'preview',
    },
    resources: [],
    urls: {
      projectUrl: 'https://demo.example.com',
      publicRoutes: [],
      protectedRouteChecks: [],
    },
    digest: 'sha256:test',
    warnings: [],
  };
}

function applyResult(): DeploymentApplyResult {
  const rendered = renderedPlan();
  return {
    target: { kind: 'dokploy', environmentId: 'env_default' },
    deployment: rendered.deployment,
    resources: [],
    urls: rendered.urls,
    renderedPlanDigest: rendered.digest,
    warnings: [],
    verificationHints: {
      healthUrl: 'https://demo.example.com/health',
      publicRouteUrls: [],
      protectedRouteChecks: [],
    },
  };
}
