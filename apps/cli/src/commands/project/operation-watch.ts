import { endpoints } from '../../api/endpoints.js';
import type { ProjectOperationResponse, ProjectOperationStatus } from '../../api/types.js';
import { cliError } from '../../errors/codes.js';
import { err, isOk, type Result } from '../../result.js';
import type { ClientError } from '../../api/client.js';
import { runCommand, type CommonFlags } from '../harness.js';
import { validateUuid } from '../../util/uuid.js';

const TERMINAL = new Set<ProjectOperationStatus>(['succeeded', 'failed']);

export type ProjectOperationWatchArgs = {
  readonly operationId: string;
  readonly pollIntervalMs?: number | undefined;
  readonly timeoutSec?: number | undefined;
};

export async function watchProjectOperationUntilTerminal(opts: {
  apiCtx: { baseUrl: string; token: string | null };
  org: string;
  project: string;
  operationId: string;
  pollIntervalMs?: number | undefined;
  timeoutMs?: number | undefined;
  printLogs?: boolean | undefined;
}): Promise<Result<ProjectOperationResponse, ClientError | ReturnType<typeof cliError>>> {
  const { apiCtx, org, project, operationId, pollIntervalMs = 2_000, timeoutMs, printLogs = true } = opts;
  let sinceLineId = 0;
  const started = Date.now();

  while (true) {
    if (timeoutMs !== undefined && Date.now() - started > timeoutMs) {
      return err(cliError('CLI_NETWORK_TIMEOUT', `project operation watch timed out after ${timeoutMs}ms`));
    }

    const status = await endpoints.projectOperations.show(apiCtx, org, project, operationId);
    if (!isOk(status)) return status;

    const logs = await endpoints.projectOperations.logs(apiCtx, org, project, operationId, {
      sinceLineId,
      limit: 200,
    });
    if (!isOk(logs)) return logs;

    if (printLogs) {
      for (const line of logs.value.lines) {
        process.stdout.write(`[${line.level}] ${line.step}: ${line.message}\n`);
      }
    }
    sinceLineId = logs.value.lastLineId;

    if (TERMINAL.has(status.value.operation.status)) return status;
    await sleep(pollIntervalMs);
  }
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
