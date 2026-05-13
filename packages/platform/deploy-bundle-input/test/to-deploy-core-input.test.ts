import { describe, expect, it } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadComposedBlueprint } from '@rntme/blueprint';
import { toDeployCoreInput } from '../src/to-deploy-core-input.js';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..', '..');

function makeMinimalComposed(): {
  readonly name: string;
  readonly project: { name: string; services: string[] };
  readonly services: Record<string, never>;
  readonly publicConfigJson: null;
  readonly varsManifest: Record<string, never>;
} {
  return {
    name: 'demo',
    project: { name: 'demo', services: [] },
    services: {},
    publicConfigJson: null,
    varsManifest: {},
  };
}

describe('toDeployCoreInput', () => {
  it('passes through ComposedProjectInput shape unchanged when input already matches', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'deploy-bundle-input-'));
    const input = makeMinimalComposed();
    const result = await toDeployCoreInput(input as never, dir);
    expect(result.name).toBe('demo');
    expect(result.services).toEqual({});
  });

  it('emits deploy runtime files for the platform UI-only app service', async () => {
    const platformDir = join(repoRoot, 'apps', 'platform', 'blueprint');
    const composed = await loadComposedBlueprint(platformDir);
    expect(composed.ok).toBe(true);
    if (!composed.ok) return;

    const result = await toDeployCoreInput(composed.value, platformDir);
    const app = result.services['app'];

    expect(app?.kind).toBe('domain');
    expect(app?.runtimeFiles?.['ui/manifest.json']).toContain('"rntme Platform"');
    expect(app?.runtimeFiles?.['bindings.json']).toContain('"projects.listProjects"');
    expect(app?.runtimeFiles?.['graphs/projects.listProjects.json']).toContain('"id": "projects.listProjects"');
    expect(app?.runtimeFiles?.['manifest.json']).toContain('"name": "identity-auth0"');
    expect(Object.keys(app?.runtimeFiles ?? {}).some((path) => path.startsWith('ui-build/'))).toBe(true);
    for (const slug of ['organizations', 'projects', 'tokens', 'audit', 'deployments']) {
      expect(Object.keys(result.services[slug]?.runtimeFiles ?? {}).some((path) => path.startsWith('ui-build/'))).toBe(false);
    }
    const qsm = JSON.parse(app?.runtimeFiles?.['qsm.json'] ?? '{}') as {
      projections?: Record<string, unknown>;
    };
    expect(qsm.projections?.ProjectView).toBeDefined();
    expect(qsm.projections?.OrganizationView).toBeDefined();
  });

  it('throws a partial-artifacts error when a domain service has only some runtime artifacts', async () => {
    const platformDir = join(repoRoot, 'apps', 'platform', 'blueprint');
    const composed = await loadComposedBlueprint(platformDir);
    expect(composed.ok).toBe(true);
    if (!composed.ok) return;

    const broken = {
      ...composed.value,
      services: {
        ...composed.value.services,
        app: {
          ...composed.value.services.app!,
          graphSpec: { version: '1.0-rc7', shapes: {}, graphs: {} },
          qsmValidated: null,
          bindings: null,
        },
      },
    };

    await expect(toDeployCoreInput(broken, platformDir)).rejects.toThrow(
      /DEPLOY_EXECUTOR_SERVICE_ARTIFACTS_PARTIAL:app/,
    );
  });

  it('copies composed UI module assets into the UI host runtime files', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'deploy-bundle-ui-assets-'));
    try {
      // Create a tiny CSS source file in the tmp dir
      const cssSourceDir = join(tmp, 'assets');
      mkdirSync(cssSourceDir, { recursive: true });
      const cssSourcePath = join(cssSourceDir, 'platform-ui.css');
      writeFileSync(cssSourcePath, ':root { --color: #fff; }\n');

      const platformDir = join(repoRoot, 'apps', 'platform', 'blueprint');
      const composed = await loadComposedBlueprint(platformDir);
      expect(composed.ok, composed.ok ? '' : JSON.stringify((composed as { errors?: unknown }).errors, null, 2)).toBe(true);
      if (!composed.ok) return;

      const withAsset = {
        ...composed.value,
        uiAssetManifest: {
          stylesheets: [
            {
              id: 'platform-ui',
              moduleKey: 'platformUi',
              moduleName: '@rntme/platform-ui',
              href: '/assets/modules/platformUi/stylesheets/platform-ui.css',
              order: 100,
              media: 'all',
              scope: 'document' as const,
            },
          ],
          fonts: [],
          icons: [],
          images: [],
          staticFiles: [],
          preloads: [],
        },
        uiAssetSources: [
          {
            moduleKey: 'platformUi',
            moduleName: '@rntme/platform-ui',
            sourcePath: cssSourcePath,
            sourceRelativePath: 'assets/platform-ui.css',
            runtimePath: 'ui-build/modules/platformUi/stylesheets/platform-ui.css',
            href: '/assets/modules/platformUi/stylesheets/platform-ui.css',
          },
        ],
      };

      const result = await toDeployCoreInput(withAsset, platformDir);
      const app = result.services['app'];

      expect(app?.runtimeFiles?.['ui-assets.json']).toContain('"platform-ui"');
      expect(app?.runtimeFiles?.['ui-build/modules/platformUi/stylesheets/platform-ui.css']).toContain(':root');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
