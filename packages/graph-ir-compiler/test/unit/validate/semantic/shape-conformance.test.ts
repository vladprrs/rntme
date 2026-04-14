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

function spec(field: unknown): AuthoringSpecOutput {
  return {
    version: '1.0-rc7',
    pdmRef: 'x',
    qsmRef: 'y',
    shapes: { S: { fields: { total: { type: 'decimal', nullable: false } } } },
    graphs: {
      g: {
        id: 'g',
        signature: { inputs: {}, output: { type: 'rowset<S>', from: 'm' } },
        nodes: [
          { id: 'items', type: 'findMany', config: { source: { entity: 'OrderItem' } } },
          { id: 'm', type: 'map', config: { input: 'items', into: 'S', fields: { total: field } } },
        ],
      },
    },
  };
}

describe('map shape conformance', () => {
  it('accepts compatible numeric expr', () => {
    const s = spec({ mul: ['orderItem.unitPrice', 'orderItem.quantity'] });
    const { graphs } = normalize(s);
    expect(validateSemantic(graphs.g!, P, Q, s.shapes).ok).toBe(true);
  });

  it('rejects string expr for decimal field', () => {
    const s = spec({ $literal: 'nope' });
    const { graphs } = normalize(s);
    const r = validateSemantic(graphs.g!, P, Q, s.shapes);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.code).toBe('SEM_SHAPE_MISMATCH');
  });
});
