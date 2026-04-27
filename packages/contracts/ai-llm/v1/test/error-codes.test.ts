import { describe, expect, it } from 'vitest';
import { errorCodes, isErrorCode, layerOf, type ErrorCode } from '../src/error-codes.js';

const PATTERN = /^AI_LLM_(STRUCTURAL|REFERENCES|CONSISTENCY|VENDOR)_[A-Z0-9_]+$/;

describe('error-codes.json', () => {
  it('every code matches AI_LLM_<LAYER>_<KIND>', () => {
    for (const layer of ['structural', 'references', 'consistency', 'vendor'] as const) {
      for (const code of errorCodes[layer]) {
        expect(code, `code ${code} does not match pattern`).toMatch(PATTERN);
      }
    }
  });

  it('has expected counts per layer', () => {
    expect(errorCodes.structural).toHaveLength(9);
    expect(errorCodes.references).toHaveLength(5);
    expect(errorCodes.consistency).toHaveLength(10);
    expect(errorCodes.vendor).toHaveLength(8);
  });

  it('layer prefix matches layer key', () => {
    for (const code of errorCodes.structural) expect(code).toMatch(/^AI_LLM_STRUCTURAL_/);
    for (const code of errorCodes.references) expect(code).toMatch(/^AI_LLM_REFERENCES_/);
    for (const code of errorCodes.consistency) expect(code).toMatch(/^AI_LLM_CONSISTENCY_/);
    for (const code of errorCodes.vendor) expect(code).toMatch(/^AI_LLM_VENDOR_/);
  });

  it('isErrorCode returns true for known codes', () => {
    expect(isErrorCode('AI_LLM_VENDOR_RATE_LIMITED')).toBe(true);
    expect(isErrorCode('NOT_A_CODE')).toBe(false);
  });

  it('layerOf returns the correct layer', () => {
    expect(layerOf('AI_LLM_STRUCTURAL_MISSING_MODEL' as ErrorCode)).toBe('structural');
    expect(layerOf('AI_LLM_VENDOR_UNAVAILABLE' as ErrorCode)).toBe('vendor');
    expect(layerOf('AI_LLM_REFERENCES_THREAD_NOT_FOUND' as ErrorCode)).toBe('references');
    expect(layerOf('AI_LLM_CONSISTENCY_THREAD_DELETED' as ErrorCode)).toBe('consistency');
  });

  it('no duplicate codes across layers', () => {
    const all = [
      ...errorCodes.structural,
      ...errorCodes.references,
      ...errorCodes.consistency,
      ...errorCodes.vendor,
    ];
    expect(new Set(all).size).toBe(all.length);
  });
});
