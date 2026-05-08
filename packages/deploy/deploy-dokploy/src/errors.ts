export const DEPLOY_DOKPLOY_ERROR_CODES = {
  DEPLOY_RENDER_DOKPLOY_MISSING_PROJECT: 'DEPLOY_RENDER_DOKPLOY_MISSING_PROJECT',
  DEPLOY_APPLY_DOKPLOY_API_ERROR: 'DEPLOY_APPLY_DOKPLOY_API_ERROR',
  DEPLOY_APPLY_DOKPLOY_PARTIAL_FAILURE: 'DEPLOY_APPLY_DOKPLOY_PARTIAL_FAILURE',
  DEPLOY_RENDER_DOKPLOY_INVALID_NGINX_CONFIG: 'DEPLOY_RENDER_DOKPLOY_INVALID_NGINX_CONFIG',
  DEPLOY_RENDER_DOKPLOY_NAME_COLLISION: 'DEPLOY_RENDER_DOKPLOY_NAME_COLLISION',
  DEPLOY_RENDER_DOKPLOY_MISSING_RUNTIME_FILES: 'DEPLOY_RENDER_DOKPLOY_MISSING_RUNTIME_FILES',
  DEPLOY_RENDER_DOKPLOY_INVALID_WORKFLOW_FILE_PATH:
    'DEPLOY_RENDER_DOKPLOY_INVALID_WORKFLOW_FILE_PATH',
  DEPLOY_RENDER_DOKPLOY_BPMN_WORKER_REQUIRES_OPERATON:
    'DEPLOY_RENDER_DOKPLOY_BPMN_WORKER_REQUIRES_OPERATON',
  DEPLOY_RENDER_DOKPLOY_WORKFLOW_MANIFEST_FILE_MISSING:
    'DEPLOY_RENDER_DOKPLOY_WORKFLOW_MANIFEST_FILE_MISSING',
  DEPLOY_RENDER_DOKPLOY_WORKFLOW_SERVICE_ENDPOINT_UNAVAILABLE:
    'DEPLOY_RENDER_DOKPLOY_WORKFLOW_SERVICE_ENDPOINT_UNAVAILABLE',
} as const;

export type DokployDeploymentErrorCode = keyof typeof DEPLOY_DOKPLOY_ERROR_CODES;

export type DokployPartialFailureResource = {
  readonly logicalId: string;
  readonly resourceKind: 'application' | 'compose';
  readonly workloadSlug?: string | undefined;
  readonly kind?:
    | 'domain-service'
    | 'integration-module'
    | 'edge-gateway'
    | 'bpmn-worker'
    | 'operaton-ui-gateway';
  readonly infrastructureKind?: 'event-bus' | 'workflow-engine';
  readonly targetResourceId: string;
  readonly targetResourceName: string;
  readonly action: 'created' | 'updated' | 'unchanged';
};

export type DokployPartialFailureStep = {
  readonly action: 'find' | 'create' | 'update' | 'configure' | 'deploy' | 'start' | 'inspect';
  readonly resourceName: string;
  readonly resourceKind: 'application' | 'compose';
  readonly workloadSlug?: string;
  readonly infrastructureKind?: 'event-bus' | 'workflow-engine';
};

export type DokployPartialFailureCleanup = {
  readonly attempted: true;
  readonly deletedResources: readonly DokployPartialFailureResource[];
  readonly warnings: readonly string[];
  readonly errors: readonly {
    readonly code: DokployDeploymentErrorCode;
    readonly message: string;
    readonly resource?: string;
    readonly cause?: unknown;
  }[];
};

export type DokployPartialFailure = {
  readonly createdResources: readonly DokployPartialFailureResource[];
  readonly updatedResources: readonly DokployPartialFailureResource[];
  readonly failedStep: DokployPartialFailureStep;
  readonly cleanup: DokployPartialFailureCleanup;
  readonly retrySafe: boolean;
};

export type DokployDeploymentError = {
  readonly code: DokployDeploymentErrorCode;
  readonly message: string;
  readonly resource?: string;
  readonly path?: string;
  readonly service?: string;
  readonly cause?: unknown;
  readonly partialFailure?: DokployPartialFailure;
};
