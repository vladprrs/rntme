import { buildProjectDeploymentPlan } from '@rntme/deploy-core';
import { buildProjectDeploymentConfig } from '../build-deploy-config.js';
import { StageError } from './compose.js';
import type { PlanStageInput, PlanStageOutput } from './types.js';

export async function plan(
  input: PlanStageInput,
  override?: typeof buildProjectDeploymentPlan,
): Promise<PlanStageOutput> {
  const config = buildProjectDeploymentConfig(input.ctx.target, input.ctx.orgSlug, input.ctx.configOverrides, {
    projectSlug: input.composed.name,
    ...(input.ctx.publicDeployDomain === undefined ? {} : { publicDeployDomain: input.ctx.publicDeployDomain }),
  });

  const planner = override ?? buildProjectDeploymentPlan;
  const result = await planner(input.composed, config, {
    ...(input.provision.provisionResultForPlan ? { provisionResult: input.provision.provisionResultForPlan } : {}),
    ...(input.provision.discoveredModulesForPlan ? { discoveredModules: input.provision.discoveredModulesForPlan } : {}),
  });
  if (!result.ok) {
    throw new StageError(
      result.errors[0]?.code ?? 'DEPLOY_PLAN_UNKNOWN',
      result.errors.map((e) => `${e.code}: ${e.message}`).join('; '),
      result.errors,
    );
  }
  return { plan: result.value };
}
