import { describe, it, expect } from 'vitest';
import { identityConformanceSuite, suite } from '../src/suite.js';

describe('identityConformanceSuite', () => {
  it('declares category=identity, contractVersion=v1', () => {
    expect(identityConformanceSuite.category).toBe('identity');
    expect(identityConformanceSuite.contractVersion).toBe('v1');
  });

  it('exports a generic suite alias for template-based consumers', () => {
    expect(suite).toBe(identityConformanceSuite);
  });

  it('contains exactly 24 RPC entries', () => {
    expect(Object.keys(identityConformanceSuite.scenariosByRpc).length).toBe(24);
  });

  it('every scenarios entry is an array (empty stubs OK at this stage)', () => {
    for (const [rpc, scenarios] of Object.entries(identityConformanceSuite.scenariosByRpc)) {
      expect(Array.isArray(scenarios), `${rpc} scenarios must be an array`).toBe(true);
    }
  });
});
