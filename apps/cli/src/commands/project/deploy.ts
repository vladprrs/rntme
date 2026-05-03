import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { endpoints } from '../../api/endpoints.js';
import type { DeploymentResponseSchema } from '../../api/types.js';
import { err, isOk } from '../../result.js';
import { cliError } from '../../errors/codes.js';
import { runCommand, type CommonFlags } from '../harness.js';
import { watchUntilTerminal } from './deployment-watch.js';
import type { z } from 'zod';

type DeploymentResponse = z.infer<typeof DeploymentResponseSchema>;

export type ProjectDeployArgs = {
  readonly version: number;
  readonly target: string;
  readonly runtimeImage?: string | undefined;
  readonly configOverridesPath?: string | undefined;
  readonly wait?: boolean | undefined;
  readonly timeoutSec?: number | undefined;
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
      successExitCode: (d) => {
        if (!args.wait) return 0;
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

      let configOverrides: Record<string, unknown> = {};
      if (args.configOverridesPath) {
        const raw = readFileSync(resolve(process.cwd(), args.configOverridesPath), 'utf8');
        configOverrides = JSON.parse(raw) as Record<string, unknown>;
      }
      if (args.runtimeImage) configOverrides.runtimeImage = args.runtimeImage;

      const queued = await endpoints.deployments.start(
        { baseUrl: ctx.resolved.baseUrl, token: ctx.resolved.token },
        org,
        project,
        {
          projectVersionSeq: args.version,
          targetSlug: args.target,
          configOverrides,
        },
      );

      if (!isOk(queued)) return queued;

      if (args.wait) {
        const final = await watchUntilTerminal({
          apiCtx: { baseUrl: ctx.resolved.baseUrl, token: ctx.resolved.token },
          org,
          project,
          deploymentId: queued.value.deployment.id,
          timeoutMs: (args.timeoutSec ?? 300) * 1000,
          printLogs: flags.json !== true && flags.quiet !== true,
        });
        return final;
      }

      return queued;
    },
  );
}

function deploymentDetailUrl(baseUrl: string | undefined, org: string, project: string, deploymentId: string): string {
  const root = (baseUrl ?? 'https://platform.rntme.com').replace(/\/+$/, '').replace(/\/v1$/, '');
  return `${root}/${encodeURIComponent(org)}/projects/${encodeURIComponent(project)}/deployments/${encodeURIComponent(deploymentId)}`;
}
