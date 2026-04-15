import { describe, expect, it } from 'vitest';
import { parseUiArtifact } from '../../../src/parse/parse.js';
import { validateStructural } from '../../../src/validate/structural.js';
import type { UiArtifactParsed } from '../../../src/parse/schema.js';

const base: UiArtifactParsed = {
  version: '1.0-rc1',
  pdmRef: 'x', qsmRef: 'x', graphSpecRef: 'x', bindingsRef: 'x',
  metadata: { title: { default: 'Demo' } },
  layouts: {},
  routes: {
    '/a': { page: { root: 'n', elements: { n: { type: 'Stack', props: {}, children: [] } } } },
  },
};

function prep(a: unknown): UiArtifactParsed {
  const p = parseUiArtifact(a);
  if (!p.ok) throw new Error('parse failed');
  return p.value;
}

describe('validateStructural — routes/roots/children', () => {
  it('accepts minimal valid', () => {
    const res = validateStructural(prep(base));
    expect(res.ok).toBe(true);
  });

  it('rejects malformed path', () => {
    const bad = JSON.parse(JSON.stringify(base)) as unknown;
    const badObj = bad as { routes: Record<string, unknown> };
    badObj.routes['noslash'] = badObj.routes['/a'];
    delete badObj.routes['/a'];
    const res = validateStructural(prep(bad));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.some((e) => e.code === 'UI_BAD_PATH_FORMAT')).toBe(true);
  });

  it('rejects missing root', () => {
    const bad = JSON.parse(JSON.stringify(base)) as unknown;
    const badObj = bad as { routes: { '/a': { page: { root: string } } } };
    badObj.routes['/a'].page.root = 'missing';
    const res = validateStructural(prep(bad));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.some((e) => e.code === 'UI_MISSING_ROOT')).toBe(true);
  });

  it('rejects bad child ref', () => {
    const bad = JSON.parse(JSON.stringify(base)) as unknown;
    const badObj = bad as {
      routes: { '/a': { page: { elements: { n: { children: string[] } } } } };
    };
    badObj.routes['/a'].page.elements.n.children = ['ghost'];
    const res = validateStructural(prep(bad));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.some((e) => e.code === 'UI_BAD_CHILD_REF')).toBe(true);
  });

  it('rejects orphan element', () => {
    const bad = JSON.parse(JSON.stringify(base)) as unknown;
    const badObj = bad as {
      routes: {
        '/a': {
          page: {
            elements: Record<
              string,
              { type: string; props: Record<string, unknown>; children: string[] }
            >;
          };
        };
      };
    };
    badObj.routes['/a'].page.elements['orphan'] = {
      type: 'Text',
      props: {},
      children: [],
    };
    const res = validateStructural(prep(bad));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.some((e) => e.code === 'UI_ORPHAN_ELEMENT')).toBe(true);
  });
});

describe('validateStructural — layouts/Slot', () => {
  it('rejects layout with no Slot when referenced', () => {
    const bad = JSON.parse(JSON.stringify(base));
    bad.layouts['main'] = { spec: { root: 's', elements: { s: { type: 'Stack', props: {}, children: [] } } } };
    bad.routes['/a'].layout = 'main';
    const res = validateStructural(prep(bad));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.some((e) => e.code === 'UI_LAYOUT_SLOT_MISSING')).toBe(true);
  });

  it('rejects layout with two Slots', () => {
    const bad = JSON.parse(JSON.stringify(base));
    bad.layouts['main'] = {
      spec: {
        root: 's',
        elements: {
          s: { type: 'Stack', props: {}, children: ['a', 'b'] },
          a: { type: 'Slot', props: {}, children: [] },
          b: { type: 'Slot', props: {}, children: [] },
        },
      },
    };
    bad.routes['/a'].layout = 'main';
    const res = validateStructural(prep(bad));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.some((e) => e.code === 'UI_LAYOUT_SLOT_DUPLICATE')).toBe(true);
  });

  it('allows unused layouts without Slot', () => {
    const bad = JSON.parse(JSON.stringify(base));
    bad.layouts['unused'] = { spec: { root: 's', elements: { s: { type: 'Stack', props: {}, children: [] } } } };
    const res = validateStructural(prep(bad));
    expect(res.ok).toBe(true);
  });
});

describe('validateStructural — tree references', () => {
  it('rejects action reference in tree with no declared action', () => {
    const bad = JSON.parse(JSON.stringify(base));
    bad.routes['/a'].page.elements.n.props = { action: 'submit' };
    const res = validateStructural(prep(bad));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.some((e) => e.code === 'UI_UNKNOWN_ACTION')).toBe(true);
  });

  it('accepts built-in setState action', () => {
    const ok_ = JSON.parse(JSON.stringify(base));
    ok_.routes['/a'].page.elements.n.props = { action: 'setState' };
    const res = validateStructural(prep(ok_));
    expect(res.ok).toBe(true);
  });

  it('rejects $state on unknown dataset', () => {
    const bad = JSON.parse(JSON.stringify(base));
    bad.routes['/a'].page.elements.n.props = { rows: { $state: '/data/ghost' } };
    const res = validateStructural(prep(bad));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.some((e) => e.code === 'UI_STATE_PATH_UNKNOWN_DATASET')).toBe(true);
  });

  it('rejects $state on unknown action status', () => {
    const bad = JSON.parse(JSON.stringify(base));
    bad.routes['/a'].page.elements.n.props = { msg: { $state: '/actions/__status/bogus' } };
    const res = validateStructural(prep(bad));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.some((e) => e.code === 'UI_STATE_PATH_UNKNOWN_ACTION')).toBe(true);
  });

  it('accepts free-zone /form/* state paths', () => {
    const ok_ = JSON.parse(JSON.stringify(base));
    ok_.routes['/a'].page.elements.n.props = { value: { $state: '/form/title' } };
    const res = validateStructural(prep(ok_));
    expect(res.ok).toBe(true);
  });
});
