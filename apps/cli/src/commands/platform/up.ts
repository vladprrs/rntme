import { isOk } from '../../result.js';
import { exitCodeFor } from '../../errors/exit.js';
import { formatFailure, toFailureOutput } from '../../output/format.js';
import { locatePlatformBlueprint } from '../../deploy-engine/locate-platform-blueprint.js';
import { runDirectDeploy, type DirectDeployArgs } from '../deploy.js';

export type PlatformUpArgs = Omit<DirectDeployArgs, 'blueprintDir'>;

export async function runPlatformUp(args: PlatformUpArgs): Promise<number> {
  const located = locatePlatformBlueprint();
  if (!isOk(located)) {
    process.stderr.write(formatFailure(args.json ? 'json' : 'human', toFailureOutput(located.error as never)) + '\n');
    return exitCodeFor(located.error.code);
  }
  return runDirectDeploy({ ...args, blueprintDir: located.value });
}
