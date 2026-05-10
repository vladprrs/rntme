import { describe, expect, it } from 'bun:test';
import { errorCodes, allErrorCodes } from '../src/error-codes.js';

const PATTERN = /^MARKETING_SITE_(VALIDATE|PROVISION)_[A-Z0-9_]+$/;

describe('error-codes.json', () => {
  it('declares validate and provision layer codes', () => {
    expect(errorCodes.validate).toEqual([
      'MARKETING_SITE_VALIDATE_INVALID_CONFIG',
      'MARKETING_SITE_VALIDATE_INVALID_SOURCE',
      'MARKETING_SITE_VALIDATE_INVALID_DOMAIN',
    ]);
    expect(errorCodes.provision).toContain('MARKETING_SITE_PROVISION_HASH_MISMATCH');
    expect(errorCodes.provision).toContain('MARKETING_SITE_PROVISION_INDEX_HTML_MISSING');
  });

  it('keeps all codes unique and in canonical format', () => {
    expect(new Set(allErrorCodes).size).toBe(allErrorCodes.length);
    for (const code of allErrorCodes) expect(code).toMatch(PATTERN);
  });
});
