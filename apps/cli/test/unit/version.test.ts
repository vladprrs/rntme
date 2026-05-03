import { describe, expect, it } from 'vitest';
import { CLI_VERSION } from '../../src/util/version.js';
import pkg from '../../package.json' assert { type: 'json' };

describe('CLI_VERSION', () => {
  // Pre-build: source has placeholder; post-build (CI), it equals pkg.version.
  it('is the placeholder OR matches package.json#version', () => {
    expect([(pkg as { version: string }).version, '__CLI_VERSION__']).toContain(CLI_VERSION);
  });
});
