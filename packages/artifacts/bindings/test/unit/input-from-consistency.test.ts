import { describe, it, expect } from 'bun:test';
import { validateConsistency } from '../../src/validate/consistency.js';
import { ERROR_CODES } from '../../src/types/result.js';
import type { BindingEntry, ResolvedBindings } from '../../src/types/artifact.js';
import type { GraphSignature, ResolvedShape } from '../../src/types/resolvers.js';

function makeResolved(bindingId: string, entry: Record<string, unknown>, signature: Record<string, unknown>) {
  return {
    artifact: { version: '1.0', graphSpecRef: 'g', pdmRef: 'p', qsmRef: 'q' } as const,
    resolved: {
      [bindingId]: {
        entry: entry as BindingEntry,
        signature: signature as GraphSignature,
        outputShape: { name: 'CallbackResult', origin: 'custom', fields: {} } as ResolvedShape,
      },
    },
  } as unknown as ResolvedBindings;
}

describe('inputFrom consistency validation', () => {
  it('accepts inputFrom keys that match graph inputs', () => {
    const resolved = makeResolved('cb', {
      exposure: 'action',
      graph: 'completeOAuth',
      target: { engine: 'graph-ir', dialect: 'sqlite' },
      http: { method: 'POST', path: '/oauth/callback', parameters: [] },
      inputFrom: {
        state: { from: 'query', name: 'state', required: true },
      },
    }, {
      id: 'completeOAuth',
      inputs: {
        state: { mode: 'required', type: { kind: 'scalar', primitive: 'string' } },
      },
      output: { type: { kind: 'row', shape: 'CallbackResult' }, from: 'result' },
      effects: { localReads: false, localEmits: [], calls: [], waits: false },
    });
    const result = validateConsistency(resolved);
    expect(result.ok).toBe(true);
  });

  it('rejects inputFrom keys that do not match graph inputs', () => {
    const resolved = makeResolved('cb', {
      exposure: 'action',
      graph: 'completeOAuth',
      target: { engine: 'graph-ir', dialect: 'sqlite' },
      http: { method: 'POST', path: '/oauth/callback', parameters: [] },
      inputFrom: {
        flowId: { from: 'query', name: 'flowId', required: true },
      },
    }, {
      id: 'completeOAuth',
      inputs: {
        state: { mode: 'required', type: { kind: 'scalar', primitive: 'string' } },
      },
      output: { type: { kind: 'row', shape: 'CallbackResult' }, from: 'result' },
      effects: { localReads: false, localEmits: [], calls: [], waits: false },
    });
    const result = validateConsistency(resolved);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const inputFromError = result.errors.find((e) => e.code === ERROR_CODES.BINDINGS_CONSISTENCY_INPUT_FROM_UNKNOWN_INPUT);
      expect(inputFromError).toBeDefined();
      expect(inputFromError!.message).toContain('flowId');
    }
  });
});
