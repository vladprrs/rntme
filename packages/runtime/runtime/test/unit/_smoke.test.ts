import { describe, it, expect } from 'bun:test';
import { VERSION } from '../../src/index.js';

describe('@rntme/runtime', () => {
  it('exports a version string', () => {
    expect(typeof VERSION).toBe('string');
  });
});
