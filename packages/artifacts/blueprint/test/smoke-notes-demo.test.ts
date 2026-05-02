import { describe, expect, it } from 'vitest';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadComposedBlueprint } from '../src/compose/load-composed-blueprint.js';

const here = dirname(fileURLToPath(import.meta.url));
const notesDemoDir = join(here, '..', '..', '..', '..', 'demo', 'notes-blueprint');

describe('loadComposedBlueprint (notes demo)', () => {
  it('loads Auth0 edge-auth metadata from the vendored module manifest', () => {
    const r = loadComposedBlueprint(notesDemoDir);
    expect(r.ok, r.ok ? '' : JSON.stringify(r.errors)).toBe(true);
    if (!r.ok) return;

    expect(r.value.catalogManifest?.moduleEdgeAuth['@rntme/identity-auth0']).toEqual({
      kind: 'introspection-sidecar',
      transport: 'http',
      method: 'GET',
      path: '/introspect',
      port: 50052,
    });
    expect(r.value.catalogManifest?.categoryToModule.identity).toBe('@rntme/identity-auth0');
  });
});
