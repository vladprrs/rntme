import { describe, expect, it } from 'bun:test';
import {
  compileProjectionGraph,
  compileProjectionGraphFromValidated,
  parseAuthoringSpec,
  type AuthoringSpecOutput,
} from '../../src/index.js';
import pdm from '../e2e/fixtures/commerce.pdm.json' with { type: 'json' };
import qsm from '../e2e/fixtures/commerce.qsm.json' with { type: 'json' };
import { loadValidatedPdmAndQsm } from '../load-validated.js';

const happyPathSpec = {
  version: '1.0-rc7',
  pdmRef: 'commerce',
  qsmRef: 'commerce',
  shapes: {
    OrderCounts: {
      fields: {
        agg: { type: 'integer', nullable: false },
        n: { type: 'integer', nullable: false },
      },
    },
  },
  graphs: {
    resolvedOrderCount: {
      id: 'resolvedOrderCount',
      signature: {
        inputs: {},
        output: { type: 'rowset<OrderCounts>', from: 'r' },
      },
      nodes: [
        { id: 's', type: 'findMany', config: { source: { eventType: 'OrderCreate' } } },
        {
          id: 'r',
          type: 'reduce',
          config: {
            input: 's',
            into: 'OrderCounts',
            group: { agg: 'orderCreate.aggregateId' },
            measures: { n: { fn: 'count' } },
          },
        },
      ],
    },
  },
};

const unsupportedAggSpec = {
  version: '1.0-rc7',
  pdmRef: 'commerce',
  qsmRef: 'commerce',
  shapes: {
    OrderMin: {
      fields: {
        agg: { type: 'integer', nullable: false },
        m: { type: 'datetime', nullable: false },
      },
    },
  },
  graphs: {
    orderMin: {
      id: 'orderMin',
      signature: {
        inputs: {},
        output: { type: 'rowset<OrderMin>', from: 'r' },
      },
      nodes: [
        { id: 's', type: 'findMany', config: { source: { eventType: 'OrderCreate' } } },
        {
          id: 'r',
          type: 'reduce',
          config: {
            input: 's',
            into: 'OrderMin',
            group: { agg: 'orderCreate.aggregateId' },
            measures: { m: { fn: 'min', expr: 'orderCreate.occurredAt' } },
          },
        },
      ],
    },
  },
};

function parseSpec(raw: unknown): AuthoringSpecOutput {
  const parsed = parseAuthoringSpec(raw);
  expect(parsed.ok).toBe(true);
  if (!parsed.ok) {
    throw new Error(JSON.stringify(parsed.errors));
  }
  return parsed.value;
}

describe('compileProjectionGraph', () => {
  it('happy path: OrderCreate count-per-aggregate produces a DerivedCompileResult', () => {
    const r = compileProjectionGraph(happyPathSpec, pdm, qsm, {
      graphId: 'resolvedOrderCount',
      projectionTable: 'projection_resolved_order',
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(r.value.eventType).toBe('OrderCreate');
    expect(r.value.aggregateType).toBe('Order');
    expect(r.value.tableSchema.tableName).toBe('projection_resolved_order');
    expect(r.value.tableSchema.groupColumns).toHaveLength(1);
    expect(r.value.tableSchema.measureColumns).toHaveLength(1);
    expect(r.value.filter).toBeNull();
    expect(r.value.deltaSql).toContain('INSERT INTO "projection_resolved_order"');
    expect(r.value.bootstrapSql).toContain(`"event_type" = 'OrderCreate'`);
  });

  it('rejects unsupported aggregate (min) with PROJ_SEMANTIC_UNSUPPORTED_AGG', () => {
    const r = compileProjectionGraph(unsupportedAggSpec, pdm, qsm, {
      graphId: 'orderMin',
      projectionTable: 'projection_order_min',
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.some((e) => e.code === 'PROJ_SEMANTIC_UNSUPPORTED_AGG')).toBe(true);
  });

  it('compiles from an already parsed spec plus validated PDM/QSM artifacts', () => {
    const spec = parseSpec(happyPathSpec);
    const validated = loadValidatedPdmAndQsm(pdm, qsm);
    const r = compileProjectionGraphFromValidated(spec, validated.pdm, validated.qsm, {
      graphId: 'resolvedOrderCount',
      projectionTable: 'projection_resolved_order',
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(r.value.eventType).toBe('OrderCreate');
    expect(r.value.tableSchema.tableName).toBe('projection_resolved_order');
    expect(r.value.bootstrapSql).toContain(`"event_type" = 'OrderCreate'`);
  });
});
