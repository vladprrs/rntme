import { describe, it, expect } from 'vitest';
import { ERROR_CODES, toHranaError } from '../../src/errors.js';

describe('error codes', () => {
  it('exposes append-only registry', () => {
    expect(ERROR_CODES.DB_STUDIO_PARSE_SYNTAX).toBe('DB_STUDIO_PARSE_SYNTAX');
    expect(ERROR_CODES.DB_STUDIO_READONLY_NOT_SELECT).toBe('DB_STUDIO_READONLY_NOT_SELECT');
    expect(ERROR_CODES.DB_STUDIO_READONLY_PRAGMA_DENIED).toBe('DB_STUDIO_READONLY_PRAGMA_DENIED');
    expect(ERROR_CODES.DB_STUDIO_READONLY_ATTACH_DENIED).toBe('DB_STUDIO_READONLY_ATTACH_DENIED');
    expect(ERROR_CODES.DB_STUDIO_READONLY_CTE_WRITE).toBe('DB_STUDIO_READONLY_CTE_WRITE');
    expect(ERROR_CODES.DB_STUDIO_READONLY_TXN_DENIED).toBe('DB_STUDIO_READONLY_TXN_DENIED');
    expect(ERROR_CODES.DB_STUDIO_LIMIT_TOO_LARGE).toBe('DB_STUDIO_LIMIT_TOO_LARGE');
    expect(ERROR_CODES.DB_STUDIO_SQLITE_ERROR).toBe('DB_STUDIO_SQLITE_ERROR');
    expect(ERROR_CODES.DB_STUDIO_TARGET_UNKNOWN).toBe('DB_STUDIO_TARGET_UNKNOWN');
    expect(ERROR_CODES.DB_STUDIO_HRANA_UNSUPPORTED).toBe('DB_STUDIO_HRANA_UNSUPPORTED');
    expect(ERROR_CODES.DB_STUDIO_HRANA_BAD_REQUEST).toBe('DB_STUDIO_HRANA_BAD_REQUEST');
    expect(ERROR_CODES.DB_STUDIO_PARSE_MULTIPLE_STATEMENTS).toBe('DB_STUDIO_PARSE_MULTIPLE_STATEMENTS');
  });

  it('toHranaError produces inline Hrana error shape', () => {
    const hranaErr = toHranaError({
      code: 'DB_STUDIO_READONLY_NOT_SELECT',
      message: 'only SELECT allowed',
    });
    expect(hranaErr).toEqual({
      type: 'error',
      error: { message: 'only SELECT allowed', code: 'DB_STUDIO_READONLY_NOT_SELECT' },
    });
  });
});
