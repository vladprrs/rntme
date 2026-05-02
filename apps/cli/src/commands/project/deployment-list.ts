import { endpoints } from '../../api/endpoints.js';
import type { DeploymentsListResponseSchema } from '../../api/types.js';
import { renderTable } from '../../output/tables.js';
import { err } from '../../result.js';
import { cliError } from '../../errors/codes.js';
import { runCommand, type CommonFlags } from '../harness.js';
import type { z } from 'zod';

type DeploymentsList = z.infer<typeof DeploymentsListResponseSchema>;

export type ProjectDeploymentListArgs = {
  readonly limit?: number | undefined;
};

export async function runProjectDeploymentList(args: ProjectDeploymentListArgs, flags: CommonFlags): Promise<number> {
  return runCommand<DeploymentsList>(
    flags,
    {
      requireToken: true,
      humanRender: (d) =>
        renderTable(
          ['ID', 'STATUS', 'VERSION', 'TARGET', 'QUEUED', 'STARTED', 'FINISHED'],
          d.deployments.map((deployment) => [
            deployment.id,
            deployment.status,
            deployment.projectVersionId,
            deployment.targetId,
            deployment.queuedAt,
            deployment.startedAt ?? '',
            deployment.finishedAt ?? '',
          ]),
          { maxWidths: [12, 23, 12, 12, 24, 24, 24] },
        ),
    },
    async (ctx) => {
      const org = flags.org ?? ctx.resolved.org;
      const project = flags.project ?? ctx.resolved.project;
      if (!org) return err(cliError('CLI_CONFIG_MISSING', 'no org; use --org'));
      if (!project) return err(cliError('CLI_CONFIG_MISSING', 'no project; use --project'));
      const listOpts: { limit?: number } = {};
      if (args.limit !== undefined) listOpts.limit = args.limit;
      return endpoints.deployments.list(
        { baseUrl: ctx.resolved.baseUrl, token: ctx.resolved.token },
        org,
        project,
        listOpts,
      );
    },
  );
}
