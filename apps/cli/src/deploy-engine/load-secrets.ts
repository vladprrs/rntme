import type { ResolvedTargetSecrets } from '@rntme/deploy-runner';
import type { Result } from '../result.js';
import { ok, err } from '../result.js';
import { cliError, type CliError } from '../errors/codes.js';
import type { ExtraSecretRef, SecretRef } from './target-schema.js';

export type SecretRefMap = {
  readonly apiToken: SecretRef;
  readonly extras: Readonly<Record<string, ExtraSecretRef>>;
};

export function resolveSecrets(
  refs: SecretRefMap,
  env: Readonly<Record<string, string | undefined>>,
): Result<ResolvedTargetSecrets, CliError> {
  const apiToken = readEnvLeaf(refs.apiToken, env);
  if (apiToken === null) {
    return err(
      cliError('CLI_DEPLOY_SECRET_MISSING', `env var ${refs.apiToken.name} not set (required for apiToken)`),
    );
  }
  const extras: Record<string, unknown> = {};
  for (const [key, ref] of Object.entries(refs.extras)) {
    if (isLeafRef(ref)) {
      const value = readEnvLeaf(ref, env);
      if (value === null) {
        return err(cliError('CLI_DEPLOY_SECRET_MISSING', `env var ${ref.name} not set (required for ${key})`));
      }
      extras[key] = value;
      continue;
    }
    const composite: Record<string, string> = {};
    for (const [subKey, subRef] of Object.entries(ref)) {
      const value = readEnvLeaf(subRef, env);
      if (value === null) {
        return err(
          cliError('CLI_DEPLOY_SECRET_MISSING', `env var ${subRef.name} not set (required for ${key}.${subKey})`),
        );
      }
      composite[subKey] = value;
    }
    extras[key] = composite;
  }
  return ok({ apiToken, extras });
}

function isLeafRef(ref: ExtraSecretRef): ref is SecretRef {
  return (
    typeof ref === 'object' &&
    ref !== null &&
    'source' in ref &&
    (ref as { source?: unknown }).source === 'env'
  );
}

function readEnvLeaf(ref: SecretRef, env: Readonly<Record<string, string | undefined>>): string | null {
  const value = env[ref.name];
  if (value === undefined || value === '') return null;
  return value;
}
