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

  it('detects a cycle between two nodes', () => {
    const s = spec([
      { id: 'a', type: 'limit', config: { input: 'b', count: 1 } },
      { id: 'b', type: 'limit', config: { input: 'a', count: 1 } },
    ]);
    const errs = checkDag(s);
    expect(errs[0]?.code).toBe('STRUCT_DAG_CYCLE');
  });
});
