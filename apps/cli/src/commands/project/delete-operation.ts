import { endpoints } from '../../api/endpoints.js';
import type { ProjectDeleteOperationResponse } from '../../api/types.js';
import { cliError } from '../../errors/codes.js';
import { err, isOk } from '../../result.js';
import { runCommand, type CommonFlags } from '../harness.js';
import { operationExitCode, watchProjectOperationUntilTerminal } from './operation-watch.js';

export type ProjectDeleteOperationArgs = {
  readonly confirm: string;
  readonly wait?: boolean | undefined;
  readonly timeoutSec?: number | undefined;
};

export async function runProjectDeleteOperation(args: ProjectDeleteOperationArgs, flags: CommonFlags): Promise<number> {
  return runCommand<ProjectDeleteOperationResponse>(
    flags,
    {
      requireToken: true,
      humanRender: (d) =>
        [
          'project delete queued',
          `  operation: ${d.operation.id}`,
          `  status:    ${d.operation.status}`,
        ].join('\n'),
      successExitCode: (d) => operationExitCode(d.operation.status),
    },
    async (ctx) => {
      const org = flags.org ?? ctx.resolved.org;
      const project = flags.project ?? ctx.resolved.project;
      if (!org) return err(cliError('CLI_CONFIG_MISSING', 'no org; use --org'));
      if (!project) return err(cliError('CLI_CONFIG_MISSING', 'no project; use --project'));

      const queued = await endpoints.projectOperations.delete(
        { baseUrl: ctx.resolved.baseUrl, token: ctx.resolved.token },
        org,
        project,
        { confirm: args.confirm },
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
      return isOk(watched) ? { ok: true, value: { operation: watched.value.operation } } : watched;
    },
  );
}
