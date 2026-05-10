export type {
  NormalizedDeployTarget,
  ResolvedTargetSecrets,
  ResolveProvisioner,
  DeploymentHooks,
  RunDeploymentInputs,
  TerminalResult,
  StageName,
  StageEvidence,
  SanitizedLogLine,
  ProvisionResultEnvelope,
  ApplyResultEnvelope,
  VerifyResultEnvelope,
} from './types.js';

export { redact } from './redactor.js';

export { runStage } from './stage-runner.js';
export type { StageLog, StageResult } from './stage-runner.js';
