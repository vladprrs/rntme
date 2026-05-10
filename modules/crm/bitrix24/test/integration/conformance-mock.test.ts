import { describe, expect, it } from 'bun:test';
import { suite as crmConformanceSuite } from '@rntme/conformance-crm';
import moduleManifest from '../../module.json' with { type: 'json' };
import { BITRIX24_SUPPORTED_RPCS } from '../../src/capabilities.js';

describe('Bitrix24 mock conformance selection', () => {
  it('claims only RPCs present in the shared CRM conformance suite', () => {
    const allCanonicalRpcs = Object.keys(crmConformanceSuite.scenarios);

    expect(moduleManifest.capabilities.rpcs).toEqual([...BITRIX24_SUPPORTED_RPCS]);
    for (const rpc of moduleManifest.capabilities.rpcs) {
      expect(allCanonicalRpcs).toContain(rpc);
    }
  });

  it('filters shared CRM conformance scenarios by claimed capabilities', () => {
    const scenariosByRpc = Object.fromEntries(BITRIX24_SUPPORTED_RPCS.map((rpc) => [rpc, crmConformanceSuite.scenarios[rpc] ?? []]));

    expect(Object.keys(scenariosByRpc).sort()).toEqual([...moduleManifest.capabilities.rpcs].sort());
    expect(Object.values(scenariosByRpc).every((scenarios) => scenarios.length > 0)).toBe(true);
  });

  it('does not claim canonical events until webhook translation is implemented', () => {
    expect(moduleManifest.capabilities.events).toEqual([]);
  });
});
