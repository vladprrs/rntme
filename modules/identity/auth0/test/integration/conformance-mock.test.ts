import { describe, expect, it } from 'bun:test';
import { identityConformanceSuite } from '@rntme/conformance-identity';
import { CLAIMED_RPCS } from '../../src/capabilities.js';
import { auth0MockConformanceSuite } from '../../src/conformance.js';
import { introspectSessionMockScenarios } from './conformance/introspect-session.scenarios.js';

describe('Auth0 mock conformance selection', () => {
  it('imports the identity conformance suite and filters to claimed RPCs', () => {
    expect(identityConformanceSuite.category).toBe('identity');
    expect(auth0MockConformanceSuite.category).toBe('identity');
    expect(Object.keys(auth0MockConformanceSuite.scenariosByRpc).sort()).toEqual([...CLAIMED_RPCS].sort());
  });

  it.each([...introspectSessionMockScenarios()])('runs focused IntrospectSession mock scenario: $name', async (scenario) => {
    await scenario.run();
  });
});
