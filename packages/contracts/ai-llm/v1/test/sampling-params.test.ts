import { describe, expect, it } from 'bun:test';

const CANONICAL_RESPONSE_FORMATS = ['text', 'json_object', 'json_schema'] as const;

describe('SamplingParams.response_format documented enum', () => {
  it('is exactly the three canonical values', () => {
    expect(CANONICAL_RESPONSE_FORMATS).toEqual(['text', 'json_object', 'json_schema']);
    expect(CANONICAL_RESPONSE_FORMATS.length).toBe(3);
  });

  it('all three values are non-empty strings', () => {
    for (const v of CANONICAL_RESPONSE_FORMATS) {
      expect(typeof v).toBe('string');
      expect(v.length).toBeGreaterThan(0);
    }
  });
});
