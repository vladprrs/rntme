import type { ZodError, ZodIssue } from 'zod';
import { SeedArtifactSchema } from './schema.js';
import type { Result, SeedArtifact, SeedError } from './types.js';

export function parseSeed(raw: unknown): Result<SeedArtifact> {
  const result = SeedArtifactSchema.safeParse(raw);
  if (result.success) {
    return { ok: true, value: result.data as SeedArtifact };
  }
  return { ok: false, errors: zodToSeedErrors(result.error) };
}

function zodToSeedErrors(err: ZodError): SeedError[] {
  return err.issues.map(issueToSeedError);
}

function issueToSeedError(issue: ZodIssue): SeedError {
  const path = issue.path.length === 0 ? undefined : formatPath(issue.path as (string | number)[]);
  const code = issue.code === 'unrecognized_keys' ? 'SEED_SYNTAX_UNKNOWN_FIELD' : 'SEED_SYNTAX_INVALID';
  const base = {
    code,
    message: issue.message,
    details: { zodCode: String(issue.code) },
  } as const;
  return path === undefined ? base : { ...base, path };
}

function formatPath(path: readonly (string | number)[]): string {
  let out = '';
  for (const seg of path) {
    if (typeof seg === 'number') {
      out += `[${seg}]`;
    } else {
      out += out === '' ? seg : `.${seg}`;
    }
  }
  return out;
}
