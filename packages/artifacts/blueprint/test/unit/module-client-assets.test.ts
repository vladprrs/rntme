import { describe, expect, it } from 'bun:test';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadComposedBlueprint } from '../../src/compose/load-composed-blueprint.js';

function write(root: string, rel: string, value: string): void {
  const full = join(root, rel);
  mkdirSync(join(full, '..'), { recursive: true });
  writeFileSync(full, value, 'utf8');
}

function minimalProject(moduleJson: object, extra: Record<string, string> = {}): string {
  const root = mkdtempSync(join(tmpdir(), 'rntme-blueprint-client-assets-'));
  write(root, 'project.json', JSON.stringify({
    name: 'client-assets-demo',
    services: ['app'],
    modules: { platformUi: { package: '@rntme/platform-ui' } },
    routes: { ui: { '/': 'app' } },
  }));
  write(root, 'pdm/pdm.json', JSON.stringify({ version: '1' }));
  mkdirSync(join(root, 'pdm', 'entities'), { recursive: true });
  write(root, 'services/app/service.json', JSON.stringify({ kind: 'domain' }));
  write(root, 'services/app/ui/manifest.json', JSON.stringify({
    version: '2.0',
    pdmRef: 'demo.domain.v1',
    qsmRef: 'demo.read.v1',
    graphSpecRef: 'demo.graphs.v1',
    bindingsRef: 'demo.bindings.v1',
    metadata: { title: 'Demo' },
    layouts: { main: 'layouts/main' },
    routes: { '/': { layout: 'main', screen: 'screens/home' } },
  }));
  write(root, 'services/app/ui/layouts/main.spec.json', JSON.stringify({
    root: 'shell',
    elements: { shell: { type: 'Slot', props: {} } },
  }));
  write(root, 'services/app/ui/layouts/main.screen.json', '{}');
  write(root, 'services/app/ui/screens/home.spec.json', JSON.stringify({
    root: 'page',
    elements: { page: { type: 'Text', props: { text: 'Home' } } },
  }));
  write(root, 'services/app/ui/screens/home.screen.json', '{}');
  write(root, 'node_modules/@rntme/platform-ui/package.json', JSON.stringify({
    name: '@rntme/platform-ui',
    exports: { './module.json': './module.json' },
  }));
  write(root, 'node_modules/@rntme/platform-ui/module.json', JSON.stringify(moduleJson));
  for (const [rel, content] of Object.entries(extra)) {
    write(root, `node_modules/@rntme/platform-ui/${rel}`, content);
  }
  return root;
}

describe('module client assets and presets', () => {
  it('builds deterministic uiAssetManifest and uiPresetExports', async () => {
    const root = minimalProject(
      {
        name: '@rntme/platform-ui',
        version: '0.0.0',
        client: {
          assets: {
            stylesheets: [{ id: 'platform-ui', path: 'assets/platform-ui.css', order: 100 }],
            icons: [{ id: 'logo-monogram', path: 'assets/logo-monogram.svg' }],
            preloads: [{ path: 'assets/platform-ui.css', as: 'style' }],
          },
          presets: [
            { name: 'service-card', kind: 'fragment', path: 'fragments/service-card', inputs: { name: { type: 'string', required: true } } },
          ],
        },
      },
      {
        'assets/platform-ui.css': '.platform-ui { color: black; }',
        'assets/logo-monogram.svg': '<svg role="img"></svg>',
        'fragments/service-card.spec.json': JSON.stringify({
          root: 'card',
          elements: { card: { type: 'Text', props: { text: { $param: 'name' } } } },
        }),
      },
    );

    const result = await loadComposedBlueprint(root);

    expect(result.ok, result.ok ? '' : JSON.stringify(result.errors, null, 2)).toBe(true);
    if (!result.ok) return;
    expect(result.value.uiAssetManifest?.stylesheets).toEqual([
      {
        id: 'platform-ui',
        moduleKey: 'platformUi',
        moduleName: '@rntme/platform-ui',
        href: '/assets/modules/platformUi/stylesheets/platform-ui.css',
        order: 100,
        media: 'all',
        scope: 'document',
      },
    ]);
    expect(result.value.uiAssetManifest?.preloads).toEqual([
      {
        moduleKey: 'platformUi',
        moduleName: '@rntme/platform-ui',
        href: '/assets/modules/platformUi/stylesheets/platform-ui.css',
        as: 'style',
      },
    ]);
    expect(result.value.uiAssetSources?.[0]).toMatchObject({
      moduleKey: 'platformUi',
      moduleName: '@rntme/platform-ui',
      sourceRelativePath: 'assets/platform-ui.css',
      runtimePath: 'ui-build/modules/platformUi/stylesheets/platform-ui.css',
    });
    expect(result.value.uiPresetExports?.[0]).toMatchObject({
      moduleKey: 'platformUi',
      moduleName: '@rntme/platform-ui',
      name: 'service-card',
      kind: 'fragment',
      path: 'fragments/service-card',
    });
  });

  it('rejects missing asset and preset files with blueprint error codes', async () => {
    const root = minimalProject({
      name: '@rntme/platform-ui',
      version: '0.0.0',
      client: {
        assets: { stylesheets: [{ id: 'missing', path: 'assets/missing.css' }] },
        presets: [{ name: 'missing', kind: 'fragment', path: 'fragments/missing', inputs: {} }],
      },
    });

    const result = await loadComposedBlueprint(root);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'BLUEPRINT_MODULE_CLIENT_ASSET_MISSING')).toBe(true);
      expect(result.errors.some((e) => e.code === 'BLUEPRINT_MODULE_CLIENT_PRESET_MISSING')).toBe(true);
    }
  });

  it('rejects JavaScript static assets before they reach runtime', async () => {
    const root = minimalProject(
      {
        name: '@rntme/platform-ui',
        version: '0.0.0',
        client: {
          assets: { staticFiles: [{ id: 'bad-js', path: 'assets/bad.js' }] },
        },
      },
      { 'assets/bad.js': 'alert("no")' },
    );

    const result = await loadComposedBlueprint(root);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'BLUEPRINT_MODULE_CLIENT_ASSET_SCRIPT_REJECTED')).toBe(true);
    }
  });
});
