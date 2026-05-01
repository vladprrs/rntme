import { describe, it, expect } from 'vitest';
import { compile, explain, GraphIrCompileError, run } from '../../src/index.js';
import { commercePdm as P, commerceQsm as Q } from '../fixtures/validated-commerce.js';

const spec = {
  version: '1.0-rc7' as const,
  pdmRef: 'x',
  qsmRef: 'y',
  shapes: {},
  graphs: {
    g: {
      id: 'g',
      signature: { inputs: {}, output: { type: 'rowset<OrderItem>', from: 'paged' } },
      nodes: [
        { id: 'items', type: 'findMany' as const, config: { source: { entity: 'OrderItem' } } },
        { id: 'paged', type: 'limit' as const, config: { input: 'items', count: 10 } },
      ],
    },
  },
};

describe('compile end-to-end (minimal)', () => {
  it('produces SQL for findMany + limit', () => {
    const r = compile(spec, P, Q);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.sql).toContain('SELECT');
      expect(r.value.sql).toContain('FROM "order_items"');
      expect(r.value.sql).toContain('LIMIT 10');
      expect(r.value.paramOrder).toEqual([]);
    }
  });

  it('surfaces structural errors', () => {
    const bad = {
      ...spec,
      graphs: {
        ...spec.graphs,
        g: {
          ...spec.graphs.g,
          signature: { inputs: {}, output: { type: 'rowset<OrderItem>', from: 'ghost' } },
        },
      },
    };
    const r = compile(bad, P, Q);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.code === 'STRUCT_INVALID_OUTPUT_FROM')).toBe(true);
  });

  it('returns a lowering error instead of throwing when compile hits an internal lowering invariant', () => {
    const bad = {
      ...spec,
      shapes: {
        CountShape: {
          fields: {
            count: { type: 'integer', nullable: false },
          },
        },
      },
      graphs: {
        g: {
          ...spec.graphs.g,
          signature: { inputs: {}, output: { type: 'row<CountShape>', from: 'agg' } },
          nodes: [
            { id: 'items', type: 'findMany' as const, config: { source: { entity: 'OrderItem' } } },
            {
              id: 'agg',
              type: 'reduce' as const,
              config: {
                input: 'items',
                into: 'CountShape',
                group: {},
                measures: { count: { fn: 'count_distinct' } },
              },
            },
          ],
        },
      },
    };

    const r = compile(bad, P, Q);

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors[0]).toMatchObject({
        layer: 'lowering',
        code: 'LOWERING_INTERNAL_ERROR',
      });
    }
  });

  it('explain returns a lowering error instead of throwing when lowering fails', () => {
    const bad = {
      ...spec,
      shapes: {
        CountShape: {
          fields: {
            count: { type: 'integer', nullable: false },
          },
        },
      },
      graphs: {
        g: {
          ...spec.graphs.g,
          signature: { inputs: {}, output: { type: 'row<CountShape>', from: 'agg' } },
          nodes: [
            { id: 'items', type: 'findMany' as const, config: { source: { entity: 'OrderItem' } } },
            {
              id: 'agg',
              type: 'reduce' as const,
              config: {
                input: 'items',
                into: 'CountShape',
                group: {},
                measures: { count: { fn: 'count_distinct' } },
              },
            },
          ],
        },
      },
    };

    const r = explain(bad, P, Q);

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors[0]).toMatchObject({
        layer: 'lowering',
        code: 'LOWERING_INTERNAL_ERROR',
      });
    }
  });

  it('run throws a package compile error with structured errors on compile failure', () => {
    const bad = {
      ...spec,
      graphs: {
        ...spec.graphs,
        g: {
          ...spec.graphs.g,
          signature: { inputs: {}, output: { type: 'rowset<OrderItem>', from: 'ghost' } },
        },
      },
    };

    expect(() => run(bad, P, Q, {}, { prepare: () => ({ all: () => [] }) } as never)).toThrow(
      GraphIrCompileError,
    );

    try {
      run(bad, P, Q, {}, { prepare: () => ({ all: () => [] }) } as never);
      expect.unreachable('run should throw on compile failure');
    } catch (e) {
      expect(e).toBeInstanceOf(GraphIrCompileError);
      if (e instanceof GraphIrCompileError) {
        expect(e.message).toBe('compile failed');
        expect(e.errors).not.toHaveLength(0);
      }
    }
  });
});
