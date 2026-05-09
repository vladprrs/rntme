import { endpoints } from '../../api/endpoints.js';
import type { DeploymentResponseSchema, DeploymentStatus } from '../../api/types.js';
import { err, isOk } from '../../result.js';
import { cliError } from '../../errors/codes.js';
import { runCommand, type CommonFlags } from '../harness.js';
import { validateUuid } from '../../util/uuid.js';
import type { z } from 'zod';
import type { Result } from '../../result.js';
import type { CliError } from '../../errors/codes.js';
import type { ClientError } from '../../api/client.js';

type DeploymentResponse = z.infer<typeof DeploymentResponseSchema>;

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

export async function watchUntilTerminal(opts: {
  apiCtx: { baseUrl: string; token: string | null };
  deploymentId: string;
  pollIntervalMs?: number | undefined;
  timeoutMs?: number | undefined;
  printLogs?: boolean | undefined;
}): Promise<Result<DeploymentResponse, ClientError | CliError>> {
  const { apiCtx, deploymentId, pollIntervalMs = 2_000, timeoutMs, printLogs = true } = opts;
  let sinceLineId = 0;
  const startTime = Date.now();

  while (true) {
    if (timeoutMs !== undefined && Date.now() - startTime > timeoutMs) {
      return err(cliError('CLI_NETWORK_TIMEOUT', `deployment watch timed out after ${timeoutMs}ms`));
    }

    const status = await endpoints.deployments.show(apiCtx, deploymentId);
    if (!isOk(status)) return status;

    const logs = await endpoints.deployments.logs(apiCtx, deploymentId, {
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

    if (TERMINAL.has(status.value.deployment.status)) return status;
    await sleep(pollIntervalMs);
  }
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
