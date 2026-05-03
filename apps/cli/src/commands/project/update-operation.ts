import { endpoints } from '../../api/endpoints.js';
import type { ProjectUpdateOperationResponse } from '../../api/types.js';
import { cliError } from '../../errors/codes.js';
import { err, isOk } from '../../result.js';
import { runCommand, type CommonFlags } from '../harness.js';
import { operationExitCode, watchProjectOperationUntilTerminal } from './operation-watch.js';

export type ProjectUpdateOperationArgs = {
  readonly version: number;
  readonly target: string;
  readonly wait?: boolean | undefined;
  readonly timeoutSec?: number | undefined;
};

export async function runProjectUpdateOperation(args: ProjectUpdateOperationArgs, flags: CommonFlags): Promise<number> {
  return runCommand<ProjectUpdateOperationResponse>(
    flags,
    {
      requireToken: true,
      humanRender: (d) =>
        [
          'project update queued',
          `  operation:  ${d.operation.id}`,
          `  deployment: ${d.deployment.id}`,
          `  status:     ${d.operation.status}`,
        ].join('\n'),
      successExitCode: (d) => operationExitCode(d.operation.status),
    },
    async (ctx) => {
      const org = flags.org ?? ctx.resolved.org;
      const project = flags.project ?? ctx.resolved.project;
      if (!org) return err(cliError('CLI_CONFIG_MISSING', 'no org; use --org'));
      if (!project) return err(cliError('CLI_CONFIG_MISSING', 'no project; use --project'));

      const queued = await endpoints.projectOperations.update(
        { baseUrl: ctx.resolved.baseUrl, token: ctx.resolved.token },
        org,
        project,
        { projectVersionSeq: args.version, targetSlug: args.target },
      );
      if (!isOk(queued) || !args.wait) return queued;

      const watched = await watchProjectOperationUntilTerminal({
        apiCtx: { baseUrl: ctx.resolved.baseUrl, token: ctx.resolved.token },
        org,
        project,
        operationId: queued.value.operation.id,
        timeoutMs: (args.timeoutSec ?? 300) * 1000,
        printLogs: flags.json !== true && flags.quiet !== true,
      });
      return isOk(watched) ? { ok: true, value: { operation: watched.value.operation, deployment: queued.value.deployment } } : watched;
    },
  );
}
