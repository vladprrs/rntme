import { describe, it, expect } from 'vitest';
import { buildSemanticPlan } from '../../../src/semantic-plan/build.js';
import { normalize } from '../../../src/canonical/normalize.js';
import type { AuthoringSpecOutput } from '../../../src/parse/schema.js';
import { commercePdm as P, commerceQsm as Q } from '../../fixtures/validated-commerce.js';

const spec: AuthoringSpecOutput = {
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

describe('buildSemanticPlan', () => {
  it('produces a scan and limit phase', () => {
    const { graphs } = normalize(spec);
    const r = buildSemanticPlan(graphs.g!, P, Q);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.outputNodeId).toBe('paged');
      expect(r.value.steps.map((s) => s.kind)).toEqual(['scan', 'limit']);
    }
  });
});
