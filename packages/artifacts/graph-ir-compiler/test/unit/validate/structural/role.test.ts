import { describe, it, expect } from 'bun:test';
import { checkGraphRole } from '../../../../src/validate/structural/role.js';
import type { AuthoringSpecOutput } from '../../../../src/parse/schema.js';

describe('checkGraphRole', () => {
  it('passes for a pure query graph', () => {
    const errs = checkGraphRole({
      version: '1.0-rc7',
      pdmRef: 'p',
      qsmRef: 'q',
      shapes: {},
      graphs: {
        g: {
          id: 'g',
          signature: { inputs: {}, output: { type: 'rowset<X>', from: 'fm' } },
          nodes: [{ id: 'fm', type: 'findMany', config: { source: { entity: 'X' } } }],
        },
      },
    } satisfies AuthoringSpecOutput);
    expect(errs).toHaveLength(0);
  });

  it('emits GRAPH_MIXED_ROLE for rowset output + emit', () => {
    const errs = checkGraphRole({
      version: '1.0-rc7',
      pdmRef: 'p',
      qsmRef: 'q',
      shapes: {},
      graphs: {
        g: {
          id: 'g',
          signature: {
            inputs: { id: { type: 'integer', mode: 'required' } },
            output: { type: 'rowset<X>', from: 'e' },
          },
          nodes: [
            {
              id: 'e',
              type: 'emit',
              config: {
                aggregate: 'A',
                aggregateId: { $param: 'id' },
                transition: 't',
                payload: {},
              },
            },
          ],
        },
      },
    } satisfies AuthoringSpecOutput);
    expect(errs[0]?.code).toBe('GRAPH_MIXED_ROLE');
  });
});
