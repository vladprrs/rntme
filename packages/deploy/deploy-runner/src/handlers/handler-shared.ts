import { redact } from '../redactor.js';
import type { DeployStage } from '@rntme/platform-storage';
import type { HandlerContext } from './platform-context.js';
import type { StageHandlerResult } from './types.js';

export function errorCode(cause: unknown, fallback: string): string {
  if (
    cause instanceof Error &&
    'code' in cause &&
    typeof (cause as Error & { code: string }).code === 'string'
  ) {
    return (cause as Error & { code: string }).code;
  }
  return fallback;
}

export function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

/**
 * Records a stage failure inside a fresh withOrgTx so RLS sees `app.org_id`.
 * Returns the failure result. Each handler's catch block calls this.
 */
export async function failStage(
  ctx: HandlerContext,
  orgId: string,
  deploymentId: string,
  stage: DeployStage,
  cause: unknown,
  fallbackCode: string,
): Promise<StageHandlerResult> {
  const code = errorCode(cause, fallbackCode);
  const message = redact(errorMessage(cause));
  await ctx.withOrgTx(orgId, (repos) =>
    repos.stageState.fail({ deploymentId, stage, errorCode: code, errorMessage: message }),
  );
  return { stage, status: 'failed', errorCode: code, errorMessage: message };
}
