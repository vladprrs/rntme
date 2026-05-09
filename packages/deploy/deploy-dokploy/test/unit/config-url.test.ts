import { describe, expect, it } from 'vitest';
import type { ProjectDeploymentPlan } from '@rntme/deploy-core';
import { renderDokployPlan } from '../../src/render.js';
import { validateDokployTargetConfig, type DokployTargetConfig } from '../../src/config.js';

const minimalPlan: ProjectDeploymentPlan = {
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

describe('validateDokployTargetConfig', () => {
  it('accepts valid http(s) URLs and normalizes root trailing slash', () => {
    const a = validateDokployTargetConfig({
      endpoint: 'https://dokploy.example.com/',
      projectId: 'p',
      publicBaseUrl: 'http://127.0.0.1:3000',
    });
    expect(a.ok).toBe(true);
    if (!a.ok) return;
    expect(a.value.endpoint).toBe('https://dokploy.example.com');
    expect(a.value.publicBaseUrl).toBe('http://127.0.0.1:3000');
  });

  it('normalizes path trailing slashes consistently', () => {
    const a = validateDokployTargetConfig({
      endpoint: 'https://api.example/v1/',
      projectId: 'p',
      publicBaseUrl: 'https://app.example/prefix/',
    });
    expect(a.ok).toBe(true);
    if (!a.ok) return;
    expect(a.value.endpoint).toBe('https://api.example/v1');
    expect(a.value.publicBaseUrl).toBe('https://app.example/prefix');
  });

  it('trims surrounding whitespace', () => {
    const a = validateDokployTargetConfig({
      endpoint: '  https://dokploy.test  ',
      projectId: 'p',
      publicBaseUrl: ' \thttps://app.test/\n',
    });
    expect(a.ok).toBe(true);
    if (!a.ok) return;
    expect(a.value.endpoint).toBe('https://dokploy.test');
    expect(a.value.publicBaseUrl).toBe('https://app.test');
  });

  it('rejects invalid protocol', () => {
    const a = validateDokployTargetConfig({
      endpoint: 'ftp://dokploy.example',
      projectId: 'p',
      publicBaseUrl: 'https://app.example',
    });
    expect(a.ok).toBe(false);
    if (a.ok) return;
    expect(a.errors[0]).toMatchObject({ code: 'DEPLOY_DOKPLOY_INVALID_TARGET_URL', path: 'endpoint' });
  });

  it('rejects missing host', () => {
    const a = validateDokployTargetConfig({
      endpoint: 'https://dokploy.example',
      projectId: 'p',
      publicBaseUrl: 'https://',
    });
    expect(a.ok).toBe(false);
    if (a.ok) return;
    expect(a.errors.some((e) => e.path === 'publicBaseUrl')).toBe(true);
  });

  it('rejects empty endpoint and publicBaseUrl with distinct paths', () => {
    const a = validateDokployTargetConfig({
      endpoint: '   ',
      projectId: 'p',
      publicBaseUrl: '',
    });
    expect(a.ok).toBe(false);
    if (a.ok) return;
    expect(a.errors).toHaveLength(2);
    expect(new Set(a.errors.map((e) => e.path))).toEqual(new Set(['endpoint', 'publicBaseUrl']));
  });

  it('rejects missing endpoint and publicBaseUrl with structured errors', () => {
    const a = validateDokployTargetConfig({ projectId: 'p' } as DokployTargetConfig);
    expect(a.ok).toBe(false);
    if (a.ok) return;
    expect(a.errors).toHaveLength(2);
    expect(new Set(a.errors.map((e) => e.path))).toEqual(new Set(['endpoint', 'publicBaseUrl']));
    expect(a.errors.every((e) => e.code === 'DEPLOY_DOKPLOY_INVALID_TARGET_URL')).toBe(true);
  });

  it('does not echo credentials from userinfo in error output', () => {
    const a = validateDokployTargetConfig({
      endpoint: 'https://dokploy.example',
      projectId: 'p',
      publicBaseUrl: 'https://admin:SUPER_SECRET@evil.example/',
    });
    expect(a.ok).toBe(false);
    if (a.ok) return;
    const serialized = JSON.stringify(a.errors);
    expect(serialized).not.toContain('SUPER_SECRET');
    expect(serialized).not.toContain('admin');
  });

  it('rejects query and fragment on target URLs', () => {
    const withQuery = validateDokployTargetConfig({
      endpoint: 'https://x.example?q=1',
      projectId: 'p',
      publicBaseUrl: 'https://app.example',
    });
    expect(withQuery.ok).toBe(false);

    const withHash = validateDokployTargetConfig({
      endpoint: 'https://dokploy.example',
      projectId: 'p',
      publicBaseUrl: 'https://app.example#frag',
    });
    expect(withHash.ok).toBe(false);
  });
});

describe('renderDokployPlan URL validation', () => {
  it('fails render before project resolution when endpoint is invalid', () => {
    const r = renderDokployPlan(minimalPlan, {
      endpoint: 'not-a-url',
      projectId: 'p',
      publicBaseUrl: 'https://app.example',
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors[0]?.code).toBe('DEPLOY_DOKPLOY_INVALID_TARGET_URL');
    expect(r.errors[0]?.path).toBe('endpoint');
  });

  it('preserves a normalized publicBaseUrl path prefix in rendered route URLs', () => {
    const r = renderDokployPlan(minimalPlan, {
      endpoint: 'https://dokploy.example',
      projectId: 'p',
      publicBaseUrl: 'https://app.example/preview///',
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(r.value.urls.projectUrl).toBe('https://app.example/preview');
    expect(r.value.urls.publicRoutes).toEqual([
      { routeId: 'http:/api/catalog', url: 'https://app.example/preview/api/catalog' },
    ]);
    const stack = r.value.resources[0];
    expect(stack.kind).toBe('compose');
    if (stack.kind !== 'compose') return;
    expect(stack.services.find((service) => service.workloadKind === 'edge-gateway')).toBeDefined();
    expect(stack.domains).toEqual([
      {
        host: 'app.example',
        path: '/',
        serviceName: 'edge',
        containerPort: 8080,
        https: true,
      },
    ]);
  });
});
