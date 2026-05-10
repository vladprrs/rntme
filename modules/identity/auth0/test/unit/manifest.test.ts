import { describe, expect, it } from 'bun:test';
import manifest from '../../module.json' with { type: 'json' };
import { CLAIMED_EVENTS, CLAIMED_RPCS, SESSION_RPCS } from '../../src/capabilities.js';

describe('module manifest capability honesty', () => {
  it('declares Auth0 as an identity/v1 vendor module', () => {
    expect(manifest).toMatchObject({
      name: '@rntme/identity-auth0',
      category: 'identity',
      vendor: 'auth0',
      contract: 'identity/v1',
    });
  });

  it('claims only implemented RPCs and excludes session RPCs', () => {
    expect(manifest.capabilities.rpcs).toEqual([...CLAIMED_RPCS]);
    for (const rpc of SESSION_RPCS) {
      expect(manifest.capabilities.rpcs).not.toContain(rpc);
    }
    expect(manifest.capabilities.rpcs).not.toContain('UpdateMembership');
  });

  it('documents Auth0-specific limitations', () => {
    expect(manifest.limitations.join('\n')).toContain('sessions');
    expect(manifest.limitations.join('\n')).toContain('metadata');
    expect(manifest.capabilities.events).toEqual([...CLAIMED_EVENTS]);
  });

  it('does not claim user update events without a log translator', () => {
    expect(manifest.capabilities.events).not.toContain('UserUpdated');
  });
});
