import { describe, expect, it } from 'bun:test';
import { evalOperationExpr } from '../../../src/operation/eval.js';

describe('evalOperationExpr', () => {
  it('resolves $ref paths through array indexes', () => {
    expect(
      evalOperationExpr(
        { $ref: 'completion.result.content[0].text.text' },
        {},
        {
          completion: {
            result: {
              content: [
                { text: { text: '{"full_name":"Anna Example"}' } },
              ],
            },
          },
        },
      ),
    ).toBe('{"full_name":"Anna Example"}');
  });
});
