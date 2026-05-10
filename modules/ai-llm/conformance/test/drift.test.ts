import { describe, expect, it } from 'bun:test';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { proto } from '@rntme/contracts-ai-llm-v1';
import { AI_LLM_CANONICAL_RPCS, aiLlmConformanceSuite } from '../src/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const scenariosDir = resolve(here, '../src/scenarios');

function rpcsFromContract(): Set<string> {
  const ns = proto.rntme.contracts.ai_llm.v1 as Record<string, unknown>;
  const ServiceCtor = ns['AiLlmModule'] as { prototype: Record<string, unknown> };
  expect(ServiceCtor, 'AiLlmModule service descriptor missing').toBeDefined();
  const names = new Set<string>();
  // protobufjs static-module emits lower-camel prototype methods whose function
  // names preserve proto RPC casing, which matches the Identity conformance drift test.
  for (const key of Object.getOwnPropertyNames(ServiceCtor.prototype)) {
    if (key === 'constructor') continue;
    const fn = ServiceCtor.prototype[key];
    if (typeof fn !== 'function') continue;
    const rpcName = (fn as { name?: string }).name;
    if (rpcName && /^[A-Z][a-zA-Z0-9]*$/.test(rpcName)) names.add(rpcName);
  }
  return names;
}

describe('AI/LLM conformance drift detector', () => {
  it('every canonical RPC has a matching scenario file', () => {
    const filenames = readdirSync(scenariosDir).filter((n) => n.endsWith('.scenarios.ts'));
    const rpcNamesFromFiles = filenames.map((n) => n.replace('.scenarios.ts', '')).sort();
    const expected = [...AI_LLM_CANONICAL_RPCS].sort();
    expect(rpcNamesFromFiles).toEqual(expected);
  });

  it('every scenario file is wired in suite.ts', () => {
    const filenames = readdirSync(scenariosDir).filter((n) => n.endsWith('.scenarios.ts'));
    const rpcNamesFromFiles = filenames.map((n) => n.replace('.scenarios.ts', ''));
    const wiredKeys = Object.keys(aiLlmConformanceSuite.scenariosByRpc);
    expect(wiredKeys.sort()).toEqual(rpcNamesFromFiles.sort());
  });

  it('AI_LLM_CANONICAL_RPCS matches the canonical contract service', () => {
    expect([...rpcsFromContract()].sort()).toEqual([...AI_LLM_CANONICAL_RPCS].sort());
  });

  it('suite metadata is fixed', () => {
    expect(aiLlmConformanceSuite.category).toBe('ai-llm');
    expect(aiLlmConformanceSuite.contractVersion).toBe('v1');
  });
});
