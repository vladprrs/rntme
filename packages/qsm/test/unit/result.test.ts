import { describe, expect, it } from 'vitest';
import { ok, err, isOk, isErr, ERROR_CODES } from '../../src/types/result.js';
import type { QsmError } from '../../src/types/result.js';

describe('Result', () => {
  it('ok() produces tagged ok', () => {
    const r = ok(42);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(42);
  });

  it('err() produces tagged err with errors array', () => {
    const e: QsmError = {
      layer: 'parse',
      code: ERROR_CODES.QSM_PARSE_SCHEMA_VIOLATION,
      message: 'boom',
    };
    const r = err([e]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toHaveLength(1);
  });

  it('isOk / isErr narrow', () => {
    const r = ok(1);
    expect(isOk(r)).toBe(true);
    expect(isErr(r)).toBe(false);
  });

  it('ERROR_CODES key === value', () => {
    for (const [k, v] of Object.entries(ERROR_CODES)) {
      expect(k).toBe(v);
    }
  });

  it('includes all layer codes', () => {
    expect(ERROR_CODES.QSM_PARSE_SCHEMA_VIOLATION).toBeDefined();
    expect(ERROR_CODES.QSM_STRUCT_DUPLICATE_PROJECTION).toBeDefined();
    expect(ERROR_CODES.QSM_XREF_SOURCE_UNKNOWN_ENTITY).toBeDefined();
    expect(ERROR_CODES.QSM_BACKING_DERIVED_NOT_SUPPORTED).toBeDefined();
    expect(ERROR_CODES.QSM_INTERNAL).toBeDefined();
  });
});
