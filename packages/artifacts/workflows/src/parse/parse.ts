import { parseWithSchema } from '@rntme/artifact-shared';
import type { ZodType } from 'zod';

import { WorkflowArtifactSchema } from './schema.js';
import type { WorkflowArtifact } from '../types/artifact.js';
import { ERROR_CODES, type Result, type WorkflowError } from '../types/result.js';

export function parseWorkflowArtifact(input: unknown): Result<WorkflowArtifact> {
  return parseWithSchema<WorkflowArtifact, WorkflowError>(
    input,
    WorkflowArtifactSchema as ZodType<WorkflowArtifact>,
    {
      fromJson: (message) => ({
        layer: 'parse',
        code: ERROR_CODES.WORKFLOWS_PARSE_SCHEMA_VIOLATION,
        message,
      }),
      fromIssue: (issue, path) => {
        const base: WorkflowError = {
          layer: 'parse',
          code: ERROR_CODES.WORKFLOWS_PARSE_SCHEMA_VIOLATION,
          message: issue.message,
        };
        return path !== undefined ? { ...base, path } : base;
      },
    },
  );
}
