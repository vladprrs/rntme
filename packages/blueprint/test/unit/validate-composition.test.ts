import { describe, expect, it } from 'vitest';
import { validateBlueprintComposition } from '../../src/validate/composition.js';

const svc = (
  slug: string,
  kind: 'domain' | 'integration',
  artifacts: Partial<{
    hasGraphs: boolean;
    hasBindings: boolean;
    hasUi: boolean;
    hasSeed: boolean;
    hasQsm: boolean;
  }> = {},
) => ({
  slug,
  kind,
  qsm: null,
  artifacts: {
    hasGraphs: false,
    hasBindings: false,
    hasUi: false,
    hasSeed: false,
    hasQsm: false,
    ...artifacts,
  },
});

describe('validateBlueprintComposition', () => {
  it('builds routing context for valid project routes + middleware mounts', () => {
    const r = validateBlueprintComposition({
      project: {
        name: 'product-catalog',
        services: ['catalog', 'app', 'mod-workos'],
        routes: {
          ui: { '/': 'app' },
          http: { '/api/catalog': 'catalog' },
        },
        middleware: {
          requestContext: { kind: 'request-context' },
          auth: { kind: 'auth', provider: 'mod-workos' },
        },
        mounts: [{ target: 'ui:/', use: ['requestContext', 'auth'] }],
      },
      services: {
        catalog: svc('catalog', 'domain', { hasBindings: true }),
        app: svc('app', 'domain', { hasUi: true }),
        'mod-workos': svc('mod-workos', 'integration'),
      },
    });

    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.httpBaseByService.catalog).toBe('/api/catalog');
      expect(r.value.uiPathsByService.app).toEqual(['/']);
    }
  });

  it('rejects a ui route targeting a service without ui/', () => {
    const r = validateBlueprintComposition({
      project: {
        name: 'bad-ui',
        services: ['app'],
        routes: { ui: { '/': 'app' } },
      },
      services: {
        app: svc('app', 'domain'),
      },
    });

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(
        r.errors.some(
          (e) => e.code === 'BLUEPRINT_COMPOSE_UI_ROUTE_TARGET_MISSING_UI',
        ),
      ).toBe(true);
    }
  });

  it('rejects a second http mount for the same service', () => {
    const r = validateBlueprintComposition({
      project: {
        name: 'bad-http',
        services: ['catalog'],
        routes: {
          http: {
            '/api/catalog': 'catalog',
            '/api/catalog-alt': 'catalog',
          },
        },
      },
      services: {
        catalog: svc('catalog', 'domain', { hasBindings: true }),
      },
    });

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(
        r.errors.some(
          (e) => e.code === 'BLUEPRINT_COMPOSE_HTTP_ROUTE_DUPLICATE_SERVICE',
        ),
      ).toBe(true);
    }
  });

  it('rejects a middleware provider that is not integration', () => {
    const r = validateBlueprintComposition({
      project: {
        name: 'bad-middleware',
        services: ['catalog'],
        middleware: {
          auth: { kind: 'auth', provider: 'catalog' },
        },
      },
      services: {
        catalog: svc('catalog', 'domain', { hasBindings: true }),
      },
    });

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(
        r.errors.some(
          (e) =>
            e.code ===
            'BLUEPRINT_COMPOSE_MIDDLEWARE_PROVIDER_NOT_INTEGRATION',
        ),
      ).toBe(true);
    }
  });
});
