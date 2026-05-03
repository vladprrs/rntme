import { describe, expect, it } from 'vitest';
import { lookupHelp, registerHelp } from '../../src/help/registry.js';

describe('help registry', () => {
  it('returns the registered help for a subcommand path', () => {
    registerHelp(['project', 'deploy'], 'Usage: rntme project deploy --version <seq> --target <slug>');
    expect(lookupHelp(['project', 'deploy'])).toContain('--version');
  });

  it('returns null for an unregistered path', () => {
    expect(lookupHelp(['totally', 'unknown'])).toBeNull();
  });
});
