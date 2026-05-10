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
  WorkloadStatus,
  VerificationCheck,
  VerificationReport,
} from './types.js';

export { redact } from './redactor.js';

export { runStage } from './stage-runner.js';
export type { StageLog, StageResult } from './stage-runner.js';

export { SmokeVerifier, defaultSmokeFetcher } from './smoke-verifier.js';
export type {
  SmokeFetcher,
  ProtectedRouteSpec,
  VerificationHints,
} from './smoke-verifier.js';
