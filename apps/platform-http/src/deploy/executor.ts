import type { Buffer } from 'node:buffer';
import { clearInterval, setInterval } from 'node:timers';
import { readFile, readdir, rm } from 'node:fs/promises';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { emitProto } from '@rntme/bindings-grpc';
import {
  discoverModules,
  loadComposedBlueprint,
  materializeBundle,
  type ComposedBlueprint,
} from '@rntme/blueprint';
import type {
  ComposedProjectInput,
  DiscoveredModulesForVars,
  DiscoveredProvisionerModule,
  ProjectDeploymentConfig,
  ProjectDeploymentPlan,
  ProvisionedModule,
  ProvisionerContract,
  ProvisionerEnvMapping,
  ProvisionerOutput,
  ProvisionResultForVars,
} from '@rntme/deploy-core';
import {
  applyVars,
  buildProjectDeploymentPlan,
  resolveTargetVarsOnly,
  runProvisioners,
  targetForVars,
} from '@rntme/deploy-core';
import type { DeploymentApplyResult, RenderedDokployPlan } from '@rntme/deploy-dokploy';
import { applyDokployPlan, renderDokployPlan } from '@rntme/deploy-dokploy';
import { build, type Plugin } from 'esbuild';
import {
  isOk,
  type BlobStore,
  type DeployTarget,
  type DeployTargetRepo,
  type DeployTargetWithSecret,
  type DeploymentProvisionResult,
  type DeploymentRepo,
  type EncryptedSecret,
  type PlatformError,
  type PlatformErrorNode,
  type ErrorCode,
  type ProjectOperationRepo,
  type ProjectVersionRepo,
  type SecretCipher,
  type TargetSecretsRepo,
  type VerificationReport,
  parseCanonicalBundle,
} from '@rntme/platform-core';
import type { Logger } from 'pino';
import { buildDokployTargetConfig, buildProjectDeploymentConfig } from './build-deploy-config.js';
import type { DokployClientFactory } from './dokploy-client-factory.js';
import { redact } from './log-redactor.js';
import type { SmokeVerifier } from './smoke-verifier.js';
import { runStage } from './stage-runner.js';

type ResultLike<T, E = { readonly code: string; readonly message: string }> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly errors: readonly E[] };

export type TxRepos = {
  readonly deployments: DeploymentRepo;
  readonly projectVersions: ProjectVersionRepo;
  readonly deployTargets: DeployTargetRepo;
  readonly projectOperations: ProjectOperationRepo;
};

export type ExecutorDeps = {
  readonly blob: BlobStore;
  readonly withOrgTx: <T>(orgId: string, fn: (repos: TxRepos) => Promise<T>) => Promise<T>;
  readonly orgSlugFor: (orgId: string) => Promise<string>;
  readonly dokployClientFactory: DokployClientFactory;
  readonly smoker: SmokeVerifier;
  readonly logger: Pick<Logger, 'error' | 'warn' | 'info'>;
  readonly loadComposed?: (dir: string) => ResultLike<LoadedDeployProject>;
  readonly planProject?: typeof buildProjectDeploymentPlan;
  readonly renderPlan?: typeof renderDokployPlan;
  readonly applyPlan?: typeof applyDokployPlan;
  readonly heartbeatMs?: number;
  readonly publicDeployDomain?: string;
  /** Override hook for tests; in production `runProvisioners` from deploy-core is used. */
  readonly runProvisioners?: typeof runProvisioners;
  /** Resolve a provisioner contract from its package name, entry point, and materialized project dir. */
  readonly resolveProvisioner: (packageName: string, entry: string, projectDir: string) => Promise<ProvisionerContract>;
  /** Build a TargetSecretsRepo scoped to the given org context. */
  readonly targetSecretsRepoFor: (orgId: string) => Promise<TargetSecretsRepo>;
  /** Cipher used to encrypt secret outputs from provisioners. */
  readonly secretCipher: SecretCipher;
  /**
   * Returns the prior provisioner outputs for each module key from the last
   * successful deployment.
   * TODO(provisioner): wire prior outputs from last successful deployment
   */
  readonly lastSuccessfulProvisionOutputs: (deploymentId: string) => Promise<Record<string, ProvisionerOutput>>;
};

type DeploymentContext = {
  readonly projectVersionId: string;
  readonly targetId: string;
  readonly configOverrides: Record<string, unknown>;
  readonly bundleBlobKey: string;
  readonly projectVersionSeq: number;
  readonly targetSlug: string;
};

type LoadedDeployProject = ComposedProjectInput | ComposedBlueprint;

const IDENTITY_INTROSPECTION_PROTO = `syntax = "proto3";
package rntme.contracts.identity.v1;

message IntrospectSessionRequest {
  string token = 1;
  string audience = 2;
}

message Session {
  string session_id = 2;
  string user_id = 3;
  string organization_id = 4;
  int32 token_type = 5;
  repeated string roles = 6;
  repeated string permissions = 7;
  repeated string verified_factors = 8;
  int32 status = 9;
  string ip_address = 10;
  string user_agent = 11;
}

service IdentityModule {
  rpc IntrospectSession(IntrospectSessionRequest) returns (Session);
}
`;

export async function runDeployment(
  deploymentId: string,
  orgId: string,
  deps: ExecutorDeps,
): Promise<void> {
  const heartbeat = setInterval(() => {
    void deps
      .withOrgTx(orgId, (repos) => repos.deployments.touchHeartbeat(deploymentId))
      .catch(() => undefined);
  }, deps.heartbeatMs ?? 5_000);
  let tmpDir: string | null = null;

  try {
    const ctx = await startAndResolveContext(deploymentId, orgId, deps);
    await appendLog(
      deps,
      deploymentId,
      orgId,
      'info',
      'init',
      `Starting deployment projectVersionSeq=${ctx.projectVersionSeq} projectVersionId=${ctx.projectVersionId} targetSlug=${ctx.targetSlug} targetId=${ctx.targetId}`,
    );
    await deps.withOrgTx(orgId, (repos) => repos.deployments.touchHeartbeat(deploymentId));

    const raw = await deps.blob.getRaw(ctx.bundleBlobKey);
    if (!isOk(raw)) {
      await finalize(deps, deploymentId, orgId, 'failed', {
        errorCode: 'DEPLOY_EXECUTOR_BLOB_FETCH_FAILED',
        errorMessage: raw.errors[0]?.message ?? 'unable to fetch project version bundle',
      });
      return;
    }

    let bundleBytes: Buffer;
    try {
      bundleBytes = gunzipSync(raw.value);
    } catch (cause) {
      await finalize(deps, deploymentId, orgId, 'failed', {
        errorCode: 'DEPLOY_EXECUTOR_BUNDLE_DECOMPRESS_FAILED',
        errorMessage: redact(cause instanceof Error ? cause.message : String(cause)),
      });
      return;
    }

    const parsedBundle = parseCanonicalBundle(bundleBytes);
    if (!isOk(parsedBundle)) {
      await finalize(deps, deploymentId, orgId, 'failed', {
        errorCode: parsedBundle.errors[0]?.code ?? 'PROJECT_VERSION_BUNDLE_INVALID_SHAPE',
        errorMessage: redact(errorSummary(parsedBundle.errors)),
      });
      return;
    }

    try {
      tmpDir = await materializeBundle(parsedBundle.value.bundle);
    } catch (cause) {
      await finalize(deps, deploymentId, orgId, 'failed', {
        errorCode: 'DEPLOY_EXECUTOR_BUNDLE_MATERIALIZE_FAILED',
        errorMessage: redact(cause instanceof Error ? cause.message : String(cause)),
      });
      return;
    }

    if (tmpDir === null) {
      await finalize(deps, deploymentId, orgId, 'failed', {
        errorCode: 'DEPLOY_EXECUTOR_BUNDLE_MATERIALIZE_FAILED',
        errorMessage: 'internal: bundle materialization produced no workspace directory',
      });
      return;
    }
    const bundleDir = tmpDir;

    const log = async (entry: { step: string; level: 'error'; code: string; message: string }) =>
      appendLog(deps, deploymentId, orgId, 'error', entry.step, `${entry.code}: ${entry.message}`);

    await appendLog(deps, deploymentId, orgId, 'info', 'plan', 'Re-validating blueprint');
    const composed = (deps.loadComposed ?? defaultLoadComposed)(bundleDir);
    if (!composed.ok) {
      await finalize(deps, deploymentId, orgId, 'failed', {
        errorCode: 'DEPLOY_EXECUTOR_BLUEPRINT_REVALIDATION_FAILED',
        errorMessage: redact(errorSummary(composed.errors)),
      });
      return;
    }

    const target = await resolveTarget(deps, orgId, ctx.targetId);
    const orgSlug = await deps.orgSlugFor(orgId);
    const redactedTarget = redactTarget(target);
    const deployProjectSlug = isComposedBlueprint(composed.value)
      ? composed.value.project.name
      : composed.value.name;
    const config = buildProjectDeploymentConfig(redactedTarget, orgSlug, ctx.configOverrides, {
      projectSlug: deployProjectSlug,
      ...(deps.publicDeployDomain === undefined ? {} : { publicDeployDomain: deps.publicDeployDomain }),
    });
    const deployInput = await toDeployCoreInput(composed.value, bundleDir, config);
    const materializedDir: string = bundleDir;
    const provModules = collectProvisionerModules(composed.value, materializedDir);

    // Bus mode log moved out of plan (was post-plan; now pre-provision).
    const eventBusModeForLog =
      config.eventBus === undefined ? 'unknown' :
      config.eventBus.mode === 'provisioned' ? 'provisioned' :
      config.eventBus.mode === 'in-memory' ? 'in-memory' : 'external';
    const eventBusLogMessage =
      eventBusModeForLog === 'provisioned' ? 'Provisioning Redpanda event bus' :
      eventBusModeForLog === 'in-memory' ? 'Using in-memory event bus' :
      eventBusModeForLog === 'external' ? 'Using external Kafka/Redpanda event bus' :
      'Event bus mode unspecified';
    await appendLog(deps, deploymentId, orgId, 'info', 'plan', eventBusLogMessage);

    let provisioned: ReadonlyMap<string, ProvisionedModule> = new Map();
    let provisionResultForPlan: ProvisionResultForVars | undefined;
    let discoveredModulesForPlan: DiscoveredModulesForVars | undefined;

    const needsProvisionerSecrets = provModules.length > 0;
    const needsConsoleSecrets = config.manualAccess?.redpandaConsole?.enabled === true;
    let decryptedTargetSecrets: Readonly<Record<string, unknown>> | undefined;

    if (needsProvisionerSecrets || needsConsoleSecrets) {
      await appendLog(deps, deploymentId, orgId, 'info', 'provision', 'Resolving target secrets');
      const targetSecretsRepo = await deps.targetSecretsRepoFor(orgId);
      decryptedTargetSecrets = await targetSecretsRepo.getAllDecrypted(target.id);
    }

    if (needsConsoleSecrets) {
      const urlHint = config.manualAccess?.redpandaConsole?.publicBaseUrl ?? 'unset';
      const userHint = config.manualAccess?.redpandaConsole?.basicAuth.username ?? '';
      await appendLog(
        deps,
        deploymentId,
        orgId,
        'info',
        'provision',
        `Redpanda Console manual validation access enabled url=${urlHint} user=${userHint}`,
      );
    }

    if (provModules.length > 0) {
      // Build discoveredModules input for plan-time var validation.
      // DiscoveredProvisionerModule has `manifest: ModuleManifest` directly
      // (see packages/deploy/deploy-core/src/provision.ts).
      const dm: Record<string, { producesNames: string[] }> = {};
      for (const m of provModules) {
        const names = m.manifest.provisioner?.produces.map((p) => p.name) ?? [];
        dm[m.projectKey] = { producesNames: names };
      }
      discoveredModulesForPlan = dm;

      const priorOutputs = await deps.lastSuccessfulProvisionOutputs(deploymentId);

      // Substitute target.* vars into each module's publicConfig before
      // handing it to the provisioner. provision.* placeholders cannot resolve
      // pre-provision and remain as ${...} literals — provisioner inputs that
      // depend on those fields would necessarily see them unresolved.
      const targetVarsResult = resolveTargetVarsOnly(
        composed.value.varsManifest ?? {},
        targetForVars(config, target.slug),
      );
      if (!targetVarsResult.ok) {
        await finalize(deps, deploymentId, orgId, 'failed', {
          errorCode: targetVarsResult.errors[0]?.code ?? 'DEPLOY_PLAN_UNKNOWN',
          errorMessage: redact(errorSummary(targetVarsResult.errors)),
          errorTree: deployErrorsToPlatformError(targetVarsResult.errors, 'plan'),
        });
        return;
      }
      const targetVars = targetVarsResult.value;
      const provModulesWithSubstitutedConfig: DiscoveredProvisionerModule[] = provModules.map((m) => ({
        ...m,
        publicConfig: applyVars(m.publicConfig, targetVars) as Record<string, unknown>,
      }));

      await appendLog(deps, deploymentId, orgId, 'info', 'provision', `Provisioning ${provModules.length} module(s)`);
      const startedAt = new Date().toISOString();
      const provisionResult = await runStage(
        'provision',
        async () =>
          (deps.runProvisioners ?? runProvisioners)({
            modules: provModulesWithSubstitutedConfig.map((m) => {
              const prior = priorOutputs[m.projectKey];
              return prior === undefined ? m : { ...m, priorOutputs: prior };
            }),
            resolvedTargetSecrets:
              decryptedTargetSecrets === undefined
                ? ({} as Readonly<Record<string, unknown>>)
                : decryptedTargetSecrets,
            projectDir: materializedDir,
            resolveProvisioner: deps.resolveProvisioner,
            log: (e) => void appendLog(deps, deploymentId, orgId, e.level, e.step, redact(e.message)),
          }),
        { log },
      );
      if (!provisionResult.ok) {
        await finalize(deps, deploymentId, orgId, 'failed', {
          errorCode: provisionResult.errors[0]?.code ?? 'DEPLOY_PROVISION_UNKNOWN',
          errorMessage: redact(errorSummary(provisionResult.errors)),
          errorTree: deployErrorsToPlatformError(provisionResult.errors, 'provision'),
        });
        return;
      }
      const finishedAt = new Date().toISOString();

      const moduleMap = new Map<string, ProvisionedModule>();
      const persistence: DeploymentProvisionResult = { modules: {}, startedAt, finishedAt };
      const secretEnvelope: { modules: Record<string, { secretOutputs: Record<string, unknown>; provisionedAt: string }> } = { modules: {} };
      const publicOutputsForPlan: Record<string, { publicOutputs: Record<string, unknown> }> = {};

      for (const m of provisionResult.value.modules) {
        moduleMap.set(m.projectKey, m);
        publicOutputsForPlan[m.projectKey] = { publicOutputs: { ...m.publicOutputs } };
        (persistence.modules as Record<string, { publicOutputs: Record<string, unknown>; provisionedAt: string }>)[m.projectKey] = {
          publicOutputs: { ...m.publicOutputs },
          provisionedAt: m.provisionedAt,
        };
        if (Object.keys(m.secretOutputs).length > 0) {
          secretEnvelope.modules[m.projectKey] = {
            secretOutputs: { ...m.secretOutputs },
            provisionedAt: m.provisionedAt,
          };
        }
      }
      provisioned = moduleMap;
      provisionResultForPlan = { modules: publicOutputsForPlan };

      const enc: EncryptedSecret | null =
        Object.keys(secretEnvelope.modules).length > 0
          ? deps.secretCipher.encrypt(JSON.stringify(secretEnvelope))
          : null;

      await deps.withOrgTx(orgId, (repos) =>
        repos.deployments.setProvisionResult(deploymentId, persistence, enc),
      );
    }

    // Plan now runs AFTER provision so vars can resolve provision.* paths.
    const plan = await runStage(
      'plan',
      async () =>
        (deps.planProject ?? buildProjectDeploymentPlan)(deployInput, config, {
          ...(provisionResultForPlan ? { provisionResult: provisionResultForPlan } : {}),
          ...(discoveredModulesForPlan ? { discoveredModules: discoveredModulesForPlan } : {}),
        }),
      { log },
    );
    if (!plan.ok) {
      await finalize(deps, deploymentId, orgId, 'failed', {
        errorCode: plan.errors[0]?.code ?? 'DEPLOY_PLAN_UNKNOWN',
        errorMessage: redact(errorSummary(plan.errors)),
        errorTree: deployErrorsToPlatformError(plan.errors, 'plan'),
      });
      return;
    }

    const envMappings: Record<string, ProvisionerEnvMapping[string]> = {};
    for (const m of provModules) {
      try {
        const moduleExports = (await import(m.packageName)) as { ENV_MAPPINGS?: ProvisionerEnvMapping };
        if (moduleExports.ENV_MAPPINGS && typeof moduleExports.ENV_MAPPINGS === 'object') {
          for (const [k, v] of Object.entries(moduleExports.ENV_MAPPINGS)) {
            if (v !== undefined) envMappings[k] = v;
          }
        }
      } catch {
        // Modules opt out of env baking by not exporting ENV_MAPPINGS.
      }
    }

    await appendLog(deps, deploymentId, orgId, 'info', 'render', 'Rendering Dokploy plan');
    const rendered = await runStage('render', async () => (deps.renderPlan ?? renderDokployPlan)(
      plan.value as ProjectDeploymentPlan,
      buildDokployTargetConfig(redactedTarget, ctx.configOverrides, {
        orgSlug,
        projectSlug: plan.value.project.projectSlug,
        environment: plan.value.project.environment,
        ...(deps.publicDeployDomain === undefined ? {} : { publicDeployDomain: deps.publicDeployDomain }),
      }),
      provisioned,
      envMappings,
    ), { log });
    if (!rendered.ok) {
      await finalize(deps, deploymentId, orgId, 'failed', {
        errorCode: rendered.errors[0]?.code ?? 'DEPLOY_RENDER_DOKPLOY_UNKNOWN',
        errorMessage: redact(errorSummary(rendered.errors)),
        errorTree: deployErrorsToPlatformError(rendered.errors, 'render'),
      });
      return;
    }
    await deps.withOrgTx(orgId, (repos) =>
      repos.deployments.setRenderedDigest(deploymentId, rendered.value.digest),
    );
    await appendLog(deps, deploymentId, orgId, 'info', 'render', `Rendered Dokploy plan digest ${rendered.value.digest}`);

    await appendLog(deps, deploymentId, orgId, 'info', 'apply', 'Applying Dokploy plan');
    const applied = await runStage('apply', async () => (deps.applyPlan ?? applyDokployPlan)(
      rendered.value as RenderedDokployPlan,
      deps.dokployClientFactory(target, decryptedTargetSecrets),
    ), { log });
    if (!applied.ok) {
      await logApplyFailure(deps, deploymentId, orgId, applied.errors);
      await finalize(deps, deploymentId, orgId, 'failed', {
        errorCode: applied.errors[0]?.code ?? 'DEPLOY_APPLY_DOKPLOY_UNKNOWN',
        errorMessage: redact(errorSummary(applied.errors)),
        errorTree: deployErrorsToPlatformError(applied.errors, 'apply'),
      });
      return;
    }
    await deps.withOrgTx(orgId, (repos) =>
      repos.deployments.setApplyResult(
        deploymentId,
        applied.value as unknown as Record<string, unknown>,
      ),
    );
    for (const resource of applied.value.resources) {
      await appendLog(
        deps,
        deploymentId,
        orgId,
        'info',
        'apply',
        `${resource.resourceKind} ${resource.workloadSlug ?? resource.infrastructureKind ?? resource.logicalId} ${resource.action} target=${resource.targetResourceName}`,
      );
    }

    await appendLog(deps, deploymentId, orgId, 'info', 'verify', 'Running smoke verification');
    const verification = await deps.smoker.verify(applied.value as DeploymentApplyResult);
    await finalizeFromVerification(deps, deploymentId, orgId, verification);
  } catch (cause) {
    deps.logger.error({ deploymentId, cause }, 'deploy executor failed');
    await finalize(deps, deploymentId, orgId, 'failed', {
      errorCode: 'DEPLOY_EXECUTOR_UNCAUGHT',
      errorMessage: redact(cause instanceof Error ? cause.message : String(cause)),
    });
  } finally {
    clearInterval(heartbeat);
    if (tmpDir) await rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function startAndResolveContext(
  deploymentId: string,
  orgId: string,
  deps: ExecutorDeps,
): Promise<DeploymentContext> {
  return deps.withOrgTx(orgId, async (repos) => {
    const startedAt = new Date();
    const transition = await repos.deployments.transition(deploymentId, 'running', { startedAt });
    if (!isOk(transition)) throw new Error(transition.errors[0]?.code ?? 'DEPLOYMENT_INVALID_TRANSITION');
    const deployment = await repos.deployments.getById(deploymentId);
    if (!isOk(deployment) || !deployment.value) throw new Error('DEPLOYMENT_NOT_FOUND');
    const version = await repos.projectVersions.getById(deployment.value.projectVersionId);
    if (!isOk(version) || !version.value) throw new Error('PROJECT_VERSION_NOT_FOUND');
    const target = await repos.deployTargets.getWithSecretById(deployment.value.targetId);
    if (!isOk(target) || !target.value) throw new Error('DEPLOY_TARGET_NOT_FOUND');
    return {
      projectVersionId: deployment.value.projectVersionId,
      targetId: deployment.value.targetId,
      configOverrides: deployment.value.configOverrides,
      bundleBlobKey: version.value.bundleBlobKey,
      projectVersionSeq: version.value.seq,
      targetSlug: target.value.slug,
    };
  });
}

async function resolveTarget(
  deps: ExecutorDeps,
  orgId: string,
  targetId: string,
): Promise<DeployTargetWithSecret> {
  return deps.withOrgTx(orgId, async (repos) => {
    const target = await repos.deployTargets.getWithSecretById(targetId);
    if (!isOk(target) || !target.value) throw new Error('DEPLOY_TARGET_NOT_FOUND');
    return target.value;
  });
}

async function appendLog(
  deps: ExecutorDeps,
  deploymentId: string,
  orgId: string,
  level: 'info' | 'warn' | 'error',
  step: string,
  message: string,
): Promise<void> {
  await deps.withOrgTx(orgId, async (repos) => {
    await repos.deployments.appendLog({ deploymentId, orgId, level, step, message: redact(message) });
  });
}

type StageErrorInput = {
  readonly code?: string;
  readonly message?: string;
  readonly path?: string;
  readonly cause?: unknown;
};

export function deployErrorsToPlatformError(
  errors: readonly StageErrorInput[],
  stage: 'plan' | 'render' | 'apply' | 'verify' | 'provision',
): PlatformError {
  const nodes = errors.map(stageErrorToNode);
  const flatMessage = errors
    .map((e) => `${e.code ?? 'UNKNOWN'}: ${e.message ?? ''}`)
    .join('; ');
  const code: ErrorCode = 'PLATFORM_INTERNAL';
  return {
    code,
    message: flatMessage || `deployment ${stage} failed`,
    stage,
    errors: nodes,
  };
}

function stageErrorToNode(e: StageErrorInput): PlatformErrorNode {
  const node: { -readonly [K in keyof PlatformErrorNode]: PlatformErrorNode[K] } = {
    code: typeof e.code === 'string' ? e.code : 'UNKNOWN',
    message: typeof e.message === 'string' ? e.message : JSON.stringify(e),
  };
  if (typeof e.path === 'string' && e.path.length > 0) node.path = e.path;
  if (Array.isArray(e.cause)) {
    const children = e.cause
      .filter((c): c is StageErrorInput => typeof c === 'object' && c !== null)
      .map(stageErrorToNode);
    if (children.length > 0) node.cause = children;
  }
  return node;
}

async function logApplyFailure(
  deps: ExecutorDeps,
  deploymentId: string,
  orgId: string,
  errors: readonly { readonly code?: string; readonly message?: string; readonly cause?: unknown; readonly partialFailure?: unknown }[],
): Promise<void> {
  const first = errors[0];
  const partial = first?.partialFailure as
    | {
        readonly failedStep?: {
          readonly action?: string;
          readonly resourceKind?: string;
          readonly workloadSlug?: string;
          readonly infrastructureKind?: string;
          readonly resourceName?: string;
        };
      }
    | undefined;
  const failed = partial?.failedStep;
  const cause = applyFailureCause(first?.cause);
  const detail =
    failed === undefined
      ? `${errorSummary(errors)}${cause === undefined ? '' : `: ${cause}`}`
      : `${failed.action ?? 'apply'} ${failed.resourceKind ?? 'resource'} ${failed.workloadSlug ?? failed.infrastructureKind ?? failed.resourceName ?? ''}: ${first?.message ?? ''}${cause === undefined ? '' : `: ${cause}`}`;
  await appendLog(deps, deploymentId, orgId, 'error', 'apply', detail);
}

function applyFailureCause(cause: unknown): string | undefined {
  if (cause === undefined || cause === null) return undefined;
  if (cause instanceof Error) return redact(cause.message);
  if (typeof cause === 'string') return redact(cause);
  if (typeof cause === 'object' && 'message' in cause && typeof cause.message === 'string') {
    return redact(cause.message);
  }
  return redact(JSON.stringify(cause));
}

async function finalizeFromVerification(
  deps: ExecutorDeps,
  deploymentId: string,
  orgId: string,
  verificationReport: VerificationReport,
): Promise<void> {
  if (verificationReport.ok) {
    await finalize(deps, deploymentId, orgId, 'succeeded', { verificationReport });
    return;
  }
  if (verificationReport.partialOk) {
    await finalize(deps, deploymentId, orgId, 'succeeded_with_warnings', {
      verificationReport,
      warnings: ['smoke verification completed with warnings'],
    });
    return;
  }
  await finalize(deps, deploymentId, orgId, 'failed', {
    errorCode: 'DEPLOY_EXECUTOR_SMOKE_FAILED',
    errorMessage: 'smoke verification failed',
    verificationReport,
  });
}

async function finalize(
  deps: ExecutorDeps,
  deploymentId: string,
  orgId: string,
  status: 'succeeded' | 'succeeded_with_warnings' | 'failed' | 'failed_orphaned',
  args: {
    readonly errorCode?: string;
    readonly errorMessage?: string;
    readonly errorTree?: PlatformError;
    readonly verificationReport?: VerificationReport;
    readonly warnings?: unknown[];
  },
): Promise<void> {
  await deps.withOrgTx(orgId, async (repos) => {
    const result = await repos.deployments.finalize(deploymentId, { status, ...args });
    if (!isOk(result)) deps.logger.warn({ deploymentId, errors: result.errors }, 'finalize failed');

    const operation = await repos.projectOperations.getByDeploymentId(deploymentId);
    if (isOk(operation) && operation.value?.kind === 'update') {
      const opStatus = status === 'succeeded' || status === 'succeeded_with_warnings' ? 'succeeded' : 'failed';
      const finalized = await repos.projectOperations.finalize(operation.value.id, {
        status: opStatus,
        result: { deploymentId, deploymentStatus: status },
        ...(opStatus === 'failed' ? { errorCode: args.errorCode ?? status, errorMessage: args.errorMessage ?? status } : {}),
      });
      if (!isOk(finalized)) deps.logger.warn({ deploymentId, errors: finalized.errors }, 'project operation finalize failed');
    }
  });
}

function defaultLoadComposed(dir: string): ResultLike<LoadedDeployProject> {
  const result = loadComposedBlueprint(dir);
  return result as ResultLike<LoadedDeployProject>;
}

async function toDeployCoreInput(
  value: LoadedDeployProject,
  rootDir: string,
  _config: ProjectDeploymentConfig,
): Promise<ComposedProjectInput> {
  if (!isComposedBlueprint(value)) return value;

  const uiBuildFiles =
    value.virtualEntrySource === null || value.virtualEntrySource === undefined
      ? {}
      : await bundleVirtualEntrySource(value.virtualEntrySource, rootDir);

  // Build modules map: service slug → { edgeAuth }. catalogManifest is keyed by
  // the resolved module manifest name (for example "@rntme/identity-auth0"),
  // while project.modules may use a local package alias such as
  // "rntme_identity_auth0". categoryToModule bridges the project role key to
  // the canonical manifest name used by the catalog.
  const catalogManifest = value.catalogManifest;
  const moduleEdgeAuth = catalogManifest?.moduleEdgeAuth ?? {};
  const modules: Record<string, { edgeAuth: (typeof moduleEdgeAuth)[string] | null; packageName?: string }> = {};
  for (const [projectKey, moduleRef] of Object.entries(value.project.modules ?? {})) {
    const manifestName = catalogManifest?.categoryToModule[projectKey] ?? moduleRef.package;
    const edgeAuth = moduleEdgeAuth[manifestName] ?? moduleEdgeAuth[moduleRef.package] ?? null;
    const slugs = new Set([manifestName.split('/').pop()!, moduleRef.package.split('/').pop()!]);
    for (const slug of slugs) {
      modules[slug] = { edgeAuth, packageName: manifestName };
    }
  }

  const workflowFiles =
    value.workflows === null || value.workflows === undefined
      ? undefined
      : await readWorkflowDefinitionFiles(value.workflows, rootDir);
  const workflowGrpcServices = workflowGrpcServicesForProject(value);

  return {
    name: value.project.name,
    publicConfigJson: value.publicConfigJson ?? null,
    varsManifest: value.varsManifest,
    services: Object.fromEntries(
      await Promise.all(
        value.project.services.map(async (slug) => [
          slug,
          {
            slug,
            kind: value.services[slug]?.kind ?? 'domain',
            ...(value.services[slug]?.kind === 'domain'
              ? { runtimeFiles: await buildRuntimeArtifactFiles(value, rootDir, slug, uiBuildFiles) }
              : {}),
          },
        ]),
      ),
    ),
    ...(value.project.routes === undefined ? {} : { routes: value.project.routes }),
    ...(value.project.middleware === undefined ? {} : { middleware: value.project.middleware }),
    ...(value.project.mounts === undefined ? {} : { mounts: value.project.mounts }),
    ...(Object.keys(modules).length > 0 ? { modules } : {}),
    ...(value.workflows === undefined ? {} : { workflows: value.workflows }),
    ...(workflowFiles === undefined ? {} : { workflowFiles }),
    ...(Object.keys(workflowGrpcServices).length === 0 ? {} : { workflowGrpcServices }),
  };
}

type WorkflowGrpcServiceRegistry = NonNullable<ComposedProjectInput['workflowGrpcServices']>;
type GrpcShapeRegistry = Parameters<typeof emitProto>[1];
type GrpcResolvedShape = GrpcShapeRegistry[string];

function workflowGrpcServicesForProject(project: ComposedBlueprint): WorkflowGrpcServiceRegistry {
  if (project.workflows === null || project.workflows === undefined) return {};
  const serviceSlugs = new Set(
    project.workflows.serviceTasks
      .map((task) => task.bindingRef.split('.')[0] ?? '')
      .filter((slug) => slug.length > 0),
  );
  const out: Record<string, WorkflowGrpcServiceRegistry[string]> = {};
  for (const serviceSlug of [...serviceSlugs].sort()) {
    const service = project.services[serviceSlug];
    if (service?.bindings === null || service?.bindings === undefined || service.graphSpec === null) continue;
    const packageName = grpcPackageNameForService(serviceSlug);
    const serviceName = grpcServiceNameForService(serviceSlug);
    out[serviceSlug] = {
      packageName,
      serviceName,
      protoSource: emitProto(service.bindings, collectGrpcShapesFromService(service), { packageName, serviceName }),
    };
  }
  return out;
}

function grpcPackageNameForService(serviceSlug: string): string {
  return `rntme.${serviceSlug.trim().toLowerCase().replace(/-/g, '_')}.v1`;
}

function grpcServiceNameForService(serviceSlug: string): string {
  return `${serviceSlug
    .split(/[^A-Za-z0-9]+/)
    .filter((part) => part.length > 0)
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join('')}Service`;
}

function collectGrpcShapesFromService(service: ComposedBlueprint['services'][string]): GrpcShapeRegistry {
  const acc: Record<string, GrpcResolvedShape> = {};
  const addCustomShape = (shapeName: string): void => {
    if (acc[shapeName] !== undefined) return;
    const custom = service.graphSpec?.shapes[shapeName];
    if (custom === undefined) return;
    acc[shapeName] = {
      name: shapeName,
      origin: 'custom',
      fields: Object.fromEntries(
        Object.entries(custom.fields).map(([fieldName, field]) => [
          fieldName,
          {
            type: { kind: 'scalar', primitive: field.type },
            nullable: field.nullable,
          },
        ]),
      ),
    } as GrpcResolvedShape;
  };

  for (const resolved of Object.values(service.bindings?.resolved ?? {})) {
    acc[resolved.outputShape.name] = resolved.outputShape as GrpcResolvedShape;
    for (const input of Object.values(resolved.signature.inputs)) {
      if (input.type.kind === 'row' || input.type.kind === 'rowset') {
        addCustomShape(input.type.shape);
      }
    }
  }
  return acc;
}

async function readWorkflowDefinitionFiles(
  workflows: NonNullable<ComposedBlueprint['workflows']>,
  rootDir: string,
): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  for (const definition of workflows.definitions) {
    if (Object.hasOwn(files, definition.bpmnFile)) continue;
    const path = workflowDefinitionPath(rootDir, definition.bpmnFile);
    try {
      files[definition.bpmnFile] = await readFile(path, 'utf8');
    } catch (cause) {
      if (errorCode(cause) === 'ENOENT') {
        throw new Error(`DEPLOY_EXECUTOR_WORKFLOW_FILE_NOT_FOUND: workflows/${definition.bpmnFile}`);
      }
      throw cause;
    }
  }
  return files;
}

function workflowDefinitionPath(rootDir: string, relativePath: string): string {
  if (!isSafeWorkflowFilePath(relativePath)) {
    throw new Error(`DEPLOY_EXECUTOR_WORKFLOW_FILE_PATH_INVALID: workflows/${relativePath}`);
  }
  const workflowRoot = join(rootDir, 'workflows');
  const filePath = join(workflowRoot, relativePath);
  const backToRoot = relative(workflowRoot, filePath).split('\\').join('/');
  if (backToRoot === '..' || backToRoot.startsWith('../')) {
    throw new Error(`DEPLOY_EXECUTOR_WORKFLOW_FILE_PATH_INVALID: workflows/${relativePath}`);
  }
  return filePath;
}

function isSafeWorkflowFilePath(path: string): boolean {
  if (path === '') return false;
  if (path.startsWith('/')) return false;
  if (path.includes('\\')) return false;
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(path)) return false;
  return path.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..');
}

async function buildRuntimeArtifactFiles(
  project: ComposedBlueprint,
  rootDir: string,
  serviceSlug: string,
  uiBuildFiles: Record<string, string>,
): Promise<Record<string, string>> {
  const service = project.services[serviceSlug];
  if (service === undefined) throw new Error(`DEPLOY_EXECUTOR_SERVICE_ARTIFACTS_NOT_FOUND:${serviceSlug}`);
  if (service.graphSpec === null) throw new Error(`DEPLOY_EXECUTOR_SERVICE_GRAPHS_NOT_FOUND:${serviceSlug}`);
  if (service.qsmValidated === null) throw new Error(`DEPLOY_EXECUTOR_SERVICE_QSM_NOT_FOUND:${serviceSlug}`);
  if (service.bindings === null) throw new Error(`DEPLOY_EXECUTOR_SERVICE_BINDINGS_NOT_FOUND:${serviceSlug}`);

  const files: Record<string, string> = {};
  const modules = runtimeModulesForService(project, serviceSlug);
  addJsonFile(files, 'manifest.json', {
    rntmeVersion: '1.0',
    service: { name: serviceSlug, version: '1.0.0' },
    surface: { http: { enabled: true, port: 3000 }, grpc: { enabled: true, port: 50051 } },
    seed: { enabled: service.seed !== null, path: 'seed.json' },
    modules,
  });
  for (const module of modules) {
    files[module.protoPath] = IDENTITY_INTROSPECTION_PROTO;
  }
  addJsonFile(files, 'pdm.json', project.pdm);
  addJsonFile(files, 'qsm.json', service.qsmValidated);
  addJsonFile(files, 'bindings.json', service.bindings.artifact);
  addJsonFile(files, 'shapes.json', service.graphSpec.shapes);

  for (const [graphId, graph] of Object.entries(service.graphSpec.graphs)) {
    addJsonFile(files, `graphs/${graphId}.json`, graph);
  }

  const hasServiceUi = await addOptionalDirectoryFiles(files, rootDir, `services/${serviceSlug}/ui`, 'ui');
  if (!hasServiceUi) addDefaultUiFiles(files, serviceSlug);
  Object.assign(files, uiBuildFiles);
  if (service.seed !== null) {
    await addOptionalTextFile(files, rootDir, `services/${serviceSlug}/seed/seed.json`, 'seed.json');
  }

  return files;
}

async function bundleVirtualEntrySource(
  virtualEntrySource: string,
  rootDir: string,
): Promise<Record<string, string>> {
  const workspaceRoot = findWorkspaceRoot();
  const outdir = join(rootDir, '.rntme-ui-build');
  const result = await build({
    stdin: {
      contents: virtualEntrySource,
      sourcefile: '__rntme_ui_entry.tsx',
      resolveDir: workspaceRoot,
      loader: 'tsx',
    },
    absWorkingDir: workspaceRoot,
    bundle: true,
    platform: 'browser',
    format: 'esm',
    target: 'es2022',
    splitting: true,
    sourcemap: false,
    minify: true,
    write: false,
    outdir,
    entryNames: 'main',
    chunkNames: 'chunks/[name]-[hash]',
    nodePaths: workspaceNodePaths(workspaceRoot),
    loader: { '.css': 'empty' },
    plugins: [workspacePackageResolver(workspaceRoot)],
  });

  const js = result.outputFiles.find((file) => file.path.endsWith('/main.js') || file.path.endsWith('\\main.js'));
  if (js === undefined) throw new Error('DEPLOY_EXECUTOR_UI_BUNDLE_MISSING_MAIN_JS');

  const files: Record<string, string> = { 'ui-build/main.css': readUiRuntimeCss(workspaceRoot) };
  for (const file of result.outputFiles) {
    const rel = relative(outdir, file.path).split('\\').join('/');
    if (rel.startsWith('..') || rel === '') continue;
    files[`ui-build/${rel}`] = file.text;
  }
  return files;
}

function workspacePackageResolver(workspaceRoot: string): Plugin {
  const packageDirs = discoverWorkspacePackageDirs(workspaceRoot);
  return {
    name: 'rntme-workspace-package-resolver',
    setup(buildApi) {
      buildApi.onResolve({ filter: /^@rntme\// }, (args) => {
        const packageName = packageNameFromImport(args.path);
        const packageDir = packageDirs.get(packageName);
        if (packageDir === undefined) return undefined;
        const subpath = args.path.slice(packageName.length);
        return { path: resolveWorkspaceExport(packageDir, subpath.length === 0 ? '.' : `.${subpath}`) };
      });
      buildApi.onResolve({ filter: /^\..*\.js$/ }, (args) => {
        const jsPath = join(args.resolveDir, args.path);
        if (existsSync(jsPath)) return undefined;
        const withoutJs = jsPath.slice(0, -'.js'.length);
        for (const candidate of [`${withoutJs}.ts`, `${withoutJs}.tsx`]) {
          if (existsSync(candidate)) return { path: candidate };
        }
        return undefined;
      });
    },
  };
}

function discoverWorkspacePackageDirs(workspaceRoot: string): Map<string, string> {
  const dirs = new Map<string, string>();
  for (const parent of ['packages', 'modules']) {
    collectPackageDirs(join(workspaceRoot, parent), dirs);
  }
  return dirs;
}

function workspaceNodePaths(workspaceRoot: string): string[] {
  const packageDirs = discoverWorkspacePackageDirs(workspaceRoot);
  const paths = [join(workspaceRoot, 'node_modules')];
  for (const packageDir of packageDirs.values()) {
    const nodeModules = join(packageDir, 'node_modules');
    if (existsSync(nodeModules)) paths.push(nodeModules);
  }
  return paths;
}

function collectPackageDirs(dir: string, output: Map<string, string>): void {
  if (!existsSync(dir)) return;
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const path = join(dir, entry.name);
    const packageJsonPath = join(path, 'package.json');
    if (existsSync(packageJsonPath)) {
      const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as { name?: unknown };
      if (typeof pkg.name === 'string') output.set(pkg.name, path);
      continue;
    }
    collectPackageDirs(path, output);
  }
}

function packageNameFromImport(value: string): string {
  const [scope, name] = value.split('/');
  return `${scope}/${name}`;
}

function resolveWorkspaceExport(packageDir: string, subpath: string): string {
  const packageJsonPath = join(packageDir, 'package.json');
  const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
    exports?: unknown;
    main?: unknown;
  };
  const target = exportTargetForSubpath(pkg.exports, subpath) ?? (subpath === '.' ? pkg.main : undefined);
  if (typeof target === 'string') return resolveWorkspaceTarget(packageDir, target);
  return join(packageDir, subpath === '.' ? 'index.js' : subpath.slice(2));
}

function resolveWorkspaceTarget(packageDir: string, target: string): string {
  const normalized = target.replace(/^\.\//, '');
  const direct = join(packageDir, normalized);
  if (existsSync(direct)) return direct;

  for (const candidate of sourceFallbacks(packageDir, normalized)) {
    if (existsSync(candidate)) return candidate;
  }

  return direct;
}

function sourceFallbacks(packageDir: string, normalized: string): string[] {
  const withoutJs = normalized.endsWith('.js') ? normalized.slice(0, -'.js'.length) : normalized;
  const candidates: string[] = [];

  if (withoutJs.startsWith('dist/client/')) {
    const rest = withoutJs.slice('dist/client/'.length);
    candidates.push(join(packageDir, 'client', `${rest}.ts`));
    candidates.push(join(packageDir, 'client', `${rest}.tsx`));
    candidates.push(join(packageDir, 'src', 'client', `${rest}.ts`));
    candidates.push(join(packageDir, 'src', 'client', `${rest}.tsx`));
  }

  if (withoutJs.startsWith('dist/')) {
    const rest = withoutJs.slice('dist/'.length);
    candidates.push(join(packageDir, 'src', `${rest}.ts`));
    candidates.push(join(packageDir, 'src', `${rest}.tsx`));
  }

  return candidates;
}

function exportTargetForSubpath(exportsField: unknown, subpath: string): string | undefined {
  if (typeof exportsField === 'string' && subpath === '.') return exportsField;
  if (typeof exportsField !== 'object' || exportsField === null) return undefined;
  const exportsMap = exportsField as Record<string, unknown>;
  const value = exportsMap[subpath];
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null) {
    const conditionMap = value as Record<string, unknown>;
    if (typeof conditionMap.import === 'string') return conditionMap.import;
    if (typeof conditionMap.default === 'string') return conditionMap.default;
  }
  return undefined;
}

function findWorkspaceRoot(): string {
  for (const start of [process.cwd(), dirname(fileURLToPath(import.meta.url))]) {
    let current = start;
    while (true) {
      if (
        (existsSync(join(current, 'packages', 'runtime', 'ui-runtime', 'package.json')) ||
          existsSync(join(current, 'packages', 'ui-runtime', 'package.json'))) &&
        existsSync(join(current, 'modules'))
      ) {
        return current;
      }
      const parent = dirname(current);
      if (parent === current) break;
      current = parent;
    }
  }
  return process.cwd();
}

export function readUiRuntimeCss(workspaceRoot: string): string {
  for (const cssPath of [
    join(workspaceRoot, 'packages', 'runtime', 'ui-runtime', 'build', 'main.css'),
    join(workspaceRoot, 'packages', 'ui-runtime', 'build', 'main.css'),
  ]) {
    if (existsSync(cssPath)) return readFileSync(cssPath, 'utf8');
  }
  return '/* rntme ui runtime styles unavailable at deploy bundle time */\n';
}

function runtimeModulesForService(
  project: ComposedBlueprint,
  serviceSlug: string,
): Array<{ name: string; grpc: { address: string }; protoPath: string }> {
  const slugs = new Set<string>();
  for (const [middlewareName, declaration] of Object.entries(project.project.middleware ?? {})) {
    if (declaration.kind !== 'auth' || declaration.moduleSlug === undefined) continue;
    if (!middlewareAppliesToService(project.project, middlewareName, serviceSlug)) continue;
    slugs.add(declaration.moduleSlug);
  }
  return [...slugs].sort().map((slug) => ({
    name: slug,
    grpc: { address: `${slug}:50051` },
    protoPath: `${slug}.proto`,
  }));
}

function middlewareAppliesToService(
  project: ComposedBlueprint['project'],
  middlewareName: string,
  serviceSlug: string,
): boolean {
  for (const mount of project.mounts ?? []) {
    if (!mount.use.includes(middlewareName)) continue;
    if (serviceForMountTarget(project, mount.target) === serviceSlug) return true;
  }
  return false;
}

function serviceForMountTarget(project: ComposedBlueprint['project'], target: string): string | undefined {
  if (target.startsWith('http:')) return project.routes?.http?.[target.slice('http:'.length)];
  if (target.startsWith('ui:')) return project.routes?.ui?.[target.slice('ui:'.length)];
  return undefined;
}

function addDefaultUiFiles(files: Record<string, string>, serviceSlug: string): void {
  const title = serviceSlug
    .split(/[^A-Za-z0-9]+/)
    .filter((part) => part.length > 0)
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join(' ') || 'Service';
  addJsonFile(files, 'ui/manifest.json', {
    version: '2.0',
    pdmRef: `${serviceSlug}.domain.v1`,
    qsmRef: `${serviceSlug}.read.v1`,
    graphSpecRef: `${serviceSlug}.graphs.v1`,
    bindingsRef: `${serviceSlug}.bindings.v1`,
    metadata: { title },
    layouts: { main: 'layouts/main' },
    routes: {
      '/': {
        layout: 'main',
        screen: 'screens/home',
      },
    },
  });
  addJsonFile(files, 'ui/layouts/main.screen.json', {});
  addJsonFile(files, 'ui/layouts/main.spec.json', {
    root: 'shell',
    elements: {
      shell: {
        type: 'Stack',
        props: { direction: 'vertical' },
        children: ['header'],
      },
      header: {
        type: 'Heading',
        props: { level: 1, text: title },
      },
    },
  });
  addJsonFile(files, 'ui/screens/home.screen.json', {
    metadata: { title },
  });
  addJsonFile(files, 'ui/screens/home.spec.json', {
    root: 'page',
    elements: {
      page: {
        type: 'Heading',
        props: { level: 1, text: title },
        children: [],
      },
    },
  });
}

async function addOptionalDirectoryFiles(
  files: Record<string, string>,
  rootDir: string,
  sourceRel: string,
  targetRel: string,
): Promise<boolean> {
  const sourceRoot = join(rootDir, sourceRel);
  try {
    await addDirectoryFilesFrom(files, sourceRoot, sourceRoot, targetRel);
    return true;
  } catch (cause) {
    if (errorCode(cause) === 'ENOENT') return false;
    throw cause;
  }
}

async function addDirectoryFilesFrom(
  files: Record<string, string>,
  sourceRoot: string,
  currentDir: string,
  targetRel: string,
): Promise<void> {
  const entries = await readdir(currentDir, { withFileTypes: true });
  for (const entry of entries) {
    const sourcePath = join(currentDir, entry.name);
    if (entry.isDirectory()) {
      await addDirectoryFilesFrom(files, sourceRoot, sourcePath, targetRel);
      continue;
    }
    if (entry.isFile()) {
      files[join(targetRel, relative(sourceRoot, sourcePath))] = await readFile(sourcePath, 'utf8');
    }
  }
}

async function addOptionalTextFile(
  files: Record<string, string>,
  rootDir: string,
  sourceRel: string,
  targetRel: string,
): Promise<void> {
  try {
    files[targetRel] = await readFile(join(rootDir, sourceRel), 'utf8');
  } catch (cause) {
    if (errorCode(cause) === 'ENOENT') return;
    throw cause;
  }
}

function addJsonFile(files: Record<string, string>, targetRel: string, value: unknown): void {
  files[targetRel] = `${JSON.stringify(value, null, 2)}\n`;
}

function errorCode(cause: unknown): string | undefined {
  if (typeof cause !== 'object' || cause === null || !('code' in cause)) return undefined;
  const code = (cause as { readonly code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}

function isComposedBlueprint(value: LoadedDeployProject): value is ComposedBlueprint {
  return (
    typeof value === 'object' &&
    value !== null &&
    'project' in value &&
    'pdm' in value &&
    'routing' in value &&
    'bindingRegistry' in value
  );
}

function redactTarget(target: DeployTargetWithSecret): DeployTarget {
  const {
    apiTokenCiphertext: _ciphertext,
    apiTokenNonce: _nonce,
    apiTokenKeyVersion: _keyVersion,
    ...rest
  } = target;
  return { ...rest, apiTokenRedacted: '***' };
}

function errorSummary(errors: readonly { readonly code?: string; readonly message?: string }[]): string {
  return errors.map((error) => `${error.code ?? 'UNKNOWN'}: ${error.message ?? ''}`).join('; ');
}

/**
 * Collect modules that declare a provisioner block from the composed project.
 * Only `ComposedBlueprint` values can have modules; `ComposedProjectInput` never does.
 * Returns an empty array when there are no provisioner-bearing modules (clean skip).
 */
function collectProvisionerModules(
  composed: LoadedDeployProject,
  tmpDir: string,
): DiscoveredProvisionerModule[] {
  if (!isComposedBlueprint(composed)) return [];
  const projectModules = composed.project.modules;
  if (projectModules === undefined || Object.keys(projectModules).length === 0) return [];

  // Re-use the discovery result from blueprint to get full module manifests
  // (including provisioner blocks) without re-loading the project from scratch.
  const discovered = discoverModules({ projectDir: tmpDir });
  if (!discovered.ok) return [];

  const out: DiscoveredProvisionerModule[] = [];
  for (const [_manifestName, info] of Object.entries(discovered.value)) {
    if (!info.manifest.provisioner) continue;
    out.push({
      projectKey: info.projectKey,
      packageName: info.manifest.name,
      manifest: info.manifest,
      publicConfig: info.publicConfig,
    });
  }
  return out;
}
