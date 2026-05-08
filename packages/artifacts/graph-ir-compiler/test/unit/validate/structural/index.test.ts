import { describe, it, expect } from 'vitest';
import { validateStructural } from '../../../../src/validate/structural/index.js';
import type { AuthoringSpecOutput } from '../../../../src/parse/schema.js';
import { commercePdm as P, commerceQsm as Q } from '../../../fixtures/validated-commerce.js';

const good: AuthoringSpecOutput = {
  version: '1.0-rc7',
  pdmRef: 'x',
  qsmRef: 'y',
  shapes: {},
  graphs: {
    g: {
      id: 'g',
      signature: { inputs: {}, output: { type: 'rowset<OrderItem>', from: 'paged' } },
      nodes: [
        { id: 'items', type: 'findMany', config: { source: { entity: 'OrderItem' } } },
        { id: 'paged', type: 'limit', config: { input: 'items', count: 10 } },
      ],
    },
  },
};

describe('validateStructural', () => {
  it('passes a good spec', () => {
    expect(validateStructural(good, P, Q)).toEqual({ ok: true, value: good });
  });

  it('accumulates errors from multiple rules', () => {
    const bad: AuthoringSpecOutput = {
      ...good,
      graphs: {
        g: {
          id: 'g',
          signature: { inputs: {}, output: { type: 'rowset<OrderItem>', from: 'ghost' } },
          nodes: [
            { id: 'a', type: 'distinct', config: { input: 'a' } },
            { id: 'a', type: 'findMany', config: { source: { entity: 'X' } } },
          ],
        },
      },
    };
    const r = validateStructural(bad, P, Q);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const codes = new Set(r.errors.map((e) => e.code));
      expect(codes).toContain('STRUCT_DUPLICATE_NODE_ID');
      expect(codes).toContain('STRUCT_INVALID_OUTPUT_FROM');
      expect(codes).toContain('TIER1_UNSUPPORTED_NODE');
    }
  });

  // Single-pass visitor must not short-circuit: every rule that fires must be
  // reported, even when the same graph trips many of them at once. This locks
  // in the contract that consolidating per-node walks did not regress
  // diagnostic coverage.
  it('reports the full set of failures across rule families in one pass', () => {
    const bad: AuthoringSpecOutput = {
      version: '1.0-rc7',
      pdmRef: 'x',
      qsmRef: 'y',
      shapes: {},
      graphs: {
        gKey: {
          // STRUCT_DUPLICATE_GRAPH_ID: graph.id !== graphKey
          id: 'gOther',
          signature: {
            // STRUCT_MULTIPLE_ROOT_INPUTS + STRUCT_ROOT_INPUT_TYPE on r2
            inputs: {
              r1: { type: { row: 'OrderItem' }, mode: 'root' },
              r2: { type: 'integer', mode: 'root' },
            },
            // STRUCT_INVALID_OUTPUT_FROM ("ghost" not a node)
            output: { type: 'rowset<OrderItem>', from: 'ghost' },
          },
          nodes: [
            // TIER1_UNSUPPORTED_NODE (distinct) + STRUCT_INVALID_INPUT_REF
            // ("missing" not a prior node)
            { id: 'd', type: 'distinct', config: { input: 'missing' } },
            // STRUCT_DUPLICATE_NODE_ID ("d" reused)
            { id: 'd', type: 'findMany', config: { source: { entity: 'OrderItem' } } },
            // STRUCT_UNKNOWN_SHAPE on into="Nope"
            {
              id: 'm',
              type: 'map',
              config: { input: 'd', into: 'Nope', fields: { x: 1 } },
            },
          ],
        },
      },
    };
    const r = validateStructural(bad, P, Q);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const codes = new Set(r.errors.map((e) => e.code));
      // Every expected rule family must fire.
      expect(codes).toContain('STRUCT_DUPLICATE_GRAPH_ID');
      expect(codes).toContain('STRUCT_DUPLICATE_NODE_ID');
      expect(codes).toContain('STRUCT_INVALID_INPUT_REF');
      expect(codes).toContain('STRUCT_INVALID_OUTPUT_FROM');
      expect(codes).toContain('STRUCT_MULTIPLE_ROOT_INPUTS');
      expect(codes).toContain('STRUCT_ROOT_INPUT_TYPE');
      expect(codes).toContain('STRUCT_UNKNOWN_SHAPE');
      expect(codes).toContain('TIER1_UNSUPPORTED_NODE');
      // And we got at least 8 distinct errors (no rule is silently dropped).
      expect(r.errors.length).toBeGreaterThanOrEqual(8);
    }
  });
});
