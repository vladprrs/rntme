import { describe, it, expect } from 'vitest';
import { checkCommandShape } from '../../../../src/validate/structural/command-shape.js';
import type { AuthoringSpecOutput } from '../../../../src/parse/schema.js';

function specWithCommand(output: { type: string; from: string }, emitId = 'e'): AuthoringSpecOutput {
  return {
    version: '1.0-rc7',
    pdmRef: 'p',
    qsmRef: 'q',
    shapes: {},
    graphs: {
      g: {
        id: 'g',
        signature: { inputs: { id: { type: 'integer', mode: 'required' } }, output },
        nodes: [
          {
            id: emitId,
            type: 'emit',
            config: {
              aggregate: 'Issue',
              aggregateId: { $param: 'id' },
              transition: 'submit',
              payload: {},
            },
          },
        ],
      },
    },
  };
}

describe('checkCommandShape', () => {
  it('accepts row<CommandResult> with output.from pointing to an emit node', () => {
    const errs = checkCommandShape(specWithCommand({ type: 'row<CommandResult>', from: 'e' }));
    expect(errs).toHaveLength(0);
  });

  it('rejects output shape that is not row<CommandResult>', () => {
    const errs = checkCommandShape(specWithCommand({ type: 'row<Other>', from: 'e' }));
    expect(errs[0]?.code).toBe('CMD_OUTPUT_SHAPE_INVALID');
  });

  it('rejects output.from pointing to a non-emit node', () => {
    const s = specWithCommand({ type: 'row<CommandResult>', from: 'other' });
    s.graphs.g!.nodes.push({ id: 'other', type: 'filter', config: { input: 'e', expr: true } });
    const errs = checkCommandShape(s);
    expect(errs.some((e) => e.code === 'CMD_EMIT_UNREACHABLE')).toBe(true);
  });
});
