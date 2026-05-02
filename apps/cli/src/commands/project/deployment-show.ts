import { endpoints } from '../../api/endpoints.js';
import type { DeploymentResponseSchema } from '../../api/types.js';
import { err } from '../../result.js';
import { cliError } from '../../errors/codes.js';
import { runCommand, type CommonFlags } from '../harness.js';
import type { z } from 'zod';

type DeploymentResponse = z.infer<typeof DeploymentResponseSchema>;

export type ProjectDeploymentShowArgs = {
  readonly deploymentId: string;
};

export async function runProjectDeploymentShow(args: ProjectDeploymentShowArgs, flags: CommonFlags): Promise<number> {
  return runCommand<DeploymentResponse>(
    flags,
    {
      requireToken: true,
      humanRender: (d) => {
        const deployment = d.deployment;
        return [
          `id:       ${deployment.id}`,
          `status:   ${deployment.status}`,
          `version:  ${deployment.projectVersionId}`,
          `target:   ${deployment.targetId}`,
          `digest:   ${deployment.renderedPlanDigest ?? ''}`,
          `error:    ${deployment.errorCode ?? ''}`,
          `message:  ${deployment.errorMessage ?? ''}`,
          `queued:   ${deployment.queuedAt}`,
          `started:  ${deployment.startedAt ?? ''}`,
          `finished: ${deployment.finishedAt ?? ''}`,
          '',
          `warnings: ${JSON.stringify(deployment.warnings)}`,
          `apply:    ${JSON.stringify(deployment.applyResult ?? {})}`,
          `verify:   ${JSON.stringify(deployment.verificationReport ?? {})}`,
        ].join('\n');
      },
    },
    async (ctx) => {
      const org = flags.org ?? ctx.resolved.org;
      const project = flags.project ?? ctx.resolved.project;
      if (!org) return err(cliError('CLI_CONFIG_MISSING', 'no org; use --org'));
      if (!project) return err(cliError('CLI_CONFIG_MISSING', 'no project; use --project'));
      return endpoints.deployments.show(
        { baseUrl: ctx.resolved.baseUrl, token: ctx.resolved.token },
        org,
        project,
        args.deploymentId,
      );
    },
  );
}
