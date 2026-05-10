import { describe, it, expect } from 'bun:test';
import { checkParamContext } from '../../../../src/validate/semantic/param-context.js';
import { normalize } from '../../../../src/canonical/normalize.js';
import type { AuthoringSpecOutput } from '../../../../src/parse/schema.js';

// Minimal spec builder helpers
function baseSpec(overrides: Partial<AuthoringSpecOutput> = {}): AuthoringSpecOutput {
  return {
    version: '1.0-rc7',
    pdmRef: 'x',
    qsmRef: 'y',
    shapes: {},
    graphs: {},
    ...overrides,
  };
}

const PREDICATE_OPTIONAL_INPUT = {
  minPrice: { type: 'decimal' as const, mode: 'predicate_optional' as const },
};

const REQUIRED_INPUT = {
  minPrice: { type: 'decimal' as const, mode: 'required' as const },
};

// --- Accept: predicate_optional used inside filter.expr ---
describe('checkParamContext', () => {
  it('accepts predicate_optional param used in filter.expr', () => {
    const s = baseSpec({
      graphs: {
        g: {
          id: 'g',
          signature: {
            inputs: PREDICATE_OPTIONAL_INPUT,
            output: { type: 'rowset<OrderItem>', from: 'f' },
          },
          nodes: [
            { id: 'items', type: 'findMany', config: { source: { entity: 'OrderItem' } } },
            {
              id: 'f',
              type: 'filter',
              config: {
                input: 'items',
                expr: { gte: ['orderItem.unitPrice', { $param: 'minPrice' }] },
              },
            },
          ],
        },
      },
    });
    const { graphs } = normalize(s);
    const errs = checkParamContext(graphs.g!);
    expect(errs).toHaveLength(0);
  });

  // --- Reject: predicate_optional param used in map.fields ---
  it('rejects predicate_optional param used in map.fields', () => {
    const s = baseSpec({
      graphs: {
        g: {
          id: 'g',
          signature: {
            inputs: PREDICATE_OPTIONAL_INPUT,
            output: { type: 'rowset<Mapped>', from: 'm' },
          },
          nodes: [
            { id: 'items', type: 'findMany', config: { source: { entity: 'OrderItem' } } },
            {
              id: 'm',
              type: 'map',
              config: {
                input: 'items',
                into: 'Mapped',
                fields: {
                  price: { $param: 'minPrice' },
                },
              },
            },
          ],
        },
      },
    });
    const { graphs } = normalize(s);
    const errs = checkParamContext(graphs.g!);
    expect(errs).toHaveLength(1);
    expect(errs[0]?.code).toBe('SEM_PARAM_CONTEXT');
  });

  // --- Reject: predicate_optional param used in limit.count ---
  it('rejects predicate_optional param used in limit.count', () => {
    const s = baseSpec({
      graphs: {
        g: {
          id: 'g',
          signature: {
            inputs: PREDICATE_OPTIONAL_INPUT,
            output: { type: 'rowset<OrderItem>', from: 'lim' },
          },
          nodes: [
            { id: 'items', type: 'findMany', config: { source: { entity: 'OrderItem' } } },
            {
              id: 'lim',
              type: 'limit',
              config: { input: 'items', count: { $param: 'minPrice' } },
            },
          ],
        },
      },
    });
    const { graphs } = normalize(s);
    const errs = checkParamContext(graphs.g!);
    expect(errs).toHaveLength(1);
    expect(errs[0]?.code).toBe('SEM_PARAM_CONTEXT');
  });

  // --- Reject: predicate_optional param used in reduce.measures[*].expr ---
  it('rejects predicate_optional param used in reduce.measures expr', () => {
    const s = baseSpec({
      graphs: {
        g: {
          id: 'g',
          signature: {
            inputs: PREDICATE_OPTIONAL_INPUT,
            output: { type: 'rowset<Agg>', from: 'r' },
          },
          nodes: [
            { id: 'items', type: 'findMany', config: { source: { entity: 'OrderItem' } } },
            {
              id: 'r',
              type: 'reduce',
              config: {
                input: 'items',
                into: 'Agg',
                group: { catId: 'orderItem.productId' },
                measures: {
                  total: { fn: 'sum', expr: { $param: 'minPrice' } },
                },
              },
            },
          ],
        },
      },
    });
    const { graphs } = normalize(s);
    const errs = checkParamContext(graphs.g!);
    expect(errs).toHaveLength(1);
    expect(errs[0]?.code).toBe('SEM_PARAM_CONTEXT');
  });

  // --- Accept: non-predicate_optional param used anywhere is fine ---
  it('accepts required param used in map.fields (no SEM_PARAM_CONTEXT)', () => {
    const s = baseSpec({
      graphs: {
        g: {
          id: 'g',
          signature: {
            inputs: REQUIRED_INPUT,
            output: { type: 'rowset<Mapped>', from: 'm' },
          },
          nodes: [
            { id: 'items', type: 'findMany', config: { source: { entity: 'OrderItem' } } },
            {
              id: 'm',
              type: 'map',
              config: {
                input: 'items',
                into: 'Mapped',
                fields: {
                  price: { $param: 'minPrice' },
                },
              },
            },
          ],
        },
      },
    });
    const { graphs } = normalize(s);
    const errs = checkParamContext(graphs.g!);
    expect(errs).toHaveLength(0);
  });

  it('accepts nullable param used in limit.count (no SEM_PARAM_CONTEXT)', () => {
    const s = baseSpec({
      graphs: {
        g: {
          id: 'g',
          signature: {
            inputs: { n: { type: 'integer' as const, mode: 'nullable' as const } },
            output: { type: 'rowset<OrderItem>', from: 'lim' },
          },
          nodes: [
            { id: 'items', type: 'findMany', config: { source: { entity: 'OrderItem' } } },
            {
              id: 'lim',
              type: 'limit',
              config: { input: 'items', count: { $param: 'n' } },
            },
          ],
        },
      },
    });
    const { graphs } = normalize(s);
    const errs = checkParamContext(graphs.g!);
    expect(errs).toHaveLength(0);
  });

  // --- Deeply nested in a map field (inside `and`) ---
  it('rejects predicate_optional param nested inside a map field expr', () => {
    const s = baseSpec({
      graphs: {
        g: {
          id: 'g',
          signature: {
            inputs: PREDICATE_OPTIONAL_INPUT,
            output: { type: 'rowset<Mapped>', from: 'm' },
          },
          nodes: [
            { id: 'items', type: 'findMany', config: { source: { entity: 'OrderItem' } } },
            {
              id: 'm',
              type: 'map',
              config: {
                input: 'items',
                into: 'Mapped',
                fields: {
                  flag: { and: [{ gte: ['orderItem.unitPrice', { $param: 'minPrice' }] }, true] },
                },
              },
            },
          ],
        },
      },
    });
    const { graphs } = normalize(s);
    const errs = checkParamContext(graphs.g!);
    expect(errs).toHaveLength(1);
    expect(errs[0]?.code).toBe('SEM_PARAM_CONTEXT');
  });

  // --- Walker coverage: case expr inside map.fields ---
  it('rejects predicate_optional param inside case expr in map.fields', () => {
    const s = baseSpec({
      graphs: {
        g: {
          id: 'g',
          signature: {
            inputs: PREDICATE_OPTIONAL_INPUT,
            output: { type: 'rowset<Mapped>', from: 'm' },
          },
          nodes: [
            { id: 'items', type: 'findMany', config: { source: { entity: 'OrderItem' } } },
            {
              id: 'm',
              type: 'map',
              config: {
                input: 'items',
                into: 'Mapped',
                fields: {
                  label: {
                    case: {
                      when: [[{ gte: ['orderItem.unitPrice', { $param: 'minPrice' }] }, 'high']],
                      else: 'low',
                    },
                  },
                },
              },
            },
          ],
        },
      },
    });
    const { graphs } = normalize(s);
    const errs = checkParamContext(graphs.g!);
    expect(errs).toHaveLength(1);
    expect(errs[0]?.code).toBe('SEM_PARAM_CONTEXT');
  });

  // --- Walker coverage: exists.where inside map.fields ---
  it('rejects predicate_optional param inside exists.where in map.fields', () => {
    const s = baseSpec({
      graphs: {
        g: {
          id: 'g',
          signature: {
            inputs: PREDICATE_OPTIONAL_INPUT,
            output: { type: 'rowset<Mapped>', from: 'm' },
          },
          nodes: [
            { id: 'items', type: 'findMany', config: { source: { entity: 'OrderItem' } } },
            {
              id: 'm',
              type: 'map',
              config: {
                input: 'items',
                into: 'Mapped',
                fields: {
                  hasMatch: {
                    exists: {
                      relation: 'orderItem.tags',
                      where: { gte: ['tag.score', { $param: 'minPrice' }] },
                    },
                  },
                },
              },
            },
          ],
        },
      },
    });
    const { graphs } = normalize(s);
    const errs = checkParamContext(graphs.g!);
    expect(errs).toHaveLength(1);
    expect(errs[0]?.code).toBe('SEM_PARAM_CONTEXT');
  });
});
