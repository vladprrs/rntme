import type { ModuleManifest } from '@rntme/contracts-module-v1';
import { describe, expect, it } from 'bun:test';
import { buildCatalog } from '../../src/compose/catalog.js';
import type { DiscoveredModule } from '../../src/compose/modules.js';

describe('buildCatalog', () => {
  it('populates moduleEdgeAuth from each module manifest', () => {
    const result = buildCatalog({
      '@rntme/identity-auth0': discoveredModule({
        name: '@rntme/identity-auth0',
        version: '0.0.0',
        capabilities: {
          rpcs: ['IntrospectSession'],
          events: [],
          edgeAuth: {
            kind: 'introspection-sidecar',
            transport: 'http',
            method: 'GET',
            path: '/introspect',
            port: 50052,
          },
        },
      }),
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.moduleEdgeAuth['@rntme/identity-auth0']).toEqual({
        kind: 'introspection-sidecar',
        transport: 'http',
        method: 'GET',
        path: '/introspect',
        port: 50052,
      });
    }
  });

  it('records null in moduleEdgeAuth for modules without edgeAuth', () => {
    const result = buildCatalog({
      '@rntme/some-noop': discoveredModule({
        name: '@rntme/some-noop',
        version: '0.0.0',
        capabilities: { rpcs: ['Foo'], events: [] },
      }),
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.moduleEdgeAuth['@rntme/some-noop']).toBeNull();
    }
  });
});

function discoveredModule(manifest: ModuleManifest): DiscoveredModule {
  return {
    manifest,
    packageDir: '/tmp/module',
    projectKey: 'identity',
    publicConfig: {},
  };
}
