import { readFile as fsReadFile } from 'node:fs/promises';
import type { Result } from '../result.js';
import { ok, err } from '../result.js';
import { cliError, type CliError } from '../errors/codes.js';
import { TargetFileSchema } from './target-schema.js';
import type { LoadedTarget, LoadTargetDeps } from './types.js';

export async function loadTargetFile(
  path: string,
  slug: string,
  deps: LoadTargetDeps = {},
): Promise<Result<LoadedTarget, CliError>> {
  const reader = deps.readFile ?? ((p: string) => fsReadFile(p, 'utf8'));
  let raw: string;
  try {
    raw = await reader(path);
  } catch (cause) {
    return err(
      cliError(
        'CLI_DEPLOY_TARGET_FILE_INVALID',
        `cannot read target file ${path}: ${String(cause)}`,
        undefined,
        cause,
      ),
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (cause) {
    return err(
      cliError('CLI_DEPLOY_TARGET_FILE_INVALID', `target file ${path} is not valid JSON`, undefined, cause),
    );
  }

  const validated = TargetFileSchema.safeParse(parsed);
  if (!validated.success) {
    return err(
      cliError(
        'CLI_DEPLOY_TARGET_FILE_INVALID',
        `target file ${path} failed schema validation: ${validated.error.message}`,
        undefined,
        validated.error,
      ),
    );
  }

  const file = validated.data;
  if (file.kind === 'dokploy') {
    return ok({
      target: {
        id: `direct-${slug}`,
        slug,
        kind: 'dokploy',
        displayName: file.displayName,
        dokployUrl: file.config.dokployUrl,
        publicBaseUrl: file.publicBaseUrl ?? null,
        dokployProjectId: file.config.dokployProjectId ?? null,
        dokployProjectName: file.config.dokployProjectName ?? null,
        allowCreateProject: file.config.allowCreateProject ?? false,
        eventBus: file.eventBus ?? { kind: 'kafka', mode: 'external', brokers: ['localhost:9092'] },
        modules: {},
        workflows: null,
        storage: { mode: 'external' },
        auth: {},
        policyValues: {},
        manualAccess: {},
      } as never,
      secretRefs: { apiToken: file.secrets.apiToken, extras: {} },
    });
  }
  // unreachable — discriminated union exhausts kinds, but TypeScript needs the catch-all.
  return err(cliError('CLI_DEPLOY_TARGET_FILE_INVALID', 'unknown target kind'));
}
