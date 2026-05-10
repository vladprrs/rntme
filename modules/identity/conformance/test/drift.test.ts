import { describe, it, expect } from 'bun:test';
import { IdentityModule } from '@rntme/contracts-identity-v1';
import { identityConformanceSuite } from '../src/suite.js';
import { readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function rpcsFromContract(): Set<string> {
  const names = new Set<string>();
  for (const key of Object.getOwnPropertyNames(IdentityModule.prototype)) {
    if (key === 'constructor') continue;
    const fn = (IdentityModule.prototype as unknown as Record<string, unknown>)[key];
    if (typeof fn !== 'function') continue;
    const rpcName = (fn as { name?: string }).name;
    if (rpcName && /^[A-Z][a-zA-Z0-9]*$/.test(rpcName)) names.add(rpcName);
  }
  return names;
}

function rpcsFromScenarioFiles(): Set<string> {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const dir = resolve(__dirname, '..', 'src', 'scenarios');
  return new Set(
    readdirSync(dir)
      .filter((f) => f.endsWith('.scenarios.ts'))
      .map((f) => f.replace(/\.scenarios\.ts$/, '')),
  );
}

function rpcsFromSuite(): Set<string> {
  return new Set(Object.keys(identityConformanceSuite.scenariosByRpc));
}

describe('drift detection', () => {
  it('every canonical RPC in IdentityModule has a matching scenarios file', () => {
    const contract = rpcsFromContract();
    const files = rpcsFromScenarioFiles();
    const missing = [...contract].filter((rpc) => !files.has(rpc));
    expect(missing, `missing scenarios files for: ${missing.join(', ')}`).toEqual([]);
  });

  it('every scenarios file maps to a canonical RPC (no orphan files)', () => {
    const contract = rpcsFromContract();
    const files = rpcsFromScenarioFiles();
    const orphans = [...files].filter((rpc) => !contract.has(rpc));
    expect(orphans, `orphan scenarios files: ${orphans.join(', ')}`).toEqual([]);
  });

  it('suite.scenariosByRpc keys exactly match scenarios files', () => {
    const files = rpcsFromScenarioFiles();
    const suiteKeys = rpcsFromSuite();
    const missingFromSuite = [...files].filter((rpc) => !suiteKeys.has(rpc));
    const orphanInSuite = [...suiteKeys].filter((rpc) => !files.has(rpc));
    expect(missingFromSuite, `scenarios files not registered in suite: ${missingFromSuite.join(', ')}`).toEqual([]);
    expect(orphanInSuite, `suite registers RPCs without scenarios files: ${orphanInSuite.join(', ')}`).toEqual([]);
  });
});
