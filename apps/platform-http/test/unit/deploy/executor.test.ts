import { Buffer } from 'node:buffer';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { describe, expect, it, vi } from 'vitest';
import type { ComposedBlueprint } from '@rntme/blueprint';
import { ok, type DeploymentRepo, type DeployTargetRepo, type ProjectVersionRepo } from '@rntme/platform-core';
import { readUiRuntimeCss, runDeployment, type ExecutorDeps } from '../../../src/deploy/executor.js';

describe('runDeployment', () => {
  it('runs plan, render, apply, smoke verify and finalizes as succeeded', async () => {
    const { deps, deployments } = setup();

    await runDeployment('deployment-1', 'org-1', deps);

    expect(deployments.transition).toHaveBeenCalledWith('deployment-1', 'running', expect.any(Object));
    expect(deployments.setRenderedDigest).toHaveBeenCalledWith('deployment-1', 'sha256:rendered');
    expect(deployments.setApplyResult).toHaveBeenCalledWith('deployment-1', expect.objectContaining({ renderedPlanDigest: 'sha256:rendered' }));
    expect(deployments.finalize).toHaveBeenCalledWith('deployment-1', {
      status: 'succeeded',
      verificationReport: { checks: [], ok: true, partialOk: false },
    });
    expect(deployments.appendLog).toHaveBeenCalledWith(expect.objectContaining({ step: 'init' }));
    expect(deployments.appendLog).toHaveBeenCalledWith(expect.objectContaining({ step: 'plan' }));
    expect(deployments.appendLog).toHaveBeenCalledWith(expect.objectContaining({ step: 'render' }));
    expect(deployments.appendLog).toHaveBeenCalledWith(expect.objectContaining({ step: 'apply' }));
    expect(deployments.appendLog).toHaveBeenCalledWith(expect.objectContaining({ step: 'verify' }));
    expect(deployments.touchHeartbeat).toHaveBeenCalled();
  });

  it('finalizes blueprint revalidation failures', async () => {
    const { deps, deployments } = setup({
      loadComposed: () => ({ ok: false, errors: [{ code: 'BAD_BLUEPRINT', message: 'token=secret-value' }] }),
    });

    await runDeployment('deployment-1', 'org-1', deps);

    expect(deployments.finalize).toHaveBeenCalledWith('deployment-1', {
      status: 'failed',
      errorCode: 'DEPLOY_EXECUTOR_BLUEPRINT_REVALIDATION_FAILED',
      errorMessage: expect.not.stringContaining('secret-value'),
    });
  });

  it('maps smoke UI-only failures to succeeded_with_warnings', async () => {
    const { deps, deployments } = setup({
      verificationReport: { checks: [{ name: 'ui', url: 'https://ui', status: 500, latencyMs: 1, ok: false }], ok: false, partialOk: true },
    });

    await runDeployment('deployment-1', 'org-1', deps);

    expect(deployments.finalize).toHaveBeenCalledWith('deployment-1', {
      status: 'succeeded_with_warnings',
      verificationReport: {
        checks: [{ name: 'ui', url: 'https://ui', status: 500, latencyMs: 1, ok: false }],
        ok: false,
        partialOk: true,
      },
      warnings: ['smoke verification completed with warnings'],
    });
  });

  it('adapts composed blueprints into deploy-core input with runtime artifact files', async () => {
    const planProject = vi.fn(() =>
      ok({
        project: { orgSlug: 'acme', projectSlug: 'shop', environment: 'default' as const, mode: 'preview' as const },
        infrastructure: { eventBus: { kind: 'kafka' as const, mode: 'external' as const, brokers: ['redpanda:9092'] } },
        workloads: [],
        edge: { routes: [], middleware: [] },
        diagnostics: { warnings: [] },
      }),
    );
    const { deps } = setup({
      bundleFiles: {
        'project.json': { name: 'shop', services: ['api'] },
        'services/api/ui/manifest.json': { version: '2.0', routes: {} },
        'services/api/seed/seed.json': [{ id: 'seed-1' }],
      },
      loadComposed: () => ({ ok: true, value: composedBlueprint() }),
      planProject: planProject as never,
    });

    await runDeployment('deployment-1', 'org-1', deps);

    expect(planProject).toHaveBeenCalledTimes(1);
    const calls = planProject.mock.calls as unknown as Array<[{
      publicConfigJson?: string | null;
      services: { api: { runtimeFiles: Record<string, string> } };
    }, unknown]>;
    const input = calls[0]![0];
    const runtimeFiles = input.services.api.runtimeFiles;
    expect(input.publicConfigJson).toContain('"clientId":"target-spa-client"');
    expect(input.publicConfigJson).not.toContain('${AUTH0_SPA_CLIENT_ID}');
    expect(runtimeFiles['bindings.json']).toContain('"bindings"');
    expect(runtimeFiles['graphs/listNotes.json']).toContain('"listNotes"');
    expect(runtimeFiles['manifest.json']).toContain('"service"');
    expect(runtimeFiles['pdm.json']).toContain('"entities"');
    expect(runtimeFiles['qsm.json']).toContain('"projections"');
    expect(runtimeFiles['seed.json']).toContain('"seed-1"');
    expect(runtimeFiles['shapes.json']).toContain('"NoteView"');
    expect(runtimeFiles['ui/manifest.json']).toContain('"2.0"');
    const uiBuildFiles = Object.entries(runtimeFiles).filter(([path]) => path.startsWith('ui-build/'));
    const jsBundle = uiBuildFiles
      .filter(([path]) => path.endsWith('.js'))
      .map(([, content]) => content)
      .join('\n');
    expect(runtimeFiles['ui-build/main.css']).toContain('tailwindcss');
    expect(runtimeFiles['ui-build/main.css']).not.toContain('rntme ui runtime styles unavailable');
    expect(runtimeFiles['ui-build/main.js']).toContain('hydrateApp');
    expect(jsBundle).toContain('Auth0Client');
    expect(runtimeFiles['ui-build/main.js.map']).toBeUndefined();
    expect(uiBuildFiles).not.toHaveLength(0);
    expect(uiBuildFiles.every(([, content]) => content.length < 950_000)).toBe(true);
  });

  it('fails deployment when auth0 public config placeholder has no target client id', async () => {
    const { deps, deployments } = setup({
      loadComposed: () => ({ ok: true, value: composedBlueprint() }),
      targetAuth: {},
    });

    await runDeployment('deployment-1', 'org-1', deps);

    expect(deployments.finalize).toHaveBeenCalledWith('deployment-1', {
      status: 'failed',
      errorCode: 'DEPLOY_EXECUTOR_UNCAUGHT',
      errorMessage: 'AUTH0_SPA_CLIENT_ID deploy target auth.auth0.clientId is required',
    });
  });

  it('declares auth module manifests and proto files for mounted domain services', async () => {
    const planProject = vi.fn(() =>
      ok({
        project: { orgSlug: 'acme', projectSlug: 'shop', environment: 'default' as const, mode: 'preview' as const },
        infrastructure: { eventBus: { kind: 'kafka' as const, mode: 'external' as const, brokers: ['redpanda:9092'] } },
        workloads: [],
        edge: { routes: [], middleware: [] },
        diagnostics: { warnings: [] },
      }),
    );
    const { deps } = setup({
      loadComposed: () => ({ ok: true, value: composedBlueprintWithAuthModule() }),
      planProject: planProject as never,
    });

    await runDeployment('deployment-1', 'org-1', deps);

    const calls = planProject.mock.calls as unknown as Array<
      [{ services: { api: { runtimeFiles: Record<string, string> } } }, unknown]
    >;
    const input = calls[0]![0];
    const manifest = JSON.parse(input.services.api.runtimeFiles['manifest.json']!) as {
      modules?: Array<{ name: string; grpc: { address: string }; protoPath: string }>;
    };

    expect(manifest.modules).toEqual([
      {
        name: 'identity-auth0',
        grpc: { address: 'identity-auth0:50051' },
        protoPath: 'identity-auth0.proto',
      },
    ]);
    expect(input.services.api.runtimeFiles['identity-auth0.proto']).toContain(
      'rpc IntrospectSession(IntrospectSessionRequest) returns (Session);',
    );
  });

  it('maps catalogManifest.moduleEdgeAuth into ComposedProjectInput.modules keyed by service slug', async () => {
    const planProject = vi.fn(() =>
      ok({
        project: { orgSlug: 'acme', projectSlug: 'shop', environment: 'default' as const, mode: 'preview' as const },
        infrastructure: { eventBus: { kind: 'kafka' as const, mode: 'external' as const, brokers: ['redpanda:9092'] } },
        workloads: [],
        edge: { routes: [], middleware: [] },
        diagnostics: { warnings: [] },
      }),
    );
    const { deps } = setup({
      loadComposed: () => ({ ok: true, value: composedBlueprintWithModuleEdgeAuth() }),
      planProject: planProject as never,
    });

    await runDeployment('deployment-1', 'org-1', deps);

    expect(planProject).toHaveBeenCalledTimes(1);
    const deployInput = (planProject.mock.calls as unknown as Array<[{ modules?: Record<string, { edgeAuth: unknown }> }, unknown]>)[0]![0];
    expect(deployInput.modules?.['identity-auth0']?.edgeAuth).toEqual({
      kind: 'introspection-sidecar',
      transport: 'http',
      method: 'GET',
      path: '/introspect',
      port: 50052,
    });
  });

  it('derives a wildcard public app URL from org, project, and environment for legacy targets', async () => {
    const renderPlan = vi.fn(() =>
      ok({
        target: { kind: 'dokploy' as const, endpoint: 'https://dokploy.example.test' },
        targetProject: { mode: 'existing' as const, projectId: 'project-1' },
        deployment: { orgSlug: 'acme', projectSlug: 'shop', environment: 'default' as const, mode: 'preview' as const },
        resources: [],
        urls: { projectUrl: 'https://acme-shop-default.rntme.com', publicRoutes: [] },
        digest: 'sha256:rendered',
        warnings: [],
      }),
    );
    const { deps } = setup({
      deploymentConfigOverrides: {},
      targetPublicBaseUrl: null,
      renderPlan: renderPlan as never,
    });

    await runDeployment('deployment-1', 'org-1', deps);

    expect(renderPlan).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ publicBaseUrl: 'https://acme-shop-default.rntme.com' }),
    );
  });
});

function setup(
  overrides: Partial<Pick<ExecutorDeps, 'loadComposed'>> & {
    bundleFiles?: Record<string, unknown>;
    deploymentConfigOverrides?: Record<string, unknown>;
    planProject?: ExecutorDeps['planProject'];
    renderPlan?: ExecutorDeps['renderPlan'];
    targetPublicBaseUrl?: string | null;
    targetAuth?: { auth0?: { clientId: string } };
    verificationReport?: { checks: never[] | [{ name: string; url: string; status: number; latencyMs: number; ok: boolean }]; ok: boolean; partialOk: boolean };
  } = {},
) {
  const deployments = {
    create: vi.fn(),
    getById: vi.fn(async () =>
      ok({
        id: 'deployment-1',
        projectId: 'project-1',
        orgId: 'org-1',
        projectVersionId: 'version-1',
        targetId: 'target-1',
        status: 'running' as const,
        configOverrides: overrides.deploymentConfigOverrides ?? { publicBaseUrl: 'https://app.example.test' },
        renderedPlanDigest: null,
        applyResult: null,
        verificationReport: null,
        warnings: [],
        errorCode: null,
        errorMessage: null,
        startedByAccountId: 'account-1',
        queuedAt: new Date(),
        startedAt: new Date(),
        finishedAt: null,
        lastHeartbeatAt: new Date(),
      }),
    ),
    listByProject: vi.fn(),
    transition: vi.fn(async () => ok(undefined)),
    setRenderedDigest: vi.fn(async () => ok(undefined)),
    setApplyResult: vi.fn(async () => ok(undefined)),
    finalize: vi.fn(async () => ok(undefined)),
    touchHeartbeat: vi.fn(async () => ok(undefined)),
    appendLog: vi.fn(async () => ok(undefined)),
    readLogs: vi.fn(),
    findStaleRunning: vi.fn(),
  };
  const projectVersions = {
    create: vi.fn(),
    findByDigest: vi.fn(),
    getBySeq: vi.fn(),
    getById: vi.fn(async () =>
      ok({
        id: 'version-1',
        orgId: 'org-1',
        projectId: 'project-1',
        seq: 1,
        bundleDigest: 'sha256:' + 'a'.repeat(64),
        bundleBlobKey: 'bundle-key',
        bundleSizeBytes: 1,
        summary: { projectName: 'shop', services: [], routes: { ui: {}, http: {} }, middleware: {}, mounts: [] },
        uploadedByAccountId: 'account-1',
        createdAt: new Date(),
      }),
    ),
    listByProject: vi.fn(),
  };
  const deployTargets = {
    create: vi.fn(),
    update: vi.fn(),
    rotateApiToken: vi.fn(),
    setDefault: vi.fn(),
    delete: vi.fn(),
    list: vi.fn(),
    getBySlug: vi.fn(),
    getDefault: vi.fn(),
    getWithSecretById: vi.fn(async () =>
      ok({
        id: 'target-1',
        orgId: 'org-1',
        slug: 'staging',
        displayName: 'Staging',
        kind: 'dokploy' as const,
        dokployUrl: 'https://dokploy.example.test',
        publicBaseUrl:
          overrides.targetPublicBaseUrl === undefined
            ? 'https://app.example.test'
            : overrides.targetPublicBaseUrl,
        dokployProjectId: 'project-1',
        dokployProjectName: null,
        allowCreateProject: false,
        eventBus: { kind: 'kafka' as const, brokers: ['redpanda:9092'] },
        modules: {},
        auth: overrides.targetAuth ?? { auth0: { clientId: 'target-spa-client' } },
        policyValues: {},
        isDefault: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        apiTokenCiphertext: Buffer.from('cipher'),
        apiTokenNonce: Buffer.from('nonce'),
        apiTokenKeyVersion: 1,
      }),
    ),
  };
  const deps: ExecutorDeps = {
    blob: {
      putIfAbsent: vi.fn(),
      presignedGet: vi.fn(),
      getJson: vi.fn(),
      getRaw: vi.fn(async () =>
        ok(gzipSync(Buffer.from(JSON.stringify({ version: 1, files: overrides.bundleFiles ?? { 'project.json': { name: 'shop', services: [] } } })))),
      ),
    },
    withOrgTx: async (_orgId, fn) =>
      fn({
        deployments: deployments as unknown as DeploymentRepo,
        projectVersions: projectVersions as unknown as ProjectVersionRepo,
        deployTargets: deployTargets as unknown as DeployTargetRepo,
      }),
    orgSlugFor: vi.fn(async () => 'acme'),
    dokployClientFactory: vi.fn(() => ({} as never)),
    smoker: { verify: vi.fn(async () => overrides.verificationReport ?? { checks: [], ok: true, partialOk: false }) } as never,
    logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
    loadComposed:
      overrides.loadComposed ??
      (() => ({
        ok: true,
        value: {
          name: 'shop',
          services: { api: { slug: 'api', kind: 'domain' } },
          routes: { http: { '/api': 'api' } },
          middleware: {},
          mounts: [],
        },
      })),
    planProject: overrides.planProject ?? vi.fn(() => ok({ project: { orgSlug: 'acme', projectSlug: 'shop', environment: 'default' as const, mode: 'preview' as const }, infrastructure: { eventBus: { kind: 'kafka' as const, mode: 'external' as const, brokers: ['redpanda:9092'] } }, workloads: [], edge: { routes: [], middleware: [] }, diagnostics: { warnings: [] } })) as never,
    renderPlan: overrides.renderPlan ?? vi.fn(() => ok({ target: { kind: 'dokploy' as const, endpoint: 'https://dokploy.example.test' }, targetProject: { mode: 'existing' as const, projectId: 'project-1' }, deployment: { orgSlug: 'acme', projectSlug: 'shop', environment: 'default' as const, mode: 'preview' as const }, resources: [], urls: { projectUrl: 'https://app.example.test', publicRoutes: [] }, digest: 'sha256:rendered', warnings: [] })) as never,
    applyPlan: vi.fn(async () => ok({ target: { kind: 'dokploy' as const, projectId: 'project-1' }, deployment: { orgSlug: 'acme', projectSlug: 'shop', environment: 'default' as const, mode: 'preview' as const }, resources: [], urls: { projectUrl: 'https://app.example.test', publicRoutes: [] }, renderedPlanDigest: 'sha256:rendered', warnings: [], verificationHints: { healthUrl: 'https://app.example.test/health', publicRouteUrls: [] } })) as never,
    heartbeatMs: 10_000,
  };
  return { deps, deployments };
}

function composedBlueprint(): ComposedBlueprint {
  return {
    project: { name: 'shop', services: ['api'], routes: { ui: { '/': 'api' } } },
    publicConfigJson: '{"@rntme/identity-auth0":{"domain":"tenant.us.auth0.com","clientId":"${AUTH0_SPA_CLIENT_ID}","audience":"https://shop.example.test/api","redirectUri":"https://shop.example.test/"}}',
    virtualEntrySource: [
      '// test virtual entry',
      "const [{ hydrateApp }, identityAuth0] = await Promise.all([",
      "  import('@rntme/ui-runtime/client'),",
      "  import('@rntme/identity-auth0/client'),",
      ']);',
      "void hydrateApp({ rootSelector: '#root', modules: [{ name: '@rntme/identity-auth0', boot: identityAuth0.boot }] });",
    ].join('\n'),
    pdm: { entities: {} } as never,
    routing: { httpBaseByService: {}, uiPathsByService: {} },
    bindingRegistry: {},
    services: {
      api: {
        slug: 'api',
        kind: 'domain',
        qsm: null,
        artifacts: { hasGraphs: true, hasBindings: true, hasUi: true, hasSeed: true, hasQsm: true },
        graphSpec: {
          version: '1.0-rc7',
          shapes: { NoteView: { fields: {} } },
          graphs: { listNotes: { id: 'listNotes', signature: { inputs: {}, output: { type: 'rowset<NoteView>', from: 'items' } }, nodes: [] } },
        },
        qsmValidated: { projections: {}, relations: {} } as never,
        bindings: { artifact: { version: '1.0', bindings: {} }, resolved: {} } as never,
        seed: { events: [] } as never,
        compiledUi: null,
        eventTypes: [],
      },
    },
  };
}

function composedBlueprintWithAuthModule(): ComposedBlueprint {
  const base = composedBlueprint();
  return {
    ...base,
    project: {
      name: 'shop',
      services: ['api', 'identity-auth0'],
      routes: { http: { '/api': 'api' }, ui: { '/': 'api' } },
      middleware: {
        auth: {
          kind: 'auth',
          provider: 'auth0',
          audience: 'https://shop.example.test/api',
          moduleSlug: 'identity-auth0',
        },
      },
      mounts: [{ target: 'http:/api', use: ['auth'] }],
    },
    services: {
      ...base.services,
      'identity-auth0': {
        slug: 'identity-auth0',
        kind: 'integration-module',
        qsm: null,
        artifacts: { hasGraphs: false, hasBindings: false, hasUi: false, hasSeed: false, hasQsm: false },
        graphSpec: null,
        qsmValidated: null,
        bindings: null,
        seed: null,
        compiledUi: null,
        eventTypes: [],
      },
    },
  };
}

function composedBlueprintWithModuleEdgeAuth(): ComposedBlueprint {
  const base = composedBlueprintWithAuthModule();
  return {
    ...base,
    project: {
      ...base.project,
      modules: {
        identity: { package: '@rntme/identity-auth0' },
      },
    },
    catalogManifest: {
      components: [],
      operations: [],
      modulesWithBoot: [],
      categoryToModule: {},
      publicConfig: {},
      moduleEdgeAuth: {
        '@rntme/identity-auth0': {
          kind: 'introspection-sidecar',
          transport: 'http',
          method: 'GET',
          path: '/introspect',
          port: 50052,
        },
      },
    },
  };
}

describe('readUiRuntimeCss', () => {
  function workspaceWith(layout: 'new' | 'legacy' | 'none', cssContent = '/* fixture css */'): string {
    const root = mkdtempSync(join(tmpdir(), 'rntme-ui-css-test-'));
    if (layout === 'new') {
      mkdirSync(join(root, 'packages', 'runtime', 'ui-runtime', 'build'), { recursive: true });
      writeFileSync(join(root, 'packages', 'runtime', 'ui-runtime', 'build', 'main.css'), cssContent);
    }
    if (layout === 'legacy') {
      mkdirSync(join(root, 'packages', 'ui-runtime', 'build'), { recursive: true });
      writeFileSync(join(root, 'packages', 'ui-runtime', 'build', 'main.css'), cssContent);
    }
    return root;
  }

  it('reads CSS from the new packages/runtime/ui-runtime location', () => {
    const root = workspaceWith('new', '/* css from new path */');
    try {
      expect(readUiRuntimeCss(root)).toBe('/* css from new path */');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('falls back to legacy packages/ui-runtime location when new path is absent', () => {
    const root = workspaceWith('legacy', '/* css from legacy path */');
    try {
      expect(readUiRuntimeCss(root)).toBe('/* css from legacy path */');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('returns the placeholder banner when neither path exists', () => {
    const root = workspaceWith('none');
    try {
      expect(readUiRuntimeCss(root)).toBe('/* rntme ui runtime styles unavailable at deploy bundle time */\n');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
