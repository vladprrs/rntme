import { describe, expect, it } from 'vitest';
import { hashBuffer } from '../../src/hash.js';

describe('hashBuffer', () => {
  it('matches known sha256 for hello', () => {
    expect(hashBuffer(Buffer.from('hello'))).toBe(
      '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
    );
  });
});
