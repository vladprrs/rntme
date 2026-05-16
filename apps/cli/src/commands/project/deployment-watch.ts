import { endpoints } from '../../api/endpoints.js';
import type {
  DeploymentResponseSchema,
  DeploymentLogsResponseSchema,
  DeploymentStatus,
} from '../../api/types.js';
import { runCommand, type CommonFlags } from '../harness.js';
import { validateUuid } from '../../util/uuid.js';
import { pollUntilTerminal } from '../poll-until-terminal.js';
import type { z } from 'zod';
import type { Result } from '../../result.js';
import type { CliError } from '../../errors/codes.js';
import type { ClientError } from '../../api/client.js';

type DeploymentResponse = z.infer<typeof DeploymentResponseSchema>;
type DeploymentLogsResponse = z.infer<typeof DeploymentLogsResponseSchema>;

export type ProjectDeploymentWatchArgs = {
  readonly deploymentId: string;
  readonly pollIntervalMs?: number | undefined;
};

const TERMINAL = new Set<DeploymentStatus>([
  'succeeded',
  'succeeded_with_warnings',
  'failed',
  'failed_orphaned',
]);

export function watchUntilTerminal(opts: {
  apiCtx: { baseUrl: string; token: string | null };
  deploymentId: string;
  pollIntervalMs?: number | undefined;
  timeoutMs?: number | undefined;
  printLogs?: boolean | undefined;
}): Promise<Result<DeploymentResponse, ClientError | CliError>> {
  const { apiCtx, deploymentId, pollIntervalMs, timeoutMs, printLogs } = opts;
  return pollUntilTerminal<DeploymentResponse, DeploymentLogsResponse>({
    pollIntervalMs,
    timeoutMs,
    printLogs,
    label: 'deployment watch',
    fetchStatus: () => endpoints.deployments.show(apiCtx, deploymentId),
    fetchLogsSince: (sinceLineId) =>
      endpoints.deployments.logs(apiCtx, deploymentId, { sinceLineId, limit: 200 }),
    isTerminal: (s) => TERMINAL.has(s.deployment.status),
    getLogLines: (l) => l.lines,
    getLastLineId: (l) => l.lastLineId,
  });
}

export async function runProjectDeploymentWatch(args: ProjectDeploymentWatchArgs, flags: CommonFlags): Promise<number> {
  return runCommand<DeploymentResponse>(
    flags,
    {
      requireToken: true,
      humanRender: (d) => {
        const dep = d.deployment;
        const lines: string[] = [`deployment ${dep.id} ${dep.status}`];
        if (dep.errorCode) lines.push(`  error:    ${dep.errorCode}`);
        if (dep.errorMessage) lines.push(`  message:  ${dep.errorMessage}`);
        if (dep.verificationReport) {
          const checks = dep.verificationReport.checks ?? [];
          const failed = checks.filter((c) => !c.ok);
          lines.push(`  verify:   ${dep.verificationReport.ok ? 'ok' : 'failed'}; ${checks.length} checks; ${failed.length} failed`);
          if (failed[0]) lines.push(`  first fail: ${failed[0].name} -> ${failed[0].status}`);
        }
        return lines.join('\n');
      },
      successExitCode: (d) => {
        if (d.deployment.status === 'succeeded') return 0;
        if (d.deployment.status === 'succeeded_with_warnings') return 1;
        return 10;
      },
    },
    async (ctx) => {
      const id = validateUuid(args.deploymentId, 'deployment-id');
      if (!id.ok) return id;

      return watchUntilTerminal({
        apiCtx: { baseUrl: ctx.resolved.baseUrl, token: ctx.resolved.token },
        deploymentId: id.value,
        pollIntervalMs: args.pollIntervalMs,
        printLogs: flags.json !== true && flags.quiet !== true,
      });
    },
  );
}
