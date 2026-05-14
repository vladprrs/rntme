import type {
  ApiTokenProvider,
  CreateDeployTargetRequest,
  Deployment,
  DeploymentLogLine,
  DeployTarget,
  DeployTargetRepo,
  DeploymentRepo,
  Ids,
  OrganizationRepo,
  PlatformError,
  ProjectOperation,
  ProjectOperationRepo,
  ProjectRepo,
  ProjectVersionRepo,
  SecretCipher,
  UpdateDeployTargetRequest,
} from '@rntme/platform-core';

// --- start-deployment ---

export type StartDeploymentHandlerInput = {
  readonly authorization: string;
  readonly sessionSubject?: string | null;
  readonly sessionStatus?: string | null;
  /** Org id, slug, or workos org id; resolves to the authenticated org. */
  readonly organizationId: string;
  /** Project id or slug under the authenticated org. */
  readonly projectId: string;
  /** Existing project version sequence (must already be published). */
  readonly projectVersionSeq: number;
  /** Deploy-target slug under the authenticated org. */
  readonly targetSlug: string;
  /** Optional deploy config overrides (matches StartDeploymentConfigOverridesSchema). */
  readonly configOverrides?: Record<string, unknown>;
};

export type StartDeploymentHandlerDeps = {
  readonly provider: ApiTokenProvider;
  readonly repos: {
    readonly organizations: OrganizationRepo;
    readonly projects: ProjectRepo;
    readonly projectVersions: ProjectVersionRepo;
    readonly deployTargets: DeployTargetRepo;
    readonly deployments: DeploymentRepo;
    readonly projectOperations: ProjectOperationRepo;
  };
  readonly ids: Ids;
};

export type StartDeploymentHandlerOutput =
  | {
      readonly status: 'started';
      readonly operation: ProjectOperation;
      readonly deployment: Deployment;
    }
  | { readonly status: 'error'; readonly errors: readonly PlatformError[] };

// --- deployment reads ---

export type ListDeploymentsInput = {
  readonly authorization: string;
  readonly sessionSubject?: string | null;
  readonly sessionStatus?: string | null;
  readonly organizationId: string;
  readonly projectId: string;
  readonly limit?: number;
};

export type ListDeploymentsOutput =
  | { readonly status: 'ok'; readonly deployments: readonly Deployment[] }
  | { readonly status: 'error'; readonly errors: readonly PlatformError[] };

export type GetDeploymentInput = {
  readonly authorization: string;
  readonly sessionSubject?: string | null;
  readonly sessionStatus?: string | null;
  readonly id: string;
};

export type GetDeploymentOutput =
  | { readonly status: 'ok'; readonly deployment: Deployment }
  | { readonly status: 'not_found'; readonly id: string }
  | { readonly status: 'error'; readonly errors: readonly PlatformError[] };

export type ReadDeploymentLogsInput = {
  readonly authorization: string;
  readonly sessionSubject?: string | null;
  readonly sessionStatus?: string | null;
  readonly deploymentId: string;
  readonly sinceLineId?: number;
  readonly limit?: number;
};

export type ReadDeploymentLogsOutput =
  | { readonly status: 'ok'; readonly lines: readonly DeploymentLogLine[]; readonly lastLineId: number }
  | { readonly status: 'error'; readonly errors: readonly PlatformError[] };

// --- deploy-target CRUD ---

export type DeployTargetCrudDeps = {
  readonly provider: ApiTokenProvider;
  readonly repos: {
    readonly organizations: OrganizationRepo;
    readonly deployTargets: DeployTargetRepo;
  };
  readonly cipher: SecretCipher;
  readonly ids: Ids;
};

export type ListDeployTargetsInput = {
  readonly authorization: string;
  readonly sessionSubject?: string | null;
  readonly sessionStatus?: string | null;
  readonly organizationId: string;
};

export type ListDeployTargetsOutput =
  | { readonly status: 'ok'; readonly targets: readonly DeployTarget[] }
  | { readonly status: 'error'; readonly errors: readonly PlatformError[] };

export type GetDeployTargetInput = {
  readonly authorization: string;
  readonly slug: string;
};

export type GetDeployTargetOutput =
  | { readonly status: 'ok'; readonly target: DeployTarget }
  | { readonly status: 'not_found'; readonly slug: string }
  | { readonly status: 'error'; readonly errors: readonly PlatformError[] };

export type CreateDeployTargetInput = {
  readonly authorization: string;
  readonly sessionSubject?: string | null;
  readonly sessionStatus?: string | null;
  /** Org id, slug, or workos org id (must match the authenticated org). */
  readonly organizationId: string;
  readonly body: CreateDeployTargetRequest;
};

export type CreateDeployTargetOutput =
  | { readonly status: 'created'; readonly target: DeployTarget }
  | { readonly status: 'error'; readonly errors: readonly PlatformError[] };

export type UpdateDeployTargetInput = {
  readonly authorization: string;
  readonly sessionSubject?: string | null;
  readonly sessionStatus?: string | null;
  readonly organizationId?: string | null;
  readonly slug: string;
  readonly body: UpdateDeployTargetRequest;
};

export type UpdateDeployTargetOutput =
  | { readonly status: 'updated'; readonly target: DeployTarget }
  | { readonly status: 'error'; readonly errors: readonly PlatformError[] };

export type DeleteDeployTargetInput = {
  readonly authorization: string;
  readonly slug: string;
};

export type DeleteDeployTargetOutput =
  | { readonly status: 'deleted'; readonly slug: string }
  | { readonly status: 'error'; readonly errors: readonly PlatformError[] };
