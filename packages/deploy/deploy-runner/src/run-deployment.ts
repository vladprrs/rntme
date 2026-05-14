import type { ProjectDeploymentPlan } from '@rntme/deploy-core';
import type { DeploymentApplyResult } from '@rntme/deploy-dokploy';
import { buildProjectDeploymentConfig } from './build-deploy-config.js';
import { redact } from './redactor.js';
import { stages, StageError } from './stages/index.js';
import type { ComposeStageOutput, StageContext } from './stages/types.js';
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
 * Pure deploy orchestrator. Performs compose → provision → plan → render →
 * apply → verify over hooks-only side effects. Never touches a database, blob
 * store, or secret cipher; the caller pre-fetches/decrypts everything and
 * emits persistence via `inputs.hooks`.
 *
 * Each phase is a thin wrapper over the corresponding `stages.*` function,
 * which is also exported for the BPMN orchestration path that runs each
 * stage as an independent native task. Callers that already converted the
 * composed blueprint (CLI direct-mode and BPMN compose-handler) pass
 * `composedBlueprint` and skip the on-disk compose load; new callers that
 * only have the bundleDir omit it.
 */
export async function runDeployment(inputs: RunDeploymentInputs): Promise<TerminalResult> {
  const hooks: DeploymentHooks = inputs.hooks ?? {};
  const log = async (line: SanitizedLogLine): Promise<void> => {
    if (hooks.onLog === undefined) return;
    await hooks.onLog({ ...line, message: redact(line.message) });
  };

  const ctx: StageContext = {
    orgSlug: inputs.orgSlug,
    target: inputs.target,
    resolvedTargetSecrets: inputs.resolvedTargetSecrets,
    configOverrides: inputs.configOverrides,
    ...(inputs.publicDeployDomain === undefined ? {} : { publicDeployDomain: inputs.publicDeployDomain }),
  };

  try {
    await emitStageBegin(hooks, 'compose');
    const composeStart = Date.now();
    // DEVIATION from spec: short-circuit if caller pre-loaded
    // `composedBlueprint`. The spec body always calls `stages.compose`, but
    // existing callers (CLI direct-mode and BPMN compose-handler) materialise
    // a minimal bundleDir that lacks the pdm/entities directory
    // `loadComposedBlueprint` requires, and pre-convert through
    // `toDeployCoreInput`. Lifting `toDeployCoreInput` into deploy-runner is
    // outside the scope of this task. The optional `composedBlueprint` field
    // preserves backward compatibility while allowing the BPMN handler path
    // to invoke `stages.compose` directly when only `bundleDir` is available.
    const composeOut: ComposeStageOutput =
      inputs.composedBlueprint === undefined
        ? await stages.compose({ bundleDir: inputs.bundleDir })
        : { composed: inputs.composedBlueprint, bundleDir: inputs.bundleDir };
    await emitStageComplete(hooks, 'compose', Date.now() - composeStart);

    // Build the deployment config once we have a project name. This drives
    // the eventBus / object-storage planning logic and lets us emit the
    // bus-mode log surfaced in deployment timelines by the caller.
    const config = buildProjectDeploymentConfig(inputs.target, inputs.orgSlug, inputs.configOverrides, {
      projectSlug: composeOut.composed.name,
      ...(inputs.publicDeployDomain === undefined ? {} : { publicDeployDomain: inputs.publicDeployDomain }),
    });
    await log({ level: 'info', step: 'plan', message: eventBusLogMessageFor(config.eventBus?.mode) });

    await emitStageBegin(hooks, 'provision');
    const provisionStart = Date.now();
    const provisionOut = await stages.provision(
      {
        ctx,
        composed: composeOut.composed,
        bundleDir: composeOut.bundleDir,
        priorProvisionOutputs: inputs.priorProvisionOutputs,
      },
      {
        ...(inputs.runProvisioners === undefined ? {} : { runProvisioners: inputs.runProvisioners }),
        resolveProvisioner: inputs.resolveProvisioner,
      },
    );
    if (provisionOut.provisioned.size > 0) {
      await log({
        level: 'info',
        step: 'provision',
        message: `Provisioning ${provisionOut.provisioned.size} module(s)`,
      });
    }
    if (hooks.onProvisionResult !== undefined) {
      await hooks.onProvisionResult({
        publicByModule: provisionOut.publicByModule,
        secretByModule: provisionOut.secretByModule,
        startedAt: provisionOut.startedAt,
        finishedAt: provisionOut.finishedAt,
      });
    }
    await emitStageComplete(hooks, 'provision', Date.now() - provisionStart);

    await emitStageBegin(hooks, 'plan');
    const planStart = Date.now();
    const planOut = await stages.plan(
      { ctx, composed: composeOut.composed, provision: provisionOut },
      inputs.planProject,
    );
    await emitStageComplete(hooks, 'plan', Date.now() - planStart);

    let resolvedRequiredSecrets: Readonly<Record<string, unknown>> = {};
    if (planOut.plan.requiredTargetSecrets.length > 0) {
      await log({ level: 'info', step: 'validate-secrets', message: 'Validating required target secrets' });
      resolvedRequiredSecrets = await validateRequiredSecrets(planOut.plan, inputs);
    }

    await log({ level: 'info', step: 'render', message: 'Rendering Dokploy plan' });
    await emitStageBegin(hooks, 'render');
    const renderStart = Date.now();
    const renderOut = await stages.render(
      {
        ctx,
        plan: planOut.plan,
        provisioned: provisionOut.provisioned,
        bundleDir: composeOut.bundleDir,
      },
      inputs.renderPlan,
    );
    await emitStageComplete(hooks, 'render', Date.now() - renderStart);
    await log({
      level: 'info',
      step: 'render',
      message: `Rendered Dokploy plan digest ${renderOut.rendered.digest}`,
    });

    if (inputs.configOverrides['dryRun'] === true) {
      await log({ level: 'info', step: 'dry-run', message: 'Dry run complete; skipping apply and verify' });
      return await terminalSuccess(hooks);
    }

    await log({ level: 'info', step: 'apply', message: 'Applying Dokploy plan' });
    await emitStageBegin(hooks, 'apply');
    let applyOut;
    try {
      applyOut = await stages.apply(
        {
          ctx,
          rendered: renderOut.rendered,
          resolvedRequiredSecrets,
          dokployClientFactory: inputs.dokployClientFactory,
        },
        inputs.applyPlan,
      );
    } catch (cause) {
      if (cause instanceof StageError) {
        await logApplyFailure(log, cause);
        return await terminalFailure(hooks, {
          errorCode: cause.code,
          errorMessage: redact(cause.message),
          errorTree: deployErrorsToPlatformError(asStageErrorInputArray(cause.cause), 'apply'),
        });
      }
      throw cause;
    }
    if (hooks.onApplyResult !== undefined) {
      await hooks.onApplyResult({ actions: applyOut.applied, durationMs: applyOut.durationMs });
    }
    await emitStageComplete(hooks, 'apply', applyOut.durationMs);

    for (const resource of applyOut.applied.resources) {
      await log({
        level: 'info',
        step: 'apply',
        message: `${resource.resourceKind} ${
          resource.workloadSlug ?? resource.infrastructureKind ?? resource.logicalId
        } ${resource.action} target=${resource.targetResourceName}`,
      });
    }

    await log({ level: 'info', step: 'verify', message: 'Running smoke verification' });
    await emitStageBegin(hooks, 'verify');
    const verifyStart = Date.now();
    let verifyOut;
    try {
      verifyOut = await stages.verify(
        { applied: applyOut.applied },
        { ...(inputs.smoker === undefined ? {} : { smoker: inputs.smoker }) },
      );
    } catch (cause) {
      if (cause instanceof StageError) {
        const report = verificationReportFromCause(cause.cause);
        if (report !== null && hooks.onVerifyResult !== undefined) {
          await hooks.onVerifyResult({ report });
        }
        return await terminalFailure(hooks, {
          errorCode: cause.code,
          errorMessage: redact(cause.message),
        });
      }
      throw cause;
    }
    if (hooks.onVerifyResult !== undefined) {
      await hooks.onVerifyResult({ report: verifyOut.report });
    }
    await emitStageComplete(hooks, 'verify', Date.now() - verifyStart);

    return await terminalSuccess(hooks);
  } catch (cause) {
    if (cause instanceof StageError) {
      return await terminalFailure(hooks, {
        errorCode: cause.code,
        errorMessage: redact(cause.message),
        ...(cause.cause === undefined
          ? {}
          : { errorTree: deployErrorsToPlatformError(asStageErrorInputArray(cause.cause), stageFromCode(cause.code)) }),
      });
    }
    return await terminalFailure(hooks, {
      errorCode: 'DEPLOY_EXECUTOR_UNCAUGHT',
      errorMessage: redact(cause instanceof Error ? cause.message : String(cause)),
    });
  }
}

async function validateRequiredSecrets(
  plan: ProjectDeploymentPlan,
  inputs: RunDeploymentInputs,
): Promise<Readonly<Record<string, unknown>>> {
  const required = plan.requiredTargetSecrets;
  if (required.length === 0) return {};
  const validated: Record<string, unknown> = {};
  for (const ref of required) {
    const decryptedValue = inputs.resolvedTargetSecrets.extras[ref.secretRef];
    if (decryptedValue === undefined) {
      throw new StageError(
        'DEPLOY_EXECUTOR_TARGET_SECRET_MISSING',
        `target secret "${ref.secretRef}" is required for ${ref.purpose} but not found on target`,
      );
    }
    if (inputs.parseTargetSecret !== undefined) {
      const parseResult = inputs.parseTargetSecret(ref.schema, decryptedValue);
      if (!parseResult.ok) {
        // Parsers may return their own `DEPLOY_*` error codes (e.g.
        // DEPLOY_EXECUTOR_TARGET_SECRET_SCHEMA_MISMATCH); propagate verbatim
        // so callers that wrap the parser to pre-validate schema-id matches
        // see their own code. Otherwise default to the generic INVALID code.
        const firstCode = parseResult.errors[0]?.code;
        const errorCode =
          typeof firstCode === 'string' && firstCode.startsWith('DEPLOY_')
            ? firstCode
            : 'DEPLOY_EXECUTOR_TARGET_SECRET_INVALID';
        const baseMessage = `target secret "${ref.secretRef}" failed validation: ${parseResult.errors
          .map((e) => e.message)
          .join('; ')}`;
        throw new StageError(
          errorCode,
          errorCode === 'DEPLOY_EXECUTOR_TARGET_SECRET_INVALID'
            ? baseMessage
            : (parseResult.errors[0]?.message ?? baseMessage),
        );
      }
      validated[ref.secretRef] = parseResult.value;
    } else {
      validated[ref.secretRef] = decryptedValue;
    }
  }
  return validated;
}

function eventBusLogMessageFor(mode: string | undefined): string {
  if (mode === 'provisioned') return 'Provisioning Redpanda event bus';
  if (mode === 'in-memory') return 'Using in-memory event bus';
  if (mode === 'external') return 'Using external Kafka/Redpanda event bus';
  return 'Event bus mode unspecified';
}

type ApplyFailureCause = {
  readonly cause?: unknown;
  readonly partialFailure?: {
    readonly failedStep?: {
      readonly action?: string;
      readonly resourceKind?: string;
      readonly workloadSlug?: string;
      readonly infrastructureKind?: string;
      readonly resourceName?: string;
    };
  };
  readonly message?: string;
};

async function logApplyFailure(
  log: (line: SanitizedLogLine) => Promise<void>,
  stageError: StageError,
): Promise<void> {
  const errors = asStageErrorInputArray(stageError.cause);
  const first = errors[0] as (StageErrorInput & ApplyFailureCause) | undefined;
  const failed = first?.partialFailure?.failedStep;
  const cause = applyFailureCauseString(first?.cause);
  const summary = errors.map((e) => `${e.code ?? 'UNKNOWN'}: ${e.message ?? ''}`).join('; ');
  const detail =
    failed === undefined
      ? `${summary}${cause === undefined ? '' : `: ${cause}`}`
      : `${failed.action ?? 'apply'} ${failed.resourceKind ?? 'resource'} ${
          failed.workloadSlug ?? failed.infrastructureKind ?? failed.resourceName ?? ''
        }: ${first?.message ?? ''}${cause === undefined ? '' : `: ${cause}`}`;
  await log({ level: 'error', step: 'apply', message: detail });
}

function applyFailureCauseString(cause: unknown): string | undefined {
  if (cause === undefined || cause === null) return undefined;
  if (cause instanceof Error) return redact(cause.message);
  if (typeof cause === 'string') return redact(cause);
  if (typeof cause === 'object' && 'message' in cause && typeof (cause as { message: unknown }).message === 'string') {
    return redact((cause as { message: string }).message);
  }
  return redact(JSON.stringify(cause));
}

function verificationReportFromCause(cause: unknown): VerificationReport | null {
  if (typeof cause !== 'object' || cause === null) return null;
  const c = cause as { checks?: unknown; ok?: unknown; partialOk?: unknown };
  if (Array.isArray(c.checks) && typeof c.ok === 'boolean' && typeof c.partialOk === 'boolean') {
    return cause as VerificationReport;
  }
  return null;
}

function asStageErrorInputArray(cause: unknown): readonly StageErrorInput[] {
  if (Array.isArray(cause)) {
    return cause.filter((e): e is StageErrorInput => typeof e === 'object' && e !== null) as readonly StageErrorInput[];
  }
  return [];
}

function stageFromCode(code: string): 'plan' | 'render' | 'apply' | 'verify' | 'provision' {
  if (code.startsWith('DEPLOY_PLAN_')) return 'plan';
  if (code.startsWith('DEPLOY_RENDER_')) return 'render';
  if (code.startsWith('DEPLOY_APPLY_')) return 'apply';
  if (code.startsWith('DEPLOY_VERIFY_')) return 'verify';
  if (code.startsWith('DEPLOY_PROVISION_')) return 'provision';
  return 'plan';
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

// Suppress unused import warning until DeploymentApplyResult is referenced
// directly; for now it's only structurally observed via applyOut.
type _UnusedDeploymentApplyResult = DeploymentApplyResult;
