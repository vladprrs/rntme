import { describe, it, expect } from 'vitest';
import { explain } from '../../src/index.js';
import pdm from '../e2e/fixtures/commerce.pdm.json' with { type: 'json' };
import qsm from '../e2e/fixtures/commerce.qsm.json' with { type: 'json' };

// Query-role graph (no reduce, no inputs) so the scan's SELECT — including json_extract virtual
// columns — survives through lowering. Reduce-count would elide those columns, so we pick a
// shape that exercises scan SELECT directly.
const scanOnlySpec = {
  version: '1.0-rc7',
  pdmRef: 'x',
  qsmRef: 'y',
  shapes: {},
  graphs: {
    g: {
      id: 'g',
      signature: { inputs: {}, output: { type: 'rowset<OrderEvent>', from: 'events' } },
      nodes: [
        { id: 'events', type: 'findMany', config: { source: { eventType: 'OrderCreate' } } },
      ],
    },
  },
};

// Projection-role graph (rootFindMany + reduce + rowset + !emit) to prove that event-source
// scan + reduce-count compiles cleanly through the `explain()` pipeline end-to-end.
const reduceCountSpec = {
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

describe('explain — event source', () => {
  it('scan-only: SELECT surfaces FROM event_log + event_type literal + json_extract payload', () => {
    const r = explain(scanOnlySpec, pdm, qsm);
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const sql = r.value.sql;
    expect(sql).toContain('FROM "event_log"');
    // Scan-level equality predicate on event_type as a SQL literal, not a param.
    expect(sql).toContain(`"event_type" = 'OrderCreate'`);
    // Payload is exposed via json_extract(payload_json, '$.<field>').
    expect(sql).toMatch(/json_extract\("[^"]+"\."payload_json",\s*'\$\.[A-Za-z]+'\)/);
    expect(r.value.paramOrder).toEqual([]);
  });

  it('reduce-count: projection-role graph lowers cleanly with event_type predicate', () => {
    const r = explain(reduceCountSpec, pdm, qsm);
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const sql = r.value.sql;
    expect(sql).toContain('FROM "event_log"');
    expect(sql).toContain(`"event_type" = 'OrderCreate'`);
    expect(sql).toContain('COUNT(*)');
    expect(r.value.paramOrder).toEqual([]);
  });
});
