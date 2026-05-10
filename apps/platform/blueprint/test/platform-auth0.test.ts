import { describe, expect, it } from 'bun:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadComposedBlueprint } from '../../../../packages/artifacts/blueprint/src/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const blueprintRoot = join(here, '..');

describe('platform Auth0 wiring', () => {
  it('uses Auth0 as the platform identity module', async () => {
    const result = await loadComposedBlueprint(blueprintRoot);
    expect(result.ok, result.ok ? '' : JSON.stringify(result.errors, null, 2)).toBe(true);
    if (!result.ok) return;

    expect(result.value.project.modules?.identity?.package).toBe('rntme_identity_auth0');
    expect(result.value.catalogManifest?.moduleEdgeAuth['@rntme/identity-auth0']).toMatchObject({
      kind: 'introspection-sidecar',
      transport: 'http',
      method: 'GET',
      path: '/introspect',
      port: 50052,
    });
    for (const mount of result.value.project.mounts ?? []) {
      if (mount.target.startsWith('http:')) expect(mount.use).toContain('auth');
    }
  });
});
