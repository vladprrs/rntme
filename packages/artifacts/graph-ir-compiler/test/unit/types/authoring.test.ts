import { describe, it, expectTypeOf } from 'vitest';
import type {
  AuthoringSpec,
  InputMode,
  GraphNode,
  FindManyNode,
  FilterNode,
  MapNode,
  ReduceNode,
  SortNode,
  LimitNode,
  FieldExpr,
} from '../../../src/types/authoring.js';

describe('AuthoringSpec types', () => {
  it('supports all MVP input modes', () => {
    expectTypeOf<InputMode>().toEqualTypeOf<
      'root' | 'required' | 'nullable' | 'defaulted' | 'predicate_optional'
    >();
  });

  it('supports MVP node union', () => {
    expectTypeOf<GraphNode>().toEqualTypeOf<
      FindManyNode | FilterNode | MapNode | ReduceNode | SortNode | LimitNode
    >();
  });

  it('type-checks a minimal spec literal', () => {
    const spec: AuthoringSpec = {
      version: '1.0-rc7',
      pdmRef: 'x',
      qsmRef: 'y',
      shapes: {},
      graphs: {
        g: {
          id: 'g',
          signature: { inputs: {}, output: { type: 'rowset<OrderItem>', from: 'items' } },
          nodes: [{ id: 'items', type: 'findMany', config: { source: { entity: 'OrderItem' } } }],
        },
      },
    };
    expectTypeOf(spec.version).toEqualTypeOf<'1.0-rc7'>();
    const n: FieldExpr = 'orderItem.unitPrice';
    expectTypeOf(n).toMatchTypeOf<FieldExpr>();
  });
});
