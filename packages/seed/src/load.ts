import { readFileSync } from 'node:fs';
import { parseSeed } from './parse.js';
import { validateSeed, type ValidateCtx } from './validate.js';
import type { Result, ValidatedSeed } from './types.js';

export function loadSeed(
  input: string | Buffer | Record<string, unknown>,
  ctx: ValidateCtx,
): Result<ValidatedSeed> {
  let raw: unknown;
  if (Buffer.isBuffer(input)) {
    try {
      raw = JSON.parse(input.toString('utf8'));
    } catch (err) {
      return readOrJsonError(err);
    }
  } else if (typeof input === 'string') {
    try {
      raw = JSON.parse(readFileSync(input, 'utf8'));
    } catch (err) {
      return readOrJsonError(err);
    }
  } else {
    raw = input;
  }

  const parsed = parseSeed(raw);
  if (!parsed.ok) return parsed;
  return validateSeed(parsed.value, ctx);
}

function readOrJsonError(err: unknown): Result<ValidatedSeed> {
  const message = err instanceof Error ? err.message : String(err);
  return {
    ok: false,
    errors: [{ code: 'SEED_SYNTAX_INVALID', message }],
  };
}
