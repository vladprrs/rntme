import { parseWithSchema } from '@rntme/artifact-shared';
import type { ZodType } from 'zod';

import { QsmArtifactSchema } from './schema.js';
import type { QsmArtifact } from '../types/artifact.js';
import { ERROR_CODES, type QsmError, type Result } from '../types/result.js';

export function parseQsm(input: unknown): Result<QsmArtifact> {
  return parseWithSchema<QsmArtifact, QsmError>(input, QsmArtifactSchema as ZodType<QsmArtifact>, {
    fromJson: (message) => ({
      layer: 'parse',
      code: ERROR_CODES.QSM_PARSE_SCHEMA_VIOLATION,
      message,
    }),
    fromIssue: (issue, path) => {
      const base: QsmError = {
        layer: 'parse',
        code: ERROR_CODES.QSM_PARSE_SCHEMA_VIOLATION,
        message: issue.message,
      };
      return path !== undefined ? { ...base, path } : base;
    },
  });
}
