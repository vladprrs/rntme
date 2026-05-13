import { describe, expect, it } from 'bun:test';
import type { ComposedBlueprint } from '@rntme/blueprint';
import {
  buildRuntimeModuleWiringForService,
  buildRuntimeModuleWiringForUiHost,
  buildServiceSlugByModuleKey,
  collectGraphModuleTargets,
} from '../src/runtime-module-wiring.js';

function makeCvExtractFixture(): ComposedBlueprint {
  // Minimal stand-in for the cv-extract demo. Matches services [app,
  // openrouter, storage-s3] with the storage module alias and the three graph
  // calls (storage.GetDownloadUrl, storage.PrepareUpload, openrouter.Complete).
  const appGraphSpec = {
    version: '1.0-rc7' as const,
    shapes: {},
    graphs: {
      prepareResumeFileUpload: {
        id: 'prepareResumeFileUpload',
        signature: {
          inputs: {},
          output: { type: 'row<PrepareUploadResult>', from: 'out' },
        },
        nodes: [
          {
            id: 'prepared',
            type: 'call',
            target: { module: 'storage', operation: 'PrepareUpload' },
            input: {},
            policy: {},
          },
          { id: 'out', type: 'result', value: { $node: 'prepared' } },
        ],
      },
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

  return {
    project: {
      name: 'cv-extract',
      services: ['app', 'openrouter', 'storage-s3'],
      modules: {
        openrouter: { package: '@rntme/ai-llm-openrouter' },
        storage: { package: '@rntme/storage-s3' },
      },
      routes: { ui: { '/': 'app' }, http: { '/api': 'app' } },
    },
    pdm: {} as never,
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
        qsmValidated: null,
        bindings: null,
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
    routing: { httpBaseByService: {}, uiPathsByService: {} },
    bindingRegistry: {},
    varsManifest: {},
  } as ComposedBlueprint;
}

function makePlatformAuthFixture(input: {
  readonly providers: readonly {
    readonly provider: 'platform-tokens' | 'auth0';
    readonly moduleSlug: string;
    readonly audience?: string;
    readonly introspectPath?: string;
    readonly introspectPort?: number;
  }[];
}): ComposedBlueprint {
  return {
    project: {
      name: 'platform',
      services: ['projects', 'tokens', 'identity-auth0'],
      routes: {
        http: {
          '/api/projects': 'projects',
          '/api/tokens': 'tokens',
        },
      },
      middleware: {
        auth: { kind: 'auth', providers: input.providers as never },
      },
      mounts: [{ target: 'http:/api/projects', use: ['auth'] }],
    },
    pdm: {} as never,
    services: {
      projects: {
        slug: 'projects',
        kind: 'domain',
        artifacts: {
          hasGraphs: false,
          hasBindings: true,
          hasUi: false,
          hasSeed: false,
          hasQsm: true,
          hasStorage: false,
          hasCommandHandlers: false,
        },
        qsm: null,
        graphSpec: { version: '1.0-rc7', shapes: {}, graphs: {} },
        qsmValidated: null,
        bindings: null,
        seed: null,
        storage: null,
        compiledUi: null,
        eventTypes: [],
      },
      tokens: {
        slug: 'tokens',
        kind: 'domain',
        artifacts: {
          hasGraphs: false,
          hasBindings: true,
          hasUi: false,
          hasSeed: false,
          hasQsm: true,
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
      'identity-auth0': {
        slug: 'identity-auth0',
        kind: 'integration-module',
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
    routing: { httpBaseByService: {}, uiPathsByService: {} },
    bindingRegistry: {},
    varsManifest: {},
  } as ComposedBlueprint;
}

describe('collectGraphModuleTargets', () => {
  it('collects module names from every call node across every graph', () => {
    const fixture = makeCvExtractFixture();
    const targets = collectGraphModuleTargets(fixture.services.app!.graphSpec);
    expect([...targets].sort()).toEqual(['openrouter', 'storage']);
  });

  it('returns an empty set when the service has no graphs', () => {
    expect(collectGraphModuleTargets(null)).toEqual(new Set());
  });

  it('ignores non-call nodes', () => {
    const targets = collectGraphModuleTargets({
      version: '1.0-rc7',
      shapes: {},
      graphs: {
        g: {
          id: 'g',
          signature: { inputs: {}, output: { type: '', from: 'out' } },
          nodes: [
            { id: 'a', type: 'findMany', config: {} },
            { id: 'out', type: 'result', value: {} },
          ],
        },
      },
    });
    expect(targets.size).toBe(0);
  });
});

describe('buildServiceSlugByModuleKey', () => {
  it('inverts moduleKey aliases declared on integration-module services', () => {
    const fixture = makeCvExtractFixture();
    const map = buildServiceSlugByModuleKey(fixture);
    expect(map.get('storage')).toBe('storage-s3');
    expect(map.get('openrouter')).toBe('openrouter');
    expect(map.has('app')).toBe(false);
  });
});

describe('buildRuntimeModuleWiringForService (cv-extract app)', () => {
  it('emits openrouter + storage manifest entries with mod- addresses and canonical proto paths', () => {
    const fixture = makeCvExtractFixture();
    const wiring = buildRuntimeModuleWiringForService(
      fixture,
      'app',
      buildServiceSlugByModuleKey(fixture),
    );

    expect(wiring.modules).toEqual([
      { name: 'openrouter', grpc: { address: 'mod-openrouter:50051' }, protoPath: 'protos/ai_llm.proto' },
      { name: 'storage', grpc: { address: 'mod-storage-s3:50051' }, protoPath: 'protos/storage.proto' },
    ]);
  });

  it('emits canonical proto file contents at the canonical runtime paths', () => {
    const fixture = makeCvExtractFixture();
    const wiring = buildRuntimeModuleWiringForService(
      fixture,
      'app',
      buildServiceSlugByModuleKey(fixture),
    );

    expect(wiring.files['protos/ai_llm.proto']).toContain('service AiLlmModule');
    expect(wiring.files['protos/ai_llm.proto']).toContain('rpc Complete(CreateCompletionRequest)');
    expect(wiring.files['protos/storage.proto']).toContain('service StorageModule');
    expect(wiring.files['protos/storage.proto']).toContain('rpc GetDownloadUrl');
    expect(wiring.files['protos/rntme/contracts/common/v1/common.proto']).toContain(
      'package rntme.contracts.common.v1',
    );
    // The common proto must live at the canonical import path so module
    // protos that say `import "rntme/contracts/common/v1/common.proto"` resolve.
    expect(wiring.files['protos/rntme/contracts/common/v1/common.proto']).toContain('message CommandContext');
  });

  it('does NOT inline reduced proto snippets — the file content matches the on-disk canonical source', () => {
    const fixture = makeCvExtractFixture();
    const wiring = buildRuntimeModuleWiringForService(
      fixture,
      'app',
      buildServiceSlugByModuleKey(fixture),
    );

    // Spot-check: the canonical storage proto contains every storage RPC, not
    // just the ones the demo currently calls. Reduced "snippet" emissions
    // would be missing the catalog entries.
    expect(wiring.files['protos/storage.proto']).toContain('rpc PrepareUpload');
    expect(wiring.files['protos/storage.proto']).toContain('rpc CommitUpload');
    expect(wiring.files['protos/storage.proto']).toContain('rpc AbortUpload');
    expect(wiring.files['protos/storage.proto']).toContain('rpc DeleteFile');
    expect(wiring.files['protos/storage.proto']).toContain('rpc ListFiles');
  });
});

describe('buildRuntimeModuleWiringForService (auth middleware path)', () => {
  it('emits identity-auth0 manifest entry from middleware.auth.moduleSlug', () => {
    const fixture: ComposedBlueprint = {
      project: {
        name: 'platform',
        services: ['app', 'organizations', 'identity-auth0'],
        routes: { ui: { '/': 'app' }, http: { '/api/organizations': 'organizations' } },
        middleware: {
          auth: {
            kind: 'auth',
            providers: [
              {
                provider: 'auth0',
                audience: 'https://example.com/api',
                moduleSlug: 'identity-auth0',
              },
            ],
          },
        },
        mounts: [
          { target: 'http:/api/organizations', use: ['auth'] },
        ],
      },
      pdm: {} as never,
      services: {
        organizations: {
          slug: 'organizations',
          kind: 'domain',
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
        'identity-auth0': {
          slug: 'identity-auth0',
          kind: 'integration-module',
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
      } as never,
      routing: { httpBaseByService: {}, uiPathsByService: {} },
      bindingRegistry: {},
      varsManifest: {},
    } as ComposedBlueprint;

    const wiring = buildRuntimeModuleWiringForService(
      fixture,
      'organizations',
      buildServiceSlugByModuleKey(fixture),
    );

    expect(wiring.modules).toEqual([
      {
        name: 'identity-auth0',
        grpc: { address: 'mod-identity-auth0:50051' },
        protoPath: 'protos/identity.proto',
      },
    ]);
    expect(wiring.files['protos/identity.proto']).toContain('service IdentityModule');
    expect(wiring.files['protos/rntme/contracts/common/v1/common.proto']).toContain(
      'package rntme.contracts.common.v1',
    );
  });

  it('does not emit a proto module entry for platform-tokens auth providers', () => {
    const fixture = makePlatformAuthFixture({
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
    });

    const wiring = buildRuntimeModuleWiringForService(
      fixture,
      'projects',
      buildServiceSlugByModuleKey(fixture),
    );

    expect(wiring.modules.map((m) => m.name)).toEqual(['identity-auth0']);
    expect(wiring.files['protos/identity.proto']).toContain('service IdentityModule');
  });
});

describe('buildRuntimeModuleWiringForUiHost', () => {
  it('aggregates module entries across every binding-registry source service', () => {
    const fixture = makeCvExtractFixture();
    const withRegistry = {
      ...fixture,
      bindingRegistry: {
        'app.prepareResumeFileUpload': {
          service: 'app',
          bindingId: 'prepareResumeFileUpload',
          qualifiedId: 'app.prepareResumeFileUpload',
          method: 'POST' as const,
          path: '/api/resumes/prepareUpload',
        },
      },
    };
    const wiring = buildRuntimeModuleWiringForUiHost(
      withRegistry,
      buildServiceSlugByModuleKey(withRegistry),
    );
    expect(wiring.modules.map((m) => m.name).sort()).toEqual(['openrouter', 'storage']);
  });
});
