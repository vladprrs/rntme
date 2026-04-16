import { UiArtifactSchema, type UiArtifactParsed } from './schema.js';
import { err, ok, UI_ERROR_CODES, type Result, type UiError } from '../types/result.js';

export function parseUiArtifact(raw: unknown): Result<UiArtifactParsed> {
  const parsed = UiArtifactSchema.safeParse(raw);
  if (parsed.success) return ok(parsed.data as UiArtifactParsed);

  const errors: UiError[] = parsed.error.issues.map((issue) => ({
    layer: 'parse',
    code: UI_ERROR_CODES.UI_PARSE_SCHEMA_VIOLATION,
    message: issue.message,
    path: issue.path.join('.'),
  }));
  return err(errors);
}
