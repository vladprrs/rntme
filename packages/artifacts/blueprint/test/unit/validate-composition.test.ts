import { describe, expect, it } from 'bun:test';
import type { ModuleManifest } from '@rntme/contracts-module-v1';
import { validateBlueprintComposition } from '../../src/validate/composition.js';
import type { AuthProviderDecl } from '../../src/types/artifact.js';

const expectErrorCodes = (
  r: ReturnType<typeof validateBlueprintComposition>,
  codes: readonly string[],
) => {
  expect(r.ok).toBe(false);
  if (!r.ok) {
    expect(r.errors.map((e) => e.code)).toEqual(
      expect.arrayContaining([...codes]),
    );
  }
};

const svc = (
  slug: string,
  kind: 'domain' | 'integration' | 'integration-module',
  artifacts: Partial<{
    hasGraphs: boolean;
    hasBindings: boolean;
    hasUi: boolean;
    hasSeed: boolean;
    hasQsm: boolean;
    hasStorage: boolean;
    hasCommandHandlers: boolean;
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
    hasStorage: false,
    hasCommandHandlers: false,
    ...artifacts,
  },
});

const moduleManifest = (name: string, vendor: string): ModuleManifest =>
  ({ name, vendor } as Partial<ModuleManifest> as ModuleManifest);

// Helper: build an auth0-style provider entry without forcing callers to satisfy the
// discriminated-union narrowing when the test wants to exercise composition with a
// provider literal that isn't 'auth0' or 'platform-tokens' (e.g. unknown/clerk fixtures).
const auth0Provider = (
  moduleSlug: string,
  audience: string,
  providerLiteral: string = 'auth0',
): AuthProviderDecl =>
  ({
    provider: providerLiteral,
    audience,
    moduleSlug,
  } as unknown as AuthProviderDecl);

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
          auth: {
            kind: 'auth',
            providers: [
              auth0Provider('mod-workos', 'https://demo.rntme.com/api', 'workos'),
            ],
          },
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
          auth: {
            kind: 'auth',
            providers: [auth0Provider('catalog', 'https://x/api')],
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
          (e) =>
            e.code ===
            'BLUEPRINT_COMPOSE_MIDDLEWARE_PROVIDER_NOT_INTEGRATION' &&
            e.path === 'project.middleware.auth.providers.0.moduleSlug',
        ),
      ).toBe(true);
    }
  });

  it('rejects invalid route targets and missing route artifacts', () => {
    const r = validateBlueprintComposition({
      project: {
        name: 'bad-routes',
        services: ['catalog', 'mod-auth'],
        routes: {
          http: {
            '/api/missing': 'missing',
            '/api/catalog': 'catalog',
          },
          ui: { '/': 'mod-auth' },
        },
      },
      services: {
        catalog: svc('catalog', 'domain'),
        'mod-auth': svc('mod-auth', 'integration', { hasUi: true }),
      },
    });

    expectErrorCodes(r, [
      'BLUEPRINT_COMPOSE_ROUTE_UNKNOWN_SERVICE',
      'BLUEPRINT_COMPOSE_HTTP_ROUTE_TARGET_MISSING_BINDINGS',
      'BLUEPRINT_COMPOSE_UI_ROUTE_TARGET_NOT_DOMAIN',
    ]);
  });

  it('allows middleware without a provider', () => {
    const r = validateBlueprintComposition({
      project: {
        name: 'providerless-middleware',
        services: ['catalog'],
        routes: { http: { '/api/catalog': 'catalog' } },
        middleware: {
          requestContext: { kind: 'request-context' },
        },
        mounts: [{ target: 'http:/api/catalog', use: ['requestContext'] }],
      },
      services: {
        catalog: svc('catalog', 'domain', { hasBindings: true }),
      },
    });

    expect(r.ok).toBe(true);
  });

  it('allows auth middleware moduleSlug to reference an integration-module service', () => {
    const r = validateBlueprintComposition({
      project: {
        name: 'notes-demo',
        services: ['app', 'identity-auth0'],
        routes: { http: { '/api': 'app' } },
        middleware: {
          auth: {
            kind: 'auth',
            providers: [
              auth0Provider('identity-auth0', 'https://notes-demo.rntme.com/api'),
            ],
          },
        },
        mounts: [{ target: 'http:/api', use: ['auth'] }],
      },
      services: {
        app: svc('app', 'domain', { hasBindings: true }),
        'identity-auth0': svc('identity-auth0', 'integration-module'),
      },
    });

    expect(r.ok).toBe(true);
  });

  it('allows auth middleware when the identity module vendor matches the provider', () => {
    const input = {
      project: {
        name: 'notes-demo',
        services: ['app', 'identity-auth0'],
        routes: { http: { '/api': 'app' } },
        middleware: {
          auth: {
            kind: 'auth' as const,
            providers: [
              auth0Provider('identity-auth0', 'https://notes-demo.rntme.com/api'),
            ],
          },
        },
        mounts: [{ target: 'http:/api', use: ['auth'] }],
      },
      services: {
        app: svc('app', 'domain', { hasBindings: true }),
        'identity-auth0': svc('identity-auth0', 'integration-module'),
      },
      catalogManifest: {
        components: [],
        operations: [],
        modulesWithBoot: [{ name: '@rntme/identity-auth0' }],
        categoryToModule: { identity: '@rntme/identity-auth0' },
        publicConfig: {},
        moduleEdgeAuth: {
          '@rntme/identity-auth0': {
            kind: 'introspection-sidecar' as const,
            transport: 'http' as const,
            method: 'GET' as const,
            path: '/introspect',
            port: 50052,
          },
        },
      },
      discoveredModules: {
        '@rntme/identity-auth0': {
          manifest: moduleManifest('@rntme/identity-auth0', 'auth0'),
          packageDir: '/tmp/identity-auth0',
          projectKey: 'identity',
          publicConfig: {},
        },
      },
    };

    const r = validateBlueprintComposition(input);

    expect(r.ok).toBe(true);
  });

  it('rejects auth middleware when module context has no identity module', () => {
    const input = {
      project: {
        name: 'notes-demo',
        services: ['app', 'identity-auth0'],
        routes: { http: { '/api': 'app' } },
        middleware: {
          auth: {
            kind: 'auth' as const,
            providers: [
              auth0Provider('identity-auth0', 'https://notes-demo.rntme.com/api'),
            ],
          },
        },
        mounts: [{ target: 'http:/api', use: ['auth'] }],
      },
      services: {
        app: svc('app', 'domain', { hasBindings: true }),
        'identity-auth0': svc('identity-auth0', 'integration-module'),
      },
      catalogManifest: {
        components: [],
        operations: [],
        modulesWithBoot: [],
        categoryToModule: {},
        publicConfig: {},
        moduleEdgeAuth: {},
      },
      discoveredModules: {},
    };

    const r = validateBlueprintComposition(input);

    expectErrorCodes(r, ['BLUEPRINT_AUTH_MODULE_MISMATCH']);
  });

  it('rejects auth middleware when the identity module vendor does not match the provider', () => {
    const input = {
      project: {
        name: 'notes-demo',
        services: ['app', 'identity-auth0'],
        routes: { http: { '/api': 'app' } },
        middleware: {
          auth: {
            kind: 'auth' as const,
            providers: [
              auth0Provider(
                'identity-auth0',
                'https://notes-demo.rntme.com/api',
                'clerk',
              ),
            ],
          },
        },
        mounts: [{ target: 'http:/api', use: ['auth'] }],
      },
      services: {
        app: svc('app', 'domain', { hasBindings: true }),
        'identity-auth0': svc('identity-auth0', 'integration-module'),
      },
      catalogManifest: {
        components: [],
        operations: [],
        modulesWithBoot: [{ name: '@rntme/identity-auth0' }],
        categoryToModule: { identity: '@rntme/identity-auth0' },
        publicConfig: {},
        moduleEdgeAuth: {},
      },
      discoveredModules: {
        '@rntme/identity-auth0': {
          manifest: moduleManifest('@rntme/identity-auth0', 'auth0'),
          packageDir: '/tmp/identity-auth0',
          projectKey: 'identity',
          publicConfig: {},
        },
      },
    };

    const r = validateBlueprintComposition(input);

    expectErrorCodes(r, ['BLUEPRINT_AUTH_MODULE_MISMATCH']);
  });

  it('rejects unknown middleware providers and bad mount references', () => {
    const r = validateBlueprintComposition({
      project: {
        name: 'bad-mounts',
        services: ['catalog'],
        routes: { http: { '/api/catalog': 'catalog' } },
        middleware: {
          auth: {
            kind: 'auth',
            providers: [auth0Provider('missing-auth', 'https://x/api')],
          },
        },
        mounts: [{ target: 'http:/api/missing', use: ['auth', 'ghost'] }],
      },
      services: {
        catalog: svc('catalog', 'domain', { hasBindings: true }),
      },
    });

    expectErrorCodes(r, [
      'BLUEPRINT_COMPOSE_MIDDLEWARE_PROVIDER_UNKNOWN_SERVICE',
      'BLUEPRINT_COMPOSE_MOUNT_UNKNOWN_TARGET',
      'BLUEPRINT_COMPOSE_MOUNT_UNKNOWN_MIDDLEWARE',
    ]);
    if (!r.ok) {
      expect(
        r.errors.some(
          (e) =>
            e.code === 'BLUEPRINT_COMPOSE_MIDDLEWARE_PROVIDER_UNKNOWN_SERVICE' &&
            e.path === 'project.middleware.auth.providers.0.moduleSlug',
        ),
      ).toBe(true);
    }
  });

  it('returns multiple independent composition errors together', () => {
    const r = validateBlueprintComposition({
      project: {
        name: 'many-errors',
        services: ['catalog'],
        routes: {
          http: { '/api/catalog': 'catalog' },
          ui: { '/': 'ghost' },
        },
        middleware: {
          auth: {
            kind: 'auth',
            providers: [auth0Provider('ghost', 'https://x/api')],
          },
        },
        mounts: [{ target: 'http:/ghost', use: ['ghost'] }],
      },
      services: {
        catalog: svc('catalog', 'domain'),
      },
    });

    expectErrorCodes(r, [
      'BLUEPRINT_COMPOSE_HTTP_ROUTE_TARGET_MISSING_BINDINGS',
      'BLUEPRINT_COMPOSE_ROUTE_UNKNOWN_SERVICE',
      'BLUEPRINT_COMPOSE_MIDDLEWARE_PROVIDER_UNKNOWN_SERVICE',
      'BLUEPRINT_COMPOSE_MOUNT_UNKNOWN_TARGET',
      'BLUEPRINT_COMPOSE_MOUNT_UNKNOWN_MIDDLEWARE',
    ]);
    if (!r.ok) {
      expect(r.errors).toHaveLength(5);
    }
  });

  it('accepts auth middleware with provider="platform-tokens" pointing at a domain service', () => {
    const r = validateBlueprintComposition({
      project: {
        name: 'platform',
        services: ['app', 'tokens'],
        routes: { http: { '/api/tokens': 'tokens', '/api/app': 'app' } },
        middleware: {
          auth: {
            kind: 'auth',
            providers: [
              {
                provider: 'platform-tokens',
                moduleSlug: 'tokens',
                introspectPath: '/api/tokens/introspect',
                introspectPort: 3000,
              },
            ],
          },
        },
        mounts: [{ target: 'http:/api/app', use: ['auth'] }],
      },
      services: {
        app: svc('app', 'domain', { hasBindings: true }),
        tokens: svc('tokens', 'domain', { hasBindings: true }),
      },
    });

    expect(r.ok, r.ok ? '' : JSON.stringify(r.errors, null, 2)).toBe(true);
  });

  it('does not require an identity module when auth provider is platform-tokens', () => {
    const r = validateBlueprintComposition({
      project: {
        name: 'platform',
        services: ['app', 'tokens'],
        routes: { http: { '/api/tokens': 'tokens', '/api/app': 'app' } },
        middleware: {
          auth: {
            kind: 'auth',
            providers: [
              {
                provider: 'platform-tokens',
                moduleSlug: 'tokens',
                introspectPath: '/api/tokens/introspect',
                introspectPort: 3000,
              },
            ],
          },
        },
        mounts: [{ target: 'http:/api/app', use: ['auth'] }],
      },
      services: {
        app: svc('app', 'domain', { hasBindings: true }),
        tokens: svc('tokens', 'domain', { hasBindings: true }),
      },
      catalogManifest: {
        components: [],
        operations: [],
        modulesWithBoot: [],
        categoryToModule: {},
        publicConfig: {},
        moduleEdgeAuth: {},
      },
      discoveredModules: {},
    });

    expect(r.ok, r.ok ? '' : JSON.stringify(r.errors, null, 2)).toBe(true);
  });

  it('rejects mounted auth middleware when the identity module lacks edgeAuth', () => {
    const input = {
      project: {
        name: 'notes-demo',
        services: ['app', 'identity-auth0'],
        routes: { http: { '/api': 'app' } },
        middleware: {
          auth: {
            kind: 'auth' as const,
            providers: [
              auth0Provider('identity-auth0', 'https://notes-demo.rntme.com/api'),
            ],
          },
        },
        mounts: [{ target: 'http:/api', use: ['auth'] }],
      },
      services: {
        app: svc('app', 'domain', { hasBindings: true }),
        'identity-auth0': svc('identity-auth0', 'integration-module'),
      },
      catalogManifest: {
        components: [],
        operations: [],
        modulesWithBoot: [{ name: '@rntme/identity-auth0' }],
        categoryToModule: { identity: '@rntme/identity-auth0' },
        publicConfig: {},
        moduleEdgeAuth: { '@rntme/identity-auth0': null },
      },
      discoveredModules: {
        '@rntme/identity-auth0': {
          manifest: moduleManifest('@rntme/identity-auth0', 'auth0'),
          packageDir: '/tmp/identity-auth0',
          projectKey: 'identity',
          publicConfig: {},
        },
      },
    };

    const r = validateBlueprintComposition(input);

    expectErrorCodes(r, ['BLUEPRINT_AUTH_MODULE_EDGE_AUTH_MISSING']);
    if (!r.ok) {
      expect(r.errors[0]).toMatchObject({
        path: 'project.middleware.auth -> @rntme/identity-auth0/module.json#capabilities.edgeAuth',
      });
    }
  });

  it('accepts mixed platform-tokens and auth0 providers for one mounted auth middleware', () => {
    const r = validateBlueprintComposition({
      project: {
        name: 'platform',
        services: ['app', 'tokens', 'identity-auth0'],
        routes: { http: { '/api/app': 'app', '/api/tokens': 'tokens' } },
        middleware: {
          auth: {
            kind: 'auth',
            providers: [
              {
                provider: 'platform-tokens',
                moduleSlug: 'tokens',
                introspectPath: '/api/tokens/introspect',
                introspectPort: 3000,
              },
              {
                provider: 'auth0',
                audience: 'https://platform.rntme.com/api',
                moduleSlug: 'identity-auth0',
              },
            ],
          },
        },
        mounts: [{ target: 'http:/api/app', use: ['auth'] }],
      },
      services: {
        app: svc('app', 'domain', { hasBindings: true }),
        tokens: svc('tokens', 'domain', { hasBindings: true }),
        'identity-auth0': svc('identity-auth0', 'integration-module'),
      },
      catalogManifest: {
        components: [],
        operations: [],
        modulesWithBoot: [{ name: '@rntme/identity-auth0' }],
        categoryToModule: { identity: '@rntme/identity-auth0' },
        publicConfig: {},
        moduleEdgeAuth: {
          '@rntme/identity-auth0': {
            kind: 'introspection-sidecar',
            transport: 'http',
            method: 'GET',
            path: '/introspect',
            port: 50052,
          },
        },
      },
      discoveredModules: {
        '@rntme/identity-auth0': {
          manifest: moduleManifest('@rntme/identity-auth0', 'auth0'),
          packageDir: '/tmp/identity-auth0',
          projectKey: 'identity',
          publicConfig: {},
        },
      },
    });

    expect(r.ok, r.ok ? '' : JSON.stringify(r.errors, null, 2)).toBe(true);
  });

  it('reports the failing provider index when a provider references an unknown service', () => {
    const r = validateBlueprintComposition({
      project: {
        name: 'platform',
        services: ['app', 'tokens'],
        routes: { http: { '/api/app': 'app', '/api/tokens': 'tokens' } },
        middleware: {
          auth: {
            kind: 'auth',
            providers: [
              {
                provider: 'platform-tokens',
                moduleSlug: 'tokens',
                introspectPath: '/api/tokens/introspect',
                introspectPort: 3000,
              },
              auth0Provider('identity-missing', 'https://platform.rntme.com/api'),
            ],
          },
        },
        mounts: [{ target: 'http:/api/app', use: ['auth'] }],
      },
      services: {
        app: svc('app', 'domain', { hasBindings: true }),
        tokens: svc('tokens', 'domain', { hasBindings: true }),
      },
    });

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(
        r.errors.some(
          (e) =>
            e.code === 'BLUEPRINT_COMPOSE_MIDDLEWARE_PROVIDER_UNKNOWN_SERVICE' &&
            e.path === 'project.middleware.auth.providers.1.moduleSlug',
        ),
      ).toBe(true);
    }
  });

});
