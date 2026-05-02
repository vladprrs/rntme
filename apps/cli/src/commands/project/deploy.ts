import { endpoints } from '../../api/endpoints.js';
import type { DeploymentResponseSchema } from '../../api/types.js';
import { err } from '../../result.js';
import { cliError } from '../../errors/codes.js';
import { runCommand, type CommonFlags } from '../harness.js';
import type { z } from 'zod';

type DeploymentResponse = z.infer<typeof DeploymentResponseSchema>;

export type ProjectDeployArgs = {
  readonly version: number;
  readonly target: string;
};

export async function runProjectDeploy(args: ProjectDeployArgs, flags: CommonFlags): Promise<number> {
  return runCommand<DeploymentResponse>(
    flags,
    {
      requireToken: true,
      humanRender: (d) => {
        const org = flags.org ?? '';
        const project = flags.project ?? '';
        return [
          'deployment queued',
          `  id:       ${d.deployment.id}`,
          `  status:   ${d.deployment.status}`,
          `  queued:   ${d.deployment.queuedAt}`,
          `  detail:   ${deploymentDetailUrl(flags.baseUrl, org, project, d.deployment.id)}`,
        ].join('\n');
      },
    },
    async (ctx) => {
      const org = flags.org ?? ctx.resolved.org;
      const project = flags.project ?? ctx.resolved.project;
      if (!org) return err(cliError('CLI_CONFIG_MISSING', 'no org; use --org'));
      if (!project) return err(cliError('CLI_CONFIG_MISSING', 'no project; use --project'));
      return endpoints.deployments.start(
        { baseUrl: ctx.resolved.baseUrl, token: ctx.resolved.token },
        org,
        project,
        {
          projectVersionSeq: args.version,
          targetSlug: args.target,
          configOverrides: {},
        },
      );
    },
  );
}

function deploymentDetailUrl(baseUrl: string | undefined, org: string, project: string, deploymentId: string): string {
  const root = (baseUrl ?? 'https://platform.rntme.com').replace(/\/+$/, '').replace(/\/v1$/, '');
  return `${root}/${encodeURIComponent(org)}/projects/${encodeURIComponent(project)}/deployments/${encodeURIComponent(deploymentId)}`;
}
