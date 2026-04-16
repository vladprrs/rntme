import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { parseUiArtifact } from '../../../src/parse/parse.js';
import { validateStructural } from '../../../src/validate/structural.js';
import { validateReferences } from '../../../src/validate/references.js';
import type { UiResolvers, ResolvedBinding } from '../../../src/types/resolvers.js';

const listIssues: ResolvedBinding = {
  kind: 'query',
  inputs: [{ name: 'status', type: { kind: 'scalar', primitive: 'string' }, mode: 'nullable' }],
  outputShape: { id: 'IssueList', kind: 'list', element: { id: 'Issue', kind: 'object', fields: [{ name: 'id', type: { kind: 'scalar', primitive: 'number' } }] } },
  http: { method: 'GET', path: '/v1/issues' },
};

const reportIssue: ResolvedBinding = {
  kind: 'command',
  inputs: [{ name: 'title', type: { kind: 'scalar', primitive: 'string' }, mode: 'required' }],
  outputShape: { id: 'CmdResult', kind: 'object', fields: [{ name: 'version', type: { kind: 'scalar', primitive: 'number' } }] },
  http: { method: 'POST', path: '/v1/issues' },
};

function makeResolvers(overrides: Partial<UiResolvers> = {}): UiResolvers {
  return {
    resolveBinding: (id) => (id === 'listIssues' ? listIssues : id === 'reportIssue' ? reportIssue : undefined),
    resolveComponent: (t) => {
      if (!['Stack', 'Table', 'Slot', 'Button', 'Text'].includes(t)) return undefined;
      const base = { propsSchema: z.any(), childrenModel: 'list' as const };
      return t === 'Table' ? { ...base, knownListProps: ['rows'] as const } : base;
    },
    resolveRoute: (p) => ['/', '/a', '/b', '/issues', '/issues/new'].includes(p),
    ...overrides,
  };
}

function prep(a: unknown) {
  const p = parseUiArtifact(a);
  if (!p.ok) throw new Error('parse failed');
  const s = validateStructural(p.value);
  if (!s.ok) throw new Error('structural failed: ' + JSON.stringify(s.errors));
  return s.value;
}

const base = {
  version: '1.0-rc1',
  pdmRef: 'x', qsmRef: 'x', graphSpecRef: 'x', bindingsRef: 'x',
  metadata: { title: { default: 'Demo' } },
  layouts: {},
  routes: {
    '/a': {
      data: { issuesList: { binding: 'listIssues' } },
      actions: { submit: { kind: 'command', binding: 'reportIssue', paramsFromState: { title: '/form/title' } } },
      page: { root: 'n', elements: { n: { type: 'Stack', props: {}, children: [] } } },
    },
  },
};

describe('validateReferences', () => {
  it('accepts a minimal artifact with valid refs', () => {
    const res = validateReferences(prep(base), makeResolvers());
    expect(res.ok).toBe(true);
  });

  it('rejects unresolved binding', () => {
    const bad = JSON.parse(JSON.stringify(base));
    bad.routes['/a'].data.issuesList.binding = 'ghost';
    const res = validateReferences(prep(bad), makeResolvers());
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.some((e) => e.code === 'UI_UNRESOLVED_BINDING')).toBe(true);
  });

  it('rejects binding kind mismatch (command used in data)', () => {
    const bad = JSON.parse(JSON.stringify(base));
    bad.routes['/a'].data.issuesList.binding = 'reportIssue';
    const res = validateReferences(prep(bad), makeResolvers());
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.some((e) => e.code === 'UI_BINDING_KIND_MISMATCH')).toBe(true);
  });

  it('rejects unknown component type', () => {
    const bad = JSON.parse(JSON.stringify(base));
    bad.routes['/a'].page.elements.n.type = 'Gibberish';
    const res = validateReferences(prep(bad), makeResolvers());
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.some((e) => e.code === 'UI_UNKNOWN_COMPONENT_TYPE')).toBe(true);
  });

  it('rejects unknown layout', () => {
    const bad = JSON.parse(JSON.stringify(base));
    bad.routes['/a'].layout = 'missing';
    const res = validateReferences(prep(bad), makeResolvers());
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.some((e) => e.code === 'UI_UNKNOWN_LAYOUT')).toBe(true);
  });

  it('rejects navigation to unknown route', () => {
    const bad = JSON.parse(JSON.stringify(base));
    bad.routes['/a'].actions.openThing = { kind: 'navigation', navigateTo: '/nowhere' };
    const res = validateReferences(prep(bad), makeResolvers());
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.some((e) => e.code === 'UI_NAVIGATION_UNKNOWN_ROUTE')).toBe(true);
  });
});
