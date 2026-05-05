import { describe, expect, it } from 'vitest';
import {
  validateBindings,
  type BindingArtifact,
  type BindingResolvers,
  type ValidatedBindings,
} from '@rntme/bindings';
import type { ModuleManifest } from '@rntme/contracts-module-v1';
import { validateBlueprintComposition } from '../../src/validate/composition.js';

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

const moduleManifest = (name: string, vendor: string): ModuleManifest =>
  ({ name, vendor } as Partial<ModuleManifest> as ModuleManifest);

function bindingsWithPre(input: {
  id: string;
  graph: string;
  audience: string;
  bindAs: string;
}): ValidatedBindings {
  const artifact: BindingArtifact = {
    version: '1.0',
    graphSpecRef: '../graphs',
    pdmRef: '../../pdm',
    qsmRef: '../qsm',
    bindings: {
      [input.id]: {
        graph: input.graph,
        target: { engine: 'sqlite', dialect: 'sqlite' },
        http: { method: 'GET', path: '/notes', parameters: [] },
        pre: [
          {
            kind: 'module-rpc',
            module: 'identity-auth0',
            rpc: 'IntrospectSession',
            input: { audience: input.audience },
            bindAs: input.bindAs,
          },
        ],
      },
    },
  };
  const resolvers: BindingResolvers = {
    resolveGraphSignature: (graphId) => graphId === input.graph
      ? {
          id: graphId,
          inputs: {},
          output: { type: { kind: 'rowset', shape: 'NoteView' }, from: 'rows' },
        }
      : null,
    resolveShape: (shapeName) => shapeName === 'NoteView'
      ? {
          name: 'NoteView',
          origin: 'custom',
          fields: {
            id: { type: { kind: 'scalar', primitive: 'string' }, nullable: false },
          },
        }
      : null,
  };
  const result = validateBindings(artifact, resolvers, {
    declaredModules: new Set(['identity-auth0']),
  });
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.value;
}

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
            provider: 'auth0',
            audience: 'https://notes-demo.rntme.com/api',
            moduleSlug: 'identity-auth0',
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
            kind: 'auth',
            provider: 'auth0',
            audience: 'https://notes-demo.rntme.com/api',
            moduleSlug: 'identity-auth0',
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
            kind: 'auth',
            provider: 'auth0',
            audience: 'https://notes-demo.rntme.com/api',
            moduleSlug: 'identity-auth0',
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
            kind: 'auth',
            provider: 'clerk',
            audience: 'https://notes-demo.rntme.com/api',
            moduleSlug: 'identity-auth0',
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
          auth: { kind: 'auth', provider: 'missing-auth' },
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
          auth: { kind: 'auth', provider: 'ghost' },
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

  it('rejects mounted auth middleware when the identity module lacks edgeAuth', () => {
    const input = {
      project: {
        name: 'notes-demo',
        services: ['app', 'identity-auth0'],
        routes: { http: { '/api': 'app' } },
        middleware: {
          auth: {
            kind: 'auth',
            provider: 'auth0',
            audience: 'https://notes-demo.rntme.com/api',
            moduleSlug: 'identity-auth0',
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

  it('rejects auth middleware audience mismatches in mounted service binding pre-steps', () => {
    const r = validateBlueprintComposition({
      project: {
        name: 'notes',
        services: ['app', 'identity-auth0'],
        routes: { http: { '/api': 'app' } },
        middleware: {
          auth: {
            kind: 'auth',
            provider: 'auth0',
            audience: 'https://notes.example/api',
            moduleSlug: 'identity-auth0',
          },
        },
        mounts: [{ target: 'http:/api', use: ['auth'] }],
      },
      services: {
        app: {
          ...svc('app', 'domain', { hasBindings: true }),
          bindings: bindingsWithPre({
            id: 'listNotes',
            graph: 'listNotes',
            audience: 'https://wrong.example/api',
            bindAs: 'session',
          }),
        },
        'identity-auth0': svc('identity-auth0', 'integration'),
      },
    });

    expectErrorCodes(r, ['BLUEPRINT_AUTH_AUDIENCE_MISMATCH']);
  });

  it('allows auth middleware audience placeholder before target vars are resolved', () => {
    const r = validateBlueprintComposition({
      project: {
        name: 'notes',
        services: ['app', 'identity-auth0'],
        routes: { http: { '/api': 'app' } },
        middleware: {
          auth: {
            kind: 'auth',
            provider: 'auth0',
            audience: '${AUTH0_AUDIENCE}',
            moduleSlug: 'identity-auth0',
          },
        },
        mounts: [{ target: 'http:/api', use: ['auth'] }],
        vars: {
          AUTH0_AUDIENCE: { from: 'target.auth.auth0.audience', required: true },
        },
      },
      services: {
        app: {
          ...svc('app', 'domain', { hasBindings: true }),
          bindings: bindingsWithPre({
            id: 'listNotes',
            graph: 'listNotes',
            audience: 'https://notes.example/api',
            bindAs: 'session',
          }),
        },
        'identity-auth0': svc('identity-auth0', 'integration'),
      },
    });

    expect(r.ok).toBe(true);
  });

  it('rejects graph $pre references not backed by the binding pre[].bindAs names', () => {
    const r = validateBlueprintComposition({
      project: {
        name: 'notes',
        services: ['app'],
        routes: { http: { '/api': 'app' } },
      },
      services: {
        app: {
          ...svc('app', 'domain', { hasBindings: true, hasGraphs: true }),
          graphSpec: {
            version: '1.0-rc7',
            shapes: {},
            graphs: {
              createNote: {
                id: 'createNote',
                signature: {
                  inputs: {},
                  output: { type: 'row<CommandResult>', from: 'e' },
                },
                nodes: [
                  {
                    id: 'e',
                    type: 'emit',
                    config: {
                      aggregate: 'Note',
                      aggregateId: { $param: 'id' },
                      transition: 'create',
                      payload: { ownerSub: { $pre: 'session.user_id' } },
                    },
                  },
                ],
              },
            },
          },
          bindings: bindingsWithPre({
            id: 'createNote',
            graph: 'createNote',
            audience: 'https://notes.example/api',
            bindAs: 'actor',
          }),
        },
      },
    });

    expectErrorCodes(r, ['BLUEPRINT_GRAPH_PRE_REF_UNDEFINED_BINDING']);
  });
});
