import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { endpoints } from '../../api/endpoints.js';
import { runCommand, type CommonFlags } from '../harness.js';
import { err } from '../../result.js';
import { cliError } from '../../errors/codes.js';

export type TargetSetConfigArgs = { readonly slug: string; readonly fromPath: string };

export async function runTargetSetConfig(args: TargetSetConfigArgs, flags: CommonFlags): Promise<number> {
  return runCommand(
    flags,
    {
      requireToken: true,
      humanRender: (d: { target: { slug: string } }) => `✓ updated ${d.target.slug}`,
    },
    async (ctx) => {
      const org = flags.org ?? ctx.resolved.org;
      if (!org) return err(cliError('CLI_CONFIG_MISSING', 'no org; use --org'));
      let body: Record<string, unknown>;
      try {
        body = JSON.parse(readFileSync(resolve(process.cwd(), args.fromPath), 'utf8')) as Record<string, unknown>;
      } catch (e) {
        return err(cliError('CLI_VALIDATE_JSON_INVALID', `--from path could not be parsed: ${(e as Error).message}`));
      }
      return endpoints.targets.setConfig({ baseUrl: ctx.resolved.baseUrl, token: ctx.resolved.token }, org, args.slug, body);
    },
  );
}
