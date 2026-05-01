import { describe, it, expect } from 'vitest';
import { VERSION } from '@rntme/runtime';

describe('@rntme/runtime', () => {
  it('exports a version string', () => {
    expect(typeof VERSION).toBe('string');
  });
});
