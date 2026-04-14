import { describe, it, expect } from 'vitest';
import { compile } from '../../src/index.js';
import { PdmSchema } from '../../src/types/pdm.js';
import { QsmSchema } from '../../src/types/qsm.js';
import pdm from '../e2e/fixtures/commerce.pdm.json' with { type: 'json' };
import qsm from '../e2e/fixtures/commerce.qsm.json' with { type: 'json' };

const P = PdmSchema.parse(pdm);
const Q = QsmSchema.parse(qsm);

const spec = {
  version: '1.0-rc7' as const,
  pdmRef: 'x',
  qsmRef: 'y',
  shapes: {},
  graphs: {
    g: {
      id: 'g',
      signature: { inputs: {}, output: { type: 'rowset<OrderItem>', from: 'paged' } },
      nodes: [
        { id: 'items', type: 'findMany' as const, config: { source: { entity: 'OrderItem' } } },
        { id: 'paged', type: 'limit' as const, config: { input: 'items', count: 10 } },
      ],
    },
  },
};

describe('compile end-to-end (minimal)', () => {
  it('produces SQL for findMany + limit', () => {
    const r = compile(spec, P, Q);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.sql).toContain('SELECT');
      expect(r.value.sql).toContain('FROM "order_items"');
      expect(r.value.sql).toContain('LIMIT 10');
      expect(r.value.paramOrder).toEqual([]);
    }
  });

  it('surfaces structural errors', () => {
    const bad = {
      ...spec,
      graphs: {
        ...spec.graphs,
        g: {
          ...spec.graphs.g,
          signature: { inputs: {}, output: { type: 'rowset<OrderItem>', from: 'ghost' } },
        },
      },
    };
    const r = compile(bad, P, Q);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.code === 'STRUCT_INVALID_OUTPUT_FROM')).toBe(true);
  });
});
