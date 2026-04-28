import { describe, expect, it } from 'vitest';
import { allErrorCodes } from '@rntme/contracts-identity-v1';
import {
  IDENTITY_CANONICAL_EVENTS,
  IDENTITY_CANONICAL_RPCS,
  IDENTITY_CAPABILITY_FIELDS,
  IDENTITY_SCENARIO_COVERAGE,
} from '../src/capabilities.js';
import { identityConformanceSuite } from '../src/suite.js';

describe('identity capability registry', () => {
  it('matches the suite RPC keys exactly', () => {
    expect([...IDENTITY_CANONICAL_RPCS]).toEqual(Object.keys(identityConformanceSuite.scenariosByRpc));
  });

  it('declares canonical capability fields needed by vendor modules', () => {
    expect(IDENTITY_CAPABILITY_FIELDS).toEqual([
      'vendors',
      'rpcs',
      'events',
      'entities',
      'session',
      'organization',
      'membership',
      'invitation',
      'webhook_events',
    ]);
  });

  it('tracks all canonical identity events for scenario coverage', () => {
    expect(IDENTITY_CANONICAL_EVENTS).toHaveLength(17);
    expect(IDENTITY_SCENARIO_COVERAGE.events.map((entry) => entry.event).sort()).toEqual(
      [...IDENTITY_CANONICAL_EVENTS].sort(),
    );
  });

  it('tracks all identity error codes for scenario coverage', () => {
    expect(IDENTITY_SCENARIO_COVERAGE.errorCodes.map((entry) => entry.code).sort()).toEqual(
      [...allErrorCodes].sort(),
    );
  });

  it('maps coverage placeholders only to canonical RPCs', () => {
    const canonicalRpcs = new Set(IDENTITY_CANONICAL_RPCS);
    for (const entry of [...IDENTITY_SCENARIO_COVERAGE.errorCodes, ...IDENTITY_SCENARIO_COVERAGE.events]) {
      expect(canonicalRpcs.has(entry.rpc), `${entry.rpc} must be a canonical RPC`).toBe(true);
    }
  });
});
