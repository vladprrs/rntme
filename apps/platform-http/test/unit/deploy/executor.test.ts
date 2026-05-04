import { Buffer } from 'node:buffer';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { describe, expect, it, vi } from 'vitest';
import type { ComposedBlueprint } from '@rntme/blueprint';
import { err, ok, type DeploymentRepo, type DeployTargetRepo, type ProjectVersionRepo } from '@rntme/platform-core';
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

  it('logs provisioned Redpanda event bus provisioning before apply', async () => {
    // Bus-mode log is now derived from config.eventBus.mode (sourced from the
    // target's eventBus config) and emitted pre-provision, before plan runs.
    // Supply a target whose event bus declares mode=provisioned so the
    // executor emits the "Provisioning Redpanda event bus" entry.
    const { deps, deployments } = setup({
      targetEventBus: {
        kind: 'kafka',
        mode: 'provisioned',
        provider: 'redpanda',
      },
    });

    await runDeployment('deployment-1', 'org-1', deps);

    expect(deployments.appendLog).toHaveBeenCalledWith(
      expect.objectContaining({
        step: 'plan',
        message: 'Provisioning Redpanda event bus',
      }),
    );
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

  it('finalizes failed when a critical smoke check fails', async () => {
    const { deps, deployments } = setup({
      verificationReport: { checks: [{ name: 'ui', url: 'https://ui', status: 500, latencyMs: 1, ok: false }], ok: false, partialOk: false },
    });

    await runDeployment('deployment-1', 'org-1', deps);

    expect(deployments.finalize).toHaveBeenCalledWith('deployment-1', {
      status: 'failed',
      errorCode: 'DEPLOY_EXECUTOR_SMOKE_FAILED',
      errorMessage: 'smoke verification failed',
      verificationReport: {
        checks: [{ name: 'ui', url: 'https://ui', status: 500, latencyMs: 1, ok: false }],
        ok: false,
        partialOk: false,
      },
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
      varsManifest?: Record<string, { from: string; required: boolean }>;
      services: { api: { runtimeFiles: Record<string, string> } };
    }, unknown]>;
    const input = calls[0]![0];
    const runtimeFiles = input.services.api.runtimeFiles;
    // Vars substitution now happens inside the planner, so the input still carries the raw placeholder.
    expect(input.publicConfigJson).toContain('${AUTH0_SPA_CLIENT_ID}');
    expect(input.varsManifest).toEqual({ AUTH0_SPA_CLIENT_ID: { from: 'target.auth.auth0.clientId', required: true } });
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

  it('fails deployment when planner reports a target var missing', async () => {
    const { deps, deployments } = setup({
      loadComposed: () => ({ ok: true, value: composedBlueprint() }),
      targetAuth: {},
      planProject: vi.fn(() => ({
        ok: false as const,
        errors: [{
          code: 'DEPLOY_PLAN_TARGET_VAR_MISSING' as const,
          message: 'vars.AUTH0_SPA_CLIENT_ID: target staging does not provide "target.auth.auth0.clientId"',
          varName: 'AUTH0_SPA_CLIENT_ID',
          fromPath: 'target.auth.auth0.clientId',
          targetSlug: 'staging',
        }],
      })),
    });

    await runDeployment('deployment-1', 'org-1', deps);

    expect(deployments.finalize).toHaveBeenCalledWith('deployment-1', {
      status: 'failed',
      errorCode: 'DEPLOY_PLAN_TARGET_VAR_MISSING',
      errorMessage: expect.stringContaining('AUTH0_SPA_CLIENT_ID'),
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

  it('maps module edgeAuth when project package is a local alias for a canonical manifest name', async () => {
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
      loadComposed: () => ({ ok: true, value: composedBlueprintWithAliasedAuthModuleEdgeAuth() }),
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

  it('logs selected version, selected target, rendered digest, and applied resources', async () => {
    const { deps, deployments } = setup();

    await runDeployment('deployment-1', 'org-1', deps);

    expect(deployments.appendLog).toHaveBeenCalledWith(
      expect.objectContaining({
        step: 'init',
        message: expect.stringContaining('projectVersionId=version-1'),
      }),
    );
    expect(deployments.appendLog).toHaveBeenCalledWith(
      expect.objectContaining({
        step: 'init',
        message: expect.stringContaining('targetId=target-1'),
      }),
    );
    expect(deployments.appendLog).toHaveBeenCalledWith(
      expect.objectContaining({
        step: 'render',
        message: 'Rendered Dokploy plan digest sha256:rendered',
      }),
    );
    expect(deployments.appendLog).toHaveBeenCalledWith(
      expect.objectContaining({
        step: 'apply',
        message: expect.stringContaining('application catalog created'),
      }),
    );
  });

  it('logs partial apply failure diagnostics before finalizing failed', async () => {
    const { deps, deployments } = setup({
      applyPlan: vi.fn(async () => ({
        ok: false,
        errors: [
          {
            code: 'DEPLOY_APPLY_DOKPLOY_PARTIAL_FAILURE',
            message: 'failed while applying resource "rntme-acme-shop-edge"',
            resource: 'rntme-acme-shop-edge',
            partialFailure: {
              createdResources: [],
              updatedResources: [],
              failedStep: {
                action: 'inspect',
                resourceName: 'rntme-acme-shop-edge',
                resourceKind: 'application',
                workloadSlug: 'edge',
              },
              retrySafe: true,
            },
          },
        ],
      })) as never,
    });

    await runDeployment('deployment-1', 'org-1', deps);

    expect(deployments.appendLog).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'error',
        step: 'apply',
        message: expect.stringContaining('inspect application edge'),
      }),
    );
    expect(deployments.finalize).toHaveBeenCalledWith('deployment-1', {
      status: 'failed',
      errorCode: 'DEPLOY_APPLY_DOKPLOY_PARTIAL_FAILURE',
      errorMessage: 'DEPLOY_APPLY_DOKPLOY_PARTIAL_FAILURE: failed while applying resource "rntme-acme-shop-edge"',
    });
  });

  it('derives a wildcard public app URL from org, project, and environment for legacy targets', async () => {
    const renderPlan = vi.fn(() =>
      ok({
        target: { kind: 'dokploy' as const, endpoint: 'https://dokploy.example.test' },
        targetProject: { mode: 'existing' as const, projectId: 'project-1' },
        deployment: { orgSlug: 'acme', projectSlug: 'shop', environment: 'default' as const, mode: 'preview' as const },
        resources: [],
        urls: { projectUrl: 'https://acme-shop-default.rntme.com', publicRoutes: [], protectedRouteChecks: [] },
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
      expect.any(Map),
      expect.any(Object),
    );
  });

  it('skips provision phase when no module declares a provisioner block', async () => {
    const runProv = vi.fn(async () => ok({ modules: [] }));
    const { deps, deployments } = setup({ runProvisioners: runProv as never });
    await runDeployment('deployment-1', 'org-1', deps);
    expect(runProv).not.toHaveBeenCalled();
    expect(deployments.appendLog).not.toHaveBeenCalledWith(expect.objectContaining({ step: 'provision' }));
    expect(deployments.setProvisionResult).not.toHaveBeenCalled();
    expect(deployments.finalize).toHaveBeenCalledWith('deployment-1', expect.objectContaining({ status: 'succeeded' }));
  });

  it('passes provisionResult into buildProjectDeploymentPlan when modules ran provisioners', async () => {
    // Bundle declares a fake provisioner module discoverable on-disk via the
    // node_modules/<pkg>/module.json fallback in defaultResolvePackage.
    const fakeManifest = {
      name: '@rntme/fake-identity',
      version: '0.0.0',
      capabilities: { rpcs: ['Introspect'], events: [] },
      provisioner: {
        entry: './provisioner.js',
        produces: [{ name: 'clientId', kind: 'single', secret: false }],
        requires: [],
      },
    };
    const bundleFiles: Record<string, unknown> = {
      'project.json': {
        name: 'shop',
        services: [],
        modules: { identity: { package: '@rntme/fake-identity' } },
      },
      'node_modules/@rntme/fake-identity/module.json': fakeManifest,
    };

    // Composed blueprint must also expose project.modules so the in-memory
    // gate in collectProvisionerModules passes before discoverModules runs.
    const composed: ComposedBlueprint = {
      ...composedBlueprint(),
      project: {
        name: 'shop',
        services: ['api'],
        modules: { identity: { package: '@rntme/fake-identity' } },
        routes: { ui: { '/': 'api' } },
      },
    };

    const planProject = vi.fn(() =>
      ok({
        project: { orgSlug: 'acme', projectSlug: 'shop', environment: 'default' as const, mode: 'preview' as const },
        infrastructure: { eventBus: { kind: 'kafka' as const, mode: 'external' as const, brokers: ['redpanda:9092'] } },
        workloads: [],
        edge: { routes: [], middleware: [] },
        diagnostics: { warnings: [] },
      }),
    );

    const runProv = vi.fn(async () =>
      ok({
        modules: [
          {
            projectKey: 'identity',
            packageName: '@rntme/fake-identity',
            publicOutputs: { clientId: 'fake-spa-client' },
            secretOutputs: {},
            provisionedAt: '2026-05-04T00:00:00.000Z',
          },
        ],
      }),
    );

    const { deps, deployments } = setup({
      bundleFiles,
      loadComposed: () => ({ ok: true, value: composed }),
      planProject: planProject as never,
      runProvisioners: runProv as never,
    });

    await runDeployment('deployment-1', 'org-1', deps);

    expect(runProv).toHaveBeenCalledTimes(1);
    expect(planProject).toHaveBeenCalledTimes(1);

    const calls = planProject.mock.calls as unknown as Array<
      [
        unknown,
        unknown,
        {
          provisionResult?: { modules: Record<string, { publicOutputs: Record<string, unknown> }> };
          discoveredModules?: Record<string, { producesNames: string[] }>;
        }?,
      ]
    >;
    const options = calls[0]![2];
    expect(options).toBeDefined();
    expect(options?.provisionResult?.modules.identity?.publicOutputs).toEqual({
      clientId: 'fake-spa-client',
    });
    expect(options?.discoveredModules?.identity?.producesNames).toEqual(['clientId']);
    expect(deployments.setProvisionResult).toHaveBeenCalled();
    expect(deployments.finalize).toHaveBeenCalledWith(
      'deployment-1',
      expect.objectContaining({ status: 'succeeded' }),
    );
  });

  it('substitutes target.* vars into module publicConfig before runProvisioners', async () => {
    const fakeManifest = {
      name: '@rntme/fake-identity',
      version: '0.0.0',
      capabilities: { rpcs: ['Introspect'], events: [] },
      provisioner: {
        entry: './provisioner.js',
        produces: [{ name: 'spaClient', kind: 'single', secret: false }],
        requires: [],
      },
    };
    const bundleFiles: Record<string, unknown> = {
      'project.json': {
        name: 'shop',
        services: [],
        modules: {
          identity: {
            package: '@rntme/fake-identity',
            publicConfig: {
              redirectUri: '${AUTH0_REDIRECT_URI}',
              clientId: '${AUTH0_SPA_CLIENT_ID}',
            },
          },
        },
      },
      'node_modules/@rntme/fake-identity/module.json': fakeManifest,
    };

    const composed: ComposedBlueprint = {
      ...composedBlueprint(),
      project: {
        name: 'shop',
        services: ['api'],
        modules: { identity: { package: '@rntme/fake-identity' } },
        routes: { ui: { '/': 'api' } },
      },
      varsManifest: {
        AUTH0_REDIRECT_URI: { from: 'target.auth.auth0.redirectUri', required: true },
        AUTH0_SPA_CLIENT_ID: { from: 'provision.identity.spaClient.id', required: true },
      },
    };

    const runProv = vi.fn(async () =>
      ok({
        modules: [
          {
            projectKey: 'identity',
            packageName: '@rntme/fake-identity',
            publicOutputs: { spaClient: { id: 'real-spa-id' } },
            secretOutputs: {},
            provisionedAt: '2026-05-04T00:00:00.000Z',
          },
        ],
      }),
    );

    const { deps } = setup({
      bundleFiles,
      loadComposed: () => ({ ok: true, value: composed }),
      runProvisioners: runProv as never,
      targetAuth: { auth0: { clientId: 'target-spa-client', redirectUri: 'https://demo.example/' } },
    });

    await runDeployment('deployment-1', 'org-1', deps);

    expect(runProv).toHaveBeenCalledTimes(1);
    const callArg = runProv.mock.calls[0]![0] as {
      modules: ReadonlyArray<{ projectKey: string; publicConfig: Record<string, unknown> }>;
    };
    const identityModule = callArg.modules.find((m) => m.projectKey === 'identity');
    expect(identityModule).toBeDefined();
    expect(identityModule?.publicConfig.redirectUri).toBe('https://demo.example/');
    // provision.* placeholder must remain as a literal — provision hasn't run.
    expect(identityModule?.publicConfig.clientId).toBe('${AUTH0_SPA_CLIENT_ID}');
  });

  it('fails the deployment when a required target.* var is missing on the target', async () => {
    const fakeManifest = {
      name: '@rntme/fake-identity',
      version: '0.0.0',
      capabilities: { rpcs: ['Introspect'], events: [] },
      provisioner: {
        entry: './provisioner.js',
        produces: [{ name: 'spaClient', kind: 'single', secret: false }],
        requires: [],
      },
    };
    const bundleFiles: Record<string, unknown> = {
      'project.json': {
        name: 'shop',
        services: [],
        modules: {
          identity: {
            package: '@rntme/fake-identity',
            publicConfig: { redirectUri: '${AUTH0_REDIRECT_URI}' },
          },
        },
      },
      'node_modules/@rntme/fake-identity/module.json': fakeManifest,
    };

    const composed: ComposedBlueprint = {
      ...composedBlueprint(),
      project: {
        name: 'shop',
        services: ['api'],
        modules: { identity: { package: '@rntme/fake-identity' } },
        routes: { ui: { '/': 'api' } },
      },
      varsManifest: {
        AUTH0_REDIRECT_URI: { from: 'target.auth.auth0.redirectUri', required: true },
      },
    };

    const runProv = vi.fn(async () => ok({ modules: [] }));

    const { deps, deployments } = setup({
      bundleFiles,
      loadComposed: () => ({ ok: true, value: composed }),
      runProvisioners: runProv as never,
      // target lacks redirectUri — forces the pre-provision resolver to fail.
      targetAuth: { auth0: { clientId: 'target-spa-client' } },
    });

    await runDeployment('deployment-1', 'org-1', deps);

    expect(runProv).not.toHaveBeenCalled();
    expect(deployments.finalize).toHaveBeenCalledWith(
      'deployment-1',
      expect.objectContaining({
        status: 'failed',
        errorCode: 'DEPLOY_PLAN_TARGET_VAR_MISSING',
      }),
    );
  });
});

function setup(
  overrides: Partial<Pick<ExecutorDeps, 'loadComposed'>> & {
    bundleFiles?: Record<string, unknown>;
    deploymentConfigOverrides?: Record<string, unknown>;
    planProject?: ExecutorDeps['planProject'];
    renderPlan?: ExecutorDeps['renderPlan'];
    applyPlan?: ExecutorDeps['applyPlan'];
    targetPublicBaseUrl?: string | null;
    targetAuth?: { auth0?: { clientId: string; redirectUri?: string; domain?: string; audience?: string } };
    targetEventBus?: Record<string, unknown>;
    verificationReport?: { checks: never[] | [{ name: string; url: string; status: number; latencyMs: number; ok: boolean }]; ok: boolean; partialOk: boolean };
    runProvisioners?: ExecutorDeps['runProvisioners'];
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
    setProvisionResult: vi.fn(async () => undefined),
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
        eventBus: (overrides.targetEventBus ?? { kind: 'kafka' as const, brokers: ['redpanda:9092'] }) as never,
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
        projectOperations: {
          getByDeploymentId: vi.fn(async () => ok(null)),
          finalize: vi.fn(async () => ok({} as never)),
        } as never,
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
    renderPlan: overrides.renderPlan ?? vi.fn(() => ok({ target: { kind: 'dokploy' as const, endpoint: 'https://dokploy.example.test' }, targetProject: { mode: 'existing' as const, projectId: 'project-1' }, deployment: { orgSlug: 'acme', projectSlug: 'shop', environment: 'default' as const, mode: 'preview' as const }, resources: [], urls: { projectUrl: 'https://app.example.test', publicRoutes: [], protectedRouteChecks: [] }, digest: 'sha256:rendered', warnings: [] })) as never,
    applyPlan: overrides.applyPlan ?? vi.fn(async () => ok({ target: { kind: 'dokploy' as const, environmentId: 'env_default' }, deployment: { orgSlug: 'acme', projectSlug: 'shop', environment: 'default' as const, mode: 'preview' as const }, resources: [{ logicalId: 'catalog', resourceKind: 'application' as const, workloadSlug: 'catalog', kind: 'domain-service' as const, targetResourceId: 'app_1', targetResourceName: 'catalog', action: 'created' as const }], urls: { projectUrl: 'https://app.example.test', publicRoutes: [], protectedRouteChecks: [] }, renderedPlanDigest: 'sha256:rendered', warnings: [], verificationHints: { healthUrl: 'https://app.example.test/health', publicRouteUrls: [] } })) as never,
    heartbeatMs: 10_000,
    ...(overrides.runProvisioners === undefined ? {} : { runProvisioners: overrides.runProvisioners }),
    resolveProvisioner: vi.fn(async () => ({ provision: vi.fn() } as never)),
    targetSecretsRepoFor: vi.fn(async () => ({
      list: vi.fn(async () => []),
      upsert: vi.fn(async () => undefined),
      remove: vi.fn(async () => undefined),
      getAllDecrypted: vi.fn(async () => ({})),
    })),
    secretCipher: {
      encrypt: vi.fn(() => ({ ciphertext: Buffer.from('ct'), nonce: Buffer.from('n'), keyVersion: 1 })),
      decrypt: vi.fn(() => '{}'),
    },
    lastSuccessfulProvisionOutputs: vi.fn(async () => ({})),
  };
  return { deps, deployments };
}

function composedBlueprint(): ComposedBlueprint {
  return {
    project: { name: 'shop', services: ['api'], routes: { ui: { '/': 'api' } } },
    publicConfigJson: '{"@rntme/identity-auth0":{"domain":"tenant.us.auth0.com","clientId":"${AUTH0_SPA_CLIENT_ID}","audience":"https://shop.example.test/api","redirectUri":"https://shop.example.test/"}}',
    varsManifest: { AUTH0_SPA_CLIENT_ID: { from: 'target.auth.auth0.clientId', required: true } },
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

function composedBlueprintWithAliasedAuthModuleEdgeAuth(): ComposedBlueprint {
  const base = composedBlueprintWithModuleEdgeAuth();
  return {
    ...base,
    project: {
      ...base.project,
      modules: {
        identity: { package: 'rntme_identity_auth0' },
      },
    },
    catalogManifest: {
      ...base.catalogManifest!,
      categoryToModule: {
        identity: '@rntme/identity-auth0',
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
