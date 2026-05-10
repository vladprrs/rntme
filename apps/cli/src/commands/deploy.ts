import { basename } from 'node:path';
import { createWriteStream } from 'node:fs';
import { isOk } from '../result.js';
import { exitCodeFor } from '../errors/exit.js';
import { formatFailure, formatSuccess, toFailureOutput } from '../output/format.js';
import type { OutputMode } from '../output/format.js';
import { loadTargetFile } from '../deploy-engine/load-target.js';
import { resolveSecrets } from '../deploy-engine/load-secrets.js';
import { loadBlueprintForDeploy } from '../deploy-engine/load-blueprint.js';
import { buildPlainTokenDokployClient } from '../deploy-engine/dokploy-client.js';
import { createCliResolveProvisioner } from '../deploy-engine/resolve-provisioner.js';
import { runDirectDeployment } from '../deploy-engine/run.js';
import { renderHumanReport } from '../deploy-engine/report.js';

export type DirectDeployArgs = {
  readonly blueprintDir: string;
  readonly targetPath: string;
  readonly name?: string | undefined;
  readonly dryRun?: boolean | undefined;
  readonly json?: boolean | undefined;
  readonly quiet?: boolean | undefined;
  readonly logFile?: string | undefined;
};

export async function runDirectDeploy(args: DirectDeployArgs): Promise<number> {
  const mode: OutputMode = args.json ? 'json' : 'human';
  const slug = basename(args.targetPath, '.json');

  const target = await loadTargetFile(args.targetPath, slug);
  if (!isOk(target)) return emitFailure(mode, target.error);

  const secrets = resolveSecrets(target.value.secretRefs, process.env);
  if (!isOk(secrets)) return emitFailure(mode, secrets.error);

  const blueprint = await loadBlueprintForDeploy(args.blueprintDir);
  if (!isOk(blueprint)) return emitFailure(mode, blueprint.error);

  const logStream = args.logFile === undefined ? null : createWriteStream(args.logFile, { flags: 'a' });
  const result = await runDirectDeployment({
    composedBlueprint: blueprint.value.composedBlueprint,
    bundleDir: blueprint.value.bundleDir,
    target: target.value.target,
    resolvedTargetSecrets: secrets.value,
    orgSlug: 'direct',
    configOverrides: args.dryRun ? { dryRun: true } : {},
    priorProvisionOutputs: {},
    resolveProvisioner: createCliResolveProvisioner(),
    dokployClientFactory: (apiToken, extras) =>
      buildPlainTokenDokployClient(apiToken, target.value.target.dokployUrl, globalThis.fetch, extras),
    stdout: process.stdout,
    ...(logStream === null ? {} : { logFileWriter: (line: string) => { logStream.write(line); } }),
  });
  logStream?.end();

  if (!args.quiet) {
    const out = result.ok
      ? formatSuccess(mode, result.result, renderHumanReport)
      : formatFailure(mode, { code: 'CLI_DEPLOY_FAILED', message: renderHumanReport(result.result) });
    (result.ok ? process.stdout : process.stderr).write(out + '\n');
  }
  return result.ok ? 0 : 10;
}

function emitFailure(mode: OutputMode, error: { code: string; message: string }): number {
  process.stderr.write(formatFailure(mode, toFailureOutput(error as never)) + '\n');
  return exitCodeFor(error.code as never);
}
