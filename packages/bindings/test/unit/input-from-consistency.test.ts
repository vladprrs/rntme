import { describe, it, expect } from 'vitest';
import { validateConsistency } from '../../src/validate/consistency.js';
import { ERROR_CODES } from '../../src/types/result.js';

function makeResolved(bindingId: string, entry: Record<string, unknown>, signature: Record<string, unknown>) {
  return {
    artifact: { version: '1.0', graphSpecRef: 'g', pdmRef: 'p', qsmRef: 'q' } as const,
    resolved: {
      [bindingId]: {
        entry: entry as import('../../src/types/artifact.js').BindingEntry,
        signature: signature as import('../../src/types/resolvers.js').GraphSignature,
        outputShape: { kind: 'row', shape: 'CommandResult' } as import('../../src/types/resolvers.js').ResolvedShape,
      },
    },
  } as unknown as import('../../src/types/artifact.js').ResolvedBindings;
}

describe('inputFrom consistency validation', () => {
  it('accepts inputFrom keys that match graph inputs', () => {
    const resolved = makeResolved('cb', {
      kind: 'command',
      graph: 'completeOAuth',
      target: { engine: 'graph-ir', dialect: 'sqlite' },
      http: { method: 'POST', path: '/oauth/callback', parameters: [] },
      inputFrom: {
        state: { from: 'query', name: 'state', required: true },
      },
    }, {
      id: 'completeOAuth',
      role: 'command',
      inputs: {
        state: { mode: 'required', type: { kind: 'scalar', name: 'string' } },
      },
      output: { type: { kind: 'row', shape: 'CommandResult' } },
    });
    const result = validateConsistency(resolved);
    expect(result.ok).toBe(true);
  });

  it('rejects inputFrom keys that do not match graph inputs', () => {
    const resolved = makeResolved('cb', {
      kind: 'command',
      graph: 'completeOAuth',
      target: { engine: 'graph-ir', dialect: 'sqlite' },
      http: { method: 'POST', path: '/oauth/callback', parameters: [] },
      inputFrom: {
        flowId: { from: 'query', name: 'flowId', required: true },
      },
    }, {
      id: 'completeOAuth',
      role: 'command',
      inputs: {
        state: { mode: 'required', type: { kind: 'scalar', name: 'string' } },
      },
      output: { type: { kind: 'row', shape: 'CommandResult' } },
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
