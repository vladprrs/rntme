import { discoverModules } from '@rntme/blueprint';
import {
  applyVars,
  buildProjectDeploymentPlan,
  resolveTargetVarsOnly,
  runProvisioners,
  targetForVars,
  type DiscoveredModulesForVars,
  type DiscoveredProvisionerModule,
  type ProjectDeploymentPlan,
  type ProvisionResultForVars,
  type ProvisionedModule,
  type ProvisionerEnvMapping,
} from '@rntme/deploy-core';
import {
  applyDokployPlan,
  isComposeTaskHealthy,
  renderDokployPlan,
  type DeploymentApplyResult,
  type RenderedDokployPlan,
} from '@rntme/deploy-dokploy';
import { buildDokployTargetConfig, buildProjectDeploymentConfig } from './build-deploy-config.js';
import { redact } from './redactor.js';
import { SmokeVerifier } from './smoke-verifier.js';
import { runStage, type StageLog } from './stage-runner.js';
import type {
  DeploymentHooks,
  RunDeploymentInputs,
  RunnerError,
  RunnerErrorNode,
  SanitizedLogLine,
  StageEvidence,
  StageName,
  TerminalResult,
  VerificationReport,
} from './types.js';

type StageErrorInput = {
  readonly code?: string;
  readonly message?: string;
  readonly path?: string;
  readonly cause?: unknown;
};

/**
 * Pure deploy orchestrator. Performs plan → provision → render → apply → verify
 * over hooks-only side effects. Never touches a database, blob store, or
 * secret cipher; the caller pre-fetches/decrypts everything and emits
 * persistence via `inputs.hooks`.
 */
export async function runDeployment(inputs: RunDeploymentInputs): Promise<TerminalResult> {
  const hooks: DeploymentHooks = inputs.hooks ?? {};
  const log = async (line: SanitizedLogLine): Promise<void> => {
    if (hooks.onLog === undefined) return;
    await hooks.onLog({ ...line, message: redact(line.message) });
  };
  const stageLog: StageLog = (entry) =>
    log({ level: entry.level, step: entry.step, message: `${entry.code}: ${entry.message}` });

  const composed = inputs.composedBlueprint;
  const bundleDir = inputs.bundleDir;
  const target = inputs.target;
  const orgSlug = inputs.orgSlug;
  const decryptedTargetSecrets = inputs.resolvedTargetSecrets.extras;

  try {
    const config = buildProjectDeploymentConfig(target, orgSlug, inputs.configOverrides, {
      projectSlug: composed.name,
      ...(inputs.publicDeployDomain === undefined ? {} : { publicDeployDomain: inputs.publicDeployDomain }),
    });

    const provModules = await collectProvisionerModules(bundleDir);

    const eventBusModeForLog =
      config.eventBus === undefined
        ? 'unknown'
        : config.eventBus.mode === 'provisioned'
          ? 'provisioned'
          : config.eventBus.mode === 'in-memory'
            ? 'in-memory'
            : 'external';
    const eventBusLogMessage =
      eventBusModeForLog === 'provisioned'
        ? 'Provisioning Redpanda event bus'
        : eventBusModeForLog === 'in-memory'
          ? 'Using in-memory event bus'
          : eventBusModeForLog === 'external'
            ? 'Using external Kafka/Redpanda event bus'
            : 'Event bus mode unspecified';
    await log({ level: 'info', step: 'plan', message: eventBusLogMessage });

    let provisioned: ReadonlyMap<string, ProvisionedModule> = new Map();
    let provisionResultForPlan: ProvisionResultForVars | undefined;
    let discoveredModulesForPlan: DiscoveredModulesForVars | undefined;

    if (config.manualAccess?.redpandaConsole?.enabled === true) {
      const urlHint = config.manualAccess?.redpandaConsole?.publicBaseUrl ?? 'unset';
      const userHint = config.manualAccess?.redpandaConsole?.basicAuth.username ?? '';
      await log({
        level: 'info',
        step: 'provision',
        message: `Redpanda Console manual validation access enabled url=${urlHint} user=${userHint}`,
      });
    }

    if (provModules.length > 0) {
      const dm: Record<string, { producesNames: string[] }> = {};
      for (const m of provModules) {
        const names = m.manifest.provisioner?.produces.map((p) => p.name) ?? [];
        dm[m.projectKey] = { producesNames: names };
      }
      discoveredModulesForPlan = dm;

      const priorOutputs = inputs.priorProvisionOutputs;

      // Substitute target.* vars into each module's publicConfig before
      // handing it to the provisioner. provision.* placeholders cannot resolve
      // pre-provision and remain as ${...} literals — provisioner inputs that
      // depend on those fields would necessarily see them unresolved.
      const targetVarsResult = resolveTargetVarsOnly(
        composed.varsManifest ?? {},
        targetForVars(config, target.slug),
      );
      if (!targetVarsResult.ok) {
        return await terminalFailure(hooks, {
          errorCode: targetVarsResult.errors[0]?.code ?? 'DEPLOY_PLAN_UNKNOWN',
          errorMessage: redact(errorSummary(targetVarsResult.errors)),
          errorTree: deployErrorsToPlatformError(targetVarsResult.errors, 'plan'),
        });
      }
      const targetVars = targetVarsResult.value;
      const provModulesWithSubstitutedConfig: DiscoveredProvisionerModule[] = provModules.map((m) => ({
        ...m,
        publicConfig: applyVars(m.publicConfig, targetVars) as Record<string, unknown>,
      }));

      await log({ level: 'info', step: 'provision', message: `Provisioning ${provModules.length} module(s)` });
      await emitStageBegin(hooks, 'provision');
      const provisionStart = Date.now();
      const startedAt = new Date().toISOString();
      const provisionRunner = inputs.runProvisioners ?? runProvisioners;
      const provisionResult = await runStage(
        'provision',
        async () =>
          provisionRunner({
            modules: provModulesWithSubstitutedConfig.map((m) => {
              const prior = priorOutputs[m.projectKey];
              return prior === undefined ? m : { ...m, priorOutputs: prior };
            }),
            resolvedTargetSecrets: decryptedTargetSecrets,
            projectDir: bundleDir,
            resolveProvisioner: inputs.resolveProvisioner,
            log: (e) => {
              void log({ level: e.level, step: e.step, message: e.message });
            },
          }),
        { log: stageLog },
      );
      if (!provisionResult.ok) {
        return await terminalFailure(hooks, {
          errorCode: provisionResult.errors[0]?.code ?? 'DEPLOY_PROVISION_UNKNOWN',
          errorMessage: redact(errorSummary(provisionResult.errors)),
          errorTree: deployErrorsToPlatformError(provisionResult.errors, 'provision'),
        });
      }
      const finishedAt = new Date().toISOString();
      await emitStageComplete(hooks, 'provision', Date.now() - provisionStart);

      const moduleMap = new Map<string, ProvisionedModule>();
      const publicByModule: Record<string, Record<string, unknown>> = {};
      const secretByModule: Record<string, Record<string, unknown>> = {};
      const publicOutputsForPlan: Record<string, { publicOutputs: Record<string, unknown> }> = {};

      for (const m of provisionResult.value.modules) {
        moduleMap.set(m.projectKey, m);
        publicOutputsForPlan[m.projectKey] = { publicOutputs: { ...m.publicOutputs } };
        publicByModule[m.projectKey] = { ...m.publicOutputs };
        if (Object.keys(m.secretOutputs).length > 0) {
          secretByModule[m.projectKey] = { ...m.secretOutputs };
        }
      }
      provisioned = moduleMap;
      provisionResultForPlan = { modules: publicOutputsForPlan };

      if (hooks.onProvisionResult !== undefined) {
        await hooks.onProvisionResult({ publicByModule, secretByModule, startedAt, finishedAt });
      }
    }

    // Plan now runs AFTER provision so vars can resolve provision.* paths.
    await emitStageBegin(hooks, 'plan');
    const planStart = Date.now();
    const planner = inputs.planProject ?? buildProjectDeploymentPlan;
    const plan = await runStage(
      'plan',
      async () =>
        planner(composed, config, {
          ...(provisionResultForPlan ? { provisionResult: provisionResultForPlan } : {}),
          ...(discoveredModulesForPlan ? { discoveredModules: discoveredModulesForPlan } : {}),
        }),
      { log: stageLog },
    );
    if (!plan.ok) {
      return await terminalFailure(hooks, {
        errorCode: plan.errors[0]?.code ?? 'DEPLOY_PLAN_UNKNOWN',
        errorMessage: redact(errorSummary(plan.errors)),
        errorTree: deployErrorsToPlatformError(plan.errors, 'plan'),
      });
    }
    await emitStageComplete(hooks, 'plan', Date.now() - planStart);

    let resolvedTargetSecrets: Readonly<Record<string, unknown>> | undefined;
    const requiredSecrets = plan.value.requiredTargetSecrets;
    if (requiredSecrets.length > 0) {
      await log({ level: 'info', step: 'validate-secrets', message: 'Validating required target secrets' });
      const validated: Record<string, unknown> = {};
      for (const ref of requiredSecrets) {
        const decryptedValue = decryptedTargetSecrets[ref.secretRef];
        if (decryptedValue === undefined) {
          return await terminalFailure(hooks, {
            errorCode: 'DEPLOY_EXECUTOR_TARGET_SECRET_MISSING',
            errorMessage: redact(
              `target secret "${ref.secretRef}" is required for ${ref.purpose} but not found on target`,
            ),
          });
        }
        if (inputs.parseTargetSecret !== undefined) {
          const parseResult = inputs.parseTargetSecret(ref.schema, decryptedValue);
          if (!parseResult.ok) {
            return await terminalFailure(hooks, {
              errorCode: 'DEPLOY_EXECUTOR_TARGET_SECRET_INVALID',
              errorMessage: redact(
                `target secret "${ref.secretRef}" failed validation: ${parseResult.errors
                  .map((e) => e.message)
                  .join('; ')}`,
              ),
            });
          }
          validated[ref.secretRef] = parseResult.value;
        } else {
          validated[ref.secretRef] = decryptedValue;
        }
      }
      resolvedTargetSecrets = validated;
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

    await log({ level: 'info', step: 'render', message: 'Rendering Dokploy plan' });
    await emitStageBegin(hooks, 'render');
    const renderStart = Date.now();
    const renderer = inputs.renderPlan ?? renderDokployPlan;
    const rendered = await runStage(
      'render',
      async () =>
        renderer(
          plan.value as ProjectDeploymentPlan,
          buildDokployTargetConfig(target, inputs.configOverrides, {
            orgSlug,
            projectSlug: plan.value.project.projectSlug,
            environment: plan.value.project.environment,
            ...(inputs.publicDeployDomain === undefined ? {} : { publicDeployDomain: inputs.publicDeployDomain }),
          }),
          provisioned,
          envMappings,
        ),
      { log: stageLog },
    );
    if (!rendered.ok) {
      return await terminalFailure(hooks, {
        errorCode: rendered.errors[0]?.code ?? 'DEPLOY_RENDER_DOKPLOY_UNKNOWN',
        errorMessage: redact(errorSummary(rendered.errors)),
        errorTree: deployErrorsToPlatformError(rendered.errors, 'render'),
      });
    }
    await emitStageComplete(hooks, 'render', Date.now() - renderStart);
    await log({
      level: 'info',
      step: 'render',
      message: `Rendered Dokploy plan digest ${rendered.value.digest}`,
    });

    await log({ level: 'info', step: 'apply', message: 'Applying Dokploy plan' });
    await emitStageBegin(hooks, 'apply');
    const applyStart = Date.now();
    const applier = inputs.applyPlan ?? applyDokployPlan;
    const dokployClient = inputs.dokployClientFactory(
      inputs.resolvedTargetSecrets.apiToken,
      resolvedTargetSecrets ?? decryptedTargetSecrets,
    );
    const applied = await runStage(
      'apply',
      async () => applier(rendered.value as RenderedDokployPlan, dokployClient),
      { log: stageLog },
    );
    if (!applied.ok) {
      await logApplyFailure(log, applied.errors);
      return await terminalFailure(hooks, {
        errorCode: applied.errors[0]?.code ?? 'DEPLOY_APPLY_DOKPLOY_UNKNOWN',
        errorMessage: redact(errorSummary(applied.errors)),
        errorTree: deployErrorsToPlatformError(applied.errors, 'apply'),
      });
    }
    const applyDurationMs = Date.now() - applyStart;
    await emitStageComplete(hooks, 'apply', applyDurationMs);

    if (hooks.onApplyResult !== undefined) {
      await hooks.onApplyResult({ actions: applied.value, durationMs: applyDurationMs });
    }

    for (const resource of applied.value.resources) {
      await log({
        level: 'info',
        step: 'apply',
        message: `${resource.resourceKind} ${
          resource.workloadSlug ?? resource.infrastructureKind ?? resource.logicalId
        } ${resource.action} target=${resource.targetResourceName}`,
      });
    }

    await log({ level: 'info', step: 'verify', message: 'Running compose stack verification' });
    await emitStageBegin(hooks, 'verify');
    const verifyStart = Date.now();
    const stackVerification = verifyComposeStack(applied.value as DeploymentApplyResult);
    if (stackVerification !== null && !stackVerification.ok) {
      if (hooks.onVerifyResult !== undefined) {
        await hooks.onVerifyResult({ report: stackVerification });
      }
      await emitStageComplete(hooks, 'verify', Date.now() - verifyStart);
      return await terminalFailure(hooks, {
        errorCode: 'DEPLOY_VERIFY_WORKLOAD_CRASH_LOOP',
        errorMessage: 'workload crash loop detected',
      });
    }

    await log({ level: 'info', step: 'verify', message: 'Running smoke verification' });
    const smoker = inputs.smoker ?? new SmokeVerifier();
    const verification = await smoker.verify(applied.value as DeploymentApplyResult);
    if (hooks.onVerifyResult !== undefined) {
      await hooks.onVerifyResult({ report: verification });
    }
    await emitStageComplete(hooks, 'verify', Date.now() - verifyStart);

    if (verification.ok) {
      return await terminalSuccess(hooks);
    }
    if (verification.partialOk) {
      // Partial-OK is treated as success at the runner level. Caller can
      // distinguish via the verification report passed through onVerifyResult.
      return await terminalSuccess(hooks);
    }
    return await terminalFailure(hooks, {
      errorCode: 'DEPLOY_EXECUTOR_SMOKE_FAILED',
      errorMessage: 'smoke verification failed',
    });
  } catch (cause) {
    return await terminalFailure(hooks, {
      errorCode: 'DEPLOY_EXECUTOR_UNCAUGHT',
      errorMessage: redact(cause instanceof Error ? cause.message : String(cause)),
    });
  }
}

async function emitStageBegin(hooks: DeploymentHooks, stage: StageName): Promise<void> {
  if (hooks.onStageBegin === undefined) return;
  await hooks.onStageBegin(stage);
}

async function emitStageComplete(
  hooks: DeploymentHooks,
  stage: StageName,
  durationMs: number,
): Promise<void> {
  if (hooks.onStageComplete === undefined) return;
  const evidence: StageEvidence = { stage, durationMs };
  await hooks.onStageComplete(stage, evidence);
}

async function terminalSuccess(hooks: DeploymentHooks): Promise<TerminalResult> {
  const result: TerminalResult = { ok: true, kind: 'succeeded' };
  if (hooks.onTerminal !== undefined) await hooks.onTerminal(result);
  return result;
}

async function terminalFailure(
  hooks: DeploymentHooks,
  args: { readonly errorCode: string; readonly errorMessage: string; readonly errorTree?: RunnerError },
): Promise<TerminalResult> {
  const result: TerminalResult = {
    ok: false,
    kind: 'failed',
    errorCode: args.errorCode,
    errorMessage: args.errorMessage,
    ...(args.errorTree === undefined ? {} : { errorTree: args.errorTree }),
  };
  if (hooks.onTerminal !== undefined) await hooks.onTerminal(result);
  return result;
}

export function deployErrorsToPlatformError(
  errors: readonly StageErrorInput[],
  stage: 'plan' | 'render' | 'apply' | 'verify' | 'provision',
): RunnerError {
  const nodes = errors.map(stageErrorToNode);
  const flatMessage = errors.map((e) => `${e.code ?? 'UNKNOWN'}: ${e.message ?? ''}`).join('; ');
  return {
    code: 'PLATFORM_INTERNAL',
    message: flatMessage || `deployment ${stage} failed`,
    stage,
    errors: nodes,
  };
}

function stageErrorToNode(e: StageErrorInput): RunnerErrorNode {
  const node: { -readonly [K in keyof RunnerErrorNode]: RunnerErrorNode[K] } = {
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
  log: (line: SanitizedLogLine) => Promise<void>,
  errors: readonly {
    readonly code?: string;
    readonly message?: string;
    readonly cause?: unknown;
    readonly partialFailure?: unknown;
  }[],
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
      : `${failed.action ?? 'apply'} ${failed.resourceKind ?? 'resource'} ${
          failed.workloadSlug ?? failed.infrastructureKind ?? failed.resourceName ?? ''
        }: ${first?.message ?? ''}${cause === undefined ? '' : `: ${cause}`}`;
  await log({ level: 'error', step: 'apply', message: detail });
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

function verifyComposeStack(applyResult: DeploymentApplyResult): VerificationReport | null {
  const stack = applyResult.verificationHints.stack;
  if (stack === undefined) return null;
  const checks = (stack.inspections ?? []).map((inspection) => {
    return {
      name: `workload ${inspection.serviceName}`,
      url: `dokploy:compose/${stack.composeId}/${inspection.serviceName}`,
      status: inspection.status,
      latencyMs: 0,
      ok: isComposeTaskHealthy(inspection),
      note: inspection.message ?? `status=${inspection.status} failedCount=${inspection.failedCount}`,
    };
  });
  if (checks.length === 0) return { checks: [], ok: true, partialOk: false };
  return { checks, ok: checks.every((check) => check.ok), partialOk: false };
}

function errorSummary(errors: readonly { readonly code?: string; readonly message?: string }[]): string {
  return errors.map((error) => `${error.code ?? 'UNKNOWN'}: ${error.message ?? ''}`).join('; ');
}

/**
 * Collect modules that declare a provisioner block from the materialized
 * project directory. Returns an empty array when there are no provisioner-
 * bearing modules (clean skip).
 */
async function collectProvisionerModules(bundleDir: string): Promise<DiscoveredProvisionerModule[]> {
  const discovered = await discoverModules({ projectDir: bundleDir });
  if (!discovered.ok) return [];
  const out: DiscoveredProvisionerModule[] = [];
  for (const [, info] of Object.entries(discovered.value)) {
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
