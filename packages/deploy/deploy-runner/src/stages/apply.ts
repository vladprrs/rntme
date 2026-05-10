import { applyDokployPlan } from '@rntme/deploy-dokploy';
import { StageError } from './compose.js';
import type { ApplyStageInput, ApplyStageOutput } from './types.js';

export async function apply(
  input: ApplyStageInput,
  override?: typeof applyDokployPlan,
): Promise<ApplyStageOutput> {
  const dokployClient = input.dokployClientFactory(
    input.ctx.resolvedTargetSecrets.apiToken,
    Object.keys(input.resolvedRequiredSecrets).length > 0
      ? input.resolvedRequiredSecrets
      : input.ctx.resolvedTargetSecrets.extras,
  );
  const start = Date.now();
  const applier = override ?? applyDokployPlan;
  const result = await applier(input.rendered, dokployClient);
  if (!result.ok) {
    throw new StageError(
      result.errors[0]?.code ?? 'DEPLOY_APPLY_DOKPLOY_UNKNOWN',
      result.errors.map((e) => `${e.code}: ${e.message}`).join('; '),
      result.errors,
    );
  }
  return { applied: result.value, durationMs: Date.now() - start };
}
