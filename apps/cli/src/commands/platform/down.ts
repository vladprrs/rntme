import { isOk } from '../../result.js';
import { exitCodeFor } from '../../errors/exit.js';
import { formatFailure, toFailureOutput } from '../../output/format.js';
import { runTearDownsForDeployment } from '@rntme/deploy-runner';
import { locatePlatformBlueprint } from '../../deploy-engine/locate-platform-blueprint.js';
import { loadTargetFile } from '../../deploy-engine/load-target.js';
import { resolveSecrets } from '../../deploy-engine/load-secrets.js';
import { loadBlueprintForDeploy } from '../../deploy-engine/load-blueprint.js';
import { createCliResolveProvisioner } from '../../deploy-engine/resolve-provisioner.js';
import { cliError } from '../../errors/codes.js';
import { basename } from 'node:path';
import type { OutputMode } from '../../output/format.js';

export type PlatformDownArgs = {
  readonly targetPath: string;
  readonly json?: boolean | undefined;
  readonly quiet?: boolean | undefined;
};

export async function runPlatformDown(args: PlatformDownArgs): Promise<number> {
  const mode: OutputMode = args.json ? 'json' : 'human';
  const slug = basename(args.targetPath, '.json');

  const target = await loadTargetFile(args.targetPath, slug);
  if (!isOk(target)) return emitFailure(mode, target.error);

  const secrets = resolveSecrets(target.value.secretRefs, process.env);
  if (!isOk(secrets)) return emitFailure(mode, secrets.error);

  const located = locatePlatformBlueprint();
  if (!isOk(located)) return emitFailure(mode, located.error);

  const blueprint = await loadBlueprintForDeploy(located.value);
  if (!isOk(blueprint)) return emitFailure(mode, blueprint.error);

  const teardown = await (async () => {
    try {
      return await runTearDownsForDeployment({
        bundleDir: blueprint.value.bundleDir,
        priorProvisionPublic: {},
        priorProvisionSecrets: {},
        deps: { resolveProvisioner: createCliResolveProvisioner() },
      });
    } finally {
      await blueprint.value.cleanup();
    }
  })();

  if (!teardown.ok) {
    const error = cliError(
      'CLI_DEPLOY_TEARDOWN_FAILED',
      `teardown failed: ${teardown.errors.map((e) => e.message).join('; ')}`,
    );
    return emitFailure(mode, error);
  }

  if (!args.quiet) process.stdout.write('✓ teardown complete\n');
  return 0;
}

function emitFailure(mode: OutputMode, error: { code: string; message: string }): number {
  process.stderr.write(formatFailure(mode, toFailureOutput(error as never)) + '\n');
  return exitCodeFor(error.code as never);
}
