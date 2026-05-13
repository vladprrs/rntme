import { describe, expect, it } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
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

async function captureError(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
    return null;
  } catch (err) {
    return err;
  }
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

    // Project-routed runtime artifacts: domain services mount the binding
    // router at "/" because their binding paths already include the project
    // route prefix (e.g. /api/projects, /api/tokens/introspect).
    const projectsManifest = JSON.parse(
      result.services.projects?.runtimeFiles?.['manifest.json'] ?? '{}',
    ) as { surface?: { http?: { bindingBasePath?: string } } };
    expect(projectsManifest.surface?.http?.bindingBasePath).toBe('/');

    const projectsBindings = JSON.parse(
      result.services.projects?.runtimeFiles?.['bindings.json'] ?? '{}',
    ) as { bindings?: Record<string, { http?: { path?: string } }> };
    expect(projectsBindings.bindings?.listProjects?.http?.path).toBe('/api/projects');
    expect(projectsBindings.bindings?.publishProjectBundle?.http?.path).toBe(
      '/api/projects/{projectId}/versions',
    );

    const tokensManifest = JSON.parse(
      result.services.tokens?.runtimeFiles?.['manifest.json'] ?? '{}',
    ) as { surface?: { http?: { bindingBasePath?: string } } };
    expect(tokensManifest.surface?.http?.bindingBasePath).toBe('/');
    expect(result.services.tokens?.persistence).toEqual({
      mode: 'persistent',
      eventStorePath: '/srv/data/events.sqlite',
      qsmPath: '/srv/data/qsm.sqlite',
    });

    const tokensBindings = JSON.parse(
      result.services.tokens?.runtimeFiles?.['bindings.json'] ?? '{}',
    ) as { bindings?: Record<string, { http?: { path?: string } }> };
    expect(tokensBindings.bindings?.introspectToken?.http?.path).toBe('/api/tokens/introspect');

    // Native operation handlers (operations.json + handlers/*.ts) must ride
    // along inside the runtime artifact bundle, otherwise the runtime cannot
    // dispatch native bindings (T027a).
    const tokensFiles = result.services.tokens?.runtimeFiles ?? {};
    expect(tokensFiles['operations.json']).toBeDefined();
    const tokensOps = JSON.parse(tokensFiles['operations.json'] ?? '{}') as {
      operations?: Record<string, { handler?: { entry?: string } }>;
    };
    expect(tokensOps.operations?.IntrospectToken?.handler?.entry).toBe(
      './handlers/introspect-token.ts',
    );
    expect(tokensFiles['handlers/introspect-token.js']).toBeDefined();
    const introspectBundle = tokensFiles['handlers/introspect-token.js'] ?? '';
    expect(introspectBundle).toContain('introspectTokenHandler');
    // Bundle must inline workspace deps so the runtime can import the file
    // without traversing /srv/node_modules from the artifact mount.
    expect(introspectBundle).not.toMatch(/from\s+['"]@rntme\/platform-core['"]/);
  });

  it('bundles cv-extract UI runtime files from a relative blueprint directory', async () => {
    const cvDir = relative(process.cwd(), join(repoRoot, 'demo', 'cv-extract-blueprint'));
    const composed = await loadComposedBlueprint(cvDir);
    expect(composed.ok, composed.ok ? '' : JSON.stringify((composed as { errors?: unknown }).errors, null, 2)).toBe(true);
    if (!composed.ok) return;

    const result = await toDeployCoreInput(composed.value, cvDir);
    const app = result.services['app'];

    expect(app?.kind).toBe('domain');
    expect(Object.keys(app?.runtimeFiles ?? {}).some((path) => path.startsWith('ui-build/'))).toBe(true);
  });

  it('bundles platform token introspection as a runtime-native handler with typed auth errors', async () => {
    const platformDir = join(repoRoot, 'apps', 'platform', 'blueprint');
    const composed = await loadComposedBlueprint(platformDir);
    expect(composed.ok, composed.ok ? '' : JSON.stringify(composed.errors, null, 2)).toBe(true);
    if (!composed.ok) return;

    const result = await toDeployCoreInput(composed.value, platformDir);
    const tokensFiles = result.services.tokens?.runtimeFiles ?? {};
    const bundle = tokensFiles['handlers/introspect-token.js'];
    expect(bundle).toBeDefined();
    if (bundle === undefined) return;

    const dir = mkdtempSync(join(tmpdir(), 'deploy-bundle-platform-token-handler-'));
    try {
      mkdirSync(join(dir, 'handlers'), { recursive: true });
      const handlerPath = join(dir, 'handlers', 'introspect-token.js');
      writeFileSync(handlerPath, bundle);
      const mod = await import(`${pathToFileURL(handlerPath).href}?t=${Date.now()}`);
      const handler = mod.introspectTokenHandler as (
        inputs: Record<string, unknown>,
        ctx: { correlation: { commandId: string; correlationId: string; traceparent: null } },
      ) => Promise<unknown>;
      const ctx = {
        correlation: { commandId: 'cmd-1', correlationId: 'corr-1', traceparent: null },
      };

      const unknownPatError = await captureError(
        handler({ bearerToken: `Bearer rntme_pat_${'z'.repeat(22)}` }, ctx),
      );
      expect(unknownPatError).toBeInstanceOf(Error);
      expect((unknownPatError as Error & { code?: string }).code).toBe('PLATFORM_AUTH_INVALID');
      expect((unknownPatError as Error).message).not.toContain('deps.provider');

      const missingError = await captureError(handler({}, ctx));
      expect(missingError).toBeInstanceOf(Error);
      expect((missingError as Error & { code?: string }).code).toBe('PLATFORM_AUTH_MISSING');
      expect((missingError as Error).message).not.toContain('deps.provider');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('converts platform blueprint without wiring tokens as a module proto', async () => {
    const platformDir = join(repoRoot, 'apps', 'platform', 'blueprint');
    const composed = await loadComposedBlueprint(platformDir);
    expect(composed.ok, composed.ok ? '' : JSON.stringify(composed.errors, null, 2)).toBe(true);
    if (!composed.ok) return;

    const result = await toDeployCoreInput(composed.value, platformDir);
    const projectsManifest = JSON.parse(result.services.projects?.runtimeFiles?.['manifest.json'] ?? '{}');
    const moduleNames = (projectsManifest.modules ?? []).map((m: { name: string }) => m.name);
    expect(moduleNames).toContain('identity-auth0');
    expect(moduleNames).not.toContain('tokens');
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
          storage: {
            version: '1.0',
            routes: {
              'resume-file': {
                id: 'resume-file',
                owner: { aggregate: 'Resume', association: 'file' },
                maxSize: '20MB',
                allowedTypes: ['application/pdf'],
                maxCount: 1,
                auth: { requireRole: null },
                lifecycle: { expirePending: '15m', retainCommitted: '30d' },
              },
            },
          },
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
      expect(result.modules?.storage?.packageName).toBe('@rntme/storage-s3');
      expect(result.services['storage-s3']?.runtimeFiles?.['storage.json']).toContain('"resume-file"');

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
