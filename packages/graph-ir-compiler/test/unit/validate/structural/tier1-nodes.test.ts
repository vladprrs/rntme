import { describe, it, expect } from 'vitest';
import { checkTier1Nodes } from '../../../../src/validate/structural/tier1-nodes.js';
import type { AuthoringSpecOutput } from '../../../../src/parse/schema.js';

function specWithNode(node: AuthoringSpecOutput['graphs'][string]['nodes'][number]): AuthoringSpecOutput {
  return {
    version: '1.0-rc7',
    pdmRef: 'x',
    qsmRef: 'y',
    shapes: {},
    graphs: {
      g: { id: 'g', signature: { inputs: {}, output: { type: 'x', from: node.id } }, nodes: [node] },
    },
  };
}

describe('checkTier1Nodes', () => {
  it('rejects distinct', () => {
    const errs = checkTier1Nodes(specWithNode({ id: 'd', type: 'distinct', config: { input: 'x' } }));
    expect(errs[0]?.code).toBe('TIER1_UNSUPPORTED_NODE');
  });

  it('rejects lookupOne', () => {
    const errs = checkTier1Nodes(
      specWithNode({
        id: 'l',
        type: 'lookupOne',
        config: { input: 'x', entity: 'Category', as: 'c', match: { id: 'categoryId' } },
      }),
    );
    expect(errs[0]?.code).toBe('TIER1_UNSUPPORTED_NODE');
  });

  it('accepts a supported findMany', () => {
    const errs = checkTier1Nodes(
      specWithNode({ id: 'f', type: 'findMany', config: { source: { entity: 'X' } } }),
    );
    expect(errs).toEqual([]);
  });

  it('rejects filter with predicate: (named predicate graphs not in MVP)', () => {
    const errs = checkTier1Nodes(
      specWithNode({ id: 'f', type: 'filter', config: { input: 'x', predicate: 'somePred' } }),
    );
    expect(errs[0]?.code).toBe('TIER1_UNSUPPORTED_NODE');
  });
});
