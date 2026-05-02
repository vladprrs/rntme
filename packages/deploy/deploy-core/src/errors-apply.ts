export const DEPLOY_APPLY_ERROR_CODES = {
  DEPLOY_APPLY_DOKPLOY_TASK_REJECTED: 'DEPLOY_APPLY_DOKPLOY_TASK_REJECTED',
  DEPLOY_APPLY_MOUNT_PATH_MISSING: 'DEPLOY_APPLY_MOUNT_PATH_MISSING',
  DEPLOY_APPLY_DOKPLOY_API_ERROR: 'DEPLOY_APPLY_DOKPLOY_API_ERROR',
  DEPLOY_APPLY_TIMEOUT: 'DEPLOY_APPLY_TIMEOUT',
} as const;

export type DeploymentApplyErrorCode = keyof typeof DEPLOY_APPLY_ERROR_CODES;
export type DeploymentApplyError = Readonly<{
  code: DeploymentApplyErrorCode;
  message: string;
  resource?: string;
  taskId?: string;
}>;
