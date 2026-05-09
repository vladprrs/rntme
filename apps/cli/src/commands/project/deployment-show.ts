import { endpoints } from '../../api/endpoints.js';
import type { DeploymentResponseSchema } from '../../api/types.js';
import { runCommand, type CommonFlags } from '../harness.js';
import { validateUuid } from '../../util/uuid.js';
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
          `version:  ${deployment.projectVersionSeq}`,
          `target:   ${deployment.targetSlug}`,
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
      const id = validateUuid(args.deploymentId, 'deployment-id');
      if (!id.ok) return id;
      return endpoints.deployments.show(
        { baseUrl: ctx.resolved.baseUrl, token: ctx.resolved.token },
        id.value,
      );
    },
  );
}
