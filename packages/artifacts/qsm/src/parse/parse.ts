import { QsmArtifactSchema } from './schema.js';
import type { QsmArtifact } from '../types/artifact.js';
import {
  err,
  ok,
  ERROR_CODES,
  type Result,
  type QsmError,
} from '../types/result.js';

export function parseQsm(input: unknown): Result<QsmArtifact> {
  let candidate: unknown = input;

  if (typeof input === 'string') {
    try {
      candidate = JSON.parse(input) as unknown;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'invalid JSON';
      return err([
        {
          layer: 'parse',
          code: ERROR_CODES.QSM_PARSE_SCHEMA_VIOLATION,
          message,
        },
      ]);
    }
  }

  const parsed = QsmArtifactSchema.safeParse(candidate);
  if (!parsed.success) {
    const errors: QsmError[] = parsed.error.issues.map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') : undefined;
      const base: QsmError = {
        layer: 'parse',
        code: ERROR_CODES.QSM_PARSE_SCHEMA_VIOLATION,
        message: issue.message,
      };
      return path !== undefined ? { ...base, path } : base;
    });
    return err(errors);
  }

  return ok(parsed.data as QsmArtifact);
}
