export const DEPLOY_RENDER_ERROR_CODES = {
  DEPLOY_RENDER_NGINX_INVALID: 'DEPLOY_RENDER_NGINX_INVALID',
  DEPLOY_RENDER_COMPOSE_INVALID: 'DEPLOY_RENDER_COMPOSE_INVALID',
  DEPLOY_RENDER_UI_BUNDLE_MISSING: 'DEPLOY_RENDER_UI_BUNDLE_MISSING',
} as const;

export type DeploymentRenderErrorCode = keyof typeof DEPLOY_RENDER_ERROR_CODES;
export type DeploymentRenderError = Readonly<{
  code: DeploymentRenderErrorCode;
  message: string;
  resource?: string;
}>;
