import { describe, it, expect } from 'vitest';
import { ok, err, isOk, isErr, ERROR_CODES } from '../../../src/types/result.js';

describe('Result', () => {
  it('ok wraps a value', () => {
    const r = ok(42);
    expect(isOk(r)).toBe(true);
    expect(isErr(r)).toBe(false);
    if (isOk(r)) expect(r.value).toBe(42);
  });

  it('err wraps errors array', () => {
    const r = err([{ code: 'PLATFORM_INTERNAL', message: 'x' }]);
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.errors).toHaveLength(1);
  });

  it('ERROR_CODES registry is append-only set', () => {
    expect(ERROR_CODES.PLATFORM_AUTH_MISSING).toBe('PLATFORM_AUTH_MISSING');
    expect(ERROR_CODES.PLATFORM_VALIDATION_BUNDLE_FAILED).toBe('PLATFORM_VALIDATION_BUNDLE_FAILED');
  });

  it('includes project operation error codes', () => {
    expect(ERROR_CODES.PROJECT_OPERATION_NOT_FOUND).toBe('PROJECT_OPERATION_NOT_FOUND');
    expect(ERROR_CODES.PROJECT_OPERATION_ACTIVE_DEPLOYMENT).toBe('PROJECT_OPERATION_ACTIVE_DEPLOYMENT');
    expect(ERROR_CODES.PROJECT_OPERATION_DEFAULT_TARGET_MISSING).toBe('PROJECT_OPERATION_DEFAULT_TARGET_MISSING');
    expect(ERROR_CODES.PROJECT_OPERATION_INVALID_STATE).toBe('PROJECT_OPERATION_INVALID_STATE');
    expect(ERROR_CODES.PROJECT_OPERATION_CONFIRMATION_MISMATCH).toBe('PROJECT_OPERATION_CONFIRMATION_MISMATCH');
    expect(ERROR_CODES.PROJECT_OPERATION_BUNDLE_SOURCE_CONFLICT).toBe('PROJECT_OPERATION_BUNDLE_SOURCE_CONFLICT');
    expect(ERROR_CODES.PROJECT_OPERATION_DELETE_TEARDOWN_FAILED).toBe('PROJECT_OPERATION_DELETE_TEARDOWN_FAILED');
  });
});
