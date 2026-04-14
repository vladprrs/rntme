import { PdmArtifactSchema } from './schema.js';
import type { PdmArtifact } from '../types/artifact.js';
import {
  err,
  ok,
  ERROR_CODES,
  type Result,
  type PdmError,
} from '../types/result.js';

export function parsePdm(input: unknown): Result<PdmArtifact> {
  let candidate: unknown = input;

  if (typeof input === 'string') {
    try {
      candidate = JSON.parse(input) as unknown;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'invalid JSON';
      return err([
        {
          layer: 'parse',
          code: ERROR_CODES.PDM_PARSE_SCHEMA_VIOLATION,
          message,
        },
      ]);
    }
  }

  const parsed = PdmArtifactSchema.safeParse(candidate);
  if (!parsed.success) {
    const errors: PdmError[] = parsed.error.issues.map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') : undefined;
      const base: PdmError = {
        layer: 'parse',
        code: ERROR_CODES.PDM_PARSE_SCHEMA_VIOLATION,
        message: issue.message,
      };
      return path !== undefined ? { ...base, path } : base;
    });
    return err(errors);
  }

  return ok(parsed.data as PdmArtifact);
}
