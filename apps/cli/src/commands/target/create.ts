import { endpoints } from '../../api/endpoints.js';
import { cliError } from '../../errors/codes.js';
import { err } from '../../result.js';
import { runCommand, type CommonFlags } from '../harness.js';

export type TargetCreateArgs = {
  readonly slug: string;
  readonly kind?: string | undefined;
  readonly displayName?: string | undefined;
  readonly dokployUrl?: string | undefined;
  readonly dokployProjectId?: string | undefined;
  readonly dokployProjectName?: string | undefined;
  readonly allowCreateProject?: boolean | undefined;
  readonly apiToken?: string | undefined;
  readonly publicBaseUrl?: string | undefined;
  readonly eventBusMode?: string | undefined;
  readonly eventBusImage?: string | undefined;
  readonly workflowEngineImage?: string | undefined;
  readonly workflowWorkerImage?: string | undefined;
};

export async function runTargetCreate(args: TargetCreateArgs, flags: CommonFlags): Promise<number> {
  return runCommand(
    flags,
    {
      requireToken: true,
      humanRender: (d: { target: { slug: string } }) => `✓ created ${d.target.slug}`,
    },
    async (ctx) => {
      const org = flags.org ?? ctx.resolved.org;
      if (!org) return err(cliError('CLI_CONFIG_MISSING', 'no org; use --org'));
      if ((args.kind ?? 'dokploy') !== 'dokploy') return err(cliError('CLI_USAGE', '--kind must be dokploy'));
      if (!args.dokployUrl) return err(cliError('CLI_USAGE', '--dokploy-url is required'));
      if (!args.apiToken) return err(cliError('CLI_USAGE', '--api-token is required'));
      if (!args.dokployProjectId && !(args.dokployProjectName && args.allowCreateProject === true)) {
        return err(cliError('CLI_USAGE', 'provide --dokploy-project-id or --dokploy-project-name with --allow-create-project'));
      }

      const body: Record<string, unknown> = {
        slug: args.slug,
        displayName: args.displayName ?? args.slug,
        kind: 'dokploy',
        dokployUrl: args.dokployUrl,
        apiToken: args.apiToken,
        modules: {},
        auth: {},
        policyValues: {},
      };
      if (args.publicBaseUrl) body.publicBaseUrl = args.publicBaseUrl;
      if (args.dokployProjectId) body.dokployProjectId = args.dokployProjectId;
      if (args.dokployProjectName) body.dokployProjectName = args.dokployProjectName;
      body.allowCreateProject = args.allowCreateProject === true;

      if (args.eventBusMode === 'provisioned') {
        body.eventBus = {
          kind: 'kafka',
          mode: 'provisioned',
          provider: 'redpanda',
          ...(args.eventBusImage ? { image: args.eventBusImage } : {}),
        };
      } else {
        return err(cliError('CLI_USAGE', '--event-bus-mode provisioned is required for target create in this CLI path'));
      }

      if (args.workflowEngineImage || args.workflowWorkerImage) {
        if (!args.workflowEngineImage || !args.workflowWorkerImage) {
          return err(cliError('CLI_USAGE', 'workflow targets require both --workflow-engine-image and --workflow-worker-image'));
        }
        body.workflows = {
          engine: { kind: 'operaton', mode: 'provisioned', image: args.workflowEngineImage },
          worker: { image: args.workflowWorkerImage },
        };
      } else {
        body.workflows = null;
      }

      return endpoints.targets.create({ baseUrl: ctx.resolved.baseUrl, token: ctx.resolved.token }, org, body);
    },
  );
}
