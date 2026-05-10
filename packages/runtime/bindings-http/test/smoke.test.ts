import { describe, it, expect } from 'bun:test';
import { VERSION } from '../src/index.js';

describe('smoke', () => {
  it('exports VERSION', () => {
    expect(VERSION).toBe('0.0.0');
  });
});
