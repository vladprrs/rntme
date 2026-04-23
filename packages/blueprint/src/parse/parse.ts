import { ProjectBlueprintSchema } from './schema.js';
import {
  err,
  ok,
  ERROR_CODES,
  type BlueprintError,
  type Result,
} from '../types/result.js';
import type { ProjectBlueprint } from '../types/artifact.js';

export function parseProjectBlueprint(raw: unknown): Result<ProjectBlueprint> {
  const parsed = ProjectBlueprintSchema.safeParse(raw);
  if (!parsed.success) {
    return err(
      parsed.error.issues.map((issue): BlueprintError => {
        const base: BlueprintError = {
          layer: 'parse',
          code: ERROR_CODES.BLUEPRINT_PARSE_SCHEMA_VIOLATION,
          message: issue.message,
        };
        const path = issue.path.length > 0 ? issue.path.join('.') : undefined;
        return path !== undefined ? { ...base, path } : base;
      }),
    );
  }
  return ok(parsed.data as ProjectBlueprint);
}
