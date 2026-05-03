import { endpoints } from '../../api/endpoints.js';
import { runCommand, type CommonFlags } from '../harness.js';
import { err } from '../../result.js';
import { cliError } from '../../errors/codes.js';

export type TargetShowArgs = { readonly slug: string };

export async function runTargetShow(args: TargetShowArgs, flags: CommonFlags): Promise<number> {
  return runCommand(
    flags,
    {
      requireToken: true,
      humanRender: (d: { target: Record<string, unknown> }) =>
        Object.entries(d.target).map(([k, v]) => `${k.padEnd(20)} ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`).join('\n'),
    },
    async (ctx) => {
      const org = flags.org ?? ctx.resolved.org;
      if (!org) return err(cliError('CLI_CONFIG_MISSING', 'no org; use --org'));
      return endpoints.targets.show({ baseUrl: ctx.resolved.baseUrl, token: ctx.resolved.token }, org, args.slug);
    },
  );
}
