import { parseWithSchema } from '@rntme/artifact-shared';

import { AuthoringSpecSchema, type AuthoringSpecOutput } from './schema.js';
import { ERROR_CODES, type GraphIrError, type Result } from '../types/result.js';

export function parseAuthoringSpec(input: unknown): Result<AuthoringSpecOutput> {
  return parseWithSchema<AuthoringSpecOutput, GraphIrError>(input, AuthoringSpecSchema, {
    fromJson: (message) => ({
      layer: 'parse',
      code: ERROR_CODES.PARSE_INVALID_JSON,
      message,
    }),
    fromIssue: (issue, path) => ({
      layer: 'parse',
      code: ERROR_CODES.PARSE_SCHEMA_VIOLATION,
      message: issue.message,
      ...(path !== undefined ? { location: { path } } : {}),
    }),
  });
}
