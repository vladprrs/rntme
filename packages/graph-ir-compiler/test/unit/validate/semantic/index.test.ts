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

function specWithFilter(expr: unknown, inputs: Record<string, unknown> = {}): AuthoringSpecOutput {
  return {
    version: '1.0-rc7',
    pdmRef: 'x',
    qsmRef: 'y',
    shapes: {},
    graphs: {
      g: {
        id: 'g',
        signature: { inputs, output: { type: 'rowset<OrderItem>', from: 'f' } },
        nodes: [
          { id: 'items', type: 'findMany', config: { source: { entity: 'OrderItem' } } },
          { id: 'f', type: 'filter', config: { input: 'items', expr } },
        ],
      },
    },
  } as AuthoringSpecOutput;
}

describe('validateSemantic (with filter)', () => {
  it('accepts filter with required param', () => {
    const s = specWithFilter(
      { gte: ['orderItem.unitPrice', { $param: 'minPrice' }] },
      { minPrice: { type: 'decimal', mode: 'required' } },
    );
    const { graphs } = normalize(s);
    const r = validateSemantic(graphs.g!, P, Q);
    expect(r.ok).toBe(true);
  });

  it('rejects $param referencing unknown input', () => {
    const s = specWithFilter({ gte: ['orderItem.unitPrice', { $param: 'ghost' }] });
    const { graphs } = normalize(s);
    const r = validateSemantic(graphs.g!, P, Q);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.code).toBe('SEM_PARAM_UNKNOWN');
  });

  it('rejects boolean-incompatible filter expr', () => {
    const s = specWithFilter('orderItem.unitPrice');
    const { graphs } = normalize(s);
    const r = validateSemantic(graphs.g!, P, Q);
    expect(r.ok).toBe(false);
  });
});
