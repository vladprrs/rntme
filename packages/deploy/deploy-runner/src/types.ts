import type {
  ComposedProjectInput,
  ProvisionerContract,
  ProvisionerOutput,
  buildProjectDeploymentPlan,
  runProvisioners,
} from '@rntme/deploy-core';
import type { applyDokployPlan, DokployClient, renderDokployPlan } from '@rntme/deploy-dokploy';
import type { DeployTargetForBuild } from './deploy-target-types.js';
import type { ParseTargetSecretFn } from './dokploy-client-factory.js';
import type { SmokeVerifier } from './smoke-verifier.js';

export type SanitizedLogLine = {
  readonly level: 'info' | 'warn' | 'error';
  readonly step: string;
  readonly message: string;
};

export type StageName = 'compose' | 'plan' | 'provision' | 'render' | 'apply' | 'verify';

export type StageEvidence = {
  readonly stage: StageName;
  readonly durationMs: number;
};

/**
 * Structural mirror of platform-core's `DeployTarget` covering all fields the
 * orchestrator needs (modules, storage, workflows, auth, manualAccess, …).
 *
 * `NormalizedDeployTarget` is an alias for `DeployTargetForBuild` so callers
 * can pass any platform-core `DeployTarget` value directly — TypeScript's
 * structural subtyping makes any conforming value assignable here.
 */
export type NormalizedDeployTarget = DeployTargetForBuild;

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
  /**
   * Called when a stage completes successfully. NOT called when a stage fails;
   * stage failures are observable through onTerminal.
   */
  readonly onStageComplete?: (stage: StageName, evidence: StageEvidence) => void | Promise<void>;
  readonly onProvisionResult?: (payload: ProvisionResultEnvelope) => void | Promise<void>;
  readonly onApplyResult?: (payload: ApplyResultEnvelope) => void | Promise<void>;
  readonly onVerifyResult?: (payload: VerifyResultEnvelope) => void | Promise<void>;
  readonly onTerminal?: (result: TerminalResult) => void | Promise<void>;
};

/**
 * Structural mirror of platform-core's PlatformErrorNode (no platform-core dep).
 */
export type RunnerErrorNode = {
  readonly code: string;
  readonly message: string;
  readonly path?: string;
  readonly cause?: readonly RunnerErrorNode[];
};

/**
 * Structural mirror of platform-core's PlatformError (no platform-core dep).
 * Callers can cast/coerce this to platform-core's PlatformError as needed.
 */
export type RunnerError = {
  readonly code: string;
  readonly message: string;
  readonly stage?: 'plan' | 'render' | 'apply' | 'verify' | 'provision';
  readonly errors: readonly RunnerErrorNode[];
};

export type TerminalResult =
  | { readonly ok: true; readonly kind: 'succeeded' }
  | {
      readonly ok: false;
      readonly kind: 'failed';
      readonly errorCode: string;
      readonly errorMessage: string;
      readonly errorTree?: RunnerError;
    };

export type RunDeploymentInputs = {
  /**
   * Already converted to `ComposedProjectInput`. The conversion from
   * `ComposedBlueprint` (including runtime artifact + workflow gRPC bundling)
   * lives outside the runner because it depends on `@rntme/bindings-grpc`,
   * which is forbidden inside `packages/deploy/**` by the layering policy.
   *
   * Optional: when omitted the runner invokes the `compose` stage on
   * `bundleDir` to load the blueprint. Existing callers (platform-http
   * executor, CLI direct-mode) pre-convert via `toDeployCoreInput` and pass
   * the result here, bypassing the on-disk load.
   */
  readonly composedBlueprint?: ComposedProjectInput;
  /** Already-materialized bundle directory on disk. */
  readonly bundleDir: string;
  /** Full structural target (including modules / storage / workflows / auth / …). */
  readonly target: NormalizedDeployTarget;
  /** Pre-decrypted target secrets. The runner never decrypts. */
  readonly resolvedTargetSecrets: ResolvedTargetSecrets;
  readonly orgSlug: string;
  readonly configOverrides: Record<string, unknown>;
  readonly priorProvisionOutputs: Readonly<Record<string, ProvisionerOutput>>;
  readonly resolveProvisioner: ResolveProvisioner;
  readonly publicDeployDomain?: string;
  readonly hooks?: DeploymentHooks;
  /**
   * Reserved for future use. Not yet propagated to stage operations
   * (provisioner contracts, dokploy apply polling, smoke verify HTTP).
   * Callers can pass a signal but cancellation is not guaranteed.
   */
  readonly abortSignal?: AbortSignal;
  /**
   * Build a Dokploy client from the (already decrypted) API token. The factory
   * is provided by the caller so that secret-cipher concerns stay outside the
   * runner. Resolved target secrets are forwarded for callers that need them
   * (e.g., redpanda console htpasswd resolution).
   */
  readonly dokployClientFactory: (
    apiToken: string,
    resolvedTargetSecrets?: Readonly<Record<string, unknown>>,
  ) => DokployClient;
  /**
   * Optional schema-aware target secret parser. When provided, the runner
   * validates each `requiredTargetSecrets` entry against its schema. When
   * omitted, the runner only checks for presence + schema-id match.
   */
  readonly parseTargetSecret?: ParseTargetSecretFn;
  /** Override hooks for tests. Production callers leave these unset. */
  readonly runProvisioners?: typeof runProvisioners;
  readonly planProject?: typeof buildProjectDeploymentPlan;
  readonly renderPlan?: typeof renderDokployPlan;
  readonly applyPlan?: typeof applyDokployPlan;
  readonly smoker?: SmokeVerifier;
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
