import { parseWithSchema } from '@rntme/artifact-shared';
import type { ZodType } from 'zod';

import { ProjectBlueprintSchema } from './schema.js';
import { ERROR_CODES, type BlueprintError, type Result } from '../types/result.js';
import type { ProjectBlueprint } from '../types/artifact.js';

export function parseProjectBlueprint(raw: unknown): Result<ProjectBlueprint> {
  return parseWithSchema<ProjectBlueprint, BlueprintError>(
    raw,
    ProjectBlueprintSchema as ZodType<ProjectBlueprint>,
    {
      fromIssue: (issue, path) => {
        const base: BlueprintError = {
          layer: 'parse',
          code: ERROR_CODES.BLUEPRINT_PARSE_SCHEMA_VIOLATION,
          message: issue.message,
        };
        return path !== undefined ? { ...base, path } : base;
      },
    },
  );
}
