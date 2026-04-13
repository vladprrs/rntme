import { describe, it, expect } from 'vitest';
import { buildRelational } from '../../../src/relational/build.js';
import type { SemanticPlan } from '../../../src/types/semantic-plan.js';

const plan: SemanticPlan = {
  graphId: 'g',
  outputNodeId: 'paged',
  outputShape: 'rowset<OrderItem>',
  cardinality: 'rowset',
  steps: [
    {
      kind: 'scan',
      nodeId: 'items',
      table: 'order_items',
      alias: 'orderItem',
      fields: [{ name: 'id', column: 'id', type: 'integer', nullable: false }],
    },
    { kind: 'limit', nodeId: 'paged', count: 10 },
  ],
};

describe('buildRelational', () => {
  it('wraps scan in Limit when a limit step follows', () => {
    const rel = buildRelational(plan);
    expect(rel.op).toBe('Limit');
    if (rel.op === 'Limit') {
      expect(rel.child.op).toBe('Scan');
    }
  });
});
