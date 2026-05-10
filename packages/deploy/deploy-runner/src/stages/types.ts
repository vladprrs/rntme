import type {
  ComposedProjectInput,
  DiscoveredModulesForVars,
  ProjectDeploymentPlan,
  ProvisionedModule,
  ProvisionerOutput,
  ProvisionResultForVars,
} from '@rntme/deploy-core';
import type { DeploymentApplyResult, RenderedDokployPlan } from '@rntme/deploy-dokploy';
import type { NormalizedDeployTarget, ResolvedTargetSecrets, VerificationReport } from '../types.js';

export type StageContext = {
  readonly orgSlug: string;
  readonly target: NormalizedDeployTarget;
  readonly resolvedTargetSecrets: ResolvedTargetSecrets;
  readonly configOverrides: Record<string, unknown>;
  readonly publicDeployDomain?: string;
};

export type ComposeStageInput = {
  readonly bundleDir: string;
};

export type ComposeStageOutput = {
  readonly composed: ComposedProjectInput;
  readonly bundleDir: string;
};

export type ProvisionStageInput = {
  readonly ctx: StageContext;
  readonly composed: ComposedProjectInput;
  readonly bundleDir: string;
  readonly priorProvisionOutputs: Readonly<Record<string, ProvisionerOutput>>;
};

export type ProvisionStageOutput = {
  readonly provisioned: ReadonlyMap<string, ProvisionedModule>;
  readonly publicByModule: Record<string, Record<string, unknown>>;
  readonly secretByModule: Record<string, Record<string, unknown>>;
  readonly provisionResultForPlan?: ProvisionResultForVars;
  readonly discoveredModulesForPlan?: DiscoveredModulesForVars;
  readonly startedAt: string;
  readonly finishedAt: string;
};

export type PlanStageInput = {
  readonly ctx: StageContext;
  readonly composed: ComposedProjectInput;
  readonly provision: ProvisionStageOutput;
};

export type PlanStageOutput = {
  readonly plan: ProjectDeploymentPlan;
};

export type RenderStageInput = {
  readonly ctx: StageContext;
  readonly plan: ProjectDeploymentPlan;
  readonly provisioned: ReadonlyMap<string, ProvisionedModule>;
  readonly bundleDir: string;
};

export type RenderStageOutput = {
  readonly rendered: RenderedDokployPlan;
};

export type ApplyStageInput = {
  readonly ctx: StageContext;
  readonly rendered: RenderedDokployPlan;
  readonly resolvedRequiredSecrets: Readonly<Record<string, unknown>>;
  readonly dokployClientFactory: (
    apiToken: string,
    extras?: Readonly<Record<string, unknown>>,
  ) => import('@rntme/deploy-dokploy').DokployClient;
};

export type ApplyStageOutput = {
  readonly applied: DeploymentApplyResult;
  readonly durationMs: number;
};

export type VerifyStageInput = {
  readonly applied: DeploymentApplyResult;
};

export type VerifyStageOutput = {
  readonly report: VerificationReport;
  readonly stackReport: VerificationReport | null;
};
