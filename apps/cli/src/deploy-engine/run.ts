import {
  runDeployment as defaultRunDeployment,
  type DeploymentHooks,
  type RunDeploymentInputs,
  type SanitizedLogLine,
  type StageEvidence,
  type StageName,
  type TerminalResult,
} from '@rntme/deploy-runner';
import type { DirectRunResult } from './report.js';

export type DirectDeploymentInputs = Omit<RunDeploymentInputs, 'hooks'> & {
  readonly stdout: { write: (s: string) => boolean | void };
  readonly logFileWriter?: (line: string) => void;
  readonly orchestrator?: typeof defaultRunDeployment;
  readonly orgSlug: string;
};

export async function runDirectDeployment(
  inputs: DirectDeploymentInputs,
): Promise<{ ok: true; result: DirectRunResult } | { ok: false; result: DirectRunResult }> {
  const orchestrator = inputs.orchestrator ?? defaultRunDeployment;
  let terminal: TerminalResult = { ok: false, kind: 'failed', errorCode: 'CLI_DEPLOY_NEVER_RAN', errorMessage: 'no terminal hook fired' };

  const writeJsonl = (event: Record<string, unknown>): void => {
    if (inputs.logFileWriter !== undefined) {
      inputs.logFileWriter(`${JSON.stringify(event)}\n`);
    }
  };

  const hooks: DeploymentHooks = {
    onLog: (line: SanitizedLogLine) => {
      inputs.stdout.write(`[${line.level}] ${line.step}: ${line.message}\n`);
      writeJsonl({ type: 'log', ...line });
    },
    onStageBegin: (stage: StageName) => {
      inputs.stdout.write(`▶ ${stage}\n`);
      writeJsonl({ type: 'stage-begin', stage });
    },
    onStageComplete: (stage: StageName, evidence: StageEvidence) => {
      inputs.stdout.write(`✓ ${stage} (${evidence.durationMs}ms)\n`);
      writeJsonl({ type: 'stage-complete', stage, durationMs: evidence.durationMs });
    },
    onProvisionResult: (envelope) => writeJsonl({ type: 'provision-result', ...envelope }),
    onApplyResult: (envelope) => writeJsonl({ type: 'apply-result', ...envelope }),
    onVerifyResult: (envelope) => writeJsonl({ type: 'verify-result', ...envelope }),
    onTerminal: (result) => {
      terminal = result;
      writeJsonl({ type: 'terminal', ok: result.ok, ...(result.ok ? {} : { errorCode: result.errorCode, errorMessage: result.errorMessage }) });
    },
  };

  const { stdout: _stdout, logFileWriter: _writer, orchestrator: _orchestrator, ...runnerInputs } = inputs;
  await orchestrator({ ...(runnerInputs as RunDeploymentInputs), hooks });

  const result: DirectRunResult = {
    target: inputs.target.slug ?? 'unknown',
    project: inputs.composedBlueprint.name,
    terminal,
  };
  return terminal.ok ? { ok: true, result } : { ok: false, result };
}
