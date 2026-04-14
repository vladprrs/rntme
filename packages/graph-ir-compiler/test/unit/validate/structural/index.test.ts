import { describe, it, expect } from 'vitest';
import { validateStructural } from '../../../../src/validate/structural/index.js';
import type { AuthoringSpecOutput } from '../../../../src/parse/schema.js';
import { loadValidatedPdmAndQsm } from '../../../load-validated.js';
import pdm from '../../../e2e/fixtures/commerce.pdm.json' with { type: 'json' };
import qsm from '../../../e2e/fixtures/commerce.qsm.json' with { type: 'json' };

const { pdm: P, qsm: Q } = loadValidatedPdmAndQsm(pdm, qsm);

const good: AuthoringSpecOutput = {
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
        { id: 'paged', type: 'limit', config: { input: 'items', count: 10 } },
      ],
    },
  },
};

describe('validateStructural', () => {
  it('passes a good spec', () => {
    expect(validateStructural(good, P, Q)).toEqual({ ok: true, value: good });
  });

  it('accumulates errors from multiple rules', () => {
    const bad: AuthoringSpecOutput = {
      ...good,
      graphs: {
        g: {
          id: 'g',
          signature: { inputs: {}, output: { type: 'rowset<OrderItem>', from: 'ghost' } },
          nodes: [
            { id: 'a', type: 'distinct', config: { input: 'a' } },
            { id: 'a', type: 'findMany', config: { source: { entity: 'X' } } },
          ],
        },
      },
    };
    const r = validateStructural(bad, P, Q);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const codes = new Set(r.errors.map((e) => e.code));
      expect(codes).toContain('STRUCT_DUPLICATE_NODE_ID');
      expect(codes).toContain('STRUCT_INVALID_OUTPUT_FROM');
      expect(codes).toContain('TIER1_UNSUPPORTED_NODE');
    }
  });
});
