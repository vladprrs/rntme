import { resolve } from 'node:path';
import { materializeAndCompose } from '@rntme/blueprint';
import { buildProjectBundle } from '../../bundle/build.js';
import { endpoints } from '../../api/endpoints.js';
import { runCommand, type CommonFlags } from '../harness.js';
import { err, isOk } from '../../result.js';
import { cliError } from '../../errors/codes.js';
import type { ProjectVersionResponseSchema } from '../../api/types.js';
import type { z } from 'zod';

type ProjectVersionResponse = z.infer<typeof ProjectVersionResponseSchema>;

export type ProjectPublishArgs = {
  readonly folder?: string | undefined;
  readonly createProject?: boolean | undefined;
  readonly dryRun?: boolean | undefined;
};

type PublishOutput = ProjectVersionResponse & {
  readonly digest: string;
  readonly size: number;
  readonly dryRun: boolean;
  readonly idempotent: boolean;
};

export async function runProjectPublish(args: ProjectPublishArgs, flags: CommonFlags): Promise<number> {
  return runCommand<PublishOutput>(
    flags,
    {
      requireToken: true,
      humanRender: (d) =>
        d.dryRun
          ? [`✓ project bundle validated`, `  digest: ${d.digest}`, `  size:   ${d.size}`].join('\n')
          : [
              d.idempotent ? `↺ project version already published` : `✓ project version published`,
              `  seq:    ${d.version.seq}`,
              `  id:     ${d.version.id}`,
              `  digest: ${d.version.bundleDigest}`,
            ].join('\n'),
    },
    async (ctx) => {
      const org = flags.org ?? ctx.resolved.org;
      const project = flags.project ?? ctx.resolved.project;
      if (!org) return err(cliError('CLI_CONFIG_MISSING', 'no org; use --org'));
      if (!project) return err(cliError('CLI_CONFIG_MISSING', 'no project; use --project'));

      const folder = resolve(process.cwd(), args.folder ?? '.');
      const built = buildProjectBundle(folder);
      if (!isOk(built)) return built;

      const composed = await materializeAndCompose(built.value.bundle);
      if (!composed.ok) {
        return err(
          cliError(
            'CLI_VALIDATE_LOCAL_FAILED',
            composed.errors.map((e) => `${e.code}: ${e.message}`).join('; '),
            undefined,
            composed.errors,
          ),
        );
      }

      if (args.dryRun === true) {
        return {
          ok: true,
          value: {
            version: {
              id: '',
              orgId: '',
              projectId: '',
              seq: 0,
              bundleDigest: built.value.digest,
              bundleBlobKey: '',
              bundleSizeBytes: built.value.size,
              summary: {
                projectName: composed.value.summary.projectName,
                services: [...composed.value.summary.services],
                routes: {
                  ui: { ...composed.value.summary.routes.ui },
                  http: { ...composed.value.summary.routes.http },
                },
                middleware: { ...composed.value.summary.middleware },
                mounts: [...composed.value.summary.mounts],
              },
              uploadedByAccountId: '',
              createdAt: '',
            },
            digest: built.value.digest,
            size: built.value.size,
            dryRun: true,
            idempotent: false,
          },
        };
      }

      const apiCtx = { baseUrl: ctx.resolved.baseUrl, token: ctx.resolved.token };
      let published = await endpoints.projectVersions.publishBundle(apiCtx, project, built.value.bytes);
      if (!published.ok && published.error.kind === 'http' && published.error.status === 404 && args.createProject === true) {
        const created = await endpoints.projects.create(apiCtx, org, { slug: project, displayName: project });
        if (!created.ok) return created;
        published = await endpoints.projectVersions.publishBundle(apiCtx, project, built.value.bytes);
      }
      if (!published.ok) return published;

      return {
        ok: true,
        value: {
          ...published.value,
          digest: built.value.digest,
          size: built.value.size,
          dryRun: false,
          idempotent: published.value.__status === 200,
        },
      };
    },
  );
}
