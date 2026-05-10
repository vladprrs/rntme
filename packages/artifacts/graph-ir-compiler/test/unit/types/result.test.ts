import { describe, it, expect } from 'bun:test';
import { ok, err, isOk, isErr, ERROR_CODES } from '../../../src/types/result.js';

describe('Result helpers', () => {
  it('ok wraps a value', () => {
    const r = ok(42);
    expect(isOk(r)).toBe(true);
    if (r.ok) expect(r.value).toBe(42);
  });

  it('err wraps errors', () => {
    const r = err([{ layer: 'structural', code: 'STRUCT_DUPLICATE_NODE_ID', message: 'x' }]);
    expect(isErr(r)).toBe(true);
    if (!r.ok) expect(r.errors[0]?.code).toBe('STRUCT_DUPLICATE_NODE_ID');
  });

  it('ERROR_CODES registry contains at least parse codes', () => {
    expect(ERROR_CODES.PARSE_INVALID_JSON).toBe('PARSE_INVALID_JSON');
  });
});
