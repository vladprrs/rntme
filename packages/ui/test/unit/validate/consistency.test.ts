import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { parseUiArtifact } from '../../../src/parse/parse.js';
import { validateStructural } from '../../../src/validate/structural.js';
import { validateReferences } from '../../../src/validate/references.js';
import { validateConsistency } from '../../../src/validate/consistency.js';
import type { UiResolvers, ResolvedBinding } from '../../../src/types/resolvers.js';

const listIssues: ResolvedBinding = {
  kind: 'query',
  inputs: [
    { name: 'status', type: { kind: 'scalar', primitive: 'string' }, mode: 'nullable' },
    { name: 'limit',  type: { kind: 'scalar', primitive: 'number' }, mode: 'defaulted' },
    { name: 'q',      type: { kind: 'scalar', primitive: 'string' }, mode: 'required' },
  ],
  outputShape: { id: 'IL', kind: 'list', element: { id: 'I', kind: 'object', fields: [{ name: 'id', type: { kind: 'scalar', primitive: 'number' } }] } },
  http: { method: 'GET', path: '/v1/issues' },
};

const predicateQuery: ResolvedBinding = {
  ...listIssues,
  inputs: [{ name: 'f', type: { kind: 'scalar', primitive: 'string' }, mode: 'predicate_optional' }],
};

function resolvers(b: ResolvedBinding = listIssues): UiResolvers {
  return {
    resolveBinding: (id) => (id === 'listIssues' ? b : undefined),
    resolveComponent: () => ({ propsSchema: z.any(), childrenModel: 'list' }),
    resolveRoute: () => true,
  };
}

function prep(a: unknown, r = resolvers()) {
  const p = parseUiArtifact(a);
  if (!p.ok) throw new Error('parse: ' + JSON.stringify(p.errors));
  const s = validateStructural(p.value);
  if (!s.ok) throw new Error('structural: ' + JSON.stringify(s.errors));
  const ref = validateReferences(s.value, r);
  if (!ref.ok) throw new Error('references: ' + JSON.stringify(ref.errors));
  return ref.value;
}

const baseFor = (dataset: Record<string, unknown>) => ({
  version: '1.0-rc1',
  pdmRef: 'x', qsmRef: 'x', graphSpecRef: 'x', bindingsRef: 'x',
  metadata: { title: { default: 'Demo' } },
  layouts: {},
  routes: {
    '/a': {
      data: { issuesList: dataset },
      page: { root: 'n', elements: { n: { type: 'Stack', props: {}, children: [] } } },
    },
  },
});

describe('validateConsistency — datasets', () => {
  it('rejects missing required input', () => {
    const bad = baseFor({ binding: 'listIssues', params: { status: 'open', limit: 10 } });
    const res = validateConsistency(prep(bad), resolvers());
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.some((e) => e.code === 'UI_UNCOVERED_QUERY_INPUT')).toBe(true);
  });

  it('accepts covered required input', () => {
    const good = baseFor({ binding: 'listIssues', params: { status: 'open', limit: 10, q: 'bug' } });
    const res = validateConsistency(prep(good), resolvers());
    expect(res.ok).toBe(true);
  });

  it('rejects literal type mismatch', () => {
    const bad = baseFor({ binding: 'listIssues', params: { status: 'open', limit: 'ten', q: 'bug' } });
    const res = validateConsistency(prep(bad), resolvers());
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.some((e) => e.code === 'UI_TYPE_MISMATCH')).toBe(true);
  });

  it('rejects predicate_optional input on UI', () => {
    const bad = baseFor({ binding: 'listIssues' });
    const res = validateConsistency(prep(bad, resolvers(predicateQuery)), resolvers(predicateQuery));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.some((e) => e.code === 'UI_UNSUPPORTED_INPUT_MODE')).toBe(true);
  });

  it('rejects string literal for ref-typed input', () => {
    const refBinding: ResolvedBinding = {
      kind: 'query',
      inputs: [{ name: 'fooRef', type: { kind: 'ref', shapeId: 'Foo' }, mode: 'required' }],
      outputShape: { id: 'IL', kind: 'list', element: { id: 'I', kind: 'object', fields: [{ name: 'id', type: { kind: 'scalar', primitive: 'number' } }] } },
      http: { method: 'GET', path: '/v1/issues' },
    };
    const bad = baseFor({ binding: 'listIssues', params: { fooRef: 'not-a-ref' } });
    const res = validateConsistency(prep(bad, resolvers(refBinding)), resolvers(refBinding));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.some((e) => e.code === 'UI_TYPE_MISMATCH')).toBe(true);
  });
});
