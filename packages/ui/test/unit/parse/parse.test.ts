import { describe, expect, it } from 'vitest';
import { parseUiArtifact } from '../../../src/parse/parse.js';

const minimal = {
  version: '1.0-rc1',
  pdmRef: 'x.pdm',
  qsmRef: 'x.qsm',
  graphSpecRef: 'x.graphs',
  bindingsRef: 'x.bindings',
  metadata: { title: { default: 'Demo' } },
  layouts: {},
  routes: {
    '/': {
      page: { root: 'n', elements: { n: { type: 'Stack', props: {}, children: [] } } },
    },
  },
};

describe('parseUiArtifact', () => {
  it('parses a minimal valid artifact', () => {
    const res = parseUiArtifact(minimal);
    expect(res.ok).toBe(true);
    if (res.ok) {
      const route = res.value.routes['/'];
      expect(route?.page.root).toBe('n');
    }
  });

  it('rejects wrong version literal', () => {
    const bad = { ...minimal, version: '0.9' };
    const res = parseUiArtifact(bad);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      const first = res.errors[0];
      expect(first).toBeDefined();
      if (first) expect(first.code).toBe('UI_PARSE_SCHEMA_VIOLATION');
    }
  });

  it('rejects missing routes', () => {
    const bad = { ...minimal, routes: undefined } as unknown;
    const res = parseUiArtifact(bad);
    expect(res.ok).toBe(false);
  });

  it('rejects action kind enum violation', () => {
    const bad = JSON.parse(JSON.stringify(minimal));
    bad.routes['/'].actions = { x: { kind: 'bogus', navigateTo: '/' } };
    const res = parseUiArtifact(bad);
    expect(res.ok).toBe(false);
  });
});
