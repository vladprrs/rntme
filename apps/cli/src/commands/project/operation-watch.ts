import { endpoints } from '../../api/endpoints.js';
import type {
  ProjectOperationResponse,
  ProjectOperationLogsResponseSchema,
  ProjectOperationStatus,
} from '../../api/types.js';
import { cliError, type CliError } from '../../errors/codes.js';
import { err, type Result } from '../../result.js';
import type { ClientError } from '../../api/client.js';
import { runCommand, type CommonFlags } from '../harness.js';
import { validateUuid } from '../../util/uuid.js';
import { pollUntilTerminal } from '../poll-until-terminal.js';
import type { z } from 'zod';

type ProjectOperationLogsResponse = z.infer<typeof ProjectOperationLogsResponseSchema>;

const TERMINAL = new Set<ProjectOperationStatus>(['succeeded', 'failed']);

export type ProjectOperationWatchArgs = {
  readonly operationId: string;
  readonly pollIntervalMs?: number | undefined;
  readonly timeoutSec?: number | undefined;
};

export function watchProjectOperationUntilTerminal(opts: {
  apiCtx: { baseUrl: string; token: string | null };
  org: string;
  project: string;
  operationId: string;
  pollIntervalMs?: number | undefined;
  timeoutMs?: number | undefined;
  printLogs?: boolean | undefined;
}): Promise<Result<ProjectOperationResponse, ClientError | CliError>> {
  const { apiCtx, org, project, operationId, pollIntervalMs, timeoutMs, printLogs } = opts;
  return pollUntilTerminal<ProjectOperationResponse, ProjectOperationLogsResponse>({
    pollIntervalMs,
    timeoutMs,
    printLogs,
    label: 'project operation watch',
    fetchStatus: () => endpoints.projectOperations.show(apiCtx, org, project, operationId),
    fetchLogsSince: (sinceLineId) =>
      endpoints.projectOperations.logs(apiCtx, org, project, operationId, {
        sinceLineId,
        limit: 200,
      }),
    isTerminal: (s) => TERMINAL.has(s.operation.status),
    getLogLines: (l) => l.lines,
    getLastLineId: (l) => l.lastLineId,
  });
}

export async function runProjectOperationWatch(args: ProjectOperationWatchArgs, flags: CommonFlags): Promise<number> {
  return runCommand<ProjectOperationResponse>(
    flags,
    {
      requireToken: true,
      humanRender: (d) => renderOperation(d),
      successExitCode: (d) => operationExitCode(d.operation.status),
    },
    async (ctx) => {
      const id = validateUuid(args.operationId, 'operation-id');
      if (!id.ok) return id;
      const org = flags.org ?? ctx.resolved.org;
      const project = flags.project ?? ctx.resolved.project;
      if (!org) return err(cliError('CLI_CONFIG_MISSING', 'no org; use --org'));
      if (!project) return err(cliError('CLI_CONFIG_MISSING', 'no project; use --project'));
      return watchProjectOperationUntilTerminal({
        apiCtx: { baseUrl: ctx.resolved.baseUrl, token: ctx.resolved.token },
        org,
        project,
        operationId: id.value,
        pollIntervalMs: args.pollIntervalMs,
        timeoutMs: args.timeoutSec === undefined ? undefined : args.timeoutSec * 1000,
        printLogs: flags.json !== true && flags.quiet !== true,
      });
    },
  );
}

export function renderOperation(d: ProjectOperationResponse): string {
  const operation = d.operation;
  const lines = [
    `operation: ${operation.id}`,
    `kind:      ${operation.kind}`,
    `status:    ${operation.status}`,
    `queued:    ${operation.queuedAt}`,
  ];
  if (operation.deploymentId) lines.push(`deployment:${operation.deploymentId}`);
  if (operation.errorCode) lines.push(`error:     ${operation.errorCode}`);
  if (operation.errorMessage) lines.push(`message:   ${operation.errorMessage}`);
  return lines.join('\n');
}

export function operationExitCode(status: ProjectOperationStatus): number {
  return status === 'failed' ? 10 : 0;
}
