import { loadComposedBlueprint } from '@rntme/blueprint';
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
  // The platform-http path uses `toDeployCoreInput` (lifted into deploy-runner
  // in a follow-up task). For now we return the raw ComposedBlueprint and the
  // ComposeStageOutput type advertises ComposedProjectInput; downstream stages
  // see the structural shape but the conversion isn't yet wired in. The double
  // cast via `unknown` reflects that the runtime shape is intentionally a
  // ComposedBlueprint here.
  return {
    composed: result.value as unknown as ComposeStageOutput['composed'],
    bundleDir: input.bundleDir,
  };
}
