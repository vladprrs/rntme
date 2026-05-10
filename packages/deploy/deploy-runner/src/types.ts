import type { ComposedBlueprint } from '@rntme/blueprint';
import type {
  ComposedProjectInput,
  ProvisionerContract,
  ProvisionerOutput,
} from '@rntme/deploy-core';

export type SanitizedLogLine = {
  readonly level: 'info' | 'warn' | 'error';
  readonly step: string;
  readonly message: string;
};

export type StageName = 'plan' | 'provision' | 'render' | 'apply' | 'verify';

export type StageEvidence = {
  readonly stage: StageName;
  readonly durationMs: number;
};

export type NormalizedDeployTarget = {
  readonly id: string;
  readonly slug: string;
  readonly kind: 'dokploy';
  readonly displayName: string;
  readonly publicBaseUrl?: string;
  readonly dokployUrl: string;
  readonly dokployProjectId: string;
  readonly eventBus?: {
    readonly mode: 'provisioned' | 'in-memory' | 'external';
    readonly externalBootstrap?: string;
  };
  readonly workflowEngineImage?: string;
  readonly workflowWorkerImage?: string;
};

export type ResolvedTargetSecrets = {
  readonly apiToken: string;
  readonly extras: Readonly<Record<string, unknown>>;
};

export type ResolveProvisioner = (
  packageName: string,
  entry: string,
  projectDir: string,
) => Promise<ProvisionerContract>;

export type ProvisionResultEnvelope = {
  readonly publicByModule: Record<string, Record<string, unknown>>;
  readonly secretByModule: Record<string, Record<string, unknown>>;
  readonly startedAt: string;
  readonly finishedAt: string;
};

export type ApplyResultEnvelope = {
  readonly actions: unknown;
  readonly durationMs: number;
};

export type VerifyResultEnvelope = {
  readonly report: unknown;
};

export type DeploymentHooks = {
  readonly onLog?: (line: SanitizedLogLine) => void | Promise<void>;
  readonly onStageBegin?: (stage: StageName) => void | Promise<void>;
  readonly onStageComplete?: (stage: StageName, evidence: StageEvidence) => void | Promise<void>;
  readonly onProvisionResult?: (payload: ProvisionResultEnvelope) => void | Promise<void>;
  readonly onApplyResult?: (payload: ApplyResultEnvelope) => void | Promise<void>;
  readonly onVerifyResult?: (payload: VerifyResultEnvelope) => void | Promise<void>;
  readonly onTerminal?: (result: TerminalResult) => void | Promise<void>;
};

export type TerminalResult =
  | { readonly ok: true; readonly kind: 'succeeded' }
  | {
      readonly ok: false;
      readonly kind: 'failed';
      readonly errorCode: string;
      readonly errorMessage: string;
      readonly errorTree?: unknown;
    };

export type RunDeploymentInputs = {
  readonly composedBlueprint: ComposedProjectInput | ComposedBlueprint;
  readonly bundleDir: string;
  readonly target: NormalizedDeployTarget;
  readonly resolvedTargetSecrets: ResolvedTargetSecrets;
  readonly orgSlug: string;
  readonly configOverrides: Record<string, unknown>;
  readonly priorProvisionOutputs: Readonly<Record<string, ProvisionerOutput>>;
  readonly resolveProvisioner: ResolveProvisioner;
  readonly publicDeployDomain?: string;
  readonly hooks?: DeploymentHooks;
  readonly abortSignal?: AbortSignal;
};

// Structural mirror of platform-core's VerificationReport schema (deployment.ts lines 15-45).
// Values from platform-core's z.infer<typeof verificationReportSchema> are structurally
// compatible with these types — no conversion needed.

export type WorkloadStatus =
  | 'running'
  | 'healthy'
  | 'starting'
  | 'failed'
  | 'rejected'
  | 'exited'
  | 'unknown';

export type VerificationCheck = {
  readonly name: string;
  readonly url: string;
  readonly status: number | 'timeout' | 'error' | WorkloadStatus;
  readonly latencyMs: number;
  readonly ok: boolean;
  readonly note?: string;
};

export type VerificationReport = {
  readonly checks: VerificationCheck[];
  readonly ok: boolean;
  readonly partialOk: boolean;
};
