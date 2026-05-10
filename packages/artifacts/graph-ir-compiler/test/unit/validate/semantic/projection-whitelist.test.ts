import { describe, it, expect } from 'bun:test';
import { validateProjectionWhitelist } from '../../../../src/validate/semantic/projection-whitelist.js';
import type { CanonicalGraph, CanonicalNode } from '../../../../src/types/canonical.js';

function g(nodes: CanonicalNode[]): CanonicalGraph {
  return {
    id: 'g',
    signature: { inputs: {}, output: { type: 'rowset<R>', from: 'r' } },
    nodes,
    outputFrom: 'r',
  };
}

const src: CanonicalNode = {
  kind: 'findMany',
  id: 's',
  scope: 's1',
  source: { eventType: 'X' },
  alias: 'ev',
};

const countReduce: CanonicalNode = {
  kind: 'reduce',
  id: 'r',
  scope: 's2',
  input: 's',
  into: 'R',
  group: {},
  measures: { n: { fn: 'count' } },
};

describe('validateProjectionWhitelist', () => {
  it('accepts findMany + reduce(count)', () => {
    expect(validateProjectionWhitelist(g([src, countReduce]))).toEqual([]);
  });

  it('accepts findMany + filter + map + reduce(count, sum)', () => {
    const nodes: CanonicalNode[] = [
      src,
      { kind: 'filter', id: 'f', scope: 's2', input: 's', expr: true },
      { kind: 'map', id: 'm', scope: 's3', input: 'f', into: 'M', fields: {} },
      {
        kind: 'reduce',
        id: 'r',
        scope: 's4',
        input: 'm',
        into: 'R',
        group: { pid: 'ev.projectId' },
        measures: { n: { fn: 'count' }, s: { fn: 'sum', expr: 'ev.storyPoints' } },
      },
    ];
    expect(validateProjectionWhitelist(g(nodes))).toEqual([]);
  });

  it('rejects sort node with PROJ_SEMANTIC_UNSUPPORTED_OP', () => {
    const sort: CanonicalNode = {
      kind: 'sort',
      id: 'o',
      scope: 's2',
      input: 's',
      by: [{ field: 'ev.occurredAt', dir: 'asc', nulls: 'last' }],
    };
    const errs = validateProjectionWhitelist(g([src, sort, countReduce]));
    expect(errs.map((e) => e.code)).toContain('PROJ_SEMANTIC_UNSUPPORTED_OP');
  });

  it('rejects reduce with min aggregate', () => {
    const min: CanonicalNode = {
      kind: 'reduce',
      id: 'r',
      scope: 's2',
      input: 's',
      into: 'R',
      group: {},
      measures: { m: { fn: 'min', expr: 'ev.storyPoints' } },
    };
    const errs = validateProjectionWhitelist(g([src, min]));
    expect(errs.map((e) => e.code)).toContain('PROJ_SEMANTIC_UNSUPPORTED_AGG');
  });

  it('rejects reduce with non-string group value', () => {
    const nodes: CanonicalNode[] = [
      src,
      {
        kind: 'reduce',
        id: 'r',
        scope: 's2',
        input: 's',
        into: 'R',
        group: { bad: { add: ['ev.a', 1] } as unknown as string },
        measures: { n: { fn: 'count' } },
      },
    ];
    const errs = validateProjectionWhitelist(g(nodes));
    expect(errs.map((e) => e.code)).toContain('PROJ_SEMANTIC_UNSUPPORTED_GROUP');
  });

  it('rejects filter with exists-subquery', () => {
    const nodes: CanonicalNode[] = [
      src,
      {
        kind: 'filter',
        id: 'f',
        scope: 's2',
        input: 's',
        expr: { exists: { relation: 'R', where: true } },
      },
      countReduce,
    ];
    const errs = validateProjectionWhitelist(g(nodes));
    expect(errs.map((e) => e.code)).toContain('PROJ_SEMANTIC_UNSUPPORTED_OP');
  });

  it('rejects non-empty signature.inputs', () => {
    const graph: CanonicalGraph = {
      id: 'g',
      signature: {
        inputs: { p: { type: 'integer', mode: 'required' } },
        output: { type: 'rowset<R>', from: 'r' },
      },
      nodes: [src, countReduce],
      outputFrom: 'r',
    };
    const errs = validateProjectionWhitelist(graph);
    expect(errs.map((e) => e.code)).toContain('PROJ_SEMANTIC_UNSUPPORTED_OP');
  });
});
