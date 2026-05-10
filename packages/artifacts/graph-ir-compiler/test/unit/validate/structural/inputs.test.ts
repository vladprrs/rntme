import { describe, it, expect } from 'bun:test';
import { checkInputs } from '../../../../src/validate/structural/inputs.js';
import type { AuthoringSpecOutput } from '../../../../src/parse/schema.js';

function spec(
  inputs: AuthoringSpecOutput['graphs'][string]['signature']['inputs'],
): AuthoringSpecOutput {
  return {
    version: '1.0-rc7',
    pdmRef: 'x',
    qsmRef: 'y',
    shapes: {},
    graphs: {
      g: {
        id: 'g',
        signature: { inputs, output: { type: 'x', from: 'n' } },
        nodes: [{ id: 'n', type: 'findMany', config: { source: { entity: 'X' } } }],
      },
    },
  };
}

describe('checkInputs', () => {
  it('accepts zero root inputs', () => {
    expect(checkInputs(spec({ p: { type: 'integer', mode: 'required' } }))).toEqual([]);
  });

  it('accepts one row<T> root input', () => {
    expect(checkInputs(spec({ cand: { type: { row: 'OrderItem' }, mode: 'root' } }))).toEqual([]);
  });

  it('rejects two root inputs', () => {
    const errs = checkInputs(
      spec({
        a: { type: { row: 'X' }, mode: 'root' },
        b: { type: { rowset: 'Y' }, mode: 'root' },
      }),
    );
    expect(errs[0]?.code).toBe('STRUCT_MULTIPLE_ROOT_INPUTS');
  });

  it('rejects root with non-row/rowset type', () => {
    const errs = checkInputs(spec({ bad: { type: 'integer', mode: 'root' } }));
    expect(errs[0]?.code).toBe('STRUCT_ROOT_INPUT_TYPE');
  });
});
