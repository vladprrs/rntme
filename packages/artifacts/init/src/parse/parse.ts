import { parseWithSchema } from '@rntme/artifact-shared';
import type { ZodType } from 'zod';
import { InitArtifactSchema } from './schema.js';
import type { InitArtifact } from '../types/artifact.js';
import { ERROR_CODES, type InitError, type Result } from '../types/result.js';

export function parseInitArtifact(input: unknown): Result<InitArtifact> {
  return parseWithSchema<InitArtifact, InitError>(
    input,
    InitArtifactSchema as ZodType<InitArtifact>,
    {
      fromJson: (message) => ({
        layer: 'parse',
        code: ERROR_CODES.INIT_PARSE_SCHEMA_VIOLATION,
        message,
      }),
      fromIssue: (issue, path) => {
        const base: InitError = {
          layer: 'parse',
          code: ERROR_CODES.INIT_PARSE_SCHEMA_VIOLATION,
          message: issue.message,
        };
        return path === undefined ? base : { ...base, path };
      },
    },
  );
}
