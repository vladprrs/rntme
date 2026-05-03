import { endpoints } from '../../api/endpoints.js';
import type { ProjectOperationResponse } from '../../api/types.js';
import { cliError } from '../../errors/codes.js';
import { err } from '../../result.js';
import { runCommand, type CommonFlags } from '../harness.js';
import { validateUuid } from '../../util/uuid.js';
import { renderOperation } from './operation-watch.js';

export async function runProjectOperationShow(args: { operationId: string }, flags: CommonFlags): Promise<number> {
  return runCommand<ProjectOperationResponse>(
    flags,
    {
      requireToken: true,
      humanRender: renderOperation,
    },
    async (ctx) => {
      const id = validateUuid(args.operationId, 'operation-id');
      if (!id.ok) return id;
      const org = flags.org ?? ctx.resolved.org;
      const project = flags.project ?? ctx.resolved.project;
      if (!org) return err(cliError('CLI_CONFIG_MISSING', 'no org; use --org'));
      if (!project) return err(cliError('CLI_CONFIG_MISSING', 'no project; use --project'));
      return endpoints.projectOperations.show({ baseUrl: ctx.resolved.baseUrl, token: ctx.resolved.token }, org, project, id.value);
    },
  );
}
