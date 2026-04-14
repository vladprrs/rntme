import { describe, it, expect } from 'vitest';
import { VERSION } from '../src/index.js';

describe('smoke', () => {
  it('exposes package version', () => {
    expect(VERSION).toBe('0.0.0');
  });

  it('re-exports the CommandResult built-ins', async () => {
    const pkg = await import('../src/index.js');
    expect(pkg.COMMAND_RESULT_SHAPE_NAME).toBe('CommandResult');
    expect(typeof pkg.commandResultShape).toBe('function');
    expect(typeof pkg.commandResultJsonSchema).toBe('function');
    expect(pkg.ERROR_CODES.BINDINGS_COMMAND_ON_NON_COMMAND_GRAPH).toBe(
      'BINDINGS_COMMAND_ON_NON_COMMAND_GRAPH',
    );
  });
});
