import { parseWithSchema } from '@rntme/artifact-shared';
import type { ZodType } from 'zod';

import { SeedArtifactSchema } from './schema.js';
import type { Result, SeedArtifact, SeedError } from './types.js';

export function parseSeed(raw: unknown): Result<SeedArtifact> {
  return parseWithSchema<SeedArtifact, SeedError>(
    raw,
    SeedArtifactSchema as ZodType<SeedArtifact>,
    {
      fromIssue: (issue) => {
        // Seed renders numeric path segments as `[N]`, so it formats from
        // `issue.path` directly rather than relying on the helper-supplied
        // `.`-joined path.
        const path =
          issue.path.length === 0
            ? undefined
            : formatPath(issue.path as readonly (string | number)[]);
        const code: SeedError['code'] =
          issue.code === 'unrecognized_keys' ? 'SEED_SYNTAX_UNKNOWN_FIELD' : 'SEED_SYNTAX_INVALID';
        const base: SeedError = {
          code,
          message: issue.message,
          details: { zodCode: String(issue.code) },
        };
        return path === undefined ? base : { ...base, path };
      },
    },
  );
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
