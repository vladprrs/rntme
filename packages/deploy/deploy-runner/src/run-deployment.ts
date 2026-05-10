import type { ProjectDeploymentPlan } from '@rntme/deploy-core';
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
 * composed blueprint (platform-http executor, CLI direct-mode) pass
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
    // existing callers (platform-http executor, CLI direct-mode) materialise
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

    const resolvedRequiredSecrets = await validateRequiredSecrets(planOut.plan, inputs);

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

    await emitStageBegin(hooks, 'apply');
    const applyOut = await stages.apply(
      {
        ctx,
        rendered: renderOut.rendered,
        resolvedRequiredSecrets,
        dokployClientFactory: inputs.dokployClientFactory,
      },
      inputs.applyPlan,
    );
    if (hooks.onApplyResult !== undefined) {
      await hooks.onApplyResult({ actions: applyOut.applied, durationMs: applyOut.durationMs });
    }
    await emitStageComplete(hooks, 'apply', applyOut.durationMs);

    await emitStageBegin(hooks, 'verify');
    const verifyStart = Date.now();
    const verifyOut = await stages.verify(
      { applied: applyOut.applied },
      { ...(inputs.smoker === undefined ? {} : { smoker: inputs.smoker }) },
    );
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
        const firstCode = parseResult.errors[0]?.code;
        const errorCode =
          typeof firstCode === 'string' && firstCode.startsWith('DEPLOY_')
            ? firstCode
            : 'DEPLOY_EXECUTOR_TARGET_SECRET_INVALID';
        throw new StageError(
          errorCode,
          parseResult.errors[0]?.message ?? `target secret "${ref.secretRef}" failed validation`,
        );
      }
      validated[ref.secretRef] = parseResult.value;
    } else {
      validated[ref.secretRef] = decryptedValue;
    }
  }
  return validated;
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
