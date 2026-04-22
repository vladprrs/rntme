import { describe, it, expect } from 'vitest';
import { validateConsistency } from '../../src/validate/consistency.js';
import type { ResolvedBindings, ResolvedBinding, BindingEntry, PreStep } from '../../src/types/artifact.js';
import type { GraphSignature } from '../../src/types/resolvers.js';

const makeResolvedWithPre = (pre: PreStep[]): ResolvedBindings => {
  const entry: BindingEntry = {
    kind: 'command',
    graph: 'g',
    target: { engine: 'sqlite', dialect: 'sqlite' },
    http: {
      method: 'POST',
      path: '/v1/things',
      parameters: [],
    },
    pre,
  };
  const signature: GraphSignature = {
    id: 'g',
    role: 'command',
    inputs: {},
    output: { type: { kind: 'row', shape: 'CommandResult' }, from: 'x' },
  };
  const binding: ResolvedBinding = {
    entry,
    signature,
    outputShape: {
      name: 'CommandResult',
      origin: 'custom',
      fields: {},
    },
  };
  return {
    artifact: {
      version: '1.0',
      graphSpecRef: 'x',
      pdmRef: 'y',
      qsmRef: 'z',
      bindings: { cmd: entry },
    },
    resolved: { cmd: binding },
  } as unknown as ResolvedBindings;
};

describe('pre[] consistency validation', () => {
  it('accepts pre-step whose module is in declaredModules', () => {
    const r = validateConsistency(
      makeResolvedWithPre([
        { kind: 'module-rpc', module: 'myModule', rpc: 'doThing', input: {}, bindAs: 'result' },
      ]),
      { declaredModules: new Set(['myModule']) },
    );
    expect(r.ok).toBe(true);
  });

  it('rejects pre-step whose module is not in declaredModules', () => {
    const r = validateConsistency(
      makeResolvedWithPre([
        { kind: 'module-rpc', module: 'unknownModule', rpc: 'doThing', input: {}, bindAs: 'result' },
      ]),
      { declaredModules: new Set() },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some((e) => e.code === 'BINDINGS_CONSISTENCY_PRE_MODULE_NOT_DECLARED')).toBe(true);
    }
  });

  it('rejects pre-step module when no declaredModules provided', () => {
    const r = validateConsistency(
      makeResolvedWithPre([
        { kind: 'module-rpc', module: 'anyModule', rpc: 'doThing', input: {}, bindAs: 'result' },
      ]),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some((e) => e.code === 'BINDINGS_CONSISTENCY_PRE_MODULE_NOT_DECLARED')).toBe(true);
    }
  });

  it('ignores non-module-rpc pre steps', () => {
    const r = validateConsistency(
      makeResolvedWithPre([
        { kind: 'system', op: 'randomBytes', bytes: 16, bindAs: 'salt' },
      ]),
      { declaredModules: new Set() },
    );
    expect(r.ok).toBe(true);
  });
});
