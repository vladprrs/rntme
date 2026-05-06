import { describe, expect, it } from 'vitest';
import { normalize } from '../../../src/canonical/normalize.js';
import type { AuthoringSpecOutput } from '../../../src/parse/schema.js';

describe('operation node normalization', () => {
  it('normalizes call, branch, and result nodes', () => {
    const spec = {
      version: '1.0-rc7',
      pdmRef: 'x',
      qsmRef: 'y',
      shapes: {},
      graphs: {
        g: {
          id: 'g',
          signature: {
            inputs: { sku: { type: 'string', mode: 'required' } },
            output: { type: 'row<Result>', from: 'out' },
          },
          nodes: [
            {
              id: 'call',
              type: 'call',
              target: { service: 's', operation: 'op' },
              input: { sku: { $param: 'sku' } },
              policy: { timeoutMs: 500, onError: 'fail' },
            },
            { id: 'branch', type: 'branch', cases: [{ default: true, then: 'out' }] },
            { id: 'out', type: 'result', value: { ok: { $literal: true } } },
          ],
        },
      },
    } as unknown as AuthoringSpecOutput;

    const normalized = normalize(spec);
    const graph = normalized.graphs.g!;
    expect(graph.nodes.map((node) => node.kind)).toEqual(['call', 'branch', 'result']);
    expect(graph.outputFrom).toBe('out');
  });
});
