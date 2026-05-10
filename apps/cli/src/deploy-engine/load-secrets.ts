import type { ResolvedTargetSecrets } from '@rntme/deploy-runner';
import type { Result } from '../result.js';
import { ok, err } from '../result.js';
import { cliError, type CliError } from '../errors/codes.js';
import type { SecretRef } from './target-schema.js';

export type SecretRefMap = {
  readonly apiToken: SecretRef;
  readonly extras: Readonly<Record<string, SecretRef>>;
};

export function resolveSecrets(
  refs: SecretRefMap,
  env: Readonly<Record<string, string | undefined>>,
): Result<ResolvedTargetSecrets, CliError> {
  const apiToken = readEnv(refs.apiToken, env);
  if (apiToken === null) {
    return err(
      cliError('CLI_DEPLOY_SECRET_MISSING', `env var ${refs.apiToken.name} not set (required for apiToken)`),
    );
  }
  const extras: Record<string, string> = {};
  for (const [key, ref] of Object.entries(refs.extras)) {
    const value = readEnv(ref, env);
    if (value === null) {
      return err(cliError('CLI_DEPLOY_SECRET_MISSING', `env var ${ref.name} not set (required for ${key})`));
    }
    extras[key] = value;
  }
  return ok({ apiToken, extras });
}

function readEnv(ref: SecretRef, env: Readonly<Record<string, string | undefined>>): string | null {
  const value = env[ref.name];
  if (value === undefined || value === '') return null;
  return value;
}
