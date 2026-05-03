import { describe, expect, it } from 'vitest';
import { CLI_VERSION } from '../../src/util/version.js';
import pkg from '../../package.json' assert { type: 'json' };

describe('CLI_VERSION', () => {
  it('matches apps/cli/package.json#version at runtime', () => {
    expect(CLI_VERSION).toBe((pkg as { version: string }).version);
    expect(CLI_VERSION).not.toBe('0.0.0');
  });
});
