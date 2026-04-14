import { BindingArtifactSchema } from './schema.js';
import type { BindingArtifact } from '../types/artifact.js';
import { err, ok, ERROR_CODES, type Result, type BindingsError } from '../types/result.js';

export function parseBindingArtifact(input: unknown): Result<BindingArtifact> {
  let candidate: unknown = input;
  if (typeof input === 'string') {
    try {
      candidate = JSON.parse(input) as unknown;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'invalid JSON';
      return err([
        {
          layer: 'parse',
          code: ERROR_CODES.BINDINGS_PARSE_SCHEMA_VIOLATION,
          message,
        },
      ]);
    }
  }

  const parsed = BindingArtifactSchema.safeParse(candidate);
  if (!parsed.success) {
    const errors: BindingsError[] = parsed.error.issues.map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') : undefined;
      const base: BindingsError = {
        layer: 'parse',
        code: ERROR_CODES.BINDINGS_PARSE_SCHEMA_VIOLATION,
        message: issue.message,
      };
      return path !== undefined ? { ...base, path } : base;
    });
    return err(errors);
  }

  return ok(parsed.data as BindingArtifact);
}
