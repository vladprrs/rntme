export type {
  NormalizedDeployTarget,
  ResolvedTargetSecrets,
  ResolveProvisioner,
  DeploymentHooks,
  RunDeploymentInputs,
  RunnerError,
  RunnerErrorNode,
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

export {
  createDokployClientFactory,
  normalizeDokployBaseUrl,
} from './dokploy-client-factory.js';
export type {
  DokployClientFactory,
  DokployResolvedTargetSecretMap,
  DokployTargetWithSecret,
  SecretCipher,
  EncryptedSecret,
  ParseTargetSecretFn,
  ParseTargetSecretResult,
} from './dokploy-client-factory.js';

export {
  buildProjectDeploymentConfig,
  buildDokployTargetConfig,
  derivePublicBaseUrl,
} from './build-deploy-config.js';
export type { PublicBaseUrlContext } from './build-deploy-config.js';
export type {
  EventBusConfig,
  KafkaSecurity,
  DeployTargetModules,
  ModuleConfig,
  DeployTargetWorkflows,
  OperatonUiAccess,
  DeployTargetStorage,
  DeployTargetAuthConfig,
  DeployTargetManualAccess,
  PolicyValues,
  DeployTargetServices,
  DeployTargetForBuild,
} from './deploy-target-types.js';

export { runTearDownsForDeployment } from './run-teardowns.js';
export type { TearDownDeps, TearDownInput } from './run-teardowns.js';

export { runProjectDelete } from './project-delete.js';
export type { ProjectDeleteExecutorDeps } from './project-delete.js';

export { runDeployment, deployErrorsToPlatformError } from './run-deployment.js';

export { buildResolveProvisioner } from './resolve-provisioner.js';
export type { BuildResolveProvisionerOptions } from './resolve-provisioner.js';

export { stages, StageError } from './stages/index.js';
export type {
  StageContext,
  ComposeStageInput,
  ComposeStageOutput,
  ProvisionStageInput,
  ProvisionStageOutput,
  PlanStageInput,
  PlanStageOutput,
  RenderStageInput,
  RenderStageOutput,
  ApplyStageInput,
  ApplyStageOutput,
  VerifyStageInput,
  VerifyStageOutput,
} from './stages/types.js';

export {
  composeStageHandler,
  provisionStageHandler,
  planStageHandler,
  renderStageHandler,
  applyStageHandler,
  verifyStageHandler,
  getPlatformHandlerContext,
  _setHandlerContextForTest,
} from './handlers/index.js';
export type {
  StageHandlerInput,
  StageHandlerResult,
  HandlerContext,
} from './handlers/index.js';
