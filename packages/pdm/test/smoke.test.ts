import { describe, expect, it } from 'vitest';
import { VERSION } from '../src/index.js';

describe('@rntme/pdm', () => {
  it('exports VERSION', () => {
    expect(VERSION).toBe('0.0.0');
  });
});
