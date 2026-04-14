import { describe, it, expect } from 'vitest';
import { inferRole } from '../../../src/role/infer.js';
import type { CanonicalGraph } from '../../../src/types/canonical.js';

function g(signature: CanonicalGraph['signature'], nodes: CanonicalGraph['nodes']): CanonicalGraph {
  return { id: 'g', signature, nodes, outputFrom: signature.output.from };
}

describe('inferRole', () => {
  it('returns predicate for root row<T> input + boolean output', () => {
    const r = inferRole(
      g(
        {
          inputs: { $root: { type: { row: 'T' }, mode: 'root' } },
          output: { type: 'boolean', from: 'f' },
        },
        [{ kind: 'filter', id: 'f', scope: 's1', input: '$root', expr: true }],
      ),
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe('predicate');
  });

  it('returns mapper for root row<T> input + row<U> output', () => {
    const r = inferRole(
      g(
        {
          inputs: { $root: { type: { row: 'T' }, mode: 'root' } },
          output: { type: 'row<U>', from: 'm' },
        },
        [{ kind: 'map', id: 'm', scope: 's1', input: '$root', into: 'U', fields: {} }],
      ),
    );
    if (r.ok) expect(r.value).toBe('mapper');
  });

  it('returns reducer for root rowset<T> + rowset<U> + >=1 reduce', () => {
    const r = inferRole(
      g(
        {
          inputs: { $root: { type: { rowset: 'T' }, mode: 'root' } },
          output: { type: 'rowset<U>', from: 'r' },
        },
        [
          {
            kind: 'reduce',
            id: 'r',
            scope: 's1',
            input: '$root',
            into: 'U',
            group: {},
            measures: {},
          },
        ],
      ),
    );
    if (r.ok) expect(r.value).toBe('reducer');
  });

  it('returns query for no root + rowset output + 0 emit', () => {
    const r = inferRole(
      g(
        { inputs: {}, output: { type: 'rowset<X>', from: 'fm' } },
        [
          {
            kind: 'findMany',
            id: 'fm',
            scope: 's1',
            source: { entity: 'X' },
            alias: 'x',
          },
        ],
      ),
    );
    if (r.ok) expect(r.value).toBe('query');
  });

  it('returns command for no root + >=1 emit', () => {
    const r = inferRole(
      g(
        {
          inputs: { id: { type: 'integer', mode: 'required' } },
          output: { type: 'row<CommandResult>', from: 'e' },
        },
        [
          {
            kind: 'emit',
            id: 'e',
            scope: 's1',
            aggregate: 'Issue',
            aggregateId: { $param: 'id' },
            transition: 'submit',
            payload: {},
          },
        ],
      ),
    );
    if (r.ok) expect(r.value).toBe('command');
  });

  it('returns GRAPH_MIXED_ROLE when rowset output and emit coexist', () => {
    const r = inferRole(
      g(
        {
          inputs: { id: { type: 'integer', mode: 'required' } },
          output: { type: 'rowset<X>', from: 'e' },
        },
        [
          {
            kind: 'emit',
            id: 'e',
            scope: 's1',
            aggregate: 'Issue',
            aggregateId: { $param: 'id' },
            transition: 'submit',
            payload: {},
          },
        ],
      ),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]!.code).toBe('GRAPH_MIXED_ROLE');
  });
});
