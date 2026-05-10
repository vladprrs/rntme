import { loadComposedBlueprint } from '@rntme/blueprint';
import { toDeployCoreInput } from '@rntme/deploy-bundle-input';
import type { ComposeStageInput, ComposeStageOutput } from './types.js';

export class StageError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public override readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'StageError';
  }
}

export async function compose(input: ComposeStageInput): Promise<ComposeStageOutput> {
  const result = await loadComposedBlueprint(input.bundleDir);
  if (!result.ok) {
    const first = result.errors[0];
    throw new StageError(
      'DEPLOY_COMPOSE_FAILED',
      first?.message ?? 'failed to load blueprint',
      result.errors,
    );
  }
  const composed = await toDeployCoreInput(result.value, input.bundleDir);
  return { composed, bundleDir: input.bundleDir };
}
