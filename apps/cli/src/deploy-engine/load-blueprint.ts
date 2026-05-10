import { loadComposedBlueprint } from '@rntme/blueprint';
import type { ComposedProjectInput } from '@rntme/deploy-core';
import type { Result } from '../result.js';
import { ok, err } from '../result.js';
import { cliError, type CliError } from '../errors/codes.js';
import { toDeployCoreInput } from '@rntme/deploy-bundle-input';

export type LoadedBlueprint = {
  readonly composedBlueprint: ComposedProjectInput;
  readonly bundleDir: string;
};

export async function loadBlueprintForDeploy(dir: string): Promise<Result<LoadedBlueprint, CliError>> {
  const composed = await loadComposedBlueprint(dir);
  if (!composed.ok) {
    const first = composed.errors[0];
    return err(
      cliError(
        'CLI_DEPLOY_BLUEPRINT_INVALID',
        `failed to compose blueprint at ${dir}: ${first?.code ?? 'UNKNOWN'}: ${first?.message ?? ''}`,
        undefined,
        composed.errors,
      ),
    );
  }
  const projectInput = await toDeployCoreInput(composed.value, dir);
  return ok({ composedBlueprint: projectInput, bundleDir: dir });
}
