import { describe, expect, it } from 'bun:test';
import { verify } from '../../../src/stages/verify.js';

describe('stages.verify', () => {
  it('exports a verify function', () => {
    expect(typeof verify).toBe('function');
  });
});
