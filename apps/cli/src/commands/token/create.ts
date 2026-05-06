import { runCommand } from '../harness.js';
import type { CommonFlags } from '../harness.js';
import { endpoints } from '../../api/endpoints.js';
import { err } from '../../result.js';
import { cliError } from '../../errors/codes.js';
import type { z } from 'zod';
import type { TokenCreatedResponseSchema } from '../../api/types.js';

type TokenCreated = z.infer<typeof TokenCreatedResponseSchema>;

export type TokenCreateArgs = {
  name: string;
  scopes: string[];
  expiresAt?: string;
  preset?: string;
};

const TOKEN_PRESETS: Record<string, readonly string[]> = {
  deploy: ['project:read', 'version:publish', 'deploy:execute'],
  admin: ['project:read', 'project:write', 'version:publish', 'deploy:execute', 'deploy:target:manage', 'token:manage'],
  publish: ['project:read', 'version:publish'],
  read: ['project:read'],
};

export async function runTokenCreate(args: TokenCreateArgs, flags: CommonFlags): Promise<number> {
  return runCommand<TokenCreated>(
    flags,
    {
      requireToken: true,
      humanRender: (d) =>
        [
          `✓ token created — save it now, it will NOT be shown again`,
          ``,
          `  name:        ${d.token.name}`,
          `  id:          ${d.token.id}`,
          `  scopes:      ${d.token.scopes.join(', ')}`,
          `  prefix:      ${d.token.prefix}`,
          `  expiresAt:   ${d.token.expiresAt ?? '—'}`,
          ``,
          `  plaintext:   ${d.plaintext}`,
        ].join('\n'),
    },
    async (ctx) => {
      const org = flags.org ?? ctx.resolved.org;
      if (!org) return err(cliError('CLI_CONFIG_MISSING', 'need --org'));
      const presetScopes = args.preset === undefined ? undefined : TOKEN_PRESETS[args.preset];
      if (args.preset !== undefined && presetScopes === undefined) {
        return err(cliError('CLI_USAGE', '--preset must be one of deploy, admin, publish, read'));
      }
      const scopes = args.scopes.length > 0 ? args.scopes : [...(presetScopes ?? [])];
      const body = args.expiresAt === undefined
        ? { name: args.name, scopes }
        : { name: args.name, scopes, expiresAt: args.expiresAt };
      return endpoints.tokens.create(
        { baseUrl: ctx.resolved.baseUrl, token: ctx.resolved.token },
        org,
        body,
      );
    },
  );
}
