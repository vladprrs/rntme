import { AuthoringSpecSchema, type AuthoringSpecOutput } from './schema.js';
import { err, ok, ERROR_CODES, type Result } from '../types/result.js';

export function parseAuthoringSpec(input: unknown): Result<AuthoringSpecOutput> {
  let candidate: unknown = input;
  if (typeof input === 'string') {
    try {
      candidate = JSON.parse(input) as unknown;
    } catch (e) {
      return err([
        {
          layer: 'parse',
          code: ERROR_CODES.PARSE_INVALID_JSON,
          message: e instanceof Error ? e.message : 'invalid JSON',
        },
      ]);
    }
  }
  const result = AuthoringSpecSchema.safeParse(candidate);
  if (!result.success) {
    return err(
      result.error.issues.map((issue) => {
        const path = issue.path.length > 0 ? issue.path.join('.') : undefined;
        return {
          layer: 'parse' as const,
          code: ERROR_CODES.PARSE_SCHEMA_VIOLATION,
          message: issue.message,
          ...(path !== undefined ? { location: { path } } : {}),
        };
      }),
    );
  }
  return ok(result.data);
}
