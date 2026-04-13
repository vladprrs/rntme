import { err, ok, isOk, isErr, ERROR_CODES } from './types/result.js';
import type { Result } from './types/result.js';

export { ok, err, isOk, isErr, ERROR_CODES };
export type { Result, GraphIrError, ErrorCode, Layer, Ok, Err } from './types/result.js';

export const VERSION = '0.0.0';

export type CompileOptions = { target?: 'sqlite' };

export type CompileResult = {
  sql: string;
  paramOrder: string[];
  // Replaced by NamedShapeRef when canonical-IR types are introduced.
  shape: { name: string };
};

export function compile(
  _spec: unknown,
  _pdm: unknown,
  _qsm: unknown,
  _options?: CompileOptions,
): Result<CompileResult> {
  return err([
    {
      layer: 'parse',
      code: ERROR_CODES.PARSE_SCHEMA_VIOLATION,
      message: 'compile() is not implemented yet',
    },
  ]);
}
