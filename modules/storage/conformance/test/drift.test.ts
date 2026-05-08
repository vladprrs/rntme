import { proto } from '@rntme/contracts-storage-v1';
import { describe, expect, it } from 'vitest';
import { STORAGE_CANONICAL_RPCS } from '../src/capabilities.js';
import { storageConformanceSuite } from '../src/suite.js';

function rpcNamesFromPrototype(): Set<string> {
  const Cons = proto.rntme.contracts.storage.v1.StorageModule;
  const names = new Set<string>();
  for (const key of Object.getOwnPropertyNames(Cons.prototype)) {
    if (key === 'constructor') continue;
    const fn = (Cons.prototype as unknown as Record<string, unknown>)[key];
    if (typeof fn !== 'function') continue;
    const name = (fn as { name?: string }).name;
    if (name && /^[A-Z][a-zA-Z0-9]*$/.test(name)) names.add(name);
  }
  return names;
}

describe('storage conformance UNION drift', () => {
  it('every canonical RPC has at least a stub scenario', () => {
    for (const rpc of STORAGE_CANONICAL_RPCS) {
      expect(storageConformanceSuite.scenariosByRpc[rpc], `${rpc} missing scenarios`).toBeDefined();
      expect(storageConformanceSuite.scenariosByRpc[rpc]?.length).toBeGreaterThan(0);
    }
  });

  it('every key in scenariosByRpc is a real RPC on StorageModule', () => {
    const rpcSet = rpcNamesFromPrototype();
    for (const k of Object.keys(storageConformanceSuite.scenariosByRpc)) {
      expect(rpcSet.has(k), `${k} is not an RPC on StorageModule`).toBe(true);
    }
  });
});
