import { endpoints } from '../../api/endpoints.js';
import { runCommand, type CommonFlags } from '../harness.js';
import { err } from '../../result.js';
import { cliError } from '../../errors/codes.js';

export type TargetListArgs = Record<string, never>;

export async function runTargetList(_args: TargetListArgs, flags: CommonFlags): Promise<number> {
  return runCommand(
    flags,
    {
      requireToken: true,
      humanRender: (d: { targets: Array<{ slug: string; displayName: string; kind: string; isDefault: boolean }> }) => {
        const header = 'SLUG'.padEnd(28) + 'DISPLAY NAME'.padEnd(32) + 'KIND'.padEnd(12) + 'DEFAULT';
        const rows = d.targets.map((t) =>
          (t.slug.padEnd(28) + (t.displayName ?? '—').padEnd(32) + t.kind.padEnd(12) + (t.isDefault ? 'yes' : '—'))
        );
        return [header, ...rows].join('\n');
      },
    },
    async (ctx) => {
      const org = flags.org ?? ctx.resolved.org;
      if (!org) return err(cliError('CLI_CONFIG_MISSING', 'no org; use --org'));
      return endpoints.targets.list({ baseUrl: ctx.resolved.baseUrl, token: ctx.resolved.token }, org);
    },
  );
}
