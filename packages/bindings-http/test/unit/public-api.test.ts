import { describe, it, expect } from 'vitest';
import * as api from '../../src/index.js';

describe('public API surface', () => {
  it('exports createBindingsRouter', () => {
    expect(typeof api.createBindingsRouter).toBe('function');
  });
  it('exports BindingsRuntimeError', () => {
    expect(typeof api.BindingsRuntimeError).toBe('function');
  });
  it('exports VERSION', () => {
    expect(typeof api.VERSION).toBe('string');
  });
});
