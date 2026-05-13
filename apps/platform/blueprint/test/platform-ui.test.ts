import { describe, expect, it } from 'bun:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadComposedBlueprint } from '../../../../packages/artifacts/blueprint/src/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const blueprintRoot = join(here, '..');

describe('platform UI artifact', () => {
  it('compiles platform UI routes against platform bindings', async () => {
    const result = await loadComposedBlueprint(blueprintRoot);
    expect(result.ok, result.ok ? '' : JSON.stringify(result.errors, null, 2)).toBe(true);
    if (!result.ok) return;

    const ui = result.value.services.app?.compiledUi;
    expect(ui).toBeDefined();
    expect(ui?.manifest.routes['/']).toMatchObject({ screen: 'login' });
    expect(ui?.manifest.routes['/auth/callback']).toMatchObject({ screen: 'login' });
    expect(ui?.manifest.routes['/:orgId']).toMatchObject({ screen: 'org' });
    expect(ui?.manifest.routes['/:orgId/deployments/:deploymentId']).toMatchObject({ screen: 'deployment' });
    expect(ui?.screens.org?.data?.['/data/projects']?.path).toBe('/api/projects');
    expect(ui?.screens.deployment?.data?.['/data/logs']?.path).toBe('/api/deployments/{deploymentId}/logs');
    expect(JSON.parse(result.value.publicConfigJson ?? '{}')).toMatchObject({
      '@rntme/identity-auth0': {
        postLoginRedirectPath: '/no-org',
        authenticatedRedirectPaths: ['/', '/login', '/auth/callback'],
      },
    });
    expect(result.value.virtualEntrySource).toContain("import('@rntme/identity-auth0/client')");
    expect(result.value.virtualEntrySource).toContain("bootContract: 'identity'");
    expect(result.value.catalogManifest?.components.map((c) => c.type)).toEqual(
      expect.arrayContaining(['PlatformPageHeader', 'PlatformDataTable', 'PlatformSidebar']),
    );
    expect(result.value.uiAssetManifest?.stylesheets[0]).toMatchObject({
      id: 'platform-ui',
      moduleKey: 'platformUi',
      href: '/assets/modules/platformUi/stylesheets/platform-ui.css',
    });
    expect(result.value.virtualEntrySource).toContain("import('@rntme/platform-ui/client')");
  });
});
