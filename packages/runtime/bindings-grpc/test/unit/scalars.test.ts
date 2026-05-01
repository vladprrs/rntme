import { describe, it, expect } from 'vitest';
import { scalarToProto } from '../../src/emit/scalars.js';

describe('scalarToProto', () => {
  it.each([
    ['integer', 'int64'],
    ['decimal', 'string'],
    ['string', 'string'],
    ['boolean', 'bool'],
    ['date', 'string'],
    ['datetime', 'string'],
  ] as const)('maps %s → %s', (primitive, expected) => {
    expect(scalarToProto(primitive)).toBe(expected);
  });
});
