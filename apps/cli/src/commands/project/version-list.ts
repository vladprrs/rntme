import { endpoints } from '../../api/endpoints.js';
import type { ProjectVersionsListResponseSchema } from '../../api/types.js';
import { renderTable } from '../../output/tables.js';
import { err } from '../../result.js';
import { cliError } from '../../errors/codes.js';
import { runCommand, type CommonFlags } from '../harness.js';
import type { z } from 'zod';

type ProjectVersionsList = z.infer<typeof ProjectVersionsListResponseSchema>;

export type ProjectVersionListArgs = { limit?: number | undefined; cursor?: string | undefined };

export async function runProjectVersionList(args: ProjectVersionListArgs, flags: CommonFlags): Promise<number> {
  return runCommand<ProjectVersionsList>(
    flags,
    {
      requireToken: true,
      humanRender: (d) =>
        renderTable(
          ['SEQ', 'DIGEST', 'SIZE', 'CREATED'],
          d.versions.map((v) => [
            String(v.seq),
            v.bundleDigest.slice(0, 19),
            String(v.bundleSizeBytes),
            v.createdAt,
          ]),
        ),
    },
    async (ctx) => {
      const org = flags.org ?? ctx.resolved.org;
      const project = flags.project ?? ctx.resolved.project;
      if (!org) return err(cliError('CLI_CONFIG_MISSING', 'no org; use --org'));
      if (!project) return err(cliError('CLI_CONFIG_MISSING', 'no project; use --project'));
      const listOpts: { limit?: number } = {};
      if (args.limit !== undefined) listOpts.limit = args.limit;
      return endpoints.projectVersions.list(
        { baseUrl: ctx.resolved.baseUrl, token: ctx.resolved.token },
        project,
        listOpts,
      );
    },
  );
}
