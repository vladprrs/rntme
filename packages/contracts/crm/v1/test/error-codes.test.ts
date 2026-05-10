import { describe, expect, it } from 'bun:test';
import { allErrorCodes, errorCodes } from '../src/error-codes.js';

const PATTERN = /^CRM_(STRUCTURAL|REFERENCES|CONSISTENCY|VENDOR)_[A-Z0-9_]+$/;

const expectedErrorCodes = {
  structural: [
    'CRM_STRUCTURAL_MISSING_IDEMPOTENCY_KEY',
    'CRM_STRUCTURAL_MISSING_REQUIRED_FIELD',
    'CRM_STRUCTURAL_INVALID_EMAIL',
    'CRM_STRUCTURAL_INVALID_PHONE',
    'CRM_STRUCTURAL_INVALID_CURRENCY',
    'CRM_STRUCTURAL_INVALID_TAX_ID',
    'CRM_STRUCTURAL_INVALID_ENTITY_TYPE',
  ],
  references: [
    'CRM_REFERENCES_CONTACT_NOT_FOUND',
    'CRM_REFERENCES_COMPANY_NOT_FOUND',
    'CRM_REFERENCES_DEAL_NOT_FOUND',
    'CRM_REFERENCES_ACTIVITY_NOT_FOUND',
    'CRM_REFERENCES_NOTE_NOT_FOUND',
    'CRM_REFERENCES_ASSOCIATION_NOT_FOUND',
    'CRM_REFERENCES_PIPELINE_NOT_FOUND',
    'CRM_REFERENCES_STAGE_NOT_FOUND',
    'CRM_REFERENCES_OWNER_NOT_FOUND',
    'CRM_REFERENCES_ASYNC_JOB_NOT_FOUND',
  ],
  consistency: [
    'CRM_CONSISTENCY_DUPLICATE_EMAIL',
    'CRM_CONSISTENCY_DUPLICATE_DOMAIN',
    'CRM_CONSISTENCY_STAGE_NOT_IN_PIPELINE',
    'CRM_CONSISTENCY_DEAL_ALREADY_CLOSED',
    'CRM_CONSISTENCY_LABELS_NOT_SUPPORTED',
    'CRM_CONSISTENCY_UNSUPPORTED_HARD_DELETE',
    'CRM_CONSISTENCY_UNSUPPORTED_ASYNC_JOB_TYPE',
    'CRM_CONSISTENCY_OPTIMISTIC_LOCK_CONFLICT',
    'CRM_CONSISTENCY_PARENT_ENTITY_TYPE_MISMATCH',
    'CRM_CONSISTENCY_BATCH_TOO_LARGE',
  ],
  vendor: [
    'CRM_VENDOR_RATE_LIMITED',
    'CRM_VENDOR_DAILY_QUOTA_EXCEEDED',
    'CRM_VENDOR_UNAVAILABLE',
    'CRM_VENDOR_UNAUTHORIZED',
    'CRM_VENDOR_FORBIDDEN',
    'CRM_VENDOR_INVALID_REQUEST',
  ],
} as const;

describe('CRM error codes', () => {
  it('declares exactly the canonical error-code catalog', () => {
    expect(errorCodes).toEqual(expectedErrorCodes);
    expect(allErrorCodes).toEqual([
      ...expectedErrorCodes.structural,
      ...expectedErrorCodes.references,
      ...expectedErrorCodes.consistency,
      ...expectedErrorCodes.vendor,
    ]);
  });

  it('keeps every code in the CRM_<LAYER>_<KIND> namespace', () => {
    for (const code of allErrorCodes) {
      expect(code, `code ${code} does not match canonical pattern`).toMatch(PATTERN);
    }
  });

  it('keeps codes unique and layer-prefixed', () => {
    expect(new Set(allErrorCodes).size).toBe(allErrorCodes.length);
    for (const code of errorCodes.structural) expect(code.startsWith('CRM_STRUCTURAL_')).toBe(true);
    for (const code of errorCodes.references) expect(code.startsWith('CRM_REFERENCES_')).toBe(true);
    for (const code of errorCodes.consistency) expect(code.startsWith('CRM_CONSISTENCY_')).toBe(true);
    for (const code of errorCodes.vendor) expect(code.startsWith('CRM_VENDOR_')).toBe(true);
  });
});
