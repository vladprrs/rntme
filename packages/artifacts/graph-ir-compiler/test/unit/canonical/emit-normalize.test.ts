import { describe, it, expect } from 'bun:test';
import { parseAuthoringSpec } from '../../../src/parse/parse.js';
import { normalize } from '../../../src/canonical/normalize.js';

describe('normalize emit node', () => {
  it('maps parsed emit to CanonicalEmit with aggregate/transition preserved', () => {
    const r = parseAuthoringSpec({
      version: '1.0-rc7',
      pdmRef: 'p',
      qsmRef: 'q',
      shapes: {},
      graphs: {
        g: {
          id: 'g',
          signature: {
            inputs: { id: { type: 'integer', mode: 'required' } },
            output: { type: 'row<CommandResult>', from: 'e' },
          },
          nodes: [
            {
              id: 'e',
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
    });
    if (!r.ok) throw new Error('parse failed');
    const { graphs } = normalize(r.value);
    const node = graphs.g!.nodes[0]!;
    expect(node.kind).toBe('emit');
    expect(node).toMatchObject({
      kind: 'emit',
      aggregate: 'Issue',
      transition: 'submit',
      payload: {},
      aggregateId: { $param: 'id' },
    });
    if (node.kind === 'emit') expect(node.actor).toBeUndefined();
  });
});
