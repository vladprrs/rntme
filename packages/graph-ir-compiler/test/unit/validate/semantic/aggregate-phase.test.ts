import { describe, it, expect } from 'vitest';
import { validateSemantic } from '../../../../src/validate/semantic/index.js';
import { normalize } from '../../../../src/canonical/normalize.js';
import { PdmSchema } from '../../../../src/types/pdm.js';
import { QsmSchema } from '../../../../src/types/qsm.js';
import pdm from '../../../e2e/fixtures/commerce.pdm.json' with { type: 'json' };
import qsm from '../../../e2e/fixtures/commerce.qsm.json' with { type: 'json' };
import type { AuthoringSpecOutput } from '../../../../src/parse/schema.js';

const P = PdmSchema.parse(pdm);
const Q = QsmSchema.parse(qsm);

type ReduceFn = 'count' | 'count_distinct' | 'sum' | 'avg' | 'min' | 'max' | 'group_array';

function spec(reduceCfg: {
  input: string;
  into: string;
  group: Record<string, string>;
  measures: Record<string, { fn: ReduceFn; expr?: unknown }>;
}): AuthoringSpecOutput {
  return {
    version: '1.0-rc7',
    pdmRef: 'x',
    qsmRef: 'y',
    shapes: {
      Agg: {
        fields: {
          categoryId: { type: 'integer', nullable: false },
          revenue: { type: 'decimal', nullable: false },
          lineCount: { type: 'integer', nullable: false },
        },
      },
    },
    graphs: {
      g: {
        id: 'g',
        signature: { inputs: {}, output: { type: 'rowset<Agg>', from: 'r' } },
        nodes: [
          { id: 'items', type: 'findMany', config: { source: { entity: 'OrderItem' } } },
          { id: 'r', type: 'reduce', config: reduceCfg },
        ],
      },
    },
  };
}

describe('reduce validation', () => {
  it('accepts valid reduce', () => {
    const s = spec({
      input: 'items',
      into: 'Agg',
      group: { categoryId: 'orderItem.productId' },
      measures: {
        revenue: { fn: 'sum', expr: { mul: ['orderItem.unitPrice', 'orderItem.quantity'] } },
        lineCount: { fn: 'count' },
      },
    });
    const { graphs } = normalize(s);
    expect(validateSemantic(graphs.g!, P, Q, s.shapes).ok).toBe(true);
  });

  it('allows integer measure type to widen to decimal shape field for sum', () => {
    const s = spec({
      input: 'items',
      into: 'Agg',
      group: { categoryId: 'orderItem.productId' },
      measures: {
        revenue: { fn: 'sum', expr: 'orderItem.productId' },
        lineCount: { fn: 'count' },
      },
    });
    const { graphs } = normalize(s);
    const r = validateSemantic(graphs.g!, P, Q, s.shapes);
    expect(r.ok).toBe(true);
  });
});
