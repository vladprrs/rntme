import { describe, it, expect } from 'bun:test';
import { errorCodes, allErrorCodes } from '../src/error-codes.js';

const PATTERN = /^IDENTITY_(STRUCTURAL|REFERENCES|CONSISTENCY|VENDOR|HTTP)_[A-Z0-9_]+$/;

describe('error-codes.json', () => {
  it('declares exactly 20 codes spread across four layers', () => {
    expect(allErrorCodes.length).toBe(20);
    expect(errorCodes.structural.length).toBe(2);
    expect(errorCodes.references.length).toBe(5);
    expect(errorCodes.consistency.length).toBe(7);
    expect(errorCodes.vendor.length).toBe(6);
  });

  it('declares HTTP introspection transport vendor codes', () => {
    expect(errorCodes.vendor).toContain('IDENTITY_HTTP_TOKEN_MISSING');
    expect(errorCodes.vendor).toContain('IDENTITY_HTTP_AUDIENCE_MISSING');
  });

  it('every code matches IDENTITY_<LAYER>_<KIND>', () => {
    for (const code of allErrorCodes) {
      expect(code, `code ${code} does not match canonical pattern`).toMatch(PATTERN);
    }
  });

  it('codes are unique', () => {
    expect(new Set(allErrorCodes).size).toBe(allErrorCodes.length);
  });

  it('layer prefix matches the JSON key it lives under', () => {
    for (const code of errorCodes.structural) expect(code.startsWith('IDENTITY_STRUCTURAL_')).toBe(true);
    for (const code of errorCodes.references) expect(code.startsWith('IDENTITY_REFERENCES_')).toBe(true);
    for (const code of errorCodes.consistency) expect(code.startsWith('IDENTITY_CONSISTENCY_')).toBe(true);
    for (const code of errorCodes.vendor) expect(code).toMatch(/^IDENTITY_(VENDOR|HTTP)_/);
  });
});
