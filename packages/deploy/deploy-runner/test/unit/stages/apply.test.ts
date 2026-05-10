import { describe, expect, it } from 'bun:test';
import { apply } from '../../../src/stages/apply.js';

describe('stages.apply', () => {
  it('exports an apply function', () => {
    expect(typeof apply).toBe('function');
  });
});
