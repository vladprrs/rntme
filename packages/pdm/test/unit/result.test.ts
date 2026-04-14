import { describe, expect, it } from 'vitest';
import { ok, err, isOk, isErr, ERROR_CODES } from '../../src/types/result.js';

describe('Result helpers', () => {
  it('ok wraps value', () => {
    const r = ok(42);
    expect(r).toEqual({ ok: true, value: 42 });
  });

  it('err wraps errors array', () => {
    const r = err([
      { layer: 'parse', code: ERROR_CODES.PDM_PARSE_SCHEMA_VIOLATION, message: 'bad' },
    ]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toHaveLength(1);
  });

  it('isOk / isErr discriminate', () => {
    const o = ok('x');
    const e = err([{ layer: 'internal', code: ERROR_CODES.PDM_INTERNAL, message: '' }]);
    expect(isOk(o)).toBe(true);
    expect(isErr(o)).toBe(false);
    expect(isOk(e)).toBe(false);
    expect(isErr(e)).toBe(true);
  });

  it('ERROR_CODES contains parse + structural + state-machine codes', () => {
    expect(ERROR_CODES.PDM_PARSE_SCHEMA_VIOLATION).toBe('PDM_PARSE_SCHEMA_VIOLATION');
    expect(ERROR_CODES.PDM_STRUCT_DUPLICATE_ENTITY).toBe('PDM_STRUCT_DUPLICATE_ENTITY');
    expect(ERROR_CODES.PDM_SM_EMPTY_SELF_LOOP).toBe('PDM_SM_EMPTY_SELF_LOOP');
  });
});
