import { describe, it, expect } from 'bun:test';
import { checkRefs } from '../../../../src/validate/structural/refs.js';
import type { AuthoringSpecOutput } from '../../../../src/parse/schema.js';

function spec(
  inputs: AuthoringSpecOutput['graphs'][string]['signature']['inputs'],
  nodes: AuthoringSpecOutput['graphs'][string]['nodes'],
  from = 'last',
): AuthoringSpecOutput {
  return {
    version: '1.0-rc7',
    pdmRef: 'x',
    qsmRef: 'y',
    shapes: {},
    graphs: { g: { id: 'g', signature: { inputs, output: { type: 'rowset<OrderItem>', from } }, nodes } },
  };
}

describe('checkRefs', () => {
  it('accepts valid prior-node reference', () => {
    const s = spec({}, [
      { id: 'items', type: 'findMany', config: { source: { entity: 'OrderItem' } } },
      { id: 'last', type: 'limit', config: { input: 'items', count: 1 } },
    ]);
    expect(checkRefs(s)).toEqual([]);
  });

  it('rejects reference to a later node', () => {
    const s = spec({}, [
      { id: 'a', type: 'limit', config: { input: 'b', count: 1 } },
      { id: 'b', type: 'findMany', config: { source: { entity: 'X' } } },
    ]);
    expect(checkRefs(s).some((e) => e.code === 'STRUCT_INVALID_INPUT_REF')).toBe(true);
  });

  it('rejects reference to unknown node', () => {
    const s = spec({}, [
      { id: 'items', type: 'findMany', config: { source: { entity: 'OrderItem' } } },
      { id: 'last', type: 'limit', config: { input: 'ghost', count: 1 } },
    ]);
    expect(checkRefs(s).some((e) => e.code === 'STRUCT_INVALID_INPUT_REF')).toBe(true);
  });

  it('accepts $root when graph has a root input', () => {
    const s = spec(
      { cand: { type: { row: 'OrderItem' }, mode: 'root' } },
      [{ id: 'last', type: 'filter', config: { input: '$root', expr: true } }],
    );
    expect(checkRefs(s)).toEqual([]);
  });

  it('rejects $root when graph has no root input', () => {
    const s = spec({}, [
      { id: 'items', type: 'findMany', config: { source: { entity: 'X' } } },
      { id: 'last', type: 'filter', config: { input: '$root', expr: true } },
    ]);
    expect(checkRefs(s).some((e) => e.code === 'STRUCT_ROOT_REF_WITHOUT_ROOT_INPUT')).toBe(true);
  });
});
