/**
 * Fixture bridge for runDeployment orchestrator tests.
 *
 * Builds a minimal-but-valid `RunDeploymentInputs` plus the file-system bundle
 * directory the orchestrator's `discoverModules` call expects. By default the
 * fixture has no provisioner modules — the runner skips the provision stage
 * and exercises plan → render → apply → verify only.
 *
 * The fixture is local to deploy-runner because the executor lives in this
 * package and the fixture deliberately avoids `ExecutorDeps` (DB-bound)
 * coupling. Cross-package reuse would re-introduce the dependency the
 * runner extraction is meant to break.
 */
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mock } from 'bun:test';
import { ok, type ProvisionerContract } from '@rntme/deploy-core';
import type { ComposedProjectInput } from '@rntme/deploy-core';
import type {
  DeploymentApplyResult,
  DokployClient,
  RenderedDokployPlan,
} from '@rntme/deploy-dokploy';
import type {
  DeploymentHooks,
  NormalizedDeployTarget,
  RunDeploymentInputs,
} from '../../src/index.js';

const trackedDirs: string[] = [];

export function trackedTmpDir(prefix = 'rntme-runner-fixture-'): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  trackedDirs.push(dir);
  return dir;
}

export function getTrackedDirs(): readonly string[] {
  return trackedDirs;
}

export function takeTrackedDirs(): string[] {
  return trackedDirs.splice(0);
}

/**
 * Materialize a minimal blueprint project on disk so the orchestrator's
 * `discoverModules` (called inside `collectProvisionerModules`) can run
 * against a real directory. We omit any `modules` field so module discovery
 * yields an empty list and the provision stage is a no-op.
 */
export function makeBundleDir(): string {
  const dir = trackedTmpDir();
  writeFileSync(
    join(dir, 'project.json'),
    JSON.stringify({ name: 'shop', services: ['api'] }),
    'utf-8',
  );
  return dir;
}

export function makeComposedProjectInput(): ComposedProjectInput {
  return {
    name: 'shop',
    services: { api: { slug: 'api', kind: 'domain' } },
    routes: { http: { '/api': 'api' } },
    middleware: {},
    mounts: [],
  };
}

export function makeNormalizedDeployTarget(): NormalizedDeployTarget {
  return {
    id: 'target-1',
    slug: 'staging',
    kind: 'dokploy',
    displayName: 'Staging',
    dokployUrl: 'https://dokploy.example.test',
    publicBaseUrl: 'https://app.example.test',
    dokployProjectId: 'project-1',
    dokployProjectName: null,
    allowCreateProject: false,
    eventBus: { kind: 'kafka', mode: 'external', brokers: ['redpanda:9092'] },
    storage: { mode: 'external' },
    modules: {},
    workflows: null,
    auth: { auth0: { clientId: 'target-spa-client' } },
    policyValues: {},
    manualAccess: {},
  };
}

export function makeRenderedPlan(): RenderedDokployPlan {
  return {
    target: { kind: 'dokploy', endpoint: 'https://dokploy.example.test' },
    targetProject: { mode: 'existing', projectId: 'project-1' },
    deployment: {
      orgSlug: 'acme',
      projectSlug: 'shop',
      environment: 'default',
      mode: 'preview',
    },
    resources: [],
    urls: { projectUrl: 'https://app.example.test', publicRoutes: [], protectedRouteChecks: [] },
    digest: 'sha256:rendered',
    warnings: [],
  } as unknown as RenderedDokployPlan;
}

export function makeApplyResult(): DeploymentApplyResult {
  return {
    target: { kind: 'dokploy', environmentId: 'env_default' },
    deployment: {
      orgSlug: 'acme',
      projectSlug: 'shop',
      environment: 'default',
      mode: 'preview',
    },
    resources: [
      {
        logicalId: 'catalog',
        resourceKind: 'application',
        workloadSlug: 'catalog',
        kind: 'domain-service',
        targetResourceId: 'app_1',
        targetResourceName: 'catalog',
        action: 'created',
      },
    ],
    urls: { projectUrl: 'https://app.example.test', publicRoutes: [], protectedRouteChecks: [] },
    renderedPlanDigest: 'sha256:rendered',
    warnings: [],
    verificationHints: { healthUrl: 'https://app.example.test/health', publicRouteUrls: [] },
  } as unknown as DeploymentApplyResult;
}

export function makeStubDokployClient(): DokployClient {
  return {} as DokployClient;
}

export type FixtureOptions = {
  readonly hooks?: DeploymentHooks;
  readonly seedDokployApiToken?: string;
};

/**
 * Build the inputs for a smoke-of-orchestrator test. Returns inputs that
 * exercise the full pipeline (plan → render → apply → verify) using mocked
 * deploy-core / deploy-dokploy implementations and a no-op smoker.
 */
export function makeRunDeploymentInputsFromExecutorFixture(
  options: FixtureOptions = {},
): RunDeploymentInputs {
  const apiToken = options.seedDokployApiToken ?? 'fixture-api-token';

  const planProject = mock(() =>
    ok({
      project: {
        orgSlug: 'acme',
        projectSlug: 'shop',
        environment: 'default' as const,
        mode: 'preview' as const,
      },
      infrastructure: {
        eventBus: { kind: 'kafka' as const, mode: 'external' as const, brokers: ['redpanda:9092'] },
        objectStorage: { kind: 'none' as const },
        workflowEngine: { kind: 'none' as const },
      },
      workloads: [],
      edge: { routes: [], middleware: [] },
      requiredTargetSecrets: [],
      diagnostics: { warnings: [] },
    } as never),
  );

  const renderPlan = mock(() => ok(makeRenderedPlan() as unknown as never));
  const applyPlan = mock(async () => ok(makeApplyResult() as unknown as never));

  const smoker = {
    verify: mock(async () => ({ checks: [], ok: true, partialOk: false })),
  } as unknown as RunDeploymentInputs['smoker'];

  // The dokployClientFactory's apiToken parameter is what the runner forwards.
  // Embedding the token in a stub allows the redaction test to assert the
  // token never reaches the log stream.
  const dokployClientFactory: RunDeploymentInputs['dokployClientFactory'] = (token) => {
    if (token !== apiToken) throw new Error('unexpected token in test factory');
    return makeStubDokployClient();
  };

  const resolveProvisioner = mock(async () => ({ provision: mock() } as unknown as ProvisionerContract));

  return {
    composedBlueprint: makeComposedProjectInput(),
    bundleDir: makeBundleDir(),
    target: makeNormalizedDeployTarget(),
    resolvedTargetSecrets: { apiToken, extras: {} },
    orgSlug: 'acme',
    configOverrides: {},
    priorProvisionOutputs: {},
    resolveProvisioner,
    dokployClientFactory,
    smoker,
    planProject,
    renderPlan,
    applyPlan,
    ...(options.hooks === undefined ? {} : { hooks: options.hooks }),
  };
}
