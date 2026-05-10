import { redact } from '../redactor.js';
import type { DeployStage, DeployStageStateRepo } from '@rntme/platform-storage';
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

export async function failStage(
  repo: DeployStageStateRepo,
  deploymentId: string,
  stage: DeployStage,
  cause: unknown,
  fallbackCode: string,
): Promise<StageHandlerResult> {
  const code = errorCode(cause, fallbackCode);
  const message = redact(errorMessage(cause));
  await repo.fail({ deploymentId, stage, errorCode: code, errorMessage: message });
  return { stage, status: 'failed', errorCode: code, errorMessage: message };
}
