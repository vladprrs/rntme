import { endpoints } from '../../api/endpoints.js';
import type { ProjectOperationsListResponseSchema } from '../../api/types.js';
import { cliError } from '../../errors/codes.js';
import { err } from '../../result.js';
import { runCommand, type CommonFlags } from '../harness.js';
import type { z } from 'zod';

type ProjectOperationsListResponse = z.infer<typeof ProjectOperationsListResponseSchema>;

export async function runProjectOperationList(args: { limit?: number }, flags: CommonFlags): Promise<number> {
  return runCommand<ProjectOperationsListResponse>(
    flags,
    {
      requireToken: true,
      humanRender: (d) =>
        d.operations.length === 0
          ? 'no project operations'
          : d.operations.map((operation) => `${operation.id}\t${operation.kind}\t${operation.status}\t${operation.queuedAt}`).join('\n'),
    },
    async (ctx) => {
      const org = flags.org ?? ctx.resolved.org;
      const project = flags.project ?? ctx.resolved.project;
      if (!org) return err(cliError('CLI_CONFIG_MISSING', 'no org; use --org'));
      if (!project) return err(cliError('CLI_CONFIG_MISSING', 'no project; use --project'));
      return endpoints.projectOperations.list({ baseUrl: ctx.resolved.baseUrl, token: ctx.resolved.token }, org, project, args);
    },
  );
}
