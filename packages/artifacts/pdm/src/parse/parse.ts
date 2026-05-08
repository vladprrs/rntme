import { parseWithSchema } from '@rntme/artifact-shared';
import type { ZodType } from 'zod';

import { PdmArtifactSchema } from './schema.js';
import type { PdmArtifact } from '../types/artifact.js';
import { ERROR_CODES, type PdmError, type Result } from '../types/result.js';

export function parsePdm(input: unknown): Result<PdmArtifact> {
  return parseWithSchema<PdmArtifact, PdmError>(input, PdmArtifactSchema as ZodType<PdmArtifact>, {
    fromJson: (message) => ({
      layer: 'parse',
      code: ERROR_CODES.PDM_PARSE_SCHEMA_VIOLATION,
      message,
    }),
    fromIssue: (issue, path) => {
      const base: PdmError = {
        layer: 'parse',
        code: ERROR_CODES.PDM_PARSE_SCHEMA_VIOLATION,
        message: issue.message,
      };
      return path !== undefined ? { ...base, path } : base;
    },
  });
}
