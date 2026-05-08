import { describe, expect, it } from 'vitest';
import { errorCodes, isErrorCode, layerOf, type ErrorCode } from '../src/error-codes.js';

const FORMAT = /^STORAGE_(STRUCTURAL|REFERENCES|CONSISTENCY|AUTH|VENDOR|PROVISIONER)_[A-Z0-9_]+$/;

describe('STORAGE_* error code namespace', () => {
  it('every code matches STORAGE_<LAYER>_<KIND>', () => {
    const all: readonly string[] = [
      ...errorCodes.structural,
      ...errorCodes.references,
      ...errorCodes.consistency,
      ...errorCodes.auth,
      ...errorCodes.vendor,
      ...errorCodes.provisioner,
    ];
    for (const code of all) {
      expect(code, `${code} does not match STORAGE_<LAYER>_<KIND>`).toMatch(FORMAT);
    }
  });

  it('isErrorCode is truthy on all known codes and falsy on unknowns', () => {
    expect(isErrorCode('STORAGE_VENDOR_RATE_LIMITED')).toBe(true);
    expect(isErrorCode('NOPE_NOPE')).toBe(false);
  });

  it('layerOf returns the right bucket', () => {
    expect(layerOf('STORAGE_STRUCTURAL_ROUTE_ID_MISSING' as ErrorCode)).toBe('structural');
    expect(layerOf('STORAGE_REFERENCES_FILE_NOT_FOUND' as ErrorCode)).toBe('references');
    expect(layerOf('STORAGE_CONSISTENCY_FILE_TOO_LARGE' as ErrorCode)).toBe('consistency');
    expect(layerOf('STORAGE_AUTH_OWNER_MISMATCH' as ErrorCode)).toBe('auth');
    expect(layerOf('STORAGE_VENDOR_PRESIGN_FAILED' as ErrorCode)).toBe('vendor');
    expect(layerOf('STORAGE_PROVISIONER_BUCKET_CREATE_FAILED' as ErrorCode)).toBe('provisioner');
  });

  it('contains exactly the spec section 5.3 codes (drift pin)', () => {
    expect(errorCodes.structural.length).toBe(4);
    expect(errorCodes.references.length).toBe(3);
    expect(errorCodes.consistency.length).toBe(5);
    expect(errorCodes.auth.length).toBe(3);
    expect(errorCodes.vendor.length).toBe(7);
    expect(errorCodes.provisioner.length).toBe(6);
  });
});
