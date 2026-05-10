import type { DeployStage } from '@rntme/platform-storage';

/**
 * Input envelope passed to every BPMN-task stage handler. Carries identifiers
 * sufficient to load all prior persisted state (deployment row, project version,
 * deploy target, prior `DeployStageState` rows) from the platform database.
 */
export type StageHandlerInput = {
  readonly deploymentId: string;
  readonly orgId: string;
};

/**
 * Result returned by every stage handler. Becomes the BPMN task result variable
 * via the worker. `publicSummary` is intentionally narrow — the full per-stage
 * artifacts live in the `DeployStageState` row (`publicStateJson`) and any
 * sensitive payloads spill to the blob store keyed by deployment id.
 */
export type StageHandlerResult = {
  readonly stage: DeployStage;
  readonly status: 'succeeded' | 'failed';
  readonly errorCode?: string;
  readonly errorMessage?: string;
  readonly publicSummary?: Record<string, unknown>;
};
