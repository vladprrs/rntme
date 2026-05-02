import { endpoints } from '../../api/endpoints.js';
import type { DeploymentResponseSchema, DeploymentStatus } from '../../api/types.js';
import { err, isOk } from '../../result.js';
import { cliError } from '../../errors/codes.js';
import { runCommand, type CommonFlags } from '../harness.js';
import type { z } from 'zod';

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

export async function runProjectDeploymentWatch(args: ProjectDeploymentWatchArgs, flags: CommonFlags): Promise<number> {
  return runCommand<DeploymentResponse>(
    flags,
    {
      requireToken: true,
      humanRender: (d) => `deployment ${d.deployment.id} ended with ${d.deployment.status}`,
      successExitCode: (d) => {
        if (d.deployment.status === 'succeeded') return 0;
        if (d.deployment.status === 'succeeded_with_warnings') return 1;
        return 10;
      },
    },
    async (ctx) => {
      const org = flags.org ?? ctx.resolved.org;
      const project = flags.project ?? ctx.resolved.project;
      if (!org) return err(cliError('CLI_CONFIG_MISSING', 'no org; use --org'));
      if (!project) return err(cliError('CLI_CONFIG_MISSING', 'no project; use --project'));

      const apiCtx = { baseUrl: ctx.resolved.baseUrl, token: ctx.resolved.token };
      let sinceLineId = 0;
      const pollIntervalMs = args.pollIntervalMs ?? 2_000;

      while (true) {
        const status = await endpoints.deployments.show(apiCtx, org, project, args.deploymentId);
        if (!isOk(status)) return status;

        const logs = await endpoints.deployments.logs(apiCtx, org, project, args.deploymentId, {
          sinceLineId,
          limit: 200,
        });
        if (!isOk(logs)) return logs;

        for (const line of logs.value.lines) {
          process.stdout.write(`[${line.level}] ${line.step}: ${line.message}\n`);
        }
        sinceLineId = logs.value.lastLineId;

        if (TERMINAL.has(status.value.deployment.status)) return status;
        await sleep(pollIntervalMs);
      }
    },
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
