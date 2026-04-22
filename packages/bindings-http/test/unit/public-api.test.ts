import { describe, it, expect } from 'vitest';
import * as api from '../../src/index.js';

describe('public API surface', () => {
  it('exports createBindingsRouter', () => {
    expect(typeof api.createBindingsRouter).toBe('function');
  });
  it('exports BindingsRuntimeError', () => {
    expect(typeof api.BindingsRuntimeError).toBe('function');
  });
  it('exports commandErrorBody', () => {
    expect(typeof api.commandErrorBody).toBe('function');
  });
  it('exports commandErrorStatus', () => {
    expect(typeof api.commandErrorStatus).toBe('function');
  });
  it('exports buildDefaultGraphIrCommandMap', () => {
    expect(typeof api.buildDefaultGraphIrCommandMap).toBe('function');
  });
  it('exports correlationMiddleware', () => {
    expect(typeof api.correlationMiddleware).toBe('function');
  });
  it('exports VERSION', () => {
    expect(typeof api.VERSION).toBe('string');
  });
});
