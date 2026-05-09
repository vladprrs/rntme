import { ok, type Result } from '../types/result.js';
import type { DeployAdapter, DeployAdapterInput, DeployAdapterResult } from './seam.js';

export function createFakeDeployAdapter(opts: {
  readonly result: DeployAdapterResult;
  readonly onRun?: (input: DeployAdapterInput) => void;
}): DeployAdapter {
  return {
    async run(input): Promise<Result<DeployAdapterResult>> {
      opts.onRun?.(input);
      return ok(opts.result);
    },
  };
}
