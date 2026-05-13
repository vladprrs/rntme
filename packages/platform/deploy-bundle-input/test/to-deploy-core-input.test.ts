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
  it('propagates moduleKey from a ComposedBlueprint service descriptor', async () => {
    const composed = {
      project: { name: 'demo', services: ['storage-s3'] },
      pdm: { entities: {} } as never,
      routing: { httpBaseByService: {}, uiPathsByService: {} },
      bindingRegistry: {},
      services: {
        'storage-s3': {
          slug: 'storage-s3',
          kind: 'integration-module' as const,
          moduleKey: 'storage',
          qsm: null,
          artifacts: {
            hasGraphs: false,
            hasBindings: false,
            hasUi: false,
            hasSeed: false,
            hasQsm: false,
            hasStorage: false,
            hasCommandHandlers: false,
          },
          graphSpec: null,
          qsmValidated: null,
          bindings: null,
          seed: null,
          storage: null,
          compiledUi: null,
          eventTypes: [],
        } as never,
      },
      publicConfigJson: null,
      varsManifest: {},
    };
    const tmp = mkdtempSync(join(tmpdir(), 'deploy-bundle-modulekey-'));
    try {
      const result = await toDeployCoreInput(composed as never, tmp);
      expect(result.services['storage-s3']).toEqual({
        slug: 'storage-s3',
        kind: 'integration-module',
        moduleKey: 'storage',
      });
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('omits moduleKey when the descriptor has no module alias', async () => {
    const composed = {
      project: { name: 'demo', services: ['mod-workos'] },
      pdm: { entities: {} } as never,
      routing: { httpBaseByService: {}, uiPathsByService: {} },
      bindingRegistry: {},
      services: {
        'mod-workos': {
          slug: 'mod-workos',
          kind: 'integration' as const,
          qsm: null,
          artifacts: {
            hasGraphs: false,
            hasBindings: false,
            hasUi: false,
            hasSeed: false,
            hasQsm: false,
            hasStorage: false,
            hasCommandHandlers: false,
          },
          graphSpec: null,
          qsmValidated: null,
          bindings: null,
          seed: null,
          storage: null,
          compiledUi: null,
          eventTypes: [],
        } as never,
      },
      publicConfigJson: null,
      varsManifest: {},
    };
    const tmp = mkdtempSync(join(tmpdir(), 'deploy-bundle-modulekey-'));
    try {
      const result = await toDeployCoreInput(composed as never, tmp);
      expect(result.services['mod-workos']).toEqual({ slug: 'mod-workos', kind: 'integration' });
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

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

  it('emits cv-extract style runtime manifest modules + canonical proto artifacts for a domain app calling storage + openrouter', async () => {
    // Inline fixture mirrors demo/cv-extract-blueprint: services=[app,
    // openrouter, storage-s3], storage-s3 has moduleKey="storage", and the
    // app graph calls both storage and openrouter modules. We assert that
    // toDeployCoreInput emits the new manifest modules and the canonical
    // proto artifacts at protos/ai_llm.proto, protos/storage.proto, and
    // protos/rntme/contracts/common/v1/common.proto.
    const appGraphSpec = {
      version: '1.0-rc7',
      shapes: {},
      graphs: {
        extractResume: {
          id: 'extractResume',
          signature: { inputs: {}, output: { type: 'row<Out>', from: 'out' } },
          nodes: [
            {
              id: 'download',
              type: 'call',
              target: { module: 'storage', operation: 'GetDownloadUrl' },
              input: {},
              policy: {},
            },
            {
              id: 'completion',
              type: 'call',
              target: { module: 'openrouter', operation: 'Complete' },
              input: {},
              policy: {},
            },
            { id: 'out', type: 'result', value: {} },
          ],
        },
      },
    };
    const composed = {
      project: {
        name: 'cv-extract',
        services: ['app', 'openrouter', 'storage-s3'],
        modules: {
          openrouter: { package: '@rntme/ai-llm-openrouter' },
          storage: { package: '@rntme/storage-s3' },
        },
        routes: { ui: { '/': 'app' }, http: { '/api': 'app' } },
      },
      pdm: { entities: {} },
      routing: { httpBaseByService: {}, uiPathsByService: {} },
      bindingRegistry: {},
      varsManifest: {},
      publicConfigJson: null,
      services: {
        app: {
          slug: 'app',
          kind: 'domain',
          artifacts: {
            hasGraphs: true,
            hasBindings: true,
            hasUi: true,
            hasSeed: false,
            hasQsm: true,
            hasStorage: false,
            hasCommandHandlers: false,
          },
          qsm: null,
          graphSpec: appGraphSpec,
          qsmValidated: { projections: {}, relations: {} },
          bindings: { artifact: { bindings: {} }, resolved: {} },
          seed: null,
          storage: null,
          compiledUi: null,
          eventTypes: [],
        },
        openrouter: {
          slug: 'openrouter',
          kind: 'integration-module',
          moduleKey: 'openrouter',
          artifacts: {
            hasGraphs: false,
            hasBindings: false,
            hasUi: false,
            hasSeed: false,
            hasQsm: false,
            hasStorage: false,
            hasCommandHandlers: false,
          },
          qsm: null,
          graphSpec: null,
          qsmValidated: null,
          bindings: null,
          seed: null,
          storage: null,
          compiledUi: null,
          eventTypes: [],
        },
        'storage-s3': {
          slug: 'storage-s3',
          kind: 'integration-module',
          moduleKey: 'storage',
          artifacts: {
            hasGraphs: false,
            hasBindings: false,
            hasUi: false,
            hasSeed: false,
            hasQsm: false,
            hasStorage: false,
            hasCommandHandlers: false,
          },
          qsm: null,
          graphSpec: null,
          qsmValidated: null,
          bindings: null,
          seed: null,
          storage: null,
          compiledUi: null,
          eventTypes: [],
        },
      },
    };

    const tmp = mkdtempSync(join(tmpdir(), 'deploy-bundle-cvextract-'));
    try {
      const result = await toDeployCoreInput(composed as never, tmp);
      const app = result.services['app'];
      expect(app?.kind).toBe('domain');

      const manifest = JSON.parse(app?.runtimeFiles?.['manifest.json'] ?? '{}') as {
        modules?: Array<{ name: string; grpc: { address: string }; protoPath: string }>;
      };
      expect(manifest.modules).toEqual([
        { name: 'openrouter', grpc: { address: 'mod-openrouter:50051' }, protoPath: 'protos/ai_llm.proto' },
        { name: 'storage', grpc: { address: 'mod-storage-s3:50051' }, protoPath: 'protos/storage.proto' },
      ]);

      expect(app?.runtimeFiles?.['protos/ai_llm.proto']).toContain('service AiLlmModule');
      expect(app?.runtimeFiles?.['protos/ai_llm.proto']).toContain('rpc Complete(CreateCompletionRequest)');
      expect(app?.runtimeFiles?.['protos/storage.proto']).toContain('service StorageModule');
      expect(app?.runtimeFiles?.['protos/storage.proto']).toContain('rpc GetDownloadUrl');
      expect(app?.runtimeFiles?.['protos/rntme/contracts/common/v1/common.proto']).toContain(
        'package rntme.contracts.common.v1',
      );
      expect(app?.runtimeFiles?.['protos/rntme/contracts/common/v1/common.proto']).toContain(
        'message CommandContext',
      );
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
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
