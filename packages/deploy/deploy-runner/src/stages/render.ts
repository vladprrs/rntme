import { discoverModules } from '@rntme/blueprint';
import type { ProvisionerEnvMapping } from '@rntme/deploy-core';
import { renderDokployPlan } from '@rntme/deploy-dokploy';
import { buildDokployTargetConfig } from '../build-deploy-config.js';
import { StageError } from './compose.js';
import type { RenderStageInput, RenderStageOutput } from './types.js';

export async function render(
  input: RenderStageInput,
  override?: typeof renderDokployPlan,
): Promise<RenderStageOutput> {
  const envMappings: Record<string, ProvisionerEnvMapping[string]> = {};
  const discovered = await discoverModules({ projectDir: input.bundleDir });
  if (discovered.ok) {
    for (const [, info] of Object.entries(discovered.value)) {
      if (!info.manifest.provisioner) continue;
      try {
        const moduleExports = (await import(info.manifest.name)) as { ENV_MAPPINGS?: ProvisionerEnvMapping };
        if (moduleExports.ENV_MAPPINGS && typeof moduleExports.ENV_MAPPINGS === 'object') {
          for (const [k, v] of Object.entries(moduleExports.ENV_MAPPINGS)) {
            if (v !== undefined) envMappings[k] = v;
          }
        }
      } catch {
        // module opts out by not exporting ENV_MAPPINGS
      }
    }
  }

  const renderer = override ?? renderDokployPlan;
  const result = await renderer(
    input.plan,
    buildDokployTargetConfig(input.ctx.target, input.ctx.configOverrides, {
      orgSlug: input.ctx.orgSlug,
      projectSlug: input.plan.project.projectSlug,
      environment: input.plan.project.environment,
      ...(input.ctx.publicDeployDomain === undefined ? {} : { publicDeployDomain: input.ctx.publicDeployDomain }),
    }),
    input.provisioned,
    envMappings,
  );
  if (!result.ok) {
    throw new StageError(
      result.errors[0]?.code ?? 'DEPLOY_RENDER_DOKPLOY_UNKNOWN',
      result.errors.map((e) => `${e.code}: ${e.message}`).join('; '),
      result.errors,
    );
  }
  return { rendered: result.value };
}
