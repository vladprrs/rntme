import { describe, it, expect } from 'vitest';
import { checkDag } from '../../../../src/validate/structural/dag.js';
import type { AuthoringSpecOutput } from '../../../../src/parse/schema.js';

function spec(nodes: AuthoringSpecOutput['graphs'][string]['nodes']): AuthoringSpecOutput {
  return {
    version: '1.0-rc7',
    pdmRef: 'x',
    qsmRef: 'y',
    shapes: {},
    graphs: {
      g: {
        id: 'g',
        signature: {
          inputs: {},
          output: { type: 'x', from: nodes[nodes.length - 1]?.id ?? 'x' },
        },
        nodes,
      },
    },
  };
}

describe('checkDag', () => {
  it('returns no errors for acyclic graph', () => {
    const s = spec([
      { id: 'a', type: 'findMany', config: { source: { entity: 'X' } } },
      { id: 'b', type: 'limit', config: { input: 'a', count: 1 } },
    ]);
    expect(checkDag(s)).toEqual([]);
  });

  it('returns empty for linear authoring spec even if labels repeat forward', () => {
    expect(
      checkDag(spec([{ id: 'a', type: 'findMany', config: { source: { entity: 'X' } } }])),
    ).toEqual([]);
  });
});
