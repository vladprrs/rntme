import { describe, it, expect } from 'bun:test';
import { validateSemantic } from '../../../../src/validate/semantic/index.js';
import { normalize } from '../../../../src/canonical/normalize.js';
import type { AuthoringSpecOutput } from '../../../../src/parse/schema.js';
import { commercePdm as P, commerceQsm as Q } from '../../../fixtures/validated-commerce.js';

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
