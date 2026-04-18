import { describe, expect, it } from 'vitest';
import { parseAuthoringSpec } from '../../../src/parse/parse.js';

describe('parseAuthoringSpec — findMany source { eventType }', () => {
  const base = {
    version: '1.0-rc7',
    pdmRef: 'test-pdm',
    qsmRef: 'test-qsm',
    shapes: {},
    graphs: {
      g: {
        id: 'g',
        signature: {
          inputs: {},
          output: { type: 'rowset<Counts>', from: 'r' },
        },
        nodes: [
          { id: 's', type: 'findMany', config: { source: { eventType: 'IssueResolved' } } },
          {
            id: 'r',
            type: 'reduce',
            config: {
              input: 's',
              into: 'Counts',
              group: {},
              measures: { n: { fn: 'count' } },
            },
          },
        ],
      },
    },
  };

  it('accepts { eventType: "IssueResolved" } as a findMany source', () => {
    const r = parseAuthoringSpec(base);
    expect(r.ok).toBe(true);
  });

  it('rejects empty eventType string', () => {
    const spec = {
      ...base,
      graphs: {
        g: {
          ...base.graphs.g,
          nodes: [
            { id: 's', type: 'findMany', config: { source: { eventType: '' } } },
            {
              id: 'r',
              type: 'reduce',
              config: {
                input: 's',
                into: 'Counts',
                group: {},
                measures: { n: { fn: 'count' } },
              },
            },
          ],
        },
      },
    };
    const r = parseAuthoringSpec(spec);
    expect(r.ok).toBe(false);
  });
});
