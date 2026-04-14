import { describe, it, expect } from 'vitest';
import { parseAuthoringSpec } from '../../../src/parse/parse.js';

const baseSpec = {
  version: '1.0-rc7' as const,
  pdmRef: 'p',
  qsmRef: 'q',
  shapes: {},
  graphs: {
    g: {
      id: 'g',
      signature: {
        inputs: {
          issueId: { type: 'integer' as const, mode: 'required' as const },
          assigneeId: { type: 'integer' as const, mode: 'required' as const },
        },
        output: { type: 'row<CommandResult>', from: 'e' },
      },
      nodes: [
        {
          id: 'e',
          type: 'emit' as const,
          config: {
            aggregate: 'Issue',
            aggregateId: { $param: 'issueId' },
            transition: 'assign',
            payload: { assigneeId: { $param: 'assigneeId' } },
          },
        },
      ],
    },
  },
};

describe('parse emit node', () => {
  it('accepts a minimal emit node with aggregateId/transition/payload', () => {
    const r = parseAuthoringSpec(baseSpec);
    expect(r.ok).toBe(true);
    if (r.ok) {
      const emit = r.value.graphs.g!.nodes[0] as { type: string; config: { transition: string } };
      expect(emit.type).toBe('emit');
      expect(emit.config.transition).toBe('assign');
    }
  });

  it('accepts optional actor expr', () => {
    const spec = structuredClone(baseSpec) as typeof baseSpec & {
      graphs: { g: { nodes: Array<Record<string, unknown>> } };
    };
    (spec.graphs.g.nodes[0] as { config: Record<string, unknown> }).config.actor = { $param: 'actor' };
    const r = parseAuthoringSpec(spec);
    expect(r.ok).toBe(true);
  });

  it('rejects emit with unknown config key', () => {
    const spec = structuredClone(baseSpec) as typeof baseSpec & {
      graphs: { g: { nodes: Array<Record<string, unknown>> } };
    };
    (spec.graphs.g.nodes[0] as { config: Record<string, unknown> }).config.extra = true;
    const r = parseAuthoringSpec(spec);
    expect(r.ok).toBe(false);
  });
});
