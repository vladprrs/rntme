import { describe, it, expect } from 'bun:test';
import { buildSemanticPlan } from '../../../src/semantic-plan/build.js';
import { normalize } from '../../../src/canonical/normalize.js';
import type { AuthoringSpecOutput } from '../../../src/parse/schema.js';
import { commercePdm as P, commerceQsm as Q } from '../../fixtures/validated-commerce.js';

const spec: AuthoringSpecOutput = {
  version: '1.0-rc7',
  pdmRef: 'x',
  qsmRef: 'y',
  shapes: {
    OrderStats: { fields: { n: { type: 'integer', nullable: false } } },
  },
  graphs: {
    g: {
      id: 'g',
      signature: { inputs: {}, output: { type: 'rowset<OrderStats>', from: 'agg' } },
      nodes: [
        { id: 'events', type: 'findMany', config: { source: { eventType: 'OrderCreate' } } },
        {
          id: 'agg',
          type: 'reduce',
          config: {
            input: 'events',
            into: 'OrderStats',
            group: {},
            measures: { n: { fn: 'count' } },
          },
        },
      ],
    },
  },
};

describe('buildSemanticPlan — event source', () => {
  it('produces a scan on event_log for findMany { eventType }', () => {
    const { graphs } = normalize(spec);
    const r = buildSemanticPlan(graphs.g!, P, Q);
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const steps = r.value.steps;
    expect(steps[0]?.kind).toBe('scan');
    const scan = steps[0] as Extract<(typeof steps)[number], { kind: 'scan' }>;
    expect(scan.table).toBe('event_log');

    // Scan-level constant predicate on event_type, as a literal (not a param).
    expect(scan.where).toBeDefined();
    expect(scan.where).toEqual({ kind: 'eq_literal', column: 'event_type', value: 'OrderCreate' });

    // Virtual columns surfaced for the scan.
    const names = scan.fields.map((f) => f.name);
    expect(names).toContain('aggregateId');
    expect(names).toContain('occurredAt');
    expect(names).toContain('actorId');
    // OrderCreate payloadFields include createdAt (and the state field `status`).
    expect(names).toContain('createdAt');

    const aggId = scan.fields.find((f) => f.name === 'aggregateId');
    expect(aggId?.column).toBe('aggregate_id');
    // Order.id is integer.
    expect(aggId?.type).toBe('integer');

    const occ = scan.fields.find((f) => f.name === 'occurredAt');
    expect(occ?.column).toBe('occurred_at');
    expect(occ?.type).toBe('datetime');

    const actor = scan.fields.find((f) => f.name === 'actorId');
    expect(actor?.column).toBe('actor_id');
    expect(actor?.nullable).toBe(true);

    // Payload field exposed via json_extract descriptor.
    const createdAt = scan.fields.find((f) => f.name === 'createdAt');
    expect(createdAt?.sql).toEqual({
      fn: 'json_extract',
      column: 'payload_json',
      jsonPath: '$.createdAt',
    });
  });
});
