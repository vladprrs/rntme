import { discoverModules } from '@rntme/blueprint';
import {
  applyVars,
  resolveTargetVarsOnly,
  runProvisioners,
  targetForVars,
  type DiscoveredProvisionerModule,
  type ProvisionedModule,
} from '@rntme/deploy-core';
import { buildProjectDeploymentConfig } from '../build-deploy-config.js';
import { materializeProjectFolderAssets } from '../project-assets.js';
import type { ResolveProvisioner } from '../types.js';
import { StageError } from './compose.js';
import type { ProvisionStageInput, ProvisionStageOutput } from './types.js';

export async function provision(
  input: ProvisionStageInput,
  overrides?: {
    readonly runProvisioners?: typeof runProvisioners;
    readonly resolveProvisioner?: ResolveProvisioner;
  },
): Promise<ProvisionStageOutput> {
  const discovered = await discoverModules({ projectDir: input.bundleDir });
  const provModules: DiscoveredProvisionerModule[] = [];
  if (discovered.ok) {
    for (const [, info] of Object.entries(discovered.value)) {
      if (!info.manifest.provisioner) continue;
      provModules.push({
        projectKey: info.projectKey,
        packageName: info.manifest.name,
        manifest: info.manifest,
        publicConfig: info.publicConfig,
      });
    }
  }

  if (provModules.length === 0) {
    const now = new Date().toISOString();
    return {
      provisioned: new Map(),
      publicByModule: {},
      secretByModule: {},
      startedAt: now,
      finishedAt: now,
    };
  }

  const config = buildProjectDeploymentConfig(input.ctx.target, input.ctx.orgSlug, input.ctx.configOverrides, {
    projectSlug: input.composed.name,
    ...(input.ctx.publicDeployDomain === undefined ? {} : { publicDeployDomain: input.ctx.publicDeployDomain }),
  });

  const targetVarsResult = resolveTargetVarsOnly(
    input.composed.varsManifest ?? {},
    targetForVars(config, input.ctx.target.slug),
  );
  if (!targetVarsResult.ok) {
    throw new StageError(
      targetVarsResult.errors[0]?.code ?? 'DEPLOY_PLAN_UNKNOWN',
      targetVarsResult.errors.map((e) => `${e.code}: ${e.message}`).join('; '),
      targetVarsResult.errors,
    );
  }
  const targetVars = targetVarsResult.value;
  const provModulesWithSubstitutedConfig = provModules.map((m) => ({
    ...m,
    publicConfig: applyVars(m.publicConfig, targetVars) as Record<string, unknown>,
  }));

  // Convert `project-folder` source declarations into the
  // `materialized-project-asset` handshake shape before any vendor
  // provisioner runs. This keeps the canonical contract source union closed
  // and ensures provisioners receive a local tar.gz path with a verified
  // sha256 rather than a bundle-side reference they would otherwise have to
  // decode themselves.
  const materialized = materializeProjectFolderAssets({
    modules: provModulesWithSubstitutedConfig,
    bundleDir: input.bundleDir,
  });
  if (materialized.errors.length > 0) {
    const first = materialized.errors[0];
    throw new StageError(
      first?.code ?? 'DEPLOY_PROVISION_PROJECT_FOLDER_ASSET_INVALID',
      materialized.errors.map((e) => `${e.code}: ${e.message}`).join('; '),
      materialized.errors,
    );
  }
  const provModulesReadyForProvisioner = materialized.modules;

  const startedAt = new Date().toISOString();
  const provisionRunner = overrides?.runProvisioners ?? runProvisioners;
  const resolveProvisioner =
    overrides?.resolveProvisioner ??
    ((): never => {
      throw new StageError('DEPLOY_PROVISION_NO_RESOLVER', 'resolveProvisioner missing');
    });

  const provisionResult = await provisionRunner({
    modules: provModulesReadyForProvisioner.map((m) => {
      const prior = input.priorProvisionOutputs[m.projectKey];
      return prior === undefined ? m : { ...m, priorOutputs: prior };
    }),
    resolvedTargetSecrets: input.ctx.resolvedTargetSecrets.extras,
    projectDir: input.bundleDir,
    resolveProvisioner,
    log: () => undefined,
  });
  if (!provisionResult.ok) {
    throw new StageError(
      provisionResult.errors[0]?.code ?? 'DEPLOY_PROVISION_UNKNOWN',
      provisionResult.errors.map((e) => `${e.code}: ${e.message}`).join('; '),
      provisionResult.errors,
    );
  }

  const moduleMap = new Map<string, ProvisionedModule>();
  const publicByModule: Record<string, Record<string, unknown>> = {};
  const secretByModule: Record<string, Record<string, unknown>> = {};
  const publicOutputsForPlan: Record<string, { publicOutputs: Record<string, unknown> }> = {};
  for (const m of provisionResult.value.modules) {
    moduleMap.set(m.projectKey, m);
    publicOutputsForPlan[m.projectKey] = { publicOutputs: { ...m.publicOutputs } };
    publicByModule[m.projectKey] = { ...m.publicOutputs };
    if (Object.keys(m.secretOutputs).length > 0) {
      secretByModule[m.projectKey] = { ...m.secretOutputs };
    }
  }

  const dm: Record<string, { producesNames: readonly string[] }> = {};
  for (const m of provModules) {
    dm[m.projectKey] = { producesNames: m.manifest.provisioner?.produces.map((p) => p.name) ?? [] };
  }

  return {
    provisioned: moduleMap,
    publicByModule,
    secretByModule,
    provisionResultForPlan: { modules: publicOutputsForPlan },
    discoveredModulesForPlan: dm,
    startedAt,
    finishedAt: new Date().toISOString(),
  };
}
