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
