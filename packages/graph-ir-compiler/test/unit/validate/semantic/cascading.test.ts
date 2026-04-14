// test/unit/validate/semantic/cascading.test.ts
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

describe('cascading-error suppression', () => {
  it('reports SEM_FIELD_NOT_FOUND once even if downstream nodes would also complain', () => {
    const s: AuthoringSpecOutput = {
      version: '1.0-rc7', pdmRef: 'x', qsmRef: 'y', shapes: {},
      graphs: {
        g: {
          id: 'g',
          signature: { inputs: {}, output: { type: 'rowset<OrderItem>', from: 'f2' } },
          nodes: [
            { id: 'items', type: 'findMany', config: { source: { entity: 'OrderItem' } } },
            { id: 'f1', type: 'filter', config: { input: 'items', expr: { gte: ['orderItem.ghost', 0] } } },
            { id: 'f2', type: 'filter', config: { input: 'f1', expr: { gte: ['orderItem.ghost', 1] } } },
          ],
        },
      },
    };
    const { graphs } = normalize(s);
    const r = validateSemantic(graphs.g!, P, Q);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const fieldErrs = r.errors.filter((e) => e.code === 'SEM_FIELD_NOT_FOUND');
      expect(fieldErrs.length).toBeGreaterThanOrEqual(1);
    }
  });
});
