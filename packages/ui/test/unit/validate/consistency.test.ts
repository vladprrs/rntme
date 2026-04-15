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

describe('validateConsistency — commands & typed state paths', () => {
  const base = (action: Record<string, unknown>) => ({
    version: '1.0-rc1',
    pdmRef: 'x', qsmRef: 'x', graphSpecRef: 'x', bindingsRef: 'x',
    metadata: { title: { default: 'Demo' } },
    layouts: {},
    routes: {
      '/a': {
        data: { issuesList: { binding: 'listIssues', params: { status: 'open', limit: 10, q: 'x' } } },
        actions: { submit: action },
        page: {
          root: 'n',
          elements: {
            n: { type: 'Table', props: { rows: { $state: '/data/issuesList' } }, children: [] },
          },
        },
      },
    },
  });

  const cmd: ResolvedBinding = {
    kind: 'command',
    inputs: [
      { name: 'title', type: { kind: 'scalar', primitive: 'string' }, mode: 'required' },
      { name: 'assigneeId', type: { kind: 'scalar', primitive: 'number' }, mode: 'required' },
    ],
    outputShape: { id: 'CmdResult', kind: 'object', fields: [{ name: 'version', type: { kind: 'scalar', primitive: 'number' } }] },
    http: { method: 'POST', path: '/v1/issues' },
  };

  const r: UiResolvers = {
    resolveBinding: (id) => (id === 'listIssues' ? listIssues : id === 'reportIssue' ? cmd : undefined),
    resolveComponent: (t) => ({
      propsSchema: z.any(),
      childrenModel: 'list',
      ...(t === 'Table' ? { knownListProps: ['rows'] as const } : {}),
    }),
    resolveRoute: () => true,
  };

  it('rejects command with uncovered required input', () => {
    const bad = base({ kind: 'command', binding: 'reportIssue', paramsFromState: { title: '/form/title' } });
    const res = validateConsistency(prep(bad, r), r);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.some((e) => e.code === 'UI_UNCOVERED_COMMAND_INPUT')).toBe(true);
  });

  it('accepts command with all inputs covered', () => {
    const good = base({
      kind: 'command', binding: 'reportIssue',
      paramsFromState: { title: '/form/title', assigneeId: '/form/assigneeId' },
    });
    const res = validateConsistency(prep(good, r), r);
    expect(res.ok).toBe(true);
  });

  it('rejects paramsFromState path pointing at wrong-shape dataset field', () => {
    const bad = base({
      kind: 'command', binding: 'reportIssue',
      paramsFromState: { title: '/data/issuesList/id', assigneeId: '/form/assigneeId' }, // id is number, title expects string
    });
    const res = validateConsistency(prep(bad, r), r);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.some((e) => e.code === 'UI_TYPE_MISMATCH')).toBe(true);
  });
});

describe('validateConsistency — enum variance (typesCompatible argument order)', () => {
  // Dataset has a field typed enum(['open']) — a strict subset of what the command accepts.
  const enumNarrowBinding: ResolvedBinding = {
    kind: 'query',
    inputs: [],
    outputShape: {
      id: 'EL', kind: 'list',
      element: {
        id: 'E', kind: 'object',
        fields: [{ name: 'status', type: { kind: 'enum', variants: ['open'] } }],
      },
    },
    http: { method: 'GET', path: '/v1/items' },
  };

  // Command binding accepts enum(['open', 'closed']).
  const enumWideCmd: ResolvedBinding = {
    kind: 'command',
    inputs: [{ name: 'status', type: { kind: 'enum', variants: ['open', 'closed'] }, mode: 'required' }],
    outputShape: { id: 'CmdOk', kind: 'object', fields: [] },
    http: { method: 'POST', path: '/v1/items' },
  };

  // Command binding accepts only enum(['open']).
  const enumNarrowCmd: ResolvedBinding = {
    kind: 'command',
    inputs: [{ name: 'status', type: { kind: 'enum', variants: ['open'] }, mode: 'required' }],
    outputShape: { id: 'CmdOk2', kind: 'object', fields: [] },
    http: { method: 'POST', path: '/v1/items' },
  };

  const enumBase = (action: Record<string, unknown>) => ({
    version: '1.0-rc1',
    pdmRef: 'x', qsmRef: 'x', graphSpecRef: 'x', bindingsRef: 'x',
    metadata: { title: { default: 'Demo' } },
    layouts: {},
    routes: {
      '/b': {
        data: { items: { binding: 'enumItems', params: {} } },
        actions: { doAction: action },
        page: { root: 'n', elements: { n: { type: 'Stack', props: {}, children: [] } } },
      },
    },
  });

  const wideR: UiResolvers = {
    resolveBinding: (id) =>
      id === 'enumItems' ? enumNarrowBinding : id === 'wideCmd' ? enumWideCmd : undefined,
    resolveComponent: () => ({ propsSchema: z.any(), childrenModel: 'list' }),
    resolveRoute: () => true,
  };

  const narrowR: UiResolvers = {
    resolveBinding: (id) =>
      id === 'enumItems' ? enumNarrowBinding : id === 'narrowCmd' ? enumNarrowCmd : undefined,
    resolveComponent: () => ({ propsSchema: z.any(), childrenModel: 'list' }),
    resolveRoute: () => true,
  };

  it('accepts: dataset produces enum(open), command accepts enum(open|closed) — subset is fine', () => {
    // UI can only emit 'open'; binding accepts both 'open' and 'closed' → should pass.
    const good = enumBase({
      kind: 'command', binding: 'wideCmd',
      paramsFromState: { status: '/data/items/status' },
    });
    const res = validateConsistency(prep(good, wideR), wideR);
    expect(res.ok).toBe(true);
  });

  it('rejects: dataset produces enum(open|closed), command accepts only enum(open) — superset is wrong', () => {
    // Dataset field is enum(['open','closed']) but binding only accepts enum(['open']).
    // Build a custom narrow dataset binding that has the wider enum field.
    const wideDataBinding: ResolvedBinding = {
      kind: 'query',
      inputs: [],
      outputShape: {
        id: 'EL2', kind: 'list',
        element: {
          id: 'E2', kind: 'object',
          fields: [{ name: 'status', type: { kind: 'enum', variants: ['open', 'closed'] } }],
        },
      },
      http: { method: 'GET', path: '/v1/items2' },
    };
    const mixedR: UiResolvers = {
      resolveBinding: (id) =>
        id === 'enumItems' ? wideDataBinding : id === 'narrowCmd' ? enumNarrowCmd : undefined,
      resolveComponent: () => ({ propsSchema: z.any(), childrenModel: 'list' }),
      resolveRoute: () => true,
    };
    const bad = enumBase({
      kind: 'command', binding: 'narrowCmd',
      paramsFromState: { status: '/data/items/status' },
    });
    const res = validateConsistency(prep(bad, mixedR), mixedR);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.some((e) => e.code === 'UI_TYPE_MISMATCH')).toBe(true);
  });
});
