import { parseWithSchema } from '@rntme/artifact-shared';
import type { ZodType } from 'zod';

import { BindingArtifactSchema } from './schema.js';
import type { BindingArtifact } from '../types/artifact.js';
import { ERROR_CODES, type BindingsError, type Result } from '../types/result.js';

export function parseBindingArtifact(input: unknown): Result<BindingArtifact> {
  return parseWithSchema<BindingArtifact, BindingsError>(
    input,
    BindingArtifactSchema as ZodType<BindingArtifact>,
    {
      fromJson: (message) => ({
        layer: 'parse',
        code: ERROR_CODES.BINDINGS_PARSE_SCHEMA_VIOLATION,
        message,
      }),
      fromIssue: (issue, path) => {
        const base: BindingsError = {
          layer: 'parse',
          code: ERROR_CODES.BINDINGS_PARSE_SCHEMA_VIOLATION,
          message: issue.message,
        };
        return path !== undefined ? { ...base, path } : base;
      },
    },
  );
}
