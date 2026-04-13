import { err, ERROR_CODES, type Result } from './types/result.js';

export { ok, err, isOk, isErr, ERROR_CODES } from './types/result.js';
export type { Result, GraphIrError, ErrorCode, Layer, Ok, Err } from './types/result.js';

export const VERSION = '0.0.0';

export type CompileOptions = { target?: 'sqlite' };

export type CompileResult = {
  sql: string;
  paramOrder: string[];
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
