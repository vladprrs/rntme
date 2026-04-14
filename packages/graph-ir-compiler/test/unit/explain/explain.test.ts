import { describe, it, expect } from 'vitest';
import { explain } from '../../../src/index.js';
import type { GraphIrError } from '../../../src/types/result.js';
import pdm from '../../e2e/fixtures/commerce.pdm.json' with { type: 'json' };
import qsm from '../../e2e/fixtures/commerce.qsm.json' with { type: 'json' };

const spec = {
  version: '1.0-rc7',
  pdmRef: 'x',
  qsmRef: 'y',
  shapes: {},
  graphs: {
    g: {
      id: 'g',
      signature: { inputs: {}, output: { type: 'rowset<OrderItem>', from: 'paged' } },
      nodes: [
        { id: 'items', type: 'findMany', config: { source: { entity: 'OrderItem' } } },
        { id: 'paged', type: 'limit', config: { input: 'items', count: 5 } },
      ],
    },
  },
};

describe('explain', () => {
  it('returns stages up to lowering on success', () => {
    const r = explain(spec, pdm, qsm);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.canonical.graphs.g!.nodes[0]!.kind).toBe('findMany');
      expect(r.value.semanticPlan.steps.map((s: { kind: string }) => s.kind)).toEqual(['scan', 'limit']);
      expect(r.value.relational.op).toBe('Limit');
      expect(r.value.sql).toContain('SELECT');
      expect(r.value.paramOrder).toEqual([]);
    }
  });

  it('returns partial artifacts on failure', () => {
    const bad = {
      ...spec,
      graphs: {
        g: {
          ...spec.graphs.g,
          signature: { inputs: {}, output: { type: 'x', from: 'ghost' } },
        },
      },
    };
    const r = explain(bad, pdm, qsm);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.artifacts.parsed?.version).toBe('1.0-rc7');
      expect(r.artifacts.canonical).toBeUndefined();
      expect(r.errors.some((e: GraphIrError) => e.code === 'STRUCT_INVALID_OUTPUT_FROM')).toBe(true);
    }
  });
});
